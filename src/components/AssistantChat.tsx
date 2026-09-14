import React, { useState, useRef, useEffect } from 'react';
import { Send, ThumbsUp, ThumbsDown, Copy, Check, X, FileText, Sparkles, Loader2, Clock, Plus, Trash2, Search, MessageSquare, ChevronRight, Brain, Presentation, ChevronDown, ChevronUp, Layers, Zap } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { FileIconBadge } from './FileIconBadge';
import { MathText } from './MathText';
import { sendChatMessageToAi, saveAiReaction, removeAiAttachment, StudyCloudAPI } from '../services/api';
import { extractDocumentText } from '../services/documentTextExtractor';
import { parseOrBuildAiCreation } from '../services/aiCreationGenerator';
import { AiCreation, AiCreationType } from './ai-creations/types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isStreaming?: boolean;
  reaction?: 'like' | 'dislike' | null;
  attachedFileName?: string;
  createdAt?: string;
  model?: string;
  isPowerMode?: boolean;
}

interface ConversationItem {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

const ChatMessageText = ({ text, isUser, isStreaming }: { text: string; isUser: boolean; isStreaming?: boolean }) => {
  const [expanded, setExpanded] = useState(false);

  const maxUserPromptLength = 350;
  const isLongUserMsg = isUser && text.length > maxUserPromptLength;
  const displayText = isLongUserMsg && !expanded ? text.slice(0, maxUserPromptLength) + '...' : text;

  if (isUser) {
    return (
      <div className="flex flex-col w-full items-end">
        <p className="whitespace-pre-wrap break-words text-left w-full">
          {displayText}
        </p>
        {isLongUserMsg && (
          <button 
            type="button"
            onClick={() => setExpanded(!expanded)} 
            className="mt-1.5 text-[10px] font-bold underline transition-colors cursor-pointer text-orange-200 hover:text-white"
          >
            {expanded ? 'Masquer' : 'Démasquer'}
          </button>
        )}
      </div>
    );
  }

  const lines = displayText.split('\n');

  return (
    <div className="flex flex-col w-full items-start">
      <div className="space-y-2 text-zinc-200 text-left w-full leading-relaxed font-medium">
        {lines.map((line, idx) => {
          const isLastLine = idx === lines.length - 1;
          const trimmed = line.trim();

          // Détection d'une carte de recommandation interactive (ex: Recommandé : flashcards)
          const recoMatch = trimmed.match(/^(?:\[?💡?\s*Recommand[ée]\s*:\s*([a-zA-ZÀ-ÿ\s]+)\]?)/i);
          if (recoMatch) {
            const recoType = recoMatch[1].trim().toLowerCase();
            let cardTitle = `Fiches & exercices de révision`;
            let cardDesc = `Un ensemble interactif optimisé pour mémoriser rapidement les concepts clés de ce chapitre.`;
            if (recoType.includes('flashcard') || recoType.includes('carte')) {
              cardTitle = `Flashcards & cartes mémoire`;
              cardDesc = `Un jeu de cartes interactif pour associer rapidement chaque formule et notion essentielle.`;
            } else if (recoType.includes('diaporama') || recoType.includes('présentation')) {
              cardTitle = `Guide visuel & diaporama`;
              cardDesc = `Une présentation pas-à-pas illustrant les propriétés fondamentales et la méthode de résolution.`;
            } else if (recoType.includes('quiz') || recoType.includes('qcm')) {
              cardTitle = `Quiz d'entraînement interactif`;
              cardDesc = `Testez vos connaissances avec 10 questions corrigées pas à pas.`;
            } else if (recoType.includes('mindmap') || recoType.includes('mentale')) {
              cardTitle = `Carte mentale synthétique`;
              cardDesc = `Une vue arborescente pour visualiser toutes les connexions entre les théorèmes.`;
            }

            return (
              <div key={idx} className="my-3 p-4 rounded-2xl bg-[#23262d] border border-zinc-700/80 shadow-md flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-300">
                    <Layers className="w-3.5 h-3.5 text-orange-400" />
                    <span className="capitalize">Recommandé : {recoType}</span>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-white leading-tight">{cardTitle}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{cardDesc}</p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('auto-prompt', {
                        detail: { prompt: `Crée une création de type ${recoType} sur ce cours` }
                      }));
                    }}
                    className="px-4 py-1.5 rounded-full bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            );
          }

          // Rendu des titres Markdown (H1, H2, H3)
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base font-bold text-white pt-2 pb-1 border-b border-zinc-800">
                <MathText text={trimmed.slice(4)} inline={true} />
              </h3>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-lg font-black text-white pt-3 pb-1 border-b border-zinc-800">
                <MathText text={trimmed.slice(3)} inline={true} />
              </h2>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-xl font-black text-orange-400 pt-3 pb-1">
                <MathText text={trimmed.slice(2)} inline={true} />
              </h1>
            );
          }

          // Ligne normale avec formules mathématiques KaTeX
          return (
            <div key={idx} className="whitespace-pre-wrap break-words">
              <MathText text={line} inline={true} />
              {isStreaming && isLastLine && (
                <span className="inline-flex items-center align-middle ml-2 select-none" title="L'IA écrit en temps réel...">
                  <DnaLogo className="w-4 h-4 animate-dna-spin-float text-orange-500 drop-shadow-[0_0_8px_rgba(243,128,32,0.9)]" glow={true} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface AssistantChatProps {
  onClose: () => void;
  onHasMessagesChange?: (has: boolean) => void;
  activePreviewItem?: any;
  attachedResources?: any[];
  setAttachedResources?: any;
  key?: React.Key;
}

export function AssistantChat({ onClose, onHasMessagesChange, activePreviewItem, attachedResources = [], setAttachedResources }: AssistantChatProps) {
  const currentUserId = typeof window !== 'undefined'
    ? (localStorage.getItem('unifolder_user_id') || localStorage.getItem('studycloud_user_id') || 'default-user')
    : 'default-user';

  // Session courante (Style Gemini)
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    return localStorage.getItem('studycloud_current_conversation_id') || ('conv-' + Date.now());
  });
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string>('Nouvelle discussion');

  // Tiroir Historique Gemini
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaitingServer, setIsWaitingServer] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  
  // Barre de propositions collée au clavier
  const [showProposalBar, setShowProposalBar] = useState(true);
  
  // Création active suivie pour modification et itération continue
  const [activeCreation, setActiveCreation] = useState<AiCreation | null>(null);

  // Mode Puissance (Délégation à Google Gemini sur studycloud-gemini)
  const [isPowerMode, setIsPowerMode] = useState<boolean>(() => {
    return localStorage.getItem('studycloud_ai_power_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('studycloud_ai_power_mode', String(isPowerMode));
  }, [isPowerMode]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<any>(null);

  // Sauvegarde ID de session courante
  useEffect(() => {
    localStorage.setItem('studycloud_current_conversation_id', currentConversationId);
  }, [currentConversationId]);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isWaitingServer]);

  // Chargement de la liste des conversations (Historique Gemini) depuis Cloudflare D1
  const loadConversations = async () => {
    try {
      const res = await StudyCloudAPI.getAiConversations(currentUserId);
      if (res && res.success && Array.isArray(res.data)) {
        setConversations(res.data);
      }
    } catch (e) {
      // Fallback localStorage
      const local = localStorage.getItem('studycloud_conversations_cache');
      if (local) {
        try { setConversations(JSON.parse(local)); } catch {}
      }
    }
  };

  useEffect(() => {
    loadConversations();
  }, [currentUserId]);

  // Chargement des messages de la conversation active
  const loadConversationMessages = async (convId: string) => {
    try {
      const res = await StudyCloudAPI.getAiConversationMessages(convId);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const loaded: Message[] = res.data.map((row: any) => {
          let attachedFileName = undefined;
          if (row.metadata) {
            try {
              const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
              attachedFileName = meta?.attachedFileName;
            } catch {}
          }
          return {
            id: row.id,
            text: row.content,
            sender: row.role === 'user' ? 'user' : 'ai',
            attachedFileName,
            createdAt: row.created_at,
          };
        });
        setMessages(loaded);
      } else {
        // Fallback session locale
        const local = localStorage.getItem(`studycloud_conv_msgs_${convId}`);
        if (local) {
          try { setMessages(JSON.parse(local)); } catch { setMessages([]); }
        } else {
          setMessages([]);
        }
      }

      // Recharger également la dernière création associée à cette conversation
      const crRes = await StudyCloudAPI.getAiConversationCreations(convId);
      if (crRes && crRes.success && Array.isArray(crRes.data) && crRes.data.length > 0) {
        const lastCreation = crRes.data[0];
        let contentParsed = lastCreation.content;
        if (typeof contentParsed === 'string') {
          try { contentParsed = JSON.parse(contentParsed); } catch {}
        }
        const restoredCreation: AiCreation = {
          id: lastCreation.id,
          userId: currentUserId,
          toolType: lastCreation.type,
          title: lastCreation.title || 'Création IA',
          content: contentParsed,
          createdAt: lastCreation.created_at,
        };
        setActiveCreation(restoredCreation);
        window.dispatchEvent(new CustomEvent('ai-creation-ready', { detail: { creation: restoredCreation } }));
      }
    } catch (e) {
      console.warn('[AssistantChat] Erreur chargement messages:', e);
    }
  };

  useEffect(() => {
    loadConversationMessages(currentConversationId);
  }, [currentConversationId]);

  // Synchronisation avec les créations actives du panneau droit
  useEffect(() => {
    const handleReady = (e: any) => {
      if (e.detail?.creation) {
        setActiveCreation(e.detail.creation);
        // Sauvegarder dans ai_creations dans D1
        StudyCloudAPI.saveAiCreationRecord({
          id: e.detail.creation.id,
          conversationId: currentConversationId,
          type: e.detail.creation.toolType,
          title: e.detail.creation.title,
          content: e.detail.creation.content,
        }).catch(() => {});
      }
    };
    const handleUpdate = (e: any) => {
      if (e.detail?.updatedContent && activeCreation) {
        setActiveCreation(prev => prev ? { ...prev, content: e.detail.updatedContent } : null);
        StudyCloudAPI.saveAiCreationRecord({
          id: activeCreation.id,
          conversationId: currentConversationId,
          type: activeCreation.toolType,
          title: activeCreation.title,
          content: e.detail.updatedContent,
        }).catch(() => {});
      }
    };
    window.addEventListener('ai-creation-ready', handleReady as any);
    window.addEventListener('ai-creation-update', handleUpdate as any);
    return () => {
      window.removeEventListener('ai-creation-ready', handleReady as any);
      window.removeEventListener('ai-creation-update', handleUpdate as any);
    };
  }, [activeCreation, currentConversationId]);

  // Nettoyage du timer d'animation au démontage
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

  // Création d'une nouvelle session de discussion
  const handleStartNewConversation = () => {
    const newId = 'conv-' + Date.now();
    setCurrentConversationId(newId);
    setCurrentConversationTitle('Nouvelle discussion');
    setMessages([]);
    setActiveCreation(null);
    setIsHistoryDrawerOpen(false);
    setShowProposalBar(true);

    // Initialisation D1
    StudyCloudAPI.createAiConversation({
      id: newId,
      userId: currentUserId,
      title: 'Nouvelle discussion',
    }).catch(() => {});
  };

  // Suppression d'une session
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await StudyCloudAPI.deleteAiConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      localStorage.removeItem(`studycloud_conv_msgs_${convId}`);
      if (currentConversationId === convId) {
        handleStartNewConversation();
      }
    } catch (err) {
      console.warn('[AssistantChat] Erreur suppression session:', err);
    }
  };

  const handleReaction = async (messageId: string, reaction: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const next = m.reaction === reaction ? null : reaction;
        return { ...m, reaction: next };
      }
      return m;
    }));

    if (currentUserId) {
      await saveAiReaction({
        userId: currentUserId,
        messageId,
        reaction,
      });
    }
  };

  const handleRemoveAttachment = async (res: any) => {
    setAttachedResources?.((prev: any[]) => prev.filter((r: any) => r.id !== res.id));
    if (currentUserId && res.id) {
      await removeAiAttachment({
        userId: currentUserId,
        fileId: res.id,
        r2Key: res.r2_key || res.r2Key,
      });
    }
  };

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    const userText = textToSend.trim();
    const newUserMsgId = Date.now().toString();
    const newUserMsg: Message = { id: newUserMsgId, text: userText, sender: 'user' };
    
    // Ajout immédiat du message utilisateur à la liste
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);
    setIsWaitingServer(true);

    // Mise à jour du titre de conversation si c'est le 1er message
    if (messages.length === 0) {
      const generatedTitle = userText.slice(0, 38).trim() + (userText.length > 38 ? '...' : '');
      setCurrentConversationTitle(generatedTitle);
      StudyCloudAPI.createAiConversation({
        id: currentConversationId,
        userId: currentUserId,
        title: generatedTitle,
      }).then(() => loadConversations()).catch(() => {});
    }

    try {
      // 1. Rassemblement de tous les documents (Actif en Orange + Pièces jointes en Bleu, jusqu'à 3 max)
      const allDocs: any[] = [];
      if (activePreviewItem && (activePreviewItem.id || activePreviewItem.name || activePreviewItem.title || activePreviewItem.file || activePreviewItem.blob)) {
        allDocs.push({ ...activePreviewItem, isOrangeActive: true });
      }
      if (Array.isArray(attachedResources)) {
        for (const res of attachedResources) {
          if (res) {
            const alreadyIn = allDocs.some(d =>
              (d.id && res.id && d.id === res.id) ||
              (d.name && res.name && d.name === res.name) ||
              (d.title && res.title && d.title === res.title)
            );
            if (!alreadyIn) {
              allDocs.push({ ...res, isOrangeActive: false });
            }
          }
        }
      }

      const targetDocs = allDocs.slice(0, 3);
      const docNames: string[] = [];
      const docIds: string[] = [];
      const docR2Keys: string[] = [];
      const docContents: string[] = [];

      if (targetDocs.length > 0) {
        try {
          setIsExtractingDoc(true);
          for (let i = 0; i < targetDocs.length; i++) {
            const doc = targetDocs[i];
            const name = doc.name || doc.title || `Document_${i + 1}`;
            docNames.push(name);
            if (doc.id) docIds.push(doc.id);
            const r2 = doc.r2_key || doc.r2Key;
            if (r2) docR2Keys.push(r2);

            try {
              const text = await extractDocumentText(doc);
              if (text && text.trim()) {
                const tag = doc.isOrangeActive ? "Document actif à l'écran (Orange)" : `Document joint (${i + 1}) (Bleu)`;
                docContents.push(`=== DOCUMENT [${i + 1}/${targetDocs.length}] : "${name}" (${tag}) ===\n${text.trim()}\n=== FIN DE "${name}" ===`);
              }
            } catch (err) {
              console.warn('[AssistantChat] Erreur extraction document:', name, err);
            }
          }
        } finally {
          setIsExtractingDoc(false);
        }
      }

      const attachedFileContent = docContents.join('\n\n');
      const attachedFileName = docNames.join(', ');
      const attachedFileId = docIds.join(',');
      const attachedFileR2Key = docR2Keys.join(',');
      const mainDocName = docNames[0] || activePreviewItem?.name || 'Document d\'étude';

      // 2. ANALYSE ET ROUTAGE D'INTENTION DE LA DEMANDE UTILISATEUR
      const isHesitating = /(je ne sais pas|que (peux|doit|puis)-tu|propose|id[eé]es|aide-moi à (choisir|r[eé]viser)|quelles options|que me conseilles-tu|conseille-moi|que faire)/i.test(userText);
      if (isHesitating) {
        setShowProposalBar(true);
      }

      const isIteration = Boolean(activeCreation && /(ajoute|modifie|change|supprime|remplace|am[eé]liore|corrige|mets? à jour|rajoute|plus de questions|simplifie|d[eé]taille|r[eé]duis|compl[eé]te)/i.test(userText));
      const isCreation = !isIteration && /(cr[eé]e|g[eé]n[eé]re|fais(-moi)?|pr[eé]pare|[eé]labore|con[çc]ois|r[eé]sume|synth[eé]tise|questionnaire|quiz|qcm|carte mentale|mind ?map|infographie|exporte? (en )?(pdf|word)|fiche)/i.test(userText);

      let targetToolType: AiCreationType = 'summary';
      if (/quiz|qcm|questionnaire|q\.c\.m|questions/i.test(userText)) {
        targetToolType = 'quiz';
      } else if (/carte mentale|mind ?map|sch[eé]ma|arborescence/i.test(userText)) {
        targetToolType = 'mindmap';
      } else if (/infographie|dashboard|tableau de bord|visuel/i.test(userText)) {
        targetToolType = 'infographic';
      } else if (/document|export|pdf|word|fiche d'[eé]tude/i.test(userText)) {
        targetToolType = 'document';
      }

      if (isCreation) {
        const creationTitle = `${targetToolType.toUpperCase()} : ${mainDocName}`;
        window.dispatchEvent(new CustomEvent('ai-creation-start', {
          detail: { toolType: targetToolType, title: creationTitle, sourceFileName: mainDocName }
        }));
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
      } else if (isIteration && activeCreation) {
        window.dispatchEvent(new CustomEvent('ai-creation-start', {
          detail: { toolType: activeCreation.toolType, title: activeCreation.title, sourceFileName: mainDocName, isUpdate: true }
        }));
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
      }

      // 3. Contexte du document actif et mémoire conversationnelle
      let systemContent = `Tu es le tuteur pédagogique personnel d'élite de StudyCloud / DKDSCHOOL-NUMÉRIQUE, développé par DKD Technologies.
Ton rôle N'EST PAS de survoler les cours ni de donner de simples listes d'étapes abstraites.
Tu dois faire COMPRENDRE l'étudiant en profondeur, de manière concrète, claire et interactive.

RÈGLES ABSOLUES POUR L'ANALYSE DE DOCUMENTS ET COURS :
1. ANALYSE INTÉGRALE : Si un texte ou un contenu de fichier est fourni dans le message, tu dois l'analyser de manière exhaustive de la première à la dernière ligne. Ne saute aucun détail technique, aucune formule mathématique et aucune définition.
2. FIN DU "SURVOL" : N'écris JAMAIS de phrases vagues du genre "Voici les étapes pour comprendre : 1. lisez la leçon...". À la place, explique concrètement chaque notion en partant de zéro, utilise des exemples de la vie réelle, des schémas textuels ou des analogies puissantes (ex: comparer des flux, des circuits électriques, la transformée de Laplace à un dictionnaire bilingue temps/fréquence, ou des fonctions mathématiques à des systèmes physiques).
3. PROGRESSION PÉDAGOGIQUE & LE POURQUOI : Découpe les concepts complexes en blocs digestes. Explique LE POURQUOI et LE COMMENT, pas seulement les théorèmes bruts.
4. DÉCORTICAGE DES FORMULES (LATEX STANDARD) : Ne jette JAMAIS une formule brute. Rédige TOUTES les formules en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc centré). Décortique chaque lettre, symbole et opérateur ($p$, $t$, \\int, limites, constantes) en expliquant sa signification physique ou mathématique.
5. EXEMPLE RÉSOLU PAS À PAS : Déroule un exemple concret ou un exercice type extrait de son cours, résolu et calculé étape par étape sous les yeux de l'élève en explicitant chaque transformation.
6. PIÈGE D'EXAMEN : Signale explicitement les erreurs classiques que font les étudiants aux examens pour qu'il ne tombe pas dedans.
7. CITATION DE PAGES DU COURS : Cite précisément les pages, chapitres et théorèmes exacts de son document (ex: "À la page 2 de votre cours, la formule...") pour un repérage immédiat.
8. INTERACTIVITÉ & VALIDATION : Termine toujours tes explications par une mise en pratique, une question de vérification ou une proposition de mini-quiz / carte mentale pour valider que l'étudiant a capté l'essence du cours.`;
      
      if (docNames.length > 0) {
        systemContent += `\n\nACCÈS INTÉGRAL AU COURS DE L'ÉLÈVE :\nL'élève a ouvert ${docNames.length} document(s) d'étude : ${docNames.map(n => `"${n}"`).join(', ')}. Tu as un accès direct, complet et exhaustif au contenu textuel de ces documents de la première à la dernière page.`;
      }

      if (isCreation) {
        systemContent += `\n\nL'UTILISATEUR SOUHAITE UNE CRÉATION DÉDIÉE DE TYPE : "${targetToolType}". Produis un résultat riche, parfaitement structuré et créatif en évitant les répétitions. Pour un quiz: prépare des questions variées et percutantes avec 4 choix (A-D) et explications. Pour une carte mentale: structure des branches hiérarchiques captivantes. Pour un résumé: va à l'essentiel avec clarté.`;
      } else if (isIteration && activeCreation) {
        systemContent += `\n\nL'UTILISATEUR SOUHAITE MODIFIER LA CRÉATION EXISTANTE ("${activeCreation.title}"). Voici son contenu actuel : ${JSON.stringify(activeCreation.content)}. Applique scrupuleusement la modification demandée : "${userText}".`;
      }

      // 4. Préparation de l'historique complet pour alimenter le RAG conversationnel
      const chatHistory = [
        { role: 'system', content: systemContent },
        ...updatedMessages.slice(-12).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      ];

      // 5. Appel à l'IA Cloudflare Workers AI avec session persistante & Neurone (ou Gemini en Mode Puissance)
      const aiResult = await sendChatMessageToAi({
        messages: chatHistory,
        prompt: userText,
        message: userText,
        userId: currentUserId,
        sessionId: currentConversationId,
        conversationId: currentConversationId,
        requested_type: isCreation ? targetToolType : (isIteration && activeCreation ? activeCreation.toolType : undefined),
        attachedFileId,
        attachedFileName,
        attachedFileContent,
        attachedFileR2Key,
        file_content: attachedFileContent,
        fileContent: attachedFileContent,
        documentContent: attachedFileContent,
        documentText: attachedFileContent,
        file_name: attachedFileName,
        fileName: attachedFileName,
        powerMode: isPowerMode,
        engine: isPowerMode ? 'gemini' : 'standard',
      });

      const rawResponseText = aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.";
      setIsWaitingServer(false);

      let fullResponseText = rawResponseText;

      // 6. AUTO-CORRECTION & CONTRÔLE QUALITÉ INTERNE ("LE NEURONE")
      if (isCreation) {
        const parsed = parseOrBuildAiCreation(targetToolType, rawResponseText, mainDocName, userText);
        const newCreation: AiCreation = {
          id: 'ai-' + Date.now(),
          userId: currentUserId,
          fileId: activePreviewItem?.id,
          toolType: targetToolType,
          title: parsed.title,
          content: parsed.content,
          sourceFileName: mainDocName,
          createdAt: new Date().toISOString(),
          version: 1,
        };

        setActiveCreation(newCreation);
        window.dispatchEvent(new CustomEvent('ai-creation-ready', { detail: { creation: newCreation } }));

        fullResponseText = `✨ J'ai généré votre **${parsed.title}** dans votre espace de création à droite ! Le contenu a été vérifié et optimisé pour vos révisions.\n\nVous pouvez le faire défiler de haut en bas ou me demander d'ajuster des détails si vous le souhaitez.`;
      } else if (isIteration && activeCreation) {
        const parsed = parseOrBuildAiCreation(activeCreation.toolType, rawResponseText, mainDocName, userText);
        const updatedCreation: AiCreation = {
          ...activeCreation,
          title: parsed.title,
          content: parsed.content,
          updatedAt: new Date().toISOString(),
          version: (activeCreation.version || 1) + 1,
        };

        setActiveCreation(updatedCreation);
        window.dispatchEvent(new CustomEvent('ai-creation-update', {
          detail: { updatedContent: parsed.content, title: parsed.title }
        }));

        fullResponseText = `✅ Votre création a été mise à jour avec succès dans votre espace à droite ! Les modifications demandées ont été intégrées.`;
      } else if (isHesitating) {
        fullResponseText = `${rawResponseText}\n\n👉 Vous pouvez choisir une des actions recommandées juste au-dessus de votre champ de saisie pour que je la prépare immédiatement !`;
      }

      // 7. Initialisation du message IA avec écriture fluide
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        isStreaming: true,
        attachedFileName: attachedFileName || undefined,
        model: aiResult.model,
        isPowerMode: isPowerMode,
      };
      setMessages(prev => [...prev, initialAiMsg]);

      // Sauvegarde locale du fil de discussion
      try {
        localStorage.setItem(`studycloud_conv_msgs_${currentConversationId}`, JSON.stringify([...updatedMessages, { ...initialAiMsg, text: fullResponseText, isStreaming: false }]));
      } catch {}

      // 8. Animation machine à écrire
      let index = 0;
      const chunkSize = 3;
      const tickSpeed = 16;

      if (typingTimerRef.current) clearInterval(typingTimerRef.current);

      typingTimerRef.current = setInterval(() => {
        index += chunkSize;
        if (index >= fullResponseText.length) {
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId ? { ...m, text: fullResponseText, isStreaming: false } : m
            )
          );
          setIsTyping(false);
        } else {
          const partial = fullResponseText.slice(0, index);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId ? { ...m, text: partial } : m
            )
          );
        }

        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, tickSpeed);

    } catch (err: any) {
      console.error('[AssistantChat] Erreur appel IA:', err);
      setIsWaitingServer(false);
      setIsTyping(false);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: `⚠️ Erreur IA : ${err.message || 'Impossible de joindre le serveur'}.`,
        sender: 'ai',
        isStreaming: false,
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  useEffect(() => {
    const handleAutoPrompt = (e: any) => {
      const promptText = e.detail?.prompt;
      if (promptText) {
        sendMessage(promptText);
      }
    };
    window.addEventListener('auto-prompt', handleAutoPrompt as any);
    return () => window.removeEventListener('auto-prompt', handleAutoPrompt as any);
  }, [messages, isTyping, activePreviewItem, attachedResources, activeCreation, currentConversationId]);

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (toolType: AiCreationType) => {
    const docName = activePreviewItem?.name || 'ce document';
    let prompt = '';
    switch (toolType) {
      case 'quiz':
        prompt = `Prépare un questionnaire QCM interactif sur "${docName}"`;
        break;
      case 'summary':
        prompt = `Génère un résumé détaillé et structuré de "${docName}"`;
        break;
      case 'mindmap':
        prompt = `Crée une carte mentale complète à partir de "${docName}"`;
        break;
      case 'infographic':
        prompt = `Élabore une infographie de synthèse sur "${docName}"`;
        break;
      case 'document':
        prompt = `Rédige une fiche d'étude exportable en PDF sur "${docName}"`;
        break;
    }
    sendMessage(prompt);
  };

  // Groupement temporel des conversations façon Gemini (Aujourd'hui, Hier, 7 derniers jours, Plus ancien)
  const filteredConversations = conversations.filter(c => 
    !historySearch.trim() || c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#1e2024] font-nunito relative z-50 overflow-hidden">
      
      {/* EN-TÊTE SUPÉRIEUR STYLE GEMINI (BOUTON HISTORIQUE, TITRE, NOUVELLE CONVERSATION) */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#23252a] border-b border-zinc-700/60 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95"
            title="Historique des discussions (Style Gemini)"
          >
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>Historique</span>
            {conversations.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-orange-500/25 text-orange-400 text-[10px] font-black">
                {conversations.length}
              </span>
            )}
          </button>

          <span className="text-xs font-semibold text-zinc-300 truncate max-w-[140px] sm:max-w-[200px]" title={currentConversationTitle}>
            {currentConversationTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* BOUTON PUISSANCE (DÉLÉGATION À GOOGLE GEMINI) */}
          <button
            type="button"
            onClick={() => setIsPowerMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border active:scale-95 ${
              isPowerMode
                ? 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white border-purple-300/60 shadow-lg shadow-purple-500/25 ring-2 ring-purple-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border-zinc-700'
            }`}
            title={isPowerMode ? "Mode Puissance ACTIF (Google Gemini) - Cliquez pour repasser en mode standard" : "Activer le Mode Puissance (Délégation à Google Gemini sur studycloud-gemini)"}
          >
            <Zap className={`w-3.5 h-3.5 ${isPowerMode ? 'text-amber-300 fill-amber-300 animate-bounce' : 'text-zinc-400'}`} />
            <span className="tracking-tight">{isPowerMode ? 'Puissance MAX' : 'Puissance'}</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase ${
              isPowerMode ? 'bg-white/25 text-white' : 'bg-zinc-700 text-zinc-400'
            }`}>
              {isPowerMode ? 'GEMINI' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleStartNewConversation}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            title="Démarrer une nouvelle discussion"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouvelle</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Fermer le chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* TIROIR HISTORIQUE COULISSANT STYLE GEMINI */}
      {isHistoryDrawerOpen && (
        <div 
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-fadeIn"
          onClick={() => setIsHistoryDrawerOpen(false)}
        >
          <div 
            className="w-full max-w-[310px] sm:max-w-[340px] h-full bg-[#1e2024] border-r border-zinc-800 flex flex-col p-4 shadow-2xl animate-slideInLeft"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Discussions Récentes</h3>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Conversation Button inside drawer */}
            <button
              onClick={handleStartNewConversation}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nouvelle discussion</span>
            </button>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Rechercher une discussion..."
                className="w-full bg-[#282a2f] border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-400 outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {filteredConversations.length === 0 ? (
                <div className="text-center text-zinc-500 text-xs py-8">
                  Aucune discussion trouvée
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isActive = conv.id === currentConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setCurrentConversationId(conv.id);
                        setCurrentConversationTitle(conv.title);
                        setIsHistoryDrawerOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-orange-500/15 border-orange-500/50 text-white shadow-sm'
                          : 'bg-[#26282d] border-zinc-800 text-zinc-300 hover:bg-[#2c2f35] hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-400' : 'text-zinc-400'}`} />
                        <span className="text-xs font-bold truncate">
                          {conv.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0"
                        title="Supprimer cette discussion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 flex flex-col"
      >
        {messages.length === 0 && !isTyping && !isWaitingServer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-10">
            <div className="mb-4">
              <DnaLogo className="w-12 h-12 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] text-orange-500" glow={true} />
            </div>
            <h2 className="text-lg font-bold text-orange-500 mb-2">
              Bonjour ! Je suis votre assistante DKD.
            </h2>
            <p className="text-sm font-medium text-orange-400/80 max-w-xs leading-relaxed">
              Posez-moi vos questions ou demandez-moi de créer un résumé, un quiz, une carte mentale ou une infographie dans l'espace à droite !
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="w-full shrink-0">
              {msg.sender === 'user' ? (
                <div className="flex justify-end w-full">
                  <div className="bg-[#2a2b2f] text-zinc-100 px-4 py-2.5 rounded-[24px] rounded-tr-[4px] text-[13px] sm:text-sm max-w-[85%] break-words shadow-sm">
                    <ChatMessageText text={msg.text} isUser={true} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col w-full text-zinc-100">
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] text-orange-500" glow={true} />
                      <span className="text-xs font-bold text-orange-500/90 tracking-wide uppercase">Assistant StudyCloud</span>
                      {msg.isPowerMode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-purple-500/40 text-[10px] font-black text-amber-300 shadow-sm" title="Réponse générée avec la puissance de Google Gemini (studycloud-gemini)">
                          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span>Gemini Puissance</span>
                        </span>
                      )}
                    </div>
                    {msg.attachedFileName && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {msg.attachedFileName.split(', ').map((docName, idx) => (
                          <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-semibold text-orange-300">
                            <FileText className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{docName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-[13px] sm:text-sm leading-relaxed font-medium text-zinc-200 pl-1">
                    <ChatMessageText text={msg.text} isUser={false} isStreaming={msg.isStreaming} />
                  </div>

                  {!msg.isStreaming && msg.text && (
                    <div className="flex items-center mt-3 pl-1">
                      <div className="flex items-center gap-1 sm:gap-2 text-zinc-400">
                        <button 
                          type="button"
                          onClick={() => handleReaction(msg.id, 'like')}
                          className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${
                            msg.reaction === 'like'
                              ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                          title="Bonne réponse (j'aime)"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleReaction(msg.id, 'dislike')}
                          className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${
                            msg.reaction === 'dislike'
                              ? 'text-rose-400 bg-rose-500/20 hover:bg-rose-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                          title="Mauvaise réponse"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <div className="w-1 sm:w-2" />
                        <button 
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            setCopiedMsgId(msg.id);
                            setTimeout(() => setCopiedMsgId(null), 2000);
                          }}
                          className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-400 hover:text-white flex items-center gap-1.5"
                          title="Copier la réponse"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-[11px] font-bold text-emerald-400">Copié</span>
                            </>
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        
        {isWaitingServer && (
          <div className="flex flex-col w-full text-zinc-100 mb-4 animate-fadeIn">
            <div className="flex items-center gap-3 bg-[#26282d] border border-orange-500/25 px-4 py-3 rounded-2xl w-fit max-w-[90%] shadow-lg">
              <DnaLogo className="w-6 h-6 animate-dna-spin-float shrink-0 text-orange-500" glow={true} />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-orange-400 animate-pulse">
                  L'IA formule votre réponse...
                </span>
                <span className="text-[11px] text-zinc-400">
                  Recherche et analyse pédagogique
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ZONE BASSE : PROPOSITIONS COLLÉES AU BORD DU CLAVIER + FORMULAIRE */}
      <div className="px-3 sm:px-5 pt-2 pb-6 sm:pb-8 shrink-0">
        
        {showProposalBar && (
          <div className="mx-2 md:mx-4 mb-2 p-2 bg-[#23252a] border border-orange-500/30 rounded-2xl shadow-lg animate-fadeIn flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-orange-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Actions rapides recommandées en 1 tap :
              </span>
              <button 
                type="button"
                onClick={() => setShowProposalBar(false)} 
                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                title="Masquer les suggestions"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
              <button
                type="button"
                onClick={() => handleQuickAction('quiz')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
              >
                🎯 Quiz QCM
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('summary')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
              >
                📋 Fiche de Résumé
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('mindmap')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
              >
                🧠 Carte Mentale
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('infographic')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
              >
                📊 Infographie
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('document')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
              >
                📄 Fiche PDF
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className={`flex flex-col gap-2 bg-[#282a2f] border rounded-3xl p-3 sm:p-3.5 transition-all shadow-lg mx-2 md:mx-4 ${
            isPowerMode
              ? 'border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.18)] focus-within:border-purple-400'
              : 'border-zinc-700/60 focus-within:border-[#70a5ff]/70'
          }`}
        >
          {isPowerMode && (
            <div className="flex items-center justify-between px-1 py-1 text-[11px] font-bold text-amber-300 border-b border-purple-500/25 mb-0.5">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                <span>Mode Puissance actif (Requêtes traitées par Google Gemini)</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-200 uppercase font-black tracking-wider">
                studycloud-gemini
              </span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isPowerMode
                ? "⚡ Mode Puissance (Google Gemini) : Posez votre question ou collez votre cours complexe..."
                : "Posez une question ou demandez une création (ex: 'fais-moi un quiz', 'ajoute 2 questions')..."
            }
            rows={3}
            className="w-full bg-transparent text-white placeholder-zinc-400 text-sm outline-none resize-none overflow-y-auto"
          />

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-2 custom-scrollbar pb-1">
               {activePreviewItem?.name && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/40 rounded-lg max-w-[160px] sm:max-w-[210px] shrink-0" title="Document ouvert à l'écran (sélectionné en orange)">
                   <div className="shrink-0 flex items-center justify-center">
                     <FileIconBadge fileName={activePreviewItem.name} size={16} />
                   </div>
                   <span className="text-[10px] sm:text-[11px] font-bold text-orange-300 truncate">
                     {activePreviewItem.name}
                   </span>
                   <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-orange-500/25 text-orange-400 shrink-0">
                     Actif
                   </span>
                   {activePreviewItem.isExtracting && (
                     <Loader2 className="w-3 h-3 animate-spin text-orange-400 ml-1 shrink-0" />
                   )}
                 </div>
               )}
               
               {attachedResources.map(res => (
                 <div key={res.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/40 rounded-lg max-w-[160px] sm:max-w-[210px] shrink-0" title="Document joint (sélectionné en bleu)">
                   <div className="shrink-0 flex items-center justify-center">
                     <FileIconBadge fileName={res.name} size={16} />
                   </div>
                   <span className="text-[10px] sm:text-[11px] font-bold text-blue-300 truncate">
                     {res.name}
                   </span>
                   {res.isExtracting ? (
                     <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-1 shrink-0" />
                   ) : (
                     <button 
                       type="button"
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         handleRemoveAttachment(res);
                       }}
                       className="ml-1 text-blue-400 hover:text-white p-0.5 rounded-full hover:bg-blue-700/50 transition-colors cursor-pointer"
                       title="Retirer ce document"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   )}
                 </div>
               ))}
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className={`self-end p-2.5 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0 ${
                isPowerMode
                  ? 'bg-gradient-to-r from-amber-400 to-purple-500 hover:from-amber-500 hover:to-purple-600 text-white shadow-purple-500/30'
                  : 'bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950'
              }`}
              title={isPowerMode ? "Envoyer avec Google Gemini (Mode Puissance)" : "Envoyer"}
            >
              {isPowerMode ? <Zap className="w-4 h-4 text-white fill-white" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
