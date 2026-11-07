import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Star, Share2, Download, BookOpen, X } from 'lucide-react';
import { computeSmartMenuStyle, useSmartContextMenuClose } from '../hooks/useContextMenuPosition';

export interface ViewerHeaderActionsMenuProps {
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onShare?: () => void;
  onDownload?: () => void;
  onOpenStudySpace?: () => void;
  studySpaceTitle?: string;
  className?: string;
  children?: ((close: () => void) => React.ReactNode) | React.ReactNode;
}

export const ViewerHeaderActionsMenu: React.FC<ViewerHeaderActionsMenuProps> = ({
  onToggleFavorite,
  isFavorite = false,
  onShare,
  onDownload,
  onOpenStudySpace,
  studySpaceTitle = "Ouvrir dans le Menu de création",
  className = '',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useSmartContextMenuClose(isOpen, () => setIsOpen(false));

  const hasAnyAction = Boolean(onToggleFavorite || onShare || onDownload || onOpenStudySpace || children);
  if (!hasAnyAction) return null;

  return (
    <div className={`relative inline-flex items-center shrink-0 ${className}`}>
      {/* Bouton 3 traits déclencheur */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`studycloud-menu-trigger w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
          isOpen
            ? 'bg-amber-500/25 text-amber-400 border-amber-400 ring-2 ring-amber-400/40'
            : isFavorite
              ? 'bg-black/60 hover:bg-slate-800 text-amber-400 border-amber-400/50'
              : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
        }`}
        title="Options du fichier (3 traits)"
        aria-label="Options du fichier"
      >
        <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
      </button>

      {/* Menu contextuel portal */}
      {isOpen && (() => {
        const rect = buttonRef.current ? buttonRef.current.getBoundingClientRect() : null;
        const smartStyle = computeSmartMenuStyle(rect, 240, 220);

        return createPortal(
          <div
            className="studycloud-file-menu-panel bg-white dark:bg-[#0D1424] text-stone-800 dark:text-stone-100 rounded-xl shadow-2xl border-2 border-stone-800 dark:border-slate-700 py-1.5 w-52 text-xs font-semibold animate-fadeIn flex flex-col z-[99999]"
            style={smartStyle.style}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête du petit menu */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-200 dark:border-slate-700/80 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-bold">Options</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-0.5 hover:bg-stone-200 dark:hover:bg-slate-800 rounded-md text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer transition-colors"
                title="Fermer le menu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1. Favoris */}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => {
                  onToggleFavorite();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-stone-100 dark:hover:bg-slate-800/80 flex items-center gap-2.5 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-stone-400 dark:text-stone-400'}`} />
                <span>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
              </button>
            )}

            {/* 2. Partager */}
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onShare();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-stone-100 dark:hover:bg-slate-800/80 flex items-center gap-2.5 text-stone-700 dark:text-stone-200 transition-colors border-t border-stone-100 dark:border-slate-800 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span>Partager</span>
              </button>
            )}

            {/* 3. Télécharger */}
            {onDownload && (
              <button
                type="button"
                onClick={() => {
                  onDownload();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-stone-100 dark:hover:bg-slate-800/80 flex items-center gap-2.5 text-stone-700 dark:text-stone-200 transition-colors border-t border-stone-100 dark:border-slate-800 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Télécharger</span>
              </button>
            )}

            {/* 4. Menu de création / Espace d'étude */}
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => {
                  onOpenStudySpace();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5 transition-colors border-t border-stone-100 dark:border-slate-800 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{studySpaceTitle}</span>
              </button>
            )}

            {/* Options additionnelles personnalisées */}
            {typeof children === 'function' ? children(() => setIsOpen(false)) : children}
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

