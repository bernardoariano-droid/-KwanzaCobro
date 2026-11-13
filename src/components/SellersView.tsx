import React, { useState } from 'react';
import {
  UserPlus,
  Phone,
  Building2,
  Receipt,
  X,
  Check,
  ShieldCheck,
  Mail,
  Trash2,
  Edit3,
  Search,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  Seller,
  Debt,
  AuthUser,
  CompanySettings,
  UserRole,
  Utilizador,
  isSuperAdminRole,
  isAdminOrSuperRole,
  normalizeUserRole,
} from '../types/debt';
import { PRESERVED_SUPER_ADMIN_EMAIL, PRESERVED_SUPER_ADMIN_UUID } from '../data/initialData';
import { formatKwanza, getRemainingBalance, getPaidAmount, getDaysDiff } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

export interface CreateUserInput {
  name: string;
  phone: string;
  branch: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
}

export interface UpdateUserInput {
  userId: string;
  name: string;
  phone: string;
  branch: string;
  email: string;
  password?: string;
  role: UserRole;
  companyId?: string | null;
  isActive: boolean;
}

interface SellersViewProps {
  sellers: Seller[];
  utilizadores?: Utilizador[];
  debts: Debt[];
  currentUser?: AuthUser | null;
  onAddSeller: (user: CreateUserInput) => Promise<{ success: boolean; error?: string }> | void;
  onUpdateSeller?: (user: UpdateUserInput) => Promise<{ success: boolean; error?: string }> | void;
  onDeleteSeller?: (sellerId: string) => Promise<{ success: boolean; error?: string }> | void;
  onFilterDebtsBySeller: (sellerId: string) => void;
  companies?: CompanySettings[];
  currentCompanyId?: string;
}

export const SellersView: React.FC<SellersViewProps> = ({
  sellers,
  utilizadores = [],
  debts,
  currentUser,
  onAddSeller,
  onUpdateSeller,
  onDeleteSeller,
  onFilterDebtsBySeller,
  companies = [],
  currentCompanyId = 'default_company',
}) => {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<Utilizador | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+244 9');
  const [branch, setBranch] = useState('Armazém Central Viana');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('vendedor');
  const [isActive, setIsActive] = useState(true);
  const [targetCompanyId, setTargetCompanyId] = useState(currentCompanyId);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSuperAdmin = isSuperAdminRole(currentUser?.role);
  const isAdmin = isAdminOrSuperRole(currentUser?.role);

  // Combinar utilizadores reais de public.utilizadores com eventual fallback de sellers (sem nunca inventar senhas)
  const unifiedUsers: Utilizador[] = React.useMemo(() => {
    const map = new Map<string, Utilizador>();

    (sellers || []).forEach(s => {
      map.set(s.id, {
        id: s.id,
        name: s.name,
        email: s.email || '',
        phone: s.phone,
        role: normalizeUserRole(s.role),
        companyId: s.companyId || 'default_company',
        isActive: s.isActive !== false,
        branch: s.branch || 'Sede',
        sellerId: s.id,
        createdAt: s.createdAt,
      });
    });

    (utilizadores || []).forEach(u => {
      const existing = map.get(u.id);
      map.set(u.id, {
        ...existing,
        ...u,
        branch: u.branch || existing?.branch || 'Sede',
        phone: u.phone || existing?.phone || '',
        role: normalizeUserRole(u.role),
      });
    });

    return Array.from(map.values());
  }, [utilizadores, sellers]);

  const isProtectedUser = (u: Utilizador) =>
    u.id.toLowerCase() === PRESERVED_SUPER_ADMIN_UUID.toLowerCase() ||
    u.email.toLowerCase() === PRESERVED_SUPER_ADMIN_EMAIL.toLowerCase();

  const openAddForm = () => {
    setEditingUser(null);
    setName('');
    setPhone('+244 9');
    setBranch('Armazém Central Viana');
    setEmail('');
    setPassword('');
    setRole('vendedor');
    setIsActive(true);
    setTargetCompanyId(isSuperAdmin ? (companyFilter !== 'all' ? companyFilter : currentCompanyId) : (currentUser?.companyId || currentCompanyId));
    setErrorMessage(null);
    setIsAdding(true);
  };

  const openEditForm = (u: Utilizador) => {
    if (isProtectedUser(u)) {
      setErrorMessage('A conta do Super Administrador principal está protegida e não pode ser alterada.');
      return;
    }
    setEditingUser(u);
    setName(u.name);
    setPhone(u.phone || '+244 9');
    setBranch(u.branch || 'Sede');
    setEmail(u.email || '');
    setPassword('');
    setRole(normalizeUserRole(u.role));
    setIsActive(u.isActive !== false);
    setTargetCompanyId(u.companyId || currentCompanyId);
    setErrorMessage(null);
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Informe o nome completo do utilizador.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Informe um endereço de e-mail válido para acesso Supabase Auth.');
      return;
    }
    if (!editingUser && password.trim().length < 6) {
      setErrorMessage('Para novos utilizadores, a palavra-passe inicial deve ter no mínimo 6 caracteres.');
      return;
    }
    if (editingUser && password.trim().length > 0 && password.trim().length < 6) {
      setErrorMessage('A nova palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }

    const resolvedCompanyId = isSuperAdmin
      ? (role === 'super_admin' ? undefined : targetCompanyId)
      : (currentUser?.companyId || currentCompanyId);

    setIsSaving(true);
    try {
      if (editingUser && onUpdateSeller) {
        const res = await onUpdateSeller({
          userId: editingUser.id,
          name: name.trim(),
          phone: phone.trim(),
          branch: branch.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim() || undefined,
          role,
          companyId: resolvedCompanyId ?? null,
          isActive,
        });
        if (res && !res.success) {
          setErrorMessage(res.error || 'Não foi possível atualizar o utilizador.');
          return;
        }
        setSuccessMessage(
          `Utilizador atualizado com sucesso no Supabase Auth & public.utilizadores: ${name.trim()}`
        );
      } else {
        const res = await onAddSeller({
          name: name.trim(),
          phone: phone.trim(),
          branch: branch.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role,
          companyId: resolvedCompanyId,
        });
        if (res && !res.success) {
          setErrorMessage(res.error || 'Não foi possível cadastrar o utilizador.');
          return;
        }
        setSuccessMessage(
          `Utilizador criado no Supabase Auth e registado em public.utilizadores: ${name.trim()} (${email.trim().toLowerCase()})`
        );
      }

      setTimeout(() => setSuccessMessage(null), 6000);
      setName('');
      setEmail('');
      setPassword('');
      setEditingUser(null);
      setIsAdding(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao guardar utilizador.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserStatus = async (u: Utilizador) => {
    if (!onUpdateSeller) return;
    if (u.id === currentUser?.id) {
      setErrorMessage('Nenhum utilizador pode desativar a própria conta.');
      return;
    }
    if (isProtectedUser(u)) {
      setErrorMessage('O Super Administrador principal não pode ser desativado.');
      return;
    }
    setErrorMessage(null);
    const res = await onUpdateSeller({
      userId: u.id,
      name: u.name,
      phone: u.phone || '',
      branch: u.branch || 'Sede',
      email: u.email,
      role: u.role,
      companyId: u.companyId || null,
      isActive: !u.isActive,
    });
    if (res && !res.success) {
      setErrorMessage(res.error || 'Erro ao alterar o estado do utilizador.');
    }
  };

  const filteredUsers = unifiedUsers.filter(u => {
    const matchesCompany =
      !isSuperAdmin || companyFilter === 'all' || (u.companyId || 'default_company') === companyFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.branch || '').toLowerCase().includes(q);
    return matchesCompany && matchesSearch;
  });

  const getRoleBadge = (r?: UserRole) => {
    const normalized = normalizeUserRole(r);
    if (normalized === 'super_admin') {
      return (
        <span className="text-[10px] font-bold bg-emerald-800 text-white px-2 py-0.5 rounded-md uppercase">
          Super Admin
        </span>
      );
    }
    if (normalized === 'admin_geral') {
      return (
        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md uppercase">
          Admin Geral
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md uppercase">
        Vendedor
      </span>
    );
  };

  const isEditingSelf = Boolean(editingUser && currentUser && editingUser.id === currentUser.id);

  return (
    <div className="space-y-6 pb-20 lg:pb-12">
      {/* Header com estilo moderno SaaS do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              {isSuperAdmin ? 'Controlo Global de Utilizadores' : t('sellers.title', 'Funcionários e Permissões')}
            </span>
            {isSuperAdmin ? (
              <span className="text-[10px] font-bold bg-emerald-800 text-white px-2.5 py-0.5 rounded-full">
                Super Administrador
              </span>
            ) : isAdmin ? (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {t('role.admin', 'Administrador Geral')}
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                {t('role.seller', 'Vendedor / Funcionário')}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isSuperAdmin
              ? 'Controlo de Utilizadores, Permissões e Equipas por Empresa'
              : t('sellers.subtitle', 'Gestão de equipa comercial, vendedores e permissões.')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            {isSuperAdmin
              ? 'Como Super Administrador, pode criar contas no Supabase Auth, gerir perfis em public.utilizadores e vincular utilizadores a qualquer empresa.'
              : isAdmin
              ? 'Como Administrador Geral, pode cadastrar novos utilizadores na sua empresa, gerir estados e auditar a carteira de cada vendedor.'
              : 'Lista da equipa comercial. Cada vendedor acede e cobra a sua própria carteira de clientes.'}
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-100" />
            <span>+ Novo Utilizador / Vendedor</span>
          </button>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
            Apenas o Administrador Geral pode cadastrar novos utilizadores.
          </div>
        )}
      </div>

      {/* Filtros para Super Admin / Pesquisa */}
      {isAdmin && unifiedUsers.length > 0 && (
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar utilizador por nome, e-mail ou filial..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
            />
          </div>

          {isSuperAdmin && companies.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Filtrar por Empresa:</span>
              <select
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                className="flex-1 sm:w-64 py-2 px-3 text-xs border border-emerald-200 rounded-xl bg-emerald-50/40 text-emerald-950 font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
              >
                <option value="all">Todas as Empresas ({unifiedUsers.length})</option>
                {companies.map(c => (
                  <option key={c.id || 'default_company'} value={c.id || 'default_company'}>
                    {c.name} ({unifiedUsers.filter(u => (u.companyId || 'default_company') === (c.id || 'default_company')).length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-900 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Formulário do Administrador / Super Admin para Cadastrar ou Editar Utilizador */}
      {isAdding && isAdmin && (
        <form onSubmit={handleSave} noValidate className="p-5 sm:p-6 bg-white border border-emerald-200 rounded-2xl shadow-md space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900">
                {editingUser ? `Editar Utilizador: ${editingUser.name}` : 'Cadastrar Novo Utilizador (Supabase Auth + public.utilizadores)'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingUser(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Mateus Afonso Pascoal"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail de Acesso (Supabase Auth) <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="utilizador@empresa.ao"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                placeholder="+244 923 000 000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filial / Posto de Atendimento
              </label>
              <input
                type="text"
                placeholder="Ex: Armazém Viana, Filial Benguela..."
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {editingUser ? 'Nova Palavra-passe (opcional)' : 'Palavra-passe Inicial'} {!editingUser && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="password"
                required={!editingUser}
                minLength={6}
                placeholder={editingUser ? 'Deixe vazio para manter a atual' : 'Mínimo 6 caracteres'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full py-2 px-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nível de Permissão (Perfil)
              </label>
              <select
                value={role}
                disabled={isEditingSelf}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="vendedor">vendedor (Carteira da própria empresa)</option>
                <option value="admin_geral">admin_geral (Gestão exclusiva da empresa)</option>
                {isSuperAdmin && (
                  <option value="super_admin">super_admin (Acesso global multiempresa)</option>
                )}
              </select>
              {isEditingSelf && (
                <span className="text-[10px] text-amber-700 mt-1 block">
                  Nenhum utilizador pode alterar o próprio perfil ou empresa.
                </span>
              )}
            </div>

            {isSuperAdmin && companies.length > 0 && role !== 'super_admin' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empresa Vinculada
                </label>
                <select
                  value={targetCompanyId}
                  disabled={isEditingSelf}
                  onChange={e => setTargetCompanyId(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-emerald-950 disabled:bg-slate-100"
                >
                  {companies.map(c => (
                    <option key={c.id || 'default_company'} value={c.id || 'default_company'}>
                      {c.name} ({c.nif || 'S/NIF'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editingUser && (
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="user-active-toggle"
                  type="checkbox"
                  disabled={isEditingSelf}
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <label htmlFor="user-active-toggle" className="text-xs font-bold text-slate-700">
                  Conta Ativa no Sistema
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingUser(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-70"
            >
              {isSaving ? 'A guardar...' : editingUser ? 'Guardar Alterações' : 'Criar Conta & Ativar Acesso'}
            </button>
          </div>
        </form>
      )}

      {/* Grid de Utilizadores / Vendedores */}
      {filteredUsers.length === 0 ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs">
            <UserPlus className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              {unifiedUsers.length === 0 ? 'Nenhum utilizador ou vendedor cadastrado' : 'Nenhum utilizador encontrado com os filtros atuais'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cadastre utilizadores reais ligados ao Supabase Auth e à tabela public.utilizadores para acesso seguro por empresa.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={openAddForm}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-100" />
              <span>Cadastrar Funcionário / Utilizador</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredUsers.map(u => {
            const sellerDebts = debts.filter(
              d => d.sellerId === u.id || (u.sellerId && d.sellerId === u.sellerId)
            );
            const totalSoldCredit = sellerDebts.reduce((sum, d) => sum + d.totalAmount, 0);
            const totalPaid = sellerDebts.reduce((sum, d) => sum + getPaidAmount(d), 0);
            const totalRemaining = Math.max(0, totalSoldCredit - totalPaid);
            const overdueCount = sellerDebts.filter(d => getRemainingBalance(d) > 0 && getDaysDiff(d.dueDate) > 0).length;
            const recoveryRate = totalSoldCredit > 0 ? Math.round((totalPaid / totalSoldCredit) * 100) : 0;
            const isCurrentSessionUser = currentUser?.id === u.id;
            const protectedAccount = isProtectedUser(u);

            return (
              <div
                key={u.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  isCurrentSessionUser
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : !u.isActive
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <h3 className="font-bold text-sm text-slate-900 truncate">{u.name}</h3>
                        {isCurrentSessionUser && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md">
                            Você
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.isActive ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center flex-wrap gap-1.5">
                        {getRoleBadge(u.role)}
                        {u.branch && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{u.branch}</span>
                          </span>
                        )}
                      </div>
                      {companies.length > 0 && u.companyId && (
                        <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1.5 flex items-center gap-1 w-fit">
                          <Building2 className="w-3 h-3 text-emerald-600" />
                          <span>
                            {companies.find(c => (c.id || 'default_company') === u.companyId)?.name || 'Empresa'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    {u.phone && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                    {u.email && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Estatísticas Financeiras */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Vendas a Crédito ({sellerDebts.length}):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatKwanza(totalSoldCredit, false)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total Recuperado:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {formatKwanza(totalPaid, false)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-bold">
                    <span className="text-rose-800">Saldo Pendente:</span>
                    <span className="font-mono text-rose-800">
                      {formatKwanza(totalRemaining, false)}
                    </span>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                      <span className="text-slate-500">Eficácia de Cobrança</span>
                      <span className="font-mono text-slate-800">{recoveryRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${recoveryRate}%` }}
                      />
                    </div>
                  </div>

                  {overdueCount > 0 && (
                    <div className="text-[11px] text-rose-700 font-semibold pt-1">
                      ⚠️ {overdueCount} {overdueCount === 1 ? 'dívida vencida' : 'dívidas vencidas'} a requerer cobrança.
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onFilterDebtsBySeller(u.id)}
                    className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Ver Carteira</span>
                  </button>

                  {isAdmin && onUpdateSeller && !protectedAccount && !isCurrentSessionUser && (
                    <button
                      type="button"
                      onClick={() => handleToggleUserStatus(u)}
                      className={`p-2.5 border rounded-xl transition-colors cursor-pointer ${
                        u.isActive
                          ? 'text-emerald-700 border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                          : 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      title={u.isActive ? 'Desativar utilizador' : 'Ativar utilizador'}
                    >
                      {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                  )}

                  {isAdmin && onUpdateSeller && !protectedAccount && (
                    <button
                      type="button"
                      onClick={() => openEditForm(u)}
                      className="p-2.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-colors cursor-pointer"
                      title="Editar Utilizador e Permissões"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isAdmin && onDeleteSeller && !isCurrentSessionUser && !protectedAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Tem a certeza de que deseja remover/desativar o utilizador ${u.name}?`)) {
                          onDeleteSeller(u.id);
                        }
                      }}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors cursor-pointer"
                      title="Remover Utilizador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
