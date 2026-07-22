import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { REPORT_CATALOG, REPORT_ROUTE, ReportCategory } from '../../features/reports/types/reports.types';

const CATEGORIES: ReportCategory[] = ['Financial', 'Inventory & Operational', 'Sales & Customer', 'Supplier & Compliance'];

/** Categorized directory of every report the current role can access (spec §5). */
export function ReportsHomePage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const canSee = (roles: string[]) => role === 'super_admin' || roles.includes(role);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500">Deep, historical, exportable reporting across every module. For the real-time snapshot, see the Dashboard.</p>
        </div>
        <Link to="/reports/saved" className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Saved reports</Link>
      </div>

      {CATEGORIES.map((cat) => {
        const items = REPORT_CATALOG.filter((r) => r.category === cat && canSee(r.roles));
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{cat}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <Link key={r.type} to={REPORT_ROUTE[r.type]} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-brand-400 hover:shadow-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
