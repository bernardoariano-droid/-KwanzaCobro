import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}
export const SUPABASE_URL = sanitizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
export const SUPABASE_KEY = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
export const SUPABASE_PROJECT_REF = (() => {
  try { return new URL(SUPABASE_URL).hostname.split('.')[0] || 'unconfigured'; }
  catch { return 'unconfigured'; }
})();

// Cada pedido usa o JWT do utilizador. Nunca usar service_role para contornar RLS.
export function getBackendSupabase(accessToken?: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Configuração do Supabase incompleta.');
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}
