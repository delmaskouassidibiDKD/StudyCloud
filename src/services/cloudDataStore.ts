/**
 * StudyCloud - Magasin Global de Données & Cache Haute Performance (Architecture type Google Drive)
 * 
 * 1. Démarrage instantané (0 ms) : Charge immédiatement les données depuis la mémoire et le localStorage.
 * 2. Zéro blocage / Zéro écran gris : L'utilisateur voit ses fichiers et compteurs immédiatement.
 * 3. Synchronisation discrète en tâche de fond (Stale-While-Revalidate) avec timeout strict de 4 secondes.
 * 4. Déduplication des requêtes : Empêche le mitraillage réseau en boucle lors des changements d'onglets.
 * 5. Mises à jour optimistes : Les créations, suppressions et renommages sont visibles instantanément.
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

const CACHE_STORAGE_KEY = 'studycloud_data_cache_v2';
const SYNC_COOLDOWN_MS = 15000; // Ne pas re-synchroniser si fait il y a moins de 15s

// État initial vide par défaut
const defaultState: CloudDataState = {
  overview: null,
  classeurFolders: [],
  folderFilesMap: {},
  documents: [],
  images: [],
  videos: [],
  audio: [],
  downloads: [],
  secure: [],
  trash: [],
  favorites: [],
  favIdSet: new Set<string>(),
  pinIdSet: new Set<string>(),
  recentFiles: [],
  isLoaded: false,
  isSyncing: false,
  lastSyncTime: 0,
};

// Singleton en mémoire
let currentState: CloudDataState = { ...defaultState };
const listeners = new Set<(state: CloudDataState) => void>();
let inFlightSyncPromise: Promise<void> | null = null;

// Hydratation synchrone immédiate depuis le stockage local (0 milliseconde au chargement)
function hydrateFromLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      currentState = {
        ...currentState,
        overview: parsed.overview || null,
        classeurFolders: Array.isArray(parsed.classeurFolders) ? parsed.classeurFolders : [],
        folderFilesMap: parsed.folderFilesMap || {},
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        images: Array.isArray(parsed.images) ? parsed.images : [],
        videos: Array.isArray(parsed.videos) ? parsed.videos : [],
        audio: Array.isArray(parsed.audio) ? parsed.audio : [],
        downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
        secure: Array.isArray(parsed.secure) ? parsed.secure : [],
        trash: Array.isArray(parsed.trash) ? parsed.trash : [],
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        favIdSet: new Set(Array.isArray(parsed.favIds) ? parsed.favIds : []),
        pinIdSet: new Set(Array.isArray(parsed.pinIds) ? parsed.pinIds : []),
        recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles : [],
        isLoaded: true,
        lastSyncTime: Number(parsed.lastSyncTime) || 0,
      };
      return true;
    }
  } catch (e) {
    console.warn('[CloudDataStore] Hydrate parse error:', e);
  }
  return false;
}

// Sauvegarde synchrone vers le cache local
function persistToLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const serializable = {
      overview: currentState.overview,
      classeurFolders: currentState.classeurFolders,
      folderFilesMap: currentState.folderFilesMap,
      documents: currentState.documents,
      images: currentState.images,
      videos: currentState.videos,
      audio: currentState.audio,
      downloads: currentState.downloads,
      secure: currentState.secure,
      trash: currentState.trash,
      favorites: currentState.favorites,
      favIds: Array.from(currentState.favIdSet),
      pinIds: Array.from(currentState.pinIdSet),
      recentFiles: currentState.recentFiles,
      lastSyncTime: currentState.lastSyncTime,
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(serializable));
  } catch (e) {
    console.warn('[CloudDataStore] Persist error:', e);
  }
}

// Notifier tous les composants abonnés
function notify() {
  listeners.forEach(fn => {
    try {
      fn(currentState);
    } catch (e) {
      console.error('[CloudDataStore] Listener notification error:', e);
    }
  });
}

// Hydratation au chargement du module
hydrateFromLocalStorage();

export const CloudDataStore = {
  // Récupérer l'état actuel synchrone
  getState(): CloudDataState {
    return currentState;
  },

  // S'abonner aux changements d'état
  subscribe(listener: (state: CloudDataState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // Vérifier si des données existent déjà en cache
  hasData(): boolean {
    return currentState.isLoaded || currentState.documents.length > 0 || currentState.videos.length > 0 || currentState.images.length > 0 || currentState.classeurFolders.length > 0;
  },

  // Synchronisation en tâche de fond (Stale-While-Revalidate)
  async sync(force: boolean = false): Promise<void> {
    const now = Date.now();
    // Déduplication : si une synchronisation est déjà en cours, retourner la même promesse
    if (inFlightSyncPromise) {
      return inFlightSyncPromise;
    }

    // Cooldown : ne pas requêter le serveur si fait il y a moins de 15s (sauf demande explicite)
    if (!force && currentState.isLoaded && (now - currentState.lastSyncTime < SYNC_COOLDOWN_MS)) {
      return;
    }

    currentState = { ...currentState, isSyncing: true };
    notify();

    inFlightSyncPromise = (async () => {
      try {
        // Exécuter les requêtes distantes avec isolation par utilisateur et timeout 4s
        const [
          cloudOverview,
          favsData,
          pinnedData,
          folders,
          docs,
          imgs,
          vids,
          auds,
          dls,
          sec,
          trash
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
          CloudStorageAPI.getTrashFiles().catch(() => [])
        ]);

        const favIdSet = new Set((favsData || []).map((f: any) => f.item_id || f.id));
        const pinIdSet = new Set((pinnedData || []).map((p: any) => p.item_id || p.id));

        // Mapper les dossiers 3D
        const mappedFolders: ClasseurCreatedFolder[] = (folders || []).map(f => ({
          ...f,
          isFavorite: favIdSet.has(f.id),
          isPinned: pinIdSet.has(f.id),
        }));

        // Fichiers des dossiers du classeur (chargés avec timeout)
        const folderFilesEntries = await Promise.all(mappedFolders.map(async folder => {
          const files = await CloudStorageAPI.getClasseurFiles(folder.id).catch(() => []);
          const cleanFiles = (files || []).map(file => ({
            ...file,
            isFavorite: favIdSet.has(file.id),
            isPinned: pinIdSet.has(file.id)
          }));
          return [folder.id, cleanFiles] as [string, FileItem[]];
        }));

        const folderFilesMap: Record<string, FileItem[]> = {};
        for (const [folderId, files] of folderFilesEntries) {
          folderFilesMap[folderId] = files;
        }

        const mappedDocs: FileItem[] = (docs || []).map(d => ({
          ...d,
          isFavorite: favIdSet.has(d.id),
          isPinned: pinIdSet.has(d.id)
        }));

        const mappedImages: FileItem[] = (imgs || []).map(img => ({
          ...img,
          isFavorite: favIdSet.has(img.id),
          isPinned: pinIdSet.has(img.id)
        }));

        const mappedVideos: FileItem[] = (vids || []).map(v => ({
          ...v,
          isFavorite: favIdSet.has(v.id),
          isPinned: pinIdSet.has(v.id)
        }));

        const mappedAudio: FileItem[] = (auds || []).map(a => ({
          ...a,
          isFavorite: favIdSet.has(a.id),
          isPinned: pinIdSet.has(a.id)
        }));

        const mappedDownloads: DownloadedItem[] = (dls || []).map(dl => ({
          id: dl.id,
          name: dl.name,
          category: (dl.category as any) || 'downloads',
          size: dl.size || '0 o',
          sizeBytes: dl.sizeBytes,
          date: dl.date || (dl as any).downloadedAt || "Aujourd'hui",
          timestamp: dl.timestamp || Date.now(),
          url: dl.url || (dl as any).file_url,
          extension: dl.extension || (dl.name.includes('.') ? dl.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
          type: dl.type,
          previewUrl: dl.previewUrl || dl.url,
          videoUrl: dl.videoUrl || dl.url,
          audioUrl: dl.audioUrl || dl.url,
          documentCategory: dl.documentCategory || 'COURS',
          isFavorite: favIdSet.has(dl.id),
          isPinned: pinIdSet.has(dl.id),
        }));

        const mappedSecure: FileItem[] = (sec || []).map(s => ({
          ...s,
          isFavorite: favIdSet.has(s.id),
          isPinned: pinIdSet.has(s.id)
        }));

        const mappedTrash: FileItem[] = (trash || []).map(t => ({
          ...t,
          isFavorite: favIdSet.has(t.id),
          isPinned: pinIdSet.has(t.id)
        }));

        // Fichiers récents
        const recentFiles: FileItem[] = cloudOverview && Array.isArray(cloudOverview.recentFiles) && cloudOverview.recentFiles.length > 0
          ? cloudOverview.recentFiles
          : [...mappedDocs, ...mappedImages, ...mappedVideos, ...mappedAudio].slice(0, 6);

        // Fichiers favoris consolidés
        const allFiles = [
          ...mappedDocs,
          ...mappedImages,
          ...mappedVideos,
          ...mappedAudio,
          ...Object.values(folderFilesMap).flat()
        ];
        const favoriteFiles = allFiles.filter(f => favIdSet.has(f.id));

        // Mettre à jour l'état
        currentState = {
          overview: cloudOverview,
          classeurFolders: mappedFolders,
          folderFilesMap,
          documents: mappedDocs,
          images: mappedImages,
          videos: mappedVideos,
          audio: mappedAudio,
          downloads: mappedDownloads,
          secure: mappedSecure,
          trash: mappedTrash,
          favorites: favoriteFiles,
          favIdSet,
          pinIdSet,
          recentFiles,
          isLoaded: true,
          isSyncing: false,
          lastSyncTime: Date.now(),
        };

        // Sauvegarder dans le cache local
        persistToLocalStorage();
        notify();
      } catch (err) {
        console.warn('[CloudDataStore] Background sync warning:', err);
        currentState = { ...currentState, isLoaded: true, isSyncing: false };
        notify();
      } finally {
        inFlightSyncPromise = null;
      }
    })();

    return inFlightSyncPromise;
  },

  // Mises à jour optimistes (0 milliseconde pour l'utilisateur)
  setDocuments(docs: FileItem[]) {
    currentState = { ...currentState, documents: docs };
    persistToLocalStorage();
    notify();
  },

  setVideos(videos: FileItem[]) {
    currentState = { ...currentState, videos };
    persistToLocalStorage();
    notify();
  },

  setImages(images: FileItem[]) {
    currentState = { ...currentState, images };
    persistToLocalStorage();
    notify();
  },

  setAudio(audio: FileItem[]) {
    currentState = { ...currentState, audio };
    persistToLocalStorage();
    notify();
  },

  setDownloads(downloads: DownloadedItem[]) {
    currentState = { ...currentState, downloads };
    persistToLocalStorage();
    notify();
  },

  setClasseurFolders(folders: ClasseurCreatedFolder[]) {
    currentState = { ...currentState, classeurFolders: folders };
    persistToLocalStorage();
    notify();
  },

  setFolderFilesMap(map: Record<string, FileItem[]>) {
    currentState = { ...currentState, folderFilesMap: map };
    persistToLocalStorage();
    notify();
  },

  setTrashFiles(trash: FileItem[]) {
    currentState = { ...currentState, trash };
    persistToLocalStorage();
    notify();
  },

  setSecureFiles(secure: FileItem[]) {
    currentState = { ...currentState, secure };
    persistToLocalStorage();
    notify();
  },

  setRecentFiles(recent: FileItem[]) {
    currentState = { ...currentState, recentFiles: recent };
    persistToLocalStorage();
    notify();
  }
};
