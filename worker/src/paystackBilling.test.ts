import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  checkUserAppAccess,
  computeEntitlementExpiration,
  computePaystackHmacSha512Hex,
  computeResendSvixSignature,
  computeSubscriptionCountdown,
  ensurePaystackBillingTables,
  evaluateUserBillingGuard,
  executeBillingCronJob,
  extractPaystackNetworkLabel,
  handlePaystackBillingRoutes,
  normalizeBillingMode,
  normalizeBlockScope,
  normalizeIvoryCoastPhone,
  normalizeMobileMoneyProvider,
  normalizePlanBillingFlags,
  resolveEffectiveBillingPolicy,
  resolveInitialRenewalMode,
  resolvePlanPriceMajor,
  toPaystackAmountMinor,
  translatePaystackErrorFr,
  tryAutoRechargeDepletedAiCredits,
} from './paystackBilling';

function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = OFF;');

  const wrap = (sql: string, params: any[] = []) => ({
    bind(...values: any[]) {
      return wrap(sql, values);
    },
    async first<T = any>() {
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...params);
      return (row === undefined ? null : row) as T | null;
    },
    async all<T = any>() {
      const stmt = sqlite.prepare(sql);
      const results = stmt.all(...params) as T[];
      return { success: true, meta: {}, results };
    },
    async run() {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...params);
      return {
        success: true,
        meta: { changes: Number(info.changes || 0), last_row_id: info.lastInsertRowid },
      };
    },
  });

  return {
    sqlite,
    db: {
      prepare(sql: string) {
        return wrap(sql);
      },
    },
  };
}

function createHarness(mockFetch?: typeof fetch) {
  const { db, sqlite } = createMockD1();
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT
    );
    INSERT INTO users (id, name, email, phone) VALUES
      ('user-alice', 'Alice Kouassi', 'alice@studycloud.ci', '+22507000001'),
      ('user-bob', 'Bob Traoré', 'bob@studycloud.ci', '+22505000002');
  `);

  const secretKey = 'sk_test_studycloud_secret_key_for_unit_tests';
  const adminSecret = 'test_admin_secret_studycloud_001';
  const rawEnv = {
    STUDYCLOUD_PAYSTACK_SECRET_KEY: secretKey,
    ADMIN_API_SECRET: adminSecret,
  };

  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const errorResponse = (message: string, status = 400) =>
    jsonResponse({ success: false, error: message }, status);

  const getAuthUser = async (req: Request) => {
    const auth = req.headers.get('Authorization') || '';
    if (auth === 'Bearer token-alice') return { userId: 'user-alice', email: 'alice@studycloud.ci' };
    if (auth === 'Bearer token-bob') return { userId: 'user-bob', email: 'bob@studycloud.ci' };
    return null;
  };

  const callApi = async (
    pathWithQuery: string,
    opts: { method?: string; token?: string; body?: any; rawBody?: string; headers?: Record<string, string> } = {}
  ) => {
    const method = opts.method || 'GET';
    const url = new URL(`https://api-worker.dkd-technologies.com${pathWithQuery}`);
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    let bodyInit: string | undefined;
    if (opts.rawBody !== undefined) {
      bodyInit = opts.rawBody;
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    } else if (opts.body !== undefined) {
      bodyInit = JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
    }
    const req = new Request(url.toString(), { method, headers, body: bodyInit });
    const res = await handlePaystackBillingRoutes(req, url, url.pathname, method, {
      db,
      rawEnv,
      origin: 'https://studycloud.dkd-technologies.com',
      getAuthUser,
      jsonResponse,
      errorResponse,
      fetchFn: mockFetch,
    });
    assert.ok(res, `Route non gérée : ${method} ${url.pathname}`);
    return res;
  };

  return { db, sqlite, secretKey, callApi };
}

test('Helpers purs Paystack : montants XOF ×100, modes auto/manual/infinite, réseaux et prolongations', () => {
  assert.equal(toPaystackAmountMinor(5000), 500000);
  assert.equal(toPaystackAmountMinor(1500), 150000);
  assert.equal(normalizeBillingMode('auto'), 'auto');
  assert.equal(normalizeBillingMode('infinite'), 'infinite');
  assert.equal(normalizeBillingMode('manual'), 'manual');
  assert.equal(normalizeBillingMode(undefined, 1), 'auto');
  assert.equal(normalizeBillingMode(undefined, 0, 'one_time'), 'infinite');

  const wave = extractPaystackNetworkLabel({ channel: 'mobile_money', authorization: { bank: 'Wave CI' } });
  assert.equal(wave.networkLabel, 'Wave');
  const orange = extractPaystackNetworkLabel({ channel: 'mobile_money', authorization: { bank: 'Orange Money' } });
  assert.equal(orange.networkLabel, 'Orange Money');
  const mtn = extractPaystackNetworkLabel({ channel: 'mobile_money', authorization: { bank: 'MTN MoMo' } });
  assert.equal(mtn.networkLabel, 'MTN MoMo');
  const visa = extractPaystackNetworkLabel({ channel: 'card', authorization: { brand: 'visa', bank: 'UBA' } });
  assert.equal(visa.networkLabel, 'Carte Visa');

  // Infini -> expires_at = null
  assert.equal(computeEntitlementExpiration('infinite', 0), null);

  // Renouvellement anticipé -> préserve les jours restants !
  const now = Date.parse('2026-11-24T12:00:00.000Z');
  const existingExp = '2026-12-04T12:00:00.000Z'; // +10j restants
  const extended = computeEntitlementExpiration('manual', 30, existingExp, now);
  assert.equal(extended, '2027-01-03T12:00:00.000Z');

  // Calcul prix serveur depuis XOF / USD
  const resolvedXof = resolvePlanPriceMajor(
    { price: 2500, primary_currency: 'XOF', billing_mode: 'manual', duration_days: 90 },
    'monthly',
    'XOF'
  );
  assert.equal(resolvedXof.amountMajor, 2500);
  assert.equal(resolvedXof.durationDays, 90);
});

test('Flux complet Paystack (Stockage + IA + App Moyennes) : prix serveur, HMAC-SHA512, anti-fraude et verrou anti-double crédit', async () => {
  const paystackCalls: Array<{ url: string; body?: any }> = [];
  let verifyResponseData: any = null;

  const mockFetch: typeof fetch = async (input: any, init?: any) => {
    const urlStr = String(input);
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    paystackCalls.push({ url: urlStr, body: parsedBody });

    if (urlStr.endsWith('/plan')) {
      return new Response(
        JSON.stringify({ status: true, data: { plan_code: 'PLN_sc_test_monthly' } }),
        { status: 200 }
      );
    }
    if (urlStr.endsWith('/transaction/initialize')) {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.com/test-${parsedBody.reference}`,
            access_code: `acc_${parsedBody.reference}`,
            reference: parsedBody.reference,
          },
        }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/transaction/verify/')) {
      return new Response(JSON.stringify({ status: true, data: verifyResponseData }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: false, message: 'Unhandled mock URL' }), { status: 404 });
  };

  const { db, secretKey, callApi } = createHarness(mockFetch);
  await ensurePaystackBillingTables(db);

  // 1. Seed d'un forfait stockage, d'un pack IA, et de 2 cartes pour l'app Moyennes (activée en payant avec 7j d'essai)
  await db
    .prepare(
      `INSERT INTO storage_subscription_plans (id, name, storage_amount, storage_mb, price, primary_currency, billing_mode, duration_days, is_auto_billing, is_active)
       VALUES ('stor_50go', 'Pack 50 Go', '50 Go', 51200, 3000, 'XOF', 'manual', 30, 0, 1)`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO ai_subscription_plans (id, name, credits_or_words, credits_count, price, primary_currency, billing_mode, duration_days, pricing_model, is_active)
       VALUES ('ai_pack_1000', 'Pack 1000 Crédits', '1 000 crédits', 1000, 2000, 'XOF', 'infinite', 0, 'one_time', 1)`
    )
    .run();

  await db
    .prepare("UPDATE monetized_apps SET is_paid = 1, trial_days = 7, grace_period_days = 5 WHERE app_key = 'moyennes'")
    .run();

  await db
    .prepare(
      `INSERT INTO app_subscription_plans (id, app_key, name, price, primary_currency, billing_mode, duration_days, is_auto_billing, is_active)
       VALUES
         ('app_moy_auto', 'moyennes', 'Moyennes Mensuel Auto', 1500, 'XOF', 'auto', 30, 1, 1),
         ('app_moy_life', 'moyennes', 'Moyennes Accès à vie', 15000, 'XOF', 'infinite', 0, 0, 1)`
    )
    .run();

  // 2. Avant paiement : Alice est bloquée sur Moyennes (is_paid = 1), mais peut activer l'essai gratuit
  const accessBefore = await (await callApi('/api/apps/access/moyennes', { token: 'token-alice' })).json();
  assert.equal(accessBefore.allowed, false);
  assert.equal(accessBefore.canStartTrial, true);

  // 3. Initialisation paiement Stockage (3000 FCFA -> 300000 minor, même si le client tente d'injecter amount: 1)
  const initStorRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-alice',
    body: { productType: 'storage', productId: 'stor_50go', amount: 1, price: 1 },
  });
  assert.equal(initStorRes.status, 200);
  const initStor = await initStorRes.json();
  assert.equal(initStor.amount, 3000);
  assert.equal(initStor.amountMinor, 300000);
  assert.equal(paystackCalls[paystackCalls.length - 1].body.amount, 300000);
  assert.deepEqual(paystackCalls[paystackCalls.length - 1].body.channels, ['mobile_money', 'card']);

  // 4. Anti-fraude : Webhook avec signature HMAC invalide -> 401
  const badWebhook = await callApi('/api/payments/paystack/webhook', {
    method: 'POST',
    rawBody: JSON.stringify({ event: 'charge.success', data: { reference: initStor.reference, status: 'success', amount: 300000, currency: 'XOF' } }),
    headers: { 'x-paystack-signature': 'deadbeef0000' },
  });
  assert.equal(badWebhook.status, 401);

  // 5. Anti-fraude : Verify avec montant payé falsifié/insuffisant (100 FCFA au lieu de 3000 FCFA) -> refusé
  verifyResponseData = {
    id: 9001,
    reference: initStor.reference,
    status: 'success',
    amount: 10000,
    currency: 'XOF',
    channel: 'mobile_money',
    authorization: { bank: 'Wave' },
  };
  const fraudVerify = await (await callApi(`/api/payments/paystack/verify?reference=${initStor.reference}`, { token: 'token-alice' })).json();
  assert.equal(fraudVerify.verified, false);
  const quotaAfterFraud: any = await db.prepare('SELECT paid_total_mb FROM user_storage_quotas WHERE user_id = ?').bind('user-alice').first();
  assert.equal(quotaAfterFraud, null, 'Aucun Mo ne doit être crédité si le montant est insuffisant');

  // 6. Vrai Webhook HMAC-SHA512 valide (Wave, 3000 FCFA) + appel /verify ensuite -> crédité UNE SEULE FOIS !
  // Remettre la tx en pending comme dans un vrai scénario avant paiement réussi
  await db.prepare("UPDATE payment_transactions SET status = 'pending' WHERE reference = ?").bind(initStor.reference).run();
  const validPayload = JSON.stringify({
    event: 'charge.success',
    data: {
      id: 9002,
      reference: initStor.reference,
      status: 'success',
      amount: 300000,
      currency: 'XOF',
      channel: 'mobile_money',
      authorization: { bank: 'Wave CI', reusable: false },
    },
  });
  const validSig = await computePaystackHmacSha512Hex(secretKey, validPayload);
  const okWebhook = await callApi('/api/payments/paystack/webhook', {
    method: 'POST',
    rawBody: validPayload,
    headers: { 'x-paystack-signature': validSig },
  });
  assert.equal(okWebhook.status, 200);

  // Double appel simultané via /verify -> idempotent !
  verifyResponseData = JSON.parse(validPayload).data;
  const secondVerify = await (await callApi(`/api/payments/paystack/verify?reference=${initStor.reference}`, { token: 'token-alice' })).json();
  assert.equal(secondVerify.verified, true);
  assert.equal(secondVerify.alreadyFulfilled, true);

  // Vérifier que le stockage a été crédité EXACTEMENT UNE FOIS (+51200 Mo) et réseau = Wave
  const quotaAfterOk: any = await db.prepare('SELECT paid_total_mb FROM user_storage_quotas WHERE user_id = ?').bind('user-alice').first();
  assert.equal(Number(quotaAfterOk.paid_total_mb), 51200);
  const txRow: any = await db.prepare('SELECT status, network_label, paid_amount FROM payment_transactions WHERE reference = ?').bind(initStor.reference).first();
  assert.equal(txRow.status, 'paid');
  assert.equal(txRow.network_label, 'Wave');
  assert.equal(Number(txRow.paid_amount), 3000);

  // Anti-IDOR : Bob ne peut pas vérifier la transaction d'Alice
  const bobVerify = await callApi(`/api/payments/paystack/verify?reference=${initStor.reference}`, { token: 'token-bob' });
  assert.equal(bobVerify.status, 404);

  // 7. Paiement Application Moyennes en mode Automatique Carte (crée le plan Paystack natif PLN_sc_test_monthly)
  const initAppRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-alice',
    body: { productType: 'app', productId: 'app_moy_auto', billingCycle: 'monthly', preferAutoCard: true },
  });
  assert.equal(initAppRes.status, 200);
  const initApp = await initAppRes.json();
  const lastInitCall = paystackCalls[paystackCalls.length - 1];
  assert.equal(lastInitCall.body.plan, 'PLN_sc_test_monthly');
  assert.deepEqual(lastInitCall.body.channels, ['card']);

  verifyResponseData = {
    id: 9003,
    reference: initApp.reference,
    status: 'success',
    amount: 150000,
    currency: 'XOF',
    channel: 'card',
    authorization: { brand: 'visa', bank: 'UBA', authorization_code: 'AUTH_test_123', reusable: true },
  };
  const verifyApp = await (await callApi(`/api/payments/paystack/verify?reference=${initApp.reference}`, { token: 'token-alice' })).json();
  assert.equal(verifyApp.verified, true);
  assert.equal(verifyApp.transaction.network_label, 'Carte Visa');

  // Alice a maintenant accès à Moyennes côté serveur !
  const accessAfter = await checkUserAppAccess(db, 'user-alice', 'moyennes');
  assert.equal(accessAfter.allowed, true);
  assert.equal(accessAfter.status, 'active');
  assert.equal(accessAfter.entitlement.auto_renew, 1);

  // 8. Achat Pack IA Infini (1000 crédits) via Orange Money
  const initAiRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-alice',
    body: { productType: 'ai', productId: 'ai_pack_1000' },
  });
  const initAi = await initAiRes.json();
  verifyResponseData = {
    id: 9004,
    reference: initAi.reference,
    status: 'success',
    amount: 200000,
    currency: 'XOF',
    channel: 'mobile_money',
    authorization: { bank: 'Orange Money CI', reusable: false },
  };
  const verifyAi = await (await callApi(`/api/payments/paystack/verify?reference=${initAi.reference}`, { token: 'token-alice' })).json();
  assert.equal(verifyAi.verified, true);
  assert.equal(verifyAi.transaction.network_label, 'Orange Money');
  const aiCreditsRow: any = await db.prepare('SELECT purchased_remaining, credits_balance FROM user_ai_credits WHERE user_id = ?').bind('user-alice').first();
  assert.equal(Number(aiCreditsRow.purchased_remaining), 1000);
  assert.equal(Number(aiCreditsRow.credits_balance), 1050);

  // 9. Config interrupteur bouton Payer manuellement (ON -> OFF)
  const cfgOn = await (await callApi('/api/payments/config')).json();
  assert.equal(cfgOn.config.manualReceiptEnabled, true);
  assert.equal(cfgOn.config.mode, 'test');

  await db.prepare("UPDATE payment_gateway_config SET manual_receipt_enabled = 0 WHERE id = 'default'").run();
  const cfgOff = await (await callApi('/api/payments/config')).json();
  assert.equal(cfgOff.config.manualReceiptEnabled, false);
});

test('Charge API Mobile Money (Orange OTP + Wave open_url) + Anti-IDOR + channelOnly card', async () => {
  assert.equal(normalizeIvoryCoastPhone('+225 07 00 00 00 00'), '0700000000');
  assert.equal(normalizeIvoryCoastPhone('00225 05 12 34 56 78'), '0512345678');
  assert.equal(normalizeIvoryCoastPhone('070 000 000 0'), '0700000000');
  assert.equal(normalizeMobileMoneyProvider('wave'), 'wave');
  assert.equal(normalizeMobileMoneyProvider('orange_money'), 'orange');
  assert.equal(normalizeMobileMoneyProvider('momo'), 'mtn');
  assert.equal(normalizeMobileMoneyProvider('unknown'), null);

  const calls: Array<{ url: string; body?: any }> = [];
  const mockFetch: typeof fetch = async (input: any, init?: any) => {
    const urlStr = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: urlStr, body });

    if (urlStr.endsWith('/charge')) {
      if (body?.mobile_money?.provider === 'orange') {
        return new Response(
          JSON.stringify({
            status: true,
            data: {
              reference: body.reference,
              status: 'send_otp',
              display_text: 'Entrez le code OTP reçu sur votre numéro Orange Money.',
            },
          }),
          { status: 200 }
        );
      }
      if (body?.mobile_money?.provider === 'wave') {
        return new Response(
          JSON.stringify({
            status: true,
            data: {
              reference: body.reference,
              status: 'open_url',
              url: 'https://pay.wave.com/c/test-session',
              display_text: 'Ouvrez Wave pour autoriser le paiement.',
            },
          }),
          { status: 200 }
        );
      }
    }

    if (urlStr.endsWith('/charge/submit_otp')) {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 778899,
            reference: body.reference,
            status: 'success',
            amount: 100000,
            currency: 'XOF',
            channel: 'mobile_money',
            authorization: { bank: 'Orange Money CI', reusable: false },
          },
        }),
        { status: 200 }
      );
    }

    if (urlStr.endsWith('/transaction/initialize')) {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/card-only-test',
            access_code: 'acc_card_only_123',
            reference: body.reference,
          },
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ status: false, message: 'Unexpected URL' }), { status: 404 });
  };

  const { db, callApi } = createHarness(mockFetch);
  await ensurePaystackBillingTables(db);
  await db
    .prepare(
      `INSERT INTO storage_subscription_plans (id, name, storage_amount, storage_mb, price, primary_currency, billing_mode, duration_days, is_auto_billing, is_active)
       VALUES ('stor_basic', 'Basique', '10 Go', 10240, 1000, 'XOF', 'manual', 30, 0, 1)`
    )
    .run();

  // 1. Charge Orange Money -> renvoie send_otp + montant serveur 100000 (1000 FCFA x 100)
  const orangeRes = await callApi('/api/payments/paystack/charge-mobile', {
    method: 'POST',
    token: 'token-alice',
    body: {
      productType: 'storage',
      productId: 'stor_basic',
      provider: 'orange',
      phone: '+225 07 00 00 00 00',
    },
  });
  assert.equal(orangeRes.status, 200);
  const orangeJson = await orangeRes.json();
  assert.equal(orangeJson.success, true);
  assert.equal(orangeJson.chargeStatus, 'send_otp');
  assert.equal(calls[0].body.amount, 100000);
  assert.equal(calls[0].body.mobile_money.phone, '0700000000');
  assert.equal(calls[0].body.mobile_money.provider, 'orange');

  // 2. Anti-IDOR : Bob ne peut pas soumettre l'OTP pour la transaction d'Alice
  const bobOtp = await callApi('/api/payments/paystack/submit-otp', {
    method: 'POST',
    token: 'token-bob',
    body: { reference: orangeJson.reference, otp: '1234' },
  });
  assert.equal(bobOtp.status, 404);

  // 3. Alice soumet l'OTP -> paiement immédiatement validé & stockage crédité (+10240 Mo)
  const aliceOtpRes = await callApi('/api/payments/paystack/submit-otp', {
    method: 'POST',
    token: 'token-alice',
    body: { reference: orangeJson.reference, otp: '1234' },
  });
  const aliceOtp = await aliceOtpRes.json();
  assert.equal(aliceOtp.success, true);
  assert.equal(aliceOtp.verified, true);
  assert.equal(aliceOtp.chargeStatus, 'success');
  const quotaRow: any = await db
    .prepare('SELECT paid_total_mb FROM user_storage_quotas WHERE user_id = ?')
    .bind('user-alice')
    .first();
  assert.equal(Number(quotaRow.paid_total_mb), 10240);

  // 4. Charge Wave (Bob, nouvel acheteur) -> renvoie open_url (lien app Wave)
  const waveRes = await callApi('/api/payments/paystack/charge-mobile', {
    method: 'POST',
    token: 'token-bob',
    body: {
      productType: 'storage',
      productId: 'stor_basic',
      provider: 'wave',
      phone: '0700000000',
    },
  });
  const waveJson = await waveRes.json();
  assert.equal(waveJson.success, true);
  assert.equal(waveJson.chargeStatus, 'open_url');
  assert.equal(waveJson.openUrl, 'https://pay.wave.com/c/test-session');

  // 5. Initialize Carte uniquement (channelOnly: 'card') pour InlineJS V2 (renouvellement Carte Maîtresse d'Alice)
  const cardRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-alice',
    body: {
      productType: 'storage',
      productId: 'storage_master_renew',
      channelOnly: 'card',
    },
  });
  const cardJson = await cardRes.json();
  assert.equal(cardJson.success, true);
  assert.equal(cardJson.accessCode, 'acc_card_only_123');
  const lastCall = calls[calls.length - 1];
  assert.deepEqual(lastCall.body.channels, ['card']);
});

test('Étape 1 — Règles Auto+Manuel / Manuel seul / Infini, table unifiée active_subscriptions, cartes masquées, Anti-IDOR et politiques 3 niveaux', async () => {
  // 1. Règle métier stricte des cases Admin : Auto impose toujours Manuel ; Infini est exclusif
  assert.deepEqual(normalizePlanBillingFlags({ allow_auto: 1, allow_manual: 0 }), {
    allowAuto: 1,
    allowManual: 1,
    isInfinite: 0,
    billingMode: 'auto',
    isAutoBilling: 1,
  });
  assert.deepEqual(normalizePlanBillingFlags({ allow_auto: 0, allow_manual: 1 }), {
    allowAuto: 0,
    allowManual: 1,
    isInfinite: 0,
    billingMode: 'manual',
    isAutoBilling: 0,
  });
  assert.deepEqual(normalizePlanBillingFlags({ is_infinite: 1, allow_auto: 1, allow_manual: 1 }), {
    allowAuto: 0,
    allowManual: 0,
    isInfinite: 1,
    billingMode: 'infinite',
    isAutoBilling: 0,
  });

  // 2. Mode initial après paiement : Auto par défaut UNIQUEMENT sur Carte réutilisable + Plan Auto+Manuel
  const resVisaAuto = resolveInitialRenewalMode({ isInfinite: 0, allowAuto: 1, channel: 'card', reusable: 1 });
  assert.equal(resVisaAuto.renewalMode, 'auto');
  assert.equal(resVisaAuto.canChooseAutoOnSuccessScreen, true);

  const resWaveAutoPlan = resolveInitialRenewalMode({ isInfinite: 0, allowAuto: 1, channel: 'mobile_money', reusable: 0 });
  assert.equal(resWaveAutoPlan.renewalMode, 'manual');
  assert.equal(resWaveAutoPlan.canChooseAutoOnSuccessScreen, false);

  const resVisaManualOnly = resolveInitialRenewalMode({ isInfinite: 0, allowAuto: 0, channel: 'card', reusable: 1 });
  assert.equal(resVisaManualOnly.renewalMode, 'manual');
  assert.equal(resVisaManualOnly.canChooseAutoOnSuccessScreen, false);

  const resInfinite = resolveInitialRenewalMode({ isInfinite: 1, allowAuto: 0, channel: 'card', reusable: 1 });
  assert.equal(resInfinite.renewalMode, 'infinite');
  assert.equal(resInfinite.canChooseAutoOnSuccessScreen, false);

  // 3. Countdown temps réel (actif, grâce, expiré, infini) & blockScope
  assert.equal(normalizeBlockScope('read_only'), 'read_only');
  assert.equal(normalizeBlockScope('full_account'), 'full_account');
  assert.equal(normalizeBlockScope('invalid'), 'service_only');

  const nowMs = Date.parse('2026-11-25T10:00:00.000Z');
  const cdInf = computeSubscriptionCountdown(null, 1, null, nowMs);
  assert.equal(cdInf.isInfinite, true);
  assert.equal(cdInf.labelFr, 'À vie (Infini)');

  const cdActive = computeSubscriptionCountdown('2026-12-05T14:00:00.000Z', 0, null, nowMs);
  assert.equal(cdActive.daysRemaining, 10);
  assert.equal(cdActive.hoursRemaining, 4);
  assert.equal(cdActive.isExpired, false);

  const cdGrace = computeSubscriptionCountdown('2026-11-24T10:00:00.000Z', 0, '2026-11-28T10:00:00.000Z', nowMs);
  assert.equal(cdGrace.isExpired, true);
  assert.equal(cdGrace.isInGrace, true);
  assert.equal(cdGrace.graceDaysRemaining, 3);

  // 4. Flux bout-en-bout : Wave sur plan Auto+Manuel -> Manuel, puis Visa sur plan Auto+Manuel -> Auto,
  //    puis bascule Auto <-> Manuel, Anti-IDOR Bob, et suppression de carte -> bascule auto vers manuel
  let verifyData: any = null;
  const mockFetch: typeof fetch = async (input: any, init?: any) => {
    const u = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (u.endsWith('/transaction/initialize')) {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.com/${body.reference}`,
            access_code: `acc_${body.reference}`,
            reference: body.reference,
          },
        }),
        { status: 200 }
      );
    }
    if (u.includes('/transaction/verify/')) {
      return new Response(JSON.stringify({ status: true, data: verifyData }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: false }), { status: 404 });
  };

  const { db, callApi } = createHarness(mockFetch);
  await ensurePaystackBillingTables(db);

  // Seed plans : Stockage Auto+Manuel, App Moyennes Auto+Manuel, App Moyennes Infini
  await db
    .prepare(
      `INSERT INTO storage_subscription_plans (id, name, storage_amount, storage_mb, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite, is_active)
       VALUES ('stor_auto_100', 'Stockage 100 Go Auto+Manuel', '100 Go', 102400, 4000, 'XOF', 'auto', 30, 1, 1, 1, 0, 1)`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO app_subscription_plans (id, app_key, name, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite, is_active)
       VALUES
         ('moy_auto_m', 'moyennes', 'Moyennes Mensuel', 2000, 'XOF', 'auto', 30, 1, 1, 1, 0, 1),
         ('moy_life', 'moyennes', 'Moyennes À Vie', 25000, 'XOF', 'infinite', 0, 0, 0, 0, 1, 1)`
    )
    .run();

  // 4A. Alice achète Stockage Auto+Manuel via Wave -> renewal_mode DOIT être 'manual' (pas de carte encore)
  const initWave = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-alice',
      body: { productType: 'storage', productId: 'stor_auto_100' },
    })
  ).json();
  verifyData = {
    id: 5001,
    reference: initWave.reference,
    status: 'success',
    amount: 400000,
    currency: 'XOF',
    channel: 'mobile_money',
    authorization: { bank: 'Wave CI', reusable: false },
  };
  const verWave = await (
    await callApi(`/api/payments/paystack/verify?reference=${initWave.reference}`, { token: 'token-alice' })
  ).json();
  assert.equal(verWave.verified, true);
  assert.ok(verWave.subscription?.id);
  assert.equal(verWave.subscription.renewal_mode, 'manual');
  assert.equal(verWave.renewalUiConfig.canChooseAutoOnSuccessScreen, false);

  // Alice essaie de passer Stockage en 'auto' AVANT d'avoir une carte -> refusé 400 proprement !
  const tryAutoNoCard = await callApi(`/api/billing/subscriptions/${verWave.subscription.id}/renewal-mode`, {
    method: 'PATCH',
    token: 'token-alice',
    body: { renewalMode: 'auto' },
  });
  assert.equal(tryAutoNoCard.status, 400);

  // 4B. Alice achète Moyennes Mensuel par Carte Visa réutilisable -> carte enregistrée + renewal_mode = 'auto' par défaut !
  const initVisa = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-alice',
      body: { productType: 'app', productId: 'moy_auto_m', channelOnly: 'card' },
    })
  ).json();
  verifyData = {
    id: 5002,
    reference: initVisa.reference,
    status: 'success',
    amount: 200000,
    currency: 'XOF',
    channel: 'card',
    customer: { email: 'alice@studycloud.ci' },
    authorization: {
      authorization_code: 'AUTH_SECRET_VISA_999',
      brand: 'visa',
      card_type: 'visa debit',
      last4: '4081',
      exp_month: '12',
      exp_year: '2029',
      bank: 'Ecobank CI',
      country_code: 'CI',
      signature: 'SIG_ALICE_4081',
      reusable: true,
    },
  };
  const verVisa = await (
    await callApi(`/api/payments/paystack/verify?reference=${initVisa.reference}`, { token: 'token-alice' })
  ).json();
  assert.equal(verVisa.verified, true);
  assert.equal(verVisa.subscription.renewal_mode, 'auto');
  assert.equal(verVisa.renewalUiConfig.canChooseAutoOnSuccessScreen, true);
  assert.equal(verVisa.paymentMethod.last4, '4081');
  assert.equal(verVisa.paymentMethod.authorization_code, undefined, 'Ne doit JAMAIS exposer authorization_code au client');

  // 4C. Alice décide sur l'écran vert de passer Moyennes en 'manual' -> OK + sync user_app_entitlements.auto_renew = 0
  const switchManualRes = await callApi(`/api/billing/subscriptions/${verVisa.subscription.id}/renewal-mode`, {
    method: 'PATCH',
    token: 'token-alice',
    body: { renewalMode: 'manual' },
  });
  assert.equal(switchManualRes.status, 200);
  const switchManual = await switchManualRes.json();
  assert.equal(switchManual.subscription.renewal_mode, 'manual');
  assert.equal(Number(switchManual.subscription.user_confirmed_renewal), 1);
  const entAfterManual: any = await db
    .prepare("SELECT auto_renew FROM user_app_entitlements WHERE user_id = 'user-alice' AND app_key = 'moyennes'")
    .first();
  assert.equal(Number(entAfterManual.auto_renew), 0);

  // 4D. Maintenant qu'Alice a une carte Visa liée, elle peut activer 'auto' sur son abonnement Stockage (payé Wave) !
  const switchStorAuto = await callApi(`/api/billing/subscriptions/${verWave.subscription.id}/renewal-mode`, {
    method: 'PATCH',
    token: 'token-alice',
    body: { renewalMode: 'auto' },
  });
  assert.equal(switchStorAuto.status, 200);
  const storAutoJson = await switchStorAuto.json();
  assert.equal(storAutoJson.subscription.renewal_mode, 'auto');
  assert.equal(storAutoJson.subscription.paymentMethod.last4, '4081');

  // 4E. Anti-IDOR : Bob ne peut PAS modifier l'abonnement d'Alice ni supprimer sa carte !
  const bobHackSub = await callApi(`/api/billing/subscriptions/${verVisa.subscription.id}/renewal-mode`, {
    method: 'PATCH',
    token: 'token-bob',
    body: { renewalMode: 'auto' },
  });
  assert.equal(bobHackSub.status, 404);
  const bobHackPm = await callApi(`/api/billing/payment-methods/${verVisa.paymentMethod.id}`, {
    method: 'DELETE',
    token: 'token-bob',
  });
  assert.equal(bobHackPm.status, 404);

  // 4F. GET /api/billing/my-subscriptions renvoie les abonnements + cartes masquées + événements
  const mySubs = await (await callApi('/api/billing/my-subscriptions', { token: 'token-alice' })).json();
  assert.equal(mySubs.success, true);
  assert.equal(mySubs.subscriptions.length, 2);
  assert.equal(mySubs.paymentMethods.length, 1);
  assert.equal(mySubs.paymentMethods[0].last4, '4081');
  assert.equal((mySubs.paymentMethods[0] as any).authorization_code, undefined);
  assert.ok(mySubs.recentEvents.length >= 4);

  // 4G. Alice retire sa carte Visa -> son abonnement Stockage (en auto) repasse automatiquement en 'manual' !
  const delPmRes = await callApi(`/api/billing/payment-methods/${verVisa.paymentMethod.id}`, {
    method: 'DELETE',
    token: 'token-alice',
  });
  assert.equal(delPmRes.status, 200);
  const delPmJson = await delPmRes.json();
  assert.equal(delPmJson.switchedToManualCount, 1);

  const storAfterCardRemoved: any = await db
    .prepare('SELECT renewal_mode, payment_method_id FROM active_subscriptions WHERE id = ?')
    .bind(verWave.subscription.id)
    .first();
  assert.equal(storAfterCardRemoved.renewal_mode, 'manual');
  assert.equal(storAfterCardRemoved.payment_method_id, '');

  // 4H. Achat Infini -> renewal_mode = 'infinite', impossible de passer en auto/manual
  const initInf = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-bob',
      body: { productType: 'app', productId: 'moy_life' },
    })
  ).json();
  verifyData = {
    id: 5003,
    reference: initInf.reference,
    status: 'success',
    amount: 2500000,
    currency: 'XOF',
    channel: 'mobile_money',
    authorization: { bank: 'Orange Money CI', reusable: false },
  };
  const verInf = await (
    await callApi(`/api/payments/paystack/verify?reference=${initInf.reference}`, { token: 'token-bob' })
  ).json();
  assert.equal(verInf.subscription.is_infinite, 1);
  assert.equal(verInf.subscription.renewal_mode, 'infinite');
  assert.equal(verInf.subscription.current_period_end, null);
  assert.equal(verInf.renewalUiConfig.isInfinite, true);
  const tryEditInf = await callApi(`/api/billing/subscriptions/${verInf.subscription.id}/renewal-mode`, {
    method: 'PATCH',
    token: 'token-bob',
    body: { renewalMode: 'manual' },
  });
  assert.equal(tryEditInf.status, 400);

  // 5. Hiérarchie des politiques de relances & blocages (global < product_type < app < subscription)
  const storagePol = await resolveEffectiveBillingPolicy(db, { productType: 'storage', appKey: 'storage' });
  assert.equal(storagePol.scopeType, 'product_type');
  assert.equal(storagePol.gracePeriodDays, 7);
  assert.equal(storagePol.blockScope, 'read_only');

  const moyPol = await resolveEffectiveBillingPolicy(db, { productType: 'app', appKey: 'moyennes' });
  assert.equal(moyPol.scopeType, 'app');
  assert.equal(moyPol.gracePeriodDays, 5);
  assert.equal(moyPol.blockScope, 'service_only');

  // Surcharge individuelle sur un abonnement précis (ex: 14j de grâce + blocage compte entier)
  await db
    .prepare(
      `INSERT INTO billing_policy_rules (id, scope_type, scope_key, label, grace_period_days, block_scope, overdue_interval_hours)
       VALUES ('pol_vip_sub', 'subscription', ?, 'VIP', 14, 'full_account', 72)`
    )
    .bind(verWave.subscription.id)
    .run();
  const vipPol = await resolveEffectiveBillingPolicy(db, {
    productType: 'storage',
    appKey: 'storage',
    subscriptionId: verWave.subscription.id,
  });
  assert.equal(vipPol.scopeType, 'subscription');
  assert.equal(vipPol.gracePeriodDays, 14);
  assert.equal(vipPol.blockScope, 'full_account');
  assert.equal(vipPol.overdueIntervalHours, 72);
});

test('Étapes 4 & 7 — Emails Resend auto + webhook delivered/opened, envoi manuel admin, liaison carte et Moteur Cron complet', async () => {
  const { db, sqlite } = createMockD1();
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      storage_quota_mb REAL DEFAULT 1024
    );
  `);
  await ensurePaystackBillingTables(db);
  await db
    .prepare("INSERT INTO users (id, name, email, phone) VALUES ('u-cron', 'Koffi Kouame', 'koffi@studycloud.ci', '+2250701020304')")
    .run();
  await db
    .prepare(
      `INSERT INTO app_subscription_plans (id, app_key, name, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite)
       VALUES ('moy_cron_auto', 'moyennes', 'Mensuel Auto', 2000, 'XOF', 'auto', 30, 1, 1, 1, 0)`
    )
    .run();
  await db.prepare("UPDATE monetized_apps SET is_paid = 1 WHERE app_key = 'moyennes'").run();

  const sentEmails: Array<{ to: string; subject: string; id: string }> = [];
  let autoChargeShouldFail = false;
  let autoChargeCalls = 0;

  const mockFetch: any = async (url: string, init?: any) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (String(url).includes('api.resend.com/emails')) {
      const msgId = `re_msg_${sentEmails.length + 1}`;
      sentEmails.push({ to: body.to?.[0] || '', subject: body.subject || '', id: msgId });
      return new Response(JSON.stringify({ id: msgId }), { status: 200 });
    }
    if (String(url).includes('/transaction/initialize')) {
      return new Response(
        JSON.stringify({ status: true, data: { access_code: 'AC_LINK', authorization_url: 'https://checkout.paystack.com/AC_LINK', reference: body.reference } }),
        { status: 200 }
      );
    }
    if (String(url).includes('/transaction/verify/')) {
      const ref = String(url).split('/').pop() || '';
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 7771,
            reference: ref,
            status: 'success',
            amount: 10000,
            currency: 'XOF',
            channel: 'card',
            customer: { email: 'koffi@studycloud.ci' },
            metadata: { purpose: 'card_link', user_id: 'u-cron' },
            authorization: {
              authorization_code: 'AUTH_CRON_VISA_888',
              brand: 'visa',
              card_type: 'visa',
              last4: '8888',
              exp_month: '08',
              exp_year: '2029',
              bank: 'NSIA CI',
              country_code: 'CI',
              signature: 'SIG_KOFFI_8888',
              reusable: true,
            },
          },
        }),
        { status: 200 }
      );
    }
    if (String(url).includes('/transaction/charge_authorization')) {
      autoChargeCalls++;
      if (autoChargeShouldFail) {
        return new Response(
          JSON.stringify({ status: false, message: 'Insufficient funds', data: { status: 'failed', gateway_response: 'Insufficient funds' } }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 8800 + autoChargeCalls,
            reference: body.reference,
            status: 'success',
            amount: body.amount,
            currency: body.currency,
            channel: 'card',
            customer: { email: body.email },
            authorization: {
              authorization_code: 'AUTH_CRON_VISA_888',
              brand: 'visa',
              last4: '8888',
              reusable: true,
            },
          },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ status: false }), { status: 404 });
  };

  const rawEnv = {
    STUDYCLOUD_PAYSTACK_SECRET_KEY: 'sk_test_cron',
    RESEND_API_KEY: 're_test_key',
    ADMIN_API_SECRET: 'test_admin_secret_cron',
  };
  const callApi = async (path: string, opts: { method?: string; body?: any; token?: string; admin?: boolean } = {}) => {
    const req = new Request(`https://api-worker.dkd-technologies.com${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.admin || path.startsWith('/api/admin/') ? { 'X-Admin-Key': rawEnv.ADMIN_API_SECRET } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const res = await handlePaystackBillingRoutes(req, new URL(req.url), new URL(req.url).pathname, req.method, {
      db,
      rawEnv,
      origin: '*',
      fetchFn: mockFetch,
      getAuthUser: async (r) =>
        r.headers.get('Authorization') === 'Bearer token-koffi'
          ? { userId: 'u-cron', email: 'koffi@studycloud.ci', name: 'Koffi Kouame' }
          : null,
      jsonResponse: (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }),
      errorResponse: (m, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } }),
    });
    assert.ok(res);
    return res!;
  };

  // 1. Admin crée un abonnement actif pour Koffi + envoie email de confirmation
  const createRes = await (
    await callApi('/api/admin/billing/subscriptions/create', {
      method: 'POST',
      body: {
        user_query: 'koffi@studycloud.ci',
        product_type: 'app',
        app_key: 'moyennes',
        app_name: 'Moyennes',
        plan_id: 'moy_cron_auto',
        plan_name: 'Mensuel Auto',
        renewal_mode: 'auto',
        price_amount: 2000,
        currency: 'XOF',
        duration_days: 30,
        sendEmail: true,
      },
    })
  ).json();
  assert.equal(createRes.success, true);
  const subId = createRes.subscription.id;
  assert.equal(sentEmails.length, 1);

  // 2. Webhook Resend -> delivered puis opened met à jour billing_email_logs et active_subscriptions.last_email_status
  await callApi('/api/webhooks/resend', {
    method: 'POST',
    body: { type: 'email.delivered', data: { email_id: sentEmails[0].id } },
  });
  await callApi('/api/webhooks/resend', {
    method: 'POST',
    body: { type: 'email.opened', data: { email_id: sentEmails[0].id } },
  });
  const subAfterOpen: any = await db.prepare('SELECT last_email_status FROM active_subscriptions WHERE id = ?').bind(subId).first();
  assert.equal(subAfterOpen.last_email_status, 'opened');

  // 3. Utilisateur lie une carte Visa plus tard (`link-init` + `link-verify`) -> carte liée + auto activé
  const linkInit = await (
    await callApi('/api/billing/payment-methods/link-init', {
      method: 'POST',
      token: 'token-koffi',
      body: { subscriptionId: subId, enableAuto: true },
    })
  ).json();
  assert.equal(linkInit.success, true);
  const linkVer = await (
    await callApi('/api/billing/payment-methods/link-verify', {
      method: 'POST',
      token: 'token-koffi',
      body: { reference: linkInit.reference, subscriptionId: subId, enableAuto: true },
    })
  ).json();
  assert.equal(linkVer.success, true);
  assert.equal(linkVer.paymentMethod.last4, '8888');
  assert.equal(linkVer.subscription.renewal_mode, 'auto');

  // 4. Admin personnalise la politique Moyennes : intervalle 24h, grâce 2j, blocage service_only
  const polSave = await (
    await callApi('/api/admin/billing/policies/save', {
      method: 'POST',
      body: {
        scope_type: 'app',
        scope_key: 'moyennes',
        pre_renewal_days: 3,
        grace_period_days: 2,
        overdue_interval_hours: 24,
        max_overdue_reminders: 3,
        max_auto_retries: 2,
        retry_schedule_hours: '24,48',
        block_scope: 'service_only',
      },
    })
  ).json();
  assert.equal(polSave.success, true);

  // 5. Phase 1 Cron : Pré-alerte à J-2 avant expiration
  const expIso = '2026-12-10T10:00:00.000Z';
  await db
    .prepare('UPDATE active_subscriptions SET current_period_end = ?, next_billing_at = ?, grace_until = NULL WHERE id = ?')
    .bind(expIso, expIso, subId)
    .run();
  const cronPre = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-08T12:00:00.000Z' });
  assert.equal(cronPre.preRenewalSent, 1);

  // 6. Phase 2 Cron (échec carte) : passage en grâce + email payment_failed + retry_count = 1
  autoChargeShouldFail = true;
  const cronFail = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-10T11:00:00.000Z' });
  assert.equal(cronFail.autoFailed, 1);
  const subInGrace: any = await db.prepare('SELECT status, retry_count FROM active_subscriptions WHERE id = ?').bind(subId).first();
  assert.equal(subInGrace.status, 'grace');
  assert.equal(Number(subInGrace.retry_count), 1);

  // 7. Phase 4 Cron : 10h plus tard (< 24h intervalle) -> AUCUNE relance ; 26h plus tard (>= 24h) -> 1 relance overdue_reminder !
  const cronTooSoon = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-10T20:00:00.000Z' });
  assert.equal(cronTooSoon.remindersSent, 0);
  // Décaler next_billing_at pour tester spécifiquement la Phase 4 (relance) sans déclencher le retry carte Phase 2 en même temps
  await db.prepare("UPDATE active_subscriptions SET next_billing_at = '2026-12-12T10:00:00.000Z' WHERE id = ?").bind(subId).run();
  const cronRemind = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-11T14:00:00.000Z' });
  assert.equal(cronRemind.remindersSent, 1);

  // 8. Phase 5 Cron : fin de période de grâce dépassée -> BLOCAGE automatique + email service_blocked + /api/apps/access/moyennes bloqué !
  await db.prepare("UPDATE active_subscriptions SET retry_count = 5 WHERE id = ?").bind(subId).run();
  const cronBlock = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-13T12:00:00.000Z' });
  assert.equal(cronBlock.blocked, 1);
  const subBlocked: any = await db.prepare('SELECT status, block_scope FROM active_subscriptions WHERE id = ?').bind(subId).first();
  assert.equal(subBlocked.status, 'blocked');
  assert.equal(subBlocked.block_scope, 'service_only');

  const accessBlocked = await (await callApi('/api/apps/access/moyennes', { token: 'token-koffi' })).json();
  assert.equal(accessBlocked.allowed, false);
  assert.equal(accessBlocked.billingBlocked, true);

  // 9. Admin clique sur « Envoyer un rappel manuel » -> envoi immédiat + journalisé
  const adminManualEmail = await (
    await callApi(`/api/admin/billing/subscriptions/${subId}/send-email`, {
      method: 'POST',
      body: { emailType: 'overdue_reminder', customMessage: 'Merci de régulariser avant vendredi.' },
    })
  ).json();
  assert.equal(adminManualEmail.success, true);
  assert.equal(adminManualEmail.status, 'sent');

  // 10. Auto-charge réussit à la tentative suivante (R1) quand la carte est réapprovisionnée -> réactivation + idempotence anti-double charge !
  autoChargeShouldFail = false;
  await db
    .prepare("UPDATE active_subscriptions SET status = 'grace', retry_count = 1, next_billing_at = '2026-12-14T10:00:00.000Z', grace_until = '2026-12-20T10:00:00.000Z' WHERE id = ?")
    .bind(subId)
    .run();
  const callsBefore = autoChargeCalls;
  const cronRenewOk = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-14T11:00:00.000Z' });
  assert.equal(cronRenewOk.autoCharged, 1);
  assert.equal(autoChargeCalls, callsBefore + 1);
  const subReactivated: any = await db.prepare('SELECT status, retry_count FROM active_subscriptions WHERE id = ?').bind(subId).first();
  assert.equal(subReactivated.status, 'active');
  assert.equal(Number(subReactivated.retry_count), 0);

  // Relancer le Cron immédiatement à la même date -> 0 double facturation !
  const cronIdempotent = await executeBillingCronJob(db, rawEnv, { fetchFn: mockFetch, nowIso: '2026-12-14T11:05:00.000Z' });
  assert.equal(cronIdempotent.autoCharged, 0);
  assert.equal(autoChargeCalls, callsBefore + 1);
});

test('Cartes enregistrées — Permissions par service, remboursement auto 100 FCFA, achat Visa ciblé, pré-autorisation, recharge auto IA à 0 (anti-boucle 24h) et vue Admin Cartes', async () => {
  const { db } = createMockD1();
  await ensurePaystackBillingTables(db);

  await db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT)').run();
  await db.prepare(`INSERT INTO users (id, name, email, phone) VALUES ('u-card', 'Awa Diallo', 'awa@studycloud.ci', '+2250701020304')`).run();
  await db
    .prepare(
      `INSERT INTO storage_subscription_plans (id, name, storage_amount, storage_mb, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite, is_active)
       VALUES ('stor_card_50', 'Stockage 50 Go', '50 Go', 51200, 3000, 'XOF', 'auto', 30, 1, 1, 1, 0, 1)`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO ai_subscription_plans (id, name, credits_or_words, credits_count, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite, is_active)
       VALUES ('ai_card_pro', 'Pack IA Pro 200', '200 crédits', 200, 2500, 'XOF', 'auto', 30, 1, 1, 1, 0, 1)`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO app_subscription_plans (id, app_key, name, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite, is_active)
       VALUES ('moy_card_m', 'moyennes', 'Moyennes Mensuel', 1500, 'XOF', 'auto', 30, 1, 1, 1, 0, 1)`
    )
    .run();

  const refundCalls: any[] = [];
  const chargeCalls: any[] = [];
  let pendingMeta: Record<string, any> = {};
  let nextVerifyChannel: 'card' | 'mobile_money' = 'card';
  let nextVerifyAmountMinor = 10000;

  const mockFetch: typeof fetch = async (input: any, init?: any) => {
    const urlStr = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (urlStr.includes('api.resend.com/emails')) {
      return new Response(JSON.stringify({ id: `re_card_${Date.now()}` }), { status: 200 });
    }
    if (urlStr.endsWith('/transaction/initialize')) {
      pendingMeta = body.metadata || {};
      nextVerifyAmountMinor = Number(body.amount || 10000);
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.com/${body.reference}`,
            access_code: `acc_${body.reference}`,
            reference: body.reference,
          },
        }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/transaction/verify/')) {
      const ref = urlStr.split('/transaction/verify/')[1];
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 99001,
            reference: ref,
            status: 'success',
            amount: nextVerifyAmountMinor,
            currency: 'XOF',
            channel: nextVerifyChannel,
            customer: { email: 'awa@studycloud.ci' },
            metadata: pendingMeta,
            authorization:
              nextVerifyChannel === 'card'
                ? {
                    authorization_code: 'AUTH_AWA_5544',
                    brand: 'visa',
                    card_type: 'visa debit',
                    last4: '5544',
                    exp_month: '09',
                    exp_year: '2029',
                    bank: 'SGCI',
                    country_code: 'CI',
                    signature: 'SIG_AWA_5544',
                    reusable: true,
                  }
                : { bank: 'Wave CI', reusable: false },
          },
        }),
        { status: 200 }
      );
    }
    if (urlStr.endsWith('/refund')) {
      refundCalls.push(body);
      return new Response(
        JSON.stringify({
          status: true,
          message: 'Refund has been queued for processing',
          data: { status: 'processed', transaction: body.transaction },
        }),
        { status: 200 }
      );
    }
    if (urlStr.endsWith('/transaction/charge_authorization')) {
      chargeCalls.push(body);
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 99500 + chargeCalls.length,
            reference: body.reference,
            status: 'success',
            amount: body.amount,
            currency: body.currency || 'XOF',
            channel: 'card',
            customer: { email: body.email },
            authorization: {
              authorization_code: body.authorization_code,
              brand: 'visa',
              last4: '5544',
              reusable: true,
            },
          },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ status: false }), { status: 404 });
  };

  const rawEnv = {
    PAYSTACK_SECRET_KEY: 'sk_test_card_perms',
    RESEND_API_KEY: 're_test_card',
    ADMIN_API_SECRET: 'test_admin_secret_cards',
  };
  const callApi = async (path: string, opts: { method?: string; token?: string; body?: any } = {}) => {
    const req = new Request(`https://api-worker.dkd-technologies.com${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(path.startsWith('/api/admin/') ? { 'X-Admin-Key': rawEnv.ADMIN_API_SECRET } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const res = await handlePaystackBillingRoutes(req, new URL(req.url), new URL(req.url).pathname, req.method, {
      db,
      rawEnv,
      origin: '*',
      fetchFn: mockFetch,
      getAuthUser: async (r) =>
        r.headers.get('Authorization') === 'Bearer token-awa'
          ? { userId: 'u-card', email: 'awa@studycloud.ci', name: 'Awa Diallo' }
          : null,
      jsonResponse: (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }),
      errorResponse: (m, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } }),
    });
    assert.ok(res);
    return res!;
  };

  // 1. Awa ajoute sa carte depuis la modale StudyCloud en cochant Stockage + Crédits IA (avec recharge auto à 0), mais PAS Applications
  const linkInit = await (
    await callApi('/api/billing/payment-methods/link-init', {
      method: 'POST',
      token: 'token-awa',
      body: { autoStorage: true, autoAi: true, autoAiOnDepleted: true, autoApps: [] },
    })
  ).json();
  assert.equal(linkInit.success, true);
  assert.equal(linkInit.autoRefundEnabled, true);

  nextVerifyChannel = 'card';
  const linkVer = await (
    await callApi('/api/billing/payment-methods/link-verify', {
      method: 'POST',
      token: 'token-awa',
      body: {
        reference: linkInit.reference,
        autoStorage: true,
        autoAi: true,
        autoAiOnDepleted: true,
        autoApps: [],
      },
    })
  ).json();
  assert.equal(linkVer.success, true);
  assert.equal(linkVer.refunded, true, 'L’empreinte de 100 FCFA doit être remboursée automatiquement');
  assert.equal(refundCalls.length, 1);
  assert.equal(refundCalls[0].transaction, linkInit.reference);
  assert.equal(linkVer.paymentMethod.autoStorage, true);
  assert.equal(linkVer.paymentMethod.autoAi, true);
  assert.equal(linkVer.paymentMethod.autoAiOnDepleted, true);
  assert.deepEqual(linkVer.paymentMethod.autoApps, []);
  const pmId = linkVer.paymentMethod.id;

  // 2. Awa s'abonne à Stockage 50 Go via Wave -> sa carte déjà enregistrée autorise Stockage => rattachée en auto !
  nextVerifyChannel = 'mobile_money';
  const initStor = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-awa',
      body: { productType: 'storage', productId: 'stor_card_50' },
    })
  ).json();
  const verStor = await (
    await callApi(`/api/payments/paystack/verify?reference=${initStor.reference}`, { token: 'token-awa' })
  ).json();
  assert.equal(verStor.verified, true);
  assert.equal(verStor.subscription.renewal_mode, 'auto');
  assert.equal(verStor.subscription.payment_method_id, pmId);

  // 3. Awa s'abonne à Moyennes via Wave -> sa carte n'autorise PAS Applications => reste 'manual' !
  const initMoy = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-awa',
      body: { productType: 'app', productId: 'moy_card_m' },
    })
  ).json();
  const verMoy = await (
    await callApi(`/api/payments/paystack/verify?reference=${initMoy.reference}`, { token: 'token-awa' })
  ).json();
  assert.equal(verMoy.verified, true);
  assert.equal(verMoy.subscription.renewal_mode, 'manual');
  assert.equal(verMoy.subscription.payment_method_id, '');

  // 4. Awa décoche Stockage et coche Applications via PATCH /permissions -> Stockage passe en manuel & Moyennes passe en auto !
  const patchPerm = await (
    await callApi(`/api/billing/payment-methods/${pmId}/permissions`, {
      method: 'PATCH',
      token: 'token-awa',
      body: { autoStorage: false, autoAi: true, autoAiOnDepleted: true, autoApps: ['*'] },
    })
  ).json();
  assert.equal(patchPerm.success, true);
  assert.equal(patchPerm.switchedToManualCount, 1);
  assert.equal(patchPerm.switchedToAutoCount, 1);

  const storSubRow: any = await db.prepare('SELECT renewal_mode FROM active_subscriptions WHERE id = ?').bind(verStor.subscription.id).first();
  const moySubRow: any = await db.prepare('SELECT renewal_mode, payment_method_id FROM active_subscriptions WHERE id = ?').bind(verMoy.subscription.id).first();
  assert.equal(storSubRow.renewal_mode, 'manual');
  assert.equal(moySubRow.renewal_mode, 'auto');
  assert.equal(moySubRow.payment_method_id, pmId);

  // 5. Recharge automatique Crédits IA quand le solde tombe à 0 + garde-fou anti-boucle 24h !
  nextVerifyChannel = 'card';
  const initAi = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-awa',
      body: { productType: 'ai', productId: 'ai_card_pro', channelOnly: 'card' },
    })
  ).json();
  const verAi = await (
    await callApi(`/api/payments/paystack/verify?reference=${initAi.reference}`, { token: 'token-awa' })
  ).json();
  assert.equal(verAi.verified, true);
  assert.equal(verAi.subscription.renewal_mode, 'auto');

  // Simuler épuisement complet du solde IA (credits_balance = 0)
  await db.prepare('UPDATE user_ai_credits SET credits_balance = 0, remaining_credits = 0, purchased_remaining = 0, gift_remaining = 0 WHERE user_id = ?').bind('u-card').run();
  const rech1 = await tryAutoRechargeDepletedAiCredits(db, rawEnv, 'u-card', { fetchFn: mockFetch, nowIso: '2026-12-20T10:00:00.000Z' });
  assert.equal(rech1.triggered, true);
  assert.equal(rech1.recharged, true);
  assert.equal(chargeCalls.length, 1);
  const balAfterRech: any = await db.prepare('SELECT credits_balance FROM user_ai_credits WHERE user_id = ?').bind('u-card').first();
  assert.equal(Number(balAfterRech.credits_balance), 200);

  // Même si le solde retombe à 0 2 heures plus tard -> bloqué par le garde-fou 24h !
  await db.prepare('UPDATE user_ai_credits SET credits_balance = 0 WHERE user_id = ?').bind('u-card').run();
  const rech2 = await tryAutoRechargeDepletedAiCredits(db, rawEnv, 'u-card', { fetchFn: mockFetch, nowIso: '2026-12-20T12:00:00.000Z' });
  assert.equal(rech2.triggered, false);
  assert.equal(chargeCalls.length, 1);

  // 6. Tableau de bord Admin GET /api/admin/billing/subscriptions expose `paymentMethods` avec utilisateur + permissions + abonnements liés
  const adminRes = await (await callApi('/api/admin/billing/subscriptions')).json();
  assert.equal(adminRes.success, true);
  assert.equal(adminRes.stats.savedCards, 1);
  assert.equal(adminRes.paymentMethods.length, 1);
  assert.equal(adminRes.paymentMethods[0].userName, 'Awa Diallo');
  assert.equal(adminRes.paymentMethods[0].last4, '5544');
  assert.equal(adminRes.paymentMethods[0].autoAiOnDepleted, true);
  assert.ok(adminRes.paymentMethods[0].linkedActiveCount >= 2);
});

test('Audit de sécurité — Anti-remboursement abusif link-verify, Auth Admin X-Admin-Key, Svix Resend HMAC, Chargeback/Refund Paystack, Garde-fous & Erreurs FR', async () => {
  const { db } = createMockD1();
  await ensurePaystackBillingTables(db);
  await db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT)').run();
  await db.prepare(`INSERT INTO users (id, name, email, phone) VALUES ('u-sec', 'Sec User', 'sec@studycloud.ci', '+2250700000000')`).run();
  await db
    .prepare(
      `INSERT INTO app_subscription_plans (id, app_key, name, price, primary_currency, billing_mode, duration_days, is_auto_billing, allow_auto, allow_manual, is_infinite, is_active)
       VALUES ('moy_sec', 'moyennes', 'Moyennes Pro', 2500, 'XOF', 'manual', 30, 0, 0, 1, 0, 1)`
    )
    .run();

  const secretKey = 'sk_test_security_suite_key';
  const adminSecret = 'super_secret_admin_key_64_chars';
  const resendSecretB64 = btoa('studycloud-resend-webhook-key-32b');
  const resendSecret = `whsec_${resendSecretB64}`;
  const rawEnv: Record<string, any> = {
    STUDYCLOUD_PAYSTACK_SECRET_KEY: secretKey,
    ADMIN_API_SECRET: adminSecret,
    RESEND_WEBHOOK_SECRET: resendSecret,
    RESEND_API_KEY: 're_sec_test',
  };

  let refundCalls = 0;
  let verifyBehavior: Record<string, any> = {};

  const mockFetch: typeof fetch = async (input: any, init?: any) => {
    const urlStr = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (urlStr.endsWith('/transaction/initialize')) {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.com/${body.reference}`,
            access_code: `acc_${body.reference}`,
            reference: body.reference,
          },
        }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/transaction/verify/')) {
      const ref = urlStr.split('/transaction/verify/')[1];
      const override = verifyBehavior[ref] || {};
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 55100,
            reference: ref,
            status: 'success',
            amount: override.amount ?? 10000,
            currency: override.currency ?? 'XOF',
            channel: override.channel ?? 'card',
            customer: { email: 'sec@studycloud.ci' },
            metadata: override.metadata ?? { purpose: 'card_link', user_id: 'u-sec' },
            authorization: {
              authorization_code: 'AUTH_SEC_1234',
              brand: 'visa',
              last4: '1234',
              exp_month: '12',
              exp_year: '2029',
              bank: 'NSIA',
              country_code: 'CI',
              signature: 'SIG_SEC_1234',
              reusable: true,
            },
          },
        }),
        { status: 200 }
      );
    }
    if (urlStr.endsWith('/refund')) {
      refundCalls++;
      return new Response(JSON.stringify({ status: true, data: { status: 'processed' } }), { status: 200 });
    }
    if (urlStr.includes('api.resend.com/emails')) {
      return new Response(JSON.stringify({ id: 're_svix_test_001' }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: false }), { status: 404 });
  };

  const callApi = async (
    path: string,
    opts: { method?: string; token?: string; body?: any; rawBody?: string; headers?: Record<string, string>; envOverride?: Record<string, any> } = {}
  ) => {
    const method = opts.method || 'GET';
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    let bodyInit: string | undefined;
    if (opts.rawBody !== undefined) {
      bodyInit = opts.rawBody;
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    } else if (opts.body !== undefined) {
      bodyInit = JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
    }
    const req = new Request(`https://api-worker.dkd-technologies.com${path}`, { method, headers, body: bodyInit });
    const res = await handlePaystackBillingRoutes(req, new URL(req.url), new URL(req.url).pathname, method, {
      db,
      rawEnv: opts.envOverride || rawEnv,
      origin: '*',
      fetchFn: mockFetch,
      getAuthUser: async (r) =>
        r.headers.get('Authorization') === 'Bearer token-sec'
          ? { userId: 'u-sec', email: 'sec@studycloud.ci', name: 'Sec User' }
          : null,
      jsonResponse: (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }),
      errorResponse: (m, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } }),
    });
    assert.ok(res);
    return res!;
  };

  // --- FIX #1 : Anti-remboursement abusif sur /link-verify ---
  // 1a. Refuser toute référence SC-PAY-... (achat réel) -> 400 + 0 refund !
  const badPrefixRes = await callApi('/api/billing/payment-methods/link-verify', {
    method: 'POST',
    token: 'token-sec',
    body: { reference: 'SC-PAY-123456-ABCDEF' },
  });
  assert.equal(badPrefixRes.status, 400);
  assert.equal(refundCalls, 0);

  // 1b. Refuser une référence SC-CARD-... dont le purpose n'est pas 'card_link'
  verifyBehavior['SC-CARD-BADPURPOSE'] = { metadata: { purpose: 'subscription', user_id: 'u-sec' }, amount: 10000 };
  const badPurposeRes = await callApi('/api/billing/payment-methods/link-verify', {
    method: 'POST',
    token: 'token-sec',
    body: { reference: 'SC-CARD-BADPURPOSE' },
  });
  assert.equal(badPurposeRes.status, 400);
  assert.equal(refundCalls, 0);

  // 1c. Refuser un montant différent de 10000 (100 FCFA)
  verifyBehavior['SC-CARD-BADAMOUNT'] = { metadata: { purpose: 'card_link', user_id: 'u-sec' }, amount: 250000 };
  const badAmountRes = await callApi('/api/billing/payment-methods/link-verify', {
    method: 'POST',
    token: 'token-sec',
    body: { reference: 'SC-CARD-BADAMOUNT' },
  });
  assert.equal(badAmountRes.status, 400);
  assert.equal(refundCalls, 0);

  // 1d. Refuser metadata sans user_id (anti-IDOR strict)
  verifyBehavior['SC-CARD-NOUSER'] = { metadata: { purpose: 'card_link' }, amount: 10000 };
  const noUserRes = await callApi('/api/billing/payment-methods/link-verify', {
    method: 'POST',
    token: 'token-sec',
    body: { reference: 'SC-CARD-NOUSER' },
  });
  assert.equal(noUserRes.status, 403);
  assert.equal(refundCalls, 0);

  // 1e. Empreinte légitime remboursée 1 seule fois, puis rejeu bloqué (anti-replay) !
  verifyBehavior['SC-CARD-LEGIT-001'] = { metadata: { purpose: 'card_link', user_id: 'u-sec' }, amount: 10000 };
  const okLink1 = await (
    await callApi('/api/billing/payment-methods/link-verify', {
      method: 'POST',
      token: 'token-sec',
      body: { reference: 'SC-CARD-LEGIT-001', autoStorage: true },
    })
  ).json();
  assert.equal(okLink1.success, true);
  assert.equal(okLink1.refunded, true);
  assert.equal(refundCalls, 1);

  const replayLink = await (
    await callApi('/api/billing/payment-methods/link-verify', {
      method: 'POST',
      token: 'token-sec',
      body: { reference: 'SC-CARD-LEGIT-001', autoStorage: true },
    })
  ).json();
  assert.equal(replayLink.success, true);
  assert.equal(replayLink.refunded, false);
  assert.equal(replayLink.refundStatus, 'already_processed');
  assert.equal(refundCalls, 1, 'Le rejeu ne doit JAMAIS relancer /refund');

  // --- FIX #2 : Auth Admin stricte (X-Admin-Key) sur /api/admin/billing/* & /api/payments/admin/reverify ---
  const noKeyAdmin = await callApi('/api/admin/billing/subscriptions');
  assert.equal(noKeyAdmin.status, 401);
  const wrongKeyAdmin = await callApi('/api/admin/billing/subscriptions', {
    headers: { 'X-Admin-Key': 'wrong_key' },
  });
  assert.equal(wrongKeyAdmin.status, 401);
  const noEnvAdmin = await callApi('/api/admin/billing/subscriptions', {
    headers: { 'X-Admin-Key': adminSecret },
    envOverride: { STUDYCLOUD_PAYSTACK_SECRET_KEY: secretKey },
  });
  assert.equal(noEnvAdmin.status, 503);
  const okKeyAdmin = await callApi('/api/admin/billing/subscriptions', {
    headers: { 'X-Admin-Key': adminSecret },
  });
  assert.equal(okKeyAdmin.status, 200);
  const noKeyReverify = await callApi('/api/payments/admin/reverify', {
    method: 'POST',
    body: { reference: 'SC-PAY-XYZ' },
  });
  assert.equal(noKeyReverify.status, 401);

  // --- FIX #4 : Vérification cryptographique Svix HMAC-SHA256 sur /api/webhooks/resend ---
  await db
    .prepare(
      `INSERT INTO billing_email_logs (id, user_id, subscription_id, email_to, email_type, subject, resend_message_id, delivery_status)
       VALUES ('log_svix_1', 'u-sec', '', 'sec@studycloud.ci', 'purchase_confirmed', 'Test', 're_svix_test_001', 'sent')`
    )
    .run();
  const resendBody = JSON.stringify({ type: 'email.opened', data: { email_id: 're_svix_test_001' } });
  const unsignedResend = await callApi('/api/webhooks/resend', { method: 'POST', rawBody: resendBody });
  assert.equal(unsignedResend.status, 401);
  const forgedResend = await callApi('/api/webhooks/resend', {
    method: 'POST',
    rawBody: resendBody,
    headers: { 'svix-id': 'msg_1', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,Zm9yZ2Vk' },
  });
  assert.equal(forgedResend.status, 401);
  const oldTs = String(Math.floor(Date.now() / 1000) - 600);
  const expiredSig = await computeResendSvixSignature(resendBody, 'msg_old', oldTs, resendSecret);
  const expiredResend = await callApi('/api/webhooks/resend', {
    method: 'POST',
    rawBody: resendBody,
    headers: { 'svix-id': 'msg_old', 'svix-timestamp': oldTs, 'svix-signature': expiredSig },
  });
  assert.equal(expiredResend.status, 401);

  const validTs = String(Math.floor(Date.now() / 1000));
  const validSig = await computeResendSvixSignature(resendBody, 'msg_ok_1', validTs, resendSecret);
  const okResend = await callApi('/api/webhooks/resend', {
    method: 'POST',
    rawBody: resendBody,
    headers: { 'svix-id': 'msg_ok_1', 'svix-timestamp': validTs, 'svix-signature': validSig },
  });
  assert.equal(okResend.status, 200);
  const updatedLog: any = await db.prepare('SELECT delivery_status FROM billing_email_logs WHERE id = ?').bind('log_svix_1').first();
  assert.equal(updatedLog.delivery_status, 'opened');

  // --- FIX #5 : Webhook Paystack charge.dispute.create / refund.processed révoque l'abonnement payé, mais ignore SC-CARD-* ---
  const initSub = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-sec',
      body: { productType: 'app', productId: 'moy_sec' },
    })
  ).json();
  verifyBehavior[initSub.reference] = { amount: 250000, currency: 'XOF', channel: 'card', metadata: { user_id: 'u-sec' } };
  const verSub = await (await callApi(`/api/payments/paystack/verify?reference=${initSub.reference}`, { token: 'token-sec' })).json();
  assert.equal(verSub.verified, true);
  const subId = verSub.subscription.id;

  // Remboursement de l'empreinte SC-CARD-* -> NE DOIT PAS bloquer l'abonnement !
  const cardRefundPayload = JSON.stringify({ event: 'refund.processed', data: { transaction_reference: 'SC-CARD-LEGIT-001' } });
  const cardRefundSig = await computePaystackHmacSha512Hex(secretKey, cardRefundPayload);
  await callApi('/api/payments/paystack/webhook', {
    method: 'POST',
    rawBody: cardRefundPayload,
    headers: { 'x-paystack-signature': cardRefundSig },
  });
  const subAfterCardRef: any = await db.prepare('SELECT status FROM active_subscriptions WHERE id = ?').bind(subId).first();
  assert.equal(subAfterCardRef.status, 'active');

  // Litige bancaire (chargeback) sur l'achat réel -> BLOQUE immédiatement l'abonnement + révoque l'entitlement !
  const disputePayload = JSON.stringify({ event: 'charge.dispute.create', data: { transaction: { reference: initSub.reference } } });
  const disputeSig = await computePaystackHmacSha512Hex(secretKey, disputePayload);
  await callApi('/api/payments/paystack/webhook', {
    method: 'POST',
    rawBody: disputePayload,
    headers: { 'x-paystack-signature': disputeSig },
  });
  const subAfterDispute: any = await db.prepare('SELECT status FROM active_subscriptions WHERE id = ?').bind(subId).first();
  assert.equal(subAfterDispute.status, 'blocked');
  const entAfterDispute: any = await db
    .prepare("SELECT status FROM user_app_entitlements WHERE user_id = 'u-sec' AND app_key = 'moyennes'")
    .first();
  assert.equal(entAfterDispute.status, 'revoked');

  // --- FIX #3 : evaluateUserBillingGuard détecte précisément full_account / read_only / service_only ---
  await db.prepare("UPDATE active_subscriptions SET block_scope = 'full_account' WHERE id = ?").bind(subId).run();
  const guardFull = await evaluateUserBillingGuard(db, 'u-sec');
  assert.equal(guardFull.fullAccountBlocked, true);
  assert.equal(guardFull.blockedSubscriptions.length, 1);

  await db.prepare("UPDATE active_subscriptions SET block_scope = 'read_only' WHERE id = ?").bind(subId).run();
  const guardRo = await evaluateUserBillingGuard(db, 'u-sec');
  assert.equal(guardRo.fullAccountBlocked, false);
  assert.equal(guardRo.readOnlyBlocked, true);

  // --- FIX #5b : Traduction FR des erreurs Paystack ---
  const frMsg = translatePaystackErrorFr(
    'Declined. Please use the test mobile money number since you are doing a test transaction.'
  );
  assert.ok(frMsg.includes('Mode Test Paystack') && frMsg.includes('07 00 00 00 00'));
});

test('Carte Maîtresse Stockage D1 : config pas admin, refus downgrade, prorata milieu de mois, renouvellement sans doublon et synchro booster', async () => {
  const { db } = createMockD1();
  await ensurePaystackBillingTables(db);
  await db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT)').run();

  await db
    .prepare(
      `INSERT INTO users (id, name, email, phone) VALUES ('u-master', 'Koffi Kouame', 'koffi@studycloud.ci', '0707070707')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO storage_subscription_plans (id, name, storage_amount, storage_mb, price, primary_currency, billing_mode, duration_days, is_active)
       VALUES ('stor_base_500', 'PACK 500 MO', '500 Mo', 500, 500, 'XOF', 'manual', 30, 1)`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO storage_subscription_plans (id, name, storage_amount, storage_mb, price, primary_currency, billing_mode, duration_days, is_active)
       VALUES ('stor_boost_200', 'BOOSTER +200 MO PROMO', '200 Mo', 200, 150, 'XOF', 'manual', 30, 1)`
    )
    .run();

  const initAmounts: Record<string, number> = {};
  const mockFetch: typeof fetch = async (input, init) => {
    const urlStr = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (urlStr.endsWith('/transaction/initialize')) {
      initAmounts[body.reference] = Number(body.amount);
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.com/${body.reference}`,
            access_code: `AC_${body.reference}`,
            reference: body.reference,
          },
        }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/transaction/verify/')) {
      const ref = urlStr.split('/transaction/verify/')[1];
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 777001,
            reference: ref,
            status: 'success',
            amount: initAmounts[ref] || 0,
            currency: 'XOF',
            channel: 'mobile_money',
            customer: { email: 'koffi@studycloud.ci' },
            metadata: { user_id: 'u-master' },
          },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ status: false }), { status: 404 });
  };

  const rawEnv = {
    PAYSTACK_SECRET_KEY: 'sk_test_master_card',
    ADMIN_API_SECRET: 'test_admin_master_secret',
  };

  const callApi = async (path: string, opts: { method?: string; token?: string; body?: any } = {}) => {
    const req = new Request(`https://api-worker.dkd-technologies.com${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(path.startsWith('/api/admin/') ? { 'X-Admin-Key': rawEnv.ADMIN_API_SECRET } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const res = await handlePaystackBillingRoutes(req, new URL(req.url), new URL(req.url).pathname, req.method, {
      db,
      rawEnv,
      origin: '*',
      fetchFn: mockFetch,
      getAuthUser: async (r) =>
        r.headers.get('Authorization') === 'Bearer token-koffi'
          ? { userId: 'u-master', email: 'koffi@studycloud.ci', name: 'Koffi Kouame' }
          : null,
      jsonResponse: (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }),
      errorResponse: (m, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } }),
    });
    assert.ok(res);
    return res!;
  };

  // 1. Admin configure le pas = 100 Mo à 100 FCFA / 30 jours + prorata actif dans D1
  const saveCfgRes = await (
    await callApi('/api/admin/billing/storage-master-config', {
      method: 'POST',
      body: {
        enabled: true,
        stepValue: 100,
        stepUnit: 'MB',
        pricePerStep: 100,
        primaryCurrency: 'XOF',
        durationDays: 30,
        maxStorageMb: 2048,
        prorataEnabled: true,
      },
    })
  ).json();
  assert.equal(saveCfgRes.success, true);
  assert.equal(saveCfgRes.config.stepMb, 100);
  assert.equal(saveCfgRes.config.pricePerStepFcfa, 100);

  // 2. Koffi s'abonne au forfait initial 500 Mo (500 FCFA) via la carte secondaire
  const initBase = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-koffi',
      body: { productType: 'storage', productId: 'stor_base_500' },
    })
  ).json();
  assert.equal(initBase.success, true);
  const verBase = await (
    await callApi(`/api/payments/paystack/verify?reference=${initBase.reference}`, { token: 'token-koffi' })
  ).json();
  assert.equal(verBase.verified, true);

  // 3. Anti-doublon : tenter de racheter le MÊME forfait actif `stor_base_500` est refusé (409)
  const dupRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-koffi',
    body: { productType: 'storage', productId: 'stor_base_500' },
  });
  assert.equal(dupRes.status, 409);

  // 4. Refus strict de diminution (500 Mo -> 400 Mo) sur la Carte Maîtresse
  const downRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-koffi',
    body: { productType: 'storage', productId: 'storage_master_upgrade', targetPaidMb: 400 },
  });
  assert.equal(downRes.status, 400);

  // 5. Simulation milieu de mois (15 jours écoulés, 15 jours restants sur 30j) -> Prorata exact !
  const nowMs = Date.now();
  const startIso = new Date(nowMs - 15 * 24 * 60 * 60 * 1000).toISOString();
  const endIso = new Date(nowMs + 15 * 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `UPDATE active_subscriptions SET current_period_start = ?, current_period_end = ?, next_billing_at = ? WHERE user_id = 'u-master' AND product_type = 'storage'`
    )
    .bind(startIso, endIso, endIso)
    .run();

  // Montée en gamme 500 Mo -> 800 Mo (+300 Mo, nouveau tarif mensuel = 800 FCFA, crédit non consommé ~250 FCFA => net ~550 FCFA)
  const quoteRes = await (
    await callApi('/api/billing/storage-master-card/quote', {
      method: 'POST',
      token: 'token-koffi',
      body: { action: 'upgrade', targetPaidMb: 800 },
    })
  ).json();
  assert.equal(quoteRes.success, true);
  assert.equal(quoteRes.quote.prorataApplied, true);
  assert.equal(quoteRes.quote.newMonthlyPriceFcfa, 800);
  assert.ok(quoteRes.quote.unusedCreditFcfa >= 245 && quoteRes.quote.unusedCreditFcfa <= 255);
  assert.ok(quoteRes.quote.amountDueFcfa >= 545 && quoteRes.quote.amountDueFcfa <= 555);

  const initUp = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-koffi',
      body: { productType: 'storage', productId: 'storage_master_upgrade', targetPaidMb: 800 },
    })
  ).json();
  assert.equal(initUp.success, true);
  assert.equal(initUp.amount, quoteRes.quote.amountDueFcfa);

  const verUp = await (
    await callApi(`/api/payments/paystack/verify?reference=${initUp.reference}`, { token: 'token-koffi' })
  ).json();
  assert.equal(verUp.verified, true);

  // Vérifier D1 : quota payant = 800 Mo (pas 1300 Mo !), tarif récurrent = 800 FCFA (pas le prorata 550 !), 1 seul abonnement actif !
  const statusAfterUp = await (
    await callApi('/api/billing/storage-master-card/status', { token: 'token-koffi' })
  ).json();
  assert.equal(statusAfterUp.userState.paidMb, 800);
  assert.equal(statusAfterUp.userState.monthlyPriceFcfa, 800);

  // 6. Renouvellement pur via Carte Maîtresse : paie 800 FCFA et GARDE 800 Mo (ne double PAS en 1600 Mo !)
  const initRenew = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-koffi',
      body: { productType: 'storage', productId: 'storage_master_renew' },
    })
  ).json();
  assert.equal(initRenew.success, true);
  assert.equal(initRenew.amount, 800);
  const verRenew = await (
    await callApi(`/api/payments/paystack/verify?reference=${initRenew.reference}`, { token: 'token-koffi' })
  ).json();
  assert.equal(verRenew.verified, true);

  const statusAfterRenew = await (
    await callApi('/api/billing/storage-master-card/status', { token: 'token-koffi' })
  ).json();
  assert.equal(statusAfterRenew.userState.paidMb, 800);

  // 7. Carte secondaire booster promo (+200 Mo à 150 FCFA) -> synchronisée aussitôt dans la Carte Maîtresse (800 + 200 = 1000 Mo, 950 FCFA/mois) !
  const initBoost = await (
    await callApi('/api/payments/paystack/initialize', {
      method: 'POST',
      token: 'token-koffi',
      body: { productType: 'storage', productId: 'stor_boost_200' },
    })
  ).json();
  assert.equal(initBoost.success, true);
  assert.equal(initBoost.amount, 150);
  const verBoost = await (
    await callApi(`/api/payments/paystack/verify?reference=${initBoost.reference}`, { token: 'token-koffi' })
  ).json();
  assert.equal(verBoost.verified, true);

  const statusAfterBoost = await (
    await callApi('/api/billing/storage-master-card/status', { token: 'token-koffi' })
  ).json();
  assert.equal(statusAfterBoost.userState.paidMb, 1000);
  assert.equal(statusAfterBoost.userState.monthlyPriceFcfa, 950);
});
