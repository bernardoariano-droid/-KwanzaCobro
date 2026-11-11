import React, { useState } from 'react';
import { X, UserPlus, Building2, User, Phone, MapPin, CreditCard } from 'lucide-react';
import { Client, ClientType } from '../types/debt';
import { formatKwanza } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Omit<Client, 'id' | 'createdAt'>) => void;
}

const angolanProvinces = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huíla',
  'Cabinda',
  'Cuanza Sul',
  'Cuanza Norte',
  'Uíge',
  'Malanje',
  'Namibe',
  'Zaire',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Bié',
  'Cuando Cubango',
  'Cunene',
  'Bengo',
];

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState<ClientType>('empresa');
  const [nif, setNif] = useState('');
  const [phone, setPhone] = useState('+244 9');
  const [email, setEmail] = useState('');
  const [province, setProvince] = useState('Luanda');
  const [municipality, setMunicipality] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(5000000); // 5 Milhões Kz padrão
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('O Nome do Cliente é obrigatório.');
      return;
    }
    if (!phone.trim()) {
      alert('O Telefone é obrigatório para notificações e cobranças.');
      return;
    }

    onSave({
      name: name.trim(),
      clientType,
      nif: nif.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      province,
      municipality: municipality.trim(),
      address: address.trim(),
      creditLimit: Number(creditLimit) || 0,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold">{t('clients.btn_register', 'Cadastrar Novo Cliente')}</h2>
              <p className="text-xs text-slate-300">
                {t('clients.subtitle', 'Registo de dados fiscais e atribuição de limite de crédito')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Tipo de Cliente */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-semibold text-slate-700">Tipo de Cliente:</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="clientType"
                  value="empresa"
                  checked={clientType === 'empresa'}
                  onChange={() => setClientType('empresa')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Empresa (B2B)</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="clientType"
                  value="particular"
                  checked={clientType === 'particular'}
                  onChange={() => setClientType('particular')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Particular / Individual</span>
              </label>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {clientType === 'empresa' ? 'Denominação Social / Razão Social' : 'Nome Completo do Cliente'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={clientType === 'empresa' ? 'Ex: Armazém São Paulo Comercial, Lda' : 'Ex: Domingos Baptista Kiala'}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* NIF e Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIF (Número de Identificação Fiscal)
              </label>
              <input
                type="text"
                placeholder="Ex: 5418290192"
                value={nif}
                onChange={e => setNif(e.target.value)}
                className="w-full py-2 px-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="+244 923 000 000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full py-2 px-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail de Contacto
            </label>
            <input
              type="email"
              placeholder="cliente@exemplo.ao"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Província e Município */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Província
              </label>
              <select
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {angolanProvinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Município / Bairro
              </label>
              <input
                type="text"
                placeholder="Ex: Viana, Belas, Talatona, etc."
                value={municipality}
                onChange={e => setMunicipality(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço Comercial / Físico
            </label>
            <input
              type="text"
              placeholder="Rua, número, ponto de referência..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Limite de Crédito Aprovado */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="block text-xs font-bold text-amber-900 mb-1">
              Plafond / Limite de Crédito Aprovado (Kz) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={creditLimit}
              onChange={e => setCreditLimit(Number(e.target.value))}
              className="w-full py-2 px-3 text-sm font-bold font-mono border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
            />
            <p className="text-[11px] text-amber-800 mt-1">
              O sistema alertará os vendedores caso novas vendas a crédito ultrapassem {formatKwanza(creditLimit, false)}.
            </p>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas Adicionais / Histórico
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Preferência por entregas às terças-feiras. Pagamentos via MCX."
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {t('common.save', 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
