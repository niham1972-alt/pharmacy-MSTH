import { supabase } from '../auth/supabaseClient';

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

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

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
