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
} from 'lucide-react';
import { AuthUser, CompanySettings } from '../types/debt';
import {
  signInWithSupabaseAuth,
  sendPasswordResetEmail,
  updateAuthenticatedPassword,
} from '../lib/supabase';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { TempSuperAdminPasswordModal } from './TempSuperAdminPasswordModal';

interface LoginPageProps {
  company: CompanySettings;
  onLoginSuccess: (user: AuthUser, matchedCompany?: CompanySettings) => void;
  initialMode?: 'login' | 'forgot' | 'reset';
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
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const result = await signInWithSupabaseAuth(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLoginSuccess(result.user, result.company);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao autenticar.');
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
                : 'Recuperação de Crédito, Comprovativos Oficiais e Avisos de Vencimento'}
            </p>
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

              <div className="flex items-center justify-end">
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
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[48px]"
              >
                <span>{isLoading ? t('login.authenticating', 'A autenticar...') : t('login.submit', 'Entrar no Sistema')}</span>
                <ArrowRight className="w-4 h-4 text-emerald-200" />
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
              <span>Supabase Auth · Controlo de Perfis & Isolamento Multiempresa</span>
            </div>
            <button
              type="button"
              onClick={() => setIsTempResetOpen(true)}
              className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              Configuração Temporária · Super Admin
            </button>
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
