import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryBatchesDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() medicineId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsIn(['FRESH', 'EXPIRING_SOON', 'EXPIRED', 'DEPLETED', 'RECALLED']) status?: string;
  @IsOptional() @IsString() expiryFrom?: string;
  @IsOptional() @IsString() expiryTo?: string;
  @IsOptional() @IsIn(['expiryDate', 'createdAt', 'currentQuantity']) sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: string;
}

class WriteOffLineDto {
  @IsString() batchId!: string;
  @IsInt() @Min(1) quantity!: number;
}

const DISPOSAL_METHODS = ['RETURNED_TO_SUPPLIER', 'DESTROYED_ONSITE', 'THIRD_PARTY_DISPOSAL', 'OTHER'];

export class WriteOffBatchDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => WriteOffLineDto) batches!: WriteOffLineDto[];
  @IsIn(DISPOSAL_METHODS) disposalMethod!: string;
  @IsOptional() @IsString() disposalReference?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() branchId?: string;
}

export class FlagRecallDto {
  @IsString() @MinLength(10, { message: 'Recall reason must be at least 10 characters.' }) reason!: string;
  @IsOptional() @IsString() sourceReference?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ResolveRecallDto {
  @IsIn(['RETURNED_TO_SUPPLIER', 'DESTROYED', 'RESOLVED_OTHER']) resolutionStatus!: string;
  @IsOptional() @IsString() notes?: string;
}
