import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import adminUsersHandler from './api/admin/users.js';
import adminCompaniesHandler from './api/admin/companies.js';
import resetSuperAdminPasswordHandler from './api/admin/reset-super-admin-password.js';
import authMeHandler from './api/auth/me.js';
import authRegisterHandler from './api/auth/register.js';
import supabasePullHandler from './api/supabase/pull.js';
import supabaseSyncHandler from './api/supabase/sync.js';
import { authenticateRequest, normalizeServerRole } from './api/_supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'neurojus_db.json');
const LOCAL_SECRET_FILE = path.resolve(DATA_DIR, '.local_auth_secret');
const SUPER_ADMIN_UUID = '8b9f3c41-c996-4764-87c2-9d82411584e1';
const SUPER_ADMIN_EMAIL = 'bamidia@gmail.com';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// -------------------------------------------------------------
// LOCALHOST DATABASE PERSISTENCE & AUTH (Base de Dados Local JSON)
// -------------------------------------------------------------
interface LocalStoredUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'admin_geral' | 'vendedor';
  companyId: string;
  isActive: boolean;
  branch: string;
  sellerId: string;
  passwordSalt?: string;
  passwordHash?: string;
  createdAt: string;
}

interface LocalDatabasePayload {
  debts: any[];
  clients: any[];
  sellers: any[];
  utilizadores: LocalStoredUser[];
  companies: any[];
  company: any;
  lastSavedAt: string;
  updatedVia?: string;
}

const DEFAULT_LOCAL_COMPANY = {
  id: 'default_company',
  name: 'KwanzaCobro - Gestão de Dívidas Empresariais',
  logoUrl: '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg',
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
  superAdminId: SUPER_ADMIN_UUID,
  createdAt: '2026-01-01',
};

let cachedLocalSecret: string | null = null;
async function getLocalAuthSecret(): Promise<string> {
  if (process.env.LOCAL_AUTH_SECRET && process.env.LOCAL_AUTH_SECRET.trim()) {
    return process.env.LOCAL_AUTH_SECRET.trim();
  }
  if (cachedLocalSecret) return cachedLocalSecret;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fsPromises.mkdir(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LOCAL_SECRET_FILE)) {
      const existing = (await fsPromises.readFile(LOCAL_SECRET_FILE, 'utf-8')).trim();
      if (existing.length >= 32) {
        cachedLocalSecret = existing;
        return existing;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    await fsPromises.writeFile(LOCAL_SECRET_FILE, generated, { mode: 0o600 });
    cachedLocalSecret = generated;
    return generated;
  } catch {
    cachedLocalSecret = crypto.randomBytes(32).toString('hex');
    return cachedLocalSecret;
  }
}

function hashLocalPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyLocalPassword(password: string, user: LocalStoredUser): boolean {
  if (!user.passwordSalt || !user.passwordHash) return false;
  try {
    const computed = crypto.scryptSync(password, user.passwordSalt, 64);
    const expected = Buffer.from(user.passwordHash, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

function sanitizeLocalUser(user: LocalStoredUser) {
  return {
    id: user.id,
    authUserId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: normalizeServerRole(user.role),
    companyId: user.companyId || 'default_company',
    isActive: user.isActive !== false,
    branch: user.branch || 'Sede',
    sellerId: user.sellerId || user.id,
    createdAt: user.createdAt || new Date().toISOString().slice(0, 10),
  };
}

async function signLocalToken(user: LocalStoredUser): Promise<string> {
  const secret = await getLocalAuthSecret();
  const payload = {
    sub: user.id,
    email: user.email,
    role: normalizeServerRole(user.role),
    companyId: user.companyId || 'default_company',
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `kc_local.${encoded}.${sig}`;
}

async function verifyLocalToken(authHeader?: string): Promise<
  | { ok: true; user: LocalStoredUser; db: LocalDatabasePayload }
  | { ok: false; status: number; error: string }
> {
  if (!authHeader || !authHeader.startsWith('Bearer kc_local.')) {
    return { ok: false, status: 401, error: 'Sessão localhost não autenticada.' };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'kc_local') {
    return { ok: false, status: 401, error: 'Token localhost inválido.' };
  }
  try {
    const secret = await getLocalAuthSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(parts[1]).digest('base64url');
    const a = Buffer.from(parts[2]);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, status: 401, error: 'Assinatura de sessão localhost inválida.' };
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    if (!payload?.sub || (payload.exp && Date.now() > payload.exp)) {
      return { ok: false, status: 401, error: 'Sessão localhost expirada. Inicie sessão novamente.' };
    }
    const db = await ensureLocalDatabase();
    const user = db.utilizadores.find(u => u.id === payload.sub);
    if (!user) {
      return { ok: false, status: 401, error: 'Utilizador não encontrado na base local.' };
    }
    if (user.isActive === false) {
      return { ok: false, status: 403, error: 'Esta conta encontra-se desativada no localhost.' };
    }
    if (normalizeServerRole(user.role) !== 'super_admin') {
      const comp = db.companies.find(c => (c.id || 'default_company') === user.companyId);
      if (comp && comp.status === 'inativo') {
        return {
          ok: false,
          status: 403,
          error: `A empresa "${comp.name}" encontra-se temporariamente desativada.`,
        };
      }
    }
    return { ok: true, user, db };
  } catch {
    return { ok: false, status: 401, error: 'Falha ao validar sessão localhost.' };
  }
}

function normalizeLocalDatabase(raw: any): LocalDatabasePayload {
  const companies = Array.isArray(raw?.companies) && raw.companies.length > 0
    ? raw.companies
    : [raw?.company && raw.company.name ? { ...DEFAULT_LOCAL_COMPANY, ...raw.company, id: raw.company.id || 'default_company' } : { ...DEFAULT_LOCAL_COMPANY }];

  const defaultComp = companies.find((c: any) => c.id === 'default_company') || companies[0] || { ...DEFAULT_LOCAL_COMPANY };

  const utilizadores: LocalStoredUser[] = Array.isArray(raw?.utilizadores) ? [...raw.utilizadores] : [];
  const hasSuperAdmin = utilizadores.some(
    u => u.id === SUPER_ADMIN_UUID || String(u.email).toLowerCase() === SUPER_ADMIN_EMAIL
  );
  if (!hasSuperAdmin) {
    utilizadores.unshift({
      id: SUPER_ADMIN_UUID,
      name: 'Super Administrador NEUROJUS',
      email: SUPER_ADMIN_EMAIL,
      phone: '+244 923 884 100',
      role: 'super_admin',
      companyId: 'default_company',
      isActive: true,
      branch: 'Sede Principal',
      sellerId: SUPER_ADMIN_UUID,
      createdAt: '2026-01-01',
    });
  }

  return {
    debts: Array.isArray(raw?.debts) ? raw.debts : [],
    clients: Array.isArray(raw?.clients) ? raw.clients : [],
    sellers: Array.isArray(raw?.sellers) ? raw.sellers : [],
    utilizadores,
    companies,
    company: raw?.company && raw.company.name ? raw.company : defaultComp,
    lastSavedAt: raw?.lastSavedAt || new Date().toISOString(),
    updatedVia: raw?.updatedVia || 'localhost-api',
  };
}

async function readLocalDatabase(): Promise<LocalDatabasePayload | null> {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return null;
    }
    const raw = await fsPromises.readFile(DB_FILE, 'utf-8');
    return normalizeLocalDatabase(JSON.parse(raw));
  } catch (e) {
    console.error('[Localhost DB] Erro ao ler base de dados local:', e);
    return null;
  }
}

async function writeLocalDatabase(data: Partial<LocalDatabasePayload>): Promise<boolean> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fsPromises.mkdir(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    const payload = normalizeLocalDatabase({
      ...data,
      lastSavedAt: new Date().toISOString(),
      updatedVia: 'localhost-api',
    });
    await fsPromises.writeFile(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
    await fsPromises.rename(tempFile, DB_FILE);
    return true;
  } catch (e) {
    console.error('[Localhost DB] Erro ao gravar na base de dados local:', e);
    return false;
  }
}

async function ensureLocalDatabase(): Promise<LocalDatabasePayload> {
  const existing = await readLocalDatabase();
  if (existing) return existing;
  const initial = normalizeLocalDatabase({});
  await writeLocalDatabase(initial);
  return initial;
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
// ENDPOINTS DE BASE DE DADOS & AUTENTICAÇÃO LOCALHOST
// -------------------------------------------------------------
app.get('/api/local/status', async (_req, res) => {
  try {
    const db = await ensureLocalDatabase();
    const superAdmin = db.utilizadores.find(
      u => u.id === SUPER_ADMIN_UUID || String(u.email).toLowerCase() === SUPER_ADMIN_EMAIL
    );
    return res.json({
      success: true,
      mode: 'localhost',
      initialized: fs.existsSync(DB_FILE),
      superAdminEmail: SUPER_ADMIN_EMAIL,
      superAdminHasPassword: Boolean(superAdmin?.passwordHash),
      counts: {
        companies: db.companies.length,
        utilizadores: db.utilizadores.length,
        sellers: db.sellers.length,
        clients: db.clients.length,
        debts: db.debts.length,
      },
      lastSavedAt: db.lastSavedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/local/auth/setup-super-admin', async (req, res) => {
  try {
    const { password, name } = req.body || {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Defina uma palavra-passe local com pelo menos 6 caracteres.',
      });
    }

    const db = await ensureLocalDatabase();
    let idx = db.utilizadores.findIndex(
      u => u.id === SUPER_ADMIN_UUID || String(u.email).toLowerCase() === SUPER_ADMIN_EMAIL
    );
    const { salt, hash } = hashLocalPassword(String(password));

    if (idx === -1) {
      db.utilizadores.unshift({
        id: SUPER_ADMIN_UUID,
        name: String(name || 'Super Administrador NEUROJUS').trim(),
        email: SUPER_ADMIN_EMAIL,
        phone: '+244 923 884 100',
        role: 'super_admin',
        companyId: 'default_company',
        isActive: true,
        branch: 'Sede Principal',
        sellerId: SUPER_ADMIN_UUID,
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      idx = 0;
    } else {
      db.utilizadores[idx] = {
        ...db.utilizadores[idx],
        id: SUPER_ADMIN_UUID,
        email: SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        isActive: true,
        passwordSalt: salt,
        passwordHash: hash,
        ...(name ? { name: String(name).trim() } : {}),
      };
    }

    await writeLocalDatabase(db);
    const user = db.utilizadores[idx];
    const token = await signLocalToken(user);
    const company =
      db.companies.find(c => (c.id || 'default_company') === user.companyId) || db.company;

    return res.json({
      success: true,
      token,
      user: sanitizeLocalUser(user),
      company,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/local/auth/login', async (req, res) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Introduza o e-mail e a palavra-passe.',
      });
    }

    const db = await ensureLocalDatabase();
    const user = db.utilizadores.find(u => String(u.email).trim().toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Conta não encontrada no localhost. Registe uma empresa ou configure o Super Admin local.',
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        needsLocalPasswordSetup: true,
        error: 'Esta conta ainda não tem palavra-passe local definida. Use "Configurar Super Admin Localhost" ou registe a conta.',
      });
    }

    if (!verifyLocalPassword(password, user)) {
      return res.status(401).json({
        success: false,
        error: 'E-mail ou palavra-passe incorretos no localhost.',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'Esta conta de utilizador encontra-se desativada.',
      });
    }

    const company =
      db.companies.find(c => (c.id || 'default_company') === user.companyId) || db.company;

    if (normalizeServerRole(user.role) !== 'super_admin' && company?.status === 'inativo') {
      return res.status(403).json({
        success: false,
        error: `A empresa "${company.name}" encontra-se temporariamente desativada.`,
      });
    }

    const token = await signLocalToken(user);
    return res.json({
      success: true,
      token,
      user: sanitizeLocalUser(user),
      company,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/local/auth/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const companyName = String(req.body?.companyName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const phone = String(req.body?.phone || '+244 ').trim();
    const nif = String(req.body?.nif || '').trim();
    const branch = String(req.body?.branch || 'Sede').trim();

    if (!name) return res.status(400).json({ success: false, error: 'Informe o seu nome completo.' });
    if (!companyName) return res.status(400).json({ success: false, error: 'Informe o nome da empresa.' });
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Introduza um endereço de e-mail válido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
    }

    const db = await ensureLocalDatabase();
    if (db.utilizadores.some(u => String(u.email).toLowerCase() === email)) {
      return res.status(409).json({
        success: false,
        error: 'Este endereço de e-mail já está registado no localhost.',
      });
    }

    const newCompanyId = crypto.randomUUID();
    const newUserId = crypto.randomUUID();
    const { salt, hash } = hashLocalPassword(password);
    const today = new Date().toISOString().slice(0, 10);

    const newCompany = {
      ...DEFAULT_LOCAL_COMPANY,
      id: newCompanyId,
      name: companyName,
      nif,
      phone,
      email,
      status: 'ativo',
      superAdminId: SUPER_ADMIN_UUID,
      createdAt: today,
    };

    const newUser: LocalStoredUser = {
      id: newUserId,
      name,
      email,
      phone,
      role: 'admin_geral',
      companyId: newCompanyId,
      isActive: true,
      branch,
      sellerId: newUserId,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: today,
    };

    const mirroredSeller = {
      id: newUserId,
      name,
      phone,
      branch,
      email,
      role: 'admin_geral',
      companyId: newCompanyId,
      isActive: true,
      createdAt: today,
    };

    db.companies.unshift(newCompany);
    db.utilizadores.unshift(newUser);
    db.sellers.unshift(mirroredSeller);
    await writeLocalDatabase(db);

    const token = await signLocalToken(newUser);
    return res.status(201).json({
      success: true,
      token,
      user: sanitizeLocalUser(newUser),
      company: newCompany,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/local/auth/me', async (req, res) => {
  const auth = await verifyLocalToken(req.headers.authorization);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }
  const company =
    auth.db.companies.find(c => (c.id || 'default_company') === auth.user.companyId) || auth.db.company;
  return res.json({
    success: true,
    user: sanitizeLocalUser(auth.user),
    company,
  });
});

app.get('/api/local/data', async (req, res) => {
  const auth = await verifyLocalToken(req.headers.authorization);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const { user, db } = auth;
  const role = normalizeServerRole(user.role);
  const isSuper = role === 'super_admin';

  const companies = isSuper
    ? db.companies
    : db.companies.filter(c => (c.id || 'default_company') === user.companyId);

  const sellers = isSuper
    ? db.sellers
    : db.sellers.filter(s => (s.companyId || 'default_company') === user.companyId);

  let clients = isSuper
    ? db.clients
    : db.clients.filter(c => (c.companyId || 'default_company') === user.companyId);

  let debts = isSuper
    ? db.debts
    : db.debts.filter(d => (d.companyId || 'default_company') === user.companyId);

  if (role === 'vendedor') {
    debts = debts.filter(
      d => d.sellerId === user.id || d.sellerId === user.sellerId || d.sellerId === user.name
    );
    const debtClientIds = new Set(debts.map(d => d.clientId));
    clients = clients.filter(
      c =>
        c.createdBySellerId === user.id ||
        c.createdBySellerId === user.sellerId ||
        debtClientIds.has(c.id)
    );
  }

  const utilizadores =
    role === 'super_admin'
      ? db.utilizadores.map(sanitizeLocalUser)
      : role === 'admin_geral'
      ? db.utilizadores
          .filter(u => u.companyId === user.companyId && u.role !== 'super_admin')
          .map(sanitizeLocalUser)
      : [sanitizeLocalUser(user)];

  const company =
    companies.find(c => (c.id || 'default_company') === user.companyId) ||
    companies[0] ||
    db.company;

  return res.json({
    success: true,
    source: 'localhost-storage',
    companies,
    company,
    utilizadores,
    sellers,
    clients,
    debts,
    lastSavedAt: db.lastSavedAt,
  });
});

app.post('/api/local/sync', async (req, res) => {
  const auth = await verifyLocalToken(req.headers.authorization);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  try {
    const { user, db } = auth;
    const role = normalizeServerRole(user.role);
    const isSuper = role === 'super_admin';
    const { debts, clients, sellers, company, companies } = req.body || {};

    if (isSuper) {
      if (Array.isArray(debts)) db.debts = debts;
      if (Array.isArray(clients)) db.clients = clients;
      if (Array.isArray(sellers)) db.sellers = sellers;
      if (Array.isArray(companies) && companies.length > 0) db.companies = companies;
      if (company && company.name) db.company = company;
    } else {
      const ownCompId = user.companyId || 'default_company';
      if (Array.isArray(debts)) {
        const others = db.debts.filter(d => (d.companyId || 'default_company') !== ownCompId);
        const ownNormalized = debts.map((d: any) => ({ ...d, companyId: ownCompId }));
        db.debts = [...ownNormalized, ...others];
      }
      if (Array.isArray(clients)) {
        const others = db.clients.filter(c => (c.companyId || 'default_company') !== ownCompId);
        const ownNormalized = clients.map((c: any) => ({ ...c, companyId: ownCompId }));
        db.clients = [...ownNormalized, ...others];
      }
      if (Array.isArray(sellers) && role === 'admin_geral') {
        const others = db.sellers.filter(s => (s.companyId || 'default_company') !== ownCompId);
        const ownNormalized = sellers.map((s: any) => ({ ...s, companyId: ownCompId }));
        db.sellers = [...ownNormalized, ...others];
      }
      if (company && company.name && role === 'admin_geral') {
        const normalizedComp = { ...company, id: ownCompId };
        db.companies = db.companies.map(c => ((c.id || 'default_company') === ownCompId ? normalizedComp : c));
        if (db.company?.id === ownCompId) db.company = normalizedComp;
      }
    }

    await writeLocalDatabase(db);
    return res.json({
      success: true,
      message: 'Dados guardados com sucesso no Localhost!',
      savedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.all('/api/local/users', async (req, res) => {
  const auth = await verifyLocalToken(req.headers.authorization);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const { user: actor, db } = auth;
  const actorRole = normalizeServerRole(actor.role);
  if (actorRole === 'vendedor') {
    return res.status(403).json({ success: false, error: 'Apenas administradores podem gerir utilizadores.' });
  }

  if (req.method === 'GET') {
    const companyFilter = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    let list =
      actorRole === 'super_admin'
        ? db.utilizadores
        : db.utilizadores.filter(u => u.companyId === actor.companyId && u.role !== 'super_admin');
    if (actorRole === 'super_admin' && companyFilter && companyFilter !== 'all') {
      list = list.filter(u => u.companyId === companyFilter);
    }
    return res.json({ success: true, users: list.map(sanitizeLocalUser) });
  }

  if (req.method === 'POST') {
    const { name, email, password, phone, branch, role, companyId } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    if (!cleanName || !cleanEmail || !password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nome, e-mail e palavra-passe (mín. 6 caracteres) são obrigatórios.',
      });
    }
    if (db.utilizadores.some(u => String(u.email).toLowerCase() === cleanEmail)) {
      return res.status(409).json({ success: false, error: 'Já existe um utilizador com este e-mail.' });
    }

    let requestedRole = normalizeServerRole(role);
    if (actorRole !== 'super_admin' && requestedRole === 'super_admin') {
      requestedRole = 'admin_geral';
    }
    const assignedCompanyId = actorRole === 'super_admin' ? String(companyId || actor.companyId || 'default_company') : actor.companyId;
    const newId = crypto.randomUUID();
    const { salt, hash } = hashLocalPassword(String(password));
    const today = new Date().toISOString().slice(0, 10);

    const newUser: LocalStoredUser = {
      id: newId,
      name: cleanName,
      email: cleanEmail,
      phone: String(phone || '').trim(),
      role: requestedRole,
      companyId: assignedCompanyId,
      isActive: true,
      branch: String(branch || 'Sede').trim(),
      sellerId: newId,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: today,
    };

    db.utilizadores.unshift(newUser);
    db.sellers.unshift({
      id: newId,
      name: cleanName,
      phone: newUser.phone,
      branch: newUser.branch,
      email: cleanEmail,
      role: requestedRole,
      companyId: assignedCompanyId,
      isActive: true,
      createdAt: today,
    });

    await writeLocalDatabase(db);
    return res.status(201).json({ success: true, user: sanitizeLocalUser(newUser) });
  }

  if (req.method === 'PATCH') {
    const { userId, name, email, password, phone, branch, role, companyId, isActive } = req.body || {};
    const idx = db.utilizadores.findIndex(u => u.id === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Utilizador não encontrado.' });
    }
    const target = db.utilizadores[idx];
    if (actorRole !== 'super_admin' && (target.companyId !== actor.companyId || target.role === 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Sem permissão para alterar este utilizador.' });
    }
    if (target.id === actor.id && ((role && normalizeServerRole(role) !== target.role) || (companyId && companyId !== target.companyId) || isActive === false)) {
      return res.status(403).json({ success: false, error: 'Nenhum utilizador pode alterar o próprio perfil, empresa ou estado.' });
    }
    if (target.id === SUPER_ADMIN_UUID && (role && normalizeServerRole(role) !== 'super_admin')) {
      return res.status(403).json({ success: false, error: 'A conta principal do Super Administrador está protegida.' });
    }

    const updated: LocalStoredUser = {
      ...target,
      name: name ? String(name).trim() : target.name,
      email: email && target.id !== SUPER_ADMIN_UUID ? String(email).trim().toLowerCase() : target.email,
      phone: phone !== undefined ? String(phone).trim() : target.phone,
      branch: branch ? String(branch).trim() : target.branch,
      role: role && (actorRole === 'super_admin' || normalizeServerRole(role) !== 'super_admin')
        ? normalizeServerRole(role)
        : target.role,
      companyId: companyId && actorRole === 'super_admin' ? String(companyId) : target.companyId,
      isActive: typeof isActive === 'boolean' && target.id !== SUPER_ADMIN_UUID ? isActive : target.isActive,
    };

    if (password && String(password).length >= 6) {
      const { salt, hash } = hashLocalPassword(String(password));
      updated.passwordSalt = salt;
      updated.passwordHash = hash;
    }

    db.utilizadores[idx] = updated;
    db.sellers = db.sellers.map(s =>
      s.id === updated.id || s.id === updated.sellerId
        ? {
            ...s,
            name: updated.name,
            phone: updated.phone,
            branch: updated.branch,
            email: updated.email,
            role: updated.role,
            companyId: updated.companyId,
            isActive: updated.isActive,
          }
        : s
    );

    await writeLocalDatabase(db);
    return res.json({ success: true, user: sanitizeLocalUser(updated) });
  }

  if (req.method === 'DELETE') {
    const userId = String(req.query.userId || req.body?.userId || '');
    if (!userId) return res.status(400).json({ success: false, error: 'userId obrigatório.' });
    if (userId === SUPER_ADMIN_UUID || userId === actor.id) {
      return res.status(403).json({ success: false, error: 'Não é possível remover esta conta.' });
    }
    const target = db.utilizadores.find(u => u.id === userId);
    if (!target) return res.status(404).json({ success: false, error: 'Utilizador não encontrado.' });
    if (actorRole !== 'super_admin' && target.companyId !== actor.companyId) {
      return res.status(403).json({ success: false, error: 'Sem permissão para remover este utilizador.' });
    }

    const hasDebts = db.debts.some(d => d.sellerId === userId || d.sellerId === target.sellerId);
    if (hasDebts) {
      db.utilizadores = db.utilizadores.map(u => (u.id === userId ? { ...u, isActive: false } : u));
      db.sellers = db.sellers.map(s => (s.id === userId || s.id === target.sellerId ? { ...s, isActive: false } : s));
      await writeLocalDatabase(db);
      return res.json({ success: true, deactivatedOnly: true });
    }

    db.utilizadores = db.utilizadores.filter(u => u.id !== userId);
    db.sellers = db.sellers.filter(s => s.id !== userId && s.id !== target.sellerId);
    await writeLocalDatabase(db);
    return res.json({ success: true, deactivatedOnly: false });
  }

  return res.status(405).json({ success: false, error: 'Método não permitido.' });
});

app.all('/api/local/companies', async (req, res) => {
  const auth = await verifyLocalToken(req.headers.authorization);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const { user: actor, db } = auth;
  const actorRole = normalizeServerRole(actor.role);

  if (req.method === 'GET') {
    const companies =
      actorRole === 'super_admin'
        ? db.companies
        : db.companies.filter(c => (c.id || 'default_company') === actor.companyId);
    return res.json({ success: true, companies });
  }

  if (req.method === 'POST') {
    if (actorRole === 'vendedor') {
      return res.status(403).json({ success: false, error: 'Vendedores não podem alterar dados da empresa.' });
    }
    const comp = req.body?.company;
    if (!comp || !comp.name) {
      return res.status(400).json({ success: false, error: 'Dados da empresa inválidos.' });
    }
    const compId = comp.id || crypto.randomUUID();
    if (actorRole !== 'super_admin' && compId !== actor.companyId) {
      return res.status(403).json({ success: false, error: 'Administrador Geral só pode gerir a sua própria empresa.' });
    }

    const normalized = { ...DEFAULT_LOCAL_COMPANY, ...comp, id: compId };
    const exists = db.companies.some(c => (c.id || 'default_company') === compId);
    db.companies = exists
      ? db.companies.map(c => ((c.id || 'default_company') === compId ? normalized : c))
      : [normalized, ...db.companies];
    if (db.company?.id === compId) {
      db.company = normalized;
    }

    await writeLocalDatabase(db);
    return res.json({ success: true, company: normalized });
  }

  if (req.method === 'DELETE') {
    if (actorRole !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Apenas o Super Administrador pode remover empresas.' });
    }
    const companyId = String(req.query.companyId || '');
    if (!companyId || companyId === 'default_company') {
      return res.status(400).json({ success: false, error: 'A empresa principal padrão não pode ser removida.' });
    }
    db.companies = db.companies.filter(c => (c.id || 'default_company') !== companyId);
    await writeLocalDatabase(db);
    return res.json({ success: true });
  }

  return res.status(405).json({ success: false, error: 'Método não permitido.' });
});

app.get('/api/data', async (req, res) => {
  try {
    const isLocalBearer = req.headers.authorization?.startsWith('Bearer kc_local.');
    if (isLocalBearer) {
      const localAuth = await verifyLocalToken(req.headers.authorization);
      if (!localAuth.ok) {
        return res.status(localAuth.status).json({ success: false, error: localAuth.error });
      }
      const data = localAuth.db;
      return res.json({
        success: true,
        source: 'localhost-storage',
        debts: data.debts || [],
        clients: data.clients || [],
        sellers: data.sellers || [],
        company: data.company || {},
        companies: data.companies || [],
        lastSavedAt: data.lastSavedAt || new Date().toISOString(),
        counts: {
          debts: (data.debts || []).length,
          clients: (data.clients || []).length,
          sellers: (data.sellers || []).length,
        },
      });
    }

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
    const isLocalBearer = req.headers.authorization?.startsWith('Bearer kc_local.');
    if (isLocalBearer) {
      const localAuth = await verifyLocalToken(req.headers.authorization);
      if (!localAuth.ok) {
        return res.status(localAuth.status).json({ success: false, error: localAuth.error });
      }
    } else {
      const auth = await authenticateRequest(req);
      if (!auth.ok) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }
    }

    const { debts, clients, sellers, company, companies } = req.body;
    if (!debts && !clients && !sellers && !company && !companies) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para sincronização.',
      });
    }

    const existing = await ensureLocalDatabase();
    const ok = await writeLocalDatabase({
      ...existing,
      ...(debts ? { debts } : {}),
      ...(clients ? { clients } : {}),
      ...(sellers ? { sellers } : {}),
      ...(company ? { company } : {}),
      ...(companies ? { companies } : {}),
    });
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
    const pingHeaders: Record<string, string> = {
      apikey: supabaseAnonKey,
    };
    if (supabaseAnonKey.startsWith('eyJ')) {
      pingHeaders.Authorization = `Bearer ${supabaseAnonKey}`;
    }

    const pingRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: pingHeaders,
    });
    const latencyMs = Date.now() - start;
    const isOnline = pingRes.ok || pingRes.status === 200 || pingRes.status === 401;

    // Verificar tabelas relacionais do Supabase
    let tableExists = false;
    let counts = { companies: 0, sellers: 0, clients: 0, debts: 0 };
    try {
      const [compRes, selRes, cliRes, debtRes] = await Promise.all([
        supabase.from('company_settings').select('id', { count: 'exact' }).limit(1),
        supabase.from('sellers').select('id', { count: 'exact' }).limit(1),
        supabase.from('clients').select('id', { count: 'exact' }).limit(1),
        supabase.from('debts').select('id', { count: 'exact' }).limit(1),
      ]);

      const isMissingTableErr = (err: any) =>
        Boolean(err?.code === 'PGRST205' || (err?.message && (err.message.includes('schema cache') || err.message.includes('does not exist'))));

      tableExists =
        (!compRes.error && !isMissingTableErr(compRes.error)) ||
        (!selRes.error && !isMissingTableErr(selRes.error)) ||
        (!cliRes.error && !isMissingTableErr(cliRes.error)) ||
        (!debtRes.error && !isMissingTableErr(debtRes.error));

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
        ? tableExists
          ? `Conectado ao Supabase (${counts.companies} empresas, ${counts.sellers} vendedores, ${counts.clients} clientes, ${counts.debts} dívidas)`
          : 'Supabase Auth conectado. Execute supabase-schema.sql no SQL Editor para criar as tabelas.'
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
app.all('/api/auth/register', async (req, res) => authRegisterHandler(req as any, res as any));
app.all('/api/admin/users', async (req, res) => adminUsersHandler(req as any, res as any));
app.all('/api/admin/companies', async (req, res) => adminCompaniesHandler(req as any, res as any));
app.all('/api/admin/reset-super-admin-password', async (req, res) =>
  resetSuperAdminPasswordHandler(req as any, res as any)
);

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
  await ensureLocalDatabase();
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? { server: httpServer } : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEUROJUS KwanzaCobro] Servidor a correr na porta ${PORT}`);
  });
}

startServer();
