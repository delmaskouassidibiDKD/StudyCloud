export type TeacherDashboardTab =
  | 'dashboard'
  | 'trainees'
  | 'classes'
  | 'discussions'
  | 'groups'
  | 'library';

export const TEACHER_SCHOOLS_GRID_COLUMNS = 4;
export const TEACHER_SCHOOLS_GRID_ROWS = 3;
export const TEACHER_SCHOOLS_SLOTS_PER_PAGE =
  TEACHER_SCHOOLS_GRID_COLUMNS * TEACHER_SCHOOLS_GRID_ROWS; // 12 cases (1 bouton + 11 écoles)
export const TEACHER_SCHOOLS_PER_PAGE = TEACHER_SCHOOLS_SLOTS_PER_PAGE - 1; // 11 écoles max par page

export function paginateTeacherSchools<T>(schools: T[]): T[][] {
  if (!schools || schools.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < schools.length; i += TEACHER_SCHOOLS_PER_PAGE) {
    pages.push(schools.slice(i, i + TEACHER_SCHOOLS_PER_PAGE));
  }
  return pages;
}

export function getTeacherSchoolsTotalPages(schoolCount: number): number {
  if (!Number.isFinite(schoolCount) || schoolCount <= 0) return 1;
  return Math.max(1, Math.ceil(schoolCount / TEACHER_SCHOOLS_PER_PAGE));
}

export function getTeacherSchoolPageForIndex(schoolIndex: number): number {
  if (!Number.isFinite(schoolIndex) || schoolIndex <= 0) return 0;
  return Math.floor(schoolIndex / TEACHER_SCHOOLS_PER_PAGE);
}

const VALID_DASHBOARD_TABS: readonly TeacherDashboardTab[] = [
  'dashboard',
  'trainees',
  'classes',
  'discussions',
  'groups',
  'library',
];

function sanitizeDashboardTab(v: unknown): TeacherDashboardTab {
  if (typeof v === 'string' && (VALID_DASHBOARD_TABS as readonly string[]).includes(v)) {
    return v as TeacherDashboardTab;
  }
  return 'dashboard';
}

function sanitizePageIndex(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizePageByYear(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = k.trim();
    if (!cleanKey) continue;
    out[cleanKey] = sanitizePageIndex(val);
  }
  return out;
}

export interface TeacherNavSnapshot {
  version: 1;
  activeNavTab?: TeacherDashboardTab;
  selectedYearId: string | null;
  schoolsPageIndex?: number;
  schoolsPageByYear?: Record<string, number>;
  selectedSchoolId: string | null;
  schoolInsideId: string | null;
  selectedLevelId: string | null;
  selectedClassId: string | null;
  enteredClassId: string | null;
  selectedTermId: string | null;
  subjectInsideId: string | null;
  averageCardInsideId: string | null;
  averageCardKind: 'annual' | 'term' | null;
  averageCardClassId: string | null;
  averageCardTermId: string | null;
  isTransferViewOpen: boolean;
  viewerExpandLevel?: 0 | 1 | 2 | 3;
  updatedAt: number;
}

export interface MinimalYear {
  id: string;
}

export interface MinimalSchool {
  id: string;
  yearId: string;
}

export interface MinimalLevel {
  id: string;
  schoolId: string;
  yearId: string;
}

export interface MinimalClass {
  id: string;
  levelId?: string;
  schoolId: string;
  yearId: string;
  createdAt?: number;
}

export interface MinimalTerm {
  id: string;
  classId: string;
  schoolId: string;
  yearId: string;
  number: number;
  name: string;
  createdAt?: number;
}

export interface MinimalSubject {
  id: string;
  classId: string;
  termId?: string;
  schoolId: string;
  yearId: string;
}

export interface MinimalClassAverageCard {
  id: string;
  classId: string;
  termId?: string;
  schoolId: string;
  yearId: string;
  kind: 'annual' | 'term';
  title: string;
  sortOrder: number;
  color?: string;
  textColor?: string;
  borderColor?: string;
  borderDarkColor?: string;
  createdAt?: number;
}

export interface TeacherNavDataset<
  TYear extends MinimalYear = MinimalYear,
  TSchool extends MinimalSchool = MinimalSchool,
  TLevel extends MinimalLevel = MinimalLevel,
  TClass extends MinimalClass = MinimalClass,
  TTerm extends MinimalTerm = MinimalTerm,
  TSubject extends MinimalSubject = MinimalSubject,
  TAvgCard extends MinimalClassAverageCard = MinimalClassAverageCard,
> {
  schoolYears: TYear[];
  schools: TSchool[];
  studyLevels: TLevel[];
  classes: TClass[];
  terms: TTerm[];
  subjects: TSubject[];
  classAverages: TAvgCard[];
}

export interface ResolvedTeacherNav<
  TSchool extends MinimalSchool = MinimalSchool,
  TSubject extends MinimalSubject = MinimalSubject,
  TAvgCard extends MinimalClassAverageCard = MinimalClassAverageCard,
> {
  activeNavTab: TeacherDashboardTab;
  selectedYearId: string;
  schoolsPageIndex: number;
  schoolsPageByYear: Record<string, number>;
  selectedSchoolId: string | null;
  selectedSchoolInside: TSchool | null;
  selectedLevelId: string | null;
  selectedClassId: string | null;
  enteredClassId: string | null;
  selectedTermId: string | null;
  selectedSubjectInside: TSubject | null;
  selectedAverageCardInside: TAvgCard | null;
  isTransferViewOpen: boolean;
  viewerExpandLevel: 0 | 1 | 2 | 3;
  /** True si le snapshot cible un écran profond mais que les données locales sont encore vides/incomplètes */
  needsCloudHydration: boolean;
}

export const TEACHER_NAV_STORAGE_PREFIX = 'studycloud_teacher_nav_v1_';

export function getTeacherNavStorageKey(userId: string): string {
  return `${TEACHER_NAV_STORAGE_PREFIX}${userId}`;
}

function sanitizeNullableStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseTeacherNavSnapshot(raw: string | null): TeacherNavSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const rawKind = parsed.averageCardKind;
    const averageCardKind: 'annual' | 'term' | null =
      rawKind === 'annual' || rawKind === 'term' ? rawKind : null;
    const rawExpand = Number(parsed.viewerExpandLevel);
    const viewerExpandLevel: 0 | 1 | 2 | 3 =
      rawExpand === 3 ? 3 : rawExpand === 2 ? 2 : rawExpand === 1 ? 1 : 0;
    const selectedYearId = sanitizeNullableStr(parsed.selectedYearId);
    const schoolsPageByYear = sanitizePageByYear(parsed.schoolsPageByYear);
    const schoolsPageIndex =
      parsed.schoolsPageIndex !== undefined
        ? sanitizePageIndex(parsed.schoolsPageIndex)
        : selectedYearId && schoolsPageByYear[selectedYearId] !== undefined
        ? schoolsPageByYear[selectedYearId]
        : 0;

    return {
      version: 1,
      activeNavTab: sanitizeDashboardTab(parsed.activeNavTab),
      selectedYearId,
      schoolsPageIndex,
      schoolsPageByYear,
      selectedSchoolId: sanitizeNullableStr(parsed.selectedSchoolId),
      schoolInsideId: sanitizeNullableStr(parsed.schoolInsideId),
      selectedLevelId: sanitizeNullableStr(parsed.selectedLevelId),
      selectedClassId: sanitizeNullableStr(parsed.selectedClassId),
      enteredClassId: sanitizeNullableStr(parsed.enteredClassId),
      selectedTermId: sanitizeNullableStr(parsed.selectedTermId),
      subjectInsideId: sanitizeNullableStr(parsed.subjectInsideId),
      averageCardInsideId: sanitizeNullableStr(parsed.averageCardInsideId),
      averageCardKind,
      averageCardClassId: sanitizeNullableStr(parsed.averageCardClassId),
      averageCardTermId: sanitizeNullableStr(parsed.averageCardTermId),
      isTransferViewOpen: Boolean(parsed.isTransferViewOpen),
      viewerExpandLevel,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function readTeacherNavSnapshot(userId: string): TeacherNavSnapshot | null {
  if (!userId || typeof window === 'undefined') return null;
  const key = getTeacherNavStorageKey(userId);
  try {
    const fromLocal = window.localStorage?.getItem(key);
    const parsedLocal = parseTeacherNavSnapshot(fromLocal);
    if (parsedLocal) return parsedLocal;
  } catch {}
  try {
    const fromSession = window.sessionStorage?.getItem(key);
    return parseTeacherNavSnapshot(fromSession);
  } catch {
    return null;
  }
}

export function writeTeacherNavSnapshot(
  userId: string,
  input: Omit<TeacherNavSnapshot, 'version' | 'updatedAt'>
): void {
  if (!userId || typeof window === 'undefined') return;
  const key = getTeacherNavStorageKey(userId);
  const payload: TeacherNavSnapshot = {
    version: 1,
    ...input,
    updatedAt: Date.now(),
  };
  const serialized = JSON.stringify(payload);
  try {
    window.localStorage?.setItem(key, serialized);
  } catch {}
  try {
    window.sessionStorage?.setItem(key, serialized);
  } catch {}
}

export function clearTeacherNavSnapshot(userId: string): void {
  if (!userId || typeof window === 'undefined') return;
  const key = getTeacherNavStorageKey(userId);
  try {
    window.localStorage?.removeItem(key);
  } catch {}
  try {
    window.sessionStorage?.removeItem(key);
  } catch {}
}

function hasDeepTarget(snapshot: TeacherNavSnapshot): boolean {
  return Boolean(
    snapshot.schoolInsideId ||
      snapshot.enteredClassId ||
      snapshot.subjectInsideId ||
      snapshot.averageCardInsideId ||
      snapshot.averageCardKind ||
      snapshot.isTransferViewOpen
  );
}

/**
 * Résout de manière déterministe un snapshot de navigation sauvegardé contre
 * le jeu de données (cache local ou réponse fraîche /api/teacher/bootstrap).
 * Garantit une hiérarchie parent-enfant 100 % cohérente (année -> école -> niveau -> classe -> trimestre -> matière/moyenne).
 */
export function resolveTeacherNavSnapshot<
  TYear extends MinimalYear,
  TSchool extends MinimalSchool,
  TLevel extends MinimalLevel,
  TClass extends MinimalClass,
  TTerm extends MinimalTerm,
  TSubject extends MinimalSubject,
  TAvgCard extends MinimalClassAverageCard,
>(
  snapshot: TeacherNavSnapshot | null,
  dataset: TeacherNavDataset<TYear, TSchool, TLevel, TClass, TTerm, TSubject, TAvgCard> | null
): ResolvedTeacherNav<TSchool, TSubject, TAvgCard> {
  const defaultYearId = dataset?.schoolYears?.[0]?.id || '';
  const expandLevel: 0 | 1 | 2 | 3 =
    snapshot?.viewerExpandLevel === 3
      ? 3
      : snapshot?.viewerExpandLevel === 2
      ? 2
      : snapshot?.viewerExpandLevel === 1
      ? 1
      : 0;

  if (!snapshot) {
    return {
      activeNavTab: 'dashboard',
      selectedYearId: defaultYearId,
      schoolsPageIndex: 0,
      schoolsPageByYear: {},
      selectedSchoolId: null,
      selectedSchoolInside: null,
      selectedLevelId: null,
      selectedClassId: null,
      enteredClassId: null,
      selectedTermId: null,
      selectedSubjectInside: null,
      selectedAverageCardInside: null,
      isTransferViewOpen: false,
      viewerExpandLevel: 0,
      needsCloudHydration: false,
    };
  }

  const activeNavTab = sanitizeDashboardTab(snapshot.activeNavTab);
  const rawPageByYear = sanitizePageByYear(snapshot.schoolsPageByYear);
  const rawActivePage =
    snapshot.selectedYearId && rawPageByYear[snapshot.selectedYearId] !== undefined
      ? rawPageByYear[snapshot.selectedYearId]
      : sanitizePageIndex(snapshot.schoolsPageIndex);

  const years = dataset?.schoolYears || [];
  const schools = dataset?.schools || [];
  const levels = dataset?.studyLevels || [];
  const classes = dataset?.classes || [];
  const terms = dataset?.terms || [];
  const subjects = dataset?.subjects || [];
  const classAverages = dataset?.classAverages || [];

  const isDatasetEmpty = years.length === 0 && schools.length === 0;
  if (isDatasetEmpty) {
    const preservedMap: Record<string, number> = { ...rawPageByYear };
    if (snapshot.selectedYearId && rawActivePage > 0) {
      preservedMap[snapshot.selectedYearId] = rawActivePage;
    }
    return {
      activeNavTab,
      selectedYearId: snapshot.selectedYearId || '',
      schoolsPageIndex: rawActivePage,
      schoolsPageByYear: preservedMap,
      selectedSchoolId: snapshot.selectedSchoolId,
      selectedSchoolInside: null,
      selectedLevelId: snapshot.selectedLevelId,
      selectedClassId: snapshot.selectedClassId,
      enteredClassId: snapshot.enteredClassId,
      selectedTermId: snapshot.selectedTermId,
      selectedSubjectInside: null,
      selectedAverageCardInside: null,
      isTransferViewOpen: snapshot.isTransferViewOpen,
      viewerExpandLevel: expandLevel,
      needsCloudHydration: Boolean(
        snapshot.selectedYearId || hasDeepTarget(snapshot) || rawActivePage > 0
      ),
    };
  }

  // 1. Tenter de résoudre d'abord la cible la plus profonde (tableau matière ou tableau moyenne générale)
  let resolvedSubject: TSubject | null = null;
  let resolvedAvgCard: TAvgCard | null = null;
  let resolvedClass: TClass | null = null;
  let resolvedLevel: TLevel | null = null;
  let resolvedSchool: TSchool | null = null;
  let resolvedTermId: string | null = snapshot.selectedTermId;
  let resolvedEnteredClassId: string | null = snapshot.enteredClassId;
  let missingTarget = false;

  if (snapshot.subjectInsideId) {
    const subj = subjects.find((s) => s.id === snapshot.subjectInsideId) || null;
    if (subj) {
      resolvedSubject = subj;
      resolvedClass = classes.find((c) => c.id === subj.classId) || null;
      if (resolvedClass) {
        resolvedEnteredClassId = resolvedClass.id;
        resolvedLevel = levels.find((l) => l.id === resolvedClass!.levelId) || null;
        resolvedSchool = schools.find((s) => s.id === resolvedClass!.schoolId) || null;
      }
      if (subj.termId) {
        resolvedTermId = subj.termId;
      }
    } else {
      missingTarget = true;
    }
  } else if (snapshot.averageCardInsideId || snapshot.averageCardKind) {
    let card: TAvgCard | null = snapshot.averageCardInsideId
      ? classAverages.find((ca) => ca.id === snapshot.averageCardInsideId) || null
      : null;

    if (!card && snapshot.averageCardKind && snapshot.averageCardClassId) {
      card =
        classAverages.find(
          (ca) =>
            ca.kind === snapshot.averageCardKind &&
            ca.classId === snapshot.averageCardClassId &&
            (snapshot.averageCardKind === 'annual'
              ? !ca.termId
              : ca.termId === snapshot.averageCardTermId)
        ) || null;
    }

    // Fallback synthétique identique à TeacherClassesView si la classe existe mais la carte n'est pas encore listée
    if (!card && snapshot.averageCardKind && snapshot.averageCardClassId) {
      const targetCls = classes.find((c) => c.id === snapshot.averageCardClassId) || null;
      if (targetCls) {
        if (snapshot.averageCardKind === 'annual') {
          card = {
            id: snapshot.averageCardInsideId || `cavg-annual-${targetCls.id}`,
            classId: targetCls.id,
            schoolId: targetCls.schoolId,
            yearId: targetCls.yearId,
            kind: 'annual',
            title: "Moyenne générale de l'année",
            sortOrder: 0,
            color: '#ffffff',
            textColor: '#0f172a',
            borderColor: '#e2e8f0',
            borderDarkColor: '#cbd5e1',
            createdAt: targetCls.createdAt || Date.now(),
          } as TAvgCard;
        } else if (snapshot.averageCardTermId) {
          const targetTerm = terms.find((t) => t.id === snapshot.averageCardTermId) || null;
          if (targetTerm) {
            card = {
              id: snapshot.averageCardInsideId || `cavg-term-${targetTerm.id}`,
              classId: targetCls.id,
              termId: targetTerm.id,
              schoolId: targetCls.schoolId,
              yearId: targetCls.yearId,
              kind: 'term',
              title: `Moyenne générale · ${targetTerm.name}`,
              sortOrder: targetTerm.number,
              color: '#ffffff',
              textColor: '#0f172a',
              borderColor: '#e2e8f0',
              borderDarkColor: '#cbd5e1',
              createdAt: targetTerm.createdAt || Date.now(),
            } as TAvgCard;
          }
        }
      }
    }

    if (card) {
      resolvedAvgCard = card;
      resolvedClass = classes.find((c) => c.id === card!.classId) || null;
      if (resolvedClass) {
        resolvedLevel = levels.find((l) => l.id === resolvedClass!.levelId) || null;
        resolvedSchool = schools.find((s) => s.id === resolvedClass!.schoolId) || null;
        if (snapshot.enteredClassId === resolvedClass.id) {
          resolvedEnteredClassId = resolvedClass.id;
        }
      }
      if (card.termId) {
        resolvedTermId = card.termId;
      }
    } else {
      missingTarget = true;
    }
  }

  // 2. Si aucun tableau ouvert (ou si la cible profonde a été supprimée), résoudre école / niveau / classe
  if (!resolvedSchool && snapshot.schoolInsideId) {
    resolvedSchool = schools.find((s) => s.id === snapshot.schoolInsideId) || null;
    if (!resolvedSchool) {
      missingTarget = true;
    }
  }

  if (resolvedSchool) {
    const schoolLevels = levels.filter((l) => l.schoolId === resolvedSchool!.id);
    if (!resolvedLevel) {
      resolvedLevel =
        (snapshot.selectedLevelId &&
          schoolLevels.find((l) => l.id === snapshot.selectedLevelId)) ||
        schoolLevels[0] ||
        null;
    }

    const levelClasses = resolvedLevel
      ? classes.filter(
          (c) => c.schoolId === resolvedSchool!.id && c.levelId === resolvedLevel!.id
        )
      : [];

    if (!resolvedClass) {
      if (snapshot.enteredClassId) {
        const entered = classes.find(
          (c) => c.id === snapshot.enteredClassId && c.schoolId === resolvedSchool!.id
        );
        if (entered) {
          resolvedClass = entered;
          resolvedEnteredClassId = entered.id;
          const enteredLevel = schoolLevels.find((l) => l.id === entered.levelId);
          if (enteredLevel) resolvedLevel = enteredLevel;
        } else {
          resolvedEnteredClassId = null;
        }
      }
      if (!resolvedClass) {
        resolvedClass =
          (snapshot.selectedClassId &&
            levelClasses.find((c) => c.id === snapshot.selectedClassId)) ||
          levelClasses[0] ||
          null;
      }
    }

    if (resolvedEnteredClassId && (!resolvedClass || resolvedClass.id !== resolvedEnteredClassId)) {
      const validEntered = classes.find(
        (c) => c.id === resolvedEnteredClassId && c.schoolId === resolvedSchool!.id
      );
      resolvedEnteredClassId = validEntered ? validEntered.id : null;
    }

    if (resolvedClass) {
      const classTerms = terms
        .filter((t) => t.classId === resolvedClass!.id)
        .sort((a, b) => a.number - b.number);
      if (classTerms.length > 0) {
        if (!resolvedTermId || !classTerms.some((t) => t.id === resolvedTermId)) {
          resolvedTermId = classTerms[0].id;
        }
      } else {
        resolvedTermId = null;
      }
    } else {
      resolvedTermId = null;
    }
  } else {
    resolvedLevel = null;
    resolvedClass = null;
    resolvedEnteredClassId = null;
    resolvedTermId = null;
    resolvedSubject = null;
    resolvedAvgCard = null;
  }

  // 3. Année scolaire cohérente
  let resolvedYearId = defaultYearId;
  if (resolvedSchool && years.some((y) => y.id === resolvedSchool!.yearId)) {
    resolvedYearId = resolvedSchool.yearId;
  } else if (snapshot.selectedYearId && years.some((y) => y.id === snapshot.selectedYearId)) {
    resolvedYearId = snapshot.selectedYearId;
  }

  // 4. École surlignée sur le tableau de bord
  const resolvedSelectedSchoolId =
    resolvedSchool?.id ||
    (snapshot.selectedSchoolId && schools.some((s) => s.id === snapshot.selectedSchoolId)
      ? snapshot.selectedSchoolId
      : null);

  // 5. Vue Transférer (possible au niveau école ou classe)
  const resolvedTransferOpen =
    Boolean(snapshot.isTransferViewOpen) && !resolvedSubject && !resolvedAvgCard;

  // 6. Page horizontale des écoles (12 cartes / page : 1 bouton + 11 écoles)
  const resolvedPageByYear: Record<string, number> = {};
  for (const y of years) {
    const savedForYear =
      rawPageByYear[y.id] !== undefined
        ? rawPageByYear[y.id]
        : y.id === snapshot.selectedYearId
        ? sanitizePageIndex(snapshot.schoolsPageIndex)
        : 0;
    const countForYear = schools.filter((s) => s.yearId === y.id).length;
    const maxPageForYear = Math.max(0, getTeacherSchoolsTotalPages(countForYear) - 1);
    if (savedForYear > maxPageForYear && y.id === resolvedYearId) {
      missingTarget = true;
    }
    resolvedPageByYear[y.id] = Math.min(savedForYear, maxPageForYear);
  }
  const resolvedSchoolsPageIndex = resolvedYearId
    ? resolvedPageByYear[resolvedYearId] || 0
    : 0;

  return {
    activeNavTab,
    selectedYearId: resolvedYearId,
    schoolsPageIndex: resolvedSchoolsPageIndex,
    schoolsPageByYear: resolvedPageByYear,
    selectedSchoolId: resolvedSelectedSchoolId,
    selectedSchoolInside: resolvedSchool,
    selectedLevelId: resolvedLevel?.id || null,
    selectedClassId: resolvedClass?.id || null,
    enteredClassId: resolvedEnteredClassId,
    selectedTermId: resolvedTermId,
    selectedSubjectInside: resolvedSubject,
    selectedAverageCardInside: resolvedAvgCard,
    isTransferViewOpen: resolvedTransferOpen,
    viewerExpandLevel: expandLevel,
    needsCloudHydration: missingTarget,
  };
}
