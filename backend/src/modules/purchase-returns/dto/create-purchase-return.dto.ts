import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { PurchaseReturnReasonCode } from '@prisma/client';

/** One line being returned to the supplier — references the original GRN item. */
export class PurchaseReturnLineDto {
  @IsUUID()
  originalGrnItemId!: string;

  @IsInt()
  @Min(1)
  quantityReturned!: number;

  @IsEnum(PurchaseReturnReasonCode)
  reasonCode!: PurchaseReturnReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;

  /** Only meaningful when reasonCode = QUALITY_RECALL — links to Module 6's BatchRecall. */
  @IsOptional()
  @IsUUID()
  relatedRecallId?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class CreatePurchaseReturnDto {
  @IsUUID()
  originalGrnId!: string;

  /** Optional override of the auto-computed expected credit (unitCost × qty summed)
   *  — real supplier agreements (e.g. near-expiry rates) can differ. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedCreditAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineDto)
  items!: PurchaseReturnLineDto[];
}
