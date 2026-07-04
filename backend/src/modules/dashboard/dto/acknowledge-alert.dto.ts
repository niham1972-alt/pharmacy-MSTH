import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AcknowledgeAlertDto {
  @IsUUID()
  branchId!: string;

  @IsIn(['LOW_STOCK', 'EXPIRY', 'OUT_OF_STOCK'])
  alertType!: 'LOW_STOCK' | 'EXPIRY' | 'OUT_OF_STOCK';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
