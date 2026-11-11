import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBackendSupabase, SUPABASE_URL, SUPABASE_KEY, SUPABASE_PROJECT_REF } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();
  try {
    const supabase = getBackendSupabase();

    // 1. Ping endpoint
    const pingRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const latencyMs = Date.now() - start;
    const isOnline = pingRes.status === 200 || pingRes.status === 401 || pingRes.status === 404 || pingRes.status === 400;

    // 2. Query table counts
    let tableExists = false;
    let counts = { companies: 0, sellers: 0, clients: 0, debts: 0 };
    try {
      const [compRes, selRes, cliRes, debtRes] = await Promise.all([
        supabase.from('company_settings').select('id', { count: 'exact', head: true }),
        supabase.from('sellers').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('debts').select('id', { count: 'exact', head: true }),
      ]);

      tableExists = !compRes.error && !selRes.error && !cliRes.error && !debtRes.error;
      counts = {
        companies: compRes.count ?? 0,
        sellers: selRes.count ?? 0,
        clients: cliRes.count ?? 0,
        debts: debtRes.count ?? 0,
      };
    } catch {
      tableExists = false;
    }

    return res.status(200).json({
      success: true,
      connected: isOnline,
      latencyMs,
      projectId: SUPABASE_PROJECT_REF,
      url: SUPABASE_URL,
      tableExists,
      counts,
      status: isOnline ? 'online' : 'offline',
      message: isOnline 
        ? (tableExists ? `Conectado ao Supabase (${counts.sellers} vendedores, ${counts.clients} clientes, ${counts.debts} dívidas)` : 'Cluster Supabase Conectado.')
        : 'Cluster Supabase offline ou inatingível',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      connected: false,
      error: err.message,
    });
  }
}
