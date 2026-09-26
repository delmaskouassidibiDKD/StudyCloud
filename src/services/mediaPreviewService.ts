/**
 * Service de génération et de mise en cache des aperçus réels pour tous types de fichiers :
 * - Vidéos (capture d'une image/frame à 0.5s par canvas)
 * - Documents PDF (rendu haute fidélité de la page 1 via pdfjs)
 * - Documents Office / Texte (génération de structure visuelle dynamique)
 */

import * as pdfjsLib from 'pdfjs-dist';

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
 * Enregistre un aperçu dans le cache mémoire
 */
export function setCachedMediaThumbnail(key: string, thumbUrl: string): void {
  if (!key || !thumbUrl) return;
  previewMemoryCache.set(key, thumbUrl);
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
      if (fileOrBlob.startsWith('http') || fileOrBlob.startsWith('/') || fileOrBlob.startsWith('blob:')) {
        try {
          const resp = await fetch(fileOrBlob, {
            headers: { Range: 'bytes=0-524287' },
          });
          if (resp && (resp.ok || resp.status === 206)) {
            targetBlob = await resp.blob();
          }
        } catch {
          // Si le range request échoue (ex: CORS), fallback sur cover SVG
          return generateAudioCreatorCover(title || '', artist);
        }
      }
    } else if (fileOrBlob instanceof Blob) {
      targetBlob = fileOrBlob;
    }

    if (!targetBlob) {
      return generateAudioCreatorCover(title || '', artist);
    }

    // Lire les premiers 512 Ko du fichier audio (là où se trouvent les métadonnées ID3v2)
    const headerSlice = targetBlob.slice(0, 512 * 1024);
    const buffer = await headerSlice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Vérifier l'en-tête ID3 (0x49, 0x44, 0x33)
    if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      // Taille syncsafe ID3
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
          // Taille du frame APIC
          const frameSize = (bytes[offset + 4] << 24) |
                            (bytes[offset + 5] << 16) |
                            (bytes[offset + 6] << 8) |
                            bytes[offset + 7];

          if (frameSize > 0 && offset + 10 + frameSize <= bytes.length) {
            let p = offset + 10;
            const encoding = bytes[p++];
            
            // MIME type (chaîne terminée par 0)
            let mime = '';
            while (p < maxScan && bytes[p] !== 0) {
              mime += String.fromCharCode(bytes[p++]);
            }
            p++; // Sauter le zéro terminal du MIME

            if (!mime || mime.length < 3) mime = 'image/jpeg';

            // Picture type (ex: 0x03 Front cover)
            p++;

            // Description (sauter jusqu'au terminateur)
            if (encoding === 0 || encoding === 3) {
              while (p < maxScan && bytes[p] !== 0) p++;
              p++;
            } else {
              while (p < maxScan - 1 && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
              p += 2;
            }

            // Données binaires de l'image
            const imgBytes = bytes.slice(p, offset + 10 + frameSize);
            if (imgBytes.length > 100) {
              // Convertir en Blob puis en DataURL
              let binary = '';
              const len = imgBytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(imgBytes[i]);
              }
              const base64 = btoa(binary);
              return `data:${mime};base64,${base64}`;
            }
          }
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
    return generateVideoFallbackPoster(title || (typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.name));
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

