import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Edit3,
  Eye
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { storeFileBlob, formatFileSize } from '../services/localFileStorage';
import { CloudDataStore } from '../services/cloudDataStore';
import { UploadQueue } from '../services/uploadQueue';
import { CloudStorageAPI } from '../services/cloudStorageService';

interface AuthenticWordViewerProps {
  fileId?: string;
  fileName?: string;
  fileSize?: string | number;
  arrayBuffer: ArrayBuffer;
  blob?: Blob;
  onSaved?: (newBlob: Blob) => void;
  className?: string;
}

export const AuthenticWordViewer: React.FC<AuthenticWordViewerProps> = ({
  fileId,
  fileName = 'Document.docx',
  fileSize,
  arrayBuffer,
  blob,
  onSaved,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const originalBufferRef = useRef<ArrayBuffer>(arrayBuffer);
  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer>(arrayBuffer);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);

  // Synchronisation du buffer d'origine lors du changement de fichier
  useEffect(() => {
    originalBufferRef.current = arrayBuffer;
    setCurrentBuffer(arrayBuffer);
    setIsDirty(false);
    setSaveSuccess(false);
  }, [arrayBuffer]);

  // Rendu haute fidélité du document Word avec docx-preview
  const renderDocx = useCallback(async (bufferToRender: ArrayBuffer) => {
    if (!containerRef.current) return;
    setIsLoading(true);
    setRenderError(null);

    try {
      containerRef.current.innerHTML = '';
      await renderAsync(bufferToRender, containerRef.current, undefined, {
        className: 'sc-docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderAltChunks: true,
        experimental: true,
      });

      // Rendre les éléments de page éditables directement (contentEditable)
      const wrapper = containerRef.current.querySelector('.sc-docx-wrapper') as HTMLElement | null;
      if (wrapper) {
        wrapper.setAttribute('contenteditable', isEditMode ? 'true' : 'false');
        wrapper.style.outline = 'none';
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('[AuthenticWordViewer] Erreur de rendu docx-preview:', err);
      setRenderError(err?.message || 'Impossible de formater ce document Word.');
      setIsLoading(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    renderDocx(currentBuffer);
  }, [currentBuffer, renderDocx]);

  // Mise à jour de contentEditable selon le mode d'édition
  useEffect(() => {
    if (!containerRef.current) return;
    const wrapper = containerRef.current.querySelector('.sc-docx-wrapper') as HTMLElement | null;
    if (wrapper) {
      wrapper.setAttribute('contenteditable', isEditMode ? 'true' : 'false');
    }
  }, [isEditMode]);

  // Détection des modifications utilisateur dans le conteneur Word
  const handleInput = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
      setSaveSuccess(false);
    }
  }, [isDirty]);

  // Action Abandonner : rétablit immédiatement le document d'origine
  const handleDiscard = useCallback(() => {
    setIsDirty(false);
    setSaveSuccess(false);
    setCurrentBuffer(originalBufferRef.current);
    renderDocx(originalBufferRef.current);
  }, [renderDocx]);

  // Action Enregistrer : reconstruit le fichier DOCX avec les modifications et sauvegarde dans IndexedDB + Cloud
  const handleSave = useCallback(async () => {
    if (!containerRef.current) return;
    setIsSaving(true);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(originalBufferRef.current);

      if (zip.files['word/document.xml']) {
        const docXmlStr = await zip.files['word/document.xml'].async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXmlStr, 'application/xml');

        const xmlPs = Array.from(xmlDoc.getElementsByTagNameNS('*', 'p'));
        const domNodes = Array.from(
          containerRef.current.querySelectorAll('.sc-docx p, .sc-docx table td, .sc-docx table th, .sc-docx article > p, section.sc-docx > p')
        );

        let domIdx = 0;
        for (let i = 0; i < xmlPs.length && domIdx < domNodes.length; i++) {
          const wp = xmlPs[i];
          const xmlTextNodes = Array.from(wp.getElementsByTagNameNS('*', 't'));
          const currentXmlText = xmlTextNodes.map(n => n.textContent || '').join('');

          if (currentXmlText.trim().length > 0) {
            const domEl = domNodes[domIdx] as HTMLElement | undefined;
            domIdx++;
            if (domEl) {
              const newText = domEl.textContent || '';
              if (newText !== currentXmlText && xmlTextNodes.length > 0) {
                xmlTextNodes[0].textContent = newText;
                for (let j = 1; j < xmlTextNodes.length; j++) {
                  xmlTextNodes[j].textContent = '';
                }
              }
            }
          }
        }

        const serializer = new XMLSerializer();
        const updatedXmlStr = serializer.serializeToString(xmlDoc);
        zip.file('word/document.xml', updatedXmlStr);
      }

      const updatedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const updatedArrayBuffer = await updatedBlob.arrayBuffer();
      originalBufferRef.current = updatedArrayBuffer;
      setCurrentBuffer(updatedArrayBuffer);

      // 1. Sauvegarde instantanée en base IndexedDB
      if (fileId) {
        await storeFileBlob(fileId, updatedBlob);

        // 2. Mise à jour de la taille dans CloudDataStore
        CloudDataStore.updateFile(fileId, {
          size: formatFileSize(updatedBlob.size),
          sizeBytes: updatedBlob.size,
          timestamp: Date.now(),
        });

        // 3. Synchronisation Cloud en arrière-plan sans bloquer l'UI
        CloudStorageAPI.uploadFile(updatedBlob, 'documents', fileName, undefined, undefined, undefined, updatedBlob.size, undefined, fileId).catch((err) => {
          console.warn('[AuthenticWordViewer] Échec synchro Cloud:', err);
        });
      }

      onSaved?.(updatedBlob);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('[AuthenticWordViewer] Erreur sauvegarde Word:', err);
      alert("Erreur lors de l'enregistrement : " + (err.message || 'Format non supporté'));
    } finally {
      setIsSaving(false);
    }
  }, [fileId, fileName, onSaved]);

  const copyAllText = () => {
    if (!containerRef.current) return;
    const text = containerRef.current.innerText || '';
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={`w-full h-full min-h-0 flex flex-col bg-stone-100 dark:bg-[#070b14] text-stone-900 dark:text-stone-100 overflow-hidden select-text ${className}`}>
      {/* 1. BARRE D'OUTILS AUTHENTIQUE WORD AVEC BOUTONS ENREGISTRER & ABANDONNER */}
      <div className="w-full px-2 sm:px-4 py-1 sm:py-2 bg-white dark:bg-[#0e1424] border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 shadow-xs z-10">
        {/* Masqué sur mobile pour gagner de la place (déjà affiché dans la barre supérieure) */}
        <div className="hidden sm:flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate max-w-[160px] sm:max-w-xs md:max-w-md" title={fileName}>
                {fileName}
              </h4>
              {isDirty && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Modifié</span>
                </span>
              )}
              {saveSuccess && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Enregistré !</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400">
              <span className="uppercase font-semibold text-blue-600 dark:text-blue-400">DOCX Word Authentique</span>
              {fileSize && <span>• {fileSize}</span>}
              <span>• Cliquez pour modifier le texte ou les tableaux</span>
            </div>
          </div>
        </div>

        {/* Indicateur d'état compact sur mobile si modifié ou enregistré */}
        <div className="sm:hidden flex items-center gap-1 min-w-0">
          {isDirty && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Modifié</span>
            </span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Enregistré !</span>
            </span>
          )}
        </div>

        {/* Contrôles et actions à droite */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {/* BOUTON ABANDONNER (visible uniquement si modifié) */}
          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Annuler les modifications et rétablir le document d'origine"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Abandonner</span>
            </button>
          )}

          {/* BOUTON ENREGISTRER (vert vif quand modifié) */}
          {isDirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 sm:px-3.5 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
              title="Enregistrer les modifications dans le fichier Word"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(60, prev - 15))}
              className="p-0.5 hover:text-blue-500 cursor-pointer text-stone-600 dark:text-stone-300"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] sm:text-[11px] px-0.5 sm:px-1 font-bold">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
              className="p-0.5 hover:text-blue-500 cursor-pointer text-stone-600 dark:text-stone-300"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copier tout le texte */}
          <button
            type="button"
            onClick={copyAllText}
            className="px-2 sm:px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border border-stone-200 dark:border-stone-700 transition-colors"
            title="Copier tout le texte"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isCopied ? 'Copié' : 'Copier'}</span>
          </button>
        </div>
      </div>

      {/* 2. ZONE DE CONTENU : PAGE A4 AUTHENTIQUE (IMAGE 3) AVEC DÉFILEMENT FLUIDE */}
      <div 
        className="flex-1 w-full h-full min-h-0 overflow-y-auto overflow-x-auto relative flex flex-col items-center p-3 sm:p-6 md:p-8 overscroll-contain"
        style={{ overscrollBehavior: 'contain', touchAction: 'pan-x pan-y' }}
      >
        {/* Style CSS injecté pour garantir le rendu exact au pixel près de l'image 3 sur ordinateur et téléphone */}
        <style>{`
          .sc-docx-wrapper {
            background: transparent !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .sc-docx-wrapper > section.sc-docx {
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: 0 4px 25px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
            margin-bottom: 30px !important;
            border-radius: 4px !important;
            box-sizing: border-box !important;
            max-width: 860px !important;
            min-height: 1100px !important;
            width: 100% !important;
            outline: none !important;
            position: relative !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }
          .sc-docx table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 14px 0 !important;
            box-sizing: border-box !important;
          }
          .sc-docx td, .sc-docx th {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 10px !important;
            vertical-align: middle !important;
            min-height: 24px !important;
            font-size: 11px !important;
            box-sizing: border-box !important;
          }
          .sc-docx th {
            background-color: #f8fafc !important;
            font-weight: 700 !important;
            color: #0f172a !important;
          }
          .sc-docx tr:hover td {
            background-color: rgba(241, 245, 249, 0.5) !important;
          }
          .sc-docx p {
            margin: 4px 0 !important;
            line-height: 1.45 !important;
          }
          /* Curseur de saisie propre lors de l'édition */
          .sc-docx-wrapper[contenteditable="true"] p:hover,
          .sc-docx-wrapper[contenteditable="true"] td:hover {
            cursor: text !important;
          }
          .sc-docx-wrapper[contenteditable="true"] td:focus,
          .sc-docx-wrapper[contenteditable="true"] p:focus {
            outline: 1.5px solid #3b82f6 !important;
            outline-offset: 1px !important;
            background-color: rgba(59, 130, 246, 0.04) !important;
            border-radius: 2px !important;
          }

          /* Adaptation mobile fluide (< 768px) */
          @media (max-width: 768px) {
            .sc-docx-wrapper > section.sc-docx {
              padding: 16px 14px !important;
              margin-bottom: 16px !important;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08) !important;
              border-radius: 2px !important;
              min-height: auto !important;
              max-width: 100% !important;
              width: 100% !important;
            }
            .sc-docx table {
              display: block !important;
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            .sc-docx td, .sc-docx th {
              padding: 5px 8px !important;
              font-size: 10px !important;
              white-space: nowrap !important;
            }
          }
        `}</style>

        {isLoading && (
          <div className="m-auto flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
              Formatage du document Word authentique...
            </p>
          </div>
        )}

        {renderError && !isLoading && (
          <div className="m-auto flex flex-col items-center justify-center p-6 text-center max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h5 className="text-sm font-bold text-stone-900 dark:text-white mb-1">Affichage difficile</h5>
            <p className="text-xs text-stone-500 mb-4">{renderError}</p>
            <button
              type="button"
              onClick={() => renderDocx(currentBuffer)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        )}

        {/* CONTENEUR DE RENDU DOCX-PREVIEW */}
        <div
          ref={containerRef}
          onInput={handleInput}
          className="w-full flex flex-col items-center"
          style={{
            zoom: `${zoomLevel}%`,
            display: isLoading || renderError ? 'none' : 'flex',
          }}
        />
      </div>
    </div>
  );
};
