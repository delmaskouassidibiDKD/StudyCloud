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
 * Génère la vignette réelle d'une vidéo en extrayant une frame à 0.5s
 */
export async function generateVideoThumbnail(
  fileOrUrl: File | Blob | string,
  cacheKey?: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

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

      const timeout = setTimeout(() => {
        if (!isString) URL.revokeObjectURL(videoUrl);
        resolve(null);
      }, 4000);

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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
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
        if (!isString) URL.revokeObjectURL(videoUrl);
        resolve(null);
      };

      video.onerror = () => {
        clearTimeout(timeout);
        if (!isString) URL.revokeObjectURL(videoUrl);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
