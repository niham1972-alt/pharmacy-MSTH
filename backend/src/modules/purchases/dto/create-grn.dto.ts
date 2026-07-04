import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class GrnItemDto {
  /** Present when receiving against a PO line; omit for direct GRN. */
  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

  @IsUUID()
  medicineId!: string;

  @IsInt()
  @Min(1)
  receivedQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  freeQuantity?: number;

  @IsString()
  @Length(1, 50)
  batchNumber!: string;

  @IsDateString()
  expiryDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualUnitCost!: number;

  @IsOptional()
  @IsBoolean()
  expiryOverridden?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  expiryOverrideReason?: string;
}

export class CreateGrnDto {
  /** Present when receiving against a PO; omit for a direct (no-PO) receipt. */
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  /** Required for direct GRN (no PO). */
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items!: GrnItemDto[];

  /** Acknowledge a cost variance beyond the hard-block threshold. */
  @IsOptional()
  @IsBoolean()
  varianceAcknowledged?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  varianceNote?: string;
}

export class SupplierDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;
}
