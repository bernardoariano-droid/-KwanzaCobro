import React, { useState, useMemo } from 'react';
import { 
  BellRing, 
  MessageSquare, 
  Smartphone, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Clock, 
  ShieldCheck, 
  Search,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  Filter
} from 'lucide-react';
import { Debt, Client, CompanySettings, AuthUser } from '../types/debt';
import { 
  formatKwanza, 
  formatDate, 
  getRemainingBalance, 
  getDaysDiff, 
  generateWhatsAppMessage, 
  getWhatsAppUrl, 
  WhatsAppMessageType,
  normalizeAngolaPhone
} from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface NotificationsViewProps {
  debts: Debt[];
  clients: Client[];
  company: CompanySettings;
  currentUser?: AuthUser | null;
  onOpen5DayReminders: () => void;
  onOpenWhatsApp: (debt: Debt) => void;
  onViewDebtDetail: (debt: Debt) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  debts,
  clients,
  company,
  currentUser,
  onOpen5DayReminders,
  onOpenWhatsApp,
  onViewDebtDetail,
}) => {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'5days' | 'overdue' | 'sms_log' | 'templates'>('5days');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppMessageType>('lembrete_5_dias');
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const isSeller = currentUser?.role === 'vendedor';

  const effectiveDebts = useMemo(() => {
    if (isSeller && currentUser) {
      return debts.filter(d => d.sellerId === currentUser.id || d.sellerId === currentUser.name);
    }
    return debts;
  }, [debts, isSeller, currentUser]);

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  // Debts due in next 5 days
  const debtsDue5Days = useMemo(() => {
    return effectiveDebts.filter(d => {
      const remaining = getRemainingBalance(d);
      if (remaining <= 0) return false;
      const diff = getDaysDiff(d.dueDate);
      return diff <= 0 && Math.abs(diff) <= (company.daysBeforeDueAlert || 5) && Math.abs(diff) > 0;
    });
  }, [effectiveDebts, company]);

  // Overdue debts
  const overdueDebts = useMemo(() => {
    return effectiveDebts.filter(d => {
      const remaining = getRemainingBalance(d);
      if (remaining <= 0) return false;
      return getDaysDiff(d.dueDate) > 0;
    }).sort((a, b) => getDaysDiff(b.dueDate) - getDaysDiff(a.dueDate));
  }, [effectiveDebts]);

  // Debts with SMS confirmation status
  const smsDebts = useMemo(() => {
    return effectiveDebts.filter(d => d.confirmationCode || d.confirmationTransactionId || d.smsStatus);
  }, [effectiveDebts]);

  const previewSampleText = useMemo(() => {
    const sampleDebt = effectiveDebts[0] || {
      id: 'demo-sample',
      invoiceNumber: 'FT 2026/0412',
      clientId: 'cli-sample',
      sellerId: 'sel-1',
      customerName: 'Manuel Sebastião',
      customerPhone: '+244 923 884 100',
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      totalAmount: 125000,
      items: [{ id: '1', description: 'Cimento Portland 42.5R', quantity: 25, unitPrice: 5000, total: 125000 }],
      status: 'aberta' as const,
      paymentMethodAgreed: 'multicaixa_express',
      payments: [],
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    return generateWhatsAppMessage(
      selectedTemplate, 
      sampleDebt, 
      { name: sampleDebt.customerName || 'Cliente Exemplo', phone: sampleDebt.customerPhone }, 
      company
    );
  }, [selectedTemplate, effectiveDebts, company]);

  const handleCopySample = () => {
    navigator.clipboard.writeText(previewSampleText);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 1. Header do Módulo de Notificações */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {t('notifications.title', 'Notificações SMS & Lembretes')}
              </h1>
              <p className="text-xs text-slate-500">
                {t('notifications.subtitle', 'Histórico de envios de confirmação e avisos preventivos.')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {debtsDue5Days.length > 0 && (
            <button
              onClick={onOpen5DayReminders}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <BellRing className="w-4 h-4 text-amber-200" />
              <span>Disparar Alertas 5 Dias ({debtsDue5Days.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('5days')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === '5days'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Faltam 5 Dias ({debtsDue5Days.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('overdue')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'overdue'
              ? 'bg-white text-rose-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Vencidas / Em Cobrança ({overdueDebts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sms_log')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'sms_log'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Histórico SMS ({smsDebts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'templates'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>Modelos de Mensagem</span>
        </button>
      </div>

      {/* 3. Conteúdo por Sub-Tab */}
      {activeSubTab === '5days' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Faturas com Prazo a Expirar nos Próximos 5 Dias
              </h2>
              <p className="text-xs text-slate-500">
                Avisos amigáveis para evitar que as contas entrem em incumprimento ou juros
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
              {debtsDue5Days.length} faturas a monitorar
            </span>
          </div>

          {debtsDue5Days.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Tudo em ordem!</h3>
              <p className="text-xs text-slate-500">
                Nenhum cliente possui compras a crédito a vencer nos próximos 5 dias.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {debtsDue5Days.map(debt => {
                const client = getClient(debt.clientId);
                const remaining = getRemainingBalance(debt);
                const diff = getDaysDiff(debt.dueDate);

                return (
                  <div key={debt.id} className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {debt.customerName || client?.name}
                        </span>
                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-900 rounded font-mono">
                          Faltam {Math.abs(diff)} dias
                        </span>
                      </div>
                      <div className="text-slate-500 font-mono mt-1 flex items-center gap-2">
                        <span>{debt.invoiceNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>Limite: {formatDate(debt.dueDate)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700">{debt.customerPhone || client?.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm" data-tabular>
                          {formatKwanza(remaining)}
                        </div>
                        <span className="text-[10px] text-slate-400">Saldo a liquidar</span>
                      </div>

                      <button
                        onClick={() => onOpenWhatsApp(debt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Avisar WhatsApp</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'overdue' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-rose-900">
                Faturas Vencidas em Atraso (Cobrança Ativa)
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento com avisos de cobrança urgente e renegociação amigável
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
              {overdueDebts.length} faturas vencidas
            </span>
          </div>

          {overdueDebts.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Nenhuma dívida vencida!</h3>
              <p className="text-xs text-slate-500">
                Todos os clientes estão com pagamentos em dia ou dentro do prazo concedido.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdueDebts.map(debt => {
                const client = getClient(debt.clientId);
                const remaining = getRemainingBalance(debt);
                const daysOverdue = getDaysDiff(debt.dueDate);

                return (
                  <div key={debt.id} className="p-4 hover:bg-rose-50/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {debt.customerName || client?.name}
                        </span>
                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-rose-100 text-rose-900 rounded font-mono">
                          {daysOverdue} dias de atraso
                        </span>
                      </div>
                      <div className="text-slate-500 font-mono mt-1 flex items-center gap-2">
                        <span>{debt.invoiceNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-700 font-semibold">Expirou a {formatDate(debt.dueDate)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{debt.customerPhone || client?.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono font-bold text-rose-700 text-sm" data-tabular>
                          {formatKwanza(remaining)}
                        </div>
                        <span className="text-[10px] text-slate-400">Em dívida</span>
                      </div>

                      <button
                        onClick={() => onOpenWhatsApp(debt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Cobrar Urgente</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'sms_log' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Registo de Códigos e Confirmações SMS
            </h2>
            <p className="text-xs text-slate-500">
              Códigos de 6 dígitos gerados para o recibo físico e enviados por SMS / WhatsApp
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {smsDebts.map(debt => {
              const client = getClient(debt.clientId);
              return (
                <div key={debt.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{debt.invoiceNumber}</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-semibold text-slate-800">{debt.customerName || client?.name}</span>
                    </div>
                    <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                      Destino: {debt.customerPhone || client?.phone}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {debt.confirmationCode && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Código Oficial</span>
                        <strong className="font-mono text-sm text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
                          {debt.confirmationCode}
                        </strong>
                      </div>
                    )}
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ✓ Registado no Recibo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Escolher Modelo
            </h3>

            {[
              { id: 'comprovativo_credito', label: 'Comprovativo de Compra a Crédito' },
              { id: 'lembrete_5_dias', label: 'Lembrete Preventivo (5 Dias)' },
              { id: 'lembrete_preventivo', label: 'Lembrete Amigável Geral' },
              { id: 'vencimento_hoje', label: 'Vencimento Hoje' },
              { id: 'cobranca_atraso', label: 'Cobrança por Atraso' },
              { id: 'aviso_urgente', label: 'Notificação Urgente' },
              { id: 'recibo_pagamento', label: 'Recibo de Pagamento / Quitação' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedTemplate(item.id as WhatsAppMessageType)}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedTemplate === item.id
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pré-visualização do Modelo WhatsApp
                </h3>
                <p className="text-xs text-slate-500">
                  Formatação automática adaptada à moeda Kwanza (Kz) e coordenadas bancárias
                </p>
              </div>

              <button
                onClick={handleCopySample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTemplate ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed max-h-96 overflow-y-auto select-all">
              {previewSampleText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
