import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Zap, ArrowLeft, RefreshCw, Clock, CheckCircle2, XCircle, 
  HelpCircle, CreditCard, ChevronRight, FileText, ArrowRight, ShieldCheck, 
  ExternalLink, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getUserStorageQuota, 
  getUserStorageRequests, 
  getUserPurchasesHistory, 
  deleteUserRequestHistory,
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

  // Quota de stockage et mots IA
  const [quotaData, setQuotaData] = useState<UserStorageQuotaDetails | null>(null);

  // Solde de crédits de l'utilisateur
  const [userCredits, setUserCredits] = useState<{
    balance: number;
    tokensUsed: number;
    totalPurchased: number;
    plan: string;
  }>(() => {
    try {
      const saved = localStorage.getItem(`studycloud_user_credits_${currentUserId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { balance: 50, tokensUsed: 1250, totalPurchased: 0, plan: 'Étudiant Gratuit' };
  });

  // Liste globale de toutes les demandes utilisateur
  const [allRequests, setAllRequests] = useState<any[]>([]);

  // Chargement des données synchronisées (serveur et local)
  const loadData = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Quota de stockage et mots IA
      const quotaRes = await getUserStorageQuota(currentUserId);
      if (quotaRes.success && quotaRes.data) {
        setQuotaData(quotaRes.data);
      }

      // 2. Demandes enregistrées sur le serveur
      const reqRes = await getUserStorageRequests(currentUserId);
      let serverReqs: any[] = [];
      if (reqRes && reqRes.success && Array.isArray(reqRes.requests)) {
        serverReqs = reqRes.requests;
      }

      // 3. Achats enregistrés sur le serveur
      const purRes = await getUserPurchasesHistory(currentUserId);
      let serverPurs: any[] = [];
      if (purRes && purRes.success && Array.isArray(purRes.purchases)) {
        serverPurs = purRes.purchases;
      }

      // 4. Demandes locales (sauvegardées lors des soumissions)
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

      // Calcul dynamique des crédits achetés validés
      const totalApprovedCredits = combined
        .filter(r => r.status === 'completed' || r.status === 'approved' || r.status === 'active' || r.status === 'confirmed')
        .reduce((sum, r) => sum + (Number(r.credits_amount) || Number(r.additional_words ? r.additional_words / 1000 : 0) || 0), 0);

      setUserCredits(prev => {
        const next = {
          ...prev,
          balance: 50 + totalApprovedCredits,
          totalPurchased: totalApprovedCredits,
          plan: totalApprovedCredits > 0 ? 'IA Pro Étudiant' : 'Étudiant Gratuit'
        };
        try {
          localStorage.setItem(`studycloud_user_credits_${currentUserId}`, JSON.stringify(next));
        } catch {}
        return next;
      });

    } catch (err) {
      console.warn('[AiSubscriptionsView] Erreur lors du chargement des données:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
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

  const totalMaxCredits = 50 + (userCredits.totalPurchased || 0);
  const creditsRemaining = Math.max(0, userCredits.balance);
  const creditsPercentage = totalMaxCredits > 0
    ? Math.min(100, Math.max(0, Math.round((creditsRemaining / totalMaxCredits) * 100)))
    : 0;

  // Si l'utilisateur clique sur "Recharger", afficher le menu officiel de tarification
  if (showPricingView) {
    return (
      <PricingView 
        initialTab="ai" 
        onBack={() => {
          setShowPricingView(false);
          loadData();
        }} 
        onSelectPlan={(plan) => {}} 
      />
    );
  }

  const wordsRemainingFormatted = quotaData?.wordsUsage?.formatted || `${(userCredits.balance * 1000).toLocaleString('fr-FR')} mots restants`;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* ========================================================================= */}
      {/* BARRE SUPÉRIEURE : Bouton Retour (gauche), Titre (centre), Recharger (droite) */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-2 pt-2 px-1">
        {/* Bouton Retour à gauche */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              title="Retour au tableau de bord"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Retour</span>
            </button>
          )}

          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="p-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer disabled:opacity-50"
            title="Actualiser les crédits"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>

        {/* Titre au centre */}
        <h1 className="font-sans text-xs sm:text-sm md:text-base font-extrabold text-stone-900 dark:text-stone-900 bg-amber-400 dark:bg-amber-500 px-3.5 py-1.5 rounded-xl border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate">
          Mes Crédits IA
        </h1>

        {/* Bouton "Recharger mes crédits" dans l'angle supérieur droit */}
        <div>
          <button
            onClick={handleOpenPricing}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer animate-pulse hover:animate-none"
            title="Choisir une formule ou demander des crédits"
          >
            <Zap className="w-3.5 h-3.5 fill-current text-white" />
            <span>Recharger mes crédits</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARTE PRINCIPALE : SOLDE DE CRÉDITS IA RESTANTS & CONSOMMATION */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#131b2e] rounded-3xl p-5 sm:p-7 border-2 border-stone-800 dark:border-slate-800 shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-stone-200 dark:border-slate-800">
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-white">
              Portefeuille de Crédits IA
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Surveillez vos crédits disponibles pour discuter avec Delmas IA et générer vos modules de cours
            </p>
          </div>

          {/* Affichage Chiffré du Solde Actuel */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-[#1e293b] dark:to-[#0f172a] border-2 border-stone-800 dark:border-orange-500/50 rounded-2xl p-4 sm:p-5 shadow-[2px_2px_0px_0px_#1c1917] text-center min-w-[220px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-slate-400">
              Solde Restant Disponible
            </div>
            <div className="text-3xl sm:text-4xl font-black text-orange-600 dark:text-orange-400 mt-1">
              {userCredits.balance} <span className="text-sm font-bold text-stone-700 dark:text-slate-300">Crédits</span>
            </div>
          </div>
        </div>

        {/* Détails et badges de répartition : Crédits Offerts & Crédits Achetés */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-5">
          <div className="p-3.5 bg-stone-50 dark:bg-slate-900/60 rounded-2xl border border-stone-200 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
              🎁
            </div>
            <div>
              <div className="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider">
                Crédits Offerts
              </div>
              <div className="text-sm font-black text-stone-800 dark:text-white">
                50 Crédits Gratuits
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-stone-50 dark:bg-slate-900/60 rounded-2xl border border-stone-200 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider">
                Crédits Achetés
              </div>
              <div className="text-sm font-black text-stone-800 dark:text-white">
                {userCredits.totalPurchased > 0 ? `${userCredits.totalPurchased} Crédits achetés` : '0 Crédit acheté'}
              </div>
            </div>
          </div>
        </div>

        {/* LIGNE DE CRÉDITS QUI SE REMPLIT ET DIMINUE AVEC L'USAGE (STYLE MON STOCKAGE) */}
        <div className="mt-5 space-y-2 pt-4 border-t border-stone-200 dark:border-slate-800">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
                {creditsRemaining} Crédits
              </span>
              <span className="text-xs sm:text-sm font-semibold text-stone-500 dark:text-slate-400">
                disponibles sur <strong className="text-stone-800 dark:text-slate-200">{totalMaxCredits} Crédits au total</strong>
              </span>
            </div>
            <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
              {creditsPercentage}%
            </span>
          </div>

          {/* Barre de progression remplie qui diminue quand les crédits sont utilisés */}
          <div className="w-full h-4 sm:h-5 bg-stone-100 dark:bg-slate-900 rounded-full border border-stone-300 dark:border-slate-800 overflow-hidden p-0.5 relative shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 shadow-sm"
              style={{ width: `${Math.max(creditsPercentage > 0 ? 3 : 0, Math.min(100, creditsPercentage))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400 pt-1">
            <span>0 Crédit</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {creditsRemaining > 0 ? 'Crédits actifs et prêts à l\'emploi' : 'Solde épuisé'}
            </span>
            <span>{totalMaxCredits} Crédits</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SÉLECTEUR D'ONGLETS UTILISATEUR (Demandes en cours vs Achats & Refus) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b-2 border-stone-300 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all border-2 cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
              : 'bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-300 dark:border-slate-700 hover:bg-stone-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Mes demandes en cours</span>
          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
            activeTab === 'pending'
              ? 'bg-white text-stone-900'
              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
          }`}>
            {pendingRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all border-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-amber-500 text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
              : 'bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-300 dark:border-slate-700 hover:bg-stone-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Mes achats validés & Refus</span>
          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
            activeTab === 'history'
              ? 'bg-white text-stone-900'
              : 'bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-white'
          }`}>
            {approvedPurchases.length + rejectedRequests.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : MES DEMANDES EN COURS DE VALIDATION */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="bg-white dark:bg-[#131b2e] rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-stone-300 dark:border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 mx-auto flex items-center justify-center">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">
                Aucune demande en cours de validation
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 max-w-md mx-auto">
                Lorsque vous souscrivez à une formule d'abonnement ou effectuez une demande de crédits supplémentaires, elle s'affiche ici pendant la vérification de votre reçu de paiement.
              </p>
              <button
                onClick={handleOpenPricing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs sm:text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Découvrir les formules IA</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map((req, idx) => (
                <div 
                  key={req.id || idx}
                  className="bg-white dark:bg-[#131b2e] rounded-2xl p-5 border-2 border-amber-500/80 dark:border-amber-500/60 shadow-[3px_3px_0px_0px_#f59e0b] dark:shadow-none space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        ⏳ En cours de validation
                      </span>
                      <h4 className="text-base font-black text-stone-900 dark:text-white mt-1.5">
                        {req.pack_name || req.packName || 'Demande de Crédits IA'}
                      </h4>
                    </div>
                    <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                      {req.price_display || `${(req.price_paid || req.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                    </span>
                  </div>

                  <div className="text-xs text-stone-600 dark:text-slate-300 space-y-1 bg-stone-50 dark:bg-slate-900/60 p-3 rounded-xl border border-stone-200 dark:border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-stone-400">Date de soumission :</span>
                      <span className="font-bold">{req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Récemment'}</span>
                    </div>
                    {req.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">Moyen de paiement :</span>
                        <span className="font-bold">{req.payment_method}</span>
                      </div>
                    )}
                    {req.payment_reference && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">Référence / Reçu :</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{req.payment_reference}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Votre reçu est en cours d'inspection par l'équipe DKD Technologies. Vos crédits seront crédités dès validation.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : MES ACHATS VALIDÉS & REFUS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Section 1 : Achats validés et actifs */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Achats validés & Formules actives ({approvedPurchases.length})</span>
            </h3>

            {approvedPurchases.length === 0 ? (
              <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 text-center border border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 text-xs">
                Aucun achat validé pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {approvedPurchases.map((pur, idx) => (
                  <div 
                    key={pur.id || idx}
                    className="bg-white dark:bg-[#131b2e] rounded-2xl p-5 border-2 border-emerald-500/70 shadow-[3px_3px_0px_0px_#10b981] dark:shadow-none space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          ✅ Achat Validé & Activé
                        </span>
                        <h4 className="text-base font-black text-stone-900 dark:text-white mt-1.5">
                          {pur.pack_name || pur.packName || 'Abonnement IA StudyCloud'}
                        </h4>
                      </div>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {pur.price_display || `${(pur.price_paid || pur.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </div>

                    <div className="text-xs text-stone-600 dark:text-slate-300 space-y-1 bg-stone-50 dark:bg-slate-900/60 p-3 rounded-xl border border-stone-200 dark:border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-stone-400">Activé le :</span>
                        <span className="font-bold">{pur.confirmed_at || pur.updated_at || pur.created_at ? new Date(pur.confirmed_at || pur.updated_at || pur.created_at).toLocaleDateString('fr-FR') : 'Confirmé'}</span>
                      </div>
                      {pur.additional_words ? (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Volume accordé :</span>
                          <span className="font-bold text-emerald-600">+{Number(pur.additional_words).toLocaleString('fr-FR')} mots IA</span>
                        </div>
                      ) : null}
                      {pur.payment_reference && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Réf transaction :</span>
                          <span className="font-mono text-stone-700 dark:text-slate-300">{pur.payment_reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2 : Demandes refusées */}
          <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5 px-1">
              <XCircle className="w-4 h-4" />
              <span>Demandes non validées ou refusées ({rejectedRequests.length})</span>
            </h3>

            {rejectedRequests.length === 0 ? (
              <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 text-center border border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 text-xs">
                Aucune demande refusée.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rejectedRequests.map((rej, idx) => (
                  <div 
                    key={rej.id || idx}
                    className="bg-white dark:bg-[#131b2e] rounded-2xl p-5 border-2 border-red-400/60 dark:border-red-500/40 shadow-[3px_3px_0px_0px_#ef4444] dark:shadow-none space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700">
                          ❌ Demande non validée
                        </span>
                        <h4 className="text-base font-black text-stone-900 dark:text-white mt-1.5">
                          {rej.pack_name || rej.packName || 'Demande de Crédits'}
                        </h4>
                      </div>
                      <span className="text-sm font-bold text-stone-500">
                        {rej.price_display || `${(rej.price_paid || rej.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-slate-300 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                      {rej.admin_notes || rej.notes || "Le reçu ou la référence de transaction n'a pas pu être vérifié avec les données de paiement Mobile Money. Vous pouvez réitérer votre demande avec une capture claire."}
                    </p>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleOpenPricing}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Réitérer la demande
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fin des onglets demandes et achats */}
    </div>
  );
};
