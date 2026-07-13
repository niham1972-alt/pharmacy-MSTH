/**
 * Impersonation session — stored in sessionStorage so it is PER-TAB. This is the
 * key to safe two-context operation: the platform-app tab keeps using the real
 * platform-staff Supabase session, while a tenant tab opened for impersonation
 * carries the impersonation token only in ITS own tab. The token is handed to the
 * tenant tab via the URL hash (never shared localStorage) and captured on load.
 */
export interface ImpersonationSession {
  token: string;
  sessionId: string;
  expiresAt: string; // ISO
  pharmacyName: string;
  userName: string;
  returnTo?: string; // platform-app path to return to on end/expiry
}

const KEY = 'pms_impersonation';

export function getImpersonation(): ImpersonationSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ImpersonationSession;
    return s.token ? s : null;
  } catch {
    return null;
  }
}

export function setImpersonation(s: ImpersonationSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clearImpersonation(): void {
  sessionStorage.removeItem(KEY);
}

/** The bearer token to use for TENANT API calls in this tab, if impersonating and
 *  not yet past the hard expiry. */
export function getImpersonationToken(): string | null {
  const s = getImpersonation();
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() <= Date.now()) return null; // hard expiry
  return s.token;
}

/**
 * Called once at tenant-app startup: if a fresh tab was opened with an
 * `#imp=<base64json>` hash (from the platform-app "Impersonate" action), capture
 * it into this tab's sessionStorage and strip the hash from the URL.
 */
export function bootstrapImpersonationFromHash(): void {
  const hash = window.location.hash;
  const m = hash.match(/[#&]imp=([^&]+)/);
  if (!m) return;
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(m[1])))) as ImpersonationSession;
    if (decoded?.token) setImpersonation(decoded);
  } catch {
    /* ignore malformed hash */
  }
  // Remove the hash so the token doesn't linger in the address bar / history.
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** Encode a session into the hash payload the platform-app opens the tenant tab with. */
export function encodeImpersonationHash(s: ImpersonationSession): string {
  return 'imp=' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}
