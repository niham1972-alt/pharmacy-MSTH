import { BadRequestException } from '@nestjs/common';
import { eachUtcDay, resolveRange, splitAggregatedVsLive, startOfUtcDay } from '../date-range.util';

const asOf = new Date('2026-07-21T10:00:00.000Z');

describe('resolveRange', () => {
  it('resolves an explicit custom range to inclusive UTC day bounds', () => {
    const r = resolveRange({ dateFrom: '2026-04-01', dateTo: '2026-06-30' }, { maxRangeDays: 366, asOf });
    expect(r.from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-06-30T23:59:59.999Z');
  });

  it('rejects from > to', () => {
    expect(() => resolveRange({ dateFrom: '2026-06-30', dateTo: '2026-04-01' }, { maxRangeDays: 366, asOf })).toThrow(BadRequestException);
  });

  it('rejects a range wider than the configured max', () => {
    expect(() => resolveRange({ dateFrom: '2020-01-01', dateTo: '2026-01-01' }, { maxRangeDays: 366, asOf })).toThrow(/RANGE_TOO_LARGE|over the/);
  });

  it('computes the previous calendar month for rolling_last_month', () => {
    const r = resolveRange({ dateRangeType: 'rolling_last_month' }, { maxRangeDays: 366, asOf });
    expect(r.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-06-30T23:59:59.999Z');
  });

  it('computes this-year-to-date for rolling_this_year', () => {
    const r = resolveRange({ dateRangeType: 'rolling_this_year' }, { maxRangeDays: 3660, asOf });
    expect(r.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.to.getUTCFullYear()).toBe(2026);
  });
});

describe('splitAggregatedVsLive (hybrid strategy)', () => {
  const range = { from: new Date('2026-07-01T00:00:00.000Z'), to: new Date('2026-07-21T23:59:59.999Z') };

  it('uses only live when nothing is aggregated yet', () => {
    const s = splitAggregatedVsLive(range, null);
    expect(s.summary).toBeNull();
    expect(s.live).toEqual(range);
  });

  it('splits at the aggregation boundary — summaries through the boundary, live after', () => {
    const aggregatedThrough = new Date('2026-07-20T00:00:00.000Z'); // job ran through the 20th
    const s = splitAggregatedVsLive(range, aggregatedThrough);
    expect(s.summary!.from.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(s.summary!.to.toISOString()).toBe('2026-07-20T23:59:59.999Z');
    expect(s.live!.from.toISOString()).toBe('2026-07-21T00:00:00.000Z');
    expect(s.live!.to.toISOString()).toBe('2026-07-21T23:59:59.999Z');
  });

  it('uses only summaries when the whole range is aggregated', () => {
    const s = splitAggregatedVsLive(range, new Date('2026-08-01T00:00:00.000Z'));
    expect(s.live).toBeNull();
    expect(s.summary).toEqual(range);
  });
});

describe('eachUtcDay', () => {
  it('enumerates inclusive UTC midnights', () => {
    const days = eachUtcDay({ from: new Date('2026-07-01T05:00:00Z'), to: new Date('2026-07-03T22:00:00Z') });
    expect(days.map((d) => d.toISOString())).toEqual([
      '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z', '2026-07-03T00:00:00.000Z',
    ]);
    expect(startOfUtcDay(days[0]).getTime()).toBe(days[0].getTime());
  });
});
