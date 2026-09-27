/**
 * StudyCloud - Validation et Routage Intelligent des Fichiers
 *
 * 1. Détection universelle et inviolable de la nature réelle d'un fichier (Extension prioritaire sur MIME erroné).
 * 2. Prise en charge stricte des audios et notes vocales WhatsApp (.opus, .ogg, .m4a, AUD-..., PTT-...).
 * 3. Séparation stricte des boutons d'importation par menu avec rôle attribué (uploadSource).
 */

export type FileCategory = 'images' | 'videos' | 'audio' | 'documents' | 'classeur';

export const EXTENSION_MAP = {
  images: [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif',
    'heic', 'heif', 'avif', 'raw', 'psd', 'ai', 'eps'
  ],
  videos: [
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', 'ts',
    'ogv', 'mpg', 'mpeg', 'vob', 'm2ts', 'divx', 'asf'
  ],
  audio: [
    'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'amr', 'weba',
    'aiff', 'alac', 'mid', 'midi', 'caf', '3ga', '3gp', 'm4b', 'm4p', 'oga'
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
 * Détecte si un fichier est un fichier audio / vocal WhatsApp ou téléchargé
 */
export function isWhatsAppAudio(name?: string, mime?: string): boolean {
  const normName = ((name || '')).toLowerCase().trim();
  const normMime = ((mime || '')).toLowerCase().trim();

  // Préfixes WhatsApp universels (Android, iOS, Web)
  if (normName.startsWith('aud-') || normName.startsWith('ptt-') || normName.includes('whatsapp') || normName.includes('voice_') || normName.includes('audio_')) {
    return true;
  }
  // Formats typiques des notes vocales et sons téléchargés
  if (normName.endsWith('.opus') || normName.endsWith('.oga') || normName.endsWith('.3ga') || normName.endsWith('.amr')) {
    return true;
  }
  if (normName.endsWith('.3gp') && (normMime.includes('audio') || normMime.includes('amr') || normName.startsWith('aud-') || normName.startsWith('ptt-'))) {
    return true;
  }
  if (normMime.includes('opus') || normMime.includes('audio/ogg') || normMime.includes('audio/amr') || normMime.includes('audio/3gpp')) {
    return true;
  }
  return false;
}

/**
 * Détecte la véritable nature d'un fichier.
 * RÈGLE D'OR :
 * - Les notes vocales et audios WhatsApp sont TOUJOURS 'audio'.
 * - L'extension est PRIORITAIRE sur le type MIME car sous Windows/Chrome/Android,
 *   des fichiers audio (.m4a, .opus, .ogg, .weba) sont fréquemment marqués avec des MIME vidéo (video/mp4, video/ogg, video/webm).
 */
export function detectFileCategory(file: { name?: string; type?: string }): 'images' | 'videos' | 'audio' | 'documents' {
  const normName = ((file && file.name) || '').toLowerCase().trim();
  const mime = ((file && file.type) || '').toLowerCase().trim();
  const ext = normName.includes('.') ? (normName.split('.').pop() || '').toLowerCase().trim() : '';

  // 0. VÉRIFICATION IMMÉDIATE POUR LES AUDIOS WHATSAPP ET ENREGISTREMENTS VOCAUX
  if (isWhatsAppAudio(normName, mime)) {
    return 'audio';
  }

  // 1. EXTENSIONS STRICTES
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
  if (mime.startsWith('audio/') || mime.includes('opus') || mime.includes('ogg')) {
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
 */
export function validateFilesForMenu(
  files: File[],
  targetCategory: FileCategory
): ValidationResult {
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
      const isWa = isWhatsAppAudio(file.name, file.type);
      const detectedLabel = isWa ? 'Audio (WhatsApp / Vocal)' : (CATEGORY_LABELS[detected] || detected);

      let reason = `« ${file.name} » est un fichier ${detectedLabel}. Le menu « ${expectedLabel} » n'accepte strictement que des fichiers ${expectedLabel.toLowerCase()}.`;
      if (isWa && targetCategory === 'videos') {
        reason += ` Ce fichier est un fichier audio WhatsApp, veuillez utiliser le bouton dédié « Importer un audio » dans le menu Audio / Musique !`;
      }

      rejectedFiles.push({
        file,
        detectedCategory: detected,
        reason,
      });
    }
  }

  return { validFiles, rejectedFiles };
}
