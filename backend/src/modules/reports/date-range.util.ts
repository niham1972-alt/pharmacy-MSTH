import { BadRequestException } from '@nestjs/common';
import { ReportFilters } from './interfaces/report-filters.interface';

/** A resolved, inclusive UTC date range for a report query. */
export interface ResolvedRange {
  from: Date; // inclusive start (UTC midnight of the first day)
  to: Date; // inclusive end (UTC 23:59:59.999 of the last day)
}

export const DAY_MS = 86_400_000;

/** UTC midnight of a date. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** UTC end-of-day (…T23:59:59.999Z). */
export function endOfUtcDay(d: Date): Date {
  const s = startOfUtcDay(d);
  return new Date(s.getTime() + DAY_MS - 1);
}

/**
 * Resolve a report's date range. Supports explicit custom ranges and saved-config
 * "rolling" windows (recomputed relative to `asOf` on each run — spec §2.6 / §5).
 * Enforces from ≤ to and a configurable maximum span.
 */
export function resolveRange(filters: ReportFilters, opts: { maxRangeDays: number; asOf?: Date }): ResolvedRange {
  const asOf = opts.asOf ?? new Date();
  let from: Date;
  let to: Date;

  switch (filters.dateRangeType) {
    case 'rolling_last_7_days':
      to = endOfUtcDay(new Date(asOf.getTime() - DAY_MS));
      from = startOfUtcDay(new Date(asOf.getTime() - 7 * DAY_MS));
      break;
    case 'rolling_last_month': {
      // The whole previous calendar month.
      const firstThis = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
      to = new Date(firstThis.getTime() - 1);
      from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
      break;
    }
    case 'rolling_this_month':
      from = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
      to = endOfUtcDay(asOf);
      break;
    case 'rolling_this_year':
      from = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
      to = endOfUtcDay(asOf);
      break;
    default: {
      if (!filters.dateFrom || !filters.dateTo) {
        // Default to the current calendar month when nothing is supplied.
        from = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
        to = endOfUtcDay(asOf);
      } else {
        from = startOfUtcDay(new Date(filters.dateFrom));
        to = endOfUtcDay(new Date(filters.dateTo));
      }
    }
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException({ errorCode: 'INVALID_DATE', message: 'Invalid dateFrom / dateTo.' });
  }
  if (from.getTime() > to.getTime()) {
    throw new BadRequestException({ errorCode: 'INVALID_RANGE', message: 'dateFrom must be on or before dateTo.' });
  }
  const spanDays = Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
  if (spanDays > opts.maxRangeDays) {
    throw new BadRequestException({
      errorCode: 'RANGE_TOO_LARGE',
      message: `The selected range spans ${spanDays} days, over the ${opts.maxRangeDays}-day limit. Narrow the range or use the async export path.`,
    });
  }
  return { from, to };
}

/**
 * Split a range into the portion covered by pre-aggregated daily summaries vs the
 * recent "live" tail not yet aggregated (spec §8 hybrid strategy). `aggregatedThrough`
 * is the last day (UTC midnight) the nightly job has completed — everything on/before
 * it reads from summaries; everything after reads live from source tables.
 */
export function splitAggregatedVsLive(range: ResolvedRange, aggregatedThrough: Date | null): { summary: ResolvedRange | null; live: ResolvedRange | null } {
  if (!aggregatedThrough) return { summary: null, live: range };
  // The boundary is the END of the last fully-aggregated day.
  const boundary = endOfUtcDay(aggregatedThrough);
  if (range.to.getTime() <= boundary.getTime()) return { summary: range, live: null };
  if (range.from.getTime() > boundary.getTime()) return { summary: null, live: range };
  return {
    summary: { from: range.from, to: boundary },
    live: { from: new Date(boundary.getTime() + 1), to: range.to },
  };
}

/** Enumerate each UTC day (midnight) in an inclusive range — for per-day backfill. */
export function eachUtcDay(range: ResolvedRange): Date[] {
  const days: Date[] = [];
  let cur = startOfUtcDay(range.from);
  const last = startOfUtcDay(range.to);
  while (cur.getTime() <= last.getTime()) {
    days.push(cur);
    cur = new Date(cur.getTime() + DAY_MS);
  }
  return days;
}
