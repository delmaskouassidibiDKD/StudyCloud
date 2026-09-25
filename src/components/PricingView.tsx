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

const DEFAULT_STORAGE_PLANS: SubscriptionPlan[] = [
  {
    id: 'storage_plan_basique',
    name: 'Basique',
    badge: '',
    description: 'Pour les particuliers et petites équipes qui débutent.',
    storage_amount: '10 Go',
    storage_mb: 10240,
    price: 10,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 10, XOF: 6500, EUR: 9.2 },
    yearly_price: 90,
    yearly_discount_pct: 10,
    features: [
      { text: "10 Go de stockage cloud haute vitesse", enabled: true },
      { text: "Messagerie d'équipe et partage de fichiers", enabled: true },
      { text: "Fil d'activité et aperçu des projets", enabled: true },
      { text: "Accès mobile et bureau", enabled: true },
      { text: "Support par e-mail", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 1
  },
  {
    id: 'storage_plan_pro',
    name: 'Pro',
    badge: 'POPULAIRE',
    description: 'Pour les professionnels et étudiants avancés.',
    storage_amount: '50 Go',
    storage_mb: 51200,
    price: 32,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 32, XOF: 20000, EUR: 29.5 },
    yearly_price: 290,
    yearly_discount_pct: 10,
    features: [
      { text: "50 Go de stockage cloud haute vitesse", enabled: true },
      { text: "Support prioritaire 24/7", enabled: true },
      { text: "Analyses avancées et rapports", enabled: true },
      { text: "Collaboration en temps réel illimitée", enabled: true },
      { text: "Domaine personnalisé", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 2
  },
  {
    id: 'storage_plan_entreprise',
    name: 'Entreprise',
    badge: '',
    description: 'Pour les universités, laboratoires et grandes équipes.',
    storage_amount: '200 Go',
    storage_mb: 204800,
    price: 89,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 89, XOF: 55000, EUR: 82 },
    yearly_price: 790,
    yearly_discount_pct: 10,
    features: [
      { text: "200 Go de stockage cloud haute vitesse", enabled: true },
      { text: "Sécurité renforcée et SSO", enabled: true },
      { text: "Gestionnaire de compte dédié", enabled: true },
      { text: "SLA garanti 99.9%", enabled: true },
      { text: "Formations personnalisées", enabled: true },
      { text: "Facturation centralisée", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 3
  }
];

const DEFAULT_AI_PLANS: SubscriptionPlan[] = [
  {
    id: 'ai_plan_basique',
    name: 'IA Basique',
    badge: '',
    description: 'Pour réviser, poser des questions et comprendre rapidement vos cours au quotidien.',
    credits_or_words: '100 000 crédits IA',
    credits_count: 100000,
    price: 10,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 10, XOF: 6500, EUR: 9.2 },
    yearly_price: 90,
    yearly_discount_pct: 10,
    features: [
      { text: "100 000 crédits IA par mois", enabled: true },
      { text: "Résumés automatiques de cours et PDF", enabled: true },
      { text: "Création instantanée de cartes mémoires (Flashcards)", enabled: true },
      { text: "Aide aux devoirs et explications pas à pas", enabled: true },
      { text: "Support par e-mail", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 1,
    pricing_model: 'subscription'
  },
  {
    id: 'ai_plan_pro',
    name: 'IA Pro Étudiant',
    badge: 'Populaire',
    description: 'L\'assistant d\'apprentissage complet pour exceller et réussir tous vos examens.',
    credits_or_words: '1 000 000 crédits IA',
    credits_count: 1000000,
    price: 32,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 32, XOF: 20000, EUR: 29.5 },
    yearly_price: 290,
    yearly_discount_pct: 10,
    features: [
      { text: "1 000 000 crédits IA avec priorité maximale", enabled: true },
      { text: "Génération de Quiz interactifs & examens blancs", enabled: true },
      { text: "Synthèse vocale & lecture audio de vos fiches", enabled: true },
      { text: "Analyse intelligente de documents scannés et photos", enabled: true },
      { text: "Support prioritaire 24/7", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 2,
    pricing_model: 'subscription'
  },
  {
    id: 'ai_plan_master',
    name: 'IA Recherche & Master',
    badge: '',
    description: 'Pour les doctorants, thèses, mémoires volumineux et laboratoires universitaires.',
    credits_or_words: 'Crédits IA illimités',
    credits_count: 10000000,
    price: 89,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 89, XOF: 55000, EUR: 82 },
    yearly_price: 790,
    yearly_discount_pct: 10,
    features: [
      { text: "Crédits IA illimités avec accès modèles avancés", enabled: true },
      { text: "Traitement prioritaire ultra-rapide", enabled: true },
      { text: "Export complet des synthèses & fiches en PDF/Word", enabled: true },
      { text: "Analyse illimitée de livres et thèses entières", enabled: true },
      { text: "Accès API assistante pour vos projets de recherche", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 3,
    pricing_model: 'subscription'
  }
];

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

  const [dbStoragePlans, setDbStoragePlans] = useState<SubscriptionPlan[]>(DEFAULT_STORAGE_PLANS);
  const [dbAiPlans, setDbAiPlans] = useState<SubscriptionPlan[]>(DEFAULT_AI_PLANS);
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
          if (res.storagePlans && res.storagePlans.length > 0) {
            setDbStoragePlans(res.storagePlans);
          }
          if (res.aiPlans && res.aiPlans.length > 0) {
            setDbAiPlans(res.aiPlans);
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
      <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-50 w-full md:w-[calc(100%-16rem)] h-full bg-[#F5F0E8] text-[#2D4A3E] overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300`}>
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
      <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-50 w-full md:w-[calc(100%-16rem)] h-full bg-[#F5F0E8] text-[#2D4A3E] overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300`}>
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

  // Animation de chargement avec cartes squelettes aux couleurs du thème
  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
      {[1, 2, 3].map((i) => {
        const isMiddle = i === 2;
        return (
          <div
            key={i}
            className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative max-w-[380px] w-full mx-auto shadow-md animate-pulse min-h-[520px] ${
              isMiddle
                ? 'bg-[#2D4A3E] border-2 border-[#2D4A3E]'
                : 'bg-[#E8DFD0] border border-[#D4C9B5]'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={`h-8 w-28 rounded-lg ${isMiddle ? 'bg-[#E8DFD0]/30' : 'bg-[#D4C9B5]'}`}></div>
                {isMiddle && <div className="h-6 w-20 rounded-full bg-[#C9B896]/60"></div>}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className={`h-3.5 w-4/5 rounded ${isMiddle ? 'bg-[#E8DFD0]/20' : 'bg-[#D4C9B5]/80'}`}></div>
                <div className={`h-3.5 w-3/5 rounded ${isMiddle ? 'bg-[#E8DFD0]/15' : 'bg-[#D4C9B5]/60'}`}></div>
              </div>

              {/* Prix squelette */}
              <div className="space-y-2 pt-2">
                <div className={`h-12 w-36 rounded ${isMiddle ? 'bg-[#E8DFD0]/30' : 'bg-[#D4C9B5]'}`}></div>
                <div className={`h-3 w-48 rounded ${isMiddle ? 'bg-[#E8DFD0]/20' : 'bg-[#D4C9B5]/70'}`}></div>
              </div>

              <div className={`h-0.5 w-full my-4 ${isMiddle ? 'bg-[#E8DFD0]/20' : 'bg-[#D4C9B5]'}`}></div>

              {/* Lignes d'avantages squelettes */}
              <div className="space-y-3 pt-1">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full shrink-0 ${isMiddle ? 'bg-[#C9B896]' : 'bg-[#5C6B5A]'}`}></div>
                    <div className={`h-3 rounded ${isMiddle ? 'bg-[#E8DFD0]/25' : 'bg-[#D4C9B5]'}`} style={{ width: `${55 + (j * 7)}%` }}></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bouton squelette */}
            <div className={`h-11 w-full rounded-lg mt-6 ${isMiddle ? 'bg-[#C9B896]/70' : 'bg-[#C9B896]/80'}`}></div>
          </div>
        );
      })}
    </div>
  );

  // Rendu des cartes avec les couleurs authentiques du thème (Beige, Vert Forêt & Or)
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
        className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative max-w-[380px] w-full mx-auto shadow-md transition-all duration-300 transform hover:-translate-y-1 animate-in fade-in zoom-in-95 duration-200 ${
          isPopular
            ? 'bg-[#2D4A3E] border-2 border-[#2D4A3E] text-[#F5F0E8]'
            : 'bg-[#E8DFD0] border border-[#D4C9B5] text-[#2D4A3E]'
        }`}
      >
        <div>
          {/* En-tête : Titre & Badge POPULAIRE */}
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-2xl sm:text-3xl font-serif font-normal ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E]'}`}>
              {plan.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {isOneTime && (
                <span className="bg-cyan-700 dark:bg-cyan-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  ⚡ Pack
                </span>
              )}
              {isPopular && (
                <span className="bg-[#C9B896] text-[#2D4A3E] text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  {plan.badge}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-xs sm:text-sm font-sans mb-4 sm:mb-6 leading-relaxed ${isPopular ? 'text-[#E8DFD0]/90' : 'text-[#5C6B5A]'}`}>
              {plan.description}
            </p>
          )}

          {/* Bloc Prix Principal & Conversions secondaires */}
          <div className="mb-4 sm:mb-6">
            <div className={`flex items-baseline flex-wrap gap-x-2.5 gap-y-1 ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E]'}`}>
              {/* Vrai prix annuel barré si paiement par an avec réduction (uniquement abonnement) */}
              {!isOneTime && isAnnual && (pricing.fullYearlyPrice > pricing.activePrice || pricing.discountPct > 0) && (
                <span className={`text-2xl sm:text-3xl font-serif font-semibold line-through decoration-rose-500/80 decoration-2 opacity-75 mr-1 ${isPopular ? 'text-[#E8DFD0]' : 'text-slate-500'}`}>
                  {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? (pricing.fullYearlyPrice || Math.round(pricing.activePrice * 1.15)).toLocaleString('fr-FR') : (pricing.fullYearlyPrice || Math.round(pricing.activePrice * 1.15))}
                </span>
              )}
              <span className="text-5xl sm:text-6xl font-serif font-normal">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              {!isOneTime && (
                <span className="text-lg sm:text-xl font-sans ml-1 opacity-90">
                  {isAnnual ? '/an' : '/mois'}
                </span>
              )}
              {!isOneTime && isAnnual && pricing.discountPct > 0 && (
                <span className={`ml-1 text-xs font-black px-2 py-0.5 rounded-full ${isPopular ? 'bg-[#C9B896] text-[#2D4A3E]' : 'bg-[#2D4A3E] text-[#F5F0E8]'}`}>
                  -{pricing.discountPct}%
                </span>
              )}
            </div>

            {/* Conversions secondaires en dessous (= 6 500 FCFA • = 9.2 €) */}
            {pricing.secondaryParts && pricing.secondaryParts.length > 0 && (
              <div className={`text-xs font-semibold mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${isPopular ? 'text-[#E8DFD0]/90' : 'text-[#5C6B5A]'}`}>
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
              <div className={`text-[11px] font-bold mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md ${isPopular ? 'bg-[#C9B896]/20 text-[#C9B896] border border-[#C9B896]/30' : 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40'}`}>
                <span>⚡ Paiement unique • Crédits utilisables à votre rythme</span>
              </div>
            )}
          </div>

          {/* Ligne de séparation */}
          <div className={`h-0.5 w-full mb-4 sm:mb-6 ${isPopular ? 'bg-[#E8DFD0]/20' : 'bg-[#D4C9B5]'}`}></div>

          {/* Avantages inclus */}
          <p className={`text-xs sm:text-sm font-semibold mb-3 sm:mb-4 ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E]'}`}>
            Ce qui est inclus :
          </p>

          <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
            {/* Première ligne verrouillée et mise en valeur */}
            <li className="flex items-start gap-2.5 sm:gap-3">
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                isPopular ? 'bg-[#C9B896] text-[#2D4A3E]' : 'bg-[#5C6B5A] text-[#F5F0E8]'
              }`}>
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </div>
              <span className={`text-xs sm:text-sm font-bold ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E]'}`}>
                {lockedPerkText}
              </span>
            </li>

            {/* Autres avantages de la formule */}
            {activeFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isPopular ? 'bg-[#C9B896] text-[#2D4A3E]' : 'bg-[#5C6B5A] text-[#F5F0E8]'
                }`}>
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className={`text-xs sm:text-sm ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E]'}`}>
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
          className={`w-full py-3 font-semibold text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center active:scale-[0.98] ${
            isPopular
              ? 'bg-[#C9B896] hover:bg-[#B8A785] text-[#2D4A3E] font-bold shadow-md'
              : 'bg-[#C9B896] hover:bg-[#B8A785] text-[#2D4A3E] font-bold border border-[#B8A785]'
          }`}
        >
          {isAuto ? "S'abonner" : "Commencer"}
        </button>
      </div>
    );
  };

  return (
    <div className={`fixed inset-x-0 bottom-0 ${isEmbeddedInSettings ? 'top-0 md:top-0' : 'top-[64px] md:top-[68px]'} left-0 md:left-64 z-40 w-full md:w-[calc(100%-16rem)] ${isEmbeddedInSettings ? 'h-screen' : 'h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'} flex flex-col bg-[#F5F0E8] text-[#2D4A3E] overflow-hidden select-none transition-colors duration-300`}>
      
      {/* ========================================================================= */}
      {/* 1. BARRE FIXE IMMOBILE (Ne bouge JAMAIS quand on fait défiler la page)     */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 z-50 sticky top-0 bg-[#F5F0E8] px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 border-b-2 border-[#2D4A3E]/15 shadow-xs">
        
        {/* Bouton Retour (Gauche) */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] font-bold text-xs rounded-xl border-2 border-[#2D4A3E] shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E]" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        {/* Boutons pour changer de menu au centre */}
        <div className="bg-[#E8DFD0] p-1 rounded-2xl border-2 border-[#D4C9B5] flex items-center gap-1 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'storage'
                ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-sm'
                : 'text-[#5C6B5A] hover:text-[#2D4A3E] hover:bg-[#D4C9B5]/40'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Abonnements stockage</span>
            <span className="md:hidden">Stockage</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'ai'
                ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-sm'
                : 'text-[#5C6B5A] hover:text-[#2D4A3E] hover:bg-[#D4C9B5]/40'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Abonnement assistante StudyCloud</span>
            <span className="md:hidden">Assistante IA</span>
          </button>

          <button
            onClick={() => setActiveTab('renewal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'renewal'
                ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-sm'
                : 'text-[#5C6B5A] hover:text-[#2D4A3E] hover:bg-[#D4C9B5]/40'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Renouveler mon abonnement</span>
            <span className="md:hidden">Renouveler</span>
          </button>
        </div>

        {/* Toggle Facturation Ans / Mois (Droite) : Mois sélectionné par défaut */}
        <div className="shrink-0">
          {activeTab !== 'renewal' ? (
            <div className="bg-[#E8DFD0] rounded-full p-1 flex items-center shadow-xs border-2 border-[#1c1917]">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-xs'
                    : 'bg-transparent text-[#5C6B5A] hover:text-[#2D4A3E]'
                }`}
              >
                <span>Ans</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${billingCycle === 'annual' ? 'bg-[#C9B896] text-[#2D4A3E]' : 'bg-[#2D4A3E] text-[#F5F0E8]'}`}>
                  -10%
                </span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-xs'
                    : 'bg-transparent text-[#5C6B5A] hover:text-[#2D4A3E]'
                }`}
              >
                <span>Mois</span>
              </button>
            </div>
          ) : (
            <div className="w-6 sm:w-16"></div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ZONE DE CONTENU QUI DÉFILE (Seule cette partie scroll)                 */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 sm:pt-8 pb-32">
        <div className="w-full max-w-[1250px] mx-auto">
          {/* Header Section (Uniquement sur Stockage et IA) */}
          {activeTab !== 'renewal' && (
            <div className="text-center pb-8 max-w-5xl mx-auto">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-normal text-[#2D4A3E] mb-3 leading-tight">
                Choisissez votre formule
              </h1>
              <p className="text-sm sm:text-lg md:text-xl font-sans text-[#5C6B5A] max-w-xl mx-auto leading-relaxed px-2">
                Des tarifs abordables et adaptés à vos objectifs.
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
                  {dbStoragePlans.filter(plan => plan.is_active !== 0).map(plan => renderCard(plan, 'storage'))}
                </div>
              )}

              {/* 2. SECTION : ASSISTANTE STUDYCLOUD (DYNAMIQUES DEPUIS LA BASE DE DONNÉES) */}
              {activeTab === 'ai' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
                  {dbAiPlans.filter(plan => plan.is_active !== 0).map(plan => renderCard(plan, 'ai'))}
                </div>
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
