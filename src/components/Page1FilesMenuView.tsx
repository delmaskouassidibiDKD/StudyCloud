import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  X, 
  MoreVertical, 
  Download, 
  Image as ImageIcon, 
  Film, 
  Music, 
  FileText, 
  LayoutGrid, 
  Star, 
  Lock, 
  Trash2, 
  Cloud, 
  Check, 
  ExternalLink, 
  Share2, 
  ChevronLeft,
  ChevronRight, 
  Eye,
  EyeOff,
  Unlock,
  KeyRound, 
  Info, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Menu,
  ShieldCheck,
  FolderCheck,
  FolderPlus,
  FileEdit,
  Box,
  Plus,
  Minus,
  Upload,
  FolderArchive,
  ArrowRight,
  BarChart3,
  Atom,
  Moon,
  FlaskConical,
  Settings,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Volume1,
  Clock,
  Sparkles,
  FileCode,
  Archive,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Repeat,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Link,
  FolderInput,
  Copy,
  Pin,
  Pencil,
  Heart,
  ListPlus,
  Timer,
  Shuffle,
  AlignLeft,
  CheckSquare,
  Square,
  UserCheck,
  Palette
} from 'lucide-react';
import { getDownloadedFiles, recordDownloadedFile, removeDownloadedFile, clearLegacyDownloadedFiles, DownloadedItem } from '../services/downloadsManager';
import { 
  MODEL_1_FOLDERS, 
  MODEL_2_FOLDERS, 
  MODEL_3_FOLDERS, 
  MODEL_4_FOLDERS, 
  Folder3DCard, 
  FolderModelItem,
  ClasseurCreatedFolder,
  Classeur3DFolderCard,
  TxtDocumentSVG,
  getDynamicCurrentDate,
  lightenColor
} from './Folder3DModels';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { DocumentCardPreview } from './DocumentCardPreview';
import { VideoCardPreview } from './VideoCardPreview';
import { AudioCardPreview } from './AudioCardPreview';
import { generatePdfThumbnail, generateVideoThumbnail, extractAudioCover, generateAudioCreatorCover, getCachedMediaThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { storeFileBlob, getFileBlobUrl, getFileBlob, deleteFileBlob } from '../services/localFileStorage';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { ModernImageViewer } from './ModernImageViewer';
import { ModernAudioPlayer } from './ModernAudioPlayer';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { PdfHorizontalViewer } from './PdfHorizontalViewer';

interface Page1FilesMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[], isFullscreen?: boolean) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export interface FileItem {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps';
  source: string;
  size: string;
  sizeBytes: number;
  date: string;
  previewUrl?: string;
  isImage?: boolean;
  videoUrl?: string;
  audioUrl?: string;
  documentCategory?: 'COURS' | 'TD' | 'DEVOIRS' | "PAS D'INF...";
  extension?: string;
  downloadsCount?: number;
  isFavorite?: boolean;
  isSecure?: boolean;
  isPinned?: boolean;
  artist?: string;
  lyricsSnippet?: string;
  fullLyrics?: string[];
  durationSec?: number;
  isNotepad?: boolean;
  content?: string;
  noteTitle?: string;
  originalFolderId?: string;
  originalCategory?: string;
  originalSource?: string;
  url?: string;
  positionX?: number;
  positionY?: number;
  displayOrder?: number;
  r2Key?: string;
}

interface SubMenuView {
  id: string;
  type: 'category' | 'collection' | 'classeur';
  name: string;
  icon: any;
  color: string;
}

function getLocallyDeletedFileIds(): Set<string> {
  try {
    const raw = localStorage.getItem('studycloud_deleted_file_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function markFileLocallyDeleted(id: string, name?: string): void {
  try {
    const set = getLocallyDeletedFileIds();
    if (id) set.add(id);
    if (name) set.add(name);
    localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(Array.from(set).slice(-500)));
  } catch {}
}

function unmarkFileLocallyDeleted(id: string, name?: string): void {
  try {
    const set = getLocallyDeletedFileIds();
    if (id) set.delete(id);
    if (name) set.delete(name);
    localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

function getDeletedRecentIds(): Set<string> {
  try {
    const raw = localStorage.getItem('studycloud_deleted_recent_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function markRecentLocallyDeleted(id: string, name?: string): void {
  try {
    const set = getDeletedRecentIds();
    if (id) set.add(id);
    if (name) set.add(name);
    localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(set).slice(-500)));
  } catch {}
}

function unmarkRecentLocallyDeleted(id: string, name?: string): void {
  try {
    const set = getDeletedRecentIds();
    if (id) set.delete(id);
    if (name) set.delete(name);
    localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

const RecentImageCardPreview: React.FC<{ file: FileItem }> = ({ file }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(() => {
    const cached = getCachedMediaThumbnail(file.id || file.url || '');
    if (cached) return cached;
    if (file.previewUrl && !file.previewUrl.startsWith('blob:')) return file.previewUrl;
    if (file.url && !file.url.startsWith('blob:')) return file.url;
    return file.previewUrl || file.url || null;
  });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (imgSrc && !hasError && !imgSrc.startsWith('blob:')) return;

    if (file.id) {
      getFileBlobUrl(file.id).then(blobUrl => {
        if (isMounted && blobUrl) {
          setImgSrc(blobUrl);
          setHasError(false);
        }
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [file.id, file.url, file.previewUrl, hasError, imgSrc]);

  if (imgSrc && !hasError) {
    return (
      <img
        src={imgSrc}
        alt={file.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 p-3">
      <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 stroke-[1.8]" />
    </div>
  );
};


export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack, onOpenStudySpace, onOpenCreateShareLink }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [docMenuOpenId, setDocMenuOpenId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // =========================================================================
  // ÉTAT DE LA DIVISION EN DEUX (SPLIT SCREEN) & LECTEUR GRAND FORMAT
  // =========================================================================
  const [splitSelectedFile, setSplitSelectedFile] = useState<FileItem | null>(null);
  const [splitResolvedPdfUrl, setSplitResolvedPdfUrl] = useState<string>('');
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);

  // Lecteur Audio
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(11);
  const [audioDuration, setAudioDuration] = useState(219);
  const [audioVolume, setAudioVolume] = useState(0.85);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isAudioShuffle, setIsAudioShuffle] = useState(false);
  const [isAudioRepeat, setIsAudioRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [isAudioLiked, setIsAudioLiked] = useState(false);
  const [isEqualizerOn, setIsEqualizerOn] = useState(true);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [audioMenuSongId, setAudioMenuSongId] = useState<string | null>(null);
  const [isPlayerMenuOpen, setIsPlayerMenuOpen] = useState(false);
  // État du menu 3 traits supérieur (Tri et bouton œil)
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [sortOption, setSortOption] = useState<'recent' | 'oldest' | 'pinned'>('recent');
  const [isEyeViewActive, setIsEyeViewActive] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  // Aliases de compatibilité pour la sélection audio existante
  const isAudioSelectionMode = isSelectionMode;
  const setIsAudioSelectionMode = setIsSelectionMode;
  const selectedAudioIds = selectedItemIds;
  const setSelectedAudioIds = setSelectedItemIds;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const noteSaveTimeoutRef = useRef<any>(null);

  // État de verrouillage du Dossier Sécurisé & code PIN (> 4 caractères)
  const [isSecureFolderUnlocked, setIsSecureFolderUnlocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinTargetDestination, setPinTargetDestination] = useState<'collection' | 'cloud-tab' | null>(null);
  const [securePinInput, setSecurePinInput] = useState('');
  const [securePinConfirmInput, setSecurePinConfirmInput] = useState('');
  const [securePinError, setSecurePinError] = useState<string | null>(null);
  const [showPinPassword, setShowPinPassword] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [newPinConfirmInput, setNewPinConfirmInput] = useState('');
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [changePinSuccess, setChangePinSuccess] = useState<string | null>(null);

  // État du menu de propositions de création de dossier (Modèles 3D)
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [createFolderActiveTab, setCreateFolderActiveTab] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  const [selectedFolderModelItem, setSelectedFolderModelItem] = useState<FolderModelItem | null>(null);
  const [customFolderColor, setCustomFolderColor] = useState<string | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [folderCreationToast, setFolderCreationToast] = useState<string | null>(null);

  // État du modal de déplacement / copie (Question préliminaire & Sélection de dossiers)
  const [isTransferPromptOpen, setIsTransferPromptOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'move' | 'copy'>('move');
  const [itemsToTransfer, setItemsToTransfer] = useState<FileItem[]>([]);
  const [transferSelectedFolderIds, setTransferSelectedFolderIds] = useState<string[]>([]);
  const [transferNavFolderId, setTransferNavFolderId] = useState<string | null>(null);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // État de glisser-déposer pour le réordonnancement des fichiers dans un dossier du classeur
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);

  // Liste ordonnée des dossiers 3D du Classeur avec persistance localStorage
  const [classeur3DFolders, setClasseur3DFolders] = useState<ClasseurCreatedFolder[]>(() => {
    const saved = localStorage.getItem('studycloud_classeur_3d_folders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // État d'ouverture du menu d'options 3 traits pour les dossiers 3D du Classeur
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);

  // Niveau de zoom / taille des dossiers 3D du Classeur (1 à 10, valeur par défaut: 10 taille standard, 1 est le minimum)
  const [folderZoomLevel, setFolderZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('studycloud_classeur_folder_zoom');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
          return parsed;
        }
      }
    } catch (e) {}
    return 10;
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_classeur_folder_zoom', folderZoomLevel.toString());
    } catch (e) {}
  }, [folderZoomLevel]);

  // Calcul dynamique de la largeur minimale et espacement de la grille (échelle 1 à 10)
  // Le niveau 1 correspond exactement à la taille compacte de l'ancien niveau 2 (130px), le niveau 10 à la taille standard (270px)
  const folderCardMinWidth = Math.round(130 + ((folderZoomLevel - 1) / 9) * 140);
  const folderGridGap = Math.round(12 + ((folderZoomLevel - 1) / 9) * 12);

  const getFolderCardPadding = (zoom: number) => {
    if (zoom <= 3) return 'p-2 rounded-2xl';
    if (zoom <= 6) return 'p-2.5 sm:p-3 rounded-2xl';
    return 'p-3 sm:p-4 rounded-3xl';
  };

  // Maintient le dossier 3D glissé vers le bas sur le fond noir pour que le bouton 3 traits
  // reste toujours sur l'espace noir supérieur sans jamais chevaucher la date ou l'onglet
  const getFolderTopSpacing = (zoom: number) => {
    if (zoom <= 3) return 'pt-7 pb-1';
    if (zoom <= 6) return 'pt-7 sm:pt-7.5 pb-1';
    return 'pt-7 sm:pt-8 pb-1';
  };

  const getFolderMenuBtnClass = (zoom: number) => {
    if (zoom <= 3) return 'absolute top-1.5 right-1.5 z-30 studycloud-menu-trigger scale-80 origin-top-right';
    if (zoom <= 6) return 'absolute top-2 right-2 z-30 studycloud-menu-trigger scale-90 origin-top-right';
    return 'absolute top-2.5 right-2.5 z-30 studycloud-menu-trigger';
  };

  useEffect(() => {
    localStorage.setItem('studycloud_classeur_3d_folders', JSON.stringify(classeur3DFolders));
  }, [classeur3DFolders]);

  // Dossier 3D du Classeur actuellement ouvert pour afficher son menu dédié et ses fichiers
  const [opened3DFolder, setOpened3DFolder] = useState<ClasseurCreatedFolder | null>(null);

  // Identifiant du dossier parent en cas de création de sous-dossier (dossier dans dossier)
  const [subFolderParentId, setSubFolderParentId] = useState<string | null>(null);

  // État du modal de création de fichier Bloc-notes (TXT)
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);
  const [newNoteNameInput, setNewNoteNameInput] = useState('');

  // Fichier Bloc-notes en cours d'édition / écriture
  const [activeEditingNote, setActiveEditingNote] = useState<FileItem | null>(null);
  const [noteTextContent, setNoteTextContent] = useState<string>('');
  const [noteTitleContent, setNoteTitleContent] = useState<string>('');
  const [isNoteSavedIndicator, setIsNoteSavedIndicator] = useState<boolean>(true);

  // Table des fichiers par dossier 3D créé (chaque dossier possède son propre menu et ses fichiers indépendants)
  const [folderFilesMap, setFolderFilesMap] = useState<Record<string, FileItem[]>>(() => {
    try {
      const saved = localStorage.getItem('studycloud_folder_files_map');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch (e) {}
    return {};
  });

  const folderFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverFolder, setIsDraggingOverFolder] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_folder_files_map', JSON.stringify(folderFilesMap));
    } catch (e) {}
  }, [folderFilesMap]);

  // Progression d'enregistrement en arrière-plan des fichiers importés (fileId -> pourcentage 0 à 100)
  const [savingFileProgress, setSavingFileProgress] = useState<Record<string, number>>({});

  const startSavingAnimation = (fileIds: string[], onComplete?: () => void) => {
    if (!fileIds || fileIds.length === 0) return;

    setSavingFileProgress(prev => {
      const next = { ...prev };
      fileIds.forEach(id => { next[id] = 12; });
      return next;
    });

    let current = 12;
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
          if (onComplete) onComplete();
        }, 400);
      } else {
        setSavingFileProgress(prev => {
          const next = { ...prev };
          fileIds.forEach(id => { next[id] = current; });
          return next;
        });
      }
    }, 350);
  };

  // Importer des fichiers dans le dossier ouvert
  const handleFolderFileUpload = (e: React.ChangeEvent<HTMLInputElement>, folderId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];
    const targetFolder = classeur3DFolders.find(f => f.id === folderId);
    const folderName = targetFolder ? targetFolder.name : 'Dossier';

    const newFiles: FileItem[] = files.map((f: File, idx) => {
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
      let category: FileItem['category'] = 'documents';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) category = 'images';
      else if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) category = 'videos';
      else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) category = 'audio';

      const k = 1024;
      const sizes = ['o', 'Ko', 'Mo', 'Go'];
      const i = f.size > 0 ? Math.floor(Math.log(f.size) / Math.log(k)) : 0;
      const sizeStr = f.size > 0 ? parseFloat((f.size / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i] : '0 o';
      const fileId = `cf-${folderId}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(f);

      // Stocker le binaire immédiatement dans IndexedDB pour lecture instantanée
      storeFileBlob(fileId, f).catch(() => {});

      return {
        id: fileId,
        name: f.name,
        category,
        source: folderName,
        size: sizeStr,
        sizeBytes: f.size,
        date: getDynamicCurrentDate().full,
        extension: ext.toUpperCase(),
        url: localBlobUrl,
        previewUrl: localBlobUrl,
        videoUrl: category === 'videos' ? localBlobUrl : undefined,
        audioUrl: category === 'audio' ? localBlobUrl : undefined,
        positionX: idx * 25,
        positionY: 0,
        displayOrder: idx
      };
    });

    setFolderFilesMap(prev => ({
      ...prev,
      [folderId]: [...newFiles, ...(prev[folderId] || [])]
    }));

    startSavingAnimation(newFiles.map(f => f.id));

    // Débloquer des récents supprimés et afficher dans les récents
    newFiles.forEach(f => {
      unmarkRecentLocallyDeleted(f.id, f.name);
      unmarkFileLocallyDeleted(f.id, f.name);
    });
    setCloudRecentFiles(prev => {
      const existingIds = new Set(newFiles.map(f => f.id));
      return [...newFiles, ...prev.filter(f => !existingIds.has(f.id))].slice(0, 6);
    });

    // Sauvegarde en arrière-plan dans Cloudflare R2 dédié classeur et Cloudflare D1 classeur_files
    files.forEach(async (file, idx) => {
      try {
        const item = newFiles[idx];
        const uploadRes = await CloudStorageAPI.uploadFileToCategoryR2(file, 'classeur', file.name, folderId);
        const fileToSave: FileItem = {
          ...item,
          url: uploadRes.url,
          r2Key: uploadRes.key
        };
        await CloudStorageAPI.saveClasseurFile(fileToSave, folderId);
      } catch (err) {
        console.warn('[handleFolderFileUpload] Erreur upload R2/D1:', err);
      }
    });

    showToast(`${newFiles.length} fichier(s) importé(s) dans "${folderName}" !`);
    e.target.value = '';
  };

  const handleDirectFilesImportToFolder = (fileList: FileList, folderId: string) => {
    const files = Array.from(fileList) as File[];
    const targetFolder = classeur3DFolders.find(f => f.id === folderId);
    const folderName = targetFolder ? targetFolder.name : 'Dossier';

    const newFiles: FileItem[] = files.map((f: File, idx) => {
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
      let category: FileItem['category'] = 'documents';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) category = 'images';
      else if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) category = 'videos';
      else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) category = 'audio';

      const k = 1024;
      const sizes = ['o', 'Ko', 'Mo', 'Go'];
      const i = f.size > 0 ? Math.floor(Math.log(f.size) / Math.log(k)) : 0;
      const sizeStr = f.size > 0 ? parseFloat((f.size / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i] : '0 o';
      const fileId = `cf-${folderId}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(f);

      // Stocker le binaire immédiatement dans IndexedDB
      storeFileBlob(fileId, f).catch(() => {});

      return {
        id: fileId,
        name: f.name,
        category,
        source: folderName,
        size: sizeStr,
        sizeBytes: f.size,
        date: getDynamicCurrentDate().full,
        extension: ext.toUpperCase(),
        url: localBlobUrl,
        previewUrl: localBlobUrl,
        videoUrl: category === 'videos' ? localBlobUrl : undefined,
        audioUrl: category === 'audio' ? localBlobUrl : undefined,
        positionX: idx * 25,
        positionY: 0,
        displayOrder: idx
      };
    });

    setFolderFilesMap(prev => ({
      ...prev,
      [folderId]: [...newFiles, ...(prev[folderId] || [])]
    }));

    startSavingAnimation(newFiles.map(f => f.id));

    // Les récents d'accueil affichent les fichiers nouvellement importés
    newFiles.forEach(f => {
      unmarkRecentLocallyDeleted(f.id, f.name);
      unmarkFileLocallyDeleted(f.id, f.name);
    });
    setCloudRecentFiles(prev => {
      const existingIds = new Set(newFiles.map(f => f.id));
      return [...newFiles, ...prev.filter(f => !existingIds.has(f.id))].slice(0, 6);
    });

    // Sauvegarde en arrière-plan dans Cloudflare R2 dédié classeur et Cloudflare D1 classeur_files
    files.forEach(async (file, idx) => {
      try {
        const item = newFiles[idx];
        const uploadRes = await CloudStorageAPI.uploadFileToCategoryR2(file, 'classeur', file.name, folderId);
        const fileToSave: FileItem = {
          ...item,
          url: uploadRes.url,
          r2Key: uploadRes.key
        };
        await CloudStorageAPI.saveClasseurFile(fileToSave, folderId);
      } catch (err) {
        console.warn('[handleDirectFilesImportToFolder] Erreur upload R2/D1:', err);
      }
    });

    showToast(`${newFiles.length} fichier(s) importé(s) dans "${folderName}" !`);
  };

  const handleDeleteFileFromFolder = (folderId: string, fileId: string) => {
    const fileToDelete = (folderFilesMap[folderId] || []).find(f => f.id === fileId);
    if (fileToDelete) {
      setTrashFiles(prev => [{ ...fileToDelete, originalFolderId: folderId }, ...prev.filter(f => f.id !== fileId)]);
      markFileLocallyDeleted(fileId, fileToDelete.name);
      markRecentLocallyDeleted(fileId, fileToDelete.name);
    } else {
      markFileLocallyDeleted(fileId);
      markRecentLocallyDeleted(fileId);
    }
    setFolderFilesMap(prev => ({
      ...prev,
      [folderId]: (prev[folderId] || []).filter(f => f.id !== fileId)
    }));
    setCloudRecentFiles(prev => prev.filter(f => f.id !== fileId && (!fileToDelete || f.name !== fileToDelete.name)));
    removeDownloadedFile(fileId);
    if (fileToDelete?.name) removeDownloadedFile(fileToDelete.name);
    deleteFileBlob(fileId).catch(() => {});
    CloudStorageAPI.deleteClasseurFile(fileId).catch(() => {});
    showToast('Fichier déplacé dans la corbeille');
  };

  const handleRenameFileInFolder = (folderId: string, file: FileItem) => {
    const currentName = file.name;
    const newName = window.prompt('Modifier le nom du fichier :', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const trimmed = newName.trim();
      const finalName = (file.isNotepad && !trimmed.toLowerCase().endsWith('.txt')) ? `${trimmed}.txt` : trimmed;
      setFolderFilesMap(prev => ({
        ...prev,
        [folderId]: (prev[folderId] || []).map(f => f.id === file.id ? { ...f, name: finalName } : f)
      }));
      CloudStorageAPI.updateClasseurFile(file.id, { name: finalName }).catch(() => {});
      showToast(`Fichier renommé en "${finalName}" !`);
    }
  };

  const handleCreateNewNote = () => {
    if (!opened3DFolder) return;
    const trimmed = newNoteNameInput.trim();
    const baseName = trimmed || 'Note sans titre';
    const finalName = baseName.toLowerCase().endsWith('.txt') ? baseName : `${baseName}.txt`;
    const realDate = getDynamicCurrentDate();

    const newNoteFile: FileItem = {
      id: `note-${opened3DFolder.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: finalName,
      category: 'documents',
      source: opened3DFolder.name,
      size: '0 o',
      sizeBytes: 0,
      date: realDate.full,
      extension: 'txt',
      isNotepad: true,
      content: '',
      positionX: 0,
      positionY: 0,
      displayOrder: 0
    };

    setFolderFilesMap(prev => ({
      ...prev,
      [opened3DFolder.id]: [newNoteFile, ...(prev[opened3DFolder.id] || [])]
    }));

    // Persister dans la table D1 classeur_files
    CloudStorageAPI.saveClasseurFile(newNoteFile, opened3DFolder.id).catch(() => {});

    setIsNewNoteModalOpen(false);
    setNewNoteNameInput('');
    showToast(`Document "${finalName}" créé !`);

    // Ouvrir immédiatement le bloc-notes dans le volet divisé pour écrire dedans
    handleSelectFile(newNoteFile);
    setNoteTextContent('');
    setNoteTitleContent('');
    setIsNoteSavedIndicator(true);
  };

  const handleUpdateNoteContent = (newText: string, newTitle?: string, fileId?: string) => {
    const targetId = fileId || splitSelectedFile?.id || activeEditingNote?.id;
    if (!targetId) return;

    const titleToSave = newTitle !== undefined ? newTitle : noteTitleContent;
    const combinedContent = (titleToSave ? `${titleToSave}\n\n` : '') + newText;
    const byteLength = new Blob([combinedContent]).size;
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = byteLength > 0 ? Math.floor(Math.log(byteLength) / Math.log(k)) : 0;
    const sizeStr = byteLength > 0 ? parseFloat((byteLength / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i] : '0 o';

    // 1. Mettre à jour folderFilesMap pour tous les dossiers contenant cette note
    setFolderFilesMap(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [folderId, files] of Object.entries(next)) {
        if (files.some(f => f.id === targetId)) {
          next[folderId] = files.map(f => f.id === targetId ? {
            ...f,
            content: newText,
            noteTitle: titleToSave,
            size: sizeStr,
            sizeBytes: byteLength
          } : f);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // 2. Mettre à jour la liste des documents
    setDocumentsList(prev => prev.map(f => {
      if (f.id === targetId) {
        return {
          ...f,
          content: newText,
          noteTitle: titleToSave,
          size: sizeStr,
          sizeBytes: byteLength
        };
      }
      return f;
    }));

    // 3. Mettre à jour les fichiers récents Cloud si présent
    setCloudRecentFiles(prev => prev.map(f => {
      if (f.id === targetId) {
        return {
          ...f,
          content: newText,
          noteTitle: titleToSave,
          size: sizeStr,
          sizeBytes: byteLength
        };
      }
      return f;
    }));

    // 4. Mettre à jour dans le visualiseur actif
    if (splitSelectedFile && splitSelectedFile.id === targetId) {
      setSplitSelectedFile(prev => prev ? {
        ...prev,
        content: newText,
        noteTitle: titleToSave,
        size: sizeStr,
        sizeBytes: byteLength
      } : null);
    }

    setIsNoteSavedIndicator(true);

    // 5. Sauvegarde automatique fiable dans Cloudflare D1 avec debounce 300ms
    if (noteSaveTimeoutRef.current) {
      clearTimeout(noteSaveTimeoutRef.current);
    }
    noteSaveTimeoutRef.current = setTimeout(() => {
      CloudStorageAPI.updateClasseurFile(targetId, {
        noteTitle: titleToSave,
        content: newText,
        size: sizeStr,
        sizeBytes: byteLength
      }).catch(err => console.error('[StudyCloud Note AutoSave Error]', err));
    }, 300);
  };

  const handleSaveAndCloseNote = () => {
    if (activeEditingNote) {
      handleUpdateNoteContent(noteTextContent, noteTitleContent, activeEditingNote.id);
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
      }
      CloudStorageAPI.updateClasseurFile(activeEditingNote.id, {
        noteTitle: noteTitleContent,
        content: noteTextContent,
      }).catch(() => {});
    }
    setActiveEditingNote(null);
    setNoteTextContent('');
    setNoteTitleContent('');
    setIsNoteSavedIndicator(true);
  };

  // État et refs de Drag & Drop pour réordonner les dossiers 3D dans le Classeur
  interface FolderDragState {
    folder: ClasseurCreatedFolder;
    x: number;
    y: number;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }

  const [folderDragState, setFolderDragState] = useState<FolderDragState | null>(null);
  const [holdingFolderId, setHoldingFolderId] = useState<string | null>(null);
  const folderPointerDownRef = useRef<{
    x: number;
    y: number;
    currentX: number;
    currentY: number;
    folder: ClasseurCreatedFolder;
    cardRect: DOMRect;
    isDragging: boolean;
    isHoldActive: boolean;
  } | null>(null);
  const folderLongPressTimerRef = useRef<any>(null);
  const folderLastSwapTimeRef = useRef<number>(0);

  // Gestion des événements Pointer globaux pour réordonner fluidement les dossiers
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const p = folderPointerDownRef.current;
      if (!p) return;

      p.currentX = e.clientX;
      p.currentY = e.clientY;

      const deltaX = Math.abs(e.clientX - p.x);
      const deltaY = Math.abs(e.clientY - p.y);

      // Si l'utilisateur bouge de manière significative (> 12px) avant la fin du maintien continu requis,
      // on annule le timer de maintien pour éviter tout déplacement intempestif
      if (!p.isHoldActive && (deltaX > 12 || deltaY > 12)) {
        if (folderLongPressTimerRef.current) {
          clearTimeout(folderLongPressTimerRef.current);
          folderLongPressTimerRef.current = null;
        }
      }

      // Le glissement est actif UNIQUEMENT après que le maintien continu ait été validé
      if (p.isDragging && p.isHoldActive) {
        setFolderDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);

        const now = Date.now();
        if (now - folderLastSwapTimeRef.current > 140) {
          const element = document.elementFromPoint(e.clientX, e.clientY);
          const cardElement = element?.closest('[data-classeur-folder-id]');
          if (cardElement) {
            const targetId = cardElement.getAttribute('data-classeur-folder-id');
            if (targetId && targetId !== p.folder.id) {
              folderLastSwapTimeRef.current = Date.now();
              setClasseur3DFolders(prevList => {
                const fromIndex = prevList.findIndex(f => f.id === p.folder.id);
                const toIndex = prevList.findIndex(f => f.id === targetId);
                if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prevList;
                const next = [...prevList];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);
                return next;
              });
            }
          }
        }
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (folderLongPressTimerRef.current) {
        clearTimeout(folderLongPressTimerRef.current);
        folderLongPressTimerRef.current = null;
      }

      document.body.style.cursor = '';
      setHoldingFolderId(null);

      const p = folderPointerDownRef.current;
      if (p && !p.isDragging) {
        const deltaX = Math.abs(e.clientX - p.x);
        const deltaY = Math.abs(e.clientY - p.y);
        // Clic simple rapide sans maintien continu : ouvre le dossier avec le curseur flèche normal
        if (deltaX < 12 && deltaY < 12) {
          setOpened3DFolder(p.folder);
        }
      } else if (p && p.isDragging) {
        // Sauvegarde de l'ordre et des positions X/Y dans Cloudflare D1
        setClasseur3DFolders(currentFolders => {
          const reorderPayload = currentFolders.map((f, idx) => ({
            id: f.id,
            displayOrder: idx,
            positionX: f.positionX || 0,
            positionY: f.positionY || 0,
            zoomLevel: folderZoomLevel
          }));
          CloudStorageAPI.reorderClasseurFolders(reorderPayload).catch(() => {});
          return currentFolders;
        });
      }
      folderPointerDownRef.current = null;
      setFolderDragState(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  // Empêcher le défilement tactile natif de la page quand un dossier 3D est en cours de déplacement
  useEffect(() => {
    const preventTouchScroll = (e: TouchEvent) => {
      if (folderPointerDownRef.current?.isDragging) {
        if (e.cancelable) e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventTouchScroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventTouchScroll);
    };
  }, []);

  const handleFolderPointerDown = (e: React.PointerEvent, folder: ClasseurCreatedFolder) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.studycloud-file-menu-panel') || (e.target as HTMLElement).closest('.studycloud-menu-trigger')) return;

    // Sur ordinateur avec souris : uniquement clic gauche
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const cardElement = (e.currentTarget as HTMLElement);
    const rect = cardElement.getBoundingClientRect();

    folderPointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      folder,
      cardRect: rect,
      isDragging: false,
      isHoldActive: false,
    };

    if (folderLongPressTimerRef.current) {
      clearTimeout(folderLongPressTimerRef.current);
      folderLongPressTimerRef.current = null;
    }

    // Maintien continu obligatoire pour activer le glissement (sur ordinateur comme sur mobile)
    folderLongPressTimerRef.current = setTimeout(() => {
      if (folderPointerDownRef.current) {
        folderPointerDownRef.current.isHoldActive = true;
        folderPointerDownRef.current.isDragging = true;
        setHoldingFolderId(folder.id);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(35); } catch {}
        }

        // Le curseur devient la paume qui a saisi le fichier pour le déplacer
        document.body.style.cursor = 'grabbing';

        setFolderDragState({
          folder,
          x: folderPointerDownRef.current.currentX,
          y: folderPointerDownRef.current.currentY,
          width: rect.width,
          height: rect.height,
          offsetX: folderPointerDownRef.current.x - rect.left,
          offsetY: folderPointerDownRef.current.y - rect.top,
        });
      }
    }, 280);
  };

  const handleDeleteCreatedFolder = (folderId: string) => {
    CloudStorageAPI.deleteClasseurFolder(folderId).catch(() => {});
    const getDescendantFolderIds = (id: string, all: ClasseurCreatedFolder[]): string[] => {
      const children = all.filter(f => f.parentId === id);
      return [id, ...children.flatMap(c => getDescendantFolderIds(c.id, all))];
    };

    const targetFolder = classeur3DFolders.find(f => f.id === folderId);

    setClasseur3DFolders(prev => {
      const toDeleteIds = getDescendantFolderIds(folderId, prev);
      setFolderFilesMap(mapPrev => {
        const next = { ...mapPrev };
        const deletedFolderFiles: FileItem[] = [];
        toDeleteIds.forEach(id => {
          if (next[id] && next[id].length > 0) {
            deletedFolderFiles.push(...next[id].map(f => ({ ...f, originalFolderId: id, isTrash: true })));
            delete next[id];
          }
        });
        const folderTrashItems: FileItem[] = toDeleteIds.map(fId => {
          const fObj = prev.find(pf => pf.id === fId) || (fId === targetFolder?.id ? targetFolder : null);
          return {
            id: fId,
            name: fObj?.name || 'Dossier',
            category: 'documents' as const,
            source: 'Classeur',
            sourceCategory: 'classeur_folder',
            size: '1 dossier 3D',
            sizeBytes: 2048,
            date: fObj?.dateText || new Date().toLocaleDateString('fr-FR'),
            isTrash: true,
            metadata: fObj
          } as FileItem;
        });
        setTrashFiles(tPrev => [...folderTrashItems, ...deletedFolderFiles, ...tPrev.filter(t => !toDeleteIds.includes(t.id))]);
        return next;
      });
      return prev.filter(f => !toDeleteIds.includes(f.id));
    });
  };

  // Lecteur Vidéo
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(90);
  const [videoVolume, setVideoVolume] = useState(0.9);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Lecteur Document (Pages & Mode d'affichage Vertical/Horizontal)
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const totalDocPages = 4;
  const [docLayoutMode, setDocLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');

  // Gestion du glissement tactile (main/doigt) et souris pour le mode horizontal du document
  const [docDragOffset, setDocDragOffset] = useState<number>(0);
  const [isDocDragging, setIsDocDragging] = useState<boolean>(false);
  const docDragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const docIsHorizontalDragRef = useRef<boolean>(false);
  const docHasMovedRef = useRef<boolean>(false);
  const lastDocWheelTimeRef = useRef<number>(0);

  // Glissement tactile (Écran tactile / Mobile / Tablette)
  const handleDocTouchStart = (e: React.TouchEvent) => {
    if (docLayoutMode !== 'horizontal') return;
    const touch = e.touches[0];
    docDragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    docIsHorizontalDragRef.current = false;
    docHasMovedRef.current = false;
  };

  const handleDocTouchMove = (e: React.TouchEvent) => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - docDragStartRef.current.x;
    const deltaY = touch.clientY - docDragStartRef.current.y;

    if (!docIsHorizontalDragRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        docDragStartRef.current = null;
        return;
      }
      if (Math.abs(deltaX) > 8) {
        docIsHorizontalDragRef.current = true;
        setIsDocDragging(true);
        docHasMovedRef.current = true;
      }
    }

    if (docIsHorizontalDragRef.current) {
      let adjustedDelta = deltaX;
      if (docCurrentPage === 1 && deltaX > 0) {
        adjustedDelta = deltaX * 0.25;
      } else if (docCurrentPage === totalDocPages && deltaX < 0) {
        adjustedDelta = deltaX * 0.25;
      }
      setDocDragOffset(adjustedDelta);
    }
  };

  const handleDocTouchEnd = () => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const deltaX = docDragOffset;
    const threshold = 40;

    if (deltaX < -threshold && docCurrentPage < totalDocPages) {
      setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
    } else if (deltaX > threshold && docCurrentPage > 1) {
      setDocCurrentPage(prev => Math.max(1, prev - 1));
    }

    setDocDragOffset(0);
    setIsDocDragging(false);
    docDragStartRef.current = null;
    docIsHorizontalDragRef.current = false;
  };

  // Glissement à la souris (Clic gauche maintenu et glissement gauche/droite)
  const handleDocMouseDown = (e: React.MouseEvent) => {
    if (docLayoutMode !== 'horizontal' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    docDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
    docIsHorizontalDragRef.current = false;
    docHasMovedRef.current = false;
  };

  const handleDocMouseMove = (e: React.MouseEvent) => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const deltaX = e.clientX - docDragStartRef.current.x;
    const deltaY = e.clientY - docDragStartRef.current.y;

    if (!docIsHorizontalDragRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        docDragStartRef.current = null;
        return;
      }
      if (Math.abs(deltaX) > 5) {
        docIsHorizontalDragRef.current = true;
        setIsDocDragging(true);
        docHasMovedRef.current = true;
      }
    }

    if (docIsHorizontalDragRef.current) {
      let adjustedDelta = deltaX;
      if (docCurrentPage === 1 && deltaX > 0) {
        adjustedDelta = deltaX * 0.25;
      } else if (docCurrentPage === totalDocPages && deltaX < 0) {
        adjustedDelta = deltaX * 0.25;
      }
      setDocDragOffset(adjustedDelta);
    }
  };

  const handleDocMouseUp = () => {
    if (docLayoutMode !== 'horizontal' || !docDragStartRef.current) return;
    const deltaX = docDragOffset;
    const threshold = 40;

    if (deltaX < -threshold && docCurrentPage < totalDocPages) {
      setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
    } else if (deltaX > threshold && docCurrentPage > 1) {
      setDocCurrentPage(prev => Math.max(1, prev - 1));
    }

    setDocDragOffset(0);
    setIsDocDragging(false);
    docDragStartRef.current = null;
    docIsHorizontalDragRef.current = false;
  };

  // Support navigation par molette ou défilement horizontal trackpad
  const handleDocWheel = (e: React.WheelEvent) => {
    if (docLayoutMode !== 'horizontal') return;
    const now = Date.now();
    if (now - lastDocWheelTimeRef.current < 450) return;

    if (Math.abs(e.deltaX) > 28 || (e.shiftKey && Math.abs(e.deltaY) > 28)) {
      const delta = Math.abs(e.deltaX) > 28 ? e.deltaX : e.deltaY;
      if (delta > 0 && docCurrentPage < totalDocPages) {
        lastDocWheelTimeRef.current = now;
        setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
      } else if (delta < 0 && docCurrentPage > 1) {
        lastDocWheelTimeRef.current = now;
        setDocCurrentPage(prev => Math.max(1, prev - 1));
      }
    }
  };

  // Navigation clavier pour le mode horizontal (Flèches gauche / droite)
  useEffect(() => {
    const isDoc = Boolean(
      splitSelectedFile &&
      (splitSelectedFile.category === 'documents' || /\.(pdf|docx?|pptx?|xlsx?|odt|rtf)$/i.test(splitSelectedFile.name)) &&
      !splitSelectedFile.isNotepad &&
      !splitSelectedFile.name.toLowerCase().endsWith('.txt')
    );
    if (docLayoutMode !== 'horizontal' || !isDoc) return;
    const handleDocKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setDocCurrentPage(prev => Math.max(1, prev - 1));
      }
    };
    window.addEventListener('keydown', handleDocKeyDown);
    return () => window.removeEventListener('keydown', handleDocKeyDown);
  }, [docLayoutMode, splitSelectedFile]);

  // Téléchargements réels synchronisés
  const [downloadedItems, setDownloadedItems] = useState<DownloadedItem[]>(() => getDownloadedFiles());

  useEffect(() => {
    const handleUpdate = () => {
      setDownloadedItems(getDownloadedFiles());
    };
    window.addEventListener('studycloud_download_updated', handleUpdate);
    return () => window.removeEventListener('studycloud_download_updated', handleUpdate);
  }, []);

  // Écoute de la touche Échap pour réduire le mode plein écran / agrandi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewerMaximized) {
        setIsViewerMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerMaximized]);

  // Réinitialiser le plein écran et agrandi dès que l'espace d'étude s'ouvre pour éviter toute bande noire
  useEffect(() => {
    const handleStudySpaceOpened = () => {
      setIsFullscreen(false);
      setIsViewerMaximized(false);
    };
    window.addEventListener('studycloud_open_study_space', handleStudySpaceOpened);
    return () => window.removeEventListener('studycloud_open_study_space', handleStudySpaceOpened);
  }, []);

  // Fermer les menus déroulants lors d'un clic extérieur ou touche Échap SANS jamais bloquer le défilement de la page
  useEffect(() => {
    if (!activeMenuFileId && !docMenuOpenId && !audioMenuSongId && !menuOpenId && !isPlayerMenuOpen && !isHeaderMenuOpen && !activeFolderMenuId) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.studycloud-file-menu-panel') || target.closest('.studycloud-menu-trigger')) {
        return;
      }
      setActiveMenuFileId(null);
      setDocMenuOpenId(null);
      setAudioMenuSongId(null);
      setMenuOpenId(null);
      setIsPlayerMenuOpen(false);
      setIsHeaderMenuOpen(false);
      setActiveFolderMenuId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuFileId(null);
        setDocMenuOpenId(null);
        setAudioMenuSongId(null);
        setMenuOpenId(null);
        setIsPlayerMenuOpen(false);
        setIsHeaderMenuOpen(false);
        setActiveFolderMenuId(null);
      }
    };

    // Timeout de 10ms pour ne pas capturer le clic d'ouverture du menu lui-même
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuFileId, docMenuOpenId, audioMenuSongId, menuOpenId, isPlayerMenuOpen, isHeaderMenuOpen, activeFolderMenuId]);

  // Références et état pour l'import de fichier
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Sous-page ouverte
  const [currentSubView, setCurrentSubView] = useState<SubMenuView | null>(null);

  // État de l'onglet actif dans l'Espace Cloud (Classeur sélectionné par défaut comme demandé)
  const [cloudActiveTab, setCloudActiveTab] = useState<'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'apps' | 'favorites' | 'secure-folder' | 'trash'>('classeur');
  const [selectedClasseurFolder, setSelectedClasseurFolder] = useState<string | null>(null);
  const [trashFiles, setTrashFiles] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_trash_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_trash_files', JSON.stringify(trashFiles));
    } catch {}
  }, [trashFiles]);

  useEffect(() => {
    const isCloud = currentSubView?.id === 'studycloud-collection-cloud-storage';
    if (currentSubView?.id === 'studycloud-collection-trash' || (isCloud && cloudActiveTab === 'trash')) {
      try {
        const saved = localStorage.getItem('studycloud_trash_files');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setTrashFiles(parsed);
          }
        }
      } catch {}
    }
  }, [currentSubView, cloudActiveTab]);

  // Synchronisation initiale complète avec Cloudflare D1 et R2 (Option B)
  useEffect(() => {
    let isMounted = true;

    async function loadCloudBackendData() {
      try {
        // 0. Aperçu général et récents (filtrés strictement pour ne jamais faire revenir un fichier supprimé)
        const overview = await CloudStorageAPI.getOverview();
        if (isMounted && overview && Array.isArray(overview.recentFiles)) {
          const deletedRecentIds = getDeletedRecentIds();
          const locallyDeletedIds = getLocallyDeletedFileIds();
          const trashRaw = localStorage.getItem('studycloud_trash_files');
          let trashIdSet = new Set<string>();
          try {
            if (trashRaw) {
              const parsed = JSON.parse(trashRaw);
              if (Array.isArray(parsed)) trashIdSet = new Set(parsed.map((t: any) => t.id));
            }
          } catch {}

          const cleanRecentFiles = overview.recentFiles.filter((f: any) => 
            !isMockFile(f) &&
            !deletedRecentIds.has(f.id) &&
            !deletedRecentIds.has(f.name) &&
            !locallyDeletedIds.has(f.id) &&
            !locallyDeletedIds.has(f.name) &&
            !trashIdSet.has(f.id)
          );

          setCloudRecentFiles(prev => {
            const newMap = new Map<string, FileItem>();
            // Préserver d'abord les fichiers récents ajoutés lors de cette session
            prev.forEach(p => {
              if (
                !deletedRecentIds.has(p.id) && 
                (!p.name || !deletedRecentIds.has(p.name)) &&
                !locallyDeletedIds.has(p.id) && 
                (!p.name || !locallyDeletedIds.has(p.name)) &&
                !trashIdSet.has(p.id)
              ) {
                newMap.set(p.id, p);
              }
            });
            // Compléter avec les récents du backend non supprimés
            cleanRecentFiles.forEach((b: any) => {
              if (!newMap.has(b.id)) {
                newMap.set(b.id, b);
              }
            });
            return Array.from(newMap.values()).slice(0, 6);
          });
        }

        // Favoris et Épinglés réels depuis Cloudflare D1
        const [cloudFavorites, cloudPinned] = await Promise.all([
          CloudStorageAPI.getFavorites().catch(() => []),
          CloudStorageAPI.getPinned().catch(() => [])
        ]);
        const favIdSet = new Set((cloudFavorites || []).map((f: any) => f.item_id || f.id));
        const pinIdSet = new Set((cloudPinned || []).map((p: any) => p.item_id || p.id));

        // 1. Dossiers 3D du Classeur
        const cloudFolders = await CloudStorageAPI.getClasseurFolders();
        if (isMounted && cloudFolders) {
          const mappedFolders = cloudFolders.map(f => ({
            ...f,
            isFavorite: favIdSet.has(f.id),
            isPinned: pinIdSet.has(f.id)
          }));
          setClasseur3DFolders(mappedFolders);

          // 2. Fichiers et bloc-notes de chaque dossier
          const filesMap: Record<string, FileItem[]> = {};
          for (const folder of mappedFolders) {
            const files = await CloudStorageAPI.getClasseurFiles(folder.id);
            if (files && files.length > 0) {
              filesMap[folder.id] = files.map(file => ({
                ...file,
                isFavorite: favIdSet.has(file.id),
                isPinned: pinIdSet.has(file.id)
              }));
            }
          }
          if (isMounted) {
            setFolderFilesMap(filesMap);
          }
        }

        // 3. Corbeille
        const trash = await CloudStorageAPI.getTrashFiles();
        if (isMounted && trash) {
          setTrashFiles(trash);
        }

        // 4. Dossier Sécurisé
        const secFiles = await CloudStorageAPI.getSecureFiles();
        if (isMounted && secFiles) {
          setSecureFolderFiles(secFiles);
        }

        // 5. Audio
        const audio = await CloudStorageAPI.getAudioList();
        if (isMounted && audio) {
          setAudioList(audio.map(a => ({
            ...a,
            isFavorite: favIdSet.has(a.id),
            isPinned: pinIdSet.has(a.id)
          })));
        }

        // 6. Images
        const images = await CloudStorageAPI.getImagesList();
        if (isMounted && images) {
          setImagesList(images.map(img => ({
            ...img,
            isFavorite: favIdSet.has(img.id),
            isPinned: pinIdSet.has(img.id)
          })));
        }

        // 7. Vidéos
        const videos = await CloudStorageAPI.getVideosList();
        if (isMounted && videos) {
          setVideosList(videos.map(v => ({
            ...v,
            isFavorite: favIdSet.has(v.id),
            isPinned: pinIdSet.has(v.id)
          })));
        }

        // 8. Documents
        const docs = await CloudStorageAPI.getDocumentsList();
        if (isMounted && docs) {
          setDocumentsList(docs.map(d => ({
            ...d,
            isFavorite: favIdSet.has(d.id),
            isPinned: pinIdSet.has(d.id)
          })));
        }

        // 9. Téléchargements réels depuis Cloudflare D1
        const cloudDownloads = await CloudStorageAPI.getDownloadsList();
        if (isMounted) {
          if (cloudDownloads && cloudDownloads.length > 0) {
            const mapped: DownloadedItem[] = cloudDownloads.map(dl => ({
              id: dl.id,
              name: dl.name,
              category: (dl.category as any) || 'downloads',
              size: dl.size || '0 o',
              sizeBytes: dl.sizeBytes,
              date: dl.date || (dl as any).downloadedAt || "Aujourd'hui",
              timestamp: dl.timestamp || Date.now(),
              url: dl.url || (dl as any).file_url,
              extension: dl.extension || (dl.name.includes('.') ? dl.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER'),
              type: dl.type,
              previewUrl: dl.previewUrl || dl.url,
              videoUrl: dl.videoUrl || dl.url,
              audioUrl: dl.audioUrl || dl.url,
              documentCategory: dl.documentCategory || 'COURS',
              isFavorite: favIdSet.has(dl.id),
              isPinned: pinIdSet.has(dl.id),
            }));
            setDownloadedItems(mapped);
          } else {
            setDownloadedItems([]);
            clearLegacyDownloadedFiles();
          }
        }
      } catch (e) {
        console.warn('[Page1FilesMenuView] Chargement D1/R2 local fallback:', e);
      }
    }

    loadCloudBackendData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Défilement et glissement horizontal de la barre de l'Espace Cloud (souris et tactile)
  const cloudNavScrollRef = useRef<HTMLDivElement>(null);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [navStartX, setNavStartX] = useState(0);
  const [navScrollLeft, setNavScrollLeft] = useState(0);

  const handleNavMouseDown = (e: React.MouseEvent) => {
    if (!cloudNavScrollRef.current) return;
    setIsNavDragging(true);
    setNavStartX(e.pageX - cloudNavScrollRef.current.offsetLeft);
    setNavScrollLeft(cloudNavScrollRef.current.scrollLeft);
  };

  const handleNavMouseMove = (e: React.MouseEvent) => {
    if (!isNavDragging || !cloudNavScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - cloudNavScrollRef.current.offsetLeft;
    const walk = (x - navStartX) * 1.5;
    cloudNavScrollRef.current.scrollLeft = navScrollLeft - walk;
  };

  const handleNavMouseUpOrLeave = () => {
    setIsNavDragging(false);
  };

  const scrollCloudNav = (direction: 'left' | 'right') => {
    if (cloudNavScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      cloudNavScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const isCloudView = currentSubView?.id === 'studycloud-collection-cloud-storage';

  // Fiches et dossiers pédagogiques pour le Classeur
  const [classeurFolders, setClasseurFolders] = useState<any[]>([]);

  const [classeurExtraDocs] = useState<FileItem[]>([]);

  // Applications éducatives disponibles
  const studyAppsList = [
    { id: 'app-calc', name: 'Calculatrice Scientifique', category: 'Outils', icon: LayoutGrid, color: 'text-pink-400', desc: 'Calcul formel, trigonométrie et matrices' },
    { id: 'app-board', name: 'Tableau Blanc Interactif', category: 'Étude', icon: Sparkles, color: 'text-cyan-400', desc: 'Dessin vectoriel et schémas scientifiques' },
    { id: 'app-latex', name: 'Éditeur de Formules LaTeX', category: 'Maths', icon: FileCode, color: 'text-emerald-400', desc: 'Rendu d\'équations et export PDF' },
    { id: 'app-pomo', name: 'Chronomètre & Pomodoro', category: 'Focus', icon: Clock, color: 'text-amber-400', desc: 'Gestion des sessions de travail et pauses' },
    { id: 'app-dict', name: 'Dictionnaire Académique', category: 'Langues', icon: BookOpen, color: 'text-blue-400', desc: 'Définitions et terminologie scientifique' },
    { id: 'app-quiz', name: 'Générateur de Quiz IA', category: 'Révision', icon: Sparkles, color: 'text-purple-400', desc: 'Auto-évaluation instantanée par cours' },
    { id: 'app-notes', name: 'Bloc-Notes Express', category: 'Notes', icon: Pencil, color: 'text-rose-400', desc: 'Prise de notes rapides et brouillon' },
    { id: 'app-flash', name: 'Flashcards de Mémorisation', category: 'Mémoire', icon: Layers, color: 'text-orange-400', desc: 'Cartes mémo avec répétition espacée' },
    { id: 'app-sync', name: 'Cloud Drive Synchroniseur', category: 'Système', icon: Cloud, color: 'text-sky-400', desc: 'Sauvegarde automatique des cours' },
    { id: 'app-pdf', name: 'Convertisseur PDF & Scan', category: 'Docs', icon: FileText, color: 'text-indigo-400', desc: 'Compression et fusion de documents' },
    { id: 'app-audio', name: 'Studio Audio & Dictaphone', category: 'Médias', icon: Music, color: 'text-yellow-400', desc: 'Enregistrement de cours et podcasts' },
    { id: 'app-planner', name: 'Planificateur de Devoirs', category: 'Planning', icon: CheckCircle2, color: 'text-teal-400', desc: 'Calendrier des examens et rendus' },
  ];

  const handleRestoreFromTrash = (file: FileItem) => {
    setTrashFiles(prev => prev.filter(f => f.id !== file.id));
    if (file.category === 'folder' || (file as any).sourceCategory === 'classeur_folder') {
      const meta = (file as any).metadata || {};
      const restoredFolder: ClasseurCreatedFolder = {
        id: file.id,
        name: file.name,
        modelId: meta.modelId || '1',
        primaryColor: meta.primaryColor || '#EA580C',
        accentColor: meta.accentColor || '#F97316',
        iconName: meta.iconName || 'Folder',
        textDark: meta.textDark || false,
        positionX: meta.positionX || 0,
        positionY: meta.positionY || 0,
        dateText: file.date || new Date().toLocaleDateString('fr-FR'),
        zoomLevel: meta.zoomLevel || 10,
        displayOrder: meta.displayOrder || 0,
        parentId: meta.parentId || null
      };
      setClasseur3DFolders(prev => prev.some(f => f.id === file.id) ? prev : [restoredFolder, ...prev]);
    } else if (file.originalFolderId) {
      setFolderFilesMap(prev => ({
        ...prev,
        [file.originalFolderId!]: [file, ...(prev[file.originalFolderId!] || []).filter(f => f.id !== file.id)]
      }));
    } else if (file.category === 'images' || file.isImage) {
      setImagesList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
    } else if (file.category === 'videos' || !!file.videoUrl || (file as any).isVideo) {
      setVideosList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
    } else if (file.category === 'audio' || !!file.audioUrl || (file as any).isAudio) {
      setAudioList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
    } else if (file.category === 'downloads') {
      setDownloadedItems(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
    } else {
      setDocumentsList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
    }

    if (splitSelectedFile?.id === file.id) {
      setSplitSelectedFile(null);
    }
    setSelectedItemIds(prev => prev.filter(id => id !== file.id));
    CloudStorageAPI.restoreTrashItem(file.id).catch(() => {});
    showToast(`"${file.name}" restauré !`);
  };

  const handleRestoreSelectedFromTrash = () => {
    if (selectedItemIds.length === 0) return;
    const itemsToRestore = trashFiles.filter(f => selectedItemIds.includes(f.id));
    itemsToRestore.forEach(file => {
      if (file.category === 'folder' || (file as any).sourceCategory === 'classeur_folder') {
        const meta = (file as any).metadata || {};
        const restoredFolder: ClasseurCreatedFolder = {
          id: file.id,
          name: file.name,
          modelId: meta.modelId || '1',
          primaryColor: meta.primaryColor || '#EA580C',
          accentColor: meta.accentColor || '#F97316',
          iconName: meta.iconName || 'Folder',
          textDark: meta.textDark || false,
          positionX: meta.positionX || 0,
          positionY: meta.positionY || 0,
          dateText: file.date || new Date().toLocaleDateString('fr-FR'),
          zoomLevel: meta.zoomLevel || 10,
          displayOrder: meta.displayOrder || 0,
          parentId: meta.parentId || null
        };
        setClasseur3DFolders(prev => prev.some(f => f.id === file.id) ? prev : [restoredFolder, ...prev]);
      } else if (file.originalFolderId) {
        setFolderFilesMap(prev => ({
          ...prev,
          [file.originalFolderId!]: [file, ...(prev[file.originalFolderId!] || []).filter(f => f.id !== file.id)]
        }));
      } else if (file.category === 'images' || file.isImage) {
        setImagesList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else if (file.category === 'videos' || !!file.videoUrl || (file as any).isVideo) {
        setVideosList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else if (file.category === 'audio' || !!file.audioUrl || (file as any).isAudio) {
        setAudioList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else if (file.category === 'downloads') {
        setDownloadedItems(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else {
        setDocumentsList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      }
    });

    setTrashFiles(prev => prev.filter(f => !selectedItemIds.includes(f.id)));
    if (splitSelectedFile && selectedItemIds.includes(splitSelectedFile.id)) {
      setSplitSelectedFile(null);
    }
    CloudStorageAPI.restoreMultipleTrash(selectedItemIds).catch(() => {});
    setSelectedItemIds([]);
    setIsSelectionMode(false);
    showToast(`${itemsToRestore.length} élément(s) restauré(s) !`);
  };

  const handlePermanentDelete = (id: string) => {
    setTrashFiles(prev => prev.filter(f => f.id !== id));
    if (splitSelectedFile?.id === id) {
      setSplitSelectedFile(null);
    }
    setSelectedItemIds(prev => prev.filter(i => i !== id));
    deleteFileBlob(id).catch(() => {});
    removeDownloadedFile(id);
    markFileLocallyDeleted(id);
    markRecentLocallyDeleted(id);
    setCloudRecentFiles(prev => prev.filter(f => f.id !== id));
    CloudStorageAPI.deleteTrashPermanently([id]).catch(() => {});
    showToast('Fichier définitivement supprimé.');
  };

  const handlePermanentDeleteSelectedFromTrash = () => {
    if (selectedItemIds.length === 0) return;
    const count = selectedItemIds.length;
    const ids = [...selectedItemIds];
    setTrashFiles(prev => prev.filter(f => !ids.includes(f.id)));
    if (splitSelectedFile && ids.includes(splitSelectedFile.id)) {
      setSplitSelectedFile(null);
    }
    ids.forEach(id => {
      deleteFileBlob(id).catch(() => {});
      removeDownloadedFile(id);
      markFileLocallyDeleted(id);
      markRecentLocallyDeleted(id);
    });
    setCloudRecentFiles(prev => prev.filter(f => !ids.includes(f.id)));
    CloudStorageAPI.deleteTrashPermanently(ids).catch(() => {});
    setSelectedItemIds([]);
    setIsSelectionMode(false);
    showToast(`${count} élément(s) définitivement supprimé(s).`);
  };

  const handleRenameTrashFile = (file: FileItem) => {
    const currentName = file.name;
    const newName = window.prompt('Modifier le nom du fichier :', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const trimmed = newName.trim();
      setTrashFiles(prev => prev.map(f => f.id === file.id ? { ...f, name: trimmed } : f));
      showToast(`Fichier renommé en "${trimmed}" !`);
    }
  };

  const handleEmptyTrash = () => {
    const allTrashIds = trashFiles.map(f => f.id);
    setTrashFiles([]);
    if (splitSelectedFile && allTrashIds.includes(splitSelectedFile.id)) {
      setSplitSelectedFile(null);
    }
    setSelectedItemIds([]);
    setIsSelectionMode(false);
    allTrashIds.forEach(id => {
      deleteFileBlob(id).catch(() => {});
      removeDownloadedFile(id);
      markFileLocallyDeleted(id);
      markRecentLocallyDeleted(id);
    });
    setCloudRecentFiles(prev => prev.filter(f => !allTrashIds.includes(f.id)));
    CloudStorageAPI.emptyTrash().catch(() => {});
    showToast('Corbeille vidée.');
  };

  const showToast = (_msg?: string) => {
    // Désactivé : aucun message lors des clics sur les boutons
  };

  const [profileToastMessage, setProfileToastMessage] = useState<string | null>(null);
  const profileToastTimerRef = useRef<any>(null);

  const showProfileToast = (msg: string) => {
    if (profileToastTimerRef.current) clearTimeout(profileToastTimerRef.current);
    setProfileToastMessage(msg);
    profileToastTimerRef.current = setTimeout(() => {
      setProfileToastMessage(null);
    }, 3500);
  };

  const handleRestoreDefaultWallpaperAndAvatar = () => {
    localStorage.removeItem('studycloud_dashboard_wallpaper');
    localStorage.removeItem('unifolder_user_avatar');
    window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: null } }));
    window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: null } }));
    showProfileToast("Fond d'écran et photo de profil d'origine restaurés !");
  };

  // Helper pour filtrer tout résidu de faux fichiers / mock dans le stockage local
  const isMockFile = (f: any): boolean => {
    if (!f || !f.id) return true;
    const id = String(f.id);
    if (/^(doc|img|vid|aud|rec-cld|sec-doc|dl)-\d+/i.test(id)) return true;
    if (id.startsWith('aud-img3-')) return true;
    if (id.startsWith('classeur-doc-')) return true;
    if (f.videoUrl && f.videoUrl.includes('commondatastorage.googleapis.com')) return true;
    if (f.audioUrl && f.audioUrl.includes('soundhelix.com')) return true;
    return false;
  };

  // 1. DOCUMENTS (Stockage réel Cloudflare D1/R2)
  const [documentsList, setDocumentsList] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_documents_files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(f => !isMockFile(f));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_documents_files', JSON.stringify(documentsList));
    } catch {}
  }, [documentsList]);

  // 2. IMAGES (Stockage réel Cloudflare D1/R2)
  const [imagesList, setImagesList] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_images_files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(f => !isMockFile(f));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_images_files', JSON.stringify(imagesList));
    } catch {}
  }, [imagesList]);

  // 3. VIDÉOS (Stockage réel Cloudflare D1/R2)
  const [videosList, setVideosList] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_videos_files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(f => !isMockFile(f));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_videos_files', JSON.stringify(videosList));
    } catch {}
  }, [videosList]);

  // 4. AUDIO / MUSIQUE (Stockage réel Cloudflare D1/R2)
  const [audioList, setAudioList] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_audio_files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(f => !isMockFile(f));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_audio_files', JSON.stringify(audioList));
    } catch {}
  }, [audioList]);

  // FICHIERS RÉCENTS : STUDYCLOUD (Strictement fichiers réels de l'utilisateur, 6 éléments max)
  const DEFAULT_RECENT_FILES: FileItem[] = [];

  // État des fichiers récents avec persistance locale
  const [cloudRecentFiles, setCloudRecentFiles] = useState<FileItem[]>(() => {
    try {
      const deletedRecentIds = getDeletedRecentIds();
      const locallyDeletedIds = getLocallyDeletedFileIds();
      const saved = localStorage.getItem('studycloud_recent_files');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(f => 
            !isMockFile(f) &&
            !deletedRecentIds.has(f.id) &&
            (!f.name || !deletedRecentIds.has(f.name)) &&
            !locallyDeletedIds.has(f.id) &&
            (!f.name || !locallyDeletedIds.has(f.name))
          );
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_RECENT_FILES;
  });

  // Synchronisation de la liste des récents dans le stockage local
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_recent_files', JSON.stringify(cloudRecentFiles));
    } catch {
      // ignore
    }
  }, [cloudRecentFiles]);


  // Effacer complètement un élément des récents et de tout le stockage local / cloud
  const handleRemoveRecentFile = (fileId: string, fileItem?: FileItem) => {
    const file = fileItem || cloudRecentFiles.find(f => f.id === fileId);
    const fileName = file?.name;

    // 1. Inscrire dans la liste noire persistante locale pour ne jamais revenir après rechargement
    markRecentLocallyDeleted(fileId, fileName);
    markFileLocallyDeleted(fileId, fileName);

    // 2. Retirer immédiatement des récents
    setCloudRecentFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId && (!fileName || f.name !== fileName));
      try {
        localStorage.setItem('studycloud_recent_files', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 3. Purger complètement le binaire local IndexedDB
    deleteFileBlob(fileId).catch(() => {});
    removeDownloadedFile(fileId);
    if (fileName) removeDownloadedFile(fileName);

    // 4. Retirer des listes actives du composant
    setDocumentsList(prev => prev.filter(d => d.id !== fileId));
    setImagesList(prev => prev.filter(img => img.id !== fileId));
    setVideosList(prev => prev.filter(vid => vid.id !== fileId));
    setAudioList(prev => prev.filter(aud => aud.id !== fileId));
    setDownloadedItems(prev => prev.filter(dl => dl.id !== fileId));

    if (splitSelectedFile?.id === fileId) {
      setSplitSelectedFile(null);
    }

    // 5. Supprimer dans Cloudflare D1/R2 pour que le serveur ne le renvoie plus
    if (file) {
      if ((file as any).originalFolderId || (file as any).folderId) {
        CloudStorageAPI.deleteClasseurFile(file.id).catch(console.error);
      } else if (file.category === 'images' || file.isImage) {
        CloudStorageAPI.deleteImage(file.id).catch(console.error);
      } else if (file.category === 'videos' || file.videoUrl) {
        CloudStorageAPI.deleteVideo(file.id).catch(console.error);
      } else if (file.category === 'audio' || file.audioUrl) {
        CloudStorageAPI.deleteAudio(file.id).catch(console.error);
      } else if (file.category === 'downloads') {
        CloudStorageAPI.deleteDownload(file.id).catch(console.error);
      } else {
        CloudStorageAPI.deleteDocument(file.id).catch(console.error);
      }
    }

    showToast("Fichier effacé définitivement.");
  };

  // Déclencher le sélecteur de fichier pour l'Accueil
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  // Configuration dynamique du bouton "+ Importer" selon le menu actif
  const getMenuImportConfig = () => {
    const isCloud = isCloudView;
    const currentTab = isCloud ? cloudActiveTab : null;
    const viewId = currentSubView?.id || '';

    // Exclusions strictes demandées : "sauf le menu téléchargement, favoris, applications, dossier sécurisé et corbeille"
    if (viewId === 'studycloud-category-downloads' || currentTab === 'downloads') return null;
    if (viewId === 'studycloud-collection-favorites' || currentTab === 'favorites') return null;
    if (viewId === 'studycloud-category-applications' || currentTab === 'apps') return null;
    if (viewId === 'studycloud-collection-secure-folder' || currentTab === 'secure-folder') return null;
    if (viewId === 'studycloud-collection-trash' || currentTab === 'trash') return null;

    // Classeur : "ne doit pas être où on créer les dossiers mais a l'intérieur des dossiers créer"
    if (viewId === 'studycloud-classeur-classeur' || currentTab === 'classeur' || currentSubView?.type === 'classeur') {
      if (!opened3DFolder) return null;
      return {
        category: 'classeur' as const,
        accept: '*/*',
        label: 'Importer',
        fullLabel: 'Importer un fichier',
        title: `Importer un fichier dans « ${opened3DFolder.name} »`,
        colorClass: 'border-orange-500/40 hover:border-orange-400 text-orange-400',
        iconColor: 'text-orange-400',
        folderId: opened3DFolder.id
      };
    }

    // Images (Prend la couleur émeraude du logo Images)
    if (viewId === 'studycloud-category-images' || currentTab === 'images') {
      return {
        category: 'images' as const,
        accept: 'image/*',
        label: 'Importer',
        fullLabel: 'Importer une image',
        title: 'Importer une image dans Images',
        colorClass: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-400',
        iconColor: 'text-emerald-400'
      };
    }

    // Vidéos (Prend la couleur violette du logo Vidéos)
    if (viewId === 'studycloud-category-videos' || currentTab === 'videos') {
      return {
        category: 'videos' as const,
        accept: 'video/*',
        label: 'Importer',
        fullLabel: 'Importer une vidéo',
        title: 'Importer une vidéo dans Vidéos',
        colorClass: 'border-purple-500/40 hover:border-purple-400 text-purple-400',
        iconColor: 'text-purple-400'
      };
    }

    // Audio / Musique (Prend la couleur ambre/orange du logo Audio)
    if (viewId === 'studycloud-category-audio' || currentTab === 'audio') {
      return {
        category: 'audio' as const,
        // PAS d'attribut accept restrictif sur Windows : ouvre "Tous les fichiers (*.*)" pour afficher 100% des fichiers
        // (y compris audios WhatsApp, notes vocales .opus, .ogg, .m4a, enregistrements vocaux sans aucun camouflage)
        accept: undefined,
        label: 'Importer',
        fullLabel: 'Importer un audio',
        title: 'Importer un fichier audio dans Musique',
        colorClass: 'border-amber-500/40 hover:border-amber-400 text-amber-400',
        iconColor: 'text-amber-400'
      };
    }

    // Documents (Prend la couleur bleue/cyan du logo Documents)
    if (viewId === 'studycloud-category-documents' || currentTab === 'documents') {
      return {
        category: 'documents' as const,
        accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.rtf',
        label: 'Importer',
        fullLabel: 'Importer un document',
        title: 'Importer un document dans Documents',
        colorClass: 'border-blue-500/40 hover:border-blue-400 text-blue-400',
        iconColor: 'text-blue-400'
      };
    }

    return null;
  };

  const menuImportConfig = getMenuImportConfig();

  // 1. Traiter les fichiers importés depuis l'Accueil (Analyse auto par le worker, jamais classeur)
  const handleHomeFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList) as File[];

    if (fileInputRef.current) fileInputRef.current.value = '';

    // Créer immédiatement les objets FileItem avec prévisualisation locale et stockage IndexedDB
    const newItemsWithFiles = files.map((file, idx) => {
      const localBlobUrl = URL.createObjectURL(file);
      const normName = file.name.toLowerCase();
      const ext = normName.includes('.') ? (normName.split('.').pop()?.toUpperCase() || 'FICHIER') : 'FICHIER';
      const fileId = `cf-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const sizeKb = file.size > 0 ? (file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} Ko` : `${(file.size / (1024 * 1024)).toFixed(1)} Mo`) : '0 o';

      let autoCat: 'images' | 'videos' | 'audio' | 'documents' = 'documents';
      if (normName.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)$/i)) autoCat = 'images';
      else if (normName.match(/\.(mp4|mov|webm|avi|mkv|flv|wmv|3gp|m4v)$/i)) autoCat = 'videos';
      else if (normName.match(/\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|aiff|alac|mid|midi|caf|3ga|oga|spx|m4b|m4p|mp2|mp1|wv|ape|ra|voc|au|gsm|dss|act|raw)$/i) || normName.includes('whatsapp') || normName.includes('ptt-') || normName.includes('aud-')) autoCat = 'audio';

      // Sauvegarde binaire locale immédiate dans IndexedDB
      storeFileBlob(fileId, file).catch(() => {});

      const item: FileItem = {
        id: fileId,
        name: file.name,
        category: autoCat,
        source: 'StudyCloud Local',
        size: sizeKb,
        sizeBytes: file.size,
        date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        extension: ext,
        url: localBlobUrl,
        previewUrl: autoCat === 'audio' ? undefined : localBlobUrl,
        videoUrl: autoCat === 'videos' ? localBlobUrl : undefined,
        audioUrl: autoCat === 'audio' ? localBlobUrl : undefined,
      };
      return { file, item };
    });

    const newItems = newItemsWithFiles.map(x => x.item);
    const fileIds = newItems.map(x => x.id);

    // Ajout immédiat aux listes respectives (affichage instantané)
    newItems.forEach(item => {
      unmarkRecentLocallyDeleted(item.id, item.name);
      unmarkFileLocallyDeleted(item.id, item.name);
      if (item.category === 'images') setImagesList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
      else if (item.category === 'videos') setVideosList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
      else if (item.category === 'audio') setAudioList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
      else setDocumentsList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
    });
    setCloudRecentFiles(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))].slice(0, 6));

    // Démarrer l'animation de progression sur les cartes ("un trait qui se remplit")
    startSavingAnimation(fileIds);

    // Envoi en arrière-plan vers Cloudflare D1/R2 sans bloquer l'UI
    (async () => {
      let successCount = 0;
      for (const { file, item } of newItemsWithFiles) {
        try {
          const normName = file.name.toLowerCase();
          let previewDataUrl: string | null = null;
          if (item.category === 'videos') {
            previewDataUrl = await generateVideoThumbnail(file, file.name, file.name);
          } else if (item.category === 'audio') {
            previewDataUrl = await extractAudioCover(file, file.name, 'Créateur StudyCloud');
          } else if (normName.endsWith('.pdf')) {
            previewDataUrl = await generatePdfThumbnail(file, file.name);
          }

          if (previewDataUrl) {
            setCachedMediaThumbnail(item.id, previewDataUrl);
            CloudStorageAPI.saveMediaThumbnail(item.id, item.category, previewDataUrl).catch(() => {});
          }

          const res = await CloudStorageAPI.uploadFile(file, 'auto', file.name, undefined, previewDataUrl || undefined);
          if (res?.success && res.file) {
            const uploadedFile = res.file;
            const updateItemFn = (prev: FileItem[]) => prev.map(f => {
              if (f.id === item.id) {
                return {
                  ...f,
                  ...uploadedFile,
                  url: uploadedFile.url || f.url,
                  videoUrl: uploadedFile.videoUrl || f.videoUrl,
                  audioUrl: uploadedFile.audioUrl || f.audioUrl,
                  previewUrl: previewDataUrl || uploadedFile.previewUrl || f.previewUrl,
                  thumbnailUrl: previewDataUrl || uploadedFile.thumbnailUrl || f.thumbnailUrl,
                  coverUrl: previewDataUrl || uploadedFile.coverUrl || f.coverUrl,
                };
              }
              return f;
            });
            if (item.category === 'images') setImagesList(updateItemFn);
            else if (item.category === 'videos') setVideosList(updateItemFn);
            else if (item.category === 'audio') setAudioList(updateItemFn);
            else setDocumentsList(updateItemFn);
            setCloudRecentFiles(updateItemFn);
          }
          successCount++;
        } catch (err: any) {
          console.warn('[handleHomeFileSelected] Background upload:', err);
        }
      }
      if (successCount > 0) {
        showToast(`${successCount} fichier(s) classé(s) automatiquement dans vos menus !`);
      }
    })();
  };

  // 2. Traiter les fichiers importés depuis un sous-menu spécifique (Validation stricte par le worker)
  const handleMenuFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList) as File[];

    const importConfig = getMenuImportConfig();
    if (!importConfig) return;

    if (categoryFileInputRef.current) categoryFileInputRef.current.value = '';

    // 1. Créer immédiatement les objets FileItem avec prévisualisation locale et stockage IndexedDB
    const newItemsWithFiles = files.map((file, idx) => {
      const localBlobUrl = URL.createObjectURL(file);
      const normName = file.name.toLowerCase();
      const ext = normName.includes('.') ? (normName.split('.').pop()?.toUpperCase() || 'FICHIER') : 'FICHIER';
      const fileId = `cf-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const sizeKb = file.size > 0 ? (file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} Ko` : `${(file.size / (1024 * 1024)).toFixed(1)} Mo`) : '0 o';

      // Stocker le binaire immédiatement dans IndexedDB pour que le document soit disponible instantanément
      storeFileBlob(fileId, file).catch(() => {});

      const isAudio = importConfig.category === 'audio' || normName.match(/\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|aiff|alac|mid|midi|caf|3ga|oga|spx|m4b|m4p|mp2|mp1|wv|ape|ra|voc|au|gsm|dss|act|raw)$/i) || normName.includes('whatsapp') || normName.includes('ptt-') || normName.includes('aud-');
      const isVideo = importConfig.category === 'videos' || normName.match(/\.(mp4|mov|webm|avi|mkv|flv|wmv|3gp|m4v)$/i);

      const item: FileItem = {
        id: fileId,
        name: file.name,
        category: importConfig.category === 'classeur' ? 'documents' : importConfig.category,
        source: importConfig.category === 'classeur' && opened3DFolder ? opened3DFolder.name : 'StudyCloud Local',
        size: sizeKb,
        sizeBytes: file.size,
        date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        extension: ext,
        url: localBlobUrl,
        previewUrl: isAudio ? undefined : localBlobUrl,
        videoUrl: isVideo ? localBlobUrl : undefined,
        audioUrl: isAudio ? localBlobUrl : undefined,
        originalFolderId: importConfig.folderId
      };
      return { file, item };
    });

    const newItems = newItemsWithFiles.map(x => x.item);
    const fileIds = newItems.map(x => x.id);

    // 2. Ajout immédiat à la liste du menu : les cartes apparaissent instantanément
    newItems.forEach(item => {
      unmarkRecentLocallyDeleted(item.id, item.name);
      unmarkFileLocallyDeleted(item.id, item.name);
    });
    if (importConfig.category === 'images') {
      setImagesList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (importConfig.category === 'videos') {
      setVideosList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (importConfig.category === 'audio') {
      setAudioList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (importConfig.category === 'documents') {
      setDocumentsList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (importConfig.category === 'classeur' && importConfig.folderId) {
      setFolderFilesMap(prev => ({
        ...prev,
        [importConfig.folderId!]: [...newItems, ...(prev[importConfig.folderId!] || []).filter(f => !fileIds.includes(f.id))]
      }));
    }
    setCloudRecentFiles(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))].slice(0, 6));

    // 3. Lancer l'animation de trait qui se remplit sur chaque fichier importé
    startSavingAnimation(fileIds);

    // 4. Téléversement et génération d'aperçus en arrière-plan sans bloquer l'UI
    (async () => {
      let successCount = 0;
      for (const { file, item } of newItemsWithFiles) {
        try {
          const normName = file.name.toLowerCase();
          let previewDataUrl: string | null = null;
          if (importConfig.category === 'videos' || normName.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
            previewDataUrl = await generateVideoThumbnail(file, file.name, file.name);
          } else if (importConfig.category === 'audio' || normName.match(/\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|aiff|alac|mid|midi|caf|3ga|oga|spx|m4b|m4p|mp2|mp1|wv|ape|ra|voc|au|gsm|dss|act|raw)$/i) || normName.includes('whatsapp') || normName.includes('ptt-') || normName.includes('aud-')) {
            previewDataUrl = await extractAudioCover(file, file.name, 'Créateur StudyCloud');
          } else if (normName.endsWith('.pdf')) {
            previewDataUrl = await generatePdfThumbnail(file, file.name);
          }

          if (previewDataUrl) {
            setCachedMediaThumbnail(item.id, previewDataUrl);
            CloudStorageAPI.saveMediaThumbnail(item.id, importConfig.category, previewDataUrl).catch(() => {});
          }

          const res = await CloudStorageAPI.uploadFile(
            file, 
            importConfig.category, 
            file.name, 
            importConfig.folderId,
            previewDataUrl || undefined
          );

          if (res?.success && res.file) {
            const uploadedFile = res.file;
            const updateItemFn = (prev: FileItem[]) => prev.map(f => {
              if (f.id === item.id) {
                return {
                  ...f,
                  ...uploadedFile,
                  url: uploadedFile.url || f.url,
                  videoUrl: uploadedFile.videoUrl || f.videoUrl,
                  audioUrl: uploadedFile.audioUrl || f.audioUrl,
                  previewUrl: (f.category === 'audio' || uploadedFile.category === 'audio') ? undefined : (previewDataUrl || uploadedFile.previewUrl || f.previewUrl),
                  thumbnailUrl: previewDataUrl || uploadedFile.thumbnailUrl || f.thumbnailUrl,
                  coverUrl: previewDataUrl || uploadedFile.coverUrl || f.coverUrl,
                };
              }
              return f;
            });

            if (importConfig.category === 'images') setImagesList(updateItemFn);
            else if (importConfig.category === 'videos') setVideosList(updateItemFn);
            else if (importConfig.category === 'audio') setAudioList(updateItemFn);
            else if (importConfig.category === 'documents') setDocumentsList(updateItemFn);
            else if (importConfig.category === 'classeur' && importConfig.folderId) {
              setFolderFilesMap(prev => ({
                ...prev,
                [importConfig.folderId!]: (prev[importConfig.folderId!] || []).map(f => f.id === item.id ? { ...f, ...uploadedFile } : f)
              }));
            }
            setCloudRecentFiles(updateItemFn);
          }
          successCount++;
        } catch (err: any) {
          console.warn('[handleMenuFileSelected] Erreur upload arrière-plan:', err);
        }
      }
      if (successCount > 0) {
        showToast(`${successCount} fichier(s) importé(s) avec succès !`);
      }
    })();
  };

  // DOSSIER SÉCURISÉ (Fichiers protégés par coffre-fort et isolés réels)
  const [secureFolderFiles, setSecureFolderFiles] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_secure_files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(f => !isMockFile(f));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_secure_files', JSON.stringify(secureFolderFiles));
    } catch {}
  }, [secureFolderFiles]);


  const getStoredPin = () => localStorage.getItem('studycloud_secure_folder_pin');

  // Déverrouillage ou définition initiale du code secret du Dossier Sécurisé
  const handleUnlockSecureFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stored = getStoredPin();

    if (!stored) {
      // Première configuration : le code doit être supérieur à 4 caractères
      const trimmed = securePinInput.trim();
      if (trimmed.length <= 4) {
        setSecurePinError("Le code secret doit comporter plus de 4 caractères.");
        return;
      }
      if (trimmed !== securePinConfirmInput.trim()) {
        setSecurePinError("La confirmation ne correspond pas au code saisi.");
        return;
      }
      localStorage.setItem('studycloud_secure_folder_pin', trimmed);
      CloudStorageAPI.setSecurePin(trimmed).catch(console.error);
      setIsSecureFolderUnlocked(true);
      setIsPinModalOpen(false);
      setSecurePinInput('');
      setSecurePinConfirmInput('');
      setSecurePinError(null);

      // Redirection automatique à l'intérieur du menu
      if (pinTargetDestination === 'cloud-tab') {
        setCloudActiveTab('secure-folder');
        setSplitSelectedFile(null);
      } else {
        handleOpenSubMenu('collection', 'secure-folder', 'Dossier sécurisé', Lock, 'text-blue-400');
      }
      setPinTargetDestination(null);
    } else {
      // Code déjà existant : vérification locale ou via worker Cloudflare D1
      const isLocalOk = securePinInput.trim() === stored.trim();
      let isWorkerOk = false;
      try {
        isWorkerOk = await CloudStorageAPI.verifySecurePin(securePinInput.trim());
      } catch (err) {
        // repli silencieux sur la vérification locale
      }

      if (isLocalOk || isWorkerOk) {
        setIsSecureFolderUnlocked(true);
        setIsPinModalOpen(false);
        setSecurePinInput('');
        setSecurePinError(null);

        // Redirection automatique à l'intérieur du menu
        if (pinTargetDestination === 'cloud-tab') {
          setCloudActiveTab('secure-folder');
          setSplitSelectedFile(null);
        } else {
          handleOpenSubMenu('collection', 'secure-folder', 'Dossier sécurisé', Lock, 'text-blue-400');
        }
        setPinTargetDestination(null);
      } else {
        setSecurePinError("Code incorrect. Veuillez réessayer.");
      }
    }
  };

  // Fermeture / Annulation du modal de code de sécurité
  const handleCloseSecureFolderPinModal = () => {
    setIsPinModalOpen(false);
    setPinTargetDestination(null);
    setSecurePinInput('');
    setSecurePinConfirmInput('');
    setSecurePinError(null);

    // Si on est déjà sur l'écran du dossier sécurisé alors qu'il est verrouillé, on quitte vers l'écran précédent
    if (currentSubView?.id === 'studycloud-collection-secure-folder') {
      setCurrentSubView(null);
    }
    if (isCloudView && cloudActiveTab === 'secure-folder') {
      setCloudActiveTab('classeur');
    }
  };

  // Modification du code secret depuis le menu 3 traits
  const handleChangePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stored = getStoredPin();

    if (stored && oldPinInput.trim() !== stored.trim()) {
      setChangePinError("L'ancien code est incorrect.");
      return;
    }
    const newTrimmed = newPinInput.trim();
    if (newTrimmed.length <= 4) {
      setChangePinError("Le nouveau code doit comporter plus de 4 caractères.");
      return;
    }
    if (newTrimmed !== newPinConfirmInput.trim()) {
      setChangePinError("La confirmation ne correspond pas au nouveau code.");
      return;
    }

    localStorage.setItem('studycloud_secure_folder_pin', newTrimmed);
    CloudStorageAPI.setSecurePin(newTrimmed, oldPinInput.trim()).catch(console.error);
    setChangePinSuccess("Code secret mis à jour avec succès !");
    setChangePinError(null);
    setTimeout(() => {
      setIsChangePinModalOpen(false);
      setOldPinInput('');
      setNewPinInput('');
      setNewPinConfirmInput('');
      setChangePinSuccess(null);
    }, 1200);
  };

  // Verrouiller les éléments sélectionnés vers le dossier sécurisé
  const handleLockSelected = (currentCategoryList: FileItem[]) => {
    if (selectedItemIds.length === 0) return;
    const idsToLock = [...selectedItemIds];
    const count = idsToLock.length;

    const lockedItems: FileItem[] = [];

    idsToLock.forEach(id => {
      // 1. Est-ce un dossier ?
      const folder = classeur3DFolders.find(f => f.id === id);
      if (folder) {
        const securedFolderItem: FileItem = {
          id: folder.id,
          name: folder.name,
          category: 'documents' as const,
          source: 'Dossier Sécurisé',
          originalCategory: 'classeur_folder',
          size: '1 dossier 3D',
          sizeBytes: 2048,
          date: folder.dateText,
          isSecure: true,
          metadata: folder
        } as FileItem;
        lockedItems.push(securedFolderItem);
        CloudStorageAPI.moveToSecureFolder(securedFolderItem, 'classeur_folder').catch(console.error);
        setClasseur3DFolders(prev => prev.filter(f => f.id !== folder.id));
      } else {
        // 2. Est-ce un fichier ?
        const item = currentCategoryList.find(f => f.id === id) ||
          (opened3DFolder ? (folderFilesMap[opened3DFolder.id] || []).find(f => f.id === id) : null) ||
          documentsList.find(f => f.id === id) ||
          imagesList.find(f => f.id === id) ||
          videosList.find(f => f.id === id) ||
          audioList.find(f => f.id === id) ||
          downloadedItems.find(f => f.id === id) ||
          Object.values(folderFilesMap).flat().find(f => f.id === id);

        if (item) {
          const locked: FileItem = {
            ...item,
            isSecure: true,
            originalCategory: (item as any).originalCategory || item.category,
            originalSource: (item as any).originalSource || item.source,
            source: 'Dossier Sécurisé'
          };
          lockedItems.push(locked);
          const origCat = (item as any).originalCategory || item.category || 'documents';
          CloudStorageAPI.moveToSecureFolder(item, origCat, (item as any).folderId || opened3DFolder?.id).catch(console.error);
        }
      }
    });

    if (lockedItems.length > 0) {
      setSecureFolderFiles(prev => [...lockedItems, ...prev]);
    }

    // Retirer des listes d'origine pour isolation
    setDocumentsList(prev => prev.filter(d => !idsToLock.includes(d.id)));
    setImagesList(prev => prev.filter(img => !idsToLock.includes(img.id)));
    setVideosList(prev => prev.filter(vid => !idsToLock.includes(vid.id)));
    setAudioList(prev => prev.filter(aud => !idsToLock.includes(aud.id)));
    setDownloadedItems(prev => prev.filter(dl => !idsToLock.includes(dl.id)));
    setCloudRecentFiles(prev => prev.filter(f => !idsToLock.includes(f.id)));
    if (opened3DFolder) {
      setFolderFilesMap(prev => ({
        ...prev,
        [opened3DFolder.id]: (prev[opened3DFolder.id] || []).filter(f => !idsToLock.includes(f.id))
      }));
    }

    if (splitSelectedFile && idsToLock.includes(splitSelectedFile.id)) {
      setSplitSelectedFile(null);
    }

    setIsSelectionMode(false);
    setSelectedItemIds([]);
    showToast(`${count} élément(s) verrouillé(s) dans le dossier sécurisé !`);
  };

  // Déverrouiller les éléments sélectionnés et les renvoyer à leur emplacement d'origine
  const handleUnlockSelected = () => {
    if (selectedItemIds.length === 0) return;
    const itemsToUnlock = secureFolderFiles.filter(f => selectedItemIds.includes(f.id));
    if (itemsToUnlock.length === 0) return;

    itemsToUnlock.forEach(file => {
      const origCat = (file as any).originalCategory || file.category;
      const origSource = (file as any).originalSource || 'StudyCloud';

      if (origCat === 'classeur_folder' || file.category === 'folder') {
        const meta = (file as any).metadata || {};
        const restoredFolder: ClasseurCreatedFolder = {
          id: file.id,
          name: file.name,
          modelId: meta.modelId || '1',
          primaryColor: meta.primaryColor || '#EA580C',
          accentColor: meta.accentColor || '#F97316',
          iconName: meta.iconName || 'Folder',
          textDark: meta.textDark || false,
          positionX: meta.positionX || 0,
          positionY: meta.positionY || 0,
          dateText: file.date || new Date().toLocaleDateString('fr-FR'),
          zoomLevel: meta.zoomLevel || 10,
          displayOrder: meta.displayOrder || 0,
          parentId: meta.parentId || null
        };
        setClasseur3DFolders(prev => prev.some(f => f.id === file.id) ? prev : [restoredFolder, ...prev]);
      } else {
        const restored: FileItem = {
          ...file,
          isSecure: false,
          category: origCat,
          source: origSource
        };

        if (origCat === 'documents') setDocumentsList(prev => [restored, ...prev]);
        else if (origCat === 'images') setImagesList(prev => [restored, ...prev]);
        else if (origCat === 'videos') setVideosList(prev => [restored, ...prev]);
        else if (origCat === 'audio') setAudioList(prev => [restored, ...prev]);
        else if (origCat === 'downloads') setDownloadedItems(prev => [restored, ...prev]);
        else if (origCat === 'classeur' && (file as any).originalFolderId) {
          const fId = (file as any).originalFolderId;
          setFolderFilesMap(prev => ({
            ...prev,
            [fId]: [restored, ...(prev[fId] || [])]
          }));
        } else {
          setDocumentsList(prev => [restored, ...prev]);
        }
      }

      // Restauration dans Cloudflare D1
      CloudStorageAPI.restoreFromSecureFolder(file.id).catch(console.error);
    });

    setSecureFolderFiles(prev => prev.filter(f => !selectedItemIds.includes(f.id)));

    if (splitSelectedFile && selectedItemIds.includes(splitSelectedFile.id)) {
      setSplitSelectedFile(null);
    }

    setIsSelectionMode(false);
    setSelectedItemIds([]);
    showToast(`${itemsToUnlock.length} élément(s) déverrouillé(s) !`);
  };

  const handleSecureSelected = handleLockSelected;

  // Téléchargement propre directement sur l'appareil de l'utilisateur
  const downloadFileDirectly = async (file: FileItem) => {
    try {
      // 1. Si note TXT ou contenu texte
      if (file.content !== undefined && (file.isNotepad || file.extension === 'txt' || file.name.toLowerCase().endsWith('.txt'))) {
        const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.name.toLowerCase().endsWith('.txt') ? file.name : `${file.name}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return;
      }

      // 2. Si URL distante ou blob
      let targetUrl = file.url || file.previewUrl || (file as any).fileUrl || (file as any).videoUrl || (file as any).audioUrl;
      if (!targetUrl && file.r2Key) {
        const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
        targetUrl = `${baseUrl}/api/cloud/file/${file.category || 'documents'}/${encodeURIComponent(file.r2Key)}?download=1&filename=${encodeURIComponent(file.name)}`;
      }

      if (targetUrl) {
        if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
          const a = document.createElement('a');
          a.href = targetUrl;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }

        // Tenter de télécharger en tant que blob pour forcer l'enregistrement direct
        try {
          const resp = await fetch(targetUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
            return;
          }
        } catch (fetchErr) {
          console.warn('Fetch blob download error, falling back:', fetchErr);
        }

        // Fallback: ajout du paramètre download=1 si endpoint du worker
        let downloadUrl = targetUrl;
        if (downloadUrl.includes('/api/cloud/file/')) {
          downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + `download=1&filename=${encodeURIComponent(file.name)}`;
        }
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Erreur téléchargement propre:', err);
    }
  };

  // Téléchargement d'un fichier avec enregistrement dans le menu téléchargement et mise à jour des récents
  const handleDownloadFile = (file: { name: string; size?: string; sizeBytes?: number; category?: any; url?: string; previewUrl?: string; r2Key?: string; content?: string; isNotepad?: boolean; extension?: string; id?: string }) => {
    downloadFileDirectly(file as FileItem);
    recordDownloadedFile({
      name: file.name,
      size: file.size,
      sizeBytes: file.sizeBytes,
      category: file.category
    });

    const fileItem = file as FileItem;
    unmarkRecentLocallyDeleted(fileItem.id, fileItem.name);
    unmarkFileLocallyDeleted(fileItem.id, fileItem.name);
    setCloudRecentFiles(prev => {
      const filtered = prev.filter(f => f.id !== fileItem.id && (!fileItem.name || f.name !== fileItem.name));
      return [fileItem, ...filtered].slice(0, 6);
    });

    showToast(`Téléchargement de "${file.name}" en cours...`);
  };

  // Partage de fichier
  const handleShareFile = async (file: FileItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: file.name,
          text: `Fichier StudyCloud : ${file.name}`
        });
        showToast('Partage réussi !');
        return;
      } catch (e) {}
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Lien copié dans le presse-papier !');
    } catch (e) {
      showToast(`Partage de ${file.name}`);
    }
  };

  // Calcul du nouveau nom de duplication avec incrémentation numérique (ex: noté 2., 3.. ou nom 2, nom 3)
  const computeDuplicateName = (originalName: string, existingNames: string[]): string => {
    const hasExt = originalName.includes('.');
    const ext = hasExt ? originalName.substring(originalName.lastIndexOf('.')) : '';
    const base = hasExt ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

    // Détecter un éventuel numéro ou suffixe de copie à la fin (ex: "Cours 2", "Cours (2)", "Cours (Copie)")
    const regex = /^(.*?)(?:\s+(?:(?:\()?(\d+)(?:\))?|\(Copie\)))?$/;
    const match = base.match(regex);
    const cleanBase = (match && match[1]) ? match[1].trim() : base;

    let counter = 2;
    let candidate = `${cleanBase} ${counter}${ext}`;
    const lowerNames = existingNames.map(n => n.toLowerCase());
    while (lowerNames.includes(candidate.toLowerCase())) {
      counter++;
      candidate = `${cleanBase} ${counter}${ext}`;
    }
    return candidate;
  };

  // Actions du menu universel (3 traits) pour tous les fichiers :
  // Cocher, Tout cocher, Télécharger, Supprimer, Partager, Créer un lien, Déplacer, Dupliquer, Favoris, Épingler, Renommer
  const handleGenericFileAction = (action: string, file: FileItem, currentCategoryList: FileItem[]) => {
    setActiveMenuFileId(null);
    setDocMenuOpenId(null);
    setAudioMenuSongId(null);

    switch (action) {
      case 'check':
        setIsSelectionMode(true);
        setSelectedItemIds([file.id]);
        showToast(`"${file.name}" coché`);
        break;

      case 'check_all': {
        setIsSelectionMode(true);
        const allIds = currentCategoryList.map(f => f.id);
        setSelectedItemIds(allIds);
        showToast(`Tous les ${currentCategoryList.length} éléments cochés`);
        break;
      }

      case 'download':
        handleDownloadFile(file);
        break;

      case 'delete': {
        // Supprime de la liste adéquate et archive dans la corbeille
        const fileWithSource: FileItem = {
          ...file,
          originalFolderId: opened3DFolder?.id || file.originalFolderId,
          isTrash: true
        };
        setTrashFiles(prev => [fileWithSource, ...prev.filter(f => f.id !== file.id)]);
        setDocumentsList(prev => prev.filter(d => d.id !== file.id));
        setImagesList(prev => prev.filter(img => img.id !== file.id));
        setVideosList(prev => prev.filter(vid => vid.id !== file.id));
        setAudioList(prev => prev.filter(aud => aud.id !== file.id));
        setDownloadedItems(prev => prev.filter(dl => dl.id !== file.id));
        setCloudRecentFiles(prev => prev.filter(f => f.id !== file.id && (!file.name || f.name !== file.name)));
        markRecentLocallyDeleted(file.id, file.name);
        markFileLocallyDeleted(file.id, file.name);
        deleteFileBlob(file.id).catch(() => {});
        removeDownloadedFile(file.id);
        if (file.name) removeDownloadedFile(file.name);
        if (opened3DFolder) {
          setFolderFilesMap(prev => ({
            ...prev,
            [opened3DFolder.id]: (prev[opened3DFolder.id] || []).filter(f => f.id !== file.id)
          }));
        }
        if (splitSelectedFile?.id === file.id) {
          setSplitSelectedFile(null);
        }

        // Appel API Cloudflare D1 pour persister dans trash_files et supprimer de la table active
        if (opened3DFolder || file.originalFolderId || (file as any).folderId) {
          CloudStorageAPI.deleteClasseurFile(file.id).catch(console.error);
        } else if (file.category === 'images' || file.isImage) {
          CloudStorageAPI.deleteImage(file.id).catch(console.error);
        } else if (file.category === 'videos' || file.videoUrl) {
          CloudStorageAPI.deleteVideo(file.id).catch(console.error);
        } else if (file.category === 'audio' || file.audioUrl) {
          CloudStorageAPI.deleteAudio(file.id).catch(console.error);
        } else if (file.category === 'downloads') {
          CloudStorageAPI.deleteDownload(file.id).catch(console.error);
        } else {
          CloudStorageAPI.deleteDocument(file.id).catch(console.error);
        }

        showToast(`"${file.name}" déplacé dans la corbeille !`);
        break;
      }

      case 'share':
        handleShareFile(file);
        break;

      case 'create_link': {
        if (onOpenCreateShareLink) {
          onOpenCreateShareLink([{
            id: file.id,
            name: file.name,
            size: file.sizeBytes || 0,
            type: file.extension || file.category || 'file',
            url: file.url || file.previewUrl
          }]);
          showToast(`Création du lien pour "${file.name}"...`);
        } else {
          const link = `${window.location.origin}${window.location.pathname}#${file.category || 'file'}-${file.id}`;
          try {
            navigator.clipboard?.writeText(link);
            showToast('Lien copié dans le presse-papiers !');
          } catch {
            showToast(`Lien créé pour "${file.name}"`);
          }
        }
        break;
      }

      case 'move': {
        const items = isSelectionMode && selectedItemIds.includes(file.id) && selectedItemIds.length > 1
          ? currentCategoryList.filter(f => selectedItemIds.includes(f.id))
          : [file];
        setItemsToTransfer(items);
        setTransferSelectedFolderIds([]);
        setTransferNavFolderId(null);
        setTransferSearchQuery('');
        setIsTransferPromptOpen(true);
        break;
      }

      case 'lock_file':
      case 'secure_folder': {
        const securedFile: FileItem = {
          ...file,
          isSecure: true,
          originalCategory: (file as any).originalCategory || file.category,
          originalSource: (file as any).originalSource || file.source,
          source: 'Dossier Sécurisé'
        };
        setSecureFolderFiles(prev => [securedFile, ...prev]);

        // Retirer de sa liste d'origine pour isolation
        setDocumentsList(prev => prev.filter(d => d.id !== file.id));
        setImagesList(prev => prev.filter(img => img.id !== file.id));
        setVideosList(prev => prev.filter(vid => vid.id !== file.id));
        setAudioList(prev => prev.filter(aud => aud.id !== file.id));
        setDownloadedItems(prev => prev.filter(dl => dl.id !== file.id));
        setCloudRecentFiles(prev => prev.filter(f => f.id !== file.id));
        if (opened3DFolder) {
          setFolderFilesMap(prev => ({
            ...prev,
            [opened3DFolder.id]: (prev[opened3DFolder.id] || []).filter(f => f.id !== file.id)
          }));
        }

        if (splitSelectedFile?.id === file.id) {
          setSplitSelectedFile(null);
        }

        // Persistance dans Cloudflare D1 secure_files
        const origCat = (file as any).originalCategory || file.category || 'documents';
        CloudStorageAPI.moveToSecureFolder(file, origCat, (file as any).folderId || opened3DFolder?.id).catch(console.error);

        showToast(`"${file.name}" verrouillé dans le dossier sécurisé !`);
        break;
      }

      case 'unlock_file':
      case 'restore_from_secure': {
        const origCat = (file as any).originalCategory || file.category;
        const origSource = (file as any).originalSource || 'StudyCloud';
        const restoredFile: FileItem = {
          ...file,
          isSecure: false,
          category: origCat,
          source: origSource
        };
        setSecureFolderFiles(prev => prev.filter(f => f.id !== file.id));

        if (origCat === 'documents') setDocumentsList(prev => [restoredFile, ...prev]);
        else if (origCat === 'images') setImagesList(prev => [restoredFile, ...prev]);
        else if (origCat === 'videos') setVideosList(prev => [restoredFile, ...prev]);
        else if (origCat === 'audio') setAudioList(prev => [restoredFile, ...prev]);
        else if (origCat === 'downloads') setDownloadedItems(prev => [restoredFile, ...prev]);
        else if (origCat === 'classeur' && (file as any).originalFolderId) {
          const fId = (file as any).originalFolderId;
          setFolderFilesMap(prev => ({
            ...prev,
            [fId]: [restoredFile, ...(prev[fId] || [])]
          }));
        } else {
          setDocumentsList(prev => [restoredFile, ...prev]);
        }

        if (splitSelectedFile?.id === file.id) {
          setSplitSelectedFile(null);
        }

        // Restauration dans Cloudflare D1
        CloudStorageAPI.restoreFromSecureFolder(file.id).catch(console.error);

        showToast(`"${file.name}" déverrouillé !`);
        break;
      }

      case 'duplicate': {
        const currentNames = currentCategoryList.map(f => f.name);
        const newName = computeDuplicateName(file.name, currentNames);
        const newFile: FileItem = {
          ...file,
          id: `${file.category || 'item'}-dup-${Date.now()}`,
          name: newName,
          date: "Aujourd'hui, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isPinned: false
        };
        if (file.category === 'documents') {
          setDocumentsList(prev => [newFile, ...prev]);
        } else if (file.category === 'images') {
          setImagesList(prev => [newFile, ...prev]);
        } else if (file.category === 'videos') {
          setVideosList(prev => [newFile, ...prev]);
        } else if (file.category === 'audio') {
          setAudioList(prev => [newFile, ...prev]);
        } else if (file.category === 'downloads') {
          setDownloadedItems(prev => [newFile as any, ...prev]);
        }
        if (opened3DFolder) {
          setFolderFilesMap(prev => ({
            ...prev,
            [opened3DFolder.id]: [newFile, ...(prev[opened3DFolder.id] || [])]
          }));
        }
        // Écriture du doublon dans la table D1 correspondante
        CloudStorageAPI.duplicateItem(file.id, file.category, opened3DFolder?.id, newName).catch(console.error);
        showToast(`Fichier dupliqué : "${newFile.name}" !`);
        break;
      }

      case 'favorite': {
        const newFav = !file.isFavorite;
        const toggleFav = (list: FileItem[]) =>
          list.map(f => f.id === file.id ? { ...f, isFavorite: newFav } : f);
        if (file.category === 'documents') setDocumentsList(toggleFav);
        else if (file.category === 'images') setImagesList(toggleFav);
        else if (file.category === 'videos') setVideosList(toggleFav);
        else if (file.category === 'audio') setAudioList(toggleFav);
        setDownloadedItems(prev => prev.map(f => f.id === file.id ? { ...f, isFavorite: newFav } : f));
        if (opened3DFolder) {
          setFolderFilesMap(prev => ({
            ...prev,
            [opened3DFolder.id]: (prev[opened3DFolder.id] || []).map(f => f.id === file.id ? { ...f, isFavorite: newFav } : f)
          }));
        }
        // Persistance dans la table user_favorites D1
        if (newFav) {
          CloudStorageAPI.addFavorite(file.id, file.category, file.name).catch(console.error);
          showToast('Ajouté aux favoris !');
        } else {
          CloudStorageAPI.removeFavorite(file.id, file.category).catch(console.error);
          showToast('Retiré des favoris');
        }
        break;
      }

      case 'pin': {
        const newPin = !file.isPinned;
        const togglePin = (list: FileItem[]) => {
          const updated = list.map(f => f.id === file.id ? { ...f, isPinned: newPin } : f);
          if (newPin) {
            const item = updated.find(f => f.id === file.id);
            if (item) {
              return [item, ...updated.filter(f => f.id !== file.id)];
            }
          }
          return updated;
        };
        if (file.category === 'documents') setDocumentsList(togglePin);
        else if (file.category === 'images') setImagesList(togglePin);
        else if (file.category === 'videos') setVideosList(togglePin);
        else if (file.category === 'audio') setAudioList(togglePin);
        setDownloadedItems(prev => prev.map(f => f.id === file.id ? { ...f, isPinned: newPin } : f));
        if (opened3DFolder) {
          setFolderFilesMap(prev => {
            const list = prev[opened3DFolder.id] || [];
            const updated = list.map(f => f.id === file.id ? { ...f, isPinned: newPin } : f);
            if (newPin) {
              const item = updated.find(f => f.id === file.id);
              if (item) {
                return { ...prev, [opened3DFolder.id]: [item, ...updated.filter(f => f.id !== file.id)] };
              }
            }
            return { ...prev, [opened3DFolder.id]: updated };
          });
        }
        // Persistance dans la table pinned_items D1
        if (newPin) {
          CloudStorageAPI.addPinned(file.id, file.category).catch(console.error);
          showToast(`"${file.name}" épinglé au début !`);
        } else {
          CloudStorageAPI.removePinned(file.id, file.category).catch(console.error);
          showToast(`"${file.name}" désépinglé`);
        }
        break;
      }

      case 'rename': {
        const newName = window.prompt('Modifier le nom du fichier :', file.name);
        if (newName && newName.trim() && newName.trim() !== file.name) {
          const trimmed = newName.trim();
          const finalName = (file.isNotepad && !trimmed.toLowerCase().endsWith('.txt')) ? `${trimmed}.txt` : trimmed;
          const renameIn = (list: FileItem[]) =>
            list.map(f => f.id === file.id ? { ...f, name: finalName } : f);
          if (file.category === 'documents') setDocumentsList(renameIn);
          else if (file.category === 'images') setImagesList(renameIn);
          else if (file.category === 'videos') setVideosList(renameIn);
          else if (file.category === 'audio') setAudioList(renameIn);
          setDownloadedItems(prev => prev.map(f => f.id === file.id ? { ...f, name: finalName } : f));

          if (opened3DFolder) {
            setFolderFilesMap(prev => ({
              ...prev,
              [opened3DFolder.id]: (prev[opened3DFolder.id] || []).map(f => f.id === file.id ? { ...f, name: finalName } : f)
            }));
          }
          if (splitSelectedFile?.id === file.id) {
            setSplitSelectedFile(prev => prev ? { ...prev, name: finalName } : null);
          }
          // Mise à jour directe dans la table D1
          CloudStorageAPI.renameItem(file.id, finalName, file.category, opened3DFolder?.id).catch(console.error);
          showToast(`Fichier renommé en "${finalName}" !`);
        }
        break;
      }

      case 'set_as_profile_and_wallpaper': {
        const imageUrl = file.previewUrl || '';
        if (!imageUrl) {
          showProfileToast("Aperçu de l'image indisponible.");
          break;
        }
        localStorage.setItem('studycloud_dashboard_wallpaper', imageUrl);
        localStorage.setItem('unifolder_user_avatar', imageUrl);
        window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: imageUrl } }));
        window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: imageUrl } }));
        showProfileToast("Cette image a été définie comme photo de profil");
        break;
      }

      default:
        break;
    }
  };

  const handleDocAction = (action: string, doc: FileItem) => {
    handleGenericFileAction(action, doc, filteredDocuments);
  };

  // Gestion de la sélection d'éléments
  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = (list: FileItem[]) => {
    const idsToDelete = [...selectedItemIds];
    if (idsToDelete.length === 0) {
      showToast("Aucun élément sélectionné");
      return;
    }
    const count = idsToDelete.length;

    const deletedItems: FileItem[] = [];

    // Récursion pour trouver les sous-dossiers et fichiers d'un dossier
    const getDescendants = (folderId: string): { folderIds: string[]; files: FileItem[] } => {
      const subFolders = classeur3DFolders.filter(f => f.parentId === folderId);
      const directFiles = (folderFilesMap[folderId] || []).map(f => ({ ...f, originalFolderId: folderId, isTrash: true }));
      let allFolderIds = [folderId, ...subFolders.map(s => s.id)];
      let allFiles = [...directFiles];
      subFolders.forEach(sub => {
        const desc = getDescendants(sub.id);
        allFolderIds = [...allFolderIds, ...desc.folderIds];
        allFiles = [...allFiles, ...desc.files];
      });
      return { folderIds: allFolderIds, files: allFiles };
    };

    idsToDelete.forEach(id => {
      // 1. Est-ce un dossier 3D ?
      const folder = classeur3DFolders.find(f => f.id === id);
      if (folder) {
        CloudStorageAPI.deleteClasseurFolder(id).catch(console.error);

        const { folderIds, files } = getDescendants(id);

        deletedItems.push({
          id: folder.id,
          name: folder.name,
          category: 'documents' as const,
          source: 'Classeur',
          sourceCategory: 'classeur_folder',
          size: `${files.length} fichier(s)`,
          date: folder.dateText,
          isTrash: true,
          metadata: folder
        } as FileItem);

        deletedItems.push(...files);

        setClasseur3DFolders(prev => prev.filter(f => !folderIds.includes(f.id)));
        setFolderFilesMap(prev => {
          const next = { ...prev };
          folderIds.forEach(fId => delete next[fId]);
          return next;
        });

        if (opened3DFolder && folderIds.includes(opened3DFolder.id)) {
          setOpened3DFolder(null);
        }
      } else {
        // 2. Est-ce un fichier ?
        const found = list.find(f => f.id === id) ||
          (opened3DFolder ? (folderFilesMap[opened3DFolder.id] || []).find(f => f.id === id) : null) ||
          documentsList.find(f => f.id === id) ||
          imagesList.find(f => f.id === id) ||
          videosList.find(f => f.id === id) ||
          audioList.find(f => f.id === id) ||
          downloadedItems.find(f => f.id === id) ||
          Object.values(folderFilesMap).flat().find(f => f.id === id);

        if (found) {
          deletedItems.push({
            ...found,
            originalFolderId: opened3DFolder?.id || found.originalFolderId,
            isTrash: true
          });

          if (opened3DFolder || found.originalFolderId || (found as any).folderId) {
            CloudStorageAPI.deleteClasseurFile(found.id).catch(console.error);
          } else if (found.category === 'images' || found.isImage) {
            CloudStorageAPI.deleteImage(found.id).catch(console.error);
          } else if (found.category === 'videos' || found.videoUrl) {
            CloudStorageAPI.deleteVideo(found.id).catch(console.error);
          } else if (found.category === 'audio' || found.audioUrl) {
            CloudStorageAPI.deleteAudio(found.id).catch(console.error);
          } else if (found.category === 'downloads') {
            CloudStorageAPI.deleteDownload(found.id).catch(console.error);
          } else {
            CloudStorageAPI.deleteDocument(found.id).catch(console.error);
          }
        }
      }
    });

    if (deletedItems.length > 0) {
      setTrashFiles(prev => [...deletedItems, ...prev.filter(t => !idsToDelete.includes(t.id))]);
    }

    setDocumentsList(prev => prev.filter(d => !idsToDelete.includes(d.id)));
    setImagesList(prev => prev.filter(img => !idsToDelete.includes(img.id)));
    setVideosList(prev => prev.filter(vid => !idsToDelete.includes(vid.id)));
    setAudioList(prev => {
      const remaining = prev.filter(aud => !idsToDelete.includes(aud.id));
      if (splitSelectedFile && idsToDelete.includes(splitSelectedFile.id) && splitSelectedFile.category === 'audio') {
        if (remaining.length > 0) {
          setSplitSelectedFile(remaining[0]);
          setAudioDuration(remaining[0].durationSec || 219);
          setAudioCurrentTime(0);
        } else {
          setSplitSelectedFile(null);
        }
      }
      return remaining;
    });
    setDownloadedItems(prev => prev.filter(dl => !idsToDelete.includes(dl.id)));
    setCloudRecentFiles(prev => prev.filter(c => !idsToDelete.includes(c.id)));
    idsToDelete.forEach(id => {
      markRecentLocallyDeleted(id);
      markFileLocallyDeleted(id);
      deleteFileBlob(id).catch(() => {});
      removeDownloadedFile(id);
    });
    if (opened3DFolder) {
      setFolderFilesMap(prev => ({
        ...prev,
        [opened3DFolder.id]: (prev[opened3DFolder.id] || []).filter(f => !idsToDelete.includes(f.id))
      }));
    }
    if (splitSelectedFile && idsToDelete.includes(splitSelectedFile.id) && splitSelectedFile.category !== 'audio') {
      setSplitSelectedFile(null);
    }
    setSelectedItemIds([]);
    setIsSelectionMode(false);
    showToast(`${count} élément(s) déplacé(s) dans la corbeille`);
  };

  const handleDownloadSelected = (list: FileItem[]) => {
    if (selectedItemIds.length === 0) {
      showToast("Aucun élément sélectionné");
      return;
    }

    const filesToDownload: FileItem[] = [];

    const getFolderFilesRecursive = (folderId: string): FileItem[] => {
      const directFiles = folderFilesMap[folderId] || [];
      const subFolders = classeur3DFolders.filter(f => f.parentId === folderId);
      const subFiles = subFolders.flatMap(sub => getFolderFilesRecursive(sub.id));
      return [...directFiles, ...subFiles];
    };

    selectedItemIds.forEach(id => {
      const folder = classeur3DFolders.find(f => f.id === id);
      if (folder) {
        filesToDownload.push(...getFolderFilesRecursive(folder.id));
      } else {
        const item = list.find(f => f.id === id) ||
          (opened3DFolder ? (folderFilesMap[opened3DFolder.id] || []).find(f => f.id === id) : null) ||
          documentsList.find(f => f.id === id) ||
          imagesList.find(f => f.id === id) ||
          videosList.find(f => f.id === id) ||
          audioList.find(f => f.id === id) ||
          downloadedItems.find(f => f.id === id) ||
          Object.values(folderFilesMap).flat().find(f => f.id === id);
        if (item) {
          filesToDownload.push(item);
        }
      }
    });

    if (filesToDownload.length === 0) {
      showToast("Aucun fichier à télécharger");
      setIsSelectionMode(false);
      setSelectedItemIds([]);
      return;
    }

    filesToDownload.forEach((file, index) => {
      setTimeout(() => {
        handleDownloadFile(file);
      }, index * 250);
    });

    showToast(`${filesToDownload.length} fichier(s) en cours de téléchargement`);
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  const handleCreateLinkSelected = (list: FileItem[]) => {
    if (selectedItemIds.length === 0) {
      showToast("Aucun élément sélectionné");
      return;
    }

    const filesToShare: any[] = [];

    const getFolderFilesRecursive = (folderId: string): FileItem[] => {
      const directFiles = folderFilesMap[folderId] || [];
      const subFolders = classeur3DFolders.filter(f => f.parentId === folderId);
      const subFiles = subFolders.flatMap(sub => getFolderFilesRecursive(sub.id));
      return [...directFiles, ...subFiles];
    };

    selectedItemIds.forEach(id => {
      const folder = classeur3DFolders.find(f => f.id === id);
      if (folder) {
        const folderFiles = getFolderFilesRecursive(folder.id);
        folderFiles.forEach(f => {
          filesToShare.push({
            id: f.id,
            name: f.name,
            size: f.sizeBytes || 0,
            type: f.extension || f.category || 'file',
            url: f.url || f.previewUrl
          });
        });
      } else {
        const item = list.find(f => f.id === id) ||
          (opened3DFolder ? (folderFilesMap[opened3DFolder.id] || []).find(f => f.id === id) : null) ||
          documentsList.find(f => f.id === id) ||
          imagesList.find(f => f.id === id) ||
          videosList.find(f => f.id === id) ||
          audioList.find(f => f.id === id) ||
          downloadedItems.find(f => f.id === id) ||
          Object.values(folderFilesMap).flat().find(f => f.id === id);
        if (item) {
          filesToShare.push({
            id: item.id,
            name: item.name,
            size: item.sizeBytes || 0,
            type: item.extension || item.category || 'file',
            url: item.url || item.previewUrl
          });
        }
      }
    });

    if (onOpenCreateShareLink && filesToShare.length > 0) {
      onOpenCreateShareLink(filesToShare);
      showToast(`${filesToShare.length} fichier(s) prêt(s) pour la création du lien de partage !`);
    } else {
      const url = `${window.location.origin}/share?ids=${selectedItemIds.join(',')}`;
      try {
        navigator.clipboard?.writeText(url);
        showToast(`${selectedItemIds.length} élément(s) : lien copié dans le presse-papiers !`);
      } catch {
        showToast(`${selectedItemIds.length} élément(s) : lien créé !`);
      }
    }

    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedItemIds([]);
  };

  // SÉLECTION D'UN ÉLÉMENT : DÉCLENCHE LA DIVISION EN DEUX (SPLIT SCREEN)
  const handleSelectFile = (file: FileItem) => {
    setSplitSelectedFile(file);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);

    const isNotepad = Boolean(file.isNotepad || file.extension === 'txt' || file.name.toLowerCase().endsWith('.txt'));
    const isAudio = Boolean(file.category === 'audio' || file.isAudio || Boolean(file.audioUrl) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name));
    const isVideo = Boolean(file.category === 'videos' || file.isVideo || Boolean(file.videoUrl) || /\.(mp4|webm|mkv|mov|avi|flv)$/i.test(file.name));

    // URL de lecture : préserver le blob local s'il existe, sinon URL worker
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const permanentWorkerUrl = `${baseUrl}/api/cloud/stream/${file.id}`;
    if (!file.url) {
      file.url = permanentWorkerUrl;
    }
    if (!file.videoUrl) {
      file.videoUrl = file.url;
    }

    if (isNotepad) {
      setNoteTextContent(file.content || '');
      setNoteTitleContent(file.noteTitle || '');
      setIsNoteSavedIndicator(true);
    }

    // Si audio, démarrer l'écouteur et ouvrir le lecteur mobile si sur téléphone
    if (isAudio) {
      setIsAudioPlaying(true);
      setAudioCurrentTime(0);
      setAudioDuration(file.durationSec || 219);
      setIsMobilePlayerOpen(true);
    } else {
      setIsAudioPlaying(false);
    }

    // Si vidéo, réinitialiser
    if (isVideo) {
      setIsVideoPlaying(true);
      setVideoCurrentTime(0);
    } else {
      setIsVideoPlaying(false);
    }
  };

  // Catégories StudyCloud
  const categories = [
    {
      id: 'downloads',
      name: 'Téléchargements',
      size: `${downloadedItems.length} fichier${downloadedItems.length > 1 ? 's' : ''}`,
      icon: Download,
      color: 'text-sky-400'
    },
    {
      id: 'images',
      name: 'Images',
      size: '7,5 Go',
      icon: ImageIcon,
      color: 'text-emerald-400'
    },
    {
      id: 'videos',
      name: 'Vidéos',
      size: '20 Go',
      icon: Film,
      color: 'text-purple-400'
    },
    {
      id: 'audio',
      name: 'Audio',
      size: '4,8 Go',
      icon: Music,
      color: 'text-amber-400'
    },
    {
      id: 'documents',
      name: 'Documents',
      size: '3,5 Go',
      icon: FileText,
      color: 'text-blue-400'
    },
    {
      id: 'apps',
      name: 'Applications',
      size: '12 installées',
      icon: LayoutGrid,
      color: 'text-pink-400'
    }
  ];

  // Collections StudyCloud
  const collections = [
    {
      id: 'favorites',
      name: 'Favoris',
      icon: Star,
      color: 'text-amber-400'
    },
    {
      id: 'secure-folder',
      name: 'Dossier sécurisé',
      icon: Lock,
      color: 'text-blue-400'
    },
    {
      id: 'cloud-storage',
      name: 'Espace Cloud',
      icon: Cloud,
      color: 'text-sky-400'
    },
    {
      id: 'trash',
      name: 'Corbeille',
      icon: Trash2,
      color: 'text-rose-400'
    }
  ];

  // Filtrage selon la recherche (strictement 6 éléments maximum sur l'accueil, sans fichiers supprimés)
  const displayedFiles = useMemo(() => {
    const deletedRecentIds = getDeletedRecentIds();
    const locallyDeletedIds = getLocallyDeletedFileIds();
    const trashIdSet = new Set(trashFiles.map(t => t.id));

    return cloudRecentFiles.filter(f => {
      if (deletedRecentIds.has(f.id) || (f.name && deletedRecentIds.has(f.name))) return false;
      if (locallyDeletedIds.has(f.id) || (f.name && locallyDeletedIds.has(f.name))) return false;
      if (trashIdSet.has(f.id)) return false;
      if (isMockFile(f)) return false;

      const matchQuery = searchQuery.trim() === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.source && f.source.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchQuery;
    }).slice(0, 6);
  }, [cloudRecentFiles, searchQuery, trashFiles]);

  // Ouverture d'un sous-menu indépendant
  const handleOpenSubMenu = (
    type: 'category' | 'collection' | 'classeur',
    id: string,
    name: string,
    icon: any,
    color: string
  ) => {
    setSubSearchQuery('');
    setIsViewerMaximized(false);
    setIsMobilePlayerOpen(false);

    // Par défaut pour l'Espace Cloud : sélectionner l'onglet Classeur et réinitialiser
    if (id === 'cloud-storage') {
      setCloudActiveTab('classeur');
      setSplitSelectedFile(null);
      setOpened3DFolder(null);
      setSelectedClasseurFolder(null);
    } else {
      setSplitSelectedFile(null);
      if (id === 'audio') {
        setIsAudioPlaying(false);
      }
      if (id !== 'secure-folder') {
        setIsSecureFolderUnlocked(false);
      }
      setSecurePinInput('');
      setSecurePinError(null);
    }

    setCurrentSubView({
      id: `studycloud-${type}-${id}`,
      type,
      name,
      icon,
      color
    });
  };

  // Fonction de tri universelle appliquée aux listes selon l'option sélectionnée (menu 3 traits)
  const applySorting = (list: FileItem[]): FileItem[] => {
    let result = [...list];
    if (sortOption === 'pinned') {
      result.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    } else if (sortOption === 'oldest') {
      result.reverse();
    }
    return result;
  };

  // Liste des documents pour le sous-menu Documents (Image 1)
  const filteredDocuments = useMemo(() => {
    const list = [...documentsList, ...cloudRecentFiles.filter(f => f.category === 'documents' && !documentsList.some(s => s.name === f.name))];
    const filtered = list.filter(doc => {
      return subSearchQuery.trim() === '' || doc.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [documentsList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des images pour le sous-menu Images (Image 2)
  const filteredImages = useMemo(() => {
    const list = [...imagesList, ...cloudRecentFiles.filter(f => f.category === 'images' && !imagesList.some(s => s.name === f.name))];
    const filtered = list.filter(img => {
      return subSearchQuery.trim() === '' || img.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [imagesList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des vidéos pour le sous-menu Vidéos (Image 3)
  const filteredVideos = useMemo(() => {
    const list = [...videosList, ...cloudRecentFiles.filter(f => f.category === 'videos' && !videosList.some(s => s.name === f.name))];
    const filtered = list.filter(vid => {
      return subSearchQuery.trim() === '' || vid.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [videosList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste audio pour le sous-menu Audio (Image 4)
  const filteredAudio = useMemo(() => {
    const list = [...audioList, ...cloudRecentFiles.filter(f => f.category === 'audio' && !audioList.some(s => s.name === f.name))];
    const filtered = list.filter(aud => {
      return subSearchQuery.trim() === '' || aud.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [audioList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des fichiers du dossier sécurisé (filtrés par recherche)
  const filteredSecureFiles = useMemo(() => {
    const list = secureFolderFiles.filter(item => {
      return subSearchQuery.trim() === '' || item.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(list);
  }, [secureFolderFiles, subSearchQuery, sortOption]);

  // Groupement des fichiers audio par date comme dans Image 4
  const groupedAudio = useMemo(() => {
    const groups: { [key: string]: FileItem[] } = {};
    filteredAudio.forEach(item => {
      let groupKey = item.date;
      if (item.date.includes('19 août')) groupKey = '19 août';
      else if (item.date.includes('14 août')) groupKey = 'ven. 14 août';
      else if (item.date.includes("Aujourd'hui")) groupKey = "Aujourd'hui";
      else if (item.date.includes('Hier')) groupKey = 'Hier';
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredAudio]);

  // Documents du classeur filtrés par dossier de matière et recherche
  const displayedClasseurDocuments = useMemo(() => {
    let docs = [...classeurExtraDocs, ...filteredDocuments];
    if (selectedClasseurFolder === 'folder-elec') {
      docs = docs.filter(d => d.name.toLowerCase().includes('circuits') || d.name.toLowerCase().includes('aop') || d.name.toLowerCase().includes('électronique'));
    } else if (selectedClasseurFolder === 'folder-math') {
      docs = docs.filter(d => d.name.toLowerCase().includes('math') || d.name.toLowerCase().includes('algèbre') || d.name.toLowerCase().includes('ana'));
    } else if (selectedClasseurFolder === 'folder-eco') {
      docs = docs.filter(d => d.name.toLowerCase().includes('éco') || d.name.toLowerCase().includes('gestion') || d.name.toLowerCase().includes('financ'));
    } else if (selectedClasseurFolder === 'folder-tp') {
      docs = docs.filter(d => d.name.toLowerCase().includes('tp') || d.name.toLowerCase().includes('pratique') || d.name.toLowerCase().includes('exercic'));
    }
    if (subSearchQuery.trim() !== '') {
      docs = docs.filter(d => d.name.toLowerCase().includes(subSearchQuery.toLowerCase()));
    }
    return applySorting(docs);
  }, [classeurExtraDocs, filteredDocuments, selectedClasseurFolder, subSearchQuery, sortOption]);

  // Conversion d'un DownloadedItem en FileItem pour l'affichage riche et le lecteur
  const toFileItem = (item: DownloadedItem): FileItem => ({
    id: item.id,
    name: item.name,
    category: item.category,
    source: 'Téléchargements',
    size: item.size,
    sizeBytes: item.sizeBytes || 0,
    date: item.date,
    previewUrl: item.previewUrl,
    videoUrl: item.videoUrl,
    audioUrl: item.audioUrl,
    isImage: item.isImage || item.category === 'images',
    documentCategory: item.documentCategory || 'COURS',
    extension: item.extension || 'PDF',
    isFavorite: item.isFavorite,
    isPinned: item.isPinned,
  });

  // Fichiers et dossiers favoris
  const favoriteFiles = useMemo(() => {
    const folderFiles = Object.values(folderFilesMap).flat();
    const downloadFiles = downloadedItems.map(toFileItem);
    const all = [...documentsList, ...imagesList, ...videosList, ...audioList, ...folderFiles, ...downloadFiles];
    const unique = all.filter((f, idx, arr) => arr.findIndex(x => x.id === f.id) === idx);
    const favFiles = unique.filter(f => Boolean(f.isFavorite));

    // Inclure également les dossiers 3D marqués comme favoris
    const favFolders: FileItem[] = classeur3DFolders
      .filter(f => Boolean(f.isFavorite))
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        category: 'classeur' as any,
        source: 'classeur_folder',
        originalCategory: 'classeur_folder',
        size: 'Dossier 3D',
        sizeBytes: 1024,
        date: folder.dateText,
        isFavorite: true,
        isPinned: folder.isPinned,
        isFolder: true,
      } as any));

    const combined = [...favFolders, ...favFiles];
    if (subSearchQuery.trim() !== '') {
      return applySorting(combined.filter(f => f.name.toLowerCase().includes(subSearchQuery.toLowerCase())));
    }
    return applySorting(combined);
  }, [documentsList, imagesList, videosList, audioList, folderFilesMap, downloadedItems, classeur3DFolders, subSearchQuery, sortOption]);

  // Fichiers de la corbeille
  const filteredTrashFiles = useMemo(() => {
    const filtered = trashFiles.filter(file => {
      return subSearchQuery.trim() === '' || file.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [trashFiles, subSearchQuery, sortOption]);

  // Liste des téléchargements pour le sous-menu Téléchargements (Prend tout type de fichier)
  const filteredDownloads = useMemo(() => {
    return downloadedItems.filter(item => {
      return subSearchQuery.trim() === '' || item.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
  }, [downloadedItems, subSearchQuery]);

  // Éléments de la barre horizontale de navigation Espace Cloud (Image 2 + Classeur Image 3, SANS Espace Cloud)
  const cloudNavItems = useMemo(() => [
    {
      id: 'downloads' as const,
      name: 'Téléchargements',
      subtitle: `${filteredDownloads.length} fichier${filteredDownloads.length > 1 ? 's' : ''}`,
      icon: Download,
      color: 'text-cyan-400'
    },
    {
      id: 'images' as const,
      name: 'Images',
      subtitle: '7,5 Go',
      icon: ImageIcon,
      color: 'text-emerald-400'
    },
    {
      id: 'videos' as const,
      name: 'Vidéos',
      subtitle: '20 Go',
      icon: Film,
      color: 'text-purple-400'
    },
    {
      id: 'audio' as const,
      name: 'Audio',
      subtitle: '4,8 Go',
      icon: Music,
      color: 'text-amber-400'
    },
    {
      id: 'documents' as const,
      name: 'Documents',
      subtitle: '3,5 Go',
      icon: FileText,
      color: 'text-blue-400'
    },
    {
      id: 'apps' as const,
      name: 'Applications',
      subtitle: '12 installées',
      icon: LayoutGrid,
      color: 'text-pink-400'
    },
    {
      id: 'favorites' as const,
      name: 'Favoris',
      icon: Star,
      color: 'text-amber-400'
    },
    {
      id: 'secure-folder' as const,
      name: 'Dossier sécurisé',
      icon: Lock,
      color: 'text-blue-400'
    },
    {
      id: 'trash' as const,
      name: 'Corbeille',
      icon: Trash2,
      color: 'text-rose-400'
    }
  ], [filteredDownloads]);

  // Navigation Audio (Suivant, Précédent avec support Aléatoire)
  const handleAudioNext = () => {
    const list = filteredAudio;
    if (list.length === 0) return;
    const currentIdx = list.findIndex(a => a.id === splitSelectedFile?.id);
    if (isAudioShuffle && list.length > 1) {
      let randIdx = Math.floor(Math.random() * list.length);
      while (randIdx === currentIdx && list.length > 1) {
        randIdx = Math.floor(Math.random() * list.length);
      }
      handleSelectFile(list[randIdx]);
      setIsAudioPlaying(true);
      return;
    }
    const nextIdx = (currentIdx + 1) % list.length;
    handleSelectFile(list[nextIdx]);
    setIsAudioPlaying(true);
  };

  const handleAudioPrev = () => {
    const list = filteredAudio;
    if (list.length === 0) return;
    const currentIdx = list.findIndex(a => a.id === splitSelectedFile?.id);
    if (isAudioShuffle && list.length > 1) {
      let randIdx = Math.floor(Math.random() * list.length);
      while (randIdx === currentIdx && list.length > 1) {
        randIdx = Math.floor(Math.random() * list.length);
      }
      handleSelectFile(list[randIdx]);
      setIsAudioPlaying(true);
      return;
    }
    const prevIdx = (currentIdx - 1 + list.length) % list.length;
    handleSelectFile(list[prevIdx]);
    setIsAudioPlaying(true);
  };

  // Saut de 10 secondes en avant ou en arrière (-10s / +10s)
  const handleSeekDelta = (delta: number) => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime ?? audioCurrentTime;
      const next = Math.max(0, Math.min(audioDuration, cur + delta));
      audioRef.current.currentTime = next;
      setAudioCurrentTime(Math.floor(next));
    } else {
      setAudioCurrentTime(prev => Math.max(0, Math.min(audioDuration, prev + delta)));
    }
  };

  // Bascule de la lecture en boucle
  const toggleAudioRepeat = () => {
    setIsAudioRepeat(prev => {
      const next = prev === 'off' ? 'one' : 'off';
      showToast(next === 'one' ? "Lecture en boucle activée (le son reprend seul)" : "Lecture en boucle désactivée");
      return next;
    });
  };

  // Suppression d'un son spécifique
  const handleDeleteAudio = (track: FileItem) => {
    handleGenericFileAction('delete', track, audioList);
  };

  // Gestion du mode sélection multiple pour les sons
  const toggleAudioSelection = (id: string) => {
    setSelectedAudioIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedAudio = () => {
    if (selectedAudioIds.length === 0) {
      showToast("Aucun son sélectionné");
      return;
    }
    const count = selectedAudioIds.length;
    const tracksToDelete = audioList.filter(a => selectedAudioIds.includes(a.id));
    if (tracksToDelete.length > 0) {
      setTrashFiles(prev => [...tracksToDelete, ...prev.filter(f => !selectedAudioIds.includes(f.id))]);
      tracksToDelete.forEach(track => {
        CloudStorageAPI.deleteAudio(track.id).catch(console.error);
      });
    }
    setAudioList(prev => prev.filter(a => !selectedAudioIds.includes(a.id)));
    setCloudRecentFiles(prev => prev.filter(c => !selectedAudioIds.includes(c.id)));
    selectedAudioIds.forEach(id => {
      markRecentLocallyDeleted(id);
      markFileLocallyDeleted(id);
      deleteFileBlob(id).catch(() => {});
      removeDownloadedFile(id);
    });
    if (splitSelectedFile && selectedAudioIds.includes(splitSelectedFile.id)) {
      const remaining = audioList.filter(a => !selectedAudioIds.includes(a.id));
      if (remaining.length > 0) {
        setSplitSelectedFile(remaining[0]);
        setAudioDuration(remaining[0].durationSec || 219);
        setAudioCurrentTime(0);
      } else {
        setSplitSelectedFile(null);
      }
    }
    setSelectedAudioIds([]);
    setIsAudioSelectionMode(false);
    showToast(`${count} son(s) supprimé(s)`);
  };

  const handleDownloadSelectedAudio = () => {
    if (selectedAudioIds.length === 0) {
      showToast("Aucun son sélectionné");
      return;
    }
    const count = selectedAudioIds.length;
    selectedAudioIds.forEach(id => {
      const item = audioList.find(a => a.id === id);
      if (item) handleDownloadFile(item);
    });
    showToast(`${count} son(s) en cours de téléchargement`);
    setIsAudioSelectionMode(false);
    setSelectedAudioIds([]);
  };

  const handleCreateLinkSelectedAudio = () => {
    if (selectedAudioIds.length === 0) {
      showToast("Aucun son sélectionné");
      return;
    }
    const count = selectedAudioIds.length;
    const url = `${window.location.origin}/share/audio?ids=${selectedAudioIds.join(',')}`;
    navigator.clipboard?.writeText(url);
    showToast(`${count} son(s) : lien copié dans le presse-papiers !`);
    setIsAudioSelectionMode(false);
    setSelectedAudioIds([]);
  };

  // Gestion de la sélection audio manuelle : aucun son sélectionné par défaut
  // pour permettre l'affichage de l'état d'attente avec logo mélodie et "Aucun son sélectionné"

  // Intervalle de lecture audio et synchronisation temporelle
  useEffect(() => {
    let interval: any = null;
    if (isAudioPlaying) {
      interval = setInterval(() => {
        setAudioCurrentTime(prev => {
          if (prev >= audioDuration) {
            if (isAudioRepeat === 'one') {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }
              return 0;
            }
            if (isAudioRepeat === 'all' || isAudioShuffle) {
              handleAudioNext();
              return 0;
            }
            setIsAudioPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAudioPlaying, audioDuration, isAudioRepeat, isAudioShuffle, filteredAudio, splitSelectedFile]);

  // Synchronisation de l'élément audio natif
  useEffect(() => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isAudioPlaying, splitSelectedFile]);



  // Catégorisation des téléchargements pour l'affichage selon le type d'origine
  const downloadDocs = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'documents' || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(item.extension?.toLowerCase() || '')
    ).map(toFileItem);
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadImages = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'images' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(item.extension?.toLowerCase() || '')
    ).map(toFileItem);
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadVideos = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'videos' || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(item.extension?.toLowerCase() || '')
    ).map(toFileItem);
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadAudio = useMemo(() => {
    const list = filteredDownloads.filter(item => 
      item.category === 'audio' || ['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(item.extension?.toLowerCase() || '')
    ).map(item => ({
      ...toFileItem(item),
      category: 'audio' as const,
      artist: item.artist || (item as any).author || 'Fichier Audio'
    }));
    return applySorting(list);
  }, [filteredDownloads, sortOption]);

  const downloadOthers = useMemo(() => {
    return filteredDownloads.filter(item => 
      !downloadDocs.some(d => d.id === item.id) &&
      !downloadImages.some(d => d.id === item.id) &&
      !downloadVideos.some(d => d.id === item.id) &&
      !downloadAudio.some(d => d.id === item.id)
    ).map(toFileItem);
  }, [filteredDownloads, downloadDocs, downloadImages, downloadVideos, downloadAudio]);

  // Catégorisation des fichiers de la corbeille pour un affichage identique à Téléchargements
  const trashDocs = useMemo(() => {
    const list = filteredTrashFiles.filter(item => 
      item.category === 'documents' || item.isNotepad || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(item.extension?.toLowerCase() || '') ||
      (!['images', 'videos', 'audio'].includes(item.category || '') && !['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'mp4', 'mov', 'webm', 'avi', 'mkv', 'mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(item.extension?.toLowerCase() || ''))
    );
    return applySorting(list);
  }, [filteredTrashFiles, sortOption]);

  const trashImages = useMemo(() => {
    const list = filteredTrashFiles.filter(item => 
      item.category === 'images' || item.isImage || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(item.extension?.toLowerCase() || '')
    );
    return applySorting(list);
  }, [filteredTrashFiles, sortOption]);

  const trashVideos = useMemo(() => {
    const list = filteredTrashFiles.filter(item => 
      item.category === 'videos' || !!item.videoUrl || (item as any).isVideo || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(item.extension?.toLowerCase() || '')
    );
    return applySorting(list);
  }, [filteredTrashFiles, sortOption]);

  const trashAudio = useMemo(() => {
    const list = filteredTrashFiles.filter(item => 
      item.category === 'audio' || !!item.audioUrl || (item as any).isAudio || ['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(item.extension?.toLowerCase() || '')
    ).map(item => ({
      ...item,
      category: 'audio' as const,
      artist: item.artist || (item as any).author || 'Fichier Audio'
    }));
    return applySorting(list);
  }, [filteredTrashFiles, sortOption]);

  // Liste exacte des éléments du menu / dossier actuellement ouvert
  const currentSplitList = useMemo((): FileItem[] => {
    if (opened3DFolder) {
      return folderFilesMap[opened3DFolder.id] || [];
    }
    if (currentSubView?.id === 'studycloud-category-images') return filteredImages;
    if (currentSubView?.id === 'studycloud-category-videos') return filteredVideos;
    if (currentSubView?.id === 'studycloud-category-audio') return filteredAudio;
    if (currentSubView?.id === 'studycloud-category-documents') return filteredDocuments;
    if (currentSubView?.id === 'studycloud-category-downloads') {
      return [...downloadDocs, ...downloadImages, ...downloadVideos, ...downloadAudio];
    }
    if (currentSubView?.id === 'studycloud-collection-favorites' || (isCloudView && cloudActiveTab === 'favorites')) {
      return favoriteFiles;
    }
    if (currentSubView?.id === 'studycloud-collection-trash' || (isCloudView && cloudActiveTab === 'trash')) {
      return [...trashDocs, ...trashImages, ...trashVideos, ...trashAudio];
    }
    if (isCloudView) {
      if (cloudActiveTab === 'classeur') return opened3DFolder ? (folderFilesMap[opened3DFolder.id] || []) : [];
      if (cloudActiveTab === 'documents') return filteredDocuments;
      if (cloudActiveTab === 'images') return filteredImages;
      if (cloudActiveTab === 'videos') return filteredVideos;
      if (cloudActiveTab === 'audio') return filteredAudio;
      if (cloudActiveTab === 'downloads') return [...downloadDocs, ...downloadImages, ...downloadVideos, ...downloadAudio];
      if (cloudActiveTab === 'secure-folder') return filteredSecureFiles;
      if (cloudActiveTab === 'favorites') return favoriteFiles;
      if (cloudActiveTab === 'trash') return [...trashDocs, ...trashImages, ...trashVideos, ...trashAudio];
      return displayedFiles;
    }
    return displayedFiles;
  }, [
    opened3DFolder,
    folderFilesMap,
    currentSubView,
    isCloudView,
    cloudActiveTab,
    filteredImages,
    filteredVideos,
    filteredAudio,
    filteredDocuments,
    downloadDocs,
    downloadImages,
    downloadVideos,
    downloadAudio,
    trashDocs,
    trashImages,
    trashVideos,
    trashAudio,
    filteredSecureFiles,
    favoriteFiles,
    filteredTrashFiles,
    displayedFiles
  ]);

  const currentSplitIndex = useMemo(() => {
    if (!splitSelectedFile || currentSplitList.length === 0) return -1;
    return currentSplitList.findIndex(f => f.id === splitSelectedFile.id);
  }, [splitSelectedFile, currentSplitList]);

  const canNavigatePrev = currentSplitIndex > 0;
  const canNavigateNext = currentSplitIndex >= 0 && currentSplitIndex < currentSplitList.length - 1;

  // Détection universelle du type de fichier sélectionné dans le visualiseur divisé
  const isSelectedNotepad = !!splitSelectedFile && (
    splitSelectedFile.isNotepad || 
    splitSelectedFile.extension === 'txt' || 
    splitSelectedFile.name.toLowerCase().endsWith('.txt')
  );
  const isSelectedImage = !!splitSelectedFile && (
    splitSelectedFile.category === 'images' || 
    splitSelectedFile.isImage || 
    /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.test(splitSelectedFile.name)
  );
  const isSelectedVideo = !!splitSelectedFile && (
    splitSelectedFile.category === 'videos' || 
    Boolean(splitSelectedFile.videoUrl) || 
    /\.(mp4|webm|mkv|mov|avi|flv)$/i.test(splitSelectedFile.name)
  );
  const isSelectedAudio = !!splitSelectedFile && (
    splitSelectedFile.category === 'audio' || 
    Boolean(splitSelectedFile.audioUrl) || 
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(splitSelectedFile.name)
  );
  const isSelectedDoc = !!splitSelectedFile && 
    !isSelectedNotepad && 
    !isSelectedImage && 
    !isSelectedVideo && 
    !isSelectedAudio && (
      splitSelectedFile.category === 'documents' || 
      /\.(pdf|docx?|pptx?|xlsx?|odt|rtf|txt|csv|md)$/i.test(splitSelectedFile.name)
    );
  const isSelectedDocPdf = !!splitSelectedFile && isSelectedDoc && (
    splitSelectedFile.extension === 'pdf' || 
    splitSelectedFile.name.toLowerCase().endsWith('.pdf') || 
    (splitSelectedFile.url && splitSelectedFile.url.toLowerCase().includes('.pdf')) ||
    Boolean(splitSelectedFile.type?.includes('pdf'))
  );

  useEffect(() => {
    let isCurrent = true;
    if (splitSelectedFile?.id && isSelectedDocPdf) {
      if (splitSelectedFile.url && (splitSelectedFile.url.startsWith('blob:') || splitSelectedFile.url.startsWith('http') || splitSelectedFile.url.startsWith('data:'))) {
        setSplitResolvedPdfUrl(splitSelectedFile.url);
      }
      getFileBlobUrl(splitSelectedFile.id).then(blobUrl => {
        if (isCurrent && blobUrl) {
          setSplitResolvedPdfUrl(blobUrl);
        }
      }).catch(() => {});
    } else {
      setSplitResolvedPdfUrl('');
    }
    return () => { isCurrent = false; };
  }, [splitSelectedFile?.id, isSelectedDocPdf]);

  // NAVIGATION PRÉCÉDENT / SUIVANT DANS LA VUE DIVISÉE (STRICTEMENT DANS LE MENU ACTUEL)
  const handleNavigateSplit = (direction: 'prev' | 'next') => {
    if (!splitSelectedFile || currentSplitList.length === 0) return;
    const nextFile = direction === 'prev' 
      ? (canNavigatePrev ? currentSplitList[currentSplitIndex - 1] : null)
      : (canNavigateNext ? currentSplitList[currentSplitIndex + 1] : null);
    if (!nextFile) return;

    setSplitSelectedFile(nextFile);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);

    // URL de lecture : préserver le blob local s'il existe, sinon URL worker
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const permanentWorkerUrl = `${baseUrl}/api/cloud/stream/${nextFile.id}`;
    if (!nextFile.url) {
      nextFile.url = permanentWorkerUrl;
    }
    if (!nextFile.videoUrl) {
      nextFile.videoUrl = nextFile.url;
    }

    const isNotepad = Boolean(nextFile.isNotepad || nextFile.extension === 'txt' || nextFile.name.toLowerCase().endsWith('.txt'));
    const isAudio = Boolean(nextFile.category === 'audio' || nextFile.isAudio || Boolean(nextFile.audioUrl) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(nextFile.name));
    const isVideo = Boolean(nextFile.category === 'videos' || nextFile.isVideo || Boolean(nextFile.videoUrl) || /\.(mp4|webm|mkv|mov|avi|flv)$/i.test(nextFile.name));

    if (isNotepad) {
      setNoteTextContent(nextFile.content || '');
      setNoteTitleContent(nextFile.noteTitle || '');
      setIsNoteSavedIndicator(true);
    }

    if (isAudio) {
      setIsAudioPlaying(true);
      setAudioCurrentTime(0);
      setAudioDuration(nextFile.durationSec || 219);
    } else {
      setIsAudioPlaying(false);
    }

    if (isVideo) {
      setIsVideoPlaying(true);
      setVideoCurrentTime(0);
    } else {
      setIsVideoPlaying(false);
    }
  };

  // Récupération des styles de carte document en fonction de l'extension
  const getDocumentTheme = (ext: string = 'PDF') => {
    const upper = ext.toUpperCase();
    if (upper === 'PDF') {
      return {
        bg: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
        border: 'border-2 border-red-500 hover:border-red-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#450a0a]',
        badge: 'bg-white text-red-700 border-white',
        typeBadge: 'PDF'
      };
    } else if (['DOC', 'DOCX'].includes(upper)) {
      return {
        bg: 'linear-gradient(180deg, #2563eb 0%, #1e40af 100%)',
        border: 'border-2 border-blue-500 hover:border-blue-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#172554]',
        badge: 'bg-white text-blue-700 border-white',
        typeBadge: 'DOCX'
      };
    } else if (['XLS', 'XLSX'].includes(upper)) {
      return {
        bg: 'linear-gradient(180deg, #0d9488 0%, #115e59 100%)',
        border: 'border-2 border-emerald-500 hover:border-emerald-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#022c22]',
        badge: 'bg-white text-emerald-700 border-white',
        typeBadge: 'XLSX'
      };
    } else if (['PPT', 'PPTX'].includes(upper)) {
      return {
        bg: 'linear-gradient(180deg, #ea580c 0%, #9a3412 100%)',
        border: 'border-2 border-orange-500 hover:border-orange-400',
        shadow: 'shadow-[2.5px_2.5px_0px_0px_#431407]',
        badge: 'bg-white text-orange-700 border-white',
        typeBadge: 'PPTX'
      };
    }
    return {
      bg: 'linear-gradient(180deg, #26272b 0%, #1c1c1f 100%)',
      border: 'border-2 border-stone-700 hover:border-stone-500',
      shadow: 'shadow-[2.5px_2.5px_0px_0px_#1c1917]',
      badge: 'bg-white text-stone-900 border-white',
      typeBadge: upper
    };
  };

  // Formatter temps audio/vidéo (ex: 02:45)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Ouvrir l'espace d'étude pour le menu actif (ex: Musique, Téléchargements, Documents, Images, etc.)
  const handleOpenStudySpaceForCurrentMenu = (withSelectedFile: boolean) => {
    let menuName = currentSubView ? currentSubView.name : 'Mes fichiers';

    // Si un fichier spécifique est sélectionné, sa catégorie dicte la galerie correspondante
    if (withSelectedFile && splitSelectedFile) {
      if (splitSelectedFile.category === 'images' || splitSelectedFile.isImage) {
        menuName = 'Images';
      } else if (splitSelectedFile.category === 'videos' || splitSelectedFile.videoUrl) {
        menuName = 'Vidéos';
      } else if (splitSelectedFile.category === 'audio' || splitSelectedFile.audioUrl) {
        menuName = 'Musique';
      } else if (splitSelectedFile.category === 'documents') {
        menuName = 'Documents';
      }
    } else if (currentSubView?.id === 'studycloud-category-audio' || menuName.toLowerCase() === 'audio') {
      menuName = 'Musique';
    }

    let sourceList: any[] = [];
    const norm = menuName.toLowerCase();
    if (norm.includes('image')) {
      sourceList = filteredImages;
    } else if (norm.includes('vid')) {
      sourceList = filteredVideos;
    } else if (norm.includes('musiq') || norm.includes('audio') || norm.includes('son')) {
      sourceList = filteredAudio;
    } else if (norm.includes('doc')) {
      sourceList = filteredDocuments;
    } else if (currentSubView?.id === 'studycloud-category-downloads') {
      sourceList = [...downloadDocs, ...downloadImages, ...downloadVideos, ...downloadAudio, ...downloadOthers];
    } else if (currentSubView?.id === 'studycloud-collection-secure-folder') {
      sourceList = filteredSecureFiles;
    } else {
      sourceList = cloudRecentFiles;
    }

    let convertedFiles = sourceList.map(f => {
      const ext = f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      return {
        id: f.id,
        name: f.name,
        size: f.sizeBytes || 0,
        type: f.isImage ? 'image/jpeg' : (f.videoUrl ? 'video/mp4' : (f.audioUrl ? 'audio/mpeg' : 'application/pdf')),
        extension: ext,
        url: f.previewUrl || f.audioUrl || f.videoUrl || (f as any).url || '',
        previewUrl: f.previewUrl,
        audioUrl: f.audioUrl,
        videoUrl: f.videoUrl,
        isImage: !!f.isImage,
        category: f.category,
        folderName: menuName,
        matiere: menuName,
        source: f.source || menuName
      };
    });

    let selectedFileForStudy: any = null;
    if (withSelectedFile && splitSelectedFile) {
      const ext = splitSelectedFile.extension || (splitSelectedFile.name && splitSelectedFile.name.includes('.') ? splitSelectedFile.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
      selectedFileForStudy = {
        id: splitSelectedFile.id,
        name: splitSelectedFile.name,
        size: splitSelectedFile.sizeBytes || 0,
        type: splitSelectedFile.isImage ? 'image/jpeg' : (splitSelectedFile.videoUrl ? 'video/mp4' : (splitSelectedFile.audioUrl ? 'audio/mpeg' : 'application/pdf')),
        extension: ext,
        url: splitSelectedFile.previewUrl || splitSelectedFile.audioUrl || splitSelectedFile.videoUrl || (splitSelectedFile as any).url || '',
        previewUrl: splitSelectedFile.previewUrl,
        audioUrl: splitSelectedFile.audioUrl,
        videoUrl: splitSelectedFile.videoUrl,
        isImage: !!splitSelectedFile.isImage,
        category: splitSelectedFile.category,
        folderName: menuName,
        matiere: menuName,
        source: splitSelectedFile.source || menuName
      };

      // S'assurer que le fichier sélectionné est bien inclus dans la liste de tous les fichiers
      const existingIdx = convertedFiles.findIndex(f => f.id === selectedFileForStudy.id || f.name === selectedFileForStudy.name);
      if (existingIdx >= 0) {
        convertedFiles[existingIdx] = selectedFileForStudy;
      } else {
        convertedFiles = [selectedFileForStudy, ...convertedFiles];
      }
    }

    try {
      localStorage.setItem(`unifolder_matiere_files_${menuName}`, JSON.stringify(convertedFiles));
    } catch (e) {}

    const folderPayload = {
      id: `menu-${menuName}`,
      title: menuName,
      description: '',
      category: menuName,
      author: 'StudyCloud',
      school: '',
      country: "Côte d'Ivoire",
      createdAt: new Date().toISOString(),
      files: convertedFiles,
      totalSize: 0,
      downloadsCount: 0,
      isPublic: false
    };

    const wasFullscreen = isFullscreen || isViewerMaximized;
    setIsFullscreen(false);
    setIsViewerMaximized(false);

    if (onOpenStudySpace) {
      onOpenStudySpace(selectedFileForStudy, menuName, convertedFiles, wasFullscreen);
    }

    window.dispatchEvent(new CustomEvent('studycloud_open_study_space', {
      detail: {
        file: selectedFileForStudy,
        folderName: menuName,
        files: convertedFiles,
        folder: folderPayload,
        isFullscreen: wasFullscreen
      }
    }));
  };

  // =========================================================================
  // BANDEAU DE SÉLECTION MULTIPLE UNIVERSEL (PROPOSITIONS D'ACTIONS)
  // Apparaît dès que l'on clique sur "Cocher" ou "Tout cocher" dans le menu à 3 traits
  // Propose : Supprimer / Tout supprimer, Télécharger / Tout télécharger, Créer un lien, Annuler
  // =========================================================================
  const renderSelectionBanner = (currentCategoryList: FileItem[]) => {
    if (!isSelectionMode) return null;
    const isSingle = selectedItemIds.length === 1;
    const isAllSelected = currentCategoryList.length > 0 && selectedItemIds.length >= currentCategoryList.length;
    const isTrashView = currentSubView?.id === 'studycloud-collection-trash' || (isCloudView && cloudActiveTab === 'trash');

    return (
      <div className="w-full p-2.5 sm:p-3 rounded-2xl bg-amber-500/10 dark:bg-slate-900 border border-amber-400/40 dark:border-amber-500/30 shadow-md flex items-center justify-between gap-2 flex-wrap animate-in fade-in slide-in-from-top-2 duration-150 my-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isAllSelected) {
                setSelectedItemIds([]);
              } else {
                setSelectedItemIds(currentCategoryList.map(f => f.id));
              }
            }}
            className="p-1 text-amber-500 hover:text-amber-600 cursor-pointer flex items-center gap-1.5"
            title={isAllSelected ? "Tout décocher" : "Tout cocher"}
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
            ) : (
              <Square className="w-5 h-5 text-stone-400 dark:text-slate-400" />
            )}
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
              {isAllSelected
                ? `Tous les ${currentCategoryList.length} éléments cochés`
                : `${selectedItemIds.length} élément${selectedItemIds.length > 1 ? 's' : ''} coché${selectedItemIds.length > 1 ? 's' : ''}`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {isTrashView ? (
            <>
              {/* Restaurer ou Tout restaurer */}
              <button
                type="button"
                onClick={handleRestoreSelectedFromTrash}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title={isSingle ? "Restaurer" : "Tout restaurer"}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isSingle ? 'Restaurer' : 'Tout restaurer'}</span>
              </button>

              {/* Supprimer définitivement */}
              <button
                type="button"
                onClick={handlePermanentDeleteSelectedFromTrash}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title={isSingle ? "Supprimer définitivement" : "Tout supprimer définitivement"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSingle ? 'Supprimer définitivement' : 'Tout supprimer définitivement'}</span>
              </button>
            </>
          ) : (
            <>
              {/* Supprimer ou Tout supprimer */}
              <button
                type="button"
                onClick={() => handleDeleteSelected(currentCategoryList)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title={isSingle ? "Supprimer" : "Tout supprimer"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSingle ? 'Supprimer' : 'Tout supprimer'}</span>
              </button>

              {/* Tout télécharger ou Télécharger */}
              <button
                type="button"
                onClick={() => handleDownloadSelected(currentCategoryList)}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title={isSingle ? "Télécharger" : "Tout télécharger"}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isSingle ? 'Télécharger' : 'Tout télécharger'}</span>
              </button>

              {/* Créer un lien */}
              <button
                type="button"
                onClick={() => handleCreateLinkSelected(currentCategoryList)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Créer un lien"
              >
                <Link className="w-3.5 h-3.5" />
                <span>Créer un lien</span>
              </button>

              {/* Déplacer / Créer une copie */}
              <button
                type="button"
                onClick={() => {
                  const selectedFiles = currentCategoryList.filter(f => selectedItemIds.includes(f.id));
                  if (selectedFiles.length > 0) {
                    setItemsToTransfer(selectedFiles);
                    setTransferSelectedFolderIds([]);
                    setTransferNavFolderId(null);
                    setTransferSearchQuery('');
                    setIsTransferPromptOpen(true);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Déplacer ou Créer une copie"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>Déplacer / Créer une copie</span>
              </button>

              {/* Si dans dossier sécurisé : Déverrouiller / Tout déverrouiller. Sinon : Verrouiller / Tout verrouiller */}
              {(currentSubView?.id === 'studycloud-collection-secure-folder' || (isCloudView && cloudActiveTab === 'secure-folder')) ? (
                <button
                  type="button"
                  onClick={handleUnlockSelected}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  title={isSingle ? "Déverrouiller" : "Tout déverrouiller"}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isSingle ? 'Déverrouiller' : 'Tout déverrouiller'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLockSelected(currentCategoryList)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  title={isSingle ? "Verrouiller" : "Tout verrouiller"}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSingle ? 'Verrouiller' : 'Tout verrouiller'}</span>
                </button>
              )}
            </>
          )}

          {/* Annuler la sélection */}
          <button
            type="button"
            onClick={handleCancelSelection}
            className="p-1.5 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 text-stone-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Fermer le mode sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // MENU UNIVERSEL À 3 TRAITS (MENU DÉROULANT COMPLET POUR TOUS LES FICHIERS)
  // Options : Cocher, Tout cocher, Télécharger, Supprimer, Partager, Créer un lien,
  // Transporter vers le dossier sécurisé, Le déplacer, Dupliquer, Favoris, Épingler, Modifier le nom
  // =========================================================================
  const renderFileOptionsMenu = (file: FileItem, currentCategoryList: FileItem[], align: 'left' | 'right' = 'left') => {
    const isMenuOpen = activeMenuFileId === file.id || docMenuOpenId === file.id || audioMenuSongId === file.id;
    if (!isMenuOpen) return null;

    const isTrash = currentSubView?.id === 'studycloud-collection-trash' || 
                    (isCloudView && cloudActiveTab === 'trash') || 
                    file.isTrash || 
                    trashFiles.some(t => t.id === file.id);

    if (isTrash) {
      const isChecked = selectedItemIds.includes(file.id);
      const isAllChecked = filteredTrashFiles.length > 0 && selectedItemIds.length >= filteredTrashFiles.length;
      const hasMultipleSelected = selectedItemIds.length > 1;

      return (
        <div 
          className={`studycloud-file-menu-panel absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-[100] w-64 bg-[#0B101D] border-2 border-rose-500/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(244,63,94,0.35)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête du menu corbeille flottant */}
          <div className="px-3.5 py-2.5 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] font-semibold text-rose-300">
                {file.size} • <span className="uppercase font-bold tracking-wider text-rose-400">Corbeille</span>
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(null);
                setDocMenuOpenId(null);
                setAudioMenuSongId(null);
              }}
              className="p-1 rounded-md text-rose-300 hover:text-white hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Options : Cocher, Tout cocher, Restaurer, Supprimer définitivement */}
          <div className="py-1 divide-y divide-white/5">
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(true);
                  toggleItemSelection(file.id);
                  setActiveMenuFileId(null);
                  setDocMenuOpenId(null);
                  setAudioMenuSongId(null);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                {isChecked ? <Square className="w-3.5 h-3.5 shrink-0" /> : <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
                <span>{isChecked ? 'Décocher' : 'Cocher'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAllChecked) {
                    setSelectedItemIds([]);
                    setIsSelectionMode(false);
                  } else {
                    setIsSelectionMode(true);
                    setSelectedItemIds(filteredTrashFiles.map(f => f.id));
                  }
                  setActiveMenuFileId(null);
                  setDocMenuOpenId(null);
                  setAudioMenuSongId(null);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                {isAllChecked ? <Square className="w-3.5 h-3.5 shrink-0" /> : <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
                <span>{isAllChecked ? 'Tout décocher' : 'Tout cocher'}</span>
              </button>
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  if (isAllChecked || hasMultipleSelected) {
                    handleRestoreSelectedFromTrash();
                  } else {
                    handleRestoreFromTrash(file);
                  }
                  setActiveMenuFileId(null);
                  setDocMenuOpenId(null);
                  setAudioMenuSongId(null);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
                title="Restaurer à son emplacement d'origine"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>{isAllChecked ? 'Tout restaurer' : (hasMultipleSelected && isChecked ? 'Tout restaurer' : 'Restaurer')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAllChecked || hasMultipleSelected) {
                    handlePermanentDeleteSelectedFromTrash();
                  } else {
                    handlePermanentDelete(file.id);
                  }
                  setActiveMenuFileId(null);
                  setDocMenuOpenId(null);
                  setAudioMenuSongId(null);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
                title="Supprimer définitivement"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isAllChecked ? 'Tout supprimer' : (hasMultipleSelected && isChecked ? 'Tout supprimer' : 'Supprimer définitivement')}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        className={`studycloud-file-menu-panel absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-[100] w-64 bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(59,130,246,0.25)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
          {/* En-tête de menu dédié avec nom du fichier et bouton fermeture */}
          <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] font-semibold text-slate-400">
                {file.size} • <span className="uppercase text-amber-400">{file.extension || file.category}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(null);
                setDocMenuOpenId(null);
                setAudioMenuSongId(null);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Liste déroulante des options avec défilement fluide garanti */}
          <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
            {/* Section 1 : Sélection (Cocher, Tout cocher, Télécharger) */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleGenericFileAction('check', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Cocher</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('check_all', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Tout cocher</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('download', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Télécharger</span>
              </button>
            </div>

            {/* Section 2 : Actions principales de gestion */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleGenericFileAction('delete', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Supprimer le fichier</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('share', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span>Partager</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('create_link', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Link className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                <span>Créer un lien</span>
              </button>
              {(file.isSecure || currentSubView?.id === 'studycloud-collection-secure-folder' || (isCloudView && cloudActiveTab === 'secure-folder')) ? (
                <button
                  type="button"
                  onClick={() => handleGenericFileAction('unlock_file', file, currentCategoryList)}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
                  title="Déverrouiller le fichier et le renvoyer à son emplacement d'origine"
                >
                  <Unlock className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Déverrouiller</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGenericFileAction('lock_file', file, currentCategoryList)}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer text-left"
                  title="Verrouiller ce fichier dans le dossier sécurisé"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Verrouiller</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleGenericFileAction('move', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <FolderInput className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Le déplacer / Créer une copie</span>
              </button>
            </div>

            {/* Section 3 : Organisation & Édition */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleGenericFileAction('duplicate', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Copy className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>Dupliquer</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('favorite', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Star className={`w-3.5 h-3.5 shrink-0 ${file.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-400'}`} />
                <span>{file.isFavorite ? 'Retirer des favoris' : 'Ajouter au favoris'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('pin', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Pin className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                <span>Épinglez</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenericFileAction('rename', file, currentCategoryList)}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
              >
                <Pencil className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                <span>Modifier le nom</span>
              </button>

              {/* Bouton Définir comme photo de profil (et fond du tableau de bord Pages 1 et 2) pour les images */}
              {(file.category === 'images' || file.isImage || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name)) && (
                <button
                  type="button"
                  onClick={() => handleGenericFileAction('set_as_profile_and_wallpaper', file, currentCategoryList)}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left border-t border-white/10 mt-1 pt-1.5"
                  title="Définir comme photo de profil et fond d'écran du tableau de bord pour la page 1 et 2"
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Définir comme photo de profil</span>
                </button>
              )}
            </div>
          </div>
        </div>
    );
  };

  // =========================================================================
  // MENU 3 TRAITS DÉDIÉ POUR LES ÉLÉMENTS DE LA CORBEILLE
  // Options requises : Cocher, Tout cocher, Restaurer / Tout restaurer, Supprimer définitivement / Tout supprimer
  // =========================================================================
  const renderTrashOptionsMenu = (file: FileItem, align: 'left' | 'right' = 'left') => {
    return renderFileOptionsMenu(file, filteredTrashFiles, align);
  };

  // =========================================================================
  // ACTIONS DU MENU 3 TRAITS POUR LES DOSSIERS 3D DU CLASSEUR
  // =========================================================================
  const handleFolderAction = (action: string, folder: ClasseurCreatedFolder) => {
    setActiveFolderMenuId(null);

    switch (action) {
      case 'check':
        setIsSelectionMode(true);
        setSelectedItemIds([folder.id]);
        showToast(`Dossier "${folder.name}" coché`);
        break;

      case 'check_all': {
        setIsSelectionMode(true);
        if (opened3DFolder) {
          const subFolders = classeur3DFolders.filter(f => f.parentId === opened3DFolder.id);
          const folderFiles = folderFilesMap[opened3DFolder.id] || [];
          const allIds = [...subFolders.map(sf => sf.id), ...folderFiles.map(f => f.id)];
          setSelectedItemIds(allIds);
          showToast(`Tous les ${allIds.length} éléments cochés`);
        } else {
          const rootFolders = classeur3DFolders.filter(f => !f.parentId);
          const allIds = rootFolders.map(f => f.id);
          setSelectedItemIds(allIds);
          showToast(`Tous les ${allIds.length} dossiers cochés`);
        }
        break;
      }

      case 'download': {
        const getFolderFilesRecursive = (folderId: string): FileItem[] => {
          const directFiles = folderFilesMap[folderId] || [];
          const subFolders = classeur3DFolders.filter(f => f.parentId === folderId);
          const subFiles = subFolders.flatMap(sub => getFolderFilesRecursive(sub.id));
          return [...directFiles, ...subFiles];
        };
        const filesToDownload = getFolderFilesRecursive(folder.id);
        if (filesToDownload.length === 0) {
          showToast(`Le dossier "${folder.name}" est vide.`);
        } else {
          showToast(`Téléchargement de ${filesToDownload.length} fichier(s) du dossier "${folder.name}"...`);
          filesToDownload.forEach((file, index) => {
            setTimeout(() => {
              downloadFileDirectly(file);
            }, index * 200);
          });
        }
        break;
      }

      case 'delete':
        handleDeleteCreatedFolder(folder.id);
        if (opened3DFolder?.id === folder.id) {
          setOpened3DFolder(null);
        }
        setFolderFilesMap(prev => {
          const next = { ...prev };
          delete next[folder.id];
          return next;
        });
        showToast(`Dossier "${folder.name}" supprimé !`);
        break;

      case 'share': {
        if (navigator.share) {
          navigator.share({
            title: folder.name,
            text: `Dossier StudyCloud : ${folder.name}`,
            url: window.location.href,
          }).catch(() => {});
        } else {
          try {
            navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#classeur-${folder.id}`);
            showToast('Lien du dossier copié dans le presse-papiers !');
          } catch {
            showToast(`Partage du dossier "${folder.name}"`);
          }
        }
        break;
      }

      case 'create_link': {
        const getFolderFilesRecursive = (folderId: string): FileItem[] => {
          const directFiles = folderFilesMap[folderId] || [];
          const subFolders = classeur3DFolders.filter(f => f.parentId === folderId);
          const subFiles = subFolders.flatMap(sub => getFolderFilesRecursive(sub.id));
          return [...directFiles, ...subFiles];
        };
        const folderFiles = getFolderFilesRecursive(folder.id);
        const filesToShare = folderFiles.map(f => ({
          id: f.id,
          name: f.name,
          size: f.sizeBytes || 0,
          type: f.extension || f.category || 'file',
          url: f.url || f.previewUrl
        }));

        if (onOpenCreateShareLink && filesToShare.length > 0) {
          onOpenCreateShareLink(filesToShare);
          showToast(`${filesToShare.length} fichier(s) du dossier "${folder.name}" prêts pour le lien de partage !`);
        } else {
          const link = `${window.location.origin}${window.location.pathname}#classeur-${folder.id}`;
          try {
            navigator.clipboard?.writeText(link);
            showToast('Lien du dossier copié dans le presse-papiers !');
          } catch {
            showToast(`Lien créé pour "${folder.name}"`);
          }
        }
        break;
      }

      case 'lock_folder': {
        const securedFile: FileItem = {
          id: folder.id,
          name: folder.name,
          category: 'documents',
          source: 'Dossier Sécurisé',
          originalCategory: 'classeur_folder',
          size: '1 dossier 3D',
          sizeBytes: 2048,
          date: folder.dateText,
          isSecure: true,
          metadata: folder,
        };
        setSecureFolderFiles(prev => [securedFile, ...prev]);
        setClasseur3DFolders(prev => prev.filter(f => f.id !== folder.id));
        setClasseurFolders(prev => prev.filter(f => f.name !== folder.name));
        if (opened3DFolder?.id === folder.id) {
          setOpened3DFolder(null);
        }
        CloudStorageAPI.moveToSecureFolder(securedFile, 'classeur_folder').catch(console.error);
        showToast(`Dossier "${folder.name}" verrouillé dans le dossier sécurisé !`);
        break;
      }

      case 'duplicate': {
        const existingNames = classeur3DFolders.map(f => f.name);
        const newName = computeDuplicateName(folder.name, existingNames);
        const duplicatedFolder: ClasseurCreatedFolder = {
          ...folder,
          id: `c3d-dup-${Date.now()}`,
          name: newName,
          createdAt: Date.now(),
          isPinned: false
        };
        setClasseur3DFolders(prev => [duplicatedFolder, ...prev]);
        // Le dossier dupliqué est créé complètement vide (aucun contenu copié selon la demande)
        setFolderFilesMap(prev => ({
          ...prev,
          [duplicatedFolder.id]: []
        }));
        // Sauvegarde de la copie du dossier dans Cloudflare D1
        CloudStorageAPI.duplicateItem(folder.id, 'classeur_folder', undefined, newName).catch(console.error);
        showToast(`Dossier dupliqué : "${duplicatedFolder.name}" !`);
        break;
      }

      case 'favorite': {
        const newFav = !folder.isFavorite;
        setClasseur3DFolders(prev =>
          prev.map(f => f.id === folder.id ? { ...f, isFavorite: newFav } : f)
        );
        if (newFav) {
          CloudStorageAPI.addFavorite(folder.id, 'classeur_folder', folder.name).catch(console.error);
          showToast('Ajouté aux favoris !');
        } else {
          CloudStorageAPI.removeFavorite(folder.id, 'classeur_folder').catch(console.error);
          showToast('Retiré des favoris');
        }
        break;
      }

      case 'pin': {
        const newPin = !folder.isPinned;
        setClasseur3DFolders(prev => {
          const updated = prev.map(f => f.id === folder.id ? { ...f, isPinned: newPin } : f);
          if (newPin) {
            const item = updated.find(f => f.id === folder.id);
            if (item) {
              const rest = updated.filter(f => f.id !== folder.id);
              return [item, ...rest];
            }
          }
          return updated;
        });
        if (newPin) {
          CloudStorageAPI.addPinned(folder.id, 'classeur_folder').catch(console.error);
          showToast(`"${folder.name}" épinglé au début !`);
        } else {
          CloudStorageAPI.removePinned(folder.id, 'classeur_folder').catch(console.error);
          showToast(`"${folder.name}" désépinglé`);
        }
        break;
      }

      case 'rename': {
        const newName = window.prompt('Modifier le nom du dossier :', folder.name);
        if (newName && newName.trim() && newName.trim() !== folder.name) {
          const trimmed = newName.trim();
          setClasseur3DFolders(prev =>
            prev.map(f => f.id === folder.id ? { ...f, name: trimmed } : f)
          );
          setClasseurFolders(prev =>
            prev.map(f => f.name === folder.name ? { ...f, name: trimmed } : f)
          );
          if (opened3DFolder?.id === folder.id) {
            setOpened3DFolder(prev => prev ? { ...prev, name: trimmed } : null);
          }
          // Mise à jour directe dans la table classeur_folders D1
          CloudStorageAPI.renameItem(folder.id, trimmed, 'classeur_folder').catch(console.error);
          showToast(`Dossier renommé en "${trimmed}" !`);
        }
        break;
      }

      default:
        break;
    }
  };

  // =========================================================================
  // VUE DU CONTENU D'UN DOSSIER 3D DU CLASSEUR (MENU PROPRE À CHAQUE DOSSIER)
  // Conforme à l'en-tête de l'écran 1 (Bouton Retour + Importer, Nom au milieu collé à l'en-tête sur la ligne horizontale)
  // =========================================================================
  const renderOpened3DFolderView = (folder: ClasseurCreatedFolder) => {
    const subFolders = classeur3DFolders.filter(f => 
      f.parentId === folder.id && 
      (!subSearchQuery.trim() || f.name.toLowerCase().includes(subSearchQuery.toLowerCase().trim()))
    );
    const files = (folderFilesMap[folder.id] || []).filter(f =>
      !subSearchQuery.trim() || f.name.toLowerCase().includes(subSearchQuery.toLowerCase().trim())
    );

    const sortedSubFolders = (() => {
      let list = [...subFolders];
      if (sortOption === 'pinned') {
        list.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return 0;
        });
      } else if (sortOption === 'oldest') {
        list.reverse();
      }
      return list;
    })();
    const sortedFiles = applySorting(files);

    const totalItems = subFolders.length + files.length;
    const allOpenedFolderItems: FileItem[] = [
      ...sortedSubFolders.map(sf => ({
        id: sf.id,
        name: sf.name,
        category: 'classeur',
        size: 'Dossier 3D',
        sizeBytes: 1024,
        date: sf.dateText,
      } as FileItem)),
      ...sortedFiles
    ];

    return (
      <div 
        className="w-full relative pb-32 animate-in fade-in duration-200"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOverFolder(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDraggingOverFolder(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOverFolder(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleDirectFilesImportToFolder(e.dataTransfer.files, folder.id);
          }
        }}
      >
        {/* Overlay Drag & Drop pour déposer des fichiers directement dans ce dossier */}
        {isDraggingOverFolder && (
          <div className="fixed inset-0 z-50 bg-[#2D4A3E]/85 backdrop-blur-sm border-4 border-dashed border-emerald-400 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
            <div className="w-20 h-20 rounded-3xl bg-white/20 border-2 border-white text-white flex items-center justify-center mb-4 shadow-xl animate-bounce">
              <Upload className="w-10 h-10 stroke-[2.5]" />
            </div>
            <h2 className="text-2xl font-black text-white drop-shadow-md">Déposez vos fichiers ici</h2>
            <p className="text-sm font-bold text-emerald-100 mt-1">Ils seront importés et enregistrés dans « {folder.name} »</p>
          </div>
        )}

        {/* Input d'upload caché pour importer via le bouton de l'en-tête ou de la vue */}
        <input 
          type="file" 
          ref={folderFileInputRef} 
          className="hidden" 
          multiple 
          onChange={(e) => handleFolderFileUpload(e, folder.id)} 
        />

        {/* Barre de navigation et fil d'Ariane du dossier dans l'Espace Cloud */}
        {isCloudView && (
          <div className="w-full flex items-center justify-between gap-2 sm:gap-4 py-2 px-1 mb-4 border-b border-stone-300/60 dark:border-white/10 animate-in fade-in duration-150">
            {/* GAUCHE : Bouton Retour et Bouton Importer */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (folder.parentId) {
                    const parent = classeur3DFolders.find(f => f.id === folder.parentId);
                    setOpened3DFolder(parent || null);
                  } else {
                    setOpened3DFolder(null);
                  }
                  setSplitSelectedFile(null);
                  setSubSearchQuery('');
                }}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-xs transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                title={folder.parentId ? "Retour au dossier parent" : "Retour aux dossiers du classeur"}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
                <span>Retour</span>
              </button>

              <button
                type="button"
                onClick={() => folderFileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-xs transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                title="Importer des fichiers dans ce dossier"
              >
                <Upload className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
                <span>Importer</span>
              </button>
            </div>

            {/* MILIEU : Fil d'Ariane parent + nom du dossier avec bordures en pointillés */}
            <div className="flex-1 flex justify-center items-center px-1 min-w-0">
              {folder.parentId ? (() => {
                const parentFolder = classeur3DFolders.find(f => f.id === folder.parentId);
                return (
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    {parentFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpened3DFolder(parentFolder);
                          setSplitSelectedFile(null);
                          setSubSearchQuery('');
                        }}
                        className="font-sans text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 px-2.5 sm:px-3 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[120px] sm:max-w-[160px] text-center cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                        title={`Retourner au dossier parent « ${parentFolder.name} »`}
                      >
                        <span className="truncate">{parentFolder.name}</span>
                      </button>
                    )}
                    <span className="text-stone-400 dark:text-slate-500 font-bold select-none text-xs sm:text-sm">/</span>
                    <h1 
                      className="font-sans text-xs sm:text-sm font-bold px-3.5 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[140px] sm:max-w-[200px] md:max-w-xs text-center"
                      style={{
                        backgroundColor: folder.primaryColor || '#FFC400',
                        color: folder.textDark ? '#1c1917' : '#FFFFFF'
                      }}
                      title={folder.name}
                    >
                      {folder.name}
                    </h1>
                  </div>
                );
              })() : (
                <h1 
                  className="font-sans text-xs sm:text-sm font-bold px-3.5 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[180px] sm:max-w-xs md:max-w-md text-center"
                  style={{
                    backgroundColor: folder.primaryColor || '#FFC400',
                    color: folder.textDark ? '#1c1917' : '#FFFFFF'
                  }}
                  title={folder.name}
                >
                  {folder.name}
                </h1>
              )}
            </div>

            {/* DROITE : Boutons Créer sous-dossier + Bloc-notes */}
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
              {!folder.parentId && (
                <button
                  type="button"
                  onClick={() => {
                    setSubFolderParentId(folder.id);
                    setSelectedFolderModelItem(null);
                    setCustomFolderColor(null);
                    setNewFolderNameInput('');
                    setIsCreateFolderModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-xs transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                  title="Créer un sous-dossier dans ce dossier"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-orange-400" />
                  <span className="hidden sm:inline">Créer un dossier</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setNewNoteNameInput('');
                  setIsNewNoteModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-xs transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                title="Nouveau document Bloc-notes (.txt)"
              >
                <FileEdit className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-cyan-400" />
                <span className="hidden sm:inline">Bloc-notes</span>
              </button>
            </div>
          </div>
        )}

        {/* Bandeau d'action de sélection multiple si activé */}
        {renderSelectionBanner(allOpenedFolderItems)}

        {/* Fichiers et sous-dossiers du dossier OU État vide */}
        {totalItems === 0 ? (
          <div className="py-20 sm:py-28 flex flex-col items-center justify-center text-center text-stone-500 dark:text-slate-400 rounded-3xl border-2 border-dashed border-white/10 p-6 bg-black/20">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-4 shadow-sm">
              <FolderArchive className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.8]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-stone-800 dark:text-stone-200">
              Ce dossier est vide
            </h3>
            <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Glissez-déposez des fichiers ici, ou créez un sous-dossier ou un bloc-notes depuis les boutons en haut.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {!folder.parentId && (
                <button
                  type="button"
                  onClick={() => {
                    setSubFolderParentId(folder.id);
                    setSelectedFolderModelItem(null);
                    setCustomFolderColor(null);
                    setNewFolderNameInput('');
                    setIsCreateFolderModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <FolderPlus className="w-4 h-4 stroke-[2.2]" />
                  <span>Créer un sous-dossier</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewNoteNameInput('');
                  setIsNewNoteModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <FileEdit className="w-4 h-4 stroke-[2.2]" />
                <span>Nouveau bloc-notes</span>
              </button>
              <button
                type="button"
                onClick={() => folderFileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4 stroke-[2.2]" />
                <span>Importer un fichier</span>
              </button>
            </div>
          </div>
        ) : (
          /* Grille d'éléments à taille fixe 4 (minmax 177px, gap 16px) - sans contrôle de taille */
          <div 
            className="grid transition-all duration-200 w-full"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(177px, 1fr))',
              gap: '16px'
            }}
          >
            {/* 1. Sous-dossiers créés dans ce dossier (dossier dans dossier - taille fixe 4) */}
            {sortedSubFolders.map((subF) => {
              const isSubFolderSelected = selectedItemIds.includes(subF.id);
              return (
                <div
                  key={subF.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleItemSelection(subF.id);
                      return;
                    }
                    setOpened3DFolder(subF);
                    setSplitSelectedFile(null);
                    setSubSearchQuery('');
                  }}
                  className={`group relative p-2.5 sm:p-3 rounded-2xl transition-all select-none border ${
                    isSubFolderSelected
                      ? 'border-amber-400 ring-2 ring-amber-400/50 bg-[#14233C]'
                      : 'bg-[#0E1526]/85 hover:bg-[#141E34] border-white/10 hover:border-orange-400/50'
                  } shadow-lg hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between`}
                >
                  {/* Case à cocher carrée quand le mode sélection est actif */}
                  {isSelectionMode && (
                    <div 
                      className="absolute top-2 left-2 z-30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItemSelection(subF.id);
                        }}
                        className={`p-1 sm:p-1.5 rounded-lg border transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
                          isSubFolderSelected
                            ? 'bg-amber-500 text-stone-900 border-amber-400 ring-2 ring-amber-400/50'
                            : 'bg-black/75 hover:bg-black text-white/70 hover:text-white border-white/30'
                        }`}
                        title={isSubFolderSelected ? "Décocher" : "Cocher"}
                      >
                        {isSubFolderSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <Square className="w-3.5 h-3.5 stroke-[2]" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Badges Épinglé et Favori */}
                  {(subF.isPinned || subF.isFavorite) && (
                    <div className={`absolute top-2 ${isSelectionMode ? 'left-9 sm:left-10' : 'left-2'} z-20 flex items-center gap-1 pointer-events-none`}>
                      {subF.isPinned && (
                        <span className="p-1 rounded-md bg-black/80 border border-blue-400/60 shadow-md flex items-center justify-center text-blue-400 backdrop-blur-sm" title="Épinglé">
                          <Pin className="w-3 h-3 rotate-45" />
                        </span>
                      )}
                      {subF.isFavorite && (
                        <span className="p-1 rounded-md bg-black/80 border border-amber-400/60 shadow-md flex items-center justify-center text-amber-400 backdrop-blur-sm" title="Favori">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bouton 3 traits & menu d'options */}
                  <div 
                    className="absolute top-2 right-2 z-30 studycloud-menu-trigger scale-90 origin-top-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFolderMenuId(activeFolderMenuId === subF.id ? null : subF.id);
                      }}
                      className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                        activeFolderMenuId === subF.id 
                          ? 'border-orange-400 ring-2 ring-orange-400/50 opacity-100 bg-black' 
                          : 'border-white/30 opacity-90 group-hover:opacity-100'
                      }`}
                      title="Options du sous-dossier (3 traits)"
                    >
                      <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                    {renderFolder3DOptionsMenu(subF)}
                  </div>

                  <div className="pt-7 sm:pt-7.5 pb-1 w-full">
                    <Classeur3DFolderCard folder={subF} />
                  </div>
                </div>
              );
            })}

            {sortedFiles.map((file) => {
              const isTxtNote = file.isNotepad || file.extension === 'txt' || file.name.toLowerCase().endsWith('.txt');
              const isSelected = splitSelectedFile?.id === file.id;
              const isChecked = selectedItemIds.includes(file.id);
              const isMenuOpen = activeMenuFileId === file.id;
              const isBeingDragged = draggedFileId === file.id;
              const isDropTarget = dragOverFileId === file.id && draggedFileId !== file.id;
              const isSaving = savingFileProgress[file.id] !== undefined;
              const progressVal = savingFileProgress[file.id] || 0;

              const handleFileDrop = (e: React.DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const sourceId = draggedFileId || e.dataTransfer.getData('text/plain');
                if (sourceId && sourceId !== file.id && opened3DFolder) {
                  setFolderFilesMap(prev => {
                    const currentList = prev[opened3DFolder.id] || [];
                    const fromIdx = currentList.findIndex(f => f.id === sourceId);
                    const toIdx = currentList.findIndex(f => f.id === file.id);
                    if (fromIdx < 0 || toIdx < 0) return prev;
                    const nextList = [...currentList];
                    const [moved] = nextList.splice(fromIdx, 1);
                    nextList.splice(toIdx, 0, moved);

                    const reordered = nextList.map((f, idx) => ({
                      ...f,
                      displayOrder: idx,
                      positionX: idx * 25,
                      positionY: 0
                    }));

                    // Persistance de l'ordre et des coordonnées dans Cloudflare D1 classeur_files
                    CloudStorageAPI.reorderClasseurFiles(reordered.map((f, idx) => ({
                      id: f.id,
                      displayOrder: idx,
                      positionX: idx * 25,
                      positionY: 0
                    }))).catch(() => {});

                    return {
                      ...prev,
                      [opened3DFolder.id]: reordered
                    };
                  });
                }
                setDraggedFileId(null);
                setDragOverFileId(null);
              };

              if (isTxtNote) {
                return (
                  <div
                    key={file.id}
                    draggable={!isSelectionMode && !isSaving}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData('text/plain', file.id);
                      setDraggedFileId(file.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedFileId && draggedFileId !== file.id) {
                        setDragOverFileId(file.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverFileId === file.id) setDragOverFileId(null);
                    }}
                    onDrop={handleFileDrop}
                    onDragEnd={() => {
                      setDraggedFileId(null);
                      setDragOverFileId(null);
                    }}
                    onClick={() => {
                      if (isSaving) {
                        showToast("Enregistrement du fichier en cours... Veuillez patienter.");
                        return;
                      }
                      if (isSelectionMode) {
                        toggleItemSelection(file.id);
                        return;
                      }
                      handleSelectFile(file);
                    }}
                    className={`group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between select-none overflow-hidden ${
                      isSaving ? 'cursor-wait' : 'cursor-pointer'
                    } ${
                      isBeingDragged
                        ? 'opacity-30 scale-95 border-dashed border-cyan-400 bg-cyan-500/10 cursor-grabbing'
                        : isDropTarget
                        ? 'border-cyan-400 ring-4 ring-cyan-400/50 scale-[1.03]'
                        : isChecked
                        ? 'border-amber-400 ring-2 ring-amber-400/50 bg-[#14233C]'
                        : isSelected
                        ? 'border-cyan-400 ring-2 ring-cyan-400/40 bg-[#14233C]'
                        : 'border-white/10 hover:border-cyan-400/50 hover:-translate-y-1'
                    } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
                  >
                    {/* Petit trait en haut collé à la carte qui se remplit pendant l'enregistrement */}
                    {isSaving && (
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-black/50 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
                        <div 
                          className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
                          style={{ width: `${progressVal}%` }}
                        />
                      </div>
                    )}

                    {/* Overlay d'enregistrement */}
                    {isSaving && (
                      <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none rounded-2xl animate-fadeIn">
                        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
                        <span className="text-[10px] font-black text-emerald-300 tracking-wider">
                          {progressVal}%
                        </span>
                        <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
                          Enregistrement...
                        </span>
                      </div>
                    )}
                    {/* Haut de carte : Case à cocher, Badge TXT et Bouton 3 traits */}
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5">
                        {isSelectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItemSelection(file.id);
                            }}
                            className="p-0.5 text-white hover:scale-110 transition-transform cursor-pointer"
                            title={isChecked ? "Décocher" : "Cocher"}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
                            ) : (
                              <Square className="w-4 h-4 text-white/90" />
                            )}
                          </button>
                        )}
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          TXT
                        </span>
                        {file.isPinned && (
                          <span className="p-0.5 rounded bg-black/60 text-blue-300 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
                            <Pin className="w-3 h-3 rotate-45" />
                          </span>
                        )}
                        {file.isFavorite && (
                          <span className="p-0.5 rounded bg-black/60 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          </span>
                        )}
                      </div>

                      <div 
                        className="relative studycloud-menu-trigger"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFileId(isMenuOpen ? null : file.id);
                          }}
                          className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                            isMenuOpen
                              ? 'border-cyan-400 ring-2 ring-cyan-400/50 opacity-100 bg-black'
                              : 'border-white/30 opacity-90 group-hover:opacity-100'
                          }`}
                          title="Options de la note (3 traits)"
                        >
                          <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
                        </button>

                        {/* Menu de propositions identique pour les fichiers */}
                        {renderFileOptionsMenu(file, allOpenedFolderItems, 'right')}
                      </div>
                    </div>

                    {/* Illustration TXT Conforme strictement à l'Image 2 */}
                    <div className="w-full flex-1 flex items-center justify-center py-2 min-h-[110px]">
                      <div className="w-24 sm:w-28 aspect-[160/215] drop-shadow-md group-hover:scale-105 transition-transform duration-200">
                        <TxtDocumentSVG />
                      </div>
                    </div>

                    {/* Bas de carte : Titre et détails */}
                    <div className="p-1.5 flex flex-col justify-between bg-black/30 rounded-xl mt-1.5">
                      <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span className="truncate">{file.size || '0 o'}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Autre fichier importé (images, vidéos, audio, pdfs, etc.)
              return (
                <div
                  key={file.id}
                  draggable={!isSelectionMode && !isSaving}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('text/plain', file.id);
                    setDraggedFileId(file.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedFileId && draggedFileId !== file.id) {
                      setDragOverFileId(file.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverFileId === file.id) setDragOverFileId(null);
                  }}
                  onDrop={handleFileDrop}
                  onDragEnd={() => {
                    setDraggedFileId(null);
                    setDragOverFileId(null);
                  }}
                  onClick={() => {
                    if (isSaving) {
                      showToast("Enregistrement du fichier en cours... Veuillez patienter.");
                      return;
                    }
                    if (isSelectionMode) {
                      toggleItemSelection(file.id);
                      return;
                    }
                    handleSelectFile(file);
                  }}
                  className={`group relative bg-[#0E1526]/85 hover:bg-[#141E34] border rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col overflow-hidden ${
                    isSaving ? 'cursor-wait' : 'cursor-pointer'
                  } ${
                    isBeingDragged
                      ? 'opacity-30 scale-95 border-dashed border-orange-400 bg-orange-500/10 cursor-grabbing'
                      : isDropTarget
                      ? 'border-orange-400 ring-4 ring-orange-400/50 scale-[1.03]'
                      : isChecked
                      ? 'border-amber-400 ring-2 ring-amber-400/50 bg-[#192238]'
                      : isSelected
                      ? 'border-orange-400 ring-2 ring-orange-400/40 bg-[#192238]'
                      : 'border-white/10 hover:border-orange-500/50 hover:-translate-y-1'
                  } ${isMenuOpen ? 'z-50 relative' : 'z-10'}`}
                >
                  {/* Petit trait en haut collé à la carte qui se remplit pendant l'enregistrement */}
                  {isSaving && (
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-black/50 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
                      <div 
                        className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
                        style={{ width: `${progressVal}%` }}
                      />
                    </div>
                  )}

                  {/* Overlay d'enregistrement */}
                  {isSaving && (
                    <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none rounded-2xl animate-fadeIn">
                      <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
                      <span className="text-[10px] font-black text-emerald-300 tracking-wider">
                        {progressVal}%
                      </span>
                      <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
                        Enregistrement...
                      </span>
                    </div>
                  )}

                  <div className="w-full h-24 sm:h-28 bg-slate-900/90 relative rounded-t-2xl flex items-center justify-center overflow-hidden">
                    {/* Case à cocher carrée quand le mode sélection est actif */}
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItemSelection(file.id);
                        }}
                        className="absolute top-1.5 left-1.5 z-20 p-1 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
                        title={isChecked ? "Décocher" : "Cocher"}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 fill-amber-400 text-stone-950" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-white/90" />
                        )}
                      </button>
                    )}

                    {/* Badges Épinglé et Favori */}
                    {(file.isPinned || file.isFavorite) && (
                      <div className={`absolute top-1.5 ${isSelectionMode ? 'left-9 sm:left-10' : 'left-1.5'} z-20 flex items-center gap-1 pointer-events-none`}>
                        {file.isPinned && (
                          <span className="p-1 rounded-md bg-black/75 text-blue-400 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
                            <Pin className="w-3 h-3 rotate-45" />
                          </span>
                        )}
                        {file.isFavorite && (
                          <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          </span>
                        )}
                      </div>
                    )}

                    {file.category === 'images' ? (
                      <img 
                        src={file.previewUrl || (file as any).url} 
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (file.category === 'videos' || Boolean(file.videoUrl)) ? (
                      <VideoCardPreview vid={file} />
                    ) : file.category === 'documents' ? (
                      <DocumentCardPreview doc={file} />
                    ) : (file.category === 'audio' || Boolean(file.audioUrl)) ? (
                      <AudioCardPreview track={file} />
                    ) : file.previewUrl ? (
                      <img 
                        src={file.previewUrl} 
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3">
                        {file.category === 'audio' && <Music className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400/85 stroke-[1.8]" />}
                        {file.category === 'downloads' && <Download className="w-8 h-8 sm:w-10 sm:h-10 text-sky-400/85 stroke-[1.8]" />}
                        {file.category === 'apps' && <LayoutGrid className="w-8 h-8 sm:w-10 sm:h-10 text-pink-400/85 stroke-[1.8]" />}
                      </div>
                    )}

                    <div 
                      className="relative studycloud-menu-trigger"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuFileId(isMenuOpen ? null : file.id);
                        }}
                        className={`absolute top-1.5 right-1.5 p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm z-20 ${
                          isMenuOpen
                            ? 'border-orange-400 ring-2 ring-orange-400/50 opacity-100 bg-black'
                            : 'border-white/30 opacity-90 group-hover:opacity-100'
                        }`}
                        title="Options du fichier (3 traits)"
                      >
                        <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>

                      {/* Menu de propositions identique pour les fichiers */}
                      {renderFileOptionsMenu(file, allOpenedFolderItems, 'right')}
                    </div>
                  </div>

                  <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-black/30 rounded-b-2xl">
                    <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-orange-400 transition-colors" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span className="truncate max-w-[85px]">{file.source}</span>
                      <span className="shrink-0 font-medium">{file.size}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // MENU D'OPTIONS 3 TRAITS POUR LES DOSSIERS 3D DU CLASSEUR
  // Conforme à l'Image 2 (sans "Définir comme photo de profil" ni "Le déplacer")
  // =========================================================================
  const renderFolder3DOptionsMenu = (folder: ClasseurCreatedFolder) => {
    if (activeFolderMenuId !== folder.id) return null;

    return (
      <div 
        className="studycloud-file-menu-panel absolute right-0 top-9 z-50 w-60 bg-[#0A0F1D] border-2 border-slate-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de menu dédié avec nom du dossier et bouton fermeture (Image 2) */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={folder.name}>
              {folder.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {folder.dateText} • <span className="uppercase text-amber-400">MODÈLE {folder.model}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveFolderMenuId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste déroulante des options identiques à l'Image 2 */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          {/* Section 1 : Sélection (Cocher, Tout cocher, Télécharger) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('check', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Cocher</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('check_all', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Tout cocher</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('download', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Télécharger</span>
            </button>
          </div>

          {/* Section 2 : Gestion principale (Supprimer, Partager, Lien, Verrouiller) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('delete', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Supprimer le dossier</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('share', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>Partager</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('create_link', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Link className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              <span>Créer un lien</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('lock_folder', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer text-left"
              title="Verrouiller ce dossier dans le dossier sécurisé"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Verrouiller</span>
            </button>
            {/* OMITTED: 'Le déplacer' comme expressément demandé par l'utilisateur */}
          </div>

          {/* Section 3 : Organisation & Édition (Dupliquer, Favoris, Épingler, Modifier le nom) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('duplicate', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Copy className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Dupliquer</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('favorite', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${folder.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-400'}`} />
              <span>{folder.isFavorite ? 'Retirer des favoris' : 'Ajouter au favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('pin', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pin className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>Épinglez</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('rename', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span>Modifier le nom</span>
            </button>
            {/* OMITTED: 'Définir comme photo de profil' comme expressément demandé par l'utilisateur */}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // MENU D'EN-TÊTE À 3 TRAITS (OPTIONS DE TRI & BOUTON ŒIL)
  // Demandé : trié par plus récent, plus ancien, ce qui sont épinglez, et bouton œil
  // =========================================================================
  const renderHeaderOptionsMenu = () => {
    if (!isHeaderMenuOpen) return null;

    const isTrashView = currentSubView?.id === 'studycloud-collection-trash' || (isCloudView && cloudActiveTab === 'trash');
    const isAllTrashSelected = filteredTrashFiles.length > 0 && selectedItemIds.length >= filteredTrashFiles.length;
    const hasMultipleTrashSelected = selectedItemIds.length > 1;

    return (
      <div 
        className="studycloud-file-menu-panel absolute right-0 top-11 sm:top-12 z-50 w-64 bg-[#0A0F1D] border-2 border-slate-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête du menu */}
        <div className="px-3.5 py-2.5 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div>
            <p className="text-[11px] font-black text-white">
              {isTrashView ? 'Options de la corbeille' : "Options d'affichage & Tri"}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">StudyCloud</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsHeaderMenuOpen(false);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options de tri et bouton œil */}
        <div className="py-1 divide-y divide-white/5">
          {isTrashView && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  if (isSelectionMode) {
                    setIsSelectionMode(false);
                    setSelectedItemIds([]);
                  } else {
                    setIsSelectionMode(true);
                    if (filteredTrashFiles.length > 0 && selectedItemIds.length === 0) {
                      setSelectedItemIds([filteredTrashFiles[0].id]);
                    }
                  }
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                {isSelectionMode ? <Square className="w-3.5 h-3.5 shrink-0" /> : <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
                <span>{isSelectionMode ? 'Décocher tout' : 'Cocher'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAllTrashSelected) {
                    setSelectedItemIds([]);
                    setIsSelectionMode(false);
                  } else {
                    setIsSelectionMode(true);
                    setSelectedItemIds(filteredTrashFiles.map(f => f.id));
                  }
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                {isAllTrashSelected ? <Square className="w-3.5 h-3.5 shrink-0" /> : <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
                <span>{isAllTrashSelected ? 'Tout décocher' : 'Tout cocher'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleRestoreSelectedFromTrash();
                  setIsHeaderMenuOpen(false);
                }}
                disabled={filteredTrashFiles.length === 0}
                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>{isAllTrashSelected || hasMultipleTrashSelected ? 'Tout restaurer' : 'Restaurer'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedItemIds.length > 0) {
                    handlePermanentDeleteSelectedFromTrash();
                  } else {
                    handleEmptyTrash();
                  }
                  setIsHeaderMenuOpen(false);
                }}
                disabled={filteredTrashFiles.length === 0}
                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isAllTrashSelected || hasMultipleTrashSelected ? 'Tout supprimer' : 'Supprimer définitivement'}</span>
              </button>
            </div>
          )}

          <div className="py-1">
            {/* Trié par plus récent */}
            <button
              type="button"
              onClick={() => {
                setSortOption('recent');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'recent'
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span>Trié par plus récent</span>
              </div>
              {sortOption === 'recent' && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            </button>

            {/* Plus ancien */}
            <button
              type="button"
              onClick={() => {
                setSortOption('oldest');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'oldest'
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                <span>Plus ancien</span>
              </div>
              {sortOption === 'oldest' && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
            </button>

            {/* Ceux qui sont épinglés */}
            <button
              type="button"
              onClick={() => {
                setSortOption('pinned');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'pinned'
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Pin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Ceux qui sont épinglés</span>
              </div>
              {sortOption === 'pinned' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </button>
          </div>

          {/* Bouton œil */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsEyeViewActive(!isEyeViewActive);
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                isEyeViewActive
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Eye className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{isEyeViewActive ? "Bouton œil (Activé)" : "Bouton œil"}</span>
              </div>
              {isEyeViewActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>
          </div>

          {/* Option Changer de code pour le dossier sécurisé (Image 2) */}
          {(currentSubView?.id === 'studycloud-collection-secure-folder' || (isCloudView && cloudActiveTab === 'secure-folder')) && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setIsHeaderMenuOpen(false);
                  setIsChangePinModalOpen(true);
                  setOldPinInput('');
                  setNewPinInput('');
                  setNewPinConfirmInput('');
                  setChangePinError(null);
                  setChangePinSuccess(null);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Changer de code</span>
              </button>
            </div>
          )}

          {/* Option Restaurer le fond d'origine et la photo de profil (Menu Images) */}
          {(currentSubView?.id === 'studycloud-category-images' || (isCloudView && cloudActiveTab === 'images')) && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setIsHeaderMenuOpen(false);
                  handleRestoreDefaultWallpaperAndAvatar();
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>Restaurer le fond et photo de profil d'origine</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // FONCTIONS DE RENDU DES CARTES MULTIMÉDIA (RÉUTILISÉES DANS DOCUMENTS & TÉLÉCHARGEMENTS)
  // =========================================================================

  // Rendu Carte Document (Image 1 : bouton 3 traits, case à cocher en mode sélection, un seul titre)
  const renderDocumentCard = (doc: FileItem, index?: number, customList?: FileItem[]) => {
    const theme = getDocumentTheme(doc.extension || 'PDF');
    const isSelected = splitSelectedFile?.id === doc.id;
    const isMenuOpen = activeMenuFileId === doc.id || docMenuOpenId === doc.id;
    const isChecked = selectedItemIds.includes(doc.id);
    const isSaving = savingFileProgress[doc.id] !== undefined;
    const progressVal = savingFileProgress[doc.id] || 0;

    // Déterminer alignement du menu
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={doc.id}
        style={{ background: theme.bg }}
        className={`aspect-[3/4] ${theme.border} ${isSelected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : ''} ${
          isChecked ? 'ring-4 ring-amber-400 shadow-2xl' : ''
        } ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'
        } rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none ${
          isSaving ? 'cursor-wait select-none' : 'cursor-pointer active:scale-98'
        }`}
        onClick={() => {
          if (isSaving) {
            showToast("Enregistrement du document en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            toggleItemSelection(doc.id);
          } else {
            handleSelectFile(doc);
          }
        }}
      >
        {/* Petit trait en haut collé au fichier qui se remplit pendant l'enregistrement */}
        {isSaving && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}

        {/* Overlay au milieu du fichier qui se remplit et empêche l'ouverture */}
        {isSaving && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none animate-fadeIn rounded-2xl">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
              {progressVal}%
            </span>
            <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
              Enregistrement...
            </span>
          </div>
        )}
        {/* Barre supérieure : Bouton 3 traits, Checkbox (en mode sélection) & Taille */}
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(isMenuOpen ? null : doc.id);
                  setDocMenuOpenId(isMenuOpen ? null : doc.id);
                }}
                className="p-1 sm:p-1.2 rounded-lg bg-black/40 hover:bg-black/70 text-white border border-white/20 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-sm"
                title="Options du fichier (3 traits)"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>

              {renderFileOptionsMenu(doc, customList || filteredDocuments, menuAlign)}
            </div>

            {/* Case à cocher visible en mode sélection */}
            {isSelectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItemSelection(doc.id);
                }}
                className="p-0.5 text-white hover:scale-110 transition-transform cursor-pointer"
                title={isChecked ? "Décocher" : "Cocher"}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
                ) : (
                  <Square className="w-4 h-4 text-white/90" />
                )}
              </button>
            )}

            {/* Badges Épinglé et Favori */}
            {doc.isPinned && (
              <span className="p-0.5 rounded bg-black/60 text-blue-300 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
                <Pin className="w-3 h-3 rotate-45" />
              </span>
            )}
            {doc.isFavorite && (
              <span className="p-0.5 rounded bg-black/60 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </span>
            )}
          </div>

          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
            {doc.size}
          </span>
        </div>

        {/* Corps de carte / aperçu réel du document (PDF page 1 ou layout dynamique) */}
        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <DocumentCardPreview doc={doc} />
        </div>

        {/* Titre unique : un seul nom en bas */}
        <div className="px-0.5 mb-1">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={doc.name}>
            {doc.name}
          </p>
        </div>

        {/* Pied de carte : sans nombre de téléchargement */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadFile(doc); }}
            className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
            title="Télécharger"
          >
            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </div>
      </div>
    );
  };

  // Rendu Carte Fichier Corbeille (avec bouton 3 traits, case à cocher, aperçu/icône et bouton restauration rapide)
  const renderTrashCard = (file: FileItem, idx: number) => {
    const isSelected = splitSelectedFile?.id === file.id;
    const isChecked = selectedItemIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const isRightCol = ((idx + 1) % (splitSelectedFile ? 3 : 5) === 0 || (idx + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={file.id || idx}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(file.id);
          } else {
            handleSelectFile(file);
          }
        }}
        className={`group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between select-none ${
          isSelected
            ? 'border-rose-400 ring-2 ring-rose-400/40 bg-[#1e1320]'
            : 'border-white/10 hover:border-rose-500/50'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10'}`}
      >
        {/* Barre supérieure : Bouton 3 traits, Checkbox (en mode sélection) & Taille */}
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(isMenuOpen ? null : file.id);
                }}
                className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                  isMenuOpen
                    ? 'border-rose-400 ring-2 ring-rose-400/50 opacity-100 bg-black'
                    : 'border-white/30 opacity-90 group-hover:opacity-100'
                }`}
                title="Options corbeille (3 traits)"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>

              {renderTrashOptionsMenu(file, menuAlign)}
            </div>

            {isSelectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItemSelection(file.id);
                }}
                className="p-0.5 text-white hover:scale-110 transition-transform cursor-pointer"
                title={isChecked ? "Décocher" : "Cocher"}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
                ) : (
                  <Square className="w-4 h-4 text-white/90" />
                )}
              </button>
            )}
          </div>

          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/60 text-slate-300 border border-white/10 px-1.5 py-0.5 rounded shadow-sm">
            {file.size || 'Fichier'}
          </span>
        </div>

        {/* Aperçu visuel ou icône de type */}
        <div className="w-full flex-1 flex flex-col items-center justify-center py-2 min-h-[105px] overflow-hidden rounded-xl">
          {file.category === 'images' ? (
            <img 
              src={file.previewUrl || (file as any).url} 
              alt={file.name} 
              className="w-full h-24 object-cover rounded-xl border border-white/10 shadow-inner"
            />
          ) : file.category === 'videos' ? (
            <div className="w-full h-24 rounded-xl overflow-hidden relative">
              <VideoCardPreview vid={file} />
            </div>
          ) : file.category === 'documents' ? (
            <div className="w-full h-24 rounded-xl overflow-hidden relative">
              <DocumentCardPreview doc={file} />
            </div>
          ) : (file.category === 'audio' || Boolean(file.audioUrl)) ? (
            <div className="w-full h-24 rounded-xl overflow-hidden relative">
              <AudioCardPreview track={file} />
            </div>
          ) : file.previewUrl ? (
            <img 
              src={file.previewUrl} 
              alt={file.name} 
              className="w-full h-24 object-cover rounded-xl border border-white/10 shadow-inner"
            />
          ) : (
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 group-hover:scale-105 transition-transform flex items-center justify-center">
              {file.category === 'audio' && <Music className="w-8 h-8 text-amber-400/90" />}
              {file.category === 'downloads' && <Download className="w-8 h-8 text-sky-400/90" />}
              {file.isNotepad && <FileEdit className="w-8 h-8 text-cyan-400/90" />}
              {!['images', 'videos', 'audio', 'documents', 'downloads'].includes(file.category || '') && !file.isNotepad && (
                <FileText className="w-8 h-8 text-rose-400/90" />
              )}
            </div>
          )}
        </div>

        {/* Nom du fichier et bouton restaurer direct au pied */}
        <div className="p-2 bg-black/40 rounded-xl mt-1 border border-white/5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors" title={file.name}>
              {file.name}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
              <span className="truncate max-w-[85px] text-rose-300/80">
                {file.originalFolderId ? 'Dossier 3D' : (file.category || 'Corbeille')}
              </span>
              <span className="shrink-0 text-slate-500 font-medium">{file.date || ''}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestoreFromTrash(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer à son emplacement d'origine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Rendu Carte Image (Image 3 : titre directement sur l'image avec dégradé comme les vidéos, bouton 3 traits & case à cocher)
  const renderImageCard = (img: FileItem, index?: number) => {
    const isSelected = splitSelectedFile?.id === img.id;
    const isMenuOpen = activeMenuFileId === img.id;
    const isChecked = selectedItemIds.includes(img.id);
    const isSaving = savingFileProgress[img.id] !== undefined;
    const progressVal = savingFileProgress[img.id] || 0;

    // Déterminer alignement du menu (inverser si carte sur la droite pour ne pas déborder de l'écran)
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={img.id}
        onClick={() => {
          if (isSaving) {
            showToast("Enregistrement de l'image en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            toggleItemSelection(img.id);
          } else {
            handleSelectFile(img);
          }
        }}
        className={`group relative aspect-square sm:aspect-[4/5] rounded-2xl bg-[#151C2C] border transition-all duration-200 ${
          isSaving ? 'cursor-wait select-none' : 'cursor-pointer'
        } ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isSelected 
              ? 'border-blue-500 ring-4 ring-blue-500/50 shadow-2xl scale-[1.02]' 
              : 'border-white/10 hover:border-blue-400/50 shadow-md'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
      >
        {/* Petit trait en haut collé à l'image qui se remplit pendant l'enregistrement */}
        {isSaving && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/50 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}

        {/* Overlay d'enregistrement */}
        {isSaving && (
          <div className="absolute inset-0 z-30 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none rounded-2xl animate-fadeIn">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
              {progressVal}%
            </span>
            <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
              Enregistrement...
            </span>
          </div>
        )}
        {/* Conteneur média interne avec overflow-hidden : arrondit l'image et ses dégradés sans couper le menu qui dépasse */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <img
            src={img.previewUrl}
            alt={img.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />

          {/* Titre sur l'image avec dégradé identique aux vidéos */}
          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/95 via-black/50 to-transparent">
            <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">{img.name}</p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : img.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de l'image (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderFileOptionsMenu(img, filteredImages, menuAlign)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(img.id);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? "Décocher" : "Cocher"}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Badges Épinglé et Favori */}
          {img.isPinned && (
            <span className="p-1 rounded-md bg-black/75 text-blue-400 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
              <Pin className="w-3 h-3 rotate-45" />
            </span>
          )}
          {img.isFavorite && (
            <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </span>
          )}
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {img.size}
          </span>
        </div>
      </div>
    );
  };

  // Rendu Carte Vidéo (Bouton lecture central, taille en haut à droite, bouton 3 traits & case à cocher, titre en bas)
  const renderVideoCard = (vid: FileItem, index?: number) => {
    const isSelected = splitSelectedFile?.id === vid.id;
    const isMenuOpen = activeMenuFileId === vid.id;
    const isChecked = selectedItemIds.includes(vid.id);
    const isSaving = savingFileProgress[vid.id] !== undefined;
    const progressVal = savingFileProgress[vid.id] || 0;

    // Déterminer alignement du menu
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={vid.id}
        onClick={() => {
          if (isSaving) {
            showToast("Enregistrement de la vidéo en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            toggleItemSelection(vid.id);
          } else {
            handleSelectFile(vid);
          }
        }}
        className={`group relative aspect-[4/5] rounded-2xl bg-[#0A0E18] border transition-all duration-200 ${
          isSaving ? 'cursor-wait select-none' : 'cursor-pointer'
        } ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isSelected 
              ? 'border-purple-500 ring-4 ring-purple-500/50 shadow-2xl scale-[1.02]' 
              : 'border-white/10 hover:border-purple-400/50 shadow-md'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
      >
        {/* Petit trait en haut collé à la carte qui se remplit pendant l'enregistrement */}
        {isSaving && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/50 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}

        {/* Overlay d'enregistrement */}
        {isSaving && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none rounded-2xl animate-fadeIn">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
              {progressVal}%
            </span>
            <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
              Enregistrement...
            </span>
          </div>
        )}

        {/* Conteneur média interne avec overflow-hidden : arrondit la vignette sans couper le menu déroulant */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <VideoCardPreview vid={vid} />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors" />

          {/* Centre : Bouton Play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white/95 text-stone-950 flex items-center justify-center shadow-2xl group-hover:scale-115 transition-transform duration-200">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-stone-950 translate-x-0.5" />
            </div>
          </div>

          {/* Titre en bas */}
          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/95 via-black/50 to-transparent">
            <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">{vid.name}</p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : vid.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de la vidéo (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderFileOptionsMenu(vid, filteredVideos, menuAlign)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(vid.id);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? "Décocher" : "Cocher"}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Badges Épinglé et Favori */}
          {vid.isPinned && (
            <span className="p-1 rounded-md bg-black/75 text-blue-400 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
              <Pin className="w-3 h-3 rotate-45" />
            </span>
          )}
          {vid.isFavorite && (
            <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </span>
          )}
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {vid.size}
          </span>
        </div>
      </div>
    );
  };

  // Rendu Carte Audio Carrée (Comme pour les vidéos, carré avec bouton 3 traits, logo musique/mélodie au centre, taille en haut à droite, titre en bas)
  const renderAudioSquareCard = (aud: FileItem, index?: number, customList?: FileItem[]) => {
    const isSelected = splitSelectedFile?.id === aud.id;
    const isMenuOpen = activeMenuFileId === aud.id || audioMenuSongId === aud.id;
    const isChecked = selectedItemIds.includes(aud.id);
    const isSaving = savingFileProgress[aud.id] !== undefined;
    const progressVal = savingFileProgress[aud.id] || 0;

    // Déterminer alignement du menu
    const isRightCol = typeof index === 'number' && ((index + 1) % (splitSelectedFile ? 3 : 5) === 0 || (index + 1) % (splitSelectedFile ? 3 : 6) === 0);
    const menuAlign: 'left' | 'right' = isRightCol ? 'right' : 'left';

    return (
      <div
        key={aud.id}
        onClick={() => {
          if (isSaving) {
            showToast("Enregistrement de l'audio en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            toggleItemSelection(aud.id);
          } else {
            handleSelectFile(aud);
          }
        }}
        className={`group relative aspect-square rounded-2xl bg-gradient-to-br from-[#121929] via-[#0B0F19] to-black border transition-all duration-200 ${
          isSaving ? 'cursor-wait select-none' : 'cursor-pointer'
        } ${
          isChecked
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isSelected 
              ? 'border-amber-500 ring-4 ring-amber-500/50 shadow-2xl scale-[1.02]' 
              : 'border-white/10 hover:border-amber-400/50 shadow-md'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
      >
        {/* Petit trait en haut collé à la carte qui se remplit pendant l'enregistrement */}
        {isSaving && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/50 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}

        {/* Overlay d'enregistrement */}
        {isSaving && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none rounded-2xl animate-fadeIn">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
              {progressVal}%
            </span>
            <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
              Enregistrement...
            </span>
          </div>
        )}

        {/* Conteneur média interne avec overflow-hidden : arrondit l'arrière-plan sans couper le menu */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <AudioCardPreview track={aud} className="w-full h-full object-cover opacity-45 group-hover:scale-105 group-hover:opacity-65 transition-all duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

          {/* AU MILIEU : LE LOGO DE MUSIQUE / MÉLODIE DÉTAILLÉ & NET (SANS SILHOUETTE NOIRE BLOQUANTE) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-[0_8px_25px_rgba(245,158,11,0.55)] group-hover:scale-110 transition-all duration-300 border-2 border-white/30 ring-2 ring-black/40 relative">
              {/* Cercle vinyle intérieur discret */}
              <div className="absolute inset-1.5 rounded-full border border-white/20 pointer-events-none" />
              
              {/* Logo de mélodie très détaillé : double croche avec notes blanches illuminées, stems et ondes sonores */}
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Ondes de mélodie acoustique fines */}
                <path d="M2.5 10.5C2.5 7.8 4.2 5.5 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                <path d="M21.5 10.5C21.5 7.8 19.8 5.5 17.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                
                {/* Tiges et double liaison musicale */}
                <path d="M9 16.5V5.5L20 3.5V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 9.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                
                {/* Tête de note 1 (gauche) blanche avec contour net */}
                <ellipse cx="6" cy="16.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 6 16.5)" />
                {/* Tête de note 2 (droite) blanche avec contour net */}
                <ellipse cx="17" cy="14.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 17 14.5)" />
              </svg>
            </div>
          </div>

          {/* Titre en bas sur dégradé sombre identique aux vidéos */}
          <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-[10px] sm:text-xs font-bold text-white truncate drop-shadow-sm">{aud.name}</p>
            <p className="text-[9px] text-amber-300/90 font-semibold truncate">{aud.artist || 'Fichier Audio'}</p>
          </div>
        </div>

        {/* Haut gauche : Bouton 3 traits & Checkbox */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : aud.id);
                setAudioMenuSongId(isMenuOpen ? null : aud.id);
              }}
              className="p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/30 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm"
              title="Options de l'audio (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {renderFileOptionsMenu(aud, customList || downloadAudio, menuAlign)}
          </div>

          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(aud.id);
              }}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isChecked ? "Décocher" : "Cocher"}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Badges Épinglé et Favori */}
          {aud.isPinned && (
            <span className="p-1 rounded-md bg-black/75 text-blue-400 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
              <Pin className="w-3 h-3 rotate-45" />
            </span>
          )}
          {aud.isFavorite && (
            <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </span>
          )}
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {aud.size}
          </span>
        </div>
      </div>
    );
  };

  // Rendu Élément Audio (utilisé dans téléchargements & listes globales)
  const renderAudioItem = (track: FileItem) => {
    const isSelected = splitSelectedFile?.id === track.id;
    const isMenuOpen = activeMenuFileId === track.id || audioMenuSongId === track.id;
    const isChecked = selectedItemIds.includes(track.id);
    const isSaving = savingFileProgress[track.id] !== undefined;
    const progressVal = savingFileProgress[track.id] || 0;

    return (
      <div
        key={track.id}
        onClick={() => {
          if (isSaving) {
            showToast("Enregistrement de l'audio en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            toggleItemSelection(track.id);
          } else {
            handleSelectFile(track);
          }
        }}
        className={`group relative flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl transition-all select-none ${
          isSaving ? 'cursor-wait' : 'cursor-pointer'
        } ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'relative z-10 overflow-hidden'
        } ${
          isChecked
            ? 'bg-amber-500/15 border border-amber-400 ring-2 ring-amber-400/40'
            : isSelected 
              ? 'bg-[#182236] border border-amber-400/60 shadow-md ring-2 ring-amber-400/40' 
              : 'hover:bg-[#121826] border border-transparent'
        }`}
      >
        {/* Petit trait en haut qui se remplit pendant l'enregistrement */}
        {isSaving && (
          <div className="absolute top-0 inset-x-0 h-1 bg-black/40 z-20 overflow-hidden rounded-t-2xl pointer-events-none">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 min-w-0">
          {/* Checkbox en mode sélection */}
          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(track.id);
              }}
              className="p-1 text-amber-500 hover:text-amber-400 cursor-pointer shrink-0"
            >
              {isChecked ? (
                <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
              ) : (
                <Square className="w-5 h-5 text-stone-400 dark:text-slate-500" />
              )}
            </button>
          )}

          <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 relative overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
            <AudioCardPreview track={track} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">{track.name}</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
              {isSaving ? (
                <span className="text-emerald-400 font-bold animate-pulse">Enregistrement... {progressVal}%</span>
              ) : (
                <>{track.size} • {track.date}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSelected && (
            <div 
              className="flex items-end gap-1 h-5 px-1 py-0.5 shrink-0" 
              title={isAudioPlaying ? "Lecture en cours" : "En pause"}
            >
              <span className={`w-1 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-1' : ''}`} style={{ height: isAudioPlaying ? undefined : '5px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
              <span className={`w-1 rounded-full bg-amber-300 ${isAudioPlaying ? 'music-bar-2' : ''}`} style={{ height: isAudioPlaying ? undefined : '14px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
              <span className={`w-1 rounded-full bg-yellow-400 ${isAudioPlaying ? 'music-bar-3' : ''}`} style={{ height: isAudioPlaying ? undefined : '9px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
              <span className={`w-1 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-4' : ''}`} style={{ height: isAudioPlaying ? undefined : '4px', animationPlayState: isAudioPlaying ? 'running' : 'paused' }} />
            </div>
          )}

          {/* Badges Épinglé et Favori */}
          {track.isPinned && (
            <span className="p-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-400/30 shrink-0" title="Épinglé">
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </span>
          )}
          {track.isFavorite && (
            <span className="p-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-400/30 shrink-0" title="Favori">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </span>
          )}

          {/* Bouton 3 traits */}
          <div className="relative shrink-0 studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : track.id);
                setAudioMenuSongId(isMenuOpen ? null : track.id);
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Options de la musique (3 traits)"
            >
              <Menu className="w-4 h-4 stroke-[2.2]" />
            </button>
            {renderFileOptionsMenu(track, filteredAudio, 'right')}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadFile(track); }}
            className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Télécharger"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Rendu Autre Fichier (Archive, App, etc.)
  const renderOtherFileCard = (item: FileItem) => {
    const isSelected = splitSelectedFile?.id === item.id;
    const isMenuOpen = activeMenuFileId === item.id;
    const isChecked = selectedItemIds.includes(item.id);

    return (
      <div
        key={item.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(item.id);
          } else {
            handleSelectFile(item);
          }
        }}
        className={`group bg-[#151C2C] hover:bg-[#1A2338] border rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer ${
          isMenuOpen ? 'z-50 relative' : 'relative z-10'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40'
            : isSelected ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-800 hover:border-sky-400/50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(item.id);
              }}
              className="p-1 text-amber-500 hover:text-amber-400 cursor-pointer shrink-0"
            >
              {isChecked ? (
                <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
              ) : (
                <Square className="w-5 h-5 text-slate-500" />
              )}
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-sky-400 transition-colors">{item.name}</h4>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span className="font-bold text-sky-300 uppercase">{item.extension || 'FICHIER'}</span>
              <span>•</span>
              <span>{item.size}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Badges Épinglé et Favori */}
          {item.isPinned && (
            <span className="p-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-400/30 shrink-0" title="Épinglé">
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </span>
          )}
          {item.isFavorite && (
            <span className="p-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-400/30 shrink-0" title="Favori">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </span>
          )}

          {/* Bouton 3 traits */}
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(isMenuOpen ? null : item.id);
              }}
              className="w-8 h-8 rounded-xl bg-black hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/10"
              title="Options (3 traits)"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>
            {renderFileOptionsMenu(item, downloadOthers, 'right')}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownloadFile(item); }}
            className="w-8 h-8 rounded-xl bg-black hover:bg-sky-600 text-white flex items-center justify-center transition-colors border border-white/10"
            title="Télécharger"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDU DÉTAILLÉ DES PAGES DU DOCUMENT (FORMAT HAUTE DÉFINITION)
  // =========================================================================
  const renderDocPage1 = (file: FileItem) => {
    const docTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    return (
      <div id="doc-page-1" className="w-full space-y-6">
        {/* En-tête officiel CME & StudyCloud */}
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 1
          </span>
        </div>

        {/* Titre du chapitre */}
        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            {docTitle}
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Fascicule de Travaux Dirigés & Cours Magistral • {file.documentCategory || 'COURS'} • Chapitre 1
          </p>
        </div>

        {/* Schéma électronique AOP Inverseur Grand Format */}
        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 flex flex-col items-center justify-center">
          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
            Schéma 1 : Montage Amplificateur Inverseur de Tension (AOP Idéal en boucle fermée)
          </p>
          <svg className="w-full max-w-lg h-40" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,10 60,60 115,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
            <line x1="20" y1="23" x2="60" y2="23" stroke="#1c1917" strokeWidth="1.8" />
            <line x1="20" y1="47" x2="60" y2="47" stroke="#1c1917" strokeWidth="1.8" />
            <rect x="30" y="19" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="34" y="25" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
            <text x="64" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
            <text x="64" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
            <line x1="115" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
            <line x1="50" y1="23" x2="50" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="50" y1="7" x2="130" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="130" y1="7" x2="130" y2="35" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="80" y="3" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="86" y="9.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
            <line x1="20" y1="47" x2="20" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="14" y1="58" x2="26" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="17" y1="61" x2="23" y2="61" stroke="#1c1917" strokeWidth="1.5" />
          </svg>
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-700 mt-2 px-2">
            <span>Formule de transfert : <strong className="text-red-700">Vs = -(R2 / R1) · Ve</strong></span>
            <span>Gain en tension : <strong className="text-red-700">Av = -R2 / R1</strong></span>
          </div>
        </div>

        {/* Paragraphes explicatifs */}
        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p className="font-bold text-stone-900 text-sm">1. Définition et principe de fonctionnement :</p>
          <p>
            Un amplificateur opérationnel idéal possède un gain infini en boucle ouverte et une impédance d'entrée infinie.
            En régime linéaire avec réaction négative, la tension différentielle d'entrée <strong>ε = V+ - V-</strong> est rigoureusement nulle (masse virtuelle).
          </p>
          <p>
            Le courant traversant la résistance <strong>R1</strong> est intégralement dévié dans <strong>R2</strong> (car aucun courant ne pénètre dans l'AOP idéal, i- = 0).
            On en déduit immédiatement la relation fondamentale de sortie : <em>Vs = - (R2 / R1) · Ve</em>.
          </p>
        </div>
      </div>
    );
  };

  const renderDocPage2 = (_file: FileItem) => {
    return (
      <div id="doc-page-2" className="w-full space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 2
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            2. MONTAGE AMPLIFICATEUR NON-INVERSEUR DE TENSION
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Étude en régime linéaire avec gain strictement supérieur ou égal à 1
          </p>
        </div>

        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 flex flex-col items-center justify-center">
          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
            Schéma 2 : Montage Non-Inverseur (Signal appliqué sur l'entrée V+)
          </p>
          <svg className="w-full max-w-lg h-40" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,10 60,60 115,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
            <line x1="20" y1="47" x2="60" y2="47" stroke="#1c1917" strokeWidth="1.8" />
            <text x="12" y="50" fontSize="7" fontWeight="bold" fill="#2563eb">Ve</text>
            <text x="64" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
            <text x="64" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
            <line x1="115" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
            <line x1="45" y1="23" x2="60" y2="23" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="45" y1="23" x2="45" y2="10" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="45" y1="10" x2="125" y2="10" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="125" y1="10" x2="125" y2="35" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="75" y="6" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="81" y="12.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
            <line x1="45" y1="23" x2="45" y2="40" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="36" y="40" width="18" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="41" y="46.5" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
            <line x1="45" y1="48" x2="45" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="39" y1="58" x2="51" y2="58" stroke="#1c1917" strokeWidth="1.5" />
          </svg>
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-700 mt-2 px-2">
            <span>Formule de transfert : <strong className="text-blue-700">Vs = (1 + R2 / R1) · Ve</strong></span>
            <span>Gain en tension : <strong className="text-blue-700">Av = 1 + R2 / R1 (Av ≥ 1)</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p className="font-bold text-stone-900 text-sm">Caractéristiques essentielles :</p>
          <p>
            Le signal de sortie <strong>Vs</strong> est en phase exacte avec la tension d'entrée <strong>Ve</strong> (pas d'inversion de polarité).
            L'impédance d'entrée vue par le générateur est celle de la borne positive de l'AOP, soit une impédance virtuellement infinie (&gt; 10¹² Ω).
          </p>
          <p>
            <strong>Cas limite remarquable :</strong> Si l'on court-circuite R2 (R2 = 0) et qu'on supprime R1 (R1 → ∞), on obtient le <strong>montage suiveur (buffer)</strong> avec <em>Vs = Ve</em> et <em>Av = 1</em>.
          </p>
        </div>
      </div>
    );
  };

  const renderDocPage3 = (_file: FileItem) => {
    return (
      <div id="doc-page-3" className="w-full space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 3
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            3. MONTAGE SOMMATEUR INVERSEUR ANALOGIQUE
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Addition algébrique et pondération de multiples sources de signaux
          </p>
        </div>

        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 flex flex-col items-center justify-center">
          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
            Schéma 3 : Sommateur Inverseur à 2 voies indépendantes (V1, V2)
          </p>
          <svg className="w-full max-w-lg h-40" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="65,10 65,60 120,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
            <text x="69" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
            <text x="69" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
            <line x1="15" y1="17" x2="35" y2="17" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="25" y="13" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="29" y="19.5" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
            <text x="8" y="20" fontSize="7" fontWeight="bold" fill="#16a34a">V1</text>
            <line x1="15" y1="31" x2="35" y2="31" stroke="#1c1917" strokeWidth="1.5" />
            <rect x="25" y="27" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="29" y="33.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
            <text x="8" y="34" fontSize="7" fontWeight="bold" fill="#16a34a">V2</text>
            <line x1="41" y1="17" x2="52" y2="24" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="41" y1="31" x2="52" y2="24" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="52" y1="24" x2="65" y2="24" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="55" y1="24" x2="55" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="55" y1="7" x2="135" y2="7" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="135" y1="7" x2="135" y2="35" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="120" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
            <rect x="85" y="3" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
            <text x="91" y="9.5" fontSize="6" fontWeight="bold" fill="#1c1917">Rf</text>
            <line x1="65" y1="47" x2="50" y2="47" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="50" y1="47" x2="50" y2="58" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="44" y1="58" x2="56" y2="58" stroke="#1c1917" strokeWidth="1.5" />
          </svg>
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-700 mt-2 px-2">
            <span>Formule générale : <strong className="text-purple-700">Vs = - [ (Rf / R1)·V1 + (Rf / R2)·V2 ]</strong></span>
            <span>Si R1 = R2 = Rf : <strong className="text-purple-700">Vs = -(V1 + V2)</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p className="font-bold text-stone-900 text-sm">Applications industrielles et audio :</p>
          <p>
            Chaque voie d'entrée apporte un courant <em>I_k = V_k / R_k</em> vers le point de masse virtuelle.
            La somme de ces courants converge directement dans la résistance de contre-réaction <strong>Rf</strong>.
          </p>
          <p>
            Ce montage constitue la brique de base fondamentale des tables de mixage analogiques professionnelles et des convertisseurs numérique-analogique (CNA).
          </p>
        </div>
      </div>
    );
  };

  const renderDocPage4 = (_file: FileItem) => {
    return (
      <div id="doc-page-4" className="w-full space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
          </div>
          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
            StudyCloud Drive • Page 4
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
            4. MONTAGE SOUSTRACTEUR (DIFFÉRENTIEL) & SYNTHÈSE DES FORMULES
          </h2>
          <p className="text-xs text-stone-600 font-bold">
            Amplificateur d'instrumentation élémentaire et récapitulatif
          </p>
        </div>

        <div className="w-full bg-stone-50 rounded-xl p-4 sm:p-6 border border-stone-200 space-y-3">
          <p className="text-[11px] font-black text-stone-700">
            Tableau récapitulatif des montages linéaires à AOP :
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-stone-300">
              <thead className="bg-stone-200 text-stone-800 font-bold">
                <tr>
                  <th className="p-2 border border-stone-300">Montage</th>
                  <th className="p-2 border border-stone-300">Formule de Sortie (Vs)</th>
                  <th className="p-2 border border-stone-300">Impédance d'entrée</th>
                  <th className="p-2 border border-stone-300">Déphasage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-700">
                <tr>
                  <td className="p-2 font-bold">Inverseur</td>
                  <td className="p-2 text-red-700 font-bold">Vs = -(R2/R1)·Ve</td>
                  <td className="p-2">R1</td>
                  <td className="p-2">180° (Inversé)</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold">Non-Inverseur</td>
                  <td className="p-2 text-blue-700 font-bold">Vs = (1 + R2/R1)·Ve</td>
                  <td className="p-2">Infinie (∞)</td>
                  <td className="p-2">0° (En phase)</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold">Suiveur</td>
                  <td className="p-2 text-emerald-700 font-bold">Vs = Ve</td>
                  <td className="p-2">Infinie (∞)</td>
                  <td className="p-2">0° (En phase)</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold">Différentiel</td>
                  <td className="p-2 text-purple-700 font-bold">Vs = (R2/R1)·(V2 - V1)</td>
                  <td className="p-2">R1 + R3</td>
                  <td className="p-2">Selon entrées</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1.5 text-xs text-emerald-950">
          <p className="font-black text-emerald-900">Exercice d'application résolu :</p>
          <p>
            Soit un montage amplificateur inverseur avec <strong>R1 = 10 kΩ</strong> et <strong>R2 = 47 kΩ</strong>.
            Pour une tension d'entrée <em>Ve = +200 mV</em>, déterminez le gain et la tension de sortie :
          </p>
          <p className="font-bold text-emerald-800">
            • Gain en tension : Av = - (47 / 10) = -4,7<br />
            • Tension de sortie : Vs = -4,7 × (+200 mV) = -940 mV = -0,94 V.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between text-[10px] text-stone-500 font-bold border-t border-stone-200">
          <span>Certifié conforme CME • Espace Numérique StudyCloud</span>
          <span>Fin du document • 4 / 4 pages</span>
        </div>
      </div>
    );
  };

  // =========================================================================
  // MODAL DE VERROUILLAGE / CODE PIN DU DOSSIER SÉCURISÉ (Demandé : > 4 caractères)
  // =========================================================================
  const renderSecureFolderLockScreen = () => {
    const isInsideSecureView = (currentSubView?.id === 'studycloud-collection-secure-folder' || (isCloudView && cloudActiveTab === 'secure-folder'));
    if (!isPinModalOpen && (!isInsideSecureView || isSecureFolderUnlocked)) return null;

    const hasPin = Boolean(localStorage.getItem('studycloud_secure_folder_pin'));

    const content = (
      <div 
        className="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={handleCloseSecureFolderPinModal}
      >
        <div 
          className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#090D16] border border-amber-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.15)] flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Bouton Croix (X) pour fermer/annuler comme expressément demandé */}
          <button
            type="button"
            onClick={handleCloseSecureFolderPinModal}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/25 via-amber-600/15 to-transparent border border-amber-500/40 text-amber-400 flex items-center justify-center mb-5 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            {hasPin ? "Dossier Sécurisé Verrouillé" : "Définir votre code de sécurité"}
          </h3>

          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xs">
            {hasPin 
              ? "Veuillez saisir votre code secret pour accéder à vos fichiers protégés." 
              : "Pour sécuriser vos fichiers, définissez un code secret. Le code doit comporter plus de 4 caractères."}
          </p>

          <form onSubmit={handleUnlockSecureFolder} className="w-full mt-6 space-y-4">
            <div className="w-full text-left">
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                {hasPin ? "Code secret" : "Nouveau code (supérieur à 4 caractères)"}
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPinPassword ? "text" : "password"}
                  value={securePinInput}
                  onChange={(e) => {
                    setSecurePinInput(e.target.value);
                    setSecurePinError(null);
                  }}
                  placeholder={hasPin ? "Entrez votre code..." : "Au moins 5 caractères..."}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-sm tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPinPassword(!showPinPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showPinPassword ? "Masquer le code" : "Afficher le code"}
                >
                  {showPinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!hasPin && (
              <div className="w-full text-left">
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Confirmer le code
                </label>
                <input
                  type={showPinPassword ? "text" : "password"}
                  value={securePinConfirmInput}
                  onChange={(e) => {
                    setSecurePinConfirmInput(e.target.value);
                    setSecurePinError(null);
                  }}
                  placeholder="Retapez le code..."
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-sm tracking-wider"
                />
              </div>
            )}

            {securePinError && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{securePinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:via-amber-500 hover:to-orange-500 text-black font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>{hasPin ? "Déverrouiller le dossier" : "Enregistrer et déverrouiller"}</span>
            </button>
          </form>
        </div>
      </div>
    );

    return createPortal(content, document.body);
  };

  // =========================================================================
  // MODAL DE CHANGEMENT DE CODE PIN (Image 2)
  // =========================================================================
  const renderChangePinModal = () => {
    if (!isChangePinModalOpen) return null;
    const hasPin = Boolean(localStorage.getItem('studycloud_secure_folder_pin'));

    return (
      <div 
        className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setIsChangePinModalOpen(false)}
      >
        <div 
          className="w-full max-w-md bg-[#090D16] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col text-left text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <KeyRound className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">Changer de code</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Dossier Sécurisé StudyCloud</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsChangePinModalOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleChangePin} className="mt-4 space-y-3.5">
            {hasPin && (
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Ancien code
                </label>
                <input
                  type="password"
                  value={oldPinInput}
                  onChange={(e) => {
                    setOldPinInput(e.target.value);
                    setChangePinError(null);
                  }}
                  placeholder="Entrez votre code actuel..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-xs sm:text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Nouveau code (supérieur à 4 caractères)
              </label>
              <input
                type="password"
                value={newPinInput}
                onChange={(e) => {
                  setNewPinInput(e.target.value);
                  setChangePinError(null);
                }}
                placeholder="Au moins 5 caractères..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-xs sm:text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Le code doit comporter plus de 4 caractères (ex. 5 chiffres, lettres ou symboles).
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Confirmer le nouveau code
              </label>
              <input
                type="password"
                value={newPinConfirmInput}
                onChange={(e) => {
                  setNewPinConfirmInput(e.target.value);
                  setChangePinError(null);
                }}
                placeholder="Retapez le nouveau code..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-xs sm:text-sm"
              />
            </div>

            {changePinError && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{changePinError}</span>
              </div>
            )}

            {changePinSuccess && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{changePinSuccess}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsChangePinModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Enregistrer le nouveau code
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // =========================================================================
  // MODAL GRAND FORMAT : CRÉER UN DOSSIER (VIDE & ÉTIRÉ HORIZONTALEMENT)
  // Sans fond flou ni sombre (comme expressément demandé par l'utilisateur)
  // =========================================================================
  // MODAL GRAND FORMAT : CRÉER UN DOSSIER (4 MODÈLES 3D LUMINEUX À L'IDENTIQUE)
  // Sans fond flou ni sombre (comme expressément demandé par l'utilisateur)
  // =========================================================================
  const renderCreateFolderModal = () => {
    if (!isCreateFolderModalOpen) return null;

    // Changement d'onglet avec désélection immédiate du modèle précédent
    const handleTabSwitch = (newTab: 'all' | '1' | '2' | '3' | '4') => {
      setCreateFolderActiveTab(newTab);
      // Décocher le modèle précédemment sélectionné comme demandé
      setSelectedFolderModelItem(null);
      setCustomFolderColor(null);
      setIsColorPickerOpen(false);
      setNewFolderNameInput('');
    };

    const handleSelectModelItem = (item: FolderModelItem) => {
      // Re-clic sur le même modèle : le désélectionne
      if (selectedFolderModelItem?.id === item.id) {
        setSelectedFolderModelItem(null);
        setCustomFolderColor(null);
        setIsColorPickerOpen(false);
        setNewFolderNameInput('');
        return;
      }
      setSelectedFolderModelItem(item);
      setCustomFolderColor(null); // Réinitialise sur la couleur d'origine au nouveau choix
      setIsColorPickerOpen(false);
      setNewFolderNameInput(item.title || item.badge || 'Nouveau dossier');
    };

    const handleCreateFolderSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!selectedFolderModelItem) return;

      const folderName = newFolderNameInput.trim() || selectedFolderModelItem.title || selectedFolderModelItem.badge || 'Nouveau dossier';
      const chosenColor = customFolderColor || selectedFolderModelItem.primaryColor;
      const realCurrentDate = getDynamicCurrentDate();

      let dateForModel = realCurrentDate.model1;
      if (selectedFolderModelItem.model === 2) dateForModel = realCurrentDate.model2;
      else if (selectedFolderModelItem.model === 3) dateForModel = realCurrentDate.model3;
      else if (selectedFolderModelItem.model === 4) dateForModel = realCurrentDate.model4;

      const created3DFolder: ClasseurCreatedFolder = {
        id: `c3d-${Date.now()}`,
        name: folderName,
        model: selectedFolderModelItem.model,
        primaryColor: chosenColor,
        secondaryColor: selectedFolderModelItem.secondaryColor,
        badge: selectedFolderModelItem.badge,
        iconType: selectedFolderModelItem.iconType,
        textDark: selectedFolderModelItem.textDark,
        dateText: dateForModel,
        createdAt: Date.now(),
        parentId: subFolderParentId || undefined,
        positionX: 0,
        positionY: 0,
        displayOrder: 0,
        zoomLevel: folderZoomLevel
      };

      // Nouveaux dossiers créés toujours en haut par défaut (index 0)
      setClasseur3DFolders(prev => [created3DFolder, ...prev]);
      CloudStorageAPI.saveClasseurFolder(created3DFolder).catch(() => {});
      
      const newFolder = {
        id: `folder-${Date.now()}`,
        name: folderName,
        count: '0 module • 0 cours',
        iconColor: selectedFolderModelItem.model === 3 ? 'text-cyan-400' : 'text-orange-400',
        badge: selectedFolderModelItem.badge || `Modèle ${selectedFolderModelItem.model}`,
        modelType: selectedFolderModelItem.model,
        bgColor: chosenColor,
        creationDate: realCurrentDate.full,
      };

      setClasseurFolders(prev => [newFolder, ...prev]);
      setFolderCreationToast(`Dossier "${folderName}" créé avec succès !`);
      setTimeout(() => {
        setIsCreateFolderModalOpen(false);
        setSubFolderParentId(null);
        setFolderCreationToast(null);
        setSelectedFolderModelItem(null);
        setCustomFolderColor(null);
        setIsColorPickerOpen(false);
      }, 700);
    };

    const activeDisplayColor = selectedFolderModelItem 
      ? (customFolderColor || selectedFolderModelItem.primaryColor)
      : '#E76239';

    const content = (
      <div 
        className="fixed inset-0 z-[2500] bg-black/20 backdrop-blur-none flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 pointer-events-auto"
        onClick={() => {
          setIsCreateFolderModalOpen(false);
          setIsColorPickerOpen(false);
          setCustomFolderColor(null);
        }}
      >
        <div 
          className="relative w-[98%] max-w-6xl h-[88vh] max-h-[850px] bg-[#0A0F1D] border-2 border-orange-500/40 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
          onClick={(e) => {
            e.stopPropagation();
            if (isColorPickerOpen) setIsColorPickerOpen(false);
          }}
        >
          {/* En-tête : Titre, Bouton Couleur (quand sélectionné) et Croix de fermeture */}
          <div className="px-5 sm:px-7 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-[#070B14] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] text-white flex items-center justify-center shadow-[0_2px_12px_rgba(194,84,22,0.4)] border border-orange-400/40">
                <FolderPlus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                  Créer un dossier
                </h3>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Choisissez parmi les 4 modèles 3D ultra-lumineux et personnalisez votre dossier
                </p>
              </div>
            </div>

            {/* Boutons d'actions à droite : Couleur (si sélectionné) + Croix de fermeture */}
            <div className="flex items-center gap-3 sm:gap-4 relative">
              {/* Bouton Couleur qui apparaît uniquement lorsqu'un dossier est sélectionné */}
              {selectedFolderModelItem && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsColorPickerOpen(prev => !prev);
                    }}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 animate-in fade-in zoom-in-90 ${
                      isColorPickerOpen
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black border-orange-400 ring-2 ring-orange-400/50'
                        : 'bg-white/10 hover:bg-white/15 text-white border-white/20 hover:border-orange-400/50'
                    }`}
                    title="Changer la couleur du dossier sélectionné"
                  >
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0 transition-colors"
                      style={{ backgroundColor: activeDisplayColor }}
                    />
                    <Palette className="w-4 h-4 stroke-[2.2] text-orange-300" />
                    <span className="hidden sm:inline">Couleur</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isColorPickerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Menu Popover des Couleurs ("un millier de couleur") */}
                  {isColorPickerOpen && (
                    <div 
                      className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#0E1526] border-2 border-orange-500/40 rounded-3xl p-4 shadow-[0_25px_50px_rgba(0,0,0,0.85)] z-[3000] text-white animate-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header du Popover */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-orange-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-white">
                            Palette de Couleurs
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsColorPickerOpen(false)}
                          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Spectre de couleur complet (Pipette / Input couleur native pour 16,7 millions de teintes) */}
                      <div className="mt-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            value={activeDisplayColor}
                            onChange={(e) => setCustomFolderColor(e.target.value)}
                            className="w-8 h-8 rounded-xl cursor-pointer border-0 bg-transparent p-0 overflow-hidden shadow-inner"
                            title="Sélectionner n'importe quelle couleur dans le spectre complet"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-white">Nuance personnalisée</div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase">
                              {activeDisplayColor}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                          16M de couleurs
                        </span>
                      </div>

                      {/* Sélection rapide : 24 teintes vibrantes, néons et pastels 3D */}
                      <div className="mt-3.5">
                        <div className="text-[11px] font-bold text-slate-400 mb-2">
                          Teintes recommandées & 3D :
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {[
                            // Néons & Éclatants
                            '#FF3366', '#FF6D00', '#FFC400', '#00E676', '#18B2DC', '#7E57C2',
                            // Pastels & Doux
                            '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E8D7FF',
                            // Profonds & Électriques
                            '#D500F9', '#3D5AFE', '#00B0FF', '#00C853', '#FFAB00', '#DD2C00',
                            // Designer Chic
                            '#63555F', '#7D6575', '#786F64', '#A19182', '#293B49', '#8DC9F6',
                          ].map((hexColor) => {
                            const isActive = activeDisplayColor.toLowerCase() === hexColor.toLowerCase();
                            return (
                              <button
                                key={hexColor}
                                type="button"
                                onClick={() => setCustomFolderColor(hexColor)}
                                className={`w-full aspect-square rounded-xl transition-all cursor-pointer relative shadow-sm hover:scale-110 active:scale-95 ${
                                  isActive ? 'ring-2 ring-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.7)]' : 'border border-white/20'
                                }`}
                                style={{ backgroundColor: hexColor }}
                                title={hexColor}
                              >
                                {isActive && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 stroke-[3] text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions du popover */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomFolderColor(null)}
                          className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
                        >
                          Couleur d'origine
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsColorPickerOpen(false)}
                          className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs transition-all cursor-pointer active:scale-95 shadow-md"
                        >
                          Valider
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bouton Croix Fermer */}
              <button
                type="button"
                onClick={() => {
                  setIsCreateFolderModalOpen(false);
                  setIsColorPickerOpen(false);
                  setCustomFolderColor(null);
                  setSelectedFolderModelItem(null);
                }}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Fermer"
              >
                <X className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Barre de navigation des 4 modèles */}
          <div className="px-4 sm:px-7 py-2.5 bg-[#0C1222] border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => handleTabSwitch('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                createFolderActiveTab === 'all'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <span>🌟 Tous (4 Modèles)</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                createFolderActiveTab === 'all' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}>
                34
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('1')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                createFolderActiveTab === '1'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <span>📁 Modèle 1 : Index Pastel</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                createFolderActiveTab === '1' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}>
                12
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('2')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                createFolderActiveTab === '2'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <span>🎨 Modèle 2 : Bicolore Écolier</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                createFolderActiveTab === '2' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}>
                6
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('3')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                createFolderActiveTab === '3'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <span>✨ Modèle 3 : Luminous Glow 3D</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                createFolderActiveTab === '3' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}>
                8
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('4')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                createFolderActiveTab === '4'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <span>🏷️ Modèle 4 : Nuancier Designer</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                createFolderActiveTab === '4' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}>
                8
              </span>
            </button>
          </div>

          {/* Corps de la modal : Grille des 4 modèles 3D ultra-lumineux */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:px-8 space-y-8">
            {/* Notification de création réussie */}
            {folderCreationToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <Check className="w-5 h-5 stroke-[3] text-emerald-400 shrink-0" />
                  <span className="font-bold text-sm">{folderCreationToast}</span>
                </div>
              </div>
            )}

            {/* SECTION MODÈLE 1 */}
            {(createFolderActiveTab === 'all' || createFolderActiveTab === '1') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 font-black text-xs border border-orange-500/30">
                      MODÈLE 1
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      Onglets Index Pastel & Biseaux 3D
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    12 déclinaisons
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {MODEL_1_FOLDERS.map((item) => (
                    <Folder3DCard
                      key={item.id}
                      item={item}
                      isSelected={selectedFolderModelItem?.id === item.id}
                      customColor={selectedFolderModelItem?.id === item.id ? customFolderColor : null}
                      onSelect={handleSelectModelItem}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SECTION MODÈLE 2 */}
            {(createFolderActiveTab === 'all' || createFolderActiveTab === '2') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs border border-amber-500/30">
                      MODÈLE 2
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      Bicolore Écolier, Date en Onglet & Étiquettes Matières
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    6 déclinaisons
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
                  {MODEL_2_FOLDERS.map((item) => (
                    <Folder3DCard
                      key={item.id}
                      item={item}
                      isSelected={selectedFolderModelItem?.id === item.id}
                      customColor={selectedFolderModelItem?.id === item.id ? customFolderColor : null}
                      onSelect={handleSelectModelItem}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SECTION MODÈLE 3 */}
            {(createFolderActiveTab === 'all' || createFolderActiveTab === '3') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-400 font-black text-xs border border-cyan-500/30">
                      MODÈLE 3
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      Luminous Glow Néon 3D & Étoile Lumineuse
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    8 déclinaisons
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {MODEL_3_FOLDERS.map((item) => (
                    <Folder3DCard
                      key={item.id}
                      item={item}
                      isSelected={selectedFolderModelItem?.id === item.id}
                      customColor={selectedFolderModelItem?.id === item.id ? customFolderColor : null}
                      onSelect={handleSelectModelItem}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SECTION MODÈLE 4 */}
            {(createFolderActiveTab === 'all' || createFolderActiveTab === '4') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-400 font-black text-xs border border-purple-500/30">
                      MODÈLE 4
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      Nuancier Designer, Date en Onglet & Typographie Serif
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    8 déclinaisons
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {MODEL_4_FOLDERS.map((item) => (
                    <Folder3DCard
                      key={item.id}
                      item={item}
                      isSelected={selectedFolderModelItem?.id === item.id}
                      customColor={selectedFolderModelItem?.id === item.id ? customFolderColor : null}
                      onSelect={handleSelectModelItem}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barre inférieure fixe : Sélection & Création personnalisée */}
          <div className="px-4 sm:px-7 py-3.5 bg-[#070B14] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Aperçu du modèle actif */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {selectedFolderModelItem ? (
                <>
                  <div 
                    className="w-10 h-8 rounded-lg shadow-md flex items-center justify-center text-xs font-black border border-white/20 shrink-0 transition-colors"
                    style={{ 
                      backgroundColor: activeDisplayColor,
                      color: selectedFolderModelItem.textDark ? '#111827' : '#FFFFFF'
                    }}
                  >
                    M{selectedFolderModelItem.model}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>Modèle {selectedFolderModelItem.model}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-orange-400 truncate">{selectedFolderModelItem.title || selectedFolderModelItem.badge}</span>
                      {customFolderColor && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-orange-500/20 text-orange-300 font-mono">
                          {customFolderColor.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Prêt pour la création • Personnalisez la couleur en haut à droite
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-8 rounded-lg shadow-md flex items-center justify-center text-xs font-black border border-white/20 shrink-0 bg-white/5 text-slate-400">
                    📁
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-black text-slate-300">
                      Aucun modèle sélectionné
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Cliquez sur un modèle ci-dessus pour le sélectionner et le personnaliser
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Formulaire de saisie du nom & validation */}
            <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-2.5 w-full sm:w-auto">
              <input
                type="text"
                value={newFolderNameInput}
                onChange={(e) => setNewFolderNameInput(e.target.value)}
                placeholder={selectedFolderModelItem ? "Nom du dossier..." : "Sélectionnez un modèle ci-dessus..."}
                disabled={!selectedFolderModelItem}
                className="px-3.5 py-2 bg-white/5 border border-white/15 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 w-full sm:w-64 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!selectedFolderModelItem}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all active:scale-95 shrink-0 ${
                  selectedFolderModelItem
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black shadow-[0_4px_16px_rgba(249,115,22,0.4)] cursor-pointer'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/10'
                }`}
              >
                <FolderPlus className="w-4 h-4 stroke-[2.5]" />
                <span>Créer ce dossier</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );

    return createPortal(content, document.body);
  };

  // =========================================================================
  // MODAL DE PROPOSITION : DÉPLACER OU CRÉER UNE COPIE ?
  // =========================================================================
  const renderTransferPromptModal = () => {
    if (!isTransferPromptOpen) return null;

    const count = itemsToTransfer.length;
    const titleText = count === 1 
      ? `Que souhaitez-vous faire avec "${itemsToTransfer[0]?.name}" ?`
      : `Que souhaitez-vous faire avec ces ${count} éléments ?`;

    const content = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 pointer-events-auto"
        onClick={() => setIsTransferPromptOpen(false)}
      >
        <div 
          className="relative w-full max-w-[420px] bg-[#0A0F1D] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.1)] text-white animate-in zoom-in-95 duration-150 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner shrink-0">
                <FolderInput className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-white leading-tight">Déplacer ou Copier</h3>
                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5" title={titleText}>
                  {titleText}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsTransferPromptOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Choix 1 : Déplacer */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => {
                setTransferMode('move');
                setIsTransferPromptOpen(false);
                setIsTransferModalOpen(true);
                CloudStorageAPI.getClasseurFolders().then(folders => {
                  if (folders && Array.isArray(folders)) setClasseur3DFolders(folders);
                }).catch(() => {});
              }}
              className="group p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/60 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-md active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FolderInput className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-amber-200 group-hover:text-amber-100">Déplacer</span>
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    Retiré d'ici
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Transfère {count > 1 ? 'ces fichiers' : 'ce fichier'} vers le(s) dossier(s) choisi(s) et l'efface de son emplacement d'origine.
                </p>
              </div>
            </button>

            {/* Choix 2 : Créer une copie */}
            <button
              type="button"
              onClick={() => {
                setTransferMode('copy');
                setIsTransferPromptOpen(false);
                setIsTransferModalOpen(true);
                CloudStorageAPI.getClasseurFolders().then(folders => {
                  if (folders && Array.isArray(folders)) setClasseur3DFolders(folders);
                }).catch(() => {});
              }}
              className="group p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/60 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-md active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Copy className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-emerald-200 group-hover:text-emerald-100">Créer une copie</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Conserve l'original
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Garde l'original intact dans ce menu et ajoute une nouvelle copie dans le(s) dossier(s) choisi(s).
                </p>
              </div>
            </button>
          </div>

          {/* Bouton Annuler */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsTransferPromptOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
  };

  // =========================================================================
  // MODAL DE SÉLECTION DU DOSSIER RÉCEPTEUR
  // =========================================================================
  const renderTransferFolderModal = () => {
    if (!isTransferModalOpen) return null;

    let displayedFolders = classeur3DFolders;
    if (transferSearchQuery.trim()) {
      const q = transferSearchQuery.trim().toLowerCase();
      displayedFolders = classeur3DFolders.filter(f => f.name.toLowerCase().includes(q));
    } else if (transferNavFolderId) {
      displayedFolders = classeur3DFolders.filter(f => f.parentId === transferNavFolderId);
    } else {
      displayedFolders = classeur3DFolders.filter(f => !f.parentId);
    }

    const currentNavFolder = transferNavFolderId ? classeur3DFolders.find(f => f.id === transferNavFolderId) : null;
    const parentNavFolder = currentNavFolder?.parentId ? classeur3DFolders.find(f => f.id === currentNavFolder.parentId) : null;

    const toggleFolderCheck = (folderId: string) => {
      setTransferSelectedFolderIds(prev => 
        prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
      );
    };

    const handleExecuteTransfer = async () => {
      if (transferSelectedFolderIds.length === 0 || itemsToTransfer.length === 0 || isTransferring) return;
      setIsTransferring(true);

      try {
        await CloudStorageAPI.moveOrCopyItems(itemsToTransfer, transferSelectedFolderIds, transferMode);

        setFolderFilesMap(prev => {
          const next = { ...prev };
          for (const targetFolderId of transferSelectedFolderIds) {
            const existing = next[targetFolderId] || [];
            const newFiles = itemsToTransfer.map(item => ({
              ...item,
              id: transferMode === 'move' ? item.id : `cfile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              originalFolderId: targetFolderId,
            }));
            next[targetFolderId] = [...newFiles, ...existing];
          }
          return next;
        });

        if (transferMode === 'move') {
          const idsToRemove = new Set(itemsToTransfer.map(i => i.id));
          setDocumentsList(prev => prev.filter(d => !idsToRemove.has(d.id)));
          setImagesList(prev => prev.filter(img => !idsToRemove.has(img.id)));
          setVideosList(prev => prev.filter(v => !idsToRemove.has(v.id)));
          setAudioList(prev => prev.filter(a => !idsToRemove.has(a.id)));
          setDownloadedItems(prev => prev.filter(dl => !idsToRemove.has(dl.id)));
          setSecureFolderFiles(prev => prev.filter(s => !idsToRemove.has(s.id)));
          setCloudRecentFiles(prev => prev.filter(c => !idsToRemove.has(c.id)));
          
          if (opened3DFolder) {
            setFolderFilesMap(prev => ({
              ...prev,
              [opened3DFolder.id]: (prev[opened3DFolder.id] || []).filter(f => !idsToRemove.has(f.id))
            }));
          }

          setSelectedItemIds(prev => prev.filter(id => !idsToRemove.has(id)));
          if (selectedItemIds.length <= itemsToTransfer.length) {
            setIsSelectionMode(false);
          }
          if (splitSelectedFile && idsToRemove.has(splitSelectedFile.id)) {
            setSplitSelectedFile(null);
          }
        }

        const successMsg = transferMode === 'move'
          ? `${itemsToTransfer.length} élément(s) déplacé(s) vers ${transferSelectedFolderIds.length} dossier(s) avec succès !`
          : `${itemsToTransfer.length} élément(s) copié(s) dans ${transferSelectedFolderIds.length} dossier(s) avec succès !`;
        showProfileToast(successMsg);

        setIsTransferModalOpen(false);
        setTransferSelectedFolderIds([]);
        setTransferNavFolderId(null);
        setTransferSearchQuery('');
        setItemsToTransfer([]);
      } catch (err: any) {
        console.error('Erreur lors du transfert:', err);
        showProfileToast('Erreur lors du traitement du transfert');
      } finally {
        setIsTransferring(false);
      }
    };

    const isSelectionActive = transferSelectedFolderIds.length > 0;

    const content = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 pointer-events-auto"
        onClick={() => {
          setIsTransferModalOpen(false);
          setTransferNavFolderId(null);
          setTransferSearchQuery('');
        }}
      >
        <div 
          className="relative w-full max-w-[440px] max-h-[82vh] bg-[#0A0F1D] border-2 border-amber-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. En-tête : Titre & Bouton de fermeture */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 bg-[#070B14] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${transferMode === 'move' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} border flex items-center justify-center`}>
                {transferMode === 'move' ? <FolderInput className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                {transferMode === 'move' ? 'Déplacer vers un dossier' : 'Créer une copie dans...'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferNavFolderId(null);
                setTransferSearchQuery('');
              }}
              className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Barre de recherche et compteurs */}
          <div className="p-3.5 border-b border-white/10 bg-[#0E1526] space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={transferSearchQuery}
                onChange={(e) => setTransferSearchQuery(e.target.value)}
                placeholder="Trouver un dossier rapidement..."
                className="w-full bg-[#0A0F1D] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {transferSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTransferSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compteurs : nombre de coches et nombre d'éléments à déplacer */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                {transferSelectedFolderIds.length} dossier{transferSelectedFolderIds.length > 1 ? 's' : ''} coché{transferSelectedFolderIds.length > 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-semibold flex items-center gap-1.5">
                {itemsToTransfer.length} élément{itemsToTransfer.length > 1 ? 's' : ''} à {transferMode === 'move' ? 'déplacer' : 'copier'}
              </span>
            </div>

            {/* 3. Fil d'Ariane / Navigation dans les dossiers */}
            {!transferSearchQuery && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-xs overflow-x-auto no-scrollbar">
                {transferNavFolderId && (
                  <button
                    type="button"
                    onClick={() => setTransferNavFolderId(currentNavFolder?.parentId || null)}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Retour"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">Retour</span>
                  </button>
                )}
                
                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                  {/* Nom du dossier principal en transparent / estompé */}
                  {parentNavFolder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setTransferNavFolderId(parentNavFolder.id)}
                        className="text-[11px] font-semibold text-white/40 hover:text-white/60 truncate cursor-pointer transition-colors"
                        title={parentNavFolder.name}
                      >
                        {parentNavFolder.name}
                      </button>
                      <span className="text-white/30 text-xs">/</span>
                    </>
                  ) : currentNavFolder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setTransferNavFolderId(null)}
                        className="text-[11px] font-semibold text-white/40 hover:text-white/60 truncate cursor-pointer transition-colors"
                      >
                        Classeur
                      </button>
                      <span className="text-white/30 text-xs">/</span>
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">Racine du Classeur</span>
                  )}

                  {/* Nom du dossier actuel bien visible avec sa couleur */}
                  {currentNavFolder && (
                    <span
                      className="text-[11px] font-black px-2 py-0.5 rounded-md border truncate shadow-xs"
                      style={{
                        color: currentNavFolder.primaryColor || '#F59E0B',
                        borderColor: `${currentNavFolder.primaryColor || '#F59E0B'}40`,
                        backgroundColor: `${currentNavFolder.primaryColor || '#F59E0B'}15`
                      }}
                    >
                      {currentNavFolder.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Liste verticale des dossiers */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[220px] max-h-[380px]">
            {displayedFolders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <FolderArchive className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Aucun dossier trouvé</p>
                <p className="text-[11px] text-slate-500">
                  {transferSearchQuery ? 'Aucun résultat pour cette recherche' : 'Ce dossier ne contient aucun sous-dossier'}
                </p>
              </div>
            ) : (
              displayedFolders.map(folder => {
                const isChecked = transferSelectedFolderIds.includes(folder.id);
                const subCount = classeur3DFolders.filter(f => f.parentId === folder.id).length;

                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      if (!transferSearchQuery) {
                        setTransferNavFolderId(folder.id);
                      }
                    }}
                    className={`group flex items-center justify-between gap-2.5 p-2.5 rounded-2xl transition-all border cursor-pointer ${
                      isChecked
                        ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Bouton carré à cocher une à une (devant le logo) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFolderCheck(folder.id);
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white shrink-0 cursor-pointer"
                        title={isChecked ? 'Décocher ce dossier' : 'Cocher ce dossier'}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400 hover:text-white" />
                        )}
                      </button>

                      {/* Logo / Forme miniature du dossier */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border"
                        style={{
                          backgroundColor: folder.primaryColor || '#E76239',
                          borderColor: lightenColor(folder.primaryColor || '#E76239', 20),
                          color: folder.textDark ? '#0F172A' : '#FFFFFF'
                        }}
                      >
                        <FolderArchive className="w-4 h-4 stroke-[2.2]" />
                      </div>

                      {/* Nom du dossier */}
                      <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-200 transition-colors">
                        {folder.name}
                      </span>
                    </div>

                    {/* Écriture à la fin du nom pour dire s'il contient un sous-dossier et le nombre */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {subCount > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] sm:text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {subCount} sous-dossier{subCount > 1 ? 's' : ''}
                          </span>
                          {!transferSearchQuery && (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 transition-colors" />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 px-1">
                          0 sous-dossier
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 5. Bouton en bas qui s'active quand on coche */}
          <div className="p-3.5 border-t border-white/10 bg-[#070B14] shrink-0 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferNavFolderId(null);
                setTransferSearchQuery('');
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={!isSelectionActive || isTransferring}
              onClick={handleExecuteTransfer}
              className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg ${
                isSelectionActive && !isTransferring
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white cursor-pointer active:scale-95 shadow-amber-500/25'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              {isTransferring ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Traitement...</span>
                </>
              ) : isSelectionActive ? (
                <>
                  {transferMode === 'move' ? <FolderInput className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {transferMode === 'move'
                      ? `Déplacer vers ${transferSelectedFolderIds.length} dossier${transferSelectedFolderIds.length > 1 ? 's' : ''}`
                      : `Créer une copie dans ${transferSelectedFolderIds.length} dossier${transferSelectedFolderIds.length > 1 ? 's' : ''}`}
                  </span>
                </>
              ) : (
                <span>Sélectionnez un dossier</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
  };

  // =========================================================================
  // PETIT MODAL POUR NOMMER ET CRÉER UN FICHIER BLOC-NOTES (TXT)
  // Conforme à la demande : "un petit menu apparaît pour donner un nom au fichier
  // qui sera crée pour écrire dedans et quand il écrit le nom et appui créer un fichier apparaît"
  // =========================================================================
  const renderNewNoteModal = () => {
    if (!isNewNoteModalOpen) return null;

    const modalContent = (
      <div 
        className="fixed inset-0 z-[2600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
        onClick={() => setIsNewNoteModalOpen(false)}
      >
        <div 
          className="w-full max-w-sm bg-[#0E1526] border-2 border-cyan-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-inner shrink-0">
                <FileEdit className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">Nouveau document</h3>
                <p className="text-[11px] text-slate-400 font-medium">Fichier texte Bloc-notes (.txt)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNewNoteModalOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulaire */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateNewNote();
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Nom du document :
              </label>
              <input
                type="text"
                autoFocus
                value={newNoteNameInput}
                onChange={(e) => setNewNoteNameInput(e.target.value)}
                placeholder="Ex: Notes de cours, Devoir, Idées..."
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewNoteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_4px_16px_rgba(6,182,212,0.4)] transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Créer</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  // =========================================================================
  // MODAL / VUE D'ÉDITION DU BLOC-NOTES (ÉCRIRE DEDANS)
  // "pour écrire dedans et quand il écrit le nom et appui créer un fichier apparaît"
  // =========================================================================
  const renderNotepadEditorModal = () => {
    if (!activeEditingNote) return null;

    const modalContent = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150 pointer-events-auto"
        onClick={() => handleSaveAndCloseNote()}
      >
        <div 
          className="w-full max-w-4xl h-[90vh] max-h-[820px] bg-[#0A0F1D] border-2 border-cyan-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête de l'éditeur */}
          <div className="px-4 sm:px-6 py-3 bg-[#070B14] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                <FileText className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate" title={activeEditingNote.name}>
                    {activeEditingNote.name}
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                    TXT
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>Dans « {activeEditingNote.source} »</span>
                  <span>•</span>
                  {isNoteSavedIndicator ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" /> Enregistré
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold">Modifications en cours...</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Télécharger la note */}
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([noteTextContent], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = activeEditingNote.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  showToast(`"${activeEditingNote.name}" téléchargé !`);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer"
                title="Télécharger ce fichier texte"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Bouton Terminer */}
              <button
                type="button"
                onClick={handleSaveAndCloseNote}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition-all active:scale-95 cursor-pointer shadow-md flex items-center gap-1.5"
                title="Enregistrer et fermer le bloc-notes"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Terminer</span>
              </button>
            </div>
          </div>

          {/* Zone d'écriture plein espace */}
          <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col space-y-3 bg-[#070B14]/60">
            {/* Espace Titre dédié en haut : sort en majuscules et limité à deux lignes */}
            <textarea
              value={noteTitleContent}
              rows={2}
              placeholder="TITRE DE LA NOTE (EN MAJUSCULES)..."
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                const lines = val.split('\n');
                const limitedVal = lines.slice(0, 2).join('\n');
                setNoteTitleContent(limitedVal);
                setIsNoteSavedIndicator(false);
                handleUpdateNoteContent(noteTextContent, limitedVal);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const currentLines = noteTitleContent.split('\n');
                  if (currentLines.length >= 2) e.preventDefault();
                }
              }}
              className="w-full uppercase font-black text-sm sm:text-base md:text-lg text-cyan-300 placeholder:text-slate-500 placeholder:normal-case bg-transparent border-b border-white/10 pb-2 outline-none resize-none tracking-wide break-all [overflow-wrap:anywhere] [word-break:break-word] leading-snug selection:bg-cyan-500/30"
              style={{ maxHeight: '4.2rem', lineHeight: '1.4' }}
            />

            <textarea
              autoFocus
              value={noteTextContent}
              onChange={(e) => {
                const newText = e.target.value;
                setNoteTextContent(newText);
                setIsNoteSavedIndicator(false);
                handleUpdateNoteContent(newText, noteTitleContent);
              }}
              placeholder="Écrivez vos notes, cours ou réflexions ici..."
              className="w-full flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm md:text-base leading-relaxed resize-none outline-none font-sans no-scrollbar break-all [overflow-wrap:anywhere] [word-break:break-word]"
            />
          </div>

          {/* Barre de statut inférieure */}
          <div className="px-4 sm:px-6 py-2 bg-[#070B14] border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span>{noteTextContent.length} caractères</span>
              <span>•</span>
              <span>{noteTextContent.trim() ? noteTextContent.trim().split(/\s+/).length : 0} mots</span>
              <span>•</span>
              <span>{noteTextContent.split('\n').length} lignes</span>
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Sauvegardé automatiquement dans le dossier
            </span>
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };



  return (
    <div className={`transition-colors duration-300 bg-[#F4F6F8] dark:bg-[#0C111D] text-stone-900 dark:text-slate-100 flex flex-col overflow-y-auto selection:bg-blue-600 selection:text-white ${
      isFullscreen
        ? 'fixed inset-0 z-[1000] w-screen h-screen'
        : 'fixed top-[64px] md:top-[68px] bottom-0 left-0 md:left-64 right-0 z-30 min-h-[calc(100vh-68px)]'
    }`}>
      
      {/* Input de sélection de fichier caché pour l'Accueil (mode auto) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleHomeFileSelected}
        multiple
        className="hidden"
      />

      {/* Input de sélection de fichier caché pour les sous-menus spécifiques (validation stricte) */}
      <input
        type="file"
        ref={categoryFileInputRef}
        accept={menuImportConfig?.accept}
        onChange={handleMenuFileSelected}
        multiple
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* SI UN SOUS-MENU EST OUVERT : NAVIGATION & AFFICHAGE                       */}
      {/* ========================================================================= */}
      {currentSubView ? (
        <div className="flex-1 flex flex-col w-full animate-in fade-in duration-200 min-h-screen">
          
          {/* EN-TÊTE DU SOUS-MENU */}
          <div className={`sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-300/70 dark:border-slate-800/60 shadow-xs ${
            isViewerMaximized ? 'hidden' : ''
          }`}>
            {(opened3DFolder && !isCloudView) ? (
              /* EN-TÊTE DU DOSSIER 3D OUVERT (Conforme à l'écran 1 : Retour + Importer à gauche, Nom au milieu collé à l'en-tête sur la ligne horizontale) */
              <div className="w-full flex items-center justify-between gap-2 sm:gap-4 animate-in fade-in duration-150">
                {/* GAUCHE : Bouton Retour et Bouton Importer (style exact de Mes dossiers / Mes fichiers de l'écran 1) */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (opened3DFolder.parentId) {
                        const parent = classeur3DFolders.find(f => f.id === opened3DFolder.parentId);
                        setOpened3DFolder(parent || null);
                      } else {
                        setOpened3DFolder(null);
                      }
                      setSplitSelectedFile(null);
                      setSubSearchQuery('');
                    }}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    title={opened3DFolder.parentId ? "Retour au dossier parent" : "Retour aux dossiers du classeur"}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
                    <span>Retour</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => folderFileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    title="Importer des fichiers dans ce dossier"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
                    <span>Importer</span>
                  </button>
                </div>

                {/* MILIEU : Nom du dossier avec la couleur du dossier ouvert, et fil d'Ariane parent transparent si dossier dans un dossier */}
                <div className="flex-1 flex justify-center items-center px-1 min-w-0">
                  {opened3DFolder.parentId ? (() => {
                    const parentFolder = classeur3DFolders.find(f => f.id === opened3DFolder.parentId);
                    return (
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {parentFolder && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpened3DFolder(parentFolder);
                              setSplitSelectedFile(null);
                              setSubSearchQuery('');
                            }}
                            className="font-sans text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 px-2.5 sm:px-3 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[120px] sm:max-w-[160px] text-center cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            title={`Retourner au dossier parent « ${parentFolder.name} »`}
                          >
                            <span className="truncate">{parentFolder.name}</span>
                          </button>
                        )}
                        <span className="text-stone-400 dark:text-slate-500 font-bold select-none text-xs sm:text-sm">/</span>
                        <h1 
                          className="font-sans text-xs sm:text-sm font-bold px-3.5 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[140px] sm:max-w-[200px] md:max-w-xs text-center"
                          style={{
                            backgroundColor: opened3DFolder.primaryColor || '#FFC400',
                            color: opened3DFolder.textDark ? '#1c1917' : '#FFFFFF'
                          }}
                          title={opened3DFolder.name}
                        >
                          {opened3DFolder.name}
                        </h1>
                      </div>
                    );
                  })() : (
                    <h1 
                      className="font-sans text-xs sm:text-sm font-bold px-3.5 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate max-w-[180px] sm:max-w-xs md:max-w-md text-center"
                      style={{
                        backgroundColor: opened3DFolder.primaryColor || '#FFC400',
                        color: opened3DFolder.textDark ? '#1c1917' : '#FFFFFF'
                      }}
                      title={opened3DFolder.name}
                    >
                      {opened3DFolder.name}
                    </h1>
                  )}
                </div>

                {/* DROITE : Les 2 boutons séparés (Créer un dossier + Bloc-notes) devant le champ de recherche et plein écran */}
                <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                  {/* Bouton 1 : Créer un sous-dossier (uniquement si pas déjà dans un sous-dossier: c'est le dernier niveau) */}
                  {!opened3DFolder.parentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubFolderParentId(opened3DFolder.id);
                        setSelectedFolderModelItem(null);
                        setCustomFolderColor(null);
                        setNewFolderNameInput('');
                        setIsCreateFolderModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                      title="Créer un sous-dossier dans ce dossier"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-orange-400" />
                      <span className="hidden sm:inline">Créer un dossier</span>
                    </button>
                  )}

                  {/* Bouton 2 : Bloc-notes (ouvre un petit menu pour nommer le fichier TXT et écrire dedans) */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewNoteNameInput('');
                      setIsNewNoteModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[11px] sm:text-xs rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    title="Nouveau document Bloc-notes (.txt)"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-cyan-400" />
                    <span className="hidden sm:inline">Bloc-notes</span>
                  </button>

                  <div className="hidden sm:flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3 py-1.5 transition-all shadow-inner gap-1.5 max-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <input
                      type="text"
                      value={subSearchQuery}
                      onChange={(e) => setSubSearchQuery(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full bg-transparent text-xs text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    {subSearchQuery && (
                      <button type="button" onClick={() => setSubSearchQuery('')} className="p-0.5 text-slate-300 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                    title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet"}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
                
                {/* GAUCHE : Bouton Retour et Titre */}
                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSubView(null);
                      setOpened3DFolder(null);
                      setSubSearchQuery('');
                      setSplitSelectedFile(null);
                      setIsSecureFolderUnlocked(false);
                      setSecurePinInput('');
                      setSecurePinError(null);
                    }}
                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
                    title="Retour au gestionnaire de fichiers"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                    <span className="hidden xs:inline">Retour</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-xl bg-black border border-white/10 ${currentSubView.color}`}>
                      <currentSubView.icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 dark:text-white leading-tight">
                        {currentSubView.name}
                      </h1>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 dark:text-slate-400 leading-tight">
                        StudyCloud
                      </p>
                    </div>
                  </div>
                </div>

                {/* MILIEU : Champ de recherche */}
                <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
                  <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
                    <div className="text-white shrink-0">
                      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
                    </div>
                    <input
                      type="text"
                      value={subSearchQuery}
                      onChange={(e) => setSubSearchQuery(e.target.value)}
                      placeholder={`Rechercher dans ${currentSubView.name}...`}
                      className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    {subSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSubSearchQuery('')}
                        className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Effacer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* DROITE : Bouton Espace d'étude, Plein écran général & Bouton 3 traits d'en-tête */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* BOUTON ESPACE D'ÉTUDE DEVANT LE BOUTON ZOOM (uniquement si un élément est sélectionné comme demandé) */}
                  {Boolean(splitSelectedFile || selectedItemIds.length > 0) && (
                    <button
                      type="button"
                      onClick={() => handleOpenStudySpaceForCurrentMenu(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs font-black group animate-in fade-in duration-150"
                      title="Ouvrir l'Espace d'étude"
                    >
                      <BookOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="hidden sm:inline">Espace d'étude</span>
                    </button>
                  )}

                  {/* BOUTON CRÉER UN DOSSIER EN ORANGE DEVANT LE BOUTON ZOOM (Dans le menu Classeur, Image 2) */}
                  {(currentSubView.id === 'studycloud-classeur-classeur' || (isCloudView && cloudActiveTab === 'classeur') || currentSubView.type === 'classeur') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubFolderParentId(opened3DFolder ? opened3DFolder.id : null);
                        setIsCreateFolderModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] hover:from-[#D15C1B] hover:via-[#C55010] hover:to-[#AC430A] text-white border border-orange-500/50 shadow-[0_2px_12px_rgba(194,84,22,0.45)] hover:shadow-[0_4px_18px_rgba(194,84,22,0.6)] transition-all cursor-pointer shrink-0 active:scale-95 text-xs sm:text-sm font-bold group select-none animate-in fade-in duration-150"
                      title="Créer un nouveau dossier"
                    >
                      <FolderPlus className="w-4 h-4 stroke-[2.4] group-hover:scale-110 transition-transform text-white shrink-0" />
                      <span className="whitespace-nowrap">Créer un dossier</span>
                    </button>
                  )}

                  {/* BOUTON + IMPORTER UN FICHIER DANS LES MENUS AUTORISÉS (Prend la couleur du logo du menu) */}
                  {menuImportConfig && (
                    <button
                      type="button"
                      onClick={() => categoryFileInputRef.current?.click()}
                      className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border ${menuImportConfig.colorClass} transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black animate-in fade-in duration-150`}
                      title={menuImportConfig.title}
                    >
                      <Plus className={`w-4 h-4 ${menuImportConfig.iconColor} stroke-[2.5]`} />
                      <span className="hidden xs:inline">{menuImportConfig.fullLabel}</span>
                      <span className="xs:hidden">{menuImportConfig.label}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                    title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet"}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </button>

                  {/* Bouton 3 traits d'en-tête derrière le bouton zoom (Image 1) */}
                  <div className="relative studycloud-menu-trigger">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHeaderMenuOpen(!isHeaderMenuOpen);
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-full ${
                        isHeaderMenuOpen ? 'bg-amber-500/20 text-amber-400 border-amber-400/40' : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
                      } border transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm`}
                      title="Options d'affichage et de tri (3 traits)"
                    >
                      <Menu className="w-4 h-4 stroke-[2.2]" />
                    </button>

                    {renderHeaderOptionsMenu()}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* ========================================================================= */}
          {/* BARRE HORIZONTALE DES CATÉGORIES & COLLECTIONS ESPACE CLOUD               */}
          {/* (Exactement sur la ligne rouge tracée par l'utilisateur sous l'en-tête)    */}
          {/* Défilable horizontalement avec la souris ou au doigt (tactile)             */}
          {/* ========================================================================= */}
          {isCloudView && (
            <div className={`w-full bg-[#EAECEF] dark:bg-[#070B14] border-b border-stone-300/80 dark:border-white/10 px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 select-none ${
              isViewerMaximized ? 'hidden' : ''
            }`}>
              <div className="relative flex items-center">
                {/* Flèche gauche pour défilement rapide sur grand écran */}
                <button
                  type="button"
                  onClick={() => scrollCloudNav('left')}
                  className="hidden md:flex absolute -left-3 z-10 w-7 h-7 rounded-full bg-black/80 hover:bg-black text-white items-center justify-center border border-white/20 shadow-md cursor-pointer transition-all active:scale-90"
                  title="Défiler vers la gauche"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                </button>

                {/* Conteneur défilable et glissable horizontalement */}
                <div
                  ref={cloudNavScrollRef}
                  onMouseDown={handleNavMouseDown}
                  onMouseMove={handleNavMouseMove}
                  onMouseUp={handleNavMouseUpOrLeave}
                  onMouseLeave={handleNavMouseUpOrLeave}
                  className="w-full flex items-center gap-2.5 sm:gap-3 overflow-x-auto scrollbar-none py-1 cursor-grab active:cursor-grabbing touch-pan-x px-1"
                >
                  {/* 1. BOUTON CLASSEUR (Style Image 3, sélectionné par défaut) */}
                  <button
                    type="button"
                    onClick={() => {
                      setCloudActiveTab('classeur');
                      setSplitSelectedFile(null);
                      setOpened3DFolder(null);
                      setIsSecureFolderUnlocked(false);
                      setSecurePinInput('');
                      setSecurePinError(null);
                    }}
                    className={`shrink-0 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] hover:from-[#D15C1B] hover:via-[#C55010] hover:to-[#AC430A] text-white border border-orange-500/40 transition-all duration-200 cursor-pointer active:scale-95 shadow-md ${
                      cloudActiveTab === 'classeur'
                        ? 'ring-2 ring-orange-300 ring-offset-2 ring-offset-[#070B14] shadow-[0_4px_20px_rgba(194,84,22,0.55)] scale-[1.02]'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    title="Classeur"
                  >
                    <div className="p-1.5 sm:p-2 rounded-xl bg-black/40 border border-white/20 shrink-0">
                      <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.2]" />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                      Classeur
                    </span>
                  </button>

                  {/* 2. BOUTONS CATÉGORIES & COLLECTIONS (Image 2, SANS le bouton Espace Cloud) */}
                  {cloudNavItems.map(item => {
                    const isSelected = cloudActiveTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setOpened3DFolder(null);
                          if (item.id === 'secure-folder') {
                            if (isSecureFolderUnlocked) {
                              setCloudActiveTab(item.id);
                              setSplitSelectedFile(null);
                            } else {
                              setPinTargetDestination('cloud-tab');
                              setIsPinModalOpen(true);
                              setSecurePinInput('');
                              setSecurePinConfirmInput('');
                              setSecurePinError(null);
                            }
                            return;
                          }
                          setCloudActiveTab(item.id);
                          setSplitSelectedFile(null);
                          setIsSecureFolderUnlocked(false);
                          setSecurePinInput('');
                          setSecurePinError(null);
                        }}
                        className={`shrink-0 flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl transition-all duration-200 cursor-pointer select-none active:scale-95 border ${
                          isSelected
                            ? 'bg-[#0E1726] border-sky-400 text-white ring-2 ring-sky-400/80 shadow-[0_0_15px_rgba(56,189,248,0.35)] scale-[1.02]'
                            : 'bg-[#04060A] hover:bg-[#0A0E18] border-white/10 text-white hover:border-white/25 shadow-sm'
                        }`}
                        title={item.name}
                      >
                        <div className={`p-1.5 sm:p-2 rounded-xl bg-black border border-white/10 shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                        </div>
                        <div className="text-left min-w-0">
                          <div className={`text-xs sm:text-sm font-black whitespace-nowrap transition-colors ${
                            isSelected ? 'text-sky-300' : 'text-white'
                          }`}>
                            {item.name}
                          </div>
                          {item.subtitle && (
                            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 whitespace-nowrap mt-0.5">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Flèche droite pour défilement rapide sur grand écran */}
                <button
                  type="button"
                  onClick={() => scrollCloudNav('right')}
                  className="hidden md:flex absolute -right-3 z-10 w-7 h-7 rounded-full bg-black/80 hover:bg-black text-white items-center justify-center border border-white/20 shadow-md cursor-pointer transition-all active:scale-90"
                  title="Défiler vers la droite"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ZONE PRINCIPALE : VUE DIVISÉE EN DEUX (SPLIT SCREEN) OU PLEINE LARGEUR    */}
          {/* ========================================================================= */}
          <div className={`flex-1 flex flex-col md:flex-row w-full overflow-hidden relative ${
            isViewerMaximized ? 'min-h-[calc(100vh-68px)] h-[calc(100vh-68px)]' : 'min-h-[calc(100vh-120px)]'
          }`}>
            
            {/* --------------------------------------------------------------------- */}
            {/* PANNEAU DE GAUCHE : LE RESTE DES FICHIERS                            */}
            {/* Si un élément est sélectionné, prend 50% de l'écran avec scroll       */}
            {/* --------------------------------------------------------------------- */}
            <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
              isViewerMaximized 
                ? 'hidden' 
                : (currentSubView.id === 'studycloud-category-audio' || (isCloudView && cloudActiveTab === 'audio') || splitSelectedFile?.category === 'audio')
                  ? `${isMobilePlayerOpen ? 'hidden md:block' : 'w-full'} md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80`
                  : splitSelectedFile 
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-4/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80' 
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
            }`}>
              {/* 0. CLASSEUR PRINCIPAL (BOUTON DE LA PAGE 1 ET ONGLE CLASSEUR DANS ESPACE CLOUD) */}
              {(currentSubView.id === 'studycloud-classeur-classeur' || (isCloudView && cloudActiveTab === 'classeur')) && (
                <div className="w-full">
                  {opened3DFolder ? (
                    renderOpened3DFolderView(opened3DFolder)
                  ) : classeur3DFolders.filter(f => !f.parentId).length === 0 ? (
                    <div className="py-24 sm:py-32 flex flex-col items-center justify-center text-center text-stone-500 dark:text-slate-400">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-4 shadow-sm">
                        <FolderArchive className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.8]" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-stone-800 dark:text-stone-200">
                        Le classeur est vide
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        Aucun document ou dossier n'a été créé dans ce classeur pour le moment.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSubFolderParentId(null);
                          setIsCreateFolderModalOpen(true);
                        }}
                        className="mt-6 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(194,84,22,0.4)] hover:brightness-110 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4 stroke-[2.2]" />
                        <span>Créer un dossier</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-200 pb-28">
                      <div className="flex items-center justify-between px-1 gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-white tracking-wide">
                            Mes Dossiers
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 text-[11px] font-black border border-orange-500/30">
                            {classeur3DFolders.filter(f => !f.parentId).length}
                          </span>
                        </div>

                        {/* Zone droite : Indication & Contrôle de taille (Zoom - / + de 0 à 10, défaut 10) */}
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="text-[11px] text-stone-400 font-medium hidden md:flex items-center gap-1.5">
                            <span>Maintenez et glissez pour déplacer</span>
                          </div>

                          {/* Widget Bouton - et + avec nombre 1 à 10 au milieu (1 est le minimum) */}
                          <div className="flex items-center gap-1 bg-[#0A101D] border border-white/15 hover:border-orange-500/40 rounded-full p-0.5 sm:p-1 shadow-inner transition-colors">
                            <button
                              type="button"
                              onClick={() => setFolderZoomLevel(prev => Math.max(1, prev - 1))}
                              disabled={folderZoomLevel <= 1}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/10 hover:bg-orange-500/25 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm"
                              title="Réduire la taille des dossiers (Moins)"
                              aria-label="Réduire la taille des dossiers"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            <div className="min-w-[24px] sm:min-w-[28px] text-center px-0.5">
                              <span className="text-xs sm:text-sm font-black text-amber-400 tabular-nums select-none">
                                {folderZoomLevel}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setFolderZoomLevel(prev => Math.min(10, prev + 1))}
                              disabled={folderZoomLevel >= 10}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/10 hover:bg-orange-500/25 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm"
                              title="Agrandir la taille des dossiers (Plus)"
                              aria-label="Agrandir la taille des dossiers"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bandeau d'action de sélection multiple si activé pour les dossiers du classeur */}
                      {(() => {
                        const rootFoldersAsFiles: FileItem[] = classeur3DFolders
                          .filter(f => !f.parentId)
                          .map(f => ({
                            id: f.id,
                            name: f.name,
                            category: 'classeur',
                            size: 'Dossier 3D',
                            sizeBytes: 2048,
                            date: f.dateText,
                          } as FileItem));
                        return renderSelectionBanner(rootFoldersAsFiles);
                      })()}

                      {/* Grille progressive ligne par ligne : auto-fill qui s'adapte à la réduction de taille pour occuper tout l'espace libre */}
                      <div 
                        className="grid transition-all duration-300 w-full"
                        style={{
                          gridTemplateColumns: `repeat(auto-fill, minmax(${folderCardMinWidth}px, 1fr))`,
                          gap: `${folderGridGap}px`
                        }}
                      >
                        {(() => {
                          let list = classeur3DFolders.filter(f => !f.parentId && (!subSearchQuery.trim() || f.name.toLowerCase().includes(subSearchQuery.toLowerCase().trim())));
                          if (sortOption === 'pinned') {
                            list = [...list].sort((a, b) => {
                              if (a.isPinned && !b.isPinned) return -1;
                              if (!a.isPinned && b.isPinned) return 1;
                              return 0;
                            });
                          } else if (sortOption === 'oldest') {
                            list = [...list].reverse();
                          }
                          return list;
                        })().map((folder) => {
                            const isBeingDragged = folderDragState?.folder.id === folder.id;
                            const isBeingHeld = holdingFolderId === folder.id;
                            const isFolderSelected = selectedItemIds.includes(folder.id);
                            return (
                              <motion.div
                                key={folder.id}
                                layout
                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                data-classeur-folder-id={folder.id}
                                onPointerDown={(e) => handleFolderPointerDown(e, folder)}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.studycloud-file-menu-panel') || (e.target as HTMLElement).closest('.studycloud-menu-trigger')) return;
                                  if (isSelectionMode) {
                                    toggleItemSelection(folder.id);
                                    return;
                                  }
                                  if (!folderDragState) {
                                    setOpened3DFolder(folder);
                                  }
                                }}
                                className={`group relative ${getFolderCardPadding(folderZoomLevel)} transition-all select-none touch-none border ${
                                  isBeingDragged
                                    ? 'opacity-20 scale-95 border-dashed border-orange-500/60 bg-orange-500/5 cursor-grabbing'
                                    : isBeingHeld
                                      ? 'scale-105 shadow-2xl border-orange-400 bg-[#141E34] cursor-grabbing'
                                      : isFolderSelected
                                        ? 'border-amber-400 ring-2 ring-amber-400/50 bg-[#14233C] shadow-2xl scale-[1.01]'
                                        : 'bg-[#0E1526]/85 hover:bg-[#141E34] border-white/10 hover:border-orange-400/50 shadow-lg hover:shadow-2xl hover:-translate-y-1 cursor-pointer'
                                }`}
                              >
                                {/* Case à cocher carrée quand le mode sélection est actif */}
                                {isSelectionMode && (
                                  <div 
                                    className="absolute top-2 left-2 z-30"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleItemSelection(folder.id);
                                      }}
                                      className={`p-1 sm:p-1.5 rounded-lg border transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
                                        isFolderSelected
                                          ? 'bg-amber-500 text-stone-900 border-amber-400 ring-2 ring-amber-400/50'
                                          : 'bg-black/75 hover:bg-black text-white/70 hover:text-white border-white/30'
                                      }`}
                                      title={isFolderSelected ? "Décocher" : "Cocher"}
                                    >
                                      {isFolderSelected ? (
                                        <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 stroke-[2]" />
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* Badges Épinglé et Favori */}
                                {(folder.isPinned || folder.isFavorite) && (
                                  <div className={`absolute top-2 ${isSelectionMode ? 'left-9 sm:left-10' : 'left-2'} z-20 flex items-center gap-1 pointer-events-none`}>
                                    {folder.isPinned && (
                                      <span className="p-1 rounded-md bg-black/80 border border-blue-400/60 shadow-md flex items-center justify-center text-blue-400 backdrop-blur-sm" title="Épinglé">
                                        <Pin className="w-3 h-3 rotate-45" />
                                      </span>
                                    )}
                                    {folder.isFavorite && (
                                      <span className="p-1 rounded-md bg-black/80 border border-amber-400/60 shadow-md flex items-center justify-center text-amber-400 backdrop-blur-sm" title="Favori">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Haut droite : Bouton 3 traits & Menu d'options (Image 1 & 2) */}
                                <div 
                                  className={getFolderMenuBtnClass(folderZoomLevel)}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                                    }}
                                    className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                                      activeFolderMenuId === folder.id 
                                        ? 'border-orange-400 ring-2 ring-orange-400/50 opacity-100 bg-black' 
                                        : 'border-white/30 opacity-90 group-hover:opacity-100'
                                    }`}
                                    title="Options du dossier (3 traits)"
                                  >
                                    <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
                                  </button>

                                  {renderFolder3DOptionsMenu(folder)}
                                </div>

                                {/* Le dossier 3D lui-même glissé un peu vers le bas sur l'espace noir sans bouger l'espace noir pour que le bouton 3 traits ne chevauche plus la date */}
                                <div className={`${getFolderTopSpacing(folderZoomLevel)} w-full`}>
                                  <Classeur3DFolderCard folder={folder} isDragging={isBeingDragged} />
                                </div>
                              </motion.div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1. DOCUMENTS (IMAGE 1) */}
              {(currentSubView.id === 'studycloud-category-documents' || (isCloudView && cloudActiveTab === 'documents')) && (
                <div className="space-y-3 sm:space-y-4">
                  {/* Compteur */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} publié{filteredDocuments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredDocuments)}

                  {filteredDocuments.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-blue-400" />
                      <p className="text-sm font-semibold">Aucun document disponible</p>
                      <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                        Ce dossier ne contient aucun document pour le moment.
                      </p>
                    </div>
                  ) : (
                    <div className={`grid gap-2.5 sm:gap-3.5 ${
                      splitSelectedFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredDocuments.map((doc, idx) => renderDocumentCard(doc, idx))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. IMAGES (IMAGE 2) */}
              {(currentSubView.id === 'studycloud-category-images' || (isCloudView && cloudActiveTab === 'images')) && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} disponible{filteredImages.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredImages)}

                  {filteredImages.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-emerald-400" />
                      <p className="text-sm font-semibold">Aucune image disponible</p>
                      <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                        Ce dossier ne contient aucune image pour le moment.
                      </p>
                    </div>
                  ) : (
                    <div className={`grid gap-2 sm:gap-3 ${
                      splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredImages.map((img, idx) => renderImageCard(img, idx))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. VIDÉOS (IMAGE 3) */}
              {(currentSubView.id === 'studycloud-category-videos' || (isCloudView && cloudActiveTab === 'videos')) && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredVideos)}

                  {filteredVideos.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      <Film className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-purple-400" />
                      <p className="text-sm font-semibold">Aucune vidéo disponible</p>
                      <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                        Ce dossier ne contient aucune vidéo pour le moment.
                      </p>
                    </div>
                  ) : (
                    <div className={`grid gap-2 sm:gap-3 ${
                      splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. AUDIO / MUSIQUE */}
              {(currentSubView.id === 'studycloud-category-audio' || (isCloudView && cloudActiveTab === 'audio')) && (
                <div className="w-full space-y-3">
                  {/* En-tête de la liste */}
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-amber-500 dark:text-amber-400 stroke-[2.2]" />
                      <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white tracking-wide">
                        Tous les sons ({filteredAudio.length})
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                      StudyCloud Audio
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredAudio)}

                  {/* Liste des pistes ou état vide */}
                  {filteredAudio.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      <Music className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                      <p className="text-sm font-semibold">Aucun son disponible</p>
                      <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                        Ce dossier ne contient aucun fichier audio pour le moment.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                    {filteredAudio.map((track) => {
                      const isSelected = splitSelectedFile?.id === track.id;
                      const isChecked = selectedItemIds.includes(track.id);
                      const isMenuOpen = activeMenuFileId === track.id || audioMenuSongId === track.id;

                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleItemSelection(track.id);
                            } else {
                              handleSelectFile(track);
                              setIsMobilePlayerOpen(true);
                            }
                          }}
                          className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none border ${
                            isMenuOpen ? 'z-50 relative' : 'relative z-10'
                          } ${
                            isChecked
                              ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
                              : isSelected 
                                ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-400/30' 
                                : 'bg-white dark:bg-slate-900/80 border-stone-200/90 dark:border-slate-800 hover:border-amber-400/60 hover:shadow-md'
                          }`}
                        >
                          {/* Case à cocher en mode sélection */}
                          {isSelectionMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemSelection(track.id);
                              }}
                              className="p-1 text-amber-500 hover:text-amber-600 cursor-pointer shrink-0"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 fill-amber-500/20 text-amber-500" />
                              ) : (
                                <Square className="w-5 h-5 text-stone-400 dark:text-slate-500" />
                              )}
                            </button>
                          )}

                          {/* Gauche : Vignette album carrée + Titre + Artiste + Détails */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-900 border border-stone-200 dark:border-white/10 relative shadow-sm">
                              <AudioCardPreview track={track} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                                isSelected ? 'text-amber-600 dark:text-amber-300 font-black' : 'text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors'
                              }`}>
                                {track.name}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                {track.artist || track.source}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-400 dark:text-slate-500 font-medium">
                                <span>{track.size}</span>
                                <span>•</span>
                                <span>{formatTime(track.durationSec || 0)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Droite : Bouton Play/Pause + Bâtons animés + Date + Bouton 3 traits */}
                          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                            {/* Si morceau sélectionné : bâtons animés ET bouton Play/Pause juste à côté */}
                            {isSelected && (
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Les 4 bâtons qui bougent quand la musique chante, et s'arrêtent en pause */}
                                <div 
                                  className="flex items-end gap-1 h-5 px-1 py-0.5 shrink-0" 
                                  title={isAudioPlaying ? "Lecture en cours" : "En pause"}
                                >
                                  <span 
                                    className={`w-1 rounded-full bg-amber-500 dark:bg-amber-400 ${isAudioPlaying ? 'music-bar-1' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '5px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                  <span 
                                    className={`w-1 rounded-full bg-amber-400 dark:bg-amber-300 ${isAudioPlaying ? 'music-bar-2' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '14px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                  <span 
                                    className={`w-1 rounded-full bg-yellow-500 dark:bg-yellow-400 ${isAudioPlaying ? 'music-bar-3' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '9px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                  <span 
                                    className={`w-1 rounded-full bg-amber-500 dark:bg-amber-400 ${isAudioPlaying ? 'music-bar-4' : ''}`}
                                    style={{ 
                                      height: isAudioPlaying ? undefined : '4px',
                                      animationPlayState: isAudioPlaying ? 'running' : 'paused' 
                                    }} 
                                  />
                                </div>

                                {/* BOUTON POUR METTRE PAUSE / PLAY A CÔTÉ DU BÂTON QUI BOUGE */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAudioPlaying(!isAudioPlaying);
                                  }}
                                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
                                  title={isAudioPlaying ? "Mettre en pause" : "Reprendre la lecture"}
                                >
                                  {isAudioPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Si morceau non sélectionné : bouton lecture directe au survol */}
                            {!isSelected && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectFile(track);
                                  setIsAudioPlaying(true);
                                  setIsMobilePlayerOpen(true);
                                }}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Lire ce son"
                              >
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </button>
                            )}

                            {/* Date */}
                            <span className="text-xs font-semibold text-stone-400 dark:text-slate-400 shrink-0 hidden sm:inline-block">
                              {track.date}
                            </span>

                            {/* Bouton 3 traits sur chaque musique avec toutes les propositions */}
                            <div className="relative shrink-0 studycloud-menu-trigger">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuFileId(activeMenuFileId === track.id ? null : track.id);
                                  setAudioMenuSongId(audioMenuSongId === track.id ? null : track.id);
                                }}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                                title="Options de la musique (3 traits)"
                              >
                                <Menu className="w-4 h-4 stroke-[2.2]" />
                              </button>

                              {renderFileOptionsMenu(track, filteredAudio, 'right')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

              {/* 5. TÉLÉCHARGEMENTS */}
              {(currentSubView.id === 'studycloud-category-downloads' || (isCloudView && cloudActiveTab === 'downloads')) && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredDownloads.map(toFileItem))}

                  {filteredDownloads.length === 0 ? (
                    <div className="py-16 text-center text-stone-500 dark:text-slate-400">
                      <Download className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5]" />
                      <p className="text-sm font-semibold">Aucun fichier téléchargé</p>
                      <p className="text-xs opacity-70 mt-1">Les fichiers téléchargés s'afficheront ici avec leur vue dédiée.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Documents téléchargés */}
                      {downloadDocs.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Documents ({downloadDocs.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2.5 sm:gap-3.5 ${
                            splitSelectedFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadDocs.map((doc, idx) => renderDocumentCard(doc, idx, downloadDocs))}
                          </div>
                        </div>
                      )}

                      {/* Images téléchargées */}
                      {downloadImages.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Images ({downloadImages.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2 sm:gap-3 ${
                            splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadImages.map((img, idx) => renderImageCard(img, idx))}
                          </div>
                        </div>
                      )}

                      {/* Vidéos téléchargées */}
                      {downloadVideos.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Film className="w-4 h-4 text-purple-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Vidéos ({downloadVideos.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2 sm:gap-3 ${
                            splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                          </div>
                        </div>
                      )}

                      {/* Audio téléchargé */}
                      {downloadAudio.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-amber-400" />
                            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                              Fichiers Audio ({downloadAudio.length})
                            </h3>
                          </div>
                          <div className={`grid gap-2 sm:gap-3 ${
                            splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                          }`}>
                            {downloadAudio.map((aud, idx) => renderAudioSquareCard(aud, idx, downloadAudio))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 6. APPLICATIONS */}
              {(currentSubView.id === 'studycloud-category-apps' || (isCloudView && cloudActiveTab === 'apps')) && (
                <div className="py-28 text-center animate-in fade-in duration-200">
                  <p className="text-sm sm:text-base font-semibold text-stone-600 dark:text-slate-300">
                    Cette fonctionnalité n'est pas disponible pour le moment.
                  </p>
                </div>
              )}

              {/* 7. DOSSIER SÉCURISÉ (COLLECTION) */}
              {(currentSubView.id === 'studycloud-collection-secure-folder' || (isCloudView && cloudActiveTab === 'secure-folder')) && (
                <div className="space-y-4">
                  {!isSecureFolderUnlocked ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      <Lock className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                      <p className="text-sm font-semibold">Dossier sécurisé verrouillé</p>
                      <button
                        type="button"
                        onClick={() => {
                          setPinTargetDestination(isCloudView ? 'cloud-tab' : 'collection');
                          setIsPinModalOpen(true);
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer shadow-md active:scale-95 transition-all"
                      >
                        Déverrouiller le dossier
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Bandeau d'action de sélection multiple si activé */}
                      {renderSelectionBanner(filteredSecureFiles)}

                      {filteredSecureFiles.length === 0 ? (
                        <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                          <Lock className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                          <p className="text-sm font-semibold">Le dossier sécurisé est vide</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Pour sécuriser un fichier, utilisez l'option « Verrouiller » dans le menu à 3 traits d'une photo, vidéo, musique ou document.
                          </p>
                        </div>
                      ) : (
                        <div className={`grid gap-2.5 sm:gap-3.5 ${
                          splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                        }`}>
                          {filteredSecureFiles.map((file, idx) => {
                            if (file.category === 'images') return renderImageCard(file, idx);
                            if (file.category === 'videos') return renderVideoCard(file, idx);
                            if (file.category === 'audio') return renderAudioItem(file);
                            return renderDocumentCard(file, idx, filteredSecureFiles);
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 8. FAVORIS (COLLECTION) */}
              {(currentSubView?.id === 'studycloud-collection-favorites' || (isCloudView && cloudActiveTab === 'favorites')) && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {favoriteFiles.length === 0 ? (
                    <div className="py-28 text-center animate-in fade-in duration-200">
                      <p className="text-sm sm:text-base font-medium text-stone-500 dark:text-slate-400 tracking-wide">
                        Aucun favori pour le moment
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                          {favoriteFiles.length} fichier{favoriteFiles.length > 1 ? 's' : ''} marqué{favoriteFiles.length > 1 ? 's' : ''} comme favori
                        </span>
                      </div>

                      {renderSelectionBanner(favoriteFiles)}

                      <div className={`grid gap-2.5 sm:gap-3.5 ${
                        splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                      }`}>
                        {favoriteFiles.map((file, idx) => {
                          if ((file as any).isFolder) {
                            const folder = classeur3DFolders.find(f => f.id === file.id);
                            if (folder) {
                              return (
                                <div
                                  key={folder.id}
                                  onClick={() => {
                                    setOpened3DFolder(folder);
                                    setCloudActiveTab('classeur');
                                    handleOpenSubView('classeur', 'cloud-storage', 'Espace Cloud', Cloud, 'from-amber-600 to-amber-700');
                                  }}
                                  className="cursor-pointer group relative select-none rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border border-white/10 hover:border-orange-400/50 p-2 sm:p-2.5 shadow-lg hover:shadow-2xl transition-all"
                                  title={`Ouvrir le dossier « ${folder.name} »`}
                                >
                                  {/* Badges Épinglé & Favori sur le dossier en Favoris */}
                                  <div className="absolute top-1.5 left-2 flex items-center gap-1 z-20 pointer-events-none">
                                    {folder.isPinned && (
                                      <span className="p-1 rounded-md bg-black/80 border border-blue-400/60 shadow-md flex items-center justify-center text-blue-400" title="Épinglé">
                                        <Pin className="w-3 h-3 rotate-45" />
                                      </span>
                                    )}
                                    <span className="p-1 rounded-md bg-black/80 border border-amber-400/60 shadow-md flex items-center justify-center text-amber-400" title="Favori">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    </span>
                                  </div>
                                  <div className="pt-6 pb-1 w-full">
                                    <Classeur3DFolderCard folder={folder} />
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (file.category === 'images') return renderImageCard(file, idx);
                          if (file.category === 'videos') return renderVideoCard(file, idx);
                          if (file.category === 'audio') return renderAudioItem(file);
                          return renderDocumentCard(file, idx, favoriteFiles);
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 9. CORBEILLE (COLLECTION) */}
              {(currentSubView?.id === 'studycloud-collection-trash' || (isCloudView && cloudActiveTab === 'trash')) && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {filteredTrashFiles.length === 0 ? (
                    <div className="py-28 text-center animate-in fade-in duration-200">
                      <p className="text-sm sm:text-base font-medium text-stone-500 dark:text-slate-400 tracking-wide">
                        Aucun élément dans la corbeille
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Compteur sobre sans bandeau */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                          {filteredTrashFiles.length} fichier{filteredTrashFiles.length > 1 ? 's' : ''} dans la corbeille
                        </span>
                      </div>

                      {renderSelectionBanner(filteredTrashFiles)}

                      {/* Structure et cartes de fichiers identiques au menu Téléchargements */}
                      <div className="space-y-6">
                        {/* Documents dans la corbeille */}
                        {trashDocs.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-400" />
                              <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                                Documents ({trashDocs.length})
                              </h3>
                            </div>
                            <div className={`grid gap-2.5 sm:gap-3.5 ${
                              splitSelectedFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            }`}>
                              {trashDocs.map((doc, idx) => renderDocumentCard(doc, idx, trashDocs))}
                            </div>
                          </div>
                        )}

                        {/* Images dans la corbeille */}
                        {trashImages.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-emerald-400" />
                              <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                                Images ({trashImages.length})
                              </h3>
                            </div>
                            <div className={`grid gap-2 sm:gap-3 ${
                              splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            }`}>
                              {trashImages.map((img, idx) => renderImageCard(img, idx))}
                            </div>
                          </div>
                        )}

                        {/* Vidéos dans la corbeille */}
                        {trashVideos.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Film className="w-4 h-4 text-purple-400" />
                              <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                                Vidéos ({trashVideos.length})
                              </h3>
                            </div>
                            <div className={`grid gap-2 sm:gap-3 ${
                              splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            }`}>
                              {trashVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                            </div>
                          </div>
                        )}

                        {/* Fichiers Audio dans la corbeille */}
                        {trashAudio.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Music className="w-4 h-4 text-amber-400" />
                              <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-slate-200">
                                Fichiers Audio ({trashAudio.length})
                              </h3>
                            </div>
                            <div className={`grid gap-2 sm:gap-3 ${
                              splitSelectedFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            }`}>
                              {trashAudio.map((aud, idx) => renderAudioSquareCard(aud, idx, trashAudio))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>

            {/* --------------------------------------------------------------------- */}
            {/* PANNEAU DE DROITE : L'ÉLÉMENT SÉLECTIONNÉ AFFICHÉ BIEN GRAND         */}
            {/* Avec barre de boutons supérieurs (zoom, agrandir, fermer, nav...)     */}
            {/* --------------------------------------------------------------------- */}
            {splitSelectedFile ? (
              <div className={`transition-all duration-300 flex flex-col bg-[#04060A] ${
                isViewerMaximized 
                  ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                  : (currentSubView.id === 'studycloud-category-audio' || (isCloudView && cloudActiveTab === 'audio') || isSelectedAudio)
                    ? `${isMobilePlayerOpen ? 'flex w-full min-h-[calc(100vh-120px)]' : 'hidden md:flex'} md:w-7/12 lg:w-7/12 xl:w-7/12 border-t md:border-t-0 md:border-l border-white/10`
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-8/12 min-h-[500px] border-t md:border-t-0 md:border-l border-white/10'
              }`}>
                
                {/* BARRE SUPÉRIEURE DE BOUTONS DU LECTEUR GRAND FORMAT (Images 2 et 3) */}
                <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
                  
                  {/* GAUCHE : Flèches de navigation < > et titre */}
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <button
                      type="button"
                      disabled={!canNavigatePrev}
                      onClick={() => handleNavigateSplit('prev')}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none disabled:cursor-not-allowed text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title={canNavigatePrev ? "Élément précédent" : "Aucun élément précédent"}
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                    </button>
                    <button
                      type="button"
                      disabled={!canNavigateNext}
                      onClick={() => handleNavigateSplit('next')}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none disabled:cursor-not-allowed text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title={canNavigateNext ? "Élément suivant" : "Aucun élément suivant"}
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                    </button>

                    <div className="min-w-0 ml-1">
                      <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={splitSelectedFile.name}>
                        {splitSelectedFile.name}
                      </p>
                      {splitSelectedFile.size && (
                        <p className="text-[10px] text-slate-400 font-semibold truncate">
                          {splitSelectedFile.size}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* DROITE : PETITS BOUTONS D'ACTIONS (Zoom, Rotation, Partage, Agrandir, Fermer) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
                    
                    {/* Zoom & Rotation (pour images et documents) - PLACÉS DEVANT */}
                    {(isSelectedImage || isSelectedDoc) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewerZoom(prev => Math.max(0.5, prev - 0.25))}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          title="Zoom arrière (-)"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewerZoom(prev => Math.min(3, prev + 0.25))}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          title="Zoom avant (+)"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewerRotation(prev => (prev + 90) % 360)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          title="Faire pivoter"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* BOUTON DÉFILEMENT HORIZONTAL / VERTICAL (UNIQUEMENT POUR LES DOCUMENTS) */}
                    {isSelectedDoc && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = docLayoutMode === 'vertical' ? 'horizontal' : 'vertical';
                          setDocLayoutMode(nextMode);
                          setDocCurrentPage(1);
                          showToast(nextMode === 'horizontal' ? 'Mode défilement horizontal activé' : 'Mode défilement vertical activé');
                        }}
                        className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-bold border transition-all cursor-pointer shadow-sm active:scale-95 ${
                          docLayoutMode === 'horizontal'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-400/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30 ring-1 ring-blue-400/40'
                        }`}
                        title={docLayoutMode === 'vertical' ? "Défilement vertical (Cliquer pour passer en défilement horizontal)" : "Défilement horizontal (Cliquer pour passer en défilement vertical)"}
                      >
                        {docLayoutMode === 'vertical' ? (
                          <>
                            <SlidersHorizontal className="w-3.5 h-3.5 rotate-90 text-blue-400" />
                            <span className="text-[11px] font-black">Vertical</span>
                          </>
                        ) : (
                          <>
                            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-black">Horizontal</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Partager */}
                    <button
                      type="button"
                      onClick={() => handleShareFile(splitSelectedFile)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Partager le fichier"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Télécharger */}
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(splitSelectedFile)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* BOUTON ESPACE D'ÉTUDE DEVANT LE BOUTON ZOOM / OPTIONS */}
                    <button
                      type="button"
                      onClick={() => handleOpenStudySpaceForCurrentMenu(true)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                      title="Ouvrir dans l'Espace d'étude"
                    >
                      <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>

                    {/* BOUTON 3 TRAITS D'OPTIONS AUDIO OU AGRANDIR POUR AUTRES FORMATS */}
                    {isSelectedAudio ? (
                      <div className="relative studycloud-menu-trigger">
                        <button
                          type="button"
                          onClick={() => setIsPlayerMenuOpen(!isPlayerMenuOpen)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Options de lecture (3 traits)"
                        >
                          <Menu className="w-4 h-4 stroke-[2.2]" />
                        </button>

                        {isPlayerMenuOpen && (
                          <div 
                            className="studycloud-file-menu-panel absolute right-0 top-9 z-50 w-52 bg-[#0D1527] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs text-white divide-y divide-white/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                              <button 
                                type="button" 
                                onClick={() => { handleDownloadFile(splitSelectedFile); setIsPlayerMenuOpen(false); }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Download className="w-4 h-4 text-blue-400" /> Télécharger ce son
                              </button>
                              <button 
                                type="button" 
                                onClick={() => { handleShareFile(splitSelectedFile); setIsPlayerMenuOpen(false); }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Share2 className="w-4 h-4 text-emerald-400" /> Partager
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  const url = `${window.location.origin}/share/audio/${splitSelectedFile.id}`;
                                  navigator.clipboard?.writeText(url);
                                  showToast("Lien copié dans le presse-papiers !");
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Link className="w-4 h-4 text-purple-400" /> Créer un lien
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  handleGenericFileAction('secure_folder', splitSelectedFile, audioList);
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer text-amber-300"
                              >
                                <Lock className="w-4 h-4 text-amber-400" /> Transporter vers le dossier sécurisé
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  toggleAudioRepeat();
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Repeat className="w-4 h-4 text-amber-400" />
                                <span>{isAudioRepeat === 'one' ? "Désactiver la boucle" : "Lire en boucle"}</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setIsAudioShuffle(!isAudioShuffle);
                                  showToast(!isAudioShuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée");
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Shuffle className="w-4 h-4 text-amber-400" />
                                <span>{isAudioShuffle ? "Désactiver mode aléatoire" : "Mode aléatoire"}</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  handleDeleteAudio(splitSelectedFile);
                                  setIsPlayerMenuOpen(false);
                                }} 
                                className="w-full px-3.5 py-2.5 text-left hover:bg-rose-950/40 text-rose-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" /> Supprimer ce son
                              </button>
                            </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsViewerMaximized(!isViewerMaximized)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                          isViewerMaximized 
                            ? 'bg-blue-600 text-white border-blue-400' 
                            : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
                        }`}
                        title={isViewerMaximized ? "Réduire la vue" : "Agrandir dans l'espace"}
                      >
                        {isViewerMaximized ? (
                          <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                        )}
                      </button>
                    )}

                    {/* BOUTON POUR FERMER CETTE VUE - DEMANDÉ PAR L'UTILISATEUR */}
                    <button
                      type="button"
                      onClick={() => {
                        if (noteSaveTimeoutRef.current) {
                          clearTimeout(noteSaveTimeoutRef.current);
                        }
                        if (isSelectedNotepad && splitSelectedFile) {
                          CloudStorageAPI.updateClasseurFile(splitSelectedFile.id, {
                            noteTitle: noteTitleContent,
                            content: noteTextContent,
                          }).catch(() => {});
                        }
                        setSplitSelectedFile(null);
                        setIsAudioPlaying(false);
                        setIsMobilePlayerOpen(false);
                        setIsViewerMaximized(false);
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
                      title="Fermer la vue grand format"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>

                  </div>

                </div>

                {/* CORPS DU LECTEUR GRAND FORMAT SELON LE TYPE DE MÉDIA (Prend tout l'espace disponible) */}
                <div className={`flex-1 w-full h-full flex flex-col items-center justify-center ${isSelectedDoc ? 'p-0 overflow-hidden bg-white' : 'p-1 sm:p-2 sm:px-4 overflow-hidden'} relative`}>

                  {/* 1. LECTEUR IMAGE GRAND FORMAT AVANCÉ */}
                  {isSelectedImage && !isSelectedVideo && !isSelectedAudio && (
                    <div className="w-full h-full flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl shadow-2xl">
                      <ModernImageViewer
                        src={splitSelectedFile.previewUrl || (splitSelectedFile as any).url}
                        alt={splitSelectedFile.name}
                        fileName={splitSelectedFile.name}
                        fileId={splitSelectedFile.id}
                        fileSize={splitSelectedFile.size}
                        className={`w-full h-full ${
                          isViewerMaximized 
                            ? 'max-h-[calc(100vh-125px)]' 
                            : 'max-h-[calc(100vh-180px)]'
                        }`}
                      />
                    </div>
                  )}

                  {/* 2. LECTEUR VIDÉO GRAND FORMAT INTERACTIF AVANCÉ */}
                  {isSelectedVideo && !isSelectedAudio && (
                    <div className="w-full h-full flex-1 flex items-center justify-center relative p-1 sm:p-2 overflow-hidden rounded-2xl shadow-2xl">
                      <ModernVideoPlayer
                        src={
                          (splitSelectedFile.videoUrl && !splitSelectedFile.videoUrl.startsWith('blob:'))
                            ? splitSelectedFile.videoUrl
                            : (splitSelectedFile.url && !splitSelectedFile.url.startsWith('blob:'))
                            ? splitSelectedFile.url
                            : `${getWorkerApiUrl().replace(/\/+$/, '')}/api/cloud/stream/${splitSelectedFile.id}`
                        }
                        poster={splitSelectedFile.previewUrl}
                        fileName={splitSelectedFile.name}
                        fileId={splitSelectedFile.id}
                        fileSize={splitSelectedFile.size}
                        autoPlay={true}
                        className={`w-full h-full ${
                          isViewerMaximized 
                            ? 'max-h-[calc(100vh-125px)]' 
                            : 'max-h-[calc(100vh-180px)]'
                        }`}
                      />
                    </div>
                  )}

                  {/* 3. LECTEUR AUDIO GRAND FORMAT INTERACTIF (IMAGE 2 : LECTEUR MUSICAL DESIGN PREMIUM) */}
                  {isSelectedAudio && (
                    <div className="relative w-full h-full flex-1 flex flex-col justify-between p-3 sm:p-6 md:p-8 bg-[#090D1A] text-white overflow-hidden select-none rounded-2xl">
                      
                      {/* Élément audio HTML5 natif invisible pour la lecture réelle */}
                      <audio
                        ref={audioRef}
                        src={splitSelectedFile.audioUrl || (splitSelectedFile as any).url || ''}
                        autoPlay={isAudioPlaying}
                        loop={isAudioRepeat === 'one'}
                        onEnded={() => {
                          if (isAudioRepeat === 'one') {
                            if (audioRef.current) {
                              audioRef.current.currentTime = 0;
                              audioRef.current.play().catch(() => {});
                            }
                            setAudioCurrentTime(0);
                          } else {
                            handleAudioNext();
                          }
                        }}
                        onTimeUpdate={() => {
                          if (audioRef.current && isAudioPlaying) {
                            setAudioCurrentTime(Math.floor(audioRef.current.currentTime));
                            if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                              setAudioDuration(Math.floor(audioRef.current.duration));
                            }
                          }
                        }}
                      />

                      {/* Halo lumineux d'ambiance dorée / ambrée chaleureuse (Image 2) */}
                      <div 
                        className="absolute inset-0 pointer-events-none opacity-35"
                        style={{
                          background: 'radial-gradient(circle at 45% 30%, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.18) 40%, transparent 75%)'
                        }}
                      />

                      {/* Bouton retour mobile (< md) : Permet de revenir à la liste sur téléphone */}
                      <div className="md:hidden flex items-center justify-between pb-2 relative z-10 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsMobilePlayerOpen(false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-md border border-white/15 transition-all active:scale-95 cursor-pointer shadow-sm"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                          <span>Retour à la liste</span>
                        </button>
                        <span className="text-[11px] font-bold text-amber-300">En cours de lecture</span>
                      </div>

                      {/* PARTIE SUPÉRIEURE : Pochette album centrée (paroles supprimées comme entouré en rouge) */}
                      <div className="relative z-10 w-full flex items-center justify-center max-w-sm mx-auto my-auto pt-2 sm:pt-4">
                        <div className="relative w-44 sm:w-56 md:w-64 aspect-square rounded-2xl overflow-hidden shrink-0 shadow-[0_20px_45px_rgba(0,0,0,0.85)] border border-white/20 bg-black group">
                          <AudioCardPreview track={splitSelectedFile} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />

                          {/* Badge Parental Advisory */}
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/85 border border-white/25 rounded text-[7px] font-black uppercase tracking-wider text-white">
                            Parental Advisory
                          </div>
                        </div>
                      </div>

                      {/* MILIEU : Titre et Artiste (Image 2) */}
                      <div className="relative z-10 w-full text-center space-y-1 my-2 sm:my-3">
                        <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md truncate px-2">
                          {splitSelectedFile.name}
                        </h2>
                        <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate px-2">
                          {splitSelectedFile.artist || splitSelectedFile.source || 'Dave & Tems'}
                        </p>
                      </div>

                      {/* SECTION TEMPORELLE : -10s, Pillule de temps 0:11 / 3:39, +10s et Barre de progression (Image 2) */}
                      <div className="relative z-10 w-full max-w-md mx-auto space-y-1.5 py-1">
                        {/* Ligne avec boutons -10, Badge temps au centre, et +10 */}
                        <div className="flex items-center justify-between px-3">
                          {/* Bouton -10s fonctionnel */}
                          <button
                            type="button"
                            onClick={() => handleSeekDelta(-10)}
                            className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
                            title="Reculer de 10s"
                          >
                            <RotateCcw className="w-5 h-5 stroke-[2]" />
                            <span className="absolute text-[8px] font-black text-white">10</span>
                          </button>

                          {/* Pillule blanche avec temps exact (ex: 0:11 / 3:39) */}
                          <div className="px-3.5 py-1 rounded-full bg-white text-stone-950 font-black text-xs shadow-md tracking-wider">
                            {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                          </div>

                          {/* Bouton +10s fonctionnel */}
                          <button
                            type="button"
                            onClick={() => handleSeekDelta(10)}
                            className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
                            title="Avancer de 10s"
                          >
                            <RotateCw className="w-5 h-5 stroke-[2]" />
                            <span className="absolute text-[8px] font-black text-white">10</span>
                          </button>
                        </div>

                        {/* Slider interactif */}
                        <div className="w-full px-2">
                          <input
                            type="range"
                            min="0"
                            max={audioDuration || 1}
                            value={audioCurrentTime}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAudioCurrentTime(val);
                              if (audioRef.current) audioRef.current.currentTime = val;
                            }}
                            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-amber-400 transition-all"
                          />
                        </div>
                      </div>

                      {/* CONTRÔLES PRINCIPAUX : Aléatoire, Précédent, Grand Bouton Rond Blanc Play/Pause, Suivant, Répéter (Image 2) */}
                      <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between px-2 pt-1 pb-2 sm:pb-3">
                        {/* Lecture Aléatoire (Shuffle fonctionnel) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAudioShuffle(!isAudioShuffle);
                            showToast(!isAudioShuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée");
                          }}
                          className={`p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ${
                            isAudioShuffle ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
                          }`}
                          title={isAudioShuffle ? "Désactiver mode aléatoire" : "Mode aléatoire"}
                        >
                          <Shuffle className="w-5 h-5" />
                        </button>

                        {/* Morceau précédent */}
                        <button
                          type="button"
                          onClick={handleAudioPrev}
                          className="p-2 rounded-full hover:bg-white/10 text-white hover:scale-110 active:scale-90 transition-all cursor-pointer"
                          title="Son précédent"
                        >
                          <SkipBack className="w-6 h-6 fill-white" />
                        </button>

                        {/* GRAND BOUTON ROND BLANC PLAY / PAUSE (Image 2) */}
                        <button
                          type="button"
                          onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                          className="w-16 h-16 rounded-full bg-white text-stone-950 flex items-center justify-center shadow-[0_6px_25px_rgba(255,255,255,0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          title={isAudioPlaying ? "Mettre en pause" : "Lancer la lecture"}
                        >
                          {isAudioPlaying ? (
                            <Pause className="w-7 h-7 fill-stone-950 stroke-stone-950" />
                          ) : (
                            <Play className="w-7 h-7 fill-stone-950 stroke-stone-950 translate-x-0.5" />
                          )}
                        </button>

                        {/* Morceau suivant */}
                        <button
                          type="button"
                          onClick={handleAudioNext}
                          className="p-2 rounded-full hover:bg-white/10 text-white hover:scale-110 active:scale-90 transition-all cursor-pointer"
                          title="Son suivant"
                        >
                          <SkipForward className="w-6 h-6 fill-white" />
                        </button>

                        {/* Répéter en boucle (Boucle continue fonctionnelle) */}
                        <button
                          type="button"
                          onClick={toggleAudioRepeat}
                          className={`relative p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ${
                            isAudioRepeat !== 'off' ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
                          }`}
                          title={isAudioRepeat !== 'off' ? "Désactiver la boucle" : "Lire en boucle (reprend seul)"}
                        >
                          <Repeat className="w-5 h-5" />
                          {isAudioRepeat === 'one' && (
                            <span className="absolute bottom-1 right-1 text-[8px] font-black text-amber-400">1</span>
                          )}
                        </button>
                      </div>

                      {/* Modal Paroles Complètes si activé */}
                      {showLyricsModal && (
                        <div className="absolute inset-0 z-40 bg-[#070B16]/95 backdrop-blur-xl p-5 sm:p-6 flex flex-col justify-between animate-in fade-in duration-200">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                              <h3 className="text-sm sm:text-base font-black text-white">{splitSelectedFile.name}</h3>
                              <p className="text-xs text-amber-300 font-semibold">{splitSelectedFile.artist || 'Paroles complètes'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowLyricsModal(false)}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto py-6 space-y-4 text-center">
                            {(splitSelectedFile.fullLyrics || [
                              "And really when I think of it",
                              "Growing up, I didn't ever see marriages",
                              "No weddings, no horse, no carriages",
                              "I wanna do things different and right",
                              "Pray for me through the day and the night",
                              "When the rain falls on our souls",
                              "We will dance and we will heal..."
                            ]).map((line, idx) => (
                              <p key={idx} className={`text-sm sm:text-base font-bold leading-relaxed ${idx === 0 ? 'text-amber-300 scale-105 font-black' : 'text-white/70'}`}>
                                {line}
                              </p>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowLyricsModal(false)}
                            className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                          >
                            Fermer les paroles
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 4. LECTEUR / ÉDITEUR BLOC-NOTES TXT GRAND FORMAT (Prend tout l'espace, design soigné, lecture et écriture synchronisée) */}
                  {isSelectedNotepad && (
                    <div className="w-full h-full flex-1 flex flex-col overflow-hidden bg-[#0A0F1D] text-white rounded-2xl border border-white/10 shadow-2xl animate-in fade-in duration-150">
                      {/* Barre d'outils du bloc-notes */}
                      <div className="px-3 sm:px-4 py-2 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                            TXT
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                            {noteTextContent.length} car. • {noteTextContent.trim() ? noteTextContent.trim().split(/\s+/).length : 0} mots
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const fullText = (noteTitleContent ? `${noteTitleContent.toUpperCase()}\n\n` : '') + noteTextContent;
                              navigator.clipboard?.writeText(fullText);
                              showToast('Texte copié dans le presse-papiers !');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Copier tout le texte"
                          >
                            <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="hidden sm:inline">Copier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const fullText = (noteTitleContent ? `${noteTitleContent.toUpperCase()}\n\n` : '') + noteTextContent;
                              const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = splitSelectedFile.name;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              showToast(`"${splitSelectedFile.name}" téléchargé !`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Télécharger le fichier .txt"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Télécharger</span>
                          </button>
                        </div>
                      </div>

                      {/* Zone de saisie du Titre et du Contenu */}
                      <div className="flex-1 w-full p-3 sm:p-5 overflow-y-auto flex flex-col space-y-3">
                        {/* Espace Titre dédié en haut : sort en majuscules et limité à deux lignes */}
                        <div className="w-full relative">
                          <textarea
                            value={noteTitleContent}
                            rows={2}
                            placeholder="TITRE DE LA NOTE (EN MAJUSCULES)..."
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              const lines = val.split('\n');
                              const limitedVal = lines.slice(0, 2).join('\n');
                              setNoteTitleContent(limitedVal);
                              handleUpdateNoteContent(noteTextContent, limitedVal);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const currentLines = noteTitleContent.split('\n');
                                if (currentLines.length >= 2) {
                                  e.preventDefault();
                                }
                              }
                            }}
                            className="w-full uppercase font-black text-sm sm:text-base md:text-lg text-cyan-300 placeholder:text-slate-500 placeholder:normal-case bg-transparent border-b border-white/10 pb-2 outline-none resize-none tracking-wide break-all [overflow-wrap:anywhere] [word-break:break-word] leading-snug selection:bg-cyan-500/30"
                            style={{
                              maxHeight: '4.2rem',
                              lineHeight: '1.4'
                            }}
                          />
                        </div>

                        {/* Zone de contenu de la note : break-all pour remplir toute la ligne sans blocage */}
                        <textarea
                          value={noteTextContent}
                          onChange={(e) => {
                            const newText = e.target.value;
                            setNoteTextContent(newText);
                            handleUpdateNoteContent(newText, noteTitleContent);
                          }}
                          placeholder="Commencez à écrire votre note ici..."
                          className="w-full flex-1 min-h-[350px] bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm font-sans leading-relaxed border-none outline-none resize-none focus:ring-0 selection:bg-cyan-500/30 break-all [overflow-wrap:anywhere] [word-break:break-word]"
                          style={{
                            fontSize: `${Math.max(12, Math.round(14 * viewerZoom))}px`
                          }}
                        />
                      </div>

                      {/* Bas de page du lecteur */}
                      <div className="px-4 py-2 bg-slate-900/60 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                          Sauvegarde automatique activée
                        </span>
                        <span>{splitSelectedFile.name}</span>
                      </div>
                    </div>
                  )}

                  {/* 5. LECTEUR DOCUMENT GRAND FORMAT (Prend tout l'espace disponible, sans bandes noires ni creux) */}
                  {isSelectedDoc && (
                    <div className="w-full h-full flex-1 flex flex-col overflow-hidden bg-stone-100 dark:bg-stone-900 select-text">
                      {isSelectedDocPdf ? (
                        docLayoutMode === 'horizontal' ? (
                          <PdfHorizontalViewer
                            fileId={splitSelectedFile.id}
                            file={splitSelectedFile}
                            url={splitResolvedPdfUrl || splitSelectedFile.url}
                            docZoom={Math.round(viewerZoom * 100)}
                            layoutMode="horizontal"
                            currentPage={docCurrentPage}
                            onPageChange={setDocCurrentPage}
                            isFullscreen={isViewerMaximized}
                          />
                        ) : (
                          // Mode Vertical Natif Chromium (la barre supérieure noire complète avec zoom, dessin, compteur de pages, etc. comme dans Espace d'étude)
                          (() => {
                            const pdfUrl = splitResolvedPdfUrl || splitSelectedFile.url || '';
                            const cleanPdfBase = pdfUrl.split('#')[0];
                            const nativePdfUrl = cleanPdfBase ? `${cleanPdfBase}#toolbar=1&navpanes=0&view=FitH` : '';

                            if (nativePdfUrl) {
                              return (
                                <div className="w-full h-full flex-1 flex flex-col items-center overflow-hidden bg-stone-100 dark:bg-stone-900">
                                  <object
                                    key={`pdf-native-${splitSelectedFile.id || cleanPdfBase}`}
                                    data={nativePdfUrl}
                                    type="application/pdf"
                                    className="w-full h-full border-0 block flex-1"
                                    style={{ width: '100%', height: '100%' }}
                                  >
                                    <iframe
                                      key={`iframe-pdf-native-${splitSelectedFile.id || cleanPdfBase}`}
                                      src={nativePdfUrl}
                                      title={splitSelectedFile.name || 'Document PDF'}
                                      className="w-full h-full border-0 block flex-1"
                                      style={{ width: '100%', height: '100%' }}
                                    />
                                  </object>
                                </div>
                              );
                            }

                            return (
                              <PdfHorizontalViewer
                                fileId={splitSelectedFile.id}
                                file={splitSelectedFile}
                                url={splitSelectedFile.url}
                                docZoom={Math.round(viewerZoom * 100)}
                                layoutMode="vertical"
                                currentPage={docCurrentPage}
                                onPageChange={setDocCurrentPage}
                                isFullscreen={isViewerMaximized}
                              />
                            );
                          })()
                        )
                      ) : (
                        <ModernDocumentViewer
                          fileId={splitSelectedFile.id}
                          url={splitSelectedFile.url}
                          fileName={splitSelectedFile.name}
                          fileSize={splitSelectedFile.size}
                          className="w-full h-full border-0 rounded-none shadow-none"
                        />
                      )}
                    </div>
                  )}

                  {/* 6. FICHIERS DIVERS / ARCHIVES */}
                  {!isSelectedImage && !isSelectedVideo && !isSelectedAudio && !isSelectedNotepad && !isSelectedDoc && (
                    <div className={`w-full bg-[#121826] border border-white/10 rounded-3xl p-8 text-center space-y-5 ${
                      isViewerMaximized ? 'max-w-xl my-auto' : 'max-w-md my-auto'
                    }`}>
                      <div className="w-16 h-16 rounded-2xl bg-black border border-sky-400/40 text-sky-400 flex items-center justify-center mx-auto shadow-xl">
                        <Archive className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{splitSelectedFile.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">{splitSelectedFile.size} • Archive / Paquet StudyCloud</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(splitSelectedFile)}
                        className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 mx-auto shadow-md"
                      >
                        <Download className="w-4 h-4" /> Télécharger le fichier
                      </button>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              (currentSubView.id === 'studycloud-category-audio' || (isCloudView && cloudActiveTab === 'audio')) && (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] p-8 text-center select-none bg-[#111622] dark:bg-[#0c101b] border-t md:border-t-0 md:border-l border-white/10 animate-in fade-in duration-200">
                  {/* Logo de mélodie très détaillé : double croche avec notes blanches illuminées, stems et ondes sonores */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-[0_8px_30px_rgba(245,158,11,0.45)] border-2 border-white/30 ring-4 ring-black/40 relative mb-4">
                    {/* Cercle vinyle intérieur discret */}
                    <div className="absolute inset-2 rounded-full border border-white/20 pointer-events-none" />
                    
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Ondes de mélodie acoustique fines */}
                      <path d="M2.5 10.5C2.5 7.8 4.2 5.5 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                      <path d="M21.5 10.5C21.5 7.8 19.8 5.5 17.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                      
                      {/* Tiges et double liaison musicale */}
                      <path d="M9 16.5V5.5L20 3.5V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 9.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      
                      {/* Tête de note 1 (gauche) blanche avec contour net */}
                      <ellipse cx="6" cy="16.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 6 16.5)" />
                      {/* Tête de note 2 (droite) blanche avec contour net */}
                      <ellipse cx="17" cy="14.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 17 14.5)" />
                    </svg>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-200">
                    Aucun son sélectionné
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Sélectionnez une piste musicale dans la liste de gauche pour lancer la lecture.
                  </p>
                </div>
              )
            )}

          </div>

        </div>
      ) : (
        /* ========================================================================= */
        /* VUE PRINCIPALE DIRECTE : GESTIONNAIRE STUDYCLOUD SANS LES DEUX BOUTONS    */
        /* ========================================================================= */
        <>
          {/* EN-TÊTE FIXE / STICKY : Barre de recherche pilule AU MILIEU */}
          <div className="sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 pt-2.5 pb-2.5 border-b border-stone-300/70 dark:border-slate-800/60 shadow-xs">
            <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
              
              {/* GAUCHE : Bouton Retour rapide vers l'accueil */}
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title="Retour au Tableau de bord"
                  aria-label="Retour"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </button>
              </div>

              {/* MILIEU : Barre de Recherche Pilule AU CENTRE */}
              <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto relative flex items-center px-1 sm:px-2">
                <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 transition-all shadow-inner gap-2">
                  
                  {/* Icône Menu hamburger intégrée à gauche */}
                  <div className="text-white shrink-0">
                    <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Recherchez photos, cours, documents...'
                    className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
                  />

                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Effacer la recherche"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="p-1 text-slate-300 shrink-0">
                      <Search className="w-4 h-4 stroke-[2.2]" />
                    </div>
                  )}
                </div>
              </div>

              {/* DROITE : Bouton + Importer un fichier et Plein écran */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTriggerImport}
                  className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/15 hover:border-blue-400/40 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
                  title="Importer un fichier dans StudyCloud"
                >
                  <Plus className="w-4 h-4 text-blue-400 stroke-[2.5]" />
                  <span className="hidden xs:inline">Importer un fichier</span>
                  <span className="xs:hidden">Importer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet (Prendre tout l'écran)"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                  ) : (
                    <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* CORPS PRINCIPAL DIRECT : SANS LES DEUX BOUTONS, DIRECTEMENT LE MENU STUDYCLOUD */}
          <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 pb-48 sm:pb-64 space-y-4 sm:space-y-5">

            {/* SECTION 1 : RÉCENTS (STRICTEMENT 6 ÉLÉMENTS SUR 1 LIGNE) */}
            {displayedFiles.length > 0 && (
              <section className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                    Récents
                  </h2>
                </div>

                {/* Grille STRICTEMENT sur 1 ligne : 6 colonnes sur écran moyen/grand */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3.5 overflow-x-auto md:overflow-visible no-scrollbar">
                  {displayedFiles.map((file) => {
                    const isSaving = savingFileProgress[file.id] !== undefined;
                    const progressVal = savingFileProgress[file.id] || 0;

                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          if (isSaving) {
                            showToast("Enregistrement du fichier en cours... Veuillez patienter.");
                            return;
                          }
                          handleSelectFile(file);
                        }}
                        className={`group relative bg-[#151C2C] hover:bg-[#1A2338] border border-slate-800 hover:border-slate-700 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col ${
                          menuOpenId === file.id ? 'z-50 relative overflow-visible' : 'z-10'
                        } ${isSaving ? 'cursor-wait select-none' : ''}`}
                      >
                        {/* Petit trait de progression d'enregistrement en haut de la carte */}
                        {isSaving && (
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
                            <div 
                              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
                              style={{ width: `${progressVal}%` }}
                            />
                          </div>
                        )}

                        {/* Vignette compacte */}
                        <div className={`w-full h-24 sm:h-28 md:h-28 bg-slate-900 relative rounded-t-2xl flex items-center justify-center ${menuOpenId === file.id ? 'overflow-visible z-50' : 'overflow-hidden'}`}>
                          <div className="absolute inset-0 rounded-t-2xl overflow-hidden pointer-events-none">
                            {(file.category === 'images' || file.isImage || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name)) ? (
                              <RecentImageCardPreview file={file} />
                            ) : (file.category === 'videos' || Boolean(file.videoUrl) || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name)) ? (
                              <VideoCardPreview vid={file} />
                            ) : (file.category === 'documents' || /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(file.name)) ? (
                              <DocumentCardPreview doc={file} />
                            ) : (file.category === 'audio' || Boolean(file.audioUrl) || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(file.name)) ? (
                              <AudioCardPreview track={file} />
                            ) : file.previewUrl ? (
                              <img 
                                src={file.previewUrl} 
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3">
                                {file.category === 'documents' && <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400/85 stroke-[1.8]" />}
                                {file.category === 'audio' && <Music className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400/85 stroke-[1.8]" />}
                                {file.category === 'videos' && <Film className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400/85 stroke-[1.8]" />}
                                {file.category === 'downloads' && <Download className="w-8 h-8 sm:w-10 sm:h-10 text-sky-400/85 stroke-[1.8]" />}
                                {file.category === 'images' && <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400/85 stroke-[1.8]" />}
                                {file.category === 'apps' && <LayoutGrid className="w-8 h-8 sm:w-10 sm:h-10 text-pink-400/85 stroke-[1.8]" />}
                              </div>
                            )}
                          </div>

                          {/* Bouton 3 petits points verticaux en haut à droite */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === file.id ? null : file.id);
                            }}
                            className="studycloud-menu-trigger absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 hover:bg-black flex items-center justify-center text-white transition-colors cursor-pointer shadow-md z-20 border border-white/20"
                            title="Options du fichier"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Menu contextuel 3 points */}
                          {menuOpenId === file.id && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="studycloud-file-menu-panel absolute top-9 right-1.5 z-50 w-44 bg-[#0A0F1D] border-2 border-slate-600/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.15)] py-1.5 text-xs font-semibold text-white animate-in fade-in zoom-in-95 overflow-hidden divide-y divide-white/10"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRecentFile(file.id, file);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-rose-500/20 flex items-center gap-2 cursor-pointer text-rose-400 hover:text-rose-300 transition-colors"
                                title="Supprimer définitivement ce fichier"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Effacer
                              </button>
                              <button
                                onClick={() => {
                                  handleShareFile(file);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-white transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5 text-emerald-400" /> Partager
                              </button>
                              <button
                                onClick={() => {
                                  handleDownloadFile(file);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-white transition-colors"
                              >
                                <Download className="w-3.5 h-3.5 text-amber-400" /> Télécharger
                              </button>
                              <button
                                onClick={() => {
                                  handleGenericFileAction('lock_file', file, cloudRecentFiles);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-amber-300 transition-colors"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-400" /> Verrouiller
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Bas de carte avec Nom et Emplacement */}
                        <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-[#151C2C] rounded-b-2xl">
                          <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                            <span className="truncate max-w-[85px]">{file.source}</span>
                            <span className="shrink-0 font-medium">{file.size}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ========================================================================= */}
            {/* BOUTON CLASSEUR : BIEN AU MILIEU, COULEUR ORANGE DOUCE                    */}
            {/* ========================================================================= */}
            <div className="w-full flex items-center justify-center py-2 sm:py-3">
              <button
                type="button"
                onClick={() => handleOpenSubMenu('classeur', 'classeur', 'Classeur', FolderArchive, 'text-orange-400')}
                className="group relative flex items-center justify-center gap-3 px-8 sm:px-14 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] hover:from-[#D15C1B] hover:via-[#C55010] hover:to-[#AC430A] text-white border border-orange-500/40 shadow-[0_6px_25px_rgba(184,72,12,0.35)] hover:shadow-[0_8px_30px_rgba(184,72,12,0.5)] transition-all duration-200 cursor-pointer active:scale-95 select-none"
                title="Ouvrir le Classeur"
              >
                <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/20 shrink-0 group-hover:scale-110 transition-transform">
                  <FolderArchive className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.2]" />
                </div>
                <span className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide drop-shadow-sm">
                  Classeur
                </span>
              </button>
            </div>

            {/* SECTION 2 : CATÉGORIES (Chaque bouton ouvre son propre menu indépendant) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Catégories
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                {categories.map((cat) => {
                  const IconComp = cat.icon;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleOpenSubMenu('category', cat.id, cat.name, cat.icon, cat.color)}
                      className="group rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 transition-all duration-200 cursor-pointer select-none border shadow-md bg-[#04060A] hover:bg-[#0A0E18] border-white/10 hover:border-blue-400/50 active:scale-95"
                    >
                      <div className={`p-2 rounded-xl bg-black border border-white/10 shrink-0 group-hover:scale-110 transition-transform ${cat.color}`}>
                        <IconComp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-black text-white truncate tracking-wide group-hover:text-blue-400 transition-colors">
                          {cat.name}
                        </h3>
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-100 truncate mt-0.5">
                          {cat.size}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 3 : COLLECTIONS (Chaque bouton ouvre son propre menu indépendant) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Collections
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {collections.map((col) => {
                  const IconComp = col.icon;
                  return (
                    <div
                      key={col.id}
                      onClick={() => {
                        if (col.id === 'secure-folder') {
                          if (isSecureFolderUnlocked) {
                            handleOpenSubMenu('collection', col.id, col.name, col.icon, col.color);
                          } else {
                            setPinTargetDestination('collection');
                            setIsPinModalOpen(true);
                            setSecurePinInput('');
                            setSecurePinConfirmInput('');
                            setSecurePinError(null);
                          }
                        } else {
                          handleOpenSubMenu('collection', col.id, col.name, col.icon, col.color);
                        }
                      }}
                      className="group rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 bg-[#04060A] hover:bg-[#0A0E18] border border-white/10 hover:border-blue-400/50 transition-all duration-200 cursor-pointer select-none shadow-md active:scale-95"
                    >
                      <div className={`p-2 rounded-xl bg-black border border-white/10 shrink-0 group-hover:scale-110 transition-transform ${col.color}`}>
                        <IconComp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-black text-white truncate tracking-wide group-hover:text-blue-400 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </>
      )}

      {/* Modal de changement de code PIN (Image 2) */}
      {renderChangePinModal()}

      {/* Modal de déverrouillage / code PIN du Dossier Sécurisé avec bouton croix */}
      {renderSecureFolderLockScreen()}

      {/* Grand modal de propositions de création de dossier (Modèles 3D) */}
      {renderCreateFolderModal()}

      {/* Modal de question préliminaire : Déplacer ou Créer une copie */}
      {renderTransferPromptModal()}

      {/* Modal de sélection des dossiers de destination pour Déplacer / Créer une copie */}
      {renderTransferFolderModal()}

      {/* Petit modal pour nommer et créer un fichier Bloc-notes (TXT) */}
      {renderNewNoteModal()}

      {/* Modal / Vue d'écriture Bloc-notes */}
      {renderNotepadEditorModal()}

      {/* Clone flottant lors du Drag & Drop pour réordonner librement les dossiers 3D */}
      {folderDragState && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: folderDragState.x - folderDragState.offsetX,
            top: folderDragState.y - folderDragState.offsetY,
            width: folderDragState.width,
            zIndex: 9999999,
            pointerEvents: 'none',
            touchAction: 'none',
          }}
          className={`${getFolderCardPadding(folderZoomLevel)} border-2 border-orange-400 ring-4 ring-orange-500/50 bg-[#0E1526] shadow-[0_25px_60px_rgba(0,0,0,0.85)] scale-105 rotate-1 select-none overflow-hidden`}
        >
          <div className={`${getFolderTopSpacing(folderZoomLevel)} w-full`}>
            <Classeur3DFolderCard folder={folderDragState.folder} />
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification sans 3D, au-dessus de tous les éléments via Portal */}
      {profileToastMessage && createPortal(
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999999] pointer-events-auto max-w-md w-[92%] sm:w-auto px-4 py-2.5 rounded-xl bg-[#0f172a] border border-emerald-500/50 text-white shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">
              {profileToastMessage}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setProfileToastMessage(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}

    </div>
  );
};
