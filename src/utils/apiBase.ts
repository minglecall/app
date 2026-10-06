/**
 * Split-deploy URL helpers (optional override).
 * Default production path: Vercel-only same-origin `/api` + Supabase Realtime (leave VITE_API_BASE_URL unset).
 * Optional: VITE_API_BASE_URL + VITE_WS_URL for a separate Node API host.
 */

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Absolute API origin (empty string = same-origin / relative paths). */
export function getApiBaseUrl(): string {
  const raw = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!raw) return '';
  return trimSlash(raw.replace(/^["']|["']$/g, ''));
}

export function isSplitDeploy(): boolean {
  return Boolean(getApiBaseUrl());
}

/**
 * Resolve a path or absolute URL for fetch/authFetch.
 * `/api/health` → `https://api…/api/health` when VITE_API_BASE_URL is set.
 */
export function apiUrl(pathOrUrl: string): string {
  const input = String(pathOrUrl || '').trim();
  if (!input) return getApiBaseUrl() || '';
  if (/^https?:\/\//i.test(input) || input.startsWith('//')) return input;

  const base = getApiBaseUrl();
  if (!base) {
    return input.startsWith('/') ? input : `/${input}`;
  }

  const path = input.startsWith('/') ? input : `/${input}`;
  return `${base}${path}`;
}

/** WebSocket signaling URL for Express `/ws`. */
export function getWsUrl(): string {
  const explicit = String(import.meta.env.VITE_WS_URL || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (explicit) return explicit;

  const apiBase = getApiBaseUrl();
  if (apiBase) {
    try {
      const u = new URL(apiBase);
      const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${u.host}/ws`;
    } catch {
      // fall through to same-origin
    }
  }

  if (typeof window === 'undefined') return '/ws';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function getDeployModeLabel(): string {
  if (isSplitDeploy()) return 'split (Vercel SPA → Node API)';
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return 'vercel-only (same-origin /api + Realtime)';
  }
  return 'same-origin (local Express + /ws)';
}
