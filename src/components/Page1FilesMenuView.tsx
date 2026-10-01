import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  AlertTriangle,
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
  Palette,
  Loader2,
  ArrowDownWideNarrow
} from 'lucide-react';
import { getWorkerApiUrl, StudyCloudAPI } from '../services/api';
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
import { CloudStorageAPI, type CloudOverviewData } from '../services/cloudStorageService';
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
import { CloudDataStore, isRecentEligible } from '../services/cloudDataStore';
import { LocalSyncReplication } from '../services/localSyncReplication';
import { UploadQueue } from '../services/uploadQueue';
import { UploadQueueWidget } from './UploadQueueWidget';
import { invalidateCloudQueries } from '../services/queryClient';
import { compressFile } from '../utils/fileCompressor';
import {
  detectFileCategory,
  detectFileCategoryWithMagic,
  validateFilesForMenu,
  validateFilesForMenuAsync,
  CATEGORY_LABELS,
  isWhatsAppAudio,
  isWhatsAppVideo,
  isWhatsAppImage,
  EXTENSION_MAP
} from '../services/fileTypeValidator';
import { AudioMenuView } from './AudioMenuView';
import { DocumentsMenuView } from './DocumentsMenuView';
import { VideosMenuView } from './VideosMenuView';
import { ImagesMenuView } from './ImagesMenuView';
import { TrashMenuView } from './TrashMenuView';
import { FavoritesMenuView } from './FavoritesMenuView';
import { AppsMenuView } from './AppsMenuView';
import { CloudSpaceMenuView } from './CloudSpaceMenuView';
import { DownloadsMenuView } from './DownloadsMenuView';
import { SecureFolderMenuView } from './SecureFolderMenuView';
import { 
  type SortOption, 
  applyFileSorting, 
  restoreDefaultWallpaperAndAvatar,
  HeaderMenuControls,
  parseSizeToBytes
} from './HeaderMenuControls';

// Nettoyage immédiat de tout fichier figé en localStorage pour éviter le plantage QuotaExceededError
if (typeof window !== 'undefined') {
  try {
    [
      'studycloud_documents_files',
      'studycloud_images_files',
      'studycloud_videos_files',
      'studycloud_audio_files',
      'studycloud_recent_files',
      'studycloud_folder_files_map',
      'studycloud_trash_files',
      'studycloud_secure_files',
      'studycloud_secure_folder_files',
      'studycloud_downloaded_items',
      'studycloud_downloaded_files',
      'studycloud_classeur_3d_folders',
    ].forEach(k => localStorage.removeItem(k));
  } catch {}
}

interface Page1FilesMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[], isFullscreen?: boolean) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export interface FileItem {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps' | 'classeur' | 'folder' | string;
  source?: string;
  sourceCategory?: string;
  size: string;
  sizeBytes?: number;
  date: string;
  previewUrl?: string;
  isImage?: boolean;
  videoUrl?: string;
  audioUrl?: string;
  documentCategory?: 'COURS' | 'TD' | 'DEVOIRS' | "PAS D'INF..." | string;
  extension?: string;
  downloadsCount?: number;
  isFavorite?: boolean;
  isSecure?: boolean;
  isPinned?: boolean;
  isFolder?: boolean;
  isAudio?: boolean;
  isVideo?: boolean;
  isTrash?: boolean;
  thumbnailUrl?: string;
  coverUrl?: string;
  metadata?: any;
  type?: string;
  folderId?: string;
  artist?: string;
  album?: string;
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
  isSyncError?: boolean;
  uploadError?: string;
  isUploading?: boolean;
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
      if (Array.isArray(arr)) {
        return new Set(arr.filter((x: any) => typeof x === 'string' && !/\.[a-z0-9]{2,5}$/i.test(x)));
      }
    }
  } catch {}
  return new Set();
}

function markFileLocallyDeleted(id: string, _name?: string): void {
  try {
    const set = getLocallyDeletedFileIds();
    if (id) set.add(id);
    localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(Array.from(set).slice(-500)));
  } catch {}
}

function unmarkFileLocallyDeleted(id: string, _name?: string): void {
  try {
    const set = getLocallyDeletedFileIds();
    if (id) set.delete(id);
    localStorage.setItem('studycloud_deleted_file_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

function getDeletedRecentIds(): Set<string> {
  try {
    const raw = localStorage.getItem('studycloud_deleted_recent_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.filter((x: any) => typeof x === 'string' && !/\.[a-z0-9]{2,5}$/i.test(x)));
      }
    }
  } catch {}
  return new Set();
}

function markRecentLocallyDeleted(id: string, _name?: string): void {
  try {
    const set = getDeletedRecentIds();
    if (id) set.add(id);
    localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(set).slice(-500)));
  } catch {}
}

function unmarkRecentLocallyDeleted(id: string, _name?: string): void {
  try {
    const set = getDeletedRecentIds();
    if (id) set.delete(id);
    localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

const RecentImageCardPreview: React.FC<{ file: FileItem }> = ({ file }) => {
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const directUrl = file.previewUrl || file.url;
  const src = (directUrl && (directUrl.startsWith('blob:') || directUrl.startsWith('data:')))
    ? directUrl
    : (directUrl && directUrl.startsWith('http') && !directUrl.includes('localhost')
      ? directUrl
      : `${baseUrl}/api/cloud/stream/${encodeURIComponent(file.id)}`);

  return (
    <img
      src={src}
      alt={file.name}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
      loading="lazy"
    />
  );
};



export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack, onOpenStudySpace, onOpenCreateShareLink }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<'all' | 'documents' | 'images' | 'videos' | 'audio' | 'classeur' | 'downloads'>('all');

  // Historique des recherches récentes (5 max, persistance localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('studycloud_recent_searches');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter(s => typeof s === 'string' && s.trim()).slice(0, 5);
      }
    } catch {}
    return [];
  });
  const [showRecentSearchesMenu, setShowRecentSearchesMenu] = useState(false);
  const recentSearchesMenuRef = useRef<HTMLDivElement>(null);

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem('studycloud_recent_searches', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (recentSearchesMenuRef.current && !recentSearchesMenuRef.current.contains(e.target as Node)) {
        setShowRecentSearchesMenu(false);
      }
    };
    if (showRecentSearchesMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRecentSearchesMenu]);

  // Sauvegarder automatiquement après un court délai de frappe si la requête est consistante
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 3) return;
    const t = setTimeout(() => {
      saveRecentSearch(q);
    }, 1200);
    return () => clearTimeout(t);
  }, [searchQuery, saveRecentSearch]);

  const [docMenuOpenId, setDocMenuOpenId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Menu dédié indépendant actif
  const [activeDedicatedMenu, setActiveDedicatedMenu] = useState<
    'audio' | 'documents' | 'videos' | 'images' | 'trash' | 'favorites' | 'apps' | 'cloud-storage' | 'downloads' | 'secure-folder' | null
  >(null);

  // =========================================================================
  // ÉTAT DE LA DIVISION EN DEUX (SPLIT SCREEN) & LECTEUR GRAND FORMAT
  // =========================================================================
  const [splitSelectedFile, setSplitSelectedFile] = useState<FileItem | null>(null);

  // =========================================================================
  // ÉTATS INDÉPENDANTS POUR CHAQUE LECTEUR (IMAGE 1 À 5)
  // =========================================================================
  const [selectedDocFile, setSelectedDocFile] = useState<FileItem | null>(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<FileItem | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<FileItem | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<FileItem | null>(null);
  const [selectedDownloadFile, setSelectedDownloadFile] = useState<FileItem | DownloadedItem | null>(null);
  const [selectedClasseurFile, setSelectedClasseurFile] = useState<FileItem | null>(null);
  const [selectedCollectionFile, setSelectedCollectionFile] = useState<FileItem | null>(null);

  const [splitResolvedPdfUrl, setSplitResolvedPdfUrl] = useState<string>('');
  const [splitResolvedAudioUrl, setSplitResolvedAudioUrl] = useState<string>('');
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
  const [sortOption, setSortOption] = useState<SortOption>('recent');
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

  // Liste ordonnée des dossiers 3D du Classeur (en mémoire de session)
  const [classeur3DFolders, setClasseur3DFolders] = useState<ClasseurCreatedFolder[]>(() => 
    CloudDataStore.hasData() ? CloudDataStore.getState().classeurFolders : []
  );

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

  // Dossier 3D du Classeur actuellement ouvert pour afficher son menu dédié et ses fichiers
  const [opened3DFolder, setOpened3DFolder] = useState<ClasseurCreatedFolder | null>(null);

  // Fermer immédiatement et proprement tout lecteur ouvert dès qu'on quitte ou change de dossier 3D
  useEffect(() => {
    setSelectedClasseurFile(null);
    setSplitSelectedFile(null);
    setIsViewerMaximized(false);
  }, [opened3DFolder]);

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

  // Table des fichiers par dossier 3D créé (en mémoire de session)
  const [folderFilesMap, setFolderFilesMap] = useState<Record<string, FileItem[]>>(() => 
    CloudDataStore.hasData() ? CloudDataStore.getState().folderFilesMap : {}
  );

  const folderFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverFolder, setIsDraggingOverFolder] = useState<boolean>(false);

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
  const handleFolderFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, folderId: string, skipDuplicateCheck?: boolean) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let files = Array.from(e.target.files) as File[];
    if (files.length > MAX_IMPORT_FILES) {
      showProfileToast(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`, 'warning');
      files = files.slice(0, MAX_IMPORT_FILES);
    }
    const targetFolder = classeur3DFolders.find(f => f.id === folderId);
    const folderName = targetFolder ? targetFolder.name : 'Dossier';

    // DÉTECTION DES DOUBLONS DANS LE DOSSIER DE L'UTILISATEUR
    if (!skipDuplicateCheck) {
      const dupes = checkDuplicateFiles(files, 'classeur', folderId);
      if (dupes.length > 0) {
        setDuplicateImportModal({
          duplicateFileNames: dupes,
          allFilesCount: files.length,
          menuLabel: `dossier "${folderName}"`,
          onConfirm: () => {
            setDuplicateImportModal(null);
            handleFolderFileUpload(e, folderId, true);
          },
          onCancel: () => {
            setDuplicateImportModal(null);
            if (e.target) e.target.value = '';
          }
        });
        return;
      }
    }

    const newItemsWithFiles = await Promise.all(files.map(async (f: File, idx) => {
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
      let category: FileItem['category'] = 'documents';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) category = 'images';
      else if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) category = 'videos';
      else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) category = 'audio';

      // Compression intelligente tout en préservant la vraie taille d'origine
      const compResult = await compressFile(f, category);
      const fileToStore = compResult.file;
      const fileId = `cf-${folderId}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(fileToStore);

      // Stocker le binaire optimisé immédiatement dans IndexedDB
      storeFileBlob(fileId, fileToStore as any).catch(() => {});

      const item: FileItem = {
        id: fileId,
        name: f.name,
        category,
        source: folderName,
        size: compResult.originalSizeFormatted,
        sizeBytes: compResult.originalSizeBytes,
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

      return {
        file: fileToStore,
        item,
        originalSizeBytes: compResult.originalSizeBytes,
        originalSizeFormatted: compResult.originalSizeFormatted
      };
    }));

    const newFiles = newItemsWithFiles.map(x => x.item);

    setFolderFilesMap(prev => ({
      ...prev,
      [folderId]: [...newFiles, ...(prev[folderId] || [])]
    }));

    startSavingAnimation(newFiles.map(f => f.id));

    // Débloquer des récents supprimés, synchroniser dans CloudDataStore et D1
    newFiles.forEach(f => {
      unmarkRecentLocallyDeleted(f.id);
      unmarkFileLocallyDeleted(f.id);
      CloudDataStore.addOptimisticFile(f, folderId);
      LocalSyncReplication.recordLocalUpsert(f.id, 'classeur', {
        ...f,
        folderId
      });
      CloudStorageAPI.saveClasseurFile(f, folderId).catch(() => {});
    });
    const eligibleRecent = newFiles.filter(isRecentEligible);
    if (eligibleRecent.length > 0) {
      setCloudRecentFiles(prev => {
        const existingIds = new Set(eligibleRecent.map(f => f.id));
        return [...eligibleRecent, ...prev.filter(f => !existingIds.has(f.id))].slice(0, 6);
      });
    }

    // Sauvegarde en arrière-plan via UploadQueue (max 2 parallèles, auto-retry, notifications)
    UploadQueue.enqueueExisting(
      newItemsWithFiles,
      { category: 'classeur', folderId, folderName }
    );

    showToast(`${newFiles.length} fichier(s) importé(s) dans "${folderName}" !`);
    e.target.value = '';
  };

  const handleDirectFilesImportToFolder = async (fileList: FileList, folderId: string, skipDuplicateCheck?: boolean) => {
    const files = Array.from(fileList) as File[];
    const targetFolder = classeur3DFolders.find(f => f.id === folderId);
    const folderName = targetFolder ? targetFolder.name : 'Dossier';

    // DÉTECTION DES DOUBLONS DANS LE DOSSIER DE L'UTILISATEUR
    if (!skipDuplicateCheck) {
      const dupes = checkDuplicateFiles(files, 'classeur', folderId);
      if (dupes.length > 0) {
        setDuplicateImportModal({
          duplicateFileNames: dupes,
          allFilesCount: files.length,
          menuLabel: `dossier "${folderName}"`,
          onConfirm: () => {
            setDuplicateImportModal(null);
            handleDirectFilesImportToFolder(fileList, folderId, true);
          },
          onCancel: () => {
            setDuplicateImportModal(null);
          }
        });
        return;
      }
    }

    const newItemsWithFiles = await Promise.all(files.map(async (f: File, idx) => {
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
      let category: FileItem['category'] = 'documents';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) category = 'images';
      else if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) category = 'videos';
      else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) category = 'audio';

      // Compression intelligente tout en préservant la vraie taille d'origine
      const compResult = await compressFile(f, category);
      const fileToStore = compResult.file;
      const fileId = `cf-${folderId}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(fileToStore);

      // Stocker le binaire optimisé immédiatement dans IndexedDB
      storeFileBlob(fileId, fileToStore as any).catch(() => {});

      const item: FileItem = {
        id: fileId,
        name: f.name,
        category,
        source: folderName,
        size: compResult.originalSizeFormatted,
        sizeBytes: compResult.originalSizeBytes,
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

      return {
        file: fileToStore,
        item,
        originalSizeBytes: compResult.originalSizeBytes,
        originalSizeFormatted: compResult.originalSizeFormatted
      };
    }));

    const newFiles = newItemsWithFiles.map(x => x.item);

    setFolderFilesMap(prev => ({
      ...prev,
      [folderId]: [...newFiles, ...(prev[folderId] || [])]
    }));

    startSavingAnimation(newFiles.map(f => f.id));

    // Les récents d'accueil affichent les fichiers nouvellement importés
    newFiles.forEach(f => {
      unmarkRecentLocallyDeleted(f.id);
      unmarkFileLocallyDeleted(f.id);
      CloudDataStore.addOptimisticFile(f, folderId);
      LocalSyncReplication.recordLocalUpsert(f.id, 'classeur', {
        ...f,
        folderId
      });
      CloudStorageAPI.saveClasseurFile(f, folderId).catch(() => {});
    });
    const eligibleRecent = newFiles.filter(isRecentEligible);
    if (eligibleRecent.length > 0) {
      setCloudRecentFiles(prev => {
        const existingIds = new Set(eligibleRecent.map(f => f.id));
        return [...eligibleRecent, ...prev.filter(f => !existingIds.has(f.id))].slice(0, 6);
      });
    }

    // Sauvegarde en arrière-plan via UploadQueue (max 2 parallèles, auto-retry, notifications)
    UploadQueue.enqueueExisting(
      newItemsWithFiles,
      { category: 'classeur', folderId, folderName }
    );

    showToast(`${newFiles.length} fichier(s) importé(s) dans "${folderName}" !`);
  };

  const handleDeleteFileFromFolder = (folderId: string, fileId: string) => {
    const fileToDelete = (folderFilesMap[folderId] || []).find(f => f.id === fileId);
    if (fileToDelete) {
      const trashed = { ...fileToDelete, originalFolderId: folderId, isTrash: true };
      setTrashFiles(prev => [trashed, ...prev.filter(f => f.id !== fileId)]);
      CloudDataStore.moveToTrash(trashed as any);
      markFileLocallyDeleted(fileId);
      markRecentLocallyDeleted(fileId);
    } else {
      CloudDataStore.removeFile(fileId, folderId);
      markFileLocallyDeleted(fileId);
      markRecentLocallyDeleted(fileId);
    }
    setFolderFilesMap(prev => ({
      ...prev,
      [folderId]: (prev[folderId] || []).filter(f => f.id !== fileId)
    }));
    setCloudRecentFiles(prev => prev.filter(f => f.id !== fileId));
    removeDownloadedFile(fileId);
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
      CloudDataStore.updateFile(file.id, { name: finalName }, folderId);
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
      category: 'notes',
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
    CloudDataStore.addOptimisticFile(newNoteFile as any, opened3DFolder.id);
    LocalSyncReplication.recordLocalUpsert(newNoteFile.id, 'classeur', {
      ...newNoteFile,
      folderId: opened3DFolder.id
    });

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
        const fileList = files as FileItem[];
        if (Array.isArray(fileList) && fileList.some(f => f.id === targetId)) {
          next[folderId] = fileList.map(f => f.id === targetId ? {
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
  const justDraggedFolderRef = useRef<boolean>(false);
  const folderPointerDownRef = useRef<{
    x: number;
    y: number;
    currentX: number;
    currentY: number;
    pointerType: string;
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

      // Si le glissement n'est pas encore actif
      if (!p.isDragging) {
        // Sur ordinateur avec souris : déclenchement immédiat et fluide dès 5px de déplacement (comme avant)
        if (p.pointerType === 'mouse' && (deltaX > 5 || deltaY > 5)) {
          if (folderLongPressTimerRef.current) {
            clearTimeout(folderLongPressTimerRef.current);
            folderLongPressTimerRef.current = null;
          }
          p.isDragging = true;
          p.isHoldActive = true;
          setHoldingFolderId(p.folder.id);
          document.body.style.cursor = 'grabbing';
          setFolderDragState({
            folder: p.folder,
            x: p.currentX,
            y: p.currentY,
            width: p.cardRect.width,
            height: p.cardRect.height,
            offsetX: p.x - p.cardRect.left,
            offsetY: p.y - p.cardRect.top,
          });
        } else if (p.pointerType === 'touch') {
          // Sur tactile : si mouvement significatif avant le maintien continu, annuler pour autoriser le défilement
          if (!p.isHoldActive && (deltaX > 10 || deltaY > 10)) {
            if (folderLongPressTimerRef.current) {
              clearTimeout(folderLongPressTimerRef.current);
              folderLongPressTimerRef.current = null;
            }
          }
        }
      }

      // Le glissement est actif : mise à jour de la position et échange dynamique de position
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
        // Clic simple rapide sans déplacement : ouvre le dossier avec le curseur flèche normal
        if (deltaX < 6 && deltaY < 6) {
          setOpened3DFolder(p.folder);
        }
      } else if (p && p.isDragging) {
        // Empêcher le clic parasite qui réouvrirait le dossier à la fin du glissement
        justDraggedFolderRef.current = true;
        setTimeout(() => {
          justDraggedFolderRef.current = false;
        }, 120);

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

    // Règle d'organisation : on ne peut pas déplacer un élément s'il est seul dans le dossier
    const rootFolders = classeur3DFolders.filter(f => !f.parentId);
    if (rootFolders.length <= 1) return;

    const cardElement = (e.currentTarget as HTMLElement);
    const rect = cardElement.getBoundingClientRect();

    folderPointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      pointerType: e.pointerType,
      folder,
      cardRect: rect,
      isDragging: false,
      isHoldActive: false,
    };

    if (folderLongPressTimerRef.current) {
      clearTimeout(folderLongPressTimerRef.current);
      folderLongPressTimerRef.current = null;
    }

    // Sur mobile (tactile) uniquement : maintien bref (200ms) pour activer le glisser-déplacer
    if (e.pointerType === 'touch') {
      folderLongPressTimerRef.current = setTimeout(() => {
        if (folderPointerDownRef.current) {
          folderPointerDownRef.current.isHoldActive = true;
          folderPointerDownRef.current.isDragging = true;
          setHoldingFolderId(folder.id);

          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(35); } catch {}
          }

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
      }, 200);
    }
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
        toDeleteIds.forEach(id => {
          LocalSyncReplication.recordLocalDeletion(id, 'classeur_folder');
          CloudDataStore.removeFolder(id);
        });
        CloudDataStore.moveToTrash([...folderTrashItems, ...deletedFolderFiles] as any);
        return next;
      });
      return prev.filter(f => !toDeleteIds.includes(f.id));
    });
    showToast(targetFolder ? `Dossier "${targetFolder.name}" déplacé dans la corbeille` : 'Dossier déplacé dans la corbeille');
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

  // Téléchargements réels synchronisés (en mémoire de session et IndexedDB/localStorage)
  const [downloadedItems, setDownloadedItems] = useState<DownloadedItem[]>(() => {
    try {
      const local = getDownloadedFiles();
      if (local && local.length > 0) return local;
    } catch {}
    return CloudDataStore.getState().downloads || [];
  });

  useEffect(() => {
    try {
      const local = getDownloadedFiles();
      if (local && local.length > 0) {
        setDownloadedItems(local);
      } else {
        const storeDls = CloudDataStore.getState().downloads;
        if (storeDls && storeDls.length > 0) {
          setDownloadedItems(storeDls);
        }
      }
    } catch {}

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        if (e.detail.deleted) {
          setDownloadedItems(prev => prev.filter(f => f.id !== e.detail.id));
        } else if (e.detail.id) {
          setDownloadedItems(prev => [e.detail, ...prev.filter(f => f.id !== e.detail.id)]);
        }
      }
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

  // Références dédiées et isolées pour chaque bouton d'importation
  const fileInputRef = useRef<HTMLInputElement>(null); // Accueil (+ Importer)
  const videoFileInputRef = useRef<HTMLInputElement>(null); // Menu Vidéos
  const audioFileInputRef = useRef<HTMLInputElement>(null); // Menu Audio / Musique
  const imageFileInputRef = useRef<HTMLInputElement>(null); // Menu Images
  const documentFileInputRef = useRef<HTMLInputElement>(null); // Menu Documents
  const classeurFolderFileInputRef = useRef<HTMLInputElement>(null); // Dossier ouvert du Classeur
  // Référence pour préserver la sélection lors de la transition vers un menu
  const preserveSelectionFileIdRef = useRef<string | null>(null);

  // Sous-page ouverte
  const [currentSubView, setCurrentSubView] = useState<SubMenuView | null>(null);

  // Fermer immédiatement et proprement tous les lecteurs dès qu'on quitte ou change de sous-vue
  // (sauf si un fichier vient d'être sélectionné pour lecture dans le nouveau menu)
  useEffect(() => {
    // Si on quitte vers l'accueil (currentSubView null), tout réinitialiser
    if (!currentSubView) {
      preserveSelectionFileIdRef.current = null;
      setSelectedDocFile(null);
      setSelectedAudioTrack(null);
      setSelectedVideoFile(null);
      setSelectedImageFile(null);
      setSelectedDownloadFile(null);
      setSelectedClasseurFile(null);
      setSelectedCollectionFile(null);
      setSplitSelectedFile(null);
      setIsViewerMaximized(false);
      return;
    }

    // Si un fichier vient d'être sélectionné pour ce menu, le conserver impérativement pour la lecture
    if (preserveSelectionFileIdRef.current) {
      if (!splitSelectedFile || splitSelectedFile.id === preserveSelectionFileIdRef.current) {
        return;
      }
    }

    // Si le fichier sélectionné actuel correspond à la sous-vue active, ne pas le fermer
    if (splitSelectedFile) {
      const viewId = currentSubView.id;
      const cat = splitSelectedFile.category;
      const isImg = cat === 'images' || splitSelectedFile.isImage;
      const isVid = cat === 'videos' || splitSelectedFile.isVideo || Boolean(splitSelectedFile.videoUrl);
      const isAud = cat === 'audio' || splitSelectedFile.isAudio || Boolean(splitSelectedFile.audioUrl);
      const isDoc = !isImg && !isVid && !isAud;

      if (viewId === 'studycloud-category-documents' && (isDoc || selectedDocFile?.id === splitSelectedFile.id)) return;
      if (viewId === 'studycloud-category-images' && (isImg || selectedImageFile?.id === splitSelectedFile.id)) return;
      if (viewId === 'studycloud-category-videos' && (isVid || selectedVideoFile?.id === splitSelectedFile.id)) return;
      if (viewId === 'studycloud-category-audio' && (isAud || selectedAudioTrack?.id === splitSelectedFile.id)) return;
      if (viewId === 'studycloud-category-downloads') return;
      if (viewId.startsWith('studycloud-classeur-') || currentSubView.type === 'classeur' || currentSubView.type === 'folder') return;
    }

    preserveSelectionFileIdRef.current = null;
    setSelectedDocFile(null);
    setSelectedAudioTrack(null);
    setSelectedVideoFile(null);
    setSelectedImageFile(null);
    setSelectedDownloadFile(null);
    setSelectedClasseurFile(null);
    setSelectedCollectionFile(null);
    setSplitSelectedFile(null);
    setIsViewerMaximized(false);
  }, [currentSubView, splitSelectedFile]);

  // État de l'onglet actif dans l'Espace Cloud (Classeur sélectionné par défaut comme demandé)
  const [cloudActiveTab, setCloudActiveTab] = useState<'classeur' | 'downloads' | 'images' | 'videos' | 'audio' | 'documents' | 'apps' | 'favorites' | 'secure-folder' | 'trash'>('classeur');
  const [selectedClasseurFolder, setSelectedClasseurFolder] = useState<string | null>(null);
  const [trashFiles, setTrashFiles] = useState<FileItem[]>(() => 
    CloudDataStore.hasData() ? (CloudDataStore.getState().trash as any[]) : []
  );

  // Suivi de l'état de chargement en direct de chaque catégorie / menu
  const [loadingCategories, setLoadingCategories] = useState(() => {
    const hasData = CloudDataStore.hasData();
    return {
      overview: !hasData,
      classeur: !hasData,
      documents: !hasData,
      images: !hasData,
      videos: !hasData,
      audio: !hasData,
      downloads: !hasData,
      trash: !hasData,
      secure: !hasData,
      favorites: !hasData,
      cloudStorage: !hasData
    };
  });
  const [cloudOverview, setCloudOverview] = useState<CloudOverviewData | null>(() => 
    CloudDataStore.hasData() ? CloudDataStore.getState().overview : null
  );

  // === Cache-First + Stale-While-Revalidate (architecture type Google Drive) ===
  useEffect(() => {
    let isMounted = true;

    // ── ÉTAPE 1 : Affichage INSTANTANÉ depuis le cache mémoire (0 ms) ──────────
    // Critique : sans cela, à la 2ème entrée le cooldown 15s empêche sync()
    // d'appeler notify(), donc les données n'apparaissent jamais.
    const cached = CloudDataStore.getState();
    if (CloudDataStore.hasData()) {
      const delIds = getLocallyDeletedFileIds();
      const delRecent = getDeletedRecentIds();
      const cleanList = (list: FileItem[]) => {
        const seenIds = new Set<string>();
        return list.filter(f => {
          if (delIds.has(f.id)) return false;
          if (seenIds.has(f.id)) return false;
          seenIds.add(f.id);
          return true;
        });
      };
      const cleanRecent = (list: FileItem[]) => {
        const seenIds = new Set<string>();
        return list.filter(f => {
          if (!f || !f.id) return false;
          if (delIds.has(f.id)) return false;
          if (delRecent.has(f.id)) return false;
          if (!isRecentEligible(f)) return false;
          if (seenIds.has(f.id)) return false;
          seenIds.add(f.id);
          return true;
        }).slice(0, 6);
      };
      setClasseur3DFolders(cached.classeurFolders);
      setFolderFilesMap(cached.folderFilesMap);
      setDownloadedItems(cached.downloads as any);
      setDocumentsList(cleanList(cached.documents as any[]) as any);
      setImagesList(cleanList(cached.images as any[]) as any);
      setVideosList(cleanList(cached.videos as any[]) as any);
      setAudioList(cleanList(cached.audio as any[]) as any);
      setCloudRecentFiles(cleanRecent(cached.recentFiles as any[]) as any);
      setSecureFolderFiles(cached.secure);
      setTrashFiles(cached.trash);
      setCloudOverview(cached.overview);
      setLoadingCategories({
        overview: false, classeur: false, documents: false, images: false,
        videos: false, audio: false, downloads: false, trash: false,
        secure: false, favorites: false, cloudStorage: false
      });
    }

    // ── ÉTAPE 2 : S'abonner aux mises à jour futures du store ─────────────────
    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (!isMounted) return;
      setClasseur3DFolders(state.classeurFolders);
      setFolderFilesMap(state.folderFilesMap);
      setDownloadedItems(state.downloads as any);
      const _delIds = getLocallyDeletedFileIds();
      const _delRecent = getDeletedRecentIds();
      const _isNotDeleted = (f: { id: string }) => !_delIds.has(f.id);
      const _isNotDeletedRecent = (f: any) => _isNotDeleted(f) && !_delRecent.has(f.id) && isRecentEligible(f);
      setDocumentsList(prev => {
        const stateIds = new Set(state.documents.map(d => d.id));
        const pending = prev.filter(p => !stateIds.has(p.id) && (p.id.startsWith('cf-') || p.isUploading) && _isNotDeleted(p));
        // Final dedup by ID to ensure no duplicates in the merged result
        const merged = [...pending, ...(state.documents as any[]).filter(_isNotDeleted)];
        const seen = new Set<string>();
        return merged.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
      });
      setImagesList(prev => {
        const stateIds = new Set(state.images.map(img => img.id));
        const pending = prev.filter(p => !stateIds.has(p.id) && (p.id.startsWith('cf-') || p.isUploading) && _isNotDeleted(p));
        const merged = [...pending, ...(state.images as any[]).filter(_isNotDeleted)];
        const seen = new Set<string>();
        return merged.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
      });
      setVideosList(prev => {
        const stateIds = new Set(state.videos.map(v => v.id));
        const pending = prev.filter(p => !stateIds.has(p.id) && (p.id.startsWith('cf-') || p.isUploading) && _isNotDeleted(p));
        const merged = [...pending, ...(state.videos as any[]).filter(_isNotDeleted)];
        const seen = new Set<string>();
        return merged.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
      });
      setAudioList(prev => {
        const stateIds = new Set(state.audio.map(a => a.id));
        const pending = prev.filter(p => !stateIds.has(p.id) && (p.id.startsWith('cf-') || p.isUploading) && _isNotDeleted(p));
        const merged = [...pending, ...(state.audio as any[]).filter(_isNotDeleted)];
        const seen = new Set<string>();
        return merged.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
      });
      setCloudRecentFiles((state.recentFiles as any[]).filter(_isNotDeletedRecent).slice(0, 6));
      setSecureFolderFiles(state.secure);
      setTrashFiles(state.trash);
      setCloudOverview(state.overview);
      setLoadingCategories({
        overview: false, classeur: false, documents: false, images: false,
        videos: false, audio: false, downloads: false, trash: false,
        secure: false, favorites: false, cloudStorage: false
      });
    });

    // ── ÉTAPE 3 : Sync réseau immédiate depuis Cloudflare D1 (sans cooldown) ─────────
    CloudDataStore.sync(true).catch(() => {}).finally(() => {
      if (isMounted) {
        setLoadingCategories({
          overview: false, classeur: false, documents: false, images: false,
          videos: false, audio: false, downloads: false, trash: false,
          secure: false, favorites: false, cloudStorage: false
        });
      }
    });

    // Empêche le comportement natif du navigateur (ouvrir ou télécharger le fichier) lors d'un glisser-déposer
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
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
    unmarkFileLocallyDeleted(file.id);
    setTrashFiles(prev => prev.filter(f => f.id !== file.id));
    if (file.category === 'folder' || (file as any).sourceCategory === 'classeur_folder') {
      const meta = (file as any).metadata || {};
      const restoredFolder: ClasseurCreatedFolder = {
        id: file.id,
        name: file.name,
        model: (meta.model || 1) as (1 | 2 | 3 | 4),
        modelId: meta.modelId || '1',
        primaryColor: meta.primaryColor || '#EA580C',
        accentColor: meta.accentColor || '#F97316',
        iconName: meta.iconName || 'Folder',
        textDark: meta.textDark || false,
        positionX: meta.positionX || 0,
        positionY: meta.positionY || 0,
        dateText: file.date || new Date().toLocaleDateString('fr-FR'),
        createdAt: meta.createdAt || Date.now(),
        zoomLevel: meta.zoomLevel || 10,
        displayOrder: meta.displayOrder || 0,
        parentId: meta.parentId || undefined
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

    CloudDataStore.restoreFromTrash(file as any);
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
      unmarkFileLocallyDeleted(file.id);
      if (file.category === 'folder' || (file as any).sourceCategory === 'classeur_folder') {
        const meta = (file as any).metadata || {};
        const restoredFolder: ClasseurCreatedFolder = {
          id: file.id,
          name: file.name,
          model: (meta.model || 1) as (1 | 2 | 3 | 4),
          modelId: meta.modelId || '1',
          primaryColor: meta.primaryColor || '#EA580C',
          accentColor: meta.accentColor || '#F97316',
          iconName: meta.iconName || 'Folder',
          textDark: meta.textDark || false,
          positionX: meta.positionX || 0,
          positionY: meta.positionY || 0,
          dateText: file.date || new Date().toLocaleDateString('fr-FR'),
          createdAt: meta.createdAt || Date.now(),
          zoomLevel: meta.zoomLevel || 10,
          displayOrder: meta.displayOrder || 0,
          parentId: meta.parentId || undefined
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
    CloudDataStore.restoreFromTrash(itemsToRestore as any);
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
    CloudDataStore.removeFile(id);
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
    CloudDataStore.removeFiles(ids);
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
      CloudDataStore.updateFile(file.id, { name: trimmed });
      CloudStorageAPI.renameItem(file.id, trimmed, 'trash').catch(console.error);
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
    CloudDataStore.emptyTrash();
    setCloudRecentFiles(prev => prev.filter(f => !allTrashIds.includes(f.id)));
    CloudStorageAPI.emptyTrash().catch(() => {});
    showToast('Corbeille vidée.');
  };

  const toastTimerRef = useRef<any>(null);
  const showToast = (msg?: string) => {
    if (!msg) return;
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const [profileToastMessage, setProfileToastMessage] = useState<string | null>(null);
  const [profileToastType, setProfileToastType] = useState<'success' | 'error' | 'warning'>('success');
  const profileToastTimerRef = useRef<any>(null);

  // Modal d'alerte affiché au milieu de l'écran quand un fichier n'est pas compatible avec le menu actif
  const [incompatibleAlertInfo, setIncompatibleAlertInfo] = useState<{
    fileName: string;
    detectedCategory: string;
    menuLabel: string;
    reason: string;
  } | null>(null);

  // Modal d'avertissement affiché au milieu de l'écran quand un fichier existe déjà dans le répertoire (doublon)
  const [duplicateImportModal, setDuplicateImportModal] = useState<{
    duplicateFileNames: string[];
    allFilesCount: number;
    menuLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const showProfileToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (profileToastTimerRef.current) clearTimeout(profileToastTimerRef.current);
    setProfileToastMessage(msg);
    setProfileToastType(type);
    profileToastTimerRef.current = setTimeout(() => {
      setProfileToastMessage(null);
    }, type === 'error' ? 6000 : 3500);
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

  const isAllowedInitialFile = (f: any) => {
    if (!f || isMockFile(f)) return false;
    const delRecent = getDeletedRecentIds();
    const delLocal = getLocallyDeletedFileIds();
    if (delRecent.has(f.id)) return false;
    if (delLocal.has(f.id)) return false;
    return true;
  };

  // 1. DOCUMENTS (Stockage réel Cloudflare D1/R2 en mémoire de session)
  const [documentsList, setDocumentsList] = useState<FileItem[]>(() => 
    CloudDataStore.hasData() ? (CloudDataStore.getState().documents as any[]) : []
  );

  // 2. IMAGES (Stockage réel Cloudflare D1/R2 en mémoire de session)
  const [imagesList, setImagesList] = useState<FileItem[]>(() => 
    CloudDataStore.hasData() ? (CloudDataStore.getState().images as any[]) : []
  );

  // 3. VIDÉOS (Stockage réel Cloudflare D1/R2 en mémoire de session)
  const [videosList, setVideosList] = useState<FileItem[]>(() => 
    CloudDataStore.hasData() ? (CloudDataStore.getState().videos as any[]) : []
  );

  // 4. AUDIO / MUSIQUE (Stockage réel Cloudflare D1/R2 en mémoire de session)
  const [audioList, setAudioList] = useState<FileItem[]>(() => 
    CloudDataStore.hasData() ? (CloudDataStore.getState().audio as any[]) : []
  );

  // FICHIERS RÉCENTS : STUDYCLOUD (Strictement fichiers réels de l'utilisateur, 6 éléments max)
  const DEFAULT_RECENT_FILES: FileItem[] = [];

  // État des fichiers récents (en mémoire de session)
  const [cloudRecentFiles, setCloudRecentFiles] = useState<FileItem[]>(() => 
    CloudDataStore.hasData() ? ((CloudDataStore.getState().recentFiles || []) as any[]).slice(0, 6) : DEFAULT_RECENT_FILES
  );

  // Helper pour vérifier strictement dans le compte de l'utilisateur si un fichier existe déjà dans son répertoire
  const checkDuplicateFiles = (
    files: File[],
    targetCategory: 'videos' | 'audio' | 'images' | 'documents' | 'classeur',
    folderId?: string
  ): string[] => {
    let existingList: { name?: string }[] = [];
    if (targetCategory === 'videos') existingList = videosList;
    else if (targetCategory === 'audio') existingList = audioList;
    else if (targetCategory === 'images') existingList = imagesList;
    else if (targetCategory === 'documents') existingList = documentsList;
    else if (targetCategory === 'classeur' && folderId) existingList = folderFilesMap[folderId] || [];

    const existingNames = new Set(
      existingList.map(f => (f.name || '').trim().toLowerCase()).filter(Boolean)
    );

    const dupes: string[] = [];
    files.forEach(f => {
      const n = (f.name || '').trim().toLowerCase();
      if (n && existingNames.has(n)) {
        dupes.push(f.name);
      }
    });
    return dupes;
  };

  // Retirer un élément de l'aperçu "Récents" (comme rejeter une notification / une annonce sur son téléphone)
  // LE FICHIER LUI-MÊME RESTE STRICTEMENT INTACT ET CONSERVÉ DANS SON MENU ET DANS LE CLOUD !
  const handleRemoveRecentFile = (fileId: string, fileItem?: FileItem) => {
    const file = fileItem || cloudRecentFiles.find(f => f.id === fileId);

    // 1. Inscrire UNIQUEMENT dans la liste noire des RÉCENTS (pour ne plus s'afficher dans ce bandeau d'accueil)
    markRecentLocallyDeleted(fileId);

    // 2. Retirer immédiatement du bandeau des récents à l'écran
    setCloudRecentFiles(prev => prev.filter(f => f.id !== fileId));
    try {
      CloudDataStore.setRecentFiles(
        CloudDataStore.getState().recentFiles.filter(f => f.id !== fileId)
      );
    } catch {}

    // Synchroniser avec les autres appareils via LocalSyncReplication
    LocalSyncReplication.recordLocalUpsert(`deleted_recent_${fileId}`, 'deleted_recent', { fileId, deletedAt: Date.now() });

    // 3. S'assurer que le fichier est bien présent dans sa catégorie respective (sécurité renforcée)
    if (file) {
      const cat = file.category || detectFileCategory(file);
      if (cat === 'images') {
        setImagesList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else if (cat === 'videos') {
        setVideosList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else if (cat === 'audio') {
        setAudioList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      } else if (cat === 'documents') {
        setDocumentsList(prev => prev.some(f => f.id === file.id) ? prev : [file, ...prev]);
      }
    }

    // 4. Notification claire pour l'utilisateur
    showProfileToast("Aperçu retiré des récents (le fichier reste conservé dans son menu)", "success");
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
        accept: 'image/*,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.ico,.tiff,.tif,.heic,.heif,.avif,.raw,.psd,.ai,.eps',
        label: 'Importer',
        fullLabel: 'Importer une image',
        title: 'Importer une image dans Images',
        colorClass: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-400',
        iconColor: 'text-emerald-400'
      };
    }

    // Vidéos (Prend la couleur violette du logo Vidéos - strictement les vidéos)
    if (viewId === 'studycloud-category-videos' || currentTab === 'videos') {
      return {
        category: 'videos' as const,
        accept: 'video/*,.mp4,.mov,.avi,.mkv,.webm,.flv,.wmv,.3gp,.m4v,.ts,.ogv,.mpg,.mpeg,.vob,.m2ts,.divx',
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
        accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.wma,.amr,.weba,.aiff,.alac,.mid,.midi,.caf,.3ga,.m4b,.m4p,.oga',
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
        accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods,.odp,.rtf,.tex,.epub,.md,.xml,.json,.log',
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

  // FONCTION UNIFIÉE D'EXÉCUTION DÉDIÉE PAR RÔLE DE BOUTON ET CATÉGORIE
  // Chaque bouton a son rôle explicite (uploadSource) transmis directement au Cloudflare Worker
  const executeDedicatedMenuImport = async (
    files: File[],
    targetCategory: 'videos' | 'audio' | 'images' | 'documents' | 'classeur',
    uploadSource: string,
    folderId?: string,
    folderName?: string,
    skipDuplicateCheck?: boolean
  ) => {
    if (!files || files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let filesToProcess = files;
    if (filesToProcess.length > MAX_IMPORT_FILES) {
      showProfileToast(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`, 'warning');
      filesToProcess = filesToProcess.slice(0, MAX_IMPORT_FILES);
    }

    // Validation Option A stricte par Magic Numbers (signature binaire infaillible)
    const { validFiles, rejectedFiles } = await validateFilesForMenuAsync(filesToProcess, targetCategory);

    if (rejectedFiles.length > 0) {
      const first = rejectedFiles[0];
      const targetLabel = CATEGORY_LABELS[targetCategory] || targetCategory;
      const isWa = isWhatsAppAudio(first.file.name, first.file.type);
      const detectedLabel = isWa ? 'Audio (WhatsApp / Vocal)' : (CATEGORY_LABELS[first.detectedCategory] || first.detectedCategory);

      // OUVERTURE IMMÉDIATE DU MODAL D'ALERTE AU MILIEU DE L'ÉCRAN
      setIncompatibleAlertInfo({
        fileName: first.file.name,
        detectedCategory: detectedLabel,
        menuLabel: targetLabel,
        reason: first.reason,
      });

      showProfileToast(
        `❌ Fichier bloqué par le navigateur : ${first.reason}`,
        'error'
      );

      if (validFiles.length === 0) {
        return; // Blocage total : aucun upload ni apparition
      } else {
        showProfileToast(
          `⚠️ ${rejectedFiles.length} fichier(s) bloqué(s) (format interdit dans ${targetLabel}). ${validFiles.length} fichier(s) valide(s) accepté(s).`,
          'warning'
        );
      }
    }

    if (validFiles.length === 0) return;

    // DÉTECTION DES DOUBLONS DANS LE COMPTE DE L'UTILISATEUR (ISOLATION STRICTE)
    if (!skipDuplicateCheck) {
      const dupes = checkDuplicateFiles(validFiles, targetCategory, folderId);
      if (dupes.length > 0) {
        const targetLabel = targetCategory === 'classeur' && folderName
          ? `dossier "${folderName}"`
          : (CATEGORY_LABELS[targetCategory] || targetCategory);

        setDuplicateImportModal({
          duplicateFileNames: dupes,
          allFilesCount: validFiles.length,
          menuLabel: targetLabel,
          onConfirm: () => {
            setDuplicateImportModal(null);
            executeDedicatedMenuImport(validFiles, targetCategory, uploadSource, folderId, folderName, true);
          },
          onCancel: () => {
            setDuplicateImportModal(null);
          }
        });
        return;
      }
    }

    // Création des FileItems dédiés au menu cible avec compression intelligente et préservation de la vraie taille
    const newItemsWithFiles = await Promise.all(validFiles.map(async (file, idx) => {
      const compResult = await compressFile(file, targetCategory);
      const fileToUpload = compResult.file;
      const localBlobUrl = URL.createObjectURL(fileToUpload);
      const normName = file.name.toLowerCase();
      const ext = normName.includes('.') ? (normName.split('.').pop()?.toUpperCase() || 'FICHIER') : 'FICHIER';
      const fileId = `cf-${targetCategory}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;

      storeFileBlob(fileId, fileToUpload as any).catch(() => {});

      const actualCat = targetCategory === 'classeur' ? 'documents' : targetCategory;
      const isAud = actualCat === 'audio';
      const isVid = actualCat === 'videos';

      // L'utilisateur voit TOUJOURS sa vraie taille brute originale non compressée
      const item: FileItem = {
        id: fileId,
        name: file.name,
        category: actualCat,
        source: targetCategory === 'classeur' && folderName ? folderName : (
          targetCategory === 'videos' ? 'Menu Vidéos' :
          targetCategory === 'audio' ? 'Menu Audio' :
          targetCategory === 'images' ? 'Menu Images' :
          targetCategory === 'documents' ? 'Menu Documents' : 'StudyCloud'
        ),
        size: compResult.originalSizeFormatted,
        sizeBytes: compResult.originalSizeBytes,
        date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        extension: ext,
        url: localBlobUrl,
        previewUrl: isAud ? undefined : localBlobUrl,
        videoUrl: isVid ? localBlobUrl : undefined,
        audioUrl: isAud ? localBlobUrl : undefined,
        originalFolderId: folderId
      };
      return {
        file: fileToUpload,
        item,
        originalSizeBytes: compResult.originalSizeBytes,
        originalSizeFormatted: compResult.originalSizeFormatted
      };
    }));

    const newItems = newItemsWithFiles.map(x => x.item);
    const fileIds = newItems.map(x => x.id);

    const currentUserId = localStorage.getItem('unifolder_user_id') || 'default-user';
    newItems.forEach(item => {
      unmarkRecentLocallyDeleted(item.id);
      unmarkFileLocallyDeleted(item.id);
      CloudDataStore.addOptimisticFile(item as any, folderId);

      // 1. Enregistrement D1 immédiat selon la catégorie dédiée
      if (targetCategory === 'images') {
        CloudStorageAPI.saveImage(item as any).catch(() => {});
      } else if (targetCategory === 'videos') {
        CloudStorageAPI.saveVideo(item as any).catch(() => {});
      } else if (targetCategory === 'audio') {
        CloudStorageAPI.saveAudio(item as any).catch(() => {});
      } else if (targetCategory === 'documents') {
        CloudStorageAPI.saveDocument(item as any).catch(() => {});
      } else if (targetCategory === 'classeur' && folderId) {
        CloudStorageAPI.saveClasseurFile(item as any, folderId).catch(() => {});
        LocalSyncReplication.recordLocalUpsert(item.id, 'classeur', {
          ...item,
          folderId
        });
      }

      // 2. Enregistrement universel D1 (comme Mes fichiers) pour synchronisation instantanée multi-appareils
      StudyCloudAPI.registerFileMetadata({
        id: item.id,
        userId: currentUserId,
        matiereId: targetCategory === 'classeur' ? (folderName || 'Classeur') : `menu-${targetCategory}`,
        name: item.name,
        size: item.sizeBytes || 0,
        type: targetCategory === 'images' ? 'image/jpeg' : (
          targetCategory === 'videos' ? 'video/mp4' : (
            targetCategory === 'audio' ? 'audio/mpeg' : 'application/pdf'
          )
        ),
        extension: item.extension || 'FICHIER',
        r2Key: null,
        fileUrl: item.url || '',
        isFavorite: false,
        isImported: true,
        lastImported: Date.now()
      }).catch(() => {});
    });

    if (targetCategory === 'images') {
      setImagesList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (targetCategory === 'videos') {
      setVideosList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (targetCategory === 'audio') {
      setAudioList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (targetCategory === 'documents') {
      setDocumentsList(prev => [...newItems, ...prev.filter(f => !fileIds.includes(f.id))]);
    } else if (targetCategory === 'classeur' && folderId) {
      setFolderFilesMap(prev => ({
        ...prev,
        [folderId]: [...newItems, ...(prev[folderId] || []).filter(f => !fileIds.includes(f.id))]
      }));
    }
    const eligibleRecent = newItems.filter(isRecentEligible);
    if (eligibleRecent.length > 0) {
      setCloudRecentFiles(prev => [...eligibleRecent, ...prev.filter(f => !fileIds.includes(f.id))].slice(0, 6));
    }

    startSavingAnimation(fileIds);

    // Envoi en tâche de fond avec le rôle exact (uploadSource) et métadonnées de compression
    UploadQueue.enqueueExisting(newItemsWithFiles, {
      category: targetCategory as any,
      folderId,
      folderName,
      uploadSource
    });
    try {
      invalidateCloudQueries.all();
    } catch {}

    if (rejectedFiles.length === 0) {
      showProfileToast(`${validFiles.length} fichier(s) importé(s) dans ${CATEGORY_LABELS[targetCategory]} !`, 'success');
    }
  };

  // 1. Bouton DÉDIÉ du menu VIDÉOS (rôle: btn-menu-videos)
  const handleVideoMenuFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) {
      let files = Array.from(list) as File[];
      if (files.length > 10) {
        showProfileToast(`⚠️ Limite de 10 vidéos maximum à la fois : seules les 10 premières vidéos seront importées.`, 'warning');
        files = files.slice(0, 10);
      }
      executeDedicatedMenuImport(files, 'videos', 'btn-menu-videos');
    }
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
  };

  // 2. Bouton DÉDIÉ du menu AUDIO / MUSIQUE (rôle: btn-menu-audio, support WhatsApp inclus)
  const handleAudioMenuFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) {
      let files = Array.from(list) as File[];
      if (files.length > 10) {
        showProfileToast(`⚠️ Limite de 10 fichiers audio maximum à la fois : seuls les 10 premiers fichiers seront importés.`, 'warning');
        files = files.slice(0, 10);
      }
      executeDedicatedMenuImport(files, 'audio', 'btn-menu-audio');
    }
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';
  };

  // 3. Bouton DÉDIÉ du menu IMAGES (rôle: btn-menu-images)
  const handleImageMenuFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) {
      let files = Array.from(list) as File[];
      if (files.length > 10) {
        showProfileToast(`⚠️ Limite de 10 images maximum à la fois : seules les 10 premières images seront importées.`, 'warning');
        files = files.slice(0, 10);
      }
      executeDedicatedMenuImport(files, 'images', 'btn-menu-images');
    }
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
  };

  // 4. Bouton DÉDIÉ du menu DOCUMENTS (rôle: btn-menu-documents)
  const handleDocumentMenuFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) {
      let files = Array.from(list) as File[];
      if (files.length > 10) {
        showProfileToast(`⚠️ Limite de 10 documents maximum à la fois : seuls les 10 premiers documents seront importés.`, 'warning');
        files = files.slice(0, 10);
      }
      executeDedicatedMenuImport(files, 'documents', 'btn-menu-documents');
    }
    if (documentFileInputRef.current) documentFileInputRef.current.value = '';
  };

  // 5. Bouton DÉDIÉ du dossier ouvert CLASSEUR (rôle: btn-classeur-folder)
  const handleClasseurFolderFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0 && opened3DFolder) {
      let files = Array.from(list) as File[];
      if (files.length > 10) {
        showProfileToast(`⚠️ Limite de 10 fichiers maximum à la fois : seuls les 10 premiers fichiers seront importés.`, 'warning');
        files = files.slice(0, 10);
      }
      executeDedicatedMenuImport(files, 'classeur', 'btn-classeur-folder', opened3DFolder.id, opened3DFolder.name);
    }
    if (classeurFolderFileInputRef.current) classeurFolderFileInputRef.current.value = '';
  };

  // B. EXÉCUTION OPTION B (ROUTAGE INTELLIGENT DEPUIS L'ACCUEIL)
  // Détecte la nature exacte de chaque fichier et le classe automatiquement dans son menu
  const processHomeFiles = async (files: File[], skipDuplicateCheck?: boolean) => {
    if (!files || files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let filesToProcess = files;
    if (filesToProcess.length > MAX_IMPORT_FILES) {
      showProfileToast(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`, 'warning');
      filesToProcess = filesToProcess.slice(0, MAX_IMPORT_FILES);
    }

    // DÉTECTION DES DOUBLONS DANS LE COMPTE DE L'UTILISATEUR (ISOLATION STRICTE)
    if (!skipDuplicateCheck) {
      const videoNames = new Set(videosList.map(f => (f.name || '').trim().toLowerCase()).filter(Boolean));
      const audioNames = new Set(audioList.map(f => (f.name || '').trim().toLowerCase()).filter(Boolean));
      const imageNames = new Set(imagesList.map(f => (f.name || '').trim().toLowerCase()).filter(Boolean));
      const docNames = new Set(documentsList.map(f => (f.name || '').trim().toLowerCase()).filter(Boolean));

      const dupes: string[] = [];
      for (const file of filesToProcess) {
        const cat = await detectFileCategoryWithMagic(file);
        const nameLower = (file.name || '').trim().toLowerCase();
        if (cat === 'videos' && videoNames.has(nameLower)) dupes.push(file.name);
        else if (cat === 'audio' && audioNames.has(nameLower)) dupes.push(file.name);
        else if (cat === 'images' && imageNames.has(nameLower)) dupes.push(file.name);
        else if (cat === 'documents' && docNames.has(nameLower)) dupes.push(file.name);
      }

      if (dupes.length > 0) {
        setDuplicateImportModal({
          duplicateFileNames: dupes,
          allFilesCount: filesToProcess.length,
          menuLabel: "vos répertoires",
          onConfirm: () => {
            setDuplicateImportModal(null);
            processHomeFiles(filesToProcess, true);
          },
          onCancel: () => {
            setDuplicateImportModal(null);
          }
        });
        return;
      }
    }

    const newItemsWithFiles = await Promise.all(filesToProcess.map(async (file, idx) => {
      // Détection infaillible par Magic Numbers (signature binaire réelle des octets)
      const autoCat = await detectFileCategoryWithMagic(file);
      // Compression client universelle tout en préservant les vraies valeurs d'origine
      const compResult = await compressFile(file, autoCat);
      const fileToUpload = compResult.file;
      const localBlobUrl = URL.createObjectURL(fileToUpload);
      const normName = file.name.toLowerCase();
      const ext = normName.includes('.') ? (normName.split('.').pop()?.toUpperCase() || 'FICHIER') : 'FICHIER';
      const fileId = `cf-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;

      // Sauvegarde binaire locale immédiate dans IndexedDB
      storeFileBlob(fileId, fileToUpload as any).catch(() => {});

      // L'utilisateur voit TOUJOURS sa vraie taille brute originale non compressée
      const item: FileItem = {
        id: fileId,
        name: file.name,
        category: autoCat,
        source: 'StudyCloud Local',
        size: compResult.originalSizeFormatted,
        sizeBytes: compResult.originalSizeBytes,
        date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        extension: ext,
        url: localBlobUrl,
        previewUrl: autoCat === 'audio' ? undefined : localBlobUrl,
        videoUrl: autoCat === 'videos' ? localBlobUrl : undefined,
        audioUrl: autoCat === 'audio' ? localBlobUrl : undefined,
      };
      return { 
        file: fileToUpload, 
        item,
        originalSizeBytes: compResult.originalSizeBytes,
        originalSizeFormatted: compResult.originalSizeFormatted
      };
    }));

    const newItems = newItemsWithFiles.map(x => x.item);
    const fileIds = newItems.map(x => x.id);
    const currentUserId = localStorage.getItem('unifolder_user_id') || 'default-user';

    // Distribution immédiate dans les menus respectifs et synchronisation D1
    newItems.forEach(item => {
      unmarkRecentLocallyDeleted(item.id);
      unmarkFileLocallyDeleted(item.id);
      CloudDataStore.addOptimisticFile(item as any);

      if (item.category === 'images') {
        setImagesList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
        CloudStorageAPI.saveImage(item as any).catch(() => {});
      } else if (item.category === 'videos') {
        setVideosList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
        CloudStorageAPI.saveVideo(item as any).catch(() => {});
      } else if (item.category === 'audio') {
        setAudioList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
        CloudStorageAPI.saveAudio(item as any).catch(() => {});
      } else {
        setDocumentsList(prev => [item, ...prev.filter(f => f.id !== item.id)]);
        CloudStorageAPI.saveDocument(item as any).catch(() => {});
      }

      StudyCloudAPI.registerFileMetadata({
        id: item.id,
        userId: currentUserId,
        matiereId: `menu-${item.category}`,
        name: item.name,
        size: item.sizeBytes || 0,
        type: item.category === 'images' ? 'image/jpeg' : (
          item.category === 'videos' ? 'video/mp4' : (
            item.category === 'audio' ? 'audio/mpeg' : 'application/pdf'
          )
        ),
        extension: item.extension || 'FICHIER',
        r2Key: null,
        fileUrl: item.url || '',
        isFavorite: false,
        isImported: true,
        lastImported: Date.now()
      }).catch(() => {});
    });
    const eligibleRecent = newItems.filter(isRecentEligible);
    if (eligibleRecent.length > 0) {
      setCloudRecentFiles(prev => [...eligibleRecent, ...prev.filter(f => !fileIds.includes(f.id))].slice(0, 6));
    }

    startSavingAnimation(fileIds);
    UploadQueue.enqueueExisting(newItemsWithFiles);
    try {
      invalidateCloudQueries.all();
    } catch {}

    const counts = { images: 0, videos: 0, audio: 0, documents: 0 };
    newItems.forEach(item => {
      if (item.category && counts[item.category as keyof typeof counts] !== undefined) {
        counts[item.category as keyof typeof counts]++;
      }
    });
    const parts = [];
    if (counts.images > 0) parts.push(`${counts.images} image(s) dans Images`);
    if (counts.videos > 0) parts.push(`${counts.videos} vidéo(s) dans Vidéos`);
    if (counts.audio > 0) parts.push(`${counts.audio} musique(s) dans Audio`);
    if (counts.documents > 0) parts.push(`${counts.documents} document(s) dans Documents`);

    showProfileToast(
      `${filesToProcess.length} fichier(s) classé(s) automatiquement : ${parts.join(', ')} !`,
      'success'
    );
  };

  // 1. Bouton "+ Importer" de l'Accueil (Routage Automatique Intelligent Option B)
  const handleHomeFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let files = Array.from(fileList) as File[];
    if (files.length > MAX_IMPORT_FILES) {
      showProfileToast(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`, 'warning');
      files = files.slice(0, MAX_IMPORT_FILES);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';

    const viewId = currentSubView?.id || '';
    const currentTab = isCloudView ? cloudActiveTab : null;

    if (viewId === 'studycloud-category-videos' || currentTab === 'videos') {
      executeDedicatedMenuImport(files, 'videos', 'btn-menu-videos');
      return;
    }
    if (viewId === 'studycloud-category-audio' || currentTab === 'audio') {
      executeDedicatedMenuImport(files, 'audio', 'btn-menu-audio');
      return;
    }
    if (viewId === 'studycloud-category-images' || currentTab === 'images') {
      executeDedicatedMenuImport(files, 'images', 'btn-menu-images');
      return;
    }
    if (viewId === 'studycloud-category-documents' || currentTab === 'documents') {
      executeDedicatedMenuImport(files, 'documents', 'btn-menu-documents');
      return;
    }
    if (opened3DFolder && (viewId === 'studycloud-classeur-classeur' || currentTab === 'classeur' || currentSubView?.type === 'classeur')) {
      executeDedicatedMenuImport(files, 'classeur', 'btn-classeur-folder', opened3DFolder.id, opened3DFolder.name);
      return;
    }

    processHomeFiles(files);
  };

  // 2. Gestionnaire universel de Drag & Drop (Déposer un fichier sur la fenêtre)
  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fileList = e.dataTransfer?.files;
    if (!fileList || fileList.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let files = Array.from(fileList) as File[];
    if (files.length > MAX_IMPORT_FILES) {
      showProfileToast(`⚠️ Limite de ${MAX_IMPORT_FILES} fichiers maximum à la fois : seuls les ${MAX_IMPORT_FILES} premiers fichiers seront importés.`, 'warning');
      files = files.slice(0, MAX_IMPORT_FILES);
    }

    const viewId = currentSubView?.id || '';
    const currentTab = isCloudView ? cloudActiveTab : null;

    if (viewId === 'studycloud-category-videos' || currentTab === 'videos') {
      executeDedicatedMenuImport(files, 'videos', 'drag-menu-videos');
    } else if (viewId === 'studycloud-category-audio' || currentTab === 'audio') {
      executeDedicatedMenuImport(files, 'audio', 'drag-menu-audio');
    } else if (viewId === 'studycloud-category-images' || currentTab === 'images') {
      executeDedicatedMenuImport(files, 'images', 'drag-menu-images');
    } else if (viewId === 'studycloud-category-documents' || currentTab === 'documents') {
      executeDedicatedMenuImport(files, 'documents', 'drag-menu-documents');
    } else if (opened3DFolder && (viewId === 'studycloud-classeur-classeur' || currentTab === 'classeur' || currentSubView?.type === 'classeur')) {
      executeDedicatedMenuImport(files, 'classeur', 'drag-classeur-folder', opened3DFolder.id, opened3DFolder.name);
    } else {
      processHomeFiles(files);
    }
  };

  // DOSSIER SÉCURISÉ (Fichiers protégés par coffre-fort en mémoire de session)
  const [secureFolderFiles, setSecureFolderFiles] = useState<FileItem[]>([]);


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
          (Object.values(folderFilesMap).flat() as FileItem[]).find(f => f.id === id);

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
      CloudDataStore.moveToSecure(lockedItems as any);
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
          model: (meta.model || 1) as (1 | 2 | 3 | 4),
          modelId: meta.modelId || '1',
          primaryColor: meta.primaryColor || '#EA580C',
          accentColor: meta.accentColor || '#F97316',
          iconName: meta.iconName || 'Folder',
          textDark: meta.textDark || false,
          positionX: meta.positionX || 0,
          positionY: meta.positionY || 0,
          dateText: file.date || new Date().toLocaleDateString('fr-FR'),
          createdAt: meta.createdAt || Date.now(),
          zoomLevel: meta.zoomLevel || 10,
          displayOrder: meta.displayOrder || 0,
          parentId: meta.parentId || undefined
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
    CloudDataStore.restoreFromSecure(itemsToUnlock as any);

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
      category: file.category,
      url: (file as any).url || (file as any).previewUrl || (file as any).videoUrl || (file as any).audioUrl,
      previewUrl: (file as any).previewUrl,
      extension: (file as any).extension
    });

    const fileItem = file as FileItem;
    unmarkRecentLocallyDeleted(fileItem.id);
    unmarkFileLocallyDeleted(fileItem.id);
    setCloudRecentFiles(prev => {
      const filtered = prev.filter(f => f.id !== fileItem.id);
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
        setCloudRecentFiles(prev => prev.filter(f => f.id !== file.id));
        markRecentLocallyDeleted(file.id);
        markFileLocallyDeleted(file.id);
        CloudDataStore.moveToTrash(fileWithSource as any);
        deleteFileBlob(file.id).catch(() => {});
        removeDownloadedFile(file.id);
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
          CloudStorageAPI.deleteClasseurFile(file.id, file.name).catch(console.error);
        } else if (file.category === 'images' || file.isImage) {
          CloudStorageAPI.deleteImage(file.id, file.name).catch(console.error);
        } else if (file.category === 'videos' || file.videoUrl) {
          CloudStorageAPI.deleteVideo(file.id, file.name).catch(console.error);
        } else if (file.category === 'audio' || file.audioUrl) {
          CloudStorageAPI.deleteAudio(file.id, file.name).catch(console.error);
        } else if (file.category === 'downloads') {
          CloudStorageAPI.deleteDownload(file.id, file.name).catch(console.error);
        } else {
          CloudStorageAPI.deleteDocument(file.id, file.name).catch(console.error);
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
        CloudDataStore.moveToSecure(securedFile as any);

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
        CloudDataStore.restoreFromSecure(restoredFile as any);

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
        const newFileId = `${file.category || 'item'}-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newFile: FileItem = {
          ...file,
          id: newFileId,
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
        CloudDataStore.addOptimisticFile(newFile, opened3DFolder?.id);
        // Cloner le blob IndexedDB de manière indépendante pour éviter toute suppression partagée
        getFileBlob(file.id).then(blob => {
          if (blob) storeFileBlob(newFileId, blob).catch(() => {});
        }).catch(() => {});
        // Écriture du doublon dans la table D1 correspondante avec le même ID
        CloudStorageAPI.duplicateItem(file.id, file.category, opened3DFolder?.id, newName, newFileId).then(() => {
          if (opened3DFolder?.id) invalidateCloudQueries.classeurFiles(opened3DFolder.id).catch(() => {});
          invalidateCloudQueries.overview().catch(() => {});
        }).catch(console.error);
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
        CloudDataStore.toggleFavorite(file.id, newFav);
        // Persistance dans la table user_favorites D1
        if (newFav) {
          CloudStorageAPI.addFavorite(file.id, file.category).catch(console.error);
          showToast('Ajouté aux favoris !');
        } else {
          CloudStorageAPI.removeFavorite(file.id).catch(console.error);
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
          CloudStorageAPI.removePinned(file.id).catch(console.error);
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
          CloudDataStore.updateFile(file.id, { name: finalName }, opened3DFolder?.id);
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
        folderIds.forEach(fId => CloudDataStore.removeFolder(fId));

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
          (Object.values(folderFilesMap).flat() as FileItem[]).find(f => f.id === id);

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
      CloudDataStore.moveToTrash(deletedItems as any);
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
          (Object.values(folderFilesMap).flat() as FileItem[]).find(f => f.id === id);
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
          (Object.values(folderFilesMap).flat() as FileItem[]).find(f => f.id === id);
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
    const ext = (file.name || '').includes('.') ? (file.name || '').split('.').pop()?.toLowerCase() || '' : '';
    const isAud = Boolean(
      file.category === 'audio' ||
      (file as any).isAudio ||
      Boolean((file as any).audioUrl) ||
      (file.type && file.type.startsWith('audio/')) ||
      isWhatsAppAudio(file.name, file.type) ||
      EXTENSION_MAP.audio.includes(ext) ||
      /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(file.name)
    );
    const isVid = Boolean(file.category === 'videos' || (file as any).isVideo || Boolean((file as any).videoUrl) || (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp)$/i.test(file.name));
    const isImg = Boolean(file.category === 'images' || (file as any).isImage || (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name));
    const isDoc = file.category === 'documents' || (!isAud && !isVid && !isImg);

    if (isDoc) setSelectedDocFile(file);
    if (isAud) {
      setSelectedAudioTrack(file);
      setSplitResolvedAudioUrl('');
    }
    if (isVid) setSelectedVideoFile(file);
    if (isImg) setSelectedImageFile(file);
    if (opened3DFolder || file.folderId || (file as any).originalFolderId || file.category === 'classeur') setSelectedClasseurFile(file);
    setSelectedDownloadFile(file);
    setSelectedCollectionFile(file);

    setSplitSelectedFile(file);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);

    const isNotepad = Boolean(
      file.isNotepad ||
      file.extension === 'txt' ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.category === 'notes' ||
      file.type === 'text/plain'
    );

    // URL de lecture : préserver le blob local s'il existe, sinon URL worker
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const permanentWorkerUrl = file.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(file.id)}` : '';
    if (!file.url || file.url.startsWith('blob:')) {
      file.url = permanentWorkerUrl;
    }
    if (!file.videoUrl || file.videoUrl.startsWith('blob:')) {
      file.videoUrl = isVid ? (file.url || permanentWorkerUrl) : file.videoUrl;
    }
    if (!file.audioUrl || file.audioUrl.startsWith('blob:')) {
      file.audioUrl = isAud ? (file.url || permanentWorkerUrl) : file.audioUrl;
    }
    if (file.id) {
      getFileBlobUrl(file.id).then(freshBlob => {
        if (freshBlob) {
          file.url = freshBlob;
          if (isVid) file.videoUrl = freshBlob;
          if (isAud) {
            file.audioUrl = freshBlob;
            setSplitResolvedAudioUrl(freshBlob);
          }
        }
      }).catch(() => {});
    }

    if (isNotepad) {
      setNoteTextContent(file.content || '');
      setNoteTitleContent(file.noteTitle || '');
      setIsNoteSavedIndicator(true);

      // Si le contenu n'est pas encore en mémoire, tenter de le charger depuis IndexedDB
      if (!file.content && file.id) {
        getFileBlob(file.id).then(blob => {
          if (blob) {
            blob.text().then(text => {
              if (text) {
                setNoteTextContent(text);
                file.content = text;
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    // Si audio, démarrer l'écouteur et ouvrir le lecteur mobile si sur téléphone
    if (isAud) {
      setIsAudioPlaying(true);
      setAudioCurrentTime(0);
      setAudioDuration(file.durationSec || 219);
      setIsMobilePlayerOpen(true);
    } else {
      setIsAudioPlaying(false);
    }

    // Si vidéo, réinitialiser
    if (isVid) {
      setIsVideoPlaying(true);
      setVideoCurrentTime(0);
    } else {
      setIsVideoPlaying(false);
    }
  };

  // CLIC SUR UN FICHIER RÉCENT :
  // Bascule automatiquement et de manière fluide dans le menu correspondant et active le lecteur
  const handleRecentFileClick = (file: FileItem) => {
    preserveSelectionFileIdRef.current = file.id;
    setActiveDedicatedMenu(null);
    setIsSelectionMode(false);
    setSelectedItemIds([]);

    const normName = (file.name || '').toLowerCase();
    const ext = normName.includes('.') ? normName.split('.').pop() || '' : '';

    const isImg = file.category === 'images' || file.isImage || (file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext);
    const isVid = file.category === 'videos' || file.isVideo || Boolean(file.videoUrl) || (file.type && file.type.startsWith('video/')) || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);
    const isAud = file.category === 'audio' || file.isAudio || Boolean(file.audioUrl) || (file.type && file.type.startsWith('audio/')) || isWhatsAppAudio(file.name, file.type) || EXTENSION_MAP.audio.includes(ext) || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 'amr', 'weba', 'aiff', 'alac', 'mid', 'midi', 'caf', '3ga'].includes(ext);
    const isDl = file.category === 'downloads';
    const isApp = file.category === 'apps';

    let targetCatId = 'documents';
    let targetName = 'Documents';
    let targetIcon: any = FileText;
    let targetColor = 'text-blue-400';

    if (isImg) {
      targetCatId = 'images';
      targetName = 'Images';
      targetIcon = ImageIcon;
      targetColor = 'text-emerald-400';
      setImagesList(prev => {
        if (prev.some(i => i.id === file.id || (file.name && i.name === file.name))) return prev;
        return [file, ...prev];
      });
      if (isCloudView) setCloudActiveTab('images');
    } else if (isVid) {
      targetCatId = 'videos';
      targetName = 'Vidéos';
      targetIcon = Film;
      targetColor = 'text-purple-400';
      setVideosList(prev => {
        if (prev.some(v => v.id === file.id || (file.name && v.name === file.name))) return prev;
        return [file, ...prev];
      });
      if (isCloudView) setCloudActiveTab('videos');
    } else if (isAud) {
      targetCatId = 'audio';
      targetName = 'Audio';
      targetIcon = Music;
      targetColor = 'text-amber-400';
      setAudioList(prev => {
        if (prev.some(a => a.id === file.id || (file.name && a.name === file.name))) return prev;
        return [file, ...prev];
      });
      if (isCloudView) setCloudActiveTab('audio');
    } else if (isDl) {
      targetCatId = 'downloads';
      targetName = 'Téléchargements';
      targetIcon = Download;
      targetColor = 'text-sky-400';
      setDownloadedItems(prev => {
        if (prev.some(d => d.id === file.id || (file.name && d.name === file.name))) return prev;
        return [file as any, ...prev];
      });
    } else if (isApp) {
      targetCatId = 'apps';
      targetName = 'Applications';
      targetIcon = LayoutGrid;
      targetColor = 'text-pink-400';
    } else {
      targetCatId = 'documents';
      targetName = 'Documents';
      targetIcon = FileText;
      targetColor = 'text-blue-400';
      setDocumentsList(prev => {
        if (prev.some(d => d.id === file.id || (file.name && d.name === file.name))) return prev;
        return [file, ...prev];
      });
      if (isCloudView) setCloudActiveTab('documents');
    }

    setSubSearchQuery('');
    setIsViewerMaximized(false);
    setCurrentSubView({
      id: `studycloud-category-${targetCatId}`,
      type: 'category',
      name: targetName,
      icon: targetIcon,
      color: targetColor
    });

    handleSelectFile(file);
  };

  // Filtrage selon la recherche (strictement 6 éléments maximum sur l'accueil, sans notes ni fichiers effacés)
  const displayedFiles = useMemo(() => {
    const deletedRecentIds = getDeletedRecentIds();
    const locallyDeletedIds = getLocallyDeletedFileIds();
    const trashIdSet = new Set(trashFiles.map(t => t.id));

    const sourceFiles = Array.isArray(cloudRecentFiles) ? cloudRecentFiles : [];

    return sourceFiles.filter(f => {
      if (!f || !f.id) return false;
      if (deletedRecentIds.has(f.id)) return false;
      if (locallyDeletedIds.has(f.id)) return false;
      if (trashIdSet.has(f.id)) return false;
      if (isMockFile(f)) return false;
      if (!isRecentEligible(f)) return false;

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
    // Routage immédiat vers les composants 100% indépendants
    if (id === 'audio') {
      setActiveDedicatedMenu('audio');
      return;
    }
    if (id === 'documents') {
      setActiveDedicatedMenu('documents');
      return;
    }
    if (id === 'videos') {
      setActiveDedicatedMenu('videos');
      return;
    }
    if (id === 'images') {
      setActiveDedicatedMenu('images');
      return;
    }
    if (id === 'trash') {
      setActiveDedicatedMenu('trash');
      return;
    }
    if (id === 'favorites') {
      setActiveDedicatedMenu('favorites');
      return;
    }
    if (id === 'apps' || id === 'applications') {
      setActiveDedicatedMenu('apps');
      return;
    }
    if (id === 'cloud-storage') {
      setActiveDedicatedMenu('cloud-storage');
      return;
    }
    if (id === 'downloads') {
      setActiveDedicatedMenu('downloads');
      return;
    }
    if (id === 'secure-folder') {
      setActiveDedicatedMenu('secure-folder');
      return;
    }

    setSubSearchQuery('');
    setIsViewerMaximized(false);
    setIsMobilePlayerOpen(false);
    setSelectedDocFile(null);
    setSelectedVideoFile(null);
    setSelectedImageFile(null);
    setSelectedAudioTrack(null);
    setSelectedDownloadFile(null);
    setSelectedClasseurFile(null);
    setSelectedCollectionFile(null);
    setSplitSelectedFile(null);

    // Par défaut pour l'Espace Cloud : sélectionner l'onglet Classeur et réinitialiser
    if (id === 'cloud-storage') {
      setCloudActiveTab('classeur');
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

    // Rechargement immédiat depuis le Worker / Base de données D1 dès qu'on RENTRE dans un sous-menu (comme Mes fichiers)
    if (id === 'videos') {
      CloudStorageAPI.getVideosList().then(vids => {
        if (vids && Array.isArray(vids)) {
          setVideosList(vids);
          CloudDataStore.setVideos(vids as any);
        }
      }).catch(() => {});
    } else if (id === 'audio') {
      CloudStorageAPI.getAudioList().then(auds => {
        if (auds && Array.isArray(auds)) {
          setAudioList(auds);
          CloudDataStore.setAudio(auds as any);
        }
      }).catch(() => {});
    } else if (id === 'images') {
      CloudStorageAPI.getImagesList().then(imgs => {
        if (imgs && Array.isArray(imgs)) {
          setImagesList(imgs);
          CloudDataStore.setImages(imgs as any);
        }
      }).catch(() => {});
    } else if (id === 'documents') {
      CloudStorageAPI.getDocumentsList().then(docs => {
        if (docs && Array.isArray(docs)) {
          setDocumentsList(docs);
          CloudDataStore.setDocuments(docs as any);
        }
      }).catch(() => {});
    } else if (id === 'classeur' || id === 'cloud-storage') {
      CloudStorageAPI.getClasseurFolders().then(folders => {
        if (folders && Array.isArray(folders)) {
          setClasseur3DFolders(folders);
          CloudDataStore.setClasseurFolders(folders);
        }
      }).catch(() => {});
    } else if (id === 'downloads') {
      CloudStorageAPI.getDownloadsList().then(dls => {
        if (dls && Array.isArray(dls)) {
          setDownloadedItems(dls as any);
          CloudDataStore.setDownloads(dls as any);
        }
      }).catch(() => {});
    } else if (id === 'trash') {
      CloudStorageAPI.getTrashFiles().then(trash => {
        if (trash && Array.isArray(trash)) {
          setTrashFiles(trash);
          CloudDataStore.setTrashFiles(trash as any);
        }
      }).catch(() => {});
    } else if (id === 'secure-folder') {
      CloudStorageAPI.getSecureFiles().then(sec => {
        if (sec && Array.isArray(sec)) {
          setSecureFolderFiles(sec);
          CloudDataStore.setSecureFiles(sec as any);
        }
      }).catch(() => {});
    }

    // Déclencher également une synchronisation d'arrière-plan sans cooldown bloquant
    CloudDataStore.sync(true).catch(() => {});
  };

  // Rechargement immédiat depuis Cloudflare D1 dès qu'on ouvre un dossier du Classeur 3D
  useEffect(() => {
    if (!opened3DFolder || !opened3DFolder.id) return;
    CloudStorageAPI.getClasseurFiles(opened3DFolder.id)
      .then(files => {
        if (files && Array.isArray(files)) {
          setFolderFilesMap(prev => ({
            ...prev,
            [opened3DFolder.id]: files
          }));
          const currentMap = CloudDataStore.getState().folderFilesMap;
          CloudDataStore.setFolderFilesMap({
            ...currentMap,
            [opened3DFolder.id]: files
          });
        }
      })
      .catch(() => {});
  }, [opened3DFolder?.id]);

  // Fonction de tri universelle appliquée aux listes selon l'option sélectionnée (menu 3 traits)
  const applySorting = (list: FileItem[]): FileItem[] => {
    return applyFileSorting(list, sortOption);
  };

  // Liste des documents pour le sous-menu Documents (Image 1) - Filtrage strict par nature
  const filteredDocuments = useMemo(() => {
    const delLocal = getLocallyDeletedFileIds();
    const isClean = (f: FileItem) => !delLocal.has(f.id);
    const isDoc = (f: FileItem) => (f.category === 'documents' || detectFileCategory({ name: f.name, type: f.type || '' }) === 'documents') && f.category !== 'videos' && f.category !== 'audio' && f.category !== 'images';

    const mergedDocs = [...documentsList, ...cloudRecentFiles.filter(f => isDoc(f) && !documentsList.some(s => s.id === f.id))];
    const seenDocIds = new Set<string>();
    const list = mergedDocs.filter(f => { if (seenDocIds.has(f.id)) return false; seenDocIds.add(f.id); return true; }).filter(isClean).filter(isDoc);
    const filtered = list.filter(doc => {
      return subSearchQuery.trim() === '' || doc.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [documentsList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des images pour le sous-menu Images (Image 2) - Filtrage strict par nature
  const filteredImages = useMemo(() => {
    const delLocal = getLocallyDeletedFileIds();
    const isClean = (f: FileItem) => !delLocal.has(f.id);
    const isImg = (f: FileItem) => (f.category === 'images' || Boolean(f.previewUrl && !f.videoUrl && !f.audioUrl) || f.isImage || detectFileCategory({ name: f.name, type: f.type || '' }) === 'images') && f.category !== 'videos' && f.category !== 'audio' && f.category !== 'documents';

    const mergedImgs = [...imagesList, ...cloudRecentFiles.filter(f => isImg(f) && !imagesList.some(s => s.id === f.id))];
    const seenImgIds = new Set<string>();
    const list = mergedImgs.filter(f => { if (seenImgIds.has(f.id)) return false; seenImgIds.add(f.id); return true; }).filter(isClean).filter(isImg);
    const filtered = list.filter(img => {
      return subSearchQuery.trim() === '' || img.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [imagesList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste des vidéos pour le sous-menu Vidéos (Image 3) - FILTRAGE STRICT : AUCUN AUDIO NE PEUT APPARAÎTRE
  const filteredVideos = useMemo(() => {
    const delLocal = getLocallyDeletedFileIds();
    const isClean = (f: FileItem) => !delLocal.has(f.id);
    const isVid = (f: FileItem) => {
      // Reconnaissance explicite des vidéos WhatsApp (ex: WhatsApp Video 2026-..., VID-...)
      if (isWhatsAppVideo(f.name, f.type)) {
        return true;
      }
      // Les fichiers audio ou notes vocales WhatsApp ne doivent JAMAIS apparaître dans les vidéos
      if (isWhatsAppAudio(f.name, f.type) || EXTENSION_MAP.audio.includes(((f.name || '').split('.').pop() || '').toLowerCase())) {
        return false;
      }
      return (f.category === 'videos' || Boolean(f.videoUrl) || f.isVideo || detectFileCategory({ name: f.name, type: f.type || '' }) === 'videos') && f.category !== 'audio' && f.category !== 'images' && f.category !== 'documents';
    };

    const mergedVids = [...videosList, ...cloudRecentFiles.filter(f => isVid(f) && !videosList.some(s => s.id === f.id))];
    const seenVidIds = new Set<string>();
    const list = mergedVids.filter(f => { if (seenVidIds.has(f.id)) return false; seenVidIds.add(f.id); return true; }).filter(isClean).filter(isVid);
    const filtered = list.filter(vid => {
      return subSearchQuery.trim() === '' || vid.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
    return applySorting(filtered);
  }, [videosList, cloudRecentFiles, subSearchQuery, sortOption]);

  // Liste audio pour le sous-menu Audio (Image 4) - ACCEPTE TOUS LES AUDIOS ET NOTES VOCALES WHATSAPP
  const filteredAudio = useMemo(() => {
    const delLocal = getLocallyDeletedFileIds();
    const isClean = (f: FileItem) => !delLocal.has(f.id);
    const isAud = (f: FileItem) => {
      // Une vidéo WhatsApp ou mobile ne doit JAMAIS apparaître dans le menu Audio
      if (isWhatsAppVideo(f.name, f.type)) {
        return false;
      }
      // Tout fichier audio WhatsApp (AUD-..., PTT-..., .opus, .ogg, .m4a) appartient obligatoirement au menu Audio
      if (isWhatsAppAudio(f.name, f.type) || EXTENSION_MAP.audio.includes(((f.name || '').split('.').pop() || '').toLowerCase())) {
        return true;
      }
      return (f.category === 'audio' || Boolean(f.audioUrl) || f.isAudio || detectFileCategory({ name: f.name, type: f.type || '' }) === 'audio') && f.category !== 'videos' && f.category !== 'images' && f.category !== 'documents';
    };

    const mergedAuds = [...audioList, ...cloudRecentFiles.filter(f => isAud(f) && !audioList.some(s => s.id === f.id))];
    const seenAudIds = new Set<string>();
    const list = mergedAuds.filter(f => { if (seenAudIds.has(f.id)) return false; seenAudIds.add(f.id); return true; }).filter(isClean).filter(isAud);
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

  // Agrégation de tous les fichiers de tous les menus pour la recherche globale d'accueil (SANS les dossiers)
  const allGlobalSearchableFiles = useMemo(() => {
    const list: (FileItem & { menuOrigin?: string })[] = [];
    const seen = new Set<string>();

    const pushUnique = (item: any, origin: string, defaultCat?: string) => {
      if (!item || !item.id || seen.has(item.id)) return;
      // EXCLURE TOUT DOSSIER : seuls les fichiers réels s'affichent
      if (item.isFolder || item.category === 'classeur_folder' || item.category === 'folder' || item.type === 'folder' || item.size === 'Dossier 3D') return;
      seen.add(item.id);
      list.push({
        ...item,
        category: item.category || defaultCat || 'documents',
        menuOrigin: origin
      });
    };

    (documentsList || []).forEach(f => pushUnique(f, 'Documents', 'documents'));
    (imagesList || []).forEach(f => pushUnique(f, 'Images', 'images'));
    (videosList || []).forEach(f => pushUnique(f, 'Vidéos', 'videos'));
    (audioList || []).forEach(f => pushUnique(f, 'Audio', 'audio'));
    (downloadedItems || []).forEach(f => pushUnique(f, 'Téléchargements', 'downloads'));

    if (folderFilesMap) {
      Object.entries(folderFilesMap).forEach(([folderId, fList]) => {
        const folder = classeur3DFolders.find(fd => fd.id === folderId);
        const folderName = folder ? folder.name : 'Dossier Classeur';
        ((fList as FileItem[]) || []).forEach(f => {
          if (!(f as any).isFolder && f.category !== 'classeur_folder' && f.category !== 'folder') {
            pushUnique({ ...f, folderId, originalFolderId: folderId }, `Classeur (${folderName})`, f.category || 'documents');
          }
        });
      });
    }

    try {
      const storeState = CloudDataStore.getState();
      (storeState.favorites || []).forEach(f => {
        if (!(f as any).isFolder && f.category !== 'classeur_folder' && f.category !== 'folder') {
          pushUnique(f, 'Favoris', f.category);
        }
      });
    } catch {}

    return list;
  }, [documentsList, imagesList, videosList, audioList, downloadedItems, folderFilesMap, classeur3DFolders]);

  // Filtrage multi-critères selon le texte recherché (exclut rigoureusement tout dossier)
  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allGlobalSearchableFiles.filter(f => {
      if ((f as any).isFolder || f.category === 'classeur_folder' || f.category === 'folder' || (f as any).type === 'folder' || f.size === 'Dossier 3D') {
        return false;
      }

      const normCat = (f.category || detectFileCategory(f)).toLowerCase();
      const normName = (f.name || '').toLowerCase();
      const ext = normName.includes('.') ? normName.split('.').pop() || '' : '';
      const isImg = normCat === 'images' || f.isImage || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext);
      const isVid = normCat === 'videos' || f.isVideo || Boolean(f.videoUrl) || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);
      const isAud = normCat === 'audio' || f.isAudio || Boolean(f.audioUrl) || isWhatsAppAudio(f.name, f.type) || EXTENSION_MAP.audio.includes(ext) || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 'amr', 'weba', 'aiff', 'alac', 'mid', 'midi', 'caf', '3ga'].includes(ext);
      const isClasseur = normCat === 'classeur' || Boolean(f.folderId) || Boolean(f.originalFolderId) || (f.menuOrigin || '').toLowerCase().includes('classeur');
      const isDl = normCat === 'downloads' || (f.menuOrigin || '').toLowerCase().includes('téléchargement');

      if (searchCategoryFilter !== 'all') {
        if (searchCategoryFilter === 'images' && !isImg) return false;
        if (searchCategoryFilter === 'videos' && !isVid) return false;
        if (searchCategoryFilter === 'audio' && !isAud) return false;
        if (searchCategoryFilter === 'classeur' && !isClasseur) return false;
        if (searchCategoryFilter === 'downloads' && !isDl) return false;
        if (searchCategoryFilter === 'documents' && (isImg || isVid || isAud)) return false;
      }

      const nameMatch = normName.includes(q);
      const sourceMatch = (f.source || '').toLowerCase().includes(q);
      const originMatch = (f.menuOrigin || '').toLowerCase().includes(q);
      const catMatch = normCat.includes(q);
      const extMatch = ext.includes(q);
      const artistMatch = ((f as any).artist || '').toLowerCase().includes(q);
      return nameMatch || sourceMatch || originMatch || catMatch || extMatch || artistMatch;
    });
  }, [allGlobalSearchableFiles, searchQuery, searchCategoryFilter]);

  const handleSearchResultClick = (file: FileItem) => {
    preserveSelectionFileIdRef.current = file.id;
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery);
    }
    setSearchQuery('');
    setShowRecentSearchesMenu(false);
    setActiveDedicatedMenu(null);
    setIsSelectionMode(false);
    setSelectedItemIds([]);

    // Si le fichier appartient à un dossier du Classeur 3D
    const classeurFolderId = file.folderId || file.originalFolderId;
    if (classeurFolderId || file.category === 'classeur' || file.source === 'classeur_folder') {
      const folder = classeur3DFolders.find(f => f.id === (classeurFolderId || file.id));
      if (folder) {
        setFolderFilesMap(prev => {
          const list = prev[folder.id] || [];
          if (list.some(f => f.id === file.id || (file.name && f.name === file.name))) return prev;
          return { ...prev, [folder.id]: [file, ...list] };
        });
        setOpened3DFolder(folder);
        setSelectedClasseurFolder(folder);
        setCurrentSubView({
          id: 'studycloud-classeur-classeur',
          type: 'classeur',
          name: 'Classeur',
          icon: FolderArchive,
          color: 'text-orange-400'
        });
        setSelectedClasseurFile(file);
        handleSelectFile(file);
        return;
      }
    }

    // Sinon, redirection automatique dans le menu correspondant (Documents, Images, Vidéos, Audio, Téléchargements)
    handleRecentFileClick(file);
  };

  // Calcul dynamique et formatage lisible de l'espace occupé par chaque catégorie
  const formatCategoryDisplaySize = (bytes: number, count: number, singularUnit: string) => {
    if (bytes > 0) {
      if (bytes < 1024) return `${bytes} o`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
    }
    return '0 Mo';
  };

  const calculateListBytes = (files: (FileItem | DownloadedItem)[]) => {
    return (files || []).reduce((acc, f) => {
      return acc + parseSizeToBytes(f?.size, (f as any)?.sizeBytes);
    }, 0);
  };

  const imagesTotalBytes = useMemo(() => calculateListBytes(imagesList), [imagesList]);
  const videosTotalBytes = useMemo(() => calculateListBytes(videosList), [videosList]);
  const audioTotalBytes = useMemo(() => calculateListBytes(audioList), [audioList]);
  const docsTotalBytes = useMemo(() => calculateListBytes(documentsList), [documentsList]);
  const downloadsTotalBytes = useMemo(() => calculateListBytes(downloadedItems), [downloadedItems]);
  const classeurFiles = useMemo(() => Object.values(folderFilesMap || {}).flat(), [folderFilesMap]);
  const classeurTotalBytes = useMemo(() => calculateListBytes(classeurFiles), [classeurFiles]);
  const favoritesTotalBytes = useMemo(() => calculateListBytes(favoriteFiles), [favoriteFiles]);
  const secureTotalBytes = useMemo(() => calculateListBytes(secureFolderFiles), [secureFolderFiles]);
  const trashTotalBytes = useMemo(() => calculateListBytes(trashFiles), [trashFiles]);

  const totalCloudStorageBytes = useMemo(() => {
    const sumLocal = imagesTotalBytes + videosTotalBytes + audioTotalBytes + docsTotalBytes + downloadsTotalBytes + classeurTotalBytes + secureTotalBytes;
    if (cloudOverview?.totalBytes && cloudOverview.totalBytes > sumLocal) {
      return cloudOverview.totalBytes;
    }
    return sumLocal;
  }, [imagesTotalBytes, videosTotalBytes, audioTotalBytes, docsTotalBytes, downloadsTotalBytes, classeurTotalBytes, secureTotalBytes, cloudOverview?.totalBytes]);

  // Catégories StudyCloud calculées dynamiquement depuis la base de données en direct
  const categories = useMemo(() => [
    {
      id: 'downloads',
      name: 'Téléchargements',
      size: loadingCategories.downloads
        ? 'Chargement...'
        : formatCategoryDisplaySize(downloadsTotalBytes, downloadedItems.length, 'fichier'),
      icon: Download,
      color: 'text-sky-400'
    },
    {
      id: 'images',
      name: 'Images',
      size: loadingCategories.images
        ? 'Chargement...'
        : formatCategoryDisplaySize(imagesTotalBytes, imagesList.length, 'image'),
      icon: ImageIcon,
      color: 'text-emerald-400'
    },
    {
      id: 'videos',
      name: 'Vidéos',
      size: loadingCategories.videos
        ? 'Chargement...'
        : formatCategoryDisplaySize(videosTotalBytes, videosList.length, 'vidéo'),
      icon: Film,
      color: 'text-purple-400'
    },
    {
      id: 'audio',
      name: 'Audio',
      size: loadingCategories.audio
        ? 'Chargement...'
        : formatCategoryDisplaySize(audioTotalBytes, audioList.length, 'piste'),
      icon: Music,
      color: 'text-amber-400'
    },
    {
      id: 'documents',
      name: 'Documents',
      size: loadingCategories.documents
        ? 'Chargement...'
        : formatCategoryDisplaySize(docsTotalBytes, documentsList.length, 'document'),
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
  ], [
    loadingCategories,
    downloadsTotalBytes, downloadedItems.length,
    imagesTotalBytes, imagesList.length,
    videosTotalBytes, videosList.length,
    audioTotalBytes, audioList.length,
    docsTotalBytes, documentsList.length
  ]);

  // Collections StudyCloud avec sous-titres dynamiques
  const collections = useMemo(() => [
    {
      id: 'favorites',
      name: 'Favoris',
      subtitle: loadingCategories.favorites
        ? 'Chargement...'
        : (favoritesTotalBytes > 0 
            ? formatCategoryDisplaySize(favoritesTotalBytes, favoriteFiles.length, 'favori') 
            : (favoriteFiles.length > 0 ? `${favoriteFiles.length} favoris` : '0 Mo')),
      icon: Star,
      color: 'text-amber-400'
    },
    {
      id: 'secure-folder',
      name: 'Dossier sécurisé',
      subtitle: loadingCategories.secure
        ? 'Chargement...'
        : (secureTotalBytes > 0 
            ? formatCategoryDisplaySize(secureTotalBytes, secureFolderFiles.length, 'fichier') 
            : (secureFolderFiles.length > 0 ? `${secureFolderFiles.length} fichiers` : '0 Mo')),
      icon: Lock,
      color: 'text-blue-400'
    },
    {
      id: 'cloud-storage',
      name: 'Espace Cloud',
      subtitle: loadingCategories.cloudStorage
        ? 'Chargement...'
        : formatCategoryDisplaySize(totalCloudStorageBytes, 0, ''),
      icon: Cloud,
      color: 'text-sky-400'
    },
    {
      id: 'trash',
      name: 'Corbeille',
      subtitle: loadingCategories.trash
        ? 'Chargement...'
        : (trashTotalBytes > 0 
            ? formatCategoryDisplaySize(trashTotalBytes, trashFiles.length, 'élément') 
            : (trashFiles.length > 0 ? `${trashFiles.length} éléments` : '0 Mo')),
      icon: Trash2,
      color: 'text-rose-400'
    }
  ], [
    loadingCategories,
    favoritesTotalBytes, favoriteFiles.length,
    secureTotalBytes, secureFolderFiles.length,
    trashTotalBytes, trashFiles.length,
    totalCloudStorageBytes
  ]);

  // Éléments de la barre horizontale de navigation Espace Cloud
  const cloudNavItems = useMemo(() => [
    {
      id: 'downloads' as const,
      name: 'Téléchargements',
      subtitle: loadingCategories.downloads
        ? 'Chargement...'
        : formatCategoryDisplaySize(downloadsTotalBytes, downloadedItems.length, 'fichier'),
      icon: Download,
      color: 'text-cyan-400'
    },
    {
      id: 'images' as const,
      name: 'Images',
      subtitle: loadingCategories.images
        ? 'Chargement...'
        : formatCategoryDisplaySize(imagesTotalBytes, imagesList.length, 'image'),
      icon: ImageIcon,
      color: 'text-emerald-400'
    },
    {
      id: 'videos' as const,
      name: 'Vidéos',
      subtitle: loadingCategories.videos
        ? 'Chargement...'
        : formatCategoryDisplaySize(videosTotalBytes, videosList.length, 'vidéo'),
      icon: Film,
      color: 'text-purple-400'
    },
    {
      id: 'audio' as const,
      name: 'Audio',
      subtitle: loadingCategories.audio
        ? 'Chargement...'
        : formatCategoryDisplaySize(audioTotalBytes, audioList.length, 'piste'),
      icon: Music,
      color: 'text-amber-400'
    },
    {
      id: 'documents' as const,
      name: 'Documents',
      subtitle: loadingCategories.documents
        ? 'Chargement...'
        : formatCategoryDisplaySize(docsTotalBytes, documentsList.length, 'document'),
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
      subtitle: loadingCategories.favorites
        ? 'Chargement...'
        : (favoritesTotalBytes > 0 
            ? formatCategoryDisplaySize(favoritesTotalBytes, favoriteFiles.length, 'favori') 
            : (favoriteFiles.length > 0 ? `${favoriteFiles.length} favoris` : '0 Mo')),
      icon: Star,
      color: 'text-amber-400'
    },
    {
      id: 'secure-folder' as const,
      name: 'Dossier sécurisé',
      subtitle: loadingCategories.secure
        ? 'Chargement...'
        : (secureTotalBytes > 0 
            ? formatCategoryDisplaySize(secureTotalBytes, secureFolderFiles.length, 'fichier') 
            : (secureFolderFiles.length > 0 ? `${secureFolderFiles.length} fichiers` : '0 Mo')),
      icon: Lock,
      color: 'text-blue-400'
    },
    {
      id: 'trash' as const,
      name: 'Corbeille',
      subtitle: loadingCategories.trash
        ? 'Chargement...'
        : (trashTotalBytes > 0 
            ? formatCategoryDisplaySize(trashTotalBytes, trashFiles.length, 'élément') 
            : (trashFiles.length > 0 ? `${trashFiles.length} éléments` : '0 Mo')),
      icon: Trash2,
      color: 'text-rose-400'
    }
  ], [
    loadingCategories,
    downloadsTotalBytes, downloadedItems.length,
    imagesTotalBytes, imagesList.length,
    videosTotalBytes, videosList.length,
    audioTotalBytes, audioList.length,
    docsTotalBytes, documentsList.length,
    favoritesTotalBytes, favoriteFiles.length,
    secureTotalBytes, secureFolderFiles.length,
    trashTotalBytes, trashFiles.length
  ]);

  // Helper pour l'affichage progressif animé lors de l'accès direct et rapide à un menu
  const renderCategoryProgressiveSkeleton = (
    categoryName: string,
    type: 'grid' | 'cards' | 'audio-list' | 'classeur-grid',
    badgeColor: string = 'text-blue-400'
  ) => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2">
          <Loader2 className={`w-4 h-4 animate-spin ${badgeColor}`} />
          <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-white tracking-wide">
            Chargement {categoryName.toLowerCase()}...
          </span>
        </div>
        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider animate-pulse">
          Synchronisation Cloud
        </span>
      </div>

      {type === 'audio-list' ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-gradient-to-r from-stone-200/60 to-stone-100/30 dark:from-[#0E1526] dark:to-[#070B14] border border-stone-300/40 dark:border-white/5 flex items-center px-4 gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded-full bg-stone-300/60 dark:bg-white/15" />
                <div className="h-2 w-1/4 rounded-full bg-stone-300/40 dark:bg-white/10" />
              </div>
              <div className="w-12 h-3 rounded-full bg-stone-300/40 dark:bg-white/10 shrink-0" />
            </div>
          ))}
        </div>
      ) : type === 'classeur-grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 rounded-3xl bg-[#0E1526]/80 border border-white/10 p-4 flex flex-col justify-between animate-pulse">
              <div className="w-20 h-16 rounded-2xl bg-orange-500/20 mx-auto" />
              <div className="space-y-1.5 pt-2">
                <div className="h-3 w-3/4 rounded-full bg-white/15 mx-auto" />
                <div className="h-2 w-1/2 rounded-full bg-white/10 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-2.5 sm:gap-3.5 ${
          splitSelectedFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        }`}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="aspect-square sm:aspect-auto sm:h-52 rounded-2xl bg-gradient-to-br from-stone-200/70 to-stone-100/40 dark:from-[#0E1526] dark:to-[#070B14] border border-stone-300/50 dark:border-white/10 p-3 flex flex-col justify-between overflow-hidden animate-pulse">
              <div className="w-full h-28 rounded-xl bg-stone-300/40 dark:bg-white/10" />
              <div className="space-y-1.5 pt-2">
                <div className="h-3 w-4/5 rounded-full bg-stone-300/60 dark:bg-white/15" />
                <div className="h-2 w-1/2 rounded-full bg-stone-300/40 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
      const trashed = tracksToDelete.map(t => ({ ...t, isTrash: true }));
      setTrashFiles(prev => [...trashed, ...prev.filter(f => !selectedAudioIds.includes(f.id))]);
      CloudDataStore.moveToTrash(trashed as any);
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

  useEffect(() => {
    let isCurrent = true;
    const ext = (splitSelectedFile?.name || '').includes('.') ? (splitSelectedFile?.name || '').split('.').pop()?.toLowerCase() || '' : '';
    const isAud = (f: any) => f && (
      f.category === 'audio' ||
      f.isAudio ||
      Boolean(f.audioUrl) ||
      (f.type && f.type.startsWith('audio/')) ||
      isWhatsAppAudio(f.name, f.type) ||
      EXTENSION_MAP.audio.includes(ext) ||
      /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(f.name)
    );
    const currentTrack = (selectedAudioTrack && isAud(selectedAudioTrack)) ? selectedAudioTrack : (splitSelectedFile && isAud(splitSelectedFile)) ? splitSelectedFile : null;
    if (currentTrack?.id) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const fallbackUrl = `${baseUrl}/api/cloud/stream/${encodeURIComponent(currentTrack.id)}`;
      const directUrl = currentTrack.audioUrl || (currentTrack as any).url;

      if (directUrl && typeof directUrl === 'string' && directUrl.trim() && !directUrl.startsWith('blob:')) {
        setSplitResolvedAudioUrl(directUrl);
      } else {
        setSplitResolvedAudioUrl(fallbackUrl);
      }

      getFileBlobUrl(currentTrack.id).then(blobUrl => {
        if (isCurrent && blobUrl) {
          setSplitResolvedAudioUrl(blobUrl);
        } else if (isCurrent && (!directUrl || directUrl.startsWith('blob:'))) {
          setSplitResolvedAudioUrl(fallbackUrl);
        }
      }).catch(() => {
        if (isCurrent && (!directUrl || directUrl.startsWith('blob:'))) {
          setSplitResolvedAudioUrl(fallbackUrl);
        }
      });
    } else {
      setSplitResolvedAudioUrl('');
    }
    return () => { isCurrent = false; };
  }, [selectedAudioTrack?.id, splitSelectedFile?.id]);

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
      const existingIdx = convertedFiles.findIndex(f => f.id === selectedFileForStudy.id);
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
        className={`studycloud-file-menu-panel absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-[100] w-60 max-w-[calc(100vw-32px)] bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(59,130,246,0.25)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col`}
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
        const newFolderId = `c3d-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const duplicatedFolder: ClasseurCreatedFolder = {
          ...folder,
          id: newFolderId,
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
        CloudDataStore.addClasseurFolder(duplicatedFolder);
        // Sauvegarde de la copie du dossier dans Cloudflare D1 avec le même ID
        CloudStorageAPI.duplicateItem(folder.id, 'classeur_folder', undefined, newName, newFolderId).then(() => {
          invalidateCloudQueries.classeurFolders().catch(() => {});
        }).catch(console.error);
        showToast(`Dossier dupliqué : "${duplicatedFolder.name}" !`);
        break;
      }

      case 'favorite': {
        const newFav = !folder.isFavorite;
        setClasseur3DFolders(prev =>
          prev.map(f => f.id === folder.id ? { ...f, isFavorite: newFav } : f)
        );
        if (newFav) {
          CloudStorageAPI.addFavorite(folder.id, 'classeur_folder').catch(console.error);
          showToast('Ajouté aux favoris !');
        } else {
          CloudStorageAPI.removeFavorite(folder.id).catch(console.error);
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
          CloudStorageAPI.removePinned(folder.id).catch(console.error);
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
          CloudDataStore.renameFolder(folder.id, trimmed);
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
          // Si déplacement interne de fichier (réorganisation dans le dossier), ne pas afficher l'overlay d'importation
          if (draggedFileId || !e.dataTransfer.types.includes('Files')) {
            return;
          }
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
          if (draggedFileId) return;
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
                  setSelectedClasseurFile(null);
                  setIsViewerMaximized(false);
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
                          setSelectedClasseurFile(null);
                          setIsViewerMaximized(false);
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
        {sortOption === 'duplicates' && sortedFiles.length === 0 ? (
          <div className="py-20 sm:py-28 flex flex-col items-center justify-center text-center text-stone-500 dark:text-slate-400 rounded-3xl border-2 border-dashed border-white/10 p-6 bg-black/20">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 shadow-sm">
              <Copy className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.8]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-rose-400">
              Aucun résultat pour les doublons
            </h3>
            <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Tous les fichiers de ce dossier sont uniques dans la base de données. Aucun doublon détecté.
            </p>
            <button
              type="button"
              onClick={() => setSortOption('recent')}
              className="mt-4 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Afficher tous les fichiers
            </button>
          </div>
        ) : totalItems === 0 ? (
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 205px))',
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
                    draggable={!isSelectionMode && !isSaving && sortedFiles.length > 1}
                    onDragStart={(e) => {
                      if (sortedFiles.length <= 1) {
                        e.preventDefault();
                        return;
                      }
                      e.stopPropagation();
                      e.dataTransfer.setData('text/plain', file.id);
                      e.dataTransfer.setData('application/studycloud-file', file.id);
                      e.dataTransfer.effectAllowed = 'move';
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
                    className={`group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between select-none max-w-[215px] w-full ${
                      isSaving ? 'cursor-wait' : sortedFiles.length > 1 ? 'cursor-pointer active:cursor-grab' : 'cursor-pointer'
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
                  draggable={!isSelectionMode && !isSaving && sortedFiles.length > 1}
                  onDragStart={(e) => {
                    if (sortedFiles.length <= 1) {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                    e.dataTransfer.setData('text/plain', file.id);
                    e.dataTransfer.setData('application/studycloud-file', file.id);
                    e.dataTransfer.effectAllowed = 'move';
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
                  className={`group relative bg-[#0E1526]/85 hover:bg-[#141E34] border rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col max-w-[215px] w-full ${
                    isSaving ? 'cursor-wait' : sortedFiles.length > 1 ? 'cursor-pointer active:cursor-grab' : 'cursor-pointer'
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
                    ) : ((file.category as string) === 'audio' || Boolean(file.audioUrl)) ? (
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

            {/* Fichiers doublons */}
            <button
              type="button"
              onClick={() => {
                setSortOption('duplicates');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'duplicates'
                  ? 'bg-rose-600/20 text-rose-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Copy className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>Fichiers doublons</span>
              </div>
              {sortOption === 'duplicates' && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
            </button>

            {/* Trier par plus lourd au moyen */}
            <button
              type="button"
              onClick={() => {
                setSortOption('size-desc');
                setIsHeaderMenuOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                sortOption === 'size-desc'
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ArrowDownWideNarrow className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>Trier par plus lourd au moyen</span>
              </div>
              {sortOption === 'size-desc' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
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
          ) : ((file.category as string) === 'audio' || Boolean(file.audioUrl)) ? (
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
        className={`group relative aspect-[3/4] rounded-2xl bg-gradient-to-br from-[#121929] via-[#0B0F19] to-black border transition-all duration-200 ${
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

      // 1. Ajouter immédiatement dans CloudDataStore (RAM + IndexedDB)
      CloudDataStore.addClasseurFolder(created3DFolder);

      // 2. Enregistrer pour réplication locale RxDB/Hono
      LocalSyncReplication.recordLocalUpsert(created3DFolder.id, 'classeur_folder', created3DFolder);

      // 3. Nouveaux dossiers créés toujours en haut par défaut (index 0)
      setClasseur3DFolders(prev => [created3DFolder, ...prev.filter(f => f.id !== created3DFolder.id)]);
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





  // Fonction universelle de fermeture du lecteur (ou réduction si plein écran)
  const handleCloseReader = () => {
    if (isViewerMaximized) {
      setIsViewerMaximized(false);
    } else {
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
      }
      if (splitSelectedFile && (splitSelectedFile.isNotepad || splitSelectedFile.extension === 'txt' || splitSelectedFile.name.toLowerCase().endsWith('.txt') || splitSelectedFile.category === 'notes')) {
        CloudStorageAPI.updateClasseurFile(splitSelectedFile.id, {
          noteTitle: noteTitleContent,
          content: noteTextContent,
        }).catch(() => {});
      }

      setSelectedDocFile(null);
      setSelectedVideoFile(null);
      setSelectedImageFile(null);
      setSelectedAudioTrack(null);
      setSelectedDownloadFile(null);
      setSelectedClasseurFile(null);
      setSelectedCollectionFile(null);
      setSplitSelectedFile(null);
      setIsViewerMaximized(false);
      setIsMobilePlayerOpen(false);
      setIsAudioPlaying(false);
    }
  };


  // =========================================================================
  // FONCTIONS DE LECTEURS ET NAVIGATION STRICTEMENT INDÉPENDANTS (IMAGES 1 À 5)
  // =========================================================================

  const toggleAudioPlayPause = () => {
    setIsAudioPlaying(prev => !prev);
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleNavigateDoc = (direction: 'prev' | 'next') => {
    if (filteredDocuments.length === 0) return;
    const currentIndex = selectedDocFile 
      ? filteredDocuments.findIndex(d => d.id === selectedDocFile.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredDocuments.length - 1;
    if (newIndex >= filteredDocuments.length) newIndex = 0;
    const nextDoc = filteredDocuments[newIndex];
    if (nextDoc) {
      setSelectedDocFile(nextDoc);
      setSplitSelectedFile(nextDoc);
      setViewerZoom(1);
      setViewerRotation(0);
      setDocCurrentPage(1);
    }
  };

  const handleNavigateVideo = (direction: 'prev' | 'next') => {
    if (filteredVideos.length === 0) return;
    const currentIndex = selectedVideoFile 
      ? filteredVideos.findIndex(v => v.id === selectedVideoFile.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredVideos.length - 1;
    if (newIndex >= filteredVideos.length) newIndex = 0;
    const nextVideo = filteredVideos[newIndex];
    if (nextVideo) {
      setSelectedVideoFile(nextVideo);
      setSplitSelectedFile(nextVideo);
    }
  };

  const handleNavigateImage = (direction: 'prev' | 'next') => {
    if (filteredImages.length === 0) return;
    const currentIndex = selectedImageFile 
      ? filteredImages.findIndex(img => img.id === selectedImageFile.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredImages.length - 1;
    if (newIndex >= filteredImages.length) newIndex = 0;
    const nextImage = filteredImages[newIndex];
    if (nextImage) {
      setSelectedImageFile(nextImage);
      setSplitSelectedFile(nextImage);
    }
  };

  // 0. PAGE D'ÉCRITURE / BLOC-NOTES DÉDIÉE (ÉCRITURE DIRECTE, SANS BOUTON HORIZONTAL NI ZOOM)
  const renderNoteWriterPage = (file: FileItem) => {
    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-text">
        {/* Barre supérieure dédiée à la page d'écriture (SANS bouton horizontal/vertical, SANS zoom) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 shadow-sm">
              <FileEdit className="w-4 h-4 stroke-[2.2]" />
            </div>

            <div className="min-w-0 ml-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  TXT
                </span>
                <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={file.name}>
                  {file.name}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                {isNoteSavedIndicator ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" /> Enregistré
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold animate-pulse">
                    Modifications en cours...
                  </span>
                )}
                {file.size && (
                  <span className="text-slate-400 font-medium hidden sm:inline">
                    • {file.size}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Boutons d'action : Télécharger .txt, Partager, Agrandir, Fermer */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const fullContent = (noteTitleContent ? `${noteTitleContent}\n\n` : '') + noteTextContent;
                const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name.endsWith('.txt') ? file.name : `${file.name}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(`"${file.name}" téléchargé !`);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger la note (.txt)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleShareFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ' + (
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              )}
              title={isViewerMaximized ? "Réduire la vue" : "Agrandir l'espace d'écriture"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>

            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer la page d'écriture"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps de la page d'écriture : Titre en majuscules + Zone de texte libre */}
        <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col space-y-3 bg-[#070B14]/80 select-text">
          {/* Titre dédié en majuscules limité à 2 lignes */}
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
              handleUpdateNoteContent(noteTextContent, limitedVal, file.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const currentLines = noteTitleContent.split('\n');
                if (currentLines.length >= 2) e.preventDefault();
              }
            }}
            className="w-full uppercase font-black text-sm sm:text-base md:text-lg text-cyan-300 placeholder:text-slate-500 placeholder:normal-case bg-transparent border-b border-white/10 pb-2 outline-none resize-none tracking-wide break-all [overflow-wrap:anywhere] [word-break:break-word] leading-snug selection:bg-cyan-500/30 shrink-0"
            style={{ maxHeight: '4.2rem', lineHeight: '1.4' }}
          />

          {/* Zone de contenu principale de prise de notes */}
          <textarea
            autoFocus
            value={noteTextContent}
            onChange={(e) => {
              const newText = e.target.value;
              setNoteTextContent(newText);
              setIsNoteSavedIndicator(false);
              handleUpdateNoteContent(newText, noteTitleContent, file.id);
            }}
            placeholder="Écrivez vos notes, cours ou réflexions ici..."
            className="w-full flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm md:text-base leading-relaxed resize-none outline-none font-sans no-scrollbar break-all [overflow-wrap:anywhere] [word-break:break-word] selection:bg-cyan-500/30"
          />
        </div>

        {/* Barre inférieure : Statistiques et statut de synchronisation */}
        <div className="px-4 sm:px-6 py-2 bg-[#070B14] border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 shrink-0 select-none">
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
    );
  };

  // 1. LECTEUR DOCUMENT DÉDIÉ (IMAGE 1)
  const renderDocumentReader = (file: FileItem) => {
    const ext = (file.name || '').includes('.') ? (file.name || '').split('.').pop()?.toLowerCase() || '' : '';
    const isNotepad = Boolean(
      file.isNotepad ||
      ext === 'txt' ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.category === 'notes' ||
      file.type === 'text/plain'
    );
    if (isNotepad) return renderNoteWriterPage(file);

    const isPdf = file.extension === 'pdf' || file.name.toLowerCase().endsWith('.pdf') || (file.url && file.url.toLowerCase().includes('.pdf')) || Boolean(file.type?.includes('pdf'));
    const pdfUrl = splitResolvedPdfUrl || file.url || '';
    const cleanPdfBase = pdfUrl.split('#')[0];
    const nativePdfUrl = cleanPdfBase ? cleanPdfBase + '#toolbar=1&navpanes=0&view=FitH' : '';

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur document (Image 1) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateDoc('prev')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Document précédent"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateDoc('next')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Document suivant"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={file.name}>
                {file.name}
              </p>
              {file.size && (
                <p className="text-[10px] text-slate-400 font-semibold truncate">
                  {file.size}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
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

            {/* Bouton Mode Vertical / Horizontal (Image 1) */}
            <button
              type="button"
              onClick={() => {
                const nextMode = docLayoutMode === 'vertical' ? 'horizontal' : 'vertical';
                setDocLayoutMode(nextMode);
                setDocCurrentPage(1);
                showToast(nextMode === 'horizontal' ? 'Mode défilement horizontal activé' : 'Mode défilement vertical activé');
              }}
              className={'h-7 sm:h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-bold border transition-all cursor-pointer shadow-sm active:scale-95 ' + (
                docLayoutMode === 'horizontal'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-400/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30 ring-1 ring-blue-400/40'
              )}
              title={docLayoutMode === 'vertical' ? "Défilement vertical (Cliquer pour passer en horizontal)" : "Défilement horizontal (Cliquer pour passer en vertical)"}
            >
              <SlidersHorizontal className={'w-3.5 h-3.5 ' + (docLayoutMode === 'vertical' ? 'rotate-90 text-blue-400' : 'text-amber-400')} />
              <span className="text-[11px] font-black">{docLayoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleShareFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDownloadFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleOpenStudySpaceForCurrentMenu(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
              title="Ouvrir dans l'Espace d'étude"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ' + (
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              )}
              title={isViewerMaximized ? "Réduire la vue" : "Agrandir dans l'espace"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>

            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur de document"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du Document (Image 1) */}
        <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-stone-100 dark:bg-stone-900 select-text">
          {isPdf ? (
            docLayoutMode === 'horizontal' ? (
              <PdfHorizontalViewer
                fileId={file.id}
                file={file}
                url={splitResolvedPdfUrl || file.url}
                docZoom={Math.round(viewerZoom * 100)}
                layoutMode="horizontal"
                currentPage={docCurrentPage}
                onPageChange={setDocCurrentPage}
                isFullscreen={isViewerMaximized}
              />
            ) : (
              nativePdfUrl ? (
                <div className="w-full h-full flex-1 flex flex-col items-center overflow-hidden bg-stone-100 dark:bg-stone-900">
                  <object
                    key={'pdf-native-' + (file.id || cleanPdfBase)}
                    data={nativePdfUrl}
                    type="application/pdf"
                    className="w-full h-full border-0 block flex-1"
                    style={{ width: '100%', height: '100%' }}
                  >
                    <iframe
                      key={'iframe-pdf-native-' + (file.id || cleanPdfBase)}
                      src={nativePdfUrl}
                      title={file.name || 'Document PDF'}
                      className="w-full h-full border-0 block flex-1"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </object>
                </div>
              ) : (
                <PdfHorizontalViewer
                  fileId={file.id}
                  file={file}
                  url={file.url}
                  docZoom={Math.round(viewerZoom * 100)}
                  layoutMode="vertical"
                  currentPage={docCurrentPage}
                  onPageChange={setDocCurrentPage}
                  isFullscreen={isViewerMaximized}
                />
              )
            )
          ) : (
            <ModernDocumentViewer
              fileId={file.id}
              url={file.url}
              fileName={file.name}
              fileSize={file.size}
              className="w-full h-full border-0 rounded-none shadow-none"
            />
          )}
        </div>
      </div>
    );
  };

  const renderDocumentEmptyState = () => (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#0C111D] border-t md:border-t-0 md:border-l border-white/10 select-none">
      <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 shadow-sm">
        <FileText className="w-10 h-10 stroke-[1.8]" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-200">
        Aucun document sélectionné
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Sélectionnez un document dans la liste de gauche pour l'afficher dans le lecteur.
      </p>
    </div>
  );

  // 2. LECTEUR AUDIO DÉDIÉ (IMAGE 2 & IMAGE 3)
  const renderAudioPlayer = (track: FileItem) => {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const fallbackStreamUrl = track.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(track.id)}` : '';
    const rawDirect = track.audioUrl || (track as any).url || '';
    const isDirectUsable = rawDirect && !rawDirect.startsWith('blob:');
    const audioSrc = splitResolvedAudioUrl || (isDirectUsable ? rawDirect : '') || fallbackStreamUrl;

    return (
      <div className="relative w-full h-full flex-1 flex flex-col justify-between p-3 sm:p-6 md:p-8 bg-[#090D1A] text-white overflow-hidden select-none">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          autoPlay={isAudioPlaying}
          loop={isAudioRepeat === 'one'}
          onCanPlay={() => {
            if (isAudioPlaying && audioRef.current && audioRef.current.paused) {
              audioRef.current.play().catch(() => {});
            }
          }}
          onPlay={() => setIsAudioPlaying(true)}
          onPause={() => setIsAudioPlaying(false)}
          onError={async () => {
            console.warn('[AudioPlayer] Erreur chargement audio pour', track.name);
            if (track.id) {
              try {
                const freshBlob = await getFileBlobUrl(track.id);
                if (freshBlob && freshBlob !== audioSrc) {
                  setSplitResolvedAudioUrl(freshBlob);
                  if (audioRef.current) {
                    audioRef.current.src = freshBlob;
                    audioRef.current.play().catch(() => {});
                  }
                  return;
                }
              } catch (e) {}

              if (fallbackStreamUrl && audioSrc !== fallbackStreamUrl) {
                setSplitResolvedAudioUrl(fallbackStreamUrl);
                if (audioRef.current) {
                  audioRef.current.src = fallbackStreamUrl;
                  audioRef.current.play().catch(() => {});
                }
                return;
              }
            }
          }}
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
            if (audioRef.current) {
              setAudioCurrentTime(Math.floor(audioRef.current.currentTime));
              if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                setAudioDuration(Math.floor(audioRef.current.duration));
              }
            }
          }}
        />

        {/* Halo ambré chaleureux */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-35"
          style={{
            background: 'radial-gradient(circle at 45% 30%, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.18) 40%, transparent 75%)'
          }}
        />

        {/* Bouton retour mobile */}
        <div className="md:hidden flex items-center justify-between pb-2 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobilePlayerOpen(false)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Retour à la liste</span>
          </button>
        </div>

        {/* En-tête du lecteur audio */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 relative z-10 shrink-0">
          <div className="min-w-0 pr-2">
            <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={track.name}>
              {track.name}
            </p>
            <p className="text-[10px] text-amber-400 font-semibold truncate">
              {track.artist || track.size || 'StudyCloud Audio'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleShareFile(track)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDownloadFile(track)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenStudySpaceForCurrentMenu(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
              title="Ouvrir dans l'Espace d'étude"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            
            {/* Options 3 traits */}
            <div className="relative studycloud-menu-trigger">
              <button
                type="button"
                onClick={() => setIsPlayerMenuOpen(!isPlayerMenuOpen)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Options de lecture"
              >
                <Menu className="w-4 h-4 stroke-[2.2]" />
              </button>
              {isPlayerMenuOpen && (
                <div 
                  className="studycloud-file-menu-panel absolute right-0 top-9 z-50 w-52 bg-[#0D1527] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs text-white divide-y divide-white/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button type="button" onClick={() => { handleDownloadFile(track); setIsPlayerMenuOpen(false); }} className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer">
                    <Download className="w-4 h-4 text-blue-400" /> Télécharger ce son
                  </button>
                  <button type="button" onClick={() => { handleShareFile(track); setIsPlayerMenuOpen(false); }} className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer">
                    <Share2 className="w-4 h-4 text-emerald-400" /> Partager
                  </button>
                  <button type="button" onClick={() => { toggleAudioRepeat(); setIsPlayerMenuOpen(false); }} className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer">
                    <Repeat className="w-4 h-4 text-amber-400" /> <span>{isAudioRepeat === 'one' ? "Désactiver la boucle" : "Lire en boucle"}</span>
                  </button>
                  <button type="button" onClick={() => { setIsAudioShuffle(!isAudioShuffle); setIsPlayerMenuOpen(false); }} className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer">
                    <Shuffle className="w-4 h-4 text-amber-400" /> <span>{isAudioShuffle ? "Désactiver mode aléatoire" : "Mode aléatoire"}</span>
                  </button>
                  <button type="button" onClick={() => { handleDeleteAudio(track); setIsPlayerMenuOpen(false); }} className="w-full px-3.5 py-2.5 text-left hover:bg-rose-950/40 text-rose-400 flex items-center gap-2.5 cursor-pointer">
                    <Trash2 className="w-4 h-4 text-rose-500" /> Supprimer ce son
                  </button>
                </div>
              )}
            </div>

            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur audio"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Centre : Pochette MESSAGE, waveform et détails (Image 3) */}
        <div className="relative z-10 w-full flex items-center justify-center max-w-sm mx-auto my-auto pt-2 sm:pt-4">
          <div className="relative w-44 sm:w-56 md:w-64 aspect-square rounded-2xl overflow-hidden shrink-0 shadow-[0_20px_45px_rgba(0,0,0,0.85)] border border-white/20 bg-black group">
            <AudioCardPreview track={track} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/85 border border-white/25 rounded text-[7px] font-black uppercase tracking-wider text-white">
              Parental Advisory
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full text-center space-y-1 my-2 sm:my-3">
          <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md truncate px-2">
            {track.name}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate px-2">
            {track.artist || track.source || 'StudyCloud Audio'}
          </p>
        </div>

        {/* Section temporelle */}
        <div className="relative z-10 w-full max-w-md mx-auto space-y-1.5 py-1">
          <div className="flex items-center justify-between px-3">
            <button
              type="button"
              onClick={() => handleSeekDelta(-10)}
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
              title="Reculer de 10s"
            >
              <RotateCcw className="w-5 h-5 stroke-[2]" />
              <span className="absolute text-[8px] font-black text-white">10</span>
            </button>

            <div className="px-3.5 py-1 rounded-full bg-white text-stone-950 font-black text-xs shadow-md tracking-wider">
              {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
            </div>

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

        {/* Contrôles principaux (Image 3) */}
        <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between px-2 pt-1 pb-2 sm:pb-3">
          <button
            type="button"
            onClick={() => {
              setIsAudioShuffle(!isAudioShuffle);
              showToast(!isAudioShuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée");
            }}
            className={'p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer ' + (
              isAudioShuffle ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
            )}
            title={isAudioShuffle ? "Désactiver mode aléatoire" : "Mode aléatoire"}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleAudioPrev}
            className="p-2 text-white hover:text-amber-400 transition-all active:scale-90 cursor-pointer"
            title="Piste précédente"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={toggleAudioPlayPause}
            className="w-14 h-14 rounded-full bg-white text-stone-950 flex items-center justify-center hover:scale-105 active:scale-95 shadow-[0_8px_25px_rgba(255,255,255,0.3)] transition-all cursor-pointer"
            title={isAudioPlaying ? "Mettre en pause" : "Lire"}
          >
            {isAudioPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={handleAudioNext}
            className="p-2 text-white hover:text-amber-400 transition-all active:scale-90 cursor-pointer"
            title="Piste suivante"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={toggleAudioRepeat}
            className={'p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 cursor-pointer relative ' + (
              isAudioRepeat !== 'off' ? 'text-amber-400 ring-1 ring-amber-400/40 bg-amber-400/10' : 'text-white/60 hover:text-white'
            )}
            title={isAudioRepeat === 'one' ? "Boucle 1 titre" : isAudioRepeat === 'all' ? "Boucle tous les titres" : "Boucle désactivée"}
          >
            <Repeat className="w-5 h-5" />
            {isAudioRepeat === 'one' && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] font-black text-amber-400">1</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderAudioEmptyState = () => (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center select-none bg-[#090D1A] border-t md:border-t-0 md:border-l border-white/10 animate-in fade-in duration-200">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-[0_8px_30px_rgba(245,158,11,0.45)] border-2 border-white/30 ring-4 ring-black/40 relative mb-4">
        <div className="absolute inset-2 rounded-full border border-white/20 pointer-events-none" />
        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 10.5C2.5 7.8 4.2 5.5 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          <path d="M21.5 10.5C21.5 7.8 19.8 5.5 17.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          <path d="M9 16.5V5.5L20 3.5V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 9.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="6" cy="16.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 6 16.5)" />
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
  );

  // 3. LECTEUR VIDÉO DÉDIÉ (IMAGE 4)
  const renderVideoPlayer = (file: FileItem) => {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const fallbackStreamUrl = file.id ? `${baseUrl}/api/cloud/stream/${encodeURIComponent(file.id)}` : '';
    const videoSrc = file.videoUrl || file.url || fallbackStreamUrl;

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur vidéo (Image 4) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateVideo('prev')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Vidéo précédente"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateVideo('next')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Vidéo suivante"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-purple-400 font-semibold truncate">
                {file.size || 'Vidéo'} • 1080P HD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleShareFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDownloadFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenStudySpaceForCurrentMenu(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
              title="Ouvrir dans l'Espace d'étude"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ' + (
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              )}
              title={isViewerMaximized ? "Réduire la vue" : "Plein écran"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>
            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur vidéo"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur vidéo (Image 4) */}
        <div className="flex-1 w-full h-full flex items-center justify-center relative p-1 sm:p-2 overflow-hidden">
          <ModernVideoPlayer
            src={videoSrc}
            poster={file.previewUrl}
            fileName={file.name}
            fileId={file.id}
            fileSize={file.size}
            autoPlay={true}
            className="w-full h-full max-h-[calc(100vh-180px)] rounded-2xl"
          />
        </div>
      </div>
    );
  };

  const renderVideoEmptyState = () => (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#04060A] border-t md:border-t-0 md:border-l border-white/10 select-none animate-in fade-in duration-200">
      <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 shadow-sm">
        <Film className="w-10 h-10 stroke-[1.8]" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-200">
        Aucune vidéo sélectionnée
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Sélectionnez une vidéo dans la liste de gauche pour lancer la lecture.
      </p>
    </div>
  );

  // 4. LECTEUR IMAGE DÉDIÉ (IMAGE 5)
  const renderImageViewer = (file: FileItem) => {
    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur image (Image 5) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateImage('prev')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Image précédente"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateImage('next')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Image suivante"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-emerald-400 font-semibold truncate">
                {file.size || 'Image'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleShareFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDownloadFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenStudySpaceForCurrentMenu(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
              title="Ouvrir dans l'Espace d'étude"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ' + (
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              )}
              title={isViewerMaximized ? "Réduire la vue" : "Plein écran"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>
            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur d'image"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur d'image (Image 5) */}
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center relative overflow-hidden p-1 sm:p-2">
          <ModernImageViewer
            src={file.previewUrl || (file as any).url}
            alt={file.name}
            fileName={file.name}
            fileId={file.id}
            fileSize={file.size}
            className="w-full h-full max-h-[calc(100vh-180px)] rounded-2xl"
          />
        </div>
      </div>
    );
  };

  const renderImageEmptyState = () => (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#04060A] border-t md:border-t-0 md:border-l border-white/10 select-none animate-in fade-in duration-200">
      <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
        <ImageIcon className="w-10 h-10 stroke-[1.8]" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-200">
        Aucune image sélectionnée
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Sélectionnez une image dans la liste de gauche pour l'afficher.
      </p>
    </div>
  );

  // 5. LECTEUR TÉLÉCHARGEMENT DÉDIÉ
  const renderDownloadReader = (file: FileItem | DownloadedItem) => {
    const ext = (file.name || '').includes('.') ? (file.name || '').split('.').pop()?.toLowerCase() || '' : '';
    const isNotepad = Boolean(
      (file as any).isNotepad ||
      ext === 'txt' ||
      (file.name || '').toLowerCase().endsWith('.txt') ||
      file.category === 'notes' ||
      (file as any).type === 'text/plain'
    );
    const isVid = file.category === 'videos' || Boolean((file as any).videoUrl) || /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp)$/i.test(file.name);
    const isAud = file.category === 'audio' || Boolean((file as any).audioUrl) || isWhatsAppAudio(file.name, (file as any).type) || EXTENSION_MAP.audio.includes(ext) || /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(file.name);
    const isImg = file.category === 'images' || Boolean((file as any).isImage) || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name);
    
    if (isNotepad) return renderNoteWriterPage(file as FileItem);
    if (isVid) return renderVideoPlayer(file as FileItem);
    if (isAud) return renderAudioPlayer(file as FileItem);
    if (isImg) return renderImageViewer(file as FileItem);
    return renderDocumentReader(file as FileItem);
  };

  const renderDownloadEmptyState = () => (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#04060A] border-t md:border-t-0 md:border-l border-white/10 select-none">
      <div className="w-20 h-20 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 shadow-sm">
        <Download className="w-10 h-10 stroke-[1.8]" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-200">
        Aucun fichier sélectionné
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Sélectionnez un élément téléchargé pour l'ouvrir.
      </p>
    </div>
  );

  // 6. LECTEUR CLASSEUR & COLLECTIONS DÉDIÉ
  const renderClasseurFileReader = (file: FileItem) => {
    const ext = (file.name || '').includes('.') ? (file.name || '').split('.').pop()?.toLowerCase() || '' : '';
    const isNotepad = Boolean(
      file.isNotepad ||
      ext === 'txt' ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.category === 'notes' ||
      file.type === 'text/plain'
    );
    const isVid = file.category === 'videos' || Boolean(file.videoUrl) || /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp)$/i.test(file.name);
    const isAud = file.category === 'audio' || Boolean(file.audioUrl) || isWhatsAppAudio(file.name, file.type) || EXTENSION_MAP.audio.includes(ext) || /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(file.name);
    const isImg = file.category === 'images' || Boolean(file.isImage) || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name);

    if (isNotepad) return renderNoteWriterPage(file);
    if (isVid) return renderVideoPlayer(file);
    if (isAud) return renderAudioPlayer(file);
    if (isImg) return renderImageViewer(file);
    return renderDocumentReader(file);
  };

  const renderCollectionReader = (file: FileItem) => {
    return renderClasseurFileReader(file);
  };

  const renderCollectionEmptyState = (title: string) => (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#04060A] border-t md:border-t-0 md:border-l border-white/10 select-none">
      <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-white/10 text-slate-400 flex items-center justify-center mb-4 shadow-sm">
        <FolderArchive className="w-10 h-10 stroke-[1.8]" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-200">
        Aucun élément sélectionné dans {' ' + title}
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Sélectionnez un élément dans la liste de gauche pour l'afficher.
      </p>
    </div>
  );

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleGlobalDrop}
      className={`animate-in fade-in duration-150 bg-[#F4F6F8] dark:bg-[#0C111D] text-stone-900 dark:text-slate-100 flex flex-col overflow-y-auto selection:bg-blue-600 selection:text-white ${
      isFullscreen
        ? 'fixed inset-0 z-[1000] w-screen h-screen'
        : 'fixed top-[64px] md:top-[68px] bottom-0 left-0 md:left-64 right-0 z-30 min-h-[calc(100vh-68px)]'
    }`}>
      {/* Toast Notification universel en haut au milieu */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-stone-900/95 dark:bg-black/95 text-white border border-white/20 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none whitespace-nowrap">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Input DÉDIÉ pour l'Accueil : Routage automatique intelligent */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleHomeFileSelected}
        multiple
        className="hidden"
      />

      {/* 2. Input DÉDIÉ pour le menu VIDÉOS (accept="video/*" strictly calls video files only on Android/iOS/Windows) */}
      <input
        type="file"
        ref={videoFileInputRef}
        accept="video/*"
        onChange={handleVideoMenuFileSelected}
        multiple
        className="hidden"
      />

      {/* 3. Input DÉDIÉ pour le menu AUDIO / MUSIQUE (inclut tous les audios et vocaux WhatsApp .opus, .ogg, .m4a, .3gp...) */}
      <input
        type="file"
        ref={audioFileInputRef}
        accept="audio/*,audio/ogg,audio/opus,audio/mp4,audio/mpeg,audio/aac,audio/wav,audio/3gpp,audio/amr,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.wma,.amr,.weba,.3ga,.3gp"
        onChange={handleAudioMenuFileSelected}
        multiple
        className="hidden"
      />

      {/* 4. Input DÉDIÉ pour le menu IMAGES (accept="image/*" strictly calls pictures/gallery only) */}
      <input
        type="file"
        ref={imageFileInputRef}
        accept="image/*"
        onChange={handleImageMenuFileSelected}
        multiple
        className="hidden"
      />

      {/* 5. Input DÉDIÉ pour le menu DOCUMENTS */}
      <input
        type="file"
        ref={documentFileInputRef}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods,.odp,.rtf,.epub,.md,application/pdf,text/*"
        onChange={handleDocumentMenuFileSelected}
        multiple
        className="hidden"
      />

      {/* 6. Input DÉDIÉ pour les dossiers du CLASSEUR */}
      <input
        type="file"
        ref={classeurFolderFileInputRef}
        accept="*/*"
        onChange={handleClasseurFolderFileSelected}
        multiple
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* MENUS 100% INDÉPENDANTS AVEC LEUR PROPRE CODE ET FICHIER DÉDIÉ            */}
      {/* ========================================================================= */}
      {activeDedicatedMenu === 'audio' ? (
        <AudioMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          onOpenCreateShareLink={onOpenCreateShareLink}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'documents' ? (
        <DocumentsMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          onOpenCreateShareLink={onOpenCreateShareLink}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'videos' ? (
        <VideosMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          onOpenCreateShareLink={onOpenCreateShareLink}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'images' ? (
        <ImagesMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          onOpenCreateShareLink={onOpenCreateShareLink}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'trash' ? (
        <TrashMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'favorites' ? (
        <FavoritesMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          onOpenCreateShareLink={onOpenCreateShareLink}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'apps' ? (
        <AppsMenuView
          onBack={() => setActiveDedicatedMenu(null)}
        />
      ) : activeDedicatedMenu === 'cloud-storage' ? (
        <CloudSpaceMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onNavigateToCategory={(cat) => {
            if (cat === 'classeur') {
              setActiveDedicatedMenu(null);
              handleOpenSubMenu('classeur', 'classeur', 'Classeur', FolderArchive, 'text-orange-400');
            } else {
              setActiveDedicatedMenu(cat);
            }
          }}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'downloads' ? (
        <DownloadsMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : activeDedicatedMenu === 'secure-folder' ? (
        <SecureFolderMenuView
          onBack={() => setActiveDedicatedMenu(null)}
          onOpenStudySpace={onOpenStudySpace}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : currentSubView ? (
        <div className="flex-1 flex flex-col w-full animate-in fade-in duration-200 min-h-screen">
          
          {/* EN-TÊTE DU SOUS-MENU */}
          <div className={`sticky top-0 z-30 w-full bg-[#04060A] backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/30 shadow-xs ${
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
                      setSelectedClasseurFile(null);
                      setIsViewerMaximized(false);
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
                              setSelectedClasseurFile(null);
                              setIsViewerMaximized(false);
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

                  {/* Bouton 3 traits d'en-tête derrière le bouton zoom */}
                  <div className="relative studycloud-menu-trigger">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHeaderMenuOpen(!isHeaderMenuOpen);
                      }}
                      className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full ${
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
            ) : (
              <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
                
                {/* GAUCHE : Bouton Retour et Titre */}
                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSubView(null);
                      setOpened3DFolder(null);
                      setSelectedClasseurFile(null);
                      setIsViewerMaximized(false);
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
                  {(currentSubView?.id === 'studycloud-classeur-classeur' || (isCloudView && cloudActiveTab === 'classeur') || currentSubView?.type === 'classeur') && (
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

                  {/* 1. BOUTON DÉDIÉ : MENU VIDÉOS */}
                  {(currentSubView?.id === 'studycloud-category-videos' || (isCloudView && cloudActiveTab === 'videos')) && (
                    <button
                      type="button"
                      id="btn-import-menu-videos"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-purple-500/40 hover:border-purple-400 text-purple-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black animate-in fade-in duration-150"
                      title="Importer une vidéo dans le menu Vidéos"
                    >
                      <Plus className="w-4 h-4 text-purple-400 stroke-[2.5]" />
                      <span className="hidden xs:inline">Importer une vidéo</span>
                      <span className="xs:hidden">Importer</span>
                    </button>
                  )}

                  {/* 2. BOUTON DÉDIÉ : MENU AUDIO / MUSIQUE */}
                  {(currentSubView?.id === 'studycloud-category-audio' || (isCloudView && cloudActiveTab === 'audio')) && (
                    <button
                      type="button"
                      id="btn-import-menu-audio"
                      onClick={() => audioFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-amber-500/40 hover:border-amber-400 text-amber-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black animate-in fade-in duration-150"
                      title="Importer un fichier audio ou musique (WhatsApp inclus)"
                    >
                      <Plus className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                      <span className="hidden xs:inline">Importer un audio</span>
                      <span className="xs:hidden">Importer</span>
                    </button>
                  )}

                  {/* 3. BOUTON DÉDIÉ : MENU IMAGES */}
                  {(currentSubView?.id === 'studycloud-category-images' || (isCloudView && cloudActiveTab === 'images')) && (
                    <button
                      type="button"
                      id="btn-import-menu-images"
                      onClick={() => imageFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-emerald-500/40 hover:border-emerald-400 text-emerald-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black animate-in fade-in duration-150"
                      title="Importer une image dans Images"
                    >
                      <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                      <span className="hidden xs:inline">Importer une image</span>
                      <span className="xs:hidden">Importer</span>
                    </button>
                  )}

                  {/* 4. BOUTON DÉDIÉ : MENU DOCUMENTS */}
                  {(currentSubView?.id === 'studycloud-category-documents' || (isCloudView && cloudActiveTab === 'documents')) && (
                    <button
                      type="button"
                      id="btn-import-menu-documents"
                      onClick={() => documentFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-blue-500/40 hover:border-blue-400 text-blue-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black animate-in fade-in duration-150"
                      title="Importer un document dans Documents"
                    >
                      <Plus className="w-4 h-4 text-blue-400 stroke-[2.5]" />
                      <span className="hidden xs:inline">Importer un document</span>
                      <span className="xs:hidden">Importer</span>
                    </button>
                  )}

                  {/* 5. BOUTON DÉDIÉ : DOSSIER DU CLASSEUR */}
                  {opened3DFolder && (currentSubView?.type === 'classeur' || currentSubView?.id === 'studycloud-classeur-classeur' || (isCloudView && cloudActiveTab === 'classeur')) && (
                    <button
                      type="button"
                      id="btn-import-menu-classeur"
                      onClick={() => classeurFolderFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-orange-500/40 hover:border-orange-400 text-orange-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black animate-in fade-in duration-150"
                      title={`Importer un fichier dans ${opened3DFolder?.name || 'le dossier'}`}
                    >
                      <Plus className="w-4 h-4 text-orange-400 stroke-[2.5]" />
                      <span className="hidden xs:inline">Importer un fichier</span>
                      <span className="xs:hidden">Importer</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
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
                      setSelectedDocFile(null);
                      setSelectedVideoFile(null);
                      setSelectedImageFile(null);
                      setSelectedAudioTrack(null);
                      setSelectedDownloadFile(null);
                      setSelectedClasseurFile(null);
                      setSelectedCollectionFile(null);
                      setIsViewerMaximized(false);
                      setIsMobilePlayerOpen(false);
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
                          setSelectedDocFile(null);
                          setSelectedVideoFile(null);
                          setSelectedImageFile(null);
                          setSelectedAudioTrack(null);
                          setSelectedDownloadFile(null);
                          setSelectedClasseurFile(null);
                          setSelectedCollectionFile(null);
                          setSplitSelectedFile(null);
                          setIsViewerMaximized(false);
                          setIsMobilePlayerOpen(false);

                          if (item.id === 'secure-folder') {
                            if (isSecureFolderUnlocked) {
                              setCloudActiveTab(item.id);
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
          {/* ZONE PRINCIPALE : LECTEURS ET VUES STRICTEMENT INDÉPENDANTS PAR MENU      */}
          {/* ========================================================================= */}

          {/* 1. MENU DOCUMENTS : LAYOUT ET LECTEUR DOCUMENT DÉDIÉ (IMAGE 1) */}
          {(currentSubView?.id === 'studycloud-category-documents' || (isCloudView && cloudActiveTab === 'documents')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              {/* PANNEAU DE GAUCHE : LISTE DES DOCUMENTS */}
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedDocFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="space-y-3 sm:space-y-4">
                  {/* Compteur */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} publié{filteredDocuments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredDocuments)}

                  {loadingCategories.documents ? (
                    renderCategoryProgressiveSkeleton('Documents', 'grid', 'text-blue-400')
                  ) : filteredDocuments.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      {sortOption === 'duplicates' ? (
                        <>
                          <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                          <p className="text-sm font-semibold text-rose-400">Aucun résultat pour les doublons</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Tous vos documents sont uniques dans la base de données. Aucun doublon détecté.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSortOption('recent')}
                            className="mt-3 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Afficher tous les documents
                          </button>
                        </>
                      ) : (
                        <>
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-blue-400" />
                          <p className="text-sm font-semibold">Aucun document disponible</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Ce dossier ne contient aucun document pour le moment.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={`grid gap-2.5 sm:gap-3.5 ${
                      selectedDocFile ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredDocuments.map((doc, idx) => renderDocumentCard(doc, idx))}
                    </div>
                  )}
                </div>
              </div>

              {/* PANNEAU DE DROITE : LECTEUR DOCUMENT INDÉPENDANT (IMAGE 1) */}
              {selectedDocFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderDocumentReader(selectedDocFile)}
                </div>
              )}
            </div>
          )}

          {/* 2. MENU AUDIO : LAYOUT ET LECTEUR AUDIO DÉDIÉ (IMAGE 2 & IMAGE 3) */}
          {(currentSubView?.id === 'studycloud-category-audio' || (isCloudView && cloudActiveTab === 'audio')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              {/* PANNEAU DE GAUCHE : LISTE DES SONS */}
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                selectedAudioTrack
                  ? `${isMobilePlayerOpen ? 'hidden md:block' : 'w-full'} md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80`
                  : 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
              }`}>
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
                  {loadingCategories.audio ? (
                    renderCategoryProgressiveSkeleton('Audio', 'audio-list', 'text-amber-400')
                  ) : filteredAudio.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      {sortOption === 'duplicates' ? (
                        <>
                          <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                          <p className="text-sm font-semibold text-rose-400">Aucun résultat pour les doublons</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Tous vos fichiers audio sont uniques dans la base de données. Aucun doublon détecté.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSortOption('recent')}
                            className="mt-3 px-4 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Afficher tous les sons
                          </button>
                        </>
                      ) : (
                        <>
                          <Music className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-amber-400" />
                          <p className="text-sm font-semibold">Aucun son disponible</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Ce dossier ne contient aucun fichier audio pour le moment.
                          </p>
                        </>
                      )}
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
                                    toggleAudioPlayPause();
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
              </div>

              {/* PANNEAU DE DROITE : LECTEUR AUDIO INDÉPENDANT (IMAGE 2 & IMAGE 3) */}
              {selectedAudioTrack ? (
                <div className={`animate-in fade-in duration-150 ${
                  isMobilePlayerOpen ? 'flex w-full min-h-[calc(100vh-120px)]' : 'hidden md:flex'
                } md:w-7/12 lg:w-7/12 xl:w-7/12 flex-col bg-[#090D1A] border-t md:border-t-0 md:border-l border-white/10`}>
                  {renderAudioPlayer(selectedAudioTrack)}
                </div>
              ) : (
                <div className="hidden md:flex md:w-7/12 lg:w-7/12 xl:w-7/12 flex-col">
                  {renderAudioEmptyState()}
                </div>
              )}
            </div>
          )}

          {/* 3. MENU VIDÉOS : LAYOUT ET LECTEUR VIDÉO DÉDIÉ (IMAGE 4) */}
          {(currentSubView?.id === 'studycloud-category-videos' || (isCloudView && cloudActiveTab === 'videos')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              {/* PANNEAU DE GAUCHE : LISTE DES VIDÉOS */}
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedVideoFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredVideos)}

                  {loadingCategories.videos ? (
                    renderCategoryProgressiveSkeleton('Vidéos', 'grid', 'text-purple-400')
                  ) : filteredVideos.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      {sortOption === 'duplicates' ? (
                        <>
                          <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                          <p className="text-sm font-semibold text-rose-400">Aucun résultat pour les doublons</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Toutes vos vidéos sont uniques dans la base de données. Aucun doublon détecté.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSortOption('recent')}
                            className="mt-3 px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Afficher toutes les vidéos
                          </button>
                        </>
                      ) : (
                        <>
                          <Film className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-purple-400" />
                          <p className="text-sm font-semibold">Aucune vidéo disponible</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Ce dossier ne contient aucune vidéo pour le moment.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={`grid gap-2 sm:gap-3 ${
                      selectedVideoFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                    </div>
                  )}
                </div>
              </div>

              {/* PANNEAU DE DROITE : LECTEUR VIDÉO INDÉPENDANT (IMAGE 4) */}
              {selectedVideoFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderVideoPlayer(selectedVideoFile)}
                </div>
              )}
            </div>
          )}

          {/* 4. MENU IMAGES : LAYOUT ET LECTEUR IMAGE DÉDIÉ (IMAGE 5) */}
          {(currentSubView?.id === 'studycloud-category-images' || (isCloudView && cloudActiveTab === 'images')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              {/* PANNEAU DE GAUCHE : LISTE DES IMAGES */}
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedImageFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} disponible{filteredImages.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredImages)}

                  {loadingCategories.images ? (
                    renderCategoryProgressiveSkeleton('Images', 'grid', 'text-emerald-400')
                  ) : filteredImages.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                      {sortOption === 'duplicates' ? (
                        <>
                          <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                          <p className="text-sm font-semibold text-rose-400">Aucun résultat pour les doublons</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Toutes vos images sont uniques dans la base de données. Aucun doublon détecté.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSortOption('recent')}
                            className="mt-3 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Afficher toutes les images
                          </button>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-emerald-400" />
                          <p className="text-sm font-semibold">Aucune image disponible</p>
                          <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                            Ce dossier ne contient aucune image pour le moment.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={`grid gap-2 sm:gap-3 ${
                      selectedImageFile ? 'grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    }`}>
                      {filteredImages.map((img, idx) => renderImageCard(img, idx))}
                    </div>
                  )}
                </div>
              </div>

              {/* PANNEAU DE DROITE : LECTEUR IMAGE INDÉPENDANT (IMAGE 5) */}
              {selectedImageFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderImageViewer(selectedImageFile)}
                </div>
              )}
            </div>
          )}

          {/* 5. MENU TÉLÉCHARGEMENTS : LAYOUT ET LECTEUR INDÉPENDANT */}
          {(currentSubView?.id === 'studycloud-category-downloads' || (isCloudView && cloudActiveTab === 'downloads')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              {/* PANNEAU DE GAUCHE : LISTE DES TÉLÉCHARGEMENTS */}
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedDownloadFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bandeau d'action de sélection multiple si activé */}
                  {renderSelectionBanner(filteredDownloads.map(toFileItem))}

                  {loadingCategories.downloads ? (
                    renderCategoryProgressiveSkeleton('Téléchargements', 'grid', 'text-sky-400')
                  ) : filteredDownloads.length === 0 ? (
                    <div className="py-16 text-center text-stone-500 dark:text-slate-400">
                      {sortOption === 'duplicates' ? (
                        <>
                          <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                          <p className="text-sm font-semibold text-rose-400">Aucun résultat pour les doublons</p>
                          <p className="text-xs opacity-70 mt-1">Tous vos fichiers téléchargés sont uniques. Aucun doublon détecté.</p>
                          <button
                            type="button"
                            onClick={() => setSortOption('recent')}
                            className="mt-3 px-4 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Afficher tous les téléchargements
                          </button>
                        </>
                      ) : (
                        <>
                          <Download className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5]" />
                          <p className="text-sm font-semibold">Aucun fichier téléchargé</p>
                          <p className="text-xs opacity-70 mt-1">Les fichiers téléchargés s'afficheront ici avec leur vue dédiée.</p>
                        </>
                      )}
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
              </div>

              {/* PANNEAU DE DROITE : LECTEUR INDÉPENDANT */}
              {selectedDownloadFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderDownloadReader(selectedDownloadFile)}
                </div>
              )}
            </div>
          )}

          {/* 6. CLASSEUR : DOSSIERS 3D ET FICHIERS DU DOSSIER OUVERT */}
          {(currentSubView?.id === 'studycloud-classeur-classeur' || currentSubView?.id?.startsWith('studycloud-classeur-') || (isCloudView && cloudActiveTab === 'classeur')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              {/* PANNEAU DE GAUCHE : ARBORESCENCE & FICHIERS */}
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : opened3DFolder && selectedClasseurFile 
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80' 
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="w-full">
                  {opened3DFolder ? (
                    renderOpened3DFolderView(opened3DFolder)
                  ) : loadingCategories.classeur ? (
                    renderCategoryProgressiveSkeleton('Classeur', 'classeur-grid', 'text-orange-400')
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
                                data-classeur-folder-id={folder.id}
                                onPointerDown={(e) => handleFolderPointerDown(e, folder)}
                                onClick={(e) => {
                                  if (justDraggedFolderRef.current) return;
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
                                        : `bg-[#0E1526]/85 hover:bg-[#141E34] border-white/10 hover:border-orange-400/50 shadow-lg hover:shadow-2xl hover:-translate-y-1 ${classeur3DFolders.filter(f => !f.parentId).length > 1 ? 'cursor-pointer active:cursor-grab' : 'cursor-pointer'}`
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
              </div>

              {/* PANNEAU DE DROITE : LECTEUR LORSQU'UN FICHIER DU DOSSIER EST OUVERT */}
              {opened3DFolder && selectedClasseurFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderClasseurFileReader(selectedClasseurFile)}
                </div>
              )}
            </div>
          )}

          {/* 7. APPLICATIONS */}
          {(currentSubView?.id === 'studycloud-category-apps' || (isCloudView && cloudActiveTab === 'apps')) && (
            <div className="flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-10 text-center py-24 animate-in fade-in duration-200">
              <div className="max-w-lg mx-auto space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                  Ce menu n'est pas disponible pour le moment
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed font-normal">
                  L'accès aux applications et aux outils intégrés est temporairement suspendu pour des travaux d'optimisation et de maintenance technique.
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  Ce service sera prochainement réactivé. Nous vous remercions pour votre compréhension.
                </p>
              </div>
            </div>
          )}

          {/* 8. DOSSIER SÉCURISÉ */}
          {(currentSubView?.id === 'studycloud-collection-secure-folder' || (isCloudView && cloudActiveTab === 'secure-folder')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedCollectionFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
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

                      {loadingCategories.secure ? (
                        renderCategoryProgressiveSkeleton('Dossier sécurisé', 'grid', 'text-amber-400')
                      ) : filteredSecureFiles.length === 0 ? (
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
                            if (file.category === 'audio') return renderAudioSquareCard(file, idx, filteredSecureFiles);
                            return renderDocumentCard(file, idx, filteredSecureFiles);
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {selectedCollectionFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderCollectionReader(selectedCollectionFile)}
                </div>
              )}
            </div>
          )}

          {/* 9. FAVORIS */}
          {(currentSubView?.id === 'studycloud-collection-favorites' || (isCloudView && cloudActiveTab === 'favorites')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedCollectionFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="space-y-4 animate-in fade-in duration-200">
                  {loadingCategories.favorites ? (
                    renderCategoryProgressiveSkeleton('Favoris', 'grid', 'text-amber-400')
                  ) : favoriteFiles.length === 0 ? (
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
                                    handleOpenSubMenu('collection', 'cloud-storage', 'Espace Cloud', Cloud, 'text-sky-400');
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
                          if (file.category === 'audio') return renderAudioSquareCard(file, idx, favoriteFiles);
                          return renderDocumentCard(file, idx, favoriteFiles);
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {selectedCollectionFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderCollectionReader(selectedCollectionFile)}
                </div>
              )}
            </div>
          )}

          {/* 10. CORBEILLE */}
          {(currentSubView?.id === 'studycloud-collection-trash' || (isCloudView && cloudActiveTab === 'trash')) && (
            <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
              <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
                isViewerMaximized 
                  ? 'hidden' 
                  : selectedCollectionFile
                    ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
                    : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
              }`}>
                <div className="space-y-4 animate-in fade-in duration-200">
                  {loadingCategories.trash ? (
                    renderCategoryProgressiveSkeleton('Corbeille', 'grid', 'text-rose-400')
                  ) : filteredTrashFiles.length === 0 ? (
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
              </div>
              {selectedCollectionFile && (
                <div className={`animate-in fade-in duration-150 flex flex-col bg-[#04060A] ${
                  isViewerMaximized 
                    ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]' 
                    : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
                }`}>
                  {renderCollectionReader(selectedCollectionFile)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VUE PRINCIPALE DIRECTE : GESTIONNAIRE STUDYCLOUD SANS LES DEUX BOUTONS    */
        /* ========================================================================= */
        <>
          {/* EN-TÊTE FIXE / STICKY : Barre de recherche pilule AU MILIEU */}
          <div className="sticky top-0 z-30 w-full bg-white backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 pt-2.5 pb-2.5 border-b border-stone-200 shadow-xs">
            <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
              
              {/* GAUCHE : Bouton Retour rapide vers l'accueil (ferme aussi la recherche en cours) */}
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery.trim()) {
                      setSearchQuery('');
                      setShowRecentSearchesMenu(false);
                    } else {
                      onBack();
                    }
                  }}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  title={searchQuery.trim() ? "Mettre fin à la recherche et revenir à l'accueil" : "Retour au Tableau de bord"}
                  aria-label="Retour"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </button>
              </div>

              {/* MILIEU : Barre de Recherche Pilule AU CENTRE */}
              <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto relative flex items-center px-1 sm:px-2">
                <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 transition-all shadow-inner gap-2">
                  
                  {/* Bouton trois traits collé avec menu des recherches récentes (5 max) */}
                  <div className="relative shrink-0" ref={recentSearchesMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowRecentSearchesMenu(prev => !prev)}
                      className={`p-1 rounded-full text-white hover:text-blue-400 hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center ${showRecentSearchesMenu ? 'text-blue-400 bg-white/15' : ''}`}
                      title="Recherches récentes (5 max)"
                      aria-label="Recherches récentes"
                    >
                      <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                    </button>

                    {/* Petit menu déroulant à côté qui liste les 5 anciennes recherches */}
                    {showRecentSearchesMenu && (
                      <div 
                        className="absolute left-0 top-full mt-2.5 w-64 sm:w-72 bg-[#0A0F1D]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            Recherches récentes
                          </span>
                          {recentSearches.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRecentSearches([]);
                                try { localStorage.removeItem('studycloud_recent_searches'); } catch {}
                              }}
                              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Effacer l'historique"
                            >
                              Effacer
                            </button>
                          )}
                        </div>

                        {recentSearches.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center italic">
                            Aucune recherche récente enregistrée
                          </div>
                        ) : (
                          <div className="py-1">
                            {recentSearches.map((term, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setSearchQuery(term);
                                  setShowRecentSearchesMenu(false);
                                  saveRecentSearch(term);
                                }}
                                className="w-full px-3.5 py-2 text-left hover:bg-white/10 flex items-center justify-between gap-2 text-xs font-semibold text-white transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 shrink-0" />
                                  <span className="truncate group-hover:text-blue-300">{term}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {index + 1}/5
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        saveRecentSearch(searchQuery);
                        setShowRecentSearchesMenu(false);
                      }
                    }}
                    onBlur={() => {
                      if (searchQuery.trim().length >= 2) {
                        saveRecentSearch(searchQuery);
                      }
                    }}
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

          {/* CORPS PRINCIPAL DIRECT : RECHERCHE GLOBALE OU MENUS STUDYCLOUD */}
          <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 pb-48 sm:pb-64 space-y-4 sm:space-y-5">
            {searchQuery.trim() !== '' ? (
              /* ========================================================================= */
              /* VUE RÉSULTATS DE RECHERCHE GLOBALE : REMPLACE LES MENUS                   */
              /* ========================================================================= */
              <section className="space-y-4 animate-in fade-in duration-200">
                {/* En-tête des résultats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-[#04060A] border border-white/10 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                      <Search className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                        <span>Résultats pour &ldquo;{searchQuery}&rdquo;</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-extrabold border border-blue-500/30">
                          {globalSearchResults.length} {globalSearchResults.length > 1 ? 'éléments' : 'élément'}
                        </span>
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Recherche transversale dans tous vos menus et dossiers
                      </p>
                    </div>
                  </div>

                  {/* Bouton pour clore la recherche et réafficher les boutons de menu */}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setShowRecentSearchesMenu(false);
                    }}
                    className="self-start sm:self-center flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10 hover:border-white/20 active:scale-95 cursor-pointer shrink-0"
                    title="Mettre fin à la recherche et réafficher les boutons de chaque menu"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                    <span>Réafficher tous les menus</span>
                  </button>
                </div>

                {/* Filtres par catégorie */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: `Tous (${allGlobalSearchableFiles.filter(f => {
                      const q = searchQuery.trim().toLowerCase();
                      return (f.name || '').toLowerCase().includes(q) || (f.source || '').toLowerCase().includes(q) || (f.menuOrigin || '').toLowerCase().includes(q);
                    }).length})` },
                    { id: 'documents', label: 'Documents' },
                    { id: 'images', label: 'Images' },
                    { id: 'videos', label: 'Vidéos' },
                    { id: 'audio', label: 'Audio' },
                    { id: 'classeur', label: 'Classeur' },
                    { id: 'downloads', label: 'Téléchargements' },
                  ].map(tab => {
                    const isActive = searchCategoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSearchCategoryFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isActive 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400/40' 
                            : 'bg-[#04060A] text-slate-300 hover:text-white hover:bg-[#0A0E18] border border-white/10'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Grille des résultats ou message vide */}
                {globalSearchResults.length === 0 ? (
                  <div className="w-full py-16 flex flex-col items-center justify-center text-center p-6 bg-[#04060A] border border-white/10 rounded-3xl">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
                      <Search className="w-6 h-6 stroke-[2]" />
                    </div>
                    <h3 className="text-base font-black text-white mb-1">
                      Aucun résultat pour &ldquo;{searchQuery}&rdquo;
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                      Aucun élément ne correspond à votre saisie dans l'ensemble des menus. Vous pouvez essayer un autre mot ou réafficher vos menus.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      Effacer la recherche et revenir aux menus
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
                    {globalSearchResults.map((file, idx) => {
                      const normCat = (file.category || detectFileCategory(file)).toLowerCase();
                      const normName = (file.name || '').toLowerCase();
                      const ext = normName.includes('.') ? normName.split('.').pop() || '' : '';

                      const isImg = normCat === 'images' || file.isImage || (file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext);
                      const isVid = normCat === 'videos' || file.isVideo || Boolean(file.videoUrl) || (file.type && file.type.startsWith('video/')) || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);
                      const isAud = normCat === 'audio' || file.isAudio || Boolean(file.audioUrl) || (file.type && file.type.startsWith('audio/')) || isWhatsAppAudio(file.name, file.type) || EXTENSION_MAP.audio.includes(ext) || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 'amr', 'weba', 'aiff', 'alac', 'mid', 'midi', 'caf', '3ga'].includes(ext);

                      return (
                        <div
                          key={file.id}
                          className="relative"
                          onClickCapture={(e) => {
                            const target = e.target as HTMLElement | null;
                            const isMenuOrAction = target?.closest('.studycloud-menu-trigger') || 
                                                   target?.closest('.studycloud-file-menu-panel') ||
                                                   target?.closest('button[title*="traits"]') || 
                                                   target?.closest('button[title*="Options"]') || 
                                                   target?.closest('button[title*="Cocher"]') || 
                                                   target?.closest('button[title*="Décocher"]');
                            if (isMenuOrAction) {
                              return;
                            }
                            e.stopPropagation();
                            handleSearchResultClick(file);
                          }}
                        >
                          {isImg ? (
                            renderImageCard(file, idx)
                          ) : isVid ? (
                            renderVideoCard(file, idx)
                          ) : isAud ? (
                            renderAudioSquareCard(file, idx, globalSearchResults)
                          ) : (
                            renderDocumentCard(file, idx, globalSearchResults)
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              <>
                {/* SECTION 1 : RÉCENTS (STRICTEMENT 6 ÉLÉMENTS SUR 1 LIGNE) */}
            {loadingCategories.overview ? (
              <section className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Récents</span>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3.5">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-36 rounded-2xl bg-[#151C2C]/70 border border-slate-800/80 p-2 flex flex-col justify-between animate-pulse">
                      <div className="w-full h-20 rounded-xl bg-white/5" />
                      <div className="space-y-1.5 pt-1">
                        <div className="h-2.5 w-3/4 rounded-full bg-white/10" />
                        <div className="h-2 w-1/2 rounded-full bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : displayedFiles.length > 0 && (
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
                          handleRecentFileClick(file);
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
                                title="Retirer cet aperçu des récents (le fichier reste conservé dans son menu)"
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
                <div className="text-left">
                  <span className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide drop-shadow-sm block leading-tight">
                    Classeur
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-orange-200 block leading-tight">
                    {classeurTotalBytes > 0 
                      ? formatCategoryDisplaySize(classeurTotalBytes, classeurFiles.length, 'fichier') 
                      : (classeur3DFolders.length > 0 ? `${classeur3DFolders.length} dossier${classeur3DFolders.length > 1 ? 's' : ''}` : '0 Mo')}
                  </span>
                </div>
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
                      onClick={() => {
                        if (['audio', 'documents', 'videos', 'images', 'downloads', 'apps'].includes(cat.id)) {
                          setActiveDedicatedMenu(cat.id as any);
                        } else {
                          handleOpenSubMenu('category', cat.id, cat.name, cat.icon, cat.color);
                        }
                      }}
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
                        if (col.id === 'favorites') {
                          setActiveDedicatedMenu('favorites');
                        } else if (col.id === 'trash') {
                          setActiveDedicatedMenu('trash');
                        } else if (col.id === 'cloud-storage') {
                          setActiveDedicatedMenu('cloud-storage');
                        } else if (col.id === 'secure-folder') {
                          setActiveDedicatedMenu('secure-folder');
                        } else if (col.id === 'apps') {
                          setActiveDedicatedMenu('apps');
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
                        {col.subtitle && (
                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate mt-0.5">
                            {col.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

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
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999999] pointer-events-auto max-w-lg w-[92%] sm:w-auto px-4 py-3 rounded-xl bg-[#0f172a]/95 backdrop-blur-xl border text-white shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
          profileToastType === 'error'
            ? 'border-red-500/80 shadow-red-950/50'
            : profileToastType === 'warning'
            ? 'border-amber-500/80 shadow-amber-950/50'
            : 'border-emerald-500/60 shadow-emerald-950/50'
        }`}>
          <div className="flex items-center gap-2.5">
            {profileToastType === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 stroke-[2.2]" />
            ) : profileToastType === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 stroke-[2.2]" />
            ) : (
              <Check className="w-5 h-5 text-emerald-400 shrink-0 stroke-[2.5]" />
            )}
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

      {/* GRAND MODAL D'ALERTE AU MILIEU DE L'ÉCRAN : FICHIER NON COMPATIBLE AVEC CE MENU */}
      {incompatibleAlertInfo && createPortal(
        <div 
          className="fixed inset-0 z-[99999999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 pointer-events-auto"
          onClick={() => setIncompatibleAlertInfo(null)}
        >
          <div 
            className="relative w-full max-w-md bg-[#0A0E1A] border-2 border-red-500/70 rounded-3xl p-6 sm:p-7 shadow-[0_25px_80px_rgba(239,68,68,0.45),0_0_0_1px_rgba(255,255,255,0.1)] text-white text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton croix en haut à droite */}
            <button
              type="button"
              onClick={() => setIncompatibleAlertInfo(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Grande Icône d'alerte rouge lumineuse */}
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.5)] mt-1 animate-pulse">
              <AlertCircle className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.6]" />
            </div>

            {/* Titre */}
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Téléchargement impossible
              </h3>
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest">
                Format non compatible avec ce menu
              </p>
            </div>

            {/* Message Principal textuel explicite demandé par l'utilisateur */}
            <div className="w-full p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-xs sm:text-sm font-extrabold text-red-200 leading-snug">
              Ce fichier n'a pas pu être téléchargé car il n'est pas compatible avec ce menu !
            </div>

            {/* Détails du fichier et du menu */}
            <div className="w-full text-xs text-slate-300 font-medium bg-black/50 rounded-2xl p-3.5 border border-white/10 space-y-2 text-left">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-400 shrink-0">Fichier :</span>
                <span className="font-bold text-white truncate max-w-[220px]" title={incompatibleAlertInfo.fileName}>
                  {incompatibleAlertInfo.fileName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Type détecté :</span>
                <span className="font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-400/30">
                  {incompatibleAlertInfo.detectedCategory}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Menu dédié :</span>
                <span className="font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-md border border-purple-400/30">
                  {incompatibleAlertInfo.menuLabel}
                </span>
              </div>
            </div>

            {/* Explication et astuce */}
            <p className="text-[11px] text-slate-400 leading-relaxed text-center px-1">
              Le menu <strong className="text-white">{incompatibleAlertInfo.menuLabel}</strong> n'accepte que des fichiers {incompatibleAlertInfo.menuLabel.toLowerCase()}. Pour classer automatiquement vos fichiers sans restriction, utilisez le bouton <strong className="text-blue-400">+ Importer</strong> sur la page d'accueil.
            </p>

            {/* Bouton de confirmation en bas */}
            <button
              type="button"
              onClick={() => setIncompatibleAlertInfo(null)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs sm:text-sm tracking-wider shadow-lg shadow-red-950/70 transition-all active:scale-95 cursor-pointer uppercase mt-1"
            >
              Compris, fermer
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* GRAND MODAL AU MILIEU DE L'ÉCRAN : FICHIER DÉJÀ EXISTANT DANS LE RÉPERTOIRE (DOUBLON) */}
      {duplicateImportModal && createPortal(
        <div 
          className="fixed inset-0 z-[99999999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 pointer-events-auto"
          onClick={duplicateImportModal.onCancel}
        >
          <div 
            className="relative w-full max-w-md bg-[#0A0E1A] border-2 border-amber-500/70 rounded-3xl p-6 sm:p-7 shadow-[0_25px_80px_rgba(245,158,11,0.45),0_0_0_1px_rgba(255,255,255,0.1)] text-white text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton croix en haut à droite */}
            <button
              type="button"
              onClick={duplicateImportModal.onCancel}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Grande Icône d'alerte ambre lumineuse */}
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center text-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.5)] mt-1 animate-pulse">
              <AlertTriangle className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.4]" />
            </div>

            {/* Titre */}
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Fichier déjà existant
              </h3>
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                Détection dans votre compte personnel
              </p>
            </div>

            {/* Message Principal textuel explicite demandé par l'utilisateur */}
            <div className="w-full p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-xs sm:text-sm font-extrabold text-amber-200 leading-snug">
              {duplicateImportModal.duplicateFileNames.length === 1
                ? `Ce fichier existe déjà dans votre répertoire ${duplicateImportModal.menuLabel}.`
                : `${duplicateImportModal.duplicateFileNames.length} fichiers existent déjà dans votre répertoire ${duplicateImportModal.menuLabel}.`}
            </div>

            {/* Détails du ou des fichiers doublons */}
            <div className="w-full text-xs text-slate-300 font-medium bg-black/50 rounded-2xl p-3.5 border border-white/10 space-y-2 text-left max-h-36 overflow-y-auto custom-scrollbar">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">
                Fichier(s) concerné(s) :
              </div>
              <ul className="space-y-1.5">
                {duplicateImportModal.duplicateFileNames.map((name, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white font-medium truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate" title={name}>{name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Explication rassurante */}
            <p className="text-[11px] text-slate-400 leading-relaxed text-center px-1">
              Chaque fichier reste strictement indépendant. Si vous choisissez <strong className="text-white">"Importer quand même"</strong>, une nouvelle copie sera enregistrée avec son propre identifiant unique.
            </p>

            {/* Deux boutons d'action demandés : "Importer quand même" ou "Annuler" */}
            <div className="w-full flex flex-col sm:flex-row gap-2.5 mt-1">
              <button
                type="button"
                onClick={duplicateImportModal.onCancel}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer order-2 sm:order-1"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={duplicateImportModal.onConfirm}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-950/60 transition-all active:scale-95 cursor-pointer order-1 sm:order-2"
              >
                Importer quand même
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
