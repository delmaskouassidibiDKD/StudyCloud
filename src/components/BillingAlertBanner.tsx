import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Lock, X } from 'lucide-react';
import { BillingStatusBannerResponse, getMyBillingStatusBanner } from '../services/paystackBillingApi';

interface BillingAlertBannerProps {
  isAuthenticated: boolean;
  onOpenSubscriptions: () => void;
}

export const BillingAlertBanner: React.FC<BillingAlertBannerProps> = ({
  isAuthenticated,
  onOpenSubscriptions,
}) => {
  const [banner, setBanner] = useState<BillingStatusBannerResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setBanner(null);
      return;
    }
    const res = await getMyBillingStatusBanner();
    setBanner(res);
    if (res && (res.blockedSubscriptions.length > 0 || res.graceSubscriptions.length > 0)) {
      setDismissed(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
    const onSubEvent = () => refresh();
    window.addEventListener('studycloud_payment_verified', onSubEvent);
    window.addEventListener('studycloud_subscription_updated', onSubEvent);
    return () => {
      window.removeEventListener('studycloud_payment_verified', onSubEvent);
      window.removeEventListener('studycloud_subscription_updated', onSubEvent);
    };
  }, [refresh]);

  if (!isAuthenticated || dismissed || !banner) return null;

  const hasBlocked = banner.blockedSubscriptions.length > 0;
  const hasGrace = banner.graceSubscriptions.length > 0;
  if (!hasBlocked && !hasGrace) return null;

  const primaryItem = hasBlocked ? banner.blockedSubscriptions[0] : banner.graceSubscriptions[0];

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9500] w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl border shadow-2xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md animate-fadeIn ${
        hasBlocked
          ? 'bg-rose-950/92 border-rose-500/60 text-white'
          : 'bg-amber-950/92 border-amber-500/60 text-amber-50'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {hasBlocked ? (
          <Lock className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        )}
        <div className="text-xs leading-snug min-w-0">
          <div className="font-black truncate">
            {hasBlocked
              ? banner.fullAccountBlocked
                ? 'Compte suspendu suite à un impayé'
                : `Service suspendu : ${primaryItem.appName || primaryItem.planName}`
              : `Abonnement en période de grâce : ${primaryItem.appName || primaryItem.planName}`}
          </div>
          <div className="text-[11px] opacity-85 truncate">
            {hasBlocked
              ? 'Régularisez votre abonnement pour rétablir immédiatement votre accès.'
              : 'Renouvelez avant la fin du délai de grâce pour éviter toute coupure.'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenSubscriptions}
          className="px-3 py-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-[11px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Régulariser</span>
        </button>
        {!banner.fullAccountBlocked && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Fermer l'alerte"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
