import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Client-side environment variables with universal process.env fallback
const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return ((import.meta as any).env[key] || '').trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return (process.env[key] || '').trim();
    }
  } catch {}
  return '';
};

const CLIENT_SUPABASE_OVERRIDE_KEY = 'minglecall_supabase_client_override';

type ClientOverride = { url: string; anonKey: string };

function readClientOverride(): ClientOverride | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CLIENT_SUPABASE_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientOverride;
    if (
      parsed?.url &&
      parsed?.anonKey &&
      !parsed.url.includes('placeholder') &&
      !String(parsed.anonKey).startsWith('••••')
    ) {
      return { url: String(parsed.url).trim(), anonKey: String(parsed.anonKey).trim() };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeClientOverride(url: string, anonKey: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      CLIENT_SUPABASE_OVERRIDE_KEY,
      JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
    );
  } catch {
    /* ignore */
  }
}

const envUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const envAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');
const override = readClientOverride();

let supabaseUrl = override?.url || envUrl;
let supabaseAnonKey = override?.anonKey || envAnonKey;

// Fallback placeholder to allow graceful instantiation without crashing
const FALLBACK_URL = 'https://placeholder-project.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

const clientOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
  db: {
    schema: 'public' as const,
  },
};

let supabaseClient: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || FALLBACK_URL,
  supabaseAnonKey || FALLBACK_ANON_KEY,
  clientOptions
);

/**
 * Proxy so existing `import { supabase }` keeps working after admin reconfigure.
 */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const value = Reflect.get(supabaseClient as object, prop, receiver);
    return typeof value === 'function' ? value.bind(supabaseClient) : value;
  },
}) as SupabaseClient<Database>;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('placeholder-project') &&
      !supabaseUrl.includes('your-project-ref')
  );
};

/**
 * Hot-swap browser Supabase URL/anon key (public values only).
 * Used when Admin saves connection settings on Vercel without a full redeploy.
 * Still set Vercel Project env vars + redeploy for a permanent build-time config.
 */
export function reconfigureSupabaseClient(url: string, anonKey: string): { success: boolean; error?: string } {
  const nextUrl = String(url || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const nextKey = String(anonKey || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!nextUrl || !nextKey || nextKey.startsWith('••••')) {
    return { success: false, error: 'Supabase URL and anon key are required.' };
  }
  if (nextUrl.includes('placeholder') || nextUrl.includes('your-project')) {
    return { success: false, error: 'Replace the placeholder Supabase project URL.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(nextUrl);
  } catch {
    return {
      success: false,
      error: 'Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL (e.g. https://xxxx.supabase.co).',
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      success: false,
      error: 'Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL (e.g. https://xxxx.supabase.co).',
    };
  }

  try {
    supabaseUrl = nextUrl;
    supabaseAnonKey = nextKey;
    writeClientOverride(nextUrl, nextKey);
    supabaseClient = createClient<Database>(nextUrl, nextKey, clientOptions);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reconfigure Supabase client' };
  }
}

export function getSupabaseClientConfig(): { url: string; anonKeyConfigured: boolean } {
  return {
    url: supabaseUrl || '',
    anonKeyConfigured: Boolean(supabaseAnonKey && !supabaseAnonKey.startsWith('••••')),
  };
}

// Connection check utility
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  message: string;
  configured: boolean;
}> {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      connected: false,
      latencyMs: 0,
      message: 'Supabase URL or Anon Key is missing. Configure them in Settings / Environment Variables.',
      configured: false,
    };
  }

  const startTime = performance.now();
  try {
    const { error, status } = await supabase.from('system_configs').select('id').limit(1);

    const latencyMs = Math.round(performance.now() - startTime);

    if (error && status !== 406 && status !== 0) {
      return {
        connected: false,
        latencyMs,
        message: `Database query returned: ${error.message}`,
        configured: true,
      };
    }

    return {
      connected: true,
      latencyMs,
      message: `Successfully connected to PostgreSQL via Supabase (Ping: ${latencyMs}ms)`,
      configured: true,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Math.round(performance.now() - startTime),
      message: err.message || 'Network error connecting to Supabase instance',
      configured: true,
    };
  }
}
