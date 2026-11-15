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
  AlertCircle
} from 'lucide-react';
import { DkdStore3DIcon } from './DkdStore3DIcon';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../utils/viewerExpandManager';
import { 
  getDkdStorePublicData, 
  DkdStoreSite, 
  DkdStoreCategory 
} from '../services/api';

interface DkdStoreViewProps {
  onBack: () => void;
}

export const DkdStoreView: React.FC<DkdStoreViewProps> = ({ onBack }) => {
  // 1. ÉTAT DES DONNÉES D1 & CHARGEMENT
  const [sites, setSites] = useState<DkdStoreSite[]>([]);
  const [categories, setCategories] = useState<DkdStoreCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 2. FILTRES & RECHERCHE
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showOnlyPinned, setShowOnlyPinned] = useState<boolean>(false);

  // 3. SITES ÉPINGLÉS / FAVORIS (Persistance Locale)
  const [pinnedSiteIds, setPinnedSiteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_pinned_dkd_sites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 4. SITE ACTIF OUVERT DANS L'APPLICATION (Vision intégrée sans sortir de StudyCloud)
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
        if (viewerExpandLevel >= 1) {
          resetViewerExpand();
        } else if (activeSite) {
          setActiveSite(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerExpandLevel, activeSite]);

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
    } catch {}

    if (isPinned) {
      showToast(`Site "${site.name}" retiré de vos raccourcis.`);
    } else {
      showToast(`⭐ "${site.name}" épinglé à vos raccourcis !`);
    }
  };

  // Filtrage des sites selon recherche, catégorie et favoris
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

      // Filtre de recherche
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = (site.name || '').toLowerCase().includes(q);
        const inDesc = (site.description || '').toLowerCase().includes(q);
        const inUrl = (site.url || '').toLowerCase().includes(q);
        const inBadge = (site.badge || '').toLowerCase().includes(q);
        const inCat = (site.category_name || '').toLowerCase().includes(q);
        return inName || inDesc || inUrl || inBadge || inCat;
      }

      return true;
    });
  }, [sites, searchQuery, selectedCategoryId, showOnlyPinned, pinnedSiteIds]);

  // Extraction propre du nom de domaine pour affichage
  const getDomainFromUrl = (url: string) => {
    try {
      const u = new URL(url.includes('://') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  // Helper pour l'ouverture d'un site
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
      className={`w-full flex-1 flex flex-col bg-white dark:bg-[#070b14] text-stone-900 dark:text-[#f1f5f9] transition-colors duration-300 overflow-hidden ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : viewerExpandLevel === 1
            ? 'relative w-full h-dvh min-h-dvh'
            : 'relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'
      }`}
    >
      {/* ====================================================================== */}
      {/* 1. BARRE SUPÉRIEURE (Une seule ligne sur Mobile et PC)                   */}
      {/* ====================================================================== */}
      <div className="w-full h-11 sm:h-12 flex items-center justify-between px-2.5 sm:px-4 bg-white/95 dark:bg-[#0d1424] border-b border-stone-200 dark:border-white/10 shrink-0 z-30 shadow-xs select-none backdrop-blur-md">
        {/* Partie gauche : Bouton retour + Titre DKD store ou Site Actif */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            onClick={() => {
              if (activeSite) {
                setActiveSite(null);
              } else {
                onBack();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/90 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl border border-stone-300 dark:border-stone-700/80 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title={activeSite ? "Retour au catalogue DKD store" : "Retour à l'accueil"}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="leading-none">{activeSite ? "Catalogue" : "Retour"}</span>
          </button>

          {/* Logo et Nom : DKD store aux couleurs Google Play */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800/80 shadow-2xs shrink-0 max-w-[200px] sm:max-w-none truncate">
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
            {activeSite && (
              <span className="hidden sm:inline-block text-xs font-semibold text-stone-500 dark:text-stone-400 border-l border-stone-300 dark:border-stone-700 pl-2 ml-1 truncate">
                {activeSite.name}
              </span>
            )}
          </div>
        </div>

        {/* Partie droite : Actions, Actualiser, Super Agrandissement & Zoom */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeSite ? (
            <>
              {/* Actualiser le site actif */}
              <button
                type="button"
                onClick={handleReloadIframe}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700"
                title="Recharger la page"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin text-blue-500' : ''}`} />
              </button>

              {/* Épingler à l'accueil / Raccourcis */}
              <button
                type="button"
                onClick={(e) => togglePinSite(activeSite, e)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 ${
                  pinnedSiteIds.includes(activeSite.id)
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/40 ring-1 ring-amber-500/30'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700'
                }`}
                title={pinnedSiteIds.includes(activeSite.id) ? "Retirer des raccourcis" : "Épingler aux raccourcis"}
              >
                <Bookmark className={`w-3.5 h-3.5 ${pinnedSiteIds.includes(activeSite.id) ? 'fill-current' : ''}`} />
              </button>

              {/* Ouvrir dans un nouvel onglet externe */}
              <a
                href={activeSite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700"
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
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 dark:border-stone-700"
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
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${
              viewerExpandLevel >= 1
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
      {/* 2. MODE SITE ACTIF OUVERT (Vision dans l'application sans sortir)        */}
      {/* ====================================================================== */}
      {activeSite ? (
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
            allow="camera; microphone; fullscreen; clipboard-read; clipboard-write;"
          />

          {/* Barre inférieure discrète pour dépannage iframe */}
          <div className="w-full py-1.5 px-3 bg-stone-100 dark:bg-[#0d1424] border-t border-stone-200 dark:border-white/10 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 shrink-0">
            <span className="truncate">
              ⚡ Connecté via StudyCloud · {getDomainFromUrl(activeSite.url)}
            </span>
            <a
              href={activeSite.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold shrink-0 ml-2"
            >
              <span>Si la page reste blanche, ouvrir ici</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* 3. MODE CATALOGUE DKD STORE (Recherche, Catégories D1 et Pépites)     */
        /* ==================================================================== */
        <div className="flex-1 w-full overflow-y-auto px-3.5 sm:px-6 md:px-8 py-5 sm:py-7 relative min-h-0 flex flex-col items-center">
          <div className="w-full max-w-5xl flex flex-col items-center space-y-4 sm:space-y-6">
            
            {/* 3.1 CHAMP DE RECHERCHE PRINCIPAL */}
            <div className="w-full relative max-w-2xl mx-auto">
              <div className="relative flex items-center w-full bg-stone-50 hover:bg-stone-100/90 focus-within:bg-white dark:bg-[#111a2f] dark:hover:bg-[#14203b] dark:focus-within:bg-[#14203b] border-2 border-stone-200 dark:border-stone-700/80 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-2xl shadow-xs dark:shadow-xl transition-all overflow-hidden p-1.5 sm:p-2">
                <Search className="w-5 h-5 text-blue-500 dark:text-blue-400 ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une pépite, un simulateur, un cours..."
                  className="w-full bg-transparent border-0 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm sm:text-base focus:outline-hidden font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
                    title="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 3.2 BARRE HORIZONTALE DES CATÉGORIES ENREGISTRÉES DANS D1 */}
            <div className="w-full max-w-4xl flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1 scroll-smooth">
              {/* Bouton "Tout" (affiche l'ensemble des sites) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setShowOnlyPinned(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategoryId === 'all' && !showOnlyPinned
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] dark:hover:bg-[#17233f] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700/70'
                }`}
              >
                <span>✨</span>
                <span>Tout</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategoryId === 'all' && !showOnlyPinned
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    showOnlyPinned
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-500/30'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] dark:hover:bg-[#17233f] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700/70'
                  }`}
                >
                  <span>⭐</span>
                  <span>Mes favoris</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    showOnlyPinned
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
                      setShowOnlyPinned(false);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                        : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#111a2f] dark:hover:bg-[#17233f] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700/70'
                    }`}
                  >
                    <span>{cat.icon || '📁'}</span>
                    <span>{cat.name}</span>
                    {countInCat > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}>
                        {countInCat}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 3.3 CONTENU DU CATALOGUE DES SITES ENREGISTRÉS */}
            <div className="w-full pt-2">
              {/* ÉTAT CHARGEMENT */}
              {isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-3xl bg-stone-100 dark:bg-[#0e1628] border border-stone-200 dark:border-slate-800 animate-pulse space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-stone-200 dark:bg-slate-800"></div>
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 bg-stone-200 dark:bg-slate-800 rounded-sm w-3/4"></div>
                          <div className="h-3 bg-stone-200 dark:bg-slate-800 rounded-sm w-1/2"></div>
                        </div>
                      </div>
                      <div className="h-12 bg-stone-200 dark:bg-slate-800 rounded-xl"></div>
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
                <div className="p-10 text-center max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-center mx-auto text-2xl shadow-inner">
                    🔍
                  </div>
                  <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                    {searchQuery ? `Aucune pépite trouvée pour "${searchQuery}"` : "Aucune application dans cette catégorie"}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {searchQuery 
                      ? "Essayez d'autres mots-clés ou consultez l'ensemble des catégories."
                      : "Les nouvelles pépites et applications ajoutées depuis le tableau de bord apparaîtront ici automatiquement."}
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
              )}

              {/* GRILLE DES CARTES DE SITES / PÉPITES */}
              {!isLoading && filteredSites.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
                  {filteredSites.map((site) => {
                    const isPinned = pinnedSiteIds.includes(site.id);
                    const domain = getDomainFromUrl(site.url);

                    return (
                      <div
                        key={site.id}
                        onClick={() => handleOpenSite(site)}
                        className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-white hover:bg-stone-50/90 dark:bg-[#0e1628] dark:hover:bg-[#121c33] border-2 border-stone-200/80 hover:border-blue-400 dark:border-slate-800 dark:hover:border-blue-500/50 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer select-none"
                      >
                        {/* Haut de la carte : Logo, Nom, Badge et Épinglage */}
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            {/* Logo ou Favicon (avec gestion fallback propre) */}
                            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden">
                              {site.logo_url ? (
                                <img
                                  src={site.logo_url}
                                  alt={site.name}
                                  className="w-full h-full object-contain rounded-xl"
                                  onError={(e) => {
                                    // Fallback favicon Google si le logo direct échoue
                                    const img = e.currentTarget;
                                    if (!img.dataset.fallbackTried) {
                                      img.dataset.fallbackTried = '1';
                                      img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                                    } else {
                                      img.style.display = 'none';
                                      const p = img.parentElement;
                                      if (p) p.innerHTML = '<span class="text-xl">🌐</span>';
                                    }
                                  }}
                                />
                              ) : (
                                <Globe className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                              )}
                            </div>

                            {/* Titre, Catégorie et Badges */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {site.name}
                                </h4>
                                {site.badge && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                    {site.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-stone-400 dark:text-stone-500 font-mono truncate mt-0.5">
                                {domain}
                              </p>
                              {site.category_name && (
                                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 font-semibold border border-stone-200 dark:border-slate-700/60">
                                  {site.category_name}
                                </span>
                              )}
                            </div>

                            {/* Bouton épingler aux raccourcis */}
                            <button
                              type="button"
                              onClick={(e) => togglePinSite(site, e)}
                              className={`p-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                                isPinned
                                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-amber-500 dark:bg-slate-800/80 dark:hover:bg-slate-700 border-stone-200 dark:border-slate-700'
                              }`}
                              title={isPinned ? "Retirer de vos raccourcis" : "Épingler à vos raccourcis"}
                            >
                              <Bookmark className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                            </button>
                          </div>

                          {/* INFORMATIONS & DESCRIPTION DU SITE (Enregistrées dans le tableau de bord) */}
                          <div className="mt-3.5 pt-3 border-t border-stone-100 dark:border-slate-800/80">
                            {site.description ? (
                              <p className="text-xs text-stone-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                                {site.description}
                              </p>
                            ) : (
                              <p className="text-xs text-stone-400 dark:text-stone-500 italic">
                                Accédez à cette ressource directement dans StudyCloud.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pied de la carte : Bouton d'ouverture intégrée */}
                        <div className="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800/60 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Intégré dans StudyCloud</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSite(site);
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs group-hover:shadow-md cursor-pointer active:scale-95"
                          >
                            <span>Ouvrir</span>
                            <span className="text-xs font-black">→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
