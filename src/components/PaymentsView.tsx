import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  Search, 
  Calendar, 
  FileText, 
  MessageSquare, 
  CheckCircle2, 
  UserCheck,
  Building2,
  Receipt
} from 'lucide-react';
import { Debt, Client, Payment, PaymentMethod, AuthUser, CompanySettings } from '../types/debt';
import { formatKwanza, formatDate } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface PaymentsViewProps {
  debts: Debt[];
  clients: Client[];
  currentUser?: AuthUser | null;
  company: CompanySettings;
  onOpenPayment: (debt: Debt) => void;
  onOpenWhatsApp: (debt: Debt) => void;
  onViewDebtDetail: (debt: Debt) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  debts,
  clients,
  currentUser,
  company,
  onOpenPayment,
  onOpenWhatsApp,
  onViewDebtDetail,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const isSeller = currentUser?.role === 'vendedor';

  // Filtragem de dívidas do vendedor ou todas para administrador
  const effectiveDebts = useMemo(() => {
    if (isSeller && currentUser) {
      return debts.filter(
        d =>
          d.sellerId === currentUser.id ||
          (currentUser.sellerId && d.sellerId === currentUser.sellerId) ||
          d.sellerId === currentUser.name
      );
    }
    return debts;
  }, [debts, isSeller, currentUser]);

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  // Flatten all payments with their associated debt and client
  const allPayments = useMemo(() => {
    const list: Array<{
      payment: Payment;
      debt: Debt;
      client?: Client;
    }> = [];

    effectiveDebts.forEach(debt => {
      const client = getClient(debt.clientId);
      debt.payments.forEach(payment => {
        list.push({
          payment,
          debt,
          client,
        });
      });
    });

    // Sort by date descending (most recent first)
    return list.sort((a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime());
  }, [effectiveDebts, clients]);

  // Financial aggregates
  const totalAmountReceived = useMemo(() => {
    return allPayments.reduce((sum, item) => sum + item.payment.amount, 0);
  }, [allPayments]);

  const methodBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    allPayments.forEach(item => {
      const m = item.payment.paymentMethod;
      counts[m] = (counts[m] || 0) + item.payment.amount;
    });
    return counts;
  }, [allPayments]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return allPayments.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchText = 
        item.payment.receiptRef.toLowerCase().includes(q) ||
        item.debt.invoiceNumber.toLowerCase().includes(q) ||
        (item.client?.name && item.client.name.toLowerCase().includes(q)) ||
        (item.debt.customerName && item.debt.customerName.toLowerCase().includes(q)) ||
        (item.payment.receivedBy && item.payment.receivedBy.toLowerCase().includes(q));

      if (q && !matchText) return false;

      if (methodFilter !== 'all') {
        const methodStr = String(item.payment.paymentMethod);
        if (methodFilter === 'transferencia_bancaria') {
          if (methodStr !== 'transferencia_bancaria' && methodStr !== 'transferencia') {
            return false;
          }
        } else if (methodStr !== methodFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allPayments, searchQuery, methodFilter]);

  const getMethodLabel = (method: PaymentMethod | string) => {
    switch (method) {
      case 'multicaixa_express':
        return t('payments.method_mcx', 'Multicaixa Express');
      case 'transferencia':
      case 'transferencia_bancaria':
        return t('payments.method_transfer', 'Transferência Bancária');
      case 'tpa':
        return t('payments.method_tpa', 'TPA (Multicaixa)');
      case 'dinheiro':
        return t('payments.method_cash', 'Dinheiro em Mão');
      case 'deposito':
        return t('payments.method_deposit', 'Depósito Bancário');
      default:
        return method;
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-12 max-w-full overflow-x-hidden">
      {/* 1. Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t('payments.title', 'Registo de Pagamentos e Amortizações')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t('payments.subtitle', 'Diminuição imediata da dívida no controlo do vendedor.')}
          </p>
        </div>
      </div>

      {/* 2. Resumo de Recebimentos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{t('dashboard.total_payments', 'Total Recebido')}</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 font-mono tracking-tight" data-tabular>
            {formatKwanza(totalAmountReceived)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {allPayments.length} amortizações registadas
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Multicaixa Express (MCX)</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(methodBreakdown['multicaixa_express'] || 0)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Canal móvel direto em Angola
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Transferências IBAN</span>
            <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight" data-tabular>
            {formatKwanza(methodBreakdown['transferencia'] || methodBreakdown['transferencia_bancaria'] || 0)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Liquidações via bancos angolanos
          </div>
        </div>
      </div>

      {/* 3. Filtros e Pesquisa */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder={t('common.search', 'Pesquisar por comprovativo, fatura, cliente...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="py-1.5 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">{t('common.all', 'Todos os Métodos')}</option>
            <option value="multicaixa_express">{t('payments.method_mcx', 'Multicaixa Express')}</option>
            <option value="transferencia_bancaria">{t('payments.method_transfer', 'Transferência Bancária')}</option>
            <option value="tpa">{t('payments.method_tpa', 'TPA / Multicaixa')}</option>
            <option value="dinheiro">{t('payments.method_cash', 'Dinheiro Vivo')}</option>
            <option value="deposito">{t('payments.method_deposit', 'Depósito Bancário')}</option>
          </select>
        </div>
      </div>

      {/* 4. Lista de Pagamentos */}
      {filteredPayments.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-xs">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Nenhum pagamento encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não foram encontradas amortizações para os critérios de pesquisa selecionados.
          </p>
        </div>
      ) : (
        <>
          {/* MODO MOBILE / ANDROID FIRST (block md:hidden): CARDS SEM BARRA HORIZONTAL */}
          <div className="block md:hidden space-y-3">
            {filteredPayments.map(({ payment, debt, client }) => (
              <div 
                key={payment.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {payment.receiptRef}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {formatDate(payment.date)}
                  </span>
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">
                      {client?.name || debt.customerName || 'Cliente'}
                    </div>
                    <div className="text-xs text-emerald-700 font-mono mt-0.5">
                      Fatura: {debt.invoiceNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Amortizado</div>
                    <div className="font-mono font-black text-emerald-700 text-sm" data-tabular>
                      {formatKwanza(payment.amount)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>{getMethodLabel(payment.paymentMethod)}</span>
                  <span className="text-[11px] text-slate-500">Por: {payment.receivedBy || 'Operador'}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => onViewDebtDetail(debt)}
                    className="py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer min-h-[40px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Detalhes</span>
                  </button>

                  <button
                    onClick={() => onOpenWhatsApp(debt)}
                    className="py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer min-h-[40px]"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* MODO DESKTOP (hidden md:block) */}
          <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">{t('payments.date', 'Data')}</th>
                    <th className="py-3 px-4">{t('payments.receipt_ref', 'Comprovativo / Ref.')}</th>
                    <th className="py-3 px-4">{t('debts.client', 'Cliente Devedor')}</th>
                    <th className="py-3 px-4">{t('debts.invoice', 'Fatura')}</th>
                    <th className="py-3 px-4">{t('payments.method', 'Método')}</th>
                    <th className="py-3 px-4">{t('payments.received_by', 'Confirmado Por')}</th>
                    <th className="py-3 px-4 text-right">Valor Amortizado</th>
                    <th className="py-3 px-4 text-center">{t('debts.actions', 'Ações')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map(({ payment, debt, client }) => (
                    <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                        {formatDate(payment.date)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {payment.receiptRef}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 truncate max-w-[200px]">
                          {client?.name || debt.customerName || 'Cliente'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {debt.customerPhone || client?.phone || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono font-medium text-emerald-700">
                        <button 
                          onClick={() => onViewDebtDetail(debt)}
                          className="hover:underline cursor-pointer"
                        >
                          {debt.invoiceNumber}
                        </button>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {getMethodLabel(payment.paymentMethod)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{payment.receivedBy || 'Operador'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-black text-emerald-700 text-sm" data-tabular>
                        {formatKwanza(payment.amount)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewDebtDetail(debt)}
                            title="Ver Fatura e Recibo"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenWhatsApp(debt)}
                            title="Enviar confirmação pelo WhatsApp"
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
