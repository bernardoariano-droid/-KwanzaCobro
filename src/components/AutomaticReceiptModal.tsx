import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  MessageSquare, 
  CheckCircle2, 
  FileText, 
  Share2, 
  PenTool, 
  ArrowRight,
  ShieldCheck,
  QrCode as QrCodeIcon,
  Smartphone,
  Lock,
  Building2
} from 'lucide-react';
import QRCode from 'qrcode';
import { Debt, Client, Seller, CompanySettings } from '../types/debt';
import { formatKwanza, formatDate, getRemainingBalance } from '../utils/formatters';
import { downloadNeurojusCreditProofPDF } from '../utils/pdfGenerator';

interface AutomaticReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  client: Client | null;
  seller: Seller | null;
  company: CompanySettings;
  onOpenWhatsApp: (debt: Debt) => void;
  onPrintNative: (debt: Debt) => void;
}

export const AutomaticReceiptModal: React.FC<AutomaticReceiptModalProps> = ({
  isOpen,
  onClose,
  debt,
  client,
  seller,
  company,
  onOpenWhatsApp,
  onPrintNative,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    if (debt) {
      const txId = debt.confirmationTransactionId || `TX-NJ-${debt.id.slice(-8).toUpperCase()}`;
      const verifyUrl = `${window.location.origin}/api/sms/verify-receipt/${txId}`;
      QRCode.toDataURL(verifyUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).then(url => setQrCodeDataUrl(url)).catch(() => {});
    }
  }, [debt]);

  if (!isOpen || !debt) return null;

  const clientName = debt.customerName || client?.name || 'Cliente';
  const clientPhone = debt.customerPhone || client?.phone || '-';
  const clientNif = client?.nif || 'Consumidor Final';
  const sellerName = seller?.name || 'Vendedor Comercial';
  const sellerBranch = seller?.branch || company.address;
  const transactionId = debt.confirmationTransactionId || `TX-NJ-${debt.id.slice(-8).toUpperCase()}`;
  const isSmsConfirmed = debt.confirmationStatus === 'confirmada';

  const handleDownloadPDF = async () => {
    await downloadNeurojusCreditProofPDF(debt, client, seller, company);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const todayStr = new Date().toLocaleDateString('pt-AO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[94vh]">
        {/* Banner Superior de Sucesso */}
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700/90 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Compra a Crédito Gravada & Confirmada!</h2>
                <span className="text-[11px] font-mono bg-emerald-950/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700/60">
                  {transactionId}
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Comprovativo digital gerado com código QR de autenticidade e campos para assinaturas
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

        {/* Barra de Ações Rápidas (Download PDF / Impressão / WhatsApp) */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {isSmsConfirmed 
                ? `Confirmado por SMS (${debt.confirmationMode === 'assistida' ? 'Introdução Assistida' : 'Introdução Pessoal'})` 
                : 'Registo a crédito pendente de quitação'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Principal: Descarregar PDF NEUROJUS */}
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{downloadSuccess ? 'PDF Descarregado!' : 'Descarregar Comprovativo PDF'}</span>
            </button>

            {/* Imprimir Documento */}
            <button
              onClick={() => onPrintNative(debt)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir</span>
            </button>

            {/* Enviar WhatsApp */}
            <button
              onClick={() => onOpenWhatsApp(debt)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enviar WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Pré-visualização do Comprovativo Oficial NEUROJUS Formatado para Assinatura */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="bg-white border border-slate-300 rounded-xl p-8 max-w-3xl mx-auto shadow-sm text-slate-900 font-sans space-y-6">
            {/* Cabeçalho Oficial NEUROJUS com Logomarca Oficial */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-200 pb-5 gap-4">
              <div className="flex items-start gap-4">
                <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-xs shrink-0">
                  <img 
                    src={company.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                    alt="NEUROJUS Logomarca" 
                    className="h-12 w-auto max-w-[180px] object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-slate-900 tracking-tight">NEUROJUS</span>
                    <span className="text-xs font-bold text-teal-700 uppercase">
                      · Sistema de Gestão de Crédito
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                    <div>Loja Credora: <strong>{company.name}</strong></div>
                    <div>NIF: {company.nif} · Telefone: {company.phone}</div>
                    <div>{company.address} · {company.city}</div>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Comprovativo de Compra a Crédito
                </span>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">{debt.invoiceNumber}</div>
                <div className="text-xs text-slate-500">Emissão: {formatDate(debt.issueDate)}</div>
                <div className="text-xs font-bold font-mono text-rose-700 mt-0.5">
                  VENCE A: {formatDate(debt.dueDate)}
                </div>
              </div>
            </div>

            {/* Caixa de Autenticação Digital & QR Code */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-900 block text-sm">
                  Validação Eletrónica por SMS & Identificador Único
                </span>
                <div className="text-slate-600 font-mono">
                  Transação: <strong className="text-slate-900">{transactionId}</strong>
                </div>
                {debt.confirmationCode && (
                  <div className="text-slate-700 flex items-center gap-2 pt-0.5">
                    <span>Código de Confirmação Oficial:</span>
                    <strong className="font-mono text-sm bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300 font-black tracking-widest">
                      {debt.confirmationCode}
                    </strong>
                  </div>
                )}
                <div className="text-slate-600">
                  Modalidade: <strong>{debt.confirmationMode === 'assistida' ? 'Introdução Assistida pelo Funcionário' : debt.confirmationMode === 'pessoal' ? 'Introdução Pessoal pelo Cliente' : 'Registo Comercial Direto'}</strong>
                </div>
                <div className="text-slate-600 flex items-center gap-2">
                  <span>Contacto de Validação: <strong className="font-mono text-emerald-800">{debt.smsMaskedPhone || clientPhone}</strong></span>
                  {debt.whatsappSent && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                      WhatsApp Enviado
                    </span>
                  )}
                </div>
              </div>

              {/* QR Code Imagem */}
              <div className="shrink-0 text-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code de Verificação"
                    className="w-20 h-20 border border-slate-200 rounded-lg p-1 bg-white mx-auto shadow-xs"
                  />
                ) : (
                  <div className="w-20 h-20 border border-slate-200 rounded-lg flex items-center justify-center bg-white text-slate-400">
                    <QrCodeIcon className="w-8 h-8" />
                  </div>
                )}
                <span className="text-[9px] text-slate-500 block mt-1 font-mono">Verificar Autenticidade</span>
              </div>
            </div>

            {/* Bloco Credor e Devedor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                  Entidade Credora (Loja)
                </span>
                <div className="font-bold text-slate-900 text-sm">{company.name}</div>
                <div className="text-slate-600">NIF: {company.nif}</div>
                <div className="text-slate-600">Operador / Vendedor: {sellerName} ({sellerBranch})</div>
                <div className="text-slate-600">Contacto: {company.phone}</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                  Cliente Devedor(a)
                </span>
                <div className="font-bold text-slate-900 text-sm">{clientName}</div>
                <div className="text-slate-600">NIF: {clientNif}</div>
                <div className="text-slate-600 font-mono">Telefone: {clientPhone}</div>
                <div className="text-slate-600">{client?.address || company.city}</div>
              </div>
            </div>

            {/* Tabela dos Produtos Adquiridos */}
            <div className="space-y-2">
              <span className="font-bold text-xs text-slate-900 uppercase tracking-wider block">
                Discriminação dos Produtos Adquiridos
              </span>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Produto / Artigo</th>
                      <th className="py-2 px-3 text-center w-20">Qtd</th>
                      <th className="py-2 px-3 text-right w-28">Preço Unit.</th>
                      <th className="py-2 px-3 text-right w-32">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debt.items.map(item => (
                      <tr key={item.id}>
                        <td className="py-2 px-3 font-medium text-slate-800">{item.description}</td>
                        <td className="py-2 px-3 text-center font-mono">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatKwanza(item.unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatKwanza(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total da Dívida */}
            <div className="flex justify-end pt-2">
              <div className="w-72 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Valor Total da Compra:</span>
                  <span className="font-mono font-bold">{formatKwanza(debt.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Prazo Limite:</span>
                  <span className="font-mono font-semibold text-rose-700">{formatDate(debt.dueDate)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between font-black text-sm text-slate-900">
                  <span>SALDO A LIQUIDAR:</span>
                  <span className="font-mono text-amber-800" data-tabular>{formatKwanza(getRemainingBalance(debt))}</span>
                </div>
              </div>
            </div>

            {/* Declaração Jurídica de Reconhecimento da Dívida */}
            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-[11px] text-slate-700 leading-relaxed text-justify">
              <p>
                <strong>DECLARAÇÃO FORMAL DE RECONHECIMENTO DE DÍVIDA:</strong> O(A) Devedor(a) abaixo identificado(a) declara e reconhece expressamente perante a Entidade Credora ter adquirido a crédito os produtos acima discriminados e ser devedor(a) da quantia líquida e certa de <strong>{formatKwanza(debt.totalAmount)}</strong>, obrigando-se pontualmente a liquidá-la até à Data Limite de <strong>{formatDate(debt.dueDate)}</strong>. A presente operação foi formalizada com código de validação SMS para o contacto <strong>{debt.smsMaskedPhone || clientPhone}</strong> sob ID de transação <strong>{transactionId}</strong>, servindo de título executivo nos termos da legislação comercial angolana.
              </p>
            </div>

            <div className="text-center text-xs text-slate-500 pt-1">
              {company.city || 'Luanda'}, aos {todayStr}.
            </div>

            {/* BLOCO FORMAL DE ASSINATURAS DO DEVEDOR E DO CREDOR */}
            <div className="grid grid-cols-2 gap-10 pt-8 border-t-2 border-slate-300 text-xs text-center">
              <div>
                <div className="border-b border-slate-600 h-10 mb-2"></div>
                <div className="font-bold text-slate-900 uppercase text-[11px]">Pela Entidade Credora</div>
                <div className="text-slate-600">{sellerName}</div>
                <div className="text-[10px] text-slate-400">Assinatura & Carimbo Comercial</div>
              </div>

              <div>
                <div className="border-b border-slate-600 h-10 mb-2"></div>
                <div className="font-bold text-slate-900 uppercase text-[11px]">O(A) Devedor(a)</div>
                <div className="text-slate-600">{clientName}</div>
                <div className="text-[10px] text-slate-400">Assinatura Legível conforme BI</div>
              </div>
            </div>

            {/* Fiador se houver */}
            {debt.guarantorName && (
              <div className="pt-6 text-center max-w-sm mx-auto">
                <div className="border-b border-slate-600 h-8 mb-2"></div>
                <div className="font-bold text-slate-900 uppercase text-[11px]">O(A) Fiador(a) Solidário(a)</div>
                <div className="text-slate-600">{debt.guarantorName} ({debt.guarantorPhone || ''})</div>
                <div className="text-[10px] text-slate-400">Assinatura do Fiador</div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Ficheiro PDF gerado com código QR de validação e termos contratuais comerciais de Angola.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Descarregar PDF NEUROJUS</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Concluir & Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
