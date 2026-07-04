import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export type StockStatus = 'in_stock' | 'low' | 'out';
export const SORTABLE = ['name', 'price', 'stock', 'createdAt', 'updatedAt'] as const;
export type MedicineSortBy = (typeof SORTABLE)[number];

export class QueryMedicinesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @IsOptional()
  @IsUUID()
  dosageFormId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'DISCONTINUED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

  @IsOptional()
  @IsBooleanString()
  prescriptionRequired?: string;

  @IsOptional()
  @IsIn(['in_stock', 'low', 'out'])
  stockStatus?: StockStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsIn([...SORTABLE])
  sortBy?: MedicineSortBy = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class SearchMedicinesDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
