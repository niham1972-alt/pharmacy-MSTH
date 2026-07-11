import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RefundMethod, ReturnReasonCode } from '@prisma/client';

export class ListReturnsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string; // return number or original sale number

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  cashierId?: string;

  @IsOptional()
  @IsEnum(ReturnReasonCode)
  reasonCode?: ReturnReasonCode;

  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
