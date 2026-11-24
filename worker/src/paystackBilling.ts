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

export type BillingMode = 'auto' | 'manual' | 'infinite';
export type PaymentProductType = 'storage' | 'ai' | 'app';

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
  billingCycle: 'monthly' | 'annual' | 'one_time' | 'custom' | 'infinite',
  targetCurrency = 'XOF'
): { amountMajor: number; currency: string; durationDays: number } {
  const billingMode = normalizeBillingMode(
    plan?.billing_mode,
    plan?.is_auto_billing,
    plan?.pricing_model
  );
  const baseDuration = normalizeDurationDays(plan?.duration_days, billingMode);
  const isAnnual = billingCycle === 'annual' && billingMode !== 'infinite';
  const primaryCurr = String(plan?.primary_currency || 'XOF').toUpperCase();
  const basePrice = Number(plan?.price) || 0;
  const discountPct = Number(plan?.yearly_discount_pct) || 0;
  const explicitYearly = Number(plan?.yearly_price) || 0;

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
  let monthlyInWanted: number;

  if (primaryCurr === wantedCurr) {
    monthlyInWanted = basePrice;
  } else if (Number(convObj[wantedCurr]) > 0) {
    monthlyInWanted = Number(convObj[wantedCurr]);
  } else if (wantedCurr === 'XOF') {
    if (primaryCurr === 'USD') monthlyInWanted = Math.round(basePrice * 650);
    else if (primaryCurr === 'EUR') monthlyInWanted = Math.round(basePrice * 655.957);
    else monthlyInWanted = Math.round(basePrice);
  } else if (wantedCurr === 'USD') {
    if (primaryCurr === 'XOF') monthlyInWanted = Math.round((basePrice / 650) * 100) / 100;
    else if (primaryCurr === 'EUR') monthlyInWanted = Math.round((basePrice / 0.92) * 100) / 100;
    else monthlyInWanted = basePrice;
  } else {
    monthlyInWanted = basePrice;
  }

  let finalAmount = monthlyInWanted;
  let durationDays = baseDuration;

  if (isAnnual) {
    if (primaryCurr === wantedCurr && explicitYearly > 0) {
      finalAmount = explicitYearly;
    } else if (basePrice > 0 && explicitYearly > 0) {
      const ratio = explicitYearly / basePrice;
      finalAmount = wantedCurr === 'XOF'
        ? Math.round(monthlyInWanted * ratio)
        : Math.round(monthlyInWanted * ratio * 100) / 100;
    } else {
      const factor = 12 * (1 - Math.max(0, Math.min(90, discountPct)) / 100);
      finalAmount = wantedCurr === 'XOF'
        ? Math.round(monthlyInWanted * factor)
        : Math.round(monthlyInWanted * factor * 100) / 100;
    }
    durationDays = 365;
  }

  if (wantedCurr === 'XOF') {
    finalAmount = Math.round(finalAmount);
  }

  return {
    amountMajor: Math.max(0, finalAmount),
    currency: wantedCurr,
    durationDays: billingMode === 'infinite' ? 0 : durationDays,
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
      yearly_price REAL DEFAULT 0,
      yearly_discount_pct REAL DEFAULT 10,
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
      yearly_price REAL DEFAULT 0,
      yearly_discount_pct REAL DEFAULT 0,
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
    "ALTER TABLE ai_subscription_plans ADD COLUMN billing_mode TEXT DEFAULT 'manual'",
    'ALTER TABLE ai_subscription_plans ADD COLUMN duration_days INTEGER DEFAULT 30',
    "ALTER TABLE ai_subscription_plans ADD COLUMN paystack_plan_code TEXT DEFAULT ''",
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
      yearly_price REAL DEFAULT 0,
      yearly_discount_pct REAL DEFAULT 0,
      billing_mode TEXT DEFAULT 'manual',
      duration_days INTEGER DEFAULT 30,
      is_auto_billing INTEGER DEFAULT 0,
      paystack_plan_code TEXT DEFAULT '',
      features TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_app_plans_key ON app_subscription_plans(app_key, is_active, sort_order)'
  ).run().catch(() => {});

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

  ensuredDbSet.add(db);
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
// LIVRAISON ATOMIQUE ANTI-DOUBLE CRÉDIT (STORAGE / AI / APPS)
// ============================================================================

async function fulfillPaidTransaction(
  db: any,
  txRow: any,
  paystackData: any
): Promise<{ alreadyFulfilled: boolean; transaction: any; deliverySummary: string }> {
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
    return {
      alreadyFulfilled: true,
      transaction: existing || txRow,
      deliverySummary: 'Transaction déjà validée et livrée.',
    };
  }

  const userId = String(txRow.user_id);
  const billingMode = normalizeBillingMode(txRow.billing_mode);
  const durationDays = normalizeDurationDays(txRow.duration_days, billingMode);
  let deliverySummary = 'Paiement confirmé.';
  let grantedStorageMb = 0;
  let grantedAiCredits = 0;
  let entitlementExpiresAt: string | null = null;

  if (txRow.product_type === 'storage') {
    const plan: any = await db
      .prepare('SELECT * FROM storage_subscription_plans WHERE id = ? LIMIT 1')
      .bind(txRow.product_id)
      .first()
      .catch(() => null);
    grantedStorageMb = Math.max(0, Number(plan?.storage_mb || txRow.granted_storage_mb || 0));

    const currentQuota: any = await db
      .prepare('SELECT * FROM user_storage_quotas WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first()
      .catch(() => null);
    const currentPaid = currentQuota ? Number(currentQuota.paid_total_mb || 0) : 0;
    const wTotal = currentQuota ? Number(currentQuota.welcome_total_mb || 100) : 100;
    const newPaid = currentPaid + grantedStorageMb;
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
        txRow.product_name || 'Stockage Payant'
      )
      .run()
      .catch(() => {});

    entitlementExpiresAt = computeEntitlementExpiration(billingMode, durationDays, null);

    // Enregistrer l'abonnement actif dans user_subscriptions + historique d'achat
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
        txRow.product_name || 'Pack Stockage',
        newTotal,
        paidMajor,
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
        txRow.product_name || 'Pack Stockage',
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

    const goLabel =
      grantedStorageMb >= 1024
        ? `${(grantedStorageMb / 1024).toFixed(grantedStorageMb % 1024 === 0 ? 0 : 1)} Go`
        : `${grantedStorageMb} Mo`;
    deliverySummary = `+${goLabel} ajoutés à votre stockage Cloud.`;
  } else if (txRow.product_type === 'ai') {
    const plan: any = await db
      .prepare('SELECT * FROM ai_subscription_plans WHERE id = ? LIMIT 1')
      .bind(txRow.product_id)
      .first()
      .catch(() => null);
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
    const appRow: any = await db
      .prepare('SELECT * FROM monetized_apps WHERE app_key = ? LIMIT 1')
      .bind(appKey)
      .first()
      .catch(() => null);
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

  // Mettre à jour les champs de livraison dans payment_transactions
  await db
    .prepare(
      `UPDATE payment_transactions
       SET granted_storage_mb = ?,
           granted_ai_credits = ?,
           entitlement_expires_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE reference = ?`
    )
    .bind(grantedStorageMb, grantedAiCredits, entitlementExpiresAt, txRow.reference)
    .run()
    .catch(() => {});

  const refreshed = await db
    .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
    .bind(txRow.reference)
    .first();

  return {
    alreadyFulfilled: false,
    transaction: refreshed || txRow,
    deliverySummary,
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
        ...access,
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

    if (productType === 'storage') {
      planTable = 'storage_subscription_plans';
      planRow = await db
        .prepare('SELECT * FROM storage_subscription_plans WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1')
        .bind(productId)
        .first();
      appKey = 'storage';
      appName = 'Stockage Cloud';
      grantedStorageMb = Math.max(0, Number(planRow?.storage_mb || 0));
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

    const billingMode = normalizeBillingMode(
      planRow.billing_mode,
      planRow.is_auto_billing,
      planRow.pricing_model
    );
    const { amountMajor, currency, durationDays } = resolvePlanPriceMajor(
      planRow,
      billingMode === 'infinite' ? 'infinite' : billingCycle,
      requestedCurrency
    );
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
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paystack', 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
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
        grantedAiCredits
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
      return jsonResponse(
        {
          success: true,
          verified: true,
          alreadyFulfilled: true,
          transaction: txRow,
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

    const fulfillment = await fulfillPaidTransaction(db, txRow, psJson.data);
    return jsonResponse(
      {
        success: true,
        verified: true,
        alreadyFulfilled: fulfillment.alreadyFulfilled,
        deliverySummary: fulfillment.deliverySummary,
        transaction: fulfillment.transaction,
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
          const res = await fulfillPaidTransaction(db, txRow, data);
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

    const fulfillment = await fulfillPaidTransaction(db, txRow, psJson.data);
    return jsonResponse(
      {
        success: true,
        verified: true,
        alreadyFulfilled: fulfillment.alreadyFulfilled,
        deliverySummary: fulfillment.deliverySummary,
        transaction: fulfillment.transaction,
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

    if (productType === 'storage') {
      planRow = await db
        .prepare('SELECT * FROM storage_subscription_plans WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1')
        .bind(productId)
        .first();
      appKey = 'storage';
      appName = 'Stockage Cloud';
      grantedStorageMb = Math.max(0, Number(planRow?.storage_mb || 0));
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

    const billingMode = normalizeBillingMode(
      planRow.billing_mode,
      planRow.is_auto_billing,
      planRow.pricing_model
    );
    const { amountMajor, currency, durationDays } = resolvePlanPriceMajor(
      planRow,
      billingMode === 'infinite' ? 'infinite' : billingCycle,
      'XOF'
    );
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
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paystack', 'mobile_money', ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
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
        grantedAiCredits
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
      const errMsg = String(
        psJson?.data?.message ||
          psJson?.message ||
          `Paystack a refusé l'initialisation ${networkLabel}.`
      );
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, raw_verify_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(errMsg, JSON.stringify(psJson || {}).slice(0, 16000), reference)
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
        const fulfillment = await fulfillPaidTransaction(db, txRow, data);
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
          },
          200,
          origin
        );
      }
    }

    if (chargeStatus === 'failed') {
      const reason = displayText || 'Paiement refusé par votre opérateur Mobile Money.';
      await db
        .prepare(
          "UPDATE payment_transactions SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?"
        )
        .bind(reason, reference)
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
      const fulfillment = await fulfillPaidTransaction(db, txRow, data);
      return jsonResponse(
        {
          success: true,
          chargeStatus: 'success',
          verified: true,
          alreadyFulfilled: fulfillment.alreadyFulfilled,
          deliverySummary: fulfillment.deliverySummary,
          transaction: fulfillment.transaction,
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

  return null;
}
