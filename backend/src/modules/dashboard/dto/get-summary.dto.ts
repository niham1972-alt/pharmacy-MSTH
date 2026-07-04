import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GetSummaryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
