import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
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

const PRICING_PAGE_BG_STYLE: React.CSSProperties = {
  background: [
    'radial-gradient(ellipse 68% 58% at 12% 48%, rgba(255, 109, 41, 0.72) 0%, rgba(186, 68, 20, 0.42) 34%, rgba(69, 48, 39, 0.16) 62%, transparent 82%)',
    'radial-gradient(ellipse 75% 65% at 88% 12%, rgba(69, 48, 39, 0.42) 0%, rgba(22, 19, 22, 0.86) 60%, #161316 100%)',
    'radial-gradient(ellipse 62% 52% at 30% 94%, rgba(168, 63, 18, 0.56) 0%, rgba(69, 48, 39, 0.28) 45%, transparent 78%)',
    'linear-gradient(160deg, #161316 0%, #261610 38%, #3B1F14 68%, #161316 100%)',
  ].join(', '),
};

const STANDARD_CARD_STYLE: React.CSSProperties = {
  background:
    'radial-gradient(ellipse 95% 32% at 50% 0%, rgba(255, 109, 41, 0.16) 0%, rgba(69, 48, 39, 0.08) 46%, transparent 78%), #121012',
};

const POPULAR_CARD_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255, 114, 41, 0.94) 0%, rgba(196, 68, 19, 0.68) 18%, rgba(84, 30, 14, 0.48) 36%, rgba(20, 15, 15, 0.97) 58%, #121012 100%)',
};

const CAPSULE_CTA_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(90deg, #1E1110 0%, #5A2413 38%, #C74919 72%, #FF6D29 90%, #FFA366 100%)',
};

const CARD_FEATURES_SCROLL_CLS =
  'flex-initial min-h-0 overflow-y-auto pr-1.5 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-[#FF6D29]/60';

function distributeMasonryColumns<T>(
  items: T[],
  columnCount: number,
  getWeight: (item: T) => number
): T[][] {
  const safeCols = Math.max(1, columnCount);
  const cols: T[][] = Array.from({ length: safeCols }, () => []);
  const heights: number[] = Array.from({ length: safeCols }, () => 0);

  for (const item of items) {
    let shortestIdx = 0;
    for (let c = 1; c < safeCols; c++) {
      if (heights[c] < heights[shortestIdx]) {
        shortestIdx = c;
      }
    }
    cols[shortestIdx].push(item);
    heights[shortestIdx] += Math.max(180, Math.min(500, getWeight(item))) + 20;
  }

  return cols;
}

function estimatePlanCardWeight(plan: {
  description?: string | null;
  features?: any;
  pricing_model?: string;
  currencies_enabled?: string | string[];
}): number {
  const activeCount = parsePlanFeatures(plan.features).filter(
    (f) => f && f.enabled !== false && String(f.text || '').trim().length > 0
  ).length;
  let weight = 230 + (activeCount + 1) * 28;
  if (plan.description && String(plan.description).trim()) weight += 34;
  if (plan.pricing_model === 'one_time' || plan.pricing_model === 'pack') weight += 28;
  return Math.min(500, weight);
}

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
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Animation de chargement avec cartes squelettes sombres harmonisées
  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-start pb-20 w-full max-w-[1260px] mx-auto px-1 sm:px-2">
      {[1, 2, 3].map((i) => {
        const isMiddle = i === 2;
        return (
          <div
            key={i}
            style={isMiddle ? POPULAR_CARD_STYLE : STANDARD_CARD_STYLE}
            className={`rounded-[24px] p-5 sm:p-6 flex flex-col justify-between relative w-full animate-pulse min-h-[380px] ${
              isMiddle
                ? 'border border-[#FF8E53]/40'
                : 'border border-[#FF6D29]/20'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 w-28 rounded-lg bg-white/15"></div>
                {isMiddle && <div className="h-5 w-20 rounded-full bg-white/15"></div>}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-4/5 rounded bg-white/10"></div>
                <div className="h-3 w-3/5 rounded bg-white/8"></div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="h-9 w-36 rounded-lg bg-white/15"></div>
                <div className="h-3 w-40 rounded bg-white/10"></div>
              </div>

              <div className="h-px w-full my-3 bg-white/10"></div>

              <div className="space-y-3 pt-1">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full shrink-0 bg-[#FF6D29]/30"></div>
                    <div className="h-3 rounded bg-white/10" style={{ width: `${55 + j * 8}%` }}></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-11 w-full rounded-full mt-6 bg-white/10"></div>
          </div>
        );
      })}
    </div>
  );

  // Rendu des cartes (Stockage & Crédits IA) — design professionnel sombre + hauteur adaptative + scroll interne si beaucoup d'avantages
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
        style={isPopular ? POPULAR_CARD_STYLE : STANDARD_CARD_STYLE}
        className={`rounded-[24px] p-5 sm:p-6 flex flex-col relative w-full max-h-[500px] overflow-hidden text-white transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in zoom-in-95 duration-200 ${
          isPopular
            ? 'border border-[#FF8E53]/48 hover:border-[#FF8E53]/75 shadow-[0_22px_54px_-14px_rgba(0,0,0,0.84),0_0_32px_-10px_rgba(255,109,41,0.34)]'
            : 'border border-[#FF6D29]/24 hover:border-[#FF6D29]/50 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Bloc supérieur fixe (Titre, Description, Prix, Séparateur) */}
        <div className="shrink-0">
          {/* En-tête : Titre & Badge */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-lg sm:text-[21px] font-extrabold tracking-tight text-white uppercase leading-tight">
              {plan.name}
            </h3>
            {isPopular && (
              <span className="shrink-0 bg-[#161316]/55 backdrop-blur-sm text-white border border-white/25 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {plan.badge}
              </span>
            )}
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-xs sm:text-[13px] mb-3.5 leading-relaxed ${isPopular ? 'text-[#FFF1E8]/85' : 'text-[#BABABA]'}`}>
              {plan.description}
            </p>
          )}

          {/* Bloc Prix Principal & Conversions secondaires */}
          <div className="mb-4">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 text-white">
              <span className="text-2xl sm:text-[32px] font-extrabold tracking-tight tabular-nums leading-none">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              {!isOneTime && !isInfinite && (
                <span className={`text-xs sm:text-sm font-medium ${isPopular ? 'text-[#FFE2D1]/85' : 'text-[#BABABA]'}`}>
                  {durationDays === 30 ? '/ mois' : `/ ${durationDays}j`}
                </span>
              )}
            </div>

            {pricing.secondaryParts && pricing.secondaryParts.length > 0 && (
              <div className={`text-[11px] font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isPopular ? 'text-[#FFE2D1]/75' : 'text-[#BABABA]/85'}`}>
                {pricing.secondaryParts.map((sec, idx) => (
                  <span key={sec.curr} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="opacity-45">•</span>}
                    <span>= {sec.formatted}</span>
                  </span>
                ))}
              </div>
            )}

            {isOneTime && (
              <div className="text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FF6D29]/15 text-[#FFB085] border border-[#FF6D29]/35">
                <span>⚡ Paiement unique • Crédits sans expiration</span>
              </div>
            )}
          </div>

          {/* Ligne de séparation */}
          <div className="h-px w-full mb-3.5 bg-white/12"></div>

          {/* Libellé avantages */}
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5 text-white/90">
            Ce qui est inclus
          </p>
        </div>

        {/* Liste des avantages — s'adapte à la hauteur ou défile proprement à l'intérieur si beaucoup d'éléments */}
        <ul className={CARD_FEATURES_SCROLL_CLS}>
          {/* Première ligne verrouillée et mise en valeur */}
          <li className="flex items-start gap-2.5">
            <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-[#FF8D52]/70 bg-[#FF6D29]/20 text-[#FFA370]">
              <Check className="w-2.5 h-2.5 stroke-[2.8]" />
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-white leading-snug">
              {lockedPerkText}
            </span>
          </li>

          {/* Autres avantages de la formule */}
          {activeFeatures.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-white/25 bg-white/[0.04] text-[#BABABA]">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
              </div>
              <span className="text-xs sm:text-[13px] text-[#E6E2E0] leading-snug">
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        {/* Boutons d'action fixes en bas de carte */}
        <div className="shrink-0 mt-4 pt-3.5 border-t border-white/[0.08]">
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
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('storage-master-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="w-full py-2.5 px-3.5 rounded-full bg-emerald-500/14 hover:bg-emerald-500/22 text-emerald-300 border border-emerald-400/35 text-xs font-bold text-center cursor-pointer transition-all leading-snug"
                >
                  ✓ Déjà actif — Gérer sur la Carte Maîtresse
                </button>
              );
            }

            return (
              <div className="space-y-2">
                {isStorageBoosterMode && (
                  <div className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-[#FF6D29]/12 text-[#FFB085] border border-[#FF6D29]/30 text-center">
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
                    style={CAPSULE_CTA_STYLE}
                    className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_24px_-8px_rgba(255,109,41,0.45)] hover:shadow-[0_14px_30px_-8px_rgba(255,109,41,0.7)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
                  >
                    <span className="flex-1 text-center truncate px-1">
                      {isStorageBoosterMode
                        ? `Ajouter +${lockedPerkText}`
                        : isInfinite
                        ? 'Obtenir à vie'
                        : isAuto
                        ? "S'abonner"
                        : 'Choisir cette offre'}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5">
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    </span>
                  </button>
                ) : showManualUnderneath ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
                    style={CAPSULE_CTA_STYLE}
                    className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_24px_-8px_rgba(255,109,41,0.45)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
                  >
                    <span className="flex-1 text-center truncate px-1">Payer manuellement (reçu)</span>
                    <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0">
                      <Receipt className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 px-3 rounded-full bg-white/5 border border-white/10 text-[#BABABA] text-xs font-semibold text-center">
                    Paiement temporairement indisponible
                  </div>
                )}

                {isPaystackAvailable && showManualUnderneath && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
                    className="w-full py-2 px-3 rounded-full text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border bg-white/[0.05] hover:bg-white/[0.1] text-[#BABABA] hover:text-white border-white/12"
                  >
                    <Receipt className="w-3.5 h-3.5 text-[#FF8D52] shrink-0" />
                    <span>Payer manuellement (envoyer un reçu)</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
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
        style={isPopular ? POPULAR_CARD_STYLE : STANDARD_CARD_STYLE}
        className={`rounded-[24px] p-5 sm:p-6 flex flex-col relative w-full max-h-[500px] overflow-hidden text-white transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in zoom-in-95 duration-200 ${
          isPopular
            ? 'border border-[#FF8E53]/48 hover:border-[#FF8E53]/75 shadow-[0_22px_54px_-14px_rgba(0,0,0,0.84),0_0_32px_-10px_rgba(255,109,41,0.34)]'
            : 'border border-[#FF6D29]/24 hover:border-[#FF6D29]/50 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.8)]'
        }`}
      >
        <div className="shrink-0">
          {/* En-tête : Titre & Badge */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-lg sm:text-[21px] font-extrabold tracking-tight text-white uppercase leading-tight">
              {plan.name}
            </h3>
            {isPopular && (
              <span className="shrink-0 bg-[#161316]/55 backdrop-blur-sm text-white border border-white/25 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {plan.badge}
              </span>
            )}
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-xs sm:text-[13px] mb-3.5 leading-relaxed ${isPopular ? 'text-[#FFF1E8]/85' : 'text-[#BABABA]'}`}>
              {plan.description}
            </p>
          )}

          {/* Bloc Prix Principal & Conversions secondaires */}
          <div className="mb-4">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 text-white">
              <span className="text-2xl sm:text-[32px] font-extrabold tracking-tight tabular-nums leading-none">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              {!isInfinite && (
                <span className={`text-xs sm:text-sm font-medium ${isPopular ? 'text-[#FFE2D1]/85' : 'text-[#BABABA]'}`}>
                  {durationDays === 30 ? '/ mois' : `/ ${durationDays}j`}
                </span>
              )}
            </div>

            {pricing.secondaryParts && pricing.secondaryParts.length > 0 && (
              <div className={`text-[11px] font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isPopular ? 'text-[#FFE2D1]/75' : 'text-[#BABABA]/85'}`}>
                {pricing.secondaryParts.map((sec, idx) => (
                  <span key={sec.curr} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="opacity-45">•</span>}
                    <span>= {sec.formatted}</span>
                  </span>
                ))}
              </div>
            )}

            {isInfinite ? (
              <div className="text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FF6D29]/15 text-[#FFB085] border border-[#FF6D29]/35">
                <InfinityIcon className="w-3 h-3" />
                <span>Paiement unique • Accès à vie</span>
              </div>
            ) : isAuto ? (
              <div className="text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFE2D1] border border-white/18">
                <span>Automatique ou Manuel ({durationDays} jours)</span>
              </div>
            ) : (
              <div className="text-[11px] font-semibold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/8 text-[#BABABA] border border-white/14">
                <Clock className="w-3 h-3" />
                <span>Pass {durationDays} jours • Sans engagement</span>
              </div>
            )}
          </div>

          <div className="h-px w-full mb-3.5 bg-white/12"></div>

          {/* Avantages inclus */}
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5 text-white/90">
            Ce qui est inclus
          </p>
        </div>

        <ul className={CARD_FEATURES_SCROLL_CLS}>
          <li className="flex items-start gap-2.5">
            <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-[#FF8D52]/70 bg-[#FF6D29]/20 text-[#FFA370]">
              <Check className="w-2.5 h-2.5 stroke-[2.8]" />
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-white leading-snug">
              {durationSummary}
            </span>
          </li>

          {activeFeatures.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-white/25 bg-white/[0.04] text-[#BABABA]">
                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
              </div>
              <span className="text-xs sm:text-[13px] text-[#E6E2E0] leading-snug">
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        {/* Boutons de paiement */}
        <div className="shrink-0 mt-4 pt-3.5 border-t border-white/[0.08] space-y-2">
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
              style={CAPSULE_CTA_STYLE}
              className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_24px_-8px_rgba(255,109,41,0.45)] hover:shadow-[0_14px_30px_-8px_rgba(255,109,41,0.7)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
            >
              <span className="flex-1 text-center truncate px-1">
                {isInfinite ? 'Obtenir à vie' : isAuto ? "S'abonner" : 'Choisir cette offre'}
              </span>
              <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5">
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </span>
            </button>
          ) : showManualUnderneath ? (
            <button
              type="button"
              onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
              style={CAPSULE_CTA_STYLE}
              className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_24px_-8px_rgba(255,109,41,0.45)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
            >
              <span className="flex-1 text-center truncate px-1">Payer manuellement (reçu)</span>
              <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0">
                <Receipt className="w-3.5 h-3.5" />
              </span>
            </button>
          ) : (
            <div className="w-full py-2.5 px-3 rounded-full bg-white/5 border border-white/10 text-[#BABABA] text-xs font-semibold text-center">
              Paiement temporairement indisponible
            </div>
          )}

          {isPaystackAvailable && showManualUnderneath && (
            <button
              type="button"
              onClick={() => setSelectedPlanForSubscription(manualPlanObj)}
              className="w-full py-2 px-3 rounded-full text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border bg-white/[0.05] hover:bg-white/[0.1] text-[#BABABA] hover:text-white border-white/12"
            >
              <Receipt className="w-3.5 h-3.5 text-[#FF8D52] shrink-0" />
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
    <div className="flex flex-col h-full min-h-0 bg-[#161316]/90 backdrop-blur-xl select-none text-white">
      {/* En-tête de la barre latérale */}
      <div className="px-3 pt-3 pb-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#FF6D29]/15 border border-[#FF6D29]/35 flex items-center justify-center text-[#FF8D52] shrink-0">
              <AppWindow className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white truncate leading-tight">
                Applications
              </h2>
              <p className="text-[10px] text-[#BABABA] truncate leading-tight">
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
              className="w-7 h-7 rounded-lg border border-white/12 bg-white/[0.05] hover:bg-white/[0.12] flex items-center justify-center text-[#BABABA] hover:text-white cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingApps ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileAppsSidebarOpen(false)}
              className="md:hidden w-7 h-7 rounded-lg border border-white/12 bg-white/[0.05] flex items-center justify-center text-[#BABABA] hover:text-white cursor-pointer"
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#BABABA]">
            APPLICATIONS ({monetizedApps.length})
          </span>
        </div>

        {loadingApps && monetizedApps.length === 0 ? (
          <div className="space-y-1.5 pt-1">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-9 rounded-lg bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : monetizedApps.length === 0 ? (
          <div className="px-2.5 py-4 text-center rounded-lg border border-dashed border-white/15 text-[11px] text-[#BABABA]">
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
                className={`w-full group relative overflow-hidden flex items-center justify-between gap-2 px-2.5 h-9 rounded-lg border text-xs transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#FF6D29] to-[#D94E14] border-[#FF9B66]/60 text-white font-semibold shadow-md shadow-[#FF6D29]/25'
                    : 'bg-white/[0.04] border-white/10 hover:border-[#FF6D29]/40 text-[#E5E0DD] hover:bg-white/[0.08] font-medium'
                }`}
              >
                {!isSelected && (
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                      hasPaidOffers ? 'bg-[#FF6D29]' : 'bg-emerald-400'
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
                        ? 'bg-black/25 text-white'
                        : 'bg-[#FF6D29]/15 text-[#FFB085]'
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
    <div
      style={PRICING_PAGE_BG_STYLE}
      className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-40 w-full md:w-[calc(100%-16rem)] ${isEmbeddedInSettings ? 'h-screen' : 'h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'} flex flex-col text-white overflow-hidden select-none`}
    >
      {/* ========================================================================= */}
      {/* 1. BARRE FIXE IMMOBILE (Responsive : 3 onglets propres Stockage / IA / Apps) */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 z-50 sticky top-0 bg-[#161316]/72 backdrop-blur-xl px-3 sm:px-6 py-2 md:py-2.5 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 md:gap-4 border-b border-white/10">
        {/* Bouton Retour (Gauche) */}
        <button
          onClick={onBack}
          className="order-1 flex items-center gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-white/[0.07] hover:bg-white/[0.14] text-white font-semibold text-[11px] sm:text-xs rounded-full border border-white/15 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        {/* Boutons pour changer de menu (Stockage | Assistante StudyCloud | Applications) */}
        <div className="order-3 md:order-2 w-full md:w-auto bg-[#161316]/75 p-1 rounded-full border border-white/12 grid grid-cols-3 md:flex md:items-center gap-1">
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'storage'
                ? 'bg-gradient-to-r from-[#FF6D29] to-[#E05015] text-white shadow-md shadow-[#FF6D29]/30'
                : 'text-[#BABABA] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <HardDrive className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden md:inline">Abonnements stockage</span>
            <span className="md:hidden truncate">Stockage</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-[#FF6D29] to-[#E05015] text-white shadow-md shadow-[#FF6D29]/30'
                : 'text-[#BABABA] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden md:inline">Abonnement assistante StudyCloud</span>
            <span className="md:hidden truncate">Assistante IA</span>
          </button>

          <button
            onClick={() => setActiveTab('apps')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'apps'
                ? 'bg-gradient-to-r from-[#FF6D29] to-[#E05015] text-white shadow-md shadow-[#FF6D29]/30'
                : 'text-[#BABABA] hover:text-white hover:bg-white/[0.06]'
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
      {/* 2. ZONE DE CONTENU : LAYOUT BARRE LATÉRALE POUR APPLICATIONS OU MASONRY   */}
      {/* ========================================================================= */}
      {activeTab === 'apps' ? (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* BARRE LATÉRALE DESKTOP */}
          <aside className="hidden md:flex w-[232px] lg:w-[252px] shrink-0 flex-col border-r border-white/10 h-full min-h-0 z-20">
            {renderAppsSidebarContent()}
          </aside>

          {/* TIROIR LATÉRAL MOBILE */}
          {isMobileAppsSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 flex bg-black/65 backdrop-blur-[2px]"
              onClick={() => setIsMobileAppsSidebarOpen(false)}
            >
              <div
                className="w-[264px] max-w-[82vw] h-full shadow-2xl border-r border-white/12"
                onClick={(e) => e.stopPropagation()}
              >
                {renderAppsSidebarContent()}
              </div>
            </div>
          )}

          {/* ZONE PRINCIPALE À DROITE : DÉTAILS + CARTES D'ACHAT DE L'APPLICATION SÉLECTIONNÉE */}
          <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
            {/* Barre mobile compacte pour choisir une application */}
            <div className="md:hidden px-3 py-2 bg-[#161316]/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileAppsSidebarOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.06] text-xs font-semibold text-white cursor-pointer min-w-0"
              >
                <Menu className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {selectedApp ? `${selectedApp.icon || '📱'} ${selectedApp.name}` : 'Choisir une application'}
                </span>
              </button>
              <span className="text-[11px] font-semibold text-[#BABABA] shrink-0">
                {monetizedApps.length} app{monetizedApps.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-5 sm:pt-7 pb-32">
              <div className="w-full max-w-[1160px] mx-auto">
                {loadingApps && monetizedApps.length === 0 ? (
                  renderSkeletonCards()
                ) : !selectedApp ? (
                  <div className="py-12 text-center bg-[#161316]/82 backdrop-blur-md rounded-2xl border border-white/12 px-6 max-w-md mx-auto mt-6">
                    <p className="text-sm font-semibold text-[#BABABA]">
                      Aucune application disponible
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Bouton d'essai uniquement si configuré et disponible */}
                    {selectedAppAccess?.canStartTrial && Number(selectedApp.trial_days) > 0 && (
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-[#161316]/82 backdrop-blur-md rounded-2xl border border-[#FF6D29]/28 px-4 py-3">
                        <span className="text-xs font-semibold text-white">
                          Essai disponible ({selectedApp.trial_days} jours)
                        </span>
                        <button
                          type="button"
                          disabled={startingTrial}
                          onClick={() => handleStartSelectedAppTrial(selectedApp.app_key)}
                          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FF6D29] to-[#E05015] hover:from-[#FF7D3D] hover:to-[#EC5B1F] text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
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
                        className={`mb-4 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                          trialFeedback.type === 'ok'
                            ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/35'
                            : 'bg-rose-500/15 text-rose-200 border border-rose-400/35'
                        }`}
                      >
                        {trialFeedback.text}
                      </div>
                    )}

                    {/* Cartes d'abonnement / achat créées dans le tableau de bord pour cette application */}
                    {selectedAppActivePlans.length > 0 ? (() => {
                      const colCount =
                        viewportWidth >= 1280
                          ? Math.min(3, selectedAppActivePlans.length)
                          : viewportWidth >= 768
                          ? Math.min(2, selectedAppActivePlans.length)
                          : 1;
                      const columns = distributeMasonryColumns(
                        selectedAppActivePlans,
                        colCount,
                        (plan) => estimatePlanCardWeight(plan)
                      );
                      const gridCls =
                        colCount === 3
                          ? 'grid-cols-3'
                          : colCount === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-1 max-w-[400px] mx-auto';
                      return (
                        <div className={`grid ${gridCls} gap-5 items-start pb-20 w-full`}>
                          {columns.map((colPlans, colIdx) => (
                            <div key={colIdx} className="flex flex-col gap-5 min-w-0">
                              {colPlans.map((plan) => renderAppPlanCard(plan, selectedApp))}
                            </div>
                          ))}
                        </div>
                      );
                    })() : (
                      <div className="py-12 text-center bg-[#161316]/82 backdrop-blur-md rounded-2xl border border-white/12 px-6 max-w-md mx-auto mt-6">
                        <p className="text-sm font-semibold text-[#BABABA]">
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
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 pt-5 sm:pt-8 pb-32">
          <div className="w-full max-w-[1280px] mx-auto">
            {/* Header Section */}
            <div className="text-center pb-6 sm:pb-8 max-w-4xl mx-auto">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight text-white mb-2 leading-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)]">
                Choisissez votre formule
              </h1>
              <p className="text-xs sm:text-base font-sans text-[#BABABA] max-w-xl mx-auto leading-relaxed px-2">
                Des tarifs simples, transparents et adaptés à vos objectifs.
              </p>
            </div>

            {/* Animation de chargement squelette ou affichage des cartes */}
            {loadingPlans ? (
              renderSkeletonCards()
            ) : (
              <>
                {/* 1. SECTION : ABONNEMENTS STOCKAGE (CARTE MAÎTRESSE À GAUCHE + CARTES ADAPTATIVES EN MASONRY À DROITE) */}
                {activeTab === 'storage' && (() => {
                  const activeStorageCards = dbStoragePlans.filter(plan => plan.is_active !== 0);
                  const showMasterCard = Boolean(masterStorageStatus?.config?.enabled);

                  if (showMasterCard && masterStorageStatus) {
                    const rightColCount = viewportWidth >= 768 ? 2 : 1;
                    const rightColumns = distributeMasonryColumns(
                      activeStorageCards,
                      rightColCount,
                      (plan) => estimatePlanCardWeight(plan)
                    );

                    return (
                      <div className="flex flex-col lg:flex-row lg:items-start gap-5 sm:gap-6 pb-20 w-full max-w-[1280px] mx-auto px-1 sm:px-2">
                        {/* Colonne gauche : Carte Maîtresse */}
                        <div className="w-full lg:w-[375px] xl:w-[390px] shrink-0 mx-auto lg:mx-0 max-w-[420px] lg:max-w-none">
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
                        </div>

                        {/* Colonnes droite : Cartes secondaires compactes qui optimisent l'espace en masonry */}
                        {activeStorageCards.length > 0 && (
                          <div className="flex-1 min-w-0 w-full grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                            {rightColumns.map((colPlans, colIdx) => (
                              <div key={colIdx} className="flex flex-col gap-5 min-w-0">
                                {colPlans.map((plan) => renderCard(plan, 'storage'))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (activeStorageCards.length > 0) {
                    const colCount =
                      viewportWidth >= 1024
                        ? Math.min(3, activeStorageCards.length)
                        : viewportWidth >= 768
                        ? Math.min(2, activeStorageCards.length)
                        : 1;
                    const columns = distributeMasonryColumns(
                      activeStorageCards,
                      colCount,
                      (plan) => estimatePlanCardWeight(plan)
                    );
                    const containerCls =
                      colCount === 3
                        ? 'grid-cols-3 max-w-[1260px]'
                        : colCount === 2
                        ? 'grid-cols-2 max-w-[840px]'
                        : 'grid-cols-1 max-w-[400px]';

                    return (
                      <div className={`grid ${containerCls} gap-5 items-start pb-20 w-full mx-auto px-1 sm:px-2`}>
                        {columns.map((colPlans, colIdx) => (
                          <div key={colIdx} className="flex flex-col gap-5 min-w-0">
                            {colPlans.map((plan) => renderCard(plan, 'storage'))}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div className="py-14 text-center bg-[#161316]/82 backdrop-blur-md rounded-2xl border border-dashed border-white/15 p-6 sm:p-8 max-w-xl mx-auto mb-20">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-4 text-2xl">💾</div>
                      <h3 className="text-lg font-bold text-white mb-2">Aucune offre de stockage pour le moment</h3>
                      <p className="text-xs sm:text-sm text-[#BABABA] leading-relaxed">Les cartes d'abonnement de stockage créées dans le tableau de bord administrateur s'afficheront ici automatiquement.</p>
                    </div>
                  );
                })()}

                {/* 2. SECTION : ASSISTANTE STUDYCLOUD (CARTES CRÉDITS IA ADAPTATIVES EN MASONRY) */}
                {activeTab === 'ai' && (() => {
                  const activeAiCards = dbAiPlans.filter(plan => plan.is_active !== 0);
                  if (activeAiCards.length > 0) {
                    const colCount =
                      viewportWidth >= 1024
                        ? Math.min(3, activeAiCards.length)
                        : viewportWidth >= 768
                        ? Math.min(2, activeAiCards.length)
                        : 1;
                    const columns = distributeMasonryColumns(
                      activeAiCards,
                      colCount,
                      (plan) => estimatePlanCardWeight(plan)
                    );
                    const containerCls =
                      colCount === 3
                        ? 'grid-cols-3 max-w-[1260px]'
                        : colCount === 2
                        ? 'grid-cols-2 max-w-[840px]'
                        : 'grid-cols-1 max-w-[400px]';

                    return (
                      <div className={`grid ${containerCls} gap-5 items-start pb-20 w-full mx-auto px-1 sm:px-2`}>
                        {columns.map((colPlans, colIdx) => (
                          <div key={colIdx} className="flex flex-col gap-5 min-w-0">
                            {colPlans.map((plan) => renderCard(plan, 'ai'))}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div className="py-14 text-center bg-[#161316]/82 backdrop-blur-md rounded-2xl border border-dashed border-white/15 p-6 sm:p-8 max-w-xl mx-auto mb-20">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-4 text-2xl">🤖</div>
                      <h3 className="text-lg font-bold text-white mb-2">Aucune offre IA pour le moment</h3>
                      <p className="text-xs sm:text-sm text-[#BABABA] leading-relaxed">Les forfaits et packs de crédits IA créés dans le tableau de bord administrateur s'afficheront ici automatiquement.</p>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
