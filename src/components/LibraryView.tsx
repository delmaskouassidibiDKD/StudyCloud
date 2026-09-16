import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Search, FileText, Download, Folder, Eye, Sparkles, Building2, Menu, X, GraduationCap, Package, ChevronDown, ArrowLeft, Share2, Copy, ShoppingCart, RefreshCw, Globe, Hash, RotateCcw, Link2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { SharedFolder, SharedFile } from '../types';
import { FileIconBadge } from './FileIconBadge';
import { StudyCloudAPI, getWorkerApiUrl } from '../services/api';
import { DownloadDestinationModal, DownloadDestinationChoice } from './DownloadDestinationModal';
import { importFilesToMesFichiers } from '../services/userSync';
import studentLogo from '../assets/student-logo.jpg';

if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions?.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

// Cache en mémoire vive JavaScript (RAM uniquement, JAMAIS de localStorage pour éviter les quotas/problèmes)
// Garantit zéro clignotement lors des navigations et re-rendus
const memoryThumbnailCache = new Map<string, string>();

export interface DocTypeInfo {
  name: string;
  badgeClass: string;
  cardBgClass: string;
  cardBorderClass: string;
  cardShadowClass: string;
  accentTextClass: string;
}

export function getDocTypeInfo(doc: any): DocTypeInfo {
  const fileName = (doc.file_name || doc.title || '').toLowerCase();
  const fileType = (doc.file_type || '').toLowerCase();

  if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
    return {
      name: 'PDF',
      badgeClass: 'bg-white text-red-700 border-white shadow-sm',
      cardBgClass: 'bg-red-600',
      cardBorderClass: 'border-2 border-red-700 hover:border-red-500',
      cardShadowClass: 'shadow-[2.5px_2.5px_0px_0px_#7f1d1d] hover:shadow-[4px_4px_0px_0px_#991b1b]',
      accentTextClass: 'text-white',
      cardBgStyle: { backgroundColor: '#dc2626' },
    };
  }

  if (fileType.includes('word') || /\.(docx|doc)$/i.test(fileName)) {
    return {
      name: 'WORD',
      badgeClass: 'bg-white text-blue-700 border-white shadow-sm',
      cardBgClass: 'bg-blue-600',
      cardBorderClass: 'border-2 border-blue-700 hover:border-blue-500',
      cardShadowClass: 'shadow-[2.5px_2.5px_0px_0px_#1e3a8a] hover:shadow-[4px_4px_0px_0px_#1d4ed8]',
      accentTextClass: 'text-white',
      cardBgStyle: { backgroundColor: '#2563eb' },
    };
  }

  if (fileType.includes('sheet') || /\.(xlsx|xls|csv)$/i.test(fileName)) {
    return {
      name: 'EXCEL',
      badgeClass: 'bg-white text-emerald-700 border-white shadow-sm',
      cardBgClass: 'bg-emerald-600',
      cardBorderClass: 'border-2 border-emerald-700 hover:border-emerald-500',
      cardShadowClass: 'shadow-[2.5px_2.5px_0px_0px_#064e3b] hover:shadow-[4px_4px_0px_0px_#047857]',
      accentTextClass: 'text-white',
      cardBgStyle: { backgroundColor: '#059669' },
    };
  }

  if (fileType.includes('presentation') || /\.(pptx|ppt)$/i.test(fileName)) {
    return {
      name: 'PPT',
      badgeClass: 'bg-white text-amber-700 border-white shadow-sm',
      cardBgClass: 'bg-amber-600',
      cardBorderClass: 'border-2 border-amber-700 hover:border-amber-500',
      cardShadowClass: 'shadow-[2.5px_2.5px_0px_0px_#78350f] hover:shadow-[4px_4px_0px_0px_#b45309]',
      accentTextClass: 'text-white',
      cardBgStyle: { backgroundColor: '#d97706' },
    };
  }

  if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName)) {
    return {
      name: 'IMAGE',
      badgeClass: 'bg-white text-teal-700 border-white shadow-sm',
      cardBgClass: 'bg-teal-600',
      cardBorderClass: 'border-2 border-teal-700 hover:border-teal-500',
      cardShadowClass: 'shadow-[2.5px_2.5px_0px_0px_#115e59] hover:shadow-[4px_4px_0px_0px_#0f766e]',
      accentTextClass: 'text-white',
      cardBgStyle: { backgroundColor: '#0d9488' },
    };
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'DOC' : 'DOC';

  let badgeClass = 'bg-stone-700/40 text-stone-300 border-stone-600';
  let cardBgStyle = { background: 'linear-gradient(180deg, #26272b 0%, #1c1c1f 100%)' };
  let cardBorderClass = 'border-2 border-stone-700 hover:border-stone-500';
  let cardShadowClass = 'shadow-[2.5px_2.5px_0px_0px_#1c1917] hover:shadow-[4px_4px_0px_0px_#292524]';
  let accentTextClass = 'text-stone-300';

  if (ext === 'PDF') {
    badgeClass = 'bg-red-900 text-red-100 border-red-500';
    cardBgStyle = { background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)' }; // red-600 to red-800
    cardBorderClass = 'border-2 border-red-500 hover:border-red-400';
    cardShadowClass = 'shadow-[2.5px_2.5px_0px_0px_#450a0a] hover:shadow-[4px_4px_0px_0px_#7f1d1d]';
    accentTextClass = 'text-red-100';
  } else if (['DOC', 'DOCX'].includes(ext)) {
    badgeClass = 'bg-blue-900 text-blue-100 border-blue-500';
    cardBgStyle = { background: 'linear-gradient(180deg, #2563eb 0%, #1e40af 100%)' }; // blue-600 to blue-800
    cardBorderClass = 'border-2 border-blue-500 hover:border-blue-400';
    cardShadowClass = 'shadow-[2.5px_2.5px_0px_0px_#172554] hover:shadow-[4px_4px_0px_0px_#1e3a8a]';
    accentTextClass = 'text-blue-100';
  } else if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(ext)) {
    badgeClass = 'bg-green-900 text-green-100 border-green-500';
    cardBgStyle = { background: 'linear-gradient(180deg, #059669 0%, #065f46 100%)' }; // emerald-600 to emerald-800
    cardBorderClass = 'border-2 border-green-500 hover:border-green-400';
    cardShadowClass = 'shadow-[2.5px_2.5px_0px_0px_#052e16] hover:shadow-[4px_4px_0px_0px_#14532d]';
    accentTextClass = 'text-green-100';
  } else if (['PPT', 'PPTX'].includes(ext)) {
    badgeClass = 'bg-orange-900 text-orange-100 border-orange-500';
    cardBgStyle = { background: 'linear-gradient(180deg, #ea580c 0%, #9a3412 100%)' }; // orange-600 to orange-800
    cardBorderClass = 'border-2 border-orange-500 hover:border-orange-400';
    cardShadowClass = 'shadow-[2.5px_2.5px_0px_0px_#431407] hover:shadow-[4px_4px_0px_0px_#7c2d12]';
    accentTextClass = 'text-orange-100';
  } else if (['XLS', 'XLSX', 'CSV'].includes(ext)) {
    badgeClass = 'bg-emerald-900 text-emerald-100 border-emerald-500';
    cardBgStyle = { background: 'linear-gradient(180deg, #0d9488 0%, #115e59 100%)' }; // teal-600 to teal-800
    cardBorderClass = 'border-2 border-emerald-500 hover:border-emerald-400';
    cardShadowClass = 'shadow-[2.5px_2.5px_0px_0px_#022c22] hover:shadow-[4px_4px_0px_0px_#064e3b]';
    accentTextClass = 'text-emerald-100';
  }

  return {
    name: ext,
    badgeClass,
    cardBgStyle,
    cardBorderClass,
    cardShadowClass,
    accentTextClass,
  };
}

// Composant miniature intelligent (rendu 1ère page PDF haute qualité / image / cadrage de l'en-tête vers le bas)
const DocumentCardThumbnail: React.FC<{ doc: any; onClick?: () => void }> = ({ doc, onClick }) => {
  const cacheKey = doc.id || doc.file_url || '';
  const fileName = (doc.file_name || doc.title || '').toLowerCase();
  const fileUrl = doc.file_url;
  const isImage = doc.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName);
  const isPdf = doc.file_type?.includes('pdf') || /\.pdf$/i.test(fileName);

  const initialThumb = isImage ? fileUrl : (cacheKey ? memoryThumbnailCache.get(cacheKey) || null : null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(initialThumb);
  const [isRendering, setIsRendering] = useState<boolean>(!initialThumb && isPdf && !!fileUrl);
  useEffect(() => {
    let isMounted = true;
    if (isImage && fileUrl) {
      setThumbUrl(fileUrl);
      return;
    }

    if (cacheKey && memoryThumbnailCache.has(cacheKey)) {
      setThumbUrl(memoryThumbnailCache.get(cacheKey)!);
      setIsRendering(false);
      return;
    }

    if (isPdf && fileUrl) {
      setIsRendering(true);
      let isMountedLocal = true;

      const r2ThumbUrl = `${fileUrl}_thumb.png`;
      const img = new Image();
      img.onload = () => {
        if (isMountedLocal) {
          setThumbUrl(r2ThumbUrl);
          setIsRendering(false);
          if (cacheKey) memoryThumbnailCache.set(cacheKey, r2ThumbUrl);
        }
      };
      img.onerror = () => {
        // Fallback: Si la miniature serveur n'existe pas (anciens fichiers), on génère en local
        (async () => {
          try {
            const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 4.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context && isMountedLocal) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context, viewport }).promise;
              if (isMountedLocal) {
                const dataUrl = canvas.toDataURL('image/png');
                if (cacheKey) {
                  memoryThumbnailCache.set(cacheKey, dataUrl);
                }
                setThumbUrl(dataUrl);
                setIsRendering(false);
              }
            }
          } catch (e) {
            if (isMountedLocal) setIsRendering(false);
          }
        })();
      };
      img.src = r2ThumbUrl;

      return () => {
        isMountedLocal = false;
        isMounted = false;
      };
    }
  }, [cacheKey, fileUrl, fileName, isImage, isPdf]);

  const rawFileName = doc.file_name || doc.title || '';
  const typeInfo = getDocTypeInfo(doc);

  if (thumbUrl) {
    return (
      <div
        onClick={onClick}
        className="w-full h-full relative cursor-pointer overflow-hidden rounded-md group select-none"
        title="Cliquer pour ouvrir le document dans l'application"
      >
        {/* object-cover object-top : cadre l'en-tête du document tout en haut et descend vers le bas */}
        <img
          src={thumbUrl}
          alt={rawFileName}
          className="w-full h-full object-cover object-top rounded-md shadow-inner transition-transform duration-200 group-hover:scale-[1.02]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
      </div>
    );
  }

  // Pendant le rendu initial : affichage discret et stable pour éviter tout clignotement
  if (isRendering) {
    return (
      <div onClick={onClick} className="w-full h-full p-2 flex flex-col items-center justify-center bg-stone-900/60 rounded-md cursor-pointer animate-pulse">
        <FileText className="w-6 h-6 text-red-400 opacity-60 mb-1" />
        <span className="text-[7.5px] font-bold text-stone-400">Chargement aperçu...</span>
      </div>
    );
  }

  const isDocx = /\.(docx|doc)$/i.test(fileName);
  const isXlsx = /\.(xlsx|xls|csv)$/i.test(fileName);
  const isPptx = /\.(pptx|ppt)$/i.test(fileName);

  return (
    <div
      onClick={onClick}
      className="w-full h-full p-2 flex flex-col justify-between rounded-md cursor-pointer select-none relative overflow-hidden shadow-inner bg-gradient-to-b from-stone-100 to-stone-200 border border-stone-300 group-hover:border-stone-400 transition-all"
      title="Cliquer pour ouvrir le document"
    >
      <div className="flex items-center justify-between border-b border-stone-300/80 pb-1">
        <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider ${
          isPdf ? 'bg-red-600 text-white' :
          isDocx ? 'bg-blue-600 text-white' :
          isXlsx ? 'bg-emerald-600 text-white' :
          isPptx ? 'bg-amber-600 text-white' : 'bg-stone-700 text-white'
        }`}>
          {typeInfo.name}
        </span>
        <FileIconBadge fileName={rawFileName} size={16} />
      </div>

      <div className="flex-1 flex flex-col justify-center my-1 space-y-1 px-0.5">
        <p className="text-[8.5px] sm:text-[9.5px] font-extrabold text-stone-800 line-clamp-3 leading-tight drop-shadow-sm">
          {doc.title || rawFileName}
        </p>
        <div className="space-y-0.5 pt-0.5 opacity-60">
          <div className="h-1 bg-stone-400 rounded-full w-full"></div>
          <div className="h-1 bg-stone-400 rounded-full w-4/5"></div>
          <div className="h-1 bg-stone-300 rounded-full w-3/5"></div>
        </div>
      </div>

      <div className="text-[7px] sm:text-[7.5px] font-bold text-stone-500 truncate flex items-center justify-between pt-1 border-t border-stone-300/60">
        <span className="truncate">{doc.school || 'Document étudiant'}</span>
        <span className="text-orange-600 font-extrabold text-[7.5px]">Ouvrir</span>
      </div>
    </div>
  );
};


interface ProductItem {
  id: string;
  sellerId?: string;
  seller_id?: string;
  sellerName?: string;
  seller_name?: string;
  sellerSchool?: string;
  seller_school?: string;
  sellerFiliere?: string;
  seller_filiere?: string;
  sellerCountry?: string;
  seller_country?: string;
  sellerPhone?: string;
  seller_phone?: string;
  sellerWhatsapp?: string;
  seller_whatsapp?: string;
  sellerAvatarUrl?: string;
  seller_avatar_url?: string;
  title: string;
  description: string;
  price: string;
  currency?: string;
  category: string;
  date: string;
  views?: number;
  sales?: number;
  imageUrl?: string;
  imageUrls?: string[];
  isBoosted?: boolean;
  is_boosted?: boolean;
  boostStatus?: 'active' | 'completed';
  boostFormula?: string;
  boostViewsTarget?: number;
  boostViewsCurrent?: number;
  boostEndDate?: string;
  _relevance_score?: number;
}

interface LibraryViewProps {
  folders: SharedFolder[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectFolder: (folder: SharedFolder) => void;
  setActivePreviewItem: (file: any) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

const DEFAULT_PRODUCTS: ProductItem[] = [];

export const LibraryView: React.FC<LibraryViewProps> = ({
  folders,
  searchQuery,
  setSearchQuery,
  onSelectFolder,
  setActivePreviewItem,
  onOpenCreateShareLink,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [activeSubTab, setActiveSubTab] = useState<'librairie' | 'ressources' | 'liens'>(() => {
    return (localStorage.getItem('studycloud_library_subtab') as any) || 'ressources';
  });
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string | null>(null);
  const [selectedFiliereFilter, setSelectedFiliereFilter] = useState<string | null>(null);
  const [selectedMatiereFilter, setSelectedMatiereFilter] = useState<string | null>(null);
  const [isRecentFilterActive, setIsRecentFilterActive] = useState<boolean>(false);
  const [showSchoolsModal, setShowSchoolsModal] = useState(false);
  const [showFiliereModal, setShowFiliereModal] = useState(false);
  const [showMatiereModal, setShowMatiereModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [activeCategoryTooltipId, setActiveCategoryTooltipId] = useState<string | null>(null);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [matiereSearchQuery, setMatiereSearchQuery] = useState('');

  // Mode d'affichage des ressources : 'preview' (Image 2 avec aperçus par défaut) ou 'compact' (style informations actuelles)
  const [resourceViewMode, setResourceViewMode] = useState<'preview' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('studycloud_resource_view_mode');
      if (saved === 'preview' || saved === 'compact') return saved;
    } catch (e) {}
    return 'preview'; // Par défaut en mode aperçu visuel (image 2)
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_resource_view_mode', resourceViewMode);
    } catch (e) {}
  }, [resourceViewMode]);

  // Cartes dont la vue a été basculée individuellement (bouton à trois traits)
  const [flippedCardIds, setFlippedCardIds] = useState<Set<string>>(new Set());

  const toggleCardFlip = (docId: string) => {
    setFlippedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // Filtres dynamiques réels depuis la base de données (Cloudflare D1)
  const [availableSchools, setAvailableSchools] = useState<string[]>([]);
  const [availableMatieres, setAvailableMatieres] = useState<string[]>([]);

  useEffect(() => {
    StudyCloudAPI.getPublishedDocumentFilters()
      .then(res => {
        if (res && res.success) {
          if (Array.isArray(res.schools)) setAvailableSchools(res.schools);
          if (Array.isArray(res.matieres)) setAvailableMatieres(res.matieres);
        }
      })
      .catch(err => console.warn('Erreur chargement filtres dynamiques:', err));
  }, []);

  const handleDocDownload = (doc: any) => {
    const uid = localStorage.getItem('unifolder_user_id') || 'default-user';
    setPublishedDocs(prev => prev.map(d => d.id === doc.id ? { ...d, downloads_count: (d.downloads_count || 0) + 1 } : d));
    StudyCloudAPI.trackDocumentInteraction(doc.id, uid, 'download').catch(() => {});
  };

  const handleOpenDoc = (doc: any) => {
    const uid = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.trackDocumentInteraction(doc.id, uid, 'view').catch(() => {});
    const fileName = doc.file_name || doc.title || 'Document';
    const isImage = doc.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName);
    if (setActivePreviewItem) {
      setActivePreviewItem({
        id: doc.id,
        name: fileName,
        size: doc.file_size || 0,
        type: doc.file_type || (isImage ? 'image/jpeg' : 'application/pdf'),
        url: doc.file_url || '',
        isImage,
        folderName: doc.school || doc.matiere_name || doc.category || 'Ressources',
        lockFullscreen: true,
      });
    }
  };

  useEffect(() => {
    const handleDocumentClick = () => setActiveCategoryTooltipId(null);
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // ---- Published Documents (onglet Ressources avec Recommandation Personnalisée & Défilement Infini) ----
  const [publishedDocs, setPublishedDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingMoreDocs, setIsLoadingMoreDocs] = useState(false);
  const [docsPage, setDocsPage] = useState(1);
  const [hasMoreDocs, setHasMoreDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const infiniteSentinelRef = useRef<HTMLDivElement>(null);
  const docSeedRef = useRef<string>(Date.now().toString(36));

  const loadPublishedDocs = useCallback(async (newSeed?: string) => {
    setIsLoadingDocs(true);
    setDocsError(null);
    setDocsPage(1);
    const activeSeed = newSeed || docSeedRef.current || Date.now().toString(36);
    if (newSeed) {
      docSeedRef.current = newSeed;
    }
    try {
      const currentUserId = localStorage.getItem('unifolder_user_id') || undefined;
      const filters: any = {
        page: 1,
        limit: 8, // Chargement par paquet de 8 pour un défilement infini progressif
        isPublic: true,
        seed: activeSeed,
      };
      if (currentUserId) filters.userId = currentUserId;
      if (selectedSchoolFilter) filters.school = selectedSchoolFilter;
      if (selectedFiliereFilter) filters.filiere = selectedFiliereFilter;
      if (selectedMatiereFilter) filters.matiereName = selectedMatiereFilter;
      if (isRecentFilterActive) filters.sort = 'recent';
      if (selectedCategory !== 'Tous') filters.category = selectedCategory;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const res = await StudyCloudAPI.getPublishedDocuments(filters);
      setPublishedDocs(res.data || []);
      setHasMoreDocs(Boolean(res.pagination?.hasMore));
    } catch (err: any) {
      setDocsError(err.message || 'Erreur de chargement');
      setPublishedDocs([]);
      setHasMoreDocs(false);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [selectedSchoolFilter, selectedFiliereFilter, selectedMatiereFilter, isRecentFilterActive, selectedCategory, searchQuery]);

  const loadMorePublishedDocs = useCallback(async () => {
    if (isLoadingDocs || isLoadingMoreDocs || !hasMoreDocs) return;
    setIsLoadingMoreDocs(true);
    const nextPage = docsPage + 1;
    try {
      const currentUserId = localStorage.getItem('unifolder_user_id') || undefined;
      const filters: any = {
        page: nextPage,
        limit: 8,
        isPublic: true,
        seed: docSeedRef.current,
      };
      if (currentUserId) filters.userId = currentUserId;
      if (selectedSchoolFilter) filters.school = selectedSchoolFilter;
      if (selectedFiliereFilter) filters.filiere = selectedFiliereFilter;
      if (selectedMatiereFilter) filters.matiereName = selectedMatiereFilter;
      if (isRecentFilterActive) filters.sort = 'recent';
      if (selectedCategory !== 'Tous') filters.category = selectedCategory;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const res = await StudyCloudAPI.getPublishedDocuments(filters);
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        setPublishedDocs((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const newItems = res.data.filter((d) => !existingIds.has(d.id));
          return [...prev, ...newItems];
        });
        setDocsPage(nextPage);
        setHasMoreDocs(Boolean(res.pagination?.hasMore));
      } else {
        setHasMoreDocs(false);
      }
    } catch (err) {
      console.warn('Erreur chargement page suivante ressources:', err);
    } finally {
      setIsLoadingMoreDocs(false);
    }
  }, [docsPage, hasMoreDocs, isLoadingDocs, isLoadingMoreDocs, selectedSchoolFilter, selectedFiliereFilter, selectedMatiereFilter, isRecentFilterActive, selectedCategory, searchQuery]);

  // Écouter le signal de publication temps réel pour recharger immédiatement
  useEffect(() => {
    const handleLiveRefresh = () => {
      setActiveSubTab('ressources');
      localStorage.setItem('studycloud_library_subtab', 'ressources');
      loadPublishedDocs();
    };
    window.addEventListener('studycloud_refresh_published_docs', handleLiveRefresh);
    return () => window.removeEventListener('studycloud_refresh_published_docs', handleLiveRefresh);
  }, [loadPublishedDocs]);

  // Observer pour défilement infini automatique via IntersectionObserver
  useEffect(() => {
    if (!infiniteSentinelRef.current || !hasMoreDocs || isLoadingMoreDocs || isLoadingDocs) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePublishedDocs();
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );
    observer.observe(infiniteSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreDocs, isLoadingMoreDocs, isLoadingDocs, loadMorePublishedDocs]);

  // Défilement infini continu basé sur l'événement scroll (support mobile et conteneur #root)
  useEffect(() => {
    if (!hasMoreDocs || isLoadingMoreDocs || isLoadingDocs) return;

    let timeoutId: any = null;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        const rootEl = document.getElementById('root');
        const scrollTop = window.scrollY || document.documentElement.scrollTop || rootEl?.scrollTop || 0;
        const scrollHeight = document.documentElement.scrollHeight || rootEl?.scrollHeight || 0;
        const clientHeight = window.innerHeight || rootEl?.clientHeight || 0;

        if (scrollHeight - (scrollTop + clientHeight) < 450) {
          loadMorePublishedDocs();
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const rootEl = document.getElementById('root');
    rootEl?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      rootEl?.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasMoreDocs, isLoadingMoreDocs, isLoadingDocs, loadMorePublishedDocs]);


  useEffect(() => {
    if (activeSubTab === 'ressources') {
      loadPublishedDocs();
    }
  }, [activeSubTab, loadPublishedDocs]);

  // ---- Liens publics partagés de la communauté (onglet Liens publics) ----
  const [remotePublicFolders, setRemotePublicFolders] = useState<SharedFolder[]>([]);
  const [isLoadingPublicFolders, setIsLoadingPublicFolders] = useState(false);

  const loadPublicFolders = useCallback(async () => {
    setIsLoadingPublicFolders(true);
    try {
      const res = await StudyCloudAPI.getShares(undefined, true);
      if (res.success && Array.isArray(res.data)) {
        const mapped: SharedFolder[] = res.data.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description || '',
          category: row.category || "Pas d'informations",
          author: row.author_name || 'Étudiant',
          school: row.school || '',
          country: row.country || "Côte d'Ivoire",
          createdAt: row.created_at || new Date().toISOString(),
          files: Array.isArray(row.files)
            ? row.files.map((f: any) => ({
                id: f.id || f.file_id || crypto.randomUUID(),
                name: f.name,
                size: f.size || 0,
                type: f.type || 'file',
                url: f.file_url || f.url || '',
              }))
            : [],
          totalSize: row.total_size || 0,
          downloadsCount: row.downloads_count || 0,
          isPasswordProtected: Boolean(row.is_password_protected),
          password: row.password_hash || undefined,
          viewsCount: row.views_count || 0,
          shareCode: row.share_code,
          shareUrl: row.share_url,
          qrCodeData: row.qr_code_data,
          isPublic: Boolean(row.is_public),
          allowDownload: Boolean(row.allow_download),
        }));
        setRemotePublicFolders(mapped);
      }
    } catch (e) {
      console.warn('Erreur chargement liens publics D1:', e);
    } finally {
      setIsLoadingPublicFolders(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'liens') {
      loadPublicFolders();
    }
  }, [activeSubTab, loadPublicFolders]);

  // Products state for Librairie tab
  const [productsList, setProductsList] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_published_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_PRODUCTS;
  });

  const [selectedDetailProduct, setSelectedDetailProduct] = useState<ProductItem | null>(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Cart state
  const [cartItemIds, setCartItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_cart');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [isCartViewOpen, setIsCartViewOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('unifolder_cart', JSON.stringify(cartItemIds));
    } catch (e) {}
  }, [cartItemIds]);

  const toggleCartItem = (productId: string, productTitle: string) => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    if (cartItemIds.includes(productId)) {
      setCartItemIds(prev => prev.filter(id => id !== productId));
      triggerToast(`"${productTitle}" retiré du panier`);
      StudyCloudAPI.removeFromCart(userId, productId).catch(() => {});
    } else {
      setCartItemIds(prev => [...prev, productId]);
      triggerToast(`"${productTitle}" ajouté au panier !`);
      StudyCloudAPI.addToCart(userId, productId, 1).catch(() => {});
    }
  };

  const cartProducts = productsList.filter(item => cartItemIds.includes(item.id));

  // Store info state
  const [shopName, setShopName] = useState(() => localStorage.getItem('unifolder_shop_name') || 'DKD Technologies');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('unifolder_shop_phone') || '+225 07 00 00 00 00');
  const [shopAvatarUrl, setShopAvatarUrl] = useState(() => localStorage.getItem('unifolder_shop_avatar') || '');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const [followedSellerIds, setFollowedSellerIds] = useState<string[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState(false);
  const infiniteProductsSentinelRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleOrderProduct = async (product: { id: string; title: string }) => {
    triggerToast("Ouverture de la discussion WhatsApp...");
    try {
      const res = await StudyCloudAPI.orderProductViaWhatsApp(product.id);
      if (res.success && res.whatsappUrl) {
        const uId = localStorage.getItem('unifolder_user_id') || 'anonymous';
        StudyCloudAPI.trackProductInteraction(uId, product.id, 'order').catch(() => {});
        window.open(res.whatsappUrl, '_blank');
      } else {
        triggerToast("Le vendeur n'a pas encore configuré son numéro WhatsApp.");
      }
    } catch (e) {
      console.warn("Erreur commande WhatsApp:", e);
      triggerToast("Erreur lors de la prise de contact WhatsApp.");
    }
  };

  const mapRowToProduct = useCallback((row: any): ProductItem => ({
    id: String(row.id),
    sellerId: row.seller_id,
    seller_id: row.seller_id,
    sellerName: row.seller_name || 'Étudiant',
    seller_name: row.seller_name || 'Étudiant',
    sellerSchool: row.seller_school || '',
    seller_school: row.seller_school || '',
    sellerFiliere: row.seller_filiere || '',
    seller_filiere: row.seller_filiere || '',
    sellerCountry: row.seller_country || "Côte d'Ivoire",
    seller_country: row.seller_country || "Côte d'Ivoire",
    sellerPhone: row.seller_phone || '',
    seller_phone: row.seller_phone || '',
    sellerWhatsapp: row.seller_whatsapp || '',
    seller_whatsapp: row.seller_whatsapp || '',
    sellerAvatarUrl: row.seller_avatar_url || '',
    seller_avatar_url: row.seller_avatar_url || '',
    title: row.title,
    description: row.description || '',
    price: row.price || '0 FCFA',
    currency: row.currency || 'FCFA',
    category: row.category || 'Vente digital (PDF)',
    date: row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : '01/09/2026',
    views: row.views || 0,
    sales: row.sales || 0,
    imageUrl: row.image_urls_json ? (JSON.parse(row.image_urls_json)[0] || undefined) : undefined,
    imageUrls: row.image_urls_json ? JSON.parse(row.image_urls_json) : [],
    isBoosted: Boolean(row.is_boosted),
    is_boosted: Boolean(row.is_boosted),
    boostStatus: row.is_boosted ? 'active' : undefined,
    boostFormula: row.boost_formula || undefined,
    boostViewsTarget: row.boost_views_target || undefined,
    boostViewsCurrent: row.views || 0,
    boostEndDate: row.boost_end_date || undefined,
    _relevance_score: row._relevance_score,
  }), []);

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setProductsPage(1);
    try {
      const currentUserId = localStorage.getItem('unifolder_user_id') || undefined;
      const res = await StudyCloudAPI.getProducts({
        userId: currentUserId,
        category: selectedCategory !== 'Tous' ? selectedCategory : undefined,
        search: searchQuery.trim() || undefined,
        page: 1,
        limit: 24,
      });
      if (res && res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(mapRowToProduct);
        setProductsList(mapped);
        setHasMoreProducts(Boolean(res.pagination?.hasMore));
        try {
          localStorage.setItem('unifolder_published_products', JSON.stringify(mapped));
        } catch (e) {}

        // Détection d'un produit spécifique depuis l'URL (?product=123)
        try {
          const targetProductId = new URLSearchParams(window.location.search).get('product');
          if (targetProductId) {
            setActiveSubTab('librairie');
            const found = mapped.find((p: ProductItem) => p.id === targetProductId);
            if (found) {
              setSelectedDetailProduct(found);
              setActiveDetailImageIndex(0);
            } else {
              StudyCloudAPI.getProducts({ search: targetProductId, limit: 1 }).then(r => {
                if (r.success && r.data && r.data[0]) {
                  setSelectedDetailProduct(mapRowToProduct(r.data[0]));
                  setActiveDetailImageIndex(0);
                }
              }).catch(() => {});
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Erreur chargement produits librairie:', e);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [selectedCategory, searchQuery, mapRowToProduct]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoadingProducts || isLoadingMoreProducts || !hasMoreProducts) return;
    setIsLoadingMoreProducts(true);
    const nextPage = productsPage + 1;
    try {
      const currentUserId = localStorage.getItem('unifolder_user_id') || undefined;
      const res = await StudyCloudAPI.getProducts({
        userId: currentUserId,
        category: selectedCategory !== 'Tous' ? selectedCategory : undefined,
        search: searchQuery.trim() || undefined,
        page: nextPage,
        limit: 24,
      });
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map(mapRowToProduct);
        setProductsList((prev: ProductItem[]) => {
          const existingIds = new Set(prev.map((p: ProductItem) => p.id));
          const newItems = mapped.filter((p: ProductItem) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
        setProductsPage(nextPage);
        setHasMoreProducts(Boolean(res.pagination?.hasMore));
      } else {
        setHasMoreProducts(false);
      }
    } catch (e) {
      console.warn('Erreur défilement infini produits:', e);
    } finally {
      setIsLoadingMoreProducts(false);
    }
  }, [isLoadingProducts, isLoadingMoreProducts, hasMoreProducts, productsPage, selectedCategory, searchQuery, mapRowToProduct]);

  // Observer pour défilement infini automatique des produits
  useEffect(() => {
    if (!infiniteProductsSentinelRef.current || !hasMoreProducts || isLoadingMoreProducts || isLoadingProducts) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1, rootMargin: '250px' }
    );
    observer.observe(infiniteProductsSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreProducts, isLoadingMoreProducts, isLoadingProducts, loadMoreProducts]);

  useEffect(() => {
    if (activeSubTab === 'librairie') {
      loadProducts();
    }
  }, [activeSubTab, loadProducts]);

  // Charger les abonnements vendeurs et le panier
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    
    // Abonnements vendeurs
    StudyCloudAPI.getSellerFollows(userId)
      .then(res => {
        if (res.success && Array.isArray(res.followedSellerIds)) {
          setFollowedSellerIds(res.followedSellerIds);
        }
      })
      .catch(() => {});

    // Charger le panier depuis D1
    StudyCloudAPI.getCart(userId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const ids = res.data.map((item: any) => String(item.product_id || item.id));
          setCartItemIds(ids);
          localStorage.setItem('unifolder_cart', JSON.stringify(ids));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('unifolder_published_products');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setProductsList(parsed);
        }
        const name = localStorage.getItem('unifolder_shop_name');
        if (name) setShopName(name);
        const phone = localStorage.getItem('unifolder_shop_phone');
        if (phone) setShopPhone(phone);
        const avatar = localStorage.getItem('unifolder_shop_avatar');
        if (avatar !== null) setShopAvatarUrl(avatar);
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // État de rafraîchissement global pour le sous-menu actif
  const isGlobalRefreshing = (activeSubTab === 'ressources' && isLoadingDocs) ||
                             (activeSubTab === 'librairie' && isLoadingProducts) ||
                             (activeSubTab === 'liens' && isLoadingPublicFolders);

  // Fonction d'actualisation globale selon le sous-menu actif
  const handleGlobalRefresh = useCallback(async () => {
    if (activeSubTab === 'ressources') {
      // Générer une nouvelle graine de rotation pour que l'algorithme propose d'autres fichiers adaptés
      const freshSeed = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      await loadPublishedDocs(freshSeed);
      // Actualiser également les filtres écoles et matières
      StudyCloudAPI.getPublishedDocumentFilters().then(res => {
        if (res && res.success) {
          if (Array.isArray(res.schools)) setAvailableSchools(res.schools);
          if (Array.isArray(res.matieres)) setAvailableMatieres(res.matieres);
        }
      }).catch(() => {});
    } else if (activeSubTab === 'librairie') {
      await loadProducts();
    } else if (activeSubTab === 'liens') {
      await loadPublicFolders();
    }
  }, [activeSubTab, loadPublishedDocs, loadProducts, loadPublicFolders]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const [pendingDestinationFolder, setPendingDestinationFolder] = useState<SharedFolder | null>(null);

  const handleDownloadFolder = (folder: SharedFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!folder.files || folder.files.length === 0) {
      triggerToast("Ce dossier ne contient aucun fichier.");
      return;
    }
    setPendingDestinationFolder(folder);
  };

  const handleConfirmDestination = (choice: DownloadDestinationChoice) => {
    if (!pendingDestinationFolder) return;
    const folder = pendingDestinationFolder;

    if (choice === 'device' || choice === 'both') {
      folder.files.forEach((file, index) => {
        setTimeout(() => {
          handleDownloadSingle(file, folder.title);
        }, index * 250);
      });
      StudyCloudAPI.trackShareDownload(folder.id).catch(() => {});
      folder.downloadsCount = (folder.downloadsCount || 0) + 1;
      setRemotePublicFolders(prev => prev.map(f => f.id === folder.id ? { ...f, downloadsCount: (f.downloadsCount || 0) + 1 } : f));
    }

    if (choice === 'studycloud' || choice === 'both') {
      importFilesToMesFichiers(folder.files.map(f => ({
        name: f.name,
        size: f.size,
        url: f.url,
        type: f.type,
      })));
      StudyCloudAPI.trackShareDownload(folder.id).catch(() => {});
      folder.downloadsCount = (folder.downloadsCount || 0) + 1;
      setRemotePublicFolders(prev => prev.map(f => f.id === folder.id ? { ...f, downloadsCount: (f.downloadsCount || 0) + 1 } : f));
    }

    if (choice === 'device') {
      triggerToast(`Téléchargement de "${folder.title}" sur cet appareil lancé !`);
    } else if (choice === 'studycloud') {
      triggerToast(`${folder.files.length} fichiers enregistrés dans votre espace StudyCloud (Mes Fichiers) !`);
    } else {
      triggerToast(`Fichiers téléchargés sur l'appareil ET enregistrés dans StudyCloud (Mes Fichiers) !`);
    }

    setPendingDestinationFolder(null);
  };

  const handleCopyLink = (folder: SharedFolder) => {
    const workerBase = getWorkerApiUrl().replace(/\/+$/, '');
    const url = `${workerBase}/s/${folder.shareCode || folder.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(folder.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }).catch(() => {
      alert("Lien copié dans le presse-papier !");
    });
  };

  const handleDownloadSingle = (file: SharedFile, folderTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const content = file.url || `Ceci est le fichier ${file.name} téléchargé depuis UniFolder Share.\nDossier: ${folderTitle}`;
    const blob = file.url && file.url.startsWith('data:') 
      ? fetch(file.url).then(r => r.blob()).catch(() => new Blob([content], { type: 'text/plain;charset=utf-8' }))
      : Promise.resolve(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    
    blob.then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };
  const allFilesWithFolder: { file: SharedFile; folder: SharedFolder }[] = [];
  folders.forEach((folder) => {
    folder.files.forEach((file) => {
      allFilesWithFolder.push({ file, folder });
    });
  });

  const categories = ['Tous', 'Cours', 'TD/TP', 'Examens', 'Projets', 'Notes'];

  const filteredItems = allFilesWithFolder.filter(({ file, folder }) => {
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      folder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (folder.category && folder.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (folder.school && folder.school.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'Tous' || folder.category === selectedCategory;

    const matchesSchool = !selectedSchoolFilter || (
      folder.school && (
        folder.school.toLowerCase().includes(selectedSchoolFilter.toLowerCase()) ||
        selectedSchoolFilter.toLowerCase().includes(folder.school.toLowerCase())
      )
    );

    const matchesFiliere = !selectedFiliereFilter || (
      folder.category && (
        folder.category.toLowerCase().includes(selectedFiliereFilter.toLowerCase()) ||
        selectedFiliereFilter.toLowerCase().includes(folder.category.toLowerCase())
      )
    );

    return matchesSearch && matchesCategory && matchesSchool && matchesFiliere;
  });

  const getFileBadgeInfo = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return { label: 'PDF', bg: 'bg-red-600', text: 'text-white' };
    } else if (['doc', 'docx'].includes(ext)) {
      return { label: 'W', bg: 'bg-blue-600', text: 'text-white' };
    } else if (['xls', 'xlsx'].includes(ext)) {
      return { label: 'X', bg: 'bg-emerald-600', text: 'text-white' };
    } else if (['ppt', 'pptx'].includes(ext)) {
      return { label: 'P', bg: 'bg-orange-600', text: 'text-white' };
    } else if (['txt', 'md'].includes(ext)) {
      return { label: 'T', bg: 'bg-slate-600', text: 'text-white' };
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return { label: 'IMG', bg: 'bg-purple-600', text: 'text-white' };
    } else {
      return { label: ext.toUpperCase() || 'FILE', bg: 'bg-stone-700', text: 'text-white' };
    }
  };

  return (
    <div className="flex flex-col space-y-4 pb-24 pt-24 md:pt-26 animate-fadeIn w-full px-2 sm:px-4">
      {/* Fixed Header Container enclosing search bar and 3 fixed compact buttons - Solid Dark #070a13 */}
      <div className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-[#FDFBF7] dark:bg-[#070a13] border-b-2 border-stone-800 dark:border-[#1e293b] shadow-sm px-3 sm:px-6 pt-2.5 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
          {/* Expanded Search input */}
          <div className="relative flex-1 min-w-[120px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeSubTab === 'librairie'
                  ? "Rechercher un livre, cours, produit..."
                  : activeSubTab === 'ressources'
                  ? "Rechercher un fichier ou dossier..."
                  : "Rechercher un lien public ou dossier..."
              }
              className="w-full bg-white dark:bg-[#111a2e] dark:border-[#334155] dark:text-white dark:placeholder-slate-400 border-2 border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all"
            />
          </div>

          {/* Top Right Cart Button for 'librairie' tab */}
          {activeSubTab === 'librairie' && (
            <button
              type="button"
              onClick={() => setIsCartViewOpen(!isCartViewOpen)}
              className={`px-3 py-1.5 font-extrabold text-xs rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isCartViewOpen ? 'bg-amber-400 text-stone-900' : 'bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white'
              }`}
              title="Voir mon panier"
            >
              <ShoppingCart className="w-4 h-4 text-stone-900 dark:text-white" />
              <span className="hidden sm:inline font-extrabold">Panier</span>
            </button>
          )}

          {/* Right side buttons (Matières, Schools & Menu): Render ONLY in 'ressources' tab */}
          {activeSubTab === 'ressources' && (
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Matière Button */}
              <button
                onClick={() => setShowMatiereModal(true)}
                className={`px-2.5 py-1.5 font-extrabold text-xs rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                  selectedMatiereFilter
                    ? 'bg-blue-600 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                    : 'bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917]'
                }`}
                title="Filtrer par matière"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Matières</span>
              </button>

              {/* Schools Button */}
              <button
                onClick={() => setShowSchoolsModal(true)}
                className={`px-2.5 py-1.5 font-extrabold text-xs rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                  selectedSchoolFilter
                    ? 'bg-orange-500 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                    : 'bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917]'
                }`}
                title="Filtrer par école"
              >
                <Building2 className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span className="hidden sm:inline">Écoles</span>
              </button>

              {/* Three-line Menu Button at the very right */}
              <button
                onClick={() => setShowMenuModal(true)}
                className="p-2 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
                title="Options du menu"
              >
                <Menu className="w-4 h-4 text-stone-800 dark:text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs (Librairie, Ressources, Liens publics) + Bouton Actualiser Déplacé en Haut à Droite (Tracé rouge) */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full pt-0.5">
          {/* Espaceur invisible à gauche pour équilibrer le centrage sur grand écran */}
          <div className="w-8 sm:w-24 hidden md:block shrink-0" />

          {/* 3 Onglets Centrés */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 flex-1">
            <button
              type="button"
              onClick={() => { setActiveSubTab('librairie'); setIsRecentFilterActive(false); }}
              className={`flex-1 max-w-[135px] justify-center px-2 sm:px-3 py-1 text-xs font-extrabold rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                activeSubTab === 'librairie'
                  ? 'bg-amber-400 text-stone-900 border-stone-800 dark:border-amber-400/40 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : 'bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-200 border-stone-800 dark:border-[#334155]'
              }`}
            >
              <span>📚</span>
              <span>Librairie</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSubTab('ressources'); setIsCartViewOpen(false); }}
              className={`flex-1 max-w-[135px] justify-center px-2 sm:px-3 py-1 text-xs font-extrabold rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                activeSubTab === 'ressources'
                  ? 'bg-orange-500 text-white border-stone-800 dark:border-orange-400/40 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                  : 'bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-200 border-stone-800 dark:border-[#334155]'
              }`}
            >
              <span>📁</span>
              <span>Ressources</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSubTab('liens'); setIsCartViewOpen(false); setIsRecentFilterActive(false); }}
              className={`flex-1 max-w-[135px] justify-center px-2 sm:px-3 py-1 text-xs font-extrabold rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                activeSubTab === 'liens'
                  ? 'bg-blue-600 text-white border-stone-800 dark:border-blue-400/40 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                  : 'bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-200 border-stone-800 dark:border-[#334155]'
              }`}
            >
              <span>🔗</span>
              <span className="truncate">Liens publics</span>
            </button>
          </div>

          {/* Bouton Actualiser Global Déplacé en Haut à Droite (Tracé rouge utilisateur) */}
          <button
            type="button"
            onClick={handleGlobalRefresh}
            disabled={isGlobalRefreshing}
            title={
              activeSubTab === 'ressources'
                ? "Actualiser et découvrir d'autres recommandations adaptées"
                : activeSubTab === 'librairie'
                ? "Actualiser la librairie"
                : "Actualiser les liens publics"
            }
            className="px-2 sm:px-2.5 py-1 text-xs font-extrabold rounded-xl border-2 border-stone-800 dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-800 dark:text-white shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-500 dark:text-orange-400 ${isGlobalRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline font-bold">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Matières Side Menu Modal (Données réelles de la base D1) */}
      {showMatiereModal && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowMatiereModal(false)}>
          <div className="absolute top-16 right-4 sm:right-28 bg-[#2A2A2A] text-white border-2 border-stone-700 rounded-2xl py-2 w-72 max-h-[80vh] flex flex-col shadow-[0px_10px_30px_rgba(0,0,0,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2.5 border-b border-stone-700 mb-1 flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Matières des publications
              </span>
              <button onClick={() => setShowMatiereModal(false)} className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>

            {/* Champ de recherche pour les matières */}
            <div className="px-3 py-2 border-b border-stone-800 shrink-0">
              <input
                type="text"
                placeholder="Rechercher une matière..."
                value={matiereSearchQuery}
                onChange={(e) => setMatiereSearchQuery(e.target.value)}
                className="w-full bg-stone-800 text-stone-200 text-[11px] px-3 py-1.5 rounded-lg border border-stone-600 focus:outline-none focus:border-blue-500 placeholder-stone-500"
              />
            </div>
            
            {/* Si un filtre matière est actif, option pour réinitialiser */}
            {selectedMatiereFilter && (
              <div className="px-3 py-1.5 border-b border-stone-800 shrink-0">
                <button
                  type="button"
                  onClick={() => { setSelectedMatiereFilter(null); setShowMatiereModal(false); }}
                  className="w-full text-center py-1 text-[11px] font-bold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-600 transition-colors cursor-pointer"
                >
                  ✕ Effacer le filtre matière
                </button>
              </div>
            )}

            <div className="flex flex-col overflow-y-auto max-h-[60vh] divide-y divide-stone-800">
              {availableMatieres.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400">
                  Aucune matière trouvée dans les publications.
                </div>
              ) : (
                availableMatieres.filter(m => m.toLowerCase().includes(matiereSearchQuery.toLowerCase())).length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-stone-400">
                    Aucune matière ne correspond à votre recherche.
                  </div>
                ) : (
                  availableMatieres
                    .filter(m => m.toLowerCase().includes(matiereSearchQuery.toLowerCase()))
                    .map((mat) => (
                      <button 
                    key={mat}
                    onClick={() => {
                      setSelectedMatiereFilter(prev => prev === mat ? null : mat);
                      setIsRecentFilterActive(false);
                      setShowMatiereModal(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      selectedMatiereFilter === mat ? 'text-blue-400 font-bold bg-stone-700/40' : 'text-stone-200'
                    }`}
                  >
                    <span className="truncate pr-2">📖 {mat}</span>
                    {selectedMatiereFilter === mat && <span className="text-[10px] text-blue-400 font-bold shrink-0">Actif</span>}
                  </button>
                ))
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schools Side Menu Modal (Données réelles de la base D1) */}
      {showSchoolsModal && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowSchoolsModal(false)}>
          <div className="absolute top-16 right-4 sm:right-16 bg-[#2A2A2A] text-white border-2 border-stone-700 rounded-2xl py-2 w-72 max-h-[80vh] flex flex-col shadow-[0px_10px_30px_rgba(0,0,0,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2.5 border-b border-stone-700 mb-1 flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Écoles des étudiants & docs
              </span>
              <button onClick={() => setShowSchoolsModal(false)} className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>

            {/* Champ de recherche pour les écoles */}
            <div className="px-3 py-2 border-b border-stone-800 shrink-0">
              <input
                type="text"
                placeholder="Rechercher une école..."
                value={schoolSearchQuery}
                onChange={(e) => setSchoolSearchQuery(e.target.value)}
                className="w-full bg-stone-800 text-stone-200 text-[11px] px-3 py-1.5 rounded-lg border border-stone-600 focus:outline-none focus:border-orange-500 placeholder-stone-500"
              />
            </div>
            {/* Si un filtre école est actif, option pour réinitialiser */}
            {selectedSchoolFilter && (
              <div className="px-3 py-1.5 border-b border-stone-800 shrink-0">
                <button
                  type="button"
                  onClick={() => { setSelectedSchoolFilter(null); setShowSchoolsModal(false); }}
                  className="w-full text-center py-1 text-[11px] font-bold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-600 transition-colors cursor-pointer"
                >
                  ✕ Effacer le filtre école
                </button>
              </div>
            )}

            <div className="flex flex-col overflow-y-auto max-h-[60vh] divide-y divide-stone-800">
              {availableSchools.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400">
                  Aucune école trouvée pour le moment.
                </div>
              ) : (
                availableSchools.filter(s => s.toLowerCase().includes(schoolSearchQuery.toLowerCase())).length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-stone-400">
                    Aucune école ne correspond à votre recherche.
                  </div>
                ) : (
                  availableSchools
                    .filter(s => s.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
                    .map((sc) => (
                      <button 
                    key={sc}
                    onClick={() => {
                      setSelectedSchoolFilter(prev => prev === sc ? null : sc);
                      setIsRecentFilterActive(false);
                      setShowSchoolsModal(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      selectedSchoolFilter === sc ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                    }`}
                  >
                    <span className="truncate pr-2">🏛️ {sc}</span>
                    {selectedSchoolFilter === sc && <span className="text-[10px] text-orange-400 font-bold shrink-0">Actif</span>}
                  </button>
                ))
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Three-line Menu Side Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowMenuModal(false)}>
          <div className="absolute top-16 right-3 md:right-8 bg-[#2A2A2A] text-white border-2 border-stone-700 rounded-2xl py-2 w-64 md:w-80 shadow-[0px_10px_30px_rgba(0,0,0,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 md:px-5 py-3 md:py-4 border-b border-stone-700 mb-1 flex items-center justify-between">
              <span className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-orange-400">Options du menu</span>
              <button onClick={() => setShowMenuModal(false)} className="text-stone-400 hover:text-white text-xs md:text-sm font-bold cursor-pointer">✕</button>
            </div>
            <div className="flex flex-col">
              {/* Bouton Œil : bascule mode aperçu (image 2) vs mode compact actuel */}
              <button 
                onClick={() => {
                  setResourceViewMode(prev => prev === 'preview' ? 'compact' : 'preview');
                  setShowMenuModal(false);
                }}
                className="w-full text-left px-4 md:px-5 py-3 md:py-4 hover:bg-stone-700/60 text-xs md:text-sm font-semibold text-stone-200 transition-colors border-b border-stone-800 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base md:text-lg">👁️</span>
                  <span>{resourceViewMode === 'preview' ? 'Mode compact (cartes sans aperçu)' : "Voir l'aperçu des fichiers"}</span>
                </div>
                {resourceViewMode === 'preview' && (
                  <span className="text-[10px] text-orange-400 font-bold bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800 shrink-0">
                    Aperçu actif
                  </span>
                )}
              </button>

              {/* Bouton Récent : tri du plus récent au plus ancien */}
              <button 
                onClick={() => {
                  setIsRecentFilterActive(true);
                  setSelectedSchoolFilter(null);
                  setSelectedFiliereFilter(null);
                  setSelectedMatiereFilter(null);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowMenuModal(false);
                }}
                className={`w-full text-left px-4 md:px-5 py-3 md:py-4 hover:bg-stone-700/60 text-xs md:text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                  isRecentFilterActive ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base md:text-lg">📚</span>
                  <span>Tous les fichiers récents</span>
                </div>
                {isRecentFilterActive && (
                  <span className="text-[10px] text-orange-400 font-bold bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800 shrink-0">
                    Actif
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Scrollable Area */}
      <div className="w-full">
        {/* ONGLET LIBRAIRIE */}
        {activeSubTab === 'librairie' && (
          <div className="space-y-4">
            {/* Si le panier est ouvert, afficher la vue du panier avec le bouton Retour 3D et le titre centré */}
            {isCartViewOpen ? (
              <div className="space-y-4">
                {/* Header connecté avec bouton Retour 3D Pilule et Titre Mon Panier centré */}
                <div className="sticky top-[92px] z-30 bg-[#FDFBF7]/95 backdrop-blur-sm -mt-2 pt-1 pb-2 mb-2 flex items-center justify-between gap-2 border-b border-stone-200/80">
                  {/* 3D Pill 'Retour' Button */}
                  <button
                    type="button"
                    onClick={() => setIsCartViewOpen(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-900 rounded-full border-2 border-stone-800 shadow-[2.5px_2.5px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center gap-2 shrink-0 active:translate-x-0.5 active:translate-y-0.5"
                    title="Retour à la librairie"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5] text-stone-900" />
                    <span className="font-black text-xs sm:text-sm text-stone-900 tracking-tight">Retour</span>
                  </button>

                  {/* Centered Cart Title */}
                  <div className="flex-1 flex items-center justify-center gap-2 font-black text-xs sm:text-sm md:text-base text-stone-900 text-center px-1 truncate">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
                    <span className="truncate">Mon Panier ({cartProducts.length})</span>
                  </div>

                  {/* Invisible spacer to maintain centered title */}
                  <div className="w-[88px] sm:w-[98px] shrink-0 pointer-events-none" aria-hidden="true" />
                </div>

                {cartProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-700 dark:text-amber-400 mx-auto mb-3">
                      <ShoppingCart className="w-7 h-7 stroke-[1.8]" />
                    </div>
                    <h3 className="text-base font-extrabold text-stone-900 dark:text-white">Votre panier est vide</h3>
                    <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm">Parcourez les produits de la librairie pour ajouter des articles à votre panier !</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                    {cartProducts.map((item) => {
                      const displayImages = item.imageUrls && item.imageUrls.length > 0
                        ? item.imageUrls
                        : (item.imageUrl ? [item.imageUrl] : []);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedDetailProduct(item);
                            setActiveDetailImageIndex(0);
                            setIsDescriptionExpanded(false);
                          }}
                          className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                        >
                          <div>
                            {/* Top Image Box */}
                            <div className="w-full h-36 sm:h-44 bg-stone-100/80 relative overflow-hidden flex items-center justify-center p-3">
                              {displayImages.length > 0 ? (
                                <img
                                  src={displayImages[0]}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300">
                                  <Package className="w-12 h-12 stroke-[1.5]" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="p-3 sm:p-3.5 space-y-1">
                              <h4 className="font-extrabold text-xs sm:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] sm:text-xs text-stone-500 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="p-3 sm:p-3.5 pt-0 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <div className="font-extrabold text-sm sm:text-base text-orange-600">
                                {item.price}
                              </div>

                              {/* Non-3D Cart button above Commander button (on the right) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCartItem(item.id, item.title);
                                }}
                                className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 hover:bg-amber-200"
                                title="Retirer du panier"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 text-amber-800 fill-amber-700" />
                                <span className="text-[11px]">Ajouté</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOrderProduct(item);
                              }}
                              className="w-full py-2 sm:py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
                            >
                              Commander
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Vue standard des produits */
              isLoadingProducts && productsList.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
                  <p className="text-xs font-bold text-stone-500">Sélection personnalisée selon votre profil...</p>
                </div>
              ) : productsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-700 dark:text-amber-400 mx-auto mb-3">
                    <Package className="w-7 h-7 stroke-[1.8]" />
                  </div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white">Aucun produit trouvé</h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm">Aucun produit ne correspond à votre recherche.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                    {productsList.map((item) => {
                      const displayImages = item.imageUrls && item.imageUrls.length > 0
                        ? item.imageUrls
                        : (item.imageUrl ? [item.imageUrl] : []);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedDetailProduct(item);
                            setActiveDetailImageIndex(0);
                            setIsDescriptionExpanded(false);
                            const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
                            StudyCloudAPI.trackProductInteraction(userId, item.id, 'view').catch(() => {});
                          }}
                          className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                        >
                          <div>
                            {/* Top Image Box */}
                            <div className="w-full h-36 sm:h-44 bg-stone-100/80 relative overflow-hidden flex items-center justify-center p-3">
                              {displayImages.length > 0 ? (
                                <img
                                  src={displayImages[0]}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300">
                                  <Package className="w-12 h-12 stroke-[1.5]" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="p-3 sm:p-3.5 space-y-1">
                              <h4 className="font-extrabold text-xs sm:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] sm:text-xs text-stone-500 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="p-3 sm:p-3.5 pt-0 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <div className="font-extrabold text-sm sm:text-base text-orange-600">
                                {item.price}
                              </div>

                              {/* Non-3D Cart button above Commander button (on the right) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCartItem(item.id, item.title);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                  cartItemIds.includes(item.id)
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold hover:bg-amber-200'
                                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                                title={cartItemIds.includes(item.id) ? "Retirer du panier" : "Ajouter au panier"}
                              >
                                <ShoppingCart className={`w-3.5 h-3.5 ${cartItemIds.includes(item.id) ? 'text-amber-800 fill-amber-700' : 'text-stone-700'}`} />
                                <span className="text-[11px]">
                                  {cartItemIds.includes(item.id) ? 'Ajouté' : 'Ajouter'}
                                </span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOrderProduct(item);
                              }}
                              className="w-full py-2 sm:py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
                            >
                              Commander
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sentinelle pour chargement continu & défilement infini des produits */}
                  <div ref={infiniteProductsSentinelRef} className="w-full py-4 flex items-center justify-center">
                    {isLoadingMoreProducts && (
                      <div className="flex items-center gap-2 text-stone-600 text-xs font-bold bg-white px-4 py-2 rounded-xl shadow-xs border border-stone-200">
                        <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                        <span>Chargement d'autres produits...</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ONGLET RESSOURCES (Actuel) */}
        {activeSubTab === 'ressources' && (
          <div className="space-y-3">
            {/* If a School, Matière, Filière or Recent Files filter is active, show sticky header connected to top navigation with centered title & 3D pill 'Retour' button */}
            {(selectedSchoolFilter || selectedMatiereFilter || selectedFiliereFilter || isRecentFilterActive) ? (
              <div className="sticky top-[92px] z-30 bg-[#FDFBF7]/95 backdrop-blur-sm -mt-2 pt-1 pb-2 mb-2 flex items-center justify-between gap-2 border-b border-stone-200/80">
                {/* 3D Pill 'Retour' Button matching user design */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchoolFilter(null);
                    setSelectedMatiereFilter(null);
                    setSelectedFiliereFilter(null);
                    setIsRecentFilterActive(false);
                  }}
                  className="px-3.5 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-900 rounded-full border-2 border-stone-800 shadow-[2.5px_2.5px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center gap-2 shrink-0 active:translate-x-0.5 active:translate-y-0.5"
                  title="Retour"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5] text-stone-900" />
                  <span className="font-black text-xs sm:text-sm text-stone-900 tracking-tight">Retour</span>
                </button>

                {/* Centered Title */}
                <div className="flex-1 flex items-center justify-center gap-2 font-black text-xs sm:text-sm md:text-base text-stone-900 text-center px-1 truncate">
                  {selectedSchoolFilter ? (
                    <>
                      <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 shrink-0" />
                      <span className="truncate">{selectedSchoolFilter}</span>
                    </>
                  ) : selectedMatiereFilter ? (
                    <>
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                      <span className="truncate">{selectedMatiereFilter}</span>
                    </>
                  ) : selectedFiliereFilter ? (
                    <>
                      <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                      <span className="truncate">{selectedFiliereFilter}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                      <span className="truncate">Tous les fichiers récents</span>
                    </>
                  )}
                </div>

                {/* Spacer on right to ensure mathematical centering of school title */}
                <div className="w-[88px] sm:w-[98px] shrink-0 pointer-events-none" aria-hidden="true" />
              </div>
            ) : (
              /* Filtre de recherche rapide par catégorie */
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-stone-900 text-white border-stone-900 shadow-[1px_1px_0px_0px_#1c1917]'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Compteur de documents publiés */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500 font-medium">
                {isLoadingDocs ? 'Chargement...' : `${publishedDocs.length} document${publishedDocs.length > 1 ? 's' : ''} publié${publishedDocs.length > 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Contenu : Documents Publiés */}
            {isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-stone-500 font-medium">Chargement des ressources...</p>
              </div>
            ) : docsError ? (
              <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 text-center">
                <p className="text-xs font-bold text-red-700">⚠️ {docsError}</p>
                <button onClick={loadPublishedDocs} className="mt-3 px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-red-700">Réessayer</button>
              </div>
            ) : publishedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 bg-orange-100 dark:bg-orange-950/40 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 mx-auto mb-3">
                  <FileText className="w-7 h-7 stroke-[1.8]" />
                </div>
                <h3 className="text-base font-extrabold text-stone-900 dark:text-white">Aucun document trouvé</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm">Essayez de modifier vos filtres ou publiez un document depuis vos fichiers.</p>
              </div>
            ) : resourceViewMode === 'preview' ? (
              /* MODE APERÇU (STYLE IMAGE 2 - ACTIVÉ PAR DÉFAUT) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5 w-full">
                {publishedDocs.map((doc) => {
                  const docSizeStr = (() => {
                    const bytes = doc.file_size || 0;
                    if (!bytes) return '—';
                    const k = 1024;
                    const sizes = ['o', 'Ko', 'Mo', 'Go'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                  })();

                  const typeInfo = getDocTypeInfo(doc);
                  const isFlipped = flippedCardIds.has(doc.id);
                  
                  const isSameName = (() => {
                    if (!doc.title || !doc.file_name) return false;
                    const t = doc.title.toLowerCase().trim();
                    const f = doc.file_name.toLowerCase().trim();
                    const fNoExt = f.includes('.') ? f.substring(0, f.lastIndexOf('.')) : f;
                    return t === f || t === fNoExt;
                  })();

                  // Si l'utilisateur a appuyé sur les 3 traits de cette carte spécifique :
                  // cette carte SEULE change pour afficher les informations détaillées avec le thème du type de fichier
                  if (isFlipped) {
                    return (
                      <div
                        key={doc.id}
                        style={typeInfo.cardBgStyle}
                        className={`aspect-[3/4] text-stone-100 ${typeInfo.cardBorderClass} rounded-2xl p-2.5 flex flex-col justify-between ${typeInfo.cardShadowClass} transition-all relative select-none overflow-hidden`}
                      >
                        {/* Header avec badge catégorie + badge type + bouton retour aperçu */}
                        <div className="flex items-center justify-between gap-1 border-b border-white/20 pb-1 mb-1">
                          <div className="flex items-center gap-1 max-w-[70%] truncate">
                            <span className="text-[8px] sm:text-[9px] font-black bg-white text-stone-900 border border-white px-1.5 py-0.5 rounded truncate shadow-sm">
                              {doc.category || "Pas d'informations"}
                            </span>
                            <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase border ${typeInfo.badgeClass}`}>
                              {typeInfo.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCardFlip(doc.id)}
                            className="px-1.5 py-0.5 bg-black hover:bg-stone-900 text-white text-[8.5px] font-bold rounded border border-black flex items-center gap-1 transition-colors cursor-pointer shadow-md"
                            title="Retourner vers l'aperçu"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Aperçu</span>
                          </button>
                        </div>

                        {/* Informations détaillées */}
                        <div className="flex-1 flex flex-col justify-around py-1 space-y-1 overflow-hidden">
                          <div className="flex flex-col">
                            {doc.file_name && (
                              <p className="text-[8.5px] sm:text-[9.5px] font-semibold text-white line-clamp-2 leading-tight mb-0.5 drop-shadow-sm" title={doc.file_name}>
                                {doc.file_name}
                              </p>
                            )}
                            {(!doc.file_name || !isSameName) && doc.title && (
                              <h3 
                                onClick={() => handleOpenDoc(doc)}
                                className="text-[10.5px] sm:text-[11.5px] font-black text-white line-clamp-2 leading-tight cursor-pointer hover:underline drop-shadow-md" 
                                title={doc.title}
                              >
                                {doc.title}
                              </h3>
                            )}
                          </div>

                          {doc.matiere_name && (
                            <p className="text-[8.5px] sm:text-[9.5px] text-white font-bold line-clamp-2 leading-tight drop-shadow-sm" title={doc.matiere_name}>
                              📚 {doc.matiere_name}{doc.level ? ` · ${doc.level}` : ''}
                            </p>
                          )}

                          <div className="flex items-center gap-1 text-[8.5px] sm:text-[9.5px] text-white font-semibold truncate drop-shadow-sm">
                            <Building2 className="w-3 h-3 text-white shrink-0" />
                            <span className="truncate">{doc.school && doc.school.trim() ? doc.school : 'École non renseignée'}</span>
                          </div>

                          <div className="flex items-center gap-1 text-[8px] sm:text-[8.5px] text-white font-medium truncate drop-shadow-sm">
                            {doc.country && <span className="flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{doc.country}</span>}
                            {doc.author_name && <span className="truncate">· {doc.author_name}</span>}
                          </div>

                          <div className="flex items-center justify-between text-[8px] sm:text-[8.5px] text-white font-semibold pt-1 border-t border-white/20">
                            <span className="drop-shadow-sm">{docSizeStr}</span>
                            <span className="flex items-center gap-1 font-bold text-white drop-shadow-sm">
                              <Download className="w-2.5 h-2.5 text-white" />
                              {doc.downloads_count || 0} téléchargement{(doc.downloads_count || 0) > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Bas de carte */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-white/20 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDoc(doc)}
                            className="flex-1 py-1 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-[10px] rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                          >
                            <Eye className="w-3 h-3 text-stone-900" />
                            <span>Voir</span>
                          </button>

                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              download={doc.file_name || doc.title}
                              onClick={() => handleDocDownload(doc)}
                              className="p-1 sm:p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center active:scale-95"
                              title="Télécharger"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              className="p-1 sm:p-1.5 bg-stone-700 text-stone-500 rounded-lg border border-stone-700 cursor-not-allowed flex items-center justify-center"
                              disabled
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleCardFlip(doc.id)}
                            className="p-1 sm:p-1.5 bg-black hover:bg-stone-900 text-white rounded-lg border border-black shadow-md transition-all cursor-pointer flex items-center justify-center"
                            title="Retourner vers l'aperçu"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Carte Mode Aperçu Visuel (Image 1 & Image 4) : couleur du type de document, cadrage en-tête vers le bas
                  return (
                    <div
                      key={doc.id}
                      style={typeInfo.cardBgStyle}
                      className={`aspect-[3/4] ${typeInfo.cardBorderClass} rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between ${typeInfo.cardShadowClass} transition-all relative group select-none overflow-hidden`}
                    >
                      {/* Header: Catégorie à gauche, Taille à droite */}
                      <div className="flex items-center justify-between gap-1 z-10">
                        <span className="text-[7.5px] sm:text-[8.5px] font-black bg-white text-stone-800 border border-white px-1.5 py-0.5 rounded shadow-sm truncate max-w-[65px]">
                          {doc.category || "Pas d'informations"}
                        </span>
                        <span className="text-[7.5px] sm:text-[8px] font-bold bg-black/40 text-white border border-black/20 px-1.5 py-0.5 rounded shadow-sm">
                          {docSizeStr}
                        </span>
                      </div>

                      {/* Zone centrale : Miniature du document cadrée de l'en-tête vers le bas (clic pour ouvrir sans redirection) */}
                      <div className="flex-1 w-full my-1.5 overflow-hidden rounded-lg bg-black/40 flex items-center justify-center relative shadow-inner border border-white/5">
                        <DocumentCardThumbnail doc={doc} onClick={() => handleOpenDoc(doc)} />
                      </div>

                      {/* Titre du document (clic pour ouvrir) */}
                      <div className="px-0.5 mb-1 flex flex-col gap-0.5">
                        {doc.file_name && (
                          <p
                            onClick={() => handleOpenDoc(doc)}
                            className="text-[8.5px] sm:text-[9px] font-semibold text-white truncate cursor-pointer hover:text-white/80 transition-colors drop-shadow-sm"
                            title={doc.file_name}
                          >
                            {doc.file_name}
                          </p>
                        )}
                        {(!doc.file_name || !isSameName) && doc.title && (
                          <p
                            onClick={() => handleOpenDoc(doc)}
                            className="text-[9.5px] sm:text-[10.5px] font-black text-white truncate cursor-pointer hover:text-orange-300 transition-colors drop-shadow-md"
                            title={doc.title}
                          >
                            {doc.title}
                          </p>
                        )}
                      </div>

                      {/* Bas de carte : Nombre de téléchargements (au lieu de vues) + Badge Type (croix rouge) + Bouton Télécharger + 3 traits */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/20 gap-1">
                        {/* Téléchargements (Image 1 entouré en rouge) */}
                        <div 
                          className="flex items-center gap-0.5 sm:gap-1 text-[7.5px] sm:text-[8.5px] font-bold text-white truncate drop-shadow-sm"
                          title={`${doc.downloads_count || 0} téléchargement(s)`}
                        >
                          <Download className="w-2.5 h-2.5 text-white shrink-0 drop-shadow-sm" />
                          <span>{doc.downloads_count || 0}</span>
                        </div>

                        {/* Badge Type de fichier (Image 1 croix rouge) */}
                        <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${typeInfo.badgeClass}`}>
                          {typeInfo.name}
                        </span>

                        {/* Actions : Télécharger + 3 traits */}
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          {/* Bouton Télécharger */}
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              download={doc.file_name || doc.title}
                              onClick={() => handleDocDownload(doc)}
                              className="p-1 sm:p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center active:scale-95"
                              title="Télécharger"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              className="p-1 sm:p-1.5 bg-stone-700 text-stone-500 rounded-lg border border-stone-700 cursor-not-allowed flex items-center justify-center"
                              title="Fichier non disponible"
                              disabled
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}

                          {/* Bouton 3 traits : bascule cette carte seule vers les détails */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardFlip(doc.id);
                            }}
                            className="p-1 sm:p-1.5 bg-black/40 hover:bg-black/60 text-stone-200 hover:text-orange-400 rounded-lg border border-white/10 hover:border-orange-500 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center active:scale-95"
                            title="Voir les informations complètes sur ce fichier"
                          >
                            <Menu className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODE COMPACT (Cartes Détaillées) */
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 w-full">
                {publishedDocs.map((doc) => {
                  const docSizeStr = (() => {
                    const bytes = doc.file_size || 0;
                    if (!bytes) return '—';
                    const k = 1024;
                    const sizes = ['o', 'Ko', 'Mo', 'Go'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                  })();

                  const typeInfo = getDocTypeInfo(doc);

                  const isSameName = (() => {
                    if (!doc.title || !doc.file_name) return false;
                    const t = doc.title.toLowerCase().trim();
                    const f = doc.file_name.toLowerCase().trim();
                    const fNoExt = f.includes('.') ? f.substring(0, f.lastIndexOf('.')) : f;
                    return t === f || t === fNoExt;
                  })();

                  return (
                    <div
                      key={doc.id}
                      className="bg-[#FDFBF7] border-2 border-stone-800 rounded-xl p-2 sm:p-2.5 md:p-3 shadow-[2px_2px_0px_0px_#1c1917] hover:shadow-[3.5px_3.5px_0px_0px_#1c1917] transition-all flex flex-col justify-between group h-full relative"
                    >
                      <div>
                        {/* Header: icône + badge catégorie + badge type */}
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="cursor-pointer" onClick={() => handleOpenDoc(doc)}>
                              <FileIconBadge fileName={doc.file_name || doc.title} size={28} />
                            </div>
                            <span className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${typeInfo.badgeClass}`}>
                              {typeInfo.name}
                            </span>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCategoryTooltipId(prev => prev === doc.id ? null : doc.id);
                              }}
                              className="text-[8.5px] sm:text-[10px] font-extrabold bg-orange-100 hover:bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-md border border-stone-800 truncate max-w-[55px] sm:max-w-[70px] transition-all cursor-pointer block text-left active:scale-95"
                              title={doc.category}
                            >
                              {doc.category || "Pas d'informations"}
                            </button>
                            {activeCategoryTooltipId === doc.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 z-50 bg-stone-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-2xl border-2 border-stone-700 whitespace-nowrap animate-fadeIn flex items-center gap-2"
                              >
                                <span className="text-orange-400 text-xs">🎓</span>
                                <span>{doc.category}</span>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setActiveCategoryTooltipId(null); }}
                                  className="p-0.5 hover:bg-stone-800 rounded text-stone-400 hover:text-white transition-colors cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Titre (clic pour ouvrir directement in-app) */}
                        <div className="mb-0.5 flex flex-col">
                          {doc.file_name && (
                            <p
                              onClick={() => handleOpenDoc(doc)}
                              className="text-[9px] sm:text-[10px] font-semibold text-stone-500 line-clamp-2 leading-tight cursor-pointer hover:text-stone-700 transition-colors"
                              title={doc.file_name}
                            >
                              {doc.file_name}
                            </p>
                          )}
                          {(!doc.file_name || !isSameName) && doc.title && (
                            <h3 
                              onClick={() => handleOpenDoc(doc)}
                              className="text-[11px] sm:text-xs font-extrabold text-stone-900 line-clamp-2 leading-tight group-hover:text-orange-600 transition-colors cursor-pointer" 
                              title={doc.title}
                            >
                              {doc.title}
                            </h3>
                          )}
                        </div>

                        {/* Matière */}
                        {doc.matiere_name && (
                          <p className="text-[9px] text-stone-500 font-semibold line-clamp-2 leading-tight mb-0.5" title={doc.matiere_name}>
                            📚 {doc.matiere_name}{doc.level ? ` · ${doc.level}` : ''}
                          </p>
                        )}

                        {/* École */}
                        <div className="min-h-[16px] mb-1.5 flex items-center">
                          <div className="flex items-center gap-1 text-[8.5px] sm:text-[10px] text-stone-600 truncate w-full">
                            <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-stone-500 shrink-0" />
                            {doc.school && doc.school.trim() ? (
                              <span className="font-bold truncate text-stone-800" title={doc.school}>{doc.school}</span>
                            ) : (
                              <span className="font-normal italic text-stone-400 truncate">Non renseigné</span>
                            )}
                          </div>
                        </div>

                        {/* Pays + Auteur */}
                        <div className="flex items-center gap-1 text-[8px] text-stone-400 font-medium truncate mb-1">
                          {doc.country && <span className="flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{doc.country}</span>}
                          {doc.author_name && <span className="truncate">· {doc.author_name}</span>}
                        </div>
                      </div>

                      {/* Bas de carte : Téléchargements uniquement (vues supprimées) + Voir + Télécharger */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-stone-200 gap-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8.5px] sm:text-[10px] font-bold text-stone-500 truncate">{docSizeStr}</span>
                          <span className="text-[8px] sm:text-[9px] text-stone-600 font-bold flex items-center gap-1" title={`${doc.downloads_count || 0} téléchargement(s)`}>
                            <Download className="w-2.5 h-2.5 text-orange-500" />
                            <span>{doc.downloads_count || 0}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenDoc(doc)}
                            className="p-1 sm:px-2 sm:py-1 bg-white hover:bg-stone-100 text-stone-900 font-bold text-[10px] sm:text-xs rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center gap-1 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                            title="Visualiser dans l'application"
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">Voir</span>
                          </button>
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              download={doc.file_name || doc.title}
                              onClick={() => handleDocDownload(doc)}
                              className="p-1 sm:p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5"
                              title="Télécharger"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              className="p-1 sm:p-1.5 bg-stone-300 text-stone-400 rounded-lg border border-stone-300 cursor-not-allowed flex items-center justify-center"
                              title="Fichier non disponible"
                              disabled
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sentinelle pour le défilement infini et indicateur de chargement */}
            {hasMoreDocs && (
              <div ref={infiniteSentinelRef} className="py-6 flex flex-col items-center justify-center gap-2">
                {isLoadingMoreDocs ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-stone-800 rounded-xl shadow-[2px_2px_0px_0px_#1c1917] text-xs font-bold text-stone-800">
                    <RefreshCw className="w-3.5 h-3.5 text-orange-600 animate-spin" />
                    <span>Chargement de nouvelles ressources...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={loadMorePublishedDocs}
                    className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-800 border-2 border-stone-800 rounded-xl shadow-[2px_2px_0px_0px_#1c1917] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <span>Afficher la suite des documents</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ONGLET LIENS PUBLICS */}
        {activeSubTab === 'liens' && (() => {
          // Fusionner les dossiers locaux marqués explicitement publics et les liens distants D1
          const localFolderMap = new Map(folders.map((f) => [f.id, f]));
          const combinedPublicMap = new Map<string, SharedFolder>();

          // 1. Dossiers de l'utilisateur qui sont publics
          folders.forEach((f) => {
            if (Boolean(f.isPublic)) {
              combinedPublicMap.set(f.id, f);
            }
          });

          // 2. Dossiers publics distants D1 (sauf si l'utilisateur local l'a explicitement repassé en privé)
          remotePublicFolders.forEach((rf) => {
            const localMatch = localFolderMap.get(rf.id);
            if (localMatch && !(localMatch as any).isPublic) return; // Repassé en privé localement
            if (Boolean(rf.isPublic) && !combinedPublicMap.has(rf.id)) {
              combinedPublicMap.set(rf.id, rf);
            }
          });

          const allPublicFolders = Array.from(combinedPublicMap.values());

          const filteredPublicFolders = allPublicFolders.filter((folder) => {
            if (!Boolean(folder.isPublic)) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              folder.title.toLowerCase().includes(q) ||
              (folder.description && folder.description.toLowerCase().includes(q)) ||
              (folder.school && folder.school.toLowerCase().includes(q)) ||
              (folder.category && folder.category.toLowerCase().includes(q)) ||
              folder.files.some(f => f.name.toLowerCase().includes(q))
            );
          });

          return (
            <div className="space-y-4">
              {isLoadingPublicFolders && filteredPublicFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs font-bold text-stone-500 dark:text-slate-400">Chargement des liens publics...</p>
                </div>
              ) : filteredPublicFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto mb-3">
                    <Link2 className="w-7 h-7 stroke-[2]" />
                  </div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                    {searchQuery ? "Aucun lien ne correspond à la recherche" : "Aucun lien public disponible"}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm">
                    {searchQuery ? "Essayez avec d'autres termes de recherche." : "Pour rendre un lien public, cliquez sur le cadenas dans vos Liens Actifs et ajoutez une description."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full">
                  {filteredPublicFolders.map((folder) => {
                    const isCopied = copiedLinkId === folder.id;
                    const totalBytes = folder.totalSize || folder.files.reduce((acc, f) => acc + (f.size || 0), 0);
                    const totalSizeStr = formatSize(totalBytes);
                    const downloadsCount = folder.downloadsCount || 0;

                    return (
                      <div
                        key={folder.id}
                        className="bg-[#FDFBF7] dark:bg-slate-900/70 dark:backdrop-blur-xl border-2 border-stone-800 dark:border-white/10 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all hover:shadow-[4px_4px_0px_0px_#1c1917] dark:hover:border-blue-500/30"
                      >
                        <div>
                          {/* Top Line: Title inside pill badge on left, Size on right (No lock icon) */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-3 py-1 bg-amber-100/90 dark:bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-stone-800 dark:border-amber-500/30 font-extrabold text-xs rounded-xl truncate max-w-[210px] sm:max-w-[240px] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none">
                              {folder.title}
                            </span>
                            <span className="text-xs font-bold text-stone-600 dark:text-slate-400 shrink-0">
                              {totalSizeStr}
                            </span>
                          </div>

                          {/* Description / Subtitle */}
                          <p className="text-xs text-stone-600 dark:text-slate-300 font-medium line-clamp-2 my-2.5 leading-relaxed">
                            {folder.description || (folder.school ? `Cours, TDs corrigés, codes sources et ressources d'études (${folder.school}).` : 'Cours, TDs corrigés, codes sources TP et rapport de projet.')}
                          </p>

                          {/* Folder Files Box */}
                          <div
                            onClick={() => onSelectFolder(folder)}
                            className="bg-stone-100/90 dark:bg-slate-950/70 dark:hover:bg-slate-950/90 border-2 border-stone-800 dark:border-white/10 rounded-xl p-3 flex items-center gap-3 my-2 cursor-pointer hover:bg-stone-200/70 transition-colors shadow-[1.5px_1.5px_0px_0px_#1c1917] dark:shadow-none group/box"
                          >
                            <div className="w-10 h-10 bg-amber-400 dark:bg-amber-500/20 border-2 border-stone-800 dark:border-amber-500/40 rounded-lg flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none">
                              <Folder className="w-5 h-5 text-amber-950 dark:text-amber-400 fill-amber-300 dark:fill-amber-400/30 stroke-[2]" />
                            </div>
                            <div className="overflow-hidden space-y-0.5">
                              <h4 className="font-extrabold text-xs text-stone-900 dark:text-white group-hover/box:text-orange-500 dark:group-hover/box:text-orange-400 transition-colors truncate">
                                {folder.files.length} fichier{folder.files.length > 1 ? 's' : ''} inclus
                              </h4>
                              <p className="text-[11px] text-stone-500 dark:text-slate-400 font-medium truncate">
                                {folder.files.length > 0 ? folder.files.map(f => f.name).join(', ') : 'Aucun fichier'}
                              </p>
                            </div>
                          </div>

                          {/* Dotted Divider */}
                          <div className="border-b-2 border-dashed border-stone-300 dark:border-white/10 my-3" />

                          {/* Downloads Counter (Vrai nombre de téléchargements) */}
                          <div className="text-xs font-bold text-stone-600 dark:text-slate-400 flex items-center justify-center gap-1.5 mb-3">
                            <Download className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                            <span>{downloadsCount} téléchargement{downloadsCount > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        {/* Bottom Action Row: Lien + Download Arrow Button (In place of Trash) */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(folder)}
                            className={`flex-1 py-2 px-3 font-extrabold text-xs rounded-xl border-2 border-stone-800 dark:border-white/15 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                              isCopied ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-white/10 hover:bg-stone-50 dark:hover:bg-white/15 text-stone-900 dark:text-white'
                            }`}
                          >
                            {isCopied ? (
                              'Copié ! ✓'
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-stone-700 dark:text-slate-300" />
                                <span>Lien</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDownloadFolder(folder, e)}
                            className="px-4 py-2 bg-white dark:bg-white/10 hover:bg-stone-50 dark:hover:bg-white/15 active:bg-stone-100 text-stone-900 dark:text-white font-extrabold text-xs rounded-xl border-2 border-stone-800 dark:border-white/15 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                            title="Télécharger les fichiers du dossier"
                          >
                            <Download className="w-4 h-4 text-stone-900 dark:text-white stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Toast Notification Top (Fixed, Green, Top position without bouncing) */}
      {toastMsg && (
        <div className="fixed top-2.5 sm:top-3 left-1/2 -translate-x-1/2 z-[300000] bg-emerald-600 text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl border-2 border-stone-900 shadow-[0_6px_20px_rgba(0,0,0,0.25)] flex items-center gap-2 max-w-[92vw] text-center transition-all animate-fadeIn">
          <span>🛒</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Product Detail Full Screen View */}
      {selectedDetailProduct && (
        <div id="product-detail-modal" className="fixed inset-0 md:left-64 z-[100000] bg-[#FAF8F5] flex flex-col animate-fadeIn overflow-y-auto text-left">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-stone-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setSelectedDetailProduct(null);
                setActiveDetailImageIndex(0);
                setIsDescriptionExpanded(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl transition-all cursor-pointer border border-stone-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row gap-6 md:gap-10 p-0 md:p-8 pb-12 items-start">
            
            {/* Left Column (Image & Info - Sticky on desktop) */}
            <div className="flex-1 w-full space-y-5 md:sticky md:top-6">
            {/* Horizontal Image Gallery Slider */}
            {(() => {
              const rawImages = selectedDetailProduct.imageUrls && selectedDetailProduct.imageUrls.length > 0
                ? selectedDetailProduct.imageUrls
                : (selectedDetailProduct.imageUrl ? [selectedDetailProduct.imageUrl] : []);

              const imageSlides = Array.from({ length: 3 }).map((_, i) => rawImages[i] || (rawImages[0] ? rawImages[0] : null));

              return (
                <div className="space-y-2 bg-stone-100/70 border-b border-stone-200 pb-3">
                  <div
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth w-full"
                    onScroll={(e) => {
                      const scrollLeft = e.currentTarget.scrollLeft;
                      const width = e.currentTarget.clientWidth;
                      if (width > 0) {
                        setActiveDetailImageIndex(Math.round(scrollLeft / width));
                      }
                    }}
                  >
                    {imageSlides.map((imgUrl, idx) => (
                      <div key={idx} className="w-full shrink-0 snap-center h-72 sm:h-80 bg-white flex items-center justify-center relative p-3">
                        {/* Badge Logo StudyCloud en haut de l'image */}
                        <div className="absolute top-4 left-5 flex items-center gap-1.5 px-3 py-1 bg-stone-900/90 backdrop-blur-md rounded-full border border-orange-500/50 shadow-md z-10">
                          <img src={studentLogo} alt="StudyCloud" className="w-4 h-4 rounded-full object-cover" />
                          <span className="text-[10px] font-black text-white tracking-wider">STUDYCLOUD</span>
                        </div>

                        {imgUrl ? (
                          <img src={imgUrl} alt={`${selectedDetailProduct.title} - Image ${idx + 1}`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-stone-50 flex flex-col items-center justify-center text-stone-300 gap-2 rounded-xl border border-dashed border-stone-200">
                            <Package className="w-12 h-12 stroke-1" />
                            <span className="text-xs font-medium text-stone-400">Image {idx + 1} / 3</span>
                          </div>
                        )}
                        <span className="absolute bottom-3 right-4 px-2 py-0.5 bg-stone-900/80 text-white font-bold text-[10px] rounded-md backdrop-blur-xs">
                          {idx + 1} / 3
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Slider Indicator Dots */}
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {imageSlides.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-2 rounded-full transition-all ${
                          idx === activeDetailImageIndex ? 'w-5 bg-stone-900' : 'w-2 bg-stone-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Title & Price in Orange */}
            <div className="px-4 space-y-1">
              <h1 className="font-serif font-black text-xl text-stone-900 leading-snug">
                {selectedDetailProduct.title}
              </h1>
              <div className="font-extrabold text-2xl text-orange-600 pt-1">
                {selectedDetailProduct.price}
              </div>
            </div>

            {/* Description */}
            <div className="px-4 space-y-2 pt-2 border-t border-stone-200">
              <h4 className="font-bold text-xs uppercase tracking-wider text-stone-500">Description</h4>
              <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line font-medium">
                <p className={!isDescriptionExpanded && selectedDetailProduct.description && selectedDetailProduct.description.length > 80 ? "line-clamp-2" : ""}>
                  {selectedDetailProduct.description || "Aucune description fournie pour ce produit."}
                </p>
                {selectedDetailProduct.description && selectedDetailProduct.description.length > 80 && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-xs font-bold text-stone-900 hover:text-stone-700 flex items-center gap-1.5 cursor-pointer pt-2 underline underline-offset-2"
                  >
                    <span>{isDescriptionExpanded ? 'Réduire la description' : 'Dérouler la description'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* Commander Button & Cart Button */}
            <div className="px-4 pt-3 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => toggleCartItem(selectedDetailProduct.id, selectedDetailProduct.title)}
                className={`py-3.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 ${
                  cartItemIds.includes(selectedDetailProduct.id)
                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                }`}
                title={cartItemIds.includes(selectedDetailProduct.id) ? "Retirer du panier" : "Ajouter au panier"}
              >
                <ShoppingCart className={`w-4 h-4 ${cartItemIds.includes(selectedDetailProduct.id) ? 'text-amber-800 fill-amber-700' : 'text-stone-700'}`} />
                <span>{cartItemIds.includes(selectedDetailProduct.id) ? "Ajouté ✓" : "Ajouter au panier"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOrderProduct(selectedDetailProduct)}
                className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer text-center shadow-md active:scale-98"
              >
                Commander
              </button>
            </div>

            </div>

            {/* Right Column (Shop & Related Products - Scrollable) */}
            <div className="flex-1 w-full space-y-5 min-w-0">
              
              {/* Shop Profile Card */}
              <div className="px-4 pt-4 md:px-0 md:pt-0">
                {(() => {
                  const currentSellerId = selectedDetailProduct.sellerId || selectedDetailProduct.seller_id;
                  const isCurrentSellerSubscribed = currentSellerId ? followedSellerIds.includes(currentSellerId) : isSubscribed;
                  const currentSellerName = selectedDetailProduct.sellerName || selectedDetailProduct.seller_name || shopName;
                  const currentSellerPhone = selectedDetailProduct.sellerPhone || selectedDetailProduct.seller_phone || shopPhone;
                  const currentSellerAvatar = selectedDetailProduct.sellerAvatarUrl || selectedDetailProduct.seller_avatar_url || shopAvatarUrl;
                  const currentSellerSchool = selectedDetailProduct.sellerSchool || selectedDetailProduct.seller_school;
                  const currentSellerFiliere = selectedDetailProduct.sellerFiliere || selectedDetailProduct.seller_filiere;

                  const handleToggleFollow = async () => {
                    const currentUserId = localStorage.getItem('unifolder_user_id') || 'default-user';
                    const targetSellerId = currentSellerId || 'default-seller';
                    const willFollow = !isCurrentSellerSubscribed;

                    setIsSubscribed(willFollow);
                    if (willFollow) {
                      setFollowedSellerIds(prev => [...new Set([...prev, targetSellerId])]);
                      triggerToast(`Vous êtes maintenant abonné à ${currentSellerName} ! Ses produits vous seront recommandés en priorité.`);
                    } else {
                      setFollowedSellerIds(prev => prev.filter(id => id !== targetSellerId));
                      triggerToast(`Désabonné de ${currentSellerName}.`);
                    }

                    try {
                      await StudyCloudAPI.toggleSellerFollow(currentUserId, targetSellerId, willFollow ? 'follow' : 'unfollow');
                    } catch (e) {
                      console.warn('Erreur toggle follow seller:', e);
                    }
                  };

                  return (
                    <div className="bg-white rounded-3xl border border-stone-200/90 p-4 shadow-sm space-y-3.5 text-left">
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-full bg-amber-100/90 border-2 border-stone-800 overflow-hidden shrink-0 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center font-black text-amber-900 text-base">
                          {currentSellerAvatar ? (
                            <img src={currentSellerAvatar} alt={currentSellerName} className="w-full h-full object-cover" />
                          ) : (
                            currentSellerName ? currentSellerName.substring(0, 2).toUpperCase() : 'DK'
                          )}
                        </div>
                        <div className="overflow-hidden space-y-0.5">
                          <h3 className="font-extrabold text-base text-stone-900 truncate">{currentSellerName}</h3>
                          <p className="text-xs text-stone-500 font-bold truncate">{currentSellerPhone}</p>
                          {(currentSellerSchool || currentSellerFiliere) && (
                            <p className="text-[10px] text-stone-400 font-medium truncate">
                              {[currentSellerSchool, currentSellerFiliere].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 pt-0.5">
                        <button
                          type="button"
                          onClick={handleToggleFollow}
                          className={`flex-1 py-2.5 font-extrabold text-xs sm:text-sm rounded-2xl border-2 transition-all cursor-pointer ${
                            isCurrentSellerSubscribed
                              ? 'bg-stone-100 text-stone-800 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                              : 'bg-blue-600 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-blue-700'
                          }`}
                        >
                          {isCurrentSellerSubscribed ? "Abonné ✓" : "S'abonner"}
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerToast("Lien de la boutique copié dans le presse-papier !")}
                          className="flex-1 py-2.5 bg-white text-stone-800 font-extrabold text-xs sm:text-sm rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-stone-50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <Share2 className="w-4 h-4 text-stone-800" />
                          <span>Partager</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

            {/* Related Products displayed when scrolling down */}
            <div className="px-4 pt-4 pb-8 space-y-3">
              <div className="flex items-center justify-between md:px-0">
                <h3 className="font-extrabold text-sm text-stone-900">
                  Autres produits
                </h3>
                <span className="text-[11px] text-stone-500 font-bold">📚 Librairie</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 md:px-0">
                {productsList
                  .filter((p) => p.id !== selectedDetailProduct.id)
                  .map((item, idx) => {
                    const displayImages = item.imageUrls && item.imageUrls.length > 0
                      ? item.imageUrls
                      : (item.imageUrl ? [item.imageUrl] : []);

                    return (
                      <div
                        key={`${item.id}-rec-${idx}`}
                        onClick={() => {
                          setSelectedDetailProduct(item);
                          setActiveDetailImageIndex(0);
                          setIsDescriptionExpanded(false);
                          const modalElem = document.getElementById('product-detail-modal');
                          if (modalElem) {
                            modalElem.scrollTop = 0;
                          }
                        }}
                        className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                      >
                        <div>
                          {/* Top Image Box */}
                          <div className="w-full h-32 sm:h-36 md:h-48 bg-stone-100/80 relative overflow-hidden flex items-center justify-center p-2.5 md:p-3">
                            {displayImages.length > 0 ? (
                              <img
                                src={displayImages[0]}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <Package className="w-10 h-10 md:w-12 md:h-12 stroke-[1.5]" />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="p-2.5 md:p-3 space-y-0.5 md:space-y-1">
                            <h4 className="font-extrabold text-xs md:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                              {item.title}
                            </h4>
                            {item.description && (
                              <p className="text-[10px] md:text-xs text-stone-500 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 md:p-3 pt-0 space-y-1.5 md:space-y-2.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-extrabold text-xs md:text-sm text-orange-600">
                              {item.price}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCartItem(item.id, item.title);
                              }}
                              className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                                cartItemIds.includes(item.id)
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold hover:bg-amber-200'
                                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                              }`}
                              title={cartItemIds.includes(item.id) ? "Retirer du panier" : "Ajouter au panier"}
                            >
                              <ShoppingCart className={`w-3 h-3 md:w-3.5 md:h-3.5 ${cartItemIds.includes(item.id) ? 'text-amber-800 fill-amber-700' : 'text-stone-700'}`} />
                              <span>{cartItemIds.includes(item.id) ? 'Ajouté' : 'Ajouter'}</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOrderProduct(item);
                            }}
                            className="w-full py-1.5 md:py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-[11px] md:text-sm rounded-xl md:rounded-2xl shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
                          >
                            Commander
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de choix de destination de téléchargement */}
      <DownloadDestinationModal
        isOpen={Boolean(pendingDestinationFolder)}
        onClose={() => setPendingDestinationFolder(null)}
        title={pendingDestinationFolder?.title}
        filesCount={pendingDestinationFolder?.files.length || 1}
        onConfirm={handleConfirmDestination}
      />
    </div>
  );
};
