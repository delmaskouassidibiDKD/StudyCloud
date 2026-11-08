import React, { useState, useEffect, useRef } from 'react';
import { FileItem } from './Page1FilesMenuView';
import { getWorkerApiUrl } from '../services/api';
import { Image as ImageIcon } from 'lucide-react';

interface ImageCardPreviewProps {
  img: FileItem;
  className?: string;
  alt?: string;
}

export const ImageCardPreview: React.FC<ImageCardPreviewProps> = ({ img, className, alt }) => {
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const triedUrlsRef = useRef<Set<string>>(new Set());

  const getCleanR2Url = () => {
    if (!img.r2Key) return '';
    let cleanKey = String(img.r2Key).trim();
    try {
      while (cleanKey.includes('%')) {
        const next = decodeURIComponent(cleanKey);
        if (next === cleanKey) break;
        cleanKey = next;
      }
    } catch { }
    const cat = img.sourceCategory || img.originalCategory || img.category || 'images';
    return `${baseUrl}/api/cloud/file/${cat}/${encodeURIComponent(cleanKey)}`;
  };

  const computeInitialSrc = () => {
    const directUrl = (img.previewUrl || img.url || '').trim();
    if (directUrl && directUrl.startsWith('data:')) return directUrl;
    if (
      directUrl &&
      directUrl.startsWith('http') &&
      !directUrl.includes('localhost') &&
      !directUrl.startsWith('blob:')
    ) {
      return directUrl.replace(/%252F/gi, '%2F');
    }
    const r2Url = getCleanR2Url();
    if (r2Url) {
      return r2Url;
    }
    if (img.id) {
      return `${baseUrl}/api/cloud/stream/${encodeURIComponent(img.id)}`;
    }
    if (directUrl && directUrl.startsWith('blob:')) {
      return directUrl;
    }
    return '';
  };

  const [src, setSrc] = useState<string>(computeInitialSrc);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    triedUrlsRef.current.clear();
    const nextSrc = computeInitialSrc();
    if (nextSrc) triedUrlsRef.current.add(nextSrc);
    setSrc(nextSrc);
    setHasFailed(false);
  }, [img.id, img.r2Key, img.previewUrl, img.url]);

  const handleError = () => {
    const r2KeyVal = img.r2Key ? String(img.r2Key).trim() : '';
    const candidates = [
      getCleanR2Url(),
      img.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(img.id)}` : '',
      img.id ? `${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(img.id)}` : '',
      r2KeyVal ? `${baseUrl}/api/cloud/file/classeur/${encodeURIComponent(r2KeyVal)}` : '',
      r2KeyVal ? `${baseUrl}/api/cloud/file/images/${encodeURIComponent(r2KeyVal)}` : '',
      r2KeyVal ? `${baseUrl}/api/cloud/file/trash/${encodeURIComponent(r2KeyVal)}` : '',
      r2KeyVal ? `${baseUrl}/api/cloud/file/secure/${encodeURIComponent(r2KeyVal)}` : '',
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (!triedUrlsRef.current.has(candidate) && candidate !== src) {
        triedUrlsRef.current.add(candidate);
        setSrc(candidate);
        return;
      }
    }

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
