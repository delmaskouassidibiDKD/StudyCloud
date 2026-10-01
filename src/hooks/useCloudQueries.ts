import { useQuery, useMutation } from '@tanstack/react-query';
import { CloudStorageAPI, CloudOverviewData, UserWallpaper } from '../services/cloudStorageService';
import { QUERY_KEYS, invalidateCloudQueries, queryClient } from '../services/queryClient';
import { FileItem } from '../components/Page1FilesMenuView';
import { ClasseurCreatedFolder } from '../components/Folder3DModels';
import { DownloadedItem } from '../services/downloadsManager';

// ─── HOOKS DE LECTURE (QUERIES) ────────────────────────────────────────────────

export function useAudioList() {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.audio,
    queryFn: async () => {
      const list = await CloudStorageAPI.getAudioList();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useVideosList() {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.videos,
    queryFn: async () => {
      const list = await CloudStorageAPI.getVideosList();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useImagesList() {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.images,
    queryFn: async () => {
      const list = await CloudStorageAPI.getImagesList();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useDocumentsList() {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.documents,
    queryFn: async () => {
      const list = await CloudStorageAPI.getDocumentsList();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useClasseurFolders() {
  return useQuery<ClasseurCreatedFolder[]>({
    queryKey: QUERY_KEYS.classeurFolders,
    queryFn: async () => {
      const list = await CloudStorageAPI.getClasseurFolders();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useClasseurFiles(folderId?: string) {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.classeurFiles(folderId),
    queryFn: async () => {
      const list = await CloudStorageAPI.getClasseurFiles(folderId);
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useFavoritesList() {
  return useQuery<{ favIds: string[]; items: FileItem[] }>({
    queryKey: QUERY_KEYS.favorites,
    queryFn: async () => {
      const res = await CloudStorageAPI.getFavoritesList();
      return res || { favIds: [], items: [] };
    },
  });
}

export function useTrashFiles() {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.trash,
    queryFn: async () => {
      const list = await CloudStorageAPI.getTrashFiles();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useDownloadsList() {
  return useQuery<DownloadedItem[]>({
    queryKey: QUERY_KEYS.downloads,
    queryFn: async () => {
      const list = await CloudStorageAPI.getDownloadsList();
      return (Array.isArray(list) ? list : []).map(f => ({
        ...f,
        timestamp: (f as any).timestamp || Date.now(),
      })) as DownloadedItem[];
    },
  });
}

export function useSecureList(options?: { enabled?: boolean }) {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.secure,
    queryFn: async () => {
      const list = await CloudStorageAPI.getSecureFiles();
      return Array.isArray(list) ? list : [];
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCloudOverview() {
  return useQuery<CloudOverviewData | null>({
    queryKey: QUERY_KEYS.overview,
    queryFn: async () => {
      return await CloudStorageAPI.getOverview();
    },
  });
}

/**
 * Hook TanStack Query pour le fond d'écran dédié du tableau de bord :
 * - Hydratation instantanée 0ms depuis le cache local (localStorage)
 * - Synchronisation en arrière-plan automatique avec Cloudflare D1 & R2
 * - Affichage universel et immédiat sur n'importe quel appareil connecté
 */
export function useDashboardWallpaper() {
  return useQuery<UserWallpaper | null>({
    queryKey: QUERY_KEYS.wallpaper,
    queryFn: async () => {
      const wp = await CloudStorageAPI.getWallpaper();
      if (wp && wp.url) {
        try {
          localStorage.setItem('studycloud_dashboard_wallpaper', wp.url);
          localStorage.setItem('studycloud_dashboard_wallpaper_meta', JSON.stringify(wp));
        } catch {}
      }
      return wp;
    },
    // Rendu instantané 0ms sans latence ni saut visuel
    initialData: () => {
      if (typeof window === 'undefined') return undefined;
      const cachedUrl = localStorage.getItem('studycloud_dashboard_wallpaper');
      if (!cachedUrl) return undefined;
      let meta: any = null;
      try {
        const raw = localStorage.getItem('studycloud_dashboard_wallpaper_meta');
        if (raw) meta = JSON.parse(raw);
      } catch {}
      return {
        id: meta?.id || 'cached_wallpaper',
        name: meta?.name || 'Fond d\'écran',
        url: cachedUrl,
        size: meta?.size || 0,
        isActive: true,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes de données valides en mémoire vive
  });
}

// ─── HOOKS DE MUTATION ──────────────────────────────────────────────────────────

export function useDeleteFileMutation() {
  return useMutation({
    mutationFn: async ({ id, category, folderId }: { id: string; category?: string; folderId?: string }) => {
      switch (category) {
        case 'audio':
          return await CloudStorageAPI.deleteAudio(id);
        case 'videos':
          return await CloudStorageAPI.deleteVideo(id);
        case 'images':
          return await CloudStorageAPI.deleteImage(id);
        case 'documents':
          return await CloudStorageAPI.deleteDocument(id);
        case 'classeur':
          return await CloudStorageAPI.deleteClasseurFile(id);
        case 'trash':
          return await CloudStorageAPI.deleteTrashPermanently([id]);
        default:
          return await CloudStorageAPI.deleteClasseurFile(id);
      }
    },
    onSuccess: (_, { category }) => {
      if (category === 'audio') invalidateCloudQueries.audio();
      else if (category === 'videos') invalidateCloudQueries.videos();
      else if (category === 'images') invalidateCloudQueries.images();
      else if (category === 'documents') invalidateCloudQueries.documents();
      else if (category === 'classeur') invalidateCloudQueries.classeurFiles();
      else if (category === 'trash') invalidateCloudQueries.trash();
      invalidateCloudQueries.overview();
      invalidateCloudQueries.favorites();
    },
  });
}

export function useDeleteFolderMutation() {
  return useMutation({
    mutationFn: async (folderId: string) => {
      return await CloudStorageAPI.deleteClasseurFolder(folderId);
    },
    onSuccess: () => {
      invalidateCloudQueries.classeurFolders();
      invalidateCloudQueries.overview();
    },
  });
}

/**
 * Mutation TanStack Query pour définir et synchroniser le fond d'écran du tableau de bord :
 * - Rendu optimiste immédiat (0ms) via localStorage et event local
 * - Enregistrement persistant dans la table D1 dédiée user_wallpapers et dossier R2 wallpapers
 * - Synchronisation inter-appareils instantanée
 */
export function useSetDashboardWallpaper() {
  return useMutation({
    mutationFn: async ({ url, name }: { url: string; name?: string }) => {
      // 1. Mise à jour optimiste locale immédiate (0ms)
      try {
        localStorage.setItem('studycloud_dashboard_wallpaper', url);
        window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: url } }));
      } catch {}

      // 2. Persistance dans le backend Hono/D1/R2
      const result = await CloudStorageAPI.saveWallpaper(url, name);
      return result;
    },
    onSuccess: (data) => {
      if (data?.wallpaper) {
        queryClient.setQueryData(QUERY_KEYS.wallpaper, data.wallpaper);
        try {
          localStorage.setItem('studycloud_dashboard_wallpaper', data.wallpaper.url);
          localStorage.setItem('studycloud_dashboard_wallpaper_meta', JSON.stringify(data.wallpaper));
        } catch {}
      }
      invalidateCloudQueries.wallpaper();
    },
  });
}

/**
 * Mutation TanStack Query pour réinitialiser le fond d'écran par défaut :
 * - Suppression optimiste instantanée (0ms)
 * - Mise à jour de la table D1 user_wallpapers et propagation réseau
 */
export function useResetDashboardWallpaper() {
  return useMutation({
    mutationFn: async () => {
      // 1. Réinitialisation optimiste locale immédiate (0ms)
      try {
        localStorage.removeItem('studycloud_dashboard_wallpaper');
        localStorage.removeItem('studycloud_dashboard_wallpaper_meta');
        window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: null } }));
      } catch {}

      // 2. Réinitialisation sur Cloudflare D1
      return await CloudStorageAPI.deleteWallpaper();
    },
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.wallpaper, null);
      invalidateCloudQueries.wallpaper();
    },
  });
}

