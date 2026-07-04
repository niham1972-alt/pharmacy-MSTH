import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaleItemInputDto {
  @IsUUID()
  medicineId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  /** Optional line price override (requires elevated role — audit-logged). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  /** Pharmacist/admin userId who verified a prescription-required line. */
  @IsOptional()
  @IsString()
  prescriptionVerifiedBy?: string;

  @IsOptional()
  @IsString()
  prescriptionReference?: string;

  /** Manual batch override (pharmacist/admin only) — otherwise FEFO decides. */
  @IsOptional()
  @IsUUID()
  batchId?: string;
}

export class SalePaymentInputDto {
  @IsIn(['CASH', 'CARD', 'MOBILE', 'WALLET', 'INSURANCE'])
  method!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  tenderedAmount?: number;
}

export class ComplianceInputDto {
  @IsUUID()
  medicineId!: string;

  @IsIn(['PRESCRIPTION', 'CONTROLLED_SUBSTANCE'])
  type!: string;

  @IsOptional()
  @IsString()
  prescribingDoctor?: string;

  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  patientIdNumber?: string;

  @IsInt()
  @Min(1)
  quantityDispensed!: number;
}

export class FinalizeSaleDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsUUID()
  cashierSessionId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  /** Elevated approver userId when total discount exceeds the auto-allowed cap. */
  @IsOptional()
  @IsString()
  discountApprovedBy?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  payments!: SalePaymentInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComplianceInputDto)
  compliance?: ComplianceInputDto[];
}

export class PriceCheckDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];
}

export class OpenSessionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingFloat!: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CloseSessionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualCash!: number;
}

export class ParkSaleDto {
  @IsOptional()
  @IsString()
  @Length(0, 120)
  label?: string;

  cartSnapshot!: unknown;
}

export class VoidSaleDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class DiscountApprovalDto {
  @IsString()
  approverEmail!: string;

  @IsString()
  approverPassword!: string;
}
