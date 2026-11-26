/**
 * StudyCloud — Module de Paiement Paystack, Abonnements & Monétisation Multi-Applications
 *
 * Sécurité & fiabilité :
 * - Clé secrète Paystack lue uniquement depuis le secret Cloudflare `STUDYCLOUD_PAYSTACK_SECRET_KEY` (jamais exposée au frontend).
 * - Prix TOUJOURS calculé côté serveur depuis D1 (`storage_subscription_plans`, `ai_subscription_plans`, `app_subscription_plans`).
 * - Double vérification indépendante : Webhook signé HMAC-SHA512 (`x-paystack-signature`) + vérification API serveur `/transaction/verify/:reference`.
 * - Verrou SQL atomique `WHERE reference = ? AND status = 'pending'` empêchant tout double crédit en cas d'arrivée simultanée webhook + retour client.
 * - Prise en charge des 3 modes durables : `auto` (Automatique), `manual` (Durée fixe manuelle), `infinite` (Accès à vie / illimité).
 * - Règle officielle Paystack XOF : les montants envoyés à l'API sont toujours multipliés par 100 (ex: 5 000 FCFA -> 500000).
 */

import {
  sendAndLogBillingEmail,
  processResendWebhookEvent,
  evaluateUserBillingGuard,
  verifyResendSvixSignature,
  computeResendSvixSignature,
  BillingEmailType,
} from './billingEmailAndPolicy';
import { runBillingCronCycle, BillingCronSummary } from './billingCron';

export { evaluateUserBillingGuard, verifyResendSvixSignature, computeResendSvixSignature };

export type BillingMode = 'auto' | 'manual' | 'infinite';
export type RenewalMode = 'auto' | 'manual' | 'infinite';
export type BlockScope = 'service_only' | 'read_only' | 'full_account';
export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'grace'
  | 'blocked'
  | 'expired'
  | 'cancelled'
  | 'revoked';
export type PaymentProductType = 'storage' | 'ai' | 'app';

export interface NormalizedPlanBillingFlags {
  allowAuto: 0 | 1;
  allowManual: 0 | 1;
  isInfinite: 0 | 1;
  billingMode: BillingMode;
  isAutoBilling: 0 | 1;
}

export interface InitialRenewalResolution {
  renewalMode: RenewalMode;
  canChooseAutoOnSuccessScreen: boolean;
  defaultSelectedMode: RenewalMode;
}

export interface SubscriptionCountdown {
  isInfinite: boolean;
  remainingMs: number | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  minutesRemaining: number | null;
  isExpired: boolean;
  isInGrace: boolean;
  graceDaysRemaining: number | null;
  labelFr: string;
}

export interface EffectiveBillingPolicy {
  scopeType: 'global' | 'product_type' | 'app' | 'subscription';
  scopeKey: string;
  preExpiryDays: number[];
  autoNoticeDays: number;
  overdueIntervalHours: number;
  overdueMaxReminders: number;
  gracePeriodDays: number;
  blockScope: BlockScope;
  retryIntervalsHours: number[];
  emailOnPurchase: boolean;
  emailOnFail: boolean;
  emailOnBlock: boolean;
  autoUnblockOnPayment: boolean;
}

export interface PaystackBillingContext {
  db: any;
  rawEnv: Record<string, any>;
  origin: string;
  getAuthUser: (req: Request) => Promise<any | null>;
  jsonResponse: (data: any, status?: number, origin?: string) => Response;
  errorResponse: (message: string, status?: number, origin?: string) => Response;
  fetchFn?: typeof fetch;
}

export interface PaymentGatewayConfig {
  provider: string;
  paystackEnabled: boolean;
  manualReceiptEnabled: boolean;
  defaultCurrency: string;
  callbackUrl: string;
  mode: 'test' | 'live' | 'unconfigured';
}

export interface AppAccessCheckResult {
  allowed: boolean;
  isPaidApp: boolean;
  status: 'free' | 'active' | 'trial' | 'grace' | 'expired' | 'revoked' | 'none';
  reason?: string;
  app: any | null;
  entitlement: any | null;
  canStartTrial: boolean;
  daysRemaining: number | null;
}

const DEFAULT_CALLBACK_URL = 'https://studycloud.dkd-technologies.com/?payment=paystack-return';
const PAYSTACK_API_BASE = 'https://api.paystack.co';

// ============================================================================
// UTILITAIRES PURS (CRYPTO, PRIX, RÉSEAUX, DURÉES)
// ============================================================================

export function getPaystackSecretKey(rawEnv: Record<string, any>): string {
  return String(
    rawEnv?.STUDYCLOUD_PAYSTACK_SECRET_KEY ||
      rawEnv?.PAYSTACK_SECRET_KEY ||
      ''
  ).trim();
}

export function detectPaystackMode(secretKey: string): 'test' | 'live' | 'unconfigured' {
  if (!secretKey) return 'unconfigured';
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'test';
}

export function normalizeBillingMode(
  rawMode?: unknown,
  isAutoFallback?: unknown,
  pricingModelFallback?: unknown
): BillingMode {
  const s = String(rawMode || '').trim().toLowerCase();
  if (s === 'auto' || s === 'automatic' || s === 'automatique') return 'auto';
  if (s === 'infinite' || s === 'infini' || s === 'lifetime' || s === 'illimite' || s === 'illimité') {
    return 'infinite';
  }
  if (s === 'manual' || s === 'manuel') return 'manual';

  if (Number(isAutoFallback) === 1 || isAutoFallback === true) return 'auto';
  const pm = String(pricingModelFallback || '').trim().toLowerCase();
  if (pm === 'one_time' || pm === 'pack' || pm === 'lifetime' || pm === 'infinite') {
    return 'infinite';
  }
  return 'manual';
}

export function normalizeDurationDays(rawDays: unknown, billingMode: BillingMode): number {
  if (billingMode === 'infinite') return 0;
  const n = Math.round(Number(rawDays));
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.max(1, Math.min(3650, n));
}

/**
 * Normalise de façon stricte les 3 cases de configuration d'un plan d'abonnement :
 * - Infini / À vie (`isInfinite = 1`) -> exclusif (`allowAuto = 0, allowManual = 0`)
 * - Automatique coché (`allowAuto = 1`) -> force OBLIGATOIREMENT `allowManual = 1` (les deux ensemble)
 * - Manuel seul (`allowManual = 1, allowAuto = 0`) -> valeur sûre par défaut
 */
export function normalizePlanBillingFlags(input: {
  allow_auto?: unknown;
  allowAuto?: unknown;
  allow_manual?: unknown;
  allowManual?: unknown;
  is_infinite?: unknown;
  isInfinite?: unknown;
  billing_mode?: unknown;
  billingMode?: unknown;
  is_auto_billing?: unknown;
  isAutoBilling?: unknown;
  pricing_model?: unknown;
  pricingModel?: unknown;
}): NormalizedPlanBillingFlags {
  const rawInfinite = input?.is_infinite ?? input?.isInfinite;
  const rawAuto = input?.allow_auto ?? input?.allowAuto;
  const rawMode = input?.billing_mode ?? input?.billingMode;
  const rawIsAuto = input?.is_auto_billing ?? input?.isAutoBilling;
  const rawPricingModel = input?.pricing_model ?? input?.pricingModel;

  const explicitInfinite =
    rawInfinite === true ||
    Number(rawInfinite) === 1 ||
    String(rawMode || '').trim().toLowerCase() === 'infinite' ||
    String(rawMode || '').trim().toLowerCase() === 'infini' ||
    String(rawMode || '').trim().toLowerCase() === 'lifetime';

  const inferredMode = normalizeBillingMode(rawMode, rawIsAuto, rawPricingModel);

  if (explicitInfinite || (rawAuto === undefined && rawInfinite === undefined && inferredMode === 'infinite')) {
    return {
      allowAuto: 0,
      allowManual: 0,
      isInfinite: 1,
      billingMode: 'infinite',
      isAutoBilling: 0,
    };
  }

  const explicitAuto =
    rawAuto === true ||
    Number(rawAuto) === 1 ||
    (rawAuto === undefined && inferredMode === 'auto');

  if (explicitAuto) {
    // Règle métier impérative : cocher Automatique impose toujours Manuel coché avec lui
    return {
      allowAuto: 1,
      allowManual: 1,
      isInfinite: 0,
      billingMode: 'auto',
      isAutoBilling: 1,
    };
  }

  return {
    allowAuto: 0,
    allowManual: 1,
    isInfinite: 0,
    billingMode: 'manual',
    isAutoBilling: 0,
  };
}

/**
 * Détermine le mode de renouvellement initial enregistré en D1 juste après un paiement vérifié :
 * - Plan Infini -> 'infinite'
 * - Plan Auto+Manuel + payé par carte bancaire réutilisable -> 'auto' par défaut (modifiable en 'manual' sur l'écran vert)
 * - Plan Manuel seul OU payé par Wave/Orange/MTN -> 'manual'
 */
export function resolveInitialRenewalMode(params: {
  isInfinite: boolean | number;
  allowAuto: boolean | number;
  channel?: string;
  reusable?: boolean | number;
}): InitialRenewalResolution {
  if (params.isInfinite === true || Number(params.isInfinite) === 1) {
    return {
      renewalMode: 'infinite',
      canChooseAutoOnSuccessScreen: false,
      defaultSelectedMode: 'infinite',
    };
  }
  const allowsAuto = params.allowAuto === true || Number(params.allowAuto) === 1;
  const isCard = String(params.channel || '').trim().toLowerCase() === 'card';
  const isReusable = params.reusable === true || Number(params.reusable) === 1;

  if (allowsAuto && isCard && isReusable) {
    return {
      renewalMode: 'auto',
      canChooseAutoOnSuccessScreen: true,
      defaultSelectedMode: 'auto',
    };
  }

  return {
    renewalMode: 'manual',
    canChooseAutoOnSuccessScreen: false,
    defaultSelectedMode: 'manual',
  };
}

export function normalizeBlockScope(raw: unknown): BlockScope {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'read_only' || s === 'readonly' || s === 'lecture_seule') return 'read_only';
  if (s === 'full_account' || s === 'all' || s === 'tout' || s === 'compte_entier') return 'full_account';
  return 'service_only';
}

export function computeSubscriptionCountdown(
  currentPeriodEnd: string | null | undefined,
  isInfinite: boolean | number,
  graceUntil?: string | null,
  nowMs = Date.now()
): SubscriptionCountdown {
  if (isInfinite === true || Number(isInfinite) === 1 || !currentPeriodEnd) {
    return {
      isInfinite: true,
      remainingMs: null,
      daysRemaining: null,
      hoursRemaining: null,
      minutesRemaining: null,
      isExpired: false,
      isInGrace: false,
      graceDaysRemaining: null,
      labelFr: 'À vie (Infini)',
    };
  }

  const endMs = Date.parse(currentPeriodEnd);
  if (!Number.isFinite(endMs)) {
    return {
      isInfinite: false,
      remainingMs: 0,
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      isExpired: true,
      isInGrace: false,
      graceDaysRemaining: 0,
      labelFr: 'Expiré',
    };
  }

  const diff = endMs - nowMs;
  if (diff > 0) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const labelFr =
      days > 0
        ? `${days} j ${hours} h`
        : hours > 0
        ? `${hours} h ${minutes} min`
        : `${Math.max(1, minutes)} min`;
    return {
      isInfinite: false,
      remainingMs: diff,
      daysRemaining: days,
      hoursRemaining: hours,
      minutesRemaining: minutes,
      isExpired: false,
      isInGrace: false,
      graceDaysRemaining: null,
      labelFr,
    };
  }

  const graceMs = graceUntil ? Date.parse(graceUntil) : NaN;
  if (Number.isFinite(graceMs) && graceMs > nowMs) {
    const gDays = Math.max(1, Math.ceil((graceMs - nowMs) / (24 * 60 * 60 * 1000)));
    return {
      isInfinite: false,
      remainingMs: 0,
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      isExpired: true,
      isInGrace: true,
      graceDaysRemaining: gDays,
      labelFr: `Grâce (${gDays} j restant${gDays > 1 ? 's' : ''})`,
    };
  }

  return {
    isInfinite: false,
    remainingMs: 0,
    daysRemaining: 0,
    hoursRemaining: 0,
    minutesRemaining: 0,
    isExpired: true,
    isInGrace: false,
    graceDaysRemaining: 0,
    labelFr: 'Expiré',
  };
}

export function parseAutoAppsJson(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((x) => {
            const s = String(x || '').trim();
            return s === '*' ? '*' : sanitizeAppKey(s);
          })
          .filter(Boolean)
      )
    );
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((x) => {
                const s = String(x || '').trim();
                return s === '*' ? '*' : sanitizeAppKey(s);
              })
              .filter(Boolean)
          )
        );
      }
    } catch {}
  }
  return [];
}

export function isCardAuthorizedForSubscription(
  pmRow: any,
  sub: { product_type?: string; app_key?: string; payment_method_id?: string; renewal_mode?: string }
): boolean {
  if (!pmRow || Number(pmRow.is_active) === 0 || Number(pmRow.reusable) === 0) return false;
  const autoStorage = Number(pmRow.auto_storage) === 1;
  const autoAi = Number(pmRow.auto_ai) === 1;
  const autoApps = parseAutoAppsJson(pmRow.auto_apps_json);

  // Rétrocompatibilité pour les cartes legacy (antérieures aux permissions par service) déjà liées en auto
  const hasExplicitFlags = autoStorage || autoAi || autoApps.length > 0;
  if (
    !hasExplicitFlags &&
    sub.renewal_mode === 'auto' &&
    sub.payment_method_id &&
    String(sub.payment_method_id) === String(pmRow.id)
  ) {
    return true;
  }

  const pType = String(sub.product_type || '').toLowerCase();
  if (pType === 'storage') return autoStorage;
  if (pType === 'ai') return autoAi;
  if (pType === 'app') {
    if (autoApps.includes('*')) return true;
    const key = sanitizeAppKey(sub.app_key || '');
    return Boolean(key && autoApps.includes(key));
  }
  return false;
}

export function maskPaymentMethodForClient(row: any) {
  if (!row) return null;
  const brand = String(row.card_brand || 'Carte');
  const last4 = String(row.last4 || '••••');
  const autoApps = parseAutoAppsJson(row.auto_apps_json);
  return {
    id: String(row.id || ''),
    provider: String(row.provider || 'paystack'),
    cardBrand: brand,
    brand,
    cardType: String(row.card_type || ''),
    last4,
    expMonth: String(row.exp_month || ''),
    expYear: String(row.exp_year || ''),
    bank: String(row.bank || ''),
    countryCode: String(row.country_code || ''),
    channel: 'card',
    reusable: Number(row.reusable ?? 1) === 1,
    isDefault: Number(row.is_default) === 1,
    isActive: Number(row.is_active) !== 0,
    label: `${brand} •••• ${last4}`,
    autoStorage: Number(row.auto_storage) === 1,
    autoAi: Number(row.auto_ai) === 1,
    autoAiOnDepleted: Number(row.auto_ai_on_depleted) === 1,
    autoApps,
    createdAt: row.created_at || null,
  };
}

export function sanitizeAppKey(raw: unknown): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export type MobileMoneyProviderCode = 'wave' | 'orange' | 'mtn';

export function normalizeMobileMoneyProvider(raw: unknown): MobileMoneyProviderCode | null {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'wave') return 'wave';
  if (s === 'orange' || s === 'om' || s === 'orange_money') return 'orange';
  if (s === 'mtn' || s === 'momo' || s === 'mtn_momo') return 'mtn';
  return null;
}

export function getMobileProviderLabel(provider: MobileMoneyProviderCode): string {
  if (provider === 'wave') return 'Wave';
  if (provider === 'orange') return 'Orange Money';
  return 'MTN Mobile Money';
}

/**
 * Normalise un numéro Mobile Money pour la Charge API Paystack :
 * - Côte d'Ivoire (+225) : format local 10 chiffres (ex: "+225 07 00 00 00 00" -> "0700000000").
 * - Autres pays : conserve le format E.164 international propre (ex: "+221771234567").
 */
export function normalizeIvoryCoastPhone(raw: unknown, countryIso?: unknown): string {
  const str = String(raw || '').trim();
  const digits = str.replace(/[^\d]/g, '');
  if (!digits) return '';
  const iso = String(countryIso || '').trim().toUpperCase();

  // Côte d'Ivoire explicite ou préfixe 225 / 00225
  if (iso === 'CI' || (!iso && (digits.startsWith('00225') || digits.startsWith('225') || (digits.length === 10 && digits.startsWith('0'))))) {
    if (digits.startsWith('00225') && digits.length === 15) return digits.slice(5);
    if (digits.startsWith('225') && digits.length === 13) return digits.slice(3);
    return digits;
  }

  // Autres pays : conserver l'indicatif international `+...`
  if (str.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  return digits;
}

/**
 * Paystack exige tous les montants en sous-unités (× 100), y compris pour le XOF (FCFA).
 * Exemple : 5 000 FCFA -> 500000.
 */
export function toPaystackAmountMinor(amountMajor: number): number {
  const safe = Number(amountMajor);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  return Math.round(safe * 100);
}

export function resolvePlanPriceMajor(
  plan: any,
  _billingCycle: 'monthly' | 'annual' | 'one_time' | 'custom' | 'infinite',
  targetCurrency = 'XOF'
): { amountMajor: number; currency: string; durationDays: number } {
  const billingMode = normalizeBillingMode(
    plan?.billing_mode,
    plan?.is_auto_billing,
    plan?.pricing_model
  );
  const baseDuration = normalizeDurationDays(plan?.duration_days, billingMode);
  const primaryCurr = String(plan?.primary_currency || 'XOF').toUpperCase();
  const basePrice = Number(plan?.price) || 0;

  let convObj: Record<string, number> = {};
  if (typeof plan?.currency_conversions === 'string') {
    try {
      const parsed = JSON.parse(plan.currency_conversions);
      if (parsed && typeof parsed === 'object') convObj = parsed;
    } catch {
      convObj = {};
    }
  } else if (plan?.currency_conversions && typeof plan.currency_conversions === 'object') {
    convObj = plan.currency_conversions;
  }

  const wantedCurr = String(targetCurrency || 'XOF').toUpperCase();
  let finalAmount: number;

  if (primaryCurr === wantedCurr) {
    finalAmount = basePrice;
  } else if (Number(convObj[wantedCurr]) > 0) {
    finalAmount = Number(convObj[wantedCurr]);
  } else if (wantedCurr === 'XOF') {
    if (primaryCurr === 'USD') finalAmount = Math.round(basePrice * 650);
    else if (primaryCurr === 'EUR') finalAmount = Math.round(basePrice * 655.957);
    else finalAmount = Math.round(basePrice);
  } else if (wantedCurr === 'USD') {
    if (primaryCurr === 'XOF') finalAmount = Math.round((basePrice / 650) * 100) / 100;
    else if (primaryCurr === 'EUR') finalAmount = Math.round((basePrice / 0.92) * 100) / 100;
    else finalAmount = basePrice;
  } else {
    finalAmount = basePrice;
  }

  if (wantedCurr === 'XOF') {
    finalAmount = Math.round(finalAmount);
  }

  return {
    amountMajor: Math.max(0, finalAmount),
    currency: wantedCurr,
    durationDays: billingMode === 'infinite' ? 0 : baseDuration,
  };
}

export function resolvePaystackIntervalFromDays(
  durationDays: number
): 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually' | null {
  if (durationDays === 1) return 'daily';
  if (durationDays === 7) return 'weekly';
  if (durationDays >= 28 && durationDays <= 31) return 'monthly';
  if (durationDays >= 88 && durationDays <= 93) return 'quarterly';
  if (durationDays >= 178 && durationDays <= 186) return 'biannually';
  if (durationDays >= 360 && durationDays <= 366) return 'annually';
  return null;
}

/**
 * Calcule la nouvelle date d'expiration en préservant les jours restants si l'utilisateur renouvelle avant expiration.
 * Retourne `null` pour le mode `infinite` (accès à vie).
 */
export function computeEntitlementExpiration(
  billingMode: BillingMode,
  durationDays: number,
  existingExpiresAt?: string | null,
  nowMs = Date.now()
): string | null {
  if (billingMode === 'infinite' || durationDays <= 0) return null;
  let baseMs = nowMs;
  if (existingExpiresAt) {
    const parsed = Date.parse(existingExpiresAt);
    if (Number.isFinite(parsed) && parsed > nowMs) {
      baseMs = parsed;
    }
  }
  return new Date(baseMs + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Identifie proprement le réseau / opérateur réellement utilisé depuis la réponse vérifiée Paystack
 * (Wave, Orange Money, MTN MoMo, Moov Money, Visa, Mastercard, etc.).
 */
export function extractPaystackNetworkLabel(txData: any): {
  channel: string;
  networkLabel: string;
} {
  const channel = String(txData?.channel || '').trim().toLowerCase();
  const auth = txData?.authorization || {};
  const bank = String(auth?.bank || '').trim();
  const brand = String(auth?.brand || auth?.card_type || '').trim();
  const combined = `${bank} ${brand} ${channel}`.toLowerCase();

  if (combined.includes('wave')) {
    return { channel: channel || 'mobile_money', networkLabel: 'Wave' };
  }
  if (combined.includes('orange')) {
    return { channel: channel || 'mobile_money', networkLabel: 'Orange Money' };
  }
  if (combined.includes('mtn') || combined.includes('momo')) {
    return { channel: channel || 'mobile_money', networkLabel: 'MTN MoMo' };
  }
  if (combined.includes('moov') || combined.includes('flooz')) {
    return { channel: channel || 'mobile_money', networkLabel: 'Moov Money' };
  }
  if (combined.includes('visa')) {
    return { channel: channel || 'card', networkLabel: 'Carte Visa' };
  }
  if (combined.includes('mastercard') || combined.includes('master')) {
    return { channel: channel || 'card', networkLabel: 'Mastercard' };
  }
  if (combined.includes('verve')) {
    return { channel: channel || 'card', networkLabel: 'Verve' };
  }
  if (combined.includes('amex') || combined.includes('american express')) {
    return { channel: channel || 'card', networkLabel: 'American Express' };
  }
  if (channel === 'mobile_money') {
    return { channel, networkLabel: bank || 'Mobile Money' };
  }
  if (channel === 'card') {
    return { channel, networkLabel: brand || bank || 'Carte Bancaire' };
  }
  if (channel === 'bank' || channel === 'bank_transfer') {
    return { channel, networkLabel: bank || 'Virement Bancaire' };
  }
  return {
    channel: channel || 'paystack',
    networkLabel: bank || brand || 'Paystack',
  };
}

/**
 * Calcule le HMAC SHA-512 hexadécimal sur le corps brut pour vérifier `x-paystack-signature`.
 */
export async function computePaystackHmacSha512Hex(
  secret: string,
  rawBody: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const bytes = new Uint8Array(sigBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Comparaison en temps constant (résistante aux timing attacks).
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Comparaison en temps constant sensible à la casse (pour clés API / secrets).
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Vérification stricte de l'authentification serveur-à-serveur des routes Admin.
 * Refuse systématiquement (fail-closed) si `ADMIN_API_SECRET` est absent ou ne correspond pas.
 */
export function verifyAdminApiAuth(
  request: Request,
  rawEnv: Record<string, any>
): { ok: boolean; status?: number; error?: string } {
  const expectedSecret = String(
    rawEnv?.ADMIN_API_SECRET || rawEnv?.STUDYCLOUD_ADMIN_SECRET || ''
  ).trim();
  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      error: 'Clé administrateur serveur (ADMIN_API_SECRET) non configurée.',
    };
  }
  const providedKey = String(
    request.headers.get('X-Admin-Key') ||
      request.headers.get('x-admin-key') ||
      request.headers.get('X-StudyCloud-Admin-Key') ||
      ''
  ).trim();
  if (!providedKey || !timingSafeEqualString(providedKey, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      error: 'Accès administrateur refusé (clé manquante ou invalide).',
    };
  }
  return { ok: true };
}

/**
 * Traduit les messages d'erreur anglais courants renvoyés par Paystack en français clair.
 */
export function translatePaystackErrorFr(rawMsg: unknown, fallback = 'Paiement refusé par la passerelle.'): string {
  const msg = String(rawMsg || '').trim();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();

  if (lower.includes('test mobile money number') || lower.includes('doing a test transaction')) {
    return 'Mode Test Paystack : utilisez le numéro de test officiel Côte d’Ivoire (07 00 00 00 00) ou cliquez sur « Continuer le paiement » ci-dessous.';
  }
  if (lower.includes('insufficient funds') || lower.includes('not sufficient')) {
    return 'Solde insuffisant sur votre compte ou votre carte.';
  }
  if (lower.includes('expired card')) {
    return 'Votre carte bancaire est expirée.';
  }
  if (lower.includes('invalid phone') || lower.includes('phone number is invalid')) {
    return 'Numéro Mobile Money invalide pour cet opérateur.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Délai d’attente dépassé auprès de l’opérateur. Veuillez réessayer.';
  }
  if (lower.includes('invalid otp') || lower.includes('incorrect otp') || lower.includes('otp expired')) {
    return 'Code OTP invalide ou expiré. Veuillez réessayer.';
  }
  if (lower.includes('transaction reference not found') || lower.includes('transaction not found')) {
    return 'Transaction introuvable chez Paystack.';
  }
  if (lower.includes('declined') || lower.includes('do not honor')) {
    return 'Paiement refusé par votre banque ou opérateur Mobile Money.';
  }
  return msg;
}

// ============================================================================
// SCHÉMA D1 & MIGRATIONS IDEMPOTENTES
// ============================================================================

const ensuredDbSet = new WeakSet<object>();

export async function ensurePaystackBillingTables(db: any): Promise<void> {
  if (!db) return;
  if (ensuredDbSet.has(db)) return;

  // 1. Configuration passerelle de paiement (interrupteur Paystack + bouton Payer manuellement)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_gateway_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      provider TEXT DEFAULT 'paystack',
      paystack_enabled INTEGER DEFAULT 1,
      manual_receipt_enabled INTEGER DEFAULT 1,
      default_currency TEXT DEFAULT 'XOF',
      callback_url TEXT DEFAULT 'https://studycloud.dkd-technologies.com/?payment=paystack-return',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  await db.prepare(`
    INSERT OR IGNORE INTO payment_gateway_config (
      id, provider, paystack_enabled, manual_receipt_enabled, default_currency, callback_url
    ) VALUES ('default', 'paystack', 1, 1, 'XOF', ?)
  `).bind(DEFAULT_CALLBACK_URL).run().catch(() => {});

  // 2. S'assurer que storage_subscription_plans & ai_subscription_plans existent + nouvelles colonnes billing_mode / duration_days / paystack_plan_code
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS storage_subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      badge TEXT DEFAULT '',
      description TEXT DEFAULT '',
      storage_amount TEXT NOT NULL,
      storage_mb REAL DEFAULT 0,
      price REAL NOT NULL,
      primary_currency TEXT DEFAULT 'XOF',
      currencies_enabled TEXT DEFAULT '["XOF","USD","EUR"]',
      currency_conversions TEXT DEFAULT '{}',
      features TEXT DEFAULT '[]',
      is_auto_billing INTEGER DEFAULT 0,
      billing_mode TEXT DEFAULT 'manual',
      duration_days INTEGER DEFAULT 30,
      paystack_plan_code TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      badge TEXT DEFAULT '',
      description TEXT DEFAULT '',
      credits_or_words TEXT NOT NULL,
      credits_count REAL DEFAULT 0,
      price REAL NOT NULL,
      primary_currency TEXT DEFAULT 'XOF',
      currencies_enabled TEXT DEFAULT '["XOF","USD","EUR"]',
      currency_conversions TEXT DEFAULT '{}',
      features TEXT DEFAULT '[]',
      is_auto_billing INTEGER DEFAULT 0,
      billing_mode TEXT DEFAULT 'manual',
      duration_days INTEGER DEFAULT 30,
      paystack_plan_code TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      pricing_model TEXT DEFAULT 'subscription',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  for (const sql of [
    "ALTER TABLE storage_subscription_plans ADD COLUMN billing_mode TEXT DEFAULT 'manual'",
    'ALTER TABLE storage_subscription_plans ADD COLUMN duration_days INTEGER DEFAULT 30',
    "ALTER TABLE storage_subscription_plans ADD COLUMN paystack_plan_code TEXT DEFAULT ''",
    'ALTER TABLE storage_subscription_plans ADD COLUMN allow_auto INTEGER DEFAULT 0',
    'ALTER TABLE storage_subscription_plans ADD COLUMN allow_manual INTEGER DEFAULT 1',
    'ALTER TABLE storage_subscription_plans ADD COLUMN is_infinite INTEGER DEFAULT 0',
    "ALTER TABLE ai_subscription_plans ADD COLUMN billing_mode TEXT DEFAULT 'manual'",
    'ALTER TABLE ai_subscription_plans ADD COLUMN duration_days INTEGER DEFAULT 30',
    "ALTER TABLE ai_subscription_plans ADD COLUMN paystack_plan_code TEXT DEFAULT ''",
    'ALTER TABLE ai_subscription_plans ADD COLUMN allow_auto INTEGER DEFAULT 0',
    'ALTER TABLE ai_subscription_plans ADD COLUMN allow_manual INTEGER DEFAULT 1',
    'ALTER TABLE ai_subscription_plans ADD COLUMN is_infinite INTEGER DEFAULT 0',
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {
      // Déjà migré
    }
  }

  // 3. Catalogue extensible des applications monétisables (`monetized_apps`)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS monetized_apps (
      app_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📱',
      description TEXT DEFAULT '',
      is_paid INTEGER DEFAULT 0,
      trial_days INTEGER DEFAULT 0,
      grace_period_days INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  // Seed initial de l'application Moyennes en mode Gratuit par défaut (l'admin active le paywall quand il veut)
  await db.prepare(`
    INSERT OR IGNORE INTO monetized_apps (
      app_key, name, icon, description, is_paid, trial_days, grace_period_days, is_active, sort_order
    ) VALUES (
      'moyennes',
      'Moyennes (Espace Enseignant)',
      '📊',
      'Gestion complète des écoles, classes, trimestres, relevés de notes, moyennes générales automatiques, exports PDF/Word/Excel et Assistant Delmas.',
      0,
      0,
      5,
      1,
      1
    )
  `).run().catch(() => {});

  // 4. Cartes d'abonnement / prix par application (`app_subscription_plans`) — illimitées par app !
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_subscription_plans (
      id TEXT PRIMARY KEY,
      app_key TEXT NOT NULL,
      name TEXT NOT NULL,
      badge TEXT DEFAULT '',
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      primary_currency TEXT DEFAULT 'XOF',
      currencies_enabled TEXT DEFAULT '["XOF","USD","EUR"]',
      currency_conversions TEXT DEFAULT '{}',
      billing_mode TEXT DEFAULT 'manual',
      duration_days INTEGER DEFAULT 30,
      is_auto_billing INTEGER DEFAULT 0,
      allow_auto INTEGER DEFAULT 0,
      allow_manual INTEGER DEFAULT 1,
      is_infinite INTEGER DEFAULT 0,
      paystack_plan_code TEXT DEFAULT '',
      features TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  for (const sql of [
    'ALTER TABLE app_subscription_plans ADD COLUMN allow_auto INTEGER DEFAULT 0',
    'ALTER TABLE app_subscription_plans ADD COLUMN allow_manual INTEGER DEFAULT 1',
    'ALTER TABLE app_subscription_plans ADD COLUMN is_infinite INTEGER DEFAULT 0',
    'ALTER TABLE storage_subscription_plans DROP COLUMN yearly_price',
    'ALTER TABLE storage_subscription_plans DROP COLUMN yearly_discount_pct',
    'ALTER TABLE ai_subscription_plans DROP COLUMN yearly_price',
    'ALTER TABLE ai_subscription_plans DROP COLUMN yearly_discount_pct',
    'ALTER TABLE app_subscription_plans DROP COLUMN yearly_price',
    'ALTER TABLE app_subscription_plans DROP COLUMN yearly_discount_pct',
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {}
  }
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_app_plans_key ON app_subscription_plans(app_key, is_active, sort_order)'
  ).run().catch(() => {});

  // Synchronisation rétroactive douce des drapeaux allow_auto / allow_manual / is_infinite sur les anciens plans
  for (const tbl of ['storage_subscription_plans', 'ai_subscription_plans', 'app_subscription_plans']) {
    await db.prepare(
      `UPDATE ${tbl}
       SET is_infinite = 1, allow_auto = 0, allow_manual = 0
       WHERE LOWER(COALESCE(billing_mode, '')) = 'infinite' AND COALESCE(is_infinite, 0) = 0`
    ).run().catch(() => {});
    await db.prepare(
      `UPDATE ${tbl}
       SET allow_auto = 1, allow_manual = 1, is_infinite = 0
       WHERE (LOWER(COALESCE(billing_mode, '')) = 'auto' OR COALESCE(is_auto_billing, 0) = 1)
         AND COALESCE(is_infinite, 0) = 0
         AND (COALESCE(allow_auto, 0) = 0 OR COALESCE(allow_manual, 0) = 0)`
    ).run().catch(() => {});
  }

  // 5. Droits d'accès par utilisateur et par application (`user_app_entitlements`)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_app_entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      app_key TEXT NOT NULL,
      plan_id TEXT DEFAULT '',
      plan_name TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      access_type TEXT DEFAULT 'manual',
      starts_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT DEFAULT NULL,
      grace_until TEXT DEFAULT NULL,
      auto_renew INTEGER DEFAULT 0,
      paystack_subscription_code TEXT DEFAULT '',
      paystack_email_token TEXT DEFAULT '',
      last_transaction_ref TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, app_key)
    )
  `).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_user_app_ent_uid ON user_app_entitlements(user_id, app_key, status)'
  ).run().catch(() => {});

  // 6. Table maîtresse de toutes les transactions financières (`payment_transactions`)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT DEFAULT '',
      user_email TEXT DEFAULT '',
      user_phone TEXT DEFAULT '',
      product_type TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      app_key TEXT DEFAULT '',
      app_name TEXT DEFAULT '',
      billing_mode TEXT DEFAULT 'manual',
      billing_cycle TEXT DEFAULT 'monthly',
      duration_days INTEGER DEFAULT 30,
      expected_amount REAL NOT NULL,
      expected_amount_minor INTEGER NOT NULL,
      paid_amount REAL DEFAULT 0,
      paid_amount_minor INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      provider TEXT DEFAULT 'paystack',
      channel TEXT DEFAULT '',
      network_label TEXT DEFAULT '',
      paystack_tx_id TEXT DEFAULT '',
      paystack_access_code TEXT DEFAULT '',
      paystack_authorization_code TEXT DEFAULT '',
      paystack_subscription_code TEXT DEFAULT '',
      reusable INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      fulfilled_at TEXT DEFAULT NULL,
      granted_storage_mb REAL DEFAULT 0,
      granted_ai_credits REAL DEFAULT 0,
      entitlement_expires_at TEXT DEFAULT NULL,
      failure_reason TEXT DEFAULT '',
      raw_verify_json TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_pay_tx_user ON payment_transactions(user_id, created_at)'
  ).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_pay_tx_status ON payment_transactions(status, created_at)'
  ).run().catch(() => {});

  for (const sql of [
    'ALTER TABLE payment_transactions ADD COLUMN target_storage_mb REAL DEFAULT 0',
    'ALTER TABLE payment_transactions ADD COLUMN recurring_price_amount REAL DEFAULT 0',
    "ALTER TABLE payment_transactions ADD COLUMN master_action TEXT DEFAULT ''",
    'ALTER TABLE payment_transactions ADD COLUMN prorata_credit_amount REAL DEFAULT 0',
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {}
  }

  // 6b. Configuration D1 de la Carte Maîtresse de Stockage Évolutif (`storage_master_card_config`)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS storage_master_card_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      enabled INTEGER DEFAULT 1,
      title TEXT DEFAULT 'Mon Stockage Évolutif',
      subtitle TEXT DEFAULT 'Augmentez votre espace à tout moment selon vos besoins',
      step_value REAL DEFAULT 100,
      step_unit TEXT DEFAULT 'MB',
      price_per_step REAL DEFAULT 100,
      primary_currency TEXT DEFAULT 'XOF',
      duration_days INTEGER DEFAULT 30,
      max_storage_mb REAL DEFAULT 0,
      billing_mode TEXT DEFAULT 'manual',
      prorata_enabled INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await db.prepare(
    `INSERT OR IGNORE INTO storage_master_card_config (id) VALUES ('default')`
  ).run().catch(() => {});

  // 7. Journal d'audit des webhooks Paystack (`payment_webhook_events`)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id TEXT PRIMARY KEY,
      provider TEXT DEFAULT 'paystack',
      event_type TEXT NOT NULL,
      reference TEXT DEFAULT '',
      signature_valid INTEGER DEFAULT 0,
      processed INTEGER DEFAULT 0,
      processing_note TEXT DEFAULT '',
      payload_json TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  // S'assurer que les tables de livraison liées existent aussi (pour tests isolés ou DB neuve)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_storage_quotas (
      user_id TEXT PRIMARY KEY,
      welcome_total_mb REAL DEFAULT 100.0,
      welcome_r2_mb REAL DEFAULT 33.0,
      welcome_d1_mb REAL DEFAULT 67.0,
      paid_total_mb REAL DEFAULT 0.0,
      paid_r2_mb REAL DEFAULT 0.0,
      paid_d1_mb REAL DEFAULT 0.0,
      bonus_total_mb REAL DEFAULT 0.0,
      bonus_r2_mb REAL DEFAULT 0.0,
      bonus_d1_mb REAL DEFAULT 0.0,
      plan_name TEXT DEFAULT 'gratuit',
      is_unlimited INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_ai_credits (
      user_id TEXT PRIMARY KEY,
      credits_balance REAL DEFAULT 50.0,
      remaining_credits REAL DEFAULT 50.0,
      gift_remaining REAL DEFAULT 50.0,
      gift_initial REAL DEFAULT 50.0,
      gift_type TEXT DEFAULT 'welcome',
      purchased_remaining REAL DEFAULT 0.0,
      total_tokens_consumed INTEGER DEFAULT 0,
      total_credits_purchased REAL DEFAULT 0.0,
      total_credits_consumed REAL DEFAULT 0.0,
      plan_tier TEXT DEFAULT 'gratuit',
      is_blocked INTEGER DEFAULT 0,
      last_daily_grant_date TEXT DEFAULT '',
      last_usage_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_ai_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credits_amount REAL NOT NULL,
      price_paid REAL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      payment_method TEXT DEFAULT 'paystack',
      payment_reference TEXT DEFAULT '',
      reason TEXT DEFAULT 'Achat Paystack',
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_purchases_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT DEFAULT '',
      user_email TEXT DEFAULT '',
      user_phone TEXT DEFAULT '',
      pack_name TEXT NOT NULL,
      storage_bought_mb REAL DEFAULT 0,
      total_storage_mb REAL DEFAULT 30,
      price_paid REAL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      payment_method TEXT DEFAULT 'Paystack',
      payment_reference TEXT DEFAULT '',
      billing_cycle TEXT DEFAULT 'monthly',
      renewal_date TEXT DEFAULT '',
      status TEXT DEFAULT 'confirmed',
      purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_deleted_at TEXT DEFAULT '',
      purge_scheduled_at TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT DEFAULT '',
      user_phone TEXT DEFAULT '',
      user_email TEXT DEFAULT '',
      plan_name TEXT DEFAULT 'Standard',
      total_storage_mb REAL DEFAULT 1024,
      monthly_price REAL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      status TEXT DEFAULT 'active',
      start_date TEXT DEFAULT CURRENT_TIMESTAMP,
      end_date TEXT DEFAULT '',
      cancelled_at TEXT DEFAULT '',
      previous_storage_mb REAL DEFAULT 0,
      cancel_reason TEXT DEFAULT '',
      request_id TEXT DEFAULT '',
      grace_period_days INTEGER DEFAULT 5,
      payment_due_date TEXT DEFAULT '',
      is_blocked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  try {
    await db.prepare("ALTER TABLE payment_transactions ADD COLUMN subscription_id TEXT DEFAULT ''").run();
  } catch {}

  // 8. Cartes bancaires tokenisées (PCI-DSS : uniquement authorization_code Paystack + 4 derniers chiffres)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT DEFAULT 'paystack',
      authorization_code TEXT NOT NULL,
      auth_email TEXT NOT NULL,
      card_brand TEXT DEFAULT 'Carte',
      card_type TEXT DEFAULT '',
      last4 TEXT DEFAULT '',
      exp_month TEXT DEFAULT '',
      exp_year TEXT DEFAULT '',
      bank TEXT DEFAULT '',
      country_code TEXT DEFAULT '',
      signature TEXT DEFAULT '',
      reusable INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      auto_storage INTEGER DEFAULT 0,
      auto_ai INTEGER DEFAULT 0,
      auto_ai_on_depleted INTEGER DEFAULT 0,
      auto_apps_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  for (const pmColSql of [
    'ALTER TABLE user_payment_methods ADD COLUMN auto_storage INTEGER DEFAULT 0',
    'ALTER TABLE user_payment_methods ADD COLUMN auto_ai INTEGER DEFAULT 0',
    'ALTER TABLE user_payment_methods ADD COLUMN auto_ai_on_depleted INTEGER DEFAULT 0',
    "ALTER TABLE user_payment_methods ADD COLUMN auto_apps_json TEXT DEFAULT '[]'",
  ]) {
    await db.prepare(pmColSql).run().catch(() => {});
  }
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_user_pm_uid ON user_payment_methods(user_id, is_active, is_default)'
  ).run().catch(() => {});

  // 8b. Registre anti-rejeu des empreintes de liaison de carte (100 FCFA remboursés 1 seule fois)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS card_link_verifications (
      reference TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payment_method_id TEXT DEFAULT '',
      refunded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});

  // 9. Table maîtresse unifiée de TOUS les abonnements (Stockage, Crédits IA, Moyennes & toutes futures apps)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS active_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT DEFAULT '',
      user_email TEXT DEFAULT '',
      user_phone TEXT DEFAULT '',
      product_type TEXT NOT NULL,
      app_key TEXT NOT NULL,
      app_name TEXT DEFAULT '',
      plan_id TEXT DEFAULT '',
      plan_name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      is_infinite INTEGER DEFAULT 0,
      plan_allows_auto INTEGER DEFAULT 0,
      plan_allows_manual INTEGER DEFAULT 1,
      renewal_mode TEXT DEFAULT 'manual',
      user_confirmed_renewal INTEGER DEFAULT 0,
      payment_method_id TEXT DEFAULT '',
      last_channel TEXT DEFAULT '',
      last_network_label TEXT DEFAULT '',
      price_amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      billing_cycle TEXT DEFAULT 'monthly',
      duration_days INTEGER DEFAULT 30,
      granted_storage_mb REAL DEFAULT 0,
      granted_ai_credits REAL DEFAULT 0,
      started_at TEXT NOT NULL,
      current_period_start TEXT NOT NULL,
      current_period_end TEXT DEFAULT NULL,
      next_billing_at TEXT DEFAULT NULL,
      grace_until TEXT DEFAULT NULL,
      blocked_at TEXT DEFAULT NULL,
      block_scope TEXT DEFAULT 'service_only',
      cancel_at_period_end INTEGER DEFAULT 0,
      cancelled_at TEXT DEFAULT NULL,
      retry_count INTEGER DEFAULT 0,
      last_charge_attempt_at TEXT DEFAULT NULL,
      last_charge_error TEXT DEFAULT '',
      last_reminder_sent_at TEXT DEFAULT NULL,
      reminder_count INTEGER DEFAULT 0,
      last_transaction_ref TEXT DEFAULT '',
      last_email_at TEXT DEFAULT NULL,
      last_email_type TEXT DEFAULT '',
      last_email_status TEXT DEFAULT '',
      admin_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  for (const colSql of [
    'ALTER TABLE active_subscriptions ADD COLUMN last_email_at TEXT DEFAULT NULL',
    "ALTER TABLE active_subscriptions ADD COLUMN last_email_type TEXT DEFAULT ''",
    "ALTER TABLE active_subscriptions ADD COLUMN last_email_status TEXT DEFAULT ''",
  ]) {
    await db.prepare(colSql).run().catch(() => {});
  }
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_active_subs_user ON active_subscriptions(user_id, status, product_type)'
  ).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_active_subs_billing ON active_subscriptions(status, renewal_mode, next_billing_at)'
  ).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_active_subs_scope ON active_subscriptions(product_type, app_key, status)'
  ).run().catch(() => {});

  // 10. Journal d'audit des événements d'abonnements (changement auto/manuel, ajout carte, échecs, actions admin)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS subscription_events (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT DEFAULT 'system',
      details_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sub_events_sub ON subscription_events(subscription_id, created_at)'
  ).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events(user_id, created_at)'
  ).run().catch(() => {});

  // 11. Politiques configurables de relances, délais de grâce & blocages (global / produit / app / abonnement)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_policy_rules (
      id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      label TEXT DEFAULT '',
      pre_expiry_days_json TEXT DEFAULT '[7,3,1]',
      auto_notice_days INTEGER DEFAULT 3,
      overdue_interval_hours INTEGER DEFAULT 48,
      overdue_max_reminders INTEGER DEFAULT 5,
      grace_period_days INTEGER DEFAULT 5,
      block_scope TEXT DEFAULT 'service_only',
      retry_intervals_hours_json TEXT DEFAULT '[48,96]',
      email_on_purchase INTEGER DEFAULT 1,
      email_on_fail INTEGER DEFAULT 1,
      email_on_block INTEGER DEFAULT 1,
      auto_unblock_on_payment INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(scope_type, scope_key)
    )
  `).run().catch(() => {});

  for (const seed of [
    ['policy_global_default', 'global', 'default', 'Règle globale par défaut', 5, 'service_only', 48],
    ['policy_product_storage', 'product_type', 'storage', 'Stockage Cloud', 7, 'read_only', 48],
    ['policy_product_ai', 'product_type', 'ai', 'Crédits IA StudyCloud', 3, 'service_only', 48],
    ['policy_app_moyennes', 'app', 'moyennes', 'Application Moyennes', 5, 'service_only', 48],
  ]) {
    await db.prepare(
      `INSERT OR IGNORE INTO billing_policy_rules (
         id, scope_type, scope_key, label, grace_period_days, block_scope, overdue_interval_hours
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(...seed).run().catch(() => {});
  }

  // 12. Journal des emails de facturation & suivi Resend (envoyé / délivré / ouvert / échec)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_email_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT DEFAULT '',
      transaction_ref TEXT DEFAULT '',
      email_to TEXT NOT NULL,
      email_type TEXT NOT NULL,
      trigger_source TEXT DEFAULT 'auto',
      subject TEXT DEFAULT '',
      body_preview TEXT DEFAULT '',
      resend_message_id TEXT DEFAULT '',
      delivery_status TEXT DEFAULT 'sent',
      error_message TEXT DEFAULT '',
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      delivered_at TEXT DEFAULT NULL,
      opened_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_bill_email_user ON billing_email_logs(user_id, sent_at)'
  ).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_bill_email_sub ON billing_email_logs(subscription_id, sent_at)'
  ).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_bill_email_resend ON billing_email_logs(resend_message_id)'
  ).run().catch(() => {});

  ensuredDbSet.add(db);
}

function parseIntArrayJson(raw: unknown, fallback: number[]): number[] {
  if (Array.isArray(raw)) {
    const nums = raw.map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n) && n >= 0);
    return nums.length > 0 ? nums : fallback;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const nums = parsed.map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n) && n >= 0);
        if (nums.length > 0) return nums;
      }
    } catch {}
  }
  return fallback;
}

/**
 * Résout la politique effective selon la hiérarchie à 3 niveaux :
 * 1. Surcharge individuelle sur l'abonnement (`subscription:<subId>`)
 * 2. Règle spécifique à l'application (`app:<appKey>`)
 * 3. Règle du type de produit (`product_type:<storage|ai|app>`)
 * 4. Règle globale par défaut (`global:default`)
 */
export async function resolveEffectiveBillingPolicy(
  db: any,
  params: { productType?: string; appKey?: string; subscriptionId?: string }
): Promise<EffectiveBillingPolicy> {
  await ensurePaystackBillingTables(db);
  const candidates: Array<{ scopeType: 'subscription' | 'app' | 'product_type' | 'global'; scopeKey: string }> = [];
  if (params.subscriptionId) {
    candidates.push({ scopeType: 'subscription', scopeKey: String(params.subscriptionId) });
  }
  if (params.appKey) {
    candidates.push({ scopeType: 'app', scopeKey: sanitizeAppKey(params.appKey) });
  }
  if (params.productType) {
    candidates.push({ scopeType: 'product_type', scopeKey: String(params.productType).toLowerCase() });
  }
  candidates.push({ scopeType: 'global', scopeKey: 'default' });

  let matched: any = null;
  for (const c of candidates) {
    const row = await db
      .prepare('SELECT * FROM billing_policy_rules WHERE scope_type = ? AND scope_key = ? AND is_active = 1 LIMIT 1')
      .bind(c.scopeType, c.scopeKey)
      .first()
      .catch(() => null);
    if (row) {
      matched = row;
      break;
    }
  }

  return {
    scopeType: (matched?.scope_type || 'global') as EffectiveBillingPolicy['scopeType'],
    scopeKey: String(matched?.scope_key || 'default'),
    preExpiryDays: parseIntArrayJson(matched?.pre_expiry_days_json, [7, 3, 1]),
    autoNoticeDays: Math.max(0, Math.min(30, Number(matched?.auto_notice_days ?? 3))),
    overdueIntervalHours: Math.max(1, Math.min(720, Number(matched?.overdue_interval_hours ?? 48))),
    overdueMaxReminders: Math.max(0, Math.min(30, Number(matched?.overdue_max_reminders ?? 5))),
    gracePeriodDays: Math.max(0, Math.min(90, Number(matched?.grace_period_days ?? 5))),
    blockScope: normalizeBlockScope(matched?.block_scope),
    retryIntervalsHours: parseIntArrayJson(matched?.retry_intervals_hours_json, [48, 96]),
    emailOnPurchase: matched ? Number(matched.email_on_purchase) !== 0 : true,
    emailOnFail: matched ? Number(matched.email_on_fail) !== 0 : true,
    emailOnBlock: matched ? Number(matched.email_on_block) !== 0 : true,
    autoUnblockOnPayment: matched ? Number(matched.auto_unblock_on_payment) !== 0 : true,
  };
}

export async function recordSubscriptionEvent(
  db: any,
  params: {
    subscriptionId: string;
    userId: string;
    eventType: string;
    actor?: 'user' | 'admin' | 'cron' | 'webhook' | 'system';
    details?: Record<string, any>;
  }
): Promise<void> {
  const evId = `subev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db
    .prepare(
      `INSERT INTO subscription_events (id, subscription_id, user_id, event_type, actor, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(
      evId,
      String(params.subscriptionId || ''),
      String(params.userId || ''),
      String(params.eventType || 'updated'),
      String(params.actor || 'system'),
      JSON.stringify(params.details || {}).slice(0, 4000)
    )
    .run()
    .catch(() => {});
}

interface CardServicePermissionsInput {
  mode: 'replace' | 'merge';
  autoStorage?: boolean;
  autoAi?: boolean;
  autoAiOnDepleted?: boolean;
  autoApps?: string[];
}

async function upsertUserPaymentMethodFromPaystack(
  db: any,
  params: {
    userId: string;
    authEmail: string;
    channel: string;
    paystackData: any;
    servicePermissions?: CardServicePermissionsInput;
  }
): Promise<any | null> {
  const auth = params.paystackData?.authorization || {};
  const authCode = String(auth?.authorization_code || '').trim();
  const reusable = auth?.reusable === true || Number(auth?.reusable) === 1;
  if (params.channel !== 'card' || !reusable || !authCode) return null;

  const signature = String(auth?.signature || '').trim();
  const brand = String(auth?.brand || auth?.card_type || 'Carte').trim();
  const cardType = String(auth?.card_type || '').trim();
  const last4 = String(auth?.last4 || '').trim().slice(-4);
  const expMonth = String(auth?.exp_month || '').trim();
  const expYear = String(auth?.exp_year || '').trim();
  const bank = String(auth?.bank || '').trim();
  const countryCode = String(auth?.country_code || '').trim().toUpperCase();
  const authEmail = String(params.paystackData?.customer?.email || params.authEmail || '').trim().toLowerCase();

  let existing: any = null;
  if (signature) {
    existing = await db
      .prepare('SELECT * FROM user_payment_methods WHERE user_id = ? AND signature = ? LIMIT 1')
      .bind(params.userId, signature)
      .first()
      .catch(() => null);
  }
  if (!existing) {
    existing = await db
      .prepare('SELECT * FROM user_payment_methods WHERE user_id = ? AND authorization_code = ? LIMIT 1')
      .bind(params.userId, authCode)
      .first()
      .catch(() => null);
  }

  // Définir cette carte comme carte par défaut de l'utilisateur
  await db
    .prepare('UPDATE user_payment_methods SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .bind(params.userId)
    .run()
    .catch(() => {});

  const perms = params.servicePermissions;
  let nextAutoStorage = existing ? Number(existing.auto_storage || 0) : 0;
  let nextAutoAi = existing ? Number(existing.auto_ai || 0) : 0;
  let nextAutoAiOnDepleted = existing ? Number(existing.auto_ai_on_depleted || 0) : 0;
  let nextAutoApps = existing ? parseAutoAppsJson(existing.auto_apps_json) : [];

  if (perms) {
    if (perms.mode === 'replace') {
      nextAutoStorage = perms.autoStorage ? 1 : 0;
      nextAutoAi = perms.autoAi ? 1 : 0;
      nextAutoAiOnDepleted = nextAutoAi === 1 && perms.autoAiOnDepleted ? 1 : 0;
      nextAutoApps = parseAutoAppsJson(perms.autoApps || []);
    } else {
      if (perms.autoStorage) nextAutoStorage = 1;
      if (perms.autoAi) nextAutoAi = 1;
      if (nextAutoAi === 1 && perms.autoAiOnDepleted) nextAutoAiOnDepleted = 1;
      if (nextAutoAi === 0) nextAutoAiOnDepleted = 0;
      const addApps = parseAutoAppsJson(perms.autoApps || []);
      if (addApps.length > 0) {
        nextAutoApps =
          nextAutoApps.includes('*') || addApps.includes('*')
            ? ['*']
            : Array.from(new Set([...nextAutoApps, ...addApps]));
      }
    }
  }
  const nextAutoAppsJson = JSON.stringify(nextAutoApps);

  if (existing) {
    await db
      .prepare(
        `UPDATE user_payment_methods
         SET authorization_code = ?, auth_email = ?, card_brand = ?, card_type = ?,
             last4 = ?, exp_month = ?, exp_year = ?, bank = ?, country_code = ?,
             reusable = 1, is_default = 1, is_active = 1,
             auto_storage = ?, auto_ai = ?, auto_ai_on_depleted = ?, auto_apps_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        authCode,
        authEmail,
        brand,
        cardType,
        last4,
        expMonth,
        expYear,
        bank,
        countryCode,
        nextAutoStorage,
        nextAutoAi,
        nextAutoAiOnDepleted,
        nextAutoAppsJson,
        existing.id
      )
      .run()
      .catch(() => {});
    return await db.prepare('SELECT * FROM user_payment_methods WHERE id = ? LIMIT 1').bind(existing.id).first();
  }

  const pmId = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db
    .prepare(
      `INSERT INTO user_payment_methods (
         id, user_id, provider, authorization_code, auth_email, card_brand, card_type,
         last4, exp_month, exp_year, bank, country_code, signature, reusable, is_default, is_active,
         auto_storage, auto_ai, auto_ai_on_depleted, auto_apps_json
       ) VALUES (?, ?, 'paystack', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, ?, ?, ?)`
    )
    .bind(
      pmId,
      params.userId,
      authCode,
      authEmail,
      brand,
      cardType,
      last4,
      expMonth,
      expYear,
      bank,
      countryCode,
      signature,
      nextAutoStorage,
      nextAutoAi,
      nextAutoAiOnDepleted,
      nextAutoAppsJson
    )
    .run()
    .catch(() => {});

  return await db.prepare('SELECT * FROM user_payment_methods WHERE id = ? LIMIT 1').bind(pmId).first();
}

async function findPreAuthorizedCardForService(
  db: any,
  userId: string,
  productType: string,
  appKey: string
): Promise<any | null> {
  const res = await db
    .prepare(
      `SELECT * FROM user_payment_methods
       WHERE user_id = ? AND is_active = 1 AND reusable = 1
       ORDER BY is_default DESC, updated_at DESC`
    )
    .bind(userId)
    .all()
    .catch(() => ({ results: [] }));
  for (const pm of res.results || []) {
    const pType = String(productType || '').toLowerCase();
    if (pType === 'storage' && Number(pm.auto_storage) === 1) return pm;
    if (pType === 'ai' && Number(pm.auto_ai) === 1) return pm;
    if (pType === 'app') {
      const apps = parseAutoAppsJson(pm.auto_apps_json);
      const cleanKey = sanitizeAppKey(appKey);
      if (apps.includes('*') || (cleanKey && apps.includes(cleanKey))) return pm;
    }
  }
  return null;
}

async function syncCardPermissionFlagForService(
  db: any,
  pmId: string,
  userId: string,
  productType: string,
  appKey: string,
  enable: boolean
): Promise<any | null> {
  if (!pmId) return null;
  const pm: any = await db
    .prepare('SELECT * FROM user_payment_methods WHERE id = ? AND user_id = ? AND is_active = 1 LIMIT 1')
    .bind(pmId, userId)
    .first()
    .catch(() => null);
  if (!pm) return null;

  let nextStorage = Number(pm.auto_storage || 0);
  let nextAi = Number(pm.auto_ai || 0);
  let nextAiDep = Number(pm.auto_ai_on_depleted || 0);
  let nextApps = parseAutoAppsJson(pm.auto_apps_json);
  const pType = String(productType || '').toLowerCase();

  if (pType === 'storage') {
    nextStorage = enable ? 1 : 0;
  } else if (pType === 'ai') {
    nextAi = enable ? 1 : 0;
    if (nextAi === 0) nextAiDep = 0;
  } else if (pType === 'app') {
    const cleanKey = sanitizeAppKey(appKey);
    if (enable) {
      if (cleanKey && !nextApps.includes('*') && !nextApps.includes(cleanKey)) {
        nextApps = [...nextApps, cleanKey];
      }
    } else if (cleanKey && !nextApps.includes('*')) {
      nextApps = nextApps.filter((k) => k !== cleanKey);
    }
  }

  await db
    .prepare(
      `UPDATE user_payment_methods
       SET auto_storage = ?, auto_ai = ?, auto_ai_on_depleted = ?, auto_apps_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    )
    .bind(nextStorage, nextAi, nextAiDep, JSON.stringify(nextApps), pmId, userId)
    .run()
    .catch(() => {});

  return await db.prepare('SELECT * FROM user_payment_methods WHERE id = ? LIMIT 1').bind(pmId).first();
}

// ============================================================================
// LECTURE CONFIGURATION & CONTRÔLE D'ACCÈS APPLICATION
// ============================================================================

export async function readPaymentGatewayConfig(
  db: any,
  rawEnv: Record<string, any>
): Promise<PaymentGatewayConfig> {
  await ensurePaystackBillingTables(db);
  const row: any = await db
    .prepare("SELECT * FROM payment_gateway_config WHERE id = 'default' LIMIT 1")
    .first()
    .catch(() => null);
  const secretKey = getPaystackSecretKey(rawEnv);
  return {
    provider: row?.provider || 'paystack',
    paystackEnabled: row ? Number(row.paystack_enabled) !== 0 : true,
    manualReceiptEnabled: row ? Number(row.manual_receipt_enabled) !== 0 : true,
    defaultCurrency: String(row?.default_currency || 'XOF').toUpperCase(),
    callbackUrl: String(row?.callback_url || DEFAULT_CALLBACK_URL).trim() || DEFAULT_CALLBACK_URL,
    mode: detectPaystackMode(secretKey),
  };
}

/**
 * Vérifie côté serveur si `userId` a le droit d'accéder à l'application `appKey` (ex: 'moyennes').
 * Utilisé aussi bien par `GET /api/apps/access/:appKey` que par les gardes-fous backend (`/api/teacher/*`).
 */
export async function checkUserAppAccess(
  db: any,
  userId: string,
  appKey: string,
  nowMs = Date.now()
): Promise<AppAccessCheckResult> {
  await ensurePaystackBillingTables(db);
  const cleanKey = sanitizeAppKey(appKey);
  const app: any = await db
    .prepare('SELECT * FROM monetized_apps WHERE app_key = ? LIMIT 1')
    .bind(cleanKey)
    .first()
    .catch(() => null);

  // Si l'application n'est pas déclarée payante (ou désactivée en mode gratuit), accès libre !
  if (!app || Number(app.is_paid) !== 1) {
    return {
      allowed: true,
      isPaidApp: false,
      status: 'free',
      app: app || null,
      entitlement: null,
      canStartTrial: false,
      daysRemaining: null,
    };
  }

  const ent: any = await db
    .prepare('SELECT * FROM user_app_entitlements WHERE user_id = ? AND app_key = ? LIMIT 1')
    .bind(String(userId), cleanKey)
    .first()
    .catch(() => null);

  const trialDays = Math.max(0, Number(app.trial_days) || 0);
  const graceDays = Math.max(0, Number(app.grace_period_days) || 0);

  if (!ent) {
    return {
      allowed: false,
      isPaidApp: true,
      status: 'none',
      reason: `Un abonnement ou un accès actif est requis pour utiliser ${app.name}.`,
      app,
      entitlement: null,
      canStartTrial: trialDays > 0,
      daysRemaining: null,
    };
  }

  if (ent.status === 'revoked') {
    return {
      allowed: false,
      isPaidApp: true,
      status: 'revoked',
      reason: `Votre accès à ${app.name} a été révoqué par l'administrateur.`,
      app,
      entitlement: ent,
      canStartTrial: false,
      daysRemaining: 0,
    };
  }

  // Accès infini / à vie (expires_at === null ou vide)
  if (!ent.expires_at || ent.access_type === 'infinite') {
    const activeOk = ent.status === 'active' || ent.status === 'trial';
    return {
      allowed: activeOk,
      isPaidApp: true,
      status: activeOk ? (ent.status === 'trial' ? 'trial' : 'active') : 'expired',
      app,
      entitlement: ent,
      canStartTrial: false,
      daysRemaining: null,
    };
  }

  const expiresMs = Date.parse(ent.expires_at);
  if (Number.isFinite(expiresMs) && expiresMs > nowMs) {
    const daysRemaining = Math.max(1, Math.ceil((expiresMs - nowMs) / (24 * 60 * 60 * 1000)));
    return {
      allowed: true,
      isPaidApp: true,
      status: ent.status === 'trial' ? 'trial' : 'active',
      app,
      entitlement: ent,
      canStartTrial: false,
      daysRemaining,
    };
  }

  // Vérifier la période de grâce (uniquement pour les accès payants, pas pour un essai expiré)
  if (ent.status !== 'trial' && graceDays > 0 && Number.isFinite(expiresMs)) {
    const graceEndMs = ent.grace_until
      ? Date.parse(ent.grace_until)
      : expiresMs + graceDays * 24 * 60 * 60 * 1000;
    if (Number.isFinite(graceEndMs) && graceEndMs > nowMs) {
      const daysRemaining = Math.max(1, Math.ceil((graceEndMs - nowMs) / (24 * 60 * 60 * 1000)));
      return {
        allowed: true,
        isPaidApp: true,
        status: 'grace',
        reason: `Période de grâce active (${daysRemaining} jour(s) restant(s) pour renouveler).`,
        app,
        entitlement: ent,
        canStartTrial: false,
        daysRemaining,
      };
    }
  }

  // Expiré : mettre à jour le statut proprement sans jamais supprimer les données de l'utilisateur
  if (ent.status !== 'expired') {
    await db
      .prepare("UPDATE user_app_entitlements SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(ent.id)
      .run()
      .catch(() => {});
  }

  return {
    allowed: false,
    isPaidApp: true,
    status: 'expired',
    reason: `Votre accès à ${app.name} a expiré. Vos données restent intactes ; renouvelez pour continuer.`,
    app,
    entitlement: { ...ent, status: 'expired' },
    canStartTrial: false,
    daysRemaining: 0,
  };
}

// ============================================================================
// CARTE MAÎTRESSE DE STOCKAGE ÉVOLUTIF & CALCUL AU PRORATA (100 % D1)
// ============================================================================

export interface StorageMasterCardConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  stepValue: number;
  stepUnit: 'MB' | 'GB';
  stepMb: number;
  pricePerStep: number;
  pricePerStepFcfa: number;
  primaryCurrency: 'XOF' | 'USD' | 'EUR';
  durationDays: number;
  maxStorageMb: number;
  billingMode: 'manual' | 'auto';
  prorataEnabled: boolean;
  updatedAt?: string | null;
}

export interface StorageMasterUserState {
  welcomeMb: number;
  paidMb: number;
  bonusMb: number;
  totalAllowedMb: number;
  usedBytes: number;
  usedMb: number;
  usagePercent: number;
  hasActiveSubscription: boolean;
  isExpired: boolean;
  inGrace: boolean;
  isInfinite: boolean;
  subscriptionId: string | null;
  planId: string;
  planName: string;
  monthlyPriceFcfa: number;
  currency: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  durationDays: number;
  daysUsed: number;
  daysRemaining: number;
  remainingFraction: number;
  consumedCostFcfa: number;
  unusedCreditFcfa: number;
  renewalMode: 'manual' | 'auto' | 'infinite';
}

export interface StorageMasterQuote {
  ok: boolean;
  error?: string;
  action: 'upgrade' | 'renew';
  currentPaidMb: number;
  targetPaidMb: number;
  addedMb: number;
  addedSteps: number;
  oldMonthlyPriceFcfa: number;
  newMonthlyPriceFcfa: number;
  prorataApplied: boolean;
  daysUsed: number;
  daysRemaining: number;
  consumedCostFcfa: number;
  unusedCreditFcfa: number;
  amountDueFcfa: number;
  durationDays: number;
  billingMode: 'manual' | 'auto';
}

export function formatStorageMbFr(mb: number): string {
  const val = Math.max(0, Number(mb) || 0);
  if (val >= 1024) {
    const gb = val / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1).replace(/\.0$/, '')} Go`;
  }
  return `${Math.round(val * 10) / 10} Mo`;
}

function convertPriceToFcfa(price: number, currency: string): number {
  const p = Math.max(0, Number(price) || 0);
  const c = String(currency || 'XOF').toUpperCase();
  if (c === 'USD') return Math.round(p * 650);
  if (c === 'EUR') return Math.round(p * 655.957);
  return Math.round(p);
}

export async function readStorageMasterCardConfig(db: any): Promise<StorageMasterCardConfig> {
  const row: any = await db
    .prepare("SELECT * FROM storage_master_card_config WHERE id = 'default' LIMIT 1")
    .first()
    .catch(() => null);

  const stepUnit: 'MB' | 'GB' = String(row?.step_unit || 'MB').toUpperCase() === 'GB' ? 'GB' : 'MB';
  const rawStep = Number(row?.step_value ?? 100);
  const stepValue = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 100;
  const stepMb = stepUnit === 'GB' ? stepValue * 1024 : stepValue;
  const rawCurr = String(row?.primary_currency || 'XOF').toUpperCase();
  const primaryCurrency: 'XOF' | 'USD' | 'EUR' =
    rawCurr === 'USD' ? 'USD' : rawCurr === 'EUR' ? 'EUR' : 'XOF';
  const rawPrice = Number(row?.price_per_step ?? 100);
  const pricePerStep = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 100;
  const pricePerStepFcfa = Math.max(1, convertPriceToFcfa(pricePerStep, primaryCurrency));
  const durationDays = Math.max(1, Math.min(3650, Math.round(Number(row?.duration_days ?? 30) || 30)));
  const maxStorageMb = Math.max(0, Number(row?.max_storage_mb ?? 0) || 0);
  const billingMode: 'manual' | 'auto' =
    String(row?.billing_mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual';

  return {
    enabled: row ? Number(row.enabled ?? 1) !== 0 : true,
    title: String(row?.title || 'Mon Stockage Évolutif').trim() || 'Mon Stockage Évolutif',
    subtitle:
      String(row?.subtitle || 'Augmentez votre espace à tout moment selon vos besoins').trim() ||
      'Augmentez votre espace à tout moment selon vos besoins',
    stepValue,
    stepUnit,
    stepMb,
    pricePerStep,
    pricePerStepFcfa,
    primaryCurrency,
    durationDays,
    maxStorageMb,
    billingMode,
    prorataEnabled: row ? Number(row.prorata_enabled ?? 1) !== 0 : true,
    updatedAt: row?.updated_at || null,
  };
}

export async function readStorageMasterUserState(
  db: any,
  userId: string,
  config: StorageMasterCardConfig
): Promise<StorageMasterUserState> {
  let welcomeMb = 100;
  const globalCfg: any = await db
    .prepare(
      "SELECT default_welcome_total_mb, welcome_storage_mb FROM storage_global_config WHERE id IN ('global', 'default') ORDER BY updated_at DESC LIMIT 1"
    )
    .first()
    .catch(() => null);
  if (globalCfg) {
    welcomeMb = Number(globalCfg.default_welcome_total_mb ?? globalCfg.welcome_storage_mb ?? 100);
  }

  let paidMb = 0;
  let bonusMb = 0;
  let usedBytes = 0;
  let quotaPlanName = '';

  if (userId && userId !== 'default-user') {
    const quotaRow: any = await db
      .prepare('SELECT * FROM user_storage_quotas WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);
    if (quotaRow) {
      if (quotaRow.welcome_total_mb !== null && quotaRow.welcome_total_mb !== undefined) {
        welcomeMb = Number(quotaRow.welcome_total_mb);
      }
      paidMb = Math.max(0, Number(quotaRow.paid_total_mb || 0));
      bonusMb = Math.max(0, Number(quotaRow.bonus_total_mb || 0));
      quotaPlanName = String(quotaRow.plan_name || '');
    }

    const usageRow: any = await db
      .prepare('SELECT total_bytes_used, r2_bytes_used, d1_bytes_used FROM user_storage_usage WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);
    if (usageRow) {
      usedBytes = Math.max(
        0,
        Number(usageRow.total_bytes_used ?? (Number(usageRow.r2_bytes_used || 0) + Number(usageRow.d1_bytes_used || 0)))
      );
    } else {
      const fStat: any = await db
        .prepare('SELECT COALESCE(SUM(size), 0) AS totalBytes FROM files WHERE user_id = ?')
        .bind(userId)
        .first()
        .catch(() => null);
      usedBytes = Math.max(0, Number(fStat?.totalBytes || 0));
    }
  }

  const activeSub: any =
    userId && userId !== 'default-user'
      ? await db
          .prepare(
            `SELECT * FROM active_subscriptions
             WHERE user_id = ? AND product_type = 'storage'
             ORDER BY updated_at DESC LIMIT 1`
          )
          .bind(userId)
          .first()
          .catch(() => null)
      : null;

  const nowMs = Date.now();
  const isInfinite = Boolean(
    activeSub && (Number(activeSub.is_infinite) === 1 || activeSub.renewal_mode === 'infinite')
  );
  const endMs = activeSub?.current_period_end ? Date.parse(activeSub.current_period_end) : NaN;
  const graceMs = activeSub?.grace_until ? Date.parse(activeSub.grace_until) : NaN;
  const subDurationDays = Math.max(1, Number(activeSub?.duration_days || config.durationDays || 30));
  const rawStartMs = activeSub?.current_period_start
    ? Date.parse(activeSub.current_period_start)
    : activeSub?.started_at
    ? Date.parse(activeSub.started_at)
    : NaN;

  const isActiveStatus = Boolean(activeSub && ['active', 'trial'].includes(String(activeSub.status || '')));
  const isNotExpiredByTime = isInfinite || (Number.isFinite(endMs) && endMs > nowMs);
  const hasActiveSubscription = Boolean(isActiveStatus && isNotExpiredByTime);
  const inGrace = Boolean(
    activeSub &&
      !hasActiveSubscription &&
      !isInfinite &&
      ((Number.isFinite(graceMs) && graceMs > nowMs) || String(activeSub.status) === 'grace')
  );
  const isExpired = Boolean(
    activeSub && !hasActiveSubscription && !isInfinite && (!Number.isFinite(endMs) || endMs <= nowMs)
  );

  if (paidMb === 0 && activeSub && Number(activeSub.granted_storage_mb || 0) > 0 && (hasActiveSubscription || inGrace)) {
    paidMb = Number(activeSub.granted_storage_mb || 0);
  }

  const fallbackMonthlyFcfa =
    paidMb > 0 ? Math.max(1, Math.round((paidMb / config.stepMb) * config.pricePerStepFcfa)) : 0;
  const subPriceFcfa = activeSub ? convertPriceToFcfa(Number(activeSub.price_amount || 0), activeSub.currency || 'XOF') : 0;
  const monthlyPriceFcfa = paidMb > 0 ? (subPriceFcfa > 0 ? subPriceFcfa : fallbackMonthlyFcfa) : 0;

  let daysRemaining = 0;
  let daysUsed = 0;
  let remainingFraction = 0;
  let consumedCostFcfa = 0;
  let unusedCreditFcfa = 0;

  if (hasActiveSubscription && !isInfinite && Number.isFinite(endMs) && endMs > nowMs) {
    const cycleMs = subDurationDays * 24 * 60 * 60 * 1000;
    const effectiveStartMs =
      Number.isFinite(rawStartMs) && rawStartMs < endMs && endMs - rawStartMs >= 60_000
        ? rawStartMs
        : endMs - cycleMs;
    const totalMs = Math.max(60_000, endMs - effectiveStartMs);
    const remainingMs = Math.max(0, endMs - nowMs);
    remainingFraction = Math.min(1, Math.max(0, remainingMs / totalMs));
    daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    daysUsed = Math.max(0, subDurationDays - daysRemaining);
    consumedCostFcfa = Math.round(monthlyPriceFcfa * (1 - remainingFraction));
    unusedCreditFcfa = Math.max(0, monthlyPriceFcfa - consumedCostFcfa);
  }

  const totalAllowedMb = Math.max(0, welcomeMb + paidMb + bonusMb);
  const usedMb = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
  const usagePercent =
    totalAllowedMb > 0 ? Math.min(100, Math.round((usedMb / totalAllowedMb) * 1000) / 10) : 0;

  return {
    welcomeMb,
    paidMb,
    bonusMb,
    totalAllowedMb,
    usedBytes,
    usedMb,
    usagePercent,
    hasActiveSubscription,
    isExpired,
    inGrace,
    isInfinite,
    subscriptionId: activeSub?.id || null,
    planId: String(activeSub?.plan_id || ''),
    planName:
      String(activeSub?.plan_name || '').trim() ||
      (paidMb > 0 ? `Stockage ${formatStorageMbFr(paidMb)}` : quotaPlanName || 'Plan Étudiant Gratuit'),
    monthlyPriceFcfa,
    currency: String(activeSub?.currency || config.primaryCurrency || 'XOF'),
    currentPeriodStart: activeSub?.current_period_start || activeSub?.started_at || null,
    currentPeriodEnd: activeSub?.current_period_end || null,
    graceUntil: activeSub?.grace_until || null,
    durationDays: subDurationDays,
    daysUsed,
    daysRemaining,
    remainingFraction,
    consumedCostFcfa,
    unusedCreditFcfa,
    renewalMode: isInfinite
      ? 'infinite'
      : String(activeSub?.renewal_mode || config.billingMode) === 'auto'
      ? 'auto'
      : 'manual',
  };
}

export function computeStorageMasterQuote(
  config: StorageMasterCardConfig,
  userState: StorageMasterUserState,
  action: 'upgrade' | 'renew',
  targetPaidMbInput?: number
): StorageMasterQuote {
  const currentPaidMb = Math.max(0, Number(userState.paidMb || 0));

  if (action === 'renew') {
    if (currentPaidMb <= 0) {
      return {
        ok: false,
        error: "Vous n'avez pas encore d'abonnement stockage actif à renouveler. Ajoutez du stockage avec le bouton +.",
        action: 'renew',
        currentPaidMb,
        targetPaidMb: currentPaidMb,
        addedMb: 0,
        addedSteps: 0,
        oldMonthlyPriceFcfa: 0,
        newMonthlyPriceFcfa: 0,
        prorataApplied: false,
        daysUsed: 0,
        daysRemaining: 0,
        consumedCostFcfa: 0,
        unusedCreditFcfa: 0,
        amountDueFcfa: 0,
        durationDays: config.durationDays,
        billingMode: config.billingMode,
      };
    }

    const renewAmount =
      userState.monthlyPriceFcfa > 0
        ? userState.monthlyPriceFcfa
        : Math.max(1, Math.round((currentPaidMb / config.stepMb) * config.pricePerStepFcfa));

    return {
      ok: true,
      action: 'renew',
      currentPaidMb,
      targetPaidMb: currentPaidMb,
      addedMb: 0,
      addedSteps: 0,
      oldMonthlyPriceFcfa: renewAmount,
      newMonthlyPriceFcfa: renewAmount,
      prorataApplied: false,
      daysUsed: userState.daysUsed,
      daysRemaining: userState.daysRemaining,
      consumedCostFcfa: 0,
      unusedCreditFcfa: 0,
      amountDueFcfa: renewAmount,
      durationDays: config.durationDays,
      billingMode: config.billingMode,
    };
  }

  const targetPaidMb = Number(targetPaidMbInput || 0);
  if (!Number.isFinite(targetPaidMb) || targetPaidMb <= currentPaidMb) {
    return {
      ok: false,
      error: 'Impossible de diminuer le stockage : sélectionnez un quota supérieur à votre stockage actuel.',
      action: 'upgrade',
      currentPaidMb,
      targetPaidMb: currentPaidMb,
      addedMb: 0,
      addedSteps: 0,
      oldMonthlyPriceFcfa: userState.monthlyPriceFcfa,
      newMonthlyPriceFcfa: userState.monthlyPriceFcfa,
      prorataApplied: false,
      daysUsed: userState.daysUsed,
      daysRemaining: userState.daysRemaining,
      consumedCostFcfa: 0,
      unusedCreditFcfa: 0,
      amountDueFcfa: 0,
      durationDays: config.durationDays,
      billingMode: config.billingMode,
    };
  }

  const addedMb = Math.round((targetPaidMb - currentPaidMb) * 100) / 100;
  const rawSteps = addedMb / config.stepMb;
  const addedSteps = Math.round(rawSteps);
  if (addedSteps < 1 || Math.abs(rawSteps - addedSteps) > 0.02) {
    return {
      ok: false,
      error: `L'augmentation doit avancer par paliers de ${config.stepValue} ${config.stepUnit === 'GB' ? 'Go' : 'Mo'}.`,
      action: 'upgrade',
      currentPaidMb,
      targetPaidMb,
      addedMb,
      addedSteps: 0,
      oldMonthlyPriceFcfa: userState.monthlyPriceFcfa,
      newMonthlyPriceFcfa: userState.monthlyPriceFcfa,
      prorataApplied: false,
      daysUsed: userState.daysUsed,
      daysRemaining: userState.daysRemaining,
      consumedCostFcfa: 0,
      unusedCreditFcfa: 0,
      amountDueFcfa: 0,
      durationDays: config.durationDays,
      billingMode: config.billingMode,
    };
  }

  const exactTargetMb = Math.round((currentPaidMb + addedSteps * config.stepMb) * 100) / 100;
  if (config.maxStorageMb > 0 && exactTargetMb > config.maxStorageMb) {
    return {
      ok: false,
      error: `Le quota maximal autorisé est de ${formatStorageMbFr(config.maxStorageMb)}.`,
      action: 'upgrade',
      currentPaidMb,
      targetPaidMb: exactTargetMb,
      addedMb: addedSteps * config.stepMb,
      addedSteps,
      oldMonthlyPriceFcfa: userState.monthlyPriceFcfa,
      newMonthlyPriceFcfa: userState.monthlyPriceFcfa,
      prorataApplied: false,
      daysUsed: userState.daysUsed,
      daysRemaining: userState.daysRemaining,
      consumedCostFcfa: 0,
      unusedCreditFcfa: 0,
      amountDueFcfa: 0,
      durationDays: config.durationDays,
      billingMode: config.billingMode,
    };
  }

  const oldMonthlyPriceFcfa =
    currentPaidMb > 0
      ? userState.monthlyPriceFcfa > 0
        ? userState.monthlyPriceFcfa
        : Math.round((currentPaidMb / config.stepMb) * config.pricePerStepFcfa)
      : 0;
  const addedMonthlyFcfa = Math.round(addedSteps * config.pricePerStepFcfa);
  const newMonthlyPriceFcfa = oldMonthlyPriceFcfa + addedMonthlyFcfa;

  const canApplyProrata = Boolean(
    config.prorataEnabled &&
      currentPaidMb > 0 &&
      userState.hasActiveSubscription &&
      !userState.isExpired &&
      !userState.isInfinite &&
      userState.unusedCreditFcfa > 0
  );
  const unusedCreditFcfa = canApplyProrata
    ? Math.min(userState.unusedCreditFcfa, oldMonthlyPriceFcfa)
    : 0;
  const consumedCostFcfa = canApplyProrata ? userState.consumedCostFcfa : 0;
  const rawNet = Math.max(0, newMonthlyPriceFcfa - unusedCreditFcfa);
  const amountDueFcfa =
    newMonthlyPriceFcfa >= 100 ? Math.max(100, rawNet) : Math.max(1, rawNet);

  return {
    ok: true,
    action: 'upgrade',
    currentPaidMb,
    targetPaidMb: exactTargetMb,
    addedMb: Math.round(addedSteps * config.stepMb * 100) / 100,
    addedSteps,
    oldMonthlyPriceFcfa,
    newMonthlyPriceFcfa,
    prorataApplied: canApplyProrata && unusedCreditFcfa > 0,
    daysUsed: canApplyProrata ? userState.daysUsed : 0,
    daysRemaining: canApplyProrata ? userState.daysRemaining : 0,
    consumedCostFcfa,
    unusedCreditFcfa,
    amountDueFcfa,
    durationDays: config.durationDays,
    billingMode: config.billingMode,
  };
}

// ============================================================================
// LIVRAISON ATOMIQUE ANTI-DOUBLE CRÉDIT (STORAGE / AI / APPS)
// ============================================================================

async function loadSubscriptionBundleForTx(db: any, txRow: any): Promise<{
  subscription: any | null;
  paymentMethod: any | null;
  renewalUiConfig: {
    renewalMode: RenewalMode;
    canChooseAutoOnSuccessScreen: boolean;
    defaultSelectedMode: RenewalMode;
    isInfinite: boolean;
    planAllowsAuto: boolean;
    planAllowsManual: boolean;
    hasReusableCard: boolean;
  };
}> {
  const subId = String(txRow?.subscription_id || '').trim();
  const sub: any = subId
    ? await db.prepare('SELECT * FROM active_subscriptions WHERE id = ? LIMIT 1').bind(subId).first().catch(() => null)
    : await db
        .prepare('SELECT * FROM active_subscriptions WHERE last_transaction_ref = ? ORDER BY updated_at DESC LIMIT 1')
        .bind(String(txRow?.reference || ''))
        .first()
        .catch(() => null);

  let pmRow: any = null;
  if (sub?.payment_method_id) {
    pmRow = await db
      .prepare('SELECT * FROM user_payment_methods WHERE id = ? AND is_active = 1 LIMIT 1')
      .bind(String(sub.payment_method_id))
      .first()
      .catch(() => null);
  }
  const isInfinite = Number(sub?.is_infinite) === 1 || String(txRow?.billing_mode) === 'infinite';
  const planAllowsAuto = Number(sub?.plan_allows_auto) === 1;
  const planAllowsManual = sub ? Number(sub.plan_allows_manual) === 1 : !isInfinite;
  const hasReusableCard = Boolean(pmRow && Number(pmRow.reusable) === 1);
  const renewalMode = (sub?.renewal_mode || (isInfinite ? 'infinite' : 'manual')) as RenewalMode;

  return {
    subscription: sub
      ? {
          ...sub,
          countdown: computeSubscriptionCountdown(sub.current_period_end, sub.is_infinite, sub.grace_until),
        }
      : null,
    paymentMethod: maskPaymentMethodForClient(pmRow),
    renewalUiConfig: {
      renewalMode,
      canChooseAutoOnSuccessScreen:
        !isInfinite &&
        planAllowsAuto &&
        hasReusableCard &&
        (String(txRow?.channel || sub?.last_channel || '') === 'card' || renewalMode === 'auto'),
      defaultSelectedMode: renewalMode,
      isInfinite,
      planAllowsAuto,
      planAllowsManual,
      hasReusableCard,
    },
  };
}

async function fulfillPaidTransaction(
  db: any,
  txRow: any,
  paystackData: any,
  runtimeOpts?: { rawEnv?: Record<string, any>; fetchFn?: typeof fetch }
): Promise<{
  alreadyFulfilled: boolean;
  transaction: any;
  deliverySummary: string;
  subscription: any | null;
  paymentMethod: any | null;
  renewalUiConfig: any;
}> {
  const nowIso = new Date().toISOString();
  const paidMinor = Number(paystackData?.amount || txRow.expected_amount_minor || 0);
  const paidMajor = Math.round((paidMinor / 100) * 100) / 100;
  const { channel, networkLabel } = extractPaystackNetworkLabel(paystackData);
  const auth = paystackData?.authorization || {};
  const authCode = String(auth?.authorization_code || '');
  const reusable = auth?.reusable === true ? 1 : 0;
  const paystackTxId = String(paystackData?.id || '');
  const subCode = String(
    paystackData?.subscription_code ||
      paystackData?.plan_object?.plan_code ||
      txRow.paystack_subscription_code ||
      ''
  );

  // VERROU ATOMIQUE D1 : seul l'appel qui fait passer status de 'pending'/'failed' -> 'paid' livre la marchandise !
  const lockRes = await db
    .prepare(
      `UPDATE payment_transactions
       SET status = 'paid',
           paid_amount = ?,
           paid_amount_minor = ?,
           channel = ?,
           network_label = ?,
           paystack_tx_id = ?,
           paystack_authorization_code = ?,
           paystack_subscription_code = CASE WHEN ? != '' THEN ? ELSE paystack_subscription_code END,
           reusable = ?,
           fulfilled_at = ?,
           raw_verify_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE reference = ? AND status != 'paid'`
    )
    .bind(
      paidMajor,
      paidMinor,
      channel,
      networkLabel,
      paystackTxId,
      authCode,
      subCode,
      subCode,
      reusable,
      nowIso,
      JSON.stringify(paystackData || {}).slice(0, 16000),
      txRow.reference
    )
    .run();

  const changedRows = Number(lockRes?.meta?.changes || 0);
  if (changedRows === 0) {
    const existing = await db
      .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
      .bind(txRow.reference)
      .first();
    const bundle = await loadSubscriptionBundleForTx(db, existing || txRow);
    return {
      alreadyFulfilled: true,
      transaction: existing || txRow,
      deliverySummary: 'Transaction déjà validée et livrée.',
      ...bundle,
    };
  }

  const userId = String(txRow.user_id);
  const billingMode = normalizeBillingMode(txRow.billing_mode);
  const durationDays = normalizeDurationDays(txRow.duration_days, billingMode);
  let deliverySummary = 'Paiement confirmé.';
  let grantedStorageMb = 0;
  let grantedAiCredits = 0;
  let entitlementExpiresAt: string | null = null;
  let loadedPlanRow: any = null;
  let resolvedAppKey = sanitizeAppKey(txRow.app_key || txRow.product_type || '');
  let resolvedAppName = String(txRow.app_name || '');

  let masterRecurringPriceOverride: number | null = null;
  let masterGrantedStorageOverride: number | null = null;
  let masterPlanNameOverride: string | null = null;

  if (txRow.product_type === 'storage') {
    const masterAction = String(txRow.master_action || '').trim();
    const isMasterTx =
      txRow.product_id === 'storage_master_upgrade' ||
      txRow.product_id === 'storage_master_renew' ||
      masterAction === 'upgrade' ||
      masterAction === 'renew';

    const plan: any = !isMasterTx
      ? await db
          .prepare('SELECT * FROM storage_subscription_plans WHERE id = ? LIMIT 1')
          .bind(txRow.product_id)
          .first()
          .catch(() => null)
      : null;
    loadedPlanRow = plan;
    resolvedAppKey = 'storage';
    resolvedAppName = 'Stockage Cloud';

    const existingStorageSub: any = await db
      .prepare(
        `SELECT * FROM active_subscriptions
         WHERE user_id = ? AND product_type = 'storage'
         ORDER BY updated_at DESC LIMIT 1`
      )
      .bind(userId)
      .first()
      .catch(() => null);

    const currentQuota: any = await db
      .prepare('SELECT * FROM user_storage_quotas WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);
    const currentPaid = currentQuota ? Math.max(0, Number(currentQuota.paid_total_mb || 0)) : 0;
    const wTotal = currentQuota ? Number(currentQuota.welcome_total_mb || 100) : 100;

    let newPaid = currentPaid;
    let newRecurringPrice = Number(txRow.recurring_price_amount || 0);
    const txTargetMb = Math.max(0, Number(txRow.target_storage_mb || 0));

    if (masterAction === 'renew' || txRow.product_id === 'storage_master_renew') {
      // Renouvellement pur : on conserve le quota actuel SANS le doubler, on prolonge la date d'échéance !
      grantedStorageMb = 0;
      newPaid = currentPaid > 0 ? currentPaid : Math.max(0, txTargetMb);
      if (newRecurringPrice <= 0) newRecurringPrice = paidMajor;
      const baseEnd =
        existingStorageSub?.status === 'active' ? existingStorageSub.current_period_end : null;
      entitlementExpiresAt = computeEntitlementExpiration(billingMode, durationDays, baseEnd);
      masterPlanNameOverride = `Stockage ${formatStorageMbFr(newPaid)}`;
      deliverySummary = `Abonnement stockage (${formatStorageMbFr(newPaid)}) renouvelé avec succès.`;
    } else if (masterAction === 'upgrade' || txRow.product_id === 'storage_master_upgrade') {
      // Montée en gamme Carte Maîtresse : remplace l'ancien forfait principal (avec prorata déjà déduit au paiement)
      const addedMb = Math.max(0, Number(txRow.granted_storage_mb || 0));
      newPaid = txTargetMb > currentPaid ? txTargetMb : currentPaid + addedMb;
      grantedStorageMb = Math.max(0, newPaid - currentPaid);
      if (newRecurringPrice <= 0) newRecurringPrice = paidMajor;
      entitlementExpiresAt = computeEntitlementExpiration(billingMode, durationDays, null);
      masterPlanNameOverride = `Stockage ${formatStorageMbFr(newPaid)}`;
      const prorataCred = Math.max(0, Number(txRow.prorata_credit_amount || 0));
      deliverySummary =
        prorataCred > 0
          ? `Stockage augmenté à ${formatStorageMbFr(newPaid)} (prorata -${prorataCred.toLocaleString('fr-FR')} FCFA déduit).`
          : `Stockage augmenté à ${formatStorageMbFr(newPaid)} avec succès.`;
    } else {
      // Carte secondaire D1 (premier abonnement ou booster bonus à prix réduit qui s'additionne dans la Carte Maîtresse)
      grantedStorageMb = Math.max(0, Number(plan?.storage_mb || txRow.granted_storage_mb || 0));
      newPaid = currentPaid + grantedStorageMb;
      const prevRecurring =
        existingStorageSub && existingStorageSub.status === 'active'
          ? Math.max(0, Number(existingStorageSub.price_amount || 0))
          : 0;
      if (newRecurringPrice <= 0) {
        newRecurringPrice = currentPaid > 0 ? prevRecurring + paidMajor : paidMajor;
      }
      const freshEnd = computeEntitlementExpiration(billingMode, durationDays, null);
      const existingEndMs = existingStorageSub?.current_period_end
        ? Date.parse(existingStorageSub.current_period_end)
        : NaN;
      const freshEndMs = freshEnd ? Date.parse(freshEnd) : NaN;
      if (
        currentPaid > 0 &&
        Number.isFinite(existingEndMs) &&
        Number.isFinite(freshEndMs) &&
        existingEndMs > freshEndMs
      ) {
        entitlementExpiresAt = existingStorageSub.current_period_end;
      } else {
        entitlementExpiresAt = freshEnd;
      }
      masterPlanNameOverride =
        currentPaid > 0
          ? `Stockage ${formatStorageMbFr(newPaid)}`
          : String(txRow.product_name || plan?.name || `Stockage ${formatStorageMbFr(newPaid)}`);
      const goLabel = formatStorageMbFr(grantedStorageMb);
      deliverySummary =
        currentPaid > 0
          ? `+${goLabel} ajoutés à votre forfait ! Stockage payant total : ${formatStorageMbFr(newPaid)}.`
          : `+${goLabel} ajoutés à votre stockage Cloud.`;
    }

    masterRecurringPriceOverride = newRecurringPrice;
    masterGrantedStorageOverride = newPaid;
    const newTotal = wTotal + newPaid;

    await db
      .prepare(
        `INSERT INTO user_storage_quotas (
           user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb,
           paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           paid_total_mb = excluded.paid_total_mb,
           paid_r2_mb = excluded.paid_r2_mb,
           paid_d1_mb = excluded.paid_d1_mb,
           plan_name = excluded.plan_name,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        userId,
        wTotal,
        Math.round(wTotal / 3),
        Math.round((wTotal * 2) / 3),
        newPaid,
        Math.round(newPaid / 2),
        Math.round(newPaid / 2),
        masterPlanNameOverride || txRow.product_name || 'Stockage Payant'
      )
      .run()
      .catch(() => {});

    // Remplacer proprement tout ancien abonnement stockage dans user_subscriptions (zéro doublon)
    await db
      .prepare(
        "UPDATE user_subscriptions SET status = 'replaced', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'"
      )
      .bind(userId)
      .run()
      .catch(() => {});

    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db
      .prepare(
        `INSERT INTO user_subscriptions (
           id, user_id, user_name, user_phone, user_email, plan_name,
           total_storage_mb, monthly_price, currency, status, start_date, end_date,
           request_id, grace_period_days, payment_due_date, is_blocked, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, 5, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(
        subId,
        userId,
        txRow.user_name || '',
        txRow.user_phone || '',
        txRow.user_email || '',
        masterPlanNameOverride || txRow.product_name || 'Pack Stockage',
        newTotal,
        newRecurringPrice,
        txRow.currency || 'XOF',
        nowIso,
        entitlementExpiresAt || '',
        txRow.reference,
        entitlementExpiresAt || ''
      )
      .run()
      .catch(() => {});

    await db
      .prepare(
        `INSERT INTO user_purchases_history (
           id, user_id, user_name, user_email, user_phone, pack_name,
           storage_bought_mb, total_storage_mb, price_paid, currency,
           payment_method, payment_reference, billing_cycle, renewal_date,
           status, purchased_at, confirmed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
      )
      .bind(
        `pur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        txRow.user_name || '',
        txRow.user_email || '',
        txRow.user_phone || '',
        masterPlanNameOverride || txRow.product_name || 'Pack Stockage',
        grantedStorageMb,
        newTotal,
        paidMajor,
        txRow.currency || 'XOF',
        `${networkLabel} (Paystack)`,
        txRow.reference,
        txRow.billing_cycle || billingMode,
        entitlementExpiresAt || 'Infini',
        nowIso,
        nowIso
      )
      .run()
      .catch(() => {});
  } else if (txRow.product_type === 'ai') {
    const plan: any = await db
      .prepare('SELECT * FROM ai_subscription_plans WHERE id = ? LIMIT 1')
      .bind(txRow.product_id)
      .first()
      .catch(() => null);
    loadedPlanRow = plan;
    resolvedAppKey = 'ai';
    resolvedAppName = 'Crédits IA StudyCloud';
    grantedAiCredits = Math.max(0, Number(plan?.credits_count || txRow.granted_ai_credits || 0));

    const existingCredits: any = await db
      .prepare('SELECT * FROM user_ai_credits WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);

    if (!existingCredits) {
      const welcome = 50;
      const totalBal = +(welcome + grantedAiCredits).toFixed(2);
      await db
        .prepare(
          `INSERT INTO user_ai_credits (
             user_id, credits_balance, remaining_credits, gift_remaining, gift_initial,
             gift_type, purchased_remaining, total_credits_purchased, plan_tier, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'welcome', ?, ?, 'payant', CURRENT_TIMESTAMP)`
        )
        .bind(userId, totalBal, totalBal, welcome, welcome, grantedAiCredits, grantedAiCredits)
        .run()
        .catch(() => {});
    } else {
      const nextPurchased = +(Number(existingCredits.purchased_remaining || 0) + grantedAiCredits).toFixed(2);
      const giftRem = Math.max(0, Number(existingCredits.gift_remaining ?? 0));
      const nextBalance = +(giftRem + nextPurchased).toFixed(2);
      const nextTotalPurchased = +(Number(existingCredits.total_credits_purchased || 0) + grantedAiCredits).toFixed(2);

      await db
        .prepare(
          `UPDATE user_ai_credits
           SET credits_balance = ?,
               remaining_credits = ?,
               purchased_remaining = ?,
               total_credits_purchased = ?,
               plan_tier = 'payant',
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`
        )
        .bind(nextBalance, nextBalance, nextPurchased, nextTotalPurchased, userId)
        .run()
        .catch(() => {});
    }

    entitlementExpiresAt = computeEntitlementExpiration(billingMode, durationDays, null);

    await db
      .prepare(
        `INSERT INTO user_ai_purchases (
           id, user_id, credits_amount, price_paid, currency,
           payment_method, payment_reference, reason, status, created_at, confirmed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(
        `aipur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        grantedAiCredits,
        paidMajor,
        txRow.currency || 'XOF',
        `${networkLabel} (Paystack)`,
        txRow.reference,
        `Achat Paystack : ${txRow.product_name}`
      )
      .run()
      .catch(() => {});

    await db
      .prepare(
        `INSERT INTO user_purchases_history (
           id, user_id, user_name, user_email, user_phone, pack_name,
           storage_bought_mb, total_storage_mb, price_paid, currency,
           payment_method, payment_reference, billing_cycle, renewal_date,
           status, purchased_at, confirmed_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
      )
      .bind(
        `pur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        txRow.user_name || '',
        txRow.user_email || '',
        txRow.user_phone || '',
        `${txRow.product_name} (+${grantedAiCredits.toLocaleString('fr-FR')} crédits IA)`,
        paidMajor,
        txRow.currency || 'XOF',
        `${networkLabel} (Paystack)`,
        txRow.reference,
        txRow.billing_cycle || billingMode,
        entitlementExpiresAt || 'Infini',
        nowIso,
        nowIso
      )
      .run()
      .catch(() => {});

    deliverySummary = `+${grantedAiCredits.toLocaleString('fr-FR')} crédits IA crédités sur votre compte.`;
  } else if (txRow.product_type === 'app') {
    const appKey = sanitizeAppKey(txRow.app_key || txRow.product_id);
    resolvedAppKey = appKey;
    loadedPlanRow = await db
      .prepare('SELECT * FROM app_subscription_plans WHERE id = ? LIMIT 1')
      .bind(txRow.product_id)
      .first()
      .catch(() => null);
    const appRow: any = await db
      .prepare('SELECT * FROM monetized_apps WHERE app_key = ? LIMIT 1')
      .bind(appKey)
      .first()
      .catch(() => null);
    resolvedAppName = String(appRow?.name || txRow.app_name || appKey);
    const graceDays = Math.max(0, Number(appRow?.grace_period_days ?? 5));

    const existingEnt: any = await db
      .prepare('SELECT * FROM user_app_entitlements WHERE user_id = ? AND app_key = ? LIMIT 1')
      .bind(userId, appKey)
      .first()
      .catch(() => null);

    // Si l'utilisateur avait déjà un accès infini, on le préserve !
    const isAlreadyInfinite =
      existingEnt &&
      existingEnt.status === 'active' &&
      (existingEnt.access_type === 'infinite' || !existingEnt.expires_at);

    if (billingMode === 'infinite' || isAlreadyInfinite) {
      entitlementExpiresAt = null;
    } else {
      entitlementExpiresAt = computeEntitlementExpiration(
        billingMode,
        durationDays,
        existingEnt?.status === 'active' ? existingEnt.expires_at : null
      );
    }

    const graceUntil = entitlementExpiresAt
      ? new Date(Date.parse(entitlementExpiresAt) + graceDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const entId = existingEnt?.id || `ent_${appKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const finalAccessType = billingMode === 'infinite' || isAlreadyInfinite ? 'infinite' : billingMode;
    const autoRenew = billingMode === 'auto' && reusable === 1 ? 1 : 0;

    await db
      .prepare(
        `INSERT INTO user_app_entitlements (
           id, user_id, app_key, plan_id, plan_name, status, access_type,
           starts_at, expires_at, grace_until, auto_renew,
           paystack_subscription_code, last_transaction_ref, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, app_key) DO UPDATE SET
           plan_id = excluded.plan_id,
           plan_name = excluded.plan_name,
           status = 'active',
           access_type = excluded.access_type,
           starts_at = COALESCE(user_app_entitlements.starts_at, excluded.starts_at),
           expires_at = excluded.expires_at,
           grace_until = excluded.grace_until,
           auto_renew = excluded.auto_renew,
           paystack_subscription_code = CASE WHEN excluded.paystack_subscription_code != '' THEN excluded.paystack_subscription_code ELSE user_app_entitlements.paystack_subscription_code END,
           last_transaction_ref = excluded.last_transaction_ref,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        entId,
        userId,
        appKey,
        txRow.product_id || '',
        txRow.product_name || '',
        finalAccessType,
        nowIso,
        entitlementExpiresAt,
        graceUntil,
        autoRenew,
        subCode,
        txRow.reference
      )
      .run();

    await db
      .prepare(
        `INSERT INTO user_purchases_history (
           id, user_id, user_name, user_email, user_phone, pack_name,
           storage_bought_mb, total_storage_mb, price_paid, currency,
           payment_method, payment_reference, billing_cycle, renewal_date,
           status, purchased_at, confirmed_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
      )
      .bind(
        `pur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        txRow.user_name || '',
        txRow.user_email || '',
        txRow.user_phone || '',
        `${appRow?.name || txRow.app_name || appKey} — ${txRow.product_name}`,
        paidMajor,
        txRow.currency || 'XOF',
        `${networkLabel} (Paystack)`,
        txRow.reference,
        txRow.billing_cycle || billingMode,
        entitlementExpiresAt || 'Infini',
        nowIso,
        nowIso
      )
      .run()
      .catch(() => {});

    deliverySummary = entitlementExpiresAt
      ? `Accès activé pour ${appRow?.name || txRow.app_name || appKey} jusqu'au ${new Date(entitlementExpiresAt).toLocaleDateString('fr-FR')}.`
      : `Accès illimité (à vie) activé pour ${appRow?.name || txRow.app_name || appKey}.`;
  }

  // =========================================================================
  // ENREGISTREMENT UNIFIÉ DANS LA TABLE MAÎTRESSE `active_subscriptions`
  // =========================================================================
  const planFlags = normalizePlanBillingFlags(
    loadedPlanRow || { billing_mode: billingMode, is_auto_billing: billingMode === 'auto' ? 1 : 0 }
  );
  const existingMasterSub: any = await db
    .prepare(
      `SELECT * FROM active_subscriptions
       WHERE user_id = ? AND product_type = ? AND app_key = ?
       ORDER BY updated_at DESC LIMIT 1`
    )
    .bind(userId, String(txRow.product_type), resolvedAppKey)
    .first()
    .catch(() => null);

  const alreadyInfiniteMaster =
    existingMasterSub &&
    existingMasterSub.status === 'active' &&
    Number(existingMasterSub.is_infinite) === 1;
  const finalIsInfinite = planFlags.isInfinite === 1 || alreadyInfiniteMaster ? 1 : 0;

  const effectivePolicy = await resolveEffectiveBillingPolicy(db, {
    productType: String(txRow.product_type),
    appKey: resolvedAppKey,
    subscriptionId: existingMasterSub?.id,
  });

  // Enregistrer la carte tokenisée (PCI-DSS) avec permission UNIQUEMENT pour CE service si paiement par carte sur offre Auto+Manuel
  const shouldAutoScopeThisService = finalIsInfinite === 0 && planFlags.allowAuto === 1 && channel === 'card' && reusable === 1;
  const savedPaymentMethod = await upsertUserPaymentMethodFromPaystack(db, {
    userId,
    authEmail: String(txRow.user_email || ''),
    channel,
    paystackData,
    servicePermissions: shouldAutoScopeThisService
      ? {
          mode: 'merge',
          autoStorage: txRow.product_type === 'storage',
          autoAi: txRow.product_type === 'ai',
          autoApps: txRow.product_type === 'app' && resolvedAppKey ? [resolvedAppKey] : [],
        }
      : undefined,
  });

  // Si l'utilisateur n'a pas payé par carte cette fois mais possède DÉJÀ une carte enregistrée qui autorise CE service non-infini :
  // on rattache automatiquement cette carte pour les échéances futures !
  const preAuthorizedCard =
    !savedPaymentMethod && finalIsInfinite === 0 && planFlags.allowAuto === 1
      ? await findPreAuthorizedCardForService(db, userId, String(txRow.product_type), resolvedAppKey)
      : null;
  const effectivePaymentMethod = savedPaymentMethod || preAuthorizedCard;

  let initialRenewal = resolveInitialRenewalMode({
    isInfinite: finalIsInfinite === 1,
    allowAuto: planFlags.allowAuto === 1,
    channel,
    reusable: Boolean(savedPaymentMethod && Number(savedPaymentMethod.reusable) === 1),
  });
  if (!savedPaymentMethod && preAuthorizedCard && finalIsInfinite === 0 && planFlags.allowAuto === 1) {
    initialRenewal = {
      renewalMode: 'auto',
      canChooseAutoOnSuccessScreen: true,
      defaultSelectedMode: 'auto',
    };
  }

  // Synchroniser user_app_entitlements.auto_renew si carte pré-autorisée sur une app
  if (txRow.product_type === 'app' && resolvedAppKey && initialRenewal.renewalMode === 'auto') {
    await db
      .prepare('UPDATE user_app_entitlements SET auto_renew = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
      .bind(userId, resolvedAppKey)
      .run()
      .catch(() => {});
  }

  // Calculer la période de l'abonnement unifié (préserve les jours restants si renouvellement anticipé)
  const finalPeriodEnd =
    finalIsInfinite === 1
      ? null
      : entitlementExpiresAt ||
        computeEntitlementExpiration(
          planFlags.billingMode,
          durationDays,
          existingMasterSub?.status === 'active' ? existingMasterSub.current_period_end : null
        );
  const finalGraceUntil = finalPeriodEnd
    ? new Date(Date.parse(finalPeriodEnd) + effectivePolicy.gracePeriodDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const nextBillingAt = finalIsInfinite === 1 ? null : finalPeriodEnd;
  const masterSubId = existingMasterSub?.id || `asub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const wasBlockedOrPastDue = Boolean(
    existingMasterSub &&
      ['past_due', 'grace', 'blocked', 'expired'].includes(String(existingMasterSub.status || ''))
  );

  const storedMasterPrice =
    masterRecurringPriceOverride !== null && masterRecurringPriceOverride > 0
      ? masterRecurringPriceOverride
      : paidMajor;
  const storedMasterStorageMb =
    masterGrantedStorageOverride !== null ? masterGrantedStorageOverride : grantedStorageMb;
  const storedMasterPlanName = masterPlanNameOverride || txRow.product_name || 'Forfait StudyCloud';

  if (existingMasterSub) {
    await db
      .prepare(
        `UPDATE active_subscriptions
         SET user_name = ?, user_email = ?, user_phone = ?,
             app_name = ?, plan_id = ?, plan_name = ?,
             status = 'active',
             is_infinite = ?,
             plan_allows_auto = ?,
             plan_allows_manual = ?,
             renewal_mode = ?,
             user_confirmed_renewal = 0,
             payment_method_id = CASE WHEN ? != '' THEN ? ELSE payment_method_id END,
             last_channel = ?,
             last_network_label = ?,
             price_amount = ?,
             currency = ?,
             billing_cycle = ?,
             duration_days = ?,
             granted_storage_mb = ?,
             granted_ai_credits = ?,
             current_period_start = ?,
             current_period_end = ?,
             next_billing_at = ?,
             grace_until = ?,
             blocked_at = NULL,
             block_scope = ?,
             cancel_at_period_end = 0,
             cancelled_at = NULL,
             retry_count = 0,
             last_charge_error = '',
             reminder_count = 0,
             last_transaction_ref = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        txRow.user_name || '',
        txRow.user_email || '',
        txRow.user_phone || '',
        resolvedAppName,
        txRow.product_id || '',
        storedMasterPlanName,
        finalIsInfinite,
        planFlags.allowAuto,
        planFlags.allowManual,
        initialRenewal.renewalMode,
        effectivePaymentMethod?.id || '',
        effectivePaymentMethod?.id || '',
        channel,
        networkLabel,
        storedMasterPrice,
        txRow.currency || 'XOF',
        txRow.billing_cycle || planFlags.billingMode,
        finalIsInfinite === 1 ? 0 : durationDays,
        storedMasterStorageMb,
        grantedAiCredits,
        nowIso,
        finalPeriodEnd,
        nextBillingAt,
        finalGraceUntil,
        effectivePolicy.blockScope,
        txRow.reference,
        masterSubId
      )
      .run()
      .catch(() => {});
  } else {
    await db
      .prepare(
        `INSERT INTO active_subscriptions (
           id, user_id, user_name, user_email, user_phone,
           product_type, app_key, app_name, plan_id, plan_name,
           status, is_infinite, plan_allows_auto, plan_allows_manual,
           renewal_mode, user_confirmed_renewal, payment_method_id,
           last_channel, last_network_label, price_amount, currency,
           billing_cycle, duration_days, granted_storage_mb, granted_ai_credits,
           started_at, current_period_start, current_period_end,
           next_billing_at, grace_until, block_scope, last_transaction_ref
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        masterSubId,
        userId,
        txRow.user_name || '',
        txRow.user_email || '',
        txRow.user_phone || '',
        String(txRow.product_type),
        resolvedAppKey,
        resolvedAppName,
        txRow.product_id || '',
        storedMasterPlanName,
        finalIsInfinite,
        planFlags.allowAuto,
        planFlags.allowManual,
        initialRenewal.renewalMode,
        effectivePaymentMethod?.id || '',
        channel,
        networkLabel,
        storedMasterPrice,
        txRow.currency || 'XOF',
        txRow.billing_cycle || planFlags.billingMode,
        finalIsInfinite === 1 ? 0 : durationDays,
        storedMasterStorageMb,
        grantedAiCredits,
        nowIso,
        nowIso,
        finalPeriodEnd,
        nextBillingAt,
        finalGraceUntil,
        effectivePolicy.blockScope,
        txRow.reference
      )
      .run()
      .catch(() => {});
  }

  // Journalisation des événements d'abonnement (pour la visibilité temps réel du tableau de bord)
  await recordSubscriptionEvent(db, {
    subscriptionId: masterSubId,
    userId,
    eventType: existingMasterSub ? 'renewed_manual' : 'created',
    actor: 'system',
    details: {
      reference: txRow.reference,
      planName: txRow.product_name,
      amount: paidMajor,
      currency: txRow.currency || 'XOF',
      channel,
      networkLabel,
      renewalMode: initialRenewal.renewalMode,
      isInfinite: finalIsInfinite === 1,
      currentPeriodEnd: finalPeriodEnd,
    },
  });
  if (savedPaymentMethod) {
    await recordSubscriptionEvent(db, {
      subscriptionId: masterSubId,
      userId,
      eventType: 'card_attached',
      actor: 'user',
      details: {
        paymentMethodId: savedPaymentMethod.id,
        cardBrand: savedPaymentMethod.card_brand,
        last4: savedPaymentMethod.last4,
      },
    });
  }
  if (wasBlockedOrPastDue) {
    await recordSubscriptionEvent(db, {
      subscriptionId: masterSubId,
      userId,
      eventType: 'reactivated',
      actor: 'system',
      details: { reference: txRow.reference },
    });
  }

  // Mettre à jour les champs de livraison + lien subscription_id dans payment_transactions
  await db
    .prepare(
      `UPDATE payment_transactions
       SET granted_storage_mb = ?,
           granted_ai_credits = ?,
           entitlement_expires_at = ?,
           subscription_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE reference = ?`
    )
    .bind(grantedStorageMb, grantedAiCredits, finalPeriodEnd, masterSubId, txRow.reference)
    .run()
    .catch(() => {});

  const refreshed = await db
    .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
    .bind(txRow.reference)
    .first();
  const bundle = await loadSubscriptionBundleForTx(db, refreshed || { ...txRow, subscription_id: masterSubId });

  // ÉTAPE 4 : Envoi automatique d'email de confirmation via Resend (non-bloquant)
  if (effectivePolicy.emailOnPurchase && runtimeOpts?.rawEnv && bundle.subscription) {
    const emailType: BillingEmailType =
      finalIsInfinite === 1
        ? 'infinite_confirmed'
        : wasBlockedOrPastDue
        ? 'service_reactivated'
        : 'purchase_confirmed';
    await sendAndLogBillingEmail({
      db,
      rawEnv: runtimeOpts.rawEnv,
      fetchFn: runtimeOpts.fetchFn,
      subscription: bundle.subscription,
      emailType,
      triggeredBy: 'system',
      reference: String(txRow.reference || ''),
      recordEventFn: recordSubscriptionEvent,
    }).catch(() => {});
  }

  return {
    alreadyFulfilled: false,
    transaction: refreshed || txRow,
    deliverySummary,
    ...bundle,
  };
}

/**
 * Vérifie strictement la cohérence entre ce que Paystack confirme et ce que le serveur attendait.
 */
function validatePaystackVerificationPayload(
  txRow: any,
  paystackData: any
): { ok: true } | { ok: false; reason: string; newStatus: 'failed' | 'abandoned' | 'pending' } {
  const status = String(paystackData?.status || '').toLowerCase();
  if (status === 'abandoned') {
    return { ok: false, reason: 'Paiement abandonné par le client.', newStatus: 'abandoned' };
  }
  if (status === 'failed' || status === 'reversed') {
    return {
      ok: false,
      reason: String(paystackData?.gateway_response || 'Paiement refusé par le réseau.'),
      newStatus: 'failed',
    };
  }
  if (status !== 'success') {
    return { ok: false, reason: `Statut Paystack en attente (${status || 'unknown'}).`, newStatus: 'pending' };
  }

  const paidMinor = Number(paystackData?.amount || 0);
  const expectedMinor = Number(txRow.expected_amount_minor || 0);
  if (!Number.isFinite(paidMinor) || paidMinor < expectedMinor) {
    return {
      ok: false,
      reason: `Montant payé insuffisant (${paidMinor} < ${expectedMinor}).`,
      newStatus: 'failed',
    };
  }

  const paidCurr = String(paystackData?.currency || '').toUpperCase();
  const expectedCurr = String(txRow.currency || 'XOF').toUpperCase();
  if (paidCurr && expectedCurr && paidCurr !== expectedCurr) {
    return {
      ok: false,
      reason: `Devise incohérente (${paidCurr} ≠ ${expectedCurr}).`,
      newStatus: 'failed',
    };
  }

  return { ok: true };
}

/**
 * Crée ou récupère un plan récurrent Paystack (`POST /plan`) pour les cartes en mode `auto` payées par carte bancaire.
 */
async function ensurePaystackNativePlan(params: {
  secretKey: string;
  fetchFn: typeof fetch;
  db: any;
  tableName: 'storage_subscription_plans' | 'ai_subscription_plans' | 'app_subscription_plans';
  planRow: any;
  amountMinor: number;
  currency: string;
  durationDays: number;
}): Promise<string | null> {
  const existingCode = String(params.planRow?.paystack_plan_code || '').trim();
  if (existingCode) return existingCode;

  const interval = resolvePaystackIntervalFromDays(params.durationDays);
  if (!interval) return null;

  try {
    const res = await params.fetchFn(`${PAYSTACK_API_BASE}/plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `StudyCloud - ${params.planRow.name || params.planRow.id}`,
        interval,
        amount: params.amountMinor,
        currency: params.currency,
      }),
    });
    const json: any = await res.json().catch(() => null);
    const planCode = String(json?.data?.plan_code || '').trim();
    if (res.ok && json?.status && planCode) {
      await params.db
        .prepare(`UPDATE ${params.tableName} SET paystack_plan_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(planCode, params.planRow.id)
        .run()
        .catch(() => {});
      return planCode;
    }
  } catch {
    // Fallback silencieux sur initialisation standard si la création de plan échoue
  }
  return null;
}

// ============================================================================
// ROUTEUR PRINCIPAL PAYSTACK & MONÉTISATION
// ============================================================================

export async function handlePaystackBillingRoutes(
  request: Request,
  url: URL,
  path: string,
  method: string,
  ctx: PaystackBillingContext
): Promise<Response | null> {
  const { db, rawEnv, origin, getAuthUser, jsonResponse, errorResponse } = ctx;
  const fetchFn = ctx.fetchFn || fetch;

  if (
    !path.startsWith('/api/payments/') &&
    !path.startsWith('/api/billing/') &&
    !path.startsWith('/api/admin/billing/') &&
    !path.startsWith('/api/webhooks/resend') &&
    !path.startsWith('/api/monetized-apps') &&
    !path.startsWith('/api/apps/access/')
  ) {
    return null;
  }

  if (!db) {
    return errorResponse('Base de données D1 indisponible.', 500, origin);
  }

  await ensurePaystackBillingTables(db);

  // --------------------------------------------------------------------------
  // 1. GET /api/payments/config — Configuration publique (Paystack + toggle Payer manuellement)
  // --------------------------------------------------------------------------
  if (path === '/api/payments/config' && method === 'GET') {
    const config = await readPaymentGatewayConfig(db, rawEnv);
    return jsonResponse({ success: true, config }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 1b. GET /api/billing/storage-master-card/status — État D1 en direct de la Carte Maîtresse Stockage
  // --------------------------------------------------------------------------
  if (path === '/api/billing/storage-master-card/status' && method === 'GET') {
    const config = await readStorageMasterCardConfig(db);
    const authUser = await getAuthUser(request).catch(() => null);
    const uid = String(authUser?.userId || '').trim();
    const userState = await readStorageMasterUserState(db, uid, config);
    return jsonResponse({ success: true, config, userState }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 1c. POST /api/billing/storage-master-card/quote — Devis serveur exact (avec prorata)
  // --------------------------------------------------------------------------
  if (path === '/api/billing/storage-master-card/quote' && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const body: any = await request.json().catch(() => ({}));
    const action: 'upgrade' | 'renew' = body.action === 'renew' ? 'renew' : 'upgrade';
    const targetPaidMb = Number(body.targetPaidMb || 0);
    const config = await readStorageMasterCardConfig(db);
    const userState = await readStorageMasterUserState(db, String(authUser.userId), config);
    const quote = computeStorageMasterQuote(config, userState, action, targetPaidMb);
    if (!quote.ok) {
      return errorResponse(quote.error || 'Calcul impossible.', 400, origin);
    }
    return jsonResponse({ success: true, config, userState, quote }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 2. GET /api/monetized-apps — Catalogue des applications + cartes de prix
  // --------------------------------------------------------------------------
  if (path === '/api/monetized-apps' && method === 'GET') {
    const onlyActive = url.searchParams.get('active_only') === '1';
    const appsRes = await db
      .prepare(
        onlyActive
          ? 'SELECT * FROM monetized_apps WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
          : 'SELECT * FROM monetized_apps ORDER BY sort_order ASC, created_at ASC'
      )
      .all();
    const plansRes = await db
      .prepare(
        onlyActive
          ? 'SELECT * FROM app_subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
          : 'SELECT * FROM app_subscription_plans ORDER BY sort_order ASC, created_at ASC'
      )
      .all();

    const plansByApp = new Map<string, any[]>();
    for (const p of plansRes.results || []) {
      const k = String(p.app_key);
      const list = plansByApp.get(k) || [];
      list.push(p);
      plansByApp.set(k, list);
    }

    const apps = (appsRes.results || []).map((a: any) => ({
      ...a,
      plans: plansByApp.get(String(a.app_key)) || [],
    }));

    return jsonResponse({ success: true, apps }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 3. GET /api/apps/access/:appKey — Contrôle d'accès réel pour une application
  // --------------------------------------------------------------------------
  const accessMatch = path.match(/^\/api\/apps\/access\/([^/]+)$/);
  if (accessMatch && method === 'GET') {
    const appKey = sanitizeAppKey(decodeURIComponent(accessMatch[1]));
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }

    const access = await checkUserAppAccess(db, String(authUser.userId), appKey);
    const guard = await evaluateUserBillingGuard(db, String(authUser.userId));
    const appExplicitlyBlocked = guard.blockedSubscriptions.some(
      (b) => b.productType === 'app' && b.appKey === appKey
    );
    const enforcedAccess =
      guard.fullAccountBlocked || appExplicitlyBlocked
        ? {
            ...access,
            allowed: false,
            status: 'expired' as const,
            billingBlocked: true,
            blockScope: guard.fullAccountBlocked ? 'full_account' : 'service_only',
            reason: guard.fullAccountBlocked
              ? 'Votre compte est temporairement suspendu suite à un abonnement impayé. Régularisez votre paiement pour retrouver l’accès immédiatement.'
              : 'L’accès à cette application est suspendu suite à un impayé. Régularisez votre abonnement pour le débloquer.',
          }
        : access;
    const plansRes = await db
      .prepare(
        'SELECT * FROM app_subscription_plans WHERE app_key = ? AND is_active = 1 ORDER BY sort_order ASC, created_at ASC'
      )
      .bind(appKey)
      .all()
      .catch(() => ({ results: [] }));
    const config = await readPaymentGatewayConfig(db, rawEnv);

    return jsonResponse(
      {
        success: true,
        ...enforcedAccess,
        plans: plansRes.results || [],
        paymentConfig: config,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 4. POST /api/apps/access/:appKey/start-trial — Activer l'essai gratuit (1 seule fois)
  // --------------------------------------------------------------------------
  const trialMatch = path.match(/^\/api\/apps\/access\/([^/]+)\/start-trial$/);
  if (trialMatch && method === 'POST') {
    const appKey = sanitizeAppKey(decodeURIComponent(trialMatch[1]));
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const userId = String(authUser.userId);

    const app: any = await db
      .prepare('SELECT * FROM monetized_apps WHERE app_key = ? LIMIT 1')
      .bind(appKey)
      .first();
    if (!app) return errorResponse('Application introuvable.', 404, origin);
    const trialDays = Math.max(0, Number(app.trial_days) || 0);
    if (trialDays <= 0) {
      return errorResponse("Aucun essai gratuit n'est actif pour cette application.", 400, origin);
    }

    const existingEnt: any = await db
      .prepare('SELECT * FROM user_app_entitlements WHERE user_id = ? AND app_key = ? LIMIT 1')
      .bind(userId, appKey)
      .first();
    if (existingEnt) {
      return errorResponse("Vous avez déjà utilisé ou activé un accès pour cette application.", 409, origin);
    }

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const entId = `ent_trial_${appKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await db
      .prepare(
        `INSERT INTO user_app_entitlements (
           id, user_id, app_key, plan_id, plan_name, status, access_type,
           starts_at, expires_at, auto_renew, notes, updated_at
         ) VALUES (?, ?, ?, 'trial', ?, 'trial', 'trial', ?, ?, 0, 'Essai gratuit', CURRENT_TIMESTAMP)`
      )
      .bind(entId, userId, appKey, `Essai gratuit (${trialDays}j)`, nowIso, expiresAt)
      .run();

    const trialSubId = `asub_trial_${appKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db
      .prepare(
        `INSERT INTO active_subscriptions (
           id, user_id, user_email, product_type, app_key, app_name, plan_id, plan_name,
           status, is_infinite, plan_allows_auto, plan_allows_manual, renewal_mode,
           price_amount, currency, billing_cycle, duration_days,
           started_at, current_period_start, current_period_end, next_billing_at
         ) VALUES (?, ?, ?, 'app', ?, ?, 'trial', ?, 'trial', 0, 0, 1, 'manual', 0, 'XOF', 'trial', ?, ?, ?, ?, ?)`
      )
      .bind(
        trialSubId,
        userId,
        String(authUser.email || ''),
        appKey,
        String(app.name || appKey),
        `Essai gratuit (${trialDays}j)`,
        trialDays,
        nowIso,
        nowIso,
        expiresAt,
        expiresAt
      )
      .run()
      .catch(() => {});

    await recordSubscriptionEvent(db, {
      subscriptionId: trialSubId,
      userId,
      eventType: 'trial_started',
      actor: 'user',
      details: { appKey, trialDays, expiresAt },
    });

    const access = await checkUserAppAccess(db, userId, appKey);
    return jsonResponse({ success: true, ...access }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 5. POST /api/payments/paystack/initialize — Initialisation 100 % serveur
  // --------------------------------------------------------------------------
  if (path === '/api/payments/paystack/initialize' && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Connexion requise pour effectuer un paiement.', 401, origin);
    }

    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) {
      return errorResponse(
        'Passerelle Paystack non configurée sur le serveur (STUDYCLOUD_PAYSTACK_SECRET_KEY manquant).',
        503,
        origin
      );
    }

    const config = await readPaymentGatewayConfig(db, rawEnv);
    if (!config.paystackEnabled) {
      return errorResponse('Le paiement Paystack est temporairement désactivé par l’administrateur.', 503, origin);
    }

    const body: any = await request.json().catch(() => ({}));
    const productType = String(body.productType || '').trim().toLowerCase() as PaymentProductType;
    const productId = String(body.productId || '').trim();
    const billingCycle = (
      body.billingCycle === 'annual'
        ? 'annual'
        : body.billingCycle === 'one_time'
        ? 'one_time'
        : body.billingCycle === 'infinite'
        ? 'infinite'
        : 'monthly'
    ) as 'monthly' | 'annual' | 'one_time' | 'infinite';
    const preferAutoCard = Boolean(body.preferAutoCard);
    const requestedCurrency = String(body.currency || config.defaultCurrency || 'XOF').toUpperCase();

    if (!['storage', 'ai', 'app'].includes(productType) || !productId) {
      return errorResponse('Type de produit ou identifiant de forfait manquant.', 400, origin);
    }

    // Charger le profil utilisateur réel depuis D1
    const userId = String(authUser.userId);
    const userRow: any = await db
      .prepare('SELECT id, name, email, phone FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);

    const userEmail = String(userRow?.email || authUser.email || '').trim();
    if (!userEmail || !userEmail.includes('@')) {
      return errorResponse(
        'Une adresse e-mail valide sur votre compte StudyCloud est requise par Paystack.',
        400,
        origin
      );
    }
    const userName = String(userRow?.name || authUser.name || 'Utilisateur StudyCloud').trim();
    const userPhone = String(userRow?.phone || body.phone || '').trim();

    // Lire le forfait officiel depuis D1 (JAMAIS faire confiance au prix envoyé par le frontend !)
    let planRow: any = null;
    let planTable: 'storage_subscription_plans' | 'ai_subscription_plans' | 'app_subscription_plans' =
      'storage_subscription_plans';
    let appKey = '';
    let appName = '';
    let grantedStorageMb = 0;
    let grantedAiCredits = 0;
    let targetStorageMb = 0;
    let recurringPriceAmount = 0;
    let masterAction = '';
    let prorataCreditAmount = 0;
    let masterPriceOverrideMajor: number | null = null;
    let masterDurationOverride: number | null = null;
    let masterBillingModeOverride: BillingMode | null = null;

    if (productType === 'storage') {
      planTable = 'storage_subscription_plans';
      appKey = 'storage';
      appName = 'Stockage Cloud';

      if (productId === 'storage_master_upgrade' || productId === 'storage_master_renew') {
        const masterCfg = await readStorageMasterCardConfig(db);
        if (!masterCfg.enabled) {
          return errorResponse('La Carte Maîtresse de stockage est temporairement désactivée.', 400, origin);
        }
        const userState = await readStorageMasterUserState(db, userId, masterCfg);
        const actionType: 'upgrade' | 'renew' =
          productId === 'storage_master_renew' ? 'renew' : 'upgrade';
        const quote = computeStorageMasterQuote(
          masterCfg,
          userState,
          actionType,
          Number(body.targetPaidMb || 0)
        );
        if (!quote.ok) {
          return errorResponse(quote.error || 'Opération stockage invalide.', 400, origin);
        }
        masterAction = actionType;
        grantedStorageMb = quote.addedMb;
        targetStorageMb = quote.targetPaidMb;
        recurringPriceAmount = quote.newMonthlyPriceFcfa;
        prorataCreditAmount = quote.unusedCreditFcfa;
        masterPriceOverrideMajor = quote.amountDueFcfa;
        masterDurationOverride = quote.durationDays;
        masterBillingModeOverride = quote.billingMode;
        planRow = {
          id: productId,
          name:
            actionType === 'renew'
              ? `Renouvellement Stockage ${formatStorageMbFr(quote.targetPaidMb)}`
              : `Stockage ${formatStorageMbFr(quote.targetPaidMb)}`,
          storage_mb: quote.addedMb,
          price: quote.amountDueFcfa,
          primary_currency: 'XOF',
          billing_mode: quote.billingMode,
          duration_days: quote.durationDays,
          is_auto_billing: quote.billingMode === 'auto' ? 1 : 0,
        };
      } else {
        planRow = await db
          .prepare('SELECT * FROM storage_subscription_plans WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1')
          .bind(productId)
          .first();
        if (planRow) {
          grantedStorageMb = Math.max(0, Number(planRow?.storage_mb || 0));
          const masterCfg = await readStorageMasterCardConfig(db);
          const userState = await readStorageMasterUserState(db, userId, masterCfg);
          if (
            userState.hasActiveSubscription &&
            !userState.isExpired &&
            userState.planId === String(planRow.id) &&
            userState.paidMb >= grantedStorageMb
          ) {
            return errorResponse(
              'Vous êtes déjà abonné à ce forfait de stockage. Utilisez la Carte Maîtresse pour le renouveler ou augmenter votre quota.',
              409,
              origin
            );
          }
          if (userState.paidMb > 0) {
            masterAction = 'booster';
            targetStorageMb = userState.paidMb + grantedStorageMb;
          } else {
            masterAction = 'initial_card';
            targetStorageMb = grantedStorageMb;
          }
        }
      }
    } else if (productType === 'ai') {
      planTable = 'ai_subscription_plans';
      planRow = await db
        .prepare('SELECT * FROM ai_subscription_plans WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1')
        .bind(productId)
        .first();
      appKey = 'ai';
      appName = 'Crédits IA StudyCloud';
      grantedAiCredits = Math.max(0, Number(planRow?.credits_count || 0));
    } else {
      planTable = 'app_subscription_plans';
      planRow = await db
        .prepare('SELECT * FROM app_subscription_plans WHERE id = ? AND is_active = 1 LIMIT 1')
        .bind(productId)
        .first();
      if (planRow) {
        appKey = sanitizeAppKey(planRow.app_key);
        const appRow: any = await db
          .prepare('SELECT * FROM monetized_apps WHERE app_key = ? LIMIT 1')
          .bind(appKey)
          .first()
          .catch(() => null);
        appName = String(appRow?.name || appKey);
      }
    }

    if (!planRow) {
      return errorResponse('Forfait introuvable ou désactivé.', 404, origin);
    }

    const billingMode =
      masterBillingModeOverride ||
      normalizeBillingMode(
        planRow.billing_mode,
        planRow.is_auto_billing,
        planRow.pricing_model
      );
    const resolvedPricing = resolvePlanPriceMajor(
      planRow,
      billingMode === 'infinite' ? 'infinite' : billingCycle,
      requestedCurrency
    );
    const amountMajor =
      masterPriceOverrideMajor !== null ? masterPriceOverrideMajor : resolvedPricing.amountMajor;
    const currency = masterPriceOverrideMajor !== null ? 'XOF' : resolvedPricing.currency;
    const durationDays =
      masterDurationOverride !== null ? masterDurationOverride : resolvedPricing.durationDays;
    if (productType === 'storage' && recurringPriceAmount <= 0) {
      if (masterAction === 'booster') {
        const masterCfg = await readStorageMasterCardConfig(db);
        const uState = await readStorageMasterUserState(db, userId, masterCfg);
        recurringPriceAmount = (uState.monthlyPriceFcfa || 0) + amountMajor;
      } else {
        recurringPriceAmount = amountMajor;
      }
    }
    const amountMinor = toPaystackAmountMinor(amountMajor);

    if (amountMinor <= 0) {
      return errorResponse('Montant du forfait invalide.', 400, origin);
    }

    const reference = `SC-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // URL de rappel sécurisée (autorise le retour vers l'origine StudyCloud si valide)
    let callbackUrl = config.callbackUrl || DEFAULT_CALLBACK_URL;
    if (typeof body.returnOrigin === 'string') {
      try {
        const parsedOrigin = new URL(body.returnOrigin);
        if (
          parsedOrigin.hostname === 'studycloud.dkd-technologies.com' ||
          parsedOrigin.hostname.endsWith('.workers.dev') ||
          parsedOrigin.hostname === 'localhost' ||
          parsedOrigin.hostname === '127.0.0.1'
        ) {
          callbackUrl = `${parsedOrigin.origin}/?payment=paystack-return`;
        }
      } catch {
        // Garder le callbackUrl par défaut
      }
    }

    // Construire la requête Paystack /transaction/initialize
    // IMPORTANT : en Côte d'Ivoire, passer `plan` masque Mobile Money sur Paystack.
    // On n'active donc le `plan` natif Paystack QUE lorsque l'utilisateur choisit explicitement
    // le prélèvement automatique par carte (`preferAutoCard === true` sur une carte en mode `auto`).
    const initPayload: Record<string, any> = {
      email: userEmail,
      amount: amountMinor,
      currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        user_id: userId,
        user_name: userName,
        product_type: productType,
        product_id: productId,
        product_name: String(planRow.name || ''),
        app_key: appKey,
        app_name: appName,
        billing_mode: billingMode,
        billing_cycle: billingMode === 'infinite' ? 'infinite' : billingCycle,
        duration_days: durationDays,
      },
    };

    const channelOnly =
      body.channelOnly === 'card'
        ? 'card'
        : body.channelOnly === 'mobile_money'
        ? 'mobile_money'
        : null;

    if (billingMode === 'auto' && preferAutoCard) {
      const planCode = await ensurePaystackNativePlan({
        secretKey,
        fetchFn,
        db,
        tableName: planTable,
        planRow,
        amountMinor,
        currency,
        durationDays,
      });
      if (planCode) {
        initPayload.plan = planCode;
        initPayload.channels = ['card'];
      } else {
        initPayload.channels = channelOnly ? [channelOnly] : ['card', 'mobile_money'];
      }
    } else if (channelOnly) {
      initPayload.channels = [channelOnly];
    } else {
      initPayload.channels = ['mobile_money', 'card'];
    }

    // Enregistrer d'abord la transaction en status = 'pending' dans D1
    await db
      .prepare(
        `INSERT INTO payment_transactions (
           id, reference, user_id, user_name, user_email, user_phone,
           product_type, product_id, product_name, app_key, app_name,
           billing_mode, billing_cycle, duration_days,
           expected_amount, expected_amount_minor, currency,
           provider, status, granted_storage_mb, granted_ai_credits,
           target_storage_mb, recurring_price_amount, master_action, prorata_credit_amount,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paystack', 'pending', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(
        txId,
        reference,
        userId,
        userName,
        userEmail,
        userPhone,
        productType,
        productId,
        String(planRow.name || 'Forfait StudyCloud'),
        appKey,
        appName,
        billingMode,
        billingMode === 'infinite' ? 'infinite' : billingCycle,
        durationDays,
        amountMajor,
        amountMinor,
        currency,
        grantedStorageMb,
        grantedAiCredits,
        targetStorageMb,
        recurringPriceAmount,
        masterAction,
        prorataCreditAmount
      )
      .run();

    // Appeler l'API Paystack /transaction/initialize
    let psRes: Response;
    let psJson: any = null;
    try {
      psRes = await fetchFn(`${PAYSTACK_API_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initPayload),
      });
      psJson = await psRes.json().catch(() => null);
    } catch (netErr: any) {
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(String(netErr?.message || 'Erreur réseau Paystack'), reference)
        .run()
        .catch(() => {});
      return errorResponse('Impossible de joindre Paystack pour le moment. Réessayez.', 502, origin);
    }

    if (!psRes.ok || !psJson?.status || !psJson?.data?.authorization_url) {
      const errMsg = String(psJson?.message || 'Paystack a refusé l’initialisation du paiement.');
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(errMsg, reference)
        .run()
        .catch(() => {});
      return errorResponse(errMsg, 502, origin);
    }

    const accessCode = String(psJson.data.access_code || '');
    const authorizationUrl = String(psJson.data.authorization_url);

    await db
      .prepare(
        'UPDATE payment_transactions SET paystack_access_code = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?'
      )
      .bind(accessCode, reference)
      .run()
      .catch(() => {});

    return jsonResponse(
      {
        success: true,
        reference,
        accessCode,
        authorizationUrl,
        amount: amountMajor,
        amountMinor,
        currency,
        billingMode,
        durationDays,
        mode: detectPaystackMode(secretKey),
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 6. GET /api/payments/paystack/verify?reference=... — Vérification serveur directe
  // --------------------------------------------------------------------------
  if (path === '/api/payments/paystack/verify' && method === 'GET') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }

    const reference = String(url.searchParams.get('reference') || url.searchParams.get('trxref') || '').trim();
    if (!reference) {
      return errorResponse('Paramètre reference requis.', 400, origin);
    }

    // Anti-IDOR strict : l'utilisateur ne peut vérifier que SES propres transactions
    const txRow: any = await db
      .prepare('SELECT * FROM payment_transactions WHERE reference = ? AND user_id = ? LIMIT 1')
      .bind(reference, String(authUser.userId))
      .first();
    if (!txRow) {
      return errorResponse('Transaction introuvable ou non autorisée.', 404, origin);
    }

    if (txRow.status === 'paid' && txRow.fulfilled_at) {
      const bundle = await loadSubscriptionBundleForTx(db, txRow);
      return jsonResponse(
        {
          success: true,
          verified: true,
          alreadyFulfilled: true,
          transaction: txRow,
          subscription: bundle.subscription,
          paymentMethod: bundle.paymentMethod,
          renewalUiConfig: bundle.renewalUiConfig,
          message: 'Paiement déjà vérifié et appliqué à votre compte.',
        },
        200,
        origin
      );
    }

    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) {
      return errorResponse('Clé secrète Paystack non configurée.', 503, origin);
    }

    let psRes: Response;
    let psJson: any = null;
    try {
      psRes = await fetchFn(
        `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${secretKey}` },
        }
      );
      psJson = await psRes.json().catch(() => null);
    } catch {
      return errorResponse('Erreur réseau lors de la vérification auprès de Paystack.', 502, origin);
    }

    if (!psRes.ok || !psJson?.status || !psJson?.data) {
      return errorResponse(
        String(psJson?.message || 'Impossible de vérifier cette transaction auprès de Paystack.'),
        502,
        origin
      );
    }

    const check = validatePaystackVerificationPayload(txRow, psJson.data);
    if (!check.ok) {
      if (check.newStatus !== 'pending') {
        await db
          .prepare(
            'UPDATE payment_transactions SET status = ?, failure_reason = ?, raw_verify_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status = ?'
          )
          .bind(
            check.newStatus,
            check.reason,
            JSON.stringify(psJson.data).slice(0, 16000),
            reference,
            'pending'
          )
          .run()
          .catch(() => {});
      }
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: check.newStatus,
          error: check.reason,
        },
        200,
        origin
      );
    }

    const fulfillment = await fulfillPaidTransaction(db, txRow, psJson.data, { rawEnv, fetchFn });
    return jsonResponse(
      {
        success: true,
        verified: true,
        alreadyFulfilled: fulfillment.alreadyFulfilled,
        deliverySummary: fulfillment.deliverySummary,
        transaction: fulfillment.transaction,
        subscription: fulfillment.subscription,
        paymentMethod: fulfillment.paymentMethod,
        renewalUiConfig: fulfillment.renewalUiConfig,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 7. POST /api/payments/paystack/webhook — Webhook signé HMAC-SHA512
  // --------------------------------------------------------------------------
  if (path === '/api/payments/paystack/webhook' && method === 'POST') {
    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) {
      return errorResponse('Webhook Paystack non configuré.', 503, origin);
    }

    const rawBody = await request.text();
    const signature =
      request.headers.get('x-paystack-signature') ||
      request.headers.get('X-Paystack-Signature') ||
      '';

    const expectedSig = await computePaystackHmacSha512Hex(secretKey, rawBody);
    const sigValid = timingSafeEqualHex(signature, expectedSig);

    let eventPayload: any = null;
    try {
      eventPayload = JSON.parse(rawBody);
    } catch {
      eventPayload = null;
    }

    const eventType = String(eventPayload?.event || 'unknown');
    const eventRef = String(eventPayload?.data?.reference || '');
    const eventId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await db
      .prepare(
        `INSERT INTO payment_webhook_events (
           id, provider, event_type, reference, signature_valid, processed, payload_json
         ) VALUES (?, 'paystack', ?, ?, ?, 0, ?)`
      )
      .bind(eventId, eventType, eventRef, sigValid ? 1 : 0, rawBody.slice(0, 32000))
      .run()
      .catch(() => {});

    if (!sigValid) {
      return errorResponse('Signature Paystack invalide.', 401, origin);
    }

    let processingNote = 'ignored';

    if (eventType === 'charge.success' && eventPayload?.data) {
      const data = eventPayload.data;
      const ref = String(data.reference || '').trim();
      let txRow: any = ref
        ? await db
            .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
            .bind(ref)
            .first()
        : null;

      // Cas d'un renouvellement automatique récurrent Paystack (nouvelle référence générée par Paystack pour une souscription existante !)
      if (!txRow && data?.plan?.plan_code) {
        const subCode = String(data.subscription_code || '');
        const customerEmail = String(data?.customer?.email || '').trim().toLowerCase();
        const prevTx: any = await db
          .prepare(
            `SELECT * FROM payment_transactions
             WHERE (paystack_subscription_code = ? AND ? != '')
                OR (LOWER(user_email) = ? AND status = 'paid' AND billing_mode = 'auto')
             ORDER BY created_at DESC LIMIT 1`
          )
          .bind(subCode, subCode, customerEmail)
          .first()
          .catch(() => null);

        if (prevTx && ref) {
          const renewId = `tx_ren_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const paidMinor = Number(data.amount || 0);
          const paidMajor = Math.round((paidMinor / 100) * 100) / 100;
          await db
            .prepare(
              `INSERT OR IGNORE INTO payment_transactions (
                 id, reference, user_id, user_name, user_email, user_phone,
                 product_type, product_id, product_name, app_key, app_name,
                 billing_mode, billing_cycle, duration_days,
                 expected_amount, expected_amount_minor, currency,
                 provider, paystack_subscription_code, status,
                 granted_storage_mb, granted_ai_credits
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?, ?, ?, ?, 'paystack', ?, 'pending', ?, ?)`
            )
            .bind(
              renewId,
              ref,
              prevTx.user_id,
              prevTx.user_name,
              prevTx.user_email,
              prevTx.user_phone,
              prevTx.product_type,
              prevTx.product_id,
              prevTx.product_name,
              prevTx.app_key,
              prevTx.app_name,
              prevTx.billing_cycle,
              prevTx.duration_days,
              paidMajor,
              paidMinor,
              String(data.currency || prevTx.currency || 'XOF').toUpperCase(),
              subCode || prevTx.paystack_subscription_code || '',
              prevTx.granted_storage_mb || 0,
              prevTx.granted_ai_credits || 0
            )
            .run()
            .catch(() => {});

          txRow = await db
            .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
            .bind(ref)
            .first();
        }
      }

      if (txRow) {
        const check = validatePaystackVerificationPayload(txRow, data);
        if (check.ok) {
          const res = await fulfillPaidTransaction(db, txRow, data, { rawEnv, fetchFn });
          processingNote = res.alreadyFulfilled ? 'already_fulfilled' : `fulfilled:${res.deliverySummary}`;
        } else {
          processingNote = `rejected:${check.reason}`;
          await db
            .prepare(
              "UPDATE payment_transactions SET status = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status = 'pending'"
            )
            .bind(check.newStatus, check.reason, txRow.reference)
            .run()
            .catch(() => {});
        }
      } else {
        processingNote = 'unknown_reference';
      }
    } else if (eventType === 'subscription.create' && eventPayload?.data) {
      const subCode = String(eventPayload.data.subscription_code || '');
      const emailToken = String(eventPayload.data.email_token || '');
      const customerEmail = String(eventPayload.data?.customer?.email || '').trim().toLowerCase();
      if (subCode && customerEmail) {
        await db
          .prepare(
            `UPDATE user_app_entitlements
             SET auto_renew = 1, paystack_subscription_code = ?, paystack_email_token = ?, updated_at = CURRENT_TIMESTAMP
             WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = ?)`
          )
          .bind(subCode, emailToken, customerEmail)
          .run()
          .catch(() => {});
        processingNote = `subscription_linked:${subCode}`;
      }
    } else if (
      (eventType === 'subscription.disable' || eventType === 'subscription.not_renew') &&
      eventPayload?.data?.subscription_code
    ) {
      const subCode = String(eventPayload.data.subscription_code);
      await db
        .prepare(
          'UPDATE user_app_entitlements SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE paystack_subscription_code = ?'
        )
        .bind(subCode)
        .run()
        .catch(() => {});
      processingNote = `auto_renew_disabled:${subCode}`;
    } else if (eventType === 'invoice.payment_failed' && eventPayload?.data) {
      processingNote = 'invoice_payment_failed_logged';
    } else if (
      (eventType === 'charge.dispute.create' ||
        eventType === 'charge.dispute.remind' ||
        eventType === 'refund.processed') &&
      eventPayload?.data
    ) {
      const disputeRef = String(
        eventPayload.data?.transaction?.reference ||
          eventPayload.data?.transaction_reference ||
          eventPayload.data?.reference ||
          ''
      ).trim();

      // Ne jamais bloquer d'abonnement suite au remboursement automatique de l'empreinte de liaison de carte (100 FCFA)
      if (!disputeRef || disputeRef.startsWith('SC-CARD-')) {
        processingNote = disputeRef ? 'ignored_card_verification_refund' : 'dispute_or_refund_missing_ref';
      } else {
        const isRefund = eventType.startsWith('refund.');
        const nowIso = new Date().toISOString();
        const reasonLabel = isRefund
          ? 'Remboursement Paystack effectué — accès suspendu'
          : 'Litige bancaire / Chargeback Paystack détecté';

        const txRow: any = await db
          .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
          .bind(disputeRef)
          .first()
          .catch(() => null);

        if (txRow) {
          await db
            .prepare(
              'UPDATE payment_transactions SET status = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?'
            )
            .bind(isRefund ? 'refunded' : 'disputed', reasonLabel, disputeRef)
            .run()
            .catch(() => {});

          const linkedSub: any = await db
            .prepare(
              `SELECT * FROM active_subscriptions
               WHERE (id = ? AND ? != '') OR last_transaction_ref = ?
               ORDER BY updated_at DESC LIMIT 1`
            )
            .bind(String(txRow.subscription_id || ''), String(txRow.subscription_id || ''), disputeRef)
            .first()
            .catch(() => null);

          if (linkedSub) {
            await db
              .prepare(
                `UPDATE active_subscriptions
                 SET status = 'blocked',
                     blocked_at = COALESCE(blocked_at, ?),
                     renewal_mode = CASE WHEN renewal_mode = 'auto' THEN 'manual' ELSE renewal_mode END,
                     last_charge_error = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
              )
              .bind(nowIso, reasonLabel, linkedSub.id)
              .run()
              .catch(() => {});

            if (linkedSub.product_type === 'app' && linkedSub.app_key) {
              await db
                .prepare(
                  "UPDATE user_app_entitlements SET status = 'revoked', auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?"
                )
                .bind(linkedSub.user_id, linkedSub.app_key)
                .run()
                .catch(() => {});
            }

            await recordSubscriptionEvent(db, {
              subscriptionId: String(linkedSub.id),
              userId: String(linkedSub.user_id),
              eventType: 'chargeback_or_refund_revoked',
              actor: 'paystack_webhook',
              details: {
                webhookEvent: eventType,
                reference: disputeRef,
                reason: reasonLabel,
              },
            }).catch(() => {});

            processingNote = `revoked_by_${eventType}:${linkedSub.id}`;
          } else {
            processingNote = `tx_marked_${isRefund ? 'refunded' : 'disputed'}_no_sub:${disputeRef}`;
          }
        } else {
          processingNote = `dispute_or_refund_unknown_ref:${disputeRef}`;
        }
      }
    }

    await db
      .prepare('UPDATE payment_webhook_events SET processed = 1, processing_note = ? WHERE id = ?')
      .bind(processingNote, eventId)
      .run()
      .catch(() => {});

    return jsonResponse({ success: true, received: true, event: eventType }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 8. POST /api/payments/admin/reverify — Revérification Paystack d'une transaction (appelé depuis le tableau de bord)
  // --------------------------------------------------------------------------
  if (path === '/api/payments/admin/reverify' && method === 'POST') {
    const adminAuth = verifyAdminApiAuth(request, rawEnv);
    if (!adminAuth.ok) {
      return errorResponse(adminAuth.error || 'Accès administrateur refusé.', adminAuth.status || 401, origin);
    }
    const body: any = await request.json().catch(() => ({}));
    const reference = String(body.reference || '').trim();
    if (!reference) return errorResponse('reference requise.', 400, origin);

    const txRow: any = await db
      .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
      .bind(reference)
      .first();
    if (!txRow) return errorResponse('Transaction introuvable.', 404, origin);

    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) return errorResponse('STUDYCLOUD_PAYSTACK_SECRET_KEY manquant.', 503, origin);

    const psRes = await fetchFn(
      `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    const psJson: any = await psRes.json().catch(() => null);
    if (!psRes.ok || !psJson?.status || !psJson?.data) {
      return errorResponse(String(psJson?.message || 'Erreur Paystack verify.'), 502, origin);
    }

    const check = validatePaystackVerificationPayload(txRow, psJson.data);
    if (!check.ok) {
      await db
        .prepare(
          "UPDATE payment_transactions SET status = ?, failure_reason = ?, raw_verify_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status != 'paid'"
        )
        .bind(check.newStatus, check.reason, JSON.stringify(psJson.data).slice(0, 16000), reference)
        .run()
        .catch(() => {});
      return jsonResponse({ success: true, verified: false, status: check.newStatus, reason: check.reason }, 200, origin);
    }

    const fulfillment = await fulfillPaidTransaction(db, txRow, psJson.data, { rawEnv, fetchFn });
    return jsonResponse(
      {
        success: true,
        verified: true,
        alreadyFulfilled: fulfillment.alreadyFulfilled,
        deliverySummary: fulfillment.deliverySummary,
        transaction: fulfillment.transaction,
        subscription: fulfillment.subscription,
        paymentMethod: fulfillment.paymentMethod,
        renewalUiConfig: fulfillment.renewalUiConfig,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 9. GET /api/payments/my-transactions — Historique personnel de l'utilisateur connecté
  // --------------------------------------------------------------------------
  if (path === '/api/payments/my-transactions' && method === 'GET') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const res = await db
      .prepare(
        `SELECT id, reference, product_type, product_id, product_name, app_key, app_name,
                billing_mode, billing_cycle, duration_days, expected_amount, paid_amount,
                currency, provider, channel, network_label, status, fulfilled_at,
                granted_storage_mb, granted_ai_credits, entitlement_expires_at,
                failure_reason, created_at
         FROM payment_transactions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .bind(String(authUser.userId))
      .all();

    return jsonResponse({ success: true, transactions: res.results || [] }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 10. POST /api/payments/paystack/charge-mobile — Interface 100 % StudyCloud (Charge API Wave / Orange / MTN)
  // --------------------------------------------------------------------------
  if (path === '/api/payments/paystack/charge-mobile' && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Connexion requise pour effectuer un paiement.', 401, origin);
    }

    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) {
      return errorResponse(
        'Passerelle Paystack non configurée sur le serveur (STUDYCLOUD_PAYSTACK_SECRET_KEY manquant).',
        503,
        origin
      );
    }

    const config = await readPaymentGatewayConfig(db, rawEnv);
    if (!config.paystackEnabled) {
      return errorResponse('Le paiement Paystack est temporairement désactivé par l’administrateur.', 503, origin);
    }

    const body: any = await request.json().catch(() => ({}));
    const productType = String(body.productType || '').trim().toLowerCase() as PaymentProductType;
    const productId = String(body.productId || '').trim();
    const provider = normalizeMobileMoneyProvider(body.provider);
    const countryIso = String(body.countryIso || '').trim().toUpperCase();
    const normalizedPhone = normalizeIvoryCoastPhone(body.phone, countryIso);
    const billingCycle = (
      body.billingCycle === 'annual'
        ? 'annual'
        : body.billingCycle === 'one_time'
        ? 'one_time'
        : body.billingCycle === 'infinite'
        ? 'infinite'
        : 'monthly'
    ) as 'monthly' | 'annual' | 'one_time' | 'infinite';

    if (!['storage', 'ai', 'app'].includes(productType) || !productId) {
      return errorResponse('Type de produit ou identifiant de forfait manquant.', 400, origin);
    }
    if (!provider) {
      return errorResponse('Opérateur Mobile Money invalide (Wave, Orange Money ou MTN MoMo requis).', 400, origin);
    }
    if (!normalizedPhone || normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      return errorResponse('Veuillez saisir un numéro Mobile Money valide (ex : 07 00 00 00 00).', 400, origin);
    }

    const userId = String(authUser.userId);
    const userRow: any = await db
      .prepare('SELECT id, name, email, phone FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);

    const userEmail = String(userRow?.email || authUser.email || '').trim();
    if (!userEmail || !userEmail.includes('@')) {
      return errorResponse('Une adresse e-mail valide sur votre compte StudyCloud est requise.', 400, origin);
    }
    const userName = String(userRow?.name || authUser.name || 'Utilisateur StudyCloud').trim();

    let planRow: any = null;
    let appKey = '';
    let appName = '';
    let grantedStorageMb = 0;
    let grantedAiCredits = 0;
    let targetStorageMb = 0;
    let recurringPriceAmount = 0;
    let masterAction = '';
    let prorataCreditAmount = 0;
    let masterPriceOverrideMajor: number | null = null;
    let masterDurationOverride: number | null = null;
    let masterBillingModeOverride: BillingMode | null = null;

    if (productType === 'storage') {
      appKey = 'storage';
      appName = 'Stockage Cloud';

      if (productId === 'storage_master_upgrade' || productId === 'storage_master_renew') {
        const masterCfg = await readStorageMasterCardConfig(db);
        if (!masterCfg.enabled) {
          return errorResponse('La Carte Maîtresse de stockage est temporairement désactivée.', 400, origin);
        }
        const userState = await readStorageMasterUserState(db, userId, masterCfg);
        const actionType: 'upgrade' | 'renew' =
          productId === 'storage_master_renew' ? 'renew' : 'upgrade';
        const quote = computeStorageMasterQuote(
          masterCfg,
          userState,
          actionType,
          Number(body.targetPaidMb || 0)
        );
        if (!quote.ok) {
          return errorResponse(quote.error || 'Opération stockage invalide.', 400, origin);
        }
        masterAction = actionType;
        grantedStorageMb = quote.addedMb;
        targetStorageMb = quote.targetPaidMb;
        recurringPriceAmount = quote.newMonthlyPriceFcfa;
        prorataCreditAmount = quote.unusedCreditFcfa;
        masterPriceOverrideMajor = quote.amountDueFcfa;
        masterDurationOverride = quote.durationDays;
        masterBillingModeOverride = quote.billingMode;
        planRow = {
          id: productId,
          name:
            actionType === 'renew'
              ? `Renouvellement Stockage ${formatStorageMbFr(quote.targetPaidMb)}`
              : `Stockage ${formatStorageMbFr(quote.targetPaidMb)}`,
          storage_mb: quote.addedMb,
          price: quote.amountDueFcfa,
          primary_currency: 'XOF',
          billing_mode: quote.billingMode,
          duration_days: quote.durationDays,
          is_auto_billing: quote.billingMode === 'auto' ? 1 : 0,
        };
      } else {
        planRow = await db
          .prepare('SELECT * FROM storage_subscription_plans WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1')
          .bind(productId)
          .first();
        if (planRow) {
          grantedStorageMb = Math.max(0, Number(planRow?.storage_mb || 0));
          const masterCfg = await readStorageMasterCardConfig(db);
          const userState = await readStorageMasterUserState(db, userId, masterCfg);
          if (
            userState.hasActiveSubscription &&
            !userState.isExpired &&
            userState.planId === String(planRow.id) &&
            userState.paidMb >= grantedStorageMb
          ) {
            return errorResponse(
              'Vous êtes déjà abonné à ce forfait de stockage. Utilisez la Carte Maîtresse pour le renouveler ou augmenter votre quota.',
              409,
              origin
            );
          }
          if (userState.paidMb > 0) {
            masterAction = 'booster';
            targetStorageMb = userState.paidMb + grantedStorageMb;
          } else {
            masterAction = 'initial_card';
            targetStorageMb = grantedStorageMb;
          }
        }
      }
    } else if (productType === 'ai') {
      planRow = await db
        .prepare('SELECT * FROM ai_subscription_plans WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1')
        .bind(productId)
        .first();
      appKey = 'ai';
      appName = 'Crédits IA StudyCloud';
      grantedAiCredits = Math.max(0, Number(planRow?.credits_count || 0));
    } else {
      planRow = await db
        .prepare('SELECT * FROM app_subscription_plans WHERE id = ? AND is_active = 1 LIMIT 1')
        .bind(productId)
        .first();
      if (planRow) {
        appKey = sanitizeAppKey(planRow.app_key);
        const appRow: any = await db
          .prepare('SELECT * FROM monetized_apps WHERE app_key = ? LIMIT 1')
          .bind(appKey)
          .first()
          .catch(() => null);
        appName = String(appRow?.name || appKey);
      }
    }

    if (!planRow) {
      return errorResponse('Forfait introuvable ou désactivé.', 404, origin);
    }

    const billingMode =
      masterBillingModeOverride ||
      normalizeBillingMode(
        planRow.billing_mode,
        planRow.is_auto_billing,
        planRow.pricing_model
      );
    const resolvedPricing = resolvePlanPriceMajor(
      planRow,
      billingMode === 'infinite' ? 'infinite' : billingCycle,
      'XOF'
    );
    const amountMajor =
      masterPriceOverrideMajor !== null ? masterPriceOverrideMajor : resolvedPricing.amountMajor;
    const currency = masterPriceOverrideMajor !== null ? 'XOF' : resolvedPricing.currency;
    const durationDays =
      masterDurationOverride !== null ? masterDurationOverride : resolvedPricing.durationDays;
    if (productType === 'storage' && recurringPriceAmount <= 0) {
      if (masterAction === 'booster') {
        const masterCfg = await readStorageMasterCardConfig(db);
        const uState = await readStorageMasterUserState(db, userId, masterCfg);
        recurringPriceAmount = (uState.monthlyPriceFcfa || 0) + amountMajor;
      } else {
        recurringPriceAmount = amountMajor;
      }
    }
    const amountMinor = toPaystackAmountMinor(amountMajor);
    if (amountMinor <= 0) {
      return errorResponse('Montant du forfait invalide.', 400, origin);
    }

    const reference = `SC-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const networkLabel = getMobileProviderLabel(provider);

    await db
      .prepare(
        `INSERT INTO payment_transactions (
           id, reference, user_id, user_name, user_email, user_phone,
           product_type, product_id, product_name, app_key, app_name,
           billing_mode, billing_cycle, duration_days,
           expected_amount, expected_amount_minor, currency,
           provider, channel, network_label, status, granted_storage_mb, granted_ai_credits,
           target_storage_mb, recurring_price_amount, master_action, prorata_credit_amount,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paystack', 'mobile_money', ?, 'pending', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(
        txId,
        reference,
        userId,
        userName,
        userEmail,
        normalizedPhone,
        productType,
        productId,
        String(planRow.name || 'Forfait StudyCloud'),
        appKey,
        appName,
        billingMode,
        billingMode === 'infinite' ? 'infinite' : billingCycle,
        durationDays,
        amountMajor,
        amountMinor,
        currency,
        networkLabel,
        grantedStorageMb,
        grantedAiCredits,
        targetStorageMb,
        recurringPriceAmount,
        masterAction,
        prorataCreditAmount
      )
      .run();

    const chargePayload = {
      email: userEmail,
      amount: amountMinor,
      currency,
      reference,
      mobile_money: {
        phone: normalizedPhone,
        provider,
      },
      metadata: {
        user_id: userId,
        user_name: userName,
        product_type: productType,
        product_id: productId,
        product_name: String(planRow.name || ''),
        app_key: appKey,
        app_name: appName,
        billing_mode: billingMode,
        billing_cycle: billingMode === 'infinite' ? 'infinite' : billingCycle,
        duration_days: durationDays,
        mobile_provider: provider,
      },
    };

    let psRes: Response;
    let psJson: any = null;
    try {
      psRes = await fetchFn(`${PAYSTACK_API_BASE}/charge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chargePayload),
      });
      psJson = await psRes.json().catch(() => null);
    } catch (netErr: any) {
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(String(netErr?.message || 'Erreur réseau Paystack Charge'), reference)
        .run()
        .catch(() => {});
      return errorResponse('Impossible de contacter Paystack pour le moment. Réessayez.', 502, origin);
    }

    if (!psRes.ok || !psJson?.status || !psJson?.data) {
      const rawErrMsg = String(
        psJson?.data?.message ||
          psJson?.message ||
          `Paystack a refusé l'initialisation ${networkLabel}.`
      );
      const errMsg = translatePaystackErrorFr(rawErrMsg, `Paystack a refusé l'initialisation ${networkLabel}.`);
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, raw_verify_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(rawErrMsg, JSON.stringify(psJson || {}).slice(0, 16000), reference)
        .run()
        .catch(() => {});
      return jsonResponse(
        {
          success: false,
          error: errMsg,
          reference,
          provider,
          fallbackSuggested: true,
        },
        200,
        origin
      );
    }

    const data = psJson.data;
    const chargeStatus = String(data.status || 'pending').toLowerCase();
    const displayText = String(data.display_text || data.message || '').trim();
    const openUrl = String(data.url || '').trim();

    if (chargeStatus === 'success') {
      const txRow: any = await db
        .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
        .bind(reference)
        .first();
      const check = validatePaystackVerificationPayload(txRow, data);
      if (check.ok) {
        const fulfillment = await fulfillPaidTransaction(db, txRow, data, { rawEnv, fetchFn });
        return jsonResponse(
          {
            success: true,
            chargeStatus: 'success',
            verified: true,
            reference,
            provider,
            networkLabel,
            amount: amountMajor,
            currency,
            deliverySummary: fulfillment.deliverySummary,
            transaction: fulfillment.transaction,
            subscription: fulfillment.subscription,
            paymentMethod: fulfillment.paymentMethod,
            renewalUiConfig: fulfillment.renewalUiConfig,
          },
          200,
          origin
        );
      }
    }

    if (chargeStatus === 'failed') {
      const reason = translatePaystackErrorFr(displayText, 'Paiement refusé par votre opérateur Mobile Money.');
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(displayText || reason, reference)
        .run()
        .catch(() => {});
      return jsonResponse(
        {
          success: false,
          chargeStatus: 'failed',
          reference,
          error: reason,
        },
        200,
        origin
      );
    }

    return jsonResponse(
      {
        success: true,
        chargeStatus:
          chargeStatus === 'send_otp'
            ? 'send_otp'
            : chargeStatus === 'open_url' || openUrl
            ? 'open_url'
            : 'pay_offline',
        reference,
        provider,
        networkLabel,
        amount: amountMajor,
        currency,
        displayText:
          displayText ||
          (provider === 'wave'
            ? 'Ouvrez votre application Wave pour confirmer le paiement.'
            : `Validez la demande ${networkLabel} sur votre téléphone (${normalizedPhone}).`),
        openUrl: openUrl || undefined,
        mode: detectPaystackMode(secretKey),
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 11. POST /api/payments/paystack/submit-otp — Validation du code OTP Mobile Money
  // --------------------------------------------------------------------------
  if (path === '/api/payments/paystack/submit-otp' && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }

    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) {
      return errorResponse('Passerelle Paystack non configurée.', 503, origin);
    }

    const body: any = await request.json().catch(() => ({}));
    const reference = String(body.reference || '').trim();
    const otp = String(body.otp || '').trim();
    if (!reference || !otp) {
      return errorResponse('Référence et code OTP requis.', 400, origin);
    }

    // Anti-IDOR strict
    const txRow: any = await db
      .prepare('SELECT * FROM payment_transactions WHERE reference = ? AND user_id = ? LIMIT 1')
      .bind(reference, String(authUser.userId))
      .first();
    if (!txRow) {
      return errorResponse('Transaction introuvable ou non autorisée.', 404, origin);
    }

    if (txRow.status === 'paid' && txRow.fulfilled_at) {
      return jsonResponse(
        {
          success: true,
          chargeStatus: 'success',
          verified: true,
          alreadyFulfilled: true,
          transaction: txRow,
        },
        200,
        origin
      );
    }

    let psRes: Response;
    let psJson: any = null;
    try {
      psRes = await fetchFn(`${PAYSTACK_API_BASE}/charge/submit_otp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp, reference }),
      });
      psJson = await psRes.json().catch(() => null);
    } catch {
      return errorResponse('Erreur réseau lors de la soumission du code OTP.', 502, origin);
    }

    if (!psRes.ok || !psJson?.status || !psJson?.data) {
      return jsonResponse(
        {
          success: false,
          chargeStatus: 'send_otp',
          error: String(psJson?.data?.message || psJson?.message || 'Code OTP invalide ou expiré.'),
        },
        200,
        origin
      );
    }

    const data = psJson.data;
    const chargeStatus = String(data.status || 'pending').toLowerCase();
    const displayText = String(data.display_text || data.message || '').trim();
    const openUrl = String(data.url || '').trim();

    if (chargeStatus === 'success') {
      const check = validatePaystackVerificationPayload(txRow, data);
      if (!check.ok) {
        return jsonResponse({ success: false, verified: false, error: check.reason }, 200, origin);
      }
      const fulfillment = await fulfillPaidTransaction(db, txRow, data, { rawEnv, fetchFn });
      return jsonResponse(
        {
          success: true,
          chargeStatus: 'success',
          verified: true,
          alreadyFulfilled: fulfillment.alreadyFulfilled,
          deliverySummary: fulfillment.deliverySummary,
          transaction: fulfillment.transaction,
          subscription: fulfillment.subscription,
          paymentMethod: fulfillment.paymentMethod,
          renewalUiConfig: fulfillment.renewalUiConfig,
        },
        200,
        origin
      );
    }

    if (chargeStatus === 'failed') {
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status = 'pending'"
        )
        .bind(displayText || 'Code OTP refusé', reference)
        .run()
        .catch(() => {});
      return jsonResponse(
        {
          success: false,
          chargeStatus: 'failed',
          error: displayText || 'Paiement refusé après validation OTP.',
        },
        200,
        origin
      );
    }

    return jsonResponse(
      {
        success: true,
        chargeStatus: openUrl || chargeStatus === 'open_url' ? 'open_url' : 'pay_offline',
        verified: false,
        reference,
        displayText: displayText || 'Veuillez finaliser la confirmation sur votre téléphone.',
        openUrl: openUrl || undefined,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 12. GET /api/billing/my-subscriptions — Tous les abonnements & cartes masquées de l'utilisateur
  // --------------------------------------------------------------------------
  if (path === '/api/billing/my-subscriptions' && method === 'GET') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const userId = String(authUser.userId);

    const subsRes = await db
      .prepare('SELECT * FROM active_subscriptions WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 100')
      .bind(userId)
      .all()
      .catch(() => ({ results: [] }));
    const pmRes = await db
      .prepare('SELECT * FROM user_payment_methods WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, updated_at DESC')
      .bind(userId)
      .all()
      .catch(() => ({ results: [] }));
    const evRes = await db
      .prepare(
        `SELECT id, subscription_id, event_type, actor, details_json, created_at
         FROM subscription_events
         WHERE user_id = ?
           AND LOWER(COALESCE(actor, '')) != 'admin'
           AND event_type NOT IN ('admin_updated', 'admin_created', 'email_sent', 'updated')
         ORDER BY created_at DESC LIMIT 50`
      )
      .bind(userId)
      .all()
      .catch(() => ({ results: [] }));

    const pmById = new Map<string, any>();
    const maskedPaymentMethods: any[] = [];
    for (const pm of pmRes.results || []) {
      const masked = maskPaymentMethodForClient(pm);
      if (masked) {
        pmById.set(masked.id, masked);
        maskedPaymentMethods.push(masked);
      }
    }

    const subscriptions = (subsRes.results || []).map((s: any) => ({
      ...s,
      countdown: computeSubscriptionCountdown(s.current_period_end, s.is_infinite, s.grace_until),
      paymentMethod: s.payment_method_id ? pmById.get(String(s.payment_method_id)) || null : null,
      canEnableAuto: Number(s.is_infinite) !== 1 && Number(s.plan_allows_auto) === 1 && maskedPaymentMethods.length > 0,
    }));

    return jsonResponse(
      {
        success: true,
        subscriptions,
        paymentMethods: maskedPaymentMethods,
        recentEvents: evRes.results || [],
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 13. PATCH /api/billing/subscriptions/:id/renewal-mode — Choix utilisateur Auto <-> Manuel (Anti-IDOR)
  // --------------------------------------------------------------------------
  const renewalMatch = path.match(/^\/api\/billing\/subscriptions\/([^/]+)\/renewal-mode$/);
  if (renewalMatch && (method === 'PATCH' || method === 'POST')) {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const userId = String(authUser.userId);
    const subId = decodeURIComponent(renewalMatch[1]);
    const body: any = await request.json().catch(() => ({}));
    const requestedMode = String(body.renewalMode || body.renewal_mode || '').trim().toLowerCase();

    if (requestedMode !== 'auto' && requestedMode !== 'manual') {
      return errorResponse('Mode de renouvellement invalide (auto ou manual attendu).', 400, origin);
    }

    // Anti-IDOR strict : l'utilisateur ne peut modifier QUE ses propres abonnements
    const sub: any = await db
      .prepare('SELECT * FROM active_subscriptions WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subId, userId)
      .first();
    if (!sub) {
      return errorResponse('Abonnement introuvable ou non autorisé.', 404, origin);
    }

    if (Number(sub.is_infinite) === 1 || sub.renewal_mode === 'infinite') {
      return errorResponse('Un abonnement à vie (Infini) ne nécessite aucun renouvellement.', 400, origin);
    }

    let linkedPaymentMethodId = String(sub.payment_method_id || '');
    let maskedCard: any = null;

    if (requestedMode === 'auto') {
      if (Number(sub.plan_allows_auto) !== 1) {
        return errorResponse('Ce forfait autorise uniquement le renouvellement manuel.', 400, origin);
      }
      const wantedPmId = String(body.paymentMethodId || body.payment_method_id || linkedPaymentMethodId || '').trim();
      let pmRow: any = null;
      if (wantedPmId) {
        pmRow = await db
          .prepare('SELECT * FROM user_payment_methods WHERE id = ? AND user_id = ? AND is_active = 1 AND reusable = 1 LIMIT 1')
          .bind(wantedPmId, userId)
          .first()
          .catch(() => null);
      }
      if (!pmRow) {
        pmRow = await db
          .prepare('SELECT * FROM user_payment_methods WHERE user_id = ? AND is_active = 1 AND reusable = 1 ORDER BY is_default DESC, updated_at DESC LIMIT 1')
          .bind(userId)
          .first()
          .catch(() => null);
      }
      if (!pmRow) {
        return errorResponse(
          'Aucune carte bancaire enregistrée sur votre compte. Ajoutez une carte Visa ou Mastercard pour activer le paiement automatique.',
          400,
          origin
        );
      }
      linkedPaymentMethodId = String(pmRow.id);
      const updatedCard = await syncCardPermissionFlagForService(
        db,
        linkedPaymentMethodId,
        userId,
        String(sub.product_type || ''),
        String(sub.app_key || ''),
        true
      );
      maskedCard = maskPaymentMethodForClient(updatedCard || pmRow);
    } else if (linkedPaymentMethodId) {
      // Si l'utilisateur bascule en manuel et n'a plus d'autre abonnement auto actif pour ce même service sur cette carte,
      // on décoche proprement ce service sur la carte.
      const otherAuto = await db
        .prepare(
          `SELECT id FROM active_subscriptions
           WHERE user_id = ? AND payment_method_id = ? AND product_type = ? AND app_key = ?
             AND renewal_mode = 'auto' AND status IN ('active', 'grace', 'past_due') AND id != ?
           LIMIT 1`
        )
        .bind(userId, linkedPaymentMethodId, String(sub.product_type || ''), String(sub.app_key || ''), subId)
        .first()
        .catch(() => null);
      if (!otherAuto) {
        await syncCardPermissionFlagForService(
          db,
          linkedPaymentMethodId,
          userId,
          String(sub.product_type || ''),
          String(sub.app_key || ''),
          false
        );
      }
    }

    await db
      .prepare(
        `UPDATE active_subscriptions
         SET renewal_mode = ?,
             user_confirmed_renewal = 1,
             payment_method_id = ?,
             cancel_at_period_end = CASE WHEN ? = 'auto' THEN 0 ELSE cancel_at_period_end END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .bind(requestedMode, linkedPaymentMethodId, requestedMode, subId, userId)
      .run();

    // Synchroniser user_app_entitlements.auto_renew si abonnement application
    if (sub.product_type === 'app' && sub.app_key) {
      await db
        .prepare('UPDATE user_app_entitlements SET auto_renew = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
        .bind(requestedMode === 'auto' ? 1 : 0, userId, sub.app_key)
        .run()
        .catch(() => {});
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: subId,
      userId,
      eventType: requestedMode === 'auto' ? 'switched_to_auto' : 'switched_to_manual',
      actor: 'user',
      details: {
        previousMode: sub.renewal_mode,
        newMode: requestedMode,
        paymentMethodId: linkedPaymentMethodId || null,
      },
    });

    const updatedSub = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ? LIMIT 1').bind(subId).first();
    return jsonResponse(
      {
        success: true,
        subscription: updatedSub
          ? {
              ...updatedSub,
              countdown: computeSubscriptionCountdown(updatedSub.current_period_end, updatedSub.is_infinite, updatedSub.grace_until),
              paymentMethod: maskedCard,
            }
          : null,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 14. DELETE /api/billing/payment-methods/:id — Retirer une carte enregistrée (bascule auto -> manuel)
  // --------------------------------------------------------------------------
  const pmDeleteMatch = path.match(/^\/api\/billing\/payment-methods\/([^/]+)$/);
  if (pmDeleteMatch && method === 'DELETE') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const userId = String(authUser.userId);
    const pmId = decodeURIComponent(pmDeleteMatch[1]);

    const pmRow: any = await db
      .prepare('SELECT * FROM user_payment_methods WHERE id = ? AND user_id = ? AND is_active = 1 LIMIT 1')
      .bind(pmId, userId)
      .first();
    if (!pmRow) {
      return errorResponse('Carte introuvable ou non autorisée.', 404, origin);
    }

    await db
      .prepare('UPDATE user_payment_methods SET is_active = 0, is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .bind(pmId, userId)
      .run();

    // Basculer en mode manuel tous les abonnements automatiques qui reposaient sur cette carte
    const affectedRes = await db
      .prepare("SELECT id, product_type, app_key FROM active_subscriptions WHERE user_id = ? AND payment_method_id = ? AND renewal_mode = 'auto'")
      .bind(userId, pmId)
      .all()
      .catch(() => ({ results: [] }));

    await db
      .prepare(
        `UPDATE active_subscriptions
         SET renewal_mode = CASE WHEN renewal_mode = 'auto' THEN 'manual' ELSE renewal_mode END,
             payment_method_id = '',
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND payment_method_id = ?`
      )
      .bind(userId, pmId)
      .run()
      .catch(() => {});

    for (const sub of affectedRes.results || []) {
      if (sub.product_type === 'app' && sub.app_key) {
        await db
          .prepare('UPDATE user_app_entitlements SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
          .bind(userId, sub.app_key)
          .run()
          .catch(() => {});
      }
      await recordSubscriptionEvent(db, {
        subscriptionId: String(sub.id),
        userId,
        eventType: 'switched_to_manual',
        actor: 'user',
        details: { reason: 'card_removed', removedCardLast4: pmRow.last4 || '' },
      });
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: String((affectedRes.results || [])[0]?.id || ''),
      userId,
      eventType: 'card_removed',
      actor: 'user',
      details: { paymentMethodId: pmId, cardBrand: pmRow.card_brand, last4: pmRow.last4 },
    });

    return jsonResponse(
      {
        success: true,
        removedId: pmId,
        switchedToManualCount: (affectedRes.results || []).length,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 14B. PATCH /api/billing/payment-methods/:id/permissions — Permissions par service (Anti-IDOR)
  // --------------------------------------------------------------------------
  const pmPermMatch = path.match(/^\/api\/billing\/payment-methods\/([^/]+)\/permissions$/);
  if (pmPermMatch && (method === 'PATCH' || method === 'POST')) {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const userId = String(authUser.userId);
    const pmId = decodeURIComponent(pmPermMatch[1]);

    const pmRow: any = await db
      .prepare('SELECT * FROM user_payment_methods WHERE id = ? AND user_id = ? AND is_active = 1 LIMIT 1')
      .bind(pmId, userId)
      .first();
    if (!pmRow) {
      return errorResponse('Carte introuvable ou non autorisée.', 404, origin);
    }

    const body: any = await request.json().catch(() => ({}));
    const nextAutoStorage =
      body.autoStorage !== undefined ? (body.autoStorage ? 1 : 0) : Number(pmRow.auto_storage || 0);
    const nextAutoAi = body.autoAi !== undefined ? (body.autoAi ? 1 : 0) : Number(pmRow.auto_ai || 0);
    const nextAutoAiOnDepleted =
      nextAutoAi === 1
        ? body.autoAiOnDepleted !== undefined
          ? body.autoAiOnDepleted
            ? 1
            : 0
          : Number(pmRow.auto_ai_on_depleted || 0)
        : 0;
    const nextAutoApps =
      body.autoApps !== undefined
        ? parseAutoAppsJson(body.autoApps)
        : body.autoAllApps !== undefined
        ? body.autoAllApps
          ? ['*']
          : []
        : parseAutoAppsJson(pmRow.auto_apps_json);
    const nextAutoAppsJson = JSON.stringify(nextAutoApps);

    await db
      .prepare(
        `UPDATE user_payment_methods
         SET auto_storage = ?, auto_ai = ?, auto_ai_on_depleted = ?, auto_apps_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .bind(nextAutoStorage, nextAutoAi, nextAutoAiOnDepleted, nextAutoAppsJson, pmId, userId)
      .run();

    const updatedPm: any = await db
      .prepare('SELECT * FROM user_payment_methods WHERE id = ? LIMIT 1')
      .bind(pmId)
      .first();

    // Synchroniser les abonnements actifs non-infinis de l'utilisateur
    const syncSubs = body.syncSubscriptions !== false;
    let switchedToAutoCount = 0;
    let switchedToManualCount = 0;

    if (syncSubs && updatedPm) {
      const userSubsRes = await db
        .prepare(
          `SELECT * FROM active_subscriptions
           WHERE user_id = ? AND status IN ('active', 'trial', 'grace', 'past_due')
             AND COALESCE(is_infinite, 0) = 0`
        )
        .bind(userId)
        .all()
        .catch(() => ({ results: [] }));

      for (const sub of userSubsRes.results || []) {
        const pType = String(sub.product_type || '').toLowerCase();
        const appKey = sanitizeAppKey(sub.app_key || '');
        const isServiceAuthorized =
          (pType === 'storage' && nextAutoStorage === 1) ||
          (pType === 'ai' && nextAutoAi === 1) ||
          (pType === 'app' && (nextAutoApps.includes('*') || (appKey && nextAutoApps.includes(appKey))));

        if (!isServiceAuthorized && sub.renewal_mode === 'auto' && String(sub.payment_method_id || '') === pmId) {
          await db
            .prepare(
              `UPDATE active_subscriptions
               SET renewal_mode = 'manual', updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND user_id = ?`
            )
            .bind(sub.id, userId)
            .run()
            .catch(() => {});
          if (pType === 'app' && appKey) {
            await db
              .prepare('UPDATE user_app_entitlements SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
              .bind(userId, appKey)
              .run()
              .catch(() => {});
          }
          switchedToManualCount++;
        } else if (
          isServiceAuthorized &&
          Number(sub.plan_allows_auto) === 1 &&
          Number(sub.cancel_at_period_end) !== 1 &&
          (sub.renewal_mode !== 'auto' || !sub.payment_method_id)
        ) {
          await db
            .prepare(
              `UPDATE active_subscriptions
               SET payment_method_id = ?, renewal_mode = 'auto', user_confirmed_renewal = 1, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND user_id = ?`
            )
            .bind(pmId, sub.id, userId)
            .run()
            .catch(() => {});
          if (pType === 'app' && appKey) {
            await db
              .prepare('UPDATE user_app_entitlements SET auto_renew = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
              .bind(userId, appKey)
              .run()
              .catch(() => {});
          }
          switchedToAutoCount++;
        }
      }
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: '',
      userId,
      eventType: 'card_permissions_updated',
      actor: 'user',
      details: {
        paymentMethodId: pmId,
        last4: updatedPm?.last4 || '',
        autoStorage: nextAutoStorage === 1,
        autoAi: nextAutoAi === 1,
        autoAiOnDepleted: nextAutoAiOnDepleted === 1,
        autoApps: nextAutoApps,
        switchedToAutoCount,
        switchedToManualCount,
      },
    });

    return jsonResponse(
      {
        success: true,
        paymentMethod: maskPaymentMethodForClient(updatedPm),
        switchedToAutoCount,
        switchedToManualCount,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 15. GET /api/billing/policies — Lecture des règles de relances & délais par service
  // --------------------------------------------------------------------------
  if (path === '/api/billing/policies' && method === 'GET') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const rulesRes = await db
      .prepare('SELECT * FROM billing_policy_rules WHERE is_active = 1 ORDER BY scope_type ASC, scope_key ASC')
      .all()
      .catch(() => ({ results: [] }));
    return jsonResponse({ success: true, policies: rulesRes.results || [] }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 16. GET /api/billing/status-banner — Alertes impayés / grâce / blocage pour l'utilisateur connecté
  // --------------------------------------------------------------------------
  if (path === '/api/billing/status-banner' && method === 'GET') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const guard = await evaluateUserBillingGuard(db, String(authUser.userId));
    return jsonResponse({ success: true, ...guard }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 17. POST /api/billing/subscriptions/:id/cancel — Annuler le renouvellement auto en fin de période (Anti-IDOR)
  // --------------------------------------------------------------------------
  const userCancelMatch = path.match(/^\/api\/billing\/subscriptions\/([^/]+)\/cancel$/);
  if (userCancelMatch && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const userId = String(authUser.userId);
    const subId = decodeURIComponent(userCancelMatch[1]);
    const sub: any = await db
      .prepare('SELECT * FROM active_subscriptions WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subId, userId)
      .first();
    if (!sub) return errorResponse('Abonnement introuvable ou non autorisé.', 404, origin);
    if (Number(sub.is_infinite) === 1) {
      return errorResponse('Un abonnement à vie (Infini) ne peut pas être annulé.', 400, origin);
    }

    const nowIso = new Date().toISOString();
    await db
      .prepare(
        `UPDATE active_subscriptions
         SET cancel_at_period_end = 1,
             renewal_mode = 'manual',
             cancelled_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .bind(nowIso, subId, userId)
      .run();

    if (sub.product_type === 'app' && sub.app_key) {
      await db
        .prepare('UPDATE user_app_entitlements SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
        .bind(userId, sub.app_key)
        .run()
        .catch(() => {});
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: subId,
      userId,
      eventType: 'user_cancelled_auto',
      actor: 'user',
      details: { cancelAtPeriodEnd: true, currentPeriodEnd: sub.current_period_end },
    });

    const refreshed: any = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ?').bind(subId).first();
    return jsonResponse(
      {
        success: true,
        subscription: refreshed
          ? { ...refreshed, countdown: computeSubscriptionCountdown(refreshed.current_period_end, refreshed.is_infinite, refreshed.grace_until) }
          : null,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 18. POST /api/billing/payment-methods/link-init & link-verify — Associer une carte Visa/Mastercard plus tard
  // --------------------------------------------------------------------------
  if (path === '/api/billing/payment-methods/link-init' && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) return errorResponse('Passerelle Paystack non configurée.', 503, origin);

    const userId = String(authUser.userId);
    const body: any = await request.json().catch(() => ({}));
    const targetSubId = String(body.subscriptionId || '').trim();
    const enableAutoAfterLink = body.enableAuto !== false;
    const hasExplicitPerms =
      body.autoStorage !== undefined ||
      body.autoAi !== undefined ||
      body.autoAiOnDepleted !== undefined ||
      body.autoApps !== undefined ||
      body.autoAllApps !== undefined;
    const permAutoStorage = Boolean(body.autoStorage);
    const permAutoAi = Boolean(body.autoAi);
    const permAutoAiOnDepleted = permAutoAi && Boolean(body.autoAiOnDepleted);
    const permAutoApps =
      body.autoApps !== undefined
        ? parseAutoAppsJson(body.autoApps)
        : body.autoAllApps
        ? ['*']
        : [];

    const uRow: any = await db
      .prepare('SELECT id, name, email FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);
    const email = String(uRow?.email || authUser.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return errorResponse('Adresse email de compte requise pour lier une carte bancaire.', 400, origin);
    }

    // Paystack exige une empreinte minimale (100 FCFA) pour tokeniser une carte Visa/Mastercard réutilisable.
    // Cette empreinte est automatiquement remboursée dès validation dans /link-verify (0 FCFA net).
    const linkAmountMajor = 100;
    const linkAmountMinor = linkAmountMajor * 100;
    const reference = `SC-CARD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const psRes = await fetchFn(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: linkAmountMinor,
        currency: 'XOF',
        reference,
        channels: ['card'],
        metadata: {
          purpose: 'card_link',
          user_id: userId,
          subscription_id: targetSubId,
          enable_auto: enableAutoAfterLink,
          has_explicit_perms: hasExplicitPerms,
          auto_storage: permAutoStorage,
          auto_ai: permAutoAi,
          auto_ai_on_depleted: permAutoAiOnDepleted,
          auto_apps: permAutoApps,
        },
      }),
    });
    const psJson: any = await psRes.json().catch(() => null);
    if (!psRes.ok || !psJson?.status || !psJson?.data?.access_code) {
      return errorResponse(String(psJson?.message || 'Impossible d’initialiser la liaison de carte.'), 502, origin);
    }

    return jsonResponse(
      {
        success: true,
        reference,
        accessCode: psJson.data.access_code,
        authorizationUrl: psJson.data.authorization_url,
        verificationAmountFcfa: linkAmountMajor,
        autoRefundEnabled: true,
      },
      200,
      origin
    );
  }

  if (path === '/api/billing/payment-methods/link-verify' && method === 'POST') {
    const authUser = await getAuthUser(request);
    if (!authUser?.userId) {
      return errorResponse('Authentification requise.', 401, origin);
    }
    const secretKey = getPaystackSecretKey(rawEnv);
    if (!secretKey) return errorResponse('Passerelle Paystack non configurée.', 503, origin);

    const userId = String(authUser.userId);
    const body: any = await request.json().catch(() => ({}));
    const reference = String(body.reference || '').trim();
    const targetSubId = String(body.subscriptionId || '').trim();
    const enableAuto = body.enableAuto !== false;
    if (!reference) return errorResponse('reference requise.', 400, origin);

    // Sécurité critique anti-remboursement abusif :
    // Seule une empreinte de liaison de carte (`SC-CARD-...`), absente de `payment_transactions`,
    // peut être vérifiée et remboursée ici (interdiction absolue de passer une référence d'achat `SC-PAY-...`).
    if (!reference.startsWith('SC-CARD-')) {
      return errorResponse('Référence de vérification de carte invalide.', 400, origin);
    }
    const realPurchaseTx: any = await db
      .prepare('SELECT id FROM payment_transactions WHERE reference = ? LIMIT 1')
      .bind(reference)
      .first()
      .catch(() => null);
    if (realPurchaseTx) {
      return errorResponse('Cette référence correspond à un achat existant et ne peut pas être remboursée ici.', 400, origin);
    }

    const psRes = await fetchFn(`${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const psJson: any = await psRes.json().catch(() => null);
    if (!psRes.ok || !psJson?.status || !psJson?.data || psJson.data.status !== 'success') {
      return errorResponse(
        translatePaystackErrorFr(psJson?.data?.gateway_response || psJson?.message, 'Vérification de carte échouée.'),
        400,
        origin
      );
    }

    // Anti-IDOR + contrôle strict d'intention, montant (100 FCFA exact) et devise (XOF)
    const meta = psJson.data?.metadata || {};
    const metaUserId = String(meta?.user_id || '').trim();
    if (!metaUserId || metaUserId !== userId) {
      return errorResponse('Référence non autorisée pour ce compte.', 403, origin);
    }
    if (String(meta?.purpose || '').trim() !== 'card_link') {
      return errorResponse('Cette transaction n’est pas une empreinte de vérification de carte.', 400, origin);
    }
    if (Number(psJson.data?.amount) !== 10000 || String(psJson.data?.currency || '').trim().toUpperCase() !== 'XOF') {
      return errorResponse('Montant ou devise d’empreinte de vérification invalide.', 400, origin);
    }
    if (String(psJson.data?.channel || '').trim().toLowerCase() !== 'card') {
      return errorResponse('Seule une carte bancaire peut être vérifiée via cette procédure.', 400, origin);
    }

    const subIdToLink = targetSubId || String(meta?.subscription_id || '').trim();
    let targetSubRow: any = null;
    if (subIdToLink) {
      targetSubRow = await db
        .prepare('SELECT * FROM active_subscriptions WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(subIdToLink, userId)
        .first()
        .catch(() => null);
    }

    // Déterminer les permissions par service choisies dans la modale StudyCloud (ou déduites de l'abonnement cible)
    const bodyHasPerms =
      body.autoStorage !== undefined ||
      body.autoAi !== undefined ||
      body.autoAiOnDepleted !== undefined ||
      body.autoApps !== undefined ||
      body.autoAllApps !== undefined;
    const metaHasPerms = Boolean(meta?.has_explicit_perms);

    let permAutoStorage = false;
    let permAutoAi = false;
    let permAutoAiOnDepleted = false;
    let permAutoApps: string[] = [];

    if (bodyHasPerms) {
      permAutoStorage = Boolean(body.autoStorage);
      permAutoAi = Boolean(body.autoAi);
      permAutoAiOnDepleted = permAutoAi && Boolean(body.autoAiOnDepleted);
      permAutoApps =
        body.autoApps !== undefined
          ? parseAutoAppsJson(body.autoApps)
          : body.autoAllApps
          ? ['*']
          : [];
    } else if (metaHasPerms) {
      permAutoStorage = Boolean(meta.auto_storage);
      permAutoAi = Boolean(meta.auto_ai);
      permAutoAiOnDepleted = permAutoAi && Boolean(meta.auto_ai_on_depleted);
      permAutoApps = parseAutoAppsJson(meta.auto_apps);
    } else if (targetSubRow && enableAuto) {
      const pType = String(targetSubRow.product_type || '').toLowerCase();
      if (pType === 'storage') permAutoStorage = true;
      else if (pType === 'ai') permAutoAi = true;
      else if (pType === 'app' && targetSubRow.app_key) permAutoApps = [sanitizeAppKey(targetSubRow.app_key)];
    }

    const savedCard = await upsertUserPaymentMethodFromPaystack(db, {
      userId,
      authEmail: String(psJson.data?.customer?.email || authUser.email || ''),
      channel: 'card',
      paystackData: psJson.data,
      servicePermissions: {
        mode: bodyHasPerms || metaHasPerms ? 'replace' : 'merge',
        autoStorage: permAutoStorage,
        autoAi: permAutoAi,
        autoAiOnDepleted: permAutoAiOnDepleted,
        autoApps: permAutoApps,
      },
    });
    if (!savedCard) {
      return errorResponse('Cette carte ne permet pas le prélèvement récurrent sécurisé (non réutilisable).', 400, origin);
    }

    // Verrou anti-rejeu atomique : le remboursement automatique de l'empreinte (100 FCFA)
    // ne peut être déclenché qu'une SEULE fois par référence `SC-CARD-...`
    const verifLockRes: any = await db
      .prepare(
        'INSERT OR IGNORE INTO card_link_verifications (reference, user_id, payment_method_id, refunded) VALUES (?, ?, ?, 0)'
      )
      .bind(reference, userId, savedCard.id)
      .run()
      .catch(() => ({ meta: { changes: 0 } }));
    const isFirstCardLinkVerification = Number(verifLockRes?.meta?.changes || 0) === 1;

    // REMBOURSEMENT AUTOMATIQUE IMMÉDIAT DE L'EMPREINTE DE 100 FCFA (0 FCFA NET POUR L'UTILISATEUR)
    let refunded = false;
    let refundStatus = 'skipped';
    let refundMessage = '';
    if (!isFirstCardLinkVerification) {
      refundStatus = 'already_processed';
      refundMessage = 'Empreinte de vérification déjà traitée.';
    } else {
      try {
        const refundResp = await fetchFn(`${PAYSTACK_API_BASE}/refund`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction: reference,
            customer_note: 'Remboursement automatique empreinte de vérification carte StudyCloud (0 FCFA net)',
            merchant_note: `Auto-refund card link ${reference} (user ${userId})`,
          }),
        });
        const refundJson: any = await refundResp.json().catch(() => null);
        if (refundResp.ok && refundJson?.status) {
          refunded = true;
          refundStatus = String(refundJson?.data?.status || 'processed');
          refundMessage = 'Empreinte de vérification de 100 FCFA remboursée automatiquement.';
          await db
            .prepare('UPDATE card_link_verifications SET refunded = 1 WHERE reference = ?')
            .bind(reference)
            .run()
            .catch(() => {});
        } else {
          refundStatus = 'pending_bank';
          refundMessage = String(refundJson?.message || 'Empreinte en cours de libération par la banque.');
        }
      } catch (refErr: any) {
        refundStatus = 'deferred';
        refundMessage = String(refErr?.message || 'Libération de l’empreinte différée.');
      }
    }

    let updatedSub: any = null;
    let autoLinkedCount = 0;

    if (targetSubRow && Number(targetSubRow.is_infinite) !== 1) {
      const shouldAuto = enableAuto && Number(targetSubRow.plan_allows_auto) === 1;
      await db
        .prepare(
          `UPDATE active_subscriptions
           SET payment_method_id = ?,
               renewal_mode = CASE WHEN ? = 1 THEN 'auto' ELSE renewal_mode END,
               user_confirmed_renewal = 1,
               cancel_at_period_end = CASE WHEN ? = 1 THEN 0 ELSE cancel_at_period_end END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`
        )
        .bind(savedCard.id, shouldAuto ? 1 : 0, shouldAuto ? 1 : 0, subIdToLink, userId)
        .run();
      if (shouldAuto) {
        autoLinkedCount++;
        if (targetSubRow.product_type === 'app' && targetSubRow.app_key) {
          await db
            .prepare('UPDATE user_app_entitlements SET auto_renew = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
            .bind(userId, targetSubRow.app_key)
            .run()
            .catch(() => {});
        }
      }
      updatedSub = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ?').bind(subIdToLink).first();
    }

    // Rattacher automatiquement cette carte aux abonnements actifs non-infinis compatibles avec les services cochés
    if (enableAuto) {
      const existingSubsRes = await db
        .prepare(
          `SELECT * FROM active_subscriptions
           WHERE user_id = ?
             AND status IN ('active', 'trial', 'grace', 'past_due')
             AND COALESCE(is_infinite, 0) = 0
             AND COALESCE(plan_allows_auto, 0) = 1
             AND COALESCE(cancel_at_period_end, 0) = 0`
        )
        .bind(userId)
        .all()
        .catch(() => ({ results: [] }));

      for (const s of existingSubsRes.results || []) {
        if (subIdToLink && String(s.id) === subIdToLink) continue;
        const pType = String(s.product_type || '').toLowerCase();
        const aKey = sanitizeAppKey(s.app_key || '');
        const matchesPerm =
          (pType === 'storage' && Number(savedCard.auto_storage) === 1) ||
          (pType === 'ai' && Number(savedCard.auto_ai) === 1) ||
          (pType === 'app' && (permAutoApps.includes('*') || (aKey && permAutoApps.includes(aKey))));
        if (!matchesPerm) continue;

        await db
          .prepare(
            `UPDATE active_subscriptions
             SET payment_method_id = ?, renewal_mode = 'auto', user_confirmed_renewal = 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`
          )
          .bind(savedCard.id, s.id, userId)
          .run()
          .catch(() => {});
        if (pType === 'app' && aKey) {
          await db
            .prepare('UPDATE user_app_entitlements SET auto_renew = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?')
            .bind(userId, aKey)
            .run()
            .catch(() => {});
        }
        autoLinkedCount++;
      }
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: subIdToLink || '',
      userId,
      eventType: 'card_linked',
      actor: 'user',
      details: {
        paymentMethodId: savedCard.id,
        cardBrand: savedCard.card_brand,
        last4: savedCard.last4,
        linkedSubscriptionId: subIdToLink || null,
        switchedToAuto: Boolean(updatedSub && updatedSub.renewal_mode === 'auto') || autoLinkedCount > 0,
        autoLinkedCount,
        autoStorage: Number(savedCard.auto_storage) === 1,
        autoAi: Number(savedCard.auto_ai) === 1,
        autoAiOnDepleted: Number(savedCard.auto_ai_on_depleted) === 1,
        autoApps: parseAutoAppsJson(savedCard.auto_apps_json),
        refunded,
        refundStatus,
      },
    });

    return jsonResponse(
      {
        success: true,
        paymentMethod: maskPaymentMethodForClient(savedCard),
        subscription: updatedSub
          ? { ...updatedSub, countdown: computeSubscriptionCountdown(updatedSub.current_period_end, updatedSub.is_infinite, updatedSub.grace_until) }
          : null,
        autoLinkedCount,
        refunded,
        refundStatus,
        refundMessage,
      },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 19. POST /api/webhooks/resend — Suivi temps réel des emails (reçu / ouvert / rebondi)
  // --------------------------------------------------------------------------
  if (path === '/api/webhooks/resend' && method === 'POST') {
    const rawBody = await request.text();
    const resendWebhookSecret = String(rawEnv?.RESEND_WEBHOOK_SECRET || '').trim();
    if (resendWebhookSecret) {
      const svixCheck = await verifyResendSvixSignature(rawBody, request.headers, resendWebhookSecret);
      if (!svixCheck.valid) {
        return errorResponse('Signature webhook Resend invalide ou expirée.', 401, origin);
      }
    }
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }
    const result = await processResendWebhookEvent(db, body);
    return jsonResponse({ success: true, ...result }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 20. ROUTES ADMIN ABONNEMENTS, EMAILS, POLITIQUES & CRON (/api/admin/billing/*)
  // Toutes strictement protégées par clé serveur-à-serveur (`ADMIN_API_SECRET`)
  // --------------------------------------------------------------------------
  if (path.startsWith('/api/admin/')) {
    const adminAuth = verifyAdminApiAuth(request, rawEnv);
    if (!adminAuth.ok) {
      return errorResponse(adminAuth.error || 'Accès administrateur refusé.', adminAuth.status || 401, origin);
    }
  }

  if (path === '/api/admin/billing/subscriptions' && method === 'GET') {
    const subsRes = await db
      .prepare('SELECT * FROM active_subscriptions ORDER BY updated_at DESC LIMIT 500')
      .all()
      .catch(() => ({ results: [] }));
    const pmRes = await db
      .prepare(
        `SELECT pm.*, u.name AS u_name, u.email AS u_email, u.phone AS u_phone
         FROM user_payment_methods pm
         LEFT JOIN users u ON u.id = pm.user_id
         WHERE pm.is_active = 1
         ORDER BY pm.updated_at DESC LIMIT 500`
      )
      .all()
      .catch(async () =>
        db.prepare('SELECT * FROM user_payment_methods WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 500').all().catch(() => ({ results: [] }))
      );

    const pmMap = new Map<string, any>();
    const activeSubsByPmId = new Map<string, any[]>();
    const activeSubsByUserId = new Map<string, any[]>();

    for (const s of subsRes.results || []) {
      const uid = String(s.user_id || '');
      if (['active', 'trial', 'grace', 'past_due'].includes(String(s.status || ''))) {
        const uArr = activeSubsByUserId.get(uid) || [];
        uArr.push(s);
        activeSubsByUserId.set(uid, uArr);
        if (s.payment_method_id) {
          const pArr = activeSubsByPmId.get(String(s.payment_method_id)) || [];
          pArr.push(s);
          activeSubsByPmId.set(String(s.payment_method_id), pArr);
        }
      }
    }

    const adminPaymentMethods: any[] = [];
    for (const pm of pmRes.results || []) {
      const masked = maskPaymentMethodForClient(pm);
      if (!masked) continue;
      pmMap.set(masked.id, masked);
      const linkedSubs = activeSubsByPmId.get(masked.id) || [];
      const userAllActive = activeSubsByUserId.get(String(pm.user_id || '')) || [];
      adminPaymentMethods.push({
        ...masked,
        userId: String(pm.user_id || ''),
        userName: String(pm.u_name || linkedSubs[0]?.user_name || userAllActive[0]?.user_name || ''),
        userEmail: String(pm.u_email || pm.auth_email || linkedSubs[0]?.user_email || ''),
        userPhone: String(pm.u_phone || linkedSubs[0]?.user_phone || ''),
        linkedActiveCount: linkedSubs.length,
        userActiveSubsCount: userAllActive.length,
        linkedSubscriptions: linkedSubs.map((ls: any) => ({
          id: ls.id,
          productType: ls.product_type,
          appKey: ls.app_key,
          planName: ls.plan_name,
          status: ls.status,
          renewalMode: ls.renewal_mode,
        })),
      });
    }

    const list = (subsRes.results || []).map((s: any) => ({
      ...s,
      countdown: computeSubscriptionCountdown(s.current_period_end, s.is_infinite, s.grace_until),
      paymentMethod: s.payment_method_id ? pmMap.get(String(s.payment_method_id)) || null : null,
      hasSavedCardOnAccount: (pmRes.results || []).some((pm: any) => String(pm.user_id) === String(s.user_id)),
    }));

    const stats = {
      total: list.length,
      active: list.filter((s: any) => s.status === 'active').length,
      auto: list.filter((s: any) => s.status === 'active' && s.renewal_mode === 'auto' && Number(s.is_infinite) !== 1).length,
      manual: list.filter((s: any) => s.status === 'active' && s.renewal_mode === 'manual' && Number(s.is_infinite) !== 1).length,
      infinite: list.filter((s: any) => Number(s.is_infinite) === 1 && s.status === 'active').length,
      grace: list.filter((s: any) => s.status === 'grace' || s.status === 'past_due').length,
      blocked: list.filter((s: any) => s.status === 'blocked').length,
      savedCards: adminPaymentMethods.length,
    };

    return jsonResponse(
      { success: true, stats, subscriptions: list, paymentMethods: adminPaymentMethods },
      200,
      origin
    );
  }

  // --------------------------------------------------------------------------
  // 20b. GET/POST /api/admin/billing/storage-master-config — Réglages Carte Maîtresse Stockage D1
  // --------------------------------------------------------------------------
  if (path === '/api/admin/billing/storage-master-config' && method === 'GET') {
    const config = await readStorageMasterCardConfig(db);
    return jsonResponse({ success: true, config }, 200, origin);
  }

  if (path === '/api/admin/billing/storage-master-config' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const enabled = body.enabled === false || body.enabled === 0 ? 0 : 1;
    const title = String(body.title || 'Mon Stockage Évolutif').trim().slice(0, 80) || 'Mon Stockage Évolutif';
    const subtitle =
      String(body.subtitle || 'Augmentez votre espace à tout moment selon vos besoins').trim().slice(0, 180) ||
      'Augmentez votre espace à tout moment selon vos besoins';
    const stepValue = Number(body.stepValue ?? body.step_value ?? 100);
    if (!Number.isFinite(stepValue) || stepValue <= 0 || stepValue > 1000000) {
      return errorResponse('Pas d’incrémentation invalide (doit être supérieur à 0).', 400, origin);
    }
    const stepUnit = String(body.stepUnit ?? body.step_unit ?? 'MB').toUpperCase() === 'GB' ? 'GB' : 'MB';
    const pricePerStep = Number(body.pricePerStep ?? body.price_per_step ?? 100);
    if (!Number.isFinite(pricePerStep) || pricePerStep <= 0) {
      return errorResponse('Prix par palier invalide (doit être supérieur à 0).', 400, origin);
    }
    const rawCurr = String(body.primaryCurrency ?? body.primary_currency ?? 'XOF').toUpperCase();
    const primaryCurrency = rawCurr === 'USD' ? 'USD' : rawCurr === 'EUR' ? 'EUR' : 'XOF';
    const durationDays = Math.max(1, Math.min(3650, Math.round(Number(body.durationDays ?? body.duration_days ?? 30) || 30)));
    const maxStorageMb = Math.max(0, Number(body.maxStorageMb ?? body.max_storage_mb ?? 0) || 0);
    const billingMode =
      String(body.billingMode ?? body.billing_mode ?? 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual';
    const prorataEnabled = body.prorataEnabled === false || body.prorataEnabled === 0 || body.prorata_enabled === 0 ? 0 : 1;

    await db
      .prepare(
        `INSERT INTO storage_master_card_config (
           id, enabled, title, subtitle, step_value, step_unit, price_per_step,
           primary_currency, duration_days, max_storage_mb, billing_mode, prorata_enabled, updated_at
         ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           enabled = excluded.enabled,
           title = excluded.title,
           subtitle = excluded.subtitle,
           step_value = excluded.step_value,
           step_unit = excluded.step_unit,
           price_per_step = excluded.price_per_step,
           primary_currency = excluded.primary_currency,
           duration_days = excluded.duration_days,
           max_storage_mb = excluded.max_storage_mb,
           billing_mode = excluded.billing_mode,
           prorata_enabled = excluded.prorata_enabled,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        enabled,
        title,
        subtitle,
        stepValue,
        stepUnit,
        pricePerStep,
        primaryCurrency,
        durationDays,
        maxStorageMb,
        billingMode,
        prorataEnabled
      )
      .run();

    const config = await readStorageMasterCardConfig(db);
    return jsonResponse({ success: true, config }, 200, origin);
  }

  const adminSubDetailsMatch = path.match(/^\/api\/admin\/billing\/subscriptions\/([^/]+)\/details$/);
  if (adminSubDetailsMatch && method === 'GET') {
    const subId = decodeURIComponent(adminSubDetailsMatch[1]);
    const sub: any = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ? LIMIT 1').bind(subId).first();
    if (!sub) return errorResponse('Abonnement introuvable.', 404, origin);

    const [pmRow, eventsRes, emailsRes, userCardsRes, policy] = await Promise.all([
      sub.payment_method_id
        ? db.prepare('SELECT * FROM user_payment_methods WHERE id = ? LIMIT 1').bind(sub.payment_method_id).first().catch(() => null)
        : Promise.resolve(null),
      db.prepare('SELECT * FROM subscription_events WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 80').bind(subId).all().catch(() => ({ results: [] })),
      db.prepare('SELECT * FROM billing_email_logs WHERE subscription_id = ? ORDER BY sent_at DESC LIMIT 50').bind(subId).all().catch(() => ({ results: [] })),
      db.prepare('SELECT * FROM user_payment_methods WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, updated_at DESC').bind(sub.user_id).all().catch(() => ({ results: [] })),
      resolveEffectiveBillingPolicy(db, { productType: sub.product_type, appKey: sub.app_key, subscriptionId: subId }),
    ]);

    return jsonResponse(
      {
        success: true,
        subscription: {
          ...sub,
          countdown: computeSubscriptionCountdown(sub.current_period_end, sub.is_infinite, sub.grace_until),
          paymentMethod: maskPaymentMethodForClient(pmRow),
        },
        userPaymentMethods: (userCardsRes.results || []).map(maskPaymentMethodForClient).filter(Boolean),
        events: eventsRes.results || [],
        emails: emailsRes.results || [],
        effectivePolicy: policy,
      },
      200,
      origin
    );
  }

  const adminSubUpdateMatch = path.match(/^\/api\/admin\/billing\/subscriptions\/([^/]+)\/update$/);
  if (adminSubUpdateMatch && method === 'POST') {
    const subId = decodeURIComponent(adminSubUpdateMatch[1]);
    const sub: any = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ? LIMIT 1').bind(subId).first();
    if (!sub) return errorResponse('Abonnement introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const nextIsInfinite =
      body.is_infinite !== undefined
        ? body.is_infinite ? 1 : 0
        : body.renewal_mode === 'infinite'
        ? 1
        : Number(sub.is_infinite) === 1 && body.renewal_mode && body.renewal_mode !== 'infinite'
        ? 0
        : Number(sub.is_infinite || 0);

    const nextRenewalMode =
      nextIsInfinite === 1
        ? 'infinite'
        : body.renewal_mode === 'auto' || body.renewal_mode === 'manual'
        ? body.renewal_mode
        : sub.renewal_mode === 'infinite'
        ? 'manual'
        : sub.renewal_mode || 'manual';

    const validStatuses = ['active', 'trial', 'past_due', 'grace', 'blocked', 'expired', 'cancelled', 'revoked'];
    const nextStatus =
      body.status && validStatuses.includes(String(body.status))
        ? String(body.status)
        : String(sub.status || 'active');

    const nextBlockScope = body.block_scope ? normalizeBlockScope(body.block_scope) : normalizeBlockScope(sub.block_scope);
    const nextStart = body.current_period_start !== undefined ? (body.current_period_start || sub.current_period_start) : sub.current_period_start;
    const nextEnd =
      nextIsInfinite === 1
        ? null
        : body.current_period_end !== undefined
        ? body.current_period_end || null
        : sub.current_period_end;
    const nextBillingAt =
      nextIsInfinite === 1
        ? null
        : body.next_billing_at !== undefined
        ? body.next_billing_at || nextEnd
        : nextEnd;
    const nextGraceUntil =
      nextIsInfinite === 1
        ? null
        : body.grace_until !== undefined
        ? body.grace_until || null
        : sub.grace_until;
    const nextCancelAtPeriodEnd =
      body.cancel_at_period_end !== undefined
        ? body.cancel_at_period_end ? 1 : 0
        : Number(sub.cancel_at_period_end || 0);
    const nextPrice = body.price_amount !== undefined ? Math.max(0, Number(body.price_amount) || 0) : Number(sub.price_amount || 0);
    const nextNotes =
      body.admin_notes !== undefined
        ? String(body.admin_notes || '')
        : body.notes !== undefined
        ? String(body.notes || '')
        : String(sub.admin_notes || '');
    const nowIso = new Date().toISOString();
    const nextBlockedAt = nextStatus === 'blocked' ? sub.blocked_at || nowIso : null;

    await db
      .prepare(
        `UPDATE active_subscriptions
         SET status = ?,
             is_infinite = ?,
             renewal_mode = ?,
             block_scope = ?,
             blocked_at = ?,
             current_period_start = ?,
             current_period_end = ?,
             next_billing_at = ?,
             grace_until = ?,
             cancel_at_period_end = ?,
             price_amount = ?,
             admin_notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        nextStatus,
        nextIsInfinite,
        nextRenewalMode,
        nextBlockScope,
        nextBlockedAt,
        nextStart,
        nextEnd,
        nextBillingAt,
        nextGraceUntil,
        nextCancelAtPeriodEnd,
        nextPrice,
        nextNotes,
        subId
      )
      .run();

    // Synchroniser user_app_entitlements si abonnement d'application
    if (sub.product_type === 'app' && sub.app_key) {
      const entStatus =
        nextStatus === 'active' || nextStatus === 'trial'
          ? nextStatus
          : nextStatus === 'grace' || nextStatus === 'past_due'
          ? 'grace'
          : nextStatus === 'revoked' || nextStatus === 'cancelled'
          ? 'revoked'
          : 'expired';
      await db
        .prepare(
          `UPDATE user_app_entitlements
           SET status = ?,
               access_type = ?,
               expires_at = ?,
               grace_until = ?,
               auto_renew = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND app_key = ?`
        )
        .bind(
          entStatus,
          nextIsInfinite === 1 ? 'infinite' : nextRenewalMode,
          nextEnd,
          nextGraceUntil,
          nextRenewalMode === 'auto' ? 1 : 0,
          sub.user_id,
          sub.app_key
        )
        .run()
        .catch(() => {});
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: subId,
      userId: String(sub.user_id),
      eventType: 'admin_updated',
      actor: 'admin',
      details: {
        previousStatus: sub.status,
        nextStatus,
        previousMode: sub.renewal_mode,
        nextRenewalMode,
        nextIsInfinite: nextIsInfinite === 1,
        nextEnd,
        nextBlockScope,
      },
    });

    const refreshed: any = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ?').bind(subId).first();

    // Envoi email optionnel demandé par l'admin lors d'un blocage / réactivation
    if (body.notifyByEmail && refreshed) {
      const mailType: BillingEmailType =
        nextStatus === 'blocked'
          ? 'service_blocked'
          : nextStatus === 'active' && sub.status === 'blocked'
          ? 'service_reactivated'
          : 'admin_manual_notice';
      await sendAndLogBillingEmail({
        db,
        rawEnv,
        fetchFn,
        subscription: refreshed,
        emailType: mailType,
        triggeredBy: 'admin',
        customMessage: body.customMessage ? String(body.customMessage) : undefined,
        recordEventFn: recordSubscriptionEvent,
      }).catch(() => {});
    }

    return jsonResponse(
      {
        success: true,
        subscription: refreshed
          ? { ...refreshed, countdown: computeSubscriptionCountdown(refreshed.current_period_end, refreshed.is_infinite, refreshed.grace_until) }
          : null,
      },
      200,
      origin
    );
  }

  if (path === '/api/admin/billing/subscriptions/create' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const userQuery = String(body.user_query || body.user_email || body.user_id || '').trim();
    if (!userQuery) return errorResponse('Email ou ID utilisateur requis.', 400, origin);

    const userRow: any = await db
      .prepare('SELECT id, name, email, phone FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1')
      .bind(userQuery, userQuery)
      .first()
      .catch(() => null);
    if (!userRow) return errorResponse('Utilisateur introuvable dans la base D1.', 404, origin);

    const productType = ['storage', 'ai', 'app'].includes(String(body.product_type)) ? String(body.product_type) : 'app';
    const appKey = productType === 'app' ? sanitizeAppKey(body.app_key || 'moyennes') : '';
    const appName = String(body.app_name || (productType === 'storage' ? 'Stockage Cloud' : productType === 'ai' ? 'Crédits IA' : appKey)).trim();
    const planName = String(body.plan_name || 'Abonnement attribué par admin').trim();
    const isInfinite = body.is_infinite ? 1 : body.renewal_mode === 'infinite' ? 1 : 0;
    const renewalMode = isInfinite === 1 ? 'infinite' : body.renewal_mode === 'auto' ? 'auto' : 'manual';
    const durationDays = isInfinite === 1 ? 0 : Math.max(1, parseInt(String(body.duration_days || '30'), 10) || 30);
    const nowIso = new Date().toISOString();
    const startIso = body.current_period_start ? String(body.current_period_start) : nowIso;
    const endIso =
      isInfinite === 1
        ? null
        : body.current_period_end
        ? String(body.current_period_end)
        : new Date(Date.parse(startIso) + durationDays * 86400 * 1000).toISOString();
    const policy = await resolveEffectiveBillingPolicy(db, { productType, appKey });
    const graceUntil = endIso ? new Date(Date.parse(endIso) + policy.gracePeriodDays * 86400 * 1000).toISOString() : null;
    const subId = `asub_adm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await db
      .prepare(
        `INSERT INTO active_subscriptions (
           id, user_id, user_name, user_email, user_phone,
           product_type, app_key, app_name, plan_id, plan_name,
           status, is_infinite, plan_allows_auto, plan_allows_manual,
           renewal_mode, user_confirmed_renewal, last_channel, last_network_label,
           price_amount, currency, billing_cycle, duration_days,
           started_at, current_period_start, current_period_end,
           next_billing_at, grace_until, block_scope, admin_notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 1, 'admin', 'Attribution Admin', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        subId,
        String(userRow.id),
        String(userRow.name || ''),
        String(userRow.email || ''),
        String(userRow.phone || ''),
        productType,
        appKey,
        appName,
        String(body.plan_id || 'admin_grant'),
        planName,
        isInfinite,
        renewalMode === 'auto' ? 1 : 0,
        isInfinite === 1 ? 0 : 1,
        renewalMode,
        Math.max(0, Number(body.price_amount) || 0),
        String(body.currency || 'XOF').toUpperCase(),
        isInfinite === 1 ? 'infinite' : 'manual',
        durationDays,
        startIso,
        startIso,
        endIso,
        endIso,
        graceUntil,
        normalizeBlockScope(body.block_scope || policy.blockScope),
        String(body.notes || 'Créé manuellement par l’administrateur')
      )
      .run();

    if (productType === 'app' && appKey) {
      await db
        .prepare(
          `INSERT INTO user_app_entitlements (id, user_id, app_key, plan_id, plan_name, status, access_type, starts_at, expires_at, grace_until, auto_renew)
           VALUES (?, ?, ?, 'admin_grant', ?, 'active', ?, ?, ?, ?, 0)
           ON CONFLICT(user_id, app_key) DO UPDATE SET
             plan_name = excluded.plan_name,
             status = 'active',
             access_type = excluded.access_type,
             expires_at = excluded.expires_at,
             grace_until = excluded.grace_until,
             updated_at = CURRENT_TIMESTAMP`
        )
        .bind(`ent_adm_${Date.now()}`, String(userRow.id), appKey, planName, isInfinite === 1 ? 'infinite' : 'manual', startIso, endIso, graceUntil)
        .run()
        .catch(() => {});
    }

    await recordSubscriptionEvent(db, {
      subscriptionId: subId,
      userId: String(userRow.id),
      eventType: 'admin_created',
      actor: 'admin',
      details: { productType, appKey, planName, isInfinite: isInfinite === 1, endIso },
    });

    const created: any = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ?').bind(subId).first();
    if (body.sendEmail && created) {
      await sendAndLogBillingEmail({
        db,
        rawEnv,
        fetchFn,
        subscription: created,
        emailType: isInfinite === 1 ? 'infinite_confirmed' : 'purchase_confirmed',
        triggeredBy: 'admin',
        recordEventFn: recordSubscriptionEvent,
      }).catch(() => {});
    }

    return jsonResponse({ success: true, subscription: created }, 200, origin);
  }

  const adminSendEmailMatch = path.match(/^\/api\/admin\/billing\/subscriptions\/([^/]+)\/send-email$/);
  if (adminSendEmailMatch && method === 'POST') {
    const subId = decodeURIComponent(adminSendEmailMatch[1]);
    const sub: any = await db.prepare('SELECT * FROM active_subscriptions WHERE id = ? LIMIT 1').bind(subId).first();
    if (!sub) return errorResponse('Abonnement introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const allowedTypes: BillingEmailType[] = [
      'purchase_confirmed',
      'infinite_confirmed',
      'pre_renewal_notice',
      'payment_failed',
      'overdue_reminder',
      'service_blocked',
      'service_reactivated',
      'admin_manual_notice',
    ];
    const emailType: BillingEmailType = allowedTypes.includes(body.emailType)
      ? body.emailType
      : 'overdue_reminder';
    const customMessage = body.customMessage ? String(body.customMessage).trim() : undefined;

    const graceEndMs = sub.grace_until ? Date.parse(String(sub.grace_until)) : NaN;
    const graceDaysRemaining = Number.isFinite(graceEndMs)
      ? Math.max(0, Math.ceil((graceEndMs - Date.now()) / (24 * 3600 * 1000)))
      : null;

    const sendRes = await sendAndLogBillingEmail({
      db,
      rawEnv,
      fetchFn,
      subscription: sub,
      emailType,
      triggeredBy: 'admin',
      customMessage,
      graceDaysRemaining,
      recordEventFn: recordSubscriptionEvent,
    });

    return jsonResponse({ ...sendRes }, sendRes.success ? 200 : 200, origin);
  }

  if (path === '/api/admin/billing/policies' && method === 'GET') {
    const rulesRes = await db
      .prepare('SELECT * FROM billing_policy_rules ORDER BY scope_type ASC, scope_key ASC')
      .all()
      .catch(() => ({ results: [] }));
    return jsonResponse({ success: true, policies: rulesRes.results || [] }, 200, origin);
  }

  if (path === '/api/admin/billing/policies/save' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const validScopes = ['global', 'product_type', 'app', 'subscription'];
    const scopeType = validScopes.includes(String(body.scope_type)) ? String(body.scope_type) : 'global';
    const scopeKey = String(body.scope_key || 'default').trim();
    if (!scopeKey) return errorResponse('scope_key requis.', 400, origin);

    const ruleId = String(body.id || `bpol_${scopeType}_${scopeKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
    const label = String(body.label || `${scopeType}:${scopeKey}`).trim();
    const autoNoticeDays = Math.max(
      0,
      Math.min(30, parseInt(String(body.auto_notice_days ?? body.pre_renewal_days ?? 3), 10) || 0)
    );
    const preExpiryDaysJson =
      typeof body.pre_expiry_days_json === 'string' && body.pre_expiry_days_json.trim().startsWith('[')
        ? body.pre_expiry_days_json.trim()
        : JSON.stringify([autoNoticeDays > 0 ? autoNoticeDays : 3, 1]);
    const gracePeriodDays = Math.max(0, Math.min(90, parseInt(String(body.grace_period_days ?? 5), 10) || 0));
    const overdueIntervalHours = Math.max(1, Math.min(720, parseInt(String(body.overdue_interval_hours ?? 48), 10) || 48));
    const overdueMaxReminders = Math.max(
      0,
      Math.min(30, parseInt(String(body.overdue_max_reminders ?? body.max_overdue_reminders ?? 5), 10) || 0)
    );
    const rawRetry = body.retry_intervals_hours_json ?? body.retry_schedule_hours ?? '[24,72]';
    const retryArr = Array.isArray(rawRetry)
      ? rawRetry.map((x: any) => Math.max(1, parseInt(String(x), 10) || 24))
      : String(rawRetry).trim().startsWith('[')
      ? parseIntArrayJson(rawRetry, [24, 72])
      : String(rawRetry)
          .split(',')
          .map((s) => Math.max(1, parseInt(s.trim(), 10) || 0))
          .filter((n) => n > 0);
    const retryIntervalsJson = JSON.stringify(retryArr.length > 0 ? retryArr : [24, 72]);
    const blockScope = normalizeBlockScope(body.block_scope || 'service_only');
    const emailOnPurchase =
      body.email_on_purchase === false || Number(body.email_on_purchase) === 0 || body.send_purchase_email === false ? 0 : 1;
    const emailOnFail =
      body.email_on_fail === false || Number(body.email_on_fail) === 0 || body.send_failure_email === false ? 0 : 1;
    const emailOnBlock =
      body.email_on_block === false || Number(body.email_on_block) === 0 || body.send_block_email === false ? 0 : 1;
    const isActive = body.is_active === false || Number(body.is_active) === 0 ? 0 : 1;

    await db
      .prepare(
        `INSERT INTO billing_policy_rules (
           id, scope_type, scope_key, label, pre_expiry_days_json, auto_notice_days,
           overdue_interval_hours, overdue_max_reminders, grace_period_days,
           block_scope, retry_intervals_hours_json, email_on_purchase,
           email_on_fail, email_on_block, is_active, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(scope_type, scope_key) DO UPDATE SET
           label = excluded.label,
           pre_expiry_days_json = excluded.pre_expiry_days_json,
           auto_notice_days = excluded.auto_notice_days,
           overdue_interval_hours = excluded.overdue_interval_hours,
           overdue_max_reminders = excluded.overdue_max_reminders,
           grace_period_days = excluded.grace_period_days,
           block_scope = excluded.block_scope,
           retry_intervals_hours_json = excluded.retry_intervals_hours_json,
           email_on_purchase = excluded.email_on_purchase,
           email_on_fail = excluded.email_on_fail,
           email_on_block = excluded.email_on_block,
           is_active = excluded.is_active,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        ruleId,
        scopeType,
        scopeKey,
        label,
        preExpiryDaysJson,
        autoNoticeDays,
        overdueIntervalHours,
        overdueMaxReminders,
        gracePeriodDays,
        blockScope,
        retryIntervalsJson,
        emailOnPurchase,
        emailOnFail,
        emailOnBlock,
        isActive
      )
      .run();

    const saved = await db
      .prepare('SELECT * FROM billing_policy_rules WHERE scope_type = ? AND scope_key = ? LIMIT 1')
      .bind(scopeType, scopeKey)
      .first();
    return jsonResponse({ success: true, policy: saved }, 200, origin);
  }

  if (path === '/api/admin/billing/email-logs' && method === 'GET') {
    const subFilter = url.searchParams.get('subscription_id') || '';
    const logsRes = subFilter
      ? await db
          .prepare('SELECT * FROM billing_email_logs WHERE subscription_id = ? ORDER BY sent_at DESC LIMIT 100')
          .bind(subFilter)
          .all()
          .catch(() => ({ results: [] }))
      : await db
          .prepare('SELECT * FROM billing_email_logs ORDER BY sent_at DESC LIMIT 200')
          .all()
          .catch(() => ({ results: [] }));
    return jsonResponse({ success: true, emails: logsRes.results || [] }, 200, origin);
  }

  if (path === '/api/admin/billing/cron/run' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const summary = await executeBillingCronJob(db, rawEnv, {
      fetchFn,
      nowIso: body?.nowIso ? String(body.nowIso) : undefined,
    });
    return jsonResponse({ success: true, summary }, 200, origin);
  }

  return null;
}

/**
 * Recharge automatiquement le forfait de Crédits IA lorsque le solde atteint 0,
 * si l'utilisateur a explicitement coché `auto_ai = 1` et `auto_ai_on_depleted = 1`
 * sur sa carte enregistrée.
 * Garde-fou anti-boucle strict : 1 seule recharge automatique maximum par 24 heures.
 */
export async function tryAutoRechargeDepletedAiCredits(
  db: any,
  rawEnv: Record<string, any>,
  userId: string,
  opts?: { fetchFn?: typeof fetch; nowIso?: string }
): Promise<{ triggered: boolean; recharged?: boolean; reason?: string; reference?: string }> {
  if (!db || !userId) return { triggered: false, reason: 'invalid_args' };
  await ensurePaystackBillingTables(db);

  const creditRow: any = await db
    .prepare('SELECT credits_balance FROM user_ai_credits WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first()
    .catch(() => null);
  if (!creditRow || Number(creditRow.credits_balance || 0) > 0) {
    return { triggered: false, reason: 'balance_positive' };
  }

  // Chercher une carte active autorisant la recharge auto IA quand solde = 0
  const pm: any = await db
    .prepare(
      `SELECT * FROM user_payment_methods
       WHERE user_id = ? AND is_active = 1 AND reusable = 1
         AND COALESCE(auto_ai, 0) = 1 AND COALESCE(auto_ai_on_depleted, 0) = 1
       ORDER BY is_default DESC, updated_at DESC LIMIT 1`
    )
    .bind(userId)
    .first()
    .catch(() => null);
  if (!pm || !pm.authorization_code) {
    return { triggered: false, reason: 'no_authorized_card' };
  }

  // Chercher l'abonnement / pack IA non-infini de référence pour connaître le montant & plan
  const aiSub: any = await db
    .prepare(
      `SELECT * FROM active_subscriptions
       WHERE user_id = ?
         AND product_type = 'ai'
         AND status IN ('active', 'grace', 'past_due')
         AND COALESCE(is_infinite, 0) = 0
         AND COALESCE(cancel_at_period_end, 0) = 0
       ORDER BY updated_at DESC LIMIT 1`
    )
    .bind(userId)
    .first()
    .catch(() => null);
  if (!aiSub || Number(aiSub.price_amount || 0) <= 0) {
    return { triggered: false, reason: 'no_eligible_ai_subscription' };
  }

  const secretKey = getPaystackSecretKey(rawEnv);
  if (!secretKey) return { triggered: false, reason: 'paystack_unconfigured' };

  const nowMs = opts?.nowIso ? Date.parse(opts.nowIso) : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const dayKey = nowIso.slice(0, 10).replace(/-/g, '');
  const cleanUid = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'USR';
  const rechargeRef = `SC-AIRECH-${cleanUid}-${dayKey}`;

  // GARDE-FOU ANTI-BOUCLE STRICT : max 1 recharge auto IA / 24h (et clé unique par jour)
  const recentAutoRecharges = await db
    .prepare(
      `SELECT id, reference, status, fulfilled_at, created_at
       FROM payment_transactions
       WHERE user_id = ? AND reference LIKE 'SC-AIRECH-%'
       ORDER BY created_at DESC LIMIT 5`
    )
    .bind(userId)
    .all()
    .catch(() => ({ results: [] }));

  for (const prev of recentAutoRecharges.results || []) {
    if (String(prev.reference) === rechargeRef) {
      return { triggered: false, reason: 'cooldown_24h_same_day', reference: rechargeRef };
    }
    const tsRaw = String(prev.fulfilled_at || prev.created_at || '');
    const parsedMs = Date.parse(tsRaw.includes('T') ? tsRaw : tsRaw.replace(' ', 'T') + 'Z');
    if (Number.isFinite(parsedMs) && nowMs - parsedMs < 24 * 60 * 60 * 1000) {
      return { triggered: false, reason: 'cooldown_24h', reference: String(prev.reference) };
    }
  }

  const amountMajor = Number(aiSub.price_amount || 0);
  const currency = String(aiSub.currency || 'XOF').toUpperCase();
  const amountMinor = Math.round(amountMajor * 100);
  const email = String(pm.auth_email || aiSub.user_email || '').trim();
  if (!email) return { triggered: false, reason: 'missing_email' };

  const txId = `tx_airech_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db
    .prepare(
      `INSERT INTO payment_transactions (
         id, reference, user_id, user_name, user_email, user_phone,
         product_type, product_id, product_name, app_key, app_name,
         billing_mode, billing_cycle, duration_days,
         expected_amount, expected_amount_minor, currency,
         provider, channel, status, subscription_id
       ) VALUES (?, ?, ?, ?, ?, ?, 'ai', ?, ?, 'ai', 'Crédits IA StudyCloud', 'auto', ?, ?, ?, ?, ?, 'paystack', 'card', 'pending', ?)`
    )
    .bind(
      txId,
      rechargeRef,
      userId,
      String(aiSub.user_name || ''),
      email,
      String(aiSub.user_phone || ''),
      String(aiSub.plan_id || ''),
      String(aiSub.plan_name || 'Recharge Auto Crédits IA'),
      String(aiSub.billing_cycle || 'monthly'),
      Math.max(1, Number(aiSub.duration_days || 30)),
      amountMajor,
      amountMinor,
      currency,
      String(aiSub.id)
    )
    .run();

  const fetchFn = opts?.fetchFn || fetch;
  let psOk = false;
  let psJson: any = {};
  let failReason = '';
  try {
    const resp = await fetchFn(`${PAYSTACK_API_BASE}/transaction/charge_authorization`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: pm.authorization_code,
        email,
        amount: amountMinor,
        currency,
        reference: rechargeRef,
        metadata: {
          user_id: userId,
          subscription_id: aiSub.id,
          product_type: 'ai',
          product_id: aiSub.plan_id,
          auto_ai_depleted_recharge: true,
        },
      }),
    });
    psJson = await resp.json().catch(() => ({}));
    psOk = Boolean(resp.ok && psJson?.status && psJson?.data?.status === 'success');
    if (!psOk) {
      failReason = String(psJson?.data?.gateway_response || psJson?.message || `HTTP ${resp.status}`);
    }
  } catch (err: any) {
    failReason = String(err?.message || 'Erreur réseau Paystack');
  }

  if (psOk) {
    const pendingTxRow = await db
      .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
      .bind(rechargeRef)
      .first();
    await fulfillPaidTransaction(db, pendingTxRow, psJson.data, { rawEnv, fetchFn });
    await recordSubscriptionEvent(db, {
      subscriptionId: String(aiSub.id),
      userId,
      eventType: 'ai_auto_recharged',
      actor: 'system',
      details: {
        reference: rechargeRef,
        amount: amountMajor,
        currency,
        cardLast4: pm.last4 || '',
        trigger: 'credits_depleted',
      },
    });
    return { triggered: true, recharged: true, reference: rechargeRef };
  }

  await db
    .prepare("UPDATE payment_transactions SET status = 'failed', raw_verify_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?")
    .bind(JSON.stringify(psJson || { error: failReason }).slice(0, 8000), rechargeRef)
    .run()
    .catch(() => {});

  await recordSubscriptionEvent(db, {
    subscriptionId: String(aiSub.id),
    userId,
    eventType: 'ai_auto_recharge_failed',
    actor: 'system',
    details: { reference: rechargeRef, reason: failReason },
  });

  const policy = await resolveEffectiveBillingPolicy(db, {
    productType: 'ai',
    appKey: 'ai',
    subscriptionId: String(aiSub.id),
  });
  if (policy.emailOnFail) {
    await sendAndLogBillingEmail({
      db,
      rawEnv,
      fetchFn,
      subscription: { ...aiSub, last_charge_error: failReason },
      emailType: 'payment_failed',
      triggeredBy: 'auto',
      reference: rechargeRef,
      nowIso,
      recordEventFn: recordSubscriptionEvent,
    }).catch(() => {});
  }

  return { triggered: true, recharged: false, reason: failReason, reference: rechargeRef };
}

/**
 * Exécute le cycle horaire complet de facturation / relance / blocage (Étape 7).
 * Appelé automatiquement par `scheduled()` dans `worker/src/index.ts` et manuellement par l'admin.
 */
export async function executeBillingCronJob(
  db: any,
  rawEnv: Record<string, any>,
  opts?: { fetchFn?: typeof fetch; nowIso?: string }
): Promise<BillingCronSummary> {
  await ensurePaystackBillingTables(db);
  return runBillingCronCycle({
    db,
    rawEnv,
    fetchFn: opts?.fetchFn,
    nowIso: opts?.nowIso,
    getPaystackSecretKey,
    resolveEffectiveBillingPolicy,
    recordSubscriptionEvent,
    fulfillAutoRenewalTransaction: (d, txRow, psData) =>
      fulfillPaidTransaction(d, txRow, psData, { rawEnv, fetchFn: opts?.fetchFn }),
    isCardAuthorizedForSubscription,
    tryAutoRechargeDepletedAiCredits,
  });
}
