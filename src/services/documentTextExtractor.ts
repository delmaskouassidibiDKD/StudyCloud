import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { getFileBlob } from './localFileStorage';

// Configuration sécurisée du worker pdfjs
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const textCache = new Map<string, string>();

/**
 * Extrait le contenu textuel complet d'un document (PDF, Word DOCX, TXT, MD, JSON, etc.)
 * pour le transmettre en toute sécurité au contexte de l'assistante IA StudyCloud.
 */
export async function extractDocumentText(item: any): Promise<string> {
  if (!item) return '';

  const cacheKey = item.id || item.name || item.url || item.file_url || '';
  if (cacheKey && textCache.has(cacheKey)) {
    return textCache.get(cacheKey)!;
  }

  // Si l'élément possède déjà un texte extrait
  if (item.textContent && typeof item.textContent === 'string' && item.textContent.trim().length > 10) {
    textCache.set(cacheKey, item.textContent.trim());
    return item.textContent.trim();
  }

  const fileName = (item.name || item.title || '').toLowerCase();
  let arrayBuffer: ArrayBuffer | null = null;

  // 1. Récupération prioritaire depuis IndexedDB local
  if (item.id) {
    try {
      const blob = await getFileBlob(item.id);
      if (blob) {
        arrayBuffer = await blob.arrayBuffer();
      }
    } catch (e) {
      console.warn('[Extractor] Erreur lecture binaire IndexedDB:', e);
    }
  }

  // 2. Si non présent en local, téléchargement via l'URL (R2 / Cloudflare)
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

  if (!arrayBuffer) {
    return `[Document: ${item.name || 'Fichier'} (aperçu sans texte brut extrait)]`;
  }

  try {
    // Cas 1 : Fichiers PDF
    if (fileName.endsWith('.pdf') || item.type?.includes('pdf') || item.extension?.toLowerCase() === 'pdf') {
      const typedarray = new Uint8Array(arrayBuffer);
      const loadingTask = (pdfjsLib as any).getDocument({ data: typedarray, cMapPacked: true });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      // Extraction jusqu'à 25 pages pour garder un temps de réponse rapide et un contexte idéal
      const pagesToExtract = Math.min(pdf.numPages, 25);
      for (let i = 1; i <= pagesToExtract; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = (content.items || [])
          .map((it: any) => it.str)
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageText) {
          fullText += `[Page ${i}]\n${pageText}\n\n`;
        }
      }

      const cleanResult = fullText.trim() || `[Document PDF ${item.name} : texte manuscrit ou scanné en image]`;
      if (cacheKey) textCache.set(cacheKey, cleanResult);
      return cleanResult;
    }

    // Cas 2 : Fichiers Word (.docx)
    if (fileName.endsWith('.docx') || item.type?.includes('wordprocessingml') || item.extension?.toLowerCase() === 'docx') {
      const res = await mammoth.extractRawText({ arrayBuffer });
      const cleanResult = (res.value || '').trim() || `[Document Word ${item.name}]`;
      if (cacheKey) textCache.set(cacheKey, cleanResult);
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
      fileName.endsWith('.html')
    ) {
      const decoded = new TextDecoder('utf-8').decode(arrayBuffer).trim();
      if (cacheKey) textCache.set(cacheKey, decoded);
      return decoded;
    }
  } catch (extractErr) {
    console.warn('[Extractor] Erreur décodage document:', extractErr);
  }

  return `[Document: ${item.name || 'Fichier'}]`;
}
