import React, { useState } from 'react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { FileItem } from './Page1FilesMenuView';
import { ImageIcon } from 'lucide-react';

interface ImageCardPreviewProps {
  img: FileItem;
  className?: string;
  alt?: string;
}

export const ImageCardPreview: React.FC<ImageCardPreviewProps> = ({ img, className, alt }) => {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Pour les images : l'image enregistrée sur le serveur Cloudflare R2 est directement son propre aperçu.
  // Aucun stockage local, aucun blob navigateur temporaire, aucun fichier de miniature intermédiaire.
  const imageUrl = CloudStorageAPI.getImageDirectUrl(img);

  const imgClasses = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  if (hasError || !imageUrl) {
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
      src={imageUrl}
      alt={alt || img.name}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setHasError(true)}
      className={`${imgClasses} ${loaded ? 'opacity-100' : 'opacity-80'} transition-opacity duration-200`}
    />
  );
};

