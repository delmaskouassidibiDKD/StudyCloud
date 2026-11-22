import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTermGeneralAverageTable,
  formatCoeffDisplay,
  formatFrenchNumber,
  parseManualAverageInput,
} from './termGeneralAverage';

test('calcul exact Moy./20, Moy.×Coeff, Total Général, Moyenne Générale, Rang ex æquo et Moyenne de classe', () => {
  const result = computeTermGeneralAverageTable({
    subjects: [
      { id: 'math', name: 'Mathématiques', coefficient: 4 },
      { id: 'elec', name: 'Électrotechnique', coefficient: 5 },
      { id: 'fr', name: 'Français', coefficient: 2 },
    ],
    subjectGradebooks: {
      math: [
        { id: 'r1', studentUid: 'u1', name: 'KOUASSI Jean', average20: 15.5, notesCount: 2 },
        { id: 'r2', studentUid: 'u2', name: 'TRAORÉ Awa', average20: 14, notesCount: 2 },
        { id: 'r3', studentUid: 'u3', name: 'KONÉ Moussa', average20: 11, notesCount: 2 },
        // Ligne vide par défaut => doit être ignorée
        { id: 'r4', studentUid: 'u-empty', name: '', average20: null, notesCount: 0 },
      ],
      elec: [
        // Même élève mais saisi avec un autre studentUid et accents/casse différents
        { id: 'e1', studentUid: 'other-1', name: 'kouassi  jean', average20: 16, notesCount: 3 },
        { id: 'e2', studentUid: 'other-2', name: 'Traore Awa', average20: 14.5, notesCount: 3 },
        { id: 'e3', studentUid: 'other-3', name: 'Kone Moussa', average20: 12.5, notesCount: 3 },
      ],
      fr: [
        { id: 'f1', studentUid: 'u1', name: 'KOUASSI Jean', average20: 13, notesCount: 1, photoUrl: 'https://img/jean.webp' },
        { id: 'f2', studentUid: 'u2', name: 'TRAORÉ Awa', average20: 15, notesCount: 1 },
        { id: 'f3', studentUid: 'u3', name: 'KONÉ Moussa', average20: 10, notesCount: 1 },
      ],
    },
    sortMode: 'merit',
  });

  assert.equal(result.students.length, 3);
  assert.equal(result.classSummary.totalClassCoeff, 11);

  // 1er : KOUASSI Jean -> Math: 15.5*4=62, Elec: 16*5=80, Fr: 13*2=26 -> Total=168 -> Moy=168/11=15.2727...
  const jean = result.students[0];
  assert.equal(jean.name, 'KOUASSI Jean');
  assert.equal(jean.photoUrl, 'https://img/jean.webp');
  assert.equal(jean.rankLabel, '1er');
  assert.equal(jean.cellsBySubject.math.effectiveAverage, 15.5);
  assert.equal(jean.cellsBySubject.math.weightedValue, 62);
  assert.equal(jean.cellsBySubject.elec.weightedValue, 80);
  assert.equal(jean.cellsBySubject.fr.weightedValue, 26);
  assert.equal(jean.totalGeneral, 168);
  assert.equal(jean.totalCoeffCounted, 11);
  assert.ok(Math.abs((jean.generalAverage ?? 0) - 168 / 11) < 1e-9);
  assert.equal(jean.mention, 'Bien');

  // 2e : TRAORÉ Awa -> 14*4 + 14.5*5 + 15*2 = 56 + 72.5 + 30 = 158.5 -> 158.5/11 = 14.4090...
  const awa = result.students[1];
  assert.equal(awa.name, 'TRAORÉ Awa');
  assert.equal(awa.rankLabel, '2e');
  assert.equal(awa.totalGeneral, 158.5);
  assert.equal(awa.mention, 'Bien');

  // 3e : KONÉ Moussa -> 11*4 + 12.5*5 + 10*2 = 44 + 62.5 + 20 = 126.5 -> 126.5/11 = 11.5
  const moussa = result.students[2];
  assert.equal(moussa.rankLabel, '3e');
  assert.equal(moussa.totalGeneral, 126.5);
  assert.equal(moussa.generalAverage, 11.5);
  assert.equal(moussa.mention, 'Passable');

  // Bilan classe
  assert.ok(Math.abs((result.classSummary.bySubject.math.classAverage20 ?? 0) - 13.5) < 1e-9);
  assert.ok(Math.abs((result.classSummary.bySubject.math.classWeightedAverage ?? 0) - 54) < 1e-9);
  assert.equal(result.classSummary.passCount, 3);
  assert.equal(result.classSummary.passRatePercent, 100);
});

test('matière sans coefficient (coeff=1), matière non notée ignorée et mode hybride manuel', () => {
  const result = computeTermGeneralAverageTable({
    subjects: [
      { id: 's1', name: 'Physique', coefficient: null }, // coeff par défaut = 1
      { id: 's2', name: 'Anglais', coefficient: 2 },
    ],
    subjectGradebooks: {
      s1: [
        { id: 'p1', studentUid: 'u1', name: 'Bamba Ali', average20: 14, notesCount: 2 },
      ],
      s2: [], // Anglais encore vide dans son tableur
    },
    overrides: {
      manualStudents: [{ key: 'man-1', name: 'Diallo Fatou' }],
      subjectOverrides: {
        'name:bamba ali': {
          s1: 8, // Doit être IGNORÉ car s1 a déjà 14 dans le tableur réel de la matière !
          s2: 16, // Pris en compte en mode hybride car s2 est vide dans le tableur !
        },
        'man-1': {
          s1: 12,
          // s2 volontairement non saisi => ignoré, pas compté comme 0
        },
      },
    },
    sortMode: 'alpha',
  });

  assert.equal(result.students.length, 2);
  // Tri alphabétique : Bamba Ali puis Diallo Fatou
  const ali = result.students[0];
  assert.equal(ali.name, 'Bamba Ali');
  assert.equal(ali.cellsBySubject.s1.source, 'gradebook');
  assert.equal(ali.cellsBySubject.s1.effectiveAverage, 14);
  assert.equal(ali.cellsBySubject.s1.weightedValue, 14);
  assert.equal(ali.cellsBySubject.s2.source, 'manual');
  assert.equal(ali.cellsBySubject.s2.effectiveAverage, 16);
  assert.equal(ali.cellsBySubject.s2.weightedValue, 32);
  assert.equal(ali.totalGeneral, 46);
  assert.equal(ali.totalCoeffCounted, 3);
  assert.ok(Math.abs((ali.generalAverage ?? 0) - 46 / 3) < 1e-9);
  assert.equal(ali.rankLabel, '1er');

  const fatou = result.students[1];
  assert.equal(fatou.name, 'Diallo Fatou');
  assert.equal(fatou.isManualOnly, true);
  assert.equal(fatou.cellsBySubject.s1.weightedValue, 12);
  assert.equal(fatou.cellsBySubject.s2.effectiveAverage, null);
  assert.equal(fatou.totalGeneral, 12);
  assert.equal(fatou.totalCoeffCounted, 1);
  assert.equal(fatou.generalAverage, 12);
  assert.equal(fatou.rankLabel, '2e');
});

test('préserve deux homonymes distincts dans une même matière et helpers de formatage', () => {
  const result = computeTermGeneralAverageTable({
    subjects: [{ id: 'm1', name: 'Maths', coefficient: 2.5 }],
    subjectGradebooks: {
      m1: [
        { id: 'a', studentUid: 'ua', name: 'Koffi Yao', average20: 12, notesCount: 1 },
        { id: 'b', studentUid: 'ub', name: 'Koffi Yao', average20: 12, notesCount: 1 },
      ],
    },
  });

  assert.equal(result.students.length, 2);
  assert.equal(result.students[0].rankLabel, '1er ex');
  assert.equal(result.students[1].rankLabel, '1er ex');
  assert.equal(result.students[0].cellsBySubject.m1.weightedValue, 30);

  assert.equal(formatFrenchNumber(15.5), '15,50');
  assert.equal(formatFrenchNumber(null), '—');
  assert.equal(formatCoeffDisplay(4), '4');
  assert.equal(formatCoeffDisplay(2.5), '2,5');
  assert.deepEqual(parseManualAverageInput('14,75'), { valid: true, value: 14.75 });
  assert.deepEqual(parseManualAverageInput(''), { valid: true, value: null });
  assert.deepEqual(parseManualAverageInput('21'), { valid: false, value: null });
  assert.deepEqual(parseManualAverageInput('-2'), { valid: false, value: null });
});
