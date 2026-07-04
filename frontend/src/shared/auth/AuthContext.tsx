import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export type PharmacyRole =
  | 'super_admin'
  | 'admin'
  | 'pharmacist'
  | 'inventory_manager'
  | 'cashier'
  | 'accountant'
  | 'auditor';

export interface AuthUser {
  userId: string;
  email?: string;
  role: PharmacyRole;
  pharmacyId: string;
  branchId: string;
  accessibleBranchIds: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, signOut: async () => undefined });

function mapSession(session: Session | null): AuthUser | null {
  const appMeta = session?.user?.app_metadata as Partial<AuthUser> | undefined;
  if (!session || !appMeta?.role || !appMeta?.pharmacyId) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    role: appMeta.role,
    pharmacyId: appMeta.pharmacyId,
    branchId: appMeta.branchId ?? '',
    accessibleBranchIds: appMeta.accessibleBranchIds ?? (appMeta.branchId ? [appMeta.branchId] : []),
  };
}

/**
 * Wraps the Supabase session and exposes the pharmacy-specific claims the
 * rest of the app relies on. This is a lightweight stand-in for the real
 * Users & Roles (Module 16) auth flow — sufficient to make the Dashboard
 * reachable and role-testable today.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(mapSession(data.session));
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSession(session));
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
