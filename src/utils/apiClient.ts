import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiUrl } from './apiBase';

export { apiUrl, getApiBaseUrl, getWsUrl, isSplitDeploy, getDeployModeLabel } from './apiBase';

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extra || {}) };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function resolveInput(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string') return apiUrl(input);
  if (input instanceof URL) return new URL(apiUrl(input.pathname + input.search));
  return input;
}

/** Authenticated fetch — resolves `/api/...` against VITE_API_BASE_URL when set. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Authorization')) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (init?.body && !headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(resolveInput(input), { ...init, headers });
}

/** Same-origin or split-deploy fetch without forcing auth (OTP, setup, public probes). */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(resolveInput(input), init);
}
