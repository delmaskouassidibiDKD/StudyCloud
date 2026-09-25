// src/data/categoryFilesData.ts
// Données complètes et réelles des galeries StudyCloud (vidées de tout mock/faux élément)

export interface CategoryFileItem {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads';
  source?: string;
  size?: string;
  sizeBytes?: number;
  date?: string;
  extension?: string;
  isImage?: boolean;
  previewUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  artist?: string;
  durationSec?: number;
  lyricsSnippet?: string;
  fullLyrics?: string[];
  documentCategory?: string;
  downloadsCount?: number;
  url?: string;
  type?: string;
  folderName?: string;
  matiere?: string;
}

// Les listes par défaut sont maintenant vides : seules les vraies données R2/D1 de l'utilisateur s'affichent
export const DEFAULT_IMAGES_LIST: CategoryFileItem[] = [];
export const DEFAULT_VIDEOS_LIST: CategoryFileItem[] = [];
export const DEFAULT_AUDIO_LIST: CategoryFileItem[] = [];
export const DEFAULT_DOCUMENTS_LIST: CategoryFileItem[] = [];

export function getGalleryFilesForCategory(categoryOrMenuName: string): any[] {
  const norm = (categoryOrMenuName || '').toLowerCase().trim();

  let rawList: CategoryFileItem[] = [];
  let canonicalName = categoryOrMenuName || 'Mes fichiers';

  if (norm.includes('image') || norm === 'images') {
    rawList = DEFAULT_IMAGES_LIST;
    canonicalName = 'Images';
  } else if (norm.includes('vid') || norm === 'vidéos' || norm === 'videos') {
    rawList = DEFAULT_VIDEOS_LIST;
    canonicalName = 'Vidéos';
  } else if (norm.includes('musiq') || norm.includes('audio') || norm.includes('son')) {
    rawList = DEFAULT_AUDIO_LIST;
    canonicalName = 'Musique';
  } else if (norm.includes('doc')) {
    rawList = DEFAULT_DOCUMENTS_LIST;
    canonicalName = 'Documents';
  }

  return rawList.map(item => {
    const ext = item.extension || (item.name && item.name.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
    return {
      id: item.id,
      name: item.name,
      size: item.sizeBytes || 0,
      type: item.type || (item.isImage ? 'image/jpeg' : (item.videoUrl ? 'video/mp4' : (item.audioUrl ? 'audio/mpeg' : 'application/pdf'))),
      extension: ext,
      url: item.url || item.previewUrl || item.audioUrl || item.videoUrl || '',
      previewUrl: item.previewUrl,
      audioUrl: item.audioUrl,
      videoUrl: item.videoUrl,
      isImage: !!item.isImage,
      category: item.category,
      folderName: canonicalName,
      matiere: canonicalName,
      source: item.source || canonicalName
    };
  });
}
