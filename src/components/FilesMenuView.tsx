import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Edit3, ArrowLeft, Upload, File, Folder, Check, MoreVertical, X, Search, Copy, Plus, Download, Link as LinkIcon, Globe, Eye, EyeOff, Menu, Star } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob, getFileBlob, MAX_FILE_SIZE_BYTES, formatFileSize } from '../services/localFileStorage';
import { persistRawFile } from './PublishFileView';
import { UploadQueue } from '../services/uploadQueue';
import { CloudDataStore } from '../services/cloudDataStore';
import { ImageCardPreview } from './ImageCardPreview';
import { DocumentCardPreview } from './DocumentCardPreview';
import { getCurrentUserId } from '../services/userSync';
import { useFilesMenuList, useMatieresList } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { safeLocalStorageSet, safeLocalStorageGet } from '../utils/safeStorage';
import { validateFilesForMesFichiersAsync } from '../services/fileTypeValidator';
import { IncompatibleFormatModal, IncompatibleAlertInfo } from './IncompatibleFormatModal';

interface FilesMenuViewProps {
  onBack: () => void;
  onImportFile?: () => void;
  setActivePreviewItem?: (item: any) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
  onPublishFiles?: (files: any[]) => void;
  initialMatiere?: string;
}

export interface ImportedItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension?: string;
  url?: string;
  r2Key?: string;
  isImage?: boolean;
  matiere?: string;
  matiereId?: string;
  folderName?: string;
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

// Récupération du thème graphique selon l'extension pour l'aperçu document (style Documents Image 2)
export const getDocumentTheme = (ext: string = 'PDF') => {
  const upper = (ext || 'FICHIER').toUpperCase();
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
  } else if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(upper)) {
    return {
      bg: 'linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%)',
      border: 'border-2 border-purple-500 hover:border-purple-400',
      shadow: 'shadow-[2.5px_2.5px_0px_0px_#2e1065]',
      badge: 'bg-white text-purple-700 border-white',
      typeBadge: upper
    };
  } else if (['MP4', 'MKV', 'AVI', 'MOV', 'WEBM'].includes(upper)) {
    return {
      bg: 'linear-gradient(180deg, #4f46e5 0%, #3730a3 100%)',
      border: 'border-2 border-indigo-500 hover:border-indigo-400',
      shadow: 'shadow-[2.5px_2.5px_0px_0px_#1e1b4b]',
      badge: 'bg-white text-indigo-700 border-white',
      typeBadge: upper
    };
  } else if (['MP3', 'WAV', 'OGG', 'M4A', 'FLAC', 'AAC'].includes(upper)) {
    return {
      bg: 'linear-gradient(180deg, #0891b2 0%, #155e75 100%)',
      border: 'border-2 border-cyan-500 hover:border-cyan-400',
      shadow: 'shadow-[2.5px_2.5px_0px_0px_#164e63]',
      badge: 'bg-white text-cyan-700 border-white',
      typeBadge: upper
    };
  } else if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(upper)) {
    return {
      bg: 'linear-gradient(180deg, #d97706 0%, #92400e 100%)',
      border: 'border-2 border-amber-500 hover:border-amber-400',
      shadow: 'shadow-[2.5px_2.5px_0px_0px_#451a03]',
      badge: 'bg-white text-amber-700 border-white',
      typeBadge: upper
    };
  }
  return {
    bg: 'linear-gradient(180deg, #26272b 0%, #1c1c1f 100%)',
    border: 'border-2 border-stone-700 hover:border-stone-500',
    shadow: 'shadow-[2.5px_2.5px_0px_0px_#1c1917]',
    badge: 'bg-white text-stone-900 border-white',
    typeBadge: upper.slice(0, 5) || 'DOC'
  };
};

export const isGalleryOrDemoFile = (f: any): boolean => {
  if (!f) return false;
  const id = String(f.id || '');
  if (/^(img|vid|aud|doc|dl|cat-img|cat-vid|cat-aud|cat-doc)-\d+/i.test(id) || id.startsWith('default-')) {
    return true;
  }
  const name = String(f.name || '');
  const galleryImageNames = [
    'Capture_ecran_Dashboard.png',
    'Architecture_Cloud_Diagramme.png',
    'Schema_Reseau_Entreprise.png',
    'Citation_Bague_Promesse.png',
    'Interface_StudyCloud_Dark.png',
    'Fond_Ecran_Paysage_Nature.png',
    'IMG-20260923-WA0012.jpg',
    'Dossier_Roblox_Projet.png',
    'Menu_Applications_Grille.png',
    'Dossier_Supply_Chain_Jaune.png',
    'Dashboard_Navigation_Home.png',
    'Labyrinthe_Psychologie_Societe.mp4',
    'CHI_AOP_LINEAIRE_MONT_BASE (1) (1).pdf',
    'CHI_AOP_LINEAIRE_MONT_BASE (1).pdf',
    'TD_PREPA_ANA_2MIT.pdf',
    'CHI_AOP_LINEAIRE_APPLICATIONS.pdf',
    'Synthese_Cours_Semestre_1.docx',
    'Devoir_Economie_Appliquee.pdf',
    'TD_Mathematiques_Algebre.pdf',
    'Tableau_Budget_Gestion_Projet.xlsx',
    'Cours_Supply_Chain_Logistique.pdf',
    'Notes_Revision_Semestre_1.pdf',
    'Fiche_TD_Mathematiques.pdf'
  ];
  if (galleryImageNames.includes(name)) return true;
  if (f.source === 'WhatsApp Images' || f.source === 'Classeur StudyCloud' || f.source === 'StudyCloud Classeur') return true;

  const cat = String(f.category || '').toLowerCase();
  const folder = String(f.folderName || f.matiere || '').toLowerCase();
  const isPage1Category = ['images', 'videos', 'vidéos', 'audio', 'musique'].includes(cat) ||
                          ['images', 'videos', 'vidéos', 'audio', 'musique'].includes(folder);
  if (isPage1Category && !f.r2Key && !id.startsWith('file-') && !f.userId && !f.file_url) {
    return true;
  }
  return false;
};

export const FilesMenuView: React.FC<FilesMenuViewProps> = ({ onBack, onImportFile, setActivePreviewItem, onOpenCreateShareLink, onPublishFiles, initialMatiere }) => {
  const loadAllUserFiles = (): ImportedItem[] => {
    // 0. Purger activement et immédiatement les clés et entrées parasites de galeries Page 1 dans le localStorage
    const galleryKeysToRemove = [
      'unifolder_matiere_files_Images',
      'unifolder_matiere_files_images',
      'unifolder_matiere_files_Documents',
      'unifolder_matiere_files_documents',
      'unifolder_matiere_files_Vidéos',
      'unifolder_matiere_files_videos',
      'unifolder_matiere_files_Videos',
      'unifolder_matiere_files_Musique',
      'unifolder_matiere_files_musique',
      'unifolder_matiere_files_Audio',
      'unifolder_matiere_files_audio'
    ];
    galleryKeysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });

    ['unifolder_files_menu_items', 'unifolder_imported_files', 'unifolder_matiere_files'].forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((item: any) => !isGalleryOrDemoFile(item));
            if (cleaned.length !== parsed.length) {
              safeLocalStorageSet(k, cleaned);
            }
          }
        }
      } catch (e) {}
    });

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
              // Ne JAMAIS inclure les éléments de la galerie d'images / Page 1 dans Mes fichiers
              if (isGalleryOrDemoFile(f)) return;

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

    // 4. Charger les fichiers de toutes les matières réelles enregistrées
    try {
      const savedMat = localStorage.getItem('unifolder_saved_matieres');
      if (savedMat) {
        const parsedMat = JSON.parse(savedMat);
        if (Array.isArray(parsedMat)) {
          parsedMat.forEach((m: any) => {
            if (m && m.name && !['Images', 'Documents', 'Vidéos', 'Videos', 'Musique', 'Audio'].some(ex => ex.toLowerCase() === String(m.name).toLowerCase())) {
              addFiles(localStorage.getItem(`unifolder_matiere_files_${m.name}`), m.name);
            }
          });
        }
      }
    } catch (e) {}

    return Array.from(allFilesMap.values());
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [incompatibleAlertInfo, setIncompatibleAlertInfo] = useState<IncompatibleAlertInfo | null>(null);
  const { data: serverFiles = [], isLoading: isFilesQueryLoading } = useFilesMenuList();
  const { data: serverMatieres } = useMatieresList();
  const [importedFiles, setImportedFiles] = useState<ImportedItem[]>(() => loadAllUserFiles());

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

  const [selectedTab, setSelectedTab] = useState<string>(initialMatiere || 'Mes fichiers');

  useEffect(() => {
    if (initialMatiere) {
      setSelectedTab(initialMatiere);
    }
  }, [initialMatiere]);

  // Synchronisation réactive continue des matières avec TanStack Query (@tanstack/react-query vers Hono/D1)
  useEffect(() => {
    if (serverMatieres && Array.isArray(serverMatieres)) {
      const mapped = serverMatieres.map((m: any, idx: number) => ({
        id: m.id || ('mat-' + Date.now() + '-' + idx),
        name: m.name,
        coefficient: String(m.coefficient ?? '1'),
        color: m.color || '#EA580C'
      }));
      setSavedMatieres(mapped);
      safeLocalStorageSet('unifolder_saved_matieres', mapped);
    }
  }, [serverMatieres]);

  // Synchronisation réactive continue avec TanStack Query (Hono/D1)
  useEffect(() => {
    if (serverFiles && Array.isArray(serverFiles)) {
      setImportedFiles(prev => {
        const serverMap = new Map<string, ImportedItem>();
        serverFiles.forEach(f => serverMap.set(f.id, f));

        // Conserver les fichiers en attente d'envoi ou locaux non encore consolidés sur D1
        const pending = prev.filter(f => !serverMap.has(f.id));
        const merged = [...pending, ...serverFiles];

        // Mettre à jour le cache local de manière sécurisée (protégé contre QuotaExceededError)
        safeLocalStorageSet('unifolder_files_menu_items', merged);
        return merged;
      });
    }
  }, [serverFiles]);

  useEffect(() => {
    const handleSync = () => {
      setImportedFiles(loadAllUserFiles());
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('unifolder_files_updated', handleSync);

    const handleUploadedEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || !detail.fileId) return;
      setImportedFiles(prev => prev.map(f => {
        if (f.id === detail.fileId) {
          return {
            ...f,
            r2Key: detail.r2Key || f.r2Key,
            url: detail.uploadUrl || f.url
          };
        }
        return f;
      }));
      try {
        const directSaved = localStorage.getItem('unifolder_files_menu_items');
        if (directSaved) {
          const parsed: ImportedItem[] = JSON.parse(directSaved);
          const updated = parsed.map(item => item.id === detail.fileId ? {
            ...item,
            r2Key: detail.r2Key || (item as any).r2Key,
            url: detail.uploadUrl || item.url
          } : item);
          safeLocalStorageSet('unifolder_files_menu_items', updated);
        }
      } catch (err) {}
      // Invalider le cache TanStack Query pour actualisation automatique
      invalidateCloudQueries.filesMenu();
    };
    window.addEventListener('studycloud_file_uploaded', handleUploadedEvent);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('unifolder_files_updated', handleSync);
      window.removeEventListener('studycloud_file_uploaded', handleUploadedEvent);
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
  const floatingSearchInputRef = useRef<HTMLInputElement>(null);

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };
  const [showFilesMenuDropdown, setShowFilesMenuDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'size'>('recent');

  // Mode aperçu (cartes avec miniature / mise en page Document Image 2) vs Mode compact (sans aperçu)
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(() => {
    return localStorage.getItem('studycloud_files_preview_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('studycloud_files_preview_mode', String(isPreviewMode));
  }, [isPreviewMode]);

  const handleDownload = async (fileUrl: string | undefined, fileName: string, fileId?: string) => {
    try {
      let targetBlob: Blob | null = null;
      if (fileId) {
        targetBlob = await getFileBlob(fileId).catch(() => null);
      }
      if (!targetBlob && fileUrl) {
        const response = await fetch(fileUrl);
        targetBlob = await response.blob();
      }
      if (!targetBlob && fileId) {
        const blobUrl = await getFileBlobUrl(fileId);
        if (blobUrl) {
          const response = await fetch(blobUrl);
          targetBlob = await response.blob();
        }
      }
      if (targetBlob) {
        const url = URL.createObjectURL(targetBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (fileUrl) {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
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
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        floatingSearchInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        handleCloseSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const filteredFiles = importedFiles.filter(f => {
    // 1. Filtrage selon l'onglet / la matière sélectionnée
    if (selectedTab !== 'Mes fichiers') {
      const targetMatiere = savedMatieres.find(m => m.name.trim().toLowerCase() === selectedTab.trim().toLowerCase() || m.id === selectedTab);
      const matchMatiere = (f.matiere && f.matiere.trim().toLowerCase() === selectedTab.trim().toLowerCase()) ||
                            (targetMatiere && (f.matiereId === targetMatiere.id || f.matiere === targetMatiere.id)) ||
                            (f.folderName && f.folderName.trim().toLowerCase() === selectedTab.trim().toLowerCase());
      if (!matchMatiere) return false;
    }

    if (showDuplicatesOnly) {
      const isDup = f.name.includes('(Copie)') || importedFiles.filter(item => item.name.toLowerCase() === f.name.toLowerCase()).length > 1;
      if (!isDup) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = f.name.toLowerCase().includes(q);
      const matchType = f.type && f.type.toLowerCase().includes(q);
      const matchExt = f.extension && f.extension.toLowerCase().includes(q);
      const matchMatiere = f.matiere && f.matiere.toLowerCase().includes(q);
      return matchName || matchType || matchExt || matchMatiere;
    }

    return true;
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

    // Enregistrement immédiat dans Cloudflare D1
    const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
    if (userId && userId !== 'default-user') {
      StudyCloudAPI.createMatiere({
        id: newMat.id,
        userId,
        name: newMat.name,
        coefficient: Number(newMat.coefficient) || 1,
        color: '#EA580C'
      }).catch(() => {});
    }
    window.dispatchEvent(new Event('unifolder_matieres_updated'));
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
        safeLocalStorageSet('unifolder_files_menu_items', updated);
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
          safeLocalStorageSet(matKey, updated);
        }
      } catch (e) {}
    }

    try {
      const legSaved = localStorage.getItem('unifolder_matiere_files');
      if (legSaved) {
        const parsed: ImportedItem[] = JSON.parse(legSaved);
        const updated = parsed.map(item => item.id === renamingFileId ? { ...item, name: newFileName.trim() } : item);
        safeLocalStorageSet('unifolder_matiere_files', updated);
      }
    } catch (e) {}

    if (targetFile) {
      const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
      if (userId && userId !== 'default-user') {
        const existingExt = targetFile.extension || (targetFile.name.includes('.') ? targetFile.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
        const resolvedMat = savedMatieres.find(m => m.name === targetFile.matiere || m.id === targetFile.matiereId || m.id === targetFile.matiere);
        const resolvedMatiereId = targetFile.matiereId || resolvedMat?.id || targetFile.matiere || null;
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
    }

    invalidateCloudQueries.filesMenu();
    if (targetFile?.matiere) invalidateCloudQueries.matiereFiles(targetFile.matiere);

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
    try {
      localStorage.setItem('unifolder_last_imported_id', newId);
    } catch (e) {}

    // Dupliquer le blob binaire dans IndexedDB pour que la copie soit 100% indépendante
    getFileBlob(fileToDup.id).then(blob => {
      if (blob) {
        storeFileBlob(newId, blob).catch(() => {});
      }
    }).catch(() => {});

    // Sauvegarder la copie dans le bon stockage
    if (fileToDup.matiere) {
      try {
        const matKey = `unifolder_matiere_files_${fileToDup.matiere}`;
        const matSaved = localStorage.getItem(matKey);
        let list: ImportedItem[] = matSaved ? JSON.parse(matSaved) : [];
        list = [duplicated, ...list];
        safeLocalStorageSet(matKey, list);
      } catch (e) {}
    } else {
      try {
        const directSaved = localStorage.getItem('unifolder_files_menu_items');
        let list: ImportedItem[] = directSaved ? JSON.parse(directSaved) : [];
        list = [duplicated, ...list];
        safeLocalStorageSet('unifolder_files_menu_items', list);
      } catch (e) {}
    }

    const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
    if (userId && userId !== 'default-user') {
      const resolvedMat = savedMatieres.find(m => m.name === duplicated.matiere || m.id === duplicated.matiereId || m.id === duplicated.matiere);
      const resolvedMatiereId = duplicated.matiereId || resolvedMat?.id || duplicated.matiere || null;
      StudyCloudAPI.registerFileMetadata({
        id: newId,
        userId,
        matiereId: resolvedMatiereId,
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
    }

    invalidateCloudQueries.filesMenu();
    if (duplicated.matiere) invalidateCloudQueries.matiereFiles(duplicated.matiere);

    window.dispatchEvent(new Event('unifolder_files_updated'));
    setOpenMenuId(null);
  };


  const handleToggleFavorite = (id: string) => {
    const file = importedFiles.find(item => item.id === id);
    const newFav = file ? !file.isFavorite : true;
    setImportedFiles(prev => prev.map(item => item.id === id ? { ...item, isFavorite: newFav } : item));
    setOpenMenuId(null);

    // Mettre à jour dans le cache local
    try {
      const directSaved = localStorage.getItem('unifolder_files_menu_items');
      if (directSaved) {
        const parsed: ImportedItem[] = JSON.parse(directSaved);
        const updated = parsed.map(item => item.id === id ? { ...item, isFavorite: newFav } : item);
        safeLocalStorageSet('unifolder_files_menu_items', updated);
      }
    } catch (e) {}

    if (file) {
      const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
      if (userId && userId !== 'default-user') {
        const resolvedMat = savedMatieres.find(m => m.name === file.matiere || m.id === file.matiereId || m.id === file.matiere);
        const resolvedMatiereId = file.matiereId || resolvedMat?.id || file.matiere || null;
        StudyCloudAPI.toggleFileFavorite(id, newFav).catch(() => {
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
        });
      }
    }

    invalidateCloudQueries.filesMenu();
    invalidateCloudQueries.favorites();
    if (file?.matiere) invalidateCloudQueries.matiereFiles(file.matiere);
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
        safeLocalStorageSet('unifolder_files_menu_items', filtered);
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
          safeLocalStorageSet(matKey, filtered);
        }
      } catch (e) {}
    }

    // Supprimer également des clés historiques si présentes
    try {
      const legSaved = localStorage.getItem('unifolder_matiere_files');
      if (legSaved) {
        const parsed: ImportedItem[] = JSON.parse(legSaved);
        const filtered = parsed.filter(item => item.id !== id);
        safeLocalStorageSet('unifolder_matiere_files', filtered);
      }
    } catch (e) {}

    invalidateCloudQueries.filesMenu();
    if (fileToDelete?.matiere) invalidateCloudQueries.matiereFiles(fileToDelete.matiere);
    invalidateCloudQueries.overview();
    invalidateCloudQueries.favorites();

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
        safeLocalStorageSet('unifolder_files_menu_items', filtered);
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
            safeLocalStorageSet(matKey, filtered);
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
        safeLocalStorageSet('unifolder_matiere_files', filtered);
      }
    } catch (e) {}

    invalidateCloudQueries.filesMenu();
    filesToDelete.forEach(f => { if (f.matiere) invalidateCloudQueries.matiereFiles(f.matiere); });
    invalidateCloudQueries.overview();
    invalidateCloudQueries.favorites();

    window.dispatchEvent(new Event('unifolder_files_updated'));
    setSelectedFileIds([]);
    setIsSelectionMode(false);
  };

  const cleanupUnusedMatieres = () => {
    // Les matières créées restent conservées dans la base de données D1
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
    const firstTargetMat = selectedMats[0];
    const resolvedMatiereId = firstTargetMat?.id || selectedMatiereIds[0] || null;
    
    // Find all files being classified
    const filesToClassify = importedFiles.filter(item => classifyFileIds.includes(item.id));

    setImportedFiles(prev => prev.map(item => classifyFileIds.includes(item.id) ? { ...item, matiere: matiereString, matiereId: resolvedMatiereId || item.matiereId } : item));

    // Also add a copy of each file to each selected matiere's independent storage
    filesToClassify.forEach(fileToClassify => {
      selectedMats.forEach(mat => {
        const matName = mat.name;
        const storageKey = `unifolder_matiere_files_${matName}`;
        try {
          const existing = localStorage.getItem(storageKey);
          let list: ImportedItem[] = existing ? JSON.parse(existing) : [];
          const copiedFile: ImportedItem = {
            ...fileToClassify,
            id: 'file-' + Math.random().toString(36).substring(2, 9),
            matiere: matName,
            matiereId: mat.id
          };
          list.push(copiedFile);
          safeLocalStorageSet(storageKey, list);
        } catch (e) {
          console.error(e);
        }
      });
    });

    // Mettre à jour dans D1 et invalider les queries TanStack
    const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || '';
    if (userId && userId !== 'default-user') {
      filesToClassify.forEach(fileToClassify => {
        StudyCloudAPI.registerFileMetadata({
          id: fileToClassify.id,
          userId,
          matiereId: resolvedMatiereId,
          name: fileToClassify.name,
          size: fileToClassify.size,
          type: fileToClassify.type,
          extension: fileToClassify.extension,
          r2Key: (fileToClassify as any).r2Key || null,
          fileUrl: fileToClassify.url,
          isFavorite: fileToClassify.isFavorite,
          isImported: true,
          lastImported: typeof fileToClassify.importedAt === 'number' ? fileToClassify.importedAt : Date.now()
        }).catch(() => {});
      });
    }

    invalidateCloudQueries.filesMenu();
    matiereNames.forEach(name => invalidateCloudQueries.matiereFiles(name));

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
      const { validFiles, rejectedFiles } = await validateFilesForMesFichiersAsync(files, 'Mes fichiers');

      if (rejectedFiles.length > 0) {
        const first = rejectedFiles[0];

        // OUVERTURE IMMÉDIATE DU MODAL D'ALERTE ROUGE AU MILIEU DE L'ÉCRAN
        setIncompatibleAlertInfo({
          fileName: first.file.name,
          detectedCategory: first.detectedLabel,
          menuLabel: 'Mes fichiers',
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

        const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(f.name);
        const id = `file-${now + i}-${Math.random().toString(36).substring(2, 7)}`;
        
        // 1. Stocker le blob dans IndexedDB (0ms, accès instantané)
        await storeFileBlob(id, f);
        const localUrl = URL.createObjectURL(f);

        if (isImg) {
          imageFilesToCompress.push({ id, file: f });
        }

        const extVal = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : (f.type ? f.type.split('/').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
        const isSubject = selectedTab !== 'Mes fichiers';
        const targetMat = isSubject ? savedMatieres.find(m => m.name.toLowerCase() === selectedTab.toLowerCase() || m.id === selectedTab) : null;
        const targetMatiereId = targetMat?.id || (isSubject ? selectedTab : null);
        const targetMatiereName = targetMat?.name || (isSubject ? selectedTab : '');

        const item: ImportedItem = {
          id,
          name: f.name,
          size: f.size,
          type: f.type || 'Fichier',
          extension: extVal,
          url: localUrl,
          isImage: isImg,
          matiere: targetMatiereName,
          matiereId: targetMatiereId || undefined,
          folderName: isSubject ? targetMatiereName : 'Mes fichiers',
          importedAt: now + i,
          createdAt: now + i,
          timestamp: now + i,
          isFavorite: false
        };
        newItems.push(item);

        // 2. Enregistrement D1 immédiat (sans attendre R2)
        const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || '';
        if (userId && userId !== 'default-user') {
          StudyCloudAPI.registerFileMetadata({
            id,
            userId,
            matiereId: targetMatiereId,
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
        }

        // 3. Préparer les données pour UploadQueue
        itemsWithFiles.push({
          file: f,
          item: {
            ...item,
            category: isImg ? 'images' : (
              f.type.startsWith('video/') ? 'videos' :
              f.type.startsWith('audio/') ? 'audio' : 'documents'
            ),
            source: isSubject ? selectedTab : 'Mes fichiers',
            sizeBytes: f.size,
            date: `Aujourd'hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
            previewUrl: localUrl,
            videoUrl: f.type.startsWith('video/') ? localUrl : undefined,
            audioUrl: f.type.startsWith('audio/') ? localUrl : undefined,
          },
          originalSizeBytes: f.size
        });
      }

      if (newItems.length === 0) return;

      // 4. Affichage immédiat (optimiste) + animation de progression
      setImportedFiles(prev => [...newItems, ...prev]);
      startSavingAnimation(newItems.map(item => item.id));

      // 5. CloudDataStore.addOptimisticFile — sync multi-appareils immédiate
      newItems.forEach(item => {
        CloudDataStore.addOptimisticFile(item as any);
      });

      const targetMatForQueue = selectedTab !== 'Mes fichiers' ? savedMatieres.find(m => m.name.toLowerCase() === selectedTab.toLowerCase() || m.id === selectedTab) : null;
      // 6. UploadQueue.enqueueExisting — R2 en arrière-plan avec retry automatique
      UploadQueue.enqueueExisting(itemsWithFiles, {
        category: 'documents',
        uploadSource: 'mes-fichiers',
        folderId: targetMatForQueue?.id || undefined
      });

      if (newItems.length > 0) {
        try {
          localStorage.setItem('unifolder_last_imported_id', newItems[newItems.length - 1].id);
        } catch (e) {}
      }

      // Sauvegarder dans unifolder_files_menu_items (en tête) de manière sécurisée
      try {
        const directSaved = localStorage.getItem('unifolder_files_menu_items');
        let directList: ImportedItem[] = directSaved ? JSON.parse(directSaved) : [];
        directList = [...newItems, ...directList];
        safeLocalStorageSet('unifolder_files_menu_items', directList);
      } catch (e) {
        console.error(e);
      }

      // Si importé dans une matière spécifique, sauvegarder également dans le stockage de cette matière
      if (selectedTab !== 'Mes fichiers') {
        try {
          const matKey = `unifolder_matiere_files_${selectedTab}`;
          const matSaved = localStorage.getItem(matKey);
          let matList: ImportedItem[] = matSaved ? JSON.parse(matSaved) : [];
          matList = [...newItems, ...matList];
          safeLocalStorageSet(matKey, matList);
          invalidateCloudQueries.matiereFiles(selectedTab);
        } catch (e) {
          console.error(e);
        }
      }

      window.dispatchEvent(new Event('unifolder_files_updated'));

      // Invalider les requêtes TanStack Query
      invalidateCloudQueries.filesMenu();
      invalidateCloudQueries.overview();
      if (selectedTab !== 'Mes fichiers') invalidateCloudQueries.matiereFiles(selectedTab);
      if (targetMatForQueue?.id) invalidateCloudQueries.matiereFiles(targetMatForQueue.id);

      try {
        const existingShares = JSON.parse(localStorage.getItem('unifolder_shares') || '[]');
        const folderTitle = newItems.length === 1 ? newItems[0].name : 'Publication (' + newItems.length + ' fichiers)';
        const newSharedFolder = {
          id: 'folder-' + Math.random().toString(36).substring(2, 9),
          title: folderTitle,
          description: `Document ajouté dans ${selectedTab}`,
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
        ? `Fichiers importés avec succès dans « ${selectedTab} » !`
        : `Fichier importé avec succès dans « ${selectedTab} » !`;
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(null), 3500);

      // Aperçus en mémoire vive uniquement (ne JAMAIS persister de dataUrl base64 dans localStorage)
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

  const isMesFichiers = selectedTab === 'Mes fichiers';
  const currentMatiere = savedMatieres.find(
    m => m.name.trim().toLowerCase() === selectedTab.trim().toLowerCase()
  );
  const isCurrentMatiereHex = !isMesFichiers && Boolean(currentMatiere?.color && currentMatiere.color.startsWith('#'));
  const currentMatiereColor = isCurrentMatiereHex ? currentMatiere?.color : undefined;
  const importerThemeClass = isMesFichiers
    ? 'bg-amber-400 hover:bg-amber-500 text-stone-900 border-stone-800'
    : (isCurrentMatiereHex
        ? 'border-stone-900 text-white hover:brightness-110'
        : (currentMatiere?.color || 'bg-[#1f4e79] hover:bg-[#153757] text-white border-stone-800'));

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
          <p className="text-sm font-bold text-emerald-100 mt-1">Ils seront importés et enregistrés immédiatement dans « Mes fichiers »</p>
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
        {/* GAUCHE : Bouton Retour + Bouton Importer en bas prenant la couleur du menu/matière active */}
        <div className="flex flex-col items-start gap-1 pointer-events-auto shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 w-full justify-center"
            title="Retour"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
            <span>Retour</span>
          </button>

          <button
            type="button"
            onClick={handleButtonClick}
            style={isCurrentMatiereHex ? { backgroundColor: currentMatiereColor, color: '#ffffff' } : undefined}
            className={`flex items-center gap-1 px-2.5 py-1 font-extrabold text-[10px] rounded-lg border-2 shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 w-full justify-center ${importerThemeClass}`}
            title={`Importer des fichiers dans « ${selectedTab} »`}
          >
            <Upload className="w-3 h-3 stroke-[2.5]" />
            <span>Importer</span>
          </button>
        </div>

        {/* MILIEU : Barre de recherche compacte OU Liste horizontale des matières */}
        {isSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 bg-[#FDFBF7] dark:bg-[#111a2e] border-2 border-stone-800 dark:border-stone-600 rounded-xl shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none px-2.5 py-1 pointer-events-auto min-w-0 h-9">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-5 h-5 rounded-md bg-amber-400 text-stone-900 flex items-center justify-center border border-stone-800 shadow-xs">
                <Search className="w-3 h-3 stroke-[2.8]" />
              </div>
              <span className="hidden sm:inline-block text-[11px] font-extrabold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                « {selectedTab} »
              </span>
            </div>

            <div className="flex-1 relative flex items-center min-w-0">
              <input
                ref={floatingSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleCloseSearch();
                  }
                }}
                placeholder={selectedTab === 'Mes fichiers' ? 'Tapez le nom d\'un fichier...' : `Rechercher dans ${selectedTab}...`}
                className="w-full bg-transparent text-xs font-semibold text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none pr-5"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-0 text-stone-400 hover:text-stone-700 dark:hover:text-white p-0.5 cursor-pointer"
                  title="Effacer le texte"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 whitespace-nowrap shrink-0">
              {filteredFiles.length} trouvé{filteredFiles.length > 1 ? 's' : ''}
            </span>

            <button
              type="button"
              onClick={handleCloseSearch}
              className="flex items-center gap-1 px-2 py-0.5 bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-700 dark:hover:bg-stone-600 font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs active:translate-x-0.5 active:translate-y-0.5"
              title="Fermer la recherche et tout réafficher"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fermer</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-1 pointer-events-auto min-w-0">
            {/* Bouton premier : Mes fichiers */}
            <button
              type="button"
              onClick={() => {
                setSelectedTab('Mes fichiers');
                setSearchQuery('');
              }}
              className={`px-3 py-1 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
                selectedTab === 'Mes fichiers'
                  ? 'bg-amber-400 dark:bg-amber-500 text-stone-900 font-black border-2 border-stone-800 shadow-[1.5px_1.5px_0px_0px_#1c1917] scale-[1.02]'
                  : 'bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-stone-300 font-bold border-2 border-stone-400/40 dark:border-stone-700 shadow-xs'
              }`}
              title="Mes fichiers (Tous les fichiers)"
            >
              <span>Mes fichiers</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-black/30 font-mono font-bold">
                {importedFiles.length}
              </span>
            </button>

            {/* Matières créées */}
            {savedMatieres.map((m) => {
              const isSelected = selectedTab === m.name;
              const isHex = m.color && m.color.startsWith('#');
              const colorClass = !isHex && m.color ? m.color : (!isHex ? 'bg-[#1f4e79] text-white' : '');
              const count = importedFiles.filter(f => f.matiere === m.name || f.folderName === m.name).length;

              return (
                <button
                  key={m.id || m.name}
                  type="button"
                  onClick={() => {
                    setSelectedTab(m.name);
                    setSearchQuery('');
                  }}
                  style={isHex ? { backgroundColor: m.color, color: '#fff' } : undefined}
                  className={`px-3 py-1 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none border-2 ${colorClass} ${
                    isSelected
                      ? 'ring-2 ring-amber-400 dark:ring-amber-400 ring-offset-2 ring-offset-[#C5B0A4] dark:ring-offset-[#0b0f19] border-stone-900 dark:border-white font-black scale-[1.04] shadow-md z-10'
                      : 'border-stone-700/50 hover:border-stone-900 opacity-85 hover:opacity-100 font-bold hover:scale-[1.02]'
                  }`}
                  title={`${m.name} (Coeff: ${m.coefficient || 1})`}
                >
                  <span>{m.name}</span>
                  {m.coefficient && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-black/30 text-white font-mono">
                      C:{m.coefficient}
                    </span>
                  )}
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white/20 text-white font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0 pt-0.5">
          {/* Bouton loupe devant le bouton œil */}
          <button
            type="button"
            onClick={() => {
              if (isSearchOpen) {
                handleCloseSearch();
              } else {
                setIsSearchOpen(true);
              }
            }}
            className={`p-1.5 rounded-lg border-2 shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center relative ${
              isSearchOpen || searchQuery
                ? 'bg-amber-400 text-stone-900 border-stone-800 font-bold'
                : 'bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white border-[#2D4A3E] dark:border-[#334155]'
            }`}
            title={isSearchOpen ? "Fermer la recherche" : "Rechercher des fichiers"}
          >
            <Search className="w-3.5 h-3.5 stroke-[2.4]" />
            {Boolean(searchQuery) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white dark:border-stone-900" />
            )}
          </button>

          {/* Bouton œil pour basculer Mode compact (sans aperçu) / Mode aperçu (style Documents) */}
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
                  {/* Option bascule aperçu / compact dans le petit menu */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPreviewMode(prev => !prev);
                      setShowFilesMenuDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-xs font-bold text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer border-b border-stone-100 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2.5">
                      {isPreviewMode ? <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <EyeOff className="w-4 h-4 text-stone-600 dark:text-slate-400" />}
                      <span>{isPreviewMode ? "Mode aperçu (actif)" : "Mode compact (sans aperçu)"}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-stone-400 dark:text-slate-500">
                      {isPreviewMode ? "Aperçu" : "Compact"}
                    </span>
                  </button>

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
              onClick={async () => {
                const filesToPublish = importedFiles.filter(f => selectedFileIds.includes(f.id));
                if (filesToPublish.length > 0 && onPublishFiles) {
                  // Synchroniser les fichiers binaires vers la base IndexedDB de publication
                  for (const f of filesToPublish) {
                    try {
                      const blob = await getFileBlob(f.id);
                      if (blob) {
                        await persistRawFile(f.id, blob);
                      }
                    } catch (err) {
                      console.warn('Could not sync raw file for publication:', err);
                    }
                  }
                  const payload = filesToPublish.map(f => ({
                    id: f.id,
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    url: f.url || '',
                    isImage: f.isImage,
                  }));
                  onPublishFiles(payload);
                  window.dispatchEvent(new Event('studycloud_refresh_selected_files'));
                  setIsSelectionMode(false);
                  setSelectedFileIds([]);
                }
              }}
              disabled={selectedFileIds.length === 0}
              className="px-1.5 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-[9.5px] rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              <span>Publier</span>
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



      <div className="w-full px-2 sm:px-4 pt-16 sm:pt-20">
        <div className="pt-1 pb-64 w-full max-w-7xl mx-auto">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 bg-white/40 dark:bg-white/[0.02] rounded-2xl border-2 border-dashed border-stone-400/40 dark:border-stone-700/50 p-8 my-4">
              <h2 className="text-xl font-bold text-[#2D4A3E] dark:text-white mb-2">{selectedTab}</h2>
              <p className="text-sm text-[#5C6B5A] dark:text-slate-400 mb-4">
                {searchQuery ? `Aucun fichier ne correspond à votre recherche "${searchQuery}".` : `Aucun fichier dans ${selectedTab}.`}
              </p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-white font-extrabold text-xs rounded-xl border-2 border-stone-800 dark:border-stone-600 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer inline-flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
                >
                  <X className="w-4 h-4" />
                  <span>Effacer la recherche</span>
                </button>
              ) : (
                <button
                  onClick={handleButtonClick}
                  className="px-4 py-2 bg-[#2D4A3E] hover:bg-[#1e332a] text-white font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer inline-flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer un fichier dans {selectedTab}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="w-full">

              {isPreviewMode ? (
                /* Grille en mode aperçu (style Documents Image 2) */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 justify-items-stretch w-full">
                  {filteredFiles.map((f, idx) => {
                    const ext = f.extension || (f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
                    const isImg = f.isImage || ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF'].includes(ext);
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
                            setActivePreviewItem && setActivePreviewItem({ ...f, folderName: f.matiere || 'Mes fichiers' });
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
                                        handleDownload(f.url, f.name, f.id);
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
                                        setSelectedFileIds(filteredFiles.map(item => item.id));
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                                    >
                                      <span>☑️ Tout sélectionner</span>
                                    </button>

                                    <button
                                      onClick={async () => {
                                        if (onPublishFiles) {
                                          try {
                                            const blob = await getFileBlob(f.id);
                                            if (blob) {
                                              await persistRawFile(f.id, blob);
                                            }
                                          } catch (err) {
                                            console.warn('Could not sync raw file for publication:', err);
                                          }
                                          const payload = [{
                                            id: f.id,
                                            name: f.name,
                                            size: f.size,
                                            type: f.type,
                                            url: f.url || '',
                                            isImage: f.isImage,
                                          }];
                                          onPublishFiles(payload);
                                          window.dispatchEvent(new Event('studycloud_refresh_selected_files'));
                                        }
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 transition-colors border-t border-stone-200 cursor-pointer font-semibold"
                                    >
                                      <Globe className="w-4 h-4 text-emerald-600" />
                                      <span>Publier (rendre public)</span>
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

                        {/* Corps de carte / aperçu réel du document (PDF page 1 ou miniature image ou layout dynamique) */}
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
                          {f.matiere && (
                            <span className="inline-block text-[7.5px] font-extrabold uppercase tracking-wider text-amber-200 bg-black/40 rounded px-1 py-0.2 mt-0.5 max-w-full truncate">
                              {f.matiere}
                            </span>
                          )}
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
                            setOpenMenuId(null);
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
                            disabled={isSelectionMode || selectedFileIds.length > 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSelectionMode || selectedFileIds.length > 0) return;
                              setOpenMenuId(openMenuId === f.id ? null : f.id);
                            }}
                            className={`absolute top-1 left-1 z-30 w-7 h-7 rounded-full text-white flex items-center justify-center transition-all shadow-md ${
                              isSelectionMode || selectedFileIds.length > 0
                                ? 'bg-black/20 opacity-20 pointer-events-none cursor-not-allowed'
                                : 'bg-black/60 hover:bg-black cursor-pointer active:scale-90'
                            }`}
                            title={isSelectionMode || selectedFileIds.length > 0 ? "Menu désactivé en mode sélection" : "Options"}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}

                        {openMenuId === f.id && !isSelectionMode && selectedFileIds.length === 0 && !isSaving && (
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
                                handleDownload(f.url, f.name, f.id);
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
                                setSelectedFileIds(filteredFiles.map(item => item.id));
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#E8DFD0]/50 flex items-center gap-2 text-stone-700 transition-colors border-t border-stone-200 cursor-pointer"
                            >
                              <span>☑️ Tout sélectionner</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (onPublishFiles) {
                                  try {
                                    const blob = await getFileBlob(f.id);
                                    if (blob) {
                                      await persistRawFile(f.id, blob);
                                    }
                                  } catch (err) {
                                    console.warn('Could not sync raw file for publication:', err);
                                  }
                                  const payload = [{
                                    id: f.id,
                                    name: f.name,
                                    size: f.size,
                                    type: f.type,
                                    url: f.url || '',
                                    isImage: f.isImage,
                                  }];
                                  onPublishFiles(payload);
                                  window.dispatchEvent(new Event('studycloud_refresh_selected_files'));
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 transition-colors border-t border-stone-200 cursor-pointer font-semibold"
                            >
                              <Globe className="w-4 h-4 text-emerald-600" />
                              <span>Publier (rendre public)</span>
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

                          {isImg && (f.url || (f as any).r2Key || f.id) ? (
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

      {/* Modal Format Non Compatible au milieu de l'écran */}
      <IncompatibleFormatModal 
        info={incompatibleAlertInfo} 
        onClose={() => setIncompatibleAlertInfo(null)} 
      />
    </div>
  );
};

