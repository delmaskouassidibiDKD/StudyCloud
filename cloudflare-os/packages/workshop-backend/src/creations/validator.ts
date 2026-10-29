/**
 * ============================================================================
 * STUDYCLOUD - VALIDATEUR & NORMALISATEUR DES 12 CRÉATIONS
 * ============================================================================
 * Vérifie, assainit et normalise chaque objet de création interactif
 * avant qu'il ne soit retourné au frontend pour garantir un affichage 100% fiable.
 * ============================================================================
 */

import { CreationResult, CreationType } from './types.js';

export function safeJsonParse(text: string): any {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();

  // Essai direct
  try {
    return JSON.parse(clean);
  } catch (_e1) {}

  // Extraction d'un bloc ```json ... ``` ou ``` ... ```
  const mdMatch = clean.match(/(?:```|""")(?:json)?\s*([\s\S]*?)\s*(?:```|""")/i);
  if (mdMatch && mdMatch[1]) {
    try {
      return JSON.parse(mdMatch[1].trim());
    } catch (_e2) {}
  }

  // Extraction entre la première accolade ouvrante et la dernière fermante
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = clean.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_e3) {}
  }

  // Réparation heuristique en cas de coupure (fermeture des accolades)
  let repaired = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
  let openBraces = (repaired.match(/\{/g) || []).length;
  let closeBraces = (repaired.match(/\}/g) || []).length;
  let openBrackets = (repaired.match(/\[/g) || []).length;
  let closeBrackets = (repaired.match(/\]/g) || []).length;

  while (openBrackets > closeBrackets) { repaired += ']'; closeBrackets++; }
  while (openBraces > closeBraces) { repaired += '}'; closeBraces++; }

  try {
    return JSON.parse(repaired);
  } catch (_e4) {
    return null;
  }
}

export function validateAndFormatCreation(
  answerText: string,
  requestedType?: string,
  docName?: string
): CreationResult {
  const defaultChat: CreationResult = {
    mode: 'chat',
    decision: 'chat',
    creation_type: null,
    creation_title: null,
    creation_data: null,
    chat_response: answerText,
  };

  const parsed = safeJsonParse(answerText);
  if (!parsed || typeof parsed !== 'object') {
    return defaultChat;
  }

  const payloadData =
    (parsed.creation_data && typeof parsed.creation_data === 'object')
      ? parsed.creation_data
      : (parsed.questions || parsed.affirmations || parsed.cards ||
         parsed.columns || parsed.piliers || parsed.root || parsed.branches ||
         parsed.noeud_central || parsed.noeuds || parsed.mermaid ||
         parsed.overview || parsed.formulas || parsed.key_definitions ||
         parsed.sections || parsed.exercises || parsed.exercices || parsed.parts)
      ? parsed
      : null;

  const isCreationIntent =
    parsed.decision === 'creation' ||
    parsed.mode === 'creation' ||
    Boolean(payloadData) ||
    Boolean(parsed.columns || parsed.branches || parsed.noeud_central);

  if (!isCreationIntent) {
    return defaultChat;
  }

  // Détection du type exact
  const reqTypeNorm = String(requestedType || '').toLowerCase().replace(/_/g, '-');
  const parsedTypeNorm = String(parsed.creation_type || parsed.type || '').toLowerCase().replace(/_/g, '-');

  let creationType: CreationType = 'questionnaire';

  if (reqTypeNorm.includes('vrai') || parsedTypeNorm.includes('vrai') || parsed.affirmations) {
    creationType = reqTypeNorm.includes('test') || parsedTypeNorm.includes('test') ? 'vrai-ou-faux-test' : 'vrai-ou-faux';
  } else if (
    reqTypeNorm.includes('carte-mentale-2') || parsedTypeNorm.includes('carte-mentale-2') ||
    parsed.columns || parsed.piliers || parsed.noeud_central || parsed.connecteurs ||
    payloadData?.columns || payloadData?.piliers || payloadData?.noeud_central
  ) {
    creationType = 'carte-mentale-2';
  } else if (
    reqTypeNorm.includes('carte-mentale') || parsedTypeNorm.includes('carte-mentale') || parsedTypeNorm.includes('mindmap') ||
    parsed.root || parsed.branches || parsed.mermaid || parsed.type === 'box' ||
    (parsed.children && parsed.label) || payloadData?.type === 'box' || (payloadData?.children && payloadData?.label)
  ) {
    creationType = 'carte-mentale';
  } else if (reqTypeNorm.includes('carte-memoire') || parsedTypeNorm.includes('carte-memoire') || reqTypeNorm.includes('flashcard') || parsed.cards) {
    creationType = 'carte-memoire';
  } else if (reqTypeNorm.includes('resume') || reqTypeNorm.includes('summary') || parsedTypeNorm.includes('resume') || parsedTypeNorm.includes('summary') || parsed.overview || parsed.formulas || parsed.key_definitions) {
    creationType = 'resume';
  } else if (reqTypeNorm.includes('pdf') || parsedTypeNorm.includes('pdf') || parsed.sections) {
    creationType = 'pdf';
  } else if (reqTypeNorm.includes('infographie') || parsedTypeNorm.includes('infographie') || parsed.key_figures || parsed.steps) {
    creationType = 'infographie';
  } else if (reqTypeNorm.includes('devoir-complet') || parsedTypeNorm.includes('devoir-complet') || parsed.parts) {
    creationType = 'devoir-complet';
  } else if (reqTypeNorm.includes('exercice') || parsedTypeNorm.includes('exercice') || parsed.exercises || parsed.exercices) {
    creationType = 'exercices-ecrits';
  } else if (reqTypeNorm.includes('questionnaire') || parsedTypeNorm.includes('questionnaire') || parsed.questions) {
    creationType = reqTypeNorm.includes('test') || parsedTypeNorm.includes('test') ? 'questionnaire-test' : 'questionnaire';
  }

  const creationTitle =
    parsed.creation_title ||
    parsed.title ||
    `${creationType.toUpperCase().replace(/-/g, ' ')} : ${docName || 'Étude Académique'}`;

  const chatResponse =
    parsed.chat_response ||
    parsed.message ||
    `J'ai conçu votre support interactif (${creationType.replace(/-/g, ' ')}) dans l'espace Création !`;

  let creationData: any = payloadData || parsed;

  // Normalisation spécifique par module
  if (creationType === 'vrai-ou-faux' || creationType === 'vrai-ou-faux-test') {
    const rawAffs = Array.isArray(payloadData)
      ? payloadData
      : (payloadData?.affirmations || payloadData?.questions || payloadData?.items || payloadData?.statements || payloadData?.data || (Array.isArray(parsed.affirmations) ? parsed.affirmations : []));
    const cleanAffs = (Array.isArray(rawAffs) ? rawAffs : []).slice(0, 18).map((a: any, idx: number) => {
      let isTrue = true;
      if (typeof a.is_true === 'boolean') isTrue = a.is_true;
      else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
      else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
      else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
      else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
      else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
      else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
      return {
        id: a.id || idx + 1,
        statement: a.statement || a.affirmation || a.question || a.texte || `Affirmation n°${idx + 1}`,
        is_true: isTrue,
        isTrue: isTrue,
        explanation: a.explanation || a.explication || a.justification || ''
      };
    });
    creationData = { title: creationTitle, affirmations: cleanAffs };
  } else if (creationType === 'questionnaire' || creationType === 'questionnaire-test') {
    const rawQs = Array.isArray(payloadData)
      ? payloadData
      : (payloadData?.questions || (Array.isArray(parsed.questions) ? parsed.questions : []));
    const cleanQs = (Array.isArray(rawQs) ? rawQs : []).slice(0, 18).map((q: any, idx: number) => {
      const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.choices) ? q.choices : []);
      const rawIdx = q.correct_index !== undefined
        ? q.correct_index
        : (q.correctIndex !== undefined
          ? q.correctIndex
          : (q.answerIndex !== undefined
            ? q.answerIndex
            : (q.correctAnswer !== undefined ? q.correctAnswer : 0)));
      let corrIdx = Number(rawIdx);
      if (isNaN(corrIdx) || corrIdx < 0 || corrIdx >= opts.length) corrIdx = 0;
      return {
        id: q.id || `q_${idx + 1}`,
        question: q.question || q.texte || `Question n°${idx + 1}`,
        options: opts,
        correct_index: corrIdx,
        correctIndex: corrIdx,
        answerIndex: corrIdx,
        correctAnswer: corrIdx,
        explanation: q.explanation || q.explication || ''
      };
    });
    creationData = { title: creationTitle, questions: cleanQs };
  } else if (creationType === 'carte-memoire') {
    const rawCards = Array.isArray(payloadData)
      ? payloadData
      : (payloadData?.cards || payloadData?.flashcards || (Array.isArray(parsed.cards) ? parsed.cards : []));
    const cleanCards = (Array.isArray(rawCards) ? rawCards : []).slice(0, 25).map((c: any, idx: number) => {
      const frontText = c.front || c.recto || c.question || c.notion || `Notion ${idx + 1}`;
      const backText = c.back || c.verso || c.answer || c.reponse || c.definition || '';
      const hintText = c.hint || c.indice || '';
      return {
        id: c.id || `c_${idx + 1}`,
        front: frontText,
        back: backText,
        question: frontText,
        answer: backText,
        hint: hintText,
        tag: c.tag || c.theme || c.chapitre || 'Général'
      };
    });
    creationData = { title: creationTitle, cards: cleanCards };
  } else if (creationType === 'resume') {
    const rawFormulas = Array.isArray(creationData.formulas) ? creationData.formulas : [];
    const normFormulas = rawFormulas.map((f: any) => ({
      ...f,
      name: f.name || f.title || 'Relation fondamentale',
      latex: f.latex || f.formula || '',
      formula: f.formula || f.latex || '',
      variables: f.variables || f.meaning || f.units || '',
      meaning: f.meaning || f.variables || '',
      target_goal: f.target_goal || f.when_to_use || '',
      when_to_use: f.when_to_use || f.target_goal || '',
      how_to_derive: f.how_to_derive || '',
      demonstration_steps: Array.isArray(f.demonstration_steps) ? f.demonstration_steps : [],
      exam_trap: f.exam_trap || f.trap || ''
    }));
    const rawTraps = Array.isArray(creationData.traps_and_tips) ? creationData.traps_and_tips : [];
    const normTraps = rawTraps.map((t: any, idx: number) =>
      typeof t === 'string'
        ? { type: idx % 2 === 0 ? 'trap' : 'tip', title: idx % 2 === 0 ? "PIÈGE D'EXAMEN" : 'ASTUCE MÉTHODOLOGIQUE', content: t }
        : {
            type: t?.type || 'trap',
            title: t?.title || (t?.type === 'tip' ? 'ASTUCE MÉTHODOLOGIQUE' : "PIÈGE D'EXAMEN"),
            content: t?.content || t?.text || t?.description || ''
          }
    );
    creationData = {
      title: creationData.title || creationTitle,
      theme: creationData.theme || 'Synthèse Globale',
      overview: creationData.overview || '',
      key_definitions: Array.isArray(creationData.key_definitions) ? creationData.key_definitions : [],
      formulas: normFormulas,
      comparison_table: creationData.comparison_table || { headers: [], rows: [] },
      traps_and_tips: normTraps,
      practical_example: creationData.practical_example || { statement: '', resolution_steps: [] },
      sections: Array.isArray(creationData.sections) ? creationData.sections : []
    };
  }

  return {
    mode: 'creation',
    decision: 'creation',
    creation_type: creationType,
    creation_title: creationTitle,
    creation_data: creationData,
    chat_response: chatResponse,
  };
}
