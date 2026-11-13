import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Server,
} from 'lucide-react';
import { getSupabaseAccessToken } from '../lib/supabase';

interface TempSuperAdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSuperAdminAuthenticated: boolean;
}

interface EndpointStatus {
  enabled: boolean;
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
  hasResetToken: boolean;
}

export const TempSuperAdminPasswordModal: React.FC<TempSuperAdminPasswordModalProps> = ({
  isOpen,
  onClose,
  isSuperAdminAuthenticated,
}) => {
  const [setupToken, setSetupToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusInfo, setStatusInfo] = useState<EndpointStatus | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    confirmedEmail?: string;
    confirmedUuid?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    setNewPassword('');
    setConfirmPassword('');
    setSetupToken('');

    let active = true;
    fetch('/api/admin/reset-super-admin-password', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (res.status === 410 || json?.disabled) {
          setStatusInfo({
            enabled: false,
            hasSupabaseUrl: false,
            hasServiceRoleKey: false,
            hasResetToken: false,
          });
          setFeedback({
            type: 'error',
            message: json?.error || 'Esta função temporária foi desativada.',
          });
          return;
        }
        if (json?.success) {
          setStatusInfo({
            enabled: Boolean(json.enabled),
            hasSupabaseUrl: Boolean(json.hasSupabaseUrl),
            hasServiceRoleKey: Boolean(json.hasServiceRoleKey),
            hasResetToken: Boolean(json.hasResetToken),
          });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.trim().length < 6) {
      setFeedback({ type: 'error', message: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'As palavras-passe não coincidem.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isSuperAdminAuthenticated) {
        const jwt = await getSupabaseAccessToken();
        if (jwt) {
          headers.Authorization = `Bearer ${jwt}`;
        }
      }

      if (!headers.Authorization && setupToken.trim()) {
        headers['x-reset-token'] = setupToken.trim();
      }

      const res = await fetch('/api/admin/reset-super-admin-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newPassword }),
      });

      const json = await res.json().catch(() => null);

      // Limpar imediatamente dados sensíveis da memória do formulário
      setNewPassword('');
      setConfirmPassword('');
      setSetupToken('');

      if (!res.ok || !json?.success || !json?.confirmedBySupabase) {
        setFeedback({
          type: 'error',
          message: json?.error || `Erro ao atualizar palavra-passe (HTTP ${res.status}).`,
        });
        return;
      }

      setFeedback({
        type: 'success',
        message: json.message || 'Palavra-passe atualizada e confirmada no Supabase Auth.',
        confirmedEmail: json.email,
        confirmedUuid: json.uuid,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro de comunicação com o servidor.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-emerald-200 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded-full mb-1">
                Interface Temporária Protegida
              </span>
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Definir Palavra-passe do Super Administrador
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Atualização direta no Supabase Auth sem criar outra conta nem alterar RLS.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Dados fixos preservados da conta alvo */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 font-medium">Conta Alvo:</span>
              <span className="font-bold text-slate-900 font-mono">bamidia@gmail.com</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 font-medium">UUID Preservado:</span>
              <span className="font-mono text-[11px] text-emerald-900 font-semibold">
                8b9f3c41-c996-4764-87c2-9d82411584e1
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 font-medium">Perfil Preservado:</span>
              <span className="font-mono font-bold text-emerald-800">super_admin</span>
            </div>
          </div>

          {/* Diagnóstico seguro de variáveis no servidor (Vercel) */}
          {statusInfo && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 flex items-start gap-2">
              <Server className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">Estado do Servidor Backend</div>
                <div>
                  <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>:{' '}
                  <strong className={statusInfo.hasServiceRoleKey ? 'text-emerald-700' : 'text-rose-700'}>
                    {statusInfo.hasServiceRoleKey ? 'Configurada' : 'Em falta na Vercel/Servidor'}
                  </strong>
                </div>
                {!isSuperAdminAuthenticated && (
                  <div>
                    <code className="font-mono">SUPER_ADMIN_RESET_TOKEN</code>:{' '}
                    <strong className={statusInfo.hasResetToken ? 'text-emerald-700' : 'text-amber-700'}>
                      {statusInfo.hasResetToken ? 'Configurado' : 'Configure na Vercel (mín. 16 caracteres)'}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{feedback.message}</p>
                {feedback.confirmedEmail && (
                  <p className="text-[11px] text-emerald-800">
                    Confirmado no Supabase Auth: <strong>{feedback.confirmedEmail}</strong> · UUID:{' '}
                    <code className="font-mono">{feedback.confirmedUuid}</code>
                  </p>
                )}
              </div>
            </div>
          )}

          {!isSuperAdminAuthenticated && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Token de Autorização do Servidor (SUPER_ADMIN_RESET_TOKEN) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  required
                  autoComplete="off"
                  placeholder="Introduza o token configurado na Vercel"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nova Palavra-passe *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres (recomendado 10+)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirmar Nova Palavra-passe *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Repita a nova palavra-passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || statusInfo?.enabled === false}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? 'A atualizar no Supabase Auth...' : 'Atualizar Palavra-passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
