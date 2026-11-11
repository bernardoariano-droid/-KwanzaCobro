/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Debt, Client, Seller, CompanySettings, Payment, AuthUser, DebtStatus, AuditEntry } from './types/debt';
import { 
  initialDebts, 
  initialClients, 
  initialSellers, 
  initialCompanySettings,
  defaultAdminUser,
  demoDebts,
  demoClients,
  demoSellers
} from './data/initialData';
import { LoginPage } from './components/LoginPage';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './components/DashboardView';
import { DebtsListView } from './components/DebtsListView';
import { ClientsView } from './components/ClientsView';
import { PaymentsView } from './components/PaymentsView';
import { DigitalReceiptsView } from './components/DigitalReceiptsView';
import { NotificationsView } from './components/NotificationsView';
import { FinancialReportsView } from './components/FinancialReportsView';
import { AuditTrailView } from './components/AuditTrailView';
import { SellersView } from './components/SellersView';
import { CompanySettingsView } from './components/CompanySettingsModal';
import { NewDebtModal } from './components/NewDebtModal';
import { PaymentModal } from './components/PaymentModal';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  CreditCard, 
  Menu 
} from 'lucide-react';
import { WhatsAppBillingModal } from './components/WhatsAppBillingModal';
import { DebtDetailModal } from './components/DebtDetailModal';
import { ReceiptPrintView } from './components/ReceiptPrintView';
import { NewClientModal } from './components/NewClientModal';
import { AutoReminderModal } from './components/AutoReminderModal';
import { AutomaticReceiptModal } from './components/AutomaticReceiptModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { downloadDebtReceiptPDF } from './utils/pdfGenerator';
import { getRemainingBalance, getDaysDiff, formatKwanza } from './utils/formatters';
import { useLanguage } from './i18n/LanguageContext';

const STORAGE_KEY_DEBTS = 'kwanzacobro_debts_v2';
const STORAGE_KEY_CLIENTS = 'kwanzacobro_clients_v2';
const STORAGE_KEY_SELLERS = 'kwanzacobro_sellers_v2';
const STORAGE_KEY_COMPANY = 'kwanzacobro_company_v2';
const STORAGE_KEY_AUTH = 'kwanzacobro_auth_session_v2';

export default function App() {
  const { t } = useLanguage();
  // Estado de Autenticação com Persistência de Sessão
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    } catch (e) {
      console.error('Erro ao guardar sessão de autenticação', e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch (e) {
      console.error('Erro ao terminar sessão', e);
    }
    setActiveTab('dashboard');
  };

  // Estado Principal com Persistência em LocalStorage
  const [debts, setDebts] = useState<Debt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DEBTS);
      return saved ? JSON.parse(saved) : initialDebts;
    } catch {
      return initialDebts;
    }
  });

  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENTS);
      return saved ? JSON.parse(saved) : initialClients;
    } catch {
      return initialClients;
    }
  });

  const [sellers, setSellers] = useState<Seller[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SELLERS);
      return saved ? JSON.parse(saved) : initialSellers;
    } catch {
      return initialSellers;
    }
  });

  const [company, setCompany] = useState<CompanySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.logoUrl) {
          parsed.logoUrl = '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg';
        }
        if (!parsed.name || parsed.name.includes('Comercial & Distribuidora Kwanza')) {
          parsed.name = 'KwanzaCobro - Gestão de Dívidas Empresariais';
        }
        return parsed;
      }
      return initialCompanySettings;
    } catch {
      return initialCompanySettings;
    }
  });

  // Estado de Sincronização com o Backend Localhost e Supabase
  const [isLocalhostSynced, setIsLocalhostSynced] = useState(false);
  const [isSupabaseSynced, setIsSupabaseSynced] = useState(false);
  const [supabaseLatency, setSupabaseLatency] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Carregar dados guardados no servidor Localhost e verificar Supabase ao iniciar a aplicação
  useEffect(() => {
    let isMounted = true;
    const fetchLocalhostData = async () => {
      // 1. Carregar do armazenamento local do servidor
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const json = await res.json();
          if (json.success && isMounted) {
            if (Array.isArray(json.debts)) {
              setDebts(json.debts);
              localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(json.debts));
            }
            if (Array.isArray(json.clients)) {
              setClients(json.clients);
              localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(json.clients));
            }
            if (Array.isArray(json.sellers)) {
              setSellers(json.sellers);
              localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(json.sellers));
            }
            if (json.company && json.company.name) {
              setCompany(json.company);
              localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(json.company));
            }
            setIsLocalhostSynced(true);
            setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
          }
        }
      } catch (err) {
        console.warn('A carregar do armazenamento local offline:', err);
      }

      // 2. Carregar dados diretamente da nuvem Supabase (Tabelas Relacionais: company_settings, sellers, clients, debts)
      try {
        const supPull = await fetch('/api/supabase/pull');
        if (supPull.ok && isMounted) {
          const supPullJson = await supPull.json();
          if (supPullJson.success && supPullJson.hasData) {
            if (Array.isArray(supPullJson.sellers) && supPullJson.sellers.length > 0) {
              setSellers(supPullJson.sellers);
              localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(supPullJson.sellers));
            }
            if (Array.isArray(supPullJson.clients) && supPullJson.clients.length > 0) {
              setClients(supPullJson.clients);
              localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(supPullJson.clients));
            }
            if (Array.isArray(supPullJson.debts) && supPullJson.debts.length > 0) {
              setDebts(supPullJson.debts);
              localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(supPullJson.debts));
            }
            if (supPullJson.company && supPullJson.company.name) {
              setCompany(supPullJson.company);
              localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(supPullJson.company));
            }
            setIsSupabaseSynced(true);
            setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
          }
        }
      } catch (err) {
        console.warn('A carregar dados do Supabase:', err);
      }

      // 3. Testar Supabase Status
      try {
        const supStatus = await fetch('/api/supabase/status');
        if (supStatus.ok && isMounted) {
          const supJson = await supStatus.json();
          if (supJson.connected) {
            setIsSupabaseSynced(true);
            setSupabaseLatency(supJson.latencyMs ?? null);
          }
        }
      } catch {
        // Ignorar em caso de falha de conexão inicial
      }
    };
    fetchLocalhostData();
    return () => { isMounted = false; };
  }, []);

  // Sincronização manual acionada pelo utilizador
  const handleManualSyncNow = async () => {
    setIsManualSyncing(true);
    try {
      // Enviar dados para o Supabase
      await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debts, clients, sellers, company }),
      });
      // Buscar dados atualizados do Supabase
      const pullRes = await fetch('/api/supabase/pull');
      if (pullRes.ok) {
        const pullJson = await pullRes.json();
        if (pullJson.success && pullJson.hasData) {
          if (Array.isArray(pullJson.sellers) && pullJson.sellers.length > 0) {
            setSellers(pullJson.sellers);
            localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(pullJson.sellers));
          }
          if (Array.isArray(pullJson.clients) && pullJson.clients.length > 0) {
            setClients(pullJson.clients);
            localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(pullJson.clients));
          }
          if (Array.isArray(pullJson.debts) && pullJson.debts.length > 0) {
            setDebts(pullJson.debts);
            localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(pullJson.debts));
          }
          if (pullJson.company && pullJson.company.name) {
            setCompany(pullJson.company);
            localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(pullJson.company));
          }
        }
      }
      setIsSupabaseSynced(true);
      setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
    } catch (e) {
      console.warn('Erro na sincronização manual com Supabase:', e);
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Salvar no LocalStorage e sincronizar com o Servidor Localhost sempre que alterar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(debts));
    } catch (e) {
      console.error('Erro ao guardar dívidas no LocalStorage', e);
    }
  }, [debts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
    } catch (e) {
      console.error('Erro ao guardar clientes no LocalStorage', e);
    }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(sellers));
    } catch (e) {
      console.error('Erro ao guardar vendedores no LocalStorage', e);
    }
  }, [sellers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(company));
    } catch (e) {
      console.error('Erro ao guardar configurações da empresa no LocalStorage', e);
    }
  }, [company]);

  // Sincronização automática para o ficheiro de base de dados do Localhost e Supabase
  useEffect(() => {
    const timer = setTimeout(async () => {
      // 1. Sincronização Localhost
      try {
        const res = await fetch('/api/data/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ debts, clients, sellers, company }),
        });
        if (res.ok) {
          setIsLocalhostSynced(true);
          setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
        }
      } catch (err) {
        setIsLocalhostSynced(false);
      }

      // 2. Sincronização Supabase (Nuvem PostgreSQL)
      try {
        const supRes = await fetch('/api/supabase/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ debts, clients, sellers, company }),
        });
        if (supRes.ok) {
          const supJson = await supRes.json();
          if (supJson.synced) {
            setIsSupabaseSynced(true);
          }
        }
      } catch {
        // Falha transitória não interrompe o funcionamento local
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [debts, clients, sellers, company]);

  // Navegação
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [initialDebtsFilter, setInitialDebtsFilter] = useState<string>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modais
  const [isNewDebtOpen, setIsNewDebtOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isAutoReminderOpen, setIsAutoReminderOpen] = useState(false);
  const [newlyCreatedDebtForReceipt, setNewlyCreatedDebtForReceipt] = useState<Debt | null>(null);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<Debt | null>(null);
  const [selectedDebtForWhatsApp, setSelectedDebtForWhatsApp] = useState<Debt | null>(null);
  const [selectedDebtForDetail, setSelectedDebtForDetail] = useState<Debt | null>(null);
  const [printingDebt, setPrintingDebt] = useState<Debt | null>(null);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpen] = useState(false);

  // Helper para buscar cliente e vendedor
  const getClient = (clientId: string) => clients.find(c => c.id === clientId) || null;
  const getSeller = (sellerId: string) => sellers.find(s => s.id === sellerId) || null;

  // Filtragem estrita conforme o perfil do utilizador:
  // VENDEDOR SÓ PODE VER OS SEUS PRÓPRIOS CLIENTES E AS SUAS PRÓPRIAS VENDAS!
  const isSellerRole = currentUser?.role === 'vendedor';

  const visibleDebts = isSellerRole
    ? debts.filter(d => d.sellerId === currentUser?.id || d.sellerId === currentUser?.name)
    : debts;

  const visibleClients = isSellerRole
    ? clients.filter(c => 
        (c.createdBySellerId && c.createdBySellerId === currentUser?.id) ||
        debts.some(d => (d.sellerId === currentUser?.id || d.sellerId === currentUser?.name) && d.clientId === c.id)
      )
    : clients;

  // Contagem de vencidas para o badge no Navbar
  const overdueCount = visibleDebts.filter(d => getRemainingBalance(d) > 0 && getDaysDiff(d.dueDate) > 0).length;

  // Contagem de dívidas que vencem em até 5 dias
  const fiveDaysDebts = visibleDebts.filter(d => {
    const rem = getRemainingBalance(d);
    if (rem <= 0) return false;
    const diff = getDaysDiff(d.dueDate);
    return diff <= 0 && Math.abs(diff) <= (company.daysBeforeDueAlert || 5) && Math.abs(diff) > 0;
  });
  const fiveDaysCount = fiveDaysDebts.length;

  // Handler para marcar lembrete de 5 dias como enviado
  const handleMarkReminderSent = (debtId: string) => {
    const nowStr = new Date().toLocaleDateString('pt-AO') + ' ' + new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
    setDebts(prev =>
      prev.map(d => {
        if (d.id !== debtId) return d;
        return {
          ...d,
          reminder5DaysSent: true,
          reminder5DaysSentAt: nowStr,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleMarkAllRemindersSent = (debtIds: string[]) => {
    const nowStr = new Date().toLocaleDateString('pt-AO') + ' ' + new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
    const setIds = new Set(debtIds);
    setDebts(prev =>
      prev.map(d => {
        if (!setIds.has(d.id)) return d;
        return {
          ...d,
          reminder5DaysSent: true,
          reminder5DaysSentAt: nowStr,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  // Handlers de Ações
  const handleCreateDebt = (newDebtData: Omit<Debt, 'id' | 'payments' | 'createdAt' | 'updatedAt'>) => {
    // 1. Garantir que o cliente existe na lista de clientes (Integridade Referencial com Supabase)
    const clientExists = clients.some(c => c.id === newDebtData.clientId);
    if (!clientExists && newDebtData.clientId) {
      const autoClient: Client = {
        id: newDebtData.clientId,
        name: newDebtData.customerName || 'Cliente Particular',
        nif: '000000000',
        phone: newDebtData.customerPhone || '900000000',
        province: 'Luanda',
        municipality: 'Luanda',
        address: 'Luanda, Angola',
        clientType: 'particular',
        creditLimit: 500000,
        createdBySellerId: newDebtData.sellerId || currentUser?.id,
        createdAt: new Date().toISOString(),
      };
      setClients(prev => {
        const updated = [autoClient, ...prev];
        try {
          localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    const newDebt: Debt = {
      ...newDebtData,
      id: `debt-${Date.now()}`,
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDebts(prev => [newDebt, ...prev]);
    // GERAÇÃO AUTOMÁTICA DO RECIBO EM PDF APÓS GRAVAR!
    setNewlyCreatedDebtForReceipt(newDebt);
  };

  const handleDownloadPDF = (debt: Debt) => {
    downloadDebtReceiptPDF(
      debt,
      getClient(debt.clientId),
      getSeller(debt.sellerId),
      company
    );
  };

  const handleCreatePayment = (
    debtId: string, 
    paymentData: Omit<Payment, 'id'>, 
    sendWhatsApp: boolean
  ) => {
    const sellerName = paymentData.receivedBy?.trim() || currentUser?.name || 'Vendedor Comercial';
    const payment: Payment = {
      ...paymentData,
      id: `pay-${Date.now()}`,
      receivedBy: sellerName,
    };

    setDebts(prev =>
      prev.map(d => {
        if (d.id !== debtId) return d;
        const newPayments = [...d.payments, payment];
        const totalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
        const newRemaining = Math.max(0, d.totalAmount - totalPaid);
        const newStatus: DebtStatus = newRemaining === 0 ? 'liquidada' : d.status;

        const auditAction = newRemaining === 0 
          ? 'Quitação total da dívida confirmada pelo vendedor' 
          : 'Amortização confirmada pelo vendedor (dívida reduzida no sistema)';

        const auditDetail = `Amortização de ${formatKwanza(payment.amount)} recebida via ${payment.paymentMethod.replace('_', ' ')} (Ref: ${payment.receiptRef}). Novo saldo da dívida no sistema: ${formatKwanza(newRemaining)}.`;

        const newAuditEntry = {
          timestamp: new Date().toISOString(),
          action: auditAction,
          performedBy: sellerName,
          details: auditDetail,
        };

        const updatedDebt: Debt = {
          ...d,
          payments: newPayments,
          status: newStatus,
          auditTrail: [newAuditEntry, ...(d.auditTrail || [])],
          updatedAt: new Date().toISOString(),
        };

        if (sendWhatsApp) {
          // Abrir modal de WhatsApp com recibo de quitação/amortização após salvar
          setTimeout(() => {
            setSelectedDebtForWhatsApp(updatedDebt);
          }, 200);
        }

        return updatedDebt;
      })
    );
  };

  const handleUpdateDueDate = (debtId: string, newDueDate: string, reason: string) => {
    setDebts(prev =>
      prev.map(d => {
        if (d.id !== debtId) return d;
        const updatedTerms = reason 
          ? `${d.terms ? `${d.terms}. ` : ''}Reescalonado para ${newDueDate} (Motivo: ${reason})`
          : d.terms;

        return {
          ...d,
          dueDate: newDueDate,
          status: 'acordo',
          terms: updatedTerms,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    // Atualizar no modal de detalhe se estiver aberto
    if (selectedDebtForDetail && selectedDebtForDetail.id === debtId) {
      setSelectedDebtForDetail(prev => prev ? { ...prev, dueDate: newDueDate, status: 'acordo' } : null);
    }
  };

  const handleCreateClient = (newClientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...newClientData,
      id: `cli-${Date.now()}`,
      createdBySellerId: currentUser?.id,
      createdAt: new Date().toISOString(),
    };
    setClients(prev => [...prev, newClient]);
  };

  // Bloqueio de Segurança: Vendedor não tem permissão para aceder a 'sellers' ou 'settings'
  useEffect(() => {
    if (currentUser?.role === 'vendedor' && (activeTab === 'sellers' || activeTab === 'settings')) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  const handleAddSeller = (newSellerData: Omit<Seller, 'id'>) => {
    const newSeller: Seller = {
      ...newSellerData,
      id: `sel-${Date.now()}`,
    };
    setSellers(prev => [...prev, newSeller]);
  };

  const handleDeleteSeller = (sellerId: string) => {
    setSellers(prev => prev.filter(s => s.id !== sellerId));
  };

  const handleRestoreDemoData = () => {
    setDebts(demoDebts);
    setClients(demoClients);
    setSellers(demoSellers);
    setCompany(initialCompanySettings);
    localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(demoDebts));
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(demoClients));
    localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(demoSellers));
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(initialCompanySettings));
    alert('Dados de demonstração restaurados com sucesso!');
  };

  const handleImportAllData = (data: { debts: Debt[]; clients: Client[]; sellers: Seller[]; company: CompanySettings }) => {
    setDebts(data.debts);
    setClients(data.clients);
    setSellers(data.sellers);
    if (data.company) setCompany(data.company);
  };

  // Navegação para dívidas com filtro
  const handleNavigateToDebts = (filter = 'all') => {
    setInitialDebtsFilter(filter);
    setActiveTab('debts');
  };

  // WhatsApp direto de contacto de cliente
  const handleOpenWhatsAppDirect = (phone: string, clientName: string) => {
    const text = `Olá, ${clientName}! Cumprimentos da ${company.name}.`;
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
    const finalPhone = cleanPhone.startsWith('9') ? `244${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Se não estiver autenticado, exibe a Página de Login Corporativa da NEUROJUS
  if (!currentUser) {
    return (
      <LoginPage
        sellers={sellers}
        company={company}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // Se estiver a imprimir um documento
  if (printingDebt) {
    return (
      <ReceiptPrintView
        debt={printingDebt}
        client={getClient(printingDebt.clientId) || undefined}
        seller={getSeller(printingDebt.sellerId) || undefined}
        company={company}
        onBack={() => setPrintingDebt(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar Adaptável para Computador, Tablet e Drawer Móvel */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab);
          setInitialDebtsFilter('all');
        }}
        onOpenNewDebt={() => setIsNewDebtOpen(true)}
        overdueCount={overdueCount}
        fiveDaysCount={fiveDaysCount}
        company={company}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenInstallPWA={() => setIsPWAInstallModalOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Principal de Trabalho */}
      <div className="flex-1 lg:pl-64 sm:lg:pl-72 flex flex-col min-w-0">
        {/* Top Header com Breadcrumb, Busca, Alertas e Trigger Móvel */}
        <TopHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenNewDebt={() => setIsNewDebtOpen(true)}
          overdueCount={overdueCount}
          fiveDaysCount={fiveDaysCount}
          onOpen5DayReminders={() => setIsAutoReminderOpen(true)}
          onOpenInstallPWA={() => setIsPWAInstallModalOpen(true)}
          currentUser={currentUser}
          company={company}
          onManualSync={handleManualSyncNow}
          isSyncing={isManualSyncing}
          isSupabaseConnected={isSupabaseSynced}
          lastSyncTime={lastSyncTime}
        />

        {/* Viewport Principal dos Módulos */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12">
          {activeTab === 'dashboard' && (
            <DashboardView
              debts={debts}
              clients={clients}
              sellers={sellers}
              company={company}
              currentUser={currentUser}
              onNavigateToDebts={handleNavigateToDebts}
              onOpenNewDebt={() => setIsNewDebtOpen(true)}
              onOpenPayment={d => setSelectedDebtForPayment(d)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
              onOpen5DayReminders={() => setIsAutoReminderOpen(true)}
              onOpenInstallPWA={() => setIsPWAInstallModalOpen(true)}
              onOpenNewClient={() => setIsNewClientOpen(true)}
              onNavigateToTab={tab => setActiveTab(tab)}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsView
              clients={clients}
              debts={debts}
              currentUser={currentUser}
              company={company}
              onOpenNewClient={() => setIsNewClientOpen(true)}
              onOpenNewDebtForClient={(clientId) => {
                setIsNewDebtOpen(true);
              }}
              onFilterDebtsByClient={(clientId) => {
                setActiveTab('debts');
              }}
              onOpenWhatsAppDirect={handleOpenWhatsAppDirect}
              onOpenPayment={d => setSelectedDebtForPayment(d)}
            />
          )}

          {activeTab === 'debts' && (
            <DebtsListView
              debts={debts}
              clients={clients}
              sellers={sellers}
              company={company}
              currentUser={currentUser}
              initialFilter={initialDebtsFilter}
              onOpenNewDebt={() => setIsNewDebtOpen(true)}
              onOpenPayment={d => setSelectedDebtForPayment(d)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
              onPrintDebt={d => setPrintingDebt(d)}
              onDownloadPDF={handleDownloadPDF}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsView
              debts={debts}
              clients={clients}
              currentUser={currentUser}
              company={company}
              onOpenPayment={d => setSelectedDebtForPayment(d)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
            />
          )}

          {activeTab === 'receipts' && (
            <DigitalReceiptsView
              debts={debts}
              clients={clients}
              sellers={sellers}
              company={company}
              currentUser={currentUser}
              onPrintDebt={d => setPrintingDebt(d)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
              onDownloadPDF={handleDownloadPDF}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              debts={debts}
              clients={clients}
              company={company}
              currentUser={currentUser}
              onOpen5DayReminders={() => setIsAutoReminderOpen(true)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
            />
          )}

          {activeTab === 'reports' && (
            <FinancialReportsView
              debts={debts}
              clients={clients}
              sellers={sellers}
              company={company}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'audit' && (
            <AuditTrailView
              debts={debts}
              clients={clients}
              currentUser={currentUser}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
            />
          )}

          {activeTab === 'sellers' && currentUser?.role === 'admin' && (
            <SellersView
              sellers={sellers}
              debts={debts}
              currentUser={currentUser}
              onAddSeller={handleAddSeller}
              onDeleteSeller={handleDeleteSeller}
              onFilterDebtsBySeller={(sellerId) => {
                setActiveTab('debts');
              }}
            />
          )}

          {activeTab === 'settings' && currentUser?.role === 'admin' && (
            <CompanySettingsView
              company={company}
              onSaveCompany={setCompany}
              debts={debts}
              clients={clients}
              sellers={sellers}
              onRestoreDemoData={handleRestoreDemoData}
              onImportAllData={handleImportAllData}
            />
          )}

          {activeTab === 'settings' && currentUser?.role !== 'admin' && (
            <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 my-8">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto font-bold text-xl shadow-xs">
                🛡️
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {t('settings.admin_badge', 'Permissão Exclusiva de Administrador Geral')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('settings.admin_notice', 'Apenas o Administrador Geral possui privilégios para alterar a identificação oficial da empresa, NIF, IBAN e número Multicaixa Express.')}
              </p>
              <button
                onClick={() => setActiveTab('debts')}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                {t('common.back', 'Voltar')}
              </button>
            </div>
          )}
        </main>

        {/* Footer Institucional KwanzaCobro */}
        <footer className="border-t border-slate-200/80 bg-white py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center flex-wrap gap-2.5">
              <strong className="text-slate-900 font-bold">KwanzaCobro</strong>
              <span aria-hidden="true">·</span>
              <span>Gestão e Controlo de Dívidas Empresariais</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Localhost Ativo · Ficheiro JSON Local</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseSynced ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                <span>Supabase Conectado {supabaseLatency !== null ? `(${supabaseLatency}ms)` : ''}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {lastSyncTime && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Sincronizado: {lastSyncTime}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>Moeda: Kwanza (AOA / Kz)</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-700">{company.name}</span>
            </div>
          </div>
        </footer>

        {/* Barra de Navegação Inferior Simplificada para Telemóveis (Mobile First / Android) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1.5 flex items-center justify-around shadow-lg safe-bottom max-w-full">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors min-w-[48px] min-h-[44px] cursor-pointer ${
              activeTab === 'dashboard' ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.dashboard', 'Painel')}</span>
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors min-w-[48px] min-h-[44px] relative cursor-pointer ${
              activeTab === 'debts' ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.debts', 'Dívidas')}</span>
            {overdueCount > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center font-mono">
                {overdueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors min-w-[48px] min-h-[44px] cursor-pointer ${
              activeTab === 'clients' ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.clients', 'Clientes')}</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors min-w-[48px] min-h-[44px] cursor-pointer ${
              activeTab === 'payments' ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.payments', 'Pagamentos')}</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors min-w-[48px] min-h-[44px] text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <Menu className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.menu', 'Menu')}</span>
          </button>
        </nav>
      </div>

      {/* Modais Globais */}
      {isNewDebtOpen && (
        <NewDebtModal
          isOpen={isNewDebtOpen}
          onClose={() => setIsNewDebtOpen(false)}
          onSave={handleCreateDebt}
          clients={visibleClients}
          sellers={sellers}
          debts={debts}
          company={company}
          currentUser={currentUser}
          onOpenNewClient={() => setIsNewClientOpen(true)}
        />
      )}

      {isNewClientOpen && (
        <NewClientModal
          isOpen={isNewClientOpen}
          onClose={() => setIsNewClientOpen(false)}
          onSave={handleCreateClient}
        />
      )}

      {selectedDebtForPayment && (
        <PaymentModal
          isOpen={!!selectedDebtForPayment}
          onClose={() => setSelectedDebtForPayment(null)}
          debt={selectedDebtForPayment}
          client={getClient(selectedDebtForPayment.clientId)}
          onSavePayment={handleCreatePayment}
          currentUserName={currentUser?.name || getSeller(selectedDebtForPayment.sellerId)?.name || 'Vendedor'}
        />
      )}

      {selectedDebtForWhatsApp && (
        <WhatsAppBillingModal
          isOpen={!!selectedDebtForWhatsApp}
          onClose={() => setSelectedDebtForWhatsApp(null)}
          debt={selectedDebtForWhatsApp}
          client={getClient(selectedDebtForWhatsApp.clientId)}
          company={company}
        />
      )}

      {selectedDebtForDetail && (
        <DebtDetailModal
          isOpen={!!selectedDebtForDetail}
          onClose={() => setSelectedDebtForDetail(null)}
          debt={selectedDebtForDetail}
          client={getClient(selectedDebtForDetail.clientId)}
          seller={getSeller(selectedDebtForDetail.sellerId)}
          company={company}
          onOpenPayment={d => setSelectedDebtForPayment(d)}
          onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
          onPrintDebt={d => setPrintingDebt(d)}
          onUpdateDueDate={handleUpdateDueDate}
        />
      )}

      {/* Modal de Automação de Lembretes aos 5 Dias (Restrito à carteira do utilizador ativo) */}
      <AutoReminderModal
        isOpen={isAutoReminderOpen}
        onClose={() => setIsAutoReminderOpen(false)}
        debts={visibleDebts}
        clients={clients}
        company={company}
        onMarkAsSent={handleMarkReminderSent}
        onMarkAllAsSent={handleMarkAllRemindersSent}
      />

      {/* Recibo Automático em PDF Gerado Imediatamente após Gravar a Dívida */}
      <AutomaticReceiptModal
        isOpen={!!newlyCreatedDebtForReceipt}
        onClose={() => setNewlyCreatedDebtForReceipt(null)}
        debt={newlyCreatedDebtForReceipt}
        client={newlyCreatedDebtForReceipt ? getClient(newlyCreatedDebtForReceipt.clientId) : null}
        seller={newlyCreatedDebtForReceipt ? getSeller(newlyCreatedDebtForReceipt.sellerId) : null}
        company={company}
        onOpenWhatsApp={(d) => {
          setNewlyCreatedDebtForReceipt(null);
          setSelectedDebtForWhatsApp(d);
        }}
        onPrintNative={(d) => {
          setNewlyCreatedDebtForReceipt(null);
          setPrintingDebt(d);
        }}
      />

      {/* Modal de Instalação de Aplicação para Android (APK), iOS e Desktop */}
      <PWAInstallModal
        isOpen={isPWAInstallModalOpen}
        onClose={() => setIsPWAInstallModalOpen(false)}
      />

      {/* Indicador de Estado de Ligação Offline */}
      <OfflineIndicator />
    </div>
  );
}
