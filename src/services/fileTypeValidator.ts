/**
 * StudyCloud - Validation et Routage Intelligent des Fichiers
 *
 * 1. Détection universelle de la nature réelle d'un fichier (MIME + Extension).
 * 2. Option A (Rejet Strict) : Utilisé dans les sous-menus spécifiques (Images, Vidéos, Audio, Documents).
 * 3. Option B (Routage Intelligent) : Utilisé pour le bouton "+ Importer" de l'Accueil.
 */

export type FileCategory = 'images' | 'videos' | 'audio' | 'documents' | 'classeur';

export const EXTENSION_MAP = {
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif', 'raw'],
  videos: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp', 'm4v', 'ts', 'ogv', 'mpg', 'mpeg'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'amr', 'weba', 'aiff', 'alac', 'mid', 'midi', 'caf', '3ga'],
  documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'odt', 'ods', 'odp', 'rtf', 'tex', 'epub'],
};

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  images: 'Images',
  videos: 'Vidéos',
  audio: 'Audio / Musique',
  documents: 'Documents',
  classeur: 'Classeur',
};

/**
 * Détecte la véritable nature d'un fichier en inspectant son type MIME et son extension
 */
export function detectFileCategory(file: File): 'images' | 'videos' | 'audio' | 'documents' {
  const normName = (file.name || '').toLowerCase().trim();
  const mime = (file.type || '').toLowerCase().trim();
  const ext = normName.includes('.') ? (normName.split('.').pop() || '').toLowerCase().trim() : '';

  if (mime.startsWith('image/') || EXTENSION_MAP.images.includes(ext)) {
    return 'images';
  }
  if (mime.startsWith('video/') || EXTENSION_MAP.videos.includes(ext)) {
    return 'videos';
  }
  if (mime.startsWith('audio/') || EXTENSION_MAP.audio.includes(ext)) {
    return 'audio';
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
        reason: `"${file.name}" est un fichier ${detectedLabel}. Le menu "${expectedLabel}" n'accepte que des fichiers ${expectedLabel.toLowerCase()}.`,
      });
    }
  }

  return { validFiles, rejectedFiles };
}
