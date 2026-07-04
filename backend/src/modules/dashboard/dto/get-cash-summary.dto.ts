import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GetCashSummaryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  cashierId?: string;
}
