import React, { useEffect, useState } from 'react';
import { Upload, File as FileIcon, MoreVertical, Trash2, CheckSquare, Square, Check, X, Plus, Search } from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { AssistantChat } from './AssistantChat';
import { FileIconBadge } from './FileIconBadge';

interface LeftMenuProps {
  isCenterFullscreen: boolean;
  isRightFullscreen: boolean;
  mobilePreviewTab: number;
  isAssistantOpen: boolean;
  setIsAssistantOpen: (v: boolean) => void;
  setIsResizingLeft: (v: boolean) => void;
  activeFolderTitle?: string;
  onImportFile?: () => void;
  activePreviewItem?: any;
  setActivePreviewItem?: (item: any) => void;
  activeFolderDetail?: any;
}

export function LeftMenu({
  isCenterFullscreen,
  isRightFullscreen,
  mobilePreviewTab,
  isAssistantOpen,
  setIsAssistantOpen,
  setIsResizingLeft,
  activeFolderTitle,
  onImportFile,
  activePreviewItem,
  setActivePreviewItem,
  activeFolderDetail
}: LeftMenuProps) {
  const [menuFiles, setMenuFiles] = useState<any[]>([]);
  const [viewHistory, setViewHistory] = useState<string[]>([]);
  const [sessionImportedIds, setSessionImportedIds] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [itemsPerRow, setItemsPerRow] = useState(2);
  const [chatKey, setChatKey] = useState(0);
  const [hasChatMessages, setHasChatMessages] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [attachedResources, setAttachedResources] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        // width minus padding (32px). Item is 105px, gap is 12px.
        const available = width - 32;
        const n = Math.floor((available + 12) / 117);
        setItemsPerRow(Math.max(1, n));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleAutoPrompt = () => setIsAssistantOpen(true);
    window.addEventListener('auto-prompt', handleAutoPrompt);
    return () => window.removeEventListener('auto-prompt', handleAutoPrompt);
  }, [setIsAssistantOpen]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const newFile = {
      id: Date.now().toString(),
      name: file.name,
      type: 'file',
      size: file.size,
      date: new Date().toLocaleDateString('fr-FR'),
      extension: file.name.split('.').pop()?.toUpperCase() || 'FICHIER',
      isImage: file.type.startsWith('image/'),
      url: URL.createObjectURL(file),
      isLeftMenuImport: true
    };
    
    // Save to localStorage
    if (activePreviewItem?.folderName || activeFolderDetail?.title) {
      const folder = activePreviewItem?.folderName || activeFolderDetail?.title;
      const storageKey = `unifolder_matiere_files_${folder}`;
      const saved = localStorage.getItem(storageKey);
      let parsed = [];
      if (saved) {
        try { parsed = JSON.parse(saved); } catch (err) {}
      }
      parsed.push(newFile);
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    }
    
    setMenuFiles(prev => [newFile, ...prev]);
    setSessionImportedIds(prev => [...prev, newFile.id]);
    
    if (setActivePreviewItem) {
      setActivePreviewItem({ ...newFile, folderName: activePreviewItem?.folderName || activeFolderDetail?.title });
      setViewHistory(prev => [newFile.id, ...prev.filter(id => id !== newFile.id)]);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteImportedFile = (fileId: string) => {
    setMenuFiles(prev => prev.filter(f => f.id !== fileId));
    setSessionImportedIds(prev => prev.filter(id => id !== fileId));
    
    // Update localStorage
    if (activePreviewItem?.folderName || activeFolderDetail?.title) {
      const folder = activePreviewItem?.folderName || activeFolderDetail?.title;
      const storageKey = `unifolder_matiere_files_${folder}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const newParsed = parsed.filter((f: any) => f.id !== fileId);
          localStorage.setItem(storageKey, JSON.stringify(newParsed));
        } catch (err) {}
      }
    }
    
    if (activePreviewItem?.id === fileId && setActivePreviewItem) {
      setActivePreviewItem(null);
    }
    setOpenMenuId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    
    setMenuFiles(prev => prev.filter(f => !selectedIds.includes(f.id)));
    setSessionImportedIds(prev => prev.filter(id => !selectedIds.includes(id)));
    
    // Update localStorage
    if (activePreviewItem?.folderName || activeFolderDetail?.title) {
      const folder = activePreviewItem?.folderName || activeFolderDetail?.title;
      const storageKey = `unifolder_matiere_files_${folder}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const newParsed = parsed.filter((f: any) => !selectedIds.includes(f.id));
          localStorage.setItem(storageKey, JSON.stringify(newParsed));
        } catch (err) {}
      }
    }
    
    if (activePreviewItem && selectedIds.includes(activePreviewItem.id) && setActivePreviewItem) {
      setActivePreviewItem(null);
    }
    
    setIsSelectionMode(false);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
  };

  const sortFilesByHistory = (a: any, b: any) => {
    const isASelected = a.id === activePreviewItem?.id;
    const isBSelected = b.id === activePreviewItem?.id;
    if (isASelected) return -1;
    if (isBSelected) return 1;

    const indexA = viewHistory.indexOf(a.id);
    const indexB = viewHistory.indexOf(b.id);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return 0;
  };

  const reorderForHorizontalGrid = (files: any[]) => {
    const result = [];
    const cols = itemsPerRow;
    const chunkSize = cols * 2;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      
      for (let col = 0; col < cols; col++) {
         result.push(chunk[col] || { id: `dummy-${i}-row1-${col}`, isDummy: true }); // Row 1
         result.push(chunk[col + cols] || { id: `dummy-${i}-row2-${col}`, isDummy: true }); // Row 2
      }
    }
    return result;
  };

  const renderFileGroup = (files: any[], isHorizontal: boolean = false, isImportedSection: boolean = false) => {
    const sortedFiles = [...files].sort((a, b) => {
      const aIsActive = activePreviewItem?.id === a.id;
      const bIsActive = activePreviewItem?.id === b.id;
      const aIsAttached = attachedResources.some(res => res.id === a.id);
      const bIsAttached = attachedResources.some(res => res.id === b.id);
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      if (aIsAttached && !bIsAttached) return -1;
      if (!aIsAttached && bIsAttached) return 1;
      
      return 0;
    });

    const itemsToRender = isHorizontal ? reorderForHorizontalGrid(sortedFiles) : sortedFiles;
    return itemsToRender.map((f) => {
      if (f.isDummy) {
        return <div key={f.id} className="w-[105px] h-[1px] pointer-events-none opacity-0 shrink-0"></div>;
      }
      const ext = f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      const isPdf = ext === 'PDF';
      const isWord = ext === 'DOC' || ext === 'DOCX';
      const isExcel = ext === 'XLS' || ext === 'XLSX';
      const isImage = ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(ext);
      const isActive = activePreviewItem?.id === f.id;
      const isSelected = selectedIds.includes(f.id);
      const isAttached = attachedResources.some(res => res.id === f.id);
      
      let containerClass = "border-2 border-transparent bg-transparent";
      let textClass = "text-stone-700";
      
      if (isActive) {
        containerClass = "bg-orange-50 border-2 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]";
        textClass = "text-orange-600";
      } else if (isAttached) {
        containerClass = "bg-blue-50 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]";
        textClass = "text-blue-600";
      } else if (isSelectionMode && isImportedSection && isSelected) {
        containerClass = "bg-orange-100 border-2 border-orange-400";
      }

      return (
        <div 
          key={f.id} 
          onClick={() => {
            if (isImportedSection && isSelectionMode) {
              setSelectedIds(prev => 
                prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
              );
              return;
            }
            if (setActivePreviewItem) {
               setActivePreviewItem({ ...f, folderName: activePreviewItem?.folderName || activeFolderDetail?.title });
               setViewHistory(prev => [f.id, ...prev.filter(id => id !== f.id)]);
            }
          }}
          className={`group flex flex-col items-center cursor-pointer transition-all ${isHorizontal ? 'w-[100px] shrink-0' : 'w-full min-w-0'} relative ${isActive || isAttached ? 'scale-105' : 'hover:scale-105'} ${openMenuId === f.id ? 'z-[200]' : 'z-10'}`}
        >
          <div className={`relative p-2 rounded-xl transition-all ${containerClass}`}>
            <FileIconBadge fileName={f.name} size={48} />
            
            {!isSelectionMode && !isActive && (
              <div className={`absolute top-1 right-1 transition-opacity z-50 ${openMenuId === f.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === f.id ? null : f.id);
                  }}
                  className="p-1 bg-white/90 shadow-sm rounded-full hover:bg-orange-50 text-stone-500 hover:text-orange-600 transition-colors"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            
            {openMenuId === f.id && (
              <div className="absolute top-[85%] left-1/2 -translate-x-1/2 mt-1 w-[110px] bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-[100] overflow-hidden animate-fadeIn">
                    
                    {attachedResources.some(res => res.id === f.id) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedResources(prev => prev.filter(res => res.id !== f.id));
                          setOpenMenuId(null);
                        }}
                        className="w-full px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 shrink-0" />
                        Retirer du contexte
                      </button>
                    ) : (
                      isActive ? (
                        <button
                          disabled
                          className="w-full px-2 py-2 text-left text-xs font-semibold text-stone-400 flex items-center gap-2 cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0 opacity-50" />
                          Déjà ouvert
                        </button>
                      ) : (attachedResources.length < 2) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachedResources(prev => [...prev, f]);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          Ajouter au contexte
                        </button>
                      )
                    )}

                    {isImportedSection && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setIsSelectionMode(true);
                            setSelectedIds(files.map(file => file.id));
                          }}
                          className="w-full px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
                        >
                          <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                          Tout cocher
                        </button>
                        <div className="w-full h-px bg-stone-100 my-1"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImportedFile(f.id);
                          }}
                          className="w-full px-2 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          Supprimer
                        </button>
                      </>
                    )}
                  </div>
                )}
            
            {isImportedSection && isSelectionMode && (
              <div className="absolute top-1 right-1 z-10 bg-white rounded-md shadow-sm">
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-orange-500" />
                ) : (
                  <Square className="w-4 h-4 text-stone-300" />
                )}
              </div>
            )}
          </div>
          <span className={`text-[10px] md:text-[11px] font-bold text-center mt-2 px-1 line-clamp-2 w-full break-all overflow-hidden
            ${textClass}`}>
            {f.name}
          </span>
        </div>
      );
    });
  };

  useEffect(() => {
    let baseFiles = [];
    let folder = '';

    if (activeFolderDetail && activeFolderDetail.files) {
      baseFiles = activeFolderDetail.files;
      folder = activeFolderDetail.title;
    } else if (activePreviewItem?.folderName) {
      folder = activePreviewItem.folderName;
    }

    if (folder) {
      const storageKey = `unifolder_matiere_files_${folder}`;
      const saved = localStorage.getItem(storageKey);
      let importedFiles: any[] = [];
      let leftMenuImports: any[] = [];
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          importedFiles = parsed.map((item: any) => ({
            ...item,
            extension: item.extension || (item.name.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
            isImported: true
          }));
          
          leftMenuImports = importedFiles.filter((f: any) => f.isLeftMenuImport);
        } catch(e) {}
      }
      
      setMenuFiles([...importedFiles, ...baseFiles]);
      // Keep track of ONLY the explicitly imported files from LeftMenu
      setSessionImportedIds(leftMenuImports.map((f: any) => f.id));
    } else {
      setMenuFiles([...baseFiles]);
      setSessionImportedIds([]);
    }
  }, [activeFolderDetail, activePreviewItem]);

  // Filtered files according to search query
  const query = searchQuery.toLowerCase().trim();
  const importedFiles = [...menuFiles]
    .filter(f => sessionImportedIds.includes(f.id))
    .filter(f => !query || f.name.toLowerCase().includes(query))
    .sort(sortFilesByHistory);

  const subjectFiles = [...menuFiles]
    .filter(f => !sessionImportedIds.includes(f.id))
    .filter(f => !query || f.name.toLowerCase().includes(query))
    .sort(sortFilesByHistory);

  return (
    <div ref={containerRef} className={`w-full h-full border-r-2 border-stone-800 relative pointer-events-auto bg-[#FDFBF7] ${isCenterFullscreen || isRightFullscreen ? 'hidden' : (mobilePreviewTab === 0 ? 'flex' : 'hidden md:flex')} flex flex-col`}>
      {/* Action Button (Top Left of Left Menu) */}
      {!isAssistantOpen ? (
        <>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="*/*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute top-[60px] md:top-[64px] left-2 md:left-4 z-50 px-2 py-0.5 bg-white rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-stone-50 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-stone-800"
            title="Importer un fichier depuis l'appareil"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[9px] font-extrabold uppercase tracking-widest">Importer</span>
          </button>
        </>
      ) : hasChatMessages ? (
        <button
          onClick={() => setChatKey(prev => prev + 1)}
          className="absolute top-[60px] md:top-[64px] left-2 md:left-4 z-50 px-2 py-0.5 bg-[#1e2024] rounded border border-stone-600 shadow-[1px_1px_0px_0px_#444] hover:bg-[#2a2d33] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-zinc-300"
          title="Réinitialiser la discussion"
        >
          <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <mask id="history-cutout">
                <rect width="24" height="24" fill="white" />
                <circle cx="19" cy="19" r="5" fill="black" />
              </mask>
            </defs>
            <g mask="url(#history-cutout)">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l3 3" />
            </g>
            <path d="M16 16l6 6" strokeWidth="2.5" />
            <path d="M22 16l-6 6" strokeWidth="2.5" />
          </svg>
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Nouvelle disc.</span>
        </button>
      ) : null}

      {/* Search Bar between Importer and Assistante DKD */}
      {!isAssistantOpen && (
        <div className="absolute top-[60px] md:top-[64px] left-[118px] md:left-[132px] z-50 flex items-center">
          <div className="relative w-[125px] sm:w-[145px] md:w-[160px] flex items-center">
            <Search className="w-3 h-3 text-stone-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-white border border-stone-300 focus:border-stone-800 rounded-full pl-6 pr-6 py-0.5 text-[10px] font-semibold text-stone-800 placeholder-stone-400 shadow-xs focus:outline-none focus:ring-1 focus:ring-orange-400 transition-all h-[26px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 p-0.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
                title="Effacer la recherche"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Folder Title was moved to Top Header */}

      {/* Assistante DKD Robot Button (Top Right of Left Menu) */}
      <button
        onClick={() => setIsAssistantOpen(!isAssistantOpen)}
        className="absolute top-[62px] md:top-[66px] right-2 md:right-4 z-50 flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-all select-none"
        title={isAssistantOpen ? "Fermer l'Assistante DKD" : "Ouvrir l'Assistante DKD"}
      >
        <div className={`relative p-0.5 rounded-full transition-all duration-200 ${
          isAssistantOpen 
            ? 'ring-2 ring-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] scale-105' 
            : 'hover:scale-105 shadow-[0_2px_8px_rgba(37,99,235,0.3)]'
        }`}>
          <DelmasRobot size={42} />
        </div>
        <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-1 leading-none whitespace-nowrap transition-colors ${
          isAssistantOpen ? 'text-orange-600' : 'text-blue-600 group-hover:text-blue-700'
        }`}>
          Assistante DKD
        </span>
      </button>

      {/* Available Files in current Folder/Subject */}
      {!isAssistantOpen && (
        <div className="absolute top-[100px] md:top-[110px] bottom-0 left-0 right-0 flex flex-col overflow-hidden px-4 pb-4 pt-2">
          {menuFiles.length > 0 ? (
            <div className="w-full flex flex-col gap-4 h-full overflow-hidden">
              {/* Imported Files Section - fixed at top */}
              {sessionImportedIds.length > 0 && (
                <div className="w-full relative shrink-0">
                  <div className="flex items-center justify-between border-b-2 border-orange-200 mb-2 pb-1 px-2 w-full">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-wider text-left m-0">Fichiers Importés</h4>
                      {searchQuery && (
                        <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">
                          {importedFiles.length}
                        </span>
                      )}
                    </div>
                    {isSelectionMode && (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <button onClick={(e) => { e.stopPropagation(); setIsSelectionMode(false); setSelectedIds([]); setShowDeleteConfirm(false); }} className="text-[9px] font-bold text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded transition-colors">Annuler</button>
                        {selectedIds.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="text-[9px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors flex items-center gap-1">
                            <Trash2 className="w-2.5 h-2.5" />
                            Tout supprimer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {importedFiles.length > 0 ? (
                    <div className="w-full grid grid-rows-2 grid-flow-col auto-cols-[100px] overflow-x-auto gap-3 py-2 px-1 justify-start hide-scrollbar pb-2">
                      {renderFileGroup(importedFiles, true, true)}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 italic py-3 text-center w-full">
                      Aucun fichier importé correspondant
                    </p>
                  )}
                </div>
              )}
              
              {/* Subject Files Section - scrolls independently */}
              {menuFiles.some(f => !sessionImportedIds.includes(f.id)) && (
                <div className="w-full flex flex-col flex-1 overflow-hidden min-h-0">
                  {sessionImportedIds.length > 0 && (
                    <div className="flex items-center justify-between border-b border-stone-200 mb-2 pb-1 px-2 w-full shrink-0">
                      <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider text-left m-0">Fichiers de la matière</h4>
                      {searchQuery && (
                        <span className="text-[9px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-full">
                          {subjectFiles.length}
                        </span>
                      )}
                    </div>
                  )}
                  {subjectFiles.length > 0 ? (
                    <div className="w-full grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-3 py-2 px-1 justify-items-center justify-start overflow-y-auto flex-1">
                      {renderFileGroup(subjectFiles, false)}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 italic py-4 text-center w-full">
                      Aucun fichier de matière correspondant
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-2">
               <FileIcon className="w-8 h-8 opacity-50" />
               <span className="text-[11px] font-semibold text-center px-4">Aucun fichier disponible</span>
             </div>
          )}
        </div>
      )}

      <div className={`absolute inset-0 z-40 bg-[#1e2024] pt-[136px] md:pt-[142px] ${isAssistantOpen ? 'block' : 'hidden'}`}>
        <AssistantChat key={chatKey} onClose={() => setIsAssistantOpen(false)} onHasMessagesChange={setHasChatMessages} activePreviewItem={activePreviewItem} attachedResources={attachedResources} setAttachedResources={setAttachedResources} />
      </div>
      
      {/* Drag Handle Right of Col 1 */}
      <div 
        className="hidden md:flex absolute -right-[5px] top-0 bottom-0 w-[10px] cursor-col-resize z-40 justify-center group"
        onMouseDown={(e) => { e.preventDefault(); setIsResizingLeft(true); }}
        onTouchStart={(e) => { e.stopPropagation(); setIsResizingLeft(true); }}
      >
        <div className="w-[4px] h-full bg-transparent group-hover:bg-orange-500 transition-colors" />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 z-[99999] bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl max-w-xs w-full p-5 shadow-[6px_6px_0px_0px_#1c1917] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 border-2 border-stone-800 rounded-xl flex items-center justify-center text-red-600 shadow-[2px_2px_0px_0px_#1c1917] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-stone-950">Confirmation</h3>
                <p className="text-xs text-stone-600 leading-snug mt-0.5">
                  {selectedIds.length > 1 
                    ? `Voulez-vous supprimer les ${selectedIds.length} fichiers sélectionnés ?` 
                    : 'Voulez-vous supprimer le fichier sélectionné ?'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteSelected();
                  setShowDeleteConfirm(false);
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
