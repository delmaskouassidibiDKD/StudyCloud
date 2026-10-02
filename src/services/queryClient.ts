import { QueryClient } from '@tanstack/react-query';

/**
 * Configuration optimisée de TanStack Query pour StudyCloud :
 * - Cache volatile en mémoire ultra-léger (pas de fuite mémoire, pas de risque OOM)
 * - gcTime (garbage collection) : 5 minutes -> nettoie automatiquement les données inactives de la RAM
 * - staleTime : 2 minutes -> navigation instantanée entre les menus sans requêtes réseau redondantes
 * - refetchOnWindowFocus désactivé pour éviter la surcharge processeur et réseau
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes de données fraîches en RAM
      gcTime: 1000 * 60 * 5,    // 5 minutes avant nettoyage automatique du cache inactif
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export const QUERY_KEYS = {
  audio: ['cloud', 'audio'] as const,
  videos: ['cloud', 'videos'] as const,
  images: ['cloud', 'images'] as const,
  documents: ['cloud', 'documents'] as const,
  classeurFolders: ['cloud', 'classeur', 'folders'] as const,
  classeurFiles: (folderId?: string) => ['cloud', 'classeur', 'files', folderId || 'all'] as const,
  favorites: ['cloud', 'favorites'] as const,
  trash: ['cloud', 'trash'] as const,
  downloads: ['cloud', 'downloads'] as const,
  secure: ['cloud', 'secure'] as const,
  overview: ['cloud', 'overview'] as const,
  wallpaper: ['cloud', 'wallpaper'] as const,
  pinned: ['cloud', 'pinned'] as const,
  filesMenu: (userId?: string) => ['cloud', 'filesMenu', userId || 'current'] as const,
  matiereFiles: (matiereName: string, userId?: string) => ['cloud', 'matiereFiles', matiereName, userId || 'current'] as const,
  matieresList: (userId?: string) => ['cloud', 'matieresList', userId || 'current'] as const,
  scheduleConfig: (userId?: string) => ['cloud', 'scheduleConfig', userId || 'current'] as const,
  scheduleSlots: (userId?: string) => ['cloud', 'scheduleSlots', userId || 'current'] as const,
  notes: (userId?: string) => ['cloud', 'notes', userId || 'current'] as const,
};

export const invalidateCloudQueries = {
  audio: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.audio }),
  videos: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.videos }),
  images: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.images }),
  documents: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents }),
  classeurFolders: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classeurFolders }),
  classeurFiles: (folderId?: string) => queryClient.invalidateQueries({ queryKey: ['cloud', 'classeur', 'files'] }),
  favorites: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.favorites }),
  trash: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trash }),
  downloads: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.downloads }),
  secure: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.secure }),
  overview: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.overview }),
  wallpaper: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.wallpaper }),
  pinned: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pinned }),
  filesMenu: () => queryClient.invalidateQueries({ queryKey: ['cloud', 'filesMenu'] }),
  matiereFiles: (matiereName?: string) =>
    matiereName
      ? queryClient.invalidateQueries({ queryKey: ['cloud', 'matiereFiles', matiereName] })
      : queryClient.invalidateQueries({ queryKey: ['cloud', 'matiereFiles'] }),
  matieresList: () => queryClient.invalidateQueries({ queryKey: ['cloud', 'matieresList'] }),
  scheduleConfig: () => queryClient.invalidateQueries({ queryKey: ['cloud', 'scheduleConfig'] }),
  scheduleSlots: () => queryClient.invalidateQueries({ queryKey: ['cloud', 'scheduleSlots'] }),
  schedule: () => {
    queryClient.invalidateQueries({ queryKey: ['cloud', 'scheduleConfig'] });
    queryClient.invalidateQueries({ queryKey: ['cloud', 'scheduleSlots'] });
  },
  notes: () => queryClient.invalidateQueries({ queryKey: ['cloud', 'notes'] }),
  all: () => queryClient.invalidateQueries({ queryKey: ['cloud'] }),
};

