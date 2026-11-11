import React from 'react';
import { Printer, ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';
import { Debt, Client, Seller, CompanySettings } from '../types/debt';
import { formatKwanza, formatDate, getRemainingBalance, getPaidAmount, getEffectiveStatus } from '../utils/formatters';

interface ReceiptPrintViewProps {
  debt: Debt;
  client?: Client;
  seller?: Seller;
  company: CompanySettings;
  onBack: () => void;
}

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  debt,
  client,
  seller,
  company,
  onBack,
}) => {
  const remaining = getRemainingBalance(debt);
  const paid = getPaidAmount(debt);
  const effStatus = getEffectiveStatus(debt);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Barra de Controlo no Topo (oculta na impressão) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Sistema</span>
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Guardar PDF</span>
        </button>
      </div>

      {/* Documento Imprimível A4 */}
      <div className="bg-white border border-slate-300 p-8 rounded-lg shadow-sm print:border-none print:shadow-none print:p-0 text-slate-900 font-sans">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-slate-300 pb-6">
          <div className="space-y-2">
            <div className="p-1 bg-white inline-block border border-slate-200 rounded-lg print:border-none">
              <img 
                src={company.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                alt="NEUROJUS Logomarca" 
                className="h-12 w-auto max-w-[200px] object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">{company.name}</h1>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                <div>NIF: {company.nif}</div>
                <div>{company.address} · {company.city}</div>
                <div>Tel: {company.phone} · E-mail: {company.email}</div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
              Extrato de Venda a Prazo / Débito
            </span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{debt.invoiceNumber}</div>
            <div className="text-xs text-slate-500 mt-1">Data Emissão: {formatDate(debt.issueDate)}</div>
            <div className="text-xs font-bold font-mono text-rose-700 mt-0.5">
              DATA LIMITE: {formatDate(debt.dueDate)}
            </div>
          </div>
        </div>

        {/* Informação do Cliente & Vendedor */}
        <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
              Cliente Devedor
            </span>
            <div className="text-sm font-bold text-slate-900">{client?.name || 'Cliente'}</div>
            <div className="text-slate-600 font-mono mt-0.5">NIF: {client?.nif || 'Consumidor Final'}</div>
            <div className="text-slate-600 font-mono">Telefone: {client?.phone || '-'}</div>
            <div className="text-slate-500">{client?.address || ''}, {client?.province || ''}</div>
          </div>

          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
              Operador & Condições
            </span>
            <div><span className="text-slate-500">Vendedor: </span><strong>{seller?.name || '-'}</strong></div>
            <div><span className="text-slate-500">Filial: </span>{seller?.branch || '-'}</div>
            <div><span className="text-slate-500">Método Acordado: </span>{debt.paymentMethodAgreed.replace('_', ' ')}</div>
            <div><span className="text-slate-500">Garantia: </span>{debt.guaranteeType || 'Acordo Comercial'}</div>
          </div>
        </div>

        {/* Tabela de Artigos */}
        <div className="py-6">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-2">
            Discriminação da Mercadoria / Serviço Fornecido a Crédito
          </span>
          <table className="w-full text-xs text-left border border-slate-200">
            <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Item / Descrição</th>
                <th className="py-2 px-3 text-center w-20">Qtd</th>
                <th className="py-2 px-3 text-right w-32">Preço Unitário</th>
                <th className="py-2 px-3 text-right w-36">Total (Kz)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {debt.items.map(item => (
                <tr key={item.id}>
                  <td className="py-2 px-3 font-medium">{item.description}</td>
                  <td className="py-2 px-3 text-center font-mono">{item.quantity}</td>
                  <td className="py-2 px-3 text-right font-mono" data-tabular>{formatKwanza(item.unitPrice)}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold" data-tabular>{formatKwanza(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Histórico de Amortizações se houver */}
        {debt.payments.length > 0 && (
          <div className="py-2">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-2">
              Histórico de Amortizações e Pagamentos Parciais Recebidos
            </span>
            <table className="w-full text-xs text-left border border-slate-200">
              <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-3">Data</th>
                  <th className="py-1.5 px-3">Método</th>
                  <th className="py-1.5 px-3">Referência Comprovativo</th>
                  <th className="py-1.5 px-3">Recebido Por</th>
                  <th className="py-1.5 px-3 text-right">Valor Amortizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {debt.payments.map(p => (
                  <tr key={p.id}>
                    <td className="py-1.5 px-3 font-mono">{formatDate(p.date)}</td>
                    <td className="py-1.5 px-3 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-1.5 px-3 font-mono">{p.receiptRef}</td>
                    <td className="py-1.5 px-3">{p.receivedBy}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-800" data-tabular>
                      {formatKwanza(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumo Financeiro */}
        <div className="py-6 flex justify-end">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Valor Total da Venda:</span>
              <span className="font-mono font-semibold">{formatKwanza(debt.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Já Liquidado:</span>
              <span className="font-mono font-semibold text-emerald-700">{formatKwanza(paid)}</span>
            </div>
            <div className="pt-2 border-t-2 border-slate-800 flex justify-between font-bold text-sm">
              <span className="text-slate-900">SALDO DEVEDOR ATUAL:</span>
              <span className="font-mono text-rose-800" data-tabular>{formatKwanza(remaining)}</span>
            </div>
          </div>
        </div>

        {/* Bloco de Confirmação & Código Oficial de Reconhecimento */}
        {(debt.confirmationCode || debt.confirmationTransactionId) && (
          <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-1 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                Validação Eletrónica de Compra a Crédito · NEUROJUS
              </span>
              {debt.confirmationCode && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">Código Oficial de Confirmação:</span>
                  <strong className="font-mono text-sm bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300 font-black tracking-widest">
                    {debt.confirmationCode}
                  </strong>
                </div>
              )}
            </div>
            <div className="text-slate-600 text-[11px] pt-1">
              Operação formalizada e conferida pelo cliente para o contacto <strong>{debt.smsMaskedPhone || debt.customerPhone || client?.phone}</strong> sob identificador de transação <strong className="font-mono">{debt.confirmationTransactionId || 'TX-NJ'}</strong>.
            </div>
          </div>
        )}

        {/* Dados para Pagamento */}
        {remaining > 0 && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs space-y-1 mb-8">
            <span className="font-bold text-slate-900 block">Coordenadas para Pagamento em Angola:</span>
            <div>Banco: <strong>{company.bankName}</strong></div>
            <div>IBAN: <strong className="font-mono">{company.iban}</strong></div>
            <div>Multicaixa Express (MCX): <strong className="font-mono">{company.expressPhone || company.phone}</strong></div>
          </div>
        )}

        {/* Campo de Assinaturas */}
        <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-300 text-xs text-center">
          <div>
            <div className="border-b border-slate-400 h-10 mb-2"></div>
            <span className="font-semibold text-slate-700">Pela Empresa Credora</span>
            <div className="text-[10px] text-slate-400">Assinatura & Carimbo</div>
          </div>
          <div>
            <div className="border-b border-slate-400 h-10 mb-2"></div>
            <span className="font-semibold text-slate-700">{client?.name || 'O Cliente'}</span>
            <div className="text-[10px] text-slate-400">Assinatura do Devedor / Confissão</div>
          </div>
        </div>
      </div>
    </div>
  );
};
