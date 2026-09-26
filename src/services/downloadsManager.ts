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
  videoUrl?: string;
  audioUrl?: string;
  isImage?: boolean;
  documentCategory?: 'COURS' | 'TD' | 'DEVOIRS' | "PAS D'INF...";
  isFavorite?: boolean;
  isPinned?: boolean;
}

const STORAGE_KEY = 'studycloud_downloaded_files';

// Aucun élément téléchargé par défaut (uniquement des données réelles)
const DEFAULT_DOWNLOADED_ITEMS: DownloadedItem[] = [];

export function getDownloadedFiles(): DownloadedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Nettoyer les faux fichiers de démonstration et fichiers locaux résiduels
      const clean = parsed.filter(item => {
        if (!item || !item.name) return false;
        const isLegacyMockId = ['dl-1', 'dl-2', 'dl-3', 'dl-4', 'dl-5', 'dl-6'].includes(item?.id);
        const isMockName = [
          'CHI_AOP_LINEAIRE_MONT_BASE (1).pdf',
          'CHI_AOP_LINEAIRE_MONT_BASE (1) (1).pdf',
          'CHI_AOP_LINEAIRE_MONT_BASE.pdf',
          'CHI_AOP_LINEAIRE_APPLICATIONS.pdf',
          'Himra _ Ciel paroles.m4a',
          'Projet_Algorithmique_V2.zip',
          'Capture_ecran_Dashboard.png',
          'Tutoriel_Physique_Ondes.mp4',
          'Synthese_Cours_Semestre_1.docx',
          'TD_PREPA_ANA_2MIT.pdf',
          'Notes_Revision_Semestre_1.pdf'
        ].includes(item?.name);
        const isLocalOnly = !item.url && !item.previewUrl && !item.videoUrl && !item.audioUrl && !(item as any).r2Key;
        return !isLegacyMockId && !isMockName && !isLocalOnly;
      });
      if (clean.length !== parsed.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        } catch {}
      }
      return clean;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export function clearLegacyDownloadedFiles(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('studycloud_download_updated', { detail: null }));
  } catch (e) {}
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

/**
 * Supprime complètement un fichier téléchargé du stockage local
 */
export function removeDownloadedFile(idOrName: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDownloadedFiles();
    const updated = current.filter(f => f.id !== idOrName && f.name !== idOrName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('studycloud_download_updated', { detail: { id: idOrName, deleted: true } }));
  } catch (e) {
    console.error('[downloadsManager] Erreur suppression:', e);
  }
}

