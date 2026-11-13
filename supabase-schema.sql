-- ====================================================================
-- NEUROJUS / KwanzaCobro - Esquema SQL Seguro & RLS Multiempresa (Supabase)
-- Projeto Supabase: ckcwpcnsfennfjmjwoqp
-- IMPORTANTE:
--   • NÃO apaga tabelas, registos nem dados existentes.
--   • PRESERVA o Super Administrador existente:
--     Email: bamidia@gmail.com | UUID: 8b9f3c41-c996-4764-87c2-9d82411584e1
--   • PRESERVA as funções SQL existentes:
--     public.is_super_admin(), public.current_company_id(), public.is_company_admin()
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Garantir colunas auxiliares em public.utilizadores sem modificar registos existentes
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Sede';
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS seller_id TEXT;
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Garantir estrutura e colunas multiempresa nas tabelas de negócio
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
    status TEXT DEFAULT 'ativo',
    super_admin_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS super_admin_id TEXT;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
ALTER TABLE public.audit_trail ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';

-- 3. Garantir índices por company_id
CREATE INDEX IF NOT EXISTS idx_debts_client_id ON public.debts(client_id);
CREATE INDEX IF NOT EXISTS idx_debts_seller_id ON public.debts(seller_id);
CREATE INDEX IF NOT EXISTS idx_debts_company ON public.debts(company_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_sellers_company ON public.sellers(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_trail(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_debt_id ON public.payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_items_debt_id ON public.debt_items(debt_id);

-- 4. Trigger de segurança:
--    a) Protege o Super Administrador existente (bamidia@gmail.com / 8b9f3c41-c996-4764-87c2-9d82411584e1)
--    b) Impede qualquer utilizador de alterar o próprio perfil, permissões ou empresa
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old JSONB := to_jsonb(OLD);
    v_new JSONB := to_jsonb(NEW);
BEGIN
    IF OLD.id::text = '8b9f3c41-c996-4764-87c2-9d82411584e1'
       AND current_setting('role', true) <> 'service_role' THEN
        IF (v_new->>'role') IS DISTINCT FROM (v_old->>'role')
           OR (v_new->>'perfil') IS DISTINCT FROM (v_old->>'perfil')
           OR (v_new->>'company_id') IS DISTINCT FROM (v_old->>'company_id')
           OR (v_new->>'email') IS DISTINCT FROM (v_old->>'email') THEN
            RAISE EXCEPTION 'A conta do Super Administrador principal está protegida.';
        END IF;
    END IF;

    IF auth.uid() IS NOT NULL
       AND OLD.id::text = auth.uid()::text
       AND current_setting('role', true) <> 'service_role' THEN
        IF (v_new->>'role') IS DISTINCT FROM (v_old->>'role')
           OR (v_new->>'perfil') IS DISTINCT FROM (v_old->>'perfil')
           OR (v_new->>'company_id') IS DISTINCT FROM (v_old->>'company_id')
           OR (v_new->>'ativo') IS DISTINCT FROM (v_old->>'ativo')
           OR (v_new->>'active') IS DISTINCT FROM (v_old->>'active')
           OR (v_new->>'is_active') IS DISTINCT FROM (v_old->>'is_active')
           OR (v_new->>'status') IS DISTINCT FROM (v_old->>'status') THEN
            RAISE EXCEPTION 'Nenhum utilizador pode alterar o próprio perfil, permissões ou empresa.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_change ON public.utilizadores;
CREATE TRIGGER trg_prevent_self_privilege_change
BEFORE UPDATE ON public.utilizadores
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_change();

-- 5. Ativar RLS com isolamento multiempresa baseado em auth.uid() e nas funções existentes
--    (public.is_super_admin(), public.current_company_id(), public.is_company_admin())

ALTER TABLE public.utilizadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura utilizadores" ON public.utilizadores;
DROP POLICY IF EXISTS "Permitir escrita utilizadores" ON public.utilizadores;
DROP POLICY IF EXISTS "utilizadores_select_policy" ON public.utilizadores;
DROP POLICY IF EXISTS "utilizadores_insert_policy" ON public.utilizadores;
DROP POLICY IF EXISTS "utilizadores_update_policy" ON public.utilizadores;
DROP POLICY IF EXISTS "utilizadores_delete_policy" ON public.utilizadores;

CREATE POLICY "utilizadores_select_policy" ON public.utilizadores
FOR SELECT USING (
    id::text = auth.uid()::text
    OR public.is_super_admin()
    OR (public.is_company_admin() AND company_id::text = public.current_company_id()::text)
);

CREATE POLICY "utilizadores_insert_policy" ON public.utilizadores
FOR INSERT WITH CHECK (
    public.is_super_admin()
);

CREATE POLICY "utilizadores_update_policy" ON public.utilizadores
FOR UPDATE USING (
    (public.is_super_admin() AND id::text <> '8b9f3c41-c996-4764-87c2-9d82411584e1')
    OR (public.is_company_admin() AND company_id::text = public.current_company_id()::text AND id::text <> auth.uid()::text)
);

CREATE POLICY "utilizadores_delete_policy" ON public.utilizadores
FOR DELETE USING (
    public.is_super_admin() AND id::text <> '8b9f3c41-c996-4764-87c2-9d82411584e1'
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura empresa" ON public.company_settings;
DROP POLICY IF EXISTS "Permitir escrita empresa" ON public.company_settings;
DROP POLICY IF EXISTS "Permitir leitura company" ON public.company_settings;
DROP POLICY IF EXISTS "Permitir escrita company" ON public.company_settings;
DROP POLICY IF EXISTS "company_select_policy" ON public.company_settings;
DROP POLICY IF EXISTS "company_write_policy" ON public.company_settings;

CREATE POLICY "company_select_policy" ON public.company_settings
FOR SELECT USING (
    public.is_super_admin() OR id::text = public.current_company_id()::text
);

CREATE POLICY "company_write_policy" ON public.company_settings
FOR ALL USING (
    public.is_super_admin() OR (public.is_company_admin() AND id::text = public.current_company_id()::text)
) WITH CHECK (
    public.is_super_admin() OR (public.is_company_admin() AND id::text = public.current_company_id()::text)
);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir sellers" ON public.sellers;
DROP POLICY IF EXISTS "sellers_tenant_policy" ON public.sellers;
CREATE POLICY "sellers_tenant_policy" ON public.sellers
FOR ALL USING (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
) WITH CHECK (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir clients" ON public.clients;
DROP POLICY IF EXISTS "clients_tenant_policy" ON public.clients;
CREATE POLICY "clients_tenant_policy" ON public.clients
FOR ALL USING (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
) WITH CHECK (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir debts" ON public.debts;
DROP POLICY IF EXISTS "debts_tenant_policy" ON public.debts;
CREATE POLICY "debts_tenant_policy" ON public.debts
FOR ALL USING (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
) WITH CHECK (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
);

ALTER TABLE public.debt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir debt_items" ON public.debt_items;
DROP POLICY IF EXISTS "debt_items_tenant_policy" ON public.debt_items;
CREATE POLICY "debt_items_tenant_policy" ON public.debt_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.debts d
        WHERE d.id::text = debt_id::text
          AND (public.is_super_admin() OR d.company_id::text = public.current_company_id()::text)
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.debts d
        WHERE d.id::text = debt_id::text
          AND (public.is_super_admin() OR d.company_id::text = public.current_company_id()::text)
    )
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir payments" ON public.payments;
DROP POLICY IF EXISTS "payments_tenant_policy" ON public.payments;
CREATE POLICY "payments_tenant_policy" ON public.payments
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.debts d
        WHERE d.id::text = debt_id::text
          AND (public.is_super_admin() OR d.company_id::text = public.current_company_id()::text)
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.debts d
        WHERE d.id::text = debt_id::text
          AND (public.is_super_admin() OR d.company_id::text = public.current_company_id()::text)
    )
);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir audit_trail" ON public.audit_trail;
DROP POLICY IF EXISTS "audit_trail_tenant_policy" ON public.audit_trail;
CREATE POLICY "audit_trail_tenant_policy" ON public.audit_trail
FOR ALL USING (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
) WITH CHECK (
    public.is_super_admin() OR company_id::text = public.current_company_id()::text
);

ALTER TABLE public.kwanzacobro_sync ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura anon" ON public.kwanzacobro_sync;
DROP POLICY IF EXISTS "Permitir escrita anon" ON public.kwanzacobro_sync;
DROP POLICY IF EXISTS "kwanzacobro_sync_super_admin_only" ON public.kwanzacobro_sync;
CREATE POLICY "kwanzacobro_sync_super_admin_only" ON public.kwanzacobro_sync
FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
