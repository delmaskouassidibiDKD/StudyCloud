import React from 'react';
import { Square } from 'lucide-react';
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
  const activeLevel = expandLevel >= 1 ? expandLevel : 1;

  const handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeLevel >= 2) {
      // Revenir immédiatement à l'affichage normal
      onExpandChange(1);
    } else {
      // Passer en plein écran agrandi propre
      onExpandChange(2);
    }
  };

  const getTooltip = () => {
    if (activeLevel >= 2) {
      return "Réduire la vue (revenir à l'affichage normal)";
    }
    return "Agrandir en plein écran";
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
      {/* Icône carrée d'agrandissement conforme à la demande de l'utilisateur ("le truc carré qui ressemble à agrandir") */}
      {activeLevel === 3 ? (
        // Icône de restauration (deux carrés superposés classiques pour restaurer l'écran)
        <svg
          className="w-3.5 h-3.5 stroke-[2.2] text-white shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="7" y="7" width="13.5" height="13.5" rx="1.5" />
          <path d="M7 17H4.5a1.5 1.5 0 0 1-1.5-1.5V4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5V7" />
        </svg>
      ) : activeLevel === 2 ? (
        // Grand carré d'agrandissement actif (Étape 1/2)
        <Square className="w-3.5 h-3.5 stroke-[2.4] text-white shrink-0" />
      ) : (
        // Carré d'agrandissement standard d'ordinateur (Étape 0/2)
        <Square className="w-3.5 h-3.5 stroke-[2.2] text-cyan-400 shrink-0" />
      )}

      {/* Indicateur visuel à 2 points (point-point) */}
      <div className="flex items-center gap-1 shrink-0" title={`Étape ${activeLevel - 1} / 2`}>
        {/* Point 1 : Masquer la barre du haut */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            activeLevel >= 2
              ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] scale-110'
              : 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.9)] animate-pulse'
          }`}
        />
        {/* Point 2 : Masquer la barre latérale gauche (plein écran total) */}
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
        {activeLevel >= 2 ? 'Réduire' : 'Plein écran'}
      </span>
    </button>
  );
};
