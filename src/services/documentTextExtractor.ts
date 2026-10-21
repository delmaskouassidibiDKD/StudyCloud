import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { getFileBlob, getFileBlobUrl } from './localFileStorage';
import { getWorkerApiUrl, getAiWorkerUrl } from './api';

// Configuration sécurisée du worker pdfjs
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const textCache = new Map<string, string>();
const imageBase64Cache = new Map<string, string>();
const audioBase64Cache = new Map<string, string>();
const videoBase64Cache = new Map<string, string>();

/**
 * Résout de manière exhaustive et infaillible l'image Base64 pour l'IA multimodale Gemini :
 * 1. Propriété imageBase64 en mémoire ou cache
 * 2. DataURL existant dans l'objet
 * 3. Blob / File direct en mémoire
 * 4. Cache binaire IndexedDB local
 * 5. URL Blob locale
 * 6. Téléchargement distant (item.url, item.fileUrl, item.file_url, item.previewUrl)
 * 7. Route Cloudflare Worker R2 (/api/storage/file/:key)
 * 8. Route Cloudflare Worker Stream (/api/cloud/stream/:id)
 * 9. Capture DOM Canvas de l'image ouverte dans le visualiseur d'étude
 */
export async function resolveImageBase64(item: any, cacheKey?: string): Promise<string> {
  if (!item) return '';
  const key = cacheKey || item.id || item.name || item.url || item.file_url || item.r2_key || item.r2Key || '';

  // 1. Déjà en mémoire ou cache
  if (item.imageBase64 && typeof item.imageBase64 === 'string' && item.imageBase64.length > 50) {
    return item.imageBase64;
  }
  if (key && imageBase64Cache.has(key)) {
    const cached = imageBase64Cache.get(key);
    if (cached && cached.length > 50) {
      if (typeof item === 'object') item.imageBase64 = cached;
      return cached;
    }
  }

  // 2. Data URL déjà présent dans l'objet
  const directDataUrl = (typeof item.url === 'string' && item.url.startsWith('data:image/') ? item.url : null)
    || (typeof item.previewUrl === 'string' && item.previewUrl.startsWith('data:image/') ? item.previewUrl : null)
    || (typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.startsWith('data:image/') ? item.thumbnailUrl : null)
    || (typeof item.base64 === 'string' ? (item.base64.startsWith('data:') ? item.base64 : `data:image/jpeg;base64,${item.base64}`) : null);

  if (directDataUrl) {
    if (typeof item === 'object') item.imageBase64 = directDataUrl;
    if (key) imageBase64Cache.set(key, directDataUrl);
    return directDataUrl;
  }

  let arrayBuffer: ArrayBuffer | null = null;

  // 3. Objet mémoire direct (Blob, File)
  try {
    if (item instanceof Blob && typeof item.arrayBuffer === 'function') {
      arrayBuffer = await item.arrayBuffer();
    } else if (item.file instanceof Blob && typeof item.file.arrayBuffer === 'function') {
      arrayBuffer = await item.file.arrayBuffer();
    } else if (item.blob instanceof Blob && typeof item.blob.arrayBuffer === 'function') {
      arrayBuffer = await item.blob.arrayBuffer();
    } else if (item.data instanceof ArrayBuffer) {
      arrayBuffer = item.data;
    } else if (typeof item.arrayBuffer === 'function') {
      arrayBuffer = await item.arrayBuffer();
    }
  } catch (e) {}

  // 4. IndexedDB
  if (!arrayBuffer && item.id) {
    try {
      const blob = await getFileBlob(item.id);
      if (blob && typeof blob.arrayBuffer === 'function') {
        arrayBuffer = await blob.arrayBuffer();
      }
    } catch (e) {}
  }

  // 5. Blob URL
  if (!arrayBuffer && item.id) {
    try {
      const blobUrl = await getFileBlobUrl(item.id);
      if (blobUrl) {
        const res = await fetch(blobUrl);
        if (res.ok) arrayBuffer = await res.arrayBuffer();
      }
    } catch (e) {}
  }

  // 6. Toutes les URLs distantes potentielles
  if (!arrayBuffer) {
    const urlsToTry = [
      item.url,
      item.fileUrl,
      item.file_url,
      item.previewUrl,
      item.thumbnailUrl,
      item.downloadUrl,
      item.src
    ].filter((u): u is string => typeof u === 'string' && Boolean(u.trim()) && !u.startsWith('data:') && !u.startsWith('blob:'));

    for (const u of urlsToTry) {
      try {
        const res = await fetch(u);
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength > 100) break;
        }
      } catch (e) {}
    }
  }

  // 7. Route R2 Cloudflare Worker
  const r2Key = item.r2_key || item.r2Key;
  if (!arrayBuffer && r2Key) {
    const candidateR2Urls = [
      `${getWorkerApiUrl().replace(/\/+$/, '')}/api/storage/file/${encodeURIComponent(r2Key)}`,
      `${getAiWorkerUrl().replace(/\/+$/, '')}/api/storage/file/${encodeURIComponent(r2Key)}`,
    ];
    for (const r2Url of candidateR2Urls) {
      try {
        const res = await fetch(r2Url);
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength > 100) break;
        }
      } catch (e) {}
    }
  }

  // 8. Route Streaming Cloudflare Worker si fileId
  if (!arrayBuffer && item.id) {
    const candidateStreamUrls = [
      `${getWorkerApiUrl().replace(/\/+$/, '')}/api/cloud/stream/${encodeURIComponent(item.id)}`,
      `${getAiWorkerUrl().replace(/\/+$/, '')}/api/cloud/stream/${encodeURIComponent(item.id)}`,
    ];
    for (const sUrl of candidateStreamUrls) {
      try {
        const res = await fetch(sUrl);
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength > 100) break;
        }
      } catch (e) {}
    }
  }

  // 9. Secours DOM Canvas si l'image est actuellement affichée dans le DOM de la page
  if (!arrayBuffer && typeof document !== 'undefined') {
    try {
      const imgEls = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
      const matchedImg = imgEls.find(img => 
        img.naturalWidth > 50 && 
        !img.src.includes('avatar') && 
        !img.src.includes('icon') &&
        (
          (item.id && img.src.includes(item.id)) ||
          (item.name && (img.alt?.includes(item.name) || img.src.includes(encodeURIComponent(item.name)))) ||
          img.className.includes('modern-image') ||
          img.closest('.modern-image-viewer') !== null
        )
      ) || imgEls.find(img => img.naturalWidth > 150 && !img.src.includes('avatar') && !img.src.includes('icon'));

      if (matchedImg) {
        const canvas = document.createElement('canvas');
        canvas.width = matchedImg.naturalWidth;
        canvas.height = matchedImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(matchedImg, 0, 0);
          const domDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          if (domDataUrl && domDataUrl.length > 100) {
            if (typeof item === 'object') item.imageBase64 = domDataUrl;
            if (key) imageBase64Cache.set(key, domDataUrl);
            return domDataUrl;
          }
        }
      }
    } catch (domErr) {
      console.warn('[Extractor] Capture DOM image échouée:', domErr);
    }
  }

  // Si on a obtenu un arrayBuffer, convertir en Base64
  if (arrayBuffer && arrayBuffer.byteLength > 0) {
    let b64 = '';
    try {
      if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined') {
        const blob = new Blob([arrayBuffer]);
        b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.split(',')[1] || '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      }
      if (!b64) {
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
        }
        b64 = window.btoa(binary);
      }
    } catch (e) {}

    if (b64) {
      const fileName = (item.name || item.title || '').toLowerCase();
      const mime = fileName.endsWith('.png')
        ? 'image/png'
        : fileName.endsWith('.webp')
        ? 'image/webp'
        : fileName.endsWith('.svg')
        ? 'image/svg+xml'
        : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${b64}`;
      if (typeof item === 'object') item.imageBase64 = dataUrl;
      if (key) imageBase64Cache.set(key, dataUrl);
      return dataUrl;
    }
  }

  return '';
}

/**
 * Extrait le contenu textuel intégral d'un document (PDF, Word DOCX, TXT, MD, Code, etc.)
 * sans tronquer arbitrairement le cours de l'élève, afin que l'assistante IA StudyCloud
 * ait un accès complet et exhaustif à l'ensemble des leçons, théorèmes et exercices.
 */
export async function extractDocumentText(item: any): Promise<string> {
  if (!item) return '';

  const cacheKey = item.id || item.name || item.url || item.file_url || item.r2_key || item.r2Key || '';
  const fileName = (item.name || item.title || '').toLowerCase();
  const isImageFile = fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.bmp') ||
    fileName.endsWith('.svg') ||
    item.type?.includes('image') ||
    item.isImage;

  // Synchronisation des pièces multimédias déjà en mémoire si fournies
  if (cacheKey && typeof item === 'object') {
    if (item.imageBase64 && !imageBase64Cache.has(cacheKey)) {
      imageBase64Cache.set(cacheKey, item.imageBase64);
    }
    if (item.audioBase64 && !audioBase64Cache.has(cacheKey)) {
      audioBase64Cache.set(cacheKey, item.audioBase64);
    }
    if (item.videoBase64 && !videoBase64Cache.has(cacheKey)) {
      videoBase64Cache.set(cacheKey, item.videoBase64);
    }
  }

  // Traitement prioritaire et garanti pour les images : résolution Base64
  if (isImageFile) {
    const resolvedB64 = await resolveImageBase64(item, cacheKey);
    if (resolvedB64) {
      const imgDesc = `[Image haute résolution : "${item.name || 'Image'}" (transmise avec perception visuelle complète pour Gemini 2.0 Flash)]`;
      if (cacheKey) textCache.set(cacheKey, imgDesc);
      if (typeof item === 'object') item.textContent = imgDesc;
      return imgDesc;
    }
  }

  if (cacheKey && textCache.has(cacheKey)) {
    // RESTAURATION CRUCIALE : Réinjecter les b64 sur le document pour les tours suivants (message 2, 3...)
    if (typeof item === 'object') {
      if (!item.imageBase64 && imageBase64Cache.has(cacheKey)) {
        item.imageBase64 = imageBase64Cache.get(cacheKey);
      }
      if (!item.audioBase64 && audioBase64Cache.has(cacheKey)) {
        item.audioBase64 = audioBase64Cache.get(cacheKey);
      }
      if (!item.videoBase64 && videoBase64Cache.has(cacheKey)) {
        item.videoBase64 = videoBase64Cache.get(cacheKey);
      }
    }
    if (!isImageFile || item.imageBase64) {
      const cached = textCache.get(cacheKey);
      if (cached && cached.trim().length > 30) {
        return cached;
      }
    }
  }

  // Si l'élément possède déjà un texte extrait de qualité (pour documents non-images)
  if (!isImageFile && item.textContent && typeof item.textContent === 'string' && item.textContent.trim().length > 30) {
    textCache.set(cacheKey, item.textContent.trim());
    return item.textContent.trim();
  }

  let arrayBuffer: ArrayBuffer | null = null;

  // 1. Détection directe si l'objet est déjà un Blob, File ou possède un ArrayBuffer en mémoire
  try {
    if (item instanceof Blob && typeof item.arrayBuffer === 'function') {
      arrayBuffer = await item.arrayBuffer();
    } else if (item.file instanceof Blob && typeof item.file.arrayBuffer === 'function') {
      arrayBuffer = await item.file.arrayBuffer();
    } else if (item.blob instanceof Blob && typeof item.blob.arrayBuffer === 'function') {
      arrayBuffer = await item.blob.arrayBuffer();
    } else if (item.data instanceof ArrayBuffer) {
      arrayBuffer = item.data;
    } else if (typeof item.arrayBuffer === 'function') {
      arrayBuffer = await item.arrayBuffer();
    }
  } catch (directErr) {
    console.warn('[Extractor] Erreur lecture directe buffer:', directErr);
  }

  // 2. Récupération prioritaire depuis IndexedDB local
  if (!arrayBuffer && item.id) {
    try {
      const blob = await getFileBlob(item.id);
      if (blob && typeof blob.arrayBuffer === 'function') {
        arrayBuffer = await blob.arrayBuffer();
      }
    } catch (e) {
      console.warn('[Extractor] Erreur lecture binaire IndexedDB:', e);
    }
  }

  // 3. Récupération via Blob URL locale enregistrée
  if (!arrayBuffer && item.id) {
    try {
      const blobUrl = await getFileBlobUrl(item.id);
      if (blobUrl) {
        const res = await fetch(blobUrl);
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
        }
      }
    } catch (e) {
      console.warn('[Extractor] Erreur lecture blobUrl:', e);
    }
  }

  // 4. Téléchargement via URL directe (R2 / Cloudflare)
  const targetUrl = item.url || item.file_url;
  if (!arrayBuffer && targetUrl) {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        arrayBuffer = await res.arrayBuffer();
      }
    } catch (e) {
      console.warn('[Extractor] Erreur téléchargement distant du document:', e);
    }
  }

  // 5. Téléchargement de secours depuis l'API R2 via la clé de stockage (r2_key)
  const r2Key = item.r2_key || item.r2Key;
  if (!arrayBuffer && r2Key) {
    try {
      const r2Url = `${getWorkerApiUrl().replace(/\/+$/, '')}/api/storage/file/${encodeURIComponent(r2Key)}`;
      const res = await fetch(r2Url);
      if (res.ok) {
        arrayBuffer = await res.arrayBuffer();
      }
    } catch (e) {
      console.warn('[Extractor] Erreur téléchargement R2 direct:', e);
    }
  }

  if (!arrayBuffer) {
    return `[Document: ${item.name || 'Fichier'} (document détecté mais texte binaire non accessible pour le moment)]`;
  }

  try {
    // Cas 1 : Fichiers PDF (extraction intégrale jusqu'à 100 pages)
    if (fileName.endsWith('.pdf') || item.type?.includes('pdf') || item.extension?.toLowerCase() === 'pdf') {
      const typedarray = new Uint8Array(arrayBuffer);
      const loadingTask = (pdfjsLib as any).getDocument({
        data: typedarray,
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      // Extraction jusqu'à 100 pages pour couvrir les polycopiés et cours entiers
      const pagesToExtract = Math.min(pdf.numPages, 100);
      for (let i = 1; i <= pagesToExtract; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = (content.items || [])
            .map((it: any) => it.str)
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (pageText) {
            fullText += `\n[--- Page ${i} / ${pdf.numPages} ---]\n${pageText}\n`;
          }
        } catch (pageErr) {
          console.warn(`[Extractor] Erreur extraction page ${i}:`, pageErr);
        }
      }

      const cleanResult = fullText.trim() || `[Document PDF ${item.name} : texte manuscrit ou scanné en image haute résolution]`;
      if (cacheKey) textCache.set(cacheKey, cleanResult);
      if (typeof item === 'object') item.textContent = cleanResult;
      return cleanResult;
    }

    // Cas 2 : Fichiers Word (.docx)
    if (fileName.endsWith('.docx') || item.type?.includes('wordprocessingml') || item.extension?.toLowerCase() === 'docx') {
      const res = await mammoth.extractRawText({ arrayBuffer });
      const cleanResult = (res.value || '').trim() || `[Document Word ${item.name}]`;
      if (cacheKey) textCache.set(cacheKey, cleanResult);
      if (typeof item === 'object') item.textContent = cleanResult;
      return cleanResult;
    }

    // Cas 3 : Fichiers texte brut, Markdown, JSON, CSV, code
    if (
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.csv') ||
      fileName.endsWith('.py') ||
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts') ||
      fileName.endsWith('.html') ||
      fileName.endsWith('.sql')
    ) {
      const decoded = new TextDecoder('utf-8').decode(arrayBuffer).trim();
      if (cacheKey) textCache.set(cacheKey, decoded);
      if (typeof item === 'object') item.textContent = decoded;
      return decoded;
    }

    // Cas 4 : Images et Schémas (PNG, JPG, JPEG, WEBP, GIF, SVG, BMP) -> Encodage Base64 pour Vision
    if (
      fileName.endsWith('.png') ||
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.webp') ||
      fileName.endsWith('.gif') ||
      fileName.endsWith('.bmp') ||
      fileName.endsWith('.svg') ||
      item.type?.includes('image')
    ) {
      let b64 = '';
      try {
        if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined') {
          const blob = new Blob([arrayBuffer]);
          b64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1] || '');
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
        }
        if (!b64) {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
          }
          b64 = window.btoa(binary);
        }
      } catch (bErr) {
        console.warn('[Extractor] Erreur conversion base64 image:', bErr);
      }

      if (b64) {
        const mime = fileName.endsWith('.png')
          ? 'image/png'
          : fileName.endsWith('.webp')
          ? 'image/webp'
          : fileName.endsWith('.svg')
          ? 'image/svg+xml'
          : 'image/jpeg';
        const dataUrl = `data:${mime};base64,${b64}`;
        if (typeof item === 'object') {
          item.imageBase64 = dataUrl;
        }
        if (cacheKey) {
          imageBase64Cache.set(cacheKey, dataUrl);
        }
        const imgDesc = `[Image haute résolution : "${item.name || 'Image'}" (transmise avec perception visuelle complète pour Gemini 2.0 Flash)]`;
        if (cacheKey) textCache.set(cacheKey, imgDesc);
        if (typeof item === 'object') item.textContent = imgDesc;
        return imgDesc;
      }

      return `[Image : "${item.name || 'Image'}" (binaire image en cours de synchronisation)]`;
    }

    // Cas 5 : Fichiers Audio (MP3, WAV, M4A, OGG) -> Encodage Base64 pour Gemini
    if (
      fileName.endsWith('.mp3') ||
      fileName.endsWith('.wav') ||
      fileName.endsWith('.m4a') ||
      fileName.endsWith('.ogg') ||
      item.type?.includes('audio')
    ) {
      let b64 = '';
      try {
        if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined') {
          const blob = new Blob([arrayBuffer]);
          b64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1] || '');
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
        }
        if (!b64) {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
          }
          b64 = window.btoa(binary);
        }
      } catch (bErr) {
        console.warn('[Extractor] Erreur conversion base64 audio:', bErr);
      }

      if (b64 && typeof item === 'object') {
        item.audioBase64 = b64;
        item.blob = new Blob([arrayBuffer]);
      }
      if (b64 && cacheKey) {
        audioBase64Cache.set(cacheKey, b64);
      }

      const audioDesc = `[Fichier Audio / Cours oral joint : "${item.name || 'Audio'}" (indexé pour écoute et analyse Gemini 2.0 Flash)]`;
      if (cacheKey) textCache.set(cacheKey, audioDesc);
      if (typeof item === 'object') item.textContent = audioDesc;
      return audioDesc;
    }

    // Cas 6 : Fichiers Vidéo (MP4, WebM, MOV) -> Encodage pour Gemini 2.0 Flash
    if (
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.webm') ||
      fileName.endsWith('.mov') ||
      item.type?.includes('video')
    ) {
      let b64 = '';
      if (arrayBuffer.byteLength <= 35 * 1024 * 1024) {
        try {
          if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined') {
            const blob = new Blob([arrayBuffer]);
            b64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1] || '');
              };
              reader.onerror = () => resolve('');
              reader.readAsDataURL(blob);
            });
          }
          if (!b64) {
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
            }
            b64 = window.btoa(binary);
          }
        } catch (bErr) {
          console.warn('[Extractor] Erreur conversion base64 video:', bErr);
        }
      }

      if (typeof item === 'object') {
        if (b64) item.videoBase64 = b64;
        item.blob = new Blob([arrayBuffer]);
        if (targetUrl) item.videoUrl = targetUrl;
      }
      if (b64 && cacheKey) {
        videoBase64Cache.set(cacheKey, b64);
      }

      const vidDesc = `[Fichier Vidéo d'apprentissage joint : "${item.name || 'Vidéo'}" (transmis à Gemini 2.0 Flash pour analyse vidéo multimodale)]`;
      if (cacheKey) textCache.set(cacheKey, vidDesc);
      if (typeof item === 'object') item.textContent = vidDesc;
      return vidDesc;
    }
  } catch (extractErr) {
    console.warn('[Extractor] Erreur décodage document:', extractErr);
  }

  return `[Document: ${item.name || 'Fichier'}]`;
}
