import React from 'react';
import { ArrowLeft, Folder, FileQuestion } from 'lucide-react';

interface Page1FilesMenuViewProps {
  onBack: () => void;
}

export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-3 sm:px-6 py-6 overflow-y-auto min-h-[calc(100vh-66px)] flex flex-col transition-colors duration-300">
      
      {/* Top Header avec bouton Retour et Titre */}
      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white dark:border-[#334155] font-bold text-xs rounded-xl border-2 border-[#2D4A3E] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 select-none"
          title="Retour à l'accueil"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>

        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-stone-900 bg-amber-400 dark:bg-amber-500 px-3.5 py-1.5 rounded-xl border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] select-none">
          Fichiers
        </h1>

        {/* Espace vide pour équilibrer le header */}
        <div className="w-16 hidden sm:block" />
      </div>

      {/* Contenu principal : Espace vide simple et professionnel */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center mt-10 select-none">
        <div className="w-full max-w-md mx-auto p-8 sm:p-10 rounded-3xl border-2 border-dashed border-stone-400/40 dark:border-stone-700/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xs flex flex-col items-center justify-center text-center space-y-4 shadow-sm transition-all">
          
          {/* Icône du dossier jaune identique à l'application */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/40 flex items-center justify-center shadow-inner">
            <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M 46 22 L 86 22 C 90 22 93 25 93 29 L 93 42 L 46 42 Z" 
                fill="#FACC15" 
                stroke="#1C1917" 
                strokeWidth="3.2" 
                strokeLinejoin="round" 
              />
              <rect 
                x="7" 
                y="22" 
                width="86" 
                height="66" 
                rx="10" 
                fill="#FEF08A" 
                stroke="#1C1917" 
                strokeWidth="3.2" 
              />
              <rect 
                x="14" 
                y="62" 
                width="46" 
                height="18" 
                rx="5" 
                fill="#FACC15" 
                stroke="#1C1917" 
                strokeWidth="2.2" 
              />
              <text 
                x="37" 
                y="74" 
                fill="#1C1917" 
                fontSize="6.8" 
                fontWeight="900" 
                fontFamily="system-ui, -apple-system, sans-serif" 
                textAnchor="middle" 
                letterSpacing="0.3"
              >
                SUPPLY CHAIN
              </text>
            </svg>
          </div>

          {/* Message clair et professionnel */}
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-slate-100 tracking-tight">
              Vous n'avez pas de fichier pour l'instant
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-xs leading-relaxed">
              Cet espace est actuellement vide. Vos documents et fichiers s'afficheront ici.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
