import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InventoryService } from './inventory.service';
import { InventoryEventsEmitter } from './events/inventory-events.emitter';
import { CreateTransferDto } from './dto/inventory.dto';

/**
 * Inter-branch transfers. Stock only actually moves at the RECEIVE step — as a
 * single atomic transaction (OUT at source, IN at destination) — so a
 * PENDING/IN_TRANSIT transfer is documented intent, not yet-moved stock
 * (spec §11). Multi-branch workflow polish is Phase 2, but the flow is real.
 */
@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditLogService,
    private readonly events: InventoryEventsEmitter,
  ) {}

  private assertBranch(user: AuthenticatedUser, branchId: string) {
    if (!user.accessibleBranchIds.includes(branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to branch ${branchId}` });
  }

  async create(user: AuthenticatedUser, dto: CreateTransferDto) {
    if (dto.sourceBranchId === dto.destBranchId) throw new BadRequestException({ errorCode: 'SAME_BRANCH', message: 'Source and destination branches must differ.' });
    this.assertBranch(user, dto.sourceBranchId);
    // Validate source stock at creation (re-validated again at receive).
    for (const it of dto.items) {
      const ok = await this.inventory.checkSufficientStock({ pharmacyId: user.pharmacyId, branchId: dto.sourceBranchId, medicineId: it.medicineId, requiredQuantity: it.quantity });
      if (!ok) throw new BadRequestException({ errorCode: 'INSUFFICIENT_STOCK', message: `Insufficient stock at source for medicine ${it.medicineId}.` });
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      const transferNumber = await this.nextNumber(tx, user.pharmacyId);
      return tx.stockTransfer.create({
        data: { pharmacyId: user.pharmacyId, transferNumber, sourceBranchId: dto.sourceBranchId, destBranchId: dto.destBranchId, initiatedBy: user.userId, notes: dto.notes, items: { create: dto.items.map((i) => ({ medicineId: i.medicineId, quantity: i.quantity })) } },
        include: { items: true },
      });
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: dto.sourceBranchId, userId: user.userId, action: 'TRANSFER_CREATED', entityType: 'STOCK_TRANSFER', entityId: transfer.id, metadata: { transferNumber: transfer.transferNumber, items: transfer.items.length } });
    return this.serialize(transfer);
  }

  async approve(user: AuthenticatedUser, id: string) {
    const t = await this.prisma.stockTransfer.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!t) throw new NotFoundException({ errorCode: 'TRANSFER_NOT_FOUND', message: 'Transfer not found' });
    if (t.status !== 'PENDING') throw new ConflictException({ errorCode: 'INVALID_TRANSITION', message: `Cannot approve a ${t.status} transfer.` });
    await this.prisma.stockTransfer.update({ where: { id }, data: { status: 'IN_TRANSIT', approvedBy: user.userId } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: t.sourceBranchId, userId: user.userId, action: 'TRANSFER_APPROVED', entityType: 'STOCK_TRANSFER', entityId: id, metadata: {} });
    return { id, status: 'IN_TRANSIT' };
  }

  async receive(user: AuthenticatedUser, id: string) {
    const t = await this.prisma.stockTransfer.findFirst({ where: { id, pharmacyId: user.pharmacyId }, include: { items: true } });
    if (!t) throw new NotFoundException({ errorCode: 'TRANSFER_NOT_FOUND', message: 'Transfer not found' });
    if (!['PENDING', 'IN_TRANSIT'].includes(t.status)) throw new ConflictException({ errorCode: 'INVALID_TRANSITION', message: `Cannot receive a ${t.status} transfer.` });

    // Stock moves here, atomically: OUT at source + IN at destination per item.
    await this.prisma.$transaction(async (tx) => {
      for (const it of t.items) {
        await this.inventory.recordStockOut({ pharmacyId: t.pharmacyId, branchId: t.sourceBranchId, medicineId: it.medicineId, quantity: it.quantity, reasonCode: 'TRANSFER_OUT', referenceModule: 'TRANSFER', referenceId: t.id, performedBy: user.userId }, tx);
        await this.inventory.recordStockIn({ pharmacyId: t.pharmacyId, branchId: t.destBranchId, medicineId: it.medicineId, quantity: it.quantity, reasonCode: 'TRANSFER_IN', referenceModule: 'TRANSFER', referenceId: t.id, performedBy: user.userId }, tx);
      }
      await tx.stockTransfer.update({ where: { id }, data: { status: 'COMPLETED', receivedBy: user.userId, completedAt: new Date() } });
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: t.destBranchId, userId: user.userId, action: 'TRANSFER_RECEIVED', entityType: 'STOCK_TRANSFER', entityId: id, metadata: { items: t.items.length } });
    this.events.transferCompleted({ pharmacyId: user.pharmacyId, transferId: id });
    return { id, status: 'COMPLETED' };
  }

  async list(user: AuthenticatedUser) {
    const rows = await this.prisma.stockTransfer.findMany({ where: { pharmacyId: user.pharmacyId }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((t) => ({ id: t.id, transferNumber: t.transferNumber, sourceBranchId: t.sourceBranchId, destBranchId: t.destBranchId, status: t.status, itemCount: t._count.items, createdAt: t.createdAt.toISOString() }));
  }

  private async nextNumber(tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> {
    const year = new Date().getFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pharmacyId}:TRF:${year}`}))`;
    const count = await tx.stockTransfer.count({ where: { pharmacyId, transferNumber: { startsWith: `TRF-${year}-` } } });
    return `TRF-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private serialize(t: Prisma.StockTransferGetPayload<{ include: { items: true } }>) {
    return { id: t.id, transferNumber: t.transferNumber, sourceBranchId: t.sourceBranchId, destBranchId: t.destBranchId, status: t.status, itemCount: t.items.length, createdAt: t.createdAt.toISOString() };
  }
}
