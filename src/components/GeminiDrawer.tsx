import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface GeminiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiDrawer: React.FC<GeminiDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<{ sender: 'ai' | 'user'; text: string; time?: string }[]>([
    {
      sender: 'ai',
      text: "Bonjour ! Je suis votre assistant Gemini. Que puis-je faire pour vous dans vos dossiers, cours ou révisions aujourd'hui ?",
      time: 'Maintenant'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? inputVal).trim();
    if (!text || isTyping) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text, time: timeString }]);
    setInputVal('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = `J'ai bien analysé votre demande : "${text}". `;
      const lower = text.toLowerCase();
      if (lower.includes('résum') || lower.includes('document') || lower.includes('cours')) {
        reply += "Je peux extraire les points clés de vos documents de cours enregistrés et préparer des fiches synthétiques.";
      } else if (lower.includes('emploi') || lower.includes('horaire') || lower.includes('temps')) {
        reply += "Votre emploi du temps peut être consulté et organisé directement depuis la section Emploi du Temps.";
      } else if (lower.includes('calcul') || lower.includes('note') || lower.includes('moyenne')) {
        reply += "Vous pouvez utiliser la calculatrice 3D et le gestionnaire de notes pour simuler vos coefficients d'examens.";
      } else {
        reply += "Que souhaitez-vous explorer en priorité pour vos études ou vos dossiers partagés ?";
      }

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
    }, 650);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    "📝 Résumer mes documents",
    "📅 Organiser mon emploi du temps",
    "🧮 Aide aux calculs et moyennes",
    "💡 Préparer une fiche de révision"
  ];

  const drawerPortal = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200000] flex flex-col justify-end sm:items-center sm:justify-center overflow-hidden">
          {/* Backdrop with high z-index to cover mobile bottom bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Google Workspace Gemini Bottom Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative z-10 w-full sm:max-w-xl max-h-[90vh] sm:max-h-[85vh] h-auto bg-[#1e2024] text-white rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col border-t border-zinc-700/50 sm:border sm:border-zinc-700/60 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle (as seen on Google Gemini Mobile) */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1 bg-zinc-500/80 rounded-full" />
            </div>

            {/* Top Action Bar: Sparkle Icon (Left) & Close Button (Right) */}
            <div className="px-6 py-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {/* Authentic 4-pointed Gemini Sparkle Icon */}
                <svg
                  className="w-6 h-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
                </svg>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Prominent Gemini Title: "Que puis-je faire pour vous ?" */}
            <div className="px-6 pt-1 pb-3 shrink-0">
              <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#70a5ff]">
                Que puis-je faire pour vous ?
              </h2>
            </div>

            {/* Messages & Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3.5 min-h-[140px] max-h-[38vh]">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
                      </svg>
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                      msg.sender === 'user'
                        ? 'bg-[#2b4c7e] text-white rounded-br-xs'
                        : 'bg-[#282a2f] text-zinc-100 border border-zinc-700/50 rounded-bl-xs'
                    }`}
                  >
                    <p>{msg.text}</p>
                    {msg.time && (
                      <span className="text-[10px] text-zinc-400/80 mt-1 block text-right font-mono">
                        {msg.time}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-blue-400 py-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span>Gemini réfléchit...</span>
                </div>
              )}

              {/* Suggestions chips */}
              {messages.length <= 2 && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      className="text-xs bg-[#282a2f] hover:bg-[#34373d] text-zinc-300 hover:text-white px-3 py-1.5 rounded-full border border-zinc-700/60 transition-colors cursor-pointer text-left"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Form Area (Textarea + Send Button) */}
            <div className="px-5 pt-3 pb-8 sm:pb-6 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex flex-col gap-2 bg-[#282a2f] border border-zinc-700/60 rounded-3xl p-3 sm:p-3.5 focus-within:border-[#70a5ff]/70 transition-all shadow-lg"
              >
                <textarea
                  ref={textareaRef}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Saisissez un prompt ici"
                  rows={2}
                  className="w-full bg-transparent text-white placeholder-zinc-400 text-sm outline-none resize-none min-h-[44px] max-h-28"
                />

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-zinc-500 font-medium hidden sm:inline">
                    Appuyez sur Entrée pour envoyer
                  </span>
                  <div className="sm:hidden" />

                  <button
                    type="submit"
                    disabled={!inputVal.trim() || isTyping}
                    className="self-end px-4 py-1.5 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950 font-bold text-xs rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    <span>Envoyer</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {/* Legal / Disclaimer Notice (from Google Workspace Gemini) */}
              <p className="text-[11px] text-zinc-400 text-center mt-2.5">
                Gemini dans Workspace peut faire des erreurs.{' '}
                <span className="underline cursor-pointer hover:text-zinc-300">En savoir plus</span>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerPortal, document.body);
};
