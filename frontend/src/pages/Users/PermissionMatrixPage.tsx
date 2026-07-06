import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usersApi } from '../../features/users/api/users.api';
import { ROLE_LABEL } from '../../features/users/components/UserStatusBadge';

export function PermissionMatrixPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['users', 'permission-matrix'], queryFn: async () => (await usersApi.permissionMatrix()).data });

  const grouped = useMemo(() => {
    const g: Record<string, NonNullable<typeof data>['permissions']> = {};
    for (const p of data?.permissions ?? []) (g[p.module] ??= []).push(p);
    return g;
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/users" className="underline">Users</Link> / Permission Matrix</div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Permission Matrix</h1>
      <p className="mb-4 text-sm text-gray-500">Read-only reference — the single source of truth for what each role can do, defined centrally in <code className="text-xs">permission-matrix.config.ts</code>. super_admin is allowed everywhere.</p>

      {isLoading && <div className="animate-pulse text-gray-400">Loading…</div>}
      {isError && <div className="text-red-600">Couldn't load. <button onClick={() => refetch()} className="underline">Retry</button></div>}

      {data && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/40 uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 sticky left-0 bg-gray-50 dark:bg-gray-900/40">Permission</th>
                {data.roles.map((r) => <th key={r.role} className="px-2 py-2 text-center">{ROLE_LABEL[r.role]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {Object.entries(grouped).map(([module, perms]) => (
                <>
                  <tr key={module} className="bg-gray-100/60 dark:bg-gray-800/40"><td colSpan={data.roles.length + 1} className="px-3 py-1.5 font-semibold text-gray-700 dark:text-gray-300">{module}</td></tr>
                  {perms.map((p) => (
                    <tr key={p.key}>
                      <td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-gray-900"><span className="text-gray-800 dark:text-gray-200">{p.description}</span><code className="block text-[10px] text-gray-400">{p.key}</code></td>
                      {data.roles.map((r) => <td key={r.role} className="px-2 py-1.5 text-center">{p.allowed[r.role] ? <span className="text-green-600">✅</span> : <span className="text-gray-300 dark:text-gray-700">·</span>}</td>)}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
