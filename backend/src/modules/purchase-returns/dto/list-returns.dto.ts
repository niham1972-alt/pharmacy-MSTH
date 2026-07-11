import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PurchaseReturnReasonCode, PurchaseReturnSettlementStatus } from '@prisma/client';

export class ListPurchaseReturnsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string; // return number or GRN number
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsEnum(PurchaseReturnSettlementStatus) settlementStatus?: PurchaseReturnSettlementStatus;
  @IsOptional() @IsEnum(PurchaseReturnReasonCode) reasonCode?: PurchaseReturnReasonCode;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';
}
