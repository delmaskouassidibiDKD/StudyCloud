import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, HardDrive, Bot, RotateCw } from 'lucide-react';
import { SubscriptionFormView, SelectedPlan } from './SubscriptionFormView';
import { RenewalFormView } from './RenewalFormView';
import { RenewalSectionView } from './RenewalSectionView';
import { getSubscriptionPlans, SubscriptionPlan } from '../services/api';

interface SettingsPricingViewProps {
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
    storage_amount: '10 Go supplémentaires (+ 10 240 Mo)',
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
    storage_amount: '50 Go supplémentaires (+ 51 200 Mo)',
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
    storage_amount: '200 Go supplémentaires (+ 204 800 Mo)',
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
    credits_or_words: '100 000 mots IA / mois',
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
    credits_or_words: '1 000 000 mots IA avec priorité maximale',
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
    credits_or_words: 'Mots IA illimités avec modèles avancés',
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

export const SettingsPricingView: React.FC<SettingsPricingViewProps> = ({ onBack, onSelectPlan, initialTab = 'storage' }) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'ai' | 'renewal'>(initialTab);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  const [dbStoragePlans, setDbStoragePlans] = useState<SubscriptionPlan[]>(DEFAULT_STORAGE_PLANS);
  const [dbAiPlans, setDbAiPlans] = useState<SubscriptionPlan[]>(DEFAULT_AI_PLANS);
  const [, setLoadingPlans] = useState<boolean>(true);

  // État du plan sélectionné pour afficher le menu de souscription
  const [selectedPlanForSubscription, setSelectedPlanForSubscription] = useState<SelectedPlan | null>(null);

  // État pour afficher le menu complet de renouvellement
  const [selectedPlanForRenewal, setSelectedPlanForRenewal] = useState<any | null>(null);
  const [renewalRefreshKey, setRenewalRefreshKey] = useState<number>(0);

  // Charger dynamiquement les forfaits depuis Cloudflare D1
  useEffect(() => {
    let isMounted = true;
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
        console.warn('[SettingsPricingView] Erreur chargement forfaits D1:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Si l'utilisateur clique sur "Commencer" ou choisit un plan, on affiche le menu de souscription
  if (selectedPlanForSubscription) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-white overflow-y-auto animate-fadeIn pb-24">
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

  // Si l'utilisateur clique sur "Renouveler l'abonnement", on affiche le menu complet de renouvellement
  if (selectedPlanForRenewal) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-white overflow-y-auto animate-fadeIn pb-24">
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

  // Rendu d'une carte d'abonnement
  const renderCard = (plan: SubscriptionPlan, type: 'storage' | 'ai') => {
    const isPopular = !!(plan.badge && plan.badge.trim());
    const isAnnual = billingCycle === 'annual';
    const discountPct = Number(plan.yearly_discount_pct) || 10;
    
    // Prix calculé
    const monthlyPrice = Number(plan.price) || 0;
    const yearlyPrice = Number(plan.yearly_price) > 0 
      ? Number(plan.yearly_price) 
      : Math.round(monthlyPrice * 12 * (1 - (discountPct / 100)) * 100) / 100;
    const activePrice = isAnnual ? yearlyPrice : monthlyPrice;

    // Conversions monétaires
    const primaryCurr = plan.primary_currency || 'USD';
    const conv = calculateConversions(activePrice, primaryCurr);
    const enabledCurrs = parsePlanCurrencies(plan.currencies_enabled);
    const secondaryParts: string[] = [];
    if (enabledCurrs.includes('XOF') && primaryCurr !== 'XOF') {
      secondaryParts.push(`≈ ${conv.XOF.toLocaleString('fr-FR')} FCFA`);
    }
    if (enabledCurrs.includes('USD') && primaryCurr !== 'USD') {
      secondaryParts.push(`≈ ${conv.USD} $`);
    }
    if (enabledCurrs.includes('EUR') && primaryCurr !== 'EUR') {
      secondaryParts.push(`≈ ${conv.EUR} €`);
    }
    const secondaryString = secondaryParts.join(' • ');

    // Premier avantage verrouillé
    const mainLockedPerk = type === 'ai'
      ? (plan.credits_or_words || `${(plan.credits_count || 100000).toLocaleString('fr-FR')} mots IA / mois`)
      : (plan.storage_amount || `${plan.storage_mb ? (plan.storage_mb / 1024) : 10} Go supplémentaires`);

    // Autres avantages
    const allFeatures = parsePlanFeatures(plan.features);
    const activeFeatures = allFeatures.filter(f => f.enabled !== false);

    const isAuto = plan.is_auto_billing === 1;

    return (
      <div 
        key={plan.id}
        className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative max-w-[380px] w-full mx-auto shadow-md transition-all duration-200 ${
          isPopular
            ? 'bg-[#2D4A3E] dark:bg-[#16382b] border-2 border-[#2D4A3E] dark:border-emerald-500 text-[#F5F0E8]'
            : 'bg-[#E8DFD0] dark:bg-[#111a2e] border border-[#D4C9B5] dark:border-[#1e293b] text-[#2D4A3E] dark:text-slate-100'
        }`}
      >
        <div>
          {/* En-tête : Titre & Badge */}
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-2xl sm:text-3xl font-serif font-normal ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E] dark:text-white'}`}>
              {plan.name}
            </h3>
            {isPopular && (
              <span className="bg-[#C9B896] dark:bg-emerald-500 text-[#2D4A3E] dark:text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                {plan.badge}
              </span>
            )}
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-xs sm:text-sm font-sans mb-4 sm:mb-6 leading-relaxed ${isPopular ? 'text-[#E8DFD0]/80' : 'text-[#5C6B5A] dark:text-slate-400'}`}>
              {plan.description}
            </p>
          )}

          {/* Bloc Prix Principal & Conversions secondaires */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl sm:text-5xl md:text-6xl font-serif font-normal ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E] dark:text-white'}`}>
                {getCurrencySymbol(primaryCurr)} {primaryCurr === 'XOF' ? activePrice.toLocaleString('fr-FR') : activePrice}
              </span>
              <span className={`text-base sm:text-lg font-sans ml-1 ${isPopular ? 'text-[#E8DFD0]/90' : 'text-[#2D4A3E] dark:text-slate-300'}`}>
                {isAnnual ? '/an' : '/mois'}
              </span>
            </div>

            {/* Conversions secondaires en petit en dessous */}
            {secondaryString && (
              <div className={`text-[11px] sm:text-xs mt-1 font-medium ${isPopular ? 'text-[#E8DFD0]/70' : 'text-[#5C6B5A] dark:text-slate-400'}`}>
                {secondaryString}
              </div>
            )}
          </div>

          <div className={`h-0.5 w-full mb-4 sm:mb-6 ${isPopular ? 'bg-[#E8DFD0]/20' : 'bg-gradient-to-r from-[#C9B896] to-[#D4C9B5] dark:from-[#1e293b] dark:to-[#334155]'}`}></div>

          {/* Avantages inclus */}
          <p className={`text-xs sm:text-sm font-semibold mb-3 sm:mb-4 ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E] dark:text-slate-200'}`}>
            Ce qui est inclus :
          </p>

          <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
            {/* Première ligne spéciale et verrouillée */}
            <li className="flex items-start gap-2.5 sm:gap-3">
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                isPopular ? 'bg-[#C9B896] text-[#2D4A3E]' : 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white'
              }`}>
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </div>
              <span className={`text-xs sm:text-sm font-bold ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E] dark:text-white'}`}>
                {mainLockedPerk}
              </span>
            </li>

            {/* Autres lignes d'options */}
            {activeFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isPopular ? 'bg-[#C9B896] text-[#2D4A3E]' : 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white'
                }`}>
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className={`text-xs sm:text-sm ${isPopular ? 'text-[#F5F0E8]' : 'text-[#2D4A3E] dark:text-slate-300'}`}>
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
            storageDisplay: mainLockedPerk,
            priceDisplay: `${getCurrencySymbol(primaryCurr)} ${primaryCurr === 'XOF' ? activePrice.toLocaleString('fr-FR') : activePrice} / ${isAnnual ? 'an' : 'mois'} ${secondaryString ? '(' + secondaryString + ')' : ''}`,
            price: activePrice,
            priceFcfa: conv.XOF,
            currency: getCurrencySymbol(primaryCurr),
            billingCycle: billingCycle,
            mb: plan.storage_mb,
            words: plan.credits_count
          })}
          className={`w-full py-3 font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-sm text-center active:scale-[0.98] ${
            isPopular
              ? 'bg-[#C9B896] hover:bg-[#B8A785] text-[#2D4A3E] font-bold shadow-md'
              : 'bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border border-[#B8A785] dark:border-[#334155]'
          }`}
        >
          {isAuto ? "S'abonner" : "Commencer"}
        </button>
      </div>
    );
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-white overflow-y-auto animate-fadeIn pb-24">
      
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
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-3 leading-tight">
              Choisissez votre formule
            </h1>
            <p className="text-sm sm:text-lg md:text-xl font-sans text-[#5C6B5A] dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
              Des tarifs abordables et adaptés à vos objectifs d'apprentissage et de stockage.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. SECTION : ABONNEMENTS STOCKAGE (DYNAMIQUES DEPUIS LA BASE DE DONNÉES)  */}
        {/* ========================================================================= */}
        {activeTab === 'storage' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
            {dbStoragePlans.map(plan => renderCard(plan, 'storage'))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. SECTION : ASSISTANTE STUDYCLOUD (DYNAMIQUES DEPUIS LA BASE DE DONNÉES) */}
        {/* ========================================================================= */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
            {dbAiPlans.map(plan => renderCard(plan, 'ai'))}
          </div>
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
