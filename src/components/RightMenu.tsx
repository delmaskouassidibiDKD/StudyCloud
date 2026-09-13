import React, { useState } from 'react';
import { Maximize, Minimize, Menu, X, AlignLeft, Brain, Copy, MessageSquare, Presentation, Clock, ArrowLeft, Loader2, Sparkles, Dna, MoreVertical, Pin, CheckSquare, Square, Trash2 } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';

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
];

const INITIAL_HISTORY = [
  { id: 'h1', title: 'Carte mentale', dateStr: "Aujourd'hui", colorClass: 'text-violet-300', desc: 'Générée pour "Chapitre_1_Biologie.pdf"', pinned: false },
  { id: 'h2', title: 'Résumé', dateStr: "Hier", colorClass: 'text-blue-300', desc: 'Créé pour "Cours_Economie.docx"', pinned: false },
  { id: 'h3', title: 'Questionnaire', dateStr: "Il y a 3 jours", colorClass: 'text-emerald-300', desc: 'Généré pour "Histoire_Geo_Intro.pdf"', pinned: false },
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
  const [activeHistoryContent, setActiveHistoryContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState(() => {
    try {
      const saved = localStorage.getItem('unifolder_ai_history');
      return saved ? JSON.parse(saved) : INITIAL_HISTORY;
    } catch {
      return INITIAL_HISTORY;
    }
  });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const saveHistory = (items: any[]) => {
    setHistoryItems(items);
    localStorage.setItem('unifolder_ai_history', JSON.stringify(items));
  };

  const sortedHistory = [...historyItems].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const handleHistoryClick = (title: string) => {
    setActiveHistoryContent(title);
    setIsRightSidebarOpen(false);
  };

  const handleProposalClick = (prop: typeof PROPOSALS[0]) => {
    if (isGenerating) return;
    
    // Dispatch event to LeftMenu & AssistantChat
    const promptText = `${prop.title} à partir du fichier "${activePreviewItem?.name || 'sélectionné'}"`;
    window.dispatchEvent(new CustomEvent('auto-prompt', { detail: { prompt: promptText } }));

    // Show loading in RightMenu
    setIsGenerating(prop.id);

    // Simulate AI generation delay
    setTimeout(() => {
      setIsGenerating(null);
      setActiveHistoryContent(prop.title);

      const newItem = {
        id: 'ai-' + Date.now(),
        title: prop.title,
        dateStr: "À l'instant",
        colorClass: prop.colorClass.split(' ').find(c => c.startsWith('text-')) || 'text-orange-300',
        desc: `Généré pour "${activePreviewItem?.name || 'Document sélectionné'}"`,
        pinned: false,
      };

      setHistoryItems((prev: any[]) => {
        const updated = [newItem, ...prev];
        localStorage.setItem('unifolder_ai_history', JSON.stringify(updated));
        return updated;
      });

      // Background sync to Cloudflare D1
      try {
        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        StudyCloudAPI.saveAiContent({
          id: newItem.id,
          userId,
          fileId: activePreviewItem?.id || null,
          toolType: prop.id,
          title: prop.title,
          contentJson: { desc: newItem.desc },
          sourceFileName: activePreviewItem?.name || '',
          isPinned: false,
        }).catch(() => {});
      } catch {}
    }, 4000);
  };

  return (
    <div className={`w-full h-full pointer-events-auto relative bg-[#1e2024] overflow-x-hidden overflow-y-auto ${isCenterFullscreen ? 'hidden' : (isMobileScreen ? (mobilePreviewTab === 2 || isRightFullscreen ? 'flex' : 'hidden') : 'flex')}`}>
      {/* Fullscreen Toggle Button for Right Area */}
      {(!isRightSidebarOpen || isRightFullscreen) && (
        <button
          onClick={() => setIsRightFullscreen(!isRightFullscreen)}
          className="hidden md:flex absolute top-[72px] md:top-[76px] left-1 md:left-2 z-50 p-1 bg-yellow-400 rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900"
          title={isRightFullscreen ? "Réduire" : "Plein écran"}
        >
          {isRightFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
        </button>
      )}

      {/* Right Sidebar Toggle / Close Button */}
      <button
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className={`${isRightFullscreen ? 'fixed' : 'absolute'} top-[72px] md:top-[76px] right-2 md:right-4 z-[99999] p-1.5 bg-white rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-stone-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center`}
        title={isRightSidebarOpen ? "Fermer le menu" : "Ouvrir le menu latéral"}
      >
        {isRightSidebarOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
      </button>

      {/* Main Content Area (Proposals List or History Content) */}
      <div className="flex-1 w-full pt-[90px] px-4 md:px-6 pb-6 h-full flex flex-col items-center justify-center">
        {activeHistoryContent ? (
          <div className="w-full h-full flex flex-col animate-fadeIn">
            <div className="w-full flex justify-start items-center mb-4 pl-1">
              <button 
                onClick={() => setActiveHistoryContent(null)} 
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-semibold">Retour</span>
              </button>
            </div>
            
            <div className="bg-[#2a2d33] w-full flex-1 overflow-y-auto custom-scrollbar border border-zinc-700/50 flex flex-col rounded-3xl p-6 sm:p-8">
               <h2 className="text-xl sm:text-2xl font-black text-white mb-6 tracking-wide">
                 {activeHistoryContent}
               </h2>
               <div className="space-y-4 flex-1 flex flex-col">
                 <p className="text-sm text-zinc-300 leading-relaxed">
                   Ceci est le contenu factice qui s'affiche après avoir sélectionné <strong>{activeHistoryContent}</strong> dans l'historique. 
                 </p>
                 <div className="w-full flex-1 min-h-[150px] bg-[#1e2024] rounded-xl border border-zinc-800/50 flex items-center justify-center opacity-70">
                   <span className="text-xs font-mono text-zinc-500">[ Zone de visualisation ]</span>
                 </div>
                 <p className="text-sm text-zinc-300 leading-relaxed">
                   Dans le futur, cette zone contiendra le résultat réel (une carte mentale interactive, un rapport détaillé, un tableau de bord, etc.) et couvrira l'espace principal pour remplacer les boutons d'action.
                 </p>
               </div>
            </div>
          </div>
        ) : activePreviewItem ? (
          <div className="w-full h-full max-w-xs mx-auto flex flex-col items-center justify-center">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center gap-6 animate-fadeIn h-full">
                <div className="relative flex items-center justify-center w-24 h-24">
                  {/* Outer rotating dashed ring */}
                  <div className="absolute inset-0 border-2 border-dashed border-orange-400/40 rounded-full animate-[spin_4s_linear_infinite]" />
                  {/* Inner rotating solid ring (reverse) */}
                  <div className="absolute inset-2 border border-orange-400/60 rounded-full animate-[spin_3s_linear_reverse_infinite]" />
                  {/* Center glowing icon */}
                  <div className="absolute animate-pulse text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.8)]">
                    <Dna className="w-8 h-8" />
                  </div>
                </div>
                <div className="text-zinc-400 font-medium tracking-wide flex flex-col items-center gap-2 mt-4 text-center">
                  <span className="text-orange-400 font-bold text-lg animate-pulse drop-shadow-[0_0_10px_rgba(251,146,60,0.6)]">Génération en cours...</span>
                  <span className="text-sm opacity-70">Traitement de votre requête par l'assistante DKD</span>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-stone-400 text-sm font-semibold mb-8 text-center uppercase tracking-widest">
                  Actions
                </h2>
                <div className="flex flex-col gap-4 w-full">
                  {PROPOSALS.map((prop, idx) => (
                    <button
                      key={prop.id}
                      onClick={() => handleProposalClick(prop)}
                      className={`w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-md border transition-all duration-300 cursor-pointer group ${prop.colorClass} hover:shadow-[0_8px_16px_rgba(0,0,0,0.2)] hover:-translate-y-1 animate-fadeIn`}
                      style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
                    >
                      <prop.icon className="w-5 h-5 opacity-90 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300" />
                      <span className="font-bold text-[14px] sm:text-[15px] tracking-wide">{prop.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-stone-500 text-sm">
            Aucun fichier sélectionné
          </div>
        )}
      </div>

      <div 
        className={`absolute top-0 right-0 bottom-0 z-40 bg-[#1e2024] border-l border-zinc-800 pt-[100px] text-white flex flex-col p-6 transition-transform duration-300 ease-in-out ${
          isRightFullscreen ? 'w-full md:w-[350px] shadow-2xl' : 'w-full'
        } ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col gap-2 border-b border-zinc-700 pb-4 mb-4 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-zinc-100">Historique</h3>
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
                 className="text-xs text-[#70a5ff] hover:text-blue-400 font-medium cursor-pointer"
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
        <div className="flex-1 text-zinc-400 text-sm overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-3">
            {sortedHistory.map(item => (
              <div 
                key={item.id}
                className="bg-[#2a2d33] p-3.5 rounded-xl border border-zinc-700/50 hover:bg-[#31353a] transition-colors group relative flex flex-col"
              >
                <div className="flex justify-between items-start mb-1.5 gap-2 w-full">
                   <div className="flex items-start gap-2 flex-1">
                      <div 
                         onClick={(e) => {
                           e.stopPropagation();
                           setSelectedHistoryIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
                         }}
                         className="cursor-pointer shrink-0 mt-0.5"
                      >
                         {selectedHistoryIds.includes(item.id) ? <CheckSquare className="w-4 h-4 text-[#70a5ff]" /> : <Square className="w-4 h-4 text-zinc-500 opacity-50 hover:opacity-100 transition-opacity" />}
                      </div>
                      <div 
                        className="flex-1 cursor-pointer" 
                        onClick={() => handleHistoryClick(item.title)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold ${item.colorClass} uppercase tracking-wide`}>{item.title}</span>
                          {item.pinned && <Pin className="w-3 h-3 text-yellow-500 fill-yellow-500/20" />}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">{item.dateStr}</span>
                      </div>
                   </div>
                   
                   {/* Three dots menu */}
                   <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                        className="p-1 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {openMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-[#1e2024] border border-zinc-700 rounded-lg shadow-xl z-[100] py-1 overflow-hidden">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = historyItems.map(h => h.id === item.id ? { ...h, pinned: !h.pinned } : h);
                              saveHistory(updated);
                              setOpenMenuId(null);
                              try {
                                StudyCloudAPI.togglePinAiContent(item.id, !item.pinned).catch(() => {});
                              } catch {}
                            }}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                          >
                            <Pin className="w-3 h-3" />
                            {item.pinned ? 'Désépingler' : 'Épingler'}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = historyItems.filter(h => h.id !== item.id);
                              saveHistory(updated);
                              setOpenMenuId(null);
                              try {
                                StudyCloudAPI.deleteAiContent(item.id).catch(() => {});
                              } catch {}
                            }}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-900/30 text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Supprimer
                          </button>
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="flex items-center gap-2 mt-1 w-full pl-6">
                   <p 
                     className="text-xs text-zinc-300 line-clamp-2 cursor-pointer flex-1"
                     onClick={() => handleHistoryClick(item.title)}
                   >
                     {item.desc}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
