/**
 * StudyCloud — Client API Paiements Paystack, Configuration Passerelle & Accès Applications
 *
 * - Toutes les vérifications de prix et d'accès s'effectuent côté serveur (Cloudflare Worker + D1).
 * - Aucune clé secrète Paystack n'existe dans le frontend.
 * - Respecte strictement les interrupteurs administrateur (`paystackEnabled`, `manualReceiptEnabled`).
 */

import { getWorkerApiUrl } from './api';

export type ClientBillingMode = 'auto' | 'manual' | 'infinite';
export type PaymentProductType = 'storage' | 'ai' | 'app';

export interface PaymentGatewayConfig {
  provider: string;
  paystackEnabled: boolean;
  manualReceiptEnabled: boolean;
  defaultCurrency: string;
  callbackUrl: string;
  mode: 'test' | 'live' | 'unconfigured';
}

export interface MonetizedAppRecord {
  app_key: string;
  name: string;
  icon: string;
  description: string;
  is_paid: number;
  trial_days: number;
  grace_period_days: number;
  is_active: number;
  sort_order?: number;
}

export interface AppSubscriptionPlanRecord {
  id: string;
  app_key: string;
  name: string;
  badge?: string;
  description?: string;
  price: number;
  primary_currency: string;
  currencies_enabled: string | string[];
  currency_conversions: string | Record<string, number>;
  yearly_price?: number;
  yearly_discount_pct?: number;
  billing_mode: ClientBillingMode;
  duration_days: number;
  is_auto_billing: number;
  features: string | Array<{ text: string; enabled?: boolean }>;
  is_active: number;
  sort_order?: number;
}

export interface UserAppEntitlementRecord {
  id: string;
  user_id: string;
  app_key: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'trial' | 'grace' | 'expired' | 'revoked';
  access_type: string;
  starts_at: string;
  expires_at: string | null;
  grace_until: string | null;
  auto_renew: number;
  last_transaction_ref?: string;
}

export interface AppAccessResponse {
  success: boolean;
  allowed: boolean;
  isPaidApp: boolean;
  status: 'free' | 'active' | 'trial' | 'grace' | 'expired' | 'revoked' | 'none';
  reason?: string;
  app: MonetizedAppRecord | null;
  entitlement: UserAppEntitlementRecord | null;
  canStartTrial: boolean;
  daysRemaining: number | null;
  plans: AppSubscriptionPlanRecord[];
  paymentConfig: PaymentGatewayConfig;
}

export type MobileMoneyProvider = 'wave' | 'orange' | 'mtn';

export interface InitializePaystackPayload {
  productType: PaymentProductType;
  productId: string;
  billingCycle?: 'monthly' | 'annual' | 'one_time' | 'infinite';
  currency?: string;
  preferAutoCard?: boolean;
  channelOnly?: 'card' | 'mobile_money';
  phone?: string;
  returnOrigin?: string;
}

export interface ChargeMobilePayload {
  productType: PaymentProductType;
  productId: string;
  billingCycle?: 'monthly' | 'annual' | 'one_time' | 'infinite';
  provider: MobileMoneyProvider;
  phone: string;
  countryIso?: string;
}

export interface ChargeMobileResponse {
  success: boolean;
  chargeStatus?: 'success' | 'send_otp' | 'open_url' | 'pay_offline' | 'failed';
  verified?: boolean;
  alreadyFulfilled?: boolean;
  reference?: string;
  provider?: MobileMoneyProvider;
  networkLabel?: string;
  amount?: number;
  currency?: string;
  displayText?: string;
  openUrl?: string;
  deliverySummary?: string;
  transaction?: VerifyPaystackResponse['transaction'];
  mode?: 'test' | 'live' | 'unconfigured';
  fallbackSuggested?: boolean;
  error?: string;
}

export interface InitializePaystackResponse {
  success: boolean;
  reference?: string;
  accessCode?: string;
  authorizationUrl?: string;
  amount?: number;
  amountMinor?: number;
  currency?: string;
  billingMode?: ClientBillingMode;
  durationDays?: number;
  mode?: 'test' | 'live' | 'unconfigured';
  error?: string;
}

export interface VerifyPaystackResponse {
  success: boolean;
  verified?: boolean;
  alreadyFulfilled?: boolean;
  status?: string;
  deliverySummary?: string;
  message?: string;
  error?: string;
  transaction?: {
    reference: string;
    product_type: PaymentProductType;
    product_id: string;
    product_name: string;
    app_key?: string;
    app_name?: string;
    billing_mode: ClientBillingMode;
    duration_days: number;
    expected_amount: number;
    paid_amount: number;
    currency: string;
    provider: string;
    channel?: string;
    network_label?: string;
    status: string;
    fulfilled_at?: string | null;
    granted_storage_mb?: number;
    granted_ai_credits?: number;
    entitlement_expires_at?: string | null;
  };
}

export interface PendingPaystackReturnContext {
  productType: PaymentProductType;
  productId: string;
  productName: string;
  appKey?: string;
  createdAt: number;
}

const PENDING_RETURN_CTX_KEY = 'studycloud_paystack_return_ctx_v1';

export const DEFAULT_PAYMENT_GATEWAY_CONFIG: PaymentGatewayConfig = {
  provider: 'paystack',
  paystackEnabled: true,
  manualReceiptEnabled: true,
  defaultCurrency: 'XOF',
  callbackUrl: 'https://studycloud.dkd-technologies.com/?payment=paystack-return',
  mode: 'test',
};

// ============================================================================
// HELPERS PURS (TESTABLES UNITAIREMENT)
// ============================================================================

export function normalizeClientBillingMode(
  rawMode?: unknown,
  isAutoFallback?: unknown,
  pricingModelFallback?: unknown
): ClientBillingMode {
  const s = String(rawMode || '').trim().toLowerCase();
  if (s === 'auto' || s === 'automatic' || s === 'automatique') return 'auto';
  if (s === 'infinite' || s === 'infini' || s === 'lifetime' || s === 'illimite' || s === 'illimité') {
    return 'infinite';
  }
  if (s === 'manual' || s === 'manuel') return 'manual';
  if (Number(isAutoFallback) === 1 || isAutoFallback === true) return 'auto';
  const pm = String(pricingModelFallback || '').trim().toLowerCase();
  if (pm === 'one_time' || pm === 'pack' || pm === 'lifetime') return 'infinite';
  return 'manual';
}

export function formatDurationLabel(durationDays?: number | null): string {
  const d = Math.max(1, Math.round(Number(durationDays || 30)));
  if (d === 7) return '7 jours';
  if (d === 30) return '30 jours (1 mois)';
  if (d === 90) return '90 jours (Trimestre)';
  if (d === 180) return '180 jours (6 mois)';
  if (d === 365) return '365 jours (1 an)';
  return `${d} jour${d > 1 ? 's' : ''}`;
}

export function formatBillingDurationBadge(
  rawMode?: unknown,
  durationDays?: number | null,
  isAutoFallback?: unknown,
  pricingModelFallback?: unknown
): {
  mode: ClientBillingMode;
  label: string;
  shortLabel: string;
  tone: 'amber' | 'emerald' | 'sky';
} {
  const mode = normalizeClientBillingMode(rawMode, isAutoFallback, pricingModelFallback);
  if (mode === 'infinite') {
    return {
      mode,
      label: '♾️ Accès à vie (Infini)',
      shortLabel: '♾️ Infini',
      tone: 'amber',
    };
  }
  const safeDays = Math.max(1, Math.round(Number(durationDays || 30)));
  if (mode === 'auto') {
    return {
      mode,
      label: `⚡ Automatique · ${formatDurationLabel(safeDays)}`,
      shortLabel: `⚡ Auto · ${safeDays}j`,
      tone: 'emerald',
    };
  }
  return {
    mode,
    label: `🔄 Durée fixe · ${formatDurationLabel(safeDays)}`,
    shortLabel: `🔄 ${safeDays}j`,
    tone: 'sky',
  };
}

export function formatCurrencyAmount(amount: number, currency = 'XOF'): string {
  const cur = String(currency || 'XOF').toUpperCase();
  const safe = Number(amount) || 0;
  if (cur === 'XOF' || cur === 'FCFA') {
    return `${Math.round(safe).toLocaleString('fr-FR')} FCFA`;
  }
  if (cur === 'EUR') {
    return `${safe % 1 === 0 ? safe.toFixed(0) : safe.toFixed(2)} €`;
  }
  if (cur === 'USD') {
    return `$${safe % 1 === 0 ? safe.toFixed(0) : safe.toFixed(2)}`;
  }
  return `${safe.toLocaleString('fr-FR')} ${cur}`;
}

/**
 * Détermine si le bouton « Payer manuellement (envoyer un reçu) » doit être affiché.
 * Respecte strictement le bouton ON/OFF configuré par l'administrateur dans le Tableau de Bord.
 */
export function shouldShowManualReceiptButton(
  config: Pick<PaymentGatewayConfig, 'manualReceiptEnabled'> | null | undefined,
  hasManualFallback: boolean
): boolean {
  if (!hasManualFallback) return false;
  if (!config) return false;
  return config.manualReceiptEnabled === true;
}

/**
 * Extrait la référence Paystack depuis les paramètres d'URL lors du retour de paiement.
 */
export function extractPaystackReturnReference(search: string): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const isPaystackReturn = params.get('payment') === 'paystack-return';
    const ref = (params.get('reference') || params.get('trxref') || '').trim();
    if (isPaystackReturn && ref) return ref;
    if (ref.startsWith('SC-PAY-')) return ref;
    return null;
  } catch {
    return null;
  }
}

export function savePendingPaystackReturnContext(ctx: PendingPaystackReturnContext): void {
  try {
    sessionStorage.setItem(PENDING_RETURN_CTX_KEY, JSON.stringify(ctx));
  } catch {
    // Ignore storage errors
  }
}

export function consumePendingPaystackReturnContext(): PendingPaystackReturnContext | null {
  try {
    const raw = sessionStorage.getItem(PENDING_RETURN_CTX_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_RETURN_CTX_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Ignorer si vieux de plus de 2 heures
    if (parsed.createdAt && Date.now() - Number(parsed.createdAt) > 2 * 3600 * 1000) {
      return null;
    }
    return parsed as PendingPaystackReturnContext;
  } catch {
    return null;
  }
}

// ============================================================================
// APPELS RÉSEAU AUTHENTIFIÉS VERS STUDYCLOUD-WORKER
// ============================================================================

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('sc_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Ignore
  }
  return headers;
}

function getBaseApi(): string {
  return getWorkerApiUrl().replace(/\/+$/, '');
}

let cachedConfig: { data: PaymentGatewayConfig; fetchedAt: number } | null = null;

export async function getPaymentGatewayConfig(forceRefresh = false): Promise<PaymentGatewayConfig> {
  if (!forceRefresh && cachedConfig && Date.now() - cachedConfig.fetchedAt < 15_000) {
    return cachedConfig.data;
  }
  try {
    const resp = await fetch(`${getBaseApi()}/api/payments/config?_t=${Date.now()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const json = await resp.json().catch(() => null);
    if (resp.ok && json?.success && json.config) {
      const cfg: PaymentGatewayConfig = {
        provider: String(json.config.provider || 'paystack'),
        paystackEnabled: Boolean(json.config.paystackEnabled),
        manualReceiptEnabled: Boolean(json.config.manualReceiptEnabled),
        defaultCurrency: String(json.config.defaultCurrency || 'XOF').toUpperCase(),
        callbackUrl: String(json.config.callbackUrl || DEFAULT_PAYMENT_GATEWAY_CONFIG.callbackUrl),
        mode: json.config.mode || 'test',
      };
      cachedConfig = { data: cfg, fetchedAt: Date.now() };
      return cfg;
    }
  } catch (err) {
    console.warn('[PaystackBillingApi] Erreur chargement config passerelle:', err);
  }
  return cachedConfig?.data || DEFAULT_PAYMENT_GATEWAY_CONFIG;
}

export async function getMonetizedApps(): Promise<Array<MonetizedAppRecord & { plans: AppSubscriptionPlanRecord[] }>> {
  const resp = await fetch(`${getBaseApi()}/api/monetized-apps?active_only=1&_t=${Date.now()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) {
    throw new Error(json?.error || 'Impossible de charger le catalogue des applications.');
  }
  return Array.isArray(json.apps) ? json.apps : [];
}

export async function checkAppAccess(appKey: string): Promise<AppAccessResponse> {
  const resp = await fetch(
    `${getBaseApi()}/api/apps/access/${encodeURIComponent(appKey)}?_t=${Date.now()}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) {
    throw new Error(json?.error || "Impossible de vérifier l'accès à cette application.");
  }
  return json as AppAccessResponse;
}

export async function startAppFreeTrial(appKey: string): Promise<AppAccessResponse> {
  const resp = await fetch(
    `${getBaseApi()}/api/apps/access/${encodeURIComponent(appKey)}/start-trial`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    }
  );
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) {
    throw new Error(json?.error || "Impossible d'activer l'essai gratuit.");
  }
  return json as AppAccessResponse;
}

export async function initializePaystackPayment(
  payload: InitializePaystackPayload
): Promise<InitializePaystackResponse> {
  const body = {
    ...payload,
    returnOrigin:
      payload.returnOrigin ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://studycloud.dkd-technologies.com'),
  };
  const resp = await fetch(`${getBaseApi()}/api/payments/paystack/initialize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) {
    return {
      success: false,
      error: json?.error || "Impossible d'initialiser le paiement Paystack.",
    };
  }
  return json as InitializePaystackResponse;
}

export async function verifyPaystackPayment(reference: string): Promise<VerifyPaystackResponse> {
  const resp = await fetch(
    `${getBaseApi()}/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}&_t=${Date.now()}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );
  const json = await resp.json().catch(() => null);
  if (!json) {
    return {
      success: false,
      verified: false,
      error: 'Réponse serveur invalide lors de la vérification du paiement.',
    };
  }
  return json as VerifyPaystackResponse;
}

export async function getMyPaymentTransactions(): Promise<any[]> {
  const resp = await fetch(`${getBaseApi()}/api/payments/my-transactions?_t=${Date.now()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) return [];
  return Array.isArray(json.transactions) ? json.transactions : [];
}

/**
 * Formate et valide côté client un numéro Mobile Money Côte d'Ivoire (+225 / 10 chiffres).
 */
export function normalizeClientCiPhone(raw: string): string {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (digits.startsWith('00225') && digits.length === 15) return digits.slice(5);
  if (digits.startsWith('225') && digits.length === 13) return digits.slice(3);
  return digits;
}

export async function chargeMobileMoneyWithPaystack(
  payload: ChargeMobilePayload
): Promise<ChargeMobileResponse> {
  const cleanPhone =
    !payload.countryIso || payload.countryIso.toUpperCase() === 'CI'
      ? normalizeClientCiPhone(payload.phone)
      : String(payload.phone || '').replace(/[^\d+]/g, '');
  const resp = await fetch(`${getBaseApi()}/api/payments/paystack/charge-mobile`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      ...payload,
      phone: cleanPhone,
    }),
  });
  const json = await resp.json().catch(() => null);
  if (!json) {
    return {
      success: false,
      error: 'Réponse serveur invalide lors du lancement Mobile Money.',
    };
  }
  return json as ChargeMobileResponse;
}

export async function submitPaystackMobileOtp(
  reference: string,
  otp: string
): Promise<ChargeMobileResponse> {
  const resp = await fetch(`${getBaseApi()}/api/payments/paystack/submit-otp`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reference, otp: String(otp || '').trim() }),
  });
  const json = await resp.json().catch(() => null);
  if (!json) {
    return {
      success: false,
      error: 'Réponse serveur invalide lors de la vérification du code OTP.',
    };
  }
  return json as ChargeMobileResponse;
}

let paystackInlineLoaderPromise: Promise<any> | null = null;

/**
 * Charge dynamiquement Paystack InlineJS V2 (`https://js.paystack.co/v2/inline.js`)
 * pour ouvrir uniquement le module Carte Bancaire (PCI-DSS) en fenêtre superposée sans quitter StudyCloud.
 */
export function loadPaystackInlinePop(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Navigateur requis'));
  }
  const win = window as any;
  if (typeof win.PaystackPop === 'function') {
    return Promise.resolve(win.PaystackPop);
  }
  if (paystackInlineLoaderPromise) return paystackInlineLoaderPromise;

  paystackInlineLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-studycloud-paystack-inline="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).PaystackPop));
      existing.addEventListener('error', () => reject(new Error('Impossible de charger Paystack InlineJS')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.setAttribute('data-studycloud-paystack-inline', '1');
    script.onload = () => {
      if (typeof (window as any).PaystackPop === 'function') {
        resolve((window as any).PaystackPop);
      } else {
        paystackInlineLoaderPromise = null;
        reject(new Error('PaystackPop indisponible après chargement'));
      }
    };
    script.onerror = () => {
      paystackInlineLoaderPromise = null;
      reject(new Error('Impossible de charger le module sécurisé Paystack'));
    };
    document.head.appendChild(script);
  });

  return paystackInlineLoaderPromise;
}
