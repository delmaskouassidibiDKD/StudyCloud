import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface FavoritesMenuViewProps {
  onBack: () => void;
}

export const FavoritesMenuView: React.FC<FavoritesMenuViewProps> = ({ onBack }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[72px] md:top-[76px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 py-8 overflow-y-auto transition-colors duration-300">
      <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:text-white dark:border-[#334155] font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>
      </div>
      <div className="w-full px-4 pt-20 sm:pt-24">
        <div className="text-center pt-4 pb-8 max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-serif font-normal text-[#2D4A3E] mb-3">Favoris</h1>
          <p className="text-sm font-sans text-[#5C6B5A]">Menu en cours de développement...</p>
        </div>
      </div>
    </div>
  );
};
