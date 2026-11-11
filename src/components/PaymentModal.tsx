import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  CheckCircle2, 
  Receipt, 
  MessageSquare, 
  Calendar,
  AlertCircle,
  Sparkles,
  TrendingDown,
  UserCheck
} from 'lucide-react';
import { Debt, Client, PaymentMethod, Payment } from '../types/debt';
import { 
  formatKwanza, 
  formatDate, 
  getRemainingBalance, 
  getPaidAmount 
} from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  client: Client | null;
  onSavePayment: (debtId: string, payment: Omit<Payment, 'id'>, sendWhatsApp: boolean) => void;
  currentUserName?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  debt,
  client,
  onSavePayment,
  currentUserName = 'Operador Comercial',
}) => {
  const { t } = useLanguage();
  if (!isOpen || !debt) return null;

  const previouslyPaid = getPaidAmount(debt);
  const remaining = getRemainingBalance(debt);

  const [amount, setAmount] = useState<number>(remaining);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('multicaixa_express');
  const [receiptRef, setReceiptRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receivedBy, setReceivedBy] = useState<string>(currentUserName);
  const [sendWhatsAppConfirmation, setSendWhatsAppConfirmation] = useState<boolean>(true);

  const handlePayFull = () => {
    setAmount(remaining);
  };

  const handleSetPercentage = (factor: number) => {
    setAmount(Math.round(remaining * factor));
  };

  const newBalance = Math.max(0, remaining - (amount || 0));
  const isTotalSettlement = amount >= remaining && remaining > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('O valor da amortização deve ser superior a 0 Kz.');
      return;
    }
    if (amount > remaining) {
      const confirmExceed = window.confirm(
        `O valor inserido (${formatKwanza(amount)}) é superior ao saldo devedor restante (${formatKwanza(remaining)}). Deseja continuar mesmo assim?`
      );
      if (!confirmExceed) return;
    }

    onSavePayment(
      debt.id,
      {
        debtId: debt.id,
        amount,
        date: paymentDate,
        paymentMethod,
        receiptRef: receiptRef.trim() || `REC-${Date.now().toString().slice(-6)}`,
        notes: notes.trim(),
        receivedBy: receivedBy.trim() || currentUserName,
      },
      sendWhatsAppConfirmation
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho Profissional com Destaque para o Vendedor / Controlo */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white flex items-center justify-between border-b border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">{t('payments.title', 'Registar Pagamento / Amortização')}</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-400 text-slate-950 rounded-full uppercase tracking-wider">
                  Controlo
                </span>
              </div>
              <p className="text-xs text-blue-200 flex items-center gap-1.5 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-300" />
                <span>Vendedor:</span>
                <strong className="text-white font-semibold">{currentUserName}</strong>
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

        <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 space-y-4 sm:space-y-5">
          {/* Banner Informativo: Diminuição Imediata da Dívida */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
            <TrendingDown className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Controlo Direto e Diminuição Imediata:</span>
              <p className="text-[11px] text-blue-900 mt-0.5 leading-relaxed">
                Ao confirmar, o valor amortizado é registado no seu controlo de vendedor e diminui automaticamente a dívida ativa do cliente em todo o sistema.
              </p>
            </div>
          </div>

          {/* Resumo da Dívida e Saldo Atual */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('debts.invoice', 'Documento / Fatura')}:</span>
              <strong className="text-slate-900 font-mono text-sm">{debt.invoiceNumber}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('debts.client', 'Cliente')}:</span>
              <span className="text-slate-800 font-semibold">
                {debt.customerName || client?.name || 'Cliente'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 font-mono">
              <div>
                <span className="text-slate-400 text-[11px] block">{t('debts.total', 'Total Original')}:</span>
                <span className="text-slate-700 font-bold">{formatKwanza(debt.totalAmount)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px] block">{t('debts.paid', 'Já Amortizado')}:</span>
                <span className="text-emerald-700 font-bold">{formatKwanza(previouslyPaid)}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
              <span className="text-rose-700 font-bold text-xs uppercase">{t('debts.balance', 'Saldo Restante Atual')}:</span>
              <span className="text-rose-700 font-black text-base" data-tabular>
                {formatKwanza(remaining)}
              </span>
            </div>
          </div>

          {/* Campo de Entrada da Amortização */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                {t('payments.amount_to_pay', 'Valor da Amortização a Entrar (Kz)')} <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handlePayFull}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 underline cursor-pointer"
              >
                {t('payments.pay_total', 'Pagar Totalidade')} ({formatKwanza(remaining)})
              </button>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                placeholder="0 Kz"
                className="w-full py-2.5 px-3 pr-12 text-base font-bold font-mono text-slate-900 border-2 border-blue-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50/20"
              />
              <span className="absolute right-3 top-3 text-xs font-bold text-slate-400 font-mono">
                Kz
              </span>
            </div>

            {/* Chips de Atalhos Rápidos de Amortização */}
            {remaining > 0 && (
              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-medium">{t('payments.quick_amortization', 'Amortização Rápida (% do saldo):')}</span>
                  <span className="font-mono text-[10px] text-slate-400">Clique para selecionar</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '25%', factor: 0.25 },
                    { label: '50%', factor: 0.50 },
                    { label: '75%', factor: 0.75 },
                    { label: '100% (Total)', factor: 1.0 },
                  ].map(chip => {
                    const chipVal = Math.round(remaining * chip.factor);
                    const isSelected = amount === chipVal;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => handleSetPercentage(chip.factor)}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cálculo em Tempo Real da Diminuição da Dívida */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span>Saldo Atual:</span>
                <span>{formatKwanza(remaining)}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-700 font-semibold">
                <span>Amortização Confirmada:</span>
                <span>- {formatKwanza(amount || 0)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-bold text-sm">
                <span className="text-slate-800">{t('payments.new_balance', 'Novo Saldo Devedor:')}</span>
                <span className={newBalance <= 0 ? 'text-emerald-700 font-extrabold' : 'text-blue-900'}>
                  {formatKwanza(newBalance)}
                </span>
              </div>

              {isTotalSettlement ? (
                <div className="pt-1 text-[11px] font-sans font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 rounded-lg p-2 text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Dívida será 100% liquidada! Estado passará a "Paga".</span>
                </div>
              ) : amount > 0 ? (
                <div className="pt-1 text-[11px] font-sans text-blue-900 bg-blue-50 border border-blue-200 rounded-lg p-2 text-center flex items-center justify-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-blue-700" />
                  <span>Dívida diminuirá em {formatKwanza(amount)}. Restará saldo devedor.</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Data do Pagamento e Método */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('payments.date', 'Data do Pagamento')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('payments.method', 'Forma de Pagamento')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="multicaixa_express">{t('payments.method_mcx', 'Multicaixa Express')}</option>
                <option value="transferencia">{t('payments.method_transfer', 'Transferência Bancária')}</option>
                <option value="tpa">{t('payments.method_tpa', 'TPA (Cartão Multicaixa)')}</option>
                <option value="dinheiro">{t('payments.method_cash', 'Dinheiro em Mão')}</option>
                <option value="deposito">{t('payments.method_deposit', 'Depósito Bancário')}</option>
              </select>
            </div>
          </div>

          {/* Referência do Comprovativo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('payments.receipt_ref', 'Nº Comprovativo / Referência')}
            </label>
            <input
              type="text"
              placeholder="Ex: MCX-91823902 ou Ref. TRF BFA/BAI"
              value={receiptRef}
              onChange={e => setReceiptRef(e.target.value)}
              className="w-full py-2 px-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quem Registou / Recebeu (Atribuição do Vendedor) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('payments.received_by', 'Confirmado / Registado por:')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                  className="w-full py-2 px-3 pr-8 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <UserCheck className="w-4 h-4 text-blue-600 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('payments.notes', 'Observações Adicionais')}
              </label>
              <input
                type="text"
                placeholder="Ex: Amortização parcial acordada"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Checkbox para enviar confirmação no WhatsApp */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-950">
                  {t('payments.send_whatsapp', 'Enviar Comprovativo por WhatsApp')}
                </span>
                <p className="text-[11px] text-emerald-800">
                  Abre mensagem de confirmação para {debt.customerPhone || client?.phone || 'o cliente'} após gravar.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sendWhatsAppConfirmation}
              onChange={e => setSendWhatsAppConfirmation(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('payments.confirm_btn', 'Confirmar Amortização e Diminuir Dívida')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
