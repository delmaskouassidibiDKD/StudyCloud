import React, { useState, useEffect } from 'react';
import {
  Maximize,
  Minimize,
  X,
  Clock,
  Plus,
  HelpCircle,
  ListChecks,
  CheckSquare,
  FileCheck2,
  Network,
  Workflow,
  Layers,
  FileText,
  FileDown,
  BarChart2,
  PenTool,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { DnaLogo } from './DnaLogo';
import { AiCreation, ModuleId } from './ai-creations/types';
import Questionnaire from './ai-creations/Questionnaire';
import QuestionnaireTest from './ai-creations/QuestionnaireTest';
import VraiOuFaux from './ai-creations/VraiOuFaux';
import VraiOuFauxTest from './ai-creations/VraiOuFauxTest';
import CarteMentale from './ai-creations/CarteMentale';
import CarteMentaleConceptuelle from './ai-creations/CarteMentaleConceptuelle';
import CarteMemoire from './ai-creations/CarteMemoire';
import Resume from './ai-creations/Resume';
import Pdf from './ai-creations/Pdf';
import Infographie from './ai-creations/Infographie';
import ExercicesEcrits from './ai-creations/ExercicesEcrits';
import DevoirComplet from './ai-creations/DevoirComplet';

interface RightMenuProps {
  isRightFullscreen: boolean;
  setIsRightFullscreen: (v: boolean) => void;
  isCenterFullscreen: boolean;
  mobilePreviewTab: number;
  activePreviewItem?: any;
  isMobileScreen?: boolean;
}

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: 'evaluation' | 'concept' | 'memorisation' | 'redaction';
  badge: string;
  colorClass: string;
  borderColor: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'questionnaire',
    label: 'Questionnaire',
    icon: HelpCircle,
    description: 'QCM interactif d’évaluation active avec feedback immédiat.',
    category: 'evaluation',
    badge: 'QCM Interactif',
    colorClass: 'bg-emerald-950/40 text-emerald-200 border-emerald-700/50 hover:bg-emerald-900/50 hover:border-emerald-500',
    borderColor: '#059669',
  },
  {
    id: 'questionnaire-test',
    label: 'Questionnaire Test',
    icon: ListChecks,
    description: 'Mêmes cartes en mode évaluation : réponses complètes avant le score et la correction.',
    category: 'evaluation',
    badge: 'Test Noté',
    colorClass: 'bg-teal-950/40 text-teal-200 border-teal-700/50 hover:bg-teal-900/50 hover:border-teal-500',
    borderColor: '#0d9488',
  },
  {
    id: 'vrai-ou-faux',
    label: 'Vrai ou Faux',
    icon: CheckSquare,
    description: 'Affirmations ciblées pour tester les réflexes critiques.',
    category: 'evaluation',
    badge: 'Vrai / Faux',
    colorClass: 'bg-green-950/40 text-green-200 border-green-700/50 hover:bg-green-900/50 hover:border-green-500',
    borderColor: '#16a34a',
  },
  {
    id: 'vrai-ou-faux-test',
    label: 'Vrai ou Faux Test',
    icon: FileCheck2,
    description: 'Liste d’affirmations à cocher : score et correction révélés après validation.',
    category: 'evaluation',
    badge: 'Test V/F',
    colorClass: 'bg-lime-950/40 text-lime-200 border-lime-700/50 hover:bg-lime-900/50 hover:border-lime-500',
    borderColor: '#65a30d',
  },
  {
    id: 'carte-mentale',
    label: 'Carte Mentale',
    icon: Network,
    description: 'Arborescence dynamique et modélisation des concepts.',
    category: 'concept',
    badge: 'Arborescence',
    colorClass: 'bg-violet-950/40 text-violet-200 border-violet-700/50 hover:bg-violet-900/50 hover:border-violet-500',
    borderColor: '#7c3aed',
  },
  {
    id: 'carte-mentale-2',
    label: 'Carte Mentale 2',
    icon: Workflow,
    description: 'Carte conceptuelle en blocs hiérarchiques avec connecteurs orthogonaux et ombres graphiques.',
    category: 'concept',
    badge: 'Conceptuelle',
    colorClass: 'bg-indigo-950/40 text-indigo-200 border-indigo-700/50 hover:bg-indigo-900/50 hover:border-indigo-500',
    borderColor: '#4f46e5',
  },
  {
    id: 'carte-memoire',
    label: 'Carte Mémoire',
    icon: Layers,
    description: 'Flashcards de mémorisation avec répétition espacée.',
    category: 'memorisation',
    badge: 'Flashcards',
    colorClass: 'bg-rose-950/40 text-rose-200 border-rose-700/50 hover:bg-rose-900/50 hover:border-rose-500',
    borderColor: '#e11d48',
  },
  {
    id: 'resume',
    label: 'Résumé',
    icon: FileText,
    description: 'Fiche synthétique structurée avec surlignage didactique.',
    category: 'redaction',
    badge: 'Fiche Résumé',
    colorClass: 'bg-blue-950/40 text-blue-200 border-blue-700/50 hover:bg-blue-900/50 hover:border-blue-500',
    borderColor: '#2563eb',
  },
  {
    id: 'pdf',
    label: 'PDF',
    icon: FileDown,
    description: 'Document prêt pour l’export, l’impression et la relecture.',
    category: 'redaction',
    badge: 'Export PDF',
    colorClass: 'bg-red-950/40 text-red-200 border-red-700/50 hover:bg-red-900/50 hover:border-red-500',
    borderColor: '#dc2626',
  },
  {
    id: 'infographie',
    label: 'Infographie',
    icon: BarChart2,
    description: 'Représentation visuelle des étapes et métriques cognitives.',
    category: 'concept',
    badge: 'Infographie',
    colorClass: 'bg-cyan-950/40 text-cyan-200 border-cyan-700/50 hover:bg-cyan-900/50 hover:border-cyan-500',
    borderColor: '#0891b2',
  },
  {
    id: 'exercices-ecrits',
    label: 'Exercices Écrits',
    icon: PenTool,
    description: 'Problèmes rédigés avec correction et conseils méthodologiques.',
    category: 'evaluation',
    badge: 'Exercices',
    colorClass: 'bg-amber-950/40 text-amber-200 border-amber-700/50 hover:bg-amber-900/50 hover:border-amber-500',
    borderColor: '#d97706',
  },
  {
    id: 'devoir-complet',
    label: 'Devoir Complet',
    icon: ClipboardCheck,
    description: 'Épreuve complète chronométrée sur 20 points avec corrigé.',
    category: 'evaluation',
    badge: 'Devoir / 20',
    colorClass: 'bg-purple-950/40 text-purple-200 border-purple-700/50 hover:bg-purple-900/50 hover:border-purple-500',
    borderColor: '#9333ea',
  }
];

export const CATEGORY_TABS = [
  { id: 'all', label: 'Tous (12)' },
  { id: 'evaluation', label: 'Évaluation' },
  { id: 'concept', label: 'Concepts' },
  { id: 'memorisation', label: 'Mémorisation' },
  { id: 'redaction', label: 'Rédaction & PDF' },
];

export function RightMenu({ 
  isRightFullscreen, 
  setIsRightFullscreen, 
  isCenterFullscreen, 
  mobilePreviewTab,
  activePreviewItem,
  isMobileScreen
}: RightMenuProps) {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeCreation, setActiveCreation] = useState<AiCreation | null>(null);
  const [activeTabModule, setActiveTabModule] = useState<ModuleId>('questionnaire');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingInfo, setGeneratingInfo] = useState<{ type: string; title: string; subtitle?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [historyItems, setHistoryItems] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_ai_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Synchronisation descendante depuis Cloudflare D1 au chargement
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getAiContents(userId).then(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const fromD1 = res.data.map((item: any) => {
          const mod = MODULES.find(m => m.id === item.tool_type);
          return {
            id: item.id,
            toolType: item.tool_type,
            title: item.title,
            dateStr: item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : "Récemment",
            colorClass: mod ? mod.colorClass.split(' ').find((c: string) => c.startsWith('text-')) || 'text-orange-300' : 'text-orange-300',
            desc: item.source_file_name ? `Généré pour "${item.source_file_name}"` : 'Création IA',
            pinned: Boolean(item.is_pinned),
            contentJson: item.contentJson,
            sourceFileName: item.source_file_name,
          };
        });

        setHistoryItems((prev: any[]) => {
          const ids = new Set(fromD1.map((d: any) => d.id));
          const localOnly = prev.filter((p: any) => !ids.has(p.id) && !p.id.startsWith('h'));
          const merged = [...fromD1, ...localOnly];
          localStorage.setItem('unifolder_ai_history', JSON.stringify(merged));
          return merged;
        });
      }
    }).catch(() => {});
  }, []);

  // Écoute des événements de création IA venant du Chat / Assistant
  useEffect(() => {
    const handleStart = (e: any) => {
      const { toolType, title, sourceFileName } = e.detail || {};
      setIsGenerating(true);
      const mod = MODULES.find(m => m.id === toolType);
      setGeneratingInfo({
        type: toolType || 'contenu',
        title: title || (mod ? mod.label : 'Création IA'),
        subtitle: sourceFileName ? `Document support : "${sourceFileName}"` : 'Analyse et modélisation en cours',
      });
    };

    const handleReady = (e: any) => {
      const { creation } = e.detail || {};
      if (creation) {
        setActiveCreation(creation);
        const mappedId = (creation.toolType as ModuleId) || 'questionnaire';
        setActiveTabModule(mappedId);
        setIsGenerating(false);
        setGeneratingInfo(null);

        // Sauvegarder dans l'historique local et D1
        setHistoryItems((prev: any[]) => {
          const updated = [
            {
              id: creation.id,
              toolType: creation.toolType,
              title: creation.title,
              dateStr: "À l'instant",
              colorClass: 'text-orange-300',
              desc: `Généré pour "${creation.sourceFileName || 'Document'}"`,
              pinned: false,
              contentJson: creation.content,
              sourceFileName: creation.sourceFileName,
            },
            ...prev.filter(p => p.id !== creation.id)
          ];
          localStorage.setItem('unifolder_ai_history', JSON.stringify(updated));
          return updated;
        });

        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        StudyCloudAPI.saveAiContent({
          id: creation.id,
          userId,
          fileId: creation.fileId || null,
          toolType: creation.toolType,
          title: creation.title,
          contentJson: creation.content,
          sourceFileName: creation.sourceFileName || '',
          isPinned: false,
        }).catch(() => {});
      }
    };

    const handleUpdate = (e: any) => {
      const { updatedContent, title } = e.detail || {};
      if (updatedContent && activeCreation) {
        const updated: AiCreation = {
          ...activeCreation,
          title: title || activeCreation.title,
          content: updatedContent,
          updatedAt: new Date().toISOString(),
          version: (activeCreation.version || 1) + 1,
        };
        setActiveCreation(updated);
        setIsGenerating(false);

        // Mise à jour D1
        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        StudyCloudAPI.saveAiContent({
          id: updated.id,
          userId,
          fileId: updated.fileId || null,
          toolType: updated.toolType,
          title: updated.title,
          contentJson: updated.content,
          sourceFileName: updated.sourceFileName || '',
          isPinned: Boolean(updated.isPinned),
        }).catch(() => {});
      }
    };

    window.addEventListener('ai-creation-start', handleStart as any);
    window.addEventListener('ai-creation-ready', handleReady as any);
    window.addEventListener('ai-creation-update', handleUpdate as any);

    return () => {
      window.removeEventListener('ai-creation-start', handleStart as any);
      window.removeEventListener('ai-creation-ready', handleReady as any);
      window.removeEventListener('ai-creation-update', handleUpdate as any);
    };
  }, [activeCreation]);

  const saveHistory = (items: any[]) => {
    setHistoryItems(items);
    localStorage.setItem('unifolder_ai_history', JSON.stringify(items));
  };

  const sortedHistory = [...historyItems].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const handleHistoryClick = (item: any) => {
    const targetType = (item.toolType as ModuleId) || 'questionnaire';
    setActiveTabModule(targetType);
    if (item.contentJson) {
      setActiveCreation({
        id: item.id,
        toolType: targetType,
        title: item.title,
        content: item.contentJson,
        sourceFileName: item.sourceFileName,
      });
    } else {
      setActiveCreation({
        id: item.id,
        toolType: targetType,
        title: item.title,
        content: null,
        sourceFileName: item.sourceFileName,
      });
    }
    setIsRightSidebarOpen(false);
  };

  // Clic 1-clic direct sur l'un des 12 boutons officiels de création
  const handleProposalClick = (mod: ModuleDefinition) => {
    if (isGenerating) return;

    const docName = activePreviewItem?.name || 'Document sélectionné';
    setIsGenerating(true);
    setGeneratingInfo({
      type: mod.id,
      title: mod.label,
      subtitle: `Génération directe pour "${docName}"...`,
    });
    setActiveTabModule(mod.id);

    // Déclenche l'événement global avec requested_type direct pour Gemini
    const promptText = `Génère ${mod.label} à partir du document "${docName}"`;
    window.dispatchEvent(
      new CustomEvent('auto-prompt', {
        detail: {
          prompt: promptText,
          requested_type: mod.id,
        },
      })
    );
  };

  // Rendu du composant correspondant au module actif
  const renderActiveCreation = () => {
    const currentType = activeCreation?.toolType || activeTabModule;
    const currentData = activeCreation?.content;

    switch (currentType) {
      case 'questionnaire':
        return <Questionnaire data={currentData} />;
      case 'questionnaire-test':
        return <QuestionnaireTest data={currentData} />;
      case 'vrai-ou-faux':
        return <VraiOuFaux data={currentData} />;
      case 'vrai-ou-faux-test':
        return <VraiOuFauxTest data={currentData} />;
      case 'carte-mentale':
        return <CarteMentale />;
      case 'carte-mentale-2':
        return <CarteMentaleConceptuelle />;
      case 'carte-memoire':
      case 'flashcards':
        return <CarteMemoire />;
      case 'resume':
      case 'summary':
        return <Resume />;
      case 'pdf':
      case 'document':
        return <Pdf />;
      case 'infographie':
      case 'infographic':
        return <Infographie />;
      case 'exercices-ecrits':
        return <ExercicesEcrits />;
      case 'devoir-complet':
        return <DevoirComplet />;
      case 'quiz':
        return <Questionnaire data={currentData} />;
      case 'mindmap':
        return <CarteMentale />;
      default:
        return <Questionnaire data={currentData} />;
    }
  };

  return (
    <div className={`w-full h-full pointer-events-auto relative bg-[#1e2024] flex flex-col overflow-hidden ${isCenterFullscreen ? 'hidden' : (isMobileScreen ? (mobilePreviewTab === 2 || isRightFullscreen ? 'flex' : 'hidden') : 'flex')}`}>
      {/* Barre supérieure en haut dans le creux : Bouton Zoom (jaune) + Bouton + (Retour aux 12 boutons) + Bouton Historique (horloge) */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-[#23252a] border-b border-zinc-700/60 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Bouton Zoom jaune */}
          <button
            type="button"
            onClick={() => setIsRightFullscreen(!isRightFullscreen)}
            className="p-1.5 bg-yellow-400 rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center"
            title={isRightFullscreen ? "Réduire" : "Plein écran"}
          >
            {isRightFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Bouton + placé derrière le bouton zoom jaune (retour à la sélection des 12 modules) */}
          <button
            type="button"
            onClick={() => {
              setActiveCreation(null);
              setIsGenerating(false);
            }}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
            title="Nouvelle création / Afficher les 12 modules"
          >
            <Plus className="w-4 h-4 text-orange-400 font-black" />
          </button>
        </div>

        {/* Titre ou indicateur d'état */}
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 truncate px-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="truncate">
            {activeCreation ? activeCreation.title : 'Espace Création IA (12 Modules)'}
          </span>
        </div>

        {/* Bouton Horloge (Historique des créations) */}
        <button
          type="button"
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className="p-1.5 bg-white rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-stone-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center shrink-0"
          title={isRightSidebarOpen ? "Fermer l'historique" : "Historique des créations"}
        >
          {isRightSidebarOpen ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        </button>
      </div>

      {/* Barre de navigation horizontale à onglets (accessible dès qu'une création est active ou en cours) */}
      {activeCreation && (
        <div className="w-full bg-[#181a1e] border-b border-zinc-800 px-3 py-1.5 overflow-x-auto custom-scrollbar shrink-0 z-40">
          <div className="flex items-center gap-1.5 min-w-max">
            {MODULES.map((item) => {
              const currentId = activeCreation?.toolType || activeTabModule;
              const isActive = currentId === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTabModule(item.id);
                    if (activeCreation) {
                      setActiveCreation({
                        ...activeCreation,
                        toolType: item.id,
                      });
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Creation Area */}
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-start min-h-0 bg-[#16181f] text-zinc-100">
        {/* ÉTAT 1 : ANIMATION ADN PENDANT LA CRÉATION */}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-6 animate-fadeIn h-full my-auto text-center px-4 max-w-sm py-12">
            <div className="relative flex items-center justify-center w-28 h-28">
              {/* Outer rotating dashed ring */}
              <div className="absolute inset-0 border-3 border-dashed border-orange-500/50 rounded-full animate-[spin_5s_linear_infinite]" />
              {/* Inner rotating solid ring (reverse) */}
              <div className="absolute inset-2.5 border-2 border-orange-400/70 rounded-full animate-[spin_3.5s_linear_reverse_infinite]" />
              {/* Center glowing DNA icon */}
              <div className="absolute animate-pulse text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.9)]">
                <DnaLogo className="w-12 h-12" glow={true} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 mt-2">
              <span className="text-orange-500 font-black text-xl tracking-wide animate-pulse">
                Je suis en train de créer...
              </span>
              <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                {generatingInfo?.title || "Génération du module IA"}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">
                {generatingInfo?.subtitle || "Structuration des données en temps réel"}
              </span>
            </div>
          </div>
        ) : activeCreation ? (
          /* ÉTAT 2 : CRÉATION ACTIVE INTERACTIVE (RENDU DU MODULE SÉLECTIONNÉ) */
          <div className="w-full h-full flex flex-col animate-fadeIn min-h-0 bg-[#16181f]">
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar scroll-smooth min-h-0">
              {renderActiveCreation()}
            </div>
          </div>
        ) : (
          /* ÉTAT 3 : LES 12 BOUTONS OFFICIELS DE CRÉATION 1-CLIC */
          <div className="w-full max-w-5xl mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
            <div className="text-center space-y-1.5 max-w-xl mx-auto pt-1 sm:pt-2">
              <h2 className="text-lg sm:text-2xl font-black text-zinc-100 tracking-tight">
                Que souhaitez-vous concevoir ?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
                Cliquez sur un outil ci-dessous pour lancer instantanément la création sans écrire à l’IA, ou demandez-le lui directement dans le chat.
              </p>

              {/* Filtres thématiques par catégorie */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
                {CATEGORY_TABS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                      selectedCategory === cat.id
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-[#21242d] text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 hover:border-zinc-500'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grille responsive des 12 modules */}
            <div
              id="ai-modules-grid"
              className={`grid gap-3 w-full ${
                isRightFullscreen
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  : 'grid-cols-1 min-[520px]:grid-cols-2'
              }`}
            >
              {(selectedCategory === 'all' ? MODULES : MODULES.filter(m => m.category === selectedCategory)).map((mod, idx) => {
                const IconComp = mod.icon;
                return (
                  <button
                    key={mod.id}
                    id={`btn-creation-module-${mod.id}`}
                    type="button"
                    onClick={() => handleProposalClick(mod)}
                    className="group relative flex flex-col text-left p-3.5 sm:p-4 rounded-xl border border-zinc-700/60 bg-[#21242d] hover:bg-[#272b36] hover:border-orange-500/70 hover:shadow-lg hover:shadow-black/25 transition-all duration-200 cursor-pointer active:scale-[0.99] select-none shadow-xs"
                    style={{ animationDelay: `${idx * 25}ms` }}
                  >
                    {/* En-tête : Icône stylisée + Badge court */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs"
                        style={{ backgroundColor: `${mod.borderColor}22`, color: mod.borderColor }}
                      >
                        <IconComp className="w-4.5 h-4.5" />
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 whitespace-nowrap"
                        style={{
                          backgroundColor: `${mod.borderColor}18`,
                          color: mod.borderColor,
                          border: `1px solid ${mod.borderColor}35`
                        }}
                      >
                        {mod.badge}
                      </span>
                    </div>

                    {/* Titre */}
                    <h3 className="text-sm font-bold text-zinc-100 group-hover:text-orange-400 transition-colors line-clamp-1 mb-1">
                      {mod.label}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {mod.description}
                    </p>

                    {/* Footer / Bouton d'action */}
                    <div className="mt-3 pt-2 border-t border-zinc-700/50 flex items-center justify-between text-[11px] font-semibold text-orange-400 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>Lancer la création</span>
                      <span className="text-xs font-black transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right History Sidebar */}
      <div 
        className={`absolute top-[44px] right-0 bottom-0 z-40 bg-[#1e2024] border-l border-zinc-800 text-white flex flex-col p-4 transition-transform duration-300 ease-in-out ${
          isRightFullscreen ? 'w-full md:w-[360px] shadow-2xl' : 'w-full'
        } ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col gap-2 border-b border-zinc-700 pb-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-100">Historique des Créations</h3>
            </div>
            {historyItems.length > 0 && (
              <button 
                onClick={() => {
                  if (selectedHistoryIds.length === historyItems.length) {
                    setSelectedHistoryIds([]);
                  } else {
                    setSelectedHistoryIds(historyItems.map(h => h.id));
                  }
                }}
                className="text-xs text-[#70a5ff] hover:text-blue-400 font-semibold cursor-pointer"
              >
                {selectedHistoryIds.length === historyItems.length ? 'Tout décocher' : 'Tout cocher'}
              </button>
            )}
          </div>

          {selectedHistoryIds.length > 0 && (
            <div className="flex items-center justify-between bg-red-900/20 border border-red-900/50 p-2 rounded-lg">
              <span className="text-xs text-red-200">{selectedHistoryIds.length} sélectionné(s)</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedHistoryIds([])}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer px-2 py-1"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    const updated = historyItems.filter(h => !selectedHistoryIds.includes(h.id));
                    saveHistory(updated);
                    selectedHistoryIds.forEach(id => {
                      try { StudyCloudAPI.deleteAiContent(id).catch(() => {}); } catch {}
                    });
                    setSelectedHistoryIds([]);
                  }}
                  className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1 rounded cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 text-zinc-400 text-xs overflow-y-auto pr-1 custom-scrollbar space-y-2">
          {sortedHistory.length === 0 ? (
            <p className="text-center text-zinc-500 my-8">Aucune création dans l'historique</p>
          ) : (
            sortedHistory.map(item => (
              <div 
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className="bg-[#26282d] p-3 rounded-xl border border-zinc-700/60 hover:bg-[#2e3137] hover:border-zinc-500 transition-all cursor-pointer group flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${item.colorClass || 'text-orange-300'} truncate`}>
                    {item.title}
                  </span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{item.dateStr}</span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">{item.desc}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
