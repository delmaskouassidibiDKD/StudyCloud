import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, X, ShieldAlert } from 'lucide-react';

export const AppUpdatePrompt: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCriticalBlocked, setIsCriticalBlocked] = useState<boolean>(false);
  const [blockedReason, setBlockedReason] = useState<string>('');
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Vérifier strictement si l'utilisateur est connecté avec un compte
  const isTargetAccountConnected = (): boolean => {
    if (typeof localStorage === 'undefined') return false;
    const token = localStorage.getItem('sc_auth_token');
    const uid = localStorage.getItem('unifolder_user_id');
    const user = localStorage.getItem('sc_auth_user');

    if (token && token.trim().length > 0) return true;
    if (uid && uid !== 'default-user' && uid !== 'user_anonymous' && uid.trim().length > 0) return true;
    if (user) {
      try {
        const parsed = JSON.parse(user);
        if (parsed?.id && parsed.id !== 'default-user' && parsed.id !== 'user_anonymous') return true;
      } catch {}
    }
    return false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 1. Déclencheur d'affichage sécurisé (uniquement pour les comptes connectés)
    const triggerUpdatePrompt = (critical = false, reason = '') => {
      if (!isTargetAccountConnected()) return;
      localStorage.setItem('studycloud_update_pending', 'true');
      if (critical) {
        localStorage.removeItem('studycloud_update_postponed');
        setIsCriticalBlocked(true);
        if (reason) setBlockedReason(reason);
      }
      setShowUpdate(true);
    };

    // 2. Si une mise à jour était déjà en attente au rechargement de l'écran :
    const wasPending = localStorage.getItem('studycloud_update_pending') === 'true';
    if (wasPending && isTargetAccountConnected()) {
      triggerUpdatePrompt();
    }

    // 3. Fonction de vérification universelle (fonctionne sur 100% des appareils, y compris iOS Safari)
    const checkForUpdate = (reg?: ServiceWorkerRegistration | null) => {
      if (!isTargetAccountConnected()) return;

      // A. Forcer le Service Worker à vérifier si un nouveau build existe
      const activeReg = reg || registrationRef.current;
      if (activeReg) {
        activeReg.update().catch(() => {});
      }

      // B. Vérification directe via /version.json (0 boucle périodique, déclenchée sur événement ou action)
      fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isTargetAccountConnected()) return;

          if (data?.buildId && typeof __STUDYCLOUD_BUILD_ID__ !== 'undefined') {
            if (data.buildId !== __STUDYCLOUD_BUILD_ID__) {
              // L'utilisateur n'est pas à jour : afficher immédiatement le message pendant qu'il travaille
              console.log('[StudyCloud Update] Nouvelle version détectée pendant le travail de l\'utilisateur :', data.buildId);
              triggerUpdatePrompt();
            } else {
              // L'utilisateur est déjà à jour : réinitialiser
              localStorage.removeItem('studycloud_update_pending');
              localStorage.removeItem('studycloud_update_postponed');
              setShowUpdate(false);
              setIsCriticalBlocked(false);
            }
          }
        })
        .catch(() => {});
    };

    // Vérification initiale dès l'ouverture si connecté
    if (isTargetAccountConnected()) {
      checkForUpdate();
    }

    let refreshing = false;

    // 4. Écouter le changement de contrôleur pour recharger immédiatement la page
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[StudyCloud Update] Nouveau Service Worker actif, actualisation...');
        localStorage.removeItem('studycloud_update_pending');
        localStorage.removeItem('studycloud_update_postponed');
        window.location.reload();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      navigator.serviceWorker.ready.then((registration) => {
        registrationRef.current = registration;

        // Si l'utilisateur est connecté, forcer une vérification dès que le Service Worker est prêt
        if (isTargetAccountConnected()) {
          registration.update().catch(() => {});
        }

        // Si un worker attendait déjà
        if (registration.waiting && isTargetAccountConnected()) {
          triggerUpdatePrompt();
        }

        // Écouter l'arrivée d'une nouvelle version
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && isTargetAccountConnected()) {
              console.log('[StudyCloud Update] Nouveau worker installé, affichage du message...');
              triggerUpdatePrompt();
            }
          });
        });
      }).catch((err) => {
        console.warn('[StudyCloud Update] Erreur Service Worker:', err);
      });
    }

    // 5. Détection sur changement d'onglet ou retour sur l'écran
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 6. Détection quand la fenêtre reprend le focus
    const handleWindowFocus = () => {
      checkForUpdate();
    };
    window.addEventListener('focus', handleWindowFocus);

    // 7. DÉTECTION PENDANT QUE L'UTILISATEUR EST DÉJÀ EN TRAIN DE TRAVAILLER :
    // Clics, frappes de notes, appuis tactiles, navigation dans l'appli.
    // ZÉRO boucle périodique (aucun setInterval). Déclenché uniquement par le travail réel de l'utilisateur.
    let lastWorkInteraction = 0;
    const handleUserWorking = () => {
      if (!isTargetAccountConnected()) return;
      const now = Date.now();
      // Au maximum une vérification silencieuse toutes les 25 secondes de travail actif
      if (now - lastWorkInteraction < 25000) return;
      lastWorkInteraction = now;
      checkForUpdate();
    };

    window.addEventListener('pointerdown', handleUserWorking, { passive: true });
    window.addEventListener('keydown', handleUserWorking, { passive: true });
    window.addEventListener('touchstart', handleUserWorking, { passive: true });
    window.addEventListener('popstate', handleUserWorking);

    // 8. Détection lors de toute activité de requêtes API (sauvegarde de note, calcul de note, chat IA, sync...)
    const handleActivityCheck = () => {
      checkForUpdate();
    };
    window.addEventListener('studycloud_check_app_version', handleActivityCheck);

    // 9. Filet de sécurité en cas de chunk obsolète suite à un nouveau déploiement
    const handlePreloadError = (e: Event) => {
      e.preventDefault();
      console.warn('[StudyCloud Update] Erreur de chunk détectée (nouvelle version déployée).');
      if (isTargetAccountConnected()) {
        triggerUpdatePrompt();
      }
    };
    window.addEventListener('vite:preloadError', handlePreloadError);

    // 10. SURVEILLANCE ACTIVE : Détecter les actions nécessitant la mise à jour
    const handleCriticalUpdate = (e: any) => {
      console.warn('[StudyCloud Security Lock] Action nécessitant mise à jour:', e.detail);
      if (isTargetAccountConnected()) {
        triggerUpdatePrompt(true, e.detail?.message);
      }
    };
    window.addEventListener('studycloud_critical_update_required', handleCriticalUpdate);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pointerdown', handleUserWorking);
      window.removeEventListener('keydown', handleUserWorking);
      window.removeEventListener('touchstart', handleUserWorking);
      window.removeEventListener('popstate', handleUserWorking);
      window.removeEventListener('studycloud_check_app_version', handleActivityCheck);
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
    localStorage.setItem('studycloud_update_postponed', 'true');
    setShowUpdate(false);
    setIsCriticalBlocked(false);
  };

  if (!showUpdate || !isTargetAccountConnected()) {
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CAS 1 : MODAL DE MISE À JOUR NÉCESSAIRE POUR CONTINUER
  // ───────────────────────────────────────────────────────────────────────────
  if (isCriticalBlocked) {
    return (
      <div
        id="studycloud-critical-update-modal"
        className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-3xl bg-[#141416] border-2 border-orange-500/50 p-6 sm:p-7 max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_35px_rgba(234,88,12,0.3)] text-white text-center">
          {/* Ligne lumineuse supérieure */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

          {/* Icône de flèche de téléchargement */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 mb-4 shadow-lg shadow-orange-950/50">
            <Download className="w-8 h-8 text-orange-500 animate-bounce" />
          </div>

          <h3 className="text-lg font-black text-white tracking-wide">
            Mise à jour nécessaire
          </h3>

          <p className="text-xs text-stone-300 mt-2.5 leading-relaxed">
            {blockedReason || "Une mise à jour est nécessaire pour continuer. Veuillez mettre à jour l'application."}
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
              <span>{isUpdating ? 'Mise à jour en cours...' : 'Mettre à jour'}</span>
            </button>

            <p className="text-[11px] text-stone-400">
              L'actualisation ne prend que 2 secondes.
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
          {/* Bouton / Badge avec flèche de téléchargement orientée vers le bas */}
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            title="Mettre à jour"
            className="relative p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white shadow-lg shadow-orange-500/30 shrink-0 flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-75"
          >
            <Download className={`w-5 h-5 text-white ${isUpdating ? 'animate-pulse' : 'animate-bounce'}`} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </button>

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
