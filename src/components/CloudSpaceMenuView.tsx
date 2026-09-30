import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Cloud,
  FolderArchive,
  Folder,
  Download,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  LayoutGrid,
  Star,
  Lock,
  Unlock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbChevron,
  Menu,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  FileCode,
  Clock,
  BookOpen,
  Pencil,
  Layers,
  CheckCircle2,
  Pin,
  Share2,
  Info,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { CloudDataStore, FileItem } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { ClasseurCreatedFolder, Classeur3DFolderCard, TxtDocumentSVG } from './Folder3DModels';
import { DocumentCardPreview } from './DocumentCardPreview';
import { ImageCardPreview } from './ImageCardPreview';
import { VideoCardPreview } from './VideoCardPreview';
import { AudioCardPreview } from './AudioCardPreview';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { ModernImageViewer } from './ModernImageViewer';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { ModernAudioPlayer } from './ModernAudioPlayer';

interface CloudSpaceMenuViewProps {
  onBack: () => void;
  onOpenPricing?: (tab?: 'storage' | 'ai' | 'renewal') => void;
  onNavigateToCategory?: (category: 'audio' | 'documents' | 'videos' | 'images' | 'trash' | 'classeur') => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export type CloudTabId =
  | 'classeur'
  | 'downloads'
  | 'images'
  | 'videos'
  | 'audio'
  | 'documents'
  | 'apps'
  | 'favorites'
  | 'secure-folder'
  | 'trash';



// Thème de couleur officiel par extension (PDF rouge, Word bleu, Excel vert, PPT orange, etc.)
export const getDocumentTheme = (ext: string = 'PDF') => {
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
  } else if (['XLS', 'XLSX', 'CSV'].includes(upper)) {
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
    typeBadge: upper || 'DOC'
  };
};

export const CloudSpaceMenuView: React.FC<CloudSpaceMenuViewProps> = ({
  onBack,
  onOpenPricing,
  onNavigateToCategory,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  // Onglet actif : 'classeur' par défaut
  const [activeTab, setActiveTab] = useState<CloudTabId>('classeur');
  const [searchQuery, setSearchQuery] = useState('');

  // Navigation dans le classeur (dossier ouvert)
  const [openedClasseurFolderId, setOpenedClasseurFolderId] = useState<string | null>(null);

  // Données issues de CloudDataStore (miroir temps réel)
  const [storeData, setStoreData] = useState(() => CloudDataStore.getState());

  // Gestion du menu d'options 3 traits (fichiers et dossiers)
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  // Gestion du dossier sécurisé (code PIN et filtre de catégorie)
  const [isSecureFolderUnlocked, setIsSecureFolderUnlocked] = useState(false);
  const [securePinInput, setSecurePinInput] = useState('');
  const [securePinConfirmInput, setSecurePinConfirmInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasServerPin, setHasServerPin] = useState<boolean | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [securePinError, setSecurePinError] = useState<string | null>(null);
  const [secureCategoryFilter, setSecureCategoryFilter] = useState<'all' | 'documents' | 'images' | 'videos' | 'audio' | 'classeur'>('all');

  // Détection du code PIN : vérification locale ET distante auprès du Worker Cloudflare
  useEffect(() => {
    const localPin = localStorage.getItem('studycloud_secure_folder_pin');
    if (localPin) {
      setHasServerPin(true);
    }
    CloudStorageAPI.isSecureFolderConfigured()
      .then((configured) => {
        setHasServerPin(configured || Boolean(localStorage.getItem('studycloud_secure_folder_pin')));
      })
      .catch(() => {
        setHasServerPin(Boolean(localStorage.getItem('studycloud_secure_folder_pin')));
      });
  }, []);

  // Éditeur de notes intégré (Bloc-notes)
  const [noteTextContent, setNoteTextContent] = useState<string>('');
  const [noteTitleContent, setNoteTitleContent] = useState<string>('');
  const [isNoteSavedIndicator, setIsNoteSavedIndicator] = useState<boolean>(true);
  const noteSaveTimeoutRef = useRef<any>(null);

  // Visionneuses / Lecteurs intégrés (Panneau latéral droit)
  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [resolvedBlobUrl, setResolvedBlobUrl] = useState<string | null>(null);

  // Résoudre l'URL Blob locale dès qu'un fichier est sélectionné
  useEffect(() => {
    let isMounted = true;
    if (viewerFile?.id) {
      getFileBlobUrl(viewerFile.id)
        .then((url) => {
          if (isMounted) setResolvedBlobUrl(url);
        })
        .catch(() => {
          if (isMounted) setResolvedBlobUrl(null);
        });
    } else {
      setResolvedBlobUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [viewerFile?.id]);

  // Initialiser les champs d'écriture si le fichier sélectionné est une note
  useEffect(() => {
    if (viewerFile) {
      const isTxt = Boolean(
        viewerFile.isNotepad ||
        viewerFile.category === 'notes' ||
        viewerFile.extension?.toLowerCase() === 'txt' ||
        viewerFile.name.toLowerCase().endsWith('.txt') ||
        viewerFile.type === 'text/plain'
      );
      if (isTxt) {
        setNoteTextContent(viewerFile.content || '');
        setNoteTitleContent(viewerFile.noteTitle || viewerFile.name.replace(/\.txt$/i, ''));
        setIsNoteSavedIndicator(true);
      }
    }
  }, [viewerFile?.id]);

  // Sauvegarde automatique et fluide du contenu de la note
  const handleUpdateNoteContent = (newText: string, newTitle: string, fileId?: string) => {
    const targetId = fileId || viewerFile?.id;
    if (!targetId) return;

    const baseName = newTitle.trim() || 'Note sans titre';
    const finalName = baseName.toLowerCase().endsWith('.txt') ? baseName : `${baseName}.txt`;
    const byteSize = new Blob([newText]).size;
    const formattedSize = byteSize > 1024 ? `${(byteSize / 1024).toFixed(1)} Ko` : `${byteSize} o`;

    const updatedItem: Partial<FileItem> = {
      id: targetId,
      name: finalName,
      noteTitle: newTitle,
      content: newText,
      size: formattedSize,
      sizeBytes: byteSize,
      date: 'À l’instant'
    };

    CloudDataStore.updateFile(targetId, updatedItem as any, openedClasseurFolderId || undefined);

    if (viewerFile && viewerFile.id === targetId) {
      setViewerFile(prev => prev ? { ...prev, ...updatedItem } : null);
    }

    if (noteSaveTimeoutRef.current) clearTimeout(noteSaveTimeoutRef.current);
    noteSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const fullFile: FileItem = {
          ...(viewerFile || {}),
          ...updatedItem,
          id: targetId,
          name: finalName,
          category: 'notes',
          extension: 'txt',
          isNotepad: true
        } as FileItem;

        if (openedClasseurFolderId) {
          await CloudStorageAPI.saveClasseurFile(fullFile as any, openedClasseurFolderId).catch(() => {});
        } else {
          await CloudStorageAPI.saveClasseurFile(fullFile as any, 'default').catch(() => {});
        }
        setIsNoteSavedIndicator(true);
      } catch {
        setIsNoteSavedIndicator(true);
      }
    }, 600);
  };

  // Audio en lecture
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Modales diverses (renommer, détails)
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Référence pour le défilement horizontal du carrousel de catégories
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingTabsRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  // Synchronisation instantanée multi-menus et chargement frais du cloud
  useEffect(() => {
    const unsub = CloudDataStore.subscribe((state) => {
      setStoreData(state);
    });
    // Forcer la synchronisation avec le cloud pour refléter en direct l'état le plus frais
    CloudDataStore.sync(true).catch(() => {});
    return () => unsub();
  }, []);

  // Dès qu'un dossier du classeur change (ouverture, fermeture ou changement de dossier), fermer le lecteur et rafraîchir
  useEffect(() => {
    setViewerFile(null);
    setIsViewerMaximized(false);
    if (openedClasseurFolderId) {
      CloudStorageAPI.getClasseurFiles(openedClasseurFolderId).then((files) => {
        if (files) {
          CloudDataStore.setFolderFilesMap({
            ...CloudDataStore.getState().folderFilesMap,
            [openedClasseurFolderId]: files
          });
        }
      }).catch(() => {});
    }
  }, [openedClasseurFolderId]);

  // Fermer le lecteur dès qu'on change d'onglet dans l'espace cloud
  useEffect(() => {
    setViewerFile(null);
    setIsViewerMaximized(false);
  }, [activeTab]);

  // Fermer les menus 3 traits (fichiers ou dossiers) au clic en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.studycloud-file-menu-panel') && !target.closest('.studycloud-menu-trigger')) {
        setActiveMenuFileId(null);
        setActiveMenuFolderId(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Gestion du glisser / défiler du carrousel d'onglets
  const handleTabsMouseDown = (e: React.MouseEvent) => {
    if (!tabsScrollRef.current) return;
    isDraggingTabsRef.current = true;
    dragStartXRef.current = e.pageX - tabsScrollRef.current.offsetLeft;
    dragScrollLeftRef.current = tabsScrollRef.current.scrollLeft;
  };

  const handleTabsMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTabsRef.current || !tabsScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsScrollRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.5;
    tabsScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const handleTabsMouseUp = () => {
    isDraggingTabsRef.current = false;
  };

  // =========================================================================
  // ACTIONS DE FICHIER (TÉLÉCHARGEMENT, SUPPRESSION, FAVORIS, RENOMMER)
  // =========================================================================
  const handleDownloadFile = async (file: FileItem) => {
    showToast(`Téléchargement de "${file.name}" en cours...`);
    try {
      let downloadUrl = file.url || file.previewUrl || '';
      if (!downloadUrl && file.id) {
        const blobUrl = await getFileBlobUrl(file.id);
        if (blobUrl) downloadUrl = blobUrl;
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`"${file.name}" téléchargé avec succès`);
      } else {
        showToast(`Document "${file.name}" prêt pour consultation`);
      }
    } catch {
      showToast(`Erreur lors du téléchargement de "${file.name}"`);
    }
  };

  const handleToggleFavorite = (file: FileItem) => {
    const newFav = !file.isFavorite;
    CloudDataStore.toggleFavorite(file.id, newFav);
    CloudStorageAPI.toggleFavorite(file.id, newFav, file.category || 'documents').catch(() => {});
    showToast(newFav ? `"${file.name}" ajouté aux favoris` : `"${file.name}" retiré des favoris`);
  };

  const handleTogglePin = (file: FileItem) => {
    const newPin = !file.isPinned;
    CloudDataStore.togglePin(file.id, newPin);
    CloudStorageAPI.togglePin(file.id, newPin, file.category || 'documents').catch(() => {});
    showToast(newPin ? `"${file.name}" épinglé en tête` : `"${file.name}" désépinglé`);
  };

  const handleDeleteFile = (file: FileItem) => {
    CloudDataStore.moveToTrash(file);
    CloudStorageAPI.moveToTrash(file.id, file.category || 'documents', file.folderId).catch(() => {});
    showToast(`"${file.name}" déplacé vers la corbeille`);
    if (viewerFile?.id === file.id) setViewerFile(null);
  };

  const handleRestoreFromTrash = (file: FileItem) => {
    CloudDataStore.restoreFromTrash(file);
    CloudStorageAPI.restoreTrashItem(file.id).catch(() => {});
    window.dispatchEvent(new Event('unifolder_data_restored'));
    showToast(`"${file.name}" restauré avec succès`);
  };

  const handlePermanentDelete = (file: FileItem) => {
    CloudDataStore.removeFile(file.id);
    deleteFileBlob(file.id).catch(() => {});
    CloudStorageAPI.deleteTrashPermanently([file.id]).catch(() => {});
    showToast(`"${file.name}" supprimé définitivement`);
  };

  const handleRestoreFromSecure = async (file: FileItem) => {
    CloudDataStore.restoreFromSecure(file);
    try {
      await CloudStorageAPI.restoreFromSecureFolder(file.id);
    } catch (e) {}
    showToast(`"${file.name}" retiré du dossier sécurisé`);
  };

  const handleUnlockSecureFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingPin) return;

    const trimmed = securePinInput.trim();
    if (!trimmed) {
      setSecurePinError('Veuillez saisir votre code secret.');
      return;
    }

    const stored = localStorage.getItem('studycloud_secure_folder_pin');
    const isConfigured = hasServerPin ?? Boolean(stored);

    setIsSubmittingPin(true);

    // 1. Si déjà configuré ou si un code est fourni, tester d'abord la validation en ligne ou locale
    const isLocalOk = stored ? trimmed === stored.trim() : false;
    let isWorkerOk = false;
    try {
      isWorkerOk = await CloudStorageAPI.verifySecurePin(trimmed);
    } catch {}

    if (isLocalOk || isWorkerOk) {
      localStorage.setItem('studycloud_secure_folder_pin', trimmed);
      setHasServerPin(true);
      setIsSecureFolderUnlocked(true);
      setSecurePinInput('');
      setSecurePinConfirmInput('');
      setSecurePinError(null);
      setIsSubmittingPin(false);
      showToast('Dossier sécurisé déverrouillé ✅');
      return;
    }

    // 2. Si non configuré (premier enregistrement)
    if (!isConfigured) {
      if (trimmed.length < 4) {
        setSecurePinError('Le code secret doit comporter au moins 4 caractères.');
        setIsSubmittingPin(false);
        return;
      }
      if (trimmed !== securePinConfirmInput.trim()) {
        setSecurePinError('La confirmation ne correspond pas au code saisi.');
        setIsSubmittingPin(false);
        return;
      }
      try {
        localStorage.setItem('studycloud_secure_folder_pin', trimmed);
        await CloudStorageAPI.setSecurePin(trimmed).catch(() => {});
        setHasServerPin(true);
        setIsSecureFolderUnlocked(true);
        setSecurePinInput('');
        setSecurePinConfirmInput('');
        setSecurePinError(null);
        showToast('Code secret configuré avec succès ! Coffre-fort déverrouillé.');
      } catch (err: any) {
        setSecurePinError(err.message || 'Erreur lors de la configuration.');
      } finally {
        setIsSubmittingPin(false);
      }
      return;
    }

    // 3. Sinon le code est incorrect
    setIsSubmittingPin(false);
    setSecurePinError('Code incorrect. Veuillez réessayer.');
  };

  const handleShareFile = (file: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([file]);
      return;
    }
    const link = `${window.location.origin}${window.location.pathname}#file-${encodeURIComponent(file.id)}`;
    try {
      navigator.clipboard?.writeText(link);
      showToast('Lien de partage copié dans le presse-papiers !');
    } catch {
      showToast(`Lien créé pour "${file.name}"`);
    }
  };

  const handleConfirmRename = () => {
    if (!renamingFile || !renameInputValue.trim()) {
      setRenamingFile(null);
      return;
    }
    const trimmed = renameInputValue.trim();
    CloudDataStore.updateFile(renamingFile.id, { name: trimmed }, renamingFile.folderId);
    CloudStorageAPI.renameItem(renamingFile.id, trimmed, renamingFile.category || 'documents', renamingFile.folderId).catch(() => {});
    showToast(`Fichier renommé en "${trimmed}"`);
    setRenamingFile(null);
  };

  // =========================================================================
  // LISTES DE FICHIERS FILTRÉES SELON LA RECHERCHE ET L'ONGLET SÉLECTIONNÉ
  // =========================================================================
  const q = searchQuery.trim().toLowerCase();

  // Dossiers Classeur racine (sans parentId)
  const classeurRootFolders = useMemo(() => {
    return (storeData.classeurFolders || []).filter(f => !f.parentId);
  }, [storeData.classeurFolders]);

  // Sous-dossiers du dossier ouvert
  const classeurSubFolders = useMemo(() => {
    if (!openedClasseurFolderId) return [];
    return (storeData.classeurFolders || []).filter(f => f.parentId === openedClasseurFolderId);
  }, [storeData.classeurFolders, openedClasseurFolderId]);

  // Fichiers dans le dossier ouvert
  const classeurFolderFiles = useMemo(() => {
    if (!openedClasseurFolderId) return [];
    const files = (storeData.folderFilesMap || {})[openedClasseurFolderId] || [];
    return q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;
  }, [storeData.folderFilesMap, openedClasseurFolderId, q]);

  // Dossiers filtrés par recherche (vue racine)
  const filteredClasseurFolders = useMemo(() => {
    return q
      ? classeurRootFolders.filter(f => f.name.toLowerCase().includes(q))
      : classeurRootFolders;
  }, [classeurRootFolders, q]);

  // Infos du dossier ouvert
  const openedFolder = useMemo(() => {
    if (!openedClasseurFolderId) return null;
    return (storeData.classeurFolders || []).find(f => f.id === openedClasseurFolderId) || null;
  }, [storeData.classeurFolders, openedClasseurFolderId]);

  const parentFolder = useMemo(() => {
    if (!openedFolder?.parentId) return null;
    return (storeData.classeurFolders || []).find(f => f.id === openedFolder.parentId) || null;
  }, [storeData.classeurFolders, openedFolder]);

  const filteredDownloads = useMemo(() => {
    const list = storeData.downloads || [];
    return list.filter((d: any) => !q || (d.name || d.title || '').toLowerCase().includes(q));
  }, [storeData.downloads, q]);

  const filteredImages = useMemo(() => {
    return (storeData.images || []).filter(img => !q || img.name.toLowerCase().includes(q));
  }, [storeData.images, q]);

  const filteredVideos = useMemo(() => {
    return (storeData.videos || []).filter(vid => !q || vid.name.toLowerCase().includes(q));
  }, [storeData.videos, q]);

  const filteredAudio = useMemo(() => {
    return (storeData.audio || []).filter(aud => !q || aud.name.toLowerCase().includes(q) || (aud.artist && aud.artist.toLowerCase().includes(q)));
  }, [storeData.audio, q]);

  const filteredDocuments = useMemo(() => {
    return (storeData.documents || []).filter(doc => !q || doc.name.toLowerCase().includes(q));
  }, [storeData.documents, q]);

  const filteredFavorites = useMemo(() => {
    const all = [
      ...(storeData.documents || []),
      ...(storeData.images || []),
      ...(storeData.videos || []),
      ...(storeData.audio || [])
    ];
    const unique = all.filter((f, idx, arr) => arr.findIndex(x => x.id === f.id) === idx);
    const favs = unique.filter(f => f.isFavorite || f.isPinned);
    return favs.filter(f => !q || f.name.toLowerCase().includes(q));
  }, [storeData.documents, storeData.images, storeData.videos, storeData.audio, q]);

  const filteredTrash = useMemo(() => {
    return (storeData.trash || []).filter(t => !q || t.name.toLowerCase().includes(q));
  }, [storeData.trash, q]);

  const filteredSecure = useMemo(() => {
    return (storeData.secure || []).filter(s => !q || s.name.toLowerCase().includes(q));
  }, [storeData.secure, q]);

  // Statistiques par catégorie dans le dossier sécurisé (reflète le vrai menu sécurisé)
  const secureCounts = useMemo(() => {
    const counts = { all: filteredSecure.length, documents: 0, images: 0, videos: 0, audio: 0, classeur: 0 };
    filteredSecure.forEach(f => {
      const cat = (f.category || '').toLowerCase();
      const ext = (f.extension || f.name.split('.').pop() || '').toLowerCase();
      if (cat === 'audio' || (f as any).isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext)) {
        counts.audio++;
      } else if (cat === 'images' || (f as any).isImage || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
        counts.images++;
      } else if (cat === 'videos' || (f as any).isVideo || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
        counts.videos++;
      } else if (cat === 'classeur' || cat === 'notes' || (f as any).isFolder || ext === 'txt') {
        counts.classeur++;
      } else {
        counts.documents++;
      }
    });
    return counts;
  }, [filteredSecure]);

  // Fichiers filtrés selon la catégorie sélectionnée dans le dossier sécurisé
  const displayedSecureFiles = useMemo(() => {
    if (secureCategoryFilter === 'all') return filteredSecure;
    return filteredSecure.filter(f => {
      const cat = (f.category || '').toLowerCase();
      const ext = (f.extension || f.name.split('.').pop() || '').toLowerCase();
      if (secureCategoryFilter === 'audio') {
        return cat === 'audio' || (f as any).isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext);
      }
      if (secureCategoryFilter === 'images') {
        return cat === 'images' || (f as any).isImage || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
      }
      if (secureCategoryFilter === 'videos') {
        return cat === 'videos' || (f as any).isVideo || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
      }
      if (secureCategoryFilter === 'classeur') {
        return cat === 'classeur' || cat === 'notes' || (f as any).isFolder || ext === 'txt';
      }
      if (secureCategoryFilter === 'documents') {
        return cat === 'documents' || (!['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext) && cat !== 'classeur' && !['txt'].includes(ext));
      }
      return true;
    });
  }, [filteredSecure, secureCategoryFilter]);

  // Éléments de la barre de carrousel horizontale de navigation
  const navTabs = [
    {
      id: 'classeur' as const,
      name: 'Classeur',
      countBadge: classeurRootFolders.length > 0
        ? `${classeurRootFolders.length} dossier${classeurRootFolders.length > 1 ? 's' : ''}`
        : 'Vide',
      icon: FolderArchive,
      color: 'text-orange-400',
    },
    {
      id: 'downloads' as const,
      name: 'Téléchargements',
      countBadge: `${filteredDownloads.length > 0 ? filteredDownloads.length : 7} fichiers`,
      icon: Download,
      color: 'text-cyan-400',
    },
    {
      id: 'images' as const,
      name: 'Images',
      countBadge: '7,5 Go',
      icon: ImageIcon,
      color: 'text-emerald-400',
    },
    {
      id: 'videos' as const,
      name: 'Vidéos',
      countBadge: '20 Go',
      icon: Film,
      color: 'text-purple-400',
    },
    {
      id: 'audio' as const,
      name: 'Audio',
      countBadge: '4,8 Go',
      icon: Music,
      color: 'text-amber-400',
    },
    {
      id: 'documents' as const,
      name: 'Documents',
      countBadge: '3,5 Go',
      icon: FileText,
      color: 'text-blue-400',
    },
    {
      id: 'apps' as const,
      name: 'Applications',
      countBadge: 'Indisponible',
      icon: LayoutGrid,
      color: 'text-pink-400',
    },
    {
      id: 'favorites' as const,
      name: 'Favoris',
      countBadge: `${filteredFavorites.length} favoris`,
      icon: Star,
      color: 'text-amber-400',
    },
    {
      id: 'secure-folder' as const,
      name: 'Dossier sécurisé',
      countBadge: 'Chiffré',
      icon: Lock,
      color: 'text-blue-400',
    },
    {
      id: 'trash' as const,
      name: 'Corbeille',
      countBadge: `${filteredTrash.length} éléments`,
      icon: Trash2,
      color: 'text-rose-400',
    }
  ];

  // =========================================================================
  // MENU D'OPTIONS 3 TRAITS FLOTTANT POUR LES FICHIERS
  // =========================================================================
  const renderOptionsMenu = (file: FileItem, _alignRight = true) => {
    if (activeMenuFileId !== file.id) return null;

    return (
      <div
        className="studycloud-file-menu-panel absolute right-0 top-9 z-50 w-56 sm:w-60 bg-[#0A0F1D] border-2 border-slate-600/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_20px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col p-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : Nom du fichier et bouton de fermeture */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {file.size} • <span className="uppercase text-orange-400">{file.extension || file.category || 'DOC'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuFileId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste déroulante des options */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          {/* Section 1 : Consulter / Ouvrir */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                setViewerFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 transition-colors cursor-pointer text-left"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span>Aperçu / Ouvrir</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleDownloadFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Télécharger</span>
            </button>
          </div>

          {/* Section 2 : Favoris & Épingler */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleToggleFavorite(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
              <span>{file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleTogglePin(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-purple-400 hover:bg-purple-500/15 transition-colors cursor-pointer text-left"
            >
              <Pin className={`w-3.5 h-3.5 shrink-0 rotate-45 ${file.isPinned ? 'fill-purple-400' : ''}`} />
              <span>{file.isPinned ? 'Désépingler' : 'Épingler en tête'}</span>
            </button>
          </div>

          {/* Section 3 : Renommer & Partager */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                setRenamingFile(file);
                setRenameInputValue(file.name);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              <span>Renommer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                handleShareFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-sky-400 hover:bg-sky-500/15 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Partager le lien</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMenuFileId(null);
                setDetailsFile(file);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Détails & Propriétés</span>
            </button>
          </div>

          {/* Option Dossier sécurisé : Déverrouiller / Sortir du dossier sécurisé */}
          {(activeTab === 'secure-folder' || file.isSecure) && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setActiveMenuFileId(null);
                  handleRestoreFromSecure(file);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
              >
                <Unlock className="w-3.5 h-3.5 shrink-0" />
                <span>Sortir du dossier sécurisé</span>
              </button>
            </div>
          )}

          {/* Section 4 : Supprimer / Déplacer à la corbeille */}
          <div className="py-1">
            {activeTab === 'trash' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuFileId(null);
                    handleRestoreFromTrash(file);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Restaurer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuFileId(null);
                    handlePermanentDelete(file);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Supprimer définitivement</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveMenuFileId(null);
                  handleDeleteFile(file);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Mettre à la corbeille</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // ACTIONS ET MENU D'OPTIONS 3 TRAITS POUR LES DOSSIERS 3D DU CLASSEUR
  // =========================================================================
  const handleFolderAction = (action: string, folder: ClasseurCreatedFolder) => {
    setActiveMenuFolderId(null);

    switch (action) {
      case 'open':
        setOpenedClasseurFolderId(folder.id);
        break;

      case 'download': {
        const directFiles = (storeData.folderFilesMap || {})[folder.id] || [];
        if (directFiles.length === 0) {
          showToast(`Le dossier "${folder.name}" est vide.`);
        } else {
          showToast(`Téléchargement de ${directFiles.length} fichier(s)...`);
          directFiles.forEach((file, index) => {
            setTimeout(() => {
              handleDownloadFile(file);
            }, index * 200);
          });
        }
        break;
      }

      case 'favorite': {
        const newFav = !folder.isFavorite;
        CloudDataStore.setClasseurFolders(
          (storeData.classeurFolders || []).map(f => f.id === folder.id ? { ...f, isFavorite: newFav } : f)
        );
        if (newFav) {
          CloudStorageAPI.addFavorite(folder.id, 'classeur_folder').catch(() => {});
          showToast('Dossier ajouté aux favoris !');
        } else {
          CloudStorageAPI.removeFavorite(folder.id).catch(() => {});
          showToast('Dossier retiré des favoris');
        }
        break;
      }

      case 'pin': {
        const newPin = !folder.isPinned;
        CloudDataStore.setClasseurFolders(
          (storeData.classeurFolders || []).map(f => f.id === folder.id ? { ...f, isPinned: newPin } : f)
        );
        if (newPin) {
          CloudStorageAPI.addPinned(folder.id, 'classeur_folder').catch(() => {});
          showToast(`"${folder.name}" épinglé en tête !`);
        } else {
          CloudStorageAPI.removePinned(folder.id).catch(() => {});
          showToast(`"${folder.name}" désépinglé`);
        }
        break;
      }

      case 'rename': {
        const newName = window.prompt('Modifier le nom du dossier :', folder.name);
        if (newName && newName.trim() && newName.trim() !== folder.name) {
          const trimmed = newName.trim();
          CloudDataStore.renameFolder(folder.id, trimmed);
          CloudStorageAPI.renameItem(folder.id, trimmed, 'classeur_folder').catch(() => {});
          showToast(`Dossier renommé en "${trimmed}" !`);
        }
        break;
      }

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

      case 'delete': {
        if (window.confirm(`Voulez-vous supprimer le dossier "${folder.name}" ?`)) {
          CloudDataStore.removeFolder(folder.id);
          CloudStorageAPI.deleteClasseurFolder(folder.id).catch(() => {});
          if (openedClasseurFolderId === folder.id) {
            setOpenedClasseurFolderId(null);
          }
          showToast(`Dossier "${folder.name}" supprimé !`);
        }
        break;
      }

      default:
        break;
    }
  };

  const renderFolder3DOptionsMenu = (folder: ClasseurCreatedFolder) => {
    if (activeMenuFolderId !== folder.id) return null;

    return (
      <div 
        className="studycloud-file-menu-panel absolute right-0 top-9 z-50 w-60 bg-[#0A0F1D] border-2 border-slate-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de menu dédié */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={folder.name}>
              {folder.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {folder.dateText || 'Dossier 3D'} • <span className="uppercase text-amber-400">CLASSEUR</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuFolderId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options du dossier */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('open', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 transition-colors cursor-pointer text-left"
            >
              <Folder className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span>Ouvrir le dossier</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('download', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Télécharger le dossier</span>
            </button>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('favorite', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${folder.isFavorite ? 'fill-amber-400' : ''}`} />
              <span>{folder.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('pin', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-purple-400 hover:bg-purple-500/15 transition-colors cursor-pointer text-left"
            >
              <Pin className={`w-3.5 h-3.5 shrink-0 rotate-45 ${folder.isPinned ? 'fill-purple-400' : ''}`} />
              <span>{folder.isPinned ? 'Désépingler' : 'Épingler en tête'}</span>
            </button>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('rename', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              <span>Renommer</span>
            </button>
            <button
              type="button"
              onClick={() => handleFolderAction('share', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-sky-400 hover:bg-sky-500/15 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Partager</span>
            </button>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => handleFolderAction('delete', folder)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Supprimer le dossier</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOSSIER CLASSEUR (REFLET À L'IDENTIQUE DU VRAI MENU CLASSEUR)
  // =========================================================================
  const renderClasseurFolderCard = (folder: ClasseurCreatedFolder) => {
    const isFolderMenuOpen = activeMenuFolderId === folder.id;

    return (
      <div
        key={folder.id}
        onClick={() => {
          setOpenedClasseurFolderId(folder.id);
          setActiveMenuFileId(null);
          setActiveMenuFolderId(null);
        }}
        className={`group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border border-white/10 hover:border-orange-400/50 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all select-none cursor-pointer flex flex-col justify-between ${
          isFolderMenuOpen ? 'overflow-visible z-50 ring-2 ring-orange-400/50' : 'overflow-hidden z-10'
        }`}
        title={folder.name}
      >
        {/* Haut de carte : Badges (Épinglé, Favori) et Bouton 3 traits */}
        <div className="flex items-center justify-between w-full mb-1 z-20 relative">
          <div className="flex items-center gap-1">
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

          <div 
            className="relative studycloud-menu-trigger"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFolderId(isFolderMenuOpen ? null : folder.id);
              }}
              className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                isFolderMenuOpen
                  ? 'border-orange-400 ring-2 ring-orange-400/50 opacity-100 bg-black'
                  : 'border-white/30 opacity-90 group-hover:opacity-100'
              }`}
              title="Options du dossier (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderFolder3DOptionsMenu(folder)}
          </div>
        </div>

        {/* Le dossier 3D lui-même : Classeur3DFolderCard (Modèles 1, 2, 3, 4) */}
        <div className="pt-2 pb-1 w-full">
          <Classeur3DFolderCard folder={folder} />
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE FICHIER DANS UN DOSSIER CLASSEUR (REFLET À L'IDENTIQUE DU CLASSEUR)
  // =========================================================================
  const renderClasseurCard = (doc: FileItem, _index: number) => {
    const isMenuOpen = activeMenuFileId === doc.id;
    const isSelected = viewerFile?.id === doc.id;
    const isTxtNote = Boolean(
      doc.isNotepad ||
      doc.category === 'notes' ||
      doc.extension?.toLowerCase() === 'txt' ||
      doc.name.toLowerCase().endsWith('.txt') ||
      doc.type === 'text/plain'
    );

    if (isTxtNote) {
      return (
        <div
          key={doc.id}
          onClick={() => setViewerFile(doc)}
          className={`group relative p-2.5 sm:p-3 rounded-2xl bg-[#0E1526]/85 hover:bg-[#141E34] border shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between select-none cursor-pointer ${
            isSelected
              ? 'border-cyan-400 ring-2 ring-cyan-400/40 bg-[#14233C]'
              : 'border-white/10 hover:border-cyan-400/50 hover:-translate-y-1'
          } ${isMenuOpen ? 'overflow-visible z-50 ring-2 ring-cyan-400/50' : 'overflow-hidden z-10'}`}
        >
          {/* Haut de carte : Badge TXT, Épinglé, Favori et Bouton 3 traits */}
          <div className="flex items-center justify-between w-full mb-1 z-20 relative">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                TXT
              </span>
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

            <div 
              className="relative studycloud-menu-trigger"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(isMenuOpen ? null : doc.id);
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
              {renderOptionsMenu(doc)}
            </div>
          </div>

          {/* Illustration TXT Conforme strictement au Classeur (TxtDocumentSVG) */}
          <div className="w-full flex-1 flex items-center justify-center py-2 min-h-[110px]">
            <div className="w-24 sm:w-28 aspect-[160/215] drop-shadow-md group-hover:scale-105 transition-transform duration-200">
              <TxtDocumentSVG />
            </div>
          </div>

          {/* Bas de carte : Titre et détails */}
          <div className="p-1.5 flex flex-col justify-between bg-black/30 rounded-xl mt-1.5">
            <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors" title={doc.name}>
              {doc.name}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span className="truncate">{doc.size || '0 o'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadFile(doc);
                }}
                className="p-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-all cursor-pointer active:scale-95"
                title="Télécharger"
              >
                <Download className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fichiers multimédias ou documents importés dans le dossier
    return (
      <div
        key={doc.id}
        onClick={() => setViewerFile(doc)}
        className={`group relative bg-[#0E1526]/85 hover:bg-[#141E34] border rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col select-none cursor-pointer ${
          isSelected
            ? 'border-orange-400 ring-2 ring-orange-400/40 bg-[#192238]'
            : 'border-white/10 hover:border-orange-500/50 hover:-translate-y-1'
        } ${isMenuOpen ? 'overflow-visible z-50 ring-2 ring-orange-400/50' : 'overflow-hidden z-10'}`}
      >
        <div className="w-full h-24 sm:h-28 bg-slate-900/90 relative rounded-t-2xl flex items-center justify-center overflow-hidden">
          {/* Badges Épinglé et Favori */}
          {(doc.isPinned || doc.isFavorite) && (
            <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 pointer-events-none">
              {doc.isPinned && (
                <span className="p-1 rounded-md bg-black/75 text-blue-400 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
                  <Pin className="w-3 h-3 rotate-45" />
                </span>
              )}
              {doc.isFavorite && (
                <span className="p-1 rounded-md bg-black/75 text-amber-400 border border-amber-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Favori">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
              )}
            </div>
          )}

          {doc.category === 'images' || doc.isImage ? (
            <img 
              src={doc.previewUrl || doc.url} 
              alt={doc.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (doc.category === 'videos' || Boolean(doc.videoUrl) || doc.isVideo) ? (
            <VideoCardPreview vid={doc} />
          ) : (doc.category === 'documents' || doc.isPdf) ? (
            <DocumentCardPreview doc={doc} />
          ) : ((doc.category as string) === 'audio' || Boolean(doc.audioUrl) || doc.isAudio) ? (
            <AudioCardPreview track={doc} />
          ) : doc.previewUrl ? (
            <img 
              src={doc.previewUrl} 
              alt={doc.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400/85 stroke-[1.8]" />
            </div>
          )}
        </div>

        {/* Bouton 3 traits positionné au-dessus de la carte sans être coupé */}
        <div 
          className="absolute top-1.5 right-1.5 z-30 studycloud-menu-trigger"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuFileId(isMenuOpen ? null : doc.id);
            }}
            className={`p-1 sm:p-1.5 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
              isMenuOpen
                ? 'border-orange-400 ring-2 ring-orange-400/50 opacity-100 bg-black'
                : 'border-white/30 opacity-90 group-hover:opacity-100'
            }`}
            title="Options du fichier (3 traits)"
          >
            <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>

          {renderOptionsMenu(doc)}
        </div>

        <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-black/30 rounded-b-2xl">
          <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-orange-400 transition-colors" title={doc.name}>
            {doc.name}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
            <span className="truncate max-w-[85px] uppercase">{doc.extension || doc.category || 'DOC'}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadFile(doc);
              }}
              className="p-1 bg-orange-600 hover:bg-orange-500 text-white rounded transition-all cursor-pointer active:scale-95"
              title="Télécharger"
            >
              <Download className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT STANDARD
  // =========================================================================
  const renderDocumentCard = (doc: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === doc.id;
    const isSelected = viewerFile?.id === doc.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;
    const docExt = doc.extension || (doc.name.includes('.') ? doc.name.split('.').pop() || 'PDF' : 'PDF');
    const theme = getDocumentTheme(docExt);

    return (
      <div
        key={doc.id}
        onClick={() => setViewerFile(doc)}
        className={`aspect-[3/4] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all relative group select-none cursor-pointer active:scale-98 shadow-md ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-amber-400 border-amber-300'
              : `${theme.border} ${theme.shadow}`
        } ${isMenuOpen ? 'overflow-visible z-50' : 'overflow-hidden z-10'}`}
        style={{
          background: theme.bg
        }}
      >
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === doc.id ? null : doc.id));
              }}
              className="p-1 sm:p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-sm"
              title="Options du document (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(doc, alignRight)}
          </div>
          <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/50 text-white border border-white/20 px-1.5 py-0.5 rounded shadow-sm">
            {doc.size || 'Document'}
          </span>
        </div>

        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <DocumentCardPreview doc={doc} />
        </div>

        <div className="px-0.5 mb-1">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={doc.name}>
            {doc.name}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadFile(doc);
            }}
            className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
            title="Télécharger"
          >
            <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE IMAGE
  // =========================================================================
  const renderImageCard = (img: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === img.id;
    const isSelected = viewerFile?.id === img.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={img.id}
        onClick={() => setViewerFile(img)}
        className={`aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md relative group select-none cursor-pointer ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-emerald-400 border-emerald-400'
              : 'border-white/10 hover:border-emerald-400/60'
        } ${isMenuOpen ? 'overflow-visible z-50' : 'overflow-hidden z-10'}`}
      >
        {/* Miniature réelle de l'image */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl">
          <ImageCardPreview img={img} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Barre supérieure : 3 traits & taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === img.id ? null : img.id));
              }}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90"
              title="Options de l'image (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(img, alignRight)}
          </div>

          <span className="text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded border border-white/20 shadow-sm">
            {img.size || 'Image'}
          </span>
        </div>

        {/* Pied de carte : Nom de l'image */}
        <div className="relative z-20 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10">
          <p className="text-[10px] sm:text-xs font-black text-white truncate group-hover:text-emerald-300 transition-colors" title={img.name}>
            {img.name}
          </p>
          <p className="text-[9px] text-slate-400 truncate mt-0.5">
            {img.date || 'Image'}
          </p>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE VIDÉO
  // =========================================================================
  const renderVideoCard = (vid: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === vid.id;
    const isSelected = viewerFile?.id === vid.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={vid.id}
        onClick={() => setViewerFile(vid)}
        className={`aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md relative group select-none cursor-pointer ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-purple-400 border-purple-400'
              : 'border-white/10 hover:border-purple-400/60'
        } ${isMenuOpen ? 'overflow-visible z-50' : 'overflow-hidden z-10'}`}
      >
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl">
          <VideoCardPreview vid={vid} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Bouton lecture central */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-purple-600/80 hover:bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === vid.id ? null : vid.id));
              }}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90"
              title="Options de la vidéo (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(vid, alignRight)}
          </div>

          <span className="text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded border border-white/20 shadow-sm">
            {vid.size || 'Vidéo'}
          </span>
        </div>

        <div className="relative z-20 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10">
          <p className="text-[10px] sm:text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors" title={vid.name}>
            {vid.name}
          </p>
          <p className="text-[9px] text-slate-400 truncate mt-0.5">
            {vid.date || 'Vidéo'}
          </p>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE AUDIO AUTHENTIQUE
  // =========================================================================
  const renderAudioCard = (aud: FileItem, index: number) => {
    const isMenuOpen = activeMenuFileId === aud.id;
    const isSelected = viewerFile?.id === aud.id;
    const isPlaying = playingAudioId === aud.id;
    const alignRight = (index + 1) % 2 === 0 || (index + 1) % 4 === 0;

    return (
      <div
        key={aud.id}
        onClick={() => {
          setViewerFile(aud);
          setPlayingAudioId(aud.id);
        }}
        className={`aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md relative group select-none cursor-pointer ${
          isSelected
            ? 'z-40 ring-2 ring-sky-400 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-[1.02]'
            : isMenuOpen
              ? 'z-50 ring-2 ring-amber-400 border-amber-400'
              : 'border-white/10 hover:border-amber-400/60'
        } ${isMenuOpen ? 'overflow-visible z-50' : 'overflow-hidden z-10'}`}
      >
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
          <AudioCardPreview track={aud} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70 pointer-events-none" />
        </div>

        {/* Logo mélodie central en filigrane */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-amber-400/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            {isPlaying ? (
              <Pause className="w-5 h-5 text-amber-400 fill-current" />
            ) : (
              <Music className="w-6 h-6 text-amber-400/90" />
            )}
          </div>
        </div>

        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => (prev === aud.id ? null : aud.id));
              }}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90"
              title="Options audio (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {renderOptionsMenu(aud, alignRight)}
          </div>

          <span className="text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded border border-white/20 shadow-sm">
            {aud.size || 'Audio'}
          </span>
        </div>

        <div className="relative z-20 p-2.5 bg-black/80 backdrop-blur-md border-t border-white/10">
          <p className="text-[10px] sm:text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors" title={aud.name}>
            {aud.name}
          </p>
          <p className="text-[9px] font-semibold text-amber-400/90 truncate uppercase tracking-wider mt-0.5">
            {aud.artist || 'StudyCloud Audio'}
          </p>
        </div>
      </div>
    );
  };


  const handleCloseReader = () => {
    setViewerFile(null);
    setIsViewerMaximized(false);
    setViewerZoom(1);
    setViewerRotation(0);
  };

  const handleShare = (file: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([file]);
      return;
    }
    if (navigator.share) {
      navigator.share({
        title: file.name,
        text: `Consulter le document : ${file.name}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Lien copié dans le presse-papiers');
    }
  };

  // Liste des fichiers ordonnée pour la navigation Précédent / Suivant
  const activeFileList = useMemo<FileItem[]>(() => {
    switch (activeTab) {
      case 'classeur':
        return openedClasseurFolderId ? classeurFolderFiles : (storeData.documents || []);
      case 'downloads':
        return filteredDownloads as FileItem[];
      case 'images':
        return filteredImages;
      case 'videos':
        return filteredVideos;
      case 'audio':
        return filteredAudio;
      case 'documents':
        return filteredDocuments;
      case 'favorites':
        return filteredFavorites;
      case 'secure-folder':
        return filteredSecure;
      case 'trash':
        return filteredTrash;
      default:
        return [];
    }
  }, [
    activeTab,
    openedClasseurFolderId,
    classeurFolderFiles,
    storeData.documents,
    filteredDownloads,
    filteredImages,
    filteredVideos,
    filteredAudio,
    filteredDocuments,
    filteredFavorites,
    filteredSecure,
    filteredTrash
  ]);

  const handleNavigateFile = (direction: 'prev' | 'next') => {
    if (!viewerFile || activeFileList.length === 0) return;
    const currentIndex = activeFileList.findIndex(f => f.id === viewerFile.id);
    if (currentIndex === -1) {
      setViewerFile(activeFileList[0]);
      return;
    }
    if (direction === 'prev') {
      const prevIndex = (currentIndex - 1 + activeFileList.length) % activeFileList.length;
      setViewerFile(activeFileList[prevIndex]);
    } else {
      const nextIndex = (currentIndex + 1) % activeFileList.length;
      setViewerFile(activeFileList[nextIndex]);
    }
  };

  const renderReader = (file: FileItem) => {
    const ext = (file.extension || '').toLowerCase();
    const name = file.name || 'Fichier';
    const isTxtNote = Boolean(
      file.isNotepad ||
      file.category === 'notes' ||
      ext === 'txt' ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.type === 'text/plain'
    );
    const isVideo = file.category === 'videos' || (file as any).isVideo || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);
    const isImage = file.category === 'images' || (file as any).isImage || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);
    const isAudio = file.category === 'audio' || (file as any).isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
    const isPdf = !isTxtNote && (ext === 'pdf' || (file.type && file.type.includes('pdf')) || (!isVideo && !isImage && !isAudio));

    const activeUrl = resolvedBlobUrl || file.url || file.previewUrl || (file as any).videoUrl || (file as any).audioUrl || '';

    // Si c'est une note, ouvrir la véritable page d'écriture interactive (sans PDF ni bouton horizontal)
    if (isTxtNote) {
      return (
        <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
          {/* Barre supérieure de la page d'écriture */}
          <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                BLOC-NOTES
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={name}>
                  {name}
                </p>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {isNoteSavedIndicator ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      Enregistré
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
                      Enregistrement...
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

            {/* Actions de la note : Télécharger, Partager, Plein écran, Fermer */}
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
                onClick={() => handleShare(file)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                title="Partager"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
              </button>

              <button
                type="button"
                onClick={() => setIsViewerMaximized(!isViewerMaximized)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                  isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
                }`}
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

          {/* Barre inférieure : Statistiques */}
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
    }

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur ("l'écriture qui apparaît à droite") */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateFile('prev')}
              className="p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              title="Fichier précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateFile('next')}
              className="p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              title="Fichier suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px] md:max-w-xs" title={name}>
                {name}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate">
                {file.size || 'Fichier'} • <span className="uppercase text-sky-400">{file.extension || file.category || 'DOC'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPdf && (
              <>
                <button
                  type="button"
                  onClick={() => setViewerZoom(z => Math.max(0.5, Math.round((z - 0.2) * 10) / 10))}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                  title="Zoom arrière"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] font-bold text-slate-300 w-10 text-center hidden sm:inline-block">
                  {Math.round(viewerZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setViewerZoom(z => Math.min(3, Math.round((z + 0.2) * 10) / 10))}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                  title="Zoom avant"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewerRotation(r => (r + 90) % 360)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                  title="Faire pivoter"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleToggleFavorite(file)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                file.isFavorite ? 'bg-amber-500/20 text-amber-400 border-amber-400/40' : 'bg-black/60 hover:bg-slate-800 text-white border-white/10'
              }`}
              title={file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => handleShare(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
            </button>

            <button
              type="button"
              onClick={() => handleDownloadFile(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5 text-white" />
            </button>

            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(file, 'Espace Cloud', activeFileList)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                title="Ouvrir dans l'Espace d'étude"
              >
                <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              }`}
              title={isViewerMaximized ? 'Réduire la vue' : "Agrandir en plein écran"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>

            <button
              type="button"
              onClick={handleCloseReader}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title={isViewerMaximized ? "Réduire la vue" : "Fermer le lecteur"}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du lecteur selon le format (Images, Vidéos, Audio, Documents) */}
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center relative overflow-hidden p-1 sm:p-2 bg-black/95">
          {isVideo ? (
            <ModernVideoPlayer
              fileId={file.id}
              src={activeUrl}
              fileName={name}
              fileSize={file.size}
              autoPlay={true}
              className="w-full h-full max-h-[calc(100vh-140px)] rounded-2xl"
            />
          ) : isImage ? (
            <ModernImageViewer
              fileId={file.id}
              src={activeUrl}
              alt={name}
              fileName={name}
              fileSize={file.size}
              className="w-full h-full max-h-[calc(100vh-140px)] rounded-2xl"
            />
          ) : isAudio ? (
            <ModernAudioPlayer
              fileId={file.id}
              src={activeUrl}
              fileName={name}
              fileSize={file.size}
              artist={file.artist}
              autoPlay={true}
            />
          ) : (
            <ModernDocumentViewer
              fileId={file.id}
              url={activeUrl}
              fileName={name}
              fileSize={file.size}
              textContent={file.content}
              className="w-full h-full border-0 rounded-none shadow-none"
            />
          )}
        </div>
      </div>
    );
  };

  const gridColsClass = viewerFile
    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-stone-100 text-stone-900 select-none animate-in fade-in duration-200">
      {/* =========================================================================
          1. EN-TÊTE FIXE DU MENU ESPACE CLOUD (NE BOUGE PAS LORS DU DÉFILEMENT)
          ========================================================================= */}
      <header className="shrink-0 sticky top-0 z-30 w-full bg-stone-100/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 border-b border-stone-200 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour rond, Icône Nuage cyan et Titre Espace Cloud */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isViewerMaximized) {
                  setIsViewerMaximized(false);
                } else if (viewerFile) {
                  handleCloseReader();
                } else {
                  onBack();
                }
              }}
              className="p-2 sm:p-2.5 rounded-full bg-[#182032] hover:bg-[#222c44] text-white border border-stone-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-2 rounded-xl bg-[#182032] border border-stone-700/50 text-cyan-400 shadow-inner">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 leading-tight">
                  Espace Cloud
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
                  StudyCloud
                </p>
              </div>
            </div>
          </div>

          {/* DROITE : Barre de recherche intégrée "Rechercher dans Espace..." */}
          <div className="flex items-center gap-2 max-w-xs sm:max-w-md w-full justify-end">
            <div className="relative w-full max-w-[260px] sm:max-w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Espace..."
                className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full bg-[#04060A] text-white placeholder-slate-400 border border-stone-700/50 focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/50 outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. CARROUSEL HORIZONTAL DES CATÉGORIES & COLLECTIONS
          ========================================================================= */}
      <section className="shrink-0 w-full bg-stone-100/95 border-b border-stone-200 px-2 sm:px-6 md:px-10 lg:px-12 py-2 sm:py-2.5 select-none z-20">
        <div className="relative flex items-center group">
          {/* Flèche gauche pour défilement rapide sur grand écran */}
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
            className="hidden md:flex absolute left-0 z-30 w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-900 text-white items-center justify-center border border-stone-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer -translate-x-1"
            title="Défiler vers la gauche"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
          </button>

          {/* Conteneur défilant et glissable avec la souris / tactile */}
          <div
            ref={tabsScrollRef}
            onMouseDown={handleTabsMouseDown}
            onMouseMove={handleTabsMouseMove}
            onMouseUp={handleTabsMouseUp}
            onMouseLeave={handleTabsMouseUp}
            onWheel={(e) => {
              if (tabsScrollRef.current && e.deltaY !== 0) {
                tabsScrollRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 sm:gap-2.5 py-1 px-1 cursor-grab active:cursor-grabbing"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {navTabs.map((item) => {
              const isSelected = activeTab === item.id;
              const Icon = item.icon;

              // Onglet Classeur avec dégradé terracotta authentique
              if (item.id === 'classeur') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('classeur');
                      setActiveMenuFileId(null);
                      setViewerFile(null);
                      setIsViewerMaximized(false);
                    }}
                    className={`group relative flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 shrink-0 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#C25416] via-[#B8480C] to-[#A03D07] text-white border border-orange-300 ring-2 ring-orange-400/60 shadow-[0_4px_22px_rgba(184,72,12,0.65)] scale-[1.02]'
                        : 'bg-[#182032] hover:bg-[#222c44] text-white border border-stone-700/50 hover:border-orange-400/40 opacity-90 hover:opacity-100'
                    }`}
                    title="Classeur d'études"
                  >
                    <div className="p-1.5 sm:p-2 rounded-xl bg-black/40 border border-white/20 shrink-0">
                      <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 stroke-[2.2]" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs sm:text-sm font-black text-white tracking-wide block leading-tight">
                        Classeur
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-orange-200 font-bold block leading-tight">
                        {item.countBadge}
                      </span>
                    </div>
                  </button>
                );
              }

              // Autres onglets (Téléchargements, Images, Vidéos, Audio, Documents, etc.)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setActiveMenuFileId(null);
                    setViewerFile(null);
                    setIsViewerMaximized(false);
                  }}
                  className={`shrink-0 flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl transition-all duration-200 cursor-pointer select-none active:scale-95 border ${
                    isSelected
                      ? 'bg-[#0E1726] border-sky-400 text-white ring-2 ring-sky-400/80 shadow-[0_0_15px_rgba(56,189,248,0.35)] scale-[1.02]'
                      : 'bg-[#182032] hover:bg-[#222c44] border-stone-700/50 text-white hover:border-stone-500 shadow-sm'
                  }`}
                  title={item.name}
                >
                  <div className={`p-1.5 sm:p-2 rounded-xl bg-black/50 border border-white/10 ${item.color} shrink-0`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs sm:text-sm font-bold text-white tracking-wide block leading-tight">
                      {item.name}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-300 font-medium block leading-tight">
                      {item.countBadge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Flèche droite pour défilement rapide sur grand écran */}
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
            className="hidden md:flex absolute right-0 z-30 w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-900 text-white items-center justify-center border border-stone-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer translate-x-1"
            title="Défiler vers la droite"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </section>

      {/* =========================================================================
          3. DISPOSITION SPLIT-SCREEN : LISTE À GAUCHE & LECTEUR À DROITE
          ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-140px)]">
        {/* PANNEAU DE GAUCHE : CONTENU DYNAMIQUE SELON L'ONGLET */}
        <main className={`overflow-y-auto px-3 sm:px-6 py-5 pb-32 bg-stone-100 ${
          isViewerMaximized && viewerFile
            ? 'hidden'
            : viewerFile
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-200'
              : 'w-full md:px-10 lg:px-12'
        }`}>
          {/* ONGLET 1 : CLASSEUR — miroir fidèle du vrai menu Classeur */}
          {activeTab === 'classeur' && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* Fil d'Ariane / breadcrumb quand un dossier est ouvert */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setOpenedClasseurFolderId(null);
                    setViewerFile(null);
                    setIsViewerMaximized(false);
                  }}
                  className={`text-xs font-bold transition-colors ${
                    openedClasseurFolderId
                      ? 'text-orange-600 hover:text-orange-700 cursor-pointer'
                      : 'text-stone-700 cursor-default'
                  }`}
                >
                  Classeur
                </button>
                {parentFolder && (
                  <>
                    <BreadcrumbChevron className="w-3.5 h-3.5 text-stone-400" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenedClasseurFolderId(parentFolder.id);
                        setViewerFile(null);
                        setIsViewerMaximized(false);
                      }}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                    >
                      {parentFolder.name}
                    </button>
                  </>
                )}
                {openedFolder && (
                  <>
                    <BreadcrumbChevron className="w-3.5 h-3.5 text-stone-400" />
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-lg border"
                      style={{
                        color: openedFolder.primaryColor,
                        borderColor: `${openedFolder.primaryColor}50`,
                        backgroundColor: `${openedFolder.primaryColor}18`
                      }}
                    >
                      {openedFolder.name}
                    </span>
                  </>
                )}

                <span className="ml-auto text-xs font-medium text-stone-500">
                  {openedClasseurFolderId
                    ? `${classeurFolderFiles.length + classeurSubFolders.length} élément${(classeurFolderFiles.length + classeurSubFolders.length) > 1 ? 's' : ''}`
                    : classeurRootFolders.length > 0
                      ? `${classeurRootFolders.length} dossier${classeurRootFolders.length > 1 ? 's' : ''}`
                      : ''}
                  {searchQuery && ` • "${searchQuery}"`}
                </span>
              </div>

              {/* VUE RACINE : liste des dossiers */}
              {!openedClasseurFolderId && (
                filteredClasseurFolders.length === 0 ? (
                  <div className="py-24 text-center text-stone-500 space-y-3">
                    <FolderArchive className="w-16 h-16 mx-auto text-stone-400 opacity-60" />
                    <p className="text-sm font-bold text-stone-800">
                      {searchQuery ? 'Aucun dossier trouvé' : 'Le classeur est vide'}
                    </p>
                    <p className="text-xs text-stone-500">
                      {searchQuery
                        ? `Aucun résultat pour "${searchQuery}"`
                        : 'Créez des dossiers dans le menu Classeur pour les voir ici'}
                    </p>
                  </div>
                ) : (
                  <div 
                    className="grid transition-all duration-200 w-full"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 205px))',
                      gap: '16px'
                    }}
                  >
                    {filteredClasseurFolders.map(folder => renderClasseurFolderCard(folder))}
                  </div>
                )
              )}

              {/* VUE DOSSIER OUVERT : sous-dossiers + fichiers */}
              {openedClasseurFolderId && (
                <div className="space-y-6">
                  {/* Sous-dossiers */}
                  {classeurSubFolders.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Sous-dossiers</p>
                      <div 
                        className="grid transition-all duration-200 w-full"
                        style={{
                          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 205px))',
                          gap: '16px'
                        }}
                      >
                        {classeurSubFolders.map(f => renderClasseurFolderCard(f))}
                      </div>
                    </div>
                  )}

                  {/* Fichiers dans ce dossier */}
                  {classeurFolderFiles.length > 0 ? (
                    <div className="space-y-2">
                      {classeurSubFolders.length > 0 && (
                        <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Documents</p>
                      )}
                      <div 
                        className="grid transition-all duration-200 w-full"
                        style={{
                          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 205px))',
                          gap: '16px'
                        }}
                      >
                        {classeurFolderFiles.map((doc, idx) => renderClasseurCard(doc, idx))}
                      </div>
                    </div>
                  ) : classeurSubFolders.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-stone-400" />
                      <p className="text-sm font-bold text-stone-800">Ce dossier est vide</p>
                      <p className="text-xs text-stone-500">Déplacez des documents ici depuis le menu Documents</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : TÉLÉCHARGEMENTS */}
          {activeTab === 'downloads' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
                </span>
              </div>

              {filteredDownloads.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Download className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucun fichier téléchargé pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredDownloads.map((doc: any, idx) => renderDocumentCard(doc, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 3 : IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} dans l'espace cloud
                </span>
              </div>

              {filteredImages.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <ImageIcon className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucune image stockée pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredImages.map((img, idx) => renderImageCard(img, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 4 : VIDÉOS */}
          {activeTab === 'videos' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} dans l'espace cloud
                </span>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Film className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucune vidéo enregistrée pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredVideos.map((vid, idx) => renderVideoCard(vid, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 5 : AUDIO */}
          {activeTab === 'audio' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredAudio.length} piste{filteredAudio.length > 1 ? 's' : ''} audio dans l'espace cloud
                </span>
              </div>

              {filteredAudio.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Music className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucune piste audio enregistrée pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredAudio.map((aud, idx) => renderAudioCard(aud, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 6 : DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} dans l'espace cloud
                </span>
              </div>

              {filteredDocuments.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucun document publié pour le moment</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredDocuments.map((doc, idx) => renderDocumentCard(doc, idx))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 7 : APPLICATIONS */}
          {activeTab === 'apps' && (
            <div className="min-h-[460px] flex flex-col items-center justify-center text-center px-4 py-20 animate-in fade-in duration-200">
              <div className="max-w-lg mx-auto space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                  Ce menu n'est pas disponible pour le moment
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                  L'accès aux applications et aux outils intégrés est temporairement suspendu pour des travaux d'optimisation et de maintenance technique.
                </p>
                <p className="text-xs text-stone-500 font-medium">
                  Ce service sera prochainement réactivé. Nous vous remercions pour votre compréhension.
                </p>
              </div>
            </div>
          )}

          {/* ONGLET 8 : FAVORIS */}
          {activeTab === 'favorites' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {filteredFavorites.length} fichier{filteredFavorites.length > 1 ? 's' : ''} favori{filteredFavorites.length > 1 ? 's' : ''}
                </span>
              </div>

              {filteredFavorites.length === 0 ? (
                <div className="py-20 text-center text-stone-500 space-y-2">
                  <Star className="w-12 h-12 mx-auto text-stone-400" />
                  <p className="text-sm font-bold text-stone-800">Aucun fichier favori pour le moment</p>
                  <p className="text-xs text-stone-500">Ajoutez des fichiers en favoris avec le menu 3 traits</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredFavorites.map((file, idx) => {
                    if (file.category === 'images' || (file as any).isImage) return renderImageCard(file, idx);
                    if (file.category === 'videos' || (file as any).isVideo) return renderVideoCard(file, idx);
                    if (file.category === 'audio' || (file as any).isAudio) return renderAudioCard(file, idx);
                    if (file.category === 'classeur') return renderClasseurCard(file, idx);
                    return renderDocumentCard(file, idx);
                  })}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 9 : DOSSIER SÉCURISÉ (REFLET STRICT DU VRAI MENU SÉCURISÉ) */}
          {activeTab === 'secure-folder' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {!isSecureFolderUnlocked ? (
                <div className="py-6 sm:py-12 flex items-center justify-center p-2 sm:p-4">
                  <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#090D16] border border-amber-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.15)] flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/25 via-amber-600/15 to-transparent border border-amber-500/40 text-amber-400 flex items-center justify-center mb-5 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                      <Lock className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {hasServerPin === false ? "Définir votre code de sécurité" : "Dossier Sécurisé Verrouillé"}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
                      {hasServerPin === false
                        ? "Pour sécuriser vos fichiers, définissez un code secret. Le code doit comporter plus de 4 caractères."
                        : "Veuillez saisir votre code secret pour accéder à vos fichiers protégés."}
                    </p>

                    <form onSubmit={handleUnlockSecureFolder} className="w-full mt-6 space-y-4">
                      <div className="w-full text-left">
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          {hasServerPin === false ? "Nouveau code (au moins 4 caractères)" : "Code secret"}
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={securePinInput}
                            onChange={(e) => {
                              setSecurePinInput(e.target.value);
                              setSecurePinError(null);
                            }}
                            placeholder={hasServerPin === false ? "Au moins 4 caractères..." : "Entrez votre code..."}
                            autoFocus
                            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-sm tracking-wider pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={showPassword ? "Masquer le code" : "Afficher le code"}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {hasServerPin === false && (
                        <div className="w-full text-left">
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
                            Confirmer le code
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={securePinConfirmInput}
                              onChange={(e) => {
                                setSecurePinConfirmInput(e.target.value);
                                setSecurePinError(null);
                              }}
                              placeholder="Retapez le code..."
                              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-sm tracking-wider"
                            />
                          </div>
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
                        disabled={isSubmittingPin}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:via-amber-500 hover:to-orange-500 disabled:opacity-50 text-black font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>{isSubmittingPin ? "Vérification..." : (hasServerPin === false ? "Enregistrer et déverrouiller" : "Déverrouiller le dossier")}</span>
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <>
                  {/* Barre supérieure : Filtres de catégorie & Compteur */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {[
                        { id: 'all' as const, label: 'Tous', count: secureCounts.all, icon: Layers },
                        { id: 'documents' as const, label: 'Documents', count: secureCounts.documents, icon: FileText },
                        { id: 'images' as const, label: 'Images', count: secureCounts.images, icon: ImageIcon },
                        { id: 'videos' as const, label: 'Vidéos', count: secureCounts.videos, icon: Film },
                        { id: 'audio' as const, label: 'Audio', count: secureCounts.audio, icon: Music },
                        { id: 'classeur' as const, label: 'Classeur', count: secureCounts.classeur, icon: FolderArchive },
                      ].map((cat) => {
                        const Icon = cat.icon;
                        const isCatSelected = secureCategoryFilter === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSecureCategoryFilter(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 border ${
                              isCatSelected
                                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                                : 'bg-[#182032] text-stone-300 border-white/10 hover:border-amber-400/50 hover:text-white'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{cat.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                              isCatSelected ? 'bg-stone-950/20 text-stone-950' : 'bg-black/40 text-stone-400'
                            }`}>
                              {cat.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-stone-400 shrink-0">
                      {displayedSecureFiles.length} fichier{displayedSecureFiles.length > 1 ? 's' : ''} protégé{displayedSecureFiles.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {displayedSecureFiles.length === 0 ? (
                    <div className="py-20 text-center text-stone-500 space-y-2">
                      <Lock className="w-12 h-12 mx-auto text-amber-400/40" />
                      <p className="text-sm font-bold text-stone-300">
                        {secureCategoryFilter === 'all'
                          ? 'Dossier sécurisé vide'
                          : `Aucun fichier ${secureCategoryFilter} dans le dossier sécurisé`}
                      </p>
                      <p className="text-xs text-stone-500">Déplacez des fichiers confidentiels ici avec le menu 3 traits</p>
                    </div>
                  ) : (
                    <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                      {displayedSecureFiles.map((file, idx) => {
                        const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase();
                        const isAudio = file.category === 'audio' || (file as any).isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext);
                        const isImage = file.category === 'images' || (file as any).isImage || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
                        const isVideo = file.category === 'videos' || (file as any).isVideo || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
                        const isClasseur = file.category === 'classeur' || file.category === 'notes' || (file as any).isFolder;

                        if (isImage) return renderImageCard(file, idx);
                        if (isVideo) return renderVideoCard(file, idx);
                        if (isAudio) return renderAudioCard(file, idx);
                        if (isClasseur) return renderClasseurCard(file, idx);
                        return renderDocumentCard(file, idx);
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ONGLET 10 : CORBEILLE */}
          {activeTab === 'trash' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-400">
                  {filteredTrash.length} élément{filteredTrash.length > 1 ? 's' : ''} dans la corbeille
                </span>
              </div>

              {filteredTrash.length === 0 ? (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <Trash2 className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-bold">La corbeille est vide</p>
                </div>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {filteredTrash.map((file, idx) => {
                    if (file.category === 'images' || (file as any).isImage) return renderImageCard(file, idx);
                    if (file.category === 'videos' || (file as any).isVideo) return renderVideoCard(file, idx);
                    if (file.category === 'audio' || (file as any).isAudio) return renderAudioCard(file, idx);
                    if (file.category === 'classeur') return renderClasseurCard(file, idx);
                    return renderDocumentCard(file, idx);
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* =========================================================================
            PANNEAU DE DROITE : LECTEUR / VISIONNEUSE DÉDIÉE (SPLIT SCREEN)
            ========================================================================= */}
        {viewerFile && (
          <div className={`flex flex-col bg-[#04060A] text-white animate-in fade-in duration-150 ${
            isViewerMaximized
              ? 'w-full flex-1 h-full min-h-[calc(100vh-140px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderReader(viewerFile)}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODALE DE RENOMMAGE DU FICHIER
          ========================================================================= */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F172A] border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white">Renommer le fichier</h3>
            <input
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-sm focus:border-cyan-400 outline-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingFile(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALE DÉTAILS & PROPRIÉTÉS
          ========================================================================= */}
      {detailsFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F172A] border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white">Propriétés du fichier</h3>
              <button
                type="button"
                onClick={() => setDetailsFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Nom :</span>
                <span className="font-bold text-white truncate max-w-[240px]">{detailsFile.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Taille :</span>
                <span className="font-bold text-white">{detailsFile.size}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Format :</span>
                <span className="font-bold text-orange-400 uppercase">{detailsFile.extension || detailsFile.category || 'DOC'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Emplacement :</span>
                <span className="font-bold text-cyan-400">{detailsFile.source || 'Espace Cloud StudyCloud'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Date :</span>
                <span className="font-bold text-white">{detailsFile.date || "Aujourd'hui"}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailsFile(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          NOTIFICATION TOAST FLOTTANTE
          ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-black/90 border border-white/20 shadow-2xl text-white text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
