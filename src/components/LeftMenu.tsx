import React, { useEffect, useState } from 'react';
import { Upload, File as FileIcon, MoreVertical, Trash2, CheckSquare, Square, Check, X, Plus, Search, ArrowLeftRight, RotateCcw } from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { AssistantChat } from './AssistantChat';
import { FileIconBadge } from './FileIconBadge';
import { StudyCloudAPI } from '../services/api';
import { storeFileBlob, deleteFileBlob, getFileBlobUrl, MAX_FILE_SIZE_BYTES, formatFileSize } from '../services/localFileStorage';

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
  isMobileScreen?: boolean;
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
  activeFolderDetail,
  isMobileScreen
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

  const currentFolderName = activePreviewItem?.folderName || activePreviewItem?.matiere || activeFolderDetail?.title;
  const isMesFichiersMode = currentFolderName === 'Mes fichiers' || (!currentFolderName && !!activePreviewItem);
  const [panelWidth, setPanelWidth] = useState(380);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        setPanelWidth(width);
        // width minus padding (32px). Item is 105px, gap is 12px.
        const available = width - 32;
        const n = Math.floor((available + 12) / 117);
        setItemsPerRow(Math.max(1, n));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isCompact = panelWidth < 360;

  useEffect(() => {
    const handleAutoPrompt = () => setIsAssistantOpen(true);
    window.addEventListener('auto-prompt', handleAutoPrompt);
    return () => window.removeEventListener('auto-prompt', handleAutoPrompt);
  }, [setIsAssistantOpen]);

  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setSyncTick(prev => prev + 1);
    window.addEventListener('unifolder_files_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('unifolder_files_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Synchronisation avec la base de données : charger tous les fichiers importés lors de l'étude
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    let isMounted = true;

    StudyCloudAPI.getStudyFiles(userId)
      .then(async (res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const filesWithUrls = await Promise.all(
            res.data.map(async (row: any) => {
              const localBlobUrl = await getFileBlobUrl(row.id);
              return {
                id: row.id,
                name: row.name,
                size: row.size || 0,
                type: row.type || 'file',
                extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
                url: localBlobUrl || row.file_url || '',
                r2Key: row.r2_key,
                isFavorite: !!row.is_favorite,
                isLeftMenuImport: true,
                isStudyImport: true,
                isImported: true,
                importedAt: row.imported_at || row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                createdAt: row.created_at || Date.now(),
                timestamp: row.imported_at || row.last_imported || Date.now(),
                isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
              };
            })
          );

          if (!isMounted) return;

          const existingRaw = localStorage.getItem('unifolder_study_imported_files');
          let localList: any[] = [];
          if (existingRaw) {
            try { localList = JSON.parse(existingRaw); } catch (e) {}
          }
          const mergedMap = new Map<string, any>();
          filesWithUrls.forEach(f => mergedMap.set(f.id, f));
          localList.forEach(f => {
            if (f && f.id && !mergedMap.has(f.id)) {
              mergedMap.set(f.id, f);
            }
          });
          const merged = Array.from(mergedMap.values());
          localStorage.setItem('unifolder_study_imported_files', JSON.stringify(merged));
          localStorage.setItem('unifolder_left_menu_general_imports', JSON.stringify(merged));
          setSyncTick(prev => prev + 1);
        }
      })
      .catch(err => console.warn('[LeftMenu] Erreur synchro study files:', err));

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`Le fichier "${file.name}" dépasse la limite de 50 Mo (${formatFileSize(file.size)}).`);
      return;
    }

    const now = Date.now();
    const id = `file-${now}-${Math.random().toString(36).substring(2, 7)}`;
    await storeFileBlob(id, file);
    const localUrl = URL.createObjectURL(file);
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const extVal = file.name.split('.').pop()?.toUpperCase() || 'FICHIER';

    const newFile = {
      id,
      name: file.name,
      type: file.type || 'file',
      size: file.size,
      date: new Date().toLocaleDateString('fr-FR'),
      extension: extVal,
      isImage: file.type.startsWith('image/'),
      url: localUrl,
      matiere: currentFolderName && currentFolderName !== 'Mes fichiers' ? currentFolderName : '',
      isLeftMenuImport: true,
      isStudyImport: true,
      isImported: true,
      importedAt: now,
      createdAt: now,
      timestamp: now
    };
    
    // Enregistrer dans Cloudflare D1
    StudyCloudAPI.registerFileMetadata({
      id,
      userId,
      matiereId: currentFolderName && currentFolderName !== 'Mes fichiers' ? currentFolderName : null,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      extension: extVal,
      r2Key: null,
      fileUrl: localUrl,
      isFavorite: false,
      isImported: true,
      isStudySession: true,
      lastImported: now
    }).catch(() => {});

    StudyCloudAPI.registerStudyFile({
      id,
      userId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      extension: extVal,
      r2Key: null,
      fileUrl: localUrl,
      isFavorite: false,
      importedAt: now
    }).catch(() => {});

    // Upload vers Cloudflare R2
    const r2Key = `files/${userId}/${id}-${encodeURIComponent(file.name)}`;
    StudyCloudAPI.uploadFileToR2(file, r2Key).then(res => {
      if (res && res.url) {
        StudyCloudAPI.registerFileMetadata({
          id,
          userId,
          matiereId: currentFolderName && currentFolderName !== 'Mes fichiers' ? currentFolderName : null,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          extension: extVal,
          r2Key: res.key,
          fileUrl: res.url,
          isFavorite: false,
          isImported: true,
          isStudySession: true,
          lastImported: now
        }).catch(() => {});

        StudyCloudAPI.registerStudyFile({
          id,
          userId,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          extension: extVal,
          r2Key: res.key,
          fileUrl: res.url,
          isFavorite: false,
          importedAt: now
        }).catch(() => {});
      }
    }).catch(() => {});
    
    // Save to dedicated study imports localStorage (global and independent of current menu)
    try {
      const keys = ['unifolder_study_imported_files', 'unifolder_left_menu_general_imports'];
      keys.forEach(k => {
        const saved = localStorage.getItem(k);
        let parsed: any[] = [];
        if (saved) {
          try { parsed = JSON.parse(saved); } catch (err) {}
        }
        parsed = [newFile, ...parsed.filter((f: any) => f.id !== newFile.id)];
        localStorage.setItem(k, JSON.stringify(parsed));
      });
      localStorage.setItem('unifolder_last_imported_id', newFile.id);
      window.dispatchEvent(new Event('unifolder_files_updated'));
    } catch (err) {}
    
    setMenuFiles(prev => [newFile, ...prev.filter(f => f.id !== newFile.id)]);
    setSessionImportedIds(prev => [newFile.id, ...prev.filter(id => id !== newFile.id)]);
    
    if (setActivePreviewItem) {
      setActivePreviewItem({ ...newFile, folderName: currentFolderName || 'Mes fichiers' });
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
    deleteFileBlob(fileId);
    StudyCloudAPI.deleteStudyFile(fileId).catch(() => {});
    StudyCloudAPI.deleteFile(fileId).catch(() => {});
    
    // Update localStorage
    try {
      const keys = ['unifolder_study_imported_files', 'unifolder_left_menu_general_imports', 'unifolder_imported_files'];
      keys.forEach(key => {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const newParsed = parsed.filter((f: any) => f.id !== fileId);
              if (newParsed.length !== parsed.length) {
                localStorage.setItem(key, JSON.stringify(newParsed));
              }
            }
          } catch (e) {}
        }
      });

      // Clean in any other keys
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('unifolder_matiere_files_') || k === 'unifolder_files_menu_items')) {
          const saved = localStorage.getItem(k);
          if (saved && saved.includes(fileId)) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                const newParsed = parsed.filter((f: any) => f.id !== fileId);
                if (newParsed.length !== parsed.length) {
                  localStorage.setItem(k, JSON.stringify(newParsed));
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {}
    
    if (activePreviewItem?.id === fileId && setActivePreviewItem) {
      setActivePreviewItem(null);
    }
    setOpenMenuId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    
    setMenuFiles(prev => prev.filter(f => !selectedIds.includes(f.id)));
    setSessionImportedIds(prev => prev.filter(id => !selectedIds.includes(id)));
    
    selectedIds.forEach(id => {
      deleteFileBlob(id);
      StudyCloudAPI.deleteStudyFile(id).catch(() => {});
      StudyCloudAPI.deleteFile(id).catch(() => {});
    });
    
    // Update localStorage
    try {
      const keys = ['unifolder_study_imported_files', 'unifolder_left_menu_general_imports', 'unifolder_imported_files'];
      keys.forEach(key => {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const newParsed = parsed.filter((f: any) => !selectedIds.includes(f.id));
              if (newParsed.length !== parsed.length) {
                localStorage.setItem(key, JSON.stringify(newParsed));
              }
            }
          } catch (e) {}
        }
      });

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('unifolder_matiere_files_') || k === 'unifolder_files_menu_items')) {
          const saved = localStorage.getItem(k);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                const newParsed = parsed.filter((f: any) => !selectedIds.includes(f.id));
                if (newParsed.length !== parsed.length) {
                  localStorage.setItem(k, JSON.stringify(newParsed));
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {}
    
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
      
      const totalContextCount = (activePreviewItem ? 1 : 0) + attachedResources.filter(res => res.id !== activePreviewItem?.id).length;
      const isLimitReached = totalContextCount >= 3;
      // Le bouton trois traits disparaît sur les fichiers non attachés quand la limite de 3 est atteinte
      const showMenuButton = !isSelectionMode && !isActive && (isAttached || !isLimitReached);
      
      let containerClass = "border-2 border-transparent bg-transparent";
      let textClass = "text-stone-700";
      
      if (isActive) {
        containerClass = "bg-orange-50/90 border-2 border-orange-500 rounded-xl shadow-[0_0_0_1.5px_#f97316] ring-2 ring-orange-400/40";
        textClass = "text-orange-600 font-black";
      } else if (isAttached) {
        containerClass = "bg-blue-50/90 border-2 border-blue-500 rounded-xl shadow-[0_0_0_1.5px_#3b82f6] ring-2 ring-blue-400/40";
        textClass = "text-blue-600 font-black";
      } else if (isSelectionMode && isImportedSection && isSelected) {
        containerClass = "bg-orange-100 border-2 border-orange-400 rounded-xl";
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
               const nextFolder = isImportedSection 
                 ? (currentFolderName || 'Mes fichiers') 
                 : (f.matiere || f.folderName || currentFolderName || 'Mes fichiers');
               setActivePreviewItem({ ...f, folderName: nextFolder });
               setViewHistory(prev => [f.id, ...prev.filter(id => id !== f.id)]);
            }
          }} 
          className={`group flex flex-col items-center cursor-pointer transition-all ${isHorizontal ? 'w-[100px] shrink-0' : 'w-full min-w-0'} relative ${isActive || isAttached ? 'scale-[1.03]' : 'hover:scale-105'} ${openMenuId === f.id ? 'z-[200]' : 'z-10'} p-1`}
        >
          <div className={`relative p-2.5 rounded-xl transition-all ${containerClass}`}>
            <FileIconBadge fileName={f.name} size={48} />
            
            {showMenuButton && (
              <div className={`absolute top-1 right-1 transition-opacity z-50 ${openMenuId === f.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === f.id ? null : f.id);
                  }}
                  className="p-1 bg-white/90 shadow-sm rounded-full hover:bg-orange-50 text-stone-500 hover:text-orange-600 transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            
            {openMenuId === f.id && (
              <div className="absolute top-[85%] left-1/2 -translate-x-1/2 mt-1 w-[110px] bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-[100] overflow-hidden animate-fadeIn">
                    
                    {isAttached ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedResources(prev => prev.filter(res => res.id !== f.id));
                          setOpenMenuId(null);
                        }}
                        className="w-full px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors cursor-pointer"
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
                      ) : (!isLimitReached) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachedResources(prev => [...prev, f]);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors cursor-pointer"
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
    let folder = currentFolderName || '';
    if (activeFolderDetail && activeFolderDetail.title) {
      folder = activeFolderDetail.title;
    }

    // -------------------------------------------------------------
    // 1. SECTION DU HAUT : TOUS LES FICHIERS IMPORTÉS PENDANT L'ÉTUDE
    // (Indépendants du menu actif - s'affichent toujours en haut)
    // -------------------------------------------------------------
    const allLeftImportsMap = new Map<string, any>();

    const addStudyImportFromRaw = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((f: any) => {
            if (f && f.id && (f.isLeftMenuImport || f.isStudyImport)) {
              allLeftImportsMap.set(f.id, {
                ...f,
                isLeftMenuImport: true,
                isStudyImport: true,
                isImported: true,
                extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
              });
            }
          });
        }
      } catch (e) {}
    };

    // Charger les clés principales dédiées aux imports d'étude
    addStudyImportFromRaw(localStorage.getItem('unifolder_study_imported_files'));
    addStudyImportFromRaw(localStorage.getItem('unifolder_left_menu_general_imports'));

    // Récupérer et nettoyer également tout import d'étude qui aurait été sauvegardé dans une matière ou ailleurs
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('unifolder_matiere_files_') || key === 'unifolder_imported_files' || key === 'unifolder_files_menu_items')) {
          const raw = localStorage.getItem(key);
          if (raw && raw.includes('isLeftMenuImport')) {
            addStudyImportFromRaw(raw);
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((item: any) => !item.isLeftMenuImport && !item.isStudyImport);
                if (cleaned.length !== parsed.length) {
                  localStorage.setItem(key, JSON.stringify(cleaned));
                }
              }
            } catch (err) {}
          }
        }
      }
    } catch (e) {}

    const importedFilesList = Array.from(allLeftImportsMap.values());
    // Mettre à jour le stockage global pour que tous les imports restent toujours persistants
    try {
      localStorage.setItem('unifolder_study_imported_files', JSON.stringify(importedFilesList));
      localStorage.setItem('unifolder_left_menu_general_imports', JSON.stringify(importedFilesList));
    } catch (e) {}

    const importedIds = importedFilesList.map(f => f.id);

    // -------------------------------------------------------------
    // 2. SECTION DU BAS : FICHIERS SELON LE MENU PAR LEQUEL ON EST PASSÉ
    // -------------------------------------------------------------
    let baseFiles: any[] = [];

    if (folder && !isMesFichiersMode) {
      // CAS DANS UNE MATIÈRE (ex: Mathématiques) -> Uniquement les fichiers de cette matière
      const matiereMap = new Map<string, any>();

      // A. Charger les fichiers de cette matière depuis le localStorage
      const matiereRaw = localStorage.getItem(`unifolder_matiere_files_${folder}`);
      if (matiereRaw) {
        try {
          const parsed = JSON.parse(matiereRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((f: any) => {
              if (f && f.id && !f.isLeftMenuImport && !f.isStudyImport && !importedIds.includes(f.id)) {
                matiereMap.set(f.id, {
                  ...f,
                  matiere: folder,
                  extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
                });
              }
            });
          }
        } catch (e) {}
      }

      // B. Fusionner avec activeFolderDetail.files si disponible
      if (activeFolderDetail && Array.isArray(activeFolderDetail.files)) {
        activeFolderDetail.files.forEach((f: any) => {
          if (f && f.id && !f.isLeftMenuImport && !f.isStudyImport && !importedIds.includes(f.id)) {
            if (!matiereMap.has(f.id)) {
              matiereMap.set(f.id, {
                ...f,
                matiere: folder,
                extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
              });
            }
          }
        });
      }

      // C. S'assurer que le fichier actif sélectionné (si de cette matière) est présent
      if (activePreviewItem && activePreviewItem.id && !importedIds.includes(activePreviewItem.id)) {
        const itemFolder = activePreviewItem.folderName || activePreviewItem.matiere;
        if (itemFolder === folder && !matiereMap.has(activePreviewItem.id)) {
          matiereMap.set(activePreviewItem.id, {
            ...activePreviewItem,
            matiere: folder,
            extension: activePreviewItem.extension || (activePreviewItem.name && activePreviewItem.name.includes('.') ? activePreviewItem.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
          });
        }
      }

      baseFiles = Array.from(matiereMap.values());
    } else {
      // CAS "MES FICHIERS" -> Uniquement les fichiers qui n'appartiennent à aucune matière
      const directMap = new Map<string, any>();

      const addDirectFiles = (raw: string | null) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((f: any) => {
              if (f && f.id && (!f.matiere || f.matiere === 'Mes fichiers') && !f.isLeftMenuImport && !f.isStudyImport && !importedIds.includes(f.id)) {
                directMap.set(f.id, {
                  ...f,
                  matiere: 'Mes fichiers',
                  extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
                });
              }
            });
          }
        } catch (e) {}
      };

      addDirectFiles(localStorage.getItem('unifolder_files_menu_items'));
      addDirectFiles(localStorage.getItem('unifolder_imported_files'));
      addDirectFiles(localStorage.getItem('unifolder_matiere_files'));

      // S'assurer que le fichier actif sélectionné (hors matière et non importé) est inclus
      if (activePreviewItem && activePreviewItem.id && !importedIds.includes(activePreviewItem.id)) {
        const itemFolder = activePreviewItem.folderName || activePreviewItem.matiere;
        if (!itemFolder || itemFolder === 'Mes fichiers') {
          if (!directMap.has(activePreviewItem.id)) {
            directMap.set(activePreviewItem.id, {
              ...activePreviewItem,
              matiere: 'Mes fichiers',
              extension: activePreviewItem.extension || (activePreviewItem.name && activePreviewItem.name.includes('.') ? activePreviewItem.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
            });
          }
        }
      }

      baseFiles = Array.from(directMap.values());
    }

    setMenuFiles([...importedFilesList, ...baseFiles]);
    setSessionImportedIds(importedIds);
  }, [activeFolderDetail, activePreviewItem, isMesFichiersMode, currentFolderName, syncTick]);

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
    <div 
      ref={containerRef} 
      className={`w-full h-full border-r-2 border-stone-800 relative pointer-events-auto bg-[#FDFBF7] ${
        isCenterFullscreen || isRightFullscreen ? 'hidden' : (mobilePreviewTab === 0 ? 'flex' : 'hidden md:flex')
      } flex flex-col pt-[44px] overflow-hidden`}
    >
      {/* Top Header & Actions Section */}
      {!isAssistantOpen ? (
        <div className="w-full px-3 py-2 shrink-0 border-b border-stone-200/80 bg-[#FDFBF7] z-30">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="*/*"
          />

          {!isCompact ? (
            /* Normal Width Layout: 1 Row (Importer + Search + Robot) */
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 bg-white rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-stone-50 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-stone-800 shrink-0"
                  title="Importer un fichier depuis l'appareil"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-extrabold uppercase tracking-widest">Importer</span>
                </button>

                <div className="relative flex-1 min-w-[90px] max-w-[200px] flex items-center">
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

              {/* Assistante DKD Robot Button */}
              <button
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className="flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-all select-none shrink-0"
                title="Ouvrir l'Assistante DKD"
              >
                <div className="relative p-0.5 rounded-full transition-all duration-200 hover:scale-105 shadow-[0_2px_8px_rgba(37,99,235,0.3)]">
                  <DelmasRobot size={42} />
                </div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-1 leading-none whitespace-nowrap text-blue-600 group-hover:text-blue-700">
                  Assistante DKD
                </span>
              </button>
            </div>
          ) : (
            /* Compact Width Layout: 2 Rows (Robot positioned directly BELOW search field so they never overlap) */
            <div className="flex flex-col gap-2 w-full">
              {/* Row 1: Importer + Search Bar */}
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 bg-white rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-stone-50 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-stone-800 shrink-0"
                  title="Importer un fichier depuis l'appareil"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-extrabold uppercase tracking-widest">Importer</span>
                </button>

                <div className="relative flex-1 min-w-0 flex items-center">
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

              {/* Row 2: Assistante DKD Robot directly BELOW the search field with exact original vertical design */}
              <div className="flex items-center justify-end w-full pr-2 pt-0.5">
                <button
                  onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                  className="flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-all select-none shrink-0"
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
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Top Header when Assistant Chat is Open */
        <div className="w-full px-3 py-2 shrink-0 bg-[#1e2024] border-b border-stone-700 flex items-center justify-between z-30">
          {hasChatMessages ? (
            <button
              onClick={() => setChatKey(prev => prev + 1)}
              className="px-2 py-1 bg-[#2a2d33] rounded border border-stone-600 shadow-xs hover:bg-[#343840] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-zinc-300"
              title="Réinitialiser la discussion"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[9px] font-extrabold uppercase tracking-widest">Nouvelle disc.</span>
            </button>
          ) : <div />}

          <button
            onClick={() => setIsAssistantOpen(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[10px] font-black cursor-pointer hover:bg-orange-500/30 transition-colors"
            title="Fermer l'Assistante DKD"
          >
            <DelmasRobot size={22} />
            <span>Fermer</span>
          </button>
        </div>
      )}

      {/* Main Content: Files List OR Assistant Chat in natural flex flow */}
      {!isAssistantOpen ? (
        <div className="flex-1 w-full overflow-hidden flex flex-col px-3 sm:px-4 py-2 min-h-0">
          {menuFiles.length > 0 ? (
            <div className="w-full flex flex-col gap-4 h-full overflow-hidden">
              {/* Imported Files Section - fixed at top */}
              {sessionImportedIds.length > 0 && (
                <div className="w-full relative shrink-0">
                  <div className="flex items-center justify-between border-b-2 border-orange-200 mb-2 pb-1 px-2 w-full">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-wider text-left m-0">Fichiers Importés</h4>
                      <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">
                        {importedFiles.length}
                      </span>
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
                    <div className="w-full grid grid-rows-2 grid-flow-col auto-cols-[100px] overflow-x-auto gap-3 pt-2 pb-3 px-2 justify-start hide-scrollbar">
                      {renderFileGroup(importedFiles, true, true)}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 italic py-3 text-center w-full">
                      Aucun fichier importé correspondant
                    </p>
                  )}
                </div>
              )}
              
              {/* Context Files Section - scrolls independently */}
              <div className="w-full flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="flex items-center justify-between border-b border-stone-200 mb-2 pb-1 px-2 w-full shrink-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider text-left m-0">
                      {isMesFichiersMode ? 'Mes fichiers' : (currentFolderName ? `Fichiers de ${currentFolderName}` : 'Fichiers de la matière')}
                    </h4>
                    {subjectFiles.length > 0 && (
                      <span className="text-[9px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-full">
                        {subjectFiles.length}
                      </span>
                    )}
                  </div>
                </div>
                {subjectFiles.length > 0 ? (
                  <div className="w-full grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] content-start auto-rows-max gap-3 pt-2 pb-6 px-2 justify-items-center justify-start overflow-y-auto flex-1">
                    {renderFileGroup(subjectFiles, false)}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400 italic py-4 text-center w-full">
                    {isMesFichiersMode ? 'Aucun fichier dans Mes fichiers' : 'Aucun fichier dans cette matière'}
                  </p>
                )}
              </div>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-2">
               <FileIcon className="w-8 h-8 opacity-50" />
               <span className="text-[11px] font-semibold text-center px-4">Aucun fichier disponible</span>
             </div>
          )}
        </div>
      ) : (
        <div className="flex-1 w-full overflow-hidden bg-[#1e2024] flex flex-col min-h-0 relative">
          <AssistantChat key={chatKey} onClose={() => setIsAssistantOpen(false)} onHasMessagesChange={setHasChatMessages} activePreviewItem={activePreviewItem} attachedResources={attachedResources} setAttachedResources={setAttachedResources} />
        </div>
      )}
      
      {/* Drag Handle Right of Col 1 with Fluid Resize & Visual Indicator */}
      <div 
        className="hidden md:flex absolute -right-[9px] top-0 bottom-0 w-[18px] cursor-col-resize z-50 justify-center items-center group select-none"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizingLeft(true); }}
        onTouchStart={(e) => { e.stopPropagation(); setIsResizingLeft(true); }}
        title="Glisser pour redimensionner"
      >
        <div className="w-[3px] h-full bg-transparent group-hover:bg-orange-500 group-active:bg-orange-500 transition-colors" />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-white dark:bg-stone-800 border border-stone-400 dark:border-stone-600 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none">
          <ArrowLeftRight className="w-2.5 h-2.5 text-stone-600 dark:text-stone-300" />
        </div>
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
