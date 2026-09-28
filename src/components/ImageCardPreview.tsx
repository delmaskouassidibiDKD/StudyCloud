import React from 'react';
import { FileItem } from './Page1FilesMenuView';
import { getWorkerApiUrl } from '../services/api';

interface ImageCardPreviewProps {
  img: FileItem;
  className?: string;
  alt?: string;
}

export const ImageCardPreview: React.FC<ImageCardPreviewProps> = ({ img, className, alt }) => {
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const src = `${baseUrl}/api/cloud/stream/${encodeURIComponent(img.id)}`;

  return (
    <img
      src={src}
      alt={alt || img.name}
      loading="lazy"
      className={className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"}
    />
  );
};


