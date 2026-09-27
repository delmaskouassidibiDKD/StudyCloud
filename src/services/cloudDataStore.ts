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
  isUploading?: boolean;
  uploadProgress?: number;
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

// Hydratation async depuis IndexedDB (Tier 2)
async function hydrateFromIndexedDB(): Promise<boolean> {
  try {
    const parsed = await idbGet(IDB_CACHE_KEY);
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

// Persistance async dans IndexedDB (non-bloquant)
async function persistToIndexedDB(): Promise<void> {
  try {
    await idbSet(IDB_CACHE_KEY, {
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
        const [
          cloudOverview, favsData, pinnedData, folders,
          docs, imgs, vids, auds, dls, sec, trash
        ] = await Promise.all([
          CloudStorageAPI.getOverview().catch(() => null),
          CloudStorageAPI.getFavorites().catch(() => []),
          CloudStorageAPI.getPinned().catch(() => []),
          CloudStorageAPI.getClasseurFolders().catch(() => []),
          CloudStorageAPI.getDocumentsList().catch(() => []),
          CloudStorageAPI.getImagesList().catch(() => []),
          CloudStorageAPI.getVideosList().catch(() => []),
          CloudStorageAPI.getAudioList().catch(() => []),
          CloudStorageAPI.getDownloadsList().catch(() => []),
          CloudStorageAPI.getSecureFiles().catch(() => []),
          CloudStorageAPI.getTrashFiles().catch(() => []),
        ]);

        const favIdSet = new Set<string>((favsData || []).map((f: any) => f.item_id || f.id));
        const pinIdSet = new Set<string>((pinnedData || []).map((p: any) => p.item_id || p.id));

        const mappedFolders: ClasseurCreatedFolder[] = (folders || []).map((f: any) => ({
          ...f, isFavorite: favIdSet.has(f.id), isPinned: pinIdSet.has(f.id),
        }));

        const folderFilesEntries = await Promise.all(mappedFolders.map(async (folder) => {
          const files = await CloudStorageAPI.getClasseurFiles(folder.id).catch(() => []);
          return [folder.id, (files || []).map((file: any) => ({
            ...file, isFavorite: favIdSet.has(file.id), isPinned: pinIdSet.has(file.id),
          }))] as [string, FileItem[]];
        }));

        const folderFilesMap: Record<string, FileItem[]> = {};
        for (const [fId, files] of folderFilesEntries) folderFilesMap[fId] = files;

        const flag = (arr: any[]) => (arr || []).map((f: any) => ({
          ...f, isFavorite: favIdSet.has(f.id), isPinned: pinIdSet.has(f.id),
        }));

        const mappedDownloads: DownloadedItem[] = (dls || []).map((dl: any) => ({
          id: dl.id, name: dl.name, category: dl.category || 'downloads',
          size: dl.size || '0 o', sizeBytes: dl.sizeBytes,
          date: dl.date || dl.downloadedAt || "Aujourd'hui",
          timestamp: dl.timestamp || Date.now(),
          url: dl.url || dl.file_url,
          extension: dl.extension || (dl.name?.includes('.') ? dl.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
          type: dl.type, previewUrl: dl.previewUrl || dl.url,
          videoUrl: dl.videoUrl || dl.url, audioUrl: dl.audioUrl || dl.url,
          documentCategory: dl.documentCategory || 'COURS',
          isFavorite: favIdSet.has(dl.id), isPinned: pinIdSet.has(dl.id),
        }));

        const mappedDocs   = flag(docs);
        const mappedImages = flag(imgs);
        const mappedVideos = flag(vids);
        const mappedAudio  = flag(auds);

        const recentFiles: FileItem[] = cloudOverview?.recentFiles?.length
          ? cloudOverview.recentFiles
          : [...mappedDocs, ...mappedImages, ...mappedVideos, ...mappedAudio].slice(0, 6);

        const allFiles = [...mappedDocs, ...mappedImages, ...mappedVideos, ...mappedAudio, ...Object.values(folderFilesMap).flat()];

        currentState = {
          overview: cloudOverview,
          classeurFolders: mappedFolders, folderFilesMap,
          documents: mappedDocs, images: mappedImages, videos: mappedVideos,
          audio: mappedAudio, downloads: mappedDownloads,
          secure: flag(sec), trash: flag(trash),
          favorites: allFiles.filter(f => favIdSet.has(f.id)),
          favIdSet, pinIdSet, recentFiles,
          isLoaded: true, isSyncing: false, lastSyncTime: Date.now(),
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
    if (cat === 'classeur' && folderId) {
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
    const updateFn = (list: FileItem[]) => list.map(f => f.id === fileId ? { ...f, ...updates } : f);
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
    }
    currentState = {
      ...currentState,
      folderFilesMap: updatedMap,
      documents: filterFn(currentState.documents),
      images: filterFn(currentState.images),
      videos: filterFn(currentState.videos),
      audio: filterFn(currentState.audio),
      secure: filterFn(currentState.secure),
      recentFiles: filterFn(currentState.recentFiles),
    };
    persistToIndexedDB().catch(() => {});
    notify();
  },

  async clearCache(): Promise<void> {
    currentState = { ...defaultState };
    try { localStorage.removeItem(LS_FLAG_KEY); } catch {}
    const db = await openIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).delete(IDB_CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      });
    }
    notify();
  },
};
