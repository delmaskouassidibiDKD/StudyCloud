import React, { useState, useEffect, useRef } from 'react';
import { FileItem } from './Page1FilesMenuView';
import { getWorkerApiUrl } from '../services/api';
import { getFileBlobUrl, getThumbnailData } from '../services/localFileStorage';
import { Image as ImageIcon } from 'lucide-react';

interface ImageCardPreviewProps {
  img: FileItem;
  className?: string;
  alt?: string;
}

export const ImageCardPreview: React.FC<ImageCardPreviewProps> = ({ img, className, alt }) => {
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const [src, setSrc] = useState<string>(() => {
    const directUrl = img.previewUrl || img.url;
    if (directUrl && directUrl.startsWith('data:')) return directUrl;
    if (directUrl && directUrl.startsWith('http') && !directUrl.includes('localhost') && !directUrl.startsWith('blob:')) {
      return directUrl;
    }
    if (img.r2Key) {
      return `${baseUrl}/api/cloud/file/images/${encodeURIComponent(img.r2Key)}`;
    }
    if (directUrl && directUrl.startsWith('blob:')) {
      return directUrl;
    }
    return img.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(img.id)}` : '';
  });

  const [hasFailed, setHasFailed] = useState(false);
  const attemptIndexRef = useRef(0);

  // Synchronisation et tentative de résolution depuis IndexedDB pour les blobs
  useEffect(() => {
    let isMounted = true;
    const directUrl = img.previewUrl || img.url;

    // Si on a un blob URL (susceptible d'être expiré) ou pas d'URL, récupérer le vrai blob depuis IndexedDB
    if (!directUrl || directUrl.startsWith('blob:') || !src) {
      getFileBlobUrl(img.id).then((freshBlob) => {
        if (isMounted && freshBlob) {
          setSrc(freshBlob);
          setHasFailed(false);
        }
      }).catch(() => {});

      getThumbnailData(img.id).then((thumb) => {
        if (isMounted && thumb && (!src || src.startsWith('blob:'))) {
          setSrc(thumb);
          setHasFailed(false);
        }
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [img.id, img.previewUrl, img.url]);

  const handleError = async () => {
    const attempt = attemptIndexRef.current;
    attemptIndexRef.current += 1;

    try {
      // Étape 1 : Récupérer depuis IndexedDB
      if (attempt === 0 && img.id) {
        const freshBlob = await getFileBlobUrl(img.id);
        if (freshBlob && freshBlob !== src) {
          setSrc(freshBlob);
          return;
        }
      }

      // Étape 2 : Récupérer miniature sauvegardée
      if (attempt <= 1 && img.id) {
        const thumb = await getThumbnailData(img.id);
        if (thumb && thumb !== src) {
          setSrc(thumb);
          return;
        }
      }

      // Étape 3 : Tenter l'URL R2 Cloudflare
      if (attempt <= 2 && img.r2Key) {
        const r2Url = `${baseUrl}/api/cloud/file/images/${encodeURIComponent(img.r2Key)}`;
        if (r2Url !== src) {
          setSrc(r2Url);
          return;
        }
      }

      // Étape 4 : Tenter le stream universel
      if (attempt <= 3 && img.id) {
        const streamUrl = `${baseUrl}/api/cloud/stream/${encodeURIComponent(img.id)}`;
        if (streamUrl !== src) {
          setSrc(streamUrl);
          return;
        }
      }
    } catch (e) {
      console.warn('[ImageCardPreview] Fallback error for', img.name, e);
    }

    // Si toutes les tentatives ont échoué, marquer comme échoué pour afficher le placeholder esthétique
    setHasFailed(true);
  };

  if (hasFailed || !src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-2 text-center select-none border border-emerald-500/20">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20 shadow-xs">
          <ImageIcon className="w-6 h-6 stroke-[1.8]" />
        </div>
        <p className="text-[10px] font-bold text-emerald-200 truncate max-w-full px-1">
          {img.name || 'Image'}
        </p>
        <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-400/80 bg-emerald-950/80 px-1.5 py-0.5 rounded mt-0.5 border border-emerald-500/20">
          {img.extension || 'IMG'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || img.name}
      loading="lazy"
      onError={handleError}
      className={className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"}
    />
  );
};
