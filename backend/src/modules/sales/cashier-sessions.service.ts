import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SalesRepository } from './sales.repository';
import { SalesEventsEmitter } from './events/sales-events.emitter';
import { CloseSessionDto, OpenSessionDto } from './dto/sales.dto';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

const SESSION_VARIANCE_THRESHOLD = Number(process.env.SESSION_VARIANCE_THRESHOLD ?? 100);

@Injectable()
export class CashierSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: SalesRepository,
    private readonly audit: AuditLogService,
    private readonly events: SalesEventsEmitter,
  ) {}

  private branch(user: AuthenticatedUser, requested?: string): string {
    const branchId = requested ?? user.branchId;
    if (!user.accessibleBranchIds.includes(branchId)) throw new ForbiddenException({ errorCode: 'BRANCH_ACCESS_DENIED', message: `No access to branch ${branchId}` });
    return branchId;
  }

  async open(user: AuthenticatedUser, dto: OpenSessionDto) {
    const branchId = this.branch(user, dto.branchId);
    const existing = await this.repo.currentOpenSession(user.pharmacyId, branchId, user.userId);
    if (existing) throw new ConflictException({ errorCode: 'SESSION_ALREADY_OPEN', message: 'You already have an open session. Close it first.' });

    const session = await this.prisma.cashierSession.create({
      data: { pharmacyId: user.pharmacyId, branchId, cashierId: user.userId, openingFloat: dto.openingFloat },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId, userId: user.userId, action: 'SESSION_OPENED', entityType: 'CASHIER_SESSION', entityId: session.id, metadata: { openingFloat: dto.openingFloat } });
    this.events.sessionOpened({ pharmacyId: user.pharmacyId, branchId, sessionId: session.id, cashierId: user.userId });
    return this.serializeSession(session, await this.repo.sessionTotals(session.id));
  }

  async close(user: AuthenticatedUser, id: string, dto: CloseSessionDto) {
    const session = await this.repo.sessionById(user.pharmacyId, id);
    if (!session) throw new NotFoundException({ errorCode: 'SESSION_NOT_FOUND', message: 'Session not found' });
    if (session.cashierId !== user.userId && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ForbiddenException({ errorCode: 'NOT_OWN_SESSION', message: 'You can only close your own session.' });
    }
    if (session.status === 'CLOSED') throw new ConflictException({ errorCode: 'SESSION_CLOSED', message: 'Session is already closed.' });

    const totals = await this.repo.sessionTotals(id);
    const cashSales = dec(totals.cashPayments._sum.amount);
    const expectedCash = Math.round((dec(session.openingFloat) + cashSales) * 100) / 100;
    const variance = Math.round((dto.actualCash - expectedCash) * 100) / 100;

    const updated = await this.prisma.cashierSession.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), expectedCash, actualCash: dto.actualCash, variance },
    });
    await this.audit.record({
      pharmacyId: user.pharmacyId, branchId: session.branchId, userId: user.userId, action: 'SESSION_CLOSED', entityType: 'CASHIER_SESSION', entityId: id,
      metadata: { openingFloat: dec(session.openingFloat), expectedCash, actualCash: dto.actualCash, variance, flaggedForReview: Math.abs(variance) > SESSION_VARIANCE_THRESHOLD },
    });
    this.events.sessionClosed({ pharmacyId: user.pharmacyId, branchId: session.branchId, sessionId: id, cashierId: session.cashierId });
    return { ...this.serializeSession(updated, totals), flaggedForReview: Math.abs(variance) > SESSION_VARIANCE_THRESHOLD };
  }

  async current(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const session = await this.repo.currentOpenSession(user.pharmacyId, scope, user.userId);
    if (!session) return null;
    return this.serializeSession(session, await this.repo.sessionTotals(session.id));
  }

  async detail(user: AuthenticatedUser, id: string) {
    const session = await this.repo.sessionById(user.pharmacyId, id);
    if (!session) throw new NotFoundException({ errorCode: 'SESSION_NOT_FOUND', message: 'Session not found' });
    const canSeeAll = ['admin', 'super_admin', 'accountant', 'auditor'].includes(user.role);
    if (session.cashierId !== user.userId && !canSeeAll) throw new ForbiddenException({ errorCode: 'NOT_OWN_SESSION', message: 'Not your session.' });
    return this.serializeSession(session, await this.repo.sessionTotals(id));
  }

  async list(user: AuthenticatedUser, branchId?: string) {
    const scope = this.branch(user, branchId);
    const sessions = await this.repo.listSessions(user.pharmacyId, scope);
    return sessions.map((s) => ({
      id: s.id, cashierId: s.cashierId, status: s.status, openingFloat: dec(s.openingFloat),
      expectedCash: s.expectedCash != null ? dec(s.expectedCash) : null, actualCash: s.actualCash != null ? dec(s.actualCash) : null,
      variance: s.variance != null ? dec(s.variance) : null, openedAt: s.openedAt.toISOString(), closedAt: s.closedAt?.toISOString() ?? null,
      flaggedForReview: s.variance != null && Math.abs(dec(s.variance)) > SESSION_VARIANCE_THRESHOLD,
    }));
  }

  private serializeSession(s: { id: string; cashierId: string; status: string; openingFloat: Prisma.Decimal; expectedCash: Prisma.Decimal | null; actualCash: Prisma.Decimal | null; variance: Prisma.Decimal | null; openedAt: Date; closedAt: Date | null }, totals: Awaited<ReturnType<SalesRepository['sessionTotals']>>) {
    return {
      id: s.id,
      cashierId: s.cashierId,
      status: s.status,
      openingFloat: dec(s.openingFloat),
      expectedCash: s.expectedCash != null ? dec(s.expectedCash) : null,
      actualCash: s.actualCash != null ? dec(s.actualCash) : null,
      variance: s.variance != null ? dec(s.variance) : null,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      salesCount: totals.sales._count._all,
      salesTotal: dec(totals.sales._sum.grandTotal),
      cashCollected: dec(totals.cashPayments._sum.amount),
      byMethod: totals.byMethod.map((m) => ({ method: m.method, amount: dec(m._sum.amount) })),
    };
  }
}
