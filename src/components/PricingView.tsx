import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, HardDrive, Bot, RotateCw } from 'lucide-react';
import { SubscriptionFormView, SelectedPlan } from './SubscriptionFormView';
import { RenewalFormView } from './RenewalFormView';
import { RenewalSectionView } from './RenewalSectionView';
import { getSubscriptionPlans, SubscriptionPlan } from '../services/api';

interface PricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
  initialTab?: 'storage' | 'ai' | 'renewal';
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

function getCardPricingAndConversions(plan: SubscriptionPlan, isAnnual: boolean) {
  const isOneTime = plan.pricing_model === 'one_time' || plan.pricing_model === 'pack';
  if (isOneTime) {
    isAnnual = false;
  }
  const primaryCurr = plan.primary_currency || 'USD';
  const monthlyPrice = Number(plan.price) || 0;
  const discountPct = Number(plan.yearly_discount_pct) || 10;
  let fullYearlyPrice = monthlyPrice * 12;
  const yearlyPrice = Number(plan.yearly_price) > 0
    ? Number(plan.yearly_price)
    : Math.round(monthlyPrice * 12 * (1 - (discountPct / 100)) * 100) / 100;

  const activePrice = isAnnual ? yearlyPrice : monthlyPrice;
  if (isAnnual && fullYearlyPrice <= activePrice && discountPct > 0) {
    fullYearlyPrice = Math.round(activePrice / (1 - (discountPct / 100)));
  }
  const annualRatio = monthlyPrice > 0 ? (yearlyPrice / monthlyPrice) : (12 * (1 - (discountPct / 100)));

  let convObj: Record<string, number> = {};
  if (typeof plan.currency_conversions === 'string') {
    try {
      convObj = JSON.parse(plan.currency_conversions);
    } catch (e) {}
  } else if (typeof plan.currency_conversions === 'object' && plan.currency_conversions !== null) {
    convObj = plan.currency_conversions as Record<string, number>;
  }

  const enabledCurrs = parsePlanCurrencies(plan.currencies_enabled);
  const secondaryParts: { curr: string; fullVal?: number; finalVal: number; formatted: string; fullFormatted?: string }[] = [];

  for (const curr of ['XOF', 'USD', 'EUR']) {
    if (enabledCurrs.includes(curr) && curr !== primaryCurr) {
      let rawVal = convObj[curr];
      if (!rawVal) {
        const fallback = calculateConversions(monthlyPrice, primaryCurr);
        rawVal = fallback[curr as keyof typeof fallback];
      }
      const finalVal = isAnnual ? Math.round(rawVal * annualRatio) : rawVal;
      const fullVal = isAnnual ? Math.round(rawVal * 12) : rawVal;

      let suffix = '';
      if (curr === 'XOF') suffix = 'FCFA';
      else if (curr === 'USD') suffix = '$';
      else if (curr === 'EUR') suffix = '€';

      const formatted = curr === 'XOF' ? `${finalVal.toLocaleString('fr-FR')} ${suffix}` : `${finalVal} ${suffix}`;
      const fullFormatted = curr === 'XOF' ? `${fullVal.toLocaleString('fr-FR')} ${suffix}` : `${fullVal} ${suffix}`;

      secondaryParts.push({
        curr,
        fullVal,
        finalVal,
        formatted,
        fullFormatted
      });
    }
  }

  let finalPriceFcfa: number;
  if (primaryCurr === 'XOF') {
    finalPriceFcfa = activePrice;
  } else {
    const baseFcfa = convObj.XOF || Math.round(monthlyPrice * 650);
    finalPriceFcfa = isAnnual ? Math.round(baseFcfa * annualRatio) : baseFcfa;
  }

  return {
    activePrice,
    fullYearlyPrice,
    yearlyPrice,
    monthlyPrice,
    discountPct,
    primaryCurr,
    secondaryParts,
    secondaryString: secondaryParts.map(s => `= ${s.formatted}`).join(' • '),
    priceFcfa: finalPriceFcfa,
    isOneTime
  };
}

export const PricingView: React.FC<PricingViewProps> = ({ 
  onBack, 
  onSelectPlan, 
  initialTab = 'storage',
  isEmbeddedInSettings = false 
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'ai' | 'renewal'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Présentation par MOIS par défaut demandée par l'utilisateur
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('monthly');

  const [dbStoragePlans, setDbStoragePlans] = useState<SubscriptionPlan[]>([]);
  const [dbAiPlans, setDbAiPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);

  // État du plan sélectionné pour afficher le menu de souscription
  const [selectedPlanForSubscription, setSelectedPlanForSubscription] = useState<SelectedPlan | null>(null);

  // État pour afficher le menu complet de renouvellement
  const [selectedPlanForRenewal, setSelectedPlanForRenewal] = useState<any | null>(null);
  const [renewalRefreshKey, setRenewalRefreshKey] = useState<number>(0);

  // Charger dynamiquement les cartes de forfaits depuis Cloudflare D1 avec horodatage anti-cache
  useEffect(() => {
    let isMounted = true;
    setLoadingPlans(true);

    getSubscriptionPlans()
      .then((res) => {
        if (isMounted && res && res.success) {
          const sPlans = Array.isArray(res.storagePlans) ? res.storagePlans : [];
          const aPlans = Array.isArray(res.aiPlans) ? res.aiPlans : [];
          setDbStoragePlans(sPlans);
          setDbAiPlans(aPlans);

          // Si l'administrateur a créé uniquement des cartes IA et aucun stockage,
          // basculer intelligemment sur l'onglet 'ai' pour que la carte s'affiche directement
          if (sPlans.length === 0 && aPlans.length > 0 && activeTab === 'storage') {
            setActiveTab('ai');
          }
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

  // Si l'utilisateur clique sur "Commencer" ou choisit un plan, on affiche le formulaire de souscription
  if (selectedPlanForSubscription) {
    return (
      <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-50 w-full md:w-[calc(100%-16rem)] h-full bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300`}>
        <SubscriptionFormView
          plan={selectedPlanForSubscription}
          onBack={() => setSelectedPlanForSubscription(null)}
          onSuccess={() => onSelectPlan(selectedPlanForSubscription.name)}
          onGoToRenewal={() => {
            setSelectedPlanForSubscription(null);
            setActiveTab('renewal');
          }}
        />
      </div>
    );
  }

  // Si l'utilisateur clique sur "Renouveler l'abonnement", on affiche le formulaire de renouvellement
  if (selectedPlanForRenewal) {
    return (
      <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-50 w-full md:w-[calc(100%-16rem)] h-full bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300`}>
        <RenewalFormView
          subscription={selectedPlanForRenewal}
          onBack={() => {
            setSelectedPlanForRenewal(null);
            setRenewalRefreshKey(k => k + 1);
          }}
          onSuccess={() => {
            setSelectedPlanForRenewal(null);
            setActiveTab('renewal');
            setRenewalRefreshKey(k => k + 1);
          }}
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
    const isAnnual = isOneTime ? false : billingCycle === 'annual';
    const pricing = getCardPricingAndConversions(plan, isAnnual);

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

    const isAuto = plan.is_auto_billing === 1;

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
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {isOneTime && (
                <span className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  ⚡ Pack
                </span>
              )}
              {isPopular && (
                <span className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {plan.badge}
                </span>
              )}
            </div>
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
              {/* Vrai prix annuel barré si paiement par an avec réduction (uniquement abonnement) */}
              {!isOneTime && isAnnual && (pricing.fullYearlyPrice > pricing.activePrice || pricing.discountPct > 0) && (
                <span className={`text-lg sm:text-2xl font-semibold line-through decoration-rose-500/80 decoration-2 opacity-65 mr-1 ${isPopular ? 'text-slate-400' : 'text-slate-400'}`}>
                  {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? (pricing.fullYearlyPrice || Math.round(pricing.activePrice * 1.15)).toLocaleString('fr-FR') : (pricing.fullYearlyPrice || Math.round(pricing.activePrice * 1.15))}
                </span>
              )}
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              {!isOneTime && (
                <span className={`text-sm sm:text-base font-medium ${isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {isAnnual ? '/an' : '/mois'}
                </span>
              )}
              {!isOneTime && isAnnual && pricing.discountPct > 0 && (
                <span className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isPopular ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'}`}>
                  -{pricing.discountPct}%
                </span>
              )}
            </div>

            {/* Conversions secondaires en dessous (= 6 500 FCFA • = 9.2 €) */}
            {pricing.secondaryParts && pricing.secondaryParts.length > 0 && (
              <div className={`text-xs font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${isPopular ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {pricing.secondaryParts.map((sec, idx) => (
                  <span key={sec.curr} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="opacity-40">•</span>}
                    {!isOneTime && isAnnual && sec.fullVal && (sec.fullVal > sec.finalVal || pricing.discountPct > 0) && (
                      <span className="line-through decoration-rose-500/70 decoration-1 opacity-65">{sec.fullFormatted}</span>
                    )}
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

        {/* Bouton d'action : Commencer (Paiement Manuel) OU S'abonner (Abonnement Automatique) */}
        <button
          onClick={() => setSelectedPlanForSubscription({
            name: `${plan.name} ${type === 'ai' ? 'IA' : 'Stockage'}`,
            type: type,
            storageDisplay: lockedPerkText,
            priceDisplay: isOneTime 
              ? `${getCurrencySymbol(pricing.primaryCurr)} ${pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice} ${pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''}`
              : `${getCurrencySymbol(pricing.primaryCurr)} ${pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice} / ${isAnnual ? 'an' : 'mois'} ${pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''}`,
            price: pricing.activePrice,
            priceFcfa: pricing.priceFcfa,
            currency: getCurrencySymbol(pricing.primaryCurr),
            billingCycle: isOneTime ? 'one_time' : billingCycle,
            mb: plan.storage_mb,
            words: plan.credits_count
          })}
          className={`w-full py-2.5 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs text-center active:scale-[0.98] ${
            isPopular
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/30'
              : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
          }`}
        >
          {isAuto ? "S'abonner" : "Commencer"}
        </button>
      </div>
    );
  };

  return (
    <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-40 w-full md:w-[calc(100%-16rem)] ${isEmbeddedInSettings ? 'h-screen' : 'h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'} flex flex-col bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-hidden select-none transition-colors duration-300`}>
      
      {/* ========================================================================= */}
      {/* 1. BARRE FIXE IMMOBILE (Responsive : 2 rangées propres sur mobile)        */}
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

        {/* Boutons pour changer de menu (Sur mobile : rangée pleine largeur sans coupure ; sur PC : au centre) */}
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
            onClick={() => setActiveTab('renewal')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeTab === 'renewal'
                ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
            }`}
          >
            <RotateCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden md:inline">Renouveler mon abonnement</span>
            <span className="md:hidden truncate">Renouveler</span>
          </button>
        </div>

        {/* Toggle Facturation Ans / Mois (En haut à droite sur mobile et desktop) */}
        <div className="order-2 md:order-3 shrink-0">
          {activeTab !== 'renewal' ? (
            <div className="bg-slate-100 dark:bg-slate-900 rounded-full p-0.5 sm:p-1 flex items-center border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Ans</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${billingCycle === 'annual' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
                  -10%
                </span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Mois</span>
              </button>
            </div>
          ) : (
            <div className="hidden md:block md:w-20"></div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ZONE DE CONTENU QUI DÉFILE (Seule cette partie scroll)                 */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-5 sm:pt-8 pb-32">
        <div className="w-full max-w-[1250px] mx-auto">
          {/* Header Section (Uniquement sur Stockage et IA) */}
          {activeTab !== 'renewal' && (
            <div className="text-center pb-6 sm:pb-8 max-w-5xl mx-auto">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 leading-tight">
                Choisissez votre formule
              </h1>
              <p className="text-xs sm:text-base font-sans text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
                Des tarifs simples, transparents et adaptés à vos objectifs.
              </p>
            </div>
          )}

          {/* Animation de chargement squelette ou affichage des cartes */}
          {loadingPlans ? (
            renderSkeletonCards()
          ) : (
            <>
              {/* 1. SECTION : ABONNEMENTS STOCKAGE (DYNAMIQUES DEPUIS LA BASE DE DONNÉES)  */}
              {activeTab === 'storage' && (
                dbStoragePlans.filter(plan => plan.is_active !== 0).length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-1 sm:px-2">
                    {dbStoragePlans.filter(plan => plan.is_active !== 0).map(plan => renderCard(plan, 'storage'))}
                  </div>
                ) : (
                  <div className="col-span-full py-14 text-center bg-white dark:bg-[#111827] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 sm:p-8 max-w-xl mx-auto mb-20 shadow-xs">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">💾</div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucune offre de stockage pour le moment</h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Les cartes d'abonnement de stockage créées dans le tableau de bord administrateur s'afficheront ici automatiquement.</p>
                  </div>
                )
              )}

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

          {/* 3. SECTION : RENOUVELER MON ABONNEMENT */}
          {activeTab === 'renewal' && (
            <RenewalSectionView
              key={renewalRefreshKey}
              onGoToStorage={() => setActiveTab('storage')}
              onSelectPlan={onSelectPlan}
              onStartRenewal={(sub) => setSelectedPlanForRenewal(sub)}
            />
          )}
        </div>
      </div>

    </div>
  );
};
