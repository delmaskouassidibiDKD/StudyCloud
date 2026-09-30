import React from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, Info } from 'lucide-react';

interface GlobalToastProps {
  message: string | null;
  type?: 'success' | 'error' | 'info';
}

export const GlobalToast: React.FC<GlobalToastProps> = ({ message, type = 'success' }) => {
  if (!message) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999999] pointer-events-none max-w-lg w-auto px-4 py-2.5 rounded-full bg-stone-900/95 dark:bg-[#0E1526]/95 border border-white/20 text-white shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200 whitespace-nowrap"
    >
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
          type === 'error'
            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            : type === 'info'
            ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
        }`}
      >
        {type === 'error' ? (
          <AlertCircle className="w-3 h-3 stroke-[2.5]" />
        ) : type === 'info' ? (
          <Info className="w-3 h-3 stroke-[2.5]" />
        ) : (
          <Check className="w-3 h-3 stroke-[3]" />
        )}
      </div>
      <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
        {message}
      </span>
    </div>,
    document.body
  );
};
