import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { requireIdentity } from '../_auth.js';
import { 
  SMSSessionData, 
  globalSmsSessions, 
  signSessionToken, 
  maskPhoneNumber, 
  formatKz 
} from './_session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const auth = await requireIdentity(req, res);
    if (!auth) return;
    const { 
      customerName, 
      storeName, 
      totalAmount, 
      operationRef, 
      items, 
    } = req.body || {};

    const clientPhone = req.body?.clientPhone || req.body?.customerPhone;

    if (!clientPhone || !customerName || !totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados da compra inválidos. Verifique o cliente, telefone e valor total.',
      });
    }

    // Normalizar telefone angolano
    let cleanPhone = String(clientPhone).replace(/[\s\-\(\)\.]/g, '');
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

    const smsMessage = `NEUROJUS: Foi registada uma compra a crédito no valor de ${formattedAmount} na loja ${store}. Para confirmar que reconhece esta dívida, utilize o código ${rawCode}. Não partilhe este código antes de verificar o valor e os produtos adquiridos.`;

    const smsApiKey = process.env.SMS_PROVIDER_API_KEY;
    const smsApiUrl = process.env.SMS_PROVIDER_URL;
    const smsSenderId = process.env.SMS_SENDER_ID || 'NEUROJUS';

    const providerConfigured = Boolean(smsApiKey && smsApiUrl);
    let smsSent = false;
    let gatewayResponse = '';

    if (providerConfigured && smsApiUrl) {
      try {
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

    const sessionRecord: SMSSessionData = {
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
      sandboxCode: rawCode,
    };

    globalSmsSessions.set(sessionId, sessionRecord);
    const sessionToken = signSessionToken(sessionRecord);

    return res.status(200).json({
      success: true,
      sessionId,
      sessionToken,
      operationRef: sessionRecord.operationRef,
      maskedPhone,
      expiresInSeconds: 300,
      attemptsLeft: 5,
      providerConfigured,
      smsSent,
      // Este código só é devolvido a uma sessão de funcionário autenticada,
      // para permitir a modalidade de envio manual por WhatsApp.
      verificationCode: rawCode,
      sandboxTestCode: rawCode,
      statusMessage: providerConfigured 
        ? (smsSent ? 'SMS enviado com sucesso para o cliente.' : 'Falha no envio da operadora SMS.')
        : 'Serviço de SMS não configurado (Envio manual ou direto disponível)',
    });
  } catch (err: any) {
    console.error('Erro ao gerar código SMS:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar confirmação por SMS.',
    });
  }
}
