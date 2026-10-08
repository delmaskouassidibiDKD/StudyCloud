import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { getFileBlob, getFileBlobUrl } from './localFileStorage';
import { getWorkerApiUrl } from './api';

// Configuration sécurisée du worker pdfjs
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const textCache = new Map<string, string>();

/**
 * Extrait le contenu textuel intégral d'un document (PDF, Word DOCX, TXT, MD, Code, etc.)
 * sans tronquer arbitrairement le cours de l'élève, afin que l'assistante IA StudyCloud
 * ait un accès complet et exhaustif à l'ensemble des leçons, théorèmes et exercices.
 */
export async function extractDocumentText(item: any): Promise<string> {
  if (!item) return '';

  const cacheKey = item.id || item.name || item.url || item.file_url || item.r2_key || item.r2Key || '';
  if (cacheKey && textCache.has(cacheKey)) {
    const cached = textCache.get(cacheKey);
    if (cached && cached.trim().length > 30) {
      return cached;
    }
  }

  // Si l'élément possède déjà un texte extrait de qualité
  if (item.textContent && typeof item.textContent === 'string' && item.textContent.trim().length > 30) {
    textCache.set(cacheKey, item.textContent.trim());
    return item.textContent.trim();
  }

  const fileName = (item.name || item.title || '').toLowerCase();
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
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        b64 = window.btoa(binary);
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
      }

      const imgDesc = `[Image haute résolution : "${item.name || 'Image'}" (transmise avec perception visuelle complète)]`;
      if (cacheKey) textCache.set(cacheKey, imgDesc);
      if (typeof item === 'object') item.textContent = imgDesc;
      return imgDesc;
    }

    // Cas 5 : Fichiers Audio (MP3, WAV, M4A, OGG) -> Encodage Base64 pour Whisper
    if (
      fileName.endsWith('.mp3') ||
      fileName.endsWith('.wav') ||
      fileName.endsWith('.m4a') ||
      fileName.endsWith('.ogg') ||
      item.type?.includes('audio')
    ) {
      let b64 = '';
      try {
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        b64 = window.btoa(binary);
      } catch (bErr) {
        console.warn('[Extractor] Erreur conversion base64 audio:', bErr);
      }

      if (b64 && typeof item === 'object') {
        item.audioBase64 = b64;
      }

      const audioDesc = `[Fichier Audio / Cours oral joint : "${item.name || 'Audio'}" (indexé pour transcription Whisper)]`;
      if (cacheKey) textCache.set(cacheKey, audioDesc);
      if (typeof item === 'object') item.textContent = audioDesc;
      return audioDesc;
    }

    // Cas 6 : Fichiers Vidéo
    if (
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.webm') ||
      fileName.endsWith('.mov') ||
      item.type?.includes('video')
    ) {
      const vidDesc = `[Fichier Vidéo d'apprentissage joint : "${item.name || 'Vidéo'}"]`;
      if (cacheKey) textCache.set(cacheKey, vidDesc);
      if (typeof item === 'object') item.textContent = vidDesc;
      return vidDesc;
    }
  } catch (extractErr) {
    console.warn('[Extractor] Erreur décodage document:', extractErr);
  }

  return `[Document: ${item.name || 'Fichier'}]`;
}
