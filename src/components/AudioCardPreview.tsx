import React, { useState, useEffect, useRef } from 'react';
import { generateAudioCreatorCover, getCachedMediaThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { getWorkerApiUrl } from '../services/api';
import { getFileBlob } from '../services/localFileStorage';
import { FileItem } from './Page1FilesMenuView';

interface AudioCardPreviewProps {
  track: FileItem;
  className?: string;
}

function isImageCover(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.toLowerCase().split('?')[0];
  if (clean.startsWith('data:image')) return true;
  if (clean.startsWith('blob:')) return true;
  if (clean.includes('/api/cloud/thumbnail')) return true;
  if (clean.match(/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i)) {
    return false;
  }
  if (clean.match(/\.(jpg|jpeg|png|webp|svg|gif|avif|ico|bmp)$/i)) {
    return true;
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    if (clean.match(/\.(pdf|doc|docx|xls|xlsx|txt|mp4|webm|avi|mkv|mov|zip|rar)$/i)) return false;
    return true;
  }
  return false;
}

export const AudioCardPreview: React.FC<AudioCardPreviewProps> = ({ track, className }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(() => {
    if (isImageCover(track.coverUrl)) return track.coverUrl!;
    if (isImageCover(track.thumbnailUrl)) return track.thumbnailUrl!;
    if (isImageCover(track.previewUrl)) return track.previewUrl!;
    const cached = getCachedMediaThumbnail(track.id || track.audioUrl || track.url || '');
    if (isImageCover(cached || undefined)) return cached;
    if (track.id && !track.id.startsWith('blob:')) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      return `${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(track.id)}`;
    }
    return null;
  });

  const [hasError, setHasError] = useState(false);
  const attemptedRef = useRef<string | null>(null);
  const imgClass = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  // Charger la miniature locale ou en cache une seule fois par identifiant de piste
  useEffect(() => {
    if (!track.id || attemptedRef.current === track.id) return;
    attemptedRef.current = track.id;

    // Si on a déjà une image valide directe, rien à charger
    if (isImageCover(track.coverUrl) || isImageCover(track.thumbnailUrl) || isImageCover(track.previewUrl)) {
      return;
    }

    const cached = getCachedMediaThumbnail(track.id);
    if (cached && isImageCover(cached)) {
      setCoverUrl(cached);
      return;
    }

    // Tenter de lire depuis IndexedDB local uniquement (sans réseau)
    let isMounted = true;
    getFileBlob(track.id).then((blob) => {
      if (isMounted && blob) {
        import('../services/mediaPreviewService').then(({ extractAudioMetadataWithTags }) => {
          extractAudioMetadataWithTags(blob).then((meta) => {
            if (isMounted && meta.coverUrl) {
              setCoverUrl(meta.coverUrl);
              setCachedMediaThumbnail(track.id, meta.coverUrl);
            }
          }).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [track.id, track.coverUrl, track.thumbnailUrl, track.previewUrl]);

  const fallbackSvg = generateAudioCreatorCover(track.name, track.artist || track.source);

  if (coverUrl && !hasError) {
    return (
      <img
        src={coverUrl}
        alt={track.name}
        className={imgClass}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <img
      src={fallbackSvg}
      alt={track.name}
      className={imgClass}
      loading="lazy"
    />
  );
};
