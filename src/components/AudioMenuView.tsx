import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Music,
  Play,
  Pause,
  Plus,
  Trash2,
  MoreVertical,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  RotateCw,
  Repeat,
  Shuffle,
  Star,
  Download,
  Share2,
  BookOpen,
  Edit2,
  Clock,
  Sparkles,
  SlidersHorizontal,
  Check,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  FolderInput,
  FileAudio
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { extractAudioCover, generateAudioCreatorCover } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [isEqualizerOn, setIsEqualizerOn] = useState(true);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);

  // Mode sélection multiple
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Menu déroulant par piste
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sleepTimerRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement des fichiers audio depuis le Cloud / IndexedDB
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Gestion du Sleep Timer
  useEffect(() => {
    if (sleepTimerMinutes === null) {
      setSleepTimerRemaining(null);
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      return;
    }

    let remaining = sleepTimerMinutes * 60;
    setSleepTimerRemaining(remaining);

    sleepTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(sleepTimerRef.current);
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        setSleepTimerMinutes(null);
        setSleepTimerRemaining(null);
        showToast('Minuteur de mise en veille terminé : lecture arrêtée');
      } else {
        setSleepTimerRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, [sleepTimerMinutes]);

  // Synchronisation de l'élément audio natif
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
    audioRef.current.playbackRate = playbackRate;
  }, [volume, isMuted, playbackRate]);

  // Gestion de la sélection d'une piste
  const handleSelectTrack = async (track: FileItem) => {
    if (selectedTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    setSelectedTrack(track);
    setIsPlaying(true);

    // Résoudre l'URL de lecture (IndexedDB Blob URL ou URL directe)
    let playUrl = track.audioUrl || track.url || '';
    if (!playUrl.startsWith('http') && !playUrl.startsWith('blob:')) {
      const blobUrl = await getFileBlobUrl(track.id);
      if (blobUrl) playUrl = blobUrl;
    }

    if (audioRef.current) {
      audioRef.current.src = playUrl;
      audioRef.current.play().catch(() => {});
    }
  };

  // Piste suivante / précédente
  const handlePlayNext = () => {
    if (filteredAudio.length === 0) return;
    if (!selectedTrack) {
      handleSelectTrack(filteredAudio[0]);
      return;
    }

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * filteredAudio.length);
      handleSelectTrack(filteredAudio[randomIndex]);
      return;
    }

    const currentIndex = filteredAudio.findIndex(t => t.id === selectedTrack.id);
    const nextIndex = (currentIndex + 1) % filteredAudio.length;
    handleSelectTrack(filteredAudio[nextIndex]);
  };

  const handlePlayPrev = () => {
    if (filteredAudio.length === 0) return;
    if (!selectedTrack) {
      handleSelectTrack(filteredAudio[0]);
      return;
    }

    const currentIndex = filteredAudio.findIndex(t => t.id === selectedTrack.id);
    const prevIndex = (currentIndex - 1 + filteredAudio.length) % filteredAudio.length;
    handleSelectTrack(filteredAudio[prevIndex]);
  };

  // Fin de la piste
  const handleAudioEnded = () => {
    if (isRepeat === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else if (isRepeat === 'all' || isShuffle) {
      handlePlayNext();
    } else {
      setIsPlaying(false);
    }
  };

  // Import de nouveaux fichiers audio
  const handleImportAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];

    showToast(`Préparation de ${files.length} fichier(s) audio...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || 'mp3' : 'mp3';
        const comp = await compressFile(f, 'audio');
        const fileId = `aud-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        // Extraction de pochette audio si possible
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
          artist: 'StudyCloud Audio'
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setAudioList(prev => [...newItems, ...prev]);
    CloudDataStore.setAudio([...newItems, ...audioList] as any);

    // File d'attente d'upload cloud
    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'audio' });

    showToast(`${newItems.length} audio(s) importé(s) avec succès !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Suppression d'un audio (mise à la corbeille)
  const handleDeleteAudio = async (track: FileItem) => {
    setAudioList(prev => prev.filter(t => t.id !== track.id));
    if (selectedTrack?.id === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setSelectedTrack(null);
      setIsPlaying(false);
    }

    const trashedItem = { ...track, originalCategory: 'audio', isTrash: true };
    CloudDataStore.moveToTrash(trashedItem as any);
    await CloudStorageAPI.deleteAudio(track.id).catch(() => {});
    showToast(`"${track.name}" déplacé dans la corbeille`);
    setMenuTrackId(null);
  };

  // Basculer favori
  const handleToggleFavorite = async (track: FileItem) => {
    const nextState = !track.isFavorite;
    setAudioList(prev =>
      prev.map(t => (t.id === track.id ? { ...t, isFavorite: nextState } : t))
    );
    if (nextState) {
      await CloudStorageAPI.addFavorite(track.id, 'audio').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(track.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
    setMenuTrackId(null);
  };

  // Renommer une piste
  const handleRenameAudio = async (track: FileItem) => {
    const newName = window.prompt('Nouveau nom du fichier audio :', track.name);
    if (!newName || !newName.trim() || newName.trim() === track.name) return;

    const trimmed = newName.trim();
    const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.${(track.extension || 'mp3').toLowerCase()}`;

    setAudioList(prev =>
      prev.map(t => (t.id === track.id ? { ...t, name: finalName } : t))
    );
    CloudDataStore.updateFile(track.id, { name: finalName });
    showToast(`Piste renommée en "${finalName}"`);
    setMenuTrackId(null);
  };

  // Téléchargement
  const handleDownload = async (track: FileItem) => {
    let url = track.audioUrl || track.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(track.id);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = track.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Téléchargement démarré...');
    }
    setMenuTrackId(null);
  };

  // Filtrage par recherche
  const filteredAudio = useMemo(() => {
    if (!searchQuery.trim()) return audioList;
    const q = searchQuery.toLowerCase().trim();
    return audioList.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q))
    );
  }, [audioList, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onEnded={handleAudioEnded}
      />

      {/* Input invisible pour l'import audio */}
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
                  Audio & Musique
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-amber-400/80 leading-tight">
                  {audioList.length} piste{audioList.length > 1 ? 's' : ''} disponible{audioList.length > 1 ? 's' : ''}
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
                placeholder="Rechercher une musique, cours audio..."
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

          {/* DROITE : Bouton + Importer de l'audio et Actions */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-amber-400 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer un fichier audio ou cours"
            >
              <Plus className="w-4 h-4 text-amber-400 stroke-[2.5]" />
              <span className="hidden xs:inline">Importer audio</span>
              <span className="xs:hidden">Importer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-amber-500 text-black border-amber-400 font-bold'
                  : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
              }`}
              title={isSelectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* BANDEAU DE SÉLECTION MULTIPLE */}
      {isSelectionMode && (
        <div className="w-full bg-[#0F1424] border-b border-amber-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredAudio.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredAudio.map(t => t.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2"
            >
              {selectedIds.length === filteredAudio.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = audioList.filter(t => selectedIds.includes(t.id));
                    toDelete.forEach(handleDeleteAudio);
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                  }}
                  className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 rounded-lg flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedIds.length})</span>
                </button>

                {onOpenStudySpace && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = audioList.find(t => t.id === selectedIds[0]);
                      onOpenStudySpace(first, 'Audio', audioList);
                    }}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1 font-bold"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Espace d'étude</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* LECTEUR AUDIO INTÉGRÉ AU SOMMET (SI PISTE SÉLECTIONNÉE) */}
      {selectedTrack && (
        <div className="w-full bg-gradient-to-b from-[#131929] to-[#0A0E1A] border-b border-amber-500/20 px-4 sm:px-8 py-4 sm:py-5 shadow-2xl relative">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-4 sm:gap-6">
            {/* Pochette Vinyle / Cover animée */}
            <div className="relative shrink-0 group">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-950 p-1 shadow-lg border border-amber-400/30 flex items-center justify-center overflow-hidden transition-transform duration-300 ${
                  isPlaying ? 'rotate-1' : ''
                }`}
              >
                {selectedTrack.coverUrl ? (
                  <img
                    src={selectedTrack.coverUrl}
                    alt={selectedTrack.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <Music className="w-10 h-10 text-amber-300 stroke-[1.8]" />
                )}
              </div>
              {isPlaying && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-md animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-black" />
                </div>
              )}
            </div>

            {/* Infos Piste & Contrôles Centraux */}
            <div className="flex-1 w-full min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-black text-white truncate" title={selectedTrack.name}>
                    {selectedTrack.name}
                  </h3>
                  <p className="text-xs text-amber-400 font-semibold truncate">
                    {selectedTrack.artist || 'StudyCloud Audio'} • {selectedTrack.size}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(selectedTrack)}
                    className={`p-1.5 rounded-lg border transition-all ${
                      selectedTrack.isFavorite
                        ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                        : 'border-white/10 hover:border-amber-400/40 text-slate-400'
                    }`}
                    title={selectedTrack.isFavorite ? 'Retirer des favoris' : 'Marquer comme favori'}
                  >
                    <Star className={`w-4 h-4 ${selectedTrack.isFavorite ? 'fill-amber-400' : ''}`} />
                  </button>

                  {onOpenStudySpace && (
                    <button
                      type="button"
                      onClick={() => onOpenStudySpace(selectedTrack, 'Audio', audioList)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold"
                      title="Ouvrir dans l'Espace d'étude"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Étude</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Slider de Progression */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
                    {formatAudioTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <span className="text-[11px] font-mono text-slate-400 w-10">
                    {formatAudioTime(duration)}
                  </span>
                </div>
              </div>

              {/* Barre des boutons de lecture */}
              <div className="flex items-center justify-between mt-2 pt-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isShuffle ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Aléatoire"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isRepeat === 'off') setIsRepeat('all');
                      else if (isRepeat === 'all') setIsRepeat('one');
                      else setIsRepeat('off');
                    }}
                    className={`p-1.5 rounded-lg transition-all flex items-center gap-0.5 ${
                      isRepeat !== 'off' ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white'
                    }`}
                    title={isRepeat === 'one' ? 'Répéter 1 piste' : isRepeat === 'all' ? 'Répéter tout' : 'Répétition désactivée'}
                  >
                    <Repeat className="w-4 h-4" />
                    {isRepeat === 'one' && <span className="text-[9px] font-bold">1</span>}
                  </button>

                  {/* Vitesse de lecture */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 border border-white/10"
                    >
                      {playbackRate}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full left-0 mb-1 z-50 bg-[#121828] border border-white/15 rounded-xl shadow-xl p-1 flex flex-col gap-0.5">
                        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => {
                              setPlaybackRate(rate);
                              setShowSpeedMenu(false);
                            }}
                            className={`px-3 py-1 text-xs rounded-lg text-left ${
                              playbackRate === rate ? 'bg-amber-500 text-black font-bold' : 'hover:bg-white/10 text-white'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Boutons Principaux : Précédent, Lecture/Pause, Suivant */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handlePlayPrev}
                    className="p-2 text-slate-300 hover:text-white active:scale-95 transition-all"
                    title="Piste précédente"
                  >
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        audioRef.current?.pause();
                        setIsPlaying(false);
                      } else {
                        audioRef.current?.play().catch(() => {});
                        setIsPlaying(true);
                      }
                    }}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center shadow-lg transition-transform active:scale-90"
                    title={isPlaying ? 'Pause' : 'Lecture'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePlayNext}
                    className="p-2 text-slate-300 hover:text-white active:scale-95 transition-all"
                    title="Piste suivante"
                  >
                    <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Volume & Outils */}
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-slate-400 hover:text-white"
                      title={isMuted ? 'Activer le son' : 'Couper le son'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4" />
                      ) : volume < 0.5 ? (
                        <Volume1 className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(Number(e.target.value));
                        setIsMuted(false);
                      }}
                      className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (sleepTimerMinutes === null) setSleepTimerMinutes(15);
                      else if (sleepTimerMinutes === 15) setSleepTimerMinutes(30);
                      else if (sleepTimerMinutes === 30) setSleepTimerMinutes(60);
                      else setSleepTimerMinutes(null);
                    }}
                    className={`px-2 py-1 rounded-md text-xs font-bold border transition-all flex items-center gap-1 ${
                      sleepTimerMinutes !== null
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'border-white/10 text-slate-400 hover:text-white'
                    }`}
                    title="Minuteur de mise en veille"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{sleepTimerRemaining ? `${Math.ceil(sleepTimerRemaining / 60)}m` : 'Timer'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL : LISTE DES PISTES AUDIO */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de vos pistes audio...</p>
          </div>
        ) : filteredAudio.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-amber-500/20 flex items-center justify-center mb-4 shadow-xl">
              <FileAudio className="w-10 h-10 text-amber-400 opacity-80 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucun résultat trouvé' : 'Aucun fichier audio disponible'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              {searchQuery
                ? `Aucune musique ou note vocale ne correspond à "${searchQuery}".`
                : 'Importez vos morceaux favoris, cours magistraux enregistrés ou mémos vocaux WhatsApp.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Importer un audio</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 text-xs font-bold text-slate-400">
              <span>{filteredAudio.length} piste(s) audio</span>
              <span className="hidden sm:inline">Cliquez sur une piste pour lancer la lecture</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredAudio.map((track, idx) => {
                const isCurrent = selectedTrack?.id === track.id;
                const isChecked = selectedIds.includes(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      if (isSelectionMode) {
                        if (isChecked) setSelectedIds(selectedIds.filter(id => id !== track.id));
                        else setSelectedIds([...selectedIds, track.id]);
                      } else {
                        handleSelectTrack(track);
                      }
                    }}
                    className={`group relative rounded-2xl p-3 flex items-center gap-3 transition-all duration-200 cursor-pointer select-none border ${
                      isCurrent
                        ? 'bg-[#151D33] border-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-[#0B0F1D] hover:bg-[#121828] border-white/10 hover:border-amber-400/40 shadow-sm'
                    }`}
                  >
                    {/* Case à cocher en mode sélection */}
                    {isSelectionMode && (
                      <div className="shrink-0 text-amber-400">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 fill-amber-500/20" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    )}

                    {/* Pochette ou Icône Audio */}
                    <div className="relative w-12 h-12 rounded-xl bg-black/40 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                      {track.coverUrl ? (
                        <img
                          src={track.coverUrl}
                          alt={track.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Music className="w-5 h-5 text-amber-400 stroke-[2]" />
                      )}

                      {/* Bouton Play au survol */}
                      <div
                        className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${
                          isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-5 h-5 text-amber-400 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 text-amber-400 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Nom, Artiste & Taille */}
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                          isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                        }`}
                        title={track.name}
                      >
                        {track.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {track.size} • {track.date}
                      </p>
                    </div>

                    {/* Bouton 3 petits points (Options) */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMenuTrackId(menuTrackId === track.id ? null : track.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {menuTrackId === track.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-2xl bg-[#121828] border border-white/15 shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectTrack(track);
                              setMenuTrackId(null);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Play className="w-3.5 h-3.5 text-amber-400" />
                            <span>Écouter</span>
                          </button>

                          {onOpenStudySpace && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenStudySpace(track, 'Audio', audioList);
                                setMenuTrackId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Espace d'étude</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(track)}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span>{track.isFavorite ? 'Retirer des favoris' : 'Favori'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(track)}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-400" />
                            <span>Télécharger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRenameAudio(track)}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Renommer</span>
                          </button>

                          {onOpenCreateShareLink && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenCreateShareLink([track]);
                                setMenuTrackId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <Share2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>Partager le lien</span>
                            </button>
                          )}

                          <div className="h-px bg-white/10 my-1" />

                          <button
                            type="button"
                            onClick={() => handleDeleteAudio(track)}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 rounded-xl text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Déplacer vers la corbeille</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

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
