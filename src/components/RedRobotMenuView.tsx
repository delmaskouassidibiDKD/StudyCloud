import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';

interface RedRobotMenuViewProps {
  onBack: () => void;
}

export const RedRobotMenuView: React.FC<RedRobotMenuViewProps> = ({ onBack }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-stone-100 px-3 sm:px-6 py-4 overflow-y-auto min-h-[calc(100vh-66px)] flex flex-col transition-colors duration-300">
      {/* Barre supérieure avec bouton Retour et indication d'application */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs sm:text-sm rounded-xl border-2 border-stone-300 dark:border-stone-700 shadow-sm transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          title="Retour à l'écran d'accueil"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <DelmasRobot size={22} variant="red" />
          <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
            Nouvelle Application
          </span>
        </div>
      </div>

      {/* Zone principale totalement vide (prête pour les prochaines instructions) */}
      <div className="flex-1 w-full flex flex-col items-center justify-center p-4">
        {/* Totalement vide */}
      </div>
    </div>
  );
};
