import { IsIn, IsOptional, IsUUID } from 'class-validator';

export type AlertType = 'low_stock' | 'expiry' | 'out_of_stock';

export class GetAlertsDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['low_stock', 'expiry', 'out_of_stock'])
  type?: AlertType;
}
