import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeTransfer,
  inspectGradebookStorage,
  getGradebookStorageKeys,
  type StorageLike,
  type TeacherDataset,
} from './teacherTransferEngine';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const createSampleDataset = (): { dataset: TeacherDataset; storage: MemoryStorage } => {
  const storage = new MemoryStorage();

  const dataset: TeacherDataset = {
    schoolYears: [
      { id: 'y1', label: '2026 - 2027', color: '#ffffff', createdAt: 1 },
      { id: 'y2', label: '2027 - 2028', color: '#ffffff', createdAt: 2 },
    ],
    schools: [
      { id: 's1', yearId: 'y1', name: 'CME', color: '#ffffff', textColor: '#0f172a', borderColor: '#e2e8f0', borderDarkColor: '#94a3b8', createdAt: 1 },
      { id: 's2', yearId: 'y2', name: 'CME 2027', color: '#ffffff', textColor: '#0f172a', borderColor: '#e2e8f0', borderDarkColor: '#94a3b8', createdAt: 2 },
    ],
    studyLevels: [
      { id: 'l1', schoolId: 's1', yearId: 'y1', name: '2nde', createdAt: 1 },
      { id: 'l2', schoolId: 's1', yearId: 'y1', name: 'Terminale', createdAt: 2 },
    ],
    classes: [
      {
        id: 'c1', levelId: 'l1', schoolId: 's1', yearId: 'y1', level: '2nde', name: '2nde A',
        teacherName: 'M. DKD', color: '#ea580c', textColor: '#ffffff', borderColor: '#c2410c',
        borderDarkColor: '#9a3412', iconGradient: 'linear-gradient(#f97316, #ea580c)', createdAt: 1,
      },
      {
        id: 'c2', levelId: 'l1', schoolId: 's1', yearId: 'y1', level: '2nde', name: '2nde B',
        teacherName: 'M. DKD', color: '#ea580c', textColor: '#ffffff', borderColor: '#c2410c',
        borderDarkColor: '#9a3412', iconGradient: 'linear-gradient(#f97316, #ea580c)', createdAt: 2,
      },
    ],
    terms: [
      { id: 't1', classId: 'c1', schoolId: 's1', yearId: 'y1', number: 1, name: 'Trimestre 1', createdAt: 1 },
      { id: 't2', classId: 'c1', schoolId: 's1', yearId: 'y1', number: 2, name: 'Trimestre 2', createdAt: 2 },
      { id: 't3', classId: 'c1', schoolId: 's1', yearId: 'y1', number: 3, name: 'Trimestre 3', createdAt: 3 },
      { id: 't2-1', classId: 'c2', schoolId: 's1', yearId: 'y1', number: 1, name: 'Trimestre 1', createdAt: 4 },
      { id: 't2-2', classId: 'c2', schoolId: 's1', yearId: 'y1', number: 2, name: 'Trimestre 2', createdAt: 5 },
    ],
    subjects: [
      {
        id: 'sub1', classId: 'c1', termId: 't1', schoolId: 's1', yearId: 'y1', name: 'Physique-Chimie',
        coefficient: 3, color: '#dc2626', textColor: '#ffffff', borderColor: '#b91c1c', borderDarkColor: '#991b1b', createdAt: 1,
      },
      {
        id: 'sub2', classId: 'c1', termId: 't1', schoolId: 's1', yearId: 'y1', name: 'Mathématiques',
        coefficient: 4, color: '#2563eb', textColor: '#ffffff', borderColor: '#1d4ed8', borderDarkColor: '#1e40af', createdAt: 2,
      },
    ],
  };

  // Remplir le tableur de sub1 / t1 avec 2 élèves nommés, 1 photo, 3 notes, barèmes personnalisés et mise en forme
  const keys = getGradebookStorageKeys('sub1', 't1');
  storage.setItem(keys.colCount, '7');
  storage.setItem(
    keys.colMetas,
    JSON.stringify({ 0: { title: 'DEVOIR 1', maxScore: 20 }, 1: { title: 'COMPO', maxScore: 40 } })
  );
  storage.setItem(
    keys.students,
    JSON.stringify([
      { id: 'stu-1', name: 'Kouassi Aya', photoUrl: 'data:image/png;base64,AAA', notes: ['15/20', '32/40', '', '', '', '', ''] },
      { id: 'stu-2', name: 'Traoré Paul', photoUrl: undefined, notes: ['12/20', '', '', '', '', '', ''] },
      { id: 'stu-3', name: '', photoUrl: undefined, notes: ['', '', '', '', '', '', ''] },
    ])
  );
  storage.setItem(keys.rowColors, JSON.stringify({ 'stu-1': '#fef3c7' }));
  storage.setItem(keys.cellStyles, JSON.stringify({ 'stu-1-name': { bold: true }, 'stu-1-note-0': { italic: true } }));

  return { dataset, storage };
};

test('inspectGradebookStorage compte correctement élèves nommés, photos, notes et métadonnées', () => {
  const { storage } = createSampleDataset();
  const info = inspectGradebookStorage('sub1', 't1', storage);
  assert.equal(info.hasStorage, true);
  assert.equal(info.namedStudentsCount, 2);
  assert.equal(info.photosCount, 1);
  assert.equal(info.notesCount, 3);
  assert.equal(info.hasCustomMetas, true);
  assert.equal(info.hasFormatting, true);

  const emptyInfo = inspectGradebookStorage('sub2', 't1', storage);
  assert.equal(emptyInfo.hasStorage, false);
  assert.equal(emptyInfo.namedStudentsCount, 0);
  assert.equal(emptyInfo.notesCount, 0);
});

test('term_to_term reproduit les matières dans plusieurs trimestres avec noms des élèves SANS les notes', () => {
  const { dataset, storage } = createSampleDataset();
  const result = executeTransfer(
    {
      mode: 'term_to_term',
      sourceClassId: 'c1',
      sourceTermId: 't1',
      subjectIds: ['sub1', 'sub2'],
      targetTermIds: ['t2', 't3'],
      conflictStrategy: 'skip',
      gradebook: {
        contentMode: 'students_only',
        includePhotos: true,
        includeMetas: true,
        includeFormatting: true,
      },
    },
    dataset,
    storage
  );

  assert.equal(result.summary.subjectsCreated, 4); // 2 matières x 2 trimestres
  assert.equal(result.summary.studentsCopied, 4); // 2 élèves x 2 trimestres (depuis sub1)
  assert.equal(result.summary.notesCopied, 0); // aucune note copiée en mode students_only
  assert.equal(result.summary.photosCopied, 2); // 1 photo x 2 trimestres

  const t2Physics = result.nextSubjects.find((s) => s.termId === 't2' && s.name === 'Physique-Chimie');
  assert.ok(t2Physics);
  const dstInfo = inspectGradebookStorage(t2Physics.id, 't2', storage);
  assert.equal(dstInfo.namedStudentsCount, 2);
  assert.equal(dstInfo.notesCount, 0);
  assert.equal(dstInfo.photosCount, 1);
  assert.equal(dstInfo.hasCustomMetas, true);

  // Vérifier que les IDs des styles de ligne/cellule ont bien été remappés et que les styles de notes ont été exclus
  const dstKeys = getGradebookStorageKeys(t2Physics.id, 't2');
  const clonedStudents = JSON.parse(storage.getItem(dstKeys.students)!);
  const newFirstId = clonedStudents[0].id;
  assert.notEqual(newFirstId, 'stu-1');
  const clonedStyles = JSON.parse(storage.getItem(dstKeys.cellStyles)!);
  assert.deepEqual(clonedStyles[`${newFirstId}-name`], { bold: true });
  assert.equal(clonedStyles[`${newFirstId}-note-0`], undefined);
});

test('subject_to_subject partage la liste des élèves + notes entre deux matières', () => {
  const { dataset, storage } = createSampleDataset();
  const result = executeTransfer(
    {
      mode: 'subject_to_subject',
      sourceSubjectId: 'sub1',
      sourceTermId: 't1',
      targetEntries: [{ subjectId: 'sub2', termId: 't1' }],
      gradebook: {
        contentMode: 'students_and_notes',
        includePhotos: false,
        includeMetas: true,
        includeFormatting: false,
      },
    },
    dataset,
    storage
  );

  assert.equal(result.summary.gradebooksCopied, 1);
  assert.equal(result.summary.studentsCopied, 2);
  assert.equal(result.summary.notesCopied, 3);
  assert.equal(result.summary.photosCopied, 0); // includePhotos = false

  const sub2Info = inspectGradebookStorage('sub2', 't1', storage);
  assert.equal(sub2Info.namedStudentsCount, 2);
  assert.equal(sub2Info.notesCount, 3);
  assert.equal(sub2Info.photosCount, 0);
});

test('class_to_class transfère matières et contenu dans une autre classe du même niveau avec gestion des doublons', () => {
  const { dataset, storage } = createSampleDataset();
  const firstRun = executeTransfer(
    {
      mode: 'class_to_class',
      sourceClassId: 'c1',
      targetClassIds: ['c2'],
      copyTerms: true,
      termIds: ['t1'],
      copySubjects: true,
      subjectIds: ['sub1', 'sub2'],
      conflictStrategy: 'skip',
      gradebook: {
        contentMode: 'students_only',
        includePhotos: true,
        includeMetas: true,
        includeFormatting: false,
      },
    },
    dataset,
    storage
  );

  assert.equal(firstRun.summary.subjectsCreated, 2);
  assert.equal(firstRun.summary.subjectsSkipped, 0);

  // Relancer avec skip -> 2 doublons ignorés, 0 recréé
  const secondRun = executeTransfer(
    {
      mode: 'class_to_class',
      sourceClassId: 'c1',
      targetClassIds: ['c2'],
      copyTerms: true,
      termIds: ['t1'],
      copySubjects: true,
      subjectIds: ['sub1', 'sub2'],
      conflictStrategy: 'skip',
      gradebook: {
        contentMode: 'students_only',
        includePhotos: true,
        includeMetas: true,
        includeFormatting: false,
      },
    },
    {
      ...dataset,
      studyLevels: firstRun.nextStudyLevels,
      classes: firstRun.nextClasses,
      terms: firstRun.nextTerms,
      subjects: firstRun.nextSubjects,
    },
    storage
  );

  assert.equal(secondRun.summary.subjectsCreated, 0);
  assert.equal(secondRun.summary.subjectsSkipped, 2);
});

test('level_to_level transfère classes, trimestres, matières et élèves vers un autre niveau', () => {
  const { dataset, storage } = createSampleDataset();
  const res = executeTransfer(
    {
      mode: 'level_to_level',
      sourceLevelId: 'l1',
      targetLevelIds: ['l2'],
      copyClasses: true,
      classIds: ['c1'],
      copyTerms: true,
      termNumbers: [1, 2],
      copySubjects: true,
      subjectIds: ['sub1'],
      conflictStrategy: 'skip',
      gradebook: {
        contentMode: 'students_and_notes',
        includePhotos: true,
        includeMetas: true,
        includeFormatting: false,
      },
    },
    dataset,
    storage
  );

  assert.equal(res.summary.classesCreated, 1);
  assert.equal(res.summary.subjectsCreated, 1);
  assert.equal(res.summary.studentsCopied, 2);
  assert.equal(res.summary.notesCopied, 3);

  const newClass = res.nextClasses.find((c) => c.levelId === 'l2');
  assert.ok(newClass);
  assert.equal(newClass.level, 'Terminale');
});

test('school_to_school transfère un niveau complet vers une autre école / nouvelle année scolaire', () => {
  const { dataset, storage } = createSampleDataset();
  const res = executeTransfer(
    {
      mode: 'school_to_school',
      sourceSchoolId: 's1',
      targetSchoolIds: ['s2'],
      levelIds: ['l1'],
      copyClasses: true,
      copyTerms: true,
      copySubjects: true,
      conflictStrategy: 'skip',
      gradebook: {
        contentMode: 'students_only',
        includePhotos: true,
        includeMetas: true,
        includeFormatting: false,
      },
    },
    dataset,
    storage
  );

  assert.equal(res.summary.levelsCreated, 1);
  assert.equal(res.summary.classesCreated, 2);
  assert.equal(res.summary.subjectsCreated, 2);
  assert.equal(res.summary.studentsCopied, 2);
  assert.equal(res.summary.notesCopied, 0);
});
