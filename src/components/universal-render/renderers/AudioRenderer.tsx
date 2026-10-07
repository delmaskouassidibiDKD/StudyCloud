import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, FastForward, Music } from 'lucide-react';

interface AudioRendererProps {
  data: {
    url?: string;
    audioUrl?: string;
    waveformColor?: string;
    progressColor?: string;
    duration?: number;
  };
  title?: string;
}

export function AudioRenderer({ data, title }: AudioRendererProps) {
  const audioUrl = data.url || data.audioUrl || '';
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(data.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || data.duration || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [data.duration]);

  // Dessin de la forme d'onde simulée interactive sur canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const bars = 80;
    const barWidth = width / bars;
    const progress = duration > 0 ? currentTime / duration : 0;
    const activeBars = Math.floor(progress * bars);

    for (let i = 0; i < bars; i++) {
      // Générer une hauteur pseudo-réaliste pour l'onde
      const wave = Math.sin(i * 0.25) * 0.4 + Math.cos(i * 0.6) * 0.3 + 0.5;
      const barHeight = Math.max(6, wave * (height - 16));
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = i <= activeBars ? (data.progressColor || '#f97316') : (data.waveformColor || '#3f4450');
      ctx.beginPath();
      ctx.roundRect(x + 1, y, Math.max(2, barWidth - 2), barHeight, 2);
      ctx.fill();
    }
  }, [currentTime, duration, data.waveformColor, data.progressColor]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const nextTime = ratio * duration;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-zinc-100 max-w-lg mx-auto">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4 shadow-lg shadow-orange-500/5">
        <Music className="w-8 h-8" />
      </div>

      <h3 className="text-base font-bold text-zinc-100 text-center mb-1 max-w-full truncate px-4">
        {title || 'Lecture Audio'}
      </h3>
      <p className="text-xs text-zinc-400 mb-6">
        {formatTime(currentTime)} / {formatTime(duration)}
      </p>

      {/* Waveform Canvas */}
      <div className="w-full h-24 bg-[#1a1c22] rounded-2xl p-3 border border-zinc-700/60 shadow-inner flex items-center justify-center mb-6 cursor-pointer group">
        <canvas
          ref={canvasRef}
          width={400}
          height={80}
          onClick={handleSeek}
          className="w-full h-full"
        />
      </div>

      {/* Commandes */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
          }}
          className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-700"
          title="-10 secondes"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="p-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={cycleSpeed}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-zinc-700"
          title="Vitesse de lecture"
        >
          {playbackRate}x
        </button>

        <button
          type="button"
          onClick={() => {
            setIsMuted(!isMuted);
            if (audioRef.current) audioRef.current.muted = !isMuted;
          }}
          className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-700"
          title={isMuted ? 'Activer le son' : 'Couper le son'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
export default AudioRenderer;
