import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBackendSupabase, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getBackendSupabase();
    const start = Date.now();
    const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY };
    if (SUPABASE_ANON_KEY.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    }
    const pingRes = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { method: 'GET', headers });
    const latencyMs = Date.now() - start;
    const { error } = await supabase.from('company_settings').select('id').limit(1);

    return res.status(200).json({
      status: 'online',
      service: 'NEUROJUS KwanzaCobro Vercel Serverless Function',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      supabase: {
        url: SUPABASE_URL,
        projectId: SUPABASE_PROJECT_REF,
        connected: pingRes.ok,
        tableExists: !error,
        latencyMs,
      },
    });
  } catch (err: any) {
    return res.status(200).json({
      status: 'online',
      service: 'NEUROJUS KwanzaCobro Vercel Serverless Function',
      timestamp: new Date().toISOString(),
      supabase: {
        connected: false,
        error: err.message,
      },
    });
  }
}
