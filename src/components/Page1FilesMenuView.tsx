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
  ChevronLeft,
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
  BookOpen
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
  isFavorite?: boolean;
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // =========================================================================
  // ÉTAT DE LA DIVISION EN DEUX (SPLIT SCREEN) & LECTEUR GRAND FORMAT
  // =========================================================================
  const [splitSelectedFile, setSplitSelectedFile] = useState<FileItem | null>(null);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);

  // Lecteur Audio
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(18);
  const [audioDuration, setAudioDuration] = useState(215);
  const [audioVolume, setAudioVolume] = useState(0.85);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lecteur Vidéo
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(90);
  const [videoVolume, setVideoVolume] = useState(0.9);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Lecteur Document (Pages)
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const totalDocPages = 4;

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
      previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85'
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
      previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    {
      id: 'vid-2',
      name: 'Animation_Monde_Imaginaire.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '5,28 Mo',
      sizeBytes: 5536481,
      date: '21 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
    },
    {
      id: 'vid-3',
      name: 'Tutoriel_Debuter_En_Code.mp4',
      category: 'videos',
      source: 'YouTube',
      size: '39,07 Mo',
      sizeBytes: 40967864,
      date: '20 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
      id: 'vid-4',
      name: 'Rick_And_Morty_Extrait.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '3,22 Mo',
      sizeBytes: 3376414,
      date: '20 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    {
      id: 'vid-5',
      name: 'Arrete_De_Payer_Des_Tokens.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '7,34 Mo',
      sizeBytes: 7696547,
      date: '19 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
    },
    {
      id: 'vid-6',
      name: 'Gala_Costume_Ceremonie.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '3,45 Mo',
      sizeBytes: 3617587,
      date: '19 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4'
    },
    {
      id: 'vid-7',
      name: 'Robot_Humanoide_Laboratoire.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '6,72 Mo',
      sizeBytes: 7046430,
      date: '18 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4'
    },
    {
      id: 'vid-8',
      name: 'Inde_Voyage_Reportage.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,35 Mo',
      sizeBytes: 1415577,
      date: '18 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
    },
    {
      id: 'vid-9',
      name: 'Promenade_Foret_Nuit.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,42 Mo',
      sizeBytes: 1488977,
      date: '17 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4'
    },
    {
      id: 'vid-10',
      name: 'Orang_Outan_Tronc_Arbre.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '2,14 Mo',
      sizeBytes: 2243952,
      date: '17 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    },
    {
      id: 'vid-11',
      name: 'Concert_Violoncelle_Orchestre.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '6,95 Mo',
      sizeBytes: 7287603,
      date: '16 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
    },
    {
      id: 'vid-12',
      name: 'Parade_Militaire_Foule.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '11,01 Mo',
      sizeBytes: 11544821,
      date: '16 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4'
    },
    {
      id: 'vid-13',
      name: 'Bebe_Sourire_Famille.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '1,55 Mo',
      sizeBytes: 1625292,
      date: '15 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    {
      id: 'vid-14',
      name: 'Chorale_Enfants_Chant.mp4',
      category: 'videos',
      source: 'TikTok',
      size: '4,16 Mo',
      sizeBytes: 4362076,
      date: '15 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
    },
    {
      id: 'vid-15',
      name: 'Diogo_Almeida_Interview_AI.mp4',
      category: 'videos',
      source: 'YouTube',
      size: '20,91 Mo',
      sizeBytes: 21925724,
      date: '14 Sept',
      previewUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
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
      previewUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    },
    {
      id: 'aud-2',
      name: 'Esther Smith - Yesu Wo Mafa (Official...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '5,81 Mo',
      sizeBytes: 6092226,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
    },
    {
      id: 'aud-3',
      name: 'Esther Smith ft Morris Babyface...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '3,58 Mo',
      sizeBytes: 3753902,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
    },
    {
      id: 'aud-4',
      name: 'Esther Smith - Ma Won San (Official...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '5,47 Mo',
      sizeBytes: 5735710,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
    },
    {
      id: 'aud-5',
      name: 'Esther Smith - Me Da Wase (Official...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,37 Mo',
      sizeBytes: 4582277,
      date: '19 août',
      previewUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
    },
    {
      id: 'aud-6',
      name: 'Esther Smith - Nipa (Official Video...',
      category: 'audio',
      source: 'StudyCloud Audio',
      size: '4,87 Mo',
      sizeBytes: 5106565,
      date: '14 août',
      previewUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=400&q=80',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'
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

      const blobUrl = URL.createObjectURL(file);

      return {
        id: `rec-imp-${Date.now()}-${idx}`,
        name: file.name,
        category,
        source: 'StudyCloud',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} Mo`,
        sizeBytes: file.size,
        date: "Aujourd'hui, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        previewUrl: isImg ? blobUrl : undefined,
        videoUrl: file.type.startsWith('video/') ? blobUrl : undefined,
        audioUrl: file.type.startsWith('audio/') ? blobUrl : undefined,
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

  // SÉLECTION D'UN ÉLÉMENT : DÉCLENCHE LA DIVISION EN DEUX (SPLIT SCREEN)
  const handleSelectFile = (file: FileItem) => {
    setSplitSelectedFile(file);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);

    // Si audio, démarrer l'écouteur
    if (file.category === 'audio') {
      setIsAudioPlaying(true);
      setAudioCurrentTime(0);
    } else {
      setIsAudioPlaying(false);
    }

    // Si vidéo, réinitialiser
    if (file.category === 'videos') {
      setIsVideoPlaying(true);
      setVideoCurrentTime(0);
    } else {
      setIsVideoPlaying(false);
    }

    setCloudRecentFiles(prev => {
      const withoutCurrent = prev.filter(f => f.id !== file.id);
      return [file, ...withoutCurrent].slice(0, 6);
    });
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

  // Filtrage selon la recherche (strictement 6 éléments maximum sur l'accueil)
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
    setSplitSelectedFile(null); // Réinitialiser le split lors du changement de menu
    setIsViewerMaximized(false);
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

  // NAVIGATION PRÉCÉDENT / SUIVANT DANS LA VUE DIVISÉE
  const handleNavigateSplit = (direction: 'prev' | 'next') => {
    if (!splitSelectedFile) return;
    let list: FileItem[] = [];
    if (currentSubView?.id === 'studycloud-category-images') list = filteredImages;
    else if (currentSubView?.id === 'studycloud-category-videos') list = filteredVideos;
    else if (currentSubView?.id === 'studycloud-category-audio') list = filteredAudio;
    else if (currentSubView?.id === 'studycloud-category-documents') list = filteredDocuments;
    else if (currentSubView?.id === 'studycloud-category-downloads') list = filteredDownloads as any;
    else list = displayedFiles;

    const currentIndex = list.findIndex(f => f.id === splitSelectedFile.id);
    if (currentIndex === -1) return;
    const nextIndex = direction === 'next' 
      ? (currentIndex + 1) % list.length 
      : (currentIndex - 1 + list.length) % list.length;
    
    setSplitSelectedFile(list[nextIndex]);
    setViewerZoom(1);
    setViewerRotation(0);
    setDocCurrentPage(1);
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
      {/* SI UN SOUS-MENU EST OUVERT : NAVIGATION & AFFICHAGE                       */}
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
                    setSplitSelectedFile(null);
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

              {/* DROITE : Plein écran général */}
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
          {/* ZONE PRINCIPALE : VUE DIVISÉE EN DEUX (SPLIT SCREEN) OU PLEINE LARGEUR    */}
          {/* ========================================================================= */}
          <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden min-h-[calc(100vh-120px)] relative">
            
            {/* --------------------------------------------------------------------- */}
            {/* PANNEAU DE GAUCHE : LE RESTE DES FICHIERS                            */}
            {/* Si un élément est sélectionné, prend 50% de l'écran avec scroll       */}
            {/* --------------------------------------------------------------------- */}
            <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 ${
              isViewerMaximized 
                ? 'hidden' 
                : splitSelectedFile 
                  ? 'w-full md:w-1/2 lg:w-1/2 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80' 
                  : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
            }`}>

              {/* 1. DOCUMENTS (IMAGE 1) */}
              {currentSubView.id === 'studycloud-category-documents' && (
                <div className="space-y-3 sm:space-y-4">
                  {/* Filtres du haut : TOUS, COURS, TD, DEVOIRS */}
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

                  {/* Compteur */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} publié{filteredDocuments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Grille : s'adapte en 2 colonnes en mode divisé ou 5-6 en pleine largeur */}
                  <div className={`grid gap-2.5 sm:gap-3.5 ${
                    splitSelectedFile ? 'grid-cols-2 lg:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {filteredDocuments.map(doc => {
                      const theme = getDocumentTheme(doc.extension || 'PDF');
                      const isSelected = splitSelectedFile?.id === doc.id;
                      return (
                        <div
                          key={doc.id}
                          style={{ background: theme.bg }}
                          className={`aspect-[3/4] ${theme.border} ${isSelected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : ''} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${theme.shadow} transition-all relative group select-none overflow-hidden cursor-pointer active:scale-98`}
                          onClick={() => handleSelectFile(doc)}
                        >
                          <div className="flex items-center justify-between gap-1 z-10">
                            <span className="text-[7.5px] sm:text-[8.5px] font-black bg-white text-stone-800 border border-white px-1.5 py-0.5 rounded shadow-sm truncate max-w-[70px]">
                              {doc.documentCategory || 'COURS'}
                            </span>
                            <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
                              {doc.size}
                            </span>
                          </div>

                          <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-white p-2 relative shadow-inner border border-white/20 flex flex-col justify-between">
                            <div className="flex items-center justify-between border-b border-stone-200 pb-1">
                              <span className="text-[9px] font-black text-red-600 tracking-tighter">cme</span>
                              <span className="text-[7px] font-bold bg-stone-900 text-white px-1 py-0.2 rounded">StudyCloud</span>
                            </div>
                            <div className="my-1">
                              <p className="text-[7px] sm:text-[8px] font-black text-stone-800 leading-tight uppercase line-clamp-2">
                                AMPLIFICATEUR OPERATIONNEL EN REGIME LINEAIRE : MONTAGES DE BASE
                              </p>
                              <p className="text-[6px] text-stone-500 font-semibold mt-0.5">1. Définition</p>
                            </div>
                            <div className="w-full h-12 flex items-center justify-center bg-stone-50 rounded border border-stone-200/80 my-0.5">
                              <svg className="w-full h-full max-h-11" viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <polygon points="35,5 35,40 70,22.5" fill="#FFFFFF" stroke="#1c1917" strokeWidth="1.5" />
                                <line x1="15" y1="14" x2="35" y2="14" stroke="#1c1917" strokeWidth="1.2" />
                                <line x1="15" y1="31" x2="35" y2="31" stroke="#1c1917" strokeWidth="1.2" />
                                <text x="38" y="16" fontSize="7" fontWeight="bold" fill="#1c1917">-</text>
                                <text x="38" y="33" fontSize="7" fontWeight="bold" fill="#1c1917">+</text>
                                <line x1="70" y1="22.5" x2="90" y2="22.5" stroke="#1c1917" strokeWidth="1.2" />
                                <text x="91" y="24" fontSize="6" fontWeight="bold" fill="#1c1917">Vs</text>
                              </svg>
                            </div>
                            <div className="space-y-0.5 opacity-60">
                              <div className="h-0.5 bg-stone-400 rounded-full w-full"></div>
                              <div className="h-0.5 bg-stone-400 rounded-full w-5/6"></div>
                            </div>
                          </div>

                          <div className="px-0.5 mb-1 flex flex-col gap-0.5">
                            <p className="text-[8.5px] sm:text-[9px] font-semibold text-white truncate drop-shadow-sm" title={doc.name}>{doc.name}</p>
                            <p className="text-[9.5px] sm:text-[10px] font-black text-white truncate drop-shadow-md">{doc.name.replace(/\.[^/.]+$/, '').toUpperCase()}</p>
                          </div>

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
                                onClick={(e) => { e.stopPropagation(); handleDownloadFile(doc); }}
                                className="p-1 sm:p-1.2 bg-orange-500 hover:bg-orange-600 text-white rounded border border-stone-900 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:scale-95"
                                title="Télécharger"
                              >
                                <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. IMAGES (IMAGE 2) */}
              {currentSubView.id === 'studycloud-category-images' && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} disponible{filteredImages.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className={`grid gap-2 sm:gap-3 ${
                    splitSelectedFile ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {filteredImages.map(img => {
                      const isSelected = splitSelectedFile?.id === img.id;
                      return (
                        <div
                          key={img.id}
                          onClick={() => handleSelectFile(img)}
                          className={`group relative aspect-square sm:aspect-[4/5] rounded-2xl overflow-hidden bg-[#151C2C] border transition-all duration-200 cursor-pointer ${
                            isSelected 
                              ? 'border-blue-500 ring-4 ring-blue-500/50 shadow-2xl scale-[1.02]' 
                              : 'border-white/10 hover:border-blue-400/50 shadow-md'
                          }`}
                        >
                          <img
                            src={img.previewUrl}
                            alt={img.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/75 to-transparent pointer-events-none" />
                          <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
                            <span className="text-[10px] sm:text-xs md:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
                              {img.size}
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] sm:text-xs font-bold text-white truncate">{img.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. VIDÉOS (IMAGE 3) */}
              {currentSubView.id === 'studycloud-category-videos' && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                      {filteredVideos.length} vidéo{filteredVideos.length > 1 ? 's' : ''} disponible{filteredVideos.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className={`grid gap-2 sm:gap-3 ${
                    splitSelectedFile ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}>
                    {filteredVideos.map(vid => {
                      const isSelected = splitSelectedFile?.id === vid.id;
                      return (
                        <div
                          key={vid.id}
                          onClick={() => handleSelectFile(vid)}
                          className={`group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#0A0E18] border transition-all duration-200 cursor-pointer ${
                            isSelected 
                              ? 'border-purple-500 ring-4 ring-purple-500/50 shadow-2xl scale-[1.02]' 
                              : 'border-white/10 hover:border-purple-400/50 shadow-md'
                          }`}
                        >
                          <img
                            src={vid.previewUrl}
                            alt={vid.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors pointer-events-none" />
                          <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
                            <span className="text-[10px] sm:text-xs md:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">
                              {vid.size}
                            </span>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white/95 text-stone-950 flex items-center justify-center shadow-2xl group-hover:scale-115 transition-transform duration-200">
                              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-stone-950 translate-x-0.5" />
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                            <p className="text-[9px] sm:text-[11px] font-bold text-white truncate drop-shadow-sm">{vid.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. AUDIO (IMAGE 4) */}
              {currentSubView.id === 'studycloud-category-audio' && (
                <div className="space-y-4">
                  <div className="space-y-4 sm:space-y-6">
                    {Object.entries(groupedAudio).map(([dateGroup, items]) => (
                      <div key={dateGroup} className="space-y-2">
                        <div className="flex items-center justify-between px-2 pt-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-400">{dateGroup}</span>
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 hover:text-white transition-colors cursor-pointer" />
                        </div>
                        <div className="space-y-1">
                          {items.map(track => {
                            const isSelected = splitSelectedFile?.id === track.id;
                            return (
                              <div
                                key={track.id}
                                onClick={() => handleSelectFile(track)}
                                className={`group flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl transition-all cursor-pointer select-none ${
                                  isSelected 
                                    ? 'bg-[#182236] border border-amber-400/60 shadow-md ring-2 ring-amber-400/40' 
                                    : 'hover:bg-[#121826] border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 relative overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                    {track.previewUrl && (
                                      <img src={track.previewUrl} alt={track.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40" />
                                    <Music className="w-6 h-6 text-white stroke-[2.2] relative z-10 drop-shadow-md" />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">{track.name}</h3>
                                    <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">{track.size} • {track.date}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDownloadFile(track); }}
                                  className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. TÉLÉCHARGEMENTS */}
              {currentSubView.id === 'studycloud-category-downloads' && (
                <div className="space-y-3 sm:space-y-4">
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
                      {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''} téléchargé{filteredDownloads.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {filteredDownloads.map(item => {
                      const isSelected = splitSelectedFile?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectFile(item as any)}
                          className={`group bg-[#151C2C] hover:bg-[#1A2338] border rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer ${
                            isSelected ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-800 hover:border-sky-400/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0">
                              {item.category === 'documents' && <FileText className="w-5 h-5 text-blue-400" />}
                              {item.category === 'images' && <ImageIcon className="w-5 h-5 text-emerald-400" />}
                              {item.category === 'videos' && <Film className="w-5 h-5 text-purple-400" />}
                              {item.category === 'audio' && <Music className="w-5 h-5 text-amber-400" />}
                              {['downloads', 'apps'].includes(item.category) && <Archive className="w-5 h-5 text-sky-400" />}
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
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDownloadFile(item); }}
                            className="w-8 h-8 rounded-xl bg-black hover:bg-sky-600 text-white flex items-center justify-center transition-colors border border-white/10 shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. APPLICATIONS : "Ce menu n'est pas disponible pour le moment." */}
              {currentSubView.id === 'studycloud-category-apps' && (
                <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none min-h-[60vh]">
                  <div className="w-full max-w-md mx-auto p-8 rounded-3xl border border-stone-300/80 dark:border-white/10 bg-[#04060A] text-white shadow-2xl flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 rounded-2xl bg-black border border-pink-500/30 text-pink-400 shadow-lg">
                      <LayoutGrid className="w-12 h-12 stroke-[1.8]" />
                    </div>
                    <div className="space-y-2">
                      <div className="inline-block px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[11px] font-black uppercase tracking-wider mb-1">
                        Information
                      </div>
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

            </div>

            {/* --------------------------------------------------------------------- */}
            {/* PANNEAU DE DROITE : L'ÉLÉMENT SÉLECTIONNÉ AFFICHÉ BIEN GRAND         */}
            {/* Avec barre de boutons supérieurs (zoom, agrandir, fermer, nav...)     */}
            {/* --------------------------------------------------------------------- */}
            {splitSelectedFile && (
              <div className={`transition-all duration-300 flex flex-col bg-[#04060A] ${
                isViewerMaximized 
                  ? 'fixed inset-0 z-[100000] w-screen h-screen overflow-hidden' 
                  : 'w-full md:w-1/2 lg:w-1/2 xl:w-7/12 min-h-[500px] border-t md:border-t-0 md:border-l border-white/10'
              }`}>
                
                {/* BARRE SUPÉRIEURE DE BOUTONS DU LECTEUR GRAND FORMAT (Images 2 et 3) */}
                <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
                  
                  {/* GAUCHE : Flèches de navigation < > et titre */}
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleNavigateSplit('prev')}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Élément précédent"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateSplit('next')}
                      className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                      title="Élément suivant"
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                    </button>

                    <div className="min-w-0 ml-1">
                      <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={splitSelectedFile.name}>
                        {splitSelectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">
                        {splitSelectedFile.size} • {splitSelectedFile.source}
                      </p>
                    </div>
                  </div>

                  {/* DROITE : PETITS BOUTONS D'ACTIONS (Zoom, Rotation, Partage, Agrandir, Fermer) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    
                    {/* Zoom & Rotation (pour images et documents) */}
                    {(splitSelectedFile.category === 'images' || splitSelectedFile.isImage || splitSelectedFile.category === 'documents') && (
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

                    {/* BOUTON POUR AGRANDIR (PLEIN ÉCRAN DU LECTEUR) - DEMANDÉ PAR L'UTILISATEUR */}
                    <button
                      type="button"
                      onClick={() => setIsViewerMaximized(!isViewerMaximized)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                        isViewerMaximized 
                          ? 'bg-blue-600 text-white border-blue-400' 
                          : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
                      }`}
                      title={isViewerMaximized ? "Réduire la vue" : "Agrandir en plein écran"}
                    >
                      {isViewerMaximized ? (
                        <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                      )}
                    </button>

                    {/* BOUTON POUR FERMER CETTE VUE - DEMANDÉ PAR L'UTILISATEUR */}
                    <button
                      type="button"
                      onClick={() => {
                        setSplitSelectedFile(null);
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
                <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-1 sm:p-2 sm:px-4 overflow-hidden relative">

                  {/* 1. LECTEUR IMAGE GRAND FORMAT (Prend tout l'espace avec Zoom & Rotation) */}
                  {(splitSelectedFile.category === 'images' || splitSelectedFile.isImage) && (
                    <div className="w-full h-full flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-black/80 border border-white/10 p-1 sm:p-2 shadow-2xl">
                      <div 
                        className="transition-transform duration-200 flex items-center justify-center w-full h-full"
                        style={{
                          transform: `scale(${viewerZoom}) rotate(${viewerRotation}deg)`
                        }}
                      >
                        <img
                          src={splitSelectedFile.previewUrl || (splitSelectedFile as any).url}
                          alt={splitSelectedFile.name}
                          className={`w-full h-full object-contain rounded-xl shadow-2xl select-none transition-all ${
                            isViewerMaximized 
                              ? 'max-h-[calc(100vh-70px)]' 
                              : 'max-h-[calc(100vh-140px)]'
                          }`}
                        />
                      </div>
                      <div className="absolute bottom-3 left-4 bg-black/80 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] text-slate-300 font-bold border border-white/10">
                        Zoom : {Math.round(viewerZoom * 100)}% {viewerRotation > 0 && `• ${viewerRotation}°`}
                      </div>
                    </div>
                  )}

                  {/* 2. LECTEUR VIDÉO GRAND FORMAT INTERACTIF (Prend tout l'espace de l'écran, tout format vidéo) */}
                  {splitSelectedFile.category === 'videos' && (
                    <div className="w-full h-full flex-1 flex items-center justify-center relative p-1 sm:p-2 overflow-hidden bg-black/80 rounded-2xl border border-white/10 shadow-2xl">
                      <video
                        ref={videoRef}
                        src={splitSelectedFile.videoUrl || (splitSelectedFile as any).url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
                        poster={splitSelectedFile.previewUrl}
                        className={`w-full h-full object-contain rounded-xl select-none bg-black transition-all ${
                          isViewerMaximized 
                            ? 'max-h-[calc(100vh-70px)]' 
                            : 'max-h-[calc(100vh-140px)]'
                        }`}
                        controls
                        autoPlay
                        loop
                        playsInline
                      />
                    </div>
                  )}

                  {/* 3. LECTEUR AUDIO GRAND FORMAT INTERACTIF (Capable de lire tout son) */}
                  {splitSelectedFile.category === 'audio' && (
                    <div className={`w-full bg-[#0C1220] border border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 ${
                      isViewerMaximized ? 'max-w-2xl my-auto' : 'max-w-lg my-auto'
                    }`}>
                      
                      {/* Élément audio natif */}
                      <audio
                        ref={audioRef}
                        src={splitSelectedFile.audioUrl || (splitSelectedFile as any).url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'}
                        autoPlay={isAudioPlaying}
                        loop
                      />

                      {/* Vignette disque album avec animation */}
                      <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-black border-4 border-amber-400/40 p-1 shadow-2xl flex items-center justify-center">
                        <div className={`w-full h-full rounded-full overflow-hidden relative flex items-center justify-center ${
                          isAudioPlaying ? 'animate-spin' : ''
                        }`} style={{ animationDuration: '8s' }}>
                          {splitSelectedFile.previewUrl ? (
                            <img src={splitSelectedFile.previewUrl} alt="Album" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-600 via-stone-900 to-black flex items-center justify-center" />
                          )}
                          <div className="absolute w-10 h-10 rounded-full bg-stone-950 border-2 border-white/30 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                          </div>
                        </div>
                      </div>

                      {/* Titre et artiste */}
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                          {splitSelectedFile.name}
                        </h3>
                        <p className="text-xs text-amber-400 font-bold">
                          {splitSelectedFile.size} • Piste Audio Haute Définition
                        </p>
                      </div>

                      {/* Barres d'ondes audio animées */}
                      <div className="flex items-center justify-center gap-1.5 h-8 w-full max-w-xs">
                        {[40, 75, 55, 90, 65, 80, 45, 95, 70, 85, 50, 60, 90, 40, 75].map((h, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full bg-gradient-to-t from-amber-500 to-yellow-300 transition-all duration-150 ${
                              isAudioPlaying ? 'animate-pulse' : 'opacity-30'
                            }`}
                            style={{ 
                              height: isAudioPlaying ? `${h}%` : '20%',
                              animationDelay: `${i * 0.08}s`
                            }}
                          />
                        ))}
                      </div>

                      {/* Curseur de progression (Seek bar) */}
                      <div className="w-full space-y-1">
                        <input
                          type="range"
                          min="0"
                          max={audioDuration}
                          value={audioCurrentTime}
                          onChange={(e) => setAudioCurrentTime(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                          <span>{formatTime(audioCurrentTime)}</span>
                          <span>{formatTime(audioDuration)}</span>
                        </div>
                      </div>

                      {/* Commandes audio interactives */}
                      <div className="flex items-center justify-center gap-4 pt-1">
                        <button
                          type="button"
                          onClick={() => setAudioCurrentTime(prev => Math.max(0, prev - 10))}
                          className="w-9 h-9 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center transition-colors border border-white/10"
                          title="Reculer de 10s"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center shadow-xl font-bold transition-all active:scale-95"
                          title={isAudioPlaying ? "Mettre en pause" : "Lire"}
                        >
                          {isAudioPlaying ? (
                            <Pause className="w-6 h-6 fill-stone-950" />
                          ) : (
                            <Play className="w-6 h-6 fill-stone-950 translate-x-0.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setAudioCurrentTime(prev => Math.min(audioDuration, prev + 10))}
                          className="w-9 h-9 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center transition-colors border border-white/10"
                          title="Avancer de 10s"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  )}

                  {/* 4. LECTEUR DOCUMENT GRAND FORMAT (Prend tout l'espace) */}
                  {splitSelectedFile.category === 'documents' && (
                    <div className={`w-full h-full flex-1 flex flex-col items-center space-y-3 overflow-y-auto px-1 sm:px-4 py-2 ${
                      isViewerMaximized ? 'max-w-6xl' : 'max-w-4xl'
                    }`}>
                      
                      {/* Contrôle des pages */}
                      <div className="w-full bg-[#121826] border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-white shrink-0 shadow-md">
                        <span className="font-bold flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-400" /> Page {docCurrentPage} sur {totalDocPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={docCurrentPage <= 1}
                            onClick={() => setDocCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-2.5 py-1 rounded-lg bg-black hover:bg-slate-800 disabled:opacity-40 text-xs font-bold border border-white/10 transition-colors"
                          >
                            Précédent
                          </button>
                          <button
                            type="button"
                            disabled={docCurrentPage >= totalDocPages}
                            onClick={() => setDocCurrentPage(prev => Math.min(totalDocPages, prev + 1))}
                            className="px-2.5 py-1 rounded-lg bg-black hover:bg-slate-800 disabled:opacity-40 text-xs font-bold border border-white/10 transition-colors"
                          >
                            Suivant
                          </button>
                        </div>
                      </div>

                      {/* Feuille de document haute définition format A4 réaliste */}
                      <div 
                        className="w-full flex-1 bg-white text-stone-900 rounded-2xl shadow-2xl p-6 sm:p-10 md:p-12 space-y-6 border border-stone-300 transition-transform duration-200"
                        style={{
                          transform: `scale(${viewerZoom})`
                        }}
                      >
                        {/* En-tête officiel CME & StudyCloud */}
                        <div className="flex items-center justify-between border-b-2 border-stone-900 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-red-600 tracking-tight">cme</span>
                            <span className="text-xs text-stone-500 font-bold">Électronique Fondamentale</span>
                          </div>
                          <span className="px-2.5 py-1 bg-stone-900 text-white rounded-md text-[10px] font-black uppercase">
                            StudyCloud Drive
                          </span>
                        </div>

                        {/* Titre du chapitre */}
                        <div className="space-y-1 pt-1">
                          <h2 className="text-sm sm:text-base font-black text-stone-900 uppercase tracking-tight">
                            AMPLIFICATEUR OPERATIONNEL EN REGIME LINEAIRE : MONTAGES DE BASE
                          </h2>
                          <p className="text-xs text-stone-600 font-bold">
                            Fascicule de Travaux Dirigés & Cours Magistral • {splitSelectedFile.documentCategory || 'COURS'}
                          </p>
                        </div>

                        {/* Schéma électronique AOP Grand Format */}
                        <div className="w-full bg-stone-50 rounded-xl p-4 border border-stone-200 flex flex-col items-center justify-center">
                          <p className="text-[11px] font-black text-stone-700 self-start mb-2">
                            Schéma 1 : Montage Amplificateur Inverseur de Tension (AOP Idéal)
                          </p>
                          <svg className="w-full max-w-md h-36" viewBox="0 0 160 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Triangle AOP */}
                            <polygon points="60,10 60,60 115,35" fill="#FFFFFF" stroke="#1c1917" strokeWidth="2" />
                            {/* Entrées */}
                            <line x1="20" y1="23" x2="60" y2="23" stroke="#1c1917" strokeWidth="1.8" />
                            <line x1="20" y1="47" x2="60" y2="47" stroke="#1c1917" strokeWidth="1.8" />
                            {/* Résistance d'entrée R1 */}
                            <rect x="30" y="19" width="16" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
                            <text x="34" y="25" fontSize="6" fontWeight="bold" fill="#1c1917">R1</text>
                            {/* Signes - et + */}
                            <text x="64" y="26" fontSize="10" fontWeight="bold" fill="#1c1917">-</text>
                            <text x="64" y="50" fontSize="10" fontWeight="bold" fill="#1c1917">+</text>
                            {/* Sortie */}
                            <line x1="115" y1="35" x2="150" y2="35" stroke="#1c1917" strokeWidth="1.8" />
                            <text x="152" y="38" fontSize="9" fontWeight="bold" fill="#dc2626">Vs</text>
                            {/* Boucle de contre-réaction R2 */}
                            <line x1="50" y1="23" x2="50" y2="7" stroke="#1c1917" strokeWidth="1.5" />
                            <line x1="50" y1="7" x2="130" y2="7" stroke="#1c1917" strokeWidth="1.5" />
                            <line x1="130" y1="7" x2="130" y2="35" stroke="#1c1917" strokeWidth="1.5" />
                            <rect x="80" y="3" width="20" height="8" fill="#F5F5F4" stroke="#1c1917" strokeWidth="1.5" />
                            <text x="86" y="9.5" fontSize="6" fontWeight="bold" fill="#1c1917">R2</text>
                            {/* Masse non inverseuse */}
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
                        <div className="space-y-1.5 text-xs text-stone-700 leading-relaxed">
                          <p className="font-bold text-stone-900">1. Définition et principe de fonctionnement :</p>
                          <p>
                            Un amplificateur opérationnel idéal possède un gain infini en boucle ouverte et une impédance d'entrée infinie.
                            En régime linéaire, la tension différentielle d'entrée ε = V+ - V- est nulle (court-circuit virtuel).
                          </p>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* 5. FICHIERS DIVERS / ARCHIVES */}
                  {!['images', 'videos', 'audio', 'documents'].includes(splitSelectedFile.category) && !splitSelectedFile.isImage && (
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

    </div>
  );
};
