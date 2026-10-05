import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  FileText,
  Search,
  Plus,
  Star,
  Share2,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Check,
  Menu,
  CheckSquare,
  Square,
  Link,
  Lock,
  Unlock,
  FolderInput,
  Copy,
  Pin,
  Pencil,
  AlertCircle,
  RotateCcw,
  FolderArchive
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore, isItemDeleted, markItemDeleted, unmarkItemDeleted } from '../services/cloudDataStore';
import { LocalSyncReplication } from '../services/localSyncReplication';
import { useDocumentsList } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob, getFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { DocumentCardPreview } from './DocumentCardPreview';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { PdfHorizontalViewer } from './PdfHorizontalViewer';
import { generatePdfThumbnail, setCachedMediaThumbnail } from '../services/mediaPreviewService';
import { ClasseurCreatedFolder, lightenColor } from './Folder3DModels';
import { HeaderMenuControls, applyFileSorting, type SortOption, parseSizeToBytes, isItemPinned } from './HeaderMenuControls';
import { validateFilesForMenuAsync, CATEGORY_LABELS, isWhatsAppAudio } from '../services/fileTypeValidator';
import { IncompatibleFormatModal, IncompatibleAlertInfo } from './IncompatibleFormatModal';
import { handleNativeShare } from '../utils/nativeShare';
import { computeSmartMenuStyle, useSmartContextMenuClose } from '../hooks/useContextMenuPosition';
import { ensureFileExtension } from '../utils/fileExtensionHelper';

interface DocumentsMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 o';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const computeDuplicateName = (originalName: string, existingNames: string[]): string => {
  const hasExt = originalName.includes('.');
  const ext = hasExt ? originalName.substring(originalName.lastIndexOf('.')) : '';
  const base = hasExt ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

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

// Récupération des styles de carte document en fonction de l'extension (Image 1)
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
    typeBadge: upper
  };
};

const isExcludedFromDocuments = (d: any): boolean => {
  if (!d) return true;
  if (d.category === 'mes-fichiers' || (d as any).uploadSource === 'mes-fichiers' || d.source === 'mes-fichiers' || d.source === 'Mes fichiers') return true;
  if (d.matiere || (d as any).matiereId) return true;
  if (d.r2Key && d.r2Key.includes('/mes-fichiers/')) return true;
  if (d.folderName && d.folderName !== 'Documents' && d.folderName !== 'root' && d.folderName !== 'default-folder') return true;
  return false;
};

export const DocumentsMenuView: React.FC<DocumentsMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { data: serverDocuments = [], isLoading: isDocumentsQueryLoading } = useDocumentsList();
  const [documentsList, setDocumentsList] = useState<FileItem[]>(() => {
    const raw = CloudDataStore.getState().documents || [];
    return raw.filter(d => !isExcludedFromDocuments(d));
  });
  const [loading, setLoading] = useState(true);

  // Pagination / Chargement par morceaux (24 documents par lot pour DOM ultra-léger et 0 OOM)
  const BATCH_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pdf' | 'cours' | 'td' | 'devoirs' | 'txt'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Lecteur de document actif (split à droite)
  const [selectedDoc, setSelectedDoc] = useState<FileItem | null>(null);
  const [splitResolvedPdfUrl, setSplitResolvedPdfUrl] = useState<string>('');
  const [docLayoutMode, setDocLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // État du menu 3 traits dédié à chaque document (Image 2)
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);

  // Mode sélection & éléments cochés
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [incompatibleAlertInfo, setIncompatibleAlertInfo] = useState<IncompatibleAlertInfo | null>(null);

  // Progression d'enregistrement et gestion d'erreurs en temps réel
  const [savingProgress, setSavingProgress] = useState<Record<string, number>>({});
  const [savingErrors, setSavingErrors] = useState<Record<string, string>>({});
  const savingIntervalsRef = useRef<Record<string, any>>({});

  // Modales de transfert (Déplacer / Créer une copie) vers le Classeur
  const [itemsToTransfer, setItemsToTransfer] = useState<FileItem[]>([]);
  const [isTransferPromptOpen, setIsTransferPromptOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'move' | 'copy'>('move');
  const [transferSelectedFolderIds, setTransferSelectedFolderIds] = useState<string[]>([]);
  const [transferNavFolderId, setTransferNavFolderId] = useState<string | null>(null);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [classeur3DFolders, setClasseur3DFolders] = useState<ClasseurCreatedFolder[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const duplicatingIdsRef = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fermeture intelligente du menu 3 traits (clic extérieur, défilement, Escape)
  useSmartContextMenuClose(Boolean(activeMenuDocId), () => setActiveMenuDocId(null));

  // Animation de progression d'enregistrement optimiste
  const startSavingAnimation = (ids: string[]) => {
    ids.forEach(id => {
      if (savingIntervalsRef.current[id]) {
        clearInterval(savingIntervalsRef.current[id]);
      }

      setSavingProgress(prev => ({ ...prev, [id]: 12 }));

      let current = 12;
      const interval = setInterval(() => {
        current += Math.floor(Math.random() * 8) + 4;
        if (current >= 92) {
          current = 92;
          clearInterval(interval);
          delete savingIntervalsRef.current[id];
        }

        setSavingProgress(prev => {
          if (prev[id] === undefined) return prev;
          const higher = Math.max(prev[id], current);
          return { ...prev, [id]: higher };
        });
      }, 300);

      savingIntervalsRef.current[id] = interval;
    });
  };

  // Écoute en temps réel de la file d'attente d'upload liée au Cloudflare Worker (D1/R2)
  useEffect(() => {
    const unsubscribe = UploadQueue.subscribe((queueState) => {
      const activeProg: Record<string, number> = {};
      const activeErrs: Record<string, string> = {};

      queueState.tasks.forEach(task => {
        if (task.category === 'documents' || task.id.startsWith('doc-')) {
          if (task.status === 'uploading' || task.status === 'pending') {
            activeProg[task.id] = Math.max(task.progress || 12, 12);
          } else if (task.status === 'completed') {
            activeProg[task.id] = 100;
            if (savingIntervalsRef.current[task.id]) {
              clearInterval(savingIntervalsRef.current[task.id]);
              delete savingIntervalsRef.current[task.id];
            }
          } else if (task.status === 'error') {
            activeErrs[task.id] = task.error || "Non enregistré sur le Cloud";
            if (savingIntervalsRef.current[task.id]) {
              clearInterval(savingIntervalsRef.current[task.id]);
              delete savingIntervalsRef.current[task.id];
            }
          }
        }
      });

      setSavingProgress(prev => {
        const next = { ...prev };
        Object.entries(activeProg).forEach(([id, pct]) => {
          if (pct >= 100) {
            next[id] = 100;
            setTimeout(() => {
              setSavingProgress(curr => {
                const clean = { ...curr };
                delete clean[id];
                return clean;
              });
            }, 400);
          } else {
            next[id] = Math.max(prev[id] || 0, pct);
          }
        });
        Object.keys(activeErrs).forEach(id => {
          delete next[id];
        });
        return next;
      });

      setSavingErrors(prev => {
        const next = { ...prev, ...activeErrs };
        queueState.tasks.forEach(task => {
          if ((task.status === 'uploading' || task.status === 'completed') && next[task.id]) {
            delete next[task.id];
          }
        });
        return next;
      });
    });

    return () => {
      unsubscribe();
      Object.values(savingIntervalsRef.current).forEach(int => clearInterval(int as any));
    };
  }, []);

  // Fonction universelle de fermeture du lecteur (ou réduction si agrandi)
  const handleCloseReader = () => {
    if (isViewerMaximized) {
      setIsViewerMaximized(false);
    } else {
      setSelectedDoc(null);
      setIsViewerMaximized(false);
    }
  };

  // Gestion de la touche Échap pour réduire ou fermer le lecteur de document
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isViewerMaximized) {
          setIsViewerMaximized(false);
        } else if (selectedDoc) {
          setSelectedDoc(null);
          setIsViewerMaximized(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerMaximized, selectedDoc]);

  // Effacer un document dont l'enregistrement a échoué (Bouton Croix X)
  const handleDismissFailedUpload = (docId: string) => {
    if (savingIntervalsRef.current[docId]) {
      clearInterval(savingIntervalsRef.current[docId]);
      delete savingIntervalsRef.current[docId];
    }
    UploadQueue.removeTask(docId);
    setSavingProgress(prev => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setSavingErrors(prev => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setDocumentsList(prev => prev.filter(d => d.id !== docId));
    CloudDataStore.removeFile(docId);
    deleteFileBlob(docId).catch(() => {});
    if (selectedDoc?.id === docId) {
      setSelectedDoc(null);
      setIsViewerMaximized(false);
    }
    showToast("Document non enregistré retiré.");
  };

  // Réessayer l'enregistrement d'un document échoué
  const handleRetryUpload = (docId: string) => {
    setSavingErrors(prev => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    startSavingAnimation([docId]);
    UploadQueue.retryTask(docId);
    showToast("Nouvelle tentative d'enregistrement...");
  };

  // Synchronisation continue ultra-légère avec TanStack Query
  useEffect(() => {
    if (serverDocuments && Array.isArray(serverDocuments)) {
      setDocumentsList(prev => {
        const cleanServer = serverDocuments.filter(d => !isItemDeleted(d.id) && !isExcludedFromDocuments(d));
        const serverIds = new Set(cleanServer.map(d => d.id));
        const pending = prev.filter(d => !serverIds.has(d.id) && Boolean(d.isUploading) && !isItemDeleted(d.id) && !isExcludedFromDocuments(d));
        const merged = [...pending, ...cleanServer];
        const seenIds = new Set<string>();
        const seenSigs = new Set<string>();
        return merged.filter(d => {
          if (seenIds.has(d.id)) return false;
          const sig = `${(d.name || '').trim().toLowerCase()}_${d.sizeBytes || d.size || 0}`;
          if (seenSigs.has(sig)) return false;
          seenIds.add(d.id);
          seenSigs.add(sig);
          return true;
        });
      });
      setLoading(false);
    }
  }, [serverDocuments]);

  // Résolution du Blob URL quand un document est sélectionné
  useEffect(() => {
    if (!selectedDoc) {
      setSplitResolvedPdfUrl('');
      return;
    }

    let isMounted = true;
    const isPdf =
      selectedDoc.extension === 'pdf' ||
      selectedDoc.name.toLowerCase().endsWith('.pdf') ||
      (selectedDoc.url && selectedDoc.url.toLowerCase().includes('.pdf')) ||
      Boolean(selectedDoc.type?.includes('pdf'));

    if (isPdf) {
      if (selectedDoc.url && !selectedDoc.url.startsWith('data:image')) {
        setSplitResolvedPdfUrl(selectedDoc.url);
      }
      if (selectedDoc.id) {
        getFileBlobUrl(selectedDoc.id)
          .then((blobUrl) => {
            if (isMounted && blobUrl) {
              setSplitResolvedPdfUrl(blobUrl);
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      isMounted = false;
    };
  }, [selectedDoc?.id, selectedDoc?.url]);

  // Navigation entre documents
  const handleNavigateDoc = (direction: 'prev' | 'next') => {
    if (filteredDocuments.length === 0) return;
    const currentIndex = selectedDoc
      ? filteredDocuments.findIndex(d => d.id === selectedDoc.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredDocuments.length - 1;
    if (newIndex >= filteredDocuments.length) newIndex = 0;
    const nextDoc = filteredDocuments[newIndex];
    if (nextDoc) {
      setSelectedDoc(nextDoc);
      setViewerZoom(1);
      setViewerRotation(0);
      setDocCurrentPage(1);
    }
  };

  // Import de documents : validation stricte par Magic Numbers (signature binaire infaillible)
  const handleImportDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const MAX_IMPORT_FILES = 10;
    let files = Array.from(e.target.files) as File[];
    if (files.length > MAX_IMPORT_FILES) {
      showToast(`⚠️ Limite de ${MAX_IMPORT_FILES} documents max à la fois : seuls les ${MAX_IMPORT_FILES} premiers sont importés.`);
      files = files.slice(0, MAX_IMPORT_FILES);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Validation stricte par Magic Numbers & signatures binaires réelles
    const { validFiles, rejectedFiles } = await validateFilesForMenuAsync(files, 'documents');

    if (rejectedFiles.length > 0) {
      const first = rejectedFiles[0];
      const isWa = isWhatsAppAudio(first.file.name, first.file.type);
      const detectedLabel = isWa ? 'Audio (WhatsApp / Vocal)' : (CATEGORY_LABELS[first.detectedCategory] || first.detectedCategory);

      // OUVERTURE IMMÉDIATE DU MODAL D'ALERTE ROUGE AU MILIEU DE L'ÉCRAN
      setIncompatibleAlertInfo({
        fileName: first.file.name,
        detectedCategory: detectedLabel,
        menuLabel: 'Documents',
        reason: first.reason,
      });

      if (validFiles.length === 0) {
        return; // Blocage total : aucun upload ni apparition
      }
    }

    if (validFiles.length === 0) return;
    files = validFiles;

    const newItems: FileItem[] = [];
    const newFiles: { file: File; id: string }[] = [];
    const now = Date.now();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'PDF' : 'PDF';
      const fileId = `doc-${now}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(f);

      // Sauvegarde immédiate du blob dans IndexedDB (0ms)
      storeFileBlob(fileId, f).catch(() => {});

      let docCat: FileItem['documentCategory'] = "PAS D'INF...";
      const lowerName = f.name.toLowerCase();
      if (lowerName.includes('cours') || lowerName.includes('chapitre') || lowerName.includes('leçon')) {
        docCat = 'COURS';
      } else if (lowerName.includes('td') || lowerName.includes('travaux')) {
        docCat = 'TD';
      } else if (lowerName.includes('devoir') || lowerName.includes('examen') || lowerName.includes('ds') || lowerName.includes('test')) {
        docCat = 'DEVOIRS';
      }

      const item: FileItem = {
        id: fileId,
        name: f.name,
        category: 'documents',
        source: 'Documents',
        documentCategory: docCat,
        size: formatBytes(f.size),
        sizeBytes: f.size,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
        extension: ext,
        url: localBlobUrl,
        previewUrl: localBlobUrl
      };

      newItems.push(item);
      newFiles.push({ file: f, id: fileId });
    }

    if (newItems.length === 0) return;

    // 1. AFFICHAGE IMMÉDIAT (0 milliseconde !)
    setDocumentsList(prev => [...newItems, ...prev]);

    // 2. Démarrage immédiat de la ligne de progression qui se remplit
    startSavingAnimation(newItems.map(it => it.id));

    // 2.5. Extraction immédiate de la vignette PDF si possible
    newFiles.forEach(({ file, id }) => {
      const isPdf = file.type?.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        generatePdfThumbnail(file, id).then(thumbUrl => {
          if (thumbUrl) {
            setCachedMediaThumbnail(id, thumbUrl);
            setDocumentsList(prev => prev.map(d => d.id === id ? { ...d, previewUrl: thumbUrl, thumbnailUrl: thumbUrl } : d));
            CloudDataStore.updateFile(id, { previewUrl: thumbUrl, thumbnailUrl: thumbUrl });
            CloudStorageAPI.saveMediaThumbnail(id, 'documents', thumbUrl, file.name).catch(() => {});
          }
        }).catch(() => {});
      }
    });

    // 3. Ajout optimiste dans CloudDataStore
    newItems.forEach(it => {
      CloudDataStore.addOptimisticFile(it as any);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast(`${newItems.length} document(s) ajouté(s) — Enregistrement en cours...`);

    // 4. Traitement asynchrone en arrière-plan : compression et UploadQueue
    (async () => {
      const itemsWithFiles = await Promise.all(
        newFiles.map(async ({ file, id }) => {
          let fileToSend: File | Blob = file;
          let origBytes = file.size;
          let origFormatted = formatBytes(file.size);

          try {
            const comp = await compressFile(file, 'documents');
            fileToSend = comp.file;
            origBytes = comp.originalSizeBytes;
            origFormatted = comp.originalSizeFormatted;
            if (comp.file !== file) {
              await storeFileBlob(id, comp.file as any).catch(() => {});
            }
          } catch (err) {
            console.warn('[DocumentsMenuView] Compression doc échouée, utilisation brute:', err);
          }

          const targetItem = newItems.find(it => it.id === id)!;
          const updatedItem = {
            ...targetItem,
            size: origFormatted,
            sizeBytes: origBytes
          };

          return {
            file: fileToSend,
            item: updatedItem,
            originalSizeBytes: origBytes,
            originalSizeFormatted: origFormatted
          };
        })
      );

      // Mise à jour des tailles réelles dans le store
      itemsWithFiles.forEach(({ item }) => {
        setDocumentsList(prev => prev.map(d => d.id === item.id ? { ...d, size: item.size, sizeBytes: item.sizeBytes } : d));
        CloudDataStore.updateFile(item.id, { size: item.size, sizeBytes: item.sizeBytes });
      });

      // Envoi vers UploadQueue
      UploadQueue.enqueueExisting(itemsWithFiles, { category: 'documents' });
    })();
  };

  // Favoris
  const handleToggleFavorite = async (doc: FileItem) => {
    const nextState = !doc.isFavorite;
    setDocumentsList(prev =>
      prev.map(d => (d.id === doc.id ? { ...d, isFavorite: nextState } : d))
    );
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(prev => (prev ? { ...prev, isFavorite: nextState } : null));
    }
    CloudDataStore.toggleFavorite(doc.id, nextState);
    if (nextState) {
      await CloudStorageAPI.addFavorite(doc.id, 'documents').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(doc.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
    setActiveMenuDocId(null);
  };

  // Renommer
  const handleRenameDocument = async (doc: FileItem) => {
    const newName = window.prompt('Nouveau nom du document :', doc.name);
    if (!newName || !newName.trim() || newName.trim() === doc.name) return;

    // Préservation systématique de l'extension technique (.pdf, etc.)
    const finalName = ensureFileExtension(newName.trim(), doc);
    if (finalName === doc.name) return;

    setDocumentsList(prev =>
      prev.map(d => (d.id === doc.id ? { ...d, name: finalName } : d))
    );
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(prev => (prev ? { ...prev, name: finalName } : null));
    }
    CloudDataStore.updateFile(doc.id, { name: finalName });
    await CloudStorageAPI.renameItem(doc.id, finalName, 'documents').catch(() => {});
    invalidateCloudQueries.documents().catch(() => {});
    invalidateCloudQueries.overview().catch(() => {});
    showToast(`Document renommé en "${finalName}" !`);
    setActiveMenuDocId(null);
  };

  // Déplacer vers la corbeille
  const handleDeleteDocument = async (doc: FileItem, skipConfirm: boolean = false) => {
    if (!skipConfirm && !window.confirm(`Déplacer "${doc.name}" dans la corbeille ?`)) return;

    markItemDeleted(doc.id);
    CloudDataStore.dismissRecent(doc.id);
    const fileWithSource: FileItem = {
      ...doc,
      isTrash: true,
      category: 'documents',
      sourceCategory: 'documents',
      source: 'Documents'
    };

    setDocumentsList(prev => prev.filter(d => d.id !== doc.id));
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(null);
      setIsViewerMaximized(false);
    }
    setSelectedItemIds(prev => prev.filter(id => id !== doc.id));

    CloudDataStore.moveToTrash(fileWithSource);
    LocalSyncReplication.recordLocalDeletion(doc.id, 'documents');
    await CloudStorageAPI.deleteDocument(doc.id, doc.name).catch(() => {});
    invalidateCloudQueries.documents().catch(() => {});
    invalidateCloudQueries.trash().catch(() => {});
    invalidateCloudQueries.overview().catch(() => {});
    showToast(`"${doc.name}" déplacé dans la corbeille 🗑️`);
    setActiveMenuDocId(null);
  };

  // Téléchargement
  const handleDownload = async (doc: FileItem) => {
    let url = doc.previewUrl || doc.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(doc.id);
    }
    if (!url) {
      showToast('Fichier introuvable');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Téléchargement de "${doc.name}"`);
  };

  // Partager (Partage normal WhatsApp, Web Share ou réseaux)
  const handleShare = (doc: FileItem) => {
    handleNativeShare(doc, showToast);
  };

  // Traitement universel des 12 actions du menu contextuel dédié (Image 2)
  const handleMenuAction = async (action: string, doc: FileItem) => {
    setActiveMenuDocId(null);

    switch (action) {
      case 'check': {
        setIsSelectionMode(true);
        setSelectedItemIds(prev =>
          prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
        );
        break;
      }

      case 'check_all': {
        const allIds = filteredDocuments.map(d => d.id);
        const isAllChecked = allIds.length > 0 && selectedItemIds.length >= allIds.length;
        if (isAllChecked) {
          setSelectedItemIds([]);
          setIsSelectionMode(false);
        } else {
          setIsSelectionMode(true);
          setSelectedItemIds(allIds);
        }
        break;
      }

      case 'download': {
        await handleDownload(doc);
        break;
      }

      case 'delete': {
        await handleDeleteDocument(doc);
        break;
      }

      case 'share': {
        handleShare(doc);
        break;
      }

      case 'create_link': {
        if (onOpenCreateShareLink) {
          onOpenCreateShareLink([{
            id: doc.id,
            name: doc.name,
            size: doc.sizeBytes || 0,
            type: doc.extension || 'PDF',
            url: doc.previewUrl || doc.url,
            category: 'documents',
            extension: doc.extension,
            r2Key: (doc as any).r2Key || (doc as any).r2_key,
            file: (doc as any).file,
          }]);
        } else {
          const link = `${window.location.origin}${window.location.pathname}#doc-${doc.id}`;
          try {
            await navigator.clipboard?.writeText(link);
            showToast('Lien copié dans le presse-papiers !');
          } catch {
            showToast(`Lien créé pour "${doc.name}"`);
          }
        }
        break;
      }

      case 'lock_file': {
        const securedFile: FileItem = {
          ...doc,
          isSecure: true,
          originalCategory: 'documents',
          originalSource: doc.source || 'Documents',
          source: 'Dossier Sécurisé'
        };
        setDocumentsList(prev => prev.filter(d => d.id !== doc.id));
        if (selectedDoc?.id === doc.id) {
          setSelectedDoc(null);
          setIsViewerMaximized(false);
        }
        CloudDataStore.moveToSecure(securedFile as any);
        CloudStorageAPI.moveToSecureFolder(doc, 'documents').catch(console.error);
        invalidateCloudQueries.documents();
        invalidateCloudQueries.secure();
        showToast(`"${doc.name}" verrouillé dans le dossier sécurisé !`);
        break;
      }

      case 'move': {
        const items = isSelectionMode && selectedItemIds.includes(doc.id) && selectedItemIds.length > 1
          ? filteredDocuments.filter(f => selectedItemIds.includes(f.id))
          : [doc];
        setItemsToTransfer(items);
        setTransferSelectedFolderIds([]);
        setTransferNavFolderId(null);
        setTransferSearchQuery('');
        setIsTransferPromptOpen(true);
        break;
      }

      case 'duplicate': {
        if (duplicatingIdsRef.current.has(doc.id)) {
          return;
        }
        duplicatingIdsRef.current.add(doc.id);
        setTimeout(() => {
          duplicatingIdsRef.current.delete(doc.id);
        }, 1200);

        const existingNames = documentsList.map(d => d.name);
        const newName = computeDuplicateName(doc.name, existingNames);
        const newDocId = `doc-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newDoc: FileItem = {
          ...doc,
          id: newDocId,
          name: newName,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          isPinned: false
        };
        unmarkItemDeleted(newDocId);
        setDocumentsList(prev => [newDoc, ...prev.filter(d => d.id !== newDocId)]);
        CloudDataStore.addOptimisticFile(newDoc);
        LocalSyncReplication.recordLocalUpsert(newDoc.id, 'documents', newDoc);

        // Cloner le blob IndexedDB de manière indépendante pour éviter toute suppression partagée
        getFileBlob(doc.id).then(blob => {
          if (blob) storeFileBlob(newDocId, blob).catch(() => {});
        }).catch(() => {});

        CloudStorageAPI.duplicateItem(doc.id, 'documents', undefined, newName, newDocId).then((serverData) => {
          if (serverData && serverData.id && serverData.id !== newDocId) {
            const realId = serverData.id;
            unmarkItemDeleted(realId);
            CloudDataStore.reconcileFileId(newDocId, realId);
            setDocumentsList(prev => prev.map(d => d.id === newDocId ? { ...d, id: realId } : d));
            getFileBlob(newDocId).then(b => {
              if (b) {
                storeFileBlob(realId, b).catch(() => {});
                deleteFileBlob(newDocId).catch(() => {});
              }
            }).catch(() => {});
            LocalSyncReplication.recordLocalUpsert(realId, 'documents', { ...newDoc, id: realId });
          }
          invalidateCloudQueries.documents().catch(() => {});
          invalidateCloudQueries.overview().catch(() => {});
        }).catch(console.error);
        showToast(`Document dupliqué : "${newName}" !`);
        break;
      }

      case 'favorite': {
        await handleToggleFavorite(doc);
        break;
      }

      case 'pin': {
        const currentlyPinned = isItemPinned(doc);
        const nextPinned = !currentlyPinned;

        // 1. Sauvegarde synchrone dans localStorage
        try {
          const rawLocal = localStorage.getItem('studycloud_pinned_ids');
          let pinnedIds: string[] = [];
          if (rawLocal) pinnedIds = JSON.parse(rawLocal);
          if (!Array.isArray(pinnedIds)) pinnedIds = [];
          if (nextPinned) {
            if (!pinnedIds.includes(doc.id)) pinnedIds.push(doc.id);
          } else {
            pinnedIds = pinnedIds.filter(id => id !== doc.id);
          }
          localStorage.setItem('studycloud_pinned_ids', JSON.stringify(pinnedIds));
        } catch {}

        // 2. Mise à jour de l'état local
        setDocumentsList(prev => {
          const updated = prev.map(d => (d.id === doc.id ? { ...d, isPinned: nextPinned } : d));
          return updated;
        });

        // 3. Mise à jour du store et de l'API
        CloudDataStore.togglePin(doc.id, nextPinned);
        CloudDataStore.updateFile(doc.id, { isPinned: nextPinned });

        if (nextPinned) {
          CloudStorageAPI.addPinned(doc.id, 'documents').catch(console.error);
          showToast(`"${doc.name}" épinglé en tête !`);
        } else {
          CloudStorageAPI.removePinned(doc.id).catch(console.error);
          showToast(`"${doc.name}" désépinglé`);
        }
        break;
      }

      case 'rename': {
        await handleRenameDocument(doc);
        break;
      }

      default:
        break;
    }
  };

  // Exécution du transfert (Déplacer ou Copier) vers les dossiers sélectionnés du Classeur
  const handleExecuteTransfer = async () => {
    if (transferSelectedFolderIds.length === 0 || itemsToTransfer.length === 0 || isTransferring) return;
    setIsTransferring(true);

    try {
      await CloudStorageAPI.moveOrCopyItems(itemsToTransfer, transferSelectedFolderIds, transferMode);

      if (transferMode === 'move') {
        const idsToRemove = new Set(itemsToTransfer.map(i => i.id));
        setDocumentsList(prev => prev.filter(d => !idsToRemove.has(d.id)));
        CloudDataStore.setDocuments(documentsList.filter(d => !idsToRemove.has(d.id)) as any);

        setSelectedItemIds(prev => prev.filter(id => !idsToRemove.has(id)));
        if (selectedItemIds.length <= itemsToTransfer.length) {
          setIsSelectionMode(false);
        }
        if (selectedDoc && idsToRemove.has(selectedDoc.id)) {
          setSelectedDoc(null);
          setIsViewerMaximized(false);
        }
      }

      const successMsg = transferMode === 'move'
        ? `${itemsToTransfer.length} document(s) déplacé(s) avec succès !`
        : `${itemsToTransfer.length} document(s) copié(s) avec succès !`;
      showToast(successMsg);

      setIsTransferModalOpen(false);
      setTransferSelectedFolderIds([]);
      setTransferNavFolderId(null);
      setTransferSearchQuery('');
      setItemsToTransfer([]);
    } catch (err: any) {
      console.error('Erreur lors du transfert:', err);
      showToast('Erreur lors du traitement du transfert');
    } finally {
      setIsTransferring(false);
    }
  };

  // Modal Prompt : choix entre "Déplacer" et "Créer une copie"
  const renderTransferPromptModal = () => {
    if (!isTransferPromptOpen) return null;

    const count = itemsToTransfer.length;
    const titleText = count === 1 
      ? `Que souhaitez-vous faire avec "${itemsToTransfer[0]?.name}" ?`
      : `Que souhaitez-vous faire avec ces ${count} documents ?`;

    const content = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 pointer-events-auto select-none"
        onClick={() => setIsTransferPromptOpen(false)}
      >
        <div 
          className="relative w-full max-w-[420px] bg-[#0A0F1D] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.1)] text-white animate-in zoom-in-95 duration-150 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
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
                  Transfère {count > 1 ? 'ces documents' : 'ce document'} vers le(s) dossier(s) choisi(s) et le retire d'ici.
                </p>
              </div>
            </button>

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
                  Garde l'original intact dans le menu Documents et ajoute une copie dans le(s) dossier(s) choisi(s).
                </p>
              </div>
            </button>
          </div>

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

  // Modal de sélection du dossier récepteur dans le Classeur
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

    const isSelectionActive = transferSelectedFolderIds.length > 0;

    const content = (
      <div 
        className="fixed inset-0 z-[2700] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 pointer-events-auto select-none"
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

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                {transferSelectedFolderIds.length} dossier{transferSelectedFolderIds.length > 1 ? 's' : ''} coché{transferSelectedFolderIds.length > 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-semibold flex items-center gap-1.5">
                {itemsToTransfer.length} document{itemsToTransfer.length > 1 ? 's' : ''} à {transferMode === 'move' ? 'déplacer' : 'copier'}
              </span>
            </div>

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

                      <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-200 transition-colors">
                        {folder.name}
                      </span>
                    </div>

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
                  ? transferMode === 'move'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-amber-500/20 active:scale-95'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-emerald-500/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              {isTransferring ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Transfert en cours...</span>
                </>
              ) : (
                <>
                  {transferMode === 'move' ? <FolderInput className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {transferMode === 'move' ? 'Déplacer ici' : 'Copier ici'} ({transferSelectedFolderIds.length})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
  };

  // Calcul dynamique de l'espace occupé par les documents
  const totalDocsBytes = useMemo(() => {
    return (documentsList || []).reduce((acc, f) => acc + parseSizeToBytes(f?.size, f?.sizeBytes), 0);
  }, [documentsList]);

  const formattedDocsSize = useMemo(() => {
    if (totalDocsBytes > 0) {
      if (totalDocsBytes < 1024) return `${totalDocsBytes} o`;
      if (totalDocsBytes < 1024 * 1024) return `${(totalDocsBytes / 1024).toFixed(1)} Ko`;
      if (totalDocsBytes < 1024 * 1024 * 1024) return `${(totalDocsBytes / (1024 * 1024)).toFixed(1)} Mo`;
      return `${(totalDocsBytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
    }
    return '0 Mo';
  }, [totalDocsBytes]);

  // Filtrage et tri des documents
  const filteredDocuments = useMemo(() => {
    let list = (documentsList || []).filter(d => !isItemDeleted(d.id));
    const seenIds = new Set<string>();
    const seenSigs = new Set<string>();
    list = list.filter(d => {
      if (seenIds.has(d.id)) return false;
      const sig = `${(d.name || '').trim().toLowerCase()}_${d.sizeBytes || d.size || 0}`;
      if (seenSigs.has(sig)) return false;
      seenIds.add(d.id);
      seenSigs.add(sig);
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    if (activeFilter === 'pdf') {
      list = list.filter(d => (d.extension || '').toLowerCase() === 'pdf');
    } else if (activeFilter === 'cours') {
      list = list.filter(d => d.documentCategory === 'COURS');
    } else if (activeFilter === 'td') {
      list = list.filter(d => d.documentCategory === 'TD');
    } else if (activeFilter === 'devoirs') {
      list = list.filter(d => d.documentCategory === 'DEVOIRS');
    } else if (activeFilter === 'txt') {
      list = list.filter(d => ['txt', 'md'].includes((d.extension || '').toLowerCase()));
    }

    return applyFileSorting(list, sortOption);
  }, [documentsList, searchQuery, activeFilter, sortOption]);

  // =========================================================================
  // RENDU DU MENU 3 TRAITS DÉDIÉ ET INDÉPENDANT POUR CHAQUE DOCUMENT (IMAGE 2)
  // =========================================================================
  const renderDocumentOptionsMenu = (doc: FileItem, triggerEl?: HTMLElement | null) => {
    const isChecked = selectedItemIds.includes(doc.id);
    const isAllChecked = filteredDocuments.length > 0 && selectedItemIds.length >= filteredDocuments.length;

    // Calcul intelligent de la position : évite tout chevauchement sidebar/viewport
    const el = triggerEl || (typeof document !== 'undefined' ? document.getElementById(`doc-menu-trigger-${doc.id}`) : null);
    const rect = el?.getBoundingClientRect();
    const smartStyle = computeSmartMenuStyle(rect, 420);

    return createPortal(
      <div 
        className="studycloud-file-menu-panel bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(59,130,246,0.25)] text-slate-200 rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        style={smartStyle.style}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de menu dédié avec nom du fichier et bouton fermeture (Image 2) */}
        <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white truncate" title={doc.name}>
              {doc.name}
            </p>
            <p className="text-[9px] font-semibold text-slate-400">
              {doc.size || 'Document'} • <span className="uppercase text-amber-400">{doc.extension || 'PDF'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuDocId(null);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste déroulante des 12 options avec défilement fluide garanti (Image 2) */}
        <div className="max-h-[min(380px,calc(100vh-140px))] overflow-y-auto no-scrollbar py-1 divide-y divide-white/5">
          {/* Section 1 : Sélection (Cocher, Tout cocher, Télécharger) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleMenuAction('check', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{isChecked ? 'Décocher' : 'Cocher'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('check_all', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{isAllChecked ? 'Tout décocher' : 'Tout cocher'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('download', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-sky-400 hover:bg-sky-500/15 transition-colors cursor-pointer text-left"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Télécharger</span>
            </button>
          </div>

          {/* Section 2 : Actions principales de gestion */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleMenuAction('delete', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Supprimer le fichier</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('share', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              <span>Partager</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('create_link', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Link className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span>Créer un lien</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('lock_file', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer text-left"
              title="Verrouiller ce document dans le dossier sécurisé"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Verrouiller</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('move', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <FolderInput className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Le déplacer</span>
            </button>
          </div>

          {/* Section 3 : Organisation & Édition */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleMenuAction('duplicate', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Copy className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Dupliquer</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('favorite', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${doc.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-400'}`} />
              <span>{doc.isFavorite ? 'Retirer des favoris' : 'Ajouter au favoris'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('pin', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pin className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>{isItemPinned(doc) ? 'Désépingler' : 'Épinglez'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleMenuAction('rename', doc)}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0 text-teal-400" />
              <span>Modifier le nom</span>
            </button>
          </div>
        </div>
      </div>
    , document.body);
  };

  // =========================================================================
  // RENDU D'UNE CARTE DOCUMENT (IMAGE 1 & 2 AVEC SUIVI ENREGISTREMENT ET ERREUR)
  // =========================================================================
  const renderDocumentCard = (doc: FileItem, index: number) => {
    const theme = getDocumentTheme(doc.extension || 'PDF');
    const isSelected = selectedDoc?.id === doc.id;
    const isMenuOpen = activeMenuDocId === doc.id;
    const isChecked = selectedItemIds.includes(doc.id);

    // Suivi d'enregistrement temps réel lié au Worker R2/D1
    const isSaving = savingProgress[doc.id] !== undefined;
    const progressVal = savingProgress[doc.id] || 0;
    const saveError = savingErrors[doc.id];
    const hasFailed = Boolean(saveError);

    return (
      <div
        key={doc.id}
        style={{ background: theme.bg }}
        onClick={() => {
          if (hasFailed) {
            showToast("Enregistrement échoué. Utilisez la croix pour effacer ou le bouton Réessayer.");
            return;
          }
          if (isSaving) {
            showToast("Enregistrement du document en cours... Veuillez patienter.");
            return;
          }
          if (isSelectionMode) {
            setActiveMenuDocId(null);
            const next = isChecked
              ? selectedItemIds.filter(id => id !== doc.id)
              : [...selectedItemIds, doc.id];
            setSelectedItemIds(next);
            if (next.length === 0) setIsSelectionMode(false);
          } else {
            setSelectedDoc(doc);
          }
        }}
        className={`aspect-[3/4] ${theme.border} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none ${
          hasFailed
            ? 'border-rose-500 ring-4 ring-rose-500/50 shadow-2xl bg-rose-950/40 cursor-default'
            : isSaving
              ? 'border-emerald-500/40 cursor-wait'
              : isChecked
                ? 'ring-4 ring-amber-400 shadow-2xl scale-[1.02] cursor-pointer'
                : isSelected
                  ? 'ring-4 ring-white shadow-2xl scale-[1.02] cursor-pointer'
                  : 'hover:scale-[1.01] shadow-md cursor-pointer active:scale-98'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
      >
        {/* 1. Trait en haut collé au document qui se remplit pendant l'enregistrement */}
        {isSaving && !hasFailed && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/40 z-35 overflow-hidden pointer-events-none rounded-t-2xl">
            <div 
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_#34d399]"
              style={{ width: `${progressVal}%` }}
            />
          </div>
        )}
        {hasFailed && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-500 z-35 overflow-hidden pointer-events-none rounded-t-2xl shadow-[0_0_10px_#f43f5e]" />
        )}

        {/* 2. Overlay d'enregistrement au centre */}
        {isSaving && !hasFailed && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-white pointer-events-none animate-in fade-in rounded-2xl">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin mb-1.5" />
            <span className="text-[10px] font-black text-emerald-300 tracking-wider">
              {progressVal}%
            </span>
            <span className="text-[8px] font-bold text-white/90 text-center leading-tight">
              Enregistrement Cloud...
            </span>
            <span className="text-[7.5px] text-emerald-400/80 mt-0.5 font-mono">
              Worker R2 en direct
            </span>
          </div>
        )}

        {/* 3. Overlay d'échec rouge avec bouton croix (X) pour effacer et Réessayer */}
        {hasFailed && (
          <div className="absolute inset-0 z-30 bg-rose-950/92 backdrop-blur-[3px] border border-rose-500/50 flex flex-col items-center justify-between p-2.5 text-white rounded-2xl animate-in fade-in duration-200">
            <div className="w-full flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-rose-300 bg-rose-900/70 px-2 py-0.5 rounded-full border border-rose-500/40">
                Non enregistré
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissFailedUpload(doc.id);
                }}
                className="w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                title="Effacer le document non enregistré (Croix)"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center my-auto px-1">
              <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-1 shadow-md">
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-rose-200 leading-tight">
                Échec d'enregistrement
              </p>
              <p className="text-[8.5px] text-rose-300/85 line-clamp-2 mt-0.5 leading-snug">
                {saveError || "Fichier non enregistré sur le Cloud"}
              </p>
            </div>

            <div className="w-full flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetryUpload(doc.id);
                }}
                className="flex-1 py-1 px-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Réessayer l'enregistrement"
              >
                <RotateCcw className="w-3 h-3 text-emerald-400" />
                <span>Réessayer</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissFailedUpload(doc.id);
                }}
                className="py-1 px-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Effacer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Effacer</span>
              </button>
            </div>
          </div>
        )}

        {/* Barre supérieure : Bouton 3 traits, Checkbox (en mode sélection) & Taille */}
        <div className="flex items-center justify-between gap-1 z-20 relative">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-menu-trigger">
              <button
                type="button"
                ref={(el) => { if (isMenuOpen && el) (el as any)._menuTrigger = el; }}
                id={`doc-menu-trigger-${doc.id}`}
                disabled={isSelectionMode || selectedItemIds.length > 0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelectionMode || selectedItemIds.length > 0) return;
                  setActiveMenuDocId(isMenuOpen ? null : doc.id);
                }}
                className={`p-1 sm:p-1.2 rounded-lg bg-black/40 text-white border border-white/20 transition-all flex items-center justify-center shadow-sm ${
                  isSelectionMode || selectedItemIds.length > 0
                    ? 'opacity-20 cursor-not-allowed pointer-events-none'
                    : 'hover:bg-black/70 cursor-pointer active:scale-90'
                }`}
                title={isSelectionMode || selectedItemIds.length > 0 ? "Menu désactivé en mode sélection" : "Options du fichier (3 traits)"}
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>

              {isMenuOpen && !isSelectionMode && selectedItemIds.length === 0 && renderDocumentOptionsMenu(doc, document.getElementById(`doc-menu-trigger-${doc.id}`))}
            </div>

            {/* Case à cocher visible en mode sélection */}
            {isSelectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuDocId(null);
                  handleMenuAction('check', doc);
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
            {(doc.isPinned || isItemPinned(doc)) && (
              <span className="p-0.5 rounded bg-black/60 text-purple-300 border border-purple-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Épinglé">
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

        {/* Pied de carte : typeBadge et bouton télécharger */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(doc);
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

  // Rendu du lecteur de document dédié (Image 3)
  const renderDocumentReader = (file: FileItem) => {
    const isPdf =
      file.extension === 'pdf' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      (file.url && file.url.toLowerCase().includes('.pdf')) ||
      Boolean(file.type?.includes('pdf'));
    const pdfUrl = splitResolvedPdfUrl || file.url || '';
    const cleanPdfBase = pdfUrl.split('#')[0];
    const nativePdfUrl = cleanPdfBase ? cleanPdfBase + '#toolbar=1&navpanes=0&view=FitH' : '';

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur document (Image 3) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateDoc('prev')}
              className="p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              title="Document précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateDoc('next')}
              className="p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              title="Document suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate">
                {file.size} • <span className="uppercase text-blue-400">{file.extension || 'PDF'}</span>
              </p>
            </div>
          </div>

          {/* Outils du lecteur à droite */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isPdf && (
              <>
                <button
                  type="button"
                  onClick={() => setDocLayoutMode(m => m === 'vertical' ? 'horizontal' : 'vertical')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all cursor-pointer shadow-sm active:scale-95 ${
                    docLayoutMode === 'vertical'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-400/50 hover:bg-blue-600/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30'
                  }`}
                  title={docLayoutMode === 'vertical' ? "Défilement vertical actif (Cliquer pour passer en horizontal)" : "Mode horizontal actif (Cliquer pour passer en défilement vertical)"}
                >
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${docLayoutMode === 'vertical' ? 'rotate-90 text-blue-400' : 'text-amber-400'}`} />
                  <span className="text-[11px] font-bold hidden sm:inline">
                    {docLayoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}
                  </span>
                </button>

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
              <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => handleShare(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDownload(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(file, 'Documents', documentsList)}
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
              title={isViewerMaximized ? 'Réduire la vue' : "Agrandir dans l'espace"}
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

        {/* Corps du Document (Image 3) */}
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
            ) : nativePdfUrl ? (
              <div className="w-full h-full flex-1 flex flex-col items-center overflow-hidden bg-stone-100 dark:bg-stone-900">
                <object
                  key={`pdf-native-${file.id || cleanPdfBase}`}
                  data={nativePdfUrl}
                  type="application/pdf"
                  className="w-full h-full border-0 block flex-1"
                  style={{ width: '100%', height: '100%' }}
                >
                  <iframe
                    key={`iframe-pdf-native-${file.id || cleanPdfBase}`}
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

  return (
    <div className="w-full h-full flex flex-col bg-stone-50 dark:bg-[#070B14] overflow-hidden select-none">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-black/90 text-white border border-white/20 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Input de sélection de fichier */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportDocuments}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.rtf"
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU DOCUMENTS */}
      <header className="sticky top-0 z-30 w-full bg-white backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-200 shadow-sm">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Retour et Titre */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isViewerMaximized) {
                  setIsViewerMaximized(false);
                } else if (selectedDoc) {
                  setSelectedDoc(null);
                  setIsViewerMaximized(false);
                } else {
                  onBack();
                }
              }}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title={isViewerMaximized ? "Réduire la vue" : selectedDoc ? "Fermer le document" : "Retour"}
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">{isViewerMaximized ? "Réduire" : "Retour"}</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-blue-400">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 leading-tight">
                  Documents
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 leading-tight">
                  {documentsList.length} document{documentsList.length > 1 ? 's' : ''} • {formattedDocsSize}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Documents..."
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

          {/* DROITE : Espace d'étude & + Importer */}
          <div className="shrink-0 flex items-center gap-2">
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(selectedDoc || undefined, 'Documents', documentsList)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#101827] text-emerald-400 border border-emerald-500/30 transition-all font-bold text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Espace d'étude</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-blue-400 border border-blue-500/40 hover:border-blue-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer un document"
            >
              <Plus className="w-4 h-4 text-blue-400 stroke-[2.5]" />
              <span>+ Importer</span>
            </button>

            {/* Bouton Plein écran (entouré en rouge) + Bouton 3 traits derrière lui */}
            <HeaderMenuControls
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />
          </div>
        </div>
      </header>

      {/* DISPOSITION SPLIT (IMAGE 3) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES DOCUMENTS */}
        <div className={`overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
          isViewerMaximized && selectedDoc
            ? 'hidden'
            : selectedDoc
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
              : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
        }`}>
          <div className="space-y-3 sm:space-y-4">
            {/* Ligne d'en-tête de la liste */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} disponible{filteredDocuments.length > 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-stone-400">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Chargement des documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                {sortOption === 'pinned' ? (
                  <Pin className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-amber-400" />
                ) : sortOption === 'duplicates' ? (
                  <Copy className="w-12 h-12 mx-auto mb-3 opacity-40 stroke-[1.5] text-rose-400" />
                ) : (
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-blue-400" />
                )}
                <p className={`text-sm font-semibold ${sortOption === 'pinned' ? 'text-amber-400' : sortOption === 'duplicates' ? 'text-rose-400' : ''}`}>
                  {sortOption === 'pinned'
                    ? 'Aucun document épinglé'
                    : sortOption === 'duplicates'
                    ? 'Aucun résultat pour les doublons'
                    : 'Aucun document disponible'}
                </p>
                <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                  {sortOption === 'pinned'
                    ? 'Vous n\'avez pas encore de documents épinglés. Utilisez l\'option "Épinglez" dans le menu à 3 traits pour en épingler.'
                    : sortOption === 'duplicates'
                    ? 'Tous vos documents sont uniques dans la base de données. Aucun doublon détecté.'
                    : 'Ce dossier ne contient aucun document pour le moment.'}
                </p>
                {(sortOption === 'duplicates' || sortOption === 'pinned') && (
                  <button
                    type="button"
                    onClick={() => setSortOption('recent')}
                    className={`mt-3 px-4 py-1.5 rounded-full text-white text-xs font-bold transition-all shadow-sm cursor-pointer ${
                      sortOption === 'pinned' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    Afficher tous les documents
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* GRILLE DES CARTES DE DOCUMENTS (IMAGE 1) */}
                <div className={`grid gap-2.5 sm:gap-3.5 ${
                  selectedDoc
                    ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                }`}>
                  {filteredDocuments.slice(0, visibleCount).map((doc, idx) => renderDocumentCard(doc, idx))}
                </div>

                {visibleCount < filteredDocuments.length && (
                  <div className="pt-4 pb-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount(c => c + 24)}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      Charger plus de documents ({filteredDocuments.length - visibleCount} restants)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* PANNEAU DE DROITE : LECTEUR DOCUMENT DÉDIÉ (IMAGE 3) */}
        {selectedDoc && (
          <div className={`flex flex-col bg-[#04060A] animate-in fade-in duration-150 ${
            isViewerMaximized && selectedDoc
              ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderDocumentReader(selectedDoc)}
          </div>
        )}
      </div>

      {/* BARRE D'ACTIONS FLOTTANTE EN MODE SÉLECTION */}
      {isSelectionMode && selectedItemIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0A0E1A]/95 backdrop-blur-md border border-blue-500/40 rounded-full px-4 sm:px-6 py-2.5 shadow-2xl flex items-center gap-3 sm:gap-4 text-white text-xs sm:text-sm animate-in slide-in-from-bottom-4 duration-200">
          <span className="font-bold text-blue-300">
            {selectedItemIds.length} sélectionné{selectedItemIds.length > 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => {
              const toDownload = filteredDocuments.filter(d => selectedItemIds.includes(d.id));
              toDownload.forEach(handleDownload);
            }}
            className="flex items-center gap-1.5 hover:text-blue-400 font-semibold cursor-pointer transition-colors"
            title="Télécharger la sélection"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          {onOpenCreateShareLink && (
            <button
              type="button"
              onClick={() => {
                const items = filteredDocuments.filter(d => selectedItemIds.includes(d.id));
                if (items.length > 0) {
                  onOpenCreateShareLink(items.map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    size: doc.sizeBytes || 0,
                    type: doc.extension || 'PDF',
                    url: doc.previewUrl || doc.url,
                    category: 'documents',
                    extension: doc.extension,
                    r2Key: (doc as any).r2Key || (doc as any).r2_key,
                    file: (doc as any).file,
                  })));
                  setSelectedItemIds([]);
                  setIsSelectionMode(false);
                }
              }}
              className="flex items-center gap-1.5 hover:text-sky-400 font-semibold cursor-pointer transition-colors"
              title="Créer un lien de partage pour la sélection"
            >
              <Link className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Créer un lien</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const items = filteredDocuments.filter(d => selectedItemIds.includes(d.id));
              setItemsToTransfer(items);
              setTransferSelectedFolderIds([]);
              setTransferNavFolderId(null);
              setTransferSearchQuery('');
              setIsTransferPromptOpen(true);
            }}
            className="flex items-center gap-1.5 hover:text-amber-400 font-semibold cursor-pointer transition-colors"
            title="Déplacer ou copier la sélection"
          >
            <FolderInput className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Déplacer/Copier</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Déplacer les ${selectedItemIds.length} document(s) sélectionné(s) dans la corbeille ?`)) return;
              const toDelete = filteredDocuments.filter(d => selectedItemIds.includes(d.id));
              const trashedItems: FileItem[] = toDelete.map(doc => ({
                ...doc,
                isTrash: true,
                category: 'documents',
                sourceCategory: 'documents',
                source: 'Documents'
              }));
              toDelete.forEach(d => {
                markItemDeleted(d.id);
                CloudDataStore.dismissRecent(d.id);
                LocalSyncReplication.recordLocalDeletion(d.id, 'documents');
                CloudStorageAPI.deleteDocument(d.id, d.name).catch(() => {});
              });
              setDocumentsList(prev => prev.filter(d => !selectedItemIds.includes(d.id)));
              if (selectedDoc && selectedItemIds.includes(selectedDoc.id)) {
                setSelectedDoc(null);
                setIsViewerMaximized(false);
              }
              setSelectedItemIds([]);
              setIsSelectionMode(false);
              CloudDataStore.moveToTrash(trashedItems);
              invalidateCloudQueries.documents().catch(() => {});
              invalidateCloudQueries.trash().catch(() => {});
              invalidateCloudQueries.overview().catch(() => {});
              showToast(`${toDelete.length} document(s) déplacé(s) dans la corbeille 🗑️`);
            }}
            className="flex items-center gap-1.5 hover:text-rose-400 font-semibold cursor-pointer transition-colors"
            title="Déplacer la sélection dans la corbeille"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedItemIds([]);
              setIsSelectionMode(false);
            }}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Annuler la sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modales de transfert vers le Classeur 3D */}
      {renderTransferPromptModal()}
      {renderTransferFolderModal()}

      {/* MODAL FORMAT NON COMPATIBLE AU MILIEU DE L'ÉCRAN */}
      <IncompatibleFormatModal 
        info={incompatibleAlertInfo} 
        onClose={() => setIncompatibleAlertInfo(null)} 
      />
    </div>
  );
};
