export type PharmacyRole =
  | 'super_admin'
  | 'admin'
  | 'pharmacist'
  | 'inventory_manager'
  | 'cashier'
  | 'accountant'
  | 'auditor';

/**
 * Claims contract Dashboard expects from Supabase Auth once Module 16
 * (Users & Roles) populates custom claims via an Auth Hook / DB trigger.
 * Any module reading JWT claims should depend on this interface, not on
 * ad-hoc field access, so the contract has one place to evolve.
 */
export interface SupabaseAppMetadata {
  role: PharmacyRole;
  pharmacyId: string;
  branchId: string;
  accessibleBranchIds: string[];
}

export interface JwtPayload {
  sub: string;
  email?: string;
  app_metadata: SupabaseAppMetadata;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}
