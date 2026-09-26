import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  RefreshCw,
  Search
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getFileBlob, getFileBlobUrl } from '../services/localFileStorage';

// Configuration du worker PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

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

  const isPdf = ext === 'pdf' || (url && url.toLowerCase().includes('.pdf'));
  const isWord = ['docx', 'doc'].includes(ext);
  const isExcel = ['xlsx', 'xls', 'csv'].includes(ext);
  const isTextOrCode = ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'sql', 'cpp', 'c', 'java', 'xml', 'yaml', 'yml'].includes(ext) || (!isPdf && !isWord && !isExcel);

  // États généraux
  const [blob, setBlob] = useState<Blob | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // États PDF
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageNum, setPdfPageNum] = useState<number>(1);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.25);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // États Word
  const [wordHtml, setWordHtml] = useState<string>('');

  // États Excel
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');

  // États Code / Texte
  const [rawText, setRawText] = useState<string>(textContent || '');
  const [isCopied, setIsCopied] = useState<boolean>(false);

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
      setBlob(foundBlob);
      const bUrl = URL.createObjectURL(foundBlob);
      setResolvedUrl(bUrl);
      return foundBlob;
    }

    // C. Si rien trouvé mais textContent existe
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
    fetchBinaryData().then(async (loadedBlob) => {
      if (!loadedBlob) return;

      // Traitement selon le format :
      try {
        if (isPdf) {
          // Charger le document PDF via PDF.js
          const arrayBuffer = await loadedBlob.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const doc = await loadingTask.promise;
          setPdfDoc(doc);
          setPdfTotalPages(doc.numPages);
          setPdfPageNum(1);
          setIsLoading(false);
        } else if (isWord) {
          // Convertir DOCX en HTML avec mammoth
          const arrayBuffer = await loadedBlob.arrayBuffer();
          const res = await mammoth.convertToHtml({ arrayBuffer });
          setWordHtml(res.value || '<p>Document Word vide.</p>');
          setIsLoading(false);
        } else if (isExcel) {
          // Lire le classeur Excel avec XLSX
          const arrayBuffer = await loadedBlob.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            const firstSheet = wb.SheetNames[0];
            setActiveSheetName(firstSheet);
            const rawData = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1 }) as any[][];
            setSheetData(rawData);
          }
          setIsLoading(false);
        } else {
          // Lecture texte / code
          const text = await loadedBlob.text();
          setRawText(text);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[ModernDocumentViewer] Erreur rendu format:', err);
        setErrorMessage(`Erreur lors du traitement du document (${err.message || 'Format corrompu'})`);
        setIsLoading(false);
      }
    });

    return () => {
      if (resolvedUrl && resolvedUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(resolvedUrl); } catch {}
      }
    };
  }, [fetchBinaryData, isPdf, isWord, isExcel]);

  // Rendu de la page PDF sur canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: any = null;

    pdfDoc.getPage(pdfPageNum).then((page: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: pdfScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = page.render({ canvasContext: ctx, viewport });
      renderTask.promise.catch(() => {});
    });

    return () => {
      if (renderTask) {
        try { renderTask.cancel(); } catch {}
      }
    };
  }, [pdfDoc, pdfPageNum, pdfScale]);

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
    <div className={`w-full h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl ${className}`}>
      {/* 1. EN-TÊTE DU DOCUMENT AVEC ACTIONS */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
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
            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[200px] sm:max-w-md" title={fileName}>
              {fileName}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span className="uppercase font-semibold">{ext || 'DOC'}</span>
              {fileSize && <span>• {fileSize}</span>}
              {isPdf && <span>• {pdfTotalPages} page(s)</span>}
            </div>
          </div>
        </div>

        {/* Barre d'outils droite */}
        <div className="flex items-center gap-1.5">
          {/* Zoom pour PDF */}
          {isPdf && (
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setPdfScale(prev => Math.max(0.6, prev - 0.2))}
                className="p-0.5 hover:text-orange-500 cursor-pointer"
                title="Zoom arrière"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1 font-bold">{Math.round(pdfScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setPdfScale(prev => Math.min(3, prev + 0.2))}
                className="p-0.5 hover:text-orange-500 cursor-pointer"
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
              <span>{isCopied ? 'Copié' : 'Copier'}</span>
            </button>
          )}

          {/* Télécharger le fichier original */}
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              download={fileName}
              className="p-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 cursor-pointer border border-zinc-300 dark:border-zinc-700 transition-colors"
              title="Télécharger le fichier"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* 2. ZONE DE CONTENU CENTRAL */}
      <div className="flex-1 w-full overflow-auto relative p-4 flex flex-col items-center">
        {/* Chargement */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xs z-20">
            <div className="w-10 h-10 rounded-full border-3 border-orange-500/20 border-t-orange-500 animate-spin mb-3" />
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Chargement du document...</p>
          </div>
        )}

        {/* Erreur */}
        {errorMessage && !isLoading && (
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

        {/* A. RENDU PDF (Via PDF.js Canvas) */}
        {isPdf && !errorMessage && (
          <div className="flex flex-col items-center justify-center my-auto shadow-2xl rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-white">
            <canvas ref={canvasRef} className="max-w-full block" />
          </div>
        )}

        {/* B. RENDU WORD (.docx via Mammoth) */}
        {isWord && !errorMessage && (
          <div className="w-full max-w-3xl bg-white text-zinc-900 p-8 sm:p-12 rounded-xl shadow-lg border border-zinc-200 my-4 prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: wordHtml }} />
          </div>
        )}

        {/* C. RENDU EXCEL (.xlsx, .xls, .csv via XLSX) */}
        {isExcel && !errorMessage && (
          <div className="w-full h-full flex flex-col">
            {/* Onglets des feuilles Excel */}
            {workbook && workbook.SheetNames.length > 1 && (
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
                {workbook.SheetNames.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => selectExcelSheet(sName)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
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

            {/* Tableau de données interactif */}
            <div className="w-full flex-1 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="w-full border-collapse text-xs text-left">
                <tbody>
                  {sheetData.slice(0, 100).map((row, rIdx) => (
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
              {sheetData.length > 100 && (
                <div className="p-2 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                  Affichage des 100 premières lignes sur {sheetData.length}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* D. RENDU CODE & TEXTE BRUT */}
        {isTextOrCode && !errorMessage && (
          <div className="w-full h-full flex flex-col font-mono text-xs rounded-xl overflow-hidden bg-[#1e1e1e] text-zinc-100 border border-zinc-800 shadow-inner">
            <div className="flex-1 overflow-auto p-4 leading-relaxed select-text">
              <pre className="whitespace-pre-wrap font-mono">
                {rawText || 'Fichier texte vide.'}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 3. BARRE DE PAGINATION INFÉRIEURE POUR PDF */}
      {isPdf && !errorMessage && pdfTotalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs">
          <button
            type="button"
            disabled={pdfPageNum <= 1}
            onClick={() => setPdfPageNum(prev => Math.max(1, prev - 1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédente</span>
          </button>

          <span className="font-bold text-zinc-700 dark:text-zinc-300">
            Page {pdfPageNum} sur {pdfTotalPages}
          </span>

          <button
            type="button"
            disabled={pdfPageNum >= pdfTotalPages}
            onClick={() => setPdfPageNum(prev => Math.min(pdfTotalPages, prev + 1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
          >
            <span>Suivante</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
