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
  const directUrl = img.previewUrl || img.url || (img.thumbnailUrl && !img.thumbnailUrl.includes('/api/cloud/thumbnail/') ? img.thumbnailUrl : '');
  const [src, setSrc] = useState<string | null>(() => {
    if (directUrl && (directUrl.startsWith('data:image') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
      return directUrl;
    }
    return getCachedMediaThumbnail(img.id || img.url || '');
  });

  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    // 1. Déjà une URL valide directe
    const candidateUrl = img.previewUrl || img.url || (img.thumbnailUrl && !img.thumbnailUrl.includes('/api/cloud/thumbnail/') ? img.thumbnailUrl : '');
    if (candidateUrl && (candidateUrl.startsWith('data:image') || candidateUrl.startsWith('blob:') || candidateUrl.startsWith('http'))) {
      setSrc(candidateUrl);
      return;
    }

    async function resolveSource() {
      // 2. Recherche en cache IndexedDB local (0ms sans réseau)
      if (img.id) {
        try {
          const blob = await getFileBlob(img.id);
          if (blob && isMounted) {
            const blobUrl = URL.createObjectURL(blob);
            setSrc(blobUrl);
            setCachedMediaThumbnail(img.id, blobUrl);
            return;
          }

          const idbThumb = await getThumbnailData(img.id);
          if (idbThumb && isMounted) {
            setSrc(idbThumb);
            setCachedMediaThumbnail(img.id, idbThumb);
            return;
          }
        } catch {}
      }

      // 3. URL de streaming direct R2 pour l'image (l'image est son propre aperçu)
      if (isMounted) {
        const fileUrl = (img as any).r2_key 
          ? CloudStorageAPI.getFileUrl((img as any).r2_key) 
          : ((img as any).r2Key ? CloudStorageAPI.getFileUrl((img as any).r2Key) : (img.url || img.previewUrl));
        if (fileUrl) {
          setSrc(fileUrl);
        } else {
          setHasError(true);
        }
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
      onError={() => {
        // En cas d'erreur de chargement sur une URL distante, tenter le blob local si disponible
        if (img.id && !src.startsWith('blob:') && !src.startsWith('data:image')) {
          getFileBlob(img.id).then(blob => {
            if (blob) {
              const bUrl = URL.createObjectURL(blob);
              setSrc(bUrl);
              setHasError(false);
            } else {
              setHasError(true);
            }
          }).catch(() => setHasError(true));
        } else {
          setHasError(true);
        }
      }}
      className={`${imgClasses} ${loaded ? 'opacity-100' : 'opacity-80'} transition-opacity duration-200`}
    />
  );
};
