import type { VercelRequest, VercelResponse } from '@vercel/node';
import { globalConfirmedTransactions } from './_session.js';
import { getBackendSupabase } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rawId = req.query.transactionId || req.query.id;
    const transactionId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!transactionId) {
      return res.status(400).json({
        verified: false,
        message: 'Identificador de transação não fornecido.',
      });
    }

    // 1. Procurar em memória
    const record = globalConfirmedTransactions.get(transactionId);
    if (record) {
      return res.status(200).json({
        verified: true,
        system: 'NEUROJUS Angola',
        ...record,
      });
    }

    // 2. Procurar no Supabase na tabela debts
    const supabase = getBackendSupabase();
    const { data: debt } = await supabase
      .from('debts')
      .select('*, clients(*)')
      .eq('confirmation_transaction_id', transactionId)
      .maybeSingle();

    if (debt) {
      return res.status(200).json({
        verified: true,
        system: 'NEUROJUS Angola',
        transactionId: debt.confirmation_transaction_id,
        operationRef: debt.invoice_number,
        clientName: debt.customer_name || debt.clients?.name || 'Cliente',
        clientPhone: debt.customer_phone || debt.clients?.phone,
        totalAmount: debt.total_amount,
        confirmedAt: debt.created_at,
        confirmationMode: debt.confirmation_mode || 'pessoal',
        verificationCode: debt.confirmation_code,
        status: 'Confirmada',
      });
    }

    return res.status(404).json({
      verified: false,
      message: 'Comprovativo não localizado ou inválido no sistema NEUROJUS.',
    });
  } catch (err: any) {
    return res.status(500).json({
      verified: false,
      message: 'Erro interno ao validar autenticidade.',
      error: err.message,
    });
  }
}
