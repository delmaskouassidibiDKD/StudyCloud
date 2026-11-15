import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Globe, 
  ExternalLink, 
  Sparkles, 
  X, 
  Plus, 
  Star, 
  Layers, 
  Cpu, 
  Zap, 
  Calculator, 
  BookOpen, 
  Wrench, 
  Compass, 
  Check, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { DkdStore3DIcon } from './DkdStore3DIcon';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../utils/viewerExpandManager';

interface DkdStoreViewProps {
  onBack: () => void;
}

export interface StoreItem {
  id: string;
  name: string;
  category: 'ia' | 'sciences' | 'cme' | 'maths' | 'outils' | 'savoirs';
  description: string;
  url: string;
  badge?: string;
  iconBg: string;
  iconText: string;
  isPopular?: boolean;
}

// Catalogue des pépites web éducatives et techniques sélectionnées
const INITIAL_STORE_ITEMS: StoreItem[] = [
  {
    id: 'phet-simulations',
    name: 'PhET Simulations Sciences',
    category: 'sciences',
    description: 'Simulations interactives 100% visuelles pour la physique, la chimie et les circuits électriques.',
    url: 'https://phet.colorado.edu/fr/simulations/filter?type=html',
    badge: 'Essentiel CME',
    iconBg: 'from-amber-500 to-orange-600',
    iconText: 'PhET',
    isPopular: true
  },
  {
    id: 'falstad-circuit',
    name: 'Falstad Simulateur de Circuits',
    category: 'cme',
    description: 'Simulateur en temps réel de circuits électriques, oscilloscopes, filtres RLC et composants actifs.',
    url: 'https://www.falstad.com/circuit/circuitjs.html',
    badge: 'Électrotechnique',
    iconBg: 'from-blue-600 to-cyan-600',
    iconText: '⚡',
    isPopular: true
  },
  {
    id: 'desmos-calculator',
    name: 'Desmos Calculatrice Graphique',
    category: 'maths',
    description: 'Traceur de courbes mathématiques, tableaux de valeurs et analyse de fonctions en direct.',
    url: 'https://www.desmos.com/calculator?lang=fr',
    badge: 'Maths Pro',
    iconBg: 'from-emerald-500 to-teal-600',
    iconText: 'f(x)',
    isPopular: true
  },
  {
    id: 'circuit-verse',
    name: 'CircuitVerse Logique Numérique',
    category: 'cme',
    description: 'Conception et simulation de circuits logiques numériques, portes logiques et micro-systèmes.',
    url: 'https://circuitverse.org/simulator',
    badge: 'Électronique',
    iconBg: 'from-indigo-600 to-purple-600',
    iconText: 'AND',
    isPopular: false
  },
  {
    id: 'geogebra-suite',
    name: 'GeoGebra Mathématiques 3D',
    category: 'maths',
    description: 'Géométrie dans l\'espace, algèbre, statistiques et graphiques 3D interactifs.',
    url: 'https://www.geogebra.org/calculator',
    badge: 'Géométrie 3D',
    iconBg: 'from-sky-500 to-blue-600',
    iconText: 'Geo',
    isPopular: true
  },
  {
    id: 'excalidraw-board',
    name: 'Excalidraw Schémas & Croquis',
    category: 'outils',
    description: 'Tableau blanc virtuel pour dessiner rapidement des schémas techniques, diagrammes et croquis de cours.',
    url: 'https://excalidraw.com/',
    badge: 'Création',
    iconBg: 'from-purple-500 to-pink-600',
    iconText: '✏️',
    isPopular: true
  },
  {
    id: 'cyberchef-swiss',
    name: 'CyberChef Couteau Suisse',
    category: 'outils',
    description: 'Boîte à outils universelle pour convertir, encoder, décoder, hacher et manipuler tout type de données.',
    url: 'https://gchq.github.io/CyberChef/',
    badge: 'Utilitaires',
    iconBg: 'from-rose-600 to-red-600',
    iconText: 'Chef',
    isPopular: false
  },
  {
    id: 'wikipedia-encyclo',
    name: 'Wikipédia Savoirs Libres',
    category: 'savoirs',
    description: 'L\'encyclopédie libre de référence pour toutes les définitions, formules et cours détaillés.',
    url: 'https://fr.m.wikipedia.org',
    badge: 'Encyclopédie',
    iconBg: 'from-slate-600 to-stone-800',
    iconText: 'W',
    isPopular: true
  },
  {
    id: 'tinypng-compress',
    name: 'TinyPNG Compresseur',
    category: 'outils',
    description: 'Optimisez et compressez vos images Web, PNG et JPEG sans perte de netteté.',
    url: 'https://tinypng.com/',
    badge: 'Médias',
    iconBg: 'from-emerald-600 to-green-700',
    iconText: 'Panda',
    isPopular: false
  }
];

export const DkdStoreView: React.FC<DkdStoreViewProps> = ({ onBack }) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Site actif ouvert dans le lecteur intégré de StudyCloud (ne sort pas de l'application)
  const [activeSite, setActiveSite] = useState<StoreItem | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);

  // Liste des pépites avec stockage local pour les ajouts personnalisés
  const [storeItems, setStoreItems] = useState<StoreItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_dkd_store_custom_apps');
      if (saved) {
        const custom = JSON.parse(saved);
        if (Array.isArray(custom)) {
          return [...INITIAL_STORE_ITEMS, ...custom];
        }
      }
    } catch {}
    return INITIAL_STORE_ITEMS;
  });

  // Modale pour ajouter une nouvelle pépite
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [newSiteCategory, setNewSiteCategory] = useState<'ia' | 'sciences' | 'cme' | 'maths' | 'outils' | 'savoirs'>('outils');

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      resetViewerExpand();
    };
  }, []);

  // Gestion de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSite) {
          setActiveSite(null);
        } else if (showAddModal) {
          setShowAddModal(false);
        } else if (viewerExpandLevel >= 1) {
          resetViewerExpand();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSite, showAddModal, viewerExpandLevel]);

  // Filtrage en temps réel via le champ de recherche
  const filteredItems = useMemo(() => {
    return storeItems.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [storeItems, selectedCategory, searchQuery]);

  // Ajouter une pépite personnalisée
  const handleAddNewSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim() || !newSiteUrl.trim()) return;

    let finalUrl = newSiteUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const newItem: StoreItem = {
      id: `custom-${Date.now()}`,
      name: newSiteName.trim(),
      url: finalUrl,
      description: newSiteDesc.trim() || 'Pépite web personnalisée ajoutée à votre DKD store.',
      category: newSiteCategory,
      badge: 'Ajout perso',
      iconBg: 'from-blue-600 to-indigo-600',
      iconText: newSiteName.trim().substring(0, 3).toUpperCase()
    };

    const updated = [newItem, ...storeItems];
    setStoreItems(updated);

    try {
      const existingCustom = JSON.parse(localStorage.getItem('studycloud_dkd_store_custom_apps') || '[]');
      existingCustom.unshift(newItem);
      localStorage.setItem('studycloud_dkd_store_custom_apps', JSON.stringify(existingCustom));
    } catch {}

    setNewSiteName('');
    setNewSiteUrl('');
    setNewSiteDesc('');
    setShowAddModal(false);
  };

  const handleOpenSite = (site: StoreItem) => {
    setIsLoadingIframe(true);
    setActiveSite(site);
    setIframeKey((prev) => prev + 1);
  };

  const handleBack = () => {
    if (activeSite) {
      setActiveSite(null);
    } else {
      resetViewerExpand();
      onBack();
    }
  };

  const categories = [
    { id: 'all', label: 'Toutes les pépites', icon: Sparkles },
    { id: 'sciences', label: 'Sciences & Physique', icon: Zap },
    { id: 'cme', label: 'Électrotechnique & CME', icon: Cpu },
    { id: 'maths', label: 'Mathématiques', icon: Calculator },
    { id: 'outils', label: 'Outils & Utilitaires', icon: Wrench },
    { id: 'savoirs', label: 'Savoirs & Livres', icon: BookOpen }
  ];

  return (
    <div
      className={`w-full flex-1 flex flex-col bg-[#070b14] text-[#f1f5f9] transition-all duration-300 overflow-hidden ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : viewerExpandLevel === 1
            ? 'relative w-full h-dvh min-h-dvh'
            : 'relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'
      }`}
    >
      {/* 1. BARRE SUPÉRIEURE (Une seule ligne sur Mobile et PC) */}
      <div className="w-full h-11 sm:h-12 flex items-center justify-between px-2.5 sm:px-4 bg-[#0d1424] border-b border-white/10 shrink-0 z-30 shadow-md select-none">
        {/* Partie gauche : Bouton retour + Titre DKD store aux couleurs Google Play */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-800/90 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border border-stone-700/80 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title={activeSite ? "Revenir au DKD store" : "Retour à l'accueil"}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="leading-none">{activeSite ? "Store" : "Retour"}</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-stone-900 border border-stone-800/80 shadow-2xs shrink-0">
            <DkdStore3DIcon className="w-5 h-5 shrink-0" />
            {/* Nom avec les 4 couleurs Play Store / Google : Bleu, Rouge, Jaune, Vert */}
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold border border-blue-500/25 hidden sm:inline truncate max-w-[140px]">
                {activeSite.name}
              </span>
            )}
          </div>
        </div>

        {/* Partie droite : Ajouter une pépite + Rafraîchir + Boutons Agrandir */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!activeSite && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
              title="Ajouter un site ou une pépite dans le store"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Ajouter</span>
            </button>
          )}

          {activeSite && (
            <a
              href={activeSite.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-800/90 hover:bg-stone-700 text-stone-300 flex items-center justify-center border border-stone-700 transition-colors"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            </a>
          )}

          {/* Bouton Rafraîchir */}
          <button
            onClick={() => {
              if (activeSite) {
                setIsLoadingIframe(true);
                setIframeKey((prev) => prev + 1);
              }
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-800/90 hover:bg-stone-700 text-stone-300 flex items-center justify-center border border-stone-700 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIframe && activeSite ? 'animate-spin text-[#ff4801]' : ''}`} />
          </button>

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
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
              viewerExpandLevel >= 1
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/40'
                : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
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

      {/* 2. CONTENU PRINCIPAL */}
      {activeSite ? (
        /* VUE DU SITE INTÉGRÉ DANS STUDYCLOUD (NE SORT PAS DE L'APPLICATION) */
        <div className="flex-1 w-full overflow-hidden flex flex-col relative bg-[#040711] min-h-0">
          {isLoadingIframe && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060a14]/90 backdrop-blur-xs pointer-events-none transition-opacity duration-300">
              <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                <DkdStore3DIcon className="w-12 h-12" />
                <div className="flex items-center gap-2 text-stone-300 text-xs font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#ff4801]" />
                  <span>Chargement de {activeSite.name} dans StudyCloud...</span>
                </div>
              </div>
            </div>
          )}

          <div className="w-full h-full flex flex-col relative flex-1 min-h-0">
            <iframe
              key={iframeKey}
              src={activeSite.url}
              title={activeSite.name}
              onLoad={() => setIsLoadingIframe(false)}
              className="w-full h-full flex-1 border-0"
              allow="clipboard-read; clipboard-write; camera; microphone; fullscreen; payment"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            />
          </div>
        </div>
      ) : (
        /* VUE DU CATALOGUE DU DKD STORE (PLAY STORE STYLE) */
        <div className="flex-1 w-full overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 relative min-h-0">
          <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
            {/* Bannière d'en-tête du Store */}
            <div className="relative rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#0e172a] via-[#131d36] to-[#0a101f] border border-white/10 shadow-2xl overflow-hidden text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-extrabold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kiosque de ressources & pépites Web</span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                  <span className="text-[#4285F4]">D</span>
                  <span className="text-[#EA4335]">K</span>
                  <span className="text-[#FBBC05]">D</span>{' '}
                  <span className="text-[#34A853]">s</span>
                  <span className="text-[#4285F4]">t</span>
                  <span className="text-[#EA4335]">o</span>
                  <span className="text-[#FBBC05]">r</span>
                  <span className="text-[#34A853]">e</span>
                </h1>

                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
                  Accédez aux meilleures pépites du web, simulateurs scientifiques, calculatrices et outils de cours, directement intégrés <strong>sans jamais quitter StudyCloud</strong>.
                </p>
              </div>

              <div className="shrink-0 p-3 rounded-2xl bg-black/40 border border-white/10 shadow-inner">
                <DkdStore3DIcon className="w-20 h-20 sm:w-24 sm:h-24" />
              </div>
            </div>

            {/* CHAMP DE RECHERCHE DU STORE (Conservé selon demande) */}
            <div className="w-full relative max-w-2xl mx-auto">
              <div className="relative flex items-center w-full bg-[#111a2f] hover:bg-[#14203b] focus-within:bg-[#14203b] border-2 border-stone-700/80 focus-within:border-blue-500 rounded-2xl shadow-xl transition-all overflow-hidden p-1.5 sm:p-2">
                <Search className="w-5 h-5 text-blue-400 ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une pépite, un simulateur, un cours..."
                  className="w-full bg-transparent border-0 px-3 py-2 text-stone-100 placeholder:text-stone-500 text-sm sm:text-base focus:outline-hidden font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1.5 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* FILTRES PAR CATÉGORIES (PILLS DE CATÉGORIES PLAY STORE) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
              {categories.map((cat) => {
                const IconComp = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 ring-1 ring-blue-400'
                        : 'bg-[#0f172a] hover:bg-[#152038] text-stone-300 hover:text-white border border-stone-800'
                    }`}
                  >
                    <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-cyan-400'}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* GRILLE DES PÉPITES DU STORE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 pt-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenSite(item)}
                  className="group relative bg-[#0d1424] hover:bg-[#121c33] border-2 border-stone-800/90 hover:border-blue-500/70 rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer active:scale-[0.99]"
                >
                  <div className="space-y-3">
                    {/* Header de la carte : Icône + Titre + Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.iconBg} flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-105 transition-transform shrink-0`}
                        >
                          {item.iconText}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-blue-400 transition-colors truncate">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                            <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">{new URL(item.url).hostname}</span>
                          </div>
                        </div>
                      </div>

                      {item.badge && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[10px] font-black shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Description de la pépite */}
                    <p className="text-xs text-stone-300 leading-relaxed font-normal line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Bouton d'action "Ouvrir dans StudyCloud" */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Intégré dans l'app
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSite(item);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <span>Lancer</span>
                      <ArrowLeft className="w-3 h-3 rotate-180" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="py-16 text-center text-stone-400 bg-stone-900/40 rounded-3xl border border-white/5 p-6 space-y-3">
                <Search className="w-10 h-10 mx-auto text-stone-600" />
                <p className="font-bold text-sm text-stone-300">Aucune pépite ne correspond à « {searchQuery} ».</p>
                <p className="text-xs text-stone-500">
                  Vous pouvez ajouter ce site vous-même en cliquant sur le bouton « Ajouter » en haut à droite !
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MODALE : AJOUTER UNE NOUVELLE PÉPITE DANS LE DKD STORE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border-2 border-stone-700 rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <DkdStore3DIcon className="w-6 h-6" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">Ajouter une pépite Web</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewSite} className="space-y-3.5 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-bold text-stone-200 block">Nom du site ou de la ressource :</label>
                <input
                  type="text"
                  required
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="Ex : PhET, Desmos, Simulateur..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-200 block">Adresse URL du site :</label>
                <input
                  type="text"
                  required
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  placeholder="https://exemple.com"
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs focus:outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-200 block">Catégorie :</label>
                <select
                  value={newSiteCategory}
                  onChange={(e) => setNewSiteCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                >
                  <option value="sciences">Sciences & Physique</option>
                  <option value="cme">Électrotechnique & CME</option>
                  <option value="maths">Mathématiques</option>
                  <option value="ia">IA & Assistants</option>
                  <option value="outils">Outils & Utilitaires</option>
                  <option value="savoirs">Savoirs & Livres</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-200 block">Petite description :</label>
                <textarea
                  rows={2}
                  value={newSiteDesc}
                  onChange={(e) => setNewSiteDesc(e.target.value)}
                  placeholder="Pourquoi ce site est utile pour les études..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs focus:outline-hidden focus:border-blue-500 resize-none font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Ajouter au Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

