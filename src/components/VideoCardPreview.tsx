import React, { useState, useEffect } from 'react';
import { generateVideoThumbnail, generateVideoFallbackPoster, getCachedMediaThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { FileItem } from './Page1FilesMenuView';

interface VideoCardPreviewProps {
  vid: FileItem;
}

function isImageThumbnail(url?: string): boolean {
  if (!url) return false;
  const clean = url.toLowerCase().split('?')[0];
  if (clean.startsWith('data:image')) return true;
  if (clean.includes('/api/cloud/thumbnail/')) return true;
  if (clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.avi') || clean.endsWith('.webm') || clean.endsWith('.mkv')) {
    return false;
  }
  return clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.png') || clean.endsWith('.webp') || clean.endsWith('.svg');
}

export const VideoCardPreview: React.FC<VideoCardPreviewProps> = ({ vid }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    if (isImageThumbnail(vid.thumbnailUrl)) {
      return vid.thumbnailUrl!;
    }
    if (isImageThumbnail(vid.previewUrl)) {
      return vid.previewUrl!;
    }
    return getCachedMediaThumbnail(vid.id || vid.videoUrl || vid.url || '');
  });

  const [hasError, setHasError] = useState(false);
  const targetVideoUrl = vid.videoUrl || vid.url || '';

  useEffect(() => {
    let isMounted = true;
    if (thumbUrl && isImageThumbnail(thumbUrl)) return;

    const sourceToExtract = targetVideoUrl || (vid as any).blobUrl || vid.id;
    if (!sourceToExtract) {
      setThumbUrl(generateVideoFallbackPoster(vid.name, vid.size));
      return;
    }

    generateVideoThumbnail(sourceToExtract, vid.id, vid.name).then(url => {
      if (isMounted && url) {
        setThumbUrl(url);
        setCachedMediaThumbnail(vid.id, url);
        // Persister la miniature dans la base de données D1 pour que tout vienne du cloud
        if (vid.id && !vid.id.startsWith('blob:')) {
          CloudStorageAPI.saveMediaThumbnail(vid.id, 'videos', url).catch(() => {});
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [vid.id, targetVideoUrl, thumbUrl, vid.name, vid.size]);

  // Si on a une miniature image valide et pas d'erreur de chargement
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

  // Fallback haute fidélité stylisé (évite le cadre noir/gris des vidéos non chargées)
  const posterSvg = generateVideoFallbackPoster(vid.name, vid.size);
  return (
    <img
      src={posterSvg}
      alt={vid.name}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
      loading="lazy"
    />
  );
};

