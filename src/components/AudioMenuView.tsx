import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { extractAudioCover, generateAudioCreatorCover } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { AudioCardPreview } from './AudioCardPreview';
import { getWorkerApiUrl } from '../services/api';

interface AudioMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const AudioMenuView: React.FC<AudioMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  const [audioList, setAudioList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().audio || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Mode sélection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Progression d'enregistrement et gestion d'erreurs en temps réel (comme dans Vidéos et Images)
  const [savingProgress, setSavingProgress] = useState<Record<string, number>>({});
  const [savingErrors, setSavingErrors] = useState<Record<string, string>>({});
  const savingIntervalsRef = useRef<Record<string, any>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
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
      setActiveMenuTrackId(null);
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  // Animation et suivi en continu de la ligne de progression qui se remplit
  const startSavingAnimation = (fileIds: string[]) => {
    if (!fileIds || fileIds.length === 0) return;

    setSavingProgress(prev => {
      const next = { ...prev };
      fileIds.forEach(id => {
        next[id] = 12;
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
        if (task.category === 'audio' || task.id.startsWith('aud-')) {
          if (task.status === 'uploading' || task.status === 'pending') {
            activeProg[task.id] = Math.max(task.progress || 12, 12);
          } else if (task.status === 'completed') {
            activeProg[task.id] = 100;
            if (savingIntervalsRef.current[task.id]) {
              clearInterval(savingIntervalsRef.current[task.id]);
              delete savingIntervalsRef.current[task.id];
            }
            // Mise à jour immédiate dès confirmation d'enregistrement en base
            CloudStorageAPI.getAudioList().then((data) => {
              if (data && Array.isArray(data)) {
                setAudioList(data);
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
            }, 400);
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
            setAudioList(data);
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

  // Chargement et synchronisation avec CloudDataStore
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getAudioList()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setAudioList(data);
          CloudDataStore.setAudio(data as any);
        }
      })
      .catch((err) => console.warn('[AudioMenuView] Error fetching audio:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (isMounted) {
        setAudioList(state.audio || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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

  // Import audio
  const handleImportAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];

    showToast(`Préparation de ${files.length} son(s)...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || 'mp3' : 'mp3';
        const comp = await compressFile(f, 'audio');
        const fileId = `aud-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        let coverUrl: string | undefined;
        try {
          coverUrl = (await extractAudioCover(comp.file)) || undefined;
        } catch {}
        if (!coverUrl) {
          coverUrl = generateAudioCreatorCover(f.name);
        }

        const item: FileItem = {
          id: fileId,
          name: f.name,
          category: 'audio',
          source: 'Audio',
          size: comp.originalSizeFormatted,
          sizeBytes: comp.originalSizeBytes,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          extension: ext.toUpperCase(),
          url: localBlobUrl,
          audioUrl: localBlobUrl,
          coverUrl,
          thumbnailUrl: coverUrl,
          isAudio: true
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setAudioList(prev => [...newItems, ...prev]);
    CloudDataStore.setAudio([...newItems, ...audioList] as any);

    startSavingAnimation(newItems.map(x => x.id));
    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'audio' });
    showToast(`${newItems.length} fichier(s) audio importé(s) !`);

    if (newItems.length > 0 && !selectedTrack) {
      setSelectedTrack(newItems[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    CloudDataStore.updateFile(track.id, { isFavorite: nextState });
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
    showToast(`Son renommé en "${finalName}"`);
    setActiveMenuTrackId(null);
  };

  // Suppression
  const handleDeleteAudio = async (track: FileItem) => {
    if (!window.confirm(`Supprimer définitivement "${track.name}" ?`)) return;

    setAudioList(prev => prev.filter(t => t.id !== track.id));
    if (selectedTrack?.id === track.id) {
      setSelectedTrack(null);
      setIsAudioPlaying(false);
    }
    CloudDataStore.removeFile(track.id);
    deleteFileBlob(track.id).catch(() => {});
    await CloudStorageAPI.deleteAudio(track.id).catch(() => {});
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

  // Filtrage
  const filteredAudio = useMemo(() => {
    if (!searchQuery.trim()) return audioList;
    const q = searchQuery.toLowerCase().trim();
    return audioList.filter(
      t => t.name.toLowerCase().includes(q) || (t.artist && t.artist.toLowerCase().includes(q))
    );
  }, [audioList, searchQuery]);

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
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
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
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Audio
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">
                  StudyCloud
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
          </div>
        </div>
      </header>

      {/* DISPOSITION SPLIT EN DEUX COLONNES (IMAGES 1 & 2) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES SONS */}
        <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
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
                <Music className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                <p className="text-sm font-semibold">Aucun son disponible</p>
                <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                  Ce dossier ne contient aucun fichier audio pour le moment.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAudio.map((track) => {
                  const isSelected = selectedTrack?.id === track.id;
                  const isMenuOpen = activeMenuTrackId === track.id;
                  const isSaving = savingProgress[track.id] !== undefined;
                  const progressVal = savingProgress[track.id] || 0;
                  const saveError = savingErrors[track.id];
                  const hasFailed = Boolean(saveError);

                  return (
                    <div
                      key={track.id}
                      onClick={() => {
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
                            : isSelected
                              ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-400/30 cursor-pointer'
                              : 'bg-white dark:bg-slate-900/80 border-stone-200/90 dark:border-slate-800 hover:border-amber-400/60 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      {/* Ligne de progression en temps réel au-dessus de l'élément */}
                      {isSaving && !hasFailed && (
                        <div className="absolute top-0 inset-x-0 h-1 bg-black/40 z-20 overflow-hidden pointer-events-none rounded-t-2xl">
                          <div 
                            className="h-full bg-amber-400 transition-all duration-300 ease-out shadow-[0_0_10px_#f59e0b]"
                            style={{ width: `${progressVal}%` }}
                          />
                        </div>
                      )}
                      {hasFailed && (
                        <div className="absolute top-0 inset-x-0 h-1 bg-rose-500 z-20 overflow-hidden pointer-events-none rounded-t-2xl shadow-[0_0_10px_#f43f5e]" />
                      )}
                      {/* Vignette album + Titre + Artiste + Métadonnées */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-900 border border-stone-200 dark:border-white/10 relative shadow-sm">
                          <AudioCardPreview
                            track={track}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                            isSelected ? 'text-amber-600 dark:text-amber-300 font-black' : 'text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors'
                          }`}>
                            {track.name}
                          </h4>
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

                      {/* Droite : Bouton Play/Pause + Animation d'égaliseur + Date + Menu */}
                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        {isSelected && (
                          <div
                            className="flex items-end gap-1 h-5 px-1 py-0.5 shrink-0"
                            title={isAudioPlaying ? 'Lecture en cours' : 'En pause'}
                          >
                            <span
                              className={`w-1 rounded-full bg-amber-400 transition-all ${isAudioPlaying ? 'h-5 animate-pulse' : 'h-1.5'}`}
                            />
                            <span
                              className={`w-1 rounded-full bg-amber-300 transition-all ${isAudioPlaying ? 'h-3 animate-pulse delay-75' : 'h-3'}`}
                            />
                            <span
                              className={`w-1 rounded-full bg-yellow-400 transition-all ${isAudioPlaying ? 'h-4 animate-pulse delay-150' : 'h-2'}`}
                            />
                            <span
                              className={`w-1 rounded-full bg-amber-400 transition-all ${isAudioPlaying ? 'h-2 animate-pulse' : 'h-1'}`}
                            />
                          </div>
                        )}

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
                          <span className="text-[10px] text-amber-400 font-bold animate-pulse whitespace-nowrap">
                            Enregistrement {progressVal}%
                          </span>
                        ) : (
                          <span className="hidden sm:inline text-[11px] text-stone-400 dark:text-slate-500 whitespace-nowrap">
                            {track.date || "Aujourd'hui, 11:34"}
                          </span>
                        )}

                        {/* Bouton 3 traits menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuTrackId(isMenuOpen ? null : track.id);
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-lg hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors"
                            title="Options"
                          >
                            <Menu className="w-4 h-4 stroke-[2]" />
                          </button>
                          {isMenuOpen && (
                            <div
                              className="absolute right-0 top-8 z-50 w-44 bg-white dark:bg-[#0D1527] border border-stone-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 text-xs text-stone-800 dark:text-white divide-y divide-stone-100 dark:divide-white/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(track)}
                                className="w-full px-3 py-2 text-left hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Star className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                                <span>{track.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownload(track)}
                                className="w-full px-3 py-2 text-left hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-blue-400" />
                                <span>Télécharger</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRenameAudio(track)}
                                className="w-full px-3 py-2 text-left hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-amber-400" />
                                <span>Renommer</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAudio(track)}
                                className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PANNEAU DE DROITE : LECTEUR AUDIO DÉDIÉ OU ÉTAT VIDE (IMAGES 1 & 2) */}
        {selectedTrack ? (
          <div className={`transition-all duration-300 ${
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
    </div>
  );
};
