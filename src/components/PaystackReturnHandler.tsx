import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  consumePendingPaystackReturnContext,
  extractPaystackReturnReference,
  formatCurrencyAmount,
  PendingPaystackReturnContext,
  verifyPaystackPayment,
  VerifyPaystackResponse,
} from '../services/paystackBillingApi';

interface PaystackReturnHandlerProps {
  isAuthenticated: boolean;
  onNavigateAfterPayment?: (ctx: PendingPaystackReturnContext | null, res: VerifyPaystackResponse) => void;
}

export const PaystackReturnHandler: React.FC<PaystackReturnHandlerProps> = ({
  isAuthenticated,
  onNavigateAfterPayment,
}) => {
  const [reference, setReference] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractPaystackReturnReference(window.location.search);
  });
  const [returnCtx, setReturnCtx] = useState<PendingPaystackReturnContext | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerifyPaystackResponse | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const runVerification = useCallback(async (refToVerify: string) => {
    setLoading(true);
    try {
      const res = await verifyPaystackPayment(refToVerify);
      setResult(res);
      if (res.success && res.verified) {
        try {
          window.dispatchEvent(new CustomEvent('studycloud_refresh_storage_quota'));
          window.dispatchEvent(new CustomEvent('studycloud_payment_verified', { detail: res }));
        } catch {
          // Ignore
        }
      }
    } catch (err: any) {
      setResult({
        success: false,
        verified: false,
        error: err?.message || 'Erreur réseau lors de la vérification du paiement.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !reference) return;

    const ctx = consumePendingPaystackReturnContext();
    if (ctx) setReturnCtx(ctx);

    // Nettoyer l'URL proprement pour éviter une revérification en boucle si l'utilisateur recharge
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('reference');
      url.searchParams.delete('trxref');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch {
      // Ignore
    }

    runVerification(reference);
  }, [isAuthenticated, reference, runVerification]);

  if (!reference || dismissed || !isAuthenticated) return null;

  const isSuccess = Boolean(result?.success && result?.verified);
  const tx = result?.transaction;

  const handleClose = () => {
    setDismissed(true);
    if (isSuccess && result && onNavigateAfterPayment) {
      onNavigateAfterPayment(returnCtx, result);
    }
    setReference(null);
  };

  return (
    <div className="fixed inset-0 z-[99995] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Confirmation de paiement Paystack</span>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 text-center space-y-4">
          {loading ? (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/15 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold">Vérification en cours...</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  StudyCloud confirme votre règlement auprès de Paystack et active votre accès.
                </p>
              </div>
            </>
          ) : isSuccess ? (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  Paiement confirmé !
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {result?.deliverySummary ||
                    result?.message ||
                    'Votre achat a été validé et appliqué immédiatement à votre compte.'}
                </p>
              </div>

              {tx && (
                <div className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Offre</span>
                    <span className="font-bold text-right">{tx.product_name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Montant payé</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyAmount(tx.paid_amount || tx.expected_amount, tx.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Réseau utilisé</span>
                    <span className="font-bold">{tx.network_label || 'Paystack'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Référence</span>
                    <span className="font-mono text-[11px]">{tx.reference}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg transition cursor-pointer"
              >
                {returnCtx?.appKey === 'moyennes' || tx?.app_key === 'moyennes'
                  ? 'Ouvrir Moyennes maintenant'
                  : 'Continuer sur StudyCloud'}
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-amber-600 dark:text-amber-400">
                  Paiement non encore confirmé
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {result?.error ||
                    "Si vous venez de valider sur Mobile Money, cliquez sur « Revérifier » dans quelques secondes."}
                </p>
                <div className="text-[11px] font-mono text-slate-400 pt-1">Réf. {reference}</div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => runVerification(reference)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Revérifier</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
