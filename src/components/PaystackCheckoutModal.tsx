import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Loader2,
  Receipt,
  Sparkles,
  AlertCircle,
  Lock,
  ExternalLink,
} from 'lucide-react';
import {
  ClientBillingMode,
  DEFAULT_PAYMENT_GATEWAY_CONFIG,
  formatBillingDurationBadge,
  getPaymentGatewayConfig,
  initializePaystackPayment,
  PaymentGatewayConfig,
  PaymentProductType,
  savePendingPaystackReturnContext,
  shouldShowManualReceiptButton,
} from '../services/paystackBillingApi';

export interface PaystackCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: PaymentProductType;
  productId: string;
  productName: string;
  subtitle?: string;
  appKey?: string;
  priceDisplay: string;
  secondaryPriceDisplay?: string;
  billingCycle?: 'monthly' | 'annual' | 'one_time' | 'infinite';
  billingMode: ClientBillingMode;
  durationDays?: number;
  currency?: string;
  initialConfig?: PaymentGatewayConfig | null;
  onFallbackManual?: () => void;
}

export const PaystackCheckoutModal: React.FC<PaystackCheckoutModalProps> = ({
  isOpen,
  onClose,
  productType,
  productId,
  productName,
  subtitle,
  appKey,
  priceDisplay,
  secondaryPriceDisplay,
  billingCycle = 'monthly',
  billingMode,
  durationDays = 30,
  currency = 'XOF',
  initialConfig,
  onFallbackManual,
}) => {
  const [config, setConfig] = useState<PaymentGatewayConfig>(
    initialConfig || DEFAULT_PAYMENT_GATEWAY_CONFIG
  );
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [preferAutoCard, setPreferAutoCard] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setErrorMsg(null);
    setSubmitting(false);
    setPreferAutoCard(false);
    setLoadingConfig(true);
    getPaymentGatewayConfig(true)
      .then((fresh) => {
        if (alive) setConfig(fresh);
      })
      .finally(() => {
        if (alive) setLoadingConfig(false);
      });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const badge = formatBillingDurationBadge(billingMode, durationDays);
  const showManualButton = shouldShowManualReceiptButton(config, Boolean(onFallbackManual));
  const isPaystackAvailable = config.paystackEnabled && config.mode !== 'unconfigured';

  const handlePayWithPaystack = async () => {
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await initializePaystackPayment({
        productType,
        productId,
        billingCycle: billingMode === 'infinite' ? 'infinite' : billingCycle,
        currency: 'XOF',
        preferAutoCard: billingMode === 'auto' ? preferAutoCard : false,
      });

      if (!res.success || !res.authorizationUrl) {
        setErrorMsg(res.error || "Impossible d'ouvrir la page de paiement Paystack.");
        setSubmitting(false);
        return;
      }

      savePendingPaystackReturnContext({
        productType,
        productId,
        productName,
        appKey,
        createdAt: Date.now(),
      });

      window.location.href = res.authorizationUrl;
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau lors de la connexion à Paystack.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-blue-50/40 dark:from-slate-900 dark:to-sky-950/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold truncate">
                Finaliser votre paiement
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" />
                <span>Paiement sécurisé &amp; activation instantanée</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-4">
          {/* Récapitulatif de l'offre */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {productName}
                </div>
                {subtitle && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {subtitle}
                  </div>
                )}
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                  badge.tone === 'amber'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : badge.tone === 'emerald'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                }`}
              >
                {badge.shortLabel}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Montant officiel
              </span>
              <div className="text-right">
                <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                  {priceDisplay}
                </div>
                {secondaryPriceDisplay && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {secondaryPriceDisplay}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Option de renouvellement si le plan est en mode Automatique */}
          {billingMode === 'auto' && isPaystackAvailable && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Choisissez votre mode de règlement
              </div>
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  !preferAutoCard
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="paystack-channel-pref"
                  checked={!preferAutoCard}
                  onChange={() => setPreferAutoCard(false)}
                  className="mt-1 accent-blue-600"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                    <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Mobile Money &amp; Carte (Recommandé)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Wave, Orange Money, MTN MoMo, Visa &amp; Mastercard — validé immédiatement.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  preferAutoCard
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="paystack-channel-pref"
                  checked={preferAutoCard}
                  onChange={() => setPreferAutoCard(true)}
                  className="mt-1 accent-emerald-600"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Prélèvement automatique par Carte</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Carte Visa / Mastercard uniquement — renouvellement automatique à chaque échéance.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Moyens acceptés (pour mode manuel / infini) */}
          {billingMode !== 'auto' && isPaystackAvailable && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold">
                Wave
              </span>
              <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-300 font-semibold">
                Orange Money
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                MTN MoMo
              </span>
              <span className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold">
                Visa / Mastercard
              </span>
            </div>
          )}

          {/* Mode Test badge */}
          {config.mode === 'test' && isPaystackAvailable && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>
                <strong>Mode Test Paystack</strong> actif : aucun débit réel ne sera effectué.
              </span>
            </div>
          )}

          {/* Message d'erreur */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Bouton principal Paystack */}
          <div className="space-y-2.5 pt-1">
            {isPaystackAvailable ? (
              <button
                type="button"
                disabled={submitting || loadingConfig}
                onClick={handlePayWithPaystack}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Ouverture de Paystack...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Payer maintenant avec Paystack</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 text-center">
                Le paiement en ligne Paystack est actuellement désactivé par l&apos;administrateur.
              </div>
            )}

            {/* Bouton secondaire : Payer manuellement (strictement contrôlé par l'admin dans le Tableau de Bord) */}
            {showManualButton && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  onClose();
                  onFallbackManual?.();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-amber-500" />
                <span>Payer manuellement (envoyer un reçu)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
