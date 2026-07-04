import { IsOptional, IsUUID } from 'class-validator';

export class GetPurchaseSnapshotDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
