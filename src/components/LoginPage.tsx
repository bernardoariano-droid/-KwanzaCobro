import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  UserPlus,
  Building2,
  Phone,
  User,
} from 'lucide-react';
import { AuthUser, CompanySettings } from '../types/debt';
import {
  signInWithSupabaseAuth,
  signUpWithSupabaseAuth,
  sendPasswordResetEmail,
  updateAuthenticatedPassword,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  AppAuthMode,
  fetchLocalStatus,
  getSavedAuthMode,
  registerLocalCompanyAndAdmin,
  setSavedAuthMode,
  setupLocalSuperAdmin,
  signInLocalhost,
} from '../lib/localStore';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { TempSuperAdminPasswordModal } from './TempSuperAdminPasswordModal';
import { PRESERVED_SUPER_ADMIN_EMAIL } from '../data/initialData';

interface LoginPageProps {
  company: CompanySettings;
  onLoginSuccess: (user: AuthUser, matchedCompany?: CompanySettings, mode?: AppAuthMode) => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  externalError?: string | null;
  onPasswordResetDone?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  company,
  onLoginSuccess,
  initialMode = 'login',
  externalError = null,
  onPasswordResetDone,
}) => {
  const { t } = useLanguage();
  const [authBackendMode, setAuthBackendMode] = useState<AppAuthMode>(
    () => getSavedAuthMode() || 'localhost'
  );
  const [supabaseTablesReady, setSupabaseTablesReady] = useState<boolean | null>(null);
  const [superAdminLocalReady, setSuperAdminLocalReady] = useState<boolean>(false);
  const [showLocalSuperAdminSetup, setShowLocalSuperAdminSetup] = useState<boolean>(false);
  const [localAdminPassword, setLocalAdminPassword] = useState<string>('');

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyNif, setCompanyNif] = useState('');
  const [phone, setPhone] = useState('+244 9');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(externalError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTempResetOpen, setIsTempResetOpen] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (externalError) setError(externalError);
  }, [externalError]);

  useEffect(() => {
    let mounted = true;
    Promise.all([testSupabaseConnection(), fetchLocalStatus()]).then(([supa, local]) => {
      if (!mounted) return;
      const tablesOk = Boolean(supa?.tableExists);
      setSupabaseTablesReady(tablesOk);
      if (local) {
        setSuperAdminLocalReady(Boolean(local.superAdminHasPassword));
      }
      if (!getSavedAuthMode()) {
        const preferred: AppAuthMode = tablesOk ? 'supabase' : 'localhost';
        setAuthBackendMode(preferred);
        setSavedAuthMode(preferred);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSwitchBackendMode = (nextMode: AppAuthMode) => {
    setAuthBackendMode(nextMode);
    setSavedAuthMode(nextMode);
    setError(null);
    setSuccessMsg(null);
    if (nextMode === 'localhost' && (mode === 'forgot' || mode === 'reset')) {
      setMode('login');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (authBackendMode === 'localhost') {
        const result = await signInLocalhost(email, password);
        if (!result.ok) {
          setError(result.error);
          if (result.needsLocalPasswordSetup) {
            setShowLocalSuperAdminSetup(true);
          }
          return;
        }
        onLoginSuccess(result.user, result.company, 'localhost');
        return;
      }

      const result = await signInWithSupabaseAuth(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLoginSuccess(result.user, result.company, 'supabase');
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalSuperAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (localAdminPassword.length < 6) {
      setError('A palavra-passe local do Super Admin deve ter pelo menos 6 caracteres.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await setupLocalSuperAdmin(localAdminPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLoginSuccess(result.user, result.company, 'localhost');
    } catch (err: any) {
      setError(err?.message || 'Erro ao configurar Super Admin no localhost.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setError('Informe o seu nome completo.');
      return;
    }
    if (!companyName.trim()) {
      setError('Informe o nome da empresa.');
      return;
    }
    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      if (authBackendMode === 'localhost') {
        const result = await registerLocalCompanyAndAdmin({
          name: fullName,
          email,
          password,
          phone,
          companyName,
          nif: companyNif,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onLoginSuccess(result.user, result.company, 'localhost');
        return;
      }

      const result = await signUpWithSupabaseAuth({
        name: fullName,
        email,
        password,
        phone,
        companyName,
        nif: companyNif,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.needsEmailConfirmation) {
        setSuccessMsg(result.message);
        setPassword('');
        setConfirmPassword('');
        setMode('login');
        return;
      }

      onLoginSuccess(result.user, result.company, 'supabase');
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao registar conta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const result = await sendPasswordResetEmail(email);
      if (!result.ok) {
        setError(result.error || 'Não foi possível enviar o e-mail de recuperação.');
        return;
      }
      setSuccessMsg(
        'E-mail de recuperação enviado! Verifique a sua caixa de entrada e siga a ligação segura para redefinir a palavra-passe.'
      );
    } catch (err: any) {
      setError(err?.message || 'Erro ao solicitar recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setError('A nova palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateAuthenticatedPassword(password);
      if (!result.ok) {
        setError(result.error || 'Erro ao atualizar palavra-passe.');
        return;
      }
      setSuccessMsg('Palavra-passe redefinida com sucesso! A concluir o acesso...');
      setPassword('');
      setConfirmPassword('');
      if (onPasswordResetDone) {
        setTimeout(() => onPasswordResetDone(), 800);
      } else {
        setMode('login');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao redefinir palavra-passe.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900 selection:bg-emerald-600 selection:text-white">
      {/* Background Decor Elements */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="relative w-full max-w-md md:max-w-2xl mx-auto transition-all">
        {/* Seletor de Idiomas no Topo da Página de Login */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-xs font-semibold text-emerald-300">
            KwanzaCobro · Gestão de Dívidas
          </span>
          <LanguageSelector />
        </div>

        {/* Brand Card - Modern Green and White */}
        <div className="bg-white rounded-3xl shadow-2xl border border-emerald-500/20 overflow-hidden">
          {/* Header com Logomarca Oficial em Verde e Branco */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-emerald-50/80 to-white border-b border-emerald-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-mono font-black text-2xl shadow-md shadow-emerald-700/20 mb-3 overflow-hidden p-1.5 bg-white border border-emerald-200">
              <img
                src={company?.logoUrl || '/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg'}
                alt="KwanzaCobro"
                className="w-full h-full object-contain"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Kwanza<span className="text-emerald-700">Cobro</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold uppercase tracking-wider mt-1">
              {t('app.slogan', 'Gestão e Controlo de Dívidas Empresariais')}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-800 font-medium mt-1">
              {mode === 'forgot'
                ? 'Recuperação de Palavra-Passe Segura'
                : mode === 'reset'
                ? 'Definir Nova Palavra-Passe de Acesso'
                : mode === 'register'
                ? authBackendMode === 'localhost'
                  ? 'Criar Conta Empresarial Isolada na Base Localhost'
                  : 'Criar Conta Empresarial Isolada no Supabase Auth'
                : 'Recuperação de Crédito, Comprovativos Oficiais e Avisos de Vencimento'}
            </p>

            {/* Seletor de Ambiente: Localhost vs Supabase Cloud */}
            {mode !== 'reset' && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSwitchBackendMode('localhost')}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      authBackendMode === 'localhost'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Modo Localhost (Base Local)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchBackendMode('supabase')}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      authBackendMode === 'supabase'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Supabase Cloud
                  </button>
                </div>
                {authBackendMode === 'localhost' && supabaseTablesReady === false && (
                  <span className="text-[11px] text-amber-700 font-medium">
                    Base local ativa enquanto as tabelas do Supabase ainda não foram criadas (migração disponível em Configurações).
                  </span>
                )}
              </div>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div className="mt-3 inline-flex p-1 rounded-xl bg-emerald-100/70 border border-emerald-200">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('login');
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-emerald-900 hover:bg-emerald-200/50'
                  }`}
                >
                  Iniciar Sessão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('register');
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-emerald-900 hover:bg-emerald-200/50'
                  }`}
                >
                  Registar Empresa
                </button>
              </div>
            )}
          </div>

          {/* MODO 1: LOGIN PRINCIPAL */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="p-6 sm:p-8 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Caixas de E-mail e Senha: Horizontal no Computador (md:grid-cols-2) e Vertical no Telemóvel (grid-cols-1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Campo E-mail */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('login.ident_label', 'E-mail Corporativo')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="utilizador@empresa.ao"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Campo Palavra-passe */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('login.pass_label', 'Palavra-passe')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer min-h-[44px]"
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                {authBackendMode === 'localhost' ? (
                  <button
                    type="button"
                    onClick={() => setShowLocalSuperAdminSetup(prev => !prev)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                  >
                    {superAdminLocalReady
                      ? 'Redefinir acesso Super Admin Localhost'
                      : `Configurar Super Admin Localhost (${PRESERVED_SUPER_ADMIN_EMAIL})`}
                  </button>
                ) : (
                  <span />
                )}
                {authBackendMode === 'supabase' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setMode('forgot');
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                  >
                    Esqueceu a palavra-passe?
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[48px]"
              >
                <span>
                  {isLoading
                    ? t('login.authenticating', 'A autenticar...')
                    : authBackendMode === 'localhost'
                    ? 'Entrar no Sistema (Localhost)'
                    : t('login.submit', 'Entrar no Sistema')}
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-200" />
              </button>

              {authBackendMode === 'localhost' && (showLocalSuperAdminSetup || !superAdminLocalReady) && (
                <div className="mt-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        Acesso Super Administrador no Localhost
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Conta preservada: <strong>{PRESERVED_SUPER_ADMIN_EMAIL}</strong>. Defina uma palavra-passe local para entrar e gerir empresas, utilizadores, clientes e dívidas offline.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      minLength={6}
                      placeholder="Nova palavra-passe local (mín. 6 caracteres)"
                      value={localAdminPassword}
                      onChange={e => setLocalAdminPassword(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleLocalSuperAdminSetupSubmit}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      Guardar & Entrar como Super Admin
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* MODO 1B: REGISTO DE NOVA EMPRESA */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="p-6 sm:p-8 space-y-4">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Manuel Domingos"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Empresa <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Comercial Luanda Sul, Lda"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Corporativo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="admin@empresa.ao"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="+244 923 000 000"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIF da Empresa (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 5401928374"
                    value={companyNif}
                    onChange={e => setCompanyNif(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Palavra-passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirmar Palavra-passe <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Repita a palavra-passe"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[48px]"
              >
                <UserPlus className="w-4 h-4 text-emerald-200" />
                <span>{isLoading ? 'A registar empresa e utilizador...' : 'Criar Conta & Iniciar Gestão'}</span>
              </button>
            </form>
          )}

          {/* MODO 2: RECUPERAÇÃO DE PALAVRA-PASSE */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="p-6 sm:p-8 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  E-mail da conta registada
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="utilizador@empresa.ao"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('login');
                  }}
                  className="py-3 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar ao Login</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[48px]"
                >
                  <KeyRound className="w-4 h-4 text-emerald-200" />
                  <span>{isLoading ? 'A enviar ligação...' : 'Enviar Ligação de Recuperação'}</span>
                </button>
              </div>
            </form>
          )}

          {/* MODO 3: REDEFINIÇÃO DE PALAVRA-PASSE (APÓS LINK DE RECOVERY) */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="p-6 sm:p-8 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nova Palavra-passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer min-h-[44px]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirmar Palavra-passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Repita a palavra-passe"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[48px]"
              >
                <KeyRound className="w-4 h-4 text-emerald-200" />
                <span>{isLoading ? 'A guardar...' : 'Guardar Nova Palavra-passe'}</span>
              </button>
            </form>
          )}

          {/* Security & System Info Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {authBackendMode === 'localhost'
                  ? 'Modo Localhost (Ficheiro JSON Seguro) · Pronto para Migração Supabase'
                  : 'Supabase Auth · Controlo de Perfis & Isolamento Multiempresa'}
              </span>
            </div>
            {authBackendMode === 'supabase' && (
              <button
                type="button"
                onClick={() => setIsTempResetOpen(true)}
                className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
              >
                Configuração Temporária · Super Admin
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center text-xs text-emerald-300/80">
          <p>© 2026 KwanzaCobro · Angola · Controlo de Dívidas e Crédito Comercial</p>
        </div>
      </div>

      <TempSuperAdminPasswordModal
        isOpen={isTempResetOpen}
        onClose={() => setIsTempResetOpen(false)}
        isSuperAdminAuthenticated={false}
      />
    </div>
  );
};
