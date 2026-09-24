import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  X, 
  MoreVertical, 
  Download, 
  Image as ImageIcon, 
  Film, 
  Music, 
  FileText, 
  LayoutGrid, 
  Star, 
  Lock, 
  Trash2, 
  Cloud, 
  Check, 
  ExternalLink, 
  Share2, 
  ChevronRight, 
  ChevronLeft,
  Eye, 
  Info, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Menu,
  ShieldCheck,
  FolderCheck,
  Plus,
  FolderArchive,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Volume1,
  Clock,
  Sparkles,
  FileCode,
  Archive,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Repeat,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  BookOpen,
  Link,
  FolderInput,
  Copy,
  Pin,
  Pencil,
  Heart,
  ListPlus,
  Timer,
  Shuffle,
  AlignLeft,
  CheckSquare,
  Square,
  UserCheck
} from 'lucide-react';
import { getDownloadedFiles, recordDownloadedFile, DownloadedItem } from '../services/downloadsManager';
import { 
  DEFAULT_IMAGES_LIST, 
  DEFAULT_VIDEOS_LIST, 
  DEFAULT_AUDIO_LIST, 
  DEFAULT_DOCUMENTS_LIST 
} from '../data/categoryFilesData';

interface Page1FilesMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[], isFullscreen?: boolean) => void;
}

export interface FileItem {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps';
  source: string;
  size: string;
  sizeBytes: number;
  date: string;
  previewUrl?: string;
  isImage?: boolean;
  videoUrl?: string;
  audioUrl?: string;
  documentCategory?: 'COURS' | 'TD' | 'DEVOIRS' | "PAS D'INF...";
  extension?: string;
  downloadsCount?: number;
  isFavorite?: boolean;
  isSecure?: boolean;
  isPinned?: boolean;
  artist?: string;
  lyricsSnippet?: string;
  fullLyrics?: string[];
  durationSec?: number;
}

interface SubMenuView {
  id: string;
  type: 'category' | 'collection' | 'classeur';
  name: string;
  icon: any;
  color: string;
}

export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack, onOpenStudySpace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [docMenuOpenId, setDocMenuOpenId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // =========================================================================
  // ÉTAT DE LA DIVISION EN DEUX (SPLIT SCREEN) & LECTEUR GRAND FORMAT
  // =========================================================================
  const [splitSelectedFile, setSplitSelectedFile] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);

  // Lecteur Audio
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(11);
  const [audioDuration, setAudioDuration] = useState(219);
  const [audioVolume, setAudioVolume] = useState(0.85);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isAudioShuffle, setIsAudioShuffle] = useState(false);
  const [isAudioRepeat, setIsAudioRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [isAudioLiked, setIsAudioLiked] = useState(false);
  const [isEqualizerOn, setIsEqualizerOn] = useState(true);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [audioMenuSongId, setAudioMenuSongId] = useState<string | null>(null);
  const [isPlayerMenuOpen, setIsPlayerMenuOpen] = useState(false);
  // État du menu 3 traits supérieur (Tri et bouton œil)
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [sortOption, setSortOption] = useState<'recent' | 'oldest' | 'pinned'>('recent');
  const [isEyeViewActive, setIsEyeViewActive] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  // Aliases de compatibilité pour la sélection audio existante
  const isAudioSelectionMode = isSelectionMode;
  const setIsAudioSelectionMode = setIsSelectionMode;
  const selectedAudioIds = selectedItemIds;
  const setSelectedAudioIds = setSelectedItemIds;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lecteur Vidéo
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(90);
  const [videoVolume, setVideoVolume] = useState(0.9);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Lecteur Document (Pages & Mode d'affichage Vertical/Horizontal)
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const totalDocPages = 4;
  const [docLayoutMode, setDocLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');

  // Gestion du glissement tactile (main/doigt) et souris pour le mode horizontal du document
  const [docDragOffset, setDocDragOffset] = useState<number>(0);
  const [isDocDragging, setIsDocDragging] = useState<boolean>(false);
  const docDragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const docIsHorizontalDragRef = useRef<boolean>(false);
  const docHasMovedRef = useRef<boolean>(false);
  const lastDocWheelTimeRef = useRef<number>(0);

  // Glissement tactile (Écran tactile / Mobile / Tablette)
  const handleDocTouchStart = (e: React.TouchEvent) => {
    if (docLayoutMode !== 'horizontal') return;
    const touch = e.touches[0];
    docDragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    docIsHorizontalDragRef.current = false;
    docHasMovedRef.current = false;
  };

  const handleDocTouchMove = (e: React.TouchEvent) => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - docDragStartRef.current.x;
    const deltaY = touch.clientY - docDragStartRef.current.y;

    if (!docIsHorizontalDragRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        docDragStartRef.current = null;
        return;
      }
      if (Math.abs(deltaX) > 8) {
        docIsHorizontalDragRef.current = true;
        setIsDocDragging(true);
        docHasMovedRef.current = true;
      }
    }

    if (docIsHorizontalDragRef.current) {
      let adjustedDelta = deltaX;
      if (docCurrentPage === 1 && deltaX > 0) {
        adjustedDelta = deltaX * 0.25;
      } else if (docCurrentPage === totalDocPages && deltaX < 0) {
        adjustedDelta = deltaX * 0.25;
      }
      setDocDragOffset(adjustedDelta);
    }
  };

  const handleDocTouchEnd = () => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const deltaX = docDragOffset;
    const threshold = 40;

    if (deltaX < -threshold && docCurrentPage < totalDocPages) {
      setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
    } else if (deltaX > threshold && docCurrentPage > 1) {
      setDocCurrentPage(prev => Math.max(1, prev - 1));
    }

    setDocDragOffset(0);
    setIsDocDragging(false);
    docDragStartRef.current = null;
    docIsHorizontalDragRef.current = false;
  };

  // Glissement à la souris (Clic gauche maintenu et glissement gauche/droite)
  const handleDocMouseDown = (e: React.MouseEvent) => {
    if (docLayoutMode !== 'horizontal' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    docDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
    docIsHorizontalDragRef.current = false;
    docHasMovedRef.current = false;
  };

  const handleDocMouseMove = (e: React.MouseEvent) => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const deltaX = e.clientX - docDragStartRef.current.x;
    const deltaY = e.clientY - docDragStartRef.current.y;

    if (!docIsHorizontalDragRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        docDragStartRef.current = null;
        return;
      }
      if (Math.abs(deltaX) > 5) {
        docIsHorizontalDragRef.current = true;
        setIsDocDragging(true);
        docHasMovedRef.current = true;
      }
    }

    if (docIsHorizontalDragRef.current) {
      let adjustedDelta = deltaX;
      if (docCurrentPage === 1 && deltaX > 0) {
        adjustedDelta = deltaX * 0.25;
      } else if (docCurrentPage === totalDocPages && deltaX < 0) {
        adjustedDelta = deltaX * 0.25;
      }
      setDocDragOffset(adjustedDelta);
    }
  };

  const handleDocMouseUp = () => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const deltaX = docDragOffset;
    const threshold = 40;

    if (deltaX < -threshold && docCurrentPage < totalDocPages) {
      setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
    } else if (deltaX > threshold && docCurrentPage > 1) {
      setDocCurrentPage(prev => Math.max(1, prev - 1));
    }

    setDocDragOffset(0);
    setIsDocDragging(false);
    docDragStartRef.current = null;
    docIsHorizontalDragRef.current = false;
  };

  // Support navigation par molette ou défilement horizontal trackpad
  const handleDocWheel = (e: React.WheelEvent) => {
    if (docLayoutMode !== 'horizontal') return;
    const now = Date.now();
    if (now - lastDocWheelTimeRef.current < 450) return;

    if (Math.abs(e.deltaX) > 28 || (e.shiftKey && Math.abs(e.deltaY) > 28)) {
      const delta = Math.abs(e.deltaX) > 28 ? e.deltaX : e.deltaY;
      if (delta > 0 && docCurrentPage < totalDocPages) {
        lastDocWheelTimeRef.current = now;
        setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
      } else if (delta < 0 && docCurrentPage > 1) {
        lastDocWheelTimeRef.current = now;
        setDocCurrentPage(prev => Math.max(1, prev - 1));
      }
    }
  };

  // Navigation clavier pour le mode horizontal (Flèches gauche / droite)
  useEffect(() => {
    if (docLayoutMode !== 'horizontal' || splitSelectedFile?.category !== 'documents') return;
    const handleDocKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setDocCurrentPage(prev => Math.max(1, prev - 1));
      }
    };
    window.addEventListener('keydown', handleDocKeyDown);
    return () => window.removeEventListener('keydown', handleDocKeyDown);
  }, [docLayoutMode, splitSelectedFile]);

  // Téléchargements réels synchronisés
  const [downloadedItems, setDownloadedItems] = useState<DownloadedItem[]>(() => getDownloadedFiles());

  useEffect(() => {
    const handleUpdate = () => {
      setDownloadedItems(getDownloadedFiles());
    };
    window.addEventListener('studycloud_download_updated', handleUpdate);
    return () => window.removeEventListener('studycloud_download_updated', handleUpdate);
  }, []);

  // Écoute de la touche Échap pour réduire le mode plein écran / agrandi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewerMaximized) {
        setIsViewerMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerMaximized]);

  // Réinitialiser le plein écran et agrandi dès que l'espace d'étude s'ouvre pour éviter toute bande noire
  useEffect(() => {
    const handleStudySpaceOpened = () => {
      setIsFullscreen(false);
      setIsViewerMaximized(false);
    };
    window.addEventListener('studycloud_open_study_space', handleStudySpaceOpened);
    return () => window.removeEventListener('studycloud_open_study_space', handleStudySpaceOpened);
  }, []);

  // Fermer les menus déroulants lors d'un clic extérieur ou touche Échap SANS jamais bloquer le défilement de la page
  useEffect(() => {
    if (!activeMenuFileId && !docMenuOpenId && !audioMenuSongId && !menuOpenId && !isPlayerMenuOpen && !isHeaderMenuOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.studycloud-file-menu-panel') || target.closest('.studycloud-menu-trigger')) {
        return;
      }
      setActiveMenuFileId(null);
      setDocMenuOpenId(null);
      setAudioMenuSongId(null);
      setMenuOpenId(null);
      setIsPlayerMenuOpen(false);
      setIsHeaderMenuOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuFileId(null);
        setDocMenuOpenId(null);
        setAudioMenuSongId(null);
        setMenuOpenId(null);
        setIsPlayerMenuOpen(false);
        setIsHeaderMenuOpen(false);
      }
    };

    // Timeout de 10ms pour ne pas capturer le clic d'ouverture du menu lui-même
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuFileId, docMenuOpenId, audioMenuSongId, menuOpenId, isPlayerMenuOpen, isHeaderMenuOpen]);

  // Référence pour l'import de fichier
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sous-page ouverte
  const [currentSubView, setCurrentSubView] = useState<SubMenuView | null>(null);

  const showToast = (_msg?: string) => {
    // Désactivé : aucun message lors des clics sur les boutons
  };

  // =========================================================================
  // DONNÉES RICHES CONFORMENT EXACTEMENT AUX IMAGES FOURNIES PAR L'UTILISATEUR
  // =========================================================================

  // IMAGE 1 : DOCUMENTS (PDF, WORD,...) CODES COULEURS EN FONCTION DU FORMAT
  const [documentsList, setDocumentsList] = useState<FileItem[]>([
    {
      id: 'doc-1',
      name: 'CHI_AOP_LINEAIRE_MONT_BASE (1) (1).pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '647.5 Ko',
      sizeBytes: 663040,
      date: "Aujourd'hui, 11:20",
      extension: 'PDF',
      downloadsCount: 0
    },
    {
      id: 'doc-2',
      name: 'CHI_AOP_LINEAIRE_MONT_BASE (1).pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '642.5 Ko',
      sizeBytes: 657920,
      date: "Aujourd'hui, 10:45",
      extension: 'PDF',
      downloadsCount: 0
    },
    {
      id: 'doc-3',
      name: 'TD_PREPA_ANA_2MIT.pdf',
      category: 'documents',
      documentCategory: "PAS D'INF...",
      source: 'StudyCloud',
      size: '512.0 Ko',
      sizeBytes: 524288,
      date: 'Hier, 15:30',
      extension: 'PDF',
      downloadsCount: 0
    },
    {
      id: 'doc-4',
      name: 'CHI_AOP_LINEAIRE_APPLICATIONS.pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '720.0 Ko',
      sizeBytes: 737280,
      date: 'Hier, 14:15',
      extension: 'PDF',
      downloadsCount: 3
    },
    {
      id: 'doc-5',
      name: 'Synthese_Cours_Semestre_1.docx',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '1.1 Mo',
      sizeBytes: 1153433,
      date: "Aujourd'hui, 09:30",
      extension: 'DOCX',
      downloadsCount: 5
    },
    {
      id: 'doc-6',
      name: 'Devoir_Economie_Appliquee.pdf',
      category: 'documents',
      documentCategory: 'DEVOIRS',
      source: 'StudyCloud',
      size: '2.8 Mo',
      sizeBytes: 2936012,
      date: 'Hier, 18:20',
      extension: 'PDF',
      downloadsCount: 2
    },
    {
      id: 'doc-7',
      name: 'TD_Mathematiques_Algebre.pdf',
      category: 'documents',
      documentCategory: 'TD',
      source: 'StudyCloud',
      size: '1.7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20',
      extension: 'PDF',
      downloadsCount: 7
    },
    {
      id: 'doc-8',
      name: 'Tableau_Budget_Gestion_Projet.xlsx',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '890.0 Ko',
      sizeBytes: 911360,
      date: '19 Sept, 16:00',
      extension: 'XLSX',
      downloadsCount: 4
    },
    {
      id: 'doc-9',
      name: 'Cours_Supply_Chain_Logistique.pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '4.2 Mo',
      sizeBytes: 4404019,
      date: "Aujourd'hui, 10:15",
      extension: 'PDF',
      downloadsCount: 2
    },
    {
      id: 'doc-10',
      name: 'Notes_Revision_Semestre_1.pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '950 Ko',
      sizeBytes: 972800,
      date: '21 Sept, 14:00',
      extension: 'PDF',
      downloadsCount: 1
    },
    {
      id: 'doc-11',
      name: 'Fiche_TD_Mathematiques.pdf',
      category: 'documents',
      documentCategory: 'TD',
      source: 'StudyCloud',
      size: '1.7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20',
      extension: 'PDF',
      downloadsCount: 3
    }
  ]);

  // IMAGE 2 : IMAGES (GRILLE 3 COLONNES AVEC TAILLES EXACTES EN HAUT À DROITE)
  const [imagesList, setImagesList] = useState<FileItem[]>([
    {
      id: 'img-1',
      name: 'Capture_ecran_Dashboard.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,18 Mo',
      sizeBytes: 2285895,
      date: '21 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-2',
      name: 'Architecture_Cloud_Diagramme.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,00 Mo',
      sizeBytes: 2097152,
      date: '21 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-3',
      name: 'Schema_Reseau_Entreprise.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,61 Mo',
      sizeBytes: 2736783,
      date: '20 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-4',
      name: 'Citation_Bague_Promesse.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '292 ko',
      sizeBytes: 299008,
      date: '19 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-5',
      name: 'Interface_StudyCloud_Dark.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,55 Mo',
      sizeBytes: 2673868,
      date: '18 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-6',
      name: 'Fond_Ecran_Paysage_Nature.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,90 Mo',
      sizeBytes: 3040870,
      date: '18 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-7',
      name: 'IMG-20260923-WA0012.jpg',
      category: 'images',
      source: 'WhatsApp Images',
      size: '503 ko',
      sizeBytes: 515072,
      date: '17 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-8',
      name: 'Dossier_Roblox_Projet.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,33 Mo',
      sizeBytes: 2443182,
      date: '16 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-9',
      name: 'Menu_Applications_Grille.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '521 ko',
      sizeBytes: 533504,
      date: '15 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-10',
      name: 'Dossier_Supply_Chain_Jaune.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '41,33 ko',
      sizeBytes: 42321,
      date: '15 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=85'
    },
    {
      id: 'img-11',
      name: 'Dashboard_Navigation_Home.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,56 Mo',
      sizeBytes: 2684354,
      date: '14 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85'
    }
  ]);

  // IMAGE 3 : VIDÉOS (GRILLE 3 COLONNES AVEC BOUTON PLAY BLANC AU CENTRE ET TAILLES EXACTES)
  const [videosList, setVideosList] = useState<FileItem[]>([
    {
      id: 'vid-1',
      name: 'Labyrinthe_Psychologie_Societe.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '2,79 Mo',
      sizeBytes: 2925527,
      date: '21 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    {
      id: 'vid-2',
      name: 'Animation_Monde_Imaginaire.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '5,28 Mo',
      sizeBytes: 5536481,
      date: '21 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
    },
    {
      id: 'vid-3',
      name: 'Tutoriel_Debuter_En_Code.mp4',
      category: 'videos',
      source: 'YouTube',
      size: '39,07 Mo',
      sizeBytes: 40967864,
      date: '20 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
      id: 'vid-4',
      name: 'Rick_And_Morty_Extrait.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '3,22 Mo',
      sizeBytes: 3376414,
      date: '20 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    {
      id: 'vid-5',
      name: 'Arrete_De_Payer_Des_Tokens.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '7,34 Mo',
      sizeBytes: 7696547,
      date: '19 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
    },
    {
      id: 'vid-6',
      name: 'Gala_Costume_Ceremonie.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '3,45 Mo',
      sizeBytes: 3617587,
      date: '19 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4'
    },
    {
      id: 'vid-7',
      name: 'Robot_Humanoide_Laboratoire.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '6,72 Mo',
      sizeBytes: 7046430,
      date: '18 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4'
    },
    {
      id: 'vid-8',
      name: 'Inde_Voyage_Reportage.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,35 Mo',
      sizeBytes: 1415577,
      date: '18 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
    },
    {
      id: 'vid-9',
      name: 'Promenade_Foret_Nuit.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,42 Mo',
      sizeBytes: 1488977,
      date: '17 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4'
    },
    {
      id: 'vid-10',
      name: 'Orang_Outan_Tronc_Arbre.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '2,14 Mo',
      sizeBytes: 2243952,
      date: '17 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    },
    {
      id: 'vid-11',
      name: 'Concert_Violoncelle_Orchestre.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '6,95 Mo',
      sizeBytes: 7287603,
      date: '16 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
    },
    {
      id: 'vid-12',
      name: 'Parade_Militaire_Foule.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '11,01 Mo',
      sizeBytes: 11544821,
      date: '16 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4'
    },
    {
      id: 'vid-13',
      name: 'Bebe_Sourire_Famille.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,55 Mo',
      sizeBytes: 1625292,
      date: '15 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    {
      id: 'vid-14',
      name: 'Chorale_Enfants_Chant.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '4,16 Mo',
      sizeBytes: 4362076,
      date: '15 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
    },
    {
      id: 'vid-15',
      name: 'Diogo_Almeida_Interview_AI.mp4',
      category: 'videos',
      source: 'YouTube',
      size: '20,91 Mo',
      sizeBytes: 21925724,
      date: '14 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    }
  ]);

  // IMAGE 3 & IMAGE 2 : AUDIO / MUSIQUE (LISTE IMAGE 3 AVEC VIGNETTES, ARTISTES, DATES ET LECTEUR IMAGE 2)
  const [audioList, setAudioList] = useState<FileItem[]>([
    {
      id: 'aud-img3-1',
      name: 'Another Love X Memories (Lyrics)',
      artist: '<unknown> - Another Love X Memories...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,12 Mo',
      sizeBytes: 4320140,
      date: '09-16',
      durationSec: 225,
      previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      lyricsSnippet: "I wanna take you somewhere so you know I care / But it's so cold and I don't know where to go...",
      fullLyrics: [
        "I wanna take you somewhere so you know I care",
        "But it's so cold and I don't know where to go",
        "I brought you daffodils in a pretty string",
        "But they won't flower like they did last spring",
        "And all my tears have been used up",
        "On another love, another love"
      ]
    },
    {
      id: 'aud-img3-2',
      name: 'Raindance (Lyrics)',
      artist: 'Dave & Tems - Dave & Tems',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '5,80 Mo',
      sizeBytes: 6081740,
      date: '09-16',
      durationSec: 219,
      previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      lyricsSnippet: "And really when I think of it / Growing up, I didn't ever see marriages / No weddings, no horse, no carriages / I wanna do things different...",
      fullLyrics: [
        "And really when I think of it",
        "Growing up, I didn't ever see marriages",
        "No weddings, no horse, no carriages",
        "I wanna do things different and right",
        "Pray for me through the day and the night",
        "When the rain falls on our souls",
        "We will dance and we will heal..."
      ]
    },
    {
      id: 'aud-img3-3',
      name: 'Davy One (Paroles)',
      artist: "T'es Une Étoile - T'es Une Étoile",
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '3,84 Mo',
      sizeBytes: 4026531,
      date: '09-16',
      durationSec: 192,
      previewUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      lyricsSnippet: "Prends soin de vous, prends soin de toi... T'es une étoile qui brille dans le noir...",
      fullLyrics: [
        "Prends soin de vous, prends soin de toi",
        "T'es une étoile qui brille dans la nuit",
        "Ne laisse personne éteindre ta flamme",
        "Garde la foi, même sous la pluie"
      ]
    },
    {
      id: 'aud-img3-4',
      name: "On s'fait du mal (Clip officiel)",
      artist: 'Black M - Black M',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,56 Mo',
      sizeBytes: 4781506,
      date: '09-16',
      durationSec: 214,
      previewUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      lyricsSnippet: "On s'fait du mal, pourquoi on se déchire encore quand on s'aime au fond...",
      fullLyrics: [
        "On s'fait du mal, pourquoi on se déchire",
        "Quand on s'aime au fond de nos cœurs",
        "Les regrets ne font que grandir",
        "Mais on cherche encore le bonheur"
      ]
    },
    {
      id: 'aud-img3-5',
      name: 'RUN (Paroles/Lyrics)',
      artist: "Rim'K x SDM - Rim'K x SDM",
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '3,45 Mo',
      sizeBytes: 3617587,
      date: '08-26',
      durationSec: 178,
      previewUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      lyricsSnippet: "Moi qui t'ai tant donné derrière le rideau... J'ai pas changé pour les tales...",
      fullLyrics: [
        "Moi qui t'ai tant donné derrière le rideau",
        "J'laisse des gens derrière, j'ai juste peur de m'égarer",
        "J'ai pas changé pour les tales, j'fais des tales étape par étape",
        "Mais l'État veut me voir éteindre, j'fais des tales..."
      ]
    },
    {
      id: 'aud-img3-6',
      name: "Je M'Excuse (Lyrics Video Official)",
      artist: "Blam'S - Blam'S",
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,10 Mo',
      sizeBytes: 4299161,
      date: '08-24',
      durationSec: 200,
      previewUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      lyricsSnippet: "Car non jamais je ne te laisserai tomber, pardonne mes erreurs...",
      fullLyrics: [
        "Car non jamais je ne te laisserai tomber",
        "Pardonne mes erreurs et mes silences",
        "Si j'ai fait mal à tes pensées",
        "Je demande juste une nouvelle chance"
      ]
    }
  ]);

  // FICHIERS RÉCENTS : STUDYCLOUD (Strictement 6 éléments maximum, 1 seule ligne, FIFO)
  const DEFAULT_RECENT_FILES: FileItem[] = [
    {
      id: 'rec-cld-1',
      name: 'Cours_Supply_Chain_Logistique.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '4,2 Mo',
      sizeBytes: 4404019,
      date: "Aujourd'hui, 10:15"
    },
    {
      id: 'rec-cld-2',
      name: 'Synthese_Cours_Semestre_1.docx',
      category: 'documents',
      source: 'StudyCloud',
      size: '1,1 Mo',
      sizeBytes: 1153433,
      date: "Aujourd'hui, 09:30"
    },
    {
      id: 'rec-cld-3',
      name: 'Devoir_Economie_Appliquee.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '2,8 Mo',
      sizeBytes: 2936012,
      date: 'Hier, 18:20'
    },
    {
      id: 'rec-cld-4',
      name: 'Projet_Algorithmique_V2.zip',
      category: 'downloads',
      source: 'StudyCloud',
      size: '6,4 Mo',
      sizeBytes: 6710886,
      date: 'Hier, 16:45'
    },
    {
      id: 'rec-cld-5',
      name: 'Notes_Revision_Semestre_1.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '950 Ko',
      sizeBytes: 972800,
      date: '21 Sept, 14:00'
    },
    {
      id: 'rec-cld-6',
      name: 'Fiche_TD_Mathematiques.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '1,7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20'
    }
  ];

  // État des fichiers récents avec persistance locale
  const [cloudRecentFiles, setCloudRecentFiles] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_recent_files');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return DEFAULT_RECENT_FILES;
  });

  // Synchronisation de la liste des récents dans le stockage local
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_recent_files', JSON.stringify(cloudRecentFiles));
    } catch {
      // ignore
    }
  }, [cloudRecentFiles]);

  // Retirer un élément de la liste des récents sans supprimer le fichier
  const handleRemoveRecentFile = (fileId: string) => {
    setCloudRecentFiles(prev => prev.filter(f => f.id !== fileId));
    showToast("Élément retiré des récents");
  };

  // Déclencher le sélecteur de fichier
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  // Traiter les fichiers importés
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: FileItem[] = Array.from(files).map((file, idx) => {
      const isImg = file.type.startsWith('image/');
      let category: FileItem['category'] = 'documents';
      if (isImg) category = 'images';
      else if (file.type.startsWith('audio/')) category = 'audio';
      else if (file.type.startsWith('video/')) category = 'videos';

      const blobUrl = URL.createObjectURL(file);

      return {
        id: `rec-imp-${Date.now()}-${idx}`,
        name: file.name,
        category,
        source: 'StudyCloud',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} Mo`,
        sizeBytes: file.size,
        date: "Aujourd'hui, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        previewUrl: isImg ? blobUrl : undefined,
        videoUrl: file.type.startsWith('video/') ? blobUrl : undefined,
        audioUrl: file.type.startsWith('audio/') ? blobUrl : undefined,
        isImage: isImg
      };
    });

    setCloudRecentFiles(prev => [...newItems, ...prev].slice(0, 6));
    newItems.forEach(item => {
      if (item.category === 'images') setImagesList(prev => [item, ...prev]);
      else if (item.category === 'videos') setVideosList(prev => [item, ...prev]);
      else if (item.category === 'audio') setAudioList(prev => [item, ...prev]);
      else setDocumentsList(prev => [item, ...prev]);
    });
    showToast(`${files.length} fichier(s) importé(s) dans StudyCloud !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // DOSSIER SÉCURISÉ (Fichiers protégés par coffre-fort et isolés)
  const [secureFolderFiles, setSecureFolderFiles] = useState<FileItem[]>([
    {
      id: 'sec-doc-1',
      name: 'Diplome_Baccalaureat_Authentifie.pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'Dossier Sécurisé',
      size: '1.4 Mo',
      sizeBytes: 1468006,
      date: 'Hier, 16:30',
      extension: 'PDF',
      isSecure: true
    },
    {
      id: 'sec-doc-2',
      name: 'Releve_Notes_Semestre_Confidentiel.pdf',
      category: 'documents',
      documentCategory: 'DEVOIRS',
      source: 'Dossier Sécurisé',
      size: '890 Ko',
      sizeBytes: 911360,
      date: '18 Sept',
      extension: 'PDF',
      isSecure: true
    }
  ]);

  // Transporter les éléments sélectionnés vers le dossier sécurisé
  const handleSecureSelected = (currentCategoryList: FileItem[]) => {
    if (selectedItemIds.length === 0) return;
    const itemsToSecure = currentCategoryList.filter(f => selectedItemIds.includes(f.id));
    if (itemsToSecure.length === 0) return;

    const securedItems: FileItem[] = itemsToSecure.map(f => ({
      ...f,
      isSecure: true,
      source: 'Dossier Sécurisé'
    }));

    setSecureFolderFiles(prev => [...securedItems, ...prev]);

    // Retirer des listes actives
    setDocumentsList(prev => prev.filter(d => !selectedItemIds.includes(d.id)));
    setImagesList(prev => prev.filter(img => !selectedItemIds.includes(img.id)));
    setVideosList(prev => prev.filter(vid => !selectedItemIds.includes(vid.id)));
    setAudioList(prev => prev.filter(aud => !selectedItemIds.includes(aud.id)));
    setCloudRecentFiles(prev => prev.filter(f => !selectedItemIds.includes(f.id)));

    if (splitSelectedFile && selectedItemIds.includes(splitSelectedFile.id)) {
      setSplitSelectedFile(null);
    }

    showToast(`${itemsToSecure.length} élément(s) transporté(s) vers le dossier sécurisé !`);
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  // Téléchargement d'un fichier avec enregistrement dans le menu téléchargement
  const handleDownloadFile = (file: { name: string; size?: string; sizeBytes?: number; category?: any }) => {
    recordDownloadedFile({
      name: file.name,
      size: file.size,
      sizeBytes: file.sizeBytes,
      category: file.category
    });
    showToast(`Téléchargement de ${file.name}... Ajouté au menu Téléchargements !`);
  };

  // Partage de fichier
  const handleShareFile = async (file: FileItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: file.name,
          text: `Fichier StudyCloud : ${file.name}`
        });
        showToast('Partage réussi !');
        return;
      } catch (e) {}
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Lien copié dans le presse-papier !');
    } catch (e) {
      showToast(`Partage de ${file.name}`);
    }
  };

  // Actions du menu universel (3 traits) pour tous les fichiers :
  // Cocher, Tout cocher, Télécharger, Supprimer, Partager, Créer un lien, Déplacer, Dupliquer, Favoris, Épingler, Renommer
  const handleGenericFileAction = (action: string, file: FileItem, currentCategoryList: FileItem[]) => {
    setActiveMenuFileId(null);
    setDocMenuOpenId(null);
    setAudioMenuSongId(null);

    switch (action) {
      case 'check':
        setIsSelectionMode(true);
        setSelectedItemIds([file.id]);
        showToast(`"${file.name}" coché`);
        break;

      case 'check_all': {
        setIsSelectionMode(true);
        const allIds = currentCategoryList.map(f => f.id);
        setSelectedItemIds(allIds);
        showToast(`Tous les ${currentCategoryList.length} éléments cochés`);
        break;
      }

      case 'download':
        handleDownloadFile(file);
        break;

      case 'delete':
        // Supprime de la liste adéquate
        setDocumentsList(prev => prev.filter(d => d.id !== file.id));
        setImagesList(prev => prev.filter(img => img.id !== file.id));
        setVideosList(prev => prev.filter(vid => vid.id !== file.id));
        setAudioList(prev => prev.filter(aud => aud.id !== file.id));
        setDownloadedItems(prev => prev.filter(dl => dl.id !== file.id));
        if (splitSelectedFile?.id === file.id) {
          setSplitSelectedFile(null);
        }
        showToast(`"${file.name}" supprimé !`);
        break;

      case 'share':
        handleShareFile(file);
        break;

      case 'create_link': {
        const link = `${window.location.origin}${window.location.pathname}#${file.category || 'file'}-${file.id}`;
        try {
          navigator.clipboard?.writeText(link);
          showToast('Lien copié dans le presse-papiers !');
        } catch {
          showToast(`Lien créé pour "${file.name}"`);
        }
        break;
      }

      case 'move':
        showToast(`Fichier "${file.name}" prêt à être déplacé !`);
        break;

      case 'secure_folder': {
        const securedFile: FileItem = {
          ...file,
          isSecure: true,
          source: 'Dossier Sécurisé'
        };
        setSecureFolderFiles(prev => [securedFile, ...prev]);

        // Retirer de sa liste d'origine pour isolation
        setDocumentsList(prev => prev.filter(d => d.id !== file.id));
        setImagesList(prev => prev.filter(img => img.id !== file.id));
        setVideosList(prev => prev.filter(vid => vid.id !== file.id));
        setAudioList(prev => prev.filter(aud => aud.id !== file.id));
        setCloudRecentFiles(prev => prev.filter(f => f.id !== file.id));

        if (splitSelectedFile?.id === file.id) {
          setSplitSelectedFile(null);
        }
        showToast(`"${file.name}" transporté vers le dossier sécurisé !`);
        break;
      }

      case 'restore_from_secure': {
        const restoredFile: FileItem = {
          ...file,
          isSecure: false,
          source: 'StudyCloud'
        };
        setSecureFolderFiles(prev => prev.filter(f => f.id !== file.id));

        if (file.category === 'documents') setDocumentsList(prev => [restoredFile, ...prev]);
        else if (file.category === 'images') setImagesList(prev => [restoredFile, ...prev]);
        else if (file.category === 'videos') setVideosList(prev => [restoredFile, ...prev]);
        else if (file.category === 'audio') setAudioList(prev => [restoredFile, ...prev]);

        if (splitSelectedFile?.id === file.id) {
          setSplitSelectedFile(null);
        }
        showToast(`"${file.name}" restauré hors du dossier sécurisé !`);
        break;
      }

      case 'duplicate': {
        const ext = file.extension || (file.name.includes('.') ? file.name.split('.').pop() : 'fichier');
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        const newFile: FileItem = {
          ...file,
          id: `${file.category || 'item'}-dup-${Date.now()}`,
          name: `${nameWithoutExt} (Copie).${ext}`,
          date: "Aujourd'hui, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (file.category === 'documents') {
          setDocumentsList(prev => [newFile, ...prev]);
        } else if (file.category === 'images') {
          setImagesList(prev => [newFile, ...prev]);
        } else if (file.category === 'videos') {
          setVideosList(prev => [newFile, ...prev]);
        } else if (file.category === 'audio') {
          setAudioList(prev => [newFile, ...prev]);
        }
        showToast(`Fichier dupliqué : "${newFile.name}" !`);
        break;
      }

      case 'favorite': {
        const toggleFav = (list: FileItem[]) =>
          list.map(f => f.id === file.id ? { ...f, isFavorite: !f.isFavorite } : f);
        if (file.category === 'documents') setDocumentsList(toggleFav);
        else if (file.category === 'images') setImagesList(toggleFav);
        else if (file.category === 'videos') setVideosList(toggleFav);
        else if (file.category === 'audio') setAudioList(toggleFav);
        showToast(file.isFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris !');
        break;
      }

      case 'pin': {
        const togglePin = (list: FileItem[]) =>
          list.map(f => f.id === file.id ? { ...f, isPinned: !f.isPinned } : f);
        if (file.category === 'documents') setDocumentsList(togglePin);
        else if (file.category === 'images') setImagesList(togglePin);
        else if (file.category === 'videos') setVideosList(togglePin);
        else if (file.category === 'audio') setAudioList(togglePin);
        showToast(file.isPinned ? `"${file.name}" désépinglé` : `"${file.name}" épinglé au début !`);
        break;
      }

      case 'rename': {
        const newName = window.prompt('Modifier le nom du fichier :', file.name);
        if (newName && newName.trim() && newName.trim() !== file.name) {
          const renameIn = (list: FileItem[]) =>
            list.map(f => f.id === file.id ? { ...f, name: newName.trim() } : f);
          if (file.category === 'documents') setDocumentsList(renameIn);
          else if (file.category === 'images') setImagesList(renameIn);
          else if (file.category === 'videos') setVideosList(renameIn);
          else if (file.category === 'audio') setAudioList(renameIn);
          showToast(`Fichier renommé en "${newName.trim()}" !`);
        }
        break;
      }

      case 'set_as_profile_and_wallpaper': {
        const imageUrl = file.previewUrl || '';
        if (!imageUrl) {
          showToast("Aperçu de l'image indisponible.");
          break;
        }
        localStorage.setItem('studycloud_dashboard_wallpaper', imageUrl);
        localStorage.setItem('unifolder_user_avatar', imageUrl);
        window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: imageUrl } }));
        window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: imageUrl } }));
        showToast(`Photo de profil et fond du tableau de bord mis à jour !`);
        break;
      }

      default:
        break;
    }
  };

  const handleDocAction = (action: string, doc: FileItem) => {
    handleGenericFileAction(action, doc, filteredDocuments);
  };

  // Gestion de la sélection d'éléments
  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = (list: FileItem[]) => {
    const idsToDelete = selectedItemIds;
    if (idsToDelete.length === 0) {
      showToast("Aucun élément sélectionné");
      return;
    }
    const count = idsToDelete.length;
    setDocumentsList(prev => prev.filter(d => !idsToDelete.includes(d.id)));
    setImagesList(prev => prev.filter(img => !idsToDelete.includes(img.id)));
    setVideosList(prev => prev.filter(vid => !idsToDelete.includes(vid.id)));
    setAudioList(prev => {
      const remaining = prev.filter(aud => !idsToDelete.includes(aud.id));
      if (splitSelectedFile && idsToDelete.includes(splitSelectedFile.id) && splitSelectedFile.category === 'audio') {
        if (remaining.length > 0) {
          setSplitSelectedFile(remaining[0]);
          setAudioDuration(remaining[0].durationSec || 219);
          setAudioCurrentTime(0);
        } else {
          setSplitSelectedFile(null);
        }
      }
      return remaining;
    });
    setDownloadedItems(prev => prev.filter(dl => !idsToDelete.includes(dl.id)));
    if (splitSelectedFile && idsToDelete.includes(splitSelectedFile.id) && splitSelectedFile.category !== 'audio') {
      setSplitSelectedFile(null);
    }
    setSelectedItemIds([]);
    setIsSelectionMode(false);
    showToast(`${count} élément(s) supprimé(s)`);
  };

  const handleDownloadSelected = (list: FileItem[]) => {
    if (selectedItemIds.length === 0) {
      showToast("Aucun élément sélectionné");
      return;
    }
    const count = selectedItemIds.length;
    selectedItemIds.forEach(id => {
      const item = list.find(f => f.id === id) ||
        documentsList.find(f => f.id === id) ||
        imagesList.find(f => f.id === id) ||
        videosList.find(f => f.id === id) ||
        audioList.find(f => f.id === id);
      if (item) handleDownloadFile(item);
    });
    showToast(`${count} fichier(s) en cours de téléchargement`);
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  const handleCreateLinkSelected = (list: FileItem[]) => {
    if (selectedItemIds.length === 0) {
      showToast("Aucun élément sélectionné");
      return;
    }
    const count = selectedItemIds.length;
    const url = `${window.location.origin}/share?ids=${selectedItemIds.join(',')}`;
    try {
      navigator.clipboard?.writeText(url);
      showToast(`${count} élément(s) : lien copié dans le presse-papiers !`);
    } catch {
      showToast(`${count} élément(s) : lien créé !`);
    }
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  // SÉLECTION D'UN ÉLÉMENT : DÉCLENCHE LA DIVISION EN DEUX (SPLIT SCREEN)
  const handleSelectFile = (file: FileItem) => {
    setSplitSelectedFile(file);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);

    // Si audio, démarrer l'écouteur et ouvrir le lecteur mobile si sur téléphone
    if (file.category === 'audio') {
      setIsAudioPlaying(true);
      setAudioCurrentTime(0);
      setAudioDuration(file.durationSec || 219);
      setIsMobilePlayerOpen(true);
    } else {
      setIsAudioPlaying(false);
    }

    // Si vidéo, réinitialiser
    if (file.category === 'videos') {
      setIsVideoPlaying(true);
      setVideoCurrentTime(0);
    } else {
      setIsVideoPlaying(false);
    }

    setCloudRecentFiles(prev => {
      const withoutCurrent = prev.filter(f => f.id !== file.id);
      return [file, ...withoutCurrent].slice(0, 6);
    });
  };

  // Catégories StudyCloud
  const categories = [
    {
      id: 'downloads',
      name: 'Téléchargements',
      size: `${downloadedItems.length} fichier${downloadedItems.length > 1 ? 's' : ''}`,
      icon: Download,
      color: 'text-sky-400'
    },
    {
      id: 'images',
      name: 'Images',
      size: '7,5 Go',
      icon: ImageIcon,
      color: 'text-emerald-400'
    },
    {
      id: 'videos',
      name: 'Vidéos',
      size: '20 Go',
      icon: Film,
      color: 'text-purple-400'
    },
    {
      id: 'audio',
      name: 'Audio',
      size: '4,8 Go',
      icon: Music,
      color: 'text-amber-400'
    },
    {
      id: 'documents',
      name: 'Documents',
      size: '3,5 Go',
      icon: FileText,
      color: 'text-blue-400'
    },
    {
      id: 'apps',
      name: 'Applications',
      size: '12 installées',
      icon: LayoutGrid,
      color: 'text-pink-400'
    }
  ];

  // Collections StudyCloud
  const collections = [
    {
      id: 'favorites',
      name: 'Favoris',
      icon: Star,
      color: 'text-amber-400'
    },
    {
      id: 'secure-folder',
      name: 'Dossier sécurisé',
      icon: Lock,
      color: 'text-blue-400'
    },
    {
      id: 'cloud-storage',
      name: 'Espace Cloud',
      icon: Cloud,
      color: 'text-sky-400'
    },
    {
      id: 'trash',
      name: 'Corbeille',
      icon: Trash2,
      color: 'text-rose-400'
    }
  ];

  // Filtrage selon la recherche (strictement 6 éléments maximum sur l'accueil)
  const displayedFiles = useMemo(() => {
    return cloudRecentFiles.filter(f => {
      const matchQuery = searchQuery.trim() === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.source.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchQuery;
    }).slice(0, 6);
  }, [cloudRecentFiles, searchQuery]);

  // Ouverture d'un sous-menu indépendant
  const handleOpenSubMenu = (
    type: 'category' | 'collection' | 'classeur',
    id: string,
    name: string,
    icon: any,
    color: string
  ) => {
    setSubSearchQuery('');
    setIsViewerMaximized(false);
    setIsMobilePlayerOpen(false);

    // En Audio, division permanente avec morceau par défaut (Raindance Image 2 & 3)
    if (id === 'audio') {
      const defaultTrack = audioList.find(s => s.name.includes('Raindance')) || audioList[0];
      setSplitSelectedFile(defaultTrack);
      setAudioDuration(defaultTrack?.durationSec || 219);
      setAudioCurrentTime(11);
      setIsAudioPlaying(false);
    } else {
      setSplitSelectedFile(null); // Réinitialiser le split lors du changement de menu
    }

    setCurrentSubView({
      id: `studycloud-${type}-${id}`,
      type,
      name,
      icon,
      color
    });
  };

  // Fonction de tri universelle appliquée aux listes selon l'option sélectionnée (menu 3 traits)
  const applySorting = (list: FileItem[]): FileItem[] => {
    let result = [...list];
    if (sortOption === 'pinned') {
      result.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    } else if (sortOption === 'oldest') {
      result.reverse();
    }
    return result;
  };

  // Liste des documents pour le sous-menu Documents (Image 1)
  const filteredDocuments = useMemo(() => {
    const list = [...documentsList, ...cloudRecentFiles.filter(f => f.category === 'documents' && !documentsList.some(s => s.name === f.name))];
    const filtered = list.filter(doc => {
      return subSearchQuery.trim() === '' || doc.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [documentsList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des images pour le sous-menu Images (Image 2)
  const filteredImages = useMemo(() => {
    const list = [...imagesList, ...cloudRecentFiles.filter(f => f.category === 'images' && !imagesList.some(s => s.name === f.name))];
    const filtered = list.filter(img => {
      return subSearchQuery.trim() === '' || img.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [imagesList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des vidéos pour le sous-menu Vidéos (Image 3)
  const filteredVideos = useMemo(() => {
    const list = [...videosList, ...cloudRecentFiles.filter(f => f.category === 'videos' && !videosList.some(s => s.name === f.name))];
    const filtered = list.filter(vid => {
      return subSearchQuery.trim() === '' || vid.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [videosList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste audio pour le sous-menu Audio (Image 4)
  const filteredAudio = useMemo(() => {
    const list = [...audioList, ...cloudRecentFiles.filter(f => f.category === 'audio' && !audioList.some(s => s.name === f.name))];
    const filtered = list.filter(aud => {
      return subSearchQuery.trim() === '' || aud.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [audioList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des fichiers du dossier sécurisé (filtrés par recherche)
  const filteredSecureFiles = useMemo(() => {
    const list = secureFolderFiles.filter(item => {
      return subSearchQuery.trim() === '' || item.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(list);
  }, [secureFolderFiles, subSearchQuery, sortOption]);

  // Groupement des fichiers audio par date comme dans Image 4
  const groupedAudio = useMemo(() => {
    const groups: { [key: string]: FileItem[] } = {};
    filteredAudio.forEach(item => {
      let groupKey = item.date;
      if (item.date.includes('19 août')) groupKey = '19 août';
      else if (item.date.includes('14 août')) groupKey = 'ven. 14 août';
      else if (item.date.includes("Aujourd'hui")) groupKey = "Aujourd'hui";
      else if (item.date.includes('Hier')) groupKey = 'Hier';
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredAudio]);

  // Navigation Audio (Suivant, Précédent avec support Aléatoire)
  const handleAudioNext = () => {
    const list = filteredAudio;
    if (list.length === 0) return;
    const currentIdx = list.findIndex(a => a.id === splitSelectedFile?.id);
    if (isAudioShuffle && list.length > 1) {
      let randIdx = Math.floor(Math.random() * list.length);
      while (randIdx === currentIdx && list.length > 1) {
        randIdx = Math.floor(Math.random() * list.length);
      }
      handleSelectFile(list[randIdx]);
      setIsAudioPlaying(true);
      return;
    }
    const nextIdx = (currentIdx + 1) % list.length;
    handleSelectFile(list[nextIdx]);
    setIsAudioPlaying(true);
  };

  const handleAudioPrev = () => {
    const list = filteredAudio;
    if (list.length === 0) return;
    const currentIdx = list.findIndex(a => a.id === splitSelectedFile?.id);
    if (isAudioShuffle && list.length > 1) {
      let randIdx = Math.floor(Math.random() * list.length);
      while (randIdx === currentIdx && list.length > 1) {
        randIdx = Math.floor(Math.random() * list.length);
      }
      handleSelectFile(list[randIdx]);
      setIsAudioPlaying(true);
      return;
    }
    const prevIdx = (currentIdx - 1 + list.length) % list.length;
    handleSelectFile(list[prevIdx]);
    setIsAudioPlaying(true);
  };

  // Saut de 10 secondes en avant ou en arrière (-10s / +10s)
  const handleSeekDelta = (delta: number) => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime ?? audioCurrentTime;
      const next = Math.max(0, Math.min(audioDuration, cur + delta));
      audioRef.current.currentTime = next;
      setAudioCurrentTime(Math.floor(next));
    } else {
      setAudioCurrentTime(prev => Math.max(0, Math.min(audioDuration, prev + delta)));
    }
  };

  // Bascule de la lecture en boucle
  const toggleAudioRepeat = () => {
    setIsAudioRepeat(prev => {
      const next = prev === 'off' ? 'one' : 'off';
      showToast(next === 'one' ? "Lecture en boucle activée (le son reprend seul)" : "Lecture en boucle désactivée");
      return next;
    });
  };

  // Suppression d'un son spécifique
  const handleDeleteAudio = (track: FileItem) => {
    setAudioList(prev => prev.filter(a => a.id !== track.id));
    if (splitSelectedFile?.id === track.id) {
      const remaining = audioList.filter(a => a.id !== track.id);
      if (remaining.length > 0) {
        setSplitSelectedFile(remaining[0]);
        setAudioDuration(remaining[0].durationSec || 219);
        setAudioCurrentTime(0);
      } else {
        setSplitSelectedFile(null);
      }
    }
    showToast(`"${track.name}" supprimé`);
  };

  // Gestion du mode sélection multiple pour les sons
  const toggleAudioSelection = (id: string) => {
    setSelectedAudioIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedAudio = () => {
    if (selectedAudioIds.length === 0) {
      showToast("Aucun son sélectionné");
      return;
    }
    const count = selectedAudioIds.length;
    setAudioList(prev => prev.filter(a => !selectedAudioIds.includes(a.id)));
    if (splitSelectedFile && selectedAudioIds.includes(splitSelectedFile.id)) {
      const remaining = audioList.filter(a => !selectedAudioIds.includes(a.id));
      if (remaining.length > 0) {
        setSplitSelectedFile(remaining[0]);
        setAudioDuration(remaining[0].durationSec || 219);
        setAudioCurrentTime(0);
      } else {
        setSplitSelectedFile(null);
      }
    }
    setSelectedAudioIds([]);
    setIsAudioSelectionMode(false);
    showToast(`${count} son(s) supprimé(s)`);
  };

  const handleDownloadSelectedAudio = () => {
    if (selectedAudioIds.length === 0) {
      showToast("Aucun son sélectionné");
      return;
    }
    const count = selectedAudioIds.length;
    selectedAudioIds.forEach(id => {
      const item = audioList.find(a => a.id === id);
      if (item) handleDownloadFile(item);
    });
    showToast(`${count} son(s) en cours de téléchargement`);
    setIsAudioSelectionMode(false);
    setSelectedAudioIds([]);
  };

  const handleCreateLinkSelectedAudio = () => {
    if (selectedAudioIds.length === 0) {
      showToast("Aucun son sélectionné");
      return;
    }
    const count = selectedAudioIds.length;
    const url = `${window.location.origin}/share/audio?ids=${selectedAudioIds.join(',')}`;
    navigator.clipboard?.writeText(url);
    showToast(`${count} son(s) : lien copié dans le presse-papiers !`);
    setIsAudioSelectionMode(false);
    setSelectedAudioIds([]);
  };

  // Maintien permanent de la vue divisée en mode Audio sur Desktop
  useEffect(() => {
    if (currentSubView?.id === 'studycloud-category-audio') {
      if (!splitSelectedFile || splitSelectedFile.category !== 'audio') {
        const raindance = audioList.find(s => s.name.includes('Raindance')) || audioList[0];
        if (raindance) {
          setSplitSelectedFile(raindance);
          setAudioDuration(raindance.durationSec || 219);
          setAudioCurrentTime(11);
        }
      }
    }
  }, [currentSubView, splitSelectedFile, audioList]);

  // Intervalle de lecture audio et synchronisation temporelle
  useEffect(() => {
    let interval: any = null;
    if (isAudioPlaying) {
      interval = setInterval(() => {
        setAudioCurrentTime(prev => {
          if (prev >= audioDuration) {
            if (isAudioRepeat === 'one') {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }
              return 0;
            }
            if (isAudioRepeat === 'all' || isAudioShuffle) {
              handleAudioNext();
              return 0;
            }
            setIsAudioPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAudioPlaying, audioDuration, isAudioRepeat, isAudioShuffle, filteredAudio, splitSelectedFile]);

  // Synchronisation de l'élément audio natif
  useEffect(() => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isAudioPlaying, splitSelectedFile]);

  // Liste des téléchargements pour le sous-menu Téléchargements (Prend tout type de fichier)
  const filteredDownloads = useMemo(() => {
    return downloadedItems.filter(item => {
      return subSearchQuery.trim() === '' || item.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
  }, [downloadedItems, subSearchQuery]);

  // Conversion d'un DownloadedItem en FileItem pour l'affichage riche et le lecteur
  const toFileItem = (item: DownloadedItem): FileItem => ({
    id: item.id,
    name: item.name,
    category: item.category,
    source: 'Téléchargements',
    size: item.size,
    sizeBytes: item.sizeBytes || 0,
    date: item.date,
    previewUrl: item.previewUrl,
    videoUrl: item.videoUrl,
    audioUrl: item.audioUrl,
    isImage: item.isImage || item.category === 'images',
    documentCategory: item.documentCategory || 'COURS',
    extension: item.extension || 'PDF'
  });

  // Catégorisation des téléchargements pour l'affichage selon le type d'origine
  const downloadDocs = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'documents' || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(item.extension?.toLowerCase() || '')
    ).map(toFileItem);
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadImages = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'images' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(item.extension?.toLowerCase() || '')
    ).map(toFileItem);
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadVideos = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'videos' || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(item.extension?.toLowerCase() || '')
    ).map(toFileItem);
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadAudio = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'audio' || ['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(item.extension?.toLowerCase() || '')
    ).map(item => ({
      ...toFileItem(item),
      category: 'audio' as const,
      artist: item.artist || (item as any).author || 'Fichier Audio'
    }));
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadOthers = useMemo(() => {
    return filteredDownloads.filter(item => 
      !downloadDocs.some(d => d.id === item.id) &&
      !downloadImages.some(d => d.id === item.id) &&
      !downloadVideos.some(d => d.id === item.id) &&
      !downloadAudio.some(d => d.id === item.id)
    ).map(toFileItem);
  }, [filteredDownloads, downloadDocs, downloadImages, downloadVideos, downloadAudio]);

  // NAVIGATION PRÉCÉDENT / SUIVANT DANS LA VUE DIVISÉE
  const handleNavigateSplit = (direction: 'prev' | 'next') => {
    if (!splitSelectedFile) return;
    let list: FileItem[] = [];
    if (currentSubView?.id === 'studycloud-category-images') list = filteredImages;
    else if (currentSubView?.id === 'studycloud-category-videos') list = filteredVideos;
    else if (currentSubView?.id === 'studycloud-category-audio') list = filteredAudio;
    else if (currentSubView?.id === 'studycloud-category-documents') list = filteredDocuments;
    else if (currentSubView?.id === 'studycloud-category-downloads') {
      list = [...downloadDocs, ...downloadImages, ...downloadVideos, ...downloadAudio];
    } else {
      list = displayedFiles;
    }

    const currentIndex = list.findIndex(f => f.id === splitSelectedFile.id);
    if (currentIndex === -1) return;
    const nextIndex = direction === 'next' 
      ? (currentIndex + 1) % list.length 
      : (currentIndex - 1 + list.length) % list.length;
    
    setSplitSelectedFile(list[nextIndex]);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);
  };

  // Récupération des styles de carte document en fonction de l'extension
  const getDocumentTheme = (ext: string = 'PDF') => {
    const upper = ext.toUpperCase();
    if (upper === 'PDF') {
      return {
        bg: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
        border: 'border-2 border-red-500 hover:border-red-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#450a0a]',
        badge: 'bg-white text-red-700 border-white',
        typeBadge: 'PDF'
      };
    } else if (['DOC', 'DOCX'].includes(upper)) {
      return {
        bg: 'linear-gradient(180deg, #2563eb 0%, #1e40af 100%)',
        border: 'border-2 border-blue-500 hover:border-blue-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#172554]',
        badge: 'bg-white text-blue-700 border-white',
        typeBadge: 'DOCX'
      };
    } else if (['XLS', 'XLSX'].includes(upper)) {
      return {
        bg: 'linear-gradient(180deg, #0d9488 0%, #115e59 100%)',
        border: 'border-2 border-emerald-500 hover:border-emerald-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#022c22]',
        badge: 'bg-white text-emerald-700 border-white',
        typeBadge: 'XLSX'
      };
    } else if (['PPT', 'PPTX'].includes(upper)) {
      return {
        bg: 'linear-gradient(180deg, #ea580c 0%, #9a3412 100%)',
        border: 'border-2 border-orange-500 hover:border-orange-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#431407]',
        badge: 'bg-white text-orange-700 border-white',
        typeBadge: 'PPTX'
      };
    }
    return {
      bg: 'linear-gradient(180deg, #26272b 0%, #1c1c1f 100%)',
      border: 'border-2 border-stone-700 hover:border-stone-500',
      shadow: 'shadow-[2.5px_2.5px_0px_0px_#1c1917]',
      badge: 'bg-white text-stone-900 border-white',
      typeBadge: upper
    };
  };

  // Formatter temps audio/vidéo (ex: 02:45)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Ouvrir l'espace d'étude pour le menu actif (ex: Musique, Téléchargements, Documents, Images, etc.)
  const handleOpenStudySpaceForCurrentMenu = (withSelectedFile: boolean) => {
    let menuName = currentSubView ? currentSubView.name : 'Mes fichiers';

    // Si un fichier spécifique est sélectionné, sa catégorie dicte la galerie correspondante
    if (withSelectedFile && splitSelectedFile) {
      if (splitSelectedFile.category === 'images' || splitSelectedFile.isImage) {
        menuName = 'Images';
      } else if (splitSelectedFile.category === 'videos' || splitSelectedFile.videoUrl) {
        menuName = 'Vidéos';
      } else if (splitSelectedFile.category === 'audio' || splitSelectedFile.audioUrl) {
        menuName = 'Musique';
      } else if (splitSelectedFile.category === 'documents') {
        menuName = 'Documents';
      }
    } else if (currentSubView?.id === 'studycloud-category-audio' || menuName.toLowerCase() === 'audio') {
      menuName = 'Musique';
    }

    let sourceList: any[] = [];
    const norm = menuName.toLowerCase();
    if (norm.includes('image')) {
      sourceList = filteredImages.length > 0 ? filteredImages : (imagesList.length > 0 ? imagesList : DEFAULT_IMAGES_LIST);
    } else if (norm.includes('vid')) {
      sourceList = filteredVideos.length > 0 ? filteredVideos : (videosList.length > 0 ? videosList : DEFAULT_VIDEOS_LIST);
    } else if (norm.includes('musiq') || norm.includes('audio') || norm.includes('son')) {
      sourceList = filteredAudio.length > 0 ? filteredAudio : (audioList.length > 0 ? audioList : DEFAULT_AUDIO_LIST);
    } else if (norm.includes('doc')) {
      sourceList = filteredDocuments.length > 0 ? filteredDocuments : (documentsList.length > 0 ? documentsList : DEFAULT_DOCUMENTS_LIST);
    } else if (currentSubView?.id === 'studycloud-category-downloads') {
      sourceList = [...downloadDocs, ...downloadImages, ...downloadVideos, ...downloadAudio, ...downloadOthers];
    } else if (currentSubView?.id === 'studycloud-collection-secure-folder') {
      sourceList = filteredSecureFiles;
    } else {
      sourceList = cloudRecentFiles;
    }

    let convertedFiles = sourceList.map(f => {
      const ext = f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      return {
        id: f.id,
        name: f.name,
        size: f.sizeBytes || 0,
        type: f.isImage ? 'image/jpeg' : (f.videoUrl ? 'video/mp4' : (f.audioUrl ? 'audio/mpeg' : 'application/pdf')),
        extension: ext,
        url: f.previewUrl || f.audioUrl || f.videoUrl || (f as any).url || '',
        previewUrl: f.previewUrl,
        audioUrl: f.audioUrl,
        videoUrl: f.videoUrl,
        isImage: !!f.isImage,
        category: f.category,
        folderName: menuName,
        matiere: menuName,
        source: f.source || menuName
      };
    });

    let selectedFileForStudy: any = null;
    if (withSelectedFile && splitSelectedFile) {
      const ext = splitSelectedFile.extension || (splitSelectedFile.name && splitSelectedFile.name.includes('.') ? splitSelectedFile.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      selectedFileForStudy = {
        id: splitSelectedFile.id,
        name: splitSelectedFile.name,
        size: splitSelectedFile.sizeBytes || 0,
        type: splitSelectedFile.isImage ? 'image/jpeg' : (splitSelectedFile.videoUrl ? 'video/mp4' : (splitSelectedFile.audioUrl ? 'audio/mpeg' : 'application/pdf')),
        extension: ext,
        url: splitSelectedFile.previewUrl || splitSelectedFile.audioUrl || splitSelectedFile.videoUrl || (splitSelectedFile as any).url || '',
        previewUrl: splitSelectedFile.previewUrl,
        audioUrl: splitSelectedFile.audioUrl,
        videoUrl: splitSelectedFile.videoUrl,
        isImage: !!splitSelectedFile.isImage,
        category: splitSelectedFile.category,
        folderName: menuName,
        matiere: menuName,
        source: splitSelectedFile.source || menuName
      };

      // S'assurer que le fichier sélectionné est bien inclus dans la liste de tous les fichiers
      const existingIdx = convertedFiles.findIndex(f => f.id === selectedFileForStudy.id || f.name === selectedFileForStudy.name);
      if (existingIdx >= 0) {
        convertedFiles[existingIdx] = selectedFileForStudy;
      } else {
        convertedFiles = [selectedFileForStudy, ...convertedFiles];
      }
    }

    try {
      localStorage.setItem(`unifolder_matiere_files_${menuName}`, JSON.stringify(convertedFiles));
    } catch (e) {}

    const folderPayload = {
      id: `menu-${menuName}`,
      title: menuName,
      description: '',
      category: menuName,
      author: 'StudyCloud',
      school: '',
      country: "Côte d'Ivoire",
      createdAt: new Date().toISOString(),
      files: convertedFiles,
      totalSize: 0,
      downloadsCount: 0,
      isPublic: false
    };

    const wasFullscreen = isFullscreen || isViewerMaximized;
    setIsFullscreen(false);
    setIsViewerMaximized(false);

    if (onOpenStudySpace) {
      onOpenStudySpace(selectedFileForStudy, menuName, convertedFiles, wasFullscreen);
    }

    window.dispatchEvent(new CustomEvent('studycloud_open_study_space', {
      detail: {
        file: selectedFileForStudy,
        folderName: menuName,
        files: convertedFiles,
        folder: folderPayload,
        isFullscreen: wasFullscreen
      }
    }));
  };

  // =========================================================================
  // BANDEAU DE SÉLECTION MULTIPLE UNIVERSEL (PROPOSITIONS D'ACTIONS)
  // Apparaît dès que l'on clique sur "Cocher" ou "Tout cocher" dans le menu à 3 traits
  // Propose : Supprimer / Tout supprimer, Télécharger / Tout télécharger, Créer un lien, Annuler
  // =========================================================================
  const renderSelectionBanner = (currentCategoryList: FileItem[]) => {
    if (!isSelectionMode) return null;
    const isAllSelected = currentCategoryList.length > 0 && selectedItemIds.length >= currentCategoryList.length;

    return (
      <div className="w-full p-2.5 sm:p-3 rounded-2xl bg-amber-500/10 dark:bg-slate-900 border border-amber-400/40 dark:border-amber-500/30 shadow-md flex items-center justify-between gap-2 flex-wrap animate-in fade-in slide-in-from-top-2 duration-150 my-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isAllSelected) {
                setSelectedItemIds([]);
              } else {
                setSelectedItemIds(currentCategoryList.map(f => f.id));
              }
            }}
            className="p-1 text-amber-500 hover:text-amber-600 cursor-pointer flex items-center gap-1.5"
            title={isAllSelected ? "Tout décocher" : "Tout cocher"}
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
            ) : (
              <Square className="w-5 h-5 text-stone-400 dark:text-slate-400" />
            )}
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
              {isAllSelected
                ? `Tous les ${currentCategoryList.length} éléments cochés`
                : `${selectedItemIds.length} élément${selectedItemIds.length > 1 ? 's' : ''} coché${selectedItemIds.length > 1 ? 's' : ''}`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Supprimer ou Tout supprimer */}
          <button
            type="button"
            onClick={() => handleDeleteSelected(currentCategoryList)}
            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title={isAllSelected ? "Tout supprimer" : "Supprimer"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAllSelected ? 'Tout supprimer' : 'Supprimer'}</span>
          </button>

          {/* Tout télécharger ou Télécharger */}
          <button
            type="button"
            onClick={() => handleDownloadSelected(currentCategoryList)}
            className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title={isAllSelected ? "Tout télécharger" : "Télécharger"}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAllSelected ? 'Tout télécharger' : 'Télécharger'}</span>
          </button>

          {/* Créer un lien */}
          <button
            type="button"
            onClick={() => handleCreateLinkSelected(currentCategoryList)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Créer un lien"
          >
            <Link className="w-3.5 h-3.5" />
            <span>Créer un lien</span>
          </button>

          {/* Transporter vers le dossier sécurisé */}
          <button
            type="button"
            onClick={() => handleSecureSelected(currentCategoryList)}
            className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Transporter vers le dossier sécurisé"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dossier sécurisé</span>
          </button>

          {/* Annuler la sélection */}
          <button
            type="button"
            onClick={handleCancelSelection}
            className="p-1.5 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 text-stone-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Fermer le mode sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // MENU UNIVERSEL À 3 TRAITS (MENU DÉROULANT COMPLET POUR TOUS LES FICHIERS)
  // Options : Cocher, Tout cocher, Télécharger, Supprimer, Partager, Créer un lien,
  // Transporter vers le dossier sécurisé, Le déplacer, Dupliquer, Favoris, Épingler, Modifier le nom
  // =========================================================================
  const renderFileOptionsMenu = (file: FileItem, currentCategoryList: FileItem[], align: 'left' | 'right' = 'left') => {
    const isMenuOpen = activeMenuFileId === file.id || docMenuOpenId === file.id || audioMenuSongId === file.id;
    if (!isMenuOpen) return null;

    return (
      <div 
        className={`studycloud-file-menu-panel absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-50 w-60 bg-[#0A0F1D] border-2 border-slate-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
          {/* En-tête de menu dédié avec nom du fichier et bouton fermeture */}
          <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] font-semibold text-slate-400">
                {file.size} • <span className="uppercase text-amber-400">{file.extension || file.category}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(null);
                setDocMenuOpenId(null);
                setAudioMenuSongId(null);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Liste déroulante des options avec défilement fluide garanti */}
          <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
            {/* Section 1 : Sélection (Cocher, Tout cocher, Télécharger) */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleGenericFileAction('check', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Cocher</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('check_all', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Tout cocher</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('download', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Télécharger</span>
              </button>
            </div>

            {/* Section 2 : Actions principales de gestion */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleGenericFileAction('delete', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Supprimer le fichier</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('share', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span>Partager</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('create_link', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Link className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                <span>Créer un lien</span>
              </button>
              {file.isSecure ? (
                <button
                  type="button"
                  onClick={() => handleGenericFileAction('restore_from_secure', file, currentCategoryList)}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
                >
                  <FolderCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Sortir du dossier sécurisé</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGenericFileAction('secure_folder', file, currentCategoryList)}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer text-left"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Transporter vers le dossier sécurisé</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleGenericFileAction('move', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <FolderInput className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Le déplacer</span>
              </button>
            </div>

            {/* Section 3 : Organisation & Édition */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleGenericFileAction('duplicate', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Copy className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>Dupliquer</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('favorite', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Star className={`w-3.5 h-3.5 shrink-0 ${file.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-400'}`} />
                <span>{file.isFavorite ? 'Retirer des favoris' : 'Ajouter au favoris'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('pin', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Pin className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                <span>Épinglez</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('rename', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Pencil className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                <span>Modifier le nom</span>
              </button>

              {/* Bouton Définir comme photo de profil (et fond du tableau de bord Pages 1 et 2) pour les images */}
              {(file.category === 'images' || file.isImage || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name)) && (
                <button
                  type="button"
                  onClick={() => handleGenericFileAction('set_as_profile_and_wallpaper', file, currentCategoryList)}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left border-t border-white/10 mt-1 pt-1.5"
                  title="Définir comme photo de profil et fond d'écran du tableau de bord pour la page 1 et 2"
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Définir comme photo de profil</span>
                </button>
              )}
            </div>
          </div>
        </div>
    );
  };

  // =========================================================================
  // MENU D'EN-TÊTE À 3 TRAITS (OPTIONS DE TRI & BOUTON ŒIL)
  // Demandé : trié par plus récent, plus ancien, ce qui sont épinglez, et bouton œil
  // =========================================================================
  const renderHeaderOptionsMenu = () => {
    if (!isHeaderMenuOpen) return null;

    return (
      <div 
        className="studycloud-file-menu-panel absolute right-0 top-11 sm:top-12 z-50 w-64 bg-[#0A0F1D] border-2 border-slate-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête du menu */}
        <div className="px-3.5 py-2.5 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div>
            <p className="text-[11px] font-black text-white">Options d'affichage & Tri</p>
            <p className="text-[9px] font-semibold text-slate-400">StudyCloud</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsHeaderMenuOpen(false);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options de tri et bouton œil */}
        <div className="py-1 divide-y divide-white/5">
          <div className="py-1">
            {/* Trié par plus récent */}
            <button
              type="button"
              onClick={() => {
                setSortOption('recent');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'recent'
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span>Trié par plus récent</span>
              </div>
              {sortOption === 'recent' && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            </button>

            {/* Plus ancien */}
            <button
              type="button"
              onClick={() => {
                setSortOption('oldest');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'oldest'
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                <span>Plus ancien</span>
              </div>
              {sortOption === 'oldest' && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
            </button>

            {/* Ceux qui sont épinglés */}
            <button
              type="button"
              onClick={() => {
                setSortOption('pinned');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'pinned'
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Pin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Ceux qui sont épinglés</span>
              </div>
              {sortOption === 'pinned' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </button>
          </div>

          {/* Bouton œil */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsEyeViewActive(!isEyeViewActive);
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                isEyeViewActive
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Eye className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{isEyeViewActive ? "Bouton œil (Activé)" : "Bouton œil"}</span>
              </div>
              {isEyeViewActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // FONCTIONS DE RENDU DES CARTES MULTIMÉDIA (RÉUTILISÉES DANS DOCUMENTS & TÉLÉCHARGEMENTS)
  // =========================================================================

  // Rendu Carte Document (Image 1 : bouton 3 traits, case à cocher en mode sélection, un seul titre)
  const renderDocumentCard = (doc: FileItem) => {
    const theme = getDocumentTheme(doc.extension || 'PDF');
    const isSelected = splitSelectedFile?.id === doc.id;
    const isMenuOpen = activeMenuFileId === doc.id || docMenuOpenId === doc.id;
    const isChecked = selectedItemIds.includes(doc.id);

    return (
      <div
        key={doc.id}
        style={{ background: theme.bg }}
        className={`aspect-[3/4] ${theme.border} ${isSelected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : ''} ${
          isChecked ? 'ring-4 ring-amber-400 shadow-2xl' : ''
        } ${
          isMenuOpen ? 'z-50 relative' : 'z-10'
        } rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none cursor-pointer active:scale-98`}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(doc.id);
          } else {
            handleSelectFile(doc);
          }
        }}
      >
        {/* Barre supérieure : Bouton 3 traits, Checkbox (en mode sélection) & Taille */}
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(isMenuOpen ? null : doc.id);
                  setDocMenuOpenId(isMenuOpen ? null : doc.id);
                }}
                className="p-1 sm:p-1.2 rounded-lg bg-black/40 hover:bg-black/70 text-white border border-white/20 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-sm"
                title="Options du fichier (3 traits)"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>

              {renderFileOptionsMenu(doc, filteredDocuments, 'left')}
            </div>

            {/* Case à cocher visible en mode sélection */}
            {isSelectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItemSelection(doc.id);
                }}
                className="p-0.5 text-white hover:scale-110 transition-transform cursor-pointer"
                title={isChecked ? "Décocher" : "Cocher"}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
                ) : (
                  <Square className="w-4 h-4 text-white/90" />
                )}
              </button>
            )}
          </div>

          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
            {doc.size}
          </span>
        </div>

        {/* Corps de carte / illustration schéma */}
        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white p-2 relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <div className="flex items-center justify-between border-b border-stone-200 pb-1">
            <span className="text-[9px] font-black text-red-600 tracking-tighter">cme</span>
            <span className="text-[7px] font-bold bg-stone-900 text-white px-1 py-0.2 rounded">StudyCloud</span>
          </div>
          <div className="my-1">
            <p className="text-[7px] sm:text-[8px] font-black text-stone-800 leading-tight uppercase line-clamp-2">
              AMPLIFICATEUR OPERATIONNEL EN REGIME LINEAIRE : MONTAGES DE BASE
            </p>
            <p className="text-[6px] text-stone-500 font-semibold mt-0.5">1. Définition</p>
          </div>
          <div className="w-full h-12 flex items-center justify-center bg-stone-50 rounded border border-stone-200/80 my-0.5">
            <svg className="w-full h-full max-h-11" viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,5 35,40 70,22.5" fill="#FFFFFF" stroke="#1c1917" strokeWidth="1.5" />
              <line x1="15" y1="14" x2="35" y2="14" stroke="#1c1917" strokeWidth="1.2" />
              <line x1="15" y1="31" x2="35" y2="31" stroke="#1c1917" strokeWidth="1.2" />
              <text x="38" y="16" fontSize="7" fontWeight="bold" fill="#1c1917">-</text>
              <text x="38" y="33" fontSize="7" fontWeight="bold" fill="#1c1917">+</text>
              <line x1="70" y1="22.5" x2="90" y2="22.5" stroke="#1c1917" strokeWidth="1.2" />
              <text x="91" y="24" fontSize="6" fontWeight="bold" fill="#1c1917">Vs</text>
            </svg>
          </div>
          <div className="space-y-0.5 opacity-60">
            <div className="h-0.5 bg-stone-400 rounded-full w-full"></div>
            <div className="h-0.5 bg-stone-400 rounded-full w-5/6"></div>
          </div>
        </div>

        {/* Titre unique : un seul nom en bas */}
        <div className="px-0.5 mb-1">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={doc.name}>
            {doc.name}
          </p>
        </div>

        {/* Pied de carte : sans nombre de téléchargement */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadFile(doc); }}
            className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
            title="Télécharger"
          >
            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </div>
      </div>
    );
  };

  // Rendu Carte Image (Image 3 : titre directement sur l'image avec dégradé comme les vidéos, bouton 3 traits & case à cocher)
  const renderImageCard = (img: FileItem, index?: number) => {
    const isSelected = splitSelectedFile?.id === img.id;
    const isMenuOpen = activeMenuFileId === img.id;
    const isChecked = selectedItemIds.includes(img.id);

    // Déterminer alignement du menu (inverser si carte sur la droite pour ne pas déborder de l'écran)
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={img.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(img.id);
          } else {
            handleSelectFile(img);
          }
        }}
        className={`group relative aspect-square sm:aspect-[4/5] rounded-2xl bg-[#151C2C] border transition-all duration-200 cursor-pointer ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isSelected 
              ? 'border-blue-500 ring-4 ring-blue-500/50 shadow-2xl scale-[1.02]' 
              : 'border-white/10 hover:border-blue-400/50 shadow-md'
        } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
      >
        {/* Conteneur média interne avec overflow-hidden : arrondit l'image et ses dégradés sans couper le menu qui dépasse */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <img
            src={img.previewUrl}
            alt={img.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />

          {/* Titre sur l'image avec dégradé identique aux vidéos */}
          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/95 via-black/50 to-transparent">
            <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">{img.name}</p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : img.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de l'image (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderFileOptionsMenu(img, filteredImages, menuAlign)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(img.id);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? "Décocher" : "Cocher"}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {img.size}
          </span>
        </div>
      </div>
    );
  };

  // Rendu Carte Vidéo (Bouton lecture central, taille en haut à droite, bouton 3 traits & case à cocher, titre en bas)
  const renderVideoCard = (vid: FileItem, index?: number) => {
    const isSelected = splitSelectedFile?.id === vid.id;
    const isMenuOpen = activeMenuFileId === vid.id;
    const isChecked = selectedItemIds.includes(vid.id);

    // Déterminer alignement du menu
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={vid.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(vid.id);
          } else {
            handleSelectFile(vid);
          }
        }}
        className={`group relative aspect-[4/5] rounded-2xl bg-[#0A0E18] border transition-all duration-200 cursor-pointer ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isSelected 
              ? 'border-purple-500 ring-4 ring-purple-500/50 shadow-2xl scale-[1.02]' 
              : 'border-white/10 hover:border-purple-400/50 shadow-md'
        } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
      >
        {/* Conteneur média interne avec overflow-hidden : arrondit la vignette sans couper le menu déroulant */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <img
            src={vid.previewUrl}
            alt={vid.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors" />

          {/* Centre : Bouton Play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white/95 text-stone-950 flex items-center justify-center shadow-2xl group-hover:scale-115 transition-transform duration-200">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-stone-950 translate-x-0.5" />
            </div>
          </div>

          {/* Titre en bas */}
          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/95 via-black/50 to-transparent">
            <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">{vid.name}</p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : vid.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de la vidéo (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderFileOptionsMenu(vid, filteredVideos, menuAlign)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(vid.id);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? "Décocher" : "Cocher"}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {vid.size}
          </span>
        </div>
      </div>
    );
  };

  // Rendu Carte Audio Carrée (Comme pour les vidéos, carré avec bouton 3 traits, logo musique/mélodie au centre, taille en haut à droite, titre en bas)
  const renderAudioSquareCard = (aud: FileItem, index?: number) => {
    const isSelected = splitSelectedFile?.id === aud.id;
    const isMenuOpen = activeMenuFileId === aud.id || audioMenuSongId === aud.id;
    const isChecked = selectedItemIds.includes(aud.id);

    // Déterminer alignement du menu
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={aud.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(aud.id);
          } else {
            handleSelectFile(aud);
          }
        }}
        className={`group relative aspect-square rounded-2xl bg-gradient-to-br from-[#121929] via-[#0B0F19] to-black border transition-all duration-200 cursor-pointer ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isSelected 
              ? 'border-amber-500 ring-4 ring-amber-500/50 shadow-2xl scale-[1.02]' 
              : 'border-white/10 hover:border-amber-400/50 shadow-md'
        } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
      >
        {/* Conteneur média interne avec overflow-hidden : arrondit l'arrière-plan sans couper le menu */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          {aud.previewUrl ? (
            <img
              src={aud.previewUrl}
              alt={aud.name}
              className="w-full h-full object-cover opacity-45 group-hover:scale-105 group-hover:opacity-65 transition-all duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-950/40 via-slate-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

          {/* AU MILIEU : LE LOGO DE MUSIQUE / MÉLODIE DÉTAILLÉ & NET (SANS SILHOUETTE NOIRE BLOQUANTE) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-[0_8px_25px_rgba(245,158,11,0.55)] group-hover:scale-110 transition-all duration-300 border-2 border-white/30 ring-2 ring-black/40 relative">
              {/* Cercle vinyle intérieur discret */}
              <div className="absolute inset-1.5 rounded-full border border-white/20 pointer-events-none" />
              
              {/* Logo de mélodie très détaillé : double croche avec notes blanches illuminées, stems et ondes sonores */}
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Ondes de mélodie acoustique fines */}
                <path d="M2.5 10.5C2.5 7.8 4.2 5.5 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                <path d="M21.5 10.5C21.5 7.8 19.8 5.5 17.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                
                {/* Tiges et double liaison musicale */}
                <path d="M9 16.5V5.5L20 3.5V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 9.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                
                {/* Tête de note 1 (gauche) blanche avec contour net */}
                <ellipse cx="6" cy="16.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 6 16.5)" />
                {/* Tête de note 2 (droite) blanche avec contour net */}
                <ellipse cx="17" cy="14.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 17 14.5)" />
              </svg>
            </div>
          </div>

          {/* Titre en bas sur dégradé sombre identique aux vidéos */}
          <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-[10px] sm:text-xs font-bold text-white truncate drop-shadow-sm">{aud.name}</p>
            <p className="text-[9px] text-amber-300/90 font-semibold truncate">{aud.artist || 'Fichier Audio'}</p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : aud.id);
                setAudioMenuSongId(isMenuOpen ? null : aud.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de l'audio (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderFileOptionsMenu(aud, downloadAudio, menuAlign)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(aud.id);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? "Décocher" : "Cocher"}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {aud.size}
          </span>
        </div>
      </div>
    );
  };

  // Rendu Élément Audio (utilisé dans téléchargements & listes globales)
  const renderAudioItem = (track: FileItem) => {
    const isSelected = splitSelectedFile?.id === track.id;
    const isMenuOpen = activeMenuFileId === track.id || audioMenuSongId === track.id;
    const isChecked = selectedItemIds.includes(track.id);

    return (
      <div
        key={track.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(track.id);
          } else {
            handleSelectFile(track);
          }
        }}
        className={`group flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl transition-all cursor-pointer select-none ${
          isMenuOpen ? 'z-50 relative' : 'relative z-10'
        } ${
          isChecked
            ? 'bg-amber-500/15 border border-amber-400 ring-2 ring-amber-400/40'
            : isSelected 
              ? 'bg-[#182236] border border-amber-400/60 shadow-md ring-2 ring-amber-400/40' 
              : 'hover:bg-[#121826] border border-transparent'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Checkbox en mode sélection */}
          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(track.id);
              }}
              className="p-1 text-amber-500 hover:text-amber-400 cursor-pointer shrink-0"
            >
              {isChecked ? (
                <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
              ) : (
                <Square className="w-5 h-5 text-stone-400 dark:text-slate-500" />
              )}
            </button>
          )}

          <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 relative overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
            {track.previewUrl && (
              <img src={track.previewUrl} alt={track.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
            )}
            <div className="absolute inset-0 bg-black/40" />
            <Music className="w-6 h-6 text-white stroke-[2.2] relative z-10 drop-shadow-md" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">{track.name}</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">{track.size} • {track.date}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSelected && (
            <div 
              className="flex items-end gap-1 h-5 px-1 py-0.5 shrink-0" 
              title={isAudioPlaying ? "Lecture en cours" : "En pause"}
            >
              <span className={`w-1 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-1' : ''}`} style={{ height: isAudioPlaying ? undefined : '5px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
              <span className={`w-1 rounded-full bg-amber-300 ${isAudioPlaying ? 'music-bar-2' : ''}`} style={{ height: isAudioPlaying ? undefined : '14px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
              <span className={`w-1 rounded-full bg-yellow-400 ${isAudioPlaying ? 'music-bar-3' : ''}`} style={{ height: isAudioPlaying ? undefined : '9px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
              <span className={`w-1 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-4' : ''}`} style={{ height: isAudioPlaying ? undefined : '4px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
            </div>
          )}

          {/* Bouton 3 traits */}
          <div className="relative shrink-0 studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : track.id);
                setAudioMenuSongId(isMenuOpen ? null : track.id);
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Options de la musique (3 traits)"
            >
              <Menu className="w-4 h-4 stroke-[2.2]" />
            </button>
            {renderFileOptionsMenu(track, filteredAudio, 'right')}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadFile(track); }}
            className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Télécharger"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Rendu Autre Fichier (Archive, App, etc.)
  const renderOtherFileCard = (item: FileItem) => {
    const isSelected = splitSelectedFile?.id === item.id;
    const isMenuOpen = activeMenuFileId === item.id;
    const isChecked = selectedItemIds.includes(item.id);

    return (
      <div
        key={item.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(item.id);
          } else {
            handleSelectFile(item);
          }
        }}
        className={`group bg-[#151C2C] hover:bg-[#1A2338] border rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer ${
          isMenuOpen ? 'z-50 relative' : 'relative z-10'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40'
            : isSelected ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-800 hover:border-sky-400/50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(item.id);
              }}
              className="p-1 text-amber-500 hover:text-amber-400 cursor-pointer shrink-0"
            >
              {isChecked ? (
                <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
              ) : (
                <Square className="w-5 h-5 text-slate-500" />
              )}
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-sky-400 transition-colors">{item.name}</h4>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span className="font-bold text-sky-300 uppercase">{item.extension || 'FICHIER'}</span>
              <span>•</span>
              <span>{item.size}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bouton 3 traits */}
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : item.id);
              }}
              className="w-8 h-8 rounded-xl bg-black hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/10"
              title="Options (3 traits)"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>
            {renderFileOptionsMenu(item, downloadOthers, 'right')}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadFile(item); }}
            className="w-8 h-8 rounded-xl bg-black hover:bg-sky-600 text-white flex items-center justify-center transition-colors border border-white/10"
            title="Télécharger"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDU DÉTAILLÉ DES PAGES DU DOCUMENT (FORMAT HAUTE DÉFINITION)
  // =========================================================================
  const renderDocPage1 = (file: FileItem) => {
    const docTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    return (
      <div id="doc-page-1" className="w-full space-y-6">
        {/* En-tête officiel CME & StudyCloud */}
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 1
          </span>
        </div>

        {/* Titre du chapitre */}
        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            {docTitle}
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Fascicule de Travaux Dirigés & Cours Magistral • {file.documentCategory || 'COURS'} • Chapitre 1
          </p>
        </div>

        {/* Schéma électronique AOP Inverseur Grand Format */}
        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 flex flex-col items-center justify-center">
          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
            Schéma 1 : Montage Amplificateur Inverseur de Tension (AOP Idéal en boucle fermée)
          </p>
          <svg className="w-full max-w-lg h-40" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,10 60,60 115,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
            <line x1="20" y1="23" x2="60" y2="23" stroke="#1c1917" strokeWidth="1.8" />
            <line x1="20" y1="47" x2="60" y2="47" stroke="#1c1917" strokeWidth="1.8" />
            <rect x="30" y="19" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="34" y="25" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
            <text x="64" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
            <text x="64" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
            <line x1="115" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
            <line x1="50" y1="23" x2="50" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="50" y1="7" x2="130" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="130" y1="7" x2="130" y2="35" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="80" y="3" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="86" y="9.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
            <line x1="20" y1="47" x2="20" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="14" y1="58" x2="26" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="17" y1="61" x2="23" y2="61" stroke="#1c1917" strokeWidth="1.5" />
          </svg>
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-700 mt-2 px-2">
            <span>Formule de transfert : <strong className="text-red-700">Vs = -(R2 / R1) · Ve</strong></span>
            <span>Gain en tension : <strong className="text-red-700">Av = -R2 / R1</strong></span>
          </div>
        </div>

        {/* Paragraphes explicatifs */}
        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p className="font-bold text-stone-900 text-sm">1. Définition et principe de fonctionnement :</p>
          <p>
            Un amplificateur opérationnel idéal possède un gain infini en boucle ouverte et une impédance d'entrée infinie.
            En régime linéaire avec réaction négative, la tension différentielle d'entrée <strong>ε = V+ - V-</strong> est rigoureusement nulle (masse virtuelle).
          </p>
          <p>
            Le courant traversant la résistance <strong>R1</strong> est intégralement dévié dans <strong>R2</strong> (car aucun courant ne pénètre dans l'AOP idéal, i- = 0).
            On en déduit immédiatement la relation fondamentale de sortie : <em>Vs = - (R2 / R1) · Ve</em>.
          </p>
        </div>
      </div>
    );
  };

  const renderDocPage2 = (_file: FileItem) => {
    return (
      <div id="doc-page-2" className="w-full space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 2
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            2. MONTAGE AMPLIFICATEUR NON-INVERSEUR DE TENSION
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Étude en régime linéaire avec gain strictement supérieur ou égal à 1
          </p>
        </div>

        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 flex flex-col items-center justify-center">
          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
            Schéma 2 : Montage Non-Inverseur (Signal appliqué sur l'entrée V+)
          </p>
          <svg className="w-full max-w-lg h-40" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,10 60,60 115,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
            <line x1="20" y1="47" x2="60" y2="47" stroke="#1c1917" strokeWidth="1.8" />
            <text x="12" y="50" fontSize="7" fontWeight="bold" fill="#2563eb">Ve</text>
            <text x="64" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
            <text x="64" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
            <line x1="115" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
            <line x1="45" y1="23" x2="60" y2="23" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="45" y1="23" x2="45" y2="10" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="45" y1="10" x2="125" y2="10" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="125" y1="10" x2="125" y2="35" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="75" y="6" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="81" y="12.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
            <line x1="45" y1="23" x2="45" y2="40" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="36" y="40" width="18" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="41" y="46.5" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
            <line x1="45" y1="48" x2="45" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="39" y1="58" x2="51" y2="58" stroke="#1c1917" strokeWidth="1.5" />
          </svg>
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-700 mt-2 px-2">
            <span>Formule de transfert : <strong className="text-blue-700">Vs = (1 + R2 / R1) · Ve</strong></span>
            <span>Gain en tension : <strong className="text-blue-700">Av = 1 + R2 / R1 (Av ≥ 1)</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p className="font-bold text-stone-900 text-sm">Caractéristiques essentielles :</p>
          <p>
            Le signal de sortie <strong>Vs</strong> est en phase exacte avec la tension d'entrée <strong>Ve</strong> (pas d'inversion de polarité).
            L'impédance d'entrée vue par le générateur est celle de la borne positive de l'AOP, soit une impédance virtuellement infinie (&gt; 10¹² Ω).
          </p>
          <p>
            <strong>Cas limite remarquable :</strong> Si l'on court-circuite R2 (R2 = 0) et qu'on supprime R1 (R1 → ∞), on obtient le <strong>montage suiveur (buffer)</strong> avec <em>Vs = Ve</em> et <em>Av = 1</em>.
          </p>
        </div>
      </div>
    );
  };

  const renderDocPage3 = (_file: FileItem) => {
    return (
      <div id="doc-page-3" className="w-full space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 3
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            3. MONTAGE SOMMATEUR INVERSEUR ANALOGIQUE
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Addition algébrique et pondération de multiples sources de signaux
          </p>
        </div>

        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 flex flex-col items-center justify-center">
          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
            Schéma 3 : Sommateur Inverseur à 2 voies indépendantes (V1, V2)
          </p>
          <svg className="w-full max-w-lg h-40" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="65,10 65,60 120,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
            <text x="69" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
            <text x="69" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
            <line x1="15" y1="17" x2="35" y2="17" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="25" y="13" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="29" y="19.5" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
            <text x="8" y="20" fontSize="7" fontWeight="bold" fill="#16a34a">V1</text>
            <line x1="15" y1="31" x2="35" y2="31" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="25" y="27" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="29" y="33.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
            <text x="8" y="34" fontSize="7" fontWeight="bold" fill="#16a34a">V2</text>
            <line x1="41" y1="17" x2="52" y2="24" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="41" y1="31" x2="52" y2="24" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="52" y1="24" x2="65" y2="24" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="55" y1="24" x2="55" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="55" y1="7" x2="135" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="135" y1="7" x2="135" y2="35" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="120" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
            <rect x="85" y="3" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="91" y="9.5" fontSize="6" fontWeight="bold" fill="#1c1917">Rf</text>
            <line x1="65" y1="47" x2="50" y2="47" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="50" y1="47" x2="50" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="44" y1="58" x2="56" y2="58" stroke="#1c1917" strokeWidth="1.5" />
          </svg>
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-700 mt-2 px-2">
            <span>Formule générale : <strong className="text-purple-700">Vs = - [ (Rf / R1)·V1 + (Rf / R2)·V2 ]</strong></span>
            <span>Si R1 = R2 = Rf : <strong className="text-purple-700">Vs = -(V1 + V2)</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p className="font-bold text-stone-900 text-sm">Applications industrielles et audio :</p>
          <p>
            Chaque voie d'entrée apporte un courant <em>I_k = V_k / R_k</em> vers le point de masse virtuelle.
            La somme de ces courants converge directement dans la résistance de contre-réaction <strong>Rf</strong>.
          </p>
          <p>
            Ce montage constitue la brique de base fondamentale des tables de mixage analogiques professionnelles et des convertisseurs numérique-analogique (CNA).
          </p>
        </div>
      </div>
    );
  };

  const renderDocPage4 = (_file: FileItem) => {
    return (
      <div id="doc-page-4" className="w-full space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 4
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            4. MONTAGE SOUSTRACTEUR (DIFFÉRENTIEL) & SYNTHÈSE DES FORMULES
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Amplificateur d'instrumentation élémentaire et récapitulatif
          </p>
        </div>

        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 space-y-3">
          <p className="text-[11px] font-black text-stone-700">
            Tableau récapitulatif des montages linéaires à AOP :
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-stone-300">
              <thead className="bg-stone-200 text-stone-800 font-bold">
                <tr>
                  <th className="p-2 border border-stone-300">Montage</th>
                  <th className="p-2 border border-stone-300">Formule de Sortie (Vs)</th>
                  <th className="p-2 border border-stone-300">Impédance d'entrée</th>
                  <th className="p-2 border border-stone-300">Déphasage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-700">
                <tr>
                  <td className="p-2 font-bold">Inverseur</td>
                  <td className="p-2 text-red-700 font-bold">Vs = -(R2/R1)·Ve</td>
                  <td className="p-2">R1</td>
                  <td className="p-2">180° (Inversé)</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold">Non-Inverseur</td>
                  <td className="p-2 text-blue-700 font-bold">Vs = (1 + R2/R1)·Ve</td>
                  <td className="p-2">Infinie (∞)</td>
                  <td className="p-2">0° (En phase)</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold">Suiveur</td>
                  <td className="p-2 text-emerald-700 font-bold">Vs = Ve</td>
                  <td className="p-2">Infinie (∞)</td>
                  <td className="p-2">0° (En phase)</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold">Différentiel</td>
                  <td className="p-2 text-purple-700 font-bold">Vs = (R2/R1)·(V2 - V1)</td>
                  <td className="p-2">R1 + R3</td>
                  <td className="p-2">Selon entrées</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1.5 text-xs text-emerald-950">
          <p className="font-black text-emerald-900">Exercice d'application résolu :</p>
          <p>
            Soit un montage amplificateur inverseur avec <strong>R1 = 10 kΩ</strong> et <strong>R2 = 47 kΩ</strong>.
            Pour une tension d'entrée <em>Ve = +200 mV</em>, déterminez le gain et la tension de sortie :
          </p>
          <p className="font-bold text-emerald-800">
            • Gain en tension : Av = - (47 / 10) = -4,7<br />
            • Tension de sortie : Vs = -4,7 × (+200 mV) = -940 mV = -0,94 V.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between text-[10px] text-stone-500 font-bold border-t border-stone-200">
          <span>Certifié conforme CME • Espace Numérique StudyCloud</span>
          <span>Fin du document • 4 / 4 pages</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`transition-colors duration-300 bg-[#F4F6F8] dark:bg-[#0C111D] text-stone-900 dark:text-slate-100 flex flex-col overflow-y-auto selection:bg-blue-600 selection:text-white ${
      isFullscreen
        ? 'fixed inset-0 z-50 w-screen h-screen'
        : 'absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-[calc(100vh-66px)]'
    }`}>
      
      {/* Input de sélection de fichier caché */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        multiple
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* SI UN SOUS-MENU EST OUVERT : NAVIGATION & AFFICHAGE                       */}
      {/* ========================================================================= */}
      {currentSubView ? (
        <div className="flex-1 flex flex-col w-full animate-in fade-in duration-200 min-h-screen">
          
          {/* EN-TÊTE DU SOUS-MENU */}
          <div className={`sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-300/70 dark:border-slate-800/60 shadow-xs ${
            isViewerMaximized ? 'hidden' : ''
          }`}>
            <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
              
              {/* GAUCHE : Bouton Retour et Titre */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentSubView(null);
                    setSubSearchQuery('');
                    setSplitSelectedFile(null);
                  }}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
                  title="Retour au gestionnaire de fichiers"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                  <span className="hidden xs:inline">Retour</span>
                </button>

                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-xl bg-black border border-white/10 ${currentSubView.color}`}>
                    <currentSubView.icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 dark:text-white leading-tight">
                      {currentSubView.name}
                    </h1>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 dark:text-slate-400 leading-tight">
                      StudyCloud
                    </p>
                  </div>
                </div>
              </div>

              {/* MILIEU : Champ de recherche */}
              <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
                <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
                  <div className="text-white shrink-0">
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
                  </div>
                  <input
                    type="text"
                    value={subSearchQuery}
                    onChange={(e) => setSubSearchQuery(e.target.value)}
                    placeholder={`Rechercher dans ${currentSubView.name}...`}
                    className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  {subSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSubSearchQuery('')}
                      className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Effacer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* DROITE : Bouton Espace d'étude, Plein écran général & Bouton 3 traits d'en-tête */}
              <div className="shrink-0 flex items-center gap-2">
                {/* BOUTON ESPACE D'ÉTUDE DEVANT LE BOUTON ZOOM */}
                <button
                  type="button"
                  onClick={() => handleOpenStudySpaceForCurrentMenu(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs font-black group"
                  title="Ouvrir l'Espace d'étude"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">Espace d'étude</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                  ) : (
                    <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                  )}
                </button>

                {/* Bouton 3 traits d'en-tête derrière le bouton zoom (Image 1) */}
                <div className="relative studycloud-menu-trigger">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHeaderMenuOpen(!isHeaderMenuOpen);
                    }}
                    className={`flex items-center justify-center w-9 h-9 rounded-full ${
                      isHeaderMenuOpen ? 'bg-amber-500/20 text-amber-400 border-amber-400/40' : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
                    } border transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm`}
                    title="Options d'affichage et de tri (3 traits)"
                  >
                    <Menu className="w-4 h-4 stroke-[2.2]" />
                  </button>

                  {renderHeaderOptionsMenu()}
                </div>
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* ZONE PRINCIPALE : VUE DIVISÉE EN DEUX (SPLIT SCREEN) OU PLEINE LARGEUR    */}
          {/* ========================================================================= */}
          <div className={`flex-1 flex flex-col md:flex-row w-full overflow-hidden relative ${
            isViewerMaximized ? 'min-h-[calc(100vh-68px)] h-[calc(100vh-68px)]' : 'min-h-[calc(100vh-120px)]'
          }`}>
            
            {/* --------------------------------------------------------------------- */}
            {/* PANNEAU DE GAUCHE : LE RESTE DES FICHIERS                            */}
            {/* Si un élément est sélectionné, prend 50% de l'écran avec scroll       */}
            {/* --------------------------------------------------------------------- */}
            <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
              isViewerMaximized 
                ? 'hidden' 
                : (currentSubView.id === 'studycloud-category-audio' || splitSelectedFile?.category === 'audio')
                  ? `${isMobilePlayerOpen ? 'hidden md:block' : 'w-full'} md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80`
                  : splitSelectedFile 
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-4/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80' 
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
            }`}>

              {/* 1. DOCUMENTS (IMAGE 1) */}
              {currentSubView.id === 'studycloud-category-documents' && (
                <div className="space-y-3 sm:space-y-4">
                  {/* Compteur */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} publié{filteredDocuments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredDocuments)}

                  {/* Grille : conserve sa taille compacte même en mode divisé */}
                  <div className={`grid gap-2.5 sm:gap-3.5 ${
                    splitSelectedFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {filteredDocuments.map(doc => renderDocumentCard(doc))}
                  </div>
                </div>
              )}

              {/* 2. IMAGES (IMAGE 2) */}
              {currentSubView.id === 'studycloud-category-images' && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} disponible{filteredImages.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredImages)}

                  <div className={`grid gap-2 sm:gap-3 ${
                    splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {filteredImages.map((img, idx) => renderImageCard(img, idx))}
                  </div>
                </div>
              )}

              {/* 3. VIDÉOS (IMAGE 3) */}
              {currentSubView.id === 'studycloud-category-videos' && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredVideos)}

                  <div className={`grid gap-2 sm:gap-3 ${
                    splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {filteredVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                  </div>
                </div>
              )}

              {/* 4. AUDIO / MUSIQUE (LISTE SÉPARÉE VERTICALEMENT SUR LE FOND DE PAGE AVEC DÉTAILS, BOUTON PAUSE ET ACTIONS 3 TRAITS) */}
              {currentSubView.id === 'studycloud-category-audio' && (
                <div className="w-full space-y-3">
                  {/* En-tête de la liste */}
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-amber-500 dark:text-amber-400 stroke-[2.2]" />
                      <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white tracking-wide">
                        Tous les sons ({filteredAudio.length})
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                      StudyCloud Audio
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredAudio)}

                  {/* Liste des pistes : Séparées verticalement sur le fond de page avec détails et espace entre elles */}
                  <div className="space-y-2">
                    {filteredAudio.map((track) => {
                      const isSelected = splitSelectedFile?.id === track.id;
                      const isChecked = selectedItemIds.includes(track.id);
                      const isMenuOpen = activeMenuFileId === track.id || audioMenuSongId === track.id;

                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleItemSelection(track.id);
                            } else {
                              handleSelectFile(track);
                              setIsMobilePlayerOpen(true);
                            }
                          }}
                          className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none border ${
                            isMenuOpen ? 'z-50 relative' : 'relative z-10'
                          } ${
                            isChecked
                              ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
                              : isSelected 
                                ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-400/30' 
                                : 'bg-white dark:bg-slate-900/80 border-stone-200/90 dark:border-slate-800 hover:border-amber-400/60 hover:shadow-md'
                          }`}
                        >
                          {/* Case à cocher en mode sélection */}
                          {isSelectionMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemSelection(track.id);
                              }}
                              className="p-1 text-amber-500 hover:text-amber-600 cursor-pointer shrink-0"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
                              ) : (
                                <Square className="w-5 h-5 text-stone-400 dark:text-slate-500" />
                              )}
                            </button>
                          )}

                          {/* Gauche : Vignette album carrée + Titre + Artiste + Détails */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-900 border border-stone-200 dark:border-white/10 relative shadow-sm">
                              {track.previewUrl ? (
                                <img 
                                  src={track.previewUrl} 
                                  alt={track.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-amber-600 via-stone-900 to-black flex items-center justify-center">
                                  <Music className="w-5 h-5 text-amber-300" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                                isSelected ? 'text-amber-600 dark:text-amber-300 font-black' : 'text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors'
                              }`}>
                                {track.name}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                {track.artist || track.source}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-400 dark:text-slate-500 font-medium">
                                <span>{track.size}</span>
                                <span>•</span>
                                <span>{formatTime(track.durationSec || 0)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Droite : Bouton Play/Pause + Bâtons animés + Date + Bouton 3 traits */}
                          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                            {/* Si morceau sélectionné : bâtons animés ET bouton Play/Pause juste à côté */}
                            {isSelected && (
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Les 4 bâtons qui bougent quand la musique chante, et s'arrêtent en pause */}
                                <div 
                                  className="flex items-end gap-1 h-5 px-1 py-0.5 shrink-0" 
                                  title={isAudioPlaying ? "Lecture en cours" : "En pause"}
                                >
                                  <span 
                                    className={`w-1 rounded-full bg-amber-500 dark:bg-amber-400 ${isAudioPlaying ? 'music-bar-1' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '5px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                  <span 
                                    className={`w-1 rounded-full bg-amber-400 dark:bg-amber-300 ${isAudioPlaying ? 'music-bar-2' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '14px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                  <span 
                                    className={`w-1 rounded-full bg-yellow-500 dark:bg-yellow-400 ${isAudioPlaying ? 'music-bar-3' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '9px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                  <span 
                                    className={`w-1 rounded-full bg-amber-500 dark:bg-amber-400 ${isAudioPlaying ? 'music-bar-4' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '4px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                </div>

                                {/* BOUTON POUR METTRE PAUSE / PLAY A CÔTÉ DU BÂTON QUI BOUGE */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAudioPlaying(!isAudioPlaying);
                                  }}
                                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
                                  title={isAudioPlaying ? "Mettre en pause" : "Reprendre la lecture"}
                                >
                                  {isAudioPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Si morceau non sélectionné : bouton lecture directe au survol */}
                            {!isSelected && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectFile(track);
                                  setIsAudioPlaying(true);
                                  setIsMobilePlayerOpen(true);
                                }}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Lire ce son"
                              >
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </button>
                            )}

                            {/* Date */}
                            <span className="text-xs font-semibold text-stone-400 dark:text-slate-400 shrink-0 hidden sm:inline-block">
                              {track.date}
                            </span>

                            {/* Bouton 3 traits sur chaque musique avec toutes les propositions */}
                            <div className="relative shrink-0 studycloud-menu-trigger">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuFileId(activeMenuFileId === track.id ? null : track.id);
                                  setAudioMenuSongId(audioMenuSongId === track.id ? null : track.id);
                                }}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                                title="Options de la musique (3 traits)"
                              >
                                <Menu className="w-4 h-4 stroke-[2.2]" />
                              </button>

                              {renderFileOptionsMenu(track, filteredAudio, 'right')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. TÉLÉCHARGEMENTS */}
              {currentSubView.id === 'studycloud-category-downloads' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredDownloads.map(toFileItem))}

                  {filteredDownloads.length === 0 ? (
                    <div className="py-16 text-center text-stone-500 dark:text-slate-400">
                      <Download className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5]" />
                      <p className="text-sm font-semibold">Aucun fichier téléchargé</p>
                      <p className="text-xs opacity-70 mt-1">Les fichiers téléchargés s'afficheront ici avec leur vue dédiée.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Documents téléchargés */}
                      {downloadDocs.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Documents ({downloadDocs.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2.5 sm:gap-3.5 ${
                            splitSelectedFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadDocs.map(doc => renderDocumentCard(doc))}
                          </div>
                        </div>
                      )}

                      {/* Images téléchargées */}
                      {downloadImages.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Images ({downloadImages.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2 sm:gap-3 ${
                            splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadImages.map((img, idx) => renderImageCard(img, idx))}
                          </div>
                        </div>
                      )}

                      {/* Vidéos téléchargées */}
                      {downloadVideos.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Film className="w-4 h-4 text-purple-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Vidéos ({downloadVideos.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2 sm:gap-3 ${
                            splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                          </div>
                        </div>
                      )}

                      {/* Audio téléchargé (Carré comme pour les vidéos, logo musique au centre, bouton 3 traits) */}
                      {downloadAudio.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-amber-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Fichiers Audio ({downloadAudio.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2 sm:gap-3 ${
                            splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadAudio.map((aud, idx) => renderAudioSquareCard(aud, idx))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 6. APPLICATIONS : "Ce menu n'est pas disponible pour le moment." */}
              {currentSubView.id === 'studycloud-category-apps' && (
                <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none min-h-[60vh]">
                  <div className="w-full max-w-md mx-auto p-8 rounded-3xl border border-stone-300/80 dark:border-white/10 bg-[#04060A] text-white shadow-2xl flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 rounded-2xl bg-black border border-pink-500/30 text-pink-400 shadow-lg">
                      <LayoutGrid className="w-12 h-12 stroke-[1.8]" />
                    </div>
                    <div className="space-y-2">
                      <div className="inline-block px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[11px] font-black uppercase tracking-wider mb-1">
                        Information
                      </div>
                      <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight leading-snug">
                        Ce menu n'est pas disponible pour le moment.
                      </h2>
                      <p className="text-xs sm:text-sm font-medium text-slate-400 max-w-xs leading-relaxed mx-auto">
                        Le catalogue et gestionnaire des applications StudyCloud sera activé lors d'une prochaine mise à jour.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentSubView(null)}
                      className="mt-2 px-6 py-2.5 rounded-full bg-[#151C2C] hover:bg-[#1E293B] text-white font-bold text-xs border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                      Retour aux catégories
                    </button>
                  </div>
                </div>
              )}

              {/* 7. DOSSIER SÉCURISÉ (COLLECTION) */}
              {currentSubView.id === 'studycloud-collection-secure-folder' && (
                <div className="space-y-4">
                  {/* En-tête sécurisé */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                        <Lock className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white">
                          Dossier Sécurisé StudyCloud
                        </h2>
                        <p className="text-xs text-stone-500 dark:text-slate-400">
                          {filteredSecureFiles.length} fichier{filteredSecureFiles.length > 1 ? 's' : ''} protégé{filteredSecureFiles.length > 1 ? 's' : ''} par coffre-fort crypté.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredSecureFiles)}

                  {filteredSecureFiles.length === 0 ? (
                    <div className="py-16 text-center text-stone-500 dark:text-slate-400">
                      <Lock className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                      <p className="text-sm font-semibold">Le dossier sécurisé est vide</p>
                      <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                        Pour sécuriser un fichier, ouvrez le menu 3 traits sur un document, une photo, une vidéo ou une musique et choisissez "Transporter vers le dossier sécurisé".
                      </p>
                    </div>
                  ) : (
                    <div className={`grid gap-2.5 sm:gap-3.5 ${
                      splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredSecureFiles.map((file, idx) => {
                        if (file.category === 'images') return renderImageCard(file, idx);
                        if (file.category === 'videos') return renderVideoCard(file, idx);
                        if (file.category === 'audio') return renderAudioItem(file, false);
                        return renderDocumentCard(file);
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* --------------------------------------------------------------------- */}
            {/* PANNEAU DE DROITE : L'ÉLÉMENT SÉLECTIONNÉ AFFICHÉ BIEN GRAND         */}
            {/* Avec barre de boutons supérieurs (zoom, agrandir, fermer, nav...)     */}
            {/* --------------------------------------------------------------------- */}
            {splitSelectedFile && (
              <div className={`transition-all duration-300 flex flex-col bg-[#04060A] ${
                isViewerMaximized 
                  ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                  : (currentSubView.id === 'studycloud-category-audio' || splitSelectedFile?.category === 'audio')
                    ? `${isMobilePlayerOpen ? 'flex w-full min-h-[calc(100vh-120px)]' : 'hidden md:flex'} md:w-7/12 lg:w-7/12 xl:w-7/12 border-t md:border-t-0 md:border-l border-white/10`
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-8/12 min-h-[500px] border-t md:border-t-0 md:border-l border-white/10'
              }`}>
                
                {/* BARRE SUPÉRIEURE DE BOUTONS DU LECTEUR GRAND FORMAT (Images 2 et 3) */}
                <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
                  
                  {/* GAUCHE : Flèches de navigation < > et titre */}
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleNavigateSplit('prev')}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Élément précédent"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateSplit('next')}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Élément suivant"
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                    </button>

                    <div className="min-w-0 ml-1">
                      <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={splitSelectedFile.name}>
                        {splitSelectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">
                        {splitSelectedFile.size} • {splitSelectedFile.source}
                      </p>
                    </div>
                  </div>

                  {/* DROITE : PETITS BOUTONS D'ACTIONS (Zoom, Rotation, Partage, Agrandir, Fermer) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
                    
                    {/* Zoom & Rotation (pour images et documents) - PLACÉS DEVANT */}
                    {(splitSelectedFile.category === 'images' || splitSelectedFile.isImage || splitSelectedFile.category === 'documents') && (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewerZoom(prev => Math.max(0.5, prev - 0.25))}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          title="Zoom arrière (-)"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewerZoom(prev => Math.min(3, prev + 0.25))}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          title="Zoom avant (+)"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewerRotation(prev => (prev + 90) % 360)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          title="Faire pivoter"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* Choix mode Vertical ou Horizontal (Pour les documents) */}
                    {splitSelectedFile.category === 'documents' && (
                      <button
                        type="button"
                        onClick={() => setDocLayoutMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
                        className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-full flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm text-xs font-bold ${
                          docLayoutMode === 'vertical'
                            ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 hover:bg-blue-600/50'
                            : 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/50'
                        }`}
                        title={docLayoutMode === 'vertical' ? "Mode actuel : Vertical (cliquer pour Horizontal)" : "Mode actuel : Horizontal (cliquer pour Vertical)"}
                      >
                        {docLayoutMode === 'vertical' ? (
                          <>
                            <SlidersHorizontal className="w-3.5 h-3.5 rotate-90 text-blue-400" />
                            <span className="text-[11px] font-bold">Vertical</span>
                          </>
                        ) : (
                          <>
                            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] font-bold">Horizontal</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Pagination intégrée sur l'en-tête (derrière les boutons zoom) */}
                    {splitSelectedFile.category === 'documents' && (
                      <div className="flex items-center gap-0.5 sm:gap-1 bg-[#121826] border border-white/15 rounded-full px-1.5 py-0.5 sm:h-8 text-xs text-white shadow-inner">
                        <button
                          type="button"
                          disabled={docCurrentPage <= 1}
                          onClick={() => {
                            const newPage = Math.max(1, docCurrentPage - 1);
                            setDocCurrentPage(newPage);
                            if (docLayoutMode === 'vertical') {
                              document.getElementById(`doc-page-${newPage}`)?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="w-6 h-6 rounded-full bg-black/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer"
                          title="Page précédente (Précédent)"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.2]" />
                        </button>
                        <span className="px-1.5 text-[11px] font-black text-blue-300 whitespace-nowrap">
                          {docCurrentPage} / {totalDocPages}
                        </span>
                        <button
                          type="button"
                          disabled={docCurrentPage >= totalDocPages}
                          onClick={() => {
                            const newPage = Math.min(totalDocPages, docCurrentPage + 1);
                            setDocCurrentPage(newPage);
                            if (docLayoutMode === 'vertical') {
                              document.getElementById(`doc-page-${newPage}`)?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="w-6 h-6 rounded-full bg-black/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer"
                          title="Page suivante (Suivant)"
                        >
                          <ChevronRight className="w-3.5 h-3.5 stroke-[2.2]" />
                        </button>
                      </div>
                    )}

                    {/* Partager */}
                    <button
                      type="button"
                      onClick={() => handleShareFile(splitSelectedFile)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Partager le fichier"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Télécharger */}
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(splitSelectedFile)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* BOUTON ESPACE D'ÉTUDE DEVANT LE BOUTON ZOOM / OPTIONS */}
                    <button
                      type="button"
                      onClick={() => handleOpenStudySpaceForCurrentMenu(true)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                      title="Ouvrir dans l'Espace d'étude"
                    >
                      <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>

                    {/* BOUTON 3 TRAITS D'OPTIONS AUDIO OU AGRANDIR POUR AUTRES FORMATS */}
                    {splitSelectedFile.category === 'audio' ? (
                      <div className="relative studycloud-menu-trigger">
                        <button
                          type="button"
                          onClick={() => setIsPlayerMenuOpen(!isPlayerMenuOpen)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Options de lecture (3 traits)"
                        >
                          <Menu className="w-4 h-4 stroke-[2.2]" />
                        </button>

                        {isPlayerMenuOpen && (
                          <div 
                            className="studycloud-file-menu-panel absolute right-0 top-9 z-50 w-52 bg-[#0D1527] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs text-white divide-y divide-white/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                              <button 
                                type="button" 
                                onClick={() => { handleDownloadFile(splitSelectedFile); setIsPlayerMenuOpen(false); }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Download className="w-4 h-4 text-blue-400" /> Télécharger ce son
                              </button>
                              <button 
                                type="button" 
                                onClick={() => { handleShareFile(splitSelectedFile); setIsPlayerMenuOpen(false); }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Share2 className="w-4 h-4 text-emerald-400" /> Partager
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  const url = `${window.location.origin}/share/audio/${splitSelectedFile.id}`;
                                  navigator.clipboard?.writeText(url);
                                  showToast("Lien copié dans le presse-papiers !");
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Link className="w-4 h-4 text-purple-400" /> Créer un lien
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  handleGenericFileAction('secure_folder', splitSelectedFile, audioList);
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer text-amber-300"
                              >
                                <Lock className="w-4 h-4 text-amber-400" /> Transporter vers le dossier sécurisé
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  toggleAudioRepeat();
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Repeat className="w-4 h-4 text-amber-400" />
                                <span>{isAudioRepeat === 'one' ? "Désactiver la boucle" : "Lire en boucle"}</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setIsAudioShuffle(!isAudioShuffle);
                                  showToast(!isAudioShuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée");
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Shuffle className="w-4 h-4 text-amber-400" />
                                <span>{isAudioShuffle ? "Désactiver mode aléatoire" : "Mode aléatoire"}</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  handleDeleteAudio(splitSelectedFile);
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-rose-950/40 text-rose-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" /> Supprimer ce son
                              </button>
                            </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsViewerMaximized(!isViewerMaximized)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                          isViewerMaximized 
                            ? 'bg-blue-600 text-white border-blue-400' 
                            : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
                        }`}
                        title={isViewerMaximized ? "Réduire la vue" : "Agrandir dans l'espace"}
                      >
                        {isViewerMaximized ? (
                          <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                        )}
                      </button>
                    )}

                    {/* BOUTON POUR FERMER CETTE VUE - DEMANDÉ PAR L'UTILISATEUR */}
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSubView.id === 'studycloud-category-audio') {
                          setIsMobilePlayerOpen(false);
                          setIsAudioPlaying(false);
                        } else {
                          setSplitSelectedFile(null);
                          setIsViewerMaximized(false);
                        }
                      }}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95 ${
                        currentSubView.id === 'studycloud-category-audio' ? 'md:hidden' : ''
                      }`}
                      title="Fermer la vue grand format"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>

                  </div>

                </div>

                {/* CORPS DU LECTEUR GRAND FORMAT SELON LE TYPE DE MÉDIA (Prend tout l'espace disponible) */}
                <div className={`flex-1 w-full h-full flex flex-col items-center justify-center ${splitSelectedFile.category === 'documents' ? 'p-0 overflow-hidden bg-white' : 'p-1 sm:p-2 sm:px-4 overflow-hidden'} relative`}>

                  {/* 1. LECTEUR IMAGE GRAND FORMAT (Prend tout l'espace avec Zoom & Rotation) */}
                  {(splitSelectedFile.category === 'images' || splitSelectedFile.isImage) && (
                    <div className="w-full h-full flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-black/80 border border-white/10 p-1 sm:p-2 shadow-2xl">
                      <div 
                        className="transition-transform duration-200 flex items-center justify-center w-full h-full"
                        style={{
                          transform: `scale(${viewerZoom}) rotate(${viewerRotation}deg)`
                        }}
                      >
                        <img
                          src={splitSelectedFile.previewUrl || (splitSelectedFile as any).url}
                          alt={splitSelectedFile.name}
                          className={`w-full h-full object-contain rounded-xl shadow-2xl select-none transition-all ${
                            isViewerMaximized 
                              ? 'max-h-[calc(100vh-125px)]' 
                              : 'max-h-[calc(100vh-180px)]'
                          }`}
                        />
                      </div>
                      <div className="absolute bottom-3 left-4 bg-black/80 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] text-slate-300 font-bold border border-white/10">
                        Zoom : {Math.round(viewerZoom * 100)}% {viewerRotation > 0 && `• ${viewerRotation}°`}
                      </div>
                    </div>
                  )}

                  {/* 2. LECTEUR VIDÉO GRAND FORMAT INTERACTIF (Prend tout l'espace de l'écran, tout format vidéo) */}
                  {splitSelectedFile.category === 'videos' && (
                    <div className="w-full h-full flex-1 flex items-center justify-center relative p-1 sm:p-2 overflow-hidden bg-black/80 rounded-2xl border border-white/10 shadow-2xl">
                      <video
                        ref={videoRef}
                        src={splitSelectedFile.videoUrl || (splitSelectedFile as any).url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
                        poster={splitSelectedFile.previewUrl}
                        className={`w-full h-full object-contain rounded-xl select-none bg-black transition-all ${
                          isViewerMaximized 
                            ? 'max-h-[calc(100vh-125px)]' 
                            : 'max-h-[calc(100vh-180px)]'
                        }`}
                        controls
                        autoPlay
                        loop
                        playsInline
                      />
                    </div>
                  )}

                  {/* 3. LECTEUR AUDIO GRAND FORMAT INTERACTIF (IMAGE 2 : LECTEUR MUSICAL DESIGN PREMIUM) */}
                  {splitSelectedFile.category === 'audio' && (
                    <div className="relative w-full h-full flex-1 flex flex-col justify-between p-3 sm:p-6 md:p-8 bg-[#090D1A] text-white overflow-hidden select-none rounded-2xl">
                      
                      {/* Élément audio HTML5 natif invisible pour la lecture réelle */}
                      <audio
                        ref={audioRef}
                        src={splitSelectedFile.audioUrl || (splitSelectedFile as any).url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'}
                        autoPlay={isAudioPlaying}
                        loop={isAudioRepeat === 'one'}
                        onEnded={() => {
                          if (isAudioRepeat === 'one') {
                            if (audioRef.current) {
                              audioRef.current.currentTime = 0;
                              audioRef.current.play().catch(() => {});
                            }
                            setAudioCurrentTime(0);
                          } else {
                            handleAudioNext();
                          }
                        }}
                        onTimeUpdate={() => {
                          if (audioRef.current && isAudioPlaying) {
                            setAudioCurrentTime(Math.floor(audioRef.current.currentTime));
                            if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                              setAudioDuration(Math.floor(audioRef.current.duration));
                            }
                          }
                        }}
                      />

                      {/* Halo lumineux d'ambiance dorée / ambrée chaleureuse (Image 2) */}
                      <div 
                        className="absolute inset-0 pointer-events-none opacity-35"
                        style={{
                          background: 'radial-gradient(circle at 45% 30%, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.18) 40%, transparent 75%)'
                        }}
                      />

                      {/* Bouton retour mobile (< md) : Permet de revenir à la liste sur téléphone */}
                      <div className="md:hidden flex items-center justify-between pb-2 relative z-10 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsMobilePlayerOpen(false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-md border border-white/15 transition-all active:scale-95 cursor-pointer shadow-sm"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                          <span>Retour à la liste</span>
                        </button>
                        <span className="text-[11px] font-bold text-amber-300">En cours de lecture</span>
                      </div>

                      {/* PARTIE SUPÉRIEURE : Pochette album centrée (paroles supprimées comme entouré en rouge) */}
                      <div className="relative z-10 w-full flex items-center justify-center max-w-sm mx-auto my-auto pt-2 sm:pt-4">
                        <div className="relative w-44 sm:w-56 md:w-64 aspect-square rounded-2xl overflow-hidden shrink-0 shadow-[0_20px_45px_rgba(0,0,0,0.85)] border border-white/20 bg-black group">
                          {splitSelectedFile.previewUrl ? (
                            <img 
                              src={splitSelectedFile.previewUrl} 
                              alt={splitSelectedFile.name} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-600 via-stone-900 to-black flex items-center justify-center">
                              <Music className="w-14 h-14 text-amber-300" />
                            </div>
                          )}

                          {/* Badge Parental Advisory */}
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/85 border border-white/25 rounded text-[7px] font-black uppercase tracking-wider text-white">
                            Parental Advisory
                          </div>
                        </div>
                      </div>

                      {/* MILIEU : Titre et Artiste (Image 2) */}
                      <div className="relative z-10 w-full text-center space-y-1 my-2 sm:my-3">
                        <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md truncate px-2">
                          {splitSelectedFile.name}
                        </h2>
                        <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate px-2">
                          {splitSelectedFile.artist || splitSelectedFile.source || 'Dave & Tems'}
                        </p>
                      </div>

                      {/* SECTION TEMPORELLE : -10s, Pillule de temps 0:11 / 3:39, +10s et Barre de progression (Image 2) */}
                      <div className="relative z-10 w-full max-w-md mx-auto space-y-1.5 py-1">
                        {/* Ligne avec boutons -10, Badge temps au centre, et +10 */}
                        <div className="flex items-center justify-between px-3">
                          {/* Bouton -10s fonctionnel */}
                          <button
                            type="button"
                            onClick={() => handleSeekDelta(-10)}
                            className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
                            title="Reculer de 10s"
                          >
                            <RotateCcw className="w-5 h-5 stroke-[2]" />
                            <span className="absolute text-[8px] font-black text-white">10</span>
                          </button>

                          {/* Pillule blanche avec temps exact (ex: 0:11 / 3:39) */}
                          <div className="px-3.5 py-1 rounded-full bg-white text-stone-950 font-black text-xs shadow-md tracking-wider">
                            {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                          </div>

                          {/* Bouton +10s fonctionnel */}
                          <button
                            type="button"
                            onClick={() => handleSeekDelta(10)}
                            className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
                            title="Avancer de 10s"
                          >
                            <RotateCw className="w-5 h-5 stroke-[2]" />
                            <span className="absolute text-[8px] font-black text-white">10</span>
                          </button>
                        </div>

                        {/* Slider interactif */}
                        <div className="w-full px-2">
                          <input
                            type="range"
                            min="0"
                            max={audioDuration || 1}
                            value={audioCurrentTime}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAudioCurrentTime(val);
                              if (audioRef.current) audioRef.current.currentTime = val;
                            }}
                            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-amber-400 transition-all"
                          />
                        </div>
                      </div>

                      {/* CONTRÔLES PRINCIPAUX : Aléatoire, Précédent, Grand Bouton Rond Blanc Play/Pause, Suivant, Répéter (Image 2) */}
                      <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between px-2 pt-1 pb-2 sm:pb-3">
                        {/* Lecture Aléatoire (Shuffle fonctionnel) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAudioShuffle(!isAudioShuffle);
                            showToast(!isAudioShuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée");
                          }}
                          className={`p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ${
                            isAudioShuffle ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
                          }`}
                          title={isAudioShuffle ? "Désactiver mode aléatoire" : "Mode aléatoire"}
                        >
                          <Shuffle className="w-5 h-5" />
                        </button>

                        {/* Morceau précédent */}
                        <button
                          type="button"
                          onClick={handleAudioPrev}
                          className="p-2 rounded-full hover:bg-white/10 text-white hover:scale-110 active:scale-90 transition-all cursor-pointer"
                          title="Son précédent"
                        >
                          <SkipBack className="w-6 h-6 fill-white" />
                        </button>

                        {/* GRAND BOUTON ROND BLANC PLAY / PAUSE (Image 2) */}
                        <button
                          type="button"
                          onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                          className="w-16 h-16 rounded-full bg-white text-stone-950 flex items-center justify-center shadow-[0_6px_25px_rgba(255,255,255,0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          title={isAudioPlaying ? "Mettre en pause" : "Lancer la lecture"}
                        >
                          {isAudioPlaying ? (
                            <Pause className="w-7 h-7 fill-stone-950 stroke-stone-950" />
                          ) : (
                            <Play className="w-7 h-7 fill-stone-950 stroke-stone-950 translate-x-0.5" />
                          )}
                        </button>

                        {/* Morceau suivant */}
                        <button
                          type="button"
                          onClick={handleAudioNext}
                          className="p-2 rounded-full hover:bg-white/10 text-white hover:scale-110 active:scale-90 transition-all cursor-pointer"
                          title="Son suivant"
                        >
                          <SkipForward className="w-6 h-6 fill-white" />
                        </button>

                        {/* Répéter en boucle (Boucle continue fonctionnelle) */}
                        <button
                          type="button"
                          onClick={toggleAudioRepeat}
                          className={`relative p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ${
                            isAudioRepeat !== 'off' ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
                          }`}
                          title={isAudioRepeat !== 'off' ? "Désactiver la boucle" : "Lire en boucle (reprend seul)"}
                        >
                          <Repeat className="w-5 h-5" />
                          {isAudioRepeat === 'one' && (
                            <span className="absolute bottom-1 right-1 text-[8px] font-black text-amber-400">1</span>
                          )}
                        </button>
                      </div>

                      {/* Modal Paroles Complètes si activé */}
                      {showLyricsModal && (
                        <div className="absolute inset-0 z-40 bg-[#070B16]/95 backdrop-blur-xl p-5 sm:p-6 flex flex-col justify-between animate-in fade-in duration-200">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                              <h3 className="text-sm sm:text-base font-black text-white">{splitSelectedFile.name}</h3>
                              <p className="text-xs text-amber-300 font-semibold">{splitSelectedFile.artist || 'Paroles complètes'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowLyricsModal(false)}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto py-6 space-y-4 text-center">
                            {(splitSelectedFile.fullLyrics || [
                              "And really when I think of it",
                              "Growing up, I didn't ever see marriages",
                              "No weddings, no horse, no carriages",
                              "I wanna do things different and right",
                              "Pray for me through the day and the night",
                              "When the rain falls on our souls",
                              "We will dance and we will heal..."
                            ]).map((line, idx) => (
                              <p key={idx} className={`text-sm sm:text-base font-bold leading-relaxed ${idx === 0 ? 'text-amber-300 scale-105 font-black' : 'text-white/70'}`}>
                                {line}
                              </p>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowLyricsModal(false)}
                            className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                          >
                            Fermer les paroles
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 4. LECTEUR DOCUMENT GRAND FORMAT (Prend tout l'espace disponible, sans bandes noires ni creux) */}
                  {splitSelectedFile.category === 'documents' && (
                    <div className="w-full h-full flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-white text-stone-900 select-text">
                      <div 
                        className="w-full flex-1 flex flex-col p-4 sm:p-8 md:p-10 pb-36 transition-transform duration-200"
                        style={{
                          transform: viewerZoom !== 1 ? `scale(${viewerZoom})` : undefined,
                          transformOrigin: 'top center'
                        }}
                      >
                        {docLayoutMode === 'vertical' ? (
                          <div className="w-full space-y-10">
                            {renderDocPage1(splitSelectedFile)}
                            
                            <div className="w-full flex items-center gap-3 py-3 text-stone-400 select-none">
                              <div className="flex-1 h-px bg-stone-300" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                                Page 2 sur 4
                              </span>
                              <div className="flex-1 h-px bg-stone-300" />
                            </div>

                            {renderDocPage2(splitSelectedFile)}

                            <div className="w-full flex items-center gap-3 py-3 text-stone-400 select-none">
                              <div className="flex-1 h-px bg-stone-300" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                                Page 3 sur 4
                              </span>
                              <div className="flex-1 h-px bg-stone-300" />
                            </div>

                            {renderDocPage3(splitSelectedFile)}

                            <div className="w-full flex items-center gap-3 py-3 text-stone-400 select-none">
                              <div className="flex-1 h-px bg-stone-300" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                                Page 4 sur 4
                              </span>
                              <div className="flex-1 h-px bg-stone-300" />
                            </div>

                            {renderDocPage4(splitSelectedFile)}
                          </div>
                        ) : (
                          <div 
                            className={`w-full flex-1 overflow-x-hidden relative ${isDocDragging ? 'select-none cursor-grabbing' : 'cursor-grab'}`}
                            onTouchStart={handleDocTouchStart}
                            onTouchMove={handleDocTouchMove}
                            onTouchEnd={handleDocTouchEnd}
                            onTouchCancel={handleDocTouchEnd}
                            onMouseDown={handleDocMouseDown}
                            onMouseMove={handleDocMouseMove}
                            onMouseUp={handleDocMouseUp}
                            onMouseLeave={handleDocMouseUp}
                            onWheel={handleDocWheel}
                          >
                            <div 
                              className="flex w-[400%] will-change-transform"
                              style={{
                                transform: `translate3d(calc(-${(docCurrentPage - 1) * 25}% + ${docDragOffset}px), 0, 0)`,
                                transition: isDocDragging ? 'none' : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                              }}
                            >
                              <div className="w-1/4 shrink-0 px-2 sm:px-4">
                                {renderDocPage1(splitSelectedFile)}
                              </div>
                              <div className="w-1/4 shrink-0 px-2 sm:px-4">
                                {renderDocPage2(splitSelectedFile)}
                              </div>
                              <div className="w-1/4 shrink-0 px-2 sm:px-4">
                                {renderDocPage3(splitSelectedFile)}
                              </div>
                              <div className="w-1/4 shrink-0 px-2 sm:px-4">
                                {renderDocPage4(splitSelectedFile)}
                              </div>
                            </div>

                            {/* Barre de navigation / pagination tactile sous le document horizontal */}
                            <div className="w-full flex items-center justify-center gap-3 mt-10 pt-4 pb-4 select-none">
                              <button
                                type="button"
                                disabled={docCurrentPage <= 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocCurrentPage(prev => Math.max(1, prev - 1));
                                }}
                                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                ← Précédent
                              </button>

                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4].map((pNum) => (
                                  <button
                                    key={pNum}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDocCurrentPage(pNum);
                                    }}
                                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                                      docCurrentPage === pNum
                                        ? 'w-8 bg-blue-600 shadow-sm'
                                        : 'w-2.5 bg-stone-300 hover:bg-stone-400'
                                    }`}
                                    title={`Aller à la page ${pNum}`}
                                  />
                                ))}
                              </div>

                              <button
                                type="button"
                                disabled={docCurrentPage >= totalDocPages}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
                                }}
                                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                Suivant →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. FICHIERS DIVERS / ARCHIVES */}
                  {!['images', 'videos', 'audio', 'documents'].includes(splitSelectedFile.category) && !splitSelectedFile.isImage && (
                    <div className={`w-full bg-[#121826] border border-white/10 rounded-3xl p-8 text-center space-y-5 ${
                      isViewerMaximized ? 'max-w-xl my-auto' : 'max-w-md my-auto'
                    }`}>
                      <div className="w-16 h-16 rounded-2xl bg-black border border-sky-400/40 text-sky-400 flex items-center justify-center mx-auto shadow-xl">
                        <Archive className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{splitSelectedFile.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">{splitSelectedFile.size} • Archive / Paquet StudyCloud</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(splitSelectedFile)}
                        className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 mx-auto shadow-md"
                      >
                        <Download className="w-4 h-4" /> Télécharger le fichier
                      </button>
                    </div>
                  )}

                </div>

              </div>
            )}

          </div>

        </div>
      ) : (
        /* ========================================================================= */
        /* VUE PRINCIPALE DIRECTE : GESTIONNAIRE STUDYCLOUD SANS LES DEUX BOUTONS    */
        /* ========================================================================= */
        <>
          {/* EN-TÊTE FIXE / STICKY : Barre de recherche pilule AU MILIEU */}
          <div className="sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 pt-2.5 pb-2.5 border-b border-stone-300/70 dark:border-slate-800/60 shadow-xs">
            <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
              
              {/* GAUCHE : Bouton Retour rapide vers l'accueil */}
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title="Retour au Tableau de bord"
                  aria-label="Retour"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </button>
              </div>

              {/* MILIEU : Barre de Recherche Pilule AU CENTRE */}
              <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto relative flex items-center px-1 sm:px-2">
                <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 transition-all shadow-inner gap-2">
                  
                  {/* Icône Menu hamburger intégrée à gauche */}
                  <div className="text-white shrink-0">
                    <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Recherchez photos, cours, documents...'
                    className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
                  />

                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Effacer la recherche"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="p-1 text-slate-300 shrink-0">
                      <Search className="w-4 h-4 stroke-[2.2]" />
                    </div>
                  )}
                </div>
              </div>

              {/* DROITE : Bouton + Importer un fichier et Plein écran */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTriggerImport}
                  className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/15 hover:border-blue-400/40 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
                  title="Importer un fichier dans StudyCloud"
                >
                  <Plus className="w-4 h-4 text-blue-400 stroke-[2.5]" />
                  <span className="hidden xs:inline">Importer un fichier</span>
                  <span className="xs:hidden">Importer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet (Prendre tout l'écran)"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                  ) : (
                    <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* CORPS PRINCIPAL DIRECT : SANS LES DEUX BOUTONS, DIRECTEMENT LE MENU STUDYCLOUD */}
          <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 pb-48 sm:pb-64 space-y-4 sm:space-y-5">

            {/* SECTION 1 : RÉCENTS (STRICTEMENT 6 ÉLÉMENTS SUR 1 LIGNE) */}
            {displayedFiles.length > 0 && (
              <section className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                    Récents
                  </h2>
                </div>

                {/* Grille STRICTEMENT sur 1 ligne : 6 colonnes sur écran moyen/grand */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3.5 overflow-x-auto md:overflow-visible no-scrollbar">
                  {displayedFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      className={`group relative bg-[#151C2C] hover:bg-[#1A2338] border border-slate-800 hover:border-slate-700 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col ${
                        menuOpenId === file.id ? 'z-50 relative' : 'z-10'
                      }`}
                    >
                      {/* Vignette compacte */}
                      <div className="w-full h-24 sm:h-28 md:h-28 bg-slate-900/90 relative rounded-t-2xl flex items-center justify-center">
                        <div className="absolute inset-0 rounded-t-2xl overflow-hidden pointer-events-none">
                        {file.previewUrl ? (
                          <img 
                            src={file.previewUrl} 
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3">
                            {file.category === 'documents' && <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400/85 stroke-[1.8]" />}
                            {file.category === 'audio' && <Music className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400/85 stroke-[1.8]" />}
                            {file.category === 'videos' && <Film className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400/85 stroke-[1.8]" />}
                            {file.category === 'downloads' && <Download className="w-8 h-8 sm:w-10 sm:h-10 text-sky-400/85 stroke-[1.8]" />}
                            {file.category === 'images' && <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400/85 stroke-[1.8]" />}
                            {file.category === 'apps' && <LayoutGrid className="w-8 h-8 sm:w-10 sm:h-10 text-pink-400/85 stroke-[1.8]" />}
                          </div>
                        )}
                        </div>

                        {/* Bouton 3 petits points verticaux en haut à droite */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === file.id ? null : file.id);
                          }}
                          className="studycloud-menu-trigger absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 hover:bg-black flex items-center justify-center text-white transition-colors cursor-pointer shadow-md z-20 border border-white/20"
                          title="Options du fichier"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Menu contextuel 3 points */}
                        {menuOpenId === file.id && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="studycloud-file-menu-panel absolute top-9 right-1.5 z-50 w-44 bg-[#0A0F1D] border-2 border-slate-600/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.15)] py-1.5 text-xs font-semibold text-white animate-in fade-in zoom-in-95 overflow-hidden divide-y divide-white/10"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveRecentFile(file.id);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-rose-500/20 flex items-center gap-2 cursor-pointer text-rose-400 hover:text-rose-300 transition-colors"
                              title="Retirer cet élément des récents"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Effacer
                            </button>
                            <button
                              onClick={() => {
                                handleShareFile(file);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-white transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5 text-emerald-400" /> Partager
                            </button>
                            <button
                              onClick={() => {
                                handleDownloadFile(file);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-white transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-amber-400" /> Télécharger
                            </button>
                            <button
                              onClick={() => {
                                handleGenericFileAction('secure_folder', file, cloudRecentFiles);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-amber-300 transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400" /> Dossier sécurisé
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bas de carte avec Nom et Emplacement */}
                      <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-[#151C2C] rounded-b-2xl">
                        <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span className="truncate max-w-[85px]">{file.source}</span>
                          <span className="shrink-0 font-medium">{file.size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ========================================================================= */}
            {/* BOUTON CLASSEUR : BIEN AU MILIEU, COULEUR ORANGE DOUCE                    */}
            {/* ========================================================================= */}
            <div className="w-full flex items-center justify-center py-2 sm:py-3">
              <button
                type="button"
                onClick={() => handleOpenSubMenu('classeur', 'classeur', 'Classeur', FolderArchive, 'text-orange-400')}
                className="group relative flex items-center justify-center gap-3 px-8 sm:px-14 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] hover:from-[#D15C1B] hover:via-[#C55010] hover:to-[#AC430A] text-white border border-orange-500/40 shadow-[0_6px_25px_rgba(184,72,12,0.35)] hover:shadow-[0_8px_30px_rgba(184,72,12,0.5)] transition-all duration-200 cursor-pointer active:scale-95 select-none"
                title="Ouvrir le Classeur"
              >
                <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/20 shrink-0 group-hover:scale-110 transition-transform">
                  <FolderArchive className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.2]" />
                </div>
                <span className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide drop-shadow-sm">
                  Classeur
                </span>
              </button>
            </div>

            {/* SECTION 2 : CATÉGORIES (Chaque bouton ouvre son propre menu indépendant) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Catégories
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                {categories.map((cat) => {
                  const IconComp = cat.icon;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleOpenSubMenu('category', cat.id, cat.name, cat.icon, cat.color)}
                      className="group rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 transition-all duration-200 cursor-pointer select-none border shadow-md bg-[#04060A] hover:bg-[#0A0E18] border-white/10 hover:border-blue-400/50 active:scale-95"
                    >
                      <div className={`p-2 rounded-xl bg-black border border-white/10 shrink-0 group-hover:scale-110 transition-transform ${cat.color}`}>
                        <IconComp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-black text-white truncate tracking-wide group-hover:text-blue-400 transition-colors">
                          {cat.name}
                        </h3>
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-100 truncate mt-0.5">
                          {cat.size}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 3 : COLLECTIONS (Chaque bouton ouvre son propre menu indépendant) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Collections
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {collections.map((col) => {
                  const IconComp = col.icon;
                  return (
                    <div
                      key={col.id}
                      onClick={() => handleOpenSubMenu('collection', col.id, col.name, col.icon, col.color)}
                      className="group rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 bg-[#04060A] hover:bg-[#0A0E18] border border-white/10 hover:border-blue-400/50 transition-all duration-200 cursor-pointer select-none shadow-md active:scale-95"
                    >
                      <div className={`p-2 rounded-xl bg-black border border-white/10 shrink-0 group-hover:scale-110 transition-transform ${col.color}`}>
                        <IconComp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-black text-white truncate tracking-wide group-hover:text-blue-400 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </>
      )}

    </div>
  );
};
