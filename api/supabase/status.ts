import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAnonSupabase, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF } from '../_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();
  try {
    const supabase = getAnonSupabase();

    // 1. Ping endpoint Auth & REST sem enviar sb_publishable_* como Bearer JWT
    const pingHeaders: Record<string, string> = {
      apikey: SUPABASE_ANON_KEY,
    };
    if (SUPABASE_ANON_KEY.startsWith('eyJ')) {
      pingHeaders.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    const pingRes = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: pingHeaders,
    });
    const latencyMs = Date.now() - start;
    const isOnline = pingRes.ok || pingRes.status === 200 || pingRes.status === 401;

    // 2. Query table counts (distinguish schema missing vs empty tables)
    let tableExists = false;
    let counts = { companies: 0, sellers: 0, clients: 0, debts: 0 };
    try {
      const [compRes, selRes, cliRes, debtRes] = await Promise.all([
        supabase.from('company_settings').select('id', { count: 'exact' }).limit(1),
        supabase.from('sellers').select('id', { count: 'exact' }).limit(1),
        supabase.from('clients').select('id', { count: 'exact' }).limit(1),
        supabase.from('debts').select('id', { count: 'exact' }).limit(1),
      ]);

      const isMissingTableErr = (err: any) =>
        Boolean(err?.code === 'PGRST205' || (err?.message && (err.message.includes('schema cache') || err.message.includes('does not exist'))));

      tableExists =
        (!compRes.error && !isMissingTableErr(compRes.error)) ||
        (!selRes.error && !isMissingTableErr(selRes.error)) ||
        (!cliRes.error && !isMissingTableErr(cliRes.error)) ||
        (!debtRes.error && !isMissingTableErr(debtRes.error));

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
        ? tableExists
          ? `Conectado ao Supabase (${counts.companies} empresas, ${counts.sellers} vendedores, ${counts.clients} clientes, ${counts.debts} dívidas)`
          : 'Supabase Auth conectado. Execute supabase-schema.sql no SQL Editor para criar as tabelas.'
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
