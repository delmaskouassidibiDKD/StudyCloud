import { useQuery, useMutation } from '@tanstack/react-query';
import { CloudStorageAPI, CloudOverviewData, UserWallpaper } from '../services/cloudStorageService';
import { QUERY_KEYS, invalidateCloudQueries, queryClient } from '../services/queryClient';
import { FileItem } from '../components/Page1FilesMenuView';
import { ClasseurCreatedFolder } from '../components/Folder3DModels';
import { DownloadedItem } from '../services/downloadsManager';
import { StudyCloudAPI } from '../services/api';
import { getCurrentUserId } from '../services/userSync';
import { getFileBlobUrl } from '../services/localFileStorage';
import { ImportedItem } from '../components/FilesMenuView';

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

/**
 * Hook TanStack Query pour la liste des fichiers de "Mes fichiers" :
 * - Cache réactif et synchronisation instantanée Hono/D1
 * - Hydratation locale sécurisée
 * - Zéro plantage QuotaExceededError car les fichiers volumineux restent en cache mémoire
 */
export function useFilesMenuList(userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return useQuery<ImportedItem[]>({
    queryKey: QUERY_KEYS.filesMenu(currentUid),
    queryFn: async () => {
      if (!currentUid || currentUid === 'default-user') return [];
      const res = await StudyCloudAPI.getFiles(currentUid, 'root', false);
      if (res && res.success && Array.isArray(res.data)) {
        const nonStudyRows = res.data.filter((row: any) => !row.is_study_session && !row.isStudyImport);
        const filesWithUrls: ImportedItem[] = await Promise.all(
          nonStudyRows.map(async (row: any) => {
            const localBlobUrl = await getFileBlobUrl(row.id);
            return {
              id: row.id,
              name: row.name,
              size: row.size || 0,
              type: row.type || 'Fichier',
              extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
              url: localBlobUrl || row.file_url || '',
              r2Key: row.r2_key,
              isFavorite: !!row.is_favorite,
              matiere: row.matiere_id && row.matiere_id !== 'Mes fichiers' && row.matiere_id !== 'root' ? row.matiere_id : '',
              importedAt: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
              createdAt: row.created_at,
              timestamp: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
              isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
            };
          })
        );
        return filesWithUrls;
      }
      return [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Hook TanStack Query pour la liste des fichiers d'une matière spécifique :
 * - Cache réactif et synchronisation automatique avec Cloudflare D1
 */
export function useMatiereFilesList(matiereName: string, userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return useQuery<ImportedItem[]>({
    queryKey: QUERY_KEYS.matiereFiles(matiereName, currentUid),
    queryFn: async () => {
      if (!matiereName || !currentUid || currentUid === 'default-user') return [];
      const res = await StudyCloudAPI.getFiles(currentUid, matiereName);
      if (res && res.success && Array.isArray(res.data)) {
        const filesWithUrls: ImportedItem[] = await Promise.all(
          res.data.map(async (row: any) => {
            const localBlobUrl = await getFileBlobUrl(row.id);
            return {
              id: row.id,
              name: row.name,
              size: row.size || 0,
              type: row.type || 'Fichier',
              extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
              url: localBlobUrl || row.file_url || '',
              r2Key: row.r2_key,
              isFavorite: !!row.is_favorite,
              matiere: row.matiere_id || matiereName,
              importedAt: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
              createdAt: row.created_at,
              timestamp: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
              isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
            };
          })
        );
        return filesWithUrls;
      }
      return [];
    },
    enabled: Boolean(matiereName),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Hook TanStack Query pour la liste des matières créées par l'utilisateur
 */
export function useMatieresList(userId?: string) {
  const currentUid = userId || getCurrentUserId() || 'default-user';
  return useQuery<Array<{ id: string; name: string; coefficient?: number | string; color?: string; category?: string }>>({
    queryKey: QUERY_KEYS.matieresList(currentUid),
    queryFn: async () => {
      const res = await StudyCloudAPI.getMatieres(currentUid);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook TanStack Query pour la configuration de l'emploi du temps (jours, heures, zoom)
 */
export function useScheduleConfig(userId?: string) {
  const currentUid = userId || getCurrentUserId() || 'default-user';
  return useQuery<{ days_json?: string; hours_json?: string; zoom_level?: number } | null>({
    queryKey: QUERY_KEYS.scheduleConfig(currentUid),
    queryFn: async () => {
      const res: any = await StudyCloudAPI.getScheduleConfig(currentUid);
      return res?.data || null;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Hook TanStack Query pour les créneaux réels de l'emploi du temps
 */
export function useScheduleSlots(userId?: string) {
  const currentUid = userId || getCurrentUserId() || 'default-user';
  return useQuery<Array<{ id: string; user_id: string; day: string; hour_slot: string; subject: string; room?: string; note_or_teacher?: string; color?: string }>>({
    queryKey: QUERY_KEYS.scheduleSlots(currentUid),
    queryFn: async () => {
      const res: any = await StudyCloudAPI.getScheduleSlots(currentUid);
      return res && res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Hook TanStack Query pour les notes du Bloc-notes (Keep notes) Cloudflare D1
 */
export function useNotesQuery(userId?: string) {
  const currentUid = userId || getCurrentUserId() || 'default-user';
  return useQuery<any[]>({
    queryKey: QUERY_KEYS.notes(currentUid),
    queryFn: async () => {
      const res: any = await StudyCloudAPI.getNotes(currentUid);
      return res && res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
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

