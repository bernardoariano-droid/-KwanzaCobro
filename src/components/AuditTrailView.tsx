import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  UserCheck, 
  CheckCircle2, 
  CreditCard, 
  Clock, 
  ShieldCheck,
  FileText,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { Debt, Client, AuthUser } from '../types/debt';
import { formatKwanza, formatDate } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface AuditTrailViewProps {
  debts: Debt[];
  clients: Client[];
  currentUser?: AuthUser | null;
  onViewDebtDetail: (debt: Debt) => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  debts,
  clients,
  currentUser,
  onViewDebtDetail,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('all');

  const isSeller = currentUser?.role === 'vendedor';

  const effectiveDebts = useMemo(() => {
    if (isSeller && currentUser) {
      return debts.filter(d => d.sellerId === currentUser.id || d.sellerId === currentUser.name);
    }
    return debts;
  }, [debts, isSeller, currentUser]);

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  // Flatten all audit entries from all effective debts
  const allAuditEntries = useMemo(() => {
    const list: Array<{
      id: string;
      debt: Debt;
      client?: Client;
      timestamp: string;
      action: string;
      performedBy: string;
      details: string;
    }> = [];

    effectiveDebts.forEach(debt => {
      const client = getClient(debt.clientId);

      // Audit trail entries explicitly recorded in debt
      if (debt.auditTrail && debt.auditTrail.length > 0) {
        debt.auditTrail.forEach((entry, idx) => {
          list.push({
            id: `${debt.id}-aud-${idx}`,
            debt,
            client,
            timestamp: entry.timestamp,
            action: entry.action,
            performedBy: entry.performedBy,
            details: entry.details,
          });
        });
      }

      // Synthesize origin event if not explicitly in trail
      list.push({
        id: `${debt.id}-created`,
        debt,
        client,
        timestamp: debt.createdAt || debt.issueDate,
        action: 'Registo de Compra a Crédito',
        performedBy: debt.customerName ? `Venda Faturada (${debt.invoiceNumber})` : 'Sistema',
        details: `Emissão de fatura a crédito no valor de ${formatKwanza(debt.totalAmount)} com limite de pagamento a ${formatDate(debt.dueDate)}.`,
      });

      // Payments as audit events
      debt.payments.forEach(p => {
        list.push({
          id: `${debt.id}-pay-${p.id}`,
          debt,
          client,
          timestamp: p.date,
          action: 'Amortização de Dívida Confirmada',
          performedBy: p.receivedBy,
          details: `Pagamento recebido de ${formatKwanza(p.amount)} via ${p.paymentMethod.replace('_', ' ')} (Ref: ${p.receiptRef}).`,
        });
      });
    });

    // Deduplicate and sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [effectiveDebts, clients]);

  // Unique operators for dropdown filter
  const operators = useMemo(() => {
    const set = new Set<string>();
    allAuditEntries.forEach(e => {
      if (e.performedBy) set.add(e.performedBy);
    });
    return Array.from(set);
  }, [allAuditEntries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return allAuditEntries.filter(entry => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        entry.debt.invoiceNumber.toLowerCase().includes(q) ||
        (entry.client?.name || entry.debt.customerName || '').toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.performedBy.toLowerCase().includes(q);

      const matchesOperator = operatorFilter === 'all' || entry.performedBy === operatorFilter;

      return matchesSearch && matchesOperator;
    });
  }, [allAuditEntries, searchQuery, operatorFilter]);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 1. Header do Histórico de Operações */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {t('audit.title', 'Histórico de Operações')}
              </h1>
              <p className="text-xs text-slate-500">
                {t('audit.subtitle', 'Rastreabilidade de todas as ações no sistema.')}
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-500">
          <span className="px-3 py-1.5 bg-slate-100 rounded-xl">
            {allAuditEntries.length} {t('nav.audit', 'Operações')}
          </span>
        </div>
      </div>

      {/* 2. Filtros e Pesquisa */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder={t('common.search', 'Pesquisar por ação, cliente, fatura ou operador...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={operatorFilter}
            onChange={e => setOperatorFilter(e.target.value)}
            className="py-1.5 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">{t('common.all', 'Todos os Operadores / Vendedores')} ({operators.length})</option>
            {operators.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Timeline de Auditoria */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <History className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">Nenhum registo encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Não foram localizadas operações correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map(entry => (
              <div 
                key={entry.id}
                className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {entry.action}
                    </span>
                    <button
                      onClick={() => onViewDebtDetail(entry.debt)}
                      className="font-mono text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer"
                    >
                      {entry.debt.invoiceNumber}
                    </button>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-sans">
                    {entry.details}
                  </p>
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <span>Cliente: {entry.client?.name || entry.debt.customerName}</span>
                    <span aria-hidden="true">·</span>
                    <span>Destino: {entry.debt.customerPhone || entry.client?.phone}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono text-[11px] space-y-0.5">
                  <div className="flex items-center md:justify-end gap-1.5 text-slate-700 font-semibold font-sans">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{entry.performedBy}</span>
                  </div>
                  <span className="text-slate-400 block">
                    {formatDate(entry.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
