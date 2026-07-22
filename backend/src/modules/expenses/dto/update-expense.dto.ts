import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length } from 'class-validator';

/** Pre-approval edits only (spec §7). All fields optional (partial update). */
export class UpdateExpenseDto {
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
  amount?: number;

  @IsOptional()
  @IsISO8601()
  incurredDate?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5_000_000)
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
