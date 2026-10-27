import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  Gift,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Bot,
  Layers,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUserStorageRequests,
  getUserPurchasesHistory,
  getUserAiPurchases,
  getSubscriptionPlans,
  getUserAiCreditsLive,
  getAiBillingConfig,
  AiBillingConfig,
  SubscriptionPlan
} from '../services/api';
import { PricingView } from './PricingView';

interface AiSubscriptionsViewProps {
  onBack?: () => void;
  onOpenPricing?: (tab?: 'storage' | 'ai' | 'renewal') => void;
}

export const AiSubscriptionsView: React.FC<AiSubscriptionsViewProps> = ({
  onBack,
  onOpenPricing
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id || localStorage.getItem('unifolder_user_id') || 'default-user';

  // Navigation interne pour afficher directement les formules connectées au worker tableau de bord
  const [showPricingView, setShowPricingView] = useState(false);

  // Onglets pour l'utilisateur : "Demandes en cours" vs "Achats validés & Refus"
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Cache synchrone pour affichage instantané sans attente (0ms)
  const cachedCredits = (() => {
    try {
      const raw = localStorage.getItem(`studycloud_cached_user_credits_${currentUserId}`) || localStorage.getItem('studycloud_cached_user_credits');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const cachedConfig = (() => {
    try {
      const raw = localStorage.getItem('studycloud_cached_ai_config');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Si on a des données en cache, pas de spinner d'attente initial
  const [loading, setLoading] = useState<boolean>(!cachedCredits);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasEverLoadedRef = useRef<boolean>(!!cachedCredits);
  const isFetchingRef = useRef<boolean>(false);

  // Formules IA issues de la base D1
  const [aiPlans, setAiPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);

  // Configuration globale de facturation IA issue de la base Cloudflare D1
  const [billingConfig, setBillingConfig] = useState<AiBillingConfig>(() => ({
    tokens_per_credit: Number(cachedConfig?.tokens_per_credit || cachedCredits?.tokens_per_credit || 1000),
    welcome_credits: Number(cachedConfig?.welcome_credits !== undefined ? cachedConfig.welcome_credits : (cachedCredits?.welcome_credits !== undefined ? cachedCredits.welcome_credits : 50)),
    daily_free_credits: Number(cachedConfig?.daily_free_credits || cachedCredits?.daily_free_credits || 0),
    is_daily_renewal_active: Number(cachedConfig?.is_daily_renewal_active || 0)
  }));

  // Solde de crédits de l'utilisateur (issu de D1 et mis en cache pour fluidité maximale)
  const [userCredits, setUserCredits] = useState<{
    balance: number;
    tokensUsed: number;
    totalPurchased: number;
    totalConsumed?: number;
    plan: string;
    welcome_credits?: number;
    daily_free_credits?: number;
    tokens_per_credit?: number;
    gift_remaining?: number;
    gift_initial?: number;
    gift_type?: string;
    gift_title?: string;
    purchased_remaining?: number;
  }>(() => ({
    balance: Number(cachedCredits?.balance || 0),
    tokensUsed: Number(cachedCredits?.tokensUsed || 0),
    totalPurchased: Number(cachedCredits?.totalPurchased || 0),
    totalConsumed: Number(cachedCredits?.totalConsumed || 0),
    plan: cachedCredits?.plan || 'Étudiant Gratuit',
    welcome_credits: cachedCredits?.welcome_credits,
    daily_free_credits: cachedCredits?.daily_free_credits,
    tokens_per_credit: cachedCredits?.tokens_per_credit,
    gift_remaining: cachedCredits?.gift_remaining !== undefined ? Number(cachedCredits.gift_remaining) : undefined,
    gift_initial: cachedCredits?.gift_initial !== undefined ? Number(cachedCredits.gift_initial) : undefined,
    gift_type: cachedCredits?.gift_type,
    gift_title: cachedCredits?.gift_title,
    purchased_remaining: cachedCredits?.purchased_remaining !== undefined ? Number(cachedCredits.purchased_remaining) : undefined
  }));

  // Liste globale de toutes les demandes utilisateur
  const [allRequests, setAllRequests] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem(`studycloud_cached_user_requests_${currentUserId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Chargement ultra-rapide et parallèle des données Cloudflare D1
  const loadData = async (showSpin = false, isBackground = false) => {
    if (isFetchingRef.current && !showSpin) return;
    isFetchingRef.current = true;

    if (showSpin) {
      setRefreshing(true);
    } else if (!isBackground && !hasEverLoadedRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      // Exécution simultanée de toutes les requêtes en parallèle (gain de plusieurs secondes)
      const [liveRes, configRes, aiPurRes, purHistRes, storReqRes, plansRes] = await Promise.allSettled([
        getUserAiCreditsLive(currentUserId),
        getAiBillingConfig(),
        getUserAiPurchases(currentUserId),
        getUserPurchasesHistory(currentUserId),
        getUserStorageRequests(currentUserId),
        getSubscriptionPlans()
      ]);

      // 1. Solde en direct et crédits réels D1
      if (liveRes.status === 'fulfilled' && liveRes.value && liveRes.value.success && liveRes.value.credits) {
        const cred = liveRes.value.credits;
        const finalPurchased = Math.max(0, Number(cred.totalPurchased || 0));
        const serverBalance = Number(cred.balance);

        const updatedCredits = {
          balance: serverBalance,
          tokensUsed: Number(cred.tokensUsed || 0),
          totalPurchased: finalPurchased,
          totalConsumed: Number(cred.totalConsumed || 0),
          plan: cred.plan || (finalPurchased > 0 ? 'IA Pro Étudiant' : 'Étudiant Gratuit'),
          welcome_credits: cred.welcome_credits !== undefined ? Number(cred.welcome_credits) : undefined,
          daily_free_credits: cred.daily_free_credits,
          tokens_per_credit: cred.tokens_per_credit,
          gift_remaining: cred.gift_remaining !== undefined ? Number(cred.gift_remaining) : undefined,
          gift_initial: cred.gift_initial !== undefined ? Number(cred.gift_initial) : undefined,
          gift_type: cred.gift_type,
          gift_title: cred.gift_title,
          purchased_remaining: cred.purchased_remaining !== undefined ? Number(cred.purchased_remaining) : undefined
        };

        setUserCredits(updatedCredits);
        try {
          localStorage.setItem(`studycloud_cached_user_credits_${currentUserId}`, JSON.stringify(updatedCredits));
          localStorage.setItem('studycloud_cached_user_credits', JSON.stringify(updatedCredits));
        } catch (_) {}

        if (cred.welcome_credits !== undefined) {
          setBillingConfig(prev => ({
            ...prev,
            welcome_credits: Number(cred.welcome_credits),
            tokens_per_credit: cred.tokens_per_credit || prev.tokens_per_credit,
            daily_free_credits: cred.daily_free_credits !== undefined ? cred.daily_free_credits : prev.daily_free_credits
          }));
        }
      }

      // 2. Configuration globale IA configurée par l'administrateur
      if (configRes.status === 'fulfilled' && configRes.value && configRes.value.success && configRes.value.config) {
        const cfg = configRes.value.config;
        setBillingConfig(prev => ({
          ...prev,
          tokens_per_credit: cfg.tokens_per_credit || prev.tokens_per_credit,
          daily_free_credits: cfg.daily_free_credits !== undefined ? cfg.daily_free_credits : prev.daily_free_credits,
          is_daily_renewal_active: cfg.is_daily_renewal_active !== undefined ? cfg.is_daily_renewal_active : prev.is_daily_renewal_active,
          welcome_credits: cfg.welcome_credits !== undefined ? Number(cfg.welcome_credits) : prev.welcome_credits
        }));
        try {
          localStorage.setItem('studycloud_cached_ai_config', JSON.stringify(cfg));
        } catch (_) {}
      }

      // 3. Fusion des demandes et achats réels pour les onglets
      let combinedItems: any[] = [];
      if (storReqRes.status === 'fulfilled' && storReqRes.value && storReqRes.value.success && Array.isArray(storReqRes.value.requests)) {
        combinedItems.push(...storReqRes.value.requests);
      }
      if (purHistRes.status === 'fulfilled' && purHistRes.value && purHistRes.value.success && Array.isArray(purHistRes.value.purchases)) {
        combinedItems.push(...purHistRes.value.purchases);
      }
      if (aiPurRes.status === 'fulfilled' && aiPurRes.value && aiPurRes.value.success && Array.isArray(aiPurRes.value.purchases)) {
        combinedItems.push(...aiPurRes.value.purchases);
      }

      const allMap = new Map<string, any>();
      combinedItems.forEach((item) => {
        if (item && (item.id || item.requestId)) {
          allMap.set(item.id || item.requestId, item);
        }
      });

      const sorted = Array.from(allMap.values()).sort(
        (a, b) => new Date(b.created_at || b.purchased_at || 0).getTime() - new Date(a.created_at || a.purchased_at || 0).getTime()
      );
      setAllRequests(sorted);
      try {
        localStorage.setItem(`studycloud_cached_user_requests_${currentUserId}`, JSON.stringify(sorted));
      } catch (_) {}

      // 4. Formules IA de la base D1
      if (plansRes.status === 'fulfilled' && plansRes.value && plansRes.value.success && Array.isArray(plansRes.value.aiPlans)) {
        setAiPlans(plansRes.value.aiPlans);
      }

    } catch (err: any) {
      console.warn('[AiSubscriptionsView] Erreur synchronisation D1:', err);
      if (!hasEverLoadedRef.current) {
        setError(err?.message || "Erreur de synchronisation avec le serveur");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingPlans(false);
      hasEverLoadedRef.current = true;
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Premier appel rapide (ne bloque pas si déjà en cache)
    loadData(false, hasEverLoadedRef.current);

    // Synchronisation automatique en tâche de fond toutes les 10 secondes (SILENCIEUSE, SANS RESET DE JAUGE)
    const pollInterval = setInterval(() => {
      loadData(false, true);
    }, 10000);

    // Rafraîchir en tâche de fond dès que la fenêtre reprend le focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData(false, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // Écouter les déductions ou recharges en temps réel pour cet utilisateur
    const handleCreditUpdate = (e: any) => {
      const detail = e.detail;
      if (detail && (!detail.userId || detail.userId === currentUserId)) {
        setUserCredits(prev => {
          const updated = {
            ...prev,
            balance: Number(detail.remaining_balance !== undefined ? detail.remaining_balance : prev.balance),
            tokensUsed: Number(detail.total_tokens_consumed !== undefined ? detail.total_tokens_consumed : (prev.tokensUsed + (detail.tokens_consumed || 0))),
            totalConsumed: Number(detail.total_credits_consumed !== undefined ? detail.total_credits_consumed : (prev.totalConsumed || 0)),
            gift_remaining: detail.gift_remaining !== undefined ? Number(detail.gift_remaining) : prev.gift_remaining,
            gift_initial: detail.gift_initial !== undefined ? Number(detail.gift_initial) : prev.gift_initial,
            gift_type: detail.gift_type || prev.gift_type,
            gift_title: detail.gift_title || prev.gift_title,
            purchased_remaining: detail.purchased_remaining !== undefined ? Number(detail.purchased_remaining) : prev.purchased_remaining,
            totalPurchased: detail.total_purchased !== undefined ? Number(detail.total_purchased) : prev.totalPurchased
          };
          try {
            localStorage.setItem(`studycloud_cached_user_credits_${currentUserId}`, JSON.stringify(updated));
            localStorage.setItem('studycloud_cached_user_credits', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
      }
    };
    window.addEventListener('studycloud_user_credits_updated', handleCreditUpdate);

    // Écouter une modification globale de facturation IA faite par l'administrateur
    const handleConfigUpdate = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setBillingConfig(prev => ({ ...prev, ...detail }));
        loadData(false, true);
      }
    };
    window.addEventListener('studycloud_ai_config_updated', handleConfigUpdate);

    // Écouter les changements de cache provenant d'autres onglets
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `studycloud_cached_user_credits_${currentUserId}` || e.key === 'studycloud_cached_ai_config') {
        loadData(false, true);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('studycloud_user_credits_updated', handleCreditUpdate);
      window.removeEventListener('studycloud_ai_config_updated', handleConfigUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUserId]);

  // Filtrage : Demandes en cours
  const pendingRequests = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'pending' || st === 'en_attente' || st === 'traitement' || st === 'soumis';
  });

  // Filtrage : Achats validés
  const approvedPurchases = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'completed' || st === 'approved' || st === 'active' || st === 'confirmed';
  });

  // Filtrage : Demandes refusées
  const rejectedRequests = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'rejected' || st === 'refused' || st === 'refusé' || st === 'annule' || st === 'annulé';
  });

  // Ouverture du menu officiel de tarification connecté au worker tableau de bord
  const handleOpenPricing = () => {
    if (onOpenPricing) {
      onOpenPricing('ai');
    } else {
      window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'ai' } }));
      setShowPricingView(true);
    }
  };

  // Valeurs calculées dynamiquement depuis la base de données D1 (Modèle Mon Stockage)
  const tokensPerCredit = Math.max(1, Number(billingConfig.tokens_per_credit || userCredits.tokens_per_credit || 1000));
  // Priorité absolue aux règles globales définies par l'administrateur dans Cloudflare D1
  const welcomeCredits = billingConfig.welcome_credits !== undefined
    ? Number(billingConfig.welcome_credits)
    : (userCredits.welcome_credits !== undefined ? Number(userCredits.welcome_credits) : 50);
  const purchasedCredits = Math.max(0, Number(userCredits.totalPurchased || 0));
  const rawConsumedCredits = Number(userCredits.totalConsumed !== undefined ? userCredits.totalConsumed : ((userCredits.tokensUsed || 0) / tokensPerCredit));
  const consumedCredits = Math.max(0, +rawConsumedCredits.toFixed(2));

  // Type et titre du cadeau (Bienvenue ou Cadeau du jour qui le remplace)
  const giftType = userCredits.gift_type || 'welcome';
  const giftTitle = userCredits.gift_title || (giftType === 'daily' ? 'Cadeau du jour' : 'Cadeau de base');
  const giftInitial = userCredits.gift_initial !== undefined ? Number(userCredits.gift_initial) : welcomeCredits;

  // Solde restant réel (issu directement de Cloudflare D1)
  const serverBalance = Number(userCredits.balance || 0);

  // RÈGLE FIFO STRICTE DANS LA BASE DE DONNÉES D1 (COMMANDE UTILISATEUR) :
  // 1. Le cadeau est consommé en premier jusqu'à épuisement complet (décroît vers 0).
  // 2. Les crédits payés restent 100% préservés tant que le cadeau > 0.
  // 3. Quand le cadeau est à 0, les crédits payés commencent à diminuer.
  const giftRemaining = userCredits.gift_remaining !== undefined
    ? Number(userCredits.gift_remaining)
    : Math.max(0, +(giftInitial - consumedCredits).toFixed(2));

  const paidRemaining = userCredits.purchased_remaining !== undefined
    ? Number(userCredits.purchased_remaining)
    : Math.max(0, +(serverBalance - giftRemaining).toFixed(2));

  // Crédit disponible total actif
  const creditsRemaining = (userCredits.gift_remaining !== undefined && userCredits.purchased_remaining !== undefined)
    ? +(giftRemaining + paidRemaining).toFixed(2)
    : (serverBalance > 0 ? serverBalance : Math.max(0, +(welcomeCredits + purchasedCredits - consumedCredits).toFixed(2)));

  // Dotation totale de départ = Cadeau accordé + Total acheté
  const totalMaxCredits = Math.max(giftInitial + purchasedCredits, +(creditsRemaining + consumedCredits).toFixed(2));

  // Pourcentage de la jauge (démarre plein au départ, et se vide progressivement vers la gauche)
  const creditsPercentage = totalMaxCredits > 0
    ? Math.min(100, Math.max(0, Math.round((creditsRemaining / totalMaxCredits) * 100)))
    : 0;

  const dailyFreeCredits = Number(billingConfig.daily_free_credits || userCredits.daily_free_credits || 0);
  const isDailyActive = Number(billingConfig.is_daily_renewal_active) === 1 && dailyFreeCredits > 0;

  // Formatage du prix d'un forfait IA
  const formatPlanPrice = (plan: SubscriptionPlan) => {
    const isOneTime = plan.pricing_model === 'one_time' || plan.pricing_model === 'pack';
    const currSymbol = plan.primary_currency === 'XOF' ? 'FCFA' : plan.primary_currency === 'EUR' ? '€' : plan.primary_currency === 'USD' ? '$' : (plan.primary_currency || 'FCFA');
    const formattedPrice = (Number(plan.price) || 0).toLocaleString('fr-FR');
    if (isOneTime) {
      return `${formattedPrice} ${currSymbol}`;
    }
    return `${formattedPrice} ${currSymbol} / mois`;
  };

  // Couleur dynamique de la jauge
  const gaugeColor = creditsPercentage >= 60
    ? '#10b981'
    : creditsPercentage >= 25
    ? '#f59e0b'
    : '#ef4444';

  // Arc SVG pour la jauge circulaire
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(creditsPercentage, 100) / 100) * circumference;

  // Si l'utilisateur clique sur "Recharger", afficher le menu officiel de tarification
  if (showPricingView) {
    return (
      <PricingView
        initialTab="ai"
        onBack={() => {
          setShowPricingView(false);
          loadData();
        }}
        onSelectPlan={() => {}}
      />
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F2EC] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto overflow-x-hidden transition-colors duration-300">

      {/* ======================================================================
          HERO HEADER — Immersion Moderne & Luxueuse (Cyber/Améthyste & Ambre)
          ====================================================================== */}
      <div className="relative w-full bg-gradient-to-br from-[#2D1B69] via-[#581C87] to-[#9A3412] dark:from-[#110729] dark:via-[#1e0736] dark:to-[#1c0803] overflow-hidden">
        {/* Motif décoratif en fond */}
        <div className="absolute inset-0 opacity-15 pointer-events-none select-none">
          <div className="absolute top-2 right-8 w-64 h-64 rounded-full bg-violet-400 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-amber-400 blur-2xl" />
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 15% 50%, rgba(192,132,252,0.18) 0%, transparent 50%),
                radial-gradient(circle at 85% 20%, rgba(251,146,60,0.15) 0%, transparent 40%)`
            }}
          />
        </div>

        {/* Contenu du header */}
        <div className="relative z-10 px-5 md:px-8 py-4 md:py-5">

          {/* Ligne de contrôles : retour | titre | actualiser | bouton recharger */}
          <div className="flex items-center justify-between gap-3 mb-4">
            {/* Gauche : retour + refresh */}
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl border border-white/30 backdrop-blur-sm transition-all cursor-pointer active:scale-95"
                  title="Retour"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Retour</span>
                </button>
              )}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing || loading}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/30 backdrop-blur-sm transition-all cursor-pointer disabled:opacity-50"
                title="Actualiser"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-300' : ''}`} />
              </button>
            </div>

            {/* Centre : titre */}
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              <h1 className="text-white font-black text-base md:text-lg tracking-tight">
                Mes Crédits IA
              </h1>
            </div>

            {/* Droite : bouton recharger */}
            <button
              onClick={handleOpenPricing}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 font-extrabold text-xs md:text-sm rounded-xl border-2 border-white/30 shadow-[0_4px_15px_rgba(251,146,60,0.5)] transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Choisir une formule de crédits IA"
            >
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current text-stone-900" />
              <span className="hidden sm:inline">+ Recharger mes crédits</span>
              <span className="sm:hidden">+ Crédits</span>
            </button>
          </div>

          {/* ── Dashboard stats dans le header ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">

            {/* JAUGE CIRCULAIRE — colonne gauche (Stable, fluide et temps réel) */}
            <div className="lg:col-span-1 flex items-center justify-center">
              <div className="relative flex flex-col items-center">
                {/* SVG Arc */}
                <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-lg">
                  {/* Fond gris de l'arc */}
                  <circle
                    cx="70" cy="70" r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  {/* Arc coloré */}
                  <circle
                    cx="70" cy="70" r={radius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease' }}
                  />
                  {/* Texte central : toujours visible immédiatement */}
                  <text x="70" y="64" textAnchor="middle" className="font-black" fill="white" fontSize="22" fontWeight="900">
                    {creditsRemaining}
                  </text>
                  <text x="70" y="82" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="10">
                    disponibles
                  </text>
                </svg>
                <p className="text-white/80 text-xs mt-1 font-medium text-center">
                  {creditsRemaining} Crédits restants
                  <span className="text-white/50"> / </span>
                  {totalMaxCredits} Crédits au départ
                </p>
              </div>
            </div>

            {/* STATS RAPIDES — 3 Cartes essentielles Glassmorphism */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Crédits gratuits offerts (Consommés en premier jusqu'à 0) */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-emerald-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{giftTitle}</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white leading-none">
                  {giftRemaining}
                </p>
                <p className="text-emerald-300/90 text-[10px] mt-1 font-medium">
                  {giftRemaining > 0 ? `sur ${giftInitial} au départ • Prioritaire` : 'Cadeau épuisé'}
                </p>
              </div>

              {/* 2. Crédits achetés (Préservés tant que le cadeau existe, puis diminuent) */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Achetés</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white leading-none">
                  {paidRemaining}
                </p>
                <p className="text-blue-200/90 text-[10px] mt-1 font-medium">
                  {purchasedCredits > 0
                    ? (giftRemaining > 0 ? `sur ${purchasedCredits} achetés (Préservé)` : `sur ${purchasedCredits} achetés (En cours)`)
                    : 'Extensions validées'}
                </p>
              </div>

              {/* 3. Crédit disponible (Solde total actif qui diminue) */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Crédit disponible</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-amber-300 leading-none">
                  {creditsRemaining}
                </p>
                <p className="text-amber-200/90 text-[10px] mt-1 font-medium">Diminue à chaque réponse IA</p>
              </div>
            </div>
          </div>

          {/* Barre de progression large en bas du hero */}
          <div className="mt-4 md:mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-white/70">
              <span>0 Crédit</span>
              <span className="font-semibold text-white/90">
                {creditsRemaining > 20
                  ? '✓ Solde confortable pour discuter avec Delmas IA & Robot Rouge'
                  : creditsRemaining > 5
                  ? '⚡ Solde disponible — Pensez à recharger pour continuer à poser vos questions'
                  : '⚠️ Solde faible — Recharger vos crédits pour ne pas être interrompu'}
              </span>
              <span>{totalMaxCredits} Crédits (Départ)</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full border border-white/20 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(creditsPercentage > 0 ? 3 : 0, Math.min(100, creditsPercentage))}%`,
                  background: creditsPercentage >= 60
                    ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)'
                    : creditsPercentage >= 25
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #ef4444, #f87171)',
                  boxShadow: `0 0 12px ${gaugeColor}aa`
                }}
              />
            </div>
          </div>

          {/* Badge Recharge Quotidienne Active si configurée dans le Tableau de Bord */}
          {isDailyActive && (
            <div className="mt-3.5 py-2 px-3.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl flex items-center justify-between text-xs text-emerald-200 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>
                  <strong>Recharge quotidienne active :</strong> +{dailyFreeCredits} crédits sont automatiquement offerts à votre compte chaque jour.
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400/25 px-2 py-0.5 rounded text-emerald-300 border border-emerald-400/30">
                +{dailyFreeCredits}/jour
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================
          CORPS PRINCIPAL — Layout moderne 2 colonnes (2/3 + 1/3) sur desktop
          ====================================================================== */}
      <div className="px-4 md:px-6 lg:px-8 py-5 grid grid-cols-1 xl:grid-cols-3 gap-5 max-w-[1600px] mx-auto">

        {/* ── COLONNE GAUCHE (2/3 de la largeur) ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Alerte Solde Faible */}
          {creditsRemaining <= 5 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500/60 rounded-2xl flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                <span>
                  <strong>Votre solde est faible ({creditsRemaining} crédits restants).</strong> Pour continuer à interagir avec le Robot Rouge et générer vos modules, rechargez votre compte.
                </span>
              </div>
              <button
                onClick={handleOpenPricing}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-xs shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Recharger
              </button>
            </div>
          )}

          {/* Message d'erreur éventuel */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-500/60 rounded-2xl flex items-center justify-between gap-3 text-red-700 dark:text-red-300 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => loadData(false)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs"
              >
                Réessayer
              </button>
            </div>
          )}



          {/* ── ONGLETS DEMANDES & ACHATS ── */}
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header des onglets */}
            <div className="flex items-center gap-0 border-b border-stone-100 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-5 py-3.5 font-bold text-xs sm:text-sm transition-all cursor-pointer border-b-2 flex-1 justify-center ${
                  activeTab === 'pending'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Mes demandes en cours</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300'
                }`}>
                  {pendingRequests.length}
                </span>
              </button>

              <div className="w-px h-8 bg-stone-100 dark:border-slate-800" />

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-5 py-3.5 font-bold text-xs sm:text-sm transition-all cursor-pointer border-b-2 flex-1 justify-center ${
                  activeTab === 'history'
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mes achats validés & Refus</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'history'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300'
                }`}>
                  {approvedPurchases.length + rejectedRequests.length}
                </span>
              </button>
            </div>

            {/* Contenu onglet */}
            <div className="p-5">

              {/* ONGLET 1 : Demandes en cours */}
              {activeTab === 'pending' && (
                <div>
                  {pendingRequests.length === 0 ? (
                    <div className="py-10 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 mx-auto flex items-center justify-center">
                        <Clock className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                          Aucune demande en cours de validation
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                          Lorsque vous souscrivez à une formule de crédits IA ou envoyez un reçu de paiement, votre demande apparaît ici pendant la vérification.
                        </p>
                      </div>
                      <button
                        onClick={handleOpenPricing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Découvrir les formules IA</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {pendingRequests.map((req, idx) => (
                        <div
                          key={req.id || idx}
                          className="rounded-2xl p-5 border-2 border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-600/40 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ⏳ En cours de validation
                              </span>
                              <h4 className="text-sm font-black text-stone-900 dark:text-white mt-1.5">
                                {req.pack_name || req.packName || 'Recharge de Crédits IA'}
                              </h4>
                            </div>
                            <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                              {req.price_display || `${(req.price_paid || req.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                            </span>
                          </div>

                          <div className="text-xs text-stone-600 dark:text-slate-300 space-y-1 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-stone-200 dark:border-slate-800">
                            <div className="flex justify-between">
                              <span className="text-stone-400">Date d'envoi :</span>
                              <span className="font-bold">
                                {req.created_at
                                  ? new Date(req.created_at).toLocaleDateString('fr-FR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'Récemment'}
                              </span>
                            </div>
                            {req.payment_method && (
                              <div className="flex justify-between">
                                <span className="text-stone-400">Paiement :</span>
                                <span className="font-bold">{req.payment_method}</span>
                              </div>
                            )}
                            {req.payment_reference && (
                              <div className="flex justify-between">
                                <span className="text-stone-400">Réf / Reçu :</span>
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {req.payment_reference}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>Votre reçu est en cours d'inspection par l'équipe DKD Technologies. Vos crédits seront ajoutés dès validation.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 2 : Achats validés & Refus */}
              {activeTab === 'history' && (
                <div className="space-y-5">
                  {/* Achats validés */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Achats validés & formules actives ({approvedPurchases.length})
                    </h3>

                    {approvedPurchases.length === 0 ? (
                      <div className="py-6 text-center bg-stone-50 dark:bg-slate-900/40 rounded-2xl border border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 text-xs">
                        Aucun achat validé pour le moment.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {approvedPurchases.map((pur, idx) => (
                          <div
                            key={pur.id || idx}
                            className="rounded-2xl p-5 border-2 border-emerald-400/60 bg-emerald-50/30 dark:bg-emerald-950/10 dark:border-emerald-600/40 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                  ✅ Validé & Activé
                                </span>
                                <h4 className="text-sm font-black text-stone-900 dark:text-white mt-1.5">
                                  {pur.pack_name || pur.packName || 'Recharge de Crédits IA'}
                                </h4>
                              </div>
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {pur.price_display || `${(pur.price_paid || pur.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                              </span>
                            </div>

                            <div className="text-xs text-stone-600 dark:text-slate-300 space-y-1 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-stone-200 dark:border-slate-800">
                              <div className="flex justify-between">
                                <span className="text-stone-400">Confirmé le :</span>
                                <span className="font-bold">
                                  {pur.confirmed_at || pur.updated_at || pur.created_at
                                    ? new Date(pur.confirmed_at || pur.updated_at || pur.created_at).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                    : 'Confirmé'}
                                </span>
                              </div>
                              {pur.additional_words ? (
                                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900 mt-2">
                                  +{Number(pur.additional_words).toLocaleString('fr-FR')} crédits IA crédités sur votre compte
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Refus */}
                  <div className="space-y-3 pt-4 border-t border-stone-100 dark:border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      Demandes non validées ({rejectedRequests.length})
                    </h3>

                    {rejectedRequests.length === 0 ? (
                      <div className="py-6 text-center bg-stone-50 dark:bg-slate-900/40 rounded-2xl border border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 text-xs">
                        Aucune demande refusée.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {rejectedRequests.map((rej, idx) => (
                          <div
                            key={rej.id || idx}
                            className="rounded-2xl p-5 border-2 border-red-400/50 bg-red-50/30 dark:bg-red-950/10 dark:border-red-600/40 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700">
                                  ❌ Non validée
                                </span>
                                <h4 className="text-sm font-black text-stone-900 dark:text-white mt-1.5">
                                  {rej.pack_name || rej.packName || 'Demande de Crédits'}
                                </h4>
                              </div>
                              <span className="text-sm font-bold text-stone-500">
                                {rej.price_display || `${(rej.price_paid || rej.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                              </span>
                            </div>

                            <p className="text-xs text-stone-600 dark:text-slate-300 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                              {rej.admin_notes || rej.notes || "Le reçu ou la référence n'a pas pu être validé. Vous pouvez réitérer votre demande avec une capture claire."}
                            </p>

                            <button
                              onClick={handleOpenPricing}
                              className="text-xs px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all cursor-pointer"
                            >
                              Réitérer la demande
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── COLONNE DROITE (1/3 de la largeur sur xl) ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* CTA Recharger les crédits (Formules IA D1) */}
          <div className="bg-gradient-to-br from-[#2D1B69] to-[#7C2D12] dark:from-[#1b083b] dark:to-[#170a04] rounded-3xl p-5 border border-purple-800/40 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="text-white font-black text-sm">Besoin de plus de crédits ?</h3>
              </div>
              <p className="text-white/70 text-xs leading-relaxed">
                Rechargez votre portefeuille pour échanger sans limite avec le Robot Rouge et créer des modules complets.
              </p>

              {/* Formules réelles issues de Cloudflare D1 */}
              {loadingPlans ? (
                <div className="space-y-2 py-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white/10 rounded-xl p-3 animate-pulse h-14 border border-white/10" />
                  ))}
                </div>
              ) : aiPlans.length === 0 ? (
                <div className="space-y-2">
                  {/* Formules par défaut élégantes si la base n'a pas encore de pack défini */}
                  <div
                    onClick={handleOpenPricing}
                    className="bg-white/10 hover:bg-white/15 rounded-xl p-3 flex items-center justify-between border border-white/10 transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <div>
                      <span className="text-white font-extrabold text-xs block">Pack Découverte IA</span>
                      <span className="text-white/70 text-[11px] font-semibold">+50 Crédits supplémentaires</span>
                    </div>
                    <span className="text-amber-300 font-black text-xs">1 000 FCFA</span>
                  </div>

                  <div
                    onClick={handleOpenPricing}
                    className="bg-amber-500/30 border border-amber-400/60 rounded-xl p-3 flex items-center justify-between shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-extrabold text-xs">Pack Étudiant Boost</span>
                        <span className="text-amber-300 text-[9px] font-black uppercase bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/40">
                          Populaire
                        </span>
                      </div>
                      <span className="text-white/80 text-[11px] font-semibold">+200 Crédits supplémentaires</span>
                    </div>
                    <span className="text-amber-300 font-black text-xs">3 000 FCFA</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {aiPlans.map((plan) => {
                    const hasBadge = !!(plan.badge && plan.badge.trim());
                    const creditAmount = plan.words_amount || (plan.ai_tokens ? `${Number(plan.ai_tokens).toLocaleString('fr-FR')} tokens` : 'Pack Crédits');

                    return (
                      <div
                        key={plan.id}
                        onClick={handleOpenPricing}
                        className={`rounded-xl p-3 flex items-center justify-between border transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          hasBadge
                            ? 'bg-amber-500/30 border-amber-400/60 shadow-sm'
                            : 'bg-white/10 hover:bg-white/15 border-white/10'
                        }`}
                        title="Cliquer pour choisir cette formule"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-extrabold text-xs">{plan.name}</span>
                            {hasBadge && (
                              <span className="text-amber-300 text-[9px] font-black uppercase bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/40">
                                {plan.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-white/75 text-[11px] font-semibold">
                            {creditAmount}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-amber-300 font-black text-xs block">
                            {formatPlanPrice(plan)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleOpenPricing}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-white/30 shadow-[0_4px_15px_rgba(251,146,60,0.4)] transition-all cursor-pointer hover:scale-105 active:scale-95 mt-1"
              >
                <Zap className="w-4 h-4 fill-current text-stone-900" />
                <span>Recharger mes crédits</span>
              </button>
            </div>
          </div>

          {/* Carte Détail du Portefeuille */}
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl p-5 border-2 border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 dark:border-slate-800 pb-3">
              <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-slate-300">
                Détail du portefeuille
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <Gift className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{giftTitle}</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-stone-900 dark:text-white">
                    {giftRemaining} Crédits
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                    {giftRemaining > 0 ? `(sur ${giftInitial} au départ • Prioritaire)` : '(Cadeau épuisé)'}
                  </span>
                </div>
              </div>

              {isDailyActive && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Recharge quotidienne</span>
                  </div>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    +{dailyFreeCredits} / jour
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  <span>Extensions achetées</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-stone-900 dark:text-white">
                    {paidRemaining} Crédits
                  </span>
                  {purchasedCredits > 0 && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block">
                      {giftRemaining > 0 ? `(sur ${purchasedCredits} achetés • Préservé)` : `(sur ${purchasedCredits} achetés • En cours)`}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-px bg-stone-100 dark:border-slate-800" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-700 dark:text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-bold">Total disponible</span>
                </div>
                <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                  {creditsRemaining} Crédits
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <Bot className="w-3.5 h-3.5 text-purple-500" />
                  <span>Consommation IA</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-stone-900 dark:text-white">
                    {consumedCredits} crédits
                  </span>
                  <span className="text-[10px] text-stone-400 block font-mono">
                    {userCredits.tokensUsed.toLocaleString('fr-FR')} tokens
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  <span>Taux proportionnel actif</span>
                </div>
                <span className="font-semibold text-stone-800 dark:text-slate-200 text-xs">
                  1 crédit = {tokensPerCredit.toLocaleString('fr-FR')} tokens
                </span>
              </div>

              <div className="h-px bg-stone-100 dark:border-slate-800" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-700 dark:text-slate-300">
                  <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
                  <span className="font-bold">Formule active</span>
                </div>
                <span className="font-black text-stone-900 dark:text-white text-xs">
                  {userCredits.plan}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Données chiffrées — Synchronisation instantanée Cloudflare D1.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
