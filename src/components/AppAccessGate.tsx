import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  Gift,
  Lock,
  ShieldCheck,
  Sparkles,
  Clock,
  Loader2,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import {
  AppAccessResponse,
  AppSubscriptionPlanRecord,
  checkAppAccess,
  formatBillingDurationBadge,
  formatCurrencyAmount,
  initializePaystackPayment,
  savePendingPaystackReturnContext,
  shouldShowManualReceiptButton,
  startAppFreeTrial,
} from '../services/paystackBillingApi';
import { SubscriptionFormView, SelectedPlan } from './SubscriptionFormView';

interface AppAccessGateProps {
  appKey: string;
  onBack: () => void;
  fallbackTitle?: string;
  children: React.ReactNode;
}

function getCacheKey(appKey: string): string {
  let uid = 'anon';
  try {
    const raw = localStorage.getItem('sc_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) uid = String(parsed.id);
    }
  } catch {
    // Ignore
  }
  return `studycloud_app_access_v1_${uid}_${appKey}`;
}

function parseFeaturesList(raw: any): string[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  }
  return arr
    .map((item) => (typeof item === 'string' ? item : item?.enabled === false ? '' : String(item?.text || '')))
    .filter(Boolean);
}

export const AppAccessGate: React.FC<AppAccessGateProps> = ({
  appKey,
  onBack,
  fallbackTitle = 'Application StudyCloud',
  children,
}) => {
  const [access, setAccess] = useState<AppAccessResponse | null>(() => {
    try {
      const cached = sessionStorage.getItem(getCacheKey(appKey));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.allowed === 'boolean') return parsed;
      }
    } catch {
      // Ignore
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !access);
  const [error, setError] = useState<string | null>(null);
  const [startingTrial, setStartingTrial] = useState<boolean>(false);
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [manualFallbackPlan, setManualFallbackPlan] = useState<SelectedPlan | null>(null);

  const loadAccess = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await checkAppAccess(appKey);
        setAccess(res);
        try {
          sessionStorage.setItem(getCacheKey(appKey), JSON.stringify(res));
        } catch {
          // Ignore
        }
      } catch (err: any) {
        console.warn('[AppAccessGate] Erreur vérification accès:', err);
        setError(err?.message || "Impossible de vérifier l'accès.");
      } finally {
        setLoading(false);
      }
    },
    [appKey]
  );

  useEffect(() => {
    loadAccess(Boolean(access));
    const onPaymentVerified = () => {
      setPayingPlanId(null);
      loadAccess(true);
    };
    const resetLoading = () => {
      setPayingPlanId(null);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setPayingPlanId(null);
      }
    };
    window.addEventListener('studycloud_payment_verified', onPaymentVerified);
    window.addEventListener('pageshow', resetLoading);
    window.addEventListener('focus', resetLoading);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('studycloud_payment_verified', onPaymentVerified);
      window.removeEventListener('pageshow', resetLoading);
      window.removeEventListener('focus', resetLoading);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadAccess]);

  const handleStartTrial = async () => {
    if (startingTrial) return;
    setStartingTrial(true);
    setError(null);
    try {
      const res = await startAppFreeTrial(appKey);
      setAccess((prev) => ({
        ...(prev || ({} as AppAccessResponse)),
        ...res,
        plans: prev?.plans || [],
        paymentConfig: prev?.paymentConfig || res.paymentConfig,
      }));
      await loadAccess(true);
    } catch (err: any) {
      setError(err?.message || "Impossible de démarrer l'essai gratuit.");
    } finally {
      setStartingTrial(false);
    }
  };

  const handleDirectPaystackForApp = async (plan: AppSubscriptionPlanRecord) => {
    if (payingPlanId) return;
    setError(null);
    setPayingPlanId(plan.id);
    try {
      const res = await initializePaystackPayment({
        productType: 'app',
        productId: plan.id,
        billingCycle: plan.billing_mode === 'infinite' ? 'infinite' : 'monthly',
        currency: 'XOF',
        preferAutoCard: false,
      });

      if (!res.success || !res.authorizationUrl) {
        setError(res.error || "Impossible d'ouvrir la page de paiement Paystack.");
        setPayingPlanId(null);
        return;
      }

      savePendingPaystackReturnContext({
        productType: 'app',
        productId: plan.id,
        productName: `${access?.app?.name || fallbackTitle} — ${plan.name}`,
        appKey,
        createdAt: Date.now(),
      });

      window.setTimeout(() => {
        setPayingPlanId(null);
      }, 3000);
      window.location.href = res.authorizationUrl;
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau lors de la connexion à Paystack.');
      setPayingPlanId(null);
    }
  };

  const openManualReceiptForPlan = (plan: AppSubscriptionPlanRecord) => {
    setManualFallbackPlan({
      name: `${access?.app?.name || fallbackTitle} — ${plan.name}`,
      type: 'storage',
      storageDisplay: `Accès ${access?.app?.name || fallbackTitle}`,
      priceDisplay: formatCurrencyAmount(plan.price, plan.primary_currency),
      price: plan.price,
      priceFcfa: plan.price,
      currency: plan.primary_currency === 'XOF' ? 'FCFA' : plan.primary_currency,
      billingCycle: plan.billing_mode === 'infinite' ? 'one_time' : 'monthly',
    });
  };

  // Si un utilisateur a choisi le bouton « Payer manuellement » sur la carte (visible uniquement quand l'admin l'autorise)
  if (manualFallbackPlan) {
    return (
      <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 pb-20">
        <SubscriptionFormView
          plan={manualFallbackPlan}
          onBack={() => setManualFallbackPlan(null)}
          onSuccess={() => {
            setManualFallbackPlan(null);
            loadAccess(false);
          }}
        />
      </div>
    );
  }

  // Chargement initial sans cache
  if (loading && !access) {
    return (
      <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#0b0f19] text-slate-600 dark:text-slate-300">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-xs font-semibold">Vérification de votre accès...</span>
      </div>
    );
  }

  // Si erreur réseau sans réponse serveur
  if (!access && error) {
    return (
      <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50 dark:bg-[#0b0f19]">
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">{error}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold cursor-pointer"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={() => loadAccess(false)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réessayer</span>
          </button>
        </div>
      </div>
    );
  }

  // ACCÈS AUTORISÉ : rendre l'application directement (+ bandeau discret si période de grâce ou fin d'essai)
  if (access?.allowed) {
    const showGraceNotice =
      access.isPaidApp &&
      (access.status === 'grace' ||
        (access.status === 'trial' && access.daysRemaining !== null && access.daysRemaining <= 2));

    return (
      <div className="w-full h-full flex flex-col min-h-0">
        {showGraceNotice && (
          <div className="shrink-0 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-semibold">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {access.status === 'grace'
                  ? `Votre accès à ${access.app?.name || fallbackTitle} est en période de grâce. Renouvelez pour continuer sans coupure.`
                  : `Votre essai gratuit expire dans ${access.daysRemaining} jour(s).`}
              </span>
            </div>
            {access.plans && access.plans.length > 0 && (
              <button
                type="button"
                disabled={Boolean(payingPlanId)}
                onClick={() => handleDirectPaystackForApp(access.plans[0])}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                {payingPlanId ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>Renouveler maintenant</span>
              </button>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 w-full">{children}</div>
      </div>
    );
  }

  // PAYWALL : L'application est payante et l'utilisateur n'a pas encore d'accès actif
  const appMeta = access?.app;
  const plans = Array.isArray(access?.plans) ? access!.plans : [];
  const isPaystackAvailable =
    Boolean(access?.paymentConfig?.paystackEnabled) &&
    access?.paymentConfig?.mode !== 'unconfigured';
  const showManualUnderneath = shouldShowManualReceiptButton(access?.paymentConfig, true);

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 p-4 sm:p-6 pb-24">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Barre supérieure */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Activation instantanée après paiement</span>
          </span>
        </div>

        {/* En-tête de l'application */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-[#101c34] to-blue-950 text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>Accès Premium</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                <span className="text-3xl">{appMeta?.icon || '📱'}</span>
                <span>{appMeta?.name || fallbackTitle}</span>
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {appMeta?.description ||
                  "Débloquez l'accès complet à cette application StudyCloud avec toutes ses fonctionnalités avancées."}
              </p>
              {access?.status === 'expired' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Votre précédent accès est arrivé à expiration.</span>
                </div>
              )}
            </div>

            {/* Bouton Essai Gratuit si configuré par l'admin */}
            {access?.canStartTrial && (appMeta?.trial_days || 0) > 0 && (
              <button
                type="button"
                disabled={startingTrial}
                onClick={handleStartTrial}
                className="shrink-0 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {startingTrial ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4" />
                )}
                <span>Essai gratuit ({appMeta?.trial_days} jours)</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
            {error}
          </div>
        )}

        {/* Cartes de prix créées dans le Tableau de Bord (Paiement direct + bouton Payer manuellement en bas si activé) */}
        {plans.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-base font-extrabold">Aucune offre active configurée</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              L&apos;administrateur n&apos;a pas encore publié de carte d&apos;abonnement pour cette application.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {plans.map((plan) => {
              const isHighlighted = Boolean(plan.badge && plan.badge.trim());
              const badge = formatBillingDurationBadge(
                plan.billing_mode,
                plan.duration_days,
                plan.is_auto_billing
              );
              const features = parseFeaturesList(plan.features);
              const isThisCardLoading = payingPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
                    isHighlighted
                      ? 'bg-gradient-to-b from-slate-900 to-[#0f172a] dark:from-[#162036] dark:to-[#0f172a] border border-blue-500/40 text-white shadow-xl ring-1 ring-blue-500/20'
                      : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-extrabold tracking-tight">{plan.name}</h3>
                        {plan.description && (
                          <p
                            className={`text-xs mt-1 ${
                              isHighlighted ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {plan.description}
                          </p>
                        )}
                      </div>
                      {isHighlighted && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-200 border border-blue-400/30 shrink-0">
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-3xl font-black tabular-nums">
                        {formatCurrencyAmount(plan.price, plan.primary_currency)}
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          badge.tone === 'amber'
                            ? 'bg-amber-500/15 text-amber-500 dark:text-amber-300 border-amber-500/30'
                            : badge.tone === 'emerald'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {features.length > 0 && (
                      <ul className="space-y-2 pt-3 border-t border-slate-200/20 dark:border-slate-800">
                        {features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                isHighlighted
                                  ? 'bg-blue-500/25 text-blue-300'
                                  : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                              }`}
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                            <span className={isHighlighted ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}>
                              {feat}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Bouton principal Paystack direct + bouton secondaire « Payer manuellement » juste en dessous */}
                  <div className="mt-6 space-y-2">
                    {isPaystackAvailable ? (
                      <button
                        type="button"
                        disabled={Boolean(payingPlanId)}
                        onClick={() => handleDirectPaystackForApp(plan)}
                        className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-65 ${
                          isHighlighted
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40'
                            : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                        }`}
                      >
                        {isThisCardLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Redirection vers le paiement...</span>
                          </>
                        ) : (
                          <span>
                            {plan.billing_mode === 'auto' ? "S'abonner maintenant" : "Débloquer l'accès"}
                          </span>
                        )}
                      </button>
                    ) : showManualUnderneath ? (
                      <button
                        type="button"
                        onClick={() => openManualReceiptForPlan(plan)}
                        className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                          isHighlighted
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40'
                            : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                        }`}
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Payer manuellement (reçu)</span>
                      </button>
                    ) : (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold text-center">
                        Paiement temporairement indisponible
                      </div>
                    )}

                    {isPaystackAvailable && showManualUnderneath && (
                      <button
                        type="button"
                        disabled={Boolean(payingPlanId)}
                        onClick={() => openManualReceiptForPlan(plan)}
                        className={`w-full py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 border disabled:opacity-50 ${
                          isHighlighted
                            ? 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/15'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Payer manuellement (envoyer un reçu)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
