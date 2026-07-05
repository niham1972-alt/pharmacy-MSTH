import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class QueryInventoryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 25;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() stockStatus?: 'in_stock' | 'low' | 'out';
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';
}

export class SubmitReconciliationDto {
  @IsUUID() medicineId!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsInt() @Min(0) countedQuantity!: number;
  @IsOptional() @IsString() notes?: string;
}

export class TransferItemDto {
  @IsUUID() medicineId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateTransferDto {
  @IsUUID() sourceBranchId!: string;
  @IsUUID() destBranchId!: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TransferItemDto) items!: TransferItemDto[];
}
