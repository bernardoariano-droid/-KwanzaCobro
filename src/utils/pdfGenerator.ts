import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Debt, Client, Seller, CompanySettings } from '../types/debt';
import { formatKwanza, formatDate, getRemainingBalance } from './formatters';

/**
 * Converte uma imagem da aplicação para string Base64 utilizável no jsPDF
 */
async function loadBase64Image(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Gera o Comprovativo Digital Oficial NEUROJUS de Reconhecimento de Compra a Crédito
 * em conformidade estrita com o Ponto 9 do caderno de especificações.
 * Inclui Código QR para verificação de autenticidade, discriminação de produtos e assinaturas.
 */
export async function generateNeurojusCreditProofPDF(
  debt: Debt,
  client: Client | null,
  seller: Seller | null,
  company: CompanySettings
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const clientName = debt.customerName || client?.name || 'Cliente';
  const clientPhone = debt.customerPhone || client?.phone || '-';
  const clientNif = client?.nif || 'Consumidor Final';
  const clientAddress = client?.address ? `${client.address}, ${client.province || ''}` : (client?.province || 'Angola');
  const sellerName = seller?.name || 'Vendedor Comercial';
  const sellerBranch = seller?.branch || company.address;
  const transactionId = debt.confirmationTransactionId || `TX-NJ-${debt.id.slice(-8).toUpperCase()}`;
  const confirmationModeLabel = debt.confirmationMode === 'assistida' 
    ? 'Introdução Assistida pelo Funcionário' 
    : 'Introdução Pessoal pelo Cliente';
  const confirmedAtDate = debt.confirmedAt 
    ? new Date(debt.confirmedAt).toLocaleString('pt-AO') 
    : new Date().toLocaleString('pt-AO');

  const marginX = 18;
  let cursorY = 12;

  // 1. Carregar Logomarca Oficial NEUROJUS
  const logoUrl = company.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg';
  const logoBase64 = await loadBase64Image(logoUrl);

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', marginX, cursorY, 50, 15);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('NEUROJUS', marginX + 54, cursorY + 4.5);

      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text('SISTEMA INTEGRADO DE GESTÃO DE CRÉDITO & COBRANÇA', marginX + 54, cursorY + 8.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Emissão e Registo Eletrónico com Confirmação por SMS · República de Angola', marginX + 54, cursorY + 12.5);

      cursorY += 18;
    } catch {
      // Fallback em caso de erro na inserção da imagem
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42);
      doc.text('NEUROJUS', marginX, cursorY + 5);

      doc.setFontSize(8.5);
      doc.setTextColor(180, 83, 9);
      doc.text('SISTEMA INTEGRADO DE GESTÃO DE CRÉDITO & COBRANÇA', marginX + 44, cursorY + 4);

      cursorY += 10;
    }
  } else {
    // Logótipo de Texto
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('NEUROJUS', marginX, cursorY + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('SISTEMA INTEGRADO DE GESTÃO DE CRÉDITO & COBRANÇA', marginX + 44, cursorY + 4);

    cursorY += 10;
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY, 210 - marginX, cursorY);

  // 2. Título Oficial
  cursorY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text('COMPROVATIVO DE RECONHECIMENTO DE COMPRA A CRÉDITO', 105, cursorY, { align: 'center' });

  cursorY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Operação Nº: ${debt.invoiceNumber}  ·  Transação: ${transactionId}`, 105, cursorY, { align: 'center' });

  // 3. Grid de Identificação: Dados da Loja e Dados do Cliente
  cursorY += 6;
  const colW = (210 - marginX * 2 - 6) / 2;
  const boxH = 34;

  // Caixa Loja / Entidade Credora
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, cursorY, colW, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DADOS DA LOJA / CREDORA', marginX + 4, cursorY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name.slice(0, 36), marginX + 4, cursorY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIF: ${company.nif}`, marginX + 4, cursorY + 16);
  doc.text(`Endereço: ${sellerBranch.slice(0, 38)}`, marginX + 4, cursorY + 21);
  doc.text(`Contacto Telefónico: ${company.phone}`, marginX + 4, cursorY + 26);
  doc.text(`Funcionário Responsável: ${sellerName}`, marginX + 4, cursorY + 31);

  // Caixa Cliente / Devedor
  const col2X = marginX + colW + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, cursorY, colW, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DADOS DO CLIENTE / DEVEDOR', col2X + 4, cursorY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(clientName.slice(0, 36), col2X + 4, cursorY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIF / BI: ${clientNif}`, col2X + 4, cursorY + 16);
  doc.text(`Contacto Telefónico: ${clientPhone}`, col2X + 4, cursorY + 21);
  doc.text(`Endereço: ${clientAddress.slice(0, 36)}`, col2X + 4, cursorY + 26);
  doc.text(`Modalidade: ${confirmationModeLabel}`, col2X + 4, cursorY + 31);

  cursorY += boxH + 6;

  // 4. Banner em Destaque: VALOR TOTAL RECONHECIDO & DATA LIMITE
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(marginX, cursorY, 210 - marginX * 2, 19, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('VALOR TOTAL RECONHECIDO DA DÍVIDA:', marginX + 6, cursorY + 6.5);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(formatKwanza(debt.totalAmount), marginX + 6, cursorY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(185, 28, 28); // rose-700
  doc.text('DATA LIMITE DE PAGAMENTO (PRAZO):', 125, cursorY + 6.5);
  doc.setFontSize(13);
  doc.setTextColor(185, 28, 28);
  doc.text(formatDate(debt.dueDate), 125, cursorY + 14);

  cursorY += 25;

  // 5. Discriminação dos Produtos Adquiridos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('DISCRIMINAÇÃO DOS PRODUTOS ADQUIRIDOS A CRÉDITO', marginX, cursorY);

  cursorY += 3.5;
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, cursorY, 210 - marginX * 2, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PRODUTO / DESCRIÇÃO', marginX + 3, cursorY + 4.5);
  doc.text('QTD', 130, cursorY + 4.5, { align: 'center' });
  doc.text('PREÇO UNITÁRIO', 160, cursorY + 4.5, { align: 'right' });
  doc.text('SUBTOTAL', 210 - marginX - 4, cursorY + 4.5, { align: 'right' });

  cursorY += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const items = debt.items && debt.items.length > 0 ? debt.items : [
    { id: '1', description: 'Compra Geral a Crédito', quantity: 1, unitPrice: debt.totalAmount, total: debt.totalAmount }
  ];

  items.slice(0, 6).forEach(item => {
    doc.text(item.description.slice(0, 52), marginX + 3, cursorY + 4);
    doc.text(String(item.quantity), 130, cursorY + 4, { align: 'center' });
    doc.text(formatKwanza(item.unitPrice, false), 160, cursorY + 4, { align: 'right' });
    doc.text(formatKwanza(item.total, false), 210 - marginX - 4, cursorY + 4, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, cursorY + 5.5, 210 - marginX, cursorY + 5.5);
    cursorY += 6;
  });

  cursorY += 2;

  // 6. Bloco da Declaração de Confirmação & Dados da Confirmação (com QR Code)
  const declBoxY = cursorY;
  const declBoxH = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, declBoxY, 210 - marginX * 2, declBoxH, 2, 2, 'FD');

  // Gerar QR Code para verificação de autenticidade
  try {
    const qrDataUrl = await QRCode.toDataURL(
      `https://neurojus.ao/verificar?tx=${transactionId}&op=${debt.invoiceNumber}&v=${debt.totalAmount}`,
      { width: 120, margin: 1 }
    );
    doc.addImage(qrDataUrl, 'PNG', marginX + 4, declBoxY + 3.5, 26, 26);
  } catch (qrErr) {
    // Fallback silencioso se QR falhar
  }

  const textStartX = marginX + 34;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DECLARAÇÃO DE CONFIRMAÇÃO ELECTRÓNICA', textStartX, declBoxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const legalText = 
    "Por meio da confirmação electrónica associada a esta operação, ficou registado o reconhecimento da compra a crédito acima discriminada, no valor total indicado, conforme os dados apresentados ao cliente no momento da confirmação.";
  const splitText = doc.splitTextToSize(legalText, 210 - marginX - textStartX - 2);
  doc.text(splitText, textStartX, declBoxY + 9);

  // Dados da Confirmação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const codeTag = debt.confirmationCode ? `  [ CÓDIGO OFICIAL: ${debt.confirmationCode} ]` : '';
  doc.text(`DADOS DA CONFIRMAÇÃO:${codeTag}`, textStartX, declBoxY + 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Data/Hora: ${confirmedAtDate}  ·  Estado: Confirmada  ·  ID: ${transactionId}`, textStartX, declBoxY + 25);
  doc.text(`Modalidade: ${confirmationModeLabel}  ·  Contacto: ${debt.smsMaskedPhone || debt.customerPhone || client?.phone || '-'}`, textStartX, declBoxY + 29);

  cursorY = declBoxY + declBoxH + 6;

  // 7. Coordenadas Bancárias para Liquidação em Angola
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, cursorY, 210 - marginX * 2, 11, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('COORDENADAS PARA PAGAMENTO:', marginX + 4, cursorY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Banco: ${company.bankName}  ·  IBAN: ${company.iban || 'A indicar'}  ·  Multicaixa Express: ${company.expressPhone || company.phone}`, marginX + 4, cursorY + 8.5);

  cursorY += 16;

  // 8. BLOCO DE ASSINATURAS DO DEVEDOR E CREDOR
  const signW = 72;
  const leftX = marginX + 6;
  const rightX = 210 - marginX - signW - 6;

  // Linha Credor
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.4);
  doc.line(leftX, cursorY, leftX + signW, cursorY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PELA ENTIDADE CREDORA', leftX + signW / 2, cursorY + 3.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(sellerName, leftX + signW / 2, cursorY + 7, { align: 'center' });
  doc.text('Assinatura & Carimbo', leftX + signW / 2, cursorY + 10, { align: 'center' });

  // Linha Devedor
  doc.line(rightX, cursorY, rightX + signW, cursorY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('O(A) DEVEDOR(A)', rightX + signW / 2, cursorY + 3.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(clientName.slice(0, 30), rightX + signW / 2, cursorY + 7, { align: 'center' });
  doc.text(`NIF/BI: ${clientNif}`, rightX + signW / 2, cursorY + 10, { align: 'center' });

  // 9. Rodapé Técnico de Autenticidade
  cursorY += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `NEUROJUS Angola · Documento emitido eletronicamente aos ${confirmedAtDate}. O código SMS utilizado não é exposto no comprovativo para garantia de confidencialidade.`,
    105,
    cursorY,
    { align: 'center' }
  );

  return doc;
}

/**
 * Descarrega o PDF oficial NEUROJUS de forma assíncrona
 */
export async function downloadNeurojusCreditProofPDF(
  debt: Debt,
  client: Client | null,
  seller: Seller | null,
  company: CompanySettings
): Promise<void> {
  const doc = await generateNeurojusCreditProofPDF(debt, client, seller, company);
  const sanitized = debt.invoiceNumber.replace(/[\/\s\\]/g, '_');
  doc.save(`NEUROJUS_Comprovativo_Credito_${sanitized}.pdf`);
}

/**
 * Função compatível anterior
 */
export function generateDebtReceiptPDF(
  debt: Debt,
  client: Client | null,
  seller: Seller | null,
  company: CompanySettings
): jsPDF {
  // Retorna documento síncrono compatível
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const clientName = debt.customerName || client?.name || 'Cliente';
  const sellerName = seller?.name || 'Vendedor Comercial';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('NEUROJUS - COMPROVATIVO DE COMPRA A CRÉDITO', 105, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fatura: ${debt.invoiceNumber} | Valor: ${formatKwanza(debt.totalAmount)} | Data Limite: ${formatDate(debt.dueDate)}`, 105, 33, { align: 'center' });
  doc.text(`Cliente: ${clientName} | Vendedor: ${sellerName}`, 105, 40, { align: 'center' });
  return doc;
}

export async function downloadDebtReceiptPDF(
  debt: Debt,
  client: Client | null,
  seller: Seller | null,
  company: CompanySettings
): Promise<void> {
  await downloadNeurojusCreditProofPDF(debt, client, seller, company);
}

export async function getDebtReceiptPDFBlobUrl(
  debt: Debt,
  client: Client | null,
  seller: Seller | null,
  company: CompanySettings
): Promise<string> {
  const doc = await generateNeurojusCreditProofPDF(debt, client, seller, company);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
