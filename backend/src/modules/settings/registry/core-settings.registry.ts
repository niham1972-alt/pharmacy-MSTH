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

  // --- Customers (Module 8) ------------------------------------------------
  { key: 'customers.phone.regex', label: 'Phone number validation (regex)', category: 'Customers', valueType: 'STRING', defaultValue: '^[+\\d][\\d\\s\\-()]{4,24}$', validationRule: { maxLength: 200 } },

  // --- Users & Access (Module 16) ------------------------------------------
  { key: 'users.stepUp.windowSeconds', label: 'Step-up verification window (s)', description: 'How long an elevated-action challenge stays valid.', category: 'Users', valueType: 'NUMBER', defaultValue: 120, validationRule: { min: 30, max: 900 } },

  // --- Audit & Compliance (Module 15) --------------------------------------
  { key: 'audit.retention.detailedMonths', label: 'Detailed audit retention (months)', category: 'Audit', valueType: 'NUMBER', defaultValue: 24, validationRule: { min: 1, max: 120 } },
  { key: 'audit.retention.archiveAfterMonths', label: 'Archive audit logs after (months, 0 = never)', category: 'Audit', valueType: 'NUMBER', defaultValue: 0, validationRule: { min: 0, max: 240 } },
];
