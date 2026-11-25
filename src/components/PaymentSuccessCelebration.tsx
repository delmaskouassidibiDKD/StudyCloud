import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Printer,
  Download,
  Infinity as InfinityIcon,
  Zap,
  RefreshCw,
  CreditCard,
  Loader2,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
import { getCurrentLanguage } from '../services/languageService';
import {
  ActiveSubscriptionRecord,
  ClientBillingMode,
  formatCurrencyAmount,
  MaskedPaymentMethodRecord,
  PaymentProductType,
  RenewalUiConfig,
  resolveSuccessScreenRenewalState,
  SubscriptionRenewalMode,
  updateSubscriptionRenewalMode,
} from '../services/paystackBillingApi';

export interface PaymentSuccessCelebrationProps {
  productName: string;
  productType?: PaymentProductType;
  amount: number;
  currency?: string;
  reference: string;
  networkLabel?: string;
  deliverySummary?: string;
  ctaLabel?: string;
  billingMode?: ClientBillingMode;
  durationDays?: number;
  entitlementExpiresAt?: string | null;
  subscription?: ActiveSubscriptionRecord | null;
  paymentMethod?: MaskedPaymentMethodRecord | null;
  renewalUiConfig?: RenewalUiConfig | null;
  onRenewalModeChanged?: (mode: SubscriptionRenewalMode, updatedSub?: ActiveSubscriptionRecord | null) => void;
  onContinue: () => void;
}

interface SuccessCopy {
  title: string;
  subtitleStorage: string;
  subtitleAi: string;
  subtitleApp: string;
  orderLabel: string;
  totalLabel: string;
  ctaStorage: string;
  ctaAi: string;
  ctaApp: string;
  printBtn: string;
  downloadBtn: string;
  downloadedToast: string;
  receiptTitle: string;
  infiniteTitle: string;
  infiniteDesc: string;
  renewalCardTitle: string;
  validUntilPrefix: string;
  autoOptionTitle: string;
  autoOptionDefaultTag: string;
  autoOptionDesc: string;
  manualOptionTitle: string;
  manualOptionDesc: string;
  savingChoice: string;
  savedAuto: string;
  savedManual: string;
  manualActiveTitle: string;
  manualOnlyDesc: string;
  manualLinkCardHint: string;
  receiptRenewalLabel: string;
  receiptValidityLabel: string;
  receiptValidityInfinite: string;
}

const COPY_BY_LANG: Record<string, SuccessCopy> = {
  fr: {
    title: 'Paiement réussi !',
    subtitleStorage: 'Votre espace de stockage StudyCloud est activé — profitez-en dès maintenant !',
    subtitleAi: 'Vos crédits IA StudyCloud sont disponibles — bonne création !',
    subtitleApp: 'Votre accès StudyCloud est activé — profitez-en dès maintenant !',
    orderLabel: 'Commande',
    totalLabel: 'Total',
    ctaStorage: 'Accéder à mon stockage',
    ctaAi: 'Utiliser mes crédits',
    ctaApp: "Ouvrir l'application",
    printBtn: 'Imprimer',
    downloadBtn: 'Reçu',
    downloadedToast: 'Reçu téléchargé',
    receiptTitle: 'Reçu de paiement StudyCloud',
    infiniteTitle: 'Abonnement à vie activé sur votre compte',
    infiniteDesc: 'Votre accès est permanent, sans date d’expiration et sans aucun renouvellement à payer.',
    renewalCardTitle: 'Mode de renouvellement',
    validUntilPrefix: 'Valable jusqu’au',
    autoOptionTitle: 'Paiement Automatique',
    autoOptionDefaultTag: 'Par défaut',
    autoOptionDesc: 'Prélèvement automatique à l’échéance sur votre carte. Modifiable à tout moment.',
    manualOptionTitle: 'Paiement Manuel',
    manualOptionDesc: 'Aucun prélèvement automatique. Vous paierez vous-même quand vous le souhaitez.',
    savingChoice: 'Enregistrement de votre choix...',
    savedAuto: 'Renouvellement automatique activé',
    savedManual: 'Renouvellement manuel enregistré (aucun prélèvement auto)',
    manualActiveTitle: 'Renouvellement Manuel activé',
    manualOnlyDesc: 'Aucun prélèvement automatique. Vous pourrez renouveler manuellement votre forfait à l’échéance.',
    manualLinkCardHint:
      'Vous pourrez associer une carte Visa ou Mastercard plus tard dans « Gérer mes abonnements » si vous souhaitez passer en paiement automatique.',
    receiptRenewalLabel: 'Mode de renouvellement',
    receiptValidityLabel: 'Validité',
    receiptValidityInfinite: 'À vie (Sans expiration)',
  },
  en: {
    title: 'Payment Successful!',
    subtitleStorage: 'Your StudyCloud storage plan is active — enjoy it right away!',
    subtitleAi: 'Your StudyCloud AI credits have been added — enjoy!',
    subtitleApp: 'Your StudyCloud access is now unlocked — enjoy!',
    orderLabel: 'Order',
    totalLabel: 'Total',
    ctaStorage: 'Go to my storage',
    ctaAi: 'Use my credits',
    ctaApp: 'Open application',
    printBtn: 'Print Receipt',
    downloadBtn: 'Save Receipt',
    downloadedToast: 'Receipt saved',
    receiptTitle: 'StudyCloud Payment Receipt',
    infiniteTitle: 'Lifetime subscription active on your account',
    infiniteDesc: 'Your access is permanent, with no expiration date and no renewal required.',
    renewalCardTitle: 'Renewal preference',
    validUntilPrefix: 'Valid until',
    autoOptionTitle: 'Automatic Payment',
    autoOptionDefaultTag: 'Default',
    autoOptionDesc: 'Automatically billed on renewal date using your card. Change anytime.',
    manualOptionTitle: 'Manual Payment',
    manualOptionDesc: 'No automatic billing. Renew manually whenever you choose.',
    savingChoice: 'Saving your preference...',
    savedAuto: 'Automatic renewal enabled',
    savedManual: 'Manual renewal saved (no auto-billing)',
    manualActiveTitle: 'Manual Renewal active',
    manualOnlyDesc: 'No automatic billing will occur. You can manually renew when your period ends.',
    manualLinkCardHint:
      'You can link a Visa or Mastercard later in “Manage Subscriptions” if you want automatic billing.',
    receiptRenewalLabel: 'Renewal mode',
    receiptValidityLabel: 'Validity',
    receiptValidityInfinite: 'Lifetime (No expiration)',
  },
  es: {
    title: '¡Pago exitoso!',
    subtitleStorage: 'Tu espacio de almacenamiento StudyCloud ya está activo.',
    subtitleAi: 'Tus créditos de IA StudyCloud han sido acreditados.',
    subtitleApp: 'Tu acceso a StudyCloud ya está desbloqueado.',
    orderLabel: 'Pedido',
    totalLabel: 'Total',
    ctaStorage: 'Ver mi almacenamiento',
    ctaAi: 'Usar mis créditos',
    ctaApp: 'Abrir aplicación',
    printBtn: 'Imprimir',
    downloadBtn: 'Recibo',
    downloadedToast: 'Recibo guardado',
    receiptTitle: 'Recibo de pago StudyCloud',
    infiniteTitle: 'Suscripción de por vida activada en tu cuenta',
    infiniteDesc: 'Tu acceso es permanente, sin fecha de vencimiento y sin renovaciones.',
    renewalCardTitle: 'Modo de renovación',
    validUntilPrefix: 'Válido hasta',
    autoOptionTitle: 'Pago Automático',
    autoOptionDefaultTag: 'Predeterminado',
    autoOptionDesc: 'Cobro automático al vencimiento en tu tarjeta. Modificable en cualquier momento.',
    manualOptionTitle: 'Pago Manual',
    manualOptionDesc: 'Sin cobros automáticos. Renueva manualmente cuando lo desees.',
    savingChoice: 'Guardando tu preferencia...',
    savedAuto: 'Renovación automática activada',
    savedManual: 'Renovación manual guardada (sin cobro automático)',
    manualActiveTitle: 'Renovación Manual activada',
    manualOnlyDesc: 'No se realizará ningún cobro automático. Podrás renovar manualmente al finalizar.',
    manualLinkCardHint:
      'Podrás vincular una tarjeta Visa o Mastercard más adelante en «Gestionar suscripciones» para activar el pago automático.',
    receiptRenewalLabel: 'Renovación',
    receiptValidityLabel: 'Validez',
    receiptValidityInfinite: 'De por vida (Sin vencimiento)',
  },
  pt: {
    title: 'Pagamento concluído!',
    subtitleStorage: 'Seu armazenamento StudyCloud já está ativo!',
    subtitleAi: 'Seus créditos de IA StudyCloud foram adicionados!',
    subtitleApp: 'Seu acesso ao StudyCloud foi desbloqueado!',
    orderLabel: 'Pedido',
    totalLabel: 'Total',
    ctaStorage: 'Ver meu armazenamento',
    ctaAi: 'Usar meus créditos',
    ctaApp: 'Abrir aplicativo',
    printBtn: 'Imprimir',
    downloadBtn: 'Recibo',
    downloadedToast: 'Recibo salvo',
    receiptTitle: 'Recibo de pagamento StudyCloud',
    infiniteTitle: 'Assinatura vitalícia ativada na sua conta',
    infiniteDesc: 'Seu acesso é permanente, sem data de validade e sem renovação.',
    renewalCardTitle: 'Modo de renovação',
    validUntilPrefix: 'Válido até',
    autoOptionTitle: 'Pagamento Automático',
    autoOptionDefaultTag: 'Padrão',
    autoOptionDesc: 'Cobrança automática no vencimento no seu cartão. Alterável a qualquer momento.',
    manualOptionTitle: 'Pagamento Manual',
    manualOptionDesc: 'Sem cobrança automática. Você renova manualmente quando quiser.',
    savingChoice: 'Salvando sua escolha...',
    savedAuto: 'Renovação automática ativada',
    savedManual: 'Renovação manual salva (sem cobrança automática)',
    manualActiveTitle: 'Renovação Manual ativada',
    manualOnlyDesc: 'Nenhuma cobrança automática será feita. Você poderá renovar manualmente no vencimento.',
    manualLinkCardHint:
      'Você poderá adicionar um cartão Visa ou Mastercard depois em «Gerenciar assinaturas» para ativar o pagamento automático.',
    receiptRenewalLabel: 'Renovação',
    receiptValidityLabel: 'Validade',
    receiptValidityInfinite: 'Vitalício (Sem validade)',
  },
};

function resolveNetworkLogo(networkLabel?: string): string {
  const s = String(networkLabel || '').toLowerCase();
  if (s.includes('wave')) return '/payment-logos/wave.jpg';
  if (s.includes('orange')) return '/payment-logos/orange-money.png';
  if (s.includes('mtn') || s.includes('momo')) return '/payment-logos/mtn.jpg';
  return '/payment-logos/visa-mastercard.png';
}

function escapeHtmlBasic(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEndDateTime(iso: string | null | undefined, lang: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'pt' ? 'pt-BR' : 'fr-FR';
    const datePart = d.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return lang === 'en' ? `${datePart} at ${timePart}` : `${datePart} à ${timePart}`;
  } catch {
    return null;
  }
}

export const PaymentSuccessCelebration: React.FC<PaymentSuccessCelebrationProps> = ({
  productName,
  productType = 'storage',
  amount,
  currency = 'XOF',
  reference,
  networkLabel = 'Paystack',
  deliverySummary,
  ctaLabel,
  billingMode,
  durationDays,
  entitlementExpiresAt,
  subscription,
  paymentMethod,
  renewalUiConfig,
  onRenewalModeChanged,
  onContinue,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const renewalState = useMemo(
    () =>
      resolveSuccessScreenRenewalState({
        subscription,
        paymentMethod,
        renewalUiConfig,
        billingMode,
        durationDays,
        networkLabel,
        entitlementExpiresAt,
      }),
    [subscription, paymentMethod, renewalUiConfig, billingMode, durationDays, networkLabel, entitlementExpiresAt]
  );

  const [selectedRenewalMode, setSelectedRenewalMode] = useState<SubscriptionRenewalMode>(
    renewalState.initialMode
  );
  const [savingRenewal, setSavingRenewal] = useState(false);
  const [renewalSavedOnce, setRenewalSavedOnce] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  const lang = getCurrentLanguage();
  const t = COPY_BY_LANG[lang] || COPY_BY_LANG.fr;

  const formattedEndDate = useMemo(
    () => formatEndDateTime(renewalState.endsAtIso, lang),
    [renewalState.endsAtIso, lang]
  );

  const handleSelectRenewalMode = async (nextMode: 'auto' | 'manual') => {
    if (savingRenewal || selectedRenewalMode === nextMode) return;
    if (!renewalState.subscriptionId) return;

    const previousMode = selectedRenewalMode;
    setSelectedRenewalMode(nextMode);
    setRenewalError(null);
    setSavingRenewal(true);

    try {
      const res = await updateSubscriptionRenewalMode(
        renewalState.subscriptionId,
        nextMode,
        paymentMethod?.id
      );
      if (!res.success) {
        setSelectedRenewalMode(previousMode);
        setRenewalError(res.error || 'Impossible de modifier le mode de renouvellement.');
      } else {
        const finalMode = res.renewalMode || nextMode;
        setSelectedRenewalMode(finalMode);
        setRenewalSavedOnce(true);
        if (onRenewalModeChanged) {
          onRenewalModeChanged(finalMode, res.subscription || null);
        }
        try {
          window.dispatchEvent(
            new CustomEvent('studycloud_subscription_updated', {
              detail: res.subscription || { id: renewalState.subscriptionId, renewal_mode: finalMode },
            })
          );
        } catch {
          // Ignore
        }
      }
    } catch (err: any) {
      setSelectedRenewalMode(previousMode);
      setRenewalError(err?.message || 'Erreur réseau lors de la sauvegarde.');
    } finally {
      setSavingRenewal(false);
    }
  };

  const subtitle =
    deliverySummary && lang === 'fr'
      ? deliverySummary
      : productType === 'ai'
      ? t.subtitleAi
      : productType === 'app'
      ? t.subtitleApp
      : t.subtitleStorage;

  const formattedAmount = formatCurrencyAmount(amount, currency);
  const shortRef = reference ? `#${reference.slice(-8)}` : '#SC';
  const logoSrc = resolveNetworkLogo(networkLabel);

  const buildPrintableReceiptHtml = () => {
    const dateStr = new Date().toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
    const receiptRenewalText = renewalState.isInfinite
      ? t.receiptValidityInfinite
      : selectedRenewalMode === 'auto'
      ? `${t.autoOptionTitle} (${renewalState.cardLabel})`
      : t.manualOptionTitle;
    const receiptValidityText = renewalState.isInfinite
      ? t.receiptValidityInfinite
      : formattedEndDate
      ? `${t.validUntilPrefix} ${formattedEndDate}`
      : `${renewalState.durationDays} jours`;

    return `<!doctype html>
<html lang="${escapeHtmlBasic(lang)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtmlBasic(t.receiptTitle)} - ${escapeHtmlBasic(reference)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7f6; padding: 32px; color: #111827; }
    .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .brand { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
    .brand span.o { color: #f97316; } .brand span.b { color: #0ea5e9; }
    .sub { font-size: 10px; letter-spacing: 2px; color: #f59e0b; font-weight: 800; text-transform: uppercase; margin-bottom: 24px; }
    .badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 13px; margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; gap: 12px; }
    .row .k { color: #64748b; } .row .v { font-weight: 700; text-align: right; }
    .total { font-size: 18px; font-weight: 900; color: #16a34a; }
    .foot { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="o">Study</span><span class="b">Cloud</span></div>
    <div class="sub">DKD TECHNOLOGIES</div>
    <div class="badge">✓ ${escapeHtmlBasic(t.title)}</div>
    <div class="row"><span class="k">Offre</span><span class="v">${escapeHtmlBasic(productName)}</span></div>
    <div class="row"><span class="k">${escapeHtmlBasic(t.orderLabel)}</span><span class="v">${escapeHtmlBasic(reference)}</span></div>
    <div class="row"><span class="k">Moyen de paiement</span><span class="v">${escapeHtmlBasic(networkLabel)}</span></div>
    <div class="row"><span class="k">${escapeHtmlBasic(t.receiptRenewalLabel)}</span><span class="v">${escapeHtmlBasic(receiptRenewalText)}</span></div>
    <div class="row"><span class="k">${escapeHtmlBasic(t.receiptValidityLabel)}</span><span class="v">${escapeHtmlBasic(receiptValidityText)}</span></div>
    <div class="row"><span class="k">Date</span><span class="v">${escapeHtmlBasic(dateStr)}</span></div>
    <div class="row"><span class="k">${escapeHtmlBasic(t.totalLabel)}</span><span class="v total">${escapeHtmlBasic(formattedAmount)}</span></div>
    <div class="foot">StudyCloud · DKD Technologies — ${escapeHtmlBasic(t.receiptTitle)}</div>
  </div>
</body>
</html>`;
  };

  const handlePrintReceipt = () => {
    try {
      const win = window.open('', '_blank', 'width=640,height=720');
      if (!win) {
        window.print();
        return;
      }
      win.document.write(buildPrintableReceiptHtml());
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
          // Ignore
        }
      }, 250);
    } catch {
      window.print();
    }
  };

  const handleDownloadReceipt = () => {
    try {
      const blob = new Blob([buildPrintableReceiptHtml()], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recu-studycloud-${reference || Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch {
      // Ignore
    }
  };

  const resolvedCtaLabel =
    ctaLabel ||
    (productType === 'ai' ? t.ctaAi : productType === 'app' ? t.ctaApp : t.ctaStorage);

  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center px-5 py-8 sm:py-10 overflow-y-auto bg-gradient-to-b from-[#BCECD9] via-[#DCF5EA] to-[#CBEFD9] dark:from-[#081C15] dark:via-[#0D2B20] dark:to-[#071812] text-stone-900 dark:text-white select-none">
      {/* Halos lumineux & étincelles douces en arrière-plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-white/35 dark:bg-emerald-400/10 blur-3xl" />
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-white/50 dark:border-emerald-300/15 animate-pulse" />
        <span className="absolute left-[24%] top-[18%] w-2 h-2 rounded-full bg-white/80 dark:bg-emerald-300/60 shadow-sm animate-pulse" />
        <span className="absolute right-[26%] top-[16%] w-1.5 h-1.5 rounded-full bg-white/90 dark:bg-emerald-200/70 animate-bounce" />
        <span className="absolute left-[31%] top-[34%] w-2.5 h-2.5 rounded-full bg-white/70 dark:bg-emerald-300/50 animate-pulse" />
        <span className="absolute right-[28%] top-[32%] w-2 h-2 rounded-full bg-white/80 dark:bg-emerald-200/60" />
        <span className="absolute left-[18%] top-[28%] w-1.5 h-1.5 rounded-full bg-white/75" />
        <span className="absolute right-[20%] top-[24%] w-2.5 h-2.5 rounded-full bg-white/65" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center space-y-5 animate-fadeIn">
        {/* Grand cercle vert dégradé avec coche blanche */}
        <div className="relative flex items-center justify-center">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white/30 dark:bg-emerald-400/10 flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.28)]">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#6EE787] via-[#2ED573] to-[#12B886] flex items-center justify-center shadow-[0_14px_34px_rgba(16,185,129,0.42)]">
              <Check className="w-12 h-12 sm:w-14 sm:h-14 text-white stroke-[3.5]" />
            </div>
          </div>
        </div>

        {/* Titre & Sous-titre adaptés à la langue et à StudyCloud */}
        <div className="space-y-1.5 px-2">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-950 dark:text-white">
            {t.title}
          </h2>
          <p className="text-sm sm:text-base font-medium text-stone-700 dark:text-emerald-100/85 leading-relaxed max-w-sm mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Carte récapitulative verre dépoli */}
        <div className="w-full rounded-2xl bg-white/75 dark:bg-white/10 backdrop-blur-md border border-white/85 dark:border-emerald-300/20 shadow-[0_8px_30px_rgba(16,185,129,0.12)] px-5 py-4 flex items-center justify-between gap-4 text-left">
          <div className="min-w-0 space-y-1.5">
            <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white truncate">
              {productName}{' '}
              <span className="text-xs font-mono font-bold text-stone-500 dark:text-emerald-200/70">
                {shortRef}
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-stone-950 dark:text-emerald-300 tabular-nums">
              {t.totalLabel} : {formattedAmount}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="w-10 h-7 rounded-lg overflow-hidden bg-white border border-stone-200/80 shadow-xs flex items-center justify-center p-0.5">
              <img
                src={logoSrc}
                alt={networkLabel}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/8 dark:bg-emerald-400/15 text-[11px] font-bold text-stone-700 dark:text-emerald-200 whitespace-nowrap">
              {networkLabel}
            </span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* CARTE DE RENOUVELLEMENT / ABONNEMENT À VIE (ÉTAPE 3)                */}
        {/* =================================================================== */}
        {renewalState.variant === 'infinite' ? (
          <div className="w-full rounded-2xl bg-gradient-to-br from-amber-50/95 via-white/90 to-emerald-50/90 dark:from-amber-500/15 dark:via-emerald-950/60 dark:to-emerald-900/40 backdrop-blur-md border border-amber-300/80 dark:border-amber-400/35 shadow-[0_8px_24px_rgba(245,158,11,0.14)] px-4 py-3.5 text-left flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <InfinityIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                {t.infiniteTitle}
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-stone-700 dark:text-emerald-100/80 leading-relaxed">
                {t.infiniteDesc}
              </p>
            </div>
          </div>
        ) : renewalState.variant === 'interactive_auto_manual' ? (
          <div className="w-full rounded-2xl bg-white/85 dark:bg-white/10 backdrop-blur-md border border-white/95 dark:border-emerald-300/25 shadow-[0_10px_30px_rgba(16,185,129,0.14)] p-4 text-left space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-stone-900 dark:text-white">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                <span>{t.renewalCardTitle}</span>
              </div>
              {formattedEndDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 text-[10.5px] font-bold">
                  <CalendarClock className="w-3 h-3 shrink-0" />
                  <span>
                    {t.validUntilPrefix} {formattedEndDate}
                  </span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* Option 1 : Automatique (cochée par défaut pour Visa/Mastercard) */}
              <button
                type="button"
                disabled={savingRenewal}
                onClick={() => handleSelectRenewalMode('auto')}
                aria-pressed={selectedRenewalMode === 'auto'}
                className={`w-full rounded-xl p-3 border-2 transition-all flex items-start gap-3 text-left cursor-pointer disabled:opacity-70 ${
                  selectedRenewalMode === 'auto'
                    ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-500/20 shadow-xs'
                    : 'border-stone-200/90 dark:border-white/15 bg-white/60 dark:bg-white/5 hover:border-emerald-300 dark:hover:border-emerald-400/40'
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                    selectedRenewalMode === 'auto'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-stone-300 dark:border-emerald-200/40 bg-white dark:bg-transparent'
                  }`}
                >
                  {selectedRenewalMode === 'auto' && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-stone-950 dark:text-white">
                      {t.autoOptionTitle}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-600/15 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-200 text-[9.5px] font-black">
                      {renewalState.cardLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-stone-900/8 dark:bg-white/10 text-stone-600 dark:text-emerald-100/80 text-[9.5px] font-bold">
                      {t.autoOptionDefaultTag}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-emerald-100/75 leading-snug">
                    {t.autoOptionDesc}
                  </p>
                </div>
              </button>

              {/* Option 2 : Manuel (l'utilisateur peut basculer ici s'il préfère payer lui-même) */}
              <button
                type="button"
                disabled={savingRenewal}
                onClick={() => handleSelectRenewalMode('manual')}
                aria-pressed={selectedRenewalMode === 'manual'}
                className={`w-full rounded-xl p-3 border-2 transition-all flex items-start gap-3 text-left cursor-pointer disabled:opacity-70 ${
                  selectedRenewalMode === 'manual'
                    ? 'border-sky-500 bg-sky-50/90 dark:bg-sky-500/20 shadow-xs'
                    : 'border-stone-200/90 dark:border-white/15 bg-white/60 dark:bg-white/5 hover:border-sky-300 dark:hover:border-sky-400/40'
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                    selectedRenewalMode === 'manual'
                      ? 'bg-sky-600 border-sky-600 text-white'
                      : 'border-stone-300 dark:border-emerald-200/40 bg-white dark:bg-transparent'
                  }`}
                >
                  {selectedRenewalMode === 'manual' && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-stone-950 dark:text-white">
                      {t.manualOptionTitle}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-emerald-100/75 leading-snug">
                    {t.manualOptionDesc}
                  </p>
                </div>
              </button>
            </div>

            {savingRenewal && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{t.savingChoice}</span>
              </div>
            )}

            {!savingRenewal && renewalSavedOnce && !renewalError && (
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                <span>{selectedRenewalMode === 'auto' ? t.savedAuto : t.savedManual}</span>
              </div>
            )}

            {renewalError && (
              <div className="flex items-start gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{renewalError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/90 dark:border-emerald-300/20 shadow-[0_8px_24px_rgba(16,185,129,0.1)] px-4 py-3.5 text-left space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-stone-900 dark:text-white">
                <RefreshCw className="w-4 h-4 text-sky-600 dark:text-sky-300 shrink-0" />
                <span>{t.manualActiveTitle}</span>
              </div>
              {formattedEndDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 text-[10.5px] font-bold">
                  <CalendarClock className="w-3 h-3 shrink-0" />
                  <span>
                    {t.validUntilPrefix} {formattedEndDate}
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-stone-700 dark:text-emerald-100/80 leading-relaxed">
              {renewalState.variant === 'manual_can_link_card'
                ? t.manualLinkCardHint
                : t.manualOnlyDesc}
            </p>
          </div>
        )}

        {/* Barre d'actions inférieure : Bouton accès direct + Imprimer + Télécharger reçu (sans conditions d'utilisation) */}
        <div className="w-full flex items-start justify-center gap-3 pt-1">
          <button
            type="button"
            disabled={savingRenewal}
            onClick={onContinue}
            className="flex-1 max-w-[260px] py-3.5 px-6 rounded-full bg-white hover:bg-stone-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-stone-950 dark:text-stone-950 font-extrabold text-sm shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer whitespace-nowrap disabled:opacity-65"
          >
            <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-stone-950 shrink-0" />
            <span>{resolvedCtaLabel}</span>
          </button>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="w-12 h-12 rounded-full bg-white hover:bg-stone-50 dark:bg-white/15 dark:hover:bg-white/25 text-emerald-700 dark:text-emerald-200 shadow-[0_6px_18px_rgba(0,0,0,0.07)] flex items-center justify-center transition active:scale-95 cursor-pointer"
              title={t.printBtn}
              aria-label={t.printBtn}
            >
              <Printer className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-bold text-stone-700 dark:text-emerald-100/80">
              {t.printBtn}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="w-12 h-12 rounded-full bg-white hover:bg-stone-50 dark:bg-white/15 dark:hover:bg-white/25 text-emerald-700 dark:text-emerald-200 shadow-[0_6px_18px_rgba(0,0,0,0.07)] flex items-center justify-center transition active:scale-95 cursor-pointer"
              title={t.downloadBtn}
              aria-label={t.downloadBtn}
            >
              {downloaded ? <Check className="w-5 h-5 text-emerald-600" /> : <Download className="w-5 h-5" />}
            </button>
            <span className="text-[10px] font-bold text-stone-700 dark:text-emerald-100/80">
              {downloaded ? t.downloadedToast : t.downloadBtn}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
