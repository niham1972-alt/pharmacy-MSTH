import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';

/**
 * Foundational app-wide hook — the logged-in user's own roles / branch access /
 * resolved permission keys (role baseline + active overrides), sourced from
 * Module 16's `/users/me`. Every module's frontend should use this rather than a
 * locally-duplicated "who am I". `can(key)` answers permission-key questions for
 * conditional rendering (always in addition to backend enforcement, never the
 * sole gate).
 */
export function useCurrentUser() {
  const q = useQuery({ queryKey: ['users', 'me'], queryFn: async () => (await usersApi.me()).data, staleTime: 60_000 });
  const permissionKeys = q.data?.permissionKeys ?? [];
  return {
    me: q.data,
    isLoading: q.isLoading,
    roles: q.data?.roles ?? [],
    branchAccess: q.data?.branchAccess ?? [],
    can: (permissionKey: string) => permissionKeys.includes(permissionKey),
  };
}
