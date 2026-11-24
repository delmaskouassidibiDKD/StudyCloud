/**
 * StudyCloud — Annuaire International des Pays, Drapeaux, Indicatifs & Validation des Normes Téléphoniques
 *
 * - Drapeaux réels (PNG haute netteté via flagcdn.com + fallback ISO) visibles sur Windows, macOS, Android et iOS.
 * - Normes de longueur, préfixes mobiles et formatage automatique adaptés à chaque pays.
 */

export interface CountryPhoneRule {
  iso: string; // ISO 3166-1 alpha-2 majuscule (ex: 'CI', 'SN', 'FR')
  name: string;
  dialCode: string; // ex: '+225'
  minDigits: number;
  maxDigits: number;
  placeholder: string;
  groups: number[]; // Groupement visuel (ex: [2,2,2,2,2] pour CI -> 07 00 00 00 00)
  mobilePrefixes?: string[]; // Préfixes mobiles valides si strict
  keepLeadingZeroForPaystack?: boolean; // CI Paystack CIV exige le format local 10 chiffres (ex: 0700000000)
}

export function getCountryFlagUrl(iso: string): string {
  return `https://flagcdn.com/w40/${String(iso || 'ci').toLowerCase()}.png`;
}

export const COUNTRIES_PHONE_LIST: CountryPhoneRule[] = [
  // Afrique de l'Ouest & Centrale (prioritaires)
  { iso: 'CI', name: "Côte d'Ivoire", dialCode: '+225', minDigits: 10, maxDigits: 10, placeholder: '07 00 00 00 00', groups: [2, 2, 2, 2, 2], mobilePrefixes: ['01', '05', '07'], keepLeadingZeroForPaystack: true },
  { iso: 'SN', name: 'Sénégal', dialCode: '+221', minDigits: 9, maxDigits: 9, placeholder: '77 123 45 67', groups: [2, 3, 2, 2], mobilePrefixes: ['70', '75', '76', '77', '78'] },
  { iso: 'BF', name: 'Burkina Faso', dialCode: '+226', minDigits: 8, maxDigits: 8, placeholder: '70 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'ML', name: 'Mali', dialCode: '+223', minDigits: 8, maxDigits: 8, placeholder: '70 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'BJ', name: 'Bénin', dialCode: '+229', minDigits: 8, maxDigits: 10, placeholder: '01 97 12 34 56', groups: [2, 2, 2, 2, 2] },
  { iso: 'TG', name: 'Togo', dialCode: '+228', minDigits: 8, maxDigits: 8, placeholder: '90 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'NE', name: 'Niger', dialCode: '+227', minDigits: 8, maxDigits: 8, placeholder: '90 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'GN', name: 'Guinée', dialCode: '+224', minDigits: 9, maxDigits: 9, placeholder: '620 12 34 56', groups: [3, 2, 2, 2] },
  { iso: 'CM', name: 'Cameroun', dialCode: '+237', minDigits: 9, maxDigits: 9, placeholder: '670 12 34 56', groups: [3, 2, 2, 2], mobilePrefixes: ['6'] },
  { iso: 'GA', name: 'Gabon', dialCode: '+241', minDigits: 8, maxDigits: 9, placeholder: '074 12 34 56', groups: [3, 2, 2, 2] },
  { iso: 'CG', name: 'Congo-Brazzaville', dialCode: '+242', minDigits: 9, maxDigits: 9, placeholder: '06 123 45 67', groups: [2, 3, 2, 2] },
  { iso: 'CD', name: 'RD Congo', dialCode: '+243', minDigits: 9, maxDigits: 10, placeholder: '81 234 56 78', groups: [2, 3, 2, 2] },
  { iso: 'GH', name: 'Ghana', dialCode: '+233', minDigits: 9, maxDigits: 10, placeholder: '055 123 4987', groups: [3, 3, 4] },
  { iso: 'NG', name: 'Nigeria', dialCode: '+234', minDigits: 10, maxDigits: 11, placeholder: '0803 123 4567', groups: [4, 3, 4] },
  { iso: 'KE', name: 'Kenya', dialCode: '+254', minDigits: 9, maxDigits: 10, placeholder: '0710 000 000', groups: [4, 3, 3] },
  { iso: 'ZA', name: 'Afrique du Sud', dialCode: '+27', minDigits: 9, maxDigits: 10, placeholder: '082 123 4567', groups: [3, 3, 4] },
  { iso: 'RW', name: 'Rwanda', dialCode: '+250', minDigits: 9, maxDigits: 10, placeholder: '078 123 4567', groups: [3, 3, 4] },
  { iso: 'TD', name: 'Tchad', dialCode: '+235', minDigits: 8, maxDigits: 8, placeholder: '66 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'CF', name: 'Centrafrique', dialCode: '+236', minDigits: 8, maxDigits: 8, placeholder: '75 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'GQ', name: 'Guinée équatoriale', dialCode: '+240', minDigits: 9, maxDigits: 9, placeholder: '222 123 456', groups: [3, 3, 3] },
  { iso: 'MR', name: 'Mauritanie', dialCode: '+222', minDigits: 8, maxDigits: 8, placeholder: '22 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'GM', name: 'Gambie', dialCode: '+220', minDigits: 7, maxDigits: 7, placeholder: '701 2345', groups: [3, 4] },
  { iso: 'GW', name: 'Guinée-Bissau', dialCode: '+245', minDigits: 7, maxDigits: 9, placeholder: '955 12 34 56', groups: [3, 2, 2, 2] },
  { iso: 'LR', name: 'Liberia', dialCode: '+231', minDigits: 8, maxDigits: 9, placeholder: '077 123 456', groups: [3, 3, 3] },
  { iso: 'SL', name: 'Sierra Leone', dialCode: '+232', minDigits: 8, maxDigits: 9, placeholder: '076 123 456', groups: [3, 3, 3] },
  { iso: 'CV', name: 'Cap-Vert', dialCode: '+238', minDigits: 7, maxDigits: 7, placeholder: '991 23 45', groups: [3, 2, 2] },
  { iso: 'MG', name: 'Madagascar', dialCode: '+261', minDigits: 9, maxDigits: 10, placeholder: '034 12 345 67', groups: [3, 2, 3, 2] },
  { iso: 'MU', name: 'Maurice', dialCode: '+230', minDigits: 8, maxDigits: 8, placeholder: '5123 4567', groups: [4, 4] },
  { iso: 'KM', name: 'Comores', dialCode: '+269', minDigits: 7, maxDigits: 7, placeholder: '321 23 45', groups: [3, 2, 2] },
  { iso: 'DJ', name: 'Djibouti', dialCode: '+253', minDigits: 8, maxDigits: 8, placeholder: '77 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'BI', name: 'Burundi', dialCode: '+257', minDigits: 8, maxDigits: 8, placeholder: '79 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'UG', name: 'Ouganda', dialCode: '+256', minDigits: 9, maxDigits: 10, placeholder: '0772 123 456', groups: [4, 3, 3] },
  { iso: 'TZ', name: 'Tanzanie', dialCode: '+255', minDigits: 9, maxDigits: 10, placeholder: '0712 345 678', groups: [4, 3, 3] },
  { iso: 'ET', name: 'Éthiopie', dialCode: '+251', minDigits: 9, maxDigits: 10, placeholder: '091 123 4567', groups: [3, 3, 4] },
  { iso: 'AO', name: 'Angola', dialCode: '+244', minDigits: 9, maxDigits: 9, placeholder: '923 123 456', groups: [3, 3, 3] },
  { iso: 'MZ', name: 'Mozambique', dialCode: '+258', minDigits: 9, maxDigits: 9, placeholder: '84 123 4567', groups: [2, 3, 4] },
  { iso: 'ZM', name: 'Zambie', dialCode: '+260', minDigits: 9, maxDigits: 10, placeholder: '097 123 4567', groups: [3, 3, 4] },
  { iso: 'ZW', name: 'Zimbabwe', dialCode: '+263', minDigits: 9, maxDigits: 10, placeholder: '077 123 4567', groups: [3, 3, 4] },
  { iso: 'BW', name: 'Botswana', dialCode: '+267', minDigits: 8, maxDigits: 8, placeholder: '71 123 456', groups: [2, 3, 3] },
  { iso: 'NA', name: 'Namibie', dialCode: '+264', minDigits: 9, maxDigits: 10, placeholder: '081 123 4567', groups: [3, 3, 4] },

  // Afrique du Nord
  { iso: 'MA', name: 'Maroc', dialCode: '+212', minDigits: 9, maxDigits: 10, placeholder: '06 12 34 56 78', groups: [2, 2, 2, 2, 2] },
  { iso: 'TN', name: 'Tunisie', dialCode: '+216', minDigits: 8, maxDigits: 8, placeholder: '20 123 456', groups: [2, 3, 3] },
  { iso: 'DZ', name: 'Algérie', dialCode: '+213', minDigits: 9, maxDigits: 10, placeholder: '05 51 23 45 67', groups: [2, 2, 2, 2, 2] },
  { iso: 'EG', name: 'Égypte', dialCode: '+20', minDigits: 10, maxDigits: 11, placeholder: '010 1234 5678', groups: [3, 4, 4] },
  { iso: 'LY', name: 'Libye', dialCode: '+218', minDigits: 9, maxDigits: 10, placeholder: '091 234 5678', groups: [3, 3, 4] },

  // Europe
  { iso: 'FR', name: 'France', dialCode: '+33', minDigits: 9, maxDigits: 10, placeholder: '06 12 34 56 78', groups: [2, 2, 2, 2, 2] },
  { iso: 'BE', name: 'Belgique', dialCode: '+32', minDigits: 9, maxDigits: 10, placeholder: '0470 12 34 56', groups: [4, 2, 2, 2] },
  { iso: 'CH', name: 'Suisse', dialCode: '+41', minDigits: 9, maxDigits: 10, placeholder: '079 123 45 67', groups: [3, 3, 2, 2] },
  { iso: 'LU', name: 'Luxembourg', dialCode: '+352', minDigits: 9, maxDigits: 9, placeholder: '621 123 456', groups: [3, 3, 3] },
  { iso: 'GB', name: 'Royaume-Uni', dialCode: '+44', minDigits: 10, maxDigits: 11, placeholder: '07700 900123', groups: [5, 6] },
  { iso: 'DE', name: 'Allemagne', dialCode: '+49', minDigits: 10, maxDigits: 12, placeholder: '0151 23456789', groups: [4, 4, 4] },
  { iso: 'ES', name: 'Espagne', dialCode: '+34', minDigits: 9, maxDigits: 9, placeholder: '612 345 678', groups: [3, 3, 3] },
  { iso: 'IT', name: 'Italie', dialCode: '+39', minDigits: 9, maxDigits: 10, placeholder: '312 345 6789', groups: [3, 3, 4] },
  { iso: 'PT', name: 'Portugal', dialCode: '+351', minDigits: 9, maxDigits: 9, placeholder: '912 345 678', groups: [3, 3, 3] },
  { iso: 'NL', name: 'Pays-Bas', dialCode: '+31', minDigits: 9, maxDigits: 10, placeholder: '06 1234 5678', groups: [2, 4, 4] },
  { iso: 'IE', name: 'Irlande', dialCode: '+353', minDigits: 9, maxDigits: 10, placeholder: '085 123 4567', groups: [3, 3, 4] },
  { iso: 'SE', name: 'Suède', dialCode: '+46', minDigits: 9, maxDigits: 10, placeholder: '070 123 45 67', groups: [3, 3, 2, 2] },
  { iso: 'NO', name: 'Norvège', dialCode: '+47', minDigits: 8, maxDigits: 8, placeholder: '412 34 567', groups: [3, 2, 3] },
  { iso: 'DK', name: 'Danemark', dialCode: '+45', minDigits: 8, maxDigits: 8, placeholder: '20 12 34 56', groups: [2, 2, 2, 2] },
  { iso: 'FI', name: 'Finlande', dialCode: '+358', minDigits: 9, maxDigits: 10, placeholder: '040 123 4567', groups: [3, 3, 4] },
  { iso: 'PL', name: 'Pologne', dialCode: '+48', minDigits: 9, maxDigits: 9, placeholder: '512 345 678', groups: [3, 3, 3] },
  { iso: 'AT', name: 'Autriche', dialCode: '+43', minDigits: 10, maxDigits: 11, placeholder: '0664 1234567', groups: [4, 7] },
  { iso: 'GR', name: 'Grèce', dialCode: '+30', minDigits: 10, maxDigits: 10, placeholder: '691 234 5678', groups: [3, 3, 4] },
  { iso: 'RO', name: 'Roumanie', dialCode: '+40', minDigits: 9, maxDigits: 10, placeholder: '0712 345 678', groups: [4, 3, 3] },
  { iso: 'TR', name: 'Turquie', dialCode: '+90', minDigits: 10, maxDigits: 11, placeholder: '0532 123 4567', groups: [4, 3, 4] },
  { iso: 'RU', name: 'Russie', dialCode: '+7', minDigits: 10, maxDigits: 10, placeholder: '912 345 67 89', groups: [3, 3, 2, 2] },
  { iso: 'UA', name: 'Ukraine', dialCode: '+380', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567', groups: [2, 3, 4] },

  // Amériques
  { iso: 'CA', name: 'Canada', dialCode: '+1', minDigits: 10, maxDigits: 10, placeholder: '514 555 0199', groups: [3, 3, 4] },
  { iso: 'US', name: 'États-Unis', dialCode: '+1', minDigits: 10, maxDigits: 10, placeholder: '202 555 0143', groups: [3, 3, 4] },
  { iso: 'HT', name: 'Haïti', dialCode: '+509', minDigits: 8, maxDigits: 8, placeholder: '34 12 3456', groups: [2, 2, 4] },
  { iso: 'GP', name: 'Guadeloupe', dialCode: '+590', minDigits: 9, maxDigits: 10, placeholder: '0690 12 34 56', groups: [4, 2, 2, 2] },
  { iso: 'MQ', name: 'Martinique', dialCode: '+596', minDigits: 9, maxDigits: 10, placeholder: '0696 12 34 56', groups: [4, 2, 2, 2] },
  { iso: 'GF', name: 'Guyane française', dialCode: '+594', minDigits: 9, maxDigits: 10, placeholder: '0694 12 34 56', groups: [4, 2, 2, 2] },
  { iso: 'RE', name: 'La Réunion', dialCode: '+262', minDigits: 9, maxDigits: 10, placeholder: '0692 12 34 56', groups: [4, 2, 2, 2] },
  { iso: 'BR', name: 'Brésil', dialCode: '+55', minDigits: 10, maxDigits: 11, placeholder: '11 91234 5678', groups: [2, 5, 4] },
  { iso: 'MX', name: 'Mexique', dialCode: '+52', minDigits: 10, maxDigits: 10, placeholder: '55 1234 5678', groups: [2, 4, 4] },
  { iso: 'AR', name: 'Argentine', dialCode: '+54', minDigits: 10, maxDigits: 11, placeholder: '11 2345 6789', groups: [2, 4, 4] },
  { iso: 'CO', name: 'Colombie', dialCode: '+57', minDigits: 10, maxDigits: 10, placeholder: '300 123 4567', groups: [3, 3, 4] },

  // Moyen-Orient, Asie & Océanie
  { iso: 'AE', name: 'Émirats arabes unis', dialCode: '+971', minDigits: 9, maxDigits: 10, placeholder: '050 123 4567', groups: [3, 3, 4] },
  { iso: 'SA', name: 'Arabie saoudite', dialCode: '+966', minDigits: 9, maxDigits: 10, placeholder: '050 123 4567', groups: [3, 3, 4] },
  { iso: 'QA', name: 'Qatar', dialCode: '+974', minDigits: 8, maxDigits: 8, placeholder: '5512 3456', groups: [4, 4] },
  { iso: 'LB', name: 'Liban', dialCode: '+961', minDigits: 8, maxDigits: 8, placeholder: '71 123 456', groups: [2, 3, 3] },
  { iso: 'IN', name: 'Inde', dialCode: '+91', minDigits: 10, maxDigits: 10, placeholder: '98765 43210', groups: [5, 5] },
  { iso: 'CN', name: 'Chine', dialCode: '+86', minDigits: 11, maxDigits: 11, placeholder: '138 0013 8000', groups: [3, 4, 4] },
  { iso: 'JP', name: 'Japon', dialCode: '+81', minDigits: 10, maxDigits: 11, placeholder: '090 1234 5678', groups: [3, 4, 4] },
  { iso: 'KR', name: 'Corée du Sud', dialCode: '+82', minDigits: 10, maxDigits: 11, placeholder: '010 1234 5678', groups: [3, 4, 4] },
  { iso: 'AU', name: 'Australie', dialCode: '+61', minDigits: 9, maxDigits: 10, placeholder: '0412 345 678', groups: [4, 3, 3] },
];

export const DEFAULT_COUNTRY_RULE: CountryPhoneRule = COUNTRIES_PHONE_LIST[0]; // Côte d'Ivoire (+225)

export function findCountryByIso(iso?: string): CountryPhoneRule {
  const clean = String(iso || '').trim().toUpperCase();
  return COUNTRIES_PHONE_LIST.find((c) => c.iso === clean) || DEFAULT_COUNTRY_RULE;
}

/**
 * Détecte le pays et la partie nationale à partir d'un numéro brut stocké dans le profil utilisateur.
 */
export function detectCountryAndNational(rawPhone?: string): {
  country: CountryPhoneRule;
  nationalDigits: string;
} {
  const raw = String(rawPhone || '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) {
    return { country: DEFAULT_COUNTRY_RULE, nationalDigits: '' };
  }

  // Trier par indicatif le plus long d'abord pour éviter +1 avant +1xxx ou +225 vs +22
  const sorted = [...COUNTRIES_PHONE_LIST].sort(
    (a, b) => b.dialCode.replace('+', '').length - a.dialCode.replace('+', '').length
  );

  if (raw.startsWith('+') || digits.startsWith('00')) {
    const cleanIntl = digits.startsWith('00') ? digits.slice(2) : digits;
    for (const c of sorted) {
      const codeDigits = c.dialCode.replace('+', '');
      if (cleanIntl.startsWith(codeDigits)) {
        const rest = cleanIntl.slice(codeDigits.length);
        if (rest.length >= Math.max(6, c.minDigits - 1) && rest.length <= c.maxDigits + 1) {
          return { country: c, nationalDigits: rest.slice(0, c.maxDigits) };
        }
      }
    }
  }

  // Cas fréquent : 2250700000000 sans le '+'
  if (digits.startsWith('225') && digits.length === 13) {
    return { country: DEFAULT_COUNTRY_RULE, nationalDigits: digits.slice(3) };
  }

  return {
    country: DEFAULT_COUNTRY_RULE,
    nationalDigits: digits.slice(0, DEFAULT_COUNTRY_RULE.maxDigits),
  };
}

/**
 * Formate visuellement les chiffres nationaux selon le gabarit du pays (sans dépasser maxDigits).
 */
export function formatNationalPhoneInput(rawInput: string, country: CountryPhoneRule): string {
  const digits = String(rawInput || '').replace(/[^\d]/g, '').slice(0, country.maxDigits);
  if (!digits) return '';
  const parts: string[] = [];
  let cursor = 0;
  for (const g of country.groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + g));
    cursor += g;
  }
  if (cursor < digits.length) {
    parts.push(digits.slice(cursor));
  }
  return parts.join(' ');
}

export interface CountryPhoneValidationResult {
  valid: boolean;
  digits: string;
  formattedNational: string;
  e164: string;
  paystackPhone: string;
  error?: string;
}

/**
 * Valide strictement le numéro saisi par rapport à la norme du pays choisi.
 */
export function validateCountryPhone(
  rawInput: string,
  country: CountryPhoneRule
): CountryPhoneValidationResult {
  const digits = String(rawInput || '').replace(/[^\d]/g, '');
  const formattedNational = formatNationalPhoneInput(digits, country);
  const dialDigits = country.dialCode.replace('+', '');

  if (!digits) {
    return {
      valid: false,
      digits,
      formattedNational,
      e164: '',
      paystackPhone: '',
      error: `Veuillez saisir votre numéro (${country.name}, ex : ${country.placeholder}).`,
    };
  }

  if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    const lengthDesc =
      country.minDigits === country.maxDigits
        ? `${country.minDigits} chiffres`
        : `${country.minDigits} à ${country.maxDigits} chiffres`;
    return {
      valid: false,
      digits,
      formattedNational,
      e164: '',
      paystackPhone: '',
      error: `Format ${country.name} invalide : ${lengthDesc} requis (ex : ${country.placeholder}).`,
    };
  }

  if (Array.isArray(country.mobilePrefixes) && country.mobilePrefixes.length > 0) {
    const matchesPrefix = country.mobilePrefixes.some((p) => digits.startsWith(p));
    if (!matchesPrefix) {
      return {
        valid: false,
        digits,
        formattedNational,
        e164: '',
        paystackPhone: '',
        error: `Numéro ${country.name} invalide : doit commencer par ${country.mobilePrefixes.join(', ')} (ex : ${country.placeholder}).`,
      };
    }
  }

  // Construction E.164 propre
  const nationalForE164 =
    country.iso === 'CI'
      ? digits // En Côte d'Ivoire (plan à 10 chiffres), le 0 initial est CONSERVÉ après +225 (+22507...)
      : digits.startsWith('0') && digits.length === country.maxDigits && country.minDigits < country.maxDigits
      ? digits.slice(1)
      : digits;

  const e164 = `+${dialDigits}${nationalForE164}`;
  const paystackPhone = country.keepLeadingZeroForPaystack ? digits : e164;

  return {
    valid: true,
    digits,
    formattedNational,
    e164,
    paystackPhone,
  };
}
