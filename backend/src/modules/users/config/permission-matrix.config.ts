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
  module: string;
  description: string;
  allowedRoles: SystemRole[];
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
  { key: 'dashboard.view', module: 'Dashboard', description: 'View dashboard', allowedRoles: [A, PH, IM, CA, AC, AU] },
  { key: 'dashboard.profit.view', module: 'Dashboard', description: 'See profit/cost figures', allowedRoles: [A, AC, AU] },

  // Medicines (Module 2)
  { key: 'medicines.view', module: 'Medicines', description: 'View medicine catalog', allowedRoles: [A, PH, IM, CA, AC, AU] },
  { key: 'medicines.manage', module: 'Medicines', description: 'Create/edit/delete medicines', allowedRoles: [A, PH, IM] },

  // Purchases (Module 3)
  { key: 'purchases.view', module: 'Purchases', description: 'View purchase orders', allowedRoles: [A, PH, IM, AC, AU] },
  { key: 'purchases.manage', module: 'Purchases', description: 'Create/approve POs, receive GRNs', allowedRoles: [A, IM] },
  { key: 'purchases.payments', module: 'Purchases', description: 'Record supplier payments', allowedRoles: [A, AC] },

  // Sales / POS (Module 4)
  { key: 'sales.sell', module: 'Sales', description: 'Operate POS / finalize sales', allowedRoles: [A, PH, CA] },
  { key: 'sales.view', module: 'Sales', description: 'View sales history', allowedRoles: [A, PH, CA, AC, AU] },
  { key: 'sales.void', module: 'Sales', description: 'Void a sale', allowedRoles: [A, PH] },
  { key: 'sales.discount.approve', module: 'Sales', description: 'Approve over-limit discount (step-up)', allowedRoles: [A, PH] },

  // Inventory (Module 5)
  { key: 'inventory.view', module: 'Inventory', description: 'View stock', allowedRoles: [A, PH, IM, CA, AC, AU] },
  { key: 'inventory.valuation.view', module: 'Inventory', description: 'See stock valuation/cost', allowedRoles: [A, IM, AC, AU] },
  { key: 'inventory.manage', module: 'Inventory', description: 'Transfers / reconciliation', allowedRoles: [A, IM] },

  // Batches (Module 6)
  { key: 'batches.view', module: 'Batches', description: 'View batches/expiry', allowedRoles: [A, PH, IM, AU] },
  { key: 'batches.writeoff', module: 'Batches', description: 'Write off expired stock (step-up)', allowedRoles: [A, IM] },
  { key: 'batches.recall', module: 'Batches', description: 'Flag/resolve recalls', allowedRoles: [A, PH] },

  // Suppliers (Module 7)
  { key: 'suppliers.view', module: 'Suppliers', description: 'View suppliers', allowedRoles: [A, PH, IM, AC, AU] },
  { key: 'suppliers.manage', module: 'Suppliers', description: 'Create/edit/archive suppliers', allowedRoles: [A, IM] },
  { key: 'suppliers.payables.view', module: 'Suppliers', description: 'View outstanding payables', allowedRoles: [A, AC, AU] },

  // Customers (Module 8)
  { key: 'customers.view', module: 'Customers', description: 'View customers', allowedRoles: [A, PH, AC, AU] },
  { key: 'customers.manage', module: 'Customers', description: 'Create/edit customers', allowedRoles: [A, PH] },
  { key: 'customers.health.view', module: 'Customers', description: 'View patient health profile', allowedRoles: [A, PH] },
  { key: 'customers.merge', module: 'Customers', description: 'Merge duplicate customers', allowedRoles: [A, PH] },

  // Users & Roles (Module 16)
  { key: 'users.manage', module: 'Users', description: 'Invite/manage users, roles, branch access', allowedRoles: [A] },
  { key: 'users.permission_matrix.view', module: 'Users', description: 'View the permission matrix', allowedRoles: [SA] },
  { key: 'users.stepup.verify', module: 'Users', description: 'Provide step-up verification', allowedRoles: [A, PH] },
];

const KEYS = new Set(PERMISSION_MATRIX.map((p) => p.key));
export function isKnownPermissionKey(key: string): boolean {
  return KEYS.has(key);
}
