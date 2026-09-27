/**
 * StudyCloud - Validation et Routage Intelligent des Fichiers
 *
 * 1. Détection universelle et inviolable de la nature réelle d'un fichier (Extension prioritaire sur MIME erroné).
 * 2. Option A (Rejet Strict) : Utilisé dans les sous-menus spécifiques (Images, Vidéos, Audio, Documents).
 *    Le navigateur bloque immédiatement le fichier : aucun enregistrement en cache, aucun upload, aucune apparition.
 * 3. Option B (Routage Intelligent) : Utilisé pour le bouton "+ Importer" de l'Accueil.
 */

export type FileCategory = 'images' | 'videos' | 'audio' | 'documents' | 'classeur';

export const EXTENSION_MAP = {
  images: [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif',
    'heic', 'heif', 'avif', 'raw', 'psd', 'ai', 'eps'
  ],
  videos: [
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp', 'm4v', 'ts',
    'ogv', 'mpg', 'mpeg', 'vob', 'm2ts', 'divx', 'asf'
  ],
  audio: [
    'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'amr', 'weba',
    'aiff', 'alac', 'mid', 'midi', 'caf', '3ga', 'm4b', 'm4p', 'oga'
  ],
  documents: [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'odt',
    'ods', 'odp', 'rtf', 'tex', 'epub', 'md', 'xml', 'json', 'log'
  ],
};

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  images: 'Images',
  videos: 'Vidéos',
  audio: 'Audio / Musique',
  documents: 'Documents',
  classeur: 'Classeur',
};

/**
 * Détecte la véritable nature d'un fichier.
 * RÈGLE D'OR : L'extension est PRIORITAIRE sur le type MIME car sous Windows/Chrome,
 * des fichiers audio (.m4a, .opus, .ogg, .weba) sont fréquemment marqués avec des MIME vidéo (video/mp4, video/ogg, video/webm).
 */
export function detectFileCategory(file: { name?: string; type?: string }): 'images' | 'videos' | 'audio' | 'documents' {
  const normName = ((file && file.name) || '').toLowerCase().trim();
  const mime = ((file && file.type) || '').toLowerCase().trim();
  const ext = normName.includes('.') ? (normName.split('.').pop() || '').toLowerCase().trim() : '';

  // 1. EXTENSIONS STRICTES (Priorité absolue pour empêcher tout faux classement)
  if (EXTENSION_MAP.audio.includes(ext)) {
    return 'audio';
  }
  if (EXTENSION_MAP.images.includes(ext)) {
    return 'images';
  }
  if (EXTENSION_MAP.videos.includes(ext)) {
    return 'videos';
  }
  if (EXTENSION_MAP.documents.includes(ext)) {
    return 'documents';
  }

  // 2. TYPES MIME (Seulement si l'extension est absente ou non répertoriée)
  if (mime.startsWith('audio/')) {
    return 'audio';
  }
  if (mime.startsWith('image/')) {
    return 'images';
  }
  if (mime.startsWith('video/')) {
    return 'videos';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    mime.includes('msword') ||
    mime.includes('excel') ||
    mime.includes('powerpoint')
  ) {
    return 'documents';
  }

  return 'documents';
}

export interface RejectedFileInfo {
  file: File;
  detectedCategory: 'images' | 'videos' | 'audio' | 'documents';
  reason: string;
}

export interface ValidationResult {
  validFiles: File[];
  rejectedFiles: RejectedFileInfo[];
}

/**
 * Validation Option A (Rejet Strict) pour les menus dédiés
 * Si un fichier ne correspond pas au menu cible, il est rejeté avec un motif clair.
 * Le navigateur bloque son apparition, son enregistrement et son téléchargement.
 */
export function validateFilesForMenu(
  files: File[],
  targetCategory: FileCategory
): ValidationResult {
  // Le classeur accepte tous les types de fichiers de cours
  if (targetCategory === 'classeur') {
    return { validFiles: files, rejectedFiles: [] };
  }

  const validFiles: File[] = [];
  const rejectedFiles: RejectedFileInfo[] = [];

  const expectedLabel = CATEGORY_LABELS[targetCategory] || targetCategory;

  for (const file of files) {
    const detected = detectFileCategory(file);

    if (detected === targetCategory) {
      validFiles.push(file);
    } else {
      const detectedLabel = CATEGORY_LABELS[detected] || detected;
      rejectedFiles.push({
        file,
        detectedCategory: detected,
        reason: `« ${file.name} » est un fichier ${detectedLabel}. Le menu « ${expectedLabel} » n'accepte strictement que des fichiers ${expectedLabel.toLowerCase()}. L'apparition et l'importation de ce fichier ont été bloquées par le navigateur.`,
      });
    }
  }

  return { validFiles, rejectedFiles };
}
