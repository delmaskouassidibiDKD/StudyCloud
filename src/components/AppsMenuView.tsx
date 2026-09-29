import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface AppsMenuViewProps {
  onBack: () => void;
  onLaunchApp?: (appId: string) => void;
}

export const AppsMenuView: React.FC<AppsMenuViewProps> = ({ onBack }) => {
  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-stone-100 text-stone-900 select-none animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU APPLICATIONS */}
      <header className="sticky top-0 z-30 w-full bg-stone-100/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 border-b border-stone-200 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Applications */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-full bg-[#182032] hover:bg-[#222c44] text-white border border-stone-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            <div>
              <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 leading-tight">
                Applications
              </h1>
              <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
                StudyCloud
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL : MESSAGE PROFESSIONNEL AU MILIEU SANS LOGOS */}
      <main className="flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-10 text-center py-24">
        <div className="max-w-lg mx-auto space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Ce menu n'est pas disponible pour le moment
          </h2>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
            L'accès aux applications et aux outils intégrés est temporairement suspendu pour des travaux d'optimisation et de maintenance technique.
          </p>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Ce service sera prochainement réactivé. Nous vous remercions pour votre compréhension.
          </p>
        </div>
      </main>
    </div>
  );
};
