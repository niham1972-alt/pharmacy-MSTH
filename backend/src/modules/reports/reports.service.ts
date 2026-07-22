import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SettingsService } from '../settings/settings.service';
import { FinancialReportsService } from './domains/financial-reports.service';
import { InventoryReportsService } from './domains/inventory-reports.service';
import { SalesReportsService } from './domains/sales-reports.service';
import { SupplierReportsService } from './domains/supplier-reports.service';
import { ComplianceReportsService } from './domains/compliance-reports.service';
import { assertReportAccess } from './report-access';
import { resolveRange } from './date-range.util';
import { PnlStatement } from './pnl.util';
import { ReportFilters, ReportType, TabularReport } from './interfaces/report-filters.interface';

/** Reports needing a date range (the rest are point-in-time snapshots). */
const RANGED: ReportType[] = ['PROFIT_LOSS', 'SALES_REGISTER', 'PURCHASE_SUMMARY', 'TAX_SUMMARY', 'STOCK_MOVEMENT', 'TOP_SELLING', 'SALES_RETURNS', 'CUSTOMER_HISTORY', 'CONTROLLED_SUBSTANCE_LOG', 'SUPPLIER_PERFORMANCE', 'PURCHASE_RETURNS', 'SHRINKAGE', 'AUDIT_SUMMARY'];

export const REPORT_TITLES: Record<ReportType, string> = {
  PROFIT_LOSS: 'Profit & Loss Statement', SALES_REGISTER: 'Sales Register', PURCHASE_SUMMARY: 'Purchase Summary',
  ACCOUNTS_PAYABLE: 'Accounts Payable Summary', TAX_SUMMARY: 'Tax / VAT Summary', STOCK_VALUATION: 'Stock Valuation Report',
  STOCK_MOVEMENT: 'Stock Movement Report', EXPIRING_STOCK: 'Expiring Stock Report', BATCH_TRACEABILITY: 'Batch Traceability Report',
  TOP_SELLING: 'Top-Selling Medicines', SALES_RETURNS: 'Sales Returns Report', CUSTOMER_HISTORY: 'Customer Purchase History',
  CONTROLLED_SUBSTANCE_LOG: 'Controlled Substance Dispensing Log', SUPPLIER_PERFORMANCE: 'Supplier Performance Report',
  PURCHASE_RETURNS: 'Purchase Returns Report', SHRINKAGE: 'Shrinkage / Loss Report', AUDIT_SUMMARY: 'Audit Summary Report',
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly financial: FinancialReportsService,
    private readonly inventory: InventoryReportsService,
    private readonly sales: SalesReportsService,
    private readonly supplier: SupplierReportsService,
    private readonly compliance: ComplianceReportsService,
  ) {}

  private async maxRangeDays(pharmacyId: string, forExport: boolean): Promise<number> {
    const key = forExport ? 'reports.maxExportRangeDays' : 'reports.maxSyncRangeDays';
    return Number((await this.settings.get<number>(key, { pharmacyId })) ?? (forExport ? 1100 : 366));
  }

  /** The rich, native result for the API (P&L → statement object, others → TabularReport). */
  async run(user: AuthenticatedUser, reportType: ReportType, filters: ReportFilters, opts: { forExport?: boolean } = {}): Promise<PnlStatement & { dateFrom: string; dateTo: string } | TabularReport> {
    assertReportAccess(user.role, reportType);
    const range = RANGED.includes(reportType)
      ? resolveRange(filters, { maxRangeDays: await this.maxRangeDays(user.pharmacyId, !!opts.forExport) })
      : null;

    switch (reportType) {
      case 'PROFIT_LOSS': return this.financial.profitLoss(user, range!, filters.branchId);
      case 'TAX_SUMMARY': return this.financial.taxSummary(user, range!, filters.branchId);
      case 'ACCOUNTS_PAYABLE': return this.financial.accountsPayable(user, filters.branchId);
      case 'SALES_REGISTER': return this.sales.salesRegister(user, range!, filters);
      case 'TOP_SELLING': return this.sales.topSelling(user, range!, filters);
      case 'SALES_RETURNS': return this.sales.salesReturns(user, range!, filters);
      case 'CUSTOMER_HISTORY':
        if (!filters.customerId) throw new BadRequestException({ errorCode: 'CUSTOMER_REQUIRED', message: 'A customerId is required.' });
        return this.sales.customerHistory(user, filters.customerId, range!);
      case 'STOCK_VALUATION': return this.inventory.stockValuation(user, filters.branchId);
      case 'STOCK_MOVEMENT': return this.inventory.stockMovement(user, range!, filters);
      case 'EXPIRING_STOCK': return this.inventory.expiringStock(user, filters.branchId);
      case 'BATCH_TRACEABILITY':
        if (!filters.batchId) throw new BadRequestException({ errorCode: 'BATCH_REQUIRED', message: 'A batchId is required.' });
        return this.inventory.batchTraceability(user, filters.batchId);
      case 'PURCHASE_SUMMARY': return this.supplier.purchaseSummary(user, range!, filters.branchId);
      case 'SUPPLIER_PERFORMANCE': return this.supplier.supplierPerformance(user, range!, filters.branchId);
      case 'PURCHASE_RETURNS': return this.supplier.purchaseReturns(user, range!, filters.branchId);
      case 'SHRINKAGE': return this.compliance.shrinkage(user, range!, filters);
      case 'CONTROLLED_SUBSTANCE_LOG': return this.compliance.controlledSubstanceLog(user, range!);
      case 'AUDIT_SUMMARY': return this.compliance.auditSummary(user, range!);
      default: throw new BadRequestException({ errorCode: 'UNKNOWN_REPORT', message: `Unknown report type "${reportType}".` });
    }
  }

  /** Always a TabularReport — used by the export layer (P&L projected to statement rows). */
  async runTabular(user: AuthenticatedUser, reportType: ReportType, filters: ReportFilters): Promise<TabularReport> {
    const result = await this.run(user, reportType, filters, { forExport: true });
    if (reportType === 'PROFIT_LOSS') return this.pnlToTabular(result as PnlStatement & { dateFrom: string; dateTo: string });
    return result as TabularReport;
  }

  private pnlToTabular(p: PnlStatement & { dateFrom: string; dateTo: string }): TabularReport {
    const rows: Array<Record<string, string | number | null>> = [
      { line: 'Gross revenue', amount: p.grossRevenue },
      { line: 'Less: returns', amount: -p.returnsAmount },
      { line: 'Net revenue', amount: p.netRevenue },
      { line: 'Less: cost of goods sold', amount: -p.costOfGoodsSold },
      { line: 'Gross profit', amount: p.grossProfit },
      ...p.expensesByCategory.map((c) => ({ line: `Expense — ${c.categoryName}`, amount: -c.amount })),
      { line: 'Total operating expenses', amount: -p.totalOperatingExpenses },
      { line: 'NET PROFIT', amount: p.netProfit },
    ];
    return {
      columns: [{ key: 'line', label: 'Line item' }, { key: 'amount', label: 'Amount', numeric: true }],
      rows,
      summary: { netProfit: p.netProfit, grossMarginPercent: p.grossMarginPercent, netMarginPercent: p.netMarginPercent, pendingExpenses: p.pendingExpensesAmount },
      meta: { dateFrom: p.dateFrom, dateTo: p.dateTo },
    };
  }
}
