/**
 * Service de stockage binaire local (IndexedDB) pour StudyCloud
 * Permet de manipuler des fichiers jusqu'à 50 Mo et plus sans saturer
 * la limite de 5 Mo du localStorage du navigateur.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo

export function formatFileSize(bytes: number | string | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === '') return '0 o';
  if (typeof bytes === 'string') {
    if (/[a-zA-Z]/.test(bytes)) return bytes;
    const parsed = parseFloat(bytes);
    if (isNaN(parsed) || parsed <= 0) return '0 o';
    bytes = parsed;
  }
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return `${bytes} o`;
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
 * Décompresse automatiquement un ArrayBuffer s'il est au format GZIP (magic bytes 0x1f 0x8b)
 */
export async function ensureDecompressedArrayBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (!buffer || buffer.byteLength < 2) return buffer;
  const u8 = new Uint8Array(buffer);
  if (u8[0] === 0x1f && u8[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('gzip');
      const stream = new Blob([buffer]).stream().pipeThrough(ds);
      return await new Response(stream).arrayBuffer();
    } catch (err) {
      console.warn('[LocalFileStorage] Échec décompression GZIP ArrayBuffer:', err);
      return buffer;
    }
  }
  return buffer;
}

/**
 * Décompresse automatiquement un Blob s'il est au format GZIP (magic bytes 0x1f 0x8b)
 * et force le type MIME si demandé (ex: 'application/pdf').
 */
export async function ensureDecompressedBlob(blob: Blob, forceMimeType?: string): Promise<Blob> {
  if (!blob || blob.size < 2) {
    return forceMimeType && blob.type !== forceMimeType ? new Blob([blob], { type: forceMimeType }) : blob;
  }
  try {
    const headerBuf = await blob.slice(0, 2).arrayBuffer();
    const u8 = new Uint8Array(headerBuf);
    if (u8[0] === 0x1f && u8[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const stream = blob.stream().pipeThrough(ds);
      const decompressedBuf = await new Response(stream).arrayBuffer();
      return new Blob([decompressedBuf], { type: forceMimeType || blob.type || 'application/octet-stream' });
    }
  } catch (err) {
    console.warn('[LocalFileStorage] Échec vérification/décompression GZIP Blob:', err);
  }
  if (forceMimeType && blob.type !== forceMimeType) {
    return new Blob([blob], { type: forceMimeType });
  }
  return blob;
}

/**
 * Stocke un Blob ou File complet dans IndexedDB
 */
export async function storeFileBlob(id: string, blob: Blob | File): Promise<void> {
  try {
    const cleanBlob = await ensureDecompressedBlob(blob);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, blob: cleanBlob, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur sauvegarde binaire IndexedDB:', err);
  }
}

/**
 * Récupère le Blob d'un fichier par son ID (et le décompresse automatiquement s'il avait été stocké en GZIP)
 */
export async function getFileBlob(id: string): Promise<Blob | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    const rawBlob = await new Promise<Blob | null>((resolve, reject) => {
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

    if (!rawBlob) return null;

    if (rawBlob.size >= 2) {
      const header = new Uint8Array(await rawBlob.slice(0, 2).arrayBuffer());
      if (header[0] === 0x1f && header[1] === 0x8b) {
        const cleanBlob = await ensureDecompressedBlob(rawBlob);
        storeFileBlob(id, cleanBlob).catch(() => {});
        return cleanBlob;
      }
    }
    return rawBlob;
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur lecture binaire IndexedDB:', err);
    return null;
  }
}

/**
 * Récupère une URL objet (`blob:...`) utilisable par iframe / img / video / audio
 */
export async function getFileBlobUrl(id: string, forceMimeType?: string): Promise<string | null> {
  const blob = await getFileBlob(id);
  if (!blob) return null;
  try {
    const finalBlob = forceMimeType ? await ensureDecompressedBlob(blob, forceMimeType) : blob;
    return URL.createObjectURL(finalBlob);
  } catch (e) {
    return null;
  }
}

/**
 * Résout un fichier PDF ou Document en Blob propre (décompressé si GZIP, avec MIME type exact)
 * depuis IndexedDB, une URL blob/data/http, ou le serveur R2 (/api/cloud/stream ou /api/storage/file).
 */
export async function resolveCleanDocumentBlob(options: {
  fileId?: string;
  url?: string;
  r2Key?: string;
  baseUrl?: string;
  mimeType?: string;
}): Promise<Blob | null> {
  const { fileId, url, r2Key, mimeType } = options;
  const baseUrl = options.baseUrl ?? (import.meta.env.VITE_API_URL || '');
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const isValidDocBlob = async (b: Blob | null): Promise<Blob | null> => {
    if (!b || b.size === 0) return null;
    if (b.type.includes('application/json') || b.type.includes('text/html')) {
      if (b.size < 2048) {
        try {
          const txt = await b.slice(0, 512).text();
          if (txt.trim().startsWith('{') && (txt.includes('"error"') || txt.includes('"success":false'))) {
            return null;
          }
          if (txt.trim().toLowerCase().startsWith('<!doctype html') || txt.trim().toLowerCase().startsWith('<html')) {
            return null;
          }
        } catch {}
      }
    }
    return await ensureDecompressedBlob(b, mimeType);
  };

  // 1. IndexedDB local en priorité (0ms)
  if (fileId) {
    const localBlob = await getFileBlob(fileId);
    const validLocal = await isValidDocBlob(localBlob);
    if (validLocal) return validLocal;
  }

  // 2. Si URL est déjà un blob: ou data:
  if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const b = await resp.blob();
        const valid = await isValidDocBlob(b);
        if (valid) {
          if (fileId) storeFileBlob(fileId, valid).catch(() => {});
          return valid;
        }
      }
    } catch {}
  }

  // 3. Construire la liste des URLs candidates à tester
  const candidates: string[] = [];
  if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    candidates.push(fullUrl);
  }
  if (fileId && !String(fileId).startsWith('local-')) {
    const streamUrl = `${baseUrl}/api/cloud/stream/${encodeURIComponent(fileId)}`;
    const fileUrl = `${baseUrl}/api/cloud/file/${encodeURIComponent(fileId)}`;
    if (!candidates.includes(streamUrl)) candidates.push(streamUrl);
    if (!candidates.includes(fileUrl)) candidates.push(fileUrl);
  }
  if (r2Key) {
    const storageUrl = `${baseUrl}/api/storage/file/${r2Key}`;
    if (!candidates.includes(storageUrl)) candidates.push(storageUrl);
  }

  for (const candidateUrl of candidates) {
    try {
      const isInternal = candidateUrl.includes('/api/');
      const resp = await fetch(candidateUrl, isInternal ? { headers } : undefined);
      if (resp.ok) {
        const b = await resp.blob();
        const valid = await isValidDocBlob(b);
        if (valid) {
          if (fileId) storeFileBlob(fileId, valid).catch(() => {});
          return valid;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Résout un PDF en URL `blob:...` propre avec `type: 'application/pdf'` garanti non-compressé,
 * afin que le lecteur PDF natif de Chrome/Edge (`#toolbar=1`) s'ouvre toujours sans erreur.
 */
export async function resolveCleanPdfBlobUrl(options: {
  fileId?: string;
  url?: string;
  r2Key?: string;
  baseUrl?: string;
}): Promise<string | null> {
  const cleanBlob = await resolveCleanDocumentBlob({
    ...options,
    mimeType: 'application/pdf',
  });
  if (!cleanBlob) return null;
  try {
    return URL.createObjectURL(cleanBlob);
  } catch {
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
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur vidage binaire IndexedDB:', err);
  }
}

/**
 * Sauvegarde la miniature / image d'aperçu dans IndexedDB pour affichage local instantané (0ms)
 */
export async function storeThumbnailData(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: `thumb_${id}`, blob: null, dataUrl, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[LocalFileStorage] Erreur sauvegarde miniature IndexedDB:', err);
  }
}

/**
 * Récupère la miniature / image d'aperçu depuis IndexedDB
 */
export async function getThumbnailData(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`thumb_${id}`);

      req.onsuccess = () => {
        const res = req.result;
        resolve(res?.dataUrl || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
