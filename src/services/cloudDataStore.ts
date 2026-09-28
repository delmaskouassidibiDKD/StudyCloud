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

export interface FileItem {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  date: string;
  timestamp?: number;
  type?: string;
  category?: 'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'trash' | 'secure';
  originalCategory?: 'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'trash' | 'secure';
  url?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
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

function getLocallyDeletedFileIds(): Set<string> {
  try {
    const raw = localStorage.getItem('studycloud_deleted_file_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const validIds = arr.filter(item => typeof item === 'string' && !/\.[a-z0-9]{2,5}$/i.test(item));
        return new Set(validIds);
      }
    }
  } catch {}
  return new Set();
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

  hasData(): boolean {
    if (currentState.isLoaded) return true;
    if (currentState.documents.length > 0 || currentState.images.length > 0) return true;
    // Flag leger synchrone - sert a detecter si IndexedDB a des donnees avant hydratation
    try { return localStorage.getItem(LS_FLAG_KEY) === '1'; } catch {}
    return false;
  },

  whenReady(): Promise<void> { return hydrationComplete; },

  async sync(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (inFlightSyncPromise) return inFlightSyncPromise;
    if (!force && currentState.isLoaded && (now - currentState.lastSyncTime < SYNC_COOLDOWN_MS)) return;

    currentState = { ...currentState, isSyncing: true };
    notify();

    inFlightSyncPromise = (async () => {
      try {
        const locallyDeletedIds = getLocallyDeletedFileIds();
        const isNotLocallyDeleted = (f: any) => !locallyDeletedIds.has(f.id);

        const flag = (arr: any[]) => (arr || []).map((f: any) => ({
          ...f, isFavorite: currentState.favIdSet.has(f.id), isPinned: currentState.pinIdSet.has(f.id),
        }));

        // Préserver les fichiers optimistes locaux (en cours d'upload ou récemment créés) qui ne sont pas encore renvoyés par l'API
        const mergeOptimistic = (serverList: FileItem[] | null, currentList: FileItem[]) => {
          if (serverList === null) return currentList || [];
          const serverIds = new Set(serverList.map(s => s.id));
          const pending = (currentList || []).filter(c => 
            !serverIds.has(c.id) && 
            (c.isUploading || (c.id && c.id.startsWith('cf-')))
          );
          return [...pending, ...serverList];
        };

        const sortDesc = (a: any, b: any) => {
          const tA = a.timestamp || (a.date ? new Date(String(a.date).replace(' ', 'T')).getTime() : 0) || 0;
          const tB = b.timestamp || (b.date ? new Date(String(b.date).replace(' ', 'T')).getTime() : 0) || 0;
          return tB - tA;
        };

        // Recalcul des récents et favoris au fur et à mesure de l'arrivée des données
        const refreshDerived = () => {
          const allCurrent = [
            ...currentState.documents,
            ...currentState.images,
            ...currentState.videos,
            ...currentState.audio,
            ...Object.values(currentState.folderFilesMap).flat()
          ];
          if (!currentState.overview?.recentFiles || currentState.overview.recentFiles.length === 0) {
            currentState.recentFiles = allCurrent.sort(sortDesc).slice(0, 10);
          }
          currentState.favorites = allCurrent.filter(f => currentState.favIdSet.has(f.id));
        };

        // ── FLUX PARALLÈLES ET INDÉPENDANTS (HYDRATATION PROGRESSIVE) ─────────
        // Chaque flux se termine et met à jour l'UI instantanément sans attendre les autres

        const tasks: Promise<any>[] = [];

        // 1. Favoris & Épinglés
        tasks.push(
          CloudStorageAPI.getFavorites().then(favsData => {
            if (favsData !== null) {
              currentState.favIdSet = new Set<string>((favsData || []).map((f: any) => f.item_id || f.id));
              refreshDerived();
              notify();
            }
          }).catch(() => null)
        );

        tasks.push(
          CloudStorageAPI.getPinned().then(pinnedData => {
            if (pinnedData !== null) {
              currentState.pinIdSet = new Set<string>((pinnedData || []).map((p: any) => p.item_id || p.id));
              notify();
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
              currentState.classeurFolders = (folders || []).map((f: any) => ({
                ...f, isFavorite: currentState.favIdSet.has(f.id), isPinned: currentState.pinIdSet.has(f.id),
              }));
              currentState.isLoaded = true;
              notify();

              // Téléchargement progressif des fichiers de chaque dossier 3D
              await Promise.all(currentState.classeurFolders.map(async (folder) => {
                const files = await CloudStorageAPI.getClasseurFiles(folder.id).catch(() => null);
                if (files !== null) {
                  currentState.folderFilesMap[folder.id] = (files || []).map((file: any) => ({
                    ...file, isFavorite: currentState.favIdSet.has(file.id), isPinned: currentState.pinIdSet.has(file.id),
                  }));
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
                currentState.recentFiles = cloudOverview.recentFiles.filter(isNotLocallyDeleted) as any;
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
              currentState.trash = flag(trash).filter(isNotLocallyDeleted);
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

  setDocuments(docs: FileItem[])             { currentState = { ...currentState, documents: docs };         persistToIndexedDB().catch(() => {}); notify(); },
  setVideos(videos: FileItem[])              { currentState = { ...currentState, videos };                   persistToIndexedDB().catch(() => {}); notify(); },
  setImages(images: FileItem[])              { currentState = { ...currentState, images };                   persistToIndexedDB().catch(() => {}); notify(); },
  setAudio(audio: FileItem[])               { currentState = { ...currentState, audio };                    persistToIndexedDB().catch(() => {}); notify(); },
  setDownloads(downloads: DownloadedItem[]) { currentState = { ...currentState, downloads };                 persistToIndexedDB().catch(() => {}); notify(); },
  setClasseurFolders(folders: ClasseurCreatedFolder[]) { currentState = { ...currentState, classeurFolders: folders }; persistToIndexedDB().catch(() => {}); notify(); },
  setFolderFilesMap(map: Record<string, FileItem[]>)   { currentState = { ...currentState, folderFilesMap: map };      persistToIndexedDB().catch(() => {}); notify(); },
  setTrashFiles(trash: FileItem[])          { currentState = { ...currentState, trash };                    persistToIndexedDB().catch(() => {}); notify(); },
  setSecureFiles(secure: FileItem[])        { currentState = { ...currentState, secure };                   persistToIndexedDB().catch(() => {}); notify(); },
  setRecentFiles(recent: FileItem[])        { currentState = { ...currentState, recentFiles: recent };      persistToIndexedDB().catch(() => {}); notify(); },

  addOptimisticFile(file: FileItem, folderId?: string) {
    const cat = file.category || 'documents';
    const recent = [file, ...currentState.recentFiles.filter(f => f.id !== file.id)].slice(0, 6);
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

  updateFile(fileId: string, updates: Partial<FileItem>, folderId?: string) {
    const updateFn = (list: FileItem[]) => list.map(f => (f.id === fileId || (updates.id && f.id === updates.id)) ? { ...f, ...updates } : f);
    const updatedMap = { ...currentState.folderFilesMap };
    if (folderId && updatedMap[folderId]) {
      updatedMap[folderId] = updateFn(updatedMap[folderId]);
    } else {
      for (const k of Object.keys(updatedMap)) {
        updatedMap[k] = updateFn(updatedMap[k]);
      }
    }
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: updateFn(currentState.documents),
      images: updateFn(currentState.images),
      videos: updateFn(currentState.videos),
      audio: updateFn(currentState.audio),
      secure: updateFn(currentState.secure),
      trash: updateFn(currentState.trash),
      favorites: updateFn(currentState.favorites),
      recentFiles: updateFn(currentState.recentFiles),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  removeFile(fileId: string, folderId?: string) {
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

  moveToTrash(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const idSet = new Set(arr.map(f => f.id));
    const filterFn = (list: FileItem[]) => list.filter(f => !idSet.has(f.id));
    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = filterFn(updatedMap[k]);
    }
    const trashedItems = arr.map(f => ({ ...f, isTrash: true }));
    const existingTrash = currentState.trash.filter(t => !idSet.has(t.id));
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
      favorites: filterFn(currentState.favorites),
      trash: [...trashedItems, ...existingTrash],
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  restoreFromTrash(items: FileItem | FileItem[]) {
    const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (arr.length === 0) return;
    const idSet = new Set(arr.map(f => f.id));
    const newTrash = currentState.trash.filter(t => !idSet.has(t.id));
    let newDocs = [...currentState.documents];
    let newImgs = [...currentState.images];
    let newVids = [...currentState.videos];
    let newAuds = [...currentState.audio];
    let newDls  = [...currentState.downloads];
    const updatedMap = { ...currentState.folderFilesMap };

    arr.forEach(file => {
      const restored = { ...file, isTrash: false };
      if (file.originalFolderId && updatedMap[file.originalFolderId]) {
        updatedMap[file.originalFolderId] = [restored, ...updatedMap[file.originalFolderId].filter(f => f.id !== file.id)];
      } else if (file.category === 'images' || (file as any).isImage) {
        newImgs = [restored, ...newImgs.filter(f => f.id !== file.id)];
      } else if (file.category === 'videos' || !!file.videoUrl || (file as any).isVideo) {
        newVids = [restored, ...newVids.filter(f => f.id !== file.id)];
      } else if (file.category === 'audio' || !!file.audioUrl || (file as any).isAudio) {
        newAuds = [restored, ...newAuds.filter(f => f.id !== file.id)];
      } else if (file.category === 'downloads') {
        newDls = [restored as any, ...newDls.filter(f => f.id !== file.id)];
      } else {
        newDocs = [restored, ...newDocs.filter(f => f.id !== file.id)];
      }
    });

    currentState = {
      ...currentState,
      trash: newTrash,
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
    const updatedFolders = currentState.classeurFolders.filter(f => f.id !== folderId);
    const updatedMap = { ...currentState.folderFilesMap };
    delete updatedMap[folderId];
    currentState = {
      ...currentState,
      classeurFolders: updatedFolders,
      folderFilesMap: updatedMap,
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
    const favSet = new Set(currentState.favIdSet);
    if (isFav) favSet.add(itemId);
    else favSet.delete(itemId);

    const updateFav = (list: FileItem[]) => list.map(f => f.id === itemId ? { ...f, isFavorite: isFav } : f);
    const updatedMap = { ...currentState.folderFilesMap };
    for (const k of Object.keys(updatedMap)) {
      updatedMap[k] = updateFav(updatedMap[k]);
    }
    const allFiles = [
      ...updateFav(currentState.documents),
      ...updateFav(currentState.images),
      ...updateFav(currentState.videos),
      ...updateFav(currentState.audio),
      ...Object.values(updatedMap).flat()
    ];
    currentState = {
      ...currentState,
      favIdSet: favSet,
      documents: updateFav(currentState.documents),
      images: updateFav(currentState.images),
      videos: updateFav(currentState.videos),
      audio: updateFav(currentState.audio),
      folderFilesMap: updatedMap,
      favorites: allFiles.filter(f => favSet.has(f.id)),
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
