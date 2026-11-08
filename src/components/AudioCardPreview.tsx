import React, { useState, useEffect, useMemo } from 'react';
import {
  generateAudioCreatorCover,
  isRealEmbeddedArtwork,
  getCachedMediaThumbnail
} from '../services/mediaPreviewService';
import { getWorkerApiUrl } from '../services/api';
import { FileItem } from './Page1FilesMenuView';

interface AudioCardPreviewProps {
  track: FileItem;
  className?: string;
}

export const AudioCardPreview: React.FC<AudioCardPreviewProps> = ({ track, className }) => {
  const candidates = useMemo(() => {
    const list: string[] = [];
    const add = (u?: string | null) => {
      if (u && isRealEmbeddedArtwork(u, track) && !list.includes(u)) {
        list.push(u);
      }
    };

    add(track.coverUrl);
    add(track.thumbnailUrl);
    add(track.previewUrl);
    add((track as any).metadata?.coverUrl);
    add((track as any).metadata?.thumbnailUrl);

    if (track.id) {
      const cached = getCachedMediaThumbnail(track.id);
      add(cached);

      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const serverThumb = `${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(track.id)}`;
      if (!list.includes(serverThumb)) {
        list.push(serverThumb);
      }
    }
    return list;
  }, [track.id, track.coverUrl, track.thumbnailUrl, track.previewUrl, (track as any).metadata]);

  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates]);

  const currentCover = candidateIndex < candidates.length ? candidates[candidateIndex] : null;
  const imgClass = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";
  const fallbackSvg = generateAudioCreatorCover(track.name, track.artist || track.source);

  if (currentCover) {
    return (
      <img
        src={currentCover}
        alt={track.name}
        className={imgClass}
        loading="lazy"
        onError={() => {
          setCandidateIndex(prev => prev + 1);
        }}
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
