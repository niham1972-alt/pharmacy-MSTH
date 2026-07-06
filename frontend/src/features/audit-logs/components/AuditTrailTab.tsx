import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '../api/audit-logs.api';
import { SeverityBadge } from './SeverityBadge';
import { MetadataDetailView } from './MetadataDetailView';

/**
 * THE reusable, embeddable audit trail. Any module's detail page drops in
 * `<AuditTrailTab entityType="Medicine" entityId={id} />` to show that entity's
 * complete history. Access mirrors the host module's own entity access (the
 * entity-scoped endpoint is intentionally broader than the global log).
 */
export function AuditTrailTab({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-trail', entityType, entityId],
    queryFn: async () => (await auditLogsApi.entity(entityType, entityId)).data,
    enabled: !!entityId,
  });

  if (isLoading) return <div className="animate-pulse text-sm text-gray-400">Loading history…</div>;
  if (isError) return <div className="text-sm text-red-600">Couldn't load audit trail. <button onClick={() => refetch()} className="underline">Retry</button></div>;
  if (!data || data.length === 0) return <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-6 text-center text-sm text-gray-500">No recorded history for this {entityType.toLowerCase()} yet.</div>;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2"></th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((r) => (
            <>
              <tr key={r.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <td className="px-3 py-2 text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.actionLabel}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.performedByName ?? r.performedBy.slice(0, 8)}</td>
                <td className="px-3 py-2"><SeverityBadge severity={r.severity} /></td>
                <td className="px-3 py-2 text-right text-gray-400">{r.metadata && Object.keys(r.metadata).length > 0 ? (expanded === r.id ? '▲' : '▼') : ''}</td>
              </tr>
              {expanded === r.id && r.metadata && (
                <tr key={r.id + '-meta'}><td colSpan={5} className="bg-gray-50/50 dark:bg-gray-900/20 px-3 py-2"><MetadataDetailView metadata={r.metadata} /></td></tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
