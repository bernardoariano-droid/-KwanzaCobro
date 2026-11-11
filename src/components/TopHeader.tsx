import React from 'react';
import { 
  Menu, 
  Plus, 
  BellRing, 
  Smartphone, 
  Search, 
  ShieldCheck, 
  UserCheck, 
  Receipt, 
  CreditCard,
  Users,
  BarChart3,
  FileCheck,
  History,
  Settings,
  LayoutDashboard,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { AuthUser, CompanySettings } from '../types/debt';
import { ActiveTab } from './Sidebar';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../i18n/LanguageContext';

interface TopHeaderProps {
  activeTab: ActiveTab;
  onOpenMobileMenu: () => void;
  onOpenNewDebt: () => void;
  overdueCount: number;
  fiveDaysCount: number;
  onOpen5DayReminders: () => void;
  onOpenInstallPWA: () => void;
  currentUser?: AuthUser | null;
  company: CompanySettings;
  onManualSync?: () => void;
  isSyncing?: boolean;
  isSupabaseConnected?: boolean;
  lastSyncTime?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenNewDebt,
  overdueCount,
  fiveDaysCount,
  onOpen5DayReminders,
  onOpenInstallPWA,
  currentUser,
  company,
  onManualSync,
  isSyncing,
  isSupabaseConnected = true,
  lastSyncTime,
}) => {
  const { t } = useLanguage();

  const getTabTitle = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard': return t('nav.dashboard', 'Painel Principal');
      case 'clients': return t('nav.clients', 'Clientes');
      case 'debts': return currentUser?.role === 'admin' ? t('nav.debts', 'Gestão de Dívidas') : t('nav.my_debts', 'Minhas Cobranças');
      case 'payments': return t('nav.payments', 'Pagamentos');
      case 'receipts': return t('nav.receipts', 'Recibos Digitais');
      case 'notifications': return t('nav.notifications', 'Notificações SMS');
      case 'reports': return t('nav.reports', 'Relatórios Financeiros');
      case 'sellers': return t('nav.sellers', 'Funcionários e Permissões');
      case 'settings': return t('nav.settings', 'Configurações');
      case 'audit': return t('nav.audit', 'Histórico de Operações');
      default: return t('nav.dashboard', 'Painel');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Esquerda: Botão Menu Mobile & Título do Módulo Ativo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Abrir Menu de Navegação"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logomarca em Mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={company?.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'}
                alt="KwanzaCobro"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">
              Kwanza<span className="text-blue-700">Cobro</span>
            </span>
          </div>

          {/* Breadcrumb e Título do Módulo em Desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">KwanzaCobro</span>
            <span className="text-xs text-slate-300">/</span>
            <h1 className="text-sm font-bold text-slate-900">
              {getTabTitle(activeTab)}
            </h1>
          </div>
        </div>

        {/* Direita: Ações Rápidas, Alertas de 5 Dias, PWA e Idioma */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Alertas 5 Dias */}
          {fiveDaysCount > 0 && (
            <button
              onClick={onOpen5DayReminders}
              title={`Existem ${fiveDaysCount} compras a crédito com prazo a expirar em 5 dias`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
              <span className="font-mono text-[11px] bg-amber-600 text-white px-1.5 py-0.2 rounded-md">
                {fiveDaysCount}
              </span>
              <span className="hidden sm:inline text-[11px]">{t('nav.reminders_5d', 'Lembretes 5d')}</span>
            </button>
          )}

          {/* Sincronização Supabase Cloud */}
          {onManualSync && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              title={
                isSyncing 
                  ? 'A sincronizar dados com o Supabase Cloud...' 
                  : `Supabase Conectado. Última sincronização: ${lastSyncTime || 'Agora'}. Clique para sincronizar.`
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-2xs ${
                isSyncing
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : isSupabaseConnected
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-pulse text-blue-600' : 'text-emerald-600'}`} />
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600' : 'text-emerald-700 hidden sm:inline'}`} />
              <span className="hidden lg:inline text-[11px] font-bold">
                {isSyncing ? 'Sincronizando...' : t('nav.sync_cloud', 'Supabase')}
              </span>
            </button>
          )}

          {/* Idioma */}
          <div className="hidden sm:block">
            <LanguageSelector compact />
          </div>

          {/* Instalar App APK */}
          {onOpenInstallPWA && (
            <button
              onClick={onOpenInstallPWA}
              title="Instalar Aplicação KwanzaCobro no dispositivo"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('nav.install_apk', 'Instalar APK')}</span>
            </button>
          )}

          {/* Botão Primário: Nova Venda a Crédito */}
          <button
            onClick={onOpenNewDebt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-blue-200" />
            <span className="hidden sm:inline">{t('nav.new_sale', 'Nova Venda')}</span>
            <span className="sm:hidden">{t('nav.new_sale', 'Venda')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
