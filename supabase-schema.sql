-- ====================================================================
-- NEUROJUS / KwanzaCobro - Esquema SQL Completo, Relacional & RLS Multiempresa
-- Projeto Supabase: ckcwpcnsfennfjmjwoqp
-- GARANTIAS DE SEGURANÇA E PRESERVAÇÃO:
--   • NÃO apaga tabelas, registos nem dados existentes.
--   • NÃO cria coluna senha/password em public.utilizadores ou company_settings.
--   • PRESERVA o Super Administrador existente:
--     Email: bamidia@gmail.com | UUID: 8b9f3c41-c996-4764-87c2-9d82411584e1
--   • PRESERVA as funções SQL existentes:
--     public.is_super_admin(), public.current_company_id(), public.is_company_admin()
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. CRIAÇÃO DE TABELAS (IF NOT EXISTS — não altera tabelas existentes)
-- --------------------------------------------------------------------

-- Tabela de Empresas (Multi-Empresa)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL DEFAULT 'KwanzaCobro - Gestão de Dívidas Empresariais',
    nif TEXT DEFAULT '',
    phone TEXT DEFAULT '+244 ',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT 'Luanda, Angola',
    bank_name TEXT DEFAULT 'Banco BAI',
    iban TEXT DEFAULT '',
    express_phone TEXT DEFAULT '',
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

-- Tabela de Utilizadores ligada ao Supabase Auth (sem coluna senha)
CREATE TABLE IF NOT EXISTS public.utilizadores (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL DEFAULT 'Utilizador',
    email TEXT NOT NULL UNIQUE,
    telefone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('super_admin', 'admin_geral', 'vendedor')),
    company_id TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    branch TEXT DEFAULT 'Sede',
    seller_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Vendedores / Equipa Comercial por Empresa
CREATE TABLE IF NOT EXISTS public.sellers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    branch TEXT DEFAULT 'Sede',
    email TEXT,
    role TEXT DEFAULT 'vendedor',
    company_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Clientes por Empresa e Vendedor
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    nif TEXT,
    phone TEXT DEFAULT '',
    email TEXT,
    province TEXT DEFAULT 'Luanda',
    municipality TEXT DEFAULT 'Luanda',
    address TEXT,
    client_type TEXT DEFAULT 'empresa',
    credit_limit NUMERIC DEFAULT 0,
    notes TEXT,
    created_by_seller_id TEXT,
    company_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Dívidas / Faturas a Crédito por Empresa, Cliente e Vendedor
CREATE TABLE IF NOT EXISTS public.debts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT NOT NULL,
    client_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    company_id TEXT,
    customer_name TEXT,
    customer_phone TEXT DEFAULT '',
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'aberta',
    payment_method_agreed TEXT DEFAULT 'multicaixa_express',
    terms TEXT,
    confirmation_status TEXT DEFAULT 'sem_sms',
    confirmation_mode TEXT DEFAULT 'pessoal',
    confirmation_code TEXT,
    confirmation_transaction_id TEXT,
    reminder_5_days_sent BOOLEAN DEFAULT FALSE,
    reminder_5_days_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Itens da Dívida
CREATE TABLE IF NOT EXISTS public.debt_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    debt_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0
);

-- Tabela de Pagamentos / Amortizações
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    debt_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'multicaixa_express',
    receipt_ref TEXT,
    notes TEXT,
    received_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Auditoria por Empresa e Dívida
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id TEXT,
    company_id TEXT,
    action TEXT NOT NULL,
    performed_by TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Auxiliar de Sincronização
CREATE TABLE IF NOT EXISTS public.kwanzacobro_sync (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2. COLUNAS AUXILIARES E RELACIONAMENTOS ENTRE TABELAS (FOREIGN KEYS)
--    Adapta-se automaticamente ao tipo real das colunas (uuid ou text)
--    para nunca gerar erros 42703/42804 em estruturas já existentes.
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_comp_id_type TEXT;
    v_sellers_id_type TEXT;
    v_clients_id_type TEXT;
    v_debts_id_type TEXT;
    v_col_type TEXT;
    v_has_comp_id_col BOOLEAN;
BEGIN
    -- Garantir coluna id em company_settings se não existir
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'id'
    ) INTO v_has_comp_id_col;

    IF NOT v_has_comp_id_col THEN
        ALTER TABLE public.company_settings ADD COLUMN id TEXT DEFAULT gen_random_uuid()::text;
        UPDATE public.company_settings SET id = gen_random_uuid()::text WHERE id IS NULL;
        ALTER TABLE public.company_settings ALTER COLUMN id SET NOT NULL;
    END IF;

    -- Garantir índice único em company_settings(id) para suportar chaves estrangeiras
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'company_settings' AND indexdef ILIKE '%(id)%'
    ) THEN
        CREATE UNIQUE INDEX idx_company_settings_id_unique ON public.company_settings(id);
    END IF;

    -- Garantir colunas auxiliares em company_settings e utilizadores
    ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
    ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS super_admin_id TEXT;
    ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Sede';
    ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS seller_id TEXT;
    ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Detetar tipos reais das chaves primárias
    SELECT data_type INTO v_comp_id_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'id';

    SELECT data_type INTO v_sellers_id_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sellers' AND column_name = 'id';

    SELECT data_type INTO v_clients_id_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'id';

    SELECT data_type INTO v_debts_id_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'id';

    -- Adicionar company_id nas tabelas caso falte, usando o mesmo tipo de company_settings.id
    IF v_comp_id_type = 'uuid' THEN
        ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS company_id UUID;
        ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS company_id UUID;
        ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id UUID;
        ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS company_id UUID;
        ALTER TABLE public.audit_trail ADD COLUMN IF NOT EXISTS company_id UUID;
    ELSE
        ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS company_id TEXT;
        ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
        ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
        ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
        ALTER TABLE public.audit_trail ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default_company';
    END IF;

    -- Relacionamento 1: utilizadores.company_id -> company_settings(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'utilizadores' AND column_name = 'company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_utilizadores_company') THEN
        ALTER TABLE public.utilizadores
            ADD CONSTRAINT fk_utilizadores_company
            FOREIGN KEY (company_id) REFERENCES public.company_settings(id)
            ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    END IF;

    -- Relacionamento 2: sellers.company_id -> company_settings(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sellers' AND column_name = 'company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sellers_company') THEN
        ALTER TABLE public.sellers
            ADD CONSTRAINT fk_sellers_company
            FOREIGN KEY (company_id) REFERENCES public.company_settings(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    -- Relacionamento 3: clients.company_id -> company_settings(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_company') THEN
        ALTER TABLE public.clients
            ADD CONSTRAINT fk_clients_company
            FOREIGN KEY (company_id) REFERENCES public.company_settings(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    -- Relacionamento 4: clients.created_by_seller_id -> sellers(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'created_by_seller_id';
    IF v_col_type = v_sellers_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_seller') THEN
        ALTER TABLE public.clients
            ADD CONSTRAINT fk_clients_seller
            FOREIGN KEY (created_by_seller_id) REFERENCES public.sellers(id)
            ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    END IF;

    -- Relacionamento 5: debts.company_id -> company_settings(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_debts_company') THEN
        ALTER TABLE public.debts
            ADD CONSTRAINT fk_debts_company
            FOREIGN KEY (company_id) REFERENCES public.company_settings(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    -- Relacionamento 6: debts.client_id -> clients(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'client_id';
    IF v_col_type = v_clients_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_debts_client') THEN
        ALTER TABLE public.debts
            ADD CONSTRAINT fk_debts_client
            FOREIGN KEY (client_id) REFERENCES public.clients(id)
            ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
    END IF;

    -- Relacionamento 7: debts.seller_id -> sellers(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'seller_id';
    IF v_col_type = v_sellers_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_debts_seller') THEN
        ALTER TABLE public.debts
            ADD CONSTRAINT fk_debts_seller
            FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
            ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
    END IF;

    -- Relacionamento 8: debt_items.debt_id -> debts(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debt_items' AND column_name = 'debt_id';
    IF v_col_type = v_debts_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_debt_items_debt') THEN
        ALTER TABLE public.debt_items
            ADD CONSTRAINT fk_debt_items_debt
            FOREIGN KEY (debt_id) REFERENCES public.debts(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    -- Relacionamento 9: payments.debt_id -> debts(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'debt_id';
    IF v_col_type = v_debts_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_debt') THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT fk_payments_debt
            FOREIGN KEY (debt_id) REFERENCES public.debts(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    -- Relacionamento 10: audit_trail.company_id -> company_settings(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_trail' AND column_name = 'company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_trail_company') THEN
        ALTER TABLE public.audit_trail
            ADD CONSTRAINT fk_audit_trail_company
            FOREIGN KEY (company_id) REFERENCES public.company_settings(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    -- Relacionamento 11: audit_trail.debt_id -> debts(id)
    SELECT data_type INTO v_col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_trail' AND column_name = 'debt_id';
    IF v_col_type = v_debts_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_trail_debt') THEN
        ALTER TABLE public.audit_trail
            ADD CONSTRAINT fk_audit_trail_debt
            FOREIGN KEY (debt_id) REFERENCES public.debts(id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 3. ÍNDICES DE PERFORMANCE MULTIEMPRESA E RELACIONAIS
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_utilizadores_company ON public.utilizadores(company_id);
CREATE INDEX IF NOT EXISTS idx_sellers_company ON public.sellers(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_seller ON public.clients(created_by_seller_id);
CREATE INDEX IF NOT EXISTS idx_debts_client_id ON public.debts(client_id);
CREATE INDEX IF NOT EXISTS idx_debts_seller_id ON public.debts(seller_id);
CREATE INDEX IF NOT EXISTS idx_debts_company ON public.debts(company_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_trail(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_debt_id ON public.audit_trail(debt_id);
CREATE INDEX IF NOT EXISTS idx_payments_debt_id ON public.payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_items_debt_id ON public.debt_items(debt_id);

-- --------------------------------------------------------------------
-- 4. TRIGGER DE SEGURANÇA:
--    a) Protege o Super Administrador existente (bamidia@gmail.com / 8b9f3c41-c996-4764-87c2-9d82411584e1)
--    b) Impede qualquer utilizador de alterar o próprio perfil, permissões ou empresa
-- --------------------------------------------------------------------
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

-- --------------------------------------------------------------------
-- 5. PRESERVAÇÃO DE FUNÇÕES SQL (SÓ CRIA SE NÃO EXISTIREM)
--    Em projetos novos cria public.is_super_admin(), current_company_id()
--    e is_company_admin(); em projetos existentes preserva-as intactas.
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_super_admin'
    ) THEN
        EXECUTE $fn$
            CREATE FUNCTION public.is_super_admin()
            RETURNS BOOLEAN
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = public
            AS $body$
                SELECT EXISTS (
                    SELECT 1 FROM public.utilizadores u
                    WHERE u.id = auth.uid()
                      AND lower(coalesce(u.role, '')) = 'super_admin'
                      AND coalesce(u.ativo, true) = true
                );
            $body$;
        $fn$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'current_company_id'
    ) THEN
        EXECUTE $fn$
            CREATE FUNCTION public.current_company_id()
            RETURNS TEXT
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = public
            AS $body$
                SELECT u.company_id::text
                FROM public.utilizadores u
                WHERE u.id = auth.uid()
                LIMIT 1;
            $body$;
        $fn$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_company_admin'
    ) THEN
        EXECUTE $fn$
            CREATE FUNCTION public.is_company_admin()
            RETURNS BOOLEAN
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = public
            AS $body$
                SELECT EXISTS (
                    SELECT 1 FROM public.utilizadores u
                    WHERE u.id = auth.uid()
                      AND lower(coalesce(u.role, '')) IN ('admin_geral', 'super_admin')
                      AND coalesce(u.ativo, true) = true
                );
            $body$;
        $fn$;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 6. RLS MULTIEMPRESA BASEADO EM auth.uid() E FUNÇÕES SQL
--    (public.is_super_admin(), public.current_company_id(), public.is_company_admin())
-- --------------------------------------------------------------------

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
    OR (
        public.is_company_admin()
        AND company_id::text = public.current_company_id()::text
    )
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

-- --------------------------------------------------------------------
-- 7. TRIGGER DE AUTO-REGISTO SEGURO (Supabase Auth signUp -> Empresa + Perfil)
--    Cria empresa isolada + utilizador admin_geral apenas quando self_register=true.
--    Nunca permite auto-registo como super_admin.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    v_is_self_register BOOLEAN := COALESCE((v_meta->>'self_register')::boolean, false);
    v_comp_id TEXT;
    v_name TEXT := COALESCE(NULLIF(trim(v_meta->>'name'), ''), split_part(NEW.email, '@', 1), 'Utilizador');
    v_company_name TEXT := COALESCE(NULLIF(trim(v_meta->>'company_name'), ''), 'Empresa ' || split_part(NEW.email, '@', 1));
    v_phone TEXT := COALESCE(NULLIF(trim(v_meta->>'phone'), ''), '+244 ');
    v_nif TEXT := COALESCE(trim(v_meta->>'nif'), '');
    v_branch TEXT := COALESCE(NULLIF(trim(v_meta->>'branch'), ''), 'Sede');
BEGIN
    -- Nunca interferir em contas criadas administrativamente sem self_register
    IF NOT v_is_self_register THEN
        RETURN NEW;
    END IF;

    -- Proteger conta do Super Administrador principal
    IF NEW.id::text = '8b9f3c41-c996-4764-87c2-9d82411584e1' OR lower(NEW.email) = 'bamidia@gmail.com' THEN
        RETURN NEW;
    END IF;

    -- Se já existe em public.utilizadores, não duplicar
    IF EXISTS (SELECT 1 FROM public.utilizadores WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_comp_id := gen_random_uuid()::text;

    INSERT INTO public.company_settings (
        id, name, nif, phone, email, city, currency, status, super_admin_id
    ) VALUES (
        v_comp_id, v_company_name, v_nif, v_phone, lower(NEW.email), 'Luanda, Angola', 'Kz', 'ativo', '8b9f3c41-c996-4764-87c2-9d82411584e1'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.utilizadores (
        id, nome, email, telefone, role, company_id, ativo, branch, seller_id
    ) VALUES (
        NEW.id, v_name, lower(NEW.email), v_phone, 'admin_geral', v_comp_id, TRUE, v_branch, NEW.id::text
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.sellers (
        id, name, phone, branch, email, role, company_id, is_active
    ) VALUES (
        NEW.id::text, v_name, v_phone, v_branch, lower(NEW.email), 'admin_geral', v_comp_id, TRUE
    ) ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created_neurojus ON auth.users;
CREATE TRIGGER on_auth_user_created_neurojus
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- --------------------------------------------------------------------
-- 8. PRESERVAÇÃO SEGURA DE DADOS INICIAIS (SEM SOBRESCREVER EXISTENTES)
-- --------------------------------------------------------------------
INSERT INTO public.company_settings (id, name, email, city, currency, status, super_admin_id)
SELECT 'default_company', 'NEUROJUS / KwanzaCobro - Sede Principal', 'contacto@kwanzacobro.ao', 'Luanda, Angola', 'Kz', 'ativo', '8b9f3c41-c996-4764-87c2-9d82411584e1'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings WHERE id = 'default_company');

-- Garante perfil para o Super Administrador preservado caso o UUID já exista em auth.users
INSERT INTO public.utilizadores (id, nome, email, role, company_id, ativo, branch)
SELECT au.id, COALESCE(NULLIF(au.raw_user_meta_data->>'name', ''), 'Super Administrador NEUROJUS'), lower(au.email), 'super_admin', 'default_company', TRUE, 'Sede Principal'
FROM auth.users au
WHERE au.id = '8b9f3c41-c996-4764-87c2-9d82411584e1'::uuid
ON CONFLICT (id) DO NOTHING;

