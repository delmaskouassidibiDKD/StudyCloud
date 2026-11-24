import {
  calculateClassRanks,
  calculateGeneralAverage,
  DEFAULT_AVERAGE_SCALE,
  getMentionFromCustomRules,
  sanitizeAverageScale,
  type CustomMentionRule,
  type SubjectForGeneralAverage,
} from './gradebookCalculations';
import type { GradebookColumnOrder } from './gradebookColumnLayout';

export type TermAverageSortMode = 'merit' | 'alpha' | 'order';

export interface TermAverageSubject {
  id: string;
  name: string;
  coefficient?: number | null;
  effectiveCoeff: number;
  color?: string;
  textColor?: string;
  borderColor?: string;
  borderDarkColor?: string;
}

export interface GradebookStudentSnapshot {
  id: string;
  studentUid: string;
  name: string;
  matricule?: string;
  photoUrl?: string;
  photoR2Key?: string;
  average20: number | null;
  notesCount: number;
}

export interface ManualAverageStudent {
  key: string;
  name: string;
  createdAt?: number;
}

export interface StudentMergeLink {
  primaryKey: string;
  mergedKeys: string[];
}

export interface TermAverageOverrides {
  manualStudents?: ManualAverageStudent[];
  /** Moyennes saisies directement dans ce tableau (mode hybride), indexées par [studentKey][subjectId] */
  subjectOverrides?: Record<string, Record<string, number | null>>;
  /** Matricules saisis ou complétés directement dans ce tableau, indexés par [studentKey] */
  matriculeOverrides?: Record<string, string>;
  /** Fusions validées par le professeur ("C'est le même élève") */
  mergedLinks?: StudentMergeLink[];
  /** Paires confirmées distinctes par le professeur ("Ce sont 2 élèves différents") */
  distinctPairs?: Array<[string, string]>;
}

export interface TermAverageLayoutState {
  colWidthRank?: number;
  colWidthPhoto?: number;
  colWidthMatricule?: number;
  colWidthName?: number;
  colWidthSubjectMoy?: number;
  colWidthSubjectWeighted?: number;
  colWidthTotalGeneral?: number;
  colWidthGeneralAvg?: number;
  colWidthMention?: number;
  customSubjectMoyWidths?: Record<string, number>;
  customSubjectWeightedWidths?: Record<string, number>;
  customRowHeights?: Record<string, number>;
  zoomPercent?: number;
  mentionRules?: CustomMentionRule[] | null;
  showMatricule?: boolean;
  averageScale?: number;
  columnOrder?: GradebookColumnOrder | null;
}

export interface TermAverageStylesState {
  cellColors?: Record<string, string>;
  rowColors?: Record<string, string>;
  cellCustomStyles?: Record<string, any>;
}

export interface ComputedSubjectCell {
  subjectId: string;
  effectiveCoeff: number;
  autoAverage: number | null;
  manualAverage: number | null;
  effectiveAverage: number | null;
  source: 'gradebook' | 'manual' | 'empty';
  /** Moyenne matière × Coefficient matière */
  weightedValue: number | null;
}

export interface ComputedTermAverageStudent {
  key: string;
  studentUid?: string;
  isManualOnly: boolean;
  originalOrder: number;
  name: string;
  matricule?: string;
  photoUrl?: string;
  photoR2Key?: string;
  /** Matières dans lesquelles cet élève existe dans les tableurs */
  presentSubjectIds: string[];
  /** Clés fusionnées manuellement dans cette ligne (pour permettre de les séparer si besoin) */
  mergedSourceKeys: string[];
  cellsBySubject: Record<string, ComputedSubjectCell>;
  /** Somme des (Moyenne × Coeff) pour toutes les matières notées de l'élève */
  totalGeneral: number | null;
  /** Somme des coefficients des matières effectivement notées pour cet élève */
  totalCoeffCounted: number;
  /** Nombre de matières notées pour cet élève */
  gradedSubjectsCount: number;
  /** Moyenne générale /20 (pleine précision) */
  generalAverage: number | null;
  mention: string;
  rankNumber: number | null;
  rankLabel: string;
  isExAequo: boolean;
}

export interface PotentialDuplicateCandidate {
  id: string;
  studentA: {
    key: string;
    name: string;
    photoUrl?: string;
    subjectNames: string[];
  };
  studentB: {
    key: string;
    name: string;
    photoUrl?: string;
    subjectNames: string[];
  };
  reason: 'same_name' | 'typo_close' | 'partial_name';
  reasonLabel: string;
  confidence: 'high' | 'medium';
}

export interface ComputedSubjectClassStats {
  subjectId: string;
  effectiveCoeff: number;
  classAverage20: number | null;
  classWeightedAverage: number | null;
  gradedCount: number;
}

export interface ComputedTermClassSummary {
  totalStudents: number;
  gradedStudentCount: number;
  totalClassCoeff: number;
  bySubject: Record<string, ComputedSubjectClassStats>;
  classTotalGeneralAvg: number | null;
  classGeneralAverage: number | null;
  highestAverage: number | null;
  lowestAverage: number | null;
  passCount: number;
  passRatePercent: number | null;
}

export interface ComputedTermAverageTable {
  subjects: TermAverageSubject[];
  students: ComputedTermAverageStudent[];
  classSummary: ComputedTermClassSummary;
  /** Doublons potentiels (noms très proches / homonymes ambigus) soumis à validation humaine */
  potentialDuplicates: PotentialDuplicateCandidate[];
  /** Barème maximal effectif sur lequel toutes les moyennes de ce tableau sont ramenées (défaut : 20) */
  averageScale: number;
}

/**
 * Nettoyage intelligent et 100 % sûr d'un nom d'élève :
 * - Supprime les numéros de liste collés devant ("1. KOUASSI Jean", "02 - KOUASSI")
 * - Supprime les civilités ("M.", "Mme", "Mlle", "Mr")
 * - Supprime les accents ("TRAORÉ" = "TRAORE")
 * - Fusionne les apostrophes ("N'GUESSAN" = "N’GUESSAN" = "NGUESSAN")
 * - Remplace tirets/ponctuation par espace ("JEAN-LUC" = "JEAN LUC")
 * - Insensible aux majuscules et espaces multiples
 */
export function normalizeStudentNameKey(name: string | null | undefined): string {
  return String(name || '')
    .trim()
    .replace(/^(?:\d{1,3}\s*[.)\-–—:]+\s*)+/, '')
    .replace(/^(?:m\.|mr\.?|mme\.?|mlle\.?|dr\.?)\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`ʼ]/g, '')
    .replace(/[-–—_.,;/\\()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Clé insensible à l'ordre des mots ("KOUASSI Jean" === "Jean KOUASSI").
 * Retourne '' s'il y a moins de 2 mots significatifs.
 */
export function canonicalWordBagKey(normalizedName: string): string {
  const tokens = normalizedName
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length < 2) return '';
  return [...tokens].sort().join(' ');
}

export function makeSortedPairKey(keyA: string, keyB: string): string {
  return keyA < keyB ? `${keyA}||${keyB}` : `${keyB}||${keyA}`;
}

/**
 * Distance de Damerau-Levenshtein (gère insertion, suppression, substitution
 * et transposition de 2 lettres adjacentes comme "KOUASIS" <-> "KOUASSI").
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1, // suppression
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        best = Math.min(best, dp[i - 2][j - 2] + 1); // transposition
      }
      dp[i][j] = best;
    }
  }
  return dp[m][n];
}

export function getEffectiveSubjectCoeff(coefficient?: number | null): number {
  const num = Number(coefficient);
  if (Number.isFinite(num) && num > 0) {
    return num;
  }
  return 1;
}

export function formatFrenchNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(decimals).replace('.', ',');
}

export function formatCoeffDisplay(coeff: number): string {
  if (!Number.isFinite(coeff) || coeff <= 0) return '1';
  if (Math.abs(coeff - Math.round(coeff)) < 1e-6) {
    return String(Math.round(coeff));
  }
  return String(Number(coeff.toFixed(2))).replace('.', ',');
}

export function parseManualAverageInput(
  raw: string,
  maxScale = DEFAULT_AVERAGE_SCALE
): {
  valid: boolean;
  value: number | null;
} {
  const safeMax = sanitizeAverageScale(maxScale) ?? DEFAULT_AVERAGE_SCALE;
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') {
    return { valid: true, value: null };
  }
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { valid: false, value: null };
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0 || num > safeMax) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

interface InternalStudentBucket {
  key: string;
  studentUid?: string;
  isManualOnly: boolean;
  originalOrder: number;
  name: string;
  matricule?: string;
  photoUrl?: string;
  photoR2Key?: string;
  autoBySubject: Record<string, number | null>;
  aliasKeys: string[];
  mergedSourceKeys: string[];
}

/**
 * Vérifie si un nom court est inclus dans un nom plus long (prénom supplémentaire ou initiale abrégée).
 * Ex: "KOUASSI Jean-Marc" <-> "KOUASSI Yao Jean-Marc" ou "KOUASSI Y. Jean" <-> "KOUASSI Yao Jean".
 */
function isPartialOrInitialMatch(normA: string, normB: string): boolean {
  const tokensA = normA.split(' ').filter(Boolean);
  const tokensB = normB.split(' ').filter(Boolean);
  if (tokensA.length < 2 || tokensB.length < 2) return false;

  const [shorter, longer] =
    tokensA.length <= tokensB.length
      ? [tokensA, tokensB]
      : [tokensB, tokensA];

  const used = new Set<number>();
  let exactLongWords = 0;

  for (const st of shorter) {
    let matchedIdx = -1;
    // 1. Correspondance exacte de mot
    for (let j = 0; j < longer.length; j++) {
      if (used.has(j)) continue;
      if (longer[j] === st) {
        matchedIdx = j;
        if (st.length >= 3) exactLongWords += 1;
        break;
      }
    }
    // 2. Sinon initiale (1 lettre) correspondant au début d'un mot plus long
    if (matchedIdx === -1 && st.length === 1) {
      for (let j = 0; j < longer.length; j++) {
        if (used.has(j)) continue;
        if (longer[j].startsWith(st)) {
          matchedIdx = j;
          break;
        }
      }
    }
    // 3. Ou mot long correspondant à une initiale dans longer
    if (matchedIdx === -1 && st.length > 1) {
      for (let j = 0; j < longer.length; j++) {
        if (used.has(j)) continue;
        if (longer[j].length === 1 && st.startsWith(longer[j])) {
          matchedIdx = j;
          break;
        }
      }
    }
    if (matchedIdx === -1) return false;
    used.add(matchedIdx);
  }

  return exactLongWords >= 1 && (exactLongWords >= 2 || shorter.length >= 2);
}

/**
 * Détecte les paires d'élèves potentiellement identiques (faute de frappe, prénom abrégé, homonyme ambigu)
 * pour validation humaine.
 * Règle de sécurité absolue : 2 élèves présents dans UNE MÊME matière ne sont JAMAIS proposés à la fusion
 * (empêche de mélanger jumeaux/frères comme TRAORÉ Aya et TRAORÉ Awa).
 */
export function detectPotentialDuplicateStudents(
  students: readonly ComputedTermAverageStudent[],
  subjectsById: Map<string, TermAverageSubject>,
  distinctPairSet: Set<string>
): PotentialDuplicateCandidate[] {
  const candidates: PotentialDuplicateCandidate[] = [];

  for (let i = 0; i < students.length; i++) {
    const a = students[i];
    const normA = normalizeStudentNameKey(a.name);
    if (!normA || normA.length < 3) continue;
    const bagA = canonicalWordBagKey(normA);
    const subjSetA = new Set(a.presentSubjectIds);

    for (let j = i + 1; j < students.length; j++) {
      const b = students[j];
      const normB = normalizeStudentNameKey(b.name);
      if (!normB || normB.length < 3) continue;

      const pairId = makeSortedPairKey(a.key, b.key);
      if (distinctPairSet.has(pairId)) continue;

      // Invariant de sécurité : s'ils coexistent dans une même matière, ce sont forcément 2 élèves distincts !
      const hasSharedSubject = b.presentSubjectIds.some((sid) =>
        subjSetA.has(sid)
      );
      if (hasSharedSubject) continue;

      // Ignorer si l'un n'est présent dans aucune matière ET n'a aucune note (ligne vide manuelle)
      if (
        a.presentSubjectIds.length === 0 &&
        a.gradedSubjectsCount === 0 &&
        b.presentSubjectIds.length === 0 &&
        b.gradedSubjectsCount === 0
      ) {
        continue;
      }

      const bagB = canonicalWordBagKey(normB);
      let reason: PotentialDuplicateCandidate['reason'] | null = null;
      let reasonLabel = '';
      let confidence: 'high' | 'medium' = 'medium';

      if (normA === normB || (bagA && bagB && bagA === bagB)) {
        reason = 'same_name';
        reasonLabel = 'Même nom détecté dans des matières différentes';
        confidence = 'high';
      } else {
        // Vérification faute de frappe (Damerau-Levenshtein sur ordre normal ou ordre inversé)
        const maxLen = Math.max(normA.length, normB.length);
        const distNormal = damerauLevenshtein(normA, normB);
        const distBag =
          bagA && bagB ? damerauLevenshtein(bagA, bagB) : distNormal;
        const bestDist = Math.min(distNormal, distBag);
        const similarity = maxLen > 0 ? 1 - bestDist / maxLen : 0;

        const isTypoClose =
          (maxLen >= 5 && bestDist === 1 && similarity >= 0.8) ||
          (maxLen >= 11 && bestDist <= 2 && similarity >= 0.82);

        if (isTypoClose) {
          reason = 'typo_close';
          reasonLabel = 'Orthographe très proche (faute de frappe possible)';
          confidence = bestDist === 1 ? 'high' : 'medium';
        } else if (isPartialOrInitialMatch(normA, normB)) {
          reason = 'partial_name';
          reasonLabel = 'Prénom supplémentaire ou abrégé';
          confidence = 'medium';
        }
      }

      if (reason) {
        const formatSubjNames = (s: ComputedTermAverageStudent) => {
          const names = s.presentSubjectIds
            .map((id) => subjectsById.get(id)?.name)
            .filter((n): n is string => Boolean(n));
          if (names.length === 0 && s.isManualOnly) {
            return ['Ajout manuel'];
          }
          return names;
        };

        candidates.push({
          id: pairId,
          studentA: {
            key: a.key,
            name: a.name,
            photoUrl: a.photoUrl,
            subjectNames: formatSubjNames(a),
          },
          studentB: {
            key: b.key,
            name: b.name,
            photoUrl: b.photoUrl,
            subjectNames: formatSubjNames(b),
          },
          reason,
          reasonLabel,
          confidence,
        });
      }
    }
  }

  return candidates
    .sort((x, y) => {
      if (x.confidence !== y.confidence) {
        return x.confidence === 'high' ? -1 : 1;
      }
      return x.studentA.name.localeCompare(y.studentA.name, 'fr');
    })
    .slice(0, 50);
}

export interface ComputeTermAverageInput {
  subjects: Array<{
    id: string;
    name: string;
    coefficient?: number | null;
    color?: string;
    textColor?: string;
    borderColor?: string;
    borderDarkColor?: string;
  }>;
  subjectGradebooks: Record<string, GradebookStudentSnapshot[]>;
  overrides?: TermAverageOverrides | null;
  sortMode?: TermAverageSortMode;
  mentionRules?: readonly CustomMentionRule[] | null;
  /** Barème maximal cible des moyennes du tableau (défaut : 20, ex: 20, 40, 100...) */
  averageScale?: number;
}

/**
 * Unifie automatiquement les élèves de toutes les matières d'un trimestre en 3 couches sûres :
 * - Priorité 1 : identifiant interne unique (`studentUid`)
 * - Priorité 2 : nom normalisé exact (accents, casse, tirets, apostrophes, numéros) sans ambiguïté d'homonyme
 * - Priorité 3 : inversion exacte Nom <-> Prénom ("KOUASSI Jean" <-> "Jean KOUASSI") sans ambiguïté
 * - Fusions manuelles confirmées (`mergedLinks`) et exclusions (`distinctPairs`) persistées
 * - Détection sans fusion silencieuse des noms proches / fautes de frappe (`potentialDuplicates`)
 */
export function computeTermGeneralAverageTable(
  input: ComputeTermAverageInput
): ComputedTermAverageTable {
  const normalizedSubjects: TermAverageSubject[] = (input.subjects || []).map(
    (s) => ({
      ...s,
      effectiveCoeff: getEffectiveSubjectCoeff(s.coefficient),
    })
  );
  const subjectsById = new Map<string, TermAverageSubject>(
    normalizedSubjects.map((s) => [s.id, s])
  );

  const overrides = input.overrides || {};
  const subjectOverrides = overrides.subjectOverrides || {};
  const matriculeOverrides = overrides.matriculeOverrides || {};
  const averageScale = sanitizeAverageScale(input.averageScale) ?? DEFAULT_AVERAGE_SCALE;
  const scaleFactor = averageScale / 20;
  const passThreshold = averageScale / 2;
  const manualStudents = Array.isArray(overrides.manualStudents)
    ? overrides.manualStudents
    : [];
  const mergedLinks = Array.isArray(overrides.mergedLinks)
    ? overrides.mergedLinks
    : [];
  const distinctPairs = Array.isArray(overrides.distinctPairs)
    ? overrides.distinctPairs
    : [];
  const sortMode: TermAverageSortMode = input.sortMode || 'merit';

  const distinctPairSet = new Set<string>();
  for (const pair of distinctPairs) {
    if (Array.isArray(pair) && pair.length === 2 && pair[0] && pair[1]) {
      distinctPairSet.add(makeSortedPairKey(String(pair[0]), String(pair[1])));
    }
  }

  // Pré-détecter les noms en homonymie (plusieurs élèves portant le même nom dans UNE MÊME matière)
  // afin de ne JAMAIS fusionner silencieusement un homonyme ambigu !
  const ambiguousNormNames = new Set<string>();
  const ambiguousWordBags = new Set<string>();

  for (const subject of normalizedSubjects) {
    const seenNormInSubject = new Set<string>();
    const seenBagInSubject = new Set<string>();
    const rows = input.subjectGradebooks?.[subject.id] || [];
    for (const row of rows) {
      const norm = normalizeStudentNameKey(row.name);
      if (!norm) continue;
      if (seenNormInSubject.has(norm)) {
        ambiguousNormNames.add(norm);
      } else {
        seenNormInSubject.add(norm);
      }
      const bag = canonicalWordBagKey(norm);
      if (bag) {
        if (seenBagInSubject.has(bag)) {
          ambiguousWordBags.add(bag);
        } else {
          seenBagInSubject.add(bag);
        }
      }
    }
  }

  const buckets: InternalStudentBucket[] = [];
  const bucketByUid = new Map<string, InternalStudentBucket>();
  const bucketsByNormName = new Map<string, InternalStudentBucket[]>();
  const bucketsByWordBag = new Map<string, InternalStudentBucket[]>();
  const bucketByKey = new Map<string, InternalStudentBucket>();

  let orderCounter = 0;

  const registerBucket = (bucket: InternalStudentBucket) => {
    buckets.push(bucket);
    bucketByKey.set(bucket.key, bucket);
    if (bucket.studentUid) {
      bucketByUid.set(bucket.studentUid, bucket);
    }
    const norm = normalizeStudentNameKey(bucket.name);
    if (norm) {
      const list = bucketsByNormName.get(norm) || [];
      list.push(bucket);
      bucketsByNormName.set(norm, list);

      const bag = canonicalWordBagKey(norm);
      if (bag) {
        const bagList = bucketsByWordBag.get(bag) || [];
        bagList.push(bucket);
        bucketsByWordBag.set(bag, bagList);
      }
    }
  };

  // 1. Parcourir les feuilles de notes de chaque matière du trimestre
  for (const subject of normalizedSubjects) {
    const rows = input.subjectGradebooks?.[subject.id] || [];
    for (const row of rows) {
      const trimmedName = String(row.name || '').trim();
      const hasValidAvg =
        row.average20 !== null &&
        row.average20 !== undefined &&
        Number.isFinite(Number(row.average20));
      const hasPhoto = Boolean(row.photoUrl || row.photoR2Key);

      // Ignorer les lignes vierges par défaut (sans nom, sans note et sans photo)
      if (!trimmedName && !hasValidAvg && !hasPhoto) {
        continue;
      }

      const normName = normalizeStudentNameKey(trimmedName);
      const wordBag = canonicalWordBagKey(normName);
      const uid = String(row.studentUid || '').trim();

      let target: InternalStudentBucket | undefined;

      // Priorité 1 : identifiant interne unique (gère même les vrais homonymes à 100 %)
      if (uid && bucketByUid.has(uid)) {
        const candidate = bucketByUid.get(uid)!;
        if (!(subject.id in candidate.autoBySubject)) {
          target = candidate;
        }
      }

      // Priorité 2 : nom normalisé exact (UNIQUEMENT s'il n'y a aucune ambiguïté d'homonyme !)
      if (
        !target &&
        normName &&
        !ambiguousNormNames.has(normName) &&
        bucketsByNormName.has(normName)
      ) {
        const candidates = bucketsByNormName
          .get(normName)!
          .filter((c) => !(subject.id in c.autoBySubject));
        if (candidates.length === 1) {
          target = candidates[0];
        }
      }

      // Priorité 3 : inversion exacte Nom <-> Prénom ("KOUASSI Jean" <-> "Jean KOUASSI") sans ambiguïté
      if (
        !target &&
        wordBag &&
        !ambiguousWordBags.has(wordBag) &&
        bucketsByWordBag.has(wordBag)
      ) {
        const candidates = bucketsByWordBag
          .get(wordBag)!
          .filter((c) => !(subject.id in c.autoBySubject));
        if (candidates.length === 1) {
          target = candidates[0];
        }
      }

      if (!target) {
        const baseKey =
          normName && !ambiguousNormNames.has(normName)
            ? `name:${normName}`
            : uid
            ? `uid:${uid}`
            : normName
            ? `name:${normName}`
            : `row:${row.id}`;
        let uniqueKey = baseKey;
        let suffix = 2;
        while (bucketByKey.has(uniqueKey)) {
          uniqueKey = `${baseKey}#${suffix}`;
          suffix += 1;
        }

        target = {
          key: uniqueKey,
          studentUid: uid || undefined,
          isManualOnly: false,
          originalOrder: orderCounter++,
          name: trimmedName,
          matricule: (row.matricule || '').trim() || undefined,
          photoUrl: row.photoUrl || undefined,
          photoR2Key: row.photoR2Key || undefined,
          autoBySubject: {},
          aliasKeys: [],
          mergedSourceKeys: [],
        };
        registerBucket(target);
      } else {
        if (!target.name && trimmedName) {
          target.name = trimmedName;
          const list = bucketsByNormName.get(normName) || [];
          if (!list.includes(target)) {
            list.push(target);
            bucketsByNormName.set(normName, list);
          }
          if (wordBag) {
            const bagList = bucketsByWordBag.get(wordBag) || [];
            if (!bagList.includes(target)) {
              bagList.push(target);
              bucketsByWordBag.set(wordBag, bagList);
            }
          }
        }
        if (!target.matricule && row.matricule && row.matricule.trim()) {
          target.matricule = row.matricule.trim();
        }
        if (!target.photoUrl && row.photoUrl) {
          target.photoUrl = row.photoUrl;
        }
        if (!target.photoR2Key && row.photoR2Key) {
          target.photoR2Key = row.photoR2Key;
        }
        if (!target.studentUid && uid) {
          target.studentUid = uid;
          if (!bucketByUid.has(uid)) bucketByUid.set(uid, target);
        }
      }

      target.autoBySubject[subject.id] = hasValidAvg
        ? Number(row.average20)
        : null;
    }
  }

  // 2. Intégrer les élèves ajoutés manuellement dans le tableau de Moyenne générale
  for (const ms of manualStudents) {
    if (!ms || !ms.key) continue;
    const trimmedName = String(ms.name || '').trim();
    const normName = normalizeStudentNameKey(trimmedName);

    let existing = bucketByKey.get(ms.key);
    if (
      !existing &&
      normName &&
      !ambiguousNormNames.has(normName) &&
      bucketsByNormName.has(normName)
    ) {
      const cands = bucketsByNormName.get(normName)!;
      if (cands.length === 1) existing = cands[0];
    }

    if (existing) {
      if (existing.key !== ms.key && !existing.aliasKeys.includes(ms.key)) {
        existing.aliasKeys.push(ms.key);
      }
      continue;
    }

    const manualBucket: InternalStudentBucket = {
      key: ms.key,
      isManualOnly: true,
      originalOrder: orderCounter++,
      name: trimmedName,
      autoBySubject: {},
      aliasKeys: [],
      mergedSourceKeys: [],
    };
    registerBucket(manualBucket);
  }

  // 3. Appliquer les fusions validées par le professeur ("C'est le même élève")
  const absorbedKeys = new Set<string>();
  for (const link of mergedLinks) {
    if (!link?.primaryKey || !Array.isArray(link.mergedKeys)) continue;
    const primary = bucketByKey.get(link.primaryKey);
    if (!primary || absorbedKeys.has(primary.key)) continue;

    for (const secKey of link.mergedKeys) {
      if (!secKey || secKey === primary.key || absorbedKeys.has(secKey)) {
        continue;
      }
      const secondary = bucketByKey.get(secKey);
      if (!secondary) continue;

      // Fusionner les notes des matières (priorité au primary si jamais la même matière existe des 2 côtés)
      for (const [subjId, val] of Object.entries(secondary.autoBySubject)) {
        if (!(subjId in primary.autoBySubject)) {
          primary.autoBySubject[subjId] = val;
        } else if (primary.autoBySubject[subjId] === null && val !== null) {
          primary.autoBySubject[subjId] = val;
        }
      }

      if (!primary.name && secondary.name) primary.name = secondary.name;
      if (!primary.matricule && secondary.matricule) {
        primary.matricule = secondary.matricule;
      }
      if (!primary.photoUrl && secondary.photoUrl) {
        primary.photoUrl = secondary.photoUrl;
      }
      if (!primary.photoR2Key && secondary.photoR2Key) {
        primary.photoR2Key = secondary.photoR2Key;
      }
      if (primary.isManualOnly && !secondary.isManualOnly) {
        primary.isManualOnly = false;
      }

      if (!primary.aliasKeys.includes(secondary.key)) {
        primary.aliasKeys.push(secondary.key);
      }
      for (const al of secondary.aliasKeys) {
        if (!primary.aliasKeys.includes(al)) primary.aliasKeys.push(al);
      }
      if (!primary.mergedSourceKeys.includes(secondary.key)) {
        primary.mergedSourceKeys.push(secondary.key);
      }
      absorbedKeys.add(secondary.key);
    }
  }

  const finalBuckets = buckets.filter((b) => !absorbedKeys.has(b.key));

  // 4. Calculer pour chaque élève : Moy./20, Moy.×Coeff, Total Général, Moyenne Générale & Mention
  const computedDraft = finalBuckets.map((bucket) => {
    const cellsBySubject: Record<string, ComputedSubjectCell> = {};
    const subjectsForAvg: SubjectForGeneralAverage[] = [];

    for (const subject of normalizedSubjects) {
      const rawAutoAvg20 =
        subject.id in bucket.autoBySubject
          ? bucket.autoBySubject[subject.id]
          : null;
      const autoAvg =
        rawAutoAvg20 !== null && Number.isFinite(rawAutoAvg20)
          ? rawAutoAvg20 * scaleFactor
          : null;

      let rawManualAvg20: number | null = null;
      const directMap = subjectOverrides[bucket.key];
      if (
        directMap &&
        directMap[subject.id] !== undefined &&
        directMap[subject.id] !== null &&
        Number.isFinite(Number(directMap[subject.id]))
      ) {
        rawManualAvg20 = Number(directMap[subject.id]);
      } else {
        for (const alias of bucket.aliasKeys) {
          const aliasMap = subjectOverrides[alias];
          if (
            aliasMap &&
            aliasMap[subject.id] !== undefined &&
            aliasMap[subject.id] !== null &&
            Number.isFinite(Number(aliasMap[subject.id]))
          ) {
            rawManualAvg20 = Number(aliasMap[subject.id]);
            break;
          }
        }
      }
      const manualAvg =
        rawManualAvg20 !== null && Number.isFinite(rawManualAvg20)
          ? rawManualAvg20 * scaleFactor
          : null;

      let effectiveAverage: number | null = null;
      let source: 'gradebook' | 'manual' | 'empty' = 'empty';

      if (autoAvg !== null && Number.isFinite(autoAvg)) {
        effectiveAverage = autoAvg;
        source = 'gradebook';
      } else if (manualAvg !== null && Number.isFinite(manualAvg)) {
        effectiveAverage = manualAvg;
        source = 'manual';
      }

      const weightedValue =
        effectiveAverage !== null
          ? effectiveAverage * subject.effectiveCoeff
          : null;

      cellsBySubject[subject.id] = {
        subjectId: subject.id,
        effectiveCoeff: subject.effectiveCoeff,
        autoAverage: autoAvg,
        manualAverage: manualAvg,
        effectiveAverage,
        source,
        weightedValue,
      };

      subjectsForAvg.push({
        moyenneMatiere: effectiveAverage,
        coeffMatiere: subject.effectiveCoeff,
      });
    }

    const genRes = calculateGeneralAverage(subjectsForAvg);
    const presentSubjectIds = Object.keys(bucket.autoBySubject);
    let overrideMatricule: string | undefined;
    if (typeof matriculeOverrides[bucket.key] === 'string' && matriculeOverrides[bucket.key].trim()) {
      overrideMatricule = matriculeOverrides[bucket.key].trim();
    } else {
      for (const alias of bucket.aliasKeys) {
        if (typeof matriculeOverrides[alias] === 'string' && matriculeOverrides[alias].trim()) {
          overrideMatricule = matriculeOverrides[alias].trim();
          break;
        }
      }
    }
    const effectiveMatricule = overrideMatricule || bucket.matricule || undefined;

    return {
      key: bucket.key,
      studentUid: bucket.studentUid,
      isManualOnly: bucket.isManualOnly,
      originalOrder: bucket.originalOrder,
      name: bucket.name,
      matricule: effectiveMatricule,
      photoUrl: bucket.photoUrl,
      photoR2Key: bucket.photoR2Key,
      presentSubjectIds,
      mergedSourceKeys: bucket.mergedSourceKeys,
      cellsBySubject,
      totalGeneral: genRes.matieresComptees > 0 ? genRes.pointsTotaux : null,
      totalCoeffCounted: genRes.sommeCoeffsMatiere,
      gradedSubjectsCount: genRes.matieresComptees,
      generalAverage: genRes.moyenneGenerale,
      mention: getMentionFromCustomRules(
        genRes.moyenneGenerale,
        input.mentionRules,
        averageScale
      ),
    };
  });

  // 5. Rangs avec gestion des ex æquo (tolérance 1e-6)
  const rankMap = calculateClassRanks(
    computedDraft.map((s) => ({
      id: s.key,
      moyenne: s.generalAverage,
    })),
    { tolerance: 1e-6 }
  );

  const studentsWithRanks: ComputedTermAverageStudent[] = computedDraft.map(
    (s) => {
      const rankEntry = rankMap.get(s.key);
      return {
        ...s,
        rankNumber: rankEntry ? rankEntry.rankNumber : null,
        rankLabel:
          rankEntry && rankEntry.rankNumber !== null
            ? rankEntry.rankLabel
            : '—',
        isExAequo: rankEntry ? rankEntry.isExAequo : false,
      };
    }
  );

  // 6. Tri d'affichage
  const sortedStudents = [...studentsWithRanks].sort((a, b) => {
    if (sortMode === 'alpha') {
      const aName = a.name.trim();
      const bName = b.name.trim();
      if (!aName && bName) return 1;
      if (aName && !bName) return -1;
      const cmp = aName.localeCompare(bName, 'fr', { sensitivity: 'base' });
      return cmp !== 0 ? cmp : a.originalOrder - b.originalOrder;
    }
    if (sortMode === 'order') {
      return a.originalOrder - b.originalOrder;
    }
    if (a.rankNumber !== null && b.rankNumber !== null) {
      if (a.rankNumber !== b.rankNumber) return a.rankNumber - b.rankNumber;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    }
    if (a.rankNumber !== null) return -1;
    if (b.rankNumber !== null) return 1;
    const aName = a.name.trim();
    const bName = b.name.trim();
    if (!aName && bName) return 1;
    if (aName && !bName) return -1;
    return a.originalOrder - b.originalOrder;
  });

  // 7. Bilan automatique de la classe (pied de tableau)
  const bySubject: Record<string, ComputedSubjectClassStats> = {};
  let totalClassCoeff = 0;

  for (const subject of normalizedSubjects) {
    totalClassCoeff += subject.effectiveCoeff;
    let sumAvg = 0;
    let sumWeighted = 0;
    let count = 0;
    for (const st of sortedStudents) {
      const cell = st.cellsBySubject[subject.id];
      if (cell && cell.effectiveAverage !== null && cell.weightedValue !== null) {
        sumAvg += cell.effectiveAverage;
        sumWeighted += cell.weightedValue;
        count += 1;
      }
    }
    bySubject[subject.id] = {
      subjectId: subject.id,
      effectiveCoeff: subject.effectiveCoeff,
      classAverage20: count > 0 ? sumAvg / count : null,
      classWeightedAverage: count > 0 ? sumWeighted / count : null,
      gradedCount: count,
    };
  }

  let sumGeneral = 0;
  let sumTotalGeneral = 0;
  let gradedStudentCount = 0;
  let highestAverage: number | null = null;
  let lowestAverage: number | null = null;
  let passCount = 0;

  for (const st of sortedStudents) {
    if (st.generalAverage !== null && st.totalGeneral !== null) {
      sumGeneral += st.generalAverage;
      sumTotalGeneral += st.totalGeneral;
      gradedStudentCount += 1;
      if (highestAverage === null || st.generalAverage > highestAverage) {
        highestAverage = st.generalAverage;
      }
      if (lowestAverage === null || st.generalAverage < lowestAverage) {
        lowestAverage = st.generalAverage;
      }
      if (st.generalAverage + 1e-9 >= passThreshold) {
        passCount += 1;
      }
    }
  }

  const classSummary: ComputedTermClassSummary = {
    totalStudents: sortedStudents.length,
    gradedStudentCount,
    totalClassCoeff,
    bySubject,
    classTotalGeneralAvg:
      gradedStudentCount > 0 ? sumTotalGeneral / gradedStudentCount : null,
    classGeneralAverage:
      gradedStudentCount > 0 ? sumGeneral / gradedStudentCount : null,
    highestAverage,
    lowestAverage,
    passCount,
    passRatePercent:
      gradedStudentCount > 0 ? (passCount / gradedStudentCount) * 100 : null,
  };

  // 8. Couche 3 : Détection des doublons potentiels pour validation humaine
  const potentialDuplicates = detectPotentialDuplicateStudents(
    sortedStudents,
    subjectsById,
    distinctPairSet
  );

  return {
    subjects: normalizedSubjects,
    students: sortedStudents,
    classSummary,
    potentialDuplicates,
    averageScale,
  };
}
