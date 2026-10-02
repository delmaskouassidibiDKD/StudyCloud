import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Sparkles, X, ShieldAlert } from 'lucide-react';

export const AppUpdatePrompt: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCriticalBlocked, setIsCriticalBlocked] = useState<boolean>(false);
  const [blockedReason, setBlockedReason] = useState<string>('');
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 0. VÉRIFICATION AU RECHARGEMENT DE L'ÉCRAN :
    // Si une mise à jour était en attente (et non appliquée), réafficher systématiquement
    // le message à chaque rechargement pour que l'utilisateur soit informé !
    const wasPending = localStorage.getItem('studycloud_update_pending') === 'true';
    if (wasPending) {
      setShowUpdate(true);
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    let refreshing = false;

    // 1. Écouter le changement de contrôleur pour recharger immédiatement la page
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[StudyCloud Update] Nouveau Service Worker actif, actualisation...');
        localStorage.removeItem('studycloud_update_pending');
        localStorage.removeItem('studycloud_update_postponed');
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 2. Détection purement événementielle via le Service Worker (0 boucle de polling)
    navigator.serviceWorker.ready.then((registration) => {
      registrationRef.current = registration;

      // Si un Service Worker est déjà en attente d'activation
      if (registration.waiting && navigator.serviceWorker.controller) {
        console.log('[StudyCloud Update] Mise à jour déjà téléchargée en attente.');
        localStorage.setItem('studycloud_update_pending', 'true');
        setShowUpdate(true);
      }

      // Écouter l'arrivée d'une nouvelle version sur Cloudflare
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // Si le nouveau worker est installé ET qu'un ancien contrôlait déjà la page
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[StudyCloud Update] Nouvelle version détectée et prête à être installée.');
            localStorage.setItem('studycloud_update_pending', 'true');
            setShowUpdate(true);
          }
        });
      });
    }).catch((err) => {
      console.warn('[StudyCloud Update] Erreur écoute Service Worker:', err);
    });

    // 3. Déclenchement événementiel unique lors du retour sur l'onglet (sans boucle)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registrationRef.current) {
        // Demande au navigateur de vérifier si sw.js a changé sur Cloudflare
        registrationRef.current.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Filet de sécurité événementiel en cas de chunk obsolète suite à un nouveau déploiement
    const handlePreloadError = (e: Event) => {
      e.preventDefault();
      console.warn('[StudyCloud Update] Erreur de chargement de chunk détectée (nouvelle version déployée).');
      localStorage.setItem('studycloud_update_pending', 'true');
      setShowUpdate(true);
    };
    window.addEventListener('vite:preloadError', handlePreloadError);

    // 5. SURVEILLANCE ACTIVE : Détecter les tentatives d'actions sensibles bloquées pour protéger la base de données
    const handleCriticalUpdate = (e: any) => {
      console.warn('[StudyCloud Security Lock] Tentative sensible bloquée:', e.detail);
      localStorage.setItem('studycloud_update_pending', 'true');
      localStorage.removeItem('studycloud_update_postponed'); // Révoquer le report pour exiger l'actualisation
      setBlockedReason(e.detail?.message || 'Une mise à jour est requise pour effectuer cette action afin de protéger vos données et éviter toute corruption de la base de données.');
      setIsCriticalBlocked(true);
      setShowUpdate(true);
    };
    window.addEventListener('studycloud_critical_update_required', handleCriticalUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vite:preloadError', handlePreloadError);
      window.removeEventListener('studycloud_critical_update_required', handleCriticalUpdate);
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    localStorage.removeItem('studycloud_update_pending');
    localStorage.removeItem('studycloud_update_postponed');

    const reg = registrationRef.current;
    if (reg && reg.waiting) {
      // Signaler au Service Worker en attente de prendre le contrôle
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Vider les caches éventuels et actualiser directement
      if ('caches' in window) {
        caches.keys().then((names) => {
          return Promise.all(names.map((name) => caches.delete(name)));
        }).finally(() => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }

    // Sécurité de secours : forcer le rechargement après 1.5s si controllerchange tarde
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleDismiss = () => {
    // Si l'utilisateur clique sur "Plus tard", on enregistre qu'il a reporté la mise à jour
    // Le système entre alors en "Mode surveillance" pour bloquer toute modification pouvant corrompre la BDD
    localStorage.setItem('studycloud_update_postponed', 'true');
    setShowUpdate(false);
    setIsCriticalBlocked(false);
  };

  if (!showUpdate) {
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CAS 1 : MODAL DE SÉCURITÉ RENFORCÉE (L'utilisateur a tenté une action sensible)
  // ───────────────────────────────────────────────────────────────────────────
  if (isCriticalBlocked) {
    return (
      <div
        id="studycloud-critical-update-modal"
        className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-3xl bg-[#141416] border-2 border-red-500/50 p-6 sm:p-7 max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_35px_rgba(239,68,68,0.3)] text-white text-center">
          {/* Ligne rouge supérieure */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500" />

          {/* Icône de bouclier de sécurité */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-950/50">
            <ShieldAlert className="w-8 h-8 animate-pulse text-red-500" />
          </div>

          <h3 className="text-lg font-black text-white tracking-wide">
            Action suspendue pour votre sécurité
          </h3>

          <p className="text-xs text-stone-300 mt-2.5 leading-relaxed">
            {blockedReason || "Une nouvelle version est disponible. Cette modification a été temporairement bloquée afin de protéger vos données et garantir leur conformité avec la base de données."}
          </p>

          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              id="btn-critical-update-studycloud"
              disabled={isUpdating}
              onClick={handleUpdate}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-orange-950/60 transition-all cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Mise à jour en cours...' : 'Mettre à jour maintenant'}</span>
            </button>

            <p className="text-[11px] text-stone-400">
              Vos cours, fichiers et notes sont protégés. L'actualisation ne prend que 2 secondes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CAS 2 : BANNIÈRE ÉVÉNEMENTIELLE CLASSIQUE EN HAUT DE L'ÉCRAN
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div
      id="studycloud-update-notification"
      className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-auto sm:min-w-[420px] sm:max-w-lg z-[999999] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#18181b]/95 backdrop-blur-2xl border border-orange-500/40 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(234,88,12,0.25)] text-white">
        {/* Ligne lumineuse gradient supérieure */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

        <div className="flex items-start gap-3.5">
          {/* Badge icône dynamique */}
          <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>

          {/* Contenu textuel */}
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
              <span>Mise à jour disponible</span>
            </h4>
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              Une nouvelle version de StudyCloud est disponible avec des améliorations.
            </p>

            {/* Boutons d'action */}
            <div className="flex items-center gap-2.5 mt-3">
              <button
                type="button"
                id="btn-update-studycloud"
                disabled={isUpdating}
                onClick={handleUpdate}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-900/40 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? 'Actualisation...' : 'Mettre à jour'}</span>
              </button>

              <button
                type="button"
                id="btn-dismiss-update-studycloud"
                onClick={handleDismiss}
                className="px-3 py-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Plus tard
              </button>
            </div>
          </div>

          {/* Bouton de fermeture d'angle */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-2.5 right-2.5 p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 rounded-full transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
