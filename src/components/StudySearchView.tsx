import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Search, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Globe, 
  ExternalLink, 
  BookOpen, 
  Sparkles, 
  X, 
  Settings, 
  Check, 
  Compass, 
  Layers, 
  FileText,
  HelpCircle,
  GraduationCap
} from 'lucide-react';
import { StudySearch3DIcon } from './StudySearch3DIcon';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../utils/viewerExpandManager';

interface StudySearchViewProps {
  onBack: () => void;
}

// Identifiant moteur Google Programmable Search mondial par défaut (Recherche tout le Web)
const DEFAULT_GOOGLE_CSE_ID = 'c76bb99249ba943a3';

interface WikiResult {
  title: string;
  snippet: string;
  pageid: number;
}

export const StudySearchView: React.FC<StudySearchViewProps> = ({ onBack }) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'google' | 'wiki' | 'images'>('google');
  const [googleCseId, setGoogleCseId] = useState<string>(() => {
    try {
      return localStorage.getItem('studycloud_google_cse_id') || DEFAULT_GOOGLE_CSE_ID;
    } catch {
      return DEFAULT_GOOGLE_CSE_ID;
    }
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempCseId, setTempCseId] = useState(googleCseId);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Recherche instantanée Wikipédia & Savoirs intégrés
  const [wikiResults, setWikiResults] = useState<WikiResult[]>([]);
  const [isSearchingWiki, setIsSearchingWiki] = useState(false);
  const [readerArticle, setReaderArticle] = useState<{ title: string; content: string; url?: string } | null>(null);
  const [isLoadingReader, setIsLoadingReader] = useState(false);

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
        if (readerArticle) {
          setReaderArticle(null);
        } else if (showSettingsModal) {
          setShowSettingsModal(false);
        } else if (viewerExpandLevel >= 1) {
          resetViewerExpand();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerExpandLevel, readerArticle, showSettingsModal]);

  // Chargement dynamique du script Google Programmable Search Engine
  useEffect(() => {
    const scriptId = 'google-cse-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (script) {
      if (script.getAttribute('data-cx') !== googleCseId) {
        script.remove();
        script = null as any;
      } else {
        setIsScriptLoaded(true);
      }
    }

    if (!script) {
      const newScript = document.createElement('script');
      newScript.id = scriptId;
      newScript.src = `https://cse.google.com/cse.js?cx=${googleCseId}`;
      newScript.async = true;
      newScript.setAttribute('data-cx', googleCseId);
      newScript.onload = () => {
        setIsScriptLoaded(true);
      };
      document.head.appendChild(newScript);
    }
  }, [googleCseId]);

  // Exécution de la recherche
  const handleExecuteSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!q) return;

    // 1. Tenter d'envoyer la requête à Google CSE si l'API est initialisée
    try {
      if (typeof window !== 'undefined' && (window as any).google?.search?.cse?.element) {
        const element = (window as any).google.search.cse.element.getElement('studysearch_cse');
        if (element) {
          element.execute(q);
        }
      }
    } catch (err) {
      console.warn('Google CSE execute warning:', err);
    }

    // 2. Recherche éducative Wikipédia simultanée pour un accès direct et instantané sans pub
    setIsSearchingWiki(true);
    try {
      const resp = await fetch(
        `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          q
        )}&utf8=&format=json&origin=*`
      );
      if (resp.ok) {
        const data = await resp.json();
        const items: WikiResult[] = data?.query?.search || [];
        setWikiResults(items);
      }
    } catch {
      // Ignorer silencieusement si hors-ligne
    } finally {
      setIsSearchingWiki(false);
    }
  };

  const handleOpenWikiArticle = async (title: string, pageid: number) => {
    setIsLoadingReader(true);
    setReaderArticle({
      title,
      content: 'Chargement du contenu...',
      url: `https://fr.wikipedia.org/?curid=${pageid}`
    });

    try {
      const resp = await fetch(
        `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageid}&format=json&origin=*`
      );
      if (resp.ok) {
        const data = await resp.json();
        const page = data?.query?.pages?.[pageid];
        if (page?.extract) {
          setReaderArticle({
            title: page.title || title,
            content: page.extract,
            url: `https://fr.wikipedia.org/?curid=${pageid}`
          });
        }
      }
    } catch {
      setReaderArticle(prev => prev ? { ...prev, content: 'Impossible de charger cet article en mode hors-ligne.' } : null);
    } finally {
      setIsLoadingReader(false);
    }
  };

  const handleSaveCseId = () => {
    const cleaned = tempCseId.trim() || DEFAULT_GOOGLE_CSE_ID;
    setGoogleCseId(cleaned);
    try {
      localStorage.setItem('studycloud_google_cse_id', cleaned);
    } catch {}
    setShowSettingsModal(false);
  };

  const handleRefresh = () => {
    handleExecuteSearch();
  };

  const handleBack = () => {
    resetViewerExpand();
    onBack();
  };

  const quickSuggestions = [
    'Électrotechnique CME',
    'Lois de Newton',
    'Formules trigonométrie',
    'Cycle de Carnot',
    'Théorème de Pythagore',
    'Intelligence Artificielle',
    'Mécanique des fluides'
  ];

  return (
    <div
      className={`w-full flex-1 flex flex-col bg-[#080d1a] text-[#f1f5f9] transition-all duration-300 overflow-hidden ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : viewerExpandLevel === 1
            ? 'relative w-full h-dvh min-h-dvh'
            : 'relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'
      }`}
    >
      {/* 1. BARRE SUPÉRIEURE COMPACTE (Une seule ligne sur Mobile et PC) */}
      <div className="w-full h-11 sm:h-12 flex items-center justify-between px-2.5 sm:px-4 bg-[#0d1527] border-b border-white/10 shrink-0 z-30 shadow-md select-none">
        {/* Partie gauche : Bouton retour compact + Titre StudySearch avec accents Google */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-800/90 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border border-stone-700/80 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="leading-none">Retour</span>
          </button>

          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-stone-900 border border-stone-800/80 shadow-2xs shrink-0">
            <StudySearch3DIcon className="w-5 h-5 shrink-0" />
            <span className="text-xs font-black tracking-tight whitespace-nowrap">
              Study<span className="text-[#4285F4]">S</span><span className="text-[#EA4335]">e</span><span className="text-[#FBBC05]">a</span><span className="text-[#34A853]">r</span><span className="text-[#4285F4]">c</span><span className="text-[#EA4335]">h</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 font-extrabold border border-blue-500/25 hidden xs:inline">
              Google Web
            </span>
          </div>
        </div>

        {/* Partie droite : Bouton Paramètres + Bouton Rafraîchir + Boutons Agrandir */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bouton Paramètres Google CSE */}
          <button
            onClick={() => {
              setTempCseId(googleCseId);
              setShowSettingsModal(true);
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-800/90 hover:bg-stone-700 text-stone-300 flex items-center justify-center border border-stone-700 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Paramètres du moteur Google (CSE ID)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Bouton Rafraîchir */}
          <button
            onClick={handleRefresh}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-800/90 hover:bg-stone-700 text-stone-300 flex items-center justify-center border border-stone-700 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Rafraîchir les résultats"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Bouton Super Agrandissement Progressif (Desktop uniquement, Image 3) */}
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

          {/* Bouton Zoom 2 flèches opposées (Image 3) */}
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

      {/* 2. ZONE PRINCIPALE : MOTEUR DE RECHERCHE STUDYSEARCH */}
      <div className="flex-1 w-full overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 relative min-h-0">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* En-tête Google StudySearch stylisé */}
          <div className="text-center pt-2 sm:pt-4 space-y-2">
            <div className="inline-flex items-center justify-center p-3 sm:p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 shadow-lg mb-1">
              <StudySearch3DIcon className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Study<span className="text-[#4285F4]">S</span><span className="text-[#EA4335]">e</span><span className="text-[#FBBC05]">a</span><span className="text-[#34A853]">r</span><span className="text-[#4285F4]">c</span><span className="text-[#EA4335]">h</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto">
              Moteur de recherche web Google intégré. Recherchez vos cours, définitions et articles sans quitter StudyCloud.
            </p>
          </div>

          {/* Barre de saisie centrale principale */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteSearch();
            }}
            className="w-full relative max-w-2xl mx-auto"
          >
            <div className="relative flex items-center w-full bg-[#11192d] hover:bg-[#152038] focus-within:bg-[#152038] border-2 border-stone-700/80 focus-within:border-blue-500 rounded-2xl shadow-xl transition-all overflow-hidden p-1.5 sm:p-2">
              <Search className="w-5 h-5 text-blue-400 ml-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher sur Google / le Web mondial..."
                className="w-full bg-transparent border-0 px-3 py-2 text-stone-100 placeholder:text-stone-500 text-sm sm:text-base focus:outline-hidden font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 text-stone-400 hover:text-stone-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-95 shrink-0 ml-1"
              >
                Rechercher
              </button>
            </div>
          </form>

          {/* Pastilles de suggestions rapides */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-2xl mx-auto pt-1">
            <span className="text-[11px] font-bold text-stone-500 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Suggestions :
            </span>
            {quickSuggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSearchQuery(sug);
                  handleExecuteSearch(sug);
                }}
                className="px-2.5 py-1 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Onglets de sélection du moteur */}
          <div className="flex items-center justify-center border-b border-white/10 pb-2 gap-2 pt-2">
            <button
              onClick={() => setActiveTab('google')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'google'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 text-cyan-300" />
              <span>Google Web</span>
            </button>
            <button
              onClick={() => setActiveTab('wiki')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'wiki'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Wikipédia & Savoirs ({wikiResults.length})</span>
            </button>
          </div>

          {/* ONGLET 1 : RÉSULTATS GOOGLE PROGRAMMABLE SEARCH (OPTION 1) */}
          <div className={activeTab === 'google' ? 'block' : 'hidden'}>
            <div className="w-full bg-[#0c1322] border border-white/10 rounded-2xl p-3 sm:p-5 shadow-xl min-h-[350px]">
              {/* Conteneur officiel Google CSE */}
              <div 
                className="gcse-search"
                data-gname="studysearch_cse"
                data-enableAutoComplete="true"
                data-autoSearchOnLoad="false"
              />

              {!isScriptLoaded && (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  <span>Initialisation du moteur Google Programmable Search...</span>
                </div>
              )}
            </div>
          </div>

          {/* ONGLET 2 : RÉSULTATS WIKIPÉDIA & COURS INTÉGRÉS */}
          <div className={activeTab === 'wiki' ? 'block' : 'hidden'}>
            <div className="space-y-3">
              {isSearchingWiki && (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-400" />
                  <span>Recherche encyclopédique en cours...</span>
                </div>
              )}

              {!isSearchingWiki && wikiResults.length === 0 && (
                <div className="py-12 text-center text-stone-500 text-xs sm:text-sm bg-stone-900/40 rounded-2xl border border-white/5 p-6">
                  <GraduationCap className="w-10 h-10 mx-auto mb-2 text-stone-600" />
                  <p className="font-semibold text-stone-400">Aucun article trouvé pour cette recherche.</p>
                  <p className="text-xs text-stone-500 mt-1">Tapez une matière, un terme scientifique ou un nom de cours ci-dessus.</p>
                </div>
              )}

              {wikiResults.map((item) => (
                <div
                  key={item.pageid}
                  className="p-4 rounded-2xl bg-[#0f172a] hover:bg-[#131d35] border border-white/10 transition-all shadow-md group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                        {item.title}
                      </h3>
                      <div
                        className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: item.snippet }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => handleOpenWikiArticle(item.title, item.pageid)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/90 hover:bg-orange-500 text-white font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Lire dans StudyCloud</span>
                    </button>
                    <a
                      href={`https://fr.wikipedia.org/?curid=${item.pageid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white font-semibold text-xs transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Wikipédia externe</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODALE DU MODE LECTURE INTÉGRÉ (Pour lire les articles sans sortir de StudyCloud) */}
      {readerArticle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-[#0b1120] border-2 border-stone-700 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header du lecteur */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0f172a] border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-5 h-5 text-orange-500 shrink-0" />
                <h2 className="text-base sm:text-lg font-black text-white truncate">{readerArticle.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                {readerArticle.url && (
                  <a
                    href={readerArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300"
                    title="Ouvrir sur le web externe"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setReaderArticle(null)}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contenu de lecture textuel */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-4 text-stone-200 text-sm sm:text-base leading-relaxed">
              {isLoadingReader ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-400" />
                  <span>Chargement du texte intégral...</span>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none space-y-4 whitespace-pre-line">
                  {readerArticle.content}
                </div>
              )}
            </div>

            {/* Pied du lecteur */}
            <div className="px-5 py-3 bg-[#0d1424] border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
              <span>Mode Lecture StudyCloud (100% sans publicité)</span>
              <button
                onClick={() => setReaderArticle(null)}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALE DE CONFIGURATION GOOGLE PROGRAMMABLE SEARCH (CSE ID) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border-2 border-stone-700 rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">Paramètres Google CSE</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-stone-300">
              <p>
                StudySearch utilise le composant <strong>Google Programmable Search Engine</strong> officiel (100% gratuit).
              </p>
              <div className="space-y-1.5">
                <label className="font-bold text-stone-200 block">Identifiant du moteur (CX / CSE ID) :</label>
                <input
                  type="text"
                  value={tempCseId}
                  onChange={(e) => setTempCseId(e.target.value)}
                  placeholder={DEFAULT_GOOGLE_CSE_ID}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <p className="text-[11px] text-stone-400">
                Vous pouvez créer ou personnaliser votre propre moteur gratuitement sur{' '}
                <a
                  href="https://programmablesearchengine.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline"
                >
                  programmablesearchengine.google.com
                </a>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveCseId}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

