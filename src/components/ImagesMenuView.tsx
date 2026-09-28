import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Image as ImageIcon,
  Plus,
  Trash2,
  MoreVertical,
  Star,
  Download,
  Share2,
  BookOpen,
  Edit2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckSquare,
  Square
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { getCachedMediaThumbnail } from '../services/mediaPreviewService';

interface ImagesMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export const ImagesMenuView: React.FC<ImagesMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  const [imagesList, setImagesList] = useState<FileItem[]>(() => {
    return CloudDataStore.getImages();
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Lightbox / Visualiseur d'images HD
  const [viewerImage, setViewerImage] = useState<FileItem | null>(null);
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string>('');
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);

  // Mode sélection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Menu déroulant
  const [menuImageId, setMenuImageId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement des images
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getImagesList()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setImagesList(data);
          CloudDataStore.setImages(data as any);
        }
      })
      .catch((err) => console.warn('[ImagesMenuView] Error fetching images:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Résoudre l'URL de l'image agrandie dans le visualiseur
  useEffect(() => {
    if (!viewerImage) {
      setViewerBlobUrl('');
      setViewerZoom(1);
      setViewerRotation(0);
      return;
    }

    let isMounted = true;
    const resolveUrl = async () => {
      let target = viewerImage.previewUrl || viewerImage.url || '';
      if (!target.startsWith('http') && !target.startsWith('blob:')) {
        const local = await getFileBlobUrl(viewerImage.id);
        if (local) target = local;
      }
      if (isMounted) setViewerBlobUrl(target);
    };

    resolveUrl();
    return () => {
      isMounted = false;
    };
  }, [viewerImage]);

  // Import d'images
  const handleImportImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    showToast(`Préparation de ${files.length} image(s)...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
        const comp = await compressFile(f, 'images');
        const fileId = `img-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        const item: FileItem = {
          id: fileId,
          name: f.name,
          category: 'images',
          source: 'Images',
          size: comp.originalSizeFormatted,
          sizeBytes: comp.originalSizeBytes,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          extension: ext.toUpperCase(),
          url: localBlobUrl,
          previewUrl: localBlobUrl,
          isImage: true
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setImagesList(prev => [...newItems, ...prev]);
    CloudDataStore.setImages([...newItems, ...imagesList] as any);

    // File d'attente d'upload cloud
    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'images' });

    showToast(`${newItems.length} image(s) importée(s) avec succès !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Suppression
  const handleDeleteImage = async (img: FileItem) => {
    setImagesList(prev => prev.filter(i => i.id !== img.id));
    if (viewerImage?.id === img.id) {
      setViewerImage(null);
    }

    const trashedItem = { ...img, originalCategory: 'images', isTrash: true };
    CloudDataStore.moveToTrash(trashedItem as any);
    await CloudStorageAPI.deleteImage(img.id).catch(() => {});
    showToast(`"${img.name}" déplacée dans la corbeille`);
    setMenuImageId(null);
  };

  // Favori
  const handleToggleFavorite = async (img: FileItem) => {
    const nextState = !img.isFavorite;
    setImagesList(prev =>
      prev.map(i => (i.id === img.id ? { ...i, isFavorite: nextState } : i))
    );
    await CloudStorageAPI.setFavorite(img.id, nextState).catch(() => {});
    showToast(nextState ? 'Ajoutée aux favoris ⭐' : 'Retirée des favoris');
    setMenuImageId(null);
  };

  // Renommer
  const handleRenameImage = async (img: FileItem) => {
    const newName = window.prompt("Nouveau nom de l'image :", img.name);
    if (!newName || !newName.trim() || newName.trim() === img.name) return;

    const trimmed = newName.trim();
    const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.${(img.extension || 'jpg').toLowerCase()}`;

    setImagesList(prev =>
      prev.map(i => (i.id === img.id ? { ...i, name: finalName } : i))
    );
    await CloudStorageAPI.updateImage(img.id, { name: finalName }).catch(() => {});
    showToast(`Image renommée en "${finalName}"`);
    setMenuImageId(null);
  };

  // Télécharger
  const handleDownload = async (img: FileItem) => {
    let url = img.previewUrl || img.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(img.id);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = img.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Téléchargement démarré...');
    }
    setMenuImageId(null);
  };

  // Navigation dans le visualiseur
  const handleNextImage = () => {
    if (!viewerImage || filteredImages.length === 0) return;
    const currentIndex = filteredImages.findIndex(i => i.id === viewerImage.id);
    const nextIndex = (currentIndex + 1) % filteredImages.length;
    setViewerImage(filteredImages[nextIndex]);
  };

  const handlePrevImage = () => {
    if (!viewerImage || filteredImages.length === 0) return;
    const currentIndex = filteredImages.findIndex(i => i.id === viewerImage.id);
    const prevIndex = (currentIndex - 1 + filteredImages.length) % filteredImages.length;
    setViewerImage(filteredImages[prevIndex]);
  };

  // Filtrage
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return imagesList;
    const q = searchQuery.toLowerCase().trim();
    return imagesList.filter(i => i.name.toLowerCase().includes(q));
  }, [imagesList, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* Input invisible pour l'import d'images */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportImages}
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif"
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU IMAGES */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Images */}
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
              <div className="p-2 rounded-xl bg-black border border-white/10 text-emerald-400">
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Images
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-400/80 leading-tight">
                  {imagesList.length} image{imagesList.length > 1 ? 's' : ''} disponible{imagesList.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Images */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-emerald-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une image, schéma, photo..."
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
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-emerald-400 border border-emerald-500/40 hover:border-emerald-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer une image"
            >
              <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
              <span className="hidden xs:inline">Importer image</span>
              <span className="xs:hidden">Importer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
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
        <div className="w-full bg-[#0F1424] border-b border-emerald-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredImages.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredImages.map(i => i.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2"
            >
              {selectedIds.length === filteredImages.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = imagesList.filter(i => selectedIds.includes(i.id));
                    toDelete.forEach(handleDeleteImage);
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
                      const first = imagesList.find(i => i.id === selectedIds[0]);
                      onOpenStudySpace(first, 'Images', imagesList);
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

      {/* VISUALISEUR D'IMAGE HD (MODAL LIGHTBOX) */}
      {viewerImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200">
          {/* Barre supérieure du visualiseur */}
          <div className="w-full flex items-center justify-between gap-3 bg-[#0A0E1A]/80 p-3 rounded-2xl border border-white/10">
            <div className="min-w-0 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-white truncate" title={viewerImage.name}>
                {viewerImage.name}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewerZoom(Math.max(0.5, viewerZoom - 0.25))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
                title="Zoom arrière"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-1.5 text-slate-400">
                {Math.round(viewerZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setViewerZoom(Math.min(3, viewerZoom + 0.25))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
                title="Zoom avant"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setViewerRotation((viewerRotation + 90) % 360)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 ml-1"
                title="Pivoter à 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleDownload(viewerImage)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-sky-400 ml-1"
                title="Télécharger l'image"
              >
                <Download className="w-4 h-4" />
              </button>

              {onOpenStudySpace && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenStudySpace(viewerImage, 'Images', imagesList);
                    setViewerImage(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold ml-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Espace d'étude</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewerImage(null)}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 ml-2"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image HD au centre avec flèches précédent/suivant */}
          <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden my-3">
            {viewerBlobUrl ? (
              <img
                src={viewerBlobUrl}
                alt={viewerImage.name}
                className="max-w-full max-h-[80vh] object-contain transition-transform duration-200 select-none shadow-2xl rounded-lg"
                style={{
                  transform: `scale(${viewerZoom}) rotate(${viewerRotation}deg)`
                }}
              />
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Chargement de l'image...</span>
              </div>
            )}

            {/* Boutons Flèches Navigation */}
            {filteredImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  className="absolute left-2 sm:left-4 p-3 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 shadow-2xl transition-transform active:scale-90"
                  title="Image précédente"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  className="absolute right-2 sm:right-4 p-3 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 shadow-2xl transition-transform active:scale-90"
                  title="Image suivante"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Pied du visualiseur avec pagination */}
          <div className="text-center text-xs font-semibold text-slate-400">
            {filteredImages.findIndex(i => i.id === viewerImage.id) + 1} / {filteredImages.length}
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL : GALERIE D'IMAGES */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de votre galerie d'images...</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-emerald-500/20 flex items-center justify-center mb-4 shadow-xl">
              <ImageIcon className="w-10 h-10 text-emerald-400 opacity-80 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucune image trouvée' : 'Aucune image disponible'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              {searchQuery
                ? `Aucune image ne correspond à "${searchQuery}".`
                : 'Importez vos photographies de cours, schémas scientifiques, captures ou illustrations.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Importer une image</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredImages.map((img) => {
              const isChecked = selectedIds.includes(img.id);

              return (
                <div
                  key={img.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      if (isChecked) setSelectedIds(selectedIds.filter(id => id !== img.id));
                      else setSelectedIds([...selectedIds, img.id]);
                    } else {
                      setViewerImage(img);
                    }
                  }}
                  className="group relative rounded-2xl p-2 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 hover:border-emerald-400/40 shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  {/* Miniature Image */}
                  <div className="relative w-full h-32 rounded-xl bg-black overflow-hidden flex items-center justify-center mb-2">
                    <img
                      src={img.previewUrl || img.url}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {isSelectionMode && (
                      <div className="absolute top-2 left-2 z-20 text-emerald-400">
                        {isChecked ? <CheckSquare className="w-5 h-5 fill-emerald-500/20" /> : <Square className="w-5 h-5 text-white/70" />}
                      </div>
                    )}
                  </div>

                  {/* Nom, Taille & Options */}
                  <div className="flex items-center justify-between gap-1.5 px-1">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors" title={img.name}>
                        {img.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {img.size} • {img.date}
                      </p>
                    </div>

                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMenuImageId(menuImageId === img.id ? null : img.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {menuImageId === img.id && (
                        <div className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-2xl bg-[#121828] border border-white/15 shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setViewerImage(img);
                              setMenuImageId(null);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Voir en grand</span>
                          </button>

                          {onOpenStudySpace && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenStudySpace(img, 'Images', imagesList);
                                setMenuImageId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Espace d'étude</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(img)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span>{img.isFavorite ? 'Retirer des favoris' : 'Favori'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(img)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-400" />
                            <span>Télécharger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRenameImage(img)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Renommer</span>
                          </button>

                          {onOpenCreateShareLink && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenCreateShareLink([img]);
                                setMenuImageId(null);
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
                            onClick={() => handleDeleteImage(img)}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
