import { apiClient } from '../../../shared/api/client';

export type UserStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type SystemRole = 'SUPER_ADMIN' | 'ADMIN' | 'PHARMACIST' | 'INVENTORY_MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'AUDITOR';

export const SYSTEM_ROLES: SystemRole[] = ['SUPER_ADMIN', 'ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER', 'CASHIER', 'ACCOUNTANT', 'AUDITOR'];

export interface UserRow {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: SystemRole[];
  branchCount: number;
  lastLoginAt: string | null;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeId: string | null;
  status: UserStatus;
  authUserId: string;
  createdAt: string;
  deactivatedAt: string | null;
  roles: Array<{ role: SystemRole; assignedAt: string }>;
  branchAccess: Array<{ branchId: string; isDefault: boolean }>;
  permissionOverrides: Array<{ permissionKey: string; reason: string | null; expiresAt: string | null }>;
}

export interface MeResponse {
  id: string | null;
  name: string;
  email?: string;
  status: string;
  roles: string[];
  branchAccess: Array<{ branchId: string; isDefault: boolean }>;
  permissionKeys: string[];
}

export interface PermissionMatrix {
  roles: Array<{ role: SystemRole; claim: string }>;
  permissions: Array<{ key: string; module: string; description: string; allowed: Record<SystemRole, boolean> }>;
}

export type PermissionSource = 'role' | 'granted' | 'revoked' | 'none';
export interface EffectivePermissionItem {
  key: string;
  label: string;
  module: string;
  description: string;
  defaultRoles: string[];
  roleHas: boolean; // would the role grant this by default?
  active: boolean; // effective result
  source: PermissionSource; // WHY it's in its current state
  overrideReason: string | null;
}
export interface UserPermissions {
  userId: string;
  roles: string[];
  isSuperAdmin: boolean;
  groups: Array<{ module: string; permissions: EffectivePermissionItem[] }>;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const usersApi = {
  me: () => apiClient.get<MeResponse>('/users/me'),
  recordLogin: () => apiClient.post('/users/login-event'),
  list: (params: Record<string, string | number | undefined | null>) => apiClient.get<UserRow[]>(`/users${qs(params)}`),
  detail: (id: string) => apiClient.get<UserDetail>(`/users/${id}`),
  invite: (body: { name: string; email: string; role: string; branchIds?: string[]; defaultBranchId?: string; phone?: string; password?: string }) => apiClient.post<{ id: string; note: string }>('/users/invite', body),
  setPassword: (id: string, password: string) => apiClient.post<{ id: string; updated: boolean }>(`/users/${id}/set-password`, { password }),
  update: (id: string, body: Record<string, unknown>) => apiClient.put<UserDetail>(`/users/${id}`, body),
  assignRole: (id: string, role: string) => apiClient.post<UserDetail>(`/users/${id}/roles`, { role }),
  removeRole: (id: string, role: string) => apiClient.delete<UserDetail>(`/users/${id}/roles/${role}`),
  grantBranch: (id: string, branchId: string, isDefault?: boolean) => apiClient.post<UserDetail>(`/users/${id}/branch-access`, { branchId, isDefault }),
  revokeBranch: (id: string, branchId: string) => apiClient.delete<UserDetail>(`/users/${id}/branch-access/${branchId}`),
  suspend: (id: string) => apiClient.post<{ status: string }>(`/users/${id}/suspend`),
  reactivate: (id: string) => apiClient.post<{ status: string }>(`/users/${id}/reactivate`),
  deactivate: (id: string) => apiClient.post<{ status: string }>(`/users/${id}/deactivate`),
  revokeSessions: (id: string) => apiClient.post(`/users/${id}/revoke-sessions`),
  loginActivity: (id: string) => apiClient.get<Array<{ id: string; loginAt: string; ipAddress: string | null; userAgent: string | null; success: boolean }>>(`/users/${id}/login-activity`),
  getPermissions: (id: string) => apiClient.get<UserPermissions>(`/users/${id}/permissions`),
  setOverride: (id: string, permissionKey: string, effect: 'GRANT' | 'REVOKE', reason?: string) => apiClient.post<UserPermissions>(`/users/${id}/permission-overrides`, { permissionKey, effect, reason }),
  clearOverride: (id: string, key: string) => apiClient.delete<UserPermissions>(`/users/${id}/permission-overrides/${key}`),
  permissionMatrix: () => apiClient.get<PermissionMatrix>('/users/permission-matrix'),
};

// Step-up (reusable by Module 4/6 elevated actions).
export const stepUpApi = {
  request: (body: { actionType: string; referenceModule: string; referenceId?: string; requiredRole: string }) => apiClient.post<{ id: string; expiresAt: string; requiredRole: string }>('/auth/step-up/request', body),
  verify: (id: string, email: string, password: string) => apiClient.post<{ status: string; verifiedByUserId: string }>(`/auth/step-up/${id}/verify`, { email, password }),
};
