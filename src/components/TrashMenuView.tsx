import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Download,
  FolderArchive,
  Check,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { deleteFileBlob } from '../services/localFileStorage';
import { FileItem } from './Page1FilesMenuView';

interface TrashMenuViewProps {
  onBack: () => void;
}

export const TrashMenuView: React.FC<TrashMenuViewProps> = ({ onBack }) => {
  const [trashList, setTrashList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().trash || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'documents' | 'images' | 'videos' | 'audio' | 'classeur'>('all');

  // Mode sélection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modale de confirmation "Vider la corbeille"
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement des fichiers de la corbeille
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getTrashFiles()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setTrashList(data);
          CloudDataStore.setTrashFiles(data as any);
        }
      })
      .catch((err) => console.warn('[TrashMenuView] Error fetching trash:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Restaurer un fichier
  const handleRestore = async (file: FileItem) => {
    setTrashList(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.restoreFromTrash(file as any);
    await CloudStorageAPI.restoreTrashItem(file.id).catch(() => {});
    showToast(`"${file.name}" a été restauré dans ${file.originalCategory || 'son menu'}`);
  };

  // Supprimer définitivement un fichier
  const handleDeletePermanently = async (file: FileItem) => {
    setTrashList(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.removeFile(file.id);
    deleteFileBlob(file.id).catch(() => {});
    await CloudStorageAPI.deleteTrashPermanently([file.id]).catch(() => {});
    showToast(`"${file.name}" a été supprimé définitivement`);
  };

  // Vider toute la corbeille
  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      const allIds = trashList.map(f => f.id);
      setTrashList([]);
      CloudDataStore.emptyTrash();
      allIds.forEach(id => deleteFileBlob(id).catch(() => {}));
      await CloudStorageAPI.emptyTrash().catch(() => {});
      showToast('La corbeille a été vidée avec succès');
      setIsConfirmEmptyOpen(false);
    } catch (e) {
      showToast('Erreur lors du vidage de la corbeille');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restaurer la sélection
  const handleRestoreSelected = async () => {
    const toRestore = trashList.filter(f => selectedIds.includes(f.id));
    for (const f of toRestore) {
      await handleRestore(f);
    }
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // Supprimer définitivement la sélection
  const handleDeleteSelected = async () => {
    const toDelete = trashList.filter(f => selectedIds.includes(f.id));
    for (const f of toDelete) {
      await handleDeletePermanently(f);
    }
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // Filtrage
  const filteredTrash = useMemo(() => {
    let list = trashList;

    if (activeFilter !== 'all') {
      list = list.filter(f => {
        const cat = f.originalCategory || f.category;
        return cat === activeFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }

    return list;
  }, [trashList, activeFilter, searchQuery]);

  // Icône par type
  const getFileIcon = (file: FileItem) => {
    const cat = file.originalCategory || file.category;
    if (cat === 'images' || file.isImage) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (cat === 'videos' || file.isVideo) return <Film className="w-5 h-5 text-purple-400" />;
    if (cat === 'audio' || file.isAudio) return <Music className="w-5 h-5 text-amber-400" />;
    if (cat === 'classeur') return <FolderArchive className="w-5 h-5 text-orange-400" />;
    return <FileText className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU CORBEILLE */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Corbeille */}
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
              <div className="p-2 rounded-xl bg-black border border-white/10 text-red-400">
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Corbeille
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-red-400/80 leading-tight">
                  {trashList.length} élément{trashList.length > 1 ? 's' : ''} supprimé{trashList.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Corbeille */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-red-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans la corbeille..."
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

          {/* DROITE : Bouton Vider la corbeille et Actions */}
          <div className="shrink-0 flex items-center gap-2">
            {trashList.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 transition-all cursor-pointer active:scale-95 shadow-sm text-xs sm:text-sm font-bold"
                title="Vider définitivement tous les éléments"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden xs:inline">Vider la corbeille</span>
                <span className="xs:hidden">Vider</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-red-500 text-white border-red-400 font-bold'
                  : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
              }`}
              title={isSelectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE RAPIDE */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'documents', label: 'Documents' },
            { id: 'images', label: 'Images' },
            { id: 'videos', label: 'Vidéos' },
            { id: 'audio', label: 'Audio' },
            { id: 'classeur', label: 'Classeur' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : 'bg-[#10162A] text-slate-300 hover:text-white hover:bg-[#192242] border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* BANDEAU DE SÉLECTION MULTIPLE */}
      {isSelectionMode && (
        <div className="w-full bg-[#0F1424] border-b border-red-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-red-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredTrash.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredTrash.map(f => f.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2"
            >
              {selectedIds.length === filteredTrash.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleRestoreSelected}
                  className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1 font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurer ({selectedIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 rounded-lg flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer définitivement ({selectedIds.length})</span>
                </button>
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

      {/* CONTENU PRINCIPAL : LISTE DE LA CORBEILLE */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-red-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de la corbeille...</p>
          </div>
        ) : filteredTrash.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-red-500/20 flex items-center justify-center mb-4 shadow-xl">
              <Trash2 className="w-10 h-10 text-red-400 opacity-60 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucun élément trouvé' : 'La corbeille est vide'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {searchQuery
                ? `Aucun élément de la corbeille ne correspond à "${searchQuery}".`
                : 'Les fichiers supprimés depuis vos différents menus apparaîtront ici. Vous pourrez les restaurer à tout moment.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 text-xs font-bold text-slate-400">
              <span>{filteredTrash.length} élément(s)</span>
              <span className="hidden sm:inline">Restaurer pour renvoyer dans le dossier d'origine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredTrash.map((file) => {
                const isChecked = selectedIds.includes(file.id);

                return (
                  <div
                    key={file.id}
                    className="group rounded-2xl p-3 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 hover:border-red-400/30 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isSelectionMode ? (
                        <div
                          className="shrink-0 text-red-400 cursor-pointer"
                          onClick={() => {
                            if (isChecked) setSelectedIds(selectedIds.filter(id => id !== file.id));
                            else setSelectedIds([...selectedIds, file.id]);
                          }}
                        >
                          {isChecked ? <CheckSquare className="w-5 h-5 fill-red-500/20" /> : <Square className="w-5 h-5 text-slate-500" />}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 shrink-0">
                          {getFileIcon(file)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={file.name}>
                          {file.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          Origine : <span className="capitalize text-slate-300 font-semibold">{file.originalCategory || file.category}</span> • {file.size}
                        </p>
                      </div>
                    </div>

                    {/* Actions directes : Restaurer & Supprimer définitivement */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore(file)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95"
                        title="Restaurer à son emplacement d'origine"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Restaurer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePermanently(file)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold transition-all active:scale-95"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Supprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE CONFIRMATION VIDER LA CORBEILLE */}
      {isConfirmEmptyOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-[#0D1222] border border-red-500/30 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Vider toute la corbeille ?</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Cette action supprimera définitivement les <span className="font-bold text-white">{trashList.length}</span> élément(s). Ils ne pourront plus être restaurés.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                {isProcessing ? 'Suppression...' : 'Oui, vider définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-red-500/40 text-red-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
