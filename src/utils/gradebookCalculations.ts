/**
 * Module pur de calcul scolaire : notes, moyennes par matière (/20),
 * moyenne générale pondérée par coefficients de matières, mentions et rangs avec gestion des ex æquo.
 */

export interface EvaluationInput {
  /** Note saisie par le professeur (>= 0), ou null / undefined / '' si non saisie */
  valeur: number | string | null | undefined;
  /** Barème maximal de l'évaluation (ex: 20, 40, 30... strictement > 0) */
  max: number;
  /** Coefficient propre à l'évaluation (par défaut 1, strictement > 0) */
  coeffEval?: number;
}

export const DEFAULT_AVERAGE_SCALE = 20;
export const MIN_AVERAGE_SCALE = 1;
export const MAX_AVERAGE_SCALE = 1000;

/**
 * Valide et normalise un barème maximal de moyenne (ex: 10, 20, 30, 40, 50, 100...).
 * Retourne null si invalide ou hors bornes [1, 1000].
 */
export function sanitizeAverageScale(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num =
    typeof raw === 'string'
      ? Number(raw.trim().replace(',', '.'))
      : Number(raw);
  if (!Number.isFinite(num) || num < MIN_AVERAGE_SCALE || num > MAX_AVERAGE_SCALE) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

/**
 * Formate proprement un barème pour l'affichage (ex: 20 -> "20", 40 -> "40", 12.5 -> "12,5").
 */
export function formatScaleValue(scale: number | null | undefined): string {
  const safe = sanitizeAverageScale(scale) ?? DEFAULT_AVERAGE_SCALE;
  if (Math.abs(safe - Math.round(safe)) < 1e-6) {
    return String(Math.round(safe));
  }
  return safe.toFixed(2).replace(/0$/, '').replace('.', ',');
}

export interface SubjectAverageOptions {
  /** Si true, toute note strictement supérieure à son barème max est considérée invalide */
  rejectExceedingMax?: boolean;
  /** Barème maximal cible de la moyenne (défaut : 20 — ex: 20, 40, 50, 100...) */
  targetScale?: number;
}

export interface SubjectAverageResult {
  /** Moyenne de la matière ramenée sur 20 avec pleine précision flottante, ou null si aucune note valide */
  moyenneMatiere: number | null;
  /** Somme pondérée des notes sur 20 : somme(noteSur20 * coeffEval) */
  totalPondere: number;
  /** Somme des coefficients des évaluations valides : somme(coeffEval) */
  sommeCoeffs: number;
  /** Nombre d'évaluations saisies et valides effectivement prises en compte */
  evaluationsValides: number;
  /** True si au moins une évaluation saisie avait un barème max <= 0 ou invalide */
  hasInvalidScale: boolean;
  /** True si au moins une évaluation saisie dépassait son barème maximal (valeur > max) */
  hasExceedingScore: boolean;
}

export interface SubjectForGeneralAverage {
  /** Moyenne de la matière sur 20 (null si non notée) */
  moyenneMatiere: number | null;
  /** Coefficient de la matière pour la période / le semestre (strictement > 0) */
  coeffMatiere: number;
}

export interface SubjectGradeInput {
  subjectId?: string;
  subjectName?: string;
  evaluations: EvaluationInput[];
  coeffMatiere: number;
}

export interface GeneralAverageResult {
  /** Moyenne générale de la période sur 20 (pleine précision flottante), ou null si aucune matière notée */
  moyenneGenerale: number | null;
  /** Somme des points pondérés : somme(moyenneMatiere * coeffMatiere) */
  pointsTotaux: number;
  /** Somme des coefficients des matières effectivement notées */
  sommeCoeffsMatiere: number;
  /** Nombre de matières valides prises en compte */
  matieresComptees: number;
}

export interface MentionThreshold {
  /** Seuil minimal inclusif sur 20 */
  minInclusive: number;
  /** Libellé de la mention */
  label: string;
}

export interface StudentRankInput {
  id: string;
  moyenne: number | null;
}

export interface StudentRankResult {
  id: string;
  /** Rang numérique (1, 2, 3...) ou null si la moyenne est null */
  rankNumber: number | null;
  /** Libellé formaté ("1er", "1er ex", "2e", "3e", ou "—" si null) */
  rankLabel: string;
  /** True si plusieurs élèves partagent exactement ce rang */
  isExAequo: boolean;
}

export interface RankCalculationOptions {
  /** Tolérance de comparaison flottante pour détecter les ex æquo (défaut: 1e-6) */
  tolerance?: number;
  /** Si true, compare les moyennes après arrondi à 2 décimales */
  compareOnRounded2Decimals?: boolean;
}

/**
 * Seuils de mention par défaut (paramétrables selon l'établissement).
 */
export const DEFAULT_MENTION_THRESHOLDS: readonly MentionThreshold[] = [
  { minInclusive: 16, label: 'Très bien' },
  { minInclusive: 14, label: 'Bien' },
  { minInclusive: 12, label: 'Assez bien' },
  { minInclusive: 10, label: 'Passable' },
  { minInclusive: -Infinity, label: 'Insuffisant' }
];

/**
 * Analyse une valeur de note brute.
 * - null, undefined ou chaîne vide/blanche => null (ignorée, JAMAIS convertie en 0)
 * - 0 ou "0" => 0 (explicitement valide)
 * - valeur négative ou NaN => null
 */
export function parseEvaluationValue(
  valeur: number | string | null | undefined
): number | null {
  if (valeur === null || valeur === undefined) {
    return null;
  }

  if (typeof valeur === 'string') {
    const trimmed = valeur.trim();
    if (trimmed === '') {
      return null;
    }
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  if (!Number.isFinite(valeur) || valeur < 0) {
    return null;
  }

  return valeur;
}

/**
 * Étape A1 : Harmonise une note sur un barème cible (par défaut /20) :
 * noteSurCible = (valeur / max) * targetScale.
 * Retourne null si max <= 0 (évite toute division par zéro) ou si valeur < 0 / invalide.
 */
export function harmonizeScoreOnScale(
  valeur: number,
  max: number,
  targetScale = DEFAULT_AVERAGE_SCALE
): number | null {
  if (!Number.isFinite(max) || max <= 0) {
    return null;
  }
  if (!Number.isFinite(valeur) || valeur < 0) {
    return null;
  }
  const safeTarget = sanitizeAverageScale(targetScale) ?? DEFAULT_AVERAGE_SCALE;
  return (valeur / max) * safeTarget;
}

/**
 * Étape A1 : Harmonise une note sur 20 : noteSur20 = (valeur / max) * 20.
 * Retourne null si max <= 0 (évite toute division par zéro) ou si valeur < 0 / invalide.
 */
export function harmonizeScoreOn20(valeur: number, max: number): number | null {
  return harmonizeScoreOnScale(valeur, max, 20);
}

/**
 * Étapes A1 & A2 : Calcule la moyenne pondérée d'une matière sur `targetScale` (défaut /20) pour un élève.
 * - Ignore toute évaluation vide / null / undefined.
 * - Ignore toute évaluation avec max <= 0 (aucune division par zéro).
 * - Utilise coeffEval (défaut 1 si non défini).
 * - Conserve la pleine précision flottante pour les calculs ultérieurs.
 * - Retourne moyenneMatiere = null si aucune évaluation valide ou somme(coeffEval) === 0.
 */
export function calculateSubjectAverage(
  evaluations: readonly EvaluationInput[],
  options: SubjectAverageOptions = {}
): SubjectAverageResult {
  const targetScale = sanitizeAverageScale(options.targetScale) ?? DEFAULT_AVERAGE_SCALE;
  let totalPondere = 0;
  let sommeCoeffs = 0;
  let evaluationsValides = 0;
  let hasInvalidScale = false;
  let hasExceedingScore = false;

  for (const evaluation of evaluations) {
    const parsedVal = parseEvaluationValue(evaluation.valeur);
    // Ignorer les évaluations non saisies (sans jamais les transformer en 0)
    if (parsedVal === null) {
      continue;
    }

    // Vérifier max > 0 pour empêcher toute division par zéro
    if (!Number.isFinite(evaluation.max) || evaluation.max <= 0) {
      hasInvalidScale = true;
      continue;
    }

    if (parsedVal > evaluation.max) {
      hasExceedingScore = true;
      if (options.rejectExceedingMax) {
        continue;
      }
    }

    const coeff =
      evaluation.coeffEval === undefined || evaluation.coeffEval === null
        ? 1
        : evaluation.coeffEval;

    if (!Number.isFinite(coeff) || coeff <= 0) {
      continue;
    }

    const noteSurCible = harmonizeScoreOnScale(parsedVal, evaluation.max, targetScale);
    if (noteSurCible === null) {
      continue;
    }

    totalPondere += noteSurCible * coeff;
    sommeCoeffs += coeff;
    evaluationsValides += 1;
  }

  const moyenneMatiere =
    evaluationsValides > 0 && sommeCoeffs > 0
      ? totalPondere / sommeCoeffs
      : null;

  return {
    moyenneMatiere,
    totalPondere,
    sommeCoeffs,
    evaluationsValides,
    hasInvalidScale,
    hasExceedingScore
  };
}

/**
 * Étapes B1 & B2 : Calcule la moyenne générale du trimestre / semestre sur 20.
 * - Ne prend en compte que les matières avec moyenneMatiere !== null et coeffMatiere > 0.
 * - pointsMatiere = moyenneMatiere * coeffMatiere
 * - moyenneGenerale = somme(pointsMatiere) / somme(coeffMatiere)
 * - Retourne null si aucune matière n'est notée.
 */
export function calculateGeneralAverage(
  subjects: readonly SubjectForGeneralAverage[]
): GeneralAverageResult {
  let pointsTotaux = 0;
  let sommeCoeffsMatiere = 0;
  let matieresComptees = 0;

  for (const subject of subjects) {
    if (
      subject.moyenneMatiere === null ||
      subject.moyenneMatiere === undefined ||
      !Number.isFinite(subject.moyenneMatiere)
    ) {
      continue;
    }

    if (!Number.isFinite(subject.coeffMatiere) || subject.coeffMatiere <= 0) {
      continue;
    }

    const pointsMatiere = subject.moyenneMatiere * subject.coeffMatiere;
    pointsTotaux += pointsMatiere;
    sommeCoeffsMatiere += subject.coeffMatiere;
    matieresComptees += 1;
  }

  const moyenneGenerale =
    matieresComptees > 0 && sommeCoeffsMatiere > 0
      ? pointsTotaux / sommeCoeffsMatiere
      : null;

  return {
    moyenneGenerale,
    pointsTotaux,
    sommeCoeffsMatiere,
    matieresComptees
  };
}

/**
 * Calcule directement la moyenne générale d'un élève à partir de ses matières et évaluations brutes,
 * en conservant la pleine précision flottante entre les étapes A et B.
 */
export function calculateStudentGeneralAverage(
  subjects: readonly SubjectGradeInput[],
  options: SubjectAverageOptions = {}
): GeneralAverageResult {
  const subjectAverages: SubjectForGeneralAverage[] = subjects.map(subj => {
    const res = calculateSubjectAverage(subj.evaluations, options);
    return {
      moyenneMatiere: res.moyenneMatiere,
      coeffMatiere: subj.coeffMatiere
    };
  });

  return calculateGeneralAverage(subjectAverages);
}

/**
 * Arrondit une moyenne à 2 décimales pour l'affichage.
 */
export function roundAverage2Decimals(moyenne: number | null): number | null {
  if (moyenne === null || !Number.isFinite(moyenne)) {
    return null;
  }
  return Math.round((moyenne + Number.EPSILON) * 100) / 100;
}

/**
 * Formate une moyenne pour l'affichage (2 décimales, ou "—" si null).
 */
export function formatAverageDisplay(
  moyenne: number | null,
  withOutOfScaleSuffix = false,
  targetScale = DEFAULT_AVERAGE_SCALE
): string {
  if (moyenne === null || !Number.isFinite(moyenne)) {
    return '—';
  }
  const formatted = moyenne.toFixed(2);
  return withOutOfScaleSuffix
    ? `${formatted} / ${formatScaleValue(targetScale)}`
    : formatted;
}

/**
 * Détermine la mention pédagogique à partir d'une moyenne sur 20.
 * Seuils par défaut :
 * - < 10 : "Insuffisant"
 * - >= 10 et < 12 : "Passable"
 * - >= 12 et < 14 : "Assez bien"
 * - >= 14 et < 16 : "Bien"
 * - >= 16 : "Très bien"
 * - null : "—"
 */
export function getMention(
  moyenne: number | null,
  thresholds: readonly MentionThreshold[] = DEFAULT_MENTION_THRESHOLDS
): string {
  if (moyenne === null || !Number.isFinite(moyenne)) {
    return '—';
  }

  const sorted = [...thresholds].sort((a, b) => b.minInclusive - a.minInclusive);
  for (const threshold of sorted) {
    if (moyenne >= threshold.minInclusive) {
      return threshold.label;
    }
  }

  return 'Insuffisant';
}

/**
 * Formate le libellé d'un rang scolaire français ("1er", "1er ex", "2e", "3e ex", ou "—").
 */
export function formatRankLabel(
  rankNumber: number | null,
  isExAequo: boolean
): string {
  if (rankNumber === null || rankNumber < 1) {
    return '—';
  }
  const base = rankNumber === 1 ? '1er' : `${rankNumber}e`;
  return isExAequo ? `${base} ex` : base;
}

/**
 * Calcule le rang de chaque élève dans la classe pour une matière ou une période.
 * - Trie les élèves ayant une moyenne valide par ordre décroissant.
 * - Gère les ex æquo avec tolérance flottante (défaut 1e-6) ou sur valeur arrondie à 2 décimales.
 * - Attribue le même rang à tous les ex æquo (ex: 1er ex, 1er ex, 3e).
 * - Les élèves sans moyenne (null) reçoivent rankNumber: null et rankLabel: "—".
 */
export function calculateClassRanks(
  students: readonly StudentRankInput[],
  options: RankCalculationOptions = {}
): Map<string, StudentRankResult> {
  const tolerance = options.tolerance ?? 1e-6;
  const compareOnRounded = options.compareOnRounded2Decimals ?? false;

  const getComparableValue = (val: number): number =>
    compareOnRounded ? Math.round((val + Number.EPSILON) * 100) / 100 : val;

  const validStudents = students
    .filter(
      (s): s is { id: string; moyenne: number } =>
        s.moyenne !== null && Number.isFinite(s.moyenne)
    )
    .sort((a, b) => getComparableValue(b.moyenne) - getComparableValue(a.moyenne));

  // Assigner les rangs numériques en regroupant les ex æquo
  const assigned: Array<{ id: string; rankNumber: number }> = [];
  let currentRank = 1;

  for (let i = 0; i < validStudents.length; i++) {
    const currVal = getComparableValue(validStudents[i].moyenne);
    if (i > 0) {
      const prevVal = getComparableValue(validStudents[i - 1].moyenne);
      if (Math.abs(currVal - prevVal) > tolerance) {
        currentRank = i + 1;
      }
    }
    assigned.push({ id: validStudents[i].id, rankNumber: currentRank });
  }

  // Compter combien d'élèves partagent chaque rang pour marquer TOUS les ex æquo
  const rankCounts = new Map<number, number>();
  for (const entry of assigned) {
    rankCounts.set(entry.rankNumber, (rankCounts.get(entry.rankNumber) || 0) + 1);
  }

  const resultMap = new Map<string, StudentRankResult>();

  for (const entry of assigned) {
    const isExAequo = (rankCounts.get(entry.rankNumber) || 0) > 1;
    resultMap.set(entry.id, {
      id: entry.id,
      rankNumber: entry.rankNumber,
      rankLabel: formatRankLabel(entry.rankNumber, isExAequo),
      isExAequo
    });
  }

  // Élèves sans moyenne valide => rang "—"
  for (const student of students) {
    if (!resultMap.has(student.id)) {
      resultMap.set(student.id, {
        id: student.id,
        rankNumber: null,
        rankLabel: '—',
        isExAequo: false
      });
    }
  }

  return resultMap;
}

export type GradebookSortMode = 'order' | 'merit' | 'alpha';

export interface SortableGradebookRow {
  id: string;
  name: string;
  average: number | null;
  hasInvalidNote?: boolean;
  notes?: string[];
  originalIndex: number;
}

/**
 * Trie les lignes d'un carnet de notes par matière selon le mode choisi :
 * - 'merit' : Ordre de mérite (1er -> dernier), puis élèves nommés sans moyenne, puis lignes vides en bas.
 * - 'alpha' : Ordre alphabétique (A -> Z) sur le nom/prénom, lignes vides toujours en bas.
 * - 'order' : Ordre initial de saisie.
 * - Si `lockedOrderIds` est fourni (saisie active dans une cellule), conserve l'ordre visuel courant
 *   jusqu'à la fin de l'édition pour éviter tout saut de curseur.
 */
export function sortGradebookRows<T extends SortableGradebookRow>(
  rows: readonly T[],
  sortMode: GradebookSortMode,
  lockedOrderIds?: readonly string[] | null
): T[] {
  if (lockedOrderIds && lockedOrderIds.length > 0) {
    const posMap = new Map<string, number>();
    lockedOrderIds.forEach((id, idx) => posMap.set(id, idx));
    return [...rows].sort((a, b) => {
      const pa = posMap.has(a.id) ? posMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const pb = posMap.has(b.id) ? posMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.originalIndex - b.originalIndex;
    });
  }

  if (sortMode === 'order') {
    return [...rows].sort((a, b) => a.originalIndex - b.originalIndex);
  }

  const isRowEmpty = (r: T): boolean => {
    const hasName = (r.name || '').trim().length > 0;
    const hasAvg =
      r.average !== null && r.average !== undefined && Number.isFinite(r.average);
    const hasNotes =
      Array.isArray(r.notes) &&
      r.notes.some((n) => {
        const raw = String(n || '').trim();
        if (!raw) return false;
        const scorePart = raw.split('/')[0]?.trim() || '';
        return scorePart.length > 0 && scorePart !== '-';
      });
    return !hasName && !hasAvg && !hasNotes;
  };

  return [...rows].sort((a, b) => {
    const emptyA = isRowEmpty(a);
    const emptyB = isRowEmpty(b);
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    if (emptyA && emptyB) return a.originalIndex - b.originalIndex;

    if (sortMode === 'alpha') {
      const cmp = (a.name || '')
        .trim()
        .localeCompare((b.name || '').trim(), 'fr', {
          sensitivity: 'base',
          numeric: true,
        });
      return cmp !== 0 ? cmp : a.originalIndex - b.originalIndex;
    }

    // 'merit' : moyenne décroissante (1er -> dernier), puis élèves nommés sans moyenne
    const validA = !a.hasInvalidNote && a.average !== null && Number.isFinite(a.average);
    const validB = !b.hasInvalidNote && b.average !== null && Number.isFinite(b.average);
    if (validA !== validB) return validA ? -1 : 1;
    if (validA && validB) {
      const diff = (b.average as number) - (a.average as number);
      if (Math.abs(diff) > 1e-6) return diff;
    }
    const cmp = (a.name || '')
      .trim()
      .localeCompare((b.name || '').trim(), 'fr', {
        sensitivity: 'base',
        numeric: true,
      });
    return cmp !== 0 ? cmp : a.originalIndex - b.originalIndex;
  });
}

export interface CustomMentionRule {
  /** Seuil minimal inclusif sur `scale` (défaut /20 : ex. 16, 14, 12, 10, 0) */
  min: number;
  /** Libellé libre défini par le professeur (ex: "Excellent", "Très bien", "Honorable"...) */
  label: string;
  /** Barème de référence sur lequel ce seuil a été saisi (défaut : 20 pour rétrocompatibilité) */
  scale?: number;
}

export const DEFAULT_CUSTOM_MENTION_RULES: readonly CustomMentionRule[] = [
  { min: 16, label: 'Très bien', scale: 20 },
  { min: 14, label: 'Bien', scale: 20 },
  { min: 12, label: 'Assez bien', scale: 20 },
  { min: 10, label: 'Passable', scale: 20 },
  { min: 0, label: 'Insuffisant', scale: 20 },
];

/**
 * Retourne les règles de mention par défaut adaptées au barème `targetScale` (ex: 32/40, 28/40...).
 */
export function getDefaultMentionRulesForScale(
  targetScale = DEFAULT_AVERAGE_SCALE
): CustomMentionRule[] {
  const safeScale = sanitizeAverageScale(targetScale) ?? DEFAULT_AVERAGE_SCALE;
  return DEFAULT_CUSTOM_MENTION_RULES.map((r) => ({
    min: Math.round(((r.min / 20) * safeScale) * 100) / 100,
    label: r.label,
    scale: safeScale,
  }));
}

/**
 * Convertit proportionnellement une liste de règles de mentions vers un barème cible (ex: /20 -> /40).
 */
export function scaleMentionRulesToTarget(
  rules: readonly CustomMentionRule[],
  targetScale = DEFAULT_AVERAGE_SCALE
): CustomMentionRule[] {
  const safeTarget = sanitizeAverageScale(targetScale) ?? DEFAULT_AVERAGE_SCALE;
  return [...rules]
    .map((r) => {
      const srcScale = sanitizeAverageScale(r.scale) ?? DEFAULT_AVERAGE_SCALE;
      const convertedMin =
        Math.abs(srcScale - safeTarget) < 1e-6
          ? r.min
          : Math.round(((r.min / srcScale) * safeTarget) * 100) / 100;
      return {
        min: Math.max(0, Math.min(safeTarget, convertedMin)),
        label: r.label,
        scale: safeTarget,
      };
    })
    .sort((a, b) => b.min - a.min);
}

/**
 * Nettoie, trie par seuil décroissant et déduplique une liste d'intervalles de mentions personnalisés.
 * Retourne null si la liste est vide ou invalide.
 */
export function sanitizeCustomMentionRules(
  raw: unknown,
  maxScale = DEFAULT_AVERAGE_SCALE
): CustomMentionRule[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const safeCap = sanitizeAverageScale(maxScale) ?? DEFAULT_AVERAGE_SCALE;
  const cleaned: CustomMentionRule[] = [];
  const seenMins = new Set<number>();

  for (const item of raw.slice(0, 15)) {
    if (!item || typeof item !== 'object') continue;
    const rawMin = Number((item as any).min);
    const rawLabel = String((item as any).label ?? '').trim().slice(0, 48);
    const parsedScale = sanitizeAverageScale((item as any).scale);
    const effectiveCap = parsedScale !== null ? parsedScale : safeCap;
    if (!Number.isFinite(rawMin) || rawMin < 0 || rawMin > effectiveCap || !rawLabel) {
      continue;
    }
    const roundedMin = Math.round(rawMin * 100) / 100;
    if (seenMins.has(roundedMin)) continue;
    seenMins.add(roundedMin);
    cleaned.push(
      parsedScale !== null
        ? { min: roundedMin, label: rawLabel, scale: parsedScale }
        : { min: roundedMin, label: rawLabel }
    );
  }

  if (cleaned.length === 0) return null;
  cleaned.sort((a, b) => b.min - a.min);
  return cleaned;
}

/**
 * Résout la mention à partir des intervalles personnalisés du professeur (ou par défaut si null/vide),
 * en tenant compte du barème maximal actif (`targetScale`, défaut /20).
 * Retourne le libellé ainsi qu'une teinte harmonieuse calculée selon la position dans l'échelle.
 */
export function resolveMentionWithRules(
  moyenne: number | null,
  customRules?: readonly CustomMentionRule[] | null,
  targetScale = DEFAULT_AVERAGE_SCALE
): {
  label: string;
  tone: 'emerald' | 'teal' | 'sky' | 'amber' | 'rose' | 'neutral';
} {
  if (moyenne === null || !Number.isFinite(moyenne)) {
    return { label: '—', tone: 'neutral' };
  }

  const safeScale = sanitizeAverageScale(targetScale) ?? DEFAULT_AVERAGE_SCALE;
  const sourceRules =
    customRules && customRules.length > 0
      ? customRules
      : DEFAULT_CUSTOM_MENTION_RULES;

  const normalizedRules = sourceRules
    .map((r) => {
      const ruleScale = sanitizeAverageScale(r.scale) ?? DEFAULT_AVERAGE_SCALE;
      const thresholdOnTarget =
        Math.abs(ruleScale - safeScale) < 1e-6
          ? r.min
          : (r.min / ruleScale) * safeScale;
      return {
        min: thresholdOnTarget,
        label: r.label,
      };
    })
    .sort((a, b) => b.min - a.min);

  let matchedIdx = -1;
  for (let i = 0; i < normalizedRules.length; i++) {
    if (moyenne + 1e-9 >= normalizedRules[i].min) {
      matchedIdx = i;
      break;
    }
  }

  // Si la note est inférieure au plus petit seuil défini, on utilise le dernier palier (le plus bas)
  const effectiveIdx = matchedIdx === -1 ? normalizedRules.length - 1 : matchedIdx;
  const matched = normalizedRules[effectiveIdx];

  // Déterminer une teinte visuelle cohérente ramenée en équivalent /20
  const moyenneOn20 = (moyenne / safeScale) * 20;
  let tone: 'emerald' | 'teal' | 'sky' | 'amber' | 'rose' = 'amber';
  if (
    moyenneOn20 >= 16 ||
    (effectiveIdx === 0 && normalizedRules.length >= 4 && moyenneOn20 >= 14)
  ) {
    tone = 'emerald';
  } else if (moyenneOn20 >= 14) {
    tone = 'teal';
  } else if (moyenneOn20 >= 12) {
    tone = 'sky';
  } else if (moyenneOn20 >= 10) {
    tone = 'amber';
  } else {
    tone = 'rose';
  }

  return { label: matched.label, tone };
}

/**
 * Version chaîne simple de resolveMentionWithRules (pour les moteurs de calcul trimestriel et annuel).
 */
export function getMentionFromCustomRules(
  moyenne: number | null,
  customRules?: readonly CustomMentionRule[] | null,
  targetScale = DEFAULT_AVERAGE_SCALE
): string {
  return resolveMentionWithRules(moyenne, customRules, targetScale).label;
}
