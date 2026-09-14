import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, Menu, X, AlignLeft, Brain, Copy, MessageSquare, Presentation, Clock, Loader2, Sparkles, Pin, CheckSquare, Square, Trash2, FileText, Check, Plus } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { DnaLogo } from './DnaLogo';
import { AiCreation, AiCreationType } from './ai-creations/types';
import { SummaryCardView } from './ai-creations/SummaryCardView';
import { InteractiveQuizView } from './ai-creations/InteractiveQuizView';
import { MindMapView } from './ai-creations/MindMapView';
import { InfographicView } from './ai-creations/InfographicView';
import { ExportableDocumentView } from './ai-creations/ExportableDocumentView';
import { parseOrBuildAiCreation } from '../services/aiCreationGenerator';

interface RightMenuProps {
  isRightFullscreen: boolean;
  setIsRightFullscreen: (v: boolean) => void;
  isCenterFullscreen: boolean;
  mobilePreviewTab: number;
  activePreviewItem?: any;
  isMobileScreen?: boolean;
}

const PROPOSALS = [
  { id: 'summary', title: 'Générer un résumé détaillé', icon: AlignLeft, colorClass: 'bg-blue-900/40 text-blue-200 border-blue-800/50 hover:bg-blue-900/60' },
  { id: 'mindmap', title: 'Créer une carte mentale', icon: Brain, colorClass: 'bg-violet-900/40 text-violet-200 border-violet-800/50 hover:bg-violet-900/60' },
  { id: 'flashcards', title: 'Concevoir des cartes mémoire', icon: Copy, colorClass: 'bg-rose-900/40 text-rose-200 border-rose-800/50 hover:bg-rose-900/60' },
  { id: 'quiz', title: 'Préparer un questionnaire', icon: MessageSquare, colorClass: 'bg-emerald-900/40 text-emerald-200 border-emerald-800/50 hover:bg-emerald-900/60' },
  { id: 'infographic', title: 'Élaborer une infographie', icon: Presentation, colorClass: 'bg-cyan-900/40 text-cyan-200 border-cyan-800/50 hover:bg-cyan-900/60' },
  { id: 'document', title: 'Rédiger une fiche d\'étude (PDF/Word)', icon: FileText, colorClass: 'bg-orange-900/40 text-orange-200 border-orange-800/50 hover:bg-orange-900/60' },
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingInfo, setGeneratingInfo] = useState<{ type: string; title: string; subtitle?: string } | null>(null);
  
  const [historyItems, setHistoryItems] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_ai_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Synchronisation descendante depuis Cloudflare D1 au chargement
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getAiContents(userId).then(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const fromD1 = res.data.map((item: any) => {
          const prop = PROPOSALS.find(p => p.id === item.tool_type);
          return {
            id: item.id,
            toolType: item.tool_type,
            title: item.title,
            dateStr: item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : "Récemment",
            colorClass: prop ? prop.colorClass.split(' ').find((c: string) => c.startsWith('text-')) || 'text-orange-300' : 'text-orange-300',
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
      setGeneratingInfo({
        type: toolType || 'contenu',
        title: title || 'Création IA',
        subtitle: sourceFileName ? `Document support : "${sourceFileName}"` : 'Analyse et modélisation en cours',
      });
    };

    const handleReady = (e: any) => {
      const { creation } = e.detail || {};
      if (creation) {
        setActiveCreation(creation);
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
    // Si nous avons le payload JSON complet, restaurer la création
    if (item.contentJson) {
      setActiveCreation({
        id: item.id,
        toolType: item.toolType || 'summary',
        title: item.title,
        content: item.contentJson,
        sourceFileName: item.sourceFileName,
      });
    } else {
      // Reconstituer une structure par défaut
      const generated = parseOrBuildAiCreation(item.toolType || 'summary', '', item.sourceFileName || item.title, '');
      setActiveCreation({
        id: item.id,
        toolType: item.toolType || 'summary',
        title: item.title,
        content: generated.content,
        sourceFileName: item.sourceFileName,
      });
    }
    setIsRightSidebarOpen(false);
  };

  const handleProposalClick = (prop: typeof PROPOSALS[0]) => {
    if (isGenerating) return;
    
    // Déclenche l'événement global pour que l'IA du chat le prenne en charge avec le texte extrait
    const docName = activePreviewItem?.name || 'Document sélectionné';
    const promptText = `${prop.title} à partir du document "${docName}"`;
    window.dispatchEvent(new CustomEvent('auto-prompt', { detail: { prompt: promptText } }));
  };

  const renderActiveCreation = () => {
    if (!activeCreation) return null;

    switch (activeCreation.toolType) {
      case 'summary':
        return (
          <SummaryCardView
            title={activeCreation.title}
            sourceFileName={activeCreation.sourceFileName}
            content={activeCreation.content}
          />
        );
      case 'quiz':
        return (
          <InteractiveQuizView
            title={activeCreation.title}
            sourceFileName={activeCreation.sourceFileName}
            content={activeCreation.content}
          />
        );
      case 'mindmap':
        return (
          <MindMapView
            title={activeCreation.title}
            sourceFileName={activeCreation.sourceFileName}
            content={activeCreation.content}
          />
        );
      case 'infographic':
        return (
          <InfographicView
            title={activeCreation.title}
            sourceFileName={activeCreation.sourceFileName}
            content={activeCreation.content}
          />
        );
      case 'document':
      default:
        return (
          <ExportableDocumentView
            title={activeCreation.title}
            sourceFileName={activeCreation.sourceFileName}
            content={activeCreation.content}
          />
        );
    }
  };

  return (
    <div className={`w-full h-full pointer-events-auto relative bg-[#1e2024] flex flex-col overflow-hidden ${isCenterFullscreen ? 'hidden' : (isMobileScreen ? (mobilePreviewTab === 2 || isRightFullscreen ? 'flex' : 'hidden') : 'flex')}`}>
      {/* Barre supérieure en haut dans le creux : Bouton Zoom (jaune) + Bouton + (Retour aux actions) + Bouton Historique (horloge) */}
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

          {/* Bouton + placé derrière le bouton zoom jaune (retour aux actions sans aucun texte) */}
          <button
            type="button"
            onClick={() => {
              setActiveCreation(null);
              setIsGenerating(false);
            }}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
            title="Nouvelle création / Retour aux actions"
          >
            <Plus className="w-4 h-4 text-orange-400 font-black" />
          </button>
        </div>

        {/* Bouton Horloge (Historique des créations) */}
        <button
          type="button"
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className="p-1.5 bg-white rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-stone-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center"
          title={isRightSidebarOpen ? "Fermer l'historique" : "Historique des créations"}
        >
          {isRightSidebarOpen ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Creation Area */}
      <div className="flex-1 w-full p-3 sm:p-5 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start min-h-0">
        {/* ÉTAT 1 : ANIMATION ADN PENDANT LA CRÉATION */}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-6 animate-fadeIn h-full my-auto text-center px-4 max-w-sm">
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
              <span className="text-orange-400 font-black text-xl tracking-wide animate-pulse drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">
                Je suis en train de créer...
              </span>
              <span className="text-xs sm:text-sm font-semibold text-zinc-300">
                {generatingInfo?.title || "Génération du contenu pédagogique"}
              </span>
              <span className="text-[11px] text-zinc-500 font-medium">
                {generatingInfo?.subtitle || "Structuration des données en temps réel"}
              </span>
            </div>
          </div>
        ) : activeCreation ? (
          /* ÉTAT 2 : CRÉATION ACTIVE INTERACTIVE (RÉSUMÉ, QUIZ, MINDMAP, INFOGRAPHIE, DOCUMENT) */
          <div className="w-full h-full flex flex-col animate-fadeIn min-h-0">
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar scroll-smooth min-h-0 pr-1">
              {renderActiveCreation()}
            </div>
          </div>
        ) : activePreviewItem ? (
          /* ÉTAT 3 : MENU DES PROPOSITIONS D'ACTION INITIALES */
          <div className="w-full h-full max-w-sm mx-auto flex flex-col items-center justify-center my-auto">
            <div className="text-center mb-6">
              <h2 className="text-base sm:text-lg font-bold text-white">
                Que souhaitez-vous concevoir ?
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Choisissez un format ou demandez directement à l'assistante dans le chat.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {PROPOSALS.map((prop, idx) => (
                <button
                  key={prop.id}
                  onClick={() => handleProposalClick(prop)}
                  className={`w-full flex items-center justify-start gap-3.5 py-3 px-4 rounded-xl border transition-all duration-200 cursor-pointer group ${prop.colorClass} hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 select-none`}
                  style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
                >
                  <div className="p-2 rounded-lg bg-black/20 group-hover:scale-110 transition-transform">
                    <prop.icon className="w-4 h-4 opacity-90" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm tracking-wide text-left flex-1">{prop.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* AUCUN DOCUMENT SÉLECTIONNÉ */
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs text-center gap-2">
            <DnaLogo className="w-8 h-8 opacity-40 text-zinc-500" />
            <span>Sélectionnez un document pour activer l'espace de création</span>
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
