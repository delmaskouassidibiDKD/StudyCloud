import React, { useState, useEffect, useRef } from 'react';
import {
  generateAudioCreatorCover,
  getCachedMediaThumbnail,
  setCachedMediaThumbnail,
  isRealEmbeddedArtwork
} from '../services/mediaPreviewService';
import { getFileBlob, storeThumbnailData } from '../services/localFileStorage';
import { FileItem } from './Page1FilesMenuView';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';


interface AudioCardPreviewProps {
  track: FileItem;
  className?: string;
}

export const AudioCardPreview: React.FC<AudioCardPreviewProps> = ({ track, className }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(() => {
    if (isRealEmbeddedArtwork(track.coverUrl, track)) return track.coverUrl!;
    if (isRealEmbeddedArtwork(track.thumbnailUrl, track)) return track.thumbnailUrl!;
    if (isRealEmbeddedArtwork(track.previewUrl, track)) return track.previewUrl!;
    const cached = getCachedMediaThumbnail(track.id || track.audioUrl || track.url || '');
    if (isRealEmbeddedArtwork(cached, track)) return cached;
    return null;
  });

  const [hasError, setHasError] = useState(false);
  const attemptedRef = useRef<string | null>(null);
  const imgClass = className || "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none";

  // Charger la miniature locale ou en cache avec extraction ID3 directe depuis IndexedDB
  useEffect(() => {
    if (!track.id || attemptedRef.current === track.id) return;

    // Si on a déjà une vraie pochette d'artiste (image JPEG/PNG), rien à recharger
    if (coverUrl && isRealEmbeddedArtwork(coverUrl, track)) {
      return;
    }

    const cached = getCachedMediaThumbnail(track.id);
    if (cached && isRealEmbeddedArtwork(cached, track)) {
      setCoverUrl(cached);
      setHasError(false);
      return;
    }

    attemptedRef.current = track.id;
    let isMounted = true;

    // Tenter d'extraire la véritable pochette d'album depuis le binaire stocké dans IndexedDB
    getFileBlob(track.id).then((blob) => {
      if (!isMounted || !blob) return;

      import('../services/mediaPreviewService').then(({ extractAudioMetadataWithTags }) => {
        extractAudioMetadataWithTags(blob).then((meta) => {
          if (!isMounted) return;
          if (meta.coverUrl && isRealEmbeddedArtwork(meta.coverUrl, track)) {
            setCoverUrl(meta.coverUrl);
            setHasError(false);
            setCachedMediaThumbnail(track.id, meta.coverUrl);
            if (track.audioUrl) setCachedMediaThumbnail(track.audioUrl, meta.coverUrl);
            if (track.url) setCachedMediaThumbnail(track.url, meta.coverUrl);

            storeThumbnailData(track.id, meta.coverUrl).catch(() => {});
            CloudStorageAPI.saveMediaThumbnail(track.id, 'audio', meta.coverUrl, meta.title || track.name).catch(() => {});
            CloudDataStore.updateFile(track.id, {
              coverUrl: meta.coverUrl,
              thumbnailUrl: meta.coverUrl,
              previewUrl: meta.coverUrl,
              artist: meta.artist || track.artist,
            });
          }
        }).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [track.id, track.coverUrl, track.thumbnailUrl, track.previewUrl, coverUrl]);

  const fallbackSvg = generateAudioCreatorCover(track.name, track.artist || track.source);

  if (coverUrl && !hasError) {
    return (
      <img
        src={coverUrl}
        alt={track.name}
        className={imgClass}
        loading="lazy"
        onError={() => {
          setHasError(true);
          // Si l'URL a échoué (ex: 404), tenter l'extraction directe depuis IndexedDB
          if (track.id) {
            getFileBlob(track.id).then((blob) => {
              if (blob) {
                import('../services/mediaPreviewService').then(({ extractAudioMetadataWithTags }) => {
                  extractAudioMetadataWithTags(blob).then((meta) => {
                    if (meta.coverUrl && isRealEmbeddedArtwork(meta.coverUrl, track)) {
                      setCoverUrl(meta.coverUrl);
                      setHasError(false);
                      setCachedMediaThumbnail(track.id, meta.coverUrl);
                    }
                  }).catch(() => {});
                }).catch(() => {});
              }
            }).catch(() => {});
          }
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
