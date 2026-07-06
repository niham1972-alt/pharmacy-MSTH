import { useState } from 'react';
import { AuditRow } from '../api/audit-logs.api';
import { SeverityBadge } from './SeverityBadge';
import { MetadataDetailView } from './MetadataDetailView';

export function AuditLogsTable({ rows, sensitive }: { rows: AuditRow[]; sensitive?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className={`overflow-x-auto rounded-lg border ${sensitive ? 'border-orange-200 dark:border-orange-900' : 'border-gray-200 dark:border-gray-800'}`}>
      <table className="w-full text-left text-sm">
        <thead className={`text-xs uppercase text-gray-500 ${sensitive ? 'bg-orange-50/50 dark:bg-orange-950/20' : 'bg-gray-50 dark:bg-gray-900/40'}`}>
          <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2"></th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No audit events match your current filters.</td></tr>}
          {rows.map((r) => (
            <>
              <tr key={r.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.actionLabel}{!r.registered && <span className="ml-1 rounded bg-yellow-100 dark:bg-yellow-950 px-1 text-[10px] text-yellow-700 dark:text-yellow-400" title="Action not in registry">?</span>}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.entityType}{r.entityId && <span className="block text-[10px] text-gray-400">{r.entityId.slice(0, 8)}…</span>}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.performedByName ?? r.performedBy.slice(0, 8)}</td>
                <td className="px-3 py-2"><SeverityBadge severity={r.severity} /></td>
                <td className="px-3 py-2 text-right text-gray-400">{r.metadata && Object.keys(r.metadata).length > 0 ? (expanded === r.id ? '▲' : '▼') : ''}</td>
              </tr>
              {expanded === r.id && r.metadata && <tr key={r.id + '-m'}><td colSpan={6} className="bg-gray-50/50 dark:bg-gray-900/20 px-3 py-2"><MetadataDetailView metadata={r.metadata} /></td></tr>}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
