import React, { useState, useEffect } from 'react';
import { Film } from 'lucide-react';
import { generateVideoThumbnail, getCachedMediaThumbnail } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';

interface VideoCardPreviewProps {
  vid: FileItem;
}

export const VideoCardPreview: React.FC<VideoCardPreviewProps> = ({ vid }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    if (vid.thumbnailUrl && (vid.thumbnailUrl.startsWith('data:image') || vid.thumbnailUrl.startsWith('http') || vid.thumbnailUrl.startsWith('/'))) {
      return vid.thumbnailUrl;
    }
    if (vid.previewUrl && (vid.previewUrl.startsWith('data:image') || vid.previewUrl.startsWith('http') || vid.previewUrl.startsWith('/'))) {
      return vid.previewUrl;
    }
    return getCachedMediaThumbnail(vid.id || vid.videoUrl || vid.url || '');
  });

  const [hasError, setHasError] = useState(false);
  const targetVideoUrl = vid.videoUrl || vid.url || '';

  useEffect(() => {
    let isMounted = true;
    if (thumbUrl || !targetVideoUrl) return;

    generateVideoThumbnail(targetVideoUrl, vid.id || targetVideoUrl).then(url => {
      if (isMounted && url) {
        setThumbUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [vid.id, targetVideoUrl, thumbUrl]);

  if (thumbUrl && !hasError) {
    return (
      <img
        src={thumbUrl}
        alt={vid.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    );
  }

  if (targetVideoUrl) {
    return (
      <video
        src={`${targetVideoUrl}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-purple-400">
      <Film className="w-8 h-8 opacity-40 stroke-[1.5]" />
      <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">{vid.extension || 'MP4'}</span>
    </div>
  );
};
