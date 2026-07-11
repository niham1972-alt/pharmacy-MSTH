import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/client';
import { EffectivePermissionItem, usersApi } from '../api/users.api';

/**
 * Per-user effective-permission editor (spec §4). Every registry permission,
 * grouped by module + searchable, with a toggle for its effective state and a
 * badge explaining WHY it's on/off (role / granted / revoked / not granted).
 * A single toggle resolves to the right operation (grant / revoke / clear).
 */
export function UserPermissionsTab({ userId, canManage }: { userId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['users', 'permissions', userId], queryFn: async () => (await usersApi.getPermissions(userId)).data });

  const mutate = useMutation({
    mutationFn: async (v: { item: EffectivePermissionItem; op: 'grant' | 'revoke' | 'clear' }) => {
      if (v.op === 'clear') return usersApi.clearOverride(userId, v.item.key);
      return usersApi.setOverride(userId, v.item.key, v.op === 'grant' ? 'GRANT' : 'REVOKE');
    },
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ['users', 'permissions', userId] }); qc.invalidateQueries({ queryKey: ['users', 'detail', userId] }); },
    onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Could not update the permission.'),
  });

  // A single toggle → the correct override op:
  //  role grants it  → turn OFF = REVOKE, turn ON (from revoked) = CLEAR
  //  role lacks it   → turn ON = GRANT,   turn OFF (from granted) = CLEAR
  const toggle = (item: EffectivePermissionItem) => {
    if (!canManage || mutate.isPending) return;
    const willActivate = !item.active;
    const op = willActivate ? (item.roleHas ? 'clear' : 'grant') : item.roleHas ? 'revoke' : 'clear';
    mutate.mutate({ item, op });
  };

  const groups = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data.groups;
    return data.groups
      .map((g) => ({ ...g, permissions: g.permissions.filter((p) => p.label.toLowerCase().includes(term) || p.key.toLowerCase().includes(term) || p.module.toLowerCase().includes(term)) }))
      .filter((g) => g.permissions.length > 0);
  }, [data, search]);

  if (isLoading) return <div className="animate-pulse text-gray-400">Loading permissions…</div>;
  if (isError || !data) return <div className="text-red-600">Couldn't load permissions. <button onClick={() => refetch()} className="underline">Retry</button></div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Effective access = <span className="font-medium">role defaults</span> + per-user <span className="text-blue-600 dark:text-blue-400">grants</span> − <span className="text-amber-600 dark:text-amber-400">revokes</span>.
          {data.isSuperAdmin && <span className="ml-1 text-gray-400">Super Admin has everything and can't be restricted.</span>}
        </p>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permissions…" className="w-56 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
      </div>
      {error && <div role="alert" className="mb-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.module} className="rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="border-b border-gray-100 dark:border-gray-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.module}</h3>
            <ul>
              {g.permissions.map((p) => (
                <li key={p.key} className="flex items-center gap-3 border-b border-gray-50 px-3 py-2 last:border-0 dark:border-gray-900">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900 dark:text-gray-100">{p.label}</span>
                      <SourceBadge item={p} superAdmin={data.isSuperAdmin} />
                    </div>
                    <p className="truncate text-[11px] text-gray-400" title={p.description}>{p.description} · <code>{p.key}</code></p>
                  </div>
                  {(p.source === 'granted' || p.source === 'revoked') && canManage && !data.isSuperAdmin && (
                    <button onClick={() => mutate.mutate({ item: p, op: 'clear' })} title="Reset to role default" className="shrink-0 text-xs text-gray-400 hover:text-gray-600">↺ reset</button>
                  )}
                  <button
                    role="switch"
                    aria-checked={p.active}
                    aria-label={`${p.active ? 'Disable' : 'Enable'} ${p.label}`}
                    disabled={!canManage || data.isSuperAdmin || mutate.isPending}
                    onClick={() => toggle(p)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${p.active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} ${!canManage || data.isSuperAdmin ? 'opacity-50' : ''}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${p.active ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No permissions match your search.</p>}
      </div>
    </div>
  );
}

function SourceBadge({ item, superAdmin }: { item: EffectivePermissionItem; superAdmin: boolean }) {
  if (superAdmin) return <Badge tone="gray">from role</Badge>;
  if (item.source === 'granted') return <Badge tone="blue" title={item.overrideReason ?? undefined}>granted (override)</Badge>;
  if (item.source === 'revoked') return <Badge tone="amber" title={item.overrideReason ?? undefined}>revoked (override)</Badge>;
  if (item.source === 'role') return <Badge tone="green">from role</Badge>;
  return <Badge tone="gray">not granted</Badge>;
}

function Badge({ tone, children, title }: { tone: 'gray' | 'green' | 'blue' | 'amber'; children: React.ReactNode; title?: string }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  };
  return <span title={title} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}
