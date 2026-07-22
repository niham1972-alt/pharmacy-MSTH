/**
 * The predefined, pharmacy-customizable expense category list (spec §2.1).
 * Seeded per tenant on first use (lazy), consistent with Module 2's lookup-data
 * seeding approach — the pharmacy can then rename/add/deactivate freely.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'RENT',
  'UTILITIES',
  'SALARIES',
  'INSURANCE',
  'LICENSES_PERMITS',
  'EQUIPMENT_MAINTENANCE',
  'MARKETING',
  'PROFESSIONAL_FEES',
  'SUPPLIES_CONSUMABLES',
  'MISCELLANEOUS',
] as const;

/** Human-friendly labels for the seeded default categories (UI display). */
export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  SALARIES: 'Salaries',
  INSURANCE: 'Insurance',
  LICENSES_PERMITS: 'Licenses & Permits',
  EQUIPMENT_MAINTENANCE: 'Equipment & Maintenance',
  MARKETING: 'Marketing',
  PROFESSIONAL_FEES: 'Professional Fees',
  SUPPLIES_CONSUMABLES: 'Supplies & Consumables',
  MISCELLANEOUS: 'Miscellaneous',
};
