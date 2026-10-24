import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Maximize, Minimize, ArrowLeftRight, X, Menu, ChevronRight, History, Sparkles, Brain,
  Trash2, Search, RefreshCw, FolderOpen, AlertCircle, Clock, BookOpen, Layers, CheckCircle2,
  FileText, Loader2
} from 'lucide-react';
import { UniversalContentRenderer } from './universal-render/UniversalContentRenderer';
import DotField from './DotField';
import MagicRings from './MagicRings';
import { getCurrentUserId } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';

export type CreationPhase = 'idle' | 'thinking' | 'creating';

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

const CREATION_NAME_MAP: Record<string, string> = {
  'questionnaire': 'Questionnaire QCM',
  'quiz': 'Questionnaire QCM',
  'qcm': 'Questionnaire QCM',
  'questionnaire-test': 'Questionnaire Test',
  'test': 'Questionnaire Test',
  'carte-mentale': 'Carte Mentale',
  'mindmap': 'Carte Mentale',
  'carte-mentale-2': 'Carte Mentale 2',
  'carte-mentale-conceptuelle': 'Carte Mentale 2',
  'mindmap2': 'Carte Mentale 2',
  'carte-memoire': 'Cartes Mémoires',
  'flashcards': 'Cartes Mémoires',
  'resume': 'Fiche de Résumé',
  'summary': 'Fiche de Résumé',
  'pdf': 'Document PDF',
  'document': 'Document PDF',
  'vrai-faux': 'Vrai ou Faux',
  'vrai-ou-faux': 'Vrai ou Faux',
  'vrai-ou-faux-test': 'Vrai ou Faux Test',
  'vf-test': 'Vrai ou Faux Test',
  'exercices': 'Exercices Écrits',
  'exercices-ecrits': 'Exercices Écrits',
  'devoir': 'Devoir Complet',
  'devoir-complet': 'Devoir Complet',
  'infographie': 'Infographie',
  'infographic': 'Infographie'
};

function getCreationBadgeLabel(title?: string): string {
  if (!title || title.trim() === '') return "Création en cours...";
  const clean = title.trim();
  const lower = clean.toLowerCase();
  const elision = lower.startsWith('d') || lower.startsWith('e') || lower.startsWith('i') || lower.startsWith('a') || lower.startsWith('o') || lower.startsWith('u') || lower.startsWith('é') || lower.startsWith('è');
  return `Création ${elision ? "d'" : "de "}${clean} en cours`;
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

  const [creationPhase, setCreationPhase] = useState<CreationPhase>('idle');
  const isGenerating = creationPhase === 'creating';
  const [generatingToolTitle, setGeneratingToolTitle] = useState<string>('');
  const [liveStatusText, setLiveStatusText] = useState<string>('Je prépare votre support avec soin...');
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);
  const [savedCreations, setSavedCreations] = useState<any[]>([]);
  const [isLoadingCreations, setIsLoadingCreations] = useState<boolean>(false);
  const [creationSearch, setCreationSearch] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUserCreations = async () => {
    const uid = getCurrentUserId();
    if (!uid) {
      setSavedCreations([]);
      return;
    }
    try {
      setIsLoadingCreations(true);
      const res = await StudyCloudAPI.getAiContents(uid);
      if (res && res.success && Array.isArray(res.data)) {
        setSavedCreations(res.data);
      }
    } catch (err) {
      console.warn('[RightMenu] Erreur chargement créations D1:', err);
    } finally {
      setIsLoadingCreations(false);
    }
  };

  useEffect(() => {
    fetchUserCreations();
  }, []);

  useEffect(() => {
    if (isRightDrawerOpen) {
      fetchUserCreations();
    }
  }, [isRightDrawerOpen]);

  useEffect(() => {
    const handleSaved = () => {
      fetchUserCreations();
    };
    window.addEventListener('studycloud-creation-saved', handleSaved);
    return () => window.removeEventListener('studycloud-creation-saved', handleSaved);
  }, []);

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
      ? `Créations interactives pour « ${resolvedDocName} » :`
      : "Créations interactives sur mesure :";

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
      id: 'questionnaire-test',
      title: 'Questionnaire Test',
      badge: 'Test Noté',
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
        ? `Prépare une Épreuve de Questionnaire Test noté avec chronomètre et barème sur « ${doc} » pour évaluer mes acquis en conditions réelles.`
        : "Prépare une Épreuve de Questionnaire Test noté avec chronomètre et barème pour évaluer mes acquis en conditions réelles."
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
      id: 'vrai-ou-faux-test',
      title: 'Vrai ou Faux Test',
      badge: 'Épreuve',
      iconColor: '#14b8a6',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#14b8a6]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="m9 11 3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            <path d="m6 8 3 3" />
            <path d="m9 8-3 3" />
          </svg>
        </div>
      ),
      toolType: 'vrai-ou-faux-test',
      getPrompt: (doc) => doc
        ? `Prépare une Épreuve de Vrai ou Faux Test notée sur « ${doc} » où toutes les réponses sont validées ensemble avec score et corrigé détaillé.`
        : "Prépare une Épreuve de Vrai ou Faux Test notée où toutes les réponses sont validées ensemble avec score et corrigé détaillé."
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
      id: 'carte-mentale-2',
      title: 'Carte Mentale 2',
      badge: 'Conceptuelle',
      iconColor: '#6366f1',
      icon: (
        <div className="flex items-center justify-center w-5 h-5 text-[#6366f1]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect width="6" height="4" x="2" y="3" rx="1" />
            <rect width="6" height="4" x="9" y="17" rx="1" />
            <rect width="6" height="4" x="16" y="3" rx="1" />
            <path d="M5 7v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
            <path d="M12 13v4" />
          </svg>
        </div>
      ),
      toolType: 'carte-mentale-2',
      getPrompt: (doc) => doc
        ? `Conçois une Carte Mentale 2 (Conceptuelle) modélisant l'architecture et les relations de « ${doc} » en blocs hiérarchiques et connecteurs.`
        : "Conçois une Carte Mentale 2 (Conceptuelle) modélisant l'architecture et les relations clés en blocs hiérarchiques et connecteurs."
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
        ? `Extrais l'ensemble des 4 paliers thématiques, concepts, figures, circuits et formules mathématiques en KaTeX du document « ${doc} » pour rédiger une Fiche de Résumé et Synthèse complète, explicative et approfondie (style masterclass du chat), avec le thème bien encadré, grands piliers développés, définitions clés, formulaire exhaustif avec fractions verticales, tableau comparatif, pièges d'examen et exemple d'application pas-à-pas.`
        : "Extrais et structure l'ensemble des 4 paliers thématiques, concepts et formules mathématiques en KaTeX pour rédiger une Fiche de Résumé et Synthèse complète, explicative et approfondie (style masterclass du chat), avec le thème bien encadré, grands piliers développés, définitions clés, formulaire exhaustif avec fractions verticales, tableau comparatif, pièges d'examen et exemple d'application pas-à-pas."
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
        ? `Extrais l'ensemble des piliers thématiques, concepts, figures, circuits et formules mathématiques en KaTeX du document « ${doc} » pour concevoir une épreuve d'Exercices Écrits complète de 8 à 10 questions progressives, avec barème sur 20 points, énoncés rigoureux et corrigé pas-à-pas détaillé.`
        : "Extrais et structure l'ensemble des piliers thématiques, concepts et formules mathématiques en KaTeX pour concevoir une épreuve d'Exercices Écrits complète de 8 à 10 questions progressives, avec barème sur 20 points, énoncés rigoureux et corrigé pas-à-pas détaillé."
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
        ? `Extrais l'ensemble des piliers thématiques, concepts, figures, circuits et formules mathématiques en KaTeX du document « ${doc} » pour concevoir une Épreuve Complète de Devoir d'Examen sur 20 points découpée en 3 Exercices officiels (Problème analytique 8 pts, QCM 6 pts, Vrai ou Faux 6 pts) avec barème strict et corrigé pas-à-pas détaillé.`
        : "Extrais et structure l'ensemble des piliers thématiques, concepts et formules mathématiques en KaTeX pour concevoir une Épreuve Complète de Devoir d'Examen sur 20 points découpée en 3 Exercices officiels (Problème analytique 8 pts, QCM 6 pts, Vrai ou Faux 6 pts) avec barème strict et corrigé pas-à-pas détaillé."
    }
  ], []);

  // Déclenchement de la création lors de l'appui sur une carte
  const handleSelectCard = (card: CreationProposalCard) => {
    // 0. Si pas de connexion Internet : le menu reste normal avec les 12 prompts
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setCreationPhase('idle');
      setActiveCreation(null);
      return;
    }

    const promptToSend = card.getPrompt(resolvedDocName);
    const hasDoc = Boolean(resolvedDocName && resolvedDocName.trim().length > 0);

    // Ouvrir immédiatement le menu de chat pour montrer en temps réel ce qui se passe
    window.dispatchEvent(new CustomEvent('open-assistant-chat'));
    window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 1 } }));

    // Cas spécial 'pdf' :
    // On bascule dans le chat pour que l'IA engage la proposition interactive avec [QUESTIONS_SUGGÉRÉES]
    if (card.id === 'pdf') {
      setActiveCreation(null);
      setCreationPhase('idle');
      window.dispatchEvent(new CustomEvent('studycloud-trigger-creation', {
        detail: {
          prompt: promptToSend,
          toolType: undefined, // Ne pas forcer le mode création direct afin de converser dans le chat
          isCreation: false,
          hasDocument: hasDoc,
          source: 'right-menu-cards'
        }
      }));
      return;
    }

    // Si aucun document n'est ouvert : mode conversation (les 12 cartes restent affichées)
    if (!hasDoc) {
      setActiveCreation(null);
      setCreationPhase('idle');
      window.dispatchEvent(new CustomEvent('studycloud-trigger-creation', {
        detail: {
          prompt: promptToSend,
          toolType: undefined,
          isCreation: false,
          hasDocument: hasDoc,
          source: 'right-menu-cards'
        }
      }));
      return;
    }

    // Si un document est présent : passage immédiat en phase "thinking" (Réflexion en cours...)
    // CE N'EST PAS ENCORE LA CRÉATION ! C'est l'IA qui décidera d'activer l'écran de chargement de création habituel.
    setActiveCreation(null);
    setCreationPhase('thinking');
    setGeneratingToolTitle(card.title);
    setLiveStatusText("Réflexion en cours...");

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
    setCreationPhase('idle');
    setActiveCreation(null);
    window.dispatchEvent(new CustomEvent('studycloud-cancel-creation'));
  };

  // Utilitaires d'affichage pour les créations
  const getCreationIcon = (toolType?: string) => {
    const norm = (toolType || '').toLowerCase().replace(/_/g, '-');
    const matched = proposalCards.find(c => c.toolType === norm || c.id === norm);
    if (matched) return matched.icon;

    if (norm.includes('quiz') || norm.includes('qcm') || norm.includes('questionnaire')) {
      return (
        <div className="flex items-center justify-center w-5 h-5 text-[#38bdf8]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </div>
      );
    }
    if (norm.includes('mindmap') || norm.includes('mentale')) {
      return (
        <div className="flex items-center justify-center w-5 h-5 text-[#a855f7]">
          <Brain className="w-4 h-4" />
        </div>
      );
    }
    if (norm.includes('flashcard') || norm.includes('memoire')) {
      return (
        <div className="flex items-center justify-center w-5 h-5 text-[#f59e0b]">
          <Layers className="w-4 h-4" />
        </div>
      );
    }
    if (norm.includes('resume') || norm.includes('summary')) {
      return (
        <div className="flex items-center justify-center w-5 h-5 text-[#ec4899]">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-5 h-5 text-purple-400">
        <Sparkles className="w-4 h-4" />
      </div>
    );
  };

  const formatCreationDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const handleDeleteCreation = async (e: React.MouseEvent, creationId: string) => {
    e.stopPropagation();
    const uid = getCurrentUserId();
    if (!uid || !creationId) return;

    if (!window.confirm('Voulez-vous vraiment supprimer cette création de votre compte ?')) {
      return;
    }

    try {
      setDeletingId(creationId);
      const res = await StudyCloudAPI.deleteAiContent(creationId, uid);
      if (res && res.success) {
        setSavedCreations(prev => prev.filter(c => c.id !== creationId));
        if (activeCreation && activeCreation.id === creationId) {
          setActiveCreation(null);
        }
      }
    } catch (err) {
      console.error('[RightMenu] Erreur suppression création:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenSavedCreation = (item: any) => {
    let parsedContent = item.content || item.data || item.contentJson;
    if (typeof parsedContent === 'string') {
      try {
        parsedContent = JSON.parse(parsedContent);
      } catch {}
    }

    const creationToLoad = {
      ...item,
      id: item.id,
      title: item.title,
      toolType: item.toolType || item.type,
      type: item.toolType || item.type,
      content: parsedContent,
      data: parsedContent,
      sourceFileName: item.sourceFileName || item.source_file_name,
    };
    setActiveCreation(creationToLoad);
    setIsRightDrawerOpen(false);
  };

  const filteredCreations = useMemo(() => {
    if (!creationSearch.trim()) return savedCreations;
    const q = creationSearch.toLowerCase().trim();
    return savedCreations.filter(c => {
      const titleMatch = (c.title || '').toLowerCase().includes(q);
      const toolMatch = (c.toolType || c.type || '').toLowerCase().includes(q);
      const docMatch = (c.sourceFileName || '').toLowerCase().includes(q);
      const labelMatch = (CREATION_NAME_MAP[c.toolType] || '').toLowerCase().includes(q);
      return titleMatch || toolMatch || docMatch || labelMatch;
    });
  }, [savedCreations, creationSearch]);

  // Écouteurs d'événements pour le statut en direct de l'IA et la réception de la création
  useEffect(() => {
    const handleCreationReady = (e: any) => {
      const creation = e.detail?.creation || e.detail;
      if (creation) {
        setCreationPhase('idle');
        setActiveCreation(creation);

        // Sauvegarde systématique dans la base D1
        const uid = getCurrentUserId();
        if (uid && (creation.content || creation.data)) {
          StudyCloudAPI.saveAiContent({
            id: creation.id,
            userId: uid,
            fileId: creation.fileId || activePreviewItem?.id || null,
            toolType: creation.toolType || creation.type || 'creation',
            title: creation.title || 'Création Studio',
            contentJson: creation.content || creation.data,
            sourceFileName: creation.sourceFileName || resolvedDocName || undefined,
            isPinned: Boolean(creation.isPinned),
          }).then(() => {
            fetchUserCreations();
          }).catch(err => {
            console.warn('[RightMenu] Erreur sauvegarde création D1:', err);
          });
        } else {
          fetchUserCreations();
        }
      }
    };

    const handleOpenCreation = (e: any) => {
      const creation = e.detail?.creation || e.detail?.item || e.detail;
      if (creation) {
        setCreationPhase('idle');
        handleOpenSavedCreation(creation);
      }
    };

    const handleClearCreation = () => {
      setActiveCreation(null);
      setCreationPhase('idle');
    };

    const handleCreationStatus = (e: any) => {
      const detail = e.detail || {};

      // 1. Réinitialisation explicite vers les 12 prompts (IA ne crée pas / pose question / répond en chat / erreur / annulation)
      if (detail.resetToPrompts || detail.isError || detail.isCancelled) {
        setCreationPhase('idle');
        setActiveCreation(null);
        return;
      }

      // 2. Si le chargement est terminé sans création
      if (detail.isLoading === false) {
        setCreationPhase('idle');
        return;
      }

      // 3. Phase de réflexion de l'IA ("Réflexion en cours...")
      if (detail.phase === 'thinking' || detail.isThinking) {
        setCreationPhase('thinking');
        if (detail.toolType) {
          const matched = proposalCards.find(c => c.toolType === detail.toolType || c.id === detail.toolType);
          if (matched) {
            setGeneratingToolTitle(matched.title);
          } else if (CREATION_NAME_MAP[detail.toolType]) {
            setGeneratingToolTitle(CREATION_NAME_MAP[detail.toolType]);
          }
        }
        setLiveStatusText(detail.statusText || "Réflexion en cours...");
        return;
      }

      // 4. Phase de création active déclenchée par l'IA ("Création en cours...")
      if (detail.phase === 'creating' || detail.isCreating || (detail.isLoading === true && (detail.isCreation || detail.toolType))) {
        setCreationPhase('creating');
        if (detail.toolType) {
          const matched = proposalCards.find(c => c.toolType === detail.toolType || c.id === detail.toolType);
          if (matched) {
            setGeneratingToolTitle(matched.title);
          } else if (CREATION_NAME_MAP[detail.toolType]) {
            setGeneratingToolTitle(CREATION_NAME_MAP[detail.toolType]);
          }
        }
        if (detail.statusText) {
          setLiveStatusText(detail.statusText);
        }
        return;
      }
    };

    const handleCreationError = () => {
      setCreationPhase('idle');
      setActiveCreation(null);
    };

    const handleOffline = () => {
      setCreationPhase('idle');
      setActiveCreation(null);
    };

    window.addEventListener('ai-creation-ready', handleCreationReady as any);
    window.addEventListener('studycloud-open-creation', handleOpenCreation as any);
    window.addEventListener('studycloud-clear-creation', handleClearCreation as any);
    window.addEventListener('ai-creation-status-update', handleCreationStatus as any);
    window.addEventListener('ai-creation-error', handleCreationError as any);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('ai-creation-ready', handleCreationReady as any);
      window.removeEventListener('studycloud-open-creation', handleOpenCreation as any);
      window.removeEventListener('studycloud-clear-creation', handleClearCreation as any);
      window.removeEventListener('ai-creation-status-update', handleCreationStatus as any);
      window.removeEventListener('ai-creation-error', handleCreationError as any);
      window.removeEventListener('offline', handleOffline);
    };
  }, [proposalCards]);

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
      <div className={`w-full relative flex items-center justify-between px-3 py-1.5 ${
        creationPhase === 'creating'
          ? 'bg-black border-zinc-900'
          : creationPhase === 'thinking'
          ? 'bg-[#0f0c1b]/95 border-purple-900/40'
          : activeCreation
          ? 'bg-[#1a1c22]/90 border-zinc-700/60'
          : 'bg-[#120F17]/90 border-purple-900/30'
      } border-b shrink-0 z-30 shadow-xs backdrop-blur-sm transition-colors`}>
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
          {creationPhase === 'thinking' ? (
            <span className="text-purple-300 truncate font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              Réflexion en cours...
            </span>
          ) : creationPhase === 'creating' ? (
            <span className="text-purple-400 truncate font-medium">
              {getCreationBadgeLabel(generatingToolTitle)}
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
        {!activeCreation && creationPhase === 'idle' && (
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

        {/* ÉCRAN DE RÉFLEXION EN COURS (L'IA RÉFLÉCHIT ET ANALYSE AVANT DE CRÉER) */}
        {creationPhase === 'thinking' && (
          <div className="absolute inset-0 z-30 bg-[#0c0a13]/95 backdrop-blur-md flex flex-col items-center justify-center overflow-hidden animate-fadeIn select-none p-6 text-center">
            <div className="relative flex flex-col items-center max-w-sm w-full px-6 py-8 rounded-3xl bg-[#161320]/85 border border-purple-500/25 shadow-[0_0_50px_rgba(168,85,247,0.18)]">
              {/* Effet d'aura lumineuse pulsante */}
              <div className="absolute -top-10 -bottom-10 left-1/2 -translate-x-1/2 w-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

              {/* Icône d'intelligence avec pulsation douce */}
              <div className="relative mb-4 flex items-center justify-center">
                <div className="absolute w-20 h-20 bg-purple-500/25 rounded-full blur-xl animate-pulse" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-500/20 border border-purple-400/40 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-7 h-7 text-purple-300 animate-pulse" />
                </div>
              </div>

              {/* Badge discret de l'action ciblée */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 mb-3">
                <Brain className="w-3.5 h-3.5 text-purple-300" />
                <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider">
                  {generatingToolTitle || "Studio IA"}
                </span>
              </div>

              {/* Titre : Réflexion en cours */}
              <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span>Réflexion en cours</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" />
                </span>
              </h3>

              {/* Sous-texte explicatif */}
              <p className="text-xs sm:text-sm text-zinc-300/90 leading-relaxed max-w-xs mb-5">
                L'IA analyse votre document et décide de la meilleure création pédagogique...
              </p>

              {/* Bouton Annuler */}
              <button
                type="button"
                onClick={handleCancelGeneration}
                className="pointer-events-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer active:scale-95 shadow-xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Annuler</span>
              </button>
            </div>
          </div>
        )}

        {/* ÉCRAN NOIR PENDANT LA CRÉATION AVEC ANIMATION MAGICRINGS ET DIALOGUE EN DIRECT DE L'IA */}
        {creationPhase === 'creating' && (
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
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                      {getCreationBadgeLabel(generatingToolTitle)}
                    </span>
                  </div>

                  {/* Statut dynamique en temps réel */}
                  <p className="text-sm sm:text-base font-semibold text-white tracking-wide leading-relaxed animate-pulse">
                    {liveStatusText || "Création en cours..."}
                  </p>

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
        {activeCreation && creationPhase === 'idle' && (
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

      {/* Menu latéral droit glissant : Volet "Mes Créations" connectées à la base D1 */}
      <aside
        className={`absolute top-[44px] right-0 bottom-0 z-50 bg-[#120F17]/98 backdrop-blur-md border-l border-purple-900/40 shadow-[-16px_0_40px_rgba(0,0,0,0.7)] flex flex-col transition-transform duration-300 ease-in-out will-change-transform ${
          isRightFullscreen ? 'w-full sm:w-1/3 md:w-1/3' : 'w-[88%] sm:w-[65%] max-w-[360px]'
        } ${
          isRightDrawerOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* En-tête du volet latéral avec titre "Mes Créations", compteur et bouton rafraîchir / fermer */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-zinc-800/80 bg-[#14111d]/95 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
              Mes Créations
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-700/50 font-semibold">
              {savedCreations.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bouton rafraîchir la liste depuis la base D1 */}
            <button
              type="button"
              onClick={fetchUserCreations}
              disabled={isLoadingCreations}
              className="p-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs disabled:opacity-50"
              title="Actualiser les créations depuis la base de données"
              aria-label="Actualiser"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCreations ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            {/* Bouton croix pour fermer le volet */}
            <button
              type="button"
              onClick={() => setIsRightDrawerOpen(false)}
              className="p-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
              title="Fermer le volet"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barre de recherche dans les créations */}
        <div className="px-3.5 pt-3 pb-2 shrink-0 border-b border-zinc-800/50">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={creationSearch}
              onChange={(e) => setCreationSearch(e.target.value)}
              placeholder="Rechercher une création..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 focus:border-purple-600 focus:outline-none text-zinc-200 placeholder-zinc-500 text-xs transition-colors"
            />
            {creationSearch && (
              <button
                type="button"
                onClick={() => setCreationSearch('')}
                className="absolute right-2 text-zinc-400 hover:text-white cursor-pointer"
                title="Effacer la recherche"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Corps défilable : Liste des créations de l'utilisateur enregistrées en BDD */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar text-xs">
          {/* Bloc création en cours si une création est active */}
          {activeCreation && (
            <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Affichage en cours
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 font-medium">
                  {CREATION_NAME_MAP[activeCreation.toolType || activeCreation.type] || 'Module'}
                </span>
              </div>
              <p className="font-semibold text-white text-xs line-clamp-2">
                {activeCreation.title || 'Création Studio'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRightDrawerOpen(false)}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs text-center transition-colors cursor-pointer"
                >
                  Voir à l'écran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCreation(null);
                    setIsRightDrawerOpen(false);
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs text-center border border-zinc-700 transition-colors cursor-pointer"
                  title="Fermer la vue pour revenir aux modules du Studio"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* État de chargement */}
          {isLoadingCreations && savedCreations.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <p className="text-xs">Chargement de vos créations...</p>
            </div>
          ) : savedCreations.length === 0 ? (
            /* État vide si aucune création n'est enregistrée en BDD */
            <div className="py-10 px-4 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-zinc-200 text-xs">Aucune création enregistrée</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Lancez un questionnaire, une carte mentale, un résumé ou un devoir. Vos créations seront automatiquement enregistrées dans la base de données et accessibles ici à tout moment.
                </p>
              </div>
            </div>
          ) : filteredCreations.length === 0 ? (
            /* Aucun résultat de recherche */
            <div className="py-10 px-4 text-center space-y-2 text-zinc-400">
              <Search className="w-5 h-5 mx-auto text-zinc-500" />
              <p className="text-xs font-medium text-zinc-300">Aucun résultat trouvé</p>
              <p className="text-[11px] text-zinc-500">Aucune création ne correspond à « {creationSearch} »</p>
            </div>
          ) : (
            /* Liste des créations de l'utilisateur */
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                Toutes vos créations ({filteredCreations.length})
              </p>
              {filteredCreations.map((item) => {
                const isItemActive = activeCreation && activeCreation.id === item.id;
                const displayType = CREATION_NAME_MAP[item.toolType || item.type] || item.toolType || 'Création';
                const dateDisplay = formatCreationDate(item.createdAt || item.created_at);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenSavedCreation(item)}
                    className={`group w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      isItemActive
                        ? 'bg-purple-950/40 border-purple-700/60 shadow-sm'
                        : 'bg-[#1a1824]/90 hover:bg-[#252233] border-zinc-800/80 hover:border-purple-800/50'
                    }`}
                  >
                    {/* Icône du type de création */}
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 group-hover:scale-105 transition-transform">
                      {getCreationIcon(item.toolType || item.type)}
                    </div>

                    {/* Informations de la création */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-xs truncate ${isItemActive ? 'text-purple-200' : 'text-zinc-200 group-hover:text-white'}`}>
                        {item.title || 'Création sans titre'}
                      </p>

                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-900/50 font-medium">
                          {displayType}
                        </span>
                        {dateDisplay && (
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {dateDisplay}
                          </span>
                        )}
                      </div>

                      {item.sourceFileName && (
                        <p className="text-[10px] text-zinc-400 truncate mt-1 flex items-center gap-1">
                          <BookOpen className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{item.sourceFileName}</span>
                        </p>
                      )}
                    </div>

                    {/* Actions : Bouton de suppression */}
                    <div className="shrink-0 flex items-center self-center">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCreation(e, item.id)}
                        disabled={deletingId === item.id}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Supprimer cette création"
                        aria-label="Supprimer"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
export default RightMenu;
