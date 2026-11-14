import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit3, 
  CreditCard, 
  Phone, 
  Mail, 
  Users, 
  Receipt, 
  Copy, 
  Check, 
  Database,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ShieldCheck,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { CompanySettings, Seller, Client, Debt, Utilizador } from '../types/debt';
import { formatKwanza } from '../utils/formatters';
import { TempSuperAdminPasswordModal } from './TempSuperAdminPasswordModal';
import { fetchSupabaseSchemaSql } from '../lib/supabase';

function generateCompanyUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface CompaniesManagementViewProps {
  companies: CompanySettings[];
  activeCompanyId: string;
  onSelectActiveCompany: (companyId: string) => void;
  onSaveCompany: (company: CompanySettings) => Promise<{ success: boolean; error?: string } | void> | void;
  onDeleteCompany?: (companyId: string) => Promise<{ success: boolean; error?: string } | void> | void;
  onManageCompanyUsers?: (companyId: string) => void;
  utilizadores?: Utilizador[];
  sellers: Seller[];
  clients: Client[];
  debts: Debt[];
}

export const CompaniesManagementView: React.FC<CompaniesManagementViewProps> = ({
  companies,
  activeCompanyId,
  onSelectActiveCompany,
  onSaveCompany,
  onDeleteCompany,
  onManageCompanyUsers,
  utilizadores = [],
  sellers,
  clients,
  debts,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanySettings | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlPreviewText, setSqlPreviewText] = useState<string>('');
  const [isCopiedSql, setIsCopiedSql] = useState(false);
  const [isTempPasswordModalOpen, setIsTempPasswordModalOpen] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Formulário de Cadastro / Edição
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formNif, setFormNif] = useState('');
  const [formPhone, setFormPhone] = useState('+244 ');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Luanda, Angola');
  const [formBankName, setFormBankName] = useState('Banco BAI');
  const [formIban, setFormIban] = useState('AO06 ');
  const [formExpressPhone, setFormExpressPhone] = useState('');
  const [formPenalty, setFormPenalty] = useState(0.1);
  const [formDueDays, setFormDueDays] = useState(5);
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [isSaving, setIsSaving] = useState(false);

  const openNewCompanyModal = () => {
    const newId = generateCompanyUuid();
    setFormId(newId);
    setFormName('');
    setFormNif('');
    setFormPhone('+244 9');
    setFormEmail('');
    setFormAddress('');
    setFormCity('Luanda, Angola');
    setFormBankName('Banco BAI (Banco Angolano de Investimentos)');
    setFormIban('AO06 0040 0000 ');
    setFormExpressPhone('');
    setFormPenalty(0.1);
    setFormDueDays(5);
    setFormStatus('ativo');
    setEditingCompany(null);
    setFeedbackError(null);
    setIsModalOpen(true);
  };

  const openEditCompanyModal = (comp: CompanySettings) => {
    setFormId(comp.id || generateCompanyUuid());
    setFormName(comp.name);
    setFormNif(comp.nif);
    setFormPhone(comp.phone);
    setFormEmail(comp.email);
    setFormAddress(comp.address);
    setFormCity(comp.city);
    setFormBankName(comp.bankName);
    setFormIban(comp.iban);
    setFormExpressPhone(comp.expressPhone);
    setFormPenalty(comp.penaltyPerDayRate ?? 0.1);
    setFormDueDays(comp.daysBeforeDueAlert || 5);
    setFormStatus(comp.status || 'ativo');
    setEditingCompany(comp);
    setFeedbackError(null);
    setIsModalOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSaving(true);
    setFeedbackError(null);
    const payload: CompanySettings = {
      id: formId,
      name: formName.trim(),
      nif: formNif.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      address: formAddress.trim(),
      city: formCity.trim(),
      bankName: formBankName.trim(),
      iban: formIban.trim(),
      expressPhone: formExpressPhone.trim(),
      currency: 'Kz',
      penaltyPerDayRate: Number(formPenalty) || 0.1,
      daysBeforeDueAlert: Number(formDueDays) || 5,
      autoAlertNotifications: true,
      status: formStatus,
      createdAt: editingCompany?.createdAt || new Date().toISOString().slice(0, 10),
    };

    try {
      const result = await onSaveCompany(payload);
      if (result && result.success === false) {
        setFeedbackError(result.error || 'Não foi possível guardar a empresa no Supabase.');
        return;
      }
      setFeedbackSuccess(
        editingCompany
          ? `Empresa "${payload.name}" atualizada com sucesso.`
          : `Empresa "${payload.name}" cadastrada e pronta para receber utilizadores.`
      );
      setTimeout(() => setFeedbackSuccess(null), 5000);
      setIsModalOpen(false);
    } catch (err: any) {
      setFeedbackError(err?.message || 'Erro ao guardar empresa.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCompanyStatus = async (comp: CompanySettings) => {
    setFeedbackError(null);
    const newStatus = comp.status === 'inativo' ? 'ativo' : 'inativo';
    const updated: CompanySettings = {
      ...comp,
      status: newStatus,
    };
    const result = await onSaveCompany(updated);
    if (result && result.success === false) {
      setFeedbackError(result.error || 'Não foi possível alterar o estado da empresa.');
    }
  };

  // Filtragem das empresas
  const filteredCompanies = companies.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nif.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && (c.status || 'ativo') === statusFilter;
  });

  // Contagem real deduplicada de utilizadores (public.utilizadores + sellers)
  const getCompanyUsersCount = (compId: string) => {
    const ids = new Set<string>();
    (utilizadores || []).forEach(u => {
      if ((u.companyId || 'default_company') === compId) ids.add(u.id);
    });
    (sellers || []).forEach(s => {
      if ((s.companyId || 'default_company') === compId) ids.add(s.id);
    });
    return ids.size;
  };

  // Métricas Consolidadas
  const totalCompaniesCount = companies.length;
  const activeCompaniesCount = companies.filter(c => (c.status || 'ativo') === 'ativo').length;
  const totalUsersCount = React.useMemo(() => {
    const ids = new Set<string>();
    (utilizadores || []).forEach(u => ids.add(u.id));
    (sellers || []).forEach(s => ids.add(s.id));
    return ids.size;
  }, [utilizadores, sellers]);
  const totalDebtsVolume = debts.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

  // Script SQL Completo (Criação + Relacionamentos FK + RLS Multiempresa)
  const MULTI_TENANT_SQL = `-- ====================================================================
-- NEUROJUS / KwanzaCobro: Tabelas, Relacionamentos (FK) e RLS Multiempresa
-- Seguro e não-destrutivo: NÃO apaga dados, NÃO altera bamidia@gmail.com
-- e preserva is_super_admin(), current_company_id(), is_company_admin().
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Criar tabelas caso não existam (sem alterar estrutura existente)
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

-- 2. Relacionamentos adaptativos (compatível com company_settings.id uuid ou text)
DO $$
DECLARE
    v_comp_id_type TEXT;
    v_col_type TEXT;
BEGIN
    ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
    ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS super_admin_id TEXT;
    ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Sede';
    ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS seller_id TEXT;
    ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'company_settings' AND indexdef ILIKE '%(id)%'
    ) THEN
        CREATE UNIQUE INDEX idx_company_settings_id_unique ON public.company_settings(id);
    END IF;

    SELECT data_type INTO v_comp_id_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'id';

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

    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_schema='public' AND table_name='utilizadores' AND column_name='company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_utilizadores_company') THEN
        ALTER TABLE public.utilizadores ADD CONSTRAINT fk_utilizadores_company FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
    END IF;

    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_schema='public' AND table_name='sellers' AND column_name='company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sellers_company') THEN
        ALTER TABLE public.sellers ADD CONSTRAINT fk_sellers_company FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_company') THEN
        ALTER TABLE public.clients ADD CONSTRAINT fk_clients_company FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_schema='public' AND table_name='debts' AND column_name='company_id';
    IF v_col_type = v_comp_id_type AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_debts_company') THEN
        ALTER TABLE public.debts ADD CONSTRAINT fk_debts_company FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_utilizadores_company ON public.utilizadores(company_id);
CREATE INDEX IF NOT EXISTS idx_sellers_company ON public.sellers(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_debts_company ON public.debts(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_trail(company_id);`;

  const displayedSql = sqlPreviewText || MULTI_TENANT_SQL;

  const handleOpenSqlModal = async () => {
    setShowSqlModal(true);
    try {
      const fullSql = await fetchSupabaseSchemaSql();
      if (fullSql) setSqlPreviewText(fullSql);
    } catch {}
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(displayedSql);
    setIsCopiedSql(true);
    setTimeout(() => setIsCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* 1. Header do Módulo Super Administrador em Verde e Branco */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 rounded-full font-mono uppercase tracking-wider">
                Módulo Super Administrador · Multi-Empresa
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded-full uppercase tracking-wider">
                Acesso Total
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Gestão de Empresas & Controlo de Acessos
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Painel centralizado para registar e fiscalizar empresas comerciais, atribuir limites e monitorizar utilizadores em todo o território nacional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsTempPasswordModalOpen(true)}
              className="px-3.5 py-2.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-amber-300"
            >
              <KeyRound className="w-4 h-4 text-amber-800" />
              <span>Senha Super Admin (Temp)</span>
            </button>

            <button
              onClick={handleOpenSqlModal}
              className="px-3.5 py-2.5 text-xs font-bold text-emerald-950 bg-white hover:bg-emerald-50 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-200"
            >
              <Database className="w-4 h-4 text-emerald-700" />
              <span>Comandos SQL Supabase</span>
            </button>

            <button
              onClick={openNewCompanyModal}
              className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/40"
            >
              <Plus className="w-4 h-4 text-emerald-200" />
              <span>Cadastrar Nova Empresa</span>
            </button>
          </div>
        </div>
      </div>

      {feedbackError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{feedbackError}</span>
        </div>
      )}

      {feedbackSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* 2. Métricas Consolidadas do Super Administrador */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-emerald-100 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total de Empresas</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {totalCompaniesCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {activeCompaniesCount} empresas ativas
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Utilizadores Totais</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {totalUsersCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Admins e vendedores na plataforma
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Clientes Cadastrados</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {clients.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Devedores e compradores a crédito
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Volume Global a Crédito</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalDebtsVolume)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {debts.length} faturas emitidas
          </div>
        </div>
      </div>

      {/* 3. Barra de Pesquisa e Filtros */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome, NIF, email ou cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todas ({companies.length})
          </button>
          <button
            onClick={() => setStatusFilter('ativo')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'ativo' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Ativas ({companies.filter(c => (c.status || 'ativo') === 'ativo').length})
          </button>
          <button
            onClick={() => setStatusFilter('inativo')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'inativo' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Inativas ({companies.filter(c => c.status === 'inativo').length})
          </button>
        </div>
      </div>

      {/* 4. Lista de Empresas Cadastradas (Cards Modernos Verde e Branco) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCompanies.map(comp => {
          const compId = comp.id || 'default_company';
          const isActiveSelected = activeCompanyId === compId;
          const compUsersCount = getCompanyUsersCount(compId);
          const compClients = clients.filter(c => (c.companyId || 'default_company') === compId);
          const compDebts = debts.filter(d => (d.companyId || 'default_company') === compId);
          const isCompActive = (comp.status || 'ativo') === 'ativo';

          return (
            <div
              key={compId}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                isActiveSelected ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-emerald-100 hover:border-emerald-300'
              }`}
            >
              <div>
                {/* Topo do Card: Logomarca, Nome e Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center font-bold text-lg shadow-xs overflow-hidden shrink-0 border border-emerald-200">
                      {comp.logoUrl ? (
                        <img src={comp.logoUrl} alt={comp.name} className="w-full h-full object-contain p-1 bg-white" />
                      ) : (
                        comp.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">
                          {comp.name}
                        </h3>
                        {isActiveSelected && (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded-md uppercase font-mono">
                            Ativa em Visualização
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>NIF: <strong className="text-slate-700 font-mono">{comp.nif || 'Não definido'}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>{comp.city}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider font-mono shrink-0 ${
                    isCompActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isCompActive ? '✓ Ativa' : 'Inativa'}
                  </span>
                </div>

                {/* Detalhes de Contacto e Coordenadas Bancárias */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono">{comp.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{comp.email}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate col-span-1 sm:col-span-2">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate font-mono text-[11px]">
                      {comp.bankName}: {comp.iban || 'Sem IBAN'}
                    </span>
                  </div>
                  {comp.expressPhone && (
                    <div className="flex items-center gap-2 truncate col-span-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                        Multicaixa Express
                      </span>
                      <span className="font-mono text-slate-800 font-semibold">{comp.expressPhone}</span>
                    </div>
                  )}
                </div>

                {/* Autenticação Supabase Auth & Contagens da Empresa */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Auth: public.utilizadores (RLS)</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                    <span>{compUsersCount} utilizadores</span>
                    <span>{compClients.length} clientes</span>
                    <span>{compDebts.length} faturas</span>
                  </div>
                </div>
              </div>

              {/* Ações do Card */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleCompanyStatus(comp)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    isCompActive 
                      ? 'text-slate-600 border-slate-200 hover:bg-slate-50' 
                      : 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {isCompActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  <span>{isCompActive ? 'Desativar' : 'Ativar'}</span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {onManageCompanyUsers && (
                    <button
                      type="button"
                      onClick={() => onManageCompanyUsers(compId)}
                      className="px-2.5 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Gerir utilizadores e permissões desta empresa"
                    >
                      <Users className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Utilizadores ({compUsersCount})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditCompanyModal(comp)}
                    className="p-2 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar informações da empresa"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {onDeleteCompany && compId !== 'default_company' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Tem a certeza que deseja remover a empresa "${comp.name}"? Todos os utilizadores, clientes e dívidas associados a esta empresa serão afetados.`)) {
                          const res = await onDeleteCompany(compId);
                          if (res && res.success === false) {
                            setFeedbackError(res.error || 'Não foi possível remover a empresa.');
                          }
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectActiveCompany(compId)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActiveSelected
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    <span>{isActiveSelected ? 'Empresa Selecionada' : 'Controlar Empresa'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="bg-white rounded-2xl border border-emerald-100 p-12 text-center text-slate-500 text-xs">
          Nenhuma empresa encontrada com os filtros selecionados.
        </div>
      )}

      {/* 5. Modal de Cadastro / Edição de Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {editingCompany ? 'Editar Dados da Empresa' : 'Cadastrar Nova Empresa'}
                </h2>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Preencha as informações fiscais, coordenadas bancárias e estado operacional da empresa.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-emerald-200 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-6 overflow-y-auto space-y-4">
              {feedbackError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{feedbackError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Oficial da Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Comercial & Distribuidora Silva, Lda"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIF Angolano *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5412984510"
                    value={formNif}
                    onChange={e => setFormNif(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone Institucional *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+244 923 000 000"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Institucional *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="gerencia@empresa.ao"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cidade / Província
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Luanda, Talatona"
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Rua Rainha Ginga, Edifício Atlântico, Piso 2"
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Banco Principal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Banco BAI / BFA / BIC"
                    value={formBankName}
                    onChange={e => setFormBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    IBAN Angolano (AO06...)
                  </label>
                  <input
                    type="text"
                    placeholder="AO06 0040 0000 1234 5678 1012 3"
                    value={formIban}
                    onChange={e => setFormIban(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número Multicaixa Express
                  </label>
                  <input
                    type="text"
                    placeholder="923 000 000"
                    value={formExpressPhone}
                    onChange={e => setFormExpressPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado da Empresa
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as 'ativo' | 'inativo')}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none font-semibold"
                  >
                    <option value="ativo">Ativa (Acesso Permitido)</option>
                    <option value="inativo">Inativa (Acesso Suspenso)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-70"
                >
                  {isSaving ? 'A guardar...' : editingCompany ? 'Guardar Alterações' : 'Cadastrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal de Comandos SQL para a Supabase */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-300" />
                  <span>Comandos SQL de Criação e Relacionamento de Tabelas</span>
                </h2>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Copie e execute este script no SQL Editor do seu projeto Supabase para ativar chaves estrangeiras entre as empresas e utilizadores.
                </p>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-2 text-emerald-200 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Script PostgreSQL com integridade referencial (`FOREIGN KEY ... ON DELETE CASCADE`):
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                >
                  {isCopiedSql ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-emerald-600" />}
                  <span>{isCopiedSql ? 'Copiado para a Área de Transferência!' : 'Copiar Código SQL'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 selection:bg-emerald-600 selection:text-white">
                {displayedSql}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <TempSuperAdminPasswordModal
        isOpen={isTempPasswordModalOpen}
        onClose={() => setIsTempPasswordModalOpen(false)}
        isSuperAdminAuthenticated={true}
      />
    </div>
  );
};
