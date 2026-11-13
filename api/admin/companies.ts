import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, getAdminSupabase, PRESERVED_SUPER_ADMIN_UUID } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const { profile: caller, userSupabase } = auth;

  // Escolher client: service_role no backend para Super Admin (ou userSupabase respeitando RLS)
  const canUseAdminClient = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
  const db = canUseAdminClient ? getAdminSupabase() : userSupabase;

  if (req.method === 'POST' || req.method === 'PATCH') {
    const company = req.body?.company || req.body;
    if (!company || !company.name) {
      return res.status(400).json({ success: false, error: 'Dados da empresa inválidos.' });
    }

    const compId = String(company.id || caller.companyId || 'default_company');

    // admin_geral só pode atualizar a sua própria empresa (nunca criar outra nem mudar status global)
    if (caller.role === 'vendedor') {
      return res.status(403).json({ success: false, error: 'Vendedores não podem alterar dados da empresa.' });
    }
    if (caller.role === 'admin_geral' && compId !== caller.companyId) {
      return res.status(403).json({
        success: false,
        error: 'Administrador Geral só pode gerir a sua própria empresa.',
      });
    }

    const payload: Record<string, any> = {
      id: compId,
      name: String(company.name).trim(),
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
    };

    if (caller.role === 'super_admin') {
      payload.status = company.status === 'inativo' ? 'inativo' : 'ativo';
      payload.super_admin_id = PRESERVED_SUPER_ADMIN_UUID;
    }

    const { data, error } = await db
      .from('company_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, company: data });
  }

  if (req.method === 'DELETE') {
    if (caller.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Apenas o Super Administrador pode remover empresas.' });
    }
    const compId = String(req.query?.companyId || req.body?.companyId || '').trim();
    if (!compId || compId === 'default_company') {
      return res.status(400).json({ success: false, error: 'ID de empresa inválido ou protegido.' });
    }

    const { error } = await db.from('company_settings').delete().eq('id', compId);
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: 'Método não suportado.' });
}
