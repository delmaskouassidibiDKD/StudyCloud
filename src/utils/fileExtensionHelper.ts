/**
 * Utilitaires universels pour la préservation et la gestion
 * de l'extension technique des fichiers (ex: .mp4, .jpg, .pdf, .mp3, etc.)
 */

/**
 * Extrait l'extension technique d'un fichier (ex: 'mp4', 'jpg', 'pdf', 'mp3').
 */
export function getTechnicalExtension(file: any): string {
  if (!file) return '';

  // 1. Depuis le nom original du fichier s'il a un point
  if (typeof file.name === 'string' && file.name.includes('.')) {
    const parts = file.name.trim().split('.');
    const lastPart = parts[parts.length - 1].trim().toLowerCase();
    // Les extensions courantes font entre 1 et 6 caractères alphanumériques
    if (lastPart.length >= 1 && lastPart.length <= 6 && /^[a-z0-9]+$/i.test(lastPart)) {
      return lastPart;
    }
  }

  // 2. Depuis le champ `extension` s'il est renseigné
  if (typeof file.extension === 'string' && file.extension.trim()) {
    const ext = file.extension.trim().toLowerCase().replace(/^\./, '');
    if (ext.length >= 1 && ext.length <= 6 && /^[a-z0-9]+$/i.test(ext)) {
      return ext;
    }
  }

  // 3. Depuis le champ `type` (MIME type)
  if (typeof file.type === 'string' && file.type.trim()) {
    const t = file.type.toLowerCase();
    if (t.includes('pdf')) return 'pdf';
    if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
    if (t.includes('png')) return 'png';
    if (t.includes('webp')) return 'webp';
    if (t.includes('gif')) return 'gif';
    if (t.includes('svg')) return 'svg';
    if (t.includes('mp4')) return 'mp4';
    if (t.includes('quicktime') || t.includes('mov')) return 'mov';
    if (t.includes('webm')) return 'webm';
    if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
    if (t.includes('wav')) return 'wav';
    if (t.includes('ogg')) return 'ogg';
    if (t.includes('m4a') || t.includes('aac')) return 'm4a';
    if (t.includes('word') || t.includes('docx') || t.includes('msword')) return 'docx';
    if (t.includes('sheet') || t.includes('excel') || t.includes('spreadsheet')) return 'xlsx';
    if (t.includes('presentation') || t.includes('powerpoint')) return 'pptx';
    if (t.includes('text/plain')) return 'txt';
  }

  // 4. Depuis la catégorie ou les drapeaux booléens
  const cat = (file.category || file.originalCategory || '').toLowerCase();
  if (cat === 'images' || file.isImage) return 'jpg';
  if (cat === 'videos' || file.isVideo) return 'mp4';
  if (cat === 'audio' || file.isAudio) return 'mp3';
  if (file.isPdf || cat === 'documents') return 'pdf';

  return '';
}

/**
 * Garantit que le nouveau nom de fichier conserve impérativement son extension technique.
 * Même si l'utilisateur efface l'extension dans le prompt/champ de saisie,
 * l'extension technique originale (.mp4, .jpg, .pdf, .mp3, etc.) est automatiquement rajoutée.
 * Si l'utilisateur a déjà inclus l'extension, on ne la duplique pas.
 */
export function ensureFileExtension(newName: string, file: any): string {
  const trimmed = (newName || '').trim();
  if (!trimmed) return trimmed;

  const ext = getTechnicalExtension(file);
  if (!ext) return trimmed;

  const dotExt = `.${ext.toLowerCase()}`;

  // Si le nouveau nom se termine déjà exactement par cette extension (insensible à la casse)
  if (trimmed.toLowerCase().endsWith(dotExt)) {
    return trimmed;
  }

  // Si l'utilisateur a tapé une autre extension valide (ex: .png au lieu de .jpg)
  const otherExtMatch = trimmed.match(/\.([a-z0-9]{2,5})$/i);
  if (otherExtMatch) {
    return trimmed;
  }

  // Si l'utilisateur a effacé l'extension ou tapé un nom sans extension, on l'ajoute automatiquement !
  return `${trimmed}.${ext}`;
}

/**
 * Retourne le nom du fichier sans son extension technique.
 */
export function getFileBaseName(name: string): string {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  if (idx > 0 && idx < name.length - 1) {
    const ext = name.substring(idx + 1);
    if (ext.length <= 6 && /^[a-z0-9]+$/i.test(ext)) {
      return name.substring(0, idx);
    }
  }
  return name;
}
