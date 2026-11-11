import React, { useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  CreditCard, 
  Building2, 
  Printer, 
  Download,
  Users,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Debt, Client, Seller, CompanySettings, AuthUser } from '../types/debt';
import { formatKwanza, getRemainingBalance, getPaidAmount, getDaysDiff } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface FinancialReportsViewProps {
  debts: Debt[];
  clients: Client[];
  sellers: Seller[];
  company: CompanySettings;
  currentUser?: AuthUser | null;
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  debts,
  clients,
  sellers,
  company,
  currentUser,
}) => {
  const { t } = useLanguage();
  const isSeller = currentUser?.role === 'vendedor';

  const effectiveDebts = useMemo(() => {
    if (isSeller && currentUser) {
      return debts.filter(d => d.sellerId === currentUser.id || d.sellerId === currentUser.name);
    }
    return debts;
  }, [debts, isSeller, currentUser]);

  // Aggregate metrics
  const totals = useMemo(() => {
    let originated = 0;
    let recovered = 0;
    let remaining = 0;
    let overdue = 0;

    let aging0to15 = 0;
    let aging16to30 = 0;
    let aging31to60 = 0;
    let aging60Plus = 0;

    const methodTotals: Record<string, number> = {
      multicaixa_express: 0,
      transferencia_bancaria: 0,
      tpa: 0,
      dinheiro: 0,
      deposito: 0,
    };

    effectiveDebts.forEach(d => {
      originated += d.totalAmount;
      const paid = getPaidAmount(d);
      recovered += paid;
      const rem = Math.max(0, d.totalAmount - paid);
      remaining += rem;

      d.payments.forEach(p => {
        methodTotals[p.paymentMethod] = (methodTotals[p.paymentMethod] || 0) + p.amount;
      });

      if (rem > 0) {
        const daysDiff = getDaysDiff(d.dueDate);
        if (daysDiff > 0) {
          overdue += rem;
          if (daysDiff <= 15) aging0to15 += rem;
          else if (daysDiff <= 30) aging16to30 += rem;
          else if (daysDiff <= 60) aging31to60 += rem;
          else aging60Plus += rem;
        }
      }
    });

    const recoveryRate = originated > 0 ? Math.round((recovered / originated) * 100) : 0;

    return {
      originated,
      recovered,
      remaining,
      overdue,
      recoveryRate,
      aging: {
        aging0to15,
        aging16to30,
        aging31to60,
        aging60Plus,
      },
      methodTotals,
    };
  }, [effectiveDebts]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      {/* 1. Header do Módulo de Relatórios */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:border-none print:shadow-none">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {t('reports.title', 'Relatórios Financeiros')}
              </h1>
              <p className="text-xs text-slate-500">
                {t('reports.subtitle', 'Análise consolidada de vendas a crédito, amortizações e saldos pendentes.')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('common.print', 'Imprimir')}</span>
          </button>
        </div>
      </div>

      {/* 2. Grid de Indicadores Chave (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Volume Total Concedido</span>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(totals.originated)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {effectiveDebts.length} faturas emitidas
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <span className="text-xs font-medium text-emerald-700">Total Recuperado / Cobrado</span>
          <div className="mt-2 text-2xl font-black text-emerald-700 font-mono tracking-tight" data-tabular>
            {formatKwanza(totals.recovered)}
          </div>
          <span className="text-xs font-semibold text-emerald-800 mt-1 block">
            {totals.recoveryRate}% de eficácia de liquidação
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <span className="text-xs font-medium text-slate-600">Saldo Pendente em Aberto</span>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(totals.remaining)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {effectiveDebts.filter(d => getRemainingBalance(d) > 0).length} compras ativas
          </span>
        </div>

        <div className="bg-white border border-rose-200/90 rounded-2xl p-4.5 shadow-xs">
          <span className="text-xs font-medium text-rose-700">Volume Vencido em Mora</span>
          <div className="mt-2 text-2xl font-black text-rose-700 font-mono tracking-tight" data-tabular>
            {formatKwanza(totals.overdue)}
          </div>
          <span className="text-xs font-semibold text-rose-600 mt-1 block">
            Capital com risco de incumprimento
          </span>
        </div>
      </div>

      {/* 3. Gráfico Visual de Barra de Liquidação */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Evolução Geral da Carteira de Crédito
          </h2>
          <p className="text-xs text-slate-500">
            Comparativo entre o montante já liquidado e o saldo remanescente em cobrança
          </p>
        </div>

        <div className="space-y-2">
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-600 h-full transition-all duration-500" 
              style={{ width: `${totals.recoveryRate}%` }}
              title={`Recuperado: ${totals.recoveryRate}%`}
            />
            <div 
              className="bg-blue-600 h-full transition-all duration-500" 
              style={{ width: `${100 - totals.recoveryRate}%` }}
              title={`Pendente: ${100 - totals.recoveryRate}%`}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span className="font-bold text-emerald-800">Recuperado: {totals.recoveryRate}%</span>
              <span className="text-slate-400">({formatKwanza(totals.recovered)})</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span className="font-bold text-blue-800">Em Aberto: {100 - totals.recoveryRate}%</span>
              <span className="text-slate-400">({formatKwanza(totals.remaining)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Duas Colunas: Análise de Antiguidade (Aging) & Distribuição por Método */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Antiguidade da Dívida Vencida */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Antiguidade dos Saldos Vencidos (Aging Analysis)
            </h3>
            <p className="text-xs text-slate-500">
              Classificação por faixas de atraso para priorização das ações jurídicas e comerciais
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-sans font-bold text-slate-800">1 a 15 Dias de Atraso</span>
                <span className="text-[11px] text-slate-400 block">Lembrete amigável / Primeiro contacto</span>
              </div>
              <strong className="text-amber-800 font-bold" data-tabular>
                {formatKwanza(totals.aging.aging0to15)}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-sans font-bold text-slate-800">16 a 30 Dias de Atraso</span>
                <span className="text-[11px] text-slate-400 block">Cobrança formal com alerta financeiro</span>
              </div>
              <strong className="text-amber-900 font-bold" data-tabular>
                {formatKwanza(totals.aging.aging16to30)}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-sans font-bold text-slate-800">31 a 60 Dias de Atraso</span>
                <span className="text-[11px] text-slate-400 block">Suspensão de crédito e reescalonamento</span>
              </div>
              <strong className="text-rose-700 font-bold" data-tabular>
                {formatKwanza(totals.aging.aging31to60)}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between">
              <div>
                <span className="font-sans font-bold text-rose-900">Mais de 60 Dias de Atraso</span>
                <span className="text-[11px] text-rose-600 block">Encaminhamento contencioso / Jurídico</span>
              </div>
              <strong className="text-rose-800 font-bold" data-tabular>
                {formatKwanza(totals.aging.aging60Plus)}
              </strong>
            </div>
          </div>
        </div>

        {/* Distribuição por Canais de Pagamento */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Canais e Métodos de Liquidação Mais Usados
            </h3>
            <p className="text-xs text-slate-500">
              Preferência de liquidação dos clientes no sistema bancário angolano
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-purple-50/40 border border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-700" />
                <span className="font-sans font-bold text-slate-800">Multicaixa Express</span>
              </div>
              <strong className="text-purple-900 font-bold" data-tabular>
                {formatKwanza(totals.methodTotals['multicaixa_express'] || 0)}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-sky-50/40 border border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-700" />
                <span className="font-sans font-bold text-slate-800">Transferência Bancária (IBAN)</span>
              </div>
              <strong className="text-sky-900 font-bold" data-tabular>
                {formatKwanza(totals.methodTotals['transferencia_bancaria'] || 0)}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-600" />
                <span className="font-sans font-bold text-slate-800">TPA / Multicaixa Balcão</span>
              </div>
              <strong className="text-slate-800 font-bold" data-tabular>
                {formatKwanza(totals.methodTotals['tpa'] || 0)}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                <span className="font-sans font-bold text-slate-800">Dinheiro Vivo / Numerário</span>
              </div>
              <strong className="text-slate-800 font-bold" data-tabular>
                {formatKwanza(totals.methodTotals['dinheiro'] || 0)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
