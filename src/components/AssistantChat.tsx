import React, { useState, useRef, useEffect } from 'react';
import { Send, ThumbsUp, ThumbsDown, Copy, Check, X, FileText, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { FileIconBadge } from './FileIconBadge';
import { sendChatMessageToAi, saveAiReaction, removeAiAttachment } from '../services/api';
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
}

const ChatMessageText = ({ text, isUser, isStreaming }: { text: string; isUser: boolean; isStreaming?: boolean }) => {
  const [expanded, setExpanded] = useState(false);

  // LE MASQUAGE/DÉMASQUAGE EST STRICTEMENT RÉSERVÉ AUX MESSAGES TRÈS VOLUMINEUX ENVOYÉS PAR L'UTILISATEUR
  // L'IA N'EST JAMAIS MASQUÉE NI TRONQUÉE : ELLE S'AFFICHE TOUJOURS EN ENTIER
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

  // Pour l'IA : Rendu complet, sans coupure, avec typographie soignée
  const lines = displayText.split('\n');

  return (
    <div className="flex flex-col w-full items-start">
      <div className="space-y-1.5 text-zinc-200 text-left w-full leading-relaxed font-medium">
        {lines.map((line, idx) => {
          const isLastLine = idx === lines.length - 1;
          // Parser inline pour **gras**
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const formattedLine = parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={i} className="font-bold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          return (
            <p key={idx} className="whitespace-pre-wrap break-words">
              {formattedLine}
              {/* ADN qui tourne et se déplace en temps réel juste après le dernier mot pendant la rédaction ! */}
              {isStreaming && isLastLine && (
                <span className="inline-flex items-center align-middle ml-2 select-none" title="L'IA écrit en temps réel...">
                  <DnaLogo className="w-4 h-4 animate-dna-spin-float text-orange-500 drop-shadow-[0_0_8px_rgba(243,128,32,0.9)]" glow={true} />
                </span>
              )}
            </p>
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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<any>(null);

  const currentUserId = typeof window !== 'undefined'
    ? (localStorage.getItem('unifolder_user_id') || localStorage.getItem('studycloud_user_id') || 'default-user')
    : 'default-user';
  const currentSessionId = useRef('session-' + Date.now()).current;

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isWaitingServer]);

  // Synchronisation avec les créations actives du panneau droit
  useEffect(() => {
    const handleReady = (e: any) => {
      if (e.detail?.creation) {
        setActiveCreation(e.detail.creation);
      }
    };
    const handleUpdate = (e: any) => {
      if (e.detail?.updatedContent && activeCreation) {
        setActiveCreation(prev => prev ? { ...prev, content: e.detail.updatedContent } : null);
      }
    };
    window.addEventListener('ai-creation-ready', handleReady as any);
    window.addEventListener('ai-creation-update', handleUpdate as any);
    return () => {
      window.removeEventListener('ai-creation-ready', handleReady as any);
      window.removeEventListener('ai-creation-update', handleUpdate as any);
    };
  }, [activeCreation]);

  // Nettoyage du timer d'animation au démontage
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

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
    const newUserMsg: Message = { id: Date.now().toString(), text: userText, sender: 'user' };
    
    // Ajout immédiat du message utilisateur à la liste
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);
    setIsWaitingServer(true);

    try {
      // 1. Rassemblement de tous les documents (Actif en Orange + Pièces jointes en Bleu, jusqu'à 3 max)
      const allDocs: any[] = [];
      if (activePreviewItem && activePreviewItem.id) {
        allDocs.push({ ...activePreviewItem, isOrangeActive: true });
      }
      if (Array.isArray(attachedResources)) {
        for (const res of attachedResources) {
          if (res && res.id && !allDocs.some(d => d.id === res.id)) {
            allDocs.push({ ...res, isOrangeActive: false });
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
      const lowerText = userText.toLowerCase();

      // Cas A : L'utilisateur hésite ou demande des idées -> Afficher la barre de validation rapide collée au clavier
      const isHesitating = /(je ne sais pas|que (peux|doit|puis)-tu|propose|id[eé]es|aide-moi à (choisir|r[eé]viser)|quelles options|que me conseilles-tu|conseille-moi|que faire)/i.test(userText);
      if (isHesitating) {
        setShowProposalBar(true);
      }

      // Cas B : Modification ou Itération continue sur une création déjà existante
      const isIteration = Boolean(activeCreation && /(ajoute|modifie|change|supprime|remplace|am[eé]liore|corrige|mets? à jour|rajoute|plus de questions|simplifie|d[eé]taille|r[eé]duis|compl[eé]te)/i.test(userText));

      // Cas C : Demande explicite de création dans le panneau droit
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

      // Si c'est une création : Signaler immédiatement le panneau droit et activer l'ADN animé
      if (isCreation) {
        const creationTitle = `${targetToolType.toUpperCase()} : ${mainDocName}`;
        window.dispatchEvent(new CustomEvent('ai-creation-start', {
          detail: { toolType: targetToolType, title: creationTitle, sourceFileName: mainDocName }
        }));
        // Basculer l'onglet mobile vers le panneau droit
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
      } else if (isIteration && activeCreation) {
        window.dispatchEvent(new CustomEvent('ai-creation-start', {
          detail: { toolType: activeCreation.toolType, title: activeCreation.title, sourceFileName: mainDocName, isUpdate: true }
        }));
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
      }

      // 3. Contexte du document actif et des ressources jointes
      let systemContent = "Tu es l'assistante IA officielle de la plateforme StudyCloud, développée par DKD Technologies. Tu es une tutrice académique bienveillante, dynamique, très claire et structurée. Tu réponds TOUJOURS en français pour aider l'élève ou l'étudiant dans ses cours, révisions et exercices.";
      
      if (docNames.length > 0) {
        systemContent += `\nL'utilisateur a mis à disposition ${docNames.length} document(s) d'étude : ${docNames.map(n => `"${n}"`).join(', ')}. Tu as un accès direct et intégral au contenu de ces documents. Réponds précisément en t'appuyant sur l'ensemble de ces documents (théorèmes, cours, formules, définitions, exercices).`;
      }

      if (isCreation) {
        systemContent += `\nL'UTILISATEUR SOUHAITE UNE CRÉATION DÉDIÉE DE TYPE : "${targetToolType}". Produis un résultat riche, très structuré et complet en t'appuyant sur le document. Fournis des éléments clairs et détaillés (pour un quiz: questions, 4 choix A-D, réponse et explication; pour une carte mentale: nœuds principaux et sous-branches; pour un résumé: synthèse, points clés, définitions; pour une infographie: statistiques clés et concepts).`;
      } else if (isIteration && activeCreation) {
        systemContent += `\nL'UTILISATEUR SOUHAITE MODIFIER LA CRÉATION EXISTANTE ("${activeCreation.title}"). Voici son contenu actuel : ${JSON.stringify(activeCreation.content)}. Applique scrupuleusement la modification demandée : "${userText}".`;
      }

      // 4. Préparation de l'historique des messages pour le format chat
      const chatHistory = [
        { role: 'system', content: systemContent },
        ...updatedMessages.slice(-8).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      ];

      // 5. Appel à l'IA Cloudflare Workers AI avec injection sécurisée du texte extrait du document
      const aiResult = await sendChatMessageToAi({
        messages: chatHistory,
        prompt: userText,
        userId: currentUserId,
        sessionId: currentSessionId,
        attachedFileId,
        attachedFileName,
        attachedFileContent,
        attachedFileR2Key,
      });

      const rawResponseText = aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.";
      setIsWaitingServer(false);

      let fullResponseText = rawResponseText;

      // 6. ROUTAGE DU RÉSULTAT : CRÉATION, ITÉRATION OU RÉPONSE CLASSIQUE
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

        fullResponseText = `✨ J'ai généré votre **${parsed.title}** dans votre espace de création à droite ! Vous pouvez l'explorer et interagir avec directement.\n\nN'hésitez pas à me demander des ajustements ou des ajouts si nécessaire.`;
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

        fullResponseText = `✅ J'ai mis à jour votre création dans votre espace à droite selon vos indications ! Vous pouvez observer les modifications apportées.`;
      } else if (isHesitating) {
        fullResponseText = `${rawResponseText}\n\n👉 Vous pouvez cliquer sur l'une des propositions juste au-dessus de votre champ de saisie pour que je la prépare immédiatement pour vous !`;
      }

      // 7. Initialisation du message IA avec écriture en temps réel
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        isStreaming: true,
        attachedFileName: attachedFileName || undefined,
      };
      setMessages(prev => [...prev, initialAiMsg]);

      // 8. Animation machine à écrire fluide avec l'ADN qui tourne
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
  }, [messages, isTyping, activePreviewItem, attachedResources, activeCreation]);

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Déclencheur direct en 1 tap depuis la barre collée au clavier
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

  return (
    <div className="flex flex-col h-full bg-[#1e2024] font-nunito relative z-50">
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 flex flex-col"
      >
        {messages.length === 0 && !isTyping && !isWaitingServer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-10">
            <div className="mb-4">
              <DnaLogo className="w-12 h-12 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] text-orange-500" glow={true} />
            </div>
            <h2 className="text-lg font-bold text-orange-500 mb-2">
              Bonjour ! Je suis votre assistante DKD.
            </h2>
            <p className="text-sm font-medium text-orange-400/80 max-w-xs">
              Posez-moi une question ou demandez-moi de créer un résumé, un quiz, une carte mentale ou une infographie dans l'espace à droite !
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
                  {/* AI Sparkle/DNA Icon & Attached Doc Badge */}
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] text-orange-500" glow={true} />
                      <span className="text-xs font-bold text-orange-500/90 tracking-wide uppercase">Assistant StudyCloud</span>
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
                  
                  {/* AI Text Content */}
                  <div className="text-[13px] sm:text-sm leading-relaxed font-medium text-zinc-200 pl-1">
                    <ChatMessageText text={msg.text} isUser={false} isStreaming={msg.isStreaming} />
                  </div>

                  {/* AI Action Buttons */}
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
        
        {/* État de chargement pendant la réflexion du modèle IA */}
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
        
        {/* BARRE DE VALIDATION ET PROPOSITIONS RAPIDES COLLÉE AU CLAVIER */}
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

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex flex-col gap-2 bg-[#282a2f] border border-zinc-700/60 rounded-3xl p-3 sm:p-3.5 focus-within:border-[#70a5ff]/70 transition-all shadow-lg mx-2 md:mx-4"
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question ou demandez une création (ex: 'fais-moi un quiz', 'ajoute 2 questions')..."
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
              className="self-end p-2.5 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
