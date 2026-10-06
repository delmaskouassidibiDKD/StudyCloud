/**
 * StudyCloud - Cache v3.0 - Architecture IndexedDB (type Google Drive)
 *
 * TIER 1: RAM (0ms)         - currentState singleton
 * TIER 2: IndexedDB (~50ms) - plusieurs GB (vs 5MB localStorage avant)
 * TIER 3: Reseau (15s)      - Cloudflare D1/R2, source de verite
 */

import { CloudStorageAPI, CloudOverviewData } from './cloudStorageService';
import { ClasseurCreatedFolder } from '../components/Folder3DModels';
import { DownloadedItem } from './downloadsManager';
import { getCurrentUserId } from './userSync';
import { detectFileCategory } from './fileTypeValidator';
import { invalidateCloudQueries } from './queryClient';

export interface FileItem {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  date: string;
  timestamp?: number;
  type?: string;
  category?: 'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'trash' | 'secure' | 'folder' | 'classeur_folder' | 'apps' | 'mes-fichiers' | string;
  originalCategory?: 'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'trash' | 'secure' | 'folder' | 'classeur_folder' | 'apps' | 'mes-fichiers' | string;
  url?: string;
  fileUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  coverUrl?: string;
  artist?: string;
  album?: string;
  extension?: string;
  content?: string;
  noteTitle?: string;
  isNotepad?: boolean;
  isPdf?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
  isImage?: boolean;
  source?: string;
  color?: string;
  displayOrder?: number;
  positionX?: number;
  positionY?: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  folderId?: string;
  r2Key?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  isTrash?: boolean;
  isSecure?: boolean;
  originalFolderId?: string;
  sourceCategory?: string;
  metadata?: any;
  isSyncError?: boolean;
  uploadError?: string;
}

export interface CloudDataState {
  overview: CloudOverviewData | null;
  classeurFolders: ClasseurCreatedFolder[];
  folderFilesMap: Record<string, FileItem[]>;
  documents: FileItem[];
  images: FileItem[];
  videos: FileItem[];
  audio: FileItem[];
  downloads: DownloadedItem[];
  secure: FileItem[];
  trash: FileItem[];
  favorites: FileItem[];
  favIdSet: Set<string>;
  pinIdSet: Set<string>;
  recentFiles: FileItem[];
  isLoaded: boolean;
  isSyncing: boolean;
  lastSyncTime: number;
}

const SYNC_COOLDOWN_MS = 15000;

// IndexedDB constants - capacite plusieurs GB
const IDB_DB_NAME    = 'StudyCloudCacheDB';
const IDB_DB_VERSION = 3;
const IDB_STORE_NAME = 'cloud_data';
const IDB_CACHE_KEY  = 'main_cache';
// Flag leger dans localStorage uniquement pour hasData() synchrone (<100 bytes)
const LS_FLAG_KEY = 'sc_idb_has_data';

function getCacheKey(): string {
  const uid = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null);
  return uid && uid !== 'default-user' ? `cloud_data_cache_${uid}` : 'guest_cache';
}

let _idbInstance: IDBDatabase | null = null;
let _idbOpenPromise: Promise<IDBDatabase | null> | null = null;

function openIDB(): Promise<IDBDatabase | null> {
  if (_idbInstance) return Promise.resolve(_idbInstance);
  if (_idbOpenPromise) return _idbOpenPromise;
  _idbOpenPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) { resolve(null); return; }
    const req = window.indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = (e) => { _idbInstance = (e.target as IDBOpenDBRequest).result; resolve(_idbInstance); };
    req.onerror   = () => { console.warn('[CloudDataStore] IndexedDB unavailable'); resolve(null); };
  });
  return _idbOpenPromise;
}

async function idbGet(key: string): Promise<any> {
  const db = await openIDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx  = db.transaction(IDB_STORE_NAME, 'readonly');
    const req = tx.objectStore(IDB_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => resolve(null);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openIDB();
  if (!db) {
    // Fallback localStorage si IndexedDB non disponible
    try { localStorage.setItem('sc_fallback_' + key, JSON.stringify(value)); } catch {}
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => resolve();
  });
}

export const isRecentEligible = (file: any): boolean => {
  if (!file || !file.name) return false;

  // 1. Exclure formellement les dossiers (3D, classeur, etc.)
  if (file.isFolder || file.is_folder || file.isClasseurFolder) return false;
  if (file.size === 'Dossier 3D' || file.size === '1 dossier 3D') return false;
  if (file.source === 'Dossier 3D' || file.source === 'Classeur') return false;
  if (file.id && typeof file.id === 'string' && (file.id.startsWith('folder_') || file.id.startsWith('cf_folder_') || file.id.startsWith('cf-folder-'))) return false;

  // 2. Exclure tout fichier appartenant à un dossier ou classeur
  if (file.folderId && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(file.folderId)) return false;
  if (file.folderName) return false;
  if (file.originalFolderId) return false;

  // 3. Exclure les matières et chemins R2 dédiés
  if (file.matiere || file.matiereId) return false;
  if (file.r2Key && (file.r2Key.includes('/mes-fichiers/') || file.r2Key.includes('/classeur/'))) return false;

  // 4. Exclure notes, bloc-notes et fichiers textes
  if (file.isNotepad || file.is_notepad) return false;
  const ext = (file.extension || (file.name ? file.name.split('.').pop() : '') || '').toLowerCase();
  if (ext === 'txt') return false;
  if (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.txt')) return false;
  if (file.type === 'text/plain') return false;

  // 5. Filtrage strict par catégorie : SEULEMENT images, vidéos, audio, documents
  const cat = String(file.category || '').toLowerCase().trim();
  const FORBIDDEN_CATS = ['classeur', 'folder', 'classeur_folder', 'dossier', 'notes', 'trash', 'corbeille', 'secure', 'apps', 'downloads', 'telechargements', 'mes-fichiers'];
  if (FORBIDDEN_CATS.includes(cat)) return false;

  const ALLOWED_CATS = new Set(['images', 'image', 'photos', 'videos', 'video', 'audio', 'musique', 'documents', 'document', 'docs']);
  if (cat && !ALLOWED_CATS.has(cat)) return false;

  // Si pas de catégorie renseignée explicitement, vérifier l'extension autorisée
  if (!cat) {
    const isDocExt = /^(pdf|docx?|xlsx?|pptx?|odt|rtf|csv)$/i.test(ext);
    const isImgExt = /^(jpe?g|png|webp|gif|svg|avif)$/i.test(ext);
    const isVidExt = /^(mp4|mov|avi|webm|mkv)$/i.test(ext);
    const isAudExt = /^(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|aiff|alac)$/i.test(ext);
    if (!isDocExt && !isImgExt && !isVidExt && !isAudExt) return false;
  }

  return true;
};

export const isFolderBoundItem = (item: any): boolean => {
  if (!item) return false;
  if (item.category === 'classeur' || item.category === 'classeur_folder') return true;
  const fId = item.folderId || item.folder_id || item.originalFolderId;
  if (fId && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(fId)) return true;
  if (typeof item.id === 'string' && (item.id.startsWith('cf-') || item.id.startsWith('cf_'))) return true;
  if (item.r2Key && item.r2Key.includes('/classeur/')) return true;
  if (item.source === 'Classeur' || item.source === 'Dossier 3D') return true;
  if (item.folderName && !['Documents', 'Images', 'Vidéos', 'Audio', 'root', 'default-folder'].includes(item.folderName)) return true;
  if (item.isFolder || item.is_folder || item.isClasseurFolder) return true;
  return false;
};

// Etat en memoire (Tier 1 - synchrone 0ms)
const defaultState: CloudDataState = {
  overview: null, classeurFolders: [], folderFilesMap: {},
  documents: [], images: [], videos: [], audio: [], downloads: [],
  secure: [], trash: [], favorites: [],
  favIdSet: new Set<string>(), pinIdSet: new Set<string>(),
  recentFiles: [], isLoaded: false, isSyncing: false, lastSyncTime: 0,
};

let currentState: CloudDataState = { ...defaultState };
const listeners = new Set<(state: CloudDataState) => void>();
let inFlightSyncPromise: Promise<void> | null = null;

let hydrationResolve: (() => void) | null = null;
const hydrationComplete = new Promise<void>((res) => { hydrationResolve = res; });

const dismissedRecentSet = new Set<string>();

export function getDeletedRecentIds(): Set<string> {
  try {
    const raw = localStorage.getItem('studycloud_deleted_recent_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          if (typeof item === 'string') {
            dismissedRecentSet.add(item);
          }
        });
      }
    }
  } catch {}
  return dismissedRecentSet;
}

export function isRecentDismissed(id: string): boolean {
  if (!id) return false;
  return dismissedRecentSet.has(id) || getDeletedRecentIds().has(id);
}

// Hydratation async depuis IndexedDB (Tier 2 avec isolation utilisateur)
async function hydrateFromIndexedDB(): Promise<boolean> {
  try {
    const key = getCacheKey();
    getDeletedRecentIds();
    // Strictement le cache de l'utilisateur actif - JAMAIS de fallback sur un autre compte
    const parsed = await idbGet(key);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.dismissedRecentIds)) {
        parsed.dismissedRecentIds.forEach((id: string) => dismissedRecentSet.add(id));
      }

      currentState = {
        ...currentState,
        overview:        parsed.overview || null,
        classeurFolders: Array.isArray(parsed.classeurFolders) ? parsed.classeurFolders : [],
        folderFilesMap:  parsed.folderFilesMap  || {},
        documents:       Array.isArray(parsed.documents)       ? parsed.documents       : [],
        images:          Array.isArray(parsed.images)          ? parsed.images          : [],
        videos:          Array.isArray(parsed.videos)          ? parsed.videos          : [],
        audio:           Array.isArray(parsed.audio)           ? parsed.audio           : [],
        downloads:       Array.isArray(parsed.downloads)       ? parsed.downloads       : [],
        secure:          Array.isArray(parsed.secure)          ? parsed.secure          : [],
        trash:           Array.isArray(parsed.trash)           ? parsed.trash           : [],
        favorites:       Array.isArray(parsed.favorites)       ? parsed.favorites       : [],
        favIdSet:        new Set(Array.isArray(parsed.favIds)  ? parsed.favIds          : []),
        pinIdSet:        new Set(Array.isArray(parsed.pinIds)  ? parsed.pinIds          : []),
        recentFiles:     (Array.isArray(parsed.recentFiles)     ? parsed.recentFiles     : []).filter((f: any) => f && f.id && !dismissedRecentSet.has(f.id) && isRecentEligible(f)),
        isLoaded:        true,
        lastSyncTime:    Number(parsed.lastSyncTime) || 0,
      };

      try {
        const rawLocal = localStorage.getItem('studycloud_pinned_ids');
        if (rawLocal) {
          const arr = JSON.parse(rawLocal);
          if (Array.isArray(arr)) {
            arr.forEach((id: string) => currentState.pinIdSet.add(id));
          }
        }
        localStorage.setItem('studycloud_pinned_ids', JSON.stringify(Array.from(currentState.pinIdSet)));
      } catch {}

      try { localStorage.setItem(LS_FLAG_KEY, '1'); } catch {}
      hydrationResolve?.();
      return true;
    }
  } catch (e) {
    console.warn('[CloudDataStore] Hydration error:', e);
  }
  hydrationResolve?.();
  return false;
}

// Persistance async dans IndexedDB (isolée par utilisateur)
async function persistToIndexedDB(): Promise<void> {
  try {
    const key = getCacheKey();
    await idbSet(key, {
      overview:        currentState.overview,
      classeurFolders: currentState.classeurFolders,
      folderFilesMap:  currentState.folderFilesMap,
      documents:       currentState.documents,
      images:          currentState.images,
      videos:          currentState.videos,
      audio:           currentState.audio,
      downloads:       currentState.downloads,
      secure:          currentState.secure,
      trash:           currentState.trash,
      favorites:       currentState.favorites,
      favIds:          Array.from(currentState.favIdSet),
      pinIds:          Array.from(currentState.pinIdSet),
      dismissedRecentIds: Array.from(dismissedRecentSet),
      recentFiles:     currentState.recentFiles,
      lastSyncTime:    currentState.lastSyncTime,
    });
    try { localStorage.setItem(LS_FLAG_KEY, '1'); } catch {}
  } catch (e) {
    console.warn('[CloudDataStore] Persist error:', e);
  }
}

let tombstoneChecker: ((id: string) => boolean) | null = null;
export function setTombstoneChecker(fn: (id: string) => boolean) {
  tombstoneChecker = fn;
}

const deletionListeners = new Set<(id: string, category?: string) => void>();

function getLocallyDeletedFileIds(): Set<string> {
  const result = new Set<string>();
  try {
    const raw = localStorage.getItem('studycloud_deleted_file_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          if (typeof item === 'string' && item.trim().length > 0) {
            result.add(item);
          }
        });
      }
    }
  } catch {}
  return result;
}

let tombstoneRemover: ((id: string) => void) | null = null;
export function setTombstoneRemover(fn: (id: string) => void) {
  tombstoneRemover = fn;
}

let restoreUpsertNotifier: ((id: string, category: string, content: any) => void) | null = null;
export function setRestoreUpsertNotifier(fn: (id: string, category: string, content: any) => void) {
  restoreUpsertNotifier = fn;
}

let favoriteSyncNotifier: ((favId: string, itemId: string, isFav: boolean, category?: string) => void) | null = null;
export function setFavoriteSyncNotifier(fn: (favId: string, itemId: string, isFav: boolean, category?: string) => void) {
  favoriteSyncNotifier = fn;
}

export function notifyFavoriteChange(itemId: string, isFav: boolean, category?: string) {
  if (!itemId) return;
  const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || 'default-user';
  const favId = `fav_${userId}_${itemId}`;

  if (isFav) {
    currentState.favIdSet.add(itemId);
  } else {
    currentState.favIdSet.delete(itemId);
    currentState.favorites = (currentState.favorites || []).filter(f => f.id !== itemId);
  }

  if (favoriteSyncNotifier) {
    try { favoriteSyncNotifier(favId, itemId, isFav, category); } catch {}
  }

  // Persistance Cloudflare D1 en arrière-plan
  if (isFav) {
    CloudStorageAPI.addFavorite(itemId, category || 'documents').catch(() => {});
  } else {
    CloudStorageAPI.removeFavorite(itemId).catch(() => {});
  }
}

export function markItemDeleted(id: string) {
  if (!id) return;
  try {
    const raw = localStorage.getItem('studycloud_deleted_file_ids');
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && !arr.includes(id)) {
      arr.push(id);
      localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(arr.slice(-500)));
    }
  } catch {}
}

export function unmarkItemDeleted(id: string) {
  if (!id) return;
  try {
    const raw = localStorage.getItem('studycloud_deleted_file_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const next = arr.filter((x: any) => x !== id);
        localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(next));
      }
    }
  } catch {}
  try {
    const rawRecent = localStorage.getItem('studycloud_deleted_recent_ids');
    if (rawRecent) {
      const arrRecent = JSON.parse(rawRecent);
      if (Array.isArray(arrRecent)) {
        const nextRecent = arrRecent.filter((x: any) => x !== id);
        localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(nextRecent));
      }
    }
  } catch {}
  if (tombstoneRemover) {
    try { tombstoneRemover(id); } catch {}
  }
}

export function markTrashItemPermanentlyDeleted(id: string) {
  if (!id) return;
  try {
    const raw = localStorage.getItem('studycloud_permanently_deleted_trash_ids');
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && !arr.includes(id)) {
      arr.push(id);
      localStorage.setItem('studycloud_permanently_deleted_trash_ids', JSON.stringify(arr.slice(-500)));
    }
  } catch {}
}

export function unmarkTrashItemPermanentlyDeleted(id: string) {
  if (!id) return;
  try {
    const raw = localStorage.getItem('studycloud_permanently_deleted_trash_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const next = arr.filter((x: any) => x !== id);
        localStorage.setItem('studycloud_permanently_deleted_trash_ids', JSON.stringify(next));
      }
    }
  } catch {}
}

export function isTrashItemPermanentlyDeleted(id: string): boolean {
  if (!id) return false;
  try {
    const raw = localStorage.getItem('studycloud_permanently_deleted_trash_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.includes(id)) return true;
    }
  } catch {}
  return false;
}

export function isItemDeleted(id: string): boolean {
  if (!id) return false;
  if (tombstoneChecker && tombstoneChecker(id)) return true;
  return getLocallyDeletedFileIds().has(id);
}

function notify() {
  listeners.forEach(fn => { try { fn(currentState); } catch (e) { console.error('[CloudDataStore]', e); } });
}

// Hydratation au demarrage du module (non-bloquant)
hydrateFromIndexedDB().then(hasData => {
  if (hasData) notify();
});

export const CloudDataStore = {
  getState(): CloudDataState { return currentState; },

  subscribe(listener: (state: CloudDataState) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  onDelete(listener: (id: string, category?: string) => void): () => void {
    deletionListeners.add(listener);
    return () => { deletionListeners.delete(listener); };
  },

  isRecentDismissed(id: string): boolean {
    return isRecentDismissed(id);
  },

  hasData(): boolean {
    if (currentState.isLoaded) return true;
    if (currentState.documents.length > 0 || currentState.images.length > 0) return true;
    // Flag leger synchrone - sert a detecter si IndexedDB a des donnees avant hydratation
    try { return localStorage.getItem(LS_FLAG_KEY) === '1'; } catch {}
    return false;
  },

  whenReady(): Promise<void> { return hydrationComplete; },

  async syncFromCloud(force: boolean = false): Promise<void> {
    return this.sync(force);
  },

  async sync(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (inFlightSyncPromise) return inFlightSyncPromise;
    if (!force && currentState.isLoaded && (now - currentState.lastSyncTime < SYNC_COOLDOWN_MS)) return;

    currentState = { ...currentState, isSyncing: true };
    notify();

    inFlightSyncPromise = (async () => {
      try {
        const isNotLocallyDeleted = (f: any) => !isItemDeleted(f.id);

        const flag = (arr: any[]) => (arr || []).map((f: any) => ({
          ...f,
          isFavorite: currentState.favIdSet.has(f.id) || Boolean(f.isFavorite) || Boolean(f.is_favorite),
          isPinned: currentState.pinIdSet.has(f.id) || Boolean(f.isPinned) || Boolean(f.is_pinned),
        }));

        // Préserver uniquement les fichiers locaux activement en cours d'upload qui ne sont pas encore renvoyés par l'API
        const mergeOptimistic = (serverList: FileItem[] | null, currentList: FileItem[]) => {
          if (serverList === null) return (currentList || []).filter(c => !isItemDeleted(c.id));
          const serverIds = new Set(serverList.map(s => s.id));
          const serverNames = new Set(serverList.map(s => (s.name || '').trim().toLowerCase()));
          const pending = (currentList || []).filter(c => 
            !serverIds.has(c.id) && 
            !serverNames.has((c.name || '').trim().toLowerCase()) &&
            Boolean(c.isUploading) &&
            !isItemDeleted(c.id)
          );
          const combined = [...pending, ...serverList.filter(s => !isItemDeleted(s.id))];
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();
          return combined.filter(item => {
            if (!item || !item.id) return false;
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            const norm = (item.name || '').trim().toLowerCase();
            if (norm && seenNames.has(norm)) return false;
            if (norm) seenNames.add(norm);
            return true;
          });
        };

        const sortDesc = (a: any, b: any) => {
          const tA = a.timestamp || (a.date ? new Date(String(a.date).replace(' ', 'T')).getTime() : 0) || 0;
          const tB = b.timestamp || (b.date ? new Date(String(b.date).replace(' ', 'T')).getTime() : 0) || 0;
          return tB - tA;
        };


        // Recalcul des récents et favoris au fur et à mesure de l'arrivée des données
        const refreshDerived = () => {
          const allCurrent = [
            ...(currentState.favorites || []),
            ...currentState.documents,
            ...currentState.images,
            ...currentState.videos,
            ...currentState.audio,
            ...currentState.classeurFolders.map(cf => ({
              id: cf.id,
              name: cf.name,
              category: 'classeur' as const,
              size: 'Dossier 3D',
              date: 'Favori',
              isFolder: true,
              isFavorite: cf.isFavorite,
              metadata: {
                modelId: cf.modelId,
                primaryColor: cf.primaryColor,
                accentColor: cf.accentColor,
                iconName: cf.iconName,
                isFavorite: cf.isFavorite
              }
            } as any as FileItem)),
            ...Object.values(currentState.folderFilesMap).flat()
          ];
          // Agrégation intelligente et universelle des fichiers récents (cross-device, toutes catégories)
          const parseTimeMs = (f: any): number => {
            if (!f) return 0;
            if (f.id && typeof f.id === 'string' && f.id.startsWith('cf-')) {
              const parts = f.id.split('-');
              for (const p of parts) {
                const num = Number(p);
                if (!isNaN(num) && num > 1000000000000) return num;
              }
            }
            if (f.createdAt) {
              const t = new Date(String(f.createdAt).replace(' ', 'T')).getTime();
              if (!isNaN(t)) return t;
            }
            if (f.created_at) {
              const t = new Date(String(f.created_at).replace(' ', 'T')).getTime();
              if (!isNaN(t)) return t;
            }
            if (f.updatedAt) {
              const t = new Date(String(f.updatedAt).replace(' ', 'T')).getTime();
              if (!isNaN(t)) return t;
            }
            if (f.updated_at) {
              const t = new Date(String(f.updated_at).replace(' ', 'T')).getTime();
              if (!isNaN(t)) return t;
            }
            if (f.lastImported && typeof f.lastImported === 'number') return f.lastImported;
            if (f.last_imported && typeof f.last_imported === 'number') return f.last_imported;
            return 0;
          };

          // Fichiers actifs qui existent RÉELLEMENT dans le compte de l'utilisateur (4 catégories autorisées)
          const activeExistingIdSet = new Set<string>([
            ...currentState.documents.map(f => f.id),
            ...currentState.images.map(f => f.id),
            ...currentState.videos.map(f => f.id),
            ...currentState.audio.map(f => f.id),
          ]);
          const currentTrashIdSet = new Set<string>(currentState.trash.map(t => t.id));

          const candidates = [
            ...(currentState.overview?.recentFiles || []),
            ...(currentState.recentFiles || []),
            ...currentState.documents,
            ...currentState.images,
            ...currentState.videos,
            ...currentState.audio
          ];

          const seenRecents = new Set<string>();
          const dedupedRecents: FileItem[] = [];
          for (const file of candidates) {
            if (!file || !file.id) continue;
            if (seenRecents.has(file.id)) continue;
            if (!isRecentEligible(file)) continue;
            if (isItemDeleted(file.id)) continue;
            if (currentTrashIdSet.has(file.id)) continue;
            if (dismissedRecentSet.has(file.id) || getDeletedRecentIds().has(file.id)) continue;
            // RÈGLE STRICTE : Un fichier qui n'existe pas ne doit JAMAIS apparaître dans les récents
            if (activeExistingIdSet.size > 0 && !activeExistingIdSet.has(file.id)) continue;
            seenRecents.add(file.id);
            dedupedRecents.push(file);
          }

          currentState.recentFiles = dedupedRecents
            .sort((a, b) => parseTimeMs(b) - parseTimeMs(a))
            .slice(0, 6);
          const seen = new Set<string>();
          currentState.favorites = allCurrent
            .filter(f => currentState.favIdSet.has(f.id) || Boolean(f.isFavorite))
            .filter(f => {
              if (seen.has(f.id)) return false;
              seen.add(f.id);
              return true;
            });
        };

        // ── FLUX PARALLÈLES ET INDÉPENDANTS (HYDRATATION PROGRESSIVE) ─────────
        // Chaque flux se termine et met à jour l'UI instantanément sans attendre les autres

        const tasks: Promise<any>[] = [];

        // 1. Favoris & Épinglés
        tasks.push(
          CloudStorageAPI.getFavoritesList().then(({ favIds, items }) => {
            if (favIds !== null && Array.isArray(favIds)) {
              currentState.favIdSet = new Set<string>(favIds);

              // Appliquer immédiatement isFavorite sur tous les fichiers déjà chargés en mémoire
              const markFav = (list: FileItem[]) => list.map(item => ({
                ...item,
                isFavorite: currentState.favIdSet.has(item.id) || Boolean(item.isFavorite)
              }));
              currentState.documents = markFav(currentState.documents);
              currentState.images = markFav(currentState.images);
              currentState.videos = markFav(currentState.videos);
              currentState.audio = markFav(currentState.audio);
              currentState.classeurFolders = currentState.classeurFolders.map(cf => ({
                ...cf,
                isFavorite: currentState.favIdSet.has(cf.id) || Boolean(cf.isFavorite)
              }));

              if (Array.isArray(items) && items.length > 0) {
                const existingMap = new Map(currentState.favorites.map(f => [f.id, f]));
                items.forEach(it => {
                  existingMap.set(it.id, { ...it, isFavorite: true });
                });
                currentState.favorites = Array.from(existingMap.values());
              }

              refreshDerived();
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        tasks.push(
          CloudStorageAPI.getPinned().then(pinnedData => {
            if (pinnedData !== null && Array.isArray(pinnedData)) {
              const ids = pinnedData.map((p: any) => p.itemId || p.item_id || p.id).filter(Boolean);
              currentState.pinIdSet = new Set<string>(ids);

              const markPin = (list: FileItem[]) => list.map(item => ({
                ...item,
                isPinned: currentState.pinIdSet.has(item.id) || Boolean(item.isPinned)
              }));
              currentState.documents = markPin(currentState.documents);
              currentState.images = markPin(currentState.images);
              currentState.videos = markPin(currentState.videos);
              currentState.audio = markPin(currentState.audio);

              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 2. Documents (apparaît dès que prêt !)
        tasks.push(
          CloudStorageAPI.getDocumentsList().then(docs => {
            if (docs !== null) {
              currentState.documents = mergeOptimistic(flag(docs).filter(isNotLocallyDeleted), currentState.documents.filter(isNotLocallyDeleted));
              refreshDerived();
              currentState.isLoaded = true;
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 3. Audio / Musique (apparaît dès que prêt !)
        tasks.push(
          CloudStorageAPI.getAudioList().then(auds => {
            if (auds !== null) {
              currentState.audio = mergeOptimistic(flag(auds).filter(isNotLocallyDeleted), currentState.audio.filter(isNotLocallyDeleted));
              refreshDerived();
              currentState.isLoaded = true;
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 4. Images (apparaît dès que prêt !)
        tasks.push(
          CloudStorageAPI.getImagesList().then(imgs => {
            if (imgs !== null) {
              currentState.images = mergeOptimistic(flag(imgs).filter(isNotLocallyDeleted), currentState.images.filter(isNotLocallyDeleted));
              refreshDerived();
              currentState.isLoaded = true;
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 5. Vidéos (apparaît dès que prêt !)
        tasks.push(
          CloudStorageAPI.getVideosList().then(vids => {
            if (vids !== null) {
              currentState.videos = mergeOptimistic(flag(vids).filter(isNotLocallyDeleted), currentState.videos.filter(isNotLocallyDeleted));
              refreshDerived();
              currentState.isLoaded = true;
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 6. Téléchargements
        tasks.push(
          CloudStorageAPI.getDownloadsList().then(dls => {
            if (dls !== null) {
              currentState.downloads = (dls || []).map((dl: any) => ({
                id: dl.id, name: dl.name, category: dl.category || 'downloads',
                size: dl.size || '0 o', sizeBytes: dl.sizeBytes,
                date: dl.date || dl.downloadedAt || "Aujourd'hui",
                timestamp: dl.timestamp || Date.now(),
                url: dl.url || dl.file_url,
                extension: dl.extension || (dl.name?.includes('.') ? dl.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
                type: dl.type, previewUrl: dl.previewUrl || dl.url,
                videoUrl: dl.videoUrl || dl.url, audioUrl: dl.audioUrl || dl.url,
                documentCategory: dl.documentCategory || 'COURS',
                isFavorite: currentState.favIdSet.has(dl.id), isPinned: currentState.pinIdSet.has(dl.id),
              }));
              currentState.isLoaded = true;
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 7. Dossiers du Classeur 3D et leurs fichiers internes
        tasks.push(
          CloudStorageAPI.getClasseurFolders().then(async (folders) => {
            if (folders !== null) {
              const serverList = (folders || []).map((f: any) => ({
                ...f, isFavorite: currentState.favIdSet.has(f.id), isPinned: currentState.pinIdSet.has(f.id),
              }));
              const serverIds = new Set(serverList.map((s: any) => s.id));
              const pendingFolders = (currentState.classeurFolders || []).filter(c => !serverIds.has(c.id) && !isItemDeleted(c.id));
              currentState.classeurFolders = [...pendingFolders, ...serverList.filter((s: any) => !isItemDeleted(s.id))];
              currentState.isLoaded = true;
              notify();

              // Téléchargement progressif des fichiers de chaque dossier 3D
              await Promise.all(currentState.classeurFolders.map(async (folder) => {
                const files = await CloudStorageAPI.getClasseurFiles(folder.id).catch(() => null);
                if (files !== null) {
                  const currentFiles = currentState.folderFilesMap[folder.id] || [];
                  currentState.folderFilesMap[folder.id] = mergeOptimistic(
                    flag(files).filter(isNotLocallyDeleted),
                    currentFiles.filter(isNotLocallyDeleted)
                  );
                  refreshDerived();
                  notify();
                }
              }));
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 8. Vue d'ensemble & Fichiers récents
        tasks.push(
          CloudStorageAPI.getOverview().then(cloudOverview => {
            if (cloudOverview !== null) {
              currentState.overview = cloudOverview;
              refreshDerived();
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 9. Sécurisé & Corbeille
        tasks.push(
          CloudStorageAPI.getSecureFiles().then(sec => {
            if (sec !== null) {
              currentState.secure = flag(sec).filter(isNotLocallyDeleted);
              notify();
            }
          }).catch(() => null)
        );

        tasks.push(
          CloudStorageAPI.getTrashFiles().then(trash => {
            if (trash !== null) {
              currentState.trash = flag(trash).filter(f => !isTrashItemPermanentlyDeleted(f.id));
              notify();
            }
          }).catch(() => null)
        );

        // Attente que toutes les requêtes réseau soient terminées
        await Promise.allSettled(tasks);

        currentState = {
          ...currentState,
          isLoaded: true,
          isSyncing: false,
          lastSyncTime: Date.now(),
        };

        persistToIndexedDB().catch(() => {});
        notify();
      } catch (err) {
        console.warn('[CloudDataStore] Sync warning:', err);
        currentState = { ...currentState, isLoaded: true, isSyncing: false };
        notify();
      } finally {
        inFlightSyncPromise = null;
      }
    })();

    return inFlightSyncPromise;
  },

  setDocuments(docs: FileItem[]) {
    const cleanDocs = docs.filter(d => !isFolderBoundItem(d));
    const serverIds = new Set(cleanDocs.map(s => s.id));
    const pending = (currentState.documents || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading) && !isFolderBoundItem(c));
    currentState = { ...currentState, documents: [...pending, ...cleanDocs] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setVideos(videos: FileItem[]) {
    const cleanVideos = videos.filter(v => !isFolderBoundItem(v));
    const serverIds = new Set(cleanVideos.map(s => s.id));
    const pending = (currentState.videos || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading) && !isFolderBoundItem(c));
    currentState = { ...currentState, videos: [...pending, ...cleanVideos] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setImages(images: FileItem[]) {
    const cleanImages = images.filter(i => !isFolderBoundItem(i));
    const serverIds = new Set(cleanImages.map(s => s.id));
    const pending = (currentState.images || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading) && !isFolderBoundItem(c));
    currentState = { ...currentState, images: [...pending, ...cleanImages] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setAudio(audio: FileItem[]) {
    const cleanAudio = audio.filter(a => !isFolderBoundItem(a));
    const serverIds = new Set(cleanAudio.map(s => s.id));
    const pending = (currentState.audio || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading) && !isFolderBoundItem(c));
    currentState = { ...currentState, audio: [...pending, ...cleanAudio] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setDownloads(downloads: DownloadedItem[]) { currentState = { ...currentState, downloads };                 persistToIndexedDB().catch(() => {}); notify(); },
  setClasseurFolders(folders: ClasseurCreatedFolder[]) { currentState = { ...currentState, classeurFolders: folders }; persistToIndexedDB().catch(() => {}); notify(); },
  addClasseurFolder(folder: ClasseurCreatedFolder) {
    if (isItemDeleted(folder.id)) return;
    const exists = currentState.classeurFolders.some(f => f.id === folder.id);
    const updated = exists
      ? currentState.classeurFolders.map(f => f.id === folder.id ? { ...f, ...folder } : f)
      : [folder, ...currentState.classeurFolders.filter(f => f.id !== folder.id)];
    currentState = {
      ...currentState,
      classeurFolders: updated,
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setFolderFilesMap(map: Record<string, FileItem[]>) {
    const cleanedMap: Record<string, FileItem[]> = {};
    for (const [fId, list] of Object.entries(map || {})) {
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      cleanedMap[fId] = (list || []).filter(item => {
        if (!item || !item.id) return false;
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        const normName = (item.name || '').trim().toLowerCase();
        if (normName && seenNames.has(normName)) return false;
        if (normName) seenNames.add(normName);
        return true;
      });
    }
    currentState = { ...currentState, folderFilesMap: cleanedMap };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setTrashFiles(trash: FileItem[])          { currentState = { ...currentState, trash: trash || [] };                      persistToIndexedDB().catch(() => {}); notify(); },
  setSecureFiles(secure: FileItem[])        { currentState = { ...currentState, secure };                   persistToIndexedDB().catch(() => {}); notify(); },
  setRecentFiles(recent: FileItem[])        { currentState = { ...currentState, recentFiles: recent };      persistToIndexedDB().catch(() => {}); notify(); },

  getAllFiles(): FileItem[] {
    const seen = new Set<string>();
    const list: FileItem[] = [];
    const add = (items?: any[]) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    };
    add(currentState.documents);
    add(currentState.images);
    add(currentState.videos);
    add(currentState.audio);
    add(currentState.downloads as any[]);
    add(currentState.secure);
    add(currentState.trash);
    add(currentState.recentFiles);
    if (currentState.folderFilesMap) {
      for (const folderList of Object.values(currentState.folderFilesMap)) {
        add(folderList);
      }
    }
    return list;
  },

  addOptimisticFile(file: FileItem, folderId?: string) {
    const targetFolder = folderId || file.folderId || (file as any).folder_id || (file as any).originalFolderId;
    const isFolder = Boolean(targetFolder && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(targetFolder));
    const cat = isFolder ? 'classeur' : (file.category || 'documents');
    // STRICT: Seuls les fichiers des 4 menus (images, vidéos, audio, documents) et NON rattachés à un dossier peuvent aller dans les récents
    const isEligible = !isFolder && !targetFolder && isRecentEligible(file);
    const recent = isEligible
      ? [file, ...currentState.recentFiles.filter(f => f.id !== file.id && isRecentEligible(f))].slice(0, 6)
      : currentState.recentFiles.filter(f => isRecentEligible(f));

    if (isFolder && targetFolder) {
      const currentList = currentState.folderFilesMap[targetFolder] || [];
      const itemWithFolder = {
        ...file,
        category: 'classeur' as const,
        folderId: targetFolder,
        originalFolderId: targetFolder
      };
      currentState = {
        ...currentState,
        recentFiles: recent,
        folderFilesMap: {
          ...currentState.folderFilesMap,
          [targetFolder]: [itemWithFolder, ...currentList.filter(f => f.id !== file.id && f.name !== file.name)]
        }
      };
    } else if (cat === 'images') {
      currentState = {
        ...currentState,
        recentFiles: recent,
        images: [file, ...currentState.images.filter(f => f.id !== file.id)]
      };
    } else if (cat === 'videos') {
      currentState = {
        ...currentState,
        recentFiles: recent,
        videos: [file, ...currentState.videos.filter(f => f.id !== file.id)]
      };
    } else if (cat === 'audio') {
      currentState = {
        ...currentState,
        recentFiles: recent,
        audio: [file, ...currentState.audio.filter(f => f.id !== file.id)]
      };
    } else if (cat === 'mes-fichiers') {
      // mes-fichiers n'apparaît JAMAIS dans les récents
      currentState = {
        ...currentState,
        recentFiles: recent
      };
    } else if (cat === 'documents' || !cat) {
      currentState = {
        ...currentState,
        recentFiles: recent,
        documents: [file, ...currentState.documents.filter(f => f.id !== file.id)]
      };
    } else {
      currentState = {
        ...currentState,
        recentFiles: recent
      };
    }
    persistToIndexedDB().catch(() => {});
    notify();
    try {
      if (cat === 'audio') invalidateCloudQueries.audio();
      else if (cat === 'videos') invalidateCloudQueries.videos();
      else if (cat === 'images') invalidateCloudQueries.images();
      else if (cat === 'documents') invalidateCloudQueries.documents();
      if (folderId) invalidateCloudQueries.classeurFiles(folderId);
      invalidateCloudQueries.overview();
    } catch {}
  },

  updateFile(fileIdOrItem: string | (Partial<FileItem> & { id: string }), maybeUpdates?: Partial<FileItem>, maybeFolderId?: string) {
    let targetId: string;
    let patch: Partial<FileItem>;
    let targetFolderId: string | undefined = maybeFolderId;

    if (typeof fileIdOrItem === 'object' && fileIdOrItem !== null) {
      targetId = fileIdOrItem.id;
      patch = fileIdOrItem;
      if (!targetFolderId) targetFolderId = (fileIdOrItem as any).folderId;
    } else {
      targetId = String(fileIdOrItem);
      patch = maybeUpdates || {};
    }

    if (patch.isFavorite !== undefined) {
      if (patch.isFavorite) {
        currentState.favIdSet.add(targetId);
      } else {
        currentState.favIdSet.delete(targetId);
      }
    }
    if (patch.isPinned !== undefined) {
      if (patch.isPinned) {
        currentState.pinIdSet.add(targetId);
      } else {
        currentState.pinIdSet.delete(targetId);
      }
      try {
        localStorage.setItem('studycloud_pinned_ids', JSON.stringify(Array.from(currentState.pinIdSet)));
      } catch {}
    }

    const updateFn = (list: FileItem[]) => list.map(f => (f.id === targetId || (patch.id && f.id === patch.id)) ? { ...f, ...patch } : f);
    const updatedMap = { ...currentState.folderFilesMap };
    if (targetFolderId && updatedMap[targetFolderId]) {
      updatedMap[targetFolderId] = updateFn(updatedMap[targetFolderId]);
    } else {
      for (const k of Object.keys(updatedMap)) {
        updatedMap[k] = updateFn(updatedMap[k]);
      }
    }

    const allCurrentCandidates = [
      ...updateFn(currentState.documents),
      ...updateFn(currentState.images),
      ...updateFn(currentState.videos),
      ...updateFn(currentState.audio),
      ...currentState.classeurFolders.map(cf => ({
        id: cf.id,
        name: cf.name,
        category: 'classeur' as const,
        size: 'Dossier 3D',
        date: 'Favori',
        isFolder: true,
        isFavorite: cf.isFavorite,
        metadata: {
          modelId: cf.modelId,
          primaryColor: cf.primaryColor,
          accentColor: cf.accentColor,
          iconName: cf.iconName,
          isFavorite: cf.isFavorite
        }
      } as any as FileItem)),
      ...Object.values(updatedMap).flat()
    ];

    const isTargetFolder = Boolean(targetFolderId && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(targetFolderId));
    const cleanFilter = (list: FileItem[]) => {
      const updated = updateFn(list);
      return updated.filter(f => {
        if (isTargetFolder && (f.id === targetId || (patch.id && f.id === patch.id))) return false;
        return !isFolderBoundItem(f);
      });
    };

    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: cleanFilter(currentState.documents),
      images: cleanFilter(currentState.images),
      videos: cleanFilter(currentState.videos),
      audio: cleanFilter(currentState.audio),
      secure: updateFn(currentState.secure),
      trash: updateFn(currentState.trash),
      favorites: allCurrentCandidates.filter(f => currentState.favIdSet.has(f.id) || Boolean(f.isFavorite)),
      recentFiles: updateFn(currentState.recentFiles).filter(f => !isFolderBoundItem(f)),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  removeFile(fileId: string, folderId?: string, category?: string) {
    if (!fileId) return;
    markItemDeleted(fileId);
    notifyFavoriteChange(fileId, false, category);
    const cat = category ||
      (currentState.documents.some(d => d.id === fileId) ? 'documents' :
       currentState.images.some(i => i.id === fileId) ? 'images' :
       currentState.videos.some(v => v.id === fileId) ? 'videos' :
       currentState.audio.some(a => a.id === fileId) ? 'audio' :
       (currentState.downloads || []).some((d: any) => d.id === fileId) ? 'downloads' :
       folderId ? 'classeur' : 'documents');
    deletionListeners.forEach(fn => { try { fn(fileId, cat); } catch {} });
    const filterFn = (list: FileItem[]) => list.filter(f => f.id !== fileId);
    const updatedMap = { ...currentState.folderFilesMap };
    if (folderId && updatedMap[folderId]) {
      updatedMap[folderId] = filterFn(updatedMap[folderId]);
    } else {
      for (const k of Object.keys(updatedMap)) {
        updatedMap[k] = filterFn(updatedMap[k]);
      }
    }
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: filterFn(currentState.documents),
      images: filterFn(currentState.images),
      videos: filterFn(currentState.videos),
      audio: filterFn(currentState.audio),
      downloads: (currentState.downloads || []).filter(d => d.id !== fileId) as any,
      secure: filterFn(currentState.secure),
      recentFiles: filterFn(currentState.recentFiles),
      trash: filterFn(currentState.trash),
      favorites: filterFn(currentState.favorites),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  removeFiles(fileIds: string[], category?: string) {
    if (!fileIds || fileIds.length === 0) return;
    fileIds.forEach(id => {
      markItemDeleted(id);
      dismissedRecentSet.add(id);
      CloudStorageAPI.dismissRecent(id).catch(() => {});
      notifyFavoriteChange(id, false, category);
      const cat = category ||
        (currentState.documents.some(d => d.id === id) ? 'documents' :
         currentState.images.some(i => i.id === id) ? 'images' :
         currentState.videos.some(v => v.id === id) ? 'videos' :
         currentState.audio.some(a => a.id === id) ? 'audio' :
         (currentState.downloads || []).some((d: any) => d.id === id) ? 'downloads' :
         'documents');
      deletionListeners.forEach(fn => { try { fn(id, cat); } catch {} });
    });
    try {
      localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(dismissedRecentSet).slice(-500)));
    } catch {}
    const idSet = new Set(fileIds);
    const filterFn = (list: FileItem[]) => list.filter(f => !idSet.has(f.id));
    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = filterFn(updatedMap[k]);
    }
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: filterFn(currentState.documents),
      images: filterFn(currentState.images),
      videos: filterFn(currentState.videos),
      audio: filterFn(currentState.audio),
      downloads: (currentState.downloads || []).filter(d => !idSet.has(d.id)) as any,
      secure: filterFn(currentState.secure),
      recentFiles: filterFn(currentState.recentFiles),
      trash: filterFn(currentState.trash),
      favorites: filterFn(currentState.favorites),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  reconcileFileId(tempId: string, realId: string, folderId?: string) {
    if (!tempId || !realId || tempId === realId) return;
    unmarkItemDeleted(realId);
    const replaceId = (list: FileItem[]) => list.map(f => f.id === tempId ? { ...f, id: realId } : f);
    const updatedMap = { ...currentState.folderFilesMap };
    if (folderId && updatedMap[folderId]) {
      updatedMap[folderId] = replaceId(updatedMap[folderId]);
    } else {
      for (const k of Object.keys(updatedMap)) {
        updatedMap[k] = replaceId(updatedMap[k]);
      }
    }
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: replaceId(currentState.documents),
      images: replaceId(currentState.images),
      videos: replaceId(currentState.videos),
      audio: replaceId(currentState.audio),
      downloads: (currentState.downloads || []).map((d: any) => d.id === tempId ? { ...d, id: realId } : d) as any,
      recentFiles: replaceId(currentState.recentFiles),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  removeFileFromCategory(fileId: string, category?: string, folderId?: string) {
    notifyFavoriteChange(fileId, false, category);
    dismissedRecentSet.add(fileId);
    CloudStorageAPI.dismissRecent(fileId).catch(() => {});
    try {
      localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(dismissedRecentSet).slice(-500)));
    } catch {}
    const filterFn = (list: FileItem[]) => list.filter(f => f.id !== fileId);
    const updatedMap = { ...currentState.folderFilesMap };
    if (folderId && updatedMap[folderId]) {
      updatedMap[folderId] = filterFn(updatedMap[folderId]);
    } else if (!category || category === 'classeur' || category === 'folder') {
      for (const k of Object.keys(updatedMap)) {
        updatedMap[k] = filterFn(updatedMap[k]);
      }
    }
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: (!category || category === 'documents') ? filterFn(currentState.documents) : currentState.documents,
      images: (!category || category === 'images') ? filterFn(currentState.images) : currentState.images,
      videos: (!category || category === 'videos') ? filterFn(currentState.videos) : currentState.videos,
      audio: (!category || category === 'audio') ? filterFn(currentState.audio) : currentState.audio,
      downloads: (!category || category === 'downloads') ? (currentState.downloads || []).filter(d => d.id !== fileId) as any : currentState.downloads,
      secure: (!category || category === 'secure') ? filterFn(currentState.secure) : currentState.secure,
      recentFiles: filterFn(currentState.recentFiles),
      trash: (!category || category === 'trash') ? filterFn(currentState.trash) : currentState.trash,
      favorites: filterFn(currentState.favorites),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  permanentlyRemoveTrashFile(fileId: string) {
    markTrashItemPermanentlyDeleted(fileId);
    dismissedRecentSet.add(fileId);
    CloudStorageAPI.dismissRecent(fileId).catch(() => {});
    // Écrire un tombstone dans localStorage pour éviter la résurrection lors du prochain sync
    try {
      const raw = localStorage.getItem('studycloud_deleted_file_ids');
      const arr: string[] = raw ? JSON.parse(raw) : [];
      if (!arr.includes(fileId)) {
        arr.push(fileId);
        localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(arr.slice(-500)));
      }
      localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(dismissedRecentSet).slice(-500)));
    } catch {}
    // Notifier le tombstoneChecker (localSyncReplication) si disponible
    if (tombstoneChecker) {
      // Le tombstoneChecker lit inMemoryTombstones, on passe par deletionListeners
      deletionListeners.forEach(fn => { try { fn(fileId, 'trash'); } catch {} });
    }
    currentState = {
      ...currentState,
      trash: currentState.trash.filter(f => f.id !== fileId),
      recentFiles: (currentState.recentFiles || []).filter(f => f.id !== fileId),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  removeTrashFileQuietly(fileId: string) {
    currentState = {
      ...currentState,
      trash: currentState.trash.filter(f => f.id !== fileId),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  moveToTrash(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const idSet = new Set(arr.map(f => f.id));

    // Supprimer définitivement et immédiatement tous les éléments mis en corbeille des Favoris
    // ET effacer définitivement leur aperçu des récents (ne doit JAMAIS réapparaître même après restauration)
    arr.forEach(f => {
      unmarkTrashItemPermanentlyDeleted(f.id);
      notifyFavoriteChange(f.id, false, f.category);
      dismissedRecentSet.add(f.id);
      CloudStorageAPI.dismissRecent(f.id).catch(() => {});
      if (f.category === 'classeur_folder' || f.category === 'folder' || (f as any).model) {
        const childFiles = currentState.folderFilesMap[f.id] || [];
        childFiles.forEach(cf => {
          notifyFavoriteChange(cf.id, false, cf.category);
          dismissedRecentSet.add(cf.id);
          CloudStorageAPI.dismissRecent(cf.id).catch(() => {});
        });
      }
    });

    try {
      localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(dismissedRecentSet).slice(-500)));
    } catch {}

    const filterFn = (list: FileItem[]) => list.filter(f => !idSet.has(f.id));
    const clearFavFn = (list: FileItem[]) => list.map(f => idSet.has(f.id) ? { ...f, isFavorite: false } : f);

    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = filterFn(updatedMap[k]);
    }
    const trashedItems = arr.map(f => ({ ...f, isTrash: true, isFavorite: false }));
    const existingTrash = currentState.trash.filter(t => !idSet.has(t.id));
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: filterFn(clearFavFn(currentState.documents)),
      images: filterFn(clearFavFn(currentState.images)),
      videos: filterFn(clearFavFn(currentState.videos)),
      audio: filterFn(clearFavFn(currentState.audio)),
      downloads: (currentState.downloads || []).filter(d => !idSet.has(d.id)) as any,
      classeurFolders: (currentState.classeurFolders || []).filter(cf => !idSet.has(cf.id)),
      secure: filterFn(currentState.secure),
      recentFiles: filterFn(currentState.recentFiles),
      favorites: currentState.favorites.filter(f => !idSet.has(f.id)),
      trash: [...trashedItems, ...existingTrash],
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  restoreFromTrash(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const initialIdSet = new Set(arr.map(f => f.id));

    // 1. Si un dossier est restauré, identifier et restaurer simultanément tous les fichiers
    // qui étaient contenus dans ce dossier et qui se trouvent dans la corbeille
    const folderIds = new Set(
      arr.filter(f => f.category === 'classeur_folder' || f.category === 'folder' || (f as any).isFolder || (f as any).sourceCategory === 'classeur_folder').map(f => f.id)
    );
    const childFilesInTrash = folderIds.size > 0
      ? currentState.trash.filter(t => (t.originalFolderId && folderIds.has(t.originalFolderId)) || ((t as any).folderId && folderIds.has((t as any).folderId)))
      : [];

    const allToRestore = [...arr, ...childFilesInTrash.filter(c => !initialIdSet.has(c.id))];
    const allIdSet = new Set(allToRestore.map(f => f.id));

    // 2. Dégager activement les tombstones et marques de suppression locale
    allToRestore.forEach(file => {
      unmarkItemDeleted(file.id);
      unmarkTrashItemPermanentlyDeleted(file.id);
    });

    const newTrash = currentState.trash.filter(t => !allIdSet.has(t.id));
    let newDocs = [...currentState.documents];
    let newImgs = [...currentState.images];
    let newVids = [...currentState.videos];
    let newAuds = [...currentState.audio];
    let newDls  = [...currentState.downloads];
    let newFolders = [...currentState.classeurFolders];
    const updatedMap = { ...currentState.folderFilesMap };

    allToRestore.forEach(file => {
      const isFolder = file.category === 'classeur_folder' || file.category === 'folder' || (file as any).isFolder || (file as any).sourceCategory === 'classeur_folder';
      const meta = (file as any).metadata || {};
      const restored: FileItem = {
        ...file,
        isTrash: false,
        isFavorite: false, // Définitivement non-favori lors de la restauration
      };
      currentState.favIdSet.delete(file.id);

      if (isFolder) {
        const folderModel = Number(meta.model || meta.modelId || meta.model_id || 1);
        const validModel: 1 | 2 | 3 | 4 = (folderModel >= 1 && folderModel <= 4) ? (folderModel as 1 | 2 | 3 | 4) : 1;
        const restoredFolder: ClasseurCreatedFolder = {
          id: file.id,
          name: file.name || 'Dossier',
          model: validModel,
          modelId: meta.modelId || meta.model_id || String(validModel),
          primaryColor: meta.primaryColor || meta.primary_color || '#EA580C',
          accentColor: meta.accentColor || meta.accent_color || '#F97316',
          secondaryColor: meta.secondaryColor || meta.secondary_color,
          badge: meta.badge,
          iconType: meta.iconType || meta.icon_type,
          iconName: meta.iconName || meta.icon_name || 'Folder',
          textDark: Boolean(meta.textDark ?? meta.text_dark),
          dateText: meta.dateText || meta.date_text || file.date || new Date().toLocaleDateString('fr-FR'),
          createdAt: Number(meta.createdAt || Date.now()),
          positionX: Number(meta.positionX ?? meta.position_x ?? 0),
          positionY: Number(meta.positionY ?? meta.position_y ?? 0),
          displayOrder: Number(meta.displayOrder ?? meta.display_order ?? 0),
          zoomLevel: Number(meta.zoomLevel ?? meta.zoom_level ?? 10),
          parentId: meta.parentId || meta.parent_id || undefined,
          isPinned: Boolean(meta.isPinned ?? meta.is_pinned),
          isFavorite: false, // Définitivement non-favori
        };
        newFolders = [restoredFolder, ...newFolders.filter(f => f.id !== file.id)];
        if (restoreUpsertNotifier) {
          try { restoreUpsertNotifier(file.id, 'classeur_folder', restoredFolder); } catch {}
        }
      } else {
        const targetFolderId = file.originalFolderId || (file as any).folderId;
        const rawCat = (file.sourceCategory || file.originalCategory || file.category || '').toLowerCase();

        if (targetFolderId && (rawCat === 'classeur' || file.originalFolderId || (file as any).folderId)) {
          restored.category = 'classeur';
          restored.originalFolderId = targetFolderId;
          restored.folderId = targetFolderId;
          if (!updatedMap[targetFolderId]) updatedMap[targetFolderId] = [];
          updatedMap[targetFolderId] = [restored, ...updatedMap[targetFolderId].filter(f => f.id !== file.id)];
          if (restoreUpsertNotifier) {
            try { restoreUpsertNotifier(file.id, 'classeur', restored); } catch {}
          }
        } else {
          // Détection intelligente de la catégorie pour un placement immédiat et exact
          let detectedCat = rawCat;
          if (!detectedCat || detectedCat === 'trash' || detectedCat === 'folder') {
            detectedCat = detectFileCategory({ name: file.name, type: file.type });
          }

          if (detectedCat === 'images' || (file as any).isImage) {
            restored.category = 'images';
            newImgs = [restored, ...newImgs.filter(f => f.id !== file.id)];
            if (restoreUpsertNotifier) {
              try { restoreUpsertNotifier(file.id, 'images', restored); } catch {}
            }
          } else if (detectedCat === 'videos' || !!file.videoUrl || (file as any).isVideo) {
            restored.category = 'videos';
            newVids = [restored, ...newVids.filter(f => f.id !== file.id)];
            if (restoreUpsertNotifier) {
              try { restoreUpsertNotifier(file.id, 'videos', restored); } catch {}
            }
          } else if (detectedCat === 'audio' || !!file.audioUrl || (file as any).isAudio) {
            restored.category = 'audio';
            newAuds = [restored, ...newAuds.filter(f => f.id !== file.id)];
            if (restoreUpsertNotifier) {
              try { restoreUpsertNotifier(file.id, 'audio', restored); } catch {}
            }
          } else if (detectedCat === 'downloads') {
            restored.category = 'downloads';
            newDls = [restored as any, ...newDls.filter(f => f.id !== file.id)];
            if (restoreUpsertNotifier) {
              try { restoreUpsertNotifier(file.id, 'downloads', restored); } catch {}
            }
          } else {
            restored.category = 'documents';
            newDocs = [restored, ...newDocs.filter(f => f.id !== file.id)];
            if (restoreUpsertNotifier) {
              try { restoreUpsertNotifier(file.id, 'documents', restored); } catch {}
            }
          }
        }
      }
    });

    currentState = {
      ...currentState,
      trash: newTrash,
      classeurFolders: newFolders,
      documents: newDocs,
      images: newImgs,
      videos: newVids,
      audio: newAuds,
      downloads: newDls,
      folderFilesMap: updatedMap,
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  emptyTrash() {
    // Écrire les tombstones pour tous les éléments de la corbeille
    // afin d'éviter leur résurrection lors du prochain sync
    try {
      const raw = localStorage.getItem('studycloud_deleted_file_ids');
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const existingSet = new Set(existing);
      currentState.trash.forEach(t => {
        existingSet.add(t.id);
        markTrashItemPermanentlyDeleted(t.id);
      });
      localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(Array.from(existingSet).slice(-500)));
    } catch {}
    // Notifier deletionListeners (dont localSyncReplication) pour chaque élément
    currentState.trash.forEach(t => deletionListeners.forEach(fn => { try { fn(t.id, 'trash'); } catch {} }));
    currentState = {
      ...currentState,
      trash: [],
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  moveToSecure(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const idSet = new Set(arr.map(f => f.id));
    const filterFn = (list: FileItem[]) => list.filter(f => !idSet.has(f.id));
    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = filterFn(updatedMap[k]);
    }
    const lockedItems = arr.map(f => {
      const origCat = (f as any).originalCategory || f.category;
      const isAud = origCat === 'audio';
      const resolvedCover = (f as any).coverUrl
        || (f as any).thumbnailUrl
        || (f as any).metadata?.coverUrl
        || (isAud && f.previewUrl && !f.previewUrl.startsWith('blob:') && !f.previewUrl.includes('.mp3') ? f.previewUrl : '')
        || '';
      return {
        ...f,
        isSecure: true,
        coverUrl: isAud ? (resolvedCover || (f as any).coverUrl || undefined) : (f as any).coverUrl,
        thumbnailUrl: isAud ? (resolvedCover || (f as any).thumbnailUrl || undefined) : (f as any).thumbnailUrl,
        previewUrl: isAud ? (resolvedCover || f.previewUrl) : f.previewUrl,
        artist: (f as any).artist,
        title: (f as any).title || f.name,
        album: (f as any).album,
        durationSec: (f as any).durationSec || 0,
        lyricsSnippet: (f as any).lyricsSnippet || '',
        fullLyrics: (f as any).fullLyrics || []
      };
    });
    const existingSecure = currentState.secure.filter(s => !idSet.has(s.id));
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: filterFn(currentState.documents),
      images: filterFn(currentState.images),
      videos: filterFn(currentState.videos),
      audio: filterFn(currentState.audio),
      downloads: (currentState.downloads || []).filter(d => !idSet.has(d.id)) as any,
      recentFiles: filterFn(currentState.recentFiles),
      favorites: filterFn(currentState.favorites),
      secure: [...lockedItems, ...existingSecure],
    };
    persistToIndexedDB().catch(() => {});
    notify();
    invalidateCloudQueries.secure().catch(() => {});
    invalidateCloudQueries.all().catch(() => {});
  },

  restoreFromSecure(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const idSet = new Set(arr.map(f => f.id));
    const newSecure = currentState.secure.filter(s => !idSet.has(s.id));
    let newDocs = [...currentState.documents];
    let newImgs = [...currentState.images];
    let newVids = [...currentState.videos];
    let newAuds = [...currentState.audio];
    let newDls  = [...currentState.downloads];
    const updatedMap = { ...currentState.folderFilesMap };

    arr.forEach(file => {
      const origCat = (file as any).originalCategory || file.category;
      const meta = (file as any).metadata || {};
      const isAud = origCat === 'audio';
      const resolvedCover = (file as any).coverUrl
        || (file as any).thumbnailUrl
        || meta.coverUrl
        || meta.thumbnailUrl
        || (isAud && (file as any).previewUrl && !(file as any).previewUrl.startsWith('blob:') && !(file as any).previewUrl.includes('.mp3') ? (file as any).previewUrl : '')
        || '';

      const restored: any = {
        ...file,
        isSecure: false,
        category: origCat,
        coverUrl: isAud ? (resolvedCover || (file as any).coverUrl || undefined) : (file as any).coverUrl,
        thumbnailUrl: isAud ? (resolvedCover || (file as any).thumbnailUrl || undefined) : (file as any).thumbnailUrl,
        previewUrl: isAud ? (resolvedCover || (file as any).previewUrl || (file as any).url) : (file as any).previewUrl,
        artist: (file as any).artist || meta.artist || undefined,
        title: (file as any).title || meta.title || file.name,
        album: (file as any).album || meta.album || undefined,
        durationSec: (file as any).durationSec || meta.durationSec || 0,
        lyricsSnippet: (file as any).lyricsSnippet || meta.lyricsSnippet || '',
        fullLyrics: (file as any).fullLyrics || meta.fullLyrics || []
      };

      // Débloquer le fichier de studycloud_deleted_file_ids pour qu'il ne soit pas masqué
      try {
        const raw = localStorage.getItem('studycloud_deleted_file_ids');
        if (raw) {
          const arrIds: string[] = JSON.parse(raw);
          if (Array.isArray(arrIds) && arrIds.includes(file.id)) {
            const next = arrIds.filter(id => id !== file.id);
            localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(next));
          }
        }
      } catch {}

      if (origCat === 'classeur' && (file as any).originalFolderId && updatedMap[(file as any).originalFolderId]) {
        const fId = (file as any).originalFolderId;
        updatedMap[fId] = [restored, ...updatedMap[fId].filter(f => f.id !== file.id)];
      } else if (origCat === 'images') {
        newImgs = [restored, ...newImgs.filter(f => f.id !== file.id)];
      } else if (origCat === 'videos') {
        newVids = [restored, ...newVids.filter(f => f.id !== file.id)];
      } else if (origCat === 'audio') {
        newAuds = [restored, ...newAuds.filter(f => f.id !== file.id)];
      } else if (origCat === 'downloads') {
        newDls = [restored as any, ...newDls.filter(f => f.id !== file.id)];
      } else {
        newDocs = [restored, ...newDocs.filter(f => f.id !== file.id)];
      }
    });

    currentState = {
      ...currentState,
      secure: newSecure,
      documents: newDocs,
      images: newImgs,
      videos: newVids,
      audio: newAuds,
      downloads: newDls,
      folderFilesMap: updatedMap,
    };
    persistToIndexedDB().catch(() => {});
    notify();
    invalidateCloudQueries.secure().catch(() => {});
    invalidateCloudQueries.all().catch(() => {});
  },

  deleteSecureToTrash(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const idSet = new Set(arr.map(f => f.id));
    const newSecure = currentState.secure.filter(s => !idSet.has(s.id));
    const trashedItems = arr.map(f => ({
      ...f,
      isTrash: true,
      isFavorite: false,
      isSecure: false,
      sourceCategory: 'secure',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    }));
    const newTrash = [...trashedItems, ...currentState.trash.filter(t => !idSet.has(t.id))];

    currentState = {
      ...currentState,
      secure: newSecure,
      trash: newTrash,
    };
    persistToIndexedDB().catch(() => {});
    notify();
    invalidateCloudQueries.secure().catch(() => {});
    invalidateCloudQueries.trash().catch(() => {});
    invalidateCloudQueries.overview().catch(() => {});
  },

  removeFolder(folderId: string) {
    notifyFavoriteChange(folderId, false, 'classeur_folder');
    const childFiles = currentState.folderFilesMap[folderId] || [];
    childFiles.forEach(cf => notifyFavoriteChange(cf.id, false, cf.category));
    deletionListeners.forEach(fn => { try { fn(folderId, 'classeur_folder'); } catch {} });
    const updatedFolders = currentState.classeurFolders.filter(f => f.id !== folderId && f.parentId !== folderId);
    const updatedMap = { ...currentState.folderFilesMap };
    delete updatedMap[folderId];
    currentState = {
      ...currentState,
      classeurFolders: updatedFolders,
      folderFilesMap: updatedMap,
      favorites: currentState.favorites.filter(f => f.id !== folderId && !childFiles.some(cf => cf.id === f.id)),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  renameFolder(folderId: string, newName: string) {
    const updatedFolders = currentState.classeurFolders.map(f => f.id === folderId ? { ...f, name: newName } : f);
    currentState = {
      ...currentState,
      classeurFolders: updatedFolders,
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  toggleFavorite(itemId: string, isFav: boolean) {
    notifyFavoriteChange(itemId, isFav);
    const favSet = new Set(currentState.favIdSet);
    if (isFav) favSet.add(itemId);
    else favSet.delete(itemId);

    const updateFav = (list: FileItem[]) => list.map(f => f.id === itemId ? { ...f, isFavorite: isFav } : f);
    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = updateFav(updatedMap[k]);
    }
    const updatedFolders = (currentState.classeurFolders || []).map(f => 
      f.id === itemId ? { ...f, isFavorite: isFav } : f
    );
    const trashIds = new Set((currentState.trash || []).map(t => t.id));
    const allFiles = [
      ...updateFav(currentState.documents),
      ...updateFav(currentState.images),
      ...updateFav(currentState.videos),
      ...updateFav(currentState.audio),
      ...((currentState.downloads || []) as FileItem[]).map(f => f.id === itemId ? { ...f, isFavorite: isFav } : f),
      ...updatedFolders.map(cf => ({
        id: cf.id,
        name: cf.name,
        category: 'classeur' as const,
        size: 'Dossier 3D',
        date: 'Favori',
        isFolder: true,
        isFavorite: cf.isFavorite,
        metadata: {
          modelId: cf.modelId,
          primaryColor: cf.primaryColor,
          accentColor: cf.accentColor,
          iconName: cf.iconName,
          isFavorite: cf.isFavorite
        }
      } as any as FileItem)),
      ...Object.values(updatedMap).flat()
    ];
    currentState = {
      ...currentState,
      favIdSet: favSet,
      classeurFolders: updatedFolders,
      documents: updateFav(currentState.documents),
      images: updateFav(currentState.images),
      videos: updateFav(currentState.videos),
      audio: updateFav(currentState.audio),
      downloads: (currentState.downloads || []).map(f => f.id === itemId ? { ...f, isFavorite: isFav } : f) as any,
      folderFilesMap: updatedMap,
      favorites: allFiles.filter(f => (favSet.has(f.id) || Boolean(f.isFavorite)) && !trashIds.has(f.id) && !isItemDeleted(f.id)),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  togglePin(itemId: string, isPinned: boolean) {
    const pinSet = new Set(currentState.pinIdSet);
    if (isPinned) pinSet.add(itemId);
    else pinSet.delete(itemId);

    try {
      localStorage.setItem('studycloud_pinned_ids', JSON.stringify(Array.from(pinSet)));
    } catch {}

    const updatePin = (list: FileItem[]) => list.map(f => f.id === itemId ? { ...f, isPinned } : f);
    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = updatePin(updatedMap[k]);
    }
    currentState = {
      ...currentState,
      pinIdSet: pinSet,
      documents: updatePin(currentState.documents),
      images: updatePin(currentState.images),
      videos: updatePin(currentState.videos),
      audio: updatePin(currentState.audio),
      folderFilesMap: updatedMap,
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  dismissRecent(fileId: string) {
    if (!fileId) return;
    dismissedRecentSet.add(fileId);
    try {
      localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(dismissedRecentSet)));
    } catch {}
    currentState = {
      ...currentState,
      recentFiles: (currentState.recentFiles || []).filter(f => f.id !== fileId)
    };
    persistToIndexedDB().catch(() => {});
    notify();
    CloudStorageAPI.dismissRecent(fileId).catch(() => {});
  },

  async resetAndSyncForUser(userId: string): Promise<void> {
    dismissedRecentSet.clear();
    currentState = { ...defaultState };
    notify();
    await hydrateFromIndexedDB();
    notify();
    CloudStorageAPI.getDismissedRecents().then((ids) => {
      if (Array.isArray(ids) && ids.length > 0) {
        ids.forEach(id => dismissedRecentSet.add(id));
        currentState = {
          ...currentState,
          recentFiles: (currentState.recentFiles || []).filter(f => !dismissedRecentSet.has(f.id) && isRecentEligible(f))
        };
        notify();
      }
    }).catch(() => {});
    await this.sync(true);
  },

  async clearCache(): Promise<void> {
    const key = getCacheKey();
    dismissedRecentSet.clear();
    currentState = { ...defaultState };
    try { localStorage.removeItem(LS_FLAG_KEY); } catch {}
    const db = await openIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).delete(key);
        tx.objectStore(IDB_STORE_NAME).delete(IDB_CACHE_KEY);
        tx.objectStore(IDB_STORE_NAME).delete('guest_cache');
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      });
    }
    notify();
  },
};
