export function summaryCacheKey(pharmacyId: string, branchId: string, dateRangeKey: string): string {
  return `dash:${pharmacyId}:${branchId}:summary:${dateRangeKey}`;
}

export function trendCacheKey(
  pharmacyId: string,
  branchId: string,
  dateRangeKey: string,
  granularity: string,
): string {
  return `dash:${pharmacyId}:${branchId}:trend:${dateRangeKey}:${granularity}`;
}

export function topSellingCacheKey(
  pharmacyId: string,
  branchId: string,
  dateRangeKey: string,
  metric: string,
): string {
  return `dash:${pharmacyId}:${branchId}:topselling:${dateRangeKey}:${metric}`;
}

export function branchInvalidationPattern(pharmacyId: string, branchId: string): string {
  return `dash:${pharmacyId}:${branchId}:*`;
}

export function dateRangeKey(from: Date, to: Date): string {
  return `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
}
