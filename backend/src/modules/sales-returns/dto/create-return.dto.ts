import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ConditionAssessment, RefundMethod, ReturnReasonCode } from '@prisma/client';

/** One line being returned — references the original SaleItem it reverses. */
export class ReturnLineItemDto {
  @IsUUID()
  originalSaleItemId!: string;

  @IsInt()
  @Min(1)
  quantityReturned!: number;

  @IsEnum(ConditionAssessment)
  conditionAssessment!: ConditionAssessment;

  @IsEnum(ReturnReasonCode)
  reasonCode!: ReturnReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;

  @IsOptional()
  @IsString()
  conditionPhotoUrl?: string;
}

export class CreateReturnDto {
  @IsUUID()
  originalSaleId!: string;

  @IsEnum(RefundMethod)
  refundMethod!: RefundMethod;

  @IsOptional()
  @IsString()
  refundReference?: string;

  /** Linked replacement sale id when refundMethod = EXCHANGE (created separately at POS). */
  @IsOptional()
  @IsUUID()
  exchangeSaleId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * An APPROVED StepUpVerification id (actionType RETURN_APPROVAL) — required when
   * a cashier processes a return that needs pharmacist/admin sign-off. Ignored when
   * the processor is already an elevated role (they ARE the approver).
   */
  @IsOptional()
  @IsUUID()
  stepUpId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineItemDto)
  items!: ReturnLineItemDto[];
}
