import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBackendSupabase } from './_supabase.js';

export type NeurojusIdentity = { id: string; email?: string; role: 'admin' | 'vendedor'; sellerId: string | null; name: string };

export async function requireIdentity(req: VercelRequest, res: VercelResponse, roles?: Array<'admin' | 'vendedor'>) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ success: false, error: 'Sessão em falta. Inicie sessão novamente.' });
    return null;
  }
  const client = getBackendSupabase(match[1]);
  const { data: authData, error: authError } = await client.auth.getUser(match[1]);
  if (authError || !authData.user) {
    res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
    return null;
  }
  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('user_id,seller_id,full_name,role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile || !['admin', 'vendedor'].includes(profile.role)) {
    res.status(403).json({ success: false, error: 'Utilizador sem perfil ou permissões atribuídas.' });
    return null;
  }
  if (roles && !roles.includes(profile.role)) {
    res.status(403).json({ success: false, error: 'Não tem permissão para executar esta operação.' });
    return null;
  }
  return {
    client,
    identity: {
      id: authData.user.id,
      email: authData.user.email,
      role: profile.role as 'admin' | 'vendedor',
      sellerId: profile.seller_id ? String(profile.seller_id) : null,
      name: profile.full_name || authData.user.email || 'Utilizador',
    } as NeurojusIdentity,
  };
}
