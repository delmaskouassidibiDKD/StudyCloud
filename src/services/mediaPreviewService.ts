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

/**
 * Extrait les métadonnées audio et la pochette d'album réelle (Artwork) de manière purement native et ultra-rapide (ID3v2 & M4A)
 */
export async function extractAudioMetadataWithTags(fileOrBlob: File | Blob): Promise<AudioMetadataResult> {
  const result: AudioMetadataResult = {};

  try {
    const sliceLen = Math.min(fileOrBlob.size, 5 * 1024 * 1024);
    const slice = fileOrBlob.slice(0, sliceLen);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Parsing ID3v2 (MP3, WAV, FLAC)
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
          const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
          const frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
          if (frameSize <= 0 || offset + 6 + frameSize > maxOffset) break;

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
            let p = dataOffset + 1;
            const imgFormat = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2]).toLowerCase();
            p += 3;
            p++; // picType
            while (p < dataOffset + frameSize && bytes[p] !== 0) p++;
            p++;
            const imgData = bytes.subarray(p, dataOffset + frameSize);
            if (imgData.length > 50) {
              const mime = imgFormat === 'png' ? 'image/png' : 'image/jpeg';
              result.coverUrl = `data:${mime};base64,${bytesToBase64(imgData)}`;
            }
          }
          offset += 6 + frameSize;
        }
      } else {
        // ID3v2.3 ou ID3v2.4 (tags 4 caractères: TIT2, TPE1, TALB, APIC)
        while (offset < maxOffset - 10) {
          if (bytes[offset] === 0) break; // Fin des frames / padding

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

          if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

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
            let p = dataOffset + 1;
            let mime = '';
            while (p < dataOffset + frameSize && bytes[p] !== 0) {
              mime += String.fromCharCode(bytes[p++]);
            }
            p++; // Sauter zéro terminal
            if (!mime || mime.length < 3) mime = 'image/jpeg';
            if (!mime.includes('/')) mime = `image/${mime.toLowerCase()}`;

            p++; // Picture type (ex 0x03 Front cover)

            // Sauter la description selon l'encodage
            if (encoding === 1 || encoding === 2) {
              while (p < dataOffset + frameSize - 1 && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
              p += 2;
            } else {
              while (p < dataOffset + frameSize && bytes[p] !== 0) p++;
              p++;
            }

            const imgData = bytes.subarray(p, dataOffset + frameSize);
            if (imgData.length > 50) {
              result.coverUrl = `data:${mime};base64,${bytesToBase64(imgData)}`;
            }
          }

          offset += 10 + frameSize;
        }
      }
    }

    // 2. Parsing M4A / MP4 / AAC (recherche d'atom 'covr' dans le conteneur)
    if (!result.coverUrl) {
      try {
        let p = 0;
        const max = Math.min(bytes.length - 8, 512 * 1024);
        while (p < max) {
          if (bytes[p] === 0x63 && bytes[p + 1] === 0x6f && bytes[p + 2] === 0x76 && bytes[p + 3] === 0x72) {
            let dataPos = p + 4;
            while (dataPos < Math.min(p + 256, bytes.length - 8)) {
              if (bytes[dataPos + 4] === 0x64 && bytes[dataPos + 5] === 0x61 && bytes[dataPos + 6] === 0x74 && bytes[dataPos + 7] === 0x61) {
                const dataSize = (bytes[dataPos] << 24) | (bytes[dataPos + 1] << 16) | (bytes[dataPos + 2] << 8) | bytes[dataPos + 3];
                const imgStart = dataPos + 16;
                const imgEnd = dataPos + dataSize;
                if (imgEnd <= bytes.length && imgEnd - imgStart > 50) {
                  const imgBytes = bytes.subarray(imgStart, imgEnd);
                  const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50;
                  const mime = isPng ? 'image/png' : 'image/jpeg';
                  result.coverUrl = `data:${mime};base64,${bytesToBase64(imgBytes)}`;
                }
                break;
              }
              dataPos++;
            }
            break;
          }
          p++;
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[mediaPreviewService] Extraction métadonnées audio:', e);
  }

  return result;
}

// Configuration du worker PDF.js local
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const previewMemoryCache = new Map<string, string>();

/**
 * Récupère un aperçu en mémoire vive par sa clé (id, url, nom)
 */
export function getCachedMediaThumbnail(key: string): string | null {
  if (!key) return null;
  return previewMemoryCache.get(key) || null;
}

/**
 * Récupère un aperçu de façon asynchrone (RAM + IndexedDB)
 */
export async function getAsyncMediaThumbnail(key: string): Promise<string | null> {
  if (!key) return null;
  const inMem = previewMemoryCache.get(key);
  if (inMem) return inMem;
  try {
    const inIdb = await getThumbnailData(key);
    if (inIdb) {
      previewMemoryCache.set(key, inIdb);
      return inIdb;
    }
  } catch {}
  return null;
}

/**
 * Enregistre un aperçu dans le cache mémoire et IndexedDB
 */
export function setCachedMediaThumbnail(key: string, thumbUrl: string): void {
  if (!key || !thumbUrl) return;
  // Limite stricte pour éviter l'épuisement de mémoire vive (max 60 vignettes)
  if (previewMemoryCache.size > 60) {
    const firstKey = previewMemoryCache.keys().next().value;
    if (firstKey) previewMemoryCache.delete(firstKey);
  }
  previewMemoryCache.set(key, thumbUrl);
  if (thumbUrl.startsWith('data:image') || thumbUrl.includes('/api/cloud/thumbnail')) {
    storeThumbnailData(key, thumbUrl).catch(() => {});
  }
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
      previewMemoryCache.set(cacheKey, dataUrl);
    }
    return dataUrl;
  } catch (err) {
    // Si échec (ex: CORS ou PDF corrompu), on renvoie null pour fallback élégant
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

    // 1. Tenter d'extraire la pochette via métadonnées ID3/MP4
    try {
      const meta = await extractAudioMetadataWithTags(targetBlob);
      if (meta.coverUrl) {
        return meta.coverUrl;
      }
    } catch {}

    // 2. Scanner rapide ID3 APIC sur max 256 Ko (fichiers locaux)
    const maxScanLen = Math.min(targetBlob.size, 256 * 1024);
    const headerSlice = targetBlob.slice(0, maxScanLen);
    const buffer = await headerSlice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Vérifier l'en-tête ID3 (0x49, 0x44, 0x33)
    if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const tagSize = ((bytes[6] & 0x7f) << 21) |
                      ((bytes[7] & 0x7f) << 14) |
                      ((bytes[8] & 0x7f) << 7) |
                      (bytes[9] & 0x7f);

      const maxScan = Math.min(bytes.length, tagSize + 10);
      let offset = 10;

      while (offset < maxScan - 10) {
        // Rechercher le frame "APIC" (Attached Picture)
        if (
          bytes[offset] === 0x41 && // A
          bytes[offset + 1] === 0x50 && // P
          bytes[offset + 2] === 0x49 && // I
          bytes[offset + 3] === 0x43    // C
        ) {
          const frameSize = (bytes[offset + 4] << 24) |
                            (bytes[offset + 5] << 16) |
                            (bytes[offset + 6] << 8) |
                            bytes[offset + 7];

          if (frameSize > 0 && offset + 10 + frameSize <= bytes.length) {
            let p = offset + 10;
            const encoding = bytes[p++];
            
            let mime = '';
            while (p < maxScan && bytes[p] !== 0) {
              mime += String.fromCharCode(bytes[p++]);
            }
            p++;

            if (!mime || mime.length < 3) mime = 'image/jpeg';
            p++; // Picture type

            if (encoding === 0 || encoding === 3) {
              while (p < maxScan && bytes[p] !== 0) p++;
              p++;
            } else {
              while (p < maxScan - 1 && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
              p += 2;
            }

            const imgBytes = bytes.slice(p, offset + 10 + frameSize);
            if (imgBytes.length > 100) {
              return `data:${mime};base64,${bytesToBase64(imgBytes)}`;
            }
          }
          break; // Sortir après le frame APIC
        }
        offset++;
      }
    }
  } catch (err) {
    console.warn('[mediaPreviewService] Impossible d\'extraire la pochette ID3:', err);
  }

  // Fallback élégant : pochette créateur officielle StudyCloud
  return generateAudioCreatorCover(title || '', artist);
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

