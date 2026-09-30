import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Download,
  CheckSquare,
  Square,
  Settings,
  AlertCircle,
  ExternalLink,
  Menu,
  Play,
  Share2,
  FolderArchive
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { AudioCardPreview } from './AudioCardPreview';
import { DocumentCardPreview } from './DocumentCardPreview';
import { VideoCardPreview } from './VideoCardPreview';
import { Classeur3DFolderCard } from './Folder3DModels';

const getDocumentTheme = (ext: string = 'PDF') => {
  const upper = (ext || 'PDF').toUpperCase();
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

interface SecureFolderMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
}

export const SecureFolderMenuView: React.FC<SecureFolderMenuViewProps> = ({ onBack, onOpenStudySpace }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasServerPin, setHasServerPin] = useState<boolean | null>(null);
  const [securePinInput, setSecurePinInput] = useState('');
  const [securePinConfirmInput, setSecurePinConfirmInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  // Fichiers sécurisés
  const [secureFiles, setSecureFiles] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().secure || [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal de changement de code PIN
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Prévisualisation multimédia
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Menu d'options 3 traits
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  // Filtre par catégorie
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'audio' | 'documents' | 'images' | 'videos'>('all');

  // Fermeture du menu déroulant 3 traits lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.studycloud-sec-menu-trigger') && !target.closest('.studycloud-sec-menu-panel')) {
        setActiveMenuFileId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inactivityTimerRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const getStoredPin = () => localStorage.getItem('studycloud_secure_folder_pin');

  // 1. Détection du code PIN : vérification locale ET distante auprès du Worker Cloudflare
  useEffect(() => {
    const localPin = getStoredPin();
    if (localPin) {
      setHasServerPin(true);
    }
    // Vérifier en ligne pour les nouveaux appareils ou après vidage du cache
    CloudStorageAPI.isSecureFolderConfigured()
      .then((configured) => {
        setHasServerPin(configured || Boolean(getStoredPin()));
      })
      .catch(() => {
        setHasServerPin(Boolean(getStoredPin()));
      });
  }, []);

  // 2. Déverrouillage ou configuration initiale du code secret
  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingPin) return;

    const stored = getStoredPin();
    const isConfigured = hasServerPin ?? Boolean(stored);

    if (!isConfigured) {
      // Configuration initiale d'un nouveau code
      const trimmed = securePinInput.trim();
      if (trimmed.length < 4) {
        setPinError('Le code secret doit comporter au moins 4 caractères.');
        return;
      }
      if (trimmed !== securePinConfirmInput.trim()) {
        setPinError('La confirmation ne correspond pas au code saisi.');
        return;
      }

      setIsSubmittingPin(true);
      try {
        localStorage.setItem('studycloud_secure_folder_pin', trimmed);
        await CloudStorageAPI.setSecurePin(trimmed).catch(() => {});
        setHasServerPin(true);
        setIsUnlocked(true);
        setPinError(null);
        setSecurePinInput('');
        setSecurePinConfirmInput('');
        showToast('Code secret configuré avec succès ! Coffre-fort déverrouillé.');
      } catch (err: any) {
        setPinError(err.message || 'Erreur lors de la configuration.');
      } finally {
        setIsSubmittingPin(false);
      }
    } else {
      // Déverrouillage avec code existant
      const trimmed = securePinInput.trim();
      if (!trimmed) {
        setPinError('Veuillez saisir votre code secret.');
        return;
      }

      setIsSubmittingPin(true);
      const isLocalOk = stored ? trimmed === stored.trim() : false;
      let isWorkerOk = false;
      try {
        isWorkerOk = await CloudStorageAPI.verifySecurePin(trimmed);
      } catch {}

      setIsSubmittingPin(false);

      if (isLocalOk || isWorkerOk) {
        // Enregistrer en local si validé en ligne (ex: nouvel appareil)
        localStorage.setItem('studycloud_secure_folder_pin', trimmed);
        setHasServerPin(true);
        setIsUnlocked(true);
        setPinError(null);
        setSecurePinInput('');
        showToast('Dossier sécurisé déverrouillé ✅');
      } else {
        setPinError('Code incorrect. Veuillez réessayer.');
      }
    }
  };

  // 3. Verrouillage automatique en cas d'inactivité (3 minutes) ou de changement d'onglet
  useEffect(() => {
    if (!isUnlocked) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        setIsUnlocked(false);
        setSelectedIds(new Set());
        setPreviewFile(null);
        showToast('Dossier sécurisé reverrouillé par inactivité 🔒');
      }, 3 * 60 * 1000); // 3 minutes
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsUnlocked(false);
        setSelectedIds(new Set());
        setPreviewFile(null);
      }
    };

    resetTimer();
    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('scroll', resetTimer, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked, showToast]);

  // 4. Chargement et synchronisation réactive des fichiers protégés
  useEffect(() => {
    if (!isUnlocked) return;
    CloudStorageAPI.getSecureFiles()
      .then((data) => {
        if (data && Array.isArray(data)) {
          setSecureFiles(data);
          CloudDataStore.setSecureFiles(data as any);
        }
      })
      .catch(() => {});

    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (state.secure) {
        setSecureFiles(state.secure);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isUnlocked]);

  // 5. Modification du Code PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.trim().length < 4) {
      setChangePinError('Le nouveau code doit comporter au moins 4 caractères.');
      return;
    }
    if (newPinInput.trim() !== confirmNewPinInput.trim()) {
      setChangePinError('La confirmation ne correspond pas au nouveau code.');
      return;
    }

    setIsChangingPin(true);
    setChangePinError(null);

    try {
      const res = await CloudStorageAPI.setSecurePin(newPinInput.trim(), oldPinInput.trim() || undefined);
      if (res.success) {
        localStorage.setItem('studycloud_secure_folder_pin', newPinInput.trim());
        setShowChangePinModal(false);
        setOldPinInput('');
        setNewPinInput('');
        setConfirmNewPinInput('');
        showToast('Code secret modifié avec succès ! 🔑');
      } else {
        setChangePinError(res.error || 'Ancien code incorrect.');
      }
    } catch (err: any) {
      setChangePinError(err.message || 'Erreur lors de la modification du code.');
    } finally {
      setIsChangingPin(false);
    }
  };

  // 6. Import direct dans le dossier sécurisé
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];

    showToast(`Chiffrement et ajout de ${files.length} fichier(s)...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
        let category: FileItem['category'] = 'documents';
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) category = 'images';
        else if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) category = 'videos';
        else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) category = 'audio';

        const comp = await compressFile(f, category);
        const fileId = `sec-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        const item: FileItem = {
          id: fileId,
          name: f.name,
          category,
          source: 'Dossier sécurisé',
          size: comp.originalSizeFormatted,
          sizeBytes: comp.originalSizeBytes,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          extension: ext.toUpperCase(),
          url: localBlobUrl,
          previewUrl: localBlobUrl,
          isSecure: true,
          isFavorite: false
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setSecureFiles(prev => [...newItems, ...prev]);
    CloudDataStore.setSecureFiles([...newItems, ...secureFiles]);

    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'secure' });
    showToast(`${newItems.length} fichier(s) protégé(s) avec succès !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 7. Déverrouiller (Renvoyer vers l'emplacement d'origine)
  const handleRestore = async (file: FileItem) => {
    setSecureFiles(prev => prev.filter(f => f.id !== file.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(file.id);
      return next;
    });

    CloudDataStore.restoreFromSecure([file]);
    await CloudStorageAPI.restoreFromSecureFolder(file.id).catch(() => {});
    showToast(`"${file.name}" déverrouillé et restauré dans son menu d'origine 🔓`);
  };

  // 8. Supprimer vers la corbeille
  const handleDeleteToTrash = async (file: FileItem) => {
    setSecureFiles(prev => prev.filter(f => f.id !== file.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(file.id);
      return next;
    });

    deleteFileBlob(file.id).catch(() => {});
    CloudDataStore.deleteSecureToTrash([file]);
    await CloudStorageAPI.deleteSecureFilesToTrash(file.id).catch(() => {});
    showToast(`"${file.name}" déplacé dans la corbeille 🗑️`);
  };

  // 9. Télécharger un fichier déchiffré
  const handleDownload = async (file: FileItem) => {
    try {
      showToast(`Téléchargement de "${file.name}"...`);
      let downloadUrl = file.url || file.previewUrl || '';
      if (!downloadUrl || downloadUrl.startsWith('blob:')) {
        const localBlob = await getFileBlobUrl(file.id);
        if (localBlob) downloadUrl = localBlob;
      }

      if (!downloadUrl) {
        showToast('Impossible de télécharger le fichier (lien introuvable).');
        return;
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name || 'fichier-securise';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      showToast('Erreur lors du téléchargement.');
    }
  };

  // 10. Actions Groupées (Sélection multiple)
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const handleBatchRestore = async () => {
    const filesToRestore = secureFiles.filter(f => selectedIds.has(f.id));
    if (filesToRestore.length === 0) return;

    setSecureFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    const ids: string[] = Array.from(selectedIds);
    setSelectedIds(new Set());

    CloudDataStore.restoreFromSecure(filesToRestore);
    await CloudStorageAPI.restoreFromSecureFolder(ids).catch(() => {});
    showToast(`${filesToRestore.length} fichier(s) déverrouillé(s) avec succès 🔓`);
  };

  const handleBatchTrash = async () => {
    const filesToTrash = secureFiles.filter(f => selectedIds.has(f.id));
    if (filesToTrash.length === 0) return;

    setSecureFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    const ids: string[] = Array.from(selectedIds);
    setSelectedIds(new Set());

    filesToTrash.forEach(f => deleteFileBlob(f.id).catch(() => {}));
    CloudDataStore.deleteSecureToTrash(filesToTrash);
    await CloudStorageAPI.deleteSecureFilesToTrash(ids).catch(() => {});
    showToast(`${filesToTrash.length} fichier(s) déplacé(s) dans la corbeille 🗑️`);
  };

  // 11. Filtrage par recherche
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return secureFiles;
    const q = searchQuery.toLowerCase().trim();
    return secureFiles.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.extension || '').toLowerCase().includes(q)
    );
  }, [secureFiles, searchQuery]);

  // Détection du type de média
  const getFileType = (f: FileItem): 'audio' | 'video' | 'image' | 'folder' | 'document' => {
    if (
      f.category === 'audio' ||
      (f as any).isAudio ||
      Boolean((f as any).audioUrl) ||
      /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i.test(f.name)
    ) return 'audio';
    if (
      f.category === 'videos' ||
      (f as any).isVideo ||
      Boolean((f as any).videoUrl) ||
      /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp)$/i.test(f.name)
    ) return 'video';
    if (
      f.category === 'images' ||
      (f as any).isImage ||
      Boolean((f as any).imageUrl) ||
      /\.(jpe?g|png|webp|gif|svg|avif|ico|bmp|tiff)$/i.test(f.name)
    ) return 'image';
    if (
      (f as any).isFolder ||
      f.category === 'classeur' ||
      f.category === 'classeur_folder'
    ) return 'folder';
    return 'document';
  };

  // Compteurs par catégorie
  const categoryCounts = useMemo(() => {
    const counts = { all: filteredFiles.length, audio: 0, documents: 0, images: 0, videos: 0 };
    filteredFiles.forEach(f => {
      const t = getFileType(f);
      if (t === 'audio') counts.audio++;
      else if (t === 'image') counts.images++;
      else if (t === 'video') counts.videos++;
      else counts.documents++;
    });
    return counts;
  }, [filteredFiles]);

  // Fichiers affichés selon le filtre de catégorie actif
  const displayedFiles = useMemo(() => {
    if (categoryFilter === 'all') return filteredFiles;
    return filteredFiles.filter(f => {
      const t = getFileType(f);
      if (categoryFilter === 'audio') return t === 'audio';
      if (categoryFilter === 'images') return t === 'image';
      if (categoryFilter === 'videos') return t === 'video';
      if (categoryFilter === 'documents') return t === 'document' || t === 'folder';
      return true;
    });
  }, [filteredFiles, categoryFilter]);

  // Menu d'options 3 traits
  const renderOptionsMenu = (file: FileItem) => {
    return (
      <div
        className="studycloud-sec-menu-panel absolute top-8 left-0 z-50 bg-[#0E1526] text-white rounded-xl shadow-2xl border border-white/20 py-1.5 w-48 text-xs font-semibold animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            handleRestore(file);
            setActiveMenuFileId(null);
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-emerald-500/20 flex items-center gap-2.5 text-emerald-400 transition-colors cursor-pointer border-b border-white/10"
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>Déverrouiller le fichier</span>
        </button>

        {onOpenStudySpace && (
          <button
            type="button"
            onClick={() => {
              onOpenStudySpace(file, 'Dossier sécurisé');
              setActiveMenuFileId(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2.5 text-slate-200 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Espace d'étude</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            handleDownload(file);
            setActiveMenuFileId(null);
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2.5 text-slate-200 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-purple-400" />
          <span>Télécharger</span>
        </button>

        <button
          type="button"
          onClick={() => {
            handleDeleteToTrash(file);
            setActiveMenuFileId(null);
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-rose-500/20 flex items-center gap-2.5 text-rose-400 transition-colors cursor-pointer border-t border-white/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Mettre à la corbeille</span>
        </button>
      </div>
    );
  };

  // =========================================================================
  // CARTE AUDIO AUTHENTIQUE (aspect-[3/4] comme les documents, AudioCardPreview, logo mélodie)
  // =========================================================================
  const renderAudioCard = (file: FileItem) => {
    const isSelected = selectedIds.has(file.id);
    const isMenuOpen = activeMenuFileId === file.id;

    return (
      <div
        key={file.id}
        onClick={() => setPreviewFile(file)}
        className={`group relative aspect-[3/4] rounded-2xl bg-gradient-to-br from-[#121929] via-[#0B0F19] to-black border transition-all duration-200 cursor-pointer select-none shadow-md ${
          isSelected
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-2xl'
            : 'border-white/10 hover:border-amber-400/50 hover:scale-[1.01]'
        } ${isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 overflow-hidden'}`}
      >
        {/* Arrière-plan : aperçu audio haute fidélité */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <AudioCardPreview
            track={file}
            className="w-full h-full object-cover opacity-45 group-hover:scale-105 group-hover:opacity-65 transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

          {/* AU MILIEU : LE LOGO DE MUSIQUE / MÉLODIE DÉTAILLÉ & NET */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-[0_8px_25px_rgba(245,158,11,0.55)] group-hover:scale-110 transition-all duration-300 border-2 border-white/30 ring-2 ring-black/40 relative">
              <div className="absolute inset-1.5 rounded-full border border-white/20 pointer-events-none" />
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] relative z-10"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2.5 10.5C2.5 7.8 4.2 5.5 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                <path d="M21.5 10.5C21.5 7.8 19.8 5.5 17.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
                <path d="M9 16.5V5.5L20 3.5V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 9.5L20 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <ellipse cx="6" cy="16.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 6 16.5)" />
                <ellipse cx="17" cy="14.5" rx="3" ry="2.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.8" transform="rotate(-15 17 14.5)" />
              </svg>
            </div>
          </div>

          {/* Titre et Artiste en bas sur dégradé sombre */}
          <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <p className="text-[10px] sm:text-xs font-bold text-white truncate drop-shadow-sm">{file.name}</p>
            <p className="text-[9px] text-amber-300/90 font-semibold truncate">{file.artist || file.source || 'Fichier Audio'}</p>
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits, Checkbox & Badge Sécurisé */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex items-center gap-1.5">
          <div className="relative studycloud-sec-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1 sm:p-1.2 rounded-lg bg-black/75 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg backdrop-blur-sm ${
                isMenuOpen ? 'border-amber-400 ring-2 ring-amber-400/50 bg-black' : 'border-white/30'
              }`}
              title="Options (3 traits)"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {isMenuOpen && renderOptionsMenu(file)}
          </div>

          <button
            type="button"
            onClick={(e) => toggleSelect(file.id, e)}
            className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
            title={isSelected ? "Désélectionner" : "Sélectionner"}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 fill-amber-400 text-stone-950" />
            ) : (
              <Square className="w-4 h-4 text-white" />
            )}
          </button>

          <span className="p-1 rounded-md bg-black/75 text-emerald-400 border border-emerald-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Protégé">
            <Lock className="w-3 h-3 text-blue-400" />
          </span>
        </div>

        {/* Haut droit : Taille */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
          <span className="text-[10px] sm:text-xs font-black text-white bg-black/70 px-1.5 py-0.5 rounded border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
            {file.size || 'Audio'}
          </span>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE IMAGE AUTHENTIQUE (aspect-[3/4] comme les documents, vignette réelle, bouton 3 traits)
  // =========================================================================
  const renderImageCard = (file: FileItem) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedIds.has(file.id);
    const imgUrl = file.previewUrl || file.thumbnailUrl || (file as any).imageUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => setPreviewFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen
            ? 'z-50 relative overflow-visible'
            : isSelected
            ? 'z-20 relative overflow-hidden'
            : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-emerald-400 ring-4 ring-emerald-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-blue-400 ring-2 ring-blue-400/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-emerald-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan vignette */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {imgUrl ? (
            <img src={imgUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <ImageIcon className="w-10 h-10 text-emerald-400/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Barre supérieure : Bouton 3 traits, Checkbox & Badge Sécurisé / Taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-sec-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(prev => prev === file.id ? null : file.id);
                }}
                className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                  isMenuOpen ? 'border-blue-400 ring-2 ring-blue-400/50 bg-black' : 'border-white/20'
                }`}
                title="Options"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {isMenuOpen && renderOptionsMenu(file)}
            </div>

            <button
              type="button"
              onClick={(e) => toggleSelect(file.id, e)}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isSelected ? "Désélectionner" : "Sélectionner"}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 fill-emerald-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="p-1 rounded-md bg-black/75 text-emerald-400 border border-emerald-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Protégé">
              <Lock className="w-3 h-3 text-blue-400" />
            </span>
            <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
              {file.size || '0 o'}
            </span>
          </div>
        </div>

        {/* Barre inférieure : Nom & Date */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-emerald-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Image sécurisée'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE VIDÉO AUTHENTIQUE (aspect-[3/4] comme les documents, VideoCardPreview, bouton play central)
  // =========================================================================
  const renderVideoCard = (file: FileItem) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedIds.has(file.id);

    return (
      <div
        key={file.id}
        onClick={() => setPreviewFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen
            ? 'z-50 relative overflow-visible'
            : isSelected
            ? 'z-20 relative overflow-hidden'
            : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-purple-400 ring-4 ring-purple-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-blue-400 ring-2 ring-blue-400/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-purple-500/50 hover:scale-[1.01]'
        }`}
      >
        {/* Arrière-plan vignette vidéo */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          <VideoCardPreview vid={file} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Bouton play stylisé au centre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 rounded-full bg-white/95 text-stone-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-4 h-4 fill-stone-950 ml-0.5" />
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits, Checkbox & Badge Sécurisé / Taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-sec-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(prev => prev === file.id ? null : file.id);
                }}
                className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                  isMenuOpen ? 'border-blue-400 ring-2 ring-blue-400/50 bg-black' : 'border-white/20'
                }`}
                title="Options"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {isMenuOpen && renderOptionsMenu(file)}
            </div>

            <button
              type="button"
              onClick={(e) => toggleSelect(file.id, e)}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isSelected ? "Désélectionner" : "Sélectionner"}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 fill-purple-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="p-1 rounded-md bg-black/75 text-emerald-400 border border-emerald-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Protégé">
              <Lock className="w-3 h-3 text-blue-400" />
            </span>
            <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
              {file.size || '0 o'}
            </span>
          </div>
        </div>

        {/* Barre inférieure : Nom & Date */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Vidéo sécurisée'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT AUTHENTIQUE (aspect-[3/4], thème couleur, DocumentCardPreview)
  // =========================================================================
  const renderDocumentCard = (file: FileItem) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedIds.has(file.id);
    const theme = getDocumentTheme(file.extension || (file.name.includes('.') ? file.name.split('.').pop() || 'PDF' : 'PDF'));

    return (
      <div
        key={file.id}
        style={{ background: theme.bg }}
        onClick={() => setPreviewFile(file)}
        className={`group aspect-[3/4] ${theme.border} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative select-none cursor-pointer ${
          isSelected
            ? 'ring-4 ring-white/90 shadow-2xl scale-[1.02] z-20'
            : isMenuOpen
            ? 'ring-4 ring-blue-400/80 shadow-2xl z-50 overflow-visible'
            : 'hover:scale-[1.01] shadow-md active:scale-98 z-10 overflow-hidden'
        }`}
      >
        {/* Barre supérieure : Bouton 3 traits, Checkbox & Badge Sécurisé / Taille */}
        <div className="relative z-20 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <div className="relative studycloud-sec-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(prev => prev === file.id ? null : file.id);
                }}
                className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                  isMenuOpen ? 'border-blue-400 ring-2 ring-blue-400/50 bg-black' : 'border-white/20'
                }`}
                title="Options"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {isMenuOpen && renderOptionsMenu(file)}
            </div>

            <button
              type="button"
              onClick={(e) => toggleSelect(file.id, e)}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isSelected ? "Désélectionner" : "Sélectionner"}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 fill-white text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="p-0.5 rounded bg-black/60 text-blue-300 border border-blue-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Protégé">
              <Lock className="w-2.5 h-2.5 text-blue-300" />
            </span>
            <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
              {file.size || '0 o'}
            </span>
          </div>
        </div>

        {/* Cadre d'aperçu du document */}
        <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white relative shadow-inner border border-white/20 flex flex-col justify-between pointer-events-none">
          <DocumentCardPreview doc={file as any} />
        </div>

        {/* Titre unique en bas */}
        <div className="px-0.5 mb-1">
          <p className="text-[9px] sm:text-[10px] font-black text-white truncate drop-shadow-md" title={file.name}>
            {file.name}
          </p>
        </div>

        {/* Pied de carte : typeBadge et bouton de déverrouillage / téléchargement */}
        <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
          <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
            {theme.typeBadge}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(file);
              }}
              className="p-1 rounded-md bg-black/40 hover:bg-emerald-500/30 text-emerald-400 border border-white/20 transition-all cursor-pointer active:scale-95"
              title="Déverrouiller vers l'emplacement d'origine"
            >
              <Unlock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(file);
              }}
              className="p-1 rounded-md bg-black/40 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer active:scale-95"
              title="Télécharger"
            >
              <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOSSIER / CLASSEUR 3D AUTHENTIQUE (aspect-[3/4] comme les documents, Classeur3DFolderCard)
  // =========================================================================
  const renderClasseurCard = (file: FileItem) => {
    const isMenuOpen = activeMenuFileId === file.id;
    const isSelected = selectedIds.has(file.id);
    const folderData = (file as any).folderData || file;

    return (
      <div
        key={file.id}
        onClick={() => setPreviewFile(file)}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none cursor-pointer ${
          isMenuOpen
            ? 'z-50 relative overflow-visible'
            : isSelected
            ? 'z-20 relative overflow-hidden'
            : 'z-10 relative overflow-hidden'
        } ${
          isSelected
            ? 'border-orange-400 ring-4 ring-orange-400/90 shadow-2xl scale-[1.02]'
            : isMenuOpen
            ? 'border-blue-400 ring-2 ring-blue-400/40 shadow-2xl'
            : 'border-white/10 hover:border-orange-400/50 hover:scale-[1.01]'
        }`}
      >
        {/* Barre supérieure : Bouton 3 traits, Checkbox & Badge Sécurisé */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <div className="relative studycloud-sec-menu-trigger">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuFileId(prev => prev === file.id ? null : file.id);
                }}
                className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border border-white/20 transition-all cursor-pointer active:scale-90 shadow-md"
                title="Options"
              >
                <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
              {isMenuOpen && renderOptionsMenu(file)}
            </div>

            <button
              type="button"
              onClick={(e) => toggleSelect(file.id, e)}
              className="p-1 rounded-md bg-black/60 text-white hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm border border-white/20"
              title={isSelected ? "Désélectionner" : "Sélectionner"}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 fill-orange-400 text-stone-950" />
              ) : (
                <Square className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <span className="p-1 rounded-md bg-black/75 text-emerald-400 border border-emerald-400/40 shadow-sm flex items-center justify-center backdrop-blur-sm" title="Protégé">
            <Lock className="w-3 h-3 text-blue-400" />
          </span>
        </div>

        {/* Représentation 3D du dossier */}
        <div className="pt-2 pb-1 w-full px-2 flex items-center justify-center my-auto">
          <Classeur3DFolderCard folder={folderData as any} />
        </div>

        {/* Nom du dossier en bas */}
        <div className="p-2 bg-black/70 backdrop-blur-md border-t border-white/10 text-center">
          <p className="text-xs font-bold text-white truncate" title={file.name}>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  // Icône selon catégorie
  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'images':
        return <ImageIcon className="w-5 h-5 text-purple-400" />;
      case 'videos':
        return <Film className="w-5 h-5 text-amber-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-emerald-400" />;
      default:
        return <FileText className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-stone-100 text-stone-900 select-none animate-in fade-in duration-200">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU DOSSIER SÉCURISÉ */}
      <header className="sticky top-0 z-30 w-full bg-stone-100/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-200 shadow-sm">
        <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Bloc Gauche : Retour et Titre */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-stone-700/50 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl border ${isUnlocked ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 'bg-[#182032] border-stone-700/50 text-blue-400'}`}>
                {isUnlocked ? <Unlock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />}
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-stone-900 leading-tight">
                  Dossier sécurisé
                </h1>
                <p className={`text-[10px] sm:text-[11px] font-semibold leading-tight ${isUnlocked ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {isUnlocked ? `${secureFiles.length} fichier(s) protégé(s)` : 'Coffre-fort verrouillé'}
                </p>
              </div>
            </div>
          </div>

          {/* Bloc Milieu : Barre de Recherche (visible quand déverrouillé) */}
          {isUnlocked && (
            <div className="flex-1 max-w-xs md:max-w-sm relative order-3 sm:order-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un fichier protégé..."
                className="w-full bg-white border border-stone-300 focus:border-blue-500 rounded-full pl-9 pr-8 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Bloc Droite : Actions Déverrouillé */}
          {isUnlocked && (
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 order-2 sm:order-3">
              <button
                type="button"
                onClick={() => setShowChangePinModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-200/80 hover:bg-stone-300 text-stone-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
                title="Modifier le code secret"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Changer de code</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-blue-400 border border-blue-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Ajouter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(false);
                  setSelectedIds(new Set());
                  setPreviewFile(null);
                  showToast('Dossier sécurisé verrouillé 🔒');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 text-red-600 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95"
                title="Verrouiller le coffre"
              >
                <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">Verrouiller</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      {!isUnlocked ? (
        /* ÉCRAN DE VERROUILLAGE */
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-stone-200 p-6 sm:p-8 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
              <KeyRound className="w-8 h-8 stroke-[2]" />
            </div>

            <div>
              <h2 className="text-lg font-black text-stone-800">
                {hasServerPin === false ? 'Créer votre code secret' : 'Déverrouiller le Dossier Sécurisé'}
              </h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                {hasServerPin === false
                  ? 'Définissez un code secret à 4 caractères minimum pour protéger vos fichiers confidentiels.'
                  : 'Saisissez votre code secret pour accéder à votre coffre-fort confidentiel.'}
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-3 text-left">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={securePinInput}
                  onChange={(e) => {
                    setSecurePinInput(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="Code secret (≥ 4 caractères)"
                  className="w-full bg-[#050812] border border-white/10 focus:border-blue-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {hasServerPin === false && (
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={securePinConfirmInput}
                  onChange={(e) => {
                    setSecurePinConfirmInput(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="Confirmez le code secret"
                  className="w-full bg-[#050812] border border-white/10 focus:border-blue-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              )}

              {pinError && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingPin}
                className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-black font-black text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
              >
                {isSubmittingPin ? 'Vérification...' : (hasServerPin === false ? 'Enregistrer le code' : 'Déverrouiller')}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* VUE DES FICHIERS PROTÉGÉS */
        <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-36">
          {/* Filtres par catégorie et sélection */}
          {secureFiles.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-stone-200/80 hover:bg-stone-300 text-stone-700'
                  }`}
                >
                  Tout ({categoryCounts.all})
                </button>
                {categoryCounts.audio > 0 && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('audio')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === 'audio'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-stone-200/80 hover:bg-stone-300 text-stone-700'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Audios ({categoryCounts.audio})</span>
                  </button>
                )}
                {categoryCounts.documents > 0 && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('documents')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === 'documents'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-stone-200/80 hover:bg-stone-300 text-stone-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documents ({categoryCounts.documents})</span>
                  </button>
                )}
                {categoryCounts.images > 0 && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('images')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === 'images'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-stone-200/80 hover:bg-stone-300 text-stone-700'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Images ({categoryCounts.images})</span>
                  </button>
                )}
                {categoryCounts.videos > 0 && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('videos')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === 'videos'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-stone-200/80 hover:bg-stone-300 text-stone-700'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Vidéos ({categoryCounts.videos})</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 px-2.5 py-1 rounded-lg hover:bg-stone-200 transition-colors"
                >
                  {selectedIds.size === displayedFiles.length && displayedFiles.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )}
                  <span>{selectedIds.size === displayedFiles.length && displayedFiles.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
                </button>
              </div>
            </div>
          )}

          {displayedFiles.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-white border border-stone-200 flex items-center justify-center mb-4 shadow-sm">
                <ShieldCheck className="w-10 h-10 text-blue-500 opacity-60 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-black text-stone-800 mb-1.5">
                {searchQuery ? 'Aucun résultat trouvé' : 'Aucun fichier protégé dans cette catégorie'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 mb-6 leading-relaxed">
                {searchQuery
                  ? `Aucun fichier ne correspond à votre recherche "${searchQuery}".`
                  : 'Importez ou déplacez vos documents confidentiels, relevés ou notes secrètes ici.'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-full bg-blue-500 hover:bg-blue-400 text-black font-black text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Ajouter un fichier confidentiel</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {displayedFiles.map((file) => {
                const fType = getFileType(file);
                if (fType === 'audio') return renderAudioCard(file);
                if (fType === 'image') return renderImageCard(file);
                if (fType === 'video') return renderVideoCard(file);
                if (fType === 'folder') return renderClasseurCard(file);
                return renderDocumentCard(file);
              })}
            </div>
          )}
        </main>
      )}

      {/* BARRE D'ACTIONS FLOTTANTE LORS DE LA SÉLECTION MULTIPLE */}
      {isUnlocked && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#070A14] text-white border border-white/20 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="text-xs font-bold text-blue-400 shrink-0">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>

          <div className="h-4 w-px bg-white/20" />

          {/* Déverrouiller la sélection */}
          <button
            type="button"
            onClick={handleBatchRestore}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 shadow"
            title="Restaurer vers les menus d'origine"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Déverrouiller</span>
          </button>

          {/* Supprimer vers la corbeille */}
          <button
            type="button"
            onClick={handleBatchTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 shadow"
            title="Mettre dans la corbeille"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Corbeille</span>
          </button>

          {/* Annuler sélection */}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-stone-400 hover:text-white"
            title="Annuler la sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL DE PRÉVISUALISATION MULTIMÉDIA */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#090D1A] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête de la visionneuse */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 bg-[#05070F]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  {renderCategoryIcon(previewFile.category)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{previewFile.name}</h3>
                  <p className="text-[11px] text-slate-400">{previewFile.size} • {previewFile.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDownload(previewFile)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRestore(previewFile);
                    setPreviewFile(null);
                  }}
                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                  title="Déverrouiller vers l'emplacement d'origine"
                >
                  <Unlock className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteToTrash(previewFile);
                    setPreviewFile(null);
                  }}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                  title="Mettre dans la corbeille"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contenu multimédia selon le type */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
              {previewFile.category === 'images' ? (
                <img
                  src={previewFile.url || previewFile.previewUrl}
                  alt={previewFile.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              ) : previewFile.category === 'videos' ? (
                <video
                  src={previewFile.url || previewFile.previewUrl}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full rounded-xl shadow-lg"
                />
              ) : previewFile.category === 'audio' || getFileType(previewFile) === 'audio' ? (
                <div className="w-full max-w-md p-6 rounded-3xl bg-[#0F1424] border border-white/15 text-center space-y-4 shadow-2xl">
                  <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden mx-auto shadow-2xl border border-white/20 relative group bg-black">
                    <AudioCardPreview track={previewFile} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white truncate px-2">{previewFile.name}</h4>
                    <p className="text-xs text-amber-300 font-semibold mt-0.5">{previewFile.artist || previewFile.source || 'Fichier Audio'}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{previewFile.size} • {previewFile.date}</p>
                  </div>
                  <audio
                    src={previewFile.url || previewFile.previewUrl}
                    controls
                    autoPlay
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <FileText className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{previewFile.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">Format {previewFile.extension || 'DOCUMENT'} • {previewFile.size}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {onOpenStudySpace && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenStudySpace(previewFile, 'Dossier sécurisé');
                          setPreviewFile(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Ouvrir dans l'Espace d'étude</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownload(previewFile)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MODIFICATION DU CODE PIN */}
      {showChangePinModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowChangePinModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-stone-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-stone-800">Modifier le code secret</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">Ancien code secret</label>
                <input
                  type="password"
                  value={oldPinInput}
                  onChange={(e) => {
                    setOldPinInput(e.target.value);
                    setChangePinError(null);
                  }}
                  placeholder="Code actuel"
                  className="w-full bg-stone-50 border border-stone-300 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">Nouveau code secret (≥ 4 car.)</label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => {
                    setNewPinInput(e.target.value);
                    setChangePinError(null);
                  }}
                  placeholder="Nouveau code secret"
                  className="w-full bg-stone-50 border border-stone-300 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">Confirmez le nouveau code</label>
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => {
                    setConfirmNewPinInput(e.target.value);
                    setChangePinError(null);
                  }}
                  placeholder="Confirmez le nouveau code"
                  className="w-full bg-stone-50 border border-stone-300 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none"
                />
              </div>

              {changePinError && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{changePinError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isChangingPin}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md active:scale-95"
                >
                  {isChangingPin ? 'Modification...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-blue-500/40 text-blue-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
