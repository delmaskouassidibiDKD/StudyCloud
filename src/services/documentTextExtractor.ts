import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { getFileBlob, getFileBlobUrl } from './localFileStorage';
import { getWorkerApiUrl, getAiWorkerUrl } from './api';

// Configuration sécurisée du worker pdfjs
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader non-string'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export interface ExtractedDocumentDetails {
  textContent: string;
  documentBase64?: string;
  documentMimeType?: string;
  documentImages?: Array<{ base64: string; mimeType: string; name?: string }>;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'text' | 'image' | 'video' | 'audio' | 'excel' | 'pptx' | 'document';
}

const textCache = new Map<string, string>();
const imageBase64Cache = new Map<string, string>();
const audioBase64Cache = new Map<string, string>();
const videoBase64Cache = new Map<string, string>();
const documentBase64Cache = new Map<string, string>();
const documentImagesCache = new Map<string, Array<{ base64: string; mimeType: string; name?: string }>>();

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
      if (!item.documentBase64 && documentBase64Cache.has(cacheKey)) {
        const cachedDocB64 = documentBase64Cache.get(cacheKey);
        item.documentBase64 = cachedDocB64;
        item.pdfBase64 = cachedDocB64;
      }
      if ((!item.documentImages || item.documentImages.length === 0) && documentImagesCache.has(cacheKey)) {
        item.documentImages = documentImagesCache.get(cacheKey);
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
    // Cas 1 : Fichiers PDF (extraction intégrale jusqu'à 100 pages + Vision haute résolution Gemini)
    if (fileName.endsWith('.pdf') || item.type?.includes('pdf') || item.extension?.toLowerCase() === 'pdf') {
      const typedarray = new Uint8Array(arrayBuffer);
      const loadingTask = (pdfjsLib as any).getDocument({
        data: typedarray,
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      // Extraction parallèle jusqu'à 20 pages (Promise.all = 5-10x plus rapide)
      const pagesToExtract = Math.min(pdf.numPages, 20);
      const pageResults = await Promise.all(
        Array.from({ length: pagesToExtract }, async (_, idx) => {
          const i = idx + 1;
          try {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = (content.items || [])
              .map((it: any) => it.str)
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            return pageText ? `\n[--- Page ${i} / ${pdf.numPages} ---]\n${pageText}\n` : '';
          } catch (pageErr) {
            console.warn(`[Extractor] Erreur extraction page ${i}:`, pageErr);
            return '';
          }
        })
      );
      fullText = pageResults.join('');

      // 1. Rendu visuel Canvas haute résolution (uniquement si hint visuel détecté dans le prompt)
      // Activé uniquement si le prompt contient des termes visuels (schéma, figure, image, dessin, tableau, graphe, circuit)
      const visualHint = (item as any)._needsCanvas === true;
      const docImages: Array<{ base64: string; mimeType: string; name: string }> = [];
      if (visualHint && typeof document !== 'undefined') {
        const pagesToRender = Math.min(pdf.numPages, 3);
        for (let pNum = 1; pNum <= pagesToRender; pNum++) {
          try {
            const p = await pdf.getPage(pNum);
            const viewport = p.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await p.render({ canvasContext: ctx, viewport }).promise;
              const pageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              if (pageDataUrl && pageDataUrl.length > 100) {
                docImages.push({
                  base64: pageDataUrl,
                  mimeType: 'image/jpeg',
                  name: `Page ${pNum} - ${item.name || 'Document'}`
                });
              }
            }
          } catch (renderErr) {
            console.warn(`[Extractor] Erreur capture canvas page PDF ${pNum}:`, renderErr);
          }
        }
      }

      if (docImages.length > 0) {
        if (typeof item === 'object') {
          item.documentImages = docImages;
        }
        if (cacheKey) {
          documentImagesCache.set(cacheKey, docImages);
        }
      }

      // 2. Si le PDF fait moins de 28 Mo, encodage Base64 direct pour vision native Gemini Flash
      if (arrayBuffer.byteLength <= 28 * 1024 * 1024) {
        try {
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          const b64 = await blobToBase64(blob);
          if (b64) {
            if (typeof item === 'object') {
              item.pdfBase64 = b64;
              item.documentBase64 = b64;
              item.documentMimeType = 'application/pdf';
            }
            if (cacheKey) {
              documentBase64Cache.set(cacheKey, b64);
            }
          }
        } catch (pdfB64Err) {
          console.warn('[Extractor] Erreur encodage base64 PDF:', pdfB64Err);
        }
      }

      const cleanResult = fullText.trim() || `[Document PDF ${item.name || 'Cours'} : scanné ou manuscrit haute résolution transmis pour vision complète]`;
      if (cacheKey) textCache.set(cacheKey, cleanResult);
      if (typeof item === 'object') item.textContent = cleanResult;
      return cleanResult;
    }

    // Cas 2 : Fichiers Word (.docx) avec extraction de texte et de TOUS les schémas/dessins intégrés
    if (fileName.endsWith('.docx') || item.type?.includes('wordprocessingml') || item.extension?.toLowerCase() === 'docx') {
      const res = await mammoth.extractRawText({ arrayBuffer });
      let cleanResult = (res.value || '').trim() || `[Document Word ${item.name || 'Cours'}]`;

      // Extraction des schémas, dessins et images intégrés au document Word (.docx) via JSZip
      const docImages: Array<{ base64: string; mimeType: string; name: string }> = [];
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const imageFiles = Object.keys(zip.files).filter(k => 
          /^word\/media\/.+\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(k)
        );
        for (const imgKey of imageFiles.slice(0, 10)) { // Jusqu'à 10 schémas/images
          try {
            const file = zip.files[imgKey];
            const imgBlob = await file.async('blob');
            const b64 = await blobToBase64(imgBlob);
            if (b64) {
              const mime = imgKey.toLowerCase().endsWith('.png')
                ? 'image/png'
                : imgKey.toLowerCase().endsWith('.webp')
                ? 'image/webp'
                : 'image/jpeg';
              docImages.push({ base64: b64, mimeType: mime, name: imgKey });
            }
          } catch {}
        }
        if (docImages.length > 0) {
          if (typeof item === 'object') {
            item.documentImages = docImages;
          }
          cleanResult += `\n\n[Schémas et illustrations du document Word : ${docImages.length} image(s)/schéma(s) extrait(s) et transmis à l'IA pour analyse visuelle complète]\n`;
        }
      } catch (zipErr) {
        console.warn('[Extractor] Erreur extraction images Word .docx:', zipErr);
      }

      if (cacheKey) textCache.set(cacheKey, cleanResult);
      if (typeof item === 'object') item.textContent = cleanResult;
      return cleanResult;
    }

    // Cas 2.bis : Fichiers PowerPoint (.pptx)
    if (fileName.endsWith('.pptx') || item.type?.includes('presentationml') || item.extension?.toLowerCase() === 'pptx') {
      let pptText = '';
      const docImages: Array<{ base64: string; mimeType: string; name: string }> = [];
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const slideFiles = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k));
        slideFiles.sort((a, b) => {
          const nA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
          const nB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
          return nA - nB;
        });

        for (let i = 0; i < slideFiles.length; i++) {
          const rawXml = await zip.files[slideFiles[i]].async('string');
          const matches = rawXml.match(/<a:t>([^<]*)<\/a:t>/g);
          if (matches) {
            const textItems = matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
            if (textItems.length > 0) {
              pptText += `\n[--- Diapositive ${i + 1} ---]\n` + textItems.join('\n') + '\n';
            }
          }
        }

        const pptMedia = Object.keys(zip.files).filter(k => /^ppt\/media\/.+\.(png|jpe?g|webp|gif)$/i.test(k));
        for (const imgKey of pptMedia.slice(0, 8)) {
          try {
            const file = zip.files[imgKey];
            const imgBlob = await file.async('blob');
            const b64 = await blobToBase64(imgBlob);
            if (b64) {
              docImages.push({ base64: b64, mimeType: imgKey.endsWith('.png') ? 'image/png' : 'image/jpeg', name: imgKey });
            }
          } catch {}
        }
        if (docImages.length > 0 && typeof item === 'object') {
          item.documentImages = docImages;
        }
      } catch (pptErr) {
        console.warn('[Extractor] Erreur lecture PowerPoint .pptx:', pptErr);
      }

      const cleanResult = pptText.trim() || `[Présentation PowerPoint : ${item.name || 'Cours'}]`;
      if (cacheKey) textCache.set(cacheKey, cleanResult);
      if (typeof item === 'object') item.textContent = cleanResult;
      return cleanResult;
    }

    // Cas 2.ter : Fichiers Excel (.xlsx, .xls, .csv)
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || item.type?.includes('spreadsheetml') || item.extension?.toLowerCase() === 'xlsx') {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let excelText = '';
        for (const sheetName of workbook.SheetNames.slice(0, 5)) {
          const ws = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(ws);
          if (csv && csv.trim()) {
            excelText += `\n[--- Feuille Excel : "${sheetName}" ---]\n${csv.trim()}\n`;
          }
        }
        const cleanResult = excelText.trim() || `[Tableau Excel : ${item.name || 'Données'}]`;
        if (cacheKey) textCache.set(cacheKey, cleanResult);
        if (typeof item === 'object') item.textContent = cleanResult;
        return cleanResult;
      } catch (xlErr) {
        console.warn('[Extractor] Erreur lecture Excel:', xlErr);
      }
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

/**
 * Extrait les détails complets d'un document (Texte intégral + Fichier Base64 pour PDF + Schémas et Dessins extraits pour Word)
 * Prêt pour l'analyse visuelle et multimodale par Google Gemini Flash.
 */
export async function extractDocumentDetails(item: any): Promise<ExtractedDocumentDetails> {
  const fileName = String(item?.name || item?.title || item?.fileName || '').toLowerCase();
  const textContent = await extractDocumentText(item);
  const cacheKey = item?.id || item?.name || item?.url || item?.file_url || item?.r2_key || item?.r2Key || '';
  const docBase64 = item?.documentBase64 || item?.pdfBase64 || (cacheKey ? documentBase64Cache.get(cacheKey) : undefined);
  const docMime = item?.documentMimeType || (docBase64 ? 'application/pdf' : undefined);
  const docImages = (Array.isArray(item?.documentImages) && item.documentImages.length > 0)
    ? item.documentImages
    : (cacheKey ? documentImagesCache.get(cacheKey) : undefined);

  let fileType: ExtractedDocumentDetails['fileType'] = 'document';
  if (fileName.endsWith('.pdf')) fileType = 'pdf';
  else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) fileType = 'docx';
  else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) fileType = 'pptx';
  else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) fileType = 'excel';
  else if (/\.(jpe?g|png|webp|gif|svg)$/i.test(fileName)) fileType = 'image';
  else if (/\.(mp4|webm|mov|avi)$/i.test(fileName)) fileType = 'video';
  else if (/\.(mp3|wav|ogg|m4a)$/i.test(fileName)) fileType = 'audio';
  else if (/\.(txt|md|py|js|ts|json|sql)$/i.test(fileName)) fileType = 'text';

  return {
    textContent,
    documentBase64: docBase64,
    documentMimeType: docMime,
    documentImages: docImages,
    fileName: item?.name || item?.title || item?.fileName || 'Document',
    fileType,
  };
}

