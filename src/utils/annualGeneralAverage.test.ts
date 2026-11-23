import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAnnualGeneralAverageTable, type AnnualTermData } from './annualGeneralAverage';

test('Moyenne annuelle pondérée par coefficients de trimestres (T1=1, T2=2, T3=2) : Total, Rang, Mention, Décision et Évolution', () => {
  const terms: AnnualTermData[] = [
    {
      id: 't1',
      number: 1,
      name: 'Trimestre 1',
      coefficient: 1,
      effectiveCoeff: 1,
      subjects: [
        { id: 'm1', name: 'Maths', coefficient: 4, effectiveCoeff: 4 },
        { id: 'f1', name: 'Français', coefficient: 2, effectiveCoeff: 2 },
      ],
      subjectGradebooks: {
        // Jean T1 = (12*4 + 12*2) / 6 = 12.00
        // Awa  T1 = (15*4 + 12*2) / 6 = 14.00
        // Ali  T1 = (8*4  + 8*2)  / 6 = 8.00
        m1: [
          { id: 's1', studentUid: 'u-jean', name: 'KOUASSI Jean', average20: 12, notesCount: 2 },
          { id: 's2', studentUid: 'u-awa', name: 'TRAORÉ Awa', average20: 15, notesCount: 2 },
          { id: 's3', studentUid: 'u-ali', name: 'DIALLO Ali', average20: 8, notesCount: 2 },
        ],
        f1: [
          { id: 's4', studentUid: 'u-jean', name: 'KOUASSI Jean', average20: 12, notesCount: 2 },
          { id: 's5', studentUid: 'u-awa', name: 'TRAORÉ Awa', average20: 12, notesCount: 2 },
          { id: 's6', studentUid: 'u-ali', name: 'DIALLO Ali', average20: 8, notesCount: 2 },
        ],
      },
    },
    {
      id: 't2',
      number: 2,
      name: 'Trimestre 2',
      coefficient: 2,
      effectiveCoeff: 2,
      subjects: [{ id: 'm2', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: {
        // Jean T2 = 14.00 (x2 = 28.00)
        // Awa  T2 = 11.00 (x2 = 22.00)
        // Ali  T2 = 9.00  (x2 = 18.00)
        m2: [
          { id: 's7', studentUid: 'u-jean', name: 'KOUASSI Jean', average20: 14, notesCount: 2 },
          { id: 's8', studentUid: 'u-awa', name: 'TRAORÉ Awa', average20: 11, notesCount: 2 },
          { id: 's9', studentUid: 'u-ali', name: 'DIALLO Ali', average20: 9, notesCount: 2 },
        ],
      },
    },
    {
      id: 't3',
      number: 3,
      name: 'Trimestre 3',
      coefficient: 2,
      effectiveCoeff: 2,
      subjects: [{ id: 'm3', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: {
        // Jean T3 = 15.00 (x2 = 30.00) -> Total = 12 + 28 + 30 = 70 / 5 = 14.00 (Bien, 1er, Admis(e), delta +3)
        // Awa  T3 = 12.00 (x2 = 24.00) -> Total = 14 + 22 + 24 = 60 / 5 = 12.00 (Assez bien, 2e, Admis(e), delta -2)
        // Ali  T3 = 8.50  (x2 = 17.00) -> Total = 8  + 18 + 17 = 43 / 5 = 8.60  (Insuffisant, 3e, Ajourné(e), delta +0.5)
        m3: [
          { id: 's10', studentUid: 'u-jean', name: 'KOUASSI Jean', average20: 15, notesCount: 2 },
          { id: 's11', studentUid: 'u-awa', name: 'TRAORÉ Awa', average20: 12, notesCount: 2 },
          { id: 's12', studentUid: 'u-ali', name: 'DIALLO Ali', average20: 8.5, notesCount: 2 },
        ],
      },
    },
  ];

  const res = computeAnnualGeneralAverageTable({ terms, sortMode: 'merit' });
  assert.equal(res.terms.length, 3);
  assert.equal(res.classSummary.totalClassCoeff, 5);
  assert.equal(res.students.length, 3);

  const [jean, awa, ali] = res.students;
  assert.equal(jean.name, 'KOUASSI Jean');
  assert.equal(jean.rankLabel, '1er');
  assert.equal(jean.totalAnnual, 70);
  assert.equal(jean.annualAverage, 14);
  assert.equal(jean.mention, 'Bien');
  assert.equal(jean.decision, 'Admis(e)');
  assert.equal(jean.progressionDelta, 3);
  assert.equal(jean.cellsByTerm.t1.termRankLabel, '2e');
  assert.equal(jean.cellsByTerm.t2.termRankLabel, '1er');
  assert.equal(jean.cellsByTerm.t3.termRankLabel, '1er');

  assert.equal(awa.name, 'TRAORÉ Awa');
  assert.equal(awa.rankLabel, '2e');
  assert.equal(awa.totalAnnual, 60);
  assert.equal(awa.annualAverage, 12);
  assert.equal(awa.decision, 'Admis(e)');
  assert.equal(awa.progressionDelta, -2);

  assert.equal(ali.name, 'DIALLO Ali');
  assert.equal(ali.rankLabel, '3e');
  assert.equal(ali.annualAverage, 8.6);
  assert.equal(ali.decision, 'Ajourné(e)');
  assert.equal(ali.progressionDelta, 0.5);

  // Taux de réussite : 2/3 admis (>= 10)
  assert.equal(res.classSummary.passCount, 2);
  assert.ok(Math.abs((res.classSummary.passRatePercent ?? 0) - 66.6666) < 0.01);
});

test('En cours d’année (T3 vide) : un trimestre sans note ne pénalise jamais la moyenne annuelle', () => {
  const terms: AnnualTermData[] = [
    {
      id: 't1',
      number: 1,
      name: 'Trimestre 1',
      coefficient: 1,
      effectiveCoeff: 1,
      subjects: [{ id: 'm1', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: {
        m1: [{ id: 'a1', studentUid: 'u1', name: 'YAO Marc', average20: 12, notesCount: 2 }],
      },
    },
    {
      id: 't2',
      number: 2,
      name: 'Trimestre 2',
      coefficient: 2,
      effectiveCoeff: 2,
      subjects: [{ id: 'm2', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: {
        m2: [{ id: 'a2', studentUid: 'u1', name: 'YAO Marc', average20: 15, notesCount: 2 }],
      },
    },
    {
      id: 't3',
      number: 3,
      name: 'Trimestre 3',
      coefficient: 2,
      effectiveCoeff: 2,
      subjects: [{ id: 'm3', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: { m3: [] },
    },
  ];

  const res = computeAnnualGeneralAverageTable({ terms });
  assert.equal(res.students.length, 1);
  // (12*1 + 15*2) / (1 + 2) = 42 / 3 = 14.00 (et NON 42 / 5 = 8.40 !)
  assert.equal(res.students[0].totalAnnual, 42);
  assert.equal(res.students[0].totalCoeffCounted, 3);
  assert.equal(res.students[0].annualAverage, 14);
  assert.equal(res.students[0].gradedTermsCount, 2);
  assert.equal(res.students[0].totalTermsCount, 3);
});

test('Rapprochement inter-trimestres : inversion sûre, faute de frappe signalée sans fusion silencieuse et homonymes protégés', () => {
  const terms: AnnualTermData[] = [
    {
      id: 't1',
      number: 1,
      name: 'Trimestre 1',
      coefficient: null,
      effectiveCoeff: 1,
      subjects: [{ id: 'm1', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: {
        m1: [
          { id: '1', studentUid: '', name: 'KOUASSI Jean', average20: 14, notesCount: 1 },
          { id: '1b', studentUid: '', name: 'KOFFI Yao', average20: 13, notesCount: 1 },
          { id: '2', studentUid: 'uid-k1', name: 'KONÉ Moussa', average20: 16, notesCount: 1 },
          { id: '3', studentUid: 'uid-k2', name: 'KONÉ Moussa', average20: 10, notesCount: 1 },
        ],
      },
    },
    {
      id: 't2',
      number: 2,
      name: 'Trimestre 2',
      coefficient: null,
      effectiveCoeff: 1,
      subjects: [{ id: 'm2', name: 'Maths', coefficient: 1, effectiveCoeff: 1 }],
      subjectGradebooks: {
        m2: [
          // Inversion Nom/Prénom -> fusion sûre (Couche 2)
          { id: '4', studentUid: '', name: 'Jean Kouassi', average20: 16, notesCount: 1 },
          // Faute de frappe d'un trimestre à l'autre -> signalée dans potentialDuplicates (Couche 3) sans fusion silencieuse
          { id: '5', studentUid: '', name: 'KOFI Yao', average20: 15, notesCount: 1 },
          // Homonymes reliés par studentUid (Couche 1) -> jamais mélangés !
          { id: '6', studentUid: 'uid-k1', name: 'KONÉ Moussa', average20: 18, notesCount: 1 },
          { id: '7', studentUid: 'uid-k2', name: 'KONÉ Moussa', average20: 12, notesCount: 1 },
        ],
      },
    },
  ];

  const res = computeAnnualGeneralAverageTable({ terms });
  const k1 = res.students.find((s) => s.studentUid === 'uid-k1');
  const k2 = res.students.find((s) => s.studentUid === 'uid-k2');
  assert.equal(k1?.annualAverage, 17);
  assert.equal(k2?.annualAverage, 11);

  const jean = res.students.find((s) => s.name === 'KOUASSI Jean');
  assert.equal(jean?.annualAverage, 15); // (14 + 16) / 2 grâce à l'inversion sûre !

  // La faute de frappe "KOFI Yao" vs "KOFFI Yao" est détectée sans fusion silencieuse
  assert.ok(
    res.potentialDuplicates.some(
      (d) =>
        (d.studentA.name === 'KOFFI Yao' && d.studentB.name === 'KOFI Yao') ||
        (d.studentA.name === 'KOFI Yao' && d.studentB.name === 'KOFFI Yao')
    ),
    'La faute de frappe inter-trimestres doit être signalée dans potentialDuplicates'
  );
  const koffi = res.students.find((s) => s.name === 'KOFFI Yao');
  const kofi = res.students.find((s) => s.name === 'KOFI Yao');
  assert.ok(koffi && kofi, 'Aucune fusion silencieuse sur une faute de frappe');
});

test('Moyenne générale annuelle ramenée sur un barème maximal personnalisé (/40 et /100) avec seuil d’admission adapté', () => {
  const res40 = computeAnnualGeneralAverageTable({
    averageScale: 40,
    terms: [
      {
        id: 't1',
        number: 1,
        name: 'Trimestre 1',
        coefficient: 1,
        effectiveCoeff: 1,
        subjects: [{ id: 'm1', name: 'Maths', coefficient: 2, effectiveCoeff: 2 }],
        subjectGradebooks: {
          m1: [
            { id: 'r1', studentUid: 'u1', name: 'AWA', average20: 14, notesCount: 2 },
            { id: 'r2', studentUid: 'u2', name: 'PAUL', average20: 9, notesCount: 2 },
          ],
        },
      },
      {
        id: 't2',
        number: 2,
        name: 'Trimestre 2',
        coefficient: 1,
        effectiveCoeff: 1,
        subjects: [{ id: 'm2', name: 'Maths', coefficient: 2, effectiveCoeff: 2 }],
        subjectGradebooks: {
          m2: [
            { id: 'r3', studentUid: 'u1', name: 'AWA', average20: 16, notesCount: 2 },
            { id: 'r4', studentUid: 'u2', name: 'PAUL', average20: 9, notesCount: 2 },
          ],
        },
      },
    ],
  });

  assert.equal(res40.averageScale, 40);
  const awa = res40.students.find((s) => s.studentUid === 'u1')!;
  const paul = res40.students.find((s) => s.studentUid === 'u2')!;
  // AWA : (14+16)/2 = 15/20 => 30/40 ; progression +4 pts sur /40 ; Bien ; Admis(e)
  assert.ok(Math.abs((awa.annualAverage ?? 0) - 30) < 1e-6);
  assert.ok(Math.abs((awa.progressionDelta ?? 0) - 4) < 1e-6);
  assert.equal(awa.mention, 'Bien');
  assert.equal(awa.decision, 'Admis(e)');
  // PAUL : 9/20 => 18/40 (< 20/40) => Ajourné(e)
  assert.ok(Math.abs((paul.annualAverage ?? 0) - 18) < 1e-6);
  assert.equal(paul.decision, 'Ajourné(e)');
  assert.equal(res40.classSummary.passCount, 1);
  assert.equal(res40.classSummary.passRatePercent, 50);
});
