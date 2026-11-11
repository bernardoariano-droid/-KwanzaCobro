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

    const fallbackSql = `-- KwanzaCobro Supabase PostgreSQL Schema
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT 'default_company',
    name TEXT NOT NULL DEFAULT 'KwanzaCobro - Gestão de Dívidas Empresariais',
    nif TEXT DEFAULT '5401928374',
    phone TEXT DEFAULT '+244 923 884 100',
    email TEXT DEFAULT 'contacto@kwanzacobro.ao',
    address TEXT DEFAULT 'Edifício Kilamba, Luanda, Angola',
    city TEXT DEFAULT 'Luanda, Angola',
    bank_name TEXT DEFAULT 'Banco BAI (Banco Angolano de Investimentos)',
    iban TEXT DEFAULT 'AO06 0040 0000 9812 3456 1012 8',
    express_phone TEXT DEFAULT '923 884 100',
    currency TEXT DEFAULT 'Kz',
    logo_url TEXT,
    penalty_per_day_rate NUMERIC DEFAULT 0.1,
    days_before_due_alert INTEGER DEFAULT 5,
    auto_alert_notifications BOOLEAN DEFAULT TRUE,
    senha TEXT DEFAULT 'admin',
    password TEXT DEFAULT 'admin',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`;
    return res.status(200).json({ success: true, sql: fallbackSql });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
