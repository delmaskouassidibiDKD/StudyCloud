import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, AlertTriangle, X, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { getUserStorageQuota, UserStorageQuotaDetails } from '../services/api';

export const StorageAlertNotificationModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [quotaData, setQuotaData] = useState<UserStorageQuotaDetails | null>(null);
  const [activeThreshold, setActiveThreshold] = useState<number>(0);
  const [isBlockingUpload, setIsBlockingUpload] = useState<boolean>(false);
  const [blockingMessage, setBlockingMessage] = useState<string>('');

  // Vérifier si l'utilisateur est connecté
  const isUserConnected = (): boolean => {
    if (typeof localStorage === 'undefined') return false;
    const token = localStorage.getItem('sc_auth_token') || localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token');
    const uid = localStorage.getItem('unifolder_user_id') || localStorage.getItem('studycloud_user_id');
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

  const evaluateThreshold = useCallback((data: UserStorageQuotaDetails) => {
    if (!isUserConnected()) return;

    const pct = data.totalPercentage || 0;
    
    // Cas seuil >= 96% : S'affiche À CHAQUE RECHARGEMENT DE L'ÉCRAN
    if (pct >= 96) {
      setActiveThreshold(pct);
      setIsBlockingUpload(false);
      setIsOpen(true);
      return;
    }

    // Cas seuils 50%, 75%, 85%, 95% : S'affiche UNE SEULE FOIS par seuil atteint
    let matchedTier = 0;
    if (pct >= 95) matchedTier = 95;
    else if (pct >= 85) matchedTier = 85;
    else if (pct >= 75) matchedTier = 75;
    else if (pct >= 50) matchedTier = 50;

    if (matchedTier > 0) {
      const storedLastTier = Number(localStorage.getItem('studycloud_last_storage_alert_tier') || 0);
      // Ne s'affiche que s'il a progressé vers un nouveau seuil supérieur
      if (matchedTier > storedLastTier) {
        setActiveThreshold(matchedTier);
        setIsBlockingUpload(false);
        setIsOpen(true);
      }
    }
  }, []);

  const checkStorageQuota = useCallback(async () => {
    if (!isUserConnected()) return;
    try {
      const uid = localStorage.getItem('unifolder_user_id') || localStorage.getItem('studycloud_user_id') || undefined;
      const res = await getUserStorageQuota(uid);
      if (res && res.success && res.data) {
        setQuotaData(res.data);
        evaluateThreshold(res.data);
      }
    } catch (err) {
      console.warn('[StorageAlertModal] Erreur chargement quota:', err);
    }
  }, [evaluateThreshold]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Vérification au chargement initial de l'écran
    const timer = setTimeout(() => {
      checkStorageQuota();
    }, 1200);

    // 2. Écouter les événements d'upload ou de rafraîchissement quota
    const handleRefresh = () => {
      checkStorageQuota();
    };

    // 3. Écouter les blocages stricts d'importation (quota dépassé)
    const handleStorageExceeded = (e: any) => {
      const detail = e.detail || {};
      const msg = detail.message || "Votre espace de stockage est insuffisant pour enregistrer ce fichier. Le document a été détruit pour préserver votre compte.";
      setBlockingMessage(msg);
      setIsBlockingUpload(true);
      setActiveThreshold(100);
      setIsOpen(true);
    };

    window.addEventListener('studycloud_refresh_storage_quota', handleRefresh);
    window.addEventListener('studycloud_storage_limit_exceeded', handleStorageExceeded);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('studycloud_refresh_storage_quota', handleRefresh);
      window.removeEventListener('studycloud_storage_limit_exceeded', handleStorageExceeded);
    };
  }, [checkStorageQuota]);

  const handleDismiss = () => {
    if (!isBlockingUpload && activeThreshold < 96) {
      // Pour les seuils 50%, 75%, 85%, 95% : enregistrer qu'on a averti l'utilisateur
      localStorage.setItem('studycloud_last_storage_alert_tier', String(activeThreshold));
    }
    // Pour >= 96%, on ferme la fenêtre pour la session courante, mais elle réapparaîtra au rechargement
    setIsOpen(false);
    setIsBlockingUpload(false);
  };

  const handleUpgrade = () => {
    if (!isBlockingUpload && activeThreshold < 96) {
      localStorage.setItem('studycloud_last_storage_alert_tier', String(activeThreshold));
    }
    setIsOpen(false);
    setIsBlockingUpload(false);

    // Ouvrir directement l'onglet des abonnements de stockage
    window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
  };

  if (!isOpen || !isUserConnected()) {
    return null;
  }

  const pct = isBlockingUpload ? 100 : (quotaData?.totalPercentage ?? activeThreshold);
  const usedText = quotaData?.totalUsedFormatted || `${pct}% utilisé`;
  const allowedText = quotaData?.totalAllowedFormatted || 'Quota plein';

  const isCritical = pct >= 95 || isBlockingUpload;
  const isExtreme = pct >= 96 || isBlockingUpload;

  return (
    <div
      id="studycloud-storage-alert-modal"
      className="fixed inset-0 z-[999998] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-3xl bg-[#141416] border-2 border-orange-500/50 p-6 sm:p-7 max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_35px_rgba(234,88,12,0.3)] text-white text-center">
        {/* Ligne lumineuse supérieure */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
          isExtreme 
            ? 'from-rose-600 via-red-600 to-amber-500' 
            : 'from-amber-500 via-orange-500 to-rose-500'
        }`} />

        {/* Bouton croix en haut à droite */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 p-2 text-stone-400 hover:text-white hover:bg-stone-800/60 rounded-full transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icône de stockage / alerte */}
        <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
          isExtreme
            ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 shadow-rose-950/50'
            : 'bg-orange-500/20 border border-orange-500/40 text-orange-400 shadow-orange-950/50'
        }`}>
          {isBlockingUpload ? (
            <ShieldAlert className="w-8 h-8 text-rose-500 animate-bounce" />
          ) : isCritical ? (
            <AlertTriangle className="w-8 h-8 text-rose-500 animate-pulse" />
          ) : (
            <HardDrive className="w-8 h-8 text-orange-400" />
          )}
        </div>

        {/* Titre */}
        <h3 className="text-lg font-black text-white tracking-wide">
          {isBlockingUpload
            ? "Espace de stockage insuffisant"
            : pct >= 100
              ? "Stockage 100% plein (Saturé)"
              : pct >= 96
                ? `Stockage presque plein (${pct}%)`
                : `Alerte Stockage : ${pct}% atteint`}
        </h3>

        {/* Description */}
        <p className="text-xs text-stone-300 mt-2.5 leading-relaxed">
          {isBlockingUpload ? (
            blockingMessage || "Votre espace de stockage est insuffisant pour enregistrer ce fichier. Le document a été détruit pour préserver l'intégrité de vos données."
          ) : pct >= 96 ? (
            <>
              Votre espace de stockage a atteint <strong>{pct}%</strong> de sa capacité. Tout nouvel import sera automatiquement bloqué dès saturation.
            </>
          ) : (
            <>
              Vous avez utilisé <strong>{pct}%</strong> de votre espace StudyCloud disponible ({usedText} sur {allowedText}).
            </>
          )}
        </p>

        {/* Barre de jauge de saturation */}
        <div className="mt-4 p-3 rounded-2xl bg-stone-900/90 border border-stone-800 text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-stone-400">Consommation globale</span>
            <span className={isCritical ? 'text-rose-400 font-mono' : 'text-orange-400 font-mono'}>
              {pct}% ({usedText} / {allowedText})
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-stone-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExtreme
                  ? 'bg-gradient-to-r from-orange-500 to-rose-600'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
            />
          </div>
        </div>

        {/* 3 boutons d'action : [Augmenter], [Plus tard], et croix [✕] */}
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            id="btn-upgrade-storage-alert"
            onClick={handleUpgrade}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-orange-950/60 transition-all cursor-pointer"
          >
            <span>Augmenter mon stockage</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="btn-dismiss-storage-alert"
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
};
