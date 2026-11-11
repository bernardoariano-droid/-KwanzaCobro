import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MessageSquare, 
  CreditCard, 
  Eye, 
  Printer, 
  Plus, 
  Calendar, 
  X,
  FileDown,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Debt, Client, Seller, DebtStatus, CompanySettings, AuthUser } from '../types/debt';
import { 
  formatKwanza, 
  formatDate, 
  getRemainingBalance, 
  getPaidAmount, 
  getPaidPercentage, 
  getDaysDiff, 
  getEffectiveStatus 
} from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface DebtsListViewProps {
  debts: Debt[];
  clients: Client[];
  sellers: Seller[];
  company: CompanySettings;
  currentUser?: AuthUser | null;
  initialFilter?: string;
  onOpenNewDebt: () => void;
  onOpenPayment: (debt: Debt) => void;
  onOpenWhatsApp: (debt: Debt) => void;
  onViewDebtDetail: (debt: Debt) => void;
  onPrintDebt: (debt: Debt) => void;
  onDownloadPDF?: (debt: Debt) => void;
}

export const DebtsListView: React.FC<DebtsListViewProps> = ({
  debts,
  clients,
  sellers,
  company,
  currentUser,
  initialFilter = 'all',
  onOpenNewDebt,
  onOpenPayment,
  onOpenWhatsApp,
  onViewDebtDetail,
  onPrintDebt,
  onDownloadPDF,
}) => {
  const { t } = useLanguage();
  const isSeller = currentUser?.role === 'vendedor';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [dueDateStart, setDueDateStart] = useState<string>('');
  const [dueDateEnd, setDueDateEnd] = useState<string>('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount' | 'client' | 'issueDate'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);
  const getSeller = (sellerId: string) => sellers.find(s => s.id === sellerId);

  // Províncias únicas presentes nos clientes
  const provinces = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => {
      if (c.province) set.add(c.province);
    });
    return Array.from(set).sort();
  }, [clients]);

  // Filtragem
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      // Regra de Acesso: Vendedor só pode controlar os clientes e vendas atendidas por ele!
      if (isSeller && currentUser?.id && debt.sellerId !== currentUser.id && debt.sellerId !== currentUser.name) {
        return false;
      }

      const client = getClient(debt.clientId);
      const seller = getSeller(debt.sellerId);
      const remaining = getRemainingBalance(debt);
      const daysDiff = getDaysDiff(debt.dueDate);

      // Filtro de texto (busca)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesDoc = debt.invoiceNumber.toLowerCase().includes(query);
        const matchesClient = client?.name.toLowerCase().includes(query) || false;
        const matchesNif = (client?.nif || '').toLowerCase().includes(query);
        const matchesSeller = seller?.name.toLowerCase().includes(query) || false;
        if (!matchesDoc && !matchesClient && !matchesNif && !matchesSeller) {
          return false;
        }
      }

      // Filtro por Estado
      if (statusFilter === 'aberta') {
        if (remaining <= 0 || daysDiff > 0) return false;
      } else if (statusFilter === 'vencida') {
        if (remaining <= 0 || daysDiff <= 0) return false;
      } else if (statusFilter === 'vence_5dias') {
        if (remaining <= 0 || daysDiff > 0 || Math.abs(daysDiff) > 5) return false;
      } else if (statusFilter === 'vence_7dias') {
        if (remaining <= 0 || daysDiff > 0 || Math.abs(daysDiff) > 7) return false;
      } else if (statusFilter === 'liquidada') {
        if (remaining > 0) return false;
      } else if (statusFilter === 'acordo') {
        if (debt.status !== 'acordo') return false;
      } else if (statusFilter === 'confirmada_sms') {
        if (debt.confirmationStatus !== 'confirmada') return false;
      }

      // Filtro por Vendedor
      if (selectedSeller !== 'all' && debt.sellerId !== selectedSeller) {
        return false;
      }

      // Filtro por Província
      if (selectedProvince !== 'all' && client?.province !== selectedProvince) {
        return false;
      }

      // Filtro por Data Limite De / Até
      if (dueDateStart && debt.dueDate < dueDateStart) {
        return false;
      }
      if (dueDateEnd && debt.dueDate > dueDateEnd) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'dueDate') {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortBy === 'issueDate') {
        const dateA = new Date(a.issueDate).getTime();
        const dateB = new Date(b.issueDate).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortBy === 'amount') {
        const remA = getRemainingBalance(a);
        const remB = getRemainingBalance(b);
        return sortOrder === 'asc' ? remA - remB : remB - remA;
      }
      if (sortBy === 'client') {
        const nameA = getClient(a.clientId)?.name || '';
        const nameB = getClient(b.clientId)?.name || '';
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      return 0;
    });
  }, [debts, clients, sellers, searchQuery, statusFilter, selectedSeller, selectedProvince, dueDateStart, dueDateEnd, sortBy, sortOrder, isSeller, currentUser]);

  // Totais do subconjunto filtrado
  const filteredTotals = useMemo(() => {
    let totalOrig = 0;
    let totalRem = 0;
    let totalPaid = 0;
    filteredDebts.forEach(d => {
      totalOrig += d.totalAmount;
      const paid = getPaidAmount(d);
      totalPaid += paid;
      totalRem += Math.max(0, d.totalAmount - paid);
    });
    return { totalOrig, totalRem, totalPaid };
  }, [filteredDebts]);

  // Função para exportar CSV compatível com Excel
  const handleExportCSV = () => {
    const headers = ['Nº Fatura', 'Cliente', 'NIF', 'Telefone', 'Província', 'Vendedor', 'Data Emissão', 'Data Limite Pagamento', 'Dias Atraso/Restantes', 'Valor Total (Kz)', 'Valor Pago (Kz)', 'Saldo Devedor (Kz)', 'Estado'];
    const rows = filteredDebts.map(d => {
      const c = getClient(d.clientId);
      const s = getSeller(d.sellerId);
      const rem = getRemainingBalance(d);
      const paid = getPaidAmount(d);
      const eff = getEffectiveStatus(d);
      return [
        `"${d.invoiceNumber}"`,
        `"${c?.name || ''}"`,
        `"${c?.nif || ''}"`,
        `"${c?.phone || ''}"`,
        `"${c?.province || ''}"`,
        `"${s?.name || ''}"`,
        `"${d.issueDate}"`,
        `"${d.dueDate}"`,
        `"${eff.daysDiff}"`,
        `"${d.totalAmount}"`,
        `"${paid}"`,
        `"${rem}"`,
        `"${eff.label}"`
      ].join(';');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KwanzaCobro_Dividas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedSeller('all');
    setSelectedProvince('all');
    setDueDateStart('');
    setDueDateEnd('');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || selectedSeller !== 'all' || selectedProvince !== 'all' || dueDateStart || dueDateEnd;

  return (
    <div className="space-y-6 pb-20 lg:pb-12 max-w-full overflow-x-hidden">
      {/* Top Header com Título e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t('debts.title', 'Registo e Gestão de Dívidas')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t('debts.subtitle', 'Gira todas as compras a crédito, consulte prazos e confirme amortizações.')}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={handleExportCSV}
            title={t('debts.export_csv', 'Exportar CSV')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">{t('debts.export_csv', 'Exportar CSV')}</span>
          </button>

          <button
            onClick={onOpenNewDebt}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-200" />
            <span>{t('dashboard.new_debt_btn', 'Registar Compra a Crédito')}</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Segmented Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3 sm:space-y-4">
        {/* Linha 1: Abas de Status com Contagens */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t('debts.filter_all', 'Todas')} ({debts.length})
          </button>

          <button
            onClick={() => setStatusFilter('vence_5dias')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'vence_5dias'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-amber-900 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <span>⏰ 5d</span>
            <span className="font-mono text-[11px] tabular-nums font-bold">
              ({debts.filter(d => {
                const rem = getRemainingBalance(d);
                const diff = getDaysDiff(d.dueDate);
                return rem > 0 && diff <= 0 && Math.abs(diff) <= 5 && Math.abs(diff) > 0;
              }).length})
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('vencida')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'vencida'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <span>{t('debts.filter_overdue', 'Vencidas')}</span>
            <span className="font-mono text-[11px] tabular-nums font-bold">
              ({debts.filter(d => getRemainingBalance(d) > 0 && getDaysDiff(d.dueDate) > 0).length})
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('aberta')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'aberta'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {t('debts.filter_open', 'Em Aberto')}
          </button>

          <button
            onClick={() => setStatusFilter('liquidada')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'liquidada'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {t('debts.filter_paid', 'Liquidadas')}
          </button>
        </div>

        {/* Linha 2: Busca por texto e selects específicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Busca por texto */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('debts.search_placeholder', 'Pesquisar fatura, cliente, NIF...')}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Vendedor (Apenas Administrador) */}
          {!isSeller && (
            <div>
              <select
                value={selectedSeller}
                onChange={e => setSelectedSeller(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              >
                <option value="all">{t('common.all', 'Todos os Vendedores')}</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.branch})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro por Data Limite Início */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 whitespace-nowrap">De:</span>
              <input
                type="date"
                value={dueDateStart}
                onChange={e => setDueDateStart(e.target.value)}
                className="w-full py-1.5 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Filtro por Data Limite Fim */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 whitespace-nowrap">Até:</span>
              <input
                type="date"
                value={dueDateEnd}
                onChange={e => setDueDateEnd(e.target.value)}
                className="w-full py-1.5 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Linha 3: Resumo dos resultados filtrados */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs text-slate-600 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              <strong className="text-slate-900">{filteredDebts.length}</strong> / {debts.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('debts.balance', 'Saldo Devedor')}:{' '}
              <strong className="text-slate-900 font-mono font-bold" data-tabular>
                {formatKwanza(filteredTotals.totalRem)}
              </strong>
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium underline cursor-pointer"
            >
              {t('common.clean_filters', 'Limpar Filtros')}
            </button>
          )}
        </div>
      </div>

      {/* Lista de Dívidas Vazia */}
      {filteredDebts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center shadow-xs">
          <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">{t('debts.empty_title', 'Nenhum registo encontrado')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {t('debts.empty_desc', 'Nenhuma dívida corresponde aos critérios de pesquisa selecionados.')}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {t('common.clean_filters', 'Limpar Filtros')}
              </button>
            )}
            <button
              onClick={onOpenNewDebt}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
            >
              + {t('dashboard.new_debt_btn', 'Registar Compra a Crédito')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* MODO MOBILE / ANDROID FIRST (block md:hidden): CARDS 100% RESPONSIVOS SEM BARRA HORIZONTAL */}
          {/* ============================================================== */}
          <div className="block md:hidden space-y-3.5">
            {filteredDebts.map(debt => {
              const client = getClient(debt.clientId);
              const seller = getSeller(debt.sellerId);
              const remaining = getRemainingBalance(debt);
              const paid = getPaidAmount(debt);
              const pct = getPaidPercentage(debt);
              const effStatus = getEffectiveStatus(debt);
              const isOverdue = effStatus.status === 'vencida';
              const isDueToday = effStatus.daysDiff === 0 && remaining > 0;
              const phone = debt.customerPhone || client?.phone || '';

              return (
                <div
                  key={debt.id}
                  className={`bg-white border rounded-xl p-4 shadow-xs transition-shadow ${
                    isOverdue 
                      ? 'border-rose-200 bg-rose-50/20' 
                      : isDueToday 
                        ? 'border-amber-300 bg-amber-50/20' 
                        : 'border-slate-200'
                  }`}
                >
                  {/* Topo do Card: Fatura + Estado */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <button
                        onClick={() => onViewDebtDetail(debt)}
                        className="font-bold text-xs font-mono text-emerald-900 hover:underline flex items-center gap-1.5"
                      >
                        <span>{debt.invoiceNumber}</span>
                        {debt.confirmationStatus === 'confirmada' && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-sans font-semibold">
                            ✓ SMS
                          </span>
                        )}
                      </button>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {formatDate(debt.issueDate)} · {seller?.name || 'Vendedor'}
                      </div>
                    </div>
                    
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${effStatus.badgeClass}`}>
                      {effStatus.label}
                    </span>
                  </div>

                  {/* Informação do Cliente & Contacto */}
                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {debt.customerName || client?.name || 'Cliente'}
                      </div>
                      {phone && (
                        <div className="text-xs text-slate-600 font-mono mt-0.5 flex items-center gap-2">
                          <a 
                            href={`tel:${phone}`}
                            className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{phone}</span>
                          </a>
                          {client?.province && (
                            <span className="text-slate-400 text-[11px]">· {client.province}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Data Limite / Vencimento */}
                  <div className="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">{t('debts.due_date', 'Data Limite')}:</span>
                    <div className="text-right">
                      <span className={`font-bold font-mono ${isOverdue ? 'text-rose-700' : isDueToday ? 'text-amber-800' : 'text-slate-900'}`}>
                        {formatDate(debt.dueDate)}
                      </span>
                      <span className="text-[11px] ml-1.5 text-slate-500">
                        {remaining <= 0 ? (
                          <span className="text-emerald-700 font-semibold">{t('common.paid', 'Paga')}</span>
                        ) : isOverdue ? (
                          <span className="text-rose-600 font-semibold">({effStatus.daysDiff}d atraso)</span>
                        ) : isDueToday ? (
                          <span className="text-amber-800 font-bold">(HOJE)</span>
                        ) : (
                          <span>({Math.abs(effStatus.daysDiff)}d restam)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Valores & Progresso de Pagamento */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('debts.total', 'Valor Total')}</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5" data-tabular>
                        {formatKwanza(debt.totalAmount)}
                      </div>
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                      <div className="text-[10px] text-emerald-800 uppercase tracking-wider font-semibold">{t('debts.balance', 'Saldo Devedor')}</div>
                      <div className="font-mono font-black text-emerald-900 mt-0.5" data-tabular>
                        {formatKwanza(remaining)}
                      </div>
                    </div>
                  </div>

                  {debt.totalAmount > 0 && (
                    <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${remaining <= 0 ? 'bg-emerald-600' : 'bg-emerald-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Barra de Ações para Mobile (Toque Fácil, sem overflow) */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    {/* Linha Primária: Amortizar e WhatsApp */}
                    {remaining > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onOpenPayment(debt)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>{t('debts.btn_amortize', 'Amortizar')}</span>
                        </button>

                        <button
                          onClick={() => onOpenWhatsApp(debt)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    )}

                    {/* Linha Secundária: Detalhes, PDF e Impressão */}
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        onClick={() => onViewDebtDetail(debt)}
                        className="py-2 px-2 text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-98 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('debts.btn_details', 'Detalhes')}</span>
                      </button>

                      {onDownloadPDF && (
                        <button
                          onClick={() => onDownloadPDF(debt)}
                          className="py-2 px-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:scale-98 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                          <span>PDF</span>
                        </button>
                      )}

                      <button
                        onClick={() => onPrintDebt(debt)}
                        className="py-2 px-2 text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-98 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{t('common.print', 'Imprimir')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* MODO DESKTOP / TABLET HORIZONTAL (hidden md:block): TABELA DE ALTA DENSIDADE */}
          {/* ============================================================== */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{t('debts.invoice', 'Documento')}</th>
                    <th className="py-3 px-4">{t('debts.client', 'Cliente / Contacto')}</th>
                    <th className="py-3 px-4">{t('debts.seller', 'Vendedor Responsável')}</th>
                    <th className="py-3 px-4">{t('debts.issue_date', 'Data Emissão')}</th>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => {
                          if (sortBy === 'dueDate') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('dueDate');
                            setSortOrder('asc');
                          }
                        }}
                        className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-emerald-700 cursor-pointer"
                      >
                        <span>{t('debts.due_date', 'Data Limite Pagamento')}</span>
                        <span className="text-[10px]">{sortBy === 'dueDate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">{t('debts.total', 'Valor Total')} / {t('debts.balance', 'Saldo')}</th>
                    <th className="py-3 px-4 text-center">{t('debts.status', 'Estado')}</th>
                    <th className="py-3 px-4 text-center">{t('debts.actions', 'Ações')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDebts.map(debt => {
                    const client = getClient(debt.clientId);
                    const seller = getSeller(debt.sellerId);
                    const remaining = getRemainingBalance(debt);
                    const pct = getPaidPercentage(debt);
                    const effStatus = getEffectiveStatus(debt);
                    const isOverdue = effStatus.status === 'vencida';
                    const isDueToday = effStatus.daysDiff === 0 && remaining > 0;

                    return (
                      <tr 
                        key={debt.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isOverdue ? 'bg-rose-50/30' : isDueToday ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Documento */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            onClick={() => onViewDebtDetail(debt)}
                            className="font-bold text-xs text-slate-900 font-mono hover:text-emerald-700 transition-colors text-left cursor-pointer"
                          >
                            {debt.invoiceNumber}
                          </button>
                          <div className="text-[11px] text-slate-500">
                            {debt.items.length} {debt.items.length === 1 ? 'artigo' : 'artigos'}
                          </div>
                          {debt.confirmationTransactionId && (
                            <div className="text-[10px] text-emerald-700 font-mono font-semibold">
                              ✓ SMS {debt.confirmationTransactionId.slice(-9)}
                            </div>
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-xs text-slate-900 max-w-[220px] truncate">
                            {debt.customerName || client?.name || 'Cliente'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                            <span className="text-emerald-700 font-semibold">{debt.customerPhone || client?.phone || '-'}</span>
                            {client?.province && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{client.province}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Vendedor */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-xs font-medium text-slate-800">{seller?.name || '-'}</div>
                          <div className="text-[11px] text-slate-500">{seller?.branch || '-'}</div>
                        </td>

                        {/* Data Emissão */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                          {formatDate(debt.issueDate)}
                        </td>

                        {/* Data Limite */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className={`text-xs font-bold font-mono ${
                            isOverdue ? 'text-rose-700' : isDueToday ? 'text-amber-800 font-extrabold' : 'text-slate-900'
                          }`}>
                            {formatDate(debt.dueDate)}
                          </div>
                          <div className="text-[11px] font-medium">
                            {remaining <= 0 ? (
                              <span className="text-emerald-700">{t('common.paid', 'Liquidada')}</span>
                            ) : isOverdue ? (
                              <span className="text-rose-600 font-semibold font-mono">
                                {effStatus.daysDiff}d atraso
                              </span>
                            ) : isDueToday ? (
                              <span className="text-amber-800 font-bold">{t('debts.due_today', 'VENCE HOJE')}</span>
                            ) : (
                              <span className="text-slate-500 font-mono">
                                Restam {Math.abs(effStatus.daysDiff)}d
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Valores */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="text-xs font-bold text-slate-900 font-mono" data-tabular>
                            {formatKwanza(remaining)}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1 font-mono">
                            <span>Total: {formatKwanza(debt.totalAmount, false)}</span>
                          </div>
                          {debt.totalAmount > 0 && (
                            <div className="mt-1 w-24 ml-auto bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${remaining <= 0 ? 'bg-emerald-600' : 'bg-emerald-600'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${effStatus.badgeClass}`}>
                            {effStatus.label}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Cobrar WhatsApp */}
                            {remaining > 0 && (
                              <button
                                onClick={() => onOpenWhatsApp(debt)}
                                title={t('common.whatsapp', 'Enviar Notificação de Cobrança no WhatsApp')}
                                className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Registar Amortização */}
                            {remaining > 0 && (
                              <button
                                onClick={() => onOpenPayment(debt)}
                                title={t('debts.btn_amortize', 'Registar Pagamento / Amortização')}
                                className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Ver Detalhes */}
                            <button
                              onClick={() => onViewDebtDetail(debt)}
                              title={t('debts.btn_details', 'Ver Detalhes')}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Descarregar Recibo PDF */}
                            {onDownloadPDF && (
                              <button
                                onClick={() => onDownloadPDF(debt)}
                                title={t('common.download_pdf', 'Descarregar PDF')}
                                className="p-1.5 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                              >
                                <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                              </button>
                            )}

                            {/* Imprimir Recibo */}
                            <button
                              onClick={() => onPrintDebt(debt)}
                              title={t('common.print', 'Imprimir')}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
