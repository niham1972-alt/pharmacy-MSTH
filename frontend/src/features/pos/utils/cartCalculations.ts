/**
 * Mirror of the backend `cart-calculations.util.ts` — the single source of
 * truth for cart math. The displayed total always equals the server-computed
 * charge because both run identical per-line inputs through `computeLine`.
 *
 * A cart-level discount is distributed proportionally onto the lines' own
 * `discountAmount` BEFORE totalling, so what the UI shows and what the backend
 * recomputes from the same `finalLines` are byte-identical (no rounding drift).
 */
export interface CartLine {
  medicineId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Per-line discount the cashier entered. */
  lineDiscount?: number;
  taxRatePercent?: number;
  taxInclusive?: boolean;
  unitCost?: number;
  currentStock?: number;
  prescriptionRequired?: boolean;
  controlled?: boolean;
  prescriptionVerifiedBy?: string;
  fefoBatch?: { batchNumber: string; expiryDate: string } | null;
  compliance?: { prescribingDoctor?: string; patientName?: string; patientIdNumber?: string; quantityDispensed?: number };
}

export type CartDiscount = { type: 'pct' | 'fixed'; value: number };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function lineTotalsWith(l: CartLine, discountAmount: number) {
  const rate = l.taxRatePercent ?? 0;
  const gross = l.unitPrice * l.quantity;
  const taxable = Math.max(0, gross - discountAmount);
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
  return { net: round2(net), tax: round2(tax), lineTotal: round2(lineTotal), discount: round2(discountAmount) };
}

/**
 * Builds the authoritative line set (`finalLines[i].discountAmount` already
 * includes the distributed cart discount) plus the totals. Send `finalLines`'
 * `discountAmount` values straight to the backend.
 */
export function buildCart(lines: CartLine[], cartDiscount?: CartDiscount) {
  // 1. Base line totals using only per-line discounts.
  const base = lines.map((l) => lineTotalsWith(l, l.lineDiscount ?? 0));
  const baseGrand = round2(base.reduce((s, b) => s + b.lineTotal, 0));

  // 2. Resolve the cart-level discount into an absolute amount, capped at grand.
  let cartDiscountAmount = 0;
  if (cartDiscount && cartDiscount.value > 0) {
    cartDiscountAmount = cartDiscount.type === 'pct' ? round2((baseGrand * cartDiscount.value) / 100) : Math.min(cartDiscount.value, baseGrand);
  }

  // 3. Distribute the cart discount across lines proportionally to line total,
  //    pushing any rounding remainder onto the last line so it sums exactly.
  const shares = base.map((b) => (baseGrand > 0 ? round2((cartDiscountAmount * b.lineTotal) / baseGrand) : 0));
  const distributed = shares.reduce((s, x) => s + x, 0);
  if (shares.length) shares[shares.length - 1] = round2(shares[shares.length - 1] + (cartDiscountAmount - distributed));

  // 4. Recompute each line with (lineDiscount + cartShare) as its discount.
  const finalLines = lines.map((l, i) => {
    const discountAmount = round2((l.lineDiscount ?? 0) + shares[i]);
    return { ...l, discountAmount, ...lineTotalsWith(l, discountAmount) };
  });

  const totals = {
    subTotal: round2(finalLines.reduce((s, l) => s + l.net, 0)),
    discountTotal: round2(finalLines.reduce((s, l) => s + l.discount, 0)),
    taxTotal: round2(finalLines.reduce((s, l) => s + l.tax, 0)),
    grandTotal: round2(finalLines.reduce((s, l) => s + l.lineTotal, 0)),
    cartDiscountAmount,
    baseGrand,
  };
  return { finalLines, totals };
}

/** Discount % of the (pre-discount) subtotal — used to gate against the cap. */
export function discountPercent(lines: CartLine[], cartDiscount?: CartDiscount): number {
  const { totals } = buildCart(lines, cartDiscount);
  const preDiscount = totals.subTotal + totals.discountTotal;
  return preDiscount > 0 ? (totals.discountTotal / preDiscount) * 100 : 0;
}
