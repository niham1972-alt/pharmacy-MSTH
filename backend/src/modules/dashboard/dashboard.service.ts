import { Injectable, NotImplementedException } from '@nestjs/common';
import { DashboardRepository, toNumber } from './dashboard.repository';
import { DashboardCacheService } from './cache/dashboard-cache.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PharmacyRole } from '../../common/interfaces/jwt-payload.interface';
import { GetSummaryDto } from './dto/get-summary.dto';
import { GetSalesTrendDto } from './dto/get-sales-trend.dto';
import { GetTopSellingDto } from './dto/get-top-selling.dto';
import { GetAlertsDto, AlertType } from './dto/get-alerts.dto';
import { AcknowledgeAlertDto } from './dto/acknowledge-alert.dto';
import { GetActivityFeedDto } from './dto/get-activity-feed.dto';
import { GetPurchaseSnapshotDto } from './dto/get-purchase-snapshot.dto';
import { GetCashSummaryDto } from './dto/get-cash-summary.dto';
import { SavePreferencesDto } from './dto/save-preferences.dto';
import { resolveDateRange, calcPercentChange } from './utils/date-range.util';
import { resolveBranchScope } from './utils/branch-access.util';
import { summaryCacheKey, trendCacheKey, topSellingCacheKey, dateRangeKey } from './cache/cache-keys.util';
import { DashboardSummary } from './interfaces/dashboard-summary.interface';
import { SalesTrendPoint, TopSellingItem } from './interfaces/sales-trend-point.interface';
import { DashboardAlert, AlertSeverity, PurchaseSnapshot, CashSummary, ActivityFeedItem } from './interfaces/alert.interface';

const PROFIT_VISIBLE_ROLES: PharmacyRole[] = ['super_admin', 'admin', 'accountant', 'auditor'];

const SUMMARY_FIELDS_BY_ROLE: Record<PharmacyRole, Set<keyof DashboardSummary>> = {
  super_admin: new Set(['todaySales', 'todayProfit', 'monthPurchases', 'monthExpenses', 'lowStockCount', 'expiringSoonCount', 'outOfStockCount', 'pendingPurchaseOrders']),
  admin: new Set(['todaySales', 'todayProfit', 'monthPurchases', 'monthExpenses', 'lowStockCount', 'expiringSoonCount', 'outOfStockCount', 'pendingPurchaseOrders']),
  auditor: new Set(['todaySales', 'todayProfit', 'monthPurchases', 'monthExpenses', 'lowStockCount', 'expiringSoonCount', 'outOfStockCount', 'pendingPurchaseOrders']),
  pharmacist: new Set(['todaySales', 'monthPurchases', 'monthExpenses', 'lowStockCount', 'expiringSoonCount', 'outOfStockCount', 'pendingPurchaseOrders']),
  inventory_manager: new Set(['lowStockCount', 'expiringSoonCount', 'outOfStockCount', 'pendingPurchaseOrders']),
  cashier: new Set(['todaySales']),
  accountant: new Set(['todaySales', 'todayProfit', 'monthPurchases', 'monthExpenses']),
};

const ACTIVITY_FEED_ENTITY_FILTER: Partial<Record<PharmacyRole, string[]>> = {
  pharmacist: ['SALE', 'MEDICINE', 'STOCK', 'RETURN', 'BATCH'],
  inventory_manager: ['STOCK', 'PURCHASE', 'MEDICINE', 'BATCH', 'SUPPLIER'],
  accountant: ['EXPENSE', 'PURCHASE', 'SALE'],
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly cache: DashboardCacheService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getSummary(user: AuthenticatedUser, dto: GetSummaryDto): Promise<Partial<DashboardSummary>> {
    const branchId = resolveBranchScope(user, dto.branchId);
    const settings = await this.repo.getPharmacySettings(user.pharmacyId);
    const range = resolveDateRange(dto.from, dto.to, settings.timezone);
    const fields = SUMMARY_FIELDS_BY_ROLE[user.role];

    const cacheKey = summaryCacheKey(user.pharmacyId, branchId, dateRangeKey(range.from, range.to));
    const cached = await this.cache.get<Partial<DashboardSummary>>(cacheKey);
    if (cached) {
      return this.filterFields(cached, fields);
    }

    const cashierScope = user.role === 'cashier' ? user.userId : undefined;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const summary: Partial<DashboardSummary> = {};

    if (fields.has('todaySales') || fields.has('todayProfit')) {
      const [current, prior] = await Promise.all([
        this.repo.getSalesAggregate(user.pharmacyId, branchId, range.from, range.to, cashierScope),
        this.repo.getSalesAggregate(user.pharmacyId, branchId, range.priorFrom, range.priorTo, cashierScope),
      ]);
      summary.todaySales = {
        amount: current.amount,
        count: current.count,
        changePct: calcPercentChange(current.amount, prior.amount),
      };
    }

    if (fields.has('todayProfit') && PROFIT_VISIBLE_ROLES.includes(user.role)) {
      const [current, prior] = await Promise.all([
        this.repo.getProfitAggregate(user.pharmacyId, branchId, range.from, range.to, cashierScope),
        this.repo.getProfitAggregate(user.pharmacyId, branchId, range.priorFrom, range.priorTo, cashierScope),
      ]);
      summary.todayProfit = { amount: current, changePct: calcPercentChange(current, prior) };
    }

    if (fields.has('monthPurchases')) {
      summary.monthPurchases = { amount: await this.repo.getMonthPurchasesTotal(user.pharmacyId, branchId, monthStart, now) };
    }

    if (fields.has('monthExpenses')) {
      summary.monthExpenses = { amount: await this.repo.getMonthExpensesTotal(user.pharmacyId, branchId, monthStart, now) };
    }

    if (fields.has('lowStockCount')) {
      summary.lowStockCount = await this.repo.getLowStockCount(user.pharmacyId, branchId);
    }

    if (fields.has('expiringSoonCount')) {
      summary.expiringSoonCount = await this.repo.getExpiringSoonCount(user.pharmacyId, branchId, settings.expiryThresholdDays);
    }

    if (fields.has('outOfStockCount')) {
      summary.outOfStockCount = await this.repo.getOutOfStockCount(user.pharmacyId, branchId);
    }

    if (fields.has('pendingPurchaseOrders')) {
      summary.pendingPurchaseOrders = await this.repo.getPendingPurchaseOrdersCount(user.pharmacyId, branchId);
    }

    const isToday = dateRangeKey(range.from, range.to) === dateRangeKey(...this.todayBounds(settings.timezone));
    await this.cache.set(cacheKey, summary, isToday ? 60 : 300);

    return summary;
  }

  async getSalesTrend(user: AuthenticatedUser, dto: GetSalesTrendDto): Promise<SalesTrendPoint[]> {
    const branchId = resolveBranchScope(user, dto.branchId);
    const settings = await this.repo.getPharmacySettings(user.pharmacyId);
    const range = resolveDateRange(dto.from, dto.to, settings.timezone);
    const granularity = dto.granularity ?? 'day';
    const cashierScope = user.role === 'cashier' ? user.userId : undefined;
    const showProfit = PROFIT_VISIBLE_ROLES.includes(user.role);

    const cacheKey = trendCacheKey(user.pharmacyId, branchId, dateRangeKey(range.from, range.to), granularity);
    const cached = await this.cache.get<SalesTrendPoint[]>(cacheKey);
    if (cached) return cached.map((p) => (showProfit ? p : { date: p.date, revenue: p.revenue }));

    const rows = await this.repo.getSalesTrend(user.pharmacyId, branchId, range.from, range.to, granularity, cashierScope);
    const points: SalesTrendPoint[] = rows.map((r) => ({
      date: new Date(r.bucket).toISOString(),
      revenue: toNumber(r.revenue),
      profit: toNumber(r.profit),
    }));

    await this.cache.set(cacheKey, points, 120);
    return showProfit ? points : points.map((p) => ({ date: p.date, revenue: p.revenue }));
  }

  async getTopSelling(user: AuthenticatedUser, dto: GetTopSellingDto): Promise<TopSellingItem[]> {
    const branchId = resolveBranchScope(user, dto.branchId);
    const settings = await this.repo.getPharmacySettings(user.pharmacyId);
    const range = resolveDateRange(dto.from, dto.to, settings.timezone);
    const metric = dto.metric ?? 'revenue';
    const limit = dto.limit ?? 10;

    const cacheKey = topSellingCacheKey(user.pharmacyId, branchId, dateRangeKey(range.from, range.to), metric);
    const cached = await this.cache.get<TopSellingItem[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.repo.getTopSelling(user.pharmacyId, branchId, range.from, range.to, metric, limit);
    const items: TopSellingItem[] = rows.map((r) => ({
      medicineId: r.medicineId,
      name: r.name,
      quantitySold: Number(r.quantitySold),
      revenue: toNumber(r.revenue),
    }));

    await this.cache.set(cacheKey, items, 120);
    return items;
  }

  async getAlerts(user: AuthenticatedUser, dto: GetAlertsDto): Promise<DashboardAlert[]> {
    const branchId = resolveBranchScope(user, dto.branchId);
    const settings = await this.repo.getPharmacySettings(user.pharmacyId);

    const wantType = (t: AlertType): boolean => !dto.type || dto.type === t;
    const alerts: DashboardAlert[] = [];

    if (wantType('out_of_stock')) {
      const acked = await this.repo.getAcknowledgedReferenceIds(user.pharmacyId, branchId, 'OUT_OF_STOCK');
      const items = await this.repo.getOutOfStockMedicines(user.pharmacyId, branchId);
      alerts.push(
        ...items.map((m) => ({
          id: `OUT_OF_STOCK:${m.id}`,
          type: 'OUT_OF_STOCK' as const,
          severity: 'red' as AlertSeverity,
          referenceId: m.id,
          title: m.name,
          detail: 'Out of stock',
          acknowledged: acked.has(m.id),
        })),
      );
    }

    if (wantType('low_stock')) {
      const acked = await this.repo.getAcknowledgedReferenceIds(user.pharmacyId, branchId, 'LOW_STOCK');
      const items = await this.repo.getLowStockMedicines(user.pharmacyId, branchId);
      alerts.push(
        ...items.map((m) => ({
          id: `LOW_STOCK:${m.id}`,
          type: 'LOW_STOCK' as const,
          severity: 'orange' as AlertSeverity,
          referenceId: m.id,
          title: m.name,
          detail: `${m.currentStock} left (reorder at ${m.reorderLevel})`,
          acknowledged: acked.has(m.id),
        })),
      );
    }

    if (wantType('expiry')) {
      const acked = await this.repo.getAcknowledgedReferenceIds(user.pharmacyId, branchId, 'EXPIRY');
      const windowDays = Math.max(settings.expiryThresholdDays, 180);
      const batches = await this.repo.getExpiringBatches(user.pharmacyId, branchId, windowDays);
      const now = Date.now();
      alerts.push(
        ...batches.map((b) => {
          const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - now) / (24 * 60 * 60 * 1000));
          return {
            id: `EXPIRY:${b.id}`,
            type: 'EXPIRY' as const,
            severity: this.expirySeverity(daysLeft),
            referenceId: b.id,
            title: `Batch ${b.batchNumber}`,
            detail: `Expires in ${daysLeft} day(s)`,
            acknowledged: acked.has(b.id),
          };
        }),
      );
    }

    return alerts;
  }

  async acknowledgeAlert(user: AuthenticatedUser, alertId: string, dto: AcknowledgeAlertDto): Promise<void> {
    const branchId = resolveBranchScope(user, dto.branchId);

    await this.repo.createAcknowledgement({
      pharmacyId: user.pharmacyId,
      branchId,
      alertType: dto.alertType,
      referenceId: alertId,
      acknowledgedBy: user.userId,
      note: dto.note,
    });

    await this.auditLog.record({
      pharmacyId: user.pharmacyId,
      branchId,
      userId: user.userId,
      action: 'ALERT_ACKNOWLEDGED',
      entityType: dto.alertType,
      entityId: alertId,
      metadata: { note: dto.note },
    });
  }

  async getActivityFeed(user: AuthenticatedUser, dto: GetActivityFeedDto): Promise<ActivityFeedItem[]> {
    const branchId = dto.branchId ? resolveBranchScope(user, dto.branchId) : undefined;
    const limit = dto.limit ?? 15;

    const records = await this.auditLog.findRecent(user.pharmacyId, branchId, limit * 2, dto.cursor);

    const allowedTypes = ACTIVITY_FEED_ENTITY_FILTER[user.role];
    const filtered = records.filter((r) => {
      if (user.role === 'cashier') return r.userId === user.userId;
      if (!allowedTypes) return true;
      return allowedTypes.some((t) => r.entityType.toUpperCase().includes(t));
    });

    return filtered.slice(0, limit).map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      metadata: r.metadata,
    }));
  }

  async getPurchaseSnapshot(user: AuthenticatedUser, dto: GetPurchaseSnapshotDto): Promise<PurchaseSnapshot> {
    const branchId = resolveBranchScope(user, dto.branchId);
    const orders = await this.repo.getPendingPurchaseOrders(user.pharmacyId, branchId);

    return {
      pendingOrders: orders.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        supplierId: o.supplierId,
        supplierName: o.supplier?.companyName ?? null,
        status: o.status,
        totalAmount: toNumber(o.grandTotal),
        createdAt: o.createdAt.toISOString(),
      })),
      pendingOrdersCount: orders.length,
    };
  }

  async getCashSummary(user: AuthenticatedUser, dto: GetCashSummaryDto): Promise<CashSummary> {
    const branchId = resolveBranchScope(user, dto.branchId);
    const settings = await this.repo.getPharmacySettings(user.pharmacyId);
    const range = resolveDateRange(dto.from, dto.to, settings.timezone);

    const isOwnScope = user.role === 'cashier';
    const cashierId = isOwnScope ? user.userId : dto.cashierId;

    const rows = await this.repo.getCashSummary(user.pharmacyId, branchId, range.from, range.to, cashierId);
    const totalsByMethod: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const amount = toNumber(row._sum.totalAmount);
      totalsByMethod[row.paymentMethod] = amount;
      total += amount;
    }

    return { totalsByMethod, total, scope: isOwnScope ? 'own' : 'all' };
  }

  async getPreferences(user: AuthenticatedUser, branchId?: string): Promise<
    Array<{ widgetKey: string; isVisible: boolean; position: number; config: unknown }>
  > {
    const scopedBranchId = branchId ? resolveBranchScope(user, branchId) : null;
    return this.repo.getWidgetPreferences(user.userId, scopedBranchId);
  }

  async savePreferences(user: AuthenticatedUser, dto: SavePreferencesDto): Promise<void> {
    const branchId = dto.branchId ? resolveBranchScope(user, dto.branchId) : null;

    await Promise.all(
      dto.widgets.map((w) =>
        this.repo.upsertWidgetPreference({
          userId: user.userId,
          pharmacyId: user.pharmacyId,
          branchId,
          widgetKey: w.widgetKey,
          isVisible: w.isVisible,
          position: w.position,
          config: w.config,
        }),
      ),
    );

    await this.auditLog.record({
      pharmacyId: user.pharmacyId,
      branchId: branchId ?? user.branchId,
      userId: user.userId,
      action: 'DASHBOARD_PREFERENCES_UPDATED',
      entityType: 'DASHBOARD_PREFERENCE',
      entityId: user.userId,
      metadata: { widgetKeys: dto.widgets.map((w) => w.widgetKey) },
    });
  }

  exportSnapshot(): { status: string; message: string } {
    // Phase 2 (spec §16): full PDF generation via Puppeteer + Supabase Storage upload.
    throw new NotImplementedException({
      errorCode: 'EXPORT_NOT_IMPLEMENTED',
      message: 'Dashboard PDF export is coming soon (Phase 2)',
    });
  }

  private filterFields<T extends object>(obj: T, allowed: Set<keyof T>): Partial<T> {
    const out: Partial<T> = {};
    for (const key of Object.keys(obj) as Array<keyof T>) {
      if (allowed.has(key)) out[key] = obj[key];
    }
    return out;
  }

  private expirySeverity(daysLeft: number): AlertSeverity {
    if (daysLeft < 30) return 'red';
    if (daysLeft < 90) return 'orange';
    return 'yellow';
  }

  private todayBounds(timezone: string): [Date, Date] {
    const range = resolveDateRange(undefined, undefined, timezone);
    return [range.from, range.to];
  }
}
