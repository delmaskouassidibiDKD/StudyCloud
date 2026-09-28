import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Star,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FolderArchive,
  Download,
  Share2,
  BookOpen,
  Trash2,
  Check,
  CheckSquare,
  Square,
  MoreVertical,
  Eye
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { getFileBlobUrl } from '../services/localFileStorage';
import { FileItem } from './Page1FilesMenuView';
import { DocumentCardPreview } from './DocumentCardPreview';
import { VideoCardPreview } from './VideoCardPreview';

interface FavoritesMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
  setActivePreviewItem?: (item: any) => void;
}

export const FavoritesMenuView: React.FC<FavoritesMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink,
  setActivePreviewItem
}) => {
  const getFavsFromStore = () => {
    const s = CloudDataStore.getState();
    const all = [
      ...(s.favorites || []),
      ...(s.documents || []).filter(f => f.isFavorite),
      ...(s.images || []).filter(f => f.isFavorite),
      ...(s.videos || []).filter(f => f.isFavorite),
      ...(s.audio || []).filter(f => f.isFavorite),
      ...Object.values(s.folderFilesMap || {}).flat().filter(f => f.isFavorite),
    ];
    const seen = new Set<string>();
    return all.filter(f => {
      if (!f || !f.id || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  };

  const [favoritesList, setFavoritesList] = useState<FileItem[]>(() => getFavsFromStore());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'documents' | 'images' | 'videos' | 'audio'>('all');
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement et synchronisation des favoris
  useEffect(() => {
    const unsubscribe = CloudDataStore.subscribe(() => {
      setFavoritesList(getFavsFromStore());
      setLoading(false);
    });
    setFavoritesList(getFavsFromStore());
    return () => {
      unsubscribe();
    };
  }, []);

  // Retirer un favori
  const handleRemoveFavorite = async (file: FileItem) => {
    setFavoritesList(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.updateFile(file.id, { isFavorite: false });
    await CloudStorageAPI.removeFavorite(file.id).catch(() => {});
    showToast(`"${file.name}" retiré des favoris`);
    setMenuItemId(null);
  };

  // Télécharger
  const handleDownload = async (file: FileItem) => {
    let url = file.previewUrl || file.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(file.id);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Téléchargement démarré...');
    }
    setMenuItemId(null);
  };

  // Filtrage
  const filteredFavorites = useMemo(() => {
    let list = favoritesList;

    if (activeFilter !== 'all') {
      list = list.filter(f => f.category === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }

    return list;
  }, [favoritesList, activeFilter, searchQuery]);

  const getFileIcon = (file: FileItem) => {
    if (file.category === 'images' || file.isImage) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (file.category === 'videos' || file.isVideo) return <Film className="w-5 h-5 text-purple-400" />;
    if (file.category === 'audio' || file.isAudio) return <Music className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU FAVORIS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Favoris */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-amber-400">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Favoris
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-amber-400/80 leading-tight">
                  {favoritesList.length} fichier{favoritesList.length > 1 ? 's' : ''} favori{favoritesList.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Favoris */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-amber-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans les favoris..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE RAPIDE */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Tous les favoris' },
            { id: 'documents', label: 'Documents' },
            { id: 'images', label: 'Images' },
            { id: 'videos', label: 'Vidéos' },
            { id: 'audio', label: 'Audio' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-[#10162A] text-slate-300 hover:text-white hover:bg-[#192242] border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* CONTENU PRINCIPAL : GRILLE DES FAVORIS */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de vos favoris...</p>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-amber-500/20 flex items-center justify-center mb-4 shadow-xl">
              <Star className="w-10 h-10 text-amber-400 opacity-60 fill-amber-400/20 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucun favori trouvé' : 'Aucun favori pour le moment'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {searchQuery
                ? `Aucun fichier favori ne correspond à "${searchQuery}".`
                : 'Pour ajouter un fichier en favori, cliquez sur le bouton étoile ⭐ ou dans les options (•••) d’un fichier.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredFavorites.map((file) => (
              <div
                key={file.id}
                onClick={() => {
                  if (setActivePreviewItem) setActivePreviewItem(file);
                  else if (onOpenStudySpace) onOpenStudySpace(file, 'Favoris', favoritesList);
                }}
                className="group relative rounded-2xl p-2.5 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 hover:border-amber-400/40 shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1 rounded-md bg-black/60 border border-white/10">
                    {getFileIcon(file)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(file);
                    }}
                    className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                    title="Retirer des favoris"
                  >
                    <Star className="w-4 h-4 fill-amber-400" />
                  </button>
                </div>

                <div className="w-full h-24 rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center mb-2">
                  {file.category === 'images' || file.isImage ? (
                    <img
                      src={file.previewUrl || file.url}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : file.category === 'videos' || file.isVideo ? (
                    <VideoCardPreview vid={file} />
                  ) : file.category === 'documents' ? (
                    <DocumentCardPreview doc={file} />
                  ) : (
                    <Music className="w-8 h-8 text-amber-400 stroke-[1.8]" />
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors" title={file.name}>
                    {file.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {file.size} • {file.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
