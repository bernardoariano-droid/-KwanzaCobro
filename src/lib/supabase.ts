import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthUser,
  CompanySettings,
  Seller,
  Client,
  Debt,
  DebtItem,
  Payment,
  Utilizador,
  normalizeUserRole,
} from '../types/debt';

// Função para sanitizar a URL fornecida pelo utilizador (remover /rest/v1/ se presente)
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_U4Rgccyd4DrhKeI7AuVyCQ_tYnwa-6p';

export const SUPABASE_URL = sanitizeSupabaseUrl(rawUrl);
export const SUPABASE_ANON_KEY = rawKey.trim();
export const SUPABASE_PROJECT_REF = 'ckcwpcnsfennfjmjwoqp';

export function isSupabaseEnvConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Instância oficial do cliente Supabase para o frontend (apenas ANON_KEY, nunca service_role)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function mapUtilizadorFromRow(row: Record<string, any>, authUser?: User | null): Utilizador {
  const rawRole = row.role ?? row.perfil ?? row.tipo ?? authUser?.user_metadata?.role;
  const rawActive = row.ativo ?? row.active ?? row.is_active;
  const rawStatus = String(row.status || '').toLowerCase();
  const isActive =
    rawActive !== false &&
    rawStatus !== 'inativo' &&
    rawStatus !== 'bloqueado' &&
    rawStatus !== 'suspenso';

  const id = String(row.id || authUser?.id || '');
  const authUid = String(row.auth_user_id || row.user_id || authUser?.id || id);

  return {
    id,
    authUserId: authUid,
    name: String(row.nome || row.name || authUser?.user_metadata?.name || row.email || 'Utilizador'),
    email: String(row.email || authUser?.email || ''),
    phone: String(row.telefone || row.phone || authUser?.phone || ''),
    role: normalizeUserRole(rawRole),
    companyId: row.company_id ? String(row.company_id) : undefined,
    isActive,
    branch: row.branch || row.filial ? String(row.branch || row.filial) : undefined,
    sellerId: row.seller_id ? String(row.seller_id) : id,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : undefined,
  };
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function fetchUtilizadorProfile(authUser: User): Promise<Utilizador | null> {
  // 1. Procurar por id = auth.uid()
  const byId = await supabase
    .from('utilizadores')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!byId.error && byId.data) {
    return mapUtilizadorFromRow(byId.data, authUser);
  }

  // 2. Fallback caso a tabela relacione via auth_user_id
  const byAuthUserId = await supabase
    .from('utilizadores')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!byAuthUserId.error && byAuthUserId.data) {
    return mapUtilizadorFromRow(byAuthUserId.data, authUser);
  }

  return null;
}

export async function validateAuthenticatedUser(authUser: User): Promise<
  | { ok: true; user: AuthUser; company?: CompanySettings }
  | { ok: false; error: string }
> {
  const profile = await fetchUtilizadorProfile(authUser);

  if (!profile) {
    await supabase.auth.signOut().catch(() => {});
    return {
      ok: false,
      error: 'A sua conta foi autenticada mas não possui perfil registado em public.utilizadores. Contacte o Administrador.',
    };
  }

  if (!profile.isActive) {
    await supabase.auth.signOut().catch(() => {});
    return {
      ok: false,
      error: 'Esta conta de utilizador encontra-se desativada ou suspensa. Contacte o Administrador.',
    };
  }

  let matchedCompany: CompanySettings | undefined;
  if (profile.companyId) {
    const { data: compRow } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', profile.companyId)
      .maybeSingle();

    if (compRow) {
      matchedCompany = mapCompanyFromSupabase(compRow);
      if (profile.role !== 'super_admin' && matchedCompany.status === 'inativo') {
        await supabase.auth.signOut().catch(() => {});
        return {
          ok: false,
          error: `A empresa "${matchedCompany.name}" encontra-se temporariamente desativada. Contacte o Super Administrador.`,
        };
      }
    }
  }

  const sessionUser: AuthUser = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone || '',
    role: profile.role,
    branch: profile.branch,
    companyId: profile.companyId,
    sellerId: profile.sellerId || profile.id,
    isActive: profile.isActive,
  };

  return {
    ok: true,
    user: sessionUser,
    company: matchedCompany,
  };
}

function translateSupabaseAuthError(message?: string): string {
  const msg = String(message || '').toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'E-mail ou palavra-passe incorretos. Verifique as suas credenciais.';
  }
  if (msg.includes('email not confirmed')) {
    return 'O seu e-mail ainda não foi confirmado. Verifique a sua caixa de entrada.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Demasiadas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Erro de ligação ao servidor Supabase Auth. Verifique a sua internet.';
  }
  return message || 'Não foi possível iniciar sessão.';
}

export async function signInWithSupabaseAuth(
  email: string,
  password: string
): Promise<{ ok: true; user: AuthUser; company?: CompanySettings } | { ok: false; error: string }> {
  if (!isSupabaseEnvConfigured()) {
    return { ok: false, error: 'Configuração Supabase em falta (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Introduza um endereço de e-mail válido.' };
  }
  if (!password) {
    return { ok: false, error: 'Introduza a sua palavra-passe.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error || !data?.user) {
    return {
      ok: false,
      error: translateSupabaseAuthError(error?.message),
    };
  }

  return validateAuthenticatedUser(data.user);
}

export async function signOutSupabaseAuth(): Promise<void> {
  await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Introduza um endereço de e-mail válido para recuperar a palavra-passe.' };
  }

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
  if (error) {
    return { ok: false, error: translateSupabaseAuthError(error.message) };
  }
  return { ok: true };
}

export async function updateAuthenticatedPassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: translateSupabaseAuthError(error.message) };
  }
  return { ok: true };
}

async function authorizedApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new Error('Sessão não autenticada. Inicie sessão novamente.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}

export async function fetchAuthorizedUtilizadores(companyId?: string): Promise<{
  success: boolean;
  users: Utilizador[];
  error?: string;
}> {
  try {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const res = await authorizedApiFetch(`/api/admin/users${query}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, users: [], error: json.error || 'Erro ao carregar utilizadores.' };
    }
    return { success: true, users: json.users || [] };
  } catch (err: any) {
    return { success: false, users: [], error: err.message };
  }
}

export async function createAuthorizedUtilizador(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  branch: string;
  role: string;
  companyId?: string;
}): Promise<{ success: boolean; user?: Utilizador; error?: string }> {
  try {
    const res = await authorizedApiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Erro ao cadastrar utilizador.' };
    }
    return { success: true, user: json.user };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAuthorizedUtilizador(payload: {
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
    const res = await authorizedApiFetch('/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Erro ao atualizar utilizador.' };
    }
    return { success: true, user: json.user };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAuthorizedUtilizador(userId: string): Promise<{
  success: boolean;
  deactivatedOnly?: boolean;
  error?: string;
}> {
  try {
    const res = await authorizedApiFetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Erro ao remover utilizador.' };
    }
    return { success: true, deactivatedOnly: json.deactivatedOnly };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface SupabaseHealthResult {
  connected: boolean;
  url: string;
  projectId: string;
  latencyMs?: number;
  message?: string;
  tableExists?: boolean;
  counts?: {
    companies: number;
    sellers: number;
    clients: number;
    debts: number;
  };
}

/**
 * Mapeamentos entre modelo da aplicação e colunas relacionais do PostgreSQL no Supabase
 */
export function mapCompanyFromSupabase(row: any, fallback?: CompanySettings): CompanySettings {
  if (!row) {
    return fallback || {
      id: 'default_company',
      name: 'KwanzaCobro - Gestão de Dívidas Empresariais',
      nif: '5401928374',
      phone: '+244 923 884 100',
      email: 'contacto@kwanzacobro.ao',
      address: 'Edifício Kilamba, Luanda, Angola',
      city: 'Luanda, Angola',
      bankName: 'Banco BAI (Banco Angolano de Investimentos)',
      iban: 'AO06 0040 0000 9812 3456 1012 8',
      expressPhone: '923 884 100',
      currency: 'Kz',
      penaltyPerDayRate: 0.1,
      daysBeforeDueAlert: 5,
      autoAlertNotifications: true,
      status: 'ativo',
    };
  }

  return {
    id: row.id ? String(row.id) : (fallback?.id || 'default_company'),
    name: row.name || fallback?.name || 'KwanzaCobro',
    nif: row.nif || fallback?.nif || '',
    phone: row.phone || fallback?.phone || '',
    email: row.email || fallback?.email || '',
    address: row.address || fallback?.address || '',
    city: row.city || fallback?.city || 'Luanda, Angola',
    bankName: row.bank_name || fallback?.bankName || '',
    iban: row.iban || fallback?.iban || '',
    expressPhone: row.express_phone || fallback?.expressPhone || '',
    currency: row.currency || fallback?.currency || 'Kz',
    logoUrl: row.logo_url || fallback?.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg',
    penaltyPerDayRate: typeof row.penalty_per_day_rate === 'number' ? row.penalty_per_day_rate : (fallback?.penaltyPerDayRate || 0.1),
    daysBeforeDueAlert: typeof row.days_before_due_alert === 'number' ? row.days_before_due_alert : (fallback?.daysBeforeDueAlert || 5),
    autoAlertNotifications: typeof row.auto_alert_notifications === 'boolean' ? row.auto_alert_notifications : true,
    status: row.status === 'inativo' ? 'inativo' : 'ativo',
    superAdminId: row.super_admin_id ? String(row.super_admin_id) : undefined,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : fallback?.createdAt,
  };
}

export function mapCompanyToSupabase(company: CompanySettings): any {
  return {
    id: company.id || 'default_company',
    name: company.name || 'KwanzaCobro',
    nif: company.nif || '',
    phone: company.phone || '',
    email: company.email || '',
    address: company.address || '',
    city: company.city || 'Luanda, Angola',
    bank_name: company.bankName || '',
    iban: company.iban || '',
    express_phone: company.expressPhone || '',
    currency: company.currency || 'Kz',
    logo_url: company.logoUrl || null,
    penalty_per_day_rate: company.penaltyPerDayRate ?? 0.1,
    days_before_due_alert: company.daysBeforeDueAlert ?? 5,
    auto_alert_notifications: company.autoAlertNotifications ?? true,
    status: company.status || 'ativo',
    super_admin_id: company.superAdminId || undefined,
    updated_at: new Date().toISOString(),
  };
}

export function mapSellerFromSupabase(row: any): Seller {
  return {
    id: String(row.id),
    name: row.name || 'Vendedor',
    phone: row.phone || '',
    branch: row.branch || 'Sede',
    email: row.email || '',
    role: normalizeUserRole(row.role),
    companyId: row.company_id ? String(row.company_id) : 'default_company',
    isActive: row.is_active !== false && row.ativo !== false,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

export function mapSellerToSupabase(seller: Seller): any {
  return {
    id: String(seller.id),
    name: seller.name,
    phone: seller.phone,
    branch: seller.branch || 'Sede',
    email: seller.email || null,
    role: seller.role || 'vendedor',
    company_id: seller.companyId || 'default_company',
    created_at: seller.createdAt ? new Date(seller.createdAt).toISOString() : new Date().toISOString(),
  };
}

export function mapClientFromSupabase(row: any): Client {
  return {
    id: String(row.id),
    name: row.name || 'Cliente',
    nif: row.nif || '',
    phone: row.phone || '',
    email: row.email || '',
    province: row.province || 'Luanda',
    municipality: row.municipality || 'Luanda',
    address: row.address || '',
    clientType: (row.client_type === 'particular' ? 'particular' : 'empresa') as any,
    creditLimit: Number(row.credit_limit || 0),
    notes: row.notes || '',
    createdBySellerId: row.created_by_seller_id ? String(row.created_by_seller_id) : undefined,
    companyId: row.company_id ? String(row.company_id) : 'default_company',
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

export function mapClientToSupabase(client: Client): any {
  return {
    id: String(client.id),
    name: client.name,
    nif: client.nif || null,
    phone: client.phone,
    email: client.email || null,
    province: client.province || 'Luanda',
    municipality: client.municipality || 'Luanda',
    address: client.address || null,
    client_type: client.clientType || 'empresa',
    credit_limit: client.creditLimit ?? 0,
    notes: client.notes || null,
    created_by_seller_id: client.createdBySellerId ? String(client.createdBySellerId) : null,
    company_id: client.companyId || 'default_company',
    created_at: client.createdAt ? new Date(client.createdAt).toISOString() : new Date().toISOString(),
  };
}

export function mapDebtFromSupabase(row: any, items: any[] = [], payments: any[] = []): Debt {
  const mappedItems: DebtItem[] = items.map(it => ({
    id: String(it.id),
    description: it.description || 'Produto',
    quantity: Number(it.quantity || 1),
    unitPrice: Number(it.unit_price || 0),
    total: Number(it.total || 0),
  }));

  const mappedPayments: Payment[] = payments.map(p => ({
    id: String(p.id),
    debtId: String(p.debt_id),
    amount: Number(p.amount || 0),
    date: p.date ? String(p.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    paymentMethod: p.payment_method || 'multicaixa_express',
    receiptRef: p.receipt_ref || '',
    notes: p.notes || '',
    receivedBy: p.received_by || 'Operador',
    createdAt: p.created_at ? String(p.created_at) : undefined,
  }));

  return {
    id: String(row.id),
    invoiceNumber: row.invoice_number || `FT-${row.id}`,
    clientId: String(row.client_id),
    sellerId: String(row.seller_id),
    companyId: row.company_id ? String(row.company_id) : 'default_company',
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    issueDate: row.issue_date ? String(row.issue_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    totalAmount: Number(row.total_amount || 0),
    status: (row.status || 'aberta') as any,
    paymentMethodAgreed: row.payment_method_agreed || 'multicaixa_express',
    terms: row.terms || '',
    items: mappedItems,
    payments: mappedPayments,
    confirmationStatus: row.confirmation_status || 'sem_sms',
    confirmationMode: row.confirmation_mode || 'pessoal',
    confirmationCode: row.confirmation_code || undefined,
    confirmationTransactionId: row.confirmation_transaction_id || undefined,
    reminder5DaysSent: Boolean(row.reminder_5_days_sent),
    reminder5DaysSentAt: row.reminder_5_days_sent_at ? String(row.reminder_5_days_sent_at) : undefined,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    updatedAt: row.updated_at ? String(row.updated_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

export function mapDebtToSupabase(debt: Debt): { debtRow: any; itemsRows: any[]; paymentsRows: any[] } {
  const debtRow = {
    id: String(debt.id),
    invoice_number: debt.invoiceNumber,
    client_id: String(debt.clientId),
    seller_id: String(debt.sellerId),
    company_id: debt.companyId || 'default_company',
    customer_name: debt.customerName || null,
    customer_phone: debt.customerPhone,
    issue_date: debt.issueDate || new Date().toISOString().slice(0, 10),
    due_date: debt.dueDate,
    total_amount: debt.totalAmount,
    status: debt.status || 'aberta',
    payment_method_agreed: debt.paymentMethodAgreed || 'multicaixa_express',
    terms: debt.terms || null,
    confirmation_status: debt.confirmationStatus || 'sem_sms',
    confirmation_mode: debt.confirmationMode || 'pessoal',
    confirmation_code: debt.confirmationCode || null,
    confirmation_transaction_id: debt.confirmationTransactionId || null,
    reminder_5_days_sent: Boolean(debt.reminder5DaysSent),
    reminder_5_days_sent_at: debt.reminder5DaysSentAt ? new Date(debt.reminder5DaysSentAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const itemsRows = (debt.items || []).map((it, idx) => ({
    id: it.id || `item-${debt.id}-${idx}`,
    debt_id: String(debt.id),
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    total: it.total,
  }));

  const paymentsRows = (debt.payments || []).map((p, idx) => ({
    id: p.id || `pay-${debt.id}-${idx}`,
    debt_id: String(debt.id),
    amount: p.amount,
    date: p.date || new Date().toISOString().slice(0, 10),
    payment_method: p.paymentMethod,
    receipt_ref: p.receiptRef,
    notes: p.notes || null,
    received_by: p.receivedBy || 'Operador',
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  }));

  return { debtRow, itemsRows, paymentsRows };
}

/**
 * Verifica a conectividade e saúde da ligação ao banco de dados Supabase via backend ou direto
 */
export async function testSupabaseConnection(): Promise<SupabaseHealthResult> {
  const start = performance.now();
  try {
    const res = await fetch('/api/supabase/status');
    if (res.ok) {
      const json = await res.json();
      return {
        connected: json.connected,
        url: json.url || SUPABASE_URL,
        projectId: json.projectId || SUPABASE_PROJECT_REF,
        latencyMs: json.latencyMs,
        message: json.message,
        tableExists: json.tableExists,
        counts: json.counts,
      };
    }
  } catch (backendErr) {
    console.warn('Backend status indisponível, testando diretamente o endpoint Supabase:', backendErr);
  }

  // Fallback: Teste direto no frontend
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const elapsed = Math.round(performance.now() - start);
    const isOk = response.status === 200 || response.status === 401 || response.status === 404 || response.status === 400;

    return {
      connected: isOk,
      url: SUPABASE_URL,
      projectId: SUPABASE_PROJECT_REF,
      latencyMs: elapsed,
      message: isOk ? 'Conexão direta estabelecida com o Supabase' : `Status inesperado: ${response.status}`,
    };
  } catch (error: any) {
    return {
      connected: false,
      url: SUPABASE_URL,
      projectId: SUPABASE_PROJECT_REF,
      message: error?.message || 'Falha ao conectar com o Supabase',
    };
  }
}

/**
 * Puxa todos os dados relacionais autorizados do Supabase (respeitando a sessão RLS do utilizador)
 */
export async function pullFromSupabase(): Promise<{
  success: boolean;
  hasData: boolean;
  data?: {
    debts: Debt[];
    clients: Client[];
    sellers: Seller[];
    utilizadores?: Utilizador[];
    company: CompanySettings;
    companies?: CompanySettings[];
    updatedAt?: string;
  };
  message?: string;
}> {
  try {
    const token = await getSupabaseAccessToken();
    if (!token) {
      return {
        success: false,
        hasData: false,
        message: 'Sessão não autenticada.',
      };
    }

    // 1. Consulta em paralelo às tabelas relacionais com o JWT do utilizador autenticado (RLS ativo)
    const [compRes, sellersRes, clientsRes, debtsRes, itemsRes, paysRes, utilRes] = await Promise.all([
      supabase.from('company_settings').select('*'),
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('debts').select('*').order('created_at', { ascending: false }),
      supabase.from('debt_items').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('utilizadores').select('*'),
    ]);

    const hasRelationalTables = !sellersRes.error || !clientsRes.error || !debtsRes.error || !compRes.error;

    if (hasRelationalTables) {
      const companyRows = compRes.data || [];
      const companies: CompanySettings[] = companyRows.map(r => mapCompanyFromSupabase(r));
      const defaultComp = companies.find(c => c.id === 'default_company') || companies[0] || mapCompanyFromSupabase(null);

      const sellers: Seller[] = (sellersRes.data || []).map(mapSellerFromSupabase);
      const clients: Client[] = (clientsRes.data || []).map(mapClientFromSupabase);
      const utilizadores: Utilizador[] = (!utilRes.error && Array.isArray(utilRes.data))
        ? utilRes.data.map((u: any) => mapUtilizadorFromRow(u))
        : [];

      const allItems = itemsRes.data || [];
      const allPayments = paysRes.data || [];

      const debts: Debt[] = (debtsRes.data || []).map(d => {
        const dItems = allItems.filter(it => String(it.debt_id) === String(d.id));
        const dPayments = allPayments.filter(p => String(p.debt_id) === String(d.id));
        return mapDebtFromSupabase(d, dItems, dPayments);
      });

      const hasAnyRecords = Boolean(
        companyRows.length > 0 || sellers.length > 0 || clients.length > 0 || debts.length > 0 || utilizadores.length > 0
      );

      if (hasAnyRecords) {
        return {
          success: true,
          hasData: true,
          data: {
            company: defaultComp,
            companies: companies.length > 0 ? companies : [defaultComp],
            utilizadores,
            sellers,
            clients,
            debts,
            updatedAt: new Date().toISOString(),
          },
          message: `Carregados do Supabase: ${companies.length} empresas, ${sellers.length} vendedores, ${clients.length} clientes, ${debts.length} dívidas`,
        };
      }
    }
  } catch (relErr) {
    console.warn('Erro ao ler tabelas relacionais do Supabase:', relErr);
  }

  return {
    success: false,
    hasData: false,
    message: 'Nenhum dado autorizado encontrado no Supabase.',
  };
}

/**
 * Sincroniza todos os dados para o Supabase (grava nas tabelas relacionais e no snapshot)
 */
export async function syncToSupabase(payload: {
  debts: Debt[];
  clients: Client[];
  sellers: Seller[];
  company: CompanySettings;
  companies?: CompanySettings[];
}): Promise<{ success: boolean; message: string; timestamp?: string; tableMissing?: boolean }> {
  let anySuccess = false;
  const errors: string[] = [];

  // 1. Sincronizar Empresas (company_settings)
  try {
    const companiesToSync = Array.isArray(payload.companies) && payload.companies.length > 0
      ? payload.companies
      : (payload.company ? [payload.company] : []);

    for (const comp of companiesToSync) {
      const saveRes = await saveCompanyToSupabase(comp);
      if (saveRes.success) anySuccess = true;
      else if (saveRes.error) errors.push(`Empresa (${comp.name}): ${saveRes.error}`);
    }
  } catch (e: any) {
    errors.push(`Empresa: ${e.message}`);
  }

  // 2. Sincronizar Vendedores (sellers)
  try {
    if (Array.isArray(payload.sellers) && payload.sellers.length > 0) {
      const sellerRows = payload.sellers.map(mapSellerToSupabase);
      const { error } = await supabase.from('sellers').upsert(sellerRows, { onConflict: 'id' });
      if (!error) {
        anySuccess = true;
      } else if (error.message && error.message.includes('company_id')) {
        const cleanSellerRows = sellerRows.map(({ company_id, ...rest }) => rest);
        const { error: retryErr } = await supabase.from('sellers').upsert(cleanSellerRows, { onConflict: 'id' });
        if (!retryErr) anySuccess = true;
        else errors.push(`Vendedores: ${retryErr.message}`);
      } else {
        errors.push(`Vendedores: ${error.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`Vendedores: ${e.message}`);
  }

  // 3. Sincronizar Clientes (clients)
  try {
    const clientMap = new Map<string, any>();
    if (Array.isArray(payload.clients)) {
      payload.clients.forEach(c => {
        if (c && c.id) clientMap.set(String(c.id), mapClientToSupabase(c));
      });
    }
    // Assegurar clientes referenciados por dívidas (vendas rápidas cli-quick)
    if (Array.isArray(payload.debts)) {
      payload.debts.forEach(d => {
        const cId = String(d.clientId || '');
        if (cId && !clientMap.has(cId)) {
          clientMap.set(cId, {
            id: cId,
            name: d.customerName || 'Cliente Particular',
            phone: d.customerPhone || '900000000',
            province: 'Luanda',
            municipality: 'Luanda',
            address: null,
            client_type: 'particular',
            credit_limit: 500000,
            notes: null,
            created_by_seller_id: d.sellerId ? String(d.sellerId) : null,
            company_id: d.companyId || payload.company?.id || 'default_company',
            created_at: new Date().toISOString(),
          });
        }
      });
    }

    if (clientMap.size > 0) {
      const clientRows = Array.from(clientMap.values());
      const { error } = await supabase.from('clients').upsert(clientRows, { onConflict: 'id' });
      if (!error) {
        anySuccess = true;
      } else if (error.message && error.message.includes('company_id')) {
        const cleanClientRows = clientRows.map(({ company_id, ...rest }) => rest);
        const { error: retryErr } = await supabase.from('clients').upsert(cleanClientRows, { onConflict: 'id' });
        if (!retryErr) anySuccess = true;
        else errors.push(`Clientes: ${retryErr.message}`);
      } else {
        errors.push(`Clientes: ${error.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`Clientes: ${e.message}`);
  }

  // 4. Sincronizar Dívidas (debts, debt_items, payments)
  try {
    if (Array.isArray(payload.debts) && payload.debts.length > 0) {
      const debtRows: any[] = [];
      const itemRows: any[] = [];
      const paymentRows: any[] = [];

      for (const d of payload.debts) {
        const mapped = mapDebtToSupabase(d);
        debtRows.push(mapped.debtRow);
        itemRows.push(...mapped.itemsRows);
        paymentRows.push(...mapped.paymentsRows);
      }

      let { error: debtErr } = await supabase.from('debts').upsert(debtRows, { onConflict: 'id' });
      if (debtErr && debtErr.message && debtErr.message.includes('company_id')) {
        const cleanDebtRows = debtRows.map(({ company_id, ...rest }) => rest);
        const retry = await supabase.from('debts').upsert(cleanDebtRows, { onConflict: 'id' });
        debtErr = retry.error;
      }
      if (!debtErr) {
        anySuccess = true;
        if (itemRows.length > 0) {
          await supabase.from('debt_items').upsert(itemRows, { onConflict: 'id' });
        }
        if (paymentRows.length > 0) {
          await supabase.from('payments').upsert(paymentRows, { onConflict: 'id' });
        }
      } else {
        errors.push(`Dívidas: ${debtErr.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`Dívidas: ${e.message}`);
  }

  // 5. Também notificar endpoint autenticado caso exista sessão ativa
  try {
    const token = await getSupabaseAccessToken();
    if (token) {
      await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    }
  } catch {
    // Backend offline transitório
  }

  if (anySuccess || errors.length === 0) {
    return {
      success: true,
      message: 'Dados sincronizados com o Supabase com sucesso!',
      timestamp: new Date().toISOString(),
    };
  }

  return {
    success: false,
    message: `Avisos na sincronização: ${errors.join(', ')}`,
  };
}

/**
 * Retorna o comando SQL para adicionar a coluna de senha na tabela das empresas
 */
export function getAddPasswordColumnSql(): string {
  return `-- Comando SQL para adicionar coluna de senha à tabela das empresas no Supabase:
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS senha TEXT DEFAULT 'admin';

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'admin';

-- Para atualizar a senha da sua empresa para um valor personalizado:
UPDATE public.company_settings 
SET senha = 'SuaNovaSenha123', password = 'SuaNovaSenha123'
WHERE id = 'default_company';
`;
}

/**
 * Retorna o esquema SQL completo para criar as tabelas no Supabase
 */
export async function fetchSupabaseSchemaSql(): Promise<string> {
  try {
    const res = await fetch('/api/supabase/schema');
    if (res.ok) {
      const json = await res.json();
      if (json.sql) return json.sql;
    }
  } catch (e) {
    console.warn('Erro ao buscar esquema SQL via API:', e);
  }
  return `-- Execute este script no SQL Editor do seu projeto Supabase (ckcwpcnsfennfjmjwoqp)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT 'default_company',
    name TEXT NOT NULL DEFAULT 'KwanzaCobro - Gestão de Dívidas Empresariais',
    nif TEXT DEFAULT '5401928374',
    phone TEXT DEFAULT '+244 923 884 100',
    email TEXT DEFAULT 'contacto@kwanzacobro.ao',
    address TEXT DEFAULT 'Edifício Kilamba, Luanda, Angola',
    city TEXT DEFAULT 'Luanda, Angola',
    bank_name TEXT DEFAULT 'Banco BAI (Banco Angolano de Investimentos)',
    iban TEXT DEFAULT 'AO06 0040 0000 9812 3456 1012 8',
    express_phone TEXT DEFAULT '923 884 100',
    currency TEXT DEFAULT 'Kz',
    logo_url TEXT,
    penalty_per_day_rate NUMERIC DEFAULT 0.1,
    days_before_due_alert INTEGER DEFAULT 5,
    auto_alert_notifications BOOLEAN DEFAULT TRUE,
    senha TEXT DEFAULT 'admin',
    password TEXT DEFAULT 'admin',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS senha TEXT DEFAULT 'admin';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'admin';
`;
}

/**
 * Operações Atómicas Diretas com Supabase (Persistência Imediata em Produção)
 */
export async function saveClientToSupabase(client: Client): Promise<{ success: boolean; error?: string }> {
  try {
    const row = mapClientToSupabase(client);
    const { error } = await supabase.from('clients').upsert(row, { onConflict: 'id' });
    if (error) {
      if (error.message && error.message.includes('company_id')) {
        const cleanRow = { ...row };
        delete cleanRow.company_id;
        const { error: retryErr } = await supabase.from('clients').upsert(cleanRow, { onConflict: 'id' });
        if (retryErr) return { success: false, error: retryErr.message };
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteClientFromSupabase(clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveSellerToSupabase(seller: Seller): Promise<{ success: boolean; error?: string }> {
  try {
    const row = mapSellerToSupabase(seller);
    const { error } = await supabase.from('sellers').upsert(row, { onConflict: 'id' });
    if (error) {
      if (error.message && error.message.includes('company_id')) {
        const cleanRow = { ...row };
        delete cleanRow.company_id;
        const { error: retryErr } = await supabase.from('sellers').upsert(cleanRow, { onConflict: 'id' });
        if (retryErr) return { success: false, error: retryErr.message };
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteSellerFromSupabase(sellerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('sellers').delete().eq('id', sellerId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveDebtToSupabase(debt: Debt): Promise<{ success: boolean; error?: string }> {
  try {
    const { debtRow, itemsRows, paymentsRows } = mapDebtToSupabase(debt);
    let { error: debtErr } = await supabase.from('debts').upsert(debtRow, { onConflict: 'id' });
    if (debtErr && debtErr.message && debtErr.message.includes('company_id')) {
      const cleanDebtRow = { ...debtRow };
      delete cleanDebtRow.company_id;
      const retry = await supabase.from('debts').upsert(cleanDebtRow, { onConflict: 'id' });
      debtErr = retry.error;
    }
    if (debtErr) return { success: false, error: debtErr.message };

    if (itemsRows.length > 0) {
      await supabase.from('debt_items').upsert(itemsRows, { onConflict: 'id' });
    }
    if (paymentsRows.length > 0) {
      await supabase.from('payments').upsert(paymentsRows, { onConflict: 'id' });
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function savePaymentToSupabase(
  debtId: string, 
  payment: Payment, 
  updatedDebt: Debt
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Gravar pagamento
    const paymentRow = {
      id: payment.id || `pay-${Date.now()}`,
      debt_id: String(debtId),
      amount: payment.amount,
      date: payment.date || new Date().toISOString().slice(0, 10),
      payment_method: payment.paymentMethod,
      receipt_ref: payment.receiptRef,
      notes: payment.notes || null,
      received_by: payment.receivedBy || 'Operador',
      created_at: payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString(),
    };
    const { error: payErr } = await supabase.from('payments').upsert(paymentRow, { onConflict: 'id' });
    if (payErr) return { success: false, error: payErr.message };

    // 2. Atualizar estado e auditoria da dívida
    await supabase.from('debts').update({
      status: updatedDebt.status,
      updated_at: new Date().toISOString(),
    }).eq('id', debtId);

    // 3. Registar na trilha de auditoria
    const auditPayload: any = {
      debt_id: debtId,
      company_id: updatedDebt.companyId || 'default_company',
      action: updatedDebt.status === 'liquidada' ? 'Quitação Total' : 'Amortização Registada',
      performed_by: payment.receivedBy || 'Operador',
      details: `Amortização de ${payment.amount} Kz (Ref: ${payment.receiptRef}) via ${payment.paymentMethod}`,
    };
    const { error: audErr } = await supabase.from('audit_trail').insert(auditPayload);
    if (audErr && audErr.message && audErr.message.includes('company_id')) {
      delete auditPayload.company_id;
      await supabase.from('audit_trail').insert(auditPayload);
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveCompanyToSupabase(company: CompanySettings): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Tentar via Vercel API /api/admin/companies caso disponível
    const token = await getSupabaseAccessToken();
    if (token) {
      try {
        const res = await fetch('/api/admin/companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return { success: true };
        }
      } catch {
        // Fallback direto via Supabase RLS
      }
    }

    const row = mapCompanyToSupabase(company);
    const { error } = await supabase.from('company_settings').upsert(row, { onConflict: 'id' });
    if (error) {
      if (error.message && error.message.includes('column')) {
        const cleanRow = { ...row };
        delete cleanRow.status;
        delete cleanRow.super_admin_id;
        const { error: retryError } = await supabase.from('company_settings').upsert(cleanRow, { onConflict: 'id' });
        if (retryError) return { success: false, error: retryError.message };
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteCompanyFromSupabase(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getSupabaseAccessToken();
    if (token) {
      try {
        const res = await fetch(`/api/admin/companies?companyId=${encodeURIComponent(companyId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return { success: true };
        }
      } catch {}
    }

    const { error } = await supabase.from('company_settings').delete().eq('id', companyId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Escuta alterações em tempo real via Supabase Realtime
 */
export function subscribeToSupabaseChanges(onDataChange: () => void): () => void {
  try {
    const channel = supabase
      .channel('kwanza-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, () => onDataChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => onDataChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => onDataChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => onDataChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, () => onDataChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'utilizadores' }, () => onDataChange())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
