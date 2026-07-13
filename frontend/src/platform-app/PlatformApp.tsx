import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ApiClientError } from '../shared/api/client';
import { supabase } from '../shared/auth/supabaseClient';
import { platformApi } from './api/platform.api';
import { PlatformShell } from './components/PlatformShell';
import { PlatformLoginPage } from './PlatformLoginPage';
import { PlatformDashboardPage } from './pages/PlatformDashboardPage';
import { TenantsListPage } from './pages/TenantsListPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { OnboardTenantPage } from './pages/OnboardTenantPage';
import { SubscriptionPlansPage } from './pages/SubscriptionPlansPage';
import { PlatformStaffPage } from './pages/PlatformStaffPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage';
import { PlatformAuditLogPage } from './pages/PlatformAuditLogPage';

function NotPlatformStaff() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-slate-200">
      <h1 className="text-xl font-semibold text-white">This account isn't platform staff</h1>
      <p className="max-w-md text-sm text-slate-400">
        You're signed in, but this account is a pharmacy user — not a vendor platform-staff account. The platform console is a separate, internal tool.
      </p>
      <button onClick={() => void supabase.auth.signOut().then(() => (window.location.href = '/platform-admin/login'))} className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
        Sign out
      </button>
    </div>
  );
}

/** The entire platform-app, mounted at /platform-admin/*. Its own auth gate: it
 *  requires a valid PlatformStaffUser (verified via GET /platform/me), entirely
 *  separate from the tenant-facing app's auth. */
export function PlatformApp() {
  const me = useQuery({ queryKey: ['platform', 'me'], queryFn: async () => (await platformApi.me()).data, retry: false });

  // The login route is always reachable.
  const loginRoute = <Route path="login" element={<PlatformLoginPage />} />;

  if (me.isLoading) {
    return (
      <Routes>
        {loginRoute}
        <Route path="*" element={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">Loading platform console…</div>} />
      </Routes>
    );
  }

  if (me.isError) {
    const code = me.error instanceof ApiClientError ? me.error.code : '';
    // A logged-in non-staff user is rejected clearly; anyone else goes to login.
    const gate = code === 'NOT_PLATFORM_STAFF' || code === 'PLATFORM_STAFF_INACTIVE' ? <NotPlatformStaff /> : <Navigate to="/platform-admin/login" replace />;
    return (
      <Routes>
        {loginRoute}
        <Route path="*" element={gate} />
      </Routes>
    );
  }

  const staff = me.data!;
  return (
    <Routes>
      {loginRoute}
      <Route
        path="*"
        element={
          <PlatformShell me={staff}>
            <Routes>
              <Route index element={<PlatformDashboardPage />} />
              <Route path="tenants" element={<TenantsListPage />} />
              <Route path="tenants/new" element={<OnboardTenantPage />} />
              <Route path="tenants/:id" element={<TenantDetailPage />} />
              <Route path="plans" element={<SubscriptionPlansPage />} />
              <Route path="staff" element={<PlatformStaffPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="feature-flags" element={<FeatureFlagsPage />} />
              <Route path="audit" element={<PlatformAuditLogPage />} />
              <Route path="*" element={<Navigate to="/platform-admin" replace />} />
            </Routes>
          </PlatformShell>
        }
      />
    </Routes>
  );
}
