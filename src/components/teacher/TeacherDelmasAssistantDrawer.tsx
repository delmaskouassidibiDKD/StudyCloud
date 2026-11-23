import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Plus,
  ChevronDown,
  Globe,
  Check,
  X,
  Search,
  FileText,
  Send,
} from 'lucide-react';
import { DelmasRobot } from '../DelmasRobot';
import { DnaLogo } from '../DnaLogo';

interface ModelOption {
  id: string;
  name: string;
  providerColor: string;
  isChef?: boolean;
}

const DEFAULT_MODELS: ModelOption[] = [
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', providerColor: 'bg-emerald-400' },
  { id: 'agent-delmas', name: 'Agent Delmas', providerColor: 'bg-orange-400', isChef: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', providerColor: 'bg-blue-400' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', providerColor: 'bg-amber-400' },
];

interface LangOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const SUPPORTED_DRAWER_LANGUAGES: LangOption[] = [
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'Anglais', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Espagnol', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'Arabe', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'de', name: 'Allemand', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portugais', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinois', nativeName: '中文', flag: '🇨🇳' },
];

export interface TeacherDelmasAssistantRibbonButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Bouton du ruban d'outils (placé tout à droite sous les boutons d'agrandissement)
 * Affiche le robot bleu animé qui regarde autour de lui + "Assistant Delmas" écrit en bas.
 */
export const TeacherDelmasAssistantRibbonButton: React.FC<TeacherDelmasAssistantRibbonButtonProps> = ({
  isOpen,
  onToggle,
  className = '',
}) => {
  return (
    <div
      className={`ml-auto pl-2.5 pr-1 border-l border-slate-300/80 dark:border-slate-700 flex flex-col items-center justify-between shrink-0 select-none ${className}`}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="delmas-ribbon-trigger flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-all select-none shrink-0 outline-none focus:outline-none bg-transparent border-0 p-0"
        title={isOpen ? 'Fermer Assistant Delmas' : 'Ouvrir Assistant Delmas'}
      >
        <div
          className={`relative p-0.5 rounded-full transition-all duration-200 ${
            isOpen
              ? 'ring-2 ring-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.75)] scale-105'
              : 'group-hover:scale-105 shadow-[0_2px_8px_rgba(37,99,235,0.3)]'
          }`}
        >
          <DelmasRobot size={32} variant="blue" />
        </div>
        <span
          className={`text-[9.5px] sm:text-[10px] font-extrabold tracking-tight mt-1 leading-none whitespace-nowrap text-center transition-colors ${
            isOpen
              ? 'text-blue-600 dark:text-blue-300'
              : 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300'
          }`}
        >
          Assistant Delmas
        </span>
      </button>
    </div>
  );
};

export interface TeacherDelmasAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Menu latéral droit coulissant de manière fluide pour l'espace de discussion Assistant Delmas
 * (UI fidèle à l'image 2 — non connecté à l'IA pour le moment).
 */
export const TeacherDelmasAssistantDrawer: React.FC<TeacherDelmasAssistantDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedModel, setSelectedModel] = useState<ModelOption>(DEFAULT_MODELS[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [chatLanguage, setChatLanguage] = useState<string>('fr');
  const [isMainLangMenuOpen, setIsMainLangMenuOpen] = useState(false);
  const [isDrawerLangMenuOpen, setIsDrawerLangMenuOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [drawerWidth, setDrawerWidth] = useState<number>(460);
  const [isResizing, setIsResizing] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const mainLangMenuRef = useRef<HTMLDivElement>(null);
  const drawerLangMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChatLangObj =
    SUPPORTED_DRAWER_LANGUAGES.find((l) => l.code === chatLanguage) ||
    SUPPORTED_DRAWER_LANGUAGES[0];

  // Fermeture des menus déroulants au clic extérieur
  useEffect(() => {
    if (!isModelDropdownOpen && !isMainLangMenuOpen && !isDrawerLangMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setIsModelDropdownOpen(false);
      }
      if (mainLangMenuRef.current && !mainLangMenuRef.current.contains(target)) {
        setIsMainLangMenuOpen(false);
      }
      if (drawerLangMenuRef.current && !drawerLangMenuRef.current.contains(target)) {
        setIsDrawerLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelDropdownOpen, isMainLangMenuOpen, isDrawerLangMenuOpen]);

  // Redimensionnement horizontal fluide du panneau latéral droit sur ordinateur
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = drawerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const nextWidth = Math.min(720, Math.max(360, startWidth + deltaX));
      setDrawerWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleStartNewConversation = () => {
    setInputValue('');
    setIsHistoryDrawerOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <>
      <style>{`
        @keyframes rainbowBorderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Fond discret sur mobile uniquement pour fermer au toucher extérieur */}
      <div
        onClick={onClose}
        className={`sm:hidden fixed inset-0 z-[80] bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* MENU LATÉRAL DROIT COULISSANT FLUIDE */}
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 640 ? `${drawerWidth}px` : undefined,
        }}
        className={`absolute top-0 right-0 bottom-0 z-[85] w-full sm:max-w-[92vw] h-full flex flex-col bg-[#1e2024] text-white font-nunito overflow-hidden border-l border-zinc-700/80 shadow-[-14px_0_38px_rgba(0,0,0,0.55)] select-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Poignée latérale gauche sur ordinateur pour élargir/réduire le menu latéral droit */}
        <div
          onMouseDown={handleStartResize}
          className={`hidden sm:block absolute left-0 top-0 bottom-0 w-1.5 z-50 cursor-col-resize transition-colors ${
            isResizing ? 'bg-orange-500/60' : 'hover:bg-orange-500/40'
          }`}
          title="Glisser pour ajuster la largeur du panneau Assistant Delmas"
        />

        {/* =================================================================== */}
        {/* 1. EN-TÊTE SUPÉRIEUR (Historique | + | Kimi K2.7 Code | FR FR | Fermer) */}
        {/* =================================================================== */}
        <div className="flex items-center justify-between px-2.5 sm:px-3.5 py-2 bg-[#23252a] border-b border-zinc-700/60 shrink-0 relative z-30 shadow-sm w-full max-w-full flex-nowrap gap-1.5">
          {/* Groupe Gauche : Historique, +, Sélecteur Modèle */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-nowrap shrink">
            {/* Bouton Historique */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsHistoryDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-[11px] sm:text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0 touch-manipulation"
              title="Historique des discussions"
            >
              <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Historique</span>
            </button>

            {/* Bouton + (Nouvelle discussion) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartNewConversation();
              }}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0 flex items-center justify-center touch-manipulation"
              title="Nouvelle discussion"
            >
              <Plus className="w-4 h-4 text-orange-400" />
            </button>

            {/* Sélecteur de Modèle IA (Kimi K2.7 Code par défaut comme sur l'image 2) */}
            <div className="relative shrink min-w-0" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModelDropdownOpen((prev) => !prev);
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white active:scale-95 shrink-0 shadow-xs touch-manipulation"
                title="Modèle IA sélectionné"
              >
                {selectedModel.isChef && (
                  <span className="text-[9px] px-0.5 py-0.2 rounded-full bg-orange-500/20 text-orange-400 font-extrabold border border-orange-500/30 flex items-center shrink-0">
                    👑
                  </span>
                )}
                <span className="max-w-[105px] sm:max-w-[140px] truncate">
                  {selectedModel.name}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-zinc-400 transition-transform shrink-0 ${
                    isModelDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 max-w-[calc(100vw-32px)] bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                  <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Modèles IA</span>
                    <span className="text-[9px] text-zinc-500 font-normal">Assistant Delmas</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {DEFAULT_MODELS.map((m) => {
                      const isSelected = selectedModel.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer border-b border-zinc-800/40 last:border-b-0 ${
                            isSelected
                              ? 'bg-orange-500/15 text-orange-400 font-bold'
                              : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${m.providerColor}`} />
                            <span className="truncate font-semibold">{m.name}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-orange-400 shrink-0 ml-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Groupe Droite : Sélecteur Langue (🌐 FR FR ⌄) + Bouton [🤖 Fermer] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
            {/* Sélecteur de langue */}
            <div className="relative" ref={mainLangMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMainLangMenuOpen((prev) => !prev);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-[#282a2f] hover:bg-[#32353b] border border-zinc-700/80 text-zinc-200 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                title={`Langue de l'IA : ${currentChatLangObj.name}`}
              >
                <Globe className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="text-xs">{currentChatLangObj.flag}</span>
                <span className="text-[11px] font-semibold">
                  {currentChatLangObj.code.toUpperCase()}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
              </button>

              {isMainLangMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw-32px)] bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                  <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Langue de l&apos;IA</span>
                    <span className="text-[9px] text-orange-400 font-semibold">
                      {currentChatLangObj.name}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                    {SUPPORTED_DRAWER_LANGUAGES.map((lang) => {
                      const isSelected = chatLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            setChatLanguage(lang.code);
                            setIsMainLangMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-orange-500/15 text-orange-400 font-bold'
                              : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{lang.flag}</span>
                            <span>{lang.name}</span>
                            <span className="text-[10px] text-zinc-500">
                              ({lang.nativeName})
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton Fermer avec mini robot bleu + texte "Fermer" */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[11px] font-extrabold cursor-pointer hover:bg-orange-500/30 transition-colors shrink-0 touch-manipulation active:scale-95"
              title="Fermer Assistant Delmas"
            >
              <DelmasRobot size={15} variant="blue" />
              <span className="inline text-[11px] font-extrabold text-orange-400 leading-none">
                Fermer
              </span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. TIROIR HISTORIQUE COULISSANT INTERNE                             */}
        {/* =================================================================== */}
        {isHistoryDrawerOpen && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-fadeIn touch-manipulation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsHistoryDrawerOpen(false);
              }
            }}
          >
            <div
              className="w-full max-w-[310px] sm:max-w-[340px] h-full bg-[#1e2024] border-r border-zinc-800 flex flex-col p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1.5 pb-3 border-b border-zinc-700/60 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <h3 className="text-xs sm:text-[13px] font-bold text-white whitespace-nowrap truncate">
                      Discussions récentes
                    </h3>
                  </div>
                  <div
                    className="flex items-center gap-1.5 shrink-0 relative"
                    ref={drawerLangMenuRef}
                  >
                    <button
                      type="button"
                      onClick={() => setIsDrawerLangMenuOpen(!isDrawerLangMenuOpen)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap shrink-0 select-none"
                      title={`Langue de l'IA : ${currentChatLangObj.name}`}
                    >
                      <Globe className="w-3 h-3 text-orange-400 shrink-0" />
                      <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap leading-none shrink-0">
                        <span>{currentChatLangObj.flag}</span>
                        <span className="font-bold tracking-tight">
                          {currentChatLangObj.code.toUpperCase()}
                        </span>
                      </span>
                      <ChevronDown className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                    </button>

                    {isDrawerLangMenuOpen && (
                      <div className="absolute right-6 top-full mt-1.5 w-52 bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                        <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Langue de l&apos;IA</span>
                          <span className="text-[9px] text-orange-400 font-semibold">
                            {currentChatLangObj.name}
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                          {SUPPORTED_DRAWER_LANGUAGES.map((lang) => {
                            const isSelected = chatLanguage === lang.code;
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => {
                                  setChatLanguage(lang.code);
                                  setIsDrawerLangMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-orange-500/15 text-orange-400 font-bold'
                                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{lang.flag}</span>
                                  <span>{lang.name}</span>
                                  <span className="text-[10px] text-zinc-500">
                                    ({lang.nativeName})
                                  </span>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsHistoryDrawerOpen(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartNewConversation}
                className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nouvelle discussion</span>
              </button>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Rechercher une discussion..."
                  className="w-full bg-[#282a2f] border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-400 outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                <div className="text-center text-zinc-500 text-xs py-8">
                  Aucune discussion trouvée
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. ZONE CENTRALE D'ACCUEIL (IDENTIQUE À L'IMAGE 2)                  */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-10 px-3">
            {/* Logo ADN officiel lumineux */}
            <div className="mb-3.5 relative group">
              <DnaLogo
                className="w-12 h-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-transform duration-300 group-hover:scale-105"
                glow={false}
              />
            </div>

            {/* Badge du modèle IA actif (pastille verte + Kimi K2.7 Code) */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-zinc-800/85 border border-zinc-700/60 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
                {selectedModel.name}
              </span>
              {selectedModel.isChef && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-500/25 text-orange-300 font-extrabold border border-orange-500/40">
                  👑 Chef Multi-IA
                </span>
              )}
            </div>

            {/* Titre principal identique à l'image 2 */}
            <h2 className="text-lg sm:text-2xl font-extrabold text-white mb-2.5 tracking-tight leading-snug max-w-md px-2">
              Ravi de te retrouver ! Qu&apos;est-ce qu&apos;on étudie ensemble ?
            </h2>

            {/* Sous-titre identique à l'image 2 */}
            <p className="text-xs sm:text-sm font-medium text-white/85 max-w-xs sm:max-w-sm leading-relaxed px-2 text-center">
              Synthèses, fiches de révision ou quiz : dis-moi ce dont tu as besoin.
            </p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. ZONE BASSE : CHAMP DE SAISIE AVEC BORDURE ARC-EN-CIEL 360°       */}
        {/* =================================================================== */}
        <div className="px-2.5 sm:px-5 pt-1.5 pb-4 sm:pb-6 shrink-0 relative z-30">
          <div className="relative mx-1 sm:mx-2 rounded-2xl sm:rounded-3xl p-[1.5px] overflow-hidden bg-zinc-700/60 shadow-lg group max-w-full">
            {/* Liseré fin arc-en-ciel rotatif à 360° */}
            <div
              className="absolute -inset-[250%] pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 160deg, #ff3b30 200deg, #ff9500 230deg, #ffcc00 260deg, #34c759 290deg, #00c7be 315deg, #007aff 335deg, #af52de 355deg, transparent 360deg)',
                animation: 'rainbowBorderSpin 5s linear infinite',
              }}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // L'IA n'est volontairement pas encore connectée conformément aux instructions
              }}
              className="relative flex flex-col gap-2 bg-[#282a2f] rounded-[20px] sm:rounded-[22.5px] p-2.5 sm:p-3.5 transition-all w-full h-full max-w-full box-border"
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                  }
                }}
                placeholder="Posez votre question ou collez votre cours..."
                rows={2}
                className="w-full bg-transparent text-white placeholder-zinc-400 text-xs sm:text-sm outline-none resize-none overflow-y-auto select-text"
              />

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-2 custom-scrollbar pb-0.5">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-zinc-400 text-[10px] sm:text-[11px] font-medium shrink-0 select-none"
                    title="Aucun fichier d'étude n'est actuellement sélectionné"
                  >
                    <FileText className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span>Aucun fichier sélectionné</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end">
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="p-2.5 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950"
                    title="Envoyer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
};
