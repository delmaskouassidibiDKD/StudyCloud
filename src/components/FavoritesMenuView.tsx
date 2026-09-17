import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Heart, Trash2, MoreVertical, X, FileText } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { getFileBlobUrl, deleteFileBlob, formatFileSize } from '../services/localFileStorage';

interface FavoritesMenuViewProps {
  onBack: () => void;
  setActivePreviewItem?: (item: any) => void;
}

interface FavoriteItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension?: string;
  url?: string;
  isImage?: boolean;
  matiere?: string;
  isFavorite?: boolean;
  importedAt?: number | string;
  createdAt?: number | string;
  timestamp?: number;
}

export const FavoritesMenuView: React.FC<FavoritesMenuViewProps> = ({ onBack, setActivePreviewItem }) => {
  const [favoriteFiles, setFavoriteFiles] = useState<FavoriteItem[]>(() => {
    const list: FavoriteItem[] = [];
    const seenIds = new Set<string>();

    const checkKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item && item.id && item.isFavorite && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              list.push({
                ...item,
                extension: item.extension || (item.name?.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
              });
            }
          });
        }
      } catch (e) {}
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
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Charger depuis Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getFiles(userId, undefined, undefined, true)
      .then(async (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          const filesWithUrls = await Promise.all(
            res.data.map(async (row: any) => {
              const localBlobUrl = await getFileBlobUrl(row.id);
              return {
                id: row.id,
                name: row.name,
                size: row.size || 0,
                type: row.type || 'Fichier',
                extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
                url: localBlobUrl || row.file_url || '',
                isFavorite: true,
                matiere: row.matiere_id && row.matiere_id !== 'Mes fichiers' ? row.matiere_id : '',
                importedAt: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                createdAt: row.created_at,
                timestamp: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
              };
            })
          );
          if (filesWithUrls.length > 0) {
            setFavoriteFiles(filesWithUrls);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleFavorite = (id: string) => {
    setFavoriteFiles((prev) => prev.filter((item) => item.id !== id));
    setOpenMenuId(null);

    StudyCloudAPI.toggleFileFavorite(id, false).catch(() => {});

    // Mettre à jour dans toutes les listes locales
    const updateLocalKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((item: any) => (item.id === id ? { ...item, isFavorite: false } : item));
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch (e) {}
    };

    updateLocalKey('unifolder_files_menu_items');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('unifolder_matiere_files_')) {
        updateLocalKey(k);
      }
    }
    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const handleDelete = (id: string) => {
    setFavoriteFiles((prev) => prev.filter((item) => item.id !== id));
    setOpenMenuId(null);
    deleteFileBlob(id);
    StudyCloudAPI.deleteFile(id).catch(() => {});

    const deleteFromLocalKey = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item: any) => item.id !== id);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch (e) {}
    };

    deleteFromLocalKey('unifolder_files_menu_items');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('unifolder_matiere_files_')) {
        deleteFromLocalKey(k);
      }
    }
    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const filtered = favoriteFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.matiere && f.matiere.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 pb-8 pt-0 overflow-y-auto transition-colors duration-300">
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

        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white bg-[#E8DFD0] dark:bg-[#070a13] px-3 py-1 rounded-lg border-2 border-[#2D4A3E] dark:border-[#1e293b] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none self-start">
          Mes Favoris
        </h1>

        <div className="flex items-center gap-2 pointer-events-auto self-start">
          {favoriteFiles.length > 0 && (
            <div className="flex items-center bg-white dark:bg-[#1e293b] rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] px-2.5 py-1 shadow-[1px_1px_0px_0px_#1c1917]">
              <Search className="w-3.5 h-3.5 text-stone-500 mr-1.5" />
              <input
                type="text"
                placeholder="Rechercher dans favoris..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-transparent outline-none w-28 sm:w-44 font-semibold text-stone-800 dark:text-white"
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
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 justify-items-center w-full">
            {filtered.map((f, idx) => {
              const ext = (f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')).toUpperCase();
              const isPdf = ext === 'PDF';
              const isWord = ext === 'DOC' || ext === 'DOCX';
              const isExcel = ext === 'XLS' || ext === 'XLSX' || ext === 'CSV';
              const isPpt = ext === 'PPT' || ext === 'PPTX';
              const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG'].includes(ext) || f.isImage;

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
                  className={`group flex flex-col items-center w-full max-w-[90px] sm:max-w-[110px] relative cursor-pointer hover:scale-105 transition-all ${
                    openMenuId === f.id ? 'z-50' : 'z-0'
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
                        {formatFileSize(f.size)}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
