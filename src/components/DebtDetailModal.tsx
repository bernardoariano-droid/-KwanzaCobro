import React, { useState } from 'react';
import { 
  X, 
  Receipt, 
  Calendar, 
  User, 
  CreditCard, 
  MessageSquare, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Edit3,
  Check,
  Download
} from 'lucide-react';
import { Debt, Client, Seller, CompanySettings } from '../types/debt';
import { downloadDebtReceiptPDF } from '../utils/pdfGenerator';
import { 
  formatKwanza, 
  formatDate, 
  getRemainingBalance, 
  getPaidAmount, 
  getPaidPercentage, 
  getEffectiveStatus, 
  getDaysDiff 
} from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface DebtDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  client: Client | null;
  seller: Seller | null;
  company: CompanySettings;
  onOpenPayment: (debt: Debt) => void;
  onOpenWhatsApp: (debt: Debt) => void;
  onPrintDebt: (debt: Debt) => void;
  onUpdateDueDate: (debtId: string, newDueDate: string, reason: string) => void;
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  isOpen,
  onClose,
  debt,
  client,
  seller,
  company,
  onOpenPayment,
  onOpenWhatsApp,
  onPrintDebt,
  onUpdateDueDate,
}) => {
  if (!isOpen || !debt) return null;

  const { t } = useLanguage();
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState(debt.dueDate);
  const [rescheduleReason, setRescheduleReason] = useState('');

  const remaining = getRemainingBalance(debt);
  const paid = getPaidAmount(debt);
  const percentage = getPaidPercentage(debt);
  const effStatus = getEffectiveStatus(debt);
  const daysDiff = getDaysDiff(debt.dueDate);

  const handleSaveReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDate) return;
    onUpdateDueDate(debt.id, newDueDate, rescheduleReason);
    setIsEditingDueDate(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-950 text-white flex items-center justify-between border-b border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="h-10 px-2 py-0.5 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <img 
                src={company.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                alt="KwanzaCobro" 
                className="h-8 w-auto max-w-[120px] object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono">{debt.invoiceNumber}</h2>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${effStatus.badgeClass}`}>
                  {effStatus.label}
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                {company.name || 'KwanzaCobro'} · {t('debts.issue_date', 'Emitido em')} {formatDate(debt.issueDate)}
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

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Card Resumo Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs text-slate-500 font-medium">Valor Total da Venda</span>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5" data-tabular>
                {formatKwanza(debt.totalAmount)}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium">Total Já Amortizado</span>
              <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5" data-tabular>
                {formatKwanza(paid)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                {percentage}% do valor recuperado
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-rose-800">Saldo Restante a Cobrar</span>
              <div className="text-lg font-extrabold font-mono text-rose-800 mt-0.5" data-tabular>
                {formatKwanza(remaining)}
              </div>
              <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
                {remaining <= 0 ? 'Liquidado na totalidade' : 'Pendente de liquidação'}
              </div>
            </div>
          </div>

          {/* Seção Data Limite de Pagamento com opção de Reescalonamento */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-900">
                    Data Limite de Pagamento:
                  </span>
                  <span className="text-sm font-extrabold font-mono text-slate-900">
                    {formatDate(debt.dueDate)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {remaining <= 0 ? (
                    <span className="text-emerald-700 font-medium">Pagamento concluído dentro das normas.</span>
                  ) : daysDiff > 0 ? (
                    <span className="text-rose-700 font-bold">
                      Atenção: A data limite expirou há {daysDiff} {daysDiff === 1 ? 'dia' : 'dias'}. Cobrança urgente necessária.
                    </span>
                  ) : daysDiff === 0 ? (
                    <span className="text-amber-800 font-bold">O prazo limite de pagamento vence HOJE.</span>
                  ) : (
                    <span className="text-slate-700">
                      Restam {Math.abs(daysDiff)} {Math.abs(daysDiff) === 1 ? 'dia' : 'dias'} para a data limite contratual.
                    </span>
                  )}
                </div>
              </div>

              {!isEditingDueDate && remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setIsEditingDueDate(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Reescalonar Prazo</span>
                </button>
              )}
            </div>

            {/* Formulário de Reescalonamento de Prazo */}
            {isEditingDueDate && (
              <form onSubmit={handleSaveReschedule} className="mt-4 pt-3 border-t border-amber-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nova Data Limite de Pagamento <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newDueDate}
                      onChange={e => setNewDueDate(e.target.value)}
                      className="w-full py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Motivo / Acordo de Prorrogação
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Acordo bilateral com vendedor por atraso de colheita/obras"
                      value={rescheduleReason}
                      onChange={e => setRescheduleReason(e.target.value)}
                      className="w-full py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingDueDate(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors"
                  >
                    Confirmar Nova Data Limite
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Dados do Cliente e Vendedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Dados do Cliente
              </span>
              <div className="text-xs space-y-1">
                <div className="font-semibold text-slate-900 text-sm">{debt.customerName || client?.name || '-'}</div>
                <div className="text-slate-600 font-mono">NIF: {client?.nif || 'Consumidor Final'}</div>
                <div className="text-emerald-700 font-mono font-bold flex items-center gap-1">
                  <span>📱 WhatsApp: {debt.customerPhone || client?.phone || '-'}</span>
                </div>
                <div className="text-slate-500">{client?.address || ''} {client?.province ? `· ${client.province}` : ''}</div>
                
                {/* Status do Aviso dos 5 Dias */}
                <div className="pt-2 border-t border-slate-100 text-[11px]">
                  {debt.reminder5DaysSent ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Aviso prévio dos 5 dias enviado ({debt.reminder5DaysSentAt || 'registado'})
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium">
                      ⏰ Aviso de 5 dias: {debt.autoReminderEnabled !== false ? 'Ativo no sistema' : 'Desativado'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Vendedor & Garantia */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                Vendedor & Garantia
              </span>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Vendedor: </span>
                  <strong className="text-slate-900">{seller?.name || '-'}</strong>
                </div>
                <div className="text-slate-600">Filial: {seller?.branch || '-'}</div>
                <div>
                  <span className="text-slate-500">Garantia: </span>
                  <span className="text-slate-800 font-medium">{debt.guaranteeType || 'Acordo Verbal'}</span>
                </div>
                {debt.guarantorName && (
                  <div className="text-slate-600">
                    Fiador: {debt.guarantorName} ({debt.guarantorPhone || ''})
                  </div>
                )}
                {debt.terms && (
                  <div className="text-slate-500 italic mt-1 border-t border-slate-100 pt-1">
                    "{debt.terms}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NEUROJUS Validação Digital SMS se existir */}
          {debt.confirmationTransactionId && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>NEUROJUS · Transação {debt.confirmationTransactionId}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                      Confirmada por SMS
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Modalidade: {debt.confirmationMode === 'assistida' ? 'Introdução Assistida pelo Funcionário' : 'Introdução Pessoal pelo Cliente'} · Contacto: {debt.smsMaskedPhone || debt.customerPhone}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadDebtReceiptPDF(debt, client, seller, company)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" />
                <span>PDF com QR Code</span>
              </button>
            </div>
          )}

          {/* Tabela de Artigos Vendidos */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 mb-2">
              Artigos / Mercadorias Fornecidas a Crédito
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3 text-center w-24">Qtd</th>
                    <th className="py-2.5 px-3 text-right w-36">Preço Unitário</th>
                    <th className="py-2.5 px-3 text-right w-36">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debt.items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono" data-tabular>{formatKwanza(item.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900" data-tabular>
                        {formatKwanza(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico de Amortizações e Pagamentos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>Histórico de Amortizações / Pagamentos Recebidos</span>
                <span className="text-slate-400 font-normal">({debt.payments.length})</span>
              </h3>
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenPayment(debt)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  + Nova Amortização
                </button>
              )}
            </div>

            {debt.payments.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                Ainda não foram registadas amortizações para esta fatura.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Método</th>
                      <th className="py-2.5 px-3">Referência / Talão</th>
                      <th className="py-2.5 px-3">Recebido Por</th>
                      <th className="py-2.5 px-3 text-right">Valor Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debt.payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono">{formatDate(p.date)}</td>
                        <td className="py-2.5 px-3 font-medium capitalize text-slate-700">
                          {p.paymentMethod.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{p.receiptRef}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.receivedBy}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700" data-tabular>
                          {formatKwanza(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Botões do Rodapé */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadDebtReceiptPDF(debt, client, seller, company)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Descarregar Recibo PDF</span>
              </button>

              <button
                type="button"
                onClick={() => onPrintDebt(debt)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Imprimir A4</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenWhatsApp(debt)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Cobrar WhatsApp</span>
                </button>
              )}

              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenPayment(debt)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{t('payments.title', 'Registar Pagamento')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
