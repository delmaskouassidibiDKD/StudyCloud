import React, { useMemo, useState, useEffect } from 'react';
import {
  HardDrive,
  Plus,
  Minus,
  RefreshCw,
  CalendarClock,
  Receipt,
  Sparkles,
  Lock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  PaymentGatewayConfig,
  shouldShowManualReceiptButton,
  StorageMasterCardConfig,
  StorageMasterUserState,
} from '../services/paystackBillingApi';
import { StudyCloudPaymentTarget } from './StudyCloudPaymentView';
import { SelectedPlan } from './SubscriptionFormView';

interface StorageMasterCardProps {
  config: StorageMasterCardConfig;
  userState: StorageMasterUserState;
  paymentConfig: PaymentGatewayConfig;
  onStartCustomPayment: (target: StudyCloudPaymentTarget, manualPlan: SelectedPlan) => void;
  onStartManualPayment: (manualPlan: SelectedPlan) => void;
}

function formatStorageMb(mb: number): string {
  const val = Math.max(0, Number(mb) || 0);
  if (val >= 1024) {
    const gb = val / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1).replace(/\.0$/, '')} Go`;
  }
  return `${Math.round(val * 10) / 10} Mo`;
}

function formatDateFr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const StorageMasterCard: React.FC<StorageMasterCardProps> = ({
  config,
  userState,
  paymentConfig,
  onStartCustomPayment,
  onStartManualPayment,
}) => {
  const [addedSteps, setAddedSteps] = useState<number>(0);

  // Réinitialiser le delta si le quota payant réel de l'utilisateur change (après paiement / booster)
  useEffect(() => {
    setAddedSteps(0);
  }, [userState.paidMb, config.stepMb]);

  const currentPaidMb = Math.max(0, Number(userState.paidMb || 0));
  const stepMb = Math.max(1, Number(config.stepMb || 100));
  const maxStorageMb = Math.max(0, Number(config.maxStorageMb || 0));

  const addedMb = Math.round(addedSteps * stepMb * 100) / 100;
  const targetPaidMb = Math.round((currentPaidMb + addedMb) * 100) / 100;
  const canIncrement = maxStorageMb <= 0 || targetPaidMb + stepMb <= maxStorageMb + 0.001;
  const canDecrement = addedSteps > 0;

  const quote = useMemo(() => {
    const oldMonthlyFcfa =
      currentPaidMb > 0
        ? userState.monthlyPriceFcfa > 0
          ? userState.monthlyPriceFcfa
          : Math.round((currentPaidMb / stepMb) * config.pricePerStepFcfa)
        : 0;

    if (addedSteps <= 0) {
      return {
        mode: currentPaidMb > 0 ? ('renew' as const) : ('idle' as const),
        oldMonthlyFcfa,
        newMonthlyFcfa: oldMonthlyFcfa,
        prorataApplied: false,
        unusedCreditFcfa: 0,
        consumedCostFcfa: 0,
        amountDueFcfa: oldMonthlyFcfa,
      };
    }

    const addedMonthlyFcfa = Math.round(addedSteps * config.pricePerStepFcfa);
    const newMonthlyFcfa = oldMonthlyFcfa + addedMonthlyFcfa;

    const canApplyProrata = Boolean(
      config.prorataEnabled &&
        currentPaidMb > 0 &&
        userState.hasActiveSubscription &&
        !userState.isExpired &&
        !userState.isInfinite &&
        userState.unusedCreditFcfa > 0
    );
    const unusedCreditFcfa = canApplyProrata
      ? Math.min(userState.unusedCreditFcfa, oldMonthlyFcfa)
      : 0;
    const consumedCostFcfa = canApplyProrata ? userState.consumedCostFcfa : 0;
    const rawNet = Math.max(0, newMonthlyFcfa - unusedCreditFcfa);
    const amountDueFcfa =
      newMonthlyFcfa >= 100 ? Math.max(100, rawNet) : Math.max(1, rawNet);

    return {
      mode: 'upgrade' as const,
      oldMonthlyFcfa,
      newMonthlyFcfa,
      prorataApplied: canApplyProrata && unusedCreditFcfa > 0,
      unusedCreditFcfa,
      consumedCostFcfa,
      amountDueFcfa,
    };
  }, [addedSteps, config, currentPaidMb, stepMb, userState]);

  const stepLabel = `${config.stepValue} ${config.stepUnit === 'GB' ? 'Go' : 'Mo'}`;
  const periodLabel = config.durationDays === 30 ? '/ mois' : `/ ${config.durationDays}j`;
  const isPaystackAvailable =
    paymentConfig.paystackEnabled && paymentConfig.mode !== 'unconfigured';
  const showManualUnderneath = shouldShowManualReceiptButton(paymentConfig, true);

  const statusBadge = useMemo(() => {
    if (userState.isInfinite) {
      return { text: 'À vie', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40' };
    }
    if (userState.hasActiveSubscription) {
      if (userState.daysRemaining <= 5) {
        return {
          text: `Expire dans ${userState.daysRemaining}j`,
          cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
        };
      }
      return { text: 'Actif', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' };
    }
    if (userState.inGrace) {
      return { text: 'Période de grâce', cls: 'bg-orange-500/20 text-orange-200 border-orange-400/40' };
    }
    if (userState.isExpired && currentPaidMb > 0) {
      return { text: 'Expiré', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' };
    }
    return { text: 'Carte Maîtresse', cls: 'bg-blue-500/20 text-blue-200 border-blue-400/40' };
  }, [currentPaidMb, userState]);

  const buildPaymentPayload = (action: 'upgrade' | 'renew'): {
    target: StudyCloudPaymentTarget;
    manualPlan: SelectedPlan;
  } => {
    const isRenew = action === 'renew';
    const finalMb = isRenew ? currentPaidMb : targetPaidMb;
    const amountFcfa = Math.round(quote.amountDueFcfa);
    const productName = isRenew
      ? `Renouvellement Stockage ${formatStorageMb(finalMb)}`
      : `Stockage ${formatStorageMb(finalMb)}`;
    const subtitle = isRenew
      ? `Prolongation de votre forfait (${formatStorageMb(finalMb)}) pour ${config.durationDays} jours`
      : quote.prorataApplied
      ? `+${formatStorageMb(addedMb)} ajoutés (prorata -${quote.unusedCreditFcfa.toLocaleString('fr-FR')} FCFA déduit)`
      : `Quota payant porté à ${formatStorageMb(finalMb)} (${quote.newMonthlyFcfa.toLocaleString('fr-FR')} FCFA ${periodLabel})`;

    const features: string[] = [
      `Stockage payant : ${formatStorageMb(finalMb)} (+ ${formatStorageMb(userState.welcomeMb)} offerts)`,
      `Nouveau tarif récurrent : ${quote.newMonthlyFcfa.toLocaleString('fr-FR')} FCFA ${periodLabel}`,
      'Remplace proprement votre abonnement principal sans doublon',
    ];
    if (quote.prorataApplied) {
      features.push(
        `Crédit prorata appliqué (${userState.daysRemaining}j non consommés) : -${quote.unusedCreditFcfa.toLocaleString('fr-FR')} FCFA`
      );
    }

    const manualPlan: SelectedPlan = {
      name: productName,
      type: 'storage',
      storageDisplay: formatStorageMb(finalMb),
      priceDisplay: `${amountFcfa.toLocaleString('fr-FR')} FCFA ${periodLabel}`,
      price: amountFcfa,
      priceFcfa: amountFcfa,
      currency: 'FCFA',
      billingCycle: 'monthly',
      mb: isRenew ? 0 : addedMb,
    };

    const target: StudyCloudPaymentTarget = {
      productType: 'storage',
      productId: isRenew ? 'storage_master_renew' : 'storage_master_upgrade',
      productName,
      subtitle,
      description: config.subtitle,
      features,
      periodLabel,
      amountFcfa,
      billingCycle: 'monthly',
      billingMode: config.billingMode,
      durationDays: config.durationDays,
      targetPaidMb: finalMb,
    };

    return { target, manualPlan };
  };

  const handlePrimaryPayClick = () => {
    if (quote.mode === 'idle') {
      if (canIncrement) setAddedSteps(1);
      return;
    }
    const { target, manualPlan } = buildPaymentPayload(quote.mode);
    if (isPaystackAvailable) {
      onStartCustomPayment(target, manualPlan);
    } else if (showManualUnderneath) {
      onStartManualPayment(manualPlan);
    }
  };

  const handleManualClick = () => {
    if (quote.mode === 'idle') return;
    const { manualPlan } = buildPaymentPayload(quote.mode);
    onStartManualPayment(manualPlan);
  };

  return (
    <div
      id="storage-master-card"
      className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative max-w-[390px] w-full mx-auto bg-gradient-to-b from-slate-900 via-[#0f1c36] to-[#0b1326] border-2 border-blue-500/60 text-white shadow-xl shadow-blue-950/35 ring-1 ring-blue-400/25 transition-all duration-300"
    >
      <div className="space-y-4">
        {/* En-tête Carte Maîtresse */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/35 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-tight truncate">
                {config.title}
              </h3>
              <p className="text-[11px] text-slate-300/90 leading-snug line-clamp-2">
                {config.subtitle}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusBadge.cls}`}
          >
            {statusBadge.text}
          </span>
        </div>

        {/* Résumé en direct depuis D1 : Stockage actuel + Utilisation + Renouvellement */}
        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3.5 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Votre stockage actuel
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {formatStorageMb(userState.totalAllowedMb)}
                </span>
                {currentPaidMb > 0 ? (
                  <span className="text-[11px] font-bold text-blue-300">
                    ({formatStorageMb(currentPaidMb)} payant)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400">
                    (Bienvenue offert)
                  </span>
                )}
              </div>
            </div>

            {currentPaidMb > 0 && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Forfait actuel
                </p>
                <p className="text-sm font-extrabold text-emerald-300 tabular-nums">
                  {userState.monthlyPriceFcfa.toLocaleString('fr-FR')} FCFA
                  <span className="text-[10px] font-medium text-slate-400"> {periodLabel}</span>
                </p>
              </div>
            )}
          </div>

          {/* Barre de progression espace utilisé */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 mb-1">
              <span>Utilisé : {formatStorageMb(userState.usedMb)}</span>
              <span>{userState.usagePercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  userState.usagePercent >= 90
                    ? 'bg-rose-500'
                    : userState.usagePercent >= 70
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, userState.usagePercent))}%` }}
              />
            </div>
          </div>

          {/* Date de renouvellement / échéance */}
          {userState.currentPeriodEnd && !userState.isInfinite && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
                <CalendarClock className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <span>
                  {userState.isExpired ? 'Expiré le' : 'Renouvellement le'}{' '}
                  <strong className="text-white">{formatDateFr(userState.currentPeriodEnd)}</strong>
                </span>
              </span>
              {userState.hasActiveSubscription && (
                <span className="font-bold text-emerald-300 shrink-0">
                  {userState.daysRemaining}j restants
                </span>
              )}
            </div>
          )}
        </div>

        {/* Petit module central : Sélecteur dynamique d'augmentation (jamais en dessous du quota actuel) */}
        <div className="rounded-xl bg-slate-950/70 border border-blue-400/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Augmenter le stockage
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              Pas : +{stepLabel}
            </span>
          </div>

          {/* Carré de contrôle - / Quota / + */}
          <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2">
            <button
              type="button"
              disabled={!canDecrement}
              onClick={() => setAddedSteps((s) => Math.max(0, s - 1))}
              aria-label="Réduire l'ajout avant paiement"
              title={
                canDecrement
                  ? `Retirer ${stepLabel} de l'ajout`
                  : 'Impossible de diminuer en dessous de votre stockage actuel'
              }
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                canDecrement
                  ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-95 border border-slate-600'
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
              }`}
            >
              {canDecrement ? <Minus className="w-4 h-4 stroke-[2.5]" /> : <Lock className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1 text-center min-w-0 px-1">
              <div className="text-sm sm:text-base font-black text-white tabular-nums truncate">
                {addedSteps > 0 ? (
                  <>
                    <span className="text-slate-400 font-bold text-xs">
                      {formatStorageMb(currentPaidMb)} →{' '}
                    </span>
                    <span className="text-blue-300">{formatStorageMb(targetPaidMb)}</span>
                  </>
                ) : (
                  <span>{formatStorageMb(currentPaidMb)}</span>
                )}
              </div>
              <div className="text-[10px] font-bold mt-0.5">
                {addedSteps > 0 ? (
                  <span className="text-emerald-300">
                    +{formatStorageMb(addedMb)} payant ({formatStorageMb(userState.welcomeMb + targetPaidMb + userState.bonusMb)} au total)
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Appuyez sur <strong className="text-white">+</strong> pour augmenter
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!canIncrement}
              onClick={() => setAddedSteps((s) => s + 1)}
              aria-label={`Ajouter ${stepLabel}`}
              title={canIncrement ? `Ajouter +${stepLabel}` : 'Plafond maximal atteint'}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                canIncrement
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95 shadow-md shadow-blue-900/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Récapitulatif prix dynamique + Prorata transparent */}
          {addedSteps > 0 ? (
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Nouveau tarif ({config.durationDays}j)</span>
                <span className="font-bold text-white tabular-nums">
                  {quote.newMonthlyFcfa.toLocaleString('fr-FR')} FCFA {periodLabel}
                </span>
              </div>

              {quote.prorataApplied && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 p-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-emerald-200">
                    <span>Déjà consommé ({userState.daysUsed}j)</span>
                    <span className="tabular-nums font-semibold">
                      {quote.consumedCostFcfa.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span>Crédit prorata ({userState.daysRemaining}j restants)</span>
                    <span className="tabular-nums">
                      -{quote.unusedCreditFcfa.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                <span className="font-extrabold text-white">Net à payer aujourd'hui</span>
                <span className="text-lg font-black text-blue-300 tabular-nums">
                  {quote.amountDueFcfa.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Tarif par palier</span>
              <span className="font-bold text-slate-200 tabular-nums">
                +{config.pricePerStepFcfa.toLocaleString('fr-FR')} FCFA / +{stepLabel}
              </span>
            </div>
          )}
        </div>

        {/* Rappel anti-downgrade & synchronisation cartes bonus */}
        <ul className="space-y-1.5 text-[11px] text-slate-300">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Remplace votre forfait principal sans doublon ni conflit</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Synchronisé automatiquement avec les cartes bonus à côté</span>
          </li>
          {userState.isExpired && currentPaidMb > 0 && (
            <li className="flex items-center gap-2 text-amber-300 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Abonnement expiré : renouvelez ou augmentez maintenant</span>
            </li>
          )}
        </ul>
      </div>

      {/* Boutons d'action principaux : Augmenter OU Renouveler */}
      <div className="space-y-2 mt-5 pt-3 border-t border-white/10">
        {quote.mode === 'upgrade' ? (
          <>
            {isPaystackAvailable || showManualUnderneath ? (
              <button
                type="button"
                onClick={handlePrimaryPayClick}
                className="w-full py-2.5 sm:py-3 font-extrabold text-xs sm:text-sm rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40 transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4 shrink-0" />
                <span>
                  Augmenter à {formatStorageMb(targetPaidMb)} — {quote.amountDueFcfa.toLocaleString('fr-FR')} FCFA
                </span>
              </button>
            ) : (
              <div className="w-full py-2.5 px-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold text-center">
                Paiement temporairement indisponible
              </div>
            )}
            {isPaystackAvailable && showManualUnderneath && (
              <button
                type="button"
                onClick={handleManualClick}
                className="w-full py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Payer manuellement (envoyer un reçu)</span>
              </button>
            )}
          </>
        ) : quote.mode === 'renew' ? (
          <>
            {isPaystackAvailable || showManualUnderneath ? (
              <button
                type="button"
                onClick={handlePrimaryPayClick}
                className="w-full py-2.5 sm:py-3 font-extrabold text-xs sm:text-sm rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>
                  Renouveler ({formatStorageMb(currentPaidMb)}) — {quote.amountDueFcfa.toLocaleString('fr-FR')} FCFA
                </span>
              </button>
            ) : (
              <div className="w-full py-2.5 px-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold text-center">
                Paiement temporairement indisponible
              </div>
            )}
            {isPaystackAvailable && showManualUnderneath && (
              <button
                type="button"
                onClick={handleManualClick}
                className="w-full py-2 px-3 rounded-xl text-[11px] sm:text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Renouveler par reçu manuel</span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => canIncrement && setAddedSteps(1)}
            className="w-full py-2.5 sm:py-3 font-extrabold text-xs sm:text-sm rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40 transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>
              Ajouter +{stepLabel} ({config.pricePerStepFcfa.toLocaleString('fr-FR')} FCFA {periodLabel})
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
