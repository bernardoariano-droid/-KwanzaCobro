import React, { useState } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  Phone, 
  Building2, 
  TrendingUp, 
  Receipt, 
  Plus, 
  X, 
  Check, 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  AlertCircle, 
  Trash2,
  Users
} from 'lucide-react';
import { Seller, Debt, AuthUser } from '../types/debt';
import { formatKwanza, getRemainingBalance, getPaidAmount, getDaysDiff } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface SellersViewProps {
  sellers: Seller[];
  debts: Debt[];
  currentUser?: AuthUser | null;
  onAddSeller: (seller: Omit<Seller, 'id'>) => Promise<void>;
  onDeleteSeller?: (sellerId: string) => void;
  onFilterDebtsBySeller: (sellerId: string) => void;
}

export const SellersView: React.FC<SellersViewProps> = ({
  sellers,
  debts,
  currentUser,
  onAddSeller,
  onDeleteSeller,
  onFilterDebtsBySeller,
}) => {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+244 9');
  const [branch, setBranch] = useState('Armazém Central Viana');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'vendedor' | 'admin'>('vendedor');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const formattedEmail = email.trim().toLowerCase();
    if (!formattedEmail.includes('@') || password.trim().length < 8) {
      alert('Informe um e-mail válido e uma senha inicial com pelo menos 8 caracteres.');
      return;
    }

    try {
      await onAddSeller({
      name: name.trim(),
      phone: phone.trim(),
      branch: branch.trim(),
      email: formattedEmail,
      password: password.trim(),
      role,
      createdAt: new Date().toISOString().slice(0, 10),
      });
      setSuccessMessage(`${name.trim()} - Conta criada para ${formattedEmail}.`);
    setTimeout(() => setSuccessMessage(null), 6000);

      setName('');
      setEmail('');
      setPassword('');
      setIsAdding(false);
    } catch (error: any) {
      setSuccessMessage(null);
      alert(error?.message || 'Não foi possível criar a conta do funcionário.');
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-12">
      {/* Header com estilo moderno SaaS do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              {t('sellers.title', 'Funcionários e Permissões')}
            </span>
            {isAdmin ? (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {t('role.admin', 'Administrador Geral')}
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                {t('role.seller', 'Vendedor / Funcionário')}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t('sellers.subtitle', 'Gestão de equipa comercial, vendedores e permissões.')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            {isAdmin 
              ? 'Como Administrador, pode cadastrar novos funcionários, definir as suas credenciais de acesso e auditar a carteira de cada vendedor.' 
              : 'Lista da equipa comercial. Cada vendedor acede e cobra a sua própria carteira de clientes.'}
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-100" />
            <span>+ {t('common.save', 'Novo Funcionário / Vendedor')}</span>
          </button>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
            Apenas o Administrador pode cadastrar novos utilizadores.
          </div>
        )}
      </div>

      {/* Alerta de Sucesso */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-900 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>Funcionário cadastrado com sucesso! {successMessage}</span>
        </div>
      )}

      {/* Formulário do Administrador para Cadastrar Funcionário/Vendedor */}
      {isAdding && isAdmin && (
        <form onSubmit={handleSave} noValidate className="p-5 sm:p-6 bg-white border border-emerald-200 rounded-2xl shadow-md space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900">
                Cadastrar Novo Funcionário com Acesso ao Sistema
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Mateus Afonso Pascoal"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefone / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="+244 923 000 000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filial / Posto de Atendimento <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Armazém Viana, Filial Benguela..."
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail de Login
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="funcionario@empresa.ao"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Senha inicial (mínimo 8 caracteres) <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full py-2 px-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nível de Permissão
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'vendedor' | 'admin')}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="vendedor">{t('role.seller', 'Vendedor')} (Controla a sua carteira)</option>
                <option value="admin">{t('role.admin', 'Administrador')} (Controlo total da empresa)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('common.save', 'Gravar e Ativar Acesso')}
            </button>
          </div>
        </form>
      )}

      {/* Grid de Vendedores / Funcionários */}
      {sellers.length === 0 ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs">
            <UserPlus className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              Nenhum funcionário ou vendedor cadastrado
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Como Administrador Geral, pode cadastrar os funcionários e vendedores reais para emitirem cobranças, recibos e acompanharem clientes.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-100" />
              <span>Cadastrar Primeiro Funcionário</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {sellers.map(seller => {
            const sellerDebts = debts.filter(d => d.sellerId === seller.id);
            const totalSoldCredit = sellerDebts.reduce((sum, d) => sum + d.totalAmount, 0);
            const totalPaid = sellerDebts.reduce((sum, d) => sum + getPaidAmount(d), 0);
            const totalRemaining = Math.max(0, totalSoldCredit - totalPaid);
            const overdueCount = sellerDebts.filter(d => getRemainingBalance(d) > 0 && getDaysDiff(d.dueDate) > 0).length;
            const recoveryRate = totalSoldCredit > 0 ? Math.round((totalPaid / totalSoldCredit) * 100) : 0;
            const isCurrentSessionSeller = currentUser?.id === seller.id;

            return (
              <div 
                key={seller.id} 
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  isCurrentSessionSeller ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-slate-900">{seller.name}</h3>
                        {isCurrentSessionSeller && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{seller.branch}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {seller.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{seller.phone}</span>
                    </div>
                    {seller.email && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{seller.email}</span>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200">
                        <KeyRound className="w-3 h-3 text-emerald-600" />
                        <span>Autenticação protegida pelo Supabase Auth</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Estatísticas Financeiras do Vendedor */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Vendas a Crédito ({sellerDebts.length}):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatKwanza(totalSoldCredit, false)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total Recuperado:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {formatKwanza(totalPaid, false)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-bold">
                    <span className="text-rose-800">Saldo Pendente:</span>
                    <span className="font-mono text-rose-800">
                      {formatKwanza(totalRemaining, false)}
                    </span>
                  </div>

                  {/* Barra de Recuperação */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                      <span className="text-slate-500">Eficácia de Cobrança</span>
                      <span className="font-mono text-slate-800">{recoveryRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${recoveryRate >= 70 ? 'bg-emerald-600' : 'bg-emerald-600'}`}
                        style={{ width: `${recoveryRate}%` }}
                      />
                    </div>
                  </div>

                  {overdueCount > 0 && (
                    <div className="text-[11px] text-rose-700 font-semibold pt-1">
                      ⚠️ {overdueCount} {overdueCount === 1 ? 'dívida vencida' : 'dívidas vencidas'} a requerer cobrança.
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onFilterDebtsBySeller(seller.id)}
                    className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Ver Carteira</span>
                  </button>
                  {isAdmin && onDeleteSeller && !isCurrentSessionSeller && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Tem a certeza de que deseja remover o funcionário ${seller.name}?`)) {
                          onDeleteSeller(seller.id);
                        }
                      }}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors cursor-pointer"
                      title="Remover Funcionário"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
