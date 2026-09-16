import React, { useState, useRef, useEffect } from 'react';
import { Search, Trash2, MoreVertical, Share2, Lock, Globe, ArrowUpDown, Clock, HardDrive, Folder } from 'lucide-react';
import { SharedFolder } from '../types';
import { FolderCard } from './FolderCard';

interface SharedLinksViewProps {
  folders: SharedFolder[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectFolder: (folder: SharedFolder) => void;
  onOpenQR: (folder: SharedFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  setFolders: React.Dispatch<React.SetStateAction<SharedFolder[]>>;
}

export const SharedLinksView: React.FC<SharedLinksViewProps> = ({
  folders,
  searchQuery,
  setSearchQuery,
  onSelectFolder,
  onOpenQR,
  onDeleteFolder,
  setFolders,
}) => {
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'size'>('recent');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'unpublished'>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter folders
  const filtered = folders.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.files.some((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'published') {
      return !f.isPasswordProtected;
    }
    if (filterStatus === 'unpublished') {
      return f.isPasswordProtected;
    }
    return true;
  });

  // Sort folders
  const sortedFolders = [...filtered].sort((a, b) => {
    if (sortBy === 'size') {
      return b.totalSize - a.totalSize;
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    // recent default
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex flex-col space-y-6 pb-20 pt-20 md:pt-20 animate-fadeIn">
      {/* Fixed Header Container enclosing both Search bar and Filter buttons - Solid Dark #070a13 */}
      <div className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-[#FDFBF7] dark:bg-[#070a13] border-b-2 border-stone-800 dark:border-[#1e293b] shadow-sm px-4 md:px-8 pt-3 pb-2 space-y-2 transition-all">
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans mes liens..."
              className="w-full bg-white dark:bg-[#111a2e] dark:border-[#334155] dark:text-white dark:placeholder-slate-400 border-2 border-stone-800 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium outline-none shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 relative">
            <button
              onClick={() => setShowDeleteAllModal(true)}
              title="Supprimer tous les liens"
              className="p-1.5 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-white rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>

            {/* Three dots dropdown button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                title="Options de tri"
                className="p-1.5 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-white rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#111a2e] border-3 border-stone-800 dark:border-[#334155] rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[11px] font-extrabold text-stone-400 dark:text-slate-400 uppercase tracking-wider border-b border-stone-200 dark:border-[#1e293b] mb-1">
                    Options de tri
                  </div>
                  <button
                    onClick={() => {
                      setSortBy('size');
                      setMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 hover:bg-orange-50 dark:hover:bg-[#1e293b] transition-colors ${
                      sortBy === 'size' ? 'text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-[#1e293b]' : 'text-stone-800 dark:text-slate-200'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Trier par taille</span>
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('recent');
                      setMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 hover:bg-orange-50 dark:hover:bg-[#1e293b] transition-colors ${
                      sortBy === 'recent' ? 'text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-[#1e293b]' : 'text-stone-800 dark:text-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Par le plus récent</span>
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('oldest');
                      setMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 hover:bg-orange-50 dark:hover:bg-[#1e293b] transition-colors ${
                      sortBy === 'oldest' ? 'text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-[#1e293b]' : 'text-stone-800 dark:text-slate-200'
                    }`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Par le plus ancien</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Bar / Filter buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pt-0.5 pb-0.5 max-w-7xl mx-auto w-full">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] text-xs font-bold shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'all' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white dark:bg-[#1e293b] text-stone-800 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-[#283852]'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Tous mes liens</span>
          </button>
          <button
            onClick={() => setFilterStatus('unpublished')}
            className={`px-3 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] text-xs font-bold shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'unpublished' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white dark:bg-[#1e293b] text-stone-800 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-[#283852]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lien privé</span>
          </button>
          <button
            onClick={() => setFilterStatus('published')}
            className={`px-3 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] text-xs font-bold shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'published' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white dark:bg-[#1e293b] text-stone-800 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-[#283852]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Lien public</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-2">
        {sortedFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-14 h-14 bg-stone-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-stone-500 dark:text-slate-400">
              <Share2 className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h2 className="text-xl font-extrabold text-stone-900 dark:text-white">Aucun lien partagé</h2>
            <p className="text-sm text-stone-500 dark:text-slate-400 max-w-md">
              Vous n'avez pas encore créé de liens partagés. Importez des fichiers pour commencer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onSelect={onSelectFolder}
                onOpenQR={onOpenQR}
                onDelete={onDeleteFolder}
                isPublicView={false}
                onUpdateFolder={(updated) => {
                  setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-[6px_6px_0px_0px_#1c1917] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 border-2 border-stone-800 rounded-xl flex items-center justify-center text-red-600 shadow-[2px_2px_0px_0px_#1c1917]">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-stone-950">Supprimer tous les liens</h3>
            </div>
            <p className="text-sm text-stone-700 leading-relaxed">
              Attention ! Voulez-vous vraiment supprimer tous les liens ? Tous les liens (y compris ceux rendus publics) seront définitivement supprimés.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  folders.forEach((f) => onDeleteFolder(f.id));
                  setFolders([]);
                  setShowDeleteAllModal(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
