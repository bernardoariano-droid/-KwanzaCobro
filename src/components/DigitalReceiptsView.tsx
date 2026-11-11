import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Search, 
  Download, 
  Printer, 
  MessageSquare, 
  Eye, 
  CheckCircle2, 
  FileCheck, 
  KeyRound,
  FileDown
} from 'lucide-react';
import { Debt, Client, Seller, CompanySettings, AuthUser } from '../types/debt';
import { formatKwanza, formatDate, getRemainingBalance, getPaidAmount } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface DigitalReceiptsViewProps {
  debts: Debt[];
  clients: Client[];
  sellers: Seller[];
  company: CompanySettings;
  currentUser?: AuthUser | null;
  onPrintDebt: (debt: Debt) => void;
  onOpenWhatsApp: (debt: Debt) => void;
  onViewDebtDetail: (debt: Debt) => void;
  onDownloadPDF: (debt: Debt) => void;
}

export const DigitalReceiptsView: React.FC<DigitalReceiptsViewProps> = ({
  debts,
  clients,
  sellers,
  company,
  currentUser,
  onPrintDebt,
  onOpenWhatsApp,
  onViewDebtDetail,
  onDownloadPDF,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'settled' | 'partial' | 'pending'>('all');

  const isSeller = currentUser?.role === 'vendedor';

  const effectiveDebts = useMemo(() => {
    if (isSeller && currentUser) {
      return debts.filter(d => d.sellerId === currentUser.id || d.sellerId === currentUser.name);
    }
    return debts;
  }, [debts, isSeller, currentUser]);

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  const filteredDebts = useMemo(() => {
    return effectiveDebts.filter(d => {
      const q = searchQuery.toLowerCase().trim();
      const client = getClient(d.clientId);
      const remaining = getRemainingBalance(d);
      const paid = getPaidAmount(d);

      const matchesSearch = 
        !q ||
        d.invoiceNumber.toLowerCase().includes(q) ||
        (d.customerName || client?.name || '').toLowerCase().includes(q) ||
        (d.customerPhone || client?.phone || '').includes(q) ||
        (d.confirmationCode || '').includes(q) ||
        (d.confirmationTransactionId || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterType === 'settled') return remaining <= 0;
      if (filterType === 'partial') return paid > 0 && remaining > 0;
      if (filterType === 'pending') return paid === 0 && remaining > 0;

      return true;
    });
  }, [effectiveDebts, searchQuery, filterType, clients]);

  const totalSettledCount = useMemo(() => {
    return effectiveDebts.filter(d => getRemainingBalance(d) <= 0).length;
  }, [effectiveDebts]);

  const totalPartialCount = useMemo(() => {
    return effectiveDebts.filter(d => {
      const paid = getPaidAmount(d);
      const rem = getRemainingBalance(d);
      return paid > 0 && rem > 0;
    }).length;
  }, [effectiveDebts]);

  return (
    <div className="space-y-6 pb-20 lg:pb-12 max-w-full overflow-x-hidden animate-fade-in">
      {/* 1. Header com Estilo Dashboard (Azul Institucional) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t('receipts.title', 'Recibos Digitais & Comprovativos')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t('receipts.subtitle', 'Comprovativos gerados e verificação de autenticidade.')}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
          <span className="px-3 py-1.5 bg-slate-100 rounded-xl font-semibold">
            {effectiveDebts.length} {t('common.all', 'emitidos')}
          </span>
        </div>
      </div>

      {/* 2. 3 Cards de Resumo no Estilo Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Comprovativos</span>
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {effectiveDebts.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Faturas e guias registadas
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Quitações Totais</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 font-mono tracking-tight" data-tabular>
            {totalSettledCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            100% liquidadas e arquivadas
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Com Amortização Parcial</span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900 font-mono tracking-tight" data-tabular>
            {totalPartialCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Comprovativos parciais activos
          </div>
        </div>
      </div>

      {/* 3. Filtros e Pesquisa */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder={t('common.search', 'Pesquisar por fatura, código SMS, cliente...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('common.all', 'Todos')} ({effectiveDebts.length})
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'settled'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('common.paid', 'Liquidados')}
          </button>
          <button
            onClick={() => setFilterType('partial')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'partial'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Amortizados
          </button>
          <button
            onClick={() => setFilterType('pending')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'pending'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('common.pending', 'Pendentes')}
          </button>
        </div>
      </div>

      {/* 4. Lista de Recibos */}
      {filteredDebts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-xs">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">{t('debts.empty_title', 'Nenhum recibo encontrado')}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('debts.empty_desc', 'Não foram localizados comprovativos para os termos pesquisados.')}
          </p>
        </div>
      ) : (
        <>
          {/* MODO MOBILE / ANDROID FIRST (block md:hidden): CARDS SEM BARRA HORIZONTAL */}
          <div className="block md:hidden space-y-3.5">
            {filteredDebts.map(debt => {
              const client = getClient(debt.clientId);
              const remaining = getRemainingBalance(debt);
              const isSettled = remaining <= 0;

              return (
                <div 
                  key={debt.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-mono font-bold text-xs text-blue-900">
                        {debt.invoiceNumber}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {formatDate(debt.issueDate)}
                      </div>
                    </div>
                    {isSettled ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                        {t('common.paid', 'Liquidado')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded">
                        {t('common.open', 'Saldo Pendente')}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {debt.customerName || client?.name || 'Cliente'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {debt.customerPhone || client?.phone || '-'}
                      </div>
                    </div>
                    {debt.confirmationCode && (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block font-mono">SMS Cód:</span>
                        <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-xs">
                          {debt.confirmationCode}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-500">{t('debts.total', 'Valor Total')}</div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5" data-tabular>
                        {formatKwanza(debt.totalAmount)}
                      </div>
                    </div>
                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                      <div className="text-[10px] text-blue-800 font-medium">{t('debts.balance', 'Saldo')}</div>
                      <div className={`font-mono font-black mt-0.5 ${isSettled ? 'text-emerald-700' : 'text-blue-900'}`} data-tabular>
                        {formatKwanza(remaining)}
                      </div>
                    </div>
                  </div>

                  {/* Ações Mobile */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => onDownloadPDF(debt)}
                      className="py-2 px-2 text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[40px] cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-blue-700" />
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={() => onPrintDebt(debt)}
                      className="py-2 px-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[40px] cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t('common.print', 'Imprimir')}</span>
                    </button>

                    <button
                      onClick={() => onOpenWhatsApp(debt)}
                      className="py-2 px-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[40px] cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MODO DESKTOP (hidden md:block) */}
          <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">{t('debts.invoice', 'Documento / Fatura')}</th>
                    <th className="py-3 px-4">Código no Recibo & SMS</th>
                    <th className="py-3 px-4">{t('debts.client', 'Cliente Devedor')}</th>
                    <th className="py-3 px-4">{t('debts.issue_date', 'Data Emissão')}</th>
                    <th className="py-3 px-4 text-right">{t('debts.total', 'Valor Total')}</th>
                    <th className="py-3 px-4 text-right">{t('debts.balance', 'Saldo')}</th>
                    <th className="py-3 px-4 text-center">{t('debts.status', 'Estado')}</th>
                    <th className="py-3 px-4 text-center">{t('debts.actions', 'Ações')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDebts.map(debt => {
                    const client = getClient(debt.clientId);
                    const remaining = getRemainingBalance(debt);
                    const paid = getPaidAmount(debt);
                    const isSettled = remaining <= 0;

                    return (
                      <tr key={debt.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            onClick={() => onViewDebtDetail(debt)}
                            className="font-mono font-bold text-slate-900 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            {debt.invoiceNumber}
                          </button>
                          <div className="text-[11px] text-slate-500">
                            {debt.items.length} {debt.items.length === 1 ? 'artigo' : 'artigos'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {debt.confirmationCode ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="font-bold text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded text-[11px]">
                                {debt.confirmationCode}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Sem código
                            </span>
                          )}
                          {debt.confirmationTransactionId && (
                            <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                              ID: {debt.confirmationTransactionId.slice(-8)}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 truncate max-w-[200px]">
                            {debt.customerName || client?.name || 'Cliente'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {debt.customerPhone || client?.phone || '-'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600">
                          {formatDate(debt.issueDate)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-slate-900" data-tabular>
                          {formatKwanza(debt.totalAmount)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold" data-tabular>
                          <span className={isSettled ? 'text-emerald-700 font-black' : 'text-slate-800'}>
                            {formatKwanza(remaining)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          {isSettled ? (
                            <span className="inline-block px-2 py-0.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                              {t('common.paid', '100% Liquidado')}
                            </span>
                          ) : paid > 0 ? (
                            <span className="inline-block px-2 py-0.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-md">
                              Amortizado ({Math.round((paid / debt.totalAmount) * 100)}%)
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                              {t('common.pending', 'Aguardando Pagamento')}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onDownloadPDF(debt)}
                              title={t('common.download_pdf', 'Descarregar PDF')}
                              className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onPrintDebt(debt)}
                              title={t('common.print', 'Imprimir')}
                              className="p-1.5 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onOpenWhatsApp(debt)}
                              title={t('common.whatsapp', 'Enviar WhatsApp')}
                              className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onViewDebtDetail(debt)}
                              title={t('debts.btn_details', 'Ver Detalhes')}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
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
