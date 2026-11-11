import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBackendSupabase, SUPABASE_URL, SUPABASE_PROJECT_REF } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getBackendSupabase();
    const start = Date.now();
    const { error } = await supabase.from('company_settings').select('id', { head: true, count: 'exact' });
    const latencyMs = Date.now() - start;

    return res.status(200).json({
      status: 'online',
      service: 'NEUROJUS KwanzaCobro Vercel Serverless Function',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      supabase: {
        url: SUPABASE_URL,
        projectId: SUPABASE_PROJECT_REF,
        connected: !error,
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
