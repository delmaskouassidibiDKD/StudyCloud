/**
 * StudyCloud - Safe LocalStorage Utility
 * 
 * Protège l'application contre les erreurs critiques 'QuotaExceededError' (DOMException 22/1014)
 * - Ne stocke JAMAIS de data: URLs (base64) en localStorage
 * - Assainit et compacte les objets avant sérialisation
 * - Purge automatique des clés volatiles ou volumineuses en cas de mémoire pleine
 * - Zéro crash de rendu React (Boundary) grâce à des try/catch garantis
 */

// Clés volatiles pouvant être nettoyées sans risque de perte de données utilisateur en cas d'urgence
const VOLATILE_PURGEABLE_KEYS = [
  'unifolder_matiere_files_Images',
  'unifolder_matiere_files_images',
  'unifolder_matiere_files_Documents',
  'unifolder_matiere_files_documents',
  'unifolder_matiere_files_Vidéos',
  'unifolder_matiere_files_videos',
  'unifolder_matiere_files_Videos',
  'unifolder_matiere_files_Musique',
  'unifolder_matiere_files_musique',
  'unifolder_matiere_files_Audio',
  'unifolder_matiere_files_audio',
  'studycloud_documents_files',
  'studycloud_images_files',
  'studycloud_videos_files',
  'studycloud_audio_files',
  'studycloud_recent_files',
  'studycloud_folder_files_map',
  'studycloud_trash_files',
  'studycloud_secure_files',
  'studycloud_secure_folder_files',
  'studycloud_downloaded_items',
  'studycloud_downloaded_files',
  'studycloud_classeur_3d_folders'
];

/**
 * Nettoie les clés d'anciennes versions ou les caches lourds en cas de saturation de stockage
 */
export function purgeVolatileStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    // 1. Suppression des clés volatiles identifiées
    VOLATILE_PURGEABLE_KEYS.forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });

    // 2. Scan dynamique de toutes les clés pour détecter les données volumineuses ou orphelines
    const keysToRemove: string[] = [];
    const convMsgKeys: Array<{ key: string; len: number }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      if (k.startsWith('studycloud_conv_msgs_')) {
        const val = localStorage.getItem(k);
        convMsgKeys.push({ key: k, len: val ? val.length : 0 });
      } else if (k.startsWith('sc_fallback_') || k.startsWith('unifolder_cache_') || k.startsWith('pdfjs_')) {
        keysToRemove.push(k);
      } else if (
        k !== 'unifolder_user_id' &&
        k !== 'studycloud_user_id' &&
        k !== 'studycloud_auth_token' &&
        k !== 'studycloud_dashboard_wallpaper' &&
        k !== 'studycloud_dashboard_wallpaper_meta' &&
        k !== 'unifolder_user_avatar'
      ) {
        try {
          const val = localStorage.getItem(k);
          if (val && (val.includes('data:image') || val.includes('data:application/pdf') || val.length > 200000)) {
            keysToRemove.push(k);
          }
        } catch {}
      }
    }

    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });

    // Réduire les caches de conversations chat en ne conservant que les 3 plus récentes
    if (convMsgKeys.length > 3) {
      convMsgKeys.sort((a, b) => b.len - a.len); // Supprimer les plus lourdes d'abord
      convMsgKeys.slice(0, convMsgKeys.length - 3).forEach(item => {
        try { localStorage.removeItem(item.key); } catch {}
      });
    }

    // Réduire active_preview_item si trop lourd
    const preview = localStorage.getItem('studycloud_active_preview_item');
    if (preview && preview.length > 25000) {
      localStorage.removeItem('studycloud_active_preview_item');
    }
  } catch (err) {
    console.warn('[safeStorage] Erreur durant purge:', err);
  }
}

/**
 * Assainit un fichier ou objet avant stockage dans localStorage :
 * Retire impérativement les strings base64 data: URL qui saturent immédiatement le quota de 5MB.
 */
export function sanitizeItemForStorage(item: any): any {
  if (!item || typeof item !== 'object') return item;
  
  // Clone léger
  const clean = { ...item };

  // Retirer les URLs volumineuses (data: base64)
  if (typeof clean.url === 'string' && (clean.url.startsWith('data:') || clean.url.length > 500)) {
    // Si c'est une data URL, on la vide pour le localStorage car le blob est dans IndexedDB ou sur R2
    clean.url = '';
  }

  if (typeof clean.previewUrl === 'string' && (clean.previewUrl.startsWith('data:') || clean.previewUrl.length > 500)) {
    clean.previewUrl = '';
  }

  if (typeof clean.thumbnail_url === 'string' && (clean.thumbnail_url.startsWith('data:') || clean.thumbnail_url.length > 500)) {
    clean.thumbnail_url = '';
  }

  // Protéger contre les images lourdes en base64 dans les notes Keep
  if (typeof clean.imageUrl === 'string' && (clean.imageUrl.startsWith('data:') || clean.imageUrl.length > 1000)) {
    clean.imageUrl = '';
  }

  if (typeof clean.image === 'string' && (clean.image.startsWith('data:') || clean.image.length > 1000)) {
    clean.image = '';
  }

  // Nettoyer les propriétés inutiles ou trop lourdes
  delete clean.blob;
  delete clean.rawFile;
  delete clean.file;

  return clean;
}

/**
 * Sauvegarde sécurisée dans le localStorage avec gestion automatique des quotas
 */
export function safeLocalStorageSet(key: string, value: any, options?: { maxItems?: number }): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  let sanitizedValue = value;

  if (Array.isArray(value)) {
    const maxItems = options?.maxItems || 100;
    sanitizedValue = value.slice(0, maxItems).map(sanitizeItemForStorage);
  } else if (value && typeof value === 'object') {
    sanitizedValue = sanitizeItemForStorage(value);
  }

  try {
    const serialized = JSON.stringify(sanitizedValue);
    localStorage.setItem(key, serialized);
    return true;
  } catch (firstError: any) {
    // Si quota dépassé, purge d'urgence des clés volatiles
    console.warn(`[safeStorage] Avertissement quota sur '${key}', tentative de purge mémoire...`, firstError?.message);
    purgeVolatileStorage();

    try {
      // 2ème essai : réduire la taille si tableau
      if (Array.isArray(sanitizedValue)) {
        sanitizedValue = sanitizedValue.slice(0, 30);
      }
      const serialized = JSON.stringify(sanitizedValue);
      localStorage.setItem(key, serialized);
      return true;
    } catch (secondError: any) {
      console.error(`[safeStorage] Impossible de stocker '${key}' (Quota dépassé). Passage en mode non bloquant.`, secondError?.message);
      return false;
    }
  }
}

/**
 * Lecture sécurisée depuis le localStorage avec fallback en cas d'erreur de parsing
 */
export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[safeStorage] Erreur de lecture sur '${key}', utilisation de la valeur par défaut:`, err);
    return fallback;
  }
}

/**
 * Suppression sécurisée
 */
export function safeLocalStorageRemove(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Enregistrement sécurisé d'une chaîne brute avec auto-purge en cas de quota plein
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (firstErr: any) {
    console.warn(`[safeStorage] Quota de stockage atteint sur '${key}'. Purge de sécurité...`, firstErr?.message);
    purgeVolatileStorage();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_secondErr) {
      console.warn(`[safeStorage] Échec persistant pour '${key}' (Stockage plein). Continuation sans interruption.`);
      return false;
    }
  }
}

/**
 * Lecture sécurisée d'une chaîne brute sans risque de crash
 */
export function safeGetItem(key: string, fallback: string = ''): string {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const val = localStorage.getItem(key);
    return val !== null && val !== undefined ? val : fallback;
  } catch {
    return fallback;
  }
}

