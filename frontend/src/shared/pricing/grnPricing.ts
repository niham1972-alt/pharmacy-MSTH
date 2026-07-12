// Mirror of the backend `grn-pricing.ts` — keep the two in sync. The server is
// always authoritative; this is only for the live on-screen preview.

export type TaxDiscountMode = 'PERCENT' | 'AMOUNT';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function resolveAdjustment(mode: TaxDiscountMode | undefined, value: number | undefined, base: number): number {
  const v = value ?? 0;
  if (v <= 0) return 0;
  return mode === 'PERCENT' ? round2((base * v) / 100) : round2(v);
}

export interface GrnLineMath {
  actualUnitCost: number;
  receivedQuantity: number;
  looseUnitQuantity?: number;
  discountMode?: TaxDiscountMode;
  discountValue?: number;
  salesTaxMode?: TaxDiscountMode;
  salesTaxValue?: number;
  advanceTaxMode?: TaxDiscountMode;
  advanceTaxValue?: number;
}

export interface GrnLineComputed {
  gross: number;
  discount: number;
  salesTax: number;
  advanceTax: number;
  net: number;
}

export function computeLine(line: GrnLineMath): GrnLineComputed {
  const billedUnits = (line.receivedQuantity || 0) + (line.looseUnitQuantity ?? 0);
  const gross = round2((line.actualUnitCost || 0) * billedUnits);
  const discount = resolveAdjustment(line.discountMode, line.discountValue, gross);
  const taxable = round2(gross - discount);
  const salesTax = resolveAdjustment(line.salesTaxMode, line.salesTaxValue, taxable);
  const advanceTax = resolveAdjustment(line.advanceTaxMode, line.advanceTaxValue, taxable);
  const net = round2(taxable + salesTax + advanceTax);
  return { gross, discount, salesTax, advanceTax, net };
}

export interface GrnInvoiceMath {
  invoiceDiscountMode?: TaxDiscountMode;
  invoiceDiscountValue?: number;
  invoiceSalesTaxMode?: TaxDiscountMode;
  invoiceSalesTaxValue?: number;
  invoiceAdvanceTaxMode?: TaxDiscountMode;
  invoiceAdvanceTaxValue?: number;
}

export interface GrnInvoiceComputed {
  subTotal: number;
  invoiceDiscount: number;
  invoiceSalesTax: number;
  invoiceAdvanceTax: number;
  grandTotal: number;
}

export function computeInvoice(lineNets: number[], invoice: GrnInvoiceMath): GrnInvoiceComputed {
  const subTotal = round2(lineNets.reduce((s, n) => s + n, 0));
  const invoiceDiscount = resolveAdjustment(invoice.invoiceDiscountMode, invoice.invoiceDiscountValue, subTotal);
  const afterDiscount = round2(subTotal - invoiceDiscount);
  const invoiceSalesTax = resolveAdjustment(invoice.invoiceSalesTaxMode, invoice.invoiceSalesTaxValue, afterDiscount);
  const invoiceAdvanceTax = resolveAdjustment(invoice.invoiceAdvanceTaxMode, invoice.invoiceAdvanceTaxValue, afterDiscount);
  const grandTotal = round2(afterDiscount + invoiceSalesTax + invoiceAdvanceTax);
  return { subTotal, invoiceDiscount, invoiceSalesTax, invoiceAdvanceTax, grandTotal };
}
