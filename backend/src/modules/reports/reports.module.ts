import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FinancialReportsService } from './domains/financial-reports.service';
import { InventoryReportsService } from './domains/inventory-reports.service';
import { SalesReportsService } from './domains/sales-reports.service';
import { SupplierReportsService } from './domains/supplier-reports.service';
import { ComplianceReportsService } from './domains/compliance-reports.service';
import { CsvExporterService } from './export/csv-exporter.service';
import { PdfExporterService } from './export/pdf-exporter.service';
import { ExportJobService } from './export/export-job.service';
import { SavedConfigurationsService } from './saved-configurations.service';
import { DailySummaryAggregationJob } from './jobs/daily-summary-aggregation.job';

/**
 * Module 14 — Reports & Analytics. A READ-ONLY aggregation layer over Modules
 * 3–13. Depends on @Global PrismaService, SettingsService (Module 18, report
 * limits + expiry tiers), and AuditLogService (Module 15, export logging). Owns
 * only its config/export-job + pre-aggregation tables.
 */
@Module({
  controllers: [ReportsController],
  providers: [
    ReportsService,
    FinancialReportsService,
    InventoryReportsService,
    SalesReportsService,
    SupplierReportsService,
    ComplianceReportsService,
    CsvExporterService,
    PdfExporterService,
    ExportJobService,
    SavedConfigurationsService,
    DailySummaryAggregationJob,
  ],
})
export class ReportsModule {}
