import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Smartphone,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Clock,
  Sparkles,
  KeyRound,
  Receipt,
} from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import {
  chargeMobileMoneyWithPaystack,
  ClientBillingMode,
  formatBillingDurationBadge,
  formatCurrencyAmount,
  initializePaystackPayment,
  loadPaystackInlinePop,
  MobileMoneyProvider,
  normalizeClientCiPhone,
  PaymentGatewayConfig,
  PaymentProductType,
  savePendingPaystackReturnContext,
  shouldShowManualReceiptButton,
  submitPaystackMobileOtp,
  verifyPaystackPayment,
  VerifyPaystackResponse,
} from '../services/paystackBillingApi';

export interface StudyCloudPaymentTarget {
  productType: PaymentProductType;
  productId: string;
  productName: string;
  subtitle?: string;
  appKey?: string;
  amountFcfa: number;
  secondaryPriceDisplay?: string;
  billingCycle: 'monthly' | 'annual' | 'one_time' | 'infinite';
  billingMode: ClientBillingMode;
  durationDays: number;
}

interface StudyCloudPaymentViewProps {
  target: StudyCloudPaymentTarget;
  paymentConfig: PaymentGatewayConfig;
  onBack: () => void;
  onSuccess: (res?: VerifyPaystackResponse) => void;
  onFallbackManual?: () => void;
}

type PaymentMethodChoice = 'wave' | 'orange' | 'mtn' | 'card';
type PaymentStep = 'select' | 'otp' | 'waiting' | 'success';

const PROVIDER_META: Record<
  MobileMoneyProvider,
  {
    name: string;
    shortName: string;
    tagline: string;
    accentBg: string;
    accentHover: string;
    ringClass: string;
    badgeBg: string;
    placeholder: string;
  }
> = {
  wave: {
    name: 'Wave',
    shortName: 'Wave',
    tagline: 'Validation rapide dans l’app Wave',
    accentBg: 'bg-sky-500',
    accentHover: 'hover:bg-sky-400',
    ringClass: 'border-sky-500 bg-sky-500/10 dark:bg-sky-500/15 ring-2 ring-sky-500/30',
    badgeBg: 'bg-sky-500 text-white',
    placeholder: '07 00 00 00 00',
  },
  orange: {
    name: 'Orange Money',
    shortName: 'Orange',
    tagline: 'Code OTP ou validation #144#',
    accentBg: 'bg-orange-500',
    accentHover: 'hover:bg-orange-400',
    ringClass: 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/15 ring-2 ring-orange-500/30',
    badgeBg: 'bg-orange-500 text-white',
    placeholder: '07 00 00 00 00',
  },
  mtn: {
    name: 'MTN MoMo',
    shortName: 'MTN',
    tagline: 'Confirmation sur votre téléphone MTN',
    accentBg: 'bg-amber-400 text-slate-950',
    accentHover: 'hover:bg-amber-300',
    ringClass: 'border-amber-400 bg-amber-400/15 dark:bg-amber-400/15 ring-2 ring-amber-400/30',
    badgeBg: 'bg-amber-400 text-slate-950',
    placeholder: '05 00 00 00 00',
  },
};

function readInitialUserPhone(): string {
  try {
    const raw = localStorage.getItem('sc_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.phone) {
        return normalizeClientCiPhone(String(parsed.phone));
      }
    }
  } catch {
    // Ignore
  }
  return '';
}

export const StudyCloudPaymentView: React.FC<StudyCloudPaymentViewProps> = ({
  target,
  paymentConfig,
  onBack,
  onSuccess,
  onFallbackManual,
}) => {
  const [method, setMethod] = useState<PaymentMethodChoice>('wave');
  const [phone, setPhone] = useState<string>(() => readInitialUserPhone());
  const [otpCode, setOtpCode] = useState<string>('');
  const [preferAutoCard, setPreferAutoCard] = useState<boolean>(target.billingMode === 'auto');

  const [step, setStep] = useState<PaymentStep>('select');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPopupFallback, setShowPopupFallback] = useState<boolean>(false);

  const [activeReference, setActiveReference] = useState<string>('');
  const [displayText, setDisplayText] = useState<string>('');
  const [openUrl, setOpenUrl] = useState<string>('');
  const [countdownSec, setCountdownSec] = useState<number>(180);
  const [verifiedResult, setVerifiedResult] = useState<VerifyPaystackResponse | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const triggerPaymentVerifiedEvents = useCallback((res: VerifyPaystackResponse) => {
    try {
      window.dispatchEvent(new CustomEvent('studycloud_refresh_storage_quota'));
      window.dispatchEvent(new CustomEvent('studycloud_payment_verified', { detail: res }));
    } catch {
      // Ignore
    }
  }, []);

  const markPaymentSucceeded = useCallback(
    (res: VerifyPaystackResponse) => {
      clearTimers();
      setVerifiedResult(res);
      setStep('success');
      setSubmitting(false);
      setCheckingStatus(false);
      setErrorMsg(null);
      triggerPaymentVerifiedEvents(res);
    },
    [clearTimers, triggerPaymentVerifiedEvents]
  );

  // Vérification périodique automatique pendant l'étape 'waiting' (pay_offline / open_url)
  const checkTransactionOnce = useCallback(
    async (refToCheck: string, showSpinner = false) => {
      if (!refToCheck) return;
      if (showSpinner) setCheckingStatus(true);
      try {
        const res = await verifyPaystackPayment(refToCheck);
        if (res.success && res.verified) {
          markPaymentSucceeded(res);
          return;
        }
        if (res.status === 'failed' || res.status === 'abandoned') {
          clearTimers();
          setErrorMsg(res.error || 'Le paiement a été annulé ou refusé par l’opérateur.');
          setStep('select');
        } else if (showSpinner) {
          setErrorMsg(
            res.error ||
              'Paiement encore en attente de confirmation sur votre téléphone. Réessayez dans quelques secondes.'
          );
        }
      } catch (err: any) {
        if (showSpinner) {
          setErrorMsg(err?.message || 'Erreur réseau lors de la vérification.');
        }
      } finally {
        if (showSpinner) setCheckingStatus(false);
      }
    },
    [clearTimers, markPaymentSucceeded]
  );

  useEffect(() => {
    if (step !== 'waiting' || !activeReference) {
      clearTimers();
      return;
    }

    setCountdownSec(180);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    pollTimerRef.current = window.setInterval(() => {
      checkTransactionOnce(activeReference, false);
    }, 3500);

    return () => clearTimers();
  }, [step, activeReference, checkTransactionOnce, clearTimers]);

  // Lancer un paiement Mobile Money via Paystack Charge API (100 % dans StudyCloud)
  const handleStartMobileCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || method === 'card') return;

    const cleanPhone = normalizeClientCiPhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg('Veuillez saisir un numéro Mobile Money valide (ex : 07 00 00 00 00).');
      return;
    }

    setErrorMsg(null);
    setShowPopupFallback(false);
    setSubmitting(true);

    try {
      const res = await chargeMobileMoneyWithPaystack({
        productType: target.productType,
        productId: target.productId,
        billingCycle: target.billingCycle,
        provider: method,
        phone: cleanPhone,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Impossible d'initier le paiement Mobile Money.");
        if (res.fallbackSuggested) setShowPopupFallback(true);
        setSubmitting(false);
        return;
      }

      if (res.reference) setActiveReference(res.reference);

      if (res.chargeStatus === 'success' && res.verified) {
        markPaymentSucceeded({
          success: true,
          verified: true,
          deliverySummary: res.deliverySummary,
          transaction: res.transaction,
        });
        return;
      }

      setDisplayText(res.displayText || '');
      setOpenUrl(res.openUrl || '');

      if (res.chargeStatus === 'send_otp') {
        setOtpCode('');
        setStep('otp');
      } else {
        setStep('waiting');
      }
      setSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau lors du lancement du paiement.');
      setShowPopupFallback(true);
      setSubmitting(false);
    }
  };

  // Soumettre le code OTP directement dans notre interface StudyCloud
  const handleSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !activeReference) return;
    if (!otpCode.trim()) {
      setErrorMsg('Veuillez saisir le code OTP reçu.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await submitPaystackMobileOtp(activeReference, otpCode.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'Code OTP invalide. Vérifiez le code et réessayez.');
        setSubmitting(false);
        return;
      }

      if (res.chargeStatus === 'success' && res.verified) {
        markPaymentSucceeded({
          success: true,
          verified: true,
          deliverySummary: res.deliverySummary,
          transaction: res.transaction,
        });
        return;
      }

      setDisplayText(res.displayText || 'Confirmez la transaction sur votre téléphone.');
      setOpenUrl(res.openUrl || '');
      setStep('waiting');
      setSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau lors de la validation OTP.');
      setSubmitting(false);
    }
  };

  // Lancer le module sécurisé Paystack InlineJS V2 (pour Carte Bancaire PCI-DSS ou secours Wave)
  const handleOpenInlinePaystack = async (channelOnly?: 'card' | 'mobile_money') => {
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const initRes = await initializePaystackPayment({
        productType: target.productType,
        productId: target.productId,
        billingCycle: target.billingCycle,
        currency: 'XOF',
        channelOnly,
        preferAutoCard: channelOnly === 'card' && target.billingMode === 'auto' ? preferAutoCard : false,
      });

      if (!initRes.success || !initRes.accessCode) {
        setErrorMsg(initRes.error || "Impossible d'ouvrir le module bancaire sécurisé.");
        setSubmitting(false);
        return;
      }

      const ref = initRes.reference || '';
      setActiveReference(ref);

      savePendingPaystackReturnContext({
        productType: target.productType,
        productId: target.productId,
        productName: target.productName,
        appKey: target.appKey,
        createdAt: Date.now(),
      });

      try {
        const PaystackPop = await loadPaystackInlinePop();
        const popup = new PaystackPop();
        setSubmitting(false);
        popup.resumeTransaction(initRes.accessCode, {
          onSuccess: async (tx: any) => {
            const verifyRef = tx?.reference || ref;
            setCheckingStatus(true);
            const vRes = await verifyPaystackPayment(verifyRef);
            if (vRes.success && vRes.verified) {
              markPaymentSucceeded(vRes);
            } else {
              setCheckingStatus(false);
              setErrorMsg(vRes.error || 'Paiement en cours de confirmation. Cliquez sur vérifier.');
              setStep('waiting');
            }
          },
          onCancel: () => {
            setSubmitting(false);
            setCheckingStatus(false);
          },
        });
      } catch {
        // Fallback propre vers l'URL sécurisée si un bloqueur empêche js.paystack.co
        if (initRes.authorizationUrl) {
          window.setTimeout(() => setSubmitting(false), 2500);
          window.location.href = initRes.authorizationUrl;
        } else {
          setErrorMsg('Impossible de charger le module bancaire. Désactivez votre bloqueur de pub et réessayez.');
          setSubmitting(false);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau lors de la connexion au serveur.');
      setSubmitting(false);
    }
  };

  const badge = formatBillingDurationBadge(target.billingMode, target.durationDays);
  const showManualBtn = shouldShowManualReceiptButton(paymentConfig, Boolean(onFallbackManual));
  const formattedFcfa = formatCurrencyAmount(target.amountFcfa, 'XOF');
  const minutesStr = String(Math.floor(countdownSec / 60)).padStart(2, '0');
  const secondsStr = String(countdownSec % 60).padStart(2, '0');

  return (
    <div className="w-full min-h-full bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 pb-20">
      {/* Barre supérieure StudyCloud */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            clearTimers();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux offres</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <DnaLogo className="w-6 h-6" />
          </div>
          <span className="text-xs sm:text-sm font-black tracking-tight">StudyCloud Pay</span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
            <Lock className="w-3 h-3" />
            <span>Sécurisé</span>
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* ÉCRAN DE SUCCÈS 100 % STUDYCLOUD */}
        {step === 'success' ? (
          <div className="max-w-lg mx-auto rounded-3xl bg-white dark:bg-[#111827] border border-emerald-500/40 shadow-xl p-6 sm:p-8 text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                Paiement confirmé !
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {verifiedResult?.deliverySummary ||
                  'Votre achat a été validé et appliqué immédiatement à votre compte StudyCloud.'}
              </p>
            </div>

            <div className="text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Offre</span>
                <span className="font-bold text-right">{target.productName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Montant payé</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {verifiedResult?.transaction
                    ? formatCurrencyAmount(
                        verifiedResult.transaction.paid_amount ||
                          verifiedResult.transaction.expected_amount,
                        verifiedResult.transaction.currency
                      )
                    : formattedFcfa}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Réseau utilisé</span>
                <span className="font-bold">
                  {verifiedResult?.transaction?.network_label ||
                    (method === 'card' ? 'Carte Bancaire' : PROVIDER_META[method].name)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Référence</span>
                <span className="font-mono text-[11px]">
                  {verifiedResult?.transaction?.reference || activeReference}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSuccess(verifiedResult || undefined)}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg transition cursor-pointer"
            >
              Continuer sur StudyCloud
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* COLONNE GAUCHE : RÉCAPITULATIF OFFICIEL STUDYCLOUD */}
            <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-slate-900 via-[#101c34] to-blue-950 text-white border border-slate-800 p-5 sm:p-6 shadow-xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-sky-300 mb-1">
                    Récapitulatif de commande
                  </div>
                  <h1 className="text-xl font-black tracking-tight">{target.productName}</h1>
                  {target.subtitle && (
                    <p className="text-xs text-slate-300 mt-1">{target.subtitle}</p>
                  )}
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border ${
                    badge.tone === 'amber'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : badge.tone === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                  }`}
                >
                  {badge.shortLabel}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-[11px] text-slate-400 font-semibold">Total à régler</div>
                <div className="text-3xl font-black tracking-tight tabular-nums text-white">
                  {formattedFcfa}
                </div>
                {target.secondaryPriceDisplay && (
                  <div className="text-xs text-slate-400">{target.secondaryPriceDisplay}</div>
                )}
              </div>

              <div className="space-y-2.5 text-xs text-slate-300 pt-1">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Activation automatique immédiate dès confirmation</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Transaction vérifiée côté serveur &amp; protégée contre les doubles débits</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Compatible Wave, Orange Money, MTN MoMo &amp; Visa / Mastercard</span>
                </div>
              </div>

              {paymentConfig.mode === 'test' && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-[11px] text-amber-200 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Mode Test actif</span>
                  </div>
                  <p className="text-amber-100/90 leading-relaxed">
                    Aucun débit réel. Pour tester Orange Money en mode test : numéro{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMethod('orange');
                        setPhone('0700000000');
                      }}
                      className="underline font-mono font-bold text-white cursor-pointer"
                    >
                      0700000000
                    </button>{' '}
                    puis code OTP <code className="font-bold text-white">1234</code> ou{' '}
                    <code className="font-bold text-white">OTP1234</code>.
                  </p>
                </div>
              )}
            </div>

            {/* COLONNE DROITE : INTERFACE 100 % STUDYCLOUD */}
            <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-lg p-5 sm:p-6 space-y-5">
              {/* ÉTAPE 1 : CHOIX DU RÉSEAU + NUMÉRO OU CARTE */}
              {step === 'select' && (
                <>
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-black">
                      Choisissez votre moyen de paiement
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Réglez directement depuis StudyCloud avec votre opérateur préféré.
                    </p>
                  </div>

                  {/* Grille des 4 réseaux */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(['wave', 'orange', 'mtn'] as MobileMoneyProvider[]).map((prov) => {
                      const meta = PROVIDER_META[prov];
                      const active = method === prov;
                      return (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => {
                            setMethod(prov);
                            setErrorMsg(null);
                            setShowPopupFallback(false);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                            active
                              ? meta.ringClass
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${meta.badgeBg}`}
                          >
                            {prov === 'wave' ? 'W' : prov === 'orange' ? 'OM' : 'MTN'}
                          </div>
                          <span className="text-xs font-extrabold text-center leading-tight">
                            {meta.name}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setMethod('card');
                        setErrorMsg(null);
                        setShowPopupFallback(false);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        method === 'card'
                          ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-extrabold text-center leading-tight">
                        Visa / Carte
                      </span>
                    </button>
                  </div>

                  {/* Erreur éventuelle */}
                  {errorMsg && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                      {showPopupFallback && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleOpenInlinePaystack('mobile_money')}
                          className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Continuer via la fenêtre sécurisée Paystack</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Formulaire Mobile Money (Wave / Orange / MTN) */}
                  {method !== 'card' ? (
                    <form onSubmit={handleStartMobileCharge} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Numéro {PROVIDER_META[method].name} (Côte d&apos;Ivoire)
                        </label>
                        <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 overflow-hidden transition">
                          <span className="px-3.5 py-3 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-600 dark:text-slate-300 shrink-0">
                            🇨🇮 +225
                          </span>
                          <input
                            type="tel"
                            inputMode="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder={PROVIDER_META[method].placeholder}
                            className="flex-1 px-3.5 py-3 bg-transparent text-sm font-bold tracking-wide text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {PROVIDER_META[method].tagline}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm shadow-lg transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-65 ${
                          method === 'mtn'
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            : method === 'orange'
                            ? 'bg-orange-500 hover:bg-orange-400 text-white'
                            : 'bg-sky-500 hover:bg-sky-400 text-white'
                        }`}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Connexion à {PROVIDER_META[method].name}...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>
                              Payer {formattedFcfa} avec {PROVIDER_META[method].name}
                            </span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* Volet Carte Bancaire (PCI-DSS via Paystack InlineJS par-dessus StudyCloud) */
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold">Carte Bancaire Internationale</span>
                          <div className="flex items-center gap-1.5 text-[10px] font-black">
                            <span className="px-2 py-0.5 rounded bg-blue-600/15 text-blue-700 dark:text-blue-300">
                              VISA
                            </span>
                            <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300">
                              Mastercard
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Le formulaire sécurisé de carte bancaire s&apos;ouvre directement en fenêtre
                          protégée (norme PCI-DSS) sans quitter StudyCloud.
                        </p>
                      </div>

                      {target.billingMode === 'auto' && (
                        <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferAutoCard}
                            onChange={(e) => setPreferAutoCard(e.target.checked)}
                            className="mt-0.5 accent-emerald-600"
                          />
                          <div className="text-xs">
                            <div className="font-extrabold text-emerald-700 dark:text-emerald-300">
                              Renouvellement automatique activé
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">
                              Votre carte sera prélevée automatiquement à la fin de la période.
                            </div>
                          </div>
                        </label>
                      )}

                      <button
                        type="button"
                        disabled={submitting || checkingStatus}
                        onClick={() => handleOpenInlinePaystack('card')}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-65"
                      >
                        {submitting || checkingStatus ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>
                              {checkingStatus
                                ? 'Validation du paiement...'
                                : 'Ouverture du module carte sécurisé...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>Payer {formattedFcfa} par Carte Bancaire</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Option Payer manuellement uniquement si activée par l'admin */}
                  {showManualBtn && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onFallbackManual?.()}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-500" />
                        <span>Payer manuellement (envoyer un reçu)</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ÉTAPE 2A : CODE OTP MOBILE MONEY (100 % DANS STUDYCLOUD) */}
              {step === 'otp' && (
                <form onSubmit={handleSubmitOtp} className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                      <KeyRound className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="text-base font-black">Entrez votre code de validation</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {displayText || 'Saisissez le code OTP reçu sur votre téléphone.'}
                      </p>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div>
                    <input
                      type="text"
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Ex : 1234 ou OTP1234"
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-xl font-mono font-black tracking-[0.25em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-65"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validation du code...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmer le paiement ({formattedFcfa})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('select');
                      setErrorMsg(null);
                    }}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    ← Modifier le numéro ou changer d&apos;opérateur
                  </button>
                </form>
              )}

              {/* ÉTAPE 2B : ATTENTE VALIDATION TÉLÉPHONE / APP WAVE (AVEC POLLING LIVE) */}
              {step === 'waiting' && (
                <div className="space-y-5 text-center py-2 animate-fadeIn">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center relative">
                    <Smartphone className="w-8 h-8 text-blue-500" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-lg font-black">Confirmez sur votre téléphone</h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                      {displayText ||
                        'Validez la notification ou la demande USSD sur votre téléphone. StudyCloud détectera automatiquement la confirmation.'}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      Vérification automatique en cours • {minutesStr}:{secondsStr}
                    </span>
                  </div>

                  {openUrl && (
                    <div>
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-sm shadow-lg inline-flex items-center justify-center gap-2 transition"
                      >
                        <span>Ouvrir l&apos;application Wave</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={checkingStatus}
                      onClick={() => checkTransactionOnce(activeReference, true)}
                      className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {checkingStatus ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>J&apos;ai validé le paiement</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearTimers();
                        setStep('select');
                        setErrorMsg(null);
                      }}
                      className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Changer de réseau
                    </button>
                  </div>

                  <div className="text-[10.5px] font-mono text-slate-400">
                    Référence : {activeReference}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
