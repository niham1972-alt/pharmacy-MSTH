import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { BillingStatus, PlatformRole } from '@prisma/client';

export class OnboardTenantDto {
  @IsString() @Length(2, 200) businessName!: string;
  @IsEmail() contactEmail!: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsUUID() subscriptionPlanId?: string;
  /** Optional: email of the first admin user to invite into the new tenant. */
  @IsOptional() @IsEmail() adminEmail?: string;
  @IsOptional() @IsString() @Length(1, 200) adminName?: string;
  @IsOptional() @IsInt() @Min(0) trialDays?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateTenantDto {
  @IsOptional() @IsString() @Length(2, 200) businessName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() notes?: string;
}

export class TenantActionDto {
  @IsOptional() @IsString() @Length(0, 500) reason?: string;
}

export class ChangePlanDto {
  @IsUUID() subscriptionPlanId!: string;
}

export class SubscriptionPlanDto {
  @IsString() @Length(1, 120) name!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) priceAmount!: number;
  @IsString() billingInterval!: string; // MONTHLY | ANNUAL
  @IsOptional() @IsInt() @Min(0) maxUsers?: number;
  @IsOptional() @IsInt() @Min(0) maxBranches?: number;
  @IsOptional() @IsInt() @Min(0) maxMonthlyTransactions?: number;
  @IsOptional() @IsObject() includedFeatures?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StartImpersonationDto {
  @IsUUID() targetPharmacyId!: string;
  @IsUUID() targetUserId!: string;
  @IsString() @Length(10, 500) reason!: string; // min meaningful justification
}

export class AnnouncementDto {
  @IsString() @Length(1, 200) title!: string;
  @IsString() @Length(1, 2000) message!: string;
  @IsOptional() @IsString() severity?: string; // INFO | WARNING | CRITICAL
  @IsOptional() @Type(() => Date) startsAt?: Date;
  @IsOptional() @Type(() => Date) endsAt?: Date;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FeatureFlagDto {
  @IsString() @Length(1, 120) key!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isGloballyEnabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) enabledForPharmacyIds?: string[];
}

export class PlatformStaffDto {
  @IsString() authUserId!: string;
  @IsString() @Length(2, 200) name!: string;
  @IsEmail() email!: string;
  @IsEnum(PlatformRole) role!: PlatformRole;
}

export class UpdatePlatformStaffDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsEnum(PlatformRole) role?: PlatformRole;
  @IsOptional() @IsString() status?: string; // ACTIVE | SUSPENDED
}

export class TenantListQuery {
  @IsOptional() page?: string;
  @IsOptional() limit?: string;
  @IsOptional() search?: string;
  @IsOptional() status?: string;
  @IsOptional() @IsEnum(BillingStatus) billingStatus?: BillingStatus;
  @IsOptional() planId?: string;
  @IsOptional() sortBy?: string;
  @IsOptional() sortOrder?: string;
}
