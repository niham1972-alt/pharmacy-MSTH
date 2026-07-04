/**
 * Single source of truth for cart math (spec §9). The frontend's
 * `cartCalculations.ts` mirrors this exactly so displayed totals always equal
 * the server-computed charge. Each line respects its own tax-inclusive flag.
 */
export interface LineInput {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxRatePercent?: number;
  taxInclusive?: boolean;
  unitCost?: number;
}

export interface LineTotals {
  net: number; // pre-tax net after discount
  tax: number;
  discount: number;
  lineTotal: number; // charged amount for the line (tax included)
  cost: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeLine(input: LineInput): LineTotals {
  const rate = input.taxRatePercent ?? 0;
  const discount = input.discountAmount ?? 0;
  const gross = input.unitPrice * input.quantity;
  const taxable = Math.max(0, gross - discount);

  let tax: number;
  let net: number;
  let lineTotal: number;
  if (input.taxInclusive) {
    tax = rate > 0 ? taxable - taxable / (1 + rate / 100) : 0;
    net = taxable - tax;
    lineTotal = taxable;
  } else {
    tax = (taxable * rate) / 100;
    net = taxable;
    lineTotal = taxable + tax;
  }

  return {
    net: round2(net),
    tax: round2(tax),
    discount: round2(discount),
    lineTotal: round2(lineTotal),
    cost: round2((input.unitCost ?? 0) * input.quantity),
  };
}

export interface CartTotals {
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  totalCost: number;
}

export function computeCart(lines: LineInput[]): { totals: CartTotals; lines: LineTotals[] } {
  const computed = lines.map(computeLine);
  const totals: CartTotals = {
    subTotal: round2(computed.reduce((s, l) => s + l.net, 0)),
    discountTotal: round2(computed.reduce((s, l) => s + l.discount, 0)),
    taxTotal: round2(computed.reduce((s, l) => s + l.tax, 0)),
    grandTotal: round2(computed.reduce((s, l) => s + l.lineTotal, 0)),
    totalCost: round2(computed.reduce((s, l) => s + l.cost, 0)),
  };
  return { totals, lines: computed };
}
