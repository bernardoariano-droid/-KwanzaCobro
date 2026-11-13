import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  UserCheck, 
  Settings, 
  PlusCircle, 
  Smartphone,
  Download,
  BellRing,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  Globe
} from 'lucide-react';
import { AuthUser, isAdminOrSuperRole, isSuperAdminRole } from '../types/debt';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../i18n/LanguageContext';

export type ActiveTab = 'dashboard' | 'debts' | 'clients' | 'sellers' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenNewDebt: () => void;
  overdueCount: number;
  fiveDaysCount?: number;
  onOpen5DayReminders?: () => void;
  onOpenInstallPWA?: () => void;
  companyLogo?: string;
  companyName?: string;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenNewDebt,
  overdueCount,
  fiveDaysCount = 0,
  onOpen5DayReminders,
  onOpenInstallPWA,
  companyLogo = '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg',
  companyName = 'NEUROJUS',
  currentUser,
  onLogout,
}) => {
  const { t } = useLanguage();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const isSuperAdmin = isSuperAdminRole(currentUser?.role);
  const isAdmin = isAdminOrSuperRole(currentUser?.role);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar: Brand — Nav Links — Action CTAs */}
          <div className="flex items-center justify-between gap-3 h-16 sm:h-18">
            {/* Zone 1: Official Brand Logo & Monogram */}
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => onTabChange('dashboard')} 
                className="flex items-center gap-2.5 text-left group transition-transform active:scale-98"
                title={t('nav.dashboard', 'Painel')}
              >
                <div className="h-11 sm:h-12 px-2 py-1 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-center overflow-hidden hover:border-teal-500 transition-colors">
                  <img 
                    src={companyLogo || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'} 
                    alt="NEUROJUS Logomarca Oficial" 
                    className="h-9 sm:h-10 max-w-[120px] sm:max-w-[170px] object-contain"
                  />
                </div>
                <div className="flex flex-col hidden sm:flex">
                  <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 leading-none group-hover:text-teal-900 transition-colors">
                    NEUROJUS <span className="text-teal-700 font-bold text-xs sm:text-sm">· {t('app.title', 'Controlo de Dívidas')}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1">
                    {t('app.slogan', 'Rigor, Excelência e Inovação')}
                  </span>
                </div>
              </button>
            </div>

            {/* Zone 2: Navigation Links (Desktop & Tablet) */}
            <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'text-teal-800 font-bold border-b-2 border-teal-700 pb-0.5'
                    : 'hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t('nav.dashboard', 'Painel')}</span>
              </button>

              <button
                onClick={() => onTabChange('debts')}
                className={`flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'debts'
                    ? 'text-teal-800 font-bold border-b-2 border-teal-700 pb-0.5'
                    : 'hover:text-slate-900'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>{isAdmin ? t('nav.debts', 'Todas as Dívidas') : t('nav.my_debts', 'Minhas Cobranças')}</span>
                {overdueCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[11px] font-bold rounded-md bg-rose-100 text-rose-700 tabular-nums">
                    {overdueCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onTabChange('clients')}
                className={`flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'clients'
                    ? 'text-teal-800 font-bold border-b-2 border-teal-700 pb-0.5'
                    : 'hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{isAdmin ? t('nav.clients', 'Todos os Clientes') : t('nav.my_clients', 'Meus Clientes')}</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => onTabChange('sellers')}
                  className={`flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'sellers'
                      ? 'text-teal-800 font-bold border-b-2 border-teal-700 pb-0.5'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{t('nav.sellers', 'Funcionários / Equipa')}</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => onTabChange('settings')}
                  className={`flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'settings'
                      ? 'text-teal-800 font-bold border-b-2 border-teal-700 pb-0.5'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>{t('nav.settings', 'Configurações')}</span>
                </button>
              )}
            </nav>

            {/* Zone 3: Actions + Language Selector + User Profile & Logout */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Seletor de Idiomas (Português, Inglês, Francês, Árabe, Espanhol) */}
              <LanguageSelector />

              {/* Botão de Instalar App / APK */}
              {onOpenInstallPWA && (
                <button
                  onClick={onOpenInstallPWA}
                  title="Instalar no Telemóvel, Tablet ou Computador"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-xl transition-all shadow-2xs active:scale-95"
                >
                  <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                  <span className="hidden sm:inline">{t('nav.install_app', 'App (APK)')}</span>
                </button>
              )}

              {/* Botão de Alerta 5 Dias */}
              {fiveDaysCount > 0 && onOpen5DayReminders && (
                <button
                  onClick={onOpen5DayReminders}
                  title="Disparar avisos automáticos de 5 dias antes do prazo"
                  className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-2 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all shadow-2xs active:scale-95 whitespace-nowrap"
                >
                  <BellRing className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
                  <span className="bg-amber-600 text-white font-mono px-1.5 py-0.2 rounded-md text-[10px]">
                    {fiveDaysCount}
                  </span>
                </button>
              )}

              {/* Botão Primário: Registar Dívida */}
              <button
                onClick={onOpenNewDebt}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#073b3a] to-[#0b4d4b] hover:from-[#052b2a] hover:to-[#073b3a] active:scale-98 rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-4 h-4 text-amber-300" />
                <span className="hidden md:inline">{t('nav.register_debt', 'Registar Dívida')}</span>
                <span className="md:hidden">{t('nav.register_debt', 'Registar')}</span>
              </button>

              {/* Perfil do Utilizador Autenticado & Logout */}
              {currentUser && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition-all text-left"
                    title={`Sessão: ${currentUser.name}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {isSuperAdmin ? 'SA' : isAdmin ? 'AG' : currentUser.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="hidden xl:flex flex-col pr-1">
                      <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[100px]">
                        {currentUser.name.split(' ')[0]}
                      </span>
                      <span className="text-[10px] font-semibold text-teal-700 uppercase">
                        {isSuperAdmin ? 'Super Admin' : isAdmin ? t('role.admin', 'Admin Geral') : t('role.seller', 'Vendedor')}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in text-xs">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                          {t('login.welcome', 'NEUROJUS Angola')}
                        </span>
                        <div className="font-bold text-slate-900 text-sm mt-0.5">{currentUser.name}</div>
                        <div className="text-slate-500 font-mono text-[11px] truncate">{currentUser.email}</div>
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            isAdmin
                              ? 'bg-teal-100 text-teal-900' 
                              : 'bg-amber-100 text-amber-900'
                          }`}>
                            {isSuperAdmin ? '🛡️ Super Administrador' : isAdmin ? `🛡️ ${t('role.admin', 'Administrador Geral')}` : `💼 ${t('role.seller', 'Vendedor Comercial')}`}
                          </span>
                        </div>
                        {currentUser.branch && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Filial: {currentUser.branch}
                          </div>
                        )}
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onTabChange('dashboard');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                        >
                          <LayoutDashboard className="w-4 h-4 text-slate-400" />
                          <span>{t('nav.dashboard', 'Painel')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onTabChange('debts');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                        >
                          <Receipt className="w-4 h-4 text-slate-400" />
                          <span>{isAdmin ? t('nav.debts', 'Todas as Dívidas') : t('nav.my_debts', 'Minhas Cobranças')}</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              onTabChange('settings');
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                          >
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span>{t('nav.settings', 'Configurações da Empresa')}</span>
                          </button>
                        )}
                      </div>

                      {onLogout && (
                        <div className="pt-1 border-t border-slate-100">
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              onLogout();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-rose-50 text-rose-700 font-bold flex items-center gap-2 transition-colors"
                          >
                            <LogOut className="w-4 h-4 text-rose-600" />
                            <span>{t('nav.logout', 'Terminar Sessão (Sair)')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Barra de Navegação Inferior Nativa para Mobile (Smartphones & Tablets Portrait) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg safe-bottom">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[50px] min-h-[44px] ${
            activeTab === 'dashboard' ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">{t('nav.dashboard', 'Painel')}</span>
        </button>

        <button
          onClick={() => onTabChange('debts')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[50px] min-h-[44px] relative ${
            activeTab === 'debts' ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">{isAdmin ? t('nav.debts', 'Dívidas') : t('nav.my_debts', 'Minhas')}</span>
          {overdueCount > 0 && (
            <span className="absolute top-1 right-1.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center font-mono">
              {overdueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('clients')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[50px] min-h-[44px] ${
            activeTab === 'clients' ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">{isAdmin ? t('nav.clients', 'Clientes') : t('nav.my_clients', 'Clientes')}</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => onTabChange('sellers')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[50px] min-h-[44px] ${
              activeTab === 'sellers' ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">{t('nav.sellers', 'Equipa')}</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => onTabChange('settings')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[50px] min-h-[44px] ${
              activeTab === 'settings' ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">{t('nav.settings', 'Config')}</span>
          </button>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            title={t('nav.logout', 'Terminar Sessão')}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[50px] min-h-[44px] text-rose-600 hover:text-rose-800"
          >
            <LogOut className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">{t('nav.logout', 'Sair')}</span>
          </button>
        )}
      </nav>
    </>
  );
};
