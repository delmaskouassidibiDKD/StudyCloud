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

export interface FileItem {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  date: string;
  timestamp?: number;
  type?: string;
  category?: 'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'trash' | 'secure' | 'folder' | 'classeur_folder' | 'apps' | string;
  originalCategory?: 'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'trash' | 'secure' | 'folder' | 'classeur_folder' | 'apps' | string;
  url?: string;
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
  const uid = getCurrentUserId();
  return uid ? `cloud_data_cache_${uid}` : IDB_CACHE_KEY;
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
  if (!file) return false;
  if (file.isNotepad) return false;
  if (file.category === 'notes') return false;
  const ext = (file.extension || (file.name ? file.name.split('.').pop() : '') || '').toLowerCase();
  if (ext === 'txt') return false;
  if (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.txt')) return false;
  if (file.type === 'text/plain') return false;
  return true;
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

// Hydratation async depuis IndexedDB (Tier 2 avec isolation utilisateur)
async function hydrateFromIndexedDB(): Promise<boolean> {
  try {
    const key = getCacheKey();
    let parsed = await idbGet(key);
    if (!parsed && key !== IDB_CACHE_KEY) {
      parsed = await idbGet(IDB_CACHE_KEY);
    }
    if (parsed && typeof parsed === 'object') {
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
        recentFiles:     Array.isArray(parsed.recentFiles)     ? parsed.recentFiles     : [],
        isLoaded:        true,
        lastSyncTime:    Number(parsed.lastSyncTime) || 0,
      };
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
          if (typeof item === 'string' && !/\.[a-z0-9]{2,5}$/i.test(item)) {
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

export function isItemDeleted(id: string): boolean {
  if (!id) return false;
  // Si l'élément est actuellement actif dans le store local (hors corbeille), il n'est JAMAIS supprimé
  if (currentState.documents.some(d => d.id === id)) return false;
  if (currentState.images.some(i => i.id === id)) return false;
  if (currentState.videos.some(v => v.id === id)) return false;
  if (currentState.audio.some(a => a.id === id)) return false;
  if (currentState.classeurFolders.some(f => f.id === id)) return false;
  if ((currentState.downloads || []).some((d: any) => d.id === id)) return false;
  if (Object.values(currentState.folderFilesMap).some(list => list.some(f => f.id === id))) return false;

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
          const pending = (currentList || []).filter(c => 
            !serverIds.has(c.id) && 
            Boolean(c.isUploading) &&
            !isItemDeleted(c.id)
          );
          return [...pending, ...serverList.filter(s => !isItemDeleted(s.id))];
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
          if (currentState.overview?.recentFiles && currentState.overview.recentFiles.length > 0) {
            currentState.recentFiles = currentState.overview.recentFiles.filter(isRecentEligible).slice(0, 6);
          } else if (currentState.recentFiles && currentState.recentFiles.length > 0) {
            currentState.recentFiles = currentState.recentFiles.filter(isRecentEligible).slice(0, 6);
          }
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
              if (cloudOverview.recentFiles && Array.isArray(cloudOverview.recentFiles) && cloudOverview.recentFiles.length > 0) {
                currentState.recentFiles = cloudOverview.recentFiles.filter(isNotLocallyDeleted).filter(isRecentEligible).slice(0, 6) as any;
              }
              notify();
              persistToIndexedDB().catch(() => {});
            }
          }).catch(() => null)
        );

        // 9. Sécurisé & Corbeille
        tasks.push(
          CloudStorageAPI.getSecureFiles().then(sec => {
            if (sec !== null) {
              currentState.secure = flag(sec);
              notify();
            }
          }).catch(() => null)
        );

        tasks.push(
          CloudStorageAPI.getTrashFiles().then(trash => {
            if (trash !== null) {
              currentState.trash = flag(trash);
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
    const serverIds = new Set(docs.map(s => s.id));
    const pending = (currentState.documents || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading));
    currentState = { ...currentState, documents: [...pending, ...docs] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setVideos(videos: FileItem[]) {
    const serverIds = new Set(videos.map(s => s.id));
    const pending = (currentState.videos || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading));
    currentState = { ...currentState, videos: [...pending, ...videos] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setImages(images: FileItem[]) {
    const serverIds = new Set(images.map(s => s.id));
    const pending = (currentState.images || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading));
    currentState = { ...currentState, images: [...pending, ...images] };
    persistToIndexedDB().catch(() => {});
    notify();
  },
  setAudio(audio: FileItem[]) {
    const serverIds = new Set(audio.map(s => s.id));
    const pending = (currentState.audio || []).filter(c => !serverIds.has(c.id) && Boolean(c.isUploading));
    currentState = { ...currentState, audio: [...pending, ...audio] };
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
  setFolderFilesMap(map: Record<string, FileItem[]>)   { currentState = { ...currentState, folderFilesMap: map };      persistToIndexedDB().catch(() => {}); notify(); },
  setTrashFiles(trash: FileItem[])          { currentState = { ...currentState, trash };                    persistToIndexedDB().catch(() => {}); notify(); },
  setSecureFiles(secure: FileItem[])        { currentState = { ...currentState, secure };                   persistToIndexedDB().catch(() => {}); notify(); },
  setRecentFiles(recent: FileItem[])        { currentState = { ...currentState, recentFiles: recent };      persistToIndexedDB().catch(() => {}); notify(); },

  addOptimisticFile(file: FileItem, folderId?: string) {
    const cat = file.category || 'documents';
    const isEligible = isRecentEligible(file);
    const recent = isEligible
      ? [file, ...currentState.recentFiles.filter(f => f.id !== file.id)].slice(0, 6)
      : currentState.recentFiles;
    if (folderId) {
      const currentList = currentState.folderFilesMap[folderId] || [];
      currentState = {
        ...currentState,
        recentFiles: recent,
        folderFilesMap: {
          ...currentState.folderFilesMap,
          [folderId]: [file, ...currentList.filter(f => f.id !== file.id)]
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
    } else {
      currentState = {
        ...currentState,
        recentFiles: recent,
        documents: [file, ...currentState.documents.filter(f => f.id !== file.id)]
      };
    }
    persistToIndexedDB().catch(() => {});
    notify();
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

    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: updateFn(currentState.documents),
      images: updateFn(currentState.images),
      videos: updateFn(currentState.videos),
      audio: updateFn(currentState.audio),
      secure: updateFn(currentState.secure),
      trash: updateFn(currentState.trash),
      favorites: allCurrentCandidates.filter(f => currentState.favIdSet.has(f.id) || Boolean(f.isFavorite)),
      recentFiles: updateFn(currentState.recentFiles),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  removeFile(fileId: string, folderId?: string) {
    notifyFavoriteChange(fileId, false);
    deletionListeners.forEach(fn => { try { fn(fileId); } catch {} });
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

  removeFiles(fileIds: string[]) {
    if (!fileIds || fileIds.length === 0) return;
    fileIds.forEach(id => {
      notifyFavoriteChange(id, false);
      deletionListeners.forEach(fn => { try { fn(id); } catch {} });
    });
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

  removeFileFromCategory(fileId: string, category?: string, folderId?: string) {
    notifyFavoriteChange(fileId, false, category);
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
      favorites: filterFn(currentState.favorites),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  permanentlyRemoveTrashFile(fileId: string) {
    currentState = {
      ...currentState,
      trash: currentState.trash.filter(f => f.id !== fileId),
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
    arr.forEach(f => {
      notifyFavoriteChange(f.id, false, f.category);
      if (f.category === 'classeur_folder' || f.category === 'folder' || (f as any).model) {
        const childFiles = currentState.folderFilesMap[f.id] || [];
        childFiles.forEach(cf => notifyFavoriteChange(cf.id, false, cf.category));
      }
    });

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
      classeurFolders: currentState.classeurFolders.map(cf => idSet.has(cf.id) ? { ...cf, isFavorite: false } : cf),
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
    const lockedItems = arr.map(f => ({ ...f, isSecure: true }));
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
      const restored = { ...file, isSecure: false, category: origCat };
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

  async resetAndSyncForUser(userId: string): Promise<void> {
    currentState = { ...defaultState };
    notify();
    await hydrateFromIndexedDB();
    notify();
    await this.sync(true);
  },

  async clearCache(): Promise<void> {
    const key = getCacheKey();
    currentState = { ...defaultState };
    try { localStorage.removeItem(LS_FLAG_KEY); } catch {}
    const db = await openIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).delete(key);
        tx.objectStore(IDB_STORE_NAME).delete(IDB_CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      });
    }
    notify();
  },
};
