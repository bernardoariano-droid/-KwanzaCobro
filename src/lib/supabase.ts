import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CompanySettings, Seller, Client, Debt, DebtItem, Payment } from '../types/debt';

// Função para sanitizar a URL fornecida pelo utilizador (remover /rest/v1/ se presente)
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

const env = (import.meta as any).env || {};
export const SUPABASE_URL = sanitizeSupabaseUrl(env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0] || 'unconfigured';
  } catch {
    return 'unconfigured';
  }
})();

// Apenas a chave anon/publishable pode estar no frontend. Nunca colocar service_role aqui.
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://missing-project.supabase.co',
  SUPABASE_ANON_KEY || 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

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
    };
  }

  return {
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
  };
}

export function mapCompanyToSupabase(company: CompanySettings): any {
  return {
    id: 'default_company',
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
    role: (row.role === 'admin' ? 'admin' : 'vendedor') as any,
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
  if (!SUPABASE_CONFIGURED) {
    return {
      connected: false,
      url: SUPABASE_URL,
      projectId: SUPABASE_PROJECT_REF,
      message: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente.',
    };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = sessionData.session ? await fetch('/api/supabase/status', { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }) : null;
    if (res?.ok) {
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
 * Puxa todos os dados relacionais do Supabase (Empresa, Vendedores, Clientes e Dívidas)
 */
export async function pullFromSupabase(): Promise<{
  success: boolean;
  hasData: boolean;
  data?: {
    debts: Debt[];
    clients: Client[];
    sellers: Seller[];
    company: CompanySettings;
    updatedAt?: string;
  };
  message?: string;
}> {
  try {
    // 1. Consulta em paralelo às tabelas relacionais do Supabase
    const [compRes, sellersRes, clientsRes, debtsRes, itemsRes, paysRes] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1),
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('debts').select('*').order('created_at', { ascending: false }),
      supabase.from('debt_items').select('*'),
      supabase.from('payments').select('*'),
    ]);

    const hasRelationalTables = !sellersRes.error || !clientsRes.error || !debtsRes.error || !compRes.error;

    if (hasRelationalTables) {
      const companyRow = compRes.data && compRes.data.length > 0 ? compRes.data[0] : null;
      const company = mapCompanyFromSupabase(companyRow);

      const sellers: Seller[] = (sellersRes.data || []).map(mapSellerFromSupabase);
      const clients: Client[] = (clientsRes.data || []).map(mapClientFromSupabase);

      const allItems = itemsRes.data || [];
      const allPayments = paysRes.data || [];

      const debts: Debt[] = (debtsRes.data || []).map(d => {
        const dItems = allItems.filter(it => String(it.debt_id) === String(d.id));
        const dPayments = allPayments.filter(p => String(p.debt_id) === String(d.id));
        return mapDebtFromSupabase(d, dItems, dPayments);
      });

      const hasAnyRecords = Boolean(companyRow || sellers.length > 0 || clients.length > 0 || debts.length > 0);

      if (hasAnyRecords) {
        return {
          success: true,
          hasData: true,
          data: {
            company,
            sellers,
            clients,
            debts,
            updatedAt: new Date().toISOString(),
          },
          message: `Carregados do Supabase: ${sellers.length} vendedores, ${clients.length} clientes, ${debts.length} dívidas`,
        };
      }
    }
  } catch (relErr) {
    console.warn('Erro ao ler tabelas relacionais do Supabase, tentando snapshot:', relErr);
  }

  // 2. Fallback: tentar snapshot kwanzacobro_sync
  try {
    const { data, error } = await supabase
      .from('kwanzacobro_sync')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();

    if (!error && data) {
      return {
        success: true,
        hasData: true,
        data: {
          debts: data.debts || [],
          clients: data.clients || [],
          sellers: data.sellers || [],
          company: data.company || {},
          updatedAt: data.updated_at,
        },
      };
    }
  } catch (snapErr) {
    console.warn('Erro ao ler snapshot do Supabase:', snapErr);
  }

  return {
    success: false,
    hasData: false,
    message: 'Nenhum dado encontrado no Supabase.',
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
}): Promise<{ success: boolean; message: string; timestamp?: string; tableMissing?: boolean }> {
  let anySuccess = false;
  const errors: string[] = [];

  // 1. Sincronizar Empresa (company_settings)
  try {
    if (payload.company) {
      const companyRow = mapCompanyToSupabase(payload.company);
      const { error } = await supabase.from('company_settings').upsert(companyRow, { onConflict: 'id' });
      if (!error) anySuccess = true;
      else errors.push(`Empresa: ${error.message}`);
    }
  } catch (e: any) {
    errors.push(`Empresa: ${e.message}`);
  }

  // 2. Sincronizar Vendedores (sellers)
  try {
    if (Array.isArray(payload.sellers) && payload.sellers.length > 0) {
      const sellerRows = payload.sellers.map(mapSellerToSupabase);
      const { error } = await supabase.from('sellers').upsert(sellerRows, { onConflict: 'id' });
      if (!error) anySuccess = true;
      else errors.push(`Vendedores: ${error.message}`);
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
            created_at: new Date().toISOString(),
          });
        }
      });
    }

    if (clientMap.size > 0) {
      const clientRows = Array.from(clientMap.values());
      const { error } = await supabase.from('clients').upsert(clientRows, { onConflict: 'id' });
      if (!error) anySuccess = true;
      else errors.push(`Clientes: ${error.message}`);
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

      const { error: debtErr } = await supabase.from('debts').upsert(debtRows, { onConflict: 'id' });
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

  // 5. Gravar snapshot geral (kwanzacobro_sync)
  try {
    await supabase.from('kwanzacobro_sync').upsert({
      id: 'main',
      debts: payload.debts || [],
      clients: payload.clients || [],
      sellers: payload.sellers || [],
      company: payload.company || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch {
    // Snapshot opcional
  }

  // 6. Também enviar ao backend para garantir persistência no ficheiro local
  try {
    await fetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
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
    if (error) return { success: false, error: error.message };
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
    if (error) return { success: false, error: error.message };
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
    const { error: debtErr } = await supabase.from('debts').upsert(debtRow, { onConflict: 'id' });
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
    await supabase.from('audit_trail').insert({
      debt_id: debtId,
      action: updatedDebt.status === 'liquidada' ? 'Quitação Total' : 'Amortização Registada',
      performed_by: payment.receivedBy || 'Operador',
      details: `Amortização de ${payment.amount} Kz (Ref: ${payment.receiptRef}) via ${payment.paymentMethod}`,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveCompanyToSupabase(company: CompanySettings): Promise<{ success: boolean; error?: string }> {
  try {
    const row = mapCompanyToSupabase(company);
    const { error } = await supabase.from('company_settings').upsert(row, { onConflict: 'id' });
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
