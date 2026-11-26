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

const MY_SUBS_PAGE_BG_STYLE: React.CSSProperties = {
  background: [
    'radial-gradient(ellipse 68% 55% at 18% 22%, rgba(29, 99, 237, 0.44) 0%, rgba(15, 58, 148, 0.22) 38%, rgba(11, 21, 38, 0.08) 68%, transparent 86%)',
    'radial-gradient(ellipse 60% 52% at 86% 78%, rgba(6, 182, 212, 0.28) 0%, rgba(14, 116, 144, 0.14) 40%, transparent 74%)',
    'radial-gradient(ellipse 55% 45% at 82% 10%, rgba(79, 70, 229, 0.22) 0%, rgba(15, 23, 42, 0.5) 55%, transparent 82%)',
    'linear-gradient(155deg, #070C17 0%, #0C1628 45%, #091322 78%, #060B14 100%)',
  ].join(', '),
};

function getCardPalette(sub: ActiveSubscriptionRecord): {
  gradient: string;
  border: string;
  glow: string;
  serviceLabel: string;
} {
  const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
  if (sub.status === 'blocked') {
    return {
      gradient: 'linear-gradient(145deg, rgba(190, 18, 60, 0.92) 0%, rgba(120, 14, 43, 0.94) 48%, rgba(28, 7, 16, 0.98) 100%)',
      border: 'rgba(251, 113, 133, 0.38)',
      glow: '0 16px 36px -12px rgba(190, 18, 60, 0.45)',
      serviceLabel: 'SUSPENDU',
    };
  }
  if (isInf) {
    return {
      gradient: 'linear-gradient(145deg, rgba(217, 119, 6, 0.94) 0%, rgba(146, 64, 14, 0.94) 46%, rgba(36, 19, 7, 0.98) 100%)',
      border: 'rgba(251, 191, 36, 0.42)',
      glow: '0 16px 36px -12px rgba(217, 119, 6, 0.42)',
      serviceLabel:
        sub.product_type === 'storage'
          ? 'STOCKAGE CLOUD · À VIE'
          : sub.product_type === 'ai'
          ? 'CRÉDITS IA · À VIE'
          : `${(sub.app_name || sub.app_key || 'APPLICATION').toUpperCase()} · À VIE`,
    };
  }
  if (sub.product_type === 'storage') {
    return {
      gradient: 'linear-gradient(145deg, rgba(14, 165, 233, 0.92) 0%, rgba(3, 105, 161, 0.94) 44%, rgba(11, 36, 68, 0.98) 100%)',
      border: 'rgba(125, 211, 252, 0.36)',
      glow: '0 16px 36px -12px rgba(14, 165, 233, 0.42)',
      serviceLabel: 'STOCKAGE CLOUD',
    };
  }
  if (sub.product_type === 'ai') {
    return {
      gradient: 'linear-gradient(145deg, rgba(124, 58, 237, 0.92) 0%, rgba(91, 33, 182, 0.94) 44%, rgba(28, 16, 62, 0.98) 100%)',
      border: 'rgba(196, 181, 253, 0.36)',
      glow: '0 16px 36px -12px rgba(124, 58, 237, 0.45)',
      serviceLabel: 'CRÉDITS IA',
    };
  }
  return {
    gradient: 'linear-gradient(145deg, rgba(225, 29, 72, 0.92) 0%, rgba(159, 18, 57, 0.94) 44%, rgba(45, 10, 24, 0.98) 100%)',
    border: 'rgba(253, 164, 175, 0.36)',
    glow: '0 16px 36px -12px rgba(225, 29, 72, 0.42)',
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
  // BARRE LATÉRALE GAUCHE — VERRE SOMBRE SAPHIR HARMONISÉ
  // ============================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-[#08101E]/86 backdrop-blur-xl text-slate-100 select-none">
      {/* Haut fixe */}
      <div className="px-3 pt-2.5 pb-2.5 border-b border-white/10 shrink-0 space-y-2.5">
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/14 bg-white/[0.06] hover:bg-white/[0.13] text-[11px] font-semibold text-slate-100 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-300" />
          <span className="truncate">
            {selectedSub ? 'Tous les abonnements' : 'Tableau de bord'}
          </span>
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg border border-sky-400/35 bg-gradient-to-br from-sky-500/25 to-blue-600/20 flex items-center justify-center shrink-0 text-sky-300 shadow-inner">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate leading-tight">
              Mes abonnements
            </div>
            <div className="text-[10.5px] text-slate-400 truncate leading-tight mt-0.5">
              Facturation &amp; Cartes
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden w-7 h-7 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Milieu défilable : Onglets d'abonnements + Cartes & Suivi */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2.5 space-y-1.5">
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
              className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-lg border text-xs transition cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] border-sky-300/45 text-white font-semibold shadow-md shadow-sky-500/25'
                  : 'bg-white/[0.03] border-white/10 hover:border-sky-400/35 text-slate-300 hover:text-white hover:bg-white/[0.07] font-medium'
              }`}
            >
              {!isSelected && (
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: cat.accent }}
                />
              )}
              <div className={`flex items-center gap-2 min-w-0 flex-1 ${!isSelected ? 'pl-1' : ''}`}>
                <CatIcon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSelected ? 'text-white' : 'text-slate-400 group-hover:text-sky-300'
                  }`}
                />
                <span className="truncate">{cat.label}</span>
              </div>
            </div>
          );
        })}

        {/* Sous-section Paiements & Suivi */}
        <div className="pt-3 px-1.5 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400/90">
            Cartes &amp; Suivi
          </span>
        </div>

        <div
          onClick={() => {
            setSelectedSubId(null);
            setSection('cards');
            setIsMobileSidebarOpen(false);
          }}
          className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-lg border text-xs transition cursor-pointer ${
            section === 'cards' && !selectedSub
              ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] border-sky-300/45 text-white font-semibold shadow-md shadow-sky-500/25'
              : 'bg-white/[0.03] border-white/10 hover:border-sky-400/35 text-slate-300 hover:text-white hover:bg-white/[0.07] font-medium'
          }`}
        >
          {!(section === 'cards' && !selectedSub) && (
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-400" />
          )}
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${!(section === 'cards' && !selectedSub) ? 'pl-1' : ''}`}>
            <CreditCard
              className={`w-3.5 h-3.5 shrink-0 ${
                section === 'cards' && !selectedSub ? 'text-white' : 'text-slate-400 group-hover:text-sky-300'
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
          className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-lg border text-xs transition cursor-pointer ${
            section === 'history' && !selectedSub
              ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] border-sky-300/45 text-white font-semibold shadow-md shadow-sky-500/25'
              : 'bg-white/[0.03] border-white/10 hover:border-sky-400/35 text-slate-300 hover:text-white hover:bg-white/[0.07] font-medium'
          }`}
        >
          {!(section === 'history' && !selectedSub) && (
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400" />
          )}
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${!(section === 'history' && !selectedSub) ? 'pl-1' : ''}`}>
            <Receipt
              className={`w-3.5 h-3.5 shrink-0 ${
                section === 'history' && !selectedSub ? 'text-white' : 'text-slate-400 group-hover:text-sky-300'
              }`}
            />
            <span className="truncate">Activité &amp; Historique</span>
          </div>
        </div>
      </div>

      {/* Bas fixe de la barre latérale : Ajouter une carte Visa / Mastercard */}
      <div className="px-2.5 py-2.5 border-t border-white/10 shrink-0">
        <button
          type="button"
          disabled={linkingCard}
          onClick={() => {
            setIsMobileSidebarOpen(false);
            openAddCardModal();
          }}
          className="w-full px-2.5 h-9 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] hover:border-sky-400/45 text-xs font-semibold text-white flex items-center justify-between gap-2 transition cursor-pointer disabled:opacity-60"
        >
          <span className="flex items-center gap-2 truncate">
            {linkingCard ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            ) : (
              <img
                src="/payment-logos/visa-mastercard.png"
                alt="Visa / Mastercard"
                className="h-4 w-7 object-contain rounded-[3px] bg-white border border-white/30 px-0.5 shrink-0"
              />
            )}
            <span className="truncate">Ajouter une carte</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
      style={MY_SUBS_PAGE_BG_STYLE}
      className={`flex flex-1 w-full text-slate-100 overflow-hidden font-sans transition-all duration-300 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-[60] w-screen h-screen min-h-screen'
          : 'relative h-dvh min-h-dvh'
      }`}
    >
      {/* BARRE LATÉRALE DESKTOP (>= md) */}
      <aside className="hidden md:flex w-[228px] lg:w-[244px] shrink-0 flex-col border-r border-white/10 h-full min-h-0 z-20">
        {renderSidebarContent()}
      </aside>

      {/* TIROIR LATÉRAL MOBILE (< md) */}
      {isMobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-black/65 backdrop-blur-[2px]"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="w-[264px] max-w-[82vw] h-full shadow-2xl border-r border-white/12"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZONE PRINCIPALE À DROITE — PLEIN ÉCRAN SAPHIR & AURORA MODERNE        */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
        {/* BARRE SUPÉRIEURE UNIFIÉE : MENU MOBILE + FIL D'ARIANE + USER + EXPAND */}
        <header className="h-12 bg-[#08101E]/68 backdrop-blur-xl border-b border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer shrink-0"
              aria-label="Ouvrir le menu latéral"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden" aria-label="Fil d'Ariane">
              <button
                type="button"
                onClick={onBack}
                className="text-slate-400 hover:text-white font-medium truncate cursor-pointer transition"
              >
                StudyCloud
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setSelectedSubId(null);
                  setSection('all');
                }}
                className={`truncate cursor-pointer transition ${
                  section === 'all' && !selectedSub
                    ? 'text-white font-bold'
                    : 'text-slate-400 hover:text-white font-medium'
                }`}
              >
                Mes abonnements
              </button>
              {section !== 'all' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setSelectedSubId(null)}
                    className={`truncate cursor-pointer transition ${
                      !selectedSub
                        ? 'text-white font-bold'
                        : 'text-slate-400 hover:text-white font-medium'
                    }`}
                  >
                    {sectionMeta[section].title}
                  </button>
                </>
              )}
              {selectedSub && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-sky-300 font-bold truncate max-w-[160px]">
                    {selectedSub.plan_name}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/12 bg-white/[0.06]">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] text-white flex items-center justify-center font-bold text-[10px]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] font-semibold text-slate-100 max-w-[110px] truncate">
                {userName}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 pl-1.5 border-l border-white/12">
              <ViewerSuperExpandButton
                expandLevel={viewerExpandLevel}
                onExpandChange={(lvl) => setViewerExpandLevel(lvl)}
              />
              <button
                type="button"
                onClick={handleToggleMaximize}
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition cursor-pointer ${
                  viewerExpandLevel >= 1
                    ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white border-sky-300/50'
                    : 'bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 border-white/15'
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
        <div className="shrink-0 bg-[#08101E]/46 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-4">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {selectedSub && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubId(null)}
                    className="w-7 h-7 rounded-lg border border-white/15 bg-white/[0.07] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer shrink-0 transition"
                    title="Retour à la liste"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <h1 className="text-base sm:text-xl font-extrabold text-white tracking-tight truncate">
                  {activeTitle}
                </h1>
              </div>
              <p className="text-xs text-slate-300/85 mt-0.5 truncate">
                {activeSubtitle}
              </p>
            </div>

            {!selectedSub && section !== 'cards' && section !== 'history' && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un abonnement..."
                    className="w-full h-9 pl-9 pr-8 rounded-xl bg-white/[0.07] focus:bg-[#0B1528]/90 border border-white/15 focus:border-sky-400/70 text-xs text-white placeholder:text-slate-400 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
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
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 backdrop-blur-md ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                  : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
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
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {hasAlerts && !selectedSub && (
            <div className="p-3.5 rounded-xl bg-rose-500/14 backdrop-blur-md border border-rose-400/35 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-200">
                    Un ou plusieurs abonnements nécessitent votre attention
                  </div>
                  <div className="text-rose-200/80 mt-0.5">
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
                    style={{
                      background: palette.gradient,
                      borderColor: palette.border,
                      boxShadow: palette.glow,
                    }}
                    className="rounded-2xl p-5 border text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                          className="h-9 px-4 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-sm"
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
                    <div className="bg-[#0B1426]/82 backdrop-blur-xl border border-white/12 rounded-2xl p-5 space-y-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)]">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <CalendarClock className="w-4 h-4 text-sky-400" />
                        <span>Validité &amp; Échéance</span>
                      </div>
                      <div className="divide-y divide-white/10 text-xs">
                        <div className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-400">Statut</span>
                          <span className="font-bold text-white capitalize">
                            {selectedSub.status === 'active'
                              ? '✅ Actif (Payé)'
                              : selectedSub.status === 'blocked'
                              ? '🔒 Suspendu'
                              : selectedSub.status === 'grace'
                              ? '⏳ Période de grâce'
                              : selectedSub.status}
                          </span>
                        </div>
                        <div className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-400">Début de période</span>
                          <span className="font-semibold text-slate-100">
                            {formatDateTimeFr(selectedSub.current_period_start)}
                          </span>
                        </div>
                        <div className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-400">Expiration exacte</span>
                          <span className="font-bold text-amber-300">
                            {isInf ? '♾️ Jamais (À vie)' : formatDateTimeFr(selectedSub.current_period_end)}
                          </span>
                        </div>
                        <div className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-400">Moyen utilisé</span>
                          <span className="font-semibold text-slate-100">
                            {selectedSub.last_network_label || 'Paystack'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Carte Mode Auto / Manuel */}
                    <div className="bg-[#0B1426]/82 backdrop-blur-xl border border-white/12 rounded-2xl p-5 space-y-3 flex flex-col justify-between shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)]">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            {isInf ? (
                              <InfinityIcon className="w-4 h-4 text-amber-400" />
                            ) : isAuto ? (
                              <Zap className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-sky-400" />
                            )}
                            <span>Mode de renouvellement</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full border border-white/15 bg-white/[0.06] text-white text-[11px] font-bold">
                            {isInf ? '♾️ Infini (À vie)' : isAuto ? '⚡ Automatique' : '🔄 Manuel'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
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
                                className="flex-1 h-9 px-4 rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] hover:from-[#3B82F6] hover:to-[#38BDF8] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-60 shadow-md shadow-sky-500/20"
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
                                  className="h-9 px-3.5 rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-rose-500/25 cursor-pointer transition"
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
                              className="w-full h-9 px-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 shadow-md shadow-emerald-500/20"
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
              <div className="bg-[#0B1426]/82 backdrop-blur-xl border border-white/12 rounded-2xl p-10 text-center space-y-2.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)]">
                <div className="inline-flex items-center justify-center rounded-lg bg-white border border-white/30 px-3 py-1.5 shadow-sm mb-1">
                  <img
                    src="/payment-logos/visa-mastercard.png"
                    alt="Visa et Mastercard"
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <div className="text-sm font-bold text-white">
                  Aucune carte bancaire enregistrée
                </div>
                <p className="text-xs text-slate-300/85 max-w-sm mx-auto">
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
                      className="rounded-2xl bg-[#0B1426]/86 backdrop-blur-xl border border-white/12 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col"
                    >
                      {/* En-tête visuel Carte Bancaire avec logo officiel Visa / Mastercard */}
                      <div className="p-4 bg-gradient-to-br from-[#0F2142] via-[#0B1730] to-[#081020] text-white border-b border-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="rounded-md bg-white px-2 py-1 border border-white/30 shrink-0">
                              <img
                                src="/payment-logos/visa-mastercard.png"
                                alt="Visa et Mastercard"
                                className="h-6 w-auto object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
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
                            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-rose-600 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 disabled:opacity-50"
                            title="Supprimer cette carte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Contrôles structurés par service */}
                      <div className="p-4 space-y-2 flex-1 text-xs">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                            Services autorisés en automatique
                          </span>
                          {isBusyCard && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
                        </div>

                        <label
                          className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                            pm.autoStorage
                              ? 'border-sky-400/40 bg-sky-500/10'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isBusyCard}
                            checked={Boolean(pm.autoStorage)}
                            onChange={(e) =>
                              handleToggleCardPermission(pm, { autoStorage: e.target.checked })
                            }
                            className="w-4 h-4 rounded accent-[#0EA5E9] cursor-pointer shrink-0"
                          />
                          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
                            <HardDrive className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-white leading-tight">
                              Stockage Cloud
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              Renouvellement auto à l&apos;échéance
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              pm.autoStorage
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                : 'bg-white/[0.06] text-slate-400'
                            }`}
                          >
                            {pm.autoStorage ? 'Auto' : 'Manuel'}
                          </span>
                        </label>

                        <div
                          className={`rounded-xl border overflow-hidden transition ${
                            pm.autoAi
                              ? 'border-violet-400/40 bg-violet-500/10'
                              : 'border-white/10 bg-white/[0.02]'
                          }`}
                        >
                          <label className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-white/[0.04]">
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
                              className="w-4 h-4 rounded accent-[#8B5CF6] cursor-pointer shrink-0"
                            />
                            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300 shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white leading-tight">
                                Crédits IA
                              </div>
                              <div className="text-[10.5px] text-slate-400 truncate">
                                Renouvellement auto à l&apos;échéance
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                pm.autoAi
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                  : 'bg-white/[0.06] text-slate-400'
                              }`}
                            >
                              {pm.autoAi ? 'Auto' : 'Manuel'}
                            </span>
                          </label>

                          {pm.autoAi && (
                            <label className="flex items-center gap-2.5 px-3 py-2 border-t border-violet-400/25 bg-violet-500/12 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={isBusyCard}
                                checked={Boolean(pm.autoAiOnDepleted)}
                                onChange={(e) =>
                                  handleToggleCardPermission(pm, {
                                    autoAiOnDepleted: e.target.checked,
                                  })
                                }
                                className="w-3.5 h-3.5 rounded accent-[#8B5CF6] cursor-pointer shrink-0"
                              />
                              <Zap className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-violet-100 leading-tight">
                                  Recharge auto si solde = 0
                                </div>
                                <div className="text-[10px] text-violet-300/80 truncate">
                                  Max 1 recharge / 24h · Reçu email
                                </div>
                              </div>
                            </label>
                          )}
                        </div>

                        <label
                          className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                            hasAnyAppAuto
                              ? 'border-rose-400/40 bg-rose-500/10'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
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
                            className="w-4 h-4 rounded accent-[#F43F5E] cursor-pointer shrink-0"
                          />
                          <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0">
                            <AppWindow className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-white leading-tight">
                              Applications
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              {appsScopeNote}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              hasAnyAppAuto
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                : 'bg-white/[0.06] text-slate-400'
                            }`}
                          >
                            {hasAnyAppAuto ? 'Auto' : 'Manuel'}
                          </span>
                        </label>
                      </div>

                      <div className="px-4 py-2.5 bg-white/[0.03] border-t border-white/10 flex items-center justify-between text-[10.5px] text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>PCI-DSS Paystack</span>
                        </span>
                        <span className="font-semibold text-emerald-300">
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
            <div className="bg-[#0B1426]/82 backdrop-blur-xl border border-white/12 rounded-2xl overflow-hidden shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)]">
              {recentEvents.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  Aucune activité enregistrée sur vos abonnements pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-4 py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.04] transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="font-semibold text-white truncate">
                          {formatEventLabel(ev.event_type)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatDateTimeFr(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="bg-[#0B1426]/82 backdrop-blur-xl border border-white/12 rounded-2xl p-10 flex items-center justify-center gap-2 text-xs font-semibold text-slate-200">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>Chargement de vos abonnements...</span>
            </div>
          ) : visibleSubscriptions.length === 0 ? (
            /* =============================================================== */
            /* ÉTAT VIDE ÉPURÉ                                                 */
            /* =============================================================== */
            <div className="bg-[#0B1426]/82 backdrop-blur-xl border border-white/12 rounded-2xl p-10 text-center space-y-2.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)]">
              <div className="w-11 h-11 mx-auto rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-white">
                {searchQuery.trim()
                  ? `Aucun abonnement ne correspond à « ${searchQuery} »`
                  : 'Aucun abonnement actif dans cette catégorie'}
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery.trim()
                  ? 'Essayez un autre mot-clé dans la barre de recherche.'
                  : 'Vos abonnements Stockage Cloud, Crédits IA et Applications apparaîtront automatiquement ici dès leur activation.'}
              </p>
              {searchQuery.trim() && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="h-8 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-white text-xs font-semibold cursor-pointer transition"
                  >
                    Effacer la recherche
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* GRILLE DES ABONNEMENTS ACTIFS — CARTES PRO DÉGRADÉES            */
            /* =============================================================== */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleSubscriptions.map((sub) => {
                const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
                const isAuto = !isInf && sub.renewal_mode === 'auto';
                const cd = computeLiveCountdownLabel(sub);
                const palette = getCardPalette(sub);

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    style={{
                      background: palette.gradient,
                      borderColor: palette.border,
                      boxShadow: palette.glow,
                    }}
                    className="group relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[152px] text-white transition-all duration-300 cursor-pointer overflow-hidden border hover:-translate-y-0.5 hover:brightness-[1.06]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/80 truncate">
                          {palette.serviceLabel}
                        </div>
                        <h3 className="text-base font-extrabold text-white truncate mt-0.5 uppercase tracking-tight">
                          {sub.plan_name}
                        </h3>
                        <div className="text-[11.5px] text-white/90 font-medium truncate mt-1">
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
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-black/25 text-white/85 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                        title="Gérer cet abonnement"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold text-white/95 truncate">
                        <span>{cd.short}</span>
                        <span className="text-white/55">•</span>
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/25 border border-white/20 font-semibold text-white shrink-0">
                        <span>Ouvrir</span>
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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
              className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
              onClick={() => !linkingCard && setShowAddCardModal(false)}
            >
              <div
                className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0B1426] border border-white/15 text-slate-100 shadow-[0_28px_70px_-14px_rgba(0,0,0,0.85)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* BARRE D'EN-TÊTE STRUCTURÉE AVEC LE VRAI LOGO VISA / MASTERCARD */}
                <div className="px-5 py-3.5 bg-[#08101E] border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 px-2.5 rounded-lg bg-white border border-white/30 flex items-center justify-center shrink-0 shadow-xs">
                      <img
                        src="/payment-logos/visa-mastercard.png"
                        alt="Visa et Mastercard"
                        className="h-7 w-auto object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-[15px] font-bold text-white tracking-tight truncate">
                        Associer une carte bancaire Visa / Mastercard
                      </h3>
                      <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                        Enregistrement sécurisé sans achat immédiat · Contrôle complet par service
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCardModal(false)}
                    className="w-8 h-8 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-slate-200 cursor-pointer shrink-0 transition"
                    aria-label="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* CORPS 2 COLONNES ÉQUILIBRÉES : APERÇU + GARANTIES (GAUCHE) / SERVICES (DROITE) */}
                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-12 md:divide-x divide-white/10">
                  {/* COLONNE GAUCHE : VISUEL CARTE OFFICIEL + TABLEAU DE VÉRIFICATION */}
                  <div className="md:col-span-5 bg-[#08101E]/85 p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-4">
                      {/* Aperçu Carte Bancaire */}
                      <div className="rounded-xl bg-gradient-to-br from-[#132952] via-[#0C1A36] to-[#081122] border border-sky-400/25 p-4 text-white shadow-lg space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="rounded bg-white px-2.5 py-1 border border-white/30">
                            <img
                              src="/payment-logos/visa-mastercard.png"
                              alt="Visa et Mastercard"
                              className="h-6 w-auto object-contain"
                            />
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            PCI-DSS
                          </span>
                        </div>

                        <div className="font-mono text-sm tracking-[0.18em] text-slate-200 pt-1">
                          •••• &nbsp;•••• &nbsp;•••• &nbsp;XXXX
                        </div>

                        <div className="pt-2.5 border-t border-white/12 flex items-end justify-between gap-2 text-[10.5px]">
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
                            <div className="font-bold text-sky-300 mt-0.5">
                              {selectedServicesCount} / 3 services
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tableau structuré des conditions de vérification */}
                      <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                        <div className="px-3.5 py-2 bg-white/[0.04] border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          Récapitulatif de vérification
                        </div>
                        <div className="divide-y divide-white/10 text-[11.5px]">
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-400">Coût net facturé</span>
                            <span className="font-bold text-emerald-300">0 FCFA</span>
                          </div>
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-400">Empreinte bancaire</span>
                            <span className="font-semibold text-slate-100">
                              100 FCFA <span className="text-emerald-300 font-bold">(remboursée)</span>
                            </span>
                          </div>
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-400">Opérateur sécurisé</span>
                            <span className="font-semibold text-slate-100">Paystack</span>
                          </div>
                          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
                            <span className="text-slate-400">Révocation</span>
                            <span className="font-semibold text-slate-100">1 clic à tout moment</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Note sécurité concise */}
                    <div className="p-3 rounded-xl bg-emerald-500/12 border border-emerald-400/30 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                        L&apos;empreinte de <strong>100 FCFA</strong> sert uniquement à valider la carte auprès de votre banque et est <strong>remboursée automatiquement</strong> juste après.
                      </p>
                    </div>
                  </div>

                  {/* COLONNE DROITE : SERVICES AUTORISÉS BIEN RÉPARTIS ET STRUCTURÉS */}
                  <div className="md:col-span-7 bg-[#0B1426] p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                            Services autorisés au paiement automatique
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
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
                          className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-semibold text-slate-200 cursor-pointer shrink-0 transition"
                        >
                          {allSelected ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      </div>

                      {/* Service 1 : Stockage Cloud */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition ${
                          addCardPerms.autoStorage
                            ? 'border-sky-400/45 bg-sky-500/12'
                            : 'border-white/10 hover:border-white/25 bg-white/[0.02]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={addCardPerms.autoStorage}
                          onChange={(e) =>
                            setAddCardPerms((prev) => ({ ...prev, autoStorage: e.target.checked }))
                          }
                          className="w-4 h-4 rounded accent-[#0EA5E9] cursor-pointer shrink-0"
                        />
                        <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">
                              Stockage Cloud
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                addCardPerms.autoStorage
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/[0.06] text-slate-400'
                              }`}
                            >
                              {addCardPerms.autoStorage ? 'Automatique' : 'Manuel'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            Renouvelle automatiquement vos forfaits de stockage non-infinis à la date d&apos;échéance.
                          </p>
                        </div>
                      </label>

                      {/* Service 2 : Crédits IA + Option Solde à 0 */}
                      <div
                        className={`rounded-xl border overflow-hidden transition ${
                          addCardPerms.autoAi
                            ? 'border-violet-400/45 bg-violet-500/12'
                            : 'border-white/10 hover:border-white/25 bg-white/[0.02]'
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
                            className="w-4 h-4 rounded accent-[#8B5CF6] cursor-pointer shrink-0"
                          />
                          <div className="w-9 h-9 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300 shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white">
                                Crédits IA StudyCloud
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  addCardPerms.autoAi
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-white/[0.06] text-slate-400'
                                }`}
                              >
                                {addCardPerms.autoAi ? 'Automatique' : 'Manuel'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              Renouvelle automatiquement votre forfait de crédits IA à l&apos;échéance mensuelle.
                            </p>
                          </div>
                        </label>

                        {addCardPerms.autoAi && (
                          <label className="flex items-center gap-3 px-4 py-2.5 border-t border-violet-400/25 bg-violet-500/15 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={addCardPerms.autoAiOnDepleted}
                              onChange={(e) =>
                                setAddCardPerms((prev) => ({ ...prev, autoAiOnDepleted: e.target.checked }))
                              }
                              className="w-3.5 h-3.5 rounded accent-[#8B5CF6] cursor-pointer shrink-0"
                            />
                            <div className="w-6 h-6 rounded bg-violet-500/25 flex items-center justify-center text-violet-200 shrink-0">
                              <Zap className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11.5px] font-bold text-violet-100 leading-tight">
                                Recharger automatiquement si mon solde IA arrive à 0
                              </div>
                              <div className="text-[10.5px] text-violet-300/85 mt-0.5">
                                Sécurité anti-boucle : 1 recharge max / 24h · Reçu envoyé par email
                              </div>
                            </div>
                          </label>
                        )}
                      </div>

                      {/* Service 3 : Applications */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition ${
                          addCardPerms.autoApps.length > 0
                            ? 'border-rose-400/45 bg-rose-500/12'
                            : 'border-white/10 hover:border-white/25 bg-white/[0.02]'
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
                          className="w-4 h-4 rounded accent-[#F43F5E] cursor-pointer shrink-0"
                        />
                        <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0">
                          <AppWindow className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">
                              Applications (Moyennes &amp; futures apps)
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                addCardPerms.autoApps.length > 0
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/[0.06] text-slate-400'
                              }`}
                            >
                              {addCardPerms.autoApps.length > 0 ? 'Automatique' : 'Manuel'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            Règle automatiquement les abonnements mensuels ou périodiques de vos applications.
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Barre de synthèse discrète en bas de la colonne droite */}
                    <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                      <span>
                        {selectedServicesCount > 0
                          ? 'Les forfaits à vie (Infini) ne sont jamais prélevés.'
                          : 'Carte enregistrée en réserve — aucun prélèvement auto activé.'}
                      </span>
                      <span className="font-bold text-slate-200 shrink-0">
                        Modifiable à tout moment
                      </span>
                    </div>
                  </div>
                </div>

                {/* BARRE DE PIED ARCHITECTURALE */}
                <div className="px-5 py-3.5 bg-[#08101E] border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Chiffrement bancaire TLS · Traitement certifié PCI-DSS par Paystack</span>
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={linkingCard}
                      onClick={() => setShowAddCardModal(false)}
                      className="h-9 px-4 rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 cursor-pointer transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={linkingCard}
                      onClick={() => handleLinkCard(addCardTargetSubId, addCardPerms)}
                      className="h-9 px-5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] hover:from-[#3B82F6] hover:to-[#38BDF8] text-white text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-md shadow-sky-500/25"
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
