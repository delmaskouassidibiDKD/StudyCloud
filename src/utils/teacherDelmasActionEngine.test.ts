import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeacherDelmasSystemPrompt,
  parseTeacherDelmasAiResponse,
} from './teacherDelmasActionEngine';
import { DEFAULT_CUSTOM_MENTION_RULES } from './gradebookCalculations';

test('buildTeacherDelmasSystemPrompt inclut la classe active, la matière ouverte, la langue forcée et la règle de ciblage exclusif', () => {
  const prompt = buildTeacherDelmasSystemPrompt({
    languageCode: 'en',
    activeContext: {
      sheetKind: 'subject',
      yearId: 'y-1',
      yearLabel: '2026 - 2027',
      schoolId: 'sch-1',
      schoolName: 'GROUPE 2 ELECTROTECHNIQUE',
      classId: 'cls-1',
      className: 'BTS 2 • GROUPE 2 ELECTROTECHNIQUE',
      levelName: 'BTS 2',
      termId: 't-1',
      termName: 'Trimestre 1',
      subjectId: 'subj-math',
      subjectName: 'Mathématiques',
      subjectCoefficient: 2,
      sortMode: 'order',
      showMatricule: false,
      averageScale: 20,
      mentionRules: DEFAULT_CUSTOM_MENTION_RULES,
      zoomPercent: 70,
      noteColumns: [
        { index: 0, colNumber: 1, title: 'NOTE', label: 'NOTE 1', maxScore: 20, coeffEval: 1 },
      ],
      students: [
        {
          rowIndex: 1,
          id: 'std-1',
          name: 'DKD',
          matricule: '24-001',
          notes: ['14/20'],
          averageFormatted: '14,00',
          averageNumber: 14,
          rank: '1er',
          mention: 'Bien',
        },
      ],
    },
  });

  assert.ok(prompt.includes('RESPOND EXCLUSIVELY AND 100% IN CLEAR, NATURAL, PROFESSIONAL ENGLISH'));
  assert.ok(prompt.includes('BTS 2 • GROUPE 2 ELECTROTECHNIQUE'));
  assert.ok(prompt.includes('Mathématiques'));
  assert.ok(prompt.includes('Trimestre 1'));
  assert.ok(prompt.includes('DKD'));
  assert.ok(prompt.includes('CIBLE EXCLUSIVE = LE TABLEAU OUVERT'));
  assert.ok(prompt.includes('AUCUNE MODIFICATION NON DEMANDÉE'));
});

test('parseTeacherDelmasAiResponse extrait chat_response et actions sans jamais exposer le JSON brut', () => {
  const raw = `\`\`\`json
{
  "chat_response": "J'ai ajouté les 2 élèves dans Mathématiques et trié par ordre de mérite.",
  "actions": [
    { "type": "add_students", "students": [{ "name": "Kouassi", "notes": ["16", "15"] }] },
    { "type": "set_sort_mode", "sortMode": "merit" }
  ]
}
\`\`\``;

  const parsed = parseTeacherDelmasAiResponse(raw);
  assert.equal(
    parsed.chatResponse,
    "J'ai ajouté les 2 élèves dans Mathématiques et trié par ordre de mérite."
  );
  assert.equal(parsed.actions.length, 2);
  assert.equal(parsed.actions[0].type, 'add_students');
  assert.equal(parsed.actions[1].type, 'set_sort_mode');
});
