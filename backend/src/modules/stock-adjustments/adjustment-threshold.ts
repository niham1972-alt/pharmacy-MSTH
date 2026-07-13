/**
 * An adjustment auto-approves only when it's small on BOTH axes — quantity AND
 * value are within their configured caps. Exceeding either cap (a lot of units,
 * OR a lot of money) requires a second admin's approval. Pure + unit-tested.
 */
export function isAutoApproved(quantity: number, value: number, maxQty: number, maxValue: number): boolean {
  return quantity <= maxQty && value <= maxValue;
}
