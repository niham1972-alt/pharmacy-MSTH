import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class WidgetPreferenceItemDto {
  @IsString()
  widgetKey!: string;

  @IsBoolean()
  isVisible!: boolean;

  @IsInt()
  position!: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class SavePreferencesDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetPreferenceItemDto)
  widgets!: WidgetPreferenceItemDto[];
}
