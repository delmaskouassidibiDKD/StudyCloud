import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRIES_PHONE_LIST,
  detectCountryAndNational,
  findCountryByIso,
  formatNationalPhoneInput,
  validateCountryPhone,
} from './countryPhoneRules';

describe('countryPhoneRules international validation & formatting', () => {
  it('validates Côte d’Ivoire (+225) strict 10-digit norm and preserves Paystack local format', () => {
    const ci = findCountryByIso('CI');
    const ok = validateCountryPhone('07 00 00 00 00', ci);
    assert.equal(ok.valid, true);
    assert.equal(ok.digits, '0700000000');
    assert.equal(ok.paystackPhone, '0700000000');
    assert.equal(ok.e164, '+2250700000000');

    const tooShort = validateCountryPhone('07000000', ci);
    assert.equal(tooShort.valid, false);
    assert.match(tooShort.error || '', /10 chiffres/);

    const badPrefix = validateCountryPhone('0900000000', ci);
    assert.equal(badPrefix.valid, false);
    assert.match(badPrefix.error || '', /01, 05, 07/);
  });

  it('validates Sénégal (+221) 9-digit norm, Burkina (+226) 8-digit norm, and France (+33)', () => {
    const sn = findCountryByIso('SN');
    assert.equal(validateCountryPhone('77 123 45 67', sn).valid, true);
    assert.equal(validateCountryPhone('77 123 45 67', sn).e164, '+221771234567');
    assert.equal(validateCountryPhone('7712345', sn).valid, false);
    assert.equal(validateCountryPhone('331234567', sn).valid, false);

    const bf = findCountryByIso('BF');
    assert.equal(validateCountryPhone('70 12 34 56', bf).valid, true);
    assert.equal(validateCountryPhone('7012345678', bf).valid, false);

    const fr = findCountryByIso('FR');
    const frOk = validateCountryPhone('06 12 34 56 78', fr);
    assert.equal(frOk.valid, true);
    assert.equal(frOk.e164, '+33612345678');
  });

  it('detects country automatically from saved international phone numbers and caps formatting', () => {
    const detSn = detectCountryAndNational('+221 77 123 45 67');
    assert.equal(detSn.country.iso, 'SN');
    assert.equal(detSn.nationalDigits, '771234567');

    const detCi = detectCountryAndNational('+225 05 51 23 49 87');
    assert.equal(detCi.country.iso, 'CI');
    assert.equal(detCi.nationalDigits, '0551234987');

    const bf = findCountryByIso('BF');
    assert.equal(formatNationalPhoneInput('701234569999', bf), '70 12 34 56');
    assert.ok(COUNTRIES_PHONE_LIST.length >= 70);
  });
});
