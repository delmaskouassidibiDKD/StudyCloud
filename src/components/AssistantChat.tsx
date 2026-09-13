import React, { useState, useRef, useEffect } from 'react';
import { Send, ThumbsUp, ThumbsDown, Copy, FileText, X } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { FileIconBadge } from './FileIconBadge';
import { sendChatMessageToAi } from '../services/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

const ChatMessageText = ({ text, isUser }: { text: string, isUser: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 250;
  const isLong = text.length > maxLength;
  const displayText = !expanded && isLong ? text.slice(0, maxLength) + '...' : text;

  return (
    <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
      <p className={`whitespace-pre-wrap break-words ${isUser ? '' : 'text-zinc-200'} text-left w-full`}>
        {displayText}
      </p>
      {isLong && (
        <button 
          onClick={() => setExpanded(!expanded)} 
          className={`mt-1.5 text-[10px] font-bold underline transition-colors cursor-pointer ${isUser ? 'text-orange-200 hover:text-white' : 'text-orange-500 hover:text-orange-400'}`}
        >
          {expanded ? 'Masquer' : 'Démasquer'}
        </button>
      )}
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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    const userText = textToSend.trim();
    const newUserMsg: Message = { id: Date.now().toString(), text: userText, sender: 'user' };
    
    // Ajout immédiat du message utilisateur à la liste
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

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

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.",
        sender: 'ai',
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('[AssistantChat] Erreur appel IA:', err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: `⚠️ Erreur de connexion avec l'IA (${err.message || 'Serveur indisponible'}).\n\nVérifiez que le code du fichier 'worker/CODE_A_COLLER_DANS_CLOUDFLARE_AI.js' est bien déployé sur Cloudflare et que la liaison 'AI' est bien ajoutée dans les paramètres de votre Worker.`,
        sender: 'ai',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
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
        {messages.length === 0 && !isTyping ? (
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
                <div className="bg-[#2a2b2f] text-zinc-100 px-4 py-2.5 rounded-[24px] rounded-tr-[4px] text-[13px] sm:text-sm max-w-[85%] break-words">
                  <ChatMessageText text={msg.text} isUser={true} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col w-full text-zinc-100">
                {/* AI Sparkle/DNA Icon */}
                <div className="mb-2">
                  <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" glow={true} />
                </div>
                
                {/* AI Text Content */}
                <div className="text-[13px] sm:text-sm leading-relaxed font-medium text-zinc-200">
                  <ChatMessageText text={msg.text} isUser={false} />
                </div>

                {/* AI Action Buttons */}
                <div className="flex items-center mt-4">
                  <div className="flex items-center gap-1 sm:gap-2 text-zinc-400">
                    <button className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"><ThumbsUp className="w-4 h-4" /></button>
                    <button className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"><ThumbsDown className="w-4 h-4" /></button>
                    <div className="w-1 sm:w-2" />
                    <button className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
          ))
        )}
        
        {isTyping && (
          <div className="flex flex-col w-full text-zinc-100 mb-5">
            <div className="mb-3">
              <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] opacity-70" glow={true} />
            </div>
            <div className="flex flex-col gap-2.5 w-full mt-1 animate-pulse">
              <div className="h-[14px] w-[90%] rounded-full bg-[#2a2b2f]" />
              <div className="h-[14px] w-[75%] rounded-full bg-[#2a2b2f]" />
              <div className="h-[14px] w-[45%] rounded-full bg-[#2a2b2f]" />
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
