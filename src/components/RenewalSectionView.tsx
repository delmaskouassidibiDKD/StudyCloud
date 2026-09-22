import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Sparkles, 
  HardDrive, 
  Eye, 
  X, 
  ShieldCheck, 
  FileText
} from 'lucide-react';
import { getUserSubscriptions, getUserStorageRequests } from '../services/api';

interface RenewalSectionViewProps {
  onGoToStorage: () => void;
  onSelectPlan?: (planName: string) => void;
}

// Fonction de formatage complet en français : Jour, Mois, Année et Heure exacte
function formatFullDateTimeFrench(dateStr?: string | null): { datePart: string; timePart: string; full: string } {
  if (!dateStr) return { datePart: 'Date non définie', timePart: '', full: 'Date non définie' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { datePart: dateStr, timePart: '', full: dateStr };

    const dayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
    const day = d.getDate();
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d);
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const capDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const datePart = `${capDayName} ${day} ${capMonth} ${year}`;
    const timePart = `${hours}h${minutes}`;
    return {
      datePart,
      timePart,
      full: `${datePart} à ${timePart}`
    };
  } catch {
    return { datePart: dateStr, timePart: '', full: dateStr };
  }
}

export const RenewalSectionView: React.FC<RenewalSectionViewProps> = ({ onGoToStorage }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [zoomedReceiptUrl, setZoomedReceiptUrl] = useState<string | null>(null);

  const currentUserId = typeof localStorage !== 'undefined'
    ? localStorage.getItem('unifolder_user_id') || 'default-user'
    : 'default-user';

  const fetchData = async () => {
    try {
      // 1. Récupération des abonnements depuis l'API
      const subRes = await getUserSubscriptions(currentUserId);
      let subs = (subRes.success && Array.isArray(subRes.subscriptions)) ? subRes.subscriptions : [];

      // 2. Récupération des demandes depuis l'API
      const reqRes = await getUserStorageRequests(currentUserId);
      let serverReqs = (reqRes.success && Array.isArray(reqRes.requests)) ? reqRes.requests : [];

      // 3. Récupération des requêtes sauvegardées localement en secours immédiat
      let localReqs: any[] = [];
      try {
        localReqs = JSON.parse(localStorage.getItem('studycloud_local_requests') || '[]');
      } catch {}

      // Fusion sans doublons par ID
      const allReqsMap = new Map<string, any>();
      localReqs.forEach(r => { if (r && r.id) allReqsMap.set(r.id, r); });
      serverReqs.forEach(r => { if (r && r.id) allReqsMap.set(r.id, r); });
      const combinedRequests = Array.from(allReqsMap.values()).sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setSubscriptions(subs);
      setRequests(combinedRequests);

      // Ouvrir automatiquement la première demande si elle est en attente
      if (combinedRequests.length > 0 && !expandedRequestId) {
        setExpandedRequestId(combinedRequests[0].id);
      }
    } catch (err) {
      console.error('Erreur chargement données de renouvellement:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleExpand = (id: string) => {
    setExpandedRequestId(prev => (prev === id ? null : id));
  };

  const activeSubscription = subscriptions.find(s => s.status === 'active') || null;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 pb-20 animate-fadeIn">
      {/* ========================================================================= */}
      {/* EN-TÊTE DU MENU RENOUVELLEMENT                                            */}
      {/* ========================================================================= */}
      <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl p-5 sm:p-7 border-2 border-[#D4C9B5] dark:border-[#1e293b] shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center shadow-md shrink-0">
            <RotateCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#2D4A3E] dark:text-white">
              Espace Renouvellement & Suivi
            </h2>
            <p className="text-xs text-[#5C6B5A] dark:text-slate-400 mt-0.5">
              Consultez vos abonnements en cours, vos dates d'échéances et l'état de vos demandes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F0E8] dark:bg-slate-800 hover:bg-[#D4C9B5] dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-200 border border-[#2D4A3E]/20 dark:border-slate-700 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Actualiser les informations"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GRILLE DIVISÉE EN 2 PARTIES                                               */}
      {/* GAUCHE : Abonnements en cours | DROITE : Demandes en cours                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* ----------------------------------------------------------------------- */}
        {/* PARTIE 1 (GAUCHE) : VOIR LES ABONNEMENTS EN COURS                      */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl p-5 sm:p-7 border-2 border-[#D4C9B5] dark:border-[#1e293b] shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#D4C9B5] dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#2D4A3E]/10 dark:bg-emerald-500/20 text-[#2D4A3E] dark:text-emerald-400 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#2D4A3E] dark:text-white">
                  Abonnements en cours
                </h3>
                <span className="text-[11px] text-[#5C6B5A] dark:text-slate-400">
                  Détails d'activation, dates et mensualités
                </span>
              </div>
            </div>

            {activeSubscription ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Formule Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#5C6B5A]/15 text-[#5C6B5A] dark:text-slate-400 border border-[#5C6B5A]/20">
                Mode Gratuit
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#5C6B5A] dark:text-slate-400 flex flex-col items-center gap-2">
              <RotateCw className="w-5 h-5 animate-spin text-[#2D4A3E] dark:text-emerald-400" />
              <span>Chargement de vos abonnements...</span>
            </div>
          ) : activeSubscription ? (
            /* CARTE DE L'ABONNEMENT ACTIF */
            <div className="space-y-4">
              {/* En-tête Formule */}
              <div className="p-4 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/90 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D4A3E] to-[#1c3027] dark:from-emerald-600 dark:to-emerald-800 text-white flex items-center justify-center shadow-sm">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-[#2D4A3E] dark:text-white">
                      {activeSubscription.plan_name || 'Abonnement StudyCloud'}
                    </h4>
                    <span className="text-[11px] font-mono text-[#5C6B5A] dark:text-slate-400">
                      ID: {activeSubscription.id || 'SUB-ACTIF'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 font-mono block">
                    {activeSubscription.total_storage_mb >= 1024 
                      ? `${(activeSubscription.total_storage_mb / 1024).toFixed(0)} Go alloués` 
                      : `${activeSubscription.total_storage_mb || 0} Mo`}
                  </span>
                  <span className="text-[10px] text-[#5C6B5A] dark:text-slate-400">Stockage cloud dédié</span>
                </div>
              </div>

              {/* 1. QUAND ÇA A COMMENCÉ : Année, jour, mois, heure */}
              <div className="p-3.5 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/70 border border-[#D4C9B5] dark:border-slate-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block tracking-wider">
                    Date & Heure de début d'abonnement :
                  </span>
                  <div className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white font-mono">
                    {formatFullDateTimeFrench(activeSubscription.start_date || activeSubscription.created_at).full}
                  </div>
                  <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500 block">
                    Heure, jour, mois et année d'activation officielle
                  </span>
                </div>
              </div>

              {/* 2. QUAND ÇA FINIT : Année, jour, mois, heure */}
              <div className="p-3.5 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/70 border border-[#D4C9B5] dark:border-slate-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block tracking-wider">
                    Date & Heure de fin d'abonnement :
                  </span>
                  <div className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white font-mono">
                    {activeSubscription.end_date 
                      ? formatFullDateTimeFrench(activeSubscription.end_date).full 
                      : 'Non définie (Abonnement permanent)'}
                  </div>
                  <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500 block">
                    Fin de la période de validité contractuelle
                  </span>
                </div>
              </div>

              {/* 3. COMBIEN IL DOIT PAYER À LA FIN DU MOIS (Le jour, mois, année, heure) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#2D4A3E]/10 via-[#F5F0E8] to-[#2D4A3E]/5 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-[#2D4A3E]/30 dark:border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-[#2D4A3E] dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    Échéance & Somme à payer :
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Mensualité
                  </span>
                </div>

                <div className="flex items-baseline justify-between flex-wrap gap-2 pt-1 border-t border-[#D4C9B5] dark:border-slate-800">
                  <span className="text-xs text-[#5C6B5A] dark:text-slate-300">Montant à régler :</span>
                  <div className="text-lg sm:text-xl font-black text-[#2D4A3E] dark:text-emerald-400 font-mono">
                    {Number(activeSubscription.monthly_price || 0).toLocaleString('fr-FR')} {activeSubscription.currency || 'FCFA'}
                  </div>
                </div>

                <div className="text-xs text-[#5C6B5A] dark:text-slate-300 pt-1 flex items-start gap-1.5">
                  <span className="text-sm">🗓️</span>
                  <div>
                    <span className="font-bold text-[#2D4A3E] dark:text-white">Exigible le : </span>
                    <strong className="font-mono text-[#2D4A3E] dark:text-emerald-300">
                      {formatFullDateTimeFrench(activeSubscription.payment_due_date || activeSubscription.end_date).full}
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] text-[#5C6B5A] dark:text-slate-400 pt-1 border-t border-[#D4C9B5]/60 dark:border-slate-800/80 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Tolérance accordée : <strong>{activeSubscription.grace_period_days || 5} jours de grâce</strong> avant toute suspension.</span>
                </div>
              </div>

              {/* Bouton pour renouveler immédiatement */}
              <button
                onClick={onGoToStorage}
                className="w-full py-3 px-4 rounded-xl bg-[#2D4A3E] hover:bg-[#233b31] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-95"
              >
                <RotateCw className="w-4 h-4" />
                <span>Renouveler / Prolonger ce forfait maintenant</span>
              </button>
            </div>
          ) : (
            /* ÉTAT SI AUCUN ABONNEMENT PAYANT */
            <div className="p-6 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/60 border border-[#D4C9B5] dark:border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2D4A3E]/10 dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-300 mx-auto flex items-center justify-center">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-[#2D4A3E] dark:text-white">
                  Formule Actuelle : Mode Gratuit de Bienvenue
                </h4>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 max-w-sm mx-auto">
                  Vous disposez actuellement de votre espace gratuit de 30 Mo. Vous n'avez aucun abonnement payant récurrent actif.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onGoToStorage}
                  className="px-5 py-2.5 rounded-xl bg-[#2D4A3E] hover:bg-[#233b31] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Découvrir les formules & Souscrire</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PARTIE 2 (DROITE) : VOIR LES DEMANDES EN COURS (AVEC ACCORDÉON DÉROULANT) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl p-5 sm:p-7 border-2 border-[#D4C9B5] dark:border-[#1e293b] shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#D4C9B5] dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#2D4A3E] dark:text-white">
                  Demandes en cours
                </h3>
                <span className="text-[11px] text-[#5C6B5A] dark:text-slate-400">
                  Suivi en direct de vos commandes transmises
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#2D4A3E]/15 dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-200 border border-[#2D4A3E]/20 dark:border-slate-700">
              {requests.length} demande{requests.length > 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#5C6B5A] dark:text-slate-400 flex flex-col items-center gap-2">
              <RotateCw className="w-5 h-5 animate-spin text-orange-500" />
              <span>Chargement de vos demandes...</span>
            </div>
          ) : requests.length > 0 ? (
            /* LISTE DES DEMANDES EN COURS AVEC MENU DÉROULANT ACCORDÉON */
            <div className="space-y-3">
              {requests.map((req) => {
                const isExpanded = expandedRequestId === req.id;
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';

                const reqDate = formatFullDateTimeFrench(req.created_at);

                return (
                  <div
                    key={req.id}
                    className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'border-[#2D4A3E] dark:border-emerald-500 bg-[#F5F0E8] dark:bg-slate-900 shadow-md'
                        : 'border-[#D4C9B5] dark:border-slate-800 bg-[#F5F0E8]/70 dark:bg-slate-900/60 hover:border-[#2D4A3E]/50 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* EN-TÊTE CLIQUABLE DE LA DEMANDE (DÉCLENCHEUR DU MENU DÉROULANT) */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(req.id)}
                      className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 cursor-pointer transition select-none"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                            isPending
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : isApproved
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/20 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isPending ? (
                            <Clock className="w-4 h-4 animate-pulse" />
                          ) : isApproved ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white truncate">
                              {req.pack_name || 'Demande de Stockage'}
                            </span>
                            {req.storage_display && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-[#2D4A3E]/10 dark:bg-slate-800 text-[#2D4A3E] dark:text-emerald-400">
                                {req.storage_display}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-[11px] text-[#5C6B5A] dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>📅 {reqDate.full}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            En attente
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            Validée
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30">
                            Rejetée
                          </span>
                        )}

                        <div className="w-7 h-7 rounded-lg bg-[#D4C9B5]/40 dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-300 flex items-center justify-center transition-transform duration-200">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>

                    {/* MENU DÉROULANT / DÉTAILS DÉPLOYÉS DE LA DEMANDE */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#D4C9B5] dark:border-slate-800 space-y-3.5 animate-fadeIn">
                        
                        {/* Référence et message pédagogique */}
                        <div className="flex items-center justify-between text-[11px] text-[#5C6B5A] dark:text-slate-400 pt-2 flex-wrap gap-2">
                          <span>Numéro de référence : <strong className="font-mono text-[#2D4A3E] dark:text-slate-200">{req.id}</strong></span>
                          <span>Cycle : <strong className="text-[#2D4A3E] dark:text-slate-200">{req.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel (-10%)'}</strong></span>
                        </div>

                        {/* Grille des caractéristiques */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          {/* Somme à payer */}
                          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-950/70 border border-[#D4C9B5] dark:border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block mb-0.5">Montant réglé :</span>
                            <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                              {req.price_display || `${Number(req.price_paid || 0).toLocaleString('fr-FR')} ${req.currency || 'FCFA'}`}
                            </div>
                            <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500">Moyen : {req.payment_method || 'Mobile Money'}</span>
                          </div>

                          {/* Contact transmis */}
                          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-950/70 border border-[#D4C9B5] dark:border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block mb-0.5">Contacts transmis :</span>
                            <div className="text-xs font-mono font-bold text-[#2D4A3E] dark:text-slate-200 truncate">
                              📞 {req.contact_phone || 'Non renseigné'}
                            </div>
                            {req.user_whatsapp && (
                              <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                                💬 WA : {req.user_whatsapp}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes laissées */}
                        {req.notes && (
                          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-950/50 border border-[#D4C9B5] dark:border-slate-800 text-xs text-[#5C6B5A] dark:text-slate-300">
                            <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block mb-0.5">Notes de la commande :</span>
                            <span>{req.notes}</span>
                          </div>
                        )}

                        {/* REÇU DE PAIEMENT JOINT (IMAGE) */}
                        {req.receipt_image_url && (
                          <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-950/80 border border-[#D4C9B5] dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#2D4A3E] dark:text-slate-200 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-orange-500" />
                                Reçu de paiement joint :
                              </span>
                              <button
                                type="button"
                                onClick={() => setZoomedReceiptUrl(req.receipt_image_url)}
                                className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Agrandir</span>
                              </button>
                            </div>

                            <div 
                              onClick={() => setZoomedReceiptUrl(req.receipt_image_url)}
                              className="relative group cursor-pointer max-h-48 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-center p-1.5"
                            >
                              <img
                                src={req.receipt_image_url}
                                alt="Reçu de paiement"
                                className="max-h-44 w-auto object-contain rounded-lg transition duration-200 group-hover:scale-[1.02]"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                <span className="px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-bold flex items-center gap-1">
                                  <Eye className="w-3 h-3" /> Cliquer pour zoomer
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Message d'état pour l'étudiant */}
                        <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                          isPending 
                            ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20' 
                            : isApproved 
                            ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-900 dark:text-red-300 border border-red-500/20'
                        }`}>
                          <span className="text-sm mt-0.5">ℹ️</span>
                          <span className="leading-relaxed">
                            {isPending && "Votre demande ainsi que votre preuve de paiement sont en cours de vérification par l'équipe administrative. Votre stockage sera augmenté dès confirmation."}
                            {isApproved && "Cette demande a été validée et créditée avec succès sur votre espace de stockage."}
                            {isRejected && "Cette demande n'a pas pu être validée. Veuillez contacter le support ou renouveler votre transfert."}
                          </span>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ÉCRAN SI AUCUNE DEMANDE ENREGISTRÉE */
            <div className="p-6 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/60 border border-[#D4C9B5] dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-[#2D4A3E] dark:text-white">
                  Aucune demande en attente
                </h4>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 max-w-sm mx-auto">
                  Toutes vos demandes de stockage, forfaits ou renouvellements apparaîtront ici avec leur date, heure et statut de validation.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODALE DE ZOOM SUR LE REÇU DE PAIEMENT                                   */}
      {/* ========================================================================= */}
      {zoomedReceiptUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setZoomedReceiptUrl(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 max-w-3xl max-h-[90vh] w-full flex flex-col border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 px-2">
              <span className="text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white flex items-center gap-2">
                <span>🧾</span> Reçu de paiement (Preuve de transfert)
              </span>
              <button
                onClick={() => setZoomedReceiptUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center">
              <img
                src={zoomedReceiptUrl}
                alt="Reçu de paiement agrandi"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
