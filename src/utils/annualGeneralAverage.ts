import {
  computeTermGeneralAverageTable,
  normalizeStudentNameKey,
  type ComputedSubjectCell,
  type GradebookStudentSnapshot,
  type PotentialDuplicateCandidate,
  type TermAverageOverrides,
  type TermAverageSortMode,
  type TermAverageSubject,
} from './termGeneralAverage';
import type { CustomMentionRule } from './gradebookCalculations';

export interface AnnualTermData {
  id: string;
  averageCardId?: string;
  number: number;
  name: string;
  coefficient: number | null;
  effectiveCoeff: number;
  overrides?: TermAverageOverrides | null;
  subjects: TermAverageSubject[];
  subjectGradebooks: Record<string, GradebookStudentSnapshot[]>;
}

export interface AnnualTermColumn {
  id: string;
  averageCardId?: string;
  number: number;
  name: string;
  coefficient: number | null;
  effectiveCoeff: number;
  subjectsCount: number;
}

export interface ComputedAnnualTermCell extends ComputedSubjectCell {
  termId: string;
  termRankNumber: number | null;
  termRankLabel: string;
  gradedSubjectsCount: number;
  totalSubjectsCount: number;
}

export interface ComputedAnnualStudent {
  key: string;
  studentUid?: string;
  isManualOnly: boolean;
  originalOrder: number;
  name: string;
  matricule?: string;
  photoUrl?: string;
  photoR2Key?: string;
  presentTermIds: string[];
  mergedSourceKeys: string[];
  cellsByTerm: Record<string, ComputedAnnualTermCell>;
  totalAnnual: number | null;
  totalCoeffCounted: number;
  gradedTermsCount: number;
  totalTermsCount: number;
  annualAverage: number | null;
  /** Évolution entre le dernier trimestre noté et le premier trimestre noté (ex: +1,50 ou -0,50) */
  progressionDelta: number | null;
  mention: string;
  decision: 'Admis(e)' | 'Ajourné(e)' | '—';
  rankNumber: number | null;
  rankLabel: string;
  isExAequo: boolean;
}

export interface ComputedAnnualTermClassStats {
  termId: string;
  effectiveCoeff: number;
  classAverage20: number | null;
  classWeightedAverage: number | null;
  gradedCount: number;
}

export interface ComputedAnnualClassSummary {
  totalStudents: number;
  gradedStudentCount: number;
  totalClassCoeff: number;
  byTerm: Record<string, ComputedAnnualTermClassStats>;
  classTotalAnnualAvg: number | null;
  classAnnualAverage: number | null;
  highestAverage: number | null;
  lowestAverage: number | null;
  passCount: number;
  passRatePercent: number | null;
}

export interface ComputedAnnualAverageTable {
  terms: AnnualTermColumn[];
  students: ComputedAnnualStudent[];
  classSummary: ComputedAnnualClassSummary;
  potentialDuplicates: PotentialDuplicateCandidate[];
}

export interface ComputeAnnualAverageInput {
  terms: AnnualTermData[];
  overrides?: TermAverageOverrides | null;
  sortMode?: TermAverageSortMode;
  mentionRules?: readonly CustomMentionRule[] | null;
}

const getEffectiveTermCoeff = (coeff?: number | null): number => {
  if (coeff === null || coeff === undefined) return 1;
  const n = Number(coeff);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
};

/**
 * Calcule automatiquement la Moyenne Générale Annuelle d'une classe :
 * 1. Calcule la moyenne officielle exacte de chaque trimestre (en respectant les coefficients
 *    de matières, les fusions d'élèves validées et les saisies de chaque trimestre).
 * 2. Réunit automatiquement les élèves d'un trimestre à l'autre avec le moteur 3 couches
 *    (studentUid exact -> normalisation sûre -> détection des noms proches sans fusion silencieuse).
 * 3. Pondère chaque trimestre par son coefficient (par défaut 1) sans pénaliser les trimestres
 *    non encore notés en cours d'année.
 */
export function computeAnnualGeneralAverageTable(
  input: ComputeAnnualAverageInput
): ComputedAnnualAverageTable {
  const sortedTerms = [...(input.terms || [])].sort(
    (a, b) => (a.number || 0) - (b.number || 0)
  );

  const termColumns: AnnualTermColumn[] = sortedTerms.map((t) => ({
    id: t.id,
    averageCardId: t.averageCardId,
    number: t.number,
    name: t.name,
    coefficient:
      t.coefficient !== null && t.coefficient !== undefined && Number(t.coefficient) > 0
        ? Number(t.coefficient)
        : null,
    effectiveCoeff: getEffectiveTermCoeff(t.coefficient),
    subjectsCount: (t.subjects || []).length,
  }));

  // 1. Calculer le tableau officiel exact de chaque trimestre
  const termGradebooks: Record<string, GradebookStudentSnapshot[]> = {};
  const termStudentLookup = new Map<
    string,
    {
      byUid: Map<string, { rankNumber: number | null; rankLabel: string; gradedSubjectsCount: number }>;
      byKey: Map<string, { rankNumber: number | null; rankLabel: string; gradedSubjectsCount: number }>;
      byNormName: Map<string, { rankNumber: number | null; rankLabel: string; gradedSubjectsCount: number }>;
    }
  >();

  for (const term of sortedTerms) {
    const computedTerm = computeTermGeneralAverageTable({
      subjects: term.subjects || [],
      subjectGradebooks: term.subjectGradebooks || {},
      overrides: term.overrides || {},
      sortMode: 'merit',
    });

    const snapshots: GradebookStudentSnapshot[] = [];
    const byUid = new Map<string, { rankNumber: number | null; rankLabel: string; gradedSubjectsCount: number }>();
    const byKey = new Map<string, { rankNumber: number | null; rankLabel: string; gradedSubjectsCount: number }>();
    const byNormName = new Map<string, { rankNumber: number | null; rankLabel: string; gradedSubjectsCount: number }>();

    for (const st of computedTerm.students) {
      const meta = {
        rankNumber: st.rankNumber,
        rankLabel: st.rankLabel,
        gradedSubjectsCount: st.gradedSubjectsCount,
      };
      if (st.studentUid) byUid.set(st.studentUid, meta);
      byKey.set(st.key, meta);
      const norm = normalizeStudentNameKey(st.name);
      if (norm && !byNormName.has(norm)) {
        byNormName.set(norm, meta);
      }

      snapshots.push({
        id: `${term.id}_${st.key}`,
        studentUid: st.studentUid || '',
        name: st.name,
        matricule: st.matricule,
        photoUrl: st.photoUrl,
        photoR2Key: st.photoR2Key,
        average20: st.generalAverage,
        notesCount: st.gradedSubjectsCount,
      });
    }

    termGradebooks[term.id] = snapshots;
    termStudentLookup.set(term.id, { byUid, byKey, byNormName });
  }

  // 2. Agréger tous les trimestres via le moteur 3 couches unifié
  const termAsSubjects = termColumns.map((t) => ({
    id: t.id,
    name: t.name,
    coefficient: t.coefficient,
  }));

  const aggregated = computeTermGeneralAverageTable({
    subjects: termAsSubjects,
    subjectGradebooks: termGradebooks,
    overrides: input.overrides || {},
    sortMode: input.sortMode || 'merit',
    mentionRules: input.mentionRules,
  });

  // 3. Enrichir chaque élève avec les données annuelles (rangs par trimestre, évolution, décision)
  const students: ComputedAnnualStudent[] = aggregated.students.map((st) => {
    const cellsByTerm: Record<string, ComputedAnnualTermCell> = {};
    const gradedSeries: number[] = [];

    for (const termCol of termColumns) {
      const baseCell = st.cellsBySubject[termCol.id] || {
        subjectId: termCol.id,
        effectiveCoeff: termCol.effectiveCoeff,
        autoAverage: null,
        manualAverage: null,
        effectiveAverage: null,
        source: 'empty' as const,
        weightedValue: null,
      };

      const lookup = termStudentLookup.get(termCol.id);
      const norm = normalizeStudentNameKey(st.name);
      const meta =
        (st.studentUid && lookup?.byUid.get(st.studentUid)) ||
        lookup?.byKey.get(st.key) ||
        st.mergedSourceKeys.map((mk) => lookup?.byKey.get(mk)).find(Boolean) ||
        (norm ? lookup?.byNormName.get(norm) : undefined);

      if (baseCell.effectiveAverage !== null) {
        gradedSeries.push(baseCell.effectiveAverage);
      }

      cellsByTerm[termCol.id] = {
        ...baseCell,
        termId: termCol.id,
        termRankNumber: meta?.rankNumber ?? null,
        termRankLabel: meta?.rankLabel ?? '—',
        gradedSubjectsCount: meta?.gradedSubjectsCount ?? 0,
        totalSubjectsCount: termCol.subjectsCount,
      };
    }

    const progressionDelta =
      gradedSeries.length >= 2
        ? gradedSeries[gradedSeries.length - 1] - gradedSeries[0]
        : null;

    const decision: 'Admis(e)' | 'Ajourné(e)' | '—' =
      st.generalAverage === null
        ? '—'
        : st.generalAverage >= 10
        ? 'Admis(e)'
        : 'Ajourné(e)';

    return {
      key: st.key,
      studentUid: st.studentUid,
      isManualOnly: st.isManualOnly,
      originalOrder: st.originalOrder,
      name: st.name,
      matricule: st.matricule,
      photoUrl: st.photoUrl,
      photoR2Key: st.photoR2Key,
      presentTermIds: st.presentSubjectIds,
      mergedSourceKeys: st.mergedSourceKeys,
      cellsByTerm,
      totalAnnual: st.totalGeneral,
      totalCoeffCounted: st.totalCoeffCounted,
      gradedTermsCount: st.gradedSubjectsCount,
      totalTermsCount: termColumns.length,
      annualAverage: st.generalAverage,
      progressionDelta,
      mention: st.mention,
      decision,
      rankNumber: st.rankNumber,
      rankLabel: st.rankLabel,
      isExAequo: st.isExAequo,
    };
  });

  const byTerm: Record<string, ComputedAnnualTermClassStats> = {};
  for (const termCol of termColumns) {
    const stat = aggregated.classSummary.bySubject[termCol.id];
    byTerm[termCol.id] = {
      termId: termCol.id,
      effectiveCoeff: termCol.effectiveCoeff,
      classAverage20: stat?.classAverage20 ?? null,
      classWeightedAverage: stat?.classWeightedAverage ?? null,
      gradedCount: stat?.gradedCount ?? 0,
    };
  }

  return {
    terms: termColumns,
    students,
    classSummary: {
      totalStudents: aggregated.classSummary.totalStudents,
      gradedStudentCount: aggregated.classSummary.gradedStudentCount,
      totalClassCoeff: aggregated.classSummary.totalClassCoeff,
      byTerm,
      classTotalAnnualAvg: aggregated.classSummary.classTotalGeneralAvg,
      classAnnualAverage: aggregated.classSummary.classGeneralAverage,
      highestAverage: aggregated.classSummary.highestAverage,
      lowestAverage: aggregated.classSummary.lowestAverage,
      passCount: aggregated.classSummary.passCount,
      passRatePercent: aggregated.classSummary.passRatePercent,
    },
    potentialDuplicates: aggregated.potentialDuplicates,
  };
}
