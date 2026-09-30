import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Film,
  Search,
  Plus,
  Star,
  Share2,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Check,
  Play,
  Menu,
  CheckSquare,
  Square,
  Lock,
  FolderInput,
  FolderArchive,
  Copy,
  Pin,
  Pencil,
  Link,
  AlertCircle,
  RotateCcw,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { useVideosList } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob, storeThumbnailData } from '../services/localFileStorage';
import { compressFile, formatBytes } from '../utils/fileCompressor';
import { generateVideoThumbnail, setCachedMediaThumbnail, getCachedMediaThumbnail } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { VideoCardPreview } from './VideoCardPreview';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { getWorkerApiUrl } from '../services/api';
import { ClasseurCreatedFolder, lightenColor } from './Folder3DModels';
import { HeaderMenuControls, applyFileSorting, type SortOption, parseSizeToBytes } from './HeaderMenuControls';

interface VideosMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// Fonction utilitaire pour calculer le nom d'un doublon
const computeDuplicateName = (originalName: string, existingNames: string[]): string => {
  const hasExt = originalName.includes('.');
  const ext = hasExt ? originalName.substring(originalName.lastIndexOf('.')) : '';
  const base = hasExt ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

  const regex = /^(.*?)(?:\s+(?:(?:\()?(\d+)(?:\))?|\(Copie\)))?$/;
  const match = base.match(regex);
  const cleanBase = (match && match[1]) ? match[1].trim() : base;

  let counter = 2;
  let candidate = `${cleanBase} ${counter}${ext}`;
  const lowerNames = existingNames.map(n => n.toLowerCase());
  while (lowerNames.includes(candidate.toLowerCase())) {
    counter++;
    candidate = `${cleanBase} ${counter}${ext}`;
  }
  return candidate;
};

export const VideosMenuView: React.FC<VideosMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { data: serverVideos = [], isLoading: isVideosQueryLoading } = useVideosList();
  const [videosList, setVideosList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().videos || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');

  // Lecteur vidéo actif (split à droite - Image 4)
  const [selectedVideo, setSelectedVideo] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Défilement Infini (12 vidéos par lot avec mise en cache instantanée)
  const BATCH_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Progression d'enregistrement et gestion d'erreurs en temps réel (comme dans Mes Fichiers)
  const [savingProgress, setSavingProgress] = useState<Record<string, number>>({});
  const [savingErrors, setSavingErrors] = useState<Record<string, string>>({});
  const savingIntervalsRef = useRef<Record<string, any>>({});

  // Animation et suivi en continu de la ligne de progression qui se remplit
  const startSavingAnimation = (fileIds: string[]) => {
    if (!fileIds || fileIds.length === 0) return;

    // 1. Initialisation immédiate visible (12%)
    setSavingProgress(prev => {
      const next = { ...prev };
      fileIds.forEach(id => {
        next[id] = 12;
      });
      return next;
    });

    // 2. Progression animée en continu
    fileIds.forEach(id => {
      if (savingIntervalsRef.current[id]) {
        clearInterval(savingIntervalsRef.current[id]);
      }

      let current = 12;
      const interval = setInterval(() => {
        if (savingErrors[id]) {
          clearInterval(interval);
          delete savingIntervalsRef.current[id];
          return;
        }

        current += Math.floor(Math.random() * 10) + 8;
        if (current >= 95) {
          current = 95;
          clearInterval(interval);
          delete savingIntervalsRef.current[id];
        }

        setSavingProgress(prev => {
          if (prev[id] === undefined) return prev;
          const higher = Math.max(prev[id], current);
          return { ...prev, [id]: higher };
        });
      }, 300);

      savingIntervalsRef.current[id] = interval;
    });
  };

  // Écoute en temps réel de la file d'attente d'upload liée au Cloudflare Worker (D1/R2)
  useEffect(() => {
    const unsubscribe = UploadQueue.subscribe((queueState) => {
      const activeProg: Record<string, number> = {};
      const activeErrs: Record<string, string> = {};

      queueState.tasks.forEach(task => {
        if (task.category === 'videos' || task.id.startsWith('vid-')) {
          if (task.status === 'uploading' || task.status === 'pending') {
            activeProg[task.id] = Math.max(task.progress || 12, 12);
          } else if (task.status === 'completed') {
            activeProg[task.id] = 100;
            if (savingIntervalsRef.current[task.id]) {
              clearInterval(savingIntervalsRef.current[task.id]);
              delete savingIntervalsRef.current[task.id];
            }
          } else if (task.status === 'error') {
            activeErrs[task.id] = task.error || "Non enregistré sur le Cloud";
            if (savingIntervalsRef.current[task.id]) {
              clearInterval(savingIntervalsRef.current[task.id]);
              delete savingIntervalsRef.current[task.id];
            }
          }
        }
      });

      setSavingProgress(prev => {
        const next = { ...prev };
        Object.entries(activeProg).forEach(([id, pct]) => {
          if (pct >= 100) {
            next[id] = 100;
            // Une fois bien enregistré (100%), la ligne d'enregistrement disparaît après 400ms
            setTimeout(() => {
              setSavingProgress(curr => {
                const clean = { ...curr };
                delete clean[id];
                return clean;
              });
            }, 400);
          } else {
            next[id] = Math.max(prev[id] || 0, pct);
          }
        });
        // Si une tâche a échoué, on la retire de la barre de progression pour afficher l'alerte rouge
        Object.keys(activeErrs).forEach(id => {
          delete next[id];
        });
        return next;
      });

      setSavingErrors(prev => {
        const next = { ...prev, ...activeErrs };
        // Nettoyer les erreurs dont les tâches ont été réessayées avec succès
        queueState.tasks.forEach(task => {
          if ((task.status === 'uploading' || task.status === 'completed') && next[task.id]) {
            delete next[task.id];
          }
        });
        return next;
      });
    });

    return () => {
      unsubscribe();
      Object.values(savingIntervalsRef.current).forEach(int => clearInterval(int as any));
    };
  }, []);

  // Fonction universelle de fermeture du lecteur (ou réduction si plein écran/agrandi)
  const handleCloseReader = () => {
    if (isViewerMaximized) {
      setIsViewerMaximized(false);
    } else {
      setSelectedVideo(null);
      setIsViewerMaximized(false);
    }
  };

  // Gestion de la touche Échap pour réduire ou fermer le lecteur vidéo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isViewerMaximized) {
          setIsViewerMaximized(false);
        } else if (selectedVideo) {
          setSelectedVideo(null);
          setIsViewerMaximized(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerMaximized, selectedVideo]);

  // Effacer une vidéo dont l'enregistrement a échoué (Bouton Croix X)
  const handleDismissFailedUpload = (vidId: string) => {
    if (savingIntervalsRef.current[vidId]) {
      clearInterval(savingIntervalsRef.current[vidId]);
      delete savingIntervalsRef.current[vidId];
    }
    UploadQueue.removeTask(vidId);
    setSavingProgress(prev => {
      const next = { ...prev };
      delete next[vidId];
      return next;
    });
    setSavingErrors(prev => {
      const next = { ...prev };
      delete next[vidId];
      return next;
    });
    setVideosList(prev => prev.filter(v => v.id !== vidId));
    CloudDataStore.removeFile(vidId);
    deleteFileBlob(vidId).catch(() => {});
    if (selectedVideo?.id === vidId) {
      setSelectedVideo(null);
      setIsViewerMaximized(false);
    }
    showToast("Vidéo non enregistrée retirée.");
  };

  // Réessayer l'enregistrement d'une vidéo échouée
  const handleRetryUpload = (vidId: string) => {
    setSavingErrors(prev => {
      const next = { ...prev };
      delete next[vidId];
      return next;
    });
    startSavingAnimation([vidId]);
    UploadQueue.retryTask(vidId);
    showToast("Nouvelle tentative d'enregistrement...");
  };

  // État du menu 3 traits dédié à chaque vidéo (Image 2)
  const [activeMenuVideoId, setActiveMenuVideoId] = useState<string | null>(null);

  // Mode sélection & éléments cochés
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // États pour "Le déplacer / Créer une copie"
  const [isTransferPromptOpen, setIsTransferPromptOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'move' | 'copy'>('move');
  const [itemsToTransfer, setItemsToTransfer] = useState<FileItem[]>([]);
  const [classeur3DFolders, setClasseur3DFolders] = useState<ClasseurCreatedFolder[]>([]);
  const [transferSelectedFolderIds, setTransferSelectedFolderIds] = useState<string[]>([]);
  const [transferNavFolderId, setTransferNavFolderId] = useState<string | null>(null);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fermer le menu 3 traits si on clique en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.studycloud-file-menu-panel') || target.closest('.studycloud-menu-trigger')) {
        return;
      }
      setActiveMenuVideoId(null);
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  // Synchronisation continue ultra-légère avec TanStack Query
  useEffect(() => {
    if (serverVideos && Array.isArray(serverVideos)) {
      setVideosList(prev => {
        const serverIds = new Set(serverVideos.map(v => v.id));
        const pending = prev.filter(v => !serverIds.has(v.id) && Boolean(v.isUploading));
        return [...pending, ...serverVideos];
      });
      setLoading(false);
    }
  }, [serverVideos]);

  // Navigation vidéo dans le lecteur split
  const handleNavigateVideo = (direction: 'prev' | 'next') => {
    if (filteredVideos.length === 0) return;
    const currentIndex = selectedVideo
      ? filteredVideos.findIndex(v => v.id === selectedVideo.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredVideos.length - 1;
    if (newIndex >= filteredVideos.length) newIndex = 0;
    const nextVideo = filteredVideos[newIndex];
    if (nextVideo) {
      setSelectedVideo(nextVideo);
    }
  };

  // Import de vidéos : affichage immédiat (0ms) avec ligne de chargement animée comme Mes Fichiers
  const handleImportVideos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let files = Array.from(e.target.files) as File[];
    if (files.length > MAX_IMPORT_FILES) {
      showToast(`⚠️ Limite de ${MAX_IMPORT_FILES} vidéos max à la fois : seules les ${MAX_IMPORT_FILES} premières sont importées.`);
      files = files.slice(0, MAX_IMPORT_FILES);
    }

    const newItems: FileItem[] = [];
    const newFiles: { file: File; id: string }[] = [];
    const now = Date.now();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'MP4' : 'MP4';
      const fileId = `vid-${now}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(f);

      // Sauvegarde immédiate du blob dans IndexedDB (0ms) pour lecture locale instantanée
      storeFileBlob(fileId, f).catch(() => {});

      const item: FileItem = {
        id: fileId,
        name: f.name,
        category: 'videos',
        source: 'Vidéos',
        size: formatBytes(f.size),
        sizeBytes: f.size,
        date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        extension: ext,
        url: localBlobUrl,
        videoUrl: localBlobUrl,
        previewUrl: localBlobUrl,
        isVideo: true
      };

      newItems.push(item);
      newFiles.push({ file: f, id: fileId });
    }

    if (newItems.length === 0) return;

    // 1. AFFICHAGE IMMÉDIAT DANS LA GRILLE (0 milliseconde !)
    setVideosList(prev => [...newItems, ...prev]);

    // 2. Démarrage immédiat de la ligne de progression qui se remplit
    startSavingAnimation(newItems.map(it => it.id));

    // 2.5. Extraction immédiate de la frame d'aperçu vidéo (0.5s par canvas) pour chaque vidéo importée
    newFiles.forEach(({ file, id }) => {
      generateVideoThumbnail(file, id, file.name).then(thumbUrl => {
        if (thumbUrl) {
          setCachedMediaThumbnail(id, thumbUrl);
          storeThumbnailData(id, thumbUrl).catch(() => {});
          setVideosList(prev => prev.map(v => v.id === id ? { ...v, thumbnailUrl: thumbUrl, previewUrl: thumbUrl } : v));
          CloudDataStore.updateFile(id, { thumbnailUrl: thumbUrl, previewUrl: thumbUrl });
          CloudStorageAPI.saveMediaThumbnail(id, 'videos', thumbUrl, file.name).catch(() => {});
        }
      }).catch(() => {});
    });

    // 3. Ajout optimiste dans CloudDataStore
    newItems.forEach(it => {
      CloudDataStore.addOptimisticFile(it as any);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast(`${newItems.length} vidéo(s) ajoutée(s) — Enregistrement en cours...`);

    // 4. Traitement asynchrone en arrière-plan : compression spécialisée et upload Cloudflare Worker
    (async () => {
      const itemsWithFiles = await Promise.all(
        newFiles.map(async ({ file, id }) => {
          let fileToSend: File | Blob = file;
          let origBytes = file.size;
          let origFormatted = formatBytes(file.size);

          try {
            const comp = await compressFile(file, 'videos');
            fileToSend = comp.file;
            origBytes = comp.originalSizeBytes;
            origFormatted = comp.originalSizeFormatted;
            if (comp.file !== file) {
              await storeFileBlob(id, comp.file as any).catch(() => {});
            }
          } catch (err) {
            console.warn('[VideosMenuView] Compression vidéo échouée, utilisation brute:', err);
          }

          let thumbUrl: string | undefined;
          try {
            thumbUrl = getCachedMediaThumbnail(id) || (await generateVideoThumbnail(fileToSend, id, file.name)) || undefined;
            if (thumbUrl) {
              setCachedMediaThumbnail(id, thumbUrl);
              storeThumbnailData(id, thumbUrl).catch(() => {});
              CloudStorageAPI.saveMediaThumbnail(id, 'videos', thumbUrl, file.name).catch(() => {});
            }
          } catch {}

          const targetItem = newItems.find(it => it.id === id)!;
          const updatedItem = {
            ...targetItem,
            size: origFormatted,
            sizeBytes: origBytes,
            previewUrl: thumbUrl || targetItem.previewUrl,
            thumbnailUrl: thumbUrl || targetItem.previewUrl
          };

          return {
            file: fileToSend,
            item: updatedItem,
            originalSizeBytes: origBytes,
            originalSizeFormatted: origFormatted
          };
        })
      );

      // Transmission à UploadQueue pour envoi sur Worker R2 et confirmation D1
      UploadQueue.enqueueExisting(itemsWithFiles, { category: 'videos', uploadSource: 'videos' });
    })();
  };

  // Favoris
  const handleToggleFavorite = async (vid: FileItem) => {
    const nextState = !vid.isFavorite;
    setVideosList(prev =>
      prev.map(v => (v.id === vid.id ? { ...v, isFavorite: nextState } : v))
    );
    if (selectedVideo?.id === vid.id) {
      setSelectedVideo(prev => (prev ? { ...prev, isFavorite: nextState } : null));
    }
    CloudDataStore.toggleFavorite(vid.id, nextState);
    if (nextState) {
      await CloudStorageAPI.addFavorite(vid.id, 'videos').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(vid.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
  };

  // Suppression
  const handleDeleteVideo = async (vid: FileItem) => {
    if (!window.confirm(`Supprimer définitivement "${vid.name}" ?`)) return;

    const fileWithSource: FileItem = {
      ...vid,
      isTrash: true,
      category: 'videos'
    };

    setVideosList(prev => prev.filter(v => v.id !== vid.id));
    if (selectedVideo?.id === vid.id) {
      setSelectedVideo(null);
      setIsViewerMaximized(false);
    }
    setSelectedItemIds(prev => prev.filter(id => id !== vid.id));
    CloudDataStore.moveToTrash(fileWithSource as any);
    deleteFileBlob(vid.id).catch(() => {});
    await CloudStorageAPI.deleteVideo(vid.id).catch(() => {});
    invalidateCloudQueries.videos().catch(() => {});
    invalidateCloudQueries.overview().catch(() => {});
    showToast(`"${vid.name}" supprimé`);
  };

  // Téléchargement
  const handleDownload = async (vid: FileItem) => {
    let url = vid.videoUrl || vid.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(vid.id);
    }
    if (!url) {
      showToast('Fichier introuvable');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = vid.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Téléchargement de "${vid.name}"`);
  };

  // Partager
  const handleShare = (vid: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([vid]);
    } else {
      showToast('Partage StudyCloud');
    }
  };

  // Calcul dynamique de l'espace occupé par les vidéos
  const totalVideosBytes = useMemo(() => {
    return (videosList || []).reduce((acc, f) => acc + parseSizeToBytes(f?.size, f?.sizeBytes), 0);
  }, [videosList]);

  const formattedVideosSize = useMemo(() => {
    if (totalVideosBytes > 0) {
      if (totalVideosBytes < 1024) return `${totalVideosBytes} o`;
      if (totalVideosBytes < 1024 * 1024) return `${(totalVideosBytes / 1024).toFixed(1)} Ko`;
      if (totalVideosBytes < 1024 * 1024 * 1024) return `${(totalVideosBytes / (1024 * 1024)).toFixed(1)} Mo`;
      return `${(totalVideosBytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
    }
    return '0 Mo';
  }, [totalVideosBytes]);

  // Filtrage et tri (selon l'option sélectionnée)
  const filteredVideos = useMemo(() => {
    let list = videosList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(v => v.name.toLowerCase().includes(q));
    }
    return applyFileSorting(list, sortOption);
  }, [videosList, searchQuery, sortOption]);

  // Réinitialisation du défilement infini lors d'une nouvelle recherche ou tri
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [searchQuery, sortOption]);

  // Détection du défilement infini pour charger le lot suivant (12 vidéos par lot)
  useEffect(() => {
    if (visibleCount >= filteredVideos.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredVideos.length));
            setIsLoadingMore(false);
          }, 200);
        }
      },
      { rootMargin: '300px' }
    );

    const el = loadMoreSentinelRef.current;
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, [visibleCount, filteredVideos.length, isLoadingMore]);

  // Vidéos affichées au fur et à mesure du défilement infini (conservées en cache sans rafraîchissement)
  const displayedVideos = useMemo(() => {
    return filteredVideos.slice(0, visibleCount);
  }, [filteredVideos, visibleCount]);

  const isAllChecked = filteredVideos.length > 0 && filteredVideos.every(v => selectedItemIds.includes(v.id));

  // Traitement universel des 12 actions du menu 3 traits (Image 2)
  const handleMenuAction = async (action: string, vid: FileItem) => {
    setActiveMenuVideoId(null);

    switch (action) {
      case 'check': {
        const isChecked = selectedItemIds.includes(vid.id);
        const newSelected = isChecked
          ? selectedItemIds.filter(id => id !== vid.id)
          : [...selectedItemIds, vid.id];
        setSelectedItemIds(newSelected);
        setIsSelectionMode(newSelected.length > 0);
        showToast(isChecked ? `"${vid.name}" décoché` : `"${vid.name}" coché`);
        break;
      }

      case 'check_all': {
        if (isAllChecked) {
          setSelectedItemIds([]);
          setIsSelectionMode(false);
          showToast('Toutes les vidéos décochées');
        } else {
          setIsSelectionMode(true);
          setSelectedItemIds(filteredVideos.map(v => v.id));
          showToast(`Toutes les ${filteredVideos.length} vidéos cochées`);
        }
        break;
      }

      case 'download': {
        await handleDownload(vid);
        break;
      }

      case 'delete': {
        await handleDeleteVideo(vid);
        break;
      }

      case 'share': {
        handleShare(vid);
        break;
      }

      case 'create_link': {
        if (onOpenCreateShareLink) {
          onOpenCreateShareLink([{
            id: vid.id,
            name: vid.name,
            size: vid.sizeBytes || 0,
            type: vid.extension || 'MP4',
            url: vid.videoUrl || vid.url
          }]);
          showToast(`Création du lien pour "${vid.name}"...`);
        } else {
          const link = `${window.location.origin}${window.location.pathname}#video-${vid.id}`;
          try {
            await navigator.clipboard?.writeText(link);
            showToast('Lien copié dans le presse-papiers !');
          } catch {
            showToast(`Lien créé pour "${vid.name}"`);
          }
        }
        break;
      }

      case 'lock_file': {
        const securedFile: FileItem = {
          ...vid,
          isSecure: true,
          originalCategory: 'videos',
          originalSource: vid.source || 'Vidéos',
          source: 'Dossier Sécurisé'
        };
        setVideosList(prev => prev.filter(v => v.id !== vid.id));
        if (selectedVideo?.id === vid.id) {
          setSelectedVideo(null);
          setIsViewerMaximized(false);
        }
        CloudDataStore.moveToSecure(securedFile as any);
        CloudStorageAPI.moveToSecureFolder(vid, 'videos').catch(console.error);
        showToast(`"${vid.name}" verrouillé dans le dossier sécurisé !`);
        break;
      }

      case 'move': {
        const items = isSelectionMode && selectedItemIds.includes(vid.id) && selectedItemIds.length > 1
          ? filteredVideos.filter(f => selectedItemIds.includes(f.id))
          : [vid];
        setItemsToTransfer(items);
        setTransferSelectedFolderIds([]);
        setTransferNavFolderId(null);
        setTransferSearchQuery('');
        setIsTransferPromptOpen(true);
        break;
      }

      case 'duplicate': {
        const existingNames = videosList.map(v => v.name);
        const newName = computeDuplicateName(vid.name, existingNames);
        const newVid: FileItem = {
          ...vid,
          id: `vid-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: newName,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          isPinned: false
        };
        setVideosList(prev => [newVid, ...prev]);
        CloudDataStore.setVideos([newVid, ...videosList] as any);
        CloudStorageAPI.duplicateItem(vid.id, 'videos', undefined, newName).catch(console.error);
        showToast(`Vidéo dupliquée : "${newName}" !`);
        break;
      }

      case 'favorite': {
        await handleToggleFavorite(vid);
        break;
      }

      case 'pin': {
        const nextPinned = !vid.isPinned;
        setVideosList(prev => {
          const updated = prev.map(v => (v.id === vid.id ? { ...v, isPinned: nextPinned } : v));
          if (nextPinned) {
            const item = updated.find(v => v.id === vid.id);
            return item ? [item, ...updated.filter(v => v.id !== vid.id)] : updated;
          }
          return updated;
        });
        CloudDataStore.updateFile(vid.id, { isPinned: nextPinned });
        if (nextPinned) {
          CloudStorageAPI.addPinned(vid.id, 'videos').catch(console.error);
          showToast(`"${vid.name}" épinglé !`);
        } else {
          CloudStorageAPI.removePinned(vid.id).catch(console.error);
          showToast(`"${vid.name}" désépinglé`);
        }
        break;
      }

      case 'rename': {
        const newName = window.prompt('Modifier le nom de la vidéo :', vid.name);
        if (newName && newName.trim() && newName.trim() !== vid.name) {
          const trimmed = newName.trim();
          setVideosList(prev =>
            prev.map(v => (v.id === vid.id ? { ...v, name: trimmed } : v))
          );
          if (selectedVideo?.id === vid.id) {
            setSelectedVideo(prev => (prev ? { ...prev, name: trimmed } : null));
          }
          CloudDataStore.updateFile(vid.id, { name: trimmed });
          CloudStorageAPI.renameItem(vid.id, trimmed, 'videos').catch(console.error);
          showToast(`Vidéo renommée en "${trimmed}" !`);
        }
        break;
      }

      default:
        break;
    }
  };

  // Exécution du transfert (Déplacer ou Copier) vers les dossiers sélectionnés du Classeur
  const handleExecuteTransfer = async () => {
    if (transferSelectedFolderIds.length === 0 || itemsToTransfer.length === 0 || isTransferring) return;
    setIsTransferring(true);

    try {
      await CloudStorageAPI.moveOrCopyItems(itemsToTransfer, transferSelectedFolderIds, transferMode);

      if (transferMode === 'move') {
        const idsToRemove = new Set(itemsToTransfer.map(i => i.id));
        setVideosList(prev => prev.filter(v => !idsToRemove.has(v.id)));
        CloudDataStore.setVideos(videosList.filter(v => !idsToRemove.has(v.id)) as any);

        setSelectedItemIds(prev => prev.filter(id => !idsToRemove.has(id)));
        if (selectedItemIds.length <= itemsToTransfer.length) {
          setIsSelectionMode(false);
        }
        if (selectedVideo && idsToRemove.has(selectedVideo.id)) {
          setSelectedVideo(null);
          setIsViewerMaximized(false);
        }
      }

      const successMsg = transferMode === 'move'
        ? `${itemsToTransfer.length} vidéo(s) déplacée(s) avec succès !`
        : `${itemsToTransfer.length} vidéo(s) copiée(s) avec succès !`;
      showToast(successMsg);

      setIsTransferModalOpen(false);
      setTransferSelectedFolderIds([]);
      setTransferNavFolderId(null);
      setTransferSearchQuery('');
      setItemsToTransfer([]);
    } catch (err: any) {
      console.error('Erreur lors du transfert:', err);
      showToast('Erreur lors du traitement du transfert');
    } finally {
      setIsTransferring(false);
    }
  };

  // =========================================================================
  // MODAL PROMPT DU CHOIX ENTRE "DÉPLACER" ET "CRÉER UNE COPIE"
  // =========================================================================
  const renderTransferPromptModal = () => {
    if (!isTransferPromptOpen) return null;

    const count = itemsToTransfer.length;
    const titleText = count === 1 
      ? `Que souhaitez-vous faire avec "${itemsToTransfer[0]?.name}" ?`
      : `Que souhaitez-vous faire avec ces ${count} vidéos ?`;

    const content = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 pointer-events-auto select-none"
        onClick={() => setIsTransferPromptOpen(false)}
      >
        <div 
          className="relative w-full max-w-[420px] bg-[#0A0F1D] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.1)] text-white animate-in zoom-in-95 duration-150 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner shrink-0">
                <FolderInput className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-white leading-tight">Déplacer ou Copier</h3>
                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5" title={titleText}>
                  {titleText}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsTransferPromptOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Choix 1 : Déplacer */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => {
                setTransferMode('move');
                setIsTransferPromptOpen(false);
                setIsTransferModalOpen(true);
                CloudStorageAPI.getClasseurFolders().then(folders => {
                  if (folders && Array.isArray(folders)) setClasseur3DFolders(folders);
                }).catch(() => {});
              }}
              className="group p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/60 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-md active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FolderInput className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-amber-200 group-hover:text-amber-100">Déplacer</span>
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    Retiré d'ici
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Transfère {count > 1 ? 'ces vidéos' : 'cette vidéo'} vers le(s) dossier(s) choisi(s) et la retire d'ici.
                </p>
              </div>
            </button>

            {/* Choix 2 : Créer une copie */}
            <button
              type="button"
              onClick={() => {
                setTransferMode('copy');
                setIsTransferPromptOpen(false);
                setIsTransferModalOpen(true);
                CloudStorageAPI.getClasseurFolders().then(folders => {
                  if (folders && Array.isArray(folders)) setClasseur3DFolders(folders);
                }).catch(() => {});
              }}
              className="group p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/60 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-md active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Copy className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-emerald-200 group-hover:text-emerald-100">Créer une copie</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Conserve l'original
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Garde l'original intact dans le menu Vidéos et ajoute une copie dans le(s) dossier(s) choisi(s).
                </p>
              </div>
            </button>
          </div>

          {/* Bouton Annuler */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsTransferPromptOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
  };

  // =========================================================================
  // MODAL DE SÉLECTION DU DOSSIER RÉCEPTEUR
  // =========================================================================
  const renderTransferFolderModal = () => {
    if (!isTransferModalOpen) return null;

    let displayedFolders = classeur3DFolders;
    if (transferSearchQuery.trim()) {
      const q = transferSearchQuery.trim().toLowerCase();
      displayedFolders = classeur3DFolders.filter(f => f.name.toLowerCase().includes(q));
    } else if (transferNavFolderId) {
      displayedFolders = classeur3DFolders.filter(f => f.parentId === transferNavFolderId);
    } else {
      displayedFolders = classeur3DFolders.filter(f => !f.parentId);
    }

    const currentNavFolder = transferNavFolderId ? classeur3DFolders.find(f => f.id === transferNavFolderId) : null;
    const parentNavFolder = currentNavFolder?.parentId ? classeur3DFolders.find(f => f.id === currentNavFolder.parentId) : null;

    const toggleFolderCheck = (folderId: string) => {
      setTransferSelectedFolderIds(prev => 
        prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
      );
    };

    const isSelectionActive = transferSelectedFolderIds.length > 0;

    const content = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 pointer-events-auto select-none"
        onClick={() => {
          setIsTransferModalOpen(false);
          setTransferNavFolderId(null);
          setTransferSearchQuery('');
        }}
      >
        <div 
          className="relative w-full max-w-[440px] max-h-[82vh] bg-[#0A0F1D] border-2 border-amber-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête : Titre & Bouton de fermeture */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 bg-[#070B14] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${transferMode === 'move' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} border flex items-center justify-center`}>
                {transferMode === 'move' ? <FolderInput className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                {transferMode === 'move' ? 'Déplacer vers un dossier' : 'Créer une copie dans...'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferNavFolderId(null);
                setTransferSearchQuery('');
              }}
              className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barre de recherche et compteurs */}
          <div className="p-3.5 border-b border-white/10 bg-[#0E1526] space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={transferSearchQuery}
                onChange={(e) => setTransferSearchQuery(e.target.value)}
                placeholder="Trouver un dossier rapidement..."
                className="w-full bg-[#0A0F1D] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {transferSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTransferSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compteurs */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                {transferSelectedFolderIds.length} dossier{transferSelectedFolderIds.length > 1 ? 's' : ''} coché{transferSelectedFolderIds.length > 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-semibold flex items-center gap-1.5">
                {itemsToTransfer.length} vidéo{itemsToTransfer.length > 1 ? 's' : ''} à {transferMode === 'move' ? 'déplacer' : 'copier'}
              </span>
            </div>

            {/* Fil d'Ariane */}
            {!transferSearchQuery && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-xs overflow-x-auto no-scrollbar">
                {transferNavFolderId && (
                  <button
                    type="button"
                    onClick={() => setTransferNavFolderId(currentNavFolder?.parentId || null)}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Retour"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">Retour</span>
                  </button>
                )}
                
                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                  {parentNavFolder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setTransferNavFolderId(parentNavFolder.id)}
                        className="text-[11px] font-semibold text-white/40 hover:text-white/60 truncate cursor-pointer transition-colors"
                        title={parentNavFolder.name}
                      >
                        {parentNavFolder.name}
                      </button>
                      <span className="text-white/30 text-xs">/</span>
                    </>
                  ) : currentNavFolder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setTransferNavFolderId(null)}
                        className="text-[11px] font-semibold text-white/40 hover:text-white/60 truncate cursor-pointer transition-colors"
                      >
                        Classeur
                      </button>
                      <span className="text-white/30 text-xs">/</span>
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">Racine du Classeur</span>
                  )}

                  {currentNavFolder && (
                    <span
                      className="text-[11px] font-black px-2 py-0.5 rounded-md border truncate shadow-xs"
                      style={{
                        color: currentNavFolder.primaryColor || '#F59E0B',
                        borderColor: `${currentNavFolder.primaryColor || '#F59E0B'}40`,
                        backgroundColor: `${currentNavFolder.primaryColor || '#F59E0B'}15`
                      }}
                    >
                      {currentNavFolder.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Liste des dossiers */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[220px] max-h-[380px]">
            {displayedFolders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <FolderArchive className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Aucun dossier trouvé</p>
                <p className="text-[11px] text-slate-500">
                  {transferSearchQuery ? 'Aucun résultat pour cette recherche' : 'Ce dossier ne contient aucun sous-dossier'}
                </p>
              </div>
            ) : (
              displayedFolders.map(folder => {
                const isChecked = transferSelectedFolderIds.includes(folder.id);
                const subCount = classeur3DFolders.filter(f => f.parentId === folder.id).length;

                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      if (!transferSearchQuery) {
                        setTransferNavFolderId(folder.id);
                      }
                    }}
                    className={`group flex items-center justify-between gap-2.5 p-2.5 rounded-2xl transition-all border cursor-pointer ${
                      isChecked
                        ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFolderCheck(folder.id);
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white shrink-0 cursor-pointer"
                        title={isChecked ? 'Décocher ce dossier' : 'Cocher ce dossier'}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400 hover:text-white" />
                        )}
                      </button>

                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border"
                        style={{
                          backgroundColor: folder.primaryColor || '#E76239',
                          borderColor: lightenColor(folder.primaryColor || '#E76239', 20),
                          color: folder.textDark ? '#0F172A' : '#FFFFFF'
                        }}
                      >
                        <FolderArchive className="w-4 h-4 stroke-[2.2]" />
                      </div>

                      <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-200 transition-colors">
                        {folder.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {subCount > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] sm:text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {subCount} sous-dossier{subCount > 1 ? 's' : ''}
                          </span>
                          {!transferSearchQuery && (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 transition-colors" />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 px-1">
                          0 sous-dossier
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Boutons d'action en bas */}
          <div className="p-3.5 border-t border-white/10 bg-[#070B14] shrink-0 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferNavFolderId(null);
                setTransferSearchQuery('');
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={!isSelectionActive || isTransferring}
              onClick={handleExecuteTransfer}
              className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg ${
                isSelectionActive && !isTransferring
                  ? transferMode === 'move'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-amber-500/20 active:scale-95'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-emerald-500/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              {isTransferring ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Transfert en cours...</span>
                </>
              ) : (
                <>
                  {transferMode === 'move' ? <FolderInput className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {transferMode === 'move' ? 'Déplacer ici' : 'Copier ici'} ({transferSelectedFolderIds.length})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
  };

  // =========================================================================
  // RENDU DU MENU 3 TRAITS DÉDIÉ ET INDÉPENDANT POUR CHAQUE VIDÉO (IMAGE 2)
  // =========================================================================
  const renderVideoOptionsMenu = (vid: FileItem, index?: number) => {
    // Aligner à droite si colonne de droite pour éviter de déborder de l'écran
    const isRightCol = typeof index === 'number' && (
      (index % 2 === 1) || 
      (Boolean(selectedVideo) && (index + 1) % 3 === 0) ||
      ((index + 1) % (selectedVideo ? 3 : 5) === 0)
    );
    const align: 'left' | 'right' = isRightCol ? 'right' : 'left';
    const isChecked = selectedItemIds.includes(vid.id);

    return (
      <div 
        className={`studycloud-file-menu-panel absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-[100] w-64 bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(59,130,246,0.25)] text-slate-200 rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de menu dédié avec nom du fichier et bouton fermeture (Image 2) */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={vid.name}>
              {vid.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {vid.size || 'Vidéo'} • <span className="uppercase text-amber-400">{vid.extension || 'MP4'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuVideoId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste déroulante des 12 options avec défilement fluide garanti (Image 2) */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          {/* Section 1 : Sélection (Cocher, Tout cocher, Télécharger) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleMenuAction('check', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{isChecked ? 'Décocher' : 'Cocher'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('check_all', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{isAllChecked ? 'Tout décocher' : 'Tout cocher'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('download', vid)}
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
              onClick={() => handleMenuAction('delete', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Supprimer le fichier</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('share', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>Partager</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('create_link', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Link className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              <span>Créer un lien</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('lock_file', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer text-left"
              title="Verrouiller ce fichier dans le dossier sécurisé"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Verrouiller</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('move', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <FolderInput className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Le déplacer / Créer une copie</span>
            </button>
          </div>

          {/* Section 3 : Organisation & Édition */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleMenuAction('duplicate', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Copy className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Dupliquer</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('favorite', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${vid.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-400'}`} />
              <span>{vid.isFavorite ? 'Retirer des favoris' : 'Ajouter au favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('pin', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pin className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>{vid.isPinned ? 'Désépingler' : 'Épinglez'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('rename', vid)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span>Modifier le nom</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDU D'UNE CARTE VIDÉO (IMAGE 1 & 2 AVEC SUIVI ENREGISTREMENT ET ERREUR ROUGE)
  // =========================================================================
  const renderVideoCard = (vid: FileItem, index: number) => {
    const isSelected = selectedVideo?.id === vid.id;
    const isMenuOpen = activeMenuVideoId === vid.id;
    const isChecked = selectedItemIds.includes(vid.id);

    // Suivi d'enregistrement temps réel lié au Worker R2/D1 (comme Mes Fichiers)
    const isSaving = savingProgress[vid.id] !== undefined;
    const progressVal = savingProgress[vid.id] || 0;
    const saveError = savingErrors[vid.id];
    const hasFailed = Boolean(saveError);

    return (
      <div
        key={vid.id}
        onClick={() => {
          if (hasFailed) {
            showToast("Enregistrement échoué. Utilisez la croix pour effacer ou le bouton Réessayer.");
            return;
          }
          if (isSaving) {
            showToast("Enregistrement de la vidéo en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            const next = isChecked
              ? selectedItemIds.filter(id => id !== vid.id)
              : [...selectedItemIds, vid.id];
            setSelectedItemIds(next);
            if (next.length === 0) setIsSelectionMode(false);
          } else {
            setSelectedVideo(vid);
          }
        }}
        className={`group relative aspect-[4/5] rounded-2xl bg-[#0A0E18] border transition-all duration-200 select-none ${
          hasFailed
            ? 'border-rose-500 ring-4 ring-rose-500/50 shadow-2xl bg-rose-950/40 cursor-default'
            : isSaving
              ? 'border-emerald-500/40 cursor-wait'
              : isChecked
                ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02] cursor-pointer'
                : isSelected 
                  ? 'border-purple-500 ring-4 ring-purple-500/50 shadow-2xl scale-[1.02] cursor-pointer' 
                  : 'border-white/10 hover:border-purple-400/50 shadow-md cursor-pointer'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
      >
        {/* 1. LIGNE DU HAUT QUI SE REMPLIT EN TEMPS RÉEL (OU DEVIENT ROUGE EN CAS D'ÉCHEC) */}
        {isSaving && !hasFailed && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/60 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_10px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}
        {hasFailed && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-500 z-35 overflow-hidden pointer-events-none rounded-t-2xl shadow-[0_0_10px_#f43f5e]" />
        )}

        {/* 2. OVERLAY D'ENREGISTREMENT EN TEMPS RÉEL */}
        {isSaving && !hasFailed && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-white pointer-events-none rounded-2xl animate-in fade-in duration-200">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-2" />
            <span className="text-xs font-black text-emerald-300 tracking-wider">
              {progressVal}%
            </span>
            <span className="text-[10px] font-bold text-white/90 text-center leading-tight mt-1">
              Enregistrement Cloud...
            </span>
            <span className="text-[8px] text-emerald-400/80 mt-0.5 font-mono">
              Worker R2 en direct
            </span>
          </div>
        )}

        {/* 3. OVERLAY D'ÉCHEC : DEVIENT ROUGE, SIGNALE QUE C'EST PAS ENREGISTRÉ, AVEC BOUTON CROIX (X) POUR EFFACER */}
        {hasFailed && (
          <div className="absolute inset-0 z-30 bg-rose-950/92 backdrop-blur-[3px] border border-rose-500/50 flex flex-col items-center justify-between p-2.5 sm:p-3 text-white rounded-2xl animate-in fade-in duration-200">
            {/* Haut de la carte d'échec : Badge et Bouton Croix (X) pour effacer */}
            <div className="w-full flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-rose-300 bg-rose-900/70 px-2 py-0.5 rounded-full border border-rose-500/40">
                Non enregistré
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissFailedUpload(vid.id);
                }}
                className="w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                title="Effacer la vidéo non enregistrée (Croix)"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Centre : Message d'avertissement */}
            <div className="flex flex-col items-center text-center my-auto px-1">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-1.5 shadow-md">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-[11px] font-black text-rose-200 leading-tight">
                Échec d'enregistrement
              </p>
              <p className="text-[9px] text-rose-300/85 line-clamp-2 mt-1 leading-snug">
                {saveError || "Fichier non enregistré sur le Cloud"}
              </p>
            </div>

            {/* Bas : Boutons Réessayer et Effacer */}
            <div className="w-full flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetryUpload(vid.id);
                }}
                className="flex-1 py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Réessayer l'enregistrement"
              >
                <RotateCcw className="w-3 h-3 text-emerald-400" />
                <span>Réessayer</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissFailedUpload(vid.id);
                }}
                className="py-1 px-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Effacer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Effacer</span>
              </button>
            </div>
          </div>
        )}

        {/* Conteneur média interne avec overflow-hidden : arrondit la vignette sans couper le menu déroulant */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <VideoCardPreview vid={vid} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors" />

          {/* Centre : Bouton Play blanc circulaire avec triangle noir (Image 1) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white/95 text-stone-950 flex items-center justify-center shadow-2xl group-hover:scale-115 transition-transform duration-200">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-stone-950 translate-x-0.5" />
            </div>
          </div>

          {/* Titre en bas avec fond gradient sombre (Image 1) */}
          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/95 via-black/50 to-transparent">
            <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">
              {vid.name}
            </p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox & Badges (Image 1 & 2) */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuVideoId(isMenuOpen ? null : vid.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de la vidéo (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {isMenuOpen && renderVideoOptionsMenu(vid, index)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = isChecked
                  ? selectedItemIds.filter(id => id !== vid.id)
                  : [...selectedItemIds, vid.id];
                setSelectedItemIds(next);
                if (next.length === 0) setIsSelectionMode(false);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? 'Décocher' : 'Cocher'}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Badges Épinglé et Favori */}
          {vid.isPinned && (
            <span className="p-1 rounded-md bg-black/75 text-purple-400 border border-purple-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
              <Pin className="w-3 h-3 rotate-45" />
            </span>
          )}
          {vid.isFavorite && (
            <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </span>
          )}
        </div>

        {/* Haut droit : Badge de taille (Image 1) */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {vid.size || 'HD'}
          </span>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDU DU LECTEUR VIDÉO DÉDIÉ (IMAGE 4)
  // =========================================================================
  const renderVideoPlayer = (file: FileItem) => {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const fallbackStreamUrl = file.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(file.id)}` : '';
    const videoSrc = file.videoUrl || file.url || fallbackStreamUrl;

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur vidéo */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateVideo('prev')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Vidéo précédente"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateVideo('next')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Vidéo suivante"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-purple-400 font-semibold truncate">
                {file.size || 'Vidéo'} • 1080P HD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleFavorite(file)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                file.isFavorite
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/40'
                  : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
              }`}
              title={file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => handleShare(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDownload(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(file, 'Vidéos', videosList)}
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
              title={isViewerMaximized ? 'Réduire la vue' : 'Plein écran'}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>
            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur vidéo"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur vidéo */}
        <div className="flex-1 w-full h-full flex items-center justify-center relative p-1 sm:p-2 overflow-hidden">
          <ModernVideoPlayer
            src={videoSrc}
            poster={file.previewUrl}
            fileName={file.name}
            fileId={file.id}
            fileSize={file.size}
            autoPlay={false}
            className="w-full h-full max-h-[calc(100vh-180px)] rounded-2xl"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-50 dark:bg-[#070B14] overflow-hidden select-none">
      {/* Toast de confirmation */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-black/90 text-white border border-white/20 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Input d'importation de vidéo */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportVideos}
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv"
        multiple
        className="hidden"
      />

      {/* Modals de transfert "Déplacer / Créer une copie" */}
      {renderTransferPromptModal()}
      {renderTransferFolderModal()}

      {/* EN-TÊTE FIXE DU MENU VIDÉOS */}
      <header className="sticky top-0 z-30 w-full bg-[#04060A] backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/30 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Retour et Titre */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isViewerMaximized) {
                  setIsViewerMaximized(false);
                } else if (selectedVideo) {
                  setSelectedVideo(null);
                  setIsViewerMaximized(false);
                } else {
                  onBack();
                }
              }}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title={isViewerMaximized ? "Réduire la vue" : selectedVideo ? "Fermer la vidéo" : "Retour"}
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">{isViewerMaximized ? "Réduire" : "Retour"}</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-purple-400">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Vidéos
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">
                  {videosList.length} vidéo{videosList.length > 1 ? 's' : ''} • {formattedVideosSize}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-purple-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Vidéos..."
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

          {/* DROITE : Espace d'étude & + Importer */}
          <div className="shrink-0 flex items-center gap-2">
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(selectedVideo || undefined, 'Vidéos', videosList)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#101827] text-emerald-400 border border-emerald-500/30 transition-all font-bold text-xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Espace d'étude</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-purple-400 border border-purple-500/40 hover:border-purple-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer une vidéo"
            >
              <Plus className="w-4 h-4 text-purple-400 stroke-[2.5]" />
              <span>+ Importer</span>
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
      </header>

      {/* DISPOSITION SPLIT (IMAGE 4) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES VIDÉOS (IMAGE 1) */}
        <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
          isViewerMaximized && selectedVideo
            ? 'hidden'
            : selectedVideo
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
              : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
        }`}>
          <div className="space-y-3 sm:space-y-4">
            {/* SOUS-TITRE : NOMBRE DE VIDÉOS DISPONIBLES ET CONTRÔLE D'AFFICHAGE */}
            {/* SOUS-TITRE : NOMBRE DE VIDÉOS DISPONIBLES */}
            <div className="flex items-center justify-between border-b border-stone-200/60 dark:border-white/5 pb-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                  {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
                </span>
                {filteredVideos.length > BATCH_SIZE && (
                  <span className="text-[10px] text-purple-400 font-semibold">
                    ({displayedVideos.length} affichée{displayedVideos.length > 1 ? 's' : ''})
                  </span>
                )}
              </div>

              {isSelectionMode && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemIds([]);
                    setIsSelectionMode(false);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                >
                  Quitter la sélection
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-20 text-center text-stone-400">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Chargement des vidéos...</p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                {sortOption === 'duplicates' ? (
                  <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                ) : (
                  <Film className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-purple-400" />
                )}
                <p className={`text-sm font-semibold ${sortOption === 'duplicates' ? 'text-rose-400' : ''}`}>
                  {sortOption === 'duplicates'
                    ? 'Aucun résultat pour les doublons'
                    : 'Aucune vidéo disponible'}
                </p>
                <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                  {sortOption === 'duplicates'
                    ? 'Toutes vos vidéos sont uniques dans la base de données. Aucun doublon détecté.'
                    : 'Ce dossier ne contient aucune vidéo pour le moment.'}
                </p>
                {sortOption === 'duplicates' && (
                  <button
                    type="button"
                    onClick={() => setSortOption('recent')}
                    className="mt-3 px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Afficher toutes les vidéos
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* GRILLE DES CARTES VIDÉOS AVEC DÉFILEMENT INFINI (12 PAR LOT) */}
                <div className={`grid gap-3 sm:gap-4 ${
                  selectedVideo
                    ? 'grid-cols-2 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                }`}>
                  {displayedVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                </div>

                {/* Sentinelle de Défilement Infini (charge automatiquement le lot suivant de 12) */}
                {visibleCount < filteredVideos.length && (
                  <div ref={loadMoreSentinelRef} className="pt-6 pb-12 flex flex-col items-center justify-center">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-950/50 border border-purple-500/40 text-purple-300 text-xs font-semibold animate-pulse shadow-lg">
                        <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span>Chargement des 12 vidéos suivantes...</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredVideos.length));
                        }}
                        className="px-5 py-2 rounded-full bg-[#0A0E18] hover:bg-[#141B2D] text-purple-300 hover:text-purple-200 border border-purple-500/40 hover:border-purple-400 text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-1.5"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                        <span>Charger la suite (+{Math.min(BATCH_SIZE, filteredVideos.length - visibleCount)})</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* PANNEAU DE DROITE : LECTEUR VIDÉO DÉDIÉ (IMAGE 4) */}
        {selectedVideo && (
          <div className={`flex flex-col bg-[#04060A] animate-in fade-in duration-150 ${
            isViewerMaximized && selectedVideo
              ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderVideoPlayer(selectedVideo)}
          </div>
        )}
      </div>

      {/* BARRE D'ACTIONS FLOTTANTE EN MODE SÉLECTION */}
      {isSelectionMode && selectedItemIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0A0E1A]/95 backdrop-blur-md border border-purple-500/40 rounded-full px-4 sm:px-6 py-2.5 shadow-2xl flex items-center gap-3 sm:gap-4 text-white text-xs sm:text-sm animate-in slide-in-from-bottom-4 duration-200">
          <span className="font-bold text-purple-300">
            {selectedItemIds.length} sélectionnée{selectedItemIds.length > 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => {
              const toDownload = filteredVideos.filter(v => selectedItemIds.includes(v.id));
              toDownload.forEach(handleDownload);
            }}
            className="flex items-center gap-1.5 hover:text-blue-400 font-semibold cursor-pointer transition-colors"
            title="Télécharger la sélection"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const items = filteredVideos.filter(v => selectedItemIds.includes(v.id));
              setItemsToTransfer(items);
              setTransferSelectedFolderIds([]);
              setTransferNavFolderId(null);
              setTransferSearchQuery('');
              setIsTransferPromptOpen(true);
            }}
            className="flex items-center gap-1.5 hover:text-amber-400 font-semibold cursor-pointer transition-colors"
            title="Déplacer ou copier la sélection"
          >
            <FolderInput className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Déplacer/Copier</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Supprimer les ${selectedItemIds.length} vidéo(s) sélectionnée(s) ?`)) return;
              const toDelete = filteredVideos.filter(v => selectedItemIds.includes(v.id));
              toDelete.forEach(v => {
                handleMenuAction('delete', v);
              });
              setSelectedItemIds([]);
              setIsSelectionMode(false);
            }}
            className="flex items-center gap-1.5 hover:text-rose-400 font-semibold cursor-pointer transition-colors"
            title="Supprimer la sélection"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedItemIds([]);
              setIsSelectionMode(false);
            }}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Annuler la sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
