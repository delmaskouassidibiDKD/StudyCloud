import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Film,
  Plus,
  Trash2,
  MoreVertical,
  Star,
  Download,
  Share2,
  BookOpen,
  Edit2,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  RotateCw,
  Check,
  CheckSquare,
  Square,
  FileVideo
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { VideoCardPreview } from './VideoCardPreview';
import { UploadQueue } from '../services/uploadQueue';
import { ModernVideoPlayer } from './ModernVideoPlayer';

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

  // Lecteur vidéo actif
  const [playingVideo, setPlayingVideo] = useState<FileItem | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string>('');

  // Sélection multiple
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Menu déroulant
  const [menuVideoId, setMenuVideoId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement des vidéos
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Résoudre l'URL vidéo quand une vidéo est sélectionnée
  useEffect(() => {
    if (!playingVideo) {
      setVideoBlobUrl('');
      return;
    }

    let isMounted = true;
    const resolveUrl = async () => {
      let target = playingVideo.videoUrl || playingVideo.url || '';
      if (!target.startsWith('http') && !target.startsWith('blob:')) {
        const local = await getFileBlobUrl(playingVideo.id);
        if (local) target = local;
      }
      if (isMounted) setVideoBlobUrl(target);
    };

    resolveUrl();
    return () => {
      isMounted = false;
    };
  }, [playingVideo]);

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
          previewUrl: localBlobUrl,
          isVideo: true
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setVideosList(prev => [...newItems, ...prev]);
    CloudDataStore.setVideos([...newItems, ...videosList] as any);

    // File d'attente d'upload cloud
    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'videos' });

    showToast(`${newItems.length} vidéo(s) importée(s) avec succès !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Suppression
  const handleDeleteVideo = async (vid: FileItem) => {
    setVideosList(prev => prev.filter(v => v.id !== vid.id));
    if (playingVideo?.id === vid.id) {
      setPlayingVideo(null);
    }

    const trashedItem = { ...vid, originalCategory: 'videos', isTrash: true };
    CloudDataStore.moveToTrash(trashedItem as any);
    await CloudStorageAPI.deleteVideo(vid.id).catch(() => {});
    showToast(`"${vid.name}" déplacé dans la corbeille`);
    setMenuVideoId(null);
  };

  // Favori
  const handleToggleFavorite = async (vid: FileItem) => {
    const nextState = !vid.isFavorite;
    setVideosList(prev =>
      prev.map(v => (v.id === vid.id ? { ...v, isFavorite: nextState } : v))
    );
    if (nextState) {
      await CloudStorageAPI.addFavorite(vid.id, 'videos').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(vid.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
    setMenuVideoId(null);
  };

  // Renommer
  const handleRenameVideo = async (vid: FileItem) => {
    const newName = window.prompt('Nouveau nom de la vidéo :', vid.name);
    if (!newName || !newName.trim() || newName.trim() === vid.name) return;

    const trimmed = newName.trim();
    const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.${(vid.extension || 'mp4').toLowerCase()}`;

    setVideosList(prev =>
      prev.map(v => (v.id === vid.id ? { ...v, name: finalName } : v))
    );
    CloudDataStore.updateFile(vid.id, { name: finalName });
    showToast(`Vidéo renommée en "${finalName}"`);
    setMenuVideoId(null);
  };

  // Télécharger
  const handleDownload = async (vid: FileItem) => {
    let url = vid.videoUrl || vid.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(vid.id);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = vid.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Téléchargement démarré...');
    }
    setMenuVideoId(null);
  };

  // Filtrage
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videosList;
    const q = searchQuery.toLowerCase().trim();
    return videosList.filter(v => v.name.toLowerCase().includes(q));
  }, [videosList, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* Input invisible pour l'import de vidéos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportVideos}
        accept="video/*,.mp4,.webm,.mkv,.mov,.avi,.3gp,.flv"
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU VIDÉOS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Vidéos */}
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
              <div className="p-2 rounded-xl bg-black border border-white/10 text-purple-400">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Vidéos
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-purple-400/80 leading-tight">
                  {videosList.length} vidéo{videosList.length > 1 ? 's' : ''} disponible{videosList.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Vidéos */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-purple-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une vidéo..."
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

          {/* DROITE : Bouton + Importer et Actions */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-purple-400 border border-purple-500/40 hover:border-purple-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer une vidéo"
            >
              <Plus className="w-4 h-4 text-purple-400 stroke-[2.5]" />
              <span className="hidden xs:inline">Importer vidéo</span>
              <span className="xs:hidden">Importer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-purple-500 text-black border-purple-400 font-bold'
                  : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
              }`}
              title={isSelectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* BANDEAU DE SÉLECTION MULTIPLE */}
      {isSelectionMode && (
        <div className="w-full bg-[#0F1424] border-b border-purple-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-purple-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredVideos.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredVideos.map(v => v.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2"
            >
              {selectedIds.length === filteredVideos.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = videosList.filter(v => selectedIds.includes(v.id));
                    toDelete.forEach(handleDeleteVideo);
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                  }}
                  className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 rounded-lg flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedIds.length})</span>
                </button>

                {onOpenStudySpace && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = videosList.find(v => v.id === selectedIds[0]);
                      onOpenStudySpace(first, 'Vidéos', videosList);
                    }}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1 font-bold"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Espace d'étude</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* LECTEUR VIDÉO AU SOMMET (SI VIDÉO OUVERTE) */}
      {playingVideo && (
        <div className="w-full bg-[#0D1222] border-b border-purple-500/30 p-3 sm:p-5 shadow-2xl relative">
          <div className="max-w-5xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 bg-[#060914] p-2.5 rounded-2xl border border-white/10">
              <div className="min-w-0 flex items-center gap-2">
                <Film className="w-5 h-5 text-purple-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-black text-white truncate" title={playingVideo.name}>
                  {playingVideo.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onOpenStudySpace && (
                  <button
                    type="button"
                    onClick={() => onOpenStudySpace(playingVideo, 'Vidéos', videosList)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Espace d'étude</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPlayingVideo(null)}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                  title="Fermer le lecteur"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="w-full h-[55vh] max-h-[650px] bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/10">
              {videoBlobUrl ? (
                <ModernVideoPlayer
                  src={videoBlobUrl}
                  title={playingVideo.name}
                  autoPlay
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span>Chargement de la vidéo...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL : GRILLE DES VIDÉOS */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de vos vidéos...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-purple-500/20 flex items-center justify-center mb-4 shadow-xl">
              <FileVideo className="w-10 h-10 text-purple-400 opacity-80 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucune vidéo trouvée' : 'Aucune vidéo disponible'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              {searchQuery
                ? `Aucune vidéo ne correspond à "${searchQuery}".`
                : 'Importez vos enregistrements de cours, tutoriels vidéo ou présentations.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-black font-black text-sm shadow-lg shadow-purple-500/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Importer une vidéo</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredVideos.map((vid) => {
              const isCurrent = playingVideo?.id === vid.id;
              const isChecked = selectedIds.includes(vid.id);

              return (
                <div
                  key={vid.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      if (isChecked) setSelectedIds(selectedIds.filter(id => id !== vid.id));
                      else setSelectedIds([...selectedIds, vid.id]);
                    } else {
                      setPlayingVideo(vid);
                    }
                  }}
                  className={`group relative rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none border ${
                    isCurrent
                      ? 'bg-[#151D33] border-purple-400 shadow-lg shadow-purple-500/10 scale-102'
                      : 'bg-[#0B0F1D] hover:bg-[#121828] border-white/10 hover:border-purple-400/40 shadow-sm'
                  }`}
                >
                  {/* Miniature Vidéo avec bouton Play overlay */}
                  <div className="relative w-full h-36 rounded-xl bg-black overflow-hidden flex items-center justify-center mb-2 border border-white/5">
                    <VideoCardPreview vid={vid} />

                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                      <div className="w-11 h-11 rounded-full bg-purple-500/80 group-hover:bg-purple-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {isSelectionMode && (
                      <div className="absolute top-2 left-2 z-20 text-purple-400">
                        {isChecked ? <CheckSquare className="w-5 h-5 fill-purple-500/20" /> : <Square className="w-5 h-5 text-slate-400" />}
                      </div>
                    )}
                  </div>

                  {/* Nom, Taille & Options */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors" title={vid.name}>
                        {vid.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {vid.size} • {vid.date}
                      </p>
                    </div>

                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMenuVideoId(menuVideoId === vid.id ? null : vid.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {menuVideoId === vid.id && (
                        <div className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-2xl bg-[#121828] border border-white/15 shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setPlayingVideo(vid);
                              setMenuVideoId(null);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Play className="w-3.5 h-3.5 text-purple-400" />
                            <span>Lire la vidéo</span>
                          </button>

                          {onOpenStudySpace && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenStudySpace(vid, 'Vidéos', videosList);
                                setMenuVideoId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Espace d'étude</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(vid)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span>{vid.isFavorite ? 'Retirer des favoris' : 'Favori'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(vid)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-400" />
                            <span>Télécharger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRenameVideo(vid)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Renommer</span>
                          </button>

                          {onOpenCreateShareLink && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenCreateShareLink([vid]);
                                setMenuVideoId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <Share2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>Partager le lien</span>
                            </button>
                          )}

                          <div className="h-px bg-white/10 my-1" />

                          <button
                            type="button"
                            onClick={() => handleDeleteVideo(vid)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 rounded-xl text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Corbeille</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-purple-500/40 text-purple-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
