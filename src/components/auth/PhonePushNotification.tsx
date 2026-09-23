import React, { useEffect, useState } from 'react';
import { DnaLogo } from '../DnaLogo';
import { X } from 'lucide-react';

interface PhonePushNotificationProps {
  title?: string;
  message: string;
  targetEmail?: string;
  onClose: () => void;
  durationMs?: number;
}

export function PhonePushNotification({
  title = 'StudyCloud',
  message,
  targetEmail,
  onClose,
  durationMs = 7000,
}: PhonePushNotificationProps) {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Jouer un son discret de notification WhatsApp / Smartphone
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      // Première note douce
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Deuxième note (accord de carillon)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1); // A5
      gain2.gain.setValueAtTime(0.25, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } catch (e) {
      // Audio context non bloquant
    }

    // Animation d'entrée
    const timerIn = setTimeout(() => setIsVisible(true), 20);

    // Barre de progression
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remainingPct);
      if (remainingPct <= 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 50);

    return () => {
      clearTimeout(timerIn);
      clearInterval(interval);
    };
  }, [durationMs]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999999] w-[94%] max-w-[420px] transition-all duration-300 ease-out select-none ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-12 opacity-0 scale-95'
      }`}
    >
      <div
        className="relative overflow-hidden rounded-2xl p-3.5 shadow-2xl cursor-pointer active:scale-[0.98] transition-transform"
        onClick={handleDismiss}
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header style notification WhatsApp */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <DnaLogo className="w-4 h-4" glow={false} />
            </div>
            <span className="text-[11px] font-black text-white/90 tracking-wide uppercase">
              {title}
            </span>
            <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
              WhatsApp Alert
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 font-medium">maintenant</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Message body */}
        <div className="flex items-start gap-2.5 pl-0.5">
          <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5 animate-ping" />
          <div className="flex-1">
            <p className="text-xs font-bold text-white leading-snug">
              {message}
            </p>
            {targetEmail && (
              <p className="text-[11px] font-mono text-orange-400 font-semibold mt-0.5 break-all">
                ✉️ Envoyé à : {targetEmail}
              </p>
            )}
          </div>
        </div>

        {/* Dynamic progress bar at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
