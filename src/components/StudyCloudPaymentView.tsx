import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Clock,
  Smartphone,
  KeyRound,
  ChevronDown,
  Search,
} from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { PaymentSuccessCelebration } from './PaymentSuccessCelebration';
import { getLegalPortalUrl } from '../services/api';
import {
  chargeMobileMoneyWithPaystack,
  ClientBillingMode,
  formatCurrencyAmount,
  initializePaystackPayment,
  loadPaystackInlinePop,
  MobileMoneyProvider,
  PaymentGatewayConfig,
  PaymentProductType,
  savePendingPaystackReturnContext,
  submitPaystackMobileOtp,
  verifyPaystackPayment,
  VerifyPaystackResponse,
} from '../services/paystackBillingApi';
import {
  COUNTRIES_PHONE_LIST,
  CountryPhoneRule,
  DEFAULT_COUNTRY_RULE,
  detectCountryAndNational,
  formatNationalPhoneInput,
  getCountryFlagUrl,
  validateCountryPhone,
} from '../utils/countryPhoneRules';

export interface StudyCloudPaymentTarget {
  productType: PaymentProductType;
  productId: string;
  productName: string;
  subtitle?: string;
  description?: string;
  features?: string[];
  periodLabel?: string;
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
type PaymentStep = 'select' | 'confirm' | 'otp' | 'waiting' | 'success';

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethodChoice;
  label: string;
  logo: string;
  logoFit: string;
  placeholder?: string;
}> = [
  {
    id: 'wave',
    label: 'Wave',
    logo: '/payment-logos/wave.jpg',
    logoFit: 'object-cover',
    placeholder: '07 00 00 00 00',
  },
  {
    id: 'orange',
    label: 'Orange Money',
    logo: '/payment-logos/orange-money.png',
    logoFit: 'object-contain p-1',
    placeholder: '07 00 00 00 00',
  },
  {
    id: 'mtn',
    label: 'MTN MoMo',
    logo: '/payment-logos/mtn.jpg',
    logoFit: 'object-cover',
    placeholder: '05 00 00 00 00',
  },
  {
    id: 'card',
    label: 'Visa / Mastercard',
    logo: '/payment-logos/visa-mastercard.png',
    logoFit: 'object-contain p-1.5',
  },
];

function getMethodLabel(method: PaymentMethodChoice): string {
  const found = PAYMENT_OPTIONS.find((m) => m.id === method);
  return found ? found.label : 'Wave';
}

function readInitialUserPhoneAndCountry(): { country: CountryPhoneRule; formattedPhone: string } {
  try {
    const raw = localStorage.getItem('sc_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.phone) {
        const det = detectCountryAndNational(String(parsed.phone));
        return {
          country: det.country,
          formattedPhone: formatNationalPhoneInput(det.nationalDigits, det.country),
        };
      }
    }
  } catch {
    // Ignore
  }
  return { country: DEFAULT_COUNTRY_RULE, formattedPhone: '' };
}

export const StudyCloudPaymentView: React.FC<StudyCloudPaymentViewProps> = ({
  target,
  onBack,
  onSuccess,
}) => {
  const initialPhoneState = useMemo(() => readInitialUserPhoneAndCountry(), []);
  const [method, setMethod] = useState<PaymentMethodChoice>('wave');
  const [selectedCountry, setSelectedCountry] = useState<CountryPhoneRule>(initialPhoneState.country);
  const [phone, setPhone] = useState<string>(initialPhoneState.formattedPhone);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState<boolean>(false);
  const [countrySearch, setCountrySearch] = useState<string>('');
  const countryPickerRef = useRef<HTMLDivElement | null>(null);
  const [otpCode, setOtpCode] = useState<string>('');
  const [preferAutoCard, setPreferAutoCard] = useState<boolean>(target.billingMode === 'auto');

  // Fermer le menu déroulant pays en cliquant dehors ou avec Échap
  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handleOutsideClick = (ev: MouseEvent) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(ev.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setCountryDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [countryDropdownOpen]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRIES_PHONE_LIST;
    return COUNTRIES_PHONE_LIST.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [countrySearch]);

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
          setErrorMsg(res.error || 'Paiement annulé ou refusé.');
          setStep('select');
        } else if (showSpinner) {
          setErrorMsg(res.error || 'Paiement en attente de confirmation sur votre téléphone.');
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

  // Étape 1 -> Étape 2 (écran récapitulatif « Confirmez votre paiement » avant de lancer le débit)
  const handleProceedToConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setShowPopupFallback(false);

    if (method !== 'card') {
      const validation = validateCountryPhone(phone, selectedCountry);
      if (!validation.valid) {
        setErrorMsg(validation.error || `Numéro ${selectedCountry.name} invalide.`);
        return;
      }
    }

    setStep('confirm');
  };

  // Étape 2 -> Exécution réelle du paiement après clic sur « Confirmer et payer »
  const handleExecuteConfirmedPayment = async () => {
    if (submitting) return;
    if (method === 'card') {
      await handleOpenInlinePaystack('card');
      return;
    }

    const validation = validateCountryPhone(phone, selectedCountry);
    if (!validation.valid) {
      setErrorMsg(validation.error || `Numéro ${selectedCountry.name} invalide.`);
      setStep('select');
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
        provider: method as MobileMoneyProvider,
        phone: validation.paystackPhone,
        countryIso: selectedCountry.iso,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Impossible d'initier le paiement.");
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
      setErrorMsg(err?.message || 'Erreur réseau.');
      setShowPopupFallback(true);
      setSubmitting(false);
    }
  };

  const handleSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !activeReference) return;
    if (!otpCode.trim()) {
      setErrorMsg('Veuillez saisir le code reçu.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await submitPaystackMobileOtp(activeReference, otpCode.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'Code invalide ou expiré.');
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
      setErrorMsg(err?.message || 'Erreur réseau.');
      setSubmitting(false);
    }
  };

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
        setErrorMsg(initRes.error || 'Impossible de lancer le paiement.');
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
              setErrorMsg(vRes.error || 'Confirmation en cours.');
              setStep('waiting');
            }
          },
          onCancel: () => {
            setSubmitting(false);
            setCheckingStatus(false);
          },
        });
      } catch {
        if (initRes.authorizationUrl) {
          window.setTimeout(() => setSubmitting(false), 2500);
          window.location.href = initRes.authorizationUrl;
        } else {
          setErrorMsg('Impossible de charger la fenêtre de paiement.');
          setSubmitting(false);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau.');
      setSubmitting(false);
    }
  };

  const formattedFcfa = formatCurrencyAmount(target.amountFcfa, 'XOF');
  const minutesStr = String(Math.floor(countdownSec / 60)).padStart(2, '0');
  const secondsStr = String(countdownSec % 60).padStart(2, '0');

  // Liste complète des bénéfices réels de la carte sélectionnée
  const benefitItems: string[] = [];
  if (target.subtitle && target.subtitle.trim()) {
    benefitItems.push(target.subtitle.trim());
  }
  if (Array.isArray(target.features)) {
    for (const f of target.features) {
      const clean = String(f || '').trim();
      if (clean && !benefitItems.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
        benefitItems.push(clean);
      }
    }
  }

  const selectedOption = PAYMENT_OPTIONS.find((o) => o.id === method) || PAYMENT_OPTIONS[0];

  // ÉCRAN PLEINE PAGE DE CÉLÉBRATION QUAND LE PAIEMENT EST CONFIRMÉ
  if (step === 'success') {
    return (
      <PaymentSuccessCelebration
        productName={target.productName}
        productType={target.productType}
        amount={
          verifiedResult?.transaction
            ? verifiedResult.transaction.paid_amount || verifiedResult.transaction.expected_amount
            : target.amountFcfa
        }
        currency={verifiedResult?.transaction?.currency || 'XOF'}
        reference={verifiedResult?.transaction?.reference || activeReference}
        networkLabel={verifiedResult?.transaction?.network_label || getMethodLabel(method)}
        deliverySummary={verifiedResult?.deliverySummary}
        onContinue={() => onSuccess(verifiedResult || undefined)}
      />
    );
  }

  return (
    <div className="w-full min-h-full grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-[#FFF1E5] via-[#FFE6D0] to-[#FFD6B5] dark:from-[#16110E] dark:via-[#1B1410] dark:to-[#211711] text-stone-900 dark:text-stone-100">
      {/* ===================================================================== */}
      {/* COLONNE GAUCHE : PRIX & BÉNÉFICES DU FORFAIT (DANS LE FOND)           */}
      {/* ===================================================================== */}
      <div className="flex flex-col justify-between px-6 sm:px-10 lg:px-14 xl:px-16 py-7 sm:py-10 lg:border-r lg:border-orange-400/30 dark:lg:border-orange-500/20">
        <div className="space-y-8">
          {/* Barre Retour + Marque officielle StudyCloud / DKD TECHNOLOGIES (sans cadre noir) */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                clearTimers();
                onBack();
              }}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-stone-700 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white transition cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-white/75 dark:bg-white/10 border border-orange-300/60 dark:border-orange-500/20 flex items-center justify-center shadow-xs">
                <ArrowLeft className="w-4 h-4" />
              </span>
              <span>Retour</span>
            </button>

            <div className="notranslate flex items-center gap-2.5" translate="no">
              <DnaLogo
                className="w-9 h-9 shrink-0 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                glow={true}
              />
              <div className="flex flex-col justify-center">
                <span className="font-black tracking-tight text-[24px] leading-tight flex items-center select-none">
                  <span className="font-black text-orange-500">Study</span>
                  <span className="font-black text-sky-400 dark:text-blue-400">Cloud</span>
                </span>
                <span
                  className="text-[10.5px] font-black uppercase tracking-widest mt-0.5"
                  style={{ letterSpacing: '0.14em', color: '#f59e0b' }}
                >
                  DKD TECHNOLOGIES
                </span>
              </div>
            </div>
          </div>

          {/* En-tête de la carte : Nom & description */}
          <div className="space-y-3 pt-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-stone-950 dark:text-white leading-tight">
              {target.productName}
            </h1>

            {target.description && (
              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed max-w-md">
                {target.description}
              </p>
            )}
          </div>

          {/* Prix officiel */}
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums text-stone-950 dark:text-white">
                {formattedFcfa}
              </span>
              {target.periodLabel && (
                <span className="text-base sm:text-lg font-semibold text-stone-600 dark:text-stone-400">
                  {target.periodLabel}
                </span>
              )}
            </div>
            {target.secondaryPriceDisplay && (
              <div className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400">
                {target.secondaryPriceDisplay}
              </div>
            )}
          </div>

          {/* Séparateur horizontal doux */}
          <div className="h-px w-full bg-orange-400/30 dark:bg-orange-500/20" />

          {/* Liste des bénéfices réels de la carte */}
          {benefitItems.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-orange-900/75 dark:text-orange-300/80">
                Ce qui est inclus
              </h2>
              <ul className="space-y-3.5">
                {benefitItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span
                      className={`text-sm leading-snug ${
                        idx === 0
                          ? 'font-extrabold text-stone-950 dark:text-white'
                          : 'font-medium text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pied discret */}
        <div className="pt-8 mt-8 border-t border-orange-400/20 dark:border-orange-500/15 flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-400">
          <span>Total à payer</span>
          <span className="text-base font-black text-stone-950 dark:text-white tabular-nums">
            {formattedFcfa}
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* COLONNE DROITE : MOYENS DE PAIEMENT (PLEINE SURFACE, ZÉRO BLEU)       */}
      {/* ===================================================================== */}
      <div className="flex flex-col justify-center px-6 sm:px-10 lg:px-14 xl:px-16 py-8 sm:py-12 bg-white/75 dark:bg-[#120E0B]/85 backdrop-blur-sm">
        <div className="w-full max-w-lg mx-auto space-y-7">
          {step === 'select' ? (
            /* ÉTAPE 1 : CHOIX DU MOYEN DE PAIEMENT */
            <>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-stone-950 dark:text-white">
                Moyen de paiement
              </h2>

              {/* 4 Moyens de paiement avec les vrais logos officiels */}
              <div className="grid grid-cols-2 gap-3.5">
                {PAYMENT_OPTIONS.map((opt) => {
                  const isActive = method === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setMethod(opt.id);
                        setErrorMsg(null);
                        setShowPopupFallback(false);
                      }}
                      className={`relative p-3.5 rounded-2xl border-2 bg-white dark:bg-[#1B1511] transition-all cursor-pointer flex items-center gap-3.5 text-left ${
                        isActive
                          ? 'border-orange-500 shadow-md shadow-orange-500/15 ring-4 ring-orange-500/10'
                          : 'border-orange-200/70 dark:border-stone-800 hover:border-orange-300 dark:hover:border-orange-500/40'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-stone-200/80 shrink-0 flex items-center justify-center">
                        <img
                          src={opt.logo}
                          alt={opt.label}
                          className={`w-full h-full ${opt.logoFit}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-stone-900 dark:text-white truncate">
                          {opt.label}
                        </div>
                      </div>
                      {isActive && (
                        <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Erreur éventuelle */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                  {showPopupFallback && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleOpenInlinePaystack('mobile_money')}
                      className="w-full py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Continuer le paiement</span>
                    </button>
                  )}
                </div>
              )}

              {/* Formulaire selon le moyen sélectionné */}
              {method !== 'card' ? (
                <form onSubmit={handleProceedToConfirm} className="space-y-5">
                  <div className="space-y-2" ref={countryPickerRef}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                        Numéro {selectedOption.label}
                      </label>
                      <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                        {selectedCountry.minDigits === selectedCountry.maxDigits
                          ? `${selectedCountry.maxDigits} chiffres`
                          : `${selectedCountry.minDigits}-${selectedCountry.maxDigits} chiffres`}
                      </span>
                    </div>

                    <div className="relative">
                      <div className="flex items-center rounded-2xl border-2 border-orange-200/80 dark:border-stone-700 bg-white dark:bg-[#1B1511] focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/15 transition">
                        {/* Bouton sélecteur de pays avec drapeau réel + indicatif */}
                        <button
                          type="button"
                          onClick={() => {
                            setCountryDropdownOpen((prev) => !prev);
                            setCountrySearch('');
                          }}
                          className="flex items-center gap-2 px-3.5 py-3.5 bg-orange-50/90 hover:bg-orange-100/90 dark:bg-stone-900 dark:hover:bg-stone-800 border-r border-orange-200/70 dark:border-stone-800 rounded-l-[14px] text-sm font-extrabold text-stone-800 dark:text-stone-100 shrink-0 transition cursor-pointer"
                          title={`Changer de pays (${selectedCountry.name})`}
                        >
                          <img
                            src={getCountryFlagUrl(selectedCountry.iso)}
                            alt={selectedCountry.iso}
                            className="w-6 h-4 rounded-[3px] object-cover shadow-xs border border-stone-300/60 shrink-0"
                            onError={(ev) => {
                              (ev.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <span className="tabular-nums">{selectedCountry.dialCode}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-stone-500 transition-transform ${
                              countryDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        <input
                          type="tel"
                          inputMode="tel"
                          required
                          value={phone}
                          onChange={(e) => {
                            const formatted = formatNationalPhoneInput(
                              e.target.value,
                              selectedCountry
                            );
                            setPhone(formatted);
                            if (errorMsg) setErrorMsg(null);
                          }}
                          placeholder={selectedCountry.placeholder}
                          className="flex-1 min-w-0 px-4 py-3.5 bg-transparent text-base font-bold tracking-wide text-stone-950 dark:text-white outline-none"
                        />
                      </div>

                      {/* Liste déroulante de tous les pays avec drapeaux et recherche */}
                      {countryDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-[#1B1511] border-2 border-orange-200 dark:border-stone-700 shadow-2xl overflow-hidden animate-fadeIn">
                          <div className="p-2.5 border-b border-orange-100 dark:border-stone-800 bg-orange-50/50 dark:bg-stone-900/60">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#120E0B] border border-orange-200/80 dark:border-stone-700 focus-within:border-orange-500">
                              <Search className="w-4 h-4 text-stone-400 shrink-0" />
                              <input
                                type="text"
                                autoFocus
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Rechercher un pays ou indicatif (+221, France...)"
                                className="flex-1 bg-transparent text-xs font-semibold text-stone-900 dark:text-white outline-none"
                              />
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto divide-y divide-orange-100/60 dark:divide-stone-800/70">
                            {filteredCountries.length === 0 ? (
                              <div className="p-4 text-center text-xs text-stone-500">
                                Aucun pays trouvé.
                              </div>
                            ) : (
                              filteredCountries.map((c) => {
                                const isSel = c.iso === selectedCountry.iso;
                                return (
                                  <button
                                    key={c.iso}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      setPhone((prev) => formatNationalPhoneInput(prev, c));
                                      setCountryDropdownOpen(false);
                                      setErrorMsg(null);
                                    }}
                                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                                      isSel
                                        ? 'bg-orange-500/15 text-orange-950 dark:text-orange-200'
                                        : 'hover:bg-orange-50/80 dark:hover:bg-stone-800/80 text-stone-800 dark:text-stone-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <img
                                        src={getCountryFlagUrl(c.iso)}
                                        alt={c.iso}
                                        loading="lazy"
                                        className="w-6 h-4 rounded-[3px] object-cover border border-stone-300/60 shrink-0"
                                      />
                                      <span className="text-xs sm:text-sm font-bold truncate">
                                        {c.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs font-mono font-extrabold text-stone-500 dark:text-stone-400">
                                        {c.dialCode}
                                      </span>
                                      {isSel && (
                                        <Check className="w-4 h-4 text-orange-500 stroke-[3]" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#FF7A2F] to-[#EA580C] hover:from-[#F97316] hover:to-[#DC4B08] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-65"
                  >
                    <span>Payer {formattedFcfa}</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-white dark:bg-[#1B1511] border border-orange-200/70 dark:border-stone-800 p-4 flex items-center justify-center">
                    <img
                      src="/payment-logos/visa-mastercard.png"
                      alt="Visa et Mastercard"
                      className="h-14 w-auto object-contain"
                    />
                  </div>

                  {target.billingMode === 'auto' && (
                    <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/25 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferAutoCard}
                        onChange={(e) => setPreferAutoCard(e.target.checked)}
                        className="w-4 h-4 accent-orange-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        Renouvellement automatique à l&apos;échéance
                      </span>
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={submitting || checkingStatus}
                    onClick={() => handleProceedToConfirm()}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#FF7A2F] to-[#EA580C] hover:from-[#F97316] hover:to-[#DC4B08] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-65"
                  >
                    <span>Payer {formattedFcfa}</span>
                  </button>
                </div>
              )}
            </>
          ) : step === 'confirm' ? (
            /* ÉTAPE INTERMÉDIAIRE : RÉCAPITULATIF & CONFIRMATION AVANT DÉBIT + CONDITIONS D'UTILISATION */
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl overflow-hidden bg-white border-2 border-orange-200 dark:border-stone-700 shadow-sm flex items-center justify-center">
                  <img
                    src={selectedOption.logo}
                    alt={selectedOption.label}
                    className={`w-full h-full ${selectedOption.logoFit}`}
                  />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-950 dark:text-white">
                  Confirmez votre paiement
                </h2>
                {target.subtitle && (
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                    {target.subtitle}
                  </p>
                )}
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                  {showPopupFallback && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleOpenInlinePaystack('mobile_money')}
                      className="w-full py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Continuer le paiement</span>
                    </button>
                  )}
                </div>
              )}

              <div className="divide-y divide-orange-200/70 dark:divide-stone-800 border-y border-orange-200/70 dark:border-stone-800 text-sm">
                <div className="py-3.5 flex items-center justify-between gap-3">
                  <span className="text-stone-500 dark:text-stone-400">Forfait</span>
                  <span className="font-extrabold text-stone-950 dark:text-white text-right">
                    {target.productName}
                  </span>
                </div>
                <div className="py-3.5 flex items-center justify-between gap-3">
                  <span className="text-stone-500 dark:text-stone-400">Montant</span>
                  <span className="font-black text-orange-600 dark:text-orange-400 tabular-nums">
                    {formattedFcfa}
                  </span>
                </div>
                <div className="py-3.5 flex items-center justify-between gap-3">
                  <span className="text-stone-500 dark:text-stone-400">Moyen</span>
                  <span className="font-bold text-stone-900 dark:text-white">
                    {selectedOption.label}
                  </span>
                </div>
                {method !== 'card' && (
                  <div className="py-3.5 flex items-center justify-between gap-3">
                    <span className="text-stone-500 dark:text-stone-400">Numéro</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                      <img
                        src={getCountryFlagUrl(selectedCountry.iso)}
                        alt={selectedCountry.iso}
                        className="w-5 h-3.5 rounded-[2px] object-cover border border-stone-300/60"
                      />
                      <span>
                        {selectedCountry.dialCode} {phone}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={submitting || checkingStatus}
                  onClick={handleExecuteConfirmedPayment}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#FF7A2F] to-[#EA580C] hover:from-[#F97316] hover:to-[#DC4B08] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-65"
                >
                  {submitting || checkingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Traitement en cours...</span>
                    </>
                  ) : (
                    <span>Confirmer et payer {formattedFcfa}</span>
                  )}
                </button>

                <p className="text-center text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  En continuant, vous acceptez nos{' '}
                  <a
                    href={getLegalPortalUrl('cgu')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-orange-600 dark:text-orange-400 underline underline-offset-2 hover:text-orange-700 dark:hover:text-orange-300"
                  >
                    Conditions d&apos;utilisation
                  </a>
                  .
                </p>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setErrorMsg(null);
                    setShowPopupFallback(false);
                    setStep('select');
                  }}
                  className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
                >
                  ← Modifier le moyen de paiement
                </button>
              </div>
            </div>
          ) : step === 'otp' ? (
            /* ÉTAPE OTP */
            <form onSubmit={handleSubmitOtp} className="space-y-5 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-400/30 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black">Confirmez votre paiement</h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {displayText || 'Entrez le code reçu sur votre téléphone.'}
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <input
                type="text"
                autoFocus
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Code OTP"
                className="w-full px-4 py-4 rounded-2xl bg-white dark:bg-[#1B1511] border-2 border-orange-200 dark:border-stone-700 text-center text-2xl font-mono font-black tracking-[0.25em] outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FF7A2F] to-[#EA580C] hover:from-[#F97316] hover:to-[#DC4B08] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-65"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vérification...</span>
                  </>
                ) : (
                  <span>Confirmer ({formattedFcfa})</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('select');
                  setErrorMsg(null);
                }}
                className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              >
                ← Changer de moyen de paiement
              </button>
            </form>
          ) : (
            /* ÉTAPE ATTENTE VALIDATION TÉLÉPHONE / APP WAVE */
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/15 border border-orange-400/35 flex items-center justify-center relative">
                <Smartphone className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-orange-500 animate-ping" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black">Confirmez votre paiement sur votre téléphone</h2>
                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {displayText || 'Validez la demande sur votre téléphone pour finaliser.'}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100/90 dark:bg-stone-800 text-xs font-mono font-bold text-orange-900 dark:text-orange-300">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span>
                  {minutesStr}:{secondsStr}
                </span>
              </div>

              {openUrl && (
                <div>
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#FF7A2F] to-[#EA580C] hover:from-[#F97316] hover:to-[#DC4B08] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 inline-flex items-center justify-center gap-2 transition"
                  >
                    <span>Ouvrir Wave</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={checkingStatus}
                  onClick={() => checkTransactionOnce(activeReference, true)}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-orange-500 dark:hover:bg-orange-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {checkingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>J&apos;ai terminé</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearTimers();
                    setStep('select');
                    setErrorMsg(null);
                  }}
                  className="px-5 py-3.5 rounded-2xl bg-orange-100/80 hover:bg-orange-200/80 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold cursor-pointer"
                >
                  Changer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
