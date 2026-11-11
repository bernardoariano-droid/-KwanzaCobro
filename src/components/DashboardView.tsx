import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  MessageSquare, 
  CreditCard, 
  Eye, 
  ArrowRight, 
  Building2, 
  UserCheck,
  Smartphone,
  Download,
  BellRing,
  Plus,
  Users,
  Receipt,
  FileCheck,
  BarChart3,
  History,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';
import { Debt, Client, Seller, CompanySettings, AuthUser } from '../types/debt';
import { 
  formatKwanza, 
  formatDate, 
  getRemainingBalance, 
  getPaidAmount, 
  getDaysDiff, 
  getEffectiveStatus 
} from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardViewProps {
  debts: Debt[];
  clients: Client[];
  sellers: Seller[];
  company: CompanySettings;
  currentUser?: AuthUser | null;
  onNavigateToDebts: (filter?: string) => void;
  onOpenNewDebt: () => void;
  onOpenPayment: (debt: Debt) => void;
  onOpenWhatsApp: (debt: Debt) => void;
  onViewDebtDetail: (debt: Debt) => void;
  onOpen5DayReminders: () => void;
  onOpenInstallPWA?: () => void;
  onOpenNewClient?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  debts,
  clients,
  sellers,
  company,
  currentUser,
  onNavigateToDebts,
  onOpenNewDebt,
  onOpenPayment,
  onOpenWhatsApp,
  onViewDebtDetail,
  onOpen5DayReminders,
  onOpenInstallPWA,
  onOpenNewClient,
  onNavigateToTab,
}) => {
  const { t } = useLanguage();
  const [quickFilter, setQuickFilter] = useState<'all' | 'overdue' | 'due5days' | 'settled'>('all');

  const isSeller = currentUser?.role === 'vendedor';

  // Escopo de visualização por função: vendedor só vê as faturas atribuídas a ele
  const effectiveDebts = useMemo(() => {
    if (isSeller && currentUser) {
      return debts.filter(d => d.sellerId === currentUser.id || d.sellerId === currentUser.name);
    }
    return debts;
  }, [debts, isSeller, currentUser]);

  const effectiveClients = useMemo(() => {
    if (isSeller && currentUser) {
      return clients.filter(c => {
        const isCreatedByHim = c.createdBySellerId === currentUser.id;
        const hasHisDebt = debts.some(d => 
          d.clientId === c.id && (d.sellerId === currentUser.id || d.sellerId === currentUser.name)
        );
        return isCreatedByHim || hasHisDebt;
      });
    }
    return clients;
  }, [clients, debts, isSeller, currentUser]);

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);
  const getSeller = (sellerId: string) => sellers.find(s => s.id === sellerId);

  // Cálculos financeiros globais
  let totalOriginatedAmount = 0;
  let totalRecoveredAmount = 0;
  let totalRemainingAmount = 0;
  let totalOverdueAmount = 0;
  let totalDueSoonAmount = 0;

  const overdueDebts: Debt[] = [];
  const dueTodayOrSoonDebts: Debt[] = [];
  const settledDebts: Debt[] = [];

  effectiveDebts.forEach(debt => {
    totalOriginatedAmount += debt.totalAmount;
    const paid = getPaidAmount(debt);
    totalRecoveredAmount += paid;
    const remaining = Math.max(0, debt.totalAmount - paid);

    if (remaining <= 0) {
      settledDebts.push(debt);
    } else {
      totalRemainingAmount += remaining;
      const daysDiff = getDaysDiff(debt.dueDate);

      if (daysDiff > 0) {
        totalOverdueAmount += remaining;
        overdueDebts.push(debt);
      } else if (daysDiff === 0 || (daysDiff < 0 && Math.abs(daysDiff) <= 7)) {
        totalDueSoonAmount += remaining;
        dueTodayOrSoonDebts.push(debt);
      }
    }
  });

  // Dívidas a vencer nos próximos 5 dias
  const debtsDueIn5Days = useMemo(() => {
    return effectiveDebts.filter(d => {
      const rem = getRemainingBalance(d);
      if (rem <= 0) return false;
      const diff = getDaysDiff(d.dueDate);
      return diff <= 0 && Math.abs(diff) <= (company.daysBeforeDueAlert || 5) && Math.abs(diff) > 0;
    });
  }, [effectiveDebts, company]);

  // Taxa de recuperação global
  const recoveryRate = totalOriginatedAmount > 0 
    ? Math.round((totalRecoveredAmount / totalOriginatedAmount) * 100) 
    : 0;

  // Actividade recente combinando amortizações e emissões
  const recentActivity = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      amount: number;
      date: string;
      type: 'payment' | 'invoice';
      debt: Debt;
    }> = [];

    effectiveDebts.forEach(debt => {
      const client = getClient(debt.clientId);
      // Invoices
      list.push({
        id: `inv-${debt.id}`,
        title: `Venda a Crédito · ${debt.invoiceNumber}`,
        subtitle: `${debt.customerName || client?.name || 'Cliente'} (Limite: ${formatDate(debt.dueDate)})`,
        amount: debt.totalAmount,
        date: debt.createdAt || debt.issueDate,
        type: 'invoice',
        debt,
      });

      // Payments
      debt.payments.forEach(p => {
        list.push({
          id: `pay-${p.id}`,
          title: `Amortização · ${p.receiptRef}`,
          subtitle: `${debt.customerName || client?.name} · Confirmado por ${p.receivedBy}`,
          amount: p.amount,
          date: p.date,
          type: 'payment',
          debt,
        });
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [effectiveDebts, clients]);

  // Distribuição por métodos de pagamento para gráfico
  const methodStats = useMemo(() => {
    const map: Record<string, number> = {
      multicaixa_express: 0,
      transferencia_bancaria: 0,
      tpa: 0,
      dinheiro: 0,
    };
    effectiveDebts.forEach(d => {
      d.payments.forEach(p => {
        map[p.paymentMethod] = (map[p.paymentMethod] || 0) + p.amount;
      });
    });
    return map;
  }, [effectiveDebts]);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* 1. Header do Painel Principal KwanzaCobro com Azul Institucional */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full font-mono uppercase tracking-wider">
                KwanzaCobro · {company.currency || 'AOA'}
              </span>
              {isSeller ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 text-slate-950 rounded-full uppercase tracking-wider">
                  Vendedor: {currentUser?.name}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded-full uppercase tracking-wider">
                  Administração Geral
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isSeller ? t('dashboard.welcome_seller', 'Painel de Vendas e Cobranças no Terreno') : t('dashboard.welcome_admin', 'Painel Geral de Gestão e Controlo de Crédito')}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Monitorização em tempo real de crédito empresarial, recebimentos, prazos de vencimento e cobranças ativas em Angola.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {debtsDueIn5Days.length > 0 && (
              <button
                onClick={onOpen5DayReminders}
                className="px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <BellRing className="w-4 h-4 text-slate-900" />
                <span>{t('dashboard.check_reminders_btn', 'Alertas 5 Dias')} ({debtsDueIn5Days.length})</span>
              </button>
            )}

            <button
              onClick={onOpenNewDebt}
              className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/40"
            >
              <Plus className="w-4 h-4 text-emerald-200" />
              <span>+ {t('dashboard.new_debt_btn', 'Registar Venda')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Grid de Métricas Principais (6 Indicadores Solicitados) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total de Clientes */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{t('dashboard.total_clients', 'Total Clientes')}</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {effectiveClients.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Clientes sob gestão
          </div>
        </div>

        {/* Card 2: Total de Dívidas (Volume Emitido) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{t('dashboard.total_debts', 'Total Dívidas')}</span>
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalOriginatedAmount)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {effectiveDebts.length} faturas faturadas
          </div>
        </div>

        {/* Card 3: Total Pagamentos Recebidos */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{t('dashboard.total_payments', 'Pagamentos Recebidos')}</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalRecoveredAmount)}
          </div>
          <div className="mt-1 text-xs font-bold text-emerald-700">
            {recoveryRate}% de eficácia
          </div>
        </div>

        {/* Card 4: Dívidas Pendentes (Saldo em Aberto) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{t('dashboard.pending_debts', 'Dívidas Pendentes')}</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalRemainingAmount)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {effectiveDebts.filter(d => getRemainingBalance(d) > 0).length} ativas no sistema
          </div>
        </div>

        {/* Card 5: Dívidas Vencidas */}
        <div className="bg-white border border-rose-200/90 rounded-2xl p-4.5 shadow-xs hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-rose-700 font-medium">
            <span>{t('dashboard.overdue_debts', 'Dívidas Vencidas')}</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-rose-700 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalOverdueAmount)}
          </div>
          <div className="mt-1 text-xs font-bold text-rose-600">
            {overdueDebts.length} faturas em mora
          </div>
        </div>

        {/* Card 6: Próximos Vencimentos (7 Dias) */}
        <div className="bg-white border border-amber-200/90 rounded-2xl p-4.5 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-amber-900 font-medium">
            <span>{t('dashboard.upcoming_due', 'Próximos Vencimentos')}</span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-amber-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalDueSoonAmount)}
          </div>
          <div className="mt-1 text-xs text-amber-800">
            {dueTodayOrSoonDebts.length} a monitorar
          </div>
        </div>
      </div>

      {/* 3. Atalhos para Operações Frequentes */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {t('dashboard.shortcuts', 'Atalhos para Operações Frequentes')}
          </span>
          <span className="text-[11px] text-slate-400">Ações imediatas em 1 clique</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={onOpenNewDebt}
            className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-900">
                {t('nav.new_sale', 'Nova Venda')}
              </span>
              <span className="text-[10px] text-slate-500">Registo a crédito</span>
            </div>
          </button>

          {onOpenNewClient && (
            <button
              onClick={onOpenNewClient}
              className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all text-left flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 bg-slate-200 text-slate-700 rounded-lg w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
              <div className="mt-2">
                <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-900">
                  {t('dashboard.new_client_btn', 'Novo Cliente')}
                </span>
                <span className="text-[10px] text-slate-500">Cadastrar devedor</span>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              if (effectiveDebts.length > 0) {
                const pending = effectiveDebts.find(d => getRemainingBalance(d) > 0);
                if (pending) onOpenPayment(pending);
              }
            }}
            className="p-3 bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-300 rounded-xl transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg w-fit group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="font-bold text-xs text-slate-900 block group-hover:text-amber-900">
                {t('debts.btn_amortize', 'Amortização')}
              </span>
              <span className="text-[10px] text-slate-500">Abater saldo</span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToDebts('vencida')}
            className="p-3 bg-slate-50 hover:bg-rose-50/60 border border-slate-200/80 hover:border-rose-300 rounded-xl transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg w-fit group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="font-bold text-xs text-slate-900 block group-hover:text-rose-900">
                {t('debts.filter_overdue', 'Cobrar Vencidas')}
              </span>
              <span className="text-[10px] text-slate-500">{overdueDebts.length} faturas</span>
            </div>
          </button>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('receipts')}
              className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all text-left flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="mt-2">
                <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-900">
                  Recibos PDF
                </span>
                <span className="text-[10px] text-slate-500">Impressão oficial</span>
              </div>
            </button>
          )}

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('reports')}
              className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all text-left flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 bg-slate-200 text-slate-700 rounded-lg w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="mt-2">
                <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-900">
                  Relatórios
                </span>
                <span className="text-[10px] text-slate-500">Balanço financeiro</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 4. Gráficos Financeiros & Actividade Recente (Layout em 2 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Gráficos Financeiros e Canais */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Gráficos Financeiros & Eficácia
              </h2>
              <p className="text-xs text-slate-500">
                Distribuição do capital e canais de liquidação em Kwanzas
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              {recoveryRate}% Recuperado
            </span>
          </div>

          {/* Gráfico 1: Barra de Recuperação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Progresso de Quitação:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatKwanza(totalRecoveredAmount)} / {formatKwanza(totalOriginatedAmount)}
              </span>
            </div>
            <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${recoveryRate}%` }}
              />
              <div 
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${100 - recoveryRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="text-emerald-700 font-bold">✓ {settledDebts.length} faturas quitadas</span>
              <span className="text-emerald-700 font-bold">• {effectiveDebts.length - settledDebts.length} em cobrança</span>
            </div>
          </div>

          {/* Gráfico 2: Canais Mais Utilizados */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-700 block">
              Liquidação por Meio de Pagamento (Kz):
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                <span className="font-sans text-[11px] font-semibold text-purple-900 block">Multicaixa Express</span>
                <span className="text-base font-black text-purple-950 mt-1 block" data-tabular>
                  {formatKwanza(methodStats.multicaixa_express)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <span className="font-sans text-[11px] font-semibold text-emerald-900 block">Transferência IBAN</span>
                <span className="text-base font-black text-emerald-950 mt-1 block" data-tabular>
                  {formatKwanza(methodStats.transferencia_bancaria)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2: Actividade Recente (Últimas Operações) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Actividade Recente
              </h2>
              <p className="text-xs text-slate-500">
                Últimos registos de vendas, amortizações e liquidações
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('audit')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Ver histórico
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhuma atividade recente registada.
              </div>
            ) : (
              recentActivity.map(act => (
                <div 
                  key={act.id} 
                  className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      act.type === 'payment' ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {act.type === 'payment' ? <CreditCard className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {act.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {act.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-mono font-bold ${
                      act.type === 'payment' ? 'text-emerald-700' : 'text-slate-900'
                    }`} data-tabular>
                      {act.type === 'payment' ? `+ ${formatKwanza(act.amount)}` : formatKwanza(act.amount)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(act.date)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Prazos nos Próximos 7 Dias & Cobranças Ráridas WhatsApp */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prazos Iminentes (Próximos 7 Dias) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Prazos a Vencer nos Próximos 7 Dias
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento preventivo para garantir a liquidação pontual
              </p>
            </div>
            <button
              onClick={() => onNavigateToDebts('aberta')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Ver agenda
            </button>
          </div>

          {dueTodayOrSoonDebts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Nenhuma compra a crédito com vencimento previsto para a próxima semana.
            </div>
          ) : (
            <div className="space-y-2.5">
              {dueTodayOrSoonDebts.slice(0, 4).map(debt => {
                const client = getClient(debt.clientId);
                const remaining = getRemainingBalance(debt);
                const daysDiff = getDaysDiff(debt.dueDate);
                const isToday = daysDiff === 0;

                return (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {debt.customerName || client?.name}
                        </span>
                        {isToday ? (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            VENCE HOJE
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 font-mono">
                            em {Math.abs(daysDiff)} dias
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                        <span>{debt.invoiceNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>Data Limite: {formatDate(debt.dueDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right mr-1">
                        <div className="text-xs font-bold text-slate-900 font-mono" data-tabular>
                          {formatKwanza(remaining)}
                        </div>
                      </div>
                      <button
                        onClick={() => onOpenPayment(debt)}
                        title="Registar Amortização / Pagamento"
                        className="p-2 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4 text-amber-600" />
                      </button>
                      <button
                        onClick={() => onOpenWhatsApp(debt)}
                        title="Enviar lembrete amigável no WhatsApp"
                        className="p-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cobranças Rápidas WhatsApp (ou Desempenho Vendedores) */}
        {!isSeller ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Carteira por Vendedor / Filial
                </h2>
                <p className="text-xs text-slate-500">
                  Volume de crédito concedido e eficácia por funcionário
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {sellers.length} vendedores
              </span>
            </div>

            <div className="space-y-3">
              {sellers.map(seller => {
                const sellerDebts = debts.filter(d => d.sellerId === seller.id);
                const totalOrig = sellerDebts.reduce((sum, d) => sum + d.totalAmount, 0);
                const totalPaid = sellerDebts.reduce((sum, d) => sum + getPaidAmount(d), 0);
                const totalPending = Math.max(0, totalOrig - totalPaid);
                const sellerRecovery = totalOrig > 0 ? Math.round((totalPaid / totalOrig) * 100) : 0;

                return (
                  <div key={seller.id} className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{seller.name}</span>
                        <span className="text-slate-500 ml-1.5 text-[11px]">({seller.branch})</span>
                      </div>
                      <div className="font-mono text-slate-800 font-bold" data-tabular>
                        Pendente: {formatKwanza(totalPending, false)}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2.5">
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${sellerRecovery}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-600 font-semibold whitespace-nowrap">
                        {sellerRecovery}% ({sellerDebts.length} faturas)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Cobranças Rápidas por WhatsApp (Meus Clientes)
                </h2>
                <p className="text-xs text-slate-500">
                  Avisos preventivos e cobranças de clientes atribuídos a si
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                {effectiveDebts.filter(d => getRemainingBalance(d) > 0).length} a cobrar
              </span>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {effectiveDebts.filter(d => getRemainingBalance(d) > 0).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  Parabéns! Todos os seus clientes estão com pagamentos 100% em dia.
                </div>
              ) : (
                effectiveDebts
                  .filter(d => getRemainingBalance(d) > 0)
                  .slice(0, 5)
                  .map(debt => {
                    const client = getClient(debt.clientId);
                    const remaining = getRemainingBalance(debt);
                    const daysDiff = getDaysDiff(debt.dueDate);
                    const isOverdue = daysDiff > 0;

                    return (
                      <div key={debt.id} className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {client?.name || debt.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-bold text-amber-800">
                              {formatKwanza(remaining)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                              {isOverdue ? `${daysDiff}d em atraso` : `Vence a ${formatDate(debt.dueDate)}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => onOpenPayment(debt)}
                            title="Confirmar pagamento ou amortização e diminuir dívida no sistema"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:scale-95 rounded-lg border border-amber-300 shadow-2xs whitespace-nowrap transition-all cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                            <span>Amortizar</span>
                          </button>
                          <button
                            onClick={() => onOpenWhatsApp(debt)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-2xs whitespace-nowrap transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Cobrar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
