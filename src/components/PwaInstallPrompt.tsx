import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, MoreVertical } from 'lucide-react';

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
  const [showInstructions, setShowInstructions] = useState<'ios' | 'android' | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Vérifier si l'application est déjà lancée en mode autonome (déjà installée)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Détection iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // 3. Écoute de l'événement natif Chrome / Android / Edge si disponible
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Écoute de l'événement d'installation réussie
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setShowInstructions(null);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. Afficher automatiquement la bannière après un court délai (1.5s)
    // Ne pas afficher uniquement si l'utilisateur vient de la fermer dans l'onglet actif
    const hasDismissed = sessionStorage.getItem('studycloud_pwa_dismissed');
    if (!hasDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setShowPrompt(false);
        }
        setDeferredPrompt(null);
      } catch {
        if (isIOS) setShowInstructions('ios');
        else setShowInstructions('android');
      }
    } else if (isIOS) {
      setShowInstructions('ios');
    } else {
      setShowInstructions('android');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowInstructions(null);
    sessionStorage.setItem('studycloud_pwa_dismissed', 'true');
  };

  // Ne rien afficher si l'application est déjà installée
  if (isInstalled || (!showPrompt && !showInstructions)) {
    return null;
  }

  return (
    <div className="pwa-prompt-container animate-bounceIn select-none">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#141720]/95 backdrop-blur-2xl border border-blue-500/40 p-3.5 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(37,99,235,0.35)] text-white">
        {/* Ligne lumineuse supérieure */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 via-blue-500 to-indigo-500" />

        {/* Bouton Fermer */}
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-full transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {showInstructions === 'ios' ? (
          /* Guide simple pour iPhone / iPad */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Installer l'application sur iPhone / iPad</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Pour utiliser l'application même hors connexion :
            </p>
            <ol className="text-xs text-zinc-300 space-y-1.5 list-decimal pl-4">
              <li>
                Appuyez sur le bouton de partage <Share className="w-3.5 h-3.5 inline text-blue-400" /> en bas de l'écran.
              </li>
              <li>
                Faites défiler vers le bas et choisissez <strong className="text-white">« Sur l'écran d'accueil »</strong>.
              </li>
              <li>
                Appuyez sur <strong className="text-blue-400">Ajouter</strong> en haut à droite.
              </li>
            </ol>
            <button
              onClick={() => setShowInstructions(null)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-md active:scale-95"
            >
              Compris !
            </button>
          </div>
        ) : showInstructions === 'android' ? (
          /* Guide simple pour Android / Navigateur */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Installer l'application</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Pour utiliser l'application même hors connexion :
            </p>
            <ol className="text-xs text-zinc-300 space-y-1.5 list-decimal pl-4">
              <li>
                Appuyez sur le menu <MoreVertical className="w-3.5 h-3.5 inline text-blue-400" /> en haut à droite de votre navigateur.
              </li>
              <li>
                Choisissez <strong className="text-white">« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »).
              </li>
              <li>
                Validez pour y accéder à tout moment.
              </li>
            </ol>
            <button
              onClick={() => setShowInstructions(null)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-md active:scale-95"
            >
              Compris !
            </button>
          </div>
        ) : (
          /* Bannière principale : zéro terme technique, juste télécharger pour utiliser hors connexion */
          <div className="flex items-start gap-3">
            {/* Logo officiel de l'application */}
            <div className="relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-xl border border-white/15 bg-zinc-900">
              <img
                src="/icons/icon-192x192.png"
                alt="Logo StudyCloud"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 pr-3 sm:pr-4">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-tight truncate mb-0.5">
                Télécharger l'application
              </h3>
              <p className="text-[11px] text-zinc-300 leading-snug mb-2.5">
                Téléchargez l'application pour utiliser StudyCloud <strong>même hors connexion</strong>.
              </p>

              {/* Boutons d'action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_2px_12px_rgba(37,99,235,0.45)] active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Télécharger</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-2 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
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
