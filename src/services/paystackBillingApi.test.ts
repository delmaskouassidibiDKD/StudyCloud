import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeClientBillingMode,
  formatBillingDurationBadge,
  formatCurrencyAmount,
  shouldShowManualReceiptButton,
  extractPaystackReturnReference,
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
});
