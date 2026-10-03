import { useQuery, useMutation } from '@tanstack/react-query';
import { CloudStorageAPI, CloudOverviewData, UserWallpaper } from '../services/cloudStorageService';
import { QUERY_KEYS, invalidateCloudQueries, queryClient } from '../services/queryClient';
import { FileItem } from '../components/Page1FilesMenuView';
import { ClasseurCreatedFolder } from '../components/Folder3DModels';
import { DownloadedItem } from '../services/downloadsManager';
import { StudyCloudAPI, getWorkerApiUrl } from '../services/api';
import { getCurrentUserId } from '../services/userSync';
import { getFileBlobUrl } from '../services/localFileStorage';
import { ImportedItem } from '../components/FilesMenuView';
import { SharedFolder } from '../types';
import { sanitizeFoldersForStorage } from '../utils/sanitizeFolders';

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
      const res = await StudyCloudAPI.getFiles(currentUid, 'all', false);
      if (res && res.success && Array.isArray(res.data)) {
        const nonStudyRows = res.data.filter((row: any) => !row.is_study_session && !row.isStudyImport);
        let matieresList: any[] = [];
        try {
          const raw = localStorage.getItem('unifolder_saved_matieres');
          if (raw) matieresList = JSON.parse(raw);
        } catch (_) {}

        const filesWithUrls: ImportedItem[] = await Promise.all(
          nonStudyRows.map(async (row: any) => {
            const localBlobUrl = await getFileBlobUrl(row.id);
            const mId = row.matiere_id && row.matiere_id !== 'Mes fichiers' && row.matiere_id !== 'root' ? row.matiere_id : '';
            const matchedMat = matieresList.find((m: any) => m.id === mId || m.name === mId);
            const matName = matchedMat ? matchedMat.name : (mId || '');
            const matUniqueId = matchedMat ? matchedMat.id : (mId || undefined);

            return {
              id: row.id,
              name: row.name,
              size: row.size || 0,
              type: row.type || 'Fichier',
              extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
              url: localBlobUrl || row.file_url || '',
              r2Key: row.r2_key,
              isFavorite: !!row.is_favorite,
              matiere: matName,
              matiereId: matUniqueId,
              folderName: matName || 'Mes fichiers',
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
      let matieresList: any[] = [];
      try {
        const raw = localStorage.getItem('unifolder_saved_matieres');
        if (raw) matieresList = JSON.parse(raw);
      } catch (_) {}
      const matchedMat = matieresList.find((m: any) => m.name === matiereName || m.id === matiereName);
      const queryId = matchedMat?.id || matiereName;

      const res = await StudyCloudAPI.getFiles(currentUid, queryId);
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
              matiere: matchedMat?.name || matiereName,
              matiereId: matchedMat?.id || undefined,
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
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return useQuery<Array<{ id: string; name: string; coefficient?: number | string; color?: string; category?: string }>>({
    queryKey: QUERY_KEYS.matieresList(currentUid),
    queryFn: async () => {
      if (!currentUid || currentUid === 'default-user') return [];
      const res = await StudyCloudAPI.getMatieres(currentUid);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },
    staleTime: 1000 * 60 * 2,
    enabled: Boolean(currentUid && currentUid !== 'default-user'),
  });
}

/**
 * Hook TanStack Query pour la configuration de l'emploi du temps (jours, heures, zoom)
 */
export function useScheduleConfig(userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return useQuery<{ days_json?: string; hours_json?: string; zoom_level?: number } | null>({
    queryKey: QUERY_KEYS.scheduleConfig(currentUid),
    queryFn: async () => {
      if (!currentUid || currentUid === 'default-user') return null;
      const res: any = await StudyCloudAPI.getScheduleConfig(currentUid);
      return res?.data || null;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    enabled: Boolean(currentUid && currentUid !== 'default-user'),
  });
}

/**
 * Hook TanStack Query pour les créneaux réels de l'emploi du temps
 */
export function useScheduleSlots(userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return useQuery<Array<{ id: string; user_id: string; day: string; hour_slot: string; subject: string; room?: string; note_or_teacher?: string; color?: string }>>({
    queryKey: QUERY_KEYS.scheduleSlots(currentUid),
    queryFn: async () => {
      if (!currentUid || currentUid === 'default-user') return [];
      const res: any = await StudyCloudAPI.getScheduleSlots(currentUid);
      return res && res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    enabled: Boolean(currentUid && currentUid !== 'default-user'),
  });
}

/**
 * Hook TanStack Query pour les notes du Bloc-notes (Keep notes) Cloudflare D1
 */
export function useNotesQuery(userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return useQuery<any[]>({
    queryKey: QUERY_KEYS.notes(currentUid),
    queryFn: async () => {
      if (!currentUid || currentUid === 'default-user') return [];
      const res: any = await StudyCloudAPI.getNotes(currentUid);
      return res && res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    enabled: Boolean(currentUid && currentUid !== 'default-user'),
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

/**
 * Hook TanStack Query pour les Liens Partagés (Dossiers partagés et liens de téléchargement) :
 * - Synchronisation automatique et réactive avec Cloudflare D1
 * - Hydratation instantanée 0ms depuis le cache local (localStorage)
 * - Refetch automatique au focus de la fenêtre (refetchOnWindowFocus) pour synchroniser entre appareils
 * - Réactivité instantanée sur toute mutation (création, suppression, modification de statut public)
 */
export function useUserShares(userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';

  return useQuery<SharedFolder[]>({
    queryKey: QUERY_KEYS.shares(currentUid),
    queryFn: async () => {
      const res = await StudyCloudAPI.getShares(currentUid || undefined);
      if (res && res.success && Array.isArray(res.data)) {
        const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
        const mapped: SharedFolder[] = res.data.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description || '',
          category: row.category || "Pas d'informations",
          author: row.author_name || 'Étudiant',
          school: row.school || '',
          country: row.country || "Côte d'Ivoire",
          createdAt: row.created_at || new Date().toISOString(),
          files: Array.isArray(row.files)
            ? row.files.map((f: any) => ({
                id: f.id || f.file_id || crypto.randomUUID(),
                name: f.name || f.fileName || f.title || 'Fichier',
                size: Number(f.size) || Number(f.sizeBytes) || 0,
                type: f.type || 'file',
                url: f.file_url || f.url || (f.r2_key ? `${baseUrl}/api/storage/file/${encodeURIComponent(f.r2_key)}` : ''),
                r2Key: f.r2_key || f.r2Key || undefined,
              }))
            : [],
          totalSize: Number(row.total_size) || 0,
          downloadsCount: Number(row.downloads_count) || 0,
          isPasswordProtected: Boolean(row.is_password_protected),
          password: row.password_hash || undefined,
          viewsCount: Number(row.views_count) || 0,
          shareCode: row.share_code,
          shareUrl: row.share_url || `${baseUrl}/s/${row.share_code || row.id}`,
          qrCodeData: row.qr_code_data,
          isPublic: Boolean(row.is_public),
          allowDownload: row.allow_download !== undefined ? Boolean(row.allow_download) : true,
        }));

        // Mettre à jour le cache local pour l'hydratation instantanée lors des prochaines ouvertures
        try {
          const sanitized = sanitizeFoldersForStorage(mapped);
          localStorage.setItem('unifolder_shares', JSON.stringify(sanitized));
        } catch (e) {
          console.warn('Erreur mise en cache locale unifolder_shares:', e);
        }

        return mapped;
      }
      return [];
    },
    // Hydratation 0ms depuis le stockage local si disponible
    initialData: () => {
      try {
        const saved = localStorage.getItem('unifolder_shares');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return undefined;
    },
    staleTime: 1000 * 20, // 20s de fraîcheur en RAM
    refetchOnWindowFocus: true, // Se synchronise dès qu'on change d'onglet, revient sur l'application ou l'appareil
    refetchOnReconnect: true,
  });
}

/**
 * Mutation TanStack Query pour supprimer un lien partagé :
 * - Suppression optimiste immédiate dans le cache
 * - Suppression sur le backend Cloudflare D1
 * - Revalidation automatique du cache des partages
 */
export function useDeleteShareMutation() {
  return useMutation({
    mutationFn: async (shareId: string) => {
      return await StudyCloudAPI.deleteShare(shareId);
    },
    onMutate: async (shareId: string) => {
      await queryClient.cancelQueries({ queryKey: ['cloud', 'shares'] });
      queryClient.setQueriesData<SharedFolder[]>({ queryKey: ['cloud', 'shares'] }, (old) => {
        if (!Array.isArray(old)) return [];
        return old.filter((f) => f.id !== shareId);
      });
    },
    onSettled: () => {
      invalidateCloudQueries.shares();
    },
  });
}

/**
 * Mutation TanStack Query pour changer le statut public / privé d'un lien :
 * - Mise à jour optimiste immédiate dans le cache TanStack
 * - Persistance dans Cloudflare D1
 * - Revalidation du cache
 */
export function useToggleSharePublicMutation() {
  return useMutation({
    mutationFn: async ({
      shareId,
      isPublic,
      description,
      allowDownload = true,
    }: {
      shareId: string;
      isPublic: boolean;
      description?: string;
      allowDownload?: boolean;
    }) => {
      return await StudyCloudAPI.toggleSharePublic(shareId, isPublic, description, allowDownload);
    },
    onMutate: async ({ shareId, isPublic, description, allowDownload }) => {
      await queryClient.cancelQueries({ queryKey: ['cloud', 'shares'] });
      queryClient.setQueriesData<SharedFolder[]>({ queryKey: ['cloud', 'shares'] }, (old) => {
        if (!Array.isArray(old)) return [];
        return old.map((f) => {
          if (f.id !== shareId) return f;
          return {
            ...f,
            isPublic,
            description: description !== undefined ? description : f.description,
            allowDownload: allowDownload !== undefined ? allowDownload : f.allowDownload,
          };
        });
      });
    },
    onSettled: () => {
      invalidateCloudQueries.shares();
    },
  });
}

export interface StagingShareItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  r2Key?: string;
  isImage?: boolean;
}

/**
 * Hook TanStack Query pour le Menu Importer / Partage (Fichiers en staging) :
 * - Charge les fichiers directement depuis Cloudflare D1 (aucun fichier coincé en local)
 * - Synchronisation multi-appareils automatique en temps réel dès la connexion
 * - staleTime 20s en mémoire, refetch automatique sur changement d'onglet ou retour sur l'appareil
 */
export function useStagingShareFiles(userId?: string) {
  const currentUid = userId || getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';

  return useQuery<StagingShareItem[]>({
    queryKey: QUERY_KEYS.stagingShareFiles(currentUid),
    queryFn: async () => {
      if (!currentUid || currentUid === 'default-user' || currentUid === 'user_anonymous') return [];
      const res = await StudyCloudAPI.getStagingShareFiles(currentUid);
      if (res && res.success && Array.isArray(res.files)) {
        const originUrl = getWorkerApiUrl().replace(/\/+$/, '');
        return res.files.map((row: any) => {
          const r2Key = row.r2_key || row.r2Key;
          let fileUrl = row.file_url || row.url;
          if ((!fileUrl || fileUrl.includes('localhost') || fileUrl.startsWith('blob:')) && r2Key) {
            fileUrl = `${originUrl}/api/storage/file/${encodeURIComponent(r2Key)}`;
          }
          const isImg = row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(row.name || '');
          return {
            id: row.id || row.file_id,
            name: row.name,
            size: Number(row.size) || 0,
            type: row.type || 'file',
            url: fileUrl || undefined,
            r2Key,
            isImage: isImg,
          };
        });
      }
      return [];
    },
    enabled: Boolean(currentUid && currentUid !== 'default-user' && currentUid !== 'user_anonymous'),
    staleTime: 1000 * 20, // 20s de fraîcheur en RAM
    refetchOnWindowFocus: true, // Se synchronise dès qu'on change d'appareil ou d'onglet
    refetchOnReconnect: true,
  });
}

/**
 * Mutation TanStack Query pour supprimer des fichiers temporaires du Menu Importer :
 * - Supprime dans la staging Cloudflare D1 et purge R2 si orphelin
 * - Revalide immédiatement le cache TanStack pour synchroniser tous les appareils
 */
export function useDeleteStagingShareFilesMutation() {
  return useMutation({
    mutationFn: async ({ userId, ids, r2Keys }: { userId: string; ids?: string[]; r2Keys?: string[] }) => {
      return await StudyCloudAPI.deleteStagingShareFiles(userId, ids, r2Keys);
    },
    onSettled: () => {
      invalidateCloudQueries.stagingShareFiles();
    },
  });
}



