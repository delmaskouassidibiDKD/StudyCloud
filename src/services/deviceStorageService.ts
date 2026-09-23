/**
 * Service d'accès et d'abstraction au stockage de l'appareil (PWA & Natif)
 * Gère la sélection réelle de fichiers (galerie, documents, audio, vidéo),
 * la détection de type, la persistance dans IndexedDB et le tri par catégorie.
 */

import { storeFileBlob, getFileBlob, getFileBlobUrl, deleteFileBlob, formatFileSize } from './localFileStorage';

export interface StoredDeviceFile {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps';
  source: string;
  size: string;
  sizeBytes: number;
  date: string;
  timestamp: number;
  type: string;
  extension: string;
  previewUrl?: string;
  isImage?: boolean;
}

const STORAGE_KEY = 'studycloud_device_files';

/**
 * Détermine la catégorie d'un fichier d'après son type MIME ou son extension
 */
export function detectFileCategory(file: { name: string; type?: string }): 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps' {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';

  // 1. Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'ico'].includes(ext)) {
    return 'images';
  }

  // 2. Vidéos
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', '3gp', 'flv', 'wmv'].includes(ext)) {
    return 'videos';
  }

  // 3. Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'wma', 'amr', 'opus'].includes(ext)) {
    return 'audio';
  }

  // 4. Documents
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    mime.includes('text') ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ods', 'ppt', 'pptx', 'odp'].includes(ext)
  ) {
    return 'documents';
  }

  // 5. Applications / Archives
  if (['apk', 'exe', 'dmg', 'app', 'zip', 'rar', 'tar', '7z', 'gz', 'iso'].includes(ext)) {
    return 'apps';
  }

  return 'downloads';
}

/**
 * Récupère tous les fichiers réels enregistrés sur l'appareil
 */
export async function getStoredDeviceFiles(): Promise<StoredDeviceFile[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: StoredDeviceFile[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    // Vérifier et régénérer les URL d'aperçu d'images depuis IndexedDB si besoin
    const updated = await Promise.all(
      list.map(async (f) => {
        if (f.isImage && (!f.previewUrl || f.previewUrl.startsWith('blob:null'))) {
          const blobUrl = await getFileBlobUrl(f.id);
          if (blobUrl) {
            return { ...f, previewUrl: blobUrl };
          }
        }
        return f;
      })
    );

    return updated.sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.warn('[DeviceStorageService] Erreur lecture fichiers locaux:', e);
    return [];
  }
}

/**
 * Enregistre une liste de vrais fichiers de l'appareil (IndexedDB + Métadonnées)
 */
export async function saveDeviceFiles(files: File[], forcedCategory?: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps'): Promise<StoredDeviceFile[]> {
  if (!files || files.length === 0) return [];

  const existing = await getStoredDeviceFiles();
  const newItems: StoredDeviceFile[] = [];
  const now = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = `dev-file-${now}-${i}-${Math.random().toString(36).substring(2, 7)}`;
    const category = forcedCategory || detectFileCategory(file);
    const isImage = category === 'images';

    // 1. Sauvegarder le binaire dans IndexedDB
    await storeFileBlob(id, file);

    // 2. Créer une URL d'aperçu immédiate pour les images
    let previewUrl: string | undefined = undefined;
    if (isImage) {
      try {
        previewUrl = URL.createObjectURL(file);
      } catch (e) {}
    }

    // Déterminer le libellé de date
    const dateFormatted = "Aujourd'hui, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Nom de source lisible
    let source = 'Cet Appareil';
    if (category === 'images') source = 'Galerie Photos';
    else if (category === 'audio') source = 'Enregistreur / Audio';
    else if (category === 'videos') source = 'Vidéos de l\'appareil';
    else if (category === 'downloads') source = 'Téléchargements';
    else if (category === 'documents') source = 'Documents';
    else if (category === 'apps') source = 'Applications';

    const item: StoredDeviceFile = {
      id,
      name: file.name,
      category,
      source,
      size: formatFileSize(file.size),
      sizeBytes: file.size,
      date: dateFormatted,
      timestamp: now + i,
      type: file.type || 'application/octet-stream',
      extension: file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() || '' : '',
      previewUrl,
      isImage
    };

    newItems.push(item);
  }

  // Fusionner (les plus récents en premier)
  const combined = [...newItems, ...existing];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
  } catch (err) {
    console.warn('[DeviceStorageService] Erreur sauvegarde métadonnées:', err);
  }

  return combined;
}

/**
 * Supprime un fichier de l'appareil (IndexedDB + Métadonnées)
 */
export async function deleteStoredDeviceFile(id: string): Promise<StoredDeviceFile[]> {
  try {
    await deleteFileBlob(id);
    const existing = await getStoredDeviceFiles();
    const filtered = existing.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.warn('[DeviceStorageService] Erreur suppression fichier:', err);
    return [];
  }
}

/**
 * Boîte de dialogue du navigateur pour choisir de vrais fichiers de l'appareil
 */
export function promptDeviceFilePicker(options?: {
  accept?: string;
  multiple?: boolean;
  category?: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps';
}): Promise<File[]> {
  return new Promise((resolve) => {
    // Si la File System Access API est supportée sur Desktop/Android Chrome
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window && !options?.category) {
      // Option standard via input HTML5 universellement compatible
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple !== false; // true par défaut

    if (options?.accept) {
      input.accept = options.accept;
    } else if (options?.category) {
      switch (options.category) {
        case 'images':
          input.accept = 'image/*';
          break;
        case 'videos':
          input.accept = 'video/*';
          break;
        case 'audio':
          input.accept = 'audio/*';
          break;
        case 'documents':
          input.accept = '.pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.ppt,.pptx';
          break;
        case 'apps':
          input.accept = '.apk,.zip,.rar,.7z,.exe';
          break;
        default:
          input.accept = '*/*';
      }
    }

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        resolve(Array.from(target.files));
      } else {
        resolve([]);
      }
    };

    // Déclencher le sélecteur natif du système
    input.click();
  });
}
