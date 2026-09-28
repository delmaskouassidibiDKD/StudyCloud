import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Film,
  Search,
  Plus,
  Star,
  Share2,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Check
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { generateVideoThumbnail } from '../services/mediaPreviewService';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { VideoCardPreview } from './VideoCardPreview';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { getWorkerApiUrl } from '../services/api';

interface VideosMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export const VideosMenuView: React.FC<VideosMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  const [videosList, setVideosList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().videos || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Lecteur vidéo actif (split à droite)
  const [selectedVideo, setSelectedVideo] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement et synchronisation avec CloudDataStore
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getVideosList()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setVideosList(data);
          CloudDataStore.setVideos(data as any);
        }
      })
      .catch((err) => console.warn('[VideosMenuView] Error fetching videos:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (isMounted) {
        setVideosList(state.videos || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Navigation vidéo
  const handleNavigateVideo = (direction: 'prev' | 'next') => {
    if (filteredVideos.length === 0) return;
    const currentIndex = selectedVideo
      ? filteredVideos.findIndex(v => v.id === selectedVideo.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredVideos.length - 1;
    if (newIndex >= filteredVideos.length) newIndex = 0;
    const nextVideo = filteredVideos[newIndex];
    if (nextVideo) {
      setSelectedVideo(nextVideo);
    }
  };

  // Import de vidéos
  const handleImportVideos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];

    showToast(`Préparation de ${files.length} vidéo(s)...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || 'mp4' : 'mp4';
        const comp = await compressFile(f, 'videos');
        const fileId = `vid-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        let thumbUrl: string | undefined;
        try {
          thumbUrl = (await generateVideoThumbnail(comp.file)) || undefined;
        } catch {}

        const item: FileItem = {
          id: fileId,
          name: f.name,
          category: 'videos',
          source: 'Vidéos',
          size: comp.originalSizeFormatted,
          sizeBytes: comp.originalSizeBytes,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          extension: ext.toUpperCase(),
          url: localBlobUrl,
          videoUrl: localBlobUrl,
          previewUrl: thumbUrl || localBlobUrl,
          isVideo: true
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setVideosList(prev => [...newItems, ...prev]);
    CloudDataStore.setVideos([...newItems, ...videosList] as any);

    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'videos' });
    showToast(`${newItems.length} vidéo(s) importée(s) !`);

    if (newItems.length > 0 && !selectedVideo) {
      setSelectedVideo(newItems[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Favoris
  const handleToggleFavorite = async (vid: FileItem) => {
    const nextState = !vid.isFavorite;
    setVideosList(prev =>
      prev.map(v => (v.id === vid.id ? { ...v, isFavorite: nextState } : v))
    );
    if (selectedVideo?.id === vid.id) {
      setSelectedVideo(prev => (prev ? { ...prev, isFavorite: nextState } : null));
    }
    CloudDataStore.updateFile(vid.id, { isFavorite: nextState });
    if (nextState) {
      await CloudStorageAPI.addFavorite(vid.id, 'videos').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(vid.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
  };

  // Suppression
  const handleDeleteVideo = async (vid: FileItem) => {
    if (!window.confirm(`Supprimer définitivement "${vid.name}" ?`)) return;

    setVideosList(prev => prev.filter(v => v.id !== vid.id));
    if (selectedVideo?.id === vid.id) {
      setSelectedVideo(null);
    }
    CloudDataStore.removeFile(vid.id);
    deleteFileBlob(vid.id).catch(() => {});
    await CloudStorageAPI.deleteVideo(vid.id).catch(() => {});
    showToast(`"${vid.name}" supprimé`);
  };

  // Téléchargement
  const handleDownload = async (vid: FileItem) => {
    let url = vid.videoUrl || vid.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(vid.id);
    }
    if (!url) {
      showToast('Fichier introuvable');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = vid.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Téléchargement de "${vid.name}"`);
  };

  // Partager
  const handleShare = (vid: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([vid]);
    } else {
      showToast('Partage StudyCloud');
    }
  };

  // Filtrage
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videosList;
    const q = searchQuery.toLowerCase().trim();
    return videosList.filter(v => v.name.toLowerCase().includes(q));
  }, [videosList, searchQuery]);

  // Rendu du lecteur vidéo dédié (Image 4)
  const renderVideoPlayer = (file: FileItem) => {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const fallbackStreamUrl = file.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(file.id)}` : '';
    const videoSrc = file.videoUrl || file.url || fallbackStreamUrl;

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur vidéo (Image 4) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateVideo('prev')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Vidéo précédente"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateVideo('next')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Vidéo suivante"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-purple-400 font-semibold truncate">
                {file.size || 'Vidéo'} • 1080P HD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleFavorite(file)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                file.isFavorite
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/40'
                  : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
              }`}
              title={file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => handleShare(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDownload(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(file, 'Vidéos', videosList)}
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
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              }`}
              title={isViewerMaximized ? 'Réduire la vue' : 'Plein écran'}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>
            <button
              type="button"
              onClick={() => setSelectedVideo(null)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title="Fermer le lecteur vidéo"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur vidéo (Image 4) */}
        <div className="flex-1 w-full h-full flex items-center justify-center relative p-1 sm:p-2 overflow-hidden">
          <ModernVideoPlayer
            src={videoSrc}
            poster={file.previewUrl}
            fileName={file.name}
            fileId={file.id}
            fileSize={file.size}
            autoPlay={true}
            className="w-full h-full max-h-[calc(100vh-180px)] rounded-2xl"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-50 dark:bg-[#070B14] overflow-hidden select-none">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-black/90 text-white border border-white/20 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Input de sélection de fichier */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportVideos}
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv"
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU VIDÉOS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Retour et Titre */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-purple-400">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Vidéos
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">
                  StudyCloud
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-purple-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Vidéos..."
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

          {/* DROITE : Espace d'étude & + Importer */}
          <div className="shrink-0 flex items-center gap-2">
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(selectedVideo || undefined, 'Vidéos', videosList)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#101827] text-emerald-400 border border-emerald-500/30 transition-all font-bold text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Espace d'étude</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-purple-400 border border-purple-500/40 hover:border-purple-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer une vidéo"
            >
              <Plus className="w-4 h-4 text-purple-400 stroke-[2.5]" />
              <span>+ Importer</span>
            </button>
          </div>
        </div>
      </header>

      {/* DISPOSITION SPLIT (IMAGE 4) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES VIDÉOS */}
        <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
          isViewerMaximized
            ? 'hidden'
            : selectedVideo
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
              : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
        }`}>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-stone-400">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Chargement des vidéos...</p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-purple-400" />
                <p className="text-sm font-semibold">Aucune vidéo disponible</p>
                <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                  Ce dossier ne contient aucune vidéo pour le moment.
                </p>
              </div>
            ) : (
              <div className={`grid gap-2.5 sm:gap-3.5 ${
                selectedVideo
                  ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              }`}>
                {filteredVideos.map((vid) => {
                  const isSelected = selectedVideo?.id === vid.id;

                  return (
                    <div
                      key={vid.id}
                      onClick={() => {
                        setSelectedVideo(vid);
                      }}
                      className={`group relative flex flex-col rounded-2xl p-2.5 transition-all cursor-pointer border select-none ${
                        isSelected
                          ? 'bg-purple-500/10 dark:bg-purple-950/30 border-purple-400 dark:border-purple-500 shadow-md ring-1 ring-purple-400/40'
                          : 'bg-white dark:bg-slate-900/80 border-stone-200/90 dark:border-slate-800 hover:border-purple-400/50 hover:shadow-lg'
                      }`}
                    >
                      {/* Vignette Vidéo */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 relative flex items-center justify-center shadow-inner">
                        <VideoCardPreview vid={vid} className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-black uppercase text-white">
                          {vid.size || 'HD'}
                        </span>
                        {vid.isFavorite && (
                          <Star className="absolute top-1.5 left-1.5 w-3.5 h-3.5 text-amber-400 fill-amber-400 filter drop-shadow" />
                        )}
                      </div>

                      {/* Titre & métadonnées */}
                      <div className="mt-2 min-w-0">
                        <h4 className={`text-xs font-bold truncate leading-tight ${
                          isSelected ? 'text-purple-400 font-black' : 'text-stone-800 dark:text-white group-hover:text-purple-400'
                        }`}>
                          {vid.name}
                        </h4>
                        <p className="text-[10px] text-stone-400 dark:text-slate-500 font-medium truncate mt-0.5">
                          {vid.size || 'Vidéo'} • {vid.date}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PANNEAU DE DROITE : LECTEUR VIDÉO DÉDIÉ (IMAGE 4) */}
        {selectedVideo && (
          <div className={`transition-all duration-300 flex flex-col bg-[#04060A] ${
            isViewerMaximized
              ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderVideoPlayer(selectedVideo)}
          </div>
        )}
      </div>
    </div>
  );
};
