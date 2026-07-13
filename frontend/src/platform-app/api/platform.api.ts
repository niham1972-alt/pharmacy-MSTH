import { platformClient } from '../../shared/api/client';

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'ARCHIVED';
export type PlatformRole = 'SUPER_ADMIN' | 'SUPPORT' | 'BILLING_OPS';

export interface PlatformMe { id: string; name: string; email: string; role: PlatformRole }

export interface DashboardSummary {
  totalTenants: number; activeTenants: number; trialTenants: number; pastDueTenants: number;
  suspendedTenants: number; archivedTenants: number; newSignups30d: number; trialToPaidRate: number;
  byBillingStatus: Record<string, number>; mrr: number; platformTransactionCount: number; platformTransactionVolume: number;
  tenantsNeedingAttention: Array<{ id: string; businessName: string; status: string; billingStatus: string }>;
  expiringTrials: Array<{ id: string; businessName: string; trialEndsAt: string | null }>;
  generatedAt: string;
}

export interface TenantRow {
  id: string; businessName: string; contactEmail: string; status: TenantStatus; billingStatus: string;
  planName: string | null; userCount: number; trialEndsAt: string | null; nextRenewalDate: string | null; createdAt: string;
}

export interface TenantDetail {
  id: string; businessName: string; contactEmail: string; contactPhone: string | null; status: TenantStatus;
  subscriptionPlanId: string | null; billingStatus: string; trialStartedAt: string | null; trialEndsAt: string | null;
  nextRenewalDate: string | null; suspendedAt: string | null; suspendedReason: string | null; archivedAt: string | null;
  archivedReason: string | null; notes: string | null; createdAt: string;
  plan: { id: string; name: string; priceAmount: number; billingInterval: string } | null;
  userCount: number; hasActiveAdmin: boolean; impersonationCount: number;
}

export interface Plan {
  id: string; name: string; priceAmount: number; billingInterval: string;
  maxUsers: number | null; maxBranches: number | null; maxMonthlyTransactions: number | null;
  includedFeatures: Record<string, unknown> | null; isActive: boolean;
}

export interface StaffUser { id: string; authUserId: string; name: string; email: string; role: PlatformRole; status: string; createdAt: string }
export interface Announcement { id: string; title: string; message: string; severity: string; startsAt: string; endsAt: string | null; isActive: boolean }
export interface FeatureFlag { id: string; key: string; description: string | null; isGloballyEnabled: boolean; enabledForPharmacyIds: string[] }
export interface PlatformAuditRow { id: string; platformStaffEmail: string; action: string; entityType: string; entityId: string | null; targetPharmacyId: string | null; metadata: Record<string, unknown> | null; createdAt: string }
export interface ImpersonationHistoryRow { id: string; platformStaffEmail: string; targetPharmacyId: string; targetUserId: string; targetUserEmail: string | null; reason: string; startedAt: string; endedAt: string | null; endedReason: string | null; expiresAt: string; active: boolean }
export interface Usage { userCount: number; branchCount: number; medicineCount: number; transactionCount: number; transactionVolume: number; lastActivityAt: string | null }
export interface StartImpersonationResult { sessionId: string; token: string; expiresAt: string; pharmacy: { id: string; businessName: string }; targetUser: { id: string; name: string; email: string; role: string } }

function qs(p: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const platformApi = {
  me: () => platformClient.get<PlatformMe>('/platform/me'),
  dashboard: () => platformClient.get<DashboardSummary>('/platform/dashboard/summary'),

  tenants: (params: Record<string, string | undefined>) => platformClient.get<TenantRow[]>(`/platform/tenants${qs(params)}`),
  tenant: (id: string) => platformClient.get<TenantDetail>(`/platform/tenants/${id}`),
  tenantUsage: (id: string) => platformClient.get<Usage>(`/platform/tenants/${id}/usage`),
  tenantUsers: (id: string) => platformClient.get<Array<{ id: string; name: string; email: string; status: string; role: string | null }>>(`/platform/tenants/${id}/users`),
  onboard: (body: unknown) => platformClient.post<TenantDetail & { initialBranchId: string; adminInvite: unknown }>('/platform/tenants', body),
  updateTenant: (id: string, body: unknown) => platformClient.put<TenantDetail>(`/platform/tenants/${id}`, body),
  suspend: (id: string, reason: string) => platformClient.post(`/platform/tenants/${id}/suspend`, { reason }),
  reactivate: (id: string) => platformClient.post(`/platform/tenants/${id}/reactivate`),
  archive: (id: string, reason: string) => platformClient.post(`/platform/tenants/${id}/archive`, { reason }),
  changePlan: (id: string, subscriptionPlanId: string) => platformClient.post(`/platform/tenants/${id}/change-plan`, { subscriptionPlanId }),

  plans: () => platformClient.get<Plan[]>('/platform/subscription-plans'),
  createPlan: (body: unknown) => platformClient.post<Plan>('/platform/subscription-plans', body),
  updatePlan: (id: string, body: unknown) => platformClient.put<Plan>(`/platform/subscription-plans/${id}`, body),
  retirePlan: (id: string) => platformClient.delete(`/platform/subscription-plans/${id}`),

  startImpersonation: (body: { targetPharmacyId: string; targetUserId: string; reason: string }) => platformClient.post<StartImpersonationResult>('/platform/impersonation/start', body),
  impersonationHistory: () => platformClient.get<ImpersonationHistoryRow[]>('/platform/impersonation/history'),

  staff: () => platformClient.get<StaffUser[]>('/platform/staff-users'),
  createStaff: (body: unknown) => platformClient.post<StaffUser>('/platform/staff-users', body),
  updateStaff: (id: string, body: unknown) => platformClient.put<StaffUser>(`/platform/staff-users/${id}`, body),

  announcements: () => platformClient.get<Announcement[]>('/platform/announcements'),
  createAnnouncement: (body: unknown) => platformClient.post<Announcement>('/platform/announcements', body),
  removeAnnouncement: (id: string) => platformClient.delete(`/platform/announcements/${id}`),

  flags: () => platformClient.get<FeatureFlag[]>('/platform/feature-flags'),
  createFlag: (body: unknown) => platformClient.post<FeatureFlag>('/platform/feature-flags', body),
  updateFlag: (id: string, body: unknown) => platformClient.put<FeatureFlag>(`/platform/feature-flags/${id}`, body),
  removeFlag: (id: string) => platformClient.delete(`/platform/feature-flags/${id}`),

  auditLog: () => platformClient.get<PlatformAuditRow[]>('/platform/audit-log'),
};
