import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Repeat,
  Download,
  Music,
  Disc,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { getFileBlobUrl, getFileBlob } from '../services/localFileStorage';

interface ModernAudioPlayerProps {
  src?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: string | number;
  artist?: string;
  className?: string;
  autoPlay?: boolean;
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
  autoPlay = false
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);

  // Résolution de la source audio avec fallback IndexedDB
  const resolveAudioSource = useCallback(async () => {
    setHasError(false);
    setErrorMessage('');

    if (src && typeof src === 'string' && src.trim() && !src.startsWith('data:image/')) {
      setResolvedSrc(src);
      return;
    }

    if (fileId) {
      try {
        const blobUrl = await getFileBlobUrl(fileId);
        if (blobUrl) {
          setResolvedSrc(blobUrl);
          return;
        }
      } catch (err) {
        console.warn('[ModernAudioPlayer] Erreur chargement IndexedDB:', err);
      }
    }

    if (!src || src.startsWith('data:image/')) {
      setHasError(true);
      setErrorMessage("Fichier audio non disponible.");
    }
  }, [src, fileId]);

  useEffect(() => {
    resolveAudioSource();
  }, [resolveAudioSource]);

  useEffect(() => {
    return () => {
      if (resolvedSrc && resolvedSrc.startsWith('blob:') && resolvedSrc !== src) {
        try {
          URL.revokeObjectURL(resolvedSrc);
        } catch {}
      }
    };
  }, [resolvedSrc, src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const skip = (secs: number) => {
    if (!audioRef.current) return;
    const nextTime = Math.max(0, Math.min(duration || 9999, audioRef.current.currentTime + secs));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !isMuted;
    audioRef.current.muted = next;
    setIsMuted(next);
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

  const setSpeed = (rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`w-full max-w-xl mx-auto flex flex-col items-center justify-between p-6 sm:p-8 bg-[#0F1420] text-white rounded-3xl border border-white/10 shadow-2xl relative select-none ${className}`}>
      {/* Balise audio réelle */}
      {resolvedSrc && (
        <audio
          ref={audioRef}
          src={resolvedSrc}
          autoPlay={autoPlay}
          loop={isLooping}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration || 0);
          }}
          onPlaying={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (!isLooping) setCurrentTime(duration);
          }}
          onError={async () => {
            if (fileId && !resolvedSrc.startsWith('blob:')) {
              const b = await getFileBlob(fileId);
              if (b) {
                setResolvedSrc(URL.createObjectURL(b));
                return;
              }
            }
            setHasError(true);
            setErrorMessage("Erreur de décodage audio.");
          }}
        />
      )}

      {/* DISQUE VINYLE ANIMÉ / VISUEL CENTRAL */}
      <div className="relative my-4 flex items-center justify-center">
        {/* Halo lumineux */}
        <div className={`absolute -inset-4 rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 blur-xl transition-opacity duration-500 ${
          isPlaying ? 'opacity-100 animate-pulse' : 'opacity-30'
        }`} />

        {/* Disque Vinyle */}
        <div className={`w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-2 border-4 border-zinc-800/80 shadow-2xl flex items-center justify-center transition-transform duration-700 ${
          isPlaying ? 'animate-spin' : ''
        }`} style={{ animationDuration: '6s' }}>
          {/* Sillons du vinyle */}
          <div className="w-full h-full rounded-full border border-zinc-800 flex items-center justify-center">
            <div className="w-3/4 h-3/4 rounded-full border border-zinc-800/60 flex items-center justify-center">
              {/* Centre / Étiquette */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-inner">
                <Disc className="w-8 h-8 text-white/90" />
              </div>
            </div>
          </div>
        </div>

        {/* ÉGALISEUR ANIMÉ EN BAS DU DISQUE */}
        <div className="absolute -bottom-2 inset-x-0 flex items-center justify-center gap-1">
          {[12, 24, 18, 28, 14, 26, 20, 30, 16, 22].map((h, idx) => (
            <div
              key={idx}
              className={`w-1 rounded-full bg-emerald-400 transition-all duration-150 ${
                isPlaying ? 'opacity-100' : 'opacity-40'
              }`}
              style={{
                height: isPlaying ? `${Math.max(6, Math.sin(Date.now() / 200 + idx) * (h / 2) + h / 2)}px` : '4px'
              }}
            />
          ))}
        </div>
      </div>

      {/* TITRE ET MÉTADONNÉES */}
      <div className="text-center my-4 w-full px-4">
        <h3 className="text-base sm:text-lg font-black text-white truncate" title={fileName}>
          {fileName}
        </h3>
        <p className="text-xs text-emerald-400 font-semibold mt-0.5">{artist}</p>
        {fileSize && <p className="text-[10px] text-zinc-400 font-mono mt-1">{fileSize}</p>}
      </div>

      {/* GESTION D'ERREUR */}
      {hasError && (
        <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 my-2 text-center text-xs text-rose-300 flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={resolveAudioSource}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* BARRE DE PROGRESSION */}
      <div className="w-full my-3">
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="relative w-full h-2 hover:h-3 bg-white/10 rounded-full cursor-pointer transition-all group/aud flex items-center"
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow scale-0 group-hover/aud:scale-100 transition-transform pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mt-1.5 px-0.5">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>

      {/* BOUTONS DE CONTRÔLE */}
      <div className="w-full flex items-center justify-between gap-2 pt-2">
        {/* Vitesse */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg text-zinc-300 cursor-pointer"
          >
            {playbackRate}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full left-0 mb-2 py-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-20 flex flex-col min-w-[70px]">
              {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSpeed(r)}
                  className={`px-3 py-1 text-left text-xs font-semibold ${
                    playbackRate === r ? 'text-emerald-400 font-bold bg-emerald-500/10' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Centre : Reculer 10s, Play/Pause, Avancer 10s */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => skip(-10)}
            className="p-2 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title="Reculer de 10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            title={isPlaying ? "Pause" : "Lecture"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => skip(10)}
            className="p-2 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title="Avancer de 10s"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Droite : Boucle & Volume */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isLooping ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-white'
            }`}
            title={isLooping ? "Boucle active" : "Activer boucle"}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            <button type="button" onClick={toggleMute} className="text-zinc-400 hover:text-white cursor-pointer">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 sm:w-18 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {resolvedSrc && (
            <a
              href={resolvedSrc}
              download={fileName || 'audio.mp3'}
              className="p-2 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              title="Télécharger l'audio"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
