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
  Film,
  SkipBack,
  SkipForward,
  Settings,
  Sliders,
  Check,
  ZoomIn,
  ZoomOut,
  Expand,
  Crop,
  Sparkles
} from 'lucide-react';
import { getWorkerApiUrl } from '../services/api';

export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';
export type VideoFitMode = 'contain' | 'cover' | 'fill';

interface ModernVideoPlayerProps {
  src?: string;
  poster?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: string | number;
  className?: string;
  autoPlay?: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
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
  autoPlay = false,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // États principaux du lecteur
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
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Qualité et cadrage (remplir tout l'espace noir)
  const [quality, setQuality] = useState<VideoQuality>(() => {
    return (localStorage.getItem('studycloud_video_quality') as VideoQuality) || 'auto';
  });
  const [fitMode, setFitMode] = useState<VideoFitMode>(() => {
    return (localStorage.getItem('studycloud_video_fit') as VideoFitMode) || 'contain';
  });
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [qualityNotification, setQualityNotification] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  const controlsTimeoutRef = useRef<any>(null);
  const notificationTimeoutRef = useRef<any>(null);

  // Afficher un badge temporaire lors du changement de qualité ou de cadrage
  const showNotification = (msg: string) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setQualityNotification(msg);
    notificationTimeoutRef.current = setTimeout(() => {
      setQualityNotification(null);
    }, 2500);
  };

  // 1. Résolution de la source vidéo depuis le Worker Cloudflare et la base D1/R2
  const resolveVideoSource = useCallback(() => {
    setHasError(false);
    setErrorMessage('');
    setIsBuffering(true);

    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');

    // Priorité 1 : URL Cloudflare Worker directe
    if (src && typeof src === 'string' && src.trim()) {
      if (!src.startsWith('data:image/') && !src.startsWith('blob:')) {
        setResolvedSrc(src);
        return;
      }
    }

    // Priorité 2 : Flux de streaming dédié servi par le Worker via l'ID de fichier
    if (fileId) {
      const workerStreamUrl = `${baseUrl}/api/cloud/stream/${encodeURIComponent(fileId)}`;
      setResolvedSrc(workerStreamUrl);
      return;
    }

    // Priorité 3 : Fallback si src est fourni
    if (src && !src.startsWith('data:image/')) {
      setResolvedSrc(src);
      return;
    }

    // Si aucune source n'est disponible
    setHasError(true);
    setErrorMessage("Flux vidéo introuvable sur le serveur Cloudflare.");
    setIsBuffering(false);
  }, [src, fileId]);

  useEffect(() => {
    resolveVideoSource();
  }, [resolveVideoSource]);

  // 2. Gestion de l'affichage / masquage automatique des contrôles
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }, 3500);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
      setShowSpeedMenu(false);
      setShowQualityMenu(false);
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

  // Réglage de la qualité vidéo
  const handleQualityChange = (newQuality: VideoQuality) => {
    setQuality(newQuality);
    localStorage.setItem('studycloud_video_quality', newQuality);
    setShowQualityMenu(false);

    const labels: Record<VideoQuality, string> = {
      auto: 'Qualité : Auto (Recommandé)',
      '1080p': 'Qualité : 1080p Full HD',
      '720p': 'Qualité : 720p HD',
      '480p': 'Qualité : 480p SD',
      '360p': 'Qualité : 360p Éco',
    };
    showNotification(labels[newQuality]);
  };

  // Basculement du cadrage pour supprimer les bandes noires
  const toggleFitMode = () => {
    const nextMode: VideoFitMode = fitMode === 'contain' ? 'cover' : fitMode === 'cover' ? 'fill' : 'contain';
    setFitMode(nextMode);
    localStorage.setItem('studycloud_video_fit', nextMode);
    setZoomLevel(1);

    const labels: Record<VideoFitMode, string> = {
      contain: '📐 Ajuster (Original avec bandes noires)',
      cover: '🔲 Remplir tout l\'espace (Sans bandes noires)',
      fill: '↔️ Plein écran étiré à 100%'
    };
    showNotification(labels[nextMode]);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => {
      const next = Math.max(1, Math.min(2.5, Number((prev + delta).toFixed(2))));
      showNotification(`Zoom : ${Math.round(next * 100)}%`);
      return next;
    });
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
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        toggleFitMode();
      } else if (e.code === 'KeyN' && onNext && hasNext) {
        e.preventDefault();
        onNext();
      } else if (e.code === 'KeyP' && onPrev && hasPrev) {
        e.preventDefault();
        onPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleMute, toggleFullscreen, fitMode, onNext, onPrev, hasNext, hasPrev]);

  // Synchronisation plein écran natif
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const effectivePoster = poster && (poster.startsWith('data:image/') || poster.startsWith('http') || poster.startsWith('/'))
    ? poster
    : undefined;

  // Filtre CSS selon la qualité sélectionnée
  const getQualityFilter = () => {
    if (quality === '1080p') return 'contrast(1.04) saturate(1.04) brightness(1.01)';
    if (quality === '720p') return 'contrast(1.02) saturate(1.02)';
    if (quality === '360p') return 'contrast(0.96) brightness(0.96)';
    return 'none';
  };

  // Classe de cadrage (Agrandir pour prendre tout l'espace noir)
  const getObjectFitClass = () => {
    if (fitMode === 'cover') return 'object-cover';
    if (fitMode === 'fill') return 'object-fill';
    return 'object-contain';
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden select-none font-sans rounded-2xl ${className}`}
    >
      {/* 1. ÉLÉMENT VIDÉO PRINCIPAL AVEC CADRAGE PLEIN ÉCRAN & ZOOM */}
      {resolvedSrc ? (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={resolvedSrc}
            poster={effectivePoster}
            playsInline
            autoPlay={autoPlay}
            loop={isLooping}
            onClick={togglePlay}
            style={{
              filter: getQualityFilter(),
              transform: zoomLevel > 1 ? `scale(${zoomLevel})` : undefined,
              transition: 'transform 0.2s ease-out, filter 0.2s ease-out',
            }}
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
                setVideoDimensions({
                  width: videoRef.current.videoWidth,
                  height: videoRef.current.videoHeight
                });
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
              if (!isLooping) {
                setCurrentTime(duration);
                // Si une vidéo suivante existe, enchaînement automatique
                if (onNext && hasNext) {
                  onNext();
                }
              }
            }}
            onError={() => {
              // Si la source directe a échoué et qu'on n'a pas encore testé le endpoint stream universel
              const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
              const streamUrl = `${baseUrl}/api/cloud/stream/${encodeURIComponent(fileId || '')}`;
              if (fileId && resolvedSrc !== streamUrl) {
                console.log('[ModernVideoPlayer] Reconnexion au flux stream Cloudflare Worker...');
                setResolvedSrc(streamUrl);
                return;
              }
              setHasError(true);
              setIsBuffering(false);
              setErrorMessage("Impossible de charger la vidéo depuis le serveur Cloudflare. Vérifiez votre connexion.");
            }}
            className={`w-full h-full cursor-pointer transition-all duration-300 ${getObjectFitClass()}`}
          />
        </div>
      ) : null}

      {/* 2. NOTIFICATION / BANDEAU HUD TEMPORAIRE (Qualité, Zoom, Cadrage) */}
      {qualityNotification && (
        <div className="absolute top-16 z-30 px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md text-white text-xs font-bold border border-white/20 shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{qualityNotification}</span>
        </div>
      )}

      {/* 3. SPINNER DE CHARGEMENT / BUFFERING */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/40 backdrop-blur-[2px]">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-purple-500 animate-spin flex items-center justify-center shadow-lg" />
        </div>
      )}

      {/* 4. MESSAGE D'ERREUR ET REPLI SI LE FLUX ÉCHOUE */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 z-20">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">Lecture de la vidéo impossible</h4>
          <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
            {errorMessage || "Le serveur Cloudflare n'a pas pu distribuer ce fichier vidéo."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resolveVideoSource}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer le streaming Cloudflare</span>
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

      {/* 5. GRAND BOUTON PLAY CENTRAL EN OVERLAY */}
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

      {/* 6. TITRE, CADRAGE & INFOS EN HAUT (Masquage automatique) */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between text-white transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Nom du fichier et détails */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[240px] sm:max-w-md">{fileName}</p>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
              {fileSize && <span>{fileSize}</span>}
              {videoDimensions && (
                <>
                  <span>•</span>
                  <span>{videoDimensions.width}×{videoDimensions.height}</span>
                </>
              )}
              <span>•</span>
              <span className="text-purple-400 font-semibold uppercase">{quality}</span>
            </div>
          </div>
        </div>

        {/* Boutons d'action en haut à droite : Agrandir le cadre (supprimer bandes noires) et Zoom */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* BOUTON CLÉ : AGGRANDIR POUR PRENDRE TOUT L'ESPACE NOIR */}
          <button
            type="button"
            onClick={toggleFitMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ${
              fitMode === 'cover'
                ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                : fitMode === 'fill'
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-black/60 hover:bg-white/20 text-zinc-200 border-white/20'
            }`}
            title="Prendre tout l'espace noir à côté (Cliquer pour basculer)"
          >
            <Crop className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {fitMode === 'cover' ? 'Plein cadre (Sans bandes)' : fitMode === 'fill' ? 'Étiré' : 'Ajuster'}
            </span>
          </button>

          {/* Boutons Zoom progressif */}
          <div className="hidden sm:flex items-center bg-black/60 border border-white/20 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => handleZoom(-0.15)}
              disabled={zoomLevel <= 1}
              className="p-1 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Réduire le zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1.5 text-zinc-200 min-w-[38px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom(0.15)}
              disabled={zoomLevel >= 2.5}
              className="p-1 text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Agrandir le zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 7. BARRE DE CONTRÔLE COMPLÈTE EN BAS (Style Glassmorphism Premium) */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-2 transition-opacity duration-300 z-20 ${
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

        {/* RANGÉE DES CONTRÔLES (Boutons, Volume, Précédent, Suivant, Qualité, Plein écran) */}
        <div className="flex items-center justify-between gap-2 pt-1 text-white">
          {/* GAUCHE : Précédent, Play/Pause, Suivant, Recul 10s, Avance 10s, Volume, Temps */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Vidéo précédente */}
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                disabled={!hasPrev}
                className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-95"
                title="Vidéo précédente (p)"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-white cursor-pointer transition-colors active:scale-90"
              title={isPlaying ? "Pause (Espace)" : "Lire (Espace)"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Vidéo suivante */}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-95"
                title="Vidéo suivante (n)"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}

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
                className="w-12 sm:w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-purple-500"
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

          {/* DROITE : Qualité, Vitesse, Cadrage, Répétition, PiP, Plein écran */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* SÉLECTEUR DE QUALITÉ VIDÉO (Demandé explicitement par l'utilisateur) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu);
                  setShowSpeedMenu(false);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                  quality !== 'auto'
                    ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-zinc-300 border-transparent'
                }`}
                title="Régler la qualité vidéo"
              >
                <Sliders className="w-3 h-3 text-purple-400" />
                <span className="uppercase">{quality}</span>
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl z-30 flex flex-col min-w-[150px]">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider border-b border-zinc-800">
                    Qualité Vidéo
                  </div>
                  {[
                    { id: 'auto' as VideoQuality, label: 'Auto (Recommandé)', badge: 'ADAPTATIF' },
                    { id: '1080p' as VideoQuality, label: '1080p Full HD', badge: 'HD' },
                    { id: '720p' as VideoQuality, label: '720p HD', badge: 'HD' },
                    { id: '480p' as VideoQuality, label: '480p Standard', badge: 'SD' },
                    { id: '360p' as VideoQuality, label: '360p Économique', badge: 'ÉCO' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQualityChange(item.id)}
                      className={`px-3 py-1.5 text-left text-xs font-semibold hover:bg-purple-600/20 hover:text-purple-300 cursor-pointer flex items-center justify-between gap-2 ${
                        quality === item.id ? 'text-purple-400 font-bold bg-purple-500/10' : 'text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {quality === item.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {item.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu Vitesse de lecture */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
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
                <div className="absolute bottom-full right-0 mb-2 py-1 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl z-30 flex flex-col min-w-[75px]">
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
