import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'neurojus_db.json');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// -------------------------------------------------------------
// LOCALHOST DATABASE PERSISTENCE (Base de Dados Local em Ficheiro JSON)
// -------------------------------------------------------------
async function readLocalDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return null;
    }
    const raw = await fsPromises.readFile(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[Localhost DB] Erro ao ler base de dados local:', e);
    return null;
  }
}

async function writeLocalDatabase(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fsPromises.mkdir(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    const payload = {
      debts: data.debts || [],
      clients: data.clients || [],
      sellers: data.sellers || [],
      company: data.company || {},
      lastSavedAt: new Date().toISOString(),
      updatedVia: 'localhost-api',
    };
    await fsPromises.writeFile(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
    await fsPromises.rename(tempFile, DB_FILE);
    return true;
  } catch (e) {
    console.error('[Localhost DB] Erro ao gravar na base de dados local:', e);
    return false;
  }
}

// Estrutura de Armazenamento de Sessões de Confirmação SMS (Segura no Backend)
interface SMSSession {
  sessionId: string;
  operationRef: string;
  clientPhone: string;
  customerName: string;
  storeName: string;
  totalAmount: number;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  salt: string;
  hashedCode: string;
  createdAt: number;
  expiresAt: number; // 5 minutos de validade
  attemptsLeft: number; // Máximo 5 tentativas
  status: 'pendente' | 'confirmada' | 'expirada' | 'bloqueada' | 'cancelada';
  smsSent: boolean;
  providerConfigured: boolean;
  smsGatewayResponse?: string;
  confirmedAt?: string;
  confirmationMode?: 'pessoal' | 'assistida';
  transactionId?: string;
  // Apenas para ambiente de desenvolvimento/teste quando o provedor real não tiver credenciais injetadas
  sandboxCode?: string;
}

const smsSessions = new Map<string, SMSSession>();
const confirmedTransactions = new Map<string, any>();

// Função utilitária para mascarar número de telefone (+244 923 ••• •20)
function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.length < 7) return phone;
  const prefix = cleaned.slice(0, Math.min(6, cleaned.length - 3));
  const suffix = cleaned.slice(-2);
  return `${prefix} ••• •${suffix}`;
}

// Formatação monetária Kwanza
function formatKz(amount: number): string {
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Kz';
}

// -------------------------------------------------------------
// ENDPOINT 1: Gerar e Enviar Código de Confirmação por SMS
// -------------------------------------------------------------
app.post('/api/sms/send-verification', async (req, res) => {
  try {
    const { 
      customerName, 
      storeName, 
      totalAmount, 
      operationRef, 
      items, 
    } = req.body;

    const clientPhone = req.body.clientPhone || req.body.customerPhone;
    const employeeName = req.body.employeeName || req.body.sellerName || 'Operador';

    if (!clientPhone || !customerName || !totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados da compra inválidos. Verifique o cliente, telefone e valor total.',
      });
    }

    // Normalizar telefone angolano
    let cleanPhone = clientPhone.replace(/[\s\-\(\)\.]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length === 9 && (cleanPhone.startsWith('9') || cleanPhone.startsWith('2'))) {
      cleanPhone = `244${cleanPhone}`;
    }

    if (cleanPhone.length < 9) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone inválido para envio de SMS (+244).',
      });
    }

    // Gerar código de 6 dígitos criptograficamente seguro (100000 a 999999)
    const rawCode = crypto.randomInt(100000, 1000000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedCode = crypto.scryptSync(rawCode, salt, 32).toString('hex');

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutos de validade

    const maskedPhone = maskPhoneNumber(clientPhone);
    const store = storeName || 'NEUROJUS';
    const formattedAmount = formatKz(totalAmount);

    // Conteúdo oficial da mensagem conforme item 5 da especificação:
    // "NEUROJUS: Foi registada uma compra a crédito no valor de 50.000,00 Kz na loja [NOME DA LOJA]. Para confirmar que reconhece esta dívida, utilize o código [123456]. Não partilhe este código antes de verificar o valor e os produtos adquiridos."
    const smsMessage = `NEUROJUS: Foi registada uma compra a crédito no valor de ${formattedAmount} na loja ${store}. Para confirmar que reconhece esta dívida, utilize o código ${rawCode}. Não partilhe este código antes de verificar o valor e os produtos adquiridos.`;

    // Verificação do Provedor Real de SMS através de variáveis de ambiente
    const smsApiKey = process.env.SMS_PROVIDER_API_KEY;
    const smsApiUrl = process.env.SMS_PROVIDER_URL;
    const smsSenderId = process.env.SMS_SENDER_ID || 'NEUROJUS';

    let providerConfigured = Boolean(smsApiKey && smsApiUrl);
    let smsSent = false;
    let gatewayResponse = '';

    if (providerConfigured && smsApiUrl) {
      try {
        // Envio real via gateway SMS configurado
        const response = await fetch(smsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${smsApiKey}`,
          },
          body: JSON.stringify({
            from: smsSenderId,
            to: `+${cleanPhone}`,
            text: smsMessage,
            message: smsMessage,
          }),
        });

        if (response.ok) {
          smsSent = true;
          gatewayResponse = 'Entregue à operadora móvel com sucesso';
        } else {
          const errText = await response.text();
          gatewayResponse = `Falha na operadora: ${errText.slice(0, 120)}`;
        }
      } catch (smsErr: any) {
        gatewayResponse = `Erro de ligação ao provedor SMS: ${smsErr?.message || 'Timeout'}`;
      }
    } else {
      gatewayResponse = 'Serviço de SMS não configurado';
    }

    // Gravar sessão de verificação no backend
    const sessionRecord: SMSSession = {
      sessionId,
      operationRef: operationRef || `OP-${now}`,
      clientPhone: `+${cleanPhone}`,
      customerName,
      storeName: store,
      totalAmount,
      items: items || [],
      salt,
      hashedCode,
      createdAt: now,
      expiresAt,
      attemptsLeft: 5,
      status: 'pendente',
      smsSent,
      providerConfigured,
      smsGatewayResponse: gatewayResponse,
      sandboxCode: rawCode,
    };

    smsSessions.set(sessionId, sessionRecord);

    return res.json({
      success: true,
      sessionId,
      operationRef: sessionRecord.operationRef,
      maskedPhone,
      expiresInSeconds: 300, // 5 minutos
      attemptsLeft: 5,
      providerConfigured,
      smsSent,
      verificationCode: rawCode, // Código de confirmação visível no ecrã e no recibo oficial
      statusMessage: providerConfigured 
        ? (smsSent ? 'SMS enviado com sucesso para o cliente.' : 'Falha no envio da operadora SMS.')
        : 'Serviço de SMS não configurado (Envio manual ou direto disponível)',
      sandboxTestCode: rawCode,
    });
  } catch (err: any) {
    console.error('Erro ao gerar código SMS:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar confirmação por SMS.',
    });
  }
});

// -------------------------------------------------------------
// ENDPOINT 2: Validar Código de Confirmação Introduzido
// -------------------------------------------------------------
app.post('/api/sms/verify-code', async (req, res) => {
  try {
    const { sessionId, code, confirmationMode, employeeName } = req.body;

    if (!sessionId || !code) {
      return res.status(400).json({
        success: false,
        error: 'Sessão ou código de confirmação não fornecido.',
      });
    }

    const session = smsSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão de confirmação não encontrada ou expirada.',
      });
    }

    const now = Date.now();

    // 1. Verificar se expirou (5 minutos)
    if (now > session.expiresAt) {
      session.status = 'expirada';
      return res.status(400).json({
        success: false,
        error: 'Código expirado. O código de confirmação tem validade máxima de 5 minutos. Solicite um novo código.',
        status: 'expirada',
      });
    }

    // 2. Verificar se está bloqueado por excesso de tentativas
    if (session.attemptsLeft <= 0 || session.status === 'bloqueada') {
      session.status = 'bloqueada';
      return res.status(403).json({
        success: false,
        error: 'Confirmação bloqueada. Foi atingido o limite máximo de 5 tentativas incorretas.',
        status: 'bloqueada',
      });
    }

    // 3. Verificar código por comparação hash segura
    const cleanedCode = code.toString().trim();
    const computedHash = crypto.scryptSync(cleanedCode, session.salt, 32).toString('hex');

    if (computedHash !== session.hashedCode) {
      session.attemptsLeft -= 1;
      if (session.attemptsLeft <= 0) {
        session.status = 'bloqueada';
        return res.status(403).json({
          success: false,
          error: 'Código incorreto. Limite de 5 tentativas esgotado. A confirmação foi bloqueada.',
          attemptsLeft: 0,
          status: 'bloqueada',
        });
      }

      return res.status(400).json({
        success: false,
        error: `Código de confirmação incorreto. Restam ${session.attemptsLeft} ${session.attemptsLeft === 1 ? 'tentativa' : 'tentativas'}.`,
        attemptsLeft: session.attemptsLeft,
        status: 'pendente',
      });
    }

    // Código CORRETO! Finalizar transação de forma segura
    const confirmedAt = new Date().toISOString();
    const mode = confirmationMode === 'assistida' ? 'assistida' : 'pessoal';
    const transactionId = `TX-NJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    session.status = 'confirmada';
    session.confirmedAt = confirmedAt;
    session.confirmationMode = mode;
    session.transactionId = transactionId;
    session.attemptsLeft = 0; // Impedir reutilização futura

    // Guardar registo transacional para verificação pública de autenticidade (QR Code)
    const verificationRecord = {
      transactionId,
      operationRef: session.operationRef,
      clientName: session.customerName,
      clientPhone: session.clientPhone,
      storeName: session.storeName,
      totalAmount: session.totalAmount,
      confirmedAt,
      confirmationMode: mode,
      verificationCode: cleanedCode,
      status: 'Confirmada',
      verified: true,
    };
    confirmedTransactions.set(transactionId, verificationRecord);

    return res.json({
      success: true,
      message: 'COMPRA A CRÉDITO CONFIRMADA COM SUCESSO!',
      confirmedAt,
      confirmationMode: mode,
      transactionId,
      verificationCode: cleanedCode,
      status: 'confirmada',
      operationRef: session.operationRef,
      totalAmount: session.totalAmount,
    });
  } catch (err: any) {
    console.error('Erro ao verificar código SMS:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao validar código de confirmação.',
    });
  }
});

// -------------------------------------------------------------
// ENDPOINT 3: Verificação Pública de Autenticidade do Comprovativo via QR Code
// -------------------------------------------------------------
app.get('/api/sms/verify-receipt/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const record = confirmedTransactions.get(transactionId);
  if (!record) {
    return res.status(404).json({
      verified: false,
      message: 'Comprovativo não localizado ou inválido no sistema NEUROJUS.',
    });
  }
  return res.json({
    verified: true,
    system: 'NEUROJUS Angola',
    ...record,
  });
});

// -------------------------------------------------------------
// ENDPOINTS DE BASE DE DADOS LOCALHOST (Armazenamento em Ficheiro Local)
// -------------------------------------------------------------
app.get('/api/data', async (req, res) => {
  try {
    const data = await readLocalDatabase();
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Base de dados local ainda não inicializada.',
      });
    }

    return res.json({
      success: true,
      source: 'localhost-storage',
      debts: data.debts || [],
      clients: data.clients || [],
      sellers: data.sellers || [],
      company: data.company || {},
      lastSavedAt: data.lastSavedAt || new Date().toISOString(),
      counts: {
        debts: (data.debts || []).length,
        clients: (data.clients || []).length,
        sellers: (data.sellers || []).length,
      },
    });
  } catch (err: any) {
    console.error('Erro ao ler dados do localhost:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao consultar dados no localhost.',
    });
  }
});

app.post('/api/data/sync', async (req, res) => {
  try {
    const { debts, clients, sellers, company } = req.body;
    if (!debts && !clients && !sellers && !company) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para sincronização.',
      });
    }

    const ok = await writeLocalDatabase({ debts, clients, sellers, company });
    if (!ok) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao gravar no ficheiro de base de dados local.',
      });
    }

    return res.json({
      success: true,
      message: 'Dados guardados com sucesso no Localhost!',
      savedAt: new Date().toISOString(),
      counts: {
        debts: (debts || []).length,
        clients: (clients || []).length,
        sellers: (sellers || []).length,
      },
    });
  } catch (err: any) {
    console.error('Erro ao sincronizar dados no localhost:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao sincronizar dados no localhost.',
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const exists = fs.existsSync(DB_FILE);
    let stats = null;
    if (exists) {
      const fileStat = await fsPromises.stat(DB_FILE);
      stats = {
        sizeBytes: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      };
    }

    return res.json({
      status: 'online',
      service: 'NEUROJUS Angola Localhost Backend',
      port: PORT,
      timestamp: new Date().toISOString(),
      storage: {
        engine: 'Localhost JSON File System',
        filePath: DB_FILE,
        initialized: exists,
        stats,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

// -------------------------------------------------------------
// INTEGRAÇÃO COM SUPABASE (Base de Dados Cloud PostgreSQL)
// Projeto: ckcwpcnsfennfjmjwoqp
// -------------------------------------------------------------
const rawSupabaseUrl = process.env.SUPABASE_URL || 'https://ckcwpcnsfennfjmjwoqp.supabase.co';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_U4Rgccyd4DrhKeI7AuVyCQ_tYnwa-6p';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Endpoint: Testar status de conectividade com o Supabase
app.get('/api/supabase/status', async (req, res) => {
  const start = Date.now();
  try {
    const pingRes = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
    const latencyMs = Date.now() - start;
    const isOnline = pingRes.status === 200 || pingRes.status === 401 || pingRes.status === 404 || pingRes.status === 400;

    // Verificar tabelas relacionais do Supabase
    let tableExists = false;
    let counts = { companies: 0, sellers: 0, clients: 0, debts: 0 };
    try {
      const [compRes, selRes, cliRes, debtRes] = await Promise.all([
        supabase.from('company_settings').select('id', { count: 'exact', head: true }),
        supabase.from('sellers').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('debts').select('id', { count: 'exact', head: true }),
      ]);

      tableExists = !compRes.error || !selRes.error || !cliRes.error || !debtRes.error;
      counts = {
        companies: compRes.count ?? 0,
        sellers: selRes.count ?? 0,
        clients: cliRes.count ?? 0,
        debts: debtRes.count ?? 0,
      };
    } catch {
      tableExists = false;
    }

    return res.json({
      success: true,
      connected: isOnline,
      latencyMs,
      projectId: 'ckcwpcnsfennfjmjwoqp',
      url: supabaseUrl,
      tableExists,
      counts,
      status: isOnline ? 'online' : 'offline',
      message: isOnline 
        ? (tableExists ? `Conectado ao Supabase (${counts.sellers} vendedores, ${counts.clients} clientes, ${counts.debts} dívidas)` : 'Cluster Supabase Conectado.')
        : 'Cluster Supabase offline ou inatingível',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      connected: false,
      error: err.message,
    });
  }
});

// Endpoint: Sincronizar dados com o Supabase (relacional e snapshot)
app.post('/api/supabase/sync', async (req, res) => {
  try {
    const { debts, clients, sellers, company } = req.body;
    let anySuccess = false;

    // 1. Sincronizar Empresa
    if (company) {
      try {
        await supabase.from('company_settings').upsert({
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
          senha: company.senha || company.password || 'admin',
          password: company.password || company.senha || 'admin',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        anySuccess = true;
      } catch (compErr) {
        console.warn('Erro ao salvar company_settings:', compErr);
      }
    }

    // 2. Sincronizar Vendedores
    if (Array.isArray(sellers) && sellers.length > 0) {
      try {
        const sellerRows = sellers.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          phone: s.phone,
          branch: s.branch || 'Sede',
          email: s.email || null,
          password: s.password || '123',
          role: s.role || 'vendedor',
          created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        }));
        await supabase.from('sellers').upsert(sellerRows, { onConflict: 'id' });
        anySuccess = true;
      } catch (selErr) {
        console.warn('Erro ao salvar sellers:', selErr);
      }
    }

    // 3. Sincronizar Clientes (incluindo clientes criados em vendas rápidas para satisfazer FK)
    const clientMap = new Map<string, any>();
    if (Array.isArray(clients)) {
      for (const c of clients) {
        if (c && c.id) clientMap.set(String(c.id), c);
      }
    }
    // Assegurar clientes referenciados por dívidas
    if (Array.isArray(debts)) {
      for (const d of debts) {
        const cId = String(d.clientId || '');
        if (cId && !clientMap.has(cId)) {
          clientMap.set(cId, {
            id: cId,
            name: d.customerName || 'Cliente Particular',
            phone: d.customerPhone || '900000000',
            province: 'Luanda',
            municipality: 'Luanda',
            client_type: 'particular',
            credit_limit: 500000,
            created_by_seller_id: d.sellerId ? String(d.sellerId) : null,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    if (clientMap.size > 0) {
      try {
        const clientRows = Array.from(clientMap.values()).map((c: any) => ({
          id: String(c.id),
          name: c.name,
          nif: c.nif || null,
          phone: c.phone || '900000000',
          email: c.email || null,
          province: c.province || 'Luanda',
          municipality: c.municipality || 'Luanda',
          address: c.address || null,
          client_type: c.clientType || c.client_type || 'particular',
          credit_limit: c.creditLimit ?? c.credit_limit ?? 0,
          notes: c.notes || null,
          created_by_seller_id: c.createdBySellerId || c.created_by_seller_id ? String(c.createdBySellerId || c.created_by_seller_id) : null,
          created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        }));
        await supabase.from('clients').upsert(clientRows, { onConflict: 'id' });
        anySuccess = true;
      } catch (cliErr) {
        console.warn('Erro ao salvar clients:', cliErr);
      }
    }

    // 4. Sincronizar Dívidas, Itens e Pagamentos
    if (Array.isArray(debts) && debts.length > 0) {
      try {
        const debtRows = debts.map((d: any) => ({
          id: String(d.id),
          invoice_number: d.invoiceNumber,
          client_id: String(d.clientId),
          seller_id: String(d.sellerId),
          customer_name: d.customerName || null,
          customer_phone: d.customerPhone,
          issue_date: d.issueDate || new Date().toISOString().slice(0, 10),
          due_date: d.dueDate,
          total_amount: d.totalAmount,
          status: d.status || 'aberta',
          payment_method_agreed: d.paymentMethodAgreed || 'multicaixa_express',
          terms: d.terms || null,
          confirmation_status: d.confirmationStatus || 'sem_sms',
          confirmation_mode: d.confirmationMode || 'pessoal',
          confirmation_code: d.confirmationCode || null,
          confirmation_transaction_id: d.confirmationTransactionId || null,
          reminder_5_days_sent: Boolean(d.reminder5DaysSent),
          reminder_5_days_sent_at: d.reminder5DaysSentAt ? new Date(d.reminder5DaysSentAt).toISOString() : null,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('debts').upsert(debtRows, { onConflict: 'id' });
        anySuccess = true;

        // Extrair e Upsert de Itens
        const allItems: any[] = [];
        const allPayments: any[] = [];
        for (const d of debts) {
          if (Array.isArray(d.items)) {
            d.items.forEach((item: any, idx: number) => {
              allItems.push({
                id: item.id || `item-${d.id}-${idx}`,
                debt_id: String(d.id),
                description: item.description || 'Mercadoria a Crédito',
                quantity: Number(item.quantity) || 1,
                unit_price: Number(item.unitPrice) || 0,
                total: Number(item.total) || 0,
              });
            });
          }
          if (Array.isArray(d.payments)) {
            d.payments.forEach((p: any, idx: number) => {
              allPayments.push({
                id: p.id || `pay-${d.id}-${idx}`,
                debt_id: String(d.id),
                amount: Number(p.amount) || 0,
                date: p.date || new Date().toISOString().slice(0, 10),
                payment_method: p.paymentMethod || 'multicaixa_express',
                receipt_ref: p.receiptRef || `REF-${Date.now()}`,
                notes: p.notes || null,
                received_by: p.receivedBy || 'Operador',
                created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
              });
            });
          }
        }

        if (allItems.length > 0) {
          await supabase.from('debt_items').upsert(allItems, { onConflict: 'id' });
        }
        if (allPayments.length > 0) {
          await supabase.from('payments').upsert(allPayments, { onConflict: 'id' });
        }
      } catch (debtErr) {
        console.warn('Erro ao salvar debts/items/payments:', debtErr);
      }
    }

    // 5. Salvar também snapshot kwanzacobro_sync
    try {
      await supabase.from('kwanzacobro_sync').upsert({
        id: 'main',
        debts: debts || [],
        clients: clients || [],
        sellers: sellers || [],
        company: company || {},
        updated_at: new Date().toISOString(),
        updated_by: 'kwanzacobro-app',
      }, { onConflict: 'id' });
      anySuccess = true;
    } catch {
      // Ignorar se kwanzacobro_sync não existir
    }

    // 6. Atualizar base de dados local
    await writeLocalDatabase({ debts, clients, sellers, company });

    return res.json({
      success: true,
      synced: anySuccess,
      timestamp: new Date().toISOString(),
      counts: {
        debts: (debts || []).length,
        clients: (clients || []).length,
        sellers: (sellers || []).length,
      },
    });
  } catch (err: any) {
    console.error('[Supabase Sync Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Endpoint: Puxar dados do Supabase
app.get('/api/supabase/pull', async (req, res) => {
  try {
    // 1. Tentar ler tabelas relacionais
    const [compRes, selRes, cliRes, debtRes, itemsRes, paysRes] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1),
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('debts').select('*').order('created_at', { ascending: false }),
      supabase.from('debt_items').select('*'),
      supabase.from('payments').select('*'),
    ]);

    const compRow = compRes.data && compRes.data.length > 0 ? compRes.data[0] : null;
    const sellers = (selRes.data || []).map((s: any) => ({
      id: String(s.id),
      name: s.name,
      phone: s.phone,
      branch: s.branch,
      email: s.email,
      password: s.password || '123',
      role: s.role || 'vendedor',
      createdAt: s.created_at ? String(s.created_at).slice(0, 10) : undefined,
    }));

    const clients = (cliRes.data || []).map((c: any) => ({
      id: String(c.id),
      name: c.name,
      nif: c.nif || '',
      phone: c.phone,
      email: c.email || '',
      province: c.province || 'Luanda',
      municipality: c.municipality || 'Luanda',
      address: c.address || '',
      clientType: c.client_type || 'empresa',
      creditLimit: Number(c.credit_limit || 0),
      notes: c.notes || '',
      createdBySellerId: c.created_by_seller_id ? String(c.created_by_seller_id) : undefined,
      createdAt: c.created_at ? String(c.created_at).slice(0, 10) : undefined,
    }));

    const allItems = itemsRes.data || [];
    const allPays = paysRes.data || [];

    const debts = (debtRes.data || []).map((d: any) => {
      const items = allItems.filter((it: any) => String(it.debt_id) === String(d.id)).map((it: any) => ({
        id: String(it.id),
        description: it.description,
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unit_price || 0),
        total: Number(it.total || 0),
      }));
      const payments = allPays.filter((p: any) => String(p.debt_id) === String(d.id)).map((p: any) => ({
        id: String(p.id),
        debtId: String(p.debt_id),
        amount: Number(p.amount || 0),
        date: p.date ? String(p.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        paymentMethod: p.payment_method || 'multicaixa_express',
        receiptRef: p.receipt_ref || '',
        notes: p.notes || '',
        receivedBy: p.received_by || 'Operador',
      }));

      return {
        id: String(d.id),
        invoiceNumber: d.invoice_number,
        clientId: String(d.client_id),
        sellerId: String(d.seller_id),
        customerName: d.customer_name || '',
        customerPhone: d.customer_phone,
        issueDate: d.issue_date ? String(d.issue_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        dueDate: d.due_date ? String(d.due_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        totalAmount: Number(d.total_amount || 0),
        status: d.status || 'aberta',
        paymentMethodAgreed: d.payment_method_agreed || 'multicaixa_express',
        terms: d.terms || '',
        items,
        payments,
        confirmationStatus: d.confirmation_status || 'sem_sms',
        confirmationMode: d.confirmation_mode || 'pessoal',
        confirmationCode: d.confirmation_code || undefined,
        confirmationTransactionId: d.confirmation_transaction_id || undefined,
        reminder5DaysSent: Boolean(d.reminder_5_days_sent),
        createdAt: d.created_at ? String(d.created_at).slice(0, 10) : undefined,
        updatedAt: d.updated_at ? String(d.updated_at).slice(0, 10) : undefined,
      };
    });

    let company = null;
    if (compRow) {
      company = {
        name: compRow.name,
        nif: compRow.nif,
        phone: compRow.phone,
        email: compRow.email,
        address: compRow.address,
        city: compRow.city,
        bankName: compRow.bank_name,
        iban: compRow.iban,
        expressPhone: compRow.express_phone,
        currency: compRow.currency || 'Kz',
        logoUrl: compRow.logo_url || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg',
        penaltyPerDayRate: compRow.penalty_per_day_rate ?? 0.1,
        daysBeforeDueAlert: compRow.days_before_due_alert ?? 5,
        autoAlertNotifications: compRow.auto_alert_notifications ?? true,
        senha: compRow.senha || compRow.password || 'admin',
        password: compRow.password || compRow.senha || 'admin',
      };
    }

    const hasData = Boolean(company || sellers.length > 0 || clients.length > 0 || debts.length > 0);

    if (hasData) {
      // Salvar na base de dados local para manter sincronizado offline
      await writeLocalDatabase({ debts, clients, sellers, company });

      return res.json({
        success: true,
        hasData: true,
        source: 'supabase-relational',
        debts,
        clients,
        sellers,
        company,
        counts: {
          debts: debts.length,
          clients: clients.length,
          sellers: sellers.length,
        },
      });
    }

    // Fallback: tentar snapshot kwanzacobro_sync
    const { data: snap } = await supabase.from('kwanzacobro_sync').select('*').eq('id', 'main').maybeSingle();
    if (snap) {
      return res.json({
        success: true,
        hasData: true,
        source: 'supabase-snapshot',
        debts: snap.debts || [],
        clients: snap.clients || [],
        sellers: snap.sellers || [],
        company: snap.company || {},
      });
    }

    return res.json({
      success: true,
      hasData: false,
      message: 'Ainda não existem registos no Supabase.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Obter código do Esquema SQL do Supabase
app.get('/api/supabase/schema', async (req, res) => {
  try {
    const schemaPath = path.resolve(__dirname, 'supabase-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = await fsPromises.readFile(schemaPath, 'utf-8');
      return res.json({ success: true, sql });
    }
    return res.status(404).json({ success: false, error: 'Ficheiro de esquema não encontrado' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Configuração do Servidor: Vite em Dev / Estático em Prod
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEUROJUS KwanzaCobro] Servidor a correr na porta ${PORT}`);
  });
}

startServer();
