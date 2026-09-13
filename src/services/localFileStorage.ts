/**
 * Service de stockage binaire local (IndexedDB) pour StudyCloud
 * Permet de manipuler des fichiers jusqu'à 50 Mo et plus sans saturer
 * la limite de 5 Mo du localStorage du navigateur.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const DB_NAME = 'StudyCloudFilesDB';
const DB_VERSION = 1;
const STORE_NAME = 'fileBlobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non supporté par ce navigateur'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Stocke un Blob ou File complet dans IndexedDB
 */
export async function storeFileBlob(id: string, blob: Blob | File): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, blob, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur sauvegarde binaire IndexedDB:', err);
  }
}

/**
 * Récupère le Blob d'un fichier par son ID
 */
export async function getFileBlob(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur lecture binaire IndexedDB:', err);
    return null;
  }
}

/**
 * Récupère une URL objet (`blob:...`) utilisable par iframe / img / video / audio
 */
export async function getFileBlobUrl(id: string): Promise<string | null> {
  const blob = await getFileBlob(id);
  if (!blob) return null;
  try {
    return URL.createObjectURL(blob);
  } catch (e) {
    return null;
  }
}

/**
 * Supprime un Blob d'un fichier dans IndexedDB
 */
export async function deleteFileBlob(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur suppression binaire IndexedDB:', err);
  }
}

/**
 * Supprime tous les Blobs enregistrés
 */
export async function clearAllFileBlobs(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur vidage binaire IndexedDB:', err);
  }
}
