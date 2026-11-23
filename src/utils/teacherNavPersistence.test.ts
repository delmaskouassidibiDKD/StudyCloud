import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
