/**
 * Expense approval routing — mirrors Module 3's PO auto-approval-threshold in
 * spirit (spec §2.4 / §11). Pure + unit-tested.
 *
 * A one-off/new expense at or under the configured threshold is payable
 * immediately (NOT_REQUIRED); a larger one needs a second admin's approval.
 */
export function requiresApproval(amount: number, threshold: number): boolean {
  return amount > threshold;
}

/**
 * A recurring-generated (or edited) expense whose amount deviates upward from
 * its template's expected default by more than `deviationPercent` is worth a
 * second look even when it's under the flat threshold (spec §11 / §21 — catches
 * a normally-fixed rent suddenly much higher due to a data-entry slip).
 * No default set (variable utilities) ⇒ no deviation signal.
 */
export function exceedsDeviation(amount: number, defaultAmount: number | null | undefined, deviationPercent: number): boolean {
  if (defaultAmount == null || defaultAmount <= 0) return false;
  return amount > defaultAmount * (1 + deviationPercent / 100);
}

/**
 * Combined decision used at create/update time. Returns whether the expense must
 * enter PENDING_APPROVAL. `defaultAmount` is the source template's default (only
 * relevant for generated/edited recurring instances); pass null for pure one-offs.
 */
export function needsApproval(params: {
  amount: number;
  threshold: number;
  defaultAmount?: number | null;
  deviationPercent: number;
}): boolean {
  return (
    requiresApproval(params.amount, params.threshold) ||
    exceedsDeviation(params.amount, params.defaultAmount, params.deviationPercent)
  );
}
