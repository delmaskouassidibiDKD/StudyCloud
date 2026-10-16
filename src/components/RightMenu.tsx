import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Maximize, Minimize, ArrowLeftRight, X, Menu, ChevronRight, History } from 'lucide-react';
import { UniversalContentRenderer } from './universal-render/UniversalContentRenderer';
import DotField from './DotField';
import MagicRings from './MagicRings';

interface RightMenuProps {
  isRightFullscreen: boolean;
  setIsRightFullscreen: (v: boolean) => void;
  isCenterFullscreen: boolean;
  mobilePreviewTab: number;
  activePreviewItem?: any;
  isMobileScreen?: boolean;
  setIsResizingRight?: (v: boolean) => void;
}

interface CreationProposalCard {
  id: string;
  title: string;
  badge?: string;
  iconColor: string;
  icon: React.ReactNode;
  toolType: string;
  getPrompt: (docName: string) => string;
}

export function RightMenu({
  isRightFullscreen,
  setIsRightFullscreen,
  isCenterFullscreen,
  mobilePreviewTab,
  activePreviewItem,
  isMobileScreen,
  setIsResizingRight
}: RightMenuProps) {
  const [activeCreation, setActiveCreation] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('studycloud_active_creation');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      if (activeCreation) {
        localStorage.setItem('studycloud_active_creation', JSON.stringify(activeCreation));
      } else {
        localStorage.removeItem('studycloud_active_creation');
      }
    } catch {}
  }, [activeCreation]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [liveStatusText, setLiveStatusText] = useState<string>('Je prépare votre création...');
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);
  const [creationsHistory, setCreationsHistory] = useState<any[]>([]);

  const resolvedDocName = useMemo(() => {
    return activePreviewItem?.name || activePreviewItem?.title || activePreviewItem?.fileName || '';
  }, [activePreviewItem]);

  // Effet machine à écrire pour le titre de proposition IA (comme quand l'IA écrit à l'arrivée dans le chat)
  const [displayedSubtitle, setDisplayedSubtitle] = useState<string>('');
  const [isTypingSubtitle, setIsTypingSubtitle] = useState<boolean>(true);
  const typewriterTimeoutRef = useRef<any[]>([]);

  useEffect(() => {
    typewriterTimeoutRef.current.forEach(clearTimeout);
    typewriterTimeoutRef.current = [];

    const fullSubtitle = resolvedDocName
      ? `Créations proposées par l'IA pour « ${resolvedDocName} »`
      : "L'IA vous propose des créations interactives sur mesure :";

    setDisplayedSubtitle('');
    setIsTypingSubtitle(true);

    for (let i = 1; i <= fullSubtitle.length; i++) {
      const t = setTimeout(() => {
        setDisplayedSubtitle(fullSubtitle.slice(0, i));
        if (i === fullSubtitle.length) {
          setIsTypingSubtitle(false);
        }
      }, i * 16);
      typewriterTimeoutRef.current.push(t);
    }

    return () => {
      typewriterTimeoutRef.current.forEach(clearTimeout);
      typewriterTimeoutRef.current = [];
    };
  }, [resolvedDocName]);

  // Définition des cartes de créations réelles StudyCloud (exactement comme sur le schéma d'architecture)
  const proposalCards: CreationProposalCard[] = useMemo(() => [
    {
      id: 'questionnaire',
      title: 'Questionnaire QCM',
      iconColor: '#06b6d4',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#06b6d4]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect width="15" height="15" x="4.5" y="4.5" rx="3.5" />
            <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 2" />
            <circle cx="12" cy="15.5" r="0.75" fill="currentColor" />
          </svg>
        </div>
      ),
      toolType: 'questionnaire',
      getPrompt: (doc) => doc
        ? `Conçois un Questionnaire Quiz QCM interactif sur « ${doc} » avec 4 options par question et explications pédagogiques.`
        : "Conçois un Questionnaire Quiz QCM interactif avec 4 options par question et explications pédagogiques pour tester mes connaissances."
    },
    {
      id: 'carte-mentale',
      title: 'Carte Mentale',
      iconColor: '#a855f7',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#a855f7]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect width="5" height="5" x="3" y="10" rx="1" />
            <rect width="5" height="5" x="16" y="5" rx="1" />
            <rect width="5" height="5" x="16" y="14" rx="1" />
            <path d="M8 12.5h4v-5h4M12 12.5v4h4" />
          </svg>
        </div>
      ),
      toolType: 'carte-mentale',
      getPrompt: (doc) => doc
        ? `Conçois une Carte Mentale interactive et arborescente des concepts fondamentaux de « ${doc} » avec thème central et branches hiérarchiques.`
        : "Conçois une Carte Mentale interactive et arborescente des concepts fondamentaux avec branches hiérarchiques."
    },
    {
      id: 'carte-memoire',
      title: 'Cartes Mémoires',
      iconColor: '#f59e0b',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#f59e0b]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect width="11" height="14" x="4" y="6" rx="2" />
            <path d="M8 3h7a2 2 0 0 1 2 2v11" />
          </svg>
        </div>
      ),
      toolType: 'carte-memoire',
      getPrompt: (doc) => doc
        ? `Crée un jeu complet de Cartes Mémoires interactives (Flashcards) pour réviser et mémoriser « ${doc} » (recto question/notion, verso réponse/détail).`
        : "Crée un jeu complet de Cartes Mémoires interactives (Flashcards) pour réviser et mémoriser les notions clés."
    },
    {
      id: 'resume',
      title: 'Fiche de Résumé',
      iconColor: '#ec4899',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#ec4899]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
      ),
      toolType: 'resume',
      getPrompt: (doc) => doc
        ? `Rédige une Fiche de Résumé structurée et claire de « ${doc} » avec vue d'ensemble, points clés, définitions et règles fondamentales.`
        : "Rédige une Fiche de Résumé claire et structurée avec vue d'ensemble, points clés, définitions et règles fondamentales."
    },
    {
      id: 'pdf',
      title: 'Document PDF',
      iconColor: '#38bdf8',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#38bdf8]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
        </div>
      ),
      toolType: 'pdf',
      getPrompt: (doc) => doc
        ? `Génère un Document PDF polycopié d'étude officiel complet et structuré sur « ${doc} » avec sections, titres et contenu approfondi.`
        : "Génère un Document PDF polycopié d'étude officiel complet et structuré avec sections, titres et contenu approfondi."
    },
    {
      id: 'vrai-ou-faux',
      title: 'Vrai ou Faux',
      iconColor: '#10b981',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#10b981]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="9" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
      ),
      toolType: 'vrai-ou-faux',
      getPrompt: (doc) => doc
        ? `Crée une série d'affirmations interactives Vrai ou Faux avec justifications détaillées et pièges fréquents sur « ${doc} ».`
        : "Crée une série d'affirmations interactives Vrai ou Faux avec justifications détaillées et pièges fréquents."
    },
    {
      id: 'exercices-ecrits',
      title: 'Exercices Écrits',
      iconColor: '#8b5cf6',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#8b5cf6]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </div>
      ),
      toolType: 'exercices-ecrits',
      getPrompt: (doc) => doc
        ? `Conçois une série d'Exercices Écrits d'application avec énoncé pas à pas et correction guidée détaillée sur « ${doc} ».`
        : "Conçois une série d'Exercices Écrits d'application avec énoncé pas à pas et correction guidée détaillée."
    },
    {
      id: 'devoir-complet',
      title: 'Devoir Complet',
      badge: 'Examen',
      iconColor: '#f43f5e',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#f43f5e]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
      ),
      toolType: 'devoir-complet',
      getPrompt: (doc) => doc
        ? `Conçois un Devoir Complet d'examen officiel avec plusieurs parties, barème de points et corrigé détaillé sur « ${doc} ».`
        : "Conçois un Devoir Complet d'examen officiel avec plusieurs parties, barème de points et corrigé détaillé."
    },
    {
      id: 'infographie',
      title: 'Infographie',
      iconColor: '#facc15',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#facc15]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect width="3.5" height="10" x="5" y="10" rx="1" fill="currentColor" stroke="none" />
            <circle cx="6.75" cy="6" r="1.5" fill="currentColor" />
            <rect width="3.5" height="7" x="15" y="13" rx="1" fill="currentColor" stroke="none" />
            <circle cx="16.75" cy="9" r="1.5" fill="currentColor" />
            <rect width="3.5" height="12" x="10" y="8" rx="1" fill="currentColor" stroke="none" />
            <circle cx="11.75" cy="4" r="1.5" fill="currentColor" />
          </svg>
        </div>
      ),
      toolType: 'infographie',
      getPrompt: (doc) => doc
        ? `Crée une Infographie pédagogique détaillée avec repères visuels, chiffres clés, métriques et chronologie sur « ${doc} ».`
        : "Crée une Infographie pédagogique détaillée avec repères visuels, chiffres clés, métriques et chronologie."
    },
    {
      id: 'questionnaire-test',
      title: 'Test Noté',
      badge: 'Chrono',
      iconColor: '#fb923c',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#fb923c]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      ),
      toolType: 'questionnaire-test',
      getPrompt: (doc) => doc
        ? `Prépare une Épreuve de Test Noté avec chronomètre et barème sur « ${doc} » pour évaluer mes acquis en conditions réelles.`
        : "Prépare une Épreuve de Test Noté avec chronomètre et barème pour évaluer mes acquis en conditions réelles."
    }
  ], []);

  // Déclenchement de la création lors de l'appui sur une carte
  const handleSelectCard = (card: CreationProposalCard) => {
    const promptToSend = card.getPrompt(resolvedDocName);
    const hasDoc = Boolean(resolvedDocName && resolvedDocName.trim().length > 0);

    // Si un document est présent, on peut démarrer l'animation de création
    if (hasDoc) {
      setIsGenerating(true);
      setLiveStatusText("J'analyse votre document pour concevoir votre création...");
      window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
    } else {
      // Pas de document : basculer sur le chat pour que l'IA interpelle l'utilisateur
      window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 1 } }));
    }

    // Envoi du prompt à l'IA
    window.dispatchEvent(new CustomEvent('studycloud-trigger-creation', {
      detail: {
        prompt: promptToSend,
        toolType: card.toolType,
        isCreation: hasDoc,
        hasDocument: hasDoc,
        source: 'right-menu-cards'
      }
    }));
  };

  // Annulation manuelle de la création
  const handleCancelGeneration = () => {
    setIsGenerating(false);
    window.dispatchEvent(new CustomEvent('studycloud-cancel-creation'));
  };

  // Écouteurs d'événements pour le statut en direct de l'IA et la réception de la création
  useEffect(() => {
    const handleCreationReady = (e: any) => {
      const creation = e.detail?.creation || e.detail;
      if (creation) {
        setIsGenerating(false);
        setActiveCreation(creation);
        setCreationsHistory((prev) => {
          const exists = prev.some((c) => (c.id && c.id === creation.id) || (c.title && c.title === creation.title));
          if (!exists) {
            return [creation, ...prev];
          }
          return prev;
        });
      }
    };

    const handleOpenCreation = (e: any) => {
      const creation = e.detail?.creation || e.detail?.item || e.detail;
      if (creation) {
        setIsGenerating(false);
        setActiveCreation(creation);
        setCreationsHistory((prev) => {
          const exists = prev.some((c) => (c.id && c.id === creation.id) || (c.title && c.title === creation.title));
          if (!exists) {
            return [creation, ...prev];
          }
          return prev;
        });
      }
    };

    const handleClearCreation = () => {
      setActiveCreation(null);
      setIsGenerating(false);
    };

    const handleCreationStatus = (e: any) => {
      // Activer l'animation de création UNIQUEMENT s'il s'agit explicitement d'une création
      if (e.detail?.isLoading === true && (e.detail?.isCreation || e.detail?.toolType)) {
        setIsGenerating(true);
      } else if (e.detail?.isLoading === false) {
        setIsGenerating(false);
      }
      if (e.detail?.statusText) {
        setLiveStatusText(e.detail.statusText);
      }
    };

    const handleCreationError = () => {
      setIsGenerating(false);
    };

    window.addEventListener('ai-creation-ready', handleCreationReady as any);
    window.addEventListener('studycloud-open-creation', handleOpenCreation as any);
    window.addEventListener('studycloud-clear-creation', handleClearCreation as any);
    window.addEventListener('ai-creation-status-update', handleCreationStatus as any);
    window.addEventListener('ai-creation-error', handleCreationError as any);

    return () => {
      window.removeEventListener('ai-creation-ready', handleCreationReady as any);
      window.removeEventListener('studycloud-open-creation', handleOpenCreation as any);
      window.removeEventListener('studycloud-clear-creation', handleClearCreation as any);
      window.removeEventListener('ai-creation-status-update', handleCreationStatus as any);
      window.removeEventListener('ai-creation-error', handleCreationError as any);
    };
  }, []);

  // Fermeture du menu latéral avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRightDrawerOpen) {
        setIsRightDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRightDrawerOpen]);

  return (
    <div
      className={`w-full h-full pointer-events-auto relative bg-[#120F17] flex flex-col pt-[44px] overflow-hidden ${
        isCenterFullscreen
          ? 'hidden'
          : isMobileScreen
          ? mobilePreviewTab === 2 || isRightFullscreen
            ? 'flex'
            : 'hidden'
          : 'flex'
      }`}
    >
      {/* Poignée de redimensionnement entre CenterMenu et RightMenu */}
      {setIsResizingRight && (
        <div
          className="hidden md:flex absolute -left-[9px] top-0 bottom-0 w-[18px] cursor-col-resize z-50 justify-center items-center group select-none"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizingRight(true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setIsResizingRight(true);
          }}
          title="Glisser pour redimensionner l'espace de droite"
        >
          <div className="w-[3px] h-full bg-transparent group-hover:bg-orange-500 group-active:bg-orange-500 transition-colors" />
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-white dark:bg-stone-800 border border-stone-400 dark:border-stone-600 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none">
            <ArrowLeftRight className="w-2.5 h-2.5 text-stone-600 dark:text-stone-300" />
          </div>
        </div>
      )}

      {/* Barre d'outils supérieure : Bouton Zoom jaune à gauche, Titre au milieu sans logo étoiles, Bouton 3 traits à droite */}
      <div className={`w-full relative flex items-center justify-between px-3 py-1.5 ${isGenerating ? 'bg-black border-zinc-900' : activeCreation ? 'bg-[#1a1c22]/90 border-zinc-700/60' : 'bg-[#120F17]/90 border-purple-900/30'} border-b shrink-0 z-30 shadow-xs backdrop-blur-sm transition-colors`}>
        {/* Côté gauche : Bouton Zoom jaune */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRightFullscreen(!isRightFullscreen)}
            className="p-1.5 bg-yellow-400 rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center shrink-0"
            title={isRightFullscreen ? 'Réduire' : 'Plein écran'}
          >
            {isRightFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>

        {/* Centre : Titre repoussé vers le milieu, sans logo étoile */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none text-xs sm:text-[13px] font-semibold text-zinc-200 select-none max-w-[55%] truncate text-center">
          {isGenerating ? (
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              Génération en cours...
            </span>
          ) : activeCreation ? (
            <span className="text-zinc-200 truncate">
              {activeCreation.title || 'Création IA'}
            </span>
          ) : (
            <span className="text-zinc-200 tracking-wide font-medium">
              Studio de Créations
            </span>
          )}
        </div>

        {/* Côté droit (ancienne place du titre entouré en rouge) : Bouton 3 traits pour ouvrir le menu latéral */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRightDrawerOpen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/90 border border-zinc-700/70 text-zinc-200 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
            title="Menu latéral du Studio"
            aria-label="Ouvrir le menu latéral"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zone principale */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative bg-[#120F17]">
        {/* Fond animé WebGL2 avec les petits points colorés */}
        <div className="absolute inset-0 z-0 w-full h-full">
          <DotField
            gradientFrom="#5227FF"
            gradientTo="#FF9FFC"
            dotRadius={1.5}
            dotSpacing={14}
            cursorRadius={240}
            bulgeStrength={0.6}
            glowRadius={160}
            pattern="grid"
            glowColor="#ffffff"
            gradientAngle={135}
            twist={0}
            glowIntensity={0.8}
            baseOpacity={0.55}
            waveAmplitude={0}
            speed={1}
            sparkle={false}
            interactive
            holdToZoom
            intro
            lightMode={false}
          />
        </div>

        {/* Grille des cartes carrées proposées par l'IA (2 par ligne comme sur l'Image 2) */}
        {!activeCreation && !isGenerating && (
          <div className="absolute inset-0 z-10 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center custom-scrollbar animate-fadeIn select-none">
            {/* Titre spontané écrit par l'IA */}
            <div className="w-full max-w-[420px] mb-4 text-left">
              <p className="text-xs sm:text-[13px] font-medium text-zinc-300 min-h-[22px] flex items-center">
                <span>{displayedSubtitle}</span>
                {isTypingSubtitle && (
                  <span className="inline-block w-0.5 h-3.5 bg-purple-400 ml-1 animate-pulse" />
                )}
              </p>
            </div>

            {/* Cartes : 2 par ligne, compactes, simples et élégantes */}
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-[420px]">
              {proposalCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelectCard(card)}
                  className="group relative flex items-center gap-2.5 px-3.5 py-3 rounded-[20px] bg-[#18181b]/90 hover:bg-[#232328] border border-zinc-800/80 hover:border-zinc-700/90 shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] text-left"
                >
                  <div className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                    {card.icon}
                  </div>
                  <span className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-white truncate">
                    {card.title}
                  </span>
                  {card.badge && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 group-hover:text-pink-300 border border-zinc-700/60 shrink-0">
                      {card.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ÉCRAN NOIR PENDANT LA CRÉATION AVEC ANIMATION MAGICRINGS ET DIALOGUE EN DIRECT DE L'IA */}
        {isGenerating && (
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center overflow-hidden animate-fadeIn">
            <div style={{ width: '100%', height: '500px', position: 'relative' }}>
              <MagicRings
                color="#A855F7"
                colorTwo="#6366F1"
                motion="pulse"
                ringCount={6}
                speed={1}
                lineThickness={2}
                glow={1}
                hoverScale={1.2}
                clickBurst
                baseRadius={0.35}
                radiusStep={0.1}
                expansion={0.1}
                taper={1.5}
                rotation={0}
                spin={0}
                tilt={0}
                dispersion={0}
                grain={0}
                opacity={1}
                followMouse={false}
                mouseInfluence={0.2}
                hoverIntensity={1}
                parallax={0.05}
                intro
              />

              {/* Ce que l'IA fait en direct au milieu de l'écran / des anneaux */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-20">
                <div className="flex flex-col items-center gap-3 max-w-sm px-6 py-5 rounded-3xl bg-black/60 backdrop-blur-md border border-purple-500/25 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                      Création en direct
                    </span>
                  </div>

                  {/* Statut dynamique en temps réel */}
                  <p className="text-sm sm:text-base font-semibold text-white tracking-wide leading-relaxed animate-pulse">
                    {liveStatusText || "Je conçois votre création..."}
                  </p>

                  <span className="text-[11px] font-medium text-zinc-400">
                    L'IA structure vos données pédagogiques
                  </span>

                  {/* Bouton Annuler au centre */}
                  <button
                    type="button"
                    onClick={handleCancelGeneration}
                    className="mt-1 pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Annuler</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Si une création est active : UniversalContentRenderer au premier plan avec transparence élégante */}
        {activeCreation && (
          <div className="absolute inset-0 z-20 overflow-hidden flex flex-col bg-[#14121b]/80 backdrop-blur-sm animate-fadeIn">
            <UniversalContentRenderer
              item={activeCreation}
              onClose={() => setActiveCreation(null)}
              isFullscreen={isRightFullscreen}
            />
          </div>
        )}
      </div>

      {/* Toile de fond (Backdrop) pour refermer le menu latéral en cliquant à côté */}
      <div
        onClick={() => setIsRightDrawerOpen(false)}
        className={`absolute top-[44px] left-0 right-0 bottom-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isRightDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Menu latéral droit glissant avec transition fluide */}
      <aside
        className={`absolute top-[44px] right-0 bottom-0 z-50 bg-[#15131e]/98 backdrop-blur-md border-l border-purple-900/40 shadow-[-16px_0_40px_rgba(0,0,0,0.7)] flex flex-col transition-transform duration-300 ease-in-out will-change-transform ${
          isRightFullscreen ? 'w-full sm:w-1/3 md:w-1/3' : 'w-[85%] sm:w-[60%] max-w-[340px]'
        } ${
          isRightDrawerOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* En-tête du menu latéral avec titre et bouton flèche / croix pour fermer */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800/80 bg-[#120F17]/95 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
              Menu du Studio
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bouton croix / flèche pour faire disparaître le volet */}
            <button
              type="button"
              onClick={() => setIsRightDrawerOpen(false)}
              className="p-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
              title="Fermer le menu latéral"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps défilable du menu latéral */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar text-xs">
          {/* Bloc d'action / état actuel */}
          {activeCreation ? (
            <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  Création active
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200">
                  En cours
                </span>
              </div>
              <p className="font-semibold text-zinc-100 text-xs line-clamp-2">
                {activeCreation.title || 'Création IA'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRightDrawerOpen(false)}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs text-center transition-colors cursor-pointer"
                >
                  Afficher
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCreation(null);
                    setIsRightDrawerOpen(false);
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs text-center border border-zinc-700 transition-colors cursor-pointer"
                  title="Fermer la création et revenir aux cartes"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-200 text-xs">Catalogue de Créations</p>
                <p className="text-[11px] text-zinc-400">10 formats d'études disponibles</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRightDrawerOpen(false)}
                className="px-2.5 py-1 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Explorer
              </button>
            </div>
          )}

          {/* Action Plein écran */}
          <button
            type="button"
            onClick={() => {
              setIsRightFullscreen(!isRightFullscreen);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              {isRightFullscreen ? <Minimize className="w-3.5 h-3.5 text-yellow-400" /> : <Maximize className="w-3.5 h-3.5 text-yellow-400" />}
              {isRightFullscreen ? 'Réduire la vue' : 'Plein écran'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isRightFullscreen ? '1/3 largeur' : 'plein'}
            </span>
          </button>

          {/* Section Lancer une création (10 formats réels) */}
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
              Lancer une création
            </p>
            <div className="space-y-1.5">
              {proposalCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    handleSelectCard(card);
                    setIsRightDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#1a1824]/80 hover:bg-[#252233] border border-zinc-800/70 hover:border-purple-800/50 text-left transition-all cursor-pointer group"
                >
                  <div className="shrink-0 group-hover:scale-110 transition-transform">
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                        {card.title}
                      </span>
                      {card.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                          {card.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-purple-400 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Historique de session si des créations ont été générées */}
          {creationsHistory.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-purple-400" />
                Historique ({creationsHistory.length})
              </p>
              <div className="space-y-1.5">
                {creationsHistory.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => {
                      setActiveCreation(item);
                      setIsRightDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      activeCreation && activeCreation.id === item.id
                        ? 'bg-purple-950/40 border-purple-700/60 text-purple-200'
                        : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-medium truncate flex-1 mr-2">
                      {item.title || 'Création sans titre'}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase shrink-0">
                      {item.type || 'format'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
export default RightMenu;
