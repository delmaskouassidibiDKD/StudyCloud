import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Heart, Trash2, MoreVertical, X, Eye, EyeOff, Download, Star, Menu } from 'lucide-react';
import { StudyCloudAPI, getWorkerApiUrl } from '../services/api';
import { getFileBlob, getFileBlobUrl, deleteFileBlob, formatFileSize } from '../services/localFileStorage';
import { safeLocalStorageSet } from '../utils/safeStorage';
import { invalidateCloudQueries } from '../services/queryClient';
import { DocumentCardPreview } from './DocumentCardPreview';
import { ImageCardPreview } from './ImageCardPreview';
import { getDocumentTheme } from './FilesMenuView';

interface HomeFavoritesMenuViewProps {
  onBack: () => void;
  setActivePreviewItem?: (item: any) => void;
}

interface FavoriteItem {
  id: string;
  name: string;
  size: number | string;
  type: string;
  extension?: string;
  url?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  r2Key?: string;
  category?: string;
  sourceCategory?: string;
  originalCategory?: string;
  content?: string;
  metadata?: any;
  isImage?: boolean;
  matiere?: string;
  isFavorite?: boolean;
  importedAt?: number | string;
  createdAt?: number | string;
  timestamp?: number;
}

const isFolderFavoriteItem = (item: any): boolean => {
  if (!item) return false;
  const isTxtNote = (item.name || '').toLowerCase().endsWith('.txt');
  const cat = (item.category || '').toLowerCase();
  const origCat = (item.originalCategory || item.original_category || '').toLowerCase();
  const srcCat = (item.sourceCategory || item.source_category || '').toLowerCase();
  return (
    Boolean(item.isFolder) ||
    cat === 'classeur_folder' ||
    cat === 'folder' ||
    origCat === 'classeur_folder' ||
    srcCat === 'classeur_folder' ||
    Boolean(item.model) ||
    (cat === 'classeur' && !isTxtNote)
  );
};

const loadLocalFavorites = (): FavoriteItem[] => {
  const list: FavoriteItem[] = [];
  const seenIds = new Set<string>();

  const checkKey = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item && item.id && item.isFavorite && !isFolderFavoriteItem(item) && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            list.push({
              ...item,
              extension: item.extension || (item.name?.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
            });
          }
        });
      }
    } catch {}
  };

  checkKey('unifolder_files_menu_items');
  checkKey('unifolder_study_imported_files');
  checkKey('unifolder_left_menu_general_imports');

  // Vérifier les clés des matières
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('unifolder_matiere_files_')) {
      checkKey(k);
    }
  }

  return list;
};

export const HomeFavoritesMenuView: React.FC<HomeFavoritesMenuViewProps> = ({ onBack, setActivePreviewItem }) => {
  const [favoriteFiles, setFavoriteFiles] = useState<FavoriteItem[]>(() => loadLocalFavorites());

  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Mode aperçu (cartes avec miniature comme Mes fichiers / Image 2) activé par défaut vs Mode compact
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('studycloud_favorites_preview_mode_v2');
    if (saved !== null) {
      return saved === 'true';
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('studycloud_favorites_preview_mode_v2', String(isPreviewMode));
  }, [isPreviewMode]);

  const handleDownload = async (fileUrl: string | undefined, fileName: string, fileId?: string) => {
    try {
      let targetBlob: Blob | null = null;
      if (fileId) {
        targetBlob = await getFileBlob(fileId).catch(() => null);
      }
      if (!targetBlob && fileUrl) {
        const response = await fetch(fileUrl).catch(() => null);
        if (response && response.ok) {
          targetBlob = await response.blob();
        }
      }
      if (!targetBlob && fileId) {
        const blobUrl = await getFileBlobUrl(fileId).catch(() => null);
        if (blobUrl) {
          const response = await fetch(blobUrl).catch(() => null);
          if (response && response.ok) {
            targetBlob = await response.blob();
          }
        }
      }
      if (!targetBlob && fileId) {
        const streamUrl = `${getWorkerApiUrl().replace(/\/+$/, '')}/api/cloud/stream/${encodeURIComponent(fileId)}`;
        const response = await fetch(streamUrl).catch(() => null);
        if (response && response.ok) {
          targetBlob = await response.blob();
        }
      }
      if (targetBlob) {
        const url = URL.createObjectURL(targetBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (fileUrl) {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Erreur lors du téléchargement:', err);
    }
  };

  // Charger depuis Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || '';
    if (!userId || userId === 'default-user') {
      setFavoriteFiles([]);
      return;
    }
    const fetchRemoteFavorites = () => {
      StudyCloudAPI.getFiles(userId, undefined, undefined, true)
        .then((res) => {
          if (res && res.success && Array.isArray(res.data)) {
            const filesWithUrls = res.data
              .filter((row: any) => !isFolderFavoriteItem({
                ...row,
                isFolder: row.is_folder ?? row.isFolder ?? row.metadata?.isFolder,
                originalCategory: row.original_category ?? row.originalCategory,
                sourceCategory: row.source_category ?? row.sourceCategory,
                model: row.model ?? row.metadata?.model,
              }))
              .map((row: any) => ({
                id: row.id,
                name: row.name,
                size: row.size || 0,
                type: row.type || 'Fichier',
                extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
                url: row.file_url || '',
                previewUrl: row.preview_url || row.file_url || '',
                thumbnailUrl: row.thumbnail_url || '',
                r2Key: row.r2_key || undefined,
                category: row.category || undefined,
                sourceCategory: row.source_category || row.category || undefined,
                originalCategory: row.original_category || undefined,
                content: row.content || undefined,
                metadata: row.metadata || undefined,
                isFavorite: true,
                matiere: row.matiere_id && row.matiere_id !== 'Mes fichiers' ? row.matiere_id : '',
                importedAt: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                createdAt: row.created_at,
                timestamp: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
              }));
            setFavoriteFiles(filesWithUrls);
          } else {
            setFavoriteFiles([]);
          }
        })
        .catch(() => { });
    };

    fetchRemoteFavorites();

    const handleReload = () => {
      const list = loadLocalFavorites();
      if (list.length > 0) {
        setFavoriteFiles(list);
      }
      fetchRemoteFavorites();
    };

    window.addEventListener('unifolder_files_updated', handleReload);
    window.addEventListener('unifolder_data_restored', handleReload);
    return () => {
      window.removeEventListener('unifolder_files_updated', handleReload);
      window.removeEventListener('unifolder_data_restored', handleReload);
    };
  }, []);

  const handleToggleFavorite = (id: string) => {
    setFavoriteFiles((prev) => prev.filter((item) => item.id !== id));
    setOpenMenuId(null);

    StudyCloudAPI.toggleFileFavorite(id, false).catch(() => { });

    // Mettre à jour dans toutes les listes locales
    const updateLocalKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((item: any) => (item.id === id ? { ...item, isFavorite: false } : item));
          safeLocalStorageSet(key, updated);
        }
      } catch {}
    };

    updateLocalKey('unifolder_files_menu_items');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('unifolder_matiere_files_')) {
        updateLocalKey(k);
      }
    }

    invalidateCloudQueries.favorites();
    invalidateCloudQueries.filesMenu();
    invalidateCloudQueries.overview();

    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const handleDelete = (id: string) => {
    setFavoriteFiles((prev) => prev.filter((item) => item.id !== id));
    setOpenMenuId(null);
    deleteFileBlob(id);
    StudyCloudAPI.deleteFile(id).catch(() => { });

    const deleteFromLocalKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item: any) => item.id !== id);
          safeLocalStorageSet(key, filtered);
        }
      } catch {}
    };

    deleteFromLocalKey('unifolder_files_menu_items');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('unifolder_matiere_files_')) {
        deleteFromLocalKey(k);
      }
    }

    invalidateCloudQueries.favorites();
    invalidateCloudQueries.filesMenu();
    invalidateCloudQueries.overview();

    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const filtered = favoriteFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.matiere && f.matiere.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div
      onClick={() => setOpenMenuId(null)}
      className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 pb-8 pt-0 overflow-y-auto transition-colors duration-300"
    >
      {/* Top Header Bar */}
      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-start justify-between z-40 pointer-events-none gap-2">
        <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
            <span>Retour</span>
          </button>
        </div>

        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white bg-[#E8DFD0] dark:bg-[#070a13] px-3 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs self-start">
          Mes Favoris
        </h1>

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto self-start">
          {/* Bouton œil pour basculer entre aperçu (par défaut) et mode compact sans aperçu */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPreviewMode((prev) => !prev);
            }}
            className={`p-1.5 rounded-xl border-2 shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center shrink-0 ${isPreviewMode
                ? 'bg-amber-400 text-stone-900 border-amber-600'
                : 'bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white border-[#2D4A3E] dark:border-[#334155]'
              }`}
            title={isPreviewMode ? "Mode aperçu actif (cliquez pour passer en mode compact sans aperçu)" : "Mode compact sans aperçu (cliquez pour passer en mode aperçu)"}
          >
            {isPreviewMode ? (
              <Eye className="w-3.5 h-3.5 stroke-[2.4]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
          </button>

          {favoriteFiles.length > 0 && (
            <div className="flex items-center bg-white dark:bg-[#1e293b] rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] px-2 sm:px-2.5 py-1 shadow-[1px_1px_0px_0px_#1c1917]">
              <Search className="w-3.5 h-3.5 text-stone-500 mr-1.5 shrink-0" />
              <input
                type="text"
                placeholder="Rechercher dans favoris..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-transparent outline-none w-24 sm:w-44 font-semibold text-stone-800 dark:text-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 text-stone-400 hover:text-stone-700">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full px-2 sm:px-4 pt-11 sm:pt-12">
        <div className="pt-1 pb-64 w-full max-w-7xl mx-auto">
          {favoriteFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-900 flex items-center justify-center text-rose-500 mb-4 shadow-sm">
                <Heart className="w-8 h-8 opacity-60" />
              </div>
              <h3 className="text-base font-extrabold text-[#2D4A3E] dark:text-white mb-1">
                Aucun favori pour l'instant
              </h3>
              <p className="text-xs text-[#5C6B5A] dark:text-slate-400 leading-relaxed">
                Pour ajouter un fichier en favori, cliquez sur les options (•••) d'un fichier dans « Mes fichiers » ou dans une matière, puis choisissez « Ajouter aux favoris ».
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-lg font-bold text-[#2D4A3E] dark:text-white mb-1">Aucun résultat</h2>
              <p className="text-xs text-[#5C6B5A] dark:text-slate-400">Aucun fichier favori ne correspond à votre recherche "{searchQuery}".</p>
            </div>
          ) : (
            <div className="w-full">
              {isPreviewMode ? (
                /* Grille en mode aperçu (identique à Mes fichiers / Image 2, activée par défaut) */
                <div className="grid gap-2 sm:gap-3.5 justify-items-stretch w-full grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filtered.map((f, idx) => {
                    const ext = (f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')).toUpperCase();
                    const isImg = f.isImage || ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF', 'BMP', 'AVIF'].includes(ext);
                    const theme = getDocumentTheme(ext);
                    const formattedSize = typeof f.size === 'number' ? formatFileSize(f.size) : (f.size || '0 Ko');
                    const isMenuOpen = openMenuId === f.id;

                    return (
                      <div
                        key={f.id || idx}
                        style={{ background: theme.bg }}
                        onClick={() => {
                          setActivePreviewItem && setActivePreviewItem({ ...f, folderName: f.matiere || 'Favoris' });
                        }}
                        className={`aspect-[3/4] ${theme.border} rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none cursor-pointer hover:scale-[1.01] shadow-md active:scale-98 ${isMenuOpen ? 'z-50 overflow-visible' : 'z-10 overflow-hidden'
                          }`}
                      >
                        {/* Barre supérieure : Bouton 3 traits, Étoile favori & Taille */}
                        <div className="flex items-center justify-between gap-1 z-20 relative">
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(isMenuOpen ? null : f.id);
                                }}
                                className="p-1 sm:p-1.2 rounded-lg bg-black/40 hover:bg-black/70 text-white border border-white/20 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-sm"
                                title="Options"
                              >
                                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
                              </button>

                              {isMenuOpen && (
                                <div
                                  className="absolute top-8 left-0 z-50 bg-white text-stone-800 rounded-xl shadow-2xl border-2 border-stone-800 py-1.5 w-44 text-xs font-semibold animate-fadeIn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFavorite(f.id)}
                                    className="w-full text-left px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-600 transition-colors border-b border-stone-200 cursor-pointer"
                                  >
                                    <Heart className="w-3.5 h-3.5 fill-rose-500" />
                                    <span>Retirer des favoris</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDownload(f.url, f.name, f.id);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-stone-100 flex items-center gap-2 text-stone-700 transition-colors border-b border-stone-200 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Télécharger</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(f.id)}
                                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Supprimer</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(f.id);
                              }}
                              className="p-0.5 rounded bg-black/60 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm hover:bg-black/80 cursor-pointer transition-colors"
                              title="Retirer des favoris"
                            >
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            </button>
                          </div>

                          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
                            {formattedSize}
                          </span>
                        </div>

                        {/* Corps de carte / aperçu réel du document ou de l'image */}
                        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
                          {isImg ? (
                            <div className="w-full h-full relative overflow-hidden rounded-md bg-stone-100 flex items-center justify-center">
                              <ImageCardPreview img={f as any} className="w-full h-full object-cover select-none" alt={f.name} />
                              <div className="absolute inset-x-0 bottom-0 py-0.5 px-1 bg-black/60 backdrop-blur-xs flex items-center justify-between text-[7px] text-white font-bold">
                                <span className="truncate max-w-[80%]">{f.name}</span>
                                <span className="uppercase text-[6.5px] bg-white/20 px-1 rounded">{ext}</span>
                              </div>
                            </div>
                          ) : (
                            <DocumentCardPreview doc={{ ...f, size: formattedSize } as any} />
                          )}
                        </div>

                        {/* Titre & Matière */}
                        <div className="px-0.5 mb-1">
                          <p className="text-[8px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={f.name}>
                            {f.name}
                          </p>
                          {f.matiere && (
                            <span className="inline-block text-[7.5px] font-extrabold uppercase tracking-wider text-amber-200 bg-black/40 rounded px-1 py-0.2 mt-0.5 max-w-full truncate">
                              {f.matiere}
                            </span>
                          )}
                        </div>

                        {/* Pied de carte : badge type + bouton télécharger */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
                          <span className={`text-[6.5px] sm:text-[8px] font-black px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
                            {theme.typeBadge}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(f.url, f.name, f.id);
                            }}
                            className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
                            title="Télécharger"
                          >
                            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Grille en mode compact (cartes minuscules sans aperçu) */
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 justify-items-center w-full">
                  {filtered.map((f, idx) => {
                    const ext = (f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')).toUpperCase();
                    const isPdf = ext === 'PDF';
                    const isWord = ext === 'DOC' || ext === 'DOCX';
                    const isExcel = ext === 'XLS' || ext === 'XLSX' || ext === 'CSV';
                    const isPpt = ext === 'PPT' || ext === 'PPTX';
                    const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG'].includes(ext) || f.isImage;
                    const formattedSize = typeof f.size === 'number' ? formatFileSize(f.size) : (f.size || '0 Ko');

                    let bgColor = 'bg-stone-700';
                    if (isPdf) bgColor = 'bg-red-500';
                    else if (isWord) bgColor = 'bg-blue-600';
                    else if (isExcel) bgColor = 'bg-emerald-600';
                    else if (isPpt) bgColor = 'bg-orange-500';
                    else if (isImg) bgColor = 'bg-purple-600';

                    return (
                      <div
                        key={f.id || idx}
                        onClick={() => {
                          setActivePreviewItem && setActivePreviewItem({ ...f, folderName: f.matiere || 'Favoris' });
                        }}
                        className={`group flex flex-col items-center w-full max-w-[90px] sm:max-w-[110px] relative cursor-pointer hover:scale-105 transition-all ${openMenuId === f.id ? 'z-50' : 'z-0'
                          }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === f.id ? null : f.id);
                          }}
                          className="absolute top-1 left-1 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-md cursor-pointer"
                          title="Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === f.id && (
                          <div
                            className="absolute top-9 left-0 z-50 bg-white text-stone-800 rounded-xl shadow-2xl border-2 border-stone-800 py-1.5 w-44 text-xs font-semibold animate-fadeIn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleToggleFavorite(f.id)}
                              className="w-full text-left px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-600 transition-colors border-b border-stone-200 cursor-pointer"
                            >
                              <Heart className="w-3.5 h-3.5 fill-rose-500" />
                              <span>Retirer des favoris</span>
                            </button>
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer</span>
                            </button>
                          </div>
                        )}

                        <div
                          className={`w-full aspect-[3/4] ${bgColor} rounded-xl shadow-[3px_3px_0px_0px_#1c1917] flex flex-col items-center justify-between p-3 text-white relative overflow-hidden transition-all group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_#1c1917]`}
                        >
                          {/* Badge coeur rouge favori */}
                          <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-white text-rose-600 border border-stone-800 flex items-center justify-center text-xs shadow-xs">
                            ❤️
                          </div>

                          {isImg && f.url ? (
                            <div className="absolute inset-0 w-full h-full bg-white overflow-hidden flex items-center justify-center z-0">
                              <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <>
                              <div className="absolute top-0 right-0 w-8 h-8 bg-black/15 rounded-bl-xl pointer-events-none"></div>
                              <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-r-[16px] border-t-transparent border-r-white/30"></div>
                              <div className="my-auto text-center pt-2">
                                <span className="text-sm sm:text-lg font-black tracking-wider uppercase drop-shadow">{ext.slice(0, 4)}</span>
                              </div>
                            </>
                          )}

                          <div className="mt-auto z-10 self-center mb-1">
                            <span className="text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">
                              {formattedSize}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] font-bold text-[#2D4A3E] dark:text-white mt-2 text-center px-1 leading-tight line-clamp-2 break-all w-full">
                          {f.name}
                        </span>

                        {f.matiere && (
                          <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-[#2D4A3E] dark:text-orange-300 bg-[#E8DFD0] dark:bg-[#1e293b] border border-[#2D4A3E]/40 dark:border-[#334155] rounded px-1.5 py-0.5 mt-1 max-w-[95%] truncate shadow-[1px_1px_0px_0px_#2D4A3E] dark:shadow-none">
                            {f.matiere}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
