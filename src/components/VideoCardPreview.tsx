import React, { useState, useEffect } from 'react';
import { generateVideoThumbnail, generateVideoFallbackPoster, getCachedMediaThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlob } from '../services/localFileStorage';
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
  const imgClasses = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    if (isImageThumbnail(vid.thumbnailUrl)) {
      setThumbUrl(vid.thumbnailUrl!);
      return;
    }
    if (isImageThumbnail(vid.previewUrl)) {
      setThumbUrl(vid.previewUrl!);
      return;
    }

    async function loadThumb() {
      // 1. Vérifier si l'aperçu est déjà en cache IndexedDB local (0ms sans réseau)
      if (vid.id) {
        try {
          const { getThumbnailData } = await import('../services/localFileStorage');
          const idbThumb = await getThumbnailData(vid.id);
          if (idbThumb && isMounted) {
            setThumbUrl(idbThumb);
            setCachedMediaThumbnail(vid.id, idbThumb);
            return;
          }
        } catch {}
      }

      // 2. Tenter de charger depuis l'endpoint R2 du dossier utilisateur (/api/cloud/thumbnail/:fileId)
      if (vid.id && !vid.id.startsWith('blob:') && !vid.id.startsWith('vid-')) {
        const serverThumbUrl = CloudStorageAPI.getThumbnailUrl(vid.id);
        const testImg = new Image();
        testImg.onload = () => {
          if (isMounted) {
            setThumbUrl(serverThumbUrl);
            setCachedMediaThumbnail(vid.id, serverThumbUrl);
          }
        };
        testImg.onerror = () => {
          extractLocalFrame();
        };
        testImg.src = serverThumbUrl;
        return;
      }

      extractLocalFrame();

      async function extractLocalFrame() {
        // 3. Tenter d'extraire la frame directement du blob IndexedDB local
        if (vid.id) {
          try {
            const blob = await getFileBlob(vid.id);
            if (blob && isMounted) {
              const url = await generateVideoThumbnail(blob, vid.id, vid.name);
              if (isMounted && url) {
                setThumbUrl(url);
                setCachedMediaThumbnail(vid.id, url);
                if (vid.id && !vid.id.startsWith('blob:')) {
                  CloudStorageAPI.saveMediaThumbnail(vid.id, 'videos', url, vid.name).catch(() => {});
                }
                return;
              }
            }
          } catch {}
        }

        // 4. Tenter avec l'URL distante
        const sourceToExtract = targetVideoUrl || (vid as any).blobUrl;
        if (sourceToExtract) {
          try {
            const url = await generateVideoThumbnail(sourceToExtract, vid.id || sourceToExtract, vid.name);
            if (isMounted && url) {
              setThumbUrl(url);
              setCachedMediaThumbnail(vid.id || sourceToExtract, url);
              if (vid.id && !vid.id.startsWith('blob:')) {
                CloudStorageAPI.saveMediaThumbnail(vid.id, 'videos', url, vid.name).catch(() => {});
              }
              return;
            }
          } catch {}
        }

        // 5. Fallback poster SVG stylisé haute fidélité
        if (isMounted) {
          const fallback = generateVideoFallbackPoster(vid.name, vid.size);
          setThumbUrl(fallback);
        }
      }
    }

    loadThumb();

    return () => {
      isMounted = false;
    };
  }, [vid.id, vid.thumbnailUrl, vid.previewUrl, targetVideoUrl]);

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

