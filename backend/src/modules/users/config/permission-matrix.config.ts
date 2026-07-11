import { SystemRole } from '@prisma/client';
import { PharmacyRole } from '../../../common/interfaces/jwt-payload.interface';

/**
 * THE single, centrally-maintained source of the full role → permission mapping.
 * Every permission referenced across the built modules lives here. This is what
 * `super_admin`'s Permission Matrix view renders and what
 * `AuthorizationService.hasPermission()` checks against.
 *
 * NOTE: `SystemRole` (UPPERCASE, the DB enum) is the canonical role vocabulary;
 * `PharmacyRole` (lowercase) is the JWT-claim form every module's @Roles() guard
 * already uses. `ROLE_CLAIM` / `ROLE_ENUM` bridge the two — changing role naming
 * happens in exactly one place.
 */

export const ROLE_CLAIM: Record<SystemRole, PharmacyRole> = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PHARMACIST: 'pharmacist',
  INVENTORY_MANAGER: 'inventory_manager',
  CASHIER: 'cashier',
  ACCOUNTANT: 'accountant',
  AUDITOR: 'auditor',
};

export const ROLE_ENUM: Record<PharmacyRole, SystemRole> = Object.fromEntries(
  Object.entries(ROLE_CLAIM).map(([enumRole, claim]) => [claim, enumRole as SystemRole]),
) as Record<PharmacyRole, SystemRole>;

export const ALL_ROLES: SystemRole[] = Object.keys(ROLE_CLAIM) as SystemRole[];

export interface PermissionDef {
  key: string;
  label: string; // human-readable, shown in the per-user Permissions editor
  module: string;
  description: string;
  allowedRoles: SystemRole[]; // roles that include this permission BY DEFAULT (super_admin always implied)
}

const A = 'ADMIN' as const;
const SA = 'SUPER_ADMIN' as const;
const PH = 'PHARMACIST' as const;
const IM = 'INVENTORY_MANAGER' as const;
const CA = 'CASHIER' as const;
const AC = 'ACCOUNTANT' as const;
const AU = 'AUDITOR' as const;

/**
 * Reconciled against the actual @Roles() decorators built in Modules 1–8.
 * super_admin is implicitly allowed everywhere (handled in hasPermission), so it
 * is omitted from most rows for brevity but included where it is the sole role.
 */
export const PERMISSION_MATRIX: PermissionDef[] = [
  // Dashboard (Module 1)
  { key: 'dashboard.view', label: 'View dashboard', module: 'Dashboard', description: 'Open the dashboard landing screen', allowedRoles: [A, PH, IM, CA, AC, AU] },
  { key: 'dashboard.profit.view', label: 'See profit figures', module: 'Dashboard', description: 'See profit/cost KPIs on the dashboard', allowedRoles: [A, AC, AU] },

  // Medicines (Module 2)
  { key: 'medicines.view', label: 'View medicines', module: 'Medicines', description: 'Browse the medicine catalog', allowedRoles: [A, PH, IM, CA, AC, AU] },
  { key: 'medicines.manage', label: 'Manage medicines', module: 'Medicines', description: 'Create / edit / delete medicines', allowedRoles: [A, PH, IM] },
  { key: 'medicines.pricing.edit', label: 'Edit pricing', module: 'Medicines', description: 'Change a medicine’s selling price', allowedRoles: [A, PH, IM] },

  // Purchases (Module 3)
  { key: 'purchases.view', label: 'View purchases', module: 'Purchases', description: 'View purchase orders', allowedRoles: [A, PH, IM, AC, AU] },
  { key: 'purchases.manage', label: 'Manage purchases', module: 'Purchases', description: 'Create / approve POs, receive GRNs', allowedRoles: [A, IM] },
  { key: 'purchases.payments', label: 'Record supplier payments', module: 'Purchases', description: 'Record payments against suppliers', allowedRoles: [A, AC] },

  // Sales / POS (Module 4)
  { key: 'sales.sell', label: 'Access POS / sell items', module: 'Sales', description: 'Operate the POS and finalize sales', allowedRoles: [A, PH, CA] },
  { key: 'sales.view', label: 'View sales history', module: 'Sales', description: 'View past sales', allowedRoles: [A, PH, CA, AC, AU] },
  { key: 'sales.void', label: 'Void a sale', module: 'Sales', description: 'Reverse a completed sale (same-day void)', allowedRoles: [A, PH] },
  { key: 'sales.discount.approve', label: 'Approve over-limit discount', module: 'Sales', description: 'Authorize a discount above the auto-approved cap', allowedRoles: [A, PH] },

  // Sales Returns (Module 10)
  { key: 'returns.process', label: 'Process returns', module: 'Sales Returns', description: 'Create a sales return / refund', allowedRoles: [A, PH, CA] },
  { key: 'returns.view', label: 'View returns', module: 'Sales Returns', description: 'View return history', allowedRoles: [A, PH, CA, AC, AU] },
  { key: 'returns.reports.view', label: 'View return-rate reports', module: 'Sales Returns', description: 'See return-rate by medicine/reason', allowedRoles: [A, PH, AU] },
  { key: 'storecredit.manage', label: 'Manage store credit', module: 'Sales Returns', description: 'View/adjust customer store-credit balances', allowedRoles: [A, PH, AC] },

  // Inventory (Module 5)
  { key: 'inventory.view', label: 'View stock', module: 'Inventory', description: 'View on-hand stock', allowedRoles: [A, PH, IM, CA, AC, AU] },
  { key: 'inventory.valuation.view', label: 'View stock valuation', module: 'Inventory', description: 'See stock valuation / cost figures', allowedRoles: [A, IM, AC, AU] },
  { key: 'inventory.manage', label: 'Manage inventory', module: 'Inventory', description: 'Transfers / reconciliation', allowedRoles: [A, IM] },

  // Batches (Module 6)
  { key: 'batches.view', label: 'View batches', module: 'Batches', description: 'View batches & expiry', allowedRoles: [A, PH, IM, AU] },
  { key: 'batches.writeoff', label: 'Write off stock', module: 'Batches', description: 'Write off expired/damaged stock', allowedRoles: [A, IM] },
  { key: 'batches.recall', label: 'Manage recalls', module: 'Batches', description: 'Flag / resolve batch recalls', allowedRoles: [A, PH] },

  // Suppliers (Module 7)
  { key: 'suppliers.view', label: 'View suppliers', module: 'Suppliers', description: 'View suppliers', allowedRoles: [A, PH, IM, AC, AU] },
  { key: 'suppliers.manage', label: 'Manage suppliers', module: 'Suppliers', description: 'Create / edit / archive suppliers', allowedRoles: [A, IM] },
  { key: 'suppliers.payables.view', label: 'View payables', module: 'Suppliers', description: 'View outstanding supplier payables', allowedRoles: [A, AC, AU] },

  // Customers (Module 8)
  { key: 'customers.view', label: 'View customers', module: 'Customers', description: 'View customers', allowedRoles: [A, PH, AC, AU] },
  { key: 'customers.manage', label: 'Manage customers', module: 'Customers', description: 'Create / edit customers', allowedRoles: [A, PH] },
  { key: 'customers.health.view', label: 'View patient health info', module: 'Customers', description: 'View the protected patient health profile', allowedRoles: [A, PH] },
  { key: 'customers.merge', label: 'Merge customers', module: 'Customers', description: 'Merge duplicate customer records', allowedRoles: [A, PH] },

  // Reports (Module 14 — planned)
  { key: 'reports.view', label: 'View reports', module: 'Reports', description: 'Access the reports area', allowedRoles: [A, AC, AU] },
  { key: 'reports.profit_loss.view', label: 'View P&L report', module: 'Reports', description: 'See the profit & loss report', allowedRoles: [A, AC, AU] },

  // Settings (Module 18)
  { key: 'settings.view', label: 'View settings', module: 'Settings', description: 'View system configuration', allowedRoles: [A, IM, AU] },
  { key: 'settings.manage', label: 'Manage settings', module: 'Settings', description: 'Change system configuration', allowedRoles: [A] },

  // Audit Log (Module 15)
  { key: 'audit.view', label: 'View audit log', module: 'Audit Log', description: 'Read the system audit trail', allowedRoles: [A, AU] },

  // Users & Roles (Module 16)
  { key: 'users.manage', label: 'Manage users & roles', module: 'Users', description: 'Invite/manage users, roles, branch access, permissions', allowedRoles: [A] },
  { key: 'users.permission_matrix.view', label: 'View permission matrix', module: 'Users', description: 'View the global role→permission matrix', allowedRoles: [SA] },
  { key: 'users.stepup.verify', label: 'Provide step-up approval', module: 'Users', description: 'Authorize another user’s elevated action', allowedRoles: [A, PH] },
];

const BY_KEY = new Map(PERMISSION_MATRIX.map((p) => [p.key, p]));
export function isKnownPermissionKey(key: string): boolean {
  return BY_KEY.has(key);
}
export function permissionByKey(key: string): PermissionDef | undefined {
  return BY_KEY.get(key);
}
export function allPermissionKeys(): string[] {
  return PERMISSION_MATRIX.map((p) => p.key);
}
/** Keys a set of roles includes BY DEFAULT (super_admin ⇒ everything). */
export function permissionsForRoles(roles: SystemRole[]): Set<string> {
  if (roles.includes('SUPER_ADMIN')) return new Set(allPermissionKeys());
  const out = new Set<string>();
  for (const p of PERMISSION_MATRIX) if (p.allowedRoles.some((r) => roles.includes(r))) out.add(p.key);
  return out;
}
