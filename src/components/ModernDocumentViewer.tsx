import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  RotateCw,
  Save,
  RotateCcw
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getFileBlob, storeFileBlob, resolveCleanDocumentBlob, ensureDecompressedArrayBuffer, formatFileSize } from '../services/localFileStorage';
import { CloudDataStore } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getWorkerApiUrl } from '../services/api';
import { MobilePdfViewer } from './MobilePdfViewer';
import { AuthenticWordViewer } from './AuthenticWordViewer';
import { AuthenticExcelViewer } from './AuthenticExcelViewer';
import { AuthenticPowerPointViewer, PptxSlideData } from './AuthenticPowerPointViewer';

// Configuration du worker PDF.js
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PdfPageCanvasProps {
  pdfDoc: any;
  pageNumber: number;
  scale: number;
}

// Composant pour rendre une page PDF en mode défilement vertical continu avec virtualisation mémoire
const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({ pdfDoc, pageNumber, scale }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 2);
  const [rendered, setRendered] = useState(false);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [aspectRatio, setAspectRatio] = useState<number>(595 / 842);

  // 1. Découverte immédiate des dimensions exactes de la page pour réserver l'espace exact sans saut d'affichage
  useEffect(() => {
    if (!pdfDoc) return;
    let isMounted = true;
    pdfDoc.getPage(pageNumber).then((page: any) => {
      if (!isMounted) return;
      try {
        const unscaled = page.getViewport({ scale: 1.0 });
        const w = unscaled.width || 595;
        const h = unscaled.height || 842;
        setPageDims({ width: w, height: h });
        setAspectRatio(w / h);
      } catch { }
    }).catch(() => { });
    return () => { isMounted = false; };
  }, [pdfDoc, pageNumber]);

  // 2. Observer d'intersection pour différer le rendu des pages éloignées
  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '600px 0px 600px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  // 3. Rendu haute fidélité du canvas avec gestion propre de l'annulation
  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) return;
    let isMounted = true;
    let renderTask: any = null;

    pdfDoc.getPage(pageNumber).then((page: any) => {
      if (!isMounted || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const unscaled = page.getViewport({ scale: 1.0 });
      const w = unscaled.width || 595;
      const h = unscaled.height || 842;
      if (isMounted) {
        setPageDims({ width: w, height: h });
        setAspectRatio(w / h);
      }

      // Rendu Retina HD haute définition pour une netteté de lecture absolue
      const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1.5) : 1.5, 2.5);
      const renderScale = scale * dpr;
      const renderViewport = page.getViewport({ scale: renderScale });

      canvas.width = Math.round(renderViewport.width);
      canvas.height = Math.round(renderViewport.height);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const task = page.render({ canvasContext: ctx, viewport: renderViewport });
      renderTask = task;

      task.promise
        .then(() => {
          if (isMounted) setRendered(true);
        })
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn(`[PdfPageCanvas] Erreur rendu page ${pageNumber}:`, err);
          }
        });
    }).catch(() => { });

    return () => {
      isMounted = false;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try { renderTask.cancel(); } catch { }
      }
    };
  }, [isVisible, pdfDoc, pageNumber, scale]);

  const targetWidth = Math.round(pageDims.width * scale);
  const targetHeight = Math.round(targetWidth / (aspectRatio || 0.707));

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center bg-white shrink-0 overflow-hidden"
      style={{
        width: `${targetWidth}px`,
        maxWidth: '100%',
        aspectRatio: `${pageDims.width} / ${pageDims.height}`,
        minHeight: `${Math.min(targetHeight, 200)}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          width: '100%',
          height: '100%',
          display: rendered ? 'block' : 'none',
        }}
      />
      {!rendered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-50 dark:bg-zinc-800 text-zinc-400 p-4 animate-pulse">
          <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Page {pageNumber}...</span>
        </div>
      )}
    </div>
  );
};

interface ModernDocumentViewerProps {
  url?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: string | number;
  textContent?: string;
  className?: string;
  hideHeader?: boolean;
  pdfViewMode?: 'native' | 'continuous';
  onPdfViewModeChange?: (mode: 'native' | 'continuous') => void;
  pdfScale?: number;
  onPdfScaleChange?: (scale: number) => void;
  onExtractedText?: (text: string) => void;
  activeSpeechPage?: number;
  autoScrollEnabled?: boolean;
}

export const ModernDocumentViewer: React.FC<ModernDocumentViewerProps> = ({
  url,
  fileId,
  fileName = 'Document',
  fileSize,
  textContent,
  className = '',
  hideHeader = false,
  pdfViewMode: propsPdfViewMode,
  onPdfViewModeChange,
  pdfScale: propsPdfScale,
  onPdfScaleChange,
  onExtractedText,
  activeSpeechPage,
  autoScrollEnabled = true,
}) => {
  const normName = fileName.toLowerCase();
  const ext = normName.includes('.') ? (normName.split('.').pop() || '') : '';

  const isPdf =
    ext === 'pdf' ||
    normName.endsWith('.pdf') ||
    (url && url.toLowerCase().includes('.pdf')) ||
    (url && url.startsWith('data:application/pdf'));
  const isWord = ['docx', 'doc'].includes(ext);
  const isExcel = ['xlsx', 'xls', 'csv'].includes(ext);
  const isPptx = ['pptx', 'ppt'].includes(ext);
  const isTextOrCode =
    ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'sql', 'cpp', 'c', 'java', 'xml', 'yaml', 'yml'].includes(ext) ||
    (!isPdf && !isWord && !isExcel && !isPptx);

  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // États généraux
  const [blob, setBlob] = useState<Blob | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const objectUrlRef = useRef<string | null>(null);
  const pdfDocRef = useRef<any>(null);
  const currentFileKeyRef = useRef<string>('');
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  // Mode d'affichage PDF : 'native' (Lecteur iframe navigateur comme dans la photo) ou 'continuous' (Défilement vertical continu PDF.js)
  const [internalPdfViewMode, setInternalPdfViewMode] = useState<'native' | 'continuous'>('native');
  const activePdfViewMode = propsPdfViewMode !== undefined ? propsPdfViewMode : internalPdfViewMode;
  const setPdfViewMode = (updater: any) => {
    const nextVal = typeof updater === 'function' ? updater(activePdfViewMode) : updater;
    setInternalPdfViewMode(nextVal);
    onPdfViewModeChange?.(nextVal);
  };

  // États PDF
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [internalPdfScale, setInternalPdfScale] = useState<number>(1.25);
  const activePdfScale = propsPdfScale !== undefined ? propsPdfScale : internalPdfScale;
  const setPdfScale = (updater: any) => {
    const nextVal = typeof updater === 'function' ? updater(activePdfScale) : updater;
    setInternalPdfScale(nextVal);
    onPdfScaleChange?.(nextVal);
  };

  // Défilement automatique vers la page lue par la synthèse vocale
  useEffect(() => {
    if (autoScrollEnabled && activeSpeechPage && activePdfViewMode === 'continuous') {
      const pageEl = document.getElementById(`modern-doc-page-${activeSpeechPage}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSpeechPage, autoScrollEnabled, activePdfViewMode]);

  // Nettoyage rigoureux de la mémoire vive à la fermeture du viewer
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy(); } catch { }
        pdfDocRef.current = null;
      }
    };
  }, []);

  // États Word & PPTX
  const [wordArrayBuffer, setWordArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [wordHtml, setWordHtml] = useState<string>('');
  const [pptxArrayBuffer, setPptxArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pptxSlides, setPptxSlides] = useState<PptxSlideData[]>([]);

  // États Excel
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);

  // États Code / Texte
  const [rawText, setRawText] = useState<string>(textContent || '');
  const [initialRawText, setInitialRawText] = useState<string>(textContent || '');
  const [isTextDirty, setIsTextDirty] = useState<boolean>(false);
  const [isSavingText, setIsSavingText] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // URL résolue prête pour le lecteur natif avec barre d'outils et défilement vertical FitH
  const effectivePdfUrl = resolvedUrl;
  const cleanPdfBase = effectivePdfUrl ? effectivePdfUrl.split('#')[0] : '';
  const nativePdfUrl = cleanPdfBase ? `${cleanPdfBase}#toolbar=1&navpanes=0&view=FitH` : '';

  const handleRetry = useCallback(() => {
    currentFileKeyRef.current = '';
    setReloadTrigger(t => t + 1);
  }, []);

  // 1. Chargement principal du document (exécuté de façon stable sans boucle de rafraîchissement)
  useEffect(() => {
    let isCancelled = false;
    const fileKey = `${fileId || ''}__${url || ''}__${textContent ? 'hasText' : 'noText'}__${reloadTrigger}`;

    if (currentFileKeyRef.current === fileKey && resolvedUrl) {
      return;
    }
    currentFileKeyRef.current = fileKey;

    setIsLoading(true);
    setErrorMessage('');
    setResolvedUrl('');
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setBlob(null);
    setPdfDoc(null);
    setWordHtml('');
    setPptxSlides([]);
    setWorkbook(null);
    setSheetData([]);
    if (textContent) setRawText(textContent);

    const loadData = async () => {
      const rawUrl = (url && typeof url === 'string' && url.trim()) ? url : '';
      const isThumb = rawUrl.startsWith('data:image/');
      const directUrl = isThumb ? '' : rawUrl;
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');

      const foundBlob = await resolveCleanDocumentBlob({
        fileId,
        url: directUrl,
        baseUrl,
        mimeType: isPdf ? 'application/pdf' : undefined,
      });

      if (isCancelled) return;

      let effectiveUrl = directUrl;
      if (foundBlob) {
        setBlob(foundBlob);
        const bUrl = URL.createObjectURL(foundBlob);
        objectUrlRef.current = bUrl;
        effectiveUrl = bUrl;
        setResolvedUrl(bUrl);
      } else if (directUrl) {
        setResolvedUrl(directUrl);
      }

      // 1. Document PDF
      if (isPdf) {
        if (effectiveUrl) {
          setIsLoading(false);
        } else {
          setIsLoading(false);
          setErrorMessage("Impossible d'accéder au fichier PDF.");
        }
        return;
      }

      // 2. Traitement des autres formats
      if (foundBlob) {
        try {
          if (isWord) {
            const arrayBuffer = await ensureDecompressedArrayBuffer(await foundBlob.arrayBuffer());
            if (!isCancelled) {
              setWordArrayBuffer(arrayBuffer);
              setIsLoading(false);
            }
          } else if (isExcel) {
            const arrayBuffer = await ensureDecompressedArrayBuffer(await foundBlob.arrayBuffer());
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            if (!isCancelled) {
              setWorkbook(wb);
              setIsLoading(false);
            }
          } else if (isPptx) {
            const arrayBuffer = await ensureDecompressedArrayBuffer(await foundBlob.arrayBuffer());
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(arrayBuffer);
            const slideFiles = Object.keys(zip.files)
              .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
              .sort((a, b) => {
                const na = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
                const nb = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
                return na - nb;
              });
            const slides: PptxSlideData[] = [];
            const parser = new DOMParser();
            for (let i = 0; i < slideFiles.length; i++) {
              const fileNameKey = slideFiles[i];
              const xmlStr = await zip.files[fileNameKey].async('string');
              const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
              const pNodes = Array.from(xmlDoc.getElementsByTagName('a:p'));
              const paragraphs: string[] = [];
              for (const p of pNodes) {
                const tNodes = Array.from(p.getElementsByTagName('a:t'));
                const line = tNodes.map(t => t.textContent || '').join('').trim();
                if (line) paragraphs.push(line);
              }
              slides.push({ slideNumber: i + 1, slideFileName: fileNameKey, texts: paragraphs });
            }
            if (!isCancelled) {
              setPptxArrayBuffer(arrayBuffer);
              setPptxSlides(slides);
              setIsLoading(false);
            }
          } else {
            const text = await foundBlob.text();
            if (!isCancelled) {
              setRawText(text);
              setInitialRawText(text);
              setIsTextDirty(false);
              setIsLoading(false);
            }
          }
        } catch (err: any) {
          console.error('[ModernDocumentViewer] Erreur format:', err);
          if (!isCancelled) {
            setErrorMessage(`Erreur lors du traitement du document (${err.message || 'Format corrompu'})`);
            setIsLoading(false);
          }
        }
      } else if (textContent) {
        setRawText(textContent);
        setInitialRawText(textContent);
        setIsTextDirty(false);
        setIsLoading(false);
      } else if (directUrl) {
        setIsLoading(false);
      } else {
        setIsLoading(false);
        setErrorMessage("Impossible d'accéder au contenu du document.");
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [fileId, url, isPdf, isWord, isExcel, isPptx, textContent, reloadTrigger]);

  // Charger PDF.js à la demande uniquement si l'utilisateur bascule en mode continu
  useEffect(() => {
    let isCancelled = false;
    if (isPdf && activePdfViewMode === 'continuous' && !pdfDoc) {
      setIsLoading(true);
      const loadPdfContinuous = async () => {
        let b = blob;
        if (!b) {
          b = await resolveCleanDocumentBlob({
            fileId,
            url: resolvedUrl || url,
            mimeType: 'application/pdf',
          });
        }
        if (isCancelled || !b) {
          setIsLoading(false);
          return;
        }
        try {
          const arrayBuffer = await ensureDecompressedArrayBuffer(await b.arrayBuffer());
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const doc = await loadingTask.promise;
          if (!isCancelled) {
            pdfDocRef.current = doc;
            setPdfDoc(doc);
            setPdfTotalPages(doc.numPages);
            setIsLoading(false);

            // Extraire le texte de toutes les pages pour la synthèse vocale
            if (onExtractedText) {
              const pagesText: string[] = [];
              for (let p = 1; p <= doc.numPages; p++) {
                try {
                  const page = await doc.getPage(p);
                  const tc = await page.getTextContent();
                  const pt = (tc.items as any[]).map((it: any) => it.str).join(' ').trim();
                  if (pt) pagesText.push(pt);
                } catch { }
              }
              if (pagesText.length > 0) {
                onExtractedText(pagesText.join('\n'));
              }
            }
          }
        } catch {
          if (!isCancelled) setIsLoading(false);
        }
      };
      loadPdfContinuous();
    }
    return () => {
      isCancelled = true;
    };
  }, [isPdf, activePdfViewMode, pdfDoc, blob, fileId, resolvedUrl, url, onExtractedText]);

  // Gestion du changement de feuille Excel
  const selectExcelSheet = (name: string) => {
    if (!workbook) return;
    setActiveSheetName(name);
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }) as any[][];
    setSheetData(raw);
  };

  const copyText = () => {
    navigator.clipboard.writeText(rawText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={`w-full h-full min-h-0 flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden ${className}`}>
      {/* 1. EN-TÊTE DU DOCUMENT AVEC ACTIONS & CONTRÔLES (Masqué quand hideHeader={true}, pour Word/Excel/PPTX ou sur mobile pour PDF afin d'éviter la bande vide et combler tout l'espace) */}
      {!hideHeader && !isWord && !isExcel && !isPptx && !(isPdf && isMobile) && (
        <div className="flex items-center justify-between px-2 sm:px-4 py-1 sm:py-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 z-10 shadow-xs">
          {/* Masqué sur mobile pour éviter la redondance et libérer l'espace vertical */}
          <div className="hidden sm:flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shrink-0">
              {isPdf ? (
                <FileText className="w-4 h-4 text-red-500" />
              ) : isWord ? (
                <FileText className="w-4 h-4 text-blue-500" />
              ) : isExcel ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              ) : (
                <FileCode className="w-4 h-4 text-purple-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md" title={fileName}>
                  {fileName}
                </h4>
                {isTextOrCode && isTextDirty && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Modifié</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="uppercase font-semibold">{ext || 'DOC'}</span>
                {fileSize && <span>• {fileSize}</span>}
                {isPdf && pdfTotalPages > 1 && <span>• {pdfTotalPages} pages (Défilement vertical)</span>}
                {isTextOrCode && <span>• Éditble</span>}
              </div>
            </div>
          </div>

          {/* Indicateur mobile compact si texte modifié */}
          {isTextOrCode && isTextDirty && (
            <div className="sm:hidden flex items-center gap-1 min-w-0">
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Modifié</span>
              </span>
            </div>
          )}

          {/* Barre d'outils droite */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
            {/* Abandonner pour texte/code */}
            {isTextOrCode && isTextDirty && (
              <button
                type="button"
                onClick={() => {
                  setRawText(initialRawText);
                  setIsTextDirty(false);
                }}
                disabled={isSavingText}
                className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Abandonner les modifications"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Abandonner</span>
              </button>
            )}

            {/* Enregistrer pour texte/code */}
            {isTextOrCode && isTextDirty && (
              <button
                type="button"
                onClick={async () => {
                  setIsSavingText(true);
                  try {
                    const newBlob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
                    if (fileId) {
                      await storeFileBlob(fileId, newBlob);
                      CloudDataStore.updateFile(fileId, { size: formatFileSize(newBlob.size), sizeBytes: newBlob.size, timestamp: Date.now() });
                      CloudStorageAPI.uploadFile(newBlob, 'documents', fileName, undefined, undefined, undefined, newBlob.size, undefined, fileId).catch(() => { });
                    }
                    setInitialRawText(rawText);
                    setIsTextDirty(false);
                    setBlob(newBlob);
                  } catch (e: any) {
                    alert("Erreur de sauvegarde : " + (e.message || 'Inconnue'));
                  } finally {
                    setIsSavingText(false);
                  }
                }}
                disabled={isSavingText}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                title="Enregistrer les modifications"
              >
                {isSavingText ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSavingText ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            )}

            {/* Bascule mode Lecteur Navigateur / Défilement continu pour PDF (Desktop uniquement) */}
            {isPdf && !isMobile && nativePdfUrl && (
              <button
                type="button"
                onClick={() => setPdfViewMode((m: any) => m === 'native' ? 'continuous' : 'native')}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${activePdfViewMode === 'native'
                    ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200'
                  }`}
                title={activePdfViewMode === 'native' ? "Passer au défilement vertical continu PDF.js" : "Passer au lecteur navigateur intégré"}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {activePdfViewMode === 'native' ? 'Lecteur Intégré' : 'Défilement Continu'}
                </span>
              </button>
            )}

            {/* Zoom pour mode défilement continu PDF */}
            {isPdf && activePdfViewMode === 'continuous' && (
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs">
                <button
                  type="button"
                  onClick={() => setPdfScale((prev: number) => Math.max(0.6, prev - 0.15))}
                  className="p-0.5 hover:text-orange-500 cursor-pointer text-zinc-600 dark:text-zinc-300"
                  title="Zoom arrière"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1 font-bold">{Math.round(activePdfScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setPdfScale((prev: number) => Math.min(2.5, prev + 0.15))}
                  className="p-0.5 hover:text-orange-500 cursor-pointer text-zinc-600 dark:text-zinc-300"
                  title="Zoom avant"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Copier pour texte / code */}
            {isTextOrCode && rawText && (
              <button
                type="button"
                onClick={copyText}
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-zinc-300 dark:border-zinc-700 transition-colors"
                title="Copier tout le texte"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isCopied ? 'Copié' : 'Copier'}</span>
              </button>
            )}

            {/* Télécharger le fichier original */}
            {(resolvedUrl || url) && (
              <a
                href={resolvedUrl || url}
                download={fileName}
                className="p-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 cursor-pointer border border-zinc-300 dark:border-zinc-700 transition-colors"
                title="Télécharger le fichier"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. ZONE DE CONTENU PRINCIPALE AVEC DÉFILEMENT VERTICAL FLUIDE & CONFINÉ */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative flex flex-col">
        {/* Chargement */}
        {isLoading && !nativePdfUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xs z-20">
            <div className="w-10 h-10 rounded-full border-3 border-orange-500/20 border-t-orange-500 animate-spin mb-3" />
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Chargement du document...</p>
          </div>
        )}

        {/* Erreur */}
        {errorMessage && !isLoading && !nativePdfUrl && (
          <div className="m-auto flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h5 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Affichage impossible</h5>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mb-4 leading-relaxed">{errorMessage}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        )}

        {/* A0. RENDU PDF SUR TÉLÉPHONE (MobilePdfViewer identique au menu de création sur mobile) */}
        {isPdf && isMobile && !errorMessage && (
          <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden">
            <MobilePdfViewer
              fileId={fileId}
              url={resolvedUrl || url}
              file={{ id: fileId, name: fileName, url: resolvedUrl || url }}
              activeSpeechPage={activeSpeechPage}
              autoScrollEnabled={autoScrollEnabled}
            />
          </div>
        )}

        {/* A1. RENDU PDF SUR ORDINATEUR (1. Mode Lecteur Navigateur Natif avec barre d'outils complète #toolbar=1) */}
        {isPdf && !isMobile && !errorMessage && activePdfViewMode === 'native' && nativePdfUrl && (
          <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center overflow-hidden bg-stone-100 dark:bg-stone-900">
            <iframe
              key={`pdf-native-${fileId || 'direct'}`}
              src={nativePdfUrl}
              title={fileName || 'Document PDF'}
              className="w-full h-full border-0 block flex-1 bg-white"
              style={{ width: '100%', height: '100%', minHeight: '100%' }}
            />
          </div>
        )}

        {/* A2. RENDU PDF SUR ORDINATEUR (2. Mode Défilement Continu Multi-Pages avec PDF.js) */}
        {isPdf && !isMobile && !errorMessage && (activePdfViewMode === 'continuous' || !nativePdfUrl) && (
          <div
            className="w-full h-full flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-6 p-4 sm:p-6 bg-stone-100 dark:bg-zinc-900 select-text"
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
          >
            {pdfDoc ? (
              Array.from({ length: pdfTotalPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  id={`modern-doc-page-${pageNum}`}
                  className="flex flex-col items-center shrink-0 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-white shadow-xl max-w-full my-2"
                >
                  <PdfPageCanvas pdfDoc={pdfDoc} pageNumber={pageNum} scale={activePdfScale} />
                  <div className="w-full py-1 text-center text-[10px] font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 select-none shrink-0">
                    Page {pageNum} sur {pdfTotalPages}
                  </div>
                </div>
              ))
            ) : (
              <div className="m-auto flex flex-col items-center justify-center p-8 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                <p className="text-xs text-zinc-500">Chargement des pages du PDF...</p>
              </div>
            )}
          </div>
        )}

        {/* B. RENDU WORD AUTHENTIQUE (Page A4 blanche, ombres, bordures nettes de l'image 3, édition en direct & boutons Enregistrer / Abandonner) */}
        {isWord && !errorMessage && wordArrayBuffer && (
          <AuthenticWordViewer
            fileId={fileId}
            fileName={fileName}
            fileSize={fileSize}
            arrayBuffer={wordArrayBuffer}
            blob={blob || undefined}
            onSaved={(newBlob) => setBlob(newBlob)}
          />
        )}

        {/* B2. RENDU POWERPOINT AUTHENTIQUE (.pptx avec diapositives 16:9 éditables & boutons Enregistrer / Abandonner) */}
        {isPptx && !errorMessage && pptxArrayBuffer && (
          <AuthenticPowerPointViewer
            fileId={fileId}
            fileName={fileName}
            fileSize={fileSize}
            arrayBuffer={pptxArrayBuffer}
            initialSlides={pptxSlides}
            onSaved={(newBlob) => setBlob(newBlob)}
          />
        )}

        {/* C. RENDU EXCEL AUTHENTIQUE (.xlsx, .xls, .csv avec grille complète, édition de cellules, formules & Enregistrer / Abandonner) */}
        {isExcel && !errorMessage && workbook && (
          <AuthenticExcelViewer
            fileId={fileId}
            fileName={fileName}
            fileSize={fileSize}
            initialWorkbook={workbook}
            onSaved={(newBlob) => setBlob(newBlob)}
          />
        )}

        {/* D. RENDU CODE & TEXTE BRUT ÉDITABLE avec défilement vertical complet et confinement */}
        {isTextOrCode && !errorMessage && (
          <div className="w-full h-full flex-1 flex flex-col font-mono text-xs overflow-hidden bg-[#1e1e1e] text-zinc-100 p-2 sm:p-4">
            <div
              className="flex-1 overflow-y-auto overflow-x-auto p-4 leading-relaxed select-text rounded-xl bg-[#181818] border border-zinc-800 shadow-inner overscroll-contain flex flex-col"
              style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
            >
              <textarea
                spellCheck={false}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setIsTextDirty(true);
                }}
                placeholder="Fichier texte vide..."
                className="w-full h-full flex-1 bg-transparent text-zinc-100 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-0 border-0 p-0 selection:bg-orange-500/30"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
