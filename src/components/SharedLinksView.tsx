import React, { useState, useRef, useEffect } from 'react';
import { Search, Trash2, MoreVertical, Share2, Lock, Globe, ArrowUpDown, Clock, HardDrive, Folder, RotateCw, Loader2 } from 'lucide-react';
import { SharedFolder } from '../types';
import { FolderCard } from './FolderCard';
import { useUserShares, useDeleteShareMutation, useToggleSharePublicMutation } from '../hooks/useCloudQueries';
import { useBackHandler } from '../services/backNavigation';
import { invalidateCloudQueries } from '../services/queryClient';

interface SharedLinksViewProps {
  folders?: SharedFolder[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectFolder: (folder: SharedFolder) => void;
  onOpenQR: (folder: SharedFolder) => void;
  onDeleteFolder?: (folderId: string) => void;
  setFolders?: React.Dispatch<React.SetStateAction<SharedFolder[]>>;
  isLoading?: boolean;
  onRefresh?: () => void;
  userId?: string;
}

export const SharedLinksView: React.FC<SharedLinksViewProps> = ({
  folders: propFolders,
  searchQuery,
  setSearchQuery,
  onSelectFolder,
  onOpenQR,
  onDeleteFolder,
  setFolders,
  isLoading = false,
  onRefresh,
  userId,
}) => {
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'size'>('recent');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'unpublished'>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Gestion du bouton matériel / virtuel retour d'Android
  useBackHandler(showDeleteAllModal, () => setShowDeleteAllModal(false), 'shared-delete-all-modal');
  useBackHandler(menuOpen, () => setMenuOpen(false), 'shared-menu-open');
  const menuRef = useRef<HTMLDivElement>(null);

  // TanStack Query : synchronisation réactive avec Cloudflare D1
  const { data: serverFolders = [], isLoading: isQueryLoading, refetch } = useUserShares(userId);
  const deleteMutation = useDeleteShareMutation();
  const togglePublicMutation = useToggleSharePublicMutation();

  // Les données D1 gérées par TanStack Query sont la source de vérité absolue
  const activeFolders = serverFolders.length > 0 ? serverFolders : (propFolders || []);
  const effectiveLoading = isLoading || (isQueryLoading && activeFolders.length === 0);

  const handleDeleteItem = (folderId: string) => {
    deleteMutation.mutate(folderId);
    if (onDeleteFolder) onDeleteFolder(folderId);
    if (setFolders) setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  const handleRefresh = async () => {
    await refetch();
    if (onRefresh) onRefresh();
    invalidateCloudQueries.shares();
  };

  // Filter folders
  const filtered = activeFolders.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.files.some((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const isPublic = Boolean(f.isPublic);

    if (filterStatus === 'published') {
      return isPublic;
    }
    if (filterStatus === 'unpublished') {
      return !isPublic;
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
    <div className="flex flex-col space-y-4 pb-20 pt-[84px] sm:pt-[90px] md:pt-16 animate-fadeIn min-h-screen px-2.5 sm:px-4 md:px-8">
      {/* Fixed Header Container - Responsive 2 lignes sur mobile, 1 ligne sur desktop */}
      <div className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-white/95 dark:bg-[#070a13]/95 backdrop-blur-md border-b-2 border-stone-800 dark:border-[#1e293b] shadow-sm px-2.5 sm:px-4 md:px-8 py-1.5 sm:py-2 transition-all">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 sm:gap-2.5 max-w-7xl mx-auto w-full">
          {/* Ligne 1 sur mobile : Boutons d'action (Actualiser, Poubelle, Trois traits de tri) + Champ de recherche fluide */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 w-full md:w-auto md:flex-1 min-w-0">
            {/* 3 Boutons compacts */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={handleRefresh}
                disabled={effectiveLoading}
                title="Actualiser vos liens de partage"
                className="p-1 sm:p-1.5 md:p-2 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-white rounded-lg sm:rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 dark:text-orange-400 ${effectiveLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowDeleteAllModal(true)}
                title="Supprimer tous les liens"
                className="p-1 sm:p-1.5 md:p-2 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-white rounded-lg sm:rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 dark:text-red-400" />
              </button>

              {/* Three dots / traits dropdown button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  title="Options de tri"
                  className="p-1 sm:p-1.5 md:p-2 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-white rounded-lg sm:rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
                >
                  <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-[#111a2e] border-3 border-stone-800 dark:border-[#334155] rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
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

            {/* Champ de recherche : fluide sur mobile, taille fixe sur desktop */}
            <div className="relative flex-1 min-w-0 md:w-64 lg:w-72 md:flex-initial">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans mes liens..."
                className="w-full bg-white dark:bg-[#111a2e] dark:border-[#334155] dark:text-white dark:placeholder-slate-400 border-2 border-stone-800 rounded-lg sm:rounded-xl pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium outline-none shadow-[1.5px_1.5px_0px_0px_#1c1917] sm:shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all"
              />
            </div>
          </div>

          {/* Ligne 2 sur mobile (ou à droite sur desktop) : 3 Boutons de filtre (Tous mes liens, Lien privé, Lien rendu public) */}
          <div className="flex items-center gap-1 sm:gap-2 w-full md:w-auto shrink-0 justify-between md:justify-end">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 md:flex-initial justify-center px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap active:translate-x-0.5 active:translate-y-0.5 ${
                filterStatus === 'all'
                  ? 'bg-sky-400 dark:bg-sky-500 text-stone-950 dark:text-white border-stone-900 dark:border-stone-300 shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none ring-2 ring-sky-300 dark:ring-sky-400/60 font-black'
                  : 'bg-white dark:bg-[#1e293b] text-stone-800 dark:text-slate-200 border-stone-800 dark:border-[#334155] hover:bg-stone-100 dark:hover:bg-[#283852] shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none font-bold'
              }`}
            >
              <Folder className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">Tous mes liens</span>
            </button>
            <button
              onClick={() => setFilterStatus('unpublished')}
              className={`flex-1 md:flex-initial justify-center px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap active:translate-x-0.5 active:translate-y-0.5 ${
                filterStatus === 'unpublished'
                  ? 'bg-sky-400 dark:bg-sky-500 text-stone-950 dark:text-white border-stone-900 dark:border-stone-300 shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none ring-2 ring-sky-300 dark:ring-sky-400/60 font-black'
                  : 'bg-white dark:bg-[#1e293b] text-stone-800 dark:text-slate-200 border-stone-800 dark:border-[#334155] hover:bg-stone-100 dark:hover:bg-[#283852] shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none font-bold'
              }`}
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">Lien privé</span>
            </button>
            <button
              onClick={() => setFilterStatus('published')}
              className={`flex-1 md:flex-initial justify-center px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap active:translate-x-0.5 active:translate-y-0.5 ${
                filterStatus === 'published'
                  ? 'bg-sky-400 dark:bg-sky-500 text-stone-950 dark:text-white border-stone-900 dark:border-stone-300 shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none ring-2 ring-sky-300 dark:ring-sky-400/60 font-black'
                  : 'bg-white dark:bg-[#1e293b] text-stone-800 dark:text-slate-200 border-stone-800 dark:border-[#334155] hover:bg-stone-100 dark:hover:bg-[#283852] shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none font-bold'
              }`}
            >
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate sm:hidden">Lien public</span>
              <span className="hidden sm:inline">Lien rendu public</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-2">
        {effectiveLoading && sortedFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-xs font-bold text-stone-600 dark:text-slate-400">
              Chargement de vos liens actifs...
            </p>
          </div>
        ) : sortedFolders.length === 0 ? (
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-3.5 w-full">
            {sortedFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onSelect={onSelectFolder}
                onOpenQR={onOpenQR}
                onDelete={handleDeleteItem}
                isPublicView={false}
                onUpdateFolder={(updated) => {
                  togglePublicMutation.mutate({
                    shareId: updated.id,
                    isPublic: updated.isPublic ?? false,
                    description: updated.description,
                    allowDownload: updated.allowDownload,
                  });
                  if (setFolders) {
                    setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
                  }
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
                  activeFolders.forEach((f) => {
                    handleDeleteItem(f.id);
                  });
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
