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

// Estas rotas ainda não validam uma sessão de utilizador no servidor.
// Por segurança, usam apenas a chave pública (anon/publishable), nunca service_role.
// As políticas RLS da base de dados devem restringir o acesso até existir autorização
// de servidor consistente em todas as rotas.
export const SUPABASE_KEY = (
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
).trim();

let _supabaseClient: SupabaseClient | null = null;

export function getBackendSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Configuração do Supabase incompleta. Defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel.'
    );
  }

  if (!_supabaseClient) {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return _supabaseClient;
}
