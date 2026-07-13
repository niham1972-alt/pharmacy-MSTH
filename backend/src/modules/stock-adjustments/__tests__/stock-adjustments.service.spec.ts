import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StockAdjustmentsService } from '../stock-adjustments.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = { userId: 'user-1', role: 'admin', pharmacyId: 'ph-1', branchId: 'br-1', accessibleBranchIds: ['br-1'] };
const otherUser: AuthenticatedUser = { ...user, userId: 'user-2' };

function makeService(overrides: { adj?: unknown } = {}) {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const repo = { findById: jest.fn().mockResolvedValue(overrides.adj ?? null) };
  const inventoryAdjust = { execute: jest.fn().mockResolvedValue(undefined) };
  const events = { created: jest.fn(), approved: jest.fn(), rejected: jest.fn() };
  const stockAdjustment = { update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'adj-1', adjustmentNumber: 'ADJ-2026-000001', medicineId: 'm1', quantity: 50, direction: 'DECREASE', unitCostAtRequest: 0, requestedAt: new Date(), approvedAt: new Date(), reasonCode: 'THEFT_LOSS_SUSPECTED', status: data.status, ...data })) };
  const prisma = { stockAdjustment };
  const service = new StockAdjustmentsService(prisma as never, repo as never, inventoryAdjust as never, {} as never, events as never, audit as never);
  return { service, audit, repo, inventoryAdjust, events, stockAdjustment };
}

const pendingAdj = { id: 'adj-1', pharmacyId: 'ph-1', branchId: 'br-1', adjustmentNumber: 'ADJ-2026-000001', status: 'PENDING_APPROVAL', requestedBy: 'user-1', medicineId: 'm1', quantity: 50, direction: 'DECREASE' };

describe('StockAdjustmentsService approval', () => {
  it('BLOCKS self-approval even for a valid admin, and logs the blocked attempt', async () => {
    const { service, audit, inventoryAdjust } = makeService({ adj: pendingAdj });
    await expect(service.approve(user, 'adj-1')).rejects.toBeInstanceOf(ForbiddenException); // user-1 == requestedBy
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'SELF_APPROVAL_ATTEMPT_BLOCKED' }));
    expect(inventoryAdjust.execute).not.toHaveBeenCalled(); // no stock effect
  });

  it('rejects approval of a non-pending adjustment', async () => {
    const { service } = makeService({ adj: { ...pendingAdj, status: 'AUTO_APPROVED' } });
    await expect(service.approve(otherUser, 'adj-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reject sets REJECTED with a reason and performs NO stock effect', async () => {
    const { service, inventoryAdjust, stockAdjustment, audit } = makeService({ adj: pendingAdj });
    const res = await service.reject(otherUser, 'adj-1', 'Needs a documented recount');
    expect(stockAdjustment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', rejectedReason: 'Needs a documented recount' }) }));
    expect(inventoryAdjust.execute).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADJUSTMENT_REJECTED' }));
    expect(res.status).toBe('REJECTED');
  });
});
