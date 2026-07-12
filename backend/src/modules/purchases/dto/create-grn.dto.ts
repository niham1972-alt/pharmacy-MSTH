import { Type } from 'class-transformer';
import { TaxDiscountMode } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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

  /** Extra loose base-units received on top of the full packs. */
  @IsOptional()
  @IsInt()
  @Min(0)
  looseUnitQuantity?: number;

  /** Bonus / free packs (not billed). */
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

  /** Where this batch is shelved. */
  @IsOptional()
  @IsUUID()
  rackId?: string;

  // --- Per-line adjustments (mode = how to read the value) ------------------
  @IsOptional()
  @IsEnum(TaxDiscountMode)
  discountMode?: TaxDiscountMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsEnum(TaxDiscountMode)
  salesTaxMode?: TaxDiscountMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salesTaxValue?: number;

  @IsOptional()
  @IsEnum(TaxDiscountMode)
  advanceTaxMode?: TaxDiscountMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  advanceTaxValue?: number;

  @IsOptional()
  @IsBoolean()
  expiryOverridden?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  expiryOverrideReason?: string;
}

export class GrnAttachmentDto {
  /** Data-URL (base64) or external URL of the uploaded file. */
  @IsString()
  @Length(1, 5_000_000)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  fileType?: string; // INVOICE | QUOTATION | OTHER

  @IsOptional()
  @IsString()
  @Length(0, 260)
  fileName?: string;
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

  /** Receipt date (defaults to now). */
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  supplierInvoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  supplierInvoiceDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnAttachmentDto)
  attachments?: GrnAttachmentDto[];

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items!: GrnItemDto[];

  // --- Invoice-level (bulk) adjustments, applied after summing line nets -----
  @IsOptional()
  @IsEnum(TaxDiscountMode)
  invoiceDiscountMode?: TaxDiscountMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  invoiceDiscountValue?: number;

  @IsOptional()
  @IsEnum(TaxDiscountMode)
  invoiceSalesTaxMode?: TaxDiscountMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  invoiceSalesTaxValue?: number;

  @IsOptional()
  @IsEnum(TaxDiscountMode)
  invoiceAdvanceTaxMode?: TaxDiscountMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  invoiceAdvanceTaxValue?: number;

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
  @IsString()
  paymentTermsCode?: string;

  @IsOptional()
  @IsString()
  supplierType?: string;
}
