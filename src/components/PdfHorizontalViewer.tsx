import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileBlob } from '../services/localFileStorage';

// Configure local worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PdfHorizontalViewerProps {
  fileId?: string;
  file?: any;
  url?: string;
  docZoom: number;
}

function PdfPageRenderer({ pdfDoc, pageNumber }: { pdfDoc: any; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(0.707); // Default A4 ratio

  useEffect(() => {
    let cancelRender: any = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        // Render at 1.5x for sharp text while maintaining optimal performance
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

  return (
    <div className="relative h-full flex items-center justify-center select-none">
      {!rendered && (
        <div 
          className="bg-white dark:bg-stone-900 rounded-xl shadow-md border border-stone-200 dark:border-stone-800 flex items-center justify-center animate-pulse"
          style={{
            height: '74vh',
            width: `${74 * aspectRatio}vh`,
          }}
        >
          <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`rounded-xl shadow-lg border border-stone-300 dark:border-stone-700 bg-white transition-opacity duration-200 ${
          rendered ? 'opacity-100 block' : 'hidden'
        }`}
        style={{
          maxHeight: '74vh',
          height: '74vh',
          width: 'auto',
          aspectRatio: `${aspectRatio}`,
        }}
      />
    </div>
  );
}

export function PdfHorizontalViewer({ fileId, file, url, docZoom }: PdfHorizontalViewerProps) {
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

        // 1. Priorité 1 : lecture binaire locale directe depuis IndexedDB (100% local, rapide et sans expiration d'URL)
        if (fileId) {
          try {
            const blob = await getFileBlob(fileId);
            if (blob) {
              arrayBuffer = await blob.arrayBuffer();
            }
          } catch (e) {
            console.warn('[PdfHorizontalViewer] Lecture binaire IndexedDB:', e);
          }
        }

        // 2. Priorité 2 : si l'objet file passé possède directement arrayBuffer
        if (!arrayBuffer && file && typeof file.arrayBuffer === 'function') {
          try {
            arrayBuffer = await file.arrayBuffer();
          } catch (e) {}
        }

        // 3. Priorité 3 : récupération via l'URL (blob: ou http:)
        if (!arrayBuffer && url) {
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              arrayBuffer = await resp.arrayBuffer();
            }
          } catch (e) {
            console.warn('[PdfHorizontalViewer] Fetch url fallback:', e);
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
          throw new Error("Impossible de charger les données du document PDF.");
        }

        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[PdfHorizontalViewer] Erreur chargement PDF horizontal:', err);
        if (isMounted) {
          setError("Impossible de charger l'affichage horizontal pour ce document.");
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
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setCurrentPage(pageNum);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) {
      if (e.deltaY !== 0) {
        containerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;

    for (let [pageNum, el] of pageRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (rect.left <= centerX && rect.right >= centerX) {
        setCurrentPage(pageNum);
        break;
      }
    }
  };

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        scrollToPage(Math.min(numPages, currentPage + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        scrollToPage(Math.max(1, currentPage - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, currentPage]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-stone-100 dark:bg-stone-900">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
          Chargement du mode horizontal (de gauche à droite)...
        </p>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-stone-100 dark:bg-stone-900">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
        <p className="text-sm font-bold text-stone-800 dark:text-stone-200">{error || "Erreur de rendu horizontal"}</p>
        <p className="text-xs text-stone-500 mt-1">Vous pouvez rebasculer en mode vertical avec le bouton du haut.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-stone-100 dark:bg-stone-950 overflow-hidden relative select-none">
      {/* Top Controls Bar for Horizontal Mode */}
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
          <span className="hidden md:inline">↔ Molette souris ou flèches clavier pour défiler</span>
        </div>
      </div>

      {/* Floating Side Navigation Arrows */}
      {currentPage > 1 && (
        <button
          onClick={() => scrollToPage(currentPage - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white/90 dark:bg-stone-800/90 shadow-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all cursor-pointer text-stone-700 dark:text-stone-200"
          title="Page précédente"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {currentPage < numPages && (
        <button
          onClick={() => scrollToPage(currentPage + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white/90 dark:bg-stone-800/90 shadow-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all cursor-pointer text-stone-700 dark:text-stone-200"
          title="Page suivante"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Horizontal Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onScroll={handleScroll}
        className="flex-1 w-full h-full overflow-x-auto overflow-y-hidden flex flex-row items-center gap-8 px-12 py-6 snap-x snap-mandatory hide-scrollbar"
        style={{ zoom: `${docZoom}%` }}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            ref={(el) => {
              if (el) pageRefs.current.set(pageNum, el);
              else pageRefs.current.delete(pageNum);
            }}
            className="shrink-0 h-full max-h-[82vh] flex flex-col items-center justify-center snap-center relative"
          >
            <PdfPageRenderer
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
            />
            <div className="text-[10px] font-bold text-stone-600 dark:text-stone-400 mt-2 bg-white/90 dark:bg-stone-900/90 px-2.5 py-0.5 rounded-full border border-stone-300 dark:border-stone-700 shadow-xs">
              Page {pageNum} sur {numPages}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
