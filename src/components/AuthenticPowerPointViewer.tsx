import React, { useState, useEffect, useRef } from 'react';
import {
  Presentation,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import JSZip from 'jszip';
import { storeFileBlob, formatFileSize } from '../services/localFileStorage';
import { CloudDataStore } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';

export interface PptxSlideData {
  slideNumber: number;
  slideFileName: string;
  texts: string[];
}

interface AuthenticPowerPointViewerProps {
  fileId?: string;
  fileName?: string;
  fileSize?: string | number;
  arrayBuffer: ArrayBuffer;
  initialSlides: PptxSlideData[];
  onSaved?: (newBlob: Blob) => void;
  className?: string;
}

export const AuthenticPowerPointViewer: React.FC<AuthenticPowerPointViewerProps> = ({
  fileId,
  fileName = 'Présentation.pptx',
  fileSize,
  arrayBuffer,
  initialSlides,
  onSaved,
  className = '',
}) => {
  const [slides, setSlides] = useState<PptxSlideData[]>(initialSlides);
  const originalSlidesRef = useRef<PptxSlideData[]>(initialSlides);
  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const activeSlide = slides[currentSlideIdx] || slides[0];

  const handleTextChange = (textIdx: number, newText: string) => {
    setSlides(prev => {
      const copy = prev.map(s => ({ ...s, texts: [...s.texts] }));
      if (copy[currentSlideIdx] && copy[currentSlideIdx].texts[textIdx] !== undefined) {
        copy[currentSlideIdx].texts[textIdx] = newText;
      }
      return copy;
    });
    if (!isDirty) {
      setIsDirty(true);
      setSaveSuccess(false);
    }
  };

  const handleDiscard = () => {
    setSlides(JSON.parse(JSON.stringify(originalSlidesRef.current)));
    setIsDirty(false);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      for (const slide of slides) {
        if (zip.files[slide.slideFileName]) {
          let xmlStr = await zip.files[slide.slideFileName].async('string');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
          const tNodes = Array.from(xmlDoc.getElementsByTagNameNS('*', 't'));

          for (let i = 0; i < slide.texts.length && i < tNodes.length; i++) {
            tNodes[i].textContent = slide.texts[i];
          }

          const serializer = new XMLSerializer();
          zip.file(slide.slideFileName, serializer.serializeToString(xmlDoc));
        }
      }

      const updatedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

      originalSlidesRef.current = JSON.parse(JSON.stringify(slides));

      if (fileId) {
        await storeFileBlob(fileId, updatedBlob);
        CloudDataStore.updateFile(fileId, {
          size: formatFileSize(updatedBlob.size),
          sizeBytes: updatedBlob.size,
          timestamp: Date.now(),
        });
        CloudStorageAPI.uploadFile(updatedBlob, 'documents', fileName, undefined, undefined, undefined, updatedBlob.size, undefined, fileId).catch(() => {});
      }

      onSaved?.(updatedBlob);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('[AuthenticPowerPointViewer] Erreur sauvegarde PPTX:', err);
      alert("Erreur lors de l'enregistrement de la présentation : " + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`w-full h-full min-h-0 flex flex-col bg-stone-100 dark:bg-[#070b14] text-stone-900 dark:text-stone-100 overflow-hidden select-text ${className}`}>
      {/* 1. EN-TÊTE ET ACTIONS */}
      <div className="w-full px-2 sm:px-4 py-1 sm:py-2 bg-white dark:bg-[#0e1424] border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 shadow-xs z-10">
        {/* Masqué sur mobile pour libérer l'espace d'affichage */}
        <div className="hidden sm:flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Presentation className="w-4 h-4" />
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
              <span className="uppercase font-semibold text-orange-600 dark:text-orange-400">PowerPoint PPTX Authentique</span>
              {fileSize && <span>• {fileSize}</span>}
              <span>• Diapositive {currentSlideIdx + 1} / {slides.length}</span>
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

        {/* Contrôles droits */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Annuler les modifications"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Abandonner</span>
            </button>
          )}

          {isDirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 sm:px-3.5 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
              title="Enregistrer la présentation"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          )}

          {/* Navigation diapositive */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-xs">
            <button
              type="button"
              disabled={currentSlideIdx <= 0}
              onClick={() => setCurrentSlideIdx(prev => Math.max(0, prev - 1))}
              className="p-0.5 hover:text-orange-500 disabled:opacity-30 cursor-pointer text-stone-600 dark:text-stone-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] sm:text-[11px] px-0.5 sm:px-1 font-bold">
              {currentSlideIdx + 1} / {slides.length}
            </span>
            <button
              type="button"
              disabled={currentSlideIdx >= slides.length - 1}
              onClick={() => setCurrentSlideIdx(prev => Math.min(slides.length - 1, prev + 1))}
              className="p-0.5 hover:text-orange-500 disabled:opacity-30 cursor-pointer text-stone-600 dark:text-stone-300"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ZONE DIAPOSITIVE AUTHENTIQUE 16:9 AVEC TEXTE ÉDITABLE */}
      <div 
        className="flex-1 w-full h-full min-h-0 overflow-auto p-4 sm:p-8 flex items-center justify-center overscroll-contain"
        style={{ overscrollBehavior: 'contain', touchAction: 'pan-x pan-y' }}
      >
        {activeSlide ? (
          <div
            style={{ zoom: `${zoomLevel}%` }}
            className="w-full max-w-4xl aspect-video bg-white text-stone-900 rounded-xl shadow-2xl border border-stone-200 p-8 sm:p-14 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-orange-100 pb-3 mb-6 select-none">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                Diapositive {activeSlide.slideNumber} sur {slides.length}
              </span>
              <span className="text-[10px] text-stone-400 font-medium">Cliquez pour modifier les textes</span>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar">
              {activeSlide.texts.map((txt, idx) => (
                <div
                  key={idx}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.innerText;
                    if (val !== txt) {
                      handleTextChange(idx, val);
                    }
                  }}
                  className={`p-2 rounded-lg border border-transparent hover:border-orange-200 focus:border-orange-500 focus:bg-orange-50/20 outline-none transition-colors ${
                    idx === 0
                      ? 'text-xl sm:text-2xl font-black text-stone-900 border-b-2 border-orange-400/30'
                      : 'text-sm sm:text-base text-stone-700 leading-relaxed'
                  }`}
                >
                  {txt}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-stone-100 text-[10px] text-stone-400 flex items-center justify-between select-none">
              <span>StudyCloud Presentation Engine</span>
              <span>Diapositive {activeSlide.slideNumber}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-stone-400">Aucune diapositive disponible.</div>
        )}
      </div>
    </div>
  );
};
