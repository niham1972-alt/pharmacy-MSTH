import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper over Supabase Auth's admin API (service_role key). This module is
 * the source of truth for what a user's JWT claims SHOULD say; here is where it
 * pushes those claims to Supabase Auth (`app_metadata`), so every other module's
 * guard reads the correct role/branch/status directly from the verified JWT with
 * no DB round-trip. Credentials themselves are never handled here — Supabase Auth
 * owns password storage/verification.
 */
@Injectable()
export class SupabaseAdminService {
  constructor(private readonly config: ConfigService) {}

  private base(): { url: string; key: string } {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new BadRequestException({ errorCode: 'AUTH_NOT_CONFIGURED', message: 'Supabase admin API is not configured.' });
    return { url: url.replace(/\/$/, ''), key };
  }

  private headers() {
    const { key } = this.base();
    return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  }

  /** Create (or invite) an auth user. Returns the Supabase auth user id. */
  async createUser(params: { email: string; appMetadata: Record<string, unknown>; password?: string }): Promise<{ authUserId: string; alreadyExisted: boolean }> {
    const { url } = this.base();
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email: params.email, email_confirm: true, app_metadata: params.appMetadata, ...(params.password ? { password: params.password } : {}) }),
    });
    if (res.status === 200 || res.status === 201) return { authUserId: ((await res.json()) as { id: string }).id, alreadyExisted: false };
    // Already exists → look them up so the caller can decide.
    const existing = await this.findByEmail(params.email);
    if (existing) return { authUserId: existing, alreadyExisted: true };
    const body = await res.text();
    throw new BadRequestException({ errorCode: 'INVITE_FAILED', message: `Could not create auth user: ${body}` });
  }

  async findByEmail(email: string): Promise<string | null> {
    const { url } = this.base();
    const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: this.headers() });
    if (!res.ok) return null;
    const j = (await res.json()) as { users?: Array<{ id: string; email: string }> };
    return (j.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  }

  /** Push updated claims (role/branch/status) to Supabase Auth app_metadata. */
  async updateAppMetadata(authUserId: string, appMetadata: Record<string, unknown>): Promise<void> {
    if (authUserId.startsWith('seed-')) return; // demo rows aren't real auth users
    const { url } = this.base();
    const res = await fetch(`${url}/auth/v1/admin/users/${authUserId}`, { method: 'PUT', headers: this.headers(), body: JSON.stringify({ app_metadata: appMetadata }) });
    if (!res.ok) throw new BadRequestException({ errorCode: 'CLAIMS_SYNC_FAILED', message: `Could not sync claims: ${await res.text()}` });
  }

  /** Force logout: invalidates the user's refresh tokens at the Supabase level. */
  async revokeSessions(authUserId: string): Promise<void> {
    if (authUserId.startsWith('seed-')) return;
    const { url } = this.base();
    await fetch(`${url}/auth/v1/admin/users/${authUserId}/logout`, { method: 'POST', headers: this.headers() });
  }

  /** Verify a user's password (step-up re-auth). Returns their auth id + role claim. */
  async verifyPassword(email: string, password: string): Promise<{ authUserId: string; role?: string } | null> {
    const { url, key } = this.base();
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) return null;
    const j = (await res.json()) as { user?: { id: string; app_metadata?: { role?: string } } };
    if (!j.user) return null;
    return { authUserId: j.user.id, role: j.user.app_metadata?.role };
  }
}
