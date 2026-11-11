import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_U4Rgccyd4DrhKeI7AuVyCQ_tYnwa-6p';

export const SUPABASE_URL = sanitizeSupabaseUrl(rawUrl);
export const SUPABASE_KEY = rawKey.trim();
export const SUPABASE_PROJECT_REF = 'ckcwpcnsfennfjmjwoqp';

let _supabaseClient: SupabaseClient | null = null;

export function getBackendSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _supabaseClient;
}
