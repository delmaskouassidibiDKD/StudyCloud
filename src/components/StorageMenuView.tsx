import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
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
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Clock,
  XCircle
} from 'lucide-react';
import {
  getUserStorageQuota,
  requestStorageUpgrade,
  getUserStorageRequests,
  getUserPurchasesHistory,
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

  // Onglets pour l'utilisateur : "Demandes en cours" vs "Achats validés & Refus"
  const [activeRequestTab, setActiveRequestTab] = useState<'pending' | 'history'>('pending');
  const [allRequests, setAllRequests] = useState<any[]>([]);

  // État de la modale "Augmenter mon stockage"
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<'pack_1gb' | 'pack_5gb' | 'pack_10gb'>('pack_5gb');
  const [contactPhone, setContactPhone] = useState('');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  // Chargement des vraies données depuis la base de données via le worker principal
  const loadStorage = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const currentUserId = localStorage.getItem('unifolder_user_id') || 'default-user';
      
      // 1. Quota de stockage
      const res = await getUserStorageQuota(currentUserId);
      if (res.success && res.data) {
        setStorageData(res.data);
      } else {
        setError(res.error || "Impossible de charger les données de stockage");
      }

      // 2. Demandes d'augmentation de stockage sur le serveur
      const reqRes = await getUserStorageRequests(currentUserId);
      let serverReqs: any[] = [];
      if (reqRes && reqRes.success && Array.isArray(reqRes.requests)) {
        serverReqs = reqRes.requests;
      }

      // 3. Achats de stockage enregistrés sur le serveur
      const purRes = await getUserPurchasesHistory(currentUserId);
      let serverPurs: any[] = [];
      if (purRes && purRes.success && Array.isArray(purRes.purchases)) {
        serverPurs = purRes.purchases;
      }

      // 4. Demandes locales
      let localReqs: any[] = [];
      try {
        const saved = localStorage.getItem('studycloud_storage_upgrade_requests');
        if (saved) localReqs = JSON.parse(saved);
      } catch {}

      // Fusionner en éliminant les doublons
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

  // Filtrage : Demandes de stockage en cours
  const pendingRequests = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'pending' || st === 'en_attente' || st === 'traitement' || st === 'soumis';
  });

  // Filtrage : Achats de stockage validés
  const approvedPurchases = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'completed' || st === 'approved' || st === 'active' || st === 'confirmed';
  });

  // Filtrage : Demandes refusées
  const rejectedRequests = allRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    return st === 'rejected' || st === 'refused' || st === 'refusé' || st === 'annule' || st === 'annulé';
  });

  // Soumission de la demande d'augmentation
  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUpgrade(true);

    const packDetails = {
      pack_1gb: { name: 'Pack Découverte (+1 Go)', mb: 1024, words: 100000, priceFcfa: 6500 },
      pack_5gb: { name: 'Pack Performance (+5 Go)', mb: 5120, words: 500000, priceFcfa: 20000 },
      pack_10gb: { name: 'Pack Illimité Master (+10 Go)', mb: 10240, words: 1000000, priceFcfa: 55000 },
    }[selectedPack];

    try {
      const res = await requestStorageUpgrade({
        packId: selectedPack,
        packName: packDetails.name,
        additionalMb: packDetails.mb,
        additionalWords: packDetails.words,
        contactPhone: contactPhone.trim(),
        notes: upgradeNotes.trim(),
      });

      if (res.success) {
        try {
          const currentList = JSON.parse(localStorage.getItem('studycloud_storage_upgrade_requests') || '[]');
          currentList.unshift({
            id: `req-${Date.now()}`,
            pack_name: packDetails.name,
            additional_mb: packDetails.mb,
            price_display: `${packDetails.priceFcfa.toLocaleString('fr-FR')} FCFA`,
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

  // Valeurs par défaut si chargement en cours ou données non prêtes
  const welcomeMb = storageData?.welcomeStorage.totalMb ?? 30;
  const paidMb = storageData?.paidStorage.totalMb ?? 0;
  const totalAllowedMb = storageData?.totalAllowedMb ?? 30;
  const totalUsedMb = storageData?.totalUsedMb ?? 0;
  const totalPercentage = storageData?.totalPercentage ?? 0;

  const filesStorage = storageData?.filesStorage;
  const dataStorage = storageData?.dataStorage;

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#F8F6F0] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 px-4 pb-12 pt-0 overflow-y-auto transition-colors duration-300">
      {/* ========================================================================= */}
      {/* BARRE SUPÉRIEURE : Bouton Retour (gauche), Titre (centre), Augmenter (angle droit) */}
      {/* ========================================================================= */}
      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none gap-2">
        {/* Bouton Retour à gauche */}
        <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#2D4A3E] dark:text-white" />
            <span className="hidden sm:inline">Retour</span>
          </button>

          <button
            onClick={() => loadStorage(true)}
            disabled={refreshing || loading}
            className="p-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer disabled:opacity-50"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>

        {/* Titre au centre */}
        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm md:text-base font-extrabold text-stone-900 dark:text-stone-900 bg-amber-400 dark:bg-amber-500 px-3.5 py-1.5 rounded-xl border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs truncate">
          Mon stockage
        </h1>

        {/* Bouton "Augmenter mon stockage" dans l'angle supérieur droit */}
        <div className="pointer-events-auto shrink-0">
          <button
            onClick={() => {
              if (onOpenPricing) {
                onOpenPricing('storage');
              } else {
                window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                setIsUpgradeModalOpen(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer animate-pulse hover:animate-none"
            title="Augmenter mon stockage"
          >
            <Zap className="w-3.5 h-3.5 fill-current text-white" />
            <span>Augmenter mon stockage</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTENU PRINCIPAL */}
      {/* ========================================================================= */}
      <div className="pt-24 max-w-5xl mx-auto space-y-6">
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

        {/* ----------------------------------------------------------------------- */}
        {/* CARTE 1 : LA LIGNE GLOBALE QUI SE REMPLIT (STOCKAGE GRATUIT + ACHETÉ)  */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-[#131b2e] rounded-3xl p-5 sm:p-6 border-2 border-stone-800 dark:border-slate-800 shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  <HardDrive className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white">
                    Stockage Global Disponible
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Quota total combinant votre stockage gratuit offert et vos extensions achetées
                  </p>
                </div>
              </div>
            </div>

            {/* Badges d'origine du stockage : Gratuit & Acheté */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 rounded-xl text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <Gift className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Gratuit offert : <strong>{welcomeMb} Mo</strong></span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/80 rounded-xl text-blue-800 dark:text-blue-300 font-bold text-xs">
                <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Stockage acheté : <strong>{paidMb > 0 ? `${paidMb} Mo` : '0 Mo'}</strong></span>
              </div>
            </div>
          </div>

          {/* LIGNE GLOBALE DES DEUX QUI SE REMPLIT */}
          <div className="mt-5 space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
                  {loading ? '...' : storageData?.totalUsedFormatted || `${totalUsedMb} Mo`}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-stone-500 dark:text-slate-400">
                  occupés sur <strong className="text-stone-800 dark:text-slate-200">{storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`}</strong>
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
                {loading ? '0%' : `${totalPercentage}%`}
              </span>
            </div>

            {/* La barre de progression globale */}
            <div className="w-full h-4 sm:h-5 bg-stone-100 dark:bg-slate-900 rounded-full border border-stone-300 dark:border-slate-800 overflow-hidden p-0.5 relative shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 shadow-sm"
                style={{ width: `${Math.max(totalPercentage > 0 ? 3 : 0, Math.min(100, totalPercentage))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400 pt-1">
              <span>0 Mo</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {totalPercentage < 80 ? 'Espace disponible confortable' : 'Espace presque saturé'}
              </span>
              <span>{storageData?.totalAllowedFormatted || `${totalAllowedMb} Mo`}</span>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SECTION DÉTAILLÉE : DIRECTEMENT SUR LE FOND DE LA PAGE (SANS BLOC FERMÉ) */}
        {/* Noms professionnels sans mentionner D1 ni R2                           */}
        {/* ----------------------------------------------------------------------- */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-stone-300/70 dark:border-slate-800">
            <Layers className="w-4 h-4 text-stone-700 dark:text-slate-300" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-800 dark:text-slate-200">
              Répartition détaillée de vos stockages
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DÉTAIL 1 : STOCKAGE DOCUMENTS & FICHIERS (ESPACE OCCUPÉ RÉEL SANS LIMITEUR FIXE) */}
            <div className="flex flex-col justify-between py-2 px-1">
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-300/50 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
                        {filesStorage?.name || "Stockage Documents & Fichiers"}
                      </h4>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-tight mt-0.5">
                        {filesStorage?.subtitle || "Vos cours personnels, devoirs, polycopiés et documents PDF téléversés"}
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 bg-blue-100/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-bold text-[10px] rounded-lg border border-blue-300/80 dark:border-blue-800 shrink-0">
                    {filesStorage?.count ?? 0} fichier(s)
                  </span>
                </div>

                {/* Espace réellement occupé (sans limiteur rigide) */}
                <div className="mt-4 p-3.5 rounded-2xl bg-stone-100/70 dark:bg-slate-900/60 border border-stone-200/80 dark:border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 block">
                      Espace documents occupé
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-400 tracking-tight">
                      {filesStorage?.usedFormatted || '0 o'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-500 dark:text-slate-400 block font-medium">
                      Partage libre
                    </span>
                    <span className="text-xs font-bold text-stone-700 dark:text-slate-300">
                      Sur quota global
                    </span>
                  </div>
                </div>
              </div>

              {/* Note d'avantage ressource publique */}
              <div className="mt-4 pt-2.5 border-t border-stone-300/40 dark:border-slate-800 flex items-start gap-1.5 text-[11px] text-stone-600 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Les ressources partagées dans la bibliothèque publique ne sont pas décomptées de votre espace personnel.
                </span>
              </div>
            </div>

            {/* DÉTAIL 2 : ESPACE DONNÉES & FICHES D'ÉTUDE (ESPACE OCCUPÉ RÉEL SANS LIMITEUR FIXE) */}
            <div className="flex flex-col justify-between py-2 px-1 md:border-l md:border-stone-300/50 md:dark:border-slate-800 md:pl-6">
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-300/50 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                      <Layers className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
                        {dataStorage?.name || "Espace Données & Fiches d'Étude"}
                      </h4>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-tight mt-0.5">
                        {dataStorage?.subtitle || "Vos fiches mémoires, notes de cours, emploi du temps, relevés et contenus"}
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold text-[10px] rounded-lg border border-amber-300/80 dark:border-amber-800 shrink-0">
                    {dataStorage?.count ?? 0} élément(s)
                  </span>
                </div>

                {/* Espace réellement occupé (sans limiteur rigide) */}
                <div className="mt-4 p-3.5 rounded-2xl bg-stone-100/70 dark:bg-slate-900/60 border border-stone-200/80 dark:border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 block">
                      Espace données occupé
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                      {dataStorage?.usedFormatted || '0 o'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-500 dark:text-slate-400 block font-medium">
                      Partage libre
                    </span>
                    <span className="text-xs font-bold text-stone-700 dark:text-slate-300">
                      Sur quota global
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SÉLECTEUR D'ONGLETS UTILISATEUR (Demandes en cours vs Achats & Refus)     */}
        {/* ========================================================================= */}
        <div className="pt-4 space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-stone-300 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveRequestTab('pending')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all border-2 cursor-pointer ${
                activeRequestTab === 'pending'
                  ? 'bg-amber-500 text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
                  : 'bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-300 dark:border-slate-700 hover:bg-stone-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Mes demandes en cours</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeRequestTab === 'pending'
                  ? 'bg-white text-stone-900'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}>
                {pendingRequests.length}
              </span>
            </button>

            <button
              onClick={() => setActiveRequestTab('history')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all border-2 cursor-pointer ${
                activeRequestTab === 'history'
                  ? 'bg-amber-500 text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]'
                  : 'bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-300 dark:border-slate-700 hover:bg-stone-100'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mes achats validés & Refus</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeRequestTab === 'history'
                  ? 'bg-white text-stone-900'
                  : 'bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-white'
              }`}>
                {approvedPurchases.length + rejectedRequests.length}
              </span>
            </button>
          </div>

          {/* ONGLET 1 : MES DEMANDES EN COURS DE VALIDATION */}
          {activeRequestTab === 'pending' && (
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
                    Lorsque vous souscrivez à une formule d'abonnement ou effectuez une demande d'augmentation de stockage, elle s'affiche ici pendant la vérification de votre reçu de paiement.
                  </p>
                  <button
                    onClick={() => {
                      if (onOpenPricing) onOpenPricing('storage');
                      else window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs sm:text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Découvrir les formules Stockage</span>
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
                            {req.pack_name || req.packName || 'Extension de Stockage'}
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
                        <span>Votre reçu est en cours d'inspection par l'équipe DKD Technologies. Votre espace sera débloqué dès validation.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : MES ACHATS VALIDÉS & REFUS */}
          {activeRequestTab === 'history' && (
            <div className="space-y-6">
              {/* Section 1 : Achats validés et actifs */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Achats validés & Extensions actives ({approvedPurchases.length})</span>
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
                              {pur.pack_name || pur.packName || 'Extension de Stockage StudyCloud'}
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
                          {pur.additional_mb ? (
                            <div className="flex justify-between">
                              <span className="text-stone-400">Espace accordé :</span>
                              <span className="font-bold text-emerald-600">+{pur.additional_mb >= 1024 ? `${(pur.additional_mb / 1024).toFixed(0)} Go` : `${pur.additional_mb} Mo`}</span>
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
                              {rej.pack_name || rej.packName || 'Demande de Stockage'}
                            </h4>
                          </div>
                          <span className="text-sm font-bold text-stone-500">
                            {rej.price_display || `${(rej.price_paid || rej.pricePaid || 0).toLocaleString('fr-FR')} FCFA`}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 dark:text-slate-300 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                          {rej.admin_notes || rej.notes || "Le reçu ou la référence de transaction n'a pas pu être validé avec le paiement. Vous pouvez réitérer votre demande."}
                        </p>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              if (onOpenPricing) onOpenPricing('storage');
                              else window.dispatchEvent(new CustomEvent('studycloud_open_pricing', { detail: { tab: 'storage' } }));
                            }}
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALE D'AUGMENTATION DE STOCKAGE                                         */}
      {/* ========================================================================= */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131b2e] rounded-3xl border-2 border-stone-800 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 relative overflow-hidden">
            {/* Bouton de fermeture */}
            <button
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                <Zap className="w-6 h-6 fill-current" />
              </span>
              <div>
                <h3 className="text-lg font-black text-stone-900 dark:text-white">
                  Augmenter mon stockage
                </h3>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Choisissez la formule idéale pour débloquer plus d'espace et de crédits IA
                </p>
              </div>
            </div>

            {upgradeSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                  Demande enregistrée avec succès !
                </h4>
                <p className="text-xs text-stone-500 dark:text-slate-400 max-w-xs mx-auto">
                  Votre compte sera mis à jour avec votre nouveau pack de stockage.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUpgradeSubmit} className="space-y-4">
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase text-stone-600 dark:text-slate-400">
                    Sélectionnez un pack de stockage
                  </label>

                  {/* Option 1 : Pack Découverte */}
                  <div
                    onClick={() => setSelectedPack('pack_1gb')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      selectedPack === 'pack_1gb'
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                        : 'border-stone-200 dark:border-slate-800 hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-stone-900 dark:text-white">Pack Découverte</span>
                        <span className="px-2 py-0.5 bg-stone-100 dark:bg-slate-800 text-[10px] font-bold rounded-md text-stone-600 dark:text-slate-400">+1 Go</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                        +1 024 Mo de documents & fiches + 100 000 crédits IA
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPack === 'pack_1gb' ? 'border-amber-500 bg-amber-500' : 'border-stone-400'}`}>
                      {selectedPack === 'pack_1gb' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>

                  {/* Option 2 : Pack Performance (Recommandé) */}
                  <div
                    onClick={() => setSelectedPack('pack_5gb')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 relative ${
                      selectedPack === 'pack_5gb'
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                        : 'border-stone-200 dark:border-slate-800 hover:border-stone-300'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider">
                      Recommandé
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-stone-900 dark:text-white">Pack Étudiant Performance</span>
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-[10px] font-bold rounded-md text-amber-800 dark:text-amber-300">+5 Go</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                        +5 120 Mo de documents & fiches + 500 000 crédits IA
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPack === 'pack_5gb' ? 'border-amber-500 bg-amber-500' : 'border-stone-400'}`}>
                      {selectedPack === 'pack_5gb' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>

                  {/* Option 3 : Pack Illimité Master */}
                  <div
                    onClick={() => setSelectedPack('pack_10gb')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      selectedPack === 'pack_10gb'
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                        : 'border-stone-200 dark:border-slate-800 hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-stone-900 dark:text-white">Pack Ultime Master</span>
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-[10px] font-bold rounded-md text-purple-800 dark:text-purple-300">+10 Go</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                        +10 240 Mo de documents & fiches + 1 000 000 crédits IA
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPack === 'pack_10gb' ? 'border-amber-500 bg-amber-500' : 'border-stone-400'}`}>
                      {selectedPack === 'pack_10gb' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>
                </div>

                {/* Numéro de contact / WhatsApp pour validation rapide */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-slate-300">
                    Numéro de téléphone / WhatsApp (optionnel)
                  </label>
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
                    {submittingUpgrade ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    )}
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
