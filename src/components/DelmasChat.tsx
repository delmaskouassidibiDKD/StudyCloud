import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Copy, Check, X, ThumbsUp, ThumbsDown, Loader2, Trash2, ArrowRight } from 'lucide-react';
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
}

interface DelmasChatProps {
  onClose: () => void;
}

const STARTER_PROMPTS = [
  {
    icon: '📚',
    title: 'Comprendre un cours',
    prompt: 'Explique-moi simplement un concept difficile avec des exemples concrets et faciles à retenir.',
  },
  {
    icon: '💡',
    title: 'Méthode de mémorisation',
    prompt: 'Quelles sont les meilleures techniques pour mémoriser rapidement et durablement mes leçons ?',
  },
  {
    icon: '📐',
    title: 'Formules & Calculs',
    prompt: 'Aide-moi à comprendre le raisonnement derrière une formule mathématique ou scientifique complexe.',
  },
  {
    icon: '🎯',
    title: 'Plan de révisions',
    prompt: 'Comment organiser un emploi du temps de révision équilibré pour réussir mes prochains examens ?',
  },
];

export const DelmasChat: React.FC<DelmasChatProps> = ({ onClose }) => {
  // État 100% en mémoire locale (éphémère : détruit dès que le composant est fermé/démonté)
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll vers le bas dès qu'un message arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus automatique du champ au démarrage
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Écoute de la touche Échap pour fermer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Envoi d'un message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    // Ajuster la hauteur du textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Construction de l'historique court en mémoire vive uniquement
      const historyPayload = newMessages.slice(-8).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await sendDelmasChatMessage({
        message: text,
        history: historyPayload,
      });

      const delmasMessage: Message = {
        id: `delmas-${Date.now()}`,
        sender: 'delmas',
        text: res.response || "Je n'ai pas pu générer de réponse pour le moment.",
        model: res.model || 'Delmas Direct AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, delmasMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        sender: 'delmas',
        text: `Désolé, une erreur temporaire est survenue : ${err?.message || 'Connexion impossible'}. Veuillez réessayer.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
    setMessages([]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#16181d] text-zinc-100 select-text overflow-hidden relative font-sans">
      {/* Halo d'ambiance Orange et Bleu en arrière-plan */}
      <div className="absolute top-0 left-1/4 w-96 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* EN-TÊTE : Robot Orange-Bleu, Titre, Statut Éphémère, Bouton Fermer */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-[#1a1d24]/90 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-orange-500 to-blue-600 opacity-60 blur-xs" />
            <DelmasRobot size={36} variant="orange-blue" className="relative" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base tracking-wide bg-gradient-to-r from-orange-400 via-amber-300 to-blue-400 bg-clip-text text-transparent">
                DELMAS IA
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
                Direct & Éphémère
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

      {/* ZONE CENTRALE : Messages ou Écran d'Accueil Orange & Bleu */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 flex flex-col relative z-10"
      >
        {messages.length === 0 ? (
          /* ÉCRAN DE BIENVENUE ORANGE & BLEU DEMANDÉ PAR L'UTILISATEUR */
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 sm:py-10 max-w-2xl mx-auto w-full animate-fadeIn">
            {/* Robot Delmas Orange-Bleu imposant avec double halo */}
            <div className="relative mb-5 flex items-center justify-center">
              <div 
                className="absolute w-28 h-28 rounded-full pointer-events-none transition-all duration-700"
                style={{
                  background: 'radial-gradient(circle, rgba(249,115,22,0.45) 0%, rgba(37,99,235,0.3) 50%, transparent 75%)',
                  filter: 'blur(16px)',
                }}
              />
              <div className="p-1.5 rounded-full ring-2 ring-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.45)]">
                <DelmasRobot size={68} variant="orange-blue" />
              </div>
            </div>

            {/* Titre Orange & Bleu vibrant */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black mb-2.5 tracking-tight">
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-blue-400 bg-clip-text text-transparent">
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

            <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-6">
              Posez toutes vos questions sur vos cours, devoirs et méthodologies. Vos échanges sont directs et disparaissent intégralement dès que vous fermez ce menu.
            </p>

            {/* Suggestions rapides en 1 tap (Questions de causerie / révision) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {STARTER_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  className="group p-3 rounded-2xl bg-[#1f222a]/80 hover:bg-[#252934] border border-zinc-800 hover:border-orange-500/40 transition-all duration-200 text-left cursor-pointer flex items-start gap-3 active:scale-98"
                >
                  <span className="text-xl shrink-0 p-1.5 rounded-xl bg-zinc-800/80 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-orange-300 transition-colors flex items-center justify-between">
                      <span>{item.title}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100" />
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-snug">
                      {item.prompt}
                    </p>
                  </div>
                </button>
              ))}
            </div>
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
                /* Réponse de Delmas IA (alignée à gauche avec robot orange-bleu) */
                <div className="flex flex-col w-full max-w-full">
                  {/* Entête du message de Delmas */}
                  <div className="flex items-center gap-2 mb-1.5 pl-1">
                    <DelmasRobot size={22} variant="orange-blue" />
                    <span className="text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                      Delmas IA
                    </span>
                    {msg.model && (
                      <span className="text-[9px] font-semibold text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded-md border border-zinc-700/40">
                        {msg.model}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 ml-auto font-medium">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Corps du message avec KaTeX et Markdown */}
                  <div className="rounded-2xl rounded-tl-xs bg-[#1a1c22] border border-zinc-800/90 px-4 py-3.5 text-[13px] sm:text-sm text-zinc-200 shadow-sm leading-relaxed">
                    <DelmasMessageRenderer text={msg.text} />
                  </div>

                  {/* Barre d'action sous le message (Copier, Avis) */}
                  <div className="flex items-center gap-2 mt-1.5 pl-2 text-zinc-400">
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
                </div>
              )}
            </div>
          ))
        )}

        {/* Indicateur d'écriture de Delmas */}
        {isLoading && (
          <div className="flex flex-col w-full animate-pulse pl-1">
            <div className="flex items-center gap-2 mb-1.5">
              <DelmasRobot size={22} variant="orange-blue" />
              <span className="text-xs font-bold text-orange-400">Delmas réfléchit...</span>
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-[#1a1c22] border border-orange-500/30 px-4 py-3 text-zinc-300 max-w-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
              <span className="text-xs font-medium text-zinc-400">
                Génération de la réponse en cours...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ZONE DE SAISIE EN BAS */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#181a20]/95 backdrop-blur-md shrink-0 relative z-20">
        <div className="relative flex items-end gap-2 bg-[#20232c] border border-zinc-700/70 focus-within:border-orange-500/80 rounded-2xl p-2 sm:p-2.5 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // Auto-grow jusqu'à 5 lignes
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question à Delmas (ex: cours, formules, méthode)..."
            className="flex-1 bg-transparent resize-none text-[13px] sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none max-h-36 py-1 px-2 leading-relaxed"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
              inputValue.trim() && !isLoading
                ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white shadow-[0_2px_12px_rgba(249,115,22,0.4)] active:scale-95'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
            }`}
            title="Envoyer le message (Entrée)"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-300" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Note de réassurance éphémère */}
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-zinc-500 font-medium">
          <span>🔒 Causerie instantanée • Tout s'efface automatiquement dès que vous quittez.</span>
        </div>
      </div>
    </div>
  );
};

// Helper interne pour afficher proprement le Markdown et le LaTeX dans les réponses de Delmas
const DelmasMessageRenderer: React.FC<{ text: string }> = ({ text }) => {
  const lines = useMemo(() => {
    if (!text) return [];
    return text.split('\n');
  }, [text]);

  return (
    <div className="space-y-2 text-left w-full leading-relaxed font-normal">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Titres H3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-orange-300 pt-2 pb-0.5 border-b border-zinc-800/80">
              <MathText text={trimmed.slice(4)} inline={true} />
            </h3>
          );
        }
        // Titres H2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-white pt-2.5 pb-1 border-b border-zinc-800">
              <MathText text={trimmed.slice(3)} inline={true} />
            </h2>
          );
        }
        // Titres H1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-lg font-black bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent pt-3 pb-1">
              <MathText text={trimmed.slice(2)} inline={true} />
            </h1>
          );
        }
        // Puces de listes (- ou *)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-orange-400 mt-1.5 text-xs">•</span>
              <div className="flex-1 break-words">
                <MathText text={trimmed.slice(2)} inline={true} />
              </div>
            </div>
          );
        }

        // Bloc de code simple
        if (trimmed.startsWith('```')) {
          return null; // Déjà géré ou délimiteur
        }

        // Ligne normale avec rendu KaTeX
        return (
          <div key={idx} className="whitespace-pre-wrap break-words">
            <MathText text={line} inline={true} />
          </div>
        );
      })}
    </div>
  );
};
