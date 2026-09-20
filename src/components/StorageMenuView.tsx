import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface StorageMenuViewProps {
  onBack: () => void;
}

export const StorageMenuView: React.FC<StorageMenuViewProps> = ({ onBack }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#C5B0A4] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 pb-8 pt-0 overflow-y-auto transition-colors duration-300">
      {/* Barre d'en-tête supérieure avec bouton Retour et Titre - Identique à Mes fichiers / Mes dossiers */}
      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-start justify-between z-40 pointer-events-none gap-2">
        <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
            <span>Retour</span>
          </button>
        </div>

        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-900 bg-amber-400 dark:bg-amber-500 px-3 py-1 rounded-lg border-2 border-stone-800 dark:border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] self-start">
          Mon stockage
        </h1>

        {/* Espaceur pour garder le titre centré comme dans les autres menus */}
        <div className="w-16 pointer-events-none" />
      </div>

      {/* Contenu du menu : totalement vide pour l'instant comme demandé */}
      <div className="pt-24 min-h-[60vh] flex flex-col items-center justify-center">
        {/* Prêt pour accueillir l'affichage de la jauge et les détails de stockage */}
      </div>
    </div>
  );
};
