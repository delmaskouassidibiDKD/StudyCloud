import React, { useRef, useState, useEffect } from 'react';
import { Edit3, ArrowLeft, Upload, File, Folder, Check, MoreVertical, X, Search, Copy, Plus } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob, MAX_FILE_SIZE_BYTES, formatFileSize } from '../services/localFileStorage';

interface FilesMenuViewProps {
  onBack: () => void;
  onImportFile?: () => void;
  setActivePreviewItem?: (item: any) => void;
}

interface ImportedItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension?: string;
  url?: string;
  isImage?: boolean;
  matiere?: string;
  isLeftMenuImport?: boolean;
  importedAt?: number | string;
  createdAt?: number | string;
  timestamp?: number;
  _orderIndex?: number;
  isFavorite?: boolean;
}

export const getFileTimestamp = (item: any): number => {
  if (!item) return 0;
  
  if (typeof item.importedAt === 'number' && item.importedAt > 0) return item.importedAt;
  if (typeof item.timestamp === 'number' && item.timestamp > 0) return item.timestamp;
  if (typeof item.createdAt === 'number' && item.createdAt > 0) return item.createdAt;

  if (typeof item.createdAt === 'string') {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (typeof item.importedAt === 'string') {
    const t = new Date(item.importedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // Timestamp inside ID (e.g. file-17889... or 17889...)
  if (item.id && typeof item.id === 'string') {
    const match = item.id.match(/1[6-9]\d{11,12}/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      if (!isNaN(parsed) && parsed > 1000000000000) return parsed;
    }
  }

  // Timestamp in fileName (e.g. Screenshot_20260322_103941_Chrome.jpg)
  if (item.name && typeof item.name === 'string') {
    const matchDate = item.name.match(/20\d{2}[-_]?(0[1-9]|1[0-2])[-_]?([0-2][0-9]|3[01])(?:[-_]?([01][0-9]|2[0-3])([0-5][0-9])([0-5][0-9]))?/);
    if (matchDate) {
      const full = matchDate[0].replace(/[-_]/g, '');
      if (full.length >= 8) {
        const year = parseInt(full.substring(0, 4), 10);
        const month = parseInt(full.substring(4, 6), 10) - 1;
        const day = parseInt(full.substring(6, 8), 10);
        const hour = full.length >= 10 ? parseInt(full.substring(8, 10), 10) : 12;
        const min = full.length >= 12 ? parseInt(full.substring(10, 12), 10) : 0;
        const sec = full.length >= 14 ? parseInt(full.substring(12, 14), 10) : 0;
        const d = new Date(year, month, day, hour, min, sec).getTime();
        if (!isNaN(d) && d > 0) return d;
      }
    }
  }

  // Date formatted 'DD/MM/YYYY'
  if (item.date && typeof item.date === 'string') {
    const parts = item.date.split('/');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
  }

  if (typeof item._orderIndex === 'number') {
    return item._orderIndex;
  }

  return 0;
};

export const FilesMenuView: React.FC<FilesMenuViewProps> = ({ onBack, onImportFile, setActivePreviewItem }) => {
  const loadAllUserFiles = (): ImportedItem[] => {
    const allFilesMap = new Map<string, ImportedItem>();
    let orderCounter = 0;

    const addFiles = (raw: string | null, fallbackMatiere?: string) => {
      if (!raw) return;
      try {
        const parsed: any[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(f => {
            if (f && f.id) {
              // Ne JAMAIS inclure les fichiers d'étude dans Mes fichiers / Mes dossiers (ils sont totalement indépendants)
              if (f.isLeftMenuImport || f.isStudyImport || f.is_study_session) return;

              orderCounter++;
              const existing = allFilesMap.get(f.id);
              const matiere = f.matiere || fallbackMatiere || existing?.matiere;
              const ext = f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
              
              const calculatedTime = getFileTimestamp(f) || (1700000000000 + orderCounter * 1000);

              allFilesMap.set(f.id, {
                ...f,
                matiere,
                extension: ext,
                importedAt: f.importedAt || calculatedTime,
                _orderIndex: orderCounter
              });
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    // 1. Charger les fichiers directement importés dans "Mes fichiers"
    addFiles(localStorage.getItem('unifolder_files_menu_items'));

    // 2. Les fichiers importés pendant l'étude (unifolder_study_imported_files) sont indépendants et ne doivent pas s'afficher ici

    // 3. Charger les fichiers hérités d'anciennes versions
    addFiles(localStorage.getItem('unifolder_imported_files'));
    addFiles(localStorage.getItem('unifolder_matiere_files'));

    // 4. Charger les fichiers de toutes les matières enregistrées
    try {
      const savedMat = localStorage.getItem('unifolder_saved_matieres');
      if (savedMat) {
        const parsedMat = JSON.parse(savedMat);
        if (Array.isArray(parsedMat)) {
          parsedMat.forEach((m: any) => {
            if (m && m.name) {
              addFiles(localStorage.getItem(`unifolder_matiere_files_${m.name}`), m.name);
            }
          });
        }
      }
    } catch (e) {}

    // 5. Parcourir toutes les clés de matières existantes dans localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unifolder_matiere_files_')) {
          const matName = key.replace('unifolder_matiere_files_', '');
          addFiles(localStorage.getItem(key), matName);
        }
      }
    } catch (e) {
      console.error(e);
    }

    return Array.from(allFilesMap.values());
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedFiles, setImportedFiles] = useState<ImportedItem[]>(() => loadAllUserFiles());

  useEffect(() => {
    const handleSync = () => {
      setImportedFiles(loadAllUserFiles());
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('unifolder_files_updated', handleSync);

    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getFiles(userId, 'root', false)
      .then(async (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          const nonStudyRows = res.data.filter((row: any) => !row.is_study_session && !row.isStudyImport);
          const filesWithUrls = await Promise.all(
            nonStudyRows.map(async (row: any) => {
              const localBlobUrl = await getFileBlobUrl(row.id);
              return {
                id: row.id,
                name: row.name,
                size: row.size || 0,
                type: row.type || 'Fichier',
                extension: row.extension || (row.name?.includes('.') ? row.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
                url: localBlobUrl || row.file_url || '',
                r2Key: row.r2_key,
                isFavorite: !!row.is_favorite,
                matiere: row.matiere_id && row.matiere_id !== 'Mes fichiers' ? row.matiere_id : '',
                importedAt: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                createdAt: row.created_at,
                timestamp: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
              };
            })
          );
          setImportedFiles(filesWithUrls);
          localStorage.setItem('unifolder_files_menu_items', JSON.stringify(filesWithUrls));
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('unifolder_files_updated', handleSync);
    };
  }, []);

  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);
  const [classifyFileIds, setClassifyFileIds] = useState<string[] | null>(null);
  const [selectedMatiereIds, setSelectedMatiereIds] = useState<string[]>([]);
  const [isAddingNewMatiere, setIsAddingNewMatiere] = useState(false);
  const [newMatiereName, setNewMatiereName] = useState('');
  const [newMatiereCoef, setNewMatiereCoef] = useState('1');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilesMenuDropdown, setShowFilesMenuDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'size'>('recent');

  // Progression d'enregistrement en arrière-plan (fileId -> pourcentage 0 à 100)
  const [savingFileProgress, setSavingFileProgress] = useState<Record<string, number>>({});

  const startSavingAnimation = (fileIds: string[]) => {
    if (!fileIds || fileIds.length === 0) return;

    // Initialisation
    setSavingFileProgress(prev => {
      const next = { ...prev };
      fileIds.forEach(id => { next[id] = 10; });
      return next;
    });

    let current = 10;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 15) + 15;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setSavingFileProgress(prev => {
          const next = { ...prev };
          fileIds.forEach(id => { next[id] = 100; });
          return next;
        });

        // Disparaît complètement dès que c'est fini
        setTimeout(() => {
          setSavingFileProgress(prev => {
            const next = { ...prev };
            fileIds.forEach(id => { delete next[id]; });
            return next;
          });
        }, 400);
      } else {
        setSavingFileProgress(prev => {
          const next = { ...prev };
          fileIds.forEach(id => { next[id] = current; });
          return next;
        });
      }
    }, 400);
  };

  useEffect(() => {
    const checkImportingIds = () => {
      try {
        const raw = localStorage.getItem('unifolder_importing_ids');
        if (raw) {
          const ids = JSON.parse(raw);
          if (Array.isArray(ids) && ids.length > 0) {
            localStorage.removeItem('unifolder_importing_ids');
            startSavingAnimation(ids);
          }
        }
      } catch (e) {
        console.warn(e);
      }
    };

    checkImportingIds();
    window.addEventListener('unifolder_files_updated', checkImportingIds);
    return () => window.removeEventListener('unifolder_files_updated', checkImportingIds);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  const filteredFiles = importedFiles.filter(f => {
    if (showDuplicatesOnly) {
      const isDup = f.name.includes('(Copie)') || importedFiles.filter(item => item.name.toLowerCase() === f.name.toLowerCase()).length > 1;
      if (!isDup) return false;
    }
    return (
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.matiere && f.matiere.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }).sort((a, b) => {
    // Le dernier fichier importé dans toute l'application s'affiche toujours à l'en-tête même
    const lastId = localStorage.getItem('unifolder_last_imported_id');
    if (lastId) {
      if (a.id === lastId && b.id !== lastId) return -1;
      if (b.id === lastId && a.id !== lastId) return 1;
    }

    if (sortBy === 'size') {
      return (b.size || 0) - (a.size || 0);
    } else if (sortBy === 'oldest') {
      const timeA = getFileTimestamp(a);
      const timeB = getFileTimestamp(b);
      if (timeA !== timeB) return timeA - timeB;
      return a.name.localeCompare(b.name);
    } else {
      // 'recent' : Les plus récents s'affichent en haut (à l'en-tête)
      const timeA = getFileTimestamp(a);
      const timeB = getFileTimestamp(b);
      if (timeA !== timeB) return timeB - timeA;
      return (b._orderIndex || 0) - (a._orderIndex || 0);
    }
  });

  const [savedMatieres, setSavedMatieres] = useState<{ id: string; name: string; coefficient: string; color?: string }[]>(() => {
    const saved = localStorage.getItem('unifolder_saved_matieres');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any, idx: number) => ({
          id: m.id || ('mat-' + Math.random().toString(36).substring(2, 9) + '-' + idx),
          name: m.name,
          coefficient: m.coefficient,
          color: m.color
        }));
      } catch (e) { }
    }
    return [];
  });

  const handleAddNewMatiere = () => {
    if (!newMatiereName.trim()) return;
    const newMat = {
      id: 'mat-' + Math.random().toString(36).substring(2, 9),
      name: newMatiereName.trim(),
      coefficient: newMatiereCoef.trim() || '1'
    };
    const updated = [...savedMatieres, newMat];
    setSavedMatieres(updated);
    localStorage.setItem('unifolder_saved_matieres', JSON.stringify(updated));
    setSelectedMatiereIds(prev => [...prev, newMat.id]);
    setNewMatiereName('');
    setNewMatiereCoef('1');
    setIsAddingNewMatiere(false);
  };

  useEffect(() => {
    localStorage.setItem('unifolder_saved_matieres', JSON.stringify(savedMatieres));
  }, [savedMatieres]);


    const handleSaveRename = () => {
    if (!renamingFileId || !newFileName.trim()) return;
    const targetFile = importedFiles.find(item => item.id === renamingFileId);

    setImportedFiles(prev => prev.map(item => {
      if (item.id === renamingFileId) {
        const existingExt = item.extension || (item.name.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
        return {
          ...item,
          name: newFileName.trim(),
          extension: existingExt
        };
      }
      return item;
    }));

    // Mettre à jour dans unifolder_files_menu_items
    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const updated = parsed.map(item => item.id === renamingFileId ? { ...item, name: newFileName.trim() } : item);
        localStorage.setItem('unifolder_files_menu_items', JSON.stringify(updated));
      }
    } catch (e) {}

    // Si le fichier provient d'une matière, mettre à jour dans sa matière
    if (targetFile?.matiere) {
      try {
        const matKey = `unifolder_matiere_files_${targetFile.matiere}`;
        const matSaved = localStorage.getItem(matKey);
        if (matSaved) {
          const parsed: ImportedItem[] = JSON.parse(matSaved);
          const updated = parsed.map(item => item.id === renamingFileId ? { ...item, name: newFileName.trim() } : item);
          localStorage.setItem(matKey, JSON.stringify(updated));
        }
      } catch (e) {}
    }

    try {
      const legSaved = localStorage.getItem('unifolder_matiere_files');
      if (legSaved) {
        const parsed: ImportedItem[] = JSON.parse(legSaved);
        const updated = parsed.map(item => item.id === renamingFileId ? { ...item, name: newFileName.trim() } : item);
        localStorage.setItem('unifolder_matiere_files', JSON.stringify(updated));
      }
    } catch (e) {}

    if (targetFile) {
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const existingExt = targetFile.extension || (targetFile.name.includes('.') ? targetFile.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      StudyCloudAPI.registerFileMetadata({
        id: targetFile.id,
        userId,
        matiereId: targetFile.matiere || null,
        name: newFileName.trim(),
        size: targetFile.size,
        type: targetFile.type,
        extension: existingExt,
        r2Key: (targetFile as any).r2Key || null,
        fileUrl: targetFile.url,
        isFavorite: targetFile.isFavorite,
        isImported: true,
        lastImported: typeof targetFile.importedAt === 'number' ? targetFile.importedAt : Date.now()
      }).catch(() => {});
    }

    window.dispatchEvent(new Event('unifolder_files_updated'));
    setRenamingFileId(null);
    setSuccessMessage("Fichier renommé avec succès !");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDuplicate = (id: string) => {
    const fileToDup = importedFiles.find(item => item.id === id);
    if (!fileToDup) return;
    const now = Date.now();
    const newId = `file-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const duplicated: ImportedItem = {
      ...fileToDup,
      id: newId,
      name: fileToDup.name.includes('.') ? fileToDup.name.replace(/\.([^.]+)$/, ' (Copie).$1') : `${fileToDup.name} (Copie)`,
      importedAt: now,
      createdAt: now,
      timestamp: now
    };
    setImportedFiles(prev => [duplicated, ...prev]);
    localStorage.setItem('unifolder_last_imported_id', newId);

    // Sauvegarder la copie dans le bon stockage
    if (fileToDup.matiere) {
      try {
        const matKey = `unifolder_matiere_files_${fileToDup.matiere}`;
        const matSaved = localStorage.getItem(matKey);
        let list: ImportedItem[] = matSaved ? JSON.parse(matSaved) : [];
        list = [duplicated, ...list];
        localStorage.setItem(matKey, JSON.stringify(list));
      } catch (e) {}
    } else {
      try {
        const directSaved = localStorage.getItem('unifolder_files_menu_items');
        let list: ImportedItem[] = directSaved ? JSON.parse(directSaved) : [];
        list = [duplicated, ...list];
        localStorage.setItem('unifolder_files_menu_items', JSON.stringify(list));
      } catch (e) {}
    }

    window.dispatchEvent(new Event('unifolder_files_updated'));
    setOpenMenuId(null);
  };

  const handleToggleFavorite = (id: string) => {
    const file = importedFiles.find(item => item.id === id);
    const newFav = file ? !file.isFavorite : true;
    setImportedFiles(prev => prev.map(item => item.id === id ? { ...item, isFavorite: newFav } : item));
    setOpenMenuId(null);
    if (file) {
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      StudyCloudAPI.registerFileMetadata({
        id: file.id,
        userId,
        matiereId: file.matiere || null,
        name: file.name,
        size: file.size,
        type: file.type,
        extension: file.extension,
        r2Key: (file as any).r2Key || null,
        fileUrl: file.url,
        isFavorite: newFav,
        isImported: true,
        lastImported: typeof file.importedAt === 'number' ? file.importedAt : Date.now()
      }).catch(() => {});
    }
  };

  const handleDelete = (id: string) => {
    const fileToDelete = importedFiles.find(item => item.id === id);
    setImportedFiles(prev => prev.filter(item => item.id !== id));
    setOpenMenuId(null);
    setSelectedFileIds(prev => prev.filter(i => i !== id));
    deleteFileBlob(id);
    StudyCloudAPI.deleteFile(id).catch(() => {});

    // Supprimer du stockage direct
    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const filtered = parsed.filter(item => item.id !== id);
        localStorage.setItem('unifolder_files_menu_items', JSON.stringify(filtered));
      }
    } catch (e) {}

    // Si le fichier provient d'une matière, le supprimer de cette matière
    if (fileToDelete?.matiere) {
      try {
        const matKey = `unifolder_matiere_files_${fileToDelete.matiere}`;
        const matSaved = localStorage.getItem(matKey);
        if (matSaved) {
          const parsed: ImportedItem[] = JSON.parse(matSaved);
          const filtered = parsed.filter(item => item.id !== id);
          localStorage.setItem(matKey, JSON.stringify(filtered));
        }
      } catch (e) {}
    }

    // Supprimer également des clés historiques si présentes
    try {
      const legSaved = localStorage.getItem('unifolder_matiere_files');
      if (legSaved) {
        const parsed: ImportedItem[] = JSON.parse(legSaved);
        const filtered = parsed.filter(item => item.id !== id);
        localStorage.setItem('unifolder_matiere_files', JSON.stringify(filtered));
      }
    } catch (e) {}

    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const handleBatchDelete = () => {
    if (selectedFileIds.length === 0) return;
    const idsToDelete = [...selectedFileIds];
    const filesToDelete = importedFiles.filter(item => idsToDelete.includes(item.id));
    setImportedFiles(prev => prev.filter(item => !idsToDelete.includes(item.id)));

    idsToDelete.forEach(id => {
      deleteFileBlob(id);
      StudyCloudAPI.deleteFile(id).catch(() => {});
    });

    // Supprimer du stockage direct
    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const filtered = parsed.filter(item => !idsToDelete.includes(item.id));
        localStorage.setItem('unifolder_files_menu_items', JSON.stringify(filtered));
      }
    } catch (e) {}

    // Supprimer des matières respectives
    filesToDelete.forEach(f => {
      if (f.matiere) {
        try {
          const matKey = `unifolder_matiere_files_${f.matiere}`;
          const matSaved = localStorage.getItem(matKey);
          if (matSaved) {
            const parsed: ImportedItem[] = JSON.parse(matSaved);
            const filtered = parsed.filter(item => !idsToDelete.includes(item.id));
            localStorage.setItem(matKey, JSON.stringify(filtered));
          }
        } catch (e) {}
      }
    });

    // Supprimer des clés historiques
    try {
      const legSaved = localStorage.getItem('unifolder_matiere_files');
      if (legSaved) {
        const parsed: ImportedItem[] = JSON.parse(legSaved);
        const filtered = parsed.filter(item => !idsToDelete.includes(item.id));
        localStorage.setItem('unifolder_matiere_files', JSON.stringify(filtered));
      }
    } catch (e) {}

    window.dispatchEvent(new Event('unifolder_files_updated'));
    setSelectedFileIds([]);
    setIsSelectionMode(false);
  };

  const cleanupUnusedMatieres = () => {
    const updated = savedMatieres.filter(mat => {
      if (selectedMatiereIds.includes(mat.id)) return true;
      const storageKey = `unifolder_matiere_files_${mat.name}`;
      try {
        const existing = localStorage.getItem(storageKey);
        const list = existing ? JSON.parse(existing) : [];
        if (list.length > 0) return true;
      } catch (e) {}
      return false;
    });
    setSavedMatieres(updated);
    localStorage.setItem('unifolder_saved_matieres', JSON.stringify(updated));
  };

  const handleCloseModal = () => {
    cleanupUnusedMatieres();
    setClassifyFileIds(null);
    setSelectedMatiereIds([]);
  };

  const handleSaveClassification = () => {
    if (!classifyFileIds || classifyFileIds.length === 0) return;
    const selectedMats = savedMatieres.filter(m => selectedMatiereIds.includes(m.id));
    const matiereNames = selectedMats.map(m => m.name);
    const matiereString = matiereNames.join(', ');
    
    // Find all files being classified
    const filesToClassify = importedFiles.filter(item => classifyFileIds.includes(item.id));

    setImportedFiles(prev => prev.map(item => classifyFileIds.includes(item.id) ? { ...item, matiere: matiereString } : item));

    // Also add a copy of each file to each selected matiere's independent storage
    filesToClassify.forEach(fileToClassify => {
      matiereNames.forEach(matName => {
        const storageKey = `unifolder_matiere_files_${matName}`;
        try {
          const existing = localStorage.getItem(storageKey);
          let list: ImportedItem[] = existing ? JSON.parse(existing) : [];
          const copiedFile: ImportedItem = {
            ...fileToClassify,
            id: 'file-' + Math.random().toString(36).substring(2, 9),
            matiere: matName
          };
          list.push(copiedFile);
          localStorage.setItem(storageKey, JSON.stringify(list));
        } catch (e) {
          console.error(e);
        }
      });
    });

    cleanupUnusedMatieres();
    setClassifyFileIds(null);
    window.dispatchEvent(new Event('unifolder_files_updated'));
    setSuccessMessage("Ajouté avec succès !");
    setTimeout(() => {
      setSuccessMessage(null);
      setSelectedFileIds([]);
      setIsSelectionMode(false);
      setOpenMenuId(null);
      setSelectedMatiereIds([]);
    }, 1500);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 400;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => resolve(e.target?.result as string || '');
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = e.target.files;
      const newItems: ImportedItem[] = [];
      const imageFilesToCompress: { id: string; file: File }[] = [];
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const now = Date.now();

      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];

        // Contrôle de taille 50 Mo (paramétrable)
        if (f.size > MAX_FILE_SIZE_BYTES) {
          alert(`Le fichier "${f.name}" dépasse la limite actuelle de 50 Mo (${formatFileSize(f.size)}).`);
          continue;
        }

        const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(f.name);
        const id = `file-${now + i}-${Math.random().toString(36).substring(2, 7)}`;
        
        // 1. Stocker le blob dans IndexedDB
        await storeFileBlob(id, f);
        const localUrl = URL.createObjectURL(f);

        if (isImg) {
          imageFilesToCompress.push({ id, file: f });
        }

        const extVal = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : (f.type ? f.type.split('/').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
        newItems.push({
          id,
          name: f.name,
          size: f.size,
          type: f.type || 'Fichier',
          extension: extVal,
          url: localUrl,
          isImage: isImg,
          matiere: '',
          importedAt: now + i,
          createdAt: now + i,
          timestamp: now + i,
          isFavorite: false
        });

        // 2. Enregistrer dans Cloudflare D1
        StudyCloudAPI.registerFileMetadata({
          id,
          userId,
          matiereId: null,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          extension: extVal,
          r2Key: null,
          fileUrl: localUrl,
          isFavorite: false,
          isImported: true,
          lastImported: now + i
        }).catch(() => {});

        // 3. Upload vers R2 en arrière-plan
        const r2Key = `files/${userId}/${id}-${encodeURIComponent(f.name)}`;
        StudyCloudAPI.uploadFileToR2(f, r2Key).then((uploadRes) => {
          if (uploadRes && uploadRes.url) {
            StudyCloudAPI.registerFileMetadata({
              id,
              userId,
              matiereId: null,
              name: f.name,
              size: f.size,
              type: f.type || 'application/octet-stream',
              extension: extVal,
              r2Key: uploadRes.key,
              fileUrl: uploadRes.url,
              isFavorite: false,
              isImported: true,
              lastImported: now + i
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      // Placer en tête de liste pour affichage immédiat à l'en-tête même
      setImportedFiles(prev => [...newItems, ...prev]);
      startSavingAnimation(newItems.map(item => item.id));

      if (newItems.length > 0) {
        localStorage.setItem('unifolder_last_imported_id', newItems[newItems.length - 1].id);
      }

      // Sauvegarder dans unifolder_files_menu_items (en tête)
      try {
        const directSaved = localStorage.getItem('unifolder_files_menu_items');
        let directList: ImportedItem[] = directSaved ? JSON.parse(directSaved) : [];
        directList = [...newItems, ...directList];
        localStorage.setItem('unifolder_files_menu_items', JSON.stringify(directList));
        window.dispatchEvent(new Event('unifolder_files_updated'));
      } catch (e) {
        console.error(e);
      }

      try {
        const existingShares = JSON.parse(localStorage.getItem('unifolder_shares') || '[]');
        const folderTitle = newItems.length === 1 ? newItems[0].name : 'Publication (' + newItems.length + ' fichiers)';
        const newSharedFolder = {
          id: 'folder-' + Math.random().toString(36).substring(2, 9),
          title: folderTitle,
          description: 'Document ajouté dans Mes fichiers',
          category: 'Cours',
          author: 'Utilisateur',
          createdAt: new Date().toISOString(),
          files: newItems.map(item => ({
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
            url: item.url
          })),
          totalSize: newItems.reduce((acc, f) => acc + f.size, 0),
          downloadsCount: 0,
          isPasswordProtected: false,
          viewsCount: 0
        };
        localStorage.setItem('unifolder_shares', JSON.stringify([newSharedFolder, ...existingShares]));
      } catch (err) {
        console.error(err);
      }

      const successMsg = newItems.length > 1
        ? 'Fichiers importés avec succès dans Mes fichiers !'
        : 'Fichier importé avec succès dans Mes fichiers !';
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(null), 3500);

      imageFilesToCompress.forEach(({ id, file }) => {
        compressImage(file).then((dataUrl) => {
          if (dataUrl) {
            setImportedFiles(prev =>
              prev.map(item => item.id === id ? { ...item, url: dataUrl } : item)
            );
            try {
              const directSaved = localStorage.getItem('unifolder_files_menu_items');
              if (directSaved) {
                let directList: ImportedItem[] = JSON.parse(directSaved);
                directList = directList.map(item => item.id === id ? { ...item, url: dataUrl } : item);
                localStorage.setItem('unifolder_files_menu_items', JSON.stringify(directList));
              }
            } catch (e) {}
          }
        });
      });
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[72px] md:top-[76px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 py-8 overflow-y-auto transition-colors duration-300">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        onChange={handleFileChange} 
      />
      <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-start justify-between z-40 pointer-events-none gap-2">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
            <span>Retour</span>
          </button>

          <button
            onClick={handleButtonClick}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            title="Importer des fichiers"
          >
            <Upload className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
            <span>Importer</span>
          </button>
        </div>

        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white bg-[#E8DFD0] dark:bg-[#070a13] px-3 py-1 rounded-lg border-2 border-[#2D4A3E] dark:border-[#1e293b] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none self-start mt-0.5">
          Mes fichiers
        </h1>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <button
              onClick={() => setShowFilesMenuDropdown(!showFilesMenuDropdown)}
              className="p-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
              title="Options"
            >
              <MoreVertical className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
            </button>

            {showFilesMenuDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowFilesMenuDropdown(false)} 
                />
                <div className="absolute top-10 right-0 z-50 w-52 bg-white dark:bg-[#111a2e] border-2 border-stone-800 dark:border-[#334155] rounded-xl shadow-xl py-2 text-left animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFilesMenuDropdown(false);
                      setIsSearchOpen(true);
                    }}
                    className="w-full px-4 py-2 text-xs font-bold text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer border-b border-stone-100 dark:border-white/10"
                  >
                    <Search className="w-4 h-4 text-stone-600 dark:text-slate-400" />
                    <span>Recherche</span>
                  </button>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500">Trier par</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('recent');
                      setShowFilesMenuDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-xs font-medium ${sortBy === 'recent' ? 'bg-[#2D4A3E]/10 dark:bg-white/15 font-bold text-[#2D4A3E] dark:text-white' : 'text-stone-800 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-white/10'} flex items-center justify-between transition-colors cursor-pointer`}
                  >
                    <span>Plus récent</span>
                    {sortBy === 'recent' && <span className="text-[#2D4A3E] dark:text-orange-400">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('oldest');
                      setShowFilesMenuDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-xs font-medium ${sortBy === 'oldest' ? 'bg-[#2D4A3E]/10 dark:bg-white/15 font-bold text-[#2D4A3E] dark:text-white' : 'text-stone-800 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-white/10'} flex items-center justify-between transition-colors cursor-pointer`}
                  >
                    <span>Plus ancien</span>
                    {sortBy === 'oldest' && <span className="text-[#2D4A3E] dark:text-orange-400">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('size');
                      setShowFilesMenuDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-xs font-medium ${sortBy === 'size' ? 'bg-[#2D4A3E]/10 dark:bg-white/15 font-bold text-[#2D4A3E] dark:text-white' : 'text-stone-800 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-white/10'} flex items-center justify-between transition-colors cursor-pointer`}
                  >
                    <span>Taille</span>
                    {sortBy === 'size' && <span className="text-[#2D4A3E] dark:text-orange-400">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicatesOnly(!showDuplicatesOnly);
                      setShowFilesMenuDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-xs font-medium ${showDuplicatesOnly ? 'bg-[#2D4A3E]/10 dark:bg-white/15 font-bold text-[#2D4A3E] dark:text-white' : 'text-stone-800 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-white/10'} flex items-center justify-between transition-colors cursor-pointer border-t border-stone-100 dark:border-white/10`}
                  >
                    <span>📁 Afficher les doublons</span>
                    {showDuplicatesOnly && <span className="text-[#2D4A3E] dark:text-orange-400">✓</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isSearchOpen && (
        <div className="fixed top-[84px] md:top-[88px] left-4 right-4 z-50 bg-white border-3 border-stone-900 px-4 py-3 flex items-center justify-center gap-3 shadow-2xl rounded-2xl max-w-xl mx-auto animate-fadeIn">
          <div className="relative w-full flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-stone-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un fichier dans mes fichiers..."
              autoFocus
              className="w-full bg-stone-50 text-stone-900 text-xs sm:text-sm font-medium pl-9 pr-3 py-2 rounded-xl border-2 border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]"
            />
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="p-2 bg-stone-100 hover:bg-stone-200 border-2 border-stone-800 rounded-xl text-stone-700 hover:text-stone-900 transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-[1px_1px_0px_0px_#1c1917]"
            title="Fermer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Selection Action Bar */}
      {isSelectionMode && !classifyFileIds && (
        <div className="fixed top-[84px] md:top-[88px] left-2 right-2 md:left-[17.5rem] max-w-4xl mx-auto z-[99999] bg-[#FDFBF7] dark:bg-[#111a2e] border-2 border-stone-800 dark:border-[#334155] rounded-xl px-3 py-2 shadow-xl flex items-center justify-between gap-2 animate-fadeIn pointer-events-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-[#2D4A3E] text-white px-2 py-0.5 rounded-lg text-[11px] font-bold">
              {selectedFileIds.length} sélec.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                if (selectedFileIds.length > 0) {
                  setClassifyFileIds(selectedFileIds);
                }
              }}
              disabled={selectedFileIds.length === 0}
              className="px-1.5 py-1 bg-[#2D4A3E] hover:bg-[#1e332a] disabled:opacity-40 text-white font-bold text-[9.5px] rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              Classer dans les matières
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={selectedFileIds.length === 0}
              className="px-1.5 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-[9.5px] rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              {selectedFileIds.length > 1 ? 'Tout supprimer' : 'Supprimer'}
            </button>
            <button
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedFileIds([]);
              }}
              className="p-1 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg transition-all cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full px-2 sm:px-4 pt-20 sm:pt-24">
        <div className="pt-1 pb-64 w-full max-w-7xl mx-auto">
          {importedFiles.length === 0 ? (
            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-serif dark:font-sans dark:font-extrabold font-normal text-[#2D4A3E] dark:text-white mb-3 tracking-tight">Mes fichiers</h1>
              <p className="text-sm font-sans text-[#5C6B5A] dark:text-slate-400 mb-6">Sélectionnez et importez vos fichiers ou dossiers depuis votre appareil.</p>
              
              <div 
                onClick={handleButtonClick}
                className="border-3 border-dashed border-[#2D4A3E]/30 dark:border-blue-500/40 rounded-2xl p-8 bg-[#E8DFD0]/40 dark:bg-white/[0.04] dark:backdrop-blur-xl flex flex-col items-center justify-center cursor-pointer hover:bg-[#E8DFD0]/70 dark:hover:bg-white/[0.08] dark:hover:border-blue-400/60 dark:hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all max-w-lg mx-auto group"
              >
                <div className="w-16 h-16 bg-[#2D4A3E]/10 dark:bg-blue-500/20 rounded-full flex items-center justify-center mb-3 text-[#2D4A3E] dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="font-bold text-sm text-[#2D4A3E] dark:text-white mb-1">Cliquez pour importer des fichiers ou dossiers</p>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400">Ouvre le sélecteur natif de votre appareil</p>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <h1 className="text-2xl font-serif dark:font-sans dark:font-bold font-normal text-[#2D4A3E] dark:text-white mb-2">Mes fichiers</h1>
              <p className="text-sm text-[#5C6B5A] dark:text-slate-400">Aucun fichier ne correspond à votre recherche "{searchQuery}".</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 justify-items-center w-full">
                {filteredFiles.map((f, idx) => {
                  const ext = f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
                  const isPdf = ext === 'PDF';
                  const isWord = ext === 'DOC' || ext === 'DOCX';
                  const isExcel = ext === 'XLS' || ext === 'XLSX' || ext === 'CSV';
                  const isPpt = ext === 'PPT' || ext === 'PPTX';
                  const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG'].includes(ext);
                  
                  let bgColor = 'bg-stone-700';
                  if (isPdf) bgColor = 'bg-red-500';
                  else if (isWord) bgColor = 'bg-blue-600';
                  else if (isExcel) bgColor = 'bg-emerald-600';
                  else if (isPpt) bgColor = 'bg-orange-500';
                  else if (isImg) bgColor = 'bg-purple-600';

                   const isSelected = selectedFileIds.includes(f.id);
                   const isSaving = savingFileProgress[f.id] !== undefined;
                   const progressVal = savingFileProgress[f.id] || 0;

                   return (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (isSaving) {
                          setSuccessMessage("Enregistrement du fichier en cours dans la base... Veuillez patienter.");
                          setTimeout(() => setSuccessMessage(null), 2500);
                          return;
                        }
                        if (isSelectionMode) {
                          setSelectedFileIds(prev => 
                            isSelected ? prev.filter(i => i !== f.id) : [...prev, f.id]
                          );
                        } else {
                          setActivePreviewItem && setActivePreviewItem({ ...f, folderName: f.matiere || 'Mes fichiers' });
                        }
                      }} 
                      className={`group flex flex-col items-center w-full max-w-[90px] sm:max-w-[110px] relative ${openMenuId === f.id ? 'z-50' : 'z-0'} ${
                        isSaving ? 'cursor-wait select-none' : 'cursor-pointer hover:scale-105 transition-all'
                      }`}
                    >
                      {/* Selection Checkbox or Three dots button */}
                      {isSelectionMode ? (
                        <div className={`absolute top-2 left-2 z-30 w-5 h-5 rounded border-2 border-stone-800 flex items-center justify-center ${isSelected ? 'bg-[#2D4A3E] text-white' : 'bg-white'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      ) : !isSaving && (
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
                      )}

                      {openMenuId === f.id && !isSelectionMode && !isSaving && (
                        <div 
                          className="absolute top-9 left-0 z-50 bg-white text-stone-800 rounded-xl shadow-2xl border-2 border-stone-800 py-1.5 w-48 text-xs font-semibold animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-200 mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Options</span>
                            <button
                              onClick={() => setOpenMenuId(null)}
                              className="p-0.5 hover:bg-stone-200 rounded-md text-stone-600 hover:text-stone-900 cursor-pointer transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setClassifyFileIds([f.id]);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-b border-stone-200 cursor-pointer"
                          >
                            <span>📚 Classer dans les matières</span>
                          </button>

                          <button
                            onClick={() => {
                              handleToggleFavorite(f.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                          >
                            <span>❤️ {f.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                          </button>


                          <button
                            onClick={() => {
                              setRenamingFileId(f.id);
                              setNewFileName(f.name);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4 text-stone-600" />
                            <span>Renommer</span>
                          </button>
                          <button
                            onClick={() => {
                              handleDuplicate(f.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                          >
                            <Copy className="w-4 h-4 text-stone-600" />
                            <span>Dupliquer</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsSelectionMode(true);
                              setSelectedFileIds([f.id]);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                          >
                            <span>☑️ Sélectionner</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsSelectionMode(true);
                              setSelectedFileIds(importedFiles.map(item => item.id));
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                          >
                            <span>☑️ Tout sélectionner</span>
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(f.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors border-t border-stone-200 cursor-pointer"
                          >
                            <span>🗑️ Supprimer</span>
                          </button>
                        </div>
                      )}

                      <div className={`w-full aspect-[3/4] ${bgColor} rounded-xl shadow-[3px_3px_0px_0px_#1c1917] flex flex-col items-center justify-between p-3 text-white relative overflow-hidden transition-all ${
                        isSaving ? '' : 'group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_#1c1917]'
                      }`}>
                        {/* Petit trait en haut collé au fichier qui se remplit pendant l'enregistrement */}
                        {isSaving && (
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40 z-35 overflow-hidden pointer-events-none rounded-t-xl">
                            <div 
                              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
                              style={{ width: `${progressVal}%` }}
                            />
                          </div>
                        )}

                        {/* Overlay au milieu du fichier qui se remplit et empêche l'ouverture */}
                        {isSaving && (
                          <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-white pointer-events-none animate-fadeIn rounded-xl">
                            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
                            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
                              {progressVal}%
                            </span>
                            <span className="text-[7.5px] font-bold text-white/90 text-center leading-tight">
                              Enregistrement...
                            </span>
                          </div>
                        )}

                        {f.isFavorite && (
                          <div className="absolute top-2 right-8 z-20 w-6 h-6 rounded-full bg-white text-red-600 border-2 border-stone-800 flex items-center justify-center text-xs shadow-[1px_1px_0px_0px_#1c1917]">
                            ❤️
                          </div>
                        )}

                        {isImg && f.url ? (
                          <div className="absolute inset-0 w-full h-full bg-white overflow-hidden flex items-center justify-center z-0">
                            <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <>
                            {/* Folded corner effect */}
                            <div className="absolute top-0 right-0 w-8 h-8 bg-black/15 rounded-bl-xl pointer-events-none"></div>
                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-r-[16px] border-t-transparent border-r-white/30"></div>
                            <div className="my-auto text-center pt-2">
                              <span className="text-sm sm:text-lg font-black tracking-wider uppercase drop-shadow">{ext.slice(0, 4)}</span>
                            </div>
                          </>
                        )}
                        <div className="mt-auto z-10 self-center mb-1">
                          <span className="text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">{(f.size / 1024).toFixed(0)} Ko</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#2D4A3E] mt-2 text-center px-1 leading-tight line-clamp-2 break-all w-full">{f.name}</span>
                      {f.matiere && (
                        <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-[#2D4A3E] bg-[#E8DFD0] border border-[#2D4A3E]/40 rounded px-1.5 py-0.5 mt-1 max-w-[95%] truncate shadow-[1px_1px_0px_0px_#2D4A3E]">
                          {f.matiere}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Carte Importer avec "+" placée derrière les fichiers */}
                <div 
                  onClick={handleButtonClick}
                  className="group flex flex-col items-center w-full max-w-[90px] sm:max-w-[110px] cursor-pointer transition-all hover:scale-105 relative select-none"
                  title="Importer des fichiers"
                >
                  <div className="w-full aspect-[3/4] bg-white hover:bg-[#E8DFD0]/30 border-2 border-dashed border-[#2D4A3E]/60 hover:border-[#2D4A3E] rounded-xl shadow-[3px_3px_0px_0px_#1c1917] flex flex-col items-center justify-center p-3 text-[#2D4A3E] relative group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_#1c1917] transition-all">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#E8DFD0] border-2 border-[#2D4A3E] flex items-center justify-center text-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#2D4A3E] mt-2.5">
                      Ajouter
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#2D4A3E] mt-2 text-center px-1 leading-tight line-clamp-2 w-full">
                    Importer
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

            {renamingFileId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs overflow-y-auto p-4 flex items-start sm:items-center justify-center animate-fadeIn">
          <div className="bg-[#FDFBF7] rounded-2xl border-3 border-stone-800 shadow-[6px_6px_0px_0px_#1c1917] p-6 w-full max-w-sm text-stone-800 my-auto relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-[#2D4A3E]">Renommer le fichier</h3>
              <button 
                onClick={() => setRenamingFileId(null)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-stone-700" />
              </button>
            </div>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white rounded-xl border-2 border-stone-800 font-medium focus:outline-none mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
              }}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRenamingFileId(null)}
                className="flex-1 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 transition-all shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveRename}
                disabled={!newFileName.trim()}
                className="flex-1 py-2.5 bg-[#2D4A3E] hover:bg-[#1e332a] disabled:opacity-40 text-white font-bold text-xs rounded-xl border-2 border-stone-800 transition-all shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99999] bg-[#2D4A3E] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md border border-stone-700 animate-fadeIn flex items-center gap-2">
          <span>✨</span>
          <span>{successMessage}</span>
        </div>
      )}

            {/* Classification Modal */}
      {classifyFileIds && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs overflow-y-auto p-4 flex items-start sm:items-center justify-center animate-fadeIn">
          <div className="bg-[#FDFBF7] rounded-2xl border-3 border-stone-800 shadow-[6px_6px_0px_0px_#1c1917] p-6 w-full max-w-sm text-stone-800 my-auto relative">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-extrabold text-[#2D4A3E]">Classer dans les matières</h3>
              <button 
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-stone-700" />
              </button>
            </div>
            
            <div className="mb-3 px-3 py-1.5 bg-[#E8DFD0] rounded-xl border-2 border-stone-800 text-xs font-extrabold text-[#2D4A3E] flex items-center justify-between shadow-[2px_2px_0px_0px_#1c1917]">
              <span>Fichier{classifyFileIds.length > 1 ? 's' : ''} à classer :</span>
              <span className="bg-[#2D4A3E] text-white px-2.5 py-0.5 rounded-lg text-xs">{classifyFileIds.length} fichier{classifyFileIds.length > 1 ? 's' : ''}</span>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              Sélectionnez une ou plusieurs matières pour classer {classifyFileIds.length > 1 ? 'ces fichiers' : 'ce fichier'}.
            </p>

            {savedMatieres.length === 0 && !isAddingNewMatiere ? (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 mb-4">
                Aucune matière n'est enregistrée. Créez des matières ci-dessous ou dans l'onglet <strong>Emploi du temps</strong>.
              </p>
            ) : (
              <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                {isAddingNewMatiere && (
                  <div className="flex items-center gap-2 p-2 bg-[#E8DFD0] rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]">
                    <input
                      type="text"
                      placeholder="Nom de la matière..."
                      value={newMatiereName}
                      onChange={(e) => setNewMatiereName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white rounded-lg border-2 border-stone-800 font-medium focus:outline-none"
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Coef"
                      value={newMatiereCoef}
                      onChange={(e) => setNewMatiereCoef(e.target.value)}
                      className="w-14 px-2 py-1.5 text-xs bg-white rounded-lg border-2 border-stone-800 font-medium text-center focus:outline-none"
                    />
                    <button
                      onClick={() => setIsAddingNewMatiere(false)}
                      className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg border-2 border-stone-800 transition-colors cursor-pointer"
                      title="Annuler"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleAddNewMatiere}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg border-2 border-stone-800 transition-colors cursor-pointer"
                      title="Valider"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>
                )}

                {savedMatieres.map((mat, i) => {
                  const isChecked = selectedMatiereIds.includes(mat.id);
                  return (
                    <div
                      key={mat.id || i}
                      onClick={() => {
                        setSelectedMatiereIds(prev => 
                          isChecked ? prev.filter(id => id !== mat.id) : [...prev, mat.id]
                        );
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border-2 border-stone-800 font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isChecked ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'bg-white hover:bg-[#E8DFD0] text-[#2D4A3E] shadow-[2px_2px_0px_0px_#1c1917]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 border-stone-800 flex items-center justify-center ${isChecked ? 'bg-white text-[#2D4A3E]' : 'bg-white'}`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{mat.name}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${isChecked ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>Coef {mat.coefficient || '1'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 pt-3 border-t border-stone-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 transition-all shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveClassification}
                  disabled={selectedMatiereIds.length === 0}
                  className="flex-1 py-2.5 bg-[#2D4A3E] hover:bg-[#1e332a] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl border-2 border-stone-800 transition-all shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
              <button
                onClick={() => setIsAddingNewMatiere(true)}
                className="w-full py-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] font-bold text-xs rounded-xl border-2 border-stone-800 transition-all shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                + Ajouter une matière
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

