/**
 * Payment-terms code → net days. Shared by Module 7 (Suppliers, source of truth)
 * and Module 3 (Purchases, computes PO due dates). Single place to change the
 * business meaning of a terms code.
 */
export const PAYMENT_TERMS: Array<{ code: string; label: string; days: number }> = [
  { code: 'NET_15', label: 'Net 15', days: 15 },
  { code: 'NET_30', label: 'Net 30', days: 30 },
  { code: 'NET_45', label: 'Net 45', days: 45 },
  { code: 'NET_60', label: 'Net 60', days: 60 },
  { code: 'COD', label: 'Cash on Delivery', days: 0 },
  { code: 'ADVANCE', label: 'Advance Payment', days: 0 },
];

export const PAYMENT_TERM_CODES = PAYMENT_TERMS.map((t) => t.code);

export function paymentTermDays(code: string | null | undefined): number {
  return PAYMENT_TERMS.find((t) => t.code === code)?.days ?? 30;
}
