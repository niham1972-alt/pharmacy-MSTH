import { BadRequestException } from '@nestjs/common';
import { calcPercentChange, resolveDateRange } from '../utils/date-range.util';

describe('resolveDateRange', () => {
  it('rejects when from is after to', () => {
    expect(() => resolveDateRange('2026-07-10', '2026-07-01')).toThrow(BadRequestException);
  });

  it('rejects ranges longer than 365 days', () => {
    expect(() => resolveDateRange('2024-01-01', '2026-06-01')).toThrow(BadRequestException);
  });

  it('rejects a `to` date in the future', () => {
    const farFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(() => resolveDateRange(undefined, farFuture)).toThrow(BadRequestException);
  });

  it('defaults to today when from/to are omitted', () => {
    const range = resolveDateRange();
    expect(range.from.getTime()).toBeLessThanOrEqual(range.to.getTime());
  });

  it('computes a same-length prior period for %-change comparisons', () => {
    const range = resolveDateRange('2026-06-01', '2026-06-10');
    const spanMs = range.to.getTime() - range.from.getTime();
    const priorSpanMs = range.priorTo.getTime() - range.priorFrom.getTime();
    expect(priorSpanMs).toBe(spanMs);
    expect(range.priorTo.getTime()).toBeLessThan(range.from.getTime());
  });
});

describe('calcPercentChange', () => {
  it('returns "new" instead of Infinity when the previous period was zero', () => {
    expect(calcPercentChange(500, 0)).toBe('new');
  });

  it('returns 0 when both periods are zero', () => {
    expect(calcPercentChange(0, 0)).toBe(0);
  });

  it('computes a normal percentage change', () => {
    expect(calcPercentChange(150, 100)).toBe(50);
  });
});
