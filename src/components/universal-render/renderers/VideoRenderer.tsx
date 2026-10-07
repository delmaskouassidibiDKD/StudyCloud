import React, { useRef, useState } from 'react';
import { Video, Maximize2 } from 'lucide-react';

interface VideoRendererProps {
  data: {
    url?: string;
    videoUrl?: string;
    poster?: string;
    isLive?: boolean;
  };
  title?: string;
}

export function VideoRenderer({ data, title }: VideoRendererProps) {
  const videoUrl = data.url || data.videoUrl || '';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);

  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  const getYouTubeEmbedUrl = (url: string) => {
    try {
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${id}`;
      }
      const match = url.match(/[?&]v=([^&]+)/);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    } catch {}
    return url;
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 text-zinc-100 overflow-hidden">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="w-4 h-4 text-rose-400 shrink-0" />
          <h3 className="text-sm font-bold text-zinc-200 truncate">
            {title || 'Lecture Vidéo'}
          </h3>
          {data.isLive && (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Direct
            </span>
          )}
        </div>

        {!isYouTube && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-zinc-700"
            >
              {speed}x
            </button>
            <button
              type="button"
              onClick={handleFullscreen}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-700"
              title="Plein écran"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 w-full flex items-center justify-center bg-black/90 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative">
        {isYouTube ? (
          <iframe
            src={getYouTubeEmbedUrl(videoUrl)}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={data.poster}
            controls
            playsInline
            className="w-full h-full object-contain max-h-[85vh]"
          />
        )}
      </div>
    </div>
  );
}
export default VideoRenderer;
