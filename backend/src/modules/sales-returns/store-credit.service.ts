import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

/**
 * Financially-sensitive: every mutation is audit-logged with full reference detail
 * and the balance is always derived from an append-only ledger, never a bare
 * counter that could drift. `issue`/`redeem` accept a tx so they enrol in the
 * caller's atomic operation (a return, or a future POS redemption).
 */
@Injectable()
export class StoreCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Credit a customer's store-credit balance (from a SALES_RETURN). In-transaction. */
  async issue(tx: Prisma.TransactionClient, params: { pharmacyId: string; customerId: string; amount: number; referenceId: string; performedBy: string }): Promise<number> {
    const bal = await tx.storeCreditBalance.upsert({
      where: { pharmacyId_customerId: { pharmacyId: params.pharmacyId, customerId: params.customerId } },
      create: { pharmacyId: params.pharmacyId, customerId: params.customerId, balance: params.amount },
      update: { balance: { increment: params.amount } },
    });
    const balanceAfter = dec(bal.balance);
    await tx.storeCreditLedgerEntry.create({
      data: { pharmacyId: params.pharmacyId, customerId: params.customerId, direction: 'CREDIT', amount: params.amount, balanceAfter, referenceModule: 'SALES_RETURN', referenceId: params.referenceId, performedBy: params.performedBy },
    });
    return balanceAfter;
  }

  /** Read a customer's balance + recent ledger. Cashier is limited to balance-only at the controller. */
  async forCustomer(user: AuthenticatedUser, customerId: string, balanceOnly: boolean) {
    const bal = await this.prisma.storeCreditBalance.findUnique({ where: { pharmacyId_customerId: { pharmacyId: user.pharmacyId, customerId } } });
    const balance = dec(bal?.balance);
    if (balanceOnly) return { customerId, balance };
    const ledger = await this.prisma.storeCreditLedgerEntry.findMany({ where: { pharmacyId: user.pharmacyId, customerId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return {
      customerId,
      balance,
      ledger: ledger.map((l) => ({ id: l.id, direction: l.direction, amount: dec(l.amount), balanceAfter: dec(l.balanceAfter), referenceModule: l.referenceModule, referenceId: l.referenceId, createdAt: l.createdAt.toISOString() })),
    };
  }
}
