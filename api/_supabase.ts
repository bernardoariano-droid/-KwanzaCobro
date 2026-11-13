import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export const PRESERVED_SUPER_ADMIN_EMAIL = 'bamidia@gmail.com';
export const PRESERVED_SUPER_ADMIN_UUID = '8b9f3c41-c996-4764-87c2-9d82411584e1';

export type ServerUserRole = 'super_admin' | 'admin_geral' | 'vendedor';

export interface VerifiedUtilizadorProfile {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  phone: string;
  role: ServerUserRole;
  companyId: string | null;
  isActive: boolean;
  branch?: string;
  sellerId?: string;
  rawRow: Record<string, any>;
}

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
const rawAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_U4Rgccyd4DrhKeI7AuVyCQ_tYnwa-6p';

export const SUPABASE_URL = sanitizeSupabaseUrl(rawUrl);
export const SUPABASE_ANON_KEY = rawAnonKey.trim();
export const SUPABASE_PROJECT_REF = 'ckcwpcnsfennfjmjwoqp';

export function normalizeServerRole(rawRole?: string | null): ServerUserRole {
  const val = String(rawRole || '').trim().toLowerCase();
  if (val === 'super_admin' || val === 'superadmin') return 'super_admin';
  if (val === 'admin_geral' || val === 'admin' || val === 'administrador' || val === 'company_admin') return 'admin_geral';
  return 'vendedor';
}

/**
 * Cliente Supabase com chave pública ANON (e opcionalmente o JWT do utilizador para aplicar RLS)
 */
export function getAnonSupabase(accessToken?: string): SupabaseClient {
  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
}

/**
 * Compatibilidade retroativa para healthcheck público apenas com ANON_KEY.
 * Nunca usa SERVICE_ROLE_KEY nem ignora RLS.
 */
export function getBackendSupabase(accessToken?: string): SupabaseClient {
  return getAnonSupabase(accessToken);
}

/**
 * Cliente administrativo exclusivo do backend usando SUPABASE_SERVICE_ROLE_KEY.
 * Nunca faz fallback para ANON_KEY nem é exposto ao frontend.
 */
export function getAdminSupabase(): SupabaseClient {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não está configurada nas variáveis de ambiente do servidor (Vercel/Backend).'
    );
  }

  return createClient(SUPABASE_URL, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function extractBearerToken(req: any): string | null {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function mapUtilizadorRow(row: Record<string, any>, fallbackAuthUser?: User | null): VerifiedUtilizadorProfile {
  const rawRole = row.role ?? row.perfil ?? row.tipo ?? fallbackAuthUser?.user_metadata?.role;
  const role = normalizeServerRole(rawRole);
  const rawActive = row.ativo ?? row.active ?? row.is_active;
  const rawStatus = String(row.status || '').toLowerCase();
  const isActive = rawActive !== false && rawStatus !== 'inativo' && rawStatus !== 'bloqueado' && rawStatus !== 'suspenso';
  const authUid = String(row.auth_user_id || row.user_id || row.id || fallbackAuthUser?.id || '');

  return {
    id: String(row.id || authUid),
    authUserId: authUid,
    email: String(row.email || fallbackAuthUser?.email || ''),
    name: String(row.nome || row.name || fallbackAuthUser?.user_metadata?.name || row.email || 'Utilizador'),
    phone: String(row.telefone || row.phone || fallbackAuthUser?.phone || ''),
    role,
    companyId: row.company_id ? String(row.company_id) : null,
    isActive,
    branch: row.branch || row.filial ? String(row.branch || row.filial) : undefined,
    sellerId: row.seller_id ? String(row.seller_id) : String(row.id || authUid),
    rawRow: row,
  };
}

export async function fetchProfileByAuthUid(client: SupabaseClient, authUser: User): Promise<Record<string, any> | null> {
  // 1. Tentar corresponder por id = auth.uid()
  const byId = await client
    .from('utilizadores')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!byId.error && byId.data) {
    return byId.data;
  }

  // 2. Fallback caso o schema utilize auth_user_id = auth.uid()
  const byAuthUserId = await client
    .from('utilizadores')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!byAuthUserId.error && byAuthUserId.data) {
    return byAuthUserId.data;
  }

  return null;
}

export async function authenticateRequest(req: any): Promise<
  | {
      ok: true;
      accessToken: string;
      authUser: User;
      profile: VerifiedUtilizadorProfile;
      userSupabase: SupabaseClient;
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Sessão não autenticada. Token JWT em falta.' };
  }

  const userSupabase = getAnonSupabase(token);
  const { data: userData, error: authErr } = await userSupabase.auth.getUser(token);
  if (authErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Sessão expirada ou inválida. Faça login novamente.' };
  }

  const authUser = userData.user;
  let profileRow = await fetchProfileByAuthUid(userSupabase, authUser);

  // Fallback seguro caso apenas service_role consiga consultar um perfil ainda sem policy específica,
  // mantendo a verificação estrita pelo auth.uid() já validado acima.
  if (!profileRow && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminSupabase = getAdminSupabase();
      profileRow = await fetchProfileByAuthUid(adminSupabase, authUser);
    } catch {
      // Ignorar se service_role indisponível
    }
  }

  if (!profileRow) {
    return {
      ok: false,
      status: 403,
      error: 'Utilizador autenticado sem perfil ativo em public.utilizadores.',
    };
  }

  const profile = mapUtilizadorRow(profileRow, authUser);

  if (!profile.isActive) {
    return {
      ok: false,
      status: 403,
      error: 'A sua conta está desativada ou suspensa. Contacte o Administrador.',
    };
  }

  // Verificar estado da empresa caso não seja super_admin
  if (profile.role !== 'super_admin' && profile.companyId) {
    const compClient = userSupabase;
    const { data: compRow } = await compClient
      .from('company_settings')
      .select('id, status')
      .eq('id', profile.companyId)
      .maybeSingle();

    if (compRow && compRow.status === 'inativo') {
      return {
        ok: false,
        status: 403,
        error: 'A empresa vinculada a esta conta encontra-se temporariamente desativada.',
      };
    }
  }

  return {
    ok: true,
    accessToken: token,
    authUser,
    profile,
    userSupabase,
  };
}
