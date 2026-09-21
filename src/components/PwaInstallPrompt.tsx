import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, CheckCircle, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Vérifier si l'application est déjà lancée en mode PWA / Standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Détection des appareils iOS (iPhone / iPad) qui requièrent l'action "Partager > Sur l'écran d'accueil"
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // 3. Écoute de l'événement natif Chrome / Android / Edge (beforeinstallprompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Ne pas ré-afficher si l'utilisateur l'a fermé au cours de cette session
      const hasDismissed = sessionStorage.getItem('studycloud_pwa_dismissed');
      if (!hasDismissed) {
        // Petit délai d'attente de 2.5s pour ne pas agresser l'utilisateur dès la première seconde
        setTimeout(() => setShowPrompt(true), 2500);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Écoute de la fin d'installation réussie
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('[StudyCloud PWA] Application installée avec succès !');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Déclenche le pop-up d'installation natif du navigateur
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[StudyCloud PWA] Installation acceptée par l\'utilisateur');
        setShowPrompt(false);
      } else {
        console.log('[StudyCloud PWA] Installation refusée');
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('studycloud_pwa_dismissed', 'true');
  };

  // Ne rien afficher si déjà installée ou si le prompt n'est pas actif
  if (isInstalled || (!showPrompt && !showIOSInstructions)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-bounceIn">
      <div className="relative overflow-hidden rounded-2xl bg-[#141720]/95 backdrop-blur-xl border border-blue-500/30 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(37,99,235,0.25)] text-white">
        {/* Ligne lumineuse supérieure */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 via-blue-500 to-indigo-500" />

        {/* Bouton Fermer */}
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-full transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {showIOSInstructions ? (
          /* Guide d'installation spécial iOS Safari */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Installer StudyCloud sur iPhone / iPad</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Pour installer l'application sur votre écran d'accueil :
            </p>
            <ol className="text-xs text-zinc-300 space-y-1.5 list-decimal pl-4">
              <li>
                Appuyez sur le bouton de partage <Share className="w-3.5 h-3.5 inline text-blue-400" /> en bas de Safari.
              </li>
              <li>
                Faites défiler vers le bas et appuyez sur <strong className="text-white">« Sur l'écran d'accueil »</strong>.
              </li>
              <li>
                Confirmez en appuyant sur <strong className="text-blue-400">Ajouter</strong> en haut à droite.
              </li>
            </ol>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Compris !
            </button>
          </div>
        ) : (
          /* Bannière standard d'installation PWA */
          <div className="flex items-start gap-3.5">
            {/* Logo officiel de l'application (Badge 3D StudyCloud) */}
            <div className="relative shrink-0 w-14 h-14 rounded-2xl overflow-hidden shadow-xl border border-white/15 bg-zinc-900">
              <img
                src="/icons/icon-192x192.png"
                alt="Logo StudyCloud"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="text-sm font-bold text-white tracking-tight truncate">
                  Installer StudyCloud
                </h3>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                  App PWA
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug mb-3">
                Accès direct sur l'écran d'accueil et consultations disponibles <strong>même sans connexion internet</strong>.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 py-1.8 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_2px_10px_rgba(37,99,235,0.4)] active:scale-97 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Installer</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-1.8 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
