import React from 'react';
import { Square, Minimize2 } from 'lucide-react';
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
  // Ce bouton est STRICTEMENT réservé à la version ordinateur (desktop)
  // Sur mobile, le super-agrandissement est totalement retiré.
  const activeLevel = expandLevel;
  const isLevel2OrMore = activeLevel >= 2;

  const handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLevel2OrMore) {
      // Revenir à l'étape 1 (réafficher la barre latérale gauche comme sur Image 2)
      onExpandChange(1);
    } else if (activeLevel === 1) {
      // Étape 2 : Masquer la barre latérale gauche pour faire place au PDF seulement
      onExpandChange(2);
    } else {
      // Étape 1 : Agrandissement standard (masquer la liste des fichiers comme Image 2)
      onExpandChange(1);
    }
  };

  const getTooltip = () => {
    if (isLevel2OrMore) {
      return "Réduire (réafficher la barre latérale gauche)";
    }
    if (activeLevel === 1) {
      return "Plein écran total (masquer la barre latérale gauche pour faire place au PDF)";
    }
    return "Agrandir le document";
  };

  return (
    <button
      type="button"
      onClick={handleNextStep}
      className={`hidden md:flex h-7 sm:h-8 px-2 sm:px-2.5 rounded-full items-center gap-1.5 border transition-all cursor-pointer shadow-md active:scale-95 animate-in fade-in zoom-in-95 duration-200 select-none ${
        isLevel2OrMore
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/80 shadow-blue-500/20 ring-1 ring-blue-400/30'
          : activeLevel === 1
          ? 'bg-[#101827] hover:bg-[#1a2538] text-cyan-300 border-cyan-500/60 shadow-cyan-950/40'
          : 'bg-[#101827] hover:bg-[#1a2538] text-slate-300 border-white/20'
      } ${className}`}
      title={getTooltip()}
    >
      {/* Icône carrée d'agrandissement ou de réduction */}
      {isLevel2OrMore ? (
        <Minimize2 className="w-3.5 h-3.5 stroke-[2.4] text-white shrink-0" />
      ) : (
        <Square className="w-3.5 h-3.5 stroke-[2.2] text-cyan-400 shrink-0" />
      )}

      {/* Indicateur visuel à 2 points (point-point) */}
      <div 
        className="flex items-center gap-1 shrink-0" 
        title={isLevel2OrMore ? "Étape 2/2 : Plein écran sans barre latérale" : activeLevel === 1 ? "Étape 1/2 : Agrandissement central" : "Étape 0/2"}
      >
        {/* Point 1 : Masquer la liste des fichiers (Agrandissement comme Image 2) */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            activeLevel >= 1
              ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)] scale-110'
              : 'bg-white/30'
          }`}
        />
        {/* Point 2 : Masquer la barre latérale gauche (Plein écran total pour le PDF seulement) */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isLevel2OrMore
              ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] scale-110'
              : 'bg-white/30'
          }`}
        />
      </div>

      <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-none hidden xs:inline">
        {isLevel2OrMore ? 'Réduire' : 'Plein écran'}
      </span>
    </button>
  );
};
