import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CheckDuplicateDto {
  @IsString()
  genericName!: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsString()
  manufacturerId!: string;

  @IsString()
  dosageFormId!: string;
}

export class ChangeStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'DISCONTINUED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

export class AddBarcodeDto {
  @IsString()
  @Length(1, 64)
  barcode!: string;

  @IsOptional()
  isPrimary?: boolean;
}
