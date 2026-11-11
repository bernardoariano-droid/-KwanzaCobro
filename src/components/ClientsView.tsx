import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  MapPin, 
  Building2, 
  User, 
  MessageSquare, 
  Plus, 
  Send, 
  X, 
  CreditCard, 
  Calendar, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Client, Debt, CompanySettings, AuthUser } from '../types/debt';
import { formatKwanza, getRemainingBalance, getDaysDiff, formatDate } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface ClientsViewProps {
  clients: Client[];
  debts: Debt[];
  currentUser?: AuthUser | null;
  company?: CompanySettings;
  onOpenNewClient: () => void;
  onOpenNewDebtForClient: (clientId: string) => void;
  onFilterDebtsByClient: (clientId: string) => void;
  onOpenWhatsAppDirect: (phone: string, clientName: string) => void;
  onOpenPayment?: (debt: Debt) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  debts,
  currentUser,
  company,
  onOpenNewClient,
  onOpenNewDebtForClient,
  onFilterDebtsByClient,
  onOpenWhatsAppDirect,
  onOpenPayment,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [selectedClientForWhatsApp, setSelectedClientForWhatsApp] = useState<Client | null>(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState<'cobranca' | 'lembrete' | 'extrato' | 'livre'>('cobranca');
  const [customTextMessage, setCustomTextMessage] = useState('');

  const isSeller = currentUser?.role === 'vendedor';

  // REGRA DE SEGURANÇA E ISOLAMENTO:
  // Se for vendedor, SÓ PODE VER os clientes atribuídos a si (vendas feitas por ele ou clientes criados por ele)
  const scopedClients = useMemo(() => {
    if (isSeller && currentUser?.id) {
      return clients.filter(c => {
        const isCreatedByHim = c.createdBySellerId === currentUser.id;
        const hasPurchasesWithHim = debts.some(
          d => (d.sellerId === currentUser.id || d.sellerId === currentUser.name) && d.clientId === c.id
        );
        return isCreatedByHim || hasPurchasesWithHim;
      });
    }
    return clients;
  }, [clients, debts, isSeller, currentUser]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    scopedClients.forEach(c => {
      if (c.province) set.add(c.province);
    });
    return Array.from(set).sort();
  }, [scopedClients]);

  // Estatísticas dos clientes autorizados
  const clientsData = useMemo(() => {
    return scopedClients.map(client => {
      // Dívidas deste cliente (se for vendedor, apenas as dívidas dele com este vendedor)
      const clientDebts = debts.filter(d => {
        if (d.clientId !== client.id) return false;
        if (isSeller && currentUser?.id) {
          return d.sellerId === currentUser.id || d.sellerId === currentUser.name;
        }
        return true;
      });

      const activeDebts = clientDebts.filter(d => getRemainingBalance(d) > 0);
      const totalRemaining = activeDebts.reduce((sum, d) => sum + getRemainingBalance(d), 0);
      const hasOverdue = activeDebts.some(d => getDaysDiff(d.dueDate) > 0);
      const nearestDebt = activeDebts.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const creditUtilization = client.creditLimit > 0 
        ? Math.min(100, Math.round((totalRemaining / client.creditLimit) * 100)) 
        : 0;

      return {
        ...client,
        activeDebtsCount: activeDebts.length,
        totalDebtsCount: clientDebts.length,
        totalRemaining,
        hasOverdue,
        nearestDebt,
        creditUtilization,
        availableCredit: Math.max(0, client.creditLimit - totalRemaining),
      };
    });
  }, [scopedClients, debts, isSeller, currentUser]);

  const filteredClients = useMemo(() => {
    return clientsData.filter(client => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = client.name.toLowerCase().includes(query);
        const matchesNif = client.nif?.toLowerCase().includes(query) || false;
        const matchesPhone = client.phone?.toLowerCase().includes(query) || false;
        if (!matchesName && !matchesNif && !matchesPhone) return false;
      }
      if (provinceFilter !== 'all' && client.province !== provinceFilter) {
        return false;
      }
      return true;
    });
  }, [clientsData, searchQuery, provinceFilter]);

  // Totais agregados da carteira visível
  const totalCreditLimitGlobal = scopedClients.reduce((sum, c) => sum + c.creditLimit, 0);
  const totalDebtActiveGlobal = clientsData.reduce((sum, c) => sum + c.totalRemaining, 0);

  // Geração de Mensagem WhatsApp Dinâmica para Cobrança do Vendedor
  const getPreparedWhatsAppMessage = (client: typeof clientsData[0]) => {
    const compName = company?.name || 'KwanzaCobro';
    const sellerName = currentUser?.name || 'Operador Comercial';
    const express = company?.expressPhone || '923 884 100';
    const iban = company?.iban || 'AO06 0040 0000 9812 3456 1012 8';

    if (whatsappTemplate === 'cobranca') {
      return `*AVISO DE COBRANÇA · ${compName}*\n\nPrezado(a) *${client.name}*,\n\nEntramos em contacto em relação ao seu saldo pendente de *${formatKwanza(client.totalRemaining)}* referente a fornecimentos a crédito.\n\n*Dados para Liquidação:*\n• *Multicaixa Express (MCX):* ${express}\n• *IBAN:* ${iban}\n• *Titular:* ${compName}\n\nFavor enviar o comprovativo por este canal para registo no sistema e diminuição imediata da dívida.\n\nAtenciosamente,\n*${sellerName}*\n${compName}`;
    }
    if (whatsappTemplate === 'lembrete') {
      return `*LEMBRETE AMIGÁVEL · ${compName}*\n\nEstimado(a) *${client.name}*,\n\nEsperamos que esteja tudo bem. Lembramos que tem fatura(s) com valor de *${formatKwanza(client.totalRemaining)}* com data de liquidação próxima.\n\nCoordenadas:\n• MCX: ${express}\n• IBAN: ${iban}\n\nObrigado pela preferência,\n${sellerName} · ${compName}`;
    }
    if (whatsappTemplate === 'extrato') {
      return `*EXTRATO DE CONTA CORRENTE · ${compName}*\n\nCliente: *${client.name}*\nNIF: ${client.nif || 'Consumidor Final'}\nPlafond Aprovado: ${formatKwanza(client.creditLimit)}\nDívida sob Gestão: ${formatKwanza(client.totalRemaining)}\nPlafond Disponível: ${formatKwanza(client.availableCredit)}\n\nAtenciosamente,\n${compName}`;
    }
    return customTextMessage;
  };

  const handleSendWhatsAppToClient = (client: typeof clientsData[0]) => {
    const message = getPreparedWhatsAppMessage(client);
    let cleanPhone = client.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 9) {
      cleanPhone = '244' + cleanPhone;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setSelectedClientForWhatsApp(null);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-12 max-w-full overflow-x-hidden">
      {/* Banner de Isolamento do Vendedor */}
      {isSeller && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold">Controlo do Vendedor ({currentUser?.name}):</span>{' '}
              <span>A exibir exclusivamente os clientes da sua carteira comercial.</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t('clients.title', 'Registo e Gestão de Clientes')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t('clients.subtitle', 'Consulte o histórico de crédito, plafonds e saldo devedor.')}
          </p>
        </div>

        {!isSeller && (
          <button
            onClick={onOpenNewClient}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-200" />
            <span>{t('clients.btn_register', '+ Novo Cliente')}</span>
          </button>
        )}
      </div>

      {/* 3 Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">
            {isSeller ? 'Clientes na Minha Carteira' : t('dashboard.total_clients', 'Total de Clientes')}
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1" data-tabular>
            {scopedClients.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {scopedClients.filter(c => c.clientType === 'empresa').length} empresas · {scopedClients.filter(c => c.clientType === 'particular').length} particulares
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">
            {t('clients.credit_limit', 'Plafond Aprovado')}
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1" data-tabular>
            {formatKwanza(totalCreditLimitGlobal, false)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Limite total de segurança autorizado
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">
            {t('clients.current_debt', 'Dívida Ativa')}
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1" data-tabular>
            {formatKwanza(totalDebtActiveGlobal, false)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalCreditLimitGlobal > 0 ? Math.round((totalDebtActiveGlobal / totalCreditLimitGlobal) * 100) : 0}% de exposição de crédito
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtro de Província */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('clients.search_placeholder', 'Buscar por nome, NIF ou telefone...')}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">{t('common.filter', 'Filtrar')}:</span>
          <select
            value={provinceFilter}
            onChange={e => setProvinceFilter(e.target.value)}
            className="py-1.5 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">{t('common.all', 'Todas as Províncias')} ({provinces.length})</option>
            {provinces.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Clientes Vazia */}
      {filteredClients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">{t('clients.empty_title', 'Nenhum cliente cadastrado')}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Nenhum registo corresponde aos filtros de pesquisa.
          </p>
          <button
            onClick={onOpenNewClient}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-200" />
            <span>{t('clients.btn_register', '+ Novo Cliente')}</span>
          </button>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* MODO MOBILE / ANDROID FIRST (block md:hidden): CARDS SEM BARRA HORIZONTAL */}
          {/* ============================================================== */}
          <div className="block md:hidden space-y-3.5">
            {filteredClients.map(client => (
              <div 
                key={client.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      {client.clientType === 'empresa' ? (
                        <Building2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <User className="w-4 h-4 text-emerald-700" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{client.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        NIF: {client.nif || 'Consumidor'} · {client.province}
                      </div>
                    </div>
                  </div>

                  {client.hasOverdue ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded shrink-0">
                      Vencida
                    </span>
                  ) : client.totalRemaining > 0 ? (
                    <span className="px-2 py-0.5 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded shrink-0">
                      Em Aberto
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded shrink-0">
                      Regularizado
                    </span>
                  )}
                </div>

                {/* Contacto telefónico com clique direto */}
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Telefone:</span>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`tel:${client.phone}`}
                      className="font-mono font-bold text-emerald-700 flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>{client.phone}</span>
                    </a>
                  </div>
                </div>

                {/* Valores Financeiros */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-500">{t('clients.credit_limit', 'Plafond')}</div>
                    <div className="font-mono font-bold text-slate-800 mt-0.5" data-tabular>
                      {formatKwanza(client.creditLimit, false)}
                    </div>
                  </div>
                  <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    <div className="text-[10px] text-amber-800 font-medium">{t('clients.current_debt', 'Dívida Ativa')}</div>
                    <div className="font-mono font-black text-amber-900 mt-0.5" data-tabular>
                      {formatKwanza(client.totalRemaining)}
                    </div>
                  </div>
                </div>

                {/* Barra de Utilização do Plafond */}
                <div className="mt-2">
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1">
                    <div 
                      className={`h-full rounded-full ${client.creditUtilization > 90 ? 'bg-rose-600' : 'bg-emerald-600'}`}
                      style={{ width: `${client.creditUtilization}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Uso: {client.creditUtilization}%</span>
                    <span>Disp: {formatKwanza(client.availableCredit, false)}</span>
                  </div>
                </div>

                {/* Ações Móveis (min-h-[44px] para toque no ecrã) */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Botão de Amortização Directa */}
                    {onOpenPayment && client.totalRemaining > 0 ? (
                      <button
                        onClick={() => {
                          const activeDebt = debts.find(d => d.clientId === client.id && getRemainingBalance(d) > 0);
                          if (activeDebt) {
                            onOpenPayment(activeDebt);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1 py-2.5 px-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>{t('debts.btn_amortize', 'Amortizar')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenNewDebtForClient(client.id)}
                        className="w-full flex items-center justify-center gap-1 py-2.5 px-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('clients.btn_new_sale', '+ Venda')}</span>
                      </button>
                    )}

                    {/* Botão de Cobrança WhatsApp */}
                    <button
                      onClick={() => setSelectedClientForWhatsApp(client)}
                      className="w-full flex items-center justify-center gap-1 py-2.5 px-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => onFilterDebtsByClient(client.id)}
                      className="py-2 px-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                    >
                      <span>{t('nav.debts', 'Dívidas')} ({client.activeDebtsCount})</span>
                    </button>

                    <button
                      onClick={() => onOpenNewDebtForClient(client.id)}
                      className="py-2 px-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('clients.btn_new_sale', 'Nova Compra')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ============================================================== */}
          {/* MODO DESKTOP / TABLET (hidden md:block): TABELA DETALHADA */}
          {/* ============================================================== */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{t('clients.name', 'Cliente / Contacto')}</th>
                    <th className="py-3 px-4">{t('clients.province', 'Localização')}</th>
                    <th className="py-3 px-4 text-right">{t('clients.credit_limit', 'Limite de Crédito')}</th>
                    <th className="py-3 px-4 text-right">{t('clients.current_debt', 'Dívida sob Gestão')}</th>
                    <th className="py-3 px-4 text-center">Utilização</th>
                    <th className="py-3 px-4 text-center">{t('debts.status', 'Estado')}</th>
                    <th className="py-3 px-4 text-center">{t('debts.actions', 'Ações')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                            {client.clientType === 'empresa' ? (
                              <Building2 className="w-4 h-4 text-emerald-800" />
                            ) : (
                              <User className="w-4 h-4 text-emerald-800" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{client.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>NIF: {client.nif || 'N/A'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-slate-700">{client.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{client.province}</div>
                        <div className="text-[11px] text-slate-400">{client.municipality || '-'}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-xs font-semibold text-slate-700" data-tabular>
                        {formatKwanza(client.creditLimit, false)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-xs font-bold text-slate-900" data-tabular>
                        <span className={client.totalRemaining > 0 ? 'text-amber-800' : 'text-slate-500'}>
                          {formatKwanza(client.totalRemaining)}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono font-normal">
                          Disp: {formatKwanza(client.availableCredit, false)}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="w-20 mx-auto bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1">
                          <div 
                            className={`h-full rounded-full ${client.creditUtilization > 90 ? 'bg-rose-600' : 'bg-emerald-600'}`}
                            style={{ width: `${client.creditUtilization}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-600 font-medium">
                          {client.creditUtilization}%
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        {client.hasOverdue ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                            Vencida (Cobrar)
                          </span>
                        ) : client.totalRemaining > 0 ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                            Em Aberto
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                            Sem Dívidas
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Amortização Directa */}
                          {onOpenPayment && client.totalRemaining > 0 && (
                            <button
                              onClick={() => {
                                const activeDebt = debts.find(d => d.clientId === client.id && getRemainingBalance(d) > 0);
                                if (activeDebt) {
                                  onOpenPayment(activeDebt);
                                }
                              }}
                              title={t('debts.btn_amortize', 'Amortizar')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                              <span>{t('debts.btn_amortize', 'Amortizar')}</span>
                            </button>
                          )}

                          {/* WhatsApp Cobrança */}
                          <button
                            onClick={() => setSelectedClientForWhatsApp(client)}
                            title={t('common.whatsapp', 'Enviar WhatsApp')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs active:scale-95 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Ver Dívidas do Cliente */}
                          <button
                            onClick={() => onFilterDebtsByClient(client.id)}
                            title="Ver faturas a crédito deste cliente"
                            className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Ver ({client.activeDebtsCount})
                          </button>

                          {/* Nova Venda a Crédito */}
                          <button
                            onClick={() => onOpenNewDebtForClient(client.id)}
                            title={t('clients.btn_new_sale', 'Nova Venda')}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Interativo de Disparo de WhatsApp para o Cliente do Vendedor */}
      {selectedClientForWhatsApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <MessageSquare className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Cobrança Direta via WhatsApp</h3>
                  <p className="text-xs text-emerald-200">
                    {selectedClientForWhatsApp.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClientForWhatsApp(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 space-y-4">
              {/* Resumo do Cliente */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{selectedClientForWhatsApp.name}</div>
                  <div className="text-slate-500 font-mono mt-0.5">WhatsApp: {selectedClientForWhatsApp.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[11px]">{t('debts.balance', 'Dívida em Aberto')}:</div>
                  <div className="font-bold font-mono text-sm text-amber-700">
                    {formatKwanza(
                      clientsData.find(c => c.id === selectedClientForWhatsApp.id)?.totalRemaining || 0
                    )}
                  </div>
                </div>
              </div>

              {/* Seletor de Modelo de Mensagem */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Selecione o Modelo de Mensagem:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setWhatsappTemplate('cobranca')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      whatsappTemplate === 'cobranca'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cobrança de Dívida</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Com IBAN e Multicaixa</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWhatsappTemplate('lembrete')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      whatsappTemplate === 'lembrete'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Lembrete de Prazo</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Aviso prévio amigável</p>
                  </button>
                </div>
              </div>

              {/* Pré-visualização do Texto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pré-visualização da Mensagem:
                </label>
                <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed border border-slate-800 shadow-inner">
                  {getPreparedWhatsAppMessage(
                    clientsData.find(c => c.id === selectedClientForWhatsApp.id)!
                  )}
                </div>
              </div>

              {/* Ações do Modal */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedClientForWhatsApp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const client = clientsData.find(c => c.id === selectedClientForWhatsApp.id)!;
                    handleSendWhatsAppToClient(client);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('common.whatsapp', 'Abrir WhatsApp')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
