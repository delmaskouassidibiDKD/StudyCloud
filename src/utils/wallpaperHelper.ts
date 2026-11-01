/**
 * StudyCloud - Assistant Universel de Gestion du Fond d'Écran & Photo de Profil
 * 
 * Synchronisation Multi-Appareils & Architecture Local-First :
 * 1. 0ms instantané : Une fois chargée ou définie, l'image reste stockée en local
 *    (IndexedDB + localStorage) et ne se re-télécharge JAMAIS à chaque visite
 *    tant que l'utilisateur ne la remplace pas par une autre.
 * 2. Multi-Appareils : Lorsqu'on se connecte avec un autre téléphone, tablette ou navigateur,
 *    l'application détecte automatiquement le fond d'écran actif dans Cloudflare D1/R2,
 *    le télécharge UNE SEULE FOIS, le sauvegarde en local dans ce nouvel appareil,
 *    et l'affiche instantanément comme fond d'écran et photo de profil.
 * 3. Remplacement universel : Si l'utilisateur choisit une autre image sur n'importe quel appareil,
 *    la nouvelle prend immédiatement sa place localement et dans le cloud.
 */

import { CloudStorageAPI, UserWallpaper } from '../services/cloudStorageService';
import { getFileBlob, storeThumbnailData, getThumbnailData } from '../services/localFileStorage';
import { invalidateCloudQueries } from '../services/queryClient';

export const LS_WALLPAPER_KEY = 'studycloud_dashboard_wallpaper';
export const LS_WALLPAPER_META = 'studycloud_dashboard_wallpaper_meta';
export const LS_WALLPAPER_ID_KEY = 'studycloud_dashboard_wallpaper_id';
export const IDB_WALLPAPER_KEY = 'active_wallpaper';

export const DEFAULT_WALLPAPER_URL = '/wallpapers/wallpaper-beach.jpg';

export interface PresetWallpaperItem {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  isDefault?: boolean;
}

export const PRESET_WALLPAPERS: PresetWallpaperItem[] = [
  {
    id: 'beach',
    name: 'Rivage Turquoise',
    subtitle: 'Eau cristalline et sable blanc paradisiaque',
    url: '/wallpapers/wallpaper-beach.jpg',
    isDefault: true,
  },
  {
    id: 'dna',
    name: 'Hélice ADN Cosmique',
    subtitle: 'Thème Signature StudyCloud — Néon bleu & étoiles',
    url: '/wallpapers/wallpaper-dna.jpg',
    isDefault: false,
  },
  {
    id: 'nebula',
    name: 'Nébuleuse Étoilée',
    subtitle: 'Galaxie rougeoyante et poussières d’étoiles',
    url: '/wallpapers/wallpaper-nebula.jpg',
    isDefault: false,
  },
  {
    id: 'aurora',
    name: 'Aurore Boréale Boréalis',
    subtitle: 'Lueurs nordiques vert émeraude et cimes enneigées',
    url: '/wallpapers/wallpaper-aurora.jpg',
    isDefault: false,
  },
  {
    id: 'abstract-dark',
    name: 'Abstrait Minimaliste OLED',
    subtitle: 'Sphères sombres élégantes et lignes rouge vif',
    url: '/wallpapers/wallpaper-abstract-dark.svg',
    isDefault: false,
  },
];

/**
 * Convertit n'importe quelle source d'image (Blob, File, URL blob:, ID IndexedDB)
 * en une chaîne base64 data:image/jpeg permanente et optimisée (max 1920px)
 */
export async function convertToWallpaperDataUrl(
  input: string | Blob | File,
  fileId?: string
): Promise<string> {
  let blob: Blob | null = null;

  if (input instanceof Blob) {
    blob = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('data:image')) {
      return input;
    }

    // Essayer d'abord de récupérer le vrai binaire depuis IndexedDB si on a un fileId
    if (fileId) {
      try {
        const idbBlob = await getFileBlob(fileId);
        if (idbBlob) blob = idbBlob;
      } catch {}
    }

    // Si pas trouvé dans IndexedDB et que l'URL est accessible, tenter un fetch
    if (!blob && input) {
      try {
        const resp = await fetch(input, { mode: 'cors' });
        if (resp.ok) {
          blob = await resp.blob();
        }
      } catch (e) {
        console.warn('[WallpaperHelper] fetch image error:', e);
      }
    }
  }

  if (!blob) {
    // Si c'est déjà une URL HTTP valide distante, la retourner
    if (typeof input === 'string' && input.startsWith('http') && !input.startsWith('blob:') && !input.includes('localhost')) {
      return input;
    }
    throw new Error('Impossible de charger le contenu binaire de l\'image');
  }

  // Redimensionner et compresser l'image via un Canvas pour un affichage fluide 0ms
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1920;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Erreur lecture FileReader'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Enregistre localement le fond d'écran et la photo de profil (IndexedDB + localStorage)
 * et déclenche les événements de synchronisation réactive instantanée (0ms).
 */
export async function cacheWallpaperLocally(
  imageUrlOrDataUrl: string,
  meta?: { id?: string; name?: string; url?: string; size?: number }
): Promise<void> {
  if (!imageUrlOrDataUrl) return;

  try {
    localStorage.setItem(LS_WALLPAPER_KEY, imageUrlOrDataUrl);
    localStorage.setItem('unifolder_user_avatar', imageUrlOrDataUrl);
    if (meta?.id) {
      localStorage.setItem(LS_WALLPAPER_ID_KEY, String(meta.id));
    }
    if (meta) {
      localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(meta));
    }
  } catch (err) {
    console.warn('[WallpaperHelper] localStorage quota warning:', err);
  }

  // Sauvegarde dans IndexedDB (capacité illimitée pour offline et sécurité)
  if (imageUrlOrDataUrl.startsWith('data:image')) {
    await storeThumbnailData(IDB_WALLPAPER_KEY, imageUrlOrDataUrl).catch(() => {});
  }

  // Événements réactifs pour rafraîchir l'écran instantanément
  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: imageUrlOrDataUrl } }));
  window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: imageUrlOrDataUrl } }));
}

/**
 * Définit et synchronise le fond d'écran et la photo de profil :
 * 1. Application optimiste instantanée (0ms)
 * 2. Compression optimisée max 1920px
 * 3. Enregistrement local permanent (IndexedDB + localStorage)
 * 4. Sauvegarde dans Cloudflare D1/R2 pour synchronisation universelle multi-appareils
 */
export async function applyDashboardWallpaper(
  source: string | Blob | File,
  name?: string,
  fileId?: string
): Promise<string> {
  // Cas d'un thème préconfiguré officiel (/wallpapers/...)
  if (typeof source === 'string' && source.startsWith('/wallpapers/')) {
    const presetId = `preset:${source.replace('/wallpapers/wallpaper-', '').replace(/\.[^.]+$/, '')}`;
    await cacheWallpaperLocally(source, { id: presetId, name: name || 'Thème officiel', url: source });
    CloudStorageAPI.saveWallpaper(source, name || 'Thème officiel')
      .then((res) => {
        if (res?.wallpaper?.id) {
          try {
            localStorage.setItem(LS_WALLPAPER_ID_KEY, String(res.wallpaper.id));
            localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(res.wallpaper));
          } catch {}
        }
        invalidateCloudQueries.wallpaper().catch(() => {});
      })
      .catch((err) => console.warn('[WallpaperHelper] Preset saveWallpaper sync:', err));
    return source;
  }

  // 1. APPLICATION OPTIMISTE INSTANTANÉE (0ms) :
  let immediateSource = '';
  if (typeof source === 'string' && source) {
    immediateSource = source;
  } else if (source instanceof Blob) {
    try {
      immediateSource = URL.createObjectURL(source);
    } catch {}
  }

  if (!immediateSource && fileId) {
    try {
      const b = await getFileBlob(fileId);
      if (b) immediateSource = URL.createObjectURL(b);
    } catch {}
  }

  if (immediateSource) {
    try {
      localStorage.setItem(LS_WALLPAPER_KEY, immediateSource);
      localStorage.setItem('unifolder_user_avatar', immediateSource);
    } catch {}
    window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: immediateSource } }));
    window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: immediateSource } }));
  }

  // 2. Traitement d'optimisation et persistance en tâche de fond (asynchrone, non bloquant)
  const backgroundSync = async () => {
    try {
      let persistentData = '';
      try {
        persistentData = await convertToWallpaperDataUrl(source || immediateSource, fileId);
      } catch (err) {
        console.warn('[WallpaperHelper] Erreur conversion dataURL, fallback direct:', err);
        if (typeof source === 'string' && source) persistentData = source;
      }

      if (!persistentData && immediateSource) {
        persistentData = immediateSource;
      }

      if (persistentData) {
        // Enregistre localement le binaire pour un affichage 0ms permanent
        await cacheWallpaperLocally(persistentData, {
          name: name || 'Fond d\'écran personnalisé',
          url: persistentData
        });

        // Téléversement vers Cloudflare R2 / D1 pour la synchronisation multi-appareils
        const res = await CloudStorageAPI.saveWallpaper(persistentData, name || 'Fond d\'écran personnalisé');
        if (res?.success && res.wallpaper?.id) {
          try {
            localStorage.setItem(LS_WALLPAPER_ID_KEY, String(res.wallpaper.id));
            localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(res.wallpaper));
          } catch {}
          invalidateCloudQueries.wallpaper().catch(() => {});
        }
      }
    } catch (bgErr) {
      console.warn('[WallpaperHelper] Synchronisation arrière-plan:', bgErr);
    }
  };

  backgroundSync();
  return immediateSource || (typeof source === 'string' ? source : '');
}

/**
 * Synchronise et met en cache un fond d'écran reçu du Cloud (D1/R2) :
 * - Si le fond d'écran actif correspond DÉJÀ à ce qui est en local : 0ms, pas de re-téléchargement !
 * - Si c'est un NOUVEAU téléphone ou navigateur :
 *     1. Affiche immédiatement l'image distante
 *     2. Télécharge le binaire UNE FOIS en arrière-plan
 *     3. L'enregistre dans IndexedDB & localStorage pour les prochaines visites (0ms)
 * - Si l'utilisateur en a choisi un autre : remplace l'ancien localement.
 */
export async function syncAndCacheCloudWallpaper(
  cloudWp: { id: string; url: string; name?: string; size?: number } | null
): Promise<string> {
  // Cas où aucun fond d'écran personnalisé n'est configuré sur le compte
  if (!cloudWp || !cloudWp.url) {
    const currentId = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_ID_KEY) : null;
    if (currentId && !currentId.startsWith('preset:beach')) {
      try {
        localStorage.removeItem(LS_WALLPAPER_KEY);
        localStorage.removeItem(LS_WALLPAPER_META);
        localStorage.removeItem(LS_WALLPAPER_ID_KEY);
      } catch {}
      window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: DEFAULT_WALLPAPER_URL } }));
    }
    return DEFAULT_WALLPAPER_URL;
  }

  const cloudId = String(cloudWp.id);
  const cloudUrl = String(cloudWp.url);

  // Vérifier si le navigateur actuel a déjà cette image en mémoire locale
  const localId = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_ID_KEY) : null;
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_KEY) : null;

  // Si l'ID distant correspond exactement à l'ID local et qu'on a déjà l'image locale valide :
  // NE PAS RE-TÉLÉCHARGER ! L'image reste en local et se charge en 0ms.
  if (localId === cloudId && localUrl && !localUrl.startsWith('blob:')) {
    return localUrl;
  }

  // Cas des thèmes officiels intégrés (/wallpapers/...)
  if (cloudUrl.startsWith('/wallpapers/')) {
    await cacheWallpaperLocally(cloudUrl, cloudWp);
    return cloudUrl;
  }

  // NOUVEL APPAREIL OU NOUVELLE IMAGE CHOISIE SUR UN AUTRE TÉLÉPHONE :
  // 1. Affichage immédiat pour ne pas faire attendre l'utilisateur
  try {
    localStorage.setItem(LS_WALLPAPER_KEY, cloudUrl);
    localStorage.setItem(LS_WALLPAPER_ID_KEY, cloudId);
    localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(cloudWp));
    localStorage.setItem('unifolder_user_avatar', cloudUrl);
  } catch {}
  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: cloudUrl } }));
  window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: cloudUrl } }));

  // 2. Téléchargement UNIQUE en arrière-plan du binaire complet pour le figer en local
  (async () => {
    try {
      const resp = await fetch(cloudUrl, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        const localDataUrl = await convertToWallpaperDataUrl(blob);
        if (localDataUrl && localDataUrl.startsWith('data:image')) {
          await cacheWallpaperLocally(localDataUrl, cloudWp);
        }
      }
    } catch (dlErr) {
      console.warn('[WallpaperHelper] Erreur de mise en cache locale permanente:', dlErr);
    }
  })();

  return cloudUrl;
}

/**
 * Interroge le serveur Cloudflare pour vérifier si le fond d'écran a changé sur un autre appareil
 */
export async function syncActiveWallpaperFromCloud(forceCheck = false): Promise<string> {
  try {
    const cloudWp = await CloudStorageAPI.getWallpaper();
    return await syncAndCacheCloudWallpaper(cloudWp);
  } catch (err) {
    console.warn('[WallpaperHelper] syncActiveWallpaperFromCloud error:', err);
    return getActiveWallpaperReliable();
  }
}

/**
 * Récupère le fond d'écran actif le plus fiable et frais disponible (0ms prioritaire)
 */
export async function getActiveWallpaperReliable(): Promise<string> {
  // 1. Vérifier si une URL permanente ou dataUrl est dans localStorage (ignorer les blob: expirés)
  try {
    const lsVal = localStorage.getItem(LS_WALLPAPER_KEY);
    if (lsVal && !lsVal.startsWith('blob:')) {
      return lsVal;
    }
  } catch {}

  // 2. Vérifier dans IndexedDB
  try {
    const idbData = await getThumbnailData(IDB_WALLPAPER_KEY);
    if (idbData && idbData.startsWith('data:image')) {
      try {
        localStorage.setItem(LS_WALLPAPER_KEY, idbData);
      } catch {}
      return idbData;
    }
  } catch {}

  // 3. Déclencher la synchronisation arrière-plan sans bloquer
  syncActiveWallpaperFromCloud().catch(() => {});

  return DEFAULT_WALLPAPER_URL;
}
