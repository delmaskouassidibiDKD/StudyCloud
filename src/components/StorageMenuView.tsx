import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Zap,
  HardDrive,
  FileText,
  Layers,
  CheckCircle2,
  RefreshCw,
  X,
  Info,
  Gift,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Clock,
  XCircle,
  Server,
  Database,
  BarChart3,
  Upload
} from 'lucide-react';
import {
  getUserStorageQuota,
  requestStorageUpgrade,
  getUserStorageRequests,
  getUserPurchasesHistory,
  getSubscriptionPlans,
  SubscriptionPlan,
  UserStorageQuotaDetails
} from '../services/api';

interface StorageMenuViewProps {
  onBack: () => void;
  onOpenPricing?: (tab?: 'storage' | 'ai' | 'renewal') => void;
}

export const StorageMenuView: React.FC<StorageMenuViewProps> = ({ onBack, onOpenPricing }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageData, setStorageData] = useState<UserStorageQuotaDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeRequestTab, setActiveRequestTab] = useState<'pending' | 'history'>('pending');
  const [allRequests, setAllRequests] = useState<any[]>([]);

  // Vraies formules d'abonnements stockage issues de la base D1
  const [storagePlans, setStoragePlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  const loadStorage = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const currentUserId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const res = await getUserStorageQuota(currentUserId);
      if (res.success && res.data) {
        setStorageData(res.data);
      } else {
        setError(res.error || "Impossible de charger les données de stockage");
      }

      const reqRes = await getUserStorageRequests(currentUserId);
      let serverReqs: any[] = [];
      if (reqRes && reqRes.success && Array.isArray(reqRes.requests)) {
        serverReqs = reqRes.requests;
      }

      const purRes = await getUserPurchasesHistory(currentUserId);
      let serverPurs: any[] = [];
      if (purRes && purRes.success && Array.isArray(purRes.purchases)) {
        serverPurs = purRes.purchases;
      }

      let localReqs: any[] = [];
      try {
        const saved = localStorage.getItem('studycloud_storage_upgrade_requests');
        if (saved) localReqs = JSON.parse(saved);
      } catch {}

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

      // Charger les vraies formules de stockage D1
      try {
        setLoadingPlans(true);
        const plansRes = await getSubscriptionPlans();
        if (plansRes && plansRes.success && Array.isArray(plansRes.storagePlans)) {
          setStoragePlans(plansRes.storagePlans);
          if (plansRes.storagePlans.length > 0) {
            setSelectedPlanId(prev => prev || plansRes.storagePlans[0].id);
          }
        }
      } catch (errPlans) {
        console.warn("[StorageMenuView] Erreur chargement forfaits stockage:", errPlans);
      } finally {
        setLoadingPlans(false);
      }
    } catch (err: any) {
      console.error("[StorageMenuView] Erreur chargement:", err);
      setError(err?.message || "Erreur de connexion au serveur");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const pendingRequests = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'pending' || st === 'en_attente' || st === 'traitement' || st === 'soumis';
  });

  const approvedPurchases = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'completed' || st === 'approved' || st === 'active' || st === 'confirmed';
  });

  const rejectedRequests = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'rejected' || st === 'refused' || st === 'refusé' || st === 'annule' || st === 'annulé';
  });

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUpgrade(true);

    const chosenPlan = storagePlans.find(p => p.id === selectedPlanId) || storagePlans[0];
    const packName = chosenPlan?.name ? `Formule ${chosenPlan.name}` : 'Extension de Stockage';
    const additionalMb = chosenPlan?.storage_mb || 10240;
    const priceFcfa = Number(chosenPlan?.price) || 1000;

    try {
      const res = await requestStorageUpgrade({
        packId: chosenPlan?.id || 'storage_custom',
        packName: packName,
        additionalMb: additionalMb,
        additionalWords: 0,
        contactPhone: contactPhone.trim(),
        notes: upgradeNotes.trim(),
      });

      if (res.success) {
        try {
          const currentList = JSON.parse(localStorage.getItem('studycloud_storage_upgrade_requests') || '[]');
          currentList.unshift({
            id: `req-${Date.now()}`,
            pack_name: packName,
            additional_mb: additionalMb,
            price_display: `${priceFcfa.toLocaleString('fr-FR')} FCFA`,
            created_at: new Date().toISOString(),
            status: 'pending',
            payment_method: 'Mobile Money / Virement',
            contact_phone: contactPhone.trim(),
            notes: upgradeNotes.trim()
          });
          localStorage.setItem('studycloud_storage_upgrade_requests', JSON.stringify(currentList));
        } catch (e) {}

        setUpgradeSuccess(true);
        setTimeout(() => {
          setIsUpgradeModalOpen(false);
          setUpgradeSuccess(false);
          loadStorage(true);
        }, 1500);
      } else {
        alert(res.message || "Erreur lors de l'enregistrement de votre demande.");
      }
    } catch (err: any) {
      alert(err?.message || "Une erreur est survenue lors de la demande d'extension.");
    } finally {
      setSubmittingUpgrade(false);
    }
  };

  // Valeurs calculées
  const welcomeMb = storageData?.welcomeStorage.totalMb ?? 100;
  const paidMb = storageData?.paidStorage.totalMb ?? 0;
  const totalAllowedMb = storageData?.totalAllowedMb ?? 100;
  // RÈGLE STRICTE : Le stockage utilisé affiché (devant) ne doit JAMAIS dépasser le quota autorisé (derrière) : used <= allowed
  const rawUsedMb = storageData?.totalUsedMb ?? 0;
  const totalUsedMb = Math.min(rawUsedMb, totalAllowedMb);
  const totalPercentage = Math.min(100, storageData?.totalPercentage ?? (totalAllowedMb > 0 ? Math.round((totalUsedMb / totalAllowedMb) * 100) : 0));
  const isStorageSaturated = rawUsedMb >= totalAllowedMb;
  const filesStorage = storageData?.filesStorage;
  const dataStorage = storageData?.dataStorage;

  // Couleur de la jauge selon le pourcentage
  const gaugeColor = totalPercentage >= 90
    ? '#ef4444'
    : totalPercentage >= 70
    ? '#f59e0b'
    : '#10b981';

  // Formatage propre du prix d'un forfait
  const formatPlanPrice = (plan: SubscriptionPlan) => {
    const isOneTime = plan.pricing_model === 'one_time' || plan.pricing_model === 'pack';
    const currSymbol = plan.primary_currency === 'XOF' ? 'FCFA' : plan.primary_currency === 'EUR' ? '€' : plan.primary_currency === 'USD' ? '$' : (plan.primary_currency || 'FCFA');
    const formattedPrice = (Number(plan.price) || 0).toLocaleString('fr-FR');
    if (isOneTime) {
      return `${formattedPrice} ${currSymbol}`;
    }
    return `${formattedPrice} ${currSymbol} / mois`;
  };

  // Arc SVG pour la jauge circulaire
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(totalPercentage, 100) / 100) * circumference;

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F5F2EC] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto overflow-x-hidden transition-colors duration-300">

      {/* ======================================================================
          HERO HEADER — occupe entièrement la zone marron en haut
          ====================================================================== */}
      <div className="relative w-full bg-gradient-to-br from-[#7C4D1E] via-[#A0622A] to-[#6B3D14] dark:from-[#1a0e06] dark:via-[#2d1a0a] dark:to-[#0f0805] overflow-hidden">
        {/* Motif décoratif en fond */}
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
          <div className="absolute top-2 right-8 w-64 h-64 rounded-full bg-amber-300 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-orange-400 blur-2xl" />
          <div className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 15% 50%, rgba(255,200,80,0.12) 0%, transparent 50%),
                radial-gradient(circle at 85% 20%, rgba(255,140,40,0.10) 0%, transparent 40%)`
            }}
          />
        </div>

        {/* Contenu du header */}
        <div className="relative z-10 px-5 md:px-8 py-4 md:py-5">

          {/* Ligne de contrôles : retour | titre | actualiser | bouton augmenter */}
          <div className="flex items-center justify-between gap-3 mb-4">
            {/* Gauche : retour + refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl border border-white/30 backdrop-blur-sm transition-all cursor-pointer active:scale-95"
                title="Retour"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Retour</span>
              </button>
              <button
                onClick={() => loadStorage(true)}
                disabled={refreshing || loading}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/30 backdrop-blur-sm transition-all cursor-pointer disabled:opacity-50"
                title="Actualiser"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-300' : ''}`} />
              </button>
            </div>

            {/* Centre : titre */}
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-amber-300" />
              <h1 className="text-white font-black text-base md:text-lg tracking-tight">Mon Stockage</h1>
            </div>

            {/* Droite : bouton augmenter */}
            <button
              onClick={() => {
                if (onOpenPricing) {
                  onOpenPricing('storage');
                } else {
                  window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                  setIsUpgradeModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 font-extrabold text-xs md:text-sm rounded-xl border-2 border-white/30 shadow-[0_4px_15px_rgba(251,146,60,0.5)] transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Augmenter mon stockage"
            >
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
              <span className="hidden sm:inline">+ Augmenter mon stockage</span>
              <span className="sm:hidden">+ Stockage</span>
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
                    {loading ? '...' : `${totalPercentage}%`}
                  </text>
                  <text x="70" y="82" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10">
                    utilisé
                  </text>
                </svg>
                <p className="text-white/80 text-xs mt-1 font-medium text-center">
                  {loading ? '...' : (isStorageSaturated ? (storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`) : (storageData?.totalUsedFormatted || `${totalUsedMb} Mo`))}
                  <span className="text-white/50"> / </span>
                  {storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`}
                </p>
              </div>
            </div>

            {/* STATS RAPIDES — colonnes centrale + droite */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              {/* Stockage gratuit offert */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-emerald-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Gratuit offert</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white leading-none">
                  {storageData?.welcomeStorage?.formatted || `${welcomeMb} Mo`}
                </p>
                <p className="text-white/50 text-[10px] mt-1">Plan de base</p>
              </div>

              {/* Stockage acheté */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Acheté</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white leading-none">
                  {paidMb > 0 ? (storageData?.paidStorage?.formatted || `${paidMb} Mo`) : '0 Mo'}
                </p>
                <p className="text-white/50 text-[10px] mt-1">Extensions actives</p>
              </div>

              {/* Fichiers R2 */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-sky-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Fichiers</span>
                </div>
                <p className="text-xl md:text-2xl font-black text-white leading-none">
                  {filesStorage?.usedFormatted || '0 o'}
                </p>
                <p className="text-white/50 text-[10px] mt-1">{filesStorage?.count ?? 0} fichier(s)</p>
              </div>

              {/* Données D1 */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-violet-300" />
                  <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Données</span>
                </div>
                <p className="text-xl md:text-2xl font-black text-white leading-none">
                  {dataStorage?.usedFormatted || '0 o'}
                </p>
                <p className="text-white/50 text-[10px] mt-1">{dataStorage?.count ?? 0} élément(s)</p>
              </div>
            </div>
          </div>

          {/* Barre de progression large en bas du hero */}
          <div className="mt-4 md:mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>0</span>
              <span className="font-semibold text-white/80">
                {totalPercentage < 70 ? '✓ Espace disponible confortable' : totalPercentage < 90 ? '⚠ Espace en cours de saturation' : totalPercentage < 100 ? '🔴 Espace presque saturé' : '⛔ Espace saturé (100% atteint) — Importations bloquées'}
              </span>
              <span>{storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`}</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full border border-white/20 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(totalPercentage > 0 ? 2 : 0, Math.min(100, totalPercentage))}%`,
                  background: totalPercentage >= 90
                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                    : totalPercentage >= 70
                    ? 'linear-gradient(90deg, #10b981, #f59e0b)'
                    : 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)',
                  boxShadow: `0 0 12px ${gaugeColor}88`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          CORPS PRINCIPAL — layout 2 colonnes sur desktop
          ====================================================================== */}
      <div className="px-4 md:px-6 lg:px-8 py-5 grid grid-cols-1 xl:grid-cols-3 gap-5 max-w-[1600px] mx-auto">

        {/* ── COLONNE GAUCHE (2/3 de la largeur) ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Alerte Espace Saturé */}
          {isStorageSaturated && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500/60 rounded-2xl flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                <span>
                  <strong>Votre espace de stockage est plein ({storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`}).</strong> Tout nouvel import de fichier est bloqué pour protéger votre compte. Libérez de l'espace ou augmentez votre quota.
                </span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-xs shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Augmenter
              </button>
            </div>
          )}

          {/* Message d'erreur */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-500/60 rounded-2xl flex items-center justify-between gap-3 text-red-700 dark:text-red-300 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => loadStorage(false)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* ── CARTE RÉPARTITION DÉTAILLÉE ── */}
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* En-tête de la carte */}
            <div className="px-5 py-4 border-b border-stone-100 dark:border-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-slate-200">
                Répartition détaillée de vos stockages
              </h2>
            </div>

            {/* Grille 2 colonnes */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100 dark:divide-slate-800">

              {/* Stockage Documents & Fichiers */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">
                        {filesStorage?.name || 'Stockage Documents & Fichiers'}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5 leading-tight">
                        {filesStorage?.subtitle || 'Cours, devoirs, polycopiés, PDF'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[10px] rounded-lg border border-blue-200 dark:border-blue-900 shrink-0">
                    {filesStorage?.count ?? 0} fichier(s)
                  </span>
                </div>

                {/* Barre de progression fichiers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-blue-600 dark:text-blue-400 text-lg">
                      {filesStorage?.usedFormatted || '0 o'}
                    </span>
                    <span className="text-stone-500 dark:text-slate-400 text-[11px]">
                      {filesStorage?.percentage ?? 0}% du quota global
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, filesStorage?.percentage ?? 0)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Les ressources partagées dans la bibliothèque publique ne sont pas décomptées de votre espace personnel.</span>
                </div>
              </div>

              {/* Espace Données & Fiches d'Étude */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                      <Layers className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">
                        {dataStorage?.name || "Espace Données & Fiches d'Étude"}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5 leading-tight">
                        {dataStorage?.subtitle || 'Fiches, notes, emploi du temps, relevés'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-lg border border-amber-200 dark:border-amber-900 shrink-0">
                    {dataStorage?.count ?? 0} élément(s)
                  </span>
                </div>

                {/* Barre de progression données */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-amber-600 dark:text-amber-400 text-lg">
                      {dataStorage?.usedFormatted || '0 o'}
                    </span>
                    <span className="text-stone-500 dark:text-slate-400 text-[11px]">
                      {dataStorage?.percentage ?? 0}% du quota global
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, dataStorage?.percentage ?? 0)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-slate-800">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Fiches mémos, notes de cours, planning, relevés de notes et contenus enregistrés.</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ONGLETS DEMANDES ── */}
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Onglets header */}
            <div className="flex items-center gap-0 border-b border-stone-100 dark:border-slate-800">
              <button
                onClick={() => setActiveRequestTab('pending')}
                className={`flex items-center gap-2 px-5 py-3.5 font-bold text-xs sm:text-sm transition-all cursor-pointer border-b-2 flex-1 justify-center ${
                  activeRequestTab === 'pending'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Demandes en cours</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeRequestTab === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300'
                }`}>
                  {pendingRequests.length}
                </span>
              </button>

              <div className="w-px h-8 bg-stone-100 dark:bg-slate-800" />

              <button
                onClick={() => setActiveRequestTab('history')}
                className={`flex items-center gap-2 px-5 py-3.5 font-bold text-xs sm:text-sm transition-all cursor-pointer border-b-2 flex-1 justify-center ${
                  activeRequestTab === 'history'
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Achats validés & Refus</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeRequestTab === 'history'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300'
                }`}>
                  {approvedPurchases.length + rejectedRequests.length}
                </span>
              </button>
            </div>

            {/* Contenu onglet */}
            <div className="p-5">

              {/* ONGLET : Demandes en cours */}
              {activeRequestTab === 'pending' && (
                <div>
                  {pendingRequests.length === 0 ? (
                    <div className="py-10 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 mx-auto flex items-center justify-center">
                        <Clock className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-stone-900 dark:text-white">Aucune demande en cours</h3>
                        <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                          Lorsque vous souscrivez à une extension, elle s'affiche ici pendant la vérification du paiement.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (onOpenPricing) onOpenPricing('storage');
                          else window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer hover:scale-105"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Découvrir les formules</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {pendingRequests.map((req, idx) => (
                        <div key={req.id || idx} className="rounded-2xl p-5 border-2 border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-600/40 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ⏳ En cours de validation
                              </span>
                              <h4 className="text-sm font-black text-stone-900 dark:text-white mt-1.5">
                                {req.pack_name || req.packName || 'Extension de Stockage'}
                              </h4>
                            </div>
                            <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                              {req.price_display || `${(req.price_paid || req.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                            </span>
                          </div>
                          <div className="text-xs text-stone-600 dark:text-slate-300 space-y-1 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-stone-200 dark:border-slate-800">
                            <div className="flex justify-between">
                              <span className="text-stone-400">Soumis le :</span>
                              <span className="font-bold">{req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Récemment'}</span>
                            </div>
                            {req.payment_method && (
                              <div className="flex justify-between">
                                <span className="text-stone-400">Paiement :</span>
                                <span className="font-bold">{req.payment_method}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>Votre reçu est en cours d'inspection par l'équipe DKD Technologies.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET : Achats validés & refus */}
              {activeRequestTab === 'history' && (
                <div className="space-y-5">
                  {/* Achats validés */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Achats validés & extensions actives ({approvedPurchases.length})
                    </h3>
                    {approvedPurchases.length === 0 ? (
                      <div className="py-6 text-center bg-stone-50 dark:bg-slate-900/40 rounded-2xl border border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 text-xs">
                        Aucun achat validé pour le moment.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {approvedPurchases.map((pur, idx) => (
                          <div key={pur.id || idx} className="rounded-2xl p-5 border-2 border-emerald-400/60 bg-emerald-50/30 dark:bg-emerald-950/10 dark:border-emerald-600/40 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                  ✅ Validé & Activé
                                </span>
                                <h4 className="text-sm font-black text-stone-900 dark:text-white mt-1.5">
                                  {pur.pack_name || pur.packName || 'Extension de Stockage StudyCloud'}
                                </h4>
                              </div>
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {pur.price_display || `${(pur.price_paid || pur.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                              </span>
                            </div>
                            {pur.additional_mb && (
                              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900">
                                +{pur.additional_mb >= 1024 ? `${(pur.additional_mb / 1024).toFixed(0)} Go` : `${pur.additional_mb} Mo`} ajouté à votre espace
                              </div>
                            )}
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
                          <div key={rej.id || idx} className="rounded-2xl p-5 border-2 border-red-400/50 bg-red-50/30 dark:bg-red-950/10 dark:border-red-600/40 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700">
                                  ❌ Non validée
                                </span>
                                <h4 className="text-sm font-black text-stone-900 dark:text-white mt-1.5">
                                  {rej.pack_name || rej.packName || 'Demande de Stockage'}
                                </h4>
                              </div>
                            </div>
                            <p className="text-xs text-stone-600 dark:text-slate-300 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                              {rej.admin_notes || rej.notes || "Le reçu ou la référence n'a pas pu être validé. Vous pouvez réitérer votre demande."}
                            </p>
                            <button
                              onClick={() => {
                                if (onOpenPricing) onOpenPricing('storage');
                                else window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                              }}
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

          {/* CTA Augmenter le stockage */}
          <div className="bg-gradient-to-br from-[#7C4D1E] to-[#A0622A] dark:from-[#2d1a0a] dark:to-[#1a0e06] rounded-3xl p-5 border border-amber-800/40 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-amber-300" />
                <h3 className="text-white font-black text-sm">Besoin de plus d'espace ?</h3>
              </div>
              <p className="text-white/70 text-xs leading-relaxed">
                Augmentez votre espace de stockage pour enregistrer tous vos cours, devoirs et documents sans contrainte.
              </p>

              {/* Vraies formules de stockage issues de la base D1 */}
              {loadingPlans ? (
                <div className="space-y-2 py-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white/10 rounded-xl p-3 animate-pulse h-14 border border-white/10" />
                  ))}
                </div>
              ) : storagePlans.length === 0 ? (
                <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 text-center space-y-1">
                  <p className="text-white/90 text-xs font-bold">Consultez nos formules de stockage</p>
                  <p className="text-white/60 text-[10px]">Découvrez les forfaits disponibles dans l'espace abonnement.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {storagePlans.map((plan) => {
                    const storageDisplay = plan.storage_amount || (plan.storage_mb ? `${plan.storage_mb >= 1024 ? (plan.storage_mb / 1024).toFixed(0) + ' Go' : plan.storage_mb + ' Mo'} supplémentaires` : 'Extension');
                    const isOneTime = plan.pricing_model === 'one_time' || plan.pricing_model === 'pack';
                    const hasBadge = !!(plan.badge && plan.badge.trim());

                    return (
                      <div
                        key={plan.id}
                        onClick={() => {
                          if (onOpenPricing) onOpenPricing('storage');
                          else window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                        }}
                        className={`rounded-xl p-3 flex items-center justify-between border transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          hasBadge
                            ? 'bg-amber-500/30 border-amber-400/60 shadow-sm'
                            : 'bg-white/10 hover:bg-white/15 border-white/10'
                        }`}
                        title="Cliquer pour voir la formule et souscrire"
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
                          <p className="text-white/75 text-[11px] font-semibold flex items-center gap-1">
                            <span>{storageDisplay}</span>
                            {isOneTime && <span className="text-white/50 text-[10px] font-normal">• Unique</span>}
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
                onClick={() => {
                  if (onOpenPricing) onOpenPricing('storage');
                  else {
                    window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                    setIsUpgradeModalOpen(true);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-white/30 shadow-[0_4px_15px_rgba(251,146,60,0.4)] transition-all cursor-pointer hover:scale-105 active:scale-95 mt-1"
              >
                <Upload className="w-4 h-4" />
                Augmenter mon espace
              </button>
            </div>
          </div>

          {/* Infos sur les quotas */}
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl p-5 border-2 border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-stone-100 dark:border-slate-800 pb-3">
              <TrendingUp className="w-4 h-4 text-stone-600 dark:text-slate-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-slate-300">Détail du quota</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <Gift className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Stockage offert</span>
                </div>
                <span className="font-black text-stone-900 dark:text-white">
                  {storageData?.welcomeStorage?.formatted || `${welcomeMb} Mo`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  <span>Extensions achetées</span>
                </div>
                <span className="font-black text-stone-900 dark:text-white">
                  {storageData?.paidStorage?.formatted || '0 Mo'}
                </span>
              </div>
              <div className="h-px bg-stone-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-700 dark:text-slate-300">
                  <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-bold">Total disponible</span>
                </div>
                <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                  {storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <Server className="w-3.5 h-3.5 text-sky-500" />
                  <span>Fichiers occupés</span>
                </div>
                <span className="font-bold text-stone-900 dark:text-white">
                  {filesStorage?.usedFormatted || '0 o'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-400">
                  <Database className="w-3.5 h-3.5 text-violet-500" />
                  <span>Données occupées</span>
                </div>
                <span className="font-bold text-stone-900 dark:text-white">
                  {dataStorage?.usedFormatted || '0 o'}
                </span>
              </div>
              <div className="h-px bg-stone-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-700 dark:text-slate-300">
                  <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
                  <span className="font-bold">Total utilisé</span>
                </div>
                <span className="font-black text-stone-900 dark:text-white text-sm">
                  {storageData?.totalUsedFormatted || `${totalUsedMb} Mo`}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Données chiffrées — Plan : <strong className="text-stone-700 dark:text-slate-300">{storageData?.planName || 'Plan Étudiant Gratuit'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          MODALE D'AUGMENTATION DE STOCKAGE
          ====================================================================== */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-800 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 relative overflow-hidden">
            <button
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <span className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                <Zap className="w-6 h-6 fill-current" />
              </span>
              <div>
                <h3 className="text-lg font-black text-stone-900 dark:text-white">Augmenter mon stockage</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400">Choisissez la formule idéale pour débloquer plus d'espace</p>
              </div>
            </div>

            {upgradeSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-base font-extrabold text-stone-900 dark:text-white">Demande enregistrée !</h4>
                <p className="text-xs text-stone-500 dark:text-slate-400">Votre compte sera mis à jour dès validation.</p>
              </div>
            ) : (
              <form onSubmit={handleUpgradeSubmit} className="space-y-4">
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase text-stone-600 dark:text-slate-400">Sélectionnez une formule</label>

                  {storagePlans.length > 0 ? (
                    storagePlans.map((plan) => {
                      const storageDisplay = plan.storage_amount || (plan.storage_mb ? `${plan.storage_mb >= 1024 ? (plan.storage_mb / 1024).toFixed(0) + ' Go' : plan.storage_mb + ' Mo'} supplémentaires` : 'Extension');
                      const isSelected = selectedPlanId === plan.id;
                      const hasBadge = !!(plan.badge && plan.badge.trim());

                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 relative ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                              : 'border-stone-200 dark:border-slate-800 hover:border-stone-300'
                          }`}
                        >
                          {hasBadge && (
                            <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider">
                              {plan.badge}
                            </span>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-stone-900 dark:text-white">{plan.name}</span>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400">
                                {storageDisplay}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                              {storageDisplay} pour votre espace personnel StudyCloud
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-black text-stone-900 dark:text-white">
                              {formatPlanPrice(plan)}
                            </span>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-400'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-stone-500">
                      Chargement des formules disponibles...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-slate-300">Numéro WhatsApp (optionnel)</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border-2 border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-900 text-stone-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUpgrade}
                    className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submittingUpgrade ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
                    <span>Confirmer la demande</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
