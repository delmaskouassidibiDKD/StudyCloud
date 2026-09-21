import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Copy, Check, X, ThumbsUp, ThumbsDown, Trash2, Square } from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { MathText } from './MathText';
import { sendDelmasChatMessage } from '../services/api';

interface Message {
  id: string;
  sender: 'user' | 'delmas';
  text: string;
  model?: string;
  reaction?: 'like' | 'dislike' | null;
  timestamp: string;
  isStreaming?: boolean;
}

interface DelmasChatProps {
  onClose: () => void;
}

export const DelmasChat: React.FC<DelmasChatProps> = ({ onClose }) => {
  // État 100% en mémoire locale (éphémère : détruit dès que le composant est fermé/démonté)
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll fluide vers le bas dès qu'un message ou caractère arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus automatique du champ au démarrage
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Nettoyage complet à la fermeture ou au démontage
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleStopGeneration();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [onClose]);

  // Arrêter immédiatement la génération et l'écriture en cours
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
    setIsLoading(false);
  };

  // Envoi d'un message avec animation d'écriture progressive (typewriter)
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    // Arrêter toute animation précédente
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const delmasMsgId = `delmas-${Date.now()}`;
    const initialDelmasMessage: Message = {
      id: delmasMsgId,
      sender: 'delmas',
      text: '',
      isStreaming: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage, initialDelmasMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Historique court pour le contexte
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await sendDelmasChatMessage({
        message: text,
        history: historyPayload,
        signal: controller.signal,
      });

      const fullResponseText = res.response || "Je suis à votre écoute !";
      const modelName = res.model || 'Delmas Direct AI';

      // Animation dactylographique fluide ("il répond en écrivant")
      let charIdx = 0;
      const chunkSize = 4; // 4 caractères par cycle pour une vitesse de frappe ultra vive
      const tickSpeed = 14; // 14ms par cycle

      typingTimerRef.current = setInterval(() => {
        charIdx += chunkSize;
        if (charIdx >= fullResponseText.length) {
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === delmasMsgId
                ? { ...m, text: fullResponseText, model: modelName, isStreaming: false }
                : m
            )
          );
          setIsLoading(false);
        } else {
          const partial = fullResponseText.slice(0, charIdx);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === delmasMsgId
                ? { ...m, text: partial, model: modelName }
                : m
            )
          );
        }
      }, tickSpeed);

    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('interrompue') || controller.signal.aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === delmasMsgId
              ? { ...m, text: m.text ? `${m.text} \n\n⏹️ *Réponse arrêtée.*` : "⏹️ *Réponse arrêtée par l'utilisateur.*", isStreaming: false }
              : m
          )
        );
      } else {
        const cleanErrMsg = (err?.message || 'Connexion impossible').trim();
        const errorPrompt = cleanErrMsg.toLowerCase().includes('réessayer')
          ? `Désolé, une erreur est survenue : ${cleanErrMsg}`
          : `Désolé, une erreur est survenue : ${cleanErrMsg}. Veuillez réessayer.`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === delmasMsgId
              ? {
                  ...m,
                  text: errorPrompt,
                  isStreaming: false,
                }
              : m
          )
        );
      }
      setIsLoading(false);
    } finally {
      abortControllerRef.current = null;
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReaction = (id: string, reaction: 'like' | 'dislike') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, reaction: m.reaction === reaction ? null : reaction } : m))
    );
  };

  const handleClearChat = () => {
    handleStopGeneration();
    setMessages([]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#16181d] text-zinc-100 select-text overflow-hidden relative font-sans">
      {/* Halo d'ambiance Bleu en arrière-plan */}
      <div className="absolute top-0 left-1/4 w-96 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* EN-TÊTE : Robot Bleu, Titre, Bouton Fermer */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-[#1a1d24]/90 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-blue-500/30 opacity-60 blur-xs" />
            <DelmasRobot size={36} variant="blue" className="relative" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base tracking-wide bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                DELMAS IA
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              Assistant StudyCloud • Causerie intelligente
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Effacer la discussion actuelle"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Effacer</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Fermer la fenêtre (tout s'efface)"
          >
            <X className="w-4 h-4" />
            <span>Fermer</span>
          </button>
        </div>
      </div>

      {/* ZONE CENTRALE : Messages ou Écran d'Accueil Bleu */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 flex flex-col relative z-10"
      >
        {messages.length === 0 ? (
          /* ÉCRAN DE BIENVENUE AVEC ROBOT BLEU */
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 sm:py-10 max-w-2xl mx-auto w-full animate-fadeIn">
            {/* Robot Delmas Bleu imposant avec halo lumineux */}
            <div className="relative mb-5 flex items-center justify-center">
              <div 
                className="absolute w-28 h-28 rounded-full pointer-events-none transition-all duration-700"
                style={{
                  background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(59,130,246,0.18) 50%, transparent 75%)',
                  filter: 'blur(16px)',
                }}
              />
              <div className="p-1.5 rounded-full ring-2 ring-blue-500/40 shadow-[0_0_25px_rgba(37,99,235,0.4)]">
                <DelmasRobot size={68} variant="blue" />
              </div>
            </div>

            {/* Titre vibrant */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black mb-2.5 tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                Bonjour ! Je suis Delmas,
              </span>
              <br />
              <span className="text-white text-lg sm:text-xl font-bold">
                votre assistant StudyCloud.
              </span>
            </h1>

            {/* Question d'accueil personnalisée */}
            <p className="text-sm sm:text-base font-semibold text-blue-300/90 mb-2">
              Comment puis-je vous aider aujourd'hui ?
            </p>

            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              Posez toutes vos questions sur vos cours, devoirs et méthodologies. Vos échanges sont directs et disparaissent dès que vous fermez ce menu.
            </p>
          </div>
        ) : (
          /* LISTE DES MESSAGES DU CHAT DIRECT */
          messages.map((msg) => (
            <div key={msg.id} className="w-full shrink-0 flex flex-col">
              {msg.sender === 'user' ? (
                /* Message de l'utilisateur (aligné à droite) */
                <div className="flex justify-end w-full">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-[#242730] border border-zinc-700/60 px-4 py-3 text-[13px] sm:text-sm text-zinc-100 shadow-md leading-relaxed whitespace-pre-wrap break-words">
                    <MathText text={msg.text} inline={true} />
                    <div className="text-[10px] text-zinc-500 text-right mt-1.5 font-medium">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ) : (
                /* Réponse de Delmas IA (alignée à gauche avec robot bleu) */
                <div className="flex flex-col w-full max-w-full">
                  {/* Entête du message de Delmas */}
                  <div className="flex items-center gap-2 mb-1.5 pl-1">
                    <DelmasRobot size={22} variant="blue" />
                    <span className="text-xs font-bold bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
                      Delmas IA
                    </span>
                    <span className="text-[10px] text-zinc-500 ml-auto font-medium">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Corps du message avec écriture progressive en direct */}
                  <div className="rounded-2xl rounded-tl-xs bg-[#1a1c22] border border-zinc-800/90 px-4 py-3.5 text-[13px] sm:text-sm text-zinc-200 shadow-sm leading-relaxed min-h-[46px] flex flex-col justify-center">
                    {msg.isStreaming && !msg.text ? (
                      <div className="flex items-center gap-2 text-zinc-400 py-1">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                        </span>
                        <span className="text-xs font-medium text-blue-300/90">Delmas est en train d'écrire...</span>
                      </div>
                    ) : (
                      <DelmasMessageRenderer text={msg.text} isStreaming={msg.isStreaming} />
                    )}
                  </div>

                  {/* Actions sous le message (affichées une fois que Delmas a terminé d'écrire) */}
                  {!msg.isStreaming && msg.text && (
                    <div className="flex items-center gap-2 mt-1.5 pl-2 text-zinc-400 animate-fadeIn">
                      <button
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="p-1 rounded-md hover:bg-zinc-800 hover:text-zinc-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copier la réponse"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] text-emerald-400">Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Copier</span>
                          </>
                        )}
                      </button>

                      <div className="h-3 w-px bg-zinc-800" />

                      <button
                        onClick={() => handleReaction(msg.id, 'like')}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          msg.reaction === 'like'
                            ? 'text-emerald-400 bg-emerald-500/20'
                            : 'hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                        title="Bonne réponse"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleReaction(msg.id, 'dislike')}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          msg.reaction === 'dislike'
                            ? 'text-rose-400 bg-rose-500/20'
                            : 'hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                        title="Réponse à améliorer"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ZONE DE SAISIE EN BAS AVEC BOUTON D'ENVOI / ARRÊT INTÉGRÉ */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#181a20]/95 backdrop-blur-md shrink-0 relative z-20">
        <div className="relative flex items-end gap-2 bg-[#20232c] border border-zinc-700/70 focus-within:border-blue-500/80 rounded-2xl p-2 sm:p-2.5 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question à Delmas (ex: cours, formules, méthode)..."
            className="flex-1 bg-transparent resize-none text-[13px] sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none max-h-36 py-1 px-2 leading-relaxed"
          />

          {/* Bouton unique : Envoi quand inactif, Arrêt immédiat (Stop) quand en train de générer/écrire */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleStopGeneration}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/40 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95 group animate-pulse"
              title="Arrêter la réponse"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim()}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                inputValue.trim()
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] active:scale-95'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
              }`}
              title="Envoyer le message (Entrée)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Note de précaution sous le champ */}
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-zinc-400 font-medium text-center">
          <span>L'assistant Delmas peut se tromper.</span>
        </div>
      </div>
    </div>
  );
};

// Helper interne pour afficher proprement le Markdown et le LaTeX avec curseur d'écriture en temps réel
const DelmasMessageRenderer: React.FC<{ text: string; isStreaming?: boolean }> = ({ text, isStreaming }) => {
  const lines = useMemo(() => {
    if (!text) return [];
    return text.split('\n');
  }, [text]);

  return (
    <div className="space-y-2 text-left w-full leading-relaxed font-normal">
      {lines.map((line, idx) => {
        const isLastLine = idx === lines.length - 1;
        const trimmed = line.trim();

        // Titres H3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-blue-300 pt-2 pb-0.5 border-b border-zinc-800/80">
              <MathText text={trimmed.slice(4)} inline={true} />
              {isStreaming && isLastLine && (
                <span className="inline-block w-2 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle rounded-xs" />
              )}
            </h3>
          );
        }
        // Titres H2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-white pt-2.5 pb-1 border-b border-zinc-800">
              <MathText text={trimmed.slice(3)} inline={true} />
              {isStreaming && isLastLine && (
                <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle rounded-xs" />
              )}
            </h2>
          );
        }
        // Titres H1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-lg font-black bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent pt-3 pb-1">
              <MathText text={trimmed.slice(2)} inline={true} />
              {isStreaming && isLastLine && (
                <span className="inline-block w-2 h-4.5 ml-1 bg-blue-400 animate-pulse align-middle rounded-xs" />
              )}
            </h1>
          );
        }
        // Puces de listes (- ou *)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-blue-400 mt-1.5 text-xs">•</span>
              <div className="flex-1 break-words">
                <MathText text={trimmed.slice(2)} inline={true} />
                {isStreaming && isLastLine && (
                  <span className="inline-block w-2 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle rounded-xs" />
                )}
              </div>
            </div>
          );
        }

        // Ligne normale avec KaTeX
        return (
          <div key={idx} className="whitespace-pre-wrap break-words">
            <MathText text={line} inline={true} />
            {isStreaming && isLastLine && (
              <span className="inline-block w-2 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle rounded-xs" />
            )}
          </div>
        );
      })}
    </div>
  );
};
