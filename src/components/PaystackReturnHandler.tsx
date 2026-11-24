import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  consumePendingPaystackReturnContext,
  extractPaystackReturnReference,
  PendingPaystackReturnContext,
  verifyPaystackPayment,
  VerifyPaystackResponse,
} from '../services/paystackBillingApi';
import { PaymentSuccessCelebration } from './PaymentSuccessCelebration';

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

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[99995] overflow-y-auto animate-fadeIn">
        <PaymentSuccessCelebration
          productName={tx?.product_name || returnCtx?.productName || 'StudyCloud'}
          productType={tx?.product_type || returnCtx?.productType || 'storage'}
          amount={tx ? tx.paid_amount || tx.expected_amount : 0}
          currency={tx?.currency || 'XOF'}
          reference={tx?.reference || reference}
          networkLabel={tx?.network_label || 'Paystack'}
          deliverySummary={result?.deliverySummary}
          onContinue={handleClose}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99995] bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-[#16110E] border border-orange-200 dark:border-stone-700 rounded-2xl shadow-2xl overflow-hidden text-stone-900 dark:text-stone-100">
        <div className="px-5 py-4 border-b border-orange-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span>Confirmation de paiement</span>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 text-center space-y-4">
          {loading ? (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/15 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold">Vérification en cours...</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Confirmation de votre règlement...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-amber-600 dark:text-amber-400">
                  Paiement en attente
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  {result?.error ||
                    "Si vous venez de valider sur Mobile Money, cliquez sur « Revérifier » dans quelques secondes."}
                </p>
                <div className="text-[11px] font-mono text-stone-400 pt-1">Réf. {reference}</div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-xs font-bold cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => runVerification(reference)}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
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
