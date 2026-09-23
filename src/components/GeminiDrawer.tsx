import React, { useState, useRef, useEffect } from 'react';
import { X, Send, ThumbsUp, ThumbsDown, Copy, ArrowUpRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'motion/react';

interface GeminiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiDrawer: React.FC<GeminiDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<{ sender: 'ai' | 'user'; text: string; time?: string }[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const dragControls = useDragControls();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea dynamically when typing, capped at 100px so it stops expanding
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const cappedHeight = Math.min(Math.max(scrollHeight, 40), 100);
      textareaRef.current.style.height = `${cappedHeight}px`;
    }
  }, [inputVal]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
        if (textareaRef.current) {
          textareaRef.current.style.height = '40px';
          textareaRef.current.focus();
        }
      }, 150);
    } else {
      // Clear messages and input after drawer closing animation finishes
      setTimeout(() => {
        setMessages([]);
        setInputVal('');
        setIsTyping(false);
        setIsExpanded(false);
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [messages, isTyping]);

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
            initial={{ y: '100%', height: 'auto' }}
            animate={{ 
              y: 0,
              height: isExpanded && isMobile ? '100dvh' : 'auto' 
            }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={`relative z-10 w-full sm:max-w-3xl bg-[#1e2024] text-white rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col border-t border-zinc-700/50 sm:border sm:border-zinc-700/60 sm:overflow-hidden ${
              isExpanded && isMobile 
                ? 'max-h-[100dvh] h-[100dvh] rounded-none' 
                : 'max-h-[75dvh] sm:max-h-[520px] min-h-[300px]'
            }`}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (!isMobile) return;
              
              const threshold = 50;
              const velocityThreshold = 500;
              
              if (info.offset.y < -threshold || info.velocity.y < -velocityThreshold) {
                setIsExpanded(true);
              } else if (info.offset.y > threshold || info.velocity.y > velocityThreshold) {
                if (isExpanded) {
                  setIsExpanded(false);
                } else {
                  onClose();
                }
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle (as seen on Google Gemini Mobile) */}
            <div 
              className="pt-3 pb-2 flex justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none w-full"
              onPointerDown={(e) => dragControls.start(e)}
            >
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

              <div className="flex items-center gap-1 sm:gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors cursor-pointer"
                    title="Effacer l'historique"
                  >
                    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <defs>
                        <mask id="history-cutout">
                          <rect width="24" height="24" fill="white" />
                          <circle cx="19" cy="19" r="5" fill="black" />
                        </mask>
                      </defs>
                      <g mask="url(#history-cutout)">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M12 7v5l3 3" />
                      </g>
                      <path d="M16 16l6 6" strokeWidth="2.5" />
                      <path d="M22 16l-6 6" strokeWidth="2.5" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Prominent Gemini Title: "Que puis-je faire pour vous ?" */}
            {messages.length === 0 && (
              <div className="px-6 pt-1 pb-3 shrink-0">
                <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#70a5ff]">
                  Que puis-je faire pour vous ?
                </h2>
              </div>
            )}

            {/* Messages & Content Area */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-3.5"
            >
              {messages.map((msg, idx) => (
                <div key={idx} className="w-full mb-5">
                  {msg.sender === 'user' ? (
                    <div className="flex justify-end w-full">
                      <div className="bg-[#2a2b2f] text-zinc-100 px-4 py-2.5 rounded-[24px] rounded-tr-[4px] text-[13px] sm:text-sm max-w-[85%]">
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col w-full text-zinc-100">
                      {/* AI Sparkle Icon */}
                      <div className="mb-2">
                        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="url(#sparkle-gradient)">
                          <defs>
                            <linearGradient id="sparkle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#60A5FA" />
                              <stop offset="100%" stopColor="#A78BFA" />
                            </linearGradient>
                          </defs>
                          <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
                        </svg>
                      </div>
                      
                      {/* AI Text Content */}
                      <div className="text-[13px] sm:text-sm leading-relaxed font-medium text-zinc-200">
                        <p>{msg.text}</p>
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
              ))}

              {isTyping && (
                <div className="flex flex-col w-full text-zinc-100 mb-5">
                  <div className="mb-3">
                    <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="url(#sparkle-gradient-loading)">
                      <defs>
                        <linearGradient id="sparkle-gradient-loading" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#60A5FA" />
                          <stop offset="100%" stopColor="#A78BFA" />
                        </linearGradient>
                      </defs>
                      <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-2.5 w-full mt-1 animate-pulse">
                    <div className="h-[14px] w-[90%] rounded-full bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-transparent" />
                    <div className="h-[14px] w-[75%] rounded-full bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-transparent" />
                    <div className="h-[14px] w-[45%] rounded-full bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-transparent" />
                  </div>
                </div>
              )}
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
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="Saisissez un prompt ici"
                  rows={1}
                  className="w-full bg-transparent text-white placeholder-zinc-400 text-sm outline-none resize-none min-h-[40px] max-h-[100px] overflow-y-auto leading-relaxed"
                />

                <div className="flex items-center justify-end pt-0.5">
                  <button
                    type="submit"
                    disabled={!inputVal.trim() || isTyping}
                    className="p-2 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    title="Envoyer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Legal / Disclaimer Notice (from Google Workspace Gemini) */}
              <p className={`text-[11px] text-zinc-400 text-center mt-2.5 ${isInputFocused && isMobile ? 'hidden' : 'block'}`}>
                Gemini dans StudyCloud peut se tromper.{' '}
                <span className="underline cursor-pointer hover:text-zinc-300">En savoir plus</span>
              </p>
            </div>

            {/* Anti-bounce gap filler: Covers empty space at bottom when dragging upwards on mobile */}
            <div className="absolute top-[99%] left-0 right-0 h-[50vh] bg-[#1e2024] sm:hidden" />
          </motion.div>

          {/* Modal Confirmation Effacer Historique */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[210000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setShowClearConfirm(false)}
              >
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="bg-[#2a2b2f] text-white rounded-[28px] p-6 w-full max-w-[340px] shadow-2xl flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-[22px] font-normal text-zinc-100 mb-4 tracking-tight leading-snug">
                    Effacer l'historique de Gemini ?
                  </h3>
                  <p className="text-[15px] text-zinc-300 leading-relaxed mb-8">
                    L'historique de Gemini sera effacé et vous ne pourrez pas le restaurer.
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 text-[#70a5ff] font-medium text-sm rounded-full hover:bg-[#70a5ff]/10 transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMessages([]);
                        setInputVal('');
                        setIsTyping(false);
                        setShowClearConfirm(false);
                      }}
                      className="px-4 py-2 text-[#70a5ff] font-medium text-sm rounded-full hover:bg-[#70a5ff]/10 transition-colors cursor-pointer"
                    >
                      Effacer
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerPortal, document.body);
};
