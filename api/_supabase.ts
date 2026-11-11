import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export const SUPABASE_URL = sanitizeSupabaseUrl(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
);
export const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0] || 'unconfigured';
  } catch {
    return 'unconfigured';
  }
})();

// Funções privilegiadas exigem service_role no servidor. Nunca usar anon/publishable como fallback.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

let _supabaseClient: SupabaseClient | null = null;

export function getBackendSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'Configuração do Supabase incompleta no servidor. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente da Vercel.'
    );
  }

  if (!_supabaseClient) {
    _supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return _supabaseClient;
}
