/**
 * Service de génération et de mise en cache des aperçus réels pour tous types de fichiers :
 * - Vidéos (capture d'une image/frame à 0.5s par canvas)
 * - Documents PDF (rendu haute fidélité de la page 1 via pdfjs)
 * - Documents Office / Texte (génération de structure visuelle dynamique)
 */

import * as pdfjsLib from 'pdfjs-dist';
import { storeThumbnailData, getThumbnailData } from './localFileStorage';

export interface AudioMetadataResult {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  durationSec?: number;
}

function decodeTextFrame(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      return new TextDecoder('utf-16').decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
    }
  } catch {}
  let res = '';
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) res += String.fromCharCode(bytes[i]);
  }
  return res.trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, sub as any);
  }
  return window.btoa(binary);
}

function findEmbeddedImage(bytes: Uint8Array, start = 0, end = bytes.length): string | null {
  const max = Math.min(bytes.length, end);
  const minLen = 128;
  for (let i = start; i < max - 8; i++) {
    // 1. JPEG: FF D8 FF
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
      let eof = -1;
      // Rechercher le marqueur de fin JPEG (FF D9)
      for (let j = i + 10; j < Math.min(bytes.length - 1, i + 8 * 1024 * 1024); j++) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
          eof = j + 2;
          break;
        }
      }
      const imgLen = (eof > i) ? (eof - i) : Math.min(max - i, 8 * 1024 * 1024);
      if (imgLen >= minLen) {
        const imgBytes = bytes.subarray(i, i + imgLen);
        return `data:image/jpeg;base64,${bytesToBase64(imgBytes)}`;
      }
    }
    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4E && bytes[i + 3] === 0x47 &&
      bytes[i + 4] === 0x0D && bytes[i + 5] === 0x0A && bytes[i + 6] === 0x1A && bytes[i + 7] === 0x0A
    ) {
      let eof = -1;
      // Rechercher le chunk IEND (49 45 4E 44) + 4 octets CRC
      for (let j = i + 8; j < Math.min(bytes.length - 7, i + 8 * 1024 * 1024); j++) {
        if (bytes[j] === 0x49 && bytes[j + 1] === 0x45 && bytes[j + 2] === 0x4E && bytes[j + 3] === 0x44) {
          eof = j + 8;
          break;
        }
      }
      const imgLen = (eof > i) ? (eof - i) : Math.min(max - i, 8 * 1024 * 1024);
      if (imgLen >= minLen) {
        const imgBytes = bytes.subarray(i, i + imgLen);
        return `data:image/png;base64,${bytesToBase64(imgBytes)}`;
      }
    }
    // 3. WebP: RIFF .... WEBP
    if (
      bytes[i] === 0x52 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0x46 && bytes[i + 3] === 0x46 &&
      bytes[i + 8] === 0x57 && bytes[i + 9] === 0x45 && bytes[i + 10] === 0x42 && bytes[i + 11] === 0x50
    ) {
      const size = (bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24)) + 8;
      const imgLen = Math.min(size, bytes.length - i);
      if (imgLen >= minLen) {
        const imgBytes = bytes.subarray(i, i + imgLen);
        return `data:image/webp;base64,${bytesToBase64(imgBytes)}`;
      }
    }
  }
  return null;
}

/**
 * Extrait les métadonnées audio et la pochette d'album réelle (Artwork) de manière purement native et ultra-rapide (ID3v2, M4A, FLAC, OGG)
 */
export async function extractAudioMetadataWithTags(fileOrBlob: File | Blob): Promise<AudioMetadataResult> {
  const result: AudioMetadataResult = {};

  try {
    const sliceLen = Math.min(fileOrBlob.size, 8 * 1024 * 1024);
    const slice = fileOrBlob.slice(0, sliceLen);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Parsing ID3v2 (MP3, WAV, AIFF)
    if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const version = bytes[3]; // 2 (ID3v2.2), 3 (ID3v2.3), 4 (ID3v2.4)
      const tagSize = ((bytes[6] & 0x7f) << 21) |
                      ((bytes[7] & 0x7f) << 14) |
                      ((bytes[8] & 0x7f) << 7) |
                      (bytes[9] & 0x7f);

      const maxOffset = Math.min(bytes.length, tagSize + 10);
      let offset = 10;

      if (version === 2) {
        // ID3v2.2 (tags 3 caractères: TT2, TP1, TAL, PIC)
        while (offset < maxOffset - 6) {
          if (bytes[offset] === 0 && bytes[offset + 1] === 0 && bytes[offset + 2] === 0) {
            offset++;
            continue;
          }
          const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
          const frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
          if (frameSize <= 0 || offset + 6 + frameSize > bytes.length) {
            offset++;
            continue;
          }

          const dataOffset = offset + 6;
          const encoding = bytes[dataOffset];
          const frameBytes = bytes.subarray(dataOffset + 1, dataOffset + frameSize);

          if (frameId === 'TT2' && !result.title) {
            result.title = decodeTextFrame(frameBytes, encoding);
          } else if (frameId === 'TP1' && !result.artist) {
            result.artist = decodeTextFrame(frameBytes, encoding);
          } else if (frameId === 'TAL' && !result.album) {
            result.album = decodeTextFrame(frameBytes, encoding);
          } else if (frameId === 'PIC' && !result.coverUrl) {
            const foundCover = findEmbeddedImage(bytes, dataOffset, dataOffset + frameSize);
            if (foundCover) {
              result.coverUrl = foundCover;
            }
          }
          offset += 6 + frameSize;
        }
      } else {
        // ID3v2.3 ou ID3v2.4 (tags 4 caractères: TIT2, TPE1, TALB, APIC)
        while (offset < maxOffset - 10) {
          if (bytes[offset] === 0 && bytes[offset + 1] === 0 && bytes[offset + 2] === 0 && bytes[offset + 3] === 0) {
            offset++;
            continue;
          }

          const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
          let frameSize = 0;
          if (version === 4) {
            frameSize = ((bytes[offset + 4] & 0x7f) << 21) |
                        ((bytes[offset + 5] & 0x7f) << 14) |
                        ((bytes[offset + 6] & 0x7f) << 7) |
                        (bytes[offset + 7] & 0x7f);
          } else {
            frameSize = (bytes[offset + 4] << 24) |
                        (bytes[offset + 5] << 16) |
                        (bytes[offset + 6] << 8) |
                        bytes[offset + 7];
          }

          if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) {
            offset++;
            continue;
          }

          const dataOffset = offset + 10;
          const encoding = bytes[dataOffset];
          const frameBytes = bytes.subarray(dataOffset + 1, dataOffset + frameSize);

          if (frameId === 'TIT2' && !result.title) {
            result.title = decodeTextFrame(frameBytes, encoding);
          } else if (frameId === 'TPE1' && !result.artist) {
            result.artist = decodeTextFrame(frameBytes, encoding);
          } else if (frameId === 'TALB' && !result.album) {
            result.album = decodeTextFrame(frameBytes, encoding);
          } else if (frameId === 'APIC' && !result.coverUrl) {
            // Extraction directe haute précision de l'image JPEG/PNG dans la frame APIC
            const foundCover = findEmbeddedImage(bytes, dataOffset, dataOffset + frameSize);
            if (foundCover) {
              result.coverUrl = foundCover;
            }
          }

          offset += 10 + frameSize;
        }
      }
    }

    // 2. Recherche directe de l'identifiant 'APIC' si l'analyse par offset séquentiel a manqué la frame
    if (!result.coverUrl) {
      for (let i = 0; i < Math.min(bytes.length - 20, 6 * 1024 * 1024); i++) {
        if (bytes[i] === 0x41 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x49 && bytes[i + 3] === 0x43) {
          const foundCover = findEmbeddedImage(bytes, i + 4, Math.min(bytes.length, i + 4 + 6 * 1024 * 1024));
          if (foundCover) {
            result.coverUrl = foundCover;
            break;
          }
        }
      }
    }

    // 3. Parsing M4A / MP4 / AAC (recherche d'atom 'covr' dans tout le conteneur)
    if (!result.coverUrl) {
      try {
        for (let p = 0; p < Math.min(bytes.length - 8, 8 * 1024 * 1024); p++) {
          if (bytes[p] === 0x63 && bytes[p + 1] === 0x6f && bytes[p + 2] === 0x76 && bytes[p + 3] === 0x72) {
            const foundCover = findEmbeddedImage(bytes, p + 4, Math.min(bytes.length, p + 4 + 6 * 1024 * 1024));
            if (foundCover) {
              result.coverUrl = foundCover;
              break;
            }
          }
        }
      } catch {}
    }

    // 4. Parsing FLAC (bloc METADATA_BLOCK_PICTURE ou fLaC)
    if (!result.coverUrl && bytes.length > 4 && bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
      const foundCover = findEmbeddedImage(bytes, 4, bytes.length);
      if (foundCover) {
        result.coverUrl = foundCover;
      }
    }

    // 5. Recherche globale dans les premiers Mo si aucune structure formelle n'a été résolue
    if (!result.coverUrl) {
      const foundCover = findEmbeddedImage(bytes, 0, Math.min(bytes.length, 5 * 1024 * 1024));
      if (foundCover) {
        result.coverUrl = foundCover;
      }
    }

    // 6. Scan de fin de fichier (moov en fin de conteneur M4A / MP4)
    if (!result.coverUrl && fileOrBlob.size > 5 * 1024 * 1024) {
      try {
        const tailLen = Math.min(fileOrBlob.size, 2 * 1024 * 1024);
        const tailSlice = fileOrBlob.slice(fileOrBlob.size - tailLen);
        const tailBuf = await tailSlice.arrayBuffer();
        const tailBytes = new Uint8Array(tailBuf);
        const foundTail = findEmbeddedImage(tailBytes, 0, tailBytes.length);
        if (foundTail) {
          result.coverUrl = foundTail;
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[mediaPreviewService] Extraction métadonnées audio:', e);
  }

  // 3. Extraction systématique et précise de la durée du son (en secondes)
  try {
    const dur = await getAudioBlobDuration(fileOrBlob);
    if (dur > 0) {
      result.durationSec = Math.round(dur * 100) / 100;
    }
  } catch {}

  return result;
}

// Configuration du worker PDF.js local
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const previewMemoryCache = new Map<string, string>();

/**
 * Récupère un aperçu en mémoire vive par sa clé — DÉSACTIVÉ pour éviter l'accumulation Base64 en RAM
 */
export function getCachedMediaThumbnail(_key: string): string | null {
  return null;
}

/**
 * Récupère un aperçu de façon asynchrone — DÉSACTIVÉ pour éviter l'accumulation locale
 */
export async function getAsyncMediaThumbnail(_key: string): Promise<string | null> {
  return null;
}

/**
 * Enregistre un aperçu — DÉSACTIVÉ pour éviter la duplication Base64 en RAM et IndexedDB
 */
export function setCachedMediaThumbnail(_key: string, _thumbUrl: string): void {
  return;
}

/**
 * Détermine la durée réelle d'un blob audio (File ou Blob) avec une fiabilité maximale
 * en combinant l'élément Audio et le Web Audio API (decodeAudioData).
 */
export async function getAudioBlobDuration(fileOrBlob: File | Blob): Promise<number> {
  if (typeof window === 'undefined' || !fileOrBlob) return 0;

  // Méthode 1 : Audio element via Blob URL
  try {
    const url = URL.createObjectURL(fileOrBlob);
    try {
      const d = await probeAudioDuration(url, 4000);
      if (d > 0) return d;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {}

  // Méthode 2 : Décodage Web Audio API (parfait pour WhatsApp Opus, AAC, MP3 avec métadonnées tronquées)
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      try {
        const sliceSize = Math.min(fileOrBlob.size, 8 * 1024 * 1024);
        const ab = await fileOrBlob.slice(0, sliceSize).arrayBuffer();
        const decoded = await ctx.decodeAudioData(ab);
        if (decoded && Number.isFinite(decoded.duration) && decoded.duration > 0) {
          return decoded.duration;
        }
      } finally {
        ctx.close().catch(() => {});
      }
    }
  } catch {}

  return 0;
}

/**
 * Lit la durée réelle d'un son (en secondes) en ne chargeant QUE les métadonnées.
 * Aucun stockage local : l'élément audio temporaire est détruit immédiatement après lecture.
 */
export function probeAudioDuration(src: string, timeoutMs = 12000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !src) { resolve(0); return; }
    const el = document.createElement('audio');
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      el.onloadedmetadata = null;
      el.ondurationchange = null;
      el.onseeked = null;
      el.ontimeupdate = null;
      el.oncanplay = null;
      el.onerror = null;
      try {
        el.removeAttribute('src');
        el.load();
      } catch { }
      resolve(Number.isFinite(value) && value > 0 && value !== Infinity ? value : 0);
    };

    el.preload = 'metadata';
    el.muted = true;
    // NOTE : On ne force JAMAIS el.crossOrigin = 'anonymous' ici car cela bloque
    // la lecture des métadonnées dès qu'un serveur/CDN omet ou filtre les en-têtes CORS.

    const checkDuration = () => {
      if (Number.isFinite(el.duration) && el.duration > 0 && el.duration !== Infinity) {
        finish(el.duration);
        return true;
      }
      return false;
    };

    el.onloadedmetadata = () => {
      if (!checkDuration()) {
        // Formats spéciaux (VBR, WhatsApp, opus, webm) annonçant une durée infinie initialement
        if (el.duration === Infinity) {
          try {
            el.currentTime = 1e6;
          } catch {}
        }
      }
    };

    el.ondurationchange = () => {
      checkDuration();
    };

    el.onseeked = () => {
      if (!checkDuration() && Number.isFinite(el.currentTime) && el.currentTime > 0) {
        finish(el.currentTime);
      }
    };

    el.ontimeupdate = () => {
      checkDuration();
    };

    el.oncanplay = () => {
      checkDuration();
    };

    el.onerror = () => finish(0);
    timer = setTimeout(() => finish(0), timeoutMs);
    el.src = src;
    try {
      el.load();
    } catch { }
  });
}

/**
 * Génère la miniature réelle de la première page d'un PDF
 */
export async function generatePdfThumbnail(
  fileOrUrl: File | Blob | string,
  cacheKey?: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (cacheKey && previewMemoryCache.has(cacheKey)) {
    return previewMemoryCache.get(cacheKey)!;
  }

  try {
    let loadingTask: any;

    if (typeof fileOrUrl === 'string') {
      loadingTask = pdfjsLib.getDocument({ url: fileOrUrl, cMapPacked: true });
    } else {
      const arrayBuffer = await fileOrUrl.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      loadingTask = pdfjsLib.getDocument({ data: typedArray, cMapPacked: true });
    }

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (cacheKey) {
      if (previewMemoryCache.size > 10) {
        const oldest = previewMemoryCache.keys().next().value;
        if (oldest) previewMemoryCache.delete(oldest);
      }
      previewMemoryCache.set(cacheKey, dataUrl);
    }
    return dataUrl;
  } catch (err) {
    // Si échec (ex: CORS ou PDF corrompu), on renvoie null pour fallback élégant
    return null;
  }
}

/**
 * Génère une miniature visuelle haute fidélité pour n'importe quel document (PDF, Word, Excel, PowerPoint, Texte...)
 */
export async function generateDocumentThumbnail(
  fileOrUrl: File | Blob | string,
  cacheKey?: string,
  fileName?: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const name = typeof fileOrUrl === 'string' ? fileOrUrl : (fileOrUrl as File).name || fileName || 'Document';
  const ext = (name.includes('.') ? name.split('.').pop() || 'pdf' : 'pdf').toLowerCase();
  const isPdf = ext === 'pdf' || (typeof fileOrUrl !== 'string' && (fileOrUrl as any).type?.includes('pdf'));

  if (isPdf) {
    try {
      const pdfThumb = await generatePdfThumbnail(fileOrUrl, cacheKey);
      if (pdfThumb) return pdfThumb;
    } catch {}
  }

  // Pour Word, Excel, PPTX, TXT ou si le rendu PDF échoue : création d'une image de couverture de document nette et élégante
  try {
    const width = 360;
    const height = 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Couleurs selon le type
    let primaryColor = '#2563eb'; // Bleu Word par défaut
    let badgeText = 'DOC';
    if (ext === 'pdf') {
      primaryColor = '#dc2626'; // Rouge PDF
      badgeText = 'PDF';
    } else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      primaryColor = '#16a34a'; // Vert Excel
      badgeText = ext.toUpperCase();
    } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
      primaryColor = '#ea580c'; // Orange PPT
      badgeText = ext.toUpperCase();
    } else if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      primaryColor = '#2563eb'; // Bleu Word
      badgeText = ext.toUpperCase();
    } else {
      primaryColor = '#475569'; // Gris ardoise texte
      badgeText = ext.toUpperCase();
    }

    // Fond blanc avec légère teinte
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // En-tête coloré élégant
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, width, 52);

    // Titre StudyCloud dans l'en-tête
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('StudyCloud Document', 18, 33);

    // Badge d'extension dans l'en-tête
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(width - 75, 14, 58, 24, 6);
    } else {
      ctx.rect(width - 75, 14, 58, 24);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, width - 46, 31);
    ctx.textAlign = 'left';

    // Corps de page : zone blanche stylisée (effet feuille A4)
    const pageX = 20;
    const pageY = 68;
    const pageW = width - 40;
    const pageH = height - 88;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pageX, pageY, pageW, pageH, 8);
    } else {
      ctx.rect(pageX, pageY, pageW, pageH);
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Bordure fine
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Titre du document nettoyé
    const cleanTitle = name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';

    // Retour à la ligne pour le titre
    const words = cleanTitle.split(' ');
    let line = '';
    let currentY = pageY + 36;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > pageW - 36 && i > 0) {
        ctx.fillText(line.trim(), pageX + 18, currentY);
        line = words[i] + ' ';
        currentY += 20;
        if (currentY > pageY + 80) break;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), pageX + 18, currentY);
      currentY += 26;
    }

    // Ligne de séparation sous le titre
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pageX + 18, currentY);
    ctx.lineTo(pageX + 80, currentY);
    ctx.stroke();
    currentY += 24;

    // Rendu visuel selon le format : Tableur vs Texte vs Présentation
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      const gridX = pageX + 18;
      const gridW = pageW - 36;
      const cellH = 18;
      const cols = 3;
      const colW = gridW / cols;

      ctx.fillStyle = '#dcfce7';
      ctx.fillRect(gridX, currentY, gridW, cellH);
      ctx.strokeStyle = '#86efac';
      ctx.strokeRect(gridX, currentY, gridW, cellH);

      for (let r = 0; r < 7; r++) {
        const rowY = currentY + (r + 1) * cellH;
        if (rowY + cellH > pageY + pageH - 40) break;
        ctx.fillStyle = r % 2 === 0 ? '#f0fdf4' : '#ffffff';
        ctx.fillRect(gridX, rowY, gridW, cellH);
        ctx.strokeStyle = '#dcfce7';
        ctx.strokeRect(gridX, rowY, gridW, cellH);

        for (let c = 1; c < cols; c++) {
          ctx.beginPath();
          ctx.moveTo(gridX + c * colW, rowY);
          ctx.lineTo(gridX + c * colW, rowY + cellH);
          ctx.stroke();
        }

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(gridX + 8, rowY + 6, colW - 20, 6);
      }
    } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
      const slideX = pageX + 18;
      const slideW = pageW - 36;
      const slideH = 120;
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(slideX, currentY, slideW, slideH);
      ctx.strokeStyle = '#fdba74';
      ctx.strokeRect(slideX, currentY, slideW, slideH);

      ctx.fillStyle = primaryColor;
      ctx.fillRect(slideX + 16, currentY + 20, slideW - 50, 10);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(slideX + 16, currentY + 44, slideW - 32, 6);
      ctx.fillRect(slideX + 16, currentY + 58, slideW - 60, 6);
      ctx.fillRect(slideX + 16, currentY + 72, slideW - 40, 6);
    } else {
      const textX = pageX + 18;
      const textW = pageW - 36;
      const widths = [0.95, 0.9, 0.82, 0.65, 0.92, 0.88, 0.75, 0.9, 0.85, 0.4];

      for (let l = 0; l < widths.length; l++) {
        const lineY = currentY + l * 18;
        if (lineY > pageY + pageH - 45) break;
        ctx.fillStyle = l === 3 ? '#94a3b8' : '#cbd5e1';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(textX, lineY, textW * widths[l], 7, 3);
        } else {
          ctx.rect(textX, lineY, textW * widths[l], 7);
        }
        ctx.fill();
      }
    }

    // Pied de page : numéro de page et badge sécurisé
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Page 1', pageX + 18, pageY + pageH - 14);
    ctx.textAlign = 'right';
    ctx.fillText('StudyCloud Cloud Storage', pageX + pageW - 18, pageY + pageH - 14);
    ctx.textAlign = 'left';

    const thumbData = canvas.toDataURL('image/jpeg', 0.85);
    return thumbData;
  } catch (err) {
    console.warn('[generateDocumentThumbnail] Échec canvas doc:', err);
    return null;
  }
}

/**
 * Génère un poster SVG stylisé haute fidélité pour une vidéo
 * Évite complètement l'écran noir/gris si l'extraction canvas échoue
 */
export function generateVideoFallbackPoster(title: string, duration?: string): string {
  const cleanTitle = (title || 'Vidéo StudyCloud')
    .replace(/[<>&"]/g, '')
    .substring(0, 30);
  const dur = duration || 'HD 1080p';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="100%" height="100%">
    <defs>
      <linearGradient id="vBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="50%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
      <linearGradient id="vBtn" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a855f7" />
        <stop offset="100%" stop-color="#6366f1" />
      </linearGradient>
      <filter id="vGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <rect width="480" height="320" fill="url(#vBg)" />
    <!-- Lignes de pellicule cinéma discrètes en haut et bas -->
    <rect x="0" y="0" width="480" height="14" fill="#020617" opacity="0.8" />
    <g fill="#334155" opacity="0.6">
      <rect x="20" y="3" width="14" height="8" rx="2" />
      <rect x="50" y="3" width="14" height="8" rx="2" />
      <rect x="80" y="3" width="14" height="8" rx="2" />
      <rect x="110" y="3" width="14" height="8" rx="2" />
      <rect x="140" y="3" width="14" height="8" rx="2" />
      <rect x="170" y="3" width="14" height="8" rx="2" />
      <rect x="200" y="3" width="14" height="8" rx="2" />
      <rect x="230" y="3" width="14" height="8" rx="2" />
      <rect x="260" y="3" width="14" height="8" rx="2" />
      <rect x="290" y="3" width="14" height="8" rx="2" />
      <rect x="320" y="3" width="14" height="8" rx="2" />
      <rect x="350" y="3" width="14" height="8" rx="2" />
      <rect x="380" y="3" width="14" height="8" rx="2" />
      <rect x="410" y="3" width="14" height="8" rx="2" />
      <rect x="440" y="3" width="14" height="8" rx="2" />
    </g>
    <!-- Cercle Play central avec halo violet -->
    <circle cx="240" cy="150" r="42" fill="url(#vBtn)" filter="url(#vGlow)" opacity="0.9" />
    <polygon points="232,134 256,150 232,166" fill="#ffffff" />
    <!-- Titre et Badge -->
    <rect x="24" y="260" width="432" height="40" rx="8" fill="#000000" opacity="0.6" />
    <text x="36" y="285" fill="#f8fafc" font-size="14" font-weight="bold" font-family="system-ui, sans-serif">${cleanTitle}</text>
    <rect x="380" y="270" width="66" height="20" rx="4" fill="#a855f7" opacity="0.3" />
    <text x="413" y="284" fill="#d8b4fe" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle">${dur}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Génère la pochette d'artiste / marque du créateur pour un fichier audio
 * Si le fichier n'a pas de tag ID3 cover ou lors d'un affichage sans pochette
 */
export function generateAudioCreatorCover(title: string, artist?: string): string {
  const cleanTitle = (title || 'Piste Audio')
    .replace(/[<>&"]/g, '')
    .substring(0, 26);
  const cleanArtist = (artist || 'StudyCloud Music Creator')
    .replace(/[<>&"]/g, '')
    .substring(0, 28);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
    <defs>
      <radialGradient id="discBg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1c1917" />
        <stop offset="60%" stop-color="#0c0a09" />
        <stop offset="100%" stop-color="#000000" />
      </radialGradient>
      <linearGradient id="amberGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="50%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#b45309" />
      </linearGradient>
      <linearGradient id="brandNeon" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="100%" stop-color="#f97316" />
      </linearGradient>
    </defs>
    <!-- Fond principal du vinyle -->
    <rect width="400" height="400" fill="url(#discBg)" />
    <!-- Rainures vinyles acoustiques élégantes -->
    <circle cx="200" cy="200" r="185" fill="none" stroke="#292524" stroke-width="1.5" opacity="0.6" />
    <circle cx="200" cy="200" r="165" fill="none" stroke="#292524" stroke-width="1" opacity="0.5" />
    <circle cx="200" cy="200" r="145" fill="none" stroke="#292524" stroke-width="1.5" opacity="0.6" />
    <circle cx="200" cy="200" r="125" fill="none" stroke="#292524" stroke-width="1" opacity="0.5" />
    <circle cx="200" cy="200" r="105" fill="none" stroke="#292524" stroke-width="1" opacity="0.4" />
    <!-- Label central vinyle coloré (Marque du Créateur) -->
    <circle cx="200" cy="200" r="82" fill="url(#amberGold)" stroke="#fef3c7" stroke-width="2" />
    <circle cx="200" cy="200" r="76" fill="none" stroke="#78350f" stroke-width="1" stroke-dasharray="3,3" />
    <!-- Trou central du vinyle -->
    <circle cx="200" cy="200" r="16" fill="#0c0a09" stroke="#fef3c7" stroke-width="3" />
    <!-- Logo Notes et Spectre musical -->
    <g transform="translate(180, 142)">
      <path d="M6 14V3L20 1V12" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <ellipse cx="4" cy="14" rx="4" ry="3" fill="#ffffff" />
      <ellipse cx="18" cy="12" rx="4" ry="3" fill="#ffffff" />
    </g>
    <!-- Bandeau Créateur en haut -->
    <rect x="20" y="24" width="360" height="34" rx="10" fill="#000000" opacity="0.7" />
    <text x="200" y="46" fill="url(#brandNeon)" font-size="12" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle" letter-spacing="2">★ CRÉATEUR AUDIO OFFICIEL ★</text>
    <!-- Cartouche Titre et Artiste en bas -->
    <rect x="20" y="324" width="360" height="54" rx="12" fill="#000000" opacity="0.85" stroke="#f59e0b" stroke-width="1" />
    <text x="200" y="348" fill="#ffffff" font-size="14" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="middle">${cleanTitle}</text>
    <text x="200" y="366" fill="#fbbf24" font-size="11" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${cleanArtist}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Extrait la véritable pochette d'album (APIC frame ID3) depuis un fichier MP3/Audio
 * Renvoie une Data URL image JPEG/PNG si trouvée, sinon renvoie la pochette Créateur stylisée
 */
export async function extractAudioCover(
  fileOrBlob: File | Blob | string,
  title?: string,
  artist?: string
): Promise<string> {
  if (typeof window === 'undefined') {
    return generateAudioCreatorCover(title || '', artist);
  }

  try {
    let targetBlob: Blob | null = null;
    if (typeof fileOrBlob === 'string') {
      if (fileOrBlob.startsWith('data:image')) {
        return fileOrBlob;
      }
      // Ne JAMAIS télécharger des flux de 4 Mo sur le réseau juste pour extraire une miniature
      // Utiliser directement la pochette créateur officielle instantanée
      return generateAudioCreatorCover(title || '', artist);
    } else if (fileOrBlob instanceof Blob) {
      targetBlob = fileOrBlob;
    }

    if (!targetBlob) {
      return generateAudioCreatorCover(title || '', artist);
    }

    // 1. Tenter d'extraire la pochette via métadonnées ID3/MP4/FLAC
    try {
      const meta = await extractAudioMetadataWithTags(targetBlob);
      if (meta.coverUrl) {
        return meta.coverUrl;
      }
    } catch {}
  } catch (err) {
    console.warn('[mediaPreviewService] Impossible d\'extraire la pochette ID3:', err);
  }

  // Fallback élégant : pochette créateur officielle StudyCloud
  return generateAudioCreatorCover(title || '', artist);
}

/**
 * Vérifie si une chaîne représente une véritable pochette d'artiste/album (image réelle)
 * et NON pas un SVG vinyle par défaut, une URL audio blob ou une URL vide.
 */
export function isRealEmbeddedArtwork(url?: string | null, track?: { audioUrl?: string; url?: string; isImage?: boolean }): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Rejeter si c'est l'URL audio du fichier lui-même
  if (track) {
    if (track.audioUrl && (trimmed === track.audioUrl || trimmed === track.audioUrl.split('?')[0])) return false;
    if (track.url && !track.isImage && (trimmed === track.url || trimmed === track.url.split('?')[0])) return false;
  }

  const clean = trimmed.toLowerCase().split('?')[0];

  // Rejeter les fichiers audio
  if (clean.match(/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i)) {
    return false;
  }

  // Rejeter les documents et vidéos
  if (clean.match(/\.(pdf|doc|docx|xls|xlsx|txt|mp4|webm|avi|mkv|mov|zip|rar)$/i)) {
    return false;
  }

  // Rejeter le SVG de fallback créateur (vinyle par défaut généré par generateAudioCreatorCover)
  if (clean.startsWith('data:image/svg+xml') && (
    clean.includes('discbg') || clean.includes('ambergold') || clean.includes('brandneon') ||
    clean.includes('studycloud%20music%20creator') || clean.includes('cr%c3%a9ateur%20audio') ||
    clean.includes('enregistrement%20en%20cours') || clean.includes('piste%20audio')
  )) {
    return false;
  }

  // Rejeter les blob URLs car les vraies pochettes extraites sont toujours encodées en data:image/... base64
  // Une URL blob: dans previewUrl/coverUrl est presque systématiquement le flux audio brut qui casse les <img> tags
  if (clean.startsWith('blob:')) {
    return false;
  }

  // Accepter les data URLs d'images réelles (JPEG, PNG, WebP)
  if (clean.startsWith('data:image/jpeg') || clean.startsWith('data:image/jpg') || clean.startsWith('data:image/png') || clean.startsWith('data:image/webp')) {
    return true;
  }

  // Accepter les miniatures Cloudflare Worker
  if (clean.includes('/api/cloud/thumbnail/')) {
    return true;
  }

  // Accepter les extensions d'images réelles
  if (clean.match(/\.(jpg|jpeg|png|webp|gif|avif|bmp)$/i)) {
    return true;
  }

  // Accepter les URLs HTTP/HTTPS d'images
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return true;
  }

  return false;
}


/**
 * Génère la vignette réelle d'une vidéo en extrayant une frame à 0.5s
 * Si indisponible ou échec CORS, renvoie immédiatement un poster SVG stylisé
 */
export async function generateVideoThumbnail(
  fileOrUrl: File | Blob | string,
  cacheKey?: string,
  title?: string
): Promise<string> {
  if (typeof window === 'undefined') {
    return generateVideoFallbackPoster(title || (typeof fileOrUrl === 'string' ? fileOrUrl : (fileOrUrl as any).name || 'Vidéo'));
  }

  if (cacheKey && previewMemoryCache.has(cacheKey)) {
    return previewMemoryCache.get(cacheKey)!;
  }

  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const isString = typeof fileOrUrl === 'string';
      const videoUrl = isString ? fileOrUrl : URL.createObjectURL(fileOrUrl);
      video.src = videoUrl;
      video.currentTime = 0.5;

      const fallback = () => {
        const poster = generateVideoFallbackPoster(title || (isString ? videoUrl.split('/').pop() || '' : (fileOrUrl as File).name));
        if (cacheKey) previewMemoryCache.set(cacheKey, poster);
        if (!isString) URL.revokeObjectURL(videoUrl);
        resolve(poster);
      };

      const timeout = setTimeout(() => {
        fallback();
      }, 3500);

      video.onloadeddata = () => {
        try {
          const seekTime = Math.min(0.5, (video.duration || 1) / 2);
          video.currentTime = seekTime;
        } catch {}
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, video.videoWidth || 320);
          canvas.height = Math.min(480, video.videoHeight || 240);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            clearTimeout(timeout);
            if (!isString) URL.revokeObjectURL(videoUrl);
            if (cacheKey) {
              previewMemoryCache.set(cacheKey, dataUrl);
            }
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          // Erreur d'export canvas (ex: cross-origin)
        }
        clearTimeout(timeout);
        fallback();
      };

      video.onerror = () => {
        clearTimeout(timeout);
        fallback();
      };

      video.load();
    } catch {
      resolve(generateVideoFallbackPoster(title || 'Vidéo'));
    }
  });
}

