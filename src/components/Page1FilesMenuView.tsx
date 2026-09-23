import React, { useState, useEffect, useMemo } from 'react';
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
  HardDrive, 
  Check, 
  ExternalLink, 
  Share2, 
  ChevronRight, 
  Eye, 
  Info, 
  Maximize2, 
  Minimize2, 
  Menu,
  ShieldCheck,
  FolderCheck,
  Plus,
  Play
} from 'lucide-react';
import { 
  StoredDeviceFile, 
  getStoredDeviceFiles, 
  saveDeviceFiles, 
  deleteStoredDeviceFile, 
  promptDeviceFilePicker 
} from '../services/deviceStorageService';
import { formatFileSize, getFileBlobUrl } from '../services/localFileStorage';

interface Page1FilesMenuViewProps {
  onBack: () => void;
}

interface FileItem {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps';
  source: string;
  size: string;
  sizeBytes: number;
  date: string;
  previewUrl?: string;
  isImage?: boolean;
}

interface SubMenuView {
  id: string;
  source: 'cloud' | 'device';
  type: 'category' | 'collection';
  name: string;
  icon: any;
  color: string;
}

export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack }) => {
  // Source active : 'cloud' (StudyCloud Drive) ou 'device' (Cet Appareil)
  const [activeDriveSource, setActiveDriveSource] = useState<'cloud' | 'device'>('cloud');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilePreview, setActiveFilePreview] = useState<FileItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Vrais fichiers du stockage local de l'appareil (IndexedDB + PWA)
  const [deviceFiles, setDeviceFiles] = useState<StoredDeviceFile[]>([]);
  const [isLoadingDeviceFiles, setIsLoadingDeviceFiles] = useState(true);

  // Sous-page ouverte (chaque bouton catégorie et collection possède son propre menu indépendant)
  const [currentSubView, setCurrentSubView] = useState<SubMenuView | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Chargement des vrais fichiers locaux de l'appareil au montage
  useEffect(() => {
    getStoredDeviceFiles()
      .then((files) => {
        setDeviceFiles(files);
      })
      .catch((err) => {
        console.warn('Erreur chargement fichiers locaux:', err);
      })
      .finally(() => {
        setIsLoadingDeviceFiles(false);
      });
  }, []);

  // 1. FICHIERS RÉCENTS : STUDYCLOUD DRIVE (Strictement 6 éléments maximum, 1 seule ligne)
  const [cloudRecentFiles, setCloudRecentFiles] = useState<FileItem[]>([
    {
      id: 'rec-cld-1',
      name: 'Cours_Supply_Chain_Logistique.pdf',
      category: 'documents',
      source: 'StudyCloud Drive',
      size: '4,2 Mo',
      sizeBytes: 4404019,
      date: "Aujourd'hui, 10:15"
    },
    {
      id: 'rec-cld-2',
      name: 'Synthese_Cours_Semestre_1.docx',
      category: 'documents',
      source: 'StudyCloud Drive',
      size: '1,1 Mo',
      sizeBytes: 1153433,
      date: "Aujourd'hui, 09:30"
    },
    {
      id: 'rec-cld-3',
      name: 'Devoir_Economie_Appliquee.pdf',
      category: 'documents',
      source: 'StudyCloud Drive',
      size: '2,8 Mo',
      sizeBytes: 2936012,
      date: 'Hier, 18:20'
    },
    {
      id: 'rec-cld-4',
      name: 'Projet_Algorithmique_V2.zip',
      category: 'downloads',
      source: 'StudyCloud Drive',
      size: '6,4 Mo',
      sizeBytes: 6710886,
      date: 'Hier, 16:45'
    },
    {
      id: 'rec-cld-5',
      name: 'Notes_Revision_Semestre_1.pdf',
      category: 'documents',
      source: 'StudyCloud Drive',
      size: '950 Ko',
      sizeBytes: 972800,
      date: '21 Sept, 14:00'
    },
    {
      id: 'rec-cld-6',
      name: 'Fiche_TD_Mathematiques.pdf',
      category: 'documents',
      source: 'StudyCloud Drive',
      size: '1,7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20'
    }
  ]);

  // Import réel de fichiers depuis l'appareil
  const handleImportDeviceFiles = async (forcedCategory?: 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps') => {
    try {
      const selected = await promptDeviceFilePicker({
        category: forcedCategory,
        multiple: true
      });

      if (selected && selected.length > 0) {
        const updated = await saveDeviceFiles(selected, forcedCategory);
        setDeviceFiles(updated);
        showToast(`${selected.length} fichier(s) importé(s) de votre appareil !`);
      }
    } catch (err) {
      console.error('Erreur import appareil:', err);
      showToast("Erreur lors de l'accès aux fichiers.");
    }
  };

  // Suppression d'un vrai fichier de l'appareil
  const handleDeleteDeviceFile = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = await deleteStoredDeviceFile(id);
      setDeviceFiles(updated);
      if (activeFilePreview?.id === id) {
        setActiveFilePreview(null);
      }
      setMenuOpenId(null);
      showToast("Fichier supprimé de l'appareil");
    } catch (err) {
      console.error('Erreur suppression fichier appareil:', err);
    }
  };

  // Téléchargement d'un fichier
  const handleDownloadFile = async (file: FileItem) => {
    try {
      let url = file.previewUrl;
      if (!url && file.id.startsWith('dev-file-')) {
        url = (await getFileBlobUrl(file.id)) || undefined;
      }
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Téléchargement de ${file.name}`);
      } else {
        showToast(`Téléchargement de ${file.name}...`);
      }
    } catch (e) {
      showToast('Erreur lors du téléchargement');
    }
  };

  // Partage de fichier
  const handleShareFile = async (file: FileItem) => {
    if (navigator.share && file.previewUrl) {
      try {
        await navigator.share({
          title: file.name,
          text: `Fichier partagé via StudyCloud: ${file.name}`
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

  // Gestion de la sélection d'un fichier (récent FIFO)
  const handleSelectFile = async (file: FileItem) => {
    let previewToUse = file.previewUrl;
    if (!previewToUse && file.id.startsWith('dev-file-')) {
      const blobUrl = await getFileBlobUrl(file.id);
      if (blobUrl) {
        previewToUse = blobUrl;
      }
    }
    setActiveFilePreview({ ...file, previewUrl: previewToUse });

    if (activeDriveSource === 'device') {
      setDeviceFiles(prev => {
        const withoutCurrent = prev.filter(f => f.id !== file.id);
        const updated = [{ ...file, previewUrl: previewToUse } as StoredDeviceFile, ...withoutCurrent];
        try {
          localStorage.setItem('studycloud_device_files', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    } else {
      setCloudRecentFiles(prev => {
        const withoutCurrent = prev.filter(f => f.id !== file.id);
        return [file, ...withoutCurrent].slice(0, 6);
      });
    }
  };

  // Calcul dynamique des statistiques par catégorie pour "Cet Appareil"
  const deviceCategoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalBytes: number }> = {
      downloads: { count: 0, totalBytes: 0 },
      images: { count: 0, totalBytes: 0 },
      videos: { count: 0, totalBytes: 0 },
      audio: { count: 0, totalBytes: 0 },
      documents: { count: 0, totalBytes: 0 },
      apps: { count: 0, totalBytes: 0 },
    };

    deviceFiles.forEach((f) => {
      if (stats[f.category]) {
        stats[f.category].count += 1;
        stats[f.category].totalBytes += f.sizeBytes || 0;
      }
    });

    return stats;
  }, [deviceFiles]);

  // Catégories pour "Cet Appareil" basées sur les vrais fichiers réels
  const deviceCategories = useMemo(() => {
    const formatStat = (catKey: string) => {
      const st = deviceCategoryStats[catKey];
      if (!st || st.count === 0) return '0 fichier';
      return `${st.count} fichier${st.count > 1 ? 's' : ''} • ${formatFileSize(st.totalBytes)}`;
    };

    return [
      {
        id: 'downloads',
        name: 'Téléchargements',
        size: formatStat('downloads'),
        icon: Download,
        color: 'text-sky-400'
      },
      {
        id: 'images',
        name: 'Images',
        size: formatStat('images'),
        icon: ImageIcon,
        color: 'text-emerald-400'
      },
      {
        id: 'videos',
        name: 'Vidéos',
        size: formatStat('videos'),
        icon: Film,
        color: 'text-purple-400'
      },
      {
        id: 'audio',
        name: 'Audio',
        size: formatStat('audio'),
        icon: Music,
        color: 'text-amber-400'
      },
      {
        id: 'documents',
        name: 'Documents',
        size: formatStat('documents'),
        icon: FileText,
        color: 'text-blue-400'
      },
      {
        id: 'apps',
        name: 'Applications',
        size: formatStat('apps'),
        icon: LayoutGrid,
        color: 'text-pink-400'
      }
    ];
  }, [deviceCategoryStats]);

  // Catégories pour "StudyCloud Drive"
  const cloudCategories = [
    {
      id: 'documents',
      name: 'Documents Cloud',
      size: '4,2 Go',
      icon: FileText,
      color: 'text-blue-400'
    },
    {
      id: 'sync',
      name: 'Synchronisation',
      size: 'Connecté',
      icon: Cloud,
      color: 'text-emerald-400'
    },
    {
      id: 'backups',
      name: 'Sauvegardes Cloud',
      size: '3,5 Go',
      icon: Cloud,
      color: 'text-sky-400'
    },
    {
      id: 'shares',
      name: 'Partages Actifs',
      size: '18 fichiers',
      icon: Share2,
      color: 'text-amber-400'
    },
    {
      id: 'courses',
      name: 'Mes Matières & TD',
      size: '24 cours',
      icon: FolderCheck,
      color: 'text-purple-400'
    },
    {
      id: 'security',
      name: 'Archives Sécurisées',
      size: 'Chiffré',
      icon: ShieldCheck,
      color: 'text-rose-400'
    }
  ];

  const currentCategories = activeDriveSource === 'cloud' ? cloudCategories : deviceCategories;

  // Collections (Les mêmes boutons ont des codes distincts selon Drive vs Appareil)
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

  // Liste active selon la source choisie (Drive Cloud ou Cet Appareil), strictement plafonnée à 6
  const activeRecentList = useMemo(() => {
    const list = activeDriveSource === 'cloud' ? cloudRecentFiles : deviceFiles;
    return list.slice(0, 6);
  }, [activeDriveSource, cloudRecentFiles, deviceFiles]);

  // Filtrage selon la recherche
  const displayedFiles = useMemo(() => {
    return activeRecentList.filter(f => {
      const matchQuery = searchQuery.trim() === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.source.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCat = !selectedCategory || f.category === selectedCategory;
      return matchQuery && matchCat;
    }).slice(0, 6); // STRICTEMENT 6 ÉLÉMENTS MAXIMUM
  }, [activeRecentList, searchQuery, selectedCategory]);

  // Ouverture d'un sous-menu indépendant propre à chaque bouton (non connectés entre eux)
  const handleOpenSubMenu = (
    type: 'category' | 'collection',
    id: string,
    name: string,
    icon: any,
    color: string
  ) => {
    const fullId = `${activeDriveSource}-${type}-${id}`;
    setCurrentSubView({
      id: fullId,
      source: activeDriveSource,
      type,
      name,
      icon,
      color
    });
  };

  // Fichiers du sous-menu actuel si c'est une catégorie
  const currentSubViewCategoryKey = useMemo(() => {
    if (!currentSubView || currentSubView.type !== 'category') return null;
    return currentSubView.id.replace(`${currentSubView.source}-category-`, '') as 'images' | 'videos' | 'audio' | 'documents' | 'downloads' | 'apps';
  }, [currentSubView]);

  const currentSubViewFiles = useMemo(() => {
    if (!currentSubView) return [];
    if (currentSubView.source === 'device' && currentSubViewCategoryKey) {
      return deviceFiles.filter(f => f.category === currentSubViewCategoryKey);
    }
    if (currentSubView.source === 'cloud' && currentSubViewCategoryKey === 'documents') {
      return cloudRecentFiles.filter(f => f.category === 'documents');
    }
    return [];
  }, [currentSubView, currentSubViewCategoryKey, deviceFiles, cloudRecentFiles]);

  return (
    <div className={`transition-colors duration-300 bg-[#F4F6F8] dark:bg-[#0C111D] text-stone-900 dark:text-slate-100 flex flex-col overflow-y-auto selection:bg-blue-600 selection:text-white ${
      isFullscreen
        ? 'fixed inset-0 z-50 w-screen h-screen'
        : 'absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-[calc(100vh-66px)]'
    }`}>
      
      {/* Toast Notification (pour actions fichiers uniquement, jamais au changement d'onglet) */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl border border-blue-400/30 animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SI UN SOUS-MENU EST OUVERT : NOUVELLE PAGE PROPRE ET INDÉPENDANTE         */}
      {/* ========================================================================= */}
      {currentSubView ? (
        <div className="flex-1 flex flex-col w-full animate-in fade-in duration-200">
          
          {/* En-tête de la sous-page avec bouton Retour vers le gestionnaire */}
          <div className="sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-3 border-b border-stone-300/70 dark:border-slate-800/60 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentSubView(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
                title="Retour au gestionnaire de fichiers"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                <span>Retour</span>
              </button>

              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl bg-black border border-white/10 ${currentSubView.color}`}>
                  <currentSubView.icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black text-stone-900 dark:text-white leading-tight">
                    {currentSubView.name}
                  </h1>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 dark:text-slate-400 leading-tight">
                    {currentSubView.source === 'cloud' ? 'StudyCloud Drive • En ligne' : 'Cet Appareil • Stockage local'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentSubView.source === 'device' && currentSubViewCategoryKey && (
                <button
                  type="button"
                  onClick={() => handleImportDeviceFiles(currentSubViewCategoryKey)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 border border-emerald-400/30"
                  title={`Ajouter des ${currentSubView.name} depuis cet appareil`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Ajouter</span>
                </button>
              )}
              <span className="text-[11px] font-bold text-slate-100 bg-[#04060A] border border-white/10 px-3 py-1 rounded-full hidden sm:inline-block shadow-sm">
                Code : {currentSubView.id}
              </span>
            </div>
          </div>

          {/* Corps de la page du sous-menu : Affichage des vrais fichiers ou écran vide personnalisé */}
          {currentSubViewFiles.length > 0 ? (
            <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-stone-600 dark:text-slate-400">
                  {currentSubViewFiles.length} fichier{currentSubViewFiles.length > 1 ? 's' : ''} disponible{currentSubViewFiles.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Grille des fichiers du sous-menu */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
                {currentSubViewFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    className="group relative bg-[#151C2C] hover:bg-[#1A2338] border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col"
                  >
                    <div className="w-full h-24 sm:h-28 bg-slate-900/90 relative overflow-hidden flex items-center justify-center">
                      {file.previewUrl ? (
                        <img 
                          src={file.previewUrl} 
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3">
                          {file.category === 'documents' && <FileText className="w-9 h-9 text-blue-400 stroke-[1.8]" />}
                          {file.category === 'audio' && <Music className="w-9 h-9 text-amber-400 stroke-[1.8]" />}
                          {file.category === 'videos' && <Film className="w-9 h-9 text-purple-400 stroke-[1.8]" />}
                          {file.category === 'downloads' && <Download className="w-9 h-9 text-sky-400 stroke-[1.8]" />}
                          {file.category === 'images' && <ImageIcon className="w-9 h-9 text-emerald-400 stroke-[1.8]" />}
                          {file.category === 'apps' && <LayoutGrid className="w-9 h-9 text-pink-400 stroke-[1.8]" />}
                        </div>
                      )}

                      {/* Suppression rapide sur l'appareil */}
                      {currentSubView.source === 'device' && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDeviceFile(file.id, e)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-900/90 flex items-center justify-center text-white transition-colors cursor-pointer shadow-sm z-10"
                          title="Supprimer de l'appareil"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      )}
                    </div>

                    <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-[#151C2C]">
                      <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span className="truncate max-w-[85px]">{file.source}</span>
                        <span className="shrink-0 font-medium">{file.size}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center select-none min-h-[60vh]">
              <div className="w-full max-w-md mx-auto p-8 sm:p-10 rounded-3xl border border-stone-300/80 dark:border-white/10 bg-[#04060A] text-white shadow-2xl flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-2xl bg-black border border-white/10 ${currentSubView.color} shadow-lg`}>
                  <currentSubView.icon className="w-12 h-12 stroke-[1.8]" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Votre espace {currentSubView.name} est vide
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-slate-100 max-w-xs leading-relaxed">
                    {currentSubView.source === 'cloud'
                      ? `Aucun fichier en ligne dans ${currentSubView.name} pour le moment.`
                      : `Aucun fichier local détecté dans ${currentSubView.name}.`}
                  </p>
                </div>

                <div className="pt-2 w-full flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentSubView.source === 'device') {
                        handleImportDeviceFiles(currentSubViewCategoryKey || undefined);
                      } else {
                        showToast(`Ajout bientôt disponible pour ${currentSubView.name}`);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Ajouter {currentSubView.name}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* ========================================================================= */
        /* VUE PRINCIPALE : GESTIONNAIRE DE FICHIERS COMPLET                         */
        /* ========================================================================= */
        <>
          {/* EN-TÊTE FIXE / STICKY : Barre de recherche pilule */}
          <div className="sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 pt-2.5 pb-2.5 border-b border-stone-300/70 dark:border-slate-800/60 shadow-xs">
            <div className="w-full flex items-center gap-2 sm:gap-3">
              
              {/* Bouton Retour rapide vers l'accueil */}
              <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                title="Retour au Tableau de bord"
                aria-label="Retour"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </button>

              {/* Barre de Recherche Pilule (fond noir profond avec texte blanc) */}
              <div className="flex-1 relative flex items-center">
                <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 transition-all shadow-inner gap-2.5">
                  
                  {/* Icône Menu hamburger intégrée à gauche */}
                  <div className="text-white shrink-0">
                    <Menu className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  </div>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Recherchez photos, cours, documents...'
                    className="w-full bg-transparent text-xs sm:text-sm md:text-base text-white placeholder:text-slate-400 focus:outline-none"
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
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton Plein Écran (Spécifique Ordinateur pour prendre 100% de l'écran) */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
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

          {/* CORPS PRINCIPAL : REMONTÉ SANS LE BLOC DE STOCKAGE */}
          <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-4 sm:space-y-5">
            
            {/* LES DEUX BOUTONS DU HAUT : PLUS NOIRS QUE LE FOND, ÉCRITURES BIEN BLANCHES */}
            <div className="flex items-center gap-2.5 sm:gap-4 w-full">
              
              {/* Bouton 1 : StudyCloud Drive */}
              <button
                type="button"
                onClick={() => {
                  setActiveDriveSource('cloud');
                  setSelectedCategory(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-5 rounded-2xl transition-all cursor-pointer shadow-md active:scale-95 border ${
                  activeDriveSource === 'cloud'
                    ? 'bg-[#04060A] text-white border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.35)] ring-1 ring-blue-400/40'
                    : 'bg-[#04060A] hover:bg-[#0A0E18] text-slate-100 hover:text-white border-white/10'
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${activeDriveSource === 'cloud' ? 'bg-blue-600 text-white' : 'bg-black text-blue-400 border border-white/10'}`}>
                  <Cloud className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </div>
                <div className="text-left min-w-0">
                  <span className="block leading-tight text-white font-black text-xs sm:text-sm md:text-base tracking-wide truncate">
                    StudyCloud Drive
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-100 block leading-tight truncate mt-0.5">
                    En ligne
                  </span>
                </div>
              </button>

              {/* Bouton 2 : Cet Appareil */}
              <button
                type="button"
                onClick={() => {
                  setActiveDriveSource('device');
                  setSelectedCategory(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-5 rounded-2xl transition-all cursor-pointer shadow-md active:scale-95 border ${
                  activeDriveSource === 'device'
                    ? 'bg-[#04060A] text-white border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/40'
                    : 'bg-[#04060A] hover:bg-[#0A0E18] text-slate-100 hover:text-white border-white/10'
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${activeDriveSource === 'device' ? 'bg-emerald-600 text-white' : 'bg-black text-emerald-400 border border-white/10'}`}>
                  <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </div>
                <div className="text-left min-w-0">
                  <span className="block leading-tight text-white font-black text-xs sm:text-sm md:text-base tracking-wide truncate">
                    Cet Appareil
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-100 block leading-tight truncate mt-0.5">
                    Stockage local
                  </span>
                </div>
              </button>

            </div>

            {/* SECTION 1 : RÉCENTS (DESIGN CONSERVÉ TEL QUEL, STRICTEMENT 6 SUR 1 LIGNE) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Récents
                </h2>

                {activeDriveSource === 'device' && (
                  <button
                    type="button"
                    onClick={() => handleImportDeviceFiles()}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/15 text-[11px] font-black cursor-pointer active:scale-95 shadow-xs"
                    title="Choisir et importer des fichiers depuis cet appareil"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                    <span>+ Importer</span>
                  </button>
                )}
              </div>

              {/* Si appareil et aucun fichier réel encore sélectionné : Carte interactive d'action */}
              {activeDriveSource === 'device' && displayedFiles.length === 0 ? (
                <div className="w-full rounded-2xl bg-[#04060A] border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3.5 text-center sm:text-left">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                      <HardDrive className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white">
                        Aucun fichier récent sur cet appareil
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-300 mt-0.5">
                        Sélectionnez vos photos, documents, sons ou vidéos pour les afficher ici et dans leurs catégories.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImportDeviceFiles()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shrink-0 border border-emerald-400/30"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Choisir des fichiers de l'appareil</span>
                  </button>
                </div>
              ) : (
                /* Grille STRICTEMENT sur 1 ligne : 6 colonnes sur écran moyen/grand */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3.5 overflow-x-auto md:overflow-visible no-scrollbar">
                  {displayedFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      className="group relative bg-[#151C2C] hover:bg-[#1A2338] border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col"
                    >
                      {/* Vignette compacte */}
                      <div className="w-full h-24 sm:h-28 md:h-28 bg-slate-900/90 relative overflow-hidden flex items-center justify-center">
                        {file.previewUrl ? (
                          <img 
                            src={file.previewUrl} 
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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

                        {/* Bouton 3 petits points verticaux en haut à droite */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === file.id ? null : file.id);
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-xs flex items-center justify-center text-white transition-colors cursor-pointer shadow-sm z-10"
                          title="Options du fichier"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Menu contextuel 3 points */}
                        {menuOpenId === file.id && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-8 right-1.5 z-20 w-36 bg-[#1A2234] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs font-semibold text-slate-200 animate-in fade-in zoom-in-95"
                          >
                            <button
                              onClick={() => {
                                handleSelectFile(file);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-white"
                            >
                              <Eye className="w-3.5 h-3.5" /> Ouvrir
                            </button>
                            <button
                              onClick={() => {
                                handleShareFile(file);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-white"
                            >
                              <Share2 className="w-3.5 h-3.5" /> Partager
                            </button>
                            <button
                              onClick={() => {
                                handleDownloadFile(file);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-white"
                            >
                              <Download className="w-3.5 h-3.5" /> Télécharger
                            </button>
                            {activeDriveSource === 'device' && (
                              <button
                                onClick={(e) => handleDeleteDeviceFile(file.id, e)}
                                className="w-full px-3 py-1.5 text-left hover:bg-rose-900/40 text-rose-400 flex items-center gap-2 cursor-pointer border-t border-slate-700/50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bas de carte avec Nom et Emplacement */}
                      <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-[#151C2C]">
                        <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span className="truncate max-w-[85px]">{file.source}</span>
                          <span className="shrink-0 font-medium">{file.size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 2 : CATÉGORIES (Chaque bouton ouvre son propre menu indépendant) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Catégories
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                {currentCategories.map((cat) => {
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
                      onClick={() => handleOpenSubMenu('collection', col.id, col.name, col.icon, col.color)}
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

      {/* ========================================================================= */}
      {/* MODALE D'APERÇU RAPIDE D'UN FICHIER AU CLIC                               */}
      {/* ========================================================================= */}
      {activeFilePreview && (
        <div 
          onClick={() => setActiveFilePreview(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#04060A] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm sm:text-base font-black text-white truncate max-w-[280px]">
                {activeFilePreview.name}
              </h3>
              <button 
                type="button"
                onClick={() => setActiveFilePreview(null)}
                className="w-8 h-8 rounded-full bg-black hover:bg-slate-900 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aperçu média selon le type */}
            {activeFilePreview.isImage && activeFilePreview.previewUrl ? (
              <div className="w-full h-60 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10">
                <img 
                  src={activeFilePreview.previewUrl} 
                  alt={activeFilePreview.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : activeFilePreview.category === 'audio' && activeFilePreview.previewUrl ? (
              <div className="w-full p-4 rounded-2xl bg-black border border-white/10 flex flex-col items-center justify-center space-y-3">
                <Music className="w-10 h-10 text-amber-400 stroke-[1.8]" />
                <audio controls src={activeFilePreview.previewUrl} className="w-full" />
              </div>
            ) : activeFilePreview.category === 'videos' && activeFilePreview.previewUrl ? (
              <div className="w-full max-h-60 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10">
                <video controls src={activeFilePreview.previewUrl} className="max-w-full max-h-60" />
              </div>
            ) : (
              <div className="w-full h-40 rounded-2xl bg-black border border-white/10 flex flex-col items-center justify-center p-4 text-center">
                <FileText className="w-10 h-10 text-blue-400 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-200">Aperçu direct du document disponible au téléchargement</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-black p-3 rounded-xl border border-white/10">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Emplacement</span>
                <span className="text-white font-bold">{activeFilePreview.source}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Taille</span>
                <span className="text-white font-bold">{activeFilePreview.size}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                <span className="text-white font-bold">{activeFilePreview.date}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Catégorie</span>
                <span className="text-white font-bold capitalize">{activeFilePreview.category}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (activeFilePreview.previewUrl) {
                    window.open(activeFilePreview.previewUrl, '_blank');
                  } else {
                    showToast(`Ouverture de ${activeFilePreview.name}`);
                  }
                  setActiveFilePreview(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Eye className="w-4 h-4" />
                <span>Ouvrir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleDownloadFile(activeFilePreview);
                  setActiveFilePreview(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-black hover:bg-slate-900 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/20"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleShareFile(activeFilePreview);
                  setActiveFilePreview(null);
                }}
                className="p-2.5 rounded-xl bg-black hover:bg-slate-900 text-white font-black text-xs flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                title="Partager"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {activeFilePreview.id.startsWith('dev-file-') && (
                <button
                  type="button"
                  onClick={() => handleDeleteDeviceFile(activeFilePreview.id)}
                  className="p-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-400 font-black text-xs flex items-center justify-center transition-colors cursor-pointer border border-rose-500/30"
                  title="Supprimer de l'appareil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
