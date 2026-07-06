import { SystemRole, UserStatus } from '../api/users.api';

const STATUS_CLS: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  PENDING_ACTIVATION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  SUSPENDED: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  DEACTIVATED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};
const STATUS_LABEL: Record<UserStatus, string> = { ACTIVE: 'Active', PENDING_ACTIVATION: 'Pending', SUSPENDED: 'Suspended', DEACTIVATED: 'Deactivated' };

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>;
}

const ROLE_LABEL: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', PHARMACIST: 'Pharmacist', INVENTORY_MANAGER: 'Inventory Mgr', CASHIER: 'Cashier', ACCOUNTANT: 'Accountant', AUDITOR: 'Auditor',
};

export function RoleBadges({ roles }: { roles: SystemRole[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => <span key={r} className="inline-block rounded-full bg-brand-50 dark:bg-brand-700/20 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400">{ROLE_LABEL[r] ?? r}</span>)}
    </span>
  );
}

export { ROLE_LABEL };
