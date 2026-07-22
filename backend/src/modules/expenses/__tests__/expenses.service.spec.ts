import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExpensesService } from '../expenses.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = { userId: 'acc-1', role: 'accountant', pharmacyId: 'ph-1', branchId: 'br-1', accessibleBranchIds: ['br-1'] };

const baseExpense = {
  id: 'exp-1', pharmacyId: 'ph-1', branchId: 'br-1', expenseNumber: 'EXP-2026-000001', categoryId: 'cat-1',
  payeeName: 'Insurer', amount: new Prisma.Decimal(12000), amountPaid: new Prisma.Decimal(0),
  paymentStatus: 'UNPAID', approvalStatus: 'NOT_REQUIRED', category: { name: 'INSURANCE' },
};

function makeService(expense: unknown) {
  const repo = { findById: jest.fn().mockResolvedValue(expense) };
  const tx = {
    expensePayment: { create: jest.fn(async ({ data }: { data: unknown }) => ({ id: 'pay-1', ...(data as object) })) },
    expense: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const events = { emit: jest.fn() };
  const service = new ExpensesService(prisma as never, repo as never, {} as never, {} as never, audit as never, events as never);
  return { service, tx, audit };
}

describe('ExpensesService.recordPayment validation (spec §10)', () => {
  it('rejects a payment exceeding the outstanding balance', async () => {
    const { service } = makeService({ ...baseExpense, amount: new Prisma.Decimal(12000), amountPaid: new Prisma.Decimal(10000) });
    await expect(service.recordPayment(user, 'exp-1', { amount: 5000, method: 'CASH' })).rejects.toBeInstanceOf(BadRequestException); // outstanding is 2000
  });

  it('blocks payment on a pending-approval expense until it is approved', async () => {
    const { service, tx } = makeService({ ...baseExpense, approvalStatus: 'PENDING_APPROVAL' });
    await expect(service.recordPayment(user, 'exp-1', { amount: 100, method: 'CASH' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expensePayment.create).not.toHaveBeenCalled();
  });

  it('blocks payment on a rejected expense', async () => {
    const { service } = makeService({ ...baseExpense, approvalStatus: 'REJECTED' });
    await expect(service.recordPayment(user, 'exp-1', { amount: 100, method: 'CASH' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a partial payment moves the status to PARTIALLY_PAID', async () => {
    const { service, tx } = makeService({ ...baseExpense });
    const res = await service.recordPayment(user, 'exp-1', { amount: 4000, method: 'BANK_TRANSFER' });
    expect(res.paymentStatus).toBe('PARTIALLY_PAID');
    expect(res.amountPaid).toBe(4000);
    expect(res.outstanding).toBe(8000);
    expect(tx.expense.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountPaid: 4000, paymentStatus: 'PARTIALLY_PAID' }) }));
  });

  it('paying the full outstanding amount marks it PAID', async () => {
    const { service, audit } = makeService({ ...baseExpense });
    const res = await service.recordPayment(user, 'exp-1', { amount: 12000, method: 'CHEQUE' });
    expect(res.paymentStatus).toBe('PAID');
    expect(res.outstanding).toBe(0);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPENSE_PAYMENT_RECORDED' }));
  });
});
