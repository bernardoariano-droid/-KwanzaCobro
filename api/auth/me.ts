import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, getAdminSupabase } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const { profile, userSupabase } = auth;
    let company: any = undefined;

    if (profile.companyId) {
      let compRow: any = null;
      const directRes = await userSupabase
        .from('company_settings')
        .select('*')
        .eq('id', profile.companyId)
        .maybeSingle();

      if (!directRes.error && directRes.data) {
        compRow = directRes.data;
      } else if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const adminClient = getAdminSupabase();
          const adminRes = await adminClient
            .from('company_settings')
            .select('*')
            .eq('id', profile.companyId)
            .maybeSingle();
          if (!adminRes.error && adminRes.data) {
            compRow = adminRes.data;
          }
        } catch {}
      }

      if (compRow) {
        company = {
          id: String(compRow.id),
          name: compRow.name || 'NEUROJUS',
          nif: compRow.nif || '',
          phone: compRow.phone || '',
          email: compRow.email || '',
          address: compRow.address || '',
          city: compRow.city || 'Luanda, Angola',
          bankName: compRow.bank_name || '',
          iban: compRow.iban || '',
          expressPhone: compRow.express_phone || '',
          currency: compRow.currency || 'Kz',
          logoUrl: compRow.logo_url || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg',
          penaltyPerDayRate: typeof compRow.penalty_per_day_rate === 'number' ? compRow.penalty_per_day_rate : 0.1,
          daysBeforeDueAlert: typeof compRow.days_before_due_alert === 'number' ? compRow.days_before_due_alert : 5,
          autoAlertNotifications: typeof compRow.auto_alert_notifications === 'boolean' ? compRow.auto_alert_notifications : true,
          status: compRow.status === 'inativo' ? 'inativo' : 'ativo',
          superAdminId: compRow.super_admin_id ? String(compRow.super_admin_id) : undefined,
          createdAt: compRow.created_at ? String(compRow.created_at).slice(0, 10) : undefined,
        };
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        branch: profile.branch,
        companyId: profile.companyId || undefined,
        sellerId: profile.sellerId || profile.id,
        isActive: profile.isActive,
      },
      company,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erro ao validar utilizador.' });
  }
}
