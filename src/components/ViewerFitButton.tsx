import React from 'react';
import { Crop } from 'lucide-react';
import { useMediaFitMode, toggleMediaFitMode } from '../utils/viewerFitManager';

interface ViewerFitButtonProps {
  className?: string;
  title?: string;
}

/**
 * Bouton d'agrandissement de cadre (Plein cadre sans bandes noires)
 * Déplacé dans la barre supérieure d'actions à côté des boutons d'agrandissement et de fermeture.
 * Fonctionne sur Ordinateur et Téléphone dans tous les menus sans afficher de message intempestif.
 */
export const ViewerFitButton: React.FC<ViewerFitButtonProps> = ({
  className = '',
  title
}) => {
  const fitMode = useMediaFitMode();

  const getTooltip = () => {
    if (title) return title;
    if (fitMode === 'cover') {
      return 'Plein cadre immersif (Sans bandes noires) - Cliquer pour étirer';
    }
    if (fitMode === 'fill') {
      return 'Cadre étiré - Cliquer pour ajuster';
    }
    return "Agrandir le cadre pour occuper tout l'espace (Sans bandes noires)";
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleMediaFitMode();
      }}
      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
        fitMode === 'cover'
          ? 'bg-purple-600 text-white border-purple-400 shadow-purple-600/30'
          : fitMode === 'fill'
          ? 'bg-indigo-600 text-white border-indigo-400'
          : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
      } ${className}`}
      title={getTooltip()}
    >
      <Crop className="w-3.5 h-3.5 stroke-[2.2]" />
    </button>
  );
};
