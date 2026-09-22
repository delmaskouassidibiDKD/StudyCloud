import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, HardDrive, Bot, RotateCw, Sparkles, CreditCard, Lock } from 'lucide-react';
import { SubscriptionFormView, SelectedPlan } from './SubscriptionFormView';
import { RenewalFormView } from './RenewalFormView';
import { RenewalSectionView } from './RenewalSectionView';
import { getSubscriptionPlans, SubscriptionPlan } from '../services/api';

interface PricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
  initialTab?: 'storage' | 'ai' | 'renewal';
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
    badge: 'Populaire',
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
    credits_or_words: '100 000 mots IA',
    credits_count: 100000,
    price: 10,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 10, XOF: 6500, EUR: 9.2 },
    yearly_price: 90,
    yearly_discount_pct: 10,
    features: [
      { text: "100 000 mots IA générés par mois", enabled: true },
      { text: "Résumés automatiques de cours et PDF", enabled: true },
      { text: "Création instantanée de cartes mémoires (Flashcards)", enabled: true },
      { text: "Aide aux devoirs et explications pas à pas", enabled: true },
      { text: "Support par e-mail", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 1
  },
  {
    id: 'ai_plan_pro',
    name: 'IA Pro Étudiant',
    badge: 'Populaire',
    description: 'L\'assistant d\'apprentissage complet pour exceller et réussir tous vos examens.',
    credits_or_words: '1 000 000 mots IA',
    credits_count: 1000000,
    price: 32,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 32, XOF: 20000, EUR: 29.5 },
    yearly_price: 290,
    yearly_discount_pct: 10,
    features: [
      { text: "1 000 000 mots IA avec priorité maximale", enabled: true },
      { text: "Génération de Quiz interactifs & examens blancs", enabled: true },
      { text: "Synthèse vocale & lecture audio de vos fiches", enabled: true },
      { text: "Analyse intelligente de documents scannés et photos", enabled: true },
      { text: "Support prioritaire 24/7", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 2
  },
  {
    id: 'ai_plan_master',
    name: 'IA Recherche & Master',
    badge: '',
    description: 'Pour les doctorants, thèses, mémoires volumineux et laboratoires universitaires.',
    credits_or_words: 'Mots IA illimités',
    credits_count: 10000000,
    price: 89,
    primary_currency: 'USD',
    currencies_enabled: ['USD', 'XOF', 'EUR'],
    currency_conversions: { USD: 89, XOF: 55000, EUR: 82 },
    yearly_price: 790,
    yearly_discount_pct: 10,
    features: [
      { text: "Mots IA illimités avec accès modèles avancés", enabled: true },
      { text: "Traitement prioritaire ultra-rapide", enabled: true },
      { text: "Export complet des synthèses & fiches en PDF/Word", enabled: true },
      { text: "Analyse illimitée de livres et thèses entières", enabled: true },
      { text: "Accès API assistante pour vos projets de recherche", enabled: true }
    ],
    is_auto_billing: 0,
    is_active: 1,
    sort_order: 3
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
  const primaryCurr = plan.primary_currency || 'USD';
  const monthlyPrice = Number(plan.price) || 0;
  const discountPct = Number(plan.yearly_discount_pct) || 10;
  const yearlyPrice = Number(plan.yearly_price) > 0
    ? Number(plan.yearly_price)
    : Math.round(monthlyPrice * 12 * (1 - (discountPct / 100)) * 100) / 100;

  const activePrice = isAnnual ? yearlyPrice : monthlyPrice;
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
  const secondaryParts: string[] = [];

  for (const curr of ['XOF', 'USD', 'EUR']) {
    if (enabledCurrs.includes(curr) && curr !== primaryCurr) {
      let rawVal = convObj[curr];
      if (!rawVal) {
        const fallback = calculateConversions(monthlyPrice, primaryCurr);
        rawVal = fallback[curr as keyof typeof fallback];
      }
      const finalVal = isAnnual ? Math.round(rawVal * annualRatio) : rawVal;

      if (curr === 'XOF') {
        secondaryParts.push(`≈ ${finalVal.toLocaleString('fr-FR')} FCFA`);
      } else if (curr === 'USD') {
        secondaryParts.push(`≈ ${finalVal} $`);
      } else if (curr === 'EUR') {
        secondaryParts.push(`≈ ${finalVal} €`);
      }
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
    yearlyPrice,
    monthlyPrice,
    discountPct,
    primaryCurr,
    secondaryString: secondaryParts.join(' • '),
    priceFcfa: finalPriceFcfa
  };
}

export const PricingView: React.FC<PricingViewProps> = ({ onBack, onSelectPlan, initialTab = 'storage' }) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'ai' | 'renewal'>(initialTab);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

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
          // Petit délai fluide pour un rendu agréable de l'animation de chargement
          setTimeout(() => {
            if (isMounted) setLoadingPlans(false);
          }, 250);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Si l'utilisateur clique sur "Commencer" ou choisit un plan, on affiche le formulaire de souscription
  if (selectedPlanForSubscription) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300">
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
      <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300">
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

  // Rendu des cartes squelettes avec animation de pulsation / chargement
  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-6 bg-[#0d1424] border border-slate-800 relative overflow-hidden shadow-2xl animate-pulse flex flex-col justify-between min-h-[510px]"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-28 bg-slate-800 rounded-lg"></div>
              {i === 2 && <div className="h-5 w-20 bg-amber-500/20 rounded-full border border-amber-500/30"></div>}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="h-3 w-4/5 bg-slate-800/80 rounded"></div>
              <div className="h-3 w-3/5 bg-slate-800/60 rounded"></div>
            </div>

            {/* Boîte de prix factice */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/90 space-y-2">
              <div className="h-8 w-36 bg-slate-800 rounded"></div>
              <div className="h-3 w-48 bg-amber-500/20 rounded"></div>
            </div>

            {/* Ligne verrouillée factice */}
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500/40 rounded-full shrink-0"></div>
              <div className="h-3.5 w-44 bg-orange-500/30 rounded"></div>
            </div>

            {/* Avantages factices */}
            <div className="space-y-2.5 pt-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-slate-800 shrink-0"></div>
                  <div className="h-3 bg-slate-800 rounded" style={{ width: `${55 + (j * 10)}%` }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Bouton factice */}
          <div className="h-12 w-full bg-slate-800 rounded-xl mt-6"></div>
        </div>
      ))}
    </div>
  );

  // Rendu fidèle et identique aux cartes du tableau de bord
  const renderCard = (plan: SubscriptionPlan, type: 'storage' | 'ai') => {
    const isPopular = !!(plan.badge && plan.badge.trim());
    const isAnnual = billingCycle === 'annual';
    const pricing = getCardPricingAndConversions(plan, isAnnual);

    // Première ligne verrouillée (stockage ou IA)
    const lockedPerk = type === 'ai'
      ? (plan.credits_or_words || `${(plan.credits_count || 100000).toLocaleString('fr-FR')} mots IA / mois`)
      : (plan.storage_amount 
          ? (plan.storage_mb && plan.storage_mb > 0 
              ? `${plan.storage_amount} supplémentaires (+ ${plan.storage_mb.toLocaleString('fr-FR')} Mo)` 
              : `${plan.storage_amount} supplémentaires`)
          : `${plan.storage_mb ? (plan.storage_mb / 1024) : 10} Go supplémentaires`);

    // Autres avantages filtrés
    const allFeatures = parsePlanFeatures(plan.features);
    const activeFeatures = allFeatures.filter(f => {
      if (f.enabled === false) return false;
      const t = (f.text || '').toLowerCase().trim();
      if (type === 'storage' && (t === '10 go' || t === '50 go' || t === '200 go')) return false;
      return true;
    });

    const isAuto = plan.is_auto_billing === 1;

    return (
      <div 
        key={plan.id}
        className={`relative flex flex-col justify-between rounded-2xl p-6 border shadow-2xl transition-all duration-300 transform hover:-translate-y-1 animate-in fade-in zoom-in-95 duration-200 ${
          isPopular
            ? 'border-orange-500/80 bg-[#111927] shadow-[0_0_30px_rgba(249,115,22,0.2)]'
            : 'border-slate-800 bg-[#0d1424]'
        }`}
      >
        <div className="space-y-3.5">
          {/* En-tête : Titre & Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h5 className="text-xl font-black text-white tracking-wide">
              {plan.name}
            </h5>
            {isPopular && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{plan.badge}</span>
              </span>
            )}
          </div>

          {/* Description */}
          {plan.description && (
            <p className="text-xs text-slate-400 leading-relaxed min-h-[32px]">
              {plan.description}
            </p>
          )}

          {/* Boîte de prix & devises secondaires */}
          <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 space-y-1.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {getCurrencySymbol(pricing.primaryCurr)} {pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {isAnnual ? '/ an' : '/ mois'}
              </span>
              {isAnnual && pricing.discountPct > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  -{pricing.discountPct}%
                </span>
              )}
            </div>

            {/* Devises secondaires en petit */}
            {pricing.secondaryString && (
              <div className="text-[11px] font-semibold text-amber-400/90 pt-0.5">
                {pricing.secondaryString}
              </div>
            )}
          </div>

          {/* Liste des avantages */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Ce qui est inclus :
            </p>

            {/* 1ère ligne verrouillée (stockage ou IA avec 🔒) */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-200 text-xs font-bold shadow-xs">
              <Lock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>{lockedPerk}</span>
            </div>

            {/* Autres avantages de la carte */}
            <div className="space-y-2 pt-1">
              {activeFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                  <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bouton d'action : Commencer (Paiement Manuel) OU S'abonner (Abonnement Automatique) */}
        <div className="pt-5 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedPlanForSubscription({
              name: `${plan.name} ${type === 'ai' ? 'IA' : 'Stockage'}`,
              type: type,
              storageDisplay: lockedPerk,
              priceDisplay: `${getCurrencySymbol(pricing.primaryCurr)} ${pricing.primaryCurr === 'XOF' ? pricing.activePrice.toLocaleString('fr-FR') : pricing.activePrice} / ${isAnnual ? 'an' : 'mois'} ${pricing.secondaryString ? '(' + pricing.secondaryString + ')' : ''}`,
              price: pricing.activePrice,
              priceFcfa: pricing.priceFcfa,
              currency: getCurrencySymbol(pricing.primaryCurr),
              billingCycle: billingCycle,
              mb: plan.storage_mb,
              words: plan.credits_count
            })}
            className={`w-full py-3.5 px-4 font-extrabold text-sm rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
              isAuto
                ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-950/40'
                : 'bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-orange-950/40'
            }`}
          >
            {isAuto ? (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>S'abonner</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 text-white" />
                <span>Commencer</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300">
      
      {/* ========================================================================= */}
      {/* BARRE SUPÉRIEURE FIXE / COLLÉE AU HAUT : RETOUR, MENUS ET FACTURATION     */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-[#F5F0E8]/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 border-b-2 border-[#2D4A3E]/15 dark:border-[#1e293b] shadow-xs">
        
        {/* Bouton Retour (Gauche) */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        {/* Boutons pour changer de menu au centre */}
        <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-1 rounded-2xl border-2 border-[#D4C9B5] dark:border-[#1e293b] flex items-center gap-1 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'storage'
                ? 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white shadow-sm'
                : 'text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white hover:bg-[#D4C9B5]/40 dark:hover:bg-slate-800'
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
                ? 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white shadow-sm'
                : 'text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white hover:bg-[#D4C9B5]/40 dark:hover:bg-slate-800'
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
                ? 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white shadow-sm'
                : 'text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white hover:bg-[#D4C9B5]/40 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Renouveler mon abonnement</span>
            <span className="md:hidden">Renouveler</span>
          </button>
        </div>

        {/* Toggle Facturation Ans / Mois (Droite) */}
        <div className="shrink-0">
          {activeTab !== 'renewal' ? (
            <div className="bg-[#E8DFD0] dark:bg-[#1e293b] rounded-full p-1 flex items-center shadow-xs border-2 border-[#1c1917] dark:border-[#334155]">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-[#F5F0E8] dark:bg-[#283852] text-[#2D4A3E] dark:text-white shadow-xs'
                    : 'bg-transparent text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white'
                }`}
              >
                <span>Ans</span>
                <span className="bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                  -10%
                </span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[#F5F0E8] dark:bg-[#283852] text-[#2D4A3E] dark:text-white shadow-xs'
                    : 'bg-transparent text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white'
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

      <div className="w-full max-w-[1250px] mx-auto px-4 pt-6 sm:pt-8">
        {/* Header Section (Uniquement sur Stockage et IA) */}
        {activeTab !== 'renewal' && (
          <div className="text-center pb-8 max-w-5xl mx-auto">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-sans font-black text-[#2D4A3E] dark:text-white mb-3 leading-tight tracking-tight">
              Choisissez votre formule
            </h1>
            <p className="text-sm sm:text-base font-sans font-medium text-[#5C6B5A] dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
              Des tarifs flexibles synchronisés en direct avec votre plateforme d'apprentissage StudyCloud.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ANIMATION DE CHARGEMENT OU GRILLE DES FORFAITS SYNCHRONISÉE               */}
        {/* ========================================================================= */}
        {loadingPlans ? (
          renderSkeletonCards()
        ) : (
          <>
            {/* 1. SECTION : ABONNEMENTS STOCKAGE (DYNAMIQUES DEPUIS LA BASE DE DONNÉES)  */}
            {activeTab === 'storage' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
                {dbStoragePlans.map(plan => renderCard(plan, 'storage'))}
              </div>
            )}

            {/* 2. SECTION : ASSISTANTE STUDYCLOUD (DYNAMIQUES DEPUIS LA BASE DE DONNÉES) */}
            {activeTab === 'ai' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
                {dbAiPlans.map(plan => renderCard(plan, 'ai'))}
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* 3. SECTION : RENOUVELER MON ABONNEMENT (DIVISÉE EN 2 VOLETS)               */}
        {/* ========================================================================= */}
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
  );
};
