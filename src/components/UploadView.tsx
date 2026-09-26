import React from 'react';
import { Upload, FolderPlus, Share2, Plus, X, MoreVertical, ArrowLeft } from 'lucide-react';
import { NavigationTab } from '../types';
import { FileIconBadge } from './FileIconBadge';

interface UploadViewProps {
  currentTab: NavigationTab;
  setTab: (tab: NavigationTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenUploadModal: () => void;
  onOpenAddMenu: () => void;
  onOpenClearConfirm: () => void;
  onOpenCreateShareLink: () => void;
  uploadedItems: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[];
  setUploadedItems: React.Dispatch<React.SetStateAction<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[]>>;
  selectedItemIds: string[];
  setSelectedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  setActivePreviewItem: (item: any) => void;
  activeLongPressItem: any;
  setActiveLongPressItem: (item: any) => void;
  handleFilesSelected: (e: React.ChangeEvent<HTMLInputElement>, category: string) => void;
  handleReplaceFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  replaceInputRef: React.RefObject<HTMLInputElement | null>;
  handleTouchStart: (item: any) => void;
  handleTouchMove: () => void;
  handleTouchEnd: () => void;
  handleSelectAll: () => void;
  setReplacingItemId: (id: string | null) => void;
  onFilesDropped?: (files: File[]) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  setTab,
  searchQuery,
  setSearchQuery,
  onOpenUploadModal,
  onOpenAddMenu,
  onOpenClearConfirm,
  onOpenCreateShareLink,
  uploadedItems,
  setUploadedItems,
  selectedItemIds,
  setSelectedItemIds,
  setActivePreviewItem,
  activeLongPressItem,
  setActiveLongPressItem,
  handleFilesSelected,
  handleReplaceFileSelected,
  replaceInputRef,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleSelectAll,
  setReplacingItemId,
  onFilesDropped,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onFilesDropped) {
        onFilesDropped(Array.from(e.dataTransfer.files));
      }
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col space-y-4 pb-24 pt-24 md:pt-24 animate-fadeIn min-h-screen relative transition-colors bg-[#E9D7C9] dark:bg-[#0b0f19] ${
        isDragging ? 'ring-4 ring-orange-500 ring-inset bg-orange-50/20' : ''
      }`}
    >
      {/* Fullscreen Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-stone-900/85 backdrop-blur-sm border-4 border-dashed border-orange-500 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-orange-500/20 border-2 border-orange-500 text-orange-400 flex items-center justify-center mb-4 shadow-xl animate-bounce">
            <Upload className="w-10 h-10 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-white drop-shadow-md">Déposez vos fichiers ou dossiers ici</h2>
          <p className="text-sm font-bold text-stone-300 mt-1">Tous les formats sont acceptés pour être importés dans votre espace de partage</p>
        </div>
      )}

      {/* Fixed Header for Upload Tab - Solid Dark #070a13 */}
      <div className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-[#E9D7C9] dark:bg-[#070a13] py-2 px-4 md:px-8 border-b-2 border-stone-800 dark:border-[#1e293b] shadow-sm space-y-1.5 transition-colors">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <label className="flex flex-col items-center justify-center bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-[#EBE5DA] dark:hover:bg-[#283852] text-stone-800 dark:text-white font-bold px-1.5 sm:px-2 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none text-[10px] cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
              <Upload className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mb-0.5" />
              <span className="leading-none">dossier</span>
              <input
                type="file"
                className="hidden"
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                onChange={(e) => handleFilesSelected(e, 'Dossier')}
              />
            </label>

            <label className="flex flex-col items-center justify-center bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-[#EBE5DA] dark:hover:bg-[#283852] text-stone-800 dark:text-white font-bold px-1.5 sm:px-2 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none text-[10px] cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
              <Upload className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mb-0.5" />
              <span className="leading-none">fichier</span>
              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleFilesSelected(e, 'Fichiers')}
              />
            </label>

            <label className="flex flex-col items-center justify-center bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-[#EBE5DA] dark:hover:bg-[#283852] text-stone-800 dark:text-white font-bold px-1.5 sm:px-2 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none text-[10px] cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
              <Upload className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mb-0.5" />
              <span className="leading-none">images</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelected(e, 'Images')}
              />
            </label>

            <label className="flex flex-col items-center justify-center bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-[#EBE5DA] dark:hover:bg-[#283852] text-stone-800 dark:text-white font-bold px-1.5 sm:px-2 py-1 rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none text-[10px] cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
              <Upload className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mb-0.5" />
              <span className="leading-none">son</span>
              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleFilesSelected(e, 'Son')}
              />
            </label>
          </div>

          <button
            onClick={uploadedItems.length > 0 ? onOpenClearConfirm : undefined}
            disabled={uploadedItems.length === 0}
            className={`flex items-center gap-1.5 font-bold text-xs px-3 py-2 rounded-xl border-2 transition-all shrink-0 select-none ${
              uploadedItems.length === 0
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 border-stone-400 dark:border-stone-700 cursor-not-allowed shadow-none opacity-60'
                : 'bg-orange-500 hover:bg-orange-600 text-white border-stone-800 dark:border-orange-400/40 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'
            }`}
            title={uploadedItems.length === 0 ? "Aucun élément importé pour créer un nouveau partage" : "Commencer un nouveau partage"}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Nouveau partage</span>
          </button>
        </div>

        {uploadedItems.length > 0 && (
          <div className="pt-1.5 pb-0.5 flex items-center justify-between border-t border-stone-200 max-w-7xl mx-auto w-full">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Éléments importés ({uploadedItems.length})
            </span>
            <button
              onClick={onOpenCreateShareLink}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 py-1 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Créer le lien de partage</span>
            </button>
          </div>
        )}
      </div>

      <div className={`flex-1 w-full overflow-y-auto px-4 md:px-8 pt-2 pb-4 ${uploadedItems.length === 0 ? 'flex flex-col items-center justify-center min-h-[70vh]' : ''}`}>
        {uploadedItems.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center my-auto">
            <button
              onClick={onOpenAddMenu}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFilesDropped) {
                  onFilesDropped(Array.from(e.dataTransfer.files));
                }
              }}
              className="w-36 h-36 sm:w-48 sm:h-48 border-3 border-dashed border-stone-400 hover:border-orange-500 bg-[#F5F1E9] hover:bg-orange-50/20 rounded-3xl flex flex-col items-center justify-center text-stone-600 hover:text-orange-600 transition-all group cursor-pointer shadow-[6px_6px_0px_0px_#1c1917]"
            >
              <Plus className="w-10 h-10 sm:w-12 sm:h-12 transition-transform group-hover:scale-110 mb-2" />
              <span className="text-sm sm:text-base font-extrabold">Ajouter</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mt-2">
            {uploadedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItemIds((prev) =>
                    prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                  );
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveLongPressItem(item);
                }}
                onTouchStart={() => handleTouchStart(item)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(item)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                style={{ WebkitTouchCallout: 'none' }}
                className={`aspect-square bg-[#2A2B2E] border rounded-2xl p-2.5 flex flex-col justify-between shadow-md hover:shadow-xl transition-all relative group cursor-pointer select-none ${
                  selectedItemIds.includes(item.id) ? 'border-orange-500 ring-2 ring-orange-500 bg-orange-950/30' : 'border-stone-800'
                }`}
              >
                <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden rounded-xl bg-[#1E1F22] relative mb-1.5">
                  {selectedItemIds.includes(item.id) && (
                    <div className="absolute top-1 right-1 z-25 w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs shadow-md">
                      ✓
                    </div>
                  )}
                  {item.isImage && item.url ? (
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-stone-300">
                      <FileIconBadge fileName={item.name} size={36} />
                    </div>
                  )}
                  {/* Options Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLongPressItem(activeLongPressItem?.id === item.id ? null : item);
                    }}
                    className="absolute top-1 left-1 w-5 h-5 bg-black/70 hover:bg-black text-stone-200 shadow-sm rounded-full flex items-center justify-center transition-colors cursor-pointer z-10"
                    title="Options"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedItems((prev) => prev.filter((i) => i.id !== item.id));
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-black text-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                    title="Supprimer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-stone-100 line-clamp-2 break-all leading-tight" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[8px] text-stone-400">
                    {(item.size / 1024).toFixed(1)} Ko
                  </p>
                </div>

                {/* Lightweight popover context menu attached to item */}
                {activeLongPressItem?.id === item.id && (
                  <>
                    <div 
                      className="fixed inset-0 z-20" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLongPressItem(null);
                      }} 
                    />
                    <div 
                      className="absolute z-30 top-12 left-2 w-44 bg-stone-900 rounded-xl shadow-2xl border border-stone-800 p-1 flex flex-col gap-0.5 text-stone-100 animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2.5 py-1.5 border-b border-stone-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-200 truncate">{item.name}</span>
                        <button onClick={() => setActiveLongPressItem(null)} className="text-stone-400 hover:text-stone-200">
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          handleSelectAll();
                          setActiveLongPressItem(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center bg-orange-950 text-orange-400 rounded text-[9px] font-bold">✓</span>
                        <span>Tout cocher</span>
                      </button>

                      <button
                        onClick={() => {
                          setReplacingItemId(item.id);
                          setActiveLongPressItem(null);
                          if (replaceInputRef.current) {
                            replaceInputRef.current.click();
                          }
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center bg-blue-950 text-blue-400 rounded text-[9px] font-bold">↻</span>
                        <span>Remplacer</span>
                      </button>

                      <button
                        onClick={() => {
                          setUploadedItems((prev) => prev.filter((i) => i.id !== item.id));
                          setActiveLongPressItem(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center bg-red-950 text-red-400 rounded text-[9px] font-bold">✕</span>
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <button
              onClick={onOpenAddMenu}
              className="aspect-square border border-dashed border-stone-300 hover:border-orange-500 bg-stone-50/50 hover:bg-orange-50/20 rounded-xl flex flex-col items-center justify-center text-stone-500 hover:text-orange-600 transition-all group cursor-pointer"
            >
              <Plus className="w-5 h-5 transition-transform group-hover:scale-110 mb-0.5" />
              <span className="text-[10px] font-medium">Ajouter</span>
            </button>
          </div>
        )}

        <input
          type="file"
          ref={replaceInputRef}
          className="hidden"
          onChange={handleReplaceFileSelected}
        />

        {/* Selection Action Floating Menu */}
        {selectedItemIds.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-stone-100 border border-stone-800 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <span className="text-xs font-bold text-stone-300">
              {selectedItemIds.length} sélectionné{selectedItemIds.length > 1 ? 's' : ''}
            </span>
            <div className="h-4 w-px bg-stone-700"></div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedItemIds([])}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Décocher
              </button>
              <button
                onClick={() => {
                  setUploadedItems((prev) => prev.filter((i) => !selectedItemIds.includes(i.id)));
                  setSelectedItemIds([]);
                }}
                className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {selectedItemIds.length > 1 ? 'Tout supprimer' : 'Supprimer'}
              </button>
            </div>
          </div>
        )}

        <div className="h-48 w-full shrink-0"></div>
      </div>
    </div>
  );
};
