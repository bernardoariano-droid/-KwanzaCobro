import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const { userSupabase: supabase, profile } = auth;
    const { debts, clients, sellers, company, companies } = req.body || {};
    let anySuccess = false;

    const scopedCompanyId = (incomingCompanyId?: string | null) => {
      if (profile.role === 'super_admin') return incomingCompanyId || profile.companyId || 'default_company';
      return profile.companyId || 'default_company';
    };

    // 1. Sincronizar Empresas (apenas super_admin ou admin_geral na própria empresa)
    if (profile.role === 'super_admin' || profile.role === 'admin_geral') {
      const companiesList =
        profile.role === 'super_admin' && Array.isArray(companies) && companies.length > 0
          ? companies
          : company
          ? [company]
          : [];

      for (const comp of companiesList) {
        const compId = comp.id || scopedCompanyId();
        if (profile.role !== 'super_admin' && compId !== profile.companyId) {
          continue;
        }
        try {
          const companyPayload: any = {
            id: compId,
            name: comp.name || 'KwanzaCobro',
            nif: comp.nif || '',
            phone: comp.phone || '',
            email: comp.email || '',
            address: comp.address || '',
            city: comp.city || 'Luanda, Angola',
            bank_name: comp.bankName || '',
            iban: comp.iban || '',
            express_phone: comp.expressPhone || '',
            currency: comp.currency || 'Kz',
            logo_url: comp.logoUrl || null,
            penalty_per_day_rate: comp.penaltyPerDayRate ?? 0.1,
            days_before_due_alert: comp.daysBeforeDueAlert ?? 5,
            auto_alert_notifications: comp.autoAlertNotifications ?? true,
            status: comp.status || 'ativo',
            updated_at: new Date().toISOString(),
          };

          const { error: compErr } = await supabase
            .from('company_settings')
            .upsert(companyPayload, { onConflict: 'id' });
          if (!compErr) {
            anySuccess = true;
          } else if (compErr.message && compErr.message.includes('column')) {
            const { status, updated_at, ...fallbackPayload } = companyPayload;
            const retry = await supabase.from('company_settings').upsert(fallbackPayload, { onConflict: 'id' });
            if (!retry.error) anySuccess = true;
          }
        } catch (compErr) {
          console.warn('Erro ao salvar company_settings:', compErr);
        }
      }
    }

    // 2. Sincronizar Vendedores (apenas admin_geral da própria empresa ou super_admin)
    if ((profile.role === 'super_admin' || profile.role === 'admin_geral') && Array.isArray(sellers) && sellers.length > 0) {
      try {
        const sellerRows = sellers
          .filter((s: any) => profile.role === 'super_admin' || (s.companyId || 'default_company') === profile.companyId)
          .map((s: any) => ({
            id: String(s.id),
            name: s.name,
            phone: s.phone,
            branch: s.branch || 'Sede',
            email: s.email || null,
            role: s.role || 'vendedor',
            company_id: scopedCompanyId(s.companyId),
            created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          }));
        if (sellerRows.length > 0) {
          const { error: selErr } = await supabase.from('sellers').upsert(sellerRows, { onConflict: 'id' });
          if (!selErr) anySuccess = true;
        }
      } catch (selErr) {
        console.warn('Erro ao salvar sellers:', selErr);
      }
    }

    // 3. Sincronizar Clientes (isolados à empresa autorizada)
    const clientMap = new Map<string, any>();
    if (Array.isArray(clients)) {
      for (const c of clients) {
        if (!c || !c.id) continue;
        if (profile.role !== 'super_admin' && c.companyId && c.companyId !== profile.companyId) continue;
        clientMap.set(String(c.id), c);
      }
    }
    if (Array.isArray(debts)) {
      for (const d of debts) {
        if (profile.role !== 'super_admin' && d.companyId && d.companyId !== profile.companyId) continue;
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
            companyId: scopedCompanyId(d.companyId),
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
          created_by_seller_id:
            c.createdBySellerId || c.created_by_seller_id
              ? String(c.createdBySellerId || c.created_by_seller_id)
              : null,
          company_id: scopedCompanyId(c.companyId || c.company_id),
          created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        }));
        const { error: cliErr } = await supabase.from('clients').upsert(clientRows, { onConflict: 'id' });
        if (!cliErr) anySuccess = true;
      } catch (cliErr) {
        console.warn('Erro ao salvar clients:', cliErr);
      }
    }

    // 4. Sincronizar Dívidas, Itens e Pagamentos (isolados à empresa e carteira do vendedor)
    if (Array.isArray(debts) && debts.length > 0) {
      try {
        const authorizedDebts = debts.filter((d: any) => {
          if (profile.role === 'super_admin') return true;
          if (d.companyId && d.companyId !== profile.companyId) return false;
          if (profile.role === 'vendedor') {
            return String(d.sellerId) === profile.sellerId || String(d.sellerId) === profile.id;
          }
          return true;
        });

        const debtRows = authorizedDebts.map((d: any) => ({
          id: String(d.id),
          invoice_number: d.invoiceNumber,
          client_id: String(d.clientId),
          seller_id: String(d.sellerId),
          company_id: scopedCompanyId(d.companyId),
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
          confirmation_code: d.confirmationCode || d.confirmation_code || null,
          confirmation_transaction_id: d.confirmationTransactionId || d.confirmation_transaction_id || null,
          reminder_5_days_sent: Boolean(d.reminder5DaysSent),
          reminder_5_days_sent_at: d.reminder5DaysSentAt ? new Date(d.reminder5DaysSentAt).toISOString() : null,
          updated_at: new Date().toISOString(),
        }));

        if (debtRows.length > 0) {
          const { error: dErr } = await supabase.from('debts').upsert(debtRows, { onConflict: 'id' });
          if (!dErr) anySuccess = true;

          const allItems: any[] = [];
          const allPayments: any[] = [];
          for (const d of authorizedDebts) {
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
        }
      } catch (debtErr) {
        console.warn('Erro ao salvar debts/items/payments:', debtErr);
      }
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
