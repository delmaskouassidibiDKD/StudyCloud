import React, { useState, useEffect, useRef } from 'react';
import { generateVideoFallbackPoster } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { getWorkerApiUrl } from '../services/api';

interface VideoCardPreviewProps {
  vid: FileItem;
  className?: string;
}

function isImageThumbnail(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    return false;
  }
  const clean = trimmed.toLowerCase().split('?')[0];
  if (clean.startsWith('data:image')) return true;
  if (clean.includes('/api/cloud/thumbnail')) return true;
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.avi') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mkv') ||
    clean.endsWith('.3gp') ||
    clean.endsWith('.m4v') ||
    clean.includes('/api/cloud/file/videos/') ||
    clean.includes('/api/cloud/file/secure/') ||
    clean.includes('/api/cloud/file/trash/') ||
    clean.includes('/api/cloud/stream/')
  ) {
    return false;
  }
  return (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif') ||
    clean.endsWith('.svg')
  );
}

export const VideoCardPreview: React.FC<VideoCardPreviewProps> = ({ vid, className }) => {
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const triedThumbsRef = useRef<Set<string>>(new Set());

  const getCleanR2Key = () => {
    const rawKey = (vid as any).r2Key || (vid as any).r2_key || (vid as any).metadata?.r2Key || '';
    if (!rawKey) return '';
    let cleanKey = String(rawKey).trim();
    try {
      while (cleanKey.includes('%')) {
        const next = decodeURIComponent(cleanKey);
        if (next === cleanKey) break;
        cleanKey = next;
      }
    } catch {}
    return cleanKey;
  };

  const getServerThumbnailUrl = () => {
    if (!vid.id) return '';
    return `${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(vid.id)}`;
  };

  const getThumbCandidates = (): string[] => {
    const metaThumb = (vid as any).metadata?.thumbnailUrl || (vid as any).metadata?.previewUrl;
    const list: string[] = [];
    if (isImageThumbnail(vid.thumbnailUrl)) list.push(vid.thumbnailUrl!.trim());
    if (isImageThumbnail(vid.previewUrl) && !list.includes(vid.previewUrl!.trim())) list.push(vid.previewUrl!.trim());
    if (isImageThumbnail(metaThumb) && !list.includes(metaThumb.trim())) list.push(metaThumb.trim());
    const serverThumb = getServerThumbnailUrl();
    if (serverThumb && !list.includes(serverThumb)) {
      list.push(serverThumb);
    }
    return list;
  };

  const resolveVideoStreamUrl = (): string => {
    const cleanKey = getCleanR2Key();
    if (cleanKey) {
      return `${baseUrl}/api/cloud/file/videos/${encodeURIComponent(cleanKey)}`;
    }
    const candidates = [vid.videoUrl, vid.url, vid.previewUrl];
    for (const c of candidates) {
      if (!c) continue;
      const trimmed = c.trim();
      if (
        (trimmed.startsWith('http') || trimmed.startsWith('blob:')) &&
        !trimmed.includes('localhost') &&
        !trimmed.includes('127.0.0.1') &&
        !trimmed.includes('/api/cloud/file/secure/') &&
        !trimmed.includes('/api/cloud/file/trash/') &&
        !trimmed.includes('/api/cloud/thumbnail')
      ) {
        return trimmed.replace(/%252F/gi, '%2F');
      }
    }
    if (vid.id) {
      return `${baseUrl}/api/cloud/stream/${encodeURIComponent(vid.id)}`;
    }
    return '';
  };

  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    const cands = getThumbCandidates();
    return cands.length > 0 ? cands[0] : null;
  });
  const [allThumbsFailed, setAllThumbsFailed] = useState(false);
  const [videoStreamFailed, setVideoStreamFailed] = useState(false);

  const imgClasses = className || 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none';

  useEffect(() => {
    triedThumbsRef.current.clear();
    const cands = getThumbCandidates();
    const first = cands.length > 0 ? cands[0] : null;
    if (first) triedThumbsRef.current.add(first);
    setThumbUrl(first);
    setAllThumbsFailed(cands.length === 0);
    setVideoStreamFailed(false);
  }, [vid.id, vid.thumbnailUrl, vid.previewUrl, (vid as any).r2Key, vid.videoUrl, vid.url]);

  const handleThumbError = () => {
    const cands = getThumbCandidates();
    for (const candidate of cands) {
      if (!triedThumbsRef.current.has(candidate) && candidate !== thumbUrl) {
        triedThumbsRef.current.add(candidate);
        setThumbUrl(candidate);
        return;
      }
    }
    setAllThumbsFailed(true);
  };

  // 1. Miniature image serveur / data:image si disponible
  if (thumbUrl && !allThumbsFailed) {
    return (
      <img
        src={thumbUrl}
        alt={vid.name}
        className={imgClasses}
        loading="lazy"
        onError={handleThumbError}
      />
    );
  }

  // 2. Aperçu vidéo direct léger depuis le flux R2/Stream (affiche la vraie frame vidéo sans stockage local)
  const videoStreamUrl = resolveVideoStreamUrl();
  if (videoStreamUrl && !videoStreamFailed) {
    const srcWithTime = videoStreamUrl.includes('#t=') ? videoStreamUrl : `${videoStreamUrl}#t=0.5`;
    return (
      <video
        src={srcWithTime}
        muted
        playsInline
        preload="metadata"
        className={imgClasses}
        onLoadedMetadata={(e) => {
          try {
            const v = e.currentTarget;
            if (v.currentTime === 0) {
              v.currentTime = Math.min(0.5, (v.duration || 1) * 0.1);
            }
          } catch {}
        }}
        onError={() => setVideoStreamFailed(true)}
      />
    );
  }

  // 3. Fallback SVG ultime si ni miniature ni flux vidéo ne sont joignables
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
