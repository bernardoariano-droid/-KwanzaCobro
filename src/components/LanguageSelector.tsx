import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SupportedLanguage } from '../i18n/translations';

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
  dropUp?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  compact = false, 
  className = '',
  dropUp = false 
}) => {
  const { language, setLanguage, currentLanguageOption, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl shadow-2xs transition-all active:scale-98"
        title="Mudar Idioma / Change Language"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none">{currentLanguageOption.flag}</span>
        {!compact && (
          <span className="font-medium text-slate-800 hidden sm:inline">
            {currentLanguageOption.name}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className={`absolute z-50 ${dropUp ? 'bottom-full mb-1.5' : 'mt-1.5'} right-0 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 overflow-hidden animate-fade-in text-xs`}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-teal-700" />
            <span>Selecionar Idioma</span>
          </div>

          <div className="py-1">
            {languages.map(opt => {
              const isSelected = opt.code === language;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleSelect(opt.code)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                    isSelected 
                      ? 'bg-teal-50 text-teal-900 font-bold' 
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{opt.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-xs leading-tight font-semibold">{opt.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{opt.nativeName}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
