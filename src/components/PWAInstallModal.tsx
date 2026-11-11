import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Laptop, 
  Download, 
  CheckCircle2, 
  QrCode as QrCodeIcon, 
  Share2, 
  PlusSquare, 
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [installSuccess, setInstallSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');

  const currentAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://kwanzacobro.ao';

  useEffect(() => {
    if (isOpen) {
      if (isIOS) setActiveTab('ios');
      else if (isAndroid) setActiveTab('android');

      // Generate QR Code for easy mobile scanning
      QRCode.toDataURL(currentAppUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#1e3a8a',
          light: '#ffffff',
        },
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Erro ao gerar QR Code PWA:', err));
    }
  }, [isOpen, isIOS, isAndroid, currentAppUrl]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        setInstallSuccess(false);
        onClose();
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 flex flex-col">
        {/* Top Header com Azul Institucional e Logomarca Oficial */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden border border-white/20">
              <img 
                src="/assets/aistudio/IMG-20261010-WA0062_2b38905c.jpg" 
                alt="KwanzaCobro" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">Instalar KwanzaCobro</h2>
                <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  APK & PWA
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Compatível com Telemóveis Android, Tablets e Computadores
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Segment Tabs */}
        <div className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'android'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android (APK)</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>iPhone / iPad</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Computador</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-5">
          {/* Status if already installed */}
          {isInstalled && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>A aplicação KwanzaCobro já se encontra instalada no seu dispositivo com o ícone oficial!</span>
            </div>
          )}

          {installSuccess && (
            <div className="p-4 bg-emerald-600 text-white rounded-xl text-center space-y-1 animate-in fade-in">
              <CheckCircle2 className="w-7 h-7 mx-auto" />
              <div className="font-bold text-sm">Instalação Concluída!</div>
              <p className="text-xs text-emerald-100">
                O KwanzaCobro foi adicionado ao seu ecrã inicial com a logomarca oficial.
              </p>
            </div>
          )}

          {/* TAB 1: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Aplicação Web Progressiva (Web APK)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Ao instalar no seu telemóvel Android, o KwanzaCobro funciona como uma aplicação nativa rápida, ocupando menos de 2 MB de espaço e com acesso directo no ecrã inicial através da logomarca oficial.
                </p>
              </div>

              {isInstallable ? (
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>Instalar no Android (1 Clique)</span>
                </button>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <span className="font-bold text-slate-800 block text-xs">Instalação Manual no Chrome Android:</span>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Toque nos <strong>três pontinhos ⋮</strong> no canto superior direito do Google Chrome.</li>
                    <li>Seleccione <strong>"Instalar aplicação"</strong> ou <strong>"Adicionar ao ecrã principal"</strong>.</li>
                    <li>Confirme a instalação para ver o avatar com a logomarca oficial no seu telemóvel.</li>
                  </ol>
                </div>
              )}

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-slate-800 block">Abrir noutro telemóvel:</span>
                    <p className="text-slate-500 text-[11px]">
                      Aponte a câmara do telemóvel para o código ao lado para abrir e instalar directamente.
                    </p>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-xl shrink-0 shadow-xs">
                    <img src={qrCodeUrl} alt="QR Code KwanzaCobro" className="w-24 h-24 object-contain" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IOS (IPHONE / IPAD) */}
          {activeTab === 'ios' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-900 block text-sm">
                  Como Instalar no iPhone ou iPad:
                </span>
                <div className="space-y-2.5 text-slate-700">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <p>
                      No navegador <strong>Safari</strong> do iPhone, toque no botão <strong>Partilhar <Share2 className="w-3.5 h-3.5 inline text-blue-600" /></strong> (ícone com quadrado e seta para cima).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <p>
                      Role para baixo e toque em <strong>"Ecrã principal" <PlusSquare className="w-3.5 h-3.5 inline text-slate-600" /></strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </div>
                    <p>
                      Confirme no canto superior direito tocando em <strong>Adicionar</strong>. A aplicação KwanzaCobro ficará disponível com a logomarca no seu ecrã!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DESKTOP / COMPUTADOR */}
          {activeTab === 'desktop' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <span className="font-bold text-blue-950 block text-sm">
                  Aplicação para Computador (Windows, Mac ou Linux)
                </span>
                <p className="text-slate-700">
                  Pode utilizar o sistema KwanzaCobro como uma aplicação independente no computador, com janela própria, arranque rápido e atalho na barra de tarefas.
                </p>
              </div>

              {isInstallable ? (
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>Instalar no Computador Agora</span>
                </button>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 block">
                    No Chrome, Edge ou Brave:
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Clique no ícone de instalação <Download className="w-3.5 h-3.5 inline text-blue-700" /> na barra de endereços do navegador (ao lado da estrela de favoritos) e confirme <strong>"Instalar KwanzaCobro"</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium">KwanzaCobro · Gestão e Controlo de Dívidas Empresariais</span>
          <button
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            {t('common.close', 'Fechar')}
          </button>
        </div>
      </div>
    </div>
  );
};
