import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Music,
  Search,
  Plus,
  Star,
  Share2,
  Download,
  Trash2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  X,
  Menu,
  BookOpen,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Check,
  Link,
  Lock,
  FolderInput,
  Copy,
  Pin,
  Pencil,
  FolderArchive
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { useAudioList } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { storeFileBlob, getFileBlobUrl, getFileBlob, deleteFileBlob, storeThumbnailData } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { extractAudioCover, generateAudioCreatorCover, extractAudioMetadataWithTags, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { AudioCardPreview } from './AudioCardPreview';
import { getWorkerApiUrl } from '../services/api';
import { ClasseurCreatedFolder, lightenColor } from './Folder3DModels';
import { HeaderMenuControls, applyFileSorting, type SortOption, parseSizeToBytes } from './HeaderMenuControls';

interface AudioMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

export const AudioMenuView: React.FC<AudioMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { data: serverAudio = [], isLoading: isAudioQueryLoading } = useAudioList();
  const [audioList, setAudioList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().audio || [];
  });
  const [loading, setLoading] = useState(true);

  // Pagination / Chargement par lots (30 sons à la fois pour un DOM ultra-léger et zéro OOM)
  const BATCH_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [selectedTrack, setSelectedTrack] = useState<FileItem | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioShuffle, setIsAudioShuffle] = useState(false);
  const [isAudioRepeat, setIsAudioRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [splitResolvedAudioUrl, setSplitResolvedAudioUrl] = useState<string>('');
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isPlayerMenuOpen, setIsPlayerMenuOpen] = useState(false);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // Mode sélection & menu 3 traits
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modales de transfert (Déplacer / Créer une copie) vers le Classeur
  const [itemsToTransfer, setItemsToTransfer] = useState<FileItem[]>([]);
  const [isTransferPromptOpen, setIsTransferPromptOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'move' | 'copy'>('move');
  const [transferSelectedFolderIds, setTransferSelectedFolderIds] = useState<string[]>([]);
  const [transferNavFolderId, setTransferNavFolderId] = useState<string | null>(null);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [classeur3DFolders, setClasseur3DFolders] = useState<ClasseurCreatedFolder[]>([]);

  // Progression d'enregistrement et gestion d'erreurs en temps réel (comme dans Vidéos et Images)
  const [savingProgress, setSavingProgress] = useState<Record<string, number>>({});
  const [savingErrors, setSavingErrors] = useState<Record<string, string>>({});
  const savingIntervalsRef = useRef<Record<string, any>>({});
  const pendingAudioItemsRef = useRef<Map<string, FileItem>>(new Map());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper pour fusionner les données serveur avec les sons en cours d'enregistrement (identique à Vidéos et Images)
  const mergeAudioWithPending = (serverList: any[], currentList: FileItem[]): FileItem[] => {
    if (!serverList || !Array.isArray(serverList)) return currentList || [];
    const serverIds = new Set(serverList.map(t => t.id));
    const pending = (currentList || []).filter(item => 
      !serverIds.has(item.id) && (
        item.isUploading ||
        (savingProgress[item.id] !== undefined && savingProgress[item.id] < 100) ||
        pendingAudioItemsRef.current.has(item.id)
      )
    );
    return [...pending, ...(serverList as FileItem[])];
  };

  // Fermer le menu 3 traits si on clique en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.studycloud-file-menu-panel') || target.closest('.studycloud-menu-trigger')) {
        return;
      }
      setActiveMenuTrackId(null);
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  // Animation et suivi en continu de la ligne de progression qui se remplit (comme dans Mes fichiers)
  const startSavingAnimation = (fileIds: string[]) => {
    if (!fileIds || fileIds.length === 0) return;

    setSavingProgress(prev => {
      const next = { ...prev };
      fileIds.forEach(id => {
        next[id] = Math.max(next[id] || 0, 12);
      });
      return next;
    });

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

        current += Math.floor(Math.random() * 15) + 12;
        if (current >= 100) {
          current = 100;
          clearInterval(interval);
          delete savingIntervalsRef.current[id];

          setSavingProgress(prev => ({ ...prev, [id]: 100 }));
          setTimeout(() => {
            setSavingProgress(curr => {
              const clean = { ...curr };
              delete clean[id];
              return clean;
            });
          }, 450);
        } else {
          setSavingProgress(prev => {
            if (prev[id] === undefined) return prev;
            return { ...prev, [id]: Math.max(prev[id], current) };
          });
        }
      }, 350);

      savingIntervalsRef.current[id] = interval;
    });
  };

  // Écoute en temps réel de la file d'attente d'upload liée au Cloudflare Worker (D1/R2)
  useEffect(() => {
    const unsubscribe = UploadQueue.subscribe((queueState) => {
      const activeProg: Record<string, number> = {};
      const activeErrs: Record<string, string> = {};

      queueState.tasks.forEach(task => {
        if (task.category === 'audio' || task.id.startsWith('aud-')) {
          if (task.status === 'uploading' || task.status === 'pending') {
            activeProg[task.id] = Math.max(task.progress || 12, 12);
          } else if (task.status === 'completed') {
            activeProg[task.id] = 100;
            if (savingIntervalsRef.current[task.id]) {
              clearInterval(savingIntervalsRef.current[task.id]);
              delete savingIntervalsRef.current[task.id];
            }
            // Mise à jour immédiate dès confirmation d'enregistrement en base en conservant les sons en cours
            CloudStorageAPI.getAudioList().then((data) => {
              if (data && Array.isArray(data)) {
                setAudioList(prev => mergeAudioWithPending(data, prev));
                CloudDataStore.setAudio(data as any);
                setSelectedTrack(curr => {
                  if (!curr) return null;
                  const updated = data.find(x => x.id === curr.id || x.name === curr.name);
                  return updated || curr;
                });
              }
            }).catch(() => {});
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
            setTimeout(() => {
              setSavingProgress(curr => {
                const clean = { ...curr };
                delete clean[id];
                return clean;
              });
            }, 450);
          } else {
            next[id] = Math.max(prev[id] || 0, pct);
          }
        });
        Object.keys(activeErrs).forEach(id => {
          delete next[id];
        });
        return next;
      });

      setSavingErrors(prev => {
        const next = { ...prev, ...activeErrs };
        queueState.tasks.forEach(task => {
          if ((task.status === 'uploading' || task.status === 'completed') && next[task.id]) {
            delete next[task.id];
          }
        });
        return next;
      });
    });

    const handleUploadedEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || detail.category === 'audio' || String(detail.fileId).startsWith('aud-')) {
        CloudStorageAPI.getAudioList().then((data) => {
          if (data && Array.isArray(data)) {
            setAudioList(prev => mergeAudioWithPending(data, prev));
            CloudDataStore.setAudio(data as any);
            setSelectedTrack(curr => {
              if (!curr) return null;
              const updated = data.find(x => x.id === curr.id || x.name === curr.name);
              return updated || curr;
            });
          }
        }).catch(() => {});
      }
    };
    window.addEventListener('studycloud_file_uploaded', handleUploadedEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('studycloud_file_uploaded', handleUploadedEvent);
      Object.values(savingIntervalsRef.current).forEach(int => clearInterval(int as any));
    };
  }, []);

  // Retirer un son dont l'enregistrement a échoué
  const handleDismissFailedUpload = (audId: string) => {
    if (savingIntervalsRef.current[audId]) {
      clearInterval(savingIntervalsRef.current[audId]);
      delete savingIntervalsRef.current[audId];
    }
    pendingAudioItemsRef.current.delete(audId);
    UploadQueue.removeTask(audId);
    setSavingProgress(prev => {
      const next = { ...prev };
      delete next[audId];
      return next;
    });
    setSavingErrors(prev => {
      const next = { ...prev };
      delete next[audId];
      return next;
    });
    setAudioList(prev => prev.filter(t => t.id !== audId));
    CloudDataStore.removeFile(audId);
    deleteFileBlob(audId).catch(() => {});
    if (selectedTrack?.id === audId) {
      setSelectedTrack(null);
      setIsAudioPlaying(false);
    }
    showToast("Son non enregistré retiré.");
  };

  // Réessayer l'enregistrement d'un son échoué
  const handleRetryUpload = (audId: string) => {
    setSavingErrors(prev => {
      const next = { ...prev };
      delete next[audId];
      return next;
    });
    startSavingAnimation([audId]);
    UploadQueue.retryTask(audId);
    showToast("Nouvelle tentative d'enregistrement...");
  };

  // Synchronisation continue ultra-légère avec TanStack Query
  useEffect(() => {
    if (serverAudio && Array.isArray(serverAudio)) {
      setAudioList(prev => mergeAudioWithPending(serverAudio, prev));
      setLoading(false);
    }
  }, [serverAudio]);

  // Résolution du Blob URL lors du changement de piste
  useEffect(() => {
    if (!selectedTrack) {
      setSplitResolvedAudioUrl('');
      setIsAudioPlaying(false);
      return;
    }

    let isMounted = true;
    if (selectedTrack.id) {
      getFileBlobUrl(selectedTrack.id)
        .then((blobUrl) => {
          if (isMounted && blobUrl) {
            setSplitResolvedAudioUrl(blobUrl);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [selectedTrack?.id]);

  // Contrôles de lecture
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleAudioNext = () => {
    if (filteredAudio.length === 0) return;
    if (isAudioShuffle) {
      const randIdx = Math.floor(Math.random() * filteredAudio.length);
      setSelectedTrack(filteredAudio[randIdx]);
      return;
    }
    const curIdx = selectedTrack ? filteredAudio.findIndex(t => t.id === selectedTrack.id) : -1;
    const nextIdx = (curIdx + 1) % filteredAudio.length;
    setSelectedTrack(filteredAudio[nextIdx]);
  };

  const handleAudioPrev = () => {
    if (filteredAudio.length === 0) return;
    if (isAudioShuffle) {
      const randIdx = Math.floor(Math.random() * filteredAudio.length);
      setSelectedTrack(filteredAudio[randIdx]);
      return;
    }
    const curIdx = selectedTrack ? filteredAudio.findIndex(t => t.id === selectedTrack.id) : 0;
    const prevIdx = (curIdx - 1 + filteredAudio.length) % filteredAudio.length;
    setSelectedTrack(filteredAudio[prevIdx]);
  };

  const handleSeekDelta = (deltaSec: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration || 1000, currentTime + deltaSec));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleAudioRepeat = () => {
    if (isAudioRepeat === 'off') setIsAudioRepeat('all');
    else if (isAudioRepeat === 'all') setIsAudioRepeat('one');
    else setIsAudioRepeat('off');
  };

  // Import audio avec affichage immédiat (0ms), animation de progression en continu et extraction ID3 en arrière-plan
  const handleImportAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let files = Array.from(e.target.files) as File[];
    if (files.length > MAX_IMPORT_FILES) {
      showToast(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers audio max à la fois : seuls les ${MAX_IMPORT_FILES} premiers sont importés.`);
      files = files.slice(0, MAX_IMPORT_FILES);
    }

    const now = Date.now();
    const newItems: FileItem[] = [];
    const itemsWithFiles: { file: File | Blob; item: any; originalSizeBytes?: number; originalSizeFormatted?: string }[] = [];

    files.forEach((f, idx) => {
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'MP3' : 'MP3';
      const fileId = `aud-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const localBlobUrl = URL.createObjectURL(f);

      // 1. Sauvegarde locale IndexedDB (accès instantané 0ms)
      storeFileBlob(fileId, f as any).catch(() => {});

      const sizeFormatted = f.size > 1048576 
        ? `${(f.size / (1024 * 1024)).toFixed(1)} Mo` 
        : `${Math.round(f.size / 1024)} Ko`;

      // 2. Générer une pochette visuelle immédiate pour que l'apparence s'affiche dès la 1ère milliseconde
      const initialCover = generateAudioCreatorCover(f.name, "Enregistrement en cours...");
      setCachedMediaThumbnail(fileId, initialCover);
      setCachedMediaThumbnail(localBlobUrl, initialCover);

      const item: FileItem = {
        id: fileId,
        name: f.name,
        category: 'audio',
        source: 'Audio',
        artist: "Enregistrement en cours...",
        album: undefined,
        size: sizeFormatted,
        sizeBytes: f.size,
        date: "Aujourd'hui",
        extension: ext,
        url: localBlobUrl,
        audioUrl: localBlobUrl,
        coverUrl: initialCover,
        thumbnailUrl: initialCover,
        previewUrl: initialCover,
        isAudio: true,
        isUploading: true
      };

      newItems.push(item);
      pendingAudioItemsRef.current.set(fileId, item);
      itemsWithFiles.push({
        file: f,
        item,
        originalSizeBytes: f.size,
        originalSizeFormatted: sizeFormatted
      });
    });

    if (newItems.length === 0) return;

    // 1. AFFICHAGE IMMÉDIAT (0ms) DANS LA LISTE (exactement comme dans Mes fichiers)
    setAudioList(prev => [...newItems, ...prev]);

    // 2. DÉMARRAGE IMMÉDIAT DE LA LIGNE QUI SE REMPLIT EN CONTINU
    startSavingAnimation(newItems.map(x => x.id));

    // 3. SYNCHRONISATION MULTI-MAGASIN IMMÉDIATE (CloudDataStore)
    newItems.forEach(item => {
      CloudDataStore.addOptimisticFile(item as any);
    });

    // 4. Sélection automatique si aucun son n'était joué
    setSelectedTrack(curr => curr || newItems[0]);

    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast(`${newItems.length} son(s) en cours d'enregistrement...`);

    // 5. En arrière-plan (non bloquant): extraction ID3 réelle (jsmediatags), pochette d'album & compression
    (async () => {
      for (const entry of itemsWithFiles) {
        const rawFile = entry.file as File;
        const currentItem = entry.item;

        try {
          // Extraction des tags ID3 (titre, artiste, album, Artwork pochette)
          const meta = await extractAudioMetadataWithTags(rawFile).catch(() => ({} as any));
          let coverUrl = meta.coverUrl;
          if (!coverUrl) {
            try {
              coverUrl = (await extractAudioCover(rawFile, meta.title || rawFile.name, meta.artist)) || undefined;
            } catch {}
          }

          if (coverUrl) {
            setCachedMediaThumbnail(currentItem.id, coverUrl);
            setCachedMediaThumbnail(currentItem.url || '', coverUrl);
            storeThumbnailData(currentItem.id, coverUrl).catch(() => {});
            CloudStorageAPI.saveMediaThumbnail(currentItem.id, 'audio', coverUrl, meta.title || rawFile.name).catch(() => {});
          }

          const updatedTitle = meta.title || rawFile.name;
          const updatedArtist = meta.artist || 'Menu Audio';
          const updatedAlbum = meta.album;

          // Mise à jour douce de l'élément dans la liste sans aucun rechargement ni disparition
          setAudioList(prev => prev.map(t => {
            if (t.id === currentItem.id) {
              const updated = {
                ...t,
                name: updatedTitle,
                artist: updatedArtist,
                album: updatedAlbum || t.album,
                coverUrl: coverUrl || t.coverUrl,
                thumbnailUrl: coverUrl || t.thumbnailUrl,
                previewUrl: coverUrl || t.previewUrl,
              };
              pendingAudioItemsRef.current.set(currentItem.id, updated);
              return updated;
            }
            return t;
          }));

          setSelectedTrack(curr => {
            if (curr && curr.id === currentItem.id) {
              return {
                ...curr,
                name: updatedTitle,
                artist: updatedArtist,
                album: updatedAlbum || curr.album,
                coverUrl: coverUrl || curr.coverUrl,
                thumbnailUrl: coverUrl || curr.thumbnailUrl,
                previewUrl: coverUrl || curr.previewUrl,
              };
            }
            return curr;
          });

          // Mettre à jour les données dans l'item pour l'UploadQueue
          entry.item = {
            ...currentItem,
            name: updatedTitle,
            artist: updatedArtist,
            album: updatedAlbum,
            coverUrl: coverUrl || currentItem.coverUrl,
            thumbnailUrl: coverUrl || currentItem.thumbnailUrl,
            previewUrl: coverUrl || currentItem.previewUrl,
          };
        } catch (err) {
          console.warn('[AudioMenuView] Background ID3 metadata error:', err);
        }
      }

      // Enqueue dans l'UploadQueue vers R2 + D1
      UploadQueue.enqueueExisting(itemsWithFiles, { category: 'audio' });
    })();
  };

  // Favoris
  const handleToggleFavorite = async (track: FileItem) => {
    const nextState = !track.isFavorite;
    setAudioList(prev =>
      prev.map(t => (t.id === track.id ? { ...t, isFavorite: nextState } : t))
    );
    if (selectedTrack?.id === track.id) {
      setSelectedTrack(prev => (prev ? { ...prev, isFavorite: nextState } : null));
    }
    CloudDataStore.toggleFavorite(track.id, nextState);
    if (nextState) {
      await CloudStorageAPI.addFavorite(track.id, 'audio').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(track.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
    setActiveMenuTrackId(null);
  };

  // Renommer
  const handleRenameAudio = async (track: FileItem) => {
    const newName = window.prompt('Nouveau nom du son :', track.name);
    if (!newName || !newName.trim() || newName.trim() === track.name) return;

    const trimmed = newName.trim();
    const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.${(track.extension || 'mp3').toLowerCase()}`;

    setAudioList(prev =>
      prev.map(t => (t.id === track.id ? { ...t, name: finalName } : t))
    );
    if (selectedTrack?.id === track.id) {
      setSelectedTrack(prev => (prev ? { ...prev, name: finalName } : null));
    }
    CloudDataStore.updateFile(track.id, { name: finalName });
    CloudStorageAPI.renameItem(track.id, finalName, 'audio').catch(console.error);
    showToast(`Son renommé en "${finalName}"`);
    setActiveMenuTrackId(null);
  };

  // Suppression (identique au menu Vidéos : moveToTrash + persistance localStorage pour sync multi-appareils)
  const handleDeleteAudio = async (track: FileItem) => {
    if (!window.confirm(`Supprimer définitivement "${track.name}" ?`)) return;

    const fileWithSource: FileItem = {
      ...track,
      isTrash: true,
      category: 'audio'
    };

    pendingAudioItemsRef.current.delete(track.id);
    setAudioList(prev => prev.filter(t => t.id !== track.id));
    if (selectedTrack?.id === track.id) {
      setSelectedTrack(null);
      setIsAudioPlaying(false);
    }
    setSelectedItemIds(prev => prev.filter(id => id !== track.id));

    // Persister l'ID supprimé dans localStorage pour bloquer la resync (multi-appareils)
    try {
      const raw = localStorage.getItem('studycloud_deleted_file_ids');
      const existing: string[] = raw ? JSON.parse(raw) : [];
      if (!existing.includes(track.id)) {
        existing.push(track.id);
        localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(existing));
      }
    } catch {}

    CloudDataStore.moveToTrash(fileWithSource as any);
    deleteFileBlob(track.id).catch(() => {});
    await CloudStorageAPI.deleteAudio(track.id, track.name).catch(() => {});
    invalidateCloudQueries.audio().catch(() => {});
    invalidateCloudQueries.overview().catch(() => {});
    showToast(`"${track.name}" supprimé`);
    setActiveMenuTrackId(null);
  };

  // Télécharger
  const handleDownload = async (track: FileItem) => {
    let url = track.audioUrl || track.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(track.id);
    }
    if (!url) {
      showToast('Fichier introuvable');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = track.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Téléchargement de "${track.name}"`);
  };

  // Partager
  const handleShare = (track: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([track]);
    } else {
      showToast('Partage StudyCloud');
    }
  };

  // Calcul dynamique de l'espace occupé par les fichiers audio
  const totalAudioBytes = useMemo(() => {
    return (audioList || []).reduce((acc, f) => acc + parseSizeToBytes(f?.size, f?.sizeBytes), 0);
  }, [audioList]);

  const formattedAudioSize = useMemo(() => {
    if (totalAudioBytes > 0) {
      if (totalAudioBytes < 1024) return `${totalAudioBytes} o`;
      if (totalAudioBytes < 1024 * 1024) return `${(totalAudioBytes / 1024).toFixed(1)} Ko`;
      if (totalAudioBytes < 1024 * 1024 * 1024) return `${(totalAudioBytes / (1024 * 1024)).toFixed(1)} Mo`;
      return `${(totalAudioBytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
    }
    return '0 Mo';
  }, [totalAudioBytes]);

  // Filtrage et tri (selon l'option sélectionnée)
  const filteredAudio = useMemo(() => {
    let list = audioList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        t => t.name.toLowerCase().includes(q) || (t.artist && t.artist.toLowerCase().includes(q))
      );
    }
    return applyFileSorting(list, sortOption);
  }, [audioList, searchQuery, sortOption]);

  const isAllChecked = filteredAudio.length > 0 && filteredAudio.every(t => selectedItemIds.includes(t.id));

  // Traitement universel des 12 actions du menu 3 traits (conforme à l'image envoyée)
  const handleMenuAction = async (action: string, track: FileItem) => {
    setActiveMenuTrackId(null);

    switch (action) {
      case 'check': {
        const isChecked = selectedItemIds.includes(track.id);
        const newSelected = isChecked
          ? selectedItemIds.filter(id => id !== track.id)
          : [...selectedItemIds, track.id];
        setSelectedItemIds(newSelected);
        setIsSelectionMode(newSelected.length > 0);
        showToast(isChecked ? `"${track.name}" décoché` : `"${track.name}" coché`);
        break;
      }

      case 'check_all': {
        if (isAllChecked) {
          setSelectedItemIds([]);
          setIsSelectionMode(false);
          showToast('Tous les sons décochés');
        } else {
          setIsSelectionMode(true);
          setSelectedItemIds(filteredAudio.map(t => t.id));
          showToast(`Tous les ${filteredAudio.length} sons cochés`);
        }
        break;
      }

      case 'download': {
        await handleDownload(track);
        break;
      }

      case 'delete': {
        await handleDeleteAudio(track);
        break;
      }

      case 'share': {
        handleShare(track);
        break;
      }

      case 'create_link': {
        if (onOpenCreateShareLink) {
          onOpenCreateShareLink([{
            id: track.id,
            name: track.name,
            size: track.sizeBytes || 0,
            type: track.extension || 'MP3',
            url: track.audioUrl || track.url
          }]);
          showToast(`Création du lien pour "${track.name}"...`);
        } else {
          const link = `${window.location.origin}${window.location.pathname}#audio-${track.id}`;
          try {
            await navigator.clipboard?.writeText(link);
            showToast('Lien copié dans le presse-papiers !');
          } catch {
            showToast(`Lien créé pour "${track.name}"`);
          }
        }
        break;
      }

      case 'lock_file': {
        const securedFile: FileItem = {
          ...track,
          isSecure: true,
          originalCategory: 'audio',
          originalSource: track.source || 'Audio',
          source: 'Dossier Sécurisé'
        };
        pendingAudioItemsRef.current.delete(track.id);
        setAudioList(prev => prev.filter(t => t.id !== track.id));
        if (selectedTrack?.id === track.id) {
          setSelectedTrack(null);
          setIsAudioPlaying(false);
        }
        setSelectedItemIds(prev => prev.filter(id => id !== track.id));
        // Persister l'ID dans localStorage pour bloquer la resync
        try {
          const raw = localStorage.getItem('studycloud_deleted_file_ids');
          const existing: string[] = raw ? JSON.parse(raw) : [];
          if (!existing.includes(track.id)) {
            existing.push(track.id);
            localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(existing));
          }
        } catch {}
        CloudDataStore.moveToSecure(securedFile as any);
        CloudStorageAPI.moveToSecureFolder(track, 'audio').catch(console.error);
        invalidateCloudQueries.audio();
        invalidateCloudQueries.secure();
        showToast(`"${track.name}" verrouillé dans le dossier sécurisé !`);
        break;
      }

      case 'move': {
        const items = isSelectionMode && selectedItemIds.includes(track.id) && selectedItemIds.length > 1
          ? filteredAudio.filter(f => selectedItemIds.includes(f.id))
          : [track];
        setItemsToTransfer(items);
        setTransferSelectedFolderIds([]);
        setTransferNavFolderId(null);
        setTransferSearchQuery('');
        setIsTransferPromptOpen(true);
        break;
      }

      case 'duplicate': {
        const existingNames = audioList.map(t => t.name);
        const newName = computeDuplicateName(track.name, existingNames);
        const newTrackId = `aud-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newTrack: FileItem = {
          ...track,
          id: newTrackId,
          name: newName,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          isPinned: false
        };
        setAudioList(prev => [newTrack, ...prev]);
        CloudDataStore.addOptimisticFile(newTrack);
        // Cloner le blob IndexedDB de manière indépendante pour éviter toute suppression partagée
        getFileBlob(track.id).then(blob => {
          if (blob) storeFileBlob(newTrackId, blob).catch(() => {});
        }).catch(() => {});
        CloudStorageAPI.duplicateItem(track.id, 'audio', undefined, newName, newTrackId).then(() => {
          invalidateCloudQueries.audio().catch(() => {});
          invalidateCloudQueries.overview().catch(() => {});
        }).catch(console.error);
        showToast(`Son dupliqué : "${newName}" !`);
        break;
      }

      case 'favorite': {
        await handleToggleFavorite(track);
        break;
      }

      case 'pin': {
        const nextPinned = !track.isPinned;
        setAudioList(prev => {
          const updated = prev.map(t => (t.id === track.id ? { ...t, isPinned: nextPinned } : t));
          if (nextPinned) {
            const item = updated.find(t => t.id === track.id);
            return item ? [item, ...updated.filter(t => t.id !== track.id)] : updated;
          }
          return updated;
        });
        CloudDataStore.updateFile(track.id, { isPinned: nextPinned });
        if (nextPinned) {
          CloudStorageAPI.addPinned(track.id, 'audio').catch(console.error);
          showToast(`"${track.name}" épinglé !`);
        } else {
          CloudStorageAPI.removePinned(track.id).catch(console.error);
          showToast(`"${track.name}" désépinglé`);
        }
        break;
      }

      case 'rename': {
        const newName = window.prompt('Modifier le nom du son :', track.name);
        if (newName && newName.trim() && newName.trim() !== track.name) {
          const trimmed = newName.trim();
          setAudioList(prev =>
            prev.map(t => (t.id === track.id ? { ...t, name: trimmed } : t))
          );
          if (selectedTrack?.id === track.id) {
            setSelectedTrack(prev => (prev ? { ...prev, name: trimmed } : null));
          }
          CloudDataStore.updateFile(track.id, { name: trimmed });
          CloudStorageAPI.renameItem(track.id, trimmed, 'audio').catch(console.error);
          showToast(`Son renommé en "${trimmed}" !`);
        }
        break;
      }

      default:
        break;
    }
  };

  // Exécution du transfert vers les dossiers du classeur
  const handleExecuteTransfer = async () => {
    if (transferSelectedFolderIds.length === 0 || itemsToTransfer.length === 0 || isTransferring) return;
    setIsTransferring(true);

    try {
      await CloudStorageAPI.moveOrCopyItems(itemsToTransfer, transferSelectedFolderIds, transferMode);

      if (transferMode === 'move') {
        const idsToRemove = new Set(itemsToTransfer.map(i => i.id));
        setAudioList(prev => prev.filter(t => !idsToRemove.has(t.id)));
        CloudDataStore.setAudio(audioList.filter(t => !idsToRemove.has(t.id)) as any);

        setSelectedItemIds(prev => prev.filter(id => !idsToRemove.has(id)));
        if (selectedItemIds.length <= itemsToTransfer.length) {
          setIsSelectionMode(false);
        }
        if (selectedTrack && idsToRemove.has(selectedTrack.id)) {
          setSelectedTrack(null);
          setIsAudioPlaying(false);
        }
      }

      showToast(
        transferMode === 'move'
          ? `${itemsToTransfer.length} son(s) déplacé(s) vers ${transferSelectedFolderIds.length} dossier(s) avec succès !`
          : `${itemsToTransfer.length} copie(s) créée(s) dans ${transferSelectedFolderIds.length} dossier(s) avec succès !`
      );

      setIsTransferModalOpen(false);
      setTransferSelectedFolderIds([]);
      setTransferNavFolderId(null);
      setTransferSearchQuery('');
    } catch (err) {
      console.error('[AudioMenuView] Transfer error:', err);
      showToast('Erreur lors du transfert. Veuillez réessayer.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Modale initiale Déplacer vs Créer une copie
  const renderTransferPromptModal = () => {
    if (!isTransferPromptOpen) return null;
    const count = itemsToTransfer.length;
    const titleText = count > 1 ? `${count} sons sélectionnés` : itemsToTransfer[0]?.name || 'Ce son';

    const content = (
      <div 
        className="fixed inset-0 z-[2600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto select-none"
        onClick={() => setIsTransferPromptOpen(false)}
      >
        <div 
          className="relative w-full max-w-sm bg-[#0B101D] border-2 border-amber-500/40 rounded-3xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-slate-200 space-y-4 animate-in zoom-in-95 duration-200"
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
                  Transfère {count > 1 ? 'ces sons' : 'ce son'} vers le(s) dossier(s) choisi(s) et le retire d'ici.
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
                  Garde l'original intact dans le menu Audio et ajoute une copie dans le(s) dossier(s) choisi(s).
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

  // Modale de sélection des dossiers cibles dans le Classeur
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
                {itemsToTransfer.length} son{itemsToTransfer.length > 1 ? 's' : ''} à {transferMode === 'move' ? 'déplacer' : 'copier'}
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

  // Menu déroulant 3 traits avec les 12 options exactement conforme à la capture envoyée
  const renderAudioOptionsMenu = (track: FileItem) => {
    const isChecked = selectedItemIds.includes(track.id);

    return (
      <div 
        className="studycloud-file-menu-panel absolute right-0 top-9 z-[100] w-64 bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(245,158,11,0.25)] text-slate-200 rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de menu dédié avec nom du fichier et bouton fermeture (Image de l'utilisateur) */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={track.name}>
              {track.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {track.size || 'Audio'} • <span className="uppercase text-amber-400">{track.extension || 'MP3'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuTrackId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste déroulante des 12 options avec défilement fluide garanti */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          {/* Section 1 : Sélection (Cocher, Tout cocher, Télécharger) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleMenuAction('check', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{isChecked ? 'Décocher' : 'Cocher'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('check_all', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{isAllChecked ? 'Tout décocher' : 'Tout cocher'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('download', track)}
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
              onClick={() => handleMenuAction('delete', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Supprimer le fichier</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('share', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>Partager</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('create_link', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Link className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              <span>Créer un lien</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('lock_file', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer text-left"
              title="Verrouiller ce son dans le dossier sécurisé"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Verrouiller</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('move', track)}
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
              onClick={() => handleMenuAction('duplicate', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Copy className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Dupliquer</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('favorite', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${track.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-400'}`} />
              <span>{track.isFavorite ? 'Retirer des favoris' : 'Ajouter au favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('pin', track)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pin className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>{track.isPinned ? 'Désépingler' : 'Épinglez'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('rename', track)}
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

  // Rendu du lecteur indépendant (Image 2)
  const renderAudioPlayer = (track: FileItem) => {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const fallbackStreamUrl = track.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(track.id)}` : '';
    const rawDirect = track.audioUrl || (track as any).url || '';
    const isDirectUsable = rawDirect && !rawDirect.startsWith('blob:');
    const audioSrc = splitResolvedAudioUrl || (isDirectUsable ? rawDirect : '') || fallbackStreamUrl;

    return (
      <div className="relative w-full h-full flex-1 flex flex-col justify-between p-3 sm:p-6 md:p-8 bg-[#090D1A] text-white overflow-hidden select-none">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          autoPlay={isAudioPlaying}
          loop={isAudioRepeat === 'one'}
          onCanPlay={() => {
            if (isAudioPlaying && audioRef.current && audioRef.current.paused) {
              audioRef.current.play().catch(() => {});
            }
          }}
          onPlay={() => setIsAudioPlaying(true)}
          onPause={() => setIsAudioPlaying(false)}
          onError={async () => {
            console.warn('[AudioPlayer] Erreur chargement audio pour', track.name);
            if (track.id) {
              try {
                const freshBlob = await getFileBlobUrl(track.id);
                if (freshBlob && freshBlob !== audioSrc) {
                  setSplitResolvedAudioUrl(freshBlob);
                  if (audioRef.current) {
                    audioRef.current.src = freshBlob;
                    audioRef.current.play().catch(() => {});
                  }
                  return;
                }
              } catch (e) {}

              if (fallbackStreamUrl && audioSrc !== fallbackStreamUrl) {
                setSplitResolvedAudioUrl(fallbackStreamUrl);
                if (audioRef.current) {
                  audioRef.current.src = fallbackStreamUrl;
                  audioRef.current.play().catch(() => {});
                }
              }
            }
          }}
          onEnded={() => {
            if (isAudioRepeat === 'one') {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }
              setCurrentTime(0);
            } else {
              handleAudioNext();
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(Math.floor(audioRef.current.currentTime));
              if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                setDuration(Math.floor(audioRef.current.duration));
              }
            }
          }}
        />

        {/* Halo ambré chaleureux */}
        <div
          className="absolute inset-0 pointer-events-none opacity-35"
          style={{
            background: 'radial-gradient(circle at 45% 30%, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.18) 40%, transparent 75%)'
          }}
        />

        {/* Bouton retour mobile */}
        <div className="md:hidden flex items-center justify-between pb-2 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobilePlayerOpen(false)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Retour à la liste</span>
          </button>
        </div>

        {/* En-tête du lecteur audio */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 relative z-10 shrink-0">
          <div className="min-w-0 pr-2">
            <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={track.name}>
              {track.name}
            </p>
            <p className="text-[10px] text-amber-400 font-semibold truncate">
              {track.artist || track.size || 'StudyCloud Audio'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleFavorite(track)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                track.isFavorite
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/40'
                  : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
              }`}
              title={track.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => handleShare(track)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDownload(track)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(track, 'Audio', audioList)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                title="Ouvrir dans l'Espace d'étude"
              >
                <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}

            {/* Menu 3 traits */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPlayerMenuOpen(!isPlayerMenuOpen)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Options"
              >
                <Menu className="w-4 h-4 stroke-[2.2]" />
              </button>
              {isPlayerMenuOpen && (
                <div
                  className="absolute right-0 top-9 z-50 w-52 bg-[#0D1527] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs text-white divide-y divide-white/10 backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => { handleDownload(track); setIsPlayerMenuOpen(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-400" /> Télécharger ce son
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleRenameAudio(track); setIsPlayerMenuOpen(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-400" /> Renommer
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleDeleteAudio(track); setIsPlayerMenuOpen(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-rose-950/40 text-rose-400 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" /> Supprimer ce son
                  </button>
                </div>
              )}
            </div>

            {/* Fermer */}
            <button
              type="button"
              onClick={() => {
                setSelectedTrack(null);
                setIsAudioPlaying(false);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title="Fermer le lecteur audio"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Centre : Pochette MESSAGE, waveform et détails (Image 2) */}
        <div className="relative z-10 w-full flex items-center justify-center max-w-sm mx-auto my-auto pt-2 sm:pt-4">
          <div className="relative w-44 sm:w-56 md:w-64 aspect-square rounded-2xl overflow-hidden shrink-0 shadow-[0_20px_45px_rgba(0,0,0,0.85)] border border-white/20 bg-black group">
            <AudioCardPreview
              track={track}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/85 border border-white/25 rounded text-[7px] font-black uppercase tracking-wider text-white">
              Parental Advisory
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full text-center space-y-1 my-2 sm:my-3">
          <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md truncate px-2">
            {track.name}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate px-2">
            {track.artist || track.source || 'StudyCloud Audio'}
          </p>
        </div>

        {/* Section temporelle */}
        <div className="relative z-10 w-full max-w-md mx-auto space-y-1.5 py-1">
          <div className="flex items-center justify-between px-3">
            <button
              type="button"
              onClick={() => handleSeekDelta(-10)}
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
              title="Reculer de 10s"
            >
              <RotateCcw className="w-5 h-5 stroke-[2]" />
              <span className="absolute text-[8px] font-black text-white">10</span>
            </button>

            <div className="px-3.5 py-1 rounded-full bg-white text-stone-950 font-black text-xs shadow-md tracking-wider">
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </div>

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

          <div className="w-full px-2">
            <input
              type="range"
              min="0"
              max={duration || 1}
              value={currentTime}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCurrentTime(val);
                if (audioRef.current) audioRef.current.currentTime = val;
              }}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-amber-400 transition-all"
            />
          </div>
        </div>

        {/* Contrôles principaux (Image 2) */}
        <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between px-2 pt-1 pb-2 sm:pb-3">
          <button
            type="button"
            onClick={() => {
              setIsAudioShuffle(!isAudioShuffle);
              showToast(!isAudioShuffle ? 'Lecture aléatoire activée' : 'Lecture aléatoire désactivée');
            }}
            className={`p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ${
              isAudioShuffle ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
            }`}
            title={isAudioShuffle ? 'Désactiver mode aléatoire' : 'Mode aléatoire'}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleAudioPrev}
            className="p-2 text-white hover:text-amber-400 transition-all active:scale-90 cursor-pointer"
            title="Piste précédente"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            className="w-14 h-14 rounded-full bg-white text-stone-950 flex items-center justify-center hover:scale-105 active:scale-95 shadow-[0_8px_25px_rgba(255,255,255,0.3)] transition-all cursor-pointer"
            title={isAudioPlaying ? 'Mettre en pause' : 'Lire'}
          >
            {isAudioPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={handleAudioNext}
            className="p-2 text-white hover:text-amber-400 transition-all active:scale-90 cursor-pointer"
            title="Piste suivante"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={toggleAudioRepeat}
            className={`p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer relative ${
              isAudioRepeat !== 'off' ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
            }`}
            title={isAudioRepeat === 'one' ? 'Boucle 1 titre' : isAudioRepeat === 'all' ? 'Boucle tous les titres' : 'Boucle désactivée'}
          >
            <Repeat className="w-5 h-5" />
            {isAudioRepeat === 'one' && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] font-black text-amber-400">1</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Rendu de l'état vide (Image 1)
  const renderAudioEmptyState = () => (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center select-none bg-[#090D1A] border-t md:border-t-0 md:border-l border-white/10 animate-in fade-in duration-200 h-full min-h-[500px]">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-[0_8px_30px_rgba(245,158,11,0.45)] border-2 border-white/30 ring-4 ring-black/40 relative mb-4">
        <div className="absolute inset-2 rounded-full border border-white/20 pointer-events-none" />
        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 10.5C2.5 7.8 4.2 5.5 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          <path d="M21.5 10.5C21.5 7.8 19.8 5.5 17.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          <path d="M9 16.5V5.5L20 3.5V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 9.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="6" cy="16.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 6 16.5)" />
          <ellipse cx="17" cy="14.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 17 14.5)" />
        </svg>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-200">
        Aucun son sélectionné
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Sélectionnez une piste musicale dans la liste de gauche pour lancer la lecture.
      </p>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-stone-50 dark:bg-[#070B14] overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-black/90 text-white border border-white/20 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Input de sélection de fichier */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportAudio}
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.weba,.amr,.3ga"
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU AUDIO */}
      <header className="sticky top-0 z-30 w-full bg-white backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-200 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Audio */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-amber-400">
                <Music className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 leading-tight">
                  Audio
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
                  {audioList.length} piste{audioList.length > 1 ? 's' : ''} • {formattedAudioSize}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Audio */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-amber-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Audio..."
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
                onClick={() => onOpenStudySpace(selectedTrack || undefined, 'Audio', audioList)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#101827] text-emerald-400 border border-emerald-500/30 transition-all font-bold text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Espace d'étude</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-amber-400 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer un fichier audio"
            >
              <Plus className="w-4 h-4 text-amber-400 stroke-[2.5]" />
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

      {/* DISPOSITION SPLIT EN DEUX COLONNES (IMAGES 1 & 2) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES SONS */}
        <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
          selectedTrack
            ? `${isMobilePlayerOpen ? 'hidden md:block' : 'w-full'} md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80`
            : 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
        }`}>
          <div className="w-full space-y-3">
            {/* En-tête de la liste */}
            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-500 dark:text-amber-400 stroke-[2.2]" />
                <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white tracking-wide">
                  Les sons ({filteredAudio.length})
                </span>
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                STUDYCLOUD AUDIO
              </span>
            </div>

            {/* Pistes audio */}
            {loading ? (
              <div className="py-20 text-center text-stone-400">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Chargement des sons...</p>
              </div>
            ) : filteredAudio.length === 0 ? (
              <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                {sortOption === 'duplicates' ? (
                  <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                ) : (
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                )}
                <p className={`text-sm font-semibold ${sortOption === 'duplicates' ? 'text-rose-400' : ''}`}>
                  {sortOption === 'duplicates'
                    ? 'Aucun résultat pour les doublons'
                    : 'Aucun son disponible'}
                </p>
                <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                  {sortOption === 'duplicates'
                    ? 'Tous vos fichiers audio sont uniques dans la base de données. Aucun doublon détecté.'
                    : 'Ce dossier ne contient aucun fichier audio pour le moment.'}
                </p>
                {sortOption === 'duplicates' && (
                  <button
                    type="button"
                    onClick={() => setSortOption('recent')}
                    className="mt-3 px-4 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Afficher tous les sons
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAudio.slice(0, visibleCount).map((track) => {
                  const isSelected = selectedTrack?.id === track.id;
                  const isMenuOpen = activeMenuTrackId === track.id;
                  const isChecked = selectedItemIds.includes(track.id);
                  const isSaving = savingProgress[track.id] !== undefined;
                  const progressVal = savingProgress[track.id] || 0;
                  const saveError = savingErrors[track.id];
                  const hasFailed = Boolean(saveError);

                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          handleMenuAction('check', track);
                          return;
                        }
                        if (hasFailed) {
                          showToast("Enregistrement échoué. Utilisez la croix pour retirer ou le bouton Réessayer.");
                          return;
                        }
                        if (isSelected) {
                          togglePlayPause();
                        } else {
                          setSelectedTrack(track);
                          setIsAudioPlaying(true);
                          setIsMobilePlayerOpen(true);
                        }
                      }}
                      className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all select-none border relative overflow-hidden ${
                        isMenuOpen ? 'z-50 overflow-visible' : 'z-10'
                      } ${
                        hasFailed
                          ? 'border-rose-500 bg-rose-950/20 shadow-md ring-1 ring-rose-500/40 cursor-default'
                          : isSaving
                            ? 'border-amber-400/40 bg-amber-500/5 cursor-wait'
                            : isChecked
                              ? 'bg-amber-500/15 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-400/40 cursor-pointer'
                              : isSelected
                                ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-400/30 cursor-pointer'
                                : 'bg-white dark:bg-slate-900/80 border-stone-200/90 dark:border-slate-800 hover:border-amber-400/60 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      {/* Ligne de progression en temps réel collée en haut qui se remplit (comme dans Mes fichiers) */}
                      {isSaving && !hasFailed && (
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-stone-900/40 dark:bg-black/60 z-30 overflow-hidden pointer-events-none rounded-t-2xl">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-300 ease-out shadow-[0_0_12px_#f59e0b]"
                            style={{ width: `${Math.min(100, Math.max(10, progressVal))}%` }}
                          />
                        </div>
                      )}
                      {hasFailed && (
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-500 z-30 overflow-hidden pointer-events-none rounded-t-2xl shadow-[0_0_10px_#f43f5e]" />
                      )}

                      {/* Vignette album + Titre + Artiste + Métadonnées */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isSelectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMenuAction('check', track);
                            }}
                            className="p-1 rounded-lg text-amber-400 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 fill-amber-400/20" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                        )}

                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-900 border border-stone-200 dark:border-white/10 relative shadow-sm">
                          <AudioCardPreview
                            track={track}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          {track.isFavorite && (
                            <div className="absolute top-1 left-1 z-20 p-0.5 rounded bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            </div>
                          )}
                          {isSaving && !hasFailed && (
                            <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none">
                              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shadow-sm" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                              isSelected ? 'text-amber-600 dark:text-amber-300 font-black' : 'text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors'
                            }`}>
                              {track.name}
                            </h4>
                            {track.isFavorite && (
                              <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-400 drop-shadow-sm" title="Favori" />
                            )}
                            {track.isPinned && (
                              <Pin className="w-3 h-3 shrink-0 rotate-45 text-purple-400" title="Épinglé" />
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 font-medium truncate mt-0.5">
                            {track.artist || 'Artiste inconnu'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-400 dark:text-slate-500 font-medium">
                            <span>{track.size}</span>
                            <span>•</span>
                            <span>{formatAudioTime(track.durationSec || 0)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Droite : Bouton Play/Pause + Animation d'égaliseur + Date + Menu 3 traits */}
                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        {isSelected && (
                          <div
                            className="flex items-end gap-1 h-5 px-1 py-0.5 shrink-0"
                            title={isAudioPlaying ? 'Lecture en cours' : 'En pause'}
                          >
                            <span
                              className={`w-1 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-1' : ''}`}
                              style={{ height: isAudioPlaying ? undefined : '5px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }}
                            />
                            <span
                              className={`w-1 rounded-full bg-amber-300 ${isAudioPlaying ? 'music-bar-2' : ''}`}
                              style={{ height: isAudioPlaying ? undefined : '14px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }}
                            />
                            <span
                              className={`w-1 rounded-full bg-yellow-400 ${isAudioPlaying ? 'music-bar-3' : ''}`}
                              style={{ height: isAudioPlaying ? undefined : '9px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }}
                            />
                            <span
                              className={`w-1 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-4' : ''}`}
                              style={{ height: isAudioPlaying ? undefined : '4px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }}
                            />
                          </div>
                        )}

                        {/* Bouton favori direct */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(track);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            track.isFavorite
                              ? 'text-amber-400 hover:bg-amber-400/10'
                              : 'text-stone-300 dark:text-slate-600 hover:text-amber-400 hover:bg-white/10'
                          }`}
                          title={track.isFavorite ? 'Retirer des favoris' : 'Mettre en favori'}
                        >
                          <Star className={`w-4 h-4 ${track.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>

                        {/* Bouton lecture rapide */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              togglePlayPause();
                            } else {
                              setSelectedTrack(track);
                              setIsAudioPlaying(true);
                              setIsMobilePlayerOpen(true);
                            }
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSelected && isAudioPlaying
                              ? 'bg-amber-500 text-stone-950 shadow-md'
                              : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-amber-500 hover:text-stone-950'
                          }`}
                          title={isSelected && isAudioPlaying ? 'Pause' : 'Reprendre la lecture'}
                        >
                          {isSelected && isAudioPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>

                        {hasFailed ? (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleRetryUpload(track.id)}
                              className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Réessayer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismissFailedUpload(track.id)}
                              className="p-1 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer"
                              title="Retirer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isSaving ? (
                          <span className="text-[10px] text-amber-500 dark:text-amber-400 font-black animate-pulse whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                            Enregistrement {Math.round(progressVal)}%
                          </span>
                        ) : (
                          <span className="hidden sm:inline text-[11px] text-stone-400 dark:text-slate-500 whitespace-nowrap">
                            {track.date || "Aujourd'hui, 11:34"}
                          </span>
                        )}

                        {/* Bouton 3 traits menu avec 12 options complètes */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuTrackId(isMenuOpen ? null : track.id);
                            }}
                            className="studycloud-menu-trigger p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-lg hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Options"
                          >
                            <Menu className="w-4 h-4 stroke-[2]" />
                          </button>
                          {isMenuOpen && renderAudioOptionsMenu(track)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {visibleCount < filteredAudio.length && (
                  <div className="pt-4 pb-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount(c => c + 30)}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      Afficher plus ({filteredAudio.length - visibleCount} restants)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PANNEAU DE DROITE : LECTEUR AUDIO DÉDIÉ OU ÉTAT VIDE (IMAGES 1 & 2) */}
        {selectedTrack ? (
          <div className={`animate-in fade-in duration-150 ${
            isMobilePlayerOpen ? 'flex w-full min-h-[calc(100vh-120px)]' : 'hidden md:flex'
          } md:w-7/12 lg:w-7/12 xl:w-7/12 flex-col bg-[#090D1A] border-t md:border-t-0 md:border-l border-white/10`}>
            {renderAudioPlayer(selectedTrack)}
          </div>
        ) : (
          <div className="hidden md:flex md:w-7/12 lg:w-7/12 xl:w-7/12 flex-col">
            {renderAudioEmptyState()}
          </div>
        )}
      </div>

      {/* Barre d'actions flottante de multi-sélection */}
      {isSelectionMode && selectedItemIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0B101D] border-2 border-amber-500/40 rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 text-xs text-white backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
          <span className="font-bold text-amber-300">
            {selectedItemIds.length} sélectionné{selectedItemIds.length > 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => {
              const selected = filteredAudio.filter(t => selectedItemIds.includes(t.id));
              selected.forEach(t => handleDownload(t));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Télécharger
          </button>
          <button
            type="button"
            onClick={() => {
              const selected = filteredAudio.filter(t => selectedItemIds.includes(t.id));
              if (selected.length > 0) {
                handleMenuAction('move', selected[0]);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-semibold cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" /> Déplacer / Copier
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm(`Supprimer les ${selectedItemIds.length} son(s) sélectionné(s) ?`)) return;
              const toDelete = filteredAudio.filter(t => selectedItemIds.includes(t.id));
              const ids = toDelete.map(t => t.id);

              // 1. Retrait immédiat de l'UI
              setAudioList(prev => prev.filter(t => !ids.includes(t.id)));
              if (selectedTrack && ids.includes(selectedTrack.id)) {
                setSelectedTrack(null);
                setIsAudioPlaying(false);
              }
              setSelectedItemIds([]);
              setIsSelectionMode(false);

              // 2. Persister les IDs dans localStorage pour bloquer la resync multi-appareils
              try {
                const raw = localStorage.getItem('studycloud_deleted_file_ids');
                const existing: string[] = raw ? JSON.parse(raw) : [];
                ids.forEach(id => {
                  pendingAudioItemsRef.current.delete(id);
                  if (!existing.includes(id)) existing.push(id);
                });
                localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(existing));
              } catch {}

              // 3. Déplacer vers la corbeille dans CloudDataStore
              const trashedFiles = toDelete.map(t => ({ ...t, isTrash: true, category: 'audio' }));
              CloudDataStore.moveToTrash(trashedFiles as any);

              // 4. Supprimer du stockage local et du Cloud
              for (const t of toDelete) {
                deleteFileBlob(t.id).catch(() => {});
                CloudStorageAPI.deleteAudio(t.id, t.name).catch(() => {});
              }
              invalidateCloudQueries.audio().catch(() => {});
              invalidateCloudQueries.overview().catch(() => {});
              showToast(`${toDelete.length} son(s) supprimé(s)`);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedItemIds([]);
              setIsSelectionMode(false);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Annuler sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modales de transfert classeur */}
      {renderTransferPromptModal()}
      {renderTransferFolderModal()}
    </div>
  );
};
