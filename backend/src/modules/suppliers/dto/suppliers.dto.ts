import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_TERM_CODES } from '../payment-terms';

const SUPPLIER_TYPES = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'LOCAL_VENDOR'];
const ADDRESS_TYPES = ['BILLING', 'WAREHOUSE', 'OTHER'];
const DOCUMENT_TYPES = ['DRUG_LICENSE', 'TAX_CERTIFICATE', 'BUSINESS_REGISTRATION', 'CONTRACT', 'OTHER'];

export class AddContactDto {
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class AddAddressDto {
  @IsIn(ADDRESS_TYPES) type!: string;
  @IsString() @Length(1, 300) addressLine1!: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
}

export class CreateSupplierDto {
  @IsString() @Length(2, 200) companyName!: string;
  @IsOptional() @IsString() tradingName?: string;
  @IsIn(SUPPLIER_TYPES) supplierType!: string;
  @IsOptional() @IsString() taxRegistrationNumber?: string;
  @IsOptional() @IsString() drugLicenseNumber?: string;
  @IsOptional() @IsString() drugLicenseExpiry?: string;
  @IsIn(PAYMENT_TERM_CODES) paymentTermsCode!: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsObject() bankAccountDetails?: Record<string, unknown>;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AddContactDto) contacts?: AddContactDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AddAddressDto) addresses?: AddAddressDto[];
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @Length(2, 200) companyName?: string;
  @IsOptional() @IsString() tradingName?: string;
  @IsOptional() @IsIn(SUPPLIER_TYPES) supplierType?: string;
  @IsOptional() @IsString() taxRegistrationNumber?: string;
  @IsOptional() @IsString() drugLicenseNumber?: string;
  @IsOptional() @IsString() drugLicenseExpiry?: string;
  @IsOptional() @IsIn(PAYMENT_TERM_CODES) paymentTermsCode?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsObject() bankAccountDetails?: Record<string, unknown>;
  @IsOptional() @IsString() notes?: string;
}

export class QuerySuppliersDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(SUPPLIER_TYPES) supplierType?: string;
  @IsOptional() @IsString() isActive?: string;
  @IsOptional() @IsString() hasOutstandingPayables?: string;
  @IsOptional() @IsIn(['valid', 'expiring', 'expired']) licenseStatus?: string;
  @IsOptional() @IsIn(['companyName', 'totalSpend', 'outstanding']) sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: string;
}

export class UploadDocumentDto {
  @IsIn(DOCUMENT_TYPES) documentType!: string;
  @IsString() fileUrl!: string;
  @IsOptional() @IsString() expiryDate?: string;
}

export class SetNegotiatedPriceDto {
  @IsString() medicineId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) negotiatedCost!: number;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() effectiveTo?: string;
}

export class SetPreferredSupplierDto {
  @IsString() medicineId!: string;
  @IsString() supplierId!: string;
  @IsOptional() @IsInt() @Min(1) priority?: number;
}
