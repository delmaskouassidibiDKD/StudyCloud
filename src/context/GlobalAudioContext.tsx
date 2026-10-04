import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { FileItem } from '../services/cloudDataStore';
import { getFileBlobUrl } from '../services/localFileStorage';

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

  // Charger la source audio (IndexedDB blob en priorité, sinon URL distante)
  const resolveTrackUrl = async (track: FileItem): Promise<string> => {
    if (track.id) {
      try {
        const localBlob = await getFileBlobUrl(track.id);
        if (localBlob) return localBlob;
      } catch (e) {}
    }
    const direct = track.fileUrl || track.url || track.audioUrl || '';
    if (direct) return direct;
    return '';
  };

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
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[GlobalAudio] play notice:', err);
        }
      });
    }
  }, []);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    desiredPlaybackStateRef.current = false;
    isChangingTrackRef.current = false;
    setIsAudioPlaying(false);
    if (audio) {
      audio.pause();
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isAudioPlaying, pauseAudio, playAudio]);

  const playTrack = useCallback(async (track: FileItem, newPlaylist?: FileItem[]) => {
    if (!track) return;
    isChangingTrackRef.current = true;
    desiredPlaybackStateRef.current = true;
    setCurrentTime(0);
    setCurrentTrack(track);

    if (newPlaylist && Array.isArray(newPlaylist) && newPlaylist.length > 0) {
      setPlaylist(newPlaylist);
    }

    const url = await resolveTrackUrl(track);
    setResolvedAudioUrl(url);

    if (audioRef.current) {
      if (audioRef.current.src !== url) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      audioRef.current.currentTime = 0;
      playAudio();
    }
  }, [playAudio]);

  const handleAudioNext = useCallback(() => {
    const list = playlist.length > 0 ? playlist : (currentTrack ? [currentTrack] : []);
    if (list.length === 0) return;

    const curIdx = currentTrack ? list.findIndex(t => t.id === currentTrack.id) : -1;

    // Si une seule piste ou dernière piste avec répétition désactivée ('off') : arrêt propre
    if ((list.length <= 1 || curIdx >= list.length - 1) && isAudioRepeat === 'off') {
      setIsAudioPlaying(false);
      desiredPlaybackStateRef.current = false;
      isChangingTrackRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      return;
    }

    if (list.length === 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        playAudio();
      }
      setCurrentTime(0);
      setIsAudioPlaying(true);
      return;
    }

    if (isAudioShuffle) {
      const randIdx = Math.floor(Math.random() * list.length);
      playTrack(list[randIdx]);
      return;
    }

    const nextIdx = (curIdx + 1) % list.length;
    playTrack(list[nextIdx]);
  }, [playlist, currentTrack, isAudioRepeat, isAudioShuffle, playAudio, playTrack]);

  const handleAudioPrev = useCallback(() => {
    const list = playlist.length > 0 ? playlist : (currentTrack ? [currentTrack] : []);
    if (list.length === 0) return;

    if (list.length === 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        playAudio();
      }
      setCurrentTime(0);
      setIsAudioPlaying(true);
      return;
    }

    if (isAudioShuffle) {
      const randIdx = Math.floor(Math.random() * list.length);
      playTrack(list[randIdx]);
      return;
    }

    const curIdx = currentTrack ? list.findIndex(t => t.id === currentTrack.id) : 0;
    const prevIdx = (curIdx - 1 + list.length) % list.length;
    playTrack(list[prevIdx]);
  }, [playlist, currentTrack, isAudioShuffle, playAudio, playTrack]);

  const toggleAudioRepeat = useCallback(() => {
    setIsAudioRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleAudioShuffle = useCallback(() => {
    setIsAudioShuffle(prev => !prev);
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setCurrentTime(0);
    setCurrentTrack(null);
    setResolvedAudioUrl('');
  }, []);

  // Déclenchement automatique de la lecture quand la source est prête
  useEffect(() => {
    if (!currentTrack || !resolvedAudioUrl || !audioRef.current) return;
    if (desiredPlaybackStateRef.current) {
      audioRef.current.play().then(() => {
        isChangingTrackRef.current = false;
        setIsAudioPlaying(true);
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[GlobalAudio] play on effect:', err);
        }
      });
    }
  }, [currentTrack?.id, resolvedAudioUrl]);

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
      {/* Élément audio persistant global (ne s'arrête jamais quand on change de menu) */}
      <audio
        ref={audioRef}
        src={resolvedAudioUrl}
        preload="auto"
        loop={isAudioRepeat === 'one'}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(Math.floor(audioRef.current.duration));
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
        }}
        onPause={() => {
          if (audioRef.current?.ended) {
            if (isAudioRepeat === 'off') {
              const list = playlist.length > 0 ? playlist : (currentTrack ? [currentTrack] : []);
              const curIdx = currentTrack ? list.findIndex(t => t.id === currentTrack.id) : -1;
              if (curIdx === -1 || curIdx >= list.length - 1) {
                setIsAudioPlaying(false);
                desiredPlaybackStateRef.current = false;
                isChangingTrackRef.current = false;
                return;
              }
            }
          }
          if (!isChangingTrackRef.current) {
            setIsAudioPlaying(false);
          }
        }}
        onEnded={() => {
          if (isAudioRepeat === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              playAudio();
            }
            setCurrentTime(0);
          } else if (isAudioRepeat === 'all') {
            const list = playlist.length > 0 ? playlist : (currentTrack ? [currentTrack] : []);
            if (list.length <= 1) {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                playAudio();
              }
              setCurrentTime(0);
            } else {
              handleAudioNext();
            }
          } else {
            const list = playlist.length > 0 ? playlist : (currentTrack ? [currentTrack] : []);
            const curIdx = currentTrack ? list.findIndex(t => t.id === currentTrack.id) : -1;
            if (curIdx >= 0 && curIdx < list.length - 1) {
              handleAudioNext();
            } else {
              setIsAudioPlaying(false);
              desiredPlaybackStateRef.current = false;
              isChangingTrackRef.current = false;
              setCurrentTime(0);
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
            }
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const cur = Math.floor(audioRef.current.currentTime);
            setCurrentTime(cur);
            if (audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
              const dur = Math.floor(audioRef.current.duration);
              setDuration(dur);
              if (cur >= dur && isAudioRepeat === 'off') {
                const list = playlist.length > 0 ? playlist : (currentTrack ? [currentTrack] : []);
                const curIdx = currentTrack ? list.findIndex(t => t.id === currentTrack.id) : -1;
                if (curIdx === -1 || curIdx >= list.length - 1) {
                  setIsAudioPlaying(false);
                  desiredPlaybackStateRef.current = false;
                  isChangingTrackRef.current = false;
                }
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
