import { supabase } from '../auth/supabaseClient';
import { getImpersonationToken } from '../impersonation/session';

export interface ApiError {
  code: string;
  message: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string;
  errorCode?: string;
  meta?: Record<string, unknown>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export class ApiClientError extends Error implements ApiError {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Resolve the bearer token. For TENANT calls (default) an active per-tab
 * impersonation token wins, so an impersonation tab talks to the backend AS the
 * tenant user. For PLATFORM calls (`platform: true`) we always use the real
 * platform-staff Supabase session — this is how "End Impersonation" and every
 * platform-app request stay attributed to the actual staff, never the impersonee.
 */
async function resolveToken(platform: boolean): Promise<string | undefined> {
  if (!platform) {
    const imp = getImpersonationToken();
    if (imp) return imp;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function request<T>(path: string, init?: RequestInit, platform = false): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const token = await resolveToken(platform);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  let body: ApiEnvelope<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError('NETWORK_ERROR', `Request to ${path} failed with status ${res.status}`);
  }

  if (!res.ok || !body.success) {
    throw new ApiClientError(body.errorCode ?? 'UNKNOWN_ERROR', body.message ?? 'Something went wrong');
  }

  return { data: body.data as T, meta: body.meta };
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Always authenticates as the real platform-staff Supabase session (never an
 *  impersonation token) — used by the platform-app and the "End Impersonation" call. */
export const platformClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }, true),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }, true),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }, true),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }, true),
};
