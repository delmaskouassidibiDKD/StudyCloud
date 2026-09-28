import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Trash2,
  Check,
  CheckSquare,
  Square,
  Eye,
  BookOpen
} from 'lucide-react';
import { getDownloadedFiles, removeDownloadedFile, DownloadedItem } from '../services/downloadsManager';
import { getFileBlobUrl } from '../services/localFileStorage';

interface DownloadsMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
}

export const DownloadsMenuView: React.FC<DownloadsMenuViewProps> = ({ onBack, onOpenStudySpace }) => {
  const [downloadedList, setDownloadedList] = useState<DownloadedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    try {
      const items = getDownloadedFiles();
      setDownloadedList(items);
    } catch {}
    setLoading(false);
  }, []);

  const handleDeleteItem = (id: string) => {
    removeDownloadedFile(id);
    setDownloadedList(prev => prev.filter(item => item.id !== id));
    showToast('Élément retiré de vos téléchargements');
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return downloadedList;
    const q = searchQuery.toLowerCase().trim();
    return downloadedList.filter(d => (d.name || d.title || '').toLowerCase().includes(q));
  }, [downloadedList, searchQuery]);

  const getItemIcon = (item: DownloadedItem) => {
    const ext = (item.extension || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (['mp4', 'webm', 'mkv', 'mov'].includes(ext)) return <Film className="w-5 h-5 text-purple-400" />;
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return <Music className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-sky-400" />;
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU TÉLÉCHARGEMENTS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Téléchargements */}
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
              <div className="p-2 rounded-xl bg-black border border-white/10 text-sky-400">
                <Download className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Téléchargements
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-sky-400/80 leading-tight">
                  {downloadedList.length} fichier{downloadedList.length > 1 ? 's' : ''} enregistré{downloadedList.length > 1 ? 's' : ''} hors-ligne
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-sky-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un téléchargement..."
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
      </header>

      {/* CONTENU PRINCIPAL : LISTE DES TÉLÉCHARGEMENTS */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de vos téléchargements...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-sky-500/20 flex items-center justify-center mb-4 shadow-xl">
              <Download className="w-10 h-10 text-sky-400 opacity-60 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucun téléchargement trouvé' : 'Aucun fichier téléchargé'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {searchQuery
                ? `Aucun document téléchargé ne correspond à "${searchQuery}".`
                : 'Les cours et fichiers que vous téléchargez pour un accès hors-ligne apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group rounded-2xl p-3 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 hover:border-sky-400/40 shadow-sm transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 shrink-0">
                    {getItemIcon(item)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={item.name || item.title}>
                      {item.name || item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.sizeFormatted || 'Fichier hors-ligne'} • {item.extension?.toUpperCase() || 'DOC'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenStudySpace && (
                    <button
                      type="button"
                      onClick={() => onOpenStudySpace(item, 'Téléchargements')}
                      className="p-1.5 rounded-lg border border-white/10 text-emerald-400 hover:bg-emerald-500/10"
                      title="Ouvrir dans l'Espace d'étude"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-400"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-sky-500/40 text-sky-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
