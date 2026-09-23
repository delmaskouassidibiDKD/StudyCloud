import React, { useState, useMemo } from 'react';
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
  Database,
  Smartphone,
  ShieldCheck,
  FolderCheck
} from 'lucide-react';

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

export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack }) => {
  // Source active : 'cloud' (StudyCloud Drive) ou 'device' (Cet Appareil)
  const [activeDriveSource, setActiveDriveSource] = useState<'cloud' | 'device'>('cloud');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilePreview, setActiveFilePreview] = useState<FileItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. FICHIERS RÉCENTS : CET APPAREIL (Strictement 6 éléments maximum, 1 seule ligne)
  const [deviceRecentFiles, setDeviceRecentFiles] = useState<FileItem[]>([
    {
      id: 'rec-dev-1',
      name: 'IMG-20260923-WA0012.jpg',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,4 Mo',
      sizeBytes: 2516582,
      date: "Aujourd'hui, 09:20",
      previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
      isImage: true
    },
    {
      id: 'rec-dev-2',
      name: 'Billet_Avion_Vol_Air_2026.pdf',
      category: 'downloads',
      source: 'Téléchargements',
      size: '420 Ko',
      sizeBytes: 430080,
      date: "Aujourd'hui, 09:05"
    },
    {
      id: 'rec-dev-3',
      name: 'Capture_ecran_Dashboard.png',
      category: 'images',
      source: 'Captures d\'écran',
      size: '1,8 Mo',
      sizeBytes: 1887436,
      date: "Aujourd'hui, 08:45",
      previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
      isImage: true
    },
    {
      id: 'rec-dev-4',
      name: 'Enregistrement_Amphi_04.m4a',
      category: 'audio',
      source: 'Enregistreur',
      size: '14,6 Mo',
      sizeBytes: 15309209,
      date: 'Hier, 14:15'
    },
    {
      id: 'rec-dev-5',
      name: 'Synthese_Statistiques_S2.docx',
      category: 'documents',
      source: 'Téléchargements',
      size: '850 Ko',
      sizeBytes: 870400,
      date: '21 Sept, 11:10'
    },
    {
      id: 'rec-dev-6',
      name: 'Photo_Examen_Tableau.jpg',
      category: 'images',
      source: 'Appareil photo',
      size: '3,2 Mo',
      sizeBytes: 3355443,
      date: '20 Sept, 15:30',
      previewUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
      isImage: true
    }
  ]);

  // 2. FICHIERS RÉCENTS : STUDYCLOUD DRIVE (Strictement 6 éléments maximum, 1 seule ligne)
  const [cloudRecentFiles, setCloudRecentFiles] = useState<FileItem[]>([
    {
      id: 'rec-cld-1',
      name: 'Cours_Supply_Chain_Logistique.pdf',
      category: 'documents',
      source: 'D1 StudyCloud',
      size: '4,2 Mo',
      sizeBytes: 4404019,
      date: "Aujourd'hui, 10:15"
    },
    {
      id: 'rec-cld-2',
      name: 'Base_Donnees_D1_Export.sql',
      category: 'documents',
      source: 'D1 Database',
      size: '1,1 Mo',
      sizeBytes: 1153433,
      date: "Aujourd'hui, 09:30"
    },
    {
      id: 'rec-cld-3',
      name: 'Devoir_Economie_Appliquee.pdf',
      category: 'documents',
      source: 'R2 Storage',
      size: '2,8 Mo',
      sizeBytes: 2936012,
      date: 'Hier, 18:20'
    },
    {
      id: 'rec-cld-4',
      name: 'Projet_Algorithmique_V2.zip',
      category: 'downloads',
      source: 'Cloud Drive',
      size: '6,4 Mo',
      sizeBytes: 6710886,
      date: 'Hier, 16:45'
    },
    {
      id: 'rec-cld-5',
      name: 'Notes_Revision_Semestre_1.pdf',
      category: 'documents',
      source: 'D1 StudyCloud',
      size: '950 Ko',
      sizeBytes: 972800,
      date: '21 Sept, 14:00'
    },
    {
      id: 'rec-cld-6',
      name: 'Fiche_TD_Mathematiques.pdf',
      category: 'documents',
      source: 'R2 Storage',
      size: '1,7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20'
    }
  ]);

  // Gestion FIFO : un nouvel élément passe en 1ère position et le 7ème disparaît automatiquement
  const handleSelectFile = (file: FileItem) => {
    setActiveFilePreview(file);
    if (activeDriveSource === 'device') {
      setDeviceRecentFiles(prev => {
        const withoutCurrent = prev.filter(f => f.id !== file.id);
        return [file, ...withoutCurrent].slice(0, 6);
      });
    } else {
      setCloudRecentFiles(prev => {
        const withoutCurrent = prev.filter(f => f.id !== file.id);
        return [file, ...withoutCurrent].slice(0, 6);
      });
    }
  };

  // Liste active selon la source choisie (Drive Cloud ou Cet Appareil), strictement plafonnée à 6
  const activeRecentList = useMemo(() => {
    const list = activeDriveSource === 'cloud' ? cloudRecentFiles : deviceRecentFiles;
    return list.slice(0, 6);
  }, [activeDriveSource, cloudRecentFiles, deviceRecentFiles]);

  // Catégories pour "Cet Appareil"
  const deviceCategories = [
    {
      id: 'downloads',
      name: 'Téléchargements',
      size: '1,5 Go',
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

  // Catégories pour "StudyCloud Drive" (Base de données en ligne D1 & R2)
  const cloudCategories = [
    {
      id: 'documents',
      name: 'Documents Cloud',
      size: '4,2 Go',
      icon: FileText,
      color: 'text-blue-400'
    },
    {
      id: 'database',
      name: 'Base D1 StudyCloud',
      size: 'Connecté',
      icon: Database,
      color: 'text-emerald-400'
    },
    {
      id: 'backups',
      name: 'Sauvegardes R2',
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

  // Collections
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

  // Filtrage selon la recherche et la catégorie
  const displayedFiles = useMemo(() => {
    return activeRecentList.filter(f => {
      const matchQuery = searchQuery.trim() === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.source.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCat = !selectedCategory || f.category === selectedCategory;
      return matchQuery && matchCat;
    }).slice(0, 6); // STRICTEMENT 6 ÉLÉMENTS MAXIMUM
  }, [activeRecentList, searchQuery, selectedCategory]);

  return (
    <div className={`transition-all duration-300 bg-[#0C111D] text-slate-100 flex flex-col overflow-y-auto selection:bg-blue-600 selection:text-white ${
      isFullscreen
        ? 'fixed inset-0 z-50 w-screen h-screen'
        : 'absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-[calc(100vh-66px)]'
    }`}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl border border-blue-400/30 animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* EN-TÊTE FIXE / STICKY : Barre de recherche pilule                         */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-30 w-full bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 pt-2.5 pb-2.5 border-b border-slate-800/60 shadow-md">
        <div className="w-full flex items-center gap-2 sm:gap-3">
          
          {/* Bouton Retour rapide vers l'accueil */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#182234] hover:bg-[#222E46] text-slate-200 hover:text-white border border-slate-700/60 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
            title="Retour au Tableau de bord"
            aria-label="Retour"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          {/* Barre de Recherche Pilule (identique à la capture d'écran ≡ Recherchez "billet" 🔍) */}
          <div className="flex-1 relative flex items-center">
            <div className="w-full flex items-center bg-[#151C2C] hover:bg-[#1A2338] focus-within:bg-[#1A2338] focus-within:ring-2 focus-within:ring-blue-500/50 border border-slate-700/60 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 transition-all shadow-inner gap-2.5">
              
              {/* Icône Menu hamburger intégrée à gauche comme sur la photo */}
              <div className="text-slate-300 shrink-0">
                <Menu className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Recherchez "billet", photos, cours...'
                className="w-full bg-transparent text-xs sm:text-sm md:text-base text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />

              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="p-1 text-slate-400 shrink-0">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                </div>
              )}
            </div>
          </div>

          {/* Bouton Plein Écran (Spécifique Ordinateur pour prendre 100% de l'écran) */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-[#182234] hover:bg-[#222E46] text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet (Prendre tout l'écran)"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Maximize2 className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>

        </div>

        {/* Filtre de catégorie actif s'il y en a un */}
        {selectedCategory && (
          <div className="flex items-center gap-2 mt-2 pt-0.5">
            <span className="text-[11px] text-slate-400">Filtre actif :</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {currentCategories.find(c => c.id === selectedCategory)?.name || selectedCategory}
              <button 
                onClick={() => setSelectedCategory(null)}
                className="hover:text-white ml-0.5"
                title="Supprimer le filtre"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CORPS PRINCIPAL : REMONTÉ POUR COMBLER L'ESPACE SANS TROU VIDE             */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-4 sm:space-y-5">
        
        {/* ========================================================================= */}
        {/* LES DEUX BOUTONS DU HAUT : StudyCloud Drive & Cet Appareil (traits rouges) */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2.5 sm:gap-4 w-full">
          
          {/* Bouton 1 : StudyCloud Drive (Base de données) */}
          <button
            type="button"
            onClick={() => {
              setActiveDriveSource('cloud');
              setSelectedCategory(null);
              showToast("Basculé sur StudyCloud Drive (Base de données)");
            }}
            className={`flex-1 flex items-center justify-center gap-2.5 sm:gap-3 py-2 sm:py-2.5 px-3 sm:px-5 rounded-2xl font-bold text-xs sm:text-sm md:text-base border-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
              activeDriveSource === 'cloud'
                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_4px_18px_rgba(37,99,235,0.45)] ring-2 ring-blue-500/30'
                : 'bg-[#151C2C] hover:bg-[#1A2338] text-slate-300 hover:text-white border-slate-700/70'
            }`}
          >
            <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${activeDriveSource === 'cloud' ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400'}`}>
              <Cloud className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="text-left min-w-0">
              <span className="block leading-tight truncate">StudyCloud Drive</span>
              <span className={`text-[10px] sm:text-[11px] font-medium block leading-tight truncate ${activeDriveSource === 'cloud' ? 'text-blue-100' : 'text-slate-400'}`}>
                Base de données en ligne
              </span>
            </div>
          </button>

          {/* Bouton 2 : Cet Appareil (Données de l'appareil : photos, son, documents...) */}
          <button
            type="button"
            onClick={() => {
              setActiveDriveSource('device');
              setSelectedCategory(null);
              showToast("Basculé sur Cet Appareil (Stockage local)");
            }}
            className={`flex-1 flex items-center justify-center gap-2.5 sm:gap-3 py-2 sm:py-2.5 px-3 sm:px-5 rounded-2xl font-bold text-xs sm:text-sm md:text-base border-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
              activeDriveSource === 'device'
                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_4px_18px_rgba(37,99,235,0.45)] ring-2 ring-blue-500/30'
                : 'bg-[#151C2C] hover:bg-[#1A2338] text-slate-300 hover:text-white border-slate-700/70'
            }`}
          >
            <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${activeDriveSource === 'device' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="text-left min-w-0">
              <span className="block leading-tight truncate">Cet Appareil</span>
              <span className={`text-[10px] sm:text-[11px] font-medium block leading-tight truncate ${activeDriveSource === 'device' ? 'text-blue-100' : 'text-slate-400'}`}>
                Données de l'appareil (Photos, Sons...)
              </span>
            </div>
          </button>

        </div>

        {/* ========================================================================= */}
        {/* SECTION 1 : RÉCENTS (STRICTEMENT 6 ÉLÉMENTS MAXIMUM & STRICTEMENT 1 LIGNE) */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Récents</span>
              <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                {displayedFiles.length} sur 6 max
              </span>
            </h2>

            <span className="text-[11px] text-slate-400">
              {activeDriveSource === 'cloud' ? 'Base D1 / R2 Cloud' : 'Mémoire locale'}
            </span>
          </div>

          {/* Grille STRICTEMENT sur 1 ligne : 6 colonnes sur écran moyen/grand, défilement horizontal sans retour à la ligne sur mobile */}
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
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ouvrir
                      </button>
                      <button
                        onClick={() => {
                          showToast(`Lien partagé pour ${file.name}`);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Partager
                      </button>
                      <button
                        onClick={() => {
                          showToast(`Téléchargement de ${file.name}...`);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" /> Télécharger
                      </button>
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
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2 : CATÉGORIES (REMONTÉE POUR COMBLER L'ESPACE)                    */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {activeDriveSource === 'cloud' ? 'Catégories Cloud (Base de données)' : 'Catégories de l\'appareil'}
            </h2>
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(null)}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                Réinitialiser
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {currentCategories.map((cat) => {
              const IconComp = cat.icon;
              const isSelected = selectedCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                  className={`group rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 transition-all duration-200 cursor-pointer select-none border ${
                    isSelected
                      ? 'bg-blue-600/25 border-blue-500 shadow-md scale-[1.02]'
                      : 'bg-[#151C2C] hover:bg-[#1A2338] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-slate-900/90 border border-slate-800 shrink-0 group-hover:scale-110 transition-transform ${cat.color}`}>
                    <IconComp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                      {cat.size}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3 : COLLECTIONS                                                    */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Collections
            </h2>
            <button 
              type="button"
              onClick={() => showToast('Gestion des collections')}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Options des collections"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {collections.map((col) => {
              const IconComp = col.icon;
              return (
                <div
                  key={col.id}
                  onClick={() => showToast(`Ouverture de : ${col.name}`)}
                  className="group rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 bg-[#151C2C] hover:bg-[#1A2338] border border-slate-800 hover:border-slate-700 transition-all duration-200 cursor-pointer select-none"
                >
                  <div className={`p-2 rounded-xl bg-slate-900/90 border border-slate-800 shrink-0 group-hover:scale-110 transition-transform ${col.color}`}>
                    <IconComp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                      {col.name}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4 : ÉTAT DU STOCKAGE                                               */}
        {/* ========================================================================= */}
        <section className="bg-[#151C2C] border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                {activeDriveSource === 'cloud' ? <Cloud className="w-4 h-4 sm:w-5 sm:h-5" /> : <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {activeDriveSource === 'cloud' ? 'Espace Cloud StudyCloud (D1 / R2)' : 'Stockage interne (Cet appareil)'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  {activeDriveSource === 'cloud' ? '3,2 Go utilisés sur 15 Go (Synchronisé)' : '37,3 Go utilisés sur 64 Go'}
                </p>
              </div>
            </div>

            <span className="text-[11px] sm:text-xs font-bold text-slate-200 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
              {activeDriveSource === 'cloud' ? '21%' : '58%'}
            </span>
          </div>

          {/* Barre de progression multi-segments */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
            {activeDriveSource === 'cloud' ? (
              <>
                <div style={{ width: '12%' }} className="bg-blue-500 h-full" title="Documents Cloud" />
                <div style={{ width: '6%' }} className="bg-sky-500 h-full" title="Sauvegardes R2" />
                <div style={{ width: '3%' }} className="bg-emerald-500 h-full" title="Base D1" />
              </>
            ) : (
              <>
                <div style={{ width: '31%' }} className="bg-purple-500 h-full" title="Vidéos: 20 Go" />
                <div style={{ width: '12%' }} className="bg-emerald-500 h-full" title="Images: 7,5 Go" />
                <div style={{ width: '8%' }} className="bg-amber-500 h-full" title="Audio: 4,8 Go" />
                <div style={{ width: '6%' }} className="bg-blue-500 h-full" title="Documents: 3,5 Go" />
                <div style={{ width: '3%' }} className="bg-sky-500 h-full" title="Téléchargements: 1,5 Go" />
              </>
            )}
          </div>
        </section>

      </div>

      {/* ========================================================================= */}
      {/* MODALE D'APERÇU RAPIDE D'UN FICHIER AU CLIC                               */}
      {/* ========================================================================= */}
      {activeFilePreview && (
        <div 
          onClick={() => setActiveFilePreview(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#151C2C] border border-slate-700 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-[280px]">
                {activeFilePreview.name}
              </h3>
              <button 
                type="button"
                onClick={() => setActiveFilePreview(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeFilePreview.previewUrl ? (
              <div className="w-full h-60 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                <img 
                  src={activeFilePreview.previewUrl} 
                  alt={activeFilePreview.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-40 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                <FileText className="w-10 h-10 text-blue-400 mb-2 stroke-[1.5]" />
                <p className="text-xs text-slate-400">Aperçu direct du document disponible au téléchargement</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Emplacement</span>
                <span className="text-slate-200 font-semibold">{activeFilePreview.source}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Taille</span>
                <span className="text-slate-200 font-semibold">{activeFilePreview.size}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Date</span>
                <span className="text-slate-200 font-semibold">{activeFilePreview.date}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Catégorie</span>
                <span className="text-slate-200 font-semibold capitalize">{activeFilePreview.category}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  showToast("Ouverture du fichier...");
                  setActiveFilePreview(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Ouvrir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast("Lien copié dans le presse-papier !");
                  setActiveFilePreview(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
