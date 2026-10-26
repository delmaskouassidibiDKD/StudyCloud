import React, { useState, useEffect } from 'react';
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
  getUserStorageQuota,
  getUserStorageRequests,
  getUserPurchasesHistory,
  getUserAiPurchases,
  getSubscriptionPlans,
  getUserAiCreditsLive,
  getAiBillingConfig,
  AiBillingConfig,
  SubscriptionPlan,
  UserStorageQuotaDetails
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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quota de stockage et crédits IA
  const [quotaData, setQuotaData] = useState<UserStorageQuotaDetails | null>(null);

  // Formules IA issues de la base D1
  const [aiPlans, setAiPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);

  // Configuration globale de facturation IA (Formule 2) issue de la base Cloudflare D1
  const [billingConfig, setBillingConfig] = useState<AiBillingConfig>({
    tokens_per_credit: 1000,
    welcome_credits: 50,
    daily_free_credits: 0,
    is_daily_renewal_active: 0
  });

  // Solde de crédits de l'utilisateur
  const [userCredits, setUserCredits] = useState<{
    balance: number;
    tokensUsed: number;
    totalPurchased: number;
    plan: string;
    welcome_credits?: number;
    daily_free_credits?: number;
    tokens_per_credit?: number;
  }>(() => {
    try {
      // Nettoyer toute trace de demandes fantômes ou anciennes données locales
      localStorage.removeItem('studycloud_ai_credit_requests');
      const saved = localStorage.getItem(`studycloud_user_credits_${currentUserId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          balance: Number(parsed.balance || 50),
          tokensUsed: Number(parsed.tokensUsed || 0),
          totalPurchased: 0, // TOUJOURS 0 par défaut pour éliminer tout affichage fantôme au démarrage
          plan: parsed.plan || 'Étudiant Gratuit',
          welcome_credits: parsed.welcome_credits,
          daily_free_credits: parsed.daily_free_credits,
          tokens_per_credit: parsed.tokens_per_credit
        };
      }
    } catch {}
    return { balance: 50, tokensUsed: 0, totalPurchased: 0, plan: 'Étudiant Gratuit' };
  });

  // Liste globale de toutes les demandes utilisateur
  const [allRequests, setAllRequests] = useState<any[]>([]);

  // Chargement des données synchronisées (serveur et local)
  const loadData = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Configuration globale IA configurée par l'administrateur dans le Tableau de Bord
      try {
        const cfgRes = await getAiBillingConfig();
        if (cfgRes && cfgRes.success && cfgRes.config) {
          setBillingConfig(cfgRes.config);
        }
      } catch (errCfg) {
        console.warn('[AiSubscriptionsView] Erreur config facturation:', errCfg);
      }

      // 2. Quota de stockage et crédits IA
      const quotaRes = await getUserStorageQuota(currentUserId);
      if (quotaRes.success && quotaRes.data) {
        setQuotaData(quotaRes.data);
      }

      // 3. Demandes enregistrées sur le serveur
      const reqRes = await getUserStorageRequests(currentUserId);
      let serverReqs: any[] = [];
      if (reqRes && reqRes.success && Array.isArray(reqRes.requests)) {
        serverReqs = reqRes.requests;
      }

      // 4. Achats enregistrés sur le serveur (stockage & forfaits)
      const purRes = await getUserPurchasesHistory(currentUserId);
      let serverPurs: any[] = [];
      if (purRes && purRes.success && Array.isArray(purRes.purchases)) {
        serverPurs = [...purRes.purchases];
      }

      // 4b. Achats de crédits IA enregistrés dans la table user_ai_purchases (D1)
      try {
        const aiPurRes = await getUserAiPurchases(currentUserId);
        if (aiPurRes && aiPurRes.success && Array.isArray(aiPurRes.purchases)) {
          serverPurs = [...serverPurs, ...aiPurRes.purchases];
        }
      } catch (errAiPur) {
        console.warn('[AiSubscriptionsView] Erreur récupération achats IA:', errAiPur);
      }

      // 5. Demandes locales (sauvegardées lors des soumissions)
      let localReqs: any[] = [];
      try {
        const saved = localStorage.getItem('studycloud_ai_credit_requests');
        if (saved) localReqs = JSON.parse(saved);
      } catch {}

      // Fusionner en éliminant les doublons d'identifiant
      const allMap = new Map<string, any>();
      [...localReqs, ...serverReqs, ...serverPurs].forEach((item) => {
        if (item && (item.id || item.requestId)) {
          const key = item.id || item.requestId;
          allMap.set(key, item);
        }
      });

      const combined = Array.from(allMap.values()).sort(
        (a, b) => new Date(b.created_at || b.purchased_at || 0).getTime() - new Date(a.created_at || a.purchased_at || 0).getTime()
      );

      setAllRequests(combined);

      // Calcul dynamique des crédits achetés validés (uniquement crédits IA explicites)
      const totalApprovedCredits = combined
        .filter(r => (r.status === 'completed' || r.status === 'approved' || r.status === 'active' || r.status === 'confirmed') && r.credits_amount)
        .reduce((sum, r) => sum + (Number(r.credits_amount) || 0), 0);

      // Récupération du solde en direct, des tokens réels consommés et du portefeuille D1
      try {
        const liveRes = await getUserAiCreditsLive(currentUserId);
        if (liveRes && liveRes.success && liveRes.credits) {
          // RÈGLE ABSOLUE : La base D1 fait foi. Si rien n'a été acheté, c'est 0.
          const serverPurchased = Math.max(0, Number(liveRes.credits.totalPurchased || 0));
          const finalPurchased = serverPurchased;
          const serverBalance = Number(liveRes.credits.balance);

          setUserCredits({
            balance: serverBalance,
            tokensUsed: Number(liveRes.credits.tokensUsed || 0),
            totalPurchased: finalPurchased,
            plan: liveRes.credits.plan || (finalPurchased > 0 ? 'IA Pro Étudiant' : 'Étudiant Gratuit'),
            welcome_credits: liveRes.credits.welcome_credits,
            daily_free_credits: liveRes.credits.daily_free_credits,
            tokens_per_credit: liveRes.credits.tokens_per_credit
          });

          if (liveRes.credits.welcome_credits !== undefined) {
            setBillingConfig(prev => ({
              ...prev,
              welcome_credits: liveRes.credits.welcome_credits!,
              tokens_per_credit: liveRes.credits.tokens_per_credit || prev.tokens_per_credit,
              daily_free_credits: liveRes.credits.daily_free_credits !== undefined ? liveRes.credits.daily_free_credits : prev.daily_free_credits
            }));
          }

          try {
            localStorage.setItem(
              `studycloud_user_credits_${currentUserId}`,
              JSON.stringify({
                balance: serverBalance,
                tokensUsed: liveRes.credits.tokensUsed || 0,
                totalPurchased: finalPurchased,
                plan: liveRes.credits.plan,
                welcome_credits: liveRes.credits.welcome_credits,
                daily_free_credits: liveRes.credits.daily_free_credits,
                tokens_per_credit: liveRes.credits.tokens_per_credit
              })
            );
          } catch {}
        } else {
          setUserCredits(prev => ({
            ...prev,
            balance: Number(billingConfig.welcome_credits !== undefined ? billingConfig.welcome_credits : 50),
            totalPurchased: 0,
            plan: 'Étudiant Gratuit'
          }));
        }
      } catch (errLive) {
        setUserCredits(prev => ({
          ...prev,
          balance: Number(billingConfig.welcome_credits !== undefined ? billingConfig.welcome_credits : 50),
          totalPurchased: 0,
          plan: 'Étudiant Gratuit'
        }));
      }

      // 5. Charger les formules IA de la base D1
      try {
        setLoadingPlans(true);
        const plansRes = await getSubscriptionPlans();
        if (plansRes && plansRes.success && Array.isArray(plansRes.aiPlans)) {
          setAiPlans(plansRes.aiPlans);
        }
      } catch (errPlans) {
        console.warn('[AiSubscriptionsView] Erreur forfaits IA:', errPlans);
      } finally {
        setLoadingPlans(false);
      }

    } catch (err: any) {
      console.warn('[AiSubscriptionsView] Erreur lors du chargement des données:', err);
      setError(err?.message || "Erreur de synchronisation avec le serveur");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('studycloud_ai_credit_requests');
      const cacheKey = `studycloud_user_credits_${currentUserId}`;
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Number(parsed.totalPurchased || 0) > 0) {
          parsed.totalPurchased = 0;
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        }
      }
    } catch {}
    loadData();
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

  // Valeurs calculées dynamiquement depuis la base de données D1
  const welcomeCredits = userCredits.welcome_credits !== undefined
    ? Number(userCredits.welcome_credits)
    : Number(billingConfig.welcome_credits !== undefined ? billingConfig.welcome_credits : 50);
  const purchasedCredits = Math.max(0, Number(userCredits.totalPurchased || 0));
  const creditsRemaining = Math.max(0, Number(userCredits.balance || 0));
  const totalMaxCredits = Math.max(creditsRemaining, welcomeCredits + purchasedCredits);
  const creditsPercentage = totalMaxCredits > 0
    ? Math.min(100, Math.max(0, Math.round((creditsRemaining / totalMaxCredits) * 100)))
    : 0;
  const tokensPerCredit = Math.max(1, Number(billingConfig.tokens_per_credit || userCredits.tokens_per_credit || 1000));
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

  const wordsRemainingFormatted = quotaData?.wordsUsage?.formatted || `${(userCredits.balance * 1000).toLocaleString('fr-FR')} crédits`;

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

            {/* JAUGE CIRCULAIRE — colonne gauche */}
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
                    strokeDashoffset={loading ? circumference : strokeDashoffset}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s' }}
                  />
                  {/* Texte central */}
                  <text x="70" y="64" textAnchor="middle" className="font-black" fill="white" fontSize="22" fontWeight="900">
                    {loading ? '...' : `${creditsRemaining}`}
                  </text>
                  <text x="70" y="82" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="10">
                    disponibles
                  </text>
                </svg>
                <p className="text-white/80 text-xs mt-1 font-medium text-center">
                  {loading ? '...' : `${creditsRemaining} Crédits`}
                  <span className="text-white/50"> / </span>
                  {totalMaxCredits} Crédits au total
                </p>
              </div>
            </div>

            {/* STATS RAPIDES — colonnes centrale + droite (4 Cartes Glassmorphism) */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              {/* Crédits gratuits offerts */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-emerald-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Offerts de base</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white leading-none">
                  {welcomeCredits}
                </p>
                <p className="text-white/50 text-[10px] mt-1">Pack Bienvenue</p>
              </div>

              {/* Crédits achetés */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Achetés</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white leading-none">
                  {purchasedCredits}
                </p>
                <p className="text-white/50 text-[10px] mt-1">Extensions validées</p>
              </div>

              {/* Solde restant disponible */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Solde actif</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-amber-300 leading-none">
                  {creditsRemaining}
                </p>
                <p className="text-white/50 text-[10px] mt-1">Prêts à l'emploi</p>
              </div>

              {/* Volume de mots / Requêtes */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-purple-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Consommation</span>
                </div>
                <p className="text-xl md:text-2xl font-black text-white leading-none">
                  {userCredits.tokensUsed.toLocaleString('fr-FR')}
                </p>
                <p className="text-white/50 text-[10px] mt-1">Tokens IA utilisés</p>
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
              <span>{totalMaxCredits} Crédits</span>
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

          {/* ── CARTE RÉPARTITION DÉTAILLÉE DES USAGES IA ── */}
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* En-tête de la carte */}
            <div className="px-5 py-4 border-b border-stone-100 dark:border-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-slate-200">
                Répartition détaillée de vos usages IA
              </h2>
            </div>

            {/* Grille 2 colonnes */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100 dark:divide-slate-800">

              {/* Assistant d'Étude & Robot Rouge */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900">
                      <Bot className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">
                        Assistant Robot Rouge & Delmas IA
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5 leading-tight">
                        Questions, explications de cours, calculs & exercices
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[10px] rounded-lg border border-purple-200 dark:border-purple-900 shrink-0">
                    Actif
                  </span>
                </div>

                {/* Barre indicative */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-purple-600 dark:text-purple-400 text-base">
                      {creditsRemaining} crédits dispo
                    </span>
                    <span className="text-stone-500 dark:text-slate-400 text-[11px]">
                      1 crédit = {tokensPerCredit.toLocaleString('fr-FR')} tokens IA
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, creditsPercentage)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Modèles sécurisés à haute précision pédagogique (Gemini 2.0, Llama 3.3, LaTeX).</span>
                </div>
              </div>

              {/* Générateur de Fiches & Modules de cours */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                      <Layers className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">
                        Génération de Fiches & Modules
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5 leading-tight">
                        Fiches mémos, synthèses PDF, quiz d'auto-évaluation
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-lg border border-amber-200 dark:border-amber-900 shrink-0">
                    Prêt
                  </span>
                </div>

                {/* Barre indicative */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-amber-600 dark:text-amber-400 text-base">
                      {Math.round(creditsRemaining * tokensPerCredit).toLocaleString('fr-FR')} tokens restants
                    </span>
                    <span className="text-stone-500 dark:text-slate-400 text-[11px]">
                      Équivalence Formule 2
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, creditsPercentage)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-slate-800">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Chaque génération sauvegarde automatiquement le document dans vos dossiers.</span>
                </div>
              </div>
            </div>
          </div>

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
                  <span>Crédits offerts (Bienvenue)</span>
                </div>
                <span className="font-black text-stone-900 dark:text-white">
                  {welcomeCredits} Crédits
                </span>
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
                <span className="font-black text-stone-900 dark:text-white">
                  {purchasedCredits} Crédits
                </span>
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
                  <span>Tokens consommés</span>
                </div>
                <span className="font-bold text-stone-900 dark:text-white">
                  {userCredits.tokensUsed.toLocaleString('fr-FR')} tokens
                </span>
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
