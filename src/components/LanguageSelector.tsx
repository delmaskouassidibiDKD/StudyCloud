import React, { useState, useEffect, useRef } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  getCurrentLanguage,
  applyLanguage,
  LanguageOption,
} from '../services/languageService';

interface LanguageSelectorProps {
  variant?: 'header' | 'floating';
  isDarkMode?: boolean;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'header',
  isDarkMode = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>(getCurrentLanguage);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLangChanged = (e: any) => {
      if (e?.detail?.lang) {
        setCurrentLang(e.detail.lang);
      }
    };
    window.addEventListener('studycloud_language_changed', handleLangChanged);
    return () => window.removeEventListener('studycloud_language_changed', handleLangChanged);
  }, []);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (lang: LanguageOption) => {
    setIsOpen(false);
    if (lang.code === currentLang) return;
    setCurrentLang(lang.code);
    applyLanguage(lang.code);
  };

  const currentOption = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  // 1. VARIANTE FLOATING (Pour la page d'accueil / connexion / inscription AuthPage)
  if (variant === 'floating') {
    return (
      <div className={`relative notranslate select-none ${className}`} ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800/90 text-white/90 hover:text-white border border-white/15 backdrop-blur-md shadow-lg text-xs font-semibold transition-all cursor-pointer active:scale-95"
          title="Changer de langue / Change language"
          aria-label="Sélectionner la langue"
        >
          <Globe className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="font-medium tracking-wide">{currentOption.label}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 py-1.5 bg-[#0f172a]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Choisir la langue
            </div>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-orange-500/20 text-orange-400 font-bold'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{lang.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 2. VARIANTE HEADER (Pour FoldersView / barre supérieure de l'application)
  return (
    <div className={`flex flex-col items-center relative notranslate select-none ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
          isDarkMode
            ? 'bg-[#1e293b] hover:bg-[#283852] text-white border-[#334155] shadow-sm'
            : 'bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917]'
        }`}
        title="Changer de langue / Change language"
        aria-label="Sélectionner la langue"
      >
        <Globe className="w-4 h-4 text-rose-400" />
      </button>
      <span
        className={`text-[10px] font-extrabold leading-none mt-1 ${
          isDarkMode ? 'text-white' : 'text-stone-700'
        }`}
      >
        Langue
      </span>

      {isOpen && (
        <div
          className={`absolute top-full right-0 mt-2 rounded-2xl shadow-2xl z-50 min-w-[170px] py-1.5 max-h-[300px] overflow-y-auto no-scrollbar border-2 animate-in fade-in zoom-in-95 duration-150 ${
            isDarkMode
              ? 'bg-[#111a2e] border-[#334155] text-white'
              : 'bg-[#F5F1E9] border-2 border-stone-800 text-stone-800'
          }`}
        >
          <div
            className={`px-3 py-1.5 border-b text-[10px] font-black uppercase tracking-wider ${
              isDarkMode ? 'border-white/10 text-white/40' : 'border-stone-300 text-stone-500'
            }`}
          >
            Langues disponibles
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-rose-500/25 text-rose-400 border-l-4 border-rose-500'
                    : isDarkMode
                    ? 'text-slate-200 hover:bg-[#1e293b] border-l-4 border-transparent'
                    : 'text-stone-700 hover:bg-stone-200 border-l-4 border-transparent'
                }`}
              >
                <span>{lang.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default LanguageSelector;

