import React, { useState, useEffect, useRef } from 'react';
import { Folder, FolderPlus, Sparkles, Layers, ArrowLeft, X, Search, Globe, Sun, Moon, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { MenuDrawer } from './MenuDrawer';
import { DelmasRobot } from './DelmasRobot';
import { DelmasChat } from './DelmasChat';
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
import { StorageMenuView } from './StorageMenuView';
import { Page1FilesMenuView } from './Page1FilesMenuView';
import { NavigationTab } from '../types';
import { triggerDebouncedCloudBackup } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';

interface FoldersViewProps {
  onOpenUpload: () => void;
  setTab: (tab: NavigationTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onImportFile?: () => void;
  onOpenPublishView?: () => void;
  setActivePreviewItem?: (item: any) => void;
  activePreviewItem?: any;
  onOpenCreateShareLink?: (items: any[]) => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[], isFullscreen?: boolean) => void;
}

export const FoldersView: React.FC<FoldersViewProps> = ({
  onOpenUpload,
  setTab,
  searchQuery,
  setSearchQuery,
  onImportFile,
  onOpenPublishView,
  setActivePreviewItem,
  activePreviewItem,
  onOpenCreateShareLink,
  onOpenStudySpace,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('fr');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('unifolder_dark_mode') === 'true' || document.documentElement.classList.contains('dark');
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('unifolder_dark_mode', isDarkMode ? 'true' : 'false');
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    } catch (e) {}
  }, [isDarkMode]);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )googtrans=([^;]*)/);
    if (match) {
      const parts = match[1].split('/');
      if (parts.length === 3 && parts[2] && parts[2] !== 'fr') {
        setCurrentLang(parts[2]);
        document.documentElement.removeAttribute('translate');
        document.documentElement.classList.remove('notranslate');
        document.body.removeAttribute('translate');
        document.body.classList.remove('notranslate');
        return;
      }
    }
    // Langue par défaut = Français
    setCurrentLang('fr');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    document.body.setAttribute('translate', 'no');
    document.body.classList.add('notranslate');
  }, []);

  const handleLanguageChange = (langCode: string) => {
    const hostname = window.location.hostname;
    const hostParts = hostname.split('.');

    if (langCode === 'fr') {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${hostname};`;
      if (hostParts.length > 2) {
        const rootDomain = hostParts.slice(-2).join('.');
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${rootDomain};`;
      }
      document.documentElement.setAttribute('lang', 'fr');
      document.documentElement.setAttribute('translate', 'no');
      document.documentElement.classList.add('notranslate');
      document.body.setAttribute('translate', 'no');
      document.body.classList.add('notranslate');
    } else {
      document.cookie = `googtrans=/fr/${langCode}; path=/;`;
      document.cookie = `googtrans=/fr/${langCode}; path=/; domain=${hostname};`;
      document.cookie = `googtrans=/fr/${langCode}; path=/; domain=.${hostname};`;
      document.documentElement.removeAttribute('translate');
      document.documentElement.classList.remove('notranslate');
      document.body.removeAttribute('translate');
      document.body.classList.remove('notranslate');
    }
    window.location.reload();
  };
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [pricingInitialTab, setPricingInitialTab] = useState<'storage' | 'ai' | 'renewal'>('storage');
  const [previousViewMode, setPreviousViewMode] = useState<string>('home');
  const [viewMode, setViewMode] = useState<'home' | 'abondamment' | 'files-menu' | 'storage-menu' | 'schedule-menu' | 'notes-menu' | 'grades-menu' | 'calendar-menu' | 'favorites-menu' | 'clock-menu' | 'level-menu' | 'calculator-menu' | string>(() => {
    const saved = localStorage.getItem('unifolder_view_mode');
    return saved || 'home';
  });

  useEffect(() => {
    localStorage.setItem('unifolder_view_mode', viewMode);
  }, [viewMode]);

  // État et gestion du carrousel de l'écran d'accueil (Page 0 = Page vide, Page 1 = Écran d'accueil principal)
  const [activePageIndex, setActivePageIndex] = useState<number>(1);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isHorizontalDragRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);

  const handleGoToPage = (targetIndex: number) => {
    setActivePageIndex(Math.max(0, Math.min(1, targetIndex)));
  };

  // Navigation fluide au clavier (Flèches gauche / droite)
  useEffect(() => {
    if (viewMode !== 'home') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        setActivePageIndex(0);
      } else if (e.key === 'ArrowRight') {
        setActivePageIndex(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // Gestion tactile fluide pour téléphone et tablette
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    isHorizontalDragRef.current = false;
    hasMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.x;
    const deltaY = touch.clientY - dragStartRef.current.y;

    if (!isHorizontalDragRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        dragStartRef.current = null;
        return;
      }
      if (Math.abs(deltaX) > 8) {
        isHorizontalDragRef.current = true;
        setIsDragging(true);
        hasMovedRef.current = true;
      }
    }

    if (isHorizontalDragRef.current) {
      let adjustedDelta = deltaX;
      if (activePageIndex === 0 && deltaX > 0) {
        adjustedDelta = deltaX * 0.25;
      } else if (activePageIndex === 1 && deltaX < 0) {
        adjustedDelta = deltaX * 0.25;
      }
      setDragOffset(adjustedDelta);
    }
  };

  const handleTouchEnd = () => {
    if (!dragStartRef.current) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    const deltaX = dragOffset;
    const elapsed = Date.now() - dragStartRef.current.time;
    const velocity = Math.abs(deltaX) / (elapsed || 1);

    setIsDragging(false);
    setDragOffset(0);
    dragStartRef.current = null;
    isHorizontalDragRef.current = false;

    const threshold = 35;
    const fastFlick = velocity > 0.3 && Math.abs(deltaX) > 15;

    if (deltaX > threshold || (deltaX > 15 && fastFlick)) {
      setActivePageIndex(0);
    } else if (deltaX < -threshold || (deltaX < -15 && fastFlick)) {
      setActivePageIndex(1);
    }

    setTimeout(() => {
      hasMovedRef.current = false;
    }, 60);
  };

  // Gestion souris pour desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
    isHorizontalDragRef.current = false;
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    if (!isHorizontalDragRef.current && Math.abs(deltaX) > 8) {
      isHorizontalDragRef.current = true;
      setIsDragging(true);
      hasMovedRef.current = true;
    }
    if (isHorizontalDragRef.current) {
      let adjustedDelta = deltaX;
      if (activePageIndex === 0 && deltaX > 0) {
        adjustedDelta = deltaX * 0.25;
      } else if (activePageIndex === 1 && deltaX < 0) {
        adjustedDelta = deltaX * 0.25;
      }
      setDragOffset(adjustedDelta);
    }
  };

  const handleMouseUp = () => {
    if (!dragStartRef.current) return;
    const deltaX = dragOffset;
    const elapsed = Date.now() - dragStartRef.current.time;
    const velocity = Math.abs(deltaX) / (elapsed || 1);

    setIsDragging(false);
    setDragOffset(0);
    dragStartRef.current = null;
    isHorizontalDragRef.current = false;

    const threshold = 35;
    const fastFlick = velocity > 0.3 && Math.abs(deltaX) > 15;

    if (deltaX > threshold || (deltaX > 15 && fastFlick)) {
      setActivePageIndex(0);
    } else if (deltaX < -threshold || (deltaX < -15 && fastFlick)) {
      setActivePageIndex(1);
    }

    setTimeout(() => {
      hasMovedRef.current = false;
    }, 60);
  };

  const [isMatiereMenuOpen, setIsMatiereMenuOpen] = useState(false);
  const [showEmptyError, setShowEmptyError] = useState(false);
  const [editingMatiere, setEditingMatiere] = useState<{ index: number; name: string; coefficient: string } | null>(null);
  const [matieresList, setMatieresList] = useState<{ name: string; coefficient: string }[]>([
    { name: '', coefficient: '' }
  ]);
  const [savedMatieres, setSavedMatieres] = useState<{ id?: string; name: string; coefficient: string; color?: string }[]>(() => {
    const saved = localStorage.getItem('unifolder_saved_matieres');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [];
  });

  // Charger les vraies matières depuis Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getMatieres(userId)
      .then((res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const apiMatieres = res.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            coefficient: String(m.coefficient ?? '1'),
            color: m.color || '#EA580C',
          }));
          setSavedMatieres(apiMatieres);
          localStorage.setItem('unifolder_saved_matieres', JSON.stringify(apiMatieres));
        }
      })
      .catch((err) => console.warn('Erreur chargement matières depuis D1:', err));
  }, []);

  useEffect(() => {
    localStorage.setItem('unifolder_saved_matieres', JSON.stringify(savedMatieres));
    triggerDebouncedCloudBackup();
  }, [savedMatieres]);

  useEffect(() => {
    const handleDataRestored = () => {
      const saved = localStorage.getItem('unifolder_saved_matieres');
      if (saved) {
        try { setSavedMatieres(JSON.parse(saved)); } catch (e) {}
      } else {
        setSavedMatieres([]);
      }
    };
    window.addEventListener('unifolder_data_restored', handleDataRestored);
    return () => window.removeEventListener('unifolder_data_restored', handleDataRestored);
  }, []);

  const notify = (_msg: string) => {
    // Supprimé selon la demande utilisateur
  };

  const handleDeleteMatiere = (index: number) => {
    const mat = savedMatieres[index];
    if (!mat) return;
    if (!window.confirm(`Voulez-vous vraiment supprimer le dossier de la matière "${mat.name}" ainsi que ses fichiers ?`)) return;
    localStorage.removeItem(`unifolder_matiere_files_${mat.name}`);
    setSavedMatieres(prev => prev.filter((_, i) => i !== index));
    if (mat.id) {
      StudyCloudAPI.deleteMatiere(mat.id).catch(() => {});
    }
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

      case 'storage':
        label = 'Mon stockage';
        defaultAction = () => setViewMode('storage-menu');
        iconContent = (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Nuage supérieur moderne avec dégradé cyan / bleu */}
              <path
                d="M 32 48 C 23 48 16 41 16 33 C 16 25 22 18 30 17 C 34 9 46 7 55 13 C 61 9 70 11 74 17 C 82 18 88 25 88 33 C 88 41 81 48 72 48 Z"
                fill="url(#storageCloudGrad)"
              />
              {/* Disque serveur 1 */}
              <ellipse cx="50" cy="54" rx="27" ry="7.5" fill="#1E293B" />
              <ellipse cx="50" cy="53" rx="27" ry="7.5" fill="#38BDF8" />
              <ellipse cx="50" cy="52" rx="26" ry="6.5" fill="#F1F5F9" />
              <path d="M 24 52 v 9 c 0 4.2 11.6 7.5 26 7.5 s 26 -3.3 26 -7.5 v -9" fill="#0284C7" />
              <ellipse cx="50" cy="61" rx="26" ry="7" fill="#38BDF8" />
              <circle cx="34" cy="61" r="2" fill="#22C55E" />
              <circle cx="41" cy="61" r="2" fill="#F8FAFC" />

              {/* Disque serveur 2 */}
              <path d="M 24 63 v 9 c 0 4.2 11.6 7.5 26 7.5 s 26 -3.3 26 -7.5 v -9" fill="#0369A1" />
              <ellipse cx="50" cy="72" rx="26" ry="7" fill="#0284C7" />
              <circle cx="34" cy="72" r="2" fill="#22C55E" />
              <circle cx="41" cy="72" r="2" fill="#F8FAFC" />

              {/* Disque serveur 3 */}
              <path d="M 24 74 v 9 c 0 4.2 11.6 7.5 26 7.5 s 26 -3.3 26 -7.5 v -9" fill="#0F172A" />
              <ellipse cx="50" cy="83" rx="26" ry="7" fill="#0369A1" />
              <circle cx="34" cy="83" r="2" fill="#22C55E" />
              <circle cx="41" cy="83" r="2" fill="#FACC15" />

              <defs>
                <linearGradient id="storageCloudGrad" x1="16" y1="7" x2="88" y2="48" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38BDF8" />
                  <stop offset="1" stopColor="#0284C7" />
                </linearGradient>
              </defs>
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
        onClick={(e) => {
          if (hasMovedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          defaultAction();
        }}
        className="group flex flex-col items-center cursor-pointer w-full max-w-[94px] sm:max-w-[102px] md:w-24 lg:w-26 md:shrink-0 transition-all duration-200 hover:scale-105"
      >
        <div className="w-full aspect-square bg-stone-900 dark:bg-slate-800/80 dark:backdrop-blur-xl border-2 border-stone-800 dark:border-white/15 rounded-2xl shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-[0_8px_25px_rgba(0,0,0,0.45)] dark:hover:border-blue-400/40 dark:hover:shadow-[0_12px_30px_rgba(37,99,235,0.25)] flex items-center justify-center group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_#1c1917] transition-all relative">
          {iconContent}
        </div>
        <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-stone-950 dark:text-blue-400 mt-1.5 sm:mt-2 text-center px-0.5 leading-snug tracking-wide w-full line-clamp-2 transition-colors">{label}</span>
      </div>
    );
  };

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
    <div className="flex flex-col items-center justify-start min-h-[75vh] px-2 sm:px-4 text-center pt-12 md:pt-14 pb-24 bg-[#E9D7C9] dark:bg-[#0b0f19] transition-colors duration-200">
      {/* Fixed Header bar with action buttons - Solid Dark #070a13 */}
      <div className={`fixed top-0 left-0 right-0 md:left-64 z-40 px-3 md:px-6 py-2 h-[64px] md:h-[68px] flex items-center justify-between gap-2 md:gap-4 transition-all duration-300 ${
        isDarkMode 
          ? 'bg-[#070a13] border-b border-[#1e293b] shadow-md' 
          : 'bg-[#E9D7C9] border-b-2 border-stone-800 shadow-sm'
      }`}>
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
          {/* Delmas IA Overlay Modal - Chat direct et éphémère (sans base de données) */}
          {isAssistantOpen && (
            <div 
              className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 md:p-6 animate-fadeIn"
              onClick={() => setIsAssistantOpen(false)}
            >
              <div 
                className="w-full h-full sm:max-w-3xl sm:h-[88vh] sm:max-h-[820px] bg-[#16181d] sm:rounded-3xl sm:border sm:border-zinc-700/70 shadow-2xl flex flex-col overflow-hidden relative text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <DelmasChat 
                  onClose={() => setIsAssistantOpen(false)} 
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3">
          {/* Espace d'étude Button (Placé directement DEVANT le bouton mode sombre) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => onOpenStudySpace?.()}
              className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                isDarkMode 
                  ? 'bg-[#1e293b] hover:bg-[#283852] text-amber-400 border-amber-500/50 shadow-sm' 
                  : 'bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917]'
              }`}
              title="Ouvrir l'Espace d'étude"
            >
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${isDarkMode ? 'text-white' : 'text-stone-700'}`}>
              Espace d'étude
            </span>
          </div>

          {/* Dark / Night Mode Toggle Button (Placé directement DEVANT le bouton langue) */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                isDarkMode 
                  ? 'bg-[#1e293b] hover:bg-[#283852] text-amber-400 border-amber-500/50 shadow-sm' 
                  : 'bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917]'
              }`}
              title={isDarkMode ? "Passer en mode jour" : "Passer en mode nuit / sombre"}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${isDarkMode ? 'text-amber-300' : 'text-stone-700'}`}>
              {isDarkMode ? "Jour" : "Sombre"}
            </span>
          </div>

          {/* Language button - Solid filled #1e293b, no transparency */}
          <div className="flex flex-col items-center relative">
            <button
              onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
              className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                isDarkMode
                  ? 'bg-[#1e293b] hover:bg-[#283852] text-white border-[#334155] shadow-sm'
                  : 'bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917]'
              }`}
              title="Langue"
            >
              <Globe className="w-4 h-4 text-rose-400" />
            </button>
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${isDarkMode ? 'text-white' : 'text-stone-700'}`}>
              Langue
            </span>
            
            {isLanguageMenuOpen && (
              <div className={`absolute top-full right-0 mt-2 rounded-2xl shadow-2xl z-50 min-w-[160px] py-1.5 max-h-[300px] overflow-y-auto border-2 ${
                isDarkMode
                  ? 'bg-[#111a2e] border-[#334155] text-white'
                  : 'bg-[#F5F1E9] border-2 border-stone-800 text-stone-800'
              }`}>
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
                      className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors ${
                        isSelected 
                          ? 'bg-rose-500/25 text-rose-400 border-l-4 border-rose-500' 
                          : isDarkMode 
                          ? 'text-slate-200 hover:bg-[#1e293b] border-l-4 border-transparent' 
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

          {/* Delmas IA Button - Robot orange-bleu distinct du robot d'étude */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsAssistantOpen(!isAssistantOpen)}
              className="flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-all select-none shrink-0"
              title={isAssistantOpen ? "Fermer Delmas IA" : "Ouvrir Delmas IA"}
            >
              <div className={`relative p-0.5 rounded-full transition-all duration-200 ${
                isAssistantOpen 
                  ? 'ring-2 ring-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.7)] scale-105' 
                  : 'hover:scale-105 shadow-[0_2px_8px_rgba(37,99,235,0.3)]'
              }`}>
                <DelmasRobot size={38} variant="blue" />
              </div>
            </button>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-1 leading-none whitespace-nowrap transition-colors ${
              isAssistantOpen ? 'text-blue-500' : 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700'
            }`}>
              delmas IA
            </span>
          </div>

          {/* Abondamment button - Solid filled #1e293b, no transparency */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                setPricingInitialTab('storage');
                setPreviousViewMode(viewMode === 'abondamment' ? 'home' : viewMode);
                setViewMode('abondamment');
              }}
              className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                isDarkMode
                  ? 'bg-[#1e293b] hover:bg-[#283852] text-amber-400 border-[#334155] shadow-sm'
                  : 'bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917]'
              }`}
              title="Abonnement"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${isDarkMode ? 'text-white' : 'text-stone-700'}`}>
              Abonnement
            </span>
          </div>

          {/* Créer les matières - Solid filled #1e293b, no transparency */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsMatiereMenuOpen(true)}
              className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                isDarkMode
                  ? 'bg-[#1e293b] hover:bg-[#283852] text-orange-400 border-[#334155] shadow-sm'
                  : 'bg-[#F5F1E9] hover:bg-[#EBE5DA] text-stone-800 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917]'
              }`}
              title="Matière"
            >
              <FolderPlus className="w-4 h-4 text-orange-400" />
            </button>
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${isDarkMode ? 'text-white' : 'text-stone-700'}`}>
              Matière
            </span>
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
                  const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
                  const createdWithIds = matieresList.map((m, idx) => ({
                    id: 'mat-' + Date.now() + '-' + idx,
                    name: m.name.trim(),
                    coefficient: m.coefficient.trim() || '1',
                    color: '#EA580C',
                  }));

                  // Synchroniser chaque matière avec Cloudflare D1
                  createdWithIds.forEach((m) => {
                    StudyCloudAPI.createMatiere({
                      id: m.id,
                      userId,
                      name: m.name,
                      coefficient: parseFloat(m.coefficient) || 1.0,
                      color: m.color,
                    }).catch((err) => console.warn('Erreur création matière D1:', err));
                  });

                  setSavedMatieres(prev => [...prev, ...createdWithIds]);
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
                    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
                    const targetMat = savedMatieres[editingMatiere.index];
                    const matId = targetMat?.id || ('mat-' + Date.now());
                    
                    StudyCloudAPI.createMatiere({
                      id: matId,
                      userId,
                      name: editingMatiere.name.trim(),
                      coefficient: parseFloat(editingMatiere.coefficient) || 1.0,
                      color: targetMat?.color || '#EA580C',
                    }).catch((err) => console.warn('Erreur modification matière D1:', err));

                    setSavedMatieres(prev => {
                      const updated = [...prev];
                      updated[editingMatiere.index] = { 
                        id: matId,
                        name: editingMatiere.name.trim(), 
                        coefficient: editingMatiere.coefficient.trim() || '1',
                        color: targetMat?.color || '#EA580C'
                      };
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

      {viewMode === 'abondamment' && (
        <PricingView 
          initialTab={pricingInitialTab}
          onBack={() => setViewMode(previousViewMode || 'home')} 
          onSelectPlan={(plan) => notify(`Plan ${plan} sélectionné`)} 
        />
      )}

      {viewMode === 'files-menu' && <FilesMenuView
        onBack={() => setViewMode('home')}
        onImportFile={onOpenUpload}
        setActivePreviewItem={setActivePreviewItem}
        onOpenCreateShareLink={onOpenCreateShareLink}
        onPublishFiles={(files) => {
          try {
            const payload = files.map(f => ({
              id: f.id || `pub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: f.name,
              size: f.size,
              type: f.type,
              url: f.url || '',
              isImage: f.isImage || false,
            }));
            localStorage.setItem('published_selected_files', JSON.stringify(payload));
          } catch (e) {}
          if (onOpenPublishView) onOpenPublishView();
        }}
      />}
      {typeof viewMode === 'string' && viewMode.startsWith('matiere-') && (
        <MatiereMenuView 
          key={viewMode}
          matiereName={viewMode.replace('matiere-', '')} 
          onBack={() => setViewMode('home')} 
          setActivePreviewItem={setActivePreviewItem} 
          onOpenCreateShareLink={onOpenCreateShareLink}
        />
      )}
      {viewMode === 'schedule-menu' && <ScheduleMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'notes-menu' && <NotesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'grades-menu' && <GradesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'calendar-menu' && <CalendarMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'favorites-menu' && <FavoritesMenuView onBack={() => setViewMode('home')} setActivePreviewItem={setActivePreviewItem} />}
      {viewMode === 'clock-menu' && <ClockMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'level-menu' && <LevelMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'calculator-menu' && <CalculatorMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'storage-menu' && (
        <StorageMenuView 
          onBack={() => setViewMode('home')} 
          onOpenPricing={(tab = 'storage') => {
            setPricingInitialTab(tab);
            setPreviousViewMode('storage-menu');
            setViewMode('abondamment');
          }}
        />
      )}
      {viewMode === 'page1-files-menu' && (
        <Page1FilesMenuView onBack={() => setViewMode('home')} onOpenStudySpace={onOpenStudySpace} />
      )}

      {viewMode === 'home' && (
        <div className="w-full max-w-[1400px] mx-auto px-1 sm:px-4 py-2 relative">
          {/* Titre de l'écran actif */}
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400 select-none">
              {activePageIndex === 0 ? "Espace libre • Page 1" : "Écran d'accueil • Page 2"}
            </span>
          </div>

          {/* Conteneur Carrousel / Glissement fluide (Swipe phone & Desktop) */}
          <div 
            className="w-full overflow-hidden select-none touch-pan-y relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div 
              className="flex w-[200%] will-change-transform"
              style={{
                transform: `translate3d(calc(-${activePageIndex * 50}% + ${dragOffset}px), 0, 0)`,
                transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            >
              {/* PAGE 0 : Page 1 à gauche avec l'application Fichiers 3D (sans bloc noir, poussée à gauche) */}
              <div className="w-1/2 shrink-0 px-2 sm:px-4 py-2">
                <div className="flex items-start justify-start w-full pt-1 pl-1 sm:pl-3 md:pl-5">
                  {/* Application Fichiers 3D - Poussée à gauche où se trouvait la marque rouge */}
                  <div 
                    onClick={(e) => {
                      if (hasMovedRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      setViewMode('page1-files-menu');
                    }}
                    className="group flex flex-col items-center cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    {/* Dossier 3D affiné, taille un peu réduite, teinté bleu doux avec bord orange et contour fin */}
                    <div className="w-24 h-21 sm:w-28 sm:h-24 md:w-32 md:h-28 transition-all duration-300 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_10px_22px_rgba(0,0,0,0.45)] group-hover:drop-shadow-[0_14px_24px_rgba(56,189,248,0.35)]">
                      <svg className="w-full h-full" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          {/* Dégradé Orange pour le bord / onglet arrière */}
                          <linearGradient id="p1FolderBackGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FB923C" />
                            <stop offset="100%" stopColor="#EA580C" />
                          </linearGradient>
                          {/* Dégradé Bleu doux non-pur pour la face avant du dossier */}
                          <linearGradient id="p1FolderFrontGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#BAE6FD" />
                            <stop offset="50%" stopColor="#60A5FA" />
                            <stop offset="100%" stopColor="#38BDF8" />
                          </linearGradient>
                        </defs>

                        {/* Dos du dossier avec bordure supérieure Orange bien visible */}
                        <path 
                          d="M 44 14 L 86 14 C 91 14 94 17 94 22 L 94 40 L 44 40 Z" 
                          fill="url(#p1FolderBackGrad)" 
                          stroke="#18181B" 
                          strokeWidth="1.3" 
                          strokeLinejoin="round" 
                        />

                        {/* Corps principal avant du dossier en bleu élégant avec contour fin */}
                        <path 
                          d="
                            M 16 14
                            L 44 14
                            C 48 14 50 17 52 20
                            C 54 23 56 25 60 25
                            L 86 25
                            C 91 25 94 28 94 33
                            L 94 76
                            C 94 81 91 84 86 84
                            L 14 84
                            C 9 84 6 81 6 76
                            L 6 22
                            C 6 17 9 14 14 14
                            Z
                          " 
                            fill="url(#p1FolderFrontGrad)" 
                          stroke="#18181B" 
                          strokeWidth="1.3" 
                          strokeLinejoin="round" 
                          strokeLinecap="round" 
                        />

                        {/* Liseré fin orange sur le pli supérieur du rabat */}
                        <path
                          d="M 16 16 L 43 16 C 47 16 49 18 51 21 C 53 24 55 26 59 26 L 85 26"
                          stroke="#EA580C"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 mt-2 text-center tracking-tight transition-colors">
                      Fichiers
                    </span>
                  </div>
                </div>
              </div>

              {/* PAGE 1 : Écran d'accueil principal à droite */}
              <div className="w-1/2 shrink-0 px-1 sm:px-4">
                {/* Sur mobile : 3 blocs par ligne | Sur desktop : 9 colonnes centrées avec la 2ème ligne commençant sous "Mes fichiers" */}
                <div className="grid grid-cols-3 md:grid-cols-9 gap-y-6 gap-x-2 sm:gap-x-4 md:gap-4 lg:gap-6 justify-items-center w-fit max-w-full mx-auto md:overflow-x-auto md:pb-4 md:pt-1 md:no-scrollbar">
                  {['files', 'favorites', 'schedule', 'notes', 'grades', 'level', 'calendar', 'clock', 'calculator', 'storage'].map((id, index) => renderBlock(id, index))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination dots (Pointillés de navigation des pages) - Presque collé à la limite en bas de l'écran et au milieu */}
      {viewMode === 'home' && (
        <div 
          className="fixed bottom-16 md:bottom-2.5 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-[calc(50%+8rem)] md:-translate-x-1/2 z-30 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-stone-900/10 dark:bg-black/50 backdrop-blur-md border border-stone-800/15 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all select-none"
          role="navigation"
          aria-label="Pagination des menus"
        >
          {/* Point 1 (Page vide - index 0) */}
          <button
            type="button"
            onClick={() => handleGoToPage(0)}
            aria-label="Page 1 : Espace libre"
            title="Page 1 (Espace libre)"
            className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
              activePageIndex === 0
                ? 'w-6 h-2 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                : 'w-2 h-2 bg-stone-400/60 dark:bg-stone-500/50 hover:bg-stone-600 dark:hover:bg-stone-300'
            }`}
          />
          {/* Point 2 (Écran d'accueil principal - index 1) */}
          <button
            type="button"
            onClick={() => handleGoToPage(1)}
            aria-label="Page 2 : Écran d'accueil"
            title="Page 2 (Écran d'accueil)"
            className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
              activePageIndex === 1
                ? 'w-6 h-2 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                : 'w-2 h-2 bg-stone-400/60 dark:bg-stone-500/50 hover:bg-stone-600 dark:hover:bg-stone-300'
            }`}
          />
        </div>
      )}

      {/* Flèches de navigation d'angle : Extrême gauche (sous le menu hamburger) et Extrême droite de l'écran */}
      {viewMode === 'home' && (
        <>
          {/* Flèche gauche (<) - Extrêmement dans l'angle gauche, sous le menu hamburger */}
          <button
            type="button"
            onClick={() => handleGoToPage(0)}
            disabled={activePageIndex === 0}
            className={`hidden md:flex items-center justify-center fixed top-[74px] md:top-[78px] left-3 md:left-[calc(16rem+1.5rem)] z-30 w-8 h-8 rounded-full border-2 transition-all duration-200 select-none ${
              activePageIndex === 0
                ? 'opacity-20 cursor-not-allowed border-stone-400/30 text-stone-400 dark:border-slate-800 dark:text-slate-600'
                : 'cursor-pointer hover:scale-110 active:scale-95 border-stone-800 dark:border-slate-600 bg-[#F5F1E9] dark:bg-[#1e293b] text-stone-900 dark:text-white shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none'
            }`}
            title={activePageIndex === 0 ? "Début atteint" : "Glisser vers la gauche (Page libre)"}
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Flèche droite (>) - Extrêmement dans l'angle droit de l'écran */}
          <button
            type="button"
            onClick={() => handleGoToPage(1)}
            disabled={activePageIndex === 1}
            className={`hidden md:flex items-center justify-center fixed top-[74px] md:top-[78px] right-3 md:right-6 z-30 w-8 h-8 rounded-full border-2 transition-all duration-200 select-none ${
              activePageIndex === 1
                ? 'opacity-20 cursor-not-allowed border-stone-400/30 text-stone-400 dark:border-slate-800 dark:text-slate-600'
                : 'cursor-pointer hover:scale-110 active:scale-95 border-stone-800 dark:border-slate-600 bg-[#F5F1E9] dark:bg-[#1e293b] text-stone-900 dark:text-white shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none'
            }`}
            title={activePageIndex === 1 ? "Fin atteinte" : "Revenir à l'écran d'accueil (droite)"}
            aria-label="Page suivante"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </>
      )}
    </div>
  );
};

