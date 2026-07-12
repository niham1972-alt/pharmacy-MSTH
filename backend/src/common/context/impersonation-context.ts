import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped impersonation context. When a request is authenticated with an
 * impersonation token, an interceptor puts `{ impersonatedBy }` here for the
 * duration of the request. Module 15's AuditLogService reads it and stamps every
 * tenant-side audit record with the real platform-staff identity — so an
 * impersonated write is attributable to BOTH the impersonated tenant user (the
 * record's performedBy) AND the platform staff who did it (metadata.impersonatedBy).
 */
export interface ImpersonationContext {
  impersonatedBy: string; // platform staff user id
  impersonationSessionId?: string;
}

export const impersonationStore = new AsyncLocalStorage<ImpersonationContext>();

export function currentImpersonation(): ImpersonationContext | undefined {
  return impersonationStore.getStore();
}
