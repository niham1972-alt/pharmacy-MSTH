import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { auditLogsApi } from '../../features/audit-logs/api/audit-logs.api';
import { AuditLogsTable } from '../../features/audit-logs/components/AuditLogsTable';

export function UserActivityPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['audit-user', userId], queryFn: async () => (await auditLogsApi.user(userId!)).data, enabled: !!userId });

  return (
    <div>
      <div className="mb-2 text-sm text-gray-500"><Link to="/audit-logs" className="underline">Audit Log</Link> / User Activity</div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">User Activity</h1>
      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}
      {data && <AuditLogsTable rows={data} />}
    </div>
  );
}
