/**
 * Service d'accès et de lecture directe au stockage de l'appareil (PWA & Natif)
 * Lit directement les fichiers réels du système de fichiers de l'appareil en temps réel
 * sans téléversement ni stockage en dur dans le code.
 */

import { formatFileSize } from './localFileStorage';

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
  liveFile?: File;
  fileHandle?: any;
}

const CACHE_METADATA_KEY = 'studycloud_live_device_files_cache';
const FOLDER_NAME_KEY = 'studycloud_live_dirname';

// Base IndexedDB pour stocker le FileSystemDirectoryHandle (permis par les standards W3C)
const HANDLES_DB_NAME = 'StudyCloudDeviceHandlesDB';
const HANDLES_DB_VERSION = 1;
const HANDLES_STORE = 'dirHandles';

function getHandlesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non supporté'));
      return;
    }
    const req = window.indexedDB.open(HANDLES_DB_NAME, HANDLES_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSavedDirectoryHandle(handle: any): Promise<void> {
  try {
    const db = await getHandlesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLES_STORE, 'readwrite');
      tx.objectStore(HANDLES_STORE).put(handle, 'activeDeviceFolder');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[DeviceStorageService] Impossible de persister le handle:', err);
  }
}

export async function getSavedDirectoryHandle(): Promise<any | null> {
  try {
    const db = await getHandlesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(HANDLES_STORE, 'readonly');
      const req = tx.objectStore(HANDLES_STORE).get('activeDeviceFolder');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearSavedDirectoryHandle(): Promise<void> {
  try {
    const db = await getHandlesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(HANDLES_STORE, 'readwrite');
      tx.objectStore(HANDLES_STORE).delete('activeDeviceFolder');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Formatage de date relative humaine basée sur l'horodatage réel du fichier sur l'appareil
 */
export function formatTimestampToRelative(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return "Aujourd'hui";
  const d = new Date(timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const today = new Date();
  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  ) {
    return `Aujourd'hui, ${timeStr}`;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return `Hier, ${timeStr}`;
  }

  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  if (d.getFullYear() === today.getFullYear()) {
    return `${d.getDate()} ${months[d.getMonth()]}, ${timeStr}`;
  }

  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Détermine la catégorie d'un fichier d'après son type MIME ou son extension
 */
export function detectFileCategory(file: { name: string; type?: string }): 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps' {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';

  // 1. Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'ico', 'tiff'].includes(ext)) {
    return 'images';
  }

  // 2. Vidéos
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', '3gp', 'flv', 'wmv', 'ts'].includes(ext)) {
    return 'videos';
  }

  // 3. Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'wma', 'amr', 'opus', 'mid'].includes(ext)) {
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
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ods', 'ppt', 'pptx', 'odp', 'epub'].includes(ext)
  ) {
    return 'documents';
  }

  // 5. Applications / Paquets
  if (['apk', 'exe', 'dmg', 'app', 'zip', 'rar', 'tar', '7z', 'gz', 'iso', 'deb'].includes(ext)) {
    return 'apps';
  }

  return 'downloads';
}

/**
 * Parcours récursif en lecture directe des fichiers du dossier autorisé
 */
export async function scanDirectoryHandle(
  dirHandle: any,
  maxFiles = 300,
  maxDepth = 3,
  currentDepth = 0,
  parentPath = ''
): Promise<StoredDeviceFile[]> {
  const results: StoredDeviceFile[] = [];

  try {
    for await (const [name, entry] of dirHandle.entries()) {
      if (results.length >= maxFiles) break;

      // Ignorer les dossiers systèmes et cachés
      if (
        name.startsWith('.') || 
        name.startsWith('$') || 
        name === 'node_modules' || 
        name === 'AppData' || 
        name === 'System Volume Information' ||
        name === 'Recovery'
      ) {
        continue;
      }

      if (entry.kind === 'file') {
        try {
          const file: File = await entry.getFile();
          const category = detectFileCategory(file);
          const isImage = category === 'images';
          let previewUrl: string | undefined = undefined;
          if (isImage) {
            try {
              previewUrl = URL.createObjectURL(file);
            } catch (e) {}
          }

          const fileItem: StoredDeviceFile = {
            id: `live-${entry.name}-${file.lastModified}-${file.size}`,
            name: file.name,
            category,
            source: dirHandle.name ? `${dirHandle.name}${parentPath ? '/' + parentPath : ''}` : 'Cet Appareil',
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            date: formatTimestampToRelative(file.lastModified),
            timestamp: file.lastModified,
            type: file.type || 'application/octet-stream',
            extension: file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() || '' : '',
            previewUrl,
            isImage,
            liveFile: file,
            fileHandle: entry
          };

          results.push(fileItem);
        } catch (e) {
          // Fichier verrouillé ou inaccessible, on continue
        }
      } else if (entry.kind === 'directory' && currentDepth < maxDepth) {
        try {
          const subFiles = await scanDirectoryHandle(
            entry,
            maxFiles - results.length,
            maxDepth,
            currentDepth + 1,
            parentPath ? `${parentPath}/${name}` : name
          );
          results.push(...subFiles);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[DeviceStorageService] Erreur parcours direct dossier:', err);
  }

  return results;
}

/**
 * Mise en cache des métadonnées pour affichage instantané
 */
export function saveCachedDeviceMetadata(files: StoredDeviceFile[], folderName: string): void {
  try {
    const serializable = files.map(f => ({
      id: f.id,
      name: f.name,
      category: f.category,
      source: f.source,
      size: f.size,
      sizeBytes: f.sizeBytes,
      date: f.date,
      timestamp: f.timestamp,
      type: f.type,
      extension: f.extension,
      isImage: f.isImage
    }));
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(serializable));
    localStorage.setItem(FOLDER_NAME_KEY, folderName);
  } catch (err) {
    console.warn('[DeviceStorageService] Erreur mise en cache métadonnées:', err);
  }
}

export function getCachedDeviceMetadata(): StoredDeviceFile[] {
  try {
    const raw = localStorage.getItem(CACHE_METADATA_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function getCachedDeviceFolderName(): string {
  return localStorage.getItem(FOLDER_NAME_KEY) || 'Stockage Appareil';
}

/**
 * Déclenche l'autorisation de lecture directe sur l'appareil
 * Utilise la File System Access API en priorité, ou le sélecteur de dossier natif
 */
export async function requestDirectDeviceFolderAccess(): Promise<{
  files: StoredDeviceFile[];
  folderName: string;
  isLiveHandle: boolean;
}> {
  // 1. Si supporté par le navigateur (Desktop, Android Chrome avec File System Access)
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
        id: 'studycloud-device-root'
      });

      if (dirHandle) {
        await saveSavedDirectoryHandle(dirHandle);
        const folderName = dirHandle.name || 'Dossier Appareil';
        localStorage.setItem(FOLDER_NAME_KEY, folderName);

        const files = await scanDirectoryHandle(dirHandle);
        // Trier par date de modification descendante (les plus récents sur l'appareil en 1er)
        files.sort((a, b) => b.timestamp - a.timestamp);

        saveCachedDeviceMetadata(files, folderName);

        return { files, folderName, isLiveHandle: true };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Sélection annulée par l\'utilisateur');
      }
      console.warn('[DeviceStorageService] showDirectoryPicker indisponible ou refusé, bascule vers le sélecteur de dossier:', err);
    }
  }

  // 2. Mécanisme universel de lecture directe de dossier (Mobile / Tous navigateurs)
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    (input as any).directory = true;
    input.multiple = true;

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const fileList = Array.from(target.files);
        const firstRelative = (fileList[0] as any).webkitRelativePath || '';
        const folderName = firstRelative ? firstRelative.split('/')[0] : 'Dossier Appareil';

        localStorage.setItem(FOLDER_NAME_KEY, folderName);

        const converted: StoredDeviceFile[] = fileList.map((file) => {
          const category = detectFileCategory(file);
          const isImage = category === 'images';
          let previewUrl: string | undefined = undefined;
          if (isImage) {
            try {
              previewUrl = URL.createObjectURL(file);
            } catch (e) {}
          }

          const relativePath = (file as any).webkitRelativePath || '';
          const parts = relativePath.split('/');
          const source = parts.length > 2 ? parts.slice(0, -1).join('/') : folderName;

          return {
            id: `live-${file.name}-${file.lastModified}-${file.size}`,
            name: file.name,
            category,
            source: source || 'Cet Appareil',
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            date: formatTimestampToRelative(file.lastModified),
            timestamp: file.lastModified,
            type: file.type || 'application/octet-stream',
            extension: file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() || '' : '',
            previewUrl,
            isImage,
            liveFile: file
          };
        });

        converted.sort((a, b) => b.timestamp - a.timestamp);
        saveCachedDeviceMetadata(converted, folderName);
        resolve({ files: converted, folderName, isLiveHandle: false });
      } else {
        reject(new Error('Aucun dossier sélectionné'));
      }
    };

    input.oncancel = () => {
      reject(new Error('Sélection annulée'));
    };

    input.click();
  });
}

/**
 * Charge automatiquement les données réelles de l'appareil en direct
 */
export async function autoLoadLiveDeviceFiles(): Promise<{
  files: StoredDeviceFile[];
  folderName: string;
  hasPermission: boolean;
}> {
  const folderName = getCachedDeviceFolderName();
  const cached = getCachedDeviceMetadata();

  // Tenter de réactiver le handle live en arrière-plan si disponible
  const dirHandle = await getSavedDirectoryHandle();
  if (dirHandle) {
    try {
      const status = await dirHandle.queryPermission({ mode: 'read' });
      if (status === 'granted') {
        const liveFiles = await scanDirectoryHandle(dirHandle);
        liveFiles.sort((a, b) => b.timestamp - a.timestamp);
        saveCachedDeviceMetadata(liveFiles, dirHandle.name || folderName);
        return { files: liveFiles, folderName: dirHandle.name || folderName, hasPermission: true };
      }
    } catch (e) {
      console.warn('[DeviceStorageService] Erreur rechargement live handle:', e);
    }
  }

  return {
    files: cached,
    folderName,
    hasPermission: cached.length > 0
  };
}

/**
 * Réactualise la lecture directe du stockage de l'appareil
 */
export async function refreshLiveDeviceFiles(): Promise<{
  files: StoredDeviceFile[];
  folderName: string;
} | null> {
  const dirHandle = await getSavedDirectoryHandle();
  if (dirHandle) {
    try {
      let status = await dirHandle.queryPermission({ mode: 'read' });
      if (status !== 'granted') {
        status = await dirHandle.requestPermission({ mode: 'read' });
      }
      if (status === 'granted') {
        const files = await scanDirectoryHandle(dirHandle);
        files.sort((a, b) => b.timestamp - a.timestamp);
        const folderName = dirHandle.name || getCachedDeviceFolderName();
        saveCachedDeviceMetadata(files, folderName);
        return { files, folderName };
      }
    } catch (e) {
      console.warn('[DeviceStorageService] Erreur rafraîchissement live:', e);
    }
  }

  // Si pas de handle, relancer la demande d'accès
  return null;
}
