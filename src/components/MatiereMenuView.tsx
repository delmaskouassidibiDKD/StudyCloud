import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Edit3, ArrowLeft, Upload, File, MoreVertical, X, Search, Check, Copy, Plus, Download, Link as LinkIcon, Eye, EyeOff, Menu, Star } from 'lucide-react';
import { ImportedItem, getFileTimestamp, getDocumentTheme } from './FilesMenuView';
import { triggerDebouncedCloudBackup } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob, MAX_FILE_SIZE_BYTES, formatFileSize } from '../services/localFileStorage';
import { DocumentCardPreview } from './DocumentCardPreview';
import { ImageCardPreview } from './ImageCardPreview';
import { UploadQueue } from '../services/uploadQueue';
import { CloudDataStore } from '../services/cloudDataStore';
import { compressFile } from '../utils/fileCompressor';
import { useMatiereFilesList } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { safeLocalStorageSet, safeLocalStorageGet } from '../utils/safeStorage';
import { validateFilesForMesFichiersAsync } from '../services/fileTypeValidator';
import { IncompatibleFormatModal, IncompatibleAlertInfo } from './IncompatibleFormatModal';

interface MatiereMenuViewProps {
  matiereName: string;
  onBack: () => void;
  setActivePreviewItem?: (item: any) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export const MatiereMenuView: React.FC<MatiereMenuViewProps> = ({ matiereName, onBack, setActivePreviewItem, onOpenCreateShareLink }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [incompatibleAlertInfo, setIncompatibleAlertInfo] = useState<IncompatibleAlertInfo | null>(null);
  const storageKey = `unifolder_matiere_files_${matiereName}`;
  const currentKeyRef = useRef(storageKey);
  const { data: serverMatiereFiles = [], isLoading: isMatiereQueryLoading } = useMatiereFilesList(matiereName);
  
  const loadFilesForMatiere = (name: string) => {
    const key = `unifolder_matiere_files_${name}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            ...item,
            matiere: item.matiere || (item.isLeftMenuImport ? undefined : name),
            extension: item.extension || (item.name && item.name.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
          }));
        }
      } catch (e) {
        return [];
      }
    }

    return [];
  };

  const [importedFiles, setImportedFiles] = useState<ImportedItem[]>(() => loadFilesForMatiere(matiereName));

  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showMatiereMenuDropdown, setShowMatiereMenuDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'size'>('recent');

  // Mode aperçu (cartes avec miniature / mise en page Document Image 2) vs Mode compact (sans aperçu)
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(() => {
    return localStorage.getItem('studycloud_matiere_preview_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('studycloud_matiere_preview_mode', String(isPreviewMode));
  }, [isPreviewMode]);

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur lors du téléchargement:", err);
    }
  };

  const handleBatchDownload = async () => {
    const filesToDownload = importedFiles.filter(f => selectedFileIds.includes(f.id));
    for (const f of filesToDownload) {
      if (f.url) {
        await handleDownload(f.url, f.name);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    setIsSelectionMode(false);
    setSelectedFileIds([]);
  };

  const handleBatchShare = () => {
    const filesToShare = importedFiles.filter(f => selectedFileIds.includes(f.id));
    if (onOpenCreateShareLink && filesToShare.length > 0) {
      onOpenCreateShareLink(filesToShare);
      setIsSelectionMode(false);
      setSelectedFileIds([]);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [classifyFileIds, setClassifyFileIds] = useState<string[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newMatiereName, setNewMatiereName] = useState('');
  const [newMatiereCoef, setNewMatiereCoef] = useState('1');
  const [isAddingNewMatiere, setIsAddingNewMatiere] = useState(false);

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
    safeLocalStorageSet('unifolder_saved_matieres', updated);
    setSelectedMatiereIds(prev => [...prev, newMat.id]);
    setNewMatiereName('');
    setNewMatiereCoef('1');
    setIsAddingNewMatiere(false);

    // Enregistrement immédiat dans Cloudflare D1
    const userId = localStorage.getItem('unifolder_user_id');
    if (userId && userId !== 'default-user') {
      StudyCloudAPI.createMatiere({
        id: newMat.id,
        userId,
        name: newMat.name,
        coefficient: Number(newMat.coefficient) || 1,
        color: '#EA580C'
      }).catch(() => {});
    }

    invalidateCloudQueries.matieresList();
    window.dispatchEvent(new Event('unifolder_matieres_updated'));
  };

  const isInitialMatiereMount = useRef(true);
  useEffect(() => {
    if (isInitialMatiereMount.current) {
      isInitialMatiereMount.current = false;
      return;
    }
    safeLocalStorageSet('unifolder_saved_matieres', savedMatieres);
    triggerDebouncedCloudBackup();
  }, [savedMatieres]);

  useEffect(() => {
    const handleDataRestored = () => {
      const userId = localStorage.getItem('unifolder_user_id');
      if (userId && userId !== 'default-user') {
        StudyCloudAPI.getMatieres(userId).then(res => {
          if (res && res.success && Array.isArray(res.data)) {
            const apiMatieres = res.data.map((m: any, idx: number) => ({
              id: m.id || ('mat-' + Date.now() + '-' + idx),
              name: m.name,
              coefficient: String(m.coefficient ?? '1'),
              color: m.color || '#EA580C'
            }));
            setSavedMatieres(apiMatieres);
            safeLocalStorageSet('unifolder_saved_matieres', apiMatieres);
          }
        }).catch(() => {});
      } else {
        const saved = localStorage.getItem('unifolder_saved_matieres');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setSavedMatieres(parsed.map((m: any, idx: number) => ({
              id: m.id || ('mat-' + Math.random().toString(36).substring(2, 9) + '-' + idx),
              name: m.name,
              coefficient: m.coefficient,
              color: m.color
            })));
          } catch (e) {}
        } else {
          setSavedMatieres([]);
        }
      }
    };

    handleDataRestored();
    window.addEventListener('unifolder_data_restored', handleDataRestored);
    window.addEventListener('unifolder_matieres_updated', handleDataRestored);
    return () => {
      window.removeEventListener('unifolder_data_restored', handleDataRestored);
      window.removeEventListener('unifolder_matieres_updated', handleDataRestored);
    };
  }, []);

  const [selectedMatiereIds, setSelectedMatiereIds] = useState<string[]>([]);

  // Progression d'enregistrement en arrière-plan des fichiers importés (fileId -> pourcentage 0 à 100)
  const [savingFileProgress, setSavingFileProgress] = useState<Record<string, number>>({});

  const startSavingAnimation = (fileIds: string[]) => {
    if (!fileIds || fileIds.length === 0) return;

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
    if (!isSearchOpen) {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  const filteredFiles = importedFiles.filter(f => {
    if (f.isLeftMenuImport) return false;

    if (showDuplicatesOnly) {
      const isDup = f.name.includes('(Copie)') || importedFiles.filter(item => item.name.toLowerCase() === f.name.toLowerCase() && !item.isLeftMenuImport).length > 1;
      if (!isDup) return false;
    }
    return (
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }).sort((a, b) => {
    if (!!a.isFavorite !== !!b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }
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
      // 'recent' : les plus récents en premier
      const timeA = getFileTimestamp(a);
      const timeB = getFileTimestamp(b);
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    }
  });

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

  // Synchronisation réactive continue avec TanStack Query
  useEffect(() => {
    if (serverMatiereFiles && Array.isArray(serverMatiereFiles)) {
      setImportedFiles(prev => {
        const serverMap = new Map<string, ImportedItem>();
        serverMatiereFiles.forEach(f => serverMap.set(f.id, f));

        // Conserver les fichiers en attente ou récents non encore sur le serveur
        const pending = prev.filter(f => !serverMap.has(f.id));
        const merged = [...pending, ...serverMatiereFiles];
        safeLocalStorageSet(storageKey, merged);
        return merged;
      });
    }
  }, [serverMatiereFiles, storageKey]);

  // Recharger les fichiers locaux si la matière change
  useEffect(() => {
    currentKeyRef.current = storageKey;
    const local = loadFilesForMatiere(matiereName);
    setImportedFiles(local);
  }, [matiereName, storageKey]);

  useEffect(() => {
    const handleRestore = () => {
      const local = loadFilesForMatiere(matiereName);
      if (local && local.length > 0) {
        setImportedFiles(local);
      }
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, [matiereName]);

  // Sauvegarder uniquement pour la matière active (protégé contre dépassement de quota)
  useEffect(() => {
    if (currentKeyRef.current === storageKey && importedFiles.length > 0) {
      safeLocalStorageSet(storageKey, importedFiles);
      window.dispatchEvent(new Event('unifolder_files_updated'));
    }
  }, [importedFiles, storageKey]);

  const handleDelete = (id: string) => {
    setImportedFiles(prev => prev.filter(item => item.id !== id));
    setOpenMenuId(null);
    setSelectedFileIds(prev => prev.filter(i => i !== id));
    deleteFileBlob(id);
    StudyCloudAPI.deleteFile(id).catch(() => {});

    // Supprimer également de "Mes fichiers"
    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const filtered = parsed.filter(item => item.id !== id);
        safeLocalStorageSet('unifolder_files_menu_items', filtered);
      }
    } catch (e) {}

    invalidateCloudQueries.matiereFiles(matiereName);
    invalidateCloudQueries.filesMenu();
    invalidateCloudQueries.overview();

    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const handleBatchDelete = () => {
    if (selectedFileIds.length === 0) return;
    const idsToDelete = [...selectedFileIds];
    setImportedFiles(prev => prev.filter(item => !idsToDelete.includes(item.id)));
    setSelectedFileIds([]);
    setIsSelectionMode(false);
    idsToDelete.forEach(id => {
      deleteFileBlob(id);
      StudyCloudAPI.deleteFile(id).catch(() => {});
    });

    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const filtered = parsed.filter(item => !idsToDelete.includes(item.id));
        safeLocalStorageSet('unifolder_files_menu_items', filtered);
      }
    } catch (e) {}

    invalidateCloudQueries.matiereFiles(matiereName);
    invalidateCloudQueries.filesMenu();
    invalidateCloudQueries.overview();

    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const handleToggleFavorite = (id: string) => {
    const file = importedFiles.find(item => item.id === id);
    const newFav = file ? !file.isFavorite : true;
    setImportedFiles(prev => prev.map(item => item.id === id ? { ...item, isFavorite: newFav } : item));
    setOpenMenuId(null);

    // Mettre à jour dans "Mes fichiers"
    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const updated = parsed.map(item => item.id === id ? { ...item, isFavorite: newFav } : item);
        safeLocalStorageSet('unifolder_files_menu_items', updated);
      }
    } catch (e) {}

    StudyCloudAPI.toggleFileFavorite(id, newFav).catch(() => {
      if (file) {
        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        const targetMat = savedMatieres.find(m => m.name.toLowerCase() === matiereName.toLowerCase() || m.id === matiereName);
        const resolvedMatiereId = targetMat?.id || file.matiere || matiereName;
        StudyCloudAPI.registerFileMetadata({
          id: file.id,
          userId,
          matiereId: resolvedMatiereId,
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
    });

    invalidateCloudQueries.matiereFiles(matiereName);
    invalidateCloudQueries.filesMenu();
    invalidateCloudQueries.favorites();

    window.dispatchEvent(new Event('unifolder_files_updated'));
  };

  const handleSaveRename = () => {
    if (!renamingFileId || !newFileName.trim()) return;
    const targetFile = importedFiles.find(item => item.id === renamingFileId);
    const existingExt = targetFile?.extension || (targetFile?.name.includes('.') ? targetFile.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
    
    setImportedFiles(prev => prev.map(item => {
      if (item.id === renamingFileId) {
        return {
          ...item,
          name: newFileName.trim(),
          extension: existingExt
        };
      }
      return item;
    }));

    if (targetFile) {
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const targetMat = savedMatieres.find(m => m.name.toLowerCase() === matiereName.toLowerCase() || m.id === matiereName);
      const resolvedMatiereId = targetMat?.id || targetFile.matiere || matiereName;
      StudyCloudAPI.registerFileMetadata({
        id: targetFile.id,
        userId,
        matiereId: resolvedMatiereId,
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

    invalidateCloudQueries.matiereFiles(matiereName);
    invalidateCloudQueries.filesMenu();

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
      matiere: matiereName,
      importedAt: now,
      createdAt: now,
      timestamp: now
    };
    setImportedFiles(prev => [duplicated, ...prev]);
    try {
      localStorage.setItem('unifolder_last_imported_id', newId);
    } catch (e) {}

    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.registerFileMetadata({
      id: newId,
      userId,
      matiereId: duplicated.matiere || null,
      name: duplicated.name,
      size: duplicated.size,
      type: duplicated.type,
      extension: duplicated.extension,
      r2Key: (duplicated as any).r2Key || null,
      fileUrl: duplicated.url,
      isFavorite: duplicated.isFavorite,
      isImported: true,
      lastImported: now
    }).catch(() => {});

    invalidateCloudQueries.matiereFiles(matiereName);
    invalidateCloudQueries.filesMenu();

    window.dispatchEvent(new Event('unifolder_files_updated'));
    setOpenMenuId(null);
  };

  const cleanupUnusedMatieres = () => {
    const updated = savedMatieres.filter(mat => {
      if (selectedMatiereIds.includes(mat.id)) return true;
      const storageKeyMat = `unifolder_matiere_files_${mat.name}`;
      try {
        const existing = localStorage.getItem(storageKeyMat);
        const list = existing ? JSON.parse(existing) : [];
        if (list.length > 0) return true;
      } catch (e) {}
      return false;
    });
    setSavedMatieres(updated);
    safeLocalStorageSet('unifolder_saved_matieres', updated);
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
    
    const filesToClassify = importedFiles.filter(item => classifyFileIds.includes(item.id));

    filesToClassify.forEach(fileToClassify => {
      matiereNames.forEach(matName => {
        const targetKey = `unifolder_matiere_files_${matName}`;
        try {
          const existing = localStorage.getItem(targetKey);
          let list: ImportedItem[] = existing ? JSON.parse(existing) : [];
          const copiedFile: ImportedItem = {
            ...fileToClassify,
            id: 'file-' + Math.random().toString(36).substring(2, 9),
            matiere: matName
          };
          list.push(copiedFile);
          safeLocalStorageSet(targetKey, list);
        } catch (e) {
          console.error(e);
        }
      });
    });

    invalidateCloudQueries.matiereFiles(matiereName);
    matiereNames.forEach(matName => invalidateCloudQueries.matiereFiles(matName));
    invalidateCloudQueries.filesMenu();

    cleanupUnusedMatieres();
    setClassifyFileIds(null);
    setSelectedMatiereIds([]);
    setIsSelectionMode(false);
    setSelectedFileIds([]);
    window.dispatchEvent(new Event('unifolder_files_updated'));
    setSuccessMessage("Ajouté avec succès !");
    setTimeout(() => setSuccessMessage(null), 3000);
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

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFiles = async (fileList: FileList | File[]) => {
    try {
      const MAX_IMPORT_FILES = 10;
      let files = Array.from(fileList) as File[];
      if (files.length > MAX_IMPORT_FILES) {
        alert(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`);
        files = files.slice(0, MAX_IMPORT_FILES);
      }

      // Validation stricte par Magic Numbers & signatures binaires réelles (bloque Son, Vidéo, Application)
      const { validFiles, rejectedFiles } = await validateFilesForMesFichiersAsync(files, matiereName || 'Matière');

      if (rejectedFiles.length > 0) {
        const first = rejectedFiles[0];

        // OUVERTURE IMMÉDIATE DU MODAL D'ALERTE ROUGE AU MILIEU DE L'ÉCRAN
        setIncompatibleAlertInfo({
          fileName: first.file.name,
          detectedCategory: first.detectedLabel,
          menuLabel: matiereName || 'Matière',
          dedicatedMenu: first.dedicatedMenu,
          reason: first.reason,
        });

        if (validFiles.length === 0) {
          return; // Blocage total : aucun upload ni apparition
        }
      }

      if (validFiles.length === 0) return;
      files = validFiles;

      const newItems: ImportedItem[] = [];
      const itemsWithFiles: { file: File | Blob; item: any; originalSizeBytes?: number; originalSizeFormatted?: string }[] = [];
      const imageFilesToCompress: { id: string; file: File }[] = [];

      const now = Date.now();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];

        // Contrôle de taille 50 Mo (paramétrable)
        if (f.size > MAX_FILE_SIZE_BYTES) {
          alert(`Le fichier "${f.name}" dépasse la limite actuelle de 50 Mo (${formatFileSize(f.size)}).`);
          continue;
        }

        // COMPRESSION CLIENT TRANSPARENTE TOUT EN PRÉSERVANT LES VRAIES VALEURS D'ORIGINE
        const compResult = await compressFile(f);
        const fileToStore = compResult.file;

        const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(f.name);
        const id = `matiere-${matiereName.replace(/\s+/g, '_')}-${now + i}-${Math.random().toString(36).substring(2, 7)}`;

        // 1. Stocker le blob optimisé dans IndexedDB (0ms, accès instantané)
        await storeFileBlob(id, fileToStore as any);
        const localUrl = URL.createObjectURL(fileToStore);

        if (isImg) {
          imageFilesToCompress.push({ id, file: f });
        }

        const extVal = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : (f.type ? f.type.split('/').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');

        // L'utilisateur voit TOUJOURS sa vraie taille d'origine non compressée
        const itemObj: ImportedItem = {
          id,
          name: f.name,
          size: compResult.originalSizeBytes,
          type: f.type || 'Fichier',
          extension: extVal,
          url: localUrl,
          isImage: isImg,
          matiere: matiereName,
          importedAt: now + i,
          createdAt: now + i,
          timestamp: now + i,
          isFavorite: false
        };
        newItems.push(itemObj);

        // 2. Préparer les métadonnées pour UploadQueue (D1 + R2 en arrière-plan)
        itemsWithFiles.push({
          file: fileToStore,
          item: {
            ...itemObj,
            // Champs attendus par CloudDataStore / UploadQueue
            category: isImg ? 'images' : (
              f.type.startsWith('video/') ? 'videos' :
              f.type.startsWith('audio/') ? 'audio' : 'documents'
            ),
            source: matiereName,
            size: compResult.originalSizeFormatted,
            sizeBytes: compResult.originalSizeBytes,
            date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
            url: localUrl,
            previewUrl: localUrl,
            videoUrl: f.type.startsWith('video/') ? localUrl : undefined,
            audioUrl: f.type.startsWith('audio/') ? localUrl : undefined,
          },
          originalSizeBytes: compResult.originalSizeBytes,
          originalSizeFormatted: compResult.originalSizeFormatted
        });

        // 3. Enregistrement D1 immédiat (sans attendre R2)
        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        const targetMat = savedMatieres.find(m => m.name.toLowerCase() === matiereName.toLowerCase() || m.id === matiereName);
        const targetMatiereId = targetMat?.id || matiereName;
        StudyCloudAPI.registerFileMetadata({
          id,
          userId,
          matiereId: targetMatiereId,
          name: f.name,
          size: compResult.originalSizeBytes,
          type: f.type || 'application/octet-stream',
          extension: extVal,
          r2Key: null,
          fileUrl: localUrl,
          isFavorite: false,
          isImported: true,
          lastImported: now + i,
          originalSizeBytes: compResult.originalSizeBytes,
          compressedSizeBytes: compResult.compressedSizeBytes,
          compressionRatio: compResult.compressionRatio
        }).catch(() => {});
      }

      if (newItems.length === 0) return;

      // 4. Affichage immédiat (optimiste) + animation de progression
      setImportedFiles(prev => [...newItems, ...prev]);
      startSavingAnimation(newItems.map(item => item.id));

      // 5. CloudDataStore.addOptimisticFile — sync multi-appareils immédiate
      newItems.forEach(item => {
        CloudDataStore.addOptimisticFile(item as any);
      });

      const targetMatForQueue = savedMatieres.find(m => m.name.toLowerCase() === matiereName.toLowerCase() || m.id === matiereName);
      // 6. UploadQueue.enqueueExisting — R2 en arrière-plan avec retry automatique
      UploadQueue.enqueueExisting(itemsWithFiles, {
        category: 'documents',
        uploadSource: `matiere-${matiereName}`,
        folderId: targetMatForQueue?.id || matiereName
      });

      // Ajouter automatiquement et immédiatement dans "Mes fichiers" avec le tag de matière
      try {
        const directSaved = localStorage.getItem('unifolder_files_menu_items');
        let directList: ImportedItem[] = directSaved ? JSON.parse(directSaved) : [];
        const newIds = new Set(newItems.map(item => item.id));
        directList = [...newItems, ...directList.filter(item => !newIds.has(item.id))];
        safeLocalStorageSet('unifolder_files_menu_items', directList);
      } catch (e) {
        console.error(e);
      }

      if (newItems.length > 0) {
        try {
          localStorage.setItem('unifolder_last_imported_id', newItems[newItems.length - 1].id);
        } catch (e) {}
        window.dispatchEvent(new Event('unifolder_files_updated'));
      }

      // Invalider les requêtes TanStack Query
      invalidateCloudQueries.matiereFiles(matiereName);
      invalidateCloudQueries.filesMenu();
      invalidateCloudQueries.overview();

      try {
        const existingShares = JSON.parse(localStorage.getItem('unifolder_shares') || '[]');
        const folderTitle = newItems.length === 1 ? newItems[0].name : 'Publication (' + newItems.length + ' fichiers)';
        const newSharedFolder = {
          id: 'folder-' + Math.random().toString(36).substring(2, 9),
          title: folderTitle,
          description: `Document ajouté dans ${matiereName}`,
          category: 'Cours',
          author: 'Utilisateur',
          createdAt: new Date().toISOString(),
          files: newItems.map(item => ({
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
            url: item.url && !item.url.startsWith('data:') ? item.url : ''
          })),
          totalSize: newItems.reduce((acc, f) => acc + f.size, 0),
          downloadsCount: 0,
          isPasswordProtected: false,
          viewsCount: 0
        };
        const trimmedShares = [newSharedFolder, ...existingShares].slice(0, 30);
        safeLocalStorageSet('unifolder_shares', trimmedShares);
      } catch (err) {
        console.error(err);
      }

      const successMsg = newItems.length > 1
        ? `Fichiers importés avec succès dans ${matiereName} !`
        : `Fichier importé avec succès dans ${matiereName} !`;
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(null), 3500);

      imageFilesToCompress.forEach(({ id, file }) => {
        compressImage(file).then((dataUrl) => {
          if (dataUrl) {
            setImportedFiles(prev =>
              prev.map(item => item.id === id ? { ...item, url: dataUrl } : item)
            );
          }
        });
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#C5B0A4] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 pb-8 pt-0 overflow-y-auto transition-colors duration-300 ${
        isDraggingOver ? 'ring-4 ring-emerald-500 ring-inset bg-emerald-50/20' : ''
      }`}
    >
      {/* Drag & drop overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-[#2D4A3E]/85 backdrop-blur-sm border-4 border-dashed border-emerald-400 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-white/20 border-2 border-white text-white flex items-center justify-center mb-4 shadow-xl animate-bounce">
            <Upload className="w-10 h-10 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-white drop-shadow-md">Déposez vos fichiers ici</h2>
          <p className="text-sm font-bold text-emerald-100 mt-1">Ils seront importés directement dans « {matiereName} »</p>
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        onChange={handleFileChange} 
      />
      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-start justify-between z-40 pointer-events-none gap-2">
        <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
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

        <h1 
          className={`pointer-events-auto font-sans text-xs sm:text-sm font-bold px-3 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[180px] sm:max-w-xs text-center self-start ${savedMatieres.find(m => m.name === matiereName)?.color || 'text-[#2D4A3E] dark:text-white bg-[#E8DFD0] dark:bg-[#070a13]'}`}
          title={matiereName}
        >
          {matiereName}
        </h1>

        <div className="pointer-events-auto shrink-0 relative flex items-center gap-1.5 self-start">
          {/* Bouton œil pour basculer Mode compact (sans aperçu) / Mode aperçu */}
          <button
            type="button"
            onClick={() => setIsPreviewMode(prev => !prev)}
            className={`p-1.5 rounded-lg border-2 shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center ${
              isPreviewMode
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

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsHeaderMenuOpen(!isHeaderMenuOpen);
            }}
            className="p-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center"
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
          </button>

          {isHeaderMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setIsHeaderMenuOpen(false)} 
              />
              <div className="absolute top-10 right-0 z-50 w-52 bg-white dark:bg-[#111a2e] border-2 border-stone-800 dark:border-[#334155] rounded-xl shadow-xl py-2 text-left animate-in fade-in duration-150">
                {/* Option bascule aperçu / compact dans le petit menu */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewMode(prev => !prev);
                    setIsHeaderMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center justify-between transition-colors cursor-pointer border-b border-stone-100"
                >
                  <div className="flex items-center gap-2.5">
                    {isPreviewMode ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-stone-600" />}
                    <span>{isPreviewMode ? "Mode aperçu (actif)" : "Mode compact (sans aperçu)"}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-stone-400">
                    {isPreviewMode ? "Aperçu" : "Compact"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setIsSearchOpen(true);
                  }}
                  className="w-full px-4 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 transition-colors cursor-pointer border-b border-stone-100"
                >
                  <Search className="w-4 h-4 text-stone-600" />
                  <span>Recherche</span>
                </button>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Trier par</div>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('recent');
                    setIsHeaderMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-xs font-medium ${sortBy === 'recent' ? 'bg-[#2D4A3E]/10 font-bold text-[#2D4A3E]' : 'text-stone-800 hover:bg-stone-100'} flex items-center justify-between transition-colors cursor-pointer`}
                >
                  <span>Plus récent</span>
                  {sortBy === 'recent' && <span className="text-[#2D4A3E]">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('oldest');
                    setIsHeaderMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-xs font-medium ${sortBy === 'oldest' ? 'bg-[#2D4A3E]/10 font-bold text-[#2D4A3E]' : 'text-stone-800 hover:bg-stone-100'} flex items-center justify-between transition-colors cursor-pointer`}
                >
                  <span>Plus ancien</span>
                  {sortBy === 'oldest' && <span className="text-[#2D4A3E]">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('size');
                    setIsHeaderMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-xs font-medium ${sortBy === 'size' ? 'bg-[#2D4A3E]/10 font-bold text-[#2D4A3E]' : 'text-stone-800 hover:bg-stone-100'} flex items-center justify-between transition-colors cursor-pointer`}
                >
                  <span>Taille</span>
                  {sortBy === 'size' && <span className="text-[#2D4A3E]">✓</span>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <div className="fixed top-[66px] md:top-[70px] left-4 right-4 z-50 bg-white border-3 border-stone-900 px-4 py-3 flex items-center justify-center gap-3 shadow-2xl rounded-2xl max-w-xl mx-auto animate-fadeIn">
          <div className="relative w-full flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-stone-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Rechercher un fichier dans ${matiereName}...`}
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
        <div className="fixed top-[66px] md:top-[70px] left-2 right-2 md:left-[17.5rem] max-w-4xl mx-auto z-[99999] bg-[#FDFBF7] dark:bg-[#111a2e] border-2 border-stone-800 dark:border-[#334155] rounded-xl px-3 py-2 shadow-xl flex items-center justify-between gap-2 animate-fadeIn pointer-events-auto">
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
              onClick={handleBatchShare}
              disabled={selectedFileIds.length === 0}
              className="px-1.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-[9.5px] rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <LinkIcon className="w-3 h-3" />
              <span>Créer un lien de partage</span>
            </button>
            <button
              onClick={handleBatchDownload}
              disabled={selectedFileIds.length === 0}
              className="px-1.5 py-1 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-white font-bold text-[9.5px] rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Télécharger</span>
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

      <div className="w-full px-2 sm:px-4 pt-11 sm:pt-12">
        <div className="pt-1 pb-64 w-full max-w-7xl mx-auto">
          {filteredFiles.length === 0 ? (
            <div className="text-center pt-2">
              <p className="text-xs font-sans text-[#5C6B5A] mb-6">Importez vos cours, exercices et documents pour cette matière.</p>
              
              <div 
                onClick={handleButtonClick}
                className="border-3 border-dashed border-[#2D4A3E]/30 rounded-2xl p-8 bg-[#E8DFD0]/40 flex flex-col items-center justify-center cursor-pointer hover:bg-[#E8DFD0]/70 transition-all max-w-lg mx-auto"
              >
                <div className="w-16 h-16 bg-[#2D4A3E]/10 rounded-full flex items-center justify-center mb-3 text-[#2D4A3E]">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="font-bold text-sm text-[#2D4A3E] mb-1">Cliquez pour importer des fichiers pour {matiereName}</p>
                <p className="text-xs text-[#5C6B5A]">Ouvre le sélecteur natif de votre appareil</p>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {/* Entête mode aperçu avec compteur de fichiers */}
              {isPreviewMode && (
                <div className="mb-3 px-1 text-xs font-bold text-stone-600 dark:text-slate-400 flex items-center justify-between">
                  <span>{filteredFiles.length} fichier{filteredFiles.length > 1 ? 's' : ''} disponible{filteredFiles.length > 1 ? 's' : ''}</span>
                  <span className="text-[10px] uppercase tracking-wider bg-stone-200/70 dark:bg-white/10 px-2 py-0.5 rounded font-mono">
                    Mode Aperçu
                  </span>
                </div>
              )}

              {isPreviewMode ? (
                /* Grille en mode aperçu (style Documents Image 2) */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 justify-items-stretch w-full pt-2">
                  {filteredFiles.map((f, idx) => {
                    const ext = f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
                    const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF'].includes(ext) || f.isImage;
                    const theme = getDocumentTheme(ext);
                    const isSelected = selectedFileIds.includes(f.id);
                    const isSaving = savingFileProgress[f.id] !== undefined;
                    const progressVal = savingFileProgress[f.id] || 0;
                    const formattedSize = typeof f.size === 'number' ? formatFileSize(f.size) : (f.size || '0 Ko');
                    const isMenuOpen = openMenuId === f.id;

                    return (
                      <div
                        key={f.id || idx}
                        style={{ background: theme.bg }}
                        onClick={() => {
                          if (isSaving) {
                            setSuccessMessage("Enregistrement du fichier en cours dans la base... Veuillez patienter.");
                            setTimeout(() => setSuccessMessage(null), 2500);
                            return;
                          }
                          if (isSelectionMode) {
                            setOpenMenuId(null);
                            setSelectedFileIds(prev => 
                              isSelected ? prev.filter(i => i !== f.id) : [...prev, f.id]
                            );
                          } else {
                            setActivePreviewItem && setActivePreviewItem({ ...f, folderName: matiereName });
                          }
                        }}
                        className={`aspect-[3/4] ${theme.border} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none ${
                          isSaving
                            ? 'border-emerald-500/40 cursor-wait'
                            : isSelected
                              ? 'ring-4 ring-amber-400 shadow-2xl scale-[1.02] cursor-pointer'
                              : 'hover:scale-[1.01] shadow-md cursor-pointer active:scale-98'
                        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
                      >
                        {/* Trait de progression d'enregistrement en haut */}
                        {isSaving && (
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
                            <div 
                              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
                              style={{ width: `${progressVal}%` }}
                            />
                          </div>
                        )}

                        {/* Overlay d'enregistrement au milieu */}
                        {isSaving && (
                          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none animate-fadeIn rounded-2xl">
                            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
                            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
                              {progressVal}%
                            </span>
                            <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
                              Enregistrement Cloud...
                            </span>
                          </div>
                        )}

                        {/* Barre supérieure : Bouton 3 traits, Checkbox & Taille */}
                        <div className="flex items-center justify-between gap-1 z-20 relative">
                          <div className="flex items-center gap-1.5">
                            {isSelectionMode ? (
                              <div className={`w-5 h-5 rounded border-2 border-stone-800 flex items-center justify-center ${isSelected ? 'bg-[#2D4A3E] text-white' : 'bg-white'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            ) : !isSaving && (
                              <div className="relative">
                                <button
                                  type="button"
                                  disabled={isSelectionMode || selectedFileIds.length > 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSelectionMode || selectedFileIds.length > 0) return;
                                    setOpenMenuId(isMenuOpen ? null : f.id);
                                  }}
                                  className={`p-1 sm:p-1.2 rounded-lg bg-black/40 text-white border border-white/20 transition-all flex items-center justify-center shadow-sm ${
                                    isSelectionMode || selectedFileIds.length > 0
                                      ? 'opacity-20 cursor-not-allowed pointer-events-none'
                                      : 'hover:bg-black/70 cursor-pointer active:scale-90'
                                  }`}
                                  title={isSelectionMode || selectedFileIds.length > 0 ? "Menu désactivé en mode sélection" : "Options du fichier (3 traits)"}
                                >
                                  <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
                                </button>

                                {isMenuOpen && !isSelectionMode && selectedFileIds.length === 0 && !isSaving && (
                                  <div 
                                    className="absolute top-8 left-0 z-50 bg-white text-stone-800 rounded-xl shadow-2xl border-2 border-stone-800 py-1.5 w-48 text-xs font-semibold animate-fadeIn"
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
                                        if (f.url) handleDownload(f.url, f.name);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                                    >
                                      <Download className="w-4 h-4 text-stone-600" />
                                      <span>Télécharger</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (onOpenCreateShareLink) onOpenCreateShareLink([f]);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                                    >
                                      <LinkIcon className="w-4 h-4 text-stone-600" />
                                      <span>Créer un lien de partage</span>
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
                              </div>
                            )}

                            {f.isFavorite && (
                              <span className="p-0.5 rounded bg-black/60 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              </span>
                            )}
                          </div>

                          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
                            {formattedSize}
                          </span>
                        </div>

                        {/* Corps de carte / aperçu réel du document */}
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

                        {/* Titre unique en bas */}
                        <div className="px-0.5 mb-1">
                          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={f.name}>
                            {f.name}
                          </p>
                        </div>

                        {/* Pied de carte : typeBadge et bouton télécharger */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
                          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
                            {theme.typeBadge}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (f.url) handleDownload(f.url, f.name);
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

                  {/* Carte Importer "+" version aperçu */}
                  <div 
                    onClick={handleButtonClick}
                    className="group aspect-[3/4] rounded-2xl border-2 border-dashed border-[#2D4A3E]/60 dark:border-slate-500/60 hover:border-[#2D4A3E] dark:hover:border-white bg-[#E8DFD0]/30 dark:bg-white/[0.04] hover:bg-[#E8DFD0]/70 dark:hover:bg-white/[0.08] shadow-[2.5px_2.5px_0px_0px_#1c1917] flex flex-col items-center justify-center p-3 text-[#2D4A3E] dark:text-white cursor-pointer transition-all hover:scale-[1.01] active:scale-98 select-none"
                    title="Importer des fichiers"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#E8DFD0] dark:bg-white/10 border-2 border-[#2D4A3E] dark:border-white/30 flex items-center justify-center text-[#2D4A3E] dark:text-white shadow-[1px_1px_0px_0px_#1c1917] group-hover:scale-110 transition-transform mb-2">
                      <Plus className="w-7 h-7 stroke-[3]" />
                    </div>
                    <span className="text-xs font-bold text-center">Ajouter un fichier</span>
                    <span className="text-[10px] text-[#5C6B5A] dark:text-slate-400 text-center mt-0.5">Importer</span>
                  </div>
                </div>
              ) : (
                /* Grille en mode compact (cartes sans aperçu, affichage d'origine) */
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 justify-items-center w-full pt-2">
                  {filteredFiles.map((f, idx) => {
                    const ext = f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
                    const isPdf = ext === 'PDF';
                    const isWord = ext === 'DOC' || ext === 'DOCX';
                    const isExcel = ext === 'XLS' || ext === 'XLSX' || ext === 'CSV';
                    const isPpt = ext === 'PPT' || ext === 'PPTX';
                    const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG'].includes(ext) || f.isImage;
                    const isSelected = selectedFileIds.includes(f.id);
                    
                    let bgColor = 'bg-stone-700';
                    if (isPdf) bgColor = 'bg-red-500';
                    else if (isWord) bgColor = 'bg-blue-600';
                    else if (isExcel) bgColor = 'bg-emerald-600';
                    else if (isPpt) bgColor = 'bg-orange-500';
                    else if (isImg) bgColor = 'bg-purple-600';

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
                              prev.includes(f.id) ? prev.filter(i => i !== f.id) : [...prev, f.id]
                            );
                          } else {
                            setActivePreviewItem && setActivePreviewItem({ ...f, folderName: matiereName });
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
                                if (f.url) handleDownload(f.url, f.name);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                            >
                              <Download className="w-4 h-4 text-stone-600" />
                              <span>Télécharger</span>
                            </button>

                            <button
                              onClick={() => {
                                if (onOpenCreateShareLink) onOpenCreateShareLink([f]);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                            >
                              <LinkIcon className="w-4 h-4 text-stone-600" />
                              <span>Créer un lien de partage</span>
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
                          {isImg && (f.url || f.id) ? (
                            <div className="absolute inset-0 w-full h-full bg-white overflow-hidden flex items-center justify-center z-0">
                              <ImageCardPreview img={f as any} className="w-full h-full object-cover" alt={f.name} />
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
              )}
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
                      className="px-3 py-1.5 bg-[#2D4A3E] text-white rounded-lg border-2 border-stone-800 text-xs font-bold cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                )}

                {savedMatieres.map((mat) => {
                  const isChecked = selectedMatiereIds.includes(mat.id);
                  return (
                    <div
                      key={mat.id}
                      onClick={() => {
                        setSelectedMatiereIds(prev =>
                          isChecked ? prev.filter(id => id !== mat.id) : [...prev, mat.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border-2 border-stone-800 cursor-pointer transition-all ${isChecked ? 'bg-[#2D4A3E]/10 font-bold' : 'bg-white hover:bg-stone-50'}`}
                    >
                      <span className="text-xs text-stone-800 font-medium">{mat.name}</span>
                      <div className={`w-5 h-5 rounded border-2 border-stone-800 flex items-center justify-center ${isChecked ? 'bg-[#2D4A3E] text-white' : 'bg-white'}`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isAddingNewMatiere && (
              <button
                onClick={() => setIsAddingNewMatiere(true)}
                className="w-full py-2 mb-4 bg-stone-100 hover:bg-stone-200 text-[#2D4A3E] text-xs font-bold rounded-xl border-2 border-stone-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <span>+ Ajouter une matière</span>
              </button>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
              <button
                onClick={handleCloseModal}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl border-2 border-stone-800 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveClassification}
                disabled={selectedMatiereIds.length === 0}
                className="flex-1 py-2 bg-[#2D4A3E] hover:bg-[#1e332a] disabled:opacity-40 text-white text-xs font-bold rounded-xl border-2 border-stone-800 transition-colors cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Format Non Compatible au milieu de l'écran */}
      <IncompatibleFormatModal 
        info={incompatibleAlertInfo} 
        onClose={() => setIncompatibleAlertInfo(null)} 
      />
    </div>
  );
};
