import crypto from 'crypto';

export interface SMSSessionData {
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
  expiresAt: number;
  attemptsLeft: number;
  status: 'pendente' | 'confirmada' | 'expirada' | 'bloqueada' | 'cancelada';
  smsSent: boolean;
  providerConfigured: boolean;
  sandboxCode?: string;
  confirmedAt?: string;
  confirmationMode?: 'pessoal' | 'assistida';
  transactionId?: string;
  verificationCode?: string;
}

// In-memory fallback
export const globalSmsSessions = new Map<string, SMSSessionData>();
export const globalConfirmedTransactions = new Map<string, any>();

const HMAC_SECRET = process.env.SESSION_SECRET || 'kwanzacobro-sms-salt-sec-2026';

export function signSessionToken(session: SMSSessionData): string {
  const payload = JSON.stringify(session);
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:::${sig}`).toString('base64');
}

export function verifySessionToken(token: string): SMSSessionData | null {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const [payload, sig] = raw.split(':::');
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return JSON.parse(payload) as SMSSessionData;
    }
  } catch {
    return null;
  }
  return null;
}

export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.length < 7) return phone;
  const prefix = cleaned.slice(0, Math.min(6, cleaned.length - 3));
  const suffix = cleaned.slice(-2);
  return `${prefix} ••• •${suffix}`;
}

export function formatKz(amount: number): string {
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Kz';
}
