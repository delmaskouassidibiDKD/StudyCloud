import React from 'react';
import { Search, Plus, Bell, GraduationCap, Folder } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenUpload: () => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categories: string[];
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onOpenUpload,
  selectedCategory,
  setSelectedCategory,
  categories,
}) => {
  return (
    <header className="bg-[#FDFBF7] border-b-3 border-stone-800 px-6 py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sticky top-0 z-30 shadow-[0px_2px_0px_0px_#1c1917]">
      {/* Left: Search input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un dossier, un cours, un fichier (ex: Algorithme, Droit)..."
            className="w-full bg-[#F5F1E9] border-2 border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 outline-none focus:bg-white focus:shadow-[3px_3px_0px_0px_#1c1917] transition-all"
          />
        </div>
      </div>

      {/* Right: Actions and User profile */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={onOpenUpload}
          className="md:hidden bg-orange-500 text-white font-bold text-xs px-3 py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau</span>
        </button>

        {/* User profile card */}
        <div className="flex items-center gap-3 bg-[#F5F1E9] border-2 border-stone-800 rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_0px_#1c1917]">
          <div className="w-8 h-8 bg-orange-500 border-2 border-stone-800 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-[1px_1px_0px_0px_#1c1917]">
            🎓
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-stone-900 leading-none">Alexandre K.</p>
            <p className="text-[10px] text-stone-600 font-medium mt-0.5">Université Félix H. - M1 Info</p>
          </div>
        </div>
      </div>
    </header>
  );
};
