import { Prisma } from '@prisma/client';
import { duePeriodFor, lastDayOfMonthUTC, periodKeyFor } from '../recurrence';
import { RecurringExpenseGeneratorJob } from '../jobs/recurring-expense-generator.job';

const utc = (y: number, m1: number, d: number) => new Date(Date.UTC(y, m1 - 1, d));

describe('recurrence maths', () => {
  it('builds the right period keys per frequency', () => {
    expect(periodKeyFor('MONTHLY', utc(2026, 7, 15))).toBe('2026-07');
    expect(periodKeyFor('QUARTERLY', utc(2026, 7, 15))).toBe('2026-Q3');
    expect(periodKeyFor('ANNUALLY', utc(2026, 7, 15))).toBe('2026');
  });

  it('is not due before the day-of-period, then due on/after it', () => {
    const t = { recurrenceFrequency: 'MONTHLY' as const, dayOfPeriod: 10, startedAt: utc(2020, 1, 1) };
    expect(duePeriodFor(t, utc(2026, 7, 9))).toBeNull();
    expect(duePeriodFor(t, utc(2026, 7, 10))?.periodKey).toBe('2026-07');
    expect(duePeriodFor(t, utc(2026, 7, 25))?.dueDate.getUTCDate()).toBe(10);
  });

  it('clamps an impossible day (31st) to the last day of a short month (spec §21)', () => {
    expect(lastDayOfMonthUTC(2026, 1)).toBe(28); // Feb 2026 (0-based month index 1)
    const t = { recurrenceFrequency: 'MONTHLY' as const, dayOfPeriod: 31, startedAt: utc(2020, 1, 1) };
    const due = duePeriodFor(t, utc(2026, 2, 28));
    expect(due?.dueDate.getUTCMonth()).toBe(1); // still February, not rolled into March
    expect(due?.dueDate.getUTCDate()).toBe(28);
  });

  it('respects the template active window (started after / ended before)', () => {
    const startedLate = { recurrenceFrequency: 'MONTHLY' as const, dayOfPeriod: 5, startedAt: utc(2026, 7, 20) };
    expect(duePeriodFor(startedLate, utc(2026, 7, 25))).toBeNull(); // this period's gen date (the 5th) predates start
    const ended = { recurrenceFrequency: 'MONTHLY' as const, dayOfPeriod: 5, startedAt: utc(2020, 1, 1), endedAt: utc(2026, 7, 1) };
    expect(duePeriodFor(ended, utc(2026, 7, 25))).toBeNull(); // ended before the 5th
  });
});

// ---------------------------------------------------------------------------
// Idempotency — the headline acceptance criterion (spec §3 / §20).
// ---------------------------------------------------------------------------
function makeGenerator(opts: { throwP2002?: boolean } = {}) {
  const template = {
    id: 'tpl-1', pharmacyId: 'ph-1', branchId: 'br-1', categoryId: 'cat-1', payeeName: 'Landlord',
    defaultAmount: new Prisma.Decimal(50000), recurrenceFrequency: 'MONTHLY', dayOfPeriod: 1,
    isActive: true, startedAt: utc(2020, 1, 1), endedAt: null, lastGeneratedPeriod: null as string | null, createdBy: 'admin-1',
  };
  const createdKeys = new Set<string>(); // simulates the (templateId, periodKey) unique index
  let createCalls = 0;

  const tx = {
    expense: {
      create: jest.fn(async ({ data }: { data: { generatedFromTemplateId: string; periodKey: string } }) => {
        createCalls++;
        const key = `${data.generatedFromTemplateId}:${data.periodKey}`;
        if (opts.throwP2002 && createdKeys.has(key)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
        }
        createdKeys.add(key);
        return { id: `exp-${createCalls}`, expenseNumber: `EXP-2026-00000${createCalls}`, ...data };
      }),
    },
    recurringExpenseTemplate: { update: jest.fn(async ({ data }: { data: { lastGeneratedPeriod?: string } }) => { if (data.lastGeneratedPeriod) template.lastGeneratedPeriod = data.lastGeneratedPeriod; return template; }) },
  };
  const prisma = {
    recurringExpenseTemplate: {
      findMany: jest.fn(async () => [template]),
      update: jest.fn(async ({ data }: { data: { lastGeneratedPeriod?: string } }) => { if (data.lastGeneratedPeriod) template.lastGeneratedPeriod = data.lastGeneratedPeriod; return template; }),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const repo = { nextNumber: jest.fn(async () => 'EXP-2026-000001') };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const events = { emit: jest.fn() };
  const job = new RecurringExpenseGeneratorJob(prisma as never, repo as never, audit as never, events as never);
  return { job, tx, prisma, template, getCreateCalls: () => createCalls };
}

describe('RecurringExpenseGeneratorJob idempotency', () => {
  const asOf = utc(2026, 7, 5); // past the 1st → the July period is due

  it('generates exactly one expense on the first run', async () => {
    const { job, tx } = makeGenerator();
    const r = await job.run(asOf);
    expect(r.generated).toBe(1);
    expect(r.skipped).toBe(0);
    expect(tx.expense.create).toHaveBeenCalledTimes(1);
    expect(tx.expense.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ periodKey: '2026-07', generatedFromTemplateId: 'tpl-1', approvalStatus: 'NOT_REQUIRED' }) }));
  });

  it('a second run in the same period creates NO duplicate (fast short-circuit)', async () => {
    const { job, tx } = makeGenerator();
    await job.run(asOf); // sets lastGeneratedPeriod = '2026-07'
    const r2 = await job.run(asOf);
    expect(r2.generated).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(tx.expense.create).toHaveBeenCalledTimes(1); // never called a second time
  });

  it('a concurrent/overlapping insert hitting the unique index is a skip, not a failure', async () => {
    // Force the fast short-circuit off by pretending the template row is stale, so
    // the create actually runs and the DB unique constraint (P2002) is what stops it.
    const { job, template, tx } = makeGenerator({ throwP2002: true });
    await job.run(asOf); // first insert succeeds, records the key
    template.lastGeneratedPeriod = null; // simulate a racing worker that hasn't seen the update
    const r2 = await job.run(asOf);
    expect(r2.failed).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(r2.generated).toBe(0);
    expect(tx.expense.create).toHaveBeenCalledTimes(2); // attempted twice, but only one row exists
  });
});
