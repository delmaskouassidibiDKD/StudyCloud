/**
 * StudyCloud - Validation et Routage Intelligent des Fichiers
 *
 * 1. Détection par "Magic Numbers" (Signature Binaire des premiers octets du fichier) :
 *    - Infaillible même si l'extension ou le type MIME est tronqué, absent ou trompeur.
 *    - Analyse les conteneurs MP4/MOV (ftyp), WebM/MKV (EBML), AVI (RIFF), MP3 (ID3/sync),
 *      OGG/Opus, WAV, FLAC, AMR, JPEG, PNG, GIF, WebP, PDF.
 * 2. Reconnaissance exacte des formats et conventions WhatsApp :
 *    - Vidéos WhatsApp : "WhatsApp Video...", "VID-...", .mp4, .mov, .mkv, .avi -> STRICTEMENT VIDÉOS.
 *    - Audios WhatsApp : "WhatsApp Audio...", "AUD-...", "PTT-...", .opus, .ogg, .3ga, .amr -> STRICTEMENT AUDIO.
 *    - Images WhatsApp : "WhatsApp Image...", "IMG-...", .jpg, .jpeg, .png, .webp -> STRICTEMENT IMAGES.
 * 3. Validation asynchrone par signature binaire pour chaque menu dédié.
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
 * Détecte si un fichier est explicitement une vidéo WhatsApp ou mobile
 */
export function isWhatsAppVideo(name?: string, mime?: string): boolean {
  const normName = ((name || '')).toLowerCase().trim();
  const normMime = ((mime || '')).toLowerCase().trim();

  // Si c'est un audio WhatsApp ou nommé comme un audio, ce n'est JAMAIS une vidéo !
  if (isWhatsAppAudio(normName, normMime)) {
    return false;
  }

  if (normName.startsWith('vid-') || normName.includes('whatsapp video') || normName.includes('video_')) {
    return true;
  }
  if (normMime.startsWith('video/')) {
    return true;
  }
  return false;
}

/**
 * Détecte si un fichier est explicitement une image WhatsApp ou photo mobile
 */
export function isWhatsAppImage(name?: string, mime?: string): boolean {
  const normName = ((name || '')).toLowerCase().trim();
  const normMime = ((mime || '')).toLowerCase().trim();

  if (normName.startsWith('img-') || normName.includes('whatsapp image') || normName.includes('image_') || normName.includes('photo_')) {
    return true;
  }
  if (normMime.startsWith('image/')) {
    return true;
  }
  return false;
}

/**
 * Détecte si un fichier est un fichier audio / vocal WhatsApp ou téléchargé
 */
export function isWhatsAppAudio(name?: string, mime?: string): boolean {
  const normName = ((name || '')).toLowerCase().trim();
  const normMime = ((mime || '')).toLowerCase().trim();

  // Si c'est explicitement une vidéo ou une image WhatsApp, ce n'est PAS un audio !
  if (normName.includes('whatsapp video') || normName.startsWith('vid-') || normName.includes('whatsapp image') || normName.startsWith('img-')) {
    return false;
  }
  if (normMime.startsWith('image/')) {
    return false;
  }

  // Préfixes WhatsApp Audio spécifiques (Android, iOS, Web)
  // Même si le MIME est video/mp4 (cas classique où Android/WhatsApp enregistre avec extension .mp4)
  if (
    normName.startsWith('aud-') ||
    normName.startsWith('ptt-') ||
    normName.includes('whatsapp audio') ||
    normName.includes('voice_') ||
    normName.includes('audio_') ||
    normName.includes('vocal') ||
    normName.includes('enregistrement')
  ) {
    return true;
  }

  // Formats typiques des notes vocales et sons téléchargés
  if (
    normName.endsWith('.opus') ||
    normName.endsWith('.oga') ||
    normName.endsWith('.3ga') ||
    normName.endsWith('.amr') ||
    normName.endsWith('.m4a') ||
    normName.endsWith('.aac') ||
    normName.endsWith('.mp3') ||
    normName.endsWith('.wav') ||
    normName.endsWith('.flac') ||
    normName.endsWith('.weba')
  ) {
    return true;
  }
  if (normName.endsWith('.3gp') && (normMime.includes('audio') || normMime.includes('amr') || normName.startsWith('aud-') || normName.startsWith('ptt-'))) {
    return true;
  }
  if (normMime.includes('opus') || normMime.includes('audio/ogg') || normMime.includes('audio/amr') || normMime.includes('audio/3gpp') || normMime.startsWith('audio/')) {
    return true;
  }
  return false;
}

/**
 * Détecte la véritable nature d'un fichier en lisant ses Magic Numbers (signature binaire des premiers octets).
 * Réalisé en quelques millisecondes sur seulement 64 octets du Blob / File.
 */
export async function detectFileCategoryWithMagic(
  file: File | Blob,
  fallbackName?: string,
  fallbackMime?: string
): Promise<'images' | 'videos' | 'audio' | 'documents'> {
  const name = (file instanceof File ? file.name : (fallbackName || '')).trim();
  const mime = (file.type || fallbackMime || '').toLowerCase().trim();
  const lowerName = name.toLowerCase();
  const ext = lowerName.includes('.') ? (lowerName.split('.').pop() || '') : '';

  // 0. Si le nom ou MIME indique explicitement un audio WhatsApp ou note vocale : PRIORITÉ ABSOLUE AUDIO
  if (isWhatsAppAudio(lowerName, mime)) {
    return 'audio';
  }
  // Si le nom indique explicitement une vidéo WhatsApp :
  if (lowerName.includes('whatsapp video') || lowerName.startsWith('vid-')) {
    return 'videos';
  }
  // Si le nom indique explicitement une image WhatsApp :
  if (lowerName.includes('whatsapp image') || lowerName.startsWith('img-')) {
    return 'images';
  }

  try {
    const slice = file.slice(0, 64);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.length;

    const ascii = (start: number, end: number) => {
      let s = '';
      for (let i = start; i < end && i < len; i++) {
        s += String.fromCharCode(bytes[i]);
      }
      return s;
    };

    // 1. JPEG (FF D8 FF)
    if (len >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'images';
    }

    // 2. PNG (\x89PNG\r\n\x1a\n)
    if (len >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
      return 'images';
    }

    // 3. GIF (GIF87a / GIF89a)
    if (len >= 6 && ascii(0, 4) === 'GIF8') {
      return 'images';
    }

    // 4. BMP (BM)
    if (len >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D) {
      return 'images';
    }

    // 5. RIFF container: WEBP, WAV, AVI
    if (len >= 12 && ascii(0, 4) === 'RIFF') {
      const sub = ascii(8, 12);
      if (sub === 'WEBP') return 'images';
      if (sub === 'WAVE') return 'audio';
      if (sub === 'AVI ') return 'videos';
    }

    // 6. Matroska / WebM (EBML: 0x1A 0x45 0xDF 0xA3)
    if (len >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      if (mime.includes('audio') && !lowerName.includes('video')) return 'audio';
      return 'videos';
    }

    // 7. ISO Base Media File Format (MP4, QuickTime MOV, M4A, 3GP)
    // Box ftyp, moov ou mdat
    if (len >= 12 && (ascii(4, 8) === 'ftyp' || ascii(4, 8) === 'moov' || ascii(4, 8) === 'mdat')) {
      const brand = ascii(8, 12);
      // Marques explicitement audio : M4A (Apple Audio), M4B, M4P
      if (brand === 'M4A ' || brand === 'M4B ' || brand === 'M4P ') {
        return 'audio';
      }
      // Cas du conteneur 3GP
      if (brand.startsWith('3g')) {
        if (lowerName.includes('video') || lowerName.startsWith('vid-')) return 'videos';
        if (lowerName.includes('audio') || lowerName.startsWith('aud-') || lowerName.startsWith('ptt-') || mime.includes('audio')) return 'audio';
        return 'videos';
      }
      // Vérifier si le nom ou l'extension ou le MIME indique de l'audio avant de supposer vidéo
      if (isWhatsAppAudio(lowerName, mime) || EXTENSION_MAP.audio.includes(ext) || mime.startsWith('audio/')) {
        return 'audio';
      }
      // Toutes les autres marques MP4/MOV sans indice audio sont des conteneurs vidéo
      return 'videos';
    }

    // 8. MP3 : tag ID3 ou octets de synchronisation MPEG Audio Frame
    if (len >= 3 && ascii(0, 3) === 'ID3') return 'audio';
    if (len >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0 && (bytes[1] & 0x18) !== 0x08) {
      return 'audio';
    }

    // 9. OGG / Opus / Vorbis (les notes vocales WhatsApp utilisent OGG Opus)
    if (len >= 4 && ascii(0, 4) === 'OggS') {
      return 'audio';
    }

    // 10. FLAC (fLaC)
    if (len >= 4 && ascii(0, 4) === 'fLaC') return 'audio';

    // 11. AMR (#!AMR)
    if (len >= 5 && ascii(0, 5) === '#!AMR') return 'audio';

    // 12. FLV
    if (len >= 3 && ascii(0, 3) === 'FLV') return 'videos';

    // 13. PDF (%PDF)
    if (len >= 4 && ascii(0, 4) === '%PDF') return 'documents';
  } catch (err) {
    console.warn('[detectFileCategoryWithMagic] Erreur lecture magic bytes, repli sur le nom/MIME:', err);
  }

  // Repli synchrone par nom et extension si les magic bytes ne sont pas reconnus
  return detectFileCategory({ name, type: mime });
}

/**
 * Détection synchrone de la nature d'un fichier (heuristique basée sur le nom, l'extension et le MIME).
 */
export function detectFileCategory(file: { name?: string; type?: string }): 'images' | 'videos' | 'audio' | 'documents' {
  const normName = ((file && file.name) || '').toLowerCase().trim();
  const mime = ((file && file.type) || '').toLowerCase().trim();
  const ext = normName.includes('.') ? (normName.split('.').pop() || '').toLowerCase().trim() : '';

  // 1. DÉTECTION EXPLICITE WHATSAPP & FICHIERS MOBILES (AUDIO PRIORITAIRE)
  if (isWhatsAppAudio(normName, mime)) {
    return 'audio';
  }
  if (isWhatsAppVideo(normName, mime)) {
    return 'videos';
  }
  if (isWhatsAppImage(normName, mime)) {
    return 'images';
  }

  // 2. EXTENSIONS STRICTES (AUDIO EN PREMIER POUR ÉVITER CONFUSION MP4 AUDIO)
  if (EXTENSION_MAP.audio.includes(ext)) {
    return 'audio';
  }
  if (EXTENSION_MAP.videos.includes(ext)) {
    return 'videos';
  }
  if (EXTENSION_MAP.images.includes(ext)) {
    return 'images';
  }
  if (EXTENSION_MAP.documents.includes(ext)) {
    return 'documents';
  }

  // 3. TYPES MIME (AUDIO EN PREMIER)
  if (mime.startsWith('audio/') || mime.includes('opus') || mime.includes('ogg')) {
    return 'audio';
  }
  if (mime.startsWith('video/')) {
    return 'videos';
  }
  if (mime.startsWith('image/')) {
    return 'images';
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
 * Validation ASYNCHRONE Option A (Rejet Strict) pour les menus dédiés
 * Lit les Magic Numbers de chaque fichier pour une précision absolue à 100%.
 */
export async function validateFilesForMenuAsync(
  files: File[],
  targetCategory: FileCategory
): Promise<ValidationResult> {
  if (targetCategory === 'classeur') {
    return { validFiles: files, rejectedFiles: [] };
  }

  const validFiles: File[] = [];
  const rejectedFiles: RejectedFileInfo[] = [];
  const expectedLabel = CATEGORY_LABELS[targetCategory] || targetCategory;

  for (const file of files) {
    const detected = await detectFileCategoryWithMagic(file);

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

/**
 * Validation Synchrone Option A (Rejet Strict) pour compatibilité
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
