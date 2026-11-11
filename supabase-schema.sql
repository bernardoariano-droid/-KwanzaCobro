-- ====================================================================
-- KwanzaCobro - Esquema de Base de Dados para Supabase PostgreSQL
-- Projeto Supabase: ckcwpcnsfennfjmjwoqp
-- Contexto Comercial: Gestão de Dívidas & Recuperação de Crédito em Angola
-- ====================================================================

-- Habilitar extensão para geração de UUID se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE SINCRONIZAÇÃO GERAL (Snapshot JSONB de Alta Disponibilidade)
-- Garante sincronização imediata de todo o sistema KwanzaCobro em tempo real
CREATE TABLE IF NOT EXISTS public.kwanzacobro_sync (
    id TEXT PRIMARY KEY DEFAULT 'main',
    debts JSONB DEFAULT '[]'::jsonb,
    clients JSONB DEFAULT '[]'::jsonb,
    sellers JSONB DEFAULT '[]'::jsonb,
    company JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'system'
);

-- 2. TABELA DE CONFIGURAÇÕES DA EMPRESA (Identificação & Coordenadas Bancárias Angolanas)
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
);

-- Comando para adicionar a coluna de senha caso a tabela já exista:
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS senha TEXT DEFAULT 'admin';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'admin';

-- 3. TABELA DE VENDEDORES / FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS public.sellers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    branch TEXT NOT NULL,
    email TEXT,
    password TEXT DEFAULT '123',
    role TEXT DEFAULT 'vendedor',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE CLIENTES (Plafonds e Dados Cadastrais)
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nif TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    province TEXT NOT NULL DEFAULT 'Luanda',
    municipality TEXT DEFAULT 'Luanda',
    address TEXT,
    client_type TEXT NOT NULL DEFAULT 'empresa',
    credit_limit NUMERIC NOT NULL DEFAULT 500000,
    notes TEXT,
    created_by_seller_id TEXT REFERENCES public.sellers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE DÍVIDAS / COMPRAS A CRÉDITO
CREATE TABLE IF NOT EXISTS public.debts (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    seller_id TEXT NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    customer_name TEXT,
    customer_phone TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta', -- 'aberta', 'vencida', 'liquidada', 'acordo'
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

-- 6. ITENS DISCRIMINADOS DA VENDA A CRÉDITO
CREATE TABLE IF NOT EXISTS public.debt_items (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0
);

-- 7. TABELA DE PAGAMENTOS E AMORTIZAÇÕES
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL, -- 'multicaixa_express', 'transferencia_bancaria', 'tpa', 'dinheiro', 'deposito'
    receipt_ref TEXT NOT NULL,
    notes TEXT,
    received_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TRILHA DE AUDITORIA CRONOLÓGICA
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id TEXT PRIMARY KEY DEFAULT ('aud-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
    debt_id TEXT REFERENCES public.debts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    details TEXT NOT NULL
);

-- Índices de Performance para Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_debts_client_id ON public.debts(client_id);
CREATE INDEX IF NOT EXISTS idx_debts_seller_id ON public.debts(seller_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_payments_debt_id ON public.payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_items_debt_id ON public.debt_items(debt_id);

-- Configuração RLS (Row Level Security) - Permitir leitura e escrita para chaves anon/autenticadas
ALTER TABLE public.kwanzacobro_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura anon" ON public.kwanzacobro_sync FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anon" ON public.kwanzacobro_sync FOR ALL USING (true);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura empresa" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "Permitir escrita empresa" ON public.company_settings FOR ALL USING (true);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir sellers" ON public.sellers FOR ALL USING (true);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir clients" ON public.clients FOR ALL USING (true);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir debts" ON public.debts FOR ALL USING (true);

ALTER TABLE public.debt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir debt_items" ON public.debt_items FOR ALL USING (true);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir payments" ON public.payments FOR ALL USING (true);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir audit_trail" ON public.audit_trail FOR ALL USING (true);

-- ====================================================================
-- RELACIONAMENTOS, INTEGRIDADE REFERENCIAL & SINCRONIZAÇÃO AUTOMÁTICA
-- ====================================================================

-- 1. Compatibilidade de Nomenclatura: 'clientes' como VIEW de 'clients'
CREATE OR REPLACE VIEW public.clientes AS 
SELECT * FROM public.clients;

-- 2. Garantir integridade de Foreign Keys entre tabelas relacionais
DO $$ 
BEGIN
    -- Relacionamento: clients -> sellers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'clients_created_by_seller_id_fkey'
    ) THEN
        ALTER TABLE public.clients
        ADD CONSTRAINT clients_created_by_seller_id_fkey
        FOREIGN KEY (created_by_seller_id) REFERENCES public.sellers(id)
        ON DELETE SET NULL;
    END IF;

    -- Relacionamento: debts -> clients
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'debts_client_id_fkey'
    ) THEN
        ALTER TABLE public.debts
        ADD CONSTRAINT debts_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.clients(id)
        ON DELETE CASCADE;
    END IF;

    -- Relacionamento: debts -> sellers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'debts_seller_id_fkey'
    ) THEN
        ALTER TABLE public.debts
        ADD CONSTRAINT debts_seller_id_fkey
        FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
        ON DELETE SET NULL;
    END IF;

    -- Relacionamento: debt_items -> debts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'debt_items_debt_id_fkey'
    ) THEN
        ALTER TABLE public.debt_items
        ADD CONSTRAINT debt_items_debt_id_fkey
        FOREIGN KEY (debt_id) REFERENCES public.debts(id)
        ON DELETE CASCADE;
    END IF;

    -- Relacionamento: payments -> debts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payments_debt_id_fkey'
    ) THEN
        ALTER TABLE public.payments
        ADD CONSTRAINT payments_debt_id_fkey
        FOREIGN KEY (debt_id) REFERENCES public.debts(id)
        ON DELETE CASCADE;
    END IF;

    -- Relacionamento: audit_trail -> debts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'audit_trail_debt_id_fkey'
    ) THEN
        ALTER TABLE public.audit_trail
        ADD CONSTRAINT audit_trail_debt_id_fkey
        FOREIGN KEY (debt_id) REFERENCES public.debts(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Salvaguarda: Garantir que vendas rápidas criem cliente automaticamente em 'clients'
CREATE OR REPLACE FUNCTION public.auto_ensure_client_on_debt()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.client_id) THEN
        INSERT INTO public.clients (
            id,
            name,
            phone,
            province,
            municipality,
            client_type,
            credit_limit,
            created_by_seller_id,
            created_at
        ) VALUES (
            NEW.client_id,
            COALESCE(NEW.customer_name, 'Cliente ' || NEW.client_id),
            COALESCE(NEW.customer_phone, '900000000'),
            'Luanda',
            'Luanda',
            'particular',
            500000,
            NEW.seller_id,
            COALESCE(NEW.created_at, NOW())
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_ensure_client ON public.debts;
CREATE TRIGGER trigger_auto_ensure_client
BEFORE INSERT OR UPDATE OF client_id ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.auto_ensure_client_on_debt();

-- 4. Função e Triggers para RELACIONAR AUTOMATICAMENTE a tabela kwanzacobro_sync
-- Sempre que qualquer tabela relacional for modificada, atualiza kwanzacobro_sync
CREATE OR REPLACE FUNCTION public.sync_relational_to_kwanzacobro_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_debts JSONB;
    v_clients JSONB;
    v_sellers JSONB;
    v_company JSONB;
BEGIN
    -- Construir arrays JSONB a partir das tabelas relacionais
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', d.id,
            'invoiceNumber', d.invoice_number,
            'clientId', d.client_id,
            'sellerId', d.seller_id,
            'customerName', d.customer_name,
            'customerPhone', d.customer_phone,
            'issueDate', d.issue_date,
            'dueDate', d.due_date,
            'totalAmount', d.total_amount,
            'status', d.status,
            'paymentMethodAgreed', d.payment_method_agreed,
            'terms', d.terms,
            'confirmationStatus', d.confirmation_status,
            'confirmationMode', d.confirmation_mode,
            'confirmationCode', d.confirmation_code,
            'confirmationTransactionId', d.confirmation_transaction_id,
            'reminder5DaysSent', d.reminder_5_days_sent,
            'reminder5DaysSentAt', d.reminder_5_days_sent_at,
            'createdAt', d.created_at,
            'updatedAt', d.updated_at,
            'items', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', di.id,
                    'description', di.description,
                    'quantity', di.quantity,
                    'unitPrice', di.unit_price,
                    'total', di.total
                ))
                FROM public.debt_items di WHERE di.debt_id = d.id
            ), '[]'::jsonb),
            'payments', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', p.id,
                    'debtId', p.debt_id,
                    'amount', p.amount,
                    'date', p.date,
                    'paymentMethod', p.payment_method,
                    'receiptRef', p.receipt_ref,
                    'notes', p.notes,
                    'receivedBy', p.received_by,
                    'createdAt', p.created_at
                ))
                FROM public.payments p WHERE p.debt_id = d.id
            ), '[]'::jsonb)
        )
    ), '[]'::jsonb) INTO v_debts FROM public.debts d;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'nif', c.nif,
            'phone', c.phone,
            'email', c.email,
            'province', c.province,
            'municipality', c.municipality,
            'address', c.address,
            'clientType', c.client_type,
            'creditLimit', c.credit_limit,
            'notes', c.notes,
            'createdBySellerId', c.created_by_seller_id,
            'createdAt', c.created_at
        )
    ), '[]'::jsonb) INTO v_clients FROM public.clients c;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'phone', s.phone,
            'branch', s.branch,
            'email', s.email,
            'password', s.password,
            'role', s.role,
            'createdAt', s.created_at
        )
    ), '[]'::jsonb) INTO v_sellers FROM public.sellers s;

    SELECT COALESCE(to_jsonb(cs.*), '{}'::jsonb) INTO v_company 
    FROM public.company_settings cs LIMIT 1;

    -- Atualizar a linha única da tabela kwanzacobro_sync
    INSERT INTO public.kwanzacobro_sync (
        id, debts, clients, sellers, company, updated_at, updated_by
    ) VALUES (
        'main', v_debts, v_clients, v_sellers, v_company, NOW(), 'database_trigger'
    )
    ON CONFLICT (id) DO UPDATE SET
        debts = EXCLUDED.debts,
        clients = EXCLUDED.clients,
        sellers = EXCLUDED.sellers,
        company = EXCLUDED.company,
        updated_at = NOW(),
        updated_by = 'database_trigger';

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Ligar os Triggers de Atualização nas tabelas correspondentes
DROP TRIGGER IF EXISTS trigger_sync_debts_to_snapshot ON public.debts;
CREATE TRIGGER trigger_sync_debts_to_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.debts
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_clients_to_snapshot ON public.clients;
CREATE TRIGGER trigger_sync_clients_to_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_sellers_to_snapshot ON public.sellers;
CREATE TRIGGER trigger_sync_sellers_to_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.sellers
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_payments_to_snapshot ON public.payments;
CREATE TRIGGER trigger_sync_payments_to_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_items_to_snapshot ON public.debt_items;
CREATE TRIGGER trigger_sync_items_to_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.debt_items
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_company_to_snapshot ON public.company_settings;
CREATE TRIGGER trigger_sync_company_to_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.company_settings
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

