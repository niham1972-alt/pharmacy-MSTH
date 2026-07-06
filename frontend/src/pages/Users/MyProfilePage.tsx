import { useCurrentUser } from '../../features/users/hooks/useCurrentUser';

export function MyProfilePage() {
  const { me, isLoading } = useCurrentUser();
  if (isLoading) return <div className="animate-pulse text-gray-400">Loading…</div>;
  if (!me) return <div className="text-gray-500">Profile unavailable.</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">My Profile</h1>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">Name</span><span>{me.name}</span></div>
        <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">Email</span><span>{me.email}</span></div>
        <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">Status</span><span>{me.status}</span></div>
        <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm"><span className="text-gray-500">Roles</span><span>{me.roles.join(', ')}</span></div>
        <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Branch access</span><span>{me.branchAccess.length} branch(es)</span></div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-900 dark:text-gray-100">My permissions ({me.permissionKeys.length})</h2>
      <div className="flex flex-wrap gap-1">
        {me.permissionKeys.map((k) => <code key={k} className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">{k}</code>)}
      </div>
    </div>
  );
}
