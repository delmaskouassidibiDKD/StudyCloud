import React from 'react';
import { ChevronsUp, Maximize, Minimize2 } from 'lucide-react';
import { ViewerExpandLevel } from '../utils/viewerExpandManager';

interface ViewerSuperExpandButtonProps {
  expandLevel: ViewerExpandLevel;
  onExpandChange: (newLevel: 1 | 2 | 3) => void;
  className?: string;
}

export const ViewerSuperExpandButton: React.FC<ViewerSuperExpandButtonProps> = ({
  expandLevel,
  onExpandChange,
  className = '',
}) => {
  // Le niveau actif doit être au moins 1 lorsqu'on affiche ce bouton
  const activeLevel = expandLevel >= 1 ? expandLevel : 1;

  const handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeLevel === 1) {
      // Étape 1 : Masquer la barre du haut
      onExpandChange(2);
    } else if (activeLevel === 2) {
      // Étape 2 : Masquer le menu latéral gauche (Plein écran total)
      onExpandChange(3);
    } else {
      // Revenir à l'agrandissement initial
      onExpandChange(1);
    }
  };

  const getTooltip = () => {
    if (activeLevel === 1) {
      return "Agrandir encore (1/2 : Masquer les boutons du haut)";
    }
    if (activeLevel === 2) {
      return "Agrandir encore (2/2 : Masquer la barre latérale gauche - Plein écran total)";
    }
    return "Réduire le plein écran (Rétablir les barres masquées)";
  };

  return (
    <button
      type="button"
      onClick={handleNextStep}
      className={`hidden md:flex h-7 sm:h-8 px-2 sm:px-2.5 rounded-full items-center gap-1.5 border transition-all cursor-pointer shadow-md active:scale-95 animate-in fade-in zoom-in-95 duration-200 select-none ${
        activeLevel === 3
          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/80 shadow-emerald-500/20 ring-2 ring-emerald-400/30'
          : activeLevel === 2
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/80 shadow-blue-500/20 ring-1 ring-blue-400/30'
          : 'bg-[#101827] hover:bg-[#1a2538] text-cyan-300 border-cyan-500/50 hover:border-cyan-400 shadow-cyan-950/40'
      } ${className}`}
      title={getTooltip()}
    >
      {activeLevel === 3 ? (
        <Minimize2 className="w-3.5 h-3.5 stroke-[2.4] text-white" />
      ) : activeLevel === 2 ? (
        <Maximize className="w-3.5 h-3.5 stroke-[2.4] text-white" />
      ) : (
        <ChevronsUp className="w-3.5 h-3.5 stroke-[2.4] text-cyan-400" />
      )}

      {/* Indicateur visuel à 2 points (point point) pour marquer les 2 étapes d'agrandissement supplémentaires */}
      <div className="flex items-center gap-1 shrink-0" title={`Étape ${activeLevel - 1} / 2`}>
        {/* Point 1 : Masquer la barre du haut */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            activeLevel >= 2
              ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] scale-110'
              : 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.9)] animate-pulse'
          }`}
        />
        {/* Point 2 : Masquer la barre latérale gauche */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            activeLevel === 3
              ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] scale-110'
              : activeLevel === 2
              ? 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.9)] animate-pulse'
              : 'bg-white/25'
          }`}
        />
      </div>

      <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-none hidden xs:inline">
        {activeLevel === 1 ? 'Agrandir +' : activeLevel === 2 ? 'Plein écran' : 'Réduire'}
      </span>
    </button>
  );
};

