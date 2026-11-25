import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  RefreshCw,
  Zap,
  Infinity as InfinityIcon,
  CalendarClock,
  ShieldAlert,
  Trash2,
  Plus,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  HardDrive,
  Sparkles,
  AppWindow,
  Clock,
  Ban,
} from 'lucide-react';
import {
  ActiveSubscriptionRecord,
  cancelMySubscriptionAutoRenew,
  deleteMyPaymentMethod,
  formatCurrencyAmount,
  getMyActiveSubscriptions,
  initLinkBankCard,
  loadPaystackInlinePop,
  MaskedPaymentMethodRecord,
  updateSubscriptionRenewalMode,
  verifyLinkBankCard,
} from '../services/paystackBillingApi';

interface MySubscriptionsViewProps {
  onBack: () => void;
  onOpenRenewTarget?: (productType: 'storage' | 'ai' | 'app', appKey?: string) => void;
}

function formatDateTimeFr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function computeLiveCountdownLabel(sub: ActiveSubscriptionRecord): {
  text: string;
  tone: 'amber' | 'emerald' | 'orange' | 'rose';
} {
  if (Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite') {
    return { text: '♾️ Abonnement à vie (sans expiration)', tone: 'amber' };
  }
  const endMs = sub.current_period_end ? Date.parse(sub.current_period_end) : NaN;
  const now = Date.now();
  if (Number.isFinite(endMs) && endMs > now) {
    const totalHours = Math.floor((endMs - now) / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor(((endMs - now) % 3600000) / 60000);
    const text =
      days > 0 ? `${days} jour${days > 1 ? 's' : ''} et ${hours}h restants` : `${hours}h ${mins}m restantes`;
    return { text, tone: days <= 3 ? 'orange' : 'emerald' };
  }
  const graceMs = sub.grace_until ? Date.parse(sub.grace_until) : NaN;
  if (Number.isFinite(graceMs) && graceMs > now) {
    const gHours = Math.max(1, Math.ceil((graceMs - now) / 3600000));
    const gDays = Math.floor(gHours / 24);
    const gRemH = gHours % 24;
    return {
      text: `Période de grâce : ${gDays > 0 ? `${gDays}j ${gRemH}h` : `${gHours}h`} avant blocage`,
      tone: 'orange',
    };
  }
  return { text: 'Expiré — renouvellement requis', tone: 'rose' };
}

function getServiceMeta(sub: ActiveSubscriptionRecord) {
  if (sub.product_type === 'storage') {
    return { label: 'Stockage Cloud', Icon: HardDrive, badgeCls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30' };
  }
  if (sub.product_type === 'ai') {
    return { label: 'Crédits IA', Icon: Sparkles, badgeCls: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/30' };
  }
  return {
    label: sub.app_name || sub.app_key || 'Application StudyCloud',
    Icon: AppWindow,
    badgeCls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
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
    card_linked: 'Carte Visa/Mastercard associée',
    card_removed: 'Carte bancaire supprimée',
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
  onBack,
  onOpenRenewTarget,
}) => {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ActiveSubscriptionRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MaskedPaymentMethodRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<
    Array<{ id: string; subscription_id: string; event_type: string; actor: string; created_at: string }>
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkingCard, setLinkingCard] = useState(false);
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

  const notifyBannerSync = () => {
    try {
      window.dispatchEvent(new CustomEvent('studycloud_subscription_updated'));
    } catch {
      // Ignore
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
            ? `⚡ Renouvellement automatique activé pour ${sub.plan_name}.`
            : `🔄 Renouvellement manuel activé pour ${sub.plan_name} (aucun prélèvement automatique).`,
      });
      notifyBannerSync();
      await loadAll();
    }
    setBusyId(null);
  };

  const handleCancelAuto = async (sub: ActiveSubscriptionRecord) => {
    if (!window.confirm(`Arrêter le renouvellement automatique de « ${sub.plan_name} » ? Vous conserverez votre accès jusqu'à la fin de la période déjà payée.`)) {
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

  const handleLinkCard = async (targetSubId?: string) => {
    if (linkingCard) return;
    setLinkingCard(true);
    setFeedback(null);
    try {
      const initRes = await initLinkBankCard(targetSubId, true);
      if (!initRes.success || !initRes.accessCode || !initRes.reference) {
        setFeedback({ type: 'err', text: initRes.error || 'Impossible de démarrer la liaison de carte.' });
        setLinkingCard(false);
        return;
      }
      const PaystackPop = await loadPaystackInlinePop();
      const popup = new PaystackPop();
      popup.resumeTransaction(initRes.accessCode, {
        onSuccess: async (tx: any) => {
          const verRes = await verifyLinkBankCard(tx?.reference || initRes.reference!, targetSubId, true);
          if (verRes.success) {
            setFeedback({
              type: 'ok',
              text: `💳 Carte ${verRes.paymentMethod?.label || 'Visa / Mastercard'} enregistrée avec succès !`,
            });
            notifyBannerSync();
            await loadAll();
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

  const hasAlerts = subscriptions.some((s) => ['grace', 'past_due', 'blocked'].includes(String(s.status)));

  return (
    <div className="w-full min-h-full bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* En-tête */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-orange-500" />
                <span>Gérer mes abonnements</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Suivez vos forfaits Stockage, Crédits IA &amp; Applications, basculez Automatique / Manuel et gérez vos cartes Visa/Mastercard.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Message de retour */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-start gap-2.5 ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-700/60 text-rose-800 dark:text-rose-200'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Alerte impayé / blocage */}
        {hasAlerts && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/15 via-orange-500/15 to-amber-500/15 border border-rose-400/40 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <div className="font-black text-rose-700 dark:text-rose-300">
                Action requise sur un ou plusieurs abonnements
              </div>
              <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                Un abonnement est en période de grâce ou suspendu. Régularisez-le ci-dessous pour rétablir immédiatement votre accès.
              </p>
            </div>
          </div>
        )}

        {/* Liste des abonnements */}
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Mes abonnements actifs &amp; récents ({subscriptions.length})
          </h2>

          {loading ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
              <span>Chargement de vos abonnements...</span>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
              <div className="text-3xl">📦</div>
              <div className="font-black text-base">Aucun abonnement payant actif pour le moment</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Dès que vous souscrivez à un forfait Stockage Cloud, Crédits IA ou une application StudyCloud (comme Moyennes), vous pourrez tout piloter ici.
              </p>
              {onOpenRenewTarget && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenRenewTarget('storage')}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Voir les offres Stockage
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenRenewTarget('ai')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Voir les offres Crédits IA
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub) => {
                const isInf = Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite';
                const isAuto = !isInf && sub.renewal_mode === 'auto';
                const canAuto = !isInf && Number(sub.plan_allows_auto) === 1;
                const hasCard = paymentMethods.length > 0;
                const countdown = computeLiveCountdownLabel(sub);
                const meta = getServiceMeta(sub);
                const SrvIcon = meta.Icon;
                const isBusy = busyId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10.5px] font-extrabold ${meta.badgeCls}`}
                          >
                            <SrvIcon className="w-3 h-3" />
                            <span>{meta.label}</span>
                          </span>
                          <h3 className="text-base font-black truncate">{sub.plan_name}</h3>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrencyAmount(sub.price_amount || 0, sub.currency || 'XOF')}
                          </div>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                              sub.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : sub.status === 'blocked'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {sub.status === 'active'
                              ? '✅ Actif'
                              : sub.status === 'blocked'
                              ? '🔒 Suspendu'
                              : sub.status === 'grace' || sub.status === 'past_due'
                              ? '⏳ En grâce'
                              : sub.status}
                          </span>
                        </div>
                      </div>

                      {/* Compte à rebours temps réel */}
                      <div
                        className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 ${
                          countdown.tone === 'amber'
                            ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-200'
                            : countdown.tone === 'emerald'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-200'
                            : countdown.tone === 'orange'
                            ? 'bg-orange-50 dark:bg-orange-500/15 border-orange-200 dark:border-orange-500/35 text-orange-800 dark:text-orange-200'
                            : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/35 text-rose-800 dark:text-rose-200'
                        }`}
                      >
                        {isInf ? <InfinityIcon className="w-4 h-4 shrink-0" /> : <CalendarClock className="w-4 h-4 shrink-0" />}
                        <span>{countdown.text}</span>
                      </div>

                      {!isInf && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                            <div className="text-[9.5px] uppercase font-bold">Début</div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                              {formatDateTimeFr(sub.current_period_start)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                            <div className="text-[9.5px] uppercase font-bold">Fin exacte</div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                              {formatDateTimeFr(sub.current_period_end)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contrôle Auto / Manuel */}
                      {!isInf && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-300">Mode actuel :</span>
                            <span className="font-black flex items-center gap-1">
                              {isAuto ? (
                                <>
                                  <Zap className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-300">Automatique</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
                                  <span className="text-sky-600 dark:text-sky-300">Manuel</span>
                                </>
                              )}
                            </span>
                          </div>

                          {canAuto ? (
                            hasCard ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleToggleMode(sub, isAuto ? 'manual' : 'auto')}
                                  className="flex-1 py-2 px-3 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-[11px] font-extrabold transition cursor-pointer disabled:opacity-60"
                                >
                                  {isBusy
                                    ? 'Mise à jour...'
                                    : isAuto
                                    ? '🔄 Passer en Manuel'
                                    : '⚡ Activer le paiement Auto'}
                                </button>
                                {isAuto && Number(sub.cancel_at_period_end) !== 1 && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleCancelAuto(sub)}
                                    title="Arrêter en fin de période"
                                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 transition cursor-pointer"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={linkingCard}
                                onClick={() => handleLinkCard(sub.id)}
                                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Associer une carte Visa/Mastercard (Auto)</span>
                              </button>
                            )
                          ) : (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Ce forfait fonctionne uniquement en paiement manuel.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bouton Renouveler / Régulariser */}
                    {!isInf && onOpenRenewTarget && (
                      <button
                        type="button"
                        onClick={() => onOpenRenewTarget(sub.product_type, sub.app_key)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer ${
                          sub.status === 'blocked' || sub.status === 'grace' || sub.status === 'past_due'
                            ? 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-md'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white'
                        }`}
                      >
                        {sub.status === 'blocked' || sub.status === 'grace' || sub.status === 'past_due'
                          ? '💳 Régulariser / Renouveler maintenant'
                          : 'Renouveler ou changer de forfait'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Cartes bancaires enregistrées */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                <span>Mes cartes bancaires (Visa / Mastercard)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Associez une carte bancaire sécurisée (tokenisée PCI-DSS via Paystack) même si vous avez payé initialement par Wave, Orange Money ou MTN.
              </p>
            </div>
            <button
              type="button"
              disabled={linkingCard}
              onClick={() => handleLinkCard()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {linkingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Ajouter une carte Visa/Mastercard</span>
            </button>
          </div>

          {paymentMethods.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              Aucune carte bancaire enregistrée. Vos abonnements actuels sont en mode manuel.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-black text-sm flex items-center gap-2">
                      <span>💳 {pm.label}</span>
                      {pm.isDefault && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[9.5px] font-black">
                          Principale
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Exp. {pm.expMonth}/{pm.expYear} {pm.bank ? `· ${pm.bank}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === pm.id}
                    onClick={() => handleRemoveCard(pm)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 transition cursor-pointer"
                    title="Supprimer cette carte"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historique récent */}
        {recentEvents.length > 0 && (
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-500" />
              <span>Activité récente sur vos abonnements</span>
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {recentEvents.slice(0, 10).map((ev) => (
                <div key={ev.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatEventLabel(ev.event_type)}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {formatDateTimeFr(ev.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
