import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { AdjustmentDirection, AdjustmentReasonCode } from '@prisma/client';

export class CreateAdjustmentDto {
  @IsUUID()
  medicineId!: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsEnum(AdjustmentDirection)
  direction!: AdjustmentDirection;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(AdjustmentReasonCode)
  reasonCode!: AdjustmentReasonCode;

  /** Required when reasonCode is OTHER (enforced in the service). */
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  reasonNote?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5_000_000)
  evidenceUrl?: string; // data-URL or external URL, consistent with GRN attachments

  /** Pre-links this adjustment to a Module 5 StockReconciliation record. */
  @IsOptional()
  @IsUUID()
  linkedReconciliationId?: string;
}

export class BulkCreateAdjustmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateAdjustmentDto)
  items!: CreateAdjustmentDto[];
}

export class RejectAdjustmentDto {
  @IsString()
  @Length(3, 500)
  rejectedReason!: string;
}

export class QueryAdjustmentsDto {
  @IsOptional() page?: string;
  @IsOptional() limit?: string;
  @IsOptional() search?: string;
  @IsOptional() @IsUUID() medicineId?: string;
  @IsOptional() @IsEnum(AdjustmentReasonCode) reasonCode?: AdjustmentReasonCode;
  @IsOptional() @IsEnum(AdjustmentDirection) direction?: AdjustmentDirection;
  @IsOptional() status?: string;
  @IsOptional() dateFrom?: string;
  @IsOptional() dateTo?: string;
  @IsOptional() branchId?: string;
  @IsOptional() sortBy?: string;
  @IsOptional() sortOrder?: string;
}
