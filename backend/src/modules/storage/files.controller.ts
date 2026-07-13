import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ControllerResult } from '../../common/interceptors/response-envelope.interceptor';
import { StorageService } from './storage.service';

class UploadDto {
  @IsString()
  @Length(1, 8_000_000) // ~6MB base64 upper bound; service enforces the byte cap
  dataUrl!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  folder?: string; // e.g. 'grn', 'adjustments', 'evidence'
}

/**
 * Generic authenticated file upload → persisted to the VPS uploads volume.
 * The frontend can POST a data-URL here and store the returned `/uploads/…` URL
 * on a record (GRN attachment, adjustment evidence, etc.) instead of embedding
 * the base64 in the database.
 */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  async upload(@Body() dto: UploadDto): Promise<ControllerResult<unknown>> {
    return { data: await this.storage.saveDataUrl(dto.dataUrl, dto.folder ?? 'misc'), message: 'File stored' };
  }
}
