import React, { useMemo, useState, useEffect } from 'react';
import {
  HardDrive,
  Plus,
  Minus,
  RefreshCw,
  CalendarClock,
  Receipt,
  Lock,
  ArrowUpRight,
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

const CAPSULE_CTA_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(90deg, #1E1110 0%, #5A2413 38%, #C74919 72%, #FF6D29 90%, #FFA366 100%)',
};

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
    const rawUnusedCreditFcfa = canApplyProrata ? Math.max(0, userState.unusedCreditFcfa) : 0;
    const minPayable = newMonthlyFcfa >= 100 ? 100 : 1;
    const maxDeductible = Math.max(0, newMonthlyFcfa - minPayable);
    const unusedCreditFcfa = Math.min(rawUnusedCreditFcfa, maxDeductible);
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
      style={{
        background:
          'linear-gradient(180deg, rgba(255, 114, 41, 0.94) 0%, rgba(196, 68, 19, 0.72) 18%, rgba(84, 30, 14, 0.52) 36%, rgba(20, 15, 15, 0.97) 56%, #121012 100%)',
      }}
      className="rounded-[24px] p-5 sm:p-6 flex flex-col justify-between relative w-full border border-[#FF8E53]/45 text-white shadow-[0_24px_60px_-14px_rgba(0,0,0,0.82),0_0_36px_-10px_rgba(255,109,41,0.34)] transition-all duration-300"
    >
      <div className="space-y-4">
        {/* En-tête Carte Maîtresse */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#161316]/45 border border-white/25 flex items-center justify-center shrink-0 shadow-inner">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-[19px] font-extrabold tracking-tight text-white leading-tight truncate">
              {config.title}
            </h3>
            <p className="text-[11px] sm:text-xs text-[#FFF1E8]/85 leading-snug line-clamp-2 mt-0.5">
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* Résumé en direct depuis D1 : Stockage actuel + Utilisation + Renouvellement */}
        <div className="rounded-2xl bg-[#161316]/75 backdrop-blur-md border border-white/15 p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#BABABA]">
                Votre stockage actuel
              </p>
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {formatStorageMb(userState.totalAllowedMb)}
                </span>
                {currentPaidMb > 0 ? (
                  <span className="text-[11px] font-bold text-[#FF9B66]">
                    ({formatStorageMb(currentPaidMb)} payant)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[#BABABA]">
                    (Bienvenue offert)
                  </span>
                )}
              </div>
            </div>

            {currentPaidMb > 0 && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#BABABA]">
                  Forfait actuel
                </p>
                <p className="text-sm font-extrabold text-[#FFB085] tabular-nums">
                  {userState.monthlyPriceFcfa.toLocaleString('fr-FR')} FCFA
                  <span className="text-[10px] font-medium text-[#BABABA]"> {periodLabel}</span>
                </p>
              </div>
            )}
          </div>

          {/* Barre de progression espace utilisé */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-[#BABABA] mb-1.5">
              <span>Utilisé : {formatStorageMb(userState.usedMb)}</span>
              <span className="text-white font-bold">{userState.usagePercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  userState.usagePercent >= 90
                    ? 'bg-rose-500'
                    : userState.usagePercent >= 70
                    ? 'bg-amber-400'
                    : 'bg-gradient-to-r from-[#FF6D29] to-[#FFA46E]'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, userState.usagePercent))}%` }}
              />
            </div>
          </div>

          {/* Date de renouvellement / échéance */}
          {userState.currentPeriodEnd && !userState.isInfinite && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-[#BABABA] font-medium">
                <CalendarClock className="w-3.5 h-3.5 text-[#FF8C52] shrink-0" />
                <span>
                  {userState.isExpired ? 'Expiré le' : 'Renouvellement le'}{' '}
                  <strong className="text-white">{formatDateFr(userState.currentPeriodEnd)}</strong>
                </span>
              </span>
              {userState.hasActiveSubscription && (
                <span className="font-bold text-[#FFB085] shrink-0">
                  {userState.daysRemaining}j restants
                </span>
              )}
            </div>
          )}
        </div>

        {/* Module central : Sélecteur dynamique d'augmentation */}
        <div className="rounded-2xl bg-[#161316]/88 border border-[#FF6D29]/28 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FFA370]">
              Augmenter le stockage
            </span>
            <span className="text-[10px] font-semibold text-[#BABABA]">
              Pas : +{stepLabel}
            </span>
          </div>

          {/* Contrôle - / Quota / + */}
          <div className="flex items-center justify-between gap-2 bg-[#0D0B0D]/95 border border-white/12 rounded-xl p-2">
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
                  ? 'bg-[#453027]/80 hover:bg-[#5A3E32] text-white cursor-pointer active:scale-95 border border-white/15'
                  : 'bg-white/[0.04] text-white/25 cursor-not-allowed border border-white/[0.06]'
              }`}
            >
              {canDecrement ? <Minus className="w-4 h-4 stroke-[2.5]" /> : <Lock className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1 text-center min-w-0 px-1">
              <div className="text-sm sm:text-base font-black text-white tabular-nums truncate">
                {addedSteps > 0 ? (
                  <>
                    <span className="text-[#BABABA] font-bold text-xs">
                      {formatStorageMb(currentPaidMb)} →{' '}
                    </span>
                    <span className="text-[#FF8D52]">{formatStorageMb(targetPaidMb)}</span>
                  </>
                ) : (
                  <span>{formatStorageMb(currentPaidMb)}</span>
                )}
              </div>
              <div className="text-[10px] font-bold mt-0.5">
                {addedSteps > 0 ? (
                  <span className="text-[#FFB085]">
                    +{formatStorageMb(addedMb)} payant ({formatStorageMb(userState.welcomeMb + targetPaidMb + userState.bonusMb)} au total)
                  </span>
                ) : (
                  <span className="text-[#BABABA]">
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
                  ? 'bg-gradient-to-br from-[#FF6D29] to-[#D94A12] hover:from-[#FF7F40] hover:to-[#E8571C] text-white cursor-pointer active:scale-95 shadow-lg shadow-[#FF6D29]/30'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Récapitulatif prix dynamique + Prorata transparent */}
          {addedSteps > 0 ? (
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-center justify-between text-[#BABABA]">
                <span>Nouveau tarif ({config.durationDays}j)</span>
                <span className="font-bold text-white tabular-nums">
                  {quote.newMonthlyFcfa.toLocaleString('fr-FR')} FCFA {periodLabel}
                </span>
              </div>

              {quote.prorataApplied && (
                <div className="rounded-xl bg-[#FF6D29]/12 border border-[#FF6D29]/30 p-2.5 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-[#F5D6C6]">
                    <span>Déjà consommé ({userState.daysUsed}j)</span>
                    <span className="tabular-nums font-semibold">
                      {quote.consumedCostFcfa.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#FFA370] font-bold">
                    <span>Crédit prorata ({userState.daysRemaining}j restants)</span>
                    <span className="tabular-nums">
                      -{quote.unusedCreditFcfa.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="font-extrabold text-white">Net à payer aujourd'hui</span>
                <span className="text-lg font-black text-[#FF8D52] tabular-nums">
                  {quote.amountDueFcfa.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-[#BABABA]">
              <span>Tarif par palier</span>
              <span className="font-bold text-white tabular-nums">
                +{config.pricePerStepFcfa.toLocaleString('fr-FR')} FCFA / +{stepLabel}
              </span>
            </div>
          )}
        </div>

        {/* Alerte expiration uniquement si expiré */}
        {userState.isExpired && currentPaidMb > 0 && (
          <div className="rounded-xl bg-amber-500/12 border border-amber-400/35 px-3 py-2 flex items-center gap-2 text-[11px] text-amber-200 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            <span>Abonnement expiré : renouvelez ou augmentez maintenant</span>
          </div>
        )}
      </div>

      {/* Boutons d'action principaux : Style capsule professionnelle */}
      <div className="space-y-2 mt-5 pt-3.5 border-t border-white/10">
        {quote.mode === 'upgrade' ? (
          <>
            {isPaystackAvailable || showManualUnderneath ? (
              <button
                type="button"
                onClick={handlePrimaryPayClick}
                style={CAPSULE_CTA_STYLE}
                className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_26px_-8px_rgba(255,109,41,0.5)] hover:shadow-[0_14px_32px_-8px_rgba(255,109,41,0.72)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
              >
                <span className="flex-1 text-center truncate px-1">
                  Augmenter à {formatStorageMb(targetPaidMb)} — {quote.amountDueFcfa.toLocaleString('fr-FR')} FCFA
                </span>
                <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </span>
              </button>
            ) : (
              <div className="w-full py-2.5 px-3 rounded-full bg-white/5 border border-white/10 text-[#BABABA] text-xs font-semibold text-center">
                Paiement temporairement indisponible
              </div>
            )}
            {isPaystackAvailable && showManualUnderneath && (
              <button
                type="button"
                onClick={handleManualClick}
                className="w-full py-2 px-3 rounded-full text-[11px] font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-[#BABABA] hover:text-white border border-white/12 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5 text-[#FF8D52] shrink-0" />
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
                style={CAPSULE_CTA_STYLE}
                className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_26px_-8px_rgba(255,109,41,0.5)] hover:shadow-[0_14px_32px_-8px_rgba(255,109,41,0.72)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
              >
                <span className="flex-1 text-center truncate px-1">
                  Renouveler ({formatStorageMb(currentPaidMb)}) — {quote.amountDueFcfa.toLocaleString('fr-FR')} FCFA
                </span>
                <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0 transition-transform duration-300 group-hover/cta:rotate-45">
                  <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
              </button>
            ) : (
              <div className="w-full py-2.5 px-3 rounded-full bg-white/5 border border-white/10 text-[#BABABA] text-xs font-semibold text-center">
                Paiement temporairement indisponible
              </div>
            )}
            {isPaystackAvailable && showManualUnderneath && (
              <button
                type="button"
                onClick={handleManualClick}
                className="w-full py-2 px-3 rounded-full text-[11px] font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-[#BABABA] hover:text-white border border-white/12 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5 text-[#FF8D52] shrink-0" />
                <span>Renouveler par reçu manuel</span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => canIncrement && setAddedSteps(1)}
            style={CAPSULE_CTA_STYLE}
            className="group/cta w-full pl-4 pr-1.5 py-1.5 rounded-full border border-white/25 hover:border-white/50 text-white font-bold text-xs sm:text-[13px] shadow-[0_10px_26px_-8px_rgba(255,109,41,0.5)] hover:shadow-[0_14px_32px_-8px_rgba(255,109,41,0.72)] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2"
          >
            <span className="flex-1 text-center truncate px-1">
              Ajouter +{stepLabel} ({config.pricePerStepFcfa.toLocaleString('fr-FR')} FCFA {periodLabel})
            </span>
            <span className="w-8 h-8 rounded-full bg-[#161316] border-2 border-[#FFF1E6]/90 text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/cta:scale-105">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
