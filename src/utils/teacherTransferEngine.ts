import type {
  SchoolYearItem,
  SchoolItem,
  StudyLevelItem,
  ClassItem,
  TermItem,
  SubjectItem,
} from '../components/teacher/TeacherClassesView';

export type TransferMode =
  | 'term_to_term'
  | 'class_to_class'
  | 'subject_to_subject'
  | 'level_to_level'
  | 'school_to_school';

export type GradebookContentMode =
  | 'none' // Uniquement la matière (aucune donnée du tableur)
  | 'structure' // Colonnes & barèmes (/20, /40...) sans élèves
  | 'students_only' // Liste des élèves (noms) sans les notes
  | 'students_and_notes'; // Liste des élèves + toutes les notes saisies

export type ConflictStrategy = 'skip' | 'merge' | 'replace';

export interface GradebookCopyOptions {
  contentMode: GradebookContentMode;
  includePhotos: boolean;
  includeMetas: boolean;
  includeFormatting: boolean;
}

export interface GradebookInspection {
  hasStorage: boolean;
  totalRows: number;
  namedStudentsCount: number;
  photosCount: number;
  notesCount: number;
  noteColumnCount: number;
  hasCustomMetas: boolean;
  hasFormatting: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface RawStudentRow {
  id: string;
  name: string;
  photoUrl?: string;
  notes: string[];
}

export interface TeacherDataset {
  schoolYears: SchoolYearItem[];
  schools: SchoolItem[];
  studyLevels: StudyLevelItem[];
  classes: ClassItem[];
  terms: TermItem[];
  subjects: SubjectItem[];
}

export interface TransferSummary {
  levelsCreated: number;
  classesCreated: number;
  termsCreated: number;
  subjectsCreated: number;
  subjectsUpdated: number;
  subjectsSkipped: number;
  gradebooksCopied: number;
  studentsCopied: number;
  notesCopied: number;
  photosCopied: number;
  warnings: string[];
}

export interface GradebookCopyOperation {
  sourceSubjectId: string;
  sourceTermId: string;
  targetSubjectId: string;
  targetTermId: string;
  conflictStrategy: ConflictStrategy;
  options: GradebookCopyOptions;
}

export interface TransferExecutionResult {
  nextStudyLevels: StudyLevelItem[];
  nextClasses: ClassItem[];
  nextTerms: TermItem[];
  nextSubjects: SubjectItem[];
  createdLevels: StudyLevelItem[];
  createdClasses: ClassItem[];
  createdTerms: TermItem[];
  createdSubjects: SubjectItem[];
  updatedSubjects: SubjectItem[];
  gradebookCopyOps: GradebookCopyOperation[];
  summary: TransferSummary;
}

// ---------- Helpers de clés localStorage du tableur (identiques à SubjectGradebookView.tsx) ----------

export const getGradebookStorageKeys = (subjectId: string, termId?: string) => {
  const suffix = `${subjectId}_${termId || 't1'}`;
  return {
    students: `studycloud_student_gradebook_${suffix}`,
    colCount: `studycloud_note_col_count_${suffix}`,
    colWidth: `studycloud_note_col_width_${suffix}`,
    colWidthRank: `studycloud_col_width_rank_${suffix}`,
    colWidthPhoto: `studycloud_col_width_photo_${suffix}`,
    colWidthName: `studycloud_col_width_name_${suffix}`,
    colWidthAvg: `studycloud_col_width_avg_${suffix}`,
    colWidthMention: `studycloud_col_width_mention_${suffix}`,
    customNoteWidths: `studycloud_custom_note_widths_${suffix}`,
    rowHeights: `studycloud_row_heights_${suffix}`,
    colMetas: `studycloud_col_metas_${suffix}`,
    cellColors: `studycloud_cell_colors_${suffix}`,
    rowColors: `studycloud_row_colors_${suffix}`,
    cellStyles: `studycloud_cell_styles_${suffix}`,
  };
};

const getDefaultStorage = (): StorageLike | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const normalizeName = (val?: string): string =>
  (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const getEffectiveClassName = (cls: ClassItem): string =>
  cls.name?.trim() ? cls.name.trim() : cls.level;

export const getEffectiveSubjectTermId = (
  subject: SubjectItem,
  classTerms: TermItem[]
): string | undefined => {
  if (subject.termId) return subject.termId;
  const sorted = [...classTerms].sort((a, b) => a.number - b.number);
  return sorted[0]?.id;
};

const isNonEmptyNote = (raw: unknown): boolean => {
  if (typeof raw !== 'string') return false;
  const cleaned = raw.trim();
  if (!cleaned) return false;
  // Formats possibles : "15", "15/20", "/20" (vide avant le slash)
  if (cleaned.includes('/')) {
    const beforeSlash = cleaned.split('/')[0].trim();
    return beforeSlash.length > 0 && beforeSlash !== '-' && beforeSlash !== '--';
  }
  return cleaned !== '-' && cleaned !== '--';
};

// ---------- Inspection réelle des données du tableur d'une matière ----------

export const inspectGradebookStorage = (
  subjectId: string,
  termId?: string,
  storageOverride?: StorageLike | null
): GradebookInspection => {
  const storage = storageOverride === undefined ? getDefaultStorage() : storageOverride;
  const empty: GradebookInspection = {
    hasStorage: false,
    totalRows: 0,
    namedStudentsCount: 0,
    photosCount: 0,
    notesCount: 0,
    noteColumnCount: 7,
    hasCustomMetas: false,
    hasFormatting: false,
  };
  if (!storage) return empty;

  const keys = getGradebookStorageKeys(subjectId, termId);
  let students: RawStudentRow[] = [];
  let hasStorage = false;

  try {
    const rawStudents = storage.getItem(keys.students);
    if (rawStudents) {
      const parsed = JSON.parse(rawStudents);
      if (Array.isArray(parsed)) {
        students = parsed;
        hasStorage = true;
      }
    }
  } catch {
    // Ignore malformed JSON
  }

  let noteColumnCount = 7;
  try {
    const rawCount = storage.getItem(keys.colCount);
    if (rawCount) {
      const n = parseInt(rawCount, 10);
      if (!isNaN(n) && n >= 1) {
        noteColumnCount = n;
        hasStorage = true;
      }
    } else if (students.length > 0 && Array.isArray(students[0]?.notes)) {
      noteColumnCount = Math.max(7, students[0].notes.length);
    }
  } catch {
    // Ignore
  }

  let namedStudentsCount = 0;
  let photosCount = 0;
  let notesCount = 0;

  for (const row of students) {
    if (row && typeof row.name === 'string' && row.name.trim().length > 0) {
      namedStudentsCount++;
    }
    if (row && typeof row.photoUrl === 'string' && row.photoUrl.trim().length > 0) {
      photosCount++;
    }
    if (row && Array.isArray(row.notes)) {
      for (const cell of row.notes) {
        if (isNonEmptyNote(cell)) notesCount++;
      }
    }
  }

  let hasCustomMetas = false;
  try {
    const rawMetas = storage.getItem(keys.colMetas);
    if (rawMetas) {
      const parsed = JSON.parse(rawMetas);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        hasCustomMetas = true;
        hasStorage = true;
      }
    }
  } catch {
    // Ignore
  }

  let hasFormatting = false;
  try {
    const rawCellColors = storage.getItem(keys.cellColors);
    const rawRowColors = storage.getItem(keys.rowColors);
    const rawCellStyles = storage.getItem(keys.cellStyles);
    const hasCC = rawCellColors ? Object.keys(JSON.parse(rawCellColors) || {}).length > 0 : false;
    const hasRC = rawRowColors ? Object.keys(JSON.parse(rawRowColors) || {}).length > 0 : false;
    const hasCS = rawCellStyles ? Object.keys(JSON.parse(rawCellStyles) || {}).length > 0 : false;
    hasFormatting = hasCC || hasRC || hasCS;
  } catch {
    // Ignore
  }

  return {
    hasStorage,
    totalRows: students.length,
    namedStudentsCount,
    photosCount,
    notesCount,
    noteColumnCount,
    hasCustomMetas,
    hasFormatting,
  };
};

// ---------- Clonage complet et sécurisé d'un tableur (avec remappage d'IDs) ----------

export interface CloneGradebookResult {
  copied: boolean;
  studentsCopied: number;
  notesCopied: number;
  photosCopied: number;
}

const remapStudentKey = (key: string, idMap: Map<string, string>): string => {
  // Les clés de style/couleur de cellule utilisent `${studentId}-name`, `${studentId}-note-${colIdx}`, etc.
  for (const [oldId, newId] of idMap.entries()) {
    if (key === oldId) return newId;
    if (key.startsWith(`${oldId}-`) || key.startsWith(`${oldId}_`)) {
      return `${newId}${key.slice(oldId.length)}`;
    }
  }
  return key;
};

export const cloneGradebookStorage = (
  sourceSubjectId: string,
  sourceTermId: string | undefined,
  targetSubjectId: string,
  targetTermId: string | undefined,
  options: GradebookCopyOptions,
  storageOverride?: StorageLike | null,
  idSeed = 0
): CloneGradebookResult => {
  if (options.contentMode === 'none') {
    return { copied: false, studentsCopied: 0, notesCopied: 0, photosCopied: 0 };
  }

  const storage = storageOverride === undefined ? getDefaultStorage() : storageOverride;
  if (!storage) {
    return { copied: false, studentsCopied: 0, notesCopied: 0, photosCopied: 0 };
  }

  const srcKeys = getGradebookStorageKeys(sourceSubjectId, sourceTermId);
  const dstKeys = getGradebookStorageKeys(targetSubjectId, targetTermId);

  const inspection = inspectGradebookStorage(sourceSubjectId, sourceTermId, storage);

  // Déterminer le nombre de colonnes de notes
  const colCount = Math.max(1, inspection.noteColumnCount || 7);

  // Copier les métadonnées de colonnes (titres, barèmes /20 /40, couleurs en-tête)
  if (options.includeMetas || options.contentMode === 'structure') {
    storage.setItem(dstKeys.colCount, String(colCount));
    const rawMetas = storage.getItem(srcKeys.colMetas);
    if (rawMetas) {
      storage.setItem(dstKeys.colMetas, rawMetas);
    }
    const widthKeys: Array<[keyof typeof srcKeys, keyof typeof dstKeys]> = [
      ['colWidth', 'colWidth'],
      ['colWidthRank', 'colWidthRank'],
      ['colWidthPhoto', 'colWidthPhoto'],
      ['colWidthName', 'colWidthName'],
      ['colWidthAvg', 'colWidthAvg'],
      ['colWidthMention', 'colWidthMention'],
      ['customNoteWidths', 'customNoteWidths'],
    ];
    for (const [sk, dk] of widthKeys) {
      const val = storage.getItem(srcKeys[sk]);
      if (val !== null) storage.setItem(dstKeys[dk], val);
    }
  }

  if (options.contentMode === 'structure') {
    return {
      copied: inspection.hasStorage || inspection.hasCustomMetas,
      studentsCopied: 0,
      notesCopied: 0,
      photosCopied: 0,
    };
  }

  // Copier les élèves (avec ou sans notes)
  let rawStudents: RawStudentRow[] = [];
  try {
    const saved = storage.getItem(srcKeys.students);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) rawStudents = parsed;
    }
  } catch {
    rawStudents = [];
  }

  if (rawStudents.length === 0) {
    return { copied: false, studentsCopied: 0, notesCopied: 0, photosCopied: 0 };
  }

  const now = Date.now();
  const idMap = new Map<string, string>();
  let studentsCopied = 0;
  let notesCopied = 0;
  let photosCopied = 0;

  const clonedRows: RawStudentRow[] = rawStudents.map((row, idx) => {
    const newId = `student-${now}-${idSeed}-${idx}`;
    if (row.id) idMap.set(row.id, newId);

    const hasName = typeof row.name === 'string' && row.name.trim().length > 0;
    if (hasName) studentsCopied++;

    const photoUrl =
      options.includePhotos && typeof row.photoUrl === 'string' && row.photoUrl.trim().length > 0
        ? row.photoUrl
        : undefined;
    if (photoUrl) photosCopied++;

    let notes: string[];
    if (options.contentMode === 'students_and_notes') {
      const srcNotes = Array.isArray(row.notes) ? row.notes : [];
      notes = Array.from({ length: colCount }, (_, i) => {
        const val = typeof srcNotes[i] === 'string' ? srcNotes[i] : '';
        if (isNonEmptyNote(val)) notesCopied++;
        return val;
      });
    } else {
      // students_only : on garde les noms (et photos si coché) mais toutes les cases de notes repartent à vide
      notes = Array(colCount).fill('');
    }

    return {
      id: newId,
      name: typeof row.name === 'string' ? row.name : '',
      photoUrl,
      notes,
    };
  });

  storage.setItem(dstKeys.students, JSON.stringify(clonedRows));
  storage.setItem(dstKeys.colCount, String(colCount));

  // Copier la mise en forme (en remappant les anciens studentId vers les nouveaux)
  if (options.includeFormatting) {
    try {
      const rawRowHeights = storage.getItem(srcKeys.rowHeights);
      if (rawRowHeights) {
        const parsed = JSON.parse(rawRowHeights) as Record<string, number>;
        const mapped: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          mapped[remapStudentKey(k, idMap)] = v;
        }
        storage.setItem(dstKeys.rowHeights, JSON.stringify(mapped));
      }
    } catch {
      // Ignore
    }

    try {
      const rawRowColors = storage.getItem(srcKeys.rowColors);
      if (rawRowColors) {
        const parsed = JSON.parse(rawRowColors) as Record<string, string>;
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          mapped[remapStudentKey(k, idMap)] = v;
        }
        storage.setItem(dstKeys.rowColors, JSON.stringify(mapped));
      }
    } catch {
      // Ignore
    }

    try {
      const rawCellColors = storage.getItem(srcKeys.cellColors);
      if (rawCellColors) {
        const parsed = JSON.parse(rawCellColors) as Record<string, string>;
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          // Si on ne copie pas les notes, ne pas recopier les couleurs de cellules de notes
          if (options.contentMode === 'students_only' && k.includes('-note-')) continue;
          mapped[remapStudentKey(k, idMap)] = v;
        }
        storage.setItem(dstKeys.cellColors, JSON.stringify(mapped));
      }
    } catch {
      // Ignore
    }

    try {
      const rawCellStyles = storage.getItem(srcKeys.cellStyles);
      if (rawCellStyles) {
        const parsed = JSON.parse(rawCellStyles) as Record<string, unknown>;
        const mapped: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (options.contentMode === 'students_only' && k.includes('-note-')) continue;
          mapped[remapStudentKey(k, idMap)] = v;
        }
        storage.setItem(dstKeys.cellStyles, JSON.stringify(mapped));
      }
    } catch {
      // Ignore
    }
  }

  return {
    copied: true,
    studentsCopied,
    notesCopied,
    photosCopied,
  };
};

// ---------- Plans d'exécution pour chacun des 5 modes de transfert ----------

export interface TermToTermPlan {
  mode: 'term_to_term';
  sourceClassId: string;
  sourceTermId: string;
  subjectIds: string[];
  targetTermIds: string[];
  applyToAllClassesInLevel?: boolean; // Permet d'appliquer le même transfert trimestre->trimestre sur toutes les classes du niveau
  levelId?: string;
  conflictStrategy: ConflictStrategy;
  gradebook: GradebookCopyOptions;
}

export interface ClassToClassPlan {
  mode: 'class_to_class';
  sourceClassId: string;
  targetClassIds: string[];
  copyTerms: boolean;
  termIds: string[]; // Trimestres sources sélectionnés
  copySubjects: boolean;
  subjectIds: string[]; // Matières sources sélectionnées
  conflictStrategy: ConflictStrategy;
  gradebook: GradebookCopyOptions;
}

export interface SubjectToSubjectPlan {
  mode: 'subject_to_subject';
  sourceSubjectId: string;
  sourceTermId: string;
  targetEntries: Array<{ subjectId: string; termId: string }>;
  gradebook: GradebookCopyOptions;
}

export interface LevelToLevelPlan {
  mode: 'level_to_level';
  sourceLevelId: string;
  targetLevelIds: string[];
  copyClasses: boolean;
  classIds: string[];
  copyTerms: boolean;
  termNumbers: number[]; // ex: [1, 2, 3]
  copySubjects: boolean;
  subjectIds: string[];
  conflictStrategy: ConflictStrategy;
  gradebook: GradebookCopyOptions;
}

export interface SchoolToSchoolPlan {
  mode: 'school_to_school';
  sourceSchoolId: string;
  targetSchoolIds: string[];
  levelIds: string[];
  copyClasses: boolean;
  copyTerms: boolean;
  copySubjects: boolean;
  conflictStrategy: ConflictStrategy;
  gradebook: GradebookCopyOptions;
}

export type TransferPlan =
  | TermToTermPlan
  | ClassToClassPlan
  | SubjectToSubjectPlan
  | LevelToLevelPlan
  | SchoolToSchoolPlan;

// ---------- Helpers internes de création / résolution de doublons ----------

interface MutableState {
  studyLevels: StudyLevelItem[];
  classes: ClassItem[];
  terms: TermItem[];
  subjects: SubjectItem[];
  updatedSubjectIds: Set<string>;
  gradebookCopyOps: GradebookCopyOperation[];
  summary: TransferSummary;
  uidCounter: number;
}

const nextUid = (state: MutableState, prefix: string): string => {
  state.uidCounter += 1;
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}-${state.uidCounter}`;
};

const ensureTermInClass = (
  state: MutableState,
  targetClass: ClassItem,
  termNumber: number,
  termName: string
): TermItem => {
  const existing = state.terms.find(
    (t) =>
      t.classId === targetClass.id &&
      (t.number === termNumber || normalizeName(t.name) === normalizeName(termName))
  );
  if (existing) return existing;

  const created: TermItem = {
    id: nextUid(state, `term-${targetClass.id}`),
    classId: targetClass.id,
    schoolId: targetClass.schoolId,
    yearId: targetClass.yearId,
    number: termNumber,
    name: termName,
    createdAt: Date.now() + state.uidCounter,
  };
  state.terms.push(created);
  state.summary.termsCreated += 1;
  return created;
};

const copySubjectIntoTarget = (
  state: MutableState,
  srcSubject: SubjectItem,
  srcTermId: string | undefined,
  targetClass: ClassItem,
  targetTerm: TermItem,
  conflictStrategy: ConflictStrategy,
  gradebookOptions: GradebookCopyOptions,
  storage?: StorageLike | null
) => {
  const targetClassTerms = state.terms.filter((t) => t.classId === targetClass.id);
  const existing = state.subjects.find((s) => {
    if (s.classId !== targetClass.id) return false;
    const effTerm = getEffectiveSubjectTermId(s, targetClassTerms);
    return effTerm === targetTerm.id && normalizeName(s.name) === normalizeName(srcSubject.name);
  });

  if (existing) {
    if (conflictStrategy === 'skip') {
      state.summary.subjectsSkipped += 1;
      return;
    }

    // merge ou replace : mettre à jour les métadonnées si replace, et copier le tableur si demandé
    if (conflictStrategy === 'replace') {
      existing.coefficient = srcSubject.coefficient;
      existing.color = srcSubject.color;
      existing.textColor = srcSubject.textColor;
      existing.borderColor = srcSubject.borderColor;
      existing.borderDarkColor = srcSubject.borderDarkColor;
      existing.colorStyle = srcSubject.colorStyle;
    } else if (existing.coefficient === undefined && srcSubject.coefficient !== undefined) {
      existing.coefficient = srcSubject.coefficient;
    }

    state.summary.subjectsUpdated += 1;
    state.updatedSubjectIds.add(existing.id);
    if (gradebookOptions.contentMode !== 'none') {
      state.gradebookCopyOps.push({
        sourceSubjectId: srcSubject.id,
        sourceTermId: srcTermId || 't1',
        targetSubjectId: existing.id,
        targetTermId: targetTerm.id,
        conflictStrategy,
        options: { ...gradebookOptions },
      });
    }
    const cloneRes = cloneGradebookStorage(
      srcSubject.id,
      srcTermId,
      existing.id,
      targetTerm.id,
      gradebookOptions,
      storage,
      state.uidCounter++
    );
    if (cloneRes.copied) state.summary.gradebooksCopied += 1;
    state.summary.studentsCopied += cloneRes.studentsCopied;
    state.summary.notesCopied += cloneRes.notesCopied;
    state.summary.photosCopied += cloneRes.photosCopied;
    return;
  }

  const newSubject: SubjectItem = {
    id: nextUid(state, 'subject'),
    classId: targetClass.id,
    termId: targetTerm.id,
    schoolId: targetClass.schoolId,
    yearId: targetClass.yearId,
    name: srcSubject.name,
    coefficient: srcSubject.coefficient,
    color: srcSubject.color,
    textColor: srcSubject.textColor,
    borderColor: srcSubject.borderColor,
    borderDarkColor: srcSubject.borderDarkColor,
    colorStyle: srcSubject.colorStyle,
    createdAt: Date.now() + state.uidCounter,
  };
  state.subjects.push(newSubject);
  state.summary.subjectsCreated += 1;

  if (gradebookOptions.contentMode !== 'none') {
    state.gradebookCopyOps.push({
      sourceSubjectId: srcSubject.id,
      sourceTermId: srcTermId || 't1',
      targetSubjectId: newSubject.id,
      targetTermId: targetTerm.id,
      conflictStrategy,
      options: { ...gradebookOptions },
    });
  }

  const cloneRes = cloneGradebookStorage(
    srcSubject.id,
    srcTermId,
    newSubject.id,
    targetTerm.id,
    gradebookOptions,
    storage,
    state.uidCounter++
  );
  if (cloneRes.copied) state.summary.gradebooksCopied += 1;
  state.summary.studentsCopied += cloneRes.studentsCopied;
  state.summary.notesCopied += cloneRes.notesCopied;
  state.summary.photosCopied += cloneRes.photosCopied;
};

const ensureClassInLevel = (
  state: MutableState,
  srcClass: ClassItem,
  targetLevel: StudyLevelItem,
  conflictStrategy: ConflictStrategy
): { targetClass: ClassItem; created: boolean } => {
  const srcDisplay = getEffectiveClassName(srcClass);
  // Si le nom de la classe source contenait exactement le nom du niveau source, on l'adapte proprement
  const adaptedName =
    normalizeName(srcDisplay) === normalizeName(srcClass.level)
      ? targetLevel.name
      : srcDisplay;

  const existing = state.classes.find(
    (c) =>
      c.schoolId === targetLevel.schoolId &&
      c.levelId === targetLevel.id &&
      normalizeName(getEffectiveClassName(c)) === normalizeName(adaptedName)
  );

  if (existing && conflictStrategy !== 'replace') {
    return { targetClass: existing, created: false };
  }

  if (existing && conflictStrategy === 'replace') {
    existing.slogan = srcClass.slogan;
    existing.teacherName = srcClass.teacherName;
    existing.color = srcClass.color;
    existing.textColor = srcClass.textColor;
    existing.borderColor = srcClass.borderColor;
    existing.borderDarkColor = srcClass.borderDarkColor;
    existing.colorStyle = srcClass.colorStyle;
    existing.iconGradient = srcClass.iconGradient;
    return { targetClass: existing, created: false };
  }

  const newClassId = nextUid(state, 'class');
  const newClass: ClassItem = {
    id: newClassId,
    levelId: targetLevel.id,
    schoolId: targetLevel.schoolId,
    yearId: targetLevel.yearId,
    level: targetLevel.name,
    name: adaptedName,
    slogan: srcClass.slogan,
    teacherName: srcClass.teacherName,
    subject: srcClass.subject,
    color: srcClass.color,
    textColor: srcClass.textColor,
    borderColor: srcClass.borderColor,
    borderDarkColor: srcClass.borderDarkColor,
    colorStyle: srcClass.colorStyle,
    iconGradient: srcClass.iconGradient,
    createdAt: Date.now() + state.uidCounter,
  };
  state.classes.push(newClass);
  state.summary.classesCreated += 1;

  // Garantir les 3 trimestres de base sur toute nouvelle classe
  for (let num = 1; num <= 3; num++) {
    ensureTermInClass(state, newClass, num, `Trimestre ${num}`);
  }

  return { targetClass: newClass, created: true };
};

// ---------- Moteur principal d'exécution des transferts ----------

export const executeTransfer = (
  plan: TransferPlan,
  dataset: TeacherDataset,
  storageOverride?: StorageLike | null
): TransferExecutionResult => {
  const storage = storageOverride === undefined ? getDefaultStorage() : storageOverride;

  const state: MutableState = {
    studyLevels: dataset.studyLevels.map((l) => ({ ...l })),
    classes: dataset.classes.map((c) => ({ ...c })),
    terms: dataset.terms.map((t) => ({ ...t })),
    subjects: dataset.subjects.map((s) => ({ ...s })),
    updatedSubjectIds: new Set<string>(),
    gradebookCopyOps: [],
    summary: {
      levelsCreated: 0,
      classesCreated: 0,
      termsCreated: 0,
      subjectsCreated: 0,
      subjectsUpdated: 0,
      subjectsSkipped: 0,
      gradebooksCopied: 0,
      studentsCopied: 0,
      notesCopied: 0,
      photosCopied: 0,
      warnings: [],
    },
    uidCounter: 0,
  };

  if (plan.mode === 'term_to_term') {
    const sourceClass = state.classes.find((c) => c.id === plan.sourceClassId);
    const sourceTerm = state.terms.find((t) => t.id === plan.sourceTermId);
    if (!sourceClass || !sourceTerm) {
      state.summary.warnings.push('Classe ou trimestre source introuvable.');
    } else {
      const sourceClassTerms = state.terms.filter((t) => t.classId === sourceClass.id);
      const selectedSubjects = state.subjects.filter((s) => {
        if (s.classId !== sourceClass.id) return false;
        const effTerm = getEffectiveSubjectTermId(s, sourceClassTerms);
        return effTerm === sourceTerm.id && plan.subjectIds.includes(s.id);
      });

      if (selectedSubjects.length === 0) {
        state.summary.warnings.push('Aucune matière sélectionnée dans le trimestre source.');
      }

      const targetTerms = plan.targetTermIds
        .map((tid) => state.terms.find((t) => t.id === tid))
        .filter((t): t is TermItem => Boolean(t && t.id !== sourceTerm.id));

      if (plan.applyToAllClassesInLevel && plan.levelId) {
        // Appliquer le même transfert trimestre N -> trimestre(s) M sur toutes les classes du niveau
        const levelClasses = state.classes.filter(
          (c) => c.levelId === plan.levelId && c.schoolId === sourceClass.schoolId
        );
        const targetTermNumbers = targetTerms.map((t) => ({ number: t.number, name: t.name }));

        for (const cls of levelClasses) {
          const clsTerms = state.terms.filter((t) => t.classId === cls.id);
          const clsSrcTerm = clsTerms.find((t) => t.number === sourceTerm.number);
          if (!clsSrcTerm) continue;

          // Pour la classe source on utilise les matières cochées, pour les autres classes du niveau on prend leurs matières du même trimestre
          const clsSrcSubjects =
            cls.id === sourceClass.id
              ? selectedSubjects
              : state.subjects.filter((s) => {
                  if (s.classId !== cls.id) return false;
                  const eff = getEffectiveSubjectTermId(s, clsTerms);
                  return eff === clsSrcTerm.id;
                });

          for (const tInfo of targetTermNumbers) {
            if (tInfo.number === clsSrcTerm.number) continue;
            const dstTerm = ensureTermInClass(state, cls, tInfo.number, tInfo.name);
            for (const subj of clsSrcSubjects) {
              copySubjectIntoTarget(
                state,
                subj,
                clsSrcTerm.id,
                cls,
                dstTerm,
                plan.conflictStrategy,
                plan.gradebook,
                storage
              );
            }
          }
        }
      } else {
        for (const targetTerm of targetTerms) {
          for (const subj of selectedSubjects) {
            copySubjectIntoTarget(
              state,
              subj,
              sourceTerm.id,
              sourceClass,
              targetTerm,
              plan.conflictStrategy,
              plan.gradebook,
              storage
            );
          }
        }
      }
    }
  } else if (plan.mode === 'class_to_class') {
    const sourceClass = state.classes.find((c) => c.id === plan.sourceClassId);
    if (!sourceClass) {
      state.summary.warnings.push('Classe source introuvable.');
    } else {
      const srcClassTerms = state.terms
        .filter((t) => t.classId === sourceClass.id)
        .sort((a, b) => a.number - b.number);
      const selectedTerms = srcClassTerms.filter((t) => plan.termIds.includes(t.id));
      const targetClasses = plan.targetClassIds
        .map((cid) => state.classes.find((c) => c.id === cid))
        .filter((c): c is ClassItem => Boolean(c && c.id !== sourceClass.id));

      for (const targetClass of targetClasses) {
        const termsToProcess = plan.copyTerms ? selectedTerms : srcClassTerms;
        for (const srcTerm of termsToProcess) {
          const dstTerm = plan.copyTerms
            ? ensureTermInClass(state, targetClass, srcTerm.number, srcTerm.name)
            : state.terms.find(
                (t) => t.classId === targetClass.id && t.number === srcTerm.number
              ) || ensureTermInClass(state, targetClass, srcTerm.number, srcTerm.name);

          if (!plan.copySubjects) continue;

          const termSubjects = state.subjects.filter((s) => {
            if (s.classId !== sourceClass.id) return false;
            const effTerm = getEffectiveSubjectTermId(s, srcClassTerms);
            return effTerm === srcTerm.id && plan.subjectIds.includes(s.id);
          });

          for (const subj of termSubjects) {
            copySubjectIntoTarget(
              state,
              subj,
              srcTerm.id,
              targetClass,
              dstTerm,
              plan.conflictStrategy,
              plan.gradebook,
              storage
            );
          }
        }
      }
    }
  } else if (plan.mode === 'subject_to_subject') {
    for (const target of plan.targetEntries) {
      if (target.subjectId === plan.sourceSubjectId && target.termId === plan.sourceTermId) {
        continue;
      }
      if (plan.gradebook.contentMode !== 'none') {
        state.gradebookCopyOps.push({
          sourceSubjectId: plan.sourceSubjectId,
          sourceTermId: plan.sourceTermId,
          targetSubjectId: target.subjectId,
          targetTermId: target.termId,
          conflictStrategy: 'replace',
          options: { ...plan.gradebook },
        });
      }
      const res = cloneGradebookStorage(
        plan.sourceSubjectId,
        plan.sourceTermId,
        target.subjectId,
        target.termId,
        plan.gradebook,
        storage,
        state.uidCounter++
      );
      if (res.copied) {
        state.summary.gradebooksCopied += 1;
        state.summary.subjectsUpdated += 1;
      }
      state.summary.studentsCopied += res.studentsCopied;
      state.summary.notesCopied += res.notesCopied;
      state.summary.photosCopied += res.photosCopied;
    }
  } else if (plan.mode === 'level_to_level') {
    const sourceLevel = state.studyLevels.find((l) => l.id === plan.sourceLevelId);
    if (!sourceLevel) {
      state.summary.warnings.push("Niveau d'étude source introuvable.");
    } else {
      const srcClasses = state.classes.filter(
        (c) =>
          c.schoolId === sourceLevel.schoolId &&
          c.levelId === sourceLevel.id &&
          plan.classIds.includes(c.id)
      );
      const targetLevels = plan.targetLevelIds
        .map((lid) => state.studyLevels.find((l) => l.id === lid))
        .filter((l): l is StudyLevelItem => Boolean(l && l.id !== sourceLevel.id));

      for (const targetLevel of targetLevels) {
        if (!plan.copyClasses) {
          // Si l'utilisateur n'a pas coché "Classes", on transfère les trimestres/matières dans les classes existantes du niveau cible
          const existingTargetClasses = state.classes.filter(
            (c) => c.schoolId === targetLevel.schoolId && c.levelId === targetLevel.id
          );
          if (existingTargetClasses.length === 0) {
            state.summary.warnings.push(
              `Le niveau "${targetLevel.name}" ne contient aucune classe. Cochez "Classes" pour les créer automatiquement.`
            );
            continue;
          }
          for (const targetClass of existingTargetClasses) {
            for (const srcClass of srcClasses) {
              const srcClassTerms = state.terms.filter((t) => t.classId === srcClass.id);
              const matchingTerms = srcClassTerms.filter((t) =>
                plan.termNumbers.includes(t.number)
              );
              for (const srcTerm of matchingTerms) {
                const dstTerm = ensureTermInClass(state, targetClass, srcTerm.number, srcTerm.name);
                if (!plan.copySubjects) continue;
                const srcSubjects = state.subjects.filter((s) => {
                  if (s.classId !== srcClass.id) return false;
                  const eff = getEffectiveSubjectTermId(s, srcClassTerms);
                  return eff === srcTerm.id && plan.subjectIds.includes(s.id);
                });
                for (const subj of srcSubjects) {
                  copySubjectIntoTarget(
                    state,
                    subj,
                    srcTerm.id,
                    targetClass,
                    dstTerm,
                    plan.conflictStrategy,
                    plan.gradebook,
                    storage
                  );
                }
              }
            }
          }
          continue;
        }

        for (const srcClass of srcClasses) {
          const { targetClass } = ensureClassInLevel(
            state,
            srcClass,
            targetLevel,
            plan.conflictStrategy
          );
          const srcClassTerms = state.terms.filter((t) => t.classId === srcClass.id);
          const selectedTerms = plan.copyTerms
            ? srcClassTerms.filter((t) => plan.termNumbers.includes(t.number))
            : srcClassTerms.filter((t) => t.number <= 3);

          for (const srcTerm of selectedTerms) {
            const dstTerm = ensureTermInClass(state, targetClass, srcTerm.number, srcTerm.name);
            if (!plan.copySubjects) continue;
            const srcSubjects = state.subjects.filter((s) => {
              if (s.classId !== srcClass.id) return false;
              const eff = getEffectiveSubjectTermId(s, srcClassTerms);
              return eff === srcTerm.id && plan.subjectIds.includes(s.id);
            });
            for (const subj of srcSubjects) {
              copySubjectIntoTarget(
                state,
                subj,
                srcTerm.id,
                targetClass,
                dstTerm,
                plan.conflictStrategy,
                plan.gradebook,
                storage
              );
            }
          }
        }
      }
    }
  } else if (plan.mode === 'school_to_school') {
    const srcLevels = state.studyLevels.filter(
      (l) => l.schoolId === plan.sourceSchoolId && plan.levelIds.includes(l.id)
    );
    const targetSchools = plan.targetSchoolIds
      .map((sid) => dataset.schools.find((s) => s.id === sid))
      .filter((s): s is SchoolItem => Boolean(s && s.id !== plan.sourceSchoolId));

    for (const targetSchool of targetSchools) {
      for (const srcLevel of srcLevels) {
        let targetLevel = state.studyLevels.find(
          (l) =>
            l.schoolId === targetSchool.id &&
            normalizeName(l.name) === normalizeName(srcLevel.name)
        );
        if (!targetLevel) {
          targetLevel = {
            id: nextUid(state, 'level'),
            schoolId: targetSchool.id,
            yearId: targetSchool.yearId,
            name: srcLevel.name,
            color: srcLevel.color,
            textColor: srcLevel.textColor,
            borderColor: srcLevel.borderColor,
            colorStyle: srcLevel.colorStyle,
            createdAt: Date.now() + state.uidCounter,
          };
          state.studyLevels.push(targetLevel);
          state.summary.levelsCreated += 1;
        }

        if (!plan.copyClasses) continue;

        const srcClasses = state.classes.filter(
          (c) => c.schoolId === plan.sourceSchoolId && c.levelId === srcLevel.id
        );
        for (const srcClass of srcClasses) {
          const { targetClass } = ensureClassInLevel(
            state,
            srcClass,
            targetLevel,
            plan.conflictStrategy
          );
          const srcClassTerms = state.terms.filter((t) => t.classId === srcClass.id);
          const termsToCopy = plan.copyTerms
            ? srcClassTerms
            : srcClassTerms.filter((t) => t.number <= 3);

          for (const srcTerm of termsToCopy) {
            const dstTerm = ensureTermInClass(state, targetClass, srcTerm.number, srcTerm.name);
            if (!plan.copySubjects) continue;
            const srcSubjects = state.subjects.filter((s) => {
              if (s.classId !== srcClass.id) return false;
              const eff = getEffectiveSubjectTermId(s, srcClassTerms);
              return eff === srcTerm.id;
            });
            for (const subj of srcSubjects) {
              copySubjectIntoTarget(
                state,
                subj,
                srcTerm.id,
                targetClass,
                dstTerm,
                plan.conflictStrategy,
                plan.gradebook,
                storage
              );
            }
          }
        }
      }
    }
  }

  const origLevelIds = new Set(dataset.studyLevels.map((l) => l.id));
  const origClassIds = new Set(dataset.classes.map((c) => c.id));
  const origTermIds = new Set(dataset.terms.map((t) => t.id));
  const origSubjectIds = new Set(dataset.subjects.map((s) => s.id));

  return {
    nextStudyLevels: state.studyLevels,
    nextClasses: state.classes,
    nextTerms: state.terms,
    nextSubjects: state.subjects,
    createdLevels: state.studyLevels.filter((l) => !origLevelIds.has(l.id)),
    createdClasses: state.classes.filter((c) => !origClassIds.has(c.id)),
    createdTerms: state.terms.filter((t) => !origTermIds.has(t.id)),
    createdSubjects: state.subjects.filter((s) => !origSubjectIds.has(s.id)),
    updatedSubjects: state.subjects.filter((s) => origSubjectIds.has(s.id) && state.updatedSubjectIds.has(s.id)),
    gradebookCopyOps: state.gradebookCopyOps,
    summary: state.summary,
  };
};
