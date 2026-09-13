import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Volume2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileBlob } from '../services/localFileStorage';

// Configure local worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PageTextItem {
  str: string;
  left: number;   // percent 0-100
  top: number;    // percent 0-100
  width: number;  // percent 0-100
  height: number; // percent 0-100
}

interface PdfPageRendererProps {
  pdfDoc: any;
  pageNumber: number;
  layoutMode: 'vertical' | 'horizontal';
  isSpeakingThisPage?: boolean;
  currentSpokenText?: string;
  autoScrollEnabled?: boolean;
}

function PdfPageRenderer({ 
  pdfDoc, 
  pageNumber,
  layoutMode,
  isSpeakingThisPage,
  currentSpokenText,
  autoScrollEnabled = true,
}: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeAnchorRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(0.707); // Default A4
  const [textItems, setTextItems] = useState<PageTextItem[]>([]);

  useEffect(() => {
    let cancelRender: any = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        // Render at 1.5x for sharp text
        const viewport = page.getViewport({ scale: 1.5 });
        if (viewport.width && viewport.height) {
          setAspectRatio(viewport.width / viewport.height);
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });
        cancelRender = renderTask;
        await renderTask.promise;

        // Extract text items with exact coordinate positions for on-document highlighting
        try {
          const content = await page.getTextContent();
          const items: PageTextItem[] = [];

          for (const it of content.items as any[]) {
            if (!it.str || it.str.trim().length === 0) continue;
            try {
              const rect = viewport.convertToViewportRectangle([
                it.transform[4],
                it.transform[5],
                it.transform[4] + (it.width || 0),
                it.transform[5] + (it.height || 10)
              ]);
              const minX = Math.min(rect[0], rect[2]);
              const minY = Math.min(rect[1], rect[3]);
              const w = Math.abs(rect[2] - rect[0]);
              const h = Math.abs(rect[3] - rect[1]);

              items.push({
                str: it.str,
                left: (minX / viewport.width) * 100,
                top: (minY / viewport.height) * 100,
                width: (w / viewport.width) * 100,
                height: (h / viewport.height) * 100,
              });
            } catch (e) {}
          }
          if (isMounted) setTextItems(items);
        } catch (err) {
          console.warn('Erreur extraction coordonnées texte page', pageNumber, err);
        }

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
  }, [pdfDoc, pageNumber]);

  // Auto-scroll to active sentence element directly on the document
  useEffect(() => {
    if (isSpeakingThisPage && autoScrollEnabled && activeAnchorRef.current) {
      activeAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [currentSpokenText, isSpeakingThisPage, autoScrollEnabled]);

  let firstActiveFound = false;

  return (
    <div className="relative flex items-center justify-center select-none">
      {!rendered && (
        <div 
          className="bg-white dark:bg-stone-900 rounded-xl shadow-md border border-stone-200 dark:border-stone-800 flex items-center justify-center animate-pulse"
          style={{
            height: layoutMode === 'horizontal' ? '74vh' : '520px',
            width: layoutMode === 'horizontal' ? `${74 * aspectRatio}vh` : '100%',
            maxWidth: layoutMode === 'vertical' ? '860px' : undefined,
            aspectRatio: `${aspectRatio}`,
          }}
        >
          <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div
        className={`relative rounded-xl shadow-xl bg-white transition-all duration-300 ${
          rendered ? 'block' : 'hidden'
        } ${
          isSpeakingThisPage
            ? 'border-2 border-orange-500 ring-4 ring-orange-500/50 shadow-orange-500/20'
            : 'border border-stone-300 dark:border-stone-700'
        }`}
        style={{
          maxHeight: layoutMode === 'horizontal' ? '74vh' : undefined,
          height: layoutMode === 'horizontal' ? '74vh' : 'auto',
          width: layoutMode === 'horizontal' ? `${74 * aspectRatio}vh` : '100%',
          maxWidth: layoutMode === 'vertical' ? '860px' : undefined,
          aspectRatio: `${aspectRatio}`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-xl"
        />

        {/* Soulignage et surlignage directement SUR le texte du document */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          {textItems.map((it, idx) => {
            const isItemActive = isSpeakingThisPage && currentSpokenText && (() => {
              const itemStr = it.str.trim().toLowerCase();
              if (itemStr.length < 2) return false;
              const spokenStr = currentSpokenText.toLowerCase();
              return spokenStr.includes(itemStr) || (itemStr.length > 6 && spokenStr.includes(itemStr.slice(0, 6)));
            })();

            if (!isItemActive) return null;

            const isFirst = !firstActiveFound;
            if (isFirst) firstActiveFound = true;

            return (
              <div
                key={idx}
                ref={isFirst ? activeAnchorRef : null}
                className="absolute pointer-events-none rounded-xs bg-amber-400/35 border-b-[3px] border-orange-500 shadow-[0_2px_8px_rgba(249,115,22,0.9)] animate-pulse z-20"
                style={{
                  left: `${it.left}%`,
                  top: `${it.top}%`,
                  width: `${it.width}%`,
                  height: `${Math.max(it.height, 2.5)}%`,
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
  currentSpokenText?: string;
  autoScrollEnabled?: boolean;
  isSpeaking?: boolean;
}

export function PdfHorizontalViewer({ 
  fileId, 
  file, 
  url, 
  docZoom,
  layoutMode = 'vertical',
  activeSpeechPage,
  currentSpokenText,
  autoScrollEnabled = true,
  isSpeaking = false
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

  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setCurrentPage(pageNum);
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
          break;
        }
      } else {
        if (rect.top <= centerY && rect.bottom >= centerY) {
          setCurrentPage(pageNum);
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
            ? 'overflow-x-auto overflow-y-hidden flex flex-row items-center gap-8 px-12 py-6 snap-x snap-mandatory hide-scrollbar'
            : 'overflow-y-auto overflow-x-hidden flex flex-col items-center gap-6 px-4 sm:px-8 py-6'
        }`}
        style={{ zoom: `${docZoom}%` }}
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
                layoutMode === 'horizontal' ? 'h-full max-h-[82vh] snap-center' : 'w-full max-w-[880px]'
              }`}
            >
              <PdfPageRenderer
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                layoutMode={layoutMode}
                isSpeakingThisPage={isSpeakingThisPage}
                currentSpokenText={currentSpokenText}
                autoScrollEnabled={autoScrollEnabled}
              />
              <div className={`text-[10px] font-bold mt-2 px-2.5 py-0.5 rounded-full border shadow-xs transition-colors ${
                isSpeakingThisPage
                  ? 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20'
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
