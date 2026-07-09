import { Allow, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  // Value type is validated in the service against the setting's definition, so
  // accept it as-is here (@Allow keeps it past the whitelisting ValidationPipe).
  @Allow()
  value!: unknown;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class ResetSettingDto {
  @IsOptional()
  @IsString()
  branchId?: string;
}
