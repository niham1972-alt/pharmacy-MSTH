import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @Length(1, 200)
  payeeName!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsISO8601()
  incurredDate?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5_000_000)
  receiptUrl?: string; // data-URL or external URL, consistent with GRN/adjustment attachments

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
