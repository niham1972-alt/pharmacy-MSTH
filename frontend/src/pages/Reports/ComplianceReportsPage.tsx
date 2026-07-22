import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { REPORT_CATALOG, REPORT_ROUTE, ReportType } from '../../features/reports/types/reports.types';

const COMPLIANCE_REPORTS: ReportType[] = ['CONTROLLED_SUBSTANCE_LOG', 'AUDIT_SUMMARY', 'SHRINKAGE', 'PURCHASE_RETURNS'];

/** Compliance hub — the regulatory/audit-facing reports in one place (spec §2.4/§9). */
export function ComplianceReportsPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const canSee = (roles: string[]) => role === 'super_admin' || roles.includes(role);
  const items = REPORT_CATALOG.filter((r) => COMPLIANCE_REPORTS.includes(r.type) && canSee(r.roles));

  return (
    <div>
      <div className="mb-4">
        <Link to="/reports" className="text-sm text-brand-600 hover:underline">← All reports</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Compliance Reports</h1>
        <p className="text-sm text-gray-500">Regulatory and audit-facing reports for periodic compliance review.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <Link key={r.type} to={REPORT_ROUTE[r.type]} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-brand-400">
            <p className="font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
            <p className="mt-1 text-xs text-gray-500">{r.description}</p>
          </Link>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">No compliance reports available for your role.</p>}
      </div>
    </div>
  );
}
