import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { HomeFavoritesMenuView } from './HomeFavoritesMenuView';
import { ClockMenuView } from './ClockMenuView';
import { LevelMenuView } from './LevelMenuView';
import { CalculatorMenuView } from './CalculatorMenuView';
import { MatiereMenuView } from './MatiereMenuView';
import { StorageMenuView } from './StorageMenuView';
import { Page1FilesMenuView } from './Page1FilesMenuView';
import { NavigationTab } from '../types';
import { triggerDebouncedCloudBackup, getCurrentUserId } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';
import { useDashboardWallpaper } from '../hooks/useCloudQueries';
import { getActiveWallpaperReliable } from '../utils/wallpaperHelper';

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
  // viewMode ne doit JAMAIS être restauré depuis localStorage - toujours démarrer à 'home'
  const [viewMode, setViewMode] = useState<'home' | 'abondamment' | 'files-menu' | 'storage-menu' | 'schedule-menu' | 'notes-menu' | 'grades-menu' | 'calendar-menu' | 'favorites-menu' | 'clock-menu' | 'level-menu' | 'calculator-menu' | string>('home');

  useEffect(() => {
    // Nettoyage : effacer toute ancienne valeur de viewMode dans localStorage
    localStorage.removeItem('unifolder_view_mode');
  }, []);

  useEffect(() => {
    const handleOpenPricingEvent = (e: any) => {
      const tab = e?.detail?.tab || 'storage';
      setPricingInitialTab(tab);
      setPreviousViewMode('home');
      setViewMode('abondamment');
    };
    window.addEventListener('studycloud_open_pricing', handleOpenPricingEvent);
    return () => {
      window.removeEventListener('studycloud_open_pricing', handleOpenPricingEvent);
    };
  }, []);


  // État et gestion du carrousel de l'écran d'accueil (Page 0 = Page vide, Page 1 = Écran d'accueil principal)
  const [activePageIndex, setActivePageIndex] = useState<number>(1);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // TanStack Query : Gestion universelle du fond d'écran dédié avec réactivité temps réel
  const { data: cloudWallpaperData } = useDashboardWallpaper();

  // Fond d'écran personnalisé du tableau de bord (Page 1 et Page 2)
  // Rendu instantané 0ms dès l'initialisation du composant sans délai ni clignotement
  const [dashboardWallpaper, setDashboardWallpaper] = useState<string | null>(() => {
    const cached = localStorage.getItem('studycloud_dashboard_wallpaper');
    // Ignorer les anciens blob: expirés pour éviter l'écran grisé
    if (cached && !cached.startsWith('blob:')) return cached;
    return null;
  });

  // Récupération fiable au montage depuis IndexedDB si localStorage était vide ou révoqué
  useEffect(() => {
    getActiveWallpaperReliable().then((reliable) => {
      if (reliable && reliable !== dashboardWallpaper) {
        setDashboardWallpaper(reliable);
      }
    });
  }, []);

  // Synchronisation transparente en arrière-plan : préchargement en mémoire (0ms perçu)
  useEffect(() => {
    if (cloudWallpaperData?.url) {
      if (cloudWallpaperData.url !== dashboardWallpaper && !cloudWallpaperData.url.startsWith('blob:')) {
        // Précharger l'image dans le cache du navigateur avant de l'afficher
        const img = new Image();
        img.src = cloudWallpaperData.url;
        img.onload = () => {
          setDashboardWallpaper(cloudWallpaperData.url);
          try {
            localStorage.setItem('studycloud_dashboard_wallpaper', cloudWallpaperData.url);
          } catch {}
        };
      }
    } else if (cloudWallpaperData === null && dashboardWallpaper !== null) {
      // Cas où le fond d'écran a été réinitialisé depuis un autre appareil
      setDashboardWallpaper(null);
      try {
        localStorage.removeItem('studycloud_dashboard_wallpaper');
        localStorage.removeItem('studycloud_dashboard_wallpaper_meta');
      } catch {}
    }
  }, [cloudWallpaperData?.url]);

  useEffect(() => {
    const handleWallpaperChange = (e: any) => {
      const wp = e?.detail?.wallpaper !== undefined 
        ? e.detail.wallpaper 
        : localStorage.getItem('studycloud_dashboard_wallpaper');
      if (wp && !wp.startsWith('blob:')) {
        setDashboardWallpaper(wp);
      } else if (!wp) {
        setDashboardWallpaper(null);
      }
    };
    window.addEventListener('studycloud_wallpaper_updated', handleWallpaperChange);
    return () => window.removeEventListener('studycloud_wallpaper_updated', handleWallpaperChange);
  }, []);

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
    const userId = localStorage.getItem('unifolder_user_id');
    if (!userId || userId === 'default-user') {
      setSavedMatieres([]);
      return;
    }
    StudyCloudAPI.getMatieres(userId)
      .then((res) => {
        if (res && res.success && Array.isArray(res.data)) {
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

  const isInitialMatieresMount = useRef(true);
  useEffect(() => {
    if (isInitialMatieresMount.current) {
      isInitialMatieresMount.current = false;
      return;
    }
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
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                {/* Dos et onglet arrière en Dégradé Bleu Roi / Électrique */}
                <linearGradient id="p2FilesBackBlueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="40%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>

                {/* Face avant du dossier en Dégradé Orange Vibrant / Ambré */}
                <linearGradient id="p2FilesFrontOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FED7AA" />
                  <stop offset="25%" stopColor="#FB923C" />
                  <stop offset="70%" stopColor="#EA580C" />
                  <stop offset="100%" stopColor="#C2410C" />
                </linearGradient>

                {/* Papier intérieur avec bordure bleutée */}
                <linearGradient id="p2FilesPaperGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F0F9FF" />
                </linearGradient>
              </defs>

              {/* Onglet et dos du dossier en BLEU intense */}
              <path 
                d="M 14 20 C 14 16 17 13 21 13 L 42 13 C 45 13 48 16 50 19 L 54 24 L 84 24 C 88 24 91 27 91 31 L 91 46 L 14 46 Z" 
                fill="url(#p2FilesBackBlueGrad)" 
                stroke="#18181B" 
                strokeWidth="1.3" 
                strokeLinejoin="round" 
              />

              {/* Liseré lumineux cyan sur le haut de l'onglet bleu */}
              <path 
                d="M 21 15 L 42 15 C 44 15 46 17 48 19 L 51 24 L 84 24" 
                stroke="#BAE6FD" 
                strokeWidth="1.2" 
                strokeLinecap="round" 
              />

              {/* Feuilles de documents blancs/bleutés qui dépassent à l'intérieur */}
              <rect x="22" y="18" width="56" height="34" rx="4" fill="url(#p2FilesPaperGrad)" stroke="#BAE6FD" strokeWidth="1" />
              <line x1="30" y1="25" x2="68" y2="25" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="30" y1="31" x2="56" y2="31" stroke="#93C5FD" strokeWidth="2.2" strokeLinecap="round" />

              {/* Corps principal avant du dossier en ORANGE chaleureux 3D */}
              <path 
                d="
                  M 14 34
                  L 44 34
                  C 48 34 50 36 52 38
                  C 54 40 56 42 60 42
                  L 86 42
                  C 91 42 94 45 94 49
                  L 92 78
                  C 92 82 88 85 84 85
                  L 16 85
                  C 11 85 8 82 8 78
                  L 8 40
                  C 8 36 10 34 14 34
                  Z
                " 
                fill="url(#p2FilesFrontOrangeGrad)" 
                stroke="#18181B" 
                strokeWidth="1.3" 
                strokeLinejoin="round" 
                strokeLinecap="round" 
              />

              {/* Liseré fin BLEU ÉLECTRIQUE sur le pli supérieur du rabat orange (mélange orange & bleu parfait) */}
              <path
                d="M 14 36 L 43 36 C 47 36 49 38 51 40 C 53 42 55 44 59 44 L 86 44"
                stroke="#0284C7"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Reflet de brillance dorée sous le liseré */}
              <path
                d="M 14 39 L 43 39"
                stroke="#FEF08A"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.8"
              />
            </svg>
          </div>
        );
        break;

      case 'schedule':
        label = 'Mon emploi du temps';
        defaultAction = () => setViewMode('schedule-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2SchedHeaderGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" />
                  <stop offset="100%" stopColor="#DC2626" />
                </linearGradient>
                <linearGradient id="p2SchedBodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F1F5F9" />
                </linearGradient>
                <linearGradient id="p2RingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E2E8F0" />
                  <stop offset="50%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#94A3B8" />
                </linearGradient>
              </defs>
              <rect x="12" y="18" width="76" height="72" rx="14" fill="url(#p2SchedBodyGrad)" stroke="#18181B" strokeWidth="1.3" />
              <path 
                d="M 12 32 C 12 24 18 18 26 18 L 74 18 C 82 18 88 24 88 32 L 88 38 L 12 38 Z" 
                fill="url(#p2SchedHeaderGrad)" 
                stroke="#18181B" 
                strokeWidth="1.3" 
              />
              <text x="50" y="31" fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle" letterSpacing="2">EDT</text>
              <rect x="28" y="10" width="7" height="15" rx="3.5" fill="url(#p2RingGrad)" stroke="#18181B" strokeWidth="1" />
              <rect x="65" y="10" width="7" height="15" rx="3.5" fill="url(#p2RingGrad)" stroke="#18181B" strokeWidth="1" />
              <text x="50" y="66" fill="#1E293B" fontSize="26" fontWeight="900" textAnchor="middle">17</text>
              <rect x="28" y="72" width="44" height="4" rx="2" fill="#38BDF8" />
              <rect x="34" y="79" width="32" height="3" rx="1.5" fill="#34D399" />
            </svg>
          </div>
        );
        break;

      case 'notes':
        label = 'Bloc-notes';
        defaultAction = () => setViewMode('notes-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2NotesCoverGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
                <linearGradient id="p2NotesPencilGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FDBA74" />
                  <stop offset="50%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#EA580C" />
                </linearGradient>
              </defs>
              <rect x="14" y="12" width="62" height="76" rx="8" fill="url(#p2NotesCoverGrad)" stroke="#18181B" strokeWidth="1.3" />
              <rect x="18" y="15" width="56" height="70" rx="5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="28" y1="28" x2="66" y2="28" stroke="#93C5FD" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="28" y1="38" x2="66" y2="38" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="28" y1="48" x2="66" y2="48" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="28" y1="58" x2="52" y2="58" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="28" y1="68" x2="60" y2="68" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="32" y1="15" x2="32" y2="85" stroke="#FCA5A5" strokeWidth="1.2" strokeDasharray="3 2" />
              {[22, 34, 46, 58, 70].map(y => (
                <ellipse key={y} cx="16" cy={y} rx="3" ry="2" fill="#E2E8F0" stroke="#18181B" strokeWidth="1" />
              ))}
              <g transform="translate(56, 34) rotate(32)">
                <rect x="0" y="0" width="10" height="46" rx="2" fill="url(#p2NotesPencilGrad)" stroke="#18181B" strokeWidth="1" />
                <path d="M 0 46 L 5 56 L 10 46 Z" fill="#FED7AA" stroke="#18181B" strokeWidth="1" />
                <path d="M 3.5 52 L 5 56 L 6.5 52 Z" fill="#18181B" />
                <rect x="0" y="0" width="10" height="8" rx="2" fill="#F43F5E" />
                <rect x="0" y="7" width="10" height="3" fill="#CBD5E1" />
              </g>
            </svg>
          </div>
        );
        break;

      case 'grades':
        label = "Mes notes d'évaluation";
        defaultAction = () => setViewMode('grades-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2GradesBoardGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="p2GradesClipGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#94A3B8" />
                  <stop offset="50%" stopColor="#F8FAFC" />
                  <stop offset="100%" stopColor="#64748B" />
                </linearGradient>
              </defs>
              <rect x="12" y="14" width="76" height="78" rx="12" fill="url(#p2GradesBoardGrad)" stroke="#18181B" strokeWidth="1.3" />
              <rect x="18" y="20" width="64" height="68" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              <rect x="34" y="8" width="32" height="14" rx="4" fill="url(#p2GradesClipGrad)" stroke="#18181B" strokeWidth="1.2" />
              <circle cx="50" cy="14" r="3" fill="#1E293B" />
              {[32, 44, 56, 68].map((y, i) => (
                <g key={y}>
                  <rect x="24" y={y} width="10" height="10" rx="3" fill="#10B981" />
                  <path d={`M 26.5 ${y + 5} L 28.5 ${y + 7.5} L 31.5 ${y + 3}`} stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="38" y={y + 1.5} width={26 + (i % 2) * 8} height="3" rx="1.5" fill="#1E293B" />
                  <rect x="38" y={y + 6} width={16 + (i % 3) * 6} height="2" rx="1" fill="#94A3B8" />
                </g>
              ))}
              <circle cx="72" cy="74" r="10" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
              <text x="72" y="78" fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle">A+</text>
            </svg>
          </div>
        );
        break;

      case 'calendar':
        label = 'Calendrier';
        defaultAction = () => setViewMode('calendar-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2CalHeaderGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#BE185D" />
                </linearGradient>
                <linearGradient id="p2CalPaperGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F1F5F9" />
                </linearGradient>
              </defs>
              <rect x="12" y="16" width="76" height="74" rx="14" fill="url(#p2CalPaperGrad)" stroke="#18181B" strokeWidth="1.3" />
              <path 
                d="M 12 30 C 12 22 18 16 26 16 L 74 16 C 82 16 88 22 88 30 L 88 36 L 12 36 Z" 
                fill="url(#p2CalHeaderGrad)" 
                stroke="#18181B" 
                strokeWidth="1.3" 
              />
              <text x="50" y="29" fill="#FFFFFF" fontSize="9.5" fontWeight="900" textAnchor="middle" letterSpacing="1.5">CALENDRIER</text>
              <rect x="28" y="10" width="7" height="13" rx="3.5" fill="#CBD5E1" stroke="#18181B" strokeWidth="1" />
              <rect x="65" y="10" width="7" height="13" rx="3.5" fill="#CBD5E1" stroke="#18181B" strokeWidth="1" />
              {[45, 57, 69, 81].map(rowY => (
                <g key={rowY}>
                  {[24, 37, 50, 63, 76].map(colX => {
                    const isSpecial = (rowY === 57 && colX === 50);
                    return isSpecial ? (
                      <circle key={colX} cx={colX} cy={rowY} r="5.5" fill="#EC4899" />
                    ) : (
                      <circle key={colX} cx={colX} cy={rowY} r="3.5" fill="#CBD5E1" />
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
        );
        break;

      case 'favorites':
        label = 'Favoris';
        defaultAction = () => setViewMode('favorites-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2FavHeart3DGrad" x1="20" y1="12" x2="80" y2="88" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FB7185" />
                  <stop offset="30%" stopColor="#F43F5E" />
                  <stop offset="70%" stopColor="#E11D48" />
                  <stop offset="100%" stopColor="#9F1239" />
                </linearGradient>
                <linearGradient id="p2FavHighlightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path 
                d="M 50 84 C 50 84 14 58 14 33 C 14 18 26 10 38 10 C 45 10 50 15 50 15 C 50 15 55 10 62 10 C 74 10 86 18 86 33 C 86 58 50 84 50 84 Z" 
                fill="url(#p2FavHeart3DGrad)" 
                stroke="#18181B" 
                strokeWidth="1.3" 
                strokeLinejoin="round" 
              />
              <path 
                d="M 23 30 C 23 20 29 14 38 14 C 43 14 47 17 48 19 C 42 20 30 24 25 36 C 24 34 23 32 23 30 Z" 
                fill="url(#p2FavHighlightGrad)" 
              />
              <path 
                d="M 72 22 L 74 28 L 80 30 L 74 32 L 72 38 L 70 32 L 64 30 L 70 28 Z" 
                fill="#FEF08A" 
              />
            </svg>
          </div>
        );
        break;

      case 'clock':
        label = 'Horloge';
        defaultAction = () => setViewMode('clock-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2ClockBodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" />
                  <stop offset="40%" stopColor="#EF4444" />
                  <stop offset="100%" stopColor="#B91C1C" />
                </linearGradient>
                <linearGradient id="p2ClockBellGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FCA5A5" />
                  <stop offset="100%" stopColor="#991B1B" />
                </linearGradient>
              </defs>
              <rect x="22" y="76" width="9" height="16" rx="3.5" fill="#64748B" stroke="#18181B" strokeWidth="1" transform="rotate(25 26 84)" />
              <rect x="69" y="76" width="9" height="16" rx="3.5" fill="#64748B" stroke="#18181B" strokeWidth="1" transform="rotate(-25 73 84)" />
              <path d="M 18 30 C 14 18 30 12 36 22 Z" fill="url(#p2ClockBellGrad)" stroke="#18181B" strokeWidth="1.3" />
              <path d="M 82 30 C 86 18 70 12 64 22 Z" fill="url(#p2ClockBellGrad)" stroke="#18181B" strokeWidth="1.3" />
              <rect x="47" y="12" width="6" height="10" rx="2" fill="#94A3B8" stroke="#18181B" strokeWidth="1" />
              <circle cx="50" cy="52" r="36" fill="url(#p2ClockBodyGrad)" stroke="#18181B" strokeWidth="1.3" />
              <circle cx="50" cy="52" r="28" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="50" y1="28" x2="50" y2="32" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="50" y1="72" x2="50" y2="76" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="26" y1="52" x2="30" y2="52" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="70" y1="52" x2="74" y2="52" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 50 52 L 50 36" stroke="#1E293B" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 50 52 L 66 52" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="50" cy="52" r="4" fill="#EF4444" />
            </svg>
          </div>
        );
        break;

      case 'level':
        label = "Évolution & Stats";
        defaultAction = () => setViewMode('level-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2BarGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
                <linearGradient id="p2BarGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
                <linearGradient id="p2BarGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="p2BarGrad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="p2StatsPlateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
              </defs>
              <ellipse cx="50" cy="85" rx="42" ry="9" fill="url(#p2StatsPlateGrad)" stroke="#18181B" strokeWidth="1.2" />
              <ellipse cx="50" cy="83" rx="40" ry="7" fill="#1E293B" />
              <rect x="18" y="55" width="12" height="28" rx="4" fill="url(#p2BarGrad1)" stroke="#18181B" strokeWidth="1" />
              <rect x="34" y="43" width="12" height="40" rx="4" fill="url(#p2BarGrad2)" stroke="#18181B" strokeWidth="1" />
              <rect x="50" y="31" width="12" height="52" rx="4" fill="url(#p2BarGrad3)" stroke="#18181B" strokeWidth="1" />
              <rect x="66" y="17" width="12" height="66" rx="4" fill="url(#p2BarGrad4)" stroke="#18181B" strokeWidth="1" />
              <path 
                d="M 20 52 Q 46 36 74 13" 
                stroke="#EF4444" 
                strokeWidth="4" 
                strokeLinecap="round" 
              />
              <path 
                d="M 64 13 L 76 13 L 76 25 Z" 
                fill="#EF4444" 
              />
            </svg>
          </div>
        );
        break;

      case 'calculator':
        label = 'Calculatrice';
        defaultAction = () => setViewMode('calculator-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2CalcBodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
                <linearGradient id="p2CalcScreenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F172A" />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
              </defs>
              <rect x="16" y="8" width="68" height="84" rx="14" fill="url(#p2CalcBodyGrad)" stroke="#18181B" strokeWidth="1.3" />
              <rect x="23" y="15" width="54" height="20" rx="6" fill="url(#p2CalcScreenGrad)" stroke="#0284C7" strokeWidth="1" />
              <text x="72" y="30" fill="#38BDF8" fontFamily="monospace" fontSize="14" fontWeight="900" textAnchor="end">397</text>
              <rect x="23" y="40" width="11.5" height="9" rx="3" fill="#EF4444" />
              <text x="28.75" y="46.5" fill="#FFFFFF" fontSize="5.5" fontWeight="bold" textAnchor="middle">AC</text>
              <rect x="37" y="40" width="11.5" height="9" rx="3" fill="#64748B" />
              <text x="42.75" y="46.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">%</text>
              <rect x="51" y="40" width="11.5" height="9" rx="3" fill="#64748B" />
              <text x="56.75" y="46.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">×</text>
              <rect x="65.5" y="40" width="11.5" height="9" rx="3" fill="#F97316" />
              <text x="71.25" y="46.5" fill="#FFFFFF" fontSize="6.5" fontWeight="bold" textAnchor="middle">÷</text>
              <rect x="23" y="51" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="28.75" y="57.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">7</text>
              <rect x="37" y="51" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="42.75" y="57.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">8</text>
              <rect x="51" y="51" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="56.75" y="57.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">9</text>
              <rect x="65.5" y="51" width="11.5" height="9" rx="3" fill="#F97316" />
              <text x="71.25" y="57.5" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">-</text>
              <rect x="23" y="62" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="28.75" y="68.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">4</text>
              <rect x="37" y="62" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="42.75" y="68.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">5</text>
              <rect x="51" y="62" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="56.75" y="68.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">6</text>
              <rect x="65.5" y="62" width="11.5" height="9" rx="3" fill="#F97316" />
              <text x="71.25" y="68.5" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">+</text>
              <rect x="23" y="73" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="28.75" y="79.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">1</text>
              <rect x="37" y="73" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="42.75" y="79.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">2</text>
              <rect x="51" y="73" width="11.5" height="9" rx="3" fill="#475569" />
              <text x="56.75" y="79.5" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">3</text>
              <rect x="65.5" y="73" width="11.5" height="9" rx="3" fill="#10B981" />
              <text x="71.25" y="79.5" fill="#FFFFFF" fontSize="7.5" fontWeight="bold" textAnchor="middle">=</text>
            </svg>
          </div>
        );
        break;

      case 'storage':
        label = 'Mon stockage';
        defaultAction = () => setViewMode('storage-menu');
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2StorageCloudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
              </defs>
              <path
                d="M 32 44 C 22 44 14 36 14 26 C 14 17 21 9 30 8 C 35 2 48 0 58 6 C 64 2 74 4 78 11 C 86 12 92 20 92 29 C 92 38 84 44 74 44 Z"
                fill="url(#p2StorageCloudGrad)"
                stroke="#18181B"
                strokeWidth="1.3"
              />
              <path d="M 22 48 v 10 c 0 4.5 12.5 8 28 8 s 28 -3.5 28 -8 v -10" fill="#0284C7" stroke="#18181B" strokeWidth="1.2" />
              <ellipse cx="50" cy="48" rx="28" ry="8" fill="#E2E8F0" stroke="#18181B" strokeWidth="1.2" />
              <circle cx="34" cy="58" r="2.2" fill="#22C55E" />
              <circle cx="42" cy="58" r="2.2" fill="#38BDF8" />
              <path d="M 22 62 v 10 c 0 4.5 12.5 8 28 8 s 28 -3.5 28 -8 v -10" fill="#0369A1" stroke="#18181B" strokeWidth="1.2" />
              <ellipse cx="50" cy="62" rx="28" ry="8" fill="#38BDF8" stroke="#18181B" strokeWidth="1.2" />
              <circle cx="34" cy="72" r="2.2" fill="#22C55E" />
              <circle cx="42" cy="72" r="2.2" fill="#F8FAFC" />
              <path d="M 22 76 v 10 c 0 4.5 12.5 8 28 8 s 28 -3.5 28 -8 v -10" fill="#0F172A" stroke="#18181B" strokeWidth="1.2" />
              <ellipse cx="50" cy="76" rx="28" ry="8" fill="#0284C7" stroke="#18181B" strokeWidth="1.2" />
              <circle cx="34" cy="86" r="2.2" fill="#22C55E" />
              <circle cx="42" cy="86" r="2.2" fill="#FACC15" />
            </svg>
          </div>
        );
        break;

      case 'ai-subscriptions':
        label = 'Crédits IA';
        defaultAction = () => {
          setTab('ai-subscriptions');
        };
        iconContent = (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="p2AiCoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="50%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="38" fill="url(#p2AiCoreGrad)" stroke="#18181B" strokeWidth="1.3" />
              <path
                d="M 50 16 L 55 38 L 76 43 L 55 48 L 50 70 L 45 48 L 24 43 L 45 38 Z"
                fill="#FFFFFF"
              />
              <path
                d="M 74 24 L 76 30 L 82 32 L 76 34 L 74 40 L 72 34 L 66 32 L 72 30 Z"
                fill="#FDE047"
              />
              <rect x="28" y="70" width="44" height="16" rx="5" fill="#0F172A" stroke="#FDE047" strokeWidth="1.2" />
              <text x="50" y="82" fill="#FDE047" fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="1">IA PRO</text>
            </svg>
          </div>
        );
        break;

      default:
        return null;
    }

    const isMobileOnlyApp = id === 'storage' || id === 'ai-subscriptions';

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
        className={`${isMobileOnlyApp ? 'flex md:hidden' : 'flex'} group flex-col items-center cursor-pointer w-full max-w-[94px] sm:max-w-[102px] md:w-24 lg:w-26 md:shrink-0 transition-transform duration-200 select-none`}
      >
        <div className="w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 lg:w-26 lg:h-26 flex items-center justify-center transition-all duration-300 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)] group-hover:drop-shadow-[0_14px_28px_rgba(0,0,0,0.28)] group-hover:scale-110 active:scale-95">
          {iconContent}
        </div>
        <span className={`text-[11px] sm:text-xs md:text-sm font-black mt-2 text-center px-0.5 leading-snug tracking-tight w-full line-clamp-2 transition-colors ${
          dashboardWallpaper && viewMode === 'home'
            ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] bg-black/45 px-2 py-0.5 rounded-full border border-white/10'
            : 'text-stone-900 dark:text-stone-100'
        }`}>{label}</span>
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
    <div className={`flex flex-col items-center justify-start min-h-[75vh] px-2 sm:px-4 text-center pt-12 md:pt-14 pb-24 transition-colors duration-200 ${
      dashboardWallpaper && viewMode === 'home'
        ? 'bg-transparent text-white'
        : 'bg-[#E9D7C9] dark:bg-[#0b0f19]'
    }`}>
      {/* Fond d'écran personnalisé du tableau de bord (Visible sur la Page 1 et la Page 2) */}
      {dashboardWallpaper && viewMode === 'home' && (
        <div 
          className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden select-none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform'
          }}
        >
          <img 
            src={dashboardWallpaper} 
            alt="Fond d'écran Tableau de Bord" 
            className="w-full h-full object-cover select-none filter brightness-[0.78] contrast-[1.05]" 
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
              width: '100%',
              height: '100%',
              minWidth: '100vw',
              minHeight: '100vh'
            }}
            onError={async (e) => {
              // Récupération automatique et instantanée sans laisser l'écran grisé
              try {
                const reliable = await getActiveWallpaperReliable();
                if (reliable && reliable !== dashboardWallpaper) {
                  setDashboardWallpaper(reliable);
                  (e.target as HTMLImageElement).src = reliable;
                }
              } catch {}
            }}
          />
          {/* Voile sombre pour lisibilité optimale des icônes d'applications */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/65 backdrop-blur-[0.5px]" />
        </div>
      )}

      {/* Fixed Header bar with action buttons - Transparent sur fond d'écran avec ligne de séparation bien visible */}
      <div className={`fixed top-0 left-0 right-0 md:left-64 z-40 px-3 md:px-6 py-2 h-[64px] md:h-[68px] flex items-center justify-between gap-2 md:gap-4 transition-all duration-300 ${
        dashboardWallpaper && viewMode === 'home'
          ? 'bg-transparent border-b-2 border-white/50 text-white shadow-sm'
          : isDarkMode 
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
            onOpenAddMatiere={() => setIsMatiereMenuOpen(true)}
          />
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
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${
              dashboardWallpaper && viewMode === 'home'
                ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]'
                : (isDarkMode ? 'text-white' : 'text-stone-700')
            }`}>
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
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${
              dashboardWallpaper && viewMode === 'home'
                ? 'text-amber-300 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]'
                : (isDarkMode ? 'text-amber-300' : 'text-stone-700')
            }`}>
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
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${
              dashboardWallpaper && viewMode === 'home'
                ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]'
                : (isDarkMode ? 'text-white' : 'text-stone-700')
            }`}>
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
              isAssistantOpen 
                ? 'text-blue-500' 
                : (dashboardWallpaper && viewMode === 'home'
                    ? 'text-blue-300 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] group-hover:text-blue-200'
                    : (isDarkMode ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-700'))
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
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${
              dashboardWallpaper && viewMode === 'home'
                ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]'
                : (isDarkMode ? 'text-white' : 'text-stone-700')
            }`}>
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
            <span className={`text-[10px] font-extrabold leading-none mt-1 ${
              dashboardWallpaper && viewMode === 'home'
                ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]'
                : (isDarkMode ? 'text-white' : 'text-stone-700')
            }`}>
              Matière
            </span>
          </div>

        </div>
      </div>

      {/* Delmas IA Overlay Modal - Isolé hors du header avec createPortal vers document.body (ne subit aucune déformation ni creux) */}
      {isAssistantOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[200000] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 sm:pr-6 pointer-events-none"
        >
          <div 
            className="pointer-events-auto w-full sm:w-[420px] md:w-[480px] h-[85vh] sm:h-[82vh] sm:max-h-[820px] bg-[#16181d]/96 backdrop-blur-xl sm:rounded-3xl rounded-t-3xl border border-zinc-700/70 shadow-2xl flex flex-col overflow-hidden relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <DelmasChat 
              onClose={() => setIsAssistantOpen(false)} 
            />
          </div>
        </div>,
        document.body
      )}

      {isMatiereMenuOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
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
                  const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || '';
                  const createdWithIds = matieresList.map((m, idx) => ({
                    id: 'mat-' + Date.now() + '-' + idx,
                    name: m.name.trim(),
                    coefficient: m.coefficient.trim() || '1',
                    color: '#EA580C',
                  }));

                  // Synchroniser chaque matière avec Cloudflare D1
                  if (userId && userId !== 'default-user') {
                    createdWithIds.forEach((m) => {
                      StudyCloudAPI.createMatiere({
                        id: m.id,
                        userId,
                        name: m.name,
                        coefficient: parseFloat(m.coefficient) || 1.0,
                        color: m.color,
                      }).catch((err) => console.warn('Erreur création matière D1:', err));
                    });
                  }

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
        </div>,
        document.body
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
                    const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || '';
                    const targetMat = savedMatieres[editingMatiere.index];
                    const matId = targetMat?.id || ('mat-' + Date.now());
                    
                    if (userId && userId !== 'default-user') {
                      StudyCloudAPI.createMatiere({
                        id: matId,
                        userId,
                        name: editingMatiere.name.trim(),
                        coefficient: parseFloat(editingMatiere.coefficient) || 1.0,
                        color: targetMat?.color || '#EA580C',
                      }).catch((err) => console.warn('Erreur modification matière D1:', err));
                    }

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
        <FilesMenuView 
          key={viewMode}
          initialMatiere={viewMode.replace('matiere-', '')} 
          onBack={() => setViewMode('home')} 
          setActivePreviewItem={setActivePreviewItem} 
          onOpenCreateShareLink={onOpenCreateShareLink}
          onImportFile={onOpenUpload}
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
        />
      )}
      {viewMode === 'schedule-menu' && <ScheduleMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'notes-menu' && <NotesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'grades-menu' && <GradesMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'calendar-menu' && <CalendarMenuView onBack={() => setViewMode('home')} />}
      {viewMode === 'favorites-menu' && <HomeFavoritesMenuView onBack={() => setViewMode('home')} setActivePreviewItem={setActivePreviewItem} />}
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
        <Page1FilesMenuView 
          onBack={() => {
            setActivePageIndex(0);
            setViewMode('home');
          }} 
          onOpenStudySpace={onOpenStudySpace} 
          onOpenCreateShareLink={onOpenCreateShareLink}
        />
      )}

      {viewMode === 'home' && (
        <div className="w-full max-w-[1400px] mx-auto px-1 sm:px-4 py-2 relative z-10">
          {/* Titre de l'écran actif */}
          <div className="flex items-center justify-between mb-3 px-2">
            <span className={`text-xs font-black select-none ${
              dashboardWallpaper 
                ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/45 px-3 py-1 rounded-full border border-white/10' 
                : 'text-stone-500 dark:text-stone-400'
            }`}>
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
                      setActivePageIndex(0);
                      setViewMode('page1-files-menu');
                    }}
                    className="group flex flex-col items-center cursor-pointer select-none transition-transform duration-150 hover:scale-105 active:scale-[0.98]"
                  >
                    {/* Dossier 3D Espace Cloud avec Nuage Orange au milieu */}
                    <div className="w-24 h-21 sm:w-28 sm:h-24 md:w-32 md:h-28 transition-all duration-300 filter drop-shadow-[0_8px_18px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_12px_26px_rgba(0,0,0,0.5)] group-hover:drop-shadow-[0_16px_30px_rgba(249,115,22,0.35)] group-hover:scale-108 active:scale-95">
                      <svg className="w-full h-full" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          {/* Dégradé Onglet arrière */}
                          <linearGradient id="p1FolderBackGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#0284C7" />
                          </linearGradient>

                          {/* Dégradé Bleu doux pour la face avant du dossier */}
                          <linearGradient id="p1FolderFrontGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#BAE6FD" />
                            <stop offset="45%" stopColor="#60A5FA" />
                            <stop offset="100%" stopColor="#0284C7" />
                          </linearGradient>

                          {/* Dégradé Orange Vibrant 3D pour le nuage central */}
                          <linearGradient id="p1OrangeCloudGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FED7AA" />
                            <stop offset="25%" stopColor="#FB923C" />
                            <stop offset="70%" stopColor="#EA580C" />
                            <stop offset="100%" stopColor="#C2410C" />
                          </linearGradient>

                          {/* Papier intérieur avec bordure bleutée */}
                          <linearGradient id="p1DocPaperGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FFFFFF" />
                            <stop offset="100%" stopColor="#F0F9FF" />
                          </linearGradient>

                          {/* Ombre portée douce sous le nuage orange */}
                          <filter id="p1CloudShadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.25" />
                          </filter>
                        </defs>

                        {/* Dos du dossier avec onglet arrière */}
                        <path 
                          d="M 14 18 C 14 14 17 12 21 12 L 42 12 C 45 12 48 15 50 18 L 54 22 L 86 22 C 90 22 93 25 93 29 L 93 42 L 14 42 Z" 
                          fill="url(#p1FolderBackGrad)" 
                          stroke="#18181B" 
                          strokeWidth="1.3" 
                          strokeLinejoin="round" 
                        />

                        {/* Feuilles de documents blanches qui dépassent à l'intérieur */}
                        <rect x="22" y="16" width="56" height="30" rx="3.5" fill="url(#p1DocPaperGrad)" stroke="#BAE6FD" strokeWidth="1" />
                        <line x1="30" y1="22" x2="68" y2="22" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="30" y1="27" x2="54" y2="27" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />

                        {/* Corps principal avant du dossier en bleu élégant avec contour fin */}
                        <path 
                          d="
                            M 14 26
                            L 44 26
                            C 48 26 50 28 52 31
                            C 54 34 56 36 60 36
                            L 86 36
                            C 91 36 94 39 94 44
                            L 94 77
                            C 94 82 91 85 86 85
                            L 14 85
                            C 9 85 6 82 6 77
                            L 6 32
                            C 6 28 9 26 14 26
                            Z
                          " 
                          fill="url(#p1FolderFrontGrad)" 
                          stroke="#18181B" 
                          strokeWidth="1.3" 
                          strokeLinejoin="round" 
                          strokeLinecap="round" 
                        />

                        {/* Liseré fin bleu clair sur le pli supérieur du rabat */}
                        <path
                          d="M 14 28 L 43 28 C 47 28 49 30 51 33 C 53 36 55 38 59 38 L 86 38"
                          stroke="#E0F2FE"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />

                        {/* ========================================================= */}
                        {/* NUAGE ORANGE 3D AU MILIEU DU DOSSIER                      */}
                        {/* ========================================================= */}
                        <g filter="url(#p1CloudShadow)">
                          {/* Forme du Nuage Orange Bombé 3D */}
                          <path
                            d="
                              M 38 67
                              C 30 67 24 61.5 24 55
                              C 24 49 28.5 44.5 34.5 44
                              C 37 36.5 44 34 51 37
                              C 55.5 33.5 62.5 35 66 39.5
                              C 72 40.5 76 45.5 76 52
                              C 76 59.5 71 67 62 67
                              Z
                            "
                            fill="url(#p1OrangeCloudGrad)"
                            stroke="#7C2D12"
                            strokeWidth="1.3"
                            strokeLinejoin="round"
                          />

                          {/* Ligne de reflet brillant blanc-doré sur le dôme supérieur du nuage */}
                          <path
                            d="M 40 43 C 43.5 38 48 37 53 38"
                            stroke="#FEF08A"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 58 37.5 C 61 37 64 38.5 66 41"
                            stroke="#FEF08A"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                          />

                          {/* Petite étincelle / étoile dorée scintillante à côté du nuage */}
                          <path
                            d="M 74 38 L 75.5 42 L 79.5 43.5 L 75.5 45 L 74 49 L 72.5 45 L 68.5 43.5 L 72.5 42 Z"
                            fill="#FDE047"
                            stroke="#B45309"
                            strokeWidth="0.6"
                          />
                        </g>
                      </svg>
                    </div>

                    <span className={`text-xs sm:text-sm font-black mt-2 text-center tracking-tight transition-colors ${
                      dashboardWallpaper 
                        ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/50 px-2.5 py-0.5 rounded-full border border-white/10' 
                        : 'text-stone-900 dark:text-stone-100'
                    }`}>
                      Espace Cloud
                    </span>
                  </div>
                </div>
              </div>

              {/* PAGE 1 : Écran d'accueil principal à droite */}
              <div className="w-1/2 shrink-0 px-1 sm:px-4">
                {/* Sur mobile : 3 blocs par ligne (inclut Mon stockage et Abonnements IA) | Sur desktop : 9 colonnes centrées avec accès stockage et IA sur la barre latérale gauche */}
                <div className="grid grid-cols-3 md:grid-cols-9 gap-y-6 gap-x-2 sm:gap-x-4 md:gap-4 lg:gap-6 justify-items-center w-fit max-w-full mx-auto md:overflow-x-auto md:pb-4 md:pt-1 md:no-scrollbar">
                  {['files', 'favorites', 'schedule', 'notes', 'grades', 'level', 'calendar', 'clock', 'calculator', 'storage', 'ai-subscriptions'].map((id, index) => renderBlock(id, index))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination dots (Pointillés de navigation des pages) - Presque collé à la limite en bas de l'écran et au milieu */}
      {viewMode === 'home' && (
        <div 
          className={`fixed bottom-16 md:bottom-2.5 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-[calc(50%+8rem)] md:-translate-x-1/2 z-30 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full ${
            dashboardWallpaper 
              ? 'bg-black/60 border-white/20 shadow-xl' 
              : 'bg-stone-900/10 dark:bg-black/50 border-stone-800/15 dark:border-white/10'
          } backdrop-blur-md border shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all select-none`}
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

