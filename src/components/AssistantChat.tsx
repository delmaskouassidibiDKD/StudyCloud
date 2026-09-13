import React, { useState, useRef, useEffect } from 'react';
import { Send, ThumbsUp, ThumbsDown, Copy, Check, X } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { FileIconBadge } from './FileIconBadge';
import { sendChatMessageToAi } from '../services/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isStreaming?: boolean;
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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<any>(null);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isWaitingServer]);

  // Nettoyage du timer d'animation au démontage
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

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
      // 1. Contexte du document actif et des ressources jointes
      let systemContent = "Tu es l'assistante IA officielle de la plateforme StudyCloud, développée par DKD Technologies. Tu es une tutrice académique bienveillante, dynamique, très claire et structurée. Tu réponds TOUJOURS en français pour aider l'élève ou l'étudiant dans ses cours, révisions et exercices.";
      
      if (activePreviewItem?.name) {
        systemContent += `\nL'utilisateur consulte actuellement le document : "${activePreviewItem.name}". Si la question porte sur ce cours ou ce document, explique-lui clairement les notions.`;
      }

      if (attachedResources && attachedResources.length > 0) {
        const attachedNames = attachedResources.map((r: any) => r.name).filter(Boolean).join(', ');
        if (attachedNames) {
          systemContent += `\nDocuments attachés à la discussion : ${attachedNames}.`;
        }
      }

      // 2. Préparation de l'historique des messages pour le format chat
      const chatHistory = [
        { role: 'system', content: systemContent },
        ...updatedMessages.slice(-8).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      ];

      // 3. Appel à l'IA Cloudflare Workers AI
      const aiResult = await sendChatMessageToAi({
        messages: chatHistory,
        prompt: userText,
      });

      const fullResponseText = aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.";
      setIsWaitingServer(false);

      // 4. Initialisation du message IA avec écriture en temps réel
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        isStreaming: true,
      };
      setMessages(prev => [...prev, initialAiMsg]);

      // 5. Animation machine à écrire fluide avec l'ADN qui tourne et se déplace
      let index = 0;
      const chunkSize = 3; // 3 caractères par saut pour un flux rapide et naturel
      const tickSpeed = 16; // ~60fps d'écriture

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
  }, [messages, isTyping, activePreviewItem, attachedResources]);

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e2024] font-nunito relative z-50">
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6 flex flex-col"
      >
        {messages.length === 0 && !isTyping && !isWaitingServer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-10">
            <div className="mb-4">
              <DnaLogo className="w-12 h-12 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] text-orange-500" glow={true} />
            </div>
            <h2 className="text-lg font-bold text-orange-500 mb-2">
              Bonjour ! Je suis votre assistante DKD.
            </h2>
            <p className="text-sm font-medium text-orange-400/80">
              Comment puis-je vous aider aujourd'hui ?
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
                  {/* AI Sparkle/DNA Icon */}
                  <div className="mb-2 flex items-center gap-2">
                    <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] text-orange-500" glow={true} />
                    <span className="text-xs font-bold text-orange-500/90 tracking-wide uppercase">Assistant StudyCloud</span>
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
                          className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-400 hover:text-white"
                          title="Bonne réponse"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-400 hover:text-white"
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

      {/* Input Area */}
      <div className="px-5 pt-3 pb-8 sm:pb-8 shrink-0">
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
            placeholder="Saisissez un prompt ici"
            rows={4}
            className="w-full bg-transparent text-white placeholder-zinc-400 text-sm outline-none resize-none overflow-y-auto"
          />

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-2 custom-scrollbar pb-1">
               {activePreviewItem?.name && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e2024] border border-zinc-700/50 rounded-lg max-w-[150px] sm:max-w-[200px] shrink-0">
                   <div className="shrink-0 flex items-center justify-center">
                     <FileIconBadge fileName={activePreviewItem.name} size={16} />
                   </div>
                   <span className="text-[10px] sm:text-[11px] font-bold text-zinc-300 truncate">
                     {activePreviewItem.name}
                   </span>
                 </div>
               )}
               
               {attachedResources.map(res => (
                 <div key={res.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e2024] border border-zinc-700/50 rounded-lg max-w-[150px] sm:max-w-[200px] shrink-0">
                   <div className="shrink-0 flex items-center justify-center">
                     <FileIconBadge fileName={res.name} size={16} />
                   </div>
                   <span className="text-[10px] sm:text-[11px] font-bold text-zinc-300 truncate">
                     {res.name}
                   </span>
                   <button 
                     type="button"
                     onClick={(e) => {
                       e.preventDefault();
                       e.stopPropagation();
                       setAttachedResources?.((prev: any[]) => prev.filter(r => r.id !== res.id));
                     }}
                     className="ml-1 text-zinc-500 hover:text-white p-0.5 rounded-full hover:bg-zinc-700 transition-colors cursor-pointer"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               ))}
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="self-end p-2 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
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

