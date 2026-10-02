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
  'studycloud_classeur_3d_folders',
  'studycloud_dashboard_wallpaper_meta'
];

/**
 * Nettoie les clés d'anciennes versions ou les caches lourds en cas de saturation de stockage
 */
export function purgeVolatileStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  VOLATILE_PURGEABLE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
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
