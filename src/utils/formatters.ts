import { Debt, Client, CompanySettings, DebtStatus } from '../types/debt';

/**
 * Formata um valor numérico para a moeda de Angola (Kwanza - Kz).
 * Exemplo: 1500000 -> "1.500.000,00 Kz"
 */
export function formatKwanza(amount: number, showDecimals = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0,00 Kz';
  }
  
  const formatted = new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);

  return `${formatted} Kz`;
}

/**
 * Formata data ISO para padrão português (DD/MM/AAAA)
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-AO');
  } catch {
    return dateString;
  }
}

/**
 * Calcula o total já amortizado/pago de uma dívida
 */
export function getPaidAmount(debt: Debt): number {
  if (!debt.payments || debt.payments.length === 0) return 0;
  return debt.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
}

/**
 * Calcula o saldo devedor restante
 */
export function getRemainingBalance(debt: Debt): number {
  const paid = getPaidAmount(debt);
  return Math.max(0, debt.totalAmount - paid);
}

/**
 * Calcula a percentagem paga de uma dívida (0 a 100)
 */
export function getPaidPercentage(debt: Debt): number {
  if (debt.totalAmount <= 0) return 100;
  const paid = getPaidAmount(debt);
  return Math.min(100, Math.round((paid / debt.totalAmount) * 100));
}

/**
 * Retorna os dias de diferença entre hoje e a data limite de pagamento.
 * Se positivo: dias de atraso (vencido há X dias)
 * Se negativo: dias restantes para o vencimento (vence em X dias)
 * Se 0: vence hoje
 */
export function getDaysDiff(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  due.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determina o estado em tempo real da dívida
 */
export function getEffectiveStatus(debt: Debt): {
  status: DebtStatus;
  label: string;
  daysDiff: number;
  badgeClass: string;
} {
  const remaining = getRemainingBalance(debt);
  if (remaining <= 0) {
    return {
      status: 'liquidada',
      label: 'Liquidada / Paga',
      daysDiff: 0,
      badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    };
  }

  const daysDiff = getDaysDiff(debt.dueDate);

  if (debt.status === 'acordo') {
    return {
      status: 'acordo',
      label: 'Em Acordo / Reescalonada',
      daysDiff,
      badgeClass: 'text-blue-700 bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    };
  }

  if (daysDiff > 0) {
    return {
      status: 'vencida',
      label: `Vencida (${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'} de atraso)`,
      daysDiff,
      badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    };
  }

  if (daysDiff === 0) {
    return {
      status: 'aberta',
      label: 'Vence Hoje',
      daysDiff: 0,
      badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    };
  }

  const daysRemaining = Math.abs(daysDiff);
  if (daysRemaining <= 3) {
    return {
      status: 'aberta',
      label: `Vence em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`,
      daysDiff,
      badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    };
  }

  return {
    status: 'aberta',
    label: `Dentro do Prazo (${daysRemaining} dias)`,
    daysDiff,
    badgeClass: 'text-slate-700 bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  };
}

/**
 * Limpa o número de telefone e garante o prefixo de Angola (+244) para WhatsApp
 */
export function normalizeAngolaPhone(phone: string): string {
  if (!phone) return '';
  // Remover espaços, traços, parênteses
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // Se for apenas o número local de 9 dígitos (ex: 923456789)
  if (cleaned.length === 9 && (cleaned.startsWith('9') || cleaned.startsWith('2'))) {
    cleaned = `244${cleaned}`;
  }
  return cleaned;
}

export type WhatsAppMessageType = 
  | 'comprovativo_credito'
  | 'lembrete_5_dias'
  | 'lembrete_preventivo'
  | 'vencimento_hoje'
  | 'cobranca_atraso'
  | 'aviso_urgente'
  | 'recibo_pagamento';

/**
 * Gera mensagem profissional personalizada para WhatsApp no contexto comercial angolano
 */
export function generateWhatsAppMessage(
  type: WhatsAppMessageType,
  debt: Debt,
  client: Client | { name: string; phone: string },
  company: CompanySettings,
  lastPaymentAmount?: number
): string {
  const remaining = getRemainingBalance(debt);
  const remainingFormatted = formatKwanza(remaining);
  const dueDateFormatted = formatDate(debt.dueDate);
  const daysDiff = getDaysDiff(debt.dueDate);
  const daysOverdue = Math.max(0, daysDiff);
  const daysRemaining = Math.abs(daysDiff);

  const clienteNome = debt.customerName || client.name;
  const docRef = debt.invoiceNumber;
  const ibanInfo = company.iban ? `\n\n📌 *Coordenadas para Pagamento:*\n🏦 Banco: ${company.bankName}\n💳 IBAN: ${company.iban}\n📱 Multicaixa Express: ${company.expressPhone || company.phone}` : '';

  switch (type) {
    case 'comprovativo_credito': {
      const codeInfo = debt.confirmationCode ? `\n🔐 *Código de Confirmação:* *${debt.confirmationCode}* (Consta no Recibo Oficial)` : '';
      const itemsList = debt.items.map(it => `• ${it.description} (${it.quantity} un) - ${formatKwanza(it.total)}`).join('\n');
      return `📄 *COMPROVATIVO DE COMPRA A CRÉDITO · NEUROJUS*\n\nOlá, *${clienteNome}*!\n\nConfirmamos o registo da sua compra a crédito na *${company.name}* sob Fatura *${docRef}*.\n\n💰 *Total da Dívida:* *${formatKwanza(debt.totalAmount)}*\n📅 *Data Limite de Pagamento:* *${dueDateFormatted}*${codeInfo}\n\n📦 *Produtos Adquiridos:*\n${itemsList}${ibanInfo}\n\nMuito obrigado pela confiança e preferência!\n*${company.name}*`;
    }

    case 'lembrete_5_dias':
      return `⏰ *AVISO PREVENTIVO: FALTAM 5 DIAS PARA O VENCIMENTO*\n\nEstimado(a) parceiro(a) *${clienteNome}*,\n\nCumprimentos da equipe da *${company.name}*.\n\nPassamos para recordar que a sua fatura/documento a prazo *${docRef}*, com saldo a liquidar de *${remainingFormatted}*, tem como data limite de pagamento o dia *${dueDateFormatted}* (faltam exatamente *5 dias*).\n\nPara sua comodidade e evitar constrangimentos, pode efetuar o pagamento antecipadamente através dos nossos canais:${ibanInfo}\n\nApós o pagamento, agradecemos o envio do comprovativo por esta via. Muito obrigado pela sua pontualidade e preferência!`;

    case 'lembrete_preventivo':
      return `Olá, *${clienteNome}*! Cumprimentos da equipe da *${company.name}*.\n\nPassamos para recordar, com a melhor consideração, que a fatura/documento *${docRef}* no valor em aberto de *${remainingFormatted}* tem como data limite de pagamento o dia *${dueDateFormatted}* (restam *${daysRemaining} dias*).\n\nAgradecemos a sua habitual preferência e parceria.${ibanInfo}\n\nCaso já tenha efetuado a liquidação, por favor ignore este lembrete ou partilhe o comprovativo. Obrigado!`;

    case 'vencimento_hoje':
      return `Olá, *${clienteNome}*! Esperamos que esteja tudo bem.\n\nLembramos que *HOJE (${dueDateFormatted})* é a data limite para a liquidação da fatura *${docRef}*, no valor de *${remainingFormatted}* com a *${company.name}*.\n\nSolicitamos a gentileza de regularizar o pagamento durante o dia de hoje.${ibanInfo}\n\nPor favor, envie-nos o comprovativo de transferência ou Multicaixa para atualizarmos a sua conta corrente. Muito obrigado!`;

    case 'cobranca_atraso':
      return `Prezado(a) *${clienteNome}*,\n\nEsperamos que este contacto o(a) encontre bem. Notámos que a fatura *${docRef}*, com data limite de *${dueDateFormatted}* (vencida há *${daysOverdue} dias*), ainda se encontra com um saldo pendente de *${remainingFormatted}* junto da *${company.name}*.\n\nCompreendemos que imprevistos acontecem, pelo que gostaríamos de solicitar a regularização do valor ou que entre em contacto connosco para alinharmos uma solução amigável.${ibanInfo}\n\nAgradecemos a sua rápida resposta. Atentamente,\n*${company.name}*`;

    case 'aviso_urgente':
      return `⚠️ *NOTIFICAÇÃO DE COBRANÇA URGENTE*\n\nExmo(a). Sr(a). *${clienteNome}*,\n\nInformamos que a fatura *${docRef}* emitida pela *${company.name}*, no montante em débito de *${remainingFormatted}*, encontra-se vencida há *${daysOverdue} dias* (Data limite: *${dueDateFormatted}*).\n\nFace à falta de regularização e por forma a evitar a suspensão do fornecimento a crédito e o encaminhamento para o departamento jurídico/contencioso, solicitamos a liquidação integral ou contacto urgente nas próximas 24 horas.${ibanInfo}\n\nContacto direto: ${company.phone}.\nDepartamento Financeiro & Cobranças - *${company.name}*`;

    case 'recibo_pagamento': {
      const valorPago = lastPaymentAmount ? formatKwanza(lastPaymentAmount) : 'o valor acordado';
      const saldoRestante = remaining <= 0 ? 'Conta totalmente LIQUIDADA. Parabéns!' : `Saldo restante a liquidar: ${remainingFormatted}`;
      return `✅ *CONFIRMAÇÃO DE RECEBIMENTO DE PAGAMENTO*\n\nOlá, *${clienteNome}*!\n\nA *${company.name}* confirma com agrado a receção da amortização no valor de *${valorPago}*, referente ao documento *${docRef}*.\n\n📊 *Situação Atual:* ${saldoRestante}\n\nAgradecemos a sua pontualidade e o compromisso com a nossa parceria comercial.\n\nCom os melhores cumprimentos,\n*${company.name}*`;
    }
  }
}

/**
 * Gera mensagem compacta formatada para SMS padrão (até 160 caracteres ou concisa)
 */
export function generateSMSMessage(
  debt: Debt,
  company: CompanySettings,
  daysRemaining: number
): string {
  const remainingFormatted = formatKwanza(getRemainingBalance(debt), false);
  const clienteNome = (debt.customerName || 'Cliente').split(' ')[0];
  const mcx = company.expressPhone || company.phone;

  return `${company.name}: Ola ${clienteNome}, restam ${daysRemaining} dias para o vencimento da Fatura ${debt.invoiceNumber} no valor de ${remainingFormatted}. Pague por MCX Express ${mcx} ou IBAN ${company.iban || ''}. Obrigado!`;
}

/**
 * Verifica se a dívida está qualificada para o alerta preventivo de 5 dias
 */
export function isEligibleFor5DaysAlert(debt: Debt, alertDays = 5): boolean {
  const remaining = getRemainingBalance(debt);
  if (remaining <= 0) return false;
  if (debt.autoReminderEnabled === false) return false;

  const diff = getDaysDiff(debt.dueDate);
  // diff negativo significa dias até ao vencimento (ex: diff = -5 significa exatamente faltam 5 dias)
  const daysUntilDue = Math.abs(diff);

  // Considera qualificada se faltar até o número configurado de dias (padrão 5 dias) e ainda não venceu
  return diff <= 0 && daysUntilDue <= alertDays && daysUntilDue > 0;
}


/**
 * Cria a URL do WhatsApp Web / App
 */
export function getWhatsAppUrl(phone: string, text: string): string {
  const normalized = normalizeAngolaPhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
