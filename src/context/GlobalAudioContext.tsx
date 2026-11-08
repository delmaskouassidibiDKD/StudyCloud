import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { FileItem, CloudDataStore } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlobUrl } from '../services/localFileStorage';
import { getWorkerApiUrl } from '../services/api';

export interface GlobalAudioContextType {
  currentTrack: FileItem | null;
  isAudioPlaying: boolean;
  currentTime: number;
  duration: number;
  isAudioRepeat: 'off' | 'all' | 'one';
  isAudioShuffle: boolean;
  playlist: FileItem[];
  resolvedAudioUrl: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playTrack: (track: FileItem, newPlaylist?: FileItem[]) => Promise<void>;
  updateCurrentTrack: (updater: FileItem | null | ((prev: FileItem | null) => FileItem | null)) => void;
  togglePlayPause: () => void;
  playAudio: () => void;
  pauseAudio: () => void;
  handleAudioNext: () => void;
  handleAudioPrev: () => void;
  toggleAudioRepeat: () => void;
  toggleAudioShuffle: () => void;
  seek: (time: number) => void;
  seekDelta: (deltaSec: number) => void;
  stopAndClose: () => void;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | undefined>(undefined);

export const GlobalAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioRepeat, setIsAudioRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [isAudioShuffle, setIsAudioShuffle] = useState(false);
  const [playlist, setPlaylist] = useState<FileItem[]>([]);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isChangingTrackRef = useRef(false);
  const desiredPlaybackStateRef = useRef(false);

  // Synchronous cache for blob URLs and direct URLs to avoid background async drops
  const blobUrlMapRef = useRef<Map<string, string>>(new Map());

  // Références toujours fraîches pour les gestionnaires d'événements en tâche de fond (écran éteint / verrouillé)
  const currentTrackRef = useRef<FileItem | null>(null);
  const playlistRef = useRef<FileItem[]>([]);
  const isAudioRepeatRef = useRef<'off' | 'all' | 'one'>('off');
  const isAudioShuffleRef = useRef(false);

  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { isAudioRepeatRef.current = isAudioRepeat; }, [isAudioRepeat]);
  useEffect(() => { isAudioShuffleRef.current = isAudioShuffle; }, [isAudioShuffle]);

  // Synchronisation avec l'API OS MediaSession (Écran de verrouillage Android / iOS / Windows)
  const updateMediaSession = useCallback((track: FileItem | null, isPlaying: boolean) => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (track) {
      try {
        const coverArt = track.previewUrl || (track as any).thumbnailUrl || '/icon-192.png';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name || 'Piste audio',
          artist: track.artist || track.source || 'StudyCloud Audio',
          album: 'StudyCloud Musique',
          artwork: [
            { src: coverArt, sizes: '96x96', type: 'image/png' },
            { src: coverArt, sizes: '128x128', type: 'image/png' },
            { src: coverArt, sizes: '192x192', type: 'image/png' },
            { src: coverArt, sizes: '256x256', type: 'image/png' },
            { src: coverArt, sizes: '384x384', type: 'image/png' },
            { src: coverArt, sizes: '512x512', type: 'image/png' },
          ]
        });
      } catch (e) {}
    }

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}
  }, []);

  // Pré-chargement des URLs en tâche de fond pour une transition 100% synchrone
  const prefetchTrackBlob = useCallback(async (track: FileItem) => {
    if (track.id && !blobUrlMapRef.current.has(track.id)) {
      try {
        const localBlob = await getFileBlobUrl(track.id);
        if (localBlob) {
          blobUrlMapRef.current.set(track.id, localBlob);
        }
      } catch (e) {}
    }
  }, []);

  const prefetchPlaylist = useCallback(async (tracks: FileItem[]) => {
    for (const t of tracks) {
      prefetchTrackBlob(t);
    }
  }, [prefetchTrackBlob]);

  // Résolution synchrone immédiate d'une source audio (garantit zéro délai sous écran verrouillé)
  const getSyncTrackUrl = useCallback((track: FileItem): string => {
    if (track.id && blobUrlMapRef.current.has(track.id)) {
      return blobUrlMapRef.current.get(track.id)!;
    }
    const direct = track.fileUrl || track.url || track.audioUrl || '';
    if (direct && !direct.startsWith('data:image/')) {
      return direct;
    }
    if (track.id) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      return `${baseUrl}/api/cloud/stream/${encodeURIComponent(track.id)}`;
    }
    return '';
  }, []);

  const playAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.ended || (audio.duration && !isNaN(audio.duration) && audio.currentTime >= audio.duration)) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
    desiredPlaybackStateRef.current = true;
    setIsAudioPlaying(true);
    isChangingTrackRef.current = false;
    updateMediaSession(currentTrackRef.current, true);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[GlobalAudio] play notice:', err);
        }
      });
    }
  }, [updateMediaSession]);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    desiredPlaybackStateRef.current = false;
    isChangingTrackRef.current = false;
    setIsAudioPlaying(false);
    updateMediaSession(currentTrackRef.current, false);
    if (audio) {
      audio.pause();
    }
  }, [updateMediaSession]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isAudioPlaying, pauseAudio, playAudio]);

  const updateCurrentTrack = useCallback((updater: FileItem | null | ((prev: FileItem | null) => FileItem | null)) => {
    setCurrentTrack(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      currentTrackRef.current = next;
      return next;
    });
  }, []);

  const playTrack = useCallback(async (track: FileItem, newPlaylist?: FileItem[]) => {
    if (!track) return;

    const isSameTrack = Boolean(
      currentTrackRef.current &&
      (currentTrackRef.current.id === track.id ||
        (currentTrackRef.current.name &&
          currentTrackRef.current.name === track.name &&
          currentTrackRef.current.size === track.size))
    );

    if (newPlaylist && Array.isArray(newPlaylist) && newPlaylist.length > 0) {
      setPlaylist(newPlaylist);
      playlistRef.current = newPlaylist;
      prefetchPlaylist(newPlaylist);
    }

    // Si la piste est déjà en cours/chargée, on ne coupe pas et on ne remet jamais currentTime à 0
    if (isSameTrack && audioRef.current && audioRef.current.src && !audioRef.current.error) {
      setCurrentTrack(track);
      currentTrackRef.current = track;
      if (audioRef.current.paused) {
        playAudio();
      }
      return;
    }

    isChangingTrackRef.current = true;
    desiredPlaybackStateRef.current = true;
    setCurrentTime(0);
    setCurrentTrack(track);
    currentTrackRef.current = track;

    // Résolution synchrone prioritaire pour démarrage immédiat
    const syncUrl = getSyncTrackUrl(track);
    let finalUrl = syncUrl;

    if (!finalUrl && track.id) {
      try {
        const localBlob = await getFileBlobUrl(track.id);
        if (localBlob) {
          blobUrlMapRef.current.set(track.id, localBlob);
          finalUrl = localBlob;
        }
      } catch (e) {}
    }

    if (!finalUrl) {
      finalUrl = track.fileUrl || track.url || track.audioUrl || '';
    }

    setResolvedAudioUrl(finalUrl);

    const audio = audioRef.current;
    if (audio && finalUrl) {
      if (audio.src !== finalUrl) {
        audio.src = finalUrl;
      }
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsAudioPlaying(true);
          isChangingTrackRef.current = false;
          updateMediaSession(track, true);
        }).catch((err) => {
          if (err.name !== 'AbortError') console.warn('[GlobalAudio] play error:', err);
        });
      }
    }

    // En tâche de fond, pré-résoudre le blob local si ce n'est pas déjà fait
    prefetchTrackBlob(track);
  }, [getSyncTrackUrl, playAudio, prefetchPlaylist, prefetchTrackBlob, updateMediaSession]);

  const handleAudioNext = useCallback(() => {
    const list = playlistRef.current.length > 0 ? playlistRef.current : (currentTrackRef.current ? [currentTrackRef.current] : []);
    if (list.length === 0) return;

    const curTrack = currentTrackRef.current;
    const curIdx = curTrack ? list.findIndex(t => t.id === curTrack.id) : -1;

    // Si répétition 1 titre activée ('one')
    if (isAudioRepeatRef.current === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      setCurrentTime(0);
      setIsAudioPlaying(true);
      updateMediaSession(curTrack, true);
      return;
    }

    // Si dernière piste et répétition désactivée ('off') : arrêt propre
    if ((list.length <= 1 || curIdx >= list.length - 1) && isAudioRepeatRef.current === 'off') {
      setIsAudioPlaying(false);
      desiredPlaybackStateRef.current = false;
      isChangingTrackRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      updateMediaSession(curTrack, false);
      return;
    }

    let nextTrack: FileItem;
    if (isAudioShuffleRef.current) {
      const randIdx = Math.floor(Math.random() * list.length);
      nextTrack = list[randIdx];
    } else {
      const nextIdx = (curIdx + 1) % list.length;
      nextTrack = list[nextIdx];
    }

    // Basculement SYNCHRONE du lecteur audio : CRITIQUE quand l'écran est en veille / verrouillé !
    const audio = audioRef.current;
    if (audio && nextTrack) {
      isChangingTrackRef.current = true;
      desiredPlaybackStateRef.current = true;
      const nextUrl = getSyncTrackUrl(nextTrack);
      if (nextUrl) {
        audio.src = nextUrl;
      }
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          isChangingTrackRef.current = false;
          setIsAudioPlaying(true);
          updateMediaSession(nextTrack, true);
        }).catch((err) => {
          if (err.name !== 'AbortError') console.warn('[BackgroundAudio] play error on next:', err);
        });
      }
    }

    setCurrentTrack(nextTrack);
    currentTrackRef.current = nextTrack;
    setResolvedAudioUrl(getSyncTrackUrl(nextTrack));
    setCurrentTime(0);
    prefetchTrackBlob(nextTrack);
  }, [getSyncTrackUrl, prefetchTrackBlob, updateMediaSession]);

  const handleAudioPrev = useCallback(() => {
    const list = playlistRef.current.length > 0 ? playlistRef.current : (currentTrackRef.current ? [currentTrackRef.current] : []);
    if (list.length === 0) return;

    const curTrack = currentTrackRef.current;
    const curIdx = curTrack ? list.findIndex(t => t.id === curTrack.id) : 0;

    let prevTrack: FileItem;
    if (isAudioShuffleRef.current) {
      const randIdx = Math.floor(Math.random() * list.length);
      prevTrack = list[randIdx];
    } else {
      const prevIdx = (curIdx - 1 + list.length) % list.length;
      prevTrack = list[prevIdx];
    }

    const audio = audioRef.current;
    if (audio && prevTrack) {
      isChangingTrackRef.current = true;
      desiredPlaybackStateRef.current = true;
      const prevUrl = getSyncTrackUrl(prevTrack);
      if (prevUrl) {
        audio.src = prevUrl;
      }
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          isChangingTrackRef.current = false;
          setIsAudioPlaying(true);
          updateMediaSession(prevTrack, true);
        }).catch((err) => {
          if (err.name !== 'AbortError') console.warn('[BackgroundAudio] play error on prev:', err);
        });
      }
    }

    setCurrentTrack(prevTrack);
    currentTrackRef.current = prevTrack;
    setResolvedAudioUrl(getSyncTrackUrl(prevTrack));
    setCurrentTime(0);
    prefetchTrackBlob(prevTrack);
  }, [getSyncTrackUrl, prefetchTrackBlob, updateMediaSession]);

  const toggleAudioRepeat = useCallback(() => {
    setIsAudioRepeat(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      isAudioRepeatRef.current = next;
      return next;
    });
  }, []);

  const toggleAudioShuffle = useCallback(() => {
    setIsAudioShuffle(prev => {
      isAudioShuffleRef.current = !prev;
      return !prev;
    });
  }, []);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration || 1000, time));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const seekDelta = useCallback((deltaSec: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration || 1000, currentTime + deltaSec));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [currentTime, duration]);

  const stopAndClose = useCallback(() => {
    desiredPlaybackStateRef.current = false;
    isChangingTrackRef.current = false;
    setIsAudioPlaying(false);
    updateMediaSession(null, false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setCurrentTime(0);
    setCurrentTrack(null);
    currentTrackRef.current = null;
    setResolvedAudioUrl('');
  }, [updateMediaSession]);

  // Initialisation et gestion des actions du MediaSession API (Commandes écran de verrouillage & écouteurs Bluetooth)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        playAudio();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        pauseAudio();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handleAudioPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleAudioNext();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        seekDelta(-(details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        seekDelta(details.seekOffset || 10);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopAndClose();
      });
    } catch (err) {
      console.warn('[GlobalAudio] mediaSession setup:', err);
    }
  }, [playAudio, pauseAudio, handleAudioNext, handleAudioPrev, seek, seekDelta, stopAndClose]);

  return (
    <GlobalAudioContext.Provider
      value={{
        currentTrack,
        isAudioPlaying,
        currentTime,
        duration,
        isAudioRepeat,
        isAudioShuffle,
        playlist,
        resolvedAudioUrl,
        audioRef,
        playTrack,
        updateCurrentTrack,
        togglePlayPause,
        playAudio,
        pauseAudio,
        handleAudioNext,
        handleAudioPrev,
        toggleAudioRepeat,
        toggleAudioShuffle,
        seek,
        seekDelta,
        stopAndClose,
      }}
    >
      {children}
      {/* Élément audio persistant global (ne s'arrête jamais en veille ou lors du changement de menu) */}
      <audio
        ref={audioRef}
        src={resolvedAudioUrl}
        preload="auto"
        playsInline
        loop={isAudioRepeat === 'one'}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0 && audioRef.current.duration !== Infinity) {
            const d = Math.floor(audioRef.current.duration);
            setDuration(d);
            const tr = currentTrackRef.current;
            if (tr && tr.id && (!tr.durationSec || tr.durationSec <= 0)) {
              tr.durationSec = d;
              CloudDataStore.updateFile(tr.id, { durationSec: d });
              CloudStorageAPI.saveAudioDuration(tr.id, d).catch(() => {});
            }
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0 && audioRef.current.duration !== Infinity) {
            const d = Math.floor(audioRef.current.duration);
            setDuration(d);
            const tr = currentTrackRef.current;
            if (tr && tr.id && (!tr.durationSec || tr.durationSec <= 0)) {
              tr.durationSec = d;
              CloudDataStore.updateFile(tr.id, { durationSec: d });
              CloudStorageAPI.saveAudioDuration(tr.id, d).catch(() => {});
            }
          }
        }}
        onCanPlay={() => {
          if (desiredPlaybackStateRef.current && audioRef.current?.paused) {
            playAudio();
          }
        }}
        onPlay={() => {
          isChangingTrackRef.current = false;
          setIsAudioPlaying(true);
          updateMediaSession(currentTrackRef.current, true);
        }}
        onPause={() => {
          if (!isChangingTrackRef.current) {
            setIsAudioPlaying(false);
            updateMediaSession(currentTrackRef.current, false);
          }
        }}
        onEnded={() => {
          // Passage automatique à la piste suivante même si l'écran est noir / verrouillé
          handleAudioNext();
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const cur = Math.floor(audioRef.current.currentTime);
            setCurrentTime(cur);
            if (audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
              const dur = Math.floor(audioRef.current.duration);
              setDuration(dur);

              // Mise à jour de la position dans le centre de notifications / écran de verrouillage
              if (typeof window !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
                try {
                  navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackRate: 1,
                    position: Math.min(cur, dur)
                  });
                } catch (e) {}
              }
            }
          }
        }}
      />
    </GlobalAudioContext.Provider>
  );
};

export const useGlobalAudio = () => {
  const context = useContext(GlobalAudioContext);
  if (!context) {
    throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  }
  return context;
};
