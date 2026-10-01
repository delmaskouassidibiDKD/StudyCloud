import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Download,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { getFileBlobUrl, getFileBlob } from '../services/localFileStorage';
import { getWorkerApiUrl } from '../services/api';
import { AudioCardPreview } from './AudioCardPreview';
import { FileItem } from './Page1FilesMenuView';

export interface ModernAudioPlayerProps {
  src?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: string | number;
  artist?: string;
  className?: string;
  autoPlay?: boolean;
  file?: any;
  onPrev?: () => void;
  onNext?: () => void;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const ModernAudioPlayer: React.FC<ModernAudioPlayerProps> = ({
  src,
  fileName = 'Piste Audio',
  fileId,
  fileSize,
  artist = 'StudyCloud Audio',
  className = '',
  autoPlay = true,
  file,
  onPrev,
  onNext
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Normalisation du track pour AudioCardPreview et métadonnées
  const trackItem: FileItem = (file as FileItem) || {
    id: fileId || '',
    name: fileName || 'Piste Audio',
    size: typeof fileSize === 'number' ? `${fileSize} o` : (fileSize || '0 o'),
    date: (file as any)?.date || '',
    artist: artist || 'StudyCloud Audio',
    url: src || '',
    audioUrl: src || '',
    category: 'audio',
    coverUrl: (file as any)?.coverUrl,
    thumbnailUrl: (file as any)?.thumbnailUrl,
    previewUrl: (file as any)?.previewUrl
  };

  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(Boolean(autoPlay));
  const isChangingTrackRef = useRef<boolean>(false);
  const desiredPlaybackStateRef = useRef<boolean>(Boolean(autoPlay));
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAudioShuffle, setIsAudioShuffle] = useState<boolean>(false);
  const [isAudioRepeat, setIsAudioRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [splitResolvedAudioUrl, setSplitResolvedAudioUrl] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const activeId = fileId || trackItem.id;
  const fallbackStreamUrl = activeId ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(activeId)}` : '';
  const rawDirect = src || trackItem.audioUrl || (trackItem as any).url || '';
  const isDirectUsable = rawDirect && !rawDirect.startsWith('blob:') && !rawDirect.includes('localhost') && !rawDirect.includes('127.0.0.1');

  const playAudio = useCallback(() => {
    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsAudioPlaying(true);
            setHasError(false);
            isChangingTrackRef.current = false;
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') {
              console.warn('[ModernAudioPlayer] play() interrompu ou bloqué:', err);
            }
          });
      }
    }
  }, []);

  // Résolution prioritaire : IndexedDB locale (0ms) -> direct URL -> fallback streaming Cloudflare
  useEffect(() => {
    let isMounted = true;
    isChangingTrackRef.current = true;
    setHasError(false);
    setErrorMessage('');
    setCurrentTime(0);

    // Initialisation immédiate sans conserver le Blob URL du morceau précédent
    const initialDirect = (isDirectUsable ? rawDirect : '') || fallbackStreamUrl;
    setSplitResolvedAudioUrl(initialDirect);

    if (activeId) {
      getFileBlobUrl(activeId)
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
  }, [activeId, src]);

  const audioSrc = splitResolvedAudioUrl || (isDirectUsable ? rawDirect : '') || fallbackStreamUrl;

  // Lancer automatiquement la lecture quand la nouvelle source audio est prête
  useEffect(() => {
    if (desiredPlaybackStateRef.current && audioSrc) {
      playAudio();
    }
  }, [audioSrc, playAudio]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      desiredPlaybackStateRef.current = true;
      playAudio();
    } else {
      desiredPlaybackStateRef.current = false;
      isChangingTrackRef.current = false;
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  };

  const handleSeekDelta = (delta: number) => {
    if (!audioRef.current) return;
    const nextTime = Math.max(0, Math.min(duration || 9999, (audioRef.current.currentTime || 0) + delta));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(Math.floor(nextTime));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !isMuted;
    audioRef.current.muted = next;
    setIsMuted(next);
  };

  const toggleAudioRepeat = () => {
    setIsAudioRepeat(prev => {
      if (prev === 'off') return 'one';
      if (prev === 'one') return 'all';
      return 'off';
    });
  };

  const handleRetry = async () => {
    setHasError(false);
    setErrorMessage('');
    if (activeId) {
      try {
        const b = await getFileBlobUrl(activeId);
        if (b) {
          setSplitResolvedAudioUrl(b);
          if (audioRef.current) {
            audioRef.current.src = b;
            audioRef.current.play().catch(() => {});
          }
          return;
        }
      } catch (e) {}
    }
    if (fallbackStreamUrl) {
      setSplitResolvedAudioUrl(fallbackStreamUrl);
      if (audioRef.current) {
        audioRef.current.src = fallbackStreamUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <div className={`relative w-full h-full flex flex-col justify-between p-3 sm:p-6 md:p-8 bg-[#090D1A] text-white overflow-hidden select-none ${className}`}>
      {/* Balise audio réelle avec synchronisation identique au menu Audio */}
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        autoPlay={isAudioPlaying}
        loop={isAudioRepeat === 'one'}
        onCanPlay={() => {
          setHasError(false);
          if (desiredPlaybackStateRef.current) {
            playAudio();
          }
        }}
        onLoadedData={() => {
          setHasError(false);
          if (desiredPlaybackStateRef.current) {
            playAudio();
          }
        }}
        onPlay={() => {
          setIsAudioPlaying(true);
          setHasError(false);
          isChangingTrackRef.current = false;
        }}
        onPause={() => {
          if (isChangingTrackRef.current) {
            // Ignorer la pause technique due au basculement de la balise src
            return;
          }
          setIsAudioPlaying(false);
        }}
        onError={async () => {
          console.warn('[ModernAudioPlayer] Erreur chargement audio pour', trackItem.name);
          if (activeId) {
            try {
              const freshBlob = await getFileBlobUrl(activeId);
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
              return;
            }
          }
          setHasError(true);
          setErrorMessage("Erreur de lecture audio. Vérifiez que le format est supporté.");
        }}
        onEnded={() => {
          if (isAudioRepeat === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              playAudio();
            }
            setCurrentTime(0);
          } else if (onNext) {
            isChangingTrackRef.current = true;
            desiredPlaybackStateRef.current = true;
            setIsAudioPlaying(true);
            onNext();
          } else {
            desiredPlaybackStateRef.current = false;
            setIsAudioPlaying(false);
            setCurrentTime(duration);
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

      {/* Halo ambré chaleureux identique au menu Audio */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          background: 'radial-gradient(circle at 45% 30%, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.18) 40%, transparent 75%)'
        }}
      />

      {/* Centre : Pochette carrée avec AudioCardPreview et Parental Advisory (même design que le menu audio) */}
      <div className="relative z-10 w-full flex items-center justify-center max-w-sm mx-auto my-auto pt-2 sm:pt-4">
        <div className="relative w-44 sm:w-56 md:w-64 aspect-square rounded-2xl overflow-hidden shrink-0 shadow-[0_20px_45px_rgba(0,0,0,0.85)] border border-white/20 bg-black group">
          <AudioCardPreview
            track={trackItem}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/85 border border-white/25 rounded text-[7px] font-black uppercase tracking-wider text-white">
            Parental Advisory
          </div>
        </div>
      </div>

      {/* Titre et détails de la piste */}
      <div className="relative z-10 w-full text-center space-y-1 my-2 sm:my-3">
        <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md truncate px-2" title={trackItem.name}>
          {trackItem.name}
        </h2>
        <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate px-2">
          {trackItem.artist || trackItem.size || 'StudyCloud Audio'}
        </p>
      </div>

      {/* Message d'erreur avec bouton Réessayer si nécessaire */}
      {hasError && (
        <div className="relative z-10 w-full max-w-md mx-auto mb-2 px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="px-2 py-0.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-white font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Réessayer
          </button>
        </div>
      )}

      {/* Section temporelle (-10s / pill / +10s / slider) */}
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

      {/* Contrôles principaux (Shuffle, Prev, Play/Pause, Next, Repeat) */}
      <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between px-2 pt-1 pb-2 sm:pb-3">
        <button
          type="button"
          onClick={() => setIsAudioShuffle(!isAudioShuffle)}
          className={`p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ${
            isAudioShuffle ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
          }`}
          title={isAudioShuffle ? 'Désactiver mode aléatoire' : 'Mode aléatoire'}
        >
          <Shuffle className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (onPrev) {
              isChangingTrackRef.current = true;
              desiredPlaybackStateRef.current = true;
              setIsAudioPlaying(true);
              onPrev();
            } else {
              handleSeekDelta(-10);
            }
          }}
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
          onClick={() => {
            if (onNext) {
              isChangingTrackRef.current = true;
              desiredPlaybackStateRef.current = true;
              setIsAudioPlaying(true);
              onNext();
            } else {
              handleSeekDelta(10);
            }
          }}
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

      {/* Barre inférieure discrète : Volume & Téléchargement */}
      <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between px-3 pt-1 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleMute} className="hover:text-white transition-colors cursor-pointer">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
          />
        </div>

        {audioSrc && (
          <a
            href={audioSrc}
            download={trackItem.name || 'audio.mp3'}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            title="Télécharger l'audio"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[10px]">Télécharger</span>
          </a>
        )}
      </div>
    </div>
  );
};
