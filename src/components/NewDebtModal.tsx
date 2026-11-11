import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertTriangle, 
  Check, 
  UserPlus, 
  Receipt, 
  ShieldCheck, 
  Info,
  Send,
  Smartphone,
  UserCheck,
  Clock,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Store,
  FileCheck2,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { Debt, Client, Seller, DebtItem, PaymentMethod, ConfirmationMode, AuditEntry, CompanySettings, AuthUser } from '../types/debt';
import { formatKwanza, getRemainingBalance } from '../utils/formatters';
import { supabase } from '../lib/supabase';

interface NewDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newDebt: Omit<Debt, 'id' | 'payments' | 'createdAt' | 'updatedAt'>) => void;
  clients: Client[];
  sellers: Seller[];
  debts: Debt[];
  company?: CompanySettings;
  currentUser?: AuthUser | null;
  onOpenNewClient: () => void;
}

export const NewDebtModal: React.FC<NewDebtModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  sellers,
  debts,
  company,
  currentUser,
  onOpenNewClient,
}) => {
  // Wizard Stages:
  // 1 = Registo de Produtos, Cliente e Prazos
  // 2 = Conferência da Compra pelo Cliente & Envio de SMS
  // 3 = Introdução do Código de Confirmação (Modalidade A ou B)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [clientId, setClientId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+244 923 000 000');
  const [sellerId, setSellerId] = useState('');
  const [storeName, setStoreName] = useState(company?.name || 'NEUROJUS Luanda Centro');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentMethodAgreed, setPaymentMethodAgreed] = useState<string>('multicaixa_express');
  const [terms, setTerms] = useState('');
  const [autoReminderEnabled, setAutoReminderEnabled] = useState<boolean>(true);
  const [guaranteeType, setGuaranteeType] = useState('Acordo Verbal');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');

  // Products Table (Section 2 of prompt)
  const [items, setItems] = useState<Array<{ id: string; description: string; quantity: number; unitPrice: number }>>([
    { id: '1', description: 'Arroz 25 kg', quantity: 2, unitPrice: 15000 },
    { id: '2', description: 'Óleo alimentar', quantity: 2, unitPrice: 5000 },
    { id: '3', description: 'Açúcar 5 kg', quantity: 2, unitPrice: 5000 }
  ]);

  // SMS Verification State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [smsStatus, setSmsStatus] = useState<string>('');
  const [smsMessage, setSmsMessage] = useState<string>('');
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [whatsappSentStatus, setWhatsappSentStatus] = useState<boolean>(false);
  const [isSendingSMS, setIsSendingSMS] = useState<boolean>(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Code input mode: Modalidade A (Pessoal pelo cliente) vs Modalidade B (Assistida pelo funcionário)
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('pessoal');
  const [assistedConsentGiven, setAssistedConsentGiven] = useState<boolean>(false);
  
  // 6 digit code input
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer & Attempts
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300); // 5 minutes
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  // Initialize defaults on modal open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      const today = new Date();
      setIssueDate(today.toISOString().slice(0, 10));

      // 15 days default payment term
      const due15 = new Date();
      due15.setDate(due15.getDate() + 15);
      setDueDate(due15.toISOString().slice(0, 10));

      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      setInvoiceNumber(`FT 2026/${randomSeq}`);

      if (currentUser?.role === 'vendedor') {
        const matchingSeller = sellers.find(s => s.id === currentUser.id || s.name === currentUser.name);
        setSellerId(matchingSeller?.id || currentUser.id);
      } else if (sellers.length > 0 && !sellerId) {
        setSellerId(sellers[0].id);
      } else if (!sellerId && currentUser) {
        setSellerId(currentUser.id);
      }
      if (company?.name) {
        setStoreName(company.name);
      }
      setSessionId(null);
      setSessionToken(null);
      setSandboxCode(null);
      setGeneratedCode('');
      setWhatsappSentStatus(false);
      setErrorMessage(null);
      setCodeDigits(['', '', '', '', '', '']);
      setSecondsRemaining(300);
      setAttemptsRemaining(5);
      setIsExpired(false);
      setIsBlocked(false);
    }
  }, [isOpen, sellers, company, currentUser]);

  // Timer countdown
  useEffect(() => {
    if (currentStep === 3 && secondsRemaining > 0 && !isExpired && !isBlocked) {
      const timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            setIsExpired(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStep, secondsRemaining, isExpired, isBlocked]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Selected client autofill
  const handleSelectClient = (id: string) => {
    setClientId(id);
    const selected = clients.find(c => c.id === id);
    if (selected) {
      setCustomerName(selected.name);
      setCustomerPhone(selected.phone);
    }
  };

  // Quick due date helpers
  const handleQuickDueDate = (days: number) => {
    const base = issueDate ? new Date(issueDate) : new Date();
    base.setDate(base.getDate() + days);
    setDueDate(base.toISOString().slice(0, 10));
  };

  const handleEndOfMonth = () => {
    const base = issueDate ? new Date(issueDate) : new Date();
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    setDueDate(end.toISOString().slice(0, 10));
  };

  // Items table calculations
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const totalCalculated = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unitPrice) || 0;
    return sum + (q * p);
  }, 0);

  // Masked phone formatting for quick preview (e.g., +244 923 ••• •20)
  const getLocalMaskedPhone = (phone: string) => {
    const clean = phone.replace(/\s+/g, '');
    if (clean.length < 7) return phone;
    const start = clean.slice(0, Math.min(7, clean.length - 4));
    const end = clean.slice(-2);
    return `${start} ••• •${end}`;
  };

  // Step 1 Validation & Proceed to Step 2 (Conferência)
  const handleProceedToReview = () => {
    setErrorMessage(null);
    if (!customerName.trim()) {
      setErrorMessage('Por favor, indique o nome completo do cliente.');
      return;
    }
    const digitsOnly = customerPhone.replace(/\D/g, '');
    if (digitsOnly.length < 9) {
      setErrorMessage('Por favor, indique um número de telefone angolano válido (mínimo 9 dígitos).');
      return;
    }
    if (!sellerId) {
      setErrorMessage('Por favor, selecione o funcionário/vendedor responsável.');
      return;
    }
    if (!dueDate) {
      setErrorMessage('A data limite de pagamento (prazo da dívida) é obrigatória.');
      return;
    }
    if (totalCalculated <= 0) {
      setErrorMessage('O valor total da dívida deve ser superior a 0 Kz. Adicione produtos com quantidade e preço.');
      return;
    }

    setMaskedPhone(getLocalMaskedPhone(customerPhone));
    setCurrentStep(2);
  };

  // Step 2: Trigger SMS dispatch via real backend
  const handleSendConfirmationSMS = async () => {
    setIsSendingSMS(true);
    setErrorMessage(null);
    setWarningMessage(null);

    const debtItems: DebtItem[] = items.map(item => ({
      id: item.id,
      description: item.description.trim() || 'Mercadoria Comercial a Crédito',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    try {
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session) throw new Error('Sessão expirada. Inicie sessão novamente.');
      const resp = await fetch('/api/sms/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          storeName: storeName.trim(),
          totalAmount: totalCalculated,
          items: debtItems,
          invoiceNumber: invoiceNumber.trim(),
          sellerName: sellers.find(s => s.id === sellerId)?.name || 'Operador',
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Falha ao processar envio de código SMS.');
      }

      const returnedCode = data.verificationCode || data.sandboxTestCode || '';
      setGeneratedCode(returnedCode);
      setSandboxCode(returnedCode);
      setSessionId(data.sessionId);
      setSessionToken(data.sessionToken || null);
      setMaskedPhone(data.maskedPhone || getLocalMaskedPhone(customerPhone));
      setSmsStatus(data.smsStatus);
      setSmsMessage(data.message);
      setSecondsRemaining(data.expiresInSeconds || 300);
      setAttemptsRemaining(5);
      setIsExpired(false);
      setIsBlocked(false);
      setResendCooldown(30);
      setCodeDigits(['', '', '', '', '', '']);

      if (data.warning) {
        setWarningMessage(data.warning);
      }

      setCurrentStep(3);
      // Auto-focus first digit input after entering step 3
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação ao enviar código.');
    } finally {
      setIsSendingSMS(false);
    }
  };

  // Step 2 & 3: Disparo manual via WhatsApp do cliente cadastrado com código idêntico
  const handleSendCodeViaWhatsApp = async () => {
    setIsSendingSMS(true);
    setErrorMessage(null);
    let codeToUse: string = generatedCode || sandboxCode || '';

    try {
      if (!codeToUse) {
        const debtItems: DebtItem[] = items.map(item => ({
          id: item.id,
          description: item.description.trim() || 'Mercadoria Comercial a Crédito',
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
        }));

        const { data: authSession } = await supabase.auth.getSession();
        if (!authSession.session) throw new Error('Sessão expirada. Inicie sessão novamente.');
        const resp = await fetch('/api/sms/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
          body: JSON.stringify({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            storeName: storeName.trim(),
            totalAmount: totalCalculated,
            items: debtItems,
            invoiceNumber: invoiceNumber.trim(),
            sellerName: sellers.find(s => s.id === sellerId)?.name || 'Operador',
          }),
        });
        const data = await resp.json();
        codeToUse = String(data.verificationCode || data.sandboxTestCode || Math.floor(100000 + Math.random() * 900000));
        setSessionId(data.sessionId);
        setSessionToken(data.sessionToken || null);
        setMaskedPhone(data.maskedPhone || getLocalMaskedPhone(customerPhone));
        setGeneratedCode(codeToUse);
        setSandboxCode(codeToUse);
        setSecondsRemaining(data.expiresInSeconds || 300);
      }
    } catch {
      if (!codeToUse) {
        codeToUse = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(codeToUse);
      }
    } finally {
      setIsSendingSMS(false);
    }

    const sellerNameObj = sellers.find(s => s.id === sellerId)?.name || 'Vendedor Comercial';
    const store = storeName || company?.name || 'NEUROJUS';
    const totalFmt = formatKwanza(totalCalculated);
    const invoiceNum = invoiceNumber.trim() || 'FT 2026';

    const itemsSummary = items
      .map(it => `• ${it.description || 'Produto'} (${it.quantity} un) - ${formatKwanza((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))}`)
      .join('\n');

    const message = 
`*NEUROJUS · CONFIRMAÇÃO DE COMPRA A CRÉDITO*
Olá, *${customerName.trim()}*!

Foi registada uma compra a crédito na loja *${store}* com o funcionário *${sellerNameObj}*.

💰 *Valor Total da Dívida:* *${totalFmt}*
📅 *Data Limite de Pagamento:* *${dueDate}*
📄 *Fatura:* ${invoiceNum}

🔐 *O SEU CÓDIGO DE CONFIRMAÇÃO É:* *${codeToUse}*
_Este código consta oficialmente no seu Recibo da NEUROJUS para reconhecimento da dívida._

📦 *Produtos Adquiridos:*
${itemsSummary}

*NEUROJUS Angola* · Rigor, Excelência e Inovação`;

    let cleanPhone = customerPhone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
    if (cleanPhone.length === 9 && (cleanPhone.startsWith('9') || cleanPhone.startsWith('2'))) {
      cleanPhone = `244${cleanPhone}`;
    }

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    setWhatsappSentStatus(true);
    setCurrentStep(3);
  };

  // Preenchimento com 1 clique do código gerado no ecrã
  const handleAutofillCode = () => {
    const code = generatedCode || sandboxCode;
    if (!code || code.length !== 6) return;
    setCodeDigits(code.split(''));
  };

  // Gravação Direta / Opcional sem validação rígida de código
  const handleSkipVerificationAndSave = () => {
    const debtItems: DebtItem[] = items.map(item => ({
      id: item.id,
      description: item.description.trim() || 'Mercadoria Comercial a Crédito',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    const finalCode = generatedCode || sandboxCode || undefined;

    onSave({
      invoiceNumber: invoiceNumber.trim() || `FT 2026/${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: clientId || `cli-quick-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      sellerId,
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      dueDate,
      totalAmount: totalCalculated,
      items: debtItems,
      status: 'aberta',
      paymentMethodAgreed,
      terms,
      guaranteeType,
      guarantorName: guarantorName.trim() || undefined,
      guarantorPhone: guarantorPhone.trim() || undefined,
      autoReminderEnabled,
      reminder5DaysSent: false,
      confirmationStatus: finalCode ? 'confirmada' : 'sem_sms',
      confirmationMode,
      confirmationCode: finalCode,
      confirmedAt: new Date().toISOString(),
      confirmationTransactionId: finalCode ? `TX-NJ-${finalCode}` : undefined,
      smsStatus: 'pendente',
      whatsappSent: whatsappSentStatus,
    });

    onClose();
  };

  // Handle individual digit input
  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = char;
    setCodeDigits(newDigits);

    // Auto-focus next input
    if (char && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteCode = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setCodeDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    digitInputRefs.current[nextIdx]?.focus();
  };

  const fullEnteredCode = codeDigits.join('');

  // Step 3: Verify code with backend and finalize credit registration
  const handleVerifyAndFinalize = async () => {
    if (fullEnteredCode.length !== 6) {
      setErrorMessage('Por favor, introduza os 6 dígitos do código de confirmação.');
      return;
    }

    if (confirmationMode === 'assistida' && !assistedConsentGiven) {
      setErrorMessage('Na modalidade assistida, é obrigatório confirmar que o cliente autorizou a introdução do código.');
      return;
    }

    if (!sessionId) {
      setErrorMessage('Sessão de confirmação inválida. Reenvie o código SMS.');
      return;
    }

    setIsVerifyingCode(true);
    setErrorMessage(null);

    try {
      const resp = await fetch('/api/sms/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionToken,
          code: fullEnteredCode,
          confirmationMode,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data.isBlocked) {
          setIsBlocked(true);
        }
        if (data.isExpired) {
          setIsExpired(true);
        }
        if (typeof data.attemptsRemaining === 'number') {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        throw new Error(data.error || 'Código de confirmação incorreto.');
      }

      // Successful verification! Assemble debt object with full audit trail and signatures
      const debtItems: DebtItem[] = items.map(item => ({
        id: item.id,
        description: item.description.trim() || 'Mercadoria Comercial a Crédito',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
      }));

      const auditTrail: AuditEntry[] = [
        {
          timestamp: new Date().toISOString(),
          action: 'Operação iniciada e código SMS gerado',
          performedBy: sellers.find(s => s.id === sellerId)?.name || 'Vendedor',
          details: `Código enviado para o número ${maskedPhone} da loja ${storeName}`
        },
        {
          timestamp: data.confirmedAt || new Date().toISOString(),
          action: 'Dívida formalmente confirmada pelo cliente',
          performedBy: confirmationMode === 'pessoal' ? 'Cliente (Pessoal no Ecrã)' : 'Operador (Assistido com Consentimento)',
          details: `Transação ${data.transactionId} validada por SMS`
        }
      ];

      onSave({
        invoiceNumber: invoiceNumber.trim() || `FT 2026/${Math.floor(1000 + Math.random() * 9000)}`,
        clientId: clientId || `cli-quick-${Date.now()}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        sellerId,
        issueDate: issueDate || new Date().toISOString().slice(0, 10),
        dueDate,
        totalAmount: totalCalculated,
        items: debtItems,
        status: 'aberta',
        paymentMethodAgreed,
        terms,
        guaranteeType,
        guarantorName: guarantorName.trim() || undefined,
        guarantorPhone: guarantorPhone.trim() || undefined,
        autoReminderEnabled,
        reminder5DaysSent: false,
        // NEUROJUS Confirmation fields
        confirmationStatus: 'confirmada',
        confirmationMode,
        confirmationCode: fullEnteredCode || generatedCode || sandboxCode || undefined,
        whatsappSent: whatsappSentStatus,
        whatsappSentAt: whatsappSentStatus ? new Date().toISOString() : undefined,
        confirmedAt: data.confirmedAt,
        confirmationTransactionId: data.transactionId,
        smsStatus: smsStatus === 'sent' ? 'enviado' : 'nao_configurado',
        smsSentAt: new Date().toISOString(),
        smsMaskedPhone: maskedPhone,
        verificationQrCode: data.qrVerificationUrl,
        auditTrail,
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Código de confirmação inválido.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Fallback direct registration without SMS (for business continuity if customer has no phone available)
  const handleDirectRegistrationWithoutSMS = () => {
    if (!customerName.trim() || !dueDate || totalCalculated <= 0) {
      alert('Preencha os dados obrigatórios antes de gravar.');
      return;
    }

    const debtItems: DebtItem[] = items.map(item => ({
      id: item.id,
      description: item.description.trim() || 'Mercadoria Comercial a Crédito',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    onSave({
      invoiceNumber: invoiceNumber.trim() || `FT 2026/${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: clientId || `cli-quick-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      sellerId,
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      dueDate,
      totalAmount: totalCalculated,
      items: debtItems,
      status: 'aberta',
      paymentMethodAgreed,
      terms,
      guaranteeType,
      guarantorName: guarantorName.trim() || undefined,
      guarantorPhone: guarantorPhone.trim() || undefined,
      autoReminderEnabled,
      reminder5DaysSent: false,
      confirmationStatus: 'sem_sms',
    });

    onClose();
  };

  const sellerNameSelected = sellers.find(s => s.id === sellerId)?.name || 'Vendedor Comercial';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 px-2 py-0.5 bg-white border border-slate-700 rounded-lg flex items-center justify-center shrink-0">
              <img 
                src={company?.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                alt="Logomarca Oficial NEUROJUS" 
                className="h-8 max-w-[130px] sm:max-w-[150px] object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  NEUROJUS · Registo de Compra a Crédito
                </h2>
                <span className="text-[11px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                  Comprovativo Digital & SMS
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Registo de produtos, prazo de pagamento, confirmação por SMS e emissão de comprovativo com QR Code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 1 ? 'bg-amber-600 text-white' : currentStep > 1 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}>
              1
            </span>
            <span className={currentStep === 1 ? 'text-slate-900' : 'text-slate-500'}>
              Produtos & Cliente
            </span>
          </div>

          <div className="w-8 h-px bg-slate-300"></div>

          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 2 ? 'bg-amber-600 text-white' : currentStep > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}>
              2
            </span>
            <span className={currentStep === 2 ? 'text-slate-900' : 'text-slate-500'}>
              Conferência & Envio SMS
            </span>
          </div>

          <div className="w-8 h-px bg-slate-300"></div>

          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 3 ? 'bg-amber-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}>
              3
            </span>
            <span className={currentStep === 3 ? 'text-slate-900' : 'text-slate-500'}>
              Validação do Código
            </span>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {warningMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>{warningMessage}</div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 1: REGISTO DE PRODUTOS, CLIENTE, VENDEDOR E PRAZO */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Secção de Identificação: Cliente e Loja */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-amber-600" />
                    Identificação do Cliente & Contacto SMS (+244)
                  </span>
                  <button
                    type="button"
                    onClick={onOpenNewClient}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                  >
                    + Cadastrar Novo Cliente
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cliente Registado (opcional)
                    </label>
                    <select
                      value={clientId}
                      onChange={e => handleSelectClient(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Introduzir manualmente --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Completo do Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Ex: Manuel Domingos da Silva"
                      className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Número de Telefone / WhatsApp (+244) *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Receberá o SMS de confirmação e alertas prévios aos 5 dias
                    </span>
                  </div>
                </div>

                {/* Loja e Funcionário Responsável */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Loja / Estabelecimento Comercial
                    </label>
                    <div className="relative">
                      <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={storeName}
                        onChange={e => setStoreName(e.target.value)}
                        placeholder="Ex: NEUROJUS Luanda Centro"
                        className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Funcionário / Vendedor Responsável *
                    </label>
                    {currentUser?.role === 'vendedor' ? (
                      <div className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-semibold flex items-center justify-between">
                        <span>{sellers.find(s => s.id === sellerId)?.name || currentUser.name}</span>
                        <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md font-mono">
                          Bloqueado (Sua Sessão)
                        </span>
                      </div>
                    ) : (
                      <select
                        value={sellerId}
                        onChange={e => setSellerId(e.target.value)}
                        className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                      >
                        {sellers.length === 0 ? (
                          <option value={currentUser?.id || 'usr-admin-1'}>
                            {currentUser?.name || 'Administrador Geral'} (Operador Atual)
                          </option>
                        ) : (
                          sellers.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.branch})
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Secção 2: Discriminação Detalhada dos Produtos Adquiridos */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-amber-600" />
                      Discriminação dos Produtos Adquiridos a Crédito
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Adicione todos os artigos da compra. Subtotais e total são calculados automaticamente.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Produto</span>
                  </button>
                </div>

                {/* Tabela de Produtos */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Nome ou Descrição do Produto</th>
                        <th className="py-2.5 px-3 text-center w-24">Quantidade</th>
                        <th className="py-2.5 px-3 text-right w-36">Preço Unitário (Kz)</th>
                        <th className="py-2.5 px-3 text-right w-36">Subtotal</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, index) => {
                        const q = Number(item.quantity) || 0;
                        const p = Number(item.unitPrice) || 0;
                        const subtotal = q * p;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Ex: Arroz 25 kg, Óleo alimentar..."
                                value={item.description}
                                onChange={e => handleItemChange(index, 'description', e.target.value)}
                                className="w-full py-1.5 px-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                                className="w-full py-1.5 px-2 text-xs text-center border border-slate-300 rounded font-mono focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={item.unitPrice || ''}
                                onChange={e => handleItemChange(index, 'unitPrice', e.target.value)}
                                className="w-full py-1.5 px-2 text-xs text-right border border-slate-300 rounded font-mono focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900" data-tabular>
                              {formatKwanza(subtotal)}
                            </td>
                            <td className="p-2 text-center">
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeItemRow(index)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  title="Remover linha"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bloco de Total Dinâmico em Kz */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold">{items.length} {items.length === 1 ? 'produto registado' : 'produtos registados'}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-[11px] text-slate-500">Subtotal = Quantidade × Preço unitário</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                      TOTAL DA DÍVIDA (A CRÉDITO)
                    </span>
                    <span className="text-lg font-black font-mono text-slate-900" data-tabular>
                      {formatKwanza(totalCalculated)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Secção 3: Prazos e Condições Contratuais */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-rose-600" />
                  Data Limite de Pagamento & Prazos
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data de Emissão da Fatura
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={e => setIssueDate(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center justify-between">
                      <span>DATA LIMITE DE PAGAMENTO (PRAZO) *</span>
                      <span className="text-[10px] font-normal text-slate-500">Obrigatório</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full py-2 px-3 text-xs border-2 border-rose-300 bg-white rounded-lg font-mono font-bold text-rose-900 focus:ring-2 focus:ring-rose-500"
                    />
                    {/* Atalhos Rápidos de Prazo */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-500">Atalhos:</span>
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate(7)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded"
                      >
                        +7 dias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate(15)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded"
                      >
                        +15 dias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDueDate(30)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded"
                      >
                        +30 dias
                      </button>
                      <button
                        type="button"
                        onClick={handleEndOfMonth}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded"
                      >
                        Fim do mês
                      </button>
                    </div>
                  </div>
                </div>

                {/* Alerta de 5 dias preventivo */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      Alerta Preventivo Automático aos 5 Dias
                    </span>
                    <p className="text-[11px] text-slate-500">
                      O sistema emitirá notificação no WhatsApp / SMS para o número {customerPhone} exatamente 5 dias antes da data limite.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoReminderEnabled}
                    onChange={e => setAutoReminderEnabled(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                </div>

                {/* Método e Garantia */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Método de Pagamento Acordado
                    </label>
                    <select
                      value={paymentMethodAgreed}
                      onChange={e => setPaymentMethodAgreed(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="multicaixa_express">Multicaixa Express</option>
                      <option value="transferencia_bancaria">Transferência Bancária (IBAN)</option>
                      <option value="tpa">TPA / Multicaixa Presencial</option>
                      <option value="dinheiro">Dinheiro Vivo (Cash)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipo de Garantia / Acordo
                    </label>
                    <select
                      value={guaranteeType}
                      onChange={e => setGuaranteeType(e.target.value)}
                      className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Confirmação por SMS com Comprovativo Digital">
                        Confirmação por SMS com Comprovativo Digital (Recomendado)
                      </option>
                      <option value="Termo de Confissão de Dívida">Termo de Confissão de Dívida</option>
                      <option value="Acordo Verbal de Confiança">Acordo Verbal de Confiança</option>
                      <option value="Fiador Pessoal">Fiador Pessoal</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: CONFERÊNCIA DA COMPRA PELO CLIENTE & ENVIO DE CÓDIGO SMS */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Ecrã de Conferência Oficial ao Cliente */}
              <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 pb-4 gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-white border border-slate-200 rounded-lg shadow-xs shrink-0">
                      <img 
                        src={company?.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                        alt="Logomarca Oficial NEUROJUS" 
                        className="h-10 max-w-[170px] object-contain"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-teal-800 block">
                        Sistema NEUROJUS Angola
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                        CONFIRMAÇÃO DE COMPRA A CRÉDITO
                      </h3>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 sm:text-right">
                    <span>Apresente este ecrã ao cliente para validação antes do envio por SMS</span>
                  </div>
                </div>

                {/* Dados da Operação */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Nome do Cliente:</span>
                    <strong className="text-slate-900 text-sm">{customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Loja:</span>
                    <strong className="text-slate-900">{storeName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Data da Operação:</span>
                    <strong className="text-slate-900">{issueDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Funcionário Responsável:</span>
                    <strong className="text-slate-900">{sellerNameSelected}</strong>
                  </div>
                </div>

                {/* Tabela de Produtos para o Cliente */}
                <div>
                  <span className="text-xs font-bold text-slate-800 block mb-2">
                    Produtos Adquiridos:
                  </span>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-left">Produto</th>
                          <th className="py-2 px-3 text-center w-20">Qtd</th>
                          <th className="py-2 px-3 text-right w-28">Preço Unitário</th>
                          <th className="py-2 px-3 text-right w-28">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(item => {
                          const q = Number(item.quantity) || 0;
                          const p = Number(item.unitPrice) || 0;
                          return (
                            <tr key={item.id}>
                              <td className="py-2 px-3 text-slate-800 font-medium">{item.description}</td>
                              <td className="py-2 px-3 text-center font-mono">{q}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatKwanza(p)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatKwanza(q * p)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Valor Total Destacado */}
                <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                      VALOR TOTAL DA DÍVIDA
                    </span>
                    <div className="text-2xl font-black font-mono text-amber-400" data-tabular>
                      {formatKwanza(totalCalculated)}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">
                      Prazo Limite:
                    </span>
                    <span className="text-sm font-bold font-mono text-white">
                      {dueDate}
                    </span>
                  </div>
                </div>

                {/* Verificação do Número Parcialmente Oculto */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-5 h-5 text-amber-700" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Destinatário do Código SMS:
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-900">
                        {maskedPhone}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    Confirme com o cliente se este é o número correto (+244)
                  </span>
                </div>

                {/* Opções de Envio e Confirmação Opcional */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 block">
                      Escolha como Deseja Confirmar ou Gravar a Dívida:
                    </span>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      O envio do código é opcional
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Opção 1: SMS Tradicional */}
                    <button
                      type="button"
                      disabled={isSendingSMS}
                      onClick={handleSendConfirmationSMS}
                      className="p-3 text-left border border-amber-300 hover:border-amber-500 bg-amber-50/60 hover:bg-amber-100/60 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 mb-0.5">
                        <Send className="w-3.5 h-3.5 text-amber-700" />
                        <span>1. Enviar por SMS</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Dispara SMS com código de 6 dígitos para o terminal do cliente.
                      </p>
                    </button>

                    {/* Opção 2: WhatsApp Manual */}
                    <button
                      type="button"
                      disabled={isSendingSMS}
                      onClick={handleSendCodeViaWhatsApp}
                      className="p-3 text-left border border-emerald-300 hover:border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100/60 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900 mb-0.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                        <span>2. Enviar via WhatsApp</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Abre o WhatsApp com o resumo e o mesmo código do recibo.
                      </p>
                    </button>

                    {/* Opção 3: Gravação Direta Opcional */}
                    <button
                      type="button"
                      onClick={handleDirectRegistrationWithoutSMS}
                      className="p-3 text-left border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 mb-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>3. Gravar sem Código</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Grava a dívida diretamente sem exigir envio ou validação prévia.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="text-center text-xs text-slate-600 font-medium">
                  Estado atual: <span className="text-amber-800 font-bold">Aguardando confirmação do cliente ou envio de código</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: INTRODUÇÃO DO CÓDIGO PELO CLIENTE (MODALIDADE A E B) */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Notificação de Envio Real / Sandbox com o Código no Ecrã */}
              <div className="p-4 bg-linear-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center font-mono font-black text-xl shadow-md shrink-0">
                    🔑
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                        Código no Ecrã & no Recibo Oficial
                      </span>
                      <span className="text-xs text-slate-500">Exato mesmo código</span>
                    </div>
                    <div className="text-2xl font-black font-mono tracking-widest text-slate-900 mt-0.5 flex items-center gap-2">
                      <span>{generatedCode || sandboxCode || '123456'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Este código aparece no ecrã, no recibo impresso/PDF e pode ser enviado por WhatsApp ao cliente (+244).
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutofillCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shadow-xs"
                    title="Preenche automaticamente os 6 dígitos nas caixas abaixo"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Preencher no Ecrã</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendCodeViaWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
                    title="Reenviar ou partilhar este código pelo WhatsApp do cliente"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Enviar via WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Informação de entrega */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 text-slate-700">
                  <div className="font-semibold text-slate-900">
                    {smsMessage || 'Código gerado com sucesso para esta operação.'}
                  </div>
                  <div>
                    Destinatário registado: <strong>{maskedPhone}</strong> (Nome: <strong>{customerName}</strong>)
                  </div>
                </div>
              </div>

              {/* Seletor de Modalidade: A (Pessoal) vs B (Assistida) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Selecione a Modalidade de Introdução do Código:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmationMode('pessoal')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      confirmationMode === 'pessoal'
                        ? 'border-amber-600 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Smartphone className={`w-4 h-4 ${confirmationMode === 'pessoal' ? 'text-amber-700' : 'text-slate-500'}`} />
                      <strong className="text-xs text-slate-900">Modalidade A: Introdução Pessoal</strong>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      O cliente introduz diretamente o código de 6 dígitos no ecrã (computador, tablet ou telemóvel).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmationMode('assistida')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      confirmationMode === 'assistida'
                        ? 'border-amber-600 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserCheck className={`w-4 h-4 ${confirmationMode === 'assistida' ? 'text-amber-700' : 'text-slate-500'}`} />
                      <strong className="text-xs text-slate-900">Modalidade B: Introdução Assistida</strong>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      O cliente dita verbalmente o código recebido ao funcionário, com declaração de consentimento.
                    </p>
                  </button>
                </div>
              </div>

              {/* Declaração obrigatória para Modalidade B */}
              {confirmationMode === 'assistida' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="assistedConsent"
                      checked={assistedConsentGiven}
                      onChange={e => setAssistedConsentGiven(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    <label htmlFor="assistedConsent" className="font-semibold text-slate-900">
                      Declaração de Consentimento Verbal do Cliente
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-700 pl-6">
                    "Declaro que o(a) cliente <strong>{customerName}</strong> esteve presente, conferiu o valor de <strong>{formatKwanza(totalCalculated)}</strong> e autorizou expressamente a introdução assistida do código SMS recebido no seu terminal."
                  </p>
                </div>
              )}

              {/* Painel do Código de 6 Dígitos com Temporizador e Tentativas */}
              <div className="border-2 border-slate-200 rounded-2xl p-6 text-center space-y-5 bg-white">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Validação Criptográfica de 6 Dígitos
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">
                    Introduza o Código Enviado por SMS
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Código válido por 5 minutos · Máximo de 5 tentativas de confirmação
                  </p>
                </div>

                {/* 6 Digit Input Boxes */}
                <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePasteCode}>
                  {codeDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => {
                        digitInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      disabled={isExpired || isBlocked}
                      value={digit}
                      onChange={e => handleDigitChange(idx, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(idx, e)}
                      className={`w-11 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-mono font-black border-2 rounded-xl focus:outline-none transition-all ${
                        isBlocked
                          ? 'border-rose-300 bg-rose-50 text-rose-700 cursor-not-allowed'
                          : isExpired
                          ? 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : digit
                          ? 'border-amber-600 bg-amber-50/50 text-slate-900 shadow-xs'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                      }`}
                    />
                  ))}
                </div>

                {/* Status Bar: Tempo Restante & Tentativas */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-xs pt-2">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Clock className={`w-4 h-4 ${secondsRemaining < 60 ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
                    <span>Tempo restante: </span>
                    <strong className={`font-mono text-sm ${secondsRemaining < 60 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
                    </strong>
                  </div>

                  <div className="w-px h-4 bg-slate-300"></div>

                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>Tentativas restantes: </span>
                    <strong className={`font-mono text-sm ${attemptsRemaining <= 2 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {attemptsRemaining} de 5
                    </strong>
                  </div>
                </div>

                {/* Mensagens de Bloqueio ou Expiração */}
                {isBlocked && (
                  <div className="p-3 bg-rose-100 text-rose-900 rounded-xl text-xs font-semibold">
                    🚫 Tentativas esgotadas por motivos de segurança. É necessário gerar um novo código SMS.
                  </div>
                )}

                {isExpired && !isBlocked && (
                  <div className="p-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold">
                    ⏳ O código de 5 minutos expirou. Clique em "Reenviar Novo Código SMS" para continuar.
                  </div>
                )}

                {/* Botão de Reenvio com Cooldown */}
                <div>
                  <button
                    type="button"
                    disabled={isSendingSMS || resendCooldown > 0}
                    onClick={handleSendConfirmationSMS}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 disabled:text-slate-400 py-1 px-3 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {resendCooldown > 0
                        ? `Aguarde ${resendCooldown}s para reenviar SMS`
                        : 'Reenviar Novo Código SMS'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev === 3 ? 2 : 1))}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            )}

            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleDirectRegistrationWithoutSMS}
                className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                title="Registar sem código SMS se o cliente estiver sem telemóvel"
              >
                Registo Direto (Sem confirmação SMS)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>

            {/* Step 1: Avançar para Conferência */}
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleProceedToReview}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
                <span>Conferir Compra & Resumo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Step 2: Opções de Envio e Gravação Opcional */}
            {currentStep === 2 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectRegistrationWithoutSMS}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Grava a dívida diretamente sem envio de código"
                >
                  Gravar sem Código (Opcional)
                </button>

                <button
                  type="button"
                  disabled={isSendingSMS}
                  onClick={handleSendCodeViaWhatsApp}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  title="Abre o WhatsApp com o resumo e o código"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Enviar via WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={isSendingSMS}
                  onClick={handleSendConfirmationSMS}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-md transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingSMS ? 'A Enviar SMS...' : 'ENVIAR POR SMS'}</span>
                </button>
              </div>
            )}

            {/* Step 3: Validar Código ou Gravar sem Validar (Opcional) */}
            {currentStep === 3 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSkipVerificationAndSave}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Grava a dívida com o código associado sem obrigar à digitação dos 6 dígitos"
                >
                  Gravar sem Validar (Opcional)
                </button>

                <button
                  type="button"
                  disabled={isVerifyingCode || fullEnteredCode.length !== 6 || isExpired || isBlocked}
                  onClick={handleVerifyAndFinalize}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-md transition-all disabled:opacity-50"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>
                    {isVerifyingCode ? 'A Validar Código...' : 'Confirmar & Emitir Comprovativo'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
