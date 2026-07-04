import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Payload to create a Medicine. `sku` is auto-generated (`MED-{seq}`) when
 * omitted. Monetary fields are validated as numbers with ≤2 decimals and
 * persisted into Prisma `Decimal` columns.
 */
export class CreateMedicineDto {
  @IsString()
  @Length(2, 200)
  genericName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  brandName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  sku?: string;

  @IsUUID()
  manufacturerId!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @IsUUID()
  dosageFormId!: string;

  @IsUUID()
  baseUnitId!: string;

  @IsUUID()
  purchaseUnitId!: string;

  @IsUUID()
  saleUnitId!: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  strength?: string;

  @IsOptional()
  @IsString()
  routeOfAdministration?: string;

  @IsOptional()
  @IsString()
  therapeuticClass?: string;

  @IsOptional()
  @IsString()
  storageCondition?: string;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsString()
  controlledSubstanceSchedule?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRatePercent?: number;

  @IsOptional()
  @IsBoolean()
  taxInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  discountEligible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStockLevel?: number;

  /** TRANSITIONAL — accepted so seed/imports can set an opening balance until
   * Inventory (Module 5) owns live stock. */
  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsBoolean()
  isGlobalAcrossBranches?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  /** Optional barcodes assigned inline at creation (first is primary). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  barcodes?: string[];

  /** Explicit confirmations required to bypass soft business-rule blocks. */
  @IsOptional()
  @IsBoolean()
  confirmNegativeMargin?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}

/** All fields optional for PATCH-style updates (manual PartialType). */
export class UpdateMedicineDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  genericName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  brandName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  sku?: string;

  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @IsOptional()
  @IsUUID()
  dosageFormId?: string;

  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

  @IsOptional()
  @IsUUID()
  purchaseUnitId?: string;

  @IsOptional()
  @IsUUID()
  saleUnitId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  strength?: string;

  @IsOptional()
  @IsString()
  routeOfAdministration?: string;

  @IsOptional()
  @IsString()
  therapeuticClass?: string;

  @IsOptional()
  @IsString()
  storageCondition?: string;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsString()
  controlledSubstanceSchedule?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRatePercent?: number;

  @IsOptional()
  @IsBoolean()
  taxInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  discountEligible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStockLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsBoolean()
  confirmNegativeMargin?: boolean;

  /** Optimistic-lock guard: the `updatedAt` the client last saw (spec §21). */
  @IsOptional()
  @Type(() => Date)
  expectedUpdatedAt?: Date;

  @IsOptional()
  @IsString()
  priceChangeReason?: string;
}
