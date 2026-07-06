/**
 * Renders audit metadata legibly (not a raw JSON dump). Special-cases the common
 * `{ before, after }` and `{ changes: { field: { from, to } } }` shapes that
 * price/status/role changes across the system use, showing a clean diff.
 */
export function MetadataDetailView({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) return <span className="text-xs text-gray-400">No additional detail.</span>;

  const changes = (metadata.changes ?? null) as Record<string, { from?: unknown; to?: unknown }> | null;
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;
  const fmt = (v: unknown) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

  return (
    <div className="space-y-2 text-xs">
      {changes && Object.keys(changes).length > 0 && (
        <div className="rounded-md border border-gray-200 dark:border-gray-800">
          {Object.entries(changes).map(([field, d]) => (
            <div key={field} className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-2 py-1 last:border-0">
              <span className="w-32 shrink-0 text-gray-500">{field}</span>
              <span className="rounded bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 text-red-700 dark:text-red-300 line-through">{fmt(d.from)}</span>
              <span className="text-gray-400">→</span>
              <span className="rounded bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 text-green-700 dark:text-green-300">{fmt(d.to)}</span>
            </div>
          ))}
        </div>
      )}
      {(before || after) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-red-200 dark:border-red-900 p-2"><p className="mb-1 font-medium text-red-700 dark:text-red-400">Before</p>{Object.entries(before ?? {}).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span>{fmt(v)}</span></div>)}</div>
          <div className="rounded-md border border-green-200 dark:border-green-900 p-2"><p className="mb-1 font-medium text-green-700 dark:text-green-400">After</p>{Object.entries(after ?? {}).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span>{fmt(v)}</span></div>)}</div>
        </div>
      )}
      {/* Remaining flat key/values (excluding the diff shapes handled above). */}
      <div className="rounded-md border border-gray-200 dark:border-gray-800">
        {Object.entries(metadata).filter(([k]) => !['changes', 'before', 'after'].includes(k)).map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-gray-100 dark:border-gray-800 px-2 py-1 last:border-0"><span className="text-gray-500">{k}</span><span className="max-w-[60%] truncate text-right text-gray-800 dark:text-gray-200">{fmt(v)}</span></div>
        ))}
      </div>
    </div>
  );
}
