import React, { useState, useEffect } from 'react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlob, getThumbnailData } from '../services/localFileStorage';
import { getCachedMediaThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { ImageIcon } from 'lucide-react';

interface ImageCardPreviewProps {
  img: FileItem;
  className?: string;
  alt?: string;
}

export const ImageCardPreview: React.FC<ImageCardPreviewProps> = ({ img, className, alt }) => {
  const [src, setSrc] = useState<string | null>(() => {
    if (img.previewUrl && (img.previewUrl.startsWith('data:image') || img.previewUrl.startsWith('blob:'))) {
      return img.previewUrl;
    }
    if (img.thumbnailUrl && (img.thumbnailUrl.startsWith('data:image') || img.thumbnailUrl.startsWith('blob:'))) {
      return img.thumbnailUrl;
    }
    if (img.url && (img.url.startsWith('data:image') || img.url.startsWith('blob:'))) {
      return img.url;
    }
    return getCachedMediaThumbnail(img.id || img.url || '');
  });

  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    // 1. Déjà une URL valide
    if (img.previewUrl && (img.previewUrl.startsWith('data:image') || img.previewUrl.startsWith('blob:') || img.previewUrl.startsWith('http'))) {
      setSrc(img.previewUrl);
      return;
    }
    if (img.url && (img.url.startsWith('data:image') || img.url.startsWith('blob:') || img.url.startsWith('http'))) {
      setSrc(img.url);
      return;
    }

    async function resolveSource() {
      // 2. Recherche en cache IndexedDB local (0ms sans réseau)
      if (img.id) {
        try {
          const idbThumb = await getThumbnailData(img.id);
          if (idbThumb && isMounted) {
            setSrc(idbThumb);
            setCachedMediaThumbnail(img.id, idbThumb);
            return;
          }

          const blob = await getFileBlob(img.id);
          if (blob && isMounted) {
            const blobUrl = URL.createObjectURL(blob);
            setSrc(blobUrl);
            setCachedMediaThumbnail(img.id, blobUrl);
            return;
          }
        } catch {}
      }

      // 3. Endpoint miniature serveur R2/D1 (/api/cloud/thumbnail/:fileId)
      if (img.id && !img.id.startsWith('blob:') && !img.id.startsWith('img-')) {
        const serverThumbUrl = CloudStorageAPI.getThumbnailUrl(img.id);
        const testImg = new Image();
        testImg.onload = () => {
          if (isMounted) {
            setSrc(serverThumbUrl);
            setCachedMediaThumbnail(img.id, serverThumbUrl);
          }
        };
        testImg.onerror = () => {
          // 4. URL de streaming direct R2
          if (isMounted) {
            const fileUrl = (img as any).r2_key ? CloudStorageAPI.getFileUrl((img as any).r2_key) : CloudStorageAPI.getFileUrl(img.id);
            setSrc(fileUrl);
          }
        };
        testImg.src = serverThumbUrl;
        return;
      }

      // 5. Fallback URL
      if (isMounted) {
        setSrc(img.url || img.previewUrl || null);
      }
    }

    resolveSource();

    return () => {
      isMounted = false;
    };
  }, [img.id, img.previewUrl, img.url, img.thumbnailUrl]);

  const imgClasses = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  if (hasError || !src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 p-2 select-none">
        <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400/40 mb-1" />
        <span className="text-[9px] sm:text-[10px] text-center font-bold text-slate-400 line-clamp-1 px-1">
          {img.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || img.name}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setHasError(true)}
      className={`${imgClasses} ${loaded ? 'opacity-100' : 'opacity-80'} transition-opacity duration-200`}
    />
  );
};
