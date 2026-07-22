import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ReportView } from '../../features/reports/components/ReportView';
import { REPORT_CATALOG } from '../../features/reports/types/reports.types';

/** Renders any report from the catalog, keyed by the kebab-case route param.
 *  A single component backs every report page (spec §9's shared shell). */
export function GenericReportPage() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const { user } = useAuth();
  const entry = REPORT_CATALOG.find((r) => r.type.toLowerCase().replace(/_/g, '-') === reportKey);

  if (!entry) return <Navigate to="/reports" replace />;
  const allowed = user?.role === 'super_admin' || entry.roles.includes(user?.role ?? '');
  if (!allowed) return <Navigate to="/reports" replace />;

  return <ReportView entry={entry} />;
}
