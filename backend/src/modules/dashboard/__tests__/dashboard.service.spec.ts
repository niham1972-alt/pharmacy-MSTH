import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from '../dashboard.service';
import { DashboardRepository } from '../dashboard.repository';
import { DashboardCacheService } from '../cache/dashboard-cache.service';
import { AuditLogService } from '../../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    role: 'admin',
    pharmacyId: 'pharmacy-1',
    branchId: 'branch-1',
    accessibleBranchIds: ['branch-1'],
    ...overrides,
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: jest.Mocked<DashboardRepository>;
  let cache: jest.Mocked<DashboardCacheService>;
  let auditLog: jest.Mocked<AuditLogService>;

  beforeEach(() => {
    repo = {
      getPharmacySettings: jest.fn().mockResolvedValue({ currency: 'USD', timezone: 'UTC', expiryThresholdDays: 90 }),
      getSalesAggregate: jest.fn().mockResolvedValue({ amount: 1000, count: 10 }),
      getProfitAggregate: jest.fn().mockResolvedValue(200),
      getMonthPurchasesTotal: jest.fn().mockResolvedValue(500),
      getMonthExpensesTotal: jest.fn().mockResolvedValue(300),
      getLowStockCount: jest.fn().mockResolvedValue(3),
      getExpiringSoonCount: jest.fn().mockResolvedValue(2),
      getOutOfStockCount: jest.fn().mockResolvedValue(1),
      getPendingPurchaseOrdersCount: jest.fn().mockResolvedValue(4),
      createAcknowledgement: jest.fn().mockResolvedValue(undefined),
      getAcknowledgedReferenceIds: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<DashboardRepository>;

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DashboardCacheService>;

    auditLog = {
      record: jest.fn().mockResolvedValue(undefined),
      findRecent: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<AuditLogService>;

    service = new DashboardService(repo, cache, auditLog);
  });

  describe('role-based field redaction', () => {
    it('omits todayProfit entirely for the cashier role (key absence, not falsy)', async () => {
      const cashier = buildUser({ role: 'cashier' });
      const summary = await service.getSummary(cashier, {});

      expect('todayProfit' in summary).toBe(false);
      expect(repo.getProfitAggregate).not.toHaveBeenCalled();
    });

    it('includes todayProfit for the admin role', async () => {
      const admin = buildUser({ role: 'admin' });
      const summary = await service.getSummary(admin, {});

      expect('todayProfit' in summary).toBe(true);
      expect(summary.todayProfit?.amount).toBe(200);
    });

    it('scopes inventory_manager to stock-focused fields only', async () => {
      const invManager = buildUser({ role: 'inventory_manager' });
      const summary = await service.getSummary(invManager, {});

      expect(summary).toEqual({
        lowStockCount: 3,
        expiringSoonCount: 2,
        outOfStockCount: 1,
        pendingPurchaseOrders: 4,
      });
    });
  });

  describe('branch access enforcement', () => {
    it('throws 403 BRANCH_ACCESS_DENIED when branchId is outside accessibleBranchIds', async () => {
      const user = buildUser({ accessibleBranchIds: ['branch-1'] });

      await expect(service.getSummary(user, { branchId: 'branch-99' })).rejects.toThrow(ForbiddenException);
      await expect(service.getSummary(user, { branchId: 'branch-99' })).rejects.toMatchObject({
        response: { errorCode: 'BRANCH_ACCESS_DENIED' },
      });
    });
  });

  describe('acknowledgeAlert', () => {
    it('writes the acknowledgement and the correct audit log payload', async () => {
      const user = buildUser({ role: 'pharmacist' });

      await service.acknowledgeAlert(user, 'medicine-123', {
        branchId: 'branch-1',
        alertType: 'LOW_STOCK',
        note: 'Reordering tomorrow',
      });

      expect(repo.createAcknowledgement).toHaveBeenCalledWith({
        pharmacyId: 'pharmacy-1',
        branchId: 'branch-1',
        alertType: 'LOW_STOCK',
        referenceId: 'medicine-123',
        acknowledgedBy: 'user-1',
        note: 'Reordering tomorrow',
      });

      expect(auditLog.record).toHaveBeenCalledWith({
        pharmacyId: 'pharmacy-1',
        branchId: 'branch-1',
        userId: 'user-1',
        action: 'ALERT_ACKNOWLEDGED',
        entityType: 'LOW_STOCK',
        entityId: 'medicine-123',
        metadata: { note: 'Reordering tomorrow' },
      });
    });
  });
});
