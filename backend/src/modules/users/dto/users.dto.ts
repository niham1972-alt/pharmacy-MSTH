import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER', 'CASHIER', 'ACCOUNTANT', 'AUDITOR'];

export class InviteUserDto {
  @IsString() @Length(2, 200) name!: string;
  @IsEmail() email!: string;
  @IsIn(ROLES) role!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsString() defaultBranchId?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() employeeId?: string;
  // Optional initial password — if set, the user can log in immediately and is
  // created ACTIVE. If omitted, they stay PENDING_ACTIVATION until a password is
  // set (via a Supabase reset link or the set-password action) and they log in.
  @IsOptional() @IsString() @Length(8, 72) password?: string;
}

export class SetPasswordDto {
  @IsString() @Length(8, 72) password!: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() profilePhotoUrl?: string;
}

export class AssignRoleDto {
  @IsIn(ROLES) role!: string;
}

export class GrantBranchAccessDto {
  @IsString() branchId!: string;
  @IsOptional() isDefault?: boolean;
}

export class SuspendDto {
  @IsOptional() @IsString() reason?: string;
}

export class GrantOverrideDto {
  @IsString() permissionKey!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() expiresAt?: string;
}

export class RequestStepUpDto {
  @IsString() actionType!: string;
  @IsString() referenceModule!: string;
  @IsOptional() @IsString() referenceId?: string;
  @IsIn(ROLES) requiredRole!: string;
}

export class VerifyStepUpDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
