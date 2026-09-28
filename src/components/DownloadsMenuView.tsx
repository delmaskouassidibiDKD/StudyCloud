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
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { getDownloadedFiles, removeDownloadedFile, DownloadedItem } from '../services/downloadsManager';
import { getFileBlobUrl } from '../services/localFileStorage';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { ModernImageViewer } from './ModernImageViewer';
import { ModernDocumentViewer } from './ModernDocumentViewer';

interface DownloadsMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
}

export const DownloadsMenuView: React.FC<DownloadsMenuViewProps> = ({ onBack, onOpenStudySpace }) => {
  const [downloadedList, setDownloadedList] = useState<DownloadedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<DownloadedItem | null>(null);
  const [resolvedBlobUrl, setResolvedBlobUrl] = useState<string>('');
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
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

  // Résolution du blob URL
  useEffect(() => {
    if (!selectedItem) {
      setResolvedBlobUrl('');
      return;
    }
    let isMounted = true;
    if (selectedItem.id) {
      getFileBlobUrl(selectedItem.id)
        .then((url) => {
          if (isMounted && url) {
            setResolvedBlobUrl(url);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [selectedItem?.id]);

  const handleDeleteItem = (id: string) => {
    removeDownloadedFile(id);
    setDownloadedList(prev => prev.filter(item => item.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
    showToast('Élément retiré de vos téléchargements');
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return downloadedList;
    const q = searchQuery.toLowerCase().trim();
    return downloadedList.filter(d => (d.name || '').toLowerCase().includes(q));
  }, [downloadedList, searchQuery]);

  const getItemIcon = (item: DownloadedItem) => {
    const ext = (item.extension || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (['mp4', 'webm', 'mkv', 'mov'].includes(ext)) return <Film className="w-5 h-5 text-purple-400" />;
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return <Music className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-sky-400" />;
  };

  const renderReader = (item: DownloadedItem) => {
    const ext = (item.extension || '').toLowerCase();
    const name = item.name || 'Fichier';
    const isVid = ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);
    const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const url = resolvedBlobUrl || item.url || '';

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px]" title={name}>
              {name}
            </p>
            {item.size && (
              <span className="text-[10px] text-sky-400 font-semibold truncate">
                {item.size}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(item as any, 'Téléchargements', downloadedList as any[])}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                title="Ouvrir dans l'Espace d'étude"
              >
                <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                isViewerMaximized ? 'bg-sky-600 text-white border-sky-400' : 'bg-black/60 hover:bg-sky-600/80 text-white border-white/10'
              }`}
              title={isViewerMaximized ? 'Réduire la vue' : 'Plein écran'}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title="Fermer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        <div className="flex-1 w-full h-full flex items-center justify-center p-2 overflow-hidden">
          {isVid ? (
            <ModernVideoPlayer
              src={url}
              fileName={name}
              fileId={item.id}
              fileSize={item.size}
              autoPlay={true}
              className="w-full h-full max-h-[calc(100vh-180px)] rounded-2xl"
            />
          ) : isImg ? (
            <ModernImageViewer
              src={url}
              alt={name}
              fileName={name}
              fileId={item.id}
              fileSize={item.size}
              className="w-full h-full max-h-[calc(100vh-180px)] rounded-2xl"
            />
          ) : (
            <ModernDocumentViewer
              fileId={item.id}
              url={url}
              fileName={name}
              fileSize={item.size}
              className="w-full h-full border-0 rounded-none shadow-none"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-black/90 text-white border border-white/20 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* EN-TÊTE FIXE DU MENU TÉLÉCHARGEMENTS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre */}
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
                placeholder="Rechercher dans Téléchargements..."
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

          {/* DROITE : Espace d'étude */}
          <div className="shrink-0 flex items-center gap-2">
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(selectedItem || undefined, 'Téléchargements', downloadedList as any[])}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#101827] text-emerald-400 border border-emerald-500/30 transition-all font-bold text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Espace d'étude</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* DISPOSITION SPLIT */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE */}
        <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-6 py-4 pb-64 ${
          isViewerMaximized
            ? 'hidden'
            : selectedItem
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-white/10'
              : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
        }`}>
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Chargement...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Download className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-sky-400" />
              <p className="text-sm font-semibold">Aucun fichier téléchargé</p>
              <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                Les fichiers téléchargés pour une lecture hors-ligne s'afficheront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const name = item.name || 'Fichier';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400/30'
                        : 'bg-[#0B101D] border-white/5 hover:border-sky-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0">
                        {getItemIcon(item)}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs sm:text-sm font-bold truncate ${
                          isSelected ? 'text-sky-300' : 'text-white'
                        }`}>
                          {name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                          {item.size || 'Fichier'} • {item.date || 'Téléchargé'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PANNEAU DE DROITE : LECTEUR */}
        {selectedItem && (
          <div className={`transition-all duration-300 flex flex-col bg-[#04060A] ${
            isViewerMaximized
              ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderReader(selectedItem)}
          </div>
        )}
      </div>
    </div>
  );
};
