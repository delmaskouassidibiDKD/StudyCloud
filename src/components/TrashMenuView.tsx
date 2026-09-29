import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FolderArchive,
  Check,
  CheckSquare,
  Square,
  Menu,
  Play,
  FileEdit
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { deleteFileBlob } from '../services/localFileStorage';
import { FileItem } from './Page1FilesMenuView';
import { AudioCardPreview } from './AudioCardPreview';
import { DocumentCardPreview } from './DocumentCardPreview';

interface TrashMenuViewProps {
  onBack: () => void;
}

export const TrashMenuView: React.FC<TrashMenuViewProps> = ({ onBack }) => {
  const [trashList, setTrashList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().trash || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'audio' | 'documents' | 'images' | 'videos' | 'classeur'>('all');

  // UN SEUL menu 3-traits actif à la fois (ferme automatiquement tout autre menu)
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Mode sélection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modale de confirmation "Vider la corbeille"
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fermer le menu 3 traits si on clique en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.studycloud-trash-menu-panel') && !target.closest('.studycloud-trash-menu-trigger')) {
        setActiveMenuFileId(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  // Écoute en temps réel du CloudDataStore (synchronisation locale et réplication D1)
  useEffect(() => {
    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (Array.isArray(state.trash)) {
        setTrashList(state.trash);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Chargement initial depuis l'API distante
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getTrashFiles()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setTrashList(data);
          CloudDataStore.setTrashFiles(data as any);
        }
      })
      .catch((err) => console.warn('[TrashMenuView] Error fetching trash:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Restaurer un fichier individuel
  const handleRestore = async (file: FileItem) => {
    setTrashList(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.restoreFromTrash(file as any);
    await CloudStorageAPI.restoreTrashItem(file.id).catch(() => {});
    showToast(`"${file.name}" a été restauré dans son menu d'origine`);
  };

  // Supprimer définitivement un fichier
  const handleDeletePermanently = async (file: FileItem) => {
    setTrashList(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.removeFile(file.id);
    deleteFileBlob(file.id).catch(() => {});
    await CloudStorageAPI.deleteTrashPermanently([file.id]).catch(() => {});
    showToast(`"${file.name}" a été supprimé définitivement`);
  };

  // Vider toute la corbeille
  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      const allIds = trashList.map(f => f.id);
      setTrashList([]);
      CloudDataStore.emptyTrash();
      allIds.forEach(id => deleteFileBlob(id).catch(() => {}));
      await CloudStorageAPI.deleteTrashPermanently(allIds).catch(() => {});
      showToast('La corbeille a été vidée avec succès');
      setIsConfirmEmptyOpen(false);
    } catch (e) {
      showToast('Erreur lors du vidage de la corbeille');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restaurer les éléments sélectionnés
  const handleRestoreSelected = async () => {
    const toRestore = trashList.filter(f => selectedIds.includes(f.id));
    for (const f of toRestore) {
      await handleRestore(f);
    }
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // Supprimer définitivement les éléments sélectionnés
  const handleDeleteSelected = async () => {
    const toDelete = trashList.filter(f => selectedIds.includes(f.id));
    for (const f of toDelete) {
      await handleDeletePermanently(f);
    }
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // Sélectionner / désélectionner un élément
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(filteredTrash.map(f => f.id));
  };

  // Filtrage selon catégorie et recherche
  const filteredTrash = useMemo(() => {
    let list = trashList;

    if (activeFilter !== 'all') {
      list = list.filter(f => {
        const cat = (f.sourceCategory || f.originalCategory || f.category || '').toLowerCase();
        if (activeFilter === 'audio') return cat === 'audio' || Boolean(f.isAudio);
        if (activeFilter === 'documents') return cat === 'documents' || Boolean(f.isDocument);
        if (activeFilter === 'images') return cat === 'images' || Boolean(f.isImage);
        if (activeFilter === 'videos') return cat === 'videos' || Boolean(f.isVideo);
        if (activeFilter === 'classeur') return cat === 'classeur' || cat === 'classeur_folder';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q) || (f.artist && f.artist.toLowerCase().includes(q)));
    }

    return list;
  }, [trashList, activeFilter, searchQuery]);

  // Groupement par catégorie pour affichage fidèle avec titres de sections
  const categorized = useMemo(() => {
    const audios: FileItem[] = [];
    const documents: FileItem[] = [];
    const images: FileItem[] = [];
    const videos: FileItem[] = [];
    const classeur: FileItem[] = [];
    const others: FileItem[] = [];

    filteredTrash.forEach(file => {
      const cat = (file.sourceCategory || file.originalCategory || file.category || '').toLowerCase();
      const ext = (file.extension || (file.name.includes('.') ? file.name.split('.').pop() || '' : '')).toLowerCase();

      if (cat === 'audio' || file.isAudio || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
        audios.push(file);
      } else if (cat === 'documents' || file.isDocument || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) {
        documents.push(file);
      } else if (cat === 'images' || file.isImage || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
        images.push(file);
      } else if (cat === 'videos' || file.isVideo || ['mp4', 'mov', 'mkv', 'webm', 'avi', '3gp'].includes(ext)) {
        videos.push(file);
      } else if (cat === 'classeur' || cat === 'classeur_folder') {
        classeur.push(file);
      } else {
        others.push(file);
      }
    });

    return { audios, documents, images, videos, classeur, others };
  }, [filteredTrash]);

  // =========================================================================
  // MENU DÉDIÉ 3 TRAITS FLOTTANT AU-DESSUS DE LA CARTE (SANS ÊTRE CONFONDU)
  // =========================================================================
  const renderOptionsMenu = (file: FileItem, index?: number) => {
    if (activeMenuFileId !== file.id) return null;
    const isChecked = selectedIds.includes(file.id);
    const isRightCol = typeof index === 'number' && ((index + 1) % 2 === 0 || (index + 1) % 3 === 0 || (index + 1) % 4 === 0);
    const alignClass = isRightCol ? 'right-0' : 'left-0';

    return (
      <div
        className={`studycloud-trash-menu-panel absolute ${alignClass} top-9 z-[150] w-56 sm:w-64 bg-[#0A0F1D] border-2 border-rose-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(244,63,94,0.35)] text-white animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col p-0.5`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : Titre du fichier, Sous-titre rouge CORBEILLE, et Croix de fermeture */}
        <div className="px-3 py-2 bg-[#0E1527] border-b border-rose-500/25 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-black text-white truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">
              {file.size || '0 o'} • CORBEILLE
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

        {/* Options déroulantes */}
        <div className="py-1 divide-y divide-white/5">
          {/* Option 1 : Cocher / Décocher */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(file.id);
              setIsSelectionMode(true);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span>{isChecked ? 'Décocher' : 'Cocher'}</span>
          </button>

          {/* Option 2 : Tout cocher */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectAll();
              setIsSelectionMode(true);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span>Tout cocher</span>
          </button>

          {/* Option 3 : Restaurer */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer text-left"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Restaurer</span>
          </button>

          {/* Option 4 : Supprimer définitivement */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePermanently(file);
              setActiveMenuFileId(null);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>Supprimer définitivement</span>
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE AUDIO CARRÉE AVEC APERÇU ET LOGO MÉLODIE
  // =========================================================================
  const renderAudioCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) toggleSelect(file.id);
        }}
        className={`group aspect-square rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-amber-500/50'
        }`}
      >
        {/* Arrière-plan : aperçu audio ou pochette créateur haute fidélité */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
          <AudioCardPreview track={file} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 pointer-events-none" />
        </div>

        {/* Logo mélodie central en filigrane */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-amber-400/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Music className="w-6 h-6 text-amber-400/90" />
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits & badge taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-trash-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '108 Ko'}
          </span>
        </div>

        {/* Barre inférieure : Titre, Artiste et bouton restauration directe */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] font-semibold text-amber-400/90 truncate uppercase tracking-wider">
              {file.artist || 'CRÉATEUR AUDIO OFFICIEL'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE DOCUMENT (AVEC APERÇU MINIATURE DÉDIÉ ET BOUTON 3 TRAITS)
  // =========================================================================
  const renderDocumentCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) toggleSelect(file.id);
        }}
        className={`group aspect-[3/4] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-blue-500/50'
        }`}
      >
        {/* Barre supérieure : Bouton 3 traits & Badge taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-trash-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Cadre d'aperçu du document (DocumentCardPreview fidèle) */}
        <div className="relative z-10 flex-1 w-full px-2 py-1 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
            <DocumentCardPreview doc={file as any} />
          </div>
        </div>

        {/* Barre inférieure : Nom du document & bouton restauration rapide */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-blue-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Document'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE IMAGE (AVEC VIGNETTE DIRECTE ET BOUTON 3 TRAITS)
  // =========================================================================
  const renderImageCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const imgUrl = file.previewUrl || file.thumbnailUrl || (file as any).imageUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) toggleSelect(file.id);
        }}
        className={`group aspect-[4/3] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-emerald-500/50'
        }`}
      >
        {/* Arrière-plan vignette */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {imgUrl ? (
            <img src={imgUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <ImageIcon className="w-10 h-10 text-emerald-400/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
        </div>

        {/* Barre supérieure : Bouton 3 traits & Taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-trash-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Barre inférieure : Nom & Restaurer */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-emerald-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Image'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE VIDÉO (AVEC VIGNETTE VIDÉO, BADGE DURÉE ET BOUTON 3 TRAITS)
  // =========================================================================
  const renderVideoCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;
    const vidUrl = file.previewUrl || file.thumbnailUrl || (file as any).videoUrl || file.url || '';

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) toggleSelect(file.id);
        }}
        className={`group aspect-[4/3] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-purple-500/50'
        }`}
      >
        {/* Arrière-plan vignette vidéo */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-2xl pointer-events-none">
          {vidUrl && !vidUrl.toLowerCase().endsWith('.mp4') ? (
            <img src={vidUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Film className="w-10 h-10 text-purple-400/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 pointer-events-none" />
        </div>

        {/* Bouton play stylisé au centre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-purple-400/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-4 h-4 fill-purple-400 text-purple-400 ml-0.5" />
          </div>
        </div>

        {/* Barre supérieure : Bouton 3 traits & Taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-trash-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Barre inférieure : Nom & Restaurer */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Vidéo'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // CARTE CLASSEUR / DOSSIER / NOTE
  // =========================================================================
  const renderClasseurCard = (file: FileItem, index: number) => {
    const isChecked = selectedIds.includes(file.id);
    const isMenuOpen = activeMenuFileId === file.id;

    return (
      <div
        key={file.id}
        onClick={() => {
          if (isSelectionMode) toggleSelect(file.id);
        }}
        className={`group aspect-[4/3] rounded-2xl bg-[#0A0D18] border transition-all flex flex-col justify-between shadow-md select-none ${
          isMenuOpen ? 'z-50 relative overflow-visible' : 'z-10 relative overflow-hidden'
        } ${
          isChecked
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
            : isMenuOpen
            ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-2xl'
            : 'border-stone-800/80 hover:border-orange-500/50'
        }`}
      >
        {/* Barre supérieure : Bouton 3 traits & Taille */}
        <div className="relative z-20 p-2 flex items-center justify-between gap-1">
          <div className="relative studycloud-trash-menu-trigger">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuFileId(prev => prev === file.id ? null : file.id);
              }}
              className={`p-1.5 rounded-lg bg-black/80 hover:bg-black text-white border transition-all cursor-pointer active:scale-90 shadow-md ${
                isMenuOpen ? 'border-rose-400 ring-2 ring-rose-400/50 bg-black' : 'border-white/20'
              }`}
              title="Options corbeille"
            >
              <Menu className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            {/* Menu indépendant qui flotte au-dessus sans être confondu */}
            {isMenuOpen && renderOptionsMenu(file, index)}
          </div>

          <span className="text-[9px] font-black bg-black/80 text-white px-2 py-0.5 rounded-md border border-white/15 shadow-sm">
            {file.size || '0 o'}
          </span>
        </div>

        {/* Centre icône classeur */}
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
            {file.isNotepad ? (
              <FileEdit className="w-6 h-6 text-orange-400" />
            ) : (
              <FolderArchive className="w-6 h-6 text-orange-400" />
            )}
          </div>
        </div>

        {/* Barre inférieure : Nom & Restaurer */}
        <div className="relative z-20 p-2.5 bg-black/75 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white truncate group-hover:text-orange-300 transition-colors" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {file.date || 'Classeur'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(file);
            }}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Restaurer immédiatement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-white text-stone-900 select-none overflow-hidden animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU CORBEILLE (TOUJOURS ANCRÉ EN HAUT, NE BOUGE PAS AU DÉFILEMENT) */}
      <header className="shrink-0 z-30 w-full bg-[#0A0E1A] px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 sm:py-3 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour rond, Icône Corbeille rouge et Titre StudyCloud */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-full bg-[#182032] hover:bg-[#222c44] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-md">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base md:text-lg font-black text-white leading-tight">
                  Corbeille
                </h1>
                <p className="text-[11px] font-semibold text-slate-400 leading-tight">
                  StudyCloud
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Corbeille */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-rose-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans la corbeille..."
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

          {/* DROITE : Bouton Vider la corbeille & Mode sélection */}
          <div className="shrink-0 flex items-center gap-2">
            {trashList.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/40 transition-all cursor-pointer active:scale-95 shadow-sm text-xs sm:text-sm font-bold"
                title="Vider définitivement tous les éléments"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Vider la corbeille</span>
                <span className="sm:hidden">Vider</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-rose-500 text-white border-rose-400 font-bold'
                  : 'bg-[#182032] hover:bg-[#222c44] text-white border-white/10'
              }`}
              title={isSelectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE RAPIDE FIXES DANS L'EN-TÊTE */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-0.5 scrollbar-none">
          {[
            { id: 'all', label: 'TOUS' },
            { id: 'audio', label: 'AUDIO' },
            { id: 'documents', label: 'DOCUMENTS' },
            { id: 'images', label: 'IMAGES' },
            { id: 'videos', label: 'VIDÉOS' },
            { id: 'classeur', label: 'CLASSEUR' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-[#10162A] text-slate-300 hover:text-white hover:bg-[#192242] border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* BANDEAU DE SÉLECTION MULTIPLE FLOTTANT FIXE SOUS L'EN-TÊTE */}
      {isSelectionMode && (
        <div className="shrink-0 z-20 w-full bg-[#0F1424] border-b border-rose-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredTrash.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredTrash.map(f => f.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2 cursor-pointer"
            >
              {selectedIds.length === filteredTrash.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleRestoreSelected}
                  className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurer ({selectedIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedIds.length})</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL DE LA CORBEILLE (TOTALEMENT BLANC ET DÉFILANT INDÉPENDAMMENT) */}
      <main className="flex-1 w-full overflow-y-auto bg-white px-3 sm:px-6 md:px-10 lg:px-12 py-5 pb-64 sm:pb-80">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-stone-500">Chargement de la corbeille...</p>
          </div>
        ) : filteredTrash.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4 shadow-sm">
              <Trash2 className="w-10 h-10 text-rose-500 opacity-60 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-stone-800 mb-1.5">
              {searchQuery ? 'Aucun élément trouvé' : 'La corbeille est vide'}
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
              {searchQuery
                ? `Aucun élément de la corbeille ne correspond à "${searchQuery}".`
                : 'Les fichiers supprimés depuis vos différents menus apparaîtront ici. Vous pourrez les restaurer à tout moment.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. SECTION FICHIERS AUDIO (CARRÉS AVEC LOGO MÉLODIE ET APERÇU) */}
            {categorized.audios.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-amber-600 border-b border-stone-200 pb-2">
                  <Music className="w-4 h-4" />
                  <span>Fichiers Audio ({categorized.audios.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {categorized.audios.map((file, idx) => renderAudioCard(file, idx))}
                </div>
              </section>
            )}

            {/* 2. SECTION DOCUMENTS */}
            {categorized.documents.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-blue-600 border-b border-stone-200 pb-2">
                  <FileText className="w-4 h-4" />
                  <span>Documents ({categorized.documents.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {categorized.documents.map((file, idx) => renderDocumentCard(file, idx))}
                </div>
              </section>
            )}

            {/* 3. SECTION IMAGES */}
            {categorized.images.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-emerald-600 border-b border-stone-200 pb-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>Images ({categorized.images.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {categorized.images.map((file, idx) => renderImageCard(file, idx))}
                </div>
              </section>
            )}

            {/* 4. SECTION VIDÉOS */}
            {categorized.videos.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-purple-600 border-b border-stone-200 pb-2">
                  <Film className="w-4 h-4" />
                  <span>Vidéos ({categorized.videos.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {categorized.videos.map((file, idx) => renderVideoCard(file, idx))}
                </div>
              </section>
            )}

            {/* 5. SECTION CLASSEUR / DOSSIERS */}
            {categorized.classeur.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-orange-600 border-b border-stone-200 pb-2">
                  <FolderArchive className="w-4 h-4" />
                  <span>Classeur & Dossiers ({categorized.classeur.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {categorized.classeur.map((file, idx) => renderClasseurCard(file, idx))}
                </div>
              </section>
            )}

            {/* 6. AUTRES FICHIERS */}
            {categorized.others.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm sm:text-base font-black text-stone-700 border-b border-stone-200 pb-2">
                  <FileText className="w-4 h-4" />
                  <span>Autres Fichiers ({categorized.others.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {categorized.others.map((file, idx) => renderDocumentCard(file, idx))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE CONFIRMATION VIDER LA CORBEILLE */}
      {isConfirmEmptyOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-[#0D1222] border border-rose-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Vider toute la corbeille ?</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Cette action supprimera définitivement les <span className="font-bold text-white">{trashList.length}</span> élément(s). Ils seront effacés du stockage et ne pourront plus jamais être restaurés.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? 'Suppression...' : 'Oui, vider définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-rose-500/40 text-rose-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
