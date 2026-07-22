import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { ExpenseRecurrenceFrequency } from '@prisma/client';

export class CreateTemplateDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @Length(1, 200)
  payeeName!: string;

  /** Nullable if the amount varies each period (e.g. utilities) — reminder-only. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  defaultAmount?: number;

  @IsEnum(ExpenseRecurrenceFrequency)
  recurrenceFrequency!: ExpenseRecurrenceFrequency;

  /** 1–28 keeps monthly generation month-length-safe; higher days are clamped to
   *  the last day of the month (spec §10 / §21). */
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfPeriod!: number;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  payeeName?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  defaultAmount?: number;

  @IsOptional()
  @IsEnum(ExpenseRecurrenceFrequency)
  recurrenceFrequency?: ExpenseRecurrenceFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfPeriod?: number;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
