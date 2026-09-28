import React, { useState, useEffect } from 'react';
import { extractAudioCover, generateAudioCreatorCover, getCachedMediaThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { CloudStorageAPI } from '../services/cloudStorageService';
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
  if (clean.includes('/api/cloud/thumbnail')) return true;
  if (clean.match(/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i)) {
    return false;
  }
  if (clean.startsWith('blob:')) {
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
  const targetAudioUrl = track.audioUrl || track.url || '';
  const imgClass = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  // Synchronisation dynamique si l'objet track change
  useEffect(() => {
    setHasError(false);
    if (isImageCover(track.coverUrl)) {
      setCoverUrl(track.coverUrl!);
      return;
    }
    if (isImageCover(track.thumbnailUrl)) {
      setCoverUrl(track.thumbnailUrl!);
      return;
    }
    if (isImageCover(track.previewUrl)) {
      setCoverUrl(track.previewUrl!);
      return;
    }
    const cached = getCachedMediaThumbnail(track.id || track.audioUrl || track.url || '');
    if (isImageCover(cached || undefined)) {
      setCoverUrl(cached);
      return;
    }
    if (track.id && !track.id.startsWith('blob:')) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      setCoverUrl(`${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(track.id)}`);
      return;
    }
    setCoverUrl(null);
  }, [track.id, track.coverUrl, track.thumbnailUrl, track.previewUrl]);

  useEffect(() => {
    let isMounted = true;
    // Si on a déjà une vraie image en base64 / blob / lien vérifié, pas besoin de réextraire
    if (coverUrl && isImageCover(coverUrl) && !coverUrl.includes('/api/cloud/thumbnail')) return;

    async function loadCover() {
      // 1. Tenter d'extraire la pochette ID3 directement du blob IndexedDB local
      if (track.id) {
        try {
          const blob = await getFileBlob(track.id);
          if (blob && isMounted) {
            const url = await extractAudioCover(blob, track.name, track.artist || track.source);
            if (isMounted && url && isImageCover(url) && !url.includes('/api/cloud/thumbnail')) {
              setCoverUrl(url);
              setCachedMediaThumbnail(track.id, url);
              if (track.id && !track.id.startsWith('blob:')) {
                CloudStorageAPI.saveMediaThumbnail(track.id, 'audio', url, track.name).catch(() => {});
              }
              return;
            }
          }
        } catch {}
      }

      // 2. Tenter avec l'URL audio distante
      const sourceToExtract = targetAudioUrl || (track as any).blobUrl;
      if (sourceToExtract) {
        try {
          const url = await extractAudioCover(sourceToExtract, track.name, track.artist || track.source);
          if (isMounted && url && isImageCover(url) && !url.includes('/api/cloud/thumbnail')) {
            setCoverUrl(url);
            setCachedMediaThumbnail(track.id || sourceToExtract, url);
            if (track.id && !track.id.startsWith('blob:')) {
              CloudStorageAPI.saveMediaThumbnail(track.id, 'audio', url, track.name).catch(() => {});
            }
            return;
          }
        } catch {}
      }

      // 3. Fallback officiel pochette vinyle haute fidélité
      if (isMounted && !coverUrl) {
        const fallback = generateAudioCreatorCover(track.name, track.artist || track.source);
        setCoverUrl(fallback);
      }
    }

    loadCover();

    return () => {
      isMounted = false;
    };
  }, [track.id, targetAudioUrl, coverUrl, track.name, track.artist, track.source]);

  if (coverUrl && !hasError) {
    return (
      <img
        src={coverUrl}
        alt={track.name}
        className={imgClass}
        loading="lazy"
        onError={async () => {
          if (track.id) {
            try {
              const blob = await getFileBlob(track.id);
              if (blob) {
                const localCover = await extractAudioCover(blob, track.name, track.artist || track.source);
                if (localCover && isImageCover(localCover) && !localCover.includes('/api/cloud/thumbnail')) {
                  setCoverUrl(localCover);
                  setCachedMediaThumbnail(track.id, localCover);
                  setHasError(false);
                  return;
                }
              }
            } catch {}
          }
          setHasError(true);
        }}
      />
    );
  }

  const fallbackSvg = generateAudioCreatorCover(track.name, track.artist || track.source);
  return (
    <img
      src={fallbackSvg}
      alt={track.name}
      className={imgClass}
      loading="lazy"
    />
  );
};
