import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Share2, 
  FileText,
  SlidersHorizontal
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileBlob, ensureDecompressedArrayBuffer } from '../services/localFileStorage';
import { getWorkerApiUrl } from '../services/api';
import { extractPageLines, PageLine } from './PdfHorizontalViewer';

// Assurer la configuration du worker local PDF.js
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export interface MobilePdfViewerProps {
  fileId?: string;
  file?: any;
  url?: string;
  docZoom?: number;
  onZoomChange?: (zoom: number) => void;
  layoutMode?: 'vertical' | 'horizontal';
  activeSpeechPage?: number;
  activeSpeechLineIndex?: number;
  currentSpokenText?: string;
  autoScrollEnabled?: boolean;
  isSpeaking?: boolean;
  onSegmentsExtracted?: (segments: any[]) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  isFullscreen?: boolean;
}

interface MobilePdfPageProps {
  pdfDoc: any;
  pageNumber: number;
  zoomLevel: number;
  containerWidth: number;
  isSpeaking: boolean;
  isSpeakingThisPage: boolean;
  activeSpeechLineIndex?: number;
  autoScrollEnabled?: boolean;
  registerPageEl: (pageNum: number, el: HTMLDivElement | null) => void;
}

const MobilePdfPage: React.FC<MobilePdfPageProps> = ({
  pdfDoc,
  pageNumber,
  zoomLevel,
  containerWidth,
  isSpeaking,
  isSpeakingThisPage,
  activeSpeechLineIndex,
  autoScrollEnabled = true,
  registerPageEl
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const activeAnchorRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(0.707);
  const [lines, setLines] = useState<PageLine[]>([]);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    const el = pageContainerRef.current;
    if (!el) return;

    registerPageEl(pageNumber, el);

    if (pageNumber <= 2) {
      setShouldRender(true);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setShouldRender(true);
            }
          });
        },
        { rootMargin: '450px 0px' }
      );

      observer.observe(el);
      return () => {
        observer.disconnect();
        registerPageEl(pageNumber, null);
      };
    } else {
      setShouldRender(true);
      return () => {
        registerPageEl(pageNumber, null);
      };
    }
  }, [pageNumber, registerPageEl]);

  useEffect(() => {
    if (isSpeakingThisPage) {
      setShouldRender(true);
    }
  }, [isSpeakingThisPage]);

  useEffect(() => {
    if (!shouldRender || !pdfDoc || !canvasRef.current) return;
    let isMounted = true;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const pageW = unscaledViewport.width || 595;
        const pageH = unscaledViewport.height || 842;
        const ratio = pageW / pageH;
        setAspectRatio(ratio);

        const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2, 2.0);
        const usableWidth = Math.max(280, containerWidth - 20);
        const effectivePixelWidth = usableWidth * (zoomLevel / 100);
        const renderScale = (effectivePixelWidth / pageW) * dpr;

        const renderViewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        canvas.width = Math.round(renderViewport.width);
        canvas.height = Math.round(renderViewport.height);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({ canvasContext: ctx, viewport: renderViewport });
        renderTaskRef.current = task;
        await task.promise;

        const pageLines = await extractPageLines(page, pageNumber);
        if (isMounted) {
          setLines(pageLines);
          setRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`[MobilePdfPage] Erreur rendu page ${pageNumber}:`, err);
        }
      }
    };

    render();
    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
    };
  }, [shouldRender, pdfDoc, pageNumber, zoomLevel, containerWidth]);

  useEffect(() => {
    if (!isSpeakingThisPage || !autoScrollEnabled) return;
    if (activeSpeechLineIndex === undefined || activeSpeechLineIndex < 0) return;

    const timer = setTimeout(() => {
      if (activeAnchorRef.current) {
        activeAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeSpeechLineIndex, isSpeakingThisPage, autoScrollEnabled]);

  const usableW = Math.max(280, containerWidth - 20);
  const displayW = Math.round(usableW * (zoomLevel / 100));
  const displayH = Math.round(displayW / (aspectRatio || 0.707));

  return (
    <div
      ref={pageContainerRef}
      className="flex flex-col items-center shrink-0 w-full"
    >
      <div
        className="relative bg-white shadow-md rounded-md overflow-hidden border border-stone-200 dark:border-stone-800"
        style={{ width: `${displayW}px`, height: `${displayH}px` }}
      >
        {!rendered && (
          <div className="absolute inset-0 bg-stone-50 dark:bg-stone-900 flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`block w-full h-full ${rendered ? 'opacity-100' : 'opacity-0'} transition-opacity duration-150`}
          style={{ width: '100%', height: '100%' }}
        />

        {isSpeakingThisPage && typeof activeSpeechLineIndex === 'number' && activeSpeechLineIndex >= 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {lines.map((line) => {
              if (line.lineIndex !== activeSpeechLineIndex) return null;
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
                    backgroundColor: 'rgba(255, 235, 59, 0.65)',
                    borderBottom: '3.5px solid #FF3B30',
                    boxShadow: '0 2px 8px rgba(255, 59, 48, 0.45)',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className={`text-[10px] font-bold mt-1.5 px-2.5 py-0.5 rounded-full border shadow-xs transition-colors ${
        isSpeakingThisPage
          ? 'bg-orange-500 text-white border-orange-600'
          : 'text-stone-600 dark:text-stone-400 bg-white/90 dark:bg-stone-900/90 border-stone-200 dark:border-stone-800'
      }`}>
        Page {pageNumber}
      </div>
    </div>
  );
};

export const MobilePdfViewer: React.FC<MobilePdfViewerProps> = ({
  fileId,
  file,
  url,
  docZoom = 100,
  onZoomChange,
  layoutMode: externalLayoutMode,
  activeSpeechPage,
  activeSpeechLineIndex,
  currentSpokenText,
  autoScrollEnabled = true,
  isSpeaking = false,
  onSegmentsExtracted,
  currentPage: externalPage,
  onPageChange,
  isFullscreen = false
}) => {
  const [internalLayoutMode, setInternalLayoutMode] = useState<'vertical' | 'horizontal'>(externalLayoutMode || 'horizontal');
  const layoutMode = externalLayoutMode !== undefined ? externalLayoutMode : internalLayoutMode;
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [internalPage, setInternalPage] = useState<number>(externalPage || 1);
  const currentPage = externalPage !== undefined ? externalPage : internalPage;

  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(docZoom || 100);

  const [lines, setLines] = useState<PageLine[]>([]);
  const [aspectRatio, setAspectRatio] = useState<number>(0.707); // A4 par défaut
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  // Contrôle du curseur / saut rapide de page
  const [showPageSlider, setShowPageSlider] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const verticalContainerRef = useRef<HTMLDivElement>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeAnchorRef = useRef<HTMLDivElement>(null);
  const currentRenderTaskRef = useRef<any>(null);
  const lastScrolledLineRef = useRef<number>(-1);

  // Synchronisation du zoom externe
  useEffect(() => {
    if (docZoom && docZoom !== zoomLevel) {
      setZoomLevel(docZoom);
    }
  }, [docZoom]);

  const updateZoom = (newZoom: number) => {
    const clamped = Math.min(220, Math.max(60, newZoom));
    setZoomLevel(clamped);
    onZoomChange?.(clamped);
  };

  const changePage = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > numPages) return;
    setInternalPage(newPage);
    onPageChange?.(newPage);

    if (layoutMode === 'vertical') {
      const el = pageElementsRef.current.get(newPage);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [numPages, onPageChange, layoutMode]);

  // Synchronisation au basculement vers le mode vertical
  useEffect(() => {
    if (layoutMode === 'vertical') {
      const timer = setTimeout(() => {
        const el = pageElementsRef.current.get(currentPage);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [layoutMode]);

  // Défilement automatique vers la page lue vocalement en mode vertical
  useEffect(() => {
    if (layoutMode === 'vertical' && isSpeaking && autoScrollEnabled && activeSpeechPage && activeSpeechPage !== currentPage) {
      const el = pageElementsRef.current.get(activeSpeechPage);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSpeechPage, layoutMode, isSpeaking, autoScrollEnabled, currentPage]);

  // Synchronisation avec la lecture vocale en mode horizontal
  useEffect(() => {
    if (layoutMode === 'horizontal' && isSpeaking && activeSpeechPage && activeSpeechPage !== currentPage) {
      changePage(activeSpeechPage);
    }
  }, [layoutMode, isSpeaking, activeSpeechPage, currentPage, changePage]);

  // Détection du scroll vertical pour mettre à jour la page courante dynamiquement
  const handleVerticalScroll = () => {
    if (!verticalContainerRef.current) return;
    const containerRect = verticalContainerRef.current.getBoundingClientRect();
    const thresholdY = containerRect.top + containerRect.height * 0.35;

    for (let [pageNum, el] of pageElementsRef.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= thresholdY && rect.bottom >= thresholdY) {
        if (pageNum !== currentPage) {
          setInternalPage(pageNum);
          onPageChange?.(pageNum);
        }
        break;
      }
    }
  };

  // 1. CHARGEMENT ROBUSTE ET FIABLE DU DOCUMENT PDF (Multi-relais)
  const loadPdfDocument = useCallback(async () => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    try {
      let arrayBuffer: ArrayBuffer | null = null;
      const targetId = fileId || file?.id;

      // Étape 1 : Lecture locale instantanée IndexedDB (0ms)
      if (targetId) {
        try {
          const blob = await getFileBlob(targetId);
          if (blob && blob.size > 0) {
            arrayBuffer = await blob.arrayBuffer();
          }
        } catch (e) {
          console.warn('[MobilePdfViewer] Lecture IndexedDB:', e);
        }
      }

      // Étape 2 : ArrayBuffer direct depuis l'objet file si disponible
      if (!arrayBuffer && file && typeof file.arrayBuffer === 'function') {
        try {
          arrayBuffer = await file.arrayBuffer();
        } catch (e) {}
      }

      // Étape 3 : Relais Cloudflare Worker Stream (/api/cloud/stream/:id) avec CORS natif
      if (!arrayBuffer && targetId) {
        try {
          const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
          const streamUrl = `${baseUrl}/api/cloud/stream/${encodeURIComponent(targetId)}`;
          const resp = await fetch(streamUrl);
          if (resp.ok) {
            arrayBuffer = await resp.arrayBuffer();
          }
        } catch (e) {
          console.warn('[MobilePdfViewer] Erreur streaming worker:', e);
        }
      }

      // Étape 4 : Relais par clé R2 si présente
      const r2Key = file?.r2Key || (file as any)?.r2_key;
      if (!arrayBuffer && r2Key) {
        try {
          const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
          const r2Url = `${baseUrl}/api/storage/file/${encodeURIComponent(r2Key)}`;
          const resp = await fetch(r2Url);
          if (resp.ok) {
            arrayBuffer = await resp.arrayBuffer();
          }
        } catch (e) {
          console.warn('[MobilePdfViewer] Erreur R2 storage:', e);
        }
      }

      // Étape 5 : Fetch direct de l'URL
      if (!arrayBuffer && url) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            arrayBuffer = await resp.arrayBuffer();
          }
        } catch (e) {
          console.warn('[MobilePdfViewer] Erreur fetch direct url:', e);
        }
      }

      let loadingTask: any;
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        const cleanBuffer = await ensureDecompressedArrayBuffer(arrayBuffer);
        const typedArray = new Uint8Array(cleanBuffer);
        loadingTask = pdfjsLib.getDocument({
          data: typedArray,
          cMapPacked: true,
          isEvalSupported: false,
        });
      } else if (url && !url.startsWith('blob:')) {
        loadingTask = pdfjsLib.getDocument({
          url: url,
          cMapPacked: true,
          isEvalSupported: false,
        });
      } else {
        throw new Error("Impossible d'accéder au fichier PDF. Vérifiez votre connexion.");
      }

      const doc = await loadingTask.promise;
      if (!isMounted) return;

      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setLoading(false);
    } catch (err: any) {
      console.error('[MobilePdfViewer] Échec chargement PDF:', err);
      if (isMounted) {
        setError(err?.message || "Impossible de charger le document PDF.");
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [fileId, file, url]);

  useEffect(() => {
    loadPdfDocument();
  }, [loadPdfDocument]);

  // Nettoyage complet à la destruction du composant
  useEffect(() => {
    return () => {
      if (currentRenderTaskRef.current) {
        try { currentRenderTaskRef.current.cancel(); } catch {}
      }
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch {}
      }
    };
  }, [pdfDoc]);

  // Extraction en arrière-plan des segments de texte de toutes les pages pour la lecture vocale
  useEffect(() => {
    if (!pdfDoc || !onSegmentsExtracted) return;
    let isMounted = true;

    const extractAllDocSegments = async () => {
      try {
        const allSegments: any[] = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          if (!isMounted) break;
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
      } catch (e) {
        console.warn('[MobilePdfViewer] Extraction background all segments:', e);
      }
    };

    extractAllDocSegments();
    return () => { isMounted = false; };
  }, [pdfDoc, onSegmentsExtracted]);

  // 2. RENDU DE LA PAGE UNIQUE EN MODE HORIZONTAL
  useEffect(() => {
    if (layoutMode !== 'horizontal') return;
    if (!pdfDoc || !canvasRef.current) return;
    let isMounted = true;

    // Annuler le rendu précédent si toujours en cours
    if (currentRenderTaskRef.current) {
      try {
        currentRenderTaskRef.current.cancel();
      } catch {}
      currentRenderTaskRef.current = null;
    }

    setRendering(true);

    const renderCurrentPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (!isMounted || !canvasRef.current) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const pageW = unscaledViewport.width || 595;
        const pageH = unscaledViewport.height || 842;
        const currentRatio = pageW / pageH;

        setAspectRatio(currentRatio);
        setPageDims({ width: pageW, height: pageH });

        // Calcul de la résolution optimale pour l'écran mobile
        // Limiter le DPR à 2.0 pour éviter toute surconsommation de mémoire
        const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2, 2.0);
        const containerW = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 360);
        
        // Largeur de base : remplit l'écran avec une marge propre de 16px
        const usableWidth = Math.max(280, containerW - 20);
        const effectivePixelWidth = usableWidth * (zoomLevel / 100);
        const renderScale = (effectivePixelWidth / pageW) * dpr;

        const renderViewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = Math.round(renderViewport.width);
        canvas.height = Math.round(renderViewport.height);

        // Fond blanc pur pour un rendu net et lisible
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        });

        currentRenderTaskRef.current = renderTask;
        await renderTask.promise;

        // Extraction des lignes UNIQUEMENT pour la page active (instantané et léger)
        const pageLines = await extractPageLines(page, currentPage);
        if (isMounted) {
          setLines(pageLines);
          if (onSegmentsExtracted) {
            const pageSegments = pageLines.map(l => ({
              text: l.text,
              page: currentPage,
              lineIndex: l.lineIndex,
            }));
            onSegmentsExtracted(pageSegments);
          }
          setRendering(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`[MobilePdfViewer] Erreur rendu page ${currentPage}:`, err);
        }
        if (isMounted) {
          setRendering(false);
        }
      }
    };

    renderCurrentPage();

    return () => {
      isMounted = false;
      if (currentRenderTaskRef.current) {
        try { currentRenderTaskRef.current.cancel(); } catch {}
      }
    };
  }, [layoutMode, pdfDoc, currentPage, zoomLevel]);

  // 3. GESTION DES GESTES TACTILES (Swipe gauche/droite pour tourner les pages en mode horizontal)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (layoutMode !== 'horizontal') return;
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (layoutMode !== 'horizontal') return;
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;

    // Détection d'un swipe horizontal franc (distance > 50px, durée < 450ms, plus horizontal que vertical)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && duration < 450) {
      if (deltaX < 0 && currentPage < numPages) {
        // Swipe vers la gauche -> page suivante
        changePage(currentPage + 1);
      } else if (deltaX > 0 && currentPage > 1) {
        // Swipe vers la droite -> page précédente
        changePage(currentPage - 1);
      }
    }
  };

  // Défilement automatique vers la ligne active lors de la lecture vocale
  useEffect(() => {
    if (!isSpeaking || activeSpeechLineIndex === undefined || activeSpeechLineIndex < 0) return;
    if (activeSpeechLineIndex === lastScrolledLineRef.current) return;
    lastScrolledLineRef.current = activeSpeechLineIndex;

    const timer = setTimeout(() => {
      if (activeAnchorRef.current) {
        activeAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [activeSpeechLineIndex, isSpeaking]);

  // Téléchargement direct du PDF
  const handleDownload = async () => {
    try {
      let downloadUrl = url || file?.url;
      if (!downloadUrl && fileId) {
        const blob = await getFileBlob(fileId);
        if (blob) {
          downloadUrl = URL.createObjectURL(blob);
        }
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file?.name || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.warn('Erreur de téléchargement:', e);
    }
  };

  // Largeur d'affichage CSS du canvas
  const containerW = containerRef.current?.clientWidth || verticalContainerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 360);
  const displayWidth = Math.round(Math.max(280, containerW - 20) * (zoomLevel / 100));
  const displayHeight = Math.round(displayWidth / (aspectRatio || 0.707));

  // ÉTAT CHARGEMENT
  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-stone-50 dark:bg-[#0b0f19] p-6 text-center">
        <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
          Chargement du PDF...
        </p>
        <span className="text-[11px] text-stone-400">
          Optimisation pour mobile en cours
        </span>
      </div>
    );
  }

  // ÉTAT ERREUR
  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-stone-50 dark:bg-[#0b0f19] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-500 shadow-sm">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-stone-900 dark:text-white mb-1">
            Chargement difficile
          </h4>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs leading-relaxed">
            {error || "Impossible d'afficher le document PDF."}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => loadPdfDocument()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réessayer</span>
          </button>
          {url && (
            <a
              href={url}
              download={file?.name || 'document.pdf'}
              className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-stone-100 dark:bg-stone-950 overflow-hidden relative select-none">
      {/* 1. BARRE DE CONTRÔLES SUPÉRIEURE MOBILE */}
      <div className="w-full px-3 py-1.5 bg-white dark:bg-[#111827] border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 shadow-xs z-20">
        {/* Navigation rapide par boutons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 rounded-lg text-stone-700 dark:text-stone-300 active:scale-95 transition-all cursor-pointer"
            title="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Sélecteur de page cliquable */}
          <button
            type="button"
            onClick={() => setShowPageSlider(prev => !prev)}
            className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 rounded-lg text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
          >
            <span>{currentPage} / {numPages}</span>
            <SlidersHorizontal className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          <button
            type="button"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 rounded-lg text-stone-700 dark:text-stone-300 active:scale-95 transition-all cursor-pointer"
            title="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Contrôles du zoom & Téléchargement (point rouge utilisateur) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-400 active:scale-95 transition-all cursor-pointer"
            title="Télécharger le fichier"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => updateZoom(zoomLevel - 15)}
            disabled={zoomLevel <= 60}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-400 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => updateZoom(100)}
            className="px-2 py-0.5 text-[11px] font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors"
            title="Réinitialiser zoom"
          >
            {zoomLevel}%
          </button>

          <button
            type="button"
            onClick={() => updateZoom(zoomLevel + 15)}
            disabled={zoomLevel >= 220}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-400 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. CURSEUR DE NAVIGATION RAPIDE (Pop-down pliable) */}
      {showPageSlider && (
        <div className="w-full px-4 py-2.5 bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3 animate-fadeIn z-20">
          <span className="text-[11px] font-bold text-stone-500">P. 1</span>
          <input
            type="range"
            min={1}
            max={numPages}
            value={currentPage}
            onChange={(e) => changePage(Number(e.target.value))}
            className="flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-200 dark:bg-stone-700 rounded-lg"
          />
          <span className="text-[11px] font-bold text-stone-500">P. {numPages}</span>
        </div>
      )}

      {/* 3. ZONE PRINCIPALE DE LECTURE (Vertical continu ou Horizontal page unique) */}
      {layoutMode === 'vertical' ? (
        <div
          ref={verticalContainerRef}
          onScroll={handleVerticalScroll}
          className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-5 p-2.5 sm:p-4 touch-pan-y"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
            <MobilePdfPage
              key={p}
              pdfDoc={pdfDoc}
              pageNumber={p}
              zoomLevel={zoomLevel}
              containerWidth={containerW}
              isSpeaking={isSpeaking}
              isSpeakingThisPage={isSpeaking && activeSpeechPage === p}
              activeSpeechLineIndex={activeSpeechLineIndex}
              autoScrollEnabled={autoScrollEnabled}
              registerPageEl={(num, el) => {
                if (el) pageElementsRef.current.set(num, el);
                else pageElementsRef.current.delete(num);
              }}
            />
          ))}
        </div>
      ) : (
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 w-full h-full overflow-auto flex items-center justify-center p-2.5 sm:p-4 touch-pan-x touch-pan-y"
        >
          <div 
            className="relative bg-white shadow-xl rounded-md overflow-hidden transition-all duration-150 border border-stone-200 dark:border-stone-800"
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              maxWidth: 'none',
            }}
          >
            {/* Indicateur de rendu si changement de page */}
            {rendering && (
              <div className="absolute inset-0 bg-white/70 dark:bg-stone-950/70 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Canvas haute performance */}
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />

            {/* Surlignage Stabilo jaune + rouge lors de la lecture vocale */}
            {isSpeaking && typeof activeSpeechLineIndex === 'number' && activeSpeechLineIndex >= 0 && (
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {lines.map((line) => {
                  if (line.lineIndex !== activeSpeechLineIndex) return null;
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
                        backgroundColor: 'rgba(255, 235, 59, 0.65)',
                        borderBottom: '3.5px solid #FF3B30',
                        boxShadow: '0 2px 8px rgba(255, 59, 48, 0.45)',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. BARRE INFÉRIEURE AVEC GESTION DU SWIPE & BOUTONS FLUIDES */}
      {layoutMode === 'horizontal' ? (
        <div className="w-full px-4 py-2 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs border-t border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 z-20">
          <button
            type="button"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
            Glisser pour tourner la page ↔
          </span>

          <button
            type="button"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 rounded-xl text-xs font-bold text-white flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <span>Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-full px-4 py-1.5 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs border-t border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 z-20 text-xs">
          <button
            type="button"
            onClick={() => changePage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-30 rounded-lg text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Haut</span>
          </button>

          <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <span>Défilement vertical ↕</span>
            <span className="text-orange-600 dark:text-orange-400 font-extrabold">({currentPage}/{numPages})</span>
          </span>

          <button
            type="button"
            onClick={() => changePage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 rounded-lg text-xs font-bold text-white flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <span>Bas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

