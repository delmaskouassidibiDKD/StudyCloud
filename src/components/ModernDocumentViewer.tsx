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
  RotateCw
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getFileBlob } from '../services/localFileStorage';

// Configuration du worker PDF.js
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
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
  const [isVisible, setIsVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  // N'initialiser le rendu Canvas que lorsque la page s'approche de la zone visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { rootMargin: '350px 0px 350px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) return;
    let renderTask: any = null;

    pdfDoc.getPage(pageNumber).then((page: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = page.render({ canvasContext: ctx, viewport });
      renderTask.promise
        .then(() => setRendered(true))
        .catch(() => {});
    });

    return () => {
      if (renderTask) {
        try { renderTask.cancel(); } catch {}
      }
    };
  }, [isVisible, pdfDoc, pageNumber, scale]);

  return (
    <div ref={containerRef} className="relative flex justify-center bg-white min-h-[300px] w-full">
      {!rendered && (
        <div className="flex items-center justify-center p-8 bg-stone-100 dark:bg-zinc-800 animate-pulse min-h-[300px] w-full">
          <span className="text-xs text-zinc-400 font-semibold">Page {pageNumber}...</span>
        </div>
      )}
      {isVisible && <canvas ref={canvasRef} className="max-w-full block" />}
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
}

export const ModernDocumentViewer: React.FC<ModernDocumentViewerProps> = ({
  url,
  fileId,
  fileName = 'Document',
  fileSize,
  textContent,
  className = ''
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
  const isTextOrCode =
    ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'sql', 'cpp', 'c', 'java', 'xml', 'yaml', 'yml'].includes(ext) ||
    (!isPdf && !isWord && !isExcel);

  // États généraux
  const [, setBlob] = useState<Blob | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>(url || '');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const objectUrlRef = useRef<string | null>(null);

  // Nettoyage rigoureux de la mémoire vive à la fermeture du viewer
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch {}
      }
    };
  }, [pdfDoc]);

  // Mode d'affichage PDF : 'native' (Lecteur iframe navigateur comme dans la photo) ou 'continuous' (Défilement vertical continu PDF.js)
  const [pdfViewMode, setPdfViewMode] = useState<'native' | 'continuous'>('native');

  // États PDF
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.25);

  // États Word
  const [wordHtml, setWordHtml] = useState<string>('');

  // États Excel
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);

  // États Code / Texte
  const [rawText, setRawText] = useState<string>(textContent || '');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // URL résolue prête pour le lecteur natif avec barre d'outils et défilement vertical FitH
  const effectivePdfUrl = resolvedUrl || url || '';
  const cleanPdfBase = effectivePdfUrl ? effectivePdfUrl.split('#')[0] : '';
  const nativePdfUrl = cleanPdfBase ? `${cleanPdfBase}#toolbar=1&navpanes=0&view=FitH` : '';

  // 1. Récupération du Blob binaire (depuis IndexedDB ou fetch URL)
  const fetchBinaryData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    let foundBlob: Blob | null = null;

    // A. Essayer depuis IndexedDB par fileId
    if (fileId) {
      try {
        foundBlob = await getFileBlob(fileId);
      } catch (e) {
        console.warn('[ModernDocumentViewer] Erreur IndexedDB:', e);
      }
    }

    // B. Si pas trouvé et URL valide
    if (!foundBlob && url && typeof url === 'string' && url.trim() && !url.startsWith('data:image/')) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          foundBlob = await res.blob();
        }
      } catch (err) {
        console.warn('[ModernDocumentViewer] Erreur fetch distant:', err);
      }
    }

    if (foundBlob) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      setBlob(foundBlob);
      const bUrl = URL.createObjectURL(foundBlob);
      objectUrlRef.current = bUrl;
      setResolvedUrl(bUrl);
      return foundBlob;
    }

    // C. Si URL directe existante
    if (url && typeof url === 'string' && url.trim()) {
      setResolvedUrl(url);
      setIsLoading(false);
      return null;
    }

    // D. Si rien trouvé mais textContent existe
    if (textContent) {
      setRawText(textContent);
      setIsLoading(false);
      return null;
    }

    setIsLoading(false);
    setErrorMessage("Impossible d'accéder au contenu du document.");
    return null;
  }, [fileId, url, textContent]);

  useEffect(() => {
    let isCancelled = false;

    fetchBinaryData().then(async (loadedBlob) => {
      if (isCancelled) return;

      if (!loadedBlob) {
        if (url && isPdf) {
          // Si on a l'URL directe du PDF, on arrête le chargement pour laisser l'iframe natif s'afficher
          setIsLoading(false);
        }
        return;
      }

      // Traitement selon le format :
      try {
        if (isPdf) {
          // Mode natif par défaut : ne pas charger pdfjsLib ni dupliquer le PDF dans la mémoire vive JS
          if (pdfViewMode === 'continuous' || !nativePdfUrl) {
            const arrayBuffer = await loadedBlob.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            const doc = await loadingTask.promise;
            if (!isCancelled) {
              setPdfDoc(doc);
              setPdfTotalPages(doc.numPages);
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } else if (isWord) {
          // Convertir DOCX en HTML avec mammoth
          const arrayBuffer = await loadedBlob.arrayBuffer();
          const res = await mammoth.convertToHtml({ arrayBuffer });
          if (!isCancelled) {
            setWordHtml(res.value || '<p>Document Word vide.</p>');
            setIsLoading(false);
          }
        } else if (isExcel) {
          // Lire le classeur Excel avec XLSX
          const arrayBuffer = await loadedBlob.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          if (!isCancelled) {
            setWorkbook(wb);
            if (wb.SheetNames.length > 0) {
              const firstSheet = wb.SheetNames[0];
              setActiveSheetName(firstSheet);
              const rawData = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1 }) as any[][];
              setSheetData(rawData);
            }
            setIsLoading(false);
          }
        } else {
          // Lecture texte / code
          const text = await loadedBlob.text();
          if (!isCancelled) {
            setRawText(text);
            setIsLoading(false);
          }
        }
      } catch (err: any) {
        console.error('[ModernDocumentViewer] Erreur rendu format:', err);
        if (!isCancelled) {
          // Pour les PDFs, même si PDF.js échoue, l'iframe natif peut encore fonctionner
          if (isPdf && (resolvedUrl || url)) {
            setIsLoading(false);
          } else {
            setErrorMessage(`Erreur lors du traitement du document (${err.message || 'Format corrompu'})`);
            setIsLoading(false);
          }
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [fetchBinaryData, isPdf, isWord, isExcel, url, resolvedUrl]);

  // Charger PDF.js à la demande uniquement si l'utilisateur bascule en mode continu
  useEffect(() => {
    let isCancelled = false;
    if (isPdf && pdfViewMode === 'continuous' && !pdfDoc) {
      setIsLoading(true);
      fetchBinaryData().then(async (blob) => {
        if (isCancelled || !blob) {
          setIsLoading(false);
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const doc = await loadingTask.promise;
          if (!isCancelled) {
            setPdfDoc(doc);
            setPdfTotalPages(doc.numPages);
            setIsLoading(false);
          }
        } catch {
          if (!isCancelled) setIsLoading(false);
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [isPdf, pdfViewMode, pdfDoc, fetchBinaryData]);

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
    <div className={`w-full h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden ${className}`}>
      {/* 1. EN-TÊTE DU DOCUMENT AVEC ACTIONS & CONTRÔLES */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
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
            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md" title={fileName}>
              {fileName}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span className="uppercase font-semibold">{ext || 'DOC'}</span>
              {fileSize && <span>• {fileSize}</span>}
              {isPdf && pdfTotalPages > 1 && <span>• {pdfTotalPages} pages (Défilement vertical)</span>}
            </div>
          </div>
        </div>

        {/* Barre d'outils droite */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bascule mode Lecteur Navigateur / Défilement continu pour PDF */}
          {isPdf && nativePdfUrl && (
            <button
              type="button"
              onClick={() => setPdfViewMode(m => m === 'native' ? 'continuous' : 'native')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                pdfViewMode === 'native'
                  ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                  : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200'
              }`}
              title={pdfViewMode === 'native' ? "Passer au défilement vertical continu PDF.js" : "Passer au lecteur navigateur intégré"}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {pdfViewMode === 'native' ? 'Lecteur Intégré' : 'Défilement Continu'}
              </span>
            </button>
          )}

          {/* Zoom pour mode défilement continu PDF */}
          {isPdf && pdfViewMode === 'continuous' && (
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setPdfScale(prev => Math.max(0.6, prev - 0.15))}
                className="p-0.5 hover:text-orange-500 cursor-pointer text-zinc-600 dark:text-zinc-300"
                title="Zoom arrière"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1 font-bold">{Math.round(pdfScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setPdfScale(prev => Math.min(2.5, prev + 0.15))}
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

      {/* 2. ZONE DE CONTENU PRINCIPALE AVEC DÉFILEMENT VERTICAL FLUIDE */}
      <div className="flex-1 w-full h-full overflow-hidden relative flex flex-col">
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
              onClick={fetchBinaryData}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        )}

        {/* A. RENDU PDF (1. Mode Lecteur Navigateur Natif avec défilement vertical et barre d'outils complète) */}
        {isPdf && !errorMessage && pdfViewMode === 'native' && nativePdfUrl && (
          <div className="w-full h-full flex-1 flex flex-col items-center overflow-hidden bg-stone-100 dark:bg-stone-900">
            <object
              key={`pdf-native-${fileId || cleanPdfBase}`}
              data={nativePdfUrl}
              type="application/pdf"
              className="w-full h-full border-0 block flex-1"
              style={{ width: '100%', height: '100%', minHeight: '100%' }}
            >
              <iframe
                key={`iframe-pdf-native-${fileId || cleanPdfBase}`}
                src={nativePdfUrl}
                title={fileName || 'Document PDF'}
                className="w-full h-full border-0 block flex-1"
                style={{ width: '100%', height: '100%', minHeight: '100%' }}
              />
            </object>
          </div>
        )}

        {/* A. RENDU PDF (2. Mode Défilement Continu Multi-Pages avec PDF.js) */}
        {isPdf && !errorMessage && (pdfViewMode === 'continuous' || !nativePdfUrl) && (
          <div className="w-full h-full flex-1 overflow-y-auto flex flex-col items-center gap-6 p-4 sm:p-6 bg-stone-100 dark:bg-zinc-900 select-text">
            {pdfDoc ? (
              Array.from({ length: pdfTotalPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  className="flex flex-col items-center rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-white shadow-xl max-w-full"
                >
                  <PdfPageCanvas pdfDoc={pdfDoc} pageNumber={pageNum} scale={pdfScale} />
                  <div className="w-full py-1 text-center text-[10px] font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 select-none">
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

        {/* B. RENDU WORD (.docx via Mammoth avec défilement vertical) */}
        {isWord && !errorMessage && (
          <div className="w-full h-full flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-stone-100 dark:bg-zinc-900 select-text">
            <div className="w-full max-w-3xl bg-white text-zinc-900 p-8 sm:p-12 rounded-xl shadow-lg border border-zinc-200 my-auto prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: wordHtml }} />
            </div>
          </div>
        )}

        {/* C. RENDU EXCEL (.xlsx, .xls, .csv via XLSX avec défilement) */}
        {isExcel && !errorMessage && (
          <div className="w-full h-full flex-1 flex flex-col p-3 sm:p-4 bg-stone-50 dark:bg-zinc-950 overflow-hidden">
            {/* Onglets des feuilles Excel */}
            {workbook && workbook.SheetNames.length > 1 && (
              <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 shrink-0">
                {workbook.SheetNames.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => selectExcelSheet(sName)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                      activeSheetName === sName
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300'
                    }`}
                  >
                    {sName}
                  </button>
                ))}
              </div>
            )}

            {/* Tableau de données interactif avec défilement fluide */}
            <div className="w-full flex-1 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="w-full border-collapse text-xs text-left">
                <tbody>
                  {sheetData.slice(0, 150).map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx === 0 ? 'bg-zinc-100 dark:bg-zinc-800/90 font-bold border-b border-zinc-300 dark:border-zinc-700' : 'border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}
                    >
                      <td className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/40 text-[10px] text-zinc-400 font-mono select-none border-r border-zinc-200 dark:border-zinc-800">
                        {rIdx + 1}
                      </td>
                      {Array.isArray(row) && row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-zinc-800 dark:text-zinc-200 border-r border-zinc-100 dark:border-zinc-800/40 last:border-r-0">
                          {cell !== undefined && cell !== null ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sheetData.length > 150 && (
                <div className="p-2 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                  Affichage des 150 premières lignes sur {sheetData.length}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* D. RENDU CODE & TEXTE BRUT avec défilement vertical complet */}
        {isTextOrCode && !errorMessage && (
          <div className="w-full h-full flex-1 flex flex-col font-mono text-xs overflow-hidden bg-[#1e1e1e] text-zinc-100 p-2 sm:p-4">
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4 leading-relaxed select-text rounded-xl bg-[#181818] border border-zinc-800 shadow-inner">
              <pre className="whitespace-pre-wrap font-mono">
                {rawText || 'Fichier texte vide.'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
