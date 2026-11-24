import React, { useState } from 'react';
import { ArrowRight, Check, Printer, Download } from 'lucide-react';
import { getCurrentLanguage } from '../services/languageService';
import { formatCurrencyAmount, PaymentProductType } from '../services/paystackBillingApi';

export interface PaymentSuccessCelebrationProps {
  productName: string;
  productType?: PaymentProductType;
  amount: number;
  currency?: string;
  reference: string;
  networkLabel?: string;
  deliverySummary?: string;
  ctaLabel?: string;
  onContinue: () => void;
}

interface SuccessCopy {
  title: string;
  subtitleStorage: string;
  subtitleAi: string;
  subtitleApp: string;
  orderLabel: string;
  totalLabel: string;
  continueBtn: string;
  printBtn: string;
  downloadBtn: string;
  downloadedToast: string;
  receiptTitle: string;
}

const COPY_BY_LANG: Record<string, SuccessCopy> = {
  fr: {
    title: 'Paiement réussi !',
    subtitleStorage: 'Votre espace de stockage StudyCloud est activé — profitez-en dès maintenant !',
    subtitleAi: 'Vos crédits IA StudyCloud sont disponibles — bonne création !',
    subtitleApp: 'Votre accès StudyCloud est activé — profitez-en dès maintenant !',
    orderLabel: 'Commande',
    totalLabel: 'Total',
    continueBtn: 'Continuer',
    printBtn: 'Imprimer',
    downloadBtn: 'Reçu',
    downloadedToast: 'Reçu téléchargé',
    receiptTitle: 'Reçu de paiement StudyCloud',
  },
  en: {
    title: 'Payment Successful!',
    subtitleStorage: 'Your StudyCloud storage plan is active — enjoy it right away!',
    subtitleAi: 'Your StudyCloud AI credits have been added — enjoy!',
    subtitleApp: 'Your StudyCloud access is now unlocked — enjoy!',
    orderLabel: 'Order',
    totalLabel: 'Total',
    continueBtn: 'Continue',
    printBtn: 'Print Receipt',
    downloadBtn: 'Save Receipt',
    downloadedToast: 'Receipt saved',
    receiptTitle: 'StudyCloud Payment Receipt',
  },
  es: {
    title: '¡Pago exitoso!',
    subtitleStorage: 'Tu espacio de almacenamiento StudyCloud ya está activo.',
    subtitleAi: 'Tus créditos de IA StudyCloud han sido acreditados.',
    subtitleApp: 'Tu acceso a StudyCloud ya está desbloqueado.',
    orderLabel: 'Pedido',
    totalLabel: 'Total',
    continueBtn: 'Continuar',
    printBtn: 'Imprimir',
    downloadBtn: 'Recibo',
    downloadedToast: 'Recibo guardado',
    receiptTitle: 'Recibo de pago StudyCloud',
  },
  pt: {
    title: 'Pagamento concluído!',
    subtitleStorage: 'Seu armazenamento StudyCloud já está ativo!',
    subtitleAi: 'Seus créditos de IA StudyCloud foram adicionados!',
    subtitleApp: 'Seu acesso ao StudyCloud foi desbloqueado!',
    orderLabel: 'Pedido',
    totalLabel: 'Total',
    continueBtn: 'Continuar',
    printBtn: 'Imprimir',
    downloadBtn: 'Recibo',
    downloadedToast: 'Recibo salvo',
    receiptTitle: 'Recibo de pagamento StudyCloud',
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

export const PaymentSuccessCelebration: React.FC<PaymentSuccessCelebrationProps> = ({
  productName,
  productType = 'storage',
  amount,
  currency = 'XOF',
  reference,
  networkLabel = 'Paystack',
  deliverySummary,
  ctaLabel,
  onContinue,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const lang = getCurrentLanguage();
  const t = COPY_BY_LANG[lang] || COPY_BY_LANG.fr;

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
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
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

  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center px-5 py-10 overflow-hidden bg-gradient-to-b from-[#BCECD9] via-[#DCF5EA] to-[#CBEFD9] dark:from-[#081C15] dark:via-[#0D2B20] dark:to-[#071812] text-stone-900 dark:text-white select-none">
      {/* Halos lumineux & étincelles douces en arrière-plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-white/35 dark:bg-emerald-400/10 blur-3xl" />
        <div className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-white/50 dark:border-emerald-300/15 animate-pulse" />
        <span className="absolute left-[24%] top-[20%] w-2 h-2 rounded-full bg-white/80 dark:bg-emerald-300/60 shadow-sm animate-pulse" />
        <span className="absolute right-[26%] top-[18%] w-1.5 h-1.5 rounded-full bg-white/90 dark:bg-emerald-200/70 animate-bounce" />
        <span className="absolute left-[31%] top-[38%] w-2.5 h-2.5 rounded-full bg-white/70 dark:bg-emerald-300/50 animate-pulse" />
        <span className="absolute right-[28%] top-[36%] w-2 h-2 rounded-full bg-white/80 dark:bg-emerald-200/60" />
        <span className="absolute left-[18%] top-[32%] w-1.5 h-1.5 rounded-full bg-white/75" />
        <span className="absolute right-[20%] top-[27%] w-2.5 h-2.5 rounded-full bg-white/65" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center space-y-6 animate-fadeIn">
        {/* Grand cercle vert dégradé avec coche blanche */}
        <div className="relative flex items-center justify-center">
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-white/30 dark:bg-emerald-400/10 flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.28)]">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#6EE787] via-[#2ED573] to-[#12B886] flex items-center justify-center shadow-[0_14px_34px_rgba(16,185,129,0.42)]">
              <Check className="w-14 h-14 sm:w-16 sm:h-16 text-white stroke-[3.5]" />
            </div>
          </div>
        </div>

        {/* Titre & Sous-titre adaptés à la langue et à StudyCloud */}
        <div className="space-y-2 px-2">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-950 dark:text-white">
            {t.title}
          </h2>
          <p className="text-sm sm:text-base font-medium text-stone-700 dark:text-emerald-100/85 leading-relaxed max-w-sm mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Trois petits points décoratifs */}
        <div className="flex items-center justify-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full bg-white/90 dark:bg-emerald-300/60" />
          <span className="w-2 h-2 rounded-full bg-white/70 dark:bg-emerald-300/40" />
          <span className="w-2 h-2 rounded-full bg-white/50 dark:bg-emerald-300/25" />
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

        {/* Barre d'actions inférieure : Bouton Continuer + Imprimer + Télécharger reçu */}
        <div className="w-full flex items-start justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 max-w-[230px] py-3.5 px-6 rounded-full bg-white hover:bg-stone-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-stone-950 dark:text-stone-950 font-extrabold text-sm shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-stone-950" />
            <span>{ctaLabel || t.continueBtn}</span>
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
