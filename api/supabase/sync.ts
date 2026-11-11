import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const auth = await requireIdentity(req, res, ['admin']);
    if (!auth) return;
    const supabase = auth.client;
    const { debts, clients, sellers, company } = req.body || {};
    if (!debts && !clients && !sellers && !company) return res.status(400).json({ success: false, error: 'Nenhum dado recebido.' });
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
          confirmation_code: d.confirmation_code || null,
          confirmation_transaction_id: d.confirmation_transaction_id || null,
          reminder_5_days_sent: Boolean(d.reminder5DaysSent),
          reminder_5_days_sent_at: d.reminder5DaysSentAt ? new Date(d.reminder5DaysSentAt).toISOString() : null,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('debts').upsert(debtRows, { onConflict: 'id' });
        anySuccess = true;

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
        updated_by: 'vercel-serverless',
      }, { onConflict: 'id' });
      anySuccess = true;
    } catch {
      // Ignorar se kwanzacobro_sync falhar
    }

    return res.status(200).json({
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
}
