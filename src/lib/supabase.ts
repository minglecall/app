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

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

// Fallback placeholder to allow graceful instantiation without crashing
const FALLBACK_URL = 'https://placeholder-project.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder-project') &&
    !supabaseUrl.includes('your-project-ref')
  );
};

// Create Supabase JS v2 client with connection pooling & realtime config
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || FALLBACK_URL,
  supabaseAnonKey || FALLBACK_ANON_KEY,
  {
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
      schema: 'public',
    },
  }
);

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
    const { error, status } = await supabase
      .from('system_configs')
      .select('id')
      .limit(1);

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
