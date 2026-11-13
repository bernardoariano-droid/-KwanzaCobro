import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, normalizeServerRole } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
    const { userSupabase: supabase } = auth;

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
      role: normalizeServerRole(s.role),
      companyId: s.company_id ? String(s.company_id) : 'default_company',
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

    return res.status(200).json({
      success: true,
      source: 'supabase-production',
      debts,
      clients,
      sellers,
      company: company || {},
      lastSavedAt: new Date().toISOString(),
      counts: {
        debts: debts.length,
        clients: clients.length,
        sellers: sellers.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
