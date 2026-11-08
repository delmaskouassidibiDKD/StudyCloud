import React, { useState, useEffect } from 'react';
import { generateVideoFallbackPoster } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';

interface VideoCardPreviewProps {
  vid: FileItem;
  className?: string;
}

function isImageThumbnail(url?: string): boolean {
  if (!url) return false;
  const clean = url.toLowerCase().split('?')[0];
  if (clean.startsWith('data:image')) return true;
  if (clean.includes('/api/cloud/thumbnail')) return true;
  if (clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.avi') || clean.endsWith('.webm') || clean.endsWith('.mkv')) {
    return false;
  }
  return clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.png') || clean.endsWith('.webp') || clean.endsWith('.svg');
}

export const VideoCardPreview: React.FC<VideoCardPreviewProps> = ({ vid, className }) => {
  const resolveThumb = () => {
    if (isImageThumbnail(vid.thumbnailUrl)) return vid.thumbnailUrl!;
    if (isImageThumbnail(vid.previewUrl)) return vid.previewUrl!;
    return null;
  };

  const [thumbUrl, setThumbUrl] = useState<string | null>(resolveThumb);
  const [hasError, setHasError] = useState(false);
  const imgClasses = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  useEffect(() => {
    setHasError(false);
    setThumbUrl(resolveThumb());
  }, [vid.id, vid.thumbnailUrl, vid.previewUrl]);

  // Si on a une miniature image valide et pas d'erreur de chargement
  if (thumbUrl && !hasError) {
    return (
      <img
        src={thumbUrl}
        alt={vid.name}
        className={imgClasses}
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
      className={imgClasses}
      loading="lazy"
    />
  );
};

