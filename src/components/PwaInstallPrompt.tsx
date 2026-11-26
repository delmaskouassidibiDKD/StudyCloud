import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __SC_DEFERRED_INSTALL_PROMPT__?: BeforeInstallPromptEvent | null;
  }
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.__SC_DEFERRED_INSTALL_PROMPT__ || null : null)
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem('studycloud_pwa_dismissed') === 'true'
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Récupérer l'événement natif déjà capturé très tôt dans index.html (avant le chargement de React)
    if (window.__SC_DEFERRED_INSTALL_PROMPT__) {
      setDeferredPrompt(window.__SC_DEFERRED_INSTALL_PROMPT__);
    }

    const handleReadyFromHead = () => {
      if (window.__SC_DEFERRED_INSTALL_PROMPT__) {
        setDeferredPrompt(window.__SC_DEFERRED_INSTALL_PROMPT__);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__SC_DEFERRED_INSTALL_PROMPT__ = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      window.__SC_DEFERRED_INSTALL_PROMPT__ = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('studycloud_install_prompt_ready', handleReadyFromHead);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('studycloud_install_prompt_ready', handleReadyFromHead);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.__SC_DEFERRED_INSTALL_PROMPT__;
    if (!promptEvent || installing) return;

    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      window.__SC_DEFERRED_INSTALL_PROMPT__ = null;
      setDeferredPrompt(null);
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch {
      window.__SC_DEFERRED_INSTALL_PROMPT__ = null;
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('studycloud_pwa_dismissed', 'true');
    } catch {}
  };

  // Afficher UNIQUEMENT quand l'installation directe en 1 clic est prête (aucune fenêtre d'étapes 1, 2, 3)
  if (isInstalled || dismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div className="pwa-prompt-container animate-bounceIn select-none">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#141720]/95 backdrop-blur-2xl border border-blue-500/40 p-3.5 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(37,99,235,0.35)] text-white">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 via-blue-500 to-indigo-500" />

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-full transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-xl border border-white/15 bg-zinc-900">
            <img
              src="/icons/icon-192x192.png"
              alt="StudyCloud"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 pr-3 sm:pr-4">
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight truncate mb-0.5">
              Télécharger StudyCloud
            </h3>
            <p className="text-[11px] text-zinc-300 leading-snug mb-2.5">
              Téléchargez l'application pour l'utiliser <strong>même hors connexion</strong>.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={installing}
                onClick={handleInstallClick}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_2px_12px_rgba(37,99,235,0.45)] active:scale-95 transition-all cursor-pointer disabled:opacity-70"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{installing ? 'Téléchargement...' : 'Télécharger'}</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-2 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
