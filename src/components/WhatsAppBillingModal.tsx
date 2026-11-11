import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  Copy, 
  Check, 
  ExternalLink, 
  Phone, 
  Building2, 
  CreditCard,
  AlertTriangle 
} from 'lucide-react';
import { Debt, Client, CompanySettings } from '../types/debt';
import { 
  generateWhatsAppMessage, 
  getWhatsAppUrl, 
  WhatsAppMessageType, 
  formatKwanza, 
  formatDate,
  getRemainingBalance,
  normalizeAngolaPhone,
  getDaysDiff
} from '../utils/formatters';

interface WhatsAppBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  client: Client | null;
  company: CompanySettings;
  defaultType?: WhatsAppMessageType;
}

export const WhatsAppBillingModal: React.FC<WhatsAppBillingModalProps> = ({
  isOpen,
  onClose,
  debt,
  client,
  company,
  defaultType,
}) => {
  if (!isOpen || !debt || !client) return null;

  const targetPhone = debt.customerPhone || client.phone;
  const targetName = debt.customerName || client.name;

  // Determinar o tipo de mensagem recomendado com base na data limite de pagamento
  const daysDiff = getDaysDiff(debt.dueDate);
  const remaining = getRemainingBalance(debt);

  const determineInitialType = (): WhatsAppMessageType => {
    if (defaultType) return defaultType;
    if (remaining <= 0) return 'recibo_pagamento';
    if (daysDiff > 7) return 'aviso_urgente';
    if (daysDiff > 0) return 'cobranca_atraso';
    if (daysDiff === 0) return 'vencimento_hoje';
    if (Math.abs(daysDiff) <= 5) return 'lembrete_5_dias';
    return 'lembrete_preventivo';
  };

  const [messageType, setMessageType] = useState<WhatsAppMessageType>(determineInitialType());
  const [customText, setCustomText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Regenerar texto quando o tipo de mensagem mudar
  useEffect(() => {
    const text = generateWhatsAppMessage(messageType, debt, { name: targetName, phone: targetPhone }, company);
    setCustomText(text);
  }, [messageType, debt, targetName, targetPhone, company]);

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const url = getWhatsAppUrl(targetPhone, customText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const normalizedPhone = normalizeAngolaPhone(client.phone);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-300" />
            <div>
              <h2 className="text-base font-bold">Cobrança e Lembrete via WhatsApp</h2>
              <p className="text-xs text-emerald-100">
                Envio imediato de mensagem profissional adaptada ao contexto comercial angolano
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dados do Destinatário & Dívida */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-slate-900 text-sm">{client.name}</div>
              <div className="text-slate-600 font-mono mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <Phone className="w-3.5 h-3.5" />
                  {client.phone}
                </span>
                <span aria-hidden="true">·</span>
                <span>Fatura: {debt.invoiceNumber}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-slate-900 font-mono" data-tabular>
                Saldo: {formatKwanza(remaining)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Limite: {formatDate(debt.dueDate)}
                {daysDiff > 0 && (
                  <span className="text-rose-600 font-bold ml-1">
                    ({daysDiff}d atraso)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Seleção do Tipo de Cobrança / Tom de Mensagem */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Selecione o Tipo de Mensagem:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMessageType('comprovativo_credito')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'comprovativo_credito'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1 text-emerald-900">
                  <span>📄 Comprovativo & Código</span>
                </div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">Código e produtos da compra</div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('lembrete_5_dias')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'lembrete_5_dias'
                    ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1 text-amber-900">
                  <span>⏰ Faltam 5 Dias</span>
                </div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">Aviso preventivo aos 5 dias</div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('lembrete_preventivo')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'lembrete_preventivo'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Lembrete Geral</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">Antes do prazo limite</div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('vencimento_hoje')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'vencimento_hoje'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Vencimento Hoje</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">Data limite é hoje</div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('cobranca_atraso')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'cobranca_atraso'
                    ? 'border-orange-600 bg-orange-50 text-orange-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Aviso de Atraso</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">Cobrança cordial</div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('aviso_urgente')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'aviso_urgente'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold text-rose-700">Cobrança Urgente</div>
                <div className="text-[11px] text-rose-600 mt-0.5 font-normal">Aviso pré-jurídico</div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('recibo_pagamento')}
                className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                  messageType === 'recibo_pagamento'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Confirmação de Pagamento</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">Agradecimento e recibo</div>
              </button>
            </div>
          </div>

          {/* Área de Edição do Texto com Pre-visualização */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Texto da Mensagem (pode editar livremente antes de enviar):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={8}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              className="w-full p-3.5 text-xs font-sans border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/40 text-slate-800 leading-relaxed"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Inclui automaticamente as coordenadas bancárias da empresa (IBAN {company.bankName} e Multicaixa Express {company.expressPhone}).
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Fechar
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{copied ? 'Copiado!' : 'Copiar para SMS'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Enviar no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
