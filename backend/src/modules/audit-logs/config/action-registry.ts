import { AuditSeverity } from '@prisma/client';

/**
 * THE centrally-maintained registry of every audit action emitted across the
 * system. Powers human-readable labels + the action-type filter dropdown in the
 * UI, and provides each action's default severity (a caller may override per
 * record() call). Naming convention: MODULE_ENTITY_VERB (e.g. MEDICINE_PRICE_
 * CHANGED, SALE_VOIDED, BATCH_RECALLED). As Modules 9–14/17–18 land, register
 * their actions here — keep this in step with what modules actually emit.
 */
export interface ActionDef {
  actionKey: string;
  label: string;
  module: string;
  defaultSeverity: AuditSeverity;
}

export const ACTION_REGISTRY: ActionDef[] = [
  // Module 1 — Dashboard
  { actionKey: 'ALERT_ACKNOWLEDGED', label: 'Alert acknowledged', module: 'Dashboard', defaultSeverity: 'ROUTINE' },

  // Module 2 — Medicines
  { actionKey: 'MEDICINE_CREATED', label: 'Medicine created', module: 'Medicines', defaultSeverity: 'ROUTINE' },
  { actionKey: 'MEDICINE_UPDATED', label: 'Medicine updated', module: 'Medicines', defaultSeverity: 'ROUTINE' },
  { actionKey: 'MEDICINE_PRICE_CHANGED', label: 'Medicine price changed', module: 'Medicines', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'MEDICINE_STATUS_CHANGED', label: 'Medicine status changed', module: 'Medicines', defaultSeverity: 'ROUTINE' },
  { actionKey: 'MEDICINE_DELETED', label: 'Medicine deleted', module: 'Medicines', defaultSeverity: 'SENSITIVE' },

  // Module 3 — Purchases
  { actionKey: 'PURCHASE_ORDER_CREATED', label: 'Purchase order created', module: 'Purchases', defaultSeverity: 'ROUTINE' },
  { actionKey: 'PURCHASE_ORDER_APPROVED', label: 'Purchase order approved', module: 'Purchases', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'PURCHASE_ORDER_REJECTED', label: 'Purchase order rejected', module: 'Purchases', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'GRN_CREATED', label: 'Goods received', module: 'Purchases', defaultSeverity: 'ROUTINE' },
  { actionKey: 'GRN_VARIANCE_ACKNOWLEDGED', label: 'GRN variance acknowledged', module: 'Purchases', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'EXPIRY_OVERRIDE_USED', label: 'Expiry override used at receipt', module: 'Purchases', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'PURCHASE_PAYMENT_RECORDED', label: 'Supplier payment recorded', module: 'Purchases', defaultSeverity: 'SENSITIVE' },

  // Module 4 — Sales / POS
  { actionKey: 'SALE_CREATED', label: 'Sale completed', module: 'Sales', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SALE_VOIDED', label: 'Sale voided', module: 'Sales', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'DISCOUNT_APPROVED', label: 'Discount approved', module: 'Sales', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'MANUAL_BATCH_OVERRIDE_USED', label: 'Manual batch override at sale', module: 'Sales', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'COMPLIANCE_RECORD_SUBMITTED', label: 'Controlled/prescription dispensing recorded', module: 'Sales', defaultSeverity: 'CRITICAL' },
  { actionKey: 'SALE_PARKED', label: 'Sale parked', module: 'Sales', defaultSeverity: 'ROUTINE' },
  { actionKey: 'PARKED_SALE_DISCARDED', label: 'Parked sale discarded', module: 'Sales', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SESSION_OPENED', label: 'Cashier session opened', module: 'Sales', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SESSION_CLOSED', label: 'Cashier session closed', module: 'Sales', defaultSeverity: 'ROUTINE' },

  // Module 5 — Inventory
  { actionKey: 'STOCK_TRANSFER_CREATED', label: 'Stock transfer created', module: 'Inventory', defaultSeverity: 'ROUTINE' },
  { actionKey: 'STOCK_TRANSFER_RECEIVED', label: 'Stock transfer received', module: 'Inventory', defaultSeverity: 'ROUTINE' },
  { actionKey: 'STOCK_RECONCILED', label: 'Stock reconciliation count', module: 'Inventory', defaultSeverity: 'SENSITIVE' },

  // Module 6 — Batch & Expiry
  { actionKey: 'BATCH_CREATED', label: 'Batch created', module: 'Batches', defaultSeverity: 'ROUTINE' },
  { actionKey: 'BATCH_APPENDED', label: 'Batch quantity appended', module: 'Batches', defaultSeverity: 'ROUTINE' },
  { actionKey: 'BATCH_WRITTEN_OFF', label: 'Batch written off', module: 'Batches', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'BATCH_RECALLED', label: 'Batch recalled', module: 'Batches', defaultSeverity: 'CRITICAL' },
  { actionKey: 'BATCH_RECALL_RESOLVED', label: 'Batch recall resolved', module: 'Batches', defaultSeverity: 'SENSITIVE' },

  // Module 7 — Suppliers
  { actionKey: 'SUPPLIER_CREATED', label: 'Supplier created', module: 'Suppliers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SUPPLIER_UPDATED', label: 'Supplier updated', module: 'Suppliers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'SUPPLIER_ARCHIVED', label: 'Supplier archived', module: 'Suppliers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SUPPLIER_DELETED', label: 'Supplier deleted', module: 'Suppliers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'SUPPLIER_CONTACT_ADDED', label: 'Supplier contact added', module: 'Suppliers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SUPPLIER_CONTACT_UPDATED', label: 'Supplier contact updated', module: 'Suppliers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SUPPLIER_CONTACT_REMOVED', label: 'Supplier contact removed', module: 'Suppliers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SUPPLIER_DOCUMENT_UPLOADED', label: 'Supplier document uploaded', module: 'Suppliers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SUPPLIER_NEGOTIATED_PRICE_SET', label: 'Negotiated price set', module: 'Suppliers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'PREFERRED_SUPPLIER_SET', label: 'Preferred supplier set', module: 'Suppliers', defaultSeverity: 'ROUTINE' },

  // Module 8 — Customers
  { actionKey: 'CUSTOMER_CREATED', label: 'Customer created', module: 'Customers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'CUSTOMER_UPDATED', label: 'Customer updated', module: 'Customers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'CUSTOMER_ARCHIVED', label: 'Customer archived', module: 'Customers', defaultSeverity: 'ROUTINE' },
  { actionKey: 'HEALTH_PROFILE_VIEWED', label: 'Patient health profile viewed', module: 'Customers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'HEALTH_PROFILE_UPDATED', label: 'Patient health profile updated', module: 'Customers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'PRESCRIPTION_UPLOADED', label: 'Prescription uploaded', module: 'Customers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'CUSTOMERS_MERGED', label: 'Customers merged', module: 'Customers', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'CUSTOMER_TAG_ASSIGNED', label: 'Customer tag assigned', module: 'Customers', defaultSeverity: 'ROUTINE' },

  // Module 9 — Purchase Returns
  { actionKey: 'PURCHASE_RETURN_CREATED', label: 'Purchase return to supplier created', module: 'Purchase Returns', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'SETTLEMENT_STATUS_UPDATED', label: 'Purchase return settlement updated', module: 'Purchase Returns', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'QUALITY_RECALL_RETURN_LINKED', label: 'Recall-driven return linked', module: 'Purchase Returns', defaultSeverity: 'CRITICAL' },

  // Module 10 — Sales Returns
  { actionKey: 'RETURN_ELIGIBILITY_CHECKED', label: 'Return eligibility checked', module: 'Sales Returns', defaultSeverity: 'ROUTINE' },
  { actionKey: 'RETURN_CREATED', label: 'Sales return processed', module: 'Sales Returns', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'RETURN_APPROVAL_GRANTED', label: 'Return approval granted', module: 'Sales Returns', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'NON_RETURNABLE_ITEM_REJECTED', label: 'Non-returnable item rejected', module: 'Sales Returns', defaultSeverity: 'ROUTINE' },
  { actionKey: 'RETURN_ITEM_QUARANTINED', label: 'Returned item quarantined (not resaleable)', module: 'Sales Returns', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'STORE_CREDIT_ISSUED', label: 'Store credit issued', module: 'Sales Returns', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'STORE_CREDIT_REDEEMED', label: 'Store credit redeemed', module: 'Sales Returns', defaultSeverity: 'SENSITIVE' },

  // Module 11 — Stock Adjustment (fraud/loss-adjacent → heightened severity)
  { actionKey: 'ADJUSTMENT_CREATED', label: 'Stock adjustment requested', module: 'Stock Adjustment', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'ADJUSTMENT_AUTO_APPROVED', label: 'Stock adjustment auto-approved', module: 'Stock Adjustment', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'ADJUSTMENT_APPROVED', label: 'Stock adjustment approved', module: 'Stock Adjustment', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'ADJUSTMENT_REJECTED', label: 'Stock adjustment rejected', module: 'Stock Adjustment', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'SELF_APPROVAL_ATTEMPT_BLOCKED', label: 'Self-approval attempt blocked', module: 'Stock Adjustment', defaultSeverity: 'CRITICAL' },

  // Module 13 — Expenses (financial record integrity → heightened severity)
  { actionKey: 'EXPENSE_CREATED', label: 'Expense recorded', module: 'Expenses', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'EXPENSE_UPDATED', label: 'Expense updated', module: 'Expenses', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'EXPENSE_APPROVED', label: 'Expense approved', module: 'Expenses', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'EXPENSE_REJECTED', label: 'Expense rejected', module: 'Expenses', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'EXPENSE_PAYMENT_RECORDED', label: 'Expense payment recorded', module: 'Expenses', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'EXPENSE_CATEGORY_CREATED', label: 'Expense category created', module: 'Expenses', defaultSeverity: 'ROUTINE' },
  { actionKey: 'EXPENSE_CATEGORY_UPDATED', label: 'Expense category updated', module: 'Expenses', defaultSeverity: 'ROUTINE' },
  { actionKey: 'EXPENSE_CATEGORY_DELETED', label: 'Expense category deactivated', module: 'Expenses', defaultSeverity: 'ROUTINE' },
  { actionKey: 'RECURRING_TEMPLATE_CREATED', label: 'Recurring expense template created', module: 'Expenses', defaultSeverity: 'ROUTINE' },
  { actionKey: 'RECURRING_TEMPLATE_UPDATED', label: 'Recurring expense template updated', module: 'Expenses', defaultSeverity: 'ROUTINE' },
  { actionKey: 'RECURRING_TEMPLATE_ENDED', label: 'Recurring expense template ended', module: 'Expenses', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'RECURRING_EXPENSE_AUTO_GENERATED', label: 'Recurring expense auto-generated', module: 'Expenses', defaultSeverity: 'ROUTINE' },

  // Module 14 — Reports & Analytics (a large data export is a meaningful event)
  { actionKey: 'REPORT_EXPORTED', label: 'Report exported', module: 'Reports', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'SAVED_REPORT_CONFIGURATION_CREATED', label: 'Saved report configuration created', module: 'Reports', defaultSeverity: 'ROUTINE' },
  { actionKey: 'SAVED_REPORT_CONFIGURATION_DELETED', label: 'Saved report configuration deleted', module: 'Reports', defaultSeverity: 'ROUTINE' },

  // Module 16 — Users & Roles (security-sensitive)
  { actionKey: 'USER_INVITED', label: 'User invited', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'USER_ACTIVATED', label: 'User activated', module: 'Users', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'USER_UPDATED', label: 'User updated', module: 'Users', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'USER_PASSWORD_SET', label: 'User password set/reset', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'ROLE_ASSIGNED', label: 'Role assigned', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'ROLE_REMOVED', label: 'Role removed', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'BRANCH_ACCESS_GRANTED', label: 'Branch access granted', module: 'Users', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'BRANCH_ACCESS_REVOKED', label: 'Branch access revoked', module: 'Users', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'USER_SUSPENDED', label: 'User suspended', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'USER_REACTIVATED', label: 'User reactivated', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'USER_DEACTIVATED', label: 'User deactivated', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'SESSIONS_REVOKED', label: 'User sessions revoked', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'PERMISSION_OVERRIDE_GRANTED', label: 'Permission override granted', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'PERMISSION_OVERRIDE_REMOVED', label: 'Permission override removed', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'STEP_UP_REQUESTED', label: 'Step-up authorization requested', module: 'Users', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'STEP_UP_APPROVED', label: 'Step-up authorization approved', module: 'Users', defaultSeverity: 'CRITICAL' },
  { actionKey: 'STEP_UP_DENIED', label: 'Step-up authorization denied', module: 'Users', defaultSeverity: 'CRITICAL' },

  // Module 15 — Audit Logs (its own write-adjacent actions)
  { actionKey: 'AUDIT_LOG_EXPORTED', label: 'Audit log exported', module: 'Audit Logs', defaultSeverity: 'SENSITIVE' },
  { actionKey: 'INTEGRITY_CHECK_RUN', label: 'Integrity check run', module: 'Audit Logs', defaultSeverity: 'ROUTINE' },
  { actionKey: 'RETENTION_POLICY_UPDATED', label: 'Retention policy updated', module: 'Audit Logs', defaultSeverity: 'SENSITIVE' },
];

const BY_KEY = new Map(ACTION_REGISTRY.map((a) => [a.actionKey, a]));

export function actionLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}
export function defaultSeverityFor(key: string): AuditSeverity {
  return BY_KEY.get(key)?.defaultSeverity ?? 'ROUTINE';
}
export function isRegisteredAction(key: string): boolean {
  return BY_KEY.has(key);
}
/** Action keys whose events are the controlled-substance / prescription dispensing record. */
export const CONTROLLED_SUBSTANCE_ACTIONS = ['COMPLIANCE_RECORD_SUBMITTED', 'BATCH_RECALLED', 'MANUAL_BATCH_OVERRIDE_USED'];
