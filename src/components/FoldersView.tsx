import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, Sparkles, Layers, ArrowLeft, X, Search, Globe } from 'lucide-react';
import { MenuDrawer } from './MenuDrawer';
import { GeminiDrawer } from './GeminiDrawer';
import { DnaLogo } from './DnaLogo';
import { PricingView } from './PricingView';
import { FilesMenuView } from './FilesMenuView';
import { ScheduleMenuView } from './ScheduleMenuView';
import { NotesMenuView } from './NotesMenuView';
import { GradesMenuView } from './GradesMenuView';
import { CalendarMenuView } from './CalendarMenuView';
import { FavoritesMenuView } from './FavoritesMenuView';
import { ClockMenuView } from './ClockMenuView';
import { LevelMenuView } from './LevelMenuView';
import { CalculatorMenuView } from './CalculatorMenuView';
import { MatiereMenuView } from './MatiereMenuView';
import { NavigationTab } from '../types';

interface FoldersViewProps {
  onOpenUpload: () => void;
  setTab: (tab: NavigationTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onImportFile?: () => void;
  onOpenPublishView?: () => void;
  setActivePreviewItem?: (item: any) => void;
}

export const FoldersView: React.FC<FoldersViewProps> = ({
  onOpenUpload,
  setTab,
  searchQuery,
  setSearchQuery,
  onImportFile,
  onOpenPublishView,
  setActivePreviewItem,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isGeminiOpen, setIsGeminiOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('fr');

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )googtrans=([^;]*)/);
    if (match) {
      const parts = match[1].split('/');
      if (parts.length === 3) {
        setCurrentLang(parts[2]);
      }
    }
  }, []);

  const handleLanguageChange = (langCode: string) => {
    if (langCode === 'fr') {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    } else {
      document.cookie = `googtrans=/fr/${langCode}; path=/;`;
    }
    window.location.reload();
  };
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'home' | 'abondamment' | 'files-menu' | 'schedule-menu' | 'notes-menu' | 'grades-menu' | 'calendar-menu' | 'favorites-menu' | 'clock-menu' | 'level-menu' | 'calculator-menu' | string>(() => {
    const saved = localStorage.getItem('unifolder_view_mode');
    return saved || 'home';
  });

  useEffect(() => {
    localStorage.setItem('unifolder_view_mode', viewMode);
  }, [viewMode]);
  const [isMatiereMenuOpen, setIsMatiereMenuOpen] = useState(false);
  const [showEmptyError, setShowEmptyError] = useState(false);
  const [editingMatiere, setEditingMatiere] = useState<{ index: number; name: string; coefficient: string } | null>(null);
  const [matieresList, setMatieresList] = useState<{ name: string; coefficient: string }[]>([
    { name: '', coefficient: '' }
  ]);
  const [savedMatieres, setSavedMatieres] = useState<{ name: string; coefficient: string; color?: string }[]>(() => {
    const saved = localStorage.getItem('unifolder_saved_matieres');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('unifolder_saved_matieres', JSON.stringify(savedMatieres));
  }, [savedMatieres]);

  const notify = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => setActiveNotification(null), 2000);
  };

  const handleDeleteMatiere = (index: number) => {
    const mat = savedMatieres[index];
    if (mat) {
      localStorage.removeItem(`unifolder_matiere_files_${mat.name}`);
    }
    setSavedMatieres(prev => prev.filter((_, i) => i !== index));
    notify("Matière supprimée avec succès !");
  };

  const handleEditMatiere = (index: number, name: string, coefficient: string) => {
    setEditingMatiere({ index, name, coefficient });
  };

  const handleUpdateMatiereColor = (index: number, color: string) => {
    setSavedMatieres(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], color };
      return updated;
    });
  };

  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'schedule' | 'grades'>('none');


  const renderBlock = (id: string, index: number) => {
    let defaultAction = () => {};
    let iconContent = null;
    let label = '';

    switch(id) {
      case 'files':
        label = 'Mes fichiers';
        defaultAction = () => setViewMode('files-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 18 32 C 18 28 21 25 25 25 L 42 25 L 50 32 L 75 32 C 79 32 82 35 82 39 L 82 72 C 82 76 79 79 75 79 L 25 79 C 21 79 18 76 18 72 Z" fill="#B45309" />
              <rect x="26" y="28" width="48" height="38" rx="3" fill="#FFFFFF" />
              <line x1="32" y1="36" x2="60" y2="36" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="32" y1="44" x2="52" y2="44" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 15 40 C 15 36 18 34 22 34 L 78 34 C 82 34 85 36 85 40 L 82 73 C 82 77 79 80 75 80 L 25 80 C 21 80 18 77 18 73 Z" fill="url(#folderFrontGrad)" />
              <defs>
                <linearGradient id="folderFrontGrad" x1="15" y1="34" x2="85" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FDE047" />
                  <stop offset="1" stopColor="#EAB308" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        );
        break;

      case 'schedule':
        label = 'Mon emploi du temps';
        defaultAction = () => setViewMode('schedule-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="16" y="20" width="68" height="66" rx="12" fill="#FFFFFF" />
              <path d="M 16 32 C 16 25 21 20 28 20 L 72 20 C 79 20 84 25 84 32 L 84 38 L 16 38 Z" fill="#EF4444" />
              <text x="50" y="32" fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle" letterSpacing="1">JUL</text>
              <rect x="32" y="14" width="5" height="12" rx="2.5" fill="#94A3B8" />
              <rect x="63" y="14" width="5" height="12" rx="2.5" fill="#94A3B8" />
              <text x="50" y="70" fill="#1E293B" fontSize="28" fontWeight="900" textAnchor="middle">17</text>
            </svg>
          </div>
        );
        break;

      case 'notes':
        label = 'Bloc-notes';
        defaultAction = () => setViewMode('notes-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="15" width="56" height="70" rx="8" fill="#F8FAFC" />
              <line x1="30" y1="30" x2="66" y2="30" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              <line x1="30" y1="40" x2="66" y2="40" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              <line x1="30" y1="50" x2="66" y2="50" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              <line x1="30" y1="60" x2="52" y2="60" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              <g transform="translate(48, 32) rotate(35)">
                <rect x="0" y="0" width="12" height="42" rx="2" fill="#F97316" />
                <path d="M 0 42 L 6 52 L 12 42 Z" fill="#FED7AA" />
                <path d="M 4 48 L 6 52 L 8 48 Z" fill="#1E293B" />
                <rect x="0" y="0" width="12" height="8" rx="1" fill="#F43F5E" />
              </g>
            </svg>
          </div>
        );
        break;

      case 'grades':
        label = "Mes notes d'évaluation";
        defaultAction = () => setViewMode('grades-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="88" height="88" rx="24" fill="url(#orangeGrad)" />
              <defs>
                <linearGradient id="orangeGrad" x1="6" y1="6" x2="94" y2="94" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FBBF24" />
                  <stop offset="1" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
              <rect x="22" y="16" width="56" height="70" rx="5" fill="#18568A" />
              <rect x="26" y="20" width="48" height="62" rx="3" fill="#FFFFFF" />
              <path d="M 43 11 C 43 7.5 57 7.5 57 11 L 57 16 L 43 16 Z" fill="#F7C858" />
              <circle cx="50" cy="11" r="2.5" fill="#18568A" />
              <rect x="37" y="15" width="26" height="9" rx="2" fill="#F7C858" />
              <rect x="37" y="19" width="26" height="5" fill="#E8A938" opacity="0.6" />
              {[25, 36, 47, 58, 69].map((y, i) => (
                <g key={i} transform={`translate(29, ${y})`}>
                  <rect x="0" y="0" width="8" height="8" rx="2" fill="#72C055" />
                  <path d="M 2 4 L 3.5 5.5 L 6 2" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="11" y="1.5" width="26" height="2.5" rx="1" fill="#18568A" />
                  <rect x="11" y="5" width="18" height="1.8" rx="0.9" fill="#DCE4EC" />
                </g>
              ))}
            </svg>
          </div>
        );
        break;

      case 'calendar':
        label = 'Calendrier';
        defaultAction = () => setViewMode('calendar-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="14" y="16" width="72" height="72" rx="14" fill="#FFFFFF" />
              <path d="M 14 30 C 14 22 20 16 28 16 L 72 16 C 80 16 86 22 86 30 L 86 36 L 14 36 Z" fill="#E11D48" />
              <text x="50" y="30" fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle" letterSpacing="1">JUL</text>
              <rect x="30" y="10" width="6" height="12" rx="3" fill="#94A3B8" />
              <rect x="64" y="10" width="6" height="12" rx="3" fill="#94A3B8" />
              <circle cx="30" cy="48" r="4" fill="#CBD5E1" />
              <circle cx="43" cy="48" r="4" fill="#CBD5E1" />
              <circle cx="56" cy="48" r="4" fill="#CBD5E1" />
              <circle cx="69" cy="48" r="4" fill="#CBD5E1" />
              <circle cx="30" cy="61" r="4" fill="#CBD5E1" />
              <circle cx="43" cy="61" r="5" fill="#E11D48" />
              <circle cx="56" cy="61" r="4" fill="#CBD5E1" />
              <circle cx="69" cy="61" r="4" fill="#CBD5E1" />
              <circle cx="30" cy="74" r="4" fill="#CBD5E1" />
              <circle cx="43" cy="74" r="4" fill="#CBD5E1" />
              <circle cx="56" cy="74" r="4" fill="#CBD5E1" />
              <circle cx="69" cy="74" r="4" fill="#CBD5E1" />
            </svg>
          </div>
        );
        break;

      case 'favorites':
        label = 'Favoris';
        defaultAction = () => setViewMode('favorites-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 50 82 C 50 82 18 60 18 36 C 18 24 27 16 38 16 C 45 16 50 20 50 20 C 50 20 55 16 62 16 C 73 16 82 24 82 36 C 82 60 50 82 50 82 Z" fill="#FFFFFF" />
              <path d="M 50 76 C 50 76 22 56 22 36 C 22 26 29 19 38 19 C 44 19 48 22 50 22 C 52 22 56 19 62 19 C 71 19 78 26 78 36 C 78 56 50 76 50 76 Z" fill="url(#pinkHeartGrad)" />
              <defs>
                <linearGradient id="pinkHeartGrad" x1="18" y1="16" x2="82" y2="82" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF80AB" />
                  <stop offset="1" stopColor="#F43F5E" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        );
        break;

      case 'clock':
        label = 'Horloge';
        defaultAction = () => setViewMode('clock-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 20 28 C 16 20 28 14 34 22 Z" fill="#EF4444" />
              <path d="M 80 28 C 84 20 72 14 66 22 Z" fill="#EF4444" />
              <rect x="26" y="76" width="8" height="12" rx="3" fill="#334155" transform="rotate(25 30 82)" />
              <rect x="66" y="76" width="8" height="12" rx="3" fill="#334155" transform="rotate(-25 70 82)" />
              <circle cx="50" cy="52" r="32" fill="#EF4444" />
              <circle cx="50" cy="52" r="26" fill="#FFFFFF" />
              <path d="M 50 52 L 50 34" stroke="#1E293B" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 50 52 L 66 52" stroke="#1E293B" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="50" cy="52" r="4" fill="#EF4444" />
            </svg>
          </div>
        );
        break;

      case 'level':
        label = "Évolution & Stats";
        defaultAction = () => setViewMode('level-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="88" height="88" rx="24" fill="url(#levelGrad)" />
              <defs>
                <linearGradient id="levelGrad" x1="6" y1="6" x2="94" y2="94" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#1E3A8A" />
                </linearGradient>
              </defs>
              <rect x="18" y="62" width="8" height="18" rx="2" fill="#93C5FD" opacity="0.9" />
              <rect x="30" y="52" width="8" height="28" rx="2" fill="#60A5FA" opacity="0.9" />
              <rect x="42" y="42" width="8" height="38" rx="2" fill="#3B82F6" opacity="0.9" />
              <rect x="54" y="54" width="8" height="26" rx="2" fill="#93C5FD" opacity="0.9" />
              <rect x="66" y="32" width="8" height="48" rx="2" fill="#1D4ED8" opacity="0.9" />
              <rect x="78" y="22" width="8" height="58" rx="2" fill="#1E3A8A" opacity="0.9" />
              <path d="M22 60 L46 40 L58 48 L82 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M72 24 L82 24 L82 34" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        );
        break;

      case 'calculator':
        label = 'Calculatrice';
        defaultAction = () => setViewMode('calculator-menu');
        iconContent = (
          <div className="w-full h-full p-1.5 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="16" y="8" width="68" height="84" rx="10" fill="#22252A" />
              <rect x="23" y="15" width="54" height="20" rx="4" fill="#383C42" />
              <text x="72" y="30" fill="#F3F4F6" fontFamily="monospace" fontSize="13" fontWeight="bold" textAnchor="end">397</text>
              <rect x="23" y="40" width="11.5" height="8.5" rx="2.5" fill="#EF4444" />
              <text x="28.75" y="46" fill="#FFFFFF" fontSize="5" fontWeight="bold" textAnchor="middle">AC</text>
              <rect x="37" y="40" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="42.75" y="46" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">%</text>
              <rect x="51" y="40" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="56.75" y="46" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">X</text>
              <rect x="65.5" y="40" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="71.25" y="46" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">÷</text>
              <rect x="23" y="50.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="28.75" y="56.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">7</text>
              <rect x="37" y="50.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="42.75" y="56.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">8</text>
              <rect x="51" y="50.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="56.75" y="56.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">9</text>
              <rect x="65.5" y="50.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="71.25" y="56.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">-</text>
              <rect x="23" y="61" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="28.75" y="67" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">4</text>
              <rect x="37" y="61" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="42.75" y="67" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">5</text>
              <rect x="51" y="61" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="56.75" y="67" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">6</text>
              <rect x="65.5" y="61" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="71.25" y="67" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">+</text>
              <rect x="23" y="71.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="28.75" y="77.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">1</text>
              <rect x="37" y="71.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="42.75" y="77.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">2</text>
              <rect x="51" y="71.5" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="56.75" y="77.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">3</text>
              <rect x="23" y="82" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="28.75" y="88" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">0</text>
              <rect x="37" y="82" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="42.75" y="88" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">,</text>
              <rect x="51" y="82" width="11.5" height="8.5" rx="2.5" fill="#4B5563" />
              <text x="56.75" y="88" fill="#FFFFFF" fontSize="4.5" fontWeight="bold" textAnchor="middle">+/-</text>
              <rect x="65.5" y="71.5" width="11.5" height="19" rx="2.5" fill="#F97316" />
              <text x="71.25" y="83" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">=</text>
            </svg>
          </div>
        );
        break;

      default:
        return null;
    }

    return (
      <div 
        key={id}
        onClick={defaultAction}
        className="group flex flex-col items-center cursor-pointer w-20 sm:w-24 md:w-24 lg:w-28 transition-all duration-200 hover:scale-105"
      >
        <div className="w-full aspect-square bg-stone-900 dark:bg-stone-800 border-3 border-stone-800 dark:border-stone-700 rounded-2xl shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-[3px_3px_0px_0px_#000] flex items-center justify-center group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_#1c1917] transition-all relative">
          {iconContent}
        </div>
        <span className="text-xs sm:text-[13px] md:text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-2 text-center px-0.5 leading-snug tracking-wide">{label}</span>
      </div>
    );
  };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('unifolder_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('unifolder_dark_mode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Schedule state
  const [scheduleItems, setScheduleItems] = useState<{ day: string; time: string; matiere: string; room: string }[]>(() => {
    const saved = localStorage.getItem('unifolder_schedule');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { day: 'Lundi', time: '08:00 - 10:00', matiere: 'Mathématiques', room: 'Salle 101' },
      { day: 'Mardi', time: '10:00 - 12:00', matiere: 'Anglais', room: 'Salle 203' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('unifolder_schedule', JSON.stringify(scheduleItems));
  }, [scheduleItems]);

  const [newScheduleDay, setNewScheduleDay] = useState('Lundi');
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleMatiere, setNewScheduleMatiere] = useState('');
  const [newScheduleRoom, setNewScheduleRoom] = useState('');

  // Grades state
  const [gradesItems, setGradesItems] = useState<{ matiere: string; grade: string; coefficient: string }[]>(() => {
    const saved = localStorage.getItem('unifolder_grades');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('unifolder_grades', JSON.stringify(gradesItems));
  }, [gradesItems]);

  const [newGradeMatiere, setNewGradeMatiere] = useState('');
  const [newGradeValue, setNewGradeValue] = useState('');
  const [newGradeCoeff, setNewGradeCoeff] = useState('');

  return (
    <div className="flex flex-col items-center justify-start min-h-[75vh] px-4 text-center pt-12 md:pt-14 pb-24">
      {/* Fixed Header bar with action buttons */}
      <div className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-[#FDFBF7] border-b-2 border-stone-800 shadow-sm px-3 md:px-6 py-1.5 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2">
          <MenuDrawer
            onNavigateHome={() => {
              setViewMode('home');
              setTab('folders');
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenUpload={onOpenUpload}
            onImportFile={onImportFile}
            onOpenPublishView={onOpenPublishView}
            matieres={savedMatieres}
            onDeleteMatiere={handleDeleteMatiere}
            onEditMatiere={handleEditMatiere}
            onUpdateMatiereColor={handleUpdateMatiereColor}
            onSelectMatiere={(name) => setViewMode(`matiere-${name}`)}
          />
          <GeminiDrawer isOpen={isGeminiOpen} onClose={() => setIsGeminiOpen(false)} />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3">
          {/* Language button */}
          <div className="flex flex-col items-center relative">
            <button
              onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
              className="p-1.5 bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 rounded-lg border-2 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
              title="Langue"
            >
              <Globe className="w-3.5 h-3.5 text-red-600" />
            </button>
            <span className="text-[9px] font-bold text-stone-700 leading-none mt-0.5">Langue</span>
            
            {isLanguageMenuOpen && (
              <div className="absolute top-full right-0 mt-2 bg-[#F5F1E9] border-2 border-stone-800 rounded-xl shadow-xl z-50 min-w-[140px] py-1.5 max-h-[300px] overflow-y-auto">
                {[
                  { code: 'fr', label: 'Français' },
                  { code: 'en', label: 'English' },
                  { code: 'es', label: 'Español' },
                  { code: 'pt', label: 'Português' },
                  { code: 'it', label: 'Italiano' },
                  { code: 'de', label: 'Deutsch' },
                  { code: 'zh-CN', label: '中文 (Chinois)' },
                  { code: 'ja', label: '日本語 (Japonais)' },
                  { code: 'ko', label: '한국어 (Coréen)' },
                  { code: 'ar', label: 'العربية (Arabe)' },
                  { code: 'hi', label: 'हिन्दी (Hindi)' },
                  { code: 'ru', label: 'Русский (Russe)' }
                ].map(lang => {
                  const isSelected = currentLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-colors ${
                        isSelected 
                          ? 'bg-red-100/50 text-red-600 border-l-4 border-red-600' 
                          : 'text-stone-700 hover:bg-stone-200 border-l-4 border-transparent'
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gemini button */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsGeminiOpen(true)}
              className="p-1.5 bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 rounded-lg border-2 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
              title="Gemini"
            >
              <svg className="w-3.5 h-3.5 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"/>
              </svg>
            </button>
            <span className="text-[9px] font-bold text-stone-700 leading-none mt-0.5">Gemini</span>
          </div>

          {/* Abondamment button */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setViewMode('abondamment')}
              className="p-1.5 bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 rounded-lg border-2 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
              title="Abondamment"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            </button>
            <span className="text-[9px] font-bold text-stone-700 leading-none mt-0.5">Abondamment</span>
          </div>

          {/* Créer les matières */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsMatiereMenuOpen(true)}
              className="p-1.5 bg-[#F5F1E9] hover:bg-[#EBE5DA] text-stone-800 rounded-lg border-2 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
              title="Matière"
            >
              <FolderPlus className="w-3.5 h-3.5 text-orange-600" />
            </button>
            <span className="text-[9px] font-bold text-stone-700 leading-none mt-0.5">Matière</span>
          </div>


        </div>
      </div>

      {isMatiereMenuOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setIsMatiereMenuOpen(false)}
        >
          <div 
            className="bg-[#2d2d2d] text-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-stone-700 space-y-4 text-left relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-2">Ajouter des matières ou autres</h2>
            
            <div className="space-y-3">
              {matieresList.map((item, index) => {
                const isAlreadyExists = item.name.trim() !== '' && savedMatieres.some(
                  m => m.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                );
                const isFieldEmpty = showEmptyError && item.name.trim() === '';
                return (
                  <div key={index} className="bg-stone-800 p-3 rounded-2xl border border-stone-700 space-y-1.5 relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Matière {index + 1}</span>
                      {matieresList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newList = matieresList.filter((_, i) => i !== index);
                            setMatieresList(newList);
                          }}
                          className="text-stone-400 hover:text-red-400 p-1 transition-colors cursor-pointer"
                          title="Supprimer ce champ"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Nom de la matière"
                          value={item.name}
                          onChange={(e) => {
                            const newList = [...matieresList];
                            newList[index].name = e.target.value;
                            setMatieresList(newList);
                            if (showEmptyError) setShowEmptyError(false);
                          }}
                          className={`w-full bg-stone-900 border rounded-xl px-3 py-2 text-white text-sm focus:outline-none ${isFieldEmpty ? 'border-red-500' : 'border-stone-700 focus:border-orange-500'}`}
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="Coeff"
                          value={item.coefficient}
                          onChange={(e) => {
                            const newList = [...matieresList];
                            newList[index].coefficient = e.target.value;
                            setMatieresList(newList);
                          }}
                          className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    {isFieldEmpty && (
                      <p className="text-red-400 text-[11px] font-medium px-1">
                        ⚠️ Ce champ ne peut pas être vide
                      </p>
                    )}
                    {isAlreadyExists && !isFieldEmpty && (
                      <p className="text-red-400 text-[11px] font-medium px-1">
                        ⚠️ Cette matière existe déjà (vous pouvez quand même la créer)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setMatieresList([...matieresList, { name: '', coefficient: '' }])}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-orange-400 font-bold text-xs rounded-xl border border-stone-700 transition-all cursor-pointer"
              >
                <span>+ Ajouter une matière</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-700">
              <button
                type="button"
                onClick={() => {
                  setIsMatiereMenuOpen(false);
                  setShowEmptyError(false);
                  setMatieresList([{ name: '', coefficient: '' }]);
                }}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const hasEmpty = matieresList.some(m => m.name.trim() === '');
                  if (hasEmpty) {
                    setShowEmptyError(true);
                    return;
                  }
                  setSavedMatieres(prev => [...prev, ...matieresList]);
                  notify("Matières créées avec succès !");
                  setIsMatiereMenuOpen(false);
                  setShowEmptyError(false);
                  setMatieresList([{ name: '', coefficient: '' }]);
                }}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-lg shadow-orange-900/30"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMatiere && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setEditingMatiere(null)}
        >
          <div 
            className="bg-[#2d2d2d] text-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-stone-700 space-y-4 text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-2">Modifier la matière</h2>
            
            <div className="space-y-3">
              <div className="bg-stone-800 p-3 rounded-2xl border border-stone-700 space-y-1.5">
                <div className="flex-1 mb-2">
                  <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Nom de la matière</label>
                  <input
                    type="text"
                    value={editingMatiere.name}
                    onChange={(e) => setEditingMatiere({ ...editingMatiere, name: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Coefficient</label>
                  <input
                    type="number"
                    value={editingMatiere.coefficient}
                    onChange={(e) => setEditingMatiere({ ...editingMatiere, coefficient: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-700">
              <button
                type="button"
                onClick={() => setEditingMatiere(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!editingMatiere.name.trim()}
                onClick={() => {
                  if (editingMatiere.name.trim()) {
                    setSavedMatieres(prev => {
                      const updated = [...prev];
                      updated[editingMatiere.index] = { name: editingMatiere.name, coefficient: editingMatiere.coefficient };
                      return updated;
                    });
                    notify("Matière modifiée avec succès !");
                    setEditingMatiere(null);
                  }
                }}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-lg shadow-orange-900/30"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'schedule' && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveModal('none')}
        >
          <div 
            className="bg-[#2d2d2d] text-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-stone-700 space-y-4 text-left relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold">📅 Emploi du temps</h2>
              <button onClick={() => setActiveModal('none')} className="text-stone-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div className="bg-stone-800 p-4 rounded-2xl border border-stone-700 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">Ajouter un créneau</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Jour</label>
                    <select
                      value={newScheduleDay}
                      onChange={(e) => setNewScheduleDay(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    >
                      {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Horaire</label>
                    <input
                      type="text"
                      placeholder="ex: 08:00 - 10:00"
                      value={newScheduleTime}
                      onChange={(e) => setNewScheduleTime(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Matière</label>
                    <input
                      type="text"
                      placeholder="ex: Mathématiques"
                      value={newScheduleMatiere}
                      onChange={(e) => setNewScheduleMatiere(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Salle</label>
                    <input
                      type="text"
                      placeholder="ex: Salle 101"
                      value={newScheduleRoom}
                      onChange={(e) => setNewScheduleRoom(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!newScheduleTime.trim() || !newScheduleMatiere.trim()}
                  onClick={() => {
                    if (newScheduleTime.trim() && newScheduleMatiere.trim()) {
                      setScheduleItems(prev => [...prev, { day: newScheduleDay, time: newScheduleTime, matiere: newScheduleMatiere, room: newScheduleRoom }]);
                      setNewScheduleTime('');
                      setNewScheduleMatiere('');
                      setNewScheduleRoom('');
                      notify("Créneau ajouté !");
                    }
                  }}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Ajouter au planning
                </button>
              </div>

              <div className="space-y-2 mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">Créneaux enregistrés</h3>
                {scheduleItems.length === 0 ? (
                  <p className="text-xs text-stone-500 italic p-4 text-center">Aucun créneau pour le moment.</p>
                ) : (
                  scheduleItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-stone-800 border border-stone-700 rounded-xl">
                      <div className="text-left">
                        <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded uppercase mr-2">{item.day}</span>
                        <span className="text-xs font-bold text-white">{item.matiere}</span>
                        <div className="text-[11px] text-stone-400 mt-0.5">{item.time} {item.room ? `• ${item.room}` : ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleItems(prev => prev.filter((_, i) => i !== idx));
                          notify("Créneau supprimé");
                        }}
                        className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'grades' && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveModal('none')}
        >
          <div 
            className="bg-[#2d2d2d] text-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-stone-700 space-y-4 text-left relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold">📝 Notes d'évaluation</h2>
              <button onClick={() => setActiveModal('none')} className="text-stone-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div className="bg-stone-800 p-4 rounded-2xl border border-stone-700 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">Ajouter une note (/20)</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Matière</label>
                    <input
                      type="text"
                      placeholder="ex: Maths"
                      value={newGradeMatiere}
                      onChange={(e) => setNewGradeMatiere(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Note (/20)</label>
                    <input
                      type="number"
                      step="0.25"
                      max="20"
                      placeholder="15"
                      value={newGradeValue}
                      onChange={(e) => setNewGradeValue(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Coeff</label>
                    <input
                      type="number"
                      placeholder="2"
                      value={newGradeCoeff}
                      onChange={(e) => setNewGradeCoeff(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!newGradeMatiere.trim() || !newGradeValue.trim()}
                  onClick={() => {
                    if (newGradeMatiere.trim() && newGradeValue.trim()) {
                      setGradesItems(prev => [...prev, { matiere: newGradeMatiere, grade: newGradeValue, coefficient: newGradeCoeff || '1' }]);
                      setNewGradeMatiere('');
                      setNewGradeValue('');
                      setNewGradeCoeff('');
                      notify("Note ajoutée !");
                    }
                  }}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Enregistrer la note
                </button>
              </div>

              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Notes enregistrées</h3>
                  {gradesItems.length > 0 && (
                    <span className="text-xs font-bold bg-orange-500 text-white px-2.5 py-0.5 rounded-full">
                      Moyenne: {(
                        gradesItems.reduce((acc, item) => acc + (parseFloat(item.grade) || 0) * (parseFloat(item.coefficient) || 1), 0) /
                        Math.max(1, gradesItems.reduce((acc, item) => acc + (parseFloat(item.coefficient) || 1), 0))
                      ).toFixed(2)} / 20
                    </span>
                  )}
                </div>

                {gradesItems.length === 0 ? (
                  <p className="text-xs text-stone-500 italic p-4 text-center">Aucune note enregistrée pour le moment.</p>
                ) : (
                  gradesItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-stone-800 border border-stone-700 rounded-xl">
                      <div className="text-left">
                        <span className="text-xs font-bold text-white">{item.matiere}</span>
                        <div className="text-[11px] text-stone-400 mt-0.5">Coefficient: {item.coefficient}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-orange-400">{item.grade} / 20</span>
                        <button
                          type="button"
                          onClick={() => {
                            setGradesItems(prev => prev.filter((_, i) => i !== idx));
                            notify("Note supprimée");
                          }}
                          className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeNotification && (
        <div className="fixed top-16 right-4 z-50 bg-stone-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border border-stone-700 animate-fadeIn">
          {activeNotification}
        </div>
      )}

      {viewMode === 'abondamment' && (
        <PricingView onBack={() => setViewMode('home')} onSelectPlan={(plan) => notify(`Plan ${plan} sélectionné`)} />
      )}

      {viewMode === 'files-menu' && <FilesMenuView onBack={() => setViewMode('home')} onImportFile={onOpenUpload} setActivePreviewItem={setActivePreviewItem} />}
      {typeof viewMode === 'string' && viewMode.startsWith('matiere-') && (
        <MatiereMenuView 
          matiereName={viewMode.replace('matiere-', '')} 
          onBack={() => setViewMode('home')} 
          setActivePreviewItem={setActivePreviewItem} 
        />
      )}
      {viewMode === 'schedule-menu' && <ScheduleMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'notes-menu' && <NotesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'grades-menu' && <GradesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'calendar-menu' && <CalendarMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'favorites-menu' && <FavoritesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'clock-menu' && <ClockMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'level-menu' && <LevelMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'calculator-menu' && <CalculatorMenuView onBack={() => setViewMode('home')} />}

      {viewMode === 'home' && (
        <div className="w-full max-w-md md:max-w-5xl lg:max-w-6xl mx-auto px-4 py-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Écran d'accueil</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-9 gap-3 sm:gap-4 md:gap-2 lg:gap-4 justify-items-center items-start w-full">
            {['files', 'schedule', 'notes', 'grades', 'level', 'calendar', 'favorites', 'clock', 'calculator'].map((id, index) => renderBlock(id, index))}
          </div>
        </div>
      )}
    </div>
  );
};

