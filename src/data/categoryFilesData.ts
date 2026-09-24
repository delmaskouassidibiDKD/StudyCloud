// src/data/categoryFilesData.ts
// Données complètes et exhaustives de toutes les galeries StudyCloud

export interface CategoryFileItem {
  id: string;
  name: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'downloads';
  source?: string;
  size?: string;
  sizeBytes?: number;
  date?: string;
  extension?: string;
  isImage?: boolean;
  previewUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  artist?: string;
  durationSec?: number;
  lyricsSnippet?: string;
  fullLyrics?: string[];
  documentCategory?: string;
  downloadsCount?: number;
  url?: string;
  type?: string;
  folderName?: string;
  matiere?: string;
}

export const DEFAULT_IMAGES_LIST: CategoryFileItem[] = [
  {
    id: 'img-1',
    name: 'Capture_ecran_Dashboard.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,18 Mo',
    sizeBytes: 2285895,
    date: '21 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-2',
    name: 'Architecture_Cloud_Diagramme.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,00 Mo',
    sizeBytes: 2097152,
    date: '21 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-3',
    name: 'Schema_Reseau_Entreprise.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,61 Mo',
    sizeBytes: 2736783,
    date: '20 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-4',
    name: 'Citation_Bague_Promesse.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '292 ko',
    sizeBytes: 299008,
    date: '19 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-5',
    name: 'Interface_StudyCloud_Dark.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,55 Mo',
    sizeBytes: 2673868,
    date: '18 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-6',
    name: 'Fond_Ecran_Paysage_Nature.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,90 Mo',
    sizeBytes: 3040870,
    date: '18 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-7',
    name: 'IMG-20260923-WA0012.jpg',
    category: 'images',
    source: 'WhatsApp Images',
    size: '503 ko',
    sizeBytes: 515072,
    date: '17 Sept',
    extension: 'JPG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=85',
    type: 'image/jpeg'
  },
  {
    id: 'img-8',
    name: 'Dossier_Roblox_Projet.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,33 Mo',
    sizeBytes: 2443182,
    date: '16 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-9',
    name: 'Menu_Applications_Grille.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '521 ko',
    sizeBytes: 533504,
    date: '15 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-10',
    name: 'Dossier_Supply_Chain_Jaune.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '41,33 ko',
    sizeBytes: 42321,
    date: '15 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  },
  {
    id: 'img-11',
    name: 'Dashboard_Navigation_Home.png',
    category: 'images',
    source: 'WhatsApp Images',
    size: '2,56 Mo',
    sizeBytes: 2684354,
    date: '14 Sept',
    extension: 'PNG',
    isImage: true,
    previewUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85',
    url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85',
    type: 'image/png'
  }
];

export const DEFAULT_VIDEOS_LIST: CategoryFileItem[] = [
  {
    id: 'vid-1',
    name: 'Labyrinthe_Psychologie_Societe.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '2,79 Mo',
    sizeBytes: 2925527,
    date: '21 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-2',
    name: 'Animation_Monde_Imaginaire.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '5,28 Mo',
    sizeBytes: 5536481,
    date: '21 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-3',
    name: 'Tutoriel_Debuter_En_Code.mp4',
    category: 'videos',
    source: 'YouTube',
    size: '39,07 Mo',
    sizeBytes: 40967864,
    date: '20 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-4',
    name: 'Rick_And_Morty_Extrait.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '3,22 Mo',
    sizeBytes: 3376414,
    date: '20 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-5',
    name: 'Arrete_De_Payer_Des_Tokens.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '7,34 Mo',
    sizeBytes: 7696547,
    date: '19 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-6',
    name: 'Gala_Costume_Ceremonie.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '3,45 Mo',
    sizeBytes: 3617587,
    date: '19 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-7',
    name: 'Robot_Humanoide_Laboratoire.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '6,72 Mo',
    sizeBytes: 7046430,
    date: '18 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-8',
    name: 'Inde_Voyage_Reportage.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '1,35 Mo',
    sizeBytes: 1415577,
    date: '18 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-9',
    name: 'Promenade_Foret_Nuit.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '1,42 Mo',
    sizeBytes: 1488977,
    date: '17 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-10',
    name: 'Orang_Outan_Tronc_Arbre.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '2,14 Mo',
    sizeBytes: 2243952,
    date: '17 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-11',
    name: 'Concert_Violoncelle_Orchestre.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '6,95 Mo',
    sizeBytes: 7287603,
    date: '16 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    type: 'video/mp4'
  },
  {
    id: 'vid-12',
    name: 'Parade_Militaire_Foule.mp4',
    category: 'videos',
    source: 'TikTok',
    size: '11,01 Mo',
    sizeBytes: 11544821,
    date: '16 Sept',
    extension: 'MP4',
    previewUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    type: 'video/mp4'
  }
];

export const DEFAULT_AUDIO_LIST: CategoryFileItem[] = [
  {
    id: 'aud-img3-1',
    name: 'Another Love X Memories (Lyrics).mp3',
    artist: '<unknown> - Another Love X Memories...',
    category: 'audio',
    source: 'StudyCloud Audio',
    size: '4,12 Mo',
    sizeBytes: 4320140,
    date: '09-16',
    extension: 'MP3',
    durationSec: 225,
    previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    type: 'audio/mpeg'
  },
  {
    id: 'aud-img3-2',
    name: 'Raindance (Lyrics).mp3',
    artist: 'Dave & Tems - Dave & Tems',
    category: 'audio',
    source: 'StudyCloud Audio',
    size: '5,80 Mo',
    sizeBytes: 6081740,
    date: '09-16',
    extension: 'MP3',
    durationSec: 219,
    previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    type: 'audio/mpeg'
  },
  {
    id: 'aud-img3-3',
    name: 'Davy One (Paroles).mp3',
    artist: "T'es Une Étoile - T'es Une Étoile",
    category: 'audio',
    source: 'StudyCloud Audio',
    size: '3,84 Mo',
    sizeBytes: 4026531,
    date: '09-16',
    extension: 'MP3',
    durationSec: 192,
    previewUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    type: 'audio/mpeg'
  },
  {
    id: 'aud-img3-4',
    name: "On s'fait du mal (Clip officiel).mp3",
    artist: 'Black M - Black M',
    category: 'audio',
    source: 'StudyCloud Audio',
    size: '4,56 Mo',
    sizeBytes: 4781506,
    date: '09-16',
    extension: 'MP3',
    durationSec: 214,
    previewUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=400&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    type: 'audio/mpeg'
  },
  {
    id: 'aud-img3-5',
    name: 'RUN (Paroles/Lyrics).mp3',
    artist: "Rim'K x SDM - Rim'K x SDM",
    category: 'audio',
    source: 'StudyCloud Audio',
    size: '3,45 Mo',
    sizeBytes: 3617587,
    date: '08-26',
    extension: 'MP3',
    durationSec: 178,
    previewUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    type: 'audio/mpeg'
  },
  {
    id: 'aud-img3-6',
    name: "Je M'Excuse (Lyrics Video Official).mp3",
    artist: "Blam'S - Blam'S",
    category: 'audio',
    source: 'StudyCloud Audio',
    size: '4,10 Mo',
    sizeBytes: 4299161,
    date: '08-24',
    extension: 'MP3',
    durationSec: 200,
    previewUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    type: 'audio/mpeg'
  }
];

export const DEFAULT_DOCUMENTS_LIST: CategoryFileItem[] = [
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
    downloadsCount: 0,
    type: 'application/pdf',
    url: ''
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
    downloadsCount: 0,
    type: 'application/pdf',
    url: ''
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
    downloadsCount: 0,
    type: 'application/pdf',
    url: ''
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
    downloadsCount: 3,
    type: 'application/pdf',
    url: ''
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
    downloadsCount: 5,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    url: ''
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
    downloadsCount: 2,
    type: 'application/pdf',
    url: ''
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
    downloadsCount: 7,
    type: 'application/pdf',
    url: ''
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
    downloadsCount: 4,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    url: ''
  }
];

export function getGalleryFilesForCategory(categoryOrMenuName: string): any[] {
  const norm = (categoryOrMenuName || '').toLowerCase().trim();

  let rawList: CategoryFileItem[] = [];
  let canonicalName = categoryOrMenuName || 'Mes fichiers';

  if (norm.includes('image') || norm === 'images') {
    rawList = DEFAULT_IMAGES_LIST;
    canonicalName = 'Images';
  } else if (norm.includes('vid') || norm === 'vidéos' || norm === 'videos') {
    rawList = DEFAULT_VIDEOS_LIST;
    canonicalName = 'Vidéos';
  } else if (norm.includes('musiq') || norm.includes('audio') || norm.includes('son')) {
    rawList = DEFAULT_AUDIO_LIST;
    canonicalName = 'Musique';
  } else if (norm.includes('doc')) {
    rawList = DEFAULT_DOCUMENTS_LIST;
    canonicalName = 'Documents';
  }

  return rawList.map(item => {
    const ext = item.extension || (item.name && item.name.includes('.') ? item.name.split('.').pop()?.toUpperCase() || 'FICHIER' : 'FICHIER');
    return {
      id: item.id,
      name: item.name,
      size: item.sizeBytes || 0,
      type: item.type || (item.isImage ? 'image/jpeg' : (item.videoUrl ? 'video/mp4' : (item.audioUrl ? 'audio/mpeg' : 'application/pdf'))),
      extension: ext,
      url: item.url || item.previewUrl || item.audioUrl || item.videoUrl || '',
      previewUrl: item.previewUrl,
      audioUrl: item.audioUrl,
      videoUrl: item.videoUrl,
      isImage: !!item.isImage,
      category: item.category,
      folderName: canonicalName,
      matiere: canonicalName,
      source: item.source || canonicalName
    };
  });
}
