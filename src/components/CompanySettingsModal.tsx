import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CreditCard, 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  Save, 
  Check, 
  AlertCircle,
  ShieldCheck,
  Globe,
  Sparkles,
  Cloud,
  Server,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
  CheckCircle2,
  Wifi,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CompanySettings, Debt, Client, Seller } from '../types/debt';
import { useLanguage } from '../i18n/LanguageContext';
import { SupportedLanguage } from '../i18n/translations';
import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  SUPABASE_PROJECT_REF,
  testSupabaseConnection, 
  syncToSupabase, 
  pullFromSupabase, 
  fetchSupabaseSchemaSql,
  SupabaseHealthResult 
} from '../lib/supabase';

interface CompanySettingsModalProps {
  company: CompanySettings;
  onSaveCompany: (updated: CompanySettings) => void;
  debts: Debt[];
  clients: Client[];
  sellers: Seller[];
  onRestoreDemoData: () => void;
  onImportAllData: (data: { debts: Debt[]; clients: Client[]; sellers: Seller[]; company: CompanySettings }) => void;
}

export const CompanySettingsView: React.FC<CompanySettingsModalProps> = ({
  company,
  onSaveCompany,
  debts,
  clients,
  sellers,
  onRestoreDemoData,
  onImportAllData,
}) => {
  const { language, setLanguage, languages, t } = useLanguage();
  const [formData, setFormData] = useState<CompanySettings>(company);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCopiedRelationshipSql, setIsCopiedRelationshipSql] = useState(false);

  // Manter formData atualizado se a prop company mudar
  useEffect(() => {
    setFormData(company);
  }, [company]);

  // Estados de Integração com Supabase
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseHealthResult | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isPullingSupabase, setIsPullingSupabase] = useState(false);
  const [supabaseFeedback, setSupabaseFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [isCopiedSchema, setIsCopiedSchema] = useState(false);
  const [isSchemaExpanded, setIsSchemaExpanded] = useState(false);

  // Carregar status inicial e SQL do Supabase
  useEffect(() => {
    let mounted = true;
    testSupabaseConnection().then(res => {
      if (mounted) setSupabaseStatus(res);
    });
    fetchSupabaseSchemaSql().then(sql => {
      if (mounted) setSchemaSql(sql);
    });
    return () => { mounted = false; };
  }, []);



  const RELATIONSHIPS_SQL = `-- ====================================================================
-- KwanzaCobro: Correção de Relacionamentos e Sincronização Automática
-- Tabelas: audit_trail, clients (clientes), company_settings, 
--          debt_items, debts, kwanzacobro_sync, payments, sellers
-- ====================================================================

-- 1. Compatibilidade de Nomenclatura: 'clientes' como VIEW de 'clients'
CREATE OR REPLACE VIEW public.clientes AS 
SELECT * FROM public.clients;

-- 2. Relacionamentos Foreign Key entre tabelas
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

-- 3. Salvaguarda: Criar cliente em 'clients' automaticamente se não existir
CREATE OR REPLACE FUNCTION public.auto_ensure_client_on_debt()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.client_id) THEN
        INSERT INTO public.clients (
            id, name, phone, province, municipality, client_type, credit_limit, created_by_seller_id, created_at
        ) VALUES (
            NEW.client_id, COALESCE(NEW.customer_name, 'Cliente ' || NEW.client_id), COALESCE(NEW.customer_phone, '900000000'), 'Luanda', 'Luanda', 'particular', 500000, NEW.seller_id, COALESCE(NEW.created_at, NOW())
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_ensure_client ON public.debts;
CREATE TRIGGER trigger_auto_ensure_client
BEFORE INSERT OR UPDATE OF client_id ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.auto_ensure_client_on_debt();

-- 4. Função e Triggers para RELACIONAR AUTOMATICAMENTE a tabela kwanzacobro_sync
CREATE OR REPLACE FUNCTION public.sync_relational_to_kwanzacobro_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_debts JSONB;
    v_clients JSONB;
    v_sellers JSONB;
    v_company JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', d.id, 'invoiceNumber', d.invoice_number, 'clientId', d.client_id, 'sellerId', d.seller_id,
            'customerName', d.customer_name, 'customerPhone', d.customer_phone, 'issueDate', d.issue_date,
            'dueDate', d.due_date, 'totalAmount', d.total_amount, 'status', d.status, 'paymentMethodAgreed', d.payment_method_agreed,
            'terms', d.terms, 'confirmationStatus', d.confirmation_status, 'confirmationMode', d.confirmation_mode,
            'confirmationCode', d.confirmation_code, 'confirmationTransactionId', d.confirmation_transaction_id,
            'reminder5DaysSent', d.reminder_5_days_sent, 'reminder5DaysSentAt', d.reminder_5_days_sent_at,
            'createdAt', d.created_at, 'updatedAt', d.updated_at,
            'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', di.id, 'description', di.description, 'quantity', di.quantity, 'unitPrice', di.unit_price, 'total', di.total)) FROM public.debt_items di WHERE di.debt_id = d.id), '[]'::jsonb),
            'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'debtId', p.debt_id, 'amount', p.amount, 'date', p.date, 'paymentMethod', p.payment_method, 'receiptRef', p.receipt_ref, 'notes', p.notes, 'receivedBy', p.received_by, 'createdAt', p.created_at)) FROM public.payments p WHERE p.debt_id = d.id), '[]'::jsonb)
        )
    ), '[]'::jsonb) INTO v_debts FROM public.debts d;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', c.id, 'name', c.name, 'nif', c.nif, 'phone', c.phone, 'email', c.email, 'province', c.province, 'municipality', c.municipality, 'address', c.address, 'clientType', c.client_type, 'creditLimit', c.credit_limit, 'notes', c.notes, 'createdBySellerId', c.created_by_seller_id, 'createdAt', c.created_at
        )
    ), '[]'::jsonb) INTO v_clients FROM public.clients c;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id, 'name', s.name, 'phone', s.phone, 'branch', s.branch, 'email', s.email, 'role', s.role, 'createdAt', s.created_at
        )
    ), '[]'::jsonb) INTO v_sellers FROM public.sellers s;

    SELECT COALESCE(to_jsonb(cs.*), '{}'::jsonb) INTO v_company FROM public.company_settings cs LIMIT 1;

    INSERT INTO public.kwanzacobro_sync (id, debts, clients, sellers, company, updated_at, updated_by)
    VALUES ('main', v_debts, v_clients, v_sellers, v_company, NOW(), 'database_trigger')
    ON CONFLICT (id) DO UPDATE SET
        debts = EXCLUDED.debts, clients = EXCLUDED.clients, sellers = EXCLUDED.sellers, company = EXCLUDED.company, updated_at = NOW(), updated_by = 'database_trigger';

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Triggers automáticos nas tabelas
DROP TRIGGER IF EXISTS trigger_sync_debts_to_snapshot ON public.debts;
CREATE TRIGGER trigger_sync_debts_to_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.debts FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_clients_to_snapshot ON public.clients;
CREATE TRIGGER trigger_sync_clients_to_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_sellers_to_snapshot ON public.sellers;
CREATE TRIGGER trigger_sync_sellers_to_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.sellers FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_payments_to_snapshot ON public.payments;
CREATE TRIGGER trigger_sync_payments_to_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_items_to_snapshot ON public.debt_items;
CREATE TRIGGER trigger_sync_items_to_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.debt_items FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();

DROP TRIGGER IF EXISTS trigger_sync_company_to_snapshot ON public.company_settings;
CREATE TRIGGER trigger_sync_company_to_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.company_settings FOR EACH STATEMENT EXECUTE FUNCTION public.sync_relational_to_kwanzacobro_sync();`;

  const handleCopyRelationshipSql = () => {
    navigator.clipboard.writeText(RELATIONSHIPS_SQL);
    setIsCopiedRelationshipSql(true);
    setTimeout(() => setIsCopiedRelationshipSql(false), 2500);
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseFeedback(null);
    try {
      const result = await testSupabaseConnection();
      setSupabaseStatus(result);
      if (result.connected) {
        setSupabaseFeedback({
          type: 'success',
          message: `Ligação com Supabase bem-sucedida! Latência: ${result.latencyMs ?? 0}ms`,
        });
      } else {
        setSupabaseFeedback({
          type: 'error',
          message: `Falha na ligação: ${result.message || 'Verifique a rede'}`,
        });
      }
    } catch (e: any) {
      setSupabaseFeedback({ type: 'error', message: e.message || 'Erro ao testar ligação' });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    setSupabaseFeedback(null);
    try {
      const res = await syncToSupabase({
        debts,
        clients,
        sellers,
        company: formData,
      });
      if (res.success) {
        setSupabaseFeedback({
          type: 'success',
          message: 'Sincronização com Supabase concluída com sucesso!',
        });
      } else {
        setSupabaseFeedback({
          type: res.tableMissing ? 'info' : 'error',
          message: res.message,
        });
        if (res.tableMissing) {
          setIsSchemaExpanded(true);
        }
      }
    } catch (e: any) {
      setSupabaseFeedback({ type: 'error', message: e.message || 'Erro ao sincronizar' });
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handlePullSupabase = async () => {
    if (!window.confirm('Deseja importar os dados armazenados no Supabase? Os dados locais serão atualizados com a cópia da nuvem.')) {
      return;
    }
    setIsPullingSupabase(true);
    setSupabaseFeedback(null);
    try {
      const res = await pullFromSupabase();
      if (res.success && res.data) {
        onImportAllData(res.data);
        setSupabaseFeedback({
          type: 'success',
          message: 'Dados importados com sucesso a partir do Supabase!',
        });
      } else {
        setSupabaseFeedback({
          type: 'info',
          message: res.message || 'Nenhum dado encontrado no Supabase.',
        });
      }
    } catch (e: any) {
      setSupabaseFeedback({ type: 'error', message: e.message || 'Erro ao importar' });
    } finally {
      setIsPullingSupabase(false);
    }
  };

  const handleCopySchemaSql = () => {
    if (!schemaSql) return;
    navigator.clipboard.writeText(schemaSql);
    setIsCopiedSchema(true);
    setTimeout(() => setIsCopiedSchema(false), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompany(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Exportar Backup JSON
  const handleExportBackup = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      company: formData,
      clients,
      sellers,
      debts,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_NEUROJUS_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Importar Backup JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.debts && parsed.clients && parsed.sellers) {
          onImportAllData({
            debts: parsed.debts,
            clients: parsed.clients,
            sellers: parsed.sellers,
            company: parsed.company || company,
          });
          alert('Cópia de segurança importada com sucesso!');
        } else {
          alert('O ficheiro JSON não possui a estrutura correta do NEUROJUS.');
        }
      } catch (err) {
        alert('Erro ao ler ficheiro de backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                {t('settings.admin_badge', 'Permissão Exclusiva de Administrador Geral')}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">
              {t('settings.title', 'Configurações da Empresa & Dados Bancários')}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t('settings.subtitle', 'Defina as coordenadas da sua empresa que serão inseridas automaticamente nas faturas, recibos e mensagens de cobrança via WhatsApp.')}
            </p>
          </div>
        </div>

        {/* Banner de Permissões de Administrador */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50 to-teal-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 space-y-1">
            <strong className="text-slate-900 block font-bold">
              {t('settings.admin_badge', 'Permissão Exclusiva de Administrador Geral')}
            </strong>
            <p>
              {t('settings.admin_notice', 'Apenas o Administrador Geral possui privilégios para alterar a identificação oficial da empresa, NIF, IBAN e número Multicaixa Express.')}
            </p>
          </div>
        </div>
      </div>

      {/* Seletor de Idiomas do Sistema (Português, Inglês, Francês, Árabe, Espanhol) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Globe className="w-4 h-4 text-emerald-700" />
            <span>{t('settings.language_pref', 'Preferência de Idioma do Sistema')}</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            5 Idiomas Disponíveis
          </span>
        </div>

        <p className="text-xs text-slate-600">
          {t('settings.language_desc', 'Escolha o idioma de exibição da interface do utilizador. As alterações são aplicadas instantaneamente.')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {languages.map(opt => {
            const isSelected = opt.code === language;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLanguage(opt.code)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-500/30 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-2xl mb-1">{opt.flag}</div>
                <div className="text-xs font-bold">{opt.name}</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">{opt.nativeName}</div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados da Empresa */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>{t('settings.company_info', 'Identificação Comercial & Logomarca')}</span>
            </div>
            <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              🛡️ Admin
            </span>
          </div>

          {/* Logomarca Oficial */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-xs">
                <img 
                  src={formData.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                  alt="Logomarca da Empresa" 
                  className="h-12 w-auto max-w-[200px] object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">{t('settings.logo_in_use', 'Logomarca Oficial em Uso')}</span>
                <span className="text-[11px] text-slate-500 block">
                  {t('settings.logo_hint', 'Exibida na barra de topo, nos comprovativos em PDF e nos recibos digitais.')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, logoUrl: '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg' })}
              className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              {t('settings.restore_logo', 'Restaurar Foto Oficial NEUROJUS')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Nome da Empresa */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-900">
                  {t('settings.company_name', 'Nome da Empresa / Armazém / Loja')} <span className="text-rose-500">*</span>
                </label>
                <span className="text-[9px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                  🛡️ Admin
                </span>
              </div>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: NEUROJUS - Consultoria & Prestação de Serviços"
                className="w-full py-2.5 px-3 text-xs font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50/20"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {t('settings.company_name_hint', 'Nome oficial da entidade comercial')}
              </span>
            </div>

            {/* 2. NIF */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-900">
                  {t('settings.nif', 'NIF (Número de Identificação Fiscal)')} <span className="text-rose-500">*</span>
                </label>
                <span className="text-[9px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                  🛡️ Admin
                </span>
              </div>
              <input
                type="text"
                required
                value={formData.nif}
                onChange={e => setFormData({ ...formData, nif: e.target.value })}
                placeholder="Ex: 5417089128"
                className="w-full py-2.5 px-3 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50/20"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {t('settings.nif_hint', 'Ex: 5417089128 (Contribuinte Angolano)')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.phone', 'Telefone Geral / Atendimento')}
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full py-2 px-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.email', 'E-mail para Notificações')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.address', 'Endereço Físico (Rua / Município / Província)')}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Nota de Autenticação Segura (Supabase Auth) */}
            <div className="sm:col-span-2 p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-700">
                <span className="font-bold text-slate-900 block">Autenticação Protegida por Supabase Auth</span>
                <span>
                  As credenciais de acesso dos administradores e vendedores desta empresa são geridas de forma encriptada no Supabase Auth através do separador <strong>Utilizadores</strong>, sem armazenamento de palavras-passe em texto simples.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dados Bancários para Cobrança em Angola (IBAN & Multicaixa Express) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>{t('settings.bank_info', 'Coordenadas Bancárias Angolanas (IBAN & Multicaixa Express)')}</span>
            </div>
            <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              🛡️ Admin
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {t('settings.bank_subtitle', 'Estes dados são enviados automaticamente nas mensagens de WhatsApp para que o cliente realize o pagamento via transferência bancária ou Multicaixa Express.')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.bank_name', 'Nome do Banco Principal')}
              </label>
              <input
                type="text"
                placeholder="Ex: Banco BAI, BFA, Millennium Atlântico, BPC"
                value={formData.bankName}
                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 4. Número para Multicaixa Express (MCX) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-900">
                  {t('settings.express_phone', 'Número para Multicaixa Express (MCX)')}
                </label>
                <span className="text-[9px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                  🛡️ Admin
                </span>
              </div>
              <input
                type="text"
                placeholder="Ex: 923 884 100"
                value={formData.expressPhone}
                onChange={e => setFormData({ ...formData, expressPhone: e.target.value })}
                className="w-full py-2.5 px-3 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50/20"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {t('settings.express_phone_hint', 'Contacto telefónico associado à conta Multicaixa Express')}
              </span>
            </div>

            {/* 3. IBAN Angolano */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-900">
                  {t('settings.iban', 'IBAN Angolano (Inicia com AO06...)')}
                </label>
                <span className="text-[9px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                  🛡️ Admin
                </span>
              </div>
              <input
                type="text"
                placeholder="Ex: AO06 0040 0000 9812 3456 1012 8"
                value={formData.iban}
                onChange={e => setFormData({ ...formData, iban: e.target.value })}
                className="w-full py-2.5 px-3 text-xs font-mono font-black tracking-wider text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50/20"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {t('settings.iban_hint', 'Ex: AO06 0040 0000 9812 3456 1012 8')}
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Salvar Alterações */}
        <div className="flex items-center justify-between">
          <div>
            {savedSuccess && (
              <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" />
                {t('settings.save_success', 'Configurações gravadas com sucesso!')}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{t('settings.save_btn', 'Guardar Alterações da Empresa')}</span>
          </button>
        </div>
      </form>

      {/* ============================================================= */}
      {/* INTEGRAÇÃO COM SUPABASE (Base de Dados Cloud PostgreSQL)        */}
      {/* ============================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Cloud className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Integração Supabase (Base de Dados Cloud)</h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sincronização em tempo real de dívidas, clientes, vendedores e amortizações na nuvem do Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {supabaseStatus?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Conectado ({supabaseStatus.latencyMs ?? 0} ms)</span>
              </span>
            ) : supabaseStatus ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Verificando Ligação</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                <Server className="w-3.5 h-3.5" />
                <span>Supabase Configurado</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback visual de ações */}
        {supabaseFeedback && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            supabaseFeedback.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : supabaseFeedback.type === 'info'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {supabaseFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : supabaseFeedback.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold">{supabaseFeedback.message}</span>
            </div>
          </div>
        )}

        {/* Parâmetros do Projeto Supabase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* URL do Projeto */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              URL do Projeto Supabase
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-slate-900 truncate">
                {SUPABASE_URL}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_URL);
                  alert('URL copiado!');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
                title="Copiar URL"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[10px] text-slate-400 block font-mono">
              Ref: {SUPABASE_PROJECT_REF}
            </span>
          </div>

          {/* Chave de API Pública (Anon Key) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Chave Pública (Anon Key)
              </span>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                {showApiKey ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>Ocultar</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>Mostrar</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-medium text-slate-800 truncate">
                {showApiKey ? SUPABASE_ANON_KEY : `${SUPABASE_ANON_KEY.slice(0, 16)}••••••••••••••••`}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_ANON_KEY);
                  alert('Chave de API copiada!');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
                title="Copiar Chave"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[10px] text-emerald-700 block font-medium">
              ✓ Chave pública segura para clientes web e móveis
            </span>
          </div>
        </div>

        {/* Botões de Ação Supabase */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleTestSupabase}
            disabled={isTestingSupabase}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isTestingSupabase ? 'Testando Conexão...' : 'Testar Conexão Supabase'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncSupabase}
            disabled={isSyncingSupabase}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-pulse' : ''}`} />
            <span>{isSyncingSupabase ? 'Sincronizando...' : 'Sincronizar com Supabase'}</span>
          </button>

          <button
            type="button"
            onClick={handlePullSupabase}
            disabled={isPullingSupabase}
            className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Download className={`w-3.5 h-3.5 ${isPullingSupabase ? 'animate-spin' : ''}`} />
            <span>{isPullingSupabase ? 'Importando...' : 'Importar da Nuvem Supabase'}</span>
          </button>

          <a
            href="https://supabase.com/dashboard/project/ckcwpcnsfennfjmjwoqp"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <span>Painel Supabase</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>



        {/* ======================================================== */}
        {/* CARD: RELACIONAMENTOS & SINCRONIZAÇÃO KWANZACOBRO_SYNC  */}
        {/* ======================================================== */}
        <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-indigo-50 border border-emerald-300 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                FK
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950">
                  Script SQL: Correção de Relacionamentos & Ligação da Tabela kwanzacobro_sync
                </h4>
                <p className="text-[11px] text-emerald-800">
                  Liga as tabelas <strong>debts, clients, sellers, payments, debt_items</strong> e sincroniza automaticamente com <strong>kwanzacobro_sync</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyRelationshipSql}
              className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              {isCopiedRelationshipSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-800">Script Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Copiar Script de Relacionamentos</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-900 text-emerald-300 p-3 rounded-lg font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48 shadow-inner select-all border border-slate-800">
            <span className="text-slate-400">-- 1. View clientes para compatibilidade total</span><br />
            <span className="text-amber-300 font-bold">CREATE OR REPLACE VIEW</span> public.clientes <span className="text-amber-300 font-bold">AS SELECT * FROM</span> public.clients;<br /><br />
            <span className="text-slate-400">-- 2. Foreign Keys (clients -&gt; sellers, debts -&gt; clients, debts -&gt; sellers, debt_items -&gt; debts, payments -&gt; debts)</span><br />
            <span className="text-slate-400">-- 3. Trigger auto_ensure_client (impede erro de cliente ausente em vendas rápidas)</span><br />
            <span className="text-slate-400">-- 4. Triggers automáticos que mantêm kwanzacobro_sync sempre atualizada em tempo real!</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-emerald-900 font-medium">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" /> View <strong>clientes</strong> criada
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" /> 6 Chaves Estrangeiras asseguradas
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" /> Triggers em <strong>kwanzacobro_sync</strong> ativos
            </span>
          </div>
        </div>

        {/* Guia e Visualizador do Script SQL para o Supabase */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
          <div 
            onClick={() => setIsSchemaExpanded(!isSchemaExpanded)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Esquema SQL de Tabelas & Políticas RLS (supabase-schema.sql)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Script pronto para executar no SQL Editor do painel do Supabase
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopySchemaSql();
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                {isCopiedSchema ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>
              {isSchemaExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {isSchemaExpanded && (
            <div className="border-t border-slate-200 p-4 space-y-3 bg-white">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-950 space-y-1.5">
                <strong className="block font-bold">Instruções para ativar no Supabase:</strong>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-emerald-900">
                  <li>Aceda ao projeto <strong>ckcwpcnsfennfjmjwoqp</strong> no painel web do Supabase.</li>
                  <li>Clique na barra lateral em <strong>SQL Editor</strong> e crie uma <strong>New Query</strong>.</li>
                  <li>Clique no botão acima <strong>Copiar SQL</strong> e cole na área do editor.</li>
                  <li>Clique no botão <strong>RUN</strong> no Supabase para criar as tabelas (<code className="bg-emerald-100 px-1 rounded">kwanzacobro_sync</code>, <code className="bg-emerald-100 px-1 rounded">debts</code>, etc.).</li>
                </ol>
              </div>

              <pre className="p-3 bg-slate-900 text-slate-100 text-[11px] font-mono rounded-lg overflow-x-auto max-h-56 leading-relaxed select-all">
                {schemaSql || '-- A carregar esquema SQL...'}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Gestão de Base de Dados & Backup Local */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 pt-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Cópias de Segurança & Gestão de Dados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Exportar JSON */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-2">
            <span className="text-xs font-bold text-slate-900 block">Exportar Cópia de Segurança</span>
            <p className="text-[11px] text-slate-500">
              Descarregue todas as faturas, amortizações, clientes e vendedores num ficheiro JSON seguro.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full py-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarregar Backup JSON</span>
            </button>
          </div>

          {/* Importar JSON */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-2">
            <span className="text-xs font-bold text-slate-900 block">Restaurar de Ficheiro</span>
            <p className="text-[11px] text-slate-500">
              Substitua a base de dados atual a partir de uma cópia de segurança guardada anteriormente.
            </p>
            <label className="w-full py-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Carregar Ficheiro JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>

          {/* Repor Dados Demonstrativos */}
          <div className="p-4 border border-amber-200 bg-amber-50/40 rounded-lg space-y-2">
            <span className="text-xs font-bold text-amber-900 block">Dados Demonstrativos</span>
            <p className="text-[11px] text-amber-800">
              Repor conjunto de clientes, vendedores e dívidas de exemplo do mercado angolano.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Tem a certeza de que deseja recarregar os dados de demonstração de Angola?')) {
                  onRestoreDemoData();
                }
              }}
              className="w-full py-1.5 px-3 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-md transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Repor Demonstração</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
