import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AVERAGE_COLUMN_ORDER,
  DEFAULT_SUBJECT_COLUMN_ORDER,
  detectMatchingPresetId,
  getDefaultColumnOrder,
  getPresetColumnOrder,
  getVisibleColumnOrder,
  isDefaultColumnOrder,
  moveColumnToSide,
  moveColumnWithinSide,
  placeColumnRelative,
  resolveColumnOrderFromDelmasAction,
  resolveEffectiveColumnOrder,
  sanitizeGradebookColumnOrder,
} from './gradebookColumnLayout';

test('sanitizeGradebookColumnOrder garantit zéro doublon, zéro colonne perdue et compatibilité Matière <-> Moyennes Générales', () => {
  // Retrait des doublons, clés inconnues, et réinsertion des colonnes manquantes
  const cleaned = sanitizeGradebookColumnOrder(
    {
      left: ['name', 'name', 'unknown_col', 'rank'],
      right: ['rank', 'mention'],
    },
    { includeTotal: false }
  );
  assert.ok(cleaned);
  assert.deepEqual(cleaned.left, ['name', 'rank', 'photo', 'matricule']);
  assert.deepEqual(cleaned.right, ['mention', 'average']);

  // Ordre sauvegardé depuis une Matière (sans `total`) réutilisé sur une Moyenne Générale (`includeTotal: true`) :
  // `total` est inséré intelligemment juste devant `average` !
  const expandedForAverage = sanitizeGradebookColumnOrder(
    {
      left: ['matricule', 'photo', 'name'],
      right: ['average', 'rank', 'mention'],
    },
    { includeTotal: true }
  );
  assert.ok(expandedForAverage);
  assert.deepEqual(expandedForAverage.left, ['matricule', 'photo', 'name']);
  assert.deepEqual(expandedForAverage.right, ['total', 'average', 'rank', 'mention']);

  // Et si `average` est à gauche, `total` se place devant `average` à gauche
  const avgLeft = sanitizeGradebookColumnOrder(
    {
      left: ['rank', 'name', 'average', 'mention'],
      right: ['photo', 'matricule'],
    },
    { includeTotal: true }
  );
  assert.ok(avgLeft);
  assert.deepEqual(avgLeft.left, ['rank', 'name', 'total', 'average', 'mention']);
  assert.deepEqual(avgLeft.right, ['photo', 'matricule']);

  // Entrées invalides -> null
  assert.equal(sanitizeGradebookColumnOrder(null), null);
  assert.equal(sanitizeGradebookColumnOrder({}), null);
  assert.equal(sanitizeGradebookColumnOrder({ left: ['foo'], right: [] }), null);
});

test('resolveEffectiveColumnOrder respecte la priorité feuille > classe > défaut (avec null = reset feuille)', () => {
  const classOrder = getPresetColumnOrder('official', { includeTotal: false });
  const sheetOrder = getPresetColumnOrder('admin', { includeTotal: false });

  // Surcharge feuille prioritaire sur classe
  assert.deepEqual(
    resolveEffectiveColumnOrder(sheetOrder, classOrder, { includeTotal: false }),
    sheetOrder
  );

  // Pas de surcharge feuille (undefined) -> hérite de la classe
  assert.deepEqual(
    resolveEffectiveColumnOrder(undefined, classOrder, { includeTotal: false }),
    classOrder
  );

  // Surcharge feuille explicitement null -> réinitialisation au défaut
  assert.deepEqual(
    resolveEffectiveColumnOrder(null, classOrder, { includeTotal: false }),
    DEFAULT_SUBJECT_COLUMN_ORDER
  );

  // Aucune surcharge -> défaut
  assert.deepEqual(
    resolveEffectiveColumnOrder(undefined, null, { includeTotal: true }),
    DEFAULT_AVERAGE_COLUMN_ORDER
  );
});

test('moveColumnToSide, moveColumnWithinSide et placeColumnRelative couvrent toutes les combinaisons logiques', () => {
  const base = getDefaultColumnOrder({ includeTotal: false });
  assert.equal(isDefaultColumnOrder(base, { includeTotal: false }), true);
  assert.equal(detectMatchingPresetId(base, { includeTotal: false }), 'classic');

  // Passer Rang derrière les notes puis derrière Moyenne -> correspond au preset 'official' après déplacement de Matricule
  const rankRight = moveColumnToSide(base, 'rank', 'right', { includeTotal: false });
  assert.deepEqual(rankRight.left, ['photo', 'matricule', 'name']);
  assert.deepEqual(rankRight.right, ['rank', 'average', 'mention']);

  const rankAfterAvg = moveColumnWithinSide(rankRight, 'rank', 'down', { includeTotal: false });
  assert.deepEqual(rankAfterAvg.right, ['average', 'rank', 'mention']);

  // placeColumnRelative : "Mets le Rang derrière la Moyenne"
  const rel1 = placeColumnRelative(base, 'rank', 'after', 'average', { includeTotal: false });
  assert.deepEqual(rel1.left, ['photo', 'matricule', 'name']);
  assert.deepEqual(rel1.right, ['average', 'rank', 'mention']);

  // placeColumnRelative : "Mets le Matricule en tout début"
  const rel2 = placeColumnRelative(rel1, 'matricule', 'start', undefined, { includeTotal: false });
  assert.deepEqual(rel2.left, ['matricule', 'photo', 'name']);
  assert.equal(detectMatchingPresetId(rel2, { includeTotal: false }), 'official');

  // placeColumnRelative : "Mets la Mention devant les notes"
  const rel3 = placeColumnRelative(base, 'mention', 'before', 'notes', { includeTotal: false });
  assert.deepEqual(rel3.left, ['rank', 'photo', 'matricule', 'name', 'mention']);
  assert.deepEqual(rel3.right, ['average']);

  // getVisibleColumnOrder masque matricule si showMatricule === false tout en conservant l'ordre exact
  const vis = getVisibleColumnOrder(rel2, { showMatricule: false, includeTotal: false });
  assert.deepEqual(vis.left, ['photo', 'name']);
  assert.deepEqual(vis.right, ['average', 'rank', 'mention']);
});

test('resolveColumnOrderFromDelmasAction interprète presets, déplacements relatifs, alias français et reset', () => {
  const baseSubj = getDefaultColumnOrder({ includeTotal: false });
  const baseAvg = getDefaultColumnOrder({ includeTotal: true });

  // 1. Preset "officiel"
  const official = resolveColumnOrderFromDelmasAction(
    { type: 'set_column_order', preset: 'officiel', scope: 'class' },
    baseAvg,
    { includeTotal: true }
  );
  assert.deepEqual(official, getPresetColumnOrder('official', { includeTotal: true }));

  // 2. Déplacement relatif : "Mets le Rang derrière la Moyenne"
  const afterAvg = resolveColumnOrderFromDelmasAction(
    { type: 'set_column_order', moveColumn: 'rang', relation: 'derriere', anchor: 'moyenne' },
    baseSubj,
    { includeTotal: false }
  );
  assert.deepEqual(afterAvg, {
    left: ['photo', 'matricule', 'name'],
    right: ['average', 'rank', 'mention'],
  });

  // 3. Liste explicite avec alias français
  const explicit = resolveColumnOrderFromDelmasAction(
    {
      type: 'set_column_order',
      left: ['Matricule', 'Nom & Prénom', 'Profil'],
      right: ['Moyenne', 'Mention', 'Rang'],
    },
    baseSubj,
    { includeTotal: false }
  );
  assert.deepEqual(explicit, {
    left: ['matricule', 'name', 'photo'],
    right: ['average', 'mention', 'rank'],
  });

  // 4. Reset -> null
  assert.equal(
    resolveColumnOrderFromDelmasAction({ type: 'set_column_order', reset: true }, baseSubj, {
      includeTotal: false,
    }),
    null
  );
});
