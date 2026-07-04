import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export type TrendGranularity = 'day' | 'week' | 'month';

export class GetSalesTrendDto {
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
  @IsIn(['day', 'week', 'month'])
  granularity?: TrendGranularity = 'day';
}
