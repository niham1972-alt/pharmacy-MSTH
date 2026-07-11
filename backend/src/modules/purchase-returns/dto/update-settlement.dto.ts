import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PurchaseReturnSettlementStatus } from '@prisma/client';

export class UpdateSettlementDto {
  @IsEnum(PurchaseReturnSettlementStatus)
  settlementStatus!: PurchaseReturnSettlementStatus;

  // Required (validated in the service) when transitioning to CREDITED / PARTIALLY_CREDITED.
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCreditedAmount?: number;

  @IsOptional()
  @IsString()
  supplierCreditNoteRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
