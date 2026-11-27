import React, { useRef, useState } from 'react';
import { Download, ChevronDown, Copy, Check, Loader2 } from 'lucide-react';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import {
  copyGradebookToClipboard,
  exportGradebookToPdf,
  exportGradebookToWord,
  type GradebookExportDataset,
} from '../../utils/gradebookExportUtils';

export interface GradebookDownloadMenuProps {
  /** Construit à la volée le dataset courant du tableau pour PDF / Word / Copier */
  getDataset: () => GradebookExportDataset;
  /** Exécute l'export Excel (.xlsx) natif existant du tableau */
  onExportExcel: () => void;
  /** Optionnel : classes supplémentaires sur le bouton déclencheur */
  className?: string;
}

/** Logo PDF authentique (feuille à coin plié + cartouche rouge encadré "PDF" comme sur l'image 2) */
const PdfLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    {/* Feuille contour blanc/sombre à coin plié */}
    <path
      d="M7 3.5H19.5L25 9V28.5H7V3.5Z"
      className="fill-white dark:fill-slate-900 stroke-slate-700 dark:stroke-slate-200"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M19.5 3.5V9H25"
      className="stroke-slate-700 dark:stroke-slate-200"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Cartouche rouge PDF en travers */}
    <rect
      x="3.2"
      y="13.2"
      width="25.6"
      height="10.2"
      rx="1.6"
      className="fill-red-600/12 dark:fill-red-950/90 stroke-red-600 dark:stroke-red-500"
      strokeWidth="1.65"
    />
    <text
      x="16"
      y="20.7"
      textAnchor="middle"
      fontSize="7.6"
      fontWeight="800"
      fontFamily="Arial, Helvetica, sans-serif"
      letterSpacing="0.4"
      className="fill-red-600 dark:fill-red-100"
    >
      PDF
    </text>
  </svg>
);

/** Logo Word 365 authentique (feuille à bandes bleues dégradées + pastille carrée bleue "W" comme sur l'image 2) */
const WordLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="scWordCardBg" x1="10" y1="3" x2="27" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E2E8F0" />
      </linearGradient>
      <linearGradient id="scWordBandTop" x1="13" y1="7" x2="24" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#41A5EE" />
        <stop offset="100%" stopColor="#2B7CD3" />
      </linearGradient>
      <linearGradient id="scWordBandMid" x1="13" y1="12" x2="24" y2="18" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2B7CD3" />
        <stop offset="100%" stopColor="#185ABD" />
      </linearGradient>
      <linearGradient id="scWordBandBot" x1="13" y1="18" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#185ABD" />
        <stop offset="100%" stopColor="#103F91" />
      </linearGradient>
      <linearGradient id="scWordBadge" x1="3" y1="14" x2="17" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#103F91" />
      </linearGradient>
    </defs>
    {/* Page arrondie blanche */}
    <rect x="9.5" y="3" width="18" height="23.5" rx="3.5" fill="url(#scWordCardBg)" stroke="#CBD5E1" strokeWidth="1" />
    {/* 3 bandes bleues modernes */}
    <path d="M13 8.2C13 7.1 13.9 6.2 15 6.2H22.2C23.3 6.2 24.2 7.1 24.2 8.2V12.2H13V8.2Z" fill="url(#scWordBandTop)" />
    <rect x="13" y="12.2" width="11.2" height="5.5" fill="url(#scWordBandMid)" />
    <path d="M13 17.7H24.2V21.4C24.2 22.5 23.3 23.4 22.2 23.4H15C13.9 23.4 13 22.5 13 21.4V17.7Z" fill="url(#scWordBandBot)" />
    {/* Pastille W en bas à gauche */}
    <rect x="3" y="14.2" width="14.2" height="14.2" rx="3.5" fill="url(#scWordBadge)" stroke="#FFFFFF" strokeWidth="1.2" />
    <text
      x="10.1"
      y="24.5"
      textAnchor="middle"
      fontSize="9.8"
      fontWeight="900"
      fontFamily="Arial, Helvetica, sans-serif"
      fill="#FFFFFF"
    >
      W
    </text>
  </svg>
);

/** Logo Excel 365 authentique (tuiles vertes superposées + pastille carrée vert foncé "X" comme sur l'image 3) */
const ExcelLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="scExcelBase" x1="8" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#33C481" />
        <stop offset="55%" stopColor="#1E8E5A" />
        <stop offset="100%" stopColor="#14643D" />
      </linearGradient>
      <linearGradient id="scExcelTopRight" x1="17" y1="3.5" x2="28" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7CE88B" />
        <stop offset="100%" stopColor="#4BD172" />
      </linearGradient>
      <linearGradient id="scExcelBadge" x1="3" y1="14" x2="17" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#21A366" />
        <stop offset="100%" stopColor="#0E5C36" />
      </linearGradient>
    </defs>
    {/* Tuile principale verte */}
    <rect x="8.5" y="4" width="19.5" height="23.5" rx="4.5" fill="url(#scExcelBase)" />
    {/* Tuile vert clair en haut à droite */}
    <rect x="17.5" y="4" width="10.5" height="10.5" rx="3.5" fill="url(#scExcelTopRight)" />
    {/* Tuile vert moyen en bas à droite */}
    <path d="M17.5 14.5H28V23C28 25.5 26 27.5 23.5 27.5H17.5V14.5Z" fill="#107C41" fillOpacity="0.65" />
    {/* Pastille X en bas à gauche */}
    <rect x="3" y="14.2" width="14.2" height="14.2" rx="3.5" fill="url(#scExcelBadge)" stroke="#FFFFFF" strokeWidth="1.2" />
    <text
      x="10.1"
      y="24.5"
      textAnchor="middle"
      fontSize="10"
      fontWeight="900"
      fontFamily="Arial, Helvetica, sans-serif"
      fill="#FFFFFF"
    >
      X
    </text>
  </svg>
);

export const GradebookDownloadMenu: React.FC<GradebookDownloadMenuProps> = ({
  getDataset,
  onExportExcel,
  className = '',
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState<'pdf' | 'word' | 'excel' | 'copy' | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const handleDownloadPdf = async () => {
    if (busyFormat) return;
    setBusyFormat('pdf');
    try {
      const ds = getDataset();
      await exportGradebookToPdf(ds);
      setOpen(false);
    } catch (err) {
      console.error('Erreur export PDF:', err);
    } finally {
      setBusyFormat(null);
    }
  };

  const handleDownloadWord = async () => {
    if (busyFormat) return;
    setBusyFormat('word');
    try {
      const ds = getDataset();
      await exportGradebookToWord(ds);
      setOpen(false);
    } catch (err) {
      console.error('Erreur export Word:', err);
    } finally {
      setBusyFormat(null);
    }
  };

  const handleDownloadExcel = () => {
    if (busyFormat) return;
    setBusyFormat('excel');
    try {
      onExportExcel();
      setOpen(false);
    } catch (err) {
      console.error('Erreur export Excel:', err);
    } finally {
      setBusyFormat(null);
    }
  };

  const handleCopyTable = async () => {
    if (busyFormat) return;
    setBusyFormat('copy');
    try {
      const ds = getDataset();
      const ok = await copyGradebookToClipboard(ds);
      if (ok) {
        setCopiedFeedback(true);
        setTimeout(() => {
          setCopiedFeedback(false);
          setOpen(false);
        }, 900);
      }
    } catch (err) {
      console.error('Erreur copie tableau:', err);
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 h-7 sm:h-auto sm:py-1 text-[11px] font-bold rounded-lg border transition shadow-2xs cursor-pointer active:scale-95 ${
          open
            ? 'text-blue-900 bg-blue-100 border-blue-400 dark:text-blue-100 dark:bg-blue-900/70 dark:border-blue-500'
            : 'text-slate-800 bg-white hover:bg-blue-50 hover:text-blue-800 border-slate-300 hover:border-blue-300 dark:text-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600'
        } ${className}`}
        title="Télécharger ou copier ce tableau (PDF, Word, Excel, Copier)"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 stroke-[2.4]" />
        <span className="hidden sm:inline">Télécharger</span>
        <ChevronDown
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 dark:text-slate-400 transition-transform duration-150 ${
            open ? 'rotate-180 text-blue-600 dark:text-blue-300' : ''
          }`}
        />
      </button>

      <SmartFloatingPopover
        open={open}
        anchorEl={triggerRef.current}
        preferredSide={typeof window !== 'undefined' && window.innerWidth < 640 ? 'bottom' : 'left'}
        preferredAlign={typeof window !== 'undefined' && window.innerWidth < 640 ? 'end' : 'start'}
        gap={8}
        padding={12}
        showCaret={true}
        onClose={() => setOpen(false)}
        dataPopoverId="gradebook-download-menu"
        className="w-[215px] rounded-2xl bg-white dark:bg-[#161b26] border border-slate-200/90 dark:border-slate-700/90 shadow-2xl p-2 select-none"
      >
        <div className="px-2.5 pt-1 pb-2 mb-1 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Télécharger en :
          </span>
        </div>

        <div className="flex flex-col gap-1" role="menu">
          {/* PDF */}
          <button
            type="button"
            role="menuitem"
            disabled={busyFormat !== null}
            onClick={handleDownloadPdf}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-[13px] font-bold text-slate-800 dark:text-slate-100 hover:bg-red-50/90 dark:hover:bg-red-950/35 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer disabled:opacity-60 active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <span>Pdf</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 leading-tight">
                Document .pdf
              </span>
            </div>
            {busyFormat === 'pdf' ? (
              <Loader2 className="w-5 h-5 animate-spin text-red-500 shrink-0" />
            ) : (
              <PdfLogoIcon className="w-6 h-6 shrink-0" />
            )}
          </button>

          {/* Word */}
          <button
            type="button"
            role="menuitem"
            disabled={busyFormat !== null}
            onClick={handleDownloadWord}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-[13px] font-bold text-slate-800 dark:text-slate-100 hover:bg-blue-50/90 dark:hover:bg-blue-950/35 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer disabled:opacity-60 active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <span>Word</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 leading-tight">
                Document .docx
              </span>
            </div>
            {busyFormat === 'word' ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 shrink-0" />
            ) : (
              <WordLogoIcon className="w-6 h-6 shrink-0" />
            )}
          </button>

          {/* Excel */}
          <button
            type="button"
            role="menuitem"
            disabled={busyFormat !== null}
            onClick={handleDownloadExcel}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-[13px] font-bold text-slate-800 dark:text-slate-100 hover:bg-emerald-50/90 dark:hover:bg-emerald-950/35 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-60 active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <span>Excel</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 leading-tight">
                Classeur .xlsx
              </span>
            </div>
            {busyFormat === 'excel' ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500 shrink-0" />
            ) : (
              <ExcelLogoIcon className="w-6 h-6 shrink-0" />
            )}
          </button>

          <div className="my-0.5 border-t border-slate-200/80 dark:border-slate-700/70" />

          {/* Copier */}
          <button
            type="button"
            role="menuitem"
            disabled={busyFormat !== null}
            onClick={handleCopyTable}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-[13px] font-bold transition-colors cursor-pointer disabled:opacity-60 active:scale-[0.98] ${
              copiedFeedback
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex flex-col">
              <span>{copiedFeedback ? 'Copié !' : 'Copier'}</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 leading-tight">
                {copiedFeedback ? 'Prêt à coller' : 'Tableau complet'}
              </span>
            </div>
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                copiedFeedback
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
              }`}
            >
              {copiedFeedback ? (
                <Check className="w-4 h-4 stroke-[2.6]" />
              ) : (
                <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
              )}
            </div>
          </button>
        </div>
      </SmartFloatingPopover>
    </>
  );
};
