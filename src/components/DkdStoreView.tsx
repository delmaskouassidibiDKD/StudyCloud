import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Maximize2,
  Minimize2,
  X,
  RefreshCw,
  ExternalLink,
  Globe,
  Sparkles,
  Bookmark,
  Check,
  AlertCircle,
  Play,
  LayoutGrid,
  Rows
} from 'lucide-react';
import { DkdStore3DIcon } from './DkdStore3DIcon';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../utils/viewerExpandManager';
import {
  getDkdStorePublicData,
  DkdStoreSite,
  DkdStoreCategory,
  DkdStoreSubcategory
} from '../services/api';

interface DkdStoreViewProps {
  onBack: () => void;
}

// Composant Tuile Application style Google Play Store (Grand icône arrondi + titre en dessous)
interface DkdAppTileProps {
  site: DkdStoreSite;
  isPinned: boolean;
  onOpen: (site: DkdStoreSite) => void;
  onTogglePin: (site: DkdStoreSite, e: React.MouseEvent) => void;
  getDomainFromUrl: (url: string) => string;
  className?: string;
}

const DkdAppTile: React.FC<DkdAppTileProps> = ({
  site,
  isPinned,
  onOpen,
  onTogglePin,
  getDomainFromUrl,
  className = '',
}) => {
  const domain = getDomainFromUrl(site.url);
  const logoSrc = (site.logo_url && site.logo_url.trim() !== '')
    ? site.logo_url
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div
      onClick={() => onOpen(site)}
      className={`group flex flex-col items-start cursor-pointer select-none transition-all duration-200 active:scale-95 ${className}`}
      title={site.description ? `${site.name} — ${site.description}` : site.name}
    >
      {/* ICÔNE SQUIRCLE STYLE GOOGLE PLAY STORE (Grand format bien visible) */}
      <div className="relative w-full aspect-square rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111a2e] border-2 border-stone-300 dark:border-slate-700 group-hover:border-blue-500 dark:group-hover:border-blue-400 shadow-xs group-hover:shadow-md transition-all duration-200 overflow-hidden flex items-center justify-center p-1 sm:p-1.5">
        <img
          src={logoSrc}
          alt={site.name}
          className="w-full h-full object-cover rounded-[14px] sm:rounded-[20px] transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallbackTried) {
              img.dataset.fallbackTried = '1';
              img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
              img.className = 'w-10 h-10 sm:w-12 sm:h-12 object-contain';
            } else {
              img.style.display = 'none';
              const p = img.parentElement;
              if (p) {
                p.classList.add('bg-gradient-to-br', 'from-blue-500/10', 'to-indigo-500/20');
                p.innerHTML = '<span class="text-3xl sm:text-4xl select-none">🌐</span>';
              }
            }
          }}
        />

        {/* Bouton Épingler / Favori en haut à droite */}
        <button
          type="button"
          onClick={(e) => onTogglePin(site, e)}
          className={`absolute top-1.5 right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-10 cursor-pointer ${
            isPinned
              ? 'bg-amber-500 text-white shadow-md ring-2 ring-white/60'
              : 'bg-black/40 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-80 hover:scale-110 shadow-xs'
          }`}
          title={isPinned ? "Retirer de vos favoris" : "Ajouter aux favoris"}
        >
          <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isPinned ? 'fill-current' : ''}`} />
        </button>

        {/* Badge éventuel (ex: "IA", "Nouveau" ou "⭐ Recommandé") */}
        {site.badge ? (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-black/70 text-white backdrop-blur-md border border-white/20">
            {site.badge}
          </span>
        ) : Number(site.is_recommended) === 1 ? (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500 text-stone-950 shadow-xs">
            ⭐ Recommandé
          </span>
        ) : null}
      </div>

      {/* NOM & SOUS-TITRE EN DESSOUS (Comme Google Play) */}
      <div className="w-full mt-1.5 sm:mt-2 px-0.5">
        <h4 className="text-xs sm:text-[13px] md:text-sm font-bold text-stone-900 dark:text-white line-clamp-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {site.name}
        </h4>
        <p className="text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
          {site.subcategory_name ? site.subcategory_name : site.category_name ? site.category_name : domain}
        </p>
      </div>
    </div>
  );
};

export const DkdStoreView: React.FC<DkdStoreViewProps> = ({ onBack }) => {
  // 1. ÉTAT DES DONNÉES D1 & CHARGEMENT
  const [sites, setSites] = useState<DkdStoreSite[]>([]);
  const [categories, setCategories] = useState<DkdStoreCategory[]>([]);
  const [subcategories, setSubcategories] = useState<DkdStoreSubcategory[]>([]);
  const [recommendedIntervalSites, setRecommendedIntervalSites] = useState<number>(6);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 2. FILTRES & RECHERCHE
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('all');
  const [showOnlyPinned, setShowOnlyPinned] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'shelves' | 'grid'>('shelves');

  // 3. SITES ÉPINGLÉS / FAVORIS (Persistance Locale)
  const [pinnedSiteIds, setPinnedSiteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_pinned_dkd_sites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 4. SITE SÉLECTIONNÉ POUR LA FICHE DE PRÉSENTATION & SITE ACTIF OUVERT DANS L'IFRAME
  const [selectedSiteForDetail, setSelectedSiteForDetail] = useState<DkdStoreSite | null>(null);
  const [activePromoImageIdx, setActivePromoImageIdx] = useState<number>(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  const [activeSite, setActiveSite] = useState<DkdStoreSite | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 5. GESTION DE L'AGRANDISSEMENT ET DU ZOOM
  const viewerExpandLevel = useViewerExpandLevel();

  // Toast de notification local
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Chargement des données publiques depuis Cloudflare D1
  const loadStoreData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setFetchError(null);

    try {
      const data = await getDkdStorePublicData();
      if (data && data.success) {
        setSites(Array.isArray(data.sites) ? data.sites : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setSubcategories(Array.isArray(data.subcategories) ? data.subcategories : []);
        if (data.config && Number(data.config.recommended_interval_sites) >= 1) {
          setRecommendedIntervalSites(Number(data.config.recommended_interval_sites));
        }
      } else {
        setFetchError(data?.error || 'Impossible de charger le catalogue.');
      }
    } catch (e: any) {
      setFetchError(e?.message || 'Erreur réseau lors du chargement.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStoreData();
  }, []);

  // Sous-catégories associées à la catégorie actuellement sélectionnée
  const currentCategorySubcategories = useMemo(() => {
    if (selectedCategoryId === 'all') return [];
    return subcategories.filter(sc => String(sc.category_id) === String(selectedCategoryId));
  }, [subcategories, selectedCategoryId]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      resetViewerExpand();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Gestion de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImageUrl) {
          setLightboxImageUrl(null);
        } else if (viewerExpandLevel >= 1) {
          resetViewerExpand();
        } else if (activeSite) {
          setActiveSite(null);
        } else if (selectedSiteForDetail) {
          setSelectedSiteForDetail(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerExpandLevel, activeSite, selectedSiteForDetail, lightboxImageUrl]);

  // Basculer l'épinglage d'un site
  const togglePinSite = (site: DkdStoreSite, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isPinned = pinnedSiteIds.includes(site.id);
    const updated = isPinned
      ? pinnedSiteIds.filter(id => id !== site.id)
      : [...pinnedSiteIds, site.id];
    setPinnedSiteIds(updated);
    try {
      localStorage.setItem('studycloud_pinned_dkd_sites', JSON.stringify(updated));
    } catch { }

    if (isPinned) {
      showToast(`Site "${site.name}" retiré de vos raccourcis.`);
    } else {
      showToast(`⭐ "${site.name}" épinglé à vos raccourcis !`);
    }
  };

  // Filtrage des sites selon recherche, catégorie, sous-catégorie et favoris
  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      // Filtre favoris
      if (showOnlyPinned && !pinnedSiteIds.includes(site.id)) {
        return false;
      }

      // Filtre catégorie
      if (selectedCategoryId !== 'all') {
        const matchesId = String(site.category_id) === String(selectedCategoryId);
        const matchesName = String(site.category_name).toLowerCase() === String(selectedCategoryId).toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // Filtre sous-catégorie
      if (selectedSubcategoryId !== 'all') {
        const matchesSubId = String(site.subcategory_id) === String(selectedSubcategoryId);
        const matchesSubName = String(site.subcategory_name).toLowerCase() === String(selectedSubcategoryId).toLowerCase();
        if (!matchesSubId && !matchesSubName) return false;
      }

      // Filtre de recherche (inclut nom, URL, description, catégorie et sous-catégorie)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = (site.name || '').toLowerCase().includes(q);
        const inDesc = (site.description || '').toLowerCase().includes(q);
        const inUrl = (site.url || '').toLowerCase().includes(q);
        const inBadge = (site.badge || '').toLowerCase().includes(q);
        const inCat = (site.category_name || '').toLowerCase().includes(q);
        const inSubcat = (site.subcategory_name || '').toLowerCase().includes(q);
        return inName || inDesc || inUrl || inBadge || inCat || inSubcat;
      }

      return true;
    });
  }, [sites, searchQuery, selectedCategoryId, selectedSubcategoryId, showOnlyPinned, pinnedSiteIds]);

  // Regroupement par catégories pour les rayons horizontaux style Google Play
  const categoriesWithSites = useMemo(() => {
    return categories
      .map(cat => ({
        category: cat,
        sites: sites.filter(s =>
          String(s.category_id) === String(cat.id) ||
          String(s.category_name).toLowerCase() === String(cat.name).toLowerCase()
        )
      }))
      .filter(item => item.sites.length > 0);
  }, [categories, sites]);

  // Sites orphelins (sans catégorie)
  const uncategorizedSites = useMemo(() => {
    return sites.filter(s => {
      if (!s.category_id && !s.category_name) return true;
      const inAnyCat = categories.some(c =>
        String(s.category_id) === String(c.id) ||
        String(s.category_name).toLowerCase() === String(c.name).toLowerCase()
      );
      return !inAnyCat;
    });
  }, [categories, sites]);

  // Extraction propre du nom de domaine pour affichage
  const getDomainFromUrl = (url: string) => {
    try {
      const u = new URL(url.includes('://') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  // Extraction propre du tableau d'images publicitaires (1 à 3 images stockées dans R2)
  const parsePromoImages = (raw?: string | string[]): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, 3);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0, 3);
      } catch {}
    }
    return [];
  };

  // Sites similaires pour la fiche de présentation du site sélectionné
  const similarSites = useMemo(() => {
    if (!selectedSiteForDetail) return [];
    const current = selectedSiteForDetail;
    const others = sites.filter(s => String(s.id) !== String(current.id));
    const sameSub = (current.subcategory_id || current.subcategory_name)
      ? others.filter(s =>
          (current.subcategory_id && String(s.subcategory_id) === String(current.subcategory_id)) ||
          (current.subcategory_name && String(s.subcategory_name).toLowerCase() === String(current.subcategory_name).toLowerCase())
        )
      : [];
    const sameCat = others.filter(s =>
      !sameSub.some(sub => sub.id === s.id) &&
      ((current.category_id && String(s.category_id) === String(current.category_id)) ||
       (current.category_name && String(s.category_name).toLowerCase() === String(current.category_name).toLowerCase()))
    );
    const rest = others.filter(s =>
      !sameSub.some(sub => sub.id === s.id) &&
      !sameCat.some(cat => cat.id === s.id)
    );
    return [...sameSub, ...sameCat, ...rest].slice(0, 8);
  }, [sites, selectedSiteForDetail]);

  // Sites recommandés actifs (filtrés selon expiration et classés en fonction de ce que l'utilisateur cherche ou consulte)
  const contextualRecommendedSites = useMemo(() => {
    const nowMs = Date.now();
    const activeRecs = sites.filter(s => {
      if (Number(s.is_recommended) !== 1) return false;
      const exp = Number(s.recommended_expires_at || 0);
      if (s.recommended_duration_type !== 'infinite' && exp > 0 && exp <= nowMs) {
        return false;
      }
      return true;
    });

    if (activeRecs.length === 0) return [];

    const q = searchQuery.trim().toLowerCase();
    return activeRecs.slice().sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (q) {
        const hayA = `${a.name || ''} ${a.description || ''} ${a.category_name || ''} ${a.subcategory_name || ''} ${a.badge || ''}`.toLowerCase();
        const hayB = `${b.name || ''} ${b.description || ''} ${b.category_name || ''} ${b.subcategory_name || ''} ${b.badge || ''}`.toLowerCase();
        if (hayA.includes(q)) scoreA += 10;
        if (hayB.includes(q)) scoreB += 10;
      }

      if (selectedSubcategoryId !== 'all') {
        if (String(a.subcategory_id) === String(selectedSubcategoryId) || String(a.subcategory_name || '').toLowerCase() === String(selectedSubcategoryId).toLowerCase()) scoreA += 6;
        if (String(b.subcategory_id) === String(selectedSubcategoryId) || String(b.subcategory_name || '').toLowerCase() === String(selectedSubcategoryId).toLowerCase()) scoreB += 6;
      }

      if (selectedCategoryId !== 'all') {
        if (String(a.category_id) === String(selectedCategoryId) || String(a.category_name || '').toLowerCase() === String(selectedCategoryId).toLowerCase()) scoreA += 4;
        if (String(b.category_id) === String(selectedCategoryId) || String(b.category_name || '').toLowerCase() === String(selectedCategoryId).toLowerCase()) scoreB += 4;
      }

      if (scoreB !== scoreA) return scoreB - scoreA;
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
  }, [sites, searchQuery, selectedCategoryId, selectedSubcategoryId]);

  // Helper pour afficher une seule ligne horizontale défilable de sites recommandés (gauche <-> droite)
  const renderRecommendedHorizontalLine = (blockKey: string) => {
    if (contextualRecommendedSites.length === 0) return null;
    return (
      <div
        key={`rec-row-${blockKey}`}
        className="w-full my-4 p-3 sm:p-4 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-blue-500/10 dark:from-amber-500/10 dark:via-[#0f182c] dark:to-blue-500/10 border-2 border-amber-400/50 dark:border-amber-500/40 shadow-xs"
      >
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm sm:text-base">⭐</span>
            <h3 className="text-xs sm:text-sm md:text-base font-black text-stone-900 dark:text-white truncate">
              {searchQuery.trim()
                ? `Recommandés pour vous · "${searchQuery.trim()}"`
                : 'Recommandés pour vous'}
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-extrabold shrink-0">
              Sponsorisé
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 dark:text-slate-400 hidden sm:inline shrink-0">
            Glissez de gauche à droite ↔
          </span>
        </div>

        {/* Ligne horizontale unique défilable de gauche à droite */}
        <div className="flex items-start gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar py-1 scroll-smooth">
          {contextualRecommendedSites.map((recSite) => (
            <DkdAppTile
              key={`${blockKey}-rec-${recSite.id}`}
              site={recSite}
              isPinned={pinnedSiteIds.includes(recSite.id)}
              onOpen={handleSelectSiteDetail}
              onTogglePin={togglePinSite}
              getDomainFromUrl={getDomainFromUrl}
              className="w-[100px] sm:w-[120px] md:w-[135px] shrink-0"
            />
          ))}
        </div>
      </div>
    );
  };

  // Helper pour ouvrir la fiche de présentation professionnelle d'un site
  const handleSelectSiteDetail = (site: DkdStoreSite) => {
    setSelectedSiteForDetail(site);
    setActivePromoImageIdx(0);
    setLightboxImageUrl(null);
    setTimeout(() => {
      detailScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 20);
  };

  // Helper pour l'ouverture effective d'un site dans l'iframe StudyCloud
  const handleOpenSite = (site: DkdStoreSite) => {
    setActiveSite(site);
    setIsIframeLoading(true);
    setIframeKey(prev => prev + 1);
  };

  // Helper pour recharger l'iframe
  const handleReloadIframe = () => {
    setIsIframeLoading(true);
    setIframeKey(prev => prev + 1);
  };

  return (
    <div
      className={`w-full flex-1 flex flex-col bg-white dark:bg-[#070b14] text-stone-900 dark:text-[#f1f5f9] transition-colors duration-300 overflow-hidden ${viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : viewerExpandLevel === 1
            ? 'relative w-full h-dvh min-h-dvh'
            : 'relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'
        }`}
    >
      {/* ====================================================================== */}
      {/* 1. BARRE SUPÉRIEURE (Une seule ligne sur Mobile et PC)                   */}
      {/* ====================================================================== */}
      <div className="w-full h-11 sm:h-12 flex items-center justify-between px-2.5 sm:px-4 bg-white/95 dark:bg-[#0d1424] border-b border-stone-300 dark:border-slate-700 shrink-0 z-30 shadow-xs select-none backdrop-blur-md">
        {/* Partie gauche : Bouton retour + Titre DKD store ou Site Actif */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
          <button
            onClick={() => {
              if (activeSite) {
                setActiveSite(null);
              } else if (selectedSiteForDetail) {
                setSelectedSiteForDetail(null);
              } else {
                onBack();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/90 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl border border-stone-300 dark:border-stone-600 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title={activeSite ? "Retour à la fiche du site" : selectedSiteForDetail ? "Retour au catalogue DKD store" : "Retour à l'accueil"}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="leading-none">{activeSite ? "Fiche" : selectedSiteForDetail ? "Catalogue" : "Retour"}</span>
          </button>

          {/* Logo et Nom : DKD store aux couleurs Google Play */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-2xs shrink-0 max-w-[200px] sm:max-w-none truncate">
            <DkdStore3DIcon className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm font-black tracking-tight whitespace-nowrap">
              <span className="text-[#4285F4]">D</span>
              <span className="text-[#EA4335]">K</span>
              <span className="text-[#FBBC05]">D</span>{' '}
              <span className="text-[#34A853]">s</span>
              <span className="text-[#4285F4]">t</span>
              <span className="text-[#EA4335]">o</span>
              <span className="text-[#FBBC05]">r</span>
              <span className="text-[#34A853]">e</span>
            </span>
            {(activeSite || selectedSiteForDetail) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400 border-l border-stone-300 dark:border-stone-700 pl-2 ml-1 truncate">
                <span>{(activeSite || selectedSiteForDetail)?.name}</span>
                {(activeSite || selectedSiteForDetail)?.category_name && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium border border-stone-300 dark:border-stone-700">
                    {(activeSite || selectedSiteForDetail)?.category_name}
                  </span>
                )}
                {(activeSite || selectedSiteForDetail)?.subcategory_name && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400 dark:border-indigo-600 font-medium">
                    🏷️ {(activeSite || selectedSiteForDetail)?.subcategory_name}
                  </span>
                )}
              </span>
            )}
          </div>

        </div>

        {/* Partie centrale : Champ de recherche petit et bien centré dans l'en-tête */}
        {!activeSite && !selectedSiteForDetail && (
          <div className="flex-1 max-w-[200px] xs:max-w-[240px] sm:max-w-xs md:max-w-sm flex items-center justify-center mx-2 sm:mx-4">
            <div className="relative flex items-center w-full bg-stone-100 hover:bg-stone-200/80 focus-within:bg-white dark:bg-[#111a2f] dark:hover:bg-[#14203b] dark:focus-within:bg-[#14203b] border border-stone-300 dark:border-stone-600 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-xl px-2.5 py-1 transition-all shadow-2xs">
              <Search className="w-3.5 h-3.5 text-stone-400 dark:text-stone-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une pépite..."
                className="w-full bg-transparent border-0 px-2 py-0.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-hidden font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                  title="Effacer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Partie droite : Actions, Détacher en Fenêtre App, Super Agrandissement & Zoom */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeSite ? (
            <>
              {/* Actualiser le site actif */}
              <button
                type="button"
                onClick={handleReloadIframe}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-600"
                title="Recharger la page"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin text-blue-500' : ''}`} />
              </button>

              {/* Épingler à l'accueil / Raccourcis */}
              <button
                type="button"
                onClick={(e) => togglePinSite(activeSite, e)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 ${pinnedSiteIds.includes(activeSite.id)
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/50 ring-1 ring-amber-500/40'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-600'
                  }`}
                title={pinnedSiteIds.includes(activeSite.id) ? "Retirer des raccourcis" : "Épingler aux raccourcis"}
              >
                <Bookmark className={`w-3.5 h-3.5 ${pinnedSiteIds.includes(activeSite.id) ? 'fill-current' : ''}`} />
              </button>

              {/* Ouvrir dans un nouvel onglet standard */}
              <a
                href={activeSite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-600"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <>
              {/* Actualiser les données depuis D1 */}
              <button
                type="button"
                onClick={() => loadStoreData(true)}
                disabled={isRefreshing}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-600"
                title="Actualiser le catalogue depuis la base de données"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
              </button>
            </>
          )}

          {/* Bouton Super Agrandissement Progressif (Desktop uniquement) */}
          <ViewerSuperExpandButton
            expandLevel={viewerExpandLevel}
            onExpandChange={(lvl) => {
              if (viewerExpandLevel >= 2) {
                setViewerExpandLevel(1);
              } else {
                setViewerExpandLevel(2);
              }
            }}
          />

          {/* Bouton Zoom 2 flèches opposées */}
          <button
            type="button"
            onClick={() => {
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobile) {
                if (viewerExpandLevel >= 1) {
                  resetViewerExpand();
                } else {
                  setViewerExpandLevel(2);
                }
              } else {
                if (viewerExpandLevel === 1) {
                  resetViewerExpand();
                } else {
                  setViewerExpandLevel(1);
                }
              }
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${viewerExpandLevel >= 1
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/40'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-black/60 dark:hover:bg-blue-600/80 dark:text-white dark:border-white/10'
              }`}
            title={
              viewerExpandLevel >= 1
                ? "Réduire"
                : (typeof window !== 'undefined' && window.innerWidth < 768 ? "Plein écran" : "Agrandir l'espace central")
            }
          >
            {viewerExpandLevel >= 1 ? (
              <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
          </button>
        </div>
      </div>

      {/* TOAST DE NOTIFICATION RAPIDE */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-stone-900/95 dark:bg-slate-900/95 text-white text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 2. MODE SITE ACTIF OUVERT                                               */}
      {/* ====================================================================== */}
      {activeSite ? (
        /* ================================================================== */
        /* 2. LECTEUR INTÉGRÉ STANDARD DANS LE CADRE DE LA PAGE (Image 1)     */
        /* ================================================================== */
        <div className="flex-1 w-full flex flex-col relative min-h-0 bg-stone-100 dark:bg-[#070b14] overflow-hidden">
          {/* Indicateur de chargement de l'iframe */}
          {isIframeLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-[#070b14]/80 backdrop-blur-xs">
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-300">
                Ouverture de <span className="font-bold text-blue-600 dark:text-blue-400">{activeSite.name}</span>...
              </p>
            </div>
          )}

          {/* Iframe intégrée */}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={activeSite.url}
            title={activeSite.name}
            onLoad={() => setIsIframeLoading(false)}
            className="w-full flex-1 border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation"
            allow="camera; microphone; fullscreen; clipboard-read; clipboard-write; autoplay;"
          />

          {/* Barre inférieure intégrée */}
          <div className="w-full py-1.5 px-3 bg-stone-100 dark:bg-[#0d1424] border-t border-stone-200 dark:border-white/10 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 shrink-0">
            <span className="truncate">
              ⚡ Connecté via StudyCloud · {getDomainFromUrl(activeSite.url)}
            </span>
            <button
              type="button"
              onClick={handleReloadIframe}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold shrink-0 ml-2 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>
      ) : selectedSiteForDetail ? (
        /* ================================================================== */
        /* 2.B FICHE DE PRÉSENTATION PROFESSIONNELLE DKD STORE                */
        /* Modèle exclusif StudyCloud : Images R2 (1-3), Description &        */
        /* Sites similaires (sans étoiles ni commentaires)                    */
        /* ================================================================== */
        (() => {
          const detailDomain = getDomainFromUrl(selectedSiteForDetail.url);
          const detailLogoSrc = (selectedSiteForDetail.logo_url && selectedSiteForDetail.logo_url.trim() !== '')
            ? selectedSiteForDetail.logo_url
            : `https://www.google.com/s2/favicons?domain=${detailDomain}&sz=128`;
          const promoImages = parsePromoImages(selectedSiteForDetail.promo_images);
          const currentHeroPromo = promoImages[activePromoImageIdx] || promoImages[0] || '';
          const isDetailPinned = pinnedSiteIds.includes(selectedSiteForDetail.id);

          return (
            <div
              ref={detailScrollRef}
              className="flex-1 w-full overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 relative min-h-0 bg-stone-50/60 dark:bg-[#070b14]"
            >
              <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-10">

                {/* 1. BANDEAU D'IDENTITÉ STUDIO DKD STORE */}
                <div className="relative overflow-hidden rounded-3xl border-2 border-stone-300 dark:border-slate-700 bg-gradient-to-br from-white via-stone-50 to-blue-50/40 dark:from-[#0d1526] dark:via-[#0f192e] dark:to-[#13203d] p-4 sm:p-6 shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                    {/* Icône Squircle + Titre + Badges */}
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white dark:bg-[#090f1d] border-2 border-stone-300 dark:border-slate-600 p-1.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={detailLogoSrc}
                          alt={selectedSiteForDetail.name}
                          className="w-full h-full object-cover rounded-2xl"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (!img.dataset.fallbackTried) {
                              img.dataset.fallbackTried = '1';
                              img.src = `https://www.google.com/s2/favicons?domain=${detailDomain}&sz=128`;
                              img.className = 'w-12 h-12 object-contain';
                            }
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-stone-900 dark:text-white tracking-tight leading-tight">
                            {selectedSiteForDetail.name}
                          </h1>
                          {selectedSiteForDetail.badge && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                              {selectedSiteForDetail.badge}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {selectedSiteForDetail.category_name && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-200/80 dark:bg-slate-800 text-stone-800 dark:text-slate-200 border border-stone-300 dark:border-slate-600">
                              <span>📁</span>
                              <span>{selectedSiteForDetail.category_name}</span>
                            </span>
                          )}
                          {selectedSiteForDetail.subcategory_name && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400 dark:border-indigo-500/50">
                              <span>🏷️</span>
                              <span>{selectedSiteForDetail.subcategory_name}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-semibold bg-stone-100 dark:bg-slate-900 text-stone-600 dark:text-slate-400 border border-stone-300 dark:border-slate-700">
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <span>{detailDomain}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Boutons d'action principaux */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenSite(selectedSiteForDetail)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-600/25 border border-blue-400/40 transition-all cursor-pointer active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Ouvrir le site</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => togglePinSite(selectedSiteForDetail, e)}
                        className={`flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-2xl font-bold text-xs border-2 transition-all cursor-pointer active:scale-95 ${
                          isDetailPinned
                            ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-white hover:bg-stone-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-200 border-stone-300 dark:border-slate-700'
                        }`}
                        title={isDetailPinned ? "Retirer des favoris" : "Épingler aux favoris"}
                      >
                        <Bookmark className={`w-4 h-4 ${isDetailPinned ? 'fill-current' : ''}`} />
                        <span className="hidden sm:inline">{isDetailPinned ? 'Favori' : 'Épingler'}</span>
                      </button>

                      <a
                        href={selectedSiteForDetail.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-3 rounded-2xl bg-white hover:bg-stone-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-200 border-2 border-stone-300 dark:border-slate-700 transition-all cursor-pointer active:scale-95"
                        title="Ouvrir dans un nouvel onglet externe"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* 2. ARCHITECTURE 2 COLONNES : VITRINE VISUELLE + DESCRIPTION (GAUCHE) | SITES SIMILAIRES (DROITE) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">

                  {/* COLONNE PRINCIPALE (8/12) : APERÇUS PUBLICITAIRES R2 & DESCRIPTION */}
                  <div className="lg:col-span-8 space-y-5 sm:space-y-6">

                    {/* SECTION A : APERÇUS VISUELS & IMAGES PUBLICITAIRES (1 à 3 images stockées dans R2) */}
                    <div className="rounded-3xl border-2 border-stone-300 dark:border-slate-700 bg-white dark:bg-[#0c1323] p-4 sm:p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🖼️</span>
                          <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                            Aperçus & Images de présentation
                          </h2>
                        </div>
                        {promoImages.length > 0 && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                            {promoImages.length} / 3 aperçu{promoImages.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {promoImages.length > 0 ? (
                        <div className="space-y-3">
                          {/* Visuel principal grand format */}
                          <div
                            onClick={() => setLightboxImageUrl(currentHeroPromo)}
                            className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-stone-300 dark:border-slate-700 bg-stone-950 group cursor-zoom-in shadow-inner flex items-center justify-center"
                          >
                            <img
                              src={currentHeroPromo}
                              alt={`${selectedSiteForDetail.name} - Aperçu ${activePromoImageIdx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-xl bg-black/70 text-white text-[11px] font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>Agrandir l'image ({activePromoImageIdx + 1}/{promoImages.length})</span>
                            </div>
                          </div>

                          {/* Vignettes de sélection rapide (si 2 ou 3 images) */}
                          {promoImages.length > 1 && (
                            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                              {promoImages.map((imgUrl, idx) => {
                                const isCurrent = idx === activePromoImageIdx;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActivePromoImageIdx(idx)}
                                    className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                                      isCurrent
                                        ? 'border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/30 scale-[1.01]'
                                        : 'border-stone-300 dark:border-slate-700 opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`Miniature ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded bg-black/70 text-white text-[10px] font-mono font-bold">
                                      #{idx + 1}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Bannière visuelle élégante si aucune image n'a encore été téléversée */
                        <div className="w-full py-10 px-4 rounded-2xl border-2 border-dashed border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-[#090f1d] flex flex-col items-center justify-center text-center space-y-2">
                          <img
                            src={detailLogoSrc}
                            alt={selectedSiteForDetail.name}
                            className="w-16 h-16 rounded-2xl object-contain opacity-90"
                          />
                          <p className="text-xs font-bold text-stone-700 dark:text-slate-300">
                            Aperçu direct de {selectedSiteForDetail.name}
                          </p>
                          <p className="text-[11px] text-stone-500 dark:text-slate-400">
                            Cliquez sur « Ouvrir le site » ci-dessus pour utiliser directement l'application dans StudyCloud.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* SECTION B : DESCRIPTION & PRÉSENTATION DÉTAILLÉE */}
                    <div className="rounded-3xl border-2 border-stone-300 dark:border-slate-700 bg-white dark:bg-[#0c1323] p-4 sm:p-6 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📋</span>
                          <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white tracking-tight">
                            Description & Informations sur le site
                          </h2>
                        </div>
                      </div>

                      <div className="text-xs sm:text-sm text-stone-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                        {selectedSiteForDetail.description && selectedSiteForDetail.description.trim() !== ''
                          ? selectedSiteForDetail.description
                          : `Découvrez et utilisez ${selectedSiteForDetail.name} directement au sein de votre espace StudyCloud.`}
                      </div>

                      {/* Fiche signalétique épurée */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-stone-200 dark:border-slate-800">
                        <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090f1d] border border-stone-300 dark:border-slate-700">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500">Catégorie</div>
                          <div className="text-xs font-extrabold text-stone-800 dark:text-white mt-0.5 truncate">
                            📁 {selectedSiteForDetail.category_name || 'Général'}
                          </div>
                        </div>
                        <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090f1d] border border-stone-300 dark:border-slate-700">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500">Sous-catégorie</div>
                          <div className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                            🏷️ {selectedSiteForDetail.subcategory_name || 'Standard'}
                          </div>
                        </div>
                        <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090f1d] border border-stone-300 dark:border-slate-700">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500">Domaine source</div>
                          <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                            {detailDomain}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* COLONNE LATÉRALE (4/12) : SITES & APPLICATIONS SIMILAIRES */}
                  <div className="lg:col-span-4 rounded-3xl border-2 border-stone-300 dark:border-slate-700 bg-white dark:bg-[#0c1323] p-4 sm:p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2.5">
                      <div>
                        <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                          <span>🧭</span>
                          <span>Sites similaires</span>
                        </h2>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          Autres ressources dans cette thématique
                        </p>
                      </div>
                    </div>

                    {similarSites.length === 0 ? (
                      <div className="py-8 text-center text-xs text-stone-500 dark:text-slate-400">
                        Aucun autre site similaire enregistré pour le moment.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {similarSites.map((simSite) => {
                          const simDomain = getDomainFromUrl(simSite.url);
                          const simLogo = (simSite.logo_url && simSite.logo_url.trim() !== '')
                            ? simSite.logo_url
                            : `https://www.google.com/s2/favicons?domain=${simDomain}&sz=128`;

                          return (
                            <div
                              key={simSite.id}
                              onClick={() => handleSelectSiteDetail(simSite)}
                              className="group p-2.5 rounded-2xl bg-stone-50 hover:bg-blue-50/60 dark:bg-[#090f1d] dark:hover:bg-[#111c35] border border-stone-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 flex items-center gap-3 transition-all cursor-pointer active:scale-[0.99]"
                            >
                              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#111a2e] border border-stone-300 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                <img
                                  src={simLogo}
                                  alt={simSite.name}
                                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    if (!img.dataset.fallbackTried) {
                                      img.dataset.fallbackTried = '1';
                                      img.src = `https://www.google.com/s2/favicons?domain=${simDomain}&sz=128`;
                                      img.className = 'w-8 h-8 object-contain';
                                    }
                                  }}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {simSite.name}
                                </h4>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="text-[10px] font-semibold text-stone-500 dark:text-slate-400 truncate">
                                    {simSite.subcategory_name || simSite.category_name || simDomain}
                                  </span>
                                </div>
                                {simSite.description && (
                                  <p className="text-[10px] text-stone-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                                    {simSite.description}
                                  </p>
                                )}
                              </div>

                              <span className="text-xs font-black text-stone-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 pr-1">
                                →
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* Ligne horizontale de sites recommandés en bas de la fiche de présentation */}
                {renderRecommendedHorizontalLine('detail-bottom')}
              </div>

              {/* VISIONNEUSE PLEIN ÉCRAN (LIGHTBOX) POUR AGRANDIR UNE IMAGE PUBLICITAIRE */}
              {lightboxImageUrl && (
                <div
                  onClick={() => setLightboxImageUrl(null)}
                  className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxImageUrl(null)}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/20 cursor-pointer"
                    title="Fermer l'aperçu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <img
                    src={lightboxImageUrl}
                    alt="Aperçu plein écran"
                    onClick={(e) => e.stopPropagation()}
                    className="max-w-full max-h-[88vh] object-contain rounded-2xl border-2 border-white/20 shadow-2xl"
                  />
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* 3. MODE CATALOGUE DKD STORE (Catégories D1 en haut à gauche, Sites)  */
        /* ==================================================================== */
        <div className="flex-1 w-full overflow-y-auto px-3 sm:px-5 md:px-6 py-2.5 sm:py-3.5 relative min-h-0 flex flex-col items-start justify-start">
          <div className="w-full flex flex-col items-start space-y-3 sm:space-y-3.5">

            {/* 3.1 BARRE HORIZONTALE DES CATÉGORIES (Commence en haut à gauche sous l'en-tête) */}
            <div className="w-full flex items-center justify-start gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
              {/* Bouton "Tout" (affiche l'ensemble des sites) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setSelectedSubcategoryId('all');
                  setShowOnlyPinned(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${selectedCategoryId === 'all' && !showOnlyPinned
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] dark:hover:bg-[#17233f] text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                  }`}
              >
                <span>✨</span>
                <span>Tout</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryId === 'all' && !showOnlyPinned
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}>
                  {sites.length}
                </span>
              </button>

              {/* Bouton "Mes favoris" (si l'utilisateur a des sites épinglés) */}
              {pinnedSiteIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOnlyPinned(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${showOnlyPinned
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-500/30'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] dark:hover:bg-[#17233f] text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                    }`}
                >
                  <span>⭐</span>
                  <span>Mes favoris</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${showOnlyPinned
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}>
                    {pinnedSiteIds.length}
                  </span>
                </button>
              )}

              {/* Catégories créées et chargées depuis la base D1 */}
              {categories.map((cat) => {
                const countInCat = sites.filter(s =>
                  String(s.category_id) === String(cat.id) ||
                  String(s.category_name).toLowerCase() === String(cat.name).toLowerCase()
                ).length;
                const isSelected = selectedCategoryId === cat.id && !showOnlyPinned;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedSubcategoryId('all');
                      setShowOnlyPinned(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                        : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] dark:hover:bg-[#17233f] text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                      }`}
                  >
                    <span>{cat.icon || '📁'}</span>
                    <span>{cat.name}</span>
                    {countInCat > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                        }`}>
                        {countInCat}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Bascule de mode d'affichage : Rayons (Carrousels) vs Grille */}
              <div className="flex items-center gap-1 ml-auto shrink-0 pl-1">
                <button
                  type="button"
                  onClick={() => setViewMode('shelves')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'shelves'
                      ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-400'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                  }`}
                  title="Affichage par rayons horizontaux (style Google Play)"
                >
                  <Rows className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Rayons</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-400'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                  }`}
                  title="Affichage en grille complète"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Grille</span>
                </button>
              </div>
            </div>

            {/* 3.1.B SOUS-CATÉGORIES DYNAMIQUES (Rattachées à la catégorie sélectionnée) */}
            {currentCategorySubcategories.length > 0 && (
              <div className="w-full flex items-center justify-start gap-1.5 overflow-x-auto no-scrollbar py-1 scroll-smooth">
                <span className="text-[10px] font-black uppercase text-stone-400 dark:text-slate-500 tracking-wider shrink-0 flex items-center gap-1 mr-1">
                  <span>🏷️</span>
                  <span>Sous-catégories :</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSubcategoryId('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    selectedSubcategoryId === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                  }`}
                >
                  Toutes
                </button>
                {currentCategorySubcategories.map((subcat) => {
                  const isSel = selectedSubcategoryId === subcat.id;
                  const countInSub = sites.filter(s =>
                    (String(s.category_id) === String(selectedCategoryId) || String(s.category_name).toLowerCase() === String(selectedCategoryId).toLowerCase()) &&
                    (String(s.subcategory_id) === String(subcat.id) || String(s.subcategory_name).toLowerCase() === String(subcat.name).toLowerCase())
                  ).length;
                  return (
                    <button
                      key={subcat.id}
                      type="button"
                      onClick={() => setSelectedSubcategoryId(subcat.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                        isSel
                          ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-400'
                          : 'bg-stone-100 hover:bg-stone-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-slate-700'
                      }`}
                    >
                      <span>{subcat.icon || '🏷️'}</span>
                      <span>{subcat.name}</span>
                      {countInSub > 0 && (
                        <span className={`text-[9px] px-1 py-0.1 rounded-full ${isSel ? 'bg-white/20 text-white' : 'bg-stone-200 dark:bg-slate-800 text-stone-500 dark:text-stone-400 font-mono'}`}>
                          {countInSub}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3.2 CONTENU DU CATALOGUE DES SITES ENREGISTRÉS */}
            <div className="w-full pt-1">
              {/* ÉTAT CHARGEMENT */}
              {isLoading && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 w-full">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="flex flex-col items-start w-full animate-pulse space-y-2">
                      <div className="w-full aspect-square rounded-2xl sm:rounded-3xl bg-stone-200 dark:bg-slate-800"></div>
                      <div className="h-3.5 bg-stone-200 dark:bg-slate-800 rounded-md w-3/4"></div>
                      <div className="h-2.5 bg-stone-200 dark:bg-slate-800 rounded-md w-1/2"></div>
                    </div>
                  ))}
                </div>
              )}

              {/* ÉTAT ERREUR DE CHARGEMENT */}
              {!isLoading && fetchError && sites.length === 0 && (
                <div className="p-8 text-center max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                    Connexion temporairement indisponible
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {fetchError}
                  </p>
                  <button
                    onClick={() => loadStoreData(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {/* ÉTAT LISTE VIDE */}
              {!isLoading && filteredSites.length === 0 && (
                <div className="w-full space-y-4">
                  <div className="p-6 sm:p-8 text-left max-w-md space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-center text-xl shadow-inner">
                      🔍
                    </div>
                    <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                      {searchQuery ? `Aucune application trouvée pour "${searchQuery}"` : "Aucune application dans cette catégorie"}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {searchQuery
                        ? "Essayez d'autres mots-clés ou consultez l'ensemble des catégories."
                        : "Les nouvelles applications ajoutées depuis le tableau de bord apparaîtront ici automatiquement."}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Effacer la recherche
                      </button>
                    )}
                  </div>
                  {/* Même sans résultat exact, afficher la ligne horizontale de sites recommandés */}
                  {renderRecommendedHorizontalLine('empty-state')}
                </div>
              )}

              {/* AFFICHAGE DES APPLICATIONS (Style Google Play Store : Grand icône squircle bien visible) */}
              {!isLoading && filteredSites.length > 0 && (
                <>
                  {/* CAS 1 : VUE RAYONS HORIZONTAUX PAR CATÉGORIE (Comme sur vos images 1 et 2) */}
                  {selectedCategoryId === 'all' && selectedSubcategoryId === 'all' && !searchQuery.trim() && !showOnlyPinned && viewMode === 'shelves' && categoriesWithSites.length > 0 ? (
                    (() => {
                      const step = Math.max(1, recommendedIntervalSites);
                      let cumulativeSites = 0;
                      let nextThreshold = step;
                      let insertedRecCount = 0;

                      return (
                        <div className="w-full space-y-6">
                          {/* Section pour chaque catégorie contenant des applications */}
                          {categoriesWithSites.map(({ category, sites: catSites }, catIdx) => {
                            cumulativeSites += catSites.length;
                            const shouldInsertRecAfter = cumulativeSites >= nextThreshold;
                            if (shouldInsertRecAfter) {
                              insertedRecCount++;
                              nextThreshold = cumulativeSites + step;
                            }

                            return (
                              <React.Fragment key={category.id}>
                                <div className="w-full">
                                  {/* En-tête de rayon style Google Play */}
                                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                                    <div>
                                      <h3 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                        <span>{category.icon || '📁'}</span>
                                        <span>{category.name}</span>
                                      </h3>
                                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                        {catSites.length} application{catSites.length > 1 ? 's' : ''} disponible{catSites.length > 1 ? 's' : ''}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCategoryId(category.id);
                                        setSelectedSubcategoryId('all');
                                      }}
                                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                    >
                                      <span>Voir tout</span>
                                      <span>→</span>
                                    </button>
                                  </div>

                                  {/* Rangée défilable d'icônes d'applications (Image 1 & 2) */}
                                  <div className="flex items-start gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar py-1.5 scroll-smooth">
                                    {catSites.map((site) => (
                                      <DkdAppTile
                                        key={site.id}
                                        site={site}
                                        isPinned={pinnedSiteIds.includes(site.id)}
                                        onOpen={handleSelectSiteDetail}
                                        onTogglePin={togglePinSite}
                                        getDomainFromUrl={getDomainFromUrl}
                                        className="w-[100px] sm:w-[120px] md:w-[135px] shrink-0"
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Insertion de la ligne horizontale de Recommandés tous les N sites vus */}
                                {shouldInsertRecAfter && renderRecommendedHorizontalLine(`shelf-${catIdx}`)}
                              </React.Fragment>
                            );
                          })}

                          {/* Applications sans catégorie (s'il y en a) */}
                          {uncategorizedSites.length > 0 && (
                            <div className="w-full pt-2">
                              <div className="flex items-center justify-between mb-2.5 px-0.5">
                                <div>
                                  <h3 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <span>✨</span>
                                    <span>Autres applications</span>
                                  </h3>
                                  <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                    {uncategorizedSites.length} application{uncategorizedSites.length > 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar py-1.5 scroll-smooth">
                                {uncategorizedSites.map((site) => (
                                  <DkdAppTile
                                    key={site.id}
                                    site={site}
                                    isPinned={pinnedSiteIds.includes(site.id)}
                                    onOpen={handleSelectSiteDetail}
                                    onTogglePin={togglePinSite}
                                    getDomainFromUrl={getDomainFromUrl}
                                    className="w-[100px] sm:w-[120px] md:w-[135px] shrink-0"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Si le nombre total de sites était inférieur au seuil, afficher tout de même la ligne de recommandés */}
                          {insertedRecCount === 0 && renderRecommendedHorizontalLine('shelf-fallback')}
                        </div>
                      );
                    })()
                  ) : (
                    /* CAS 2 : VUE GRILLE COMPLÈTE / RECHERCHE / FILTRE CATÉGORIE (Avec ligne de Recommandés tous les N sites) */
                    (() => {
                      const chunkSize = Math.max(1, recommendedIntervalSites);
                      const siteChunks: DkdStoreSite[][] = [];
                      for (let i = 0; i < filteredSites.length; i += chunkSize) {
                        siteChunks.push(filteredSites.slice(i, i + chunkSize));
                      }

                      return (
                        <div className="w-full">
                          {/* En-tête indicatif */}
                          <div className="flex items-center justify-between mb-3 px-0.5">
                            <div>
                              <h3 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                {searchQuery ? (
                                  <>
                                    <span>🔍</span>
                                    <span>Résultats pour "{searchQuery}"</span>
                                  </>
                                ) : showOnlyPinned ? (
                                  <>
                                    <span>⭐</span>
                                    <span>Mes applications favorites</span>
                                  </>
                                ) : selectedCategoryId !== 'all' ? (
                                  <>
                                    <span>📁</span>
                                    <span>
                                      {categories.find(c => String(c.id) === String(selectedCategoryId))?.name || selectedCategoryId}
                                      {selectedSubcategoryId !== 'all' && (
                                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 ml-2">
                                          › {subcategories.find(sc => String(sc.id) === String(selectedSubcategoryId))?.name || selectedSubcategoryId}
                                        </span>
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span>✨</span>
                                    <span>Toutes les applications</span>
                                  </>
                                )}
                              </h3>
                              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                {filteredSites.length} application{filteredSites.length > 1 ? 's' : ''} disponible{filteredSites.length > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Grille Play Store découpée par paliers de N sites avec ligne horizontale de Recommandés intercalée */}
                          <div className="w-full space-y-5">
                            {siteChunks.map((chunk, chunkIdx) => (
                              <React.Fragment key={`chunk-${chunkIdx}`}>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4 md:gap-5 w-full">
                                  {chunk.map((site) => (
                                    <DkdAppTile
                                      key={site.id}
                                      site={site}
                                      isPinned={pinnedSiteIds.includes(site.id)}
                                      onOpen={handleSelectSiteDetail}
                                      onTogglePin={togglePinSite}
                                      getDomainFromUrl={getDomainFromUrl}
                                      className="w-full"
                                    />
                                  ))}
                                </div>
                                {/* Ligne horizontale unique défilable de sites recommandés après chaque groupe de N sites */}
                                {renderRecommendedHorizontalLine(`grid-chunk-${chunkIdx}`)}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
