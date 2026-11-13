/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Debt,
  Client,
  Seller,
  CompanySettings,
  Payment,
  AuthUser,
  DebtStatus,
  Utilizador,
  isSuperAdminRole,
  isAdminOrSuperRole,
  isCompanyAdminRole,
} from './types/debt';
import { 
  initialDebts, 
  initialClients, 
  initialSellers, 
  initialCompanySettings,
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
import { SellersView, CreateUserInput, UpdateUserInput } from './components/SellersView';
import { CompanySettingsView } from './components/CompanySettingsModal';
import { CompaniesManagementView } from './components/CompaniesManagementView';
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
import { 
  supabase,
  validateAuthenticatedUser,
  signOutSupabaseAuth,
  getSupabaseAccessToken,
  fetchAuthorizedUtilizadores,
  createAuthorizedUtilizador,
  updateAuthorizedUtilizador,
  deleteAuthorizedUtilizador,
  pullFromSupabase, 
  syncToSupabase, 
  saveClientToSupabase, 
  saveDebtToSupabase, 
  savePaymentToSupabase, 
  saveCompanyToSupabase, 
  deleteCompanyFromSupabase,
  subscribeToSupabaseChanges, 
  testSupabaseConnection 
} from './lib/supabase';

const STORAGE_KEY_DEBTS = 'kwanzacobro_debts_v2';
const STORAGE_KEY_CLIENTS = 'kwanzacobro_clients_v2';
const STORAGE_KEY_SELLERS = 'kwanzacobro_sellers_v2';
const STORAGE_KEY_COMPANY = 'kwanzacobro_company_v2';
const STORAGE_KEY_COMPANIES = 'kwanzacobro_companies_v2';

export default function App() {
  const { t } = useLanguage();
  // Estado de Autenticação Real via Supabase Auth + public.utilizadores
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);

  const clearCachedTenantData = () => {
    setDebts(initialDebts);
    setClients(initialClients);
    setSellers(initialSellers);
    setUtilizadores([]);
    setCompanies([initialCompanySettings]);
    setCompany(initialCompanySettings);
    try {
      localStorage.removeItem(STORAGE_KEY_DEBTS);
      localStorage.removeItem(STORAGE_KEY_CLIENTS);
      localStorage.removeItem(STORAGE_KEY_SELLERS);
      localStorage.removeItem(STORAGE_KEY_COMPANY);
      localStorage.removeItem(STORAGE_KEY_COMPANIES);
    } catch {}
  };

  const handleLoginSuccess = (user: AuthUser, matchedCompany?: CompanySettings) => {
    setAuthError(null);
    setIsPasswordRecovery(false);
    setCurrentUser(user);
    if (isSuperAdminRole(user.role)) {
      setActiveTab('companies');
    } else {
      setActiveTab('dashboard');
    }
    if (matchedCompany) {
      setCompany(matchedCompany);
      try {
        localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(matchedCompany));
      } catch {}
    } else if (user.companyId) {
      const targetComp = companies.find(c => (c.id || 'default_company') === user.companyId);
      if (targetComp) {
        setCompany(targetComp);
        try {
          localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(targetComp));
        } catch {}
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOutSupabaseAuth();
    } catch (e) {
      console.error('Erro ao terminar sessão no Supabase Auth', e);
    }
    setCurrentUser(null);
    setIsPasswordRecovery(false);
    clearCachedTenantData();
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

  // Lista de Todas as Empresas e Super Administradores
  const [companies, setCompanies] = useState<CompanySettings[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return [initialCompanySettings];
    } catch {
      return [initialCompanySettings];
    }
  });

  // Estado de Sincronização com o Backend e Supabase
  const [isSupabaseSynced, setIsSupabaseSynced] = useState(false);
  const [supabaseLatency, setSupabaseLatency] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // 1. Verificar sessão persistida do Supabase Auth e escutar eventos de Auth (incluindo PASSWORD_RECOVERY)
  useEffect(() => {
    let isMounted = true;

    const hashHasRecovery =
      typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
    if (hashHasRecovery) {
      setIsPasswordRecovery(true);
    }

    const restoreSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user;
        if (sessionUser && isMounted) {
          const validation = await validateAuthenticatedUser(sessionUser);
          if (!isMounted) return;
          if (validation.ok) {
            setCurrentUser(validation.user);
            if (validation.company) {
              setCompany(validation.company);
            }
            if (isSuperAdminRole(validation.user.role)) {
              setActiveTab(prev => (prev === 'dashboard' ? 'companies' : prev));
            }
          } else {
            setAuthError(validation.error);
            setCurrentUser(null);
            clearCachedTenantData();
          }
        }
      } catch (err: any) {
        if (isMounted) setAuthError(err?.message || null);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };

    restoreSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsAuthChecking(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsPasswordRecovery(false);
        clearCachedTenantData();
        setIsAuthChecking(false);
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
        const validation = await validateAuthenticatedUser(session.user);
        if (!isMounted) return;
        if (validation.ok) {
          setAuthError(null);
          setCurrentUser(validation.user);
          if (validation.company) {
            setCompany(validation.company);
          }
        } else {
          setAuthError(validation.error);
          setCurrentUser(null);
          clearCachedTenantData();
        }
      }
    });

    return () => {
      isMounted = false;
      authSubscription?.subscription?.unsubscribe();
    };
  }, []);

  // 2. Carregar dados autorizados do Supabase SOMENTE após autenticação válida
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;

    const loadAuthorizedCloudData = async () => {
      try {
        const pullResult = await pullFromSupabase();
        if (pullResult.success && pullResult.hasData && pullResult.data && isMounted) {
          const {
            debts: cloudDebts,
            clients: cloudClients,
            sellers: cloudSellers,
            utilizadores: cloudUtils,
            company: cloudCompany,
            companies: cloudCompanies,
          } = pullResult.data;

          if (Array.isArray(cloudDebts)) {
            setDebts(cloudDebts);
            localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(cloudDebts));
          }
          if (Array.isArray(cloudClients)) {
            setClients(cloudClients);
            localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(cloudClients));
          }
          if (Array.isArray(cloudSellers)) {
            setSellers(cloudSellers);
            localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(cloudSellers));
          }
          if (Array.isArray(cloudUtils) && cloudUtils.length > 0) {
            setUtilizadores(cloudUtils);
          }
          if (Array.isArray(cloudCompanies) && cloudCompanies.length > 0) {
            setCompanies(cloudCompanies);
            localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(cloudCompanies));
            setCompany(prev => {
              const preferredId = isSuperAdminRole(currentUser.role)
                ? (prev.id || currentUser.companyId || 'default_company')
                : (currentUser.companyId || prev.id || 'default_company');
              const matched = cloudCompanies.find(c => (c.id || 'default_company') === preferredId);
              const next = matched || (cloudCompany && cloudCompany.name ? cloudCompany : prev);
              localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(next));
              return next;
            });
          } else if (cloudCompany && cloudCompany.name) {
            setCompany(cloudCompany);
            localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(cloudCompany));
          }
          setIsSupabaseSynced(true);
          setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
        }
      } catch (cloudErr) {
        console.warn('Carregamento direto do Supabase falhou, tentando fallback autenticado:', cloudErr);
      }

      // Carregar lista completa de public.utilizadores para Admins via Vercel Serverless (/api/admin/users)
      if (isAdminOrSuperRole(currentUser.role)) {
        try {
          const res = await fetchAuthorizedUtilizadores();
          if (res.success && res.users.length > 0 && isMounted) {
            setUtilizadores(res.users);
          }
        } catch {}
      }

      // Fallback via endpoint serverless autenticado com JWT
      try {
        const token = await getSupabaseAccessToken();
        if (token) {
          const supPull = await fetch('/api/supabase/pull', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (supPull.ok && isMounted) {
            const supPullJson = await supPull.json();
            if (supPullJson.success && supPullJson.hasData) {
              if (Array.isArray(supPullJson.sellers) && supPullJson.sellers.length > 0) {
                setSellers(supPullJson.sellers);
                localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(supPullJson.sellers));
              }
              if (Array.isArray(supPullJson.utilizadores) && supPullJson.utilizadores.length > 0) {
                setUtilizadores(prev => (prev.length > 0 ? prev : supPullJson.utilizadores));
              }
              if (Array.isArray(supPullJson.clients) && supPullJson.clients.length > 0) {
                setClients(supPullJson.clients);
                localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(supPullJson.clients));
              }
              if (Array.isArray(supPullJson.debts) && supPullJson.debts.length > 0) {
                setDebts(supPullJson.debts);
                localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(supPullJson.debts));
              }
              if (Array.isArray(supPullJson.companies) && supPullJson.companies.length > 0) {
                setCompanies(supPullJson.companies);
                localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(supPullJson.companies));
              } else if (supPullJson.company && supPullJson.company.name) {
                setCompany(supPullJson.company);
                localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(supPullJson.company));
              }
              setIsSupabaseSynced(true);
              setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
            }
          }
        }
      } catch (err) {
        console.warn('API fallback pull indisponível:', err);
      }

      // Testar Conexão e Latência do Supabase
      try {
        const health = await testSupabaseConnection();
        if (isMounted && health.connected) {
          setIsSupabaseSynced(true);
          setSupabaseLatency(health.latencyMs ?? null);
        }
      } catch {}
    };

    loadAuthorizedCloudData();

    const unsubscribe = subscribeToSupabaseChanges(async () => {
      try {
        const pull = await pullFromSupabase();
        if (pull.success && pull.hasData && pull.data && isMounted) {
          if (Array.isArray(pull.data.debts)) setDebts(pull.data.debts);
          if (Array.isArray(pull.data.clients)) setClients(pull.data.clients);
          if (Array.isArray(pull.data.sellers)) setSellers(pull.data.sellers);
          if (Array.isArray(pull.data.utilizadores) && pull.data.utilizadores.length > 0) {
            setUtilizadores(pull.data.utilizadores);
          }
          if (Array.isArray(pull.data.companies) && pull.data.companies.length > 0) {
            setCompanies(pull.data.companies);
            setCompany(prev => {
              const preferredId = isSuperAdminRole(currentUser.role)
                ? (prev.id || currentUser.companyId || 'default_company')
                : (currentUser.companyId || prev.id || 'default_company');
              const matched = pull.data?.companies?.find(c => (c.id || 'default_company') === preferredId);
              return matched || prev;
            });
          } else if (pull.data.company && pull.data.company.name) {
            setCompany(pull.data.company);
          }
          setIsSupabaseSynced(true);
          setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
        }
      } catch {}
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.companyId, currentUser?.role]);

  // Sincronização manual acionada pelo utilizador autenticado
  const handleManualSyncNow = async () => {
    if (!currentUser) return;
    setIsManualSyncing(true);
    try {
      const syncRes = await syncToSupabase({ debts, clients, sellers, company, companies });
      if (syncRes.success) {
        setIsSupabaseSynced(true);
      }

      const token = await getSupabaseAccessToken();
      if (token) {
        try {
          await fetch('/api/supabase/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ debts, clients, sellers, company, companies }),
          });
        } catch {}
      }

      const pullResult = await pullFromSupabase();
      if (pullResult.success && pullResult.data) {
        if (Array.isArray(pullResult.data.sellers)) setSellers(pullResult.data.sellers);
        if (Array.isArray(pullResult.data.clients)) setClients(pullResult.data.clients);
        if (Array.isArray(pullResult.data.debts)) setDebts(pullResult.data.debts);
        if (Array.isArray(pullResult.data.utilizadores) && pullResult.data.utilizadores.length > 0) {
          setUtilizadores(pullResult.data.utilizadores);
        }
        if (Array.isArray(pullResult.data.companies) && pullResult.data.companies.length > 0) {
          setCompanies(pullResult.data.companies);
          const preferredId = isSuperAdminRole(currentUser.role)
            ? (company.id || 'default_company')
            : (currentUser.companyId || company.id || 'default_company');
          const matched = pullResult.data.companies.find(c => (c.id || 'default_company') === preferredId);
          if (matched) setCompany(matched);
        } else if (pullResult.data.company && pullResult.data.company.name) {
          setCompany(pullResult.data.company);
        }
      }

      if (isAdminOrSuperRole(currentUser.role)) {
        const usersRes = await fetchAuthorizedUtilizadores();
        if (usersRes.success && usersRes.users.length > 0) {
          setUtilizadores(usersRes.users);
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

  // Salvar no LocalStorage apenas quando autenticado
  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(debts));
    } catch (e) {
      console.error('Erro ao guardar dívidas no LocalStorage', e);
    }
  }, [debts, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
    } catch (e) {
      console.error('Erro ao guardar clientes no LocalStorage', e);
    }
  }, [clients, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(sellers));
    } catch (e) {
      console.error('Erro ao guardar vendedores no LocalStorage', e);
    }
  }, [sellers, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(company));
    } catch (e) {
      console.error('Erro ao guardar configurações da empresa no LocalStorage', e);
    }
  }, [company, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
    } catch (e) {
      console.error('Erro ao guardar empresas no LocalStorage', e);
    }
  }, [companies, currentUser]);

  // Sincronização automática autenticada para Supabase / Backend
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(async () => {
      try {
        const token = await getSupabaseAccessToken();
        if (!token) return;
        const supRes = await fetch('/api/supabase/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ debts, clients, sellers, company, companies }),
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
    }, 800);

    return () => clearTimeout(timer);
  }, [debts, clients, sellers, company, companies, currentUser]);

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

  // Isolamento estrito por Empresa:
  // super_admin pode controlar a empresa selecionada; admin_geral e vendedor ficam bloqueados à sua company_id
  const activeCompanyId = isSuperAdminRole(currentUser?.role)
    ? (company.id || 'default_company')
    : (currentUser?.companyId || company.id || 'default_company');
  const companyDebts = debts.filter(d => (d.companyId || 'default_company') === activeCompanyId);
  const companyClients = clients.filter(c => (c.companyId || 'default_company') === activeCompanyId);
  const companySellers = sellers.filter(s => (s.companyId || 'default_company') === activeCompanyId);

  // Filtragem estrita conforme o perfil do utilizador:
  // VENDEDOR SÓ PODE VER OS SEUS PRÓPRIOS CLIENTES E AS SUAS PRÓPRIAS VENDAS!
  const isSellerRole = currentUser?.role === 'vendedor';

  const visibleDebts = isSellerRole
    ? companyDebts.filter(
        d =>
          d.sellerId === currentUser?.id ||
          (currentUser?.sellerId && d.sellerId === currentUser.sellerId) ||
          d.sellerId === currentUser?.name
      )
    : companyDebts;

  const visibleClients = isSellerRole
    ? companyClients.filter(
        c =>
          (c.createdBySellerId &&
            (c.createdBySellerId === currentUser?.id ||
              (currentUser?.sellerId && c.createdBySellerId === currentUser.sellerId))) ||
          companyDebts.some(
            d =>
              (d.sellerId === currentUser?.id ||
                (currentUser?.sellerId && d.sellerId === currentUser.sellerId) ||
                d.sellerId === currentUser?.name) &&
              d.clientId === c.id
          )
      )
    : companyClients;

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

  // Handlers de Ações com Persistência Direta no Supabase
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
        companyId: activeCompanyId,
        createdAt: new Date().toISOString(),
      };
      setClients(prev => {
        const updated = [autoClient, ...prev];
        try {
          localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updated));
        } catch {}
        return updated;
      });
      // Persistir no Supabase
      saveClientToSupabase(autoClient).catch(() => {});
    }

    const newDebt: Debt = {
      ...newDebtData,
      id: `debt-${Date.now()}`,
      companyId: newDebtData.companyId || activeCompanyId,
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDebts(prev => [newDebt, ...prev]);

    // Persistência Direta no Supabase
    saveDebtToSupabase(newDebt).then(res => {
      if (res.success) {
        setIsSupabaseSynced(true);
        setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
      }
    }).catch(err => {
      console.warn('Erro ao salvar dívida no Supabase:', err);
    });

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

    setDebts(prev => {
      let debtToSave: Debt | null = null;
      const updatedList = prev.map(d => {
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
        debtToSave = updatedDebt;

        if (sendWhatsApp) {
          setTimeout(() => {
            setSelectedDebtForWhatsApp(updatedDebt);
          }, 200);
        }

        return updatedDebt;
      });

      // Persistir amortização no Supabase
      if (debtToSave) {
        savePaymentToSupabase(debtId, payment, debtToSave).then(res => {
          if (res.success) {
            setIsSupabaseSynced(true);
            setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
          }
        }).catch(err => {
          console.warn('Erro ao salvar amortização no Supabase:', err);
        });
      }

      return updatedList;
    });
  };

  const handleUpdateDueDate = (debtId: string, newDueDate: string, reason: string) => {
    setDebts(prev => {
      let debtToSave: Debt | null = null;
      const updatedList = prev.map(d => {
        if (d.id !== debtId) return d;
        const updatedTerms = reason 
          ? `${d.terms ? `${d.terms}. ` : ''}Reescalonado para ${newDueDate} (Motivo: ${reason})`
          : d.terms;

        const updated: Debt = {
          ...d,
          dueDate: newDueDate,
          status: 'acordo',
          terms: updatedTerms,
          updatedAt: new Date().toISOString(),
        };
        debtToSave = updated;
        return updated;
      });

      if (debtToSave) {
        saveDebtToSupabase(debtToSave).then(res => {
          if (res.success) setIsSupabaseSynced(true);
        }).catch(() => {});
      }

      return updatedList;
    });

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
      companyId: newClientData.companyId || activeCompanyId,
      createdAt: new Date().toISOString(),
    };
    setClients(prev => [...prev, newClient]);
    saveClientToSupabase(newClient).then(res => {
      if (res.success) {
        setIsSupabaseSynced(true);
        setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
      }
    }).catch(err => {
      console.warn('Erro ao salvar cliente no Supabase:', err);
    });
  };

  // Bloqueio de Segurança: Restrição estrita por perfil
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'vendedor' && (activeTab === 'companies' || activeTab === 'sellers' || activeTab === 'settings')) {
      setActiveTab('dashboard');
    } else if (isCompanyAdminRole(currentUser.role) && activeTab === 'companies') {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  const handleAddSeller = async (input: CreateUserInput): Promise<{ success: boolean; error?: string }> => {
    const res = await createAuthorizedUtilizador({
      name: input.name,
      email: input.email,
      password: input.password,
      phone: input.phone,
      branch: input.branch,
      role: input.role,
      companyId: input.companyId || activeCompanyId,
    });

    if (!res.success || !res.user) {
      return { success: false, error: res.error || 'Erro ao criar utilizador no servidor.' };
    }

    const createdUser = res.user;
    setUtilizadores(prev => [createdUser, ...prev.filter(u => u.id !== createdUser.id)]);
    if (createdUser.companyId) {
      const mirroredSeller: Seller = {
        id: createdUser.sellerId || createdUser.id,
        name: createdUser.name,
        phone: createdUser.phone || '',
        branch: createdUser.branch || 'Sede',
        email: createdUser.email,
        role: createdUser.role,
        companyId: createdUser.companyId,
        isActive: createdUser.isActive,
        createdAt: createdUser.createdAt || new Date().toISOString().slice(0, 10),
      };
      setSellers(prev => [mirroredSeller, ...prev.filter(s => s.id !== mirroredSeller.id)]);
    }
    setIsSupabaseSynced(true);
    setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
    return { success: true };
  };

  const handleUpdateSeller = async (input: UpdateUserInput): Promise<{ success: boolean; error?: string }> => {
    const res = await updateAuthorizedUtilizador(input);
    if (!res.success || !res.user) {
      return { success: false, error: res.error || 'Erro ao atualizar utilizador no servidor.' };
    }

    const updated = res.user;
    setUtilizadores(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    setSellers(prev =>
      prev.map(s =>
        s.id === updated.id || s.id === updated.sellerId
          ? {
              ...s,
              name: updated.name,
              phone: updated.phone || s.phone,
              branch: updated.branch || s.branch,
              email: updated.email,
              role: updated.role,
              companyId: updated.companyId || s.companyId,
              isActive: updated.isActive,
            }
          : s
      )
    );
    setIsSupabaseSynced(true);
    setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
    return { success: true };
  };

  const handleDeleteSeller = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const res = await deleteAuthorizedUtilizador(userId);
    if (!res.success) {
      alert(res.error || 'Não foi possível remover o utilizador.');
      return { success: false, error: res.error };
    }
    if (res.deactivatedOnly) {
      setUtilizadores(prev => prev.map(u => (u.id === userId ? { ...u, isActive: false } : u)));
      setSellers(prev => prev.map(s => (s.id === userId ? { ...s, isActive: false } : s)));
    } else {
      setUtilizadores(prev => prev.filter(u => u.id !== userId));
      setSellers(prev => prev.filter(s => s.id !== userId));
    }
    return { success: true };
  };

  const handleSaveCompany = (updated: CompanySettings) => {
    if (currentUser && currentUser.role === 'vendedor') return;
    if (currentUser && isCompanyAdminRole(currentUser.role) && updated.id !== currentUser.companyId) return;

    const compId = updated.id || activeCompanyId || 'default_company';
    const normalized: CompanySettings = {
      ...updated,
      id: compId,
      status: updated.status || 'ativo',
    };

    setCompany(normalized);
    setCompanies(prev => {
      const exists = prev.some(c => (c.id || 'default_company') === compId);
      const next = exists
        ? prev.map(c => (c.id || 'default_company') === compId ? normalized : c)
        : [...prev, normalized];
      try {
        localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(normalized));
    } catch {}

    saveCompanyToSupabase(normalized).then(res => {
      if (res.success) {
        setIsSupabaseSynced(true);
        setLastSyncTime(new Date().toLocaleTimeString('pt-AO'));
      }
    }).catch(err => {
      console.warn('Erro ao salvar configurações da empresa no Supabase:', err);
    });
  };

  const handleSelectActiveCompany = (companyId: string) => {
    if (!isSuperAdminRole(currentUser?.role)) return;
    const found = companies.find(c => (c.id || 'default_company') === companyId);
    if (found) {
      setCompany(found);
      try {
        localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(found));
      } catch {}
    }
  };

  const handleDeleteCompany = (companyId: string) => {
    if (!isSuperAdminRole(currentUser?.role)) return;
    if (companyId === 'default_company') return;
    setCompanies(prev => {
      const next = prev.filter(c => (c.id || 'default_company') !== companyId);
      if ((company.id || 'default_company') === companyId) {
        const fallback = next.find(c => c.id === 'default_company') || next[0] || initialCompanySettings;
        setCompany(fallback);
      }
      return next;
    });
    deleteCompanyFromSupabase(companyId).catch(() => {});
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

  // Enquanto verifica persistência da sessão Supabase Auth, protege páginas privadas
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 flex flex-col justify-center items-center p-6 text-white">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center mb-3 animate-pulse">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-xs font-semibold text-emerald-200 tracking-wide">
          A verificar sessão autenticada no Supabase...
        </p>
      </div>
    );
  }

  // Se estiver a redefinir palavra-passe ou não estiver autenticado, exibe LoginPage segura
  if (isPasswordRecovery) {
    return (
      <LoginPage
        company={company}
        initialMode="reset"
        onLoginSuccess={handleLoginSuccess}
        onPasswordResetDone={async () => {
          setIsPasswordRecovery(false);
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const val = await validateAuthenticatedUser(data.session.user);
            if (val.ok) {
              handleLoginSuccess(val.user, val.company);
              return;
            }
          }
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        company={company}
        externalError={authError}
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
          {activeTab === 'companies' && currentUser?.role === 'super_admin' && (
            <CompaniesManagementView
              companies={companies}
              activeCompanyId={activeCompanyId}
              onSelectActiveCompany={handleSelectActiveCompany}
              onSaveCompany={handleSaveCompany}
              onDeleteCompany={handleDeleteCompany}
              sellers={sellers}
              clients={clients}
              debts={debts}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              debts={companyDebts}
              clients={companyClients}
              sellers={companySellers}
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
              clients={companyClients}
              debts={companyDebts}
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
              debts={companyDebts}
              clients={companyClients}
              sellers={companySellers}
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
              debts={companyDebts}
              clients={companyClients}
              currentUser={currentUser}
              company={company}
              onOpenPayment={d => setSelectedDebtForPayment(d)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
            />
          )}

          {activeTab === 'receipts' && (
            <DigitalReceiptsView
              debts={companyDebts}
              clients={companyClients}
              sellers={companySellers}
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
              debts={companyDebts}
              clients={companyClients}
              company={company}
              currentUser={currentUser}
              onOpen5DayReminders={() => setIsAutoReminderOpen(true)}
              onOpenWhatsApp={d => setSelectedDebtForWhatsApp(d)}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
            />
          )}

          {activeTab === 'reports' && (
            <FinancialReportsView
              debts={companyDebts}
              clients={companyClients}
              sellers={companySellers}
              company={company}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'audit' && (
            <AuditTrailView
              debts={companyDebts}
              clients={companyClients}
              currentUser={currentUser}
              onViewDebtDetail={d => setSelectedDebtForDetail(d)}
            />
          )}

          {activeTab === 'sellers' && isAdminOrSuperRole(currentUser?.role) && (
            <SellersView
              sellers={isSuperAdminRole(currentUser?.role) ? sellers : companySellers}
              utilizadores={
                isSuperAdminRole(currentUser?.role)
                  ? utilizadores
                  : utilizadores.filter(u => u.companyId === activeCompanyId && u.role !== 'super_admin')
              }
              debts={isSuperAdminRole(currentUser?.role) ? debts : companyDebts}
              currentUser={currentUser}
              onAddSeller={handleAddSeller}
              onUpdateSeller={handleUpdateSeller}
              onDeleteSeller={handleDeleteSeller}
              companies={companies}
              currentCompanyId={activeCompanyId}
              onFilterDebtsBySeller={(sellerId) => {
                setActiveTab('debts');
              }}
            />
          )}

          {activeTab === 'settings' && isAdminOrSuperRole(currentUser?.role) && (
            <CompanySettingsView
              company={company}
              onSaveCompany={handleSaveCompany}
              debts={companyDebts}
              clients={companyClients}
              sellers={companySellers}
              onRestoreDemoData={handleRestoreDemoData}
              onImportAllData={handleImportAllData}
            />
          )}

          {activeTab === 'settings' && !isAdminOrSuperRole(currentUser?.role) && (
            <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-emerald-100 shadow-sm space-y-3 my-8">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto font-bold text-xl shadow-xs">
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
                className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer min-h-[44px]"
              >
                {t('common.back', 'Voltar')}
              </button>
            </div>
          )}
        </main>

        {/* Footer Institucional KwanzaCobro */}
        <footer className="border-t border-emerald-100/80 bg-white py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center flex-wrap gap-2.5">
              <strong className="text-slate-900 font-bold">Kwanza<span className="text-emerald-700">Cobro</span></strong>
              <span aria-hidden="true">·</span>
              <span>Gestão e Controlo de Dívidas Empresariais</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Armazenamento Local Ativo</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseSynced ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
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
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-emerald-100 px-2 py-1.5 flex items-center justify-around shadow-lg safe-bottom max-w-full">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all min-w-[52px] min-h-[48px] cursor-pointer ${
              activeTab === 'dashboard' ? 'text-emerald-700 font-bold bg-emerald-50/90' : 'text-slate-500 hover:text-emerald-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.dashboard', 'Painel')}</span>
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all min-w-[52px] min-h-[48px] relative cursor-pointer ${
              activeTab === 'debts' ? 'text-emerald-700 font-bold bg-emerald-50/90' : 'text-slate-500 hover:text-emerald-800'
            }`}
          >
            <Receipt className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.debts', 'Dívidas')}</span>
            {overdueCount > 0 && (
              <span className="absolute top-1 right-1.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center font-mono">
                {overdueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all min-w-[52px] min-h-[48px] cursor-pointer ${
              activeTab === 'clients' ? 'text-emerald-700 font-bold bg-emerald-50/90' : 'text-slate-500 hover:text-emerald-800'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.clients', 'Clientes')}</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all min-w-[52px] min-h-[48px] cursor-pointer ${
              activeTab === 'payments' ? 'text-emerald-700 font-bold bg-emerald-50/90' : 'text-slate-500 hover:text-emerald-800'
            }`}
          >
            <CreditCard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight truncate">{t('nav.payments', 'Pagamentos')}</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all min-w-[52px] min-h-[48px] text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/50 cursor-pointer"
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
          sellers={companySellers}
          debts={companyDebts}
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
