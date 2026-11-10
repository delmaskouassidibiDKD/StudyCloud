/**
 * StudyCloud - Assistant Universel de Gestion du Fond d'Écran
 * 
 * Synchronisation Multi-Appareils & Architecture Local-First :
 * 1. 0ms instantané : Une fois chargée ou définie, l'image reste stockée en local
 *    (IndexedDB + localStorage) et ne se re-télécharge JAMAIS à chaque visite
 *    tant que l'utilisateur ne la remplace pas par une autre.
 * 2. Multi-Appareils : Lorsqu'on se connecte avec un autre téléphone, tablette ou navigateur,
 *    l'application détecte automatiquement le fond d'écran actif dans Cloudflare D1/R2,
 *    le télécharge UNE SEULE FOIS, le sauvegarde en local dans ce nouvel appareil,
 *    et l'affiche instantanément comme fond d'écran (sans jamais modifier la photo de profil).
 * 3. Remplacement universel : Si l'utilisateur choisit une autre image sur n'importe quel appareil,
 *    la nouvelle prend immédiatement sa place localement et dans le cloud.
 */

import { CloudStorageAPI, UserWallpaper } from '../services/cloudStorageService';
import { getFileBlob, storeThumbnailData, getThumbnailData } from '../services/localFileStorage';
import { invalidateCloudQueries } from '../services/queryClient';

export const LS_WALLPAPER_KEY = 'studycloud_dashboard_wallpaper';
export const LS_WALLPAPER_LOCAL_KEY = 'studycloud_dashboard_wallpaper_local';
export const LS_WALLPAPER_META = 'studycloud_dashboard_wallpaper_meta';
export const LS_WALLPAPER_ID_KEY = 'studycloud_dashboard_wallpaper_id';
export const IDB_WALLPAPER_KEY = 'active_wallpaper';

/**
 * Détecte si une URL/donnée d'avatar correspond en réalité à un fond d'écran pollué
 * (ne doit JAMAIS être utilisée comme photo de profil utilisateur).
 */
export function isWallpaperAvatarPollution(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/wallpapers/') || trimmed.includes('/api/cloud/wallpaper/')) {
    return true;
  }
  try {
    const activeWpUrl = localStorage.getItem(LS_WALLPAPER_KEY);
    const activeWpLocal = localStorage.getItem(LS_WALLPAPER_LOCAL_KEY);
    if (activeWpUrl && trimmed === activeWpUrl) return true;
    if (activeWpLocal && trimmed === activeWpLocal) return true;
  } catch {}
  return false;
}

// Gestion de la rotation automatique toutes les 48 heures (2 jours)
export const LS_WALLPAPER_ROTATION_ENABLED = 'studycloud_wallpaper_auto_rotation';
export const LS_WALLPAPER_LAST_ROTATION_TIME = 'studycloud_wallpaper_last_rotation_time';
export const WALLPAPER_ROTATION_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48 heures (172 800 000 ms)

// Fond d'écran par défaut lors de la première arrivée : Hélice ADN Cosmique
export const DEFAULT_WALLPAPER_URL = '/wallpapers/wallpaper-dna.jpg';
export const DEFAULT_WALLPAPER_NAME = 'Hélice ADN Cosmique';

export interface PresetWallpaperItem {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  isDefault?: boolean;
}

export const PRESET_WALLPAPERS: PresetWallpaperItem[] = [
  {
    id: 'study-constellations',
    name: 'Constellations & Sciences StudyCloud',
    subtitle: 'Formules, constellations et nuages célestes sur fond azur et violet',
    url: '/wallpapers/wallpaper-constellations.jpg',
    isDefault: false,
  },
  {
    id: 'clouds-sky',
    name: 'Ciel & Nuages StudyCloud',
    subtitle: 'Horizon azur et doux nuages blancs en apesanteur',
    url: '/wallpapers/wallpaper-clouds.jpg',
    isDefault: false,
  },

  {
    id: 'beach',
    name: 'Rivage Turquoise',
    subtitle: 'Eau cristalline et sable blanc paradisiaque',
    url: '/wallpapers/wallpaper-beach.jpg',
    isDefault: false,
  },
  {
    id: 'piano',
    name: 'Piano & Horizon Azur',
    subtitle: 'Mélodie poétique sur une eau calme et ciel d\'azur infini',
    url: '/wallpapers/wallpaper-piano.jpg',
    isDefault: false,
  },
  {
    id: 'world-neon',
    name: 'Mappemonde & Vol Nocturne',
    subtitle: 'Fond noir OLED, avion et continents néon lumineux',
    url: '/wallpapers/wallpaper-world-neon.jpg',
    isDefault: false,
  },
  {
    id: 'dream-moon',
    name: 'Songe Lunaire & Ciel Boréal',
    subtitle: 'Croissant de lune, aurore et nuit étoilée onirique',
    url: '/wallpapers/wallpaper-dream-moon.jpg',
    isDefault: false,
  },
  {
    id: 'spheres',
    name: 'Sphères Néon & Verre',
    subtitle: 'Design abstrait moderne aux lueurs magenta et azur',
    url: '/wallpapers/wallpaper-spheres.jpg',
    isDefault: false,
  },
  {
    id: 'dna-helix',
    name: 'Biologie & Hélice ADN',
    subtitle: 'Structure moléculaire en verre néon et recherche scientifique',
    url: '/wallpapers/wallpaper-dna-helix.jpg',
    isDefault: false,
  },
  {
    id: 'dna',
    name: 'Hélice ADN Cosmique',
    subtitle: 'Thème Signature StudyCloud — Néon bleu & étoiles',
    url: '/wallpapers/wallpaper-dna.jpg',
    isDefault: true,
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
 * Vérifie si une URL de fond d'écran correspond à l'un de nos thèmes officiels proposés
 */
export function isPresetWallpaper(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/wallpapers/') || PRESET_WALLPAPERS.some(p => p.url === url);
}

/**
 * Détermine si le changement automatique de fond d'écran toutes les 48h est activé.
 * Activé par défaut pour tous les utilisateurs.
 */
export function isWallpaperAutoRotationEnabled(): boolean {
  try {
    const val = localStorage.getItem(LS_WALLPAPER_ROTATION_ENABLED);
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Active ou désactive le changement automatique de fond d'écran
 */
export function setWallpaperAutoRotationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_WALLPAPER_ROTATION_ENABLED, enabled ? 'true' : 'false');
    if (enabled) {
      // Repartir sur un nouveau cycle de 48h à partir de maintenant
      localStorage.setItem(LS_WALLPAPER_LAST_ROTATION_TIME, String(Date.now()));
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_auto_rotation_changed', { detail: { enabled } }));
}

/**
 * Récupère le prochain thème officiel proposé selon l'ordre successif en boucle.
 * S'il arrive à la fin de la liste, il recommence au début.
 */
export function getNextPresetWallpaper(currentUrl?: string | null): PresetWallpaperItem {
  if (!currentUrl) {
    const dnaPreset = PRESET_WALLPAPERS.find(p => p.id === 'dna');
    return dnaPreset || PRESET_WALLPAPERS[0];
  }
  const currentIndex = PRESET_WALLPAPERS.findIndex(p => p.url === currentUrl);
  if (currentIndex === -1) {
    // Si le fond d'écran actuel n'est pas trouvé dans la liste, enchaîner après Hélice ADN
    const dnaIdx = PRESET_WALLPAPERS.findIndex(p => p.id === 'dna');
    const startIdx = dnaIdx !== -1 ? (dnaIdx + 1) % PRESET_WALLPAPERS.length : 0;
    return PRESET_WALLPAPERS[startIdx];
  }
  const nextIndex = (currentIndex + 1) % PRESET_WALLPAPERS.length;
  return PRESET_WALLPAPERS[nextIndex];
}

/**
 * Vérifie et applique la rotation automatique si 48 heures (2 jours) sont écoulées.
 * RÈGLE STRICTE :
 * 1. La rotation ne s'applique QUE si l'utilisateur n'a pas désactivé la bascule automatique.
 * 2. La rotation ne s'applique QUE si l'utilisateur utilise notre proposition de fond d'écran.
 *    S'il a importé une image personnelle, le changement automatique NE S'APPLIQUE PAS.
 */
export async function checkAndPerformWallpaperAutoRotation(): Promise<boolean> {
  try {
    // 1. Vérifier si l'option est activée
    if (!isWallpaperAutoRotationEnabled()) {
      return false;
    }

    // 2. Vérifier le fond d'écran actuel
    const currentWp = (typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_KEY) : null) || DEFAULT_WALLPAPER_URL;

    // 3. Si l'utilisateur utilise une image importée personnelle, la rotation automatique est ignorée
    if (!isPresetWallpaper(currentWp)) {
      return false;
    }

    const lastTimeStr = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_LAST_ROTATION_TIME) : null;
    const now = Date.now();

    if (!lastTimeStr) {
      // Première initialisation du compteur (48h à partir de la première arrivée)
      localStorage.setItem(LS_WALLPAPER_LAST_ROTATION_TIME, String(now));
      return false;
    }

    const lastTime = Number(lastTimeStr);
    if (isNaN(lastTime) || now < lastTime) {
      localStorage.setItem(LS_WALLPAPER_LAST_ROTATION_TIME, String(now));
      return false;
    }

    // 4. Si 48 heures (2 jours) se sont écoulées, passer au suivant dans la boucle
    if (now - lastTime >= WALLPAPER_ROTATION_INTERVAL_MS) {
      const nextPreset = getNextPresetWallpaper(currentWp);
      localStorage.setItem(LS_WALLPAPER_LAST_ROTATION_TIME, String(now));
      console.log(`[WallpaperHelper] Rotation auto 48h : passage à "${nextPreset.name}" (${nextPreset.url})`);
      await applyDashboardWallpaper(nextPreset.url, nextPreset.name);
      return true;
    }
  } catch (err) {
    console.warn('[WallpaperHelper] Erreur vérification rotation auto 48h:', err);
  }
  return false;
}

/**
 * Convertit n'importe quelle source d'image (Blob, File, URL blob:, ID IndexedDB)
 * en une chaîne base64 data:image/jpeg compacte et optimisée (< 150 Ko)
 * parfaitement adaptée au stockage local instantané (0ms) et sans saturation de quota.
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

  // Redimensionner et compresser l'image via un Canvas (max 1280px, qualité 0.78)
  // Résultat : ~100-140 Ko en binaire, ~150-190 Ko en base64, 100% net et 0ms au chargement
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1280;
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

          // Dessin net
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.78);

          // Sauvegarde miroir dans Cache Storage si disponible
          if (typeof caches !== 'undefined' && canvas.toBlob) {
            canvas.toBlob((b) => {
              if (b) {
                caches.open('studycloud-wallpaper-cache')
                  .then(cache => {
                    const response = new Response(b, {
                      headers: {
                        'Content-Type': 'image/jpeg',
                        'Cache-Control': 'public, max-age=31536000, immutable'
                      }
                    });
                    cache.put('/studycloud-custom-wallpaper.jpg', response).catch(() => {});
                  })
                  .catch(() => {});
              }
            }, 'image/jpeg', 0.78);
          }

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
 * Enregistre localement le fond d'écran (IndexedDB + localStorage)
 * et déclenche l'événement de synchronisation réactive instantanée (0ms).
 */
export async function cacheWallpaperLocally(
  imageUrlOrDataUrl: string,
  meta?: { id?: string; name?: string; url?: string; size?: number }
): Promise<void> {
  if (!imageUrlOrDataUrl) return;

  try {
    if (imageUrlOrDataUrl.startsWith('data:image')) {
      localStorage.setItem(LS_WALLPAPER_LOCAL_KEY, imageUrlOrDataUrl);
    } else if (imageUrlOrDataUrl.startsWith('/wallpapers/')) {
      localStorage.removeItem(LS_WALLPAPER_LOCAL_KEY);
    }
    localStorage.setItem(LS_WALLPAPER_KEY, imageUrlOrDataUrl);
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

  // Événement réactif pour rafraîchir le fond d'écran instantanément (sans modifier la photo de profil)
  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: imageUrlOrDataUrl } }));
}

/**
 * Définit et synchronise le fond d'écran :
 * 1. Application optimiste instantanée (0ms)
 * 2. Compression compacte optimisée (1280px ~120 Ko)
 * 3. Enregistrement local permanent (IndexedDB + localStorage + Cache API)
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
    try {
      localStorage.removeItem(LS_WALLPAPER_LOCAL_KEY);
    } catch {}
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

  // 1. CONVERSION LOCALE COMPACTE INSTANTANÉE (< 50ms)
  let persistentData = '';
  try {
    persistentData = await convertToWallpaperDataUrl(source, fileId);
  } catch (convErr) {
    console.warn('[WallpaperHelper] Erreur conversion dataURL, tentative fallback:', convErr);
    if (typeof source === 'string' && source && !source.startsWith('blob:')) {
      persistentData = source;
    }
  }

  // Fallback blob temporaire si la conversion asynchrone a échoué
  let immediateSource = persistentData;
  if (!immediateSource) {
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
  }

  const effectiveImage = persistentData || immediateSource;
  if (!effectiveImage) {
    throw new Error('Impossible de charger l\'image choisie');
  }

  const localWpId = fileId || `custom_${Date.now()}`;

  // 2. Enregistrement local permanent (0ms)
  await cacheWallpaperLocally(effectiveImage, {
    id: localWpId,
    name: name || 'Fond d\'écran personnalisé',
    url: effectiveImage
  });

  // 3. Sauvegarde Cloudflare R2 / D1 en tâche de fond pour synchronisation multi-appareils
  CloudStorageAPI.saveWallpaper(persistentData || effectiveImage, name || 'Fond d\'écran personnalisé')
    .then((res) => {
      if (res?.success && res.wallpaper?.id) {
        try {
          // Met à jour l'ID distant et les métadonnées SANS écraser la version locale rapide 0ms
          localStorage.setItem(LS_WALLPAPER_ID_KEY, String(res.wallpaper.id));
          localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(res.wallpaper));
        } catch {}
        invalidateCloudQueries.wallpaper().catch(() => {});
      }
    })
    .catch((bgErr) => {
      console.warn('[WallpaperHelper] Erreur synchronisation cloud wallpaper:', bgErr);
    });

  return effectiveImage;
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
    if (currentId && !currentId.startsWith('preset:')) {
      try {
        localStorage.removeItem(LS_WALLPAPER_KEY);
        localStorage.removeItem(LS_WALLPAPER_LOCAL_KEY);
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
  const localData = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_LOCAL_KEY) : null;
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_WALLPAPER_KEY) : null;

  // Si l'ID distant correspond exactement à l'ID local et qu'on a déjà l'image locale valide (dataUrl ou preset) :
  // NE PAS RE-TÉLÉCHARGER ! L'image reste en local et se charge en 0ms.
  if (localId === cloudId && ((localData && !localData.startsWith('blob:')) || (localUrl && !localUrl.startsWith('blob:')))) {
    return localData || localUrl || cloudUrl;
  }

  // Cas des thèmes officiels intégrés (/wallpapers/...)
  if (cloudUrl.startsWith('/wallpapers/')) {
    try {
      localStorage.removeItem(LS_WALLPAPER_LOCAL_KEY);
    } catch {}
    await cacheWallpaperLocally(cloudUrl, cloudWp);
    return cloudUrl;
  }

  // NOUVEL APPAREIL OU NOUVELLE IMAGE CHOISIE SUR UN AUTRE TÉLÉPHONE :
  // 1. Affichage immédiat pour ne pas faire attendre l'utilisateur
  try {
    localStorage.setItem(LS_WALLPAPER_KEY, cloudUrl);
    localStorage.setItem(LS_WALLPAPER_ID_KEY, cloudId);
    localStorage.setItem(LS_WALLPAPER_META, JSON.stringify(cloudWp));
  } catch {}
  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: cloudUrl } }));

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
  // 1. Vérifier la version locale optimisée (0ms instantané)
  try {
    const local = localStorage.getItem(LS_WALLPAPER_LOCAL_KEY);
    if (local && !local.startsWith('blob:') && (local.startsWith('data:image') || local.startsWith('/wallpapers/'))) {
      return local;
    }
  } catch {}

  // 2. Vérifier si une URL permanente ou dataUrl est dans localStorage (ignorer les blob: expirés)
  try {
    const lsVal = localStorage.getItem(LS_WALLPAPER_KEY);
    if (lsVal && !lsVal.startsWith('blob:')) {
      return lsVal;
    }
  } catch {}

  // 3. Vérifier dans IndexedDB
  try {
    const idbData = await getThumbnailData(IDB_WALLPAPER_KEY);
    if (idbData && idbData.startsWith('data:image')) {
      try {
        localStorage.setItem(LS_WALLPAPER_LOCAL_KEY, idbData);
        localStorage.setItem(LS_WALLPAPER_KEY, idbData);
      } catch {}
      return idbData;
    }
  } catch {}

  // 4. Vérifier Cache Storage API
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('studycloud-wallpaper-cache');
      const match = await cache.match('/studycloud-custom-wallpaper.jpg');
      if (match) {
        const blob = await match.blob();
        const dataUrl = await convertToWallpaperDataUrl(blob);
        if (dataUrl) {
          try {
            localStorage.setItem(LS_WALLPAPER_LOCAL_KEY, dataUrl);
            localStorage.setItem(LS_WALLPAPER_KEY, dataUrl);
          } catch {}
          return dataUrl;
        }
      }
    } catch {}
  }

  // 5. Déclencher la synchronisation arrière-plan sans bloquer
  syncActiveWallpaperFromCloud().catch(() => {});

  return DEFAULT_WALLPAPER_URL;
}
