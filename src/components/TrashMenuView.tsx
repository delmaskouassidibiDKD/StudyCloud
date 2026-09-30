import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FolderArchive,
  Check,
  CheckSquare,
  Square,
  Menu,
  Play,
  FileEdit,
  Eye,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Copy
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore, unmarkItemDeleted } from '../services/cloudDataStore';
import { deleteFileBlob } from '../services/localFileStorage';
import { FileItem } from './Page1FilesMenuView';
import { AudioCardPreview } from './AudioCardPreview';
import { DocumentCardPreview } from './DocumentCardPreview';
import { Classeur3DFolderCard, TxtDocumentSVG } from './Folder3DModels';
import { ModernAudioPlayer } from './ModernAudioPlayer';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { ModernImageViewer } from './ModernImageViewer';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { HeaderMenuControls, applyFileSorting, type SortOption } from './HeaderMenuControls';

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

interface TrashMenuViewProps {
  onBack: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const TrashMenuView: React.FC<TrashMenuViewProps> = ({
  onBack,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const [trashList, setTrashList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().trash || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [activeFilter, setActiveFilter] = useState<'all' | 'audio' | 'documents' | 'images' | 'videos' | 'classeur'>('all');

  // Lecteur / visualiseur actif sur le panneau droit (split screen comme dans les autres menus)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // UN SEUL menu 3-traits actif à la fois (ferme automatiquement tout autre menu)
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Mode sélection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modale de confirmation "Vider la corbeille"
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fermer le menu 3 traits si on clique en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.studycloud-trash-menu-panel') && !target.closest('.studycloud-trash-menu-trigger')) {
        setActiveMenuFileId(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  // Écoute de la touche Échap pour fermer le lecteur ou réduire le plein écran
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

  // Écoute en temps réel du CloudDataStore (synchronisation locale et réplication D1)
  useEffect(() => {
    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (Array.isArray(state.trash)) {
        setTrashList(state.trash);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Chargement initial depuis l'API distante
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getTrashFiles()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setTrashList(data);
          CloudDataStore.setTrashFiles(data as any);
        }
      })
      .catch((err) => console.warn('[TrashMenuView] Error fetching trash:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Restaurer un fichier individuel
  const handleRestore = async (file: FileItem) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
      setIsViewerMaximized(false);
    }
    const isFolder = file.category === 'folder' || file.category === 'classeur_folder' || (file as any).model;
    const restoredFolderId = isFolder ? file.id : null;

    setTrashList(prev => prev.filter(f => {
      if (f.id === file.id) return false;
      if (restoredFolderId && (f.folderId === restoredFolderId || (f as any).original_folder_id === restoredFolderId)) {
        return false;
      }
      return true;
    }));

    unmarkItemDeleted(file.id);
    CloudDataStore.restoreFromTrash(file as any);
    await CloudStorageAPI.restoreTrashItem(file.id).catch(() => {});
    window.dispatchEvent(new Event('unifolder_data_restored'));
    showToast(`"${file.name}" a été restauré dans son menu d'origine`);
  };

  // Supprimer définitivement un fichier
  const handleDeletePermanently = async (file: FileItem) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
      setIsViewerMaximized(false);
    }
    setTrashList(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.removeFile(file.id);
    deleteFileBlob(file.id).catch(() => {});
    await CloudStorageAPI.deleteTrashPermanently([file.id]).catch(() => {});
    showToast(`"${file.name}" a été supprimé définitivement`);
  };

  // Vider toute la corbeille
  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      setSelectedFile(null);
      setIsViewerMaximized(false);
      const allIds = trashList.map(f => f.id);
      setTrashList([]);
      CloudDataStore.emptyTrash();
      allIds.forEach(id => deleteFileBlob(id).catch(() => {}));
      await CloudStorageAPI.deleteTrashPermanently(allIds).catch(() => {});
      showToast('La corbeille a été vidée avec succès');
      setIsConfirmEmptyOpen(false);
    } catch (e) {
      showToast('Erreur lors du vidage de la corbeille');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restaurer les éléments sélectionnés
  const handleRestoreSelected = async () => {
    if (selectedFile && selectedIds.includes(selectedFile.id)) {
      setSelectedFile(null);
      setIsViewerMaximized(false);
    }
    const toRestore = trashList.filter(f => selectedIds.includes(f.id));
    const idsToRestore = toRestore.map(f => f.id);
    const restoredFolderIds = new Set(
      toRestore
        .filter(f => f.category === 'folder' || f.category === 'classeur_folder' || (f as any).model)
        .map(f => f.id)
    );

    setTrashList(prev => prev.filter(f => {
      if (selectedIds.includes(f.id)) return false;
      if (restoredFolderIds.size > 0 && ((f.folderId && restoredFolderIds.has(f.folderId)) || ((f as any).original_folder_id && restoredFolderIds.has((f as any).original_folder_id)))) {
        return false;
      }
      return true;
    }));

    idsToRestore.forEach(id => unmarkItemDeleted(id));
    CloudDataStore.restoreFromTrash(toRestore as any);
    await CloudStorageAPI.restoreMultipleTrash(idsToRestore).catch(() => {});
    window.dispatchEvent(new Event('unifolder_data_restored'));
    showToast(`${toRestore.length} élément(s) restauré(s) dans leur menu d'origine`);
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // Supprimer définitivement les éléments sélectionnés
  const handleDeleteSelected = async () => {
    if (selectedFile && selectedIds.includes(selectedFile.id)) {
      setSelectedFile(null);
      setIsViewerMaximized(false);
    }
    const toDelete = trashList.filter(f => selectedIds.includes(f.id));
    for (const f of toDelete) {
      await handleDeletePermanently(f);
    }
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // Sélectionner / désélectionner un élément
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(filteredTrash.map(f => f.id));
  };

  // Filtrage selon catégorie et recherche
  const filteredTrash = useMemo(() => {
    let list = trashList;

    if (activeFilter !== 'all') {
      list = list.filter(f => {
        const cat = (f.sourceCategory || f.originalCategory || f.category || '').toLowerCase();
        const ext = (f.extension || (f.name.includes('.') ? f.name.split('.').pop() || '' : '')).toLowerCase();
        const isNote = Boolean(f.isNotepad || f.category === 'notes' || f.name.endsWith('.txt') || ext === 'txt' || (f.metadata && f.metadata.isNotepad));
        const isFolder = Boolean(cat === 'classeur_folder' || f.category === 'folder' || (f as any).isFolder || (f as any).isClasseurFolder || (f.metadata && (f.metadata.model_id || f.metadata.modelId)));

        if (activeFilter === 'classeur') return cat === 'classeur' || cat === 'classeur_folder' || isNote || isFolder;
        if (activeFilter === 'audio') return cat === 'audio' || Boolean(f.isAudio) || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
        if (activeFilter === 'documents') return (cat === 'documents' || Boolean(f.isDocument) || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) && !isNote && !isFolder;
        if (activeFilter === 'images') return cat === 'images' || Boolean(f.isImage) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
        if (activeFilter === 'videos') return cat === 'videos' || Boolean(f.isVideo) || ['mp4', 'mov', 'mkv', 'webm', 'avi', '3gp'].includes(ext);
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q) || (f.artist && f.artist.toLowerCase().includes(q)));
    }

    return applyFileSorting(list, sortOption);
  }, [trashList, activeFilter, searchQuery, sortOption]);

  // Groupement par catégorie pour affichage fidèle avec titres de sections
  const categorized = useMemo(() => {
    const audios: FileItem[] = [];
    const documents: FileItem[] = [];
    const images: FileItem[] = [];
    const videos: FileItem[] = [];
    const classeur: FileItem[] = [];
    const others: FileItem[] = [];

    filteredTrash.forEach(file => {
      const cat = (file.sourceCategory || file.originalCategory || file.category || '').toLowerCase();
      const ext = (file.extension || (file.name.includes('.') ? file.name.split('.').pop() || '' : '')).toLowerCase();
      const isNote = Boolean(file.isNotepad || file.category === 'notes' || file.name.endsWith('.txt') || ext === 'txt' || (file.metadata && file.metadata.isNotepad));
      const isFolder = Boolean(cat === 'classeur_folder' || file.category === 'folder' || (file as any).isFolder || (file as any).isClasseurFolder || (file.metadata && (file.metadata.model_id || file.metadata.modelId)));

      if (isFolder || isNote || cat === 'classeur' || cat === 'classeur_folder') {
        classeur.push(file);
      } else if (cat === 'audio' || file.isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
        audios.push(file);
      } else if (cat === 'images' || file.isImage || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
        images.push(file);
      } else if (cat === 'videos' || file.isVideo || ['mp4', 'mov', 'mkv', 'webm', 'avi', '3gp'].includes(ext)) {
        videos.push(file);
      } else if (cat === 'documents' || file.isDocument || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        documents.push(file);
      } else {
        others.push(file);
      }
    });

    return { audios, documents, images, videos, classeur, others };
  }, [filteredTrash]);

  // Détection précise du type pour charger le bon lecteur
  const getFileType = (file: FileItem): 'audio' | 'video' | 'image' | 'folder' | 'note' | 'document' => {
    const cat = (file.sourceCategory || file.originalCategory || file.category || '').toLowerCase();
    const ext = (file.extension || (file.name.includes('.') ? file.name.split('.').pop() || '' : '')).toLowerCase();
    const isFolder = Boolean(cat === 'classeur_folder' || file.category === 'folder' || (file as any).isFolder || (file as any).isClasseurFolder || (file.metadata && (file.metadata.model_id || file.metadata.modelId)));
    const isNote = Boolean(file.isNotepad || file.category === 'notes' || file.name.endsWith('.txt') || ext === 'txt' || (file.metadata && file.metadata.isNotepad));

    if (isFolder) return 'folder';
    if (isNote) return 'note';
    if (cat === 'audio' || file.isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
    if (cat === 'videos' || file.isVideo || ['mp4', 'mov', 'mkv', 'webm', 'avi', '3gp'].includes(ext)) return 'video';
    if (cat === 'images' || file.isImage || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) return 'image';
    return 'document';
  };

  // Navigation vers l'élément précédent dans le lecteur
  const handlePrevFile = () => {
    if (!selectedFile) return;
    const currentIndex = filteredTrash.findIndex(f => f.id === selectedFile.id);
    if (currentIndex > 0) {
      setSelectedFile(filteredTrash[currentIndex - 1]);
    } else {
      setSelectedFile(filteredTrash[filteredTrash.length - 1]);
    }
  };

  // Navigation vers l'élément suivant dans le lecteur
  const handleNextFile = () => {
    if (!selectedFile) return;
    const currentIndex = filteredTrash.findIndex(f => f.id === selectedFile.id);
    if (currentIndex >= 0 && currentIndex < filteredTrash.length - 1) {
      setSelectedFile(filteredTrash[currentIndex + 1]);
    } else {
      setSelectedFile(filteredTrash[0]);
    }
  };

  // =========================================================================
  // MENU DÉDIÉ 3 TRAITS FLOTTANT AU-DESSUS DE LA CARTE (SANS ÊTRE CONFONDU)
  // =========================================================================
  const renderOptionsMenu = (file: FileItem, index?: number) => {
    if (activeMenuFileId !== file.id) return null;
    const isChecked = selectedIds.includes(file.id);
    const isRightCol = typeof index === 'number' && ((index + 1) % 2 === 0 || (index + 1) % 3 === 0 || (index + 1) % 4 === 0);
    const alignClass = isRightCol ? 'right-0' : 'left-0';

    return (
      <div
        className={`studycloud-trash-menu-panel absolute ${alignClass} top-9 z-[150] w-56 sm:w-64 bg-[#0A0F1D] border-2 border-rose-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(244,63,94,0.35)] text-white animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col p-0.5`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : Titre du fichier, Sous-titre rouge CORBEILLE, et Croix de fermeture */}
        <div className="px-3 py-2 bg-[#0E1527] border-b border-rose-500/25 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-black text-white truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">
              {file.size || '0 o'} • CORBEILLE
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

        {/* Options déroulantes */}
        <div className="py-1 divide-y divide-white/5">
          {/* Option 0 : Ouvrir le lecteur / Lire l'aperçu */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(file);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
          >
            <Eye className="w-4 h-4 shrink-0 text-blue-400" />
            <span>Lire / Aperçu</span>
          </button>

          {/* Option 1 : Cocher / Décocher */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(file.id);
              setIsSelectionMode(true);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span>{isChecked ? 'Décocher' : 'Cocher'}</span>
          </button>

          {/* Option 2 : Tout cocher */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectAll();
              setIsSelectionMode(true);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span>Tout cocher</span>
          </button>

          {/* Option 3 : Restaurer */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Restaurer</span>
          </button>

          {/* Option 4 : Supprimer définitivement */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePermanently(file);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>Supprimer définitivement</span>
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE AUDIO CARRÉE AVEC APERÇU ET LOGO MÉLODIE
  // =========================================================================
  const renderAudioCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleSelect(file.id);
          } else {
            setSelectedFile(file);
          }
        }}
        className={`group aspect-square rounded-2xl bg-[#0A0D18] border transition-all duration-300 flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen
            ? 'z-[100] relative overflow-visible'
            : isSelected
            ? 'z-20 relative overflow-hidden'
            : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-xl scale-[1.02]'
            : isSelected
            ? 'border-amber-400 ring-2 ring-amber-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-amber-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan : aperçu audio ou pochette créateur haute fidélité */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
          <AudioCardPreview track={file} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 pointer-events-none" />
        </div>

        {/* Logo mélodie central en filigrane */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-amber-400/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Music className="w-6 h-6 text-amber-400/90" />
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits & badge taille */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-trash-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '108 Ko'}
          </span>
        </div>

        {/* Barre inférieure : Titre, Artiste et bouton restauration directe (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] font-semibold text-amber-400/90 truncate uppercase tracking-wider">
              {file.artist || 'CRÉATEUR AUDIO OFFICIEL'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT (AVEC APERÇU MINIATURE DÉDIÉ ET BOUTON 3 TRAITS)
  // =========================================================================
  const renderDocumentCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const theme = getDocumentTheme(file.extension || (file.name.includes('.') ? file.name.split('.').pop() || 'PDF' : 'PDF'));

    return (
      <div
        key={file.id}
        style={{ background: theme.bg }}
        onClick={() => {
          if (isSelectionMode) {
            toggleSelect(file.id);
          } else {
            setSelectedFile(file);
          }
        }}
        className={`group aspect-[3/4] ${theme.border} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative select-none cursor-pointer ${
          isChecked
            ? 'ring-4 ring-amber-400 shadow-2xl scale-[1.02]'
            : isSelected
            ? 'ring-4 ring-white/90 shadow-2xl scale-[1.02] z-20'
            : isMenuOpen
            ? 'ring-4 ring-rose-500/80 shadow-2xl z-[100] relative overflow-visible'
            : 'hover:scale-[1.01] shadow-md active:scale-98 z-10 overflow-hidden'
        }`}
      >
        {/* Barre supérieure : Bouton 3 traits & Badge taille */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-trash-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Cadre d'aperçu du document (DocumentCardPreview fidèle dans son feuillet blanc) */}
        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <DocumentCardPreview doc={file as any} />
        </div>

        {/* Titre unique en bas */}
        <div className="px-0.5 mb-1 relative z-10">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={file.name}>
            {file.name}
          </p>
        </div>

        {/* Pied de carte : typeBadge et bouton restauration directe */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1 relative z-10">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1 sm:p-1.2 bg-emerald-500 hover:bg-emerald-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE IMAGE (AVEC VIGNETTE DIRECTE ET BOUTON 3 TRAITS)
  // =========================================================================
  const renderImageCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const imgUrl = file.previewUrl || file.thumbnailUrl || (file as any).imageUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleSelect(file.id);
          } else {
            setSelectedFile(file);
          }
        }}
        className={`group aspect-[4/3] rounded-2xl bg-[#0A0D18] border transition-all duration-300 flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen ? 'z-[100] relative overflow-visible' : isSelected ? 'z-20 relative overflow-hidden' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl scale-[1.02]'
            : isSelected
            ? 'border-emerald-400 ring-2 ring-emerald-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-emerald-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan vignette */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {imgUrl ? (
            <img src={imgUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <ImageIcon className="w-10 h-10 text-emerald-400/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Barre supérieure : Bouton 3 traits & Taille */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-trash-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Barre inférieure : Nom & Restaurer (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-emerald-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Image'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE VIDÉO (AVEC VIGNETTE VIDÉO, BADGE DURÉE ET BOUTON 3 TRAITS)
  // =========================================================================
  const renderVideoCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedFile?.id === file.id;
    const vidUrl = file.previewUrl || file.thumbnailUrl || (file as any).videoUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleSelect(file.id);
          } else {
            setSelectedFile(file);
          }
        }}
        className={`group aspect-[4/3] rounded-2xl bg-[#0A0D18] border transition-all duration-300 flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen ? 'z-[100] relative overflow-visible' : isSelected ? 'z-20 relative overflow-hidden' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl scale-[1.02]'
            : isSelected
            ? 'border-purple-400 ring-2 ring-purple-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-purple-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan vignette vidéo */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {vidUrl && !vidUrl.toLowerCase().endsWith('.mp4') ? (
            <img src={vidUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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

        {/* Barre supérieure : Bouton 3 traits & Taille */}
        <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} p-2 flex items-center justify-between gap-1`}>
          <div className={`relative studycloud-trash-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Barre inférieure : Nom & Restaurer (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
        <div className="relative z-10 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Vidéo'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE CLASSEUR / DOSSIER / NOTE
  // =========================================================================
  const renderClasseurCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isSelected = selectedFile?.id === file.id;
    const isMenuOpen = activeMenuFileId === file.id;
    const srcCat = (file.sourceCategory || file.originalCategory || file.category || '').toLowerCase();
    const isFolder = Boolean(srcCat === 'classeur_folder' || file.category === 'folder' || (file as any).isFolder || (file as any).isClasseurFolder || (file.metadata && (file.metadata.model_id || file.metadata.modelId)));
    const isNote = Boolean(file.isNotepad || file.category === 'notes' || file.name.endsWith('.txt') || file.extension === 'txt' || (file.metadata && file.metadata.isNotepad));

    // 1. Rendu authentique du Dossier 3D du Classeur
    if (isFolder) {
      const folderData = {
        id: file.id,
        name: file.name,
        modelId: file.metadata?.model_id || file.metadata?.modelId || '1',
        primaryColor: file.metadata?.primary_color || file.metadata?.primaryColor || '#EA580C',
        accentColor: file.metadata?.accent_color || file.metadata?.accentColor || '#F97316',
        iconName: file.metadata?.icon_name || file.metadata?.iconName || 'Folder',
        textDark: Boolean(file.metadata?.text_dark ?? file.metadata?.textDark),
        displayOrder: file.metadata?.display_order || 0,
        zoomLevel: file.metadata?.zoom_level || 10,
        itemCount: 0,
      };

      return (
        <div
          key={file.id}
          onClick={() => {
            if (isSelectionMode) {
              toggleSelect(file.id);
            } else {
              setSelectedFile(file);
            }
          }}
          className={`group relative rounded-2xl transition-all duration-200 flex flex-col justify-between shadow-lg select-none cursor-pointer bg-[#0A0D18] border p-2 sm:p-2.5 ${
            isChecked
              ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl'
              : isSelected
              ? 'border-orange-400 ring-2 ring-orange-400/90 shadow-2xl scale-[1.02] z-20'
              : isMenuOpen
              ? 'border-rose-500 ring-2 ring-rose-500/50 shadow-2xl z-[100] relative overflow-visible'
              : 'border-stone-800/80 hover:border-orange-500/50 z-10 overflow-hidden'
          }`}
        >
          {/* Barre haute : Bouton 3 traits & Badge Dossier 3D */}
          <div className={`${isMenuOpen ? 'relative z-[80]' : 'relative z-20'} flex items-center justify-between gap-1 mb-1`}>
            <div className={`relative studycloud-trash-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(prev => prev === file.id ? null : file.id);
                }}
                className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                  isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
                }`}
                title="Options corbeille"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {isMenuOpen && renderOptionsMenu(file, index)}
            </div>

            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Dossier 3D
            </span>
          </div>

          {/* Rendu 3D conforme et interactif du dossier */}
          <div className="w-full flex-1 flex items-center justify-center py-2 pointer-events-none min-h-[105px]">
            <div className="w-24 sm:w-28 drop-shadow-lg group-hover:scale-105 transition-transform duration-200">
              <Classeur3DFolderCard folder={folderData as any} />
            </div>
          </div>

          {/* Barre basse : Nom & Bouton restaurer (z-10 pour ne JAMAIS chevaucher le menu déroulant z-[150]) */}
          <div className="relative z-10 p-2 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-between gap-2 mt-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate group-hover:text-orange-300 transition-colors" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] text-slate-400">Dossier corbeille</p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(file);
              }}
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Restaurer immédiatement"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

    // 2. Rendu conforme de la Note TXT du Classeur (avec TxtDocumentSVG identique à l'original)
    if (isNote) {
      return (
        <div
          key={file.id}
          onClick={() => {
            if (isSelectionMode) {
              toggleSelect(file.id);
            } else {
              setSelectedFile(file);
            }
          }}
          className={`group relative bg-[#0E1526] hover:bg-[#141E34] border rounded-2xl p-2 sm:p-2.5 shadow-lg transition-all duration-200 flex flex-col justify-between select-none cursor-pointer ${
            isChecked
              ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl'
              : isSelected
              ? 'border-cyan-400 ring-2 ring-cyan-400/90 shadow-2xl scale-[1.02] z-20'
              : isMenuOpen
              ? 'border-rose-500 ring-2 ring-rose-500/50 shadow-2xl z-[100] relative overflow-visible'
              : 'border-white/10 hover:border-cyan-400/50 hover:-translate-y-1 z-10 overflow-hidden'
          }`}
        >
          {/* Haut de carte : Badge TXT et Bouton 3 traits */}
          <div className={`flex items-center justify-between ${isMenuOpen ? 'relative z-[80]' : 'relative z-20'}`}>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              TXT
            </span>

            <div className={`relative studycloud-trash-menu-trigger ${isMenuOpen ? 'z-[90]' : 'z-10'}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(prev => prev === file.id ? null : file.id);
                }}
                className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                  isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
                }`}
                title="Options corbeille"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {isMenuOpen && renderOptionsMenu(file, index)}
            </div>
          </div>

          {/* Illustration TXT Conforme strictement au Classeur (TxtDocumentSVG) */}
          <div className="w-full flex-1 flex items-center justify-center py-2 min-h-[110px] pointer-events-none">
            <div className="w-24 sm:w-28 drop-shadow-md group-hover:scale-105 transition-transform duration-200">
              <TxtDocumentSVG />
            </div>
          </div>

          {/* Bas de carte : Titre et bouton restauration rapide (z-10) */}
          <div className="p-1.5 flex items-center justify-between bg-black/40 border border-white/10 rounded-xl mt-1.5 gap-2 relative z-10">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] text-slate-400">{file.size || '0 o'}</p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(file);
              }}
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Restaurer immédiatement"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

    // 3. Autre document importé dans le classeur
    return renderDocumentCard(file, index);
  };

  // =========================================================================
  // PANNEAU DE DROITE : LECTEUR DÉDIÉ PAR TYPE DE FICHIER (CORBEILLE)
  // =========================================================================
  const renderDedicatedReader = (file: FileItem) => {
    const fileType = getFileType(file);

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur */}
        <div className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          {/* Navigation Précédent / Suivant et Titre du fichier */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={handlePrevFile}
              className="p-1.5 rounded-full bg-black/60 hover:bg-[#1A2338] text-white border border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
              title="Élément précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextFile}
              className="p-1.5 rounded-full bg-black/60 hover:bg-[#1A2338] text-white border border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
              title="Élément suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Icône du type */}
            <div className="p-1.5 rounded-lg bg-black/80 border border-white/10 shrink-0">
              {fileType === 'audio' && <Music className="w-3.5 h-3.5 text-amber-400" />}
              {fileType === 'video' && <Film className="w-3.5 h-3.5 text-purple-400" />}
              {fileType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
              {fileType === 'folder' && <FolderArchive className="w-3.5 h-3.5 text-orange-400" />}
              {fileType === 'note' && <FileEdit className="w-3.5 h-3.5 text-cyan-400" />}
              {fileType === 'document' && <FileText className="w-3.5 h-3.5 text-blue-400" />}
            </div>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[130px] sm:max-w-[220px] md:max-w-[280px]" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold truncate">
                <span>{file.size || '0 o'}</span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold uppercase text-[9px] border border-rose-500/30">
                  Corbeille
                </span>
              </div>
            </div>
          </div>

          {/* Outils du lecteur à droite */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bouton Restaurer rapide */}
            <button
              type="button"
              onClick={() => handleRestore(file)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Restaurer cet élément"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurer</span>
            </button>

            {/* Bouton Supprimer définitivement */}
            <button
              type="button"
              onClick={() => handleDeletePermanently(file)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm flex items-center gap-1"
              title="Supprimer définitivement"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Supprimer</span>
            </button>

            {/* Bouton Agrandir / Réduire */}
            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                isViewerMaximized ? 'bg-rose-600 text-white border-rose-400' : 'bg-black/60 hover:bg-[#1A2338] text-white border-white/10'
              }`}
              title={isViewerMaximized ? 'Réduire la vue' : 'Plein écran'}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>

            {/* Bouton Fermer le lecteur */}
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setIsViewerMaximized(false);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title="Fermer le lecteur"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
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
                artist={file.artist || 'StudyCloud Corbeille'}
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
                  modelId: file.metadata?.model_id || file.metadata?.modelId || '1',
                  primaryColor: file.metadata?.primary_color || file.metadata?.primaryColor || '#EA580C',
                  accentColor: file.metadata?.accent_color || file.metadata?.accentColor || '#F97316',
                  iconName: file.metadata?.icon_name || file.metadata?.iconName || 'Folder',
                  textDark: Boolean(file.metadata?.text_dark ?? file.metadata?.textDark),
                  displayOrder: file.metadata?.display_order || 0,
                  zoomLevel: file.metadata?.zoom_level || 10,
                  itemCount: 0,
                } as any} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mb-2">{file.name}</h2>
              <p className="text-xs text-orange-400 font-bold uppercase tracking-wider mb-3 px-3 py-1 bg-orange-500/15 border border-orange-500/30 rounded-full inline-block">
                Dossier 3D • Corbeille
              </p>
              <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
                Ce dossier du Classeur est conservé dans la corbeille avec ses configurations 3D. Restaurez-le pour retrouver l'intégralité de ses éléments.
              </p>
              <button
                type="button"
                onClick={() => handleRestore(file)}
                className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurer dans le Classeur</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-white text-stone-900 select-none overflow-hidden animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU CORBEILLE (TOUJOURS ANCRÉ EN HAUT, NE BOUGE PAS AU DÉFILEMENT) */}
      <header className="shrink-0 z-30 w-full bg-stone-100/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 border-b border-stone-200 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour rond, Icône Corbeille rouge et Titre StudyCloud */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isViewerMaximized) {
                  setIsViewerMaximized(false);
                } else if (selectedFile) {
                  setSelectedFile(null);
                } else {
                  onBack();
                }
              }}
              className="p-2 sm:p-2.5 rounded-full bg-[#182032] hover:bg-[#222c44] text-white border border-stone-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
              title={isViewerMaximized ? "Réduire la vue" : selectedFile ? "Fermer le lecteur" : "Retour"}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-[#182032] border border-stone-700/50 text-rose-400 shadow-md">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base md:text-lg font-black text-stone-900 leading-tight">
                  Corbeille
                </h1>
                <p className="text-[11px] font-semibold text-stone-500 leading-tight">
                  StudyCloud
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Corbeille */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-rose-500/50 border border-stone-700/50 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans la corbeille..."
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

          {/* DROITE : Bouton Vider la corbeille & Mode sélection */}
          <div className="shrink-0 flex items-center gap-2">
            {trashList.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 border border-rose-500/40 transition-all cursor-pointer active:scale-95 shadow-sm text-xs sm:text-sm font-bold"
                title="Vider définitivement tous les éléments"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Vider la corbeille</span>
                <span className="sm:hidden">Vider</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-rose-500 text-white border-rose-400 font-bold'
                  : 'bg-[#182032] hover:bg-[#222c44] text-white border-stone-700/50'
              }`}
              title={isSelectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            {/* Bouton Plein écran (entouré en rouge) + Bouton 3 traits derrière lui */}
            <HeaderMenuControls
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE RAPIDE FIXES DANS L'EN-TÊTE */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-0.5 scrollbar-none">
          {[
            { id: 'all', label: 'TOUS' },
            { id: 'audio', label: 'AUDIO' },
            { id: 'documents', label: 'DOCUMENTS' },
            { id: 'images', label: 'IMAGES' },
            { id: 'videos', label: 'VIDÉOS' },
            { id: 'classeur', label: 'CLASSEUR' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-[#182032] text-slate-200 hover:text-white hover:bg-[#222c44] border border-stone-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* BANDEAU DE SÉLECTION MULTIPLE FLOTTANT FIXE SOUS L'EN-TÊTE */}
      {isSelectionMode && (
        <div className="shrink-0 z-20 w-full bg-[#0F1424] border-b border-rose-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredTrash.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredTrash.map(f => f.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2 cursor-pointer"
            >
              {selectedIds.length === filteredTrash.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleRestoreSelected}
                  className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurer ({selectedIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedIds.length})</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL DE LA CORBEILLE AVEC MODE SPLIT-SCREEN LORSQU'UN FICHIER EST SÉLECTIONNÉ */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        <main
          className={`overflow-y-auto bg-white py-5 pb-64 sm:pb-80 ${
            isViewerMaximized && selectedFile
              ? 'hidden'
              : selectedFile
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-200 px-3 sm:px-4'
              : 'flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12'
          }`}
        >
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-stone-500">Chargement de la corbeille...</p>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4 shadow-sm">
                {sortOption === 'duplicates' ? (
                  <Copy className="w-10 h-10 text-rose-500 opacity-60 stroke-[1.5]" />
                ) : (
                  <Trash2 className="w-10 h-10 text-rose-500 opacity-60 stroke-[1.5]" />
                )}
              </div>
              <h3 className="text-lg font-black text-stone-800 mb-1.5">
                {sortOption === 'duplicates'
                  ? 'Aucun résultat pour les doublons'
                  : searchQuery
                    ? 'Aucun élément trouvé'
                    : 'La corbeille est vide'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
                {sortOption === 'duplicates'
                  ? 'Aucun fichier doublon dans la corbeille. Tous les éléments sont uniques.'
                  : searchQuery
                    ? `Aucun élément de la corbeille ne correspond à "${searchQuery}".`
                    : 'Les fichiers supprimés depuis vos différents menus apparaîtront ici. Vous pourrez les restaurer à tout moment.'}
              </p>
              {sortOption === 'duplicates' && (
                <button
                  type="button"
                  onClick={() => setSortOption('recent')}
                  className="mt-4 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Afficher tous les éléments
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. SECTION FICHIERS AUDIO (CARRÉS AVEC LOGO MÉLODIE ET APERÇU) */}
              {categorized.audios.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-amber-600 border-b border-stone-200 pb-2">
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
              {categorized.classeur.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-orange-600 border-b border-stone-200 pb-2">
                    <FolderArchive className="w-4 h-4" />
                    <span>Classeur & Dossiers ({categorized.classeur.length})</span>
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
              {categorized.documents.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-blue-600 border-b border-stone-200 pb-2">
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
              {categorized.images.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-emerald-600 border-b border-stone-200 pb-2">
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
              {categorized.videos.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-purple-600 border-b border-stone-200 pb-2">
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

              {/* 6. AUTRES FICHIERS */}
              {categorized.others.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-black text-stone-700 border-b border-stone-200 pb-2">
                    <FileText className="w-4 h-4" />
                    <span>Autres Fichiers ({categorized.others.length})</span>
                  </div>
                  <div className={`grid gap-3 sm:gap-4 ${
                    selectedFile
                      ? 'grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {categorized.others.map((file, idx) => renderDocumentCard(file, idx))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>

        {/* PANNEAU DE DROITE : LECTEUR / APERÇU DÉDIÉ PAR TYPE DE FICHIER */}
        {selectedFile && (
          <aside
            className={`flex flex-col bg-[#04060A] text-white overflow-hidden shadow-2xl animate-in fade-in duration-150 ${
              isViewerMaximized
                ? 'fixed inset-0 z-50 w-full h-full'
                : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-stone-200 md:border-stone-800'
            }`}
          >
            {renderDedicatedReader(selectedFile)}
          </aside>
        )}
      </div>

      {/* MODAL DE CONFIRMATION VIDER LA CORBEILLE */}
      {isConfirmEmptyOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-[#0D1222] border border-rose-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Vider toute la corbeille ?</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Cette action supprimera définitivement les <span className="font-bold text-white">{trashList.length}</span> élément(s). Ils seront effacés du stockage et ne pourront plus jamais être restaurés.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? 'Suppression...' : 'Oui, vider définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-rose-500/40 text-rose-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
