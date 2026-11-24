import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEACHER_SCHOOLS_GRID_COLUMNS,
  TEACHER_SCHOOLS_GRID_ROWS,
  TEACHER_SCHOOLS_PER_PAGE,
  TEACHER_SCHOOLS_SLOTS_PER_PAGE,
  getTeacherSchoolPageForIndex,
  getTeacherSchoolsTotalPages,
  paginateTeacherSchools,
  parseTeacherNavSnapshot,
  resolveTeacherNavSnapshot,
  type TeacherNavDataset,
  type TeacherNavSnapshot,
} from './teacherNavPersistence';

const SAMPLE_DATASET: TeacherNavDataset = {
  schoolYears: [{ id: 'y-2026' }, { id: 'y-2027' }],
  schools: [
    { id: 'sch-1', yearId: 'y-2026' },
    { id: 'sch-2', yearId: 'y-2027' },
  ],
  studyLevels: [
    { id: 'lvl-1', schoolId: 'sch-1', yearId: 'y-2026' },
    { id: 'lvl-2', schoolId: 'sch-1', yearId: 'y-2026' },
  ],
  classes: [
    { id: 'cls-1', levelId: 'lvl-1', schoolId: 'sch-1', yearId: 'y-2026', createdAt: 100 },
    { id: 'cls-2', levelId: 'lvl-2', schoolId: 'sch-1', yearId: 'y-2026', createdAt: 101 },
  ],
  terms: [
    { id: 't-1', classId: 'cls-1', schoolId: 'sch-1', yearId: 'y-2026', number: 1, name: 'Trimestre 1', createdAt: 10 },
    { id: 't-2', classId: 'cls-1', schoolId: 'sch-1', yearId: 'y-2026', number: 2, name: 'Trimestre 2', createdAt: 11 },
  ],
  subjects: [
    { id: 'sub-math', classId: 'cls-1', termId: 't-2', schoolId: 'sch-1', yearId: 'y-2026' },
  ],
  classAverages: [
    {
      id: 'cavg-annual-cls-1',
      classId: 'cls-1',
      schoolId: 'sch-1',
      yearId: 'y-2026',
      kind: 'annual',
      title: "Moyenne générale de l'année",
      sortOrder: 0,
    },
    {
      id: 'cavg-term-t-2',
      classId: 'cls-1',
      termId: 't-2',
      schoolId: 'sch-1',
      yearId: 'y-2026',
      kind: 'term',
      title: 'Moyenne générale · Trimestre 2',
      sortOrder: 2,
    },
  ],
};

function makeSnap(partial: Partial<TeacherNavSnapshot>): TeacherNavSnapshot {
  return {
    version: 1,
    selectedYearId: 'y-2026',
    selectedSchoolId: null,
    schoolInsideId: null,
    selectedLevelId: null,
    selectedClassId: null,
    enteredClassId: null,
    selectedTermId: null,
    subjectInsideId: null,
    averageCardInsideId: null,
    averageCardKind: null,
    averageCardClassId: null,
    averageCardTermId: null,
    isTransferViewOpen: false,
    viewerExpandLevel: 0,
    updatedAt: 1000,
    ...partial,
  };
}

test('Restaure exactement le tableau de notes d’une matière + toute sa hiérarchie parente après rechargement', () => {
  const snap = makeSnap({
    schoolInsideId: 'sch-1',
    selectedLevelId: 'lvl-1',
    selectedClassId: 'cls-1',
    enteredClassId: 'cls-1',
    selectedTermId: 't-2',
    subjectInsideId: 'sub-math',
    viewerExpandLevel: 2,
  });

  const resolved = resolveTeacherNavSnapshot(snap, SAMPLE_DATASET);
  assert.equal(resolved.needsCloudHydration, false);
  assert.equal(resolved.selectedYearId, 'y-2026');
  assert.equal(resolved.selectedSchoolInside?.id, 'sch-1');
  assert.equal(resolved.selectedLevelId, 'lvl-1');
  assert.equal(resolved.selectedClassId, 'cls-1');
  assert.equal(resolved.enteredClassId, 'cls-1');
  assert.equal(resolved.selectedTermId, 't-2');
  assert.equal(resolved.selectedSubjectInside?.id, 'sub-math');
  assert.equal(resolved.selectedAverageCardInside, null);
  assert.equal(resolved.viewerExpandLevel, 2);
});

test('Restaure exactement la Moyenne générale trimestrielle ET la Moyenne générale annuelle', () => {
  const termAvgSnap = makeSnap({
    schoolInsideId: 'sch-1',
    selectedClassId: 'cls-1',
    enteredClassId: 'cls-1',
    selectedTermId: 't-2',
    averageCardInsideId: 'cavg-term-t-2',
    averageCardKind: 'term',
    averageCardClassId: 'cls-1',
    averageCardTermId: 't-2',
  });
  const resTerm = resolveTeacherNavSnapshot(termAvgSnap, SAMPLE_DATASET);
  assert.equal(resTerm.selectedAverageCardInside?.id, 'cavg-term-t-2');
  assert.equal(resTerm.selectedAverageCardInside?.kind, 'term');
  assert.equal(resTerm.selectedTermId, 't-2');
  assert.equal(resTerm.selectedClassId, 'cls-1');
  assert.equal(resTerm.selectedSchoolInside?.id, 'sch-1');

  const annualSnap = makeSnap({
    schoolInsideId: 'sch-1',
    selectedClassId: 'cls-1',
    averageCardInsideId: 'cavg-annual-cls-1',
    averageCardKind: 'annual',
    averageCardClassId: 'cls-1',
    averageCardTermId: null,
  });
  const resAnnual = resolveTeacherNavSnapshot(annualSnap, SAMPLE_DATASET);
  assert.equal(resAnnual.selectedAverageCardInside?.id, 'cavg-annual-cls-1');
  assert.equal(resAnnual.selectedAverageCardInside?.kind, 'annual');
  assert.equal(resAnnual.selectedClassId, 'cls-1');
  assert.equal(resAnnual.selectedSchoolInside?.id, 'sch-1');
});

test('Si le cache local est vide (après une mise à jour), signale needsCloudHydration=true puis restaure dès le bootstrap', () => {
  const snap = makeSnap({
    schoolInsideId: 'sch-1',
    selectedClassId: 'cls-1',
    enteredClassId: 'cls-1',
    selectedTermId: 't-2',
    averageCardInsideId: 'cavg-term-t-2',
    averageCardKind: 'term',
    averageCardClassId: 'cls-1',
    averageCardTermId: 't-2',
  });

  const beforeBootstrap = resolveTeacherNavSnapshot(snap, null);
  assert.equal(beforeBootstrap.needsCloudHydration, true);

  const afterBootstrap = resolveTeacherNavSnapshot(snap, SAMPLE_DATASET);
  assert.equal(afterBootstrap.needsCloudHydration, false);
  assert.equal(afterBootstrap.selectedAverageCardInside?.id, 'cavg-term-t-2');
});

test('parseTeacherNavSnapshot tolère le JSON corrompu et sanitize les champs', () => {
  assert.equal(parseTeacherNavSnapshot('not-json'), null);
  assert.equal(parseTeacherNavSnapshot(null), null);
  const parsed = parseTeacherNavSnapshot(
    JSON.stringify({
      selectedYearId: ' y-2026 ',
      schoolInsideId: 'sch-1',
      averageCardKind: 'annual',
      viewerExpandLevel: 2,
      isTransferViewOpen: true,
    })
  );
  assert.equal(parsed?.selectedYearId, 'y-2026');
  assert.equal(parsed?.schoolInsideId, 'sch-1');
  assert.equal(parsed?.averageCardKind, 'annual');
  assert.equal(parsed?.viewerExpandLevel, 2);
  assert.equal(parsed?.isTransferViewOpen, true);
});

test('Pagination horizontale des écoles : 4 colonnes x 3 lignes = 12 cases (1 bouton + et 11 écoles max par page)', () => {
  assert.equal(TEACHER_SCHOOLS_GRID_COLUMNS, 4);
  assert.equal(TEACHER_SCHOOLS_GRID_ROWS, 3);
  assert.equal(TEACHER_SCHOOLS_SLOTS_PER_PAGE, 12);
  assert.equal(TEACHER_SCHOOLS_PER_PAGE, 11);

  assert.deepEqual(paginateTeacherSchools([]), [[]]);
  assert.equal(getTeacherSchoolsTotalPages(0), 1);
  assert.equal(getTeacherSchoolsTotalPages(11), 1);
  assert.equal(getTeacherSchoolsTotalPages(12), 2);
  assert.equal(getTeacherSchoolsTotalPages(22), 2);
  assert.equal(getTeacherSchoolsTotalPages(23), 3);

  const schools12 = Array.from({ length: 12 }, (_, i) => ({ id: `sch-${i + 1}`, yearId: 'y-2026' }));
  const pages12 = paginateTeacherSchools(schools12);
  assert.equal(pages12.length, 2);
  assert.equal(pages12[0].length, 11);
  assert.equal(pages12[1].length, 1);

  const schools25 = Array.from({ length: 25 }, (_, i) => ({ id: `sch-${i + 1}`, yearId: 'y-2026' }));
  const pages25 = paginateTeacherSchools(schools25);
  assert.equal(pages25.length, 3);
  assert.deepEqual(pages25.map((p) => p.length), [11, 11, 3]);

  assert.equal(getTeacherSchoolPageForIndex(0), 0);
  assert.equal(getTeacherSchoolPageForIndex(10), 0);
  assert.equal(getTeacherSchoolPageForIndex(11), 1);
  assert.equal(getTeacherSchoolPageForIndex(22), 2);
});

test('Restaure exactement la page horizontale des écoles et l’onglet actif après avoir quitté et rouvert Moyennes', () => {
  const manySchools = Array.from({ length: 24 }, (_, i) => ({
    id: `sch-${i + 1}`,
    yearId: 'y-2026',
  }));
  const bigDataset: TeacherNavDataset = {
    ...SAMPLE_DATASET,
    schools: [...manySchools, { id: 'sch-y27-1', yearId: 'y-2027' }],
  };

  // 1. L'utilisateur était sur Page 3 (index 2) des écoles de 2026 - 2027 et quitte l'app Moyennes
  const serialized = JSON.stringify(
    makeSnap({
      activeNavTab: 'dashboard',
      selectedYearId: 'y-2026',
      schoolsPageIndex: 2,
      schoolsPageByYear: { 'y-2026': 2, 'y-2027': 0 },
    })
  );
  const parsed = parseTeacherNavSnapshot(serialized);
  assert.ok(parsed);
  assert.equal(parsed.schoolsPageIndex, 2);
  assert.equal(parsed.schoolsPageByYear?.['y-2026'], 2);

  // 2. Avant hydratation cloud (cache vide), la page est conservée et needsCloudHydration = true
  const beforeCloud = resolveTeacherNavSnapshot(parsed, null);
  assert.equal(beforeCloud.needsCloudHydration, true);
  assert.equal(beforeCloud.schoolsPageIndex, 2);
  assert.equal(beforeCloud.schoolsPageByYear['y-2026'], 2);

  // 3. Une fois les 24 écoles chargées (3 pages), l'utilisateur retombe exactement sur Page 3 (index 2)
  const resolved = resolveTeacherNavSnapshot(parsed, bigDataset);
  assert.equal(resolved.needsCloudHydration, false);
  assert.equal(resolved.selectedYearId, 'y-2026');
  assert.equal(resolved.schoolsPageIndex, 2);
  assert.equal(resolved.schoolsPageByYear['y-2026'], 2);

  // 4. Si des écoles ont été supprimées ailleurs (plus que 12 écoles -> 2 pages max), clamp propre à l'index 1
  const smallerDataset: TeacherNavDataset = {
    ...SAMPLE_DATASET,
    schools: manySchools.slice(0, 12),
  };
  const clamped = resolveTeacherNavSnapshot(parsed, smallerDataset);
  assert.equal(clamped.schoolsPageIndex, 1);
  assert.equal(clamped.schoolsPageByYear['y-2026'], 1);
});
