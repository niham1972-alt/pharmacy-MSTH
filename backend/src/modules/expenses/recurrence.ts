import { ExpenseRecurrenceFrequency } from '@prisma/client';

/**
 * Recurrence maths for the recurring-expense generator (spec §2.2 / §3 / §21).
 * All computation is in UTC (money timestamps are UTC system-wide) and PURE, so
 * the idempotency + edge-case behaviour is unit-tested without a DB or clock.
 *
 * Period identity (`periodKey`) is the idempotency anchor: at most one generated
 * expense may exist per (template, periodKey). Formats:
 *   MONTHLY   → "YYYY-MM"   QUARTERLY → "YYYY-Qn"   ANNUALLY → "YYYY"
 */
export type Freq = ExpenseRecurrenceFrequency;

export interface DuePeriod {
  /** Idempotency key for this template's occurrence in `asOf`'s period. */
  periodKey: string;
  /** The date the expense is considered incurred / due (dayOfPeriod, clamped). */
  dueDate: Date;
}

/** Last calendar day (28–31) of a given UTC month. */
export function lastDayOfMonthUTC(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * The generation/due date within a period — `dayOfPeriod` clamped to the last
 * day of the month so e.g. "day 31" in February lands on the 28th/29th rather
 * than rolling into March (spec §21 documented policy).
 */
function clampedDate(year: number, monthIndex0: number, dayOfPeriod: number): Date {
  const day = Math.min(Math.max(1, dayOfPeriod), lastDayOfMonthUTC(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, day));
}

/** The month a period starts in, for the period containing `asOf`. */
function periodStartMonth(freq: Freq, month0: number): number {
  if (freq === 'QUARTERLY') return Math.floor(month0 / 3) * 3; // 0,3,6,9
  if (freq === 'ANNUALLY') return 0; // January
  return month0; // MONTHLY
}

export function periodKeyFor(freq: Freq, d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (freq === 'MONTHLY') return `${y}-${String(m + 1).padStart(2, '0')}`;
  if (freq === 'QUARTERLY') return `${y}-Q${Math.floor(m / 3) + 1}`;
  return `${y}`;
}

/**
 * Given a template's recurrence config and a moment `asOf`, return the period
 * that is due for generation as of that moment, or null if:
 *  - the period's generation date hasn't been reached yet, or
 *  - the template's active window (startedAt…endedAt) doesn't cover it.
 *
 * Callers still guard idempotency at the DB (unique index) — this only decides
 * WHICH period, deterministically, so a re-run computes the same key.
 */
export function duePeriodFor(
  t: { recurrenceFrequency: Freq; dayOfPeriod: number; startedAt: Date; endedAt?: Date | null },
  asOf: Date,
): DuePeriod | null {
  const y = asOf.getUTCFullYear();
  const startMonth = periodStartMonth(t.recurrenceFrequency, asOf.getUTCMonth());
  const genDate = clampedDate(y, startMonth, t.dayOfPeriod);

  // Not due until this period's generation date has arrived.
  if (asOf.getTime() < genDate.getTime()) return null;
  // Template must have started on/before this period's generation date …
  if (t.startedAt.getTime() > genDate.getTime()) return null;
  // … and not have ended on/before it.
  if (t.endedAt && t.endedAt.getTime() <= genDate.getTime()) return null;

  return { periodKey: periodKeyFor(t.recurrenceFrequency, asOf), dueDate: genDate };
}
