import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface FavoritesMenuViewProps {
  onBack: () => void;
}

export const FavoritesMenuView: React.FC<FavoritesMenuViewProps> = ({ onBack }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[56px] md:top-[60px] z-30 w-full bg-[#F5F0E8] text-[#2D4A3E] px-4 py-8 overflow-y-auto">
      <div className="fixed top-14 left-4 right-4 flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Retour</span>
        </button>
      </div>
      <div className="w-full px-4 pt-16">
        <div className="text-center pt-4 pb-8 max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-serif font-normal text-[#2D4A3E] mb-3">Favoris</h1>
          <p className="text-sm font-sans text-[#5C6B5A]">Menu en cours de développement...</p>
        </div>
      </div>
    </div>
  );
};
