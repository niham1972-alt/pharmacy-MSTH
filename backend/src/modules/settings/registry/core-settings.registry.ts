import { SettingScope, SettingValueType } from '@prisma/client';

export interface SettingDefinitionInput {
  key: string;
  label: string;
  description?: string;
  category: string;
  valueType: SettingValueType;
  defaultValue: unknown;
  validationRule?: Record<string, unknown>;
  scope?: SettingScope;
  isSensitive?: boolean;
}

/**
 * THE single, in-code registry of every configurable business rule referenced
 * across the system. Registered idempotently at bootstrap (upsert by key).
 * Key convention: `module.category.settingName`. Every future module adds its
 * settings here rather than hardcoding constants. Values shared by more than one
 * module (expiry tiers, negative-stock policy) exist as exactly ONE key.
 */
export const CORE_SETTINGS: SettingDefinitionInput[] = [
  // --- General / Pharmacy Profile ------------------------------------------
  { key: 'general.profile.pharmacyName', label: 'Pharmacy name', category: 'General', valueType: 'STRING', defaultValue: 'My Pharmacy', validationRule: { maxLength: 200 } },
  { key: 'general.profile.currency', label: 'Default currency', description: 'ISO code used for all money formatting.', category: 'General', valueType: 'ENUM', defaultValue: 'PKR', validationRule: { allowedValues: ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'INR', 'SAR'] } },
  { key: 'general.profile.timezone', label: 'Timezone', description: 'Drives the "today" boundary and every date-sensitive calculation.', category: 'General', valueType: 'STRING', defaultValue: 'Asia/Karachi', validationRule: { maxLength: 64 } },
  { key: 'general.receipt.headerText', label: 'Receipt / document header', description: 'Printed at the top of POS receipts and PO/GRN documents.', category: 'General', valueType: 'STRING', defaultValue: '', validationRule: { maxLength: 500 } },

  // --- Dashboard (Module 1) — expiry tiers are CANONICAL, shared w/ Batches -
  { key: 'dashboard.alerts.expiryTiers', label: 'Expiry alert tiers (days)', description: 'Red under `red` days, orange under `orange`, yellow under `yellow`. Shared by Dashboard alerts and Batch classification.', category: 'Dashboard', valueType: 'JSON', defaultValue: { red: 30, orange: 90, yellow: 180 }, validationRule: { expiryTiers: true } },
  { key: 'dashboard.refreshIntervalSeconds', label: 'Dashboard auto-refresh interval (s)', category: 'Dashboard', valueType: 'NUMBER', defaultValue: 60, validationRule: { min: 10, max: 3600 } },

  // --- Medicines (Module 2) ------------------------------------------------
  { key: 'medicines.tax.defaultRatePercent', label: 'Default tax rate (%)', description: 'Applied to new medicines unless overridden per item.', category: 'Medicines', valueType: 'NUMBER', defaultValue: 0, validationRule: { min: 0, max: 100 } },
  { key: 'medicines.barcode.format', label: 'Expected barcode format', category: 'Medicines', valueType: 'ENUM', defaultValue: 'EAN_13', validationRule: { allowedValues: ['EAN_13', 'UPC_A', 'CUSTOM'] } },
  { key: 'medicines.allowSellDiscontinuedStock', label: 'Allow selling discontinued stock', category: 'Medicines', valueType: 'BOOLEAN', defaultValue: true },

  // --- Purchases (Module 3) ------------------------------------------------
  { key: 'purchases.approval.thresholdAmount', label: 'PO auto-approval threshold', description: 'POs at/under this grand total auto-approve on submit. Can vary per branch.', category: 'Purchases', valueType: 'NUMBER', defaultValue: 50000, validationRule: { min: 0 }, scope: 'BRANCH' },
  { key: 'purchases.receipt.overReceiptTolerancePercent', label: 'Over-receipt tolerance (%)', description: 'Extra % receivable beyond ordered quantity.', category: 'Purchases', valueType: 'NUMBER', defaultValue: 0, validationRule: { min: 0, max: 100 } },
  { key: 'purchases.variance.warnPercent', label: 'Cost variance warning (%)', description: 'Soft warning threshold — must be ≤ the block threshold.', category: 'Purchases', valueType: 'NUMBER', defaultValue: 10, validationRule: { min: 0, max: 100, lessThanOrEqualKey: 'purchases.variance.blockPercent' } },
  { key: 'purchases.variance.blockPercent', label: 'Cost variance hard block (%)', description: 'Hard block requiring acknowledgement.', category: 'Purchases', valueType: 'NUMBER', defaultValue: 50, validationRule: { min: 0, max: 100 } },
  { key: 'purchases.costingRule', label: 'Costing rule', category: 'Purchases', valueType: 'ENUM', defaultValue: 'LATEST_COST', validationRule: { allowedValues: ['LATEST_COST', 'WEIGHTED_AVERAGE', 'MANUAL_ONLY'] } },

  // --- Sales / POS (Module 4) — allowNegativeStock CANONICAL, shared w/ M5 --
  { key: 'sales.discount.autoApprovedPercent', label: 'Cashier auto-approved discount (%)', description: 'Discounts above this need step-up approval.', category: 'Sales', valueType: 'NUMBER', defaultValue: 5, validationRule: { min: 0, max: 100 } },
  { key: 'sales.allowNegativeStock', label: 'Allow negative stock (backorder)', description: 'Permit selling below zero stock. Shared by POS and the Inventory ledger.', category: 'Sales', valueType: 'BOOLEAN', defaultValue: false },
  { key: 'sales.voidWindowDays', label: 'Same-day void window (days)', description: 'Days a completed sale can be voided before it must be a return.', category: 'Sales', valueType: 'NUMBER', defaultValue: 1, validationRule: { min: 0, max: 30 } },
  { key: 'sales.session.cashVarianceThreshold', label: 'Session cash-variance review threshold', category: 'Sales', valueType: 'NUMBER', defaultValue: 100, validationRule: { min: 0 } },

  // --- Sales Returns (Module 10) — controlled substances are ALWAYS blocked
  //     in code (never a setting); these tune the softer policy knobs. --------
  { key: 'returns.eligibilityWindowDays', label: 'Return eligibility window (days)', description: 'A sale can be returned within this many days of purchase.', category: 'Returns', valueType: 'NUMBER', defaultValue: 14, validationRule: { min: 0, max: 365 } },
  { key: 'returns.nonReturnableCategories', label: 'Non-returnable categories', description: 'Medicines in these categories (by name) cannot be returned, on top of the always-blocked controlled substances.', category: 'Returns', valueType: 'JSON', defaultValue: [], validationRule: { stringArray: true } },
  { key: 'returns.allowPrescriptionItemReturns', label: 'Allow returning prescription items', description: 'If off, any prescription-required item is non-returnable. If on, such returns still require pharmacist/admin approval.', category: 'Returns', valueType: 'BOOLEAN', defaultValue: true },
  { key: 'returns.cashierCanProcessResaleable', label: 'Cashiers may process resaleable, non-sensitive returns', description: 'If off, every return needs pharmacist/admin approval.', category: 'Returns', valueType: 'BOOLEAN', defaultValue: true },
  { key: 'returns.approvalRequiredReasons', label: 'Return reasons that force approval', description: 'Return reason codes that always require pharmacist/admin approval regardless of item type.', category: 'Returns', valueType: 'JSON', defaultValue: ['ADVERSE_REACTION'], validationRule: { stringArray: true } },

  // --- Stock Adjustments (Module 11) — a small correction auto-approves; a
  //     larger one (by quantity OR value) needs a second admin's approval. -----
  { key: 'adjustments.autoApproveMaxQuantity', label: 'Adjustment auto-approve max quantity', description: 'Adjustments of this many units or fewer auto-approve; larger ones need admin approval.', category: 'Inventory', valueType: 'NUMBER', defaultValue: 10, validationRule: { min: 0 } },
  { key: 'adjustments.autoApproveMaxValue', label: 'Adjustment auto-approve max value', description: 'Adjustments valued at this amount (quantity × unit cost) or less auto-approve; costlier ones need admin approval.', category: 'Inventory', valueType: 'NUMBER', defaultValue: 5000, validationRule: { min: 0 } },

  // --- Expenses (Module 13) — mirrors the Purchases PO approval-threshold
  //     pattern: an expense at/under the threshold is payable immediately; a
  //     larger one needs a second admin's approval before payment. -------------
  { key: 'expenses.approval.thresholdAmount', label: 'Expense approval threshold', description: 'Expenses above this amount require admin approval before a payment can be recorded. Can vary per branch.', category: 'Expenses', valueType: 'NUMBER', defaultValue: 25000, validationRule: { min: 0 }, scope: 'BRANCH' },
  { key: 'expenses.approval.deviationPercent', label: 'Recurring deviation approval (%)', description: 'A recurring-generated expense whose amount exceeds its template default by more than this percent is flagged for approval even if under the threshold (catches data-entry slips).', category: 'Expenses', valueType: 'NUMBER', defaultValue: 25, validationRule: { min: 0, max: 1000 } },

  // --- Reports & Analytics (Module 14) -------------------------------------
  { key: 'reports.maxSyncRangeDays', label: 'Max synchronous report range (days)', description: 'Reports over a range wider than this must use the async export path rather than a live inline query, protecting the API from an accidentally huge scan.', category: 'Reports', valueType: 'NUMBER', defaultValue: 366, validationRule: { min: 1, max: 3660 } },
  { key: 'reports.maxExportRangeDays', label: 'Max export range (days)', description: 'Hard cap on the date span of a single export request; wider spans must be split into smaller periods.', category: 'Reports', valueType: 'NUMBER', defaultValue: 1100, validationRule: { min: 1, max: 3660 } },

  // --- Customers (Module 8) ------------------------------------------------
  { key: 'customers.phone.regex', label: 'Phone number validation (regex)', category: 'Customers', valueType: 'STRING', defaultValue: '^[+\\d][\\d\\s\\-()]{4,24}$', validationRule: { maxLength: 200 } },

  // --- Users & Access (Module 16) ------------------------------------------
  { key: 'users.stepUp.windowSeconds', label: 'Step-up verification window (s)', description: 'How long an elevated-action challenge stays valid.', category: 'Users', valueType: 'NUMBER', defaultValue: 120, validationRule: { min: 30, max: 900 } },

  // --- Audit & Compliance (Module 15) --------------------------------------
  { key: 'audit.retention.detailedMonths', label: 'Detailed audit retention (months)', category: 'Audit', valueType: 'NUMBER', defaultValue: 24, validationRule: { min: 1, max: 120 } },
  { key: 'audit.retention.archiveAfterMonths', label: 'Archive audit logs after (months, 0 = never)', category: 'Audit', valueType: 'NUMBER', defaultValue: 0, validationRule: { min: 0, max: 240 } },
];
