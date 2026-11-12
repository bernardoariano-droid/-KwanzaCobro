import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  MessageSquare, 
  Phone, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  Calendar, 
  Clock, 
  Send 
} from 'lucide-react';
import { Debt, Client, CompanySettings } from '../types/debt';
import { 
  formatKwanza, 
  formatDate, 
  getRemainingBalance, 
  getDaysDiff, 
  generateWhatsAppMessage, 
  generateSMSMessage, 
  getWhatsAppUrl 
} from '../utils/formatters';

interface AutoReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
  clients: Client[];
  company: CompanySettings;
  onMarkAsSent: (debtId: string) => void;
  onMarkAllAsSent: (debtIds: string[]) => void;
}

export const AutoReminderModal: React.FC<AutoReminderModalProps> = ({
  isOpen,
  onClose,
  debts,
  clients,
  company,
  onMarkAsSent,
  onMarkAllAsSent,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtrar apenas dívidas a vencer em até 5 dias e com saldo devedor
  const debtsToRemind = debts.filter(d => {
    const rem = getRemainingBalance(d);
    if (rem <= 0) return false;
    const diff = getDaysDiff(d.dueDate);
    // diff <= 0 (ainda não venceu) e dentro de 5 dias
    return diff <= 0 && Math.abs(diff) <= (company.daysBeforeDueAlert || 5) && Math.abs(diff) > 0;
  });

  const getClientData = (debt: Debt) => {
    const c = clients.find(cl => cl.id === debt.clientId);
    return {
      name: debt.customerName || c?.name || 'Cliente',
      phone: debt.customerPhone || c?.phone || '',
    };
  };

  const handleCopySMS = (debt: Debt) => {
    const diff = Math.abs(getDaysDiff(debt.dueDate));
    const sms = generateSMSMessage(debt, company, diff);
    navigator.clipboard.writeText(sms);
    setCopiedId(debt.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendWhatsApp = (debt: Debt) => {
    const clientData = getClientData(debt);
    const text = generateWhatsAppMessage('lembrete_5_dias', debt, clientData, company);
    const url = getWhatsAppUrl(clientData.phone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
    onMarkAsSent(debt.id);
  };

  const handleSendAllPending = () => {
    const pending = debtsToRemind.filter(d => !d.reminder5DaysSent);
    if (pending.length === 0) return;

    // Disparar o primeiro e marcar todos
    const first = pending[0];
    handleSendWhatsApp(first);
    onMarkAllAsSent(pending.map(d => d.id));
  };

  const pendingCount = debtsToRemind.filter(d => !d.reminder5DaysSent).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-indigo-950 text-white flex items-center justify-between border-b border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-200 shadow-xs">
              <Bell className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                Automação de Lembretes: Faltam 5 Dias para o Prazo
              </h2>
              <p className="text-xs text-emerald-200">
                Disparo preventivo de avisos para evitar inadimplência no comércio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Caixa de Explicação */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm block mb-0.5">
                {debtsToRemind.length} {debtsToRemind.length === 1 ? 'cliente com prazo a expirar em 5 dias' : 'clientes com prazo a expirar em 5 dias'}
              </span>
              <p className="text-amber-800">
                O envio do aviso preventivo aos 5 dias reduz em mais de 70% o risco de atraso no comércio angolano.
              </p>
            </div>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleSendAllPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Disparar WhatsApp ({pendingCount})</span>
              </button>
            )}
          </div>

          {/* Lista de Devedores a 5 Dias */}
          {debtsToRemind.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Tudo em ordem!</p>
              <p className="text-slate-500 mt-1">
                Não existem clientes com prazos a expirar nos próximos 5 dias neste momento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {debtsToRemind.map(debt => {
                const clientData = getClientData(debt);
                const remaining = getRemainingBalance(debt);
                const daysDiff = Math.abs(getDaysDiff(debt.dueDate));
                const isSent = debt.reminder5DaysSent;

                return (
                  <div
                    key={debt.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSent
                        ? 'bg-slate-50 border-slate-200 opacity-90'
                        : 'bg-white border-amber-200 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {clientData.name}
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            ⏰ Restam {daysDiff} {daysDiff === 1 ? 'dia' : 'dias'}
                          </span>
                          {isSent && (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              <Check className="w-3 h-3" />
                              Já Notificado
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2 font-mono">
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {clientData.phone || 'Sem telefone'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Fatura: {debt.invoiceNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span>Prazo Final: {formatDate(debt.dueDate)}</span>
                        </div>
                      </div>

                      <div className="text-right sm:self-center">
                        <span className="text-[11px] text-slate-500 block">Quantidade a Pagar</span>
                        <span className="text-base font-extrabold text-slate-900 font-mono" data-tabular>
                          {formatKwanza(remaining)}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Envio WhatsApp / SMS */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500">
                        {isSent ? (
                          <span>Aviso enviado em {debt.reminder5DaysSentAt || 'data recente'}</span>
                        ) : (
                          <span className="text-amber-800 font-medium">Aguardando envio do aviso de 5 dias</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botão Copiar SMS */}
                        <button
                          type="button"
                          onClick={() => handleCopySMS(debt)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          {copiedId === debt.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">SMS Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copiar SMS</span>
                            </>
                          )}
                        </button>

                        {/* Botão WhatsApp Direto */}
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(debt)}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{isSent ? 'Reenviar no WhatsApp' : 'Enviar no WhatsApp'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-end pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
