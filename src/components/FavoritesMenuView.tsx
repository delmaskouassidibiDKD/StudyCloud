import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Star,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FolderArchive,
  Download,
  Share2,
  BookOpen,
  Trash2,
  Check,
  CheckSquare,
  Square,
  Menu,
  Play,
  FileEdit,
  Eye,
  Maximize2,
  Minimize2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Pin,
  Link
} from 'lucide-react';
import { handleNativeShare } from '../utils/nativeShare';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore, FileItem, isItemDeleted } from '../services/cloudDataStore';
import { useFavoritesList } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { getFileBlobUrl, deleteFileBlob, formatFileSize } from '../services/localFileStorage';
import { AudioCardPreview } from './AudioCardPreview';
import { DocumentCardPreview } from './DocumentCardPreview';
import { VideoCardPreview } from './VideoCardPreview';
import { Classeur3DFolderCard, TxtDocumentSVG } from './Folder3DModels';
import { ModernAudioPlayer } from './ModernAudioPlayer';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { ModernImageViewer } from './ModernImageViewer';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { HeaderMenuControls, applyFileSorting, type SortOption, parseSizeToBytes } from './HeaderMenuControls';

const getDocumentTheme = (ext: string = 'PDF') => {
  const upper = (ext || 'PDF').toUpperCase();
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
  } else if (['XLS', 'XLSX', 'CSV'].includes(upper)) {
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
    typeBadge: upper || 'DOC'
  };
};

interface FavoritesMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
  setActivePreviewItem?: (item: any) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const FavoritesMenuView: React.FC<FavoritesMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink,
  setActivePreviewItem,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  // Récupérer les éléments favoris depuis CloudDataStore
  const getFavsFromStore = (): FileItem[] => {
    const s = CloudDataStore.getState();
    const trashIds = new Set((s.trash || []).map(t => t.id));

    const isEligibleFav = (f: FileItem) => {
      if (!f || !f.id) return false;
      if (f.isTrash || trashIds.has(f.id) || isItemDeleted(f.id)) return false;
      return Boolean(f.isFavorite || s.favIdSet.has(f.id));
    };

    const all: FileItem[] = [
      ...(s.favorites || []).filter(isEligibleFav),
      ...(s.documents || []).filter(isEligibleFav),
      ...(s.images || []).filter(isEligibleFav),
      ...(s.videos || []).filter(isEligibleFav),
      ...(s.audio || []).filter(isEligibleFav),
      ...((s.downloads || []) as any[]).filter(isEligibleFav),
      ...Object.values(s.folderFilesMap || {}).flat().filter(isEligibleFav),
    ];

    // Dossiers 3D du classeur marqués en favoris
    const favFolders = (s.classeurFolders || [])
      .filter(f => !trashIds.has(f.id) && !isItemDeleted(f.id) && (f.isFavorite || s.favIdSet.has(f.id)))
      .map(f => ({
        id: f.id,
        name: f.name,
        category: 'classeur' as const,
        size: 'Dossier 3D',
        date: 'Favori',
        isFolder: true,
        metadata: {
          modelId: f.modelId,
          primaryColor: f.primaryColor,
          accentColor: f.accentColor,
          iconName: f.iconName,
          textDark: f.textDark,
          displayOrder: f.displayOrder,
          zoomLevel: f.zoomLevel,
          isPinned: f.isPinned,
          isFavorite: true
        }
      } as any as FileItem));
    all.push(...favFolders);

    const seen = new Set<string>();
    return all.filter(f => {
      if (!f || !f.id || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  };

  const { data: serverFavData, isLoading: isFavQueryLoading } = useFavoritesList();
  const [favoritesList, setFavoritesList] = useState<FileItem[]>(() => getFavsFromStore());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'documents' | 'images' | 'videos' | 'audio' | 'classeur'>('all');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fermer le menu 3 traits au clic en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.studycloud-fav-menu-panel') && !target.closest('.studycloud-fav-menu-trigger')) {
        setActiveMenuFileId(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  // Écoute de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isViewerMaximized) {
          setIsViewerMaximized(false);
        } else if (selectedFile) {
          setSelectedFile(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerMaximized, selectedFile]);

  // Synchronisation continue avec CloudDataStore
  useEffect(() => {
    const unsubscribe = CloudDataStore.subscribe(() => {
      setFavoritesList(getFavsFromStore());
      setLoading(false);
    });
    setFavoritesList(getFavsFromStore());
    return () => {
      unsubscribe();
    };
  }, []);

  // Synchronisation continue ultra-légère avec TanStack Query
  useEffect(() => {
    if (!serverFavData) return;
    const { favIds, items } = serverFavData;
    const s = CloudDataStore.getState();
    const trashIds = new Set((s.trash || []).map(t => t.id));

    (favIds || []).forEach(id => {
      if (trashIds.has(id) || isItemDeleted(id)) {
        s.favIdSet.delete(id);
      } else {
        s.favIdSet.add(id);
      }
    });

    const validItems = (items || []).filter(item => item && item.id && !trashIds.has(item.id) && !isItemDeleted(item.id));
    if (validItems.length > 0) {
      validItems.forEach(item => {
        const withFav = { ...item, isFavorite: true, isTrash: false };
        if (item.category === 'classeur' || item.isFolder) {
          CloudDataStore.addClasseurFolder(withFav as any);
        } else {
          CloudDataStore.addOptimisticFile(withFav);
        }
      });
    }
    setFavoritesList(getFavsFromStore());
    setLoading(false);
  }, [serverFavData]);

  // Retirer un élément des favoris
  const handleRemoveFavorite = async (file: FileItem) => {
    setFavoritesList(prev => prev.filter(f => f.id !== file.id));
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
      setIsViewerMaximized(false);
    }
    setActiveMenuFileId(null);

    // Mettre à jour dans CloudDataStore
    CloudDataStore.toggleFavorite(file.id, false);
    await CloudStorageAPI.removeFavorite(file.id).catch(() => {});
    invalidateCloudQueries.favorites().catch(() => {});
    invalidateCloudQueries.overview().catch(() => {});
    showToast(`« ${file.name} » retiré des favoris`);
  };

  // Télécharger un fichier
  const handleDownload = async (file: FileItem) => {
    let url = file.previewUrl || file.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(file.id);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Téléchargement démarré...');
    }
    setActiveMenuFileId(null);
  };

  // Ouvrir dans l'espace d'étude avec IA
  const handleOpenInStudy = (file: FileItem) => {
    if (setActivePreviewItem) {
      setActivePreviewItem(file);
    } else if (onOpenStudySpace) {
      onOpenStudySpace(file, 'Favoris', favoritesList);
    }
    setActiveMenuFileId(null);
  };

  // Type de fichier
  const getFileType = (f: FileItem): 'audio' | 'video' | 'image' | 'note' | 'document' | 'folder' => {
    if (f.category === 'audio' || f.isAudio || /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(f.name)) return 'audio';
    if (f.category === 'videos' || f.isVideo || /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp)$/i.test(f.name)) return 'video';
    if (f.category === 'images' || f.isImage || /\.(jpe?g|png|webp|gif|svg|avif|ico|bmp|tiff)$/i.test(f.name)) return 'image';
    if (f.category === 'notes' || f.isNotepad || f.name.toLowerCase().endsWith('.txt') || f.type === 'text/plain') return 'note';
    if ((f as any).isFolder || f.category === 'classeur') return 'folder';
    return 'document';
  };

  // Calcul dynamique de l'espace occupé par les favoris
  const totalFavoritesBytes = useMemo(() => {
    return favoritesList.reduce((acc, f) => acc + parseSizeToBytes(f?.size, f?.sizeBytes), 0);
  }, [favoritesList]);

  const formattedFavoritesSize = useMemo(() => {
    if (totalFavoritesBytes > 0) {
      if (totalFavoritesBytes < 1024) return `${totalFavoritesBytes} o`;
      if (totalFavoritesBytes < 1024 * 1024) return `${(totalFavoritesBytes / 1024).toFixed(1)} Ko`;
      if (totalFavoritesBytes < 1024 * 1024 * 1024) return `${(totalFavoritesBytes / (1024 * 1024)).toFixed(1)} Mo`;
      return `${(totalFavoritesBytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
    }
    return '0 Mo';
  }, [totalFavoritesBytes]);

  // Filtrage et catégorisation dynamique
  const categorized = useMemo(() => {
    let list = favoritesList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }

    list = applyFileSorting(list, sortOption);

    const audios = list.filter(f => getFileType(f) === 'audio');
    const images = list.filter(f => getFileType(f) === 'image');
    const videos = list.filter(f => getFileType(f) === 'video');
    const classeur = list.filter(f => getFileType(f) === 'folder');
    const documents = list.filter(f => {
      const t = getFileType(f);
      return t === 'document' || t === 'note';
    });

    return { audios, images, videos, classeur, documents, total: list.length };
  }, [favoritesList, searchQuery, sortOption]);

  // =========================================================================
  // MENU D'OPTIONS 3 TRAITS SUR CHAQUE CARTE
  // =========================================================================
  const renderOptionsMenu = (file: FileItem) => {
    return (
      <div
        className="studycloud-fav-menu-panel absolute top-8 left-0 z-[150] bg-[#0E1526] text-white rounded-xl shadow-2xl border border-white/20 py-1.5 w-48 text-xs font-semibold animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => handleRemoveFavorite(file)}
          className="w-full text-left px-3.5 py-2 hover:bg-amber-500/20 flex items-center gap-2.5 text-amber-400 transition-colors cursor-pointer border-b border-white/10"
        >
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <span>Retirer des favoris</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenInStudy(file)}
          className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2.5 text-slate-200 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>Ouvrir dans l'espace</span>
        </button>

        <button
          type="button"
          onClick={() => {
            handleNativeShare(file, showToast);
            setActiveMenuFileId(null);
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2.5 text-slate-200 transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Partager</span>
        </button>

        {onOpenCreateShareLink && (
          <button
            type="button"
            onClick={() => {
              onOpenCreateShareLink([{
                id: file.id,
                name: file.name,
                size: file.sizeBytes || 0,
                type: file.extension || file.category || 'file',
                url: file.previewUrl || file.url,
                category: file.category,
                extension: file.extension
              }]);
              setActiveMenuFileId(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2.5 text-slate-200 transition-colors cursor-pointer"
          >
            <Link className="w-3.5 h-3.5 text-sky-400" />
            <span>Créer un lien</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => handleDownload(file)}
          className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2.5 text-slate-200 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-purple-400" />
          <span>Télécharger</span>
        </button>
      </div>
    );
  };

  // =========================================================================
  // CARTE AUDIO CARRÉE IDENTIQUE (AVEC APERÇU ET LOGO MÉLODIE)
  // =========================================================================
  const renderAudioCard = (file: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;

    return (
      <div
        key={file.id}
        onClick={() => setSelectedFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen
            ? 'z-[100] relative overflow-visible'
            : isSelected
            ? 'z-20 relative overflow-hidden'
            : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-amber-400 ring-2 ring-amber-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-amber-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan : aperçu audio haute fidélité */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
          <AudioCardPreview track={file} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 pointer-events-none" />
        </div>

        {/* Logo mélodie central en filigrane */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-amber-400/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Music className="w-6 h-6 text-amber-400/90" />
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits & Étoile Favori */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-fav-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-amber-400 ring-2 ring-amber-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {isMenuOpen && renderOptionsMenu(file)}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFavorite(file);
            }}
            className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-black/60 transition-colors"
            title="Retirer des favoris"
          >
            <Star className="w-4 h-4 fill-amber-400" />
          </button>
        </div>

        {/* Barre inférieure : Titre & Taille (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.artist || file.size || 'Audio'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOSSIER CLASSEUR 3D IDENTIQUE
  // =========================================================================
  const renderClasseurCard = (file: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const folderData = {
      id: file.id,
      name: file.name,
      modelId: file.metadata?.modelId || '1',
      primaryColor: file.metadata?.primaryColor || '#EA580C',
      accentColor: file.metadata?.accentColor || '#F97316',
      iconName: file.metadata?.iconName || 'Folder',
      textDark: Boolean(file.metadata?.textDark),
      displayOrder: file.metadata?.displayOrder || 0,
      zoomLevel: file.metadata?.zoomLevel || 10,
      itemCount: 0,
      isPinned: file.metadata?.isPinned,
      isFavorite: true
    };

    return (
      <div
        key={file.id}
        onClick={() => setSelectedFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen
            ? 'z-[100] relative overflow-visible'
            : isSelected
            ? 'z-20 relative overflow-hidden'
            : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-orange-400 ring-2 ring-orange-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-orange-400 ring-2 ring-orange-400/40 shadow-2xl'
            : 'border-white/10 hover:border-orange-400/50 hover:scale-[1.01]'
        }`}
      >
        {/* Badges Épinglé & Favori */}
        <div className="absolute top-2 left-2 flex items-center gap-1 z-20 pointer-events-none">
          {folderData.isPinned && (
            <span className="p-1 rounded-md bg-black/80 border border-blue-400/60 shadow-md flex items-center justify-center text-blue-400" title="Épinglé">
              <Pin className="w-3 h-3 rotate-45" />
            </span>
          )}
          <span className="p-1 rounded-md bg-black/80 border border-amber-400/60 shadow-md flex items-center justify-center text-amber-400" title="Favori">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          </span>
        </div>

        {/* Bouton 3 traits en haut à droite */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-end`}>
          <div className={`relative studycloud-fav-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90 shadow-md"
              title="Options"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {isMenuOpen && renderOptionsMenu(file)}
          </div>
        </div>

        {/* Représentation 3D du dossier */}
        <div className="pt-2 pb-1 w-full px-2 flex items-center justify-center">
          <Classeur3DFolderCard folder={folderData as any} />
        </div>

        {/* Nom du dossier en bas (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2 bg-black/70 backdrop-blur-md border-t border-white/10 text-center">
          <p className="text-xs font-bold text-white truncate" title={file.name}>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT IDENTIQUE (AVEC THÈME, CADRE BLANC & BADGE TYPE)
  // =========================================================================
  const renderDocumentCard = (file: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const theme = getDocumentTheme(file.extension || (file.name.includes('.') ? file.name.split('.').pop() || 'PDF' : 'PDF'));

    return (
      <div
        key={file.id}
        style={{ background: theme.bg }}
        onClick={() => setSelectedFile(file)}
        className={`group aspect-[3/4] ${theme.border} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative select-none cursor-pointer ${
          isSelected
            ? 'ring-4 ring-white/90 shadow-2xl scale-[1.02] z-20'
            : isMenuOpen
            ? 'ring-4 ring-amber-400/80 shadow-2xl z-[100] relative overflow-visible'
            : 'hover:scale-[1.01] shadow-md active:scale-98 z-10 overflow-hidden'
        }`}
      >
        {/* Barre supérieure : Bouton 3 traits & Étoile Favori */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-fav-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-amber-400 ring-2 ring-amber-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {isMenuOpen && renderOptionsMenu(file)}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFavorite(file);
              }}
              className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-black/60 transition-colors"
              title="Retirer des favoris"
            >
              <Star className="w-4 h-4 fill-amber-400" />
            </button>
            <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
              {file.size || '0 o'}
            </span>
          </div>
        </div>

        {/* Cadre d'aperçu du document */}
        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <DocumentCardPreview doc={file as any} />
        </div>

        {/* Titre unique en bas */}
        <div className="px-0.5 mb-1 relative z-10">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={file.name}>
            {file.name}
          </p>
        </div>

        {/* Pied de carte : typeBadge */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1 relative z-10">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>
          <span className="text-[8px] font-bold text-white/80 truncate">
            {file.date || 'Favori'}
          </span>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE IMAGE IDENTIQUE (AVEC VIGNETTE DIRECTE & BOUTON 3 TRAITS)
  // =========================================================================
  const renderImageCard = (file: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const imgUrl = file.previewUrl || file.thumbnailUrl || (file as any).imageUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => setSelectedFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen ? 'z-[100] relative overflow-visible' : isSelected ? 'z-20 relative overflow-hidden' : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-emerald-400 ring-2 ring-emerald-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-emerald-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan vignette */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {imgUrl ? (
            <img src={imgUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <ImageIcon className="w-10 h-10 text-emerald-400/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Barre supérieure : Bouton 3 traits & Étoile Favori */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-fav-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-amber-400 ring-2 ring-amber-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {isMenuOpen && renderOptionsMenu(file)}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFavorite(file);
              }}
              className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-black/60 transition-colors"
              title="Retirer des favoris"
            >
              <Star className="w-4 h-4 fill-amber-400" />
            </button>
            <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
              {file.size || '0 o'}
            </span>
          </div>
        </div>

        {/* Barre inférieure : Nom & Date (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-emerald-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Image'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE VIDÉO IDENTIQUE (AVEC VIGNETTE & BOUTON PLAY AU CENTRE)
  // =========================================================================
  const renderVideoCard = (file: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const vidUrl = file.previewUrl || file.thumbnailUrl || (file as any).videoUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => setSelectedFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen ? 'z-[100] relative overflow-visible' : isSelected ? 'z-20 relative overflow-hidden' : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-purple-400 ring-2 ring-purple-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-purple-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan vignette vidéo */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {vidUrl && !vidUrl.toLowerCase().endsWith('.mp4') ? (
            <img src={vidUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Film className="w-10 h-10 text-purple-400/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 pointer-events-none" />
        </div>

        {/* Bouton play stylisé au centre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-purple-400/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-4 h-4 fill-purple-400 text-purple-400 ml-0.5" />
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits & Étoile Favori */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-fav-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-amber-400 ring-2 ring-amber-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {isMenuOpen && renderOptionsMenu(file)}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFavorite(file);
              }}
              className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-black/60 transition-colors"
              title="Retirer des favoris"
            >
              <Star className="w-4 h-4 fill-amber-400" />
            </button>
            <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
              {file.size || '0 o'}
            </span>
          </div>
        </div>

        {/* Barre inférieure : Nom & Date (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Vidéo'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // PANNEAU DE DROITE : LECTEUR DÉDIÉ SELON LE TYPE DE FICHIER (COMME DANS CORBEILLE)
  // =========================================================================
  const renderDedicatedReader = (file: FileItem) => {
    const fileType = getFileType(file);

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white">
        {/* Barre d'en-tête du lecteur */}
        <div className="px-4 py-3 bg-[#0A0E1A] border-b border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              {fileType === 'audio' && <Music className="w-4 h-4" />}
              {fileType === 'video' && <Film className="w-4 h-4 text-purple-400" />}
              {fileType === 'image' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
              {fileType === 'note' && <FileEdit className="w-4 h-4 text-cyan-400" />}
              {fileType === 'document' && <FileText className="w-4 h-4 text-blue-400" />}
              {fileType === 'folder' && <FolderArchive className="w-4 h-4 text-orange-400" />}
            </div>

            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[10px] text-slate-400 truncate">
                {file.size} • {file.date || 'Favori'} • <span className="text-amber-400 font-semibold uppercase">{fileType}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Retirer des favoris */}
            <button
              type="button"
              onClick={() => handleRemoveFavorite(file)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Retirer des favoris"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span className="hidden sm:inline">Favori</span>
            </button>

            {/* Plein écran */}
            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isViewerMaximized ? 'bg-amber-500 text-black border-amber-400' : 'bg-black/60 hover:bg-white/10 text-slate-300 border-white/20'
              }`}
              title={isViewerMaximized ? 'Réduire' : 'Plein écran'}
            >
              {isViewerMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Fermer */}
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setIsViewerMaximized(false);
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 hover:text-white text-slate-300 border border-white/20 transition-colors cursor-pointer"
              title="Fermer le lecteur"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur selon le type */}
        <div className="flex-1 w-full h-full overflow-hidden flex flex-col relative bg-[#04060A]">
          {fileType === 'audio' && (
            <div className="w-full h-full flex flex-col justify-center bg-[#070B14]">
              <ModernAudioPlayer
                fileId={file.id}
                src={file.url}
                fileName={file.name}
                fileSize={file.size}
                artist={file.artist || 'StudyCloud Favoris'}
                autoPlay={true}
                className="w-full h-full border-0 rounded-none shadow-none"
              />
            </div>
          )}

          {fileType === 'video' && (
            <div className="w-full h-full flex flex-col justify-center bg-black">
              <ModernVideoPlayer
                fileId={file.id}
                src={file.url}
                fileName={file.name}
                fileSize={file.size}
                className="w-full h-full border-0 rounded-none shadow-none"
              />
            </div>
          )}

          {fileType === 'image' && (
            <div className="w-full h-full flex flex-col bg-[#070B14]">
              <ModernImageViewer
                fileId={file.id}
                src={file.url}
                fileName={file.name}
                fileSize={file.size}
                alt={file.name}
                className="w-full h-full border-0 rounded-none shadow-none"
              />
            </div>
          )}

          {fileType === 'note' && (
            <div className="w-full h-full flex flex-col bg-[#070B14] select-text">
              <ModernDocumentViewer
                fileId={file.id}
                url={file.url}
                fileName={file.name.endsWith('.txt') ? file.name : `${file.name}.txt`}
                fileSize={file.size}
                textContent={file.content || file.metadata?.notepadContent || file.metadata?.notepad_content || (file as any).notepadContent || ''}
                className="w-full h-full border-0 rounded-none shadow-none"
              />
            </div>
          )}

          {fileType === 'document' && (
            <div className="w-full h-full flex flex-col bg-[#070B14] select-text">
              <ModernDocumentViewer
                fileId={file.id}
                url={file.url}
                fileName={file.name}
                fileSize={file.size}
                className="w-full h-full border-0 rounded-none shadow-none"
              />
            </div>
          )}

          {fileType === 'folder' && (
            <div className="w-full h-full overflow-y-auto bg-gradient-to-b from-[#0D1424] via-[#080B14] to-[#04060A] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-48 sm:w-56 drop-shadow-2xl mb-6 hover:scale-105 transition-transform duration-300 pointer-events-none">
                <Classeur3DFolderCard folder={{
                  id: file.id,
                  name: file.name,
                  modelId: file.metadata?.modelId || '1',
                  primaryColor: file.metadata?.primaryColor || '#EA580C',
                  accentColor: file.metadata?.accentColor || '#F97316',
                  iconName: file.metadata?.iconName || 'Folder',
                  textDark: Boolean(file.metadata?.textDark),
                  displayOrder: file.metadata?.displayOrder || 0,
                  zoomLevel: file.metadata?.zoomLevel || 10,
                  itemCount: 0,
                  isPinned: file.metadata?.isPinned,
                  isFavorite: true
                } as any} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mb-2">{file.name}</h2>
              <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-3 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full inline-block">
                Dossier 3D • Favoris
              </p>
              <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
                Ce dossier du Classeur est enregistré dans vos favoris.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-stone-100 dark:bg-[#070A13] text-stone-900 dark:text-slate-100 select-none animate-in fade-in duration-150">
      {/* EN-TÊTE FIXE DU MENU FAVORIS */}
      <header className="sticky top-0 z-30 w-full bg-stone-100/95 dark:bg-[#070A13]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-200 dark:border-white/10 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Favoris */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-stone-700/50 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#182032] border border-stone-700/50 text-amber-400 shadow-sm">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 dark:text-white leading-tight">
                  Favoris
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 leading-tight">
                  {favoritesList.length} élément{favoritesList.length > 1 ? 's' : ''} en favori • {formattedFavoritesSize}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Favoris */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-amber-500/50 border border-stone-700/50 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans les favoris..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* DROITE : Plein écran (entouré en rouge) + Bouton 3 traits derrière lui */}
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
            <HeaderMenuControls
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE RAPIDE */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `Tous (${categorized.total})` },
            { id: 'documents', label: `Documents (${categorized.documents.length})` },
            { id: 'images', label: `Images (${categorized.images.length})` },
            { id: 'videos', label: `Vidéos (${categorized.videos.length})` },
            { id: 'audio', label: `Audio (${categorized.audios.length})` },
            { id: 'classeur', label: `Dossiers (${categorized.classeur.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-[#182032] text-slate-200 hover:text-white hover:bg-[#222c44] border border-stone-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* DISPOSITION SPLIT (COMME DANS LE MENU CORBEILLE ET DOCUMENTS) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES FAVORIS */}
        <main
          className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
            isViewerMaximized && selectedFile
              ? 'hidden'
              : selectedFile
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
              : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
          }`}
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-stone-500">Chargement de vos favoris...</p>
            </div>
          ) : categorized.total === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-white dark:bg-[#111827] border border-stone-200 dark:border-white/10 flex items-center justify-center mb-4 shadow-sm">
                {sortOption === 'duplicates' ? (
                  <Copy className="w-10 h-10 text-amber-500 opacity-60 stroke-[1.5]" />
                ) : (
                  <Star className="w-10 h-10 text-amber-500 opacity-60 fill-amber-500/20 stroke-[1.5]" />
                )}
              </div>
              <h3 className="text-lg font-black text-stone-800 dark:text-white mb-1.5">
                {sortOption === 'duplicates'
                  ? 'Aucun résultat pour les doublons'
                  : searchQuery
                    ? 'Aucun résultat trouvé'
                    : 'Aucun favori pour le moment'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 leading-relaxed">
                {sortOption === 'duplicates'
                  ? 'Aucun fichier doublon dans vos favoris. Tous les éléments sont uniques.'
                  : searchQuery
                    ? `Aucun élément favori ne correspond à "${searchQuery}".`
                    : 'Pour ajouter un fichier en favori, cliquez sur l’étoile ⭐ ou dans les options (•••) d’un fichier ou dossier.'}
              </p>
              {sortOption === 'duplicates' && (
                <button
                  type="button"
                  onClick={() => setSortOption('recent')}
                  className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Afficher tous les favoris
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. SECTION FICHIERS AUDIO */}
              {(activeFilter === 'all' || activeFilter === 'audio') && categorized.audios.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 border-b border-stone-200 dark:border-white/10 pb-2">
                    <Music className="w-4 h-4" />
                    <span>Fichiers Audio ({categorized.audios.length})</span>
                  </div>
                  <div className={`grid gap-3 sm:gap-4 ${
                    selectedFile
                      ? 'grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {categorized.audios.map((file, idx) => renderAudioCard(file, idx))}
                  </div>
                </section>
              )}

              {/* 2. SECTION CLASSEUR & DOSSIERS 3D */}
              {(activeFilter === 'all' || activeFilter === 'classeur') && categorized.classeur.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-orange-600 dark:text-orange-400 border-b border-stone-200 dark:border-white/10 pb-2">
                    <FolderArchive className="w-4 h-4" />
                    <span>Classeur & Dossiers 3D ({categorized.classeur.length})</span>
                  </div>
                  <div className={`grid gap-3 sm:gap-4 ${
                    selectedFile
                      ? 'grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {categorized.classeur.map((file, idx) => renderClasseurCard(file, idx))}
                  </div>
                </section>
              )}

              {/* 3. SECTION DOCUMENTS */}
              {(activeFilter === 'all' || activeFilter === 'documents') && categorized.documents.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 border-b border-stone-200 dark:border-white/10 pb-2">
                    <FileText className="w-4 h-4" />
                    <span>Documents ({categorized.documents.length})</span>
                  </div>
                  <div className={`grid gap-3 sm:gap-4 ${
                    selectedFile
                      ? 'grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {categorized.documents.map((file, idx) => renderDocumentCard(file, idx))}
                  </div>
                </section>
              )}

              {/* 4. SECTION IMAGES */}
              {(activeFilter === 'all' || activeFilter === 'images') && categorized.images.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 border-b border-stone-200 dark:border-white/10 pb-2">
                    <ImageIcon className="w-4 h-4" />
                    <span>Images ({categorized.images.length})</span>
                  </div>
                  <div className={`grid gap-3 sm:gap-4 ${
                    selectedFile
                      ? 'grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {categorized.images.map((file, idx) => renderImageCard(file, idx))}
                  </div>
                </section>
              )}

              {/* 5. SECTION VIDÉOS */}
              {(activeFilter === 'all' || activeFilter === 'videos') && categorized.videos.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-purple-600 dark:text-purple-400 border-b border-stone-200 dark:border-white/10 pb-2">
                    <Film className="w-4 h-4" />
                    <span>Vidéos ({categorized.videos.length})</span>
                  </div>
                  <div className={`grid gap-3 sm:gap-4 ${
                    selectedFile
                      ? 'grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                  }`}>
                    {categorized.videos.map((file, idx) => renderVideoCard(file, idx))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>

        {/* PANNEAU DE DROITE : LECTEUR / APERÇU DÉDIÉ PAR TYPE DE FICHIER (COMME DANS LE MENU CORBEILLE) */}
        {selectedFile && (
          <aside
            className={`flex flex-col bg-[#04060A] text-white overflow-hidden shadow-2xl animate-in fade-in duration-150 ${
              isViewerMaximized
                ? 'fixed inset-0 z-50 w-full h-full'
                : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-stone-200 dark:border-stone-800'
            }`}
          >
            {renderDedicatedReader(selectedFile)}
          </aside>
        )}
      </div>

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
