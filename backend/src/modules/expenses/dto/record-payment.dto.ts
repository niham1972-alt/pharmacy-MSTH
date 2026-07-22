import { IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';

export const EXPENSE_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;

export class RecordExpensePaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsIn(EXPENSE_PAYMENT_METHODS)
  method!: (typeof EXPENSE_PAYMENT_METHODS)[number];

  @IsOptional()
  @IsISO8601()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
