/**
 * Mirror of the backend `cart-calculations.util.ts` — the single source of
 * truth for cart math. Kept byte-for-byte equivalent so the displayed total
 * always equals the server-computed charge (spec §9).
 */
export interface CartLine {
  medicineId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxRatePercent?: number;
  taxInclusive?: boolean;
  unitCost?: number;
  currentStock?: number;
  prescriptionRequired?: boolean;
  controlled?: boolean;
  prescriptionVerifiedBy?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeLine(l: CartLine) {
  const rate = l.taxRatePercent ?? 0;
  const discount = l.discountAmount ?? 0;
  const gross = l.unitPrice * l.quantity;
  const taxable = Math.max(0, gross - discount);
  let tax: number;
  let net: number;
  let lineTotal: number;
  if (l.taxInclusive) {
    tax = rate > 0 ? taxable - taxable / (1 + rate / 100) : 0;
    net = taxable - tax;
    lineTotal = taxable;
  } else {
    tax = (taxable * rate) / 100;
    net = taxable;
    lineTotal = taxable + tax;
  }
  return { net: round2(net), tax: round2(tax), discount: round2(discount), lineTotal: round2(lineTotal) };
}

export function computeCart(lines: CartLine[]) {
  const computed = lines.map(computeLine);
  return {
    subTotal: round2(computed.reduce((s, l) => s + l.net, 0)),
    discountTotal: round2(computed.reduce((s, l) => s + l.discount, 0)),
    taxTotal: round2(computed.reduce((s, l) => s + l.tax, 0)),
    grandTotal: round2(computed.reduce((s, l) => s + l.lineTotal, 0)),
    lines: computed,
  };
}
