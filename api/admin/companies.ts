import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { authenticateRequest, getAdminSupabase, PRESERVED_SUPER_ADMIN_UUID } from '../_supabase.js';

async function upsertCompanyWithAdaptiveFallback(
  db: any,
  payload: Record<string, any>
): Promise<{ data: any; error: any }> {
  let working = { ...payload };
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await db
      .from('company_settings')
      .upsert(working, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (!error) return { data, error: null };

    const msg = String(error.message || '');
    const colMatch =
      msg.match(/column "([^"]+)" of relation "company_settings" does not exist/i) ||
      msg.match(/Could not find the '([^']+)' column of 'company_settings'/i);

    if (colMatch && colMatch[1] && colMatch[1] in working && colMatch[1] !== 'id' && colMatch[1] !== 'name') {
      const next = { ...working };
      delete next[colMatch[1]];
      working = next;
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Não foi possível gravar em public.company_settings.' } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const { profile: caller, userSupabase } = auth;

  // Escolher client: service_role no backend para Super Admin (ou userSupabase respeitando RLS)
  const canUseAdminClient = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
  const db = canUseAdminClient ? getAdminSupabase() : userSupabase;

  if (req.method === 'GET') {
    let query = db.from('company_settings').select('*').order('created_at', { ascending: false });
    if (caller.role !== 'super_admin') {
      if (!caller.companyId) {
        return res.status(200).json({ success: true, companies: [] });
      }
      query = query.eq('id', caller.companyId);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, companies: data || [] });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const company = req.body?.company || req.body;
    if (!company || !company.name) {
      return res.status(400).json({ success: false, error: 'Dados da empresa inválidos.' });
    }

    if (caller.role === 'vendedor') {
      return res.status(403).json({ success: false, error: 'Vendedores não podem alterar dados da empresa.' });
    }

    const rawId = company.id ? String(company.id).trim() : '';

    // admin_geral só pode atualizar a sua própria empresa (nunca cadastrar novas empresas)
    if (caller.role === 'admin_geral') {
      if (!caller.companyId || !rawId || rawId !== caller.companyId) {
        return res.status(403).json({
          success: false,
          error: 'Apenas o Super Administrador pode cadastrar novas empresas. O Administrador Geral só pode gerir a sua própria empresa.',
        });
      }
    }

    const compId = rawId || crypto.randomUUID();

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

    const { data, error } = await upsertCompanyWithAdaptiveFallback(db, payload);

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

