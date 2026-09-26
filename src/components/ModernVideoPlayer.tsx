import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Repeat,
  Tv,
  AlertCircle,
  RefreshCw,
  Film
} from 'lucide-react';
import { getFileBlobUrl, getFileBlob } from '../services/localFileStorage';

interface ModernVideoPlayerProps {
  src?: string;
  poster?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: string | number;
  className?: string;
  autoPlay?: boolean;
  onClose?: () => void;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const ModernVideoPlayer: React.FC<ModernVideoPlayerProps> = ({
  src,
  poster,
  fileName = 'Vidéo',
  fileId,
  fileSize,
  className = '',
  autoPlay = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // États du lecteur
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const controlsTimeoutRef = useRef<any>(null);

  // 1. Résolution de la source vidéo (Sécurité anti-JPEG et secours IndexedDB)
  const resolveVideoSource = useCallback(async () => {
    setHasError(false);
    setErrorMessage('');
    setIsBuffering(true);

    // Si la source fournie est valide et n'est PAS une image
    if (src && typeof src === 'string' && src.trim()) {
      if (src.startsWith('data:image/')) {
        console.warn('[ModernVideoPlayer] Source rejetée car il s\'agit d\'une image base64, pas d\'une vidéo.');
      } else {
        setResolvedSrc(src);
        return;
      }
    }

    // Tenter de charger depuis IndexedDB si on a un fileId
    if (fileId) {
      try {
        const blobUrl = await getFileBlobUrl(fileId);
        if (blobUrl) {
          setResolvedSrc(blobUrl);
          return;
        }
      } catch (err) {
        console.warn('[ModernVideoPlayer] Erreur chargement IndexedDB:', err);
      }
    }

    // Si aucune source valide
    if (!src || src.startsWith('data:image/')) {
      setHasError(true);
      setErrorMessage("Flux vidéo introuvable ou fichier non encore chargé en mémoire locale.");
      setIsBuffering(false);
    }
  }, [src, fileId]);

  useEffect(() => {
    resolveVideoSource();
  }, [resolveVideoSource]);

  // Nettoyage des blob URLs temporaires
  useEffect(() => {
    return () => {
      if (resolvedSrc && resolvedSrc.startsWith('blob:') && resolvedSrc !== src) {
        try {
          URL.revokeObjectURL(resolvedSrc);
        } catch {}
      }
    };
  }, [resolvedSrc, src]);

  // 2. Gestion de l'affichage / masquage automatique des contrôles
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
      setShowSpeedMenu(false);
    }
  };

  // 3. Actions de lecture
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('[ModernVideoPlayer] Lecture bloquée par le navigateur:', err);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.min(Math.max(0, videoRef.current.currentTime + seconds), duration || 999999);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const setSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[ModernVideoPlayer] PiP non supporté:', err);
    }
  };

  const toggleLoop = () => {
    if (!videoRef.current) return;
    const nextLoop = !isLooping;
    videoRef.current.loop = nextLoop;
    setIsLooping(nextLoop);
  };

  // 4. Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skip(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skip(5);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleMute, toggleFullscreen]);

  // Synchronisation plein écran natif
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Calcul du pourcentage de progression
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  // Filtrer le poster : s'assurer qu'il s'agit bien d'une image
  const effectivePoster = poster && (poster.startsWith('data:image/') || poster.startsWith('http') || poster.startsWith('/'))
    ? poster
    : undefined;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden select-none font-sans rounded-2xl ${className}`}
    >
      {/* 1. ÉLÉMENT VIDÉO PRINCIPAL */}
      {resolvedSrc ? (
        <video
          ref={videoRef}
          src={resolvedSrc}
          poster={effectivePoster}
          playsInline
          autoPlay={autoPlay}
          loop={isLooping}
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              if (videoRef.current.buffered.length > 0) {
                try {
                  const bEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
                  setBufferedEnd(bEnd);
                } catch {}
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              setIsBuffering(false);
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (!isLooping) setCurrentTime(duration);
          }}
          onError={async () => {
            // Tentative de récupération automatique depuis IndexedDB si ce n'était pas déjà fait
            if (fileId && !resolvedSrc.startsWith('blob:')) {
              try {
                const blob = await getFileBlob(fileId);
                if (blob) {
                  const bUrl = URL.createObjectURL(blob);
                  setResolvedSrc(bUrl);
                  return;
                }
              } catch {}
            }
            setHasError(true);
            setIsBuffering(false);
            setErrorMessage("Impossible de lire ce flux vidéo. Format non pris en charge ou fichier corrompu.");
          }}
          className="w-full h-full object-contain cursor-pointer"
        />
      ) : null}

      {/* 2. SPINNER DE CHARGEMENT / BUFFERING */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/30 backdrop-blur-[2px]">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-purple-500 animate-spin flex items-center justify-center shadow-lg" />
        </div>
      )}

      {/* 3. MESSAGE D'ERREUR ET REPLI SI LE FLUX ÉCHOUE */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 z-20">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">Lecture de la vidéo impossible</h4>
          <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
            {errorMessage || "Le flux vidéo n'a pas pu être chargé. Assurez-vous qu'il s'agit d'un fichier vidéo standard (MP4, WebM, MOV)."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resolveVideoSource}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer le chargement</span>
            </button>
            {resolvedSrc && (
              <a
                href={resolvedSrc}
                download={fileName || 'video.mp4'}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le fichier</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* 4. GRAND BOUTON PLAY CENTRAL EN OVERLAY */}
      {!isPlaying && !isBuffering && !hasError && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white flex items-center justify-center shadow-2xl backdrop-blur-md cursor-pointer transition-all transform hover:scale-110 active:scale-95 z-10"
          title="Lire la vidéo (Espace)"
        >
          <Play className="w-9 h-9 fill-current translate-x-1" />
        </button>
      )}

      {/* 5. TITRE & INFOS EN HAUT (Masquage automatique) */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white transition-opacity duration-300 z-10 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">{fileName}</p>
            {fileSize && <p className="text-[10px] text-zinc-400 font-mono">{fileSize}</p>}
          </div>
        </div>
      </div>

      {/* 6. BARRE DE CONTRÔLE COMPLÈTE EN BAS (Style Glassmorphism Premium) */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex flex-col gap-2 transition-opacity duration-300 z-10 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* BARRE DE PROGRESSION INTERACTIVE */}
        <div
          ref={progressRef}
          onClick={handleSeek}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          className="relative w-full h-2 hover:h-3.5 bg-white/20 rounded-full cursor-pointer transition-all group/progress flex items-center"
        >
          {/* Buffer chargé */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* Progression actuelle */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Curseur de tête de lecture */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Infobulle de temps au survol */}
          {hoverTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/20 pointer-events-none shadow-lg whitespace-nowrap"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* RANGÉE DES CONTRÔLES (Boutons, Volume, Vitesse, Plein écran) */}
        <div className="flex items-center justify-between gap-2 pt-1 text-white">
          {/* GAUCHE : Play, Recul 10s, Avance 10s, Volume, Temps */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-white cursor-pointer transition-colors active:scale-90"
              title={isPlaying ? "Pause (Espace)" : "Lire (Espace)"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Recul 10s */}
            <button
              type="button"
              onClick={() => skip(-10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Reculer de 10 secondes (←)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Avance 10s */}
            <button
              type="button"
              onClick={() => skip(10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Avancer de 10 secondes (→)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume & Mute */}
            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                title={isMuted ? "Activer le son (m)" : "Couper le son (m)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-purple-500"
                title="Régler le volume"
              />
            </div>

            {/* Compteur temps / durée */}
            <div className="text-[11px] sm:text-xs font-mono font-medium text-zinc-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-zinc-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* DROITE : Vitesse, Répétition, PiP, Plein écran, Téléchargement */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* Menu Vitesse de lecture */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  playbackRate !== 1
                    ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                    : 'bg-white/10 hover:bg-white/20 text-zinc-300 border-transparent'
                }`}
                title="Vitesse de lecture"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 py-1 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl z-30 flex flex-col min-w-[75px]">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSpeed(r)}
                      className={`px-3 py-1 text-left text-xs font-semibold hover:bg-purple-600/20 hover:text-purple-300 cursor-pointer ${
                        playbackRate === r ? 'text-purple-400 font-bold bg-purple-500/10' : 'text-zinc-300'
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Répétition en boucle */}
            <button
              type="button"
              onClick={toggleLoop}
              className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
                isLooping ? 'bg-purple-600/30 text-purple-300' : 'hover:bg-white/10 text-zinc-300 hover:text-white'
              }`}
              title={isLooping ? "Boucle activée" : "Lire en boucle"}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Picture-in-Picture */}
            <button
              type="button"
              onClick={togglePiP}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Mini-lecteur flottant (PiP)"
            >
              <Tv className="w-4 h-4" />
            </button>

            {/* Télécharger la vidéo */}
            {resolvedSrc && (
              <a
                href={resolvedSrc}
                download={fileName || 'video.mp4'}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                title="Télécharger la vidéo"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            {/* Plein écran */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title={isFullscreen ? "Quitter le plein écran (f)" : "Plein écran (f)"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
