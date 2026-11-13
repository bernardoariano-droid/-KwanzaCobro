import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const candidates = [
      path.resolve(process.cwd(), 'supabase-schema.sql'),
      path.resolve(process.cwd(), '..', 'supabase-schema.sql'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const sql = fs.readFileSync(p, 'utf-8');
        return res.status(200).json({ success: true, sql });
      }
    }

    const fallbackSql = `-- NEUROJUS / KwanzaCobro: Autenticação Supabase Auth + RLS Multiempresa
-- Preserva bamidia@gmail.com (8b9f3c41-c996-4764-87c2-9d82411584e1)
-- e funções existentes: is_super_admin(), current_company_id(), is_company_admin()
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Sede';
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS seller_id TEXT;
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
ALTER TABLE public.audit_trail ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';`;
    return res.status(200).json({ success: true, sql: fallbackSql });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
