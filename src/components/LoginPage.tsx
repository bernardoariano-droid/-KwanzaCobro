import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  UserCheck,
  Eye,
  EyeOff,
  Sparkles,
  Globe
} from 'lucide-react';
import { AuthUser, Seller, CompanySettings } from '../types/debt';
import { defaultAdminUser } from '../data/initialData';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface LoginPageProps {
  sellers: Seller[];
  company: CompanySettings;
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ sellers, company, onLoginSuccess }) => {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (!SUPABASE_CONFIGURED) throw new Error('O Supabase ainda não está configurado. Contacte o administrador do sistema.');
      const email = identifier.trim().toLowerCase();
      if (!email.includes('@')) throw new Error('Utilize o endereço de e-mail associado à sua conta.');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) throw new Error('E-mail ou senha incorrectos. Se ainda não activou a conta, contacte o administrador.');

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id,seller_id,full_name,role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (profileError || !profile || !['admin', 'vendedor'].includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error('A conta autenticou, mas ainda não tem um perfil/permissão atribuído. Contacte o administrador.');
      }

      let seller: any = null;
      if (profile.seller_id) {
        const { data: sellerRow } = await supabase
          .from('sellers')
          .select('id,name,email,phone,branch')
          .eq('id', profile.seller_id)
          .maybeSingle();
        seller = sellerRow;
      }
      onLoginSuccess({
        id: seller?.id || data.user.id,
        name: profile.full_name || seller?.name || data.user.email || 'Utilizador',
        email: data.user.email || '',
        phone: seller?.phone || '',
        role: profile.role,
        branch: seller?.branch || '',
      });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar sessão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setError(null);
    const email = identifier.trim().toLowerCase();
    if (!email.includes('@')) {
      setError('Introduza primeiro o seu e-mail para receber a ligação de recuperação.');
      return;
    }
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setError(recoveryError ? recoveryError.message : 'Se o e-mail estiver registado, receberá uma ligação para redefinir a senha.');
  };

  const handleQuickLoginAdmin = () => {
    setIdentifier('admin@kwanzacobro.ao');
    setPassword('admin');
    setError(null);
    onLoginSuccess({
      ...defaultAdminUser,
      name: 'Administrador Geral · KwanzaCobro',
      email: 'admin@kwanzacobro.ao',
    });
  };

  const handleQuickLoginSeller = (seller: Seller) => {
    setIdentifier(seller.email || seller.phone);
    setPassword('123');
    setError(null);
    onLoginSuccess({
      id: seller.id,
      name: seller.name,
      email: seller.email || `${seller.name.toLowerCase().replace(/\s+/g, '.')}@kwanzacobro.ao`,
      phone: seller.phone,
      role: seller.role || 'vendedor',
      branch: seller.branch,
    });
  };

  return (
    <div className="min-h-screen bg-emerald-950 bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900 selection:bg-emerald-600 selection:text-white">
      {/* Background Decor Elements */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="relative w-full max-w-md mx-auto">
        {/* Seletor de Idiomas no Topo da Página de Login */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-emerald-200/90">
            NEUROJUS · Gestão de Crédito Comercial
          </span>
          <LanguageSelector />
        </div>

        {/* Brand Card Top */}
        <div className="bg-white rounded-3xl shadow-2xl border border-emerald-500/30 overflow-hidden">
          {/* Identidade visual NEUROJUS */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-emerald-50/70 to-white border-b border-slate-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-white font-mono font-black text-2xl shadow-md mb-3">
              NJ
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              <span className="text-emerald-800">NEURO</span><span className="text-emerald-600">JUS</span>
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
              Gestão e Controlo de Dívidas Empresariais
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              Recuperação de Crédito, Comprovativos Oficiais e Avisos de Vencimento
            </p>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="neurojus-identifier" className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('login.ident_label', 'E-mail de Acesso')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="neurojus-identifier"
                  name="identifier"
                  autoComplete="username"
                  type="email"
                  required
                  placeholder="seuemail@empresa.ao"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="neurojus-password" className="block text-xs font-bold text-slate-700">
                  {t('login.pass_label', 'Senha de Acesso')}
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="neurojus-password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-right -mt-2">
              <button type="button" onClick={handlePasswordRecovery} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                Esqueci-me da senha
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              <span>{isLoading ? t('login.authenticating', 'A autenticar...') : t('login.submit', 'Entrar no Sistema')}</span>
              <ArrowRight className="w-4 h-4 text-emerald-200" />
            </button>
          </form>

          {/* Acessos rápidos disponíveis apenas em desenvolvimento */}
          {import.meta.env.DEV && <div className="px-6 sm:px-8 pb-6 pt-2 border-t border-slate-100 bg-slate-50/70 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-center">
              {sellers.length > 0 ? 'Acesso Rápido para Avaliação' : 'Acesso de Administrador Geral'}
            </span>

            <div className={`grid gap-2 ${sellers.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={handleQuickLoginAdmin}
                className="py-3 px-3.5 bg-white border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl transition-all text-left shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0 font-mono">
                    A
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block group-hover:text-emerald-900">
                      Entrar como Administrador Geral
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Acesso total para cadastrar funcionários, clientes e gerir o sistema
                    </span>
                  </div>
                </div>
              </button>

              {sellers.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleQuickLoginSeller(sellers[0])}
                  className="py-2.5 px-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl transition-all text-left shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                      V
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block group-hover:text-amber-900 truncate">
                        {sellers[0].name.split(' ')[0]} (Vendedor)
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Carteira individual
                      </span>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {sellers.length === 0 && (
              <p className="text-[11px] text-slate-500 text-center pt-1">
                Base de dados limpa com sucesso. Entre com o Administrador para começar a registar a sua equipa.
              </p>
            )}

            {/* Outros Vendedores disponíveis para teste */}
            {sellers.length > 1 && (
              <div className="pt-1 text-center">
                <span className="text-[10px] text-slate-400 block mb-1">Outros vendedores da equipa:</span>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {sellers.slice(1, 4).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleQuickLoginSeller(s)}
                      className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:border-emerald-300 rounded-md text-slate-600 transition-colors cursor-pointer"
                    >
                      {s.name.split(' ')[0]} ({s.branch.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>}
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-emerald-200/80">
          <p>© 2026 NEUROJUS · Angola · Gestão de Crédito Comercial</p>
        </div>
      </div>
    </div>
  );
};
