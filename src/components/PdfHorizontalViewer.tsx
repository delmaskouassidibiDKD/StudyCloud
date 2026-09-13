import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Volume2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileBlob } from '../services/localFileStorage';

// Configure local worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export interface PageLine {
  id: string;
  lineIndex: number;
  text: string;
  left: number;   // percent 0-100
  top: number;    // percent 0-100
  width: number;  // percent 0-100
  height: number; // percent 0-100
}

export async function extractPageLines(page: any, pageNumber: number): Promise<PageLine[]> {
  try {
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const pageW = unscaledViewport.width || 595;
    const pageH = unscaledViewport.height || 842;
    const content = await page.getTextContent();
    if (!content || !content.items || content.items.length === 0) return [];

    const rawItems: { str: string; left: number; top: number; width: number; height: number }[] = [];

    for (const it of content.items as any[]) {
      if (!it.str || it.str.length === 0) continue;
      try {
        const fontHeight = Math.hypot(it.transform[2], it.transform[3]) || Math.hypot(it.transform[0], it.transform[1]) || it.height || 12;
        let minX = 0, minY = 0, w = 0, h = 0;
        if (typeof unscaledViewport.convertToViewportRectangle === 'function') {
          const rect = unscaledViewport.convertToViewportRectangle([
            it.transform[4],
            it.transform[5],
            it.transform[4] + (it.width || 0),
            it.transform[5] + fontHeight
          ]);
          minX = Math.min(rect[0], rect[2]);
          minY = Math.min(rect[1], rect[3]);
          w = Math.abs(rect[2] - rect[0]);
          h = Math.abs(rect[3] - rect[1]);
        } else {
          minX = it.transform[4];
          minY = pageH - (it.transform[5] + fontHeight);
          w = it.width || 10;
          h = fontHeight;
        }

        rawItems.push({
          str: it.str,
          left: (minX / pageW) * 100,
          top: (minY / pageH) * 100,
          width: (w / pageW) * 100,
          height: (h / pageH) * 100,
        });
      } catch (e) {}
    }

    if (rawItems.length === 0) return [];

    // Trier les éléments du haut vers le bas, puis de gauche à droite
    const sorted = [...rawItems].sort((a, b) => {
      if (Math.abs(a.top - b.top) > 1.2) return a.top - b.top;
      return a.left - b.left;
    });

    const grouped: PageLine[] = [];
    for (const it of sorted) {
      // Trouver une ligne sur la même hauteur (avec écart horizontal raisonnable pour ne pas fusionner des colonnes séparées)
      const existing = grouped.find(l => {
        const sameHeight = Math.abs(l.top - it.top) < 1.3;
        if (!sameHeight) return false;
        const gap = it.left - (l.left + l.width);
        return gap >= -2 && gap < 7;
      });
      if (existing) {
        // Détecter si un espace est nécessaire entre deux mots
        const existingEnd = existing.left + existing.width;
        const gap = it.left - existingEnd;
        const needsSpace = gap > 0.35 && !existing.text.endsWith(' ') && !it.str.startsWith(' ');
        
        existing.text += (needsSpace ? ' ' : '') + it.str;
        const newRight = Math.max(existing.left + existing.width, it.left + it.width);
        existing.left = Math.min(existing.left, it.left);
        existing.width = Math.max(0.5, newRight - existing.left);
        existing.height = Math.max(existing.height, it.height);
      } else {
        grouped.push({
          id: `p${pageNumber}-l${grouped.length}`,
          lineIndex: grouped.length,
          text: it.str,
          left: it.left,
          top: it.top,
          width: Math.max(0.5, it.width),
          height: it.height,
        });
      }
    }

    // Nettoyer les espaces multiples et préserver toutes les lettres, formules et chiffres
    return grouped
      .map((l, idx) => ({
        ...l,
        lineIndex: idx,
        id: `p${pageNumber}-l${idx}`,
        text: l.text.replace(/\s+/g, ' ').trim(),
      }))
      .filter(l => l.text.length > 0);
  } catch (err) {
    console.warn(`Erreur extraction lignes page ${pageNumber}:`, err);
    return [];
  }
}

interface PdfPageRendererProps {
  pdfDoc: any;
  pageNumber: number;
  layoutMode: 'vertical' | 'horizontal';
  docZoom: number;
  isSpeakingThisPage?: boolean;
  currentSpokenText?: string;
  activeSpeechLineIndex?: number;
  autoScrollEnabled?: boolean;
}

function PdfPageRenderer({ 
  pdfDoc, 
  pageNumber,
  layoutMode,
  docZoom,
  isSpeakingThisPage,
  currentSpokenText,
  activeSpeechLineIndex,
  autoScrollEnabled = true,
}: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeAnchorRef = useRef<HTMLDivElement>(null);
  const lastScrolledLineRef = useRef<number>(-1);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(0.707); // Default A4
  const [lines, setLines] = useState<PageLine[]>([]);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  useEffect(() => {
    let cancelRender: any = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        // Viewport 1.0x pour calculer les ratios et coordonnées stables
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const pageW = unscaledViewport.width;
        const pageH = unscaledViewport.height;
        if (pageW && pageH) {
          setAspectRatio(pageW / pageH);
          setPageDims({ width: pageW, height: pageH });
        }

        // Rendu Ultra Haute Définition Pleine Largeur (Vector Retina) : pas de flou !
        const containerW = canvasRef.current?.parentElement?.clientWidth || window.innerWidth || 1100;
        const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;
        const zoomFactor = Math.max(1.0, docZoom / 100);
        const targetPixelWidth = Math.max(containerW * zoomFactor, 1400) * dpr;
        const renderScale = Math.max(targetPixelWidth / pageW, 2.5);

        const renderViewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        });
        cancelRender = renderTask;
        await renderTask.promise;

        // Extraction précise des coordonnées des lignes de texte
        const pageLines = await extractPageLines(page, pageNumber);
        if (isMounted) setLines(pageLines);

        if (isMounted) setRendered(true);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Erreur rendu page ${pageNumber}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (cancelRender && typeof cancelRender.cancel === 'function') {
        try { cancelRender.cancel(); } catch {}
      }
    };
  }, [pdfDoc, pageNumber, docZoom]);

  // Auto-scroll stable et calme SANS saccade ("sans sauter") : déclenché UNIQUEMENT quand la ligne change
  useEffect(() => {
    if (!isSpeakingThisPage || !autoScrollEnabled) return;
    if (activeSpeechLineIndex === undefined || activeSpeechLineIndex < 0) return;
    if (activeSpeechLineIndex === lastScrolledLineRef.current) return;
    lastScrolledLineRef.current = activeSpeechLineIndex;

    const timer = setTimeout(() => {
      if (activeAnchorRef.current) {
        activeAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [activeSpeechLineIndex, isSpeakingThisPage, autoScrollEnabled]);

  return (
    <div className="relative w-full flex items-center justify-center select-none">
      {!rendered && (
        <div 
          className="bg-white dark:bg-stone-900 shadow-sm border border-stone-200 dark:border-stone-800 flex items-center justify-center animate-pulse"
          style={{
            height: layoutMode === 'horizontal' ? '80vh' : 'auto',
            width: layoutMode === 'horizontal' ? `${80 * aspectRatio}vh` : `${docZoom}%`,
            aspectRatio: `${aspectRatio}`,
            minHeight: layoutMode === 'horizontal' ? undefined : '500px',
          }}
        >
          <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div
        className={`relative bg-white shadow-sm border border-stone-200 dark:border-stone-800 transition-all duration-200 ${
          rendered ? 'block' : 'hidden'
        }`}
        style={{
          width: layoutMode === 'horizontal' 
            ? `${80 * aspectRatio * (docZoom / 100)}vh` 
            : `${docZoom}%`,
          height: layoutMode === 'horizontal' ? '80vh' : 'auto',
          aspectRatio: `${aspectRatio}`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Soulignage directement SUR le texte du document (SANS micro, SANS contour orange) */}
        <div className="absolute inset-0 pointer-events-none overflow-visible rounded-xl">
          {lines.map((line) => {
            const isLineActive = isSpeakingThisPage && (
              (typeof activeSpeechLineIndex === 'number' && activeSpeechLineIndex >= 0 && line.lineIndex === activeSpeechLineIndex) ||
              (activeSpeechLineIndex === -1 && currentSpokenText && line.text.length >= 3 && line.text.toLowerCase().includes(currentSpokenText.toLowerCase().slice(0, 15)))
            );

            if (!isLineActive) return null;

            return (
              <div
                key={line.id}
                ref={activeAnchorRef}
                className="absolute pointer-events-none rounded transition-all duration-200 z-30"
                style={{
                  left: `${Math.max(0, line.left - 0.4)}%`,
                  top: `${Math.max(0, line.top - 0.3)}%`,
                  width: `${Math.min(100 - line.left, line.width + 0.8)}%`,
                  height: `${Math.max(line.height + 0.6, 2.8)}%`,
                  backgroundColor: 'rgba(255, 235, 59, 0.65)', // Jaune fluo Stabilo doux et très lisible
                  borderBottom: '3.5px solid #FF3B30',          // Soulignage rouge-orangé électrique
                  boxShadow: '0 2px 8px rgba(255, 59, 48, 0.45)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface PdfDocumentViewerProps {
  fileId?: string;
  file?: any;
  url?: string;
  docZoom: number;
  layoutMode?: 'vertical' | 'horizontal';
  activeSpeechPage?: number;
  activeSpeechLineIndex?: number;
  currentSpokenText?: string;
  autoScrollEnabled?: boolean;
  isSpeaking?: boolean;
  onSegmentsExtracted?: (segments: any[]) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function PdfHorizontalViewer({ 
  fileId, 
  file, 
  url, 
  docZoom,
  layoutMode = 'vertical',
  activeSpeechPage,
  activeSpeechLineIndex,
  currentSpokenText,
  autoScrollEnabled = true,
  isSpeaking = false,
  onSegmentsExtracted,
  currentPage: externalCurrentPage,
  onPageChange,
}: PdfDocumentViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        let arrayBuffer: ArrayBuffer | null = null;

        // 1. Lecture binaire locale directe depuis IndexedDB
        if (fileId) {
          try {
            const blob = await getFileBlob(fileId);
            if (blob) arrayBuffer = await blob.arrayBuffer();
          } catch (e) {
            console.warn('[PdfDocumentViewer] Lecture IndexedDB:', e);
          }
        }

        // 2. Si le file passé a arrayBuffer
        if (!arrayBuffer && file && typeof file.arrayBuffer === 'function') {
          try {
            arrayBuffer = await file.arrayBuffer();
          } catch (e) {}
        }

        // 3. Fallback URL
        if (!arrayBuffer && url) {
          try {
            const resp = await fetch(url);
            if (resp.ok) arrayBuffer = await resp.arrayBuffer();
          } catch (e) {
            console.warn('[PdfDocumentViewer] Fetch url:', e);
          }
        }

        let loadingTask: any;
        if (arrayBuffer) {
          const typedarray = new Uint8Array(arrayBuffer);
          loadingTask = pdfjsLib.getDocument({
            data: typedarray,
            cMapPacked: true,
          });
        } else if (url) {
          loadingTask = pdfjsLib.getDocument(url);
        } else {
          throw new Error("Impossible de charger le document PDF.");
        }

        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[PdfDocumentViewer] Erreur chargement:', err);
        if (isMounted) {
          setError("Impossible de charger le document PDF.");
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [fileId, url, file?.id, file?.url]);

  // Extraction automatique de tous les segments de lecture vocale pour synchronisation parfaite
  useEffect(() => {
    if (!pdfDoc || !onSegmentsExtracted) return;

    let isMounted = true;
    const extractAllSegments = async () => {
      try {
        const allSegments: any[] = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const pageLines = await extractPageLines(page, p);
          for (const l of pageLines) {
            allSegments.push({
              text: l.text,
              page: p,
              lineIndex: l.lineIndex,
            });
          }
        }

        if (isMounted && allSegments.length > 0) {
          onSegmentsExtracted(allSegments);
        }
      } catch (err) {
        console.warn('[PdfHorizontalViewer] Erreur extraction all segments:', err);
      }
    };

    extractAllSegments();
    return () => { isMounted = false; };
  }, [pdfDoc]);

  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setCurrentPage(pageNum);
      onPageChange?.(pageNum);
    }
  };

  // Auto-scroll horizontal ou vertical vers la page correspondante
  useEffect(() => {
    if (isSpeaking && autoScrollEnabled && activeSpeechPage && activeSpeechPage !== currentPage) {
      scrollToPage(activeSpeechPage);
    }
  }, [activeSpeechPage, autoScrollEnabled, isSpeaking]);

  const handleWheel = (e: React.WheelEvent) => {
    if (layoutMode === 'horizontal' && containerRef.current && e.deltaY !== 0) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const centerY = containerRect.top + containerRect.height / 2;

    for (let [pageNum, el] of pageRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (layoutMode === 'horizontal') {
        if (rect.left <= centerX && rect.right >= centerX) {
          setCurrentPage(pageNum);
          onPageChange?.(pageNum);
          break;
        }
      } else {
        if (rect.top <= centerY && rect.bottom >= centerY) {
          setCurrentPage(pageNum);
          onPageChange?.(pageNum);
          break;
        }
      }
    }
  };

  // Navigation clavier (flèches)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || (layoutMode === 'vertical' && e.key === 'ArrowDown')) {
        scrollToPage(Math.min(numPages, currentPage + 1));
      } else if (e.key === 'ArrowLeft' || (layoutMode === 'vertical' && e.key === 'ArrowUp')) {
        scrollToPage(Math.max(1, currentPage - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, currentPage, layoutMode]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-stone-100 dark:bg-stone-900">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
          Chargement du document PDF...
        </p>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-stone-100 dark:bg-stone-900">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
        <p className="text-sm font-bold text-stone-800 dark:text-stone-200">{error || "Erreur de rendu PDF"}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-stone-100 dark:bg-stone-950 overflow-hidden relative select-none">
      {/* Top Controls Bar in Horizontal Mode */}
      {layoutMode === 'horizontal' && (
        <div className="w-full px-4 py-1 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer text-stone-800 dark:text-stone-200"
              title="Page précédente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            <span className="text-xs font-black text-stone-800 dark:text-stone-100 bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 px-3 py-1 rounded-md">
              Page {currentPage} / {numPages}
            </span>

            <button
              onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer text-stone-800 dark:text-stone-200"
              title="Page suivante"
            >
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-500">
            <span className="hidden md:inline">↔ Molette souris ou glissement pour défiler</span>
          </div>
        </div>
      )}

      {/* Floating Side Arrows in Horizontal Mode */}
      {layoutMode === 'horizontal' && currentPage > 1 && (
        <button
          onClick={() => scrollToPage(currentPage - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white/90 dark:bg-stone-800/90 shadow-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all cursor-pointer text-stone-700 dark:text-stone-200"
          title="Page précédente"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {layoutMode === 'horizontal' && currentPage < numPages && (
        <button
          onClick={() => scrollToPage(currentPage + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white/90 dark:bg-stone-800/90 shadow-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all cursor-pointer text-stone-700 dark:text-stone-200"
          title="Page suivante"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Viewport : Vertical Column or Horizontal Row */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onScroll={handleScroll}
        className={`flex-1 w-full h-full ${
          layoutMode === 'horizontal'
            ? 'overflow-x-auto overflow-y-hidden flex flex-row items-center gap-8 px-8 py-4 snap-x snap-mandatory hide-scrollbar'
            : 'overflow-y-auto overflow-x-auto flex flex-col items-center gap-6 px-0 sm:px-2 py-3'
        }`}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
          const isSpeakingThisPage = isSpeaking && activeSpeechPage === pageNum;
          return (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el);
                else pageRefs.current.delete(pageNum);
              }}
              className={`shrink-0 flex flex-col items-center justify-center relative transition-transform duration-300 ${
                layoutMode === 'horizontal' ? 'h-full max-h-[82vh] snap-center' : 'w-full'
              }`}
            >
              <PdfPageRenderer
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                layoutMode={layoutMode}
                docZoom={docZoom}
                isSpeakingThisPage={isSpeakingThisPage}
                currentSpokenText={currentSpokenText}
                activeSpeechLineIndex={activeSpeechLineIndex}
                autoScrollEnabled={autoScrollEnabled}
              />
              <div className={`text-[10px] font-bold mt-2 px-2.5 py-0.5 rounded-full border shadow-xs transition-colors ${
                isSpeakingThisPage
                  ? 'bg-orange-500 text-white border-orange-600'
                  : 'text-stone-600 dark:text-stone-400 bg-white/90 dark:bg-stone-900/90 border-stone-300 dark:border-stone-700'
              }`}>
                Page {pageNum} sur {numPages}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
