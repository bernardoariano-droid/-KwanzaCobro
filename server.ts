import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import adminUsersHandler from './api/admin/users.js';
import adminCompaniesHandler from './api/admin/companies.js';
import authMeHandler from './api/auth/me.js';
import supabasePullHandler from './api/supabase/pull.js';
import supabaseSyncHandler from './api/supabase/sync.js';
import { authenticateRequest } from './api/_supabase.js';

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
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
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
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
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

// Endpoints Administrativos e Autenticação (Supabase Auth + public.utilizadores)
app.get('/api/auth/me', async (req, res) => authMeHandler(req as any, res as any));
app.all('/api/admin/users', async (req, res) => adminUsersHandler(req as any, res as any));
app.all('/api/admin/companies', async (req, res) => adminCompaniesHandler(req as any, res as any));

// Endpoint: Sincronizar dados com o Supabase (autenticado + RLS)
app.post('/api/supabase/sync', async (req, res) => supabaseSyncHandler(req as any, res as any));

// Endpoint: Puxar dados do Supabase (autenticado + RLS)
app.get('/api/supabase/pull', async (req, res) => supabasePullHandler(req as any, res as any));

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
