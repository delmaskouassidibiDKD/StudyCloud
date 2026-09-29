import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Cloud,
  FolderArchive,
  Folder,
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
  ChevronRight as BreadcrumbChevron,
  Menu,
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
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import { CloudDataStore, FileItem } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { ClasseurCreatedFolder, Classeur3DFolderCard, TxtDocumentSVG } from './Folder3DModels';
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



export const CloudSpaceMenuView: React.FC<CloudSpaceMenuViewProps> = ({
  onBack,
  onOpenPricing,
  onNavigateToCategory,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  // Onglet actif : 'classeur' par défaut
  const [activeTab, setActiveTab] = useState<CloudTabId>('classeur');
  const [searchQuery, setSearchQuery] = useState('');

  // Navigation dans le classeur (dossier ouvert)
  const [openedClasseurFolderId, setOpenedClasseurFolderId] = useState<string | null>(null);

  // Données issues de CloudDataStore (miroir temps réel)
  const [storeData, setStoreData] = useState(() => CloudDataStore.getState());

  // Gestion du menu d'options 3 traits
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Visionneuses / Lecteurs intégrés (Panneau latéral droit)
  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [resolvedBlobUrl, setResolvedBlobUrl] = useState<string | null>(null);

  // Résoudre l'URL Blob locale dès qu'un fichier est sélectionné
  useEffect(() => {
    let isMounted = true;
    if (viewerFile?.id) {
      getFileBlobUrl(viewerFile.id)
        .then((url) => {
          if (isMounted) setResolvedBlobUrl(url);
        })
        .catch(() => {
          if (isMounted) setResolvedBlobUrl(null);
        });
    } else {
      setResolvedBlobUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [viewerFile?.id]);

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

  // Dossiers Classeur racine (sans parentId)
  const classeurRootFolders = useMemo(() => {
    return (storeData.classeurFolders || []).filter(f => !f.parentId);
  }, [storeData.classeurFolders]);

  // Sous-dossiers du dossier ouvert
  const classeurSubFolders = useMemo(() => {
    if (!openedClasseurFolderId) return [];
    return (storeData.classeurFolders || []).filter(f => f.parentId === openedClasseurFolderId);
  }, [storeData.classeurFolders, openedClasseurFolderId]);

  // Fichiers dans le dossier ouvert
  const classeurFolderFiles = useMemo(() => {
    if (!openedClasseurFolderId) return [];
    const files = (storeData.folderFilesMap || {})[openedClasseurFolderId] || [];
    return q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;
  }, [storeData.folderFilesMap, openedClasseurFolderId, q]);

  // Dossiers filtrés par recherche (vue racine)
  const filteredClasseurFolders = useMemo(() => {
    return q
      ? classeurRootFolders.filter(f => f.name.toLowerCase().includes(q))
      : classeurRootFolders;
  }, [classeurRootFolders, q]);

  // Infos du dossier ouvert
  const openedFolder = useMemo(() => {
    if (!openedClasseurFolderId) return null;
    return (storeData.classeurFolders || []).find(f => f.id === openedClasseurFolderId) || null;
  }, [storeData.classeurFolders, openedClasseurFolderId]);

  const parentFolder = useMemo(() => {
    if (!openedFolder?.parentId) return null;
    return (storeData.classeurFolders || []).find(f => f.id === openedFolder.parentId) || null;
  }, [storeData.classeurFolders, openedFolder]);

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
      ...(storeData.documents || []),
      ...(storeData.images || []),
      ...(storeData.videos || []),
      ...(storeData.audio || [])
    ];
    const unique = all.filter((f, idx, arr) => arr.findIndex(x => x.id === f.id) === idx);
    const favs = unique.filter(f => f.isFavorite || f.isPinned);
    return favs.filter(f => !q || f.name.toLowerCase().includes(q));
  }, [storeData.documents, storeData.images, storeData.videos, storeData.audio, q]);

  const filteredTrash = useMemo(() => {
    return (storeData.trash || []).filter(t => !q || t.name.toLowerCase().includes(q));
  }, [storeData.trash, q]);

  const filteredSecure = useMemo(() => {
    return (storeData.secure || []).filter(s => !q || s.name.toLowerCase().includes(q));
  }, [storeData.secure, q]);

  // Éléments de la barre de carrousel horizontale de navigation
  const navTabs = [
    {
      id: 'classeur' as const,
      name: 'Classeur',
      countBadge: classeurRootFolders.length > 0
        ? `${classeurRootFolders.length} dossier${classeurRootFolders.length > 1 ? 's' : ''}`
        : 'Vide',
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
      countBadge: 'Indisponible',
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
  // CARTE DOSSIER CLASSEUR (REFLET À L'IDENTIQUE DU VRAI MENU CLASSEUR)
  // =========================================================================
  const renderClasseurFolderCard = (folder: ClasseurCreatedFolder) => {
    return (
      <div
        key={folder.id}
        onClick={() => {
          setOpenedClasseurFolderId(folder.id);
          setActiveMenuFileId(null);
        }}
        className="group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border border-white/10 hover:border-orange-400/50 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all select-none cursor-pointer flex flex-col justify-between"
        title={folder.name}
      >
        {/* Badges Épinglé et Favori */}
        {(folder.isPinned || folder.isFavorite) && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 pointer-events-none">
            {folder.isPinned && (
              <span className="p-1 rounded-md bg-black/80 border border-blue-400/60 shadow-md flex items-center justify-center text-blue-400 backdrop-blur-sm" title="Épinglé">
                <Pin className="w-3 h-3 rotate-45" />
              </span>
            )}
            {folder.isFavorite && (
              <span className="p-1 rounded-md bg-black/80 border border-amber-400/60 shadow-md flex items-center justify-center text-amber-400 backdrop-blur-sm" title="Favori">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </span>
            )}
          </div>
        )}

        {/* Le dossier 3D lui-même : Classeur3DFolderCard (Modèles 1, 2, 3, 4) */}
        <div className="pt-2 pb-1 w-full">
          <Classeur3DFolderCard folder={folder} />
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE FICHIER DANS UN DOSSIER CLASSEUR (REFLET À L'IDENTIQUE DU CLASSEUR)
  // =========================================================================
  const renderClasseurCard = (doc: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === doc.id;
    const isSelected = viewerFile?.id === doc.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;
    const isTxtNote = doc.isNotepad || doc.extension?.toLowerCase() === 'txt' || doc.name.toLowerCase().endsWith('.txt');

    if (isTxtNote) {
      return (
        <div
          key={doc.id}
          onClick={() => setViewerFile(doc)}
          className={`group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between select-none overflow-hidden cursor-pointer ${
            isSelected
              ? 'border-cyan-400 ring-2 ring-cyan-400/40 bg-[#14233C]'
              : 'border-white/10 hover:border-cyan-400/50 hover:-translate-y-1'
          } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
        >
          {/* Haut de carte : Badge TXT, Épinglé, Favori et Bouton 3 traits */}
          <div className="flex items-center justify-between w-full mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                TXT
              </span>
              {doc.isPinned && (
                <span className="p-0.5 rounded bg-black/60 text-blue-300 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
                  <Pin className="w-3 h-3 rotate-45" />
                </span>
              )}
              {doc.isFavorite && (
                <span className="p-0.5 rounded bg-black/60 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
              )}
            </div>

            <div 
              className="relative studycloud-menu-trigger"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(isMenuOpen ? null : doc.id);
                }}
                className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                  isMenuOpen
                    ? 'border-cyan-400 ring-2 ring-cyan-400/50 opacity-100 bg-black'
                    : 'border-white/30 opacity-90 group-hover:opacity-100'
                }`}
                title="Options de la note (3 traits)"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {renderOptionsMenu(doc, alignRight)}
            </div>
          </div>

          {/* Illustration TXT Conforme strictement au Classeur (TxtDocumentSVG) */}
          <div className="w-full flex-1 flex items-center justify-center py-2 min-h-[110px]">
            <div className="w-24 sm:w-28 aspect-[160/215] drop-shadow-md group-hover:scale-105 transition-transform duration-200">
              <TxtDocumentSVG />
            </div>
          </div>

          {/* Bas de carte : Titre et détails */}
          <div className="p-1.5 flex flex-col justify-between bg-black/30 rounded-xl mt-1.5">
            <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors" title={doc.name}>
              {doc.name}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span className="truncate">{doc.size || '0 o'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadFile(doc);
                }}
                className="p-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-all cursor-pointer active:scale-95"
                title="Télécharger"
              >
                <Download className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fichiers multimédias ou documents importés dans le dossier
    return (
      <div
        key={doc.id}
        onClick={() => setViewerFile(doc)}
        className={`group relative bg-[#0E1526]/85 hover:bg-[#141E34] border rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col overflow-hidden select-none cursor-pointer ${
          isSelected
            ? 'border-orange-400 ring-2 ring-orange-400/40 bg-[#192238]'
            : 'border-white/10 hover:border-orange-500/50 hover:-translate-y-1'
        } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
      >
        <div className="w-full h-24 sm:h-28 bg-slate-900/90 relative rounded-t-2xl flex items-center justify-center overflow-hidden">
          {/* Badges Épinglé et Favori */}
          {(doc.isPinned || doc.isFavorite) && (
            <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 pointer-events-none">
              {doc.isPinned && (
                <span className="p-1 rounded-md bg-black/75 text-blue-400 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
                  <Pin className="w-3 h-3 rotate-45" />
                </span>
              )}
              {doc.isFavorite && (
                <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
              )}
            </div>
          )}

          {doc.category === 'images' || doc.isImage ? (
            <img 
              src={doc.previewUrl || doc.url} 
              alt={doc.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (doc.category === 'videos' || Boolean(doc.videoUrl) || doc.isVideo) ? (
            <VideoCardPreview vid={doc} />
          ) : (doc.category === 'documents' || doc.isPdf) ? (
            <DocumentCardPreview doc={doc} />
          ) : ((doc.category as string) === 'audio' || Boolean(doc.audioUrl) || doc.isAudio) ? (
            <AudioCardPreview track={doc} />
          ) : doc.previewUrl ? (
            <img 
              src={doc.previewUrl} 
              alt={doc.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400/85 stroke-[1.8]" />
            </div>
          )}

          <div 
            className="relative studycloud-menu-trigger"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : doc.id);
              }}
              className={`absolute top-1.5 right-1.5 p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm z-20 ${
                isMenuOpen
                  ? 'border-orange-400 ring-2 ring-orange-400/50 opacity-100 bg-black'
                  : 'border-white/30 opacity-90 group-hover:opacity-100'
              }`}
              title="Options du fichier (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderOptionsMenu(doc, alignRight)}
          </div>
        </div>

        <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-black/30 rounded-b-2xl">
          <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-orange-400 transition-colors" title={doc.name}>
            {doc.name}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
            <span className="truncate max-w-[85px] uppercase">{doc.extension || doc.category || 'DOC'}</span>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-medium">{doc.size || '0 o'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadFile(doc);
                }}
                className="p-1 bg-orange-600 hover:bg-orange-500 text-white rounded transition-all cursor-pointer active:scale-95"
                title="Télécharger"
              >
                <Download className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT STANDARD
  // =========================================================================
  const renderDocumentCard = (doc: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === doc.id;
    const isSelected = viewerFile?.id === doc.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={doc.id}
        onClick={() => setViewerFile(doc)}
        className={`aspect-[3/4] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all relative group select-none cursor-pointer active:scale-98 shadow-md border-2 ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
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
    const isSelected = viewerFile?.id === img.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={img.id}
        onClick={() => setViewerFile(img)}
        className={`aspect-[4/5] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md relative overflow-hidden group select-none cursor-pointer ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-emerald-400 border-emerald-400'
              : 'border-white/10 hover:border-emerald-400/60'
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
    const isSelected = viewerFile?.id === vid.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={vid.id}
        onClick={() => setViewerFile(vid)}
        className={`aspect-[4/5] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md relative overflow-hidden group select-none cursor-pointer ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-purple-400 border-purple-400'
              : 'border-white/10 hover:border-purple-400/60'
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
    const isSelected = viewerFile?.id === aud.id;
    const isPlaying = playingAudioId === aud.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={aud.id}
        onClick={() => {
          setViewerFile(aud);
          setPlayingAudioId(aud.id);
        }}
        className={`aspect-square rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md relative overflow-hidden group select-none cursor-pointer ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-amber-400 border-amber-400'
              : 'border-white/10 hover:border-amber-400/60'
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


  const handleCloseReader = () => {
    setViewerFile(null);
    setIsViewerMaximized(false);
    setViewerZoom(1);
    setViewerRotation(0);
  };

  const handleShare = (file: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([file]);
      return;
    }
    if (navigator.share) {
      navigator.share({
        title: file.name,
        text: `Consulter le document : ${file.name}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Lien copié dans le presse-papiers');
    }
  };

  // Liste des fichiers ordonnée pour la navigation Précédent / Suivant
  const activeFileList = useMemo<FileItem[]>(() => {
    switch (activeTab) {
      case 'classeur':
        return openedClasseurFolderId ? classeurFolderFiles : (storeData.documents || []);
      case 'downloads':
        return filteredDownloads as FileItem[];
      case 'images':
        return filteredImages;
      case 'videos':
        return filteredVideos;
      case 'audio':
        return filteredAudio;
      case 'documents':
        return filteredDocuments;
      case 'favorites':
        return filteredFavorites;
      case 'secure-folder':
        return filteredSecure;
      case 'trash':
        return filteredTrash;
      default:
        return [];
    }
  }, [
    activeTab,
    openedClasseurFolderId,
    classeurFolderFiles,
    storeData.documents,
    filteredDownloads,
    filteredImages,
    filteredVideos,
    filteredAudio,
    filteredDocuments,
    filteredFavorites,
    filteredSecure,
    filteredTrash
  ]);

  const handleNavigateFile = (direction: 'prev' | 'next') => {
    if (!viewerFile || activeFileList.length === 0) return;
    const currentIndex = activeFileList.findIndex(f => f.id === viewerFile.id);
    if (currentIndex === -1) {
      setViewerFile(activeFileList[0]);
      return;
    }
    if (direction === 'prev') {
      const prevIndex = (currentIndex - 1 + activeFileList.length) % activeFileList.length;
      setViewerFile(activeFileList[prevIndex]);
    } else {
      const nextIndex = (currentIndex + 1) % activeFileList.length;
      setViewerFile(activeFileList[nextIndex]);
    }
  };

  const renderReader = (file: FileItem) => {
    const ext = (file.extension || '').toLowerCase();
    const name = file.name || 'Fichier';
    const isVideo = file.category === 'videos' || (file as any).isVideo || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);
    const isImage = file.category === 'images' || (file as any).isImage || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);
    const isAudio = file.category === 'audio' || (file as any).isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
    const isPdf = ext === 'pdf' || (file.type && file.type.includes('pdf')) || (!isVideo && !isImage && !isAudio);

    const activeUrl = resolvedBlobUrl || file.url || file.previewUrl || (file as any).videoUrl || (file as any).audioUrl || '';

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur ("l'écriture qui apparaît à droite") */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateFile('prev')}
              className="p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              title="Fichier précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateFile('next')}
              className="p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              title="Fichier suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px] md:max-w-xs" title={name}>
                {name}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate">
                {file.size || 'Fichier'} • <span className="uppercase text-sky-400">{file.extension || file.category || 'DOC'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPdf && (
              <>
                <button
                  type="button"
                  onClick={() => setViewerZoom(z => Math.max(0.5, Math.round((z - 0.2) * 10) / 10))}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                  title="Zoom arrière"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] font-bold text-slate-300 w-10 text-center hidden sm:inline-block">
                  {Math.round(viewerZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setViewerZoom(z => Math.min(3, Math.round((z + 0.2) * 10) / 10))}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                  title="Zoom avant"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewerRotation(r => (r + 90) % 360)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                  title="Faire pivoter"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleToggleFavorite(file)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                file.isFavorite ? 'bg-amber-500/20 text-amber-400 border-amber-400/40' : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
              }`}
              title={file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => handleShare(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
            </button>

            <button
              type="button"
              onClick={() => handleDownloadFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5 text-white" />
            </button>

            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(file, 'Espace Cloud', activeFileList)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                title="Ouvrir dans l'Espace d'étude"
              >
                <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              }`}
              title={isViewerMaximized ? 'Réduire la vue' : "Agrandir en plein écran"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>

            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur selon le format (Images, Vidéos, Audio, Documents) */}
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center relative overflow-hidden p-1 sm:p-2 bg-black/95">
          {isVideo ? (
            <ModernVideoPlayer
              fileId={file.id}
              src={activeUrl}
              fileName={name}
              fileSize={file.size}
              autoPlay={true}
              className="w-full h-full max-h-[calc(100vh-140px)] rounded-2xl"
            />
          ) : isImage ? (
            <ModernImageViewer
              fileId={file.id}
              src={activeUrl}
              alt={name}
              fileName={name}
              fileSize={file.size}
              className="w-full h-full max-h-[calc(100vh-140px)] rounded-2xl"
            />
          ) : isAudio ? (
            <ModernAudioPlayer
              fileId={file.id}
              src={activeUrl}
              fileName={name}
              fileSize={file.size}
              artist={file.artist}
              autoPlay={true}
            />
          ) : (
            <ModernDocumentViewer
              fileId={file.id}
              url={activeUrl}
              fileName={name}
              fileSize={file.size}
              textContent={file.content}
              className="w-full h-full border-0 rounded-none shadow-none"
            />
          )}
        </div>
      </div>
    );
  };

  const gridColsClass = viewerFile
    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-stone-100 text-stone-900 select-none animate-in fade-in duration-200">
      {/* =========================================================================
          1. EN-TÊTE FIXE DU MENU ESPACE CLOUD (NE BOUGE PAS LORS DU DÉFILEMENT)
          ========================================================================= */}
      <header className="shrink-0 sticky top-0 z-30 w-full bg-stone-100/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 border-b border-stone-200 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour rond, Icône Nuage cyan et Titre Espace Cloud */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isViewerMaximized) {
                  setIsViewerMaximized(false);
                } else if (viewerFile) {
                  handleCloseReader();
                } else {
                  onBack();
                }
              }}
              className="p-2 sm:p-2.5 rounded-full bg-[#182032] hover:bg-[#222c44] text-white border border-stone-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-2 rounded-xl bg-[#182032] border border-stone-700/50 text-cyan-400 shadow-inner">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 leading-tight">
                  Espace Cloud
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
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
                className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full bg-[#04060A] text-white placeholder-slate-400 border border-stone-700/50 focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/50 outline-none transition-all shadow-inner"
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
      <section className="shrink-0 w-full bg-stone-100/95 border-b border-stone-200 px-2 sm:px-6 md:px-10 lg:px-12 py-2 sm:py-2.5 select-none z-20">
        <div className="relative flex items-center group">
          {/* Flèche gauche pour défilement rapide sur grand écran */}
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
            className="hidden md:flex absolute left-0 z-30 w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-900 text-white items-center justify-center border border-stone-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer -translate-x-1"
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
                        : 'bg-[#182032] hover:bg-[#222c44] text-white border border-stone-700/50 hover:border-orange-400/40 opacity-90 hover:opacity-100'
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
                      : 'bg-[#182032] hover:bg-[#222c44] border-stone-700/50 text-white hover:border-stone-500 shadow-sm'
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
                    <span className="text-[10px] sm:text-[11px] text-slate-300 font-medium block leading-tight">
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
            className="hidden md:flex absolute right-0 z-30 w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-900 text-white items-center justify-center border border-stone-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer translate-x-1"
            title="Défiler vers la droite"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </section>

      {/* =========================================================================
          3. DISPOSITION SPLIT-SCREEN : LISTE À GAUCHE & LECTEUR À DROITE
          ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-140px)]">
        {/* PANNEAU DE GAUCHE : CONTENU DYNAMIQUE SELON L'ONGLET */}
        <main className={`transition-all duration-300 overflow-y-auto px-3 sm:px-6 py-5 pb-32 bg-stone-100 ${
          isViewerMaximized && viewerFile
            ? 'hidden'
            : viewerFile
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-200'
              : 'w-full md:px-10 lg:px-12'
        }`}>
          {/* ONGLET 1 : CLASSEUR — miroir fidèle du vrai menu Classeur */}
          {activeTab === 'classeur' && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* Fil d'Ariane / breadcrumb quand un dossier est ouvert */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOpenedClasseurFolderId(null)}
                  className={`text-xs font-bold transition-colors ${
                    openedClasseurFolderId
                      ? 'text-orange-600 hover:text-orange-700 cursor-pointer'
                      : 'text-stone-700 cursor-default'
                  }`}
                >
                  Classeur
                </button>
                {parentFolder && (
                  <>
                    <BreadcrumbChevron className="w-3.5 h-3.5 text-stone-400" />
                    <button
                      type="button"
                      onClick={() => setOpenedClasseurFolderId(parentFolder.id)}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                    >
                      {parentFolder.name}
                    </button>
                  </>
                )}
                {openedFolder && (
                  <>
                    <BreadcrumbChevron className="w-3.5 h-3.5 text-stone-400" />
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-lg border"
                      style={{
                        color: openedFolder.primaryColor,
                        borderColor: `${openedFolder.primaryColor}50`,
                        backgroundColor: `${openedFolder.primaryColor}18`
                      }}
                    >
                      {openedFolder.name}
                    </span>
                  </>
                )}

                <span className="ml-auto text-xs font-medium text-stone-500">
                  {openedClasseurFolderId
                    ? `${classeurFolderFiles.length + classeurSubFolders.length} élément${(classeurFolderFiles.length + classeurSubFolders.length) > 1 ? 's' : ''}`
                    : classeurRootFolders.length > 0
                      ? `${classeurRootFolders.length} dossier${classeurRootFolders.length > 1 ? 's' : ''}`
                      : ''}
                  {searchQuery && ` • "${searchQuery}"`}
                </span>
              </div>

              {/* VUE RACINE : liste des dossiers */}
              {!openedClasseurFolderId && (
                filteredClasseurFolders.length === 0 ? (
                  <div className="py-24 text-center text-stone-500 space-y-3">
                    <FolderArchive className="w-16 h-16 mx-auto text-stone-400 opacity-60" />
                    <p className="text-sm font-bold text-stone-800">
                      {searchQuery ? 'Aucun dossier trouvé' : 'Le classeur est vide'}
                    </p>
                    <p className="text-xs text-stone-500">
                      {searchQuery
                        ? `Aucun résultat pour "${searchQuery}"`
                        : 'Créez des dossiers dans le menu Classeur pour les voir ici'}
                    </p>
                  </div>
                ) : (
                  <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                    {filteredClasseurFolders.map(folder => renderClasseurFolderCard(folder))}
                  </div>
                )
              )}

              {/* VUE DOSSIER OUVERT : sous-dossiers + fichiers */}
              {openedClasseurFolderId && (
                <div className="space-y-6">
                  {/* Sous-dossiers */}
                  {classeurSubFolders.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Sous-dossiers</p>
                      <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                        {classeurSubFolders.map(f => renderClasseurFolderCard(f))}
                      </div>
                    </div>
                  )}

                  {/* Fichiers dans ce dossier */}
                  {classeurFolderFiles.length > 0 ? (
                    <div className="space-y-2">
                      {classeurSubFolders.length > 0 && (
                        <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Documents</p>
                      )}
                      <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                        {classeurFolderFiles.map((doc, idx) => renderClasseurCard(doc, idx))}
                      </div>
                    </div>
                  ) : classeurSubFolders.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-stone-400" />
                      <p className="text-sm font-bold text-stone-800">Ce dossier est vide</p>
                      <p className="text-xs text-stone-500">Déplacez des documents ici depuis le menu Documents</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : TÉLÉCHARGEMENTS */}
          {activeTab === 'downloads' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
                </span>
              </div>

              {filteredDownloads.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Download className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucun fichier téléchargé pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredDownloads.map((doc: any, idx) => renderDocumentCard(doc, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 3 : IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} dans l'espace cloud
                </span>
              </div>

              {filteredImages.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <ImageIcon className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucune image stockée pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredImages.map((img, idx) => renderImageCard(img, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 4 : VIDÉOS */}
          {activeTab === 'videos' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} dans l'espace cloud
                </span>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Film className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucune vidéo enregistrée pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 5 : AUDIO */}
          {activeTab === 'audio' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredAudio.length} piste{filteredAudio.length > 1 ? 's' : ''} audio dans l'espace cloud
                </span>
              </div>

              {filteredAudio.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Music className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucune piste audio enregistrée pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredAudio.map((aud, idx) => renderAudioCard(aud, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 6 : DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} dans l'espace cloud
                </span>
              </div>

              {filteredDocuments.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucun document publié pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredDocuments.map((doc, idx) => renderDocumentCard(doc, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 7 : APPLICATIONS */}
          {activeTab === 'apps' && (
            <div className="min-h-[460px] flex flex-col items-center justify-center text-center px-4 py-20 animate-in fade-in duration-200">
              <div className="max-w-lg mx-auto space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                  Ce menu n'est pas disponible pour le moment
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                  L'accès aux applications et aux outils intégrés est temporairement suspendu pour des travaux d'optimisation et de maintenance technique.
                </p>
                <p className="text-xs text-stone-500 font-medium">
                  Ce service sera prochainement réactivé. Nous vous remercions pour votre compréhension.
                </p>
              </div>
            </div>
          )}

          {/* ONGLET 8 : FAVORIS */}
          {activeTab === 'favorites' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredFavorites.length} fichier{filteredFavorites.length > 1 ? 's' : ''} favori{filteredFavorites.length > 1 ? 's' : ''}
                </span>
              </div>

              {filteredFavorites.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Star className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucun fichier favori pour le moment</p>
                  <p className="text-xs text-stone-500">Ajoutez des fichiers en favoris avec le menu 3 traits</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
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
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredSecure.length} fichier{filteredSecure.length > 1 ? 's' : ''} protégé{filteredSecure.length > 1 ? 's' : ''}
                </span>
              </div>

              {filteredSecure.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Lock className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Dossier sécurisé vide</p>
                  <p className="text-xs text-stone-500">Déplacez des fichiers confidentiels ici avec le menu 3 traits</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
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
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
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
            PANNEAU DE DROITE : LECTEUR / VISIONNEUSE DÉDIÉE (SPLIT SCREEN)
            ========================================================================= */}
        {viewerFile && (
          <div className={`transition-all duration-300 flex flex-col bg-[#04060A] text-white ${
            isViewerMaximized
              ? 'w-full flex-1 h-full min-h-[calc(100vh-140px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderReader(viewerFile)}
          </div>
        )}
      </div>

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
