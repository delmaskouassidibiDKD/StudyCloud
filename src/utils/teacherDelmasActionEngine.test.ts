import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEACHER_DELMAS_KIMI_MODEL,
  buildTeacherDelmasSystemPrompt,
  classifyTeacherDelmasIntent,
  filterSafeTeacherDelmasActions,
  hasRealExplicitMatriculeBatch,
  isLikelyFakeRowNumberMatricule,
  isLikelyFakeSequentialMatriculeBatch,
  parseTeacherDelmasAiResponse,
  pickPreferredKimiModel,
  stripTeacherDelmasReasoning,
  type TeacherDelmasActiveContext,
} from './teacherDelmasActionEngine';
import { DEFAULT_CUSTOM_MENTION_RULES } from './gradebookCalculations';

const sampleContext: TeacherDelmasActiveContext = {
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
    { index: 1, colNumber: 2, title: 'NOTE', label: 'NOTE 2', maxScore: 20, coeffEval: 1 },
  ],
  students: [
    {
      rowIndex: 1,
      id: 'std-1',
      name: 'DKD',
      matricule: '24-001',
      notes: ['14/20', ''],
      averageFormatted: '14,00',
      averageNumber: 14,
      rank: '1er',
      mention: 'Bien',
    },
  ],
};

test('pickPreferredKimiModel choisit automatiquement Kimi K2.7 Code actif en arrière-plan', () => {
  const res = pickPreferredKimiModel(
    [
      { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3', provider: 'cloudflare', is_active: 1 },
      { id: '@cf/moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: 'cloudflare', is_active: 1 },
      { id: 'gemini-2.0-flash', name: 'Gemini', provider: 'google', is_active: 1 },
    ],
    '@cf/moonshotai/kimi-k2.7-code'
  );
  assert.equal(res.modelId, '@cf/moonshotai/kimi-k2.7-code');
  assert.equal(res.apiToken, undefined);

  // Fallback garanti vers Kimi si la liste est vide ou ne contient que Llama
  const fallback = pickPreferredKimiModel(
    [{ id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3', provider: 'cloudflare', is_active: 1 }],
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  );
  assert.equal(fallback.modelId, DEFAULT_TEACHER_DELMAS_KIMI_MODEL);
});

test('classifyTeacherDelmasIntent distingue discussion simple (chat), lecture/analyse (inspect) et demande d’action (action)', () => {
  // 1. Salutations, politesses, discussions générales -> 'chat' (ZÉRO action, ZÉRO fuite de fichiers)
  for (const msg of [
    'Bonjour',
    'Salut ça va ?',
    'Merci beaucoup !',
    'Qui es-tu ?',
    'Explique-moi le théorème de Pythagore',
    'Rédige un court message bienveillant pour les parents',
    'Comment calculer une moyenne pondérée ?',
  ]) {
    const intent = classifyTeacherDelmasIntent({
      message: msg,
      hasNewAttachments: false,
      hasConversationFiles: true,
      activeContext: sampleContext,
    });
    assert.equal(intent.intent, 'chat', `Attendu 'chat' pour: "${msg}" (obtenu ${intent.intent} / ${intent.reason})`);
    assert.equal(intent.referencesActiveFiles, false, `Ne doit pas renvoyer les anciens fichiers pour: "${msg}"`);
  }

  // 2. Questions de lecture/analyse ou de conseil sur le tableau -> 'inspect' (ZÉRO modification)
  for (const msg of [
    'Dans quelle classe je suis ?',
    'Qui est le premier de la classe ?',
    'Quelle est la moyenne de DKD ?',
    "Combien d'élèves ont plus de 10/20 ?",
    'Affiche-moi les notes de DKD',
    'Peux-tu me donner la liste des élèves sous la moyenne ?',
    'Devrais-je passer la moyenne de ce tableau sur 40 ?',
    'Comment trier ce tableau par ordre de mérite ?',
    'Bonjour, quelle est la moyenne de DKD ?',
    'DES ACTION QUE TU PEUX MENER DANS LE TABLEAUX',
    'Quelles actions peux-tu faire dans le tableau ?',
    'Est-ce que tu peux modifier le tableau ?',
  ]) {
    const intent = classifyTeacherDelmasIntent({
      message: msg,
      hasNewAttachments: false,
      hasConversationFiles: false,
      activeContext: sampleContext,
    });
    assert.equal(intent.intent, 'inspect', `Attendu 'inspect' pour: "${msg}" (obtenu ${intent.intent} / ${intent.reason})`);
  }

  // 3. Demandes explicites d’action sur le tableau ou l’interface -> 'action'
  for (const msg of [
    'Mets 16 en note 2 à DKD',
    'Peux-tu trier le tableau par ordre de mérite ?',
    'Ajoute +1 point à tout le monde',
    'Affiche la colonne matricule',
    'Passe la moyenne sur 40',
    'Mets toutes les notes sur 40',
    'Mets en rouge les élèves qui ont moins de 10',
    'Supprime les lignes vides',
    'Exporte en Excel',
    'Zoom à 85%',
    'DKD 15 17',
    'Ajoute KOUASSI Jean avec 15 et 14',
  ]) {
    const intent = classifyTeacherDelmasIntent({
      message: msg,
      hasNewAttachments: false,
      hasConversationFiles: false,
      activeContext: sampleContext,
    });
    assert.equal(intent.intent, 'action', `Attendu 'action' pour: "${msg}" (obtenu ${intent.intent} / ${intent.reason})`);
  }
});

test('classifyTeacherDelmasIntent gère proprement les fichiers joints (lecture seule vs import) et les confirmations', () => {
  // Image envoyée sans consigne d’écriture -> 'inspect' (ne modifie pas le tableau sans accord)
  const imgOnly = classifyTeacherDelmasIntent({
    message: '',
    hasNewAttachments: true,
    hasConversationFiles: true,
    activeContext: sampleContext,
  });
  assert.equal(imgOnly.intent, 'inspect');
  assert.equal(imgOnly.referencesActiveFiles, true);

  // Image + question de lecture -> 'inspect'
  const imgRead = classifyTeacherDelmasIntent({
    message: 'Que vois-tu sur cette photo ?',
    hasNewAttachments: true,
    hasConversationFiles: true,
    activeContext: sampleContext,
  });
  assert.equal(imgRead.intent, 'inspect');

  // Image + demande de remplissage -> 'action'
  const imgImport = classifyTeacherDelmasIntent({
    message: 'Ajoute ces élèves et leurs notes dans le tableau',
    hasNewAttachments: true,
    hasConversationFiles: true,
    activeContext: sampleContext,
  });
  assert.equal(imgImport.intent, 'action');
  assert.equal(imgImport.referencesActiveFiles, true);

  // Image + demande "IL FAUT LES ENREGISTRER" -> 'action'
  const imgSave = classifyTeacherDelmasIntent({
    message: 'IL FAUT LES ENREGISTRER',
    hasNewAttachments: true,
    hasConversationFiles: true,
    activeContext: sampleContext,
  });
  assert.equal(imgSave.intent, 'action');
  assert.equal(imgSave.referencesActiveFiles, true);

  // Suivi avec faute/élision "TU VOIS PAS LIMAGE ?" ou "Tu la vois ?" sur un fichier déjà dans la conversation -> 'inspect' + referencesActiveFiles
  for (const followMsg of ['TU VOIS PAS LIMAGE ?', 'Tu la vois ?', 'Tu as vu mon image ?']) {
    const res = classifyTeacherDelmasIntent({
      message: followMsg,
      hasNewAttachments: false,
      hasConversationFiles: true,
      activeContext: sampleContext,
    });
    assert.equal(res.intent, 'inspect', `Attendu 'inspect' pour "${followMsg}"`);
    assert.equal(res.referencesActiveFiles, true, `Attendu referencesActiveFiles=true pour "${followMsg}"`);
  }

  // Tous les fichiers non supprimés du dossier restent en mémoire permanente dans le prompt
  const convFiles = [
    {
      id: 'tdfile-1',
      conversationId: 'tdconv-1',
      fileName: 'notes_whatsapp.jpeg',
      mimeType: 'image/jpeg',
      fileType: 'image',
      sizeBytes: 120000,
      compressedSizeBytes: 80000,
      extractedText: 'TYPE_CONTENU: LISTE_ELEVES_ET_NOTES\nLigne 1 | Nom: KOUASSI | Notes: 15, 16',
      createdAt: Date.now(),
    },
  ];
  const promptWithMem = buildTeacherDelmasSystemPrompt({
    languageCode: 'fr',
    activeContext: sampleContext,
    conversationFiles: convFiles,
    intent: 'inspect',
    referencesActiveFiles: false,
  });
  assert.ok(promptWithMem.includes('notes_whatsapp.jpeg'));
  assert.ok(promptWithMem.includes('KOUASSI'));

  const chatPromptWithMem = buildTeacherDelmasSystemPrompt({
    languageCode: 'fr',
    activeContext: sampleContext,
    conversationFiles: convFiles,
    intent: 'chat',
  });
  assert.ok(chatPromptWithMem.includes('notes_whatsapp.jpeg'));
  assert.ok(chatPromptWithMem.includes('KOUASSI'));

  // Confirmation après proposition d’action sur le tableau -> 'action'
  const confirmAction = classifyTeacherDelmasIntent({
    message: 'Oui vas-y',
    hasNewAttachments: false,
    hasConversationFiles: true,
    activeContext: sampleContext,
    recentMessages: [
      { sender: 'user', content: 'Lis cette photo' },
      { sender: 'ai', content: "J'ai lu 5 élèves. Souhaitez-vous que je les ajoute dans votre tableau ?" },
    ],
  });
  assert.equal(confirmAction.intent, 'action');

  // Simple "ok" après discussion générale -> 'chat'
  const casualOk = classifyTeacherDelmasIntent({
    message: 'Ok',
    hasNewAttachments: false,
    hasConversationFiles: false,
    activeContext: sampleContext,
    recentMessages: [
      { sender: 'user', content: 'Explique-moi le théorème de Thalès' },
      { sender: 'ai', content: 'Le théorème de Thalès relie les longueurs dans un triangle...' },
    ],
  });
  assert.equal(casualOk.intent, 'chat');
});

test('buildTeacherDelmasSystemPrompt en mode chat ne divulgue ni les lignes du tableau ni le catalogue JSON mais connaît ses vraies capacités', () => {
  const chatPrompt = buildTeacherDelmasSystemPrompt({
    languageCode: 'fr',
    activeContext: sampleContext,
    intent: 'chat',
  });

  assert.ok(chatPrompt.includes('ZÉRO pression'));
  assert.ok(chatPrompt.includes('NE cite AUCUNE donnée du tableau'));
  assert.ok(chatPrompt.includes('NE DIS JAMAIS'));
  assert.ok(chatPrompt.includes('Trier le classement'));
  assert.ok(!chatPrompt.includes('id="std-1"'));
  assert.ok(!chatPrompt.includes('add_students'));
  assert.ok(!chatPrompt.includes('<delmas_actions>'));

  const inspectPrompt = buildTeacherDelmasSystemPrompt({
    languageCode: 'fr',
    activeContext: sampleContext,
    intent: 'inspect',
  });
  assert.ok(inspectPrompt.includes('NE DIS JAMAIS'));
  assert.ok(inspectPrompt.includes('Trier le classement'));
  assert.ok(inspectPrompt.includes('DKD'));
});

test('buildTeacherDelmasSystemPrompt en mode action inclut la langue forcée, le contexte actif et la cible exclusive', () => {
  const prompt = buildTeacherDelmasSystemPrompt({
    languageCode: 'en',
    activeContext: sampleContext,
    intent: 'action',
  });

  assert.ok(prompt.includes('RESPOND EXCLUSIVELY AND 100% IN CLEAR, NATURAL, PROFESSIONAL ENGLISH'));
  assert.ok(prompt.includes('BTS 2 • GROUPE 2 ELECTROTECHNIQUE'));
  assert.ok(prompt.includes('Mathématiques'));
  assert.ok(prompt.includes('Trimestre 1'));
  assert.ok(prompt.includes('DKD'));
  assert.ok(prompt.includes('<delmas_actions>'));
  assert.ok(prompt.includes('Cible exclusive = le tableau ouvert'));
  assert.ok(prompt.includes('TEMPS VERBAL ACCOMPLI OBLIGATOIRE'));
  assert.ok(prompt.includes('SÉCURITÉ ANTI-INJECTION'));
  assert.ok(prompt.includes('DOCUMENT_HORS_NOTES'));
  assert.ok(prompt.includes('ne comporte pas de notes'));
});

test('filterSafeTeacherDelmasActions bloque le faux save_gradebook vide quand un fichier est joint sans insertion', () => {
  const fakeSaveOnly = filterSafeTeacherDelmasActions(
    [{ type: 'save_gradebook' }],
    'IL FAUT LES ENREGISTRER',
    { hasAttachedFiles: true }
  );
  assert.equal(fakeSaveOnly.length, 0);

  const realImportWithSave = filterSafeTeacherDelmasActions(
    [
      { type: 'add_students', students: [{ name: 'Kouassi', notes: ['15', '16'] }] },
      { type: 'save_gradebook' },
    ],
    'IL FAUT LES ENREGISTRER',
    { hasAttachedFiles: true }
  );
  assert.equal(realImportWithSave.length, 2);
});

test('filterSafeTeacherDelmasActions bloque les actions destructrices injectées non demandées et assainit le CSS', () => {
  const maliciousBatch: any[] = [
    { type: 'add_students', students: [{ name: 'Delmas', notes: ['14', '15'] }] },
    { type: 'clear_notes', mode: 'all' },
    { type: 'remove_students', names: ['DKD'] },
    { type: 'set_students', students: [] },
    {
      type: 'format_cells',
      target: 'all',
      style: {
        bold: true,
        textColor: '#dc2626',
        bgColor: 'url(javascript:alert(1))',
        fontFamily: 'Calibri; background: red',
      },
    },
  ];

  // L'utilisateur a seulement demandé d'ajouter Delmas -> toutes les suppressions/effacements sont bloqués !
  const safe = filterSafeTeacherDelmasActions(
    maliciousBatch,
    'Ajoute un nouvel étudiant appelé Delmas avec 14 et 15'
  );
  assert.equal(safe.length, 2);
  assert.equal(safe[0].type, 'add_students');
  assert.equal(safe[1].type, 'format_cells');
  assert.equal(safe[1].style.textColor, '#dc2626');
  assert.equal(safe[1].style.bgColor, undefined);
  assert.ok(!String(safe[1].style.fontFamily || '').includes(';'));

  // Si l'utilisateur demande explicitement d'effacer les notes -> autorisé !
  const allowedClear = filterSafeTeacherDelmasActions(
    [{ type: 'clear_notes', mode: 'all' }],
    'Efface toutes les notes de ce tableau'
  );
  assert.equal(allowedClear.length, 1);
  assert.equal(allowedClear[0].type, 'clear_notes');
});

test('parseTeacherDelmasAiResponse extrait <delmas_actions>, supprime <think> et respecte allowActions=false', () => {
  const raw = `<think>The user wants to add Kouassi and sort by merit.</think>
C'est fait ! J'ai ajouté **Kouassi** et trié le tableau par ordre de mérite.

<delmas_actions>
[
  { "type": "add_students", "students": [{ "name": "Kouassi", "notes": ["16", "15"] }] },
  { "type": "set_sort_mode", "sortMode": "merit" },
  { "type": "unknown_hallucinated_action", "foo": "bar" }
]
</delmas_actions>`;

  const parsed = parseTeacherDelmasAiResponse(raw, { allowActions: true });
  assert.equal(
    parsed.chatResponse,
    "C'est fait ! J'ai ajouté **Kouassi** et trié le tableau par ordre de mérite."
  );
  assert.ok(!parsed.chatResponse.includes('<think>'));
  assert.ok(!parsed.chatResponse.includes('<delmas_actions>'));
  assert.equal(parsed.actions.length, 2);
  assert.equal(parsed.actions[0].type, 'add_students');
  assert.equal(parsed.actions[1].type, 'set_sort_mode');

  // Garde-fou strict : en mode chat/inspect (allowActions: false), AUCUNE action ne passe
  const blocked = parseTeacherDelmasAiResponse(raw, { allowActions: false });
  assert.equal(blocked.actions.length, 0);
  assert.equal(
    blocked.chatResponse,
    "C'est fait ! J'ai ajouté **Kouassi** et trié le tableau par ordre de mérite."
  );
});

test('parseTeacherDelmasAiResponse supporte encore un fallback JSON propre sans jamais exposer le JSON brut', () => {
  const raw = `\`\`\`json
{
  "chat_response": "J'ai mis 16 en Note 2 à DKD.",
  "actions": [
    { "type": "update_students", "updates": [{ "matchName": "DKD", "notes": { "2": "16" } }] }
  ]
}
\`\`\``;

  const parsed = parseTeacherDelmasAiResponse(raw, { allowActions: true });
  assert.equal(parsed.chatResponse, "J'ai mis 16 en Note 2 à DKD.");
  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].type, 'update_students');

  assert.equal(
    stripTeacherDelmasReasoning('<think>internal</think>Bonjour !'),
    'Bonjour !'
  );
});

test('Détection des faux matricules séquentiels (1..10) vs vrais matricules scolaires explicites', () => {
  assert.equal(isLikelyFakeRowNumberMatricule('1'), true);
  assert.equal(isLikelyFakeRowNumberMatricule('10'), true);
  assert.equal(isLikelyFakeRowNumberMatricule('01'), true);
  assert.equal(isLikelyFakeRowNumberMatricule('#3'), true);
  assert.equal(isLikelyFakeRowNumberMatricule('1er'), true);
  assert.equal(isLikelyFakeRowNumberMatricule('-'), true);
  assert.equal(isLikelyFakeRowNumberMatricule('24-BTS-001'), false);
  assert.equal(isLikelyFakeRowNumberMatricule('MAT-01'), false);
  assert.equal(isLikelyFakeRowNumberMatricule('184592A'), false);
  assert.equal(isLikelyFakeRowNumberMatricule('2025014'), false);

  assert.equal(
    isLikelyFakeSequentialMatriculeBatch(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']),
    true
  );
  assert.equal(isLikelyFakeSequentialMatriculeBatch(['0001', '0002', '0003']), true);
  assert.equal(hasRealExplicitMatriculeBatch(['1', '2', '3', '4', '5']), false);
  assert.equal(hasRealExplicitMatriculeBatch(['24-BTS-001', '24-BTS-002']), true);
  assert.equal(hasRealExplicitMatriculeBatch(['2025001', '2025002']), true);
});

test('filterSafeTeacherDelmasActions supprime les faux matricules 1..10 / inventés et bloque set_show_matricule non demandé', () => {
  // 1. Image contenant une colonne N° (1..3) sans vraie colonne Matricule -> tout est nettoyé et la colonne reste masquée
  const fakeFromImage = filterSafeTeacherDelmasActions(
    [
      {
        type: 'add_students',
        students: [
          { name: 'KOUASSI Aya Mariam', matricule: '1', notes: ['15', '14'] },
          { name: 'TRAORÉ Ibrahim', matricule: '2', notes: ['12', '13'] },
          { name: 'BÉDIÉ Jean-Marc', matricule: '3', notes: ['16', '15'] },
        ],
      },
      { type: 'set_show_matricule', show: true, scope: 'sheet' },
    ],
    'IL FAUT LES ENREGISTRER',
    {
      hasAttachedFiles: true,
      sourceFileTexts: [
        'TYPE_CONTENU: LISTE_ELEVES_ET_NOTES\nCOLONNE_MATRICULE_PRESENTE: NON\nLigne 1 | Nom: KOUASSI Aya Mariam | Notes: 15, 14',
      ],
    }
  );
  assert.equal(fakeFromImage.length, 1);
  assert.equal(fakeFromImage[0].type, 'add_students');
  assert.deepEqual(
    fakeFromImage[0].students.map((s: any) => s.matricule),
    ['', '', '']
  );

  // 2. Sans fichier joint, l'utilisateur demande uniquement des notes mais l'IA invente des matricules aléatoires
  const hallucinatedNoFile = filterSafeTeacherDelmasActions(
    [
      {
        type: 'add_students',
        students: [
          { name: 'Delmas', matricule: '24-001', notes: ['14', '15'] },
          { name: 'Koné', matricule: '83921', notes: ['12', '13'] },
        ],
      },
      { type: 'set_show_matricule', show: true },
    ],
    'Ajoute Delmas avec 14 et 15 et Koné avec 12 et 13'
  );
  assert.equal(hallucinatedNoFile.length, 1);
  assert.deepEqual(
    hallucinatedNoFile[0].students.map((s: any) => s.matricule),
    ['', '']
  );

  // 3. Sur update_students sans demande de matricule, la propriété matricule inventée est supprimée (préserve l'existant)
  const updateHallucinated = filterSafeTeacherDelmasActions(
    [
      {
        type: 'update_students',
        updates: [{ matchName: 'Delmas', matricule: '1', notes: { '1': '16' } }],
      },
      { type: 'set_show_matricule', show: true },
    ],
    'Mets 16 en Note 1 à Delmas'
  );
  assert.equal(updateHallucinated.length, 1);
  assert.equal('matricule' in updateHallucinated[0].updates[0], false);

  // 4. Image comportant de VRAIS matricules (COLONNE_MATRICULE_PRESENTE: OUI) -> conservés ET set_show_matricule autorisé !
  const realFromImage = filterSafeTeacherDelmasActions(
    [
      { type: 'set_show_matricule', show: true, scope: 'sheet' },
      {
        type: 'add_students',
        students: [
          { name: 'KOUASSI Aya Mariam', matricule: '24-BTS-001', notes: ['15', '14'] },
          { name: 'TRAORÉ Ibrahim', matricule: '24-BTS-002', notes: ['12', '13'] },
        ],
      },
    ],
    'Enregistre les élèves de cette image',
    {
      hasAttachedFiles: true,
      sourceFileTexts: [
        'TYPE_CONTENU: LISTE_ELEVES_ET_NOTES\nCOLONNE_MATRICULE_PRESENTE: OUI\nLigne 1 | Matricule: 24-BTS-001 | Nom: KOUASSI Aya Mariam | Notes: 15, 14\nLigne 2 | Matricule: 24-BTS-002 | Nom: TRAORÉ Ibrahim | Notes: 12, 13',
      ],
    }
  );
  assert.equal(realFromImage.length, 2);
  assert.equal(realFromImage[0].type, 'set_show_matricule');
  assert.deepEqual(
    realFromImage[1].students.map((s: any) => s.matricule),
    ['24-BTS-001', '24-BTS-002']
  );

  // 5. Demande explicite de l'utilisateur (ajout ou masquage/nettoyage de matricules) -> entièrement respectée !
  const explicitAddMat = filterSafeTeacherDelmasActions(
    [
      { type: 'add_students', students: [{ name: 'Delmas', matricule: '07', notes: ['15'] }] },
      { type: 'set_show_matricule', show: true },
    ],
    'Ajoute Delmas avec le matricule 07 et la note 15'
  );
  assert.equal(explicitAddMat.length, 2);
  assert.equal(explicitAddMat[0].students[0].matricule, '07');

  const explicitHideAndClear = filterSafeTeacherDelmasActions(
    [
      { type: 'set_show_matricule', show: false, scope: 'sheet' },
      { type: 'update_students', updates: [{ matchName: 'KOUASSI', matricule: '' }] },
    ],
    'Cache la colonne matricule et efface les faux matricules'
  );
  assert.equal(explicitHideAndClear.length, 2);
  assert.equal(explicitHideAndClear[0].show, false);
  assert.equal(explicitHideAndClear[1].updates[0].matricule, '');
});
