import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  CreditCard, 
  FileCheck, 
  BellRing, 
  BarChart3, 
  History, 
  UserCheck, 
  Settings, 
  Plus, 
  LogOut, 
  X, 
  ChevronRight,
  Smartphone,
  ShieldCheck,
  Building2,
  DollarSign
} from 'lucide-react';
import { AuthUser, CompanySettings } from '../types/debt';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../i18n/LanguageContext';

export type ActiveTab = 
  | 'dashboard' 
  | 'clients' 
  | 'debts' 
  | 'payments' 
  | 'receipts' 
  | 'notifications' 
  | 'reports' 
  | 'sellers' 
  | 'settings' 
  | 'audit';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenNewDebt: () => void;
  overdueCount: number;
  fiveDaysCount: number;
  company: CompanySettings;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenInstallPWA?: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenNewDebt,
  overdueCount,
  fiveDaysCount,
  company,
  currentUser,
  onLogout,
  onOpenInstallPWA,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';

  const navItems = [
    {
      group: t('nav.group_main', 'Principal'),
      items: [
        { id: 'dashboard', label: t('nav.dashboard', 'Painel Principal'), icon: LayoutDashboard },
        { id: 'clients', label: t('nav.clients', 'Clientes'), icon: Users },
        { 
          id: 'debts', 
          label: isAdmin ? t('nav.debts', 'Gestão de Dívidas') : t('nav.my_debts', 'Minhas Cobranças'), 
          icon: Receipt,
          badge: overdueCount > 0 ? `${overdueCount}` : null,
          badgeColor: 'bg-rose-600 text-white',
        },
        { id: 'payments', label: t('nav.payments', 'Pagamentos'), icon: CreditCard },
        { id: 'receipts', label: t('nav.receipts', 'Recibos Digitais'), icon: FileCheck },
      ],
    },
    {
      group: t('nav.group_operations', 'Operações & Análise'),
      items: [
        { 
          id: 'notifications', 
          label: t('nav.notifications', 'Notificações SMS'), 
          icon: BellRing,
          badge: fiveDaysCount > 0 ? `${fiveDaysCount}` : null,
          badgeColor: 'bg-amber-600 text-white',
        },
        { id: 'reports', label: t('nav.reports', 'Relatórios Financeiros'), icon: BarChart3 },
        { id: 'audit', label: t('nav.audit', 'Histórico de Operações'), icon: History },
      ],
    },
    ...(isAdmin ? [
      {
        group: t('nav.group_admin', 'Administração'),
        items: [
          { id: 'sellers', label: t('nav.sellers', 'Funcionários e Permissões'), icon: UserCheck },
          { id: 'settings', label: t('nav.settings', 'Configurações'), icon: Settings },
        ],
      }
    ] : []),
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Backdrop para Telemóvel / Tablet quando aberto */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Barra Lateral / Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 sm:w-72 bg-white border-r border-emerald-100 shadow-[8px_0_30px_rgba(15,80,45,0.04)] flex flex-col justify-between transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Topo da Sidebar: identidade NEUROJUS */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logomarca NEUROJUS */}
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/90 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              <img 
                src={company?.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                alt="NEUROJUS" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 leading-none">
                <span className="text-emerald-800">NEURO</span><span className="text-emerald-600">JUS</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                {t('app.slogan', 'Gestão de Dívidas')}
              </span>
            </div>
          </div>

          <button 
            type="button"
            aria-label="Fechar menu de navegação"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Botão de Ação Rápida Primária */}
        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={() => {
              onOpenNewDebt();
              onCloseMobile();
            }}
            className="w-full py-2.5 px-3.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-200" />
            <span>Registar Venda a Crédito</span>
          </button>
        </div>

        {/* Menu de Navegação Rolável */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {navItems.map(group => (
            <div key={group.group} className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {group.group}
              </span>

              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => handleSelectTab(item.id as ActiveTab)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left
                      ${isActive 
                        ? 'bg-emerald-50 text-emerald-900 font-bold shadow-2xs' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-md ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Rodapé da Sidebar: Perfil, Idioma e Sair */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          {/* Seletor de Idioma e PWA */}
          <div className="flex items-center justify-between gap-2">
            <LanguageSelector compact dropUp />

            {onOpenInstallPWA && (
              <button
                onClick={onOpenInstallPWA}
                title="Instalar App / APK KwanzaCobro"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instalar APK</span>
              </button>
            )}
          </div>

          {/* Cartão do Utilizador Autenticado */}
          {currentUser && (
            <div className="p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                  {currentUser.role === 'admin' ? 'A' : currentUser.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 truncate">
                    {currentUser.name}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold block uppercase">
                    {currentUser.role === 'admin' ? 'Administrador Geral' : 'Vendedor Comercial'}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Terminar Sessão"
                  aria-label="Terminar sessão"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
