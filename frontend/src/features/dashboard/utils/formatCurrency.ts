/**
 * Currency comes from PharmacySettings (Module 18) — never hardcode a symbol.
 * Until Settings lands, the pharmacy default is PKR (Pakistani Rupee).
 */
export function formatCurrency(amount: number, currency = 'PKR', locale = 'en-PK'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
