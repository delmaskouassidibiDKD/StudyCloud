/**
 * StudyCloud - Client API & Cache Isolé par Compte pour le Module Enseignant (D1 + R2)
 *
 * - Toutes les requêtes envoient exclusivement le jeton JWT (`Authorization: Bearer <sc_auth_token>`).
 * - Aucun `userId` n'est jamais envoyé pour usurper un compte : le Worker identifie l'utilisateur via le JWT.
 * - Tout cache local de confort/hors-ligne est strictement isolé par `userId` et purgé à la déconnexion.
 */

import { getWorkerApiUrl } from './api';
import type {
  SchoolYearItem,
  SchoolItem,
  StudyLevelItem,
  ClassItem,
  TermItem,
  SubjectItem,
  ClassAverageCardItem,
} from '../components/teacher/TeacherClassesView';
import type {
  GradebookColumnMeta,
  StudentGradeRow,
  CellCustomStyle,
} from '../components/teacher/SubjectGradebookView';
import type {
  GradebookInspection,
  GradebookCopyOptions,
} from '../utils/teacherTransferEngine';
import type {
  GradebookStudentSnapshot,
  TermAverageLayoutState,
  TermAverageOverrides,
  TermAverageSortMode,
  TermAverageStylesState,
  TermAverageSubject,
} from '../utils/termGeneralAverage';
import type { AnnualTermData } from '../utils/annualGeneralAverage';

export interface ClassAverageSheetCardPayload extends ClassAverageCardItem {
  layout: TermAverageLayoutState;
  styles: TermAverageStylesState;
  overrides: TermAverageOverrides;
  sortMode: TermAverageSortMode;
  version: number;
  updatedAt: number;
}

export interface ClassAverageSheetResponse {
  success: boolean;
  card: ClassAverageSheetCardPayload;
  term: TermItem | null;
  subjects: TermAverageSubject[];
  subjectGradebooks: Record<string, GradebookStudentSnapshot[]>;
  annualData?: {
    terms: AnnualTermData[];
  };
}

export interface ClassAverageSheetSavePayload {
  layout: TermAverageLayoutState;
  styles: TermAverageStylesState;
  overrides: TermAverageOverrides;
  sortMode: TermAverageSortMode;
}

export interface TeacherClassRosterStudent {
  studentUid: string;
  name: string;
  photoUrl?: string;
  photoR2Key?: string;
  subjectIds: string[];
  subjectNames: string[];
}

export interface TeacherClassRosterResponse {
  success: boolean;
  classId: string;
  students: TeacherClassRosterStudent[];
}

export interface GradebookLayoutState {
  noteColWidth: number;
  colWidthRank: number;
  colWidthPhoto: number;
  colWidthName: number;
  colWidthAverage: number;
  colWidthMention: number;
  customNoteWidths: { [index: number]: number };
  customRowHeights: { [index: number]: number };
  zoomPercent?: number;
}

export interface GradebookStylesState {
  cellColors: { [key: string]: string };
  rowColors: { [rowId: string]: string };
  cellCustomStyles: { [cellKey: string]: CellCustomStyle };
}

export interface TeacherGradebookPayload {
  noteColumnCount: number;
  columnMetas: { [colIndex: number]: GradebookColumnMeta };
  layout: GradebookLayoutState;
  styles: GradebookStylesState;
  students: StudentGradeRow[];
}

export interface TeacherGradebookResponse extends TeacherGradebookPayload {
  success: boolean;
  exists: boolean;
  gradebookId?: string;
  version: number;
  updatedAt?: number;
}

export interface TeacherBootstrapResponse {
  success: boolean;
  userId: string;
  isEmpty: boolean;
  schoolYears: SchoolYearItem[];
  schools: SchoolItem[];
  studyLevels: StudyLevelItem[];
  classes: ClassItem[];
  terms: TermItem[];
  subjects: SubjectItem[];
  classAverages?: ClassAverageCardItem[];
  gradebookStats: Record<string, GradebookInspection>;
  migrated?: boolean;
}

export interface ServerGradebookCopyOp {
  sourceSubjectId: string;
  sourceTermId: string;
  targetSubjectId: string;
  targetTermId: string;
  conflictStrategy: 'skip' | 'merge' | 'replace';
  options: GradebookCopyOptions;
}

export interface ServerTransferRequest {
  createdLevels: StudyLevelItem[];
  createdClasses: ClassItem[];
  createdTerms: TermItem[];
  createdSubjects: SubjectItem[];
  updatedSubjects: SubjectItem[];
  gradebookCopies: ServerGradebookCopyOp[];
}

// ============================================================================
// Helpers Auth & IDs Globaux
// ============================================================================

export function getTeacherAuthToken(): string | null {
  try {
    return localStorage.getItem('sc_auth_token');
  } catch {
    return null;
  }
}

export function generateTeacherEntityId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${Date.now()}-${rand}`;
}

function getBaseUrl(): string {
  return getWorkerApiUrl().replace(/\/+$/, '');
}

async function teacherFetchJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    keepalive?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const token = getTeacherAuthToken();
  if (!token) {
    throw new Error('Session non connectée (jeton manquant).');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let bodyPayload: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyPayload = JSON.stringify(options.body);
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method || 'GET',
    headers,
    body: bodyPayload,
    keepalive: options.keepalive,
    signal: options.signal,
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data?.error || `Erreur serveur (${res.status})`;
    const err: any = new Error(errMsg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

// ============================================================================
// Compression Client des Photos Élèves & Logos Écoles (<= 256x256 WebP/JPEG)
// ============================================================================

export async function compressImageToUpload(
  file: File,
  maxSize = 256,
  quality = 0.84
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image corrompue ou format non supporté.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.max(1, Math.round((height * maxSize) / width));
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = Math.max(1, Math.round((width * maxSize) / height));
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexte graphique indisponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const tryFormat = (mime: string) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                if (mime === 'image/webp') {
                  tryFormat('image/jpeg');
                } else {
                  reject(new Error('Échec de la compression image.'));
                }
                return;
              }
              const previewUrl = canvas.toDataURL(blob.type || mime, quality);
              resolve({ blob, dataUrl: previewUrl });
            },
            mime,
            quality
          );
        };

        tryFormat('image/webp');
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// Cache Local Strictement Isolé par userId (Zéro mélange entre comptes)
// ============================================================================

const safeUserSegment = (userId: string) =>
  String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

export function getUserBootstrapCacheKey(userId: string): string {
  return `studycloud_teacher_u_${safeUserSegment(userId)}_bootstrap`;
}

export function getUserGradebookCacheKey(userId: string, subjectId: string, termId: string): string {
  return `studycloud_teacher_u_${safeUserSegment(userId)}_gb_${subjectId}_${termId || 't1'}`;
}

export function getUserClassAverageCacheKey(userId: string, averageId: string): string {
  return `studycloud_teacher_u_${safeUserSegment(userId)}_avg_${averageId}`;
}

export function readUserClassAverageCache(
  userId: string,
  averageId: string
): ClassAverageSheetResponse | null {
  if (!userId || !averageId) return null;
  try {
    const raw = localStorage.getItem(getUserClassAverageCacheKey(userId, averageId));
    if (!raw) return null;
    return JSON.parse(raw) as ClassAverageSheetResponse;
  } catch {
    return null;
  }
}

export function writeUserClassAverageCache(
  userId: string,
  averageId: string,
  data: ClassAverageSheetResponse
): void {
  if (!userId || !averageId) return;
  try {
    localStorage.setItem(getUserClassAverageCacheKey(userId, averageId), JSON.stringify(data));
  } catch {}
}

export function isOfflineOrNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  if (err.status && typeof err.status === 'number') return false;
  const msg = String(err.message || err || '').toLowerCase();
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('internet') ||
    msg.includes('hors ligne') ||
    msg.includes('offline')
  );
}

export function clearUserGradebookCaches(userId: string, subjectIds: string[]): void {
  if (!userId || !subjectIds.length) return;
  try {
    const userPrefix = `studycloud_teacher_u_${safeUserSegment(userId)}_gb_`;
    const targets = subjectIds.map((sid) => `${userPrefix}${sid}_`);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && targets.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

export function readUserBootstrapCache(userId: string): TeacherBootstrapResponse | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getUserBootstrapCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.userId === userId && Array.isArray(parsed.schoolYears)) {
      return parsed as TeacherBootstrapResponse;
    }
  } catch {}
  return null;
}

export function writeUserBootstrapCache(userId: string, data: TeacherBootstrapResponse): void {
  if (!userId) return;
  try {
    localStorage.setItem(getUserBootstrapCacheKey(userId), JSON.stringify(data));
  } catch {}
}

export function readUserGradebookCache(
  userId: string,
  subjectId: string,
  termId: string
): TeacherGradebookPayload | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getUserGradebookCacheKey(userId, subjectId, termId));
    if (!raw) return null;
    return JSON.parse(raw) as TeacherGradebookPayload;
  } catch {
    return null;
  }
}

export function writeUserGradebookCache(
  userId: string,
  subjectId: string,
  termId: string,
  payload: TeacherGradebookPayload
): void {
  if (!userId) return;
  try {
    // Ne jamais stocker de lourdes dataUrl dans le cache local quand photoR2Key existe
    const leanStudents = payload.students.map((s) => ({
      ...s,
      photoUrl: s.photoUrl && s.photoUrl.startsWith('data:') && s.photoR2Key ? undefined : s.photoUrl,
    }));
    localStorage.setItem(
      getUserGradebookCacheKey(userId, subjectId, termId),
      JSON.stringify({ ...payload, students: leanStudents })
    );
  } catch {}
}

// ============================================================================
// Migration Unique des Anciennes Données Locales (localStorage -> D1 + R2)
// ============================================================================

const LEGACY_STRUCTURE_KEYS = [
  'studycloud_teacher_school_years',
  'studycloud_teacher_schools',
  'studycloud_teacher_study_levels',
  'studycloud_teacher_classes',
  'studycloud_teacher_terms',
  'studycloud_teacher_subjects',
];

export function hasLegacyUnscopedTeacherData(): boolean {
  try {
    const schoolsRaw = localStorage.getItem('studycloud_teacher_schools');
    if (schoolsRaw) {
      const parsed = JSON.parse(schoolsRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    }
    const yearsRaw = localStorage.getItem('studycloud_teacher_school_years');
    if (yearsRaw) {
      const parsed = JSON.parse(yearsRaw);
      if (Array.isArray(parsed) && parsed.some((y: any) => y && y.id !== 'year-default')) return true;
    }
  } catch {}
  return false;
}

export function collectLegacyUnscopedTeacherData() {
  const safeArr = <T,>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const safeObj = (key: string): any => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const safeInt = (key: string, fallback: number): number => {
    try {
      const n = parseInt(localStorage.getItem(key) || '', 10);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  };

  const schoolYears = safeArr<SchoolYearItem>('studycloud_teacher_school_years');
  const schools = safeArr<SchoolItem>('studycloud_teacher_schools');
  const studyLevels = safeArr<StudyLevelItem>('studycloud_teacher_study_levels');
  const classes = safeArr<ClassItem>('studycloud_teacher_classes');
  const terms = safeArr<TermItem>('studycloud_teacher_terms');
  const subjects = safeArr<SubjectItem>('studycloud_teacher_subjects');

  const gradebooks: any[] = [];
  for (const subj of subjects) {
    const clsTerms = terms.filter((t) => t.classId === subj.classId);
    const effTermId = subj.termId || clsTerms[0]?.id || 't1';
    const suffix = `${subj.id}_${effTermId}`;
    const rawStudents = localStorage.getItem(`studycloud_student_gradebook_${suffix}`);
    const rawColCount = localStorage.getItem(`studycloud_note_col_count_${suffix}`);
    const rawMetas = localStorage.getItem(`studycloud_col_metas_${suffix}`);
    if (!rawStudents && !rawColCount && !rawMetas) continue;

    gradebooks.push({
      subjectId: subj.id,
      termId: effTermId,
      classId: subj.classId,
      schoolId: subj.schoolId,
      yearId: subj.yearId,
      noteColumnCount: Math.max(1, safeInt(`studycloud_note_col_count_${suffix}`, 7)),
      columnMetas: safeObj(`studycloud_col_metas_${suffix}`),
      layout: {
        noteColWidth: safeInt(`studycloud_note_col_width_${suffix}`, 96),
        colWidthRank: safeInt(`studycloud_col_width_rank_${suffix}`, 68),
        colWidthPhoto: safeInt(`studycloud_col_width_photo_${suffix}`, 76),
        colWidthName: safeInt(`studycloud_col_width_name_${suffix}`, 280),
        colWidthAverage: safeInt(`studycloud_col_width_avg_${suffix}`, 104),
        colWidthMention: safeInt(`studycloud_col_width_mention_${suffix}`, 108),
        customNoteWidths: safeObj(`studycloud_custom_note_widths_${suffix}`),
        customRowHeights: safeObj(`studycloud_row_heights_${suffix}`),
      },
      styles: {
        cellColors: safeObj(`studycloud_cell_colors_${suffix}`),
        rowColors: safeObj(`studycloud_row_colors_${suffix}`),
        cellCustomStyles: safeObj(`studycloud_cell_styles_${suffix}`),
      },
      students: safeArr<StudentGradeRow>(`studycloud_student_gradebook_${suffix}`),
    });
  }

  return { schoolYears, schools, studyLevels, classes, terms, subjects, gradebooks };
}

export function clearLegacyUnscopedTeacherData(): void {
  try {
    for (const k of LEGACY_STRUCTURE_KEYS) {
      localStorage.removeItem(k);
    }
    const legacyPrefixes = [
      'studycloud_student_gradebook_',
      'studycloud_note_col_count_',
      'studycloud_note_col_width_',
      'studycloud_col_width_rank_',
      'studycloud_col_width_photo_',
      'studycloud_col_width_name_',
      'studycloud_col_width_avg_',
      'studycloud_col_width_mention_',
      'studycloud_custom_note_widths_',
      'studycloud_row_heights_',
      'studycloud_col_metas_',
      'studycloud_cell_colors_',
      'studycloud_row_colors_',
      'studycloud_cell_styles_',
    ];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && legacyPrefixes.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

// ============================================================================
// Endpoints D1 + R2
// ============================================================================

export const TeacherGradebookAPI = {
  bootstrap: () => teacherFetchJson<TeacherBootstrapResponse>('/api/teacher/bootstrap'),

  importLocal: (payload: ReturnType<typeof collectLegacyUnscopedTeacherData>) =>
    teacherFetchJson<TeacherBootstrapResponse>('/api/teacher/import-local', {
      method: 'POST',
      body: payload,
    }),

  createYear: (input: Partial<SchoolYearItem> & { label: string }) =>
    teacherFetchJson<{ success: boolean; year: SchoolYearItem }>('/api/teacher/years', {
      method: 'POST',
      body: input,
    }),

  updateYear: (id: string, input: { label: string; color: string; textColor?: string; colorStyle?: 'accent' | 'full' }) =>
    teacherFetchJson<{ success: boolean; year: SchoolYearItem }>(`/api/teacher/years/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  deleteYear: (id: string) =>
    teacherFetchJson<{ success: boolean; deletedId: string }>(`/api/teacher/years/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  syncAll: (payload: {
    schoolYears: SchoolYearItem[];
    schools: SchoolItem[];
    studyLevels: StudyLevelItem[];
    classes: ClassItem[];
    terms: TermItem[];
    subjects: SubjectItem[];
  }) =>
    teacherFetchJson<TeacherBootstrapResponse & { syncedAt: number }>('/api/teacher/sync', {
      method: 'POST',
      body: payload,
    }),

  createSchool: (input: {
    id?: string;
    yearId: string;
    name: string;
    logoDataUrl?: string | null;
    color: string;
    textColor: string;
    borderColor: string;
    borderDarkColor: string;
    colorStyle?: 'accent' | 'full';
  }) =>
    teacherFetchJson<{ success: boolean; school: SchoolItem }>('/api/teacher/schools', {
      method: 'POST',
      body: input,
    }),

  updateSchool: (
    id: string,
    input: {
      name: string;
      logoDataUrl?: string | null;
      removeLogo?: boolean;
      color: string;
      textColor: string;
      borderColor: string;
      borderDarkColor: string;
      colorStyle?: 'accent' | 'full';
    }
  ) =>
    teacherFetchJson<{ success: boolean; school: SchoolItem }>(`/api/teacher/schools/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  deleteSchool: (id: string) =>
    teacherFetchJson<{ success: boolean; deletedId: string }>(`/api/teacher/schools/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createLevel: (input: {
    id?: string;
    schoolId: string;
    name: string;
    color?: string;
    textColor?: string;
    borderColor?: string;
    colorStyle?: 'accent' | 'full';
  }) =>
    teacherFetchJson<{ success: boolean; level: StudyLevelItem }>('/api/teacher/levels', {
      method: 'POST',
      body: input,
    }),

  updateLevel: (
    id: string,
    input: { name: string; color?: string; textColor?: string; borderColor?: string; colorStyle?: 'accent' | 'full' }
  ) =>
    teacherFetchJson<{ success: boolean; level: StudyLevelItem }>(`/api/teacher/levels/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  deleteLevel: (id: string) =>
    teacherFetchJson<{ success: boolean; deletedId: string }>(`/api/teacher/levels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createClass: (input: {
    id?: string;
    levelId: string;
    name: string;
    slogan?: string;
    teacherName: string;
    color: string;
    textColor: string;
    borderColor: string;
    borderDarkColor: string;
    colorStyle?: 'accent' | 'full';
    iconGradient: string;
    defaultTerms?: Array<{ id?: string; number: number; name: string }>;
  }) =>
    teacherFetchJson<{ success: boolean; classItem: ClassItem; terms: TermItem[]; classAverages?: ClassAverageCardItem[] }>('/api/teacher/classes', {
      method: 'POST',
      body: input,
    }),

  updateClass: (
    id: string,
    input: {
      name: string;
      slogan?: string;
      teacherName: string;
      color: string;
      textColor: string;
      borderColor: string;
      borderDarkColor: string;
      colorStyle?: 'accent' | 'full';
      iconGradient: string;
    }
  ) =>
    teacherFetchJson<{ success: boolean; classItem: ClassItem }>(`/api/teacher/classes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  deleteClass: (id: string) =>
    teacherFetchJson<{ success: boolean; deletedId: string }>(`/api/teacher/classes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createTerm: (input: { id?: string; classId: string; number: number; name: string; coefficient?: number | null }) =>
    teacherFetchJson<{ success: boolean; term: TermItem; classAverage?: ClassAverageCardItem }>('/api/teacher/terms', {
      method: 'POST',
      body: input,
    }),

  updateTerm: (id: string, input: { name?: string; coefficient?: number | null }) =>
    teacherFetchJson<{ success: boolean; term: TermItem }>(`/api/teacher/terms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  deleteTerm: (id: string) =>
    teacherFetchJson<{ success: boolean; deletedId: string }>(`/api/teacher/terms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createSubject: (input: {
    id?: string;
    classId: string;
    termId: string;
    name: string;
    coefficient?: number | null;
    color: string;
    textColor: string;
    borderColor: string;
    borderDarkColor: string;
    colorStyle?: 'accent' | 'full';
  }) =>
    teacherFetchJson<{ success: boolean; subject: SubjectItem }>('/api/teacher/subjects', {
      method: 'POST',
      body: input,
    }),

  updateSubject: (
    id: string,
    input: {
      name?: string;
      coefficient?: number | null;
      color?: string;
      textColor?: string;
      borderColor?: string;
      borderDarkColor?: string;
      colorStyle?: 'accent' | 'full';
    }
  ) =>
    teacherFetchJson<{ success: boolean; subject: SubjectItem }>(`/api/teacher/subjects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  deleteSubject: (id: string) =>
    teacherFetchJson<{ success: boolean; deletedId: string }>(`/api/teacher/subjects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getGradebook: (subjectId: string, termId: string, signal?: AbortSignal) =>
    teacherFetchJson<TeacherGradebookResponse>(
      `/api/teacher/gradebook/${encodeURIComponent(subjectId)}/${encodeURIComponent(termId)}`,
      { method: 'GET', signal }
    ),

  saveGradebook: (
    subjectId: string,
    termId: string,
    payload: TeacherGradebookPayload,
    opts: { keepalive?: boolean } = {}
  ) =>
    teacherFetchJson<{ success: boolean; gradebookId: string; version: number; updatedAt: number }>(
      `/api/teacher/gradebook/${encodeURIComponent(subjectId)}/${encodeURIComponent(termId)}`,
      {
        method: 'PUT',
        body: payload,
        keepalive: opts.keepalive,
      }
    ),

  getClassAverageSheet: (averageId: string, signal?: AbortSignal) =>
    teacherFetchJson<ClassAverageSheetResponse>(
      `/api/teacher/class-average-sheet/${encodeURIComponent(averageId)}`,
      { method: 'GET', signal }
    ),

  saveClassAverageSheet: (
    averageId: string,
    payload: ClassAverageSheetSavePayload,
    opts: { keepalive?: boolean } = {}
  ) =>
    teacherFetchJson<{ success: boolean; averageId: string; version: number; updatedAt: number }>(
      `/api/teacher/class-average-sheet/${encodeURIComponent(averageId)}`,
      {
        method: 'PUT',
        body: payload,
        keepalive: opts.keepalive,
      }
    ),

  getClassRoster: (classId: string, signal?: AbortSignal) =>
    teacherFetchJson<TeacherClassRosterResponse>(
      `/api/teacher/class-roster/${encodeURIComponent(classId)}`,
      { method: 'GET', signal }
    ),

  uploadStudentPhoto: async (params: {
    subjectId: string;
    termId: string;
    studentId: string;
    blob: Blob;
  }): Promise<{ success: boolean; photoR2Key: string; photoUrl: string }> => {
    const token = getTeacherAuthToken();
    if (!token) throw new Error('Session non connectée.');
    const form = new FormData();
    form.append('subjectId', params.subjectId);
    form.append('termId', params.termId);
    form.append('studentId', params.studentId);
    const ext = params.blob.type === 'image/png' ? 'png' : params.blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    form.append('file', params.blob, `student.${ext}`);

    const res = await fetch(`${getBaseUrl()}/api/teacher/photos/student`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Échec d'envoi photo (${res.status})`);
    return data;
  },

  deleteStudentPhoto: (params: {
    subjectId: string;
    termId: string;
    studentId: string;
    photoR2Key?: string;
  }) =>
    teacherFetchJson<{ success: boolean }>('/api/teacher/photos/student', {
      method: 'DELETE',
      body: params,
    }),

  executeTransfer: (payload: ServerTransferRequest) =>
    teacherFetchJson<{
      success: boolean;
      serverSummary: {
        gradebooksCopied: number;
        studentsCopied: number;
        notesCopied: number;
        photosCopied: number;
      };
      classAverages?: ClassAverageCardItem[];
      gradebookStats: Record<string, GradebookInspection>;
    }>('/api/teacher/transfer', {
      method: 'POST',
      body: payload,
    }),

  batchCreateYears: (
    items: Array<{
      id?: string;
      label: string;
      color?: string;
      textColor?: string;
      colorStyle?: 'accent' | 'full';
    }>
  ) =>
    teacherFetchJson<{ success: boolean; years: SchoolYearItem[]; skippedLabels?: string[] }>(
      '/api/teacher/batch-create',
      { method: 'POST', body: { entity: 'years', items } }
    ),

  batchCreateSchools: (
    yearId: string,
    items: Array<{
      id?: string;
      name: string;
      logoDataUrl?: string | null;
      color?: string;
      textColor?: string;
      borderColor?: string;
      borderDarkColor?: string;
      colorStyle?: 'accent' | 'full';
    }>
  ) =>
    teacherFetchJson<{ success: boolean; schools: SchoolItem[] }>(
      '/api/teacher/batch-create',
      { method: 'POST', body: { entity: 'schools', yearId, items } }
    ),

  batchCreateLevels: (
    schoolId: string,
    items: Array<{
      id?: string;
      name: string;
      color?: string;
      textColor?: string;
      borderColor?: string;
      colorStyle?: 'accent' | 'full';
    }>
  ) =>
    teacherFetchJson<{ success: boolean; levels: StudyLevelItem[] }>(
      '/api/teacher/batch-create',
      { method: 'POST', body: { entity: 'levels', schoolId, items } }
    ),

  batchCreateClasses: (
    levelId: string,
    items: Array<{
      id?: string;
      name: string;
      slogan?: string;
      teacherName: string;
      color?: string;
      textColor?: string;
      borderColor?: string;
      borderDarkColor?: string;
      colorStyle?: 'accent' | 'full';
      iconGradient?: string;
    }>
  ) =>
    teacherFetchJson<{
      success: boolean;
      classes: ClassItem[];
      terms: TermItem[];
      classAverages: ClassAverageCardItem[];
    }>('/api/teacher/batch-create', {
      method: 'POST',
      body: { entity: 'classes', levelId, items },
    }),

  batchCreateTerms: (
    classId: string,
    items: Array<{
      id?: string;
      number: number;
      name: string;
      coefficient?: number | null;
    }>
  ) =>
    teacherFetchJson<{
      success: boolean;
      terms: TermItem[];
      classAverages: ClassAverageCardItem[];
    }>('/api/teacher/batch-create', {
      method: 'POST',
      body: { entity: 'terms', classId, items },
    }),

  batchCreateSubjects: (
    classId: string,
    termId: string,
    items: Array<{
      id?: string;
      name: string;
      coefficient?: number | null;
      color?: string;
      textColor?: string;
      borderColor?: string;
      borderDarkColor?: string;
      colorStyle?: 'accent' | 'full';
    }>
  ) =>
    teacherFetchJson<{ success: boolean; subjects: SubjectItem[] }>(
      '/api/teacher/batch-create',
      { method: 'POST', body: { entity: 'subjects', classId, termId, items } }
    ),
};
