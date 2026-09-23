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
          
          {/* Icône du dossier jaune 3D identique à l'application sans bloc noir */}
          <div className="w-28 h-24 sm:w-36 sm:h-30 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]">
            <svg className="w-full h-full" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="menuFolderBackGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FDE047" />
                  <stop offset="100%" stopColor="#EAB308" />
                </linearGradient>
                <linearGradient id="menuFolderFrontGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FEF9C3" />
                  <stop offset="100%" stopColor="#FDE047" />
                </linearGradient>
              </defs>

              {/* Dos du dossier avec l'onglet supérieur droit visible */}
              <path 
                d="M 44 14 L 86 14 C 91 14 94 17 94 22 L 94 40 L 44 40 Z" 
                fill="url(#menuFolderBackGrad)" 
                stroke="#18181B" 
                strokeWidth="3.6" 
                strokeLinejoin="round" 
              />

              {/* Corps principal avant du dossier avec onglet supérieur gauche */}
              <path 
                d="
                  M 16 14
                  L 44 14
                  C 48 14 50 17 52 20
                  C 54 23 56 25 60 25
                  L 86 25
                  C 91 25 94 28 94 33
                  L 94 76
                  C 94 81 91 84 86 84
                  L 14 84
                  C 9 84 6 81 6 76
                  L 6 22
                  C 6 17 9 14 14 14
                  Z
                " 
                fill="url(#menuFolderFrontGrad)" 
                stroke="#18181B" 
                strokeWidth="3.6" 
                strokeLinejoin="round" 
                strokeLinecap="round" 
              />

              {/* Badge SUPPLY CHAIN en bas à gauche */}
              <rect 
                x="12" 
                y="58" 
                width="48" 
                height="18" 
                rx="5" 
                fill="#FACC15" 
                stroke="#18181B" 
                strokeWidth="2.4" 
              />

              {/* Texte SUPPLY CHAIN à l'intérieur du badge */}
              <text 
                x="36" 
                y="70" 
                fill="#18181B" 
                fontSize="6.8" 
                fontWeight="900" 
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
                textAnchor="middle" 
                letterSpacing="0.4"
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
