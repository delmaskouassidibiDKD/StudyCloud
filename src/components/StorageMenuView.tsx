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
  AlertCircle
} from 'lucide-react';
import {
  getUserStorageQuota,
  requestStorageUpgrade,
  UserStorageQuotaDetails
} from '../services/api';

interface StorageMenuViewProps {
  onBack: () => void;
}

export const StorageMenuView: React.FC<StorageMenuViewProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageData, setStorageData] = useState<UserStorageQuotaDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const res = await getUserStorageQuota(currentUserId);
      if (res.success && res.data) {
        setStorageData(res.data);
      } else {
        setError(res.error || "Impossible de charger les données de stockage");
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

  // Soumission de la demande d'augmentation
  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUpgrade(true);

    const packDetails = {
      pack_1gb: { name: 'Pack Découverte (+1 Go)', mb: 1024, words: 100000 },
      pack_5gb: { name: 'Pack Performance (+5 Go)', mb: 5120, words: 500000 },
      pack_10gb: { name: 'Pack Illimité Master (+10 Go)', mb: 10240, words: 1000000 },
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
        setUpgradeSuccess(true);
        setTimeout(() => {
          setIsUpgradeModalOpen(false);
          setUpgradeSuccess(false);
          loadStorage(true);
        }, 2200);
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
        <h1 className="pointer-events-auto font-sans text-xs sm:text-sm md:text-base font-extrabold text-stone-900 dark:text-stone-900 bg-amber-400 dark:bg-amber-500 px-3.5 py-1.5 rounded-xl border-2 border-stone-800 dark:border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] truncate">
          Mon stockage
        </h1>

        {/* Bouton "Augmenter mon stockage" dans l'angle supérieur droit */}
        <div className="pointer-events-auto shrink-0">
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
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
            {/* DÉTAIL 1 : STOCKAGE DOCUMENTS & FICHIERS (DIRECTEMENT SUR LE FOND) */}
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

                {/* Progression et volume */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-black text-stone-900 dark:text-slate-100 text-sm">
                      {filesStorage?.usedFormatted || '0 o'}
                    </span>
                    <span className="text-stone-600 dark:text-slate-400">
                      sur <strong className="text-stone-800 dark:text-slate-200">{filesStorage?.allowedFormatted || '10 Mo'}</strong>
                    </span>
                  </div>

                  <div className="w-full h-3 bg-stone-200/80 dark:bg-slate-900 rounded-full border border-stone-300 dark:border-slate-800 overflow-hidden p-0.5 shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${Math.max(filesStorage?.percentage ? 2 : 0, Math.min(100, filesStorage?.percentage ?? 0))}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-stone-500 dark:text-slate-400">
                    <span>Espace fichiers réservé</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{filesStorage?.percentage ?? 0}%</span>
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

            {/* DÉTAIL 2 : ESPACE DONNÉES & FICHES D'ÉTUDE (DIRECTEMENT SUR LE FOND) */}
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

                {/* Progression et volume */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-black text-stone-900 dark:text-slate-100 text-sm">
                      {dataStorage?.usedFormatted || '0 o'}
                    </span>
                    <span className="text-stone-600 dark:text-slate-400">
                      sur <strong className="text-stone-800 dark:text-slate-200">{dataStorage?.allowedFormatted || '20 Mo'}</strong>
                    </span>
                  </div>

                  <div className="w-full h-3 bg-stone-200/80 dark:bg-slate-900 rounded-full border border-stone-300 dark:border-slate-800 overflow-hidden p-0.5 shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: `${Math.max(dataStorage?.percentage ? 2 : 0, Math.min(100, dataStorage?.percentage ?? 0))}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-stone-500 dark:text-slate-400">
                    <span>Espace fiches, notes & données textuelles</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{dataStorage?.percentage ?? 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                  Choisissez la formule idéale pour débloquer plus d'espace et de mots IA
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
                        +1 024 Mo de documents & fiches + 100 000 mots IA
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
                        +5 120 Mo de documents & fiches + 500 000 mots IA
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
                        +10 240 Mo de documents & fiches + 1 000 000 mots IA
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
