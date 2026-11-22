import {
  calculateClassRanks,
  calculateGeneralAverage,
  getMention,
  type SubjectForGeneralAverage,
} from './gradebookCalculations';

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

export interface TermAverageOverrides {
  manualStudents?: ManualAverageStudent[];
  /** Moyennes saisies directement dans ce tableau (mode hybride), indexées par [studentKey][subjectId] */
  subjectOverrides?: Record<string, Record<string, number | null>>;
}

export interface TermAverageLayoutState {
  colWidthRank?: number;
  colWidthPhoto?: number;
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
  photoUrl?: string;
  photoR2Key?: string;
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
}

/**
 * Normalise un nom complet pour faire correspondre le même élève entre plusieurs matières
 * (insensible aux majuscules, accents et espaces multiples).
 */
export function normalizeStudentNameKey(name: string | null | undefined): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

export function parseManualAverageInput(raw: string): {
  valid: boolean;
  value: number | null;
} {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') {
    return { valid: true, value: null };
  }
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { valid: false, value: null };
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0 || num > 20) {
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
  photoUrl?: string;
  photoR2Key?: string;
  autoBySubject: Record<string, number | null>;
  aliasKeys: string[];
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
}

/**
 * Unifie automatiquement les élèves de toutes les matières d'un trimestre, calcule pour chacun :
 * - Moyenne /20 par matière (automatique depuis la matière, ou saisie manuelle hybride si vide)
 * - Moyenne × Coeff par matière
 * - Total Général (somme des Moyenne × Coeff)
 * - Moyenne Générale /20 (Total Général / Total Coeff des matières notées)
 * - Mention & Rang (avec gestion ex æquo)
 * - Moyenne de la classe (par matière et globale)
 */
export function computeTermGeneralAverageTable(
  input: ComputeTermAverageInput
): ComputedTermAverageTable {
  const normalizedSubjects: TermAverageSubject[] = (input.subjects || []).map((s) => ({
    ...s,
    effectiveCoeff: getEffectiveSubjectCoeff(s.coefficient),
  }));

  const overrides = input.overrides || {};
  const subjectOverrides = overrides.subjectOverrides || {};
  const manualStudents = Array.isArray(overrides.manualStudents)
    ? overrides.manualStudents
    : [];
  const sortMode: TermAverageSortMode = input.sortMode || 'merit';

  const buckets: InternalStudentBucket[] = [];
  const bucketByUid = new Map<string, InternalStudentBucket>();
  const bucketsByNormName = new Map<string, InternalStudentBucket[]>();
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
      const uid = String(row.studentUid || '').trim();

      let target: InternalStudentBucket | undefined;

      // Correspondance prioritaire par studentUid stable (s'il n'a pas déjà une entrée dans cette matière)
      if (uid && bucketByUid.has(uid)) {
        const candidate = bucketByUid.get(uid)!;
        if (!(subject.id in candidate.autoBySubject)) {
          target = candidate;
        }
      }

      // Sinon correspondance par nom normalisé (sans collision intra-matière pour préserver les homonymes)
      if (!target && normName && bucketsByNormName.has(normName)) {
        const candidates = bucketsByNormName.get(normName)!;
        target = candidates.find((c) => !(subject.id in c.autoBySubject));
      }

      if (!target) {
        const baseKey = normName
          ? `name:${normName}`
          : uid
          ? `uid:${uid}`
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
          photoUrl: row.photoUrl || undefined,
          photoR2Key: row.photoR2Key || undefined,
          autoBySubject: {},
          aliasKeys: [],
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

      target.autoBySubject[subject.id] = hasValidAvg ? Number(row.average20) : null;
    }
  }

  // 2. Intégrer les élèves ajoutés manuellement dans le tableau de Moyenne générale (mode hybride)
  for (const ms of manualStudents) {
    if (!ms || !ms.key) continue;
    const trimmedName = String(ms.name || '').trim();
    const normName = normalizeStudentNameKey(trimmedName);

    // Si l'élève existe déjà via les matières (même clé ou même nom), fusionner son alias pour conserver ses saisies manuelles
    let existing = bucketByKey.get(ms.key);
    if (!existing && normName && bucketsByNormName.has(normName)) {
      existing = bucketsByNormName.get(normName)![0];
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
    };
    registerBucket(manualBucket);
  }

  // 3. Calculer pour chaque élève : Moy./20, Moy.×Coeff, Total Général, Moyenne Générale & Mention
  const computedDraft = buckets.map((bucket) => {
    const cellsBySubject: Record<string, ComputedSubjectCell> = {};
    const subjectsForAvg: SubjectForGeneralAverage[] = [];

    for (const subject of normalizedSubjects) {
      const autoAvg =
        subject.id in bucket.autoBySubject ? bucket.autoBySubject[subject.id] : null;

      // Chercher une éventuelle saisie manuelle (clé principale ou alias fusionné)
      let manualAvg: number | null = null;
      const directMap = subjectOverrides[bucket.key];
      if (
        directMap &&
        directMap[subject.id] !== undefined &&
        directMap[subject.id] !== null &&
        Number.isFinite(Number(directMap[subject.id]))
      ) {
        manualAvg = Number(directMap[subject.id]);
      } else {
        for (const alias of bucket.aliasKeys) {
          const aliasMap = subjectOverrides[alias];
          if (
            aliasMap &&
            aliasMap[subject.id] !== undefined &&
            aliasMap[subject.id] !== null &&
            Number.isFinite(Number(aliasMap[subject.id]))
          ) {
            manualAvg = Number(aliasMap[subject.id]);
            break;
          }
        }
      }

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
        effectiveAverage !== null ? effectiveAverage * subject.effectiveCoeff : null;

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

    return {
      key: bucket.key,
      studentUid: bucket.studentUid,
      isManualOnly: bucket.isManualOnly,
      originalOrder: bucket.originalOrder,
      name: bucket.name,
      photoUrl: bucket.photoUrl,
      photoR2Key: bucket.photoR2Key,
      cellsBySubject,
      totalGeneral: genRes.matieresComptees > 0 ? genRes.pointsTotaux : null,
      totalCoeffCounted: genRes.sommeCoeffsMatiere,
      gradedSubjectsCount: genRes.matieresComptees,
      generalAverage: genRes.moyenneGenerale,
      mention: getMention(genRes.moyenneGenerale),
    };
  });

  // 4. Rangs avec gestion des ex æquo (tolérance 1e-6 cohérente avec le tableur des matières)
  const rankMap = calculateClassRanks(
    computedDraft.map((s) => ({
      id: s.key,
      moyenne: s.generalAverage,
    })),
    { tolerance: 1e-6 }
  );

  const studentsWithRanks: ComputedTermAverageStudent[] = computedDraft.map((s) => {
    const rankEntry = rankMap.get(s.key);
    return {
      ...s,
      rankNumber: rankEntry ? rankEntry.rankNumber : null,
      rankLabel: rankEntry && rankEntry.rankNumber !== null ? rankEntry.rankLabel : '—',
      isExAequo: rankEntry ? rankEntry.isExAequo : false,
    };
  });

  // 5. Tri d'affichage
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
    // Par défaut : ordre de mérite (1er → dernier, puis non classés par nom / ordre initial)
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

  // 6. Bilan automatique de la classe (pied de tableau)
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
      if (st.generalAverage >= 10) {
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

  return {
    subjects: normalizedSubjects,
    students: sortedStudents,
    classSummary,
  };
}
