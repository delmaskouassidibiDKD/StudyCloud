import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateClassRanks,
  calculateGeneralAverage,
  calculateStudentGeneralAverage,
  calculateSubjectAverage,
  formatAverageDisplay,
  getMention,
  harmonizeScoreOn20,
  parseEvaluationValue,
  sortGradebookRows
} from './gradebookCalculations.js';

test('parseEvaluationValue distingue strictement vide/null et 0 explicite', () => {
  assert.equal(parseEvaluationValue(null), null);
  assert.equal(parseEvaluationValue(undefined), null);
  assert.equal(parseEvaluationValue(''), null);
  assert.equal(parseEvaluationValue('   '), null);
  assert.equal(parseEvaluationValue(-2), null);
  assert.equal(parseEvaluationValue(0), 0);
  assert.equal(parseEvaluationValue('0'), 0);
  assert.equal(parseEvaluationValue('14,5'), 14.5);
});

test('notes sur /20 et /40 mélangées avec coefficients d’évaluation', () => {
  // 15/20 -> 15/20 (coef 1)
  // 30/40 -> (30/40)*20 = 15/20 (coef 2)
  // 24/30 -> (24/30)*20 = 16/20 (coef 1)
  // Moyenne pondérée = (15*1 + 15*2 + 16*1) / (1 + 2 + 1) = 61 / 4 = 15.25
  const res = calculateSubjectAverage([
    { valeur: 15, max: 20, coeffEval: 1 },
    { valeur: 30, max: 40, coeffEval: 2 },
    { valeur: 24, max: 30 } // coeffEval par défaut = 1
  ]);

  assert.equal(res.evaluationsValides, 3);
  assert.equal(res.sommeCoeffs, 4);
  assert.equal(res.moyenneMatiere, 15.25);
  assert.equal(formatAverageDisplay(res.moyenneMatiere, true), '15.25 / 20');
});

test('notes vides ignorées sans être transformées en 0', () => {
  const res = calculateSubjectAverage([
    { valeur: 16, max: 20 },
    { valeur: null, max: 20 },
    { valeur: undefined, max: 40 },
    { valeur: '', max: 20 },
    { valeur: '   ', max: 20 },
    { valeur: 24, max: 40 } // 12/20
  ]);

  // Seules 16/20 et 12/20 comptent -> moyenne = 14
  assert.equal(res.evaluationsValides, 2);
  assert.equal(res.moyenneMatiere, 14);
});

test('note explicitement égale à 0 est bien prise en compte', () => {
  const res = calculateSubjectAverage([
    { valeur: 16, max: 20 },
    { valeur: 0, max: 20 },
    { valeur: '0', max: 40 }
  ]);

  // (16 + 0 + 0) / 3 = 5.3333333...
  assert.equal(res.evaluationsValides, 3);
  assert.ok(res.moyenneMatiere !== null);
  assert.ok(Math.abs(res.moyenneMatiere! - 16 / 3) < 1e-12);
  assert.equal(formatAverageDisplay(res.moyenneMatiere), '5.33');
});

test('division par zéro (max = 0 ou max < 0) protégée sans NaN ni Infinity', () => {
  assert.equal(harmonizeScoreOn20(10, 0), null);
  assert.equal(harmonizeScoreOn20(10, -20), null);

  // Une évaluation valide (14/20) + une avec max=0 -> max=0 est ignorée
  const mixed = calculateSubjectAverage([
    { valeur: 10, max: 0 },
    { valeur: 14, max: 20 }
  ]);
  assert.equal(mixed.hasInvalidScale, true);
  assert.equal(mixed.evaluationsValides, 1);
  assert.equal(mixed.moyenneMatiere, 14);

  // Uniquement max=0 -> moyenne null
  const onlyZeroMax = calculateSubjectAverage([{ valeur: 10, max: 0 }]);
  assert.equal(onlyZeroMax.hasInvalidScale, true);
  assert.equal(onlyZeroMax.moyenneMatiere, null);
  assert.equal(formatAverageDisplay(onlyZeroMax.moyenneMatiere), '—');
});

test('aucune note saisie ou somme des coefficients = 0 donne moyenne null', () => {
  const empty = calculateSubjectAverage([
    { valeur: null, max: 20 },
    { valeur: '', max: 20 }
  ]);
  assert.equal(empty.moyenneMatiere, null);
  assert.equal(formatAverageDisplay(empty.moyenneMatiere), '—');

  const zeroCoeff = calculateSubjectAverage([
    { valeur: 15, max: 20, coeffEval: 0 }
  ]);
  assert.equal(zeroCoeff.moyenneMatiere, null);
});

test('moyenne générale pondérée par coeffMatiere ignorant les matières non notées', () => {
  // Maths : 15/20 coef 4 -> 60 pts
  // Physique : 12/20 coef 3 -> 36 pts
  // Français : null (non notée) coef 5 -> ignorée !
  // Moyenne générale = (60 + 36) / (4 + 3) = 96 / 7 = 13.7142857...
  const gen = calculateGeneralAverage([
    { moyenneMatiere: 15, coeffMatiere: 4 },
    { moyenneMatiere: 12, coeffMatiere: 3 },
    { moyenneMatiere: null, coeffMatiere: 5 }
  ]);

  assert.equal(gen.matieresComptees, 2);
  assert.equal(gen.sommeCoeffsMatiere, 7);
  assert.equal(gen.pointsTotaux, 96);
  assert.ok(gen.moyenneGenerale !== null);
  assert.ok(Math.abs(gen.moyenneGenerale! - 96 / 7) < 1e-12);
  assert.equal(formatAverageDisplay(gen.moyenneGenerale), '13.71');

  // Aucune matière notée -> null
  const none = calculateGeneralAverage([
    { moyenneMatiere: null, coeffMatiere: 4 },
    { moyenneMatiere: null, coeffMatiere: 2 }
  ]);
  assert.equal(none.moyenneGenerale, null);
});

test('moyenne générale conserve la pleine précision flottante des calculs intermédiaires', () => {
  // Matière 1 (coef 3) : 10/30 -> 20/3 = 6.666666... sur 20 => points = 20
  // Matière 2 (coef 3) : 20/30 -> 40/3 = 13.333333... sur 20 => points = 40
  // Sans arrondi intermédiaire : (20 + 40) / 6 = 10.00 exactement !
  const gen = calculateStudentGeneralAverage([
    { coeffMatiere: 3, evaluations: [{ valeur: 10, max: 30 }] },
    { coeffMatiere: 3, evaluations: [{ valeur: 20, max: 30 }] },
    { coeffMatiere: 4, evaluations: [{ valeur: null, max: 20 }] }
  ]);

  assert.equal(gen.matieresComptees, 2);
  assert.ok(gen.moyenneGenerale !== null);
  assert.ok(Math.abs(gen.moyenneGenerale! - 10) < 1e-12);
});

test('mentions pédagogiques selon les seuils exacts et seuils personnalisés', () => {
  assert.equal(getMention(null), '—');
  assert.equal(getMention(0), 'Insuffisant');
  assert.equal(getMention(9.99), 'Insuffisant');
  assert.equal(getMention(10), 'Passable');
  assert.equal(getMention(11.99), 'Passable');
  assert.equal(getMention(12), 'Assez bien');
  assert.equal(getMention(13.99), 'Assez bien');
  assert.equal(getMention(14), 'Bien');
  assert.equal(getMention(15.99), 'Bien');
  assert.equal(getMention(16), 'Très bien');
  assert.equal(getMention(20), 'Très bien');

  // Seuils personnalisés par établissement
  const custom = [
    { minInclusive: 18, label: 'Excellent' },
    { minInclusive: 10, label: 'Admis' },
    { minInclusive: -Infinity, label: 'Ajourné' }
  ];
  assert.equal(getMention(18.5, custom), 'Excellent');
  assert.equal(getMention(14, custom), 'Admis');
  assert.equal(getMention(8, custom), 'Ajourné');
});

test('rangs de classe avec tri décroissant, ex æquo (tolérance flottante 1e-6) et élèves sans moyenne', () => {
  const ranks = calculateClassRanks([
    { id: 'e1', moyenne: 14.5 },
    { id: 'e2', moyenne: 16.0 },
    { id: 'e3', moyenne: 16.0 + 1e-9 }, // ex æquo avec e2 (tolérance flottante)
    { id: 'e4', moyenne: null },        // sans moyenne
    { id: 'e5', moyenne: 14.5 },        // ex æquo avec e1
    { id: 'e6', moyenne: 9.25 }
  ]);

  // e2 et e3 sont 1er ex
  assert.deepEqual(ranks.get('e2'), { id: 'e2', rankNumber: 1, rankLabel: '1er ex', isExAequo: true });
  assert.deepEqual(ranks.get('e3'), { id: 'e3', rankNumber: 1, rankLabel: '1er ex', isExAequo: true });

  // e1 et e5 sont 3e ex (car 2 élèves devant eux)
  assert.deepEqual(ranks.get('e1'), { id: 'e1', rankNumber: 3, rankLabel: '3e ex', isExAequo: true });
  assert.deepEqual(ranks.get('e5'), { id: 'e5', rankNumber: 3, rankLabel: '3e ex', isExAequo: true });

  // e6 est 5e (seul)
  assert.deepEqual(ranks.get('e6'), { id: 'e6', rankNumber: 5, rankLabel: '5e', isExAequo: false });

  // e4 sans moyenne => "—"
  assert.deepEqual(ranks.get('e4'), { id: 'e4', rankNumber: null, rankLabel: '—', isExAequo: false });
});

test('barèmes personnalisés variés (/5, /10, /12.5, /30, /40, /100) et détection note > max', () => {
  // 4/5 -> 16/20, 8/10 -> 16/20, 10/12.5 -> 16/20, 80/100 -> 16/20 => moyenne exacte 16.00
  const adapted = calculateSubjectAverage([
    { valeur: 4, max: 5 },
    { valeur: 8, max: 10 },
    { valeur: 10, max: 12.5 },
    { valeur: 80, max: 100 }
  ]);
  assert.equal(adapted.evaluationsValides, 4);
  assert.equal(adapted.hasExceedingScore, false);
  assert.ok(adapted.moyenneMatiere !== null && Math.abs(adapted.moyenneMatiere - 16) < 1e-12);
  assert.equal(getMention(adapted.moyenneMatiere), 'Très bien');

  // Note > max (ex: 12/10) détectée par hasExceedingScore
  const exceeding = calculateSubjectAverage(
    [{ valeur: 12, max: 10 }],
    { rejectExceedingMax: true }
  );
  assert.equal(exceeding.hasExceedingScore, true);
  assert.equal(exceeding.moyenneMatiere, null);
});

test('sortGradebookRows : Ordre de mérite, Ordre alphabétique, Ordre initial et verrouillage en cours de saisie', () => {
  const rows = [
    { id: 's1', name: 'ZOLA Émile', average: 11.5, notes: ['11.5/20'], originalIndex: 0 },
    { id: 's2', name: '', average: null, notes: [''], originalIndex: 1 },
    { id: 's3', name: 'BAKONGO Aya', average: 17.0, notes: ['17/20'], originalIndex: 2 },
    { id: 's4', name: 'ADAMA Koffi', average: null, notes: [''], originalIndex: 3 },
    { id: 's5', name: 'KOUASSI Jean', average: 14.5, notes: ['14.5/20'], originalIndex: 4 },
    { id: 's6', name: '', average: null, notes: [''], originalIndex: 5 },
  ];

  // Ordre de mérite : 1er (17) -> 2e (14.5) -> 3e (11.5) -> nommé sans moyenne (ADAMA) -> lignes vides en bas
  assert.deepEqual(
    sortGradebookRows(rows, 'merit').map((r) => r.id),
    ['s3', 's5', 's1', 's4', 's2', 's6']
  );

  // Ordre alphabétique (A -> Z), lignes vides toujours en bas
  assert.deepEqual(
    sortGradebookRows(rows, 'alpha').map((r) => r.id),
    ['s4', 's3', 's5', 's1', 's2', 's6']
  );

  // Ordre initial : ordre exact de saisie
  assert.deepEqual(
    sortGradebookRows(rows, 'order').map((r) => r.id),
    ['s1', 's2', 's3', 's4', 's5', 's6']
  );

  // Verrouillage pendant la saisie dans une case : conserve exactement l'ordre visuel courant
  assert.deepEqual(
    sortGradebookRows(rows, 'merit', ['s5', 's3', 's1', 's4', 's2', 's6']).map((r) => r.id),
    ['s5', 's3', 's1', 's4', 's2', 's6']
  );
});
