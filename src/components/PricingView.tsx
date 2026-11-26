import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  HardDrive,
  Bot,
  Receipt,
  AppWindow,
  Menu,
  X,
  RefreshCw,
  Sparkles,
  Loader2,
  Clock,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { SubscriptionFormView, SelectedPlan } from './SubscriptionFormView';
import { StudyCloudPaymentView, StudyCloudPaymentTarget } from './StudyCloudPaymentView';
import { StorageMasterCard } from './StorageMasterCard';
import { getSubscriptionPlans, SubscriptionPlan } from '../services/api';
import {
  AppAccessResponse,
  AppSubscriptionPlanRecord,
  checkAppAccess,
  DEFAULT_PAYMENT_GATEWAY_CONFIG,
  getMonetizedApps,
  getPaymentGatewayConfig,
  getStorageMasterCardStatus,
  MonetizedAppRecord,
  normalizeClientBillingMode,
  PaymentGatewayConfig,
  shouldShowManualReceiptButton,
  startAppFreeTrial,
  StorageMasterStatusResponse,
} from '../services/paystackBillingApi';

type MonetizedAppWithPlans = MonetizedAppRecord & { plans: AppSubscriptionPlanRecord[] };

interface PricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
  initialTab?: 'storage' | 'ai' | 'apps';
  initialAppKey?: string;
  isEmbeddedInSettings?: boolean;
}

const DEFAULT_STORAGE_PLANS: SubscriptionPlan[] = [];
const DEFAULT_AI_PLANS: SubscriptionPlan[] = [];

function parsePlanFeatures(raw: any): { text: string; enabled: boolean }[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
}

function parsePlanCurrencies(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return ['USD', 'XOF', 'EUR'];
}

function getCurrencySymbol(curr: string): string {
  if (curr === 'USD') return '$';
  if (curr === 'EUR') return '€';
  if (curr === 'XOF') return 'FCFA';
  return curr;
}

function calculateConversions(price: number, primaryCurr: string) {
  let usd = price;
  let xof = price * 650;
  let eur = price * 0.92;
  if (primaryCurr === 'USD') {
    usd = price;
    xof = Math.round(price * 650);
    eur = Math.round(price * 0.92 * 100) / 100;
  } else if (primaryCurr === 'XOF') {
    xof = price;
    usd = Math.round((price / 650) * 100) / 100;
    eur = Math.round((price / 655.957) * 100) / 100;
  } else if (primaryCurr === 'EUR') {
    eur = price;
    usd = Math.round((price / 0.92) * 100) / 100;
    xof = Math.round(price * 655.957);
  }
  return { USD: usd, XOF: xof, EUR: eur };
}

function getCardPricingAndConversions(plan: {
  price?: number;
  primary_currency?: string;
  currencies_enabled?: string | string[];
  currency_conversions?: string | Record<string, number>;
  pricing_model?: string;
}) {
  const isOneTime = plan.pricing_model === 'one_time' || plan.pricing_model === 'pack';
  const primaryCurr = plan.primary_currency || 'USD';
  const activePrice = Number(plan.price) || 0;

  let convObj: Record<string, number> = {};
  if (typeof plan.currency_conversions === 'string') {
    try {
      convObj = JSON.parse(plan.currency_conversions);
    } catch (e) {}
  } else if (typeof plan.currency_conversions === 'object' && plan.currency_conversions !== null) {
    convObj = plan.currency_conversions as Record<string, number>;
  }

  const enabledCurrs = parsePlanCurrencies(plan.currencies_enabled);
  const secondaryParts: { curr: string; finalVal: number; formatted: string }[] = [];

  for (const curr of ['XOF', 'USD', 'EUR']) {
    if (enabledCurrs.includes(curr) && curr !== primaryCurr) {
      let rawVal = convObj[curr];
      if (!rawVal) {
        const fallback = calculateConversions(activePrice, primaryCurr);
        rawVal = fallback[curr as keyof typeof fallback];
      }
      const finalVal = rawVal;

      let suffix = '';
      if (curr === 'XOF') suffix = 'FCFA';
      else if (curr === 'USD') suffix = '$';
      else if (curr === 'EUR') suffix = '€';

      const formatted = curr === 'XOF' ? `${finalVal.toLocaleString('fr-FR')} ${suffix}` : `${finalVal} ${suffix}`;

      secondaryParts.push({
        curr,
        finalVal,
        formatted,
      });
    }
  }

  let finalPriceFcfa: number;
  if (primaryCurr === 'XOF') {
    finalPriceFcfa = activePrice;
  } else {
    finalPriceFcfa = convObj.XOF || Math.round(activePrice * 650);
  }

  return {
    activePrice,
    primaryCurr,
    secondaryParts,
    secondaryString: secondaryParts.map(s => `= ${s.formatted}`).join(' • '),
    priceFcfa: finalPriceFcfa,
    isOneTime,
  };
}

export const PricingView: React.FC<PricingViewProps> = ({ 
  onBack, 
  onSelectPlan, 
  initialTab = 'storage',
  initialAppKey,
  isEmbeddedInSettings = false 
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'ai' | 'apps'>(
    initialTab === 'ai' ? 'ai' : initialTab === 'apps' ? 'apps' : 'storage'
  );

  useEffect(() => {
    if (initialTab === 'storage' || initialTab === 'ai' || initialTab === 'apps') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [dbStoragePlans, setDbStoragePlans] = useState<SubscriptionPlan[]>([]);
  const [dbAiPlans, setDbAiPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
  const [masterStorageStatus, setMasterStorageStatus] = useState<StorageMasterStatusResponse | null>(null);

  const refreshMasterStorageStatus = useCallback(async () => {
    const status = await getStorageMasterCardStatus();
    if (status) {
      setMasterStorageStatus(status);
    }
  }, []);

  // Catalogue dynamique des applications monétisées (créées dans le tableau de bord)
  const [monetizedApps, setMonetizedApps] = useState<MonetizedAppWithPlans[]>([]);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [selectedAppKey, setSelectedAppKey] = useState<string>(initialAppKey || '');
  const [isMobileAppsSidebarOpen, setIsMobileAppsSidebarOpen] = useState<boolean>(false);
  const [selectedAppAccess, setSelectedAppAccess] = useState<AppAccessResponse | null>(null);
  const [startingTrial, setStartingTrial] = useState<boolean>(false);
  const [trialFeedback, setTrialFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (initialAppKey) {
      setSelectedAppKey(initialAppKey);
    }
  }, [initialAppKey]);

  const loadMonetizedAppsCatalog = useCallback(async () => {
    setLoadingApps(true);
    try {
      const apps = await getMonetizedApps();
      setMonetizedApps(apps);
      setSelectedAppKey((prev) => {
        if (prev && apps.some((a) => a.app_key === prev)) return prev;
        if (initialAppKey && apps.some((a) => a.app_key === initialAppKey)) return initialAppKey;
        return apps[0]?.app_key || '';
      });
    } catch (err) {
      console.warn('[PricingView] Erreur chargement catalogue applications:', err);
    } finally {
      setLoadingApps(false);
    }
  }, [initialAppKey]);

  // Charger le catalogue des applications quand on ouvre l'onglet Applications
  useEffect(() => {
    if (activeTab === 'apps') {
      loadMonetizedAppsCatalog();
    }
  }, [activeTab, loadMonetizedAppsCatalog]);

  // Vérifier l'état d'accès / essai gratuit de l'application sélectionnée
  useEffect(() => {
    if (activeTab !== 'apps' || !selectedAppKey) {
      setSelectedAppAccess(null);
      return;
    }
    let mounted = true;
    setTrialFeedback(null);
    checkAppAccess(selectedAppKey)
      .then((res) => {
        if (mounted) setSelectedAppAccess(res);
      })
      .catch(() => {
        if (mounted) setSelectedAppAccess(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, selectedAppKey]);

  const handleStartSelectedAppTrial = async (appKey: string) => {
    if (startingTrial) return;
    setStartingTrial(true);
    setTrialFeedback(null);
    try {
      const res = await startAppFreeTrial(appKey);
      setSelectedAppAccess(res);
      setTrialFeedback({ type: 'ok', text: 'Essai activé avec succès !' });
    } catch (err: any) {
      setTrialFeedback({ type: 'err', text: err?.message || "Impossible d'activer l'essai." });
    } finally {
      setStartingTrial(false);
    }
  };

  // État du plan sélectionné pour afficher le menu de souscription (reçu manuel)
  const [selectedPlanForSubscription, setSelectedPlanForSubscription] = useState<SelectedPlan | null>(null);

  // Configuration passerelle Paystack + Bouton « Payer manuellement » pilotés par l'admin
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewayConfig>(DEFAULT_PAYMENT_GATEWAY_CONFIG);
  const [activeCustomPayment, setActiveCustomPayment] = useState<{
    target: StudyCloudPaymentTarget;
    manualPlan: SelectedPlan;
  } | null>(null);

  // Charger dynamiquement les cartes de forfaits depuis Cloudflare D1 avec horodatage anti-cache
  useEffect(() => {
    let isMounted = true;
    setLoadingPlans(true);

    getPaymentGatewayConfig(true)
      .then((cfg) => {
        if (isMounted) setPaymentConfig(cfg);
      })
      .catch(() => {});

    if (activeTab === 'apps') {
      // Pour l'onglet Applications, charger uniquement la config passerelle (les apps sont chargées par loadMonetizedAppsCatalog)
      setLoadingPlans(false);
      return () => {
        isMounted = false;
      };
    }

    if (activeTab === 'storage') {
      getStorageMasterCardStatus()
        .then((st) => {
          if (isMounted && st) setMasterStorageStatus(st);
        })
        .catch(() => {});
    }

    getSubscriptionPlans()
      .then((res) => {
        if (isMounted && res && res.success) {
          const sPlans = Array.isArray(res.storagePlans) ? res.storagePlans : [];
          const aPlans = Array.isArray(res.aiPlans) ? res.aiPlans : [];
          setDbStoragePlans(sPlans);
          setDbAiPlans(aPlans);
        }
      })
      .catch((err) => {
        console.warn('[PricingView] Erreur chargement forfaits D1:', err);
      })
      .finally(() => {
        if (isMounted) {
          setTimeout(() => {
            if (isMounted) setLoadingPlans(false);
          }, 300);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Resynchronisation instantanée de la Carte Maîtresse après tout paiement ou mise à jour d'abonnement
  useEffect(() => {
    const onSubUpdated = () => {
      refreshMasterStorageStatus();
    };
    window.addEventListener('studycloud_payment_verified', onSubUpdated);
    window.addEventListener('studycloud_subscription_updated', onSubUpdated);
    return () => {
      window.removeEventListener('studycloud_payment_verified', onSubUpdated);
      window.removeEventListener('studycloud_subscription_updated', onSubUpdated);
    };
  }, [refreshMasterStorageStatus]);

  // Écran de paiement 100 % sur mesure StudyCloud (Option 3 : Wave / Orange / MTN Charge API + Carte sécurisée)
  if (activeCustomPayment) {
    return (
      <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-50 w-full md:w-[calc(100%-16rem)] overflow-y-auto animate-fadeIn`}>
        <StudyCloudPaymentView
          target={activeCustomPayment.target}
          paymentConfig={paymentConfig}
          onBack={() => setActiveCustomPayment(null)}
          onSuccess={() => {
            const name = activeCustomPayment.target.productName;
            const wasApp = activeCustomPayment.target.productType === 'app';
            const wasStorage = activeCustomPayment.target.productType === 'storage';
            setActiveCustomPayment(null);
            if (wasApp && selectedAppKey) {
              checkAppAccess(selectedAppKey)
                .then((res) => setSelectedAppAccess(res))
                .catch(() => {});
            }
            if (wasStorage) {
              refreshMasterStorageStatus();
            }
            onSelectPlan(name);
          }}
          onFallbackManual={() => {
            const manual = activeCustomPayment.manualPlan;
            setActiveCustomPayment(null);
            setSelectedPlanForSubscription(manual);
          }}
        />
      </div>
    );
  }

  // Si l'utilisateur clique sur "Payer manuellement (envoyer un reçu)", on affiche le formulaire de reçu manuel
  if (selectedPlanForSubscription) {
    return (
      <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-50 w-full md:w-[calc(100%-16rem)] h-full bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300`}>
        <SubscriptionFormView
          plan={selectedPlanForSubscription}
          onBack={() => setSelectedPlanForSubscription(null)}
          onSuccess={() => onSelectPlan(selectedPlanForSubscription.name)}
        />
      </div>
    );
  }

  // Animation de chargement avec cartes squelettes modernes
  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-1 sm:px-2">
      {[1, 2, 3].map((i) => {
        const isMiddle = i === 2;
        return (
          <div
            key={i}
            className={`rounded-2xl p-5 sm:p-7 flex flex-col justify-between relative max-w-[380px] w-full mx-auto shadow-sm animate-pulse min-h-[480px] ${
              isMiddle
                ? 'bg-slate-900 dark:bg-[#162036] border border-slate-800 dark:border-blue-500/30'
                : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={`h-7 w-28 rounded-lg ${isMiddle ? 'bg-slate-700' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                {isMiddle && <div className="h-5 w-20 rounded-full bg-blue-500/30"></div>}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className={`h-3.5 w-4/5 rounded ${isMiddle ? 'bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/80'}`}></div>
                <div className={`h-3.5 w-3/5 rounded ${isMiddle ? 'bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/60'}`}></div>
              </div>

              {/* Prix squelette */}
              <div className="space-y-2 pt-2">
                <div className={`h-10 w-36 rounded-lg ${isMiddle ? 'bg-slate-700' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                <div className={`h-3 w-44 rounded ${isMiddle ? 'bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/70'}`}></div>
              </div>

              <div className={`h-px w-full my-4 ${isMiddle ? 'bg-slate-800' : 'bg-slate-200 dark:bg-slate-800'}`}></div>

              {/* Lignes d'avantages squelettes */}
              <div className="space-y-3 pt-1">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full shrink-0 ${isMiddle ? 'bg-blue-500/40' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                    <div className={`h-3 rounded ${isMiddle ? 'bg-slate-800' : 'bg-slate-100 dark:bg-slate-800'}`} style={{ width: `${55 + (j * 7)}%` }}></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bouton squelette */}
            <div className={`h-10 w-full rounded-xl mt-6 ${isMiddle ? 'bg-blue-600/40' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
          </div>
        );
      })}
    </div>
  );

  // Rendu des cartes avec un design moderne, sobre et professionnel
  const renderCard = (plan: SubscriptionPlan, type: 'storage' | 'ai') => {
    const isOneTime = plan.pricing_model === 'one_time' || plan.pricing_model === 'pack';
    const isPopular = !!(plan.badge && plan.badge.trim());
    const pricing = getCardPricingAndConversions(plan);

    // Première ligne verrouillée (stockage ou IA)
    const lockedPerkText = type === 'ai'
      ? (plan.credits_or_words || (isOneTime 
          ? `${(plan.credits_count || 100000).toLocaleString('fr-FR')} crédits IA`
          : `${(plan.credits_count || 100000).toLocaleString('fr-FR')} crédits IA / mois`))
      : (plan.storage_amount || (plan.storage_mb ? `${plan.storage_mb / 1024} Go` : '10 Go'));

    // Autres avantages filtrés
    const allFeatures = parsePlanFeatures(plan.features);
    const activeFeatures = allFeatures.filter(f => {
      if (f.enabled === false) return false;
      const t = (f.text || '').toLowerCase().trim();
      const lockedLower = lockedPerkText.toLowerCase().trim();
      if (t === lockedLower) return false;
      if (type === 'ai' && (t.includes('mots ia') || t.includes('mots générés') || t.includes('crédits ia') || t.includes('crédits générés'))) return false;
      return true;
    });

    const billingMode = normalizeClientBillingMode(plan.billing_mode, plan.is_auto_billing, plan.pricing_model);
    const isInfinite = billingMode === 'infinite';
    const isAuto = billingMode === 'auto';
    const durationDays = isInfinite ? 0 : Math.max(1, Number(plan.duration_days || 30));

    return (
      <div 
        key={plan.id}
        className={`rounded-2xl p-5 sm:p-7 flex flex-col justify-between relative max-w-[380px] w-full mx-auto transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in zoom-in-95 duration-200 ${
          isPopular
            ? 'bg-gradient-to-b from-slate-900 to-[#0f172a] dark:from-[#162036] dark:to-[#0f172a] border border-slate-800 dark:border-blue-500/40 text-white shadow-lg ring-1 ring-blue-500/20'
            : 'bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div>
          {/* En-tête : Titre & Badge POPULAIRE */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className={`text-lg sm:text-xl font-extrabold tracking-tight uppercase ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {plan.name}
            </h3>
            {isPopular && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {plan.badge}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-xs sm:text-sm mb-4 sm:mb-5 leading-relaxed ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {plan.description}
            </p>
          )}

          {/* Bloc Prix Principal & Conversions secondaires */}
          <div className="mb-4 sm:mb-5">
            <div className={`flex items-baseline flex-wrap gap-x-2 gap-y-1 ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              {!isOneTime && !isInfinite && (
                <span className={`text-sm sm:text-base font-medium ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {durationDays === 30 ? '/mois' : `/ ${durationDays}j`}
                </span>
              )}
            </div>

            {/* Conversions secondaires en dessous (= 6 500 FCFA • = 9.2 €) */}
            {pricing.secondaryParts && pricing.secondaryParts.length > 0 && (
              <div className={`text-xs font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${isPopular ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {pricing.secondaryParts.map((sec, idx) => (
                  <span key={sec.curr} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="opacity-40">•</span>}
                    <span>= {sec.formatted}</span>
                  </span>
                ))}
              </div>
            )}

            {isOneTime && (
              <div className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md ${isPopular ? 'bg-blue-500/15 text-blue-200 border border-blue-400/30' : 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40'}`}>
                <span>⚡ Paiement unique • Crédits sans expiration</span>
              </div>
            )}
          </div>

          {/* Ligne de séparation */}
          <div className={`h-px w-full mb-4 sm:mb-5 ${isPopular ? 'bg-slate-800' : 'bg-slate-200/80 dark:bg-slate-800'}`}></div>

          {/* Avantages inclus */}
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
            Ce qui est inclus
          </p>

          <ul className="space-y-2.5 mb-6">
            {/* Première ligne verrouillée et mise en valeur */}
            <li className="flex items-start gap-2.5">
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                isPopular ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400'
              }`}>
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
              </div>
              <span className={`text-xs sm:text-sm font-bold ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {lockedPerkText}
              </span>
            </li>

            {/* Autres avantages de la formule */}
            {activeFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isPopular ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
                </div>
                <span className={`text-xs sm:text-sm ${isPopular ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Boutons d'action directement sur la carte : Interface StudyCloud Pay + Payer manuellement en dessous (si activé par l'admin) */}
        {(() => {
          const formattedPrimary = `${getCurrencySymbol(pricing.primaryCurr)} ${
            pricing.primaryCurr === 'XOF'
              ? pricing.activePrice.toLocaleString('fr-FR')
              : pricing.activePrice
          }`;
          const manualPlanObj: SelectedPlan = {
            name: `${plan.name} ${type === 'ai' ? 'IA' : 'Stockage'}`,
            type: type,
            storageDisplay: lockedPerkText,
            priceDisplay:
              isOneTime || isInfinite
                ? `${formattedPrimary} ${pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''}`
                : `${formattedPrimary} / ${durationDays === 30 ? 'mois' : `${durationDays} jours`} ${
                    pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''
                  }`,
            price: pricing.activePrice,
            priceFcfa: pricing.priceFcfa,
            currency: getCurrencySymbol(pricing.primaryCurr),
            billingCycle: isOneTime || isInfinite ? 'one_time' : 'monthly',
            mb: plan.storage_mb,
            words: plan.credits_count,
          };

          const isPaystackAvailable =
            paymentConfig.paystackEnabled && paymentConfig.mode !== 'unconfigured';
          const showManualUnderneath = shouldShowManualReceiptButton(paymentConfig, true);
          const resolvedCycle: 'monthly' | 'one_time' | 'infinite' = isInfinite
            ? 'infinite'
            : isOneTime
            ? 'one_time'
            : 'monthly';

          const masterUser = type === 'storage' ? masterStorageStatus?.userState : null;
          const isExactActiveStoragePlan = Boolean(
            type === 'storage' &&
              masterUser &&
              masterUser.hasActiveSubscription &&
              !masterUser.isExpired &&
              masterUser.planId === plan.id &&
              masterUser.paidMb >= Number(plan.storage_mb || 0)
          );
          const isStorageBoosterMode = Boolean(
            type === 'storage' &&
              masterUser &&
              masterUser.paidMb > 0 &&
              !isExactActiveStoragePlan
          );

          if (isExactActiveStoragePlan) {
            return (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('storage-master-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="w-full py-2.5 sm:py-3 px-3 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 text-xs sm:text-sm font-extrabold text-center cursor-pointer hover:bg-emerald-600/20 transition-all"
                >
                  ✓ Déjà actif — Renouveler / augmenter sur la Carte Maîtresse
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-2">
              {isStorageBoosterMode && (
                <div className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30 text-center">
                  ⚡ Bonus rapide : s'ajoute directement à votre Carte Maîtresse
                </div>
              )}
              {isPaystackAvailable ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveCustomPayment({
                      target: {
                        productType: type,
                        productId: plan.id,
                        productName: plan.name,
                        subtitle: isStorageBoosterMode
                          ? `Booster +${lockedPerkText} ajouté à votre forfait actuel`
                          : lockedPerkText,
                        description: plan.description || undefined,
                        features: activeFeatures.map((f) => f.text).filter(Boolean),
                        periodLabel: isInfinite || isOneTime ? undefined : durationDays === 30 ? '/ mois' : `/ ${durationDays} jours`,
                        amountFcfa: Math.round(pricing.priceFcfa),
                        secondaryPriceDisplay:
                          pricing.primaryCurr !== 'XOF'
                            ? formattedPrimary
                            : pricing.secondaryString || undefined,
                        billingCycle: resolvedCycle,
                        billingMode,
                        durationDays,
                      },
                      manualPlan: manualPlanObj,
                    })
                  }
                  className={`w-full py-2.5 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs text-center active:scale-[0.98] flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/30'
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                  }`}
                >
                  <span>
                    {isStorageBoosterMode
                      ? `Ajouter +${lockedPerkText}`
                      : isInfinite
                      ? 'Obtenir à vie'
                      : isAuto
                      ? "S'abonner"
                      : 'Choisir cette offre'}
                  </span>
                </button>
              ) : showManualUnderneath ? (
                <button
                  type="button"
                  onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
                  className={`w-full py-2.5 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs text-center active:scale-[0.98] flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/30'
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>Payer manuellement (reçu)</span>
                </button>
              ) : (
                <div className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-semibold text-center">
                  Paiement temporairement indisponible
                </div>
              )}

              {/* Bouton secondaire « Payer manuellement » directement sous le bouton principal (contrôlé par le Tableau de bord) */}
              {isPaystackAvailable && showManualUnderneath && (
                <button
                  type="button"
                  onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
                  className={`w-full py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    isPopular
                      ? 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/15'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Payer manuellement (envoyer un reçu)</span>
                </button>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // Rendu d'une carte d'abonnement / achat d'Application (style identique aux cartes Assistante IA & Stockage)
  const renderAppPlanCard = (plan: AppSubscriptionPlanRecord, app: MonetizedAppWithPlans) => {
    const isPopular = !!(plan.badge && plan.badge.trim());
    const pricing = getCardPricingAndConversions(plan);
    const billingMode = normalizeClientBillingMode(plan.billing_mode, plan.is_auto_billing);
    const isInfinite = billingMode === 'infinite' || Number(plan.is_infinite) === 1;
    const isAuto = billingMode === 'auto' || Number(plan.allow_auto) === 1;
    const durationDays = isInfinite ? 0 : Math.max(1, Number(plan.duration_days || 30));

    const durationSummary = isInfinite
      ? `Accès à vie à ${app.name}`
      : durationDays === 30
      ? `Accès complet à ${app.name} (30 jours)`
      : `Accès complet à ${app.name} (${durationDays} jours)`;

    const allFeatures = parsePlanFeatures(plan.features);
    const activeFeatures = allFeatures.filter((f) => f && f.enabled !== false && String(f.text || '').trim().length > 0);

    const formattedPrimary = `${getCurrencySymbol(pricing.primaryCurr)} ${
      pricing.primaryCurr === 'XOF'
        ? pricing.activePrice.toLocaleString('fr-FR')
        : pricing.activePrice
    }`;

    const manualPlanObj: SelectedPlan = {
      name: `${app.name} — ${plan.name}`,
      type: 'storage',
      storageDisplay: durationSummary,
      priceDisplay: isInfinite
        ? `${formattedPrimary} ${pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''}`
        : `${formattedPrimary} / ${durationDays === 30 ? 'mois' : `${durationDays} jours`} ${
            pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''
          }`,
      price: pricing.activePrice,
      priceFcfa: pricing.priceFcfa,
      currency: getCurrencySymbol(pricing.primaryCurr),
      billingCycle: isInfinite ? 'one_time' : 'monthly',
    };

    const isPaystackAvailable =
      paymentConfig.paystackEnabled && paymentConfig.mode !== 'unconfigured';
    const showManualUnderneath = shouldShowManualReceiptButton(paymentConfig, true);
    const resolvedCycle: 'monthly' | 'one_time' | 'infinite' = isInfinite ? 'infinite' : 'monthly';

    return (
      <div
        key={plan.id}
        className={`rounded-2xl p-5 sm:p-7 flex flex-col justify-between relative max-w-[380px] w-full mx-auto transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in zoom-in-95 duration-200 ${
          isPopular
            ? 'bg-gradient-to-b from-slate-900 to-[#0f172a] dark:from-[#162036] dark:to-[#0f172a] border border-slate-800 dark:border-blue-500/40 text-white shadow-lg ring-1 ring-blue-500/20'
            : 'bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div>
          {/* En-tête : Titre & Badge */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className={`text-lg sm:text-xl font-extrabold tracking-tight uppercase ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {plan.name}
            </h3>
            {isPopular && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {plan.badge}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-xs sm:text-sm mb-4 sm:mb-5 leading-relaxed ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {plan.description}
            </p>
          )}

          {/* Bloc Prix Principal & Conversions secondaires */}
          <div className="mb-4 sm:mb-5">
            <div className={`flex items-baseline flex-wrap gap-x-2 gap-y-1 ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              {!isInfinite && (
                <span className={`text-sm sm:text-base font-medium ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {durationDays === 30 ? '/mois' : `/ ${durationDays}j`}
                </span>
              )}
            </div>

            {pricing.secondaryParts && pricing.secondaryParts.length > 0 && (
              <div className={`text-xs font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${isPopular ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {pricing.secondaryParts.map((sec, idx) => (
                  <span key={sec.curr} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="opacity-40">•</span>}
                    <span>= {sec.formatted}</span>
                  </span>
                ))}
              </div>
            )}

            {isInfinite ? (
              <div className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md ${isPopular ? 'bg-amber-500/15 text-amber-200 border border-amber-400/30' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'}`}>
                <InfinityIcon className="w-3 h-3" />
                <span>Paiement unique • Accès à vie</span>
              </div>
            ) : isAuto ? (
              <div className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md ${isPopular ? 'bg-blue-500/15 text-blue-200 border border-blue-400/30' : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'}`}>
                <span>Automatique ou Manuel ({durationDays} jours)</span>
              </div>
            ) : (
              <div className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md ${isPopular ? 'bg-white/10 text-slate-200 border border-white/15' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                <Clock className="w-3 h-3" />
                <span>Pass {durationDays} jours • Sans engagement</span>
              </div>
            )}
          </div>

          <div className={`h-px w-full mb-4 sm:mb-5 ${isPopular ? 'bg-slate-800' : 'bg-slate-200/80 dark:bg-slate-800'}`}></div>

          {/* Avantages inclus */}
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
            Ce qui est inclus
          </p>

          <ul className="space-y-2.5 mb-6">
            <li className="flex items-start gap-2.5">
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                isPopular ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400'
              }`}>
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
              </div>
              <span className={`text-xs sm:text-sm font-bold ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {durationSummary}
              </span>
            </li>

            {activeFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isPopular ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
                </div>
                <span className={`text-xs sm:text-sm ${isPopular ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Boutons de paiement */}
        <div className="space-y-2">
          {isPaystackAvailable ? (
            <button
              type="button"
              onClick={() =>
                setActiveCustomPayment({
                  target: {
                    productType: 'app',
                    productId: plan.id,
                    productName: plan.name,
                    appName: app.name,
                    subtitle: durationSummary,
                    description: plan.description || app.description || undefined,
                    features: activeFeatures.map((f) => f.text).filter(Boolean),
                    periodLabel: isInfinite ? undefined : durationDays === 30 ? '/ mois' : `/ ${durationDays} jours`,
                    amountFcfa: Math.round(pricing.priceFcfa),
                    secondaryPriceDisplay:
                      pricing.primaryCurr !== 'XOF'
                        ? formattedPrimary
                        : pricing.secondaryString || undefined,
                    billingCycle: resolvedCycle,
                    billingMode,
                    durationDays,
                  },
                  manualPlan: manualPlanObj,
                })
              }
              className={`w-full py-2.5 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs text-center active:scale-[0.98] flex items-center justify-center gap-2 ${
                isPopular
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/30'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
              }`}
            >
              <span>
                {isInfinite ? 'Obtenir à vie' : isAuto ? "S'abonner" : 'Choisir cette offre'}
              </span>
            </button>
          ) : showManualUnderneath ? (
            <button
              type="button"
              onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
              className={`w-full py-2.5 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs text-center active:scale-[0.98] flex items-center justify-center gap-2 ${
                isPopular
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/30'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Payer manuellement (reçu)</span>
            </button>
          ) : (
            <div className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-semibold text-center">
              Paiement temporairement indisponible
            </div>
          )}

          {isPaystackAvailable && showManualUnderneath && (
            <button
              type="button"
              onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
              className={`w-full py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                isPopular
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
  };

  const selectedApp: MonetizedAppWithPlans | null =
    monetizedApps.find((a) => a.app_key === selectedAppKey) || monetizedApps[0] || null;
  const selectedAppActivePlans: AppSubscriptionPlanRecord[] = selectedApp
    ? (selectedApp.plans || []).filter((p) => p.is_active !== 0)
    : [];

  const renderAppsSidebarContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#111827] select-none">
      {/* En-tête de la barre latérale */}
      <div className="px-3 pt-3 pb-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <AppWindow className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                Applications
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                Offres &amp; achats par app
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => loadMonetizedAppsCatalog()}
              disabled={loadingApps}
              title="Actualiser la liste des applications"
              className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingApps ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileAppsSidebarOpen(false)}
              className="md:hidden w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Liste des applications créées dans le tableau de bord */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1.5 min-h-0">
        <div className="px-1 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            APPLICATIONS ({monetizedApps.length})
          </span>
        </div>

        {loadingApps && monetizedApps.length === 0 ? (
          <div className="space-y-1.5 pt-1">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-9 rounded-md bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            ))}
          </div>
        ) : monetizedApps.length === 0 ? (
          <div className="px-2.5 py-4 text-center rounded-md border border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
            Aucune application enregistrée.
          </div>
        ) : (
          monetizedApps.map((app) => {
            const isSelected = selectedApp?.app_key === app.app_key;
            const activeOffersCount = (app.plans || []).filter((p) => p.is_active !== 0).length;
            const hasPaidOffers = activeOffersCount > 0 || Number(app.is_paid) === 1;

            return (
              <button
                key={app.app_key}
                type="button"
                onClick={() => {
                  setSelectedAppKey(app.app_key);
                  setIsMobileAppsSidebarOpen(false);
                }}
                className={`w-full group relative overflow-hidden flex items-center justify-between gap-2 px-2.5 h-9 rounded-md border text-xs transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-[#2563eb] border-[#1d4ed8] text-white font-semibold shadow-xs'
                    : 'bg-white dark:bg-[#161f33]/70 border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                }`}
              >
                {!isSelected && (
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3.5px] ${
                      hasPaidOffers ? 'bg-blue-600' : 'bg-emerald-500'
                    }`}
                  />
                )}
                <div className={`flex items-center gap-2 min-w-0 flex-1 ${!isSelected ? 'pl-1' : ''}`}>
                  <span className="text-sm leading-none shrink-0">{app.icon || '📱'}</span>
                  <span className="truncate">{app.name}</span>
                </div>
                {activeOffersCount > 0 ? (
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {activeOffersCount}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-40 w-full md:w-[calc(100%-16rem)] ${isEmbeddedInSettings ? 'h-screen' : 'h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'} flex flex-col bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-hidden select-none transition-colors duration-300`}>
      
      {/* ========================================================================= */}
      {/* 1. BARRE FIXE IMMOBILE (Responsive : 3 onglets propres Stockage / IA / Apps) */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 z-50 sticky top-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md px-3 sm:px-6 py-2 md:py-2.5 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 md:gap-4 border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
        
        {/* Bouton Retour (Gauche) */}
        <button
          onClick={onBack}
          className="order-1 flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] sm:text-xs rounded-lg border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        {/* Boutons pour changer de menu (Stockage | Assistante StudyCloud | Applications) */}
        <div className="order-3 md:order-2 w-full md:w-auto bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-3 md:flex md:items-center gap-1 shadow-xs">
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'storage'
                ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
            }`}
          >
            <HardDrive className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden md:inline">Abonnements stockage</span>
            <span className="md:hidden truncate">Stockage</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'ai'
                ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
            }`}
          >
            <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden md:inline">Abonnement assistante StudyCloud</span>
            <span className="md:hidden truncate">Assistante IA</span>
          </button>

          <button
            onClick={() => setActiveTab('apps')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'apps'
                ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
            }`}
          >
            <AppWindow className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden md:inline">Abonnements applications</span>
            <span className="md:hidden truncate">Applications</span>
          </button>
        </div>

        {/* Espace symétrique à droite sur desktop */}
        <div className="hidden md:block md:w-20 order-3 shrink-0"></div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ZONE DE CONTENU : LAYOUT BARRE LATÉRALE POUR APPLICATIONS OU GRILLE    */}
      {/* ========================================================================= */}
      {activeTab === 'apps' ? (
        <div className="flex-1 flex min-h-0 overflow-hidden bg-[#eef2f6] dark:bg-[#0b1120]">
          {/* BARRE LATÉRALE DESKTOP (identique au menu Mes abonnements) */}
          <aside className="hidden md:flex w-[232px] lg:w-[252px] shrink-0 flex-col border-r border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] h-full min-h-0 z-20">
            {renderAppsSidebarContent()}
          </aside>

          {/* TIROIR LATÉRAL MOBILE */}
          {isMobileAppsSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-[1px]"
              onClick={() => setIsMobileAppsSidebarOpen(false)}
            >
              <div
                className="w-[264px] max-w-[82vw] h-full bg-white dark:bg-[#111827] shadow-xl border-r border-slate-300 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                {renderAppsSidebarContent()}
              </div>
            </div>
          )}

          {/* ZONE PRINCIPALE À DROITE : DÉTAILS + CARTES D'ACHAT DE L'APPLICATION SÉLECTIONNÉE */}
          <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
            {/* Barre mobile compacte pour choisir une application */}
            <div className="md:hidden px-3 py-2 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileAppsSidebarOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer min-w-0"
              >
                <Menu className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {selectedApp ? `${selectedApp.icon || '📱'} ${selectedApp.name}` : 'Choisir une application'}
                </span>
              </button>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                {monetizedApps.length} app{monetizedApps.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-5 sm:pt-7 pb-32">
              <div className="w-full max-w-[1160px] mx-auto">
                {loadingApps && monetizedApps.length === 0 ? (
                  renderSkeletonCards()
                ) : !selectedApp ? (
                  <div className="py-12 text-center bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 px-6 max-w-md mx-auto mt-6">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Aucune application disponible
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Bouton d'essai uniquement si configuré et disponible */}
                    {selectedAppAccess?.canStartTrial && Number(selectedApp.trial_days) > 0 && (
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Essai disponible ({selectedApp.trial_days} jours)
                        </span>
                        <button
                          type="button"
                          disabled={startingTrial}
                          onClick={() => handleStartSelectedAppTrial(selectedApp.app_key)}
                          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                        >
                          {startingTrial ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>Démarrer l'essai ({selectedApp.trial_days}j)</span>
                        </button>
                      </div>
                    )}

                    {trialFeedback && (
                      <div
                        className={`mb-4 px-3 py-2 rounded-lg text-xs font-semibold ${
                          trialFeedback.type === 'ok'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {trialFeedback.text}
                      </div>
                    )}

                    {/* Cartes d'abonnement / achat créées dans le tableau de bord pour cette application */}
                    {selectedAppActivePlans.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch pb-20 w-full">
                        {selectedAppActivePlans.map((plan) => renderAppPlanCard(plan, selectedApp))}
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 px-6 max-w-md mx-auto mt-6">
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          Pas d'achat pour cette application
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-5 sm:pt-8 pb-32">
          <div className="w-full max-w-[1250px] mx-auto">
            {/* Header Section */}
            <div className="text-center pb-6 sm:pb-8 max-w-5xl mx-auto">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 leading-tight">
                Choisissez votre formule
              </h1>
              <p className="text-xs sm:text-base font-sans text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
                Des tarifs simples, transparents et adaptés à vos objectifs.
              </p>
            </div>

            {/* Animation de chargement squelette ou affichage des cartes */}
            {loadingPlans ? (
              renderSkeletonCards()
            ) : (
              <>
                {/* 1. SECTION : ABONNEMENTS STOCKAGE (CARTE MAÎTRESSE + CARTES BONUS D1)  */}
                {activeTab === 'storage' && (() => {
                  const activeStorageCards = dbStoragePlans.filter(plan => plan.is_active !== 0);
                  const showMasterCard = Boolean(masterStorageStatus?.config?.enabled);
                  if (showMasterCard || activeStorageCards.length > 0) {
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-1 sm:px-2">
                        {showMasterCard && masterStorageStatus && (
                          <StorageMasterCard
                            config={masterStorageStatus.config}
                            userState={masterStorageStatus.userState}
                            paymentConfig={paymentConfig}
                            onStartCustomPayment={(target, manualPlan) =>
                              setActiveCustomPayment({ target, manualPlan })
                            }
                            onStartManualPayment={(manualPlan) =>
                              setSelectedPlanForSubscription(manualPlan)
                            }
                          />
                        )}
                        {activeStorageCards.map(plan => renderCard(plan, 'storage'))}
                      </div>
                    );
                  }
                  return (
                    <div className="col-span-full py-14 text-center bg-white dark:bg-[#111827] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 sm:p-8 max-w-xl mx-auto mb-20 shadow-xs">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">💾</div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucune offre de stockage pour le moment</h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Les cartes d'abonnement de stockage créées dans le tableau de bord administrateur s'afficheront ici automatiquement.</p>
                    </div>
                  );
                })()}

                {/* 2. SECTION : ASSISTANTE STUDYCLOUD (DYNAMIQUES DEPUIS LA BASE DE DONNÉES) */}
                {activeTab === 'ai' && (
                  dbAiPlans.filter(plan => plan.is_active !== 0).length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-1 sm:px-2">
                      {dbAiPlans.filter(plan => plan.is_active !== 0).map(plan => renderCard(plan, 'ai'))}
                    </div>
                  ) : (
                    <div className="col-span-full py-14 text-center bg-white dark:bg-[#111827] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 sm:p-8 max-w-xl mx-auto mb-20 shadow-xs">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">🤖</div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucune offre IA pour le moment</h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Les forfaits et packs de crédits IA créés dans le tableau de bord administrateur s'afficheront ici automatiquement.</p>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
