import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireIdentity } from '../_auth.js';
import { SUPABASE_URL } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido.' });
  const auth = await requireIdentity(req, res, ['admin']);
  if (!auth) return;
  const { name, email, password, phone, branch, role } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanName || !/^\S+@\S+\.\S+$/.test(cleanEmail) || String(password || '').length < 8) {
    return res.status(400).json({ success: false, error: 'Informe nome, e-mail válido e senha inicial com pelo menos 8 caracteres.' });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) return res.status(503).json({ success: false, error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY nas variáveis privadas da Vercel.' });

  const adminClient = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let createdUserId: string | null = null;
  try {
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: cleanName },
    });
    if (createError || !created.user) return res.status(400).json({ success: false, error: createError?.message || 'Não foi possível criar a conta.' });
    createdUserId = created.user.id;

    const sellerId = `sel-${createdUserId}`;
    const safeRole = role === 'admin' ? 'admin' : 'vendedor';
    const { error: sellerError } = await adminClient.from('sellers').insert({
      id: sellerId, name: cleanName, phone: String(phone || ''), branch: String(branch || 'Sede'),
      email: cleanEmail, role: safeRole, created_at: new Date().toISOString(),
    });
    if (sellerError) throw sellerError;

    const { error: profileError } = await adminClient.from('user_profiles').insert({
      user_id: createdUserId, seller_id: sellerId, full_name: cleanName, role: safeRole,
    });
    if (profileError) {
      await adminClient.from('sellers').delete().eq('id', sellerId);
      throw profileError;
    }
    return res.status(201).json({ success: true, seller: { id: sellerId, name: cleanName, email: cleanEmail, phone, branch, role: safeRole, createdAt: new Date().toISOString().slice(0, 10) } });
  } catch (error: any) {
    if (createdUserId) await adminClient.auth.admin.deleteUser(createdUserId);
    return res.status(400).json({ success: false, error: error?.message || 'Falha ao provisionar utilizador.' });
  }
}
