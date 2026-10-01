/**
 * StudyCloud - Assistant Universel de Gestion du Fond d'Écran
 * Garantit que le fond d'écran n'est JAMAIS grisé, persiste à travers les recharges,
 * et reste parfaitement fixe et adapté même si l'écran bascule ou change d'orientation.
 */

import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlob, getFileBlobUrl, storeThumbnailData, getThumbnailData } from '../services/localFileStorage';
import { invalidateCloudQueries } from '../services/queryClient';

const LS_WALLPAPER_KEY = 'studycloud_dashboard_wallpaper';
const LS_WALLPAPER_META = 'studycloud_dashboard_wallpaper_meta';
const IDB_WALLPAPER_KEY = 'active_wallpaper';

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
        const resp = await fetch(input);
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
 * Définit et synchronise le fond d'écran de manière 100% robuste :
 * 1. Enregistre la miniature permanente en IndexedDB (0ms)
 * 2. Met à jour localStorage et déclenche l'événement réactif
 * 3. Envoie le base64 à Cloudflare D1/R2 pour générer une URL R2 publique permanente
 */
export async function applyDashboardWallpaper(
  source: string | Blob | File,
  name?: string,
  fileId?: string
): Promise<string> {
  // 1. Conversion en base64 garanti et persistant
  let persistentData = '';
  try {
    persistentData = await convertToWallpaperDataUrl(source, fileId);
  } catch (err) {
    console.warn('[WallpaperHelper] Erreur conversion dataURL, utilisation du fallback direct:', err);
    if (typeof source === 'string') persistentData = source;
  }

  if (!persistentData) {
    throw new Error('Données du fond d\'écran indisponibles');
  }

  // 2. Sauvegarde en IndexedDB pour accès offline instantané
  await storeThumbnailData(IDB_WALLPAPER_KEY, persistentData);

  // 3. Sauvegarde optimiste dans localStorage & propagation d'événements
  try {
    localStorage.setItem(LS_WALLPAPER_KEY, persistentData);
    localStorage.setItem('unifolder_user_avatar', persistentData);
  } catch {}

  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: persistentData } }));
  window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: persistentData } }));

  // 4. Téléversement vers Cloudflare R2 / D1
  try {
    const res = await CloudStorageAPI.saveWallpaper(persistentData, name || 'Fond d\'écran');
    if (res?.success && res.wallpaper?.url) {
      const permanentUrl = res.wallpaper.url;
      try {
        localStorage.setItem(LS_WALLPAPER_KEY, permanentUrl);
        localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(res.wallpaper));
      } catch {}
      window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: permanentUrl } }));
      invalidateCloudQueries.wallpaper().catch(() => {});
      return permanentUrl;
    }
  } catch (cloudErr) {
    console.warn('[WallpaperHelper] Sauvegarde Cloudflare différée:', cloudErr);
  }

  return persistentData;
}

/**
 * Récupère le fond d'écran actif le plus fiable et frais disponible
 */
export async function getActiveWallpaperReliable(): Promise<string | null> {
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

  // 3. Vérifier auprès du serveur Cloudflare
  try {
    const cloudWp = await CloudStorageAPI.getWallpaper();
    if (cloudWp?.url && !cloudWp.url.startsWith('blob:')) {
      try {
        localStorage.setItem(LS_WALLPAPER_KEY, cloudWp.url);
      } catch {}
      return cloudWp.url;
    }
  } catch {}

  return null;
}
