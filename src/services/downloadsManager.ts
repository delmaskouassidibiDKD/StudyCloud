/**
 * Service de gestion des fichiers téléchargés pour StudyCloud
 * Enregistre et synchronise tous les types de fichiers téléchargés dans l'application
 */

export interface DownloadedItem {
  id: string;
  name: string;
  category: 'documents' | 'images' | 'videos' | 'audio' | 'downloads' | 'apps';
  size: string;
  sizeBytes?: number;
  date: string;
  timestamp: number;
  url?: string;
  extension: string;
  type?: string;
  previewUrl?: string;
}

const STORAGE_KEY = 'studycloud_downloaded_files';

// Éléments téléchargés par défaut pour garantir une expérience complète dès l'ouverture
const DEFAULT_DOWNLOADED_ITEMS: DownloadedItem[] = [
  {
    id: 'dl-1',
    name: 'CHI_AOP_LINEAIRE_MONT_BASE (1).pdf',
    category: 'documents',
    size: '647,5 Ko',
    sizeBytes: 663040,
    date: 'Aujourd\'hui, 11:20',
    timestamp: Date.now() - 3600000,
    extension: 'PDF',
    type: 'application/pdf'
  },
  {
    id: 'dl-2',
    name: 'Himra _ Ciel paroles.m4a',
    category: 'audio',
    size: '3,61 Mo',
    sizeBytes: 3785359,
    date: '19 août',
    timestamp: 1724068800000,
    extension: 'M4A',
    type: 'audio/m4a'
  },
  {
    id: 'dl-3',
    name: 'Projet_Algorithmique_V2.zip',
    category: 'downloads',
    size: '6,4 Mo',
    sizeBytes: 6710886,
    date: 'Hier, 16:45',
    timestamp: Date.now() - 86400000,
    extension: 'ZIP',
    type: 'application/zip'
  },
  {
    id: 'dl-4',
    name: 'Capture_ecran_Dashboard.png',
    category: 'images',
    size: '2,18 Mo',
    sizeBytes: 2285895,
    date: 'Hier, 14:10',
    timestamp: Date.now() - 95000000,
    extension: 'PNG',
    type: 'image/png'
  },
  {
    id: 'dl-5',
    name: 'Tutoriel_Physique_Ondes.mp4',
    category: 'videos',
    size: '7,34 Mo',
    sizeBytes: 7696547,
    date: '20 août',
    timestamp: 1724155200000,
    extension: 'MP4',
    type: 'video/mp4'
  },
  {
    id: 'dl-6',
    name: 'Synthese_Cours_Semestre_1.docx',
    category: 'documents',
    size: '1,1 Mo',
    sizeBytes: 1153433,
    date: '18 août',
    timestamp: 1723982400000,
    extension: 'DOCX',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
];

export function getDownloadedFiles(): DownloadedItem[] {
  if (typeof window === 'undefined') return DEFAULT_DOWNLOADED_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DOWNLOADED_ITEMS));
      return DEFAULT_DOWNLOADED_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_DOWNLOADED_ITEMS;
  } catch (e) {
    return DEFAULT_DOWNLOADED_ITEMS;
  }
}

export function recordDownloadedFile(item: {
  name: string;
  size?: string;
  sizeBytes?: number;
  category?: 'documents' | 'images' | 'videos' | 'audio' | 'downloads' | 'apps';
  url?: string;
  extension?: string;
  type?: string;
  previewUrl?: string;
}): DownloadedItem {
  const current = getDownloadedFiles();
  const ext = item.extension || (item.name.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
  
  let cat = item.category;
  if (!cat) {
    const lowerExt = ext.toLowerCase();
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'ppt', 'pptx', 'xls', 'xlsx'].includes(lowerExt)) {
      cat = 'documents';
    } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(lowerExt)) {
      cat = 'images';
    } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(lowerExt)) {
      cat = 'videos';
    } else if (['mp3', 'm4a', 'wav', 'ogg', 'aac'].includes(lowerExt)) {
      cat = 'audio';
    } else {
      cat = 'downloads';
    }
  }

  const now = new Date();
  const dateStr = `Aujourd'hui, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const newItem: DownloadedItem = {
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    category: cat,
    size: item.size || (item.sizeBytes ? `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} Mo` : '1.5 Mo'),
    sizeBytes: item.sizeBytes || 1500000,
    date: dateStr,
    timestamp: Date.now(),
    url: item.url,
    extension: ext,
    type: item.type,
    previewUrl: item.previewUrl
  };

  // Éviter les doublons stricts en début de liste
  const updated = [newItem, ...current.filter(f => f.name !== newItem.name)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('studycloud_download_updated', { detail: newItem }));
  } catch (e) {
    console.error('[downloadsManager] Erreur sauvegarde:', e);
  }

  return newItem;
}
