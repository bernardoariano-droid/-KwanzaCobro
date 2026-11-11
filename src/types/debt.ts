export type ClientType = 'empresa' | 'particular';

export type DebtStatus = 'aberta' | 'vencida' | 'liquidada' | 'acordo';

export type PaymentMethod = 
  | 'multicaixa_express'
  | 'transferencia_bancaria'
  | 'tpa'
  | 'dinheiro'
  | 'deposito';

export interface Client {
  id: string;
  name: string;
  nif?: string; // NIF angolano
  phone: string; // Formato angolano (+244 9xx xxx xxx)
  email?: string;
  province: string; // Ex: Luanda, Benguela, Huíla, etc.
  municipality: string; // Ex: Viana, Talatona, Cazenga, Belas, etc.
  address?: string;
  clientType: ClientType;
  creditLimit: number; // Limite em Kwanzas (Kz)
  notes?: string;
  createdBySellerId?: string; // ID do vendedor que registou o cliente
  createdAt: string;
}

export type UserRole = 'admin' | 'vendedor';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch?: string;
}

export interface Seller {
  id: string;
  name: string;
  phone: string;
  branch: string; // Filial / Ponto de venda
  email?: string;
  password?: string; // Senha para login no sistema
  role?: UserRole;
  createdAt?: string;
}

export interface DebtItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  debtId: string;
  amount: number;
  date: string; // Data do pagamento
  paymentMethod: PaymentMethod;
  receiptRef: string; // Ex: Comprovativo BFA, Ref MCX
  notes?: string;
  receivedBy: string; // Nome do vendedor ou caixa
  createdAt?: string;
}

export type CreditConfirmationStatus = 
  | 'pendente_confirmacao' 
  | 'confirmada' 
  | 'expirada' 
  | 'bloqueada' 
  | 'cancelada'
  | 'sem_sms';

export type ConfirmationMode = 'pessoal' | 'assistida';

export interface AuditEntry {
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
}

export interface Debt {
  id: string;
  invoiceNumber: string; // Ex: FT 2026/0412, Guia Crédito #104
  clientId: string;
  sellerId: string;
  customerName?: string; // Nome direto registado na dívida
  customerPhone: string; // Telefone / WhatsApp registado obrigatoriamente para avisos
  issueDate: string; // Data da venda / emissão (YYYY-MM-DD)
  dueDate: string; // DATA LIMITE DE PAGAMENTO (YYYY-MM-DD)
  totalAmount: number; // Quantidade / Montante Total da Dívida (Kz)
  items: DebtItem[];
  status: DebtStatus;
  paymentMethodAgreed: PaymentMethod | string;
  terms?: string;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
  guaranteeType?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  // Campos de Notificação Automática aos 5 dias
  autoReminderEnabled?: boolean;
  reminder5DaysSent?: boolean;
  reminder5DaysSentAt?: string;
  // NEUROJUS: Reconhecimento e Confirmação por SMS
  confirmationStatus?: CreditConfirmationStatus;
  confirmationMode?: ConfirmationMode;
  confirmationCode?: string; // Código oficial de 6 dígitos idêntico ao ecrã e ao recibo
  confirmedAt?: string;
  confirmationTransactionId?: string;
  smsStatus?: 'enviado' | 'nao_configurado' | 'falha' | 'pendente';
  smsSentAt?: string;
  smsMaskedPhone?: string;
  whatsappSent?: boolean;
  whatsappSentAt?: string;
  verificationQrCode?: string;
  auditTrail?: AuditEntry[];
}

export interface CompanySettings {
  name: string;
  nif: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  bankName: string;
  iban: string;
  expressPhone: string;
  currency: string;
  logoUrl?: string;
  penaltyPerDayRate?: number;
  daysBeforeDueAlert: number; // Configuração de dias de aviso prévio (Padrão: 5 dias)
  autoAlertNotifications: boolean;
  senha?: string; // Senha da empresa / Administrador
  password?: string; // Sinónimo para compatibilidade
}

