import { BadRequestException } from '@nestjs/common';

const MAX_RANGE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ResolvedDateRange {
  from: Date;
  to: Date;
  /** Same-length window immediately preceding `from`, for %-change comparisons. */
  priorFrom: Date;
  priorTo: Date;
}

/**
 * Resolves and validates a `from`/`to` query pair against the business rules in
 * spec §10: from <= to, to not in the future beyond "today", max 365 day span.
 * Defaults to "today" (in the pharmacy's timezone) when both are omitted.
 *
 * `timezone` should come from PharmacySettings; defaults to UTC when unset.
 */
export function resolveDateRange(from?: string, to?: string, timezone = 'UTC'): ResolvedDateRange {
  const now = new Date();
  const todayStart = startOfDayInTimezone(now, timezone);
  const todayEnd = new Date(todayStart.getTime() + MS_PER_DAY - 1);

  const fromDate = from ? new Date(from) : todayStart;
  const toDate = to ? new Date(to) : todayEnd;

  if (fromDate.getTime() > toDate.getTime()) {
    throw new BadRequestException({
      errorCode: 'INVALID_DATE_RANGE',
      message: '`from` date must be before or equal to `to` date',
    });
  }

  if (toDate.getTime() > todayEnd.getTime()) {
    throw new BadRequestException({
      errorCode: 'INVALID_DATE_RANGE',
      message: '`to` date cannot be in the future',
    });
  }

  const spanDays = (toDate.getTime() - fromDate.getTime()) / MS_PER_DAY;
  if (spanDays > MAX_RANGE_DAYS) {
    throw new BadRequestException({
      errorCode: 'DATE_RANGE_TOO_LARGE',
      message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
    });
  }

  const rangeMs = toDate.getTime() - fromDate.getTime();
  const priorTo = new Date(fromDate.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - rangeMs);

  return { from: fromDate, to: toDate, priorFrom, priorTo };
}

function startOfDayInTimezone(date: Date, timezone: string): Date {
  // Renders the date's calendar day in the target timezone, then reconstructs
  // midnight UTC-equivalent for that calendar day. Good enough for day-bucket
  // "today" comparisons without pulling in a full timezone library.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

/** Handles the "previous period had 0" edge case without ever emitting a literal Infinity. */
export function calcPercentChange(current: number, previous: number): number | 'new' {
  if (previous === 0) {
    return current > 0 ? 'new' : 0;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
