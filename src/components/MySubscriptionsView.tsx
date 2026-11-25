import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  RefreshCw,
  Zap,
  Infinity as InfinityIcon,
  CalendarClock,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  HardDrive,
  Sparkles,
  AppWindow,
  Clock,
  Ban,
  ChevronRight,
  Maximize2,
  Minimize2,
  Menu,
  Search,
  X,
  Layers,
  MoreHorizontal,
  Receipt,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import {
  useViewerExpandLevel,
  setViewerExpandLevel,
  resetViewerExpand,
} from '../utils/viewerExpandManager';
import {
  ActiveSubscriptionRecord,
  cancelMySubscriptionAutoRenew,
  CardServicePermissions,
  deleteMyPaymentMethod,
  formatCurrencyAmount,
  getMyActiveSubscriptions,
  initLinkBankCard,
  loadPaystackInlinePop,
  MaskedPaymentMethodRecord,
  updatePaymentMethodPermissions,
  updateSubscriptionRenewalMode,
  verifyLinkBankCard,
} from '../services/paystackBillingApi';

interface MySubscriptionsViewProps {
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
  onBack: () => void;
  onOpenRenewTarget?: (productType: 'storage' | 'ai' | 'app', appKey?: string) => void;
}

type SubWorkspaceSection = 'all' | 'storage' | 'ai' | 'app' | 'cards' | 'history';

function formatDateTimeFr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function computeLiveCountdownLabel(sub: ActiveSubscriptionRecord): {
  text: string;
  short: string;
  tone: 'amber' | 'emerald' | 'orange' | 'rose';
} {
  if (Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite') {
    return {
      text: 'Abonnement à vie (sans expiration)',
      short: '♾️ À vie',
      tone: 'amber',
    };
  }
  const endMs = sub.current_period_end ? Date.parse(sub.current_period_end) : NaN;
  const now = Date.now();
  if (Number.isFinite(endMs) && endMs > now) {
    const totalHours = Math.floor((endMs - now) / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor(((endMs - now) % 3600000) / 60000);
    const text =
      days > 0
        ? `${days} jour${days > 1 ? 's' : ''} et ${hours}h restants`
        : `${hours}h ${mins}m restantes`;
    const short = days > 0 ? `${days}j ${hours}h` : `${hours}h ${mins}m`;
    return { text, short, tone: days <= 3 ? 'orange' : 'emerald' };
  }
  const graceMs = sub.grace_until ? Date.parse(sub.grace_until) : NaN;
  if (Number.isFinite(graceMs) && graceMs > now) {
    const gHours = Math.max(1, Math.ceil((graceMs - now) / 3600000));
    const gDays = Math.floor(gHours / 24);
    const gRemH = gHours % 24;
    return {
      text: `Période de grâce : ${gDays > 0 ? `${gDays}j ${gRemH}h` : `${gHours}h`} avant blocage`,
      short: `Grâce ${gDays > 0 ? `${gDays}j` : `${gHours}h`}`,
      tone: 'orange',
    };
  }
  return { text: 'Expiré — renouvellement requis', short: 'Expiré', tone: 'rose' };
}

function getCardPalette(sub: ActiveSubscriptionRecord): {
  bg: string;
  border: string;
  serviceLabel: string;
} {
  const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
  if (sub.status === 'blocked') {
    return { bg: '#9f1239', border: '#881337', serviceLabel: 'SUSPENDU' };
  }
  if (isInf) {
    return {
      bg: '#b45309',
      border: '#92400e',
      serviceLabel:
        sub.product_type === 'storage'
          ? 'STOCKAGE CLOUD · À VIE'
          : sub.product_type === 'ai'
          ? 'CRÉDITS IA · À VIE'
          : `${(sub.app_name || sub.app_key || 'APPLICATION').toUpperCase()} · À VIE`,
    };
  }
  if (sub.product_type === 'storage') {
    return { bg: '#0369a1', border: '#075985', serviceLabel: 'STOCKAGE CLOUD' };
  }
  if (sub.product_type === 'ai') {
    return { bg: '#6d28d9', border: '#5b21b6', serviceLabel: 'CRÉDITS IA' };
  }
  return {
    bg: '#b91c1c',
    border: '#991b1b',
    serviceLabel: (sub.app_name || sub.app_key || 'APPLICATION').toUpperCase(),
  };
}

function formatEventLabel(eventType: string): string {
  const map: Record<string, string> = {
    created: 'Abonnement activé',
    renewed_manual: 'Renouvellement manuel confirmé',
    auto_charge_succeeded: 'Prélèvement automatique réussi',
    auto_charge_failed: 'Échec du prélèvement automatique',
    switched_to_auto: 'Passé en renouvellement automatique',
    switched_to_manual: 'Passé en renouvellement manuel',
    card_attached: 'Carte bancaire enregistrée',
    card_linked: 'Carte Visa/Mastercard associée (empreinte remboursée)',
    card_permissions_updated: 'Services automatiques de la carte mis à jour',
    card_removed: 'Carte bancaire supprimée',
    ai_auto_recharged: 'Crédits IA rechargés automatiquement (solde à 0)',
    ai_auto_recharge_failed: 'Échec de la recharge auto Crédits IA',
    user_cancelled_auto: 'Arrêt du renouvellement programmé',
    entered_grace: 'Entrée en période de grâce',
    service_blocked: 'Service suspendu (impayé)',
    reactivated: 'Service réactivé',
    admin_updated: 'Mis à jour par l’administration',
    email_sent: 'Email de suivi envoyé',
  };
  return map[eventType] || eventType;
}

export const MySubscriptionsView: React.FC<MySubscriptionsViewProps> = ({
  user,
  onBack,
  onOpenRenewTarget,
}) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [section, setSection] = useState<SubWorkspaceSection>('all');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ActiveSubscriptionRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MaskedPaymentMethodRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<
    Array<{ id: string; subscription_id: string; event_type: string; actor: string; created_at: string }>
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkingCard, setLinkingCard] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [addCardTargetSubId, setAddCardTargetSubId] = useState<string | undefined>(undefined);
  const [addCardPerms, setAddCardPerms] = useState<CardServicePermissions>({
    autoStorage: true,
    autoAi: true,
    autoAiOnDepleted: false,
    autoApps: ['*'],
  });
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [, setTick] = useState(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const res = await getMyActiveSubscriptions();
    if (res.success) {
      setSubscriptions(res.subscriptions);
      setPaymentMethods(res.paymentMethods);
      setRecentEvents(res.recentEvents);
    } else if (res.error) {
      setFeedback({ type: 'err', text: res.error });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000);
    const onRefresh = () => loadAll();
    window.addEventListener('studycloud_payment_verified', onRefresh);
    window.addEventListener('studycloud_subscription_updated', onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('studycloud_payment_verified', onRefresh);
      window.removeEventListener('studycloud_subscription_updated', onRefresh);
    };
  }, [loadAll]);

  useEffect(() => {
    return () => {
      resetViewerExpand();
    };
  }, []);

  const notifyBannerSync = () => {
    try {
      window.dispatchEvent(new CustomEvent('studycloud_subscription_updated'));
    } catch {
      // Ignore
    }
  };

  const handleToggleMaximize = () => {
    if (viewerExpandLevel >= 1) {
      setViewerExpandLevel(0);
    } else {
      setViewerExpandLevel(2);
    }
  };

  const handleToggleMode = async (sub: ActiveSubscriptionRecord, nextMode: 'auto' | 'manual') => {
    setBusyId(sub.id);
    setFeedback(null);
    const res = await updateSubscriptionRenewalMode(sub.id, nextMode, paymentMethods[0]?.id);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || 'Impossible de modifier le mode.' });
    } else {
      setFeedback({
        type: 'ok',
        text:
          nextMode === 'auto'
            ? `Prélèvement automatique activé pour « ${sub.plan_name} ».`
            : `Paiement manuel activé pour « ${sub.plan_name} » (aucun prélèvement automatique).`,
      });
      notifyBannerSync();
      await loadAll();
    }
    setBusyId(null);
  };

  const handleCancelAuto = async (sub: ActiveSubscriptionRecord) => {
    if (
      !window.confirm(
        `Arrêter le renouvellement automatique de « ${sub.plan_name} » ? Vous conservez votre accès jusqu'à la fin de la période déjà payée.`
      )
    ) {
      return;
    }
    setBusyId(sub.id);
    setFeedback(null);
    const res = await cancelMySubscriptionAutoRenew(sub.id);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || "Échec de l'annulation." });
    } else {
      setFeedback({
        type: 'ok',
        text: `Renouvellement automatique arrêté pour « ${sub.plan_name} ».`,
      });
      notifyBannerSync();
      await loadAll();
    }
    setBusyId(null);
  };

  const openAddCardModal = (targetSub?: ActiveSubscriptionRecord) => {
    setFeedback(null);
    if (targetSub) {
      setAddCardTargetSubId(targetSub.id);
      setAddCardPerms({
        autoStorage: targetSub.product_type === 'storage',
        autoAi: targetSub.product_type === 'ai',
        autoAiOnDepleted: false,
        autoApps:
          targetSub.product_type === 'app'
            ? [targetSub.app_key || '*']
            : [],
      });
    } else {
      setAddCardTargetSubId(undefined);
      setAddCardPerms({
        autoStorage: true,
        autoAi: true,
        autoAiOnDepleted: false,
        autoApps: ['*'],
      });
    }
    setShowAddCardModal(true);
  };

  const handleLinkCard = async (targetSubId?: string, permissions?: CardServicePermissions) => {
    if (linkingCard) return;
    setLinkingCard(true);
    setShowAddCardModal(false);
    setFeedback(null);
    try {
      const initRes = await initLinkBankCard(targetSubId, true, permissions);
      if (!initRes.success || !initRes.accessCode || !initRes.reference) {
        setFeedback({ type: 'err', text: initRes.error || 'Impossible de démarrer la liaison de carte.' });
        setLinkingCard(false);
        return;
      }
      const PaystackPop = await loadPaystackInlinePop();
      const popup = new PaystackPop();
      popup.resumeTransaction(initRes.accessCode, {
        onSuccess: async (tx: any) => {
          const verRes = await verifyLinkBankCard(
            tx?.reference || initRes.reference!,
            targetSubId,
            true,
            permissions
          );
          if (verRes.success) {
            const refundTxt = verRes.refunded
              ? ' L’empreinte de vérification de 100 FCFA a été remboursée automatiquement.'
              : verRes.refundMessage
              ? ` ${verRes.refundMessage}`
              : '';
            const linkedTxt =
              verRes.autoLinkedCount && verRes.autoLinkedCount > 0
                ? ` ${verRes.autoLinkedCount} abonnement(s) actif(s) passé(s) en renouvellement automatique.`
                : '';
            setFeedback({
              type: 'ok',
              text: `Carte ${verRes.paymentMethod?.label || 'Visa / Mastercard'} enregistrée.${refundTxt}${linkedTxt}`,
            });
            notifyBannerSync();
            await loadAll();
            setSection('cards');
          } else {
            setFeedback({ type: 'err', text: verRes.error || 'Échec de validation de la carte.' });
          }
          setLinkingCard(false);
        },
        onCancel: () => {
          setLinkingCard(false);
        },
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Erreur lors de la liaison de carte.' });
      setLinkingCard(false);
    }
  };

  const handleToggleCardPermission = async (
    pm: MaskedPaymentMethodRecord,
    patch: Partial<CardServicePermissions>
  ) => {
    setBusyId(pm.id);
    setFeedback(null);
    const nextAi = patch.autoAi !== undefined ? patch.autoAi : pm.autoAi;
    const payload: CardServicePermissions = {
      autoStorage: patch.autoStorage !== undefined ? patch.autoStorage : pm.autoStorage,
      autoAi: nextAi,
      autoAiOnDepleted: nextAi
        ? patch.autoAiOnDepleted !== undefined
          ? patch.autoAiOnDepleted
          : pm.autoAiOnDepleted
        : false,
      autoApps: patch.autoApps !== undefined ? patch.autoApps : pm.autoApps,
    };
    const res = await updatePaymentMethodPermissions(pm.id, payload);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || 'Impossible de mettre à jour les permissions.' });
    } else {
      const notes: string[] = [];
      if (res.switchedToAutoCount && res.switchedToAutoCount > 0) {
        notes.push(`${res.switchedToAutoCount} abonnement(s) activé(s) en auto`);
      }
      if (res.switchedToManualCount && res.switchedToManualCount > 0) {
        notes.push(`${res.switchedToManualCount} passé(s) en manuel`);
      }
      setFeedback({
        type: 'ok',
        text: `Services autorisés mis à jour pour ${pm.label}${notes.length ? ` (${notes.join(', ')})` : ''}.`,
      });
      notifyBannerSync();
      await loadAll();
    }
    setBusyId(null);
  };

  const handleRemoveCard = async (pm: MaskedPaymentMethodRecord) => {
    if (
      !window.confirm(
        `Supprimer la carte ${pm.label} ? Les abonnements automatiques associés basculeront automatiquement en paiement manuel.`
      )
    ) {
      return;
    }
    setBusyId(pm.id);
    setFeedback(null);
    const res = await deleteMyPaymentMethod(pm.id);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || 'Impossible de supprimer la carte.' });
    } else {
      const extra =
        res.switchedToManualCount && res.switchedToManualCount > 0
          ? ` (${res.switchedToManualCount} abonnement(s) passé(s) en manuel)`
          : '';
      setFeedback({ type: 'ok', text: `Carte ${pm.label} supprimée${extra}.` });
      notifyBannerSync();
      await loadAll();
    }
    setBusyId(null);
  };

  const counts = useMemo(
    () => ({
      all: subscriptions.length,
      storage: subscriptions.filter((s) => s.product_type === 'storage').length,
      ai: subscriptions.filter((s) => s.product_type === 'ai').length,
      app: subscriptions.filter((s) => s.product_type === 'app').length,
      cards: paymentMethods.length,
      history: recentEvents.length,
    }),
    [subscriptions, paymentMethods, recentEvents]
  );

  const visibleSubscriptions = useMemo(() => {
    const base =
      section === 'storage' || section === 'ai' || section === 'app'
        ? subscriptions.filter((s) => s.product_type === section)
        : subscriptions;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) =>
      [s.plan_name, s.app_name, s.app_key, s.product_type, s.renewal_mode, s.status]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [subscriptions, section, searchQuery]);

  const selectedSub = useMemo(
    () => (selectedSubId ? subscriptions.find((s) => s.id === selectedSubId) || null : null),
    [selectedSubId, subscriptions]
  );

  const hasAlerts = subscriptions.some((s) =>
    ['grace', 'past_due', 'blocked'].includes(String(s.status))
  );

  const sectionMeta: Record<SubWorkspaceSection, { title: string; subtitle: string }> = {
    all: {
      title: 'Tous mes abonnements',
      subtitle: `${counts.all} abonnement${counts.all > 1 ? 's' : ''} enregistré${counts.all > 1 ? 's' : ''} — cliquez sur une carte pour gérer le mode Automatique / Manuel ou renouveler.`,
    },
    storage: {
      title: 'Stockage Cloud',
      subtitle: `${counts.storage} forfait${counts.storage > 1 ? 's' : ''} de stockage cloud actif${counts.storage > 1 ? 's' : ''} ou récent${counts.storage > 1 ? 's' : ''}.`,
    },
    ai: {
      title: 'Crédits IA',
      subtitle: `${counts.ai} forfait${counts.ai > 1 ? 's' : ''} ou pack${counts.ai > 1 ? 's' : ''} de crédits IA StudyCloud.`,
    },
    app: {
      title: 'Applications',
      subtitle: `${counts.app} abonnement${counts.app > 1 ? 's' : ''} d'application (Moyennes et futures applications StudyCloud).`,
    },
    cards: {
      title: 'Cartes Visa / Mastercard',
      subtitle: `${counts.cards} carte${counts.cards > 1 ? 's' : ''} enregistrée${counts.cards > 1 ? 's' : ''} — associez une carte sécurisée même après un paiement Wave, Orange Money ou MTN.`,
    },
    history: {
      title: 'Activité & Historique',
      subtitle: `${counts.history} événement${counts.history > 1 ? 's' : ''} récent${counts.history > 1 ? 's' : ''} sur vos abonnements et cartes.`,
    },
  };

  const navCategories: Array<{
    id: SubWorkspaceSection;
    label: string;
    count: number;
    accent: string;
    Icon: any;
  }> = [
    { id: 'all', label: 'Tous les abonnements', count: counts.all, accent: '#2563eb', Icon: Layers },
    { id: 'storage', label: 'Stockage Cloud', count: counts.storage, accent: '#0284c7', Icon: HardDrive },
    { id: 'ai', label: 'Crédits IA', count: counts.ai, accent: '#7c3aed', Icon: Sparkles },
    { id: 'app', label: 'Applications', count: counts.app, accent: '#dc2626', Icon: AppWindow },
  ];

  const userName = user?.name || user?.email?.split('@')[0] || 'Utilisateur';

  // ============================================================================
  // BARRE LATÉRALE GAUCHE — IDENTIQUE AU MENU MOYENNES (`SchoolWorkspaceLayout`)
  // ============================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 select-none">
      {/* Haut fixe */}
      <div className="px-3 pt-2.5 pb-2.5 border-b border-slate-300 dark:border-slate-700 shrink-0 space-y-2">
        <button
          type="button"
          onClick={() => {
            setIsMobileSidebarOpen(false);
            if (selectedSub) {
              setSelectedSubId(null);
            } else {
              onBack();
            }
          }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="truncate">
            {selectedSub ? 'Tous les abonnements' : 'Tableau de bord'}
          </span>
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center shrink-0 text-orange-600 dark:text-orange-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
              Mes abonnements
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
              Facturation &amp; Cartes
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Milieu défilable : Onglets d'abonnements + Cartes & Suivi (épuré sans compteurs ni +) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2.5 space-y-1">
        {navCategories.map((cat) => {
          const isSelected = section === cat.id && !selectedSub;
          const CatIcon = cat.Icon;
          return (
            <div
              key={cat.id}
              onClick={() => {
                setSelectedSubId(null);
                setSection(cat.id);
                setIsMobileSidebarOpen(false);
              }}
              className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-md border text-xs transition cursor-pointer ${
                isSelected
                  ? 'bg-[#2563eb] border-[#1d4ed8] text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-[#161f33]/70 border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              {!isSelected && (
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                  style={{ backgroundColor: cat.accent }}
                />
              )}
              <div className={`flex items-center gap-2 min-w-0 flex-1 ${!isSelected ? 'pl-1' : ''}`}>
                <CatIcon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSelected ? 'text-white/95' : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                <span className="truncate">{cat.label}</span>
              </div>
            </div>
          );
        })}

        {/* Sous-section Paiements & Suivi */}
        <div className="pt-3 px-1.5 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cartes &amp; Suivi
          </span>
        </div>

        <div
          onClick={() => {
            setSelectedSubId(null);
            setSection('cards');
            setIsMobileSidebarOpen(false);
          }}
          className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-md border text-xs transition cursor-pointer ${
            section === 'cards' && !selectedSub
              ? 'bg-[#2563eb] border-[#1d4ed8] text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-[#161f33]/70 border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
          }`}
        >
          {!(section === 'cards' && !selectedSub) && (
            <span className="absolute left-0 top-0 bottom-0 w-[3.5px] bg-emerald-600" />
          )}
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${!(section === 'cards' && !selectedSub) ? 'pl-1' : ''}`}>
            <CreditCard
              className={`w-3.5 h-3.5 shrink-0 ${
                section === 'cards' && !selectedSub ? 'text-white/95' : 'text-slate-500 dark:text-slate-400'
              }`}
            />
            <span className="truncate">Cartes Visa / MC</span>
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedSubId(null);
            setSection('history');
            setIsMobileSidebarOpen(false);
          }}
          className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-md border text-xs transition cursor-pointer ${
            section === 'history' && !selectedSub
              ? 'bg-[#2563eb] border-[#1d4ed8] text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-[#161f33]/70 border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
          }`}
        >
          {!(section === 'history' && !selectedSub) && (
            <span className="absolute left-0 top-0 bottom-0 w-[3.5px] bg-amber-500" />
          )}
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${!(section === 'history' && !selectedSub) ? 'pl-1' : ''}`}>
            <Receipt
              className={`w-3.5 h-3.5 shrink-0 ${
                section === 'history' && !selectedSub ? 'text-white/95' : 'text-slate-500 dark:text-slate-400'
              }`}
            />
            <span className="truncate">Activité &amp; Historique</span>
          </div>
        </div>
      </div>

      {/* Bas fixe de la barre latérale : Ajouter une carte Visa / Mastercard */}
      <div className="px-2.5 py-2.5 border-t border-slate-300 dark:border-slate-700 shrink-0">
        <button
          type="button"
          disabled={linkingCard}
          onClick={() => {
            setIsMobileSidebarOpen(false);
            openAddCardModal();
          }}
          className="w-full px-2.5 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 transition cursor-pointer disabled:opacity-60"
        >
          <span className="flex items-center gap-2 truncate">
            {linkingCard ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
            ) : (
              <img
                src="/payment-logos/visa-mastercard.png"
                alt="Visa / Mastercard"
                className="h-4 w-7 object-contain rounded-[3px] bg-white border border-slate-200 px-0.5 shrink-0"
              />
            )}
            <span className="truncate">Ajouter une carte</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
        </button>
      </div>
    </div>
  );

  const activeTitle = selectedSub ? selectedSub.plan_name : sectionMeta[section].title;
  const activeSubtitle = selectedSub
    ? `${selectedSub.app_name || selectedSub.product_type} · ${formatCurrencyAmount(
        selectedSub.price_amount || 0,
        selectedSub.currency || 'XOF'
      )}`
    : sectionMeta[section].subtitle;

  return (
    <div
      className={`flex flex-1 w-full bg-[#eef2f6] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-all duration-300 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-[60] w-screen h-screen min-h-screen'
          : 'relative h-dvh min-h-dvh'
      }`}
    >
      {/* BARRE LATÉRALE DESKTOP (>= md) */}
      <aside className="hidden md:flex w-[228px] lg:w-[244px] shrink-0 flex-col border-r border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] h-full min-h-0 z-20">
        {renderSidebarContent()}
      </aside>

      {/* TIROIR LATÉRAL MOBILE (< md) */}
      {isMobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="w-[264px] max-w-[82vw] h-full bg-white dark:bg-[#111827] shadow-xl border-r border-slate-300 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZONE PRINCIPALE À DROITE — PLEIN ÉCRAN, IDENTIQUE AU MENU MOYENNES    */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden bg-[#eef2f6] dark:bg-[#0b1120]">
        {/* BARRE SUPÉRIEURE UNIFIÉE : MENU MOBILE + FIL D'ARIANE + SYNCHRONISÉ + USER + EXPAND */}
        <header className="h-12 bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-700 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden w-8 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1e293b] hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
              aria-label="Ouvrir le menu latéral"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden" aria-label="Fil d'Ariane">
              <button
                type="button"
                onClick={onBack}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium truncate cursor-pointer"
              >
                StudyCloud
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setSelectedSubId(null);
                  setSection('all');
                }}
                className={`truncate cursor-pointer ${
                  section === 'all' && !selectedSub
                    ? 'text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                Mes abonnements
              </button>
              {section !== 'all' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setSelectedSubId(null)}
                    className={`truncate cursor-pointer ${
                      !selectedSub
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    {sectionMeta[section].title}
                  </button>
                </>
              )}
              {selectedSub && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  <span className="text-slate-900 dark:text-white font-bold truncate max-w-[160px]">
                    {selectedSub.plan_name}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b]">
              <div className="w-5 h-5 rounded-full bg-slate-800 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 max-w-[110px] truncate">
                {userName}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 pl-1.5 border-l border-slate-300 dark:border-slate-700">
              <ViewerSuperExpandButton
                expandLevel={viewerExpandLevel}
                onExpandChange={(lvl) => setViewerExpandLevel(lvl)}
              />
              <button
                type="button"
                onClick={handleToggleMaximize}
                className={`w-7 h-7 rounded-md flex items-center justify-center border transition cursor-pointer ${
                  viewerExpandLevel >= 1
                    ? 'bg-[#0051c3] text-white border-[#0051c3]'
                    : 'bg-white dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title={viewerExpandLevel >= 1 ? 'Réduire la vue' : "Agrandir l'espace"}
              >
                {viewerExpandLevel >= 1 ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* SOUS-EN-TÊTE FIXE : TITRE + RECHERCHE */}
        <div className="shrink-0 bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-700 px-4 sm:px-8 py-3.5">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {selectedSub && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubId(null)}
                    className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b] hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
                    title="Retour à la liste"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {activeTitle}
                </h1>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                {activeSubtitle}
              </p>
            </div>

            {!selectedSub && section !== 'cards' && section !== 'history' && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un abonnement..."
                    className="w-full h-8 pl-8 pr-7 rounded-lg bg-slate-50 dark:bg-[#1e293b] focus:bg-white dark:focus:bg-[#161f33] border border-slate-300 dark:border-slate-600 focus:border-[#0051c3] dark:focus:border-blue-400 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ZONE DE CONTENU PLEINE LARGEUR DÉFILABLE */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 space-y-5">
          {/* Retours / Alertes */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-1 rounded hover:bg-black/5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {hasAlerts && !selectedSub && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-800 dark:text-rose-200">
                    Un ou plusieurs abonnements nécessitent votre attention
                  </div>
                  <div className="text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                    Cliquez sur la carte concernée pour régulariser votre paiement et rétablir l&apos;accès immédiatement.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VUE DÉTAIL D'UN ABONNEMENT SÉLECTIONNÉ                          */}
          {/* =============================================================== */}
          {selectedSub ? (
            (() => {
              const isInf = Number(selectedSub.is_infinite) === 1 || selectedSub.renewal_mode === 'infinite';
              const isAuto = !isInf && selectedSub.renewal_mode === 'auto';
              const canAuto = !isInf && Number(selectedSub.plan_allows_auto) === 1;
              const hasCard = paymentMethods.length > 0;
              const cd = computeLiveCountdownLabel(selectedSub);
              const palette = getCardPalette(selectedSub);
              const isBusy = busyId === selectedSub.id;

              return (
                <div className="space-y-4">
                  {/* Bandeau coloré récapitulatif */}
                  <div
                    style={{ backgroundColor: palette.bg, borderColor: palette.border }}
                    className="rounded-xl p-5 border text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/80">
                        {palette.serviceLabel}
                      </div>
                      <h2 className="text-xl font-black tracking-tight">{selectedSub.plan_name}</h2>
                      <div className="text-xs text-white/90 font-medium flex items-center gap-2 flex-wrap">
                        <span>
                          {formatCurrencyAmount(
                            selectedSub.price_amount || 0,
                            selectedSub.currency || 'XOF'
                          )}
                        </span>
                        <span>•</span>
                        <span>{cd.text}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isInf && onOpenRenewTarget && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenRenewTarget(selectedSub.product_type, selectedSub.app_key)
                          }
                          className="h-9 px-4 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <span>Renouveler / Changer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grille d'informations & contrôles */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Carte Dates & Validité */}
                    <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                        <CalendarClock className="w-4 h-4 text-[#0051c3] dark:text-blue-400" />
                        <span>Validité &amp; Échéance</span>
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-700/80 text-xs">
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Statut</span>
                          <span className="font-bold text-slate-900 dark:text-white capitalize">
                            {selectedSub.status === 'active'
                              ? '✅ Actif (Payé)'
                              : selectedSub.status === 'blocked'
                              ? '🔒 Suspendu'
                              : selectedSub.status === 'grace'
                              ? '⏳ Période de grâce'
                              : selectedSub.status}
                          </span>
                        </div>
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Début de période</span>
                          <span className="font-semibold">
                            {formatDateTimeFr(selectedSub.current_period_start)}
                          </span>
                        </div>
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Expiration exacte</span>
                          <span className="font-bold text-amber-700 dark:text-amber-300">
                            {isInf ? '♾️ Jamais (À vie)' : formatDateTimeFr(selectedSub.current_period_end)}
                          </span>
                        </div>
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Moyen utilisé</span>
                          <span className="font-semibold">
                            {selectedSub.last_network_label || 'Paystack'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Carte Mode Auto / Manuel */}
                    <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                            {isInf ? (
                              <InfinityIcon className="w-4 h-4 text-amber-500" />
                            ) : isAuto ? (
                              <Zap className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-sky-500" />
                            )}
                            <span>Mode de renouvellement</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b] text-[11px] font-bold">
                            {isInf ? '♾️ Infini (À vie)' : isAuto ? '⚡ Automatique' : '🔄 Manuel'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {isInf
                            ? 'Cet abonnement est actif à vie sur votre compte. Aucun prélèvement ni renouvellement ne sera jamais facturé.'
                            : isAuto
                            ? 'Votre carte bancaire enregistrée sera prélevée automatiquement à la date d’échéance. Vous pouvez basculer en mode manuel à tout moment.'
                            : canAuto
                            ? 'Aucun prélèvement automatique. Vous renouvelez vous-même ou vous pouvez associer une carte Visa/Mastercard pour passer en automatique.'
                            : 'Ce forfait fonctionne uniquement en paiement manuel. Aucun prélèvement automatique ne sera effectué.'}
                        </p>
                      </div>

                      {!isInf && canAuto && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          {hasCard ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleMode(selectedSub, isAuto ? 'manual' : 'auto')}
                                className="flex-1 h-9 px-3 rounded-lg bg-[#0f172a] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-60"
                              >
                                {isBusy
                                  ? 'Mise à jour...'
                                  : isAuto
                                  ? '🔄 Passer en Paiement Manuel'
                                  : '⚡ Activer le Paiement Automatique'}
                              </button>
                              {isAuto && Number(selectedSub.cancel_at_period_end) !== 1 && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleCancelAuto(selectedSub)}
                                  className="h-9 px-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-rose-100 cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Arrêter en fin de période</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={linkingCard}
                              onClick={() => openAddCardModal(selectedSub)}
                              className="w-full h-9 px-3 rounded-lg bg-[#047857] hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Associer une carte Visa / Mastercard (Passer en Auto)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : section === 'cards' ? (
            /* =============================================================== */
            /* SECTION CARTES VISA / MASTERCARD (UNIQUEMENT CARTES ENREGISTRÉES) */
            /* =============================================================== */
            paymentMethods.length === 0 ? (
              <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center space-y-2">
                <div className="inline-flex items-center justify-center rounded-md bg-white border border-slate-300 px-3 py-1.5 shadow-xs mb-1">
                  <img
                    src="/payment-logos/visa-mastercard.png"
                    alt="Visa et Mastercard"
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Aucune carte bancaire enregistrée
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                  Cliquez sur « Ajouter une carte » dans la barre latérale gauche pour associer une carte Visa ou Mastercard.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paymentMethods.map((pm) => {
                  const isBusyCard = busyId === pm.id;
                  const appsList = Array.isArray(pm.autoApps) ? pm.autoApps : [];
                  const hasAnyAppAuto = appsList.length > 0;
                  const appsScopeNote =
                    appsList.includes('*')
                      ? 'Toutes les applications'
                      : appsList.length > 0
                      ? `Uniquement : ${appsList.join(', ')}`
                      : 'Renouvellement mensuel / périodique';

                  return (
                    <div
                      key={pm.id}
                      className="rounded-lg bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"
                    >
                      {/* En-tête visuel Carte Bancaire avec logo officiel Visa / Mastercard */}
                      <div className="p-4 bg-[#0f172a] text-white border-b border-slate-800">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="rounded bg-white px-2 py-1 border border-slate-200 shrink-0">
                              <img
                                src="/payment-logos/visa-mastercard.png"
                                alt="Visa et Mastercard"
                                className="h-6 w-auto object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                {pm.isDefault ? 'CARTE PRINCIPALE' : 'CARTE ENREGISTRÉE'}
                              </div>
                              <h3 className="text-sm font-bold text-white truncate mt-0.5 font-mono tracking-tight">
                                {pm.label || `${pm.cardBrand || pm.brand || 'Carte'} •••• ${pm.last4}`}
                              </h3>
                              <div className="text-[11px] text-slate-300 mt-0.5 truncate">
                                Exp. {pm.expMonth}/{pm.expYear} {pm.bank ? `· ${pm.bank}` : ''}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isBusyCard}
                            onClick={() => handleRemoveCard(pm)}
                            className="w-7 h-7 rounded-md bg-white/10 hover:bg-rose-600 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 disabled:opacity-50"
                            title="Supprimer cette carte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Contrôles structurés par service */}
                      <div className="p-4 space-y-2 flex-1 text-xs">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Services autorisés en automatique
                          </span>
                          {isBusyCard && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0051c3]" />}
                        </div>

                        <label
                          className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition ${
                            pm.autoStorage
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20'
                              : 'border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isBusyCard}
                            checked={Boolean(pm.autoStorage)}
                            onChange={(e) =>
                              handleToggleCardPermission(pm, { autoStorage: e.target.checked })
                            }
                            className="w-4 h-4 rounded accent-[#2563eb] cursor-pointer shrink-0"
                          />
                          <div className="w-7 h-7 rounded bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
                            <HardDrive className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                              Stockage Cloud
                            </div>
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                              Renouvellement auto à l&apos;échéance
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              pm.autoStorage
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {pm.autoStorage ? 'Auto' : 'Manuel'}
                          </span>
                        </label>

                        <div
                          className={`rounded-md border overflow-hidden transition ${
                            pm.autoAi
                              ? 'border-violet-300 dark:border-violet-700 bg-violet-50/30 dark:bg-violet-950/15'
                              : 'border-slate-200 dark:border-slate-700/80'
                          }`}
                        >
                          <label className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <input
                              type="checkbox"
                              disabled={isBusyCard}
                              checked={Boolean(pm.autoAi)}
                              onChange={(e) =>
                                handleToggleCardPermission(pm, {
                                  autoAi: e.target.checked,
                                  ...(e.target.checked ? {} : { autoAiOnDepleted: false }),
                                })
                              }
                              className="w-4 h-4 rounded accent-[#7c3aed] cursor-pointer shrink-0"
                            />
                            <div className="w-7 h-7 rounded bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-700 dark:text-violet-300 shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                                Crédits IA
                              </div>
                              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                                Renouvellement auto à l&apos;échéance
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                pm.autoAi
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {pm.autoAi ? 'Auto' : 'Manuel'}
                            </span>
                          </label>

                          {pm.autoAi && (
                            <label className="flex items-center gap-2.5 px-3 py-2 border-t border-violet-200/80 dark:border-violet-800/50 bg-violet-50/70 dark:bg-violet-950/35 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={isBusyCard}
                                checked={Boolean(pm.autoAiOnDepleted)}
                                onChange={(e) =>
                                  handleToggleCardPermission(pm, {
                                    autoAiOnDepleted: e.target.checked,
                                  })
                                }
                                className="w-3.5 h-3.5 rounded accent-[#7c3aed] cursor-pointer shrink-0"
                              />
                              <Zap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-violet-950 dark:text-violet-100 leading-tight">
                                  Recharge auto si solde = 0
                                </div>
                                <div className="text-[10px] text-violet-700/80 dark:text-violet-300/80 truncate">
                                  Max 1 recharge / 24h · Reçu email
                                </div>
                              </div>
                            </label>
                          )}
                        </div>

                        <label
                          className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition ${
                            hasAnyAppAuto
                              ? 'border-rose-300 dark:border-rose-700 bg-rose-50/35 dark:bg-rose-950/15'
                              : 'border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isBusyCard}
                            checked={hasAnyAppAuto}
                            onChange={(e) =>
                              handleToggleCardPermission(pm, {
                                autoApps: e.target.checked ? ['*'] : [],
                              })
                            }
                            className="w-4 h-4 rounded accent-[#dc2626] cursor-pointer shrink-0"
                          />
                          <div className="w-7 h-7 rounded bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-300 shrink-0">
                            <AppWindow className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                              Applications
                            </div>
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                              {appsScopeNote}
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              hasAnyAppAuto
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {hasAnyAppAuto ? 'Auto' : 'Manuel'}
                          </span>
                        </label>
                      </div>

                      <div className="px-4 py-2 bg-slate-50 dark:bg-[#0f172a]/70 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>PCI-DSS Paystack</span>
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Active &amp; Réutilisable
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : section === 'history' ? (
            /* =============================================================== */
            /* SECTION ACTIVITÉ & HISTORIQUE (PLEINE LARGEUR)                  */
            /* =============================================================== */
            <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
              {recentEvents.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucune activité enregistrée sur vos abonnements pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-[#0051c3] dark:text-blue-400 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {formatEventLabel(ev.event_type)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                        {formatDateTimeFr(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 rounded-xl p-10 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-[#0051c3]" />
              <span>Chargement de vos abonnements...</span>
            </div>
          ) : visibleSubscriptions.length === 0 ? (
            /* =============================================================== */
            /* ÉTAT VIDE ÉPURÉ — AUCUNE CARTE PUBLICITAIRE                     */
            /* =============================================================== */
            <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery.trim()
                  ? `Aucun abonnement ne correspond à « ${searchQuery} »`
                  : 'Aucun abonnement actif dans cette catégorie'}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                {searchQuery.trim()
                  ? 'Essayez un autre mot-clé dans la barre de recherche.'
                  : 'Vos abonnements Stockage Cloud, Crédits IA et Applications apparaîtront automatiquement ici dès leur activation.'}
              </p>
              {searchQuery.trim() && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Effacer la recherche
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* GRILLE DES ABONNEMENTS ACTIFS — CARTES IDENTIQUES À IMAGE 2     */
            /* =============================================================== */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {visibleSubscriptions.map((sub) => {
                const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
                const isAuto = !isInf && sub.renewal_mode === 'auto';
                const cd = computeLiveCountdownLabel(sub);
                const palette = getCardPalette(sub);

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    style={{ backgroundColor: palette.bg, borderColor: palette.border }}
                    className="group relative rounded-xl p-4 flex flex-col justify-between min-h-[144px] text-white transition cursor-pointer overflow-hidden border shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:shadow-md hover:brightness-[1.05]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/80 truncate">
                          {palette.serviceLabel}
                        </div>
                        <h3 className="text-sm font-bold text-white truncate mt-0.5 uppercase">
                          {sub.plan_name}
                        </h3>
                        <div className="text-[11px] text-white/90 font-medium truncate mt-0.5">
                          {formatCurrencyAmount(sub.price_amount || 0, sub.currency || 'XOF')} ·{' '}
                          {isInf ? '♾️ À vie' : isAuto ? '⚡ Automatique' : '🔄 Manuel'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubId(sub.id);
                        }}
                        className="w-7 h-7 rounded-md hover:bg-black/20 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                        title="Gérer cet abonnement"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-white/25 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-medium text-white/95 truncate">
                        <span>{cd.short}</span>
                        <span className="text-white/60">•</span>
                        <span>
                          {sub.status === 'active'
                            ? 'Actif'
                            : sub.status === 'blocked'
                            ? 'Bloqué'
                            : sub.status === 'grace'
                            ? 'Grâce'
                            : sub.status}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-semibold text-white shrink-0">
                        <span>Ouvrir</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODALE STUDYCLOUD : ASSOCIER UNE CARTE — MISE EN PAGE CARRÉE PRO      */}
      {/* ===================================================================== */}
      {showAddCardModal &&
        (() => {
          const selectedServicesCount =
            (addCardPerms.autoStorage ? 1 : 0) +
            (addCardPerms.autoAi ? 1 : 0) +
            (addCardPerms.autoApps.length > 0 ? 1 : 0);
          const allSelected = selectedServicesCount === 3;

          return (
            <div
              className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
              onClick={() => !linkingCard && setShowAddCardModal(false)}
            >
              <div
                className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* BARRE D'EN-TÊTE STRUCTURÉE AVEC LE VRAI LOGO VISA / MASTERCARD */}
                <div className="px-5 py-3.5 bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-700 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 px-2.5 rounded-md bg-white border border-slate-300 flex items-center justify-center shrink-0 shadow-2xs">
                      <img
                        src="/payment-logos/visa-mastercard.png"
                        alt="Visa et Mastercard"
                        className="h-7 w-auto object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white tracking-tight truncate">
                        Associer une carte bancaire Visa / Mastercard
                      </h3>
                      <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Enregistrement sécurisé sans achat immédiat · Contrôle complet par service
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCardModal(false)}
                    className="w-8 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer shrink-0 transition"
                    aria-label="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* CORPS 2 COLONNES ÉQUILIBRÉES : APERÇU + GARANTIES (GAUCHE) / SERVICES (DROITE) */}
                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-12 md:divide-x divide-slate-200 dark:divide-slate-700/90">
                  {/* COLONNE GAUCHE : VISUEL CARTE OFFICIEL + TABLEAU DE VÉRIFICATION */}
                  <div className="md:col-span-5 bg-slate-50 dark:bg-[#0d1424] p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-4">
                      {/* Aperçu Carte Bancaire Carré */}
                      <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-4 text-white shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="rounded bg-white px-2.5 py-1 border border-slate-200">
                            <img
                              src="/payment-logos/visa-mastercard.png"
                              alt="Visa et Mastercard"
                              className="h-6 w-auto object-contain"
                            />
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            PCI-DSS
                          </span>
                        </div>

                        <div className="font-mono text-sm tracking-[0.18em] text-slate-200 pt-1">
                          •••• &nbsp;•••• &nbsp;•••• &nbsp;XXXX
                        </div>

                        <div className="pt-2.5 border-t border-white/10 flex items-end justify-between gap-2 text-[10.5px]">
                          <div className="min-w-0">
                            <div className="uppercase tracking-wider text-slate-400 text-[9.5px]">
                              Titulaire du compte
                            </div>
                            <div className="font-semibold text-white truncate mt-0.5">
                              {userName}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="uppercase tracking-wider text-slate-400 text-[9.5px]">
                              Autorisations
                            </div>
                            <div className="font-bold text-emerald-300 mt-0.5">
                              {selectedServicesCount} / 3 services
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tableau structuré des conditions de vérification */}
                      <div className="rounded-lg bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-3.5 py-2 bg-slate-100/80 dark:bg-[#1a243b] border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Récapitulatif de vérification
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-700/80 text-[11.5px]">
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Coût net facturé</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">0 FCFA</span>
                          </div>
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Empreinte bancaire</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              100 FCFA <span className="text-emerald-600 dark:text-emerald-400 font-bold">(remboursée)</span>
                            </span>
                          </div>
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Opérateur sécurisé</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Paystack</span>
                          </div>
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Révocation</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">1 clic à tout moment</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Note sécurité concise */}
                    <div className="p-3 rounded-md bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-950 dark:text-emerald-200 leading-relaxed">
                        L&apos;empreinte de <strong>100 FCFA</strong> sert uniquement à valider la carte auprès de votre banque et est <strong>remboursée automatiquement</strong> juste après.
                      </p>
                    </div>
                  </div>

                  {/* COLONNE DROITE : SERVICES AUTORISÉS BIEN RÉPARTIS ET STRUCTURÉS */}
                  <div className="md:col-span-7 bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                            Services autorisés au paiement automatique
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Cochez uniquement les services que cette carte pourra régler à l&apos;échéance.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAddCardPerms(
                              allSelected
                                ? { autoStorage: false, autoAi: false, autoAiOnDepleted: false, autoApps: [] }
                                : { autoStorage: true, autoAi: true, autoAiOnDepleted: addCardPerms.autoAiOnDepleted, autoApps: ['*'] }
                            )
                          }
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b] hover:bg-slate-100 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0 transition"
                        >
                          {allSelected ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      </div>

                      {/* Service 1 : Stockage Cloud */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition ${
                          addCardPerms.autoStorage
                            ? 'border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#131c2e]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={addCardPerms.autoStorage}
                          onChange={(e) =>
                            setAddCardPerms((prev) => ({ ...prev, autoStorage: e.target.checked }))
                          }
                          className="w-4 h-4 rounded accent-[#2563eb] cursor-pointer shrink-0"
                        />
                        <div className="w-9 h-9 rounded-md bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Stockage Cloud
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                addCardPerms.autoStorage
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {addCardPerms.autoStorage ? 'Automatique' : 'Manuel'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Renouvelle automatiquement vos forfaits de stockage non-infinis à la date d&apos;échéance.
                          </p>
                        </div>
                      </label>

                      {/* Service 2 : Crédits IA + Option Solde à 0 */}
                      <div
                        className={`rounded-lg border overflow-hidden transition ${
                          addCardPerms.autoAi
                            ? 'border-violet-400 dark:border-violet-600 bg-violet-50/30 dark:bg-violet-950/15'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#131c2e]'
                        }`}
                      >
                        <label className="flex items-center gap-3.5 p-3.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addCardPerms.autoAi}
                            onChange={(e) =>
                              setAddCardPerms((prev) => ({
                                ...prev,
                                autoAi: e.target.checked,
                                autoAiOnDepleted: e.target.checked ? prev.autoAiOnDepleted : false,
                              }))
                            }
                            className="w-4 h-4 rounded accent-[#7c3aed] cursor-pointer shrink-0"
                          />
                          <div className="w-9 h-9 rounded-md bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-700 dark:text-violet-300 shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                Crédits IA StudyCloud
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                  addCardPerms.autoAi
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {addCardPerms.autoAi ? 'Automatique' : 'Manuel'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              Renouvelle automatiquement votre forfait de crédits IA à l&apos;échéance mensuelle.
                            </p>
                          </div>
                        </label>

                        {addCardPerms.autoAi && (
                          <label className="flex items-center gap-3 px-4 py-2.5 border-t border-violet-200 dark:border-violet-800/60 bg-violet-50/80 dark:bg-violet-950/40 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={addCardPerms.autoAiOnDepleted}
                              onChange={(e) =>
                                setAddCardPerms((prev) => ({ ...prev, autoAiOnDepleted: e.target.checked }))
                              }
                              className="w-3.5 h-3.5 rounded accent-[#7c3aed] cursor-pointer shrink-0"
                            />
                            <div className="w-6 h-6 rounded bg-violet-200/70 dark:bg-violet-900/70 flex items-center justify-center text-violet-700 dark:text-violet-200 shrink-0">
                              <Zap className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11.5px] font-bold text-violet-950 dark:text-violet-100 leading-tight">
                                Recharger automatiquement si mon solde IA arrive à 0
                              </div>
                              <div className="text-[10.5px] text-violet-700/85 dark:text-violet-300/85 mt-0.5">
                                Sécurité anti-boucle : 1 recharge max / 24h · Reçu envoyé par email
                              </div>
                            </div>
                          </label>
                        )}
                      </div>

                      {/* Service 3 : Applications */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition ${
                          addCardPerms.autoApps.length > 0
                            ? 'border-rose-400 dark:border-rose-600 bg-rose-50/35 dark:bg-rose-950/15'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#131c2e]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={addCardPerms.autoApps.length > 0}
                          onChange={(e) =>
                            setAddCardPerms((prev) => ({
                              ...prev,
                              autoApps: e.target.checked ? ['*'] : [],
                            }))
                          }
                          className="w-4 h-4 rounded accent-[#dc2626] cursor-pointer shrink-0"
                        />
                        <div className="w-9 h-9 rounded-md bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-300 shrink-0">
                          <AppWindow className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Applications (Moyennes &amp; futures apps)
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                addCardPerms.autoApps.length > 0
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {addCardPerms.autoApps.length > 0 ? 'Automatique' : 'Manuel'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Règle automatiquement les abonnements mensuels ou périodiques de vos applications.
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Barre de synthèse discrète en bas de la colonne droite */}
                    <div className="px-3.5 py-2.5 rounded-md bg-slate-50 dark:bg-[#0d1424] border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2">
                      <span>
                        {selectedServicesCount > 0
                          ? 'Les forfaits à vie (Infini) ne sont jamais prélevés.'
                          : 'Carte enregistrée en réserve — aucun prélèvement auto activé.'}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                        Modifiable à tout moment
                      </span>
                    </div>
                  </div>
                </div>

                {/* BARRE DE PIED ARCHITECTURALE */}
                <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#0f172a] border-t border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Chiffrement bancaire TLS · Traitement certifié PCI-DSS par Paystack</span>
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={linkingCard}
                      onClick={() => setShowAddCardModal(false)}
                      className="h-9 px-4 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={linkingCard}
                      onClick={() => handleLinkCard(addCardTargetSubId, addCardPerms)}
                      className="h-9 px-4 rounded-md bg-[#047857] hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-xs"
                    >
                      {linkingCard ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>Continuer vers la saisie sécurisée (0 FCFA net)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
