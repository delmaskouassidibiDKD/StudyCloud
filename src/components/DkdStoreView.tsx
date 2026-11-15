import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Maximize2, 
  Minimize2, 
  X 
} from 'lucide-react';
import { DkdStore3DIcon } from './DkdStore3DIcon';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../utils/viewerExpandManager';

interface DkdStoreViewProps {
  onBack: () => void;
}

export const DkdStoreView: React.FC<DkdStoreViewProps> = ({ onBack }) => {
  // Champ de recherche conservé
  const [searchQuery, setSearchQuery] = useState('');

  // Gestion du super agrandissement progressif et zoom
  const viewerExpandLevel = useViewerExpandLevel();

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      resetViewerExpand();
    };
  }, []);

  // Gestion de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewerExpandLevel >= 1) {
          resetViewerExpand();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerExpandLevel]);

  return (
    <div
      className={`w-full flex-1 flex flex-col bg-white dark:bg-[#070b14] text-stone-900 dark:text-[#f1f5f9] transition-colors duration-300 overflow-hidden ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : viewerExpandLevel === 1
            ? 'relative w-full h-dvh min-h-dvh'
            : 'relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'
      }`}
    >
      {/* 1. BARRE SUPÉRIEURE (Une seule ligne sur Mobile et PC) */}
      <div className="w-full h-11 sm:h-12 flex items-center justify-between px-2.5 sm:px-4 bg-white/95 dark:bg-[#0d1424] border-b border-stone-200 dark:border-white/10 shrink-0 z-30 shadow-xs select-none backdrop-blur-md">
        {/* Partie gauche : Bouton retour + Titre DKD store aux couleurs Google */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/90 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl border border-stone-300 dark:border-stone-700/80 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="leading-none">Retour</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800/80 shadow-2xs shrink-0">
            <DkdStore3DIcon className="w-5 h-5 shrink-0" />
            {/* Nom avec les 4 couleurs Play Store / Google : Bleu, Rouge, Jaune, Vert */}
            <span className="text-xs sm:text-sm font-black tracking-tight whitespace-nowrap">
              <span className="text-[#4285F4]">D</span>
              <span className="text-[#EA4335]">K</span>
              <span className="text-[#FBBC05]">D</span>{' '}
              <span className="text-[#34A853]">s</span>
              <span className="text-[#4285F4]">t</span>
              <span className="text-[#EA4335]">o</span>
              <span className="text-[#FBBC05]">r</span>
              <span className="text-[#34A853]">e</span>
            </span>
          </div>
        </div>

        {/* Partie droite : Boutons Agrandir / Zoom */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bouton Super Agrandissement Progressif (Desktop uniquement) */}
          <ViewerSuperExpandButton
            expandLevel={viewerExpandLevel}
            onExpandChange={(lvl) => {
              if (viewerExpandLevel >= 2) {
                setViewerExpandLevel(1);
              } else {
                setViewerExpandLevel(2);
              }
            }}
          />

          {/* Bouton Zoom 2 flèches opposées */}
          <button
            type="button"
            onClick={() => {
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobile) {
                if (viewerExpandLevel >= 1) {
                  resetViewerExpand();
                } else {
                  setViewerExpandLevel(2);
                }
              } else {
                if (viewerExpandLevel === 1) {
                  resetViewerExpand();
                } else {
                  setViewerExpandLevel(1);
                }
              }
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${
              viewerExpandLevel >= 1
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/40'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-black/60 dark:hover:bg-blue-600/80 dark:text-white dark:border-white/10'
            }`}
            title={
              viewerExpandLevel >= 1
                ? "Réduire"
                : (typeof window !== 'undefined' && window.innerWidth < 768 ? "Plein écran" : "Agrandir l'espace central")
            }
          >
            {viewerExpandLevel >= 1 ? (
              <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
          </button>
        </div>
      </div>

      {/* 2. CONTENU PRINCIPAL DU DKD STORE */}
      <div className="flex-1 w-full overflow-y-auto px-4 sm:px-6 md:px-8 py-6 sm:py-10 relative min-h-0 flex flex-col items-center">
        {/* CHAMP DE RECHERCHE DU STORE (Seul élément conservé selon la vision) */}
        <div className="w-full relative max-w-2xl mx-auto">
          <div className="relative flex items-center w-full bg-stone-50 hover:bg-stone-100/90 focus-within:bg-white dark:bg-[#111a2f] dark:hover:bg-[#14203b] dark:focus-within:bg-[#14203b] border-2 border-stone-200 dark:border-stone-700/80 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-2xl shadow-xs dark:shadow-xl transition-all overflow-hidden p-1.5 sm:p-2">
            <Search className="w-5 h-5 text-blue-500 dark:text-blue-400 ml-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une pépite, un simulateur, un cours..."
              className="w-full bg-transparent border-0 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm sm:text-base focus:outline-hidden font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
                title="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
