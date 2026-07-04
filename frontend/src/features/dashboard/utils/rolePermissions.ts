import { PharmacyRole } from '../../../shared/auth/AuthContext';

/**
 * Client-side gating mirrors the backend RBAC matrix (spec §2.2) so hooks can
 * skip fetches for widgets a role can't see — this is a UX/perf optimization
 * only. The backend re-validates every request regardless (spec §13/§17);
 * this map must never be the sole enforcement point.
 */
export const WIDGET_ROLE_ACCESS = {
  salesTrend: ['super_admin', 'admin', 'pharmacist', 'cashier', 'accountant', 'auditor'],
  salesTrendProfit: ['super_admin', 'admin', 'accountant', 'auditor'],
  topSelling: ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'accountant', 'auditor'],
  alerts: ['super_admin', 'admin', 'pharmacist', 'inventory_manager', 'auditor'],
  purchaseSnapshot: ['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'],
  cashSummary: ['super_admin', 'admin', 'cashier', 'accountant', 'auditor'],
  todayProfit: ['super_admin', 'admin', 'accountant', 'auditor'],
} as const satisfies Record<string, readonly PharmacyRole[]>;

export function canAccessWidget(role: PharmacyRole | undefined, widget: keyof typeof WIDGET_ROLE_ACCESS): boolean {
  if (!role) return false;
  return (WIDGET_ROLE_ACCESS[widget] as readonly PharmacyRole[]).includes(role);
}

export const QUICK_ACTIONS_BY_ROLE: Partial<Record<PharmacyRole, string[]>> = {
  super_admin: ['newSale', 'newPurchase', 'addMedicine', 'addCustomer'],
  admin: ['newSale', 'newPurchase', 'addMedicine', 'addCustomer'],
  pharmacist: ['newSale', 'addMedicine'],
  inventory_manager: ['newPurchase'],
  cashier: ['newSale'],
};
