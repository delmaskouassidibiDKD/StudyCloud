import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

export interface IncompatibleAlertInfo {
  fileName: string;
  detectedCategory: string;
  menuLabel: string;
  dedicatedMenu?: string;
  reason?: string;
}

interface IncompatibleFormatModalProps {
  info: IncompatibleAlertInfo | null;
  onClose: () => void;
}

export const IncompatibleFormatModal: React.FC<IncompatibleFormatModalProps> = ({ info, onClose }) => {
  if (!info || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 pointer-events-auto select-none"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-[#0A0E1A] border-2 border-red-500/70 rounded-3xl p-6 sm:p-7 shadow-[0_25px_80px_rgba(239,68,68,0.45),0_0_0_1px_rgba(255,255,255,0.1)] text-white text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton croix en haut à droite */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Grande Icône d'alerte rouge lumineuse */}
        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.5)] mt-1 animate-pulse">
          <AlertCircle className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.6]" />
        </div>

        {/* Titre */}
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Téléchargement impossible
          </h3>
          <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest">
            FORMAT NON COMPATIBLE AVEC CE MENU
          </p>
        </div>

        {/* Message Principal textuel explicite demandé par l'utilisateur */}
        <div className="w-full p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-xs sm:text-sm font-extrabold text-red-200 leading-snug">
          Ce fichier n'a pas pu être téléchargé car il n'est pas compatible avec ce menu !
        </div>

        {/* Détails du fichier et du menu */}
        <div className="w-full text-xs text-slate-300 font-medium bg-black/50 rounded-2xl p-3.5 border border-white/10 space-y-2 text-left">
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400 shrink-0">Fichier :</span>
            <span className="font-bold text-white truncate max-w-[220px]" title={info.fileName}>
              {info.fileName}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 shrink-0">Type détecté :</span>
            <span className="font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-400/30">
              {info.detectedCategory}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 shrink-0">Menu dédié :</span>
            <span className="font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-md border border-purple-400/30">
              {info.dedicatedMenu || info.menuLabel}
            </span>
          </div>
        </div>

        {/* Explication et astuce */}
        <p className="text-[11px] text-slate-400 leading-relaxed text-center px-1">
          {info.reason || (
            <>
              Le menu <strong className="text-white">{info.menuLabel}</strong> n'accepte que des fichiers {info.menuLabel.toLowerCase()}. Pour classer automatiquement vos fichiers sans restriction, utilisez le bouton <strong className="text-blue-400">+ Importer</strong> sur la page d'accueil.
            </>
          )}
        </p>

        {/* Bouton de confirmation en bas */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs sm:text-sm tracking-wider shadow-lg shadow-red-950/70 transition-all active:scale-95 cursor-pointer uppercase mt-1"
        >
          COMPRIS, FERMER
        </button>
      </div>
    </div>,
    document.body
  );
};
