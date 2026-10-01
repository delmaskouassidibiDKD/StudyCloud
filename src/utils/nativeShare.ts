import { getFileBlob } from '../services/localFileStorage';

export interface ShareableFile {
  id?: string;
  name: string;
  url?: string;
  previewUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  category?: string;
  extension?: string;
  size?: number | string;
  sizeBytes?: number;
  type?: string;
}

/**
 * Détecte le type MIME d'un fichier à partir de son extension ou son nom
 */
function getMimeType(fileName: string, explicitType?: string): string {
  if (explicitType && explicitType.includes('/')) return explicitType;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mimeMap: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    // Vidéos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    opus: 'audio/opus',
    weba: 'audio/webm',
    amr: 'audio/amr',
    // Documents
    pdf: 'application/pdf',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Effectue un partage normal (WhatsApp, Telegram, Web Share API natif du téléphone ou PC)
 */
export async function handleNativeShare(
  file: ShareableFile,
  showToast?: (message: string) => void
): Promise<void> {
  const directUrl = file.url || file.previewUrl || file.videoUrl || file.audioUrl || '';
  const webUrl = (directUrl && directUrl.startsWith('http') && !directUrl.startsWith('blob:'))
    ? directUrl
    : `${window.location.origin}/?fileId=${encodeURIComponent(file.id || '')}&category=${encodeURIComponent(file.category || 'files')}`;

  const shareTitle = file.name || 'Fichier StudyCloud';
  const shareText = `Fichier partagé via StudyCloud : ${file.name}`;

  // 1. Tenter le partage natif (Web Share API) disponible sur mobiles (Android/iOS) et navigateurs modernes
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    // A. Tenter de partager directement le vrai fichier binaire si supporté
    if (file.id && typeof File !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const blob = await getFileBlob(file.id);
        if (blob) {
          const mime = blob.type || getMimeType(file.name, file.type);
          const fileObj = new File([blob], file.name, { type: mime });
          if (navigator.canShare({ files: [fileObj] })) {
            await navigator.share({
              files: [fileObj],
              title: shareTitle,
              text: shareText
            });
            showToast?.('Partage réussi !');
            return;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // L'utilisateur a simplement fermé la fenêtre de partage
          return;
        }
        console.warn('Partage de fichier direct non supporté, essai lien:', err);
      }
    }

    // B. Partager le lien et texte via Web Share API
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: webUrl
      });
      showToast?.('Partage réussi !');
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.warn('navigator.share a échoué, repli vers WhatsApp:', err);
    }
  }

  // 2. Repli universel (PC ou navigateur sans Web Share) : WhatsApp & Presse-papiers
  try {
    const waMessage = encodeURIComponent(`${shareText}\n${webUrl}`);
    const waUrl = `https://api.whatsapp.com/send?text=${waMessage}`;
    window.open(waUrl, '_blank');

    try {
      await navigator.clipboard.writeText(webUrl);
      showToast?.('Ouverture de WhatsApp & lien copié ! 📲');
    } catch {
      showToast?.('Ouverture de WhatsApp... 📲');
    }
  } catch (err) {
    console.error('Erreur lors du partage WhatsApp:', err);
    showToast?.(`Partage de "${file.name}"`);
  }
}
