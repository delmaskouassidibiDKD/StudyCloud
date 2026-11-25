import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeClientBillingMode,
  normalizeClientCiPhone,
  formatBillingDurationBadge,
  formatCurrencyAmount,
  shouldShowManualReceiptButton,
  extractPaystackReturnReference,
  resolveSuccessScreenRenewalState,
} from './paystackBillingApi';

describe('paystackBillingApi pure helpers', () => {
  it('normalizes auto, manual, infinite billing modes accurately', () => {
    assert.equal(normalizeClientBillingMode('auto', 0), 'auto');
    assert.equal(normalizeClientBillingMode('infinite', 0), 'infinite');
    assert.equal(normalizeClientBillingMode('manual', 1), 'manual');
    assert.equal(normalizeClientBillingMode(undefined, 1), 'auto');
    assert.equal(normalizeClientBillingMode(undefined, 0, 'one_time'), 'infinite');
    assert.equal(normalizeClientBillingMode(undefined, 0, 'subscription'), 'manual');
  });

  it('formats billing mode and custom duration badges cleanly', () => {
    const inf = formatBillingDurationBadge('infinite', 0);
    assert.equal(inf.mode, 'infinite');
    assert.equal(inf.tone, 'amber');
    assert.match(inf.label, /Accès à vie/i);

    const auto30 = formatBillingDurationBadge('auto', 30);
    assert.equal(auto30.mode, 'auto');
    assert.equal(auto30.tone, 'emerald');
    assert.match(auto30.label, /Automatique/);
    assert.match(auto30.shortLabel, /30j/);

    const manual90 = formatBillingDurationBadge('manual', 90);
    assert.equal(manual90.mode, 'manual');
    assert.equal(manual90.tone, 'sky');
    assert.match(manual90.label, /90 jours/);
  });

  it('strictly hides manual payment button when admin disables manualReceiptEnabled', () => {
    assert.equal(shouldShowManualReceiptButton({ manualReceiptEnabled: true }, true), true);
    assert.equal(shouldShowManualReceiptButton({ manualReceiptEnabled: false }, true), false);
    assert.equal(shouldShowManualReceiptButton({ manualReceiptEnabled: true }, false), false);
    assert.equal(shouldShowManualReceiptButton(null, true), false);
  });

  it('extracts Paystack return reference safely from URL search params', () => {
    assert.equal(
      extractPaystackReturnReference('?payment=paystack-return&reference=SC-PAY-123456-ABC'),
      'SC-PAY-123456-ABC'
    );
    assert.equal(
      extractPaystackReturnReference('?payment=paystack-return&trxref=SC-PAY-999-XYZ'),
      'SC-PAY-999-XYZ'
    );
    assert.equal(extractPaystackReturnReference('?tab=folders'), null);
  });

  it('formats XOF, EUR and USD currency amounts cleanly', () => {
    assert.match(formatCurrencyAmount(5000, 'XOF'), /5[\s\u202f]000 FCFA/);
    assert.equal(formatCurrencyAmount(10, 'USD'), '$10');
    assert.equal(formatCurrencyAmount(9.5, 'EUR'), '9.50 €');
  });

  it('normalizes Côte d’Ivoire Mobile Money phone numbers cleanly', () => {
    assert.equal(normalizeClientCiPhone('+225 07 00 00 00 00'), '0700000000');
    assert.equal(normalizeClientCiPhone('225 05 11 22 33 44'), '0511223344');
    assert.equal(normalizeClientCiPhone('070 000 000 0'), '0700000000');
  });

  it('resolves Step 3 success screen renewal variants (Infinite, Visa Auto+Manual, Mobile Money Auto+Manual, Manual only)', () => {
    // 1. Plan Infini / À vie
    const inf = resolveSuccessScreenRenewalState({
      billingMode: 'infinite',
      renewalUiConfig: {
        renewalMode: 'infinite',
        canChooseAutoOnSuccessScreen: false,
        defaultSelectedMode: 'infinite',
        isInfinite: true,
        planAllowsAuto: false,
        planAllowsManual: false,
        hasReusableCard: false,
      },
    });
    assert.equal(inf.variant, 'infinite');
    assert.equal(inf.isInfinite, true);
    assert.equal(inf.canChooseAuto, false);
    assert.equal(inf.endsAtIso, null);

    // 2. Plan Auto + Manuel payé par carte Visa réutilisable -> Automatique coché par défaut, modifiable en Manuel
    const visaAuto = resolveSuccessScreenRenewalState({
      billingMode: 'auto',
      subscription: {
        id: 'asub_123',
        user_id: 'u1',
        product_type: 'app',
        app_key: 'moyennes',
        plan_id: 'p1',
        plan_name: 'Mensuel',
        status: 'active',
        is_infinite: 0,
        plan_allows_auto: 1,
        plan_allows_manual: 1,
        renewal_mode: 'auto',
        current_period_end: '2026-12-25T14:00:00.000Z',
        duration_days: 30,
      },
      paymentMethod: {
        id: 'pm_1',
        brand: 'Visa',
        last4: '4242',
        expMonth: '12',
        expYear: '2029',
        bank: 'SGBCI',
        channel: 'card',
        reusable: true,
        isDefault: true,
        label: 'Visa •••• 4242',
      },
      renewalUiConfig: {
        renewalMode: 'auto',
        canChooseAutoOnSuccessScreen: true,
        defaultSelectedMode: 'auto',
        isInfinite: false,
        planAllowsAuto: true,
        planAllowsManual: true,
        hasReusableCard: true,
      },
    });
    assert.equal(visaAuto.variant, 'interactive_auto_manual');
    assert.equal(visaAuto.initialMode, 'auto');
    assert.equal(visaAuto.canChooseAuto, true);
    assert.equal(visaAuto.cardLabel, 'Visa •••• 4242');
    assert.equal(visaAuto.endsAtIso, '2026-12-25T14:00:00.000Z');

    // 3. Plan Auto + Manuel payé par Wave/OM/MTN -> Manuel + indice liaison carte ultérieure
    const waveOnAutoPlan = resolveSuccessScreenRenewalState({
      billingMode: 'auto',
      networkLabel: 'Wave',
      subscription: {
        id: 'asub_456',
        user_id: 'u1',
        product_type: 'storage',
        plan_id: 'p2',
        plan_name: 'Pro 50Go',
        status: 'active',
        is_infinite: 0,
        plan_allows_auto: 1,
        plan_allows_manual: 1,
        renewal_mode: 'manual',
        current_period_end: '2026-12-25T14:00:00.000Z',
        duration_days: 30,
      },
      renewalUiConfig: {
        renewalMode: 'manual',
        canChooseAutoOnSuccessScreen: false,
        defaultSelectedMode: 'manual',
        isInfinite: false,
        planAllowsAuto: true,
        planAllowsManual: true,
        hasReusableCard: false,
      },
    });
    assert.equal(waveOnAutoPlan.variant, 'manual_can_link_card');
    assert.equal(waveOnAutoPlan.initialMode, 'manual');
    assert.equal(waveOnAutoPlan.canChooseAuto, false);

    // 4. Plan Manuel seul (même payé par carte Visa) -> Manuel uniquement
    const manualOnly = resolveSuccessScreenRenewalState({
      billingMode: 'manual',
      networkLabel: 'Visa',
      subscription: {
        id: 'asub_789',
        user_id: 'u1',
        product_type: 'ai',
        plan_id: 'p3',
        plan_name: 'Pack IA',
        status: 'active',
        is_infinite: 0,
        plan_allows_auto: 0,
        plan_allows_manual: 1,
        renewal_mode: 'manual',
        current_period_end: '2026-12-25T14:00:00.000Z',
        duration_days: 30,
      },
      renewalUiConfig: {
        renewalMode: 'manual',
        canChooseAutoOnSuccessScreen: false,
        defaultSelectedMode: 'manual',
        isInfinite: false,
        planAllowsAuto: false,
        planAllowsManual: true,
        hasReusableCard: true,
      },
    });
    assert.equal(manualOnly.variant, 'manual_only');
    assert.equal(manualOnly.initialMode, 'manual');
    assert.equal(manualOnly.canChooseAuto, false);
  });
});
