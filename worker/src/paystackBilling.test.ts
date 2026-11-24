import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  checkUserAppAccess,
  computeEntitlementExpiration,
  computePaystackHmacSha512Hex,
  ensurePaystackBillingTables,
  extractPaystackNetworkLabel,
  handlePaystackBillingRoutes,
  normalizeBillingMode,
  normalizeIvoryCoastPhone,
  normalizeMobileMoneyProvider,
  resolvePlanPriceMajor,
  toPaystackAmountMinor,
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
  const rawEnv = {
    STUDYCLOUD_PAYSTACK_SECRET_KEY: secretKey,
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

  // 4. Charge Wave -> renvoie open_url (lien app Wave)
  const waveRes = await callApi('/api/payments/paystack/charge-mobile', {
    method: 'POST',
    token: 'token-alice',
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

  // 5. Initialize Carte uniquement (channelOnly: 'card') pour InlineJS V2
  const cardRes = await callApi('/api/payments/paystack/initialize', {
    method: 'POST',
    token: 'token-alice',
    body: {
      productType: 'storage',
      productId: 'stor_basic',
      channelOnly: 'card',
    },
  });
  const cardJson = await cardRes.json();
  assert.equal(cardJson.success, true);
  assert.equal(cardJson.accessCode, 'acc_card_only_123');
  const lastCall = calls[calls.length - 1];
  assert.deepEqual(lastCall.body.channels, ['card']);
});
