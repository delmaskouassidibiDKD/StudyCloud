import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, CreditCard, HardDrive, Lock, X } from 'lucide-react';
import {
  BillingStatusBannerResponse,
  formatCurrencyAmount,
  getMyBillingStatusBanner,
} from '../services/paystackBillingApi';

interface BillingAlertBannerProps {
  isAuthenticated: boolean;
  onOpenSubscriptions: (targetSection?: 'all' | 'downgrades') => void;
}

function fmtStorageMbBanner(mb: number): string {
  const n = Math.max(0, Number(mb || 0));
  if (n <= 0) return 'Gratuit';
  if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 2).replace('.', ',')} Go`;
  return `${Math.round(n)} Mo`;
}

function fmtBytesBanner(bytes: number): string {
  const b = Math.max(0, Number(bytes || 0));
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} Go`;
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
    if (
      res &&
      (res.blockedSubscriptions.length > 0 ||
        res.graceSubscriptions.length > 0 ||
        (res.pendingDowngrades && res.pendingDowngrades.length > 0) ||
        (res.dataPurgeWarnings && res.dataPurgeWarnings.length > 0))
    ) {
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
  const hasPurgeWarning = Boolean(banner.dataPurgeWarnings && banner.dataPurgeWarnings.length > 0);
  const hasPendingDowngrade = Boolean(banner.pendingDowngrades && banner.pendingDowngrades.length > 0);
  const hasGrace = banner.graceSubscriptions.length > 0;

  if (!hasBlocked && !hasPurgeWarning && !hasPendingDowngrade && !hasGrace) return null;

  // Priorité 1 : Blocage impayé
  if (hasBlocked) {
    const primaryItem = banner.blockedSubscriptions[0];
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9500] w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl border shadow-2xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md animate-fadeIn bg-rose-950/92 border-rose-500/60 text-white">
        <div className="flex items-start gap-2.5 min-w-0">
          <Lock className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
          <div className="text-xs leading-snug min-w-0">
            <div className="font-black truncate">
              {banner.fullAccountBlocked
                ? 'Compte suspendu suite à un impayé'
                : `Service suspendu : ${primaryItem.appName || primaryItem.planName}`}
            </div>
            <div className="text-[11px] opacity-85 truncate">
              Régularisez votre abonnement pour rétablir immédiatement votre accès.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenSubscriptions('all')}
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
  }

  // Priorité 2 : Délai de récupération des données payantes après annulation
  if (hasPurgeWarning && banner.dataPurgeWarnings) {
    const warn = banner.dataPurgeWarnings[0];
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9500] w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl border shadow-2xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md animate-fadeIn bg-orange-950/94 border-orange-500/60 text-orange-50">
        <div className="flex items-start gap-2.5 min-w-0">
          <HardDrive className="w-4 h-4 text-orange-300 shrink-0 mt-0.5" />
          <div className="text-xs leading-snug min-w-0">
            <div className="font-black truncate">
              ⚠️ Abonnement annulé — {warn.daysRemaining} jour{warn.daysRemaining > 1 ? 's' : ''} pour récupérer {fmtBytesBanner(warn.excessBytes)}
            </div>
            <div className="text-[11px] opacity-90 truncate">
              Vos fichiers dans l&apos;espace gratuit restent protégés ; seuls ceux sur l&apos;espace payant seront supprimés après ce délai.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenSubscriptions('all')}
            className="px-3 py-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-[11px] font-black cursor-pointer whitespace-nowrap"
          >
            Détails
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Fermer l'alerte"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Priorité 3 : Réduction de stockage prête (Carte Maîtresse Admin)
  if (hasPendingDowngrade && banner.pendingDowngrades) {
    const dg = banner.pendingDowngrades[0];
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9500] w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl border shadow-2xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md animate-fadeIn bg-emerald-950/94 border-emerald-400/60 text-emerald-50">
        <div className="flex items-start gap-2.5 min-w-0">
          <ArrowDownCircle className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <div className="text-xs leading-snug min-w-0">
            <div className="font-black truncate">
              📉 Réduction de stockage prête : {fmtStorageMbBanner(dg.currentPaidMb)} → {fmtStorageMbBanner(dg.targetPaidMb)} ({formatCurrencyAmount(dg.targetMonthlyPrice, dg.currency)}/mois)
            </div>
            <div className="text-[11px] opacity-90 truncate">
              Réglez votre consommation prorata ({formatCurrencyAmount(dg.consumedProrataAmount, dg.currency)}) pour changer d&apos;abonnement automatiquement.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenSubscriptions('downgrades')}
            className="px-3 py-1.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-[11px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Voir &amp; Payer</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Fermer l'alerte"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Priorité 4 : Période de grâce
  const primaryGrace = banner.graceSubscriptions[0];
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9500] w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl border shadow-2xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md animate-fadeIn bg-amber-950/92 border-amber-500/60 text-amber-50">
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        <div className="text-xs leading-snug min-w-0">
          <div className="font-black truncate">
            Abonnement en période de grâce : {primaryGrace.appName || primaryGrace.planName}
          </div>
          <div className="text-[11px] opacity-85 truncate">
            Renouvelez avant la fin du délai de grâce pour éviter toute coupure.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onOpenSubscriptions('all')}
          className="px-3 py-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-[11px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Régulariser</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Fermer l'alerte"
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
