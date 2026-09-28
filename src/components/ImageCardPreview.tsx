import React, { useState, useEffect, useMemo } from 'react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { FileItem } from './Page1FilesMenuView';
import { ImageIcon } from 'lucide-react';

interface ImageCardPreviewProps {
  img: FileItem;
  className?: string;
  alt?: string;
}

export const ImageCardPreview: React.FC<ImageCardPreviewProps> = ({ img, className, alt }) => {
  const candidateUrls = useMemo(() => {
    return CloudStorageAPI.getImageCandidateUrls(img);
  }, [img.id, (img as any).r2Key, (img as any).r2_key, img.url, img.previewUrl]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setHasError(false);
    setLoaded(false);
  }, [img.id, (img as any).r2Key, (img as any).r2_key]);

  const currentUrl = candidateUrls[currentIndex] || '';

  const handleImageError = () => {
    // Si l'URL actuelle échoue (ex: 404 sur un bucket), tenter l'URL candidate suivante
    if (currentIndex + 1 < candidateUrls.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const imgClasses = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  if (hasError || !currentUrl) {
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
      src={currentUrl}
      alt={alt || img.name}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={handleImageError}
      className={`${imgClasses} ${loaded ? 'opacity-100' : 'opacity-80'} transition-opacity duration-200`}
    />
  );
};


