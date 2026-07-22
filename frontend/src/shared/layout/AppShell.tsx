import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDarkMode } from '../hooks/DarkModeContext';
import { BranchSelector } from '../../features/dashboard/components/BranchSelector';
import { ImpersonationBanner } from '../components/ImpersonationBanner';

// `to: null` marks modules not built yet (rendered disabled). `hideForRoles`
// hides an item entirely for those roles (e.g. Purchases is off-limits to cashier).
type NavItem = { label: string; to: string | null; hideForRoles?: string[] };
type NavGroup = { label: string; items: NavItem[] };

// Standalone high-frequency links sit directly on the bar; everything else is
// grouped into dropdowns so 12+ destinations don't overcrowd a single row.
const DASHBOARD: NavItem = { label: 'Dashboard', to: '/dashboard' };
const MEDICINES: NavItem = { label: 'Medicines', to: '/medicines' };
const GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Sales / POS', to: '/pos', hideForRoles: ['inventory_manager', 'accountant', 'auditor'] },
      { label: 'Sales History', to: '/sales', hideForRoles: ['inventory_manager'] },
      { label: 'Sales Returns', to: '/sales-returns', hideForRoles: ['inventory_manager'] },
      { label: 'Inventory', to: '/inventory' },
      { label: 'Stock Adjustments', to: '/stock-adjustments', hideForRoles: ['cashier', 'pharmacist'] },
      { label: 'Batches & Expiry', to: '/batches', hideForRoles: ['cashier', 'accountant'] },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { label: 'Purchases', to: '/purchases', hideForRoles: ['cashier'] },
      { label: 'Purchase Returns', to: '/purchase-returns', hideForRoles: ['cashier', 'pharmacist'] },
      { label: 'Suppliers', to: '/suppliers', hideForRoles: ['cashier'] },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Customers', to: '/customers', hideForRoles: ['cashier', 'inventory_manager'] },
      { label: 'Users & Roles', to: '/users', hideForRoles: ['pharmacist', 'inventory_manager', 'cashier', 'accountant', 'auditor'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Expenses', to: '/expenses', hideForRoles: ['pharmacist', 'inventory_manager', 'cashier'] },
      { label: 'Consolidated Payables', to: '/expenses/payables', hideForRoles: ['pharmacist', 'inventory_manager', 'cashier'] },
      { label: 'Reports', to: '/reports', hideForRoles: ['cashier'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Audit Log', to: '/audit-logs', hideForRoles: ['pharmacist', 'inventory_manager', 'cashier', 'accountant'] },
      { label: 'Settings', to: '/settings', hideForRoles: ['pharmacist', 'cashier', 'accountant'] },
    ],
  },
];

const visibleFor = (items: NavItem[], role?: string) => items.filter((i) => !(i.hideForRoles && role && i.hideForRoles.includes(role)));

const linkBase = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors';
const linkIdle = 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';
const linkActive = 'bg-brand-50 dark:bg-brand-700/25 text-brand-700 dark:text-brand-300';

/** A single top-level link (Dashboard / Medicines). */
function TopLink({ item }: { item: NavItem }) {
  if (!item.to) return null;
  return (
    <NavLink to={item.to} className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
      {item.label}
    </NavLink>
  );
}

/** A click-to-open dropdown group; trigger is highlighted when a child route is active. */
function NavDropdown({ group, role, open, onToggle, onClose }: { group: NavGroup; role?: string; open: boolean; onToggle: () => void; onClose: () => void }) {
  const location = useLocation();
  const items = visibleFor(group.items, role);
  if (items.length === 0) return null;
  const groupActive = items.some((i) => i.to && location.pathname.startsWith(i.to));

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={`${linkBase} flex items-center gap-1 ${groupActive ? linkActive : linkIdle}`}
      >
        {group.label}
        <svg aria-hidden="true" className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label={group.label} className="absolute left-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 shadow-lg">
          {items.map((item) =>
            item.to ? (
              <NavLink key={item.label} to={item.to} role="menuitem" onClick={onClose} className={({ isActive }) => `block rounded-md px-3 py-1.5 text-sm ${isActive ? linkActive : linkIdle}`}>
                {item.label}
              </NavLink>
            ) : (
              <span key={item.label} role="menuitem" aria-disabled="true" className="block cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-gray-400 dark:text-gray-600" title="Coming in a later module">
                {item.label}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [isDark, toggleDark] = useDarkMode();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  // Close menus on route change, outside click, and Escape.
  useEffect(() => { setOpenMenu(null); setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!openMenu && !mobileOpen) return;
    const onClick = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) { setOpenMenu(null); setMobileOpen(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenMenu(null); setMobileOpen(false); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [openMenu, mobileOpen]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark">
      {/* Mandatory impersonation banner — above everything, on every page. */}
      <ImpersonationBanner />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-white focus:p-2">Skip to content</a>

      <nav ref={navRef} aria-label="Primary navigation" className="no-print sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="mr-2 shrink-0 text-base font-bold tracking-tight text-brand-700 dark:text-brand-400">Pharmacy MS</span>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex">
            <TopLink item={DASHBOARD} />
            <TopLink item={MEDICINES} />
            {GROUPS.map((g) => (
              <NavDropdown key={g.label} group={g} role={user?.role} open={openMenu === g.label} onToggle={() => setOpenMenu((cur) => (cur === g.label ? null : g.label))} onClose={() => setOpenMenu(null)} />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={toggleDark} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded-md p-2 text-base leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <BranchSelector />
              <span className="max-w-[16rem] truncate text-xs text-gray-500 dark:text-gray-400" title={`${user?.email} · ${user?.role}`}>
                {user?.email} · <span className="font-medium text-gray-700 dark:text-gray-300">{user?.role}</span>
              </span>
              <button type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800">
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none"><path d="M13 4v1M13 15v1M8 10h9m0 0-3-3m3 3-3 3M3 4.5A1.5 1.5 0 0 1 4.5 3h5A1.5 1.5 0 0 1 11 4.5v11A1.5 1.5 0 0 1 9.5 17h-5A1.5 1.5 0 0 1 3 15.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            {/* Hamburger (mobile) */}
            <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle navigation menu" aria-expanded={mobileOpen} className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden">
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 lg:hidden">
            <div className="mb-3 flex items-center justify-between gap-2 sm:hidden">
              <BranchSelector />
              <button type="button" onClick={() => void signOut()} className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs">Sign out</button>
            </div>
            <NavLink to="/dashboard" className={({ isActive }) => `block rounded-md px-3 py-1.5 text-sm ${isActive ? linkActive : linkIdle}`}>Dashboard</NavLink>
            <NavLink to="/medicines" className={({ isActive }) => `block rounded-md px-3 py-1.5 text-sm ${isActive ? linkActive : linkIdle}`}>Medicines</NavLink>
            {GROUPS.map((g) => {
              const items = visibleFor(g.items, user?.role);
              if (items.length === 0) return null;
              return (
                <div key={g.label} className="mt-2">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.label}</p>
                  {items.map((item) =>
                    item.to ? (
                      <NavLink key={item.label} to={item.to} className={({ isActive }) => `block rounded-md px-3 py-1.5 text-sm ${isActive ? linkActive : linkIdle}`}>{item.label}</NavLink>
                    ) : (
                      <span key={item.label} className="block cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-gray-400 dark:text-gray-600">{item.label}</span>
                    ),
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <main id="main-content" className="mx-auto max-w-[1600px] p-4">
        {children}
      </main>
    </div>
  );
}
