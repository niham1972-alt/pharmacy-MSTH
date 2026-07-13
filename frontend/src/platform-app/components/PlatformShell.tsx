import { ReactNode, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../shared/auth/supabaseClient';
import { PlatformMe } from '../api/platform.api';

/** Small header indicator that an impersonation session is active (started from
 *  this browser). Reads the marker the ImpersonateModal set; auto-hides at expiry. */
function ImpersonationIndicator() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  let marker: { expiresAt: string; pharmacyName: string; userName: string } | null = null;
  try { marker = JSON.parse(localStorage.getItem('pms_active_impersonation') || 'null'); } catch { marker = null; }
  if (!marker) return null;
  const remaining = new Date(marker.expiresAt).getTime() - Date.now();
  if (remaining <= 0) { localStorage.removeItem('pms_active_impersonation'); return null; }
  void tick;
  const s = Math.floor(remaining / 1000);
  return (
    <span className="hidden items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-black lg:inline-flex" title={`Impersonating ${marker.pharmacyName} — ${marker.userName}`}>
      👁 Impersonating {marker.pharmacyName} · {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

const NAV = [
  ['/platform-admin', 'Dashboard', true],
  ['/platform-admin/tenants', 'Tenants', false],
  ['/platform-admin/plans', 'Plans', false],
  ['/platform-admin/staff', 'Staff', false],
  ['/platform-admin/announcements', 'Announcements', false],
  ['/platform-admin/feature-flags', 'Feature Flags', false],
  ['/platform-admin/audit', 'Audit Log', false],
] as const;

/**
 * Platform-app chrome — DELIBERATELY visually distinct from the pharmacy-facing
 * app (dark indigo bar, "PLATFORM ADMIN" wordmark) so staff always know they're
 * in the internal, cross-tenant tool and never confuse it with a tenant's view.
 */
export function PlatformShell({ me, children }: { me: PlatformMe; children: ReactNode }) {
  const link = (to: string, label: string, end: boolean) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-500 text-white' : 'text-indigo-200 hover:bg-indigo-800/60'}`
      }
    >
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-indigo-800 bg-indigo-950 text-white">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-xs font-bold tracking-wider">PLATFORM</span>
            <span className="text-sm font-semibold tracking-tight">Admin Console</span>
          </div>
          <nav className="ml-4 hidden items-center gap-1 md:flex">{NAV.map(([to, label, end]) => link(to, label, end))}</nav>
          <div className="ml-auto flex items-center gap-3">
            <ImpersonationIndicator />
            <span className="hidden text-xs text-indigo-200 sm:inline" title={me.email}>
              {me.name} · <span className="rounded bg-indigo-800 px-1.5 py-0.5 font-medium">{me.role.toLowerCase()}</span>
            </span>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut().then(() => (window.location.href = '/platform-admin/login'))}
              className="rounded-md border border-indigo-700 px-2 py-1 text-xs text-indigo-100 hover:bg-indigo-800"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex flex-wrap gap-1 px-3 pb-2 md:hidden">{NAV.map(([to, label, end]) => link(to, label, end))}</nav>
      </header>
      <main className="mx-auto max-w-[1500px] p-4">{children}</main>
    </div>
  );
}
