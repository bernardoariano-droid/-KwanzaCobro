import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { 
  SMSSessionData, 
  globalSmsSessions, 
  globalConfirmedTransactions, 
  verifySessionToken 
} from './_session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const { sessionId, code, confirmationMode, sessionToken } = req.body || {};

    if ((!sessionId && !sessionToken) || !code) {
      return res.status(400).json({
        success: false,
        error: 'Sessão ou código de confirmação não fornecido.',
      });
    }

    let session: SMSSessionData | undefined = sessionId ? globalSmsSessions.get(sessionId) : undefined;
    if (!session && sessionToken) {
      const decoded = verifySessionToken(sessionToken);
      if (decoded) session = decoded;
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão de confirmação não encontrada ou expirada.',
      });
    }

    const now = Date.now();

    // 1. Verificar expiração (5 minutos)
    if (now > session.expiresAt) {
      session.status = 'expirada';
      return res.status(400).json({
        success: false,
        error: 'Código expirado. O código de confirmação tem validade máxima de 5 minutos. Solicite um novo código.',
        status: 'expirada',
      });
    }

    // 2. Verificar limite de tentativas
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

    // Código CORRETO! Finalizar transação
    const confirmedAt = new Date().toISOString();
    const mode = confirmationMode === 'assistida' ? 'assistida' : 'pessoal';
    const transactionId = `TX-NJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    session.status = 'confirmada';
    session.confirmedAt = confirmedAt;
    session.confirmationMode = mode;
    session.transactionId = transactionId;
    session.attemptsLeft = 0;

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
    globalConfirmedTransactions.set(transactionId, verificationRecord);

    return res.status(200).json({
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
}
