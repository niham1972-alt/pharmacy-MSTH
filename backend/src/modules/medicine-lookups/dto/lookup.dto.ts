import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CategoryDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ManufacturerDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsObject()
  contactInfo?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DosageFormDto {
  @IsString()
  @Length(1, 120)
  name!: string;
}

export class UnitDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  symbol?: string;
}

export class RackDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
