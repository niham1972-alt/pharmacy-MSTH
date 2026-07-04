import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDarkMode } from '../hooks/DarkModeContext';
import { BranchSelector } from '../../features/dashboard/components/BranchSelector';

// `to: null` marks modules not built yet (rendered disabled). `hideForRoles`
// hides an item entirely for those roles (e.g. Purchases is off-limits to cashier).
const NAV_ITEMS: Array<{ label: string; to: string | null; hideForRoles?: string[] }> = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Medicines', to: '/medicines' },
  { label: 'Sales / POS', to: '/pos', hideForRoles: ['inventory_manager', 'accountant', 'auditor'] },
  { label: 'Sales History', to: '/sales', hideForRoles: ['inventory_manager'] },
  { label: 'Inventory', to: null },
  { label: 'Purchases', to: '/purchases', hideForRoles: ['cashier'] },
  { label: 'Reports', to: null },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [isDark, toggleDark] = useDarkMode();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">
        Skip to content
      </a>
      <div className="flex">
        <nav
          aria-label="Primary navigation"
          className="no-print hidden md:flex md:w-56 md:flex-col md:border-r md:border-gray-200 md:dark:border-gray-800 md:min-h-screen p-4"
        >
          <div className="mb-6 text-lg font-bold text-brand-700 dark:text-brand-500">Pharmacy MS</div>
          <ul className="space-y-1">
            {NAV_ITEMS.filter((item) => !(item.hideForRoles && user && item.hideForRoles.includes(user.role))).map((item) =>
              item.to ? (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm ${
                        isActive
                          ? 'bg-brand-50 dark:bg-brand-700/20 text-brand-700 dark:text-brand-500 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ) : (
                <li key={item.label}>
                  <span className="block rounded-md px-3 py-2 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed" title="Coming in a later module">
                    {item.label}
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex-1">
          <header className="no-print flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <BranchSelector />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleDark}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm"
              >
                {isDark ? '☀️ Light' : '🌙 Dark'}
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {user?.email} · <span className="font-medium">{user?.role}</span>
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm"
              >
                Sign out
              </button>
            </div>
          </header>

          <main id="main-content" className="p-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
