import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Check,
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
  ArrowDownCircle,
} from 'lucide-react';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import {
  useViewerExpandLevel,
  setViewerExpandLevel,
  resetViewerExpand,
} from '../utils/viewerExpandManager';
import {
  ActiveSubscriptionRecord,
  abandonCancellationRefund,
  abandonStorageDowngrade,
  applyFreeStorageDowngrade,
  CancellationRefundRecord,
  cancelMySubscriptionAutoRenew,
  CardServicePermissions,
  confirmCancellationRefund,
  deleteMyPaymentMethod,
  formatCurrencyAmount,
  getMyActiveSubscriptions,
  getMyCancellationRefunds,
  getMyStorageDowngrades,
  initializePaystackPayment,
  initLinkBankCard,
  loadPaystackInlinePop,
  MaskedPaymentMethodRecord,
  StorageDowngradeRequestRecord,
  updatePaymentMethodPermissions,
  updateSubscriptionRenewalMode,
  verifyLinkBankCard,
  verifyPaystackPayment,
} from '../services/paystackBillingApi';

interface MySubscriptionsViewProps {
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
  initialSection?: SubWorkspaceSection;
  onBack: () => void;
  onOpenRenewTarget?: (productType: 'storage' | 'ai' | 'app', appKey?: string) => void;
}

export type SubWorkspaceSection =
  | 'all'
  | 'storage'
  | 'ai'
  | 'app'
  | 'downgrades'
  | 'cancellations'
  | 'cards'
  | 'history';

function fmtStorageMbFr(mb?: number | null): string {
  const n = Math.max(0, Number(mb || 0));
  if (n <= 0) return 'Plan Gratuit';
  if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 2).replace('.', ',')} Go`;
  return `${Math.round(n)} Mo`;
}

function fmtBytesFrShort(bytes?: number | null): string {
  const b = Math.max(0, Number(bytes || 0));
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} Go`;
}

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
    'radial-gradient(ellipse 68% 58% at 16% 18%, rgba(56, 189, 248, 0.38) 0%, rgba(37, 99, 235, 0.24) 40%, transparent 78%)',
    'radial-gradient(ellipse 62% 56% at 86% 82%, rgba(99, 102, 241, 0.34) 0%, rgba(59, 130, 246, 0.18) 44%, transparent 76%)',
    'radial-gradient(ellipse 56% 48% at 84% 12%, rgba(45, 212, 191, 0.26) 0%, transparent 72%)',
    'linear-gradient(145deg, #1E3A6E 0%, #244C8A 38%, #1D447B 70%, #193766 100%)',
  ].join(', '),
};

const USER_VISIBLE_EVENT_TYPES = new Set<string>([
  'created',
  'renewed_manual',
  'auto_charge_succeeded',
  'auto_charge_failed',
  'switched_to_auto',
  'switched_to_manual',
  'card_attached',
  'card_linked',
  'card_permissions_updated',
  'card_removed',
  'ai_auto_recharged',
  'ai_auto_recharge_failed',
  'user_cancelled_auto',
  'trial_started',
  'entered_grace',
  'service_blocked',
  'reactivated',
  'storage_downgraded',
  'storage_downgrade_abandoned',
  'cancelled_with_refund',
  'upgrade_reverted_refunded',
  'cancellation_refund_abandoned',
  'admin_cancelled',
  'data_overflow_purged',
]);

function isUserVisibleActivityEvent(ev: { event_type?: string; actor?: string }): boolean {
  const actor = String(ev?.actor || '').trim().toLowerCase();
  const type = String(ev?.event_type || '').trim();
  if (actor === 'admin') return false;
  return USER_VISIBLE_EVENT_TYPES.has(type);
}

function getCardPalette(sub: ActiveSubscriptionRecord): {
  headerGradient: string;
  headerTextCls: string;
  headerSubCls: string;
  pillCls: string;
  gradient: string;
  border: string;
  glow: string;
  serviceLabel: string;
  categoryTitle: string;
} {
  const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
  if (sub.status === 'blocked') {
    return {
      headerGradient: 'linear-gradient(135deg, #FB7185 0%, #E11D48 52%, #BE123C 100%)',
      headerTextCls: 'text-white',
      headerSubCls: 'text-white/85',
      pillCls: 'bg-white/25 text-white',
      gradient: 'linear-gradient(135deg, #E11D48 0%, #9F1239 100%)',
      border: 'rgba(253, 164, 175, 0.45)',
      glow: '0 18px 40px -14px rgba(159, 18, 57, 0.45)',
      serviceLabel: 'SUSPENDU',
      categoryTitle: 'Suspendu',
    };
  }
  if (isInf) {
    const baseTitle =
      sub.product_type === 'storage'
        ? 'Stockage Cloud'
        : sub.product_type === 'ai'
        ? 'Crédits IA'
        : sub.app_name || sub.app_key || 'Application';
    return {
      headerGradient: 'linear-gradient(135deg, #FDE047 0%, #FBBF24 48%, #F59E0B 100%)',
      headerTextCls: 'text-[#2B1904]',
      headerSubCls: 'text-[#5C3A0E]',
      pillCls: 'bg-white/45 text-[#2B1904]',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
      border: 'rgba(253, 224, 71, 0.55)',
      glow: '0 18px 40px -14px rgba(217, 119, 6, 0.4)',
      serviceLabel: `${baseTitle.toUpperCase()} · À VIE`,
      categoryTitle: `${baseTitle} · À vie`,
    };
  }
  if (sub.product_type === 'storage') {
    return {
      headerGradient: 'linear-gradient(135deg, #FFD24C 0%, #FFA629 48%, #FF8A1F 100%)',
      headerTextCls: 'text-[#2B1805]',
      headerSubCls: 'text-[#61390D]',
      pillCls: 'bg-white/40 text-[#2B1805]',
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)',
      border: 'rgba(255, 210, 76, 0.5)',
      glow: '0 18px 42px -14px rgba(14, 38, 78, 0.48)',
      serviceLabel: 'STOCKAGE CLOUD',
      categoryTitle: 'Stockage Cloud',
    };
  }
  if (sub.product_type === 'ai') {
    return {
      headerGradient: 'linear-gradient(135deg, #C084FC 0%, #8B5CF6 50%, #6D28D9 100%)',
      headerTextCls: 'text-white',
      headerSubCls: 'text-white/85',
      pillCls: 'bg-white/25 text-white',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #5B21B6 100%)',
      border: 'rgba(196, 181, 253, 0.48)',
      glow: '0 18px 42px -14px rgba(91, 33, 182, 0.45)',
      serviceLabel: 'CRÉDITS IA',
      categoryTitle: 'Crédits IA',
    };
  }
  const appLabel = sub.app_name || sub.app_key || 'Application';
  return {
    headerGradient: 'linear-gradient(135deg, #FB7185 0%, #F43F5E 52%, #E11D48 100%)',
    headerTextCls: 'text-white',
    headerSubCls: 'text-white/85',
    pillCls: 'bg-white/25 text-white',
    gradient: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)',
    border: 'rgba(253, 164, 175, 0.48)',
    glow: '0 18px 42px -14px rgba(190, 18, 60, 0.45)',
    serviceLabel: appLabel.toUpperCase(),
    categoryTitle: appLabel,
  };
}

function formatEventLabel(eventType: string): string {
  const map: Record<string, string> = {
    created: 'Abonnement activé',
    renewed_manual: 'Renouvellement confirmé',
    auto_charge_succeeded: 'Prélèvement automatique réussi',
    auto_charge_failed: 'Échec du prélèvement automatique',
    switched_to_auto: 'Passé en renouvellement automatique',
    switched_to_manual: 'Passé en renouvellement manuel',
    card_attached: 'Carte bancaire enregistrée',
    card_linked: 'Carte Visa/Mastercard associée',
    card_permissions_updated: 'Préférences de votre carte mises à jour',
    card_removed: 'Carte bancaire supprimée',
    ai_auto_recharged: 'Crédits IA rechargés automatiquement',
    ai_auto_recharge_failed: 'Échec de la recharge auto Crédits IA',
    user_cancelled_auto: 'Arrêt du renouvellement programmé',
    trial_started: 'Essai gratuit activé',
    entered_grace: 'Période de grâce démarrée',
    service_blocked: 'Abonnement suspendu (échéance dépassée)',
    reactivated: 'Abonnement réactivé',
    storage_downgraded: 'Stockage réduit et tarif mensuel mis à jour',
    storage_downgrade_abandoned: 'Demande de réduction de stockage abandonnée',
    cancelled_with_refund: 'Abonnement annulé avec remboursement net',
    upgrade_reverted_refunded: 'Augmentation annulée — retour au forfait initial & remboursement',
    cancellation_refund_abandoned: 'Demande d’annulation abandonnée',
    admin_cancelled: 'Abonnement annulé',
    data_overflow_purged: 'Fichiers payants au-delà du gratuit nettoyés',
  };
  return map[eventType] || eventType;
}

export const MySubscriptionsView: React.FC<MySubscriptionsViewProps> = ({
  user,
  initialSection,
  onBack,
  onOpenRenewTarget,
}) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [section, setSection] = useState<SubWorkspaceSection>(() => {
    if (initialSection) return initialSection;
    try {
      const sp = new URLSearchParams(window.location.search);
      const sec = sp.get('section');
      if (sec === 'downgrades') return 'downgrades';
      if (sec === 'cancellations') return 'cancellations';
    } catch {}
    return 'all';
  });
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ActiveSubscriptionRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MaskedPaymentMethodRecord[]>([]);
  const [storageDowngrades, setStorageDowngrades] = useState<StorageDowngradeRequestRecord[]>([]);
  const [cancellationRefunds, setCancellationRefunds] = useState<CancellationRefundRecord[]>([]);
  const [payingDowngradeId, setPayingDowngradeId] = useState<string | null>(null);
  const [busyCancelRefundId, setBusyCancelRefundId] = useState<string | null>(null);
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

  useEffect(() => {
    if (initialSection) {
      setSelectedSubId(null);
      setSection(initialSection);
    }
  }, [initialSection]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [res, dgRes, crRes] = await Promise.all([
      getMyActiveSubscriptions(),
      getMyStorageDowngrades(),
      getMyCancellationRefunds(),
    ]);
    if (res.success) {
      setSubscriptions(res.subscriptions);
      setPaymentMethods(res.paymentMethods);
      setRecentEvents(res.recentEvents);
    } else if (res.error) {
      setFeedback({ type: 'err', text: res.error });
    }
    if (dgRes.success) {
      setStorageDowngrades(dgRes.requests);
    }
    if (crRes.success) {
      setCancellationRefunds(crRes.requests);
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

  const handlePayStorageDowngrade = async (req: StorageDowngradeRequestRecord) => {
    if (payingDowngradeId) return;
    setPayingDowngradeId(req.id);
    setFeedback(null);
    try {
      const dueAmount = Math.max(0, Math.round(Number(req.consumed_prorata_amount || 0)));
      if (dueAmount <= 0) {
        const freeRes = await applyFreeStorageDowngrade(req.id);
        if (!freeRes.success) {
          setFeedback({ type: 'err', text: freeRes.error || "Impossible d'appliquer la réduction." });
        } else {
          setFeedback({
            type: 'ok',
            text:
              freeRes.deliverySummary ||
              `Votre stockage est passé à ${fmtStorageMbFr(req.target_paid_mb)} (${formatCurrencyAmount(req.target_monthly_price, req.currency)}/mois) !`,
          });
          notifyBannerSync();
          await loadAll();
        }
        setPayingDowngradeId(null);
        return;
      }

      const initRes = await initializePaystackPayment({
        productType: 'storage',
        productId: 'storage_master_downgrade',
        downgradeRequestId: req.id,
        currency: req.currency || 'XOF',
      });
      if (!initRes.success || !initRes.reference) {
        setFeedback({
          type: 'err',
          text: initRes.error || "Impossible d'initialiser le paiement de votre consommation prorata.",
        });
        setPayingDowngradeId(null);
        return;
      }

      if (initRes.accessCode) {
        try {
          const PaystackPop = await loadPaystackInlinePop();
          const popup = new PaystackPop();
          popup.resumeTransaction(initRes.accessCode, {
            onSuccess: async (tx: any) => {
              const refToVerify = tx?.reference || initRes.reference!;
              const verRes = await verifyPaystackPayment(refToVerify);
              if (verRes.success && verRes.verified) {
                setFeedback({
                  type: 'ok',
                  text:
                    verRes.deliverySummary ||
                    `Paiement confirmé ! Votre stockage est maintenant passé à ${fmtStorageMbFr(req.target_paid_mb)} (${formatCurrencyAmount(req.target_monthly_price, req.currency)}/mois).`,
                });
                notifyBannerSync();
                try {
                  window.dispatchEvent(new CustomEvent('studycloud_payment_verified'));
                } catch {}
                await loadAll();
              } else {
                setFeedback({
                  type: 'err',
                  text: verRes.error || 'Vérification du paiement en cours. Actualisez dans quelques secondes.',
                });
              }
              setPayingDowngradeId(null);
            },
            onCancel: () => {
              setPayingDowngradeId(null);
            },
          });
          return;
        } catch {
          // Fallback vers redirection sécurisée Paystack si InlineJS indisponible
        }
      }

      if (initRes.authorizationUrl) {
        window.location.href = initRes.authorizationUrl;
        return;
      }
      setFeedback({ type: 'err', text: 'Passerelle Paystack indisponible.' });
      setPayingDowngradeId(null);
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Erreur lors du paiement prorata.' });
      setPayingDowngradeId(null);
    }
  };

  const handleAbandonStorageDowngrade = async (req: StorageDowngradeRequestRecord) => {
    if (payingDowngradeId) return;
    if (
      !window.confirm(
        'Abandonner cette demande de réduction de stockage ? Le processus s’arrêtera immédiatement et votre abonnement actuel restera inchangé.'
      )
    ) {
      return;
    }
    setPayingDowngradeId(req.id);
    setFeedback(null);
    const res = await abandonStorageDowngrade(req.id);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || "Impossible d'abandonner la réduction." });
    } else {
      setFeedback({
        type: 'ok',
        text: 'Réduction de stockage abandonnée. Votre abonnement actuel continue sans changement.',
      });
      notifyBannerSync();
      await loadAll();
    }
    setPayingDowngradeId(null);
  };

  const handleConfirmCancellationRefund = async (req: CancellationRefundRecord) => {
    if (busyCancelRefundId) return;
    const isRev = req.cancel_scope === 'revert_upgrade';
    const netStr = formatCurrencyAmount(req.net_refund_amount, req.currency);
    const msg = isRev
      ? `Confirmer le retour à votre forfait initial (${req.restore_plan_name || fmtStorageMbFr(req.restore_paid_mb)}) et lancer le remboursement net de ${netStr} ?`
      : `Confirmer l’annulation définitive de « ${req.plan_name} » et lancer le remboursement net de ${netStr} ?`;
    if (!window.confirm(msg)) return;
    setBusyCancelRefundId(req.id);
    setFeedback(null);
    const res = await confirmCancellationRefund(req.id);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || "Échec de la confirmation d'annulation." });
    } else {
      setFeedback({
        type: 'ok',
        text: res.message || `Confirmation enregistrée ! Remboursement net de ${netStr} lancé.`,
      });
      notifyBannerSync();
      await loadAll();
    }
    setBusyCancelRefundId(null);
  };

  const handleAbandonCancellationRefund = async (req: CancellationRefundRecord) => {
    if (busyCancelRefundId) return;
    if (
      !window.confirm(
        'Abandonner le processus d’annulation et de remboursement ? Votre abonnement actuel continuera normalement sans aucun changement.'
      )
    ) {
      return;
    }
    setBusyCancelRefundId(req.id);
    setFeedback(null);
    const res = await abandonCancellationRefund(req.id);
    if (!res.success) {
      setFeedback({ type: 'err', text: res.error || "Impossible d'abandonner le processus." });
    } else {
      setFeedback({
        type: 'ok',
        text: 'Processus abandonné. Votre abonnement actuel est conservé sans aucune interruption.',
      });
      notifyBannerSync();
      await loadAll();
    }
    setBusyCancelRefundId(null);
  };

  const userVisibleEvents = useMemo(
    () => recentEvents.filter((ev) => isUserVisibleActivityEvent(ev)),
    [recentEvents]
  );

  const pendingDowngrades = useMemo(
    () => storageDowngrades.filter((d) => d.status === 'pending_payment'),
    [storageDowngrades]
  );

  const pendingCancellationRefunds = useMemo(
    () => cancellationRefunds.filter((c) => c.status === 'pending_confirmation'),
    [cancellationRefunds]
  );

  const activeDataPurgeWarnings = useMemo(
    () =>
      subscriptions.filter(
        (s) =>
          s.product_type === 'storage' &&
          s.status === 'cancelled' &&
          s.data_purge_deadline_at &&
          !s.data_purged_at &&
          Number(s.excess_bytes_at_cancel || 0) > 0
      ),
    [subscriptions]
  );

  const counts = useMemo(
    () => ({
      all: subscriptions.length,
      storage: subscriptions.filter((s) => s.product_type === 'storage').length,
      ai: subscriptions.filter((s) => s.product_type === 'ai').length,
      app: subscriptions.filter((s) => s.product_type === 'app').length,
      downgrades: pendingDowngrades.length,
      cancellations: pendingCancellationRefunds.length,
      cards: paymentMethods.length,
      history: userVisibleEvents.length,
    }),
    [subscriptions, pendingDowngrades, pendingCancellationRefunds, paymentMethods, userVisibleEvents]
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
    downgrades: {
      title: 'Réduction de stockage',
      subtitle:
        counts.downgrades > 0
          ? `${counts.downgrades} demande${counts.downgrades > 1 ? 's' : ''} prête${counts.downgrades > 1 ? 's' : ''} — réglez votre consommation prorata pour changer automatiquement, ou abandonnez le processus.`
          : 'Vos réductions de stockage et changements de forfait mensuel apparaissent ici dès validation par StudyCloud.',
    },
    cancellations: {
      title: 'Annulation & Remboursement',
      subtitle:
        counts.cancellations > 0
          ? `${counts.cancellations} proposition${counts.cancellations > 1 ? 's' : ''} en attente de votre confirmation — vérifiez le détail du remboursement net puis confirmez ou abandonnez.`
          : 'Vos demandes d’annulation d’abonnement (totale ou retour au forfait initial) et le suivi de vos remboursements apparaissent ici.',
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
    <div className="flex flex-col h-full min-h-0 bg-[#152E59]/72 backdrop-blur-xl text-white select-none">
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

        {/* Sous-section Réduction & Suivi */}
        <div className="pt-3 px-1.5 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400/90">
            Modifications &amp; Cartes
          </span>
        </div>

        <div
          onClick={() => {
            setSelectedSubId(null);
            setSection('downgrades');
            setIsMobileSidebarOpen(false);
          }}
          className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-lg border text-xs transition cursor-pointer ${
            section === 'downgrades' && !selectedSub
              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-300/50 text-white font-semibold shadow-md shadow-emerald-500/25'
              : counts.downgrades > 0
              ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100 hover:bg-emerald-500/25 font-semibold'
              : 'bg-white/[0.03] border-white/10 hover:border-emerald-400/35 text-slate-300 hover:text-white hover:bg-white/[0.07] font-medium'
          }`}
        >
          {!(section === 'downgrades' && !selectedSub) && (
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-400" />
          )}
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${!(section === 'downgrades' && !selectedSub) ? 'pl-1' : ''}`}>
            <ArrowDownCircle
              className={`w-3.5 h-3.5 shrink-0 ${
                section === 'downgrades' && !selectedSub
                  ? 'text-white'
                  : counts.downgrades > 0
                  ? 'text-emerald-300'
                  : 'text-slate-400 group-hover:text-emerald-300'
              }`}
            />
            <span className="truncate">Réduction de stockage</span>
          </div>
          {counts.downgrades > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black leading-none shrink-0 animate-pulse">
              {counts.downgrades}
            </span>
          )}
        </div>

        <div
          onClick={() => {
            setSelectedSubId(null);
            setSection('cancellations');
            setIsMobileSidebarOpen(false);
          }}
          className={`group relative overflow-hidden flex items-center gap-2 px-2.5 h-8 rounded-lg border text-xs transition cursor-pointer ${
            section === 'cancellations' && !selectedSub
              ? 'bg-gradient-to-r from-sky-600 to-indigo-500 border-sky-300/50 text-white font-semibold shadow-md shadow-sky-500/25'
              : counts.cancellations > 0
              ? 'bg-sky-500/18 border-sky-400/50 text-sky-100 hover:bg-sky-500/28 font-semibold'
              : 'bg-white/[0.03] border-white/10 hover:border-sky-400/35 text-slate-300 hover:text-white hover:bg-white/[0.07] font-medium'
          }`}
        >
          {!(section === 'cancellations' && !selectedSub) && (
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-sky-400" />
          )}
          <div className={`flex items-center gap-2 min-w-0 flex-1 ${!(section === 'cancellations' && !selectedSub) ? 'pl-1' : ''}`}>
            <Ban
              className={`w-3.5 h-3.5 shrink-0 ${
                section === 'cancellations' && !selectedSub
                  ? 'text-white'
                  : counts.cancellations > 0
                  ? 'text-sky-300'
                  : 'text-slate-400 group-hover:text-sky-300'
              }`}
            />
            <span className="truncate">Annulation &amp; Remb.</span>
          </div>
          {counts.cancellations > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[10px] font-black leading-none shrink-0 animate-pulse">
              {counts.cancellations}
            </span>
          )}
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
      <div className="px-2.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 shrink-0">
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

      {/* TIROIR LATÉRAL MOBILE (< md) — portail au-dessus de la barre basse + glissement fluide */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`md:hidden fixed inset-0 z-[100010] flex transition-opacity duration-300 ease-out ${
              isMobileSidebarOpen
                ? 'opacity-100 pointer-events-auto bg-black/65 backdrop-blur-[2px]'
                : 'opacity-0 pointer-events-none bg-black/0'
            }`}
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden={!isMobileSidebarOpen}
          >
            <div
              className={`w-[268px] max-w-[82vw] h-full shadow-2xl border-r border-white/15 bg-[#122952] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
                isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (t) e.currentTarget.dataset.touchStartX = String(t.clientX);
              }}
              onTouchEnd={(e) => {
                const startX = Number(e.currentTarget.dataset.touchStartX || NaN);
                delete e.currentTarget.dataset.touchStartX;
                const t = e.changedTouches[0];
                if (t && Number.isFinite(startX) && t.clientX - startX < -48) {
                  setIsMobileSidebarOpen(false);
                }
              }}
            >
              {renderSidebarContent()}
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* ZONE PRINCIPALE À DROITE — PLEIN ÉCRAN SAPHIR & AURORA MODERNE        */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
        {/* BARRE SUPÉRIEURE UNIFIÉE : MENU MOBILE + BOUTON RETOUR + FIL D'ARIANE + USER + EXPAND */}
        <header className="h-11 sm:h-12 bg-[#152E59]/58 backdrop-blur-xl border-b border-white/15 px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer active:scale-95 transition shrink-0"
              aria-label="Ouvrir le menu latéral"
            >
              <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedSub) {
                  setSelectedSubId(null);
                } else {
                  onBack();
                }
              }}
              className="md:hidden h-7 px-2 rounded-lg border border-white/15 bg-white/[0.08] hover:bg-white/[0.16] flex items-center gap-1 text-[11px] font-semibold text-white cursor-pointer active:scale-95 transition shrink-0"
              title={selectedSub ? 'Retour à mes abonnements' : 'Retour au tableau de bord'}
              aria-label={selectedSub ? 'Retour à mes abonnements' : 'Retour au tableau de bord'}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span>Retour</span>
            </button>

            <nav className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs min-w-0 overflow-hidden" aria-label="Fil d'Ariane">
              <button
                type="button"
                onClick={onBack}
                className="hidden sm:inline text-slate-400 hover:text-white font-medium truncate cursor-pointer transition"
              >
                StudyCloud
              </button>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-500 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setSelectedSubId(null);
                  setSection('all');
                }}
                className={`truncate cursor-pointer transition ${
                  section === 'all' && !selectedSub
                    ? 'text-white font-bold'
                    : 'text-slate-300 hover:text-white font-medium'
                }`}
              >
                Mes abonnements
              </button>
              {section !== 'all' && (
                <>
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setSelectedSubId(null)}
                    className={`truncate cursor-pointer transition ${
                      !selectedSub
                        ? 'text-white font-bold'
                        : 'text-slate-300 hover:text-white font-medium'
                    }`}
                  >
                    {sectionMeta[section].title}
                  </button>
                </>
              )}
              {selectedSub && (
                <>
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                  <span className="text-sky-300 font-bold truncate max-w-[100px] sm:max-w-[160px]">
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
        <div className="shrink-0 bg-white/[0.06] backdrop-blur-md border-b border-white/14 px-3 sm:px-8 py-2.5 sm:py-4">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {selectedSub && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubId(null)}
                    className="hidden md:flex w-7 h-7 rounded-lg border border-white/15 bg-white/[0.07] hover:bg-white/[0.14] text-white items-center justify-center cursor-pointer shrink-0 transition"
                    title="Retour à la liste"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <h1 className="text-sm sm:text-xl font-extrabold text-white tracking-tight truncate">
                  {activeTitle}
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-200/80 mt-0.5 truncate">
                {activeSubtitle}
              </p>
            </div>

            {!selectedSub && section !== 'cards' && section !== 'history' && section !== 'downgrades' && section !== 'cancellations' && (
              <div className="flex items-center gap-2 flex-nowrap">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un abonnement..."
                    className="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-7 sm:pr-8 rounded-xl bg-white/[0.08] focus:bg-[#0B1528]/90 border border-white/15 focus:border-sky-400/70 text-[11px] sm:text-xs text-white placeholder:text-slate-300/75 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
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
        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 sm:px-8 py-3.5 sm:py-6 pb-28 md:pb-8 space-y-3.5 sm:space-y-5">
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

          {pendingCancellationRefunds.length > 0 && !selectedSub && section !== 'cancellations' && (
            <div className="p-3.5 rounded-xl bg-sky-500/18 backdrop-blur-md border border-sky-400/50 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5 text-xs">
                <Ban className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sky-100">
                    {pendingCancellationRefunds[0].cancel_scope === 'revert_upgrade'
                      ? `↩️ Retour au forfait initial & remboursement net (${formatCurrencyAmount(pendingCancellationRefunds[0].net_refund_amount, pendingCancellationRefunds[0].currency)}) prêt`
                      : `💸 Annulation & remboursement net (${formatCurrencyAmount(pendingCancellationRefunds[0].net_refund_amount, pendingCancellationRefunds[0].currency)}) prêt`}
                  </div>
                  <div className="text-sky-200/85 mt-0.5">
                    Consultez le détail transparent dans la section « Annulation &amp; Remboursement » pour confirmer ou abandonner le processus.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSection('cancellations')}
                className="px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-black cursor-pointer shrink-0 transition shadow-sm"
              >
                Consulter &amp; Décider →
              </button>
            </div>
          )}

          {pendingDowngrades.length > 0 && !selectedSub && section !== 'downgrades' && (
            <div className="p-3.5 rounded-xl bg-emerald-500/18 backdrop-blur-md border border-emerald-400/45 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5 text-xs">
                <ArrowDownCircle className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-100">
                    📉 Votre réduction de stockage est prête ({fmtStorageMbFr(pendingDowngrades[0].current_paid_mb)} → {fmtStorageMbFr(pendingDowngrades[0].target_paid_mb)})
                  </div>
                  <div className="text-emerald-200/85 mt-0.5">
                    Réglez votre consommation prorata ({formatCurrencyAmount(pendingDowngrades[0].consumed_prorata_amount, pendingDowngrades[0].currency)}) pour activer automatiquement votre nouveau tarif mensuel réduit ({formatCurrencyAmount(pendingDowngrades[0].target_monthly_price, pendingDowngrades[0].currency)}/mois).
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSection('downgrades')}
                className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black cursor-pointer shrink-0 transition shadow-sm"
              >
                Ouvrir Réduction →
              </button>
            </div>
          )}

          {activeDataPurgeWarnings.length > 0 && (
            <div className="p-4 rounded-2xl bg-orange-500/18 backdrop-blur-md border border-orange-400/50 space-y-2 text-xs">
              {activeDataPurgeWarnings.map((w) => {
                const dlMs = w.data_purge_deadline_at ? Date.parse(w.data_purge_deadline_at) : NaN;
                const daysLeft = Number.isFinite(dlMs)
                  ? Math.max(0, Math.ceil((dlMs - Date.now()) / (24 * 60 * 60 * 1000)))
                  : Number(w.data_retention_days || 14);
                return (
                  <div key={w.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-orange-300 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-black text-orange-100">
                          ⏳ Abonnement annulé — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''} pour récupérer vos {fmtBytesFrShort(w.excess_bytes_at_cancel)} au-delà du quota gratuit
                        </div>
                        <p className="text-orange-100/85 leading-relaxed">
                          Date limite : <strong>{formatDateTimeFr(w.data_purge_deadline_at)}</strong>. Vos <strong>premiers fichiers situés dans votre espace gratuit sont protégés</strong> et ne seront pas supprimés ; seuls les fichiers enregistrés <strong>après l&apos;espace gratuit (sur l&apos;espace payant)</strong> seront supprimés définitivement si vous ne revenez pas dans la zone gratuite à temps.
                        </p>
                      </div>
                    </div>
                    {onOpenRenewTarget && (
                      <button
                        type="button"
                        onClick={() => onOpenRenewTarget('storage')}
                        className="px-3.5 py-2 rounded-xl bg-white text-slate-950 hover:bg-orange-50 text-xs font-black cursor-pointer shrink-0"
                      >
                        Reprendre du stockage
                      </button>
                    )}
                  </div>
                );
              })}
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
                    <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-5 space-y-3 shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
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
                    <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-5 space-y-3 flex flex-col justify-between shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
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
          ) : section === 'downgrades' ? (
            /* =============================================================== */
            /* SECTION RÉDUCTION DE STOCKAGE (PRORATA CONSOMMÉ -> BASCULE AUTO) */
            /* =============================================================== */
            storageDowngrades.length === 0 ? (
              <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-6 sm:p-10 text-center space-y-2.5 shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center text-emerald-300 mx-auto">
                  <ArrowDownCircle className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-white">
                  Aucune réduction de stockage en attente
                </div>
                <p className="text-xs text-slate-300/85 max-w-md mx-auto leading-relaxed">
                  Si vous demandez à l&apos;équipe StudyCloud de réduire votre espace de stockage et votre tarif mensuel, la proposition et le montant prorata de votre consommation déjà écoulée apparaîtront ici automatiquement.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {storageDowngrades.map((dg) => {
                  const isPending = dg.status === 'pending_payment';
                  const isCompleted = dg.status === 'completed';
                  const isBusyDg = payingDowngradeId === dg.id;
                  const monthlySavings = Math.max(
                    0,
                    Math.round(Number(dg.current_monthly_price || 0) - Number(dg.target_monthly_price || 0))
                  );
                  const dueAmount = Math.max(0, Math.round(Number(dg.consumed_prorata_amount || 0)));

                  return (
                    <div
                      key={dg.id}
                      className={`rounded-2xl backdrop-blur-xl border overflow-hidden shadow-[0_18px_42px_-16px_rgba(8,22,52,0.55)] ${
                        isPending
                          ? 'bg-[#123344]/85 border-emerald-400/50'
                          : 'bg-[#163466]/70 border-white/15'
                      }`}
                    >
                      <div
                        className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isPending
                            ? 'bg-gradient-to-r from-emerald-600/30 via-teal-600/25 to-sky-600/20 border-emerald-400/30'
                            : 'bg-white/[0.04] border-white/10'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isPending
                                  ? 'bg-emerald-400 text-slate-950'
                                  : isCompleted
                                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                                  : dg.status === 'abandoned_by_user'
                                  ? 'bg-slate-600/40 text-slate-200 border border-white/15'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {isPending
                                ? '⚡ Action requise — Prêt à activer'
                                : isCompleted
                                ? '✅ Payé & Stockage modifié'
                                : dg.status === 'abandoned_by_user'
                                ? '⚪ Processus abandonné'
                                : dg.status}
                            </span>
                            {monthlySavings > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/35 text-[10px] font-black">
                                −{formatCurrencyAmount(monthlySavings, dg.currency)} / mois économisés
                              </span>
                            )}
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-white">
                            Réduction de stockage : {fmtStorageMbFr(dg.current_paid_mb)} → {fmtStorageMbFr(dg.target_paid_mb)}
                          </h3>
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">
                          {formatDateTimeFr(dg.created_at)}
                        </div>
                      </div>

                      <div className="p-5 space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-xl bg-black/25 border border-white/10 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Stockage payant</div>
                            <div className="flex items-center gap-2 font-mono font-black text-sm">
                              <span className="text-slate-400 line-through">{fmtStorageMbFr(dg.current_paid_mb)}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-emerald-300">{fmtStorageMbFr(dg.target_paid_mb)}</span>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-black/25 border border-white/10 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Nouveau tarif mensuel</div>
                            <div className="flex items-center gap-2 font-mono font-black text-sm flex-wrap">
                              <span className="text-slate-400 line-through">
                                {formatCurrencyAmount(dg.current_monthly_price, dg.currency)}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-emerald-300">
                                {formatCurrencyAmount(dg.target_monthly_price, dg.currency)}/mois
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-amber-200">
                              Consommation prorata ({dg.days_used}j / {dg.duration_days}j)
                            </div>
                            <div className="font-mono font-black text-base text-white">
                              {formatCurrencyAmount(dueAmount, dg.currency)}
                            </div>
                            <div className="text-[10px] text-amber-200/85">
                              {isCompleted ? 'Déjà réglé' : 'À payer d’abord avant changement'}
                            </div>
                          </div>
                        </div>

                        {dg.admin_notes && (
                          <div className="p-3 rounded-xl bg-sky-500/12 border border-sky-400/30 text-sky-100">
                            <span className="font-bold">Message StudyCloud :</span> {dg.admin_notes}
                          </div>
                        )}

                        {isPending ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                            <p className="text-[11px] text-slate-200/85 leading-relaxed max-w-xl">
                              Réglez uniquement ce que vous avez déjà consommé sur la période en cours ({dg.days_used} jour{dg.days_used > 1 ? 's' : ''}). Dès validation du paiement, votre abonnement et votre stockage basculent <strong>automatiquement</strong> sur <strong>{fmtStorageMbFr(dg.target_paid_mb)}</strong> ({formatCurrencyAmount(dg.target_monthly_price, dg.currency)}/mois). Vous pouvez aussi abandonner le processus à tout moment.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              <button
                                type="button"
                                disabled={isBusyDg}
                                onClick={() => handleAbandonStorageDowngrade(dg)}
                                className="h-10 px-4 rounded-xl border border-white/20 bg-white/[0.07] hover:bg-rose-500/20 hover:border-rose-400/50 text-slate-100 hover:text-rose-100 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Abandonner</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusyDg}
                                onClick={() => handlePayStorageDowngrade(dg)}
                                className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-lg shadow-emerald-500/25"
                              >
                                {isBusyDg ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Traitement...</span>
                                  </>
                                ) : dueAmount > 0 ? (
                                  <>
                                    <CreditCard className="w-4 h-4" />
                                    <span>Payer {formatCurrencyAmount(dueAmount, dg.currency)} &amp; changer</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Activer mon nouveau stockage</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-emerald-200">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              Changement appliqué le {formatDateTimeFr(dg.applied_at || dg.paid_at)}
                            </span>
                            {dg.payment_reference && (
                              <span className="font-mono text-[10px] text-slate-300">Réf : {dg.payment_reference}</span>
                            )}
                          </div>
                        ) : dg.status === 'abandoned_by_user' ? (
                          <div className="pt-2 border-t border-white/10 text-[11px] text-slate-300">
                            Vous avez abandonné cette réduction — votre abonnement précédent est resté actif sans modification.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : section === 'cancellations' ? (
            /* =============================================================== */
            /* SECTION ANNULATION & REMBOURSEMENT NET AUTOMATIQUE              */
            /* (Annulation totale OU retour au forfait initial + Abandonner)   */
            /* =============================================================== */
            cancellationRefunds.length === 0 ? (
              <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-6 sm:p-10 text-center space-y-2.5 shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-300 mx-auto">
                  <Ban className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-white">
                  Aucune procédure d&apos;annulation ou de remboursement en cours
                </div>
                <p className="text-xs text-slate-300/85 max-w-md mx-auto leading-relaxed">
                  Lorsque vous demandez l&apos;annulation d&apos;un abonnement (Stockage, Crédits IA ou Application) ou le retour à votre forfait précédent suite à une augmentation, le détail complet du remboursement net et les boutons de confirmation apparaissent ici.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cancellationRefunds.map((cr) => {
                  const isPending = cr.status === 'pending_confirmation';
                  const isRefunded = cr.status === 'refunded';
                  const isProcessing = cr.status === 'refund_processing';
                  const isManualPending = cr.status === 'manual_refund_required';
                  const isAbandoned = cr.status === 'abandoned_by_user';
                  const isRevert = cr.cancel_scope === 'revert_upgrade';
                  const isBusyCr = busyCancelRefundId === cr.id;
                  const serviceTitle =
                    cr.product_type === 'storage'
                      ? 'Stockage Cloud'
                      : cr.product_type === 'ai'
                      ? 'Crédits IA StudyCloud'
                      : cr.app_name || cr.app_key || 'Application StudyCloud';

                  return (
                    <div
                      key={cr.id}
                      className={`rounded-2xl backdrop-blur-xl border overflow-hidden shadow-[0_18px_42px_-16px_rgba(8,22,52,0.55)] ${
                        isPending
                          ? 'bg-[#122d54]/88 border-sky-400/55'
                          : 'bg-[#163466]/70 border-white/15'
                      }`}
                    >
                      <div
                        className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isPending
                            ? 'bg-gradient-to-r from-sky-600/30 via-indigo-600/25 to-blue-600/20 border-sky-400/30'
                            : 'bg-white/[0.04] border-white/10'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isPending
                                  ? 'bg-sky-400 text-slate-950'
                                  : isRefunded
                                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                                  : isProcessing || isManualPending
                                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                                  : 'bg-slate-600/40 text-slate-200 border border-white/15'
                              }`}
                            >
                              {isPending
                                ? '⚡ En attente de votre décision'
                                : isRefunded
                                ? '✅ Confirmé & Remboursé'
                                : isProcessing
                                ? '🔄 Remboursement en cours de versement'
                                : isManualPending
                                ? '⏳ Remboursement pris en charge par notre service financier'
                                : isAbandoned
                                ? '⚪ Processus abandonné'
                                : cr.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-100 text-[10px] font-bold">
                              {isRevert ? '↩️ Retour au forfait initial' : '❌ Annulation complète'}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {serviceTitle} — {cr.plan_name}
                          </h3>
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">
                          {formatDateTimeFr(cr.created_at)}
                        </div>
                      </div>

                      <div className="p-5 space-y-4 text-xs">
                        {isRevert && (
                          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 leading-relaxed">
                            <div className="font-black text-emerald-200 mb-0.5">
                              ↩️ Vous conservez votre abonnement initial sans coupure
                            </div>
                            Seule l&apos;augmentation récente est annulée et remboursée. Votre abonnement revient sur{' '}
                            <strong>
                              {cr.restore_plan_name ||
                                `${fmtStorageMbFr(cr.restore_paid_mb)} (${formatCurrencyAmount(cr.restore_monthly_price || 0, cr.currency)}/mois)`}
                            </strong>
                            .
                          </div>
                        )}

                        {/* Tableau bancaire transparent du calcul */}
                        <div className="rounded-xl bg-black/25 border border-white/12 divide-y divide-white/10 overflow-hidden">
                          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                            <span className="text-slate-300">Montant initial réglé</span>
                            <span className="font-mono font-bold text-white">
                              {formatCurrencyAmount(cr.paid_amount, cr.currency)}
                            </span>
                          </div>
                          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                            <span className="text-slate-300">
                              {cr.product_type === 'ai'
                                ? `Crédits IA déjà consommés (${Math.round(cr.credits_consumed || 0)} / ${Math.round(cr.credits_total || 0)})`
                                : `Période déjà utilisée (${cr.days_used} jour${cr.days_used > 1 ? 's' : ''} / ${cr.duration_days}j)`}
                            </span>
                            <span className="font-mono font-bold text-amber-300">
                              − {formatCurrencyAmount(cr.consumed_deduction_amount, cr.currency)}
                            </span>
                          </div>
                          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                            <span className="text-slate-300">
                              Frais bancaires et de traitement de paiement <span className="text-slate-400">(non récupérables)</span>
                            </span>
                            <span className="font-mono font-bold text-rose-300">
                              − {formatCurrencyAmount(cr.gateway_fee_amount, cr.currency)}
                            </span>
                          </div>
                          <div className="px-4 py-3 bg-emerald-500/15 flex items-center justify-between gap-2">
                            <span className="font-black text-emerald-100 uppercase tracking-wide text-[11px]">
                              Montant net qui vous sera remboursé
                            </span>
                            <span className="font-mono font-black text-lg text-emerald-300">
                              {formatCurrencyAmount(cr.net_refund_amount, cr.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Explication professionnelle (sans mentionner d'agrégateur) */}
                        <div className="p-3.5 rounded-xl bg-white/[0.05] border border-white/12 text-[11.5px] text-slate-200/90 leading-relaxed space-y-1">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-sky-300 shrink-0" />
                            <span>Pourquoi le montant remboursé diffère-t-il du montant initial ?</span>
                          </div>
                          <p>
                            Le remboursement correspond exactement à la part non utilisée de votre paiement, déduction faite des <strong>frais bancaires et de traitement de transaction</strong> appliqués par les établissements bancaires et opérateurs Mobile Money lors de l&apos;encaissement initial. Ces frais de réseau sont définitivement acquis à ces opérateurs financiers et ne peuvent pas être restitués.
                          </p>
                        </div>

                        {!isRevert && cr.product_type === 'storage' && Number(cr.excess_bytes_preview || 0) > 0 && (
                          <div className="p-3.5 rounded-xl bg-orange-500/18 border border-orange-400/45 text-orange-100 text-[11.5px] leading-relaxed">
                            <strong>⏳ Données dépassant l&apos;espace gratuit ({fmtBytesFrShort(cr.excess_bytes_preview)}) :</strong>{' '}
                            en confirmant l&apos;annulation, vous disposerez de{' '}
                            <strong>{cr.retention_days || 14} jours</strong> pour récupérer ces fichiers. Vos premiers fichiers situés dans votre espace gratuit restent toujours protégés.
                          </div>
                        )}

                        {cr.admin_notes && (
                          <div className="p-3 rounded-xl bg-sky-500/12 border border-sky-400/30 text-sky-100">
                            <span className="font-bold">Message StudyCloud :</span> {cr.admin_notes}
                          </div>
                        )}

                        {isPending ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                            <p className="text-[11px] text-slate-300 leading-relaxed max-w-md">
                              Vous pouvez confirmer pour lancer immédiatement le remboursement vers votre moyen de paiement d&apos;origine, ou abandonner le processus pour conserver votre offre actuelle.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              <button
                                type="button"
                                disabled={isBusyCr}
                                onClick={() => handleAbandonCancellationRefund(cr)}
                                className="h-10 px-4 rounded-xl border border-white/20 bg-white/[0.07] hover:bg-white/[0.15] text-slate-100 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Abandonner le processus</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusyCr}
                                onClick={() => handleConfirmCancellationRefund(cr)}
                                className="h-10 px-5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-black text-xs inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-lg shadow-rose-500/25"
                              >
                                {isBusyCr ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Traitement...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>
                                      {isRevert
                                        ? 'Confirmer le remboursement et revenir au forfait initial'
                                        : 'Confirmer le remboursement et annuler'}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : isAbandoned ? (
                          <div className="pt-2 border-t border-white/10 text-[11px] text-slate-300">
                            Processus abandonné le {formatDateTimeFr(cr.abandoned_at)} — votre abonnement est resté actif sans changement.
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap text-[11px] text-emerald-200">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              Confirmé le {formatDateTimeFr(cr.confirmed_at)}
                              {cr.refunded_at ? ` · Remboursé le ${formatDateTimeFr(cr.refunded_at)}` : ''}
                            </span>
                            {cr.payment_reference && (
                              <span className="font-mono text-[10px] text-slate-300">Réf : {cr.payment_reference}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : section === 'cards' ? (
            /* =============================================================== */
            /* SECTION CARTES VISA / MASTERCARD (UNIQUEMENT CARTES ENREGISTRÉES) */
            /* =============================================================== */
            paymentMethods.length === 0 ? (
              <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-6 sm:p-10 text-center space-y-2.5 shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
                <div className="inline-flex items-center justify-center rounded-lg bg-white border border-white/30 px-3 py-1.5 shadow-sm mb-1">
                  <img
                    src="/payment-logos/visa-mastercard.png"
                    alt="Visa et Mastercard"
                    className="h-7 sm:h-8 w-auto object-contain"
                  />
                </div>
                <div className="text-sm font-bold text-white">
                  Aucune carte bancaire enregistrée
                </div>
                <p className="text-xs text-slate-300/85 max-w-sm mx-auto">
                  Associez une carte Visa ou Mastercard sécurisée pour activer le renouvellement automatique.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={linkingCard}
                    onClick={() => openAddCardModal()}
                    className="h-9 px-4 rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] hover:from-[#3B82F6] hover:to-[#38BDF8] text-white text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-md shadow-sky-500/25"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Ajouter une carte</span>
                  </button>
                </div>
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
                      className="rounded-2xl bg-[#163466]/76 backdrop-blur-xl border border-white/18 shadow-[0_18px_40px_-16px_rgba(8,22,52,0.55)] overflow-hidden flex flex-col"
                    >
                      {/* En-tête visuel Carte Bancaire avec logo officiel Visa / Mastercard */}
                      <div className="p-4 bg-gradient-to-br from-[#1C417D] via-[#173566] to-[#122850] text-white border-b border-white/15">
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
            /* SECTION ACTIVITÉ & HISTORIQUE (ACTIVITÉS UTILISATEUR UNIQUEMENT)*/
            /* =============================================================== */
            <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl overflow-hidden shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
              {userVisibleEvents.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-200/85">
                  Aucune activité enregistrée sur vos abonnements pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-white/12">
                  {userVisibleEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-4 py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.06] transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span className="font-semibold text-white truncate">
                          {formatEventLabel(ev.event_type)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-200/80 whitespace-nowrap shrink-0">
                        {formatDateTimeFr(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-10 flex items-center justify-center gap-2 text-xs font-semibold text-white">
              <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
              <span>Chargement de vos abonnements...</span>
            </div>
          ) : visibleSubscriptions.length === 0 ? (
            /* =============================================================== */
            /* ÉTAT VIDE ÉPURÉ                                                 */
            /* =============================================================== */
            <div className="bg-[#163466]/72 backdrop-blur-xl border border-white/18 rounded-2xl p-10 text-center space-y-2.5 shadow-[0_18px_40px_-16px_rgba(8,22,52,0.5)]">
              <div className="w-11 h-11 mx-auto rounded-xl bg-sky-400/20 border border-sky-300/35 flex items-center justify-center text-sky-200">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-white">
                {searchQuery.trim()
                  ? `Aucun abonnement ne correspond à « ${searchQuery} »`
                  : 'Aucun abonnement actif dans cette catégorie'}
              </div>
              <p className="text-xs text-slate-200/80 max-w-sm mx-auto">
                {searchQuery.trim()
                  ? 'Essayez un autre mot-clé dans la barre de recherche.'
                  : 'Vos abonnements Stockage Cloud, Crédits IA et Applications apparaîtront automatiquement ici dès leur activation.'}
              </p>
              {searchQuery.trim() && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="h-8 px-4 rounded-full bg-white/[0.1] hover:bg-white/[0.18] border border-white/20 text-white text-xs font-semibold cursor-pointer transition"
                  >
                    Effacer la recherche
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* GRILLE DES ABONNEMENTS ACTIFS — MODÈLE SUPERPOSÉ STYLE IMAGE 3  */
            /* =============================================================== */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-5">
              {visibleSubscriptions.map((sub) => {
                const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
                const isAuto = !isInf && sub.renewal_mode === 'auto';
                const cd = computeLiveCountdownLabel(sub);
                const palette = getCardPalette(sub);
                const statusPillLabel = isInf
                  ? 'À vie'
                  : sub.status === 'active'
                  ? 'Actif'
                  : sub.status === 'blocked'
                  ? 'Bloqué'
                  : sub.status === 'grace'
                  ? 'Grâce'
                  : sub.status;
                const priceAmountFormatted = formatCurrencyAmount(
                  sub.price_amount || 0,
                  sub.currency || 'XOF'
                );
                const priceLine = `${priceAmountFormatted} · ${isInf ? 'Accès à vie' : isAuto ? 'Paiement automatique' : 'Paiement manuel'}`;
                const priceLineShort = `${priceAmountFormatted} · ${isInf ? 'À vie' : isAuto ? 'Auto' : 'Manuel'}`;
                const expiryDateOnly = sub.current_period_end
                  ? formatDateTimeFr(sub.current_period_end).split(' à ')[0]
                  : '';
                const expiryLine = isInf
                  ? 'Sans date d’expiration'
                  : expiryDateOnly
                  ? `Échéance : ${expiryDateOnly}`
                  : `Moyen : ${sub.last_network_label || 'Paystack'}`;
                const expiryLineShort = isInf
                  ? 'Sans expiration'
                  : expiryDateOnly
                  ? `Fin : ${expiryDateOnly}`
                  : sub.last_network_label || 'Paystack';

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    style={{ boxShadow: palette.glow }}
                    className="group relative rounded-[18px] sm:rounded-[26px] bg-[#FFFDF9] border border-white/40 overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_-12px_rgba(8,22,52,0.58)]"
                  >
                    {/* Bandeau supérieur coloré façon Image 3 (Catégorie + Temps + Pilule statut) */}
                    <div
                      style={{ background: palette.headerGradient }}
                      className="px-2.5 sm:px-5 pt-2.5 sm:pt-4 pb-5 sm:pb-8 flex items-start justify-between gap-1.5 sm:gap-2 relative"
                    >
                      <div className="min-w-0">
                        <div className={`text-[11px] sm:text-[13px] font-extrabold tracking-tight truncate ${palette.headerTextCls}`}>
                          {palette.categoryTitle}
                        </div>
                        <div className={`text-[9.5px] sm:text-[11px] font-semibold mt-0.5 tabular-nums truncate ${palette.headerSubCls}`}>
                          {cd.short}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold backdrop-blur-sm ${palette.pillCls}`}
                      >
                        {statusPillLabel}
                      </span>
                    </div>

                    {/* Corps arrondi ivoire superposé par-dessus le bandeau coloré */}
                    <div className="-mt-3 sm:-mt-4 rounded-[16px] sm:rounded-[24px] bg-[#FFFDF9] px-2.5 sm:px-5 pt-2.5 sm:pt-4 pb-2.5 sm:pb-4 flex-1 flex flex-col justify-between relative">
                      <div>
                        <h3 className="text-[13px] sm:text-[18px] font-extrabold tracking-tight text-[#1A1614] truncate leading-snug uppercase">
                          {sub.plan_name}
                        </h3>

                        <ul className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
                          <li className="flex items-center gap-1.5 sm:gap-2.5">
                            <span className="w-3.5 h-3.5 sm:w-[17px] sm:h-[17px] rounded-full bg-[#1C1917] text-white flex items-center justify-center shrink-0">
                              <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                            </span>
                            <span className="text-[10px] sm:text-[12.5px] font-semibold text-[#292524] truncate">
                              <span className="sm:hidden">{priceLineShort}</span>
                              <span className="hidden sm:inline">{priceLine}</span>
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5 sm:gap-2.5">
                            <span className="w-3.5 h-3.5 sm:w-[17px] sm:h-[17px] rounded-full bg-[#1C1917] text-white flex items-center justify-center shrink-0">
                              <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                            </span>
                            <span className="text-[10px] sm:text-[12.5px] font-medium text-[#44403C] truncate">
                              <span className="sm:hidden">{cd.short} restants</span>
                              <span className="hidden sm:inline">{cd.text}</span>
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5 sm:gap-2.5">
                            <span className="w-3.5 h-3.5 sm:w-[17px] sm:h-[17px] rounded-full border border-[#D6CFC5] bg-transparent shrink-0" />
                            <span className="text-[9.5px] sm:text-[12px] font-medium text-[#78716C] truncate">
                              <span className="sm:hidden">{expiryLineShort}</span>
                              <span className="hidden sm:inline">{expiryLine}</span>
                            </span>
                          </li>
                        </ul>
                      </div>

                      {/* Bouton circulaire flottant en bas à droite (modèle Image 3) */}
                      <div className="mt-2.5 sm:mt-4 flex items-center justify-between gap-1.5 sm:gap-2">
                        <span className="text-[9.5px] sm:text-[11px] font-semibold text-[#A8A29E] truncate">
                          {sub.last_network_label || 'StudyCloud'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubId(sub.id);
                          }}
                          title="Gérer cet abonnement"
                          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-[#E7DFD5] bg-white group-hover:bg-[#1C1917] group-hover:border-[#1C1917] text-[#1C1917] group-hover:text-white shadow-xs flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0"
                        >
                          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODALE STUDYCLOUD : ASSOCIER UNE CARTE — PORTAIL AU-DESSUS BARRE BASSE */}
      {/* ===================================================================== */}
      {showAddCardModal &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const selectedServicesCount =
              (addCardPerms.autoStorage ? 1 : 0) +
              (addCardPerms.autoAi ? 1 : 0) +
              (addCardPerms.autoApps.length > 0 ? 1 : 0);
            const allSelected = selectedServicesCount === 3;

            return (
              <div
                className="fixed inset-0 z-[100020] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-6"
                onClick={() => !linkingCard && setShowAddCardModal(false)}
              >
                <div
                  className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#163466] border border-white/20 text-white shadow-[0_28px_70px_-14px_rgba(8,22,52,0.75)] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* BARRE D'EN-TÊTE STRUCTURÉE AVEC LE VRAI LOGO VISA / MASTERCARD */}
                  <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 bg-[#122B56] border-b border-white/14 flex items-center justify-between gap-2.5 sm:gap-4 shrink-0">
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
                  <div className="md:col-span-5 bg-[#122B56]/90 p-5 flex flex-col justify-between gap-4">
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
                  <div className="md:col-span-7 bg-[#163466] p-5 flex flex-col justify-between gap-4">
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
                <div className="px-5 py-3.5 bg-[#122B56] border-t border-white/14 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
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
                      className="h-9 px-4 sm:px-5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] hover:from-[#3B82F6] hover:to-[#38BDF8] text-white text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 sm:gap-2 transition cursor-pointer disabled:opacity-60 shadow-md shadow-sky-500/25"
                    >
                      {linkingCard ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span className="sm:hidden">Continuer (0 FCFA)</span>
                      <span className="hidden sm:inline">Continuer vers la saisie sécurisée (0 FCFA net)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
};
