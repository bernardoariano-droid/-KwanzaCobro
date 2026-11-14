import {
  AuthUser,
  Client,
  CompanySettings,
  Debt,
  Seller,
  Utilizador,
} from '../types/debt';

export type AppAuthMode = 'localhost' | 'supabase';

const KEY_AUTH_MODE = 'kwanzacobro_auth_mode_v1';
const KEY_LOCAL_TOKEN = 'kwanzacobro_local_token_v1';

export function getSavedAuthMode(): AppAuthMode | null {
  try {
    const val = localStorage.getItem(KEY_AUTH_MODE);
    if (val === 'localhost' || val === 'supabase') return val;
    return null;
  } catch {
    return null;
  }
}

export function setSavedAuthMode(mode: AppAuthMode): void {
  try {
    localStorage.setItem(KEY_AUTH_MODE, mode);
  } catch {}
}

export function getLocalToken(): string | null {
  try {
    return localStorage.getItem(KEY_LOCAL_TOKEN);
  } catch {
    return null;
  }
}

export function setLocalToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY_LOCAL_TOKEN, token);
    else localStorage.removeItem(KEY_LOCAL_TOKEN);
  } catch {}
}

async function localApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getLocalToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

export interface LocalStatusResult {
  success: boolean;
  initialized: boolean;
  superAdminEmail: string;
  superAdminHasPassword: boolean;
  counts?: {
    companies: number;
    utilizadores: number;
    sellers: number;
    clients: number;
    debts: number;
  };
  lastSavedAt?: string;
}

export async function fetchLocalStatus(): Promise<LocalStatusResult | null> {
  try {
    const res = await fetch('/api/local/status');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function signInLocalhost(
  email: string,
  password: string
): Promise<
  | { ok: true; user: AuthUser; company?: CompanySettings }
  | { ok: false; error: string; needsLocalPasswordSetup?: boolean }
> {
  try {
    const res = await fetch('/api/local/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        ok: false,
        error: json?.error || 'Não foi possível iniciar sessão no localhost.',
        needsLocalPasswordSetup: Boolean(json?.needsLocalPasswordSetup),
      };
    }
    setLocalToken(json.token);
    setSavedAuthMode('localhost');
    return {
      ok: true,
      user: json.user,
      company: json.company,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro de ligação ao servidor localhost.' };
  }
}

export async function setupLocalSuperAdmin(
  password: string,
  name?: string
): Promise<{ ok: true; user: AuthUser; company?: CompanySettings } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/local/auth/setup-super-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || 'Erro ao configurar Super Admin no localhost.' };
    }
    setLocalToken(json.token);
    setSavedAuthMode('localhost');
    return {
      ok: true,
      user: json.user,
      company: json.company,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao comunicar com servidor localhost.' };
  }
}

export async function registerLocalCompanyAndAdmin(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName: string;
  nif?: string;
  branch?: string;
}): Promise<{ ok: true; user: AuthUser; company?: CompanySettings } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/local/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || 'Erro ao registar empresa no localhost.' };
    }
    setLocalToken(json.token);
    setSavedAuthMode('localhost');
    return {
      ok: true,
      user: json.user,
      company: json.company,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao comunicar com servidor localhost.' };
  }
}

export async function fetchLocalSessionUser(): Promise<
  { ok: true; user: AuthUser; company?: CompanySettings } | { ok: false; error?: string }
> {
  const token = getLocalToken();
  if (!token) return { ok: false };
  try {
    const res = await localApiFetch('/api/local/auth/me');
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json?.user) {
      if (res.status === 401 || res.status === 403) {
        setLocalToken(null);
      }
      return { ok: false, error: json?.error };
    }
    return { ok: true, user: json.user, company: json.company };
  } catch {
    return { ok: false };
  }
}

export function signOutLocalhost(): void {
  setLocalToken(null);
}

export async function pullFromLocalhost(): Promise<{
  success: boolean;
  data?: {
    companies: CompanySettings[];
    company: CompanySettings;
    utilizadores: Utilizador[];
    sellers: Seller[];
    clients: Client[];
    debts: Debt[];
  };
  error?: string;
}> {
  try {
    const res = await localApiFetch('/api/local/data');
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'Falha ao carregar dados do localhost.' };
    }
    return {
      success: true,
      data: {
        companies: json.companies || [],
        company: json.company,
        utilizadores: json.utilizadores || [],
        sellers: json.sellers || [],
        clients: json.clients || [],
        debts: json.debts || [],
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao carregar dados do localhost.' };
  }
}

export async function syncToLocalhost(payload: {
  debts?: Debt[];
  clients?: Client[];
  sellers?: Seller[];
  company?: CompanySettings;
  companies?: CompanySettings[];
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await localApiFetch('/api/local/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, message: json?.error || 'Falha ao guardar no localhost.' };
    }
    return { success: true, message: json.message };
  } catch (err: any) {
    return { success: false, message: err?.message };
  }
}

export async function fetchLocalUtilizadores(companyId?: string): Promise<{
  success: boolean;
  users: Utilizador[];
  error?: string;
}> {
  try {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const res = await localApiFetch(`/api/local/users${query}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, users: [], error: json?.error || 'Erro ao carregar utilizadores.' };
    }
    return { success: true, users: json.users || [] };
  } catch (err: any) {
    return { success: false, users: [], error: err?.message };
  }
}

export async function createLocalUtilizador(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  branch: string;
  role: string;
  companyId?: string;
}): Promise<{ success: boolean; user?: Utilizador; error?: string }> {
  try {
    const res = await localApiFetch('/api/local/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'Erro ao cadastrar utilizador.' };
    }
    return { success: true, user: json.user };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function updateLocalUtilizador(payload: {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  branch?: string;
  role?: string;
  companyId?: string | null;
  isActive?: boolean;
}): Promise<{ success: boolean; user?: Utilizador; error?: string }> {
  try {
    const res = await localApiFetch('/api/local/users', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'Erro ao atualizar utilizador.' };
    }
    return { success: true, user: json.user };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteLocalUtilizador(userId: string): Promise<{
  success: boolean;
  deactivatedOnly?: boolean;
  error?: string;
}> {
  try {
    const res = await localApiFetch(`/api/local/users?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'Erro ao remover utilizador.' };
    }
    return { success: true, deactivatedOnly: json.deactivatedOnly };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function saveLocalCompany(company: CompanySettings): Promise<{
  success: boolean;
  company?: CompanySettings;
  error?: string;
}> {
  try {
    const res = await localApiFetch('/api/local/companies', {
      method: 'POST',
      body: JSON.stringify({ company }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'Erro ao guardar empresa no localhost.' };
    }
    return { success: true, company: json.company };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteLocalCompany(companyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await localApiFetch(`/api/local/companies?companyId=${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'Erro ao remover empresa no localhost.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
