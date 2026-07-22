import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ExportFormat, ReportType } from '../interfaces/report-filters.interface';

const REPORT_TYPES: ReportType[] = [
  'PROFIT_LOSS', 'SALES_REGISTER', 'PURCHASE_SUMMARY', 'ACCOUNTS_PAYABLE', 'TAX_SUMMARY', 'STOCK_VALUATION',
  'STOCK_MOVEMENT', 'EXPIRING_STOCK', 'BATCH_TRACEABILITY', 'TOP_SELLING', 'SALES_RETURNS', 'CUSTOMER_HISTORY',
  'CONTROLLED_SUBSTANCE_LOG', 'SUPPLIER_PERFORMANCE', 'PURCHASE_RETURNS', 'SHRINKAGE', 'AUDIT_SUMMARY',
];

export class ExportRequestDto {
  @IsIn(REPORT_TYPES)
  reportType!: ReportType;

  @IsIn(['CSV', 'PDF'])
  format!: ExportFormat;

  @IsOptional()
  @IsObject()
  filters?: Record<string, string>;
}

export class SaveConfigDto {
  @IsIn(REPORT_TYPES)
  reportType!: ReportType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, string>;
}
