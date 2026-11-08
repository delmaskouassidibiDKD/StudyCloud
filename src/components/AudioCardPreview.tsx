import React, { useState, useEffect } from 'react';
import {
  generateAudioCreatorCover,
  isRealEmbeddedArtwork
} from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';

interface AudioCardPreviewProps {
  track: FileItem;
  className?: string;
}

export const AudioCardPreview: React.FC<AudioCardPreviewProps> = ({ track, className }) => {
  const resolveCover = () => {
    if (isRealEmbeddedArtwork(track.coverUrl, track)) return track.coverUrl!;
    if (isRealEmbeddedArtwork(track.thumbnailUrl, track)) return track.thumbnailUrl!;
    if (isRealEmbeddedArtwork(track.previewUrl, track)) return track.previewUrl!;
    return null;
  };

  const [coverUrl, setCoverUrl] = useState<string | null>(resolveCover);
  const [hasError, setHasError] = useState(false);
  const imgClass = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  useEffect(() => {
    setCoverUrl(resolveCover());
    setHasError(false);
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
