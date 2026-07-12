import { TaxDiscountMode } from '@prisma/client';

/**
 * Pure GRN pricing math — the single source of truth the server uses to compute
 * (and thereby validate) line nets and the invoice grand total. The frontend
 * mirrors this exact logic for the live preview; the server always recomputes so
 * a tampered client can never dictate stored totals.
 *
 * Model (all quantities in the medicine's stock/base unit):
 *  - receivedQuantity  : billed full-unit quantity
 *  - looseUnitQuantity : billed loose units (partial packs) at the same unit cost
 *  - freeQuantity      : bonus units — added to stock, never billed
 *
 * Per line:  gross = unitCost × (received + loose)
 *            discount → salesTax → advanceTax (tax bases = gross − discount)
 *            net = gross − discount + salesTax + advanceTax
 * Invoice:   subTotal = Σ line nets, then bulk discount → salesTax → advanceTax.
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Resolve a value that is either a percentage of `base` or a flat amount. */
export function resolveAdjustment(mode: TaxDiscountMode | undefined, value: number | undefined, base: number): number {
  const v = value ?? 0;
  if (v <= 0) return 0;
  return mode === 'PERCENT' ? round2((base * v) / 100) : round2(v);
}

export interface GrnLineInput {
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

export function computeLine(line: GrnLineInput): GrnLineComputed {
  const billedUnits = line.receivedQuantity + (line.looseUnitQuantity ?? 0);
  const gross = round2(line.actualUnitCost * billedUnits);
  const discount = resolveAdjustment(line.discountMode, line.discountValue, gross);
  const taxable = round2(gross - discount);
  const salesTax = resolveAdjustment(line.salesTaxMode, line.salesTaxValue, taxable);
  const advanceTax = resolveAdjustment(line.advanceTaxMode, line.advanceTaxValue, taxable);
  const net = round2(taxable + salesTax + advanceTax);
  return { gross, discount, salesTax, advanceTax, net };
}

export interface GrnInvoiceInput {
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

export function computeInvoice(lineNets: number[], invoice: GrnInvoiceInput): GrnInvoiceComputed {
  const subTotal = round2(lineNets.reduce((s, n) => s + n, 0));
  const invoiceDiscount = resolveAdjustment(invoice.invoiceDiscountMode, invoice.invoiceDiscountValue, subTotal);
  const afterDiscount = round2(subTotal - invoiceDiscount);
  const invoiceSalesTax = resolveAdjustment(invoice.invoiceSalesTaxMode, invoice.invoiceSalesTaxValue, afterDiscount);
  const invoiceAdvanceTax = resolveAdjustment(invoice.invoiceAdvanceTaxMode, invoice.invoiceAdvanceTaxValue, afterDiscount);
  const grandTotal = round2(afterDiscount + invoiceSalesTax + invoiceAdvanceTax);
  return { subTotal, invoiceDiscount, invoiceSalesTax, invoiceAdvanceTax, grandTotal };
}
