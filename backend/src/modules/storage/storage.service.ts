import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const MIME_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'application/pdf': 'pdf', 'text/plain': 'txt',
};

/**
 * Local-disk object storage that lives ON THE VPS (a mounted Docker volume), so
 * uploaded evidence/attachments are stored on your own server rather than a
 * managed service. Files are written under UPLOAD_DIR and served as static
 * assets at PUBLIC_UPLOADS_BASE (default `/uploads`) — by Nginx in production,
 * or by the app's own static handler as a fallback.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');
  /** Absolute path to the uploads root (mounted volume on the VPS). */
  readonly root = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
  private readonly publicBase = (process.env.PUBLIC_UPLOADS_BASE ?? '/uploads').replace(/\/$/, '');
  private readonly maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);

  /** Persist a base64 data-URL to disk; returns the public URL to store on the record. */
  async saveDataUrl(dataUrl: string, subdir = 'misc'): Promise<{ url: string }> {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) throw new BadRequestException({ errorCode: 'INVALID_DATA_URL', message: 'Not a valid data URL.' });
    const [, mime, isB64, payload] = m;
    const buf = isB64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
    if (buf.byteLength > this.maxBytes) throw new BadRequestException({ errorCode: 'FILE_TOO_LARGE', message: `File exceeds ${Math.round(this.maxBytes / 1024 / 1024)} MB.` });

    const safeSub = subdir.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'misc';
    const ext = MIME_EXT[mime.toLowerCase()] ?? 'bin';
    const name = `${randomUUID()}.${ext}`;
    const dir = join(this.root, safeSub);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), buf);
    return { url: `${this.publicBase}/${safeSub}/${name}` };
  }
}
