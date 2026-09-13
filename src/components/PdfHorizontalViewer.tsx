import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PdfHorizontalViewerProps {
  url: string;
  docZoom: number;
}

function PdfPageRenderer({ pdfDoc, pageNumber }: { pdfDoc: any; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelRender: any = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        // Render at 1.8x scale for crisp display
        const viewport = page.getViewport({ scale: 1.8 });
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
    <div className="relative h-full flex items-center justify-center">
      {!rendered && (
        <div className="w-[320px] h-[440px] bg-white dark:bg-stone-900 rounded-xl shadow-md border border-stone-200 dark:border-stone-800 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`max-h-[76vh] w-auto rounded-xl shadow-lg border border-stone-300 dark:border-stone-700 bg-white transition-opacity duration-300 ${
          rendered ? 'opacity-100' : 'opacity-0 absolute'
        }`}
      />
    </div>
  );
}

export function PdfHorizontalViewer({ url, docZoom }: PdfHorizontalViewerProps) {
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
        const loadingTask = pdfjsLib.getDocument(url);
        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Erreur chargement PDF horizontal:', err);
        if (isMounted) {
          setError("Impossible d'activer le défilement horizontal pour ce PDF.");
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [url]);

  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setCurrentPage(pageNum);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current && e.deltaY !== 0) {
      containerRef.current.scrollLeft += e.deltaY;
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

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-stone-100 dark:bg-stone-900">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
          Conversion en défilement horizontal de gauche à droite...
        </p>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-stone-100 dark:bg-stone-900">
        <FileText className="w-10 h-10 text-red-500 mb-2" />
        <p className="text-sm font-bold text-stone-800 dark:text-stone-200">{error || "Erreur de rendu horizontal"}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-stone-100 dark:bg-stone-950 overflow-hidden relative select-none">
      {/* Horizontal Reading Header Controls */}
      <div className="w-full px-4 py-1.5 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 z-20 shadow-xs">
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

          <span className="text-xs font-black text-stone-700 dark:text-stone-200 bg-stone-200/60 dark:bg-stone-800 px-3 py-1 rounded-md">
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

        <div className="flex items-center gap-2 text-[11px] font-medium text-stone-500">
          <span className="hidden md:inline">↔ Défilement horizontal (molette ou balayage)</span>
        </div>
      </div>

      {/* Horizontal Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onScroll={handleScroll}
        className="flex-1 w-full h-full overflow-x-auto overflow-y-hidden flex flex-row items-center gap-8 px-8 py-6 snap-x snap-mandatory hide-scrollbar"
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
