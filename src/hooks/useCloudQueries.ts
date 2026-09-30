import { useQuery, useMutation } from '@tanstack/react-query';
import { CloudStorageAPI, CloudOverviewData } from '../services/cloudStorageService';
import { QUERY_KEYS, invalidateCloudQueries } from '../services/queryClient';
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

export function useSecureList() {
  return useQuery<FileItem[]>({
    queryKey: QUERY_KEYS.secure,
    queryFn: async () => {
      const list = await CloudStorageAPI.getSecureFiles();
      return Array.isArray(list) ? list : [];
    },
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
