import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const PHONE_RE = /^[+\d][\d\s\-()]{4,24}$/;

export class QuickAddCustomerDto {
  @IsString() @Length(2, 200) name!: string;
  @IsString() @Matches(PHONE_RE, { message: 'Enter a valid phone number.' }) phone!: string;
}

export class CreateCustomerDto {
  @IsString() @Length(2, 200) name!: string;
  @IsString() @Matches(PHONE_RE, { message: 'Enter a valid phone number.' }) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() nationalIdOrPatientId?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsBoolean() consentHealthDataStorage?: boolean;
  @IsOptional() @IsBoolean() consentMarketingContact?: boolean;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() @Matches(PHONE_RE, { message: 'Enter a valid phone number.' }) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() nationalIdOrPatientId?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsBoolean() consentHealthDataStorage?: boolean;
  @IsOptional() @IsBoolean() consentMarketingContact?: boolean;
}

export class UpdateHealthProfileDto {
  @IsOptional() @IsString() @MaxLength(2000) allergiesFreeText?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(80, { each: true }) allergyTags?: string[];
  @IsOptional() @IsString() @MaxLength(2000) chronicConditionsFreeText?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(80, { each: true }) chronicConditionTags?: string[];
}

export class CheckDuplicateDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
}

export class MergeCustomersDto {
  @IsString() survivingId!: string;
  @IsString() mergedAwayId!: string;
}

export class UploadPrescriptionDto {
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() referenceNumber?: string;
  @IsOptional() @IsString() prescribingDoctor?: string;
  @IsOptional() @IsString() issuedDate?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) linkedSaleIds?: string[];
  @IsOptional() @IsString() notes?: string;
}

export class AssignTagDto {
  @IsString() tagId!: string;
}

export class CreateTagDto {
  @IsString() @Length(1, 80) name!: string;
  @IsOptional() @IsString() color?: string;
}

export class AddNoteDto {
  @IsString() @Length(1, 2000) note!: string;
}
