import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ExpenseApprovalStatus, ExpensePaymentStatus } from '@prisma/client';

export class QueryExpensesDto {
  @IsOptional() page?: string;
  @IsOptional() limit?: string;
  @IsOptional() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(ExpensePaymentStatus) paymentStatus?: ExpensePaymentStatus;
  @IsOptional() @IsEnum(ExpenseApprovalStatus) approvalStatus?: ExpenseApprovalStatus;
  /** "true" → only auto-generated recurring instances; "false" → only one-offs. */
  @IsOptional() @IsBooleanString() isRecurringGenerated?: string;
  @IsOptional() dateFrom?: string;
  @IsOptional() dateTo?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() sortBy?: string;
  @IsOptional() sortOrder?: string;
}
