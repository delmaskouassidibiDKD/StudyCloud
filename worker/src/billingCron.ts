/**
 * StudyCloud — Étape 7 : Moteur Cron Cloudflare (`scheduled`)
 *
 * Exécuté toutes les heures (ou manuellement par l'admin) :
 * 1. Pré-alertes avant échéance (`pre_renewal_notice`) selon `policy.preRenewalDays`.
 * 2. Prélèvements automatiques Visa/Mastercard (`POST /transaction/charge_authorization`)
 *    strictement idempotents (anti-double facturation par période + retry).
 * 3. Gestion des échecs de paiement : passage en période de grâce + planification des relances
 *    (`retry_schedule_hours`, ex. +24h, +72h, +120h) + envoi email `payment_failed`.
 * 4. Transition automatique des abonnements manuels expirés -> période de grâce (ou annulés si cancel_at_period_end).
 * 5. Envoi des relances d'impayé (`overdue_reminder`) respectant STRICTEMENT l'intervalle réglé par l'admin
 *    (`overdue_interval_hours`) et le plafond (`max_overdue_reminders`).
 * 6. Blocage automatique après expiration de la période de grâce selon `block_scope`
 *    (`service_only` | `read_only` | `full_account`) + envoi email `service_blocked`.
 */

import { sendAndLogBillingEmail } from './billingEmailAndPolicy';

export interface BillingCronSummary {
  ranAt: string;
  preRenewalSent: number;
  autoCharged: number;
  autoFailed: number;
  aiAutoRecharged: number;
  movedToGrace: number;
  cancelledAtPeriodEnd: number;
  remindersSent: number;
  blocked: number;
  errors: string[];
}

export interface BillingCronDependencies {
  db: any;
  rawEnv: Record<string, any>;
  fetchFn?: typeof fetch;
  nowIso?: string;
  getPaystackSecretKey: (rawEnv: Record<string, any>) => string;
  resolveEffectiveBillingPolicy: (
    db: any,
    scope: { productType?: string; appKey?: string; subscriptionId?: string }
  ) => Promise<{
    autoNoticeDays: number;
    preExpiryDays: number[];
    gracePeriodDays: number;
    overdueIntervalHours: number;
    overdueMaxReminders: number;
    retryIntervalsHours: number[];
    blockScope: 'service_only' | 'read_only' | 'full_account';
    emailOnPurchase: boolean;
    emailOnFail: boolean;
    emailOnBlock: boolean;
  }>;
  recordSubscriptionEvent: (
    db: any,
    args: { subscriptionId: string; userId: string; eventType: string; actor: string; details?: Record<string, any> }
  ) => Promise<void>;
  fulfillAutoRenewalTransaction: (db: any, txRow: any, paystackData: any) => Promise<any>;
  isCardAuthorizedForSubscription?: (pmRow: any, sub: any) => boolean;
  tryAutoRechargeDepletedAiCredits?: (
    db: any,
    rawEnv: Record<string, any>,
    userId: string,
    opts?: { fetchFn?: typeof fetch; nowIso?: string }
  ) => Promise<{ triggered: boolean; recharged?: boolean; reason?: string; reference?: string }>;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function toPaystackMinor(amountMajor: number, currency: string): number {
  const safe = Math.max(0, Number(amountMajor || 0));
  const cur = String(currency || 'XOF').toUpperCase();
  // Sur Paystack, XOF, USD, EUR sont exprimés en centimes (× 100)
  return Math.round(safe * 100);
}

export async function runBillingCronCycle(deps: BillingCronDependencies): Promise<BillingCronSummary> {
  const {
    db,
    rawEnv,
    getPaystackSecretKey,
    resolveEffectiveBillingPolicy,
    recordSubscriptionEvent,
    fulfillAutoRenewalTransaction,
    isCardAuthorizedForSubscription,
    tryAutoRechargeDepletedAiCredits,
  } = deps;
  const fetchFn = deps.fetchFn || fetch;
  const nowMs = deps.nowIso ? Date.parse(deps.nowIso) : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const summary: BillingCronSummary = {
    ranAt: nowIso,
    preRenewalSent: 0,
    autoCharged: 0,
    autoFailed: 0,
    aiAutoRecharged: 0,
    movedToGrace: 0,
    cancelledAtPeriodEnd: 0,
    remindersSent: 0,
    blocked: 0,
    errors: [],
  };

  if (!db) {
    summary.errors.push('Base D1 indisponible');
    return summary;
  }

  const secretKey = getPaystackSecretKey(rawEnv);

  // ==========================================================================
  // PHASE 1 : PRÉ-ALERTES AVANT ÉCHÉANCE (`pre_renewal_notice`)
  // ==========================================================================
  try {
    const activeSubs = await db
      .prepare(
        `SELECT * FROM active_subscriptions
         WHERE status = 'active'
           AND COALESCE(is_infinite, 0) = 0
           AND current_period_end IS NOT NULL
         LIMIT 200`
      )
      .all()
      .catch(() => ({ results: [] }));

    for (const sub of activeSubs.results || []) {
      const endMs = Date.parse(String(sub.current_period_end || ''));
      if (!Number.isFinite(endMs) || endMs <= nowMs) continue;

      const policy = await resolveEffectiveBillingPolicy(db, {
        productType: sub.product_type,
        appKey: sub.app_key,
        subscriptionId: sub.id,
      });

      const preWindowDays = Math.max(policy.autoNoticeDays || 0, ...(policy.preExpiryDays || [0]));
      if (preWindowDays <= 0) continue;
      const hoursUntilEnd = (endMs - nowMs) / HOUR_MS;
      if (hoursUntilEnd > preWindowDays * 24) continue;

      // Idempotence : vérifier si une pré-alerte a déjà été envoyée pour cette période
      const alreadySent = await db
        .prepare(
          `SELECT id FROM billing_email_logs
           WHERE subscription_id = ?
             AND email_type = 'pre_renewal_notice'
             AND delivery_status != 'failed'
             AND sent_at >= ?
           LIMIT 1`
        )
        .bind(sub.id, new Date(nowMs - Math.max(2, preWindowDays + 2) * DAY_MS).toISOString())
        .first()
        .catch(() => null);

      if (alreadySent) continue;

      const mailRes = await sendAndLogBillingEmail({
        db,
        rawEnv,
        fetchFn,
        subscription: sub,
        emailType: 'pre_renewal_notice',
        triggeredBy: 'cron',
        nowIso,
        recordEventFn: recordSubscriptionEvent,
      });
      if (mailRes.success) summary.preRenewalSent++;
    }
  } catch (err: any) {
    summary.errors.push(`Phase 1 (pre-renewal): ${err?.message || err}`);
  }

  // ==========================================================================
  // PHASE 2 : PRÉLÈVEMENTS AUTOMATIQUES (`charge_authorization`) + RETRIES
  // ==========================================================================
  try {
    const dueAutoSubs = await db
      .prepare(
        `SELECT * FROM active_subscriptions
         WHERE status IN ('active', 'past_due', 'grace')
           AND COALESCE(is_infinite, 0) = 0
           AND renewal_mode = 'auto'
           AND COALESCE(cancel_at_period_end, 0) = 0
           AND COALESCE(payment_method_id, '') != ''
           AND next_billing_at IS NOT NULL
           AND next_billing_at <= ?
         LIMIT 100`
      )
      .bind(nowIso)
      .all()
      .catch(() => ({ results: [] }));

    for (const sub of dueAutoSubs.results || []) {
      const policy = await resolveEffectiveBillingPolicy(db, {
        productType: sub.product_type,
        appKey: sub.app_key,
        subscriptionId: sub.id,
      });

      const maxAutoAttempts = Math.max(1, (policy.retryIntervalsHours || []).length + 1);
      const currentRetryCount = Math.max(0, Number(sub.retry_count || 0));
      if (currentRetryCount >= maxAutoAttempts) {
        continue;
      }

      const pm: any = await db
        .prepare(
          `SELECT * FROM user_payment_methods
           WHERE id = ? AND user_id = ? AND is_active = 1 AND reusable = 1
           LIMIT 1`
        )
        .bind(String(sub.payment_method_id), String(sub.user_id))
        .first()
        .catch(() => null);

      if (!pm || !pm.authorization_code) {
        // Carte disparue ou non réutilisable -> basculer proprement en grâce + manuel
        const periodEndMs = Date.parse(String(sub.current_period_end || nowIso)) || nowMs;
        const graceUntilIso = sub.grace_until || new Date(periodEndMs + policy.gracePeriodDays * DAY_MS).toISOString();
        await db
          .prepare(
            `UPDATE active_subscriptions
             SET status = 'grace', renewal_mode = 'manual', grace_until = ?,
                 last_charge_error = 'Carte bancaire absente ou expirée',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(graceUntilIso, sub.id)
          .run()
          .catch(() => {});
        summary.movedToGrace++;
        continue;
      }

      // Vérifier que cette carte autorise bien le prélèvement automatique pour CE service (Stockage / IA / Application)
      if (isCardAuthorizedForSubscription && !isCardAuthorizedForSubscription(pm, sub)) {
        const periodEndMs = Date.parse(String(sub.current_period_end || nowIso)) || nowMs;
        const graceUntilIso = sub.grace_until || new Date(periodEndMs + policy.gracePeriodDays * DAY_MS).toISOString();
        await db
          .prepare(
            `UPDATE active_subscriptions
             SET status = 'grace', renewal_mode = 'manual', grace_until = ?,
                 last_charge_error = 'Carte non autorisée pour ce service',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(graceUntilIso, sub.id)
          .run()
          .catch(() => {});
        await recordSubscriptionEvent(db, {
          subscriptionId: String(sub.id),
          userId: String(sub.user_id),
          eventType: 'switched_to_manual',
          actor: 'cron',
          details: { reason: 'card_service_not_authorized', productType: sub.product_type, appKey: sub.app_key || '' },
        });
        summary.movedToGrace++;
        continue;
      }

      if (!secretKey) {
        summary.errors.push(`Clé Paystack absente pour auto-charge ${sub.id}`);
        continue;
      }

      const amountMajor = Number(sub.price_amount || 0);
      const currency = String(sub.currency || 'XOF').toUpperCase();
      if (amountMajor <= 0) continue;

      const periodKey = String(sub.current_period_end || nowIso).slice(0, 10).replace(/[^0-9]/g, '');
      const autoRef = `SC-AUTO-${String(sub.id).slice(-10)}-${periodKey}-R${currentRetryCount}`;

      // VERROU D'IDEMPOTENCE ANTI-DOUBLE FACTURATION
      const existingTx = await db
        .prepare('SELECT id, status FROM payment_transactions WHERE reference = ? LIMIT 1')
        .bind(autoRef)
        .first()
        .catch(() => null);
      if (existingTx) {
        continue;
      }

      const email = String(pm.auth_email || sub.user_email || '').trim();
      if (!email) {
        summary.errors.push(`Email manquant pour auto-charge ${sub.id}`);
        continue;
      }

      const amountMinor = toPaystackMinor(amountMajor, currency);
      const txId = `tx_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Insérer la transaction `pending` AVANT l'appel réseau Paystack (verrou idempotent)
      const isStorageAutoRenew = String(sub.product_type || '') === 'storage';
      await db
        .prepare(
          `INSERT INTO payment_transactions (
             id, reference, user_id, user_name, user_email, user_phone,
             product_type, product_id, product_name, app_key, app_name,
             billing_mode, billing_cycle, duration_days,
             expected_amount, expected_amount_minor, currency,
             provider, channel, status, subscription_id,
             target_storage_mb, recurring_price_amount, master_action
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?, ?, ?, ?, 'paystack', 'card', 'pending', ?, ?, ?, ?)`
        )
        .bind(
          txId,
          autoRef,
          String(sub.user_id),
          String(sub.user_name || ''),
          email,
          String(sub.user_phone || ''),
          String(sub.product_type || 'storage'),
          String(sub.plan_id || ''),
          String(sub.plan_name || 'Forfait StudyCloud'),
          String(sub.app_key || ''),
          String(sub.app_name || ''),
          String(sub.billing_cycle || 'monthly'),
          Math.max(1, Number(sub.duration_days || 30)),
          amountMajor,
          amountMinor,
          currency,
          String(sub.id),
          isStorageAutoRenew ? Math.max(0, Number(sub.granted_storage_mb || 0)) : 0,
          isStorageAutoRenew ? amountMajor : 0,
          isStorageAutoRenew ? 'renew' : ''
        )
        .run();

      let psOk = false;
      let psJson: any = {};
      let failReason = '';
      try {
        const resp = await fetchFn('https://api.paystack.co/transaction/charge_authorization', {
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
            reference: autoRef,
            metadata: {
              user_id: sub.user_id,
              subscription_id: sub.id,
              product_type: sub.product_type,
              product_id: sub.plan_id,
              app_key: sub.app_key || '',
              auto_renewal: true,
              retry_count: currentRetryCount,
            },
          }),
        });
        psJson = await resp.json().catch(() => ({}));
        psOk = Boolean(resp.ok && psJson?.status && psJson?.data?.status === 'success');
        if (!psOk) {
          failReason = String(
            psJson?.data?.gateway_response || psJson?.message || `Échec Paystack HTTP ${resp.status}`
          );
        }
      } catch (err: any) {
        failReason = String(err?.message || 'Erreur réseau Paystack');
      }

      if (psOk) {
        const pendingTxRow = await db
          .prepare('SELECT * FROM payment_transactions WHERE reference = ? LIMIT 1')
          .bind(autoRef)
          .first();
        await fulfillAutoRenewalTransaction(db, pendingTxRow, psJson.data);
        await recordSubscriptionEvent(db, {
          subscriptionId: String(sub.id),
          userId: String(sub.user_id),
          eventType: 'auto_charge_succeeded',
          actor: 'cron',
          details: {
            reference: autoRef,
            amount: amountMajor,
            currency,
            cardLast4: pm.last4 || '',
          },
        });
        summary.autoCharged++;
      } else {
        await db
          .prepare("UPDATE payment_transactions SET status = 'failed', raw_verify_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?")
          .bind(JSON.stringify(psJson || { error: failReason }).slice(0, 8000), autoRef)
          .run()
          .catch(() => {});

        const nextRetry = currentRetryCount + 1;
        const schedule = policy.retryIntervalsHours.length > 0 ? policy.retryIntervalsHours : [24, 72];
        const nextRetryDelayHours = schedule[Math.min(nextRetry - 1, schedule.length - 1)] || 24;
        const nextBillingAtIso =
          nextRetry < maxAutoAttempts
            ? new Date(nowMs + nextRetryDelayHours * HOUR_MS).toISOString()
            : sub.next_billing_at;

        const periodEndMs = Date.parse(String(sub.current_period_end || nowIso)) || nowMs;
        const graceUntilIso =
          sub.grace_until || new Date(periodEndMs + policy.gracePeriodDays * DAY_MS).toISOString();

        await db
          .prepare(
            `UPDATE active_subscriptions
             SET status = 'grace',
                 retry_count = ?,
                 last_charge_attempt_at = ?,
                 last_charge_error = ?,
                 next_billing_at = ?,
                 grace_until = ?,
                 block_scope = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(nextRetry, nowIso, failReason.slice(0, 240), nextBillingAtIso, graceUntilIso, policy.blockScope, sub.id)
          .run()
          .catch(() => {});

        await recordSubscriptionEvent(db, {
          subscriptionId: String(sub.id),
          userId: String(sub.user_id),
          eventType: 'auto_charge_failed',
          actor: 'cron',
          details: {
            reference: autoRef,
            retryCount: nextRetry,
            nextRetryAt: nextBillingAtIso,
            graceUntil: graceUntilIso,
            reason: failReason,
          },
        });

        if (policy.emailOnFail) {
          await sendAndLogBillingEmail({
            db,
            rawEnv,
            fetchFn,
            subscription: {
              ...sub,
              grace_until: graceUntilIso,
              block_scope: policy.blockScope,
              last_charge_error: failReason,
            },
            emailType: 'payment_failed',
            triggeredBy: 'cron',
            reference: autoRef,
            nowIso,
            recordEventFn: recordSubscriptionEvent,
          });
        }
        summary.autoFailed++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Phase 2 (auto-charge): ${err?.message || err}`);
  }

  // ==========================================================================
  // PHASE 2B : RECHARGE AUTOMATIQUE CRÉDITS IA QUAND SOLDE = 0 (MAX 1 / 24H)
  // ==========================================================================
  if (tryAutoRechargeDepletedAiCredits) {
    try {
      const depletedAiUsers = await db
        .prepare(
          `SELECT DISTINCT pm.user_id
           FROM user_payment_methods pm
           JOIN user_ai_credits c ON c.user_id = pm.user_id
           WHERE pm.is_active = 1
             AND pm.reusable = 1
             AND COALESCE(pm.auto_ai, 0) = 1
             AND COALESCE(pm.auto_ai_on_depleted, 0) = 1
             AND COALESCE(c.credits_balance, 0) <= 0
           LIMIT 50`
        )
        .all()
        .catch(() => ({ results: [] }));

      for (const row of depletedAiUsers.results || []) {
        const uid = String(row.user_id || '').trim();
        if (!uid) continue;
        const rechRes = await tryAutoRechargeDepletedAiCredits(db, rawEnv, uid, { fetchFn, nowIso });
        if (rechRes.recharged) {
          summary.aiAutoRecharged++;
        }
      }
    } catch (err: any) {
      summary.errors.push(`Phase 2B (ai-auto-recharge): ${err?.message || err}`);
    }
  }

  // ==========================================================================
  // PHASE 3 : ABONNEMENTS MANUELS / ANNULÉS EXPIRÉS -> GRÂCE OU ANNULÉ
  // ==========================================================================
  try {
    const expiredActiveSubs = await db
      .prepare(
        `SELECT * FROM active_subscriptions
         WHERE status = 'active'
           AND COALESCE(is_infinite, 0) = 0
           AND current_period_end IS NOT NULL
           AND current_period_end <= ?
         LIMIT 200`
      )
      .bind(nowIso)
      .all()
      .catch(() => ({ results: [] }));

    for (const sub of expiredActiveSubs.results || []) {
      const policy = await resolveEffectiveBillingPolicy(db, {
        productType: sub.product_type,
        appKey: sub.app_key,
        subscriptionId: sub.id,
      });

      if (Number(sub.cancel_at_period_end) === 1) {
        await db
          .prepare(
            `UPDATE active_subscriptions
             SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, ?), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(nowIso, sub.id)
          .run()
          .catch(() => {});

        if (sub.product_type === 'app' && sub.app_key) {
          await db
            .prepare("UPDATE user_app_entitlements SET status = 'expired', auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?")
            .bind(sub.user_id, sub.app_key)
            .run()
            .catch(() => {});
        } else if (sub.product_type === 'storage') {
          await db
            .prepare("UPDATE user_subscriptions SET status = 'cancelled', is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'")
            .bind(sub.user_id)
            .run()
            .catch(() => {});
        }
        await recordSubscriptionEvent(db, {
          subscriptionId: String(sub.id),
          userId: String(sub.user_id),
          eventType: 'cancelled_at_period_end',
          actor: 'cron',
          details: { endedAt: sub.current_period_end },
        });
        summary.cancelledAtPeriodEnd++;
        continue;
      }

      const periodEndMs = Date.parse(String(sub.current_period_end || nowIso)) || nowMs;
      const graceUntilIso =
        sub.grace_until || new Date(periodEndMs + policy.gracePeriodDays * DAY_MS).toISOString();

      await db
        .prepare(
          `UPDATE active_subscriptions
           SET status = 'grace',
               grace_until = ?,
               block_scope = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(graceUntilIso, policy.blockScope, sub.id)
        .run()
        .catch(() => {});

      if (sub.product_type === 'app' && sub.app_key) {
        await db
          .prepare("UPDATE user_app_entitlements SET status = 'grace', grace_until = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?")
          .bind(graceUntilIso, sub.user_id, sub.app_key)
          .run()
          .catch(() => {});
      }

      await recordSubscriptionEvent(db, {
        subscriptionId: String(sub.id),
        userId: String(sub.user_id),
        eventType: 'entered_grace',
        actor: 'cron',
        details: { graceUntil: graceUntilIso, blockScope: policy.blockScope },
      });
      summary.movedToGrace++;
    }
  } catch (err: any) {
    summary.errors.push(`Phase 3 (grace transition): ${err?.message || err}`);
  }

  // ==========================================================================
  // PHASE 4 : RELANCES EMAIL D'IMPAYÉ (INTERVALLE RÉGLÉ PAR L'ADMIN)
  // ==========================================================================
  try {
    const overdueSubs = await db
      .prepare(
        `SELECT * FROM active_subscriptions
         WHERE status IN ('grace', 'past_due')
           AND COALESCE(is_infinite, 0) = 0
         LIMIT 200`
      )
      .all()
      .catch(() => ({ results: [] }));

    for (const sub of overdueSubs.results || []) {
      const policy = await resolveEffectiveBillingPolicy(db, {
        productType: sub.product_type,
        appKey: sub.app_key,
        subscriptionId: sub.id,
      });

      const graceEndMs = sub.grace_until ? Date.parse(String(sub.grace_until)) : NaN;
      if (Number.isFinite(graceEndMs) && graceEndMs <= nowMs) {
        // Sera traité en Phase 5 (blocage) juste après
        continue;
      }

      const sentCount = Math.max(0, Number(sub.reminder_count || 0));
      if (sentCount >= policy.overdueMaxReminders) continue;

      const lastReminderMs = sub.last_reminder_sent_at ? Date.parse(String(sub.last_reminder_sent_at)) : 0;
      const elapsedHours = lastReminderMs ? (nowMs - lastReminderMs) / HOUR_MS : Number.POSITIVE_INFINITY;
      if (elapsedHours < policy.overdueIntervalHours) continue;

      const graceDaysRem = Number.isFinite(graceEndMs)
        ? Math.max(1, Math.ceil((graceEndMs - nowMs) / DAY_MS))
        : null;

      const mailRes = await sendAndLogBillingEmail({
        db,
        rawEnv,
        fetchFn,
        subscription: { ...sub, block_scope: policy.blockScope },
        emailType: 'overdue_reminder',
        triggeredBy: 'cron',
        graceDaysRemaining: graceDaysRem,
        nowIso,
        recordEventFn: recordSubscriptionEvent,
      });
      if (mailRes.success) summary.remindersSent++;
    }
  } catch (err: any) {
    summary.errors.push(`Phase 4 (overdue reminders): ${err?.message || err}`);
  }

  // ==========================================================================
  // PHASE 5 : BLOCAGE AUTOMATIQUE APRÈS FIN DE GRÂCE (`block_scope`)
  // ==========================================================================
  try {
    const expiredGraceSubs = await db
      .prepare(
        `SELECT * FROM active_subscriptions
         WHERE status IN ('grace', 'past_due')
           AND COALESCE(is_infinite, 0) = 0
           AND grace_until IS NOT NULL
           AND grace_until <= ?
         LIMIT 200`
      )
      .bind(nowIso)
      .all()
      .catch(() => ({ results: [] }));

    for (const sub of expiredGraceSubs.results || []) {
      const policy = await resolveEffectiveBillingPolicy(db, {
        productType: sub.product_type,
        appKey: sub.app_key,
        subscriptionId: sub.id,
      });

      await db
        .prepare(
          `UPDATE active_subscriptions
           SET status = 'blocked',
               blocked_at = ?,
               block_scope = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(nowIso, policy.blockScope, sub.id)
        .run()
        .catch(() => {});

      if (sub.product_type === 'app' && sub.app_key) {
        await db
          .prepare("UPDATE user_app_entitlements SET status = 'expired', auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND app_key = ?")
          .bind(sub.user_id, sub.app_key)
          .run()
          .catch(() => {});
      } else if (sub.product_type === 'storage') {
        await db
          .prepare("UPDATE user_subscriptions SET status = 'blocked', is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'")
          .bind(sub.user_id)
          .run()
          .catch(() => {});
      }

      await recordSubscriptionEvent(db, {
        subscriptionId: String(sub.id),
        userId: String(sub.user_id),
        eventType: 'service_blocked',
        actor: 'cron',
        details: {
          blockScope: policy.blockScope,
          graceUntil: sub.grace_until,
          blockedAt: nowIso,
        },
      });

      if (policy.emailOnBlock) {
        await sendAndLogBillingEmail({
          db,
          rawEnv,
          fetchFn,
          subscription: { ...sub, block_scope: policy.blockScope },
          emailType: 'service_blocked',
          triggeredBy: 'cron',
          nowIso,
          recordEventFn: recordSubscriptionEvent,
        });
      }
      summary.blocked++;
    }
  } catch (err: any) {
    summary.errors.push(`Phase 5 (blocking): ${err?.message || err}`);
  }

  return summary;
}
