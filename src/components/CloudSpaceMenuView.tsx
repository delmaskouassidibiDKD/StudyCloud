import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Cloud,
  FolderArchive,
  Download,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  LayoutGrid,
  Star,
  Lock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Menu,
  CheckSquare,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  FileCode,
  Clock,
  BookOpen,
  Pencil,
  Layers,
  CheckCircle2,
  Pin,
  Share2,
  Info,
  Maximize2
} from 'lucide-react';
import { CloudDataStore, FileItem } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { DocumentCardPreview } from './DocumentCardPreview';
import { ImageCardPreview } from './ImageCardPreview';
import { VideoCardPreview } from './VideoCardPreview';
import { AudioCardPreview } from './AudioCardPreview';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { ModernImageViewer } from './ModernImageViewer';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { ModernAudioPlayer } from './ModernAudioPlayer';

interface CloudSpaceMenuViewProps {
  onBack: () => void;
  onOpenPricing?: (tab?: 'storage' | 'ai' | 'renewal') => void;
  onNavigateToCategory?: (category: 'audio' | 'documents' | 'videos' | 'images' | 'trash' | 'classeur') => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export type CloudTabId =
  | 'classeur'
  | 'downloads'
  | 'images'
  | 'videos'
  | 'audio'
  | 'documents'
  | 'apps'
  | 'favorites'
  | 'secure-folder'
  | 'trash';

// Les 4 documents authentiques du Classeur StudyCloud issus des cours initiaux
const DEFAULT_CLASSEUR_EXTRA_DOCS: FileItem[] = [
  {
    id: 'classeur-doc-1',
    name: 'Fascicule complet - Circuits Électroniques & Lois de Kirchhoff.pdf',
    category: 'classeur',
    originalCategory: 'classeur',
    source: 'Classeur StudyCloud',
    size: '1.8 Mo',
    sizeBytes: 1887436,
    date: "Aujourd'hui, 09:30",
    extension: 'PDF',
    isPinned: true
  },
  {
    id: 'classeur-doc-2',
    name: 'Cahier de Révision - Mathématiques & Algèbre Linéaire.pdf',
    category: 'classeur',
    originalCategory: 'classeur',
    source: 'Classeur StudyCloud',
    size: '2.4 Mo',
    sizeBytes: 2516582,
    date: "Aujourd'hui, 08:15",
    extension: 'PDF',
    isPinned: false
  },
  {
    id: 'classeur-doc-3',
    name: 'Synthèse Pédagogique - Macroéconomie & Marchés Financiers.pdf',
    category: 'classeur',
    originalCategory: 'classeur',
    source: 'Classeur StudyCloud',
    size: '980 Ko',
    sizeBytes: 1003520,
    date: 'Hier, 16:40',
    extension: 'PDF',
    isPinned: false
  },
  {
    id: 'classeur-doc-4',
    name: "Guide d'Étude & Travaux Pratiques - Électronique Appliquée.pdf",
    category: 'classeur',
    originalCategory: 'classeur',
    source: 'Classeur StudyCloud',
    size: '3.1 Mo',
    sizeBytes: 3250585,
    date: 'Hier, 11:10',
    extension: 'PDF',
    isPinned: true
  }
];

// Les 12 applications éducatives StudyCloud
const STUDY_APPS_LIST = [
  { id: 'app-calc', name: 'Calculatrice Scientifique', category: 'Outils', icon: LayoutGrid, color: 'text-pink-400', desc: 'Calcul formel, trigonométrie et matrices' },
  { id: 'app-board', name: 'Tableau Blanc Interactif', category: 'Étude', icon: Sparkles, color: 'text-cyan-400', desc: 'Dessin vectoriel et schémas scientifiques' },
  { id: 'app-latex', name: 'Éditeur de Formules LaTeX', category: 'Maths', icon: FileCode, color: 'text-emerald-400', desc: "Rendu d'équations et export PDF" },
  { id: 'app-pomo', name: 'Chronomètre & Pomodoro', category: 'Focus', icon: Clock, color: 'text-amber-400', desc: 'Gestion des sessions de travail et pauses' },
  { id: 'app-dict', name: 'Dictionnaire Académique', category: 'Langues', icon: BookOpen, color: 'text-blue-400', desc: 'Définitions et terminologie scientifique' },
  { id: 'app-quiz', name: 'Générateur de Quiz IA', category: 'Révision', icon: Sparkles, color: 'text-purple-400', desc: 'Auto-évaluation instantanée par cours' },
  { id: 'app-notes', name: 'Bloc-Notes Express', category: 'Notes', icon: Pencil, color: 'text-rose-400', desc: 'Prise de notes rapides et brouillon' },
  { id: 'app-flash', name: 'Flashcards de Mémorisation', category: 'Mémoire', icon: Layers, color: 'text-orange-400', desc: 'Cartes mémo avec répétition espacée' },
  { id: 'app-sync', name: 'Cloud Drive Synchroniseur', category: 'Système', icon: Cloud, color: 'text-sky-400', desc: 'Sauvegarde automatique des cours' },
  { id: 'app-pdf', name: 'Convertisseur PDF & Scan', category: 'Docs', icon: FileText, color: 'text-indigo-400', desc: 'Compression et fusion de documents' },
  { id: 'app-audio', name: 'Studio Audio & Dictaphone', category: 'Médias', icon: Music, color: 'text-yellow-400', desc: 'Enregistrement de cours et podcasts' },
  { id: 'app-planner', name: 'Planificateur de Devoirs', category: 'Planning', icon: CheckCircle2, color: 'text-teal-400', desc: 'Calendrier des examens et rendus' },
];

export const CloudSpaceMenuView: React.FC<CloudSpaceMenuViewProps> = ({
  onBack,
  onOpenPricing,
  onNavigateToCategory,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  // Onglet actif : 'classeur' par défaut exactement comme sur la photo
  const [activeTab, setActiveTab] = useState<CloudTabId>('classeur');
  const [searchQuery, setSearchQuery] = useState('');

  // Données locales issues de CloudDataStore (miroir sans table D1 dédiée)
  const [storeData, setStoreData] = useState(() => CloudDataStore.getState());
  const [classeurDocs, setClasseurDocs] = useState<FileItem[]>(() => {
    const existing = CloudDataStore.getState().documents || [];
    return [...DEFAULT_CLASSEUR_EXTRA_DOCS, ...existing];
  });

  // Gestion du menu d'options 3 traits
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Visionneuses / Lecteurs intégrés
  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);

  // Audio en lecture
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Modales diverses (renommer, détails)
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Référence pour le défilement horizontal du carrousel de catégories
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingTabsRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  // Écouter les changements dans CloudDataStore (synchronisation instantanée multi-menus)
  useEffect(() => {
    const unsub = CloudDataStore.subscribe((state) => {
      setStoreData(state);
      setClasseurDocs([...DEFAULT_CLASSEUR_EXTRA_DOCS, ...(state.documents || [])]);
    });
    return () => unsub();
  }, []);

  // Fermer le menu 3 traits au clic en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.studycloud-file-menu-panel') && !target.closest('.studycloud-menu-trigger')) {
        setActiveMenuFileId(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Gestion du glisser / défiler du carrousel d'onglets
  const handleTabsMouseDown = (e: React.MouseEvent) => {
    if (!tabsScrollRef.current) return;
    isDraggingTabsRef.current = true;
    dragStartXRef.current = e.pageX - tabsScrollRef.current.offsetLeft;
    dragScrollLeftRef.current = tabsScrollRef.current.scrollLeft;
  };

  const handleTabsMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTabsRef.current || !tabsScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsScrollRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.5;
    tabsScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const handleTabsMouseUp = () => {
    isDraggingTabsRef.current = false;
  };

  // =========================================================================
  // ACTIONS DE FICHIER (TÉLÉCHARGEMENT, SUPPRESSION, FAVORIS, RENOMMER)
  // =========================================================================
  const handleDownloadFile = async (file: FileItem) => {
    showToast(`Téléchargement de "${file.name}" en cours...`);
    try {
      let downloadUrl = file.url || file.previewUrl || '';
      if (!downloadUrl && file.id) {
        const blobUrl = await getFileBlobUrl(file.id);
        if (blobUrl) downloadUrl = blobUrl;
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`"${file.name}" téléchargé avec succès`);
      } else {
        showToast(`Document "${file.name}" prêt pour consultation`);
      }
    } catch {
      showToast(`Erreur lors du téléchargement de "${file.name}"`);
    }
  };

  const handleToggleFavorite = (file: FileItem) => {
    const newFav = !file.isFavorite;
    CloudDataStore.toggleFavorite(file.id, newFav);
    CloudStorageAPI.toggleFavorite(file.id, newFav).catch(() => {});
    showToast(newFav ? `"${file.name}" ajouté aux favoris` : `"${file.name}" retiré des favoris`);
  };

  const handleTogglePin = (file: FileItem) => {
    const newPin = !file.isPinned;
    CloudDataStore.togglePin(file.id, newPin);
    CloudStorageAPI.togglePin(file.id, newPin).catch(() => {});
    showToast(newPin ? `"${file.name}" épinglé en tête` : `"${file.name}" désépinglé`);
  };

  const handleDeleteFile = (file: FileItem) => {
    CloudDataStore.moveToTrash(file);
    CloudStorageAPI.moveToTrash(file.id, file.category || 'documents').catch(() => {});
    showToast(`"${file.name}" déplacé vers la corbeille`);
    if (viewerFile?.id === file.id) setViewerFile(null);
  };

  const handleRestoreFromTrash = (file: FileItem) => {
    CloudDataStore.restoreFromTrash(file);
    CloudStorageAPI.restoreTrashItem(file.id).catch(() => {});
    showToast(`"${file.name}" restauré avec succès`);
  };

  const handlePermanentDelete = (file: FileItem) => {
    CloudDataStore.removeFile(file.id);
    deleteFileBlob(file.id).catch(() => {});
    CloudStorageAPI.deleteTrashPermanently([file.id]).catch(() => {});
    showToast(`"${file.name}" supprimé définitivement`);
  };

  const handleShareFile = (file: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([file]);
      return;
    }
    const link = `${window.location.origin}${window.location.pathname}#file-${encodeURIComponent(file.id)}`;
    try {
      navigator.clipboard?.writeText(link);
      showToast('Lien de partage copié dans le presse-papiers !');
    } catch {
      showToast(`Lien créé pour "${file.name}"`);
    }
  };

  const handleConfirmRename = () => {
    if (!renamingFile || !renameInputValue.trim()) {
      setRenamingFile(null);
      return;
    }
    const updated = { ...renamingFile, name: renameInputValue.trim() };
    CloudDataStore.updateFile(updated);
    showToast(`Fichier renommé en "${updated.name}"`);
    setRenamingFile(null);
  };

  // =========================================================================
  // LISTES DE FICHIERS FILTRÉES SELON LA RECHERCHE ET L'ONGLET SÉLECTIONNÉ
  // =========================================================================
  const q = searchQuery.trim().toLowerCase();

  const filteredClasseurDocs = useMemo(() => {
    return classeurDocs.filter(d => !q || d.name.toLowerCase().includes(q));
  }, [classeurDocs, q]);

  const filteredDownloads = useMemo(() => {
    const list = storeData.downloads || [];
    return list.filter((d: any) => !q || (d.name || d.title || '').toLowerCase().includes(q));
  }, [storeData.downloads, q]);

  const filteredImages = useMemo(() => {
    return (storeData.images || []).filter(img => !q || img.name.toLowerCase().includes(q));
  }, [storeData.images, q]);

  const filteredVideos = useMemo(() => {
    return (storeData.videos || []).filter(vid => !q || vid.name.toLowerCase().includes(q));
  }, [storeData.videos, q]);

  const filteredAudio = useMemo(() => {
    return (storeData.audio || []).filter(aud => !q || aud.name.toLowerCase().includes(q) || (aud.artist && aud.artist.toLowerCase().includes(q)));
  }, [storeData.audio, q]);

  const filteredDocuments = useMemo(() => {
    return (storeData.documents || []).filter(doc => !q || doc.name.toLowerCase().includes(q));
  }, [storeData.documents, q]);

  const filteredFavorites = useMemo(() => {
    const all = [
      ...classeurDocs,
      ...(storeData.documents || []),
      ...(storeData.images || []),
      ...(storeData.videos || []),
      ...(storeData.audio || [])
    ];
    const unique = all.filter((f, idx, arr) => arr.findIndex(x => x.id === f.id) === idx);
    const favs = unique.filter(f => f.isFavorite || f.isPinned);
    return favs.filter(f => !q || f.name.toLowerCase().includes(q));
  }, [classeurDocs, storeData.documents, storeData.images, storeData.videos, storeData.audio, q]);

  const filteredTrash = useMemo(() => {
    return (storeData.trash || []).filter(t => !q || t.name.toLowerCase().includes(q));
  }, [storeData.trash, q]);

  const filteredSecure = useMemo(() => {
    return (storeData.secure || []).filter(s => !q || s.name.toLowerCase().includes(q));
  }, [storeData.secure, q]);

  const filteredApps = useMemo(() => {
    return STUDY_APPS_LIST.filter(app => !q || app.name.toLowerCase().includes(q) || app.desc.toLowerCase().includes(q));
  }, [q]);

  // Éléments de la barre de carrousel horizontale de navigation
  const navTabs = [
    {
      id: 'classeur' as const,
      name: 'Classeur',
      countBadge: `${filteredClasseurDocs.length} docs`,
      icon: FolderArchive,
      color: 'text-orange-400',
    },
    {
      id: 'downloads' as const,
      name: 'Téléchargements',
      countBadge: `${filteredDownloads.length > 0 ? filteredDownloads.length : 7} fichiers`,
      icon: Download,
      color: 'text-cyan-400',
    },
    {
      id: 'images' as const,
      name: 'Images',
      countBadge: '7,5 Go',
      icon: ImageIcon,
      color: 'text-emerald-400',
    },
    {
      id: 'videos' as const,
      name: 'Vidéos',
      countBadge: '20 Go',
      icon: Film,
      color: 'text-purple-400',
    },
    {
      id: 'audio' as const,
      name: 'Audio',
      countBadge: '4,8 Go',
      icon: Music,
      color: 'text-amber-400',
    },
    {
      id: 'documents' as const,
      name: 'Documents',
      countBadge: '3,5 Go',
      icon: FileText,
      color: 'text-blue-400',
    },
    {
      id: 'apps' as const,
      name: 'Applications',
      countBadge: '12 installées',
      icon: LayoutGrid,
      color: 'text-pink-400',
    },
    {
      id: 'favorites' as const,
      name: 'Favoris',
      countBadge: `${filteredFavorites.length} favoris`,
      icon: Star,
      color: 'text-amber-400',
    },
    {
      id: 'secure-folder' as const,
      name: 'Dossier sécurisé',
      countBadge: 'Chiffré',
      icon: Lock,
      color: 'text-blue-400',
    },
    {
      id: 'trash' as const,
      name: 'Corbeille',
      countBadge: `${filteredTrash.length} éléments`,
      icon: Trash2,
      color: 'text-rose-400',
    }
  ];

  // =========================================================================
  // MENU D'OPTIONS 3 TRAITS FLOTTANT (DÉDIÉ À CHAQUE CARTE SANS ÊTRE CONFONDU)
  // =========================================================================
  const renderOptionsMenu = (file: FileItem, alignRight = false) => {
    if (activeMenuFileId !== file.id) return null;

    return (
      <div
        className={`studycloud-file-menu-panel absolute ${alignRight ? 'right-0' : 'left-0'} top-9 z-50 w-56 sm:w-60 bg-[#0A0F1D] border-2 border-slate-600/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_20px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col p-0.5`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : Nom du fichier et bouton de fermeture */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {file.size} • <span className="uppercase text-orange-400">{file.extension || file.category || 'DOC'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuFileId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste déroulante des options */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          {/* Section 1 : Consulter / Ouvrir */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                setViewerFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 transition-colors cursor-pointer text-left"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span>Aperçu / Ouvrir</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleDownloadFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Télécharger</span>
            </button>
          </div>

          {/* Section 2 : Favoris & Épingler */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleToggleFavorite(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
              <span>{file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleTogglePin(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-purple-400 hover:bg-purple-500/15 transition-colors cursor-pointer text-left"
            >
              <Pin className={`w-3.5 h-3.5 shrink-0 rotate-45 ${file.isPinned ? 'fill-purple-400' : ''}`} />
              <span>{file.isPinned ? 'Désépingler' : 'Épingler en tête'}</span>
            </button>
          </div>

          {/* Section 3 : Renommer & Partager */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                setRenamingFile(file);
                setRenameInputValue(file.name);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              <span>Renommer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleShareFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-sky-400 hover:bg-sky-500/15 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Partager le lien</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                setDetailsFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Détails & Propriétés</span>
            </button>
          </div>

          {/* Section 4 : Supprimer / Déplacer à la corbeille */}
          <div className="py-1">
            {activeTab === 'trash' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuFileId(null);
                    handleRestoreFromTrash(file);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Restaurer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuFileId(null);
                    handlePermanentDelete(file);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Supprimer définitivement</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveMenuFileId(null);
                  handleDeleteFile(file);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Mettre à la corbeille</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT DU CLASSEUR (EXACTE COMME DANS LA PHOTO DU CLIENT)
  // =========================================================================
  const renderClasseurCard = (doc: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === doc.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    // Rendu réaliste identique à la photo pour les fascicules d'étude
    const isKirchhoff = doc.name.toLowerCase().includes('circuits') || doc.name.toLowerCase().includes('kirchhoff');
    const isMath = doc.name.toLowerCase().includes('math') || doc.name.toLowerCase().includes('algèbre');
    const isEco = doc.name.toLowerCase().includes('macro') || doc.name.toLowerCase().includes('financ');

    return (
      <div
        key={doc.id}
        onClick={() => setViewerFile(doc)}
        className={`aspect-[3/4] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all relative group select-none cursor-pointer active:scale-98 shadow-md border-2 ${
          isMenuOpen
            ? 'z-50 ring-2 ring-orange-400 border-orange-300'
            : 'border-orange-700/60 hover:border-orange-400/80 shadow-[2px_2px_0px_0px_#431407]'
        }`}
        style={{
          background: 'linear-gradient(180deg, #A84411 0%, #7C2E08 100%)'
        }}
      >
        {/* Barre supérieure : Bouton 3 traits & Badge taille */}
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === doc.id ? null : doc.id));
              }}
              className="p-1 sm:p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-sm"
              title="Options du document (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu 3 traits flottant au-dessus */}
            {renderOptionsMenu(doc, alignRight)}
          </div>

          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/50 text-white border border-white/20 px-1.5 py-0.5 rounded shadow-sm">
            {doc.size || '1.8 Mo'}
          </span>
        </div>

        {/* Corps de carte / aperçu schéma ou miniature (exactement comme sur l'image) */}
        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white p-2 relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          {/* En-tête : CME et StudyCloud */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-1">
            <span className="text-[9px] font-black text-red-600 tracking-tighter">cme</span>
            <span className="text-[7px] font-bold bg-stone-900 text-white px-1 py-0.2 rounded">StudyCloud</span>
          </div>

          {/* Titre et définition */}
          <div className="my-1">
            <p className="text-[7px] sm:text-[8px] font-black text-stone-800 leading-tight uppercase line-clamp-2">
              {isKirchhoff
                ? 'AMPLIFICATEUR OPERATIONNEL EN REGIME LINEAIRE : MONTAGES DE..'
                : isMath
                ? 'ESPACES VECTORIELS & APPLICATIONS LINEAIRES : COURS COMPLET'
                : isEco
                ? 'MACROÉCONOMIE FINANCIÈRE & POLITIQUE MONÉTAIRE EUROPÉENNE'
                : doc.name.replace(/\.[^/.]+$/, '').toUpperCase()}
            </p>
            <p className="text-[6px] text-stone-500 font-semibold mt-0.5">1. Définition</p>
          </div>

          {/* Schéma triangle d'amplificateur opérationnel identique à la photo */}
          <div className="w-full h-12 flex items-center justify-center bg-stone-50 rounded border border-stone-200/80 my-0.5">
            {isKirchhoff || (!isMath && !isEco) ? (
              <svg className="w-full h-full max-h-11" viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="35,5 35,40 70,22.5" fill="#FFFFFF" stroke="#1c1917" strokeWidth="1.5" />
                <line x1="15" y1="14" x2="35" y2="14" stroke="#1c1917" strokeWidth="1.2" />
                <line x1="15" y1="31" x2="35" y2="31" stroke="#1c1917" strokeWidth="1.2" />
                <text x="38" y="16" fontSize="7" fontWeight="bold" fill="#1c1917">-</text>
                <text x="38" y="33" fontSize="7" fontWeight="bold" fill="#1c1917">+</text>
                <line x1="70" y1="22.5" x2="90" y2="22.5" stroke="#1c1917" strokeWidth="1.2" />
                <text x="91" y="24" fontSize="6" fontWeight="bold" fill="#1c1917">Vs</text>
              </svg>
            ) : isMath ? (
              <div className="text-[8px] font-mono font-bold text-stone-700 text-center leading-tight">
                <div>{'det(A - λI) = 0'}</div>
                <div className="text-[6px] text-stone-400 mt-0.5">{'Ker(f) ⊕ Im(f) = E'}</div>
              </div>
            ) : (
              <div className="text-[8px] font-mono font-bold text-stone-700 text-center leading-tight">
                <div>{'Y = C + I + G + (X - M)'}</div>
                <div className="text-[6px] text-stone-400 mt-0.5">{'IS-LM & Courbe de Phillips'}</div>
              </div>
            )}
          </div>

          {/* Lignes de texte stylisées */}
          <div className="space-y-0.5 opacity-60">
            <div className="h-0.5 bg-stone-400 rounded-full w-full" />
            <div className="h-0.5 bg-stone-400 rounded-full w-5/6" />
          </div>
        </div>

        {/* Titre unique en bas */}
        <div className="px-0.5 mb-1">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={doc.name}>
            {doc.name}
          </p>
        </div>

        {/* Pied de carte : Badge PDF et bouton orange de téléchargement */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className="text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 bg-white text-red-700 border border-white">
            PDF
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadFile(doc);
            }}
            className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
            title="Télécharger"
          >
            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT STANDARD
  // =========================================================================
  const renderDocumentCard = (doc: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === doc.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={doc.id}
        onClick={() => setViewerFile(doc)}
        className={`aspect-[3/4] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all relative group select-none cursor-pointer active:scale-98 shadow-md border-2 ${
          isMenuOpen
            ? 'z-50 ring-2 ring-blue-400 border-blue-300'
            : 'border-blue-700/60 hover:border-blue-400/80 shadow-[2px_2px_0px_0px_#172554]'
        }`}
        style={{
          background: 'linear-gradient(180deg, #1e40af 0%, #172554 100%)'
        }}
      >
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === doc.id ? null : doc.id));
              }}
              className="p-1 sm:p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-sm"
              title="Options du document (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(doc, alignRight)}
          </div>
          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/50 text-white border border-white/20 px-1.5 py-0.5 rounded shadow-sm">
            {doc.size || 'Document'}
          </span>
        </div>

        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <DocumentCardPreview doc={doc} />
        </div>

        <div className="px-0.5 mb-1">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={doc.name}>
            {doc.name}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className="text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 bg-white text-blue-700 border border-white">
            {doc.extension || 'DOC'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadFile(doc);
            }}
            className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
            title="Télécharger"
          >
            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE IMAGE
  // =========================================================================
  const renderImageCard = (img: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === img.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={img.id}
        onClick={() => setViewerFile(img)}
        className={`aspect-[4/5] rounded-2xl bg-[#0A0D18] border border-white/10 hover:border-emerald-400/60 transition-all flex flex-col justify-between shadow-md relative overflow-hidden group select-none cursor-pointer ${
          isMenuOpen ? 'z-50 ring-2 ring-emerald-400' : ''
        }`}
      >
        {/* Miniature réelle de l'image */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
          <ImageCardPreview img={img} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Barre supérieure : 3 traits & taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === img.id ? null : img.id));
              }}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90"
              title="Options de l'image (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(img, alignRight)}
          </div>

          <span className="text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded border border-white/20 shadow-sm">
            {img.size || 'Image'}
          </span>
        </div>

        {/* Pied de carte : Nom de l'image */}
        <div className="relative z-20 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10">
          <p className="text-[10px] sm:text-xs font-black text-white truncate group-hover:text-emerald-300 transition-colors" title={img.name}>
            {img.name}
          </p>
          <p className="text-[9px] text-slate-400 truncate mt-0.5">
            {img.date || 'Image'}
          </p>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE VIDÉO
  // =========================================================================
  const renderVideoCard = (vid: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === vid.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={vid.id}
        onClick={() => setViewerFile(vid)}
        className={`aspect-[4/5] rounded-2xl bg-[#0A0D18] border border-white/10 hover:border-purple-400/60 transition-all flex flex-col justify-between shadow-md relative overflow-hidden group select-none cursor-pointer ${
          isMenuOpen ? 'z-50 ring-2 ring-purple-400' : ''
        }`}
      >
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
          <VideoCardPreview vid={vid} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Bouton lecture central */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-purple-600/80 hover:bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === vid.id ? null : vid.id));
              }}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90"
              title="Options de la vidéo (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(vid, alignRight)}
          </div>

          <span className="text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded border border-white/20 shadow-sm">
            {vid.size || 'Vidéo'}
          </span>
        </div>

        <div className="relative z-20 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10">
          <p className="text-[10px] sm:text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors" title={vid.name}>
            {vid.name}
          </p>
          <p className="text-[9px] text-slate-400 truncate mt-0.5">
            {vid.date || 'Vidéo'}
          </p>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE AUDIO CARRÉE AVEC LOGO MÉLODIE ET APERÇU
  // =========================================================================
  const renderAudioCard = (aud: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === aud.id;
    const isPlaying = playingAudioId === aud.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={aud.id}
        onClick={() => {
          if (isPlaying) {
            setPlayingAudioId(null);
          } else {
            setPlayingAudioId(aud.id);
            setViewerFile(aud);
          }
        }}
        className={`aspect-square rounded-2xl bg-[#0A0D18] border border-white/10 hover:border-amber-400/60 transition-all flex flex-col justify-between shadow-md relative overflow-hidden group select-none cursor-pointer ${
          isMenuOpen ? 'z-50 ring-2 ring-amber-400' : ''
        }`}
      >
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
          <AudioCardPreview track={aud} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70 pointer-events-none" />
        </div>

        {/* Logo mélodie central en filigrane */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-amber-400/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            {isPlaying ? (
              <Pause className="w-5 h-5 text-amber-400 fill-current" />
            ) : (
              <Music className="w-6 h-6 text-amber-400/90" />
            )}
          </div>
        </div>

        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === aud.id ? null : aud.id));
              }}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90"
              title="Options audio (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(aud, alignRight)}
          </div>

          <span className="text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded border border-white/20 shadow-sm">
            {aud.size || 'Audio'}
          </span>
        </div>

        <div className="relative z-20 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10">
          <p className="text-[10px] sm:text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors" title={aud.name}>
            {aud.name}
          </p>
          <p className="text-[9px] font-semibold text-amber-400/90 truncate uppercase tracking-wider mt-0.5">
            {aud.artist || 'StudyCloud Audio'}
          </p>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE APPLICATION
  // =========================================================================
  const renderAppCard = (app: typeof STUDY_APPS_LIST[0]) => {
    const Icon = app.icon;

    return (
      <div
        key={app.id}
        onClick={() => showToast(`Lancement de l'application "${app.name}"...`)}
        className="p-4 rounded-2xl bg-[#0A0D18] hover:bg-[#12182A] border border-white/10 hover:border-pink-400/50 transition-all flex flex-col justify-between group cursor-pointer shadow-sm active:scale-98"
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`p-3 rounded-2xl bg-black/50 border border-white/10 ${app.color} group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
            {app.category}
          </span>
        </div>

        <div className="mt-4">
          <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-pink-300 transition-colors truncate">
            {app.name}
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-tight">
            {app.desc}
          </p>
        </div>

        <div className="mt-4 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-bold text-pink-400">
          <span>Ouvrir l'application</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* =========================================================================
          1. EN-TÊTE FIXE DU MENU ESPACE CLOUD (NE BOUGE PAS LORS DU DÉFILEMENT)
          ========================================================================= */}
      <header className="shrink-0 sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour rond, Icône Nuage cyan et Titre Espace Cloud */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-full bg-[#182032] hover:bg-[#222c44] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-cyan-400 shadow-inner">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Espace Cloud
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">
                  StudyCloud
                </p>
              </div>
            </div>
          </div>

          {/* DROITE : Barre de recherche intégrée "Rechercher dans Espace..." */}
          <div className="flex items-center gap-2 max-w-xs sm:max-w-md w-full justify-end">
            <div className="relative w-full max-w-[260px] sm:max-w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Espace..."
                className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full bg-[#04060A] text-white placeholder-slate-400 border border-white/10 focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/50 outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. CARROUSEL HORIZONTAL DES CATÉGORIES & COLLECTIONS
          ========================================================================= */}
      <section className="shrink-0 w-full bg-[#070A12]/95 border-b border-white/10 px-2 sm:px-6 md:px-10 lg:px-12 py-2 sm:py-2.5 select-none z-20">
        <div className="relative flex items-center group">
          {/* Flèche gauche pour défilement rapide sur grand écran */}
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
            className="hidden md:flex absolute left-0 z-30 w-7 h-7 rounded-full bg-black/80 hover:bg-slate-800 text-white items-center justify-center border border-white/15 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer -translate-x-1"
            title="Défiler vers la gauche"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
          </button>

          {/* Conteneur défilant et glissable avec la souris / tactile */}
          <div
            ref={tabsScrollRef}
            onMouseDown={handleTabsMouseDown}
            onMouseMove={handleTabsMouseMove}
            onMouseUp={handleTabsMouseUp}
            onMouseLeave={handleTabsMouseUp}
            onWheel={(e) => {
              if (tabsScrollRef.current && e.deltaY !== 0) {
                tabsScrollRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 sm:gap-2.5 py-1 px-1 cursor-grab active:cursor-grabbing"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {navTabs.map((item) => {
              const isSelected = activeTab === item.id;
              const Icon = item.icon;

              // Onglet Classeur avec dégradé terracotta authentique
              if (item.id === 'classeur') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('classeur');
                      setActiveMenuFileId(null);
                    }}
                    className={`group relative flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 shrink-0 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] text-white border border-orange-300 ring-2 ring-orange-400/60 shadow-[0_4px_22px_rgba(184,72,12,0.65)] scale-[1.02]'
                        : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 hover:border-orange-400/40 opacity-80 hover:opacity-100'
                    }`}
                    title="Classeur d'études"
                  >
                    <div className="p-1.5 sm:p-2 rounded-xl bg-black/40 border border-white/20 shrink-0">
                      <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 stroke-[2.2]" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs sm:text-sm font-black text-white tracking-wide block leading-tight">
                        Classeur
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-orange-200 font-bold block leading-tight">
                        {item.countBadge}
                      </span>
                    </div>
                  </button>
                );
              }

              // Autres onglets (Téléchargements, Images, Vidéos, Audio, Documents, etc.)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setActiveMenuFileId(null);
                  }}
                  className={`shrink-0 flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl transition-all duration-200 cursor-pointer select-none active:scale-95 border ${
                    isSelected
                      ? 'bg-[#0E1726] border-sky-400 text-white ring-2 ring-sky-400/80 shadow-[0_0_15px_rgba(56,189,248,0.35)] scale-[1.02]'
                      : 'bg-[#04060A] hover:bg-[#0A0E18] border-white/10 text-white hover:border-white/25 shadow-sm'
                  }`}
                  title={item.name}
                >
                  <div className={`p-1.5 sm:p-2 rounded-xl bg-black/50 border border-white/10 ${item.color} shrink-0`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs sm:text-sm font-bold text-white tracking-wide block leading-tight">
                      {item.name}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block leading-tight">
                      {item.countBadge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Flèche droite pour défilement rapide sur grand écran */}
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
            className="hidden md:flex absolute right-0 z-30 w-7 h-7 rounded-full bg-black/80 hover:bg-slate-800 text-white items-center justify-center border border-white/15 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer translate-x-1"
            title="Défiler vers la droite"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </section>

      {/* =========================================================================
          3. CONTENU PRINCIPAL DYNAMIQUE SELON L'ONGLET SÉLECTIONNÉ
          ========================================================================= */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-5 pb-32 overflow-y-auto">
        {/* ONGLET 1 : CLASSEUR (Sélectionné par défaut à l'ouverture) */}
        {activeTab === 'classeur' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Compteur : "16 documents dans le classeur" exactement comme sur la photo */}
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredClasseurDocs.length} document{filteredClasseurDocs.length > 1 ? 's' : ''} dans le classeur
                {searchQuery && ` • Filtré pour "${searchQuery}"`}
              </span>
            </div>

            {/* Grille de cartes documents du classeur */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredClasseurDocs.map((doc, idx) => renderClasseurCard(doc, idx))}
            </div>
          </div>
        )}

        {/* ONGLET 2 : TÉLÉCHARGEMENTS */}
        {activeTab === 'downloads' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
              </span>
            </div>

            {filteredDownloads.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Download className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Aucun fichier téléchargé pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredDownloads.map((doc: any, idx) => renderDocumentCard(doc, idx))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 3 : IMAGES */}
        {activeTab === 'images' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} dans l'espace cloud
              </span>
            </div>

            {filteredImages.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Aucune image stockée pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredImages.map((img, idx) => renderImageCard(img, idx))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 4 : VIDÉOS */}
        {activeTab === 'videos' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} dans l'espace cloud
              </span>
            </div>

            {filteredVideos.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Film className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Aucune vidéo enregistrée pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredVideos.map((vid, idx) => renderVideoCard(vid, idx))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 5 : AUDIO */}
        {activeTab === 'audio' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredAudio.length} piste{filteredAudio.length > 1 ? 's' : ''} audio dans l'espace cloud
              </span>
            </div>

            {filteredAudio.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Music className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Aucune piste audio enregistrée pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredAudio.map((aud, idx) => renderAudioCard(aud, idx))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 6 : DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} dans l'espace cloud
              </span>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <FileText className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Aucun document publié pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredDocuments.map((doc, idx) => renderDocumentCard(doc, idx))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 7 : APPLICATIONS */}
        {activeTab === 'apps' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredApps.length} application{filteredApps.length > 1 ? 's' : ''} éducative{filteredApps.length > 1 ? 's' : ''} StudyCloud
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredApps.map(app => renderAppCard(app))}
            </div>
          </div>
        )}

        {/* ONGLET 8 : FAVORIS */}
        {activeTab === 'favorites' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredFavorites.length} fichier{filteredFavorites.length > 1 ? 's' : ''} favori{filteredFavorites.length > 1 ? 's' : ''}
              </span>
            </div>

            {filteredFavorites.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Star className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Aucun fichier favori pour le moment</p>
                <p className="text-xs text-slate-500">Ajoutez des fichiers en favoris avec le menu 3 traits</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredFavorites.map((file, idx) => {
                  if (file.category === 'images' || (file as any).isImage) return renderImageCard(file, idx);
                  if (file.category === 'videos' || (file as any).isVideo) return renderVideoCard(file, idx);
                  if (file.category === 'audio' || (file as any).isAudio) return renderAudioCard(file, idx);
                  if (file.category === 'classeur') return renderClasseurCard(file, idx);
                  return renderDocumentCard(file, idx);
                })}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 9 : DOSSIER SÉCURISÉ */}
        {activeTab === 'secure-folder' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredSecure.length} fichier{filteredSecure.length > 1 ? 's' : ''} protégé{filteredSecure.length > 1 ? 's' : ''}
              </span>
            </div>

            {filteredSecure.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Lock className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">Dossier sécurisé vide</p>
                <p className="text-xs text-slate-500">Déplacez des fichiers confidentiels ici avec le menu 3 traits</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredSecure.map((file, idx) => renderDocumentCard(file, idx))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 10 : CORBEILLE */}
        {activeTab === 'trash' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-stone-400">
                {filteredTrash.length} élément{filteredTrash.length > 1 ? 's' : ''} dans la corbeille
              </span>
            </div>

            {filteredTrash.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Trash2 className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold">La corbeille est vide</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredTrash.map((file, idx) => {
                  if (file.category === 'images' || (file as any).isImage) return renderImageCard(file, idx);
                  if (file.category === 'videos' || (file as any).isVideo) return renderVideoCard(file, idx);
                  if (file.category === 'audio' || (file as any).isAudio) return renderAudioCard(file, idx);
                  if (file.category === 'classeur') return renderClasseurCard(file, idx);
                  return renderDocumentCard(file, idx);
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          VISIONNEUSE DE FICHIER EN PLEIN ÉCRAN / MODAL
          ========================================================================= */}
      {viewerFile && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl h-[85vh] bg-[#0A0E1A] border border-white/20 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            {/* Barre de contrôle du lecteur */}
            <div className="px-4 py-3 bg-[#070A12] border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white truncate">{viewerFile.name}</h3>
                <p className="text-xs text-slate-400">{viewerFile.size} • {viewerFile.extension || viewerFile.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(viewerFile)}
                  className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewerFile(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Corps du lecteur selon le format */}
            <div className="flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center">
              {viewerFile.category === 'images' || (viewerFile as any).isImage ? (
                <ModernImageViewer
                  fileId={viewerFile.id}
                  src={viewerFile.previewUrl || viewerFile.url}
                  fileName={viewerFile.name}
                  fileSize={viewerFile.size}
                  className="w-full h-full"
                />
              ) : viewerFile.category === 'videos' || (viewerFile as any).isVideo ? (
                <ModernVideoPlayer
                  fileId={viewerFile.id}
                  src={viewerFile.videoUrl || viewerFile.url}
                  fileName={viewerFile.name}
                  fileSize={viewerFile.size}
                />
              ) : viewerFile.category === 'audio' || (viewerFile as any).isAudio ? (
                <ModernAudioPlayer
                  fileId={viewerFile.id}
                  src={viewerFile.audioUrl || viewerFile.url}
                  fileName={viewerFile.name}
                  fileSize={viewerFile.size}
                  artist={viewerFile.artist}
                  autoPlay={true}
                />
              ) : (
                <ModernDocumentViewer
                  fileId={viewerFile.id}
                  url={viewerFile.url || viewerFile.previewUrl}
                  fileName={viewerFile.name}
                  fileSize={viewerFile.size}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALE DE RENOMMAGE DU FICHIER
          ========================================================================= */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F172A] border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white">Renommer le fichier</h3>
            <input
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-sm focus:border-cyan-400 outline-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingFile(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALE DÉTAILS & PROPRIÉTÉS
          ========================================================================= */}
      {detailsFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F172A] border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white">Propriétés du fichier</h3>
              <button
                type="button"
                onClick={() => setDetailsFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Nom :</span>
                <span className="font-bold text-white truncate max-w-[240px]">{detailsFile.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Taille :</span>
                <span className="font-bold text-white">{detailsFile.size}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Format :</span>
                <span className="font-bold text-orange-400 uppercase">{detailsFile.extension || detailsFile.category || 'DOC'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Emplacement :</span>
                <span className="font-bold text-cyan-400">{detailsFile.source || 'Espace Cloud StudyCloud'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Date :</span>
                <span className="font-bold text-white">{detailsFile.date || "Aujourd'hui"}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailsFile(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          NOTIFICATION TOAST FLOTTANTE
          ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-black/90 border border-white/20 shadow-2xl text-white text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
