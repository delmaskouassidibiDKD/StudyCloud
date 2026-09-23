import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ChevronRight, 
  Eye, 
  Info, 
  Maximize2, 
  Minimize2, 
  Menu,
  ShieldCheck,
  FolderCheck,
  Plus,
  FolderArchive,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  FileCode,
  Archive,
  AlertCircle
} from 'lucide-react';
import { getDownloadedFiles, recordDownloadedFile, DownloadedItem } from '../services/downloadsManager';

interface Page1FilesMenuViewProps {
  onBack: () => void;
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
}

interface SubMenuView {
  id: string;
  type: 'category' | 'collection' | 'classeur';
  name: string;
  icon: any;
  color: string;
}

export const Page1FilesMenuView: React.FC<Page1FilesMenuViewProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [selectedDocFilter, setSelectedDocFilter] = useState<'TOUS' | 'COURS' | 'TD' | 'DEVOIRS'>('TOUS');
  const [selectedDownloadFilter, setSelectedDownloadFilter] = useState<'TOUS' | 'DOCUMENTS' | 'IMAGES' | 'VIDEOS' | 'AUDIO' | 'AUTRES'>('TOUS');
  const [activeFilePreview, setActiveFilePreview] = useState<FileItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio player state
  const [playingAudio, setPlayingAudio] = useState<FileItem | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(25);

  // Téléchargements réels synchronisés
  const [downloadedItems, setDownloadedItems] = useState<DownloadedItem[]>(() => getDownloadedFiles());

  useEffect(() => {
    const handleUpdate = () => {
      setDownloadedItems(getDownloadedFiles());
    };
    window.addEventListener('studycloud_download_updated', handleUpdate);
    return () => window.removeEventListener('studycloud_download_updated', handleUpdate);
  }, []);

  // Référence pour l'import de fichier
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sous-page ouverte
  const [currentSubView, setCurrentSubView] = useState<SubMenuView | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // =========================================================================
  // DONNÉES RICHES CONFORMENT EXACTEMENT AUX IMAGES FOURNIES PAR L'UTILISATEUR
  // =========================================================================

  // IMAGE 1 : DOCUMENTS (PDF, WORD,...) CODES COULEURS EN FONCTION DU FORMAT
  const sampleDocuments: FileItem[] = [
    {
      id: 'doc-1',
      name: 'CHI_AOP_LINEAIRE_MONT_BASE (1) (1).pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '647.5 Ko',
      sizeBytes: 663040,
      date: "Aujourd'hui, 11:20",
      extension: 'PDF',
      downloadsCount: 0
    },
    {
      id: 'doc-2',
      name: 'CHI_AOP_LINEAIRE_MONT_BASE (1).pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '642.5 Ko',
      sizeBytes: 657920,
      date: "Aujourd'hui, 10:45",
      extension: 'PDF',
      downloadsCount: 0
    },
    {
      id: 'doc-3',
      name: 'TD_PREPA_ANA_2MIT.pdf',
      category: 'documents',
      documentCategory: "PAS D'INF...",
      source: 'StudyCloud',
      size: '512.0 Ko',
      sizeBytes: 524288,
      date: 'Hier, 15:30',
      extension: 'PDF',
      downloadsCount: 0
    },
    {
      id: 'doc-4',
      name: 'CHI_AOP_LINEAIRE_APPLICATIONS.pdf',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '720.0 Ko',
      sizeBytes: 737280,
      date: 'Hier, 14:15',
      extension: 'PDF',
      downloadsCount: 3
    },
    {
      id: 'doc-5',
      name: 'Synthese_Cours_Semestre_1.docx',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '1.1 Mo',
      sizeBytes: 1153433,
      date: "Aujourd'hui, 09:30",
      extension: 'DOCX',
      downloadsCount: 5
    },
    {
      id: 'doc-6',
      name: 'Devoir_Economie_Appliquee.pdf',
      category: 'documents',
      documentCategory: 'DEVOIRS',
      source: 'StudyCloud',
      size: '2.8 Mo',
      sizeBytes: 2936012,
      date: 'Hier, 18:20',
      extension: 'PDF',
      downloadsCount: 2
    },
    {
      id: 'doc-7',
      name: 'TD_Mathematiques_Algebre.pdf',
      category: 'documents',
      documentCategory: 'TD',
      source: 'StudyCloud',
      size: '1.7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20',
      extension: 'PDF',
      downloadsCount: 7
    },
    {
      id: 'doc-8',
      name: 'Tableau_Budget_Gestion_Projet.xlsx',
      category: 'documents',
      documentCategory: 'COURS',
      source: 'StudyCloud',
      size: '890.0 Ko',
      sizeBytes: 911360,
      date: '19 Sept, 16:00',
      extension: 'XLSX',
      downloadsCount: 4
    }
  ];

  // IMAGE 2 : IMAGES (GRILLE 3 COLONNES AVEC TAILLES EXACTES EN HAUT À DROITE)
  const sampleImages: FileItem[] = [
    {
      id: 'img-1',
      name: 'Capture_ecran_Dashboard.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,18 Mo',
      sizeBytes: 2285895,
      date: '21 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-2',
      name: 'Architecture_Cloud_Diagramme.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,00 Mo',
      sizeBytes: 2097152,
      date: '21 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-3',
      name: 'Schema_Reseau_Entreprise.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,61 Mo',
      sizeBytes: 2736783,
      date: '20 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-4',
      name: 'Citation_Bague_Promesse.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '292 ko',
      sizeBytes: 299008,
      date: '19 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-5',
      name: 'Interface_StudyCloud_Dark.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,55 Mo',
      sizeBytes: 2673868,
      date: '18 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-6',
      name: 'Fond_Ecran_Paysage_Nature.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,90 Mo',
      sizeBytes: 3040870,
      date: '18 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-7',
      name: 'IMG-20260923-WA0012.jpg',
      category: 'images',
      source: 'WhatsApp Images',
      size: '503 ko',
      sizeBytes: 515072,
      date: '17 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-8',
      name: 'Dossier_Roblox_Projet.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,33 Mo',
      sizeBytes: 2443182,
      date: '16 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-9',
      name: 'Menu_Applications_Grille.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '521 ko',
      sizeBytes: 533504,
      date: '15 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-10',
      name: 'Dossier_Supply_Chain_Jaune.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '41,33 ko',
      sizeBytes: 42321,
      date: '15 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'img-11',
      name: 'Dashboard_Navigation_Home.png',
      category: 'images',
      source: 'WhatsApp Images',
      size: '2,56 Mo',
      sizeBytes: 2684354,
      date: '14 Sept',
      isImage: true,
      previewUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80'
    }
  ];

  // IMAGE 3 : VIDÉOS (GRILLE 3 COLONNES AVEC BOUTON PLAY BLANC AU CENTRE ET TAILLES EXACTES)
  const sampleVideos: FileItem[] = [
    {
      id: 'vid-1',
      name: 'Labyrinthe_Psychologie_Societe.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '2,79 Mo',
      sizeBytes: 2925527,
      date: '21 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-2',
      name: 'Animation_Monde_Imaginaire.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '5,28 Mo',
      sizeBytes: 5536481,
      date: '21 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-3',
      name: 'Tutoriel_Debuter_En_Code.mp4',
      category: 'videos',
      source: 'YouTube',
      size: '39,07 Mo',
      sizeBytes: 40967864,
      date: '20 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-4',
      name: 'Rick_And_Morty_Extrait.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '3,22 Mo',
      sizeBytes: 3376414,
      date: '20 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-5',
      name: 'Arrete_De_Payer_Des_Tokens.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '7,34 Mo',
      sizeBytes: 7696547,
      date: '19 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-6',
      name: 'Gala_Costume_Ceremonie.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '3,45 Mo',
      sizeBytes: 3617587,
      date: '19 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-7',
      name: 'Robot_Humanoide_Laboratoire.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '6,72 Mo',
      sizeBytes: 7046430,
      date: '18 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-8',
      name: 'Inde_Voyage_Reportage.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,35 Mo',
      sizeBytes: 1415577,
      date: '18 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-9',
      name: 'Promenade_Foret_Nuit.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,42 Mo',
      sizeBytes: 1488977,
      date: '17 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-10',
      name: 'Orang_Outan_Tronc_Arbre.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '2,14 Mo',
      sizeBytes: 2243952,
      date: '17 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-11',
      name: 'Concert_Violoncelle_Orchestre.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '6,95 Mo',
      sizeBytes: 7287603,
      date: '16 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-12',
      name: 'Parade_Militaire_Foule.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '11,01 Mo',
      sizeBytes: 11544821,
      date: '16 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-13',
      name: 'Bebe_Sourire_Famille.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,55 Mo',
      sizeBytes: 1625292,
      date: '15 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-14',
      name: 'Chorale_Enfants_Chant.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '4,16 Mo',
      sizeBytes: 4362076,
      date: '15 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'vid-15',
      name: 'Diogo_Almeida_Interview_AI.mp4',
      category: 'videos',
      source: 'YouTube',
      size: '20,91 Mo',
      sizeBytes: 21925724,
      date: '14 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80'
    }
  ];

  // IMAGE 4 : AUDIO / SON (LISTE SOMBRE AVEC VIGNETTE NOIRE + NOTE DE MUSIQUE BLANCHE ET GROUPÉE PAR DATE)
  const sampleAudioList: FileItem[] = [
    {
      id: 'aud-1',
      name: 'Himra _ Ciel paroles.m4a',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '3,61 Mo',
      sizeBytes: 3785359,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'aud-2',
      name: 'Esther Smith - Yesu Wo Mafa (Official...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '5,81 Mo',
      sizeBytes: 6092226,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'aud-3',
      name: 'Esther Smith ft Morris Babyface...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '3,58 Mo',
      sizeBytes: 3753902,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'aud-4',
      name: 'Esther Smith - Ma Won San (Official...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '5,47 Mo',
      sizeBytes: 5735710,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'aud-5',
      name: 'Esther Smith - Me Da Wase (Official...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,37 Mo',
      sizeBytes: 4582277,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=200&q=80'
    },
    {
      id: 'aud-6',
      name: 'Esther Smith - Nipa (Official Video...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,87 Mo',
      sizeBytes: 5106565,
      date: '14 août',
      previewUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=200&q=80'
    }
  ];

  // FICHIERS RÉCENTS : STUDYCLOUD (Strictement 6 éléments maximum, 1 seule ligne, FIFO)
  const [cloudRecentFiles, setCloudRecentFiles] = useState<FileItem[]>([
    {
      id: 'rec-cld-1',
      name: 'Cours_Supply_Chain_Logistique.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '4,2 Mo',
      sizeBytes: 4404019,
      date: "Aujourd'hui, 10:15"
    },
    {
      id: 'rec-cld-2',
      name: 'Synthese_Cours_Semestre_1.docx',
      category: 'documents',
      source: 'StudyCloud',
      size: '1,1 Mo',
      sizeBytes: 1153433,
      date: "Aujourd'hui, 09:30"
    },
    {
      id: 'rec-cld-3',
      name: 'Devoir_Economie_Appliquee.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '2,8 Mo',
      sizeBytes: 2936012,
      date: 'Hier, 18:20'
    },
    {
      id: 'rec-cld-4',
      name: 'Projet_Algorithmique_V2.zip',
      category: 'downloads',
      source: 'StudyCloud',
      size: '6,4 Mo',
      sizeBytes: 6710886,
      date: 'Hier, 16:45'
    },
    {
      id: 'rec-cld-5',
      name: 'Notes_Revision_Semestre_1.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '950 Ko',
      sizeBytes: 972800,
      date: '21 Sept, 14:00'
    },
    {
      id: 'rec-cld-6',
      name: 'Fiche_TD_Mathematiques.pdf',
      category: 'documents',
      source: 'StudyCloud',
      size: '1,7 Mo',
      sizeBytes: 1782579,
      date: '20 Sept, 11:20'
    }
  ]);

  // Déclencher le sélecteur de fichier
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  // Traiter les fichiers importés
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: FileItem[] = Array.from(files).map((file, idx) => {
      const isImg = file.type.startsWith('image/');
      let category: FileItem['category'] = 'documents';
      if (isImg) category = 'images';
      else if (file.type.startsWith('audio/')) category = 'audio';
      else if (file.type.startsWith('video/')) category = 'videos';

      return {
        id: `rec-imp-${Date.now()}-${idx}`,
        name: file.name,
        category,
        source: 'StudyCloud',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} Mo`,
        sizeBytes: file.size,
        date: "Aujourd'hui, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
        isImage: isImg
      };
    });

    setCloudRecentFiles(prev => [...newItems, ...prev].slice(0, 6));
    showToast(`${files.length} fichier(s) importé(s) dans StudyCloud !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Téléchargement d'un fichier avec enregistrement dans le menu téléchargement
  const handleDownloadFile = (file: { name: string; size?: string; sizeBytes?: number; category?: any }) => {
    recordDownloadedFile({
      name: file.name,
      size: file.size,
      sizeBytes: file.sizeBytes,
      category: file.category
    });
    showToast(`Téléchargement de ${file.name}... Ajouté au menu Téléchargements !`);
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

  // Sélection d'un fichier pour aperçu avec logique FIFO
  const handleSelectFile = (file: FileItem) => {
    setActiveFilePreview(file);
    setCloudRecentFiles(prev => {
      const withoutCurrent = prev.filter(f => f.id !== file.id);
      return [file, ...withoutCurrent].slice(0, 6);
    });
  };

  // Lecture audio
  const handlePlayAudio = (file: FileItem) => {
    if (playingAudio?.id === file.id) {
      setIsPlayingAudio(!isPlayingAudio);
    } else {
      setPlayingAudio(file);
      setIsPlayingAudio(true);
      setAudioProgress(15);
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

  // Filtrage selon la recherche (strictement 6 éléments maximum)
  const displayedFiles = useMemo(() => {
    return cloudRecentFiles.filter(f => {
      const matchQuery = searchQuery.trim() === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.source.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchQuery;
    }).slice(0, 6);
  }, [cloudRecentFiles, searchQuery]);

  // Ouverture d'un sous-menu indépendant
  const handleOpenSubMenu = (
    type: 'category' | 'collection' | 'classeur',
    id: string,
    name: string,
    icon: any,
    color: string
  ) => {
    setSubSearchQuery('');
    setCurrentSubView({
      id: `studycloud-${type}-${id}`,
      type,
      name,
      icon,
      color
    });
  };

  // Liste des documents pour le sous-menu Documents (Image 1)
  const filteredDocuments = useMemo(() => {
    const list = [...sampleDocuments, ...cloudRecentFiles.filter(f => f.category === 'documents' && !sampleDocuments.some(s => s.name === f.name))];
    return list.filter(doc => {
      const matchesSearch = subSearchQuery.trim() === '' || doc.name.toLowerCase().includes(subSearchQuery.toLowerCase());
      const matchesFilter = selectedDocFilter === 'TOUS' || doc.documentCategory === selectedDocFilter;
      return matchesSearch && matchesFilter;
    });
  }, [sampleDocuments, cloudRecentFiles, subSearchQuery, selectedDocFilter]);

  // Liste des images pour le sous-menu Images (Image 2)
  const filteredImages = useMemo(() => {
    const list = [...sampleImages, ...cloudRecentFiles.filter(f => f.category === 'images' && !sampleImages.some(s => s.name === f.name))];
    return list.filter(img => {
      return subSearchQuery.trim() === '' || img.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
  }, [sampleImages, cloudRecentFiles, subSearchQuery]);

  // Liste des vidéos pour le sous-menu Vidéos (Image 3)
  const filteredVideos = useMemo(() => {
    const list = [...sampleVideos, ...cloudRecentFiles.filter(f => f.category === 'videos' && !sampleVideos.some(s => s.name === f.name))];
    return list.filter(vid => {
      return subSearchQuery.trim() === '' || vid.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
  }, [sampleVideos, cloudRecentFiles, subSearchQuery]);

  // Liste audio pour le sous-menu Audio (Image 4)
  const filteredAudio = useMemo(() => {
    const list = [...sampleAudioList, ...cloudRecentFiles.filter(f => f.category === 'audio' && !sampleAudioList.some(s => s.name === f.name))];
    return list.filter(aud => {
      return subSearchQuery.trim() === '' || aud.name.toLowerCase().includes(subSearchQuery.toLowerCase());
    });
  }, [sampleAudioList, cloudRecentFiles, subSearchQuery]);

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

  // Liste des téléchargements pour le sous-menu Téléchargements (Prend tout type de fichier)
  const filteredDownloads = useMemo(() => {
    return downloadedItems.filter(item => {
      const matchesSearch = subSearchQuery.trim() === '' || item.name.toLowerCase().includes(subSearchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (selectedDownloadFilter === 'TOUS') return true;
      if (selectedDownloadFilter === 'DOCUMENTS') return item.category === 'documents';
      if (selectedDownloadFilter === 'IMAGES') return item.category === 'images';
      if (selectedDownloadFilter === 'VIDEOS') return item.category === 'videos';
      if (selectedDownloadFilter === 'AUDIO') return item.category === 'audio';
      if (selectedDownloadFilter === 'AUTRES') return ['downloads', 'apps'].includes(item.category);
      return true;
    });
  }, [downloadedItems, subSearchQuery, selectedDownloadFilter]);

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

  return (
    <div className={`transition-colors duration-300 bg-[#F4F6F8] dark:bg-[#0C111D] text-stone-900 dark:text-slate-100 flex flex-col overflow-y-auto selection:bg-blue-600 selection:text-white ${
      isFullscreen
        ? 'fixed inset-0 z-50 w-screen h-screen'
        : 'absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-[calc(100vh-66px)]'
    }`}>
      
      {/* Input de sélection de fichier caché */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        multiple
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl border border-blue-400/30 animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SI UN SOUS-MENU EST OUVERT : AFFICHAGE CONFORME EXACTEMENT AUX IMAGES     */}
      {/* ========================================================================= */}
      {currentSubView ? (
        <div className="flex-1 flex flex-col w-full animate-in fade-in duration-200 min-h-screen">
          
          {/* EN-TÊTE DU SOUS-MENU */}
          <div className="sticky top-0 z-30 w-full bg-[#F4F6F8]/95 dark:bg-[#0C111D]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-stone-300/70 dark:border-slate-800/60 shadow-xs">
            <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
              
              {/* GAUCHE : Bouton Retour et Titre */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentSubView(null);
                    setSubSearchQuery('');
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

              {/* DROITE : Plein écran */}
              <div className="shrink-0 flex items-center gap-2">
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
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* 1. MENU DOCUMENTS : CONFORME EXACTEMENT À L'IMAGE 1                       */}
          {/* Cartes couleur selon code (Rouge PDF, Bleu Word...), AOP miniature, etc.  */}
          {/* ========================================================================= */}
          {currentSubView.id === 'studycloud-category-documents' && (
            <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-3 sm:space-y-4">
              
              {/* Filtres du haut : TOUS, COURS, TD, DEVOIRS (Exactement comme Image 1) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {(['TOUS', 'COURS', 'TD', 'DEVOIRS'] as const).map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedDocFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs border ${
                      selectedDocFilter === filter
                        ? 'bg-blue-600 text-white border-blue-500 scale-105'
                        : 'bg-[#04060A] hover:bg-[#121826] text-slate-300 border-white/10'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Compteur : "8 documents publiés" (comme sur Image 1) */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                  {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} publié{filteredDocuments.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Grille des cartes documents (Style Image 1) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredDocuments.map(doc => {
                  const theme = getDocumentTheme(doc.extension || 'PDF');
                  return (
                    <div
                      key={doc.id}
                      style={{ background: theme.bg }}
                      className={`aspect-[3/4] ${theme.border} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none overflow-hidden cursor-pointer active:scale-98`}
                      onClick={() => handleSelectFile(doc)}
                    >
                      {/* Haut de carte : Catégorie à gauche ("COURS" / "TD"), Taille à droite ("647.5 Ko") */}
                      <div className="flex items-center justify-between gap-1 z-10">
                        <span className="text-[7.5px] sm:text-[8.5px] font-black bg-white text-stone-800 border border-white px-1.5 py-0.5 rounded shadow-sm truncate max-w-[70px]">
                          {doc.documentCategory || 'COURS'}
                        </span>
                        <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
                          {doc.size}
                        </span>
                      </div>

                      {/* Zone centrale : Miniature réaliste du document avec schéma AOP et logo CME (Image 1) */}
                      <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white p-2 relative shadow-inner border border-white/20 flex flex-col justify-between">
                        {/* En-tête miniature : Logo cme + StudyCloud */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-1">
                          <span className="text-[9px] font-black text-red-600 tracking-tighter">
                            cme
                          </span>
                          <span className="text-[7px] font-bold bg-stone-900 text-white px-1 py-0.2 rounded">
                            StudyCloud
                          </span>
                        </div>

                        {/* Titre miniature du cours */}
                        <div className="my-1">
                          <p className="text-[7px] sm:text-[8px] font-black text-stone-800 leading-tight uppercase line-clamp-2">
                            AMPLIFICATEUR OPERATIONNEL EN REGIME LINEAIRE : MONTAGES DE BASE
                          </p>
                          <p className="text-[6px] text-stone-500 font-semibold mt-0.5">
                            1. Définition
                          </p>
                        </div>

                        {/* Schéma électronique AOP (Montage de base triangle) */}
                        <div className="w-full h-12 flex items-center justify-center bg-stone-50 rounded border border-stone-200/80 my-0.5">
                          <svg className="w-full h-full max-h-11" viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Triangle AOP */}
                            <polygon points="35,5 35,40 70,22.5" fill="#FFFFFF" stroke="#1c1917" strokeWidth="1.5" />
                            {/* Entrées - et + */}
                            <line x1="15" y1="14" x2="35" y2="14" stroke="#1c1917" strokeWidth="1.2" />
                            <line x1="15" y1="31" x2="35" y2="31" stroke="#1c1917" strokeWidth="1.2" />
                            <text x="38" y="16" fontSize="7" fontWeight="bold" fill="#1c1917">-</text>
                            <text x="38" y="33" fontSize="7" fontWeight="bold" fill="#1c1917">+</text>
                            {/* Sortie Vs */}
                            <line x1="70" y1="22.5" x2="90" y2="22.5" stroke="#1c1917" strokeWidth="1.2" />
                            <text x="91" y="24" fontSize="6" fontWeight="bold" fill="#1c1917">Vs</text>
                            {/* Masse ground */}
                            <line x1="15" y1="31" x2="15" y2="38" stroke="#1c1917" strokeWidth="1" />
                            <line x1="11" y1="38" x2="19" y2="38" stroke="#1c1917" strokeWidth="1" />
                            <line x1="13" y1="40" x2="17" y2="40" stroke="#1c1917" strokeWidth="1" />
                          </svg>
                        </div>

                        {/* Lignes de texte simulées */}
                        <div className="space-y-0.5 opacity-60">
                          <div className="h-0.5 bg-stone-400 rounded-full w-full"></div>
                          <div className="h-0.5 bg-stone-400 rounded-full w-5/6"></div>
                        </div>
                      </div>

                      {/* Titres du document en blanc (Image 1) */}
                      <div className="px-0.5 mb-1 flex flex-col gap-0.5">
                        <p className="text-[8.5px] sm:text-[9px] font-semibold text-white truncate drop-shadow-sm" title={doc.name}>
                          {doc.name}
                        </p>
                        <p className="text-[9.5px] sm:text-[10px] font-black text-white truncate drop-shadow-md">
                          {doc.name.replace(/\.[^/.]+$/, '').toUpperCase()}
                        </p>
                      </div>

                      {/* Bas de carte : Téléchargements (⤓ 0) + Badge Type (PDF) + Bouton Télécharger + 3 traits */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
                        <div className="flex items-center gap-0.5 text-[7.5px] sm:text-[8.5px] font-bold text-white truncate drop-shadow-sm">
                          <Download className="w-2.5 h-2.5 text-white shrink-0" />
                          <span>{doc.downloadsCount || 0}</span>
                        </div>

                        <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${theme.badge}`}>
                          {theme.typeBadge}
                        </span>

                        <div className="flex items-center gap-1">
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

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectFile(doc);
                            }}
                            className="p-1 sm:p-1.2 bg-black/60 hover:bg-black text-white rounded border border-white/20 transition-all cursor-pointer"
                            title="Options"
                          >
                            <Menu className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. MENU IMAGES : CONFORME EXACTEMENT À L'IMAGE 2                           */}
          {/* Grille 3 colonnes avec taille du fichier en blanc en haut à droite        */}
          {/* ========================================================================= */}
          {currentSubView.id === 'studycloud-category-images' && (
            <div className="flex-1 w-full px-2.5 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                  {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} disponible{filteredImages.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Grille STRICTEMENT 3 COLONNES sur mobile/tablette (comme sur la capture Image 2) */}
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-3.5">
                {filteredImages.map(img => (
                  <div
                    key={img.id}
                    onClick={() => handleSelectFile(img)}
                    className="group relative aspect-square sm:aspect-[4/5] rounded-2xl overflow-hidden bg-[#151C2C] border border-white/10 hover:border-blue-400/50 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer"
                  >
                    {/* Image en plein format (Cover) */}
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Dégradé doux en haut pour la lisibilité */}
                    <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/75 to-transparent pointer-events-none" />

                    {/* TAILLE DU FICHIER EN HAUT À DROITE EN BLANC (Exactement comme Image 2 : 2,18 Mo, 2,00 Mo...) */}
                    <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
                      <span className="text-[10px] sm:text-xs md:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
                        {img.size}
                      </span>
                    </div>

                    {/* Nom en bas au survol */}
                    <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] sm:text-xs font-bold text-white truncate">
                        {img.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. MENU VIDÉOS : CONFORME EXACTEMENT À L'IMAGE 3                           */}
          {/* Grille 3 colonnes avec bouton Play blanc au centre et taille en haut à D  */}
          {/* ========================================================================= */}
          {currentSubView.id === 'studycloud-category-videos' && (
            <div className="flex-1 w-full px-2.5 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                  {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Grille STRICTEMENT 3 COLONNES sur mobile/tablette (comme sur la capture Image 3) */}
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-3.5">
                {filteredVideos.map(vid => (
                  <div
                    key={vid.id}
                    onClick={() => handleSelectFile(vid)}
                    className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#0A0E18] border border-white/10 hover:border-purple-400/50 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer"
                  >
                    {/* Miniature vidéo */}
                    <img
                      src={vid.previewUrl}
                      alt={vid.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Voile sombre pour le contraste */}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors pointer-events-none" />

                    {/* TAILLE DU FICHIER EN HAUT À DROITE EN BLANC (Exactement comme Image 3 : 2,79 Mo, 5,28 Mo...) */}
                    <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
                      <span className="text-[10px] sm:text-xs md:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
                        {vid.size}
                      </span>
                    </div>

                    {/* BOUTON PLAY BLANC CIRCULAIRE AU CENTRE (Image 3) */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white/95 text-stone-950 flex items-center justify-center shadow-2xl group-hover:scale-115 transition-transform duration-200">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-stone-950 translate-x-0.5" />
                      </div>
                    </div>

                    {/* Titre vidéo en bas */}
                    <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                      <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">
                        {vid.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. MENU SON OU AUDIO : CONFORME EXACTEMENT À L'IMAGE 4                    */}
          {/* Liste verticale sombre, vignette noire avec note de musique blanche, etc. */}
          {/* ========================================================================= */}
          {currentSubView.id === 'studycloud-category-audio' && (
            <div className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-4">
              
              {/* Entête du lecteur audio si actif */}
              {playingAudio && (
                <div className="sticky top-14 z-20 bg-[#121826] border border-amber-400/40 rounded-2xl p-3 sm:p-4 shadow-2xl animate-in slide-in-from-top-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black border border-white/20 relative overflow-hidden flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-white stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-black text-white truncate">
                        {playingAudio.name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-amber-400 font-bold">
                        En cours de lecture • {playingAudio.size}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center font-bold transition-all shadow-md active:scale-95"
                    >
                      {isPlayingAudio ? <Pause className="w-4 h-4 fill-stone-950" /> : <Play className="w-4 h-4 fill-stone-950 translate-x-0.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayingAudio(null)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                      title="Fermer le lecteur"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* LISTE GROUPÉE PAR DATE (Comme "ven. 14 août", "19 août" sur Image 4) */}
              <div className="space-y-4 sm:space-y-6">
                {Object.entries(groupedAudio).map(([dateGroup, items]) => (
                  <div key={dateGroup} className="space-y-2">
                    
                    {/* En-tête de date avec coche sélectionnable (Image 4) */}
                    <div className="flex items-center justify-between px-2 pt-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-400">
                        {dateGroup}
                      </span>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 hover:text-white transition-colors cursor-pointer" />
                    </div>

                    {/* Liste des pistes audio */}
                    <div className="space-y-1">
                      {items.map(track => {
                        const isCurrent = playingAudio?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => handlePlayAudio(track)}
                            className={`group flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl transition-all cursor-pointer select-none ${
                              isCurrent 
                                ? 'bg-[#182236] border border-amber-400/40 shadow-md' 
                                : 'hover:bg-[#121826] border border-transparent'
                            }`}
                          >
                            {/* GAUCHE : Vignette carrée noire arrondie avec NOTE DE MUSIQUE BLANCHE (Image 4) */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black border border-white/10 relative overflow-hidden flex items-center justify-center shrink-0 shadow-sm group-hover:border-amber-400/50 transition-colors">
                                {track.previewUrl && (
                                  <img
                                    src={track.previewUrl}
                                    alt={track.name}
                                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform"
                                  />
                                )}
                                <div className="absolute inset-0 bg-black/40" />
                                <Music className="w-6 h-6 text-white stroke-[2.2] relative z-10 drop-shadow-md" />
                              </div>

                              {/* TITRE ET MÉTADONNÉES : "Nom de la piste" + "3,61 Mo • 19 août" (Image 4) */}
                              <div className="min-w-0">
                                <h3 className="text-xs sm:text-sm font-bold text-white truncate tracking-tight group-hover:text-amber-400 transition-colors">
                                  {track.name}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
                                  {track.size} • {track.date}
                                </p>
                              </div>
                            </div>

                            {/* DROITE : Menu 3 petits points verticaux (Image 4) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(menuOpenId === track.id ? null : track.id);
                                }}
                                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Options de la piste"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Menu contextuel 3 points */}
                              {menuOpenId === track.id && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-6 mt-20 z-30 w-40 bg-[#1A2234] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs font-semibold text-slate-200 animate-in fade-in"
                                >
                                  <button
                                    onClick={() => {
                                      handlePlayAudio(track);
                                      setMenuOpenId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-white"
                                  >
                                    <Play className="w-3.5 h-3.5" /> Lire la piste
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDownloadFile(track);
                                      setMenuOpenId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-white"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Télécharger
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleShareFile(track);
                                      setMenuOpenId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-white"
                                  >
                                    <Share2 className="w-3.5 h-3.5" /> Partager
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. MENU TÉLÉCHARGEMENTS : PREND TOUT TYPE DE FICHIER TÉLÉCHARGÉ           */}
          {/* Synchronisé automatiquement avec les téléchargements de l'application    */}
          {/* ========================================================================= */}
          {currentSubView.id === 'studycloud-category-downloads' && (
            <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-3 sm:space-y-4">
              
              {/* Filtres par type de fichier téléchargé */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {(['TOUS', 'DOCUMENTS', 'IMAGES', 'VIDEOS', 'AUDIO', 'AUTRES'] as const).map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedDownloadFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs border ${
                      selectedDownloadFilter === filter
                        ? 'bg-sky-500 text-white border-sky-400 scale-105'
                        : 'bg-[#04060A] hover:bg-[#121826] text-slate-300 border-white/10'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                  {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''} (tous types inclus)
                </span>
              </div>

              {filteredDownloads.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredDownloads.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFile(item as any)}
                      className="group bg-[#151C2C] hover:bg-[#1A2338] border border-slate-800 hover:border-sky-400/50 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0">
                          {item.category === 'documents' && <FileText className="w-5 h-5 text-blue-400" />}
                          {item.category === 'images' && <ImageIcon className="w-5 h-5 text-emerald-400" />}
                          {item.category === 'videos' && <Film className="w-5 h-5 text-purple-400" />}
                          {item.category === 'audio' && <Music className="w-5 h-5 text-amber-400" />}
                          {['downloads', 'apps'].includes(item.category) && <Archive className="w-5 h-5 text-sky-400" />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-sky-400 transition-colors">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-bold text-sky-300 uppercase">{item.extension || 'FICHIER'}</span>
                            <span>•</span>
                            <span>{item.size}</span>
                            <span>•</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(item);
                        }}
                        className="w-8 h-8 rounded-xl bg-black hover:bg-sky-600 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
                        title="Re-télécharger"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-sky-400 mb-3 shadow-lg">
                    <Download className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-black text-white">Aucun fichier téléchargé</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Tous les fichiers que vous téléchargez dans StudyCloud apparaîtront automatiquement ici.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. MENU APPLICATIONS : "Ce menu n'est pas disponible pour le moment."     */}
          {/* Message demandé explicitement par l'utilisateur                          */}
          {/* ========================================================================= */}
          {currentSubView.id === 'studycloud-category-apps' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center select-none min-h-[60vh]">
              <div className="w-full max-w-md mx-auto p-8 sm:p-10 rounded-3xl border border-stone-300/80 dark:border-white/10 bg-[#04060A] text-white shadow-2xl flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95">
                <div className="p-4 rounded-2xl bg-black border border-pink-500/30 text-pink-400 shadow-lg">
                  <LayoutGrid className="w-12 h-12 stroke-[1.8]" />
                </div>

                <div className="space-y-2">
                  <div className="inline-block px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[11px] font-black uppercase tracking-wider mb-1">
                    Information
                  </div>
                  
                  {/* MESSAGE DEMANDÉ PAR L'UTILISATEUR */}
                  <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight leading-snug">
                    Ce menu n'est pas disponible pour le moment.
                  </h2>
                  
                  <p className="text-xs sm:text-sm font-medium text-slate-400 max-w-xs leading-relaxed mx-auto">
                    Le catalogue et gestionnaire des applications StudyCloud sera activé lors d'une prochaine mise à jour.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentSubView(null)}
                  className="mt-2 px-6 py-2.5 rounded-full bg-[#151C2C] hover:bg-[#1E293B] text-white font-bold text-xs border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  Retour aux catégories
                </button>
              </div>
            </div>
          )}

          {/* Autres sous-menus (Collections / Classeur) */}
          {!['studycloud-category-documents', 'studycloud-category-images', 'studycloud-category-videos', 'studycloud-category-audio', 'studycloud-category-downloads', 'studycloud-category-apps'].includes(currentSubView.id) && (
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
                    Aucun fichier dans {currentSubView.name} pour le moment.
                  </p>
                </div>
              </div>
            </div>
          )}

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
          </div>

          {/* CORPS PRINCIPAL DIRECT : SANS LES DEUX BOUTONS, DIRECTEMENT LE MENU STUDYCLOUD */}
          <div className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-3 sm:py-4 space-y-4 sm:space-y-5">

            {/* SECTION 1 : RÉCENTS (STRICTEMENT 6 ÉLÉMENTS SUR 1 LIGNE) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                  Récents
                </h2>
              </div>

              {/* Grille STRICTEMENT sur 1 ligne : 6 colonnes sur écran moyen/grand */}
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

            {/* Contenu d'aperçu dynamique selon le type */}
            {activeFilePreview.isImage && activeFilePreview.previewUrl ? (
              <div className="w-full h-64 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10">
                <img 
                  src={activeFilePreview.previewUrl} 
                  alt={activeFilePreview.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : activeFilePreview.category === 'videos' ? (
              <div className="w-full h-64 rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center border border-white/10 relative">
                {activeFilePreview.previewUrl && (
                  <img
                    src={activeFilePreview.previewUrl}
                    alt={activeFilePreview.name}
                    className="w-full h-full object-cover opacity-60"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-14 h-14 rounded-full bg-white text-stone-900 flex items-center justify-center shadow-xl">
                    <Play className="w-6 h-6 fill-stone-900 translate-x-0.5" />
                  </div>
                </div>
              </div>
            ) : activeFilePreview.category === 'audio' ? (
              <div className="w-full h-44 rounded-2xl bg-[#121826] border border-amber-400/30 flex flex-col items-center justify-center p-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-amber-400 shadow-md">
                  <Music className="w-7 h-7 stroke-[2.2]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white truncate max-w-xs">{activeFilePreview.name}</p>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">Piste Audio StudyCloud</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-2xl bg-black border border-white/10 flex flex-col items-center justify-center p-4 text-center">
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
                  showToast(`Ouverture de ${activeFilePreview.name}...`);
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
