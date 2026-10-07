import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, File as FileIcon, MoreVertical, Trash2, CheckSquare, Square, 
  Check, X, Plus, Search, ArrowLeftRight, RotateCcw, ChevronLeft, ChevronRight,
  ChevronDown, LayoutGrid, FileText, Image, Video, Music, BookOpen, FolderTree, Folder, FolderOpen
} from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { AssistantChat } from './AssistantChat';
import { FileIconBadge } from './FileIconBadge';
import { StudyCloudAPI } from '../services/api';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { ClasseurCreatedFolder } from './Folder3DModels';
import { storeFileBlob, deleteFileBlob, getFileBlobUrl, MAX_FILE_SIZE_BYTES, formatFileSize, storeThumbnailData } from '../services/localFileStorage';
import { UploadQueue } from '../services/uploadQueue';
import { CloudDataStore } from '../services/cloudDataStore';
import { getGalleryFilesForCategory } from '../data/categoryFilesData';
import { isGalleryOrDemoFile } from './FilesMenuView';
import { compressFile } from '../utils/fileCompressor';
import { extractAudioMetadataWithTags, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { safeLocalStorageSet } from '../utils/safeStorage';


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
  const importedScrollRef = React.useRef<HTMLDivElement>(null);
  const [itemsPerRow, setItemsPerRow] = useState(2);
  const [chatKey, setChatKey] = useState(0);
  const [hasChatMessages, setHasChatMessages] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; file: any; isImportedSection: boolean } | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [attachedResources, setAttachedResources] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Source / Menu actuellement sélectionné dans le sélecteur
  const [selectedSource, setSelectedSource] = useState<{
    type: 'mes_fichiers' | 'documents' | 'images' | 'videos' | 'audio' | 'matiere' | 'classeur';
    title: string;
    matiereName?: string;
    classeurFolderId?: string;
  } | null>(null);

  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [sourceMenuCoords, setSourceMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [expandedSourceGroup, setExpandedSourceGroup] = useState<'matiere' | 'classeur' | null>(null);
  const [expandedClasseurFolderIds, setExpandedClasseurFolderIds] = useState<Set<string>>(new Set());
  const sourceButtonRef = useRef<HTMLButtonElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);

  const [savedMatieres, setSavedMatieres] = useState<{ id: string; name: string; coefficient?: string; color?: string }[]>(() => {
    try {
      const raw = localStorage.getItem('unifolder_saved_matieres');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [classeurFolders, setClasseurFolders] = useState<ClasseurCreatedFolder[]>(() => {
    return CloudDataStore.getState().classeurFolders || [];
  });

  const [categoryFilesCache, setCategoryFilesCache] = useState<{
    documents?: any[];
    images?: any[];
    videos?: any[];
    audio?: any[];
  }>({});

  const [classeurFilesCache, setClasseurFilesCache] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const handleMatieres = () => {
      try {
        const raw = localStorage.getItem('unifolder_saved_matieres');
        if (raw) setSavedMatieres(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('unifolder_matieres_updated', handleMatieres);
    return () => window.removeEventListener('unifolder_matieres_updated', handleMatieres);
  }, []);

  useEffect(() => {
    const unsub = CloudDataStore.subscribe((state) => {
      if (state.classeurFolders && state.classeurFolders.length > 0) {
        setClasseurFolders(state.classeurFolders);
      }
      setCategoryFilesCache(prev => ({
        ...prev,
        documents: state.documents?.length ? state.documents : prev.documents,
        images: state.images?.length ? state.images : prev.images,
        videos: state.videos?.length ? state.videos : prev.videos,
        audio: state.audio?.length ? state.audio : prev.audio,
      }));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isSourceMenuOpen) {
      const state = CloudDataStore.getState();
      if (!state.documents || state.documents.length === 0) {
        CloudStorageAPI.getDocumentsList().then(docs => {
          if (docs && docs.length > 0) setCategoryFilesCache(p => ({ ...p, documents: docs }));
        }).catch(() => {});
      }
      if (!state.images || state.images.length === 0) {
        CloudStorageAPI.getImagesList().then(imgs => {
          if (imgs && imgs.length > 0) setCategoryFilesCache(p => ({ ...p, images: imgs }));
        }).catch(() => {});
      }
      if (!state.videos || state.videos.length === 0) {
        CloudStorageAPI.getVideosList().then(vids => {
          if (vids && vids.length > 0) setCategoryFilesCache(p => ({ ...p, videos: vids }));
        }).catch(() => {});
      }
      if (!state.audio || state.audio.length === 0) {
        CloudStorageAPI.getAudioList().then(aud => {
          if (aud && aud.length > 0) setCategoryFilesCache(p => ({ ...p, audio: aud }));
        }).catch(() => {});
      }
      if (!state.classeurFolders || state.classeurFolders.length === 0) {
        CloudStorageAPI.getClasseurFolders().then(f => {
          if (f && f.length > 0) {
            CloudDataStore.setClasseurFolders(f);
            setClasseurFolders(f);
          }
        }).catch(() => {});
      }
    }
  }, [isSourceMenuOpen]);

  useEffect(() => {
    if (selectedSource?.type === 'classeur' && selectedSource.classeurFolderId) {
      const folderId = selectedSource.classeurFolderId;
      const inStore = CloudDataStore.getState().folderFilesMap[folderId];
      if (inStore && inStore.length > 0) {
        setClasseurFilesCache(prev => ({ ...prev, [folderId]: inStore }));
      }
      CloudStorageAPI.getClasseurFiles(folderId).then(remoteFiles => {
        if (remoteFiles && Array.isArray(remoteFiles)) {
          setClasseurFilesCache(prev => ({ ...prev, [folderId]: remoteFiles }));
        }
      }).catch(() => {});
    }
  }, [selectedSource]);

  const renderClasseurFolderItem = (folder: ClasseurCreatedFolder, depth: number = 0) => {
    const subfolders = classeurFolders.filter(s => s.parentId === folder.id);
    const hasSub = subfolders.length > 0;
    const isExpanded = expandedClasseurFolderIds.has(folder.id);
    const isSelected = selectedSource?.type === 'classeur' && selectedSource.classeurFolderId === folder.id;

    return (
      <div key={folder.id} className="w-full flex flex-col">
        <div 
          className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-colors ${
            isSelected
              ? 'bg-indigo-600 text-white font-black shadow-xs'
              : 'hover:bg-stone-200/70 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-300 font-medium'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <div 
            onClick={() => {
              setSelectedSource({ type: 'classeur', title: folder.name, classeurFolderId: folder.id });
              setIsSourceMenuOpen(false);
            }}
            className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
          >
            <Folder 
              className="w-3.5 h-3.5 shrink-0" 
              style={{ color: folder.primaryColor || '#6366F1' }} 
            />
            <span className="truncate">{folder.name}</span>
          </div>

          {hasSub && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedClasseurFolderIds(prev => {
                  const next = new Set(prev);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                });
              }}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors text-stone-500 hover:text-stone-800 dark:text-stone-400 cursor-pointer ml-1"
              title={isExpanded ? "Masquer les sous-dossiers" : "Afficher les sous-dossiers"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {hasSub && isExpanded && (
          <div className="flex flex-col space-y-0.5 mt-0.5">
            {subfolders.map(sub => renderClasseurFolderItem(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Déterminer précisément si on est dans "Mes fichiers" ou dans une matière spécifique
  const rawMatiere = (activeFolderDetail?.title && activeFolderDetail.title !== 'Mes fichiers')
    ? activeFolderDetail.title
    : (activePreviewItem?.matiere && activePreviewItem.matiere !== 'Mes fichiers')
      ? activePreviewItem.matiere
      : (activePreviewItem?.folderName && activePreviewItem.folderName !== 'Mes fichiers' && !['Images', 'Vidéos', 'Musique', 'Documents'].includes(activePreviewItem.folderName))
        ? activePreviewItem.folderName
        : null;

  const isMesFichiersMode = !rawMatiere || rawMatiere === 'Mes fichiers';
  const currentFolderName = isMesFichiersMode ? 'Mes fichiers' : rawMatiere;
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
    window.addEventListener('unifolder_data_restored', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('unifolder_files_updated', handleUpdate);
      window.removeEventListener('unifolder_data_restored', handleUpdate);
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

    // Synchronisation avec le worker pour charger tous les fichiers de "Mes fichiers"
    StudyCloudAPI.getFiles(userId, 'root', false)
      .then(async (res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
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
                matiere: row.matiere_id && row.matiere_id !== 'Mes fichiers' ? row.matiere_id : 'Mes fichiers',
                importedAt: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                createdAt: row.created_at,
                timestamp: row.last_imported || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
                isImage: row.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(row.name || ''),
              };
            })
          );
          if (!isMounted) return;
          const existingRaw = localStorage.getItem('unifolder_files_menu_items');
          let localList: any[] = [];
          if (existingRaw) {
            try { localList = JSON.parse(existingRaw); } catch (e) {}
          }
          const mergedMap = new Map<string, any>();
          filesWithUrls.forEach(f => mergedMap.set(f.id, f));
          localList.forEach(f => {
            if (f && f.id && !mergedMap.has(f.id)) {
              if (!isGalleryOrDemoFile(f)) {
                mergedMap.set(f.id, f);
              }
            }
          });
          const merged = Array.from(mergedMap.values());
          safeLocalStorageSet('unifolder_files_menu_items', merged);
          setSyncTick(prev => prev + 1);
        }
      })
      .catch(err => console.warn('[LeftMenu] Erreur synchro general files from worker:', err));

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleCloseMenu = () => {
      setOpenMenuId(null);
      setMenuCoords(null);
    };
    document.addEventListener('click', handleCloseMenu);
    window.addEventListener('scroll', handleCloseMenu, true);
    return () => {
      document.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('scroll', handleCloseMenu, true);
    };
  }, []);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let fileArray = Array.from(files) as File[];
    if (fileArray.length > MAX_IMPORT_FILES) {
      alert(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`);
      fileArray = fileArray.slice(0, MAX_IMPORT_FILES);
    }

    const itemsWithFiles: { file: File | Blob; item: any; originalSizeBytes?: number; originalSizeFormatted?: string }[] = [];
    
    for (let idx = 0; idx < fileArray.length; idx++) {
      const file = fileArray[idx];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`Le fichier "${file.name}" dépasse la limite de 50 Mo (${formatFileSize(file.size)}).`);
        continue;
      }

      // Compression intelligente automatique
      const compResult = await compressFile(file);
      const fileToStore = compResult.file;
      const originalSizeBytes = compResult.originalSizeBytes;
      const compressedSizeBytes = compResult.compressedSizeBytes;
      const compressionRatio = compResult.compressionRatio;

      const now = Date.now() + idx;
      const id = `file-${now}-${Math.random().toString(36).substring(2, 7)}`;
      await storeFileBlob(id, fileToStore);
      const localUrl = URL.createObjectURL(fileToStore);
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const extVal = file.name.split('.').pop()?.toUpperCase() || 'FICHIER';

      const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|weba)$/i);
      let audioCover: string | undefined = undefined;
      let audioArtist: string | undefined = undefined;
      let audioTitle: string | undefined = undefined;

      if (isAudio) {
        try {
          const meta = await extractAudioMetadataWithTags(fileToStore);
          if (meta.coverUrl) {
            audioCover = meta.coverUrl;
            setCachedMediaThumbnail(id, meta.coverUrl);
            setCachedMediaThumbnail(localUrl, meta.coverUrl);
            storeThumbnailData(id, meta.coverUrl).catch(() => {});
          }
          if (meta.artist) audioArtist = meta.artist;
          if (meta.title) audioTitle = meta.title;
        } catch {}
      }

      const newFile: any = {
        id,
        name: file.name,
        title: audioTitle || file.name,
        type: file.type || 'file',
        size: originalSizeBytes,
        sizeBytes: originalSizeBytes,
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
        timestamp: now,
        // Champs CloudDataStore / UploadQueue
        category: file.type.startsWith('image/') ? 'images' : (
          file.type.startsWith('video/') ? 'videos' :
          isAudio ? 'audio' : 'documents'
        ),
        source: currentFolderName || 'Espace détude',
        previewUrl: file.type.startsWith('image/') ? localUrl : (audioCover || undefined),
        coverUrl: audioCover,
        thumbnailUrl: audioCover,
        artist: audioArtist || (isAudio ? 'Artiste inconnu' : undefined),
        videoUrl: file.type.startsWith('video/') ? localUrl : undefined,
        audioUrl: isAudio ? localUrl : undefined,
      };


      // 1. Enregistrement D1 immédiat (sans attendre R2)
      StudyCloudAPI.registerFileMetadata({
        id,
        userId,
        matiereId: currentFolderName && currentFolderName !== 'Mes fichiers' ? currentFolderName : null,
        name: file.name,
        size: originalSizeBytes,
        type: file.type || 'application/octet-stream',
        extension: extVal,
        r2Key: null,
        fileUrl: localUrl,
        isFavorite: false,
        isImported: true,
        isStudySession: true,
        lastImported: now,
        originalSizeBytes,
        compressedSizeBytes,
        compressionRatio
      }).catch(() => {});

      StudyCloudAPI.registerStudyFile({
        id,
        userId,
        name: file.name,
        size: originalSizeBytes,
        type: file.type || 'application/octet-stream',
        extension: extVal,
        r2Key: null,
        fileUrl: localUrl,
        isFavorite: false,
        importedAt: now,
        originalSizeBytes,
        compressedSizeBytes
      }).catch(() => {});

      // 2. Sync multi-appareils optimiste
      CloudDataStore.addOptimisticFile(newFile);

      itemsWithFiles.push({
        file: fileToStore,
        item: newFile,
        originalSizeBytes,
        originalSizeFormatted: compResult.originalSizeFormatted
      });
      
      // 3. Save to dedicated study imports localStorage
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
      
      if (idx === 0 && setActivePreviewItem) {
        setActivePreviewItem({ ...newFile, folderName: currentFolderName || 'Mes fichiers' });
        setViewHistory(prev => [newFile.id, ...prev.filter(id => id !== newFile.id)]);
      }
    }

    // 4. UploadQueue.enqueueExisting — R2 en arrière-plan avec retry automatique
    if (itemsWithFiles.length > 0) {
      UploadQueue.enqueueExisting(itemsWithFiles, {
        category: 'documents',
        uploadSource: 'left-menu-study'
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

    return sortedFiles.map((f) => {
      const ext = f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      const isActive = activePreviewItem?.id === f.id;
      const isSelected = selectedIds.includes(f.id);
      const isAttached = attachedResources.some(res => res.id === f.id);
      
      const totalContextCount = (activePreviewItem ? 1 : 0) + attachedResources.filter(res => res.id !== activePreviewItem?.id).length;
      const isLimitReached = totalContextCount >= 3;
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
                 : (f.matiere || f.folderName || (selectedSource ? selectedSource.title : currentFolderName) || 'Mes fichiers');
               setActivePreviewItem({ ...f, folderName: nextFolder });
               setViewHistory(prev => [f.id, ...prev.filter(id => id !== f.id)]);
            }
          }} 
          className={`group flex flex-col items-center cursor-pointer transition-all ${
            isHorizontal ? 'w-[92px] min-w-[92px] max-w-[92px] shrink-0' : 'w-full min-w-0'
          } relative ${isActive || isAttached ? 'scale-[1.03]' : 'hover:scale-105'} p-1 select-none`}
        >
          <div className={`relative p-2 rounded-xl transition-all ${containerClass}`}>
            <FileIconBadge 
              fileName={f.name} 
              size={isHorizontal ? 44 : 48} 
              isAudio={f.category === 'audio' || !!f.audioUrl || f.type?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes((f.extension || f.name.split('.').pop() || '').toLowerCase())} 
            />
            
            {showMenuButton && (
              <div className={`absolute top-1 right-1 transition-opacity z-20 ${openMenuId === f.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (openMenuId === f.id) {
                      setOpenMenuId(null);
                      setMenuCoords(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const dropdownWidth = 125;
                      const left = Math.max(8, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 8));
                      setMenuCoords({
                        top: rect.bottom + 4,
                        left,
                        file: f,
                        isImportedSection
                      });
                      setOpenMenuId(f.id);
                    }
                  }}
                  className="p-1 bg-white/90 shadow-sm rounded-full hover:bg-orange-50 text-stone-500 hover:text-orange-600 transition-colors cursor-pointer"
                  title="Options du fichier"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
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
          <span className={`text-[10px] ${isHorizontal ? 'line-clamp-2 mt-1 leading-tight' : 'md:text-[11px] mt-2 line-clamp-2'} font-bold text-center px-1 w-full break-all overflow-hidden ${textClass}`}>
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

    if (selectedSource) {
      if (selectedSource.type === 'documents') {
        const docList = categoryFilesCache.documents || CloudDataStore.getState().documents || [];
        const localDocs = getGalleryFilesForCategory('Documents') || [];
        const map = new Map<string, any>();
        docList.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id)) {
            map.set(f.id, {
              ...f,
              matiere: 'Documents',
              folderName: 'Documents',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'PDF' : 'PDF')
            });
          }
        });
        localDocs.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id) && !map.has(f.id)) {
            map.set(f.id, {
              ...f,
              matiere: 'Documents',
              folderName: 'Documents',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'PDF' : 'PDF')
            });
          }
        });
        baseFiles = Array.from(map.values());
      } else if (selectedSource.type === 'images') {
        const imgList = categoryFilesCache.images || CloudDataStore.getState().images || [];
        const localImgs = getGalleryFilesForCategory('Images') || [];
        const map = new Map<string, any>();
        imgList.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id)) {
            map.set(f.id, {
              ...f,
              isImage: true,
              matiere: 'Images',
              folderName: 'Images',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'IMG' : 'IMG')
            });
          }
        });
        localImgs.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id) && !map.has(f.id)) {
            map.set(f.id, {
              ...f,
              isImage: true,
              matiere: 'Images',
              folderName: 'Images',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'IMG' : 'IMG')
            });
          }
        });
        baseFiles = Array.from(map.values());
      } else if (selectedSource.type === 'videos') {
        const vidList = categoryFilesCache.videos || CloudDataStore.getState().videos || [];
        const localVids = getGalleryFilesForCategory('Vidéos') || [];
        const map = new Map<string, any>();
        vidList.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id)) {
            map.set(f.id, {
              ...f,
              matiere: 'Vidéos',
              folderName: 'Vidéos',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'MP4' : 'MP4')
            });
          }
        });
        localVids.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id) && !map.has(f.id)) {
            map.set(f.id, {
              ...f,
              matiere: 'Vidéos',
              folderName: 'Vidéos',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'MP4' : 'MP4')
            });
          }
        });
        baseFiles = Array.from(map.values());
      } else if (selectedSource.type === 'audio') {
        const audList = categoryFilesCache.audio || CloudDataStore.getState().audio || [];
        const localAud = getGalleryFilesForCategory('Musique') || [];
        const map = new Map<string, any>();
        audList.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id)) {
            map.set(f.id, {
              ...f,
              isAudio: true,
              matiere: 'Son',
              folderName: 'Son',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'MP3' : 'MP3')
            });
          }
        });
        localAud.forEach(f => {
          if (f && f.id && !importedIds.includes(f.id) && !map.has(f.id)) {
            map.set(f.id, {
              ...f,
              isAudio: true,
              matiere: 'Son',
              folderName: 'Son',
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'MP3' : 'MP3')
            });
          }
        });
        baseFiles = Array.from(map.values());
      } else if (selectedSource.type === 'matiere' && selectedSource.matiereName) {
        const targetMat = selectedSource.matiereName;
        const matiereMap = new Map<string, any>();
        const matiereRaw = localStorage.getItem(`unifolder_matiere_files_${targetMat}`);
        if (matiereRaw) {
          try {
            const parsed = JSON.parse(matiereRaw);
            if (Array.isArray(parsed)) {
              parsed.forEach((f: any) => {
                if (f && f.id && !f.isLeftMenuImport && !f.isStudyImport && !importedIds.includes(f.id)) {
                  matiereMap.set(f.id, {
                    ...f,
                    matiere: targetMat,
                    folderName: targetMat,
                    extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
                  });
                }
              });
            }
          } catch (e) {}
        }
        const allItemsRaw = localStorage.getItem('unifolder_files_menu_items');
        if (allItemsRaw) {
          try {
            const parsed = JSON.parse(allItemsRaw);
            if (Array.isArray(parsed)) {
              parsed.forEach((f: any) => {
                if (f && f.id && f.matiere === targetMat && !importedIds.includes(f.id) && !matiereMap.has(f.id)) {
                  matiereMap.set(f.id, {
                    ...f,
                    matiere: targetMat,
                    folderName: targetMat,
                    extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
                  });
                }
              });
            }
          } catch (e) {}
        }
        baseFiles = Array.from(matiereMap.values());
      } else if (selectedSource.type === 'classeur' && selectedSource.classeurFolderId) {
        const folderId = selectedSource.classeurFolderId;
        const cached = classeurFilesCache[folderId] || CloudDataStore.getState().folderFilesMap[folderId] || [];
        const map = new Map<string, any>();
        cached.forEach((f: any) => {
          // Filtrer rigoureusement : uniquement des fichiers réels, pas de dossiers
          if (f && f.id && !f.model && !importedIds.includes(f.id)) {
            map.set(f.id, {
              ...f,
              matiere: selectedSource.title,
              folderName: selectedSource.title,
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
            });
          }
        });
        baseFiles = Array.from(map.values());
      } else {
        // 'mes_fichiers'
        const directMap = new Map<string, any>();
        const addDirectFiles = (raw: string | null) => {
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((f: any) => {
                if (f && f.id && !f.isLeftMenuImport && !f.isStudyImport && !importedIds.includes(f.id) && !isGalleryOrDemoFile(f)) {
                  directMap.set(f.id, {
                    ...f,
                    matiere: f.matiere || 'Mes fichiers',
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
        baseFiles = Array.from(directMap.values());
      }
    } else if (folder && !isMesFichiersMode) {
      // CAS DANS UNE MATIÈRE OU GALERIE (ex: Images, Vidéos, Musique, Documents)
      const matiereMap = new Map<string, any>();

      // 0. Si le dossier correspond à une galerie connue (Images, Vidéos, Musique, Documents),
      // pré-charger TOUTE la galerie par défaut pour que tous les autres fichiers de la galerie soient visibles
      const defaultGallery = getGalleryFilesForCategory(folder);
      if (defaultGallery && defaultGallery.length > 0) {
        defaultGallery.forEach((f: any) => {
          if (f && f.id && !importedIds.includes(f.id)) {
            matiereMap.set(f.id, {
              ...f,
              matiere: folder,
              folderName: folder,
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
            });
          }
        });
      }

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
                  folderName: folder,
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
            matiereMap.set(f.id, {
              ...f,
              matiere: folder,
              folderName: folder,
              extension: f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
            });
          }
        });
      }

      // C. S'assurer que le fichier actif sélectionné est présent
      if (activePreviewItem && activePreviewItem.id && !importedIds.includes(activePreviewItem.id)) {
        matiereMap.set(activePreviewItem.id, {
          ...activePreviewItem,
          matiere: folder,
          folderName: folder,
          extension: activePreviewItem.extension || (activePreviewItem.name && activePreviewItem.name.includes('.') ? activePreviewItem.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER')
        });
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
              if (f && f.id && !f.isLeftMenuImport && !f.isStudyImport && !importedIds.includes(f.id) && !isGalleryOrDemoFile(f)) {
                directMap.set(f.id, {
                  ...f,
                  matiere: f.matiere || 'Mes fichiers',
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
  }, [activeFolderDetail, activePreviewItem, isMesFichiersMode, currentFolderName, syncTick, selectedSource, categoryFilesCache, classeurFilesCache]);

  const displayTitle = selectedSource
    ? (selectedSource.type === 'documents' ? 'Documents'
        : selectedSource.type === 'images' ? 'Images'
        : selectedSource.type === 'videos' ? 'Vidéos'
        : selectedSource.type === 'audio' ? 'Son'
        : selectedSource.type === 'classeur' ? `Classeur : ${selectedSource.title}`
        : selectedSource.title)
    : (isMesFichiersMode || !currentFolderName || currentFolderName === 'Mes fichiers'
        ? 'Mes fichiers'
        : `Fichiers de ${currentFolderName}`);

  const docsCount = (categoryFilesCache.documents?.length) || (CloudDataStore.getState().documents?.length) || 0;
  const imgsCount = (categoryFilesCache.images?.length) || (CloudDataStore.getState().images?.length) || 0;
  const vidsCount = (categoryFilesCache.videos?.length) || (CloudDataStore.getState().videos?.length) || 0;
  const audCount = (categoryFilesCache.audio?.length) || (CloudDataStore.getState().audio?.length) || 0;

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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full min-w-[320px] h-full border-r-2 border-stone-800 relative pointer-events-auto bg-[#FDFBF7] ${
        isCenterFullscreen || isRightFullscreen ? 'hidden' : (mobilePreviewTab === 0 ? 'flex' : 'hidden md:flex')
      } flex flex-col pt-[44px] overflow-hidden transition-colors ${
        isDraggingOver ? 'ring-4 ring-orange-500 ring-inset bg-orange-50/30' : ''
      }`}
    >
      {/* Drag & drop overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-stone-900/85 backdrop-blur-sm border-2 border-dashed border-orange-500 flex flex-col items-center justify-center p-4 text-center pointer-events-none animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border-2 border-orange-500 text-orange-400 flex items-center justify-center mb-2 shadow-lg animate-bounce">
            <Upload className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-sm font-black text-white">Déposer le fichier ici</h3>
          <p className="text-[10px] font-bold text-stone-300 mt-0.5">Import instantané dans l'espace d'étude</p>
        </div>
      )}

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
      ) : null}

      {/* Main Content: Files List OR Assistant Chat in natural flex flow */}
      {!isAssistantOpen ? (
        <div className="flex-1 w-full overflow-hidden flex flex-col px-2.5 sm:px-3 py-1.5 min-h-0">
          {menuFiles.length > 0 ? (
            <div className="w-full flex flex-col gap-1.5 h-full overflow-hidden">
              {/* Imported Files Section - fixed at top, single horizontal row with horizontal scrolling */}
              {sessionImportedIds.length > 0 && (
                <div className="w-full relative shrink-0 border-b-2 border-stone-200/80 pb-2">
                  <div className="flex items-center justify-between border-b border-orange-200 mb-1 pb-1 px-1 w-full">
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
                    <div className="relative w-full group/imported">
                      <div 
                        ref={importedScrollRef}
                        onWheel={(e) => {
                          if (e.deltaY !== 0) {
                            e.currentTarget.scrollLeft += e.deltaY;
                          }
                        }}
                        className="w-full flex flex-row items-start overflow-x-auto gap-2.5 pt-0.5 pb-1 px-1 justify-start hide-scrollbar select-none scroll-smooth"
                      >
                        {renderFileGroup(importedFiles, true, true)}
                      </div>
                      {importedFiles.length > 2 && (
                        <>
                          <button 
                            type="button"
                            onClick={() => importedScrollRef.current?.scrollBy({ left: -140, behavior: 'smooth' })}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 w-6 h-6 rounded-full bg-white/95 border border-stone-300 shadow-md flex items-center justify-center text-stone-600 hover:text-orange-600 opacity-0 group-hover/imported:opacity-100 transition-opacity z-20 cursor-pointer"
                            title="Défiler vers la gauche"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => importedScrollRef.current?.scrollBy({ left: 140, behavior: 'smooth' })}
                            className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 w-6 h-6 rounded-full bg-white/95 border border-stone-300 shadow-md flex items-center justify-center text-stone-600 hover:text-orange-600 opacity-0 group-hover/imported:opacity-100 transition-opacity z-20 cursor-pointer"
                            title="Défiler vers la droite"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 italic py-2 text-center w-full">
                      Aucun fichier importé correspondant
                    </p>
                  )}
                </div>
              )}
              
              {/* Context Files Section - expands vertically to fill all space up to the horizontal divider */}
              <div className="w-full flex flex-col flex-1 overflow-hidden min-h-0 pt-1">
                <div className="flex items-center justify-between border-b border-stone-200 mb-2 pb-1 px-1 w-full shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider text-left m-0 truncate" title={displayTitle}>
                      {displayTitle}
                    </h4>
                    {subjectFiles.length > 0 && (
                      <span className="text-[9px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-full shrink-0">
                        {subjectFiles.length}
                      </span>
                    )}
                  </div>

                  {/* Bouton pour changer de menu / base de données (tracé en rouge) */}
                  <div className="relative shrink-0">
                    <button
                      ref={sourceButtonRef}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSourceMenuOpen) {
                          setIsSourceMenuOpen(false);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const menuWidth = Math.min(320, window.innerWidth - 16);
                          const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
                          setSourceMenuCoords({ top: rect.bottom + 4, left });
                          setIsSourceMenuOpen(true);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg border-2 border-stone-800 dark:border-stone-600 bg-amber-400 hover:bg-amber-300 text-stone-900 font-black text-[10px] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer select-none"
                      title="Changer de menu / base de données"
                    >
                      <LayoutGrid className="w-3 h-3 stroke-[2.5]" />
                      <span>Menu</span>
                      <ChevronDown className={`w-3 h-3 stroke-[2.5] transition-transform duration-200 ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                {subjectFiles.length > 0 ? (
                  <div className="w-full grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] content-start auto-rows-max gap-3 pt-1 pb-6 px-1 justify-items-center justify-start overflow-y-auto flex-1 hide-scrollbar">
                    {renderFileGroup(subjectFiles, false)}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400 italic py-4 text-center w-full">
                    {selectedSource 
                      ? `Aucun fichier disponible dans ${displayTitle}`
                      : (isMesFichiersMode || !currentFolderName || currentFolderName === 'Mes fichiers'
                          ? 'Aucun fichier dans Mes fichiers'
                          : 'Aucun fichier dans cette matière')}
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

      {/* File Action Context Menu via Portal (immune to overflow clipping) */}
      {openMenuId && menuCoords && createPortal(
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
          className="fixed w-[130px] bg-white rounded-xl shadow-2xl border border-stone-200 py-1 z-[99999] overflow-hidden animate-fadeIn text-stone-700"
        >
          {attachedResources.some(res => res.id === menuCoords.file.id) ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAttachedResources(prev => prev.filter(res => res.id !== menuCoords.file.id));
                setOpenMenuId(null);
                setMenuCoords(null);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              Retirer du contexte
            </button>
          ) : (
            activePreviewItem?.id === menuCoords.file.id ? (
              <button
                disabled
                className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-stone-400 flex items-center gap-2 cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5 shrink-0 opacity-50" />
                Déjà ouvert
              </button>
            ) : (!attachedResources.filter(res => res.id !== activePreviewItem?.id).length || ((activePreviewItem ? 1 : 0) + attachedResources.filter(res => res.id !== activePreviewItem?.id).length < 3)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAttachedResources(prev => [...prev, menuCoords.file]);
                  setOpenMenuId(null);
                  setMenuCoords(null);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Ajouter au contexte
              </button>
            )
          )}

          {menuCoords.isImportedSection && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(null);
                  setMenuCoords(null);
                  setIsSelectionMode(true);
                  setSelectedIds(importedFiles.map(file => file.id));
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-orange-600 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                Tout cocher
              </button>
              <div className="w-full h-px bg-stone-100 my-0.5" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteImportedFile(menuCoords.file.id);
                  setOpenMenuId(null);
                  setMenuCoords(null);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                Supprimer
              </button>
            </>
          )}
        </div>,
        document.body
      )}

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
      {/* Popover / Menu déroulant grand format pour choisir la source / base de données */}
      {isSourceMenuOpen && sourceMenuCoords && createPortal(
        <>
          <div
            className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-[1px]"
            onClick={() => setIsSourceMenuOpen(false)}
          />
          <div
            ref={sourceMenuRef}
            className="fixed z-[99999] w-[310px] max-h-[85vh] bg-[#FDFBF7] dark:bg-[#111a2e] border-2 border-stone-800 dark:border-stone-600 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: `${Math.min(sourceMenuCoords.top, window.innerHeight - 380)}px`,
              left: `${sourceMenuCoords.left}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header du popup */}
            <div className="flex items-center justify-between px-3 py-2 bg-stone-100 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 shrink-0">
              <div className="flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-orange-600 dark:text-orange-400 stroke-[2.5]" />
                <span className="text-xs font-black text-stone-800 dark:text-stone-100 uppercase tracking-wide">
                  Choisir un menu
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSourceMenuOpen(false)}
                className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg text-stone-500 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Corps du menu déroulant */}
            <div className="overflow-y-auto p-2 space-y-1 max-h-[calc(85vh-45px)] hide-scrollbar">
              {/* 1. DOCUMENT */}
              <button
                type="button"
                onClick={() => {
                  setSelectedSource({ type: 'documents', title: 'Documents' });
                  setIsSourceMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  selectedSource?.type === 'documents'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-stone-900 dark:text-amber-200 font-black border border-amber-300'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200 font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
                    <FileText className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="text-xs truncate">Document</span>
                </div>
                {docsCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono font-bold">
                    {docsCount}
                  </span>
                )}
              </button>

              {/* 2. IMAGES */}
              <button
                type="button"
                onClick={() => {
                  setSelectedSource({ type: 'images', title: 'Images' });
                  setIsSourceMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  selectedSource?.type === 'images'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-stone-900 dark:text-amber-200 font-black border border-amber-300'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200 font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    <Image className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="text-xs truncate">Images</span>
                </div>
                {imgsCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono font-bold">
                    {imgsCount}
                  </span>
                )}
              </button>

              {/* 3. VIDÉO */}
              <button
                type="button"
                onClick={() => {
                  setSelectedSource({ type: 'videos', title: 'Vidéos' });
                  setIsSourceMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  selectedSource?.type === 'videos'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-stone-900 dark:text-amber-200 font-black border border-amber-300'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200 font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800">
                    <Video className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="text-xs truncate">Vidéo</span>
                </div>
                {vidsCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono font-bold">
                    {vidsCount}
                  </span>
                )}
              </button>

              {/* 4. SON */}
              <button
                type="button"
                onClick={() => {
                  setSelectedSource({ type: 'audio', title: 'Son' });
                  setIsSourceMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  selectedSource?.type === 'audio'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-stone-900 dark:text-amber-200 font-black border border-amber-300'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200 font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
                    <Music className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="text-xs truncate">Son</span>
                </div>
                {audCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono font-bold">
                    {audCount}
                  </span>
                )}
              </button>

              {/* 5. MENU MATIÈRE */}
              <div className="border-t border-stone-200 dark:border-stone-700 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => setExpandedSourceGroup(prev => prev === 'matiere' ? null : 'matiere')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    selectedSource?.type === 'matiere' || selectedSource?.type === 'mes_fichiers'
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-stone-900 dark:text-amber-200 font-black'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                      <BookOpen className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <span className="text-xs truncate">Menu matière</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono font-bold">
                      {1 + savedMatieres.length}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                      expandedSourceGroup === 'matiere' ? 'rotate-180' : ''
                    }`} />
                  </div>
                </button>

                {/* Sous-menu des matières avec Mes fichiers tout en haut */}
                {expandedSourceGroup === 'matiere' && (
                  <div className="pl-6 pr-1 py-1 space-y-1 animate-in fade-in duration-150">
                    {/* PREMIÈRE PLACE : Mes fichiers */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSource({ type: 'mes_fichiers', title: 'Mes fichiers' });
                        setIsSourceMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        selectedSource?.type === 'mes_fichiers' || (!selectedSource && isMesFichiersMode)
                          ? 'bg-amber-300 text-stone-950 font-black shadow-xs'
                          : 'hover:bg-stone-200/70 text-stone-800 dark:text-stone-300 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0" />
                        <span className="truncate">Mes fichiers</span>
                      </div>
                      <span className="text-[9px] font-mono px-1 rounded bg-black/10 dark:bg-white/10 font-bold">1er</span>
                    </button>

                    {/* Matières créées */}
                    {savedMatieres.map((m) => {
                      const isSelected = selectedSource?.type === 'matiere' && selectedSource.matiereName === m.name;
                      const isHex = m.color && m.color.startsWith('#');
                      return (
                        <button
                          key={m.id || m.name}
                          type="button"
                          onClick={() => {
                            setSelectedSource({ type: 'matiere', title: m.name, matiereName: m.name });
                            setIsSourceMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-orange-500 text-white font-black shadow-xs'
                              : 'hover:bg-stone-200/70 text-stone-800 dark:text-stone-300 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-stone-800/40"
                              style={{ backgroundColor: isHex ? m.color : '#EA580C' }}
                            />
                            <span className="truncate">{m.name}</span>
                          </div>
                          {m.coefficient && (
                            <span className="text-[9px] font-mono opacity-70">C:{m.coefficient}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. CLASSEUR */}
              <div className="border-t border-stone-200 dark:border-stone-700 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => setExpandedSourceGroup(prev => prev === 'classeur' ? null : 'classeur')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    selectedSource?.type === 'classeur'
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-stone-900 dark:text-amber-200 font-black'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                      <FolderTree className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <span className="text-xs truncate">Classeur</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono font-bold">
                      {classeurFolders.length}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                      expandedSourceGroup === 'classeur' ? 'rotate-180' : ''
                    }`} />
                  </div>
                </button>

                {/* Sous-dossiers du Classeur avec arborescence hiérarchique */}
                {expandedSourceGroup === 'classeur' && (
                  <div className="pl-4 pr-1 py-1 space-y-1 animate-in fade-in duration-150">
                    {classeurFolders.length === 0 ? (
                      <p className="text-[11px] text-stone-400 italic py-2 text-center">
                        Aucun dossier créé dans Classeur
                      </p>
                    ) : (
                      classeurFolders.filter(f => !f.parentId).map(rootFolder => renderClasseurFolderItem(rootFolder, 0))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
