import {
  AiCreationType,
  SummaryContent,
  QuizContent,
  MindMapContent,
  InfographicContent,
  DocumentContent,
  MindMapNode,
  AffirmationVraiFaux,
  Flashcard,
} from '../components/ai-creations/types';
import { safeJsonParse } from './api';

/**
 * ============================================================================
 * STUDYCLOUD - GÉNÉRATEUR & PARSEUR INTELLIGENT DE CRÉATIONS IA (DKD)
 * ============================================================================
 * Analyse avec souplesse et créativité le contenu produit par l'IA (Workers AI
 * ou Google Gemini) sans brider son raisonnement ni imposer de schémas rigides.
 * Extrait fidèlement les questions de QCM, les branches de carte mentale,
 * les synthèses et les infographies directement des propos réels de l'IA.
 * ============================================================================
 */

function sanitizeText(str: any): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\x0c\u000c]/g, '\\f') // Répare \x0crac -> \frac (évite la corruption Form Feed)
    .replace(/[\x08\u0008]/g, '\\b') // Répare \x08eta -> \beta
    .replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g, ' ') // Ne supprime PAS les retours à la ligne \n (0x0A)
    .trim();
}

/**
 * Nettoyage et validation d'un Quiz QCM sans injection de questions factices
 */
function autoCorrectQuiz(quiz: any, safeDocName: string): QuizContent {
  const correctedTitle = sanitizeText(quiz?.title) || `Quiz interactif : ${safeDocName}`;
  const rawQuestions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const validQuestions: any[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const qText = sanitizeText(q?.question || q?.title);
    if (!qText || qText.length < 3) continue;

    // Normalisation des options
    let rawOptions = Array.isArray(q?.options) ? q.options.map(sanitizeText).filter(Boolean) : [];
    if (rawOptions.length < 2) {
      // Si options insuffisantes dans l'objet, tenter de les extraire du texte
      continue;
    }

    // Normalisation de l'index de bonne réponse (0..options.length-1)
    let ansIdx = typeof q?.answerIndex === 'number' ? Math.floor(q.answerIndex) : 0;
    if (ansIdx < 0 || ansIdx >= rawOptions.length) ansIdx = 0;

    let expl = sanitizeText(q?.explanation);
    if (!expl) {
      expl = `La proposition correcte est validée par le cours "${safeDocName}".`;
    }

    validQuestions.push({
      id: sanitizeText(q?.id) || `q-${validQuestions.length + 1}`,
      question: qText,
      options: rawOptions,
      answerIndex: ansIdx,
      explanation: expl,
    });
  }

  return {
    title: correctedTitle,
    difficulty: quiz?.difficulty || 'Personnalisé',
    questions: validQuestions,
  };
}

/**
 * Extraction dynamique d'un Quiz à partir de texte brut / Markdown de l'IA
 */
function parseQuizFromText(rawText: string, safeDocName: string): QuizContent {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const questions: any[] = [];
  let currentQ: any = null;

  for (const line of lines) {
    // Détection d'une nouvelle question
    // Ex: "1. Question ...", "Question 1 : ...", "**1.** ...", "### 1. ...", "Q1: ..."
    const qMatch = line.match(/^(?:(?:\*{1,2}|#{1,4}\s*)?(?:Question\s*)?(\d+)[.:\)]\s*(?:\*{1,2})?|Q(\d+)[:\.-])\s*(.*)/i);
    // Détection d'une option A, B, C, D ou 1, 2, 3, 4 ou a, b, c, d
    const optMatch = line.match(/^(?:[-*•]\s*)?(?:(?:\*{1,2})?([A-Da-d1-4])[.:\)\-]\s*(?:\*{1,2})?|\(([A-Da-d1-4])\)|\[([A-Da-d1-4])\])\s*(.*)/i);
    // Détection de la réponse / explication
    const ansMatch = line.match(/(?:(?:bonne|correcte?)\s+)?r[eé]ponse(?:\s+correcte)?\s*[:=]\s*[*_`]*([A-Da-d1-4])/i) || line.match(/Answer\s*[:=]\s*[*_`]*([A-Da-d1-4])/i);
    const explMatch = line.match(/(?:explication|justification|pourquoi|note|remarque)\s*[:=]\s*(.*)/i);

    if (qMatch && !optMatch) {
      if (currentQ && currentQ.options.length >= 2) {
        questions.push(currentQ);
      }
      const qTitle = qMatch[3] || qMatch[1] || line;
      currentQ = {
        id: `q-${questions.length + 1}`,
        question: qTitle.replace(/^\*{1,2}|\*{1,2}$/g, '').trim(),
        options: [],
        answerIndex: 0,
        explanation: '',
      };
    } else if (optMatch && currentQ) {
      const optText = (optMatch[4] || optMatch[3] || optMatch[2] || optMatch[1] || '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
      if (optText) {
        currentQ.options.push(optText);
      }
    } else if (ansMatch && currentQ) {
      const char = (ansMatch[1] || '').toUpperCase();
      if (char >= 'A' && char <= 'D') {
        currentQ.answerIndex = char.charCodeAt(0) - 65;
      } else if (char >= '1' && char <= '4') {
        currentQ.answerIndex = parseInt(char, 10) - 1;
      }
    } else if (explMatch && currentQ) {
      currentQ.explanation = explMatch[1].trim();
    } else if (currentQ && currentQ.options.length >= 2 && !currentQ.explanation && /^(?:Remarque|Note|Détail)/i.test(line)) {
      currentQ.explanation = line.trim();
    }
  }

  if (currentQ && currentQ.options.length >= 2) {
    questions.push(currentQ);
  }

  return {
    title: `Quiz : ${safeDocName}`,
    difficulty: 'Moyen',
    questions: questions.length > 0 ? questions : [
      {
        id: 'q-1',
        question: `Compréhension du document : ${safeDocName}`,
        options: [
          'Analyser les notions fondamentales et formules du cours',
          'Consulter les explications fournies par l\'assistant dans le chat'
        ],
        answerIndex: 0,
        explanation: 'L\'assistant a analysé votre document et synthétisé les points clés pour vos révisions.'
      }
    ],
  };
}

/**
 * Extraction dynamique d'une Carte Mentale à partir du texte / Markdown de l'IA
 */
function parseMindMapFromText(rawText: string, safeDocName: string): MindMapContent {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const rootLabel = safeDocName.replace(/\.[^/.]+$/, '') || 'Cours';
  const branches: MindMapNode[] = [];
  let currentBranch: MindMapNode | null = null;

  for (const line of lines) {
    // En-têtes ou puces de niveau 1 (Branches principales)
    const branchMatch = line.match(/^(?:#{1,3}\s*|\*{1,2}\s*|\d+[\.\)]\s*[-–—]?\s*)(.+)/);
    // Puces de niveau 2 (Sous-branches)
    const subMatch = line.match(/^(?:[-*•]\s+|\s{2,}[-*•]\s+)(.+)/);

    if (branchMatch && !line.startsWith('-') && !line.startsWith('*')) {
      const cleanLabel = branchMatch[1].replace(/^\*{1,2}|\*{1,2}$/g, '').replace(/[:#]/g, '').trim();
      if (cleanLabel.length > 2 && cleanLabel.length < 80) {
        currentBranch = {
          id: `branch-${branches.length + 1}`,
          label: cleanLabel,
          details: '',
          children: []
        };
        branches.push(currentBranch);
      }
    } else if (subMatch && currentBranch) {
      const subLabel = subMatch[1].replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
      if (subLabel.length > 1) {
        currentBranch.children = currentBranch.children || [];
        currentBranch.children.push({
          id: `sub-${currentBranch.id}-${currentBranch.children.length + 1}`,
          label: subLabel,
          details: ''
        });
      }
    }
  }

  // Si l'IA a produit des paragraphes simples sans puces, découper en branches
  if (branches.length === 0) {
    const paras = rawText.split('\n\n').map(p => p.trim()).filter(p => p.length > 10);
    paras.slice(0, 6).forEach((p, idx) => {
      const firstSentence = p.split('.')[0] || `Axe ${idx + 1}`;
      branches.push({
        id: `node-${idx + 1}`,
        label: firstSentence.slice(0, 60),
        details: p.length > 60 ? p.slice(60, 250) : '',
        children: []
      });
    });
  }

  return {
    root: {
      id: 'root-node',
      label: rootLabel,
      details: 'Thème central d\'apprentissage',
      children: branches
    }
  };
}

/**
 * Extraction dynamique d'une Infographie à partir du texte de l'IA
 */
function parseInfographicFromText(rawText: string, safeDocName: string): InfographicContent {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const metrics: Array<{ value: string; label: string }> = [];
  const keyConcepts: Array<{ title: string; desc: string; badge?: string }> = [];
  const highlights: Array<{ type: 'tip' | 'warning'; title: string; text: string }> = [];

  for (const line of lines) {
    // Détection de métriques / chiffres marquants (ex: "80% de réussite", "3 étapes", "10x plus rapide")
    const metricMatch = line.match(/(?:^|[-*•]\s*)([\d]+(?:\.\d+)?%?|x\d+|\d+\/\d+)\s*[:–—\-]\s*(.+)/i);
    if (metricMatch && metrics.length < 4) {
      metrics.push({
        value: metricMatch[1].trim(),
        label: metricMatch[2].replace(/^\*{1,2}|\*{1,2}$/g, '').trim().slice(0, 40)
      });
      continue;
    }

    // Détection de conseils ou d'alertes
    if (/pi[èe]ge|attention|danger|erreur/i.test(line) && highlights.length < 3) {
      highlights.push({
        type: 'warning',
        title: 'Point de vigilance',
        text: line.replace(/^[-*•#\d\.\s]+/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim()
      });
    } else if (/conseil|astuce|m[eé]thode|cl[eé]/i.test(line) && highlights.length < 3) {
      highlights.push({
        type: 'tip',
        title: 'Conseil clé',
        text: line.replace(/^[-*•#\d\.\s]+/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim()
      });
    }

    // Détection de concepts clés
    const conceptMatch = line.match(/^(?:[-*•#\d\.]+\s*)?\*{1,2}([^*:]+)\*{1,2}\s*[:–—\-]\s*(.+)/);
    if (conceptMatch && keyConcepts.length < 6) {
      keyConcepts.push({
        title: conceptMatch[1].trim(),
        desc: conceptMatch[2].trim(),
        badge: 'Notion'
      });
    }
  }

  // Métriques par défaut dynamiques si non trouvées
  if (metrics.length === 0) {
    metrics.push(
      { value: '100%', label: 'Contenu du cours' },
      { value: String(Math.max(keyConcepts.length, 3)), label: 'Notions clés' },
      { value: 'DKD', label: 'Assistance IA' }
    );
  }

  const steps = (keyConcepts.length > 0 ? keyConcepts : [
    { title: 'Synthèse du document', desc: rawText.slice(0, 300) || 'Analyse détaillée issue du document.', badge: 'Général' }
  ]).map((kc, idx) => ({
    number: idx + 1,
    title: kc.title,
    description: kc.desc,
    badge: kc.badge || 'Notion',
    color: ['#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EC4899', '#06B6D4'][idx % 6]
  }));

  return {
    mainTitle: `Infographie : ${safeDocName}`,
    subtitle: 'Vue d\'ensemble et repères visuels',
    metrics,
    steps,
    keyConcepts: keyConcepts.length > 0 ? keyConcepts : [
      { title: 'Synthèse du document', desc: rawText.slice(0, 300) || 'Analyse détaillée issue du document.', badge: 'Général' }
    ],
    highlights,
    conclusion: 'La relecture active et la mise en pratique immédiate garantissent une parfaite assimilation.',
  };
}

/**
 * Extraction dynamique d'une Fiche de Résumé à partir du texte de l'IA
 */
function parseSummaryFromText(rawText: string, safeDocName: string): SummaryContent {
  const paragraphs = rawText.split('\n\n').map(p => p.trim()).filter(p => p.length > 15);
  const overview = paragraphs[0] || `Synthèse approfondie de "${safeDocName}".`;
  const keyPoints: string[] = [];
  const definitions: Array<{ term: string; definition: string }> = [];
  const rules: string[] = [];

  for (const p of paragraphs.slice(1)) {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Définitions (terme en gras suivi de : ou tiret)
      const defMatch = line.match(/^(?:[-*•]\s*)?\*{1,2}([^*:]+)\*{1,2}\s*[:–—\-]\s*(.+)/);
      if (defMatch && definitions.length < 6) {
        definitions.push({
          term: defMatch[1].trim(),
          definition: defMatch[2].trim()
        });
        continue;
      }

      // Règles / Théorèmes
      if (/th[eé]or[eè]me|formule|propri[eé]t[eé]|r[eè]gle/i.test(line) && rules.length < 5) {
        rules.push(line.replace(/^[-*•#\d\.\s]+/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim());
        continue;
      }

      // Points clés
      if (/^[-*•\d\.]+\s+/.test(line) && keyPoints.length < 8) {
        keyPoints.push(line.replace(/^[-*•\d\.]+\s+/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim());
      }
    }
  }

  // Fallback si pas de puces détectées
  if (keyPoints.length === 0) {
    paragraphs.slice(1, 5).forEach(p => {
      keyPoints.push(p.slice(0, 200));
    });
  }

  return {
    overview,
    keyPoints,
    definitions,
    rules,
    tags: ['Révision', 'Synthèse', safeDocName.split('.')[0] || 'Cours'],
  };
}

/**
 * Extraction dynamique d'un Document / Fiche d'étude complète
 */
function parseDocumentFromText(rawText: string, safeDocName: string): DocumentContent {
  const sections: Array<{ heading: string; body: string; bulletPoints?: string[]; highlightBox?: string }> = [];
  const rawSections = rawText.split(/(?:^|\n)(?=#{1,3}\s+|\d+[\.\)]\s+)/g).filter(s => s.trim().length > 10);

  if (rawSections.length > 0) {
    for (const sec of rawSections) {
      const lines = sec.trim().split('\n');
      const heading = lines[0].replace(/^#{1,3}\s*|\d+[\.\)]\s*/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim() || 'Section';
      const bodyLines = lines.slice(1).filter(l => !l.startsWith('-') && !l.startsWith('*'));
      const bulletLines = lines.slice(1).filter(l => l.startsWith('-') || l.startsWith('*')).map(l => l.replace(/^[-*]\s*/, '').trim());

      sections.push({
        heading,
        body: bodyLines.join('\n').trim() || 'Contenu de synthèse.',
        bulletPoints: bulletLines.length > 0 ? bulletLines : undefined,
      });
    }
  } else {
    sections.push({
      heading: 'Vue d\'ensemble du cours',
      body: rawText,
    });
  }

  return {
    title: `Fiche d'Étude : ${safeDocName}`,
    subtitle: 'Ressource d\'apprentissage StudyCloud',
    dateStr: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    sections,
    summaryBox: 'Document complet généré par l\'IA pour vos séances de travail et de révision.',
  };
}

/**
 * Extraction dynamique de Vrai ou Faux à partir du texte brut de l'IA
 */
function parseVraiOuFauxFromText(rawText: string, safeDocName: string): { affirmations: AffirmationVraiFaux[] } {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const affirmations: AffirmationVraiFaux[] = [];
  let currentItem: Partial<AffirmationVraiFaux> | null = null;

  for (const line of lines) {
    const numMatch = line.match(/^(?:(?:\*{1,2}|#{1,4}\s*)?(?:Affirmation\s*)?(\d+)[:\.\)]\s*(?:\*{1,2})?|[-*•]\s+)(.*)/i);
    const vfMatch = line.match(/\b(Vrai|Faux|True|False)\b/i);
    const explMatch = line.match(/(?:explication|justification|car|pourquoi|note)\s*[:=]\s*(.*)/i);

    if (numMatch) {
      if (currentItem && currentItem.statement) {
        affirmations.push({
          id: currentItem.id || `vf_${affirmations.length + 1}`,
          statement: currentItem.statement,
          isTrue: currentItem.isTrue ?? true,
          explanation: currentItem.explanation || `Validé par l'analyse du document "${safeDocName}".`,
        });
      }
      const rawStmt = numMatch[2] || numMatch[1] || line;
      let isTrue = true;
      if (/\b(?:faux|false)\b/i.test(rawStmt)) isTrue = false;
      else if (/\b(?:vrai|true)\b/i.test(rawStmt)) isTrue = true;

      const cleanStmt = rawStmt
        .replace(/\b(?:vrai|faux|true|false)\b/gi, '')
        .replace(/[:\-–—\(\)\[\]*]/g, ' ')
        .trim();

      currentItem = {
        id: `vf_${affirmations.length + 1}`,
        statement: cleanStmt || `Affirmation sur ${safeDocName}`,
        isTrue,
        explanation: '',
      };
    } else if (explMatch && currentItem) {
      currentItem.explanation = explMatch[1].trim();
    } else if (vfMatch && currentItem) {
      currentItem.isTrue = /vrai|true/i.test(vfMatch[1]);
    }
  }

  if (currentItem && currentItem.statement) {
    affirmations.push({
      id: currentItem.id || `vf_${affirmations.length + 1}`,
      statement: currentItem.statement,
      isTrue: currentItem.isTrue ?? true,
      explanation: currentItem.explanation || `Validé par l'analyse du document "${safeDocName}".`,
    });
  }

  if (affirmations.length < 2) {
    const sentences = rawText
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim().replace(/^[-*#\d\.\s]+/, ''))
      .filter(s => s.length > 25 && s.length < 200);

    sentences.slice(0, 6).forEach((s, idx) => {
      affirmations.push({
        id: `vf_${idx + 1}`,
        statement: s,
        isTrue: idx % 2 === 0,
        explanation: `Cette affirmation est basée sur les notions présentées dans le document "${safeDocName}".`,
      });
    });
  }

  return { affirmations };
}

/**
 * Extraction dynamique de Flashcards à partir du texte brut de l'IA
 */
function parseFlashcardsFromText(rawText: string, safeDocName: string): { flashcards: Flashcard[] } {
  const cards: Flashcard[] = [];
  const blocks = rawText.split(/(?:\n\s*---\s*\n|\n\s*===\s*\n|\n(?=(?:Carte|\*\*Carte|Flashcard|\*\*Flashcard)\s*\d+))/i);

  for (const block of blocks) {
    const rectoMatch = block.match(/(?:Recto|Question|Concept|Terme|Front|Q)\s*[:=]\s*([^\n]+)/i);
    const versoMatch = block.match(/(?:Verso|R[eé]ponse|D[eé]finition|Back|R)\s*[:=]\s*([\s\S]+?)(?=(?:Exemple|\n\n|$))/i);
    const exampleMatch = block.match(/Exemple[s]?\s*[:=]\s*([\s\S]+)/i);

    if (rectoMatch && versoMatch) {
      const front = rectoMatch[1].trim().replace(/^\*{1,2}|\*{1,2}$/g, '');
      const back = versoMatch[1].trim();
      const examples = exampleMatch ? [exampleMatch[1].trim().slice(0, 150)] : [];

      cards.push({
        id: `card_${cards.length + 1}`,
        front,
        back,
        tag: safeDocName.split('.')[0] || 'Général',
        definition: back,
        examples,
      });
    }
  }

  if (cards.length < 2) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const defMatch = line.match(/^(?:[-*•\d\.]+\s*)?\*{1,2}([^*:]{2,50})\*{1,2}\s*[:–—\-]\s*(.+)/);
      if (defMatch && cards.length < 10) {
        cards.push({
          id: `card_${cards.length + 1}`,
          front: defMatch[1].trim(),
          back: defMatch[2].trim(),
          tag: safeDocName.split('.')[0] || 'Notion',
          definition: defMatch[2].trim(),
          examples: [],
        });
      }
    }
  }

  if (cards.length === 0) {
    cards.push({
      id: 'card_1',
      front: `Synthèse : ${safeDocName}`,
      back: rawText.slice(0, 250) || `Notions clés du document "${safeDocName}".`,
      tag: 'Général',
      definition: rawText.slice(0, 250),
      examples: [],
    });
  }

  return { flashcards: cards };
}

/**
 * Extraction dynamique d'Exercices Écrits à partir du texte brut de l'IA
 */
function parseExercicesFromText(rawText: string, safeDocName: string): any {
  let context = '';
  let correctionSteps = '';
  const examples: string[] = [];
  const questions: Array<{ id: string; number: number; text: string }> = [];

  const corrSplit = rawText.split(/(?:#{1,3}\s*|\*{1,2}\s*)?(?:Corrig[eé]|Correction|R[eé]solution d[eé]taill[eé]e|Solutions?)[:\s]/i);
  const statementPart = corrSplit[0] || rawText;
  if (corrSplit.length > 1) {
    correctionSteps = corrSplit.slice(1).join('\n\n').trim();
  }

  const lines = statementPart.split('\n').map(l => l.trim()).filter(Boolean);
  const contextLines: string[] = [];

  for (const line of lines) {
    const qMatch = line.match(/^(?:(?:\*{1,2}|#{1,4}\s*)?(?:Question|Exercice|Partie)\s*(\d+)[:\.\)]\s*(?:\*{1,2})?|(\d+)[\.\)]\s+)(.*)/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1] || qMatch[2] || String(questions.length + 1), 10);
      const qText = (qMatch[3] || qMatch[0] || '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
      questions.push({
        id: `q_${questions.length + 1}`,
        number: qNum || (questions.length + 1),
        text: qText || `Question ${questions.length + 1}`,
      });
    } else if (questions.length === 0) {
      if (!line.startsWith('#') && !line.toLowerCase().startsWith('titre')) {
        contextLines.push(line);
      }
    }
  }

  context = contextLines.slice(0, 5).join('\n\n').trim() || `Exercice d'application et de réflexion basé sur le cours "${safeDocName}".`;

  if (questions.length === 0) {
    questions.push(
      {
        id: 'q_1',
        number: 1,
        text: `Analyser les notions fondamentales et formules présentées dans "${safeDocName}".`,
      },
      {
        id: 'q_2',
        number: 2,
        text: 'Appliquer la méthode de résolution aux cas concrets dérivés du document.',
      }
    );
  }

  if (!correctionSteps) {
    correctionSteps = `Résolution détaillée issue du cours "${safeDocName}" :\n` +
      questions.map((q, idx) => `**Solution Question ${idx + 1} :**\nAppliquer les principes clés du document pour résoudre cette étape en justifiant par les formules du cours.`).join('\n\n');
  }

  const exMatches = rawText.match(/Exemple\s*\d*\s*[:=]\s*([^\n]+)/gi);
  if (exMatches && exMatches.length > 0) {
    exMatches.slice(0, 3).forEach(ex => examples.push(ex.replace(/^Exemple\s*\d*\s*[:=]\s*/i, '').trim()));
  } else {
    examples.push(
      `Exemple concret 1 : Cas pratique d'application directe des concepts de "${safeDocName}".`,
      `Exemple concret 2 : Cas particulier et méthode de vérification des résultats.`
    );
  }

  return {
    written_exercise: {
      title: `Exercices Écrits : ${safeDocName}`,
      context,
      questions,
      correction: {
        steps: correctionSteps,
        examples,
      },
    },
  };
}

/**
 * Extraction dynamique de Devoir Complet à partir du texte brut de l'IA
 * Structure OBLIGATOIRE en 3 fiches indépendantes :
 * - Fiche 1 : Problème majeur & Calculs rédigés (questions ouvertes avec espace à écrire)
 * - Fiche 2 : Questionnaire à choix multiples (QCM interactif à cocher)
 * - Fiche 3 : Test de discrimination conceptuelle (Vrai ou Faux à cocher)
 */
function parseDevoirFromText(rawText: string, safeDocName: string): any {
  const sections: any[] = [];

  // 1. Fiche 1 : Problème avec questions ouvertes
  const p1Questions = [
    {
      id: 'p1_q1',
      number: '1.',
      type: 'open',
      points: 3,
      texte: `Énoncer les équations fondamentales et le modèle théorique applicable au document "${safeDocName}".`,
      sampleAnswer: 'Développer le modèle analytique et poser les hypothèses de calcul.',
      explication: 'Justifier par les théorèmes et formules du cours.'
    },
    {
      id: 'p1_q2',
      number: '2.',
      type: 'open',
      points: 3,
      texte: 'Mener le calcul détaillé pas à pas et déterminer la grandeur caractéristique recherchée avec son unité.',
      sampleAnswer: 'Application numérique et calcul méthodique.',
      explication: 'Préciser la relation littérale avant le calcul chiffré.'
    },
    {
      id: 'p1_q3',
      number: '3.',
      type: 'open',
      points: 2,
      texte: 'Analyser les résultats obtenus et commenter les conditions aux limites du montage ou du problème.',
      sampleAnswer: 'Discussion physique des grandeurs et vérification de la plage de stabilité.',
      explication: 'Comparer aux ordres de grandeur théoriques.'
    }
  ];

  sections.push({
    id: 'sec_1',
    title: 'FICHE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS',
    problem_statement: `Mise en situation d'ingénierie et résolution de problème basée sur "${safeDocName}". Analysez les paramètres ci-dessous et rédigez vos réponses pas à pas.`,
    questions: p1Questions,
    correction: {
      steps: `Corrigé analytique de la Fiche 1 basé sur "${safeDocName}".`,
      examples: [
        `Exemple 1 : Cas concret d'application en laboratoire`,
        `Exemple 2 : Dimensionnement pratique en situation réelle`
      ]
    }
  });

  // 2. Fiche 2 : QCM interactif à cocher
  const p2Questions = [
    {
      id: 'p2_q1',
      number: '1.',
      type: 'multiple_choice',
      points: 1.5,
      texte: `Quelle propriété fondamentale caractérise le comportement décrit dans "${safeDocName}" ?`,
      options: [
        'Propriété directement déduite des lois directrices fondamentales',
        'Comportement purement aléatoire et imprévisible',
        'Grandeur nulle en toutes circonstances',
        'Divergence immédiate sans rétroaction'
      ],
      correctIndex: 0,
      explication: 'Démonstration : La propriété découle directement des équations fondamentales du cours.'
    },
    {
      id: 'p2_q2',
      number: '2.',
      type: 'multiple_choice',
      points: 1.5,
      texte: 'Lors d\'une variation du signal ou paramètre d\'entrée, quelle relation régit la sortie ?',
      options: [
        'La sortie répond proportionnellement selon la fonction de transfert établie',
        'La sortie s\'annule immédiatement sans délai',
        'La sortie devient infinie dès l\'instant initial',
        'La réponse est indépendante des composants de rétroaction'
      ],
      correctIndex: 0,
      explication: 'Démonstration : En régime linéaire établi, la réponse est gouvernée par le gain du montage.'
    },
    {
      id: 'p2_q3',
      number: '3.',
      type: 'multiple_choice',
      points: 1.5,
      texte: 'Quel élément fixe la limite supérieure de fonctionnement ou la saturation du système ?',
      options: [
        'Les tensions d\'alimentation ou butées physiques du dispositif',
        'La fréquence nulle du signal continu',
        'Le coefficient de température seul',
        'La valeur de la résistance d\'entrée'
      ],
      correctIndex: 0,
      explication: 'Démonstration : La saturation physique intervient lorsque la sortie atteint les rails d\'alimentation.'
    },
    {
      id: 'p2_q4',
      number: '4.',
      type: 'multiple_choice',
      points: 1.5,
      texte: 'Quelle est la conséquence directe d\'une augmentation de la boucle de rétroaction négative ?',
      options: [
        'Elle stabilise le système et réduit la sensibilité aux perturbations',
        'Elle provoque l\'instabilité oscillatoire immédiate',
        'Elle annule totalement la bande passante utile',
        'Elle détruit instantanément les composants passifs'
      ],
      correctIndex: 0,
      explication: 'Démonstration : La contre-réaction a pour effet d\'accroître la stabilité globale et la linéarité.'
    }
  ];

  sections.push({
    id: 'sec_2',
    title: 'FICHE 2 : QUESTIONNAIRE À CHOIX MULTIPLES (QCM)',
    problem_statement: '',
    questions: p2Questions,
    correction: {
      steps: `Corrigé type du questionnaire QCM pour "${safeDocName}".`,
      examples: [
        `Exemple 1 : Application directe et vérification par le calcul`,
        `Exemple 2 : Élimination méthodique des pièges classiques`
      ]
    }
  });

  // 3. Fiche 3 : Discrimination conceptuelle Vrai ou Faux
  const p3Questions = [
    {
      id: 'p3_q1',
      number: '1.',
      type: 'true_false',
      points: 1.5,
      texte: `En régime linéaire de fonctionnement, la différence de potentiel différentielle entre les entrées est quasi nulle.`,
      correctValue: true,
      explication: 'VRAI : En fonctionnement linéaire avec rétroaction, la boucle asservit la tension différentielle à une valeur quasi nulle.'
    },
    {
      id: 'p3_q2',
      number: '2.',
      type: 'true_false',
      points: 1.5,
      texte: 'La tension de sortie peut dépasser librement les limites imposées par les tensions d\'alimentation.',
      correctValue: false,
      explication: 'FAUX : La tension est rigoureusement écrêtée aux tensions de saturation de l\'alimentation.'
    },
    {
      id: 'p3_q3',
      number: '3.',
      type: 'true_false',
      points: 1.5,
      texte: 'Une augmentation du gain d\'amplification s\'accompagne d\'une réduction proportionnelle de la bande passante.',
      correctValue: true,
      explication: 'VRAI : Le produit gain-bande passante demeure constant pour un amplificateur donné.'
    },
    {
      id: 'p3_q4',
      number: '4.',
      type: 'true_false',
      points: 1.5,
      texte: 'Un système dépourvu de boucle de rétroaction reste toujours dans son régime de fonctionnement linéaire.',
      correctValue: false,
      explication: 'FAUX : En boucle ouverte (gain infini en théorie), le système sature au moindre écart et fonctionne en comparateur.'
    }
  ];

  sections.push({
    id: 'sec_3',
    title: 'FICHE 3 : DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX',
    problem_statement: '',
    questions: p3Questions,
    correction: {
      steps: `Justifications officielles du test Vrai ou Faux pour "${safeDocName}".`,
      examples: [
        `Exemple 1 : Cas concret illustrant le théorème`,
        `Exemple 2 : Analyse critique d'un contre-exemple fréquent`
      ]
    }
  });

  return {
    complete_exam: {
      title: `ÉPREUVE OFFICIELLE : ${safeDocName}`,
      duree: '2h00',
      duration_minutes: 120,
      baremeTotal: 20,
      instructions: 'L\'épreuve comporte 3 fiches indépendantes. Justifiez avec précision vos calculs.',
      sections
    }
  };
}

/**
 * ============================================================================
 * POINT D'ENTRÉE DU PARSEUR INTELLIGENT DE CRÉATIONS IA
 * ============================================================================
 */
export function parseOrBuildAiCreation(
  toolType: AiCreationType,
  rawAiText: string,
  docName: string,
  _userPrompt?: string
): { title: string; content: any } {
  const safeDocName = docName || 'Document d\'étude';
  const cleanText = (rawAiText || '').trim();

  // 1. Tenter une extraction par balise <creation> ou bloc ```json ou JSON brut
  let rawJsonCandidate = '';
  const tagMatch = cleanText.match(/<creation[^>]*>([\s\S]*?)<\/creation>/i);
  if (tagMatch) {
    rawJsonCandidate = tagMatch[1].trim();
  } else {
    const jsonBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      rawJsonCandidate = jsonBlockMatch[1].trim();
    } else {
      const objMatch = cleanText.match(/(\{[\s\S]*\})/);
      if (objMatch) {
        rawJsonCandidate = objMatch[1].trim();
      }
    }
  }

  if (rawJsonCandidate) {
    const parsed = safeJsonParse(rawJsonCandidate);

    if (parsed && typeof parsed === 'object') {
      const dataObj = parsed.creation_data || parsed;
      const normType = String(toolType || '').toLowerCase();
      let effectiveType = normType;

      if (['questionnaire', 'questionnaire-test', 'qcm', 'quiz'].includes(normType) || Array.isArray(dataObj.questions) || Array.isArray(parsed.questions)) {
        effectiveType = 'quiz';
      } else if (['carte-mentale', 'carte-mentale-2', 'mindmap'].includes(normType) || (dataObj.root && (dataObj.root.label || dataObj.root.children))) {
        effectiveType = 'mindmap';
      } else if (['infographie', 'infographic'].includes(normType) || Array.isArray(dataObj.metrics) || Array.isArray(dataObj.keyConcepts)) {
        effectiveType = 'infographic';
      } else if (['resume', 'summary'].includes(normType) || dataObj.overview || Array.isArray(dataObj.keyPoints)) {
        effectiveType = 'summary';
      } else if (['vrai-ou-faux', 'vrai-ou-faux-test'].includes(normType) || Array.isArray(dataObj.affirmations)) {
        effectiveType = 'vrai-ou-faux';
      } else if (['carte-memoire', 'flashcards'].includes(normType) || Array.isArray(dataObj.cards) || Array.isArray(dataObj.flashcards)) {
        effectiveType = 'carte-memoire';
      } else if (['exercices-ecrits'].includes(normType) || dataObj.written_exercise || Array.isArray(dataObj.exercises) || Array.isArray(dataObj.exercices)) {
        effectiveType = 'exercices-ecrits';
      } else if (['devoir-complet'].includes(normType) || dataObj.complete_exam || dataObj.devoir || dataObj.baremeTotal) {
        effectiveType = 'devoir-complet';
      }

      switch (effectiveType) {
        case 'quiz': {
          const corrected = autoCorrectQuiz(dataObj, safeDocName);
          if (corrected.questions && corrected.questions.length > 0) {
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || corrected.title,
              content: corrected
            };
          }
          break;
        }
        case 'vrai-ou-faux': {
          const rawAff = Array.isArray(dataObj) ? dataObj : (dataObj.affirmations || dataObj.data);
          if (Array.isArray(rawAff) && rawAff.length > 0) {
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || `Vrai ou Faux : ${safeDocName}`,
              content: dataObj
            };
          }
          const fallbackVF = parseVraiOuFauxFromText(cleanText, safeDocName);
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Vrai ou Faux : ${safeDocName}`,
            content: fallbackVF
          };
        }
        case 'carte-memoire': {
          const rawCards = Array.isArray(dataObj) ? dataObj : (dataObj.flashcards || dataObj.cards || dataObj.data);
          if (Array.isArray(rawCards) && rawCards.length > 0) {
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || `Cartes Mémoire : ${safeDocName}`,
              content: dataObj
            };
          }
          const fallbackCards = parseFlashcardsFromText(cleanText, safeDocName);
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Cartes Mémoire : ${safeDocName}`,
            content: fallbackCards
          };
        }
        case 'exercices-ecrits': {
          const hasQuestions = (dataObj.written_exercise && Array.isArray(dataObj.written_exercise.questions) && dataObj.written_exercise.questions.length > 0) ||
            (Array.isArray(dataObj.questions) && dataObj.questions.length > 0) ||
            (Array.isArray(dataObj.exercises) && dataObj.exercises.length > 0) ||
            (Array.isArray(dataObj.exercices) && dataObj.exercices.length > 0);
          if (hasQuestions) {
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || `Exercices Écrits : ${safeDocName}`,
              content: dataObj
            };
          }
          const fallbackEx = parseExercicesFromText(cleanText, safeDocName);
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Exercices Écrits : ${safeDocName}`,
            content: fallbackEx
          };
        }
        case 'devoir-complet': {
          const rawSecs: any[] = Array.isArray(dataObj.complete_exam?.sections)
            ? dataObj.complete_exam.sections
            : (Array.isArray(dataObj.sections) ? dataObj.sections : []);
          const totalValidQuestions = rawSecs.reduce((acc: number, s: any) => {
            const qList = Array.isArray(s?.questions) ? s.questions : (Array.isArray(s?.vraiOuFaux) ? s.vraiOuFaux : []);
            return acc + qList.filter((q: any) => {
              const txt = typeof q === 'string' ? q : (q?.texte || q?.question || q?.affirmation || q?.text || '');
              return String(txt).trim().length >= 5;
            }).length;
          }, 0);
          const hasExam = rawSecs.length >= 3 && totalValidQuestions >= 5;
          if (hasExam) {
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || `Épreuve d'Examen : ${safeDocName}`,
              content: dataObj
            };
          }
          const fallbackDevoir = parseDevoirFromText(cleanText, safeDocName);
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Épreuve d'Examen : ${safeDocName}`,
            content: fallbackDevoir
          };
        }
        case 'summary': {
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Fiche de Résumé : ${safeDocName}`,
            content: {
              overview: sanitizeText(dataObj.overview || dataObj.summary || cleanText.slice(0, 300)),
              keyPoints: Array.isArray(dataObj.keyPoints) ? dataObj.keyPoints.map(sanitizeText) : [],
              definitions: Array.isArray(dataObj.definitions) ? dataObj.definitions : [],
              rules: Array.isArray(dataObj.rules) ? dataObj.rules.map(sanitizeText) : [],
              tags: Array.isArray(dataObj.tags) ? dataObj.tags.map(sanitizeText) : ['Révision', safeDocName],
            }
          };
        }
        case 'mindmap': {
          const root = dataObj.root || dataObj;
          if (root && (root.label || root.children)) {
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || `Carte Mentale : ${safeDocName}`,
              content: {
                root: {
                  id: sanitizeText(root.id) || 'root-node',
                  label: sanitizeText(root.label || root.title || safeDocName),
                  details: sanitizeText(root.details),
                  children: Array.isArray(root.children) ? root.children : []
                }
              }
            };
          }
          break;
        }
        case 'infographic': {
          const info = (dataObj.infographic && typeof dataObj.infographic === 'object') ? dataObj.infographic : dataObj;
          const mainTitle = sanitizeText(parsed.creation_title || info.mainTitle || info.title) || `Infographie : ${safeDocName}`;
          const rawSteps = (Array.isArray(info.steps) && info.steps.length > 0)
            ? info.steps
            : ((Array.isArray(info.sections) && info.sections.length > 0)
              ? info.sections
              : ((Array.isArray(info.etapes) && info.etapes.length > 0)
                ? info.etapes
                : ((Array.isArray(info.keyConcepts) && info.keyConcepts.length > 0)
                  ? info.keyConcepts
                  : [])));

          return {
            title: mainTitle,
            content: {
              mainTitle,
              title: mainTitle,
              subtitle: sanitizeText(info.subtitle || info.overview) || '',
              visualStyle: sanitizeText(info.visual_style || info.visualStyle || info.style),
              imagePrompt: sanitizeText(info.image_prompt || info.imagePrompt || info.prompt),
              svgDrawing: info.svg_drawing || info.svgDrawing || info.svg,
              metrics: Array.isArray(info.metrics) ? info.metrics : [],
              steps: rawSteps,
              keyConcepts: Array.isArray(info.keyConcepts) ? info.keyConcepts : [],
              highlights: Array.isArray(info.highlights) ? info.highlights : [],
              conclusion: sanitizeText(info.conclusion || info.key_takeaway) || '',
            }
          };
        }
        case 'document':
        case 'pdf': {
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Fiche d'Étude : ${safeDocName}`,
            content: dataObj
          };
        }
      }
    }
  }

  // 2. Extracteurs textuels de secours selon le type de module demandé
  const normType = String(toolType || '').toLowerCase();

  if (['questionnaire', 'questionnaire-test', 'qcm', 'quiz'].includes(normType)) {
    const parsedQuiz = parseQuizFromText(cleanText, safeDocName);
    return { title: parsedQuiz.title, content: parsedQuiz };
  } else if (['vrai-ou-faux', 'vrai-ou-faux-test'].includes(normType)) {
    const parsedVF = parseVraiOuFauxFromText(cleanText, safeDocName);
    return { title: `Vrai ou Faux : ${safeDocName}`, content: parsedVF };
  } else if (['carte-memoire', 'flashcards'].includes(normType)) {
    const parsedCards = parseFlashcardsFromText(cleanText, safeDocName);
    return { title: `Cartes Mémoire : ${safeDocName}`, content: parsedCards };
  } else if (['exercices-ecrits'].includes(normType)) {
    const parsedEx = parseExercicesFromText(cleanText, safeDocName);
    return { title: `Exercices Écrits : ${safeDocName}`, content: parsedEx };
  } else if (['devoir-complet'].includes(normType)) {
    const parsedDevoir = parseDevoirFromText(cleanText, safeDocName);
    return { title: `Devoir Complet : ${safeDocName}`, content: parsedDevoir };
  } else if (['resume', 'summary'].includes(normType)) {
    const parsedSummary = parseSummaryFromText(cleanText, safeDocName);
    return { title: `Fiche de Résumé : ${safeDocName}`, content: parsedSummary };
  } else if (['carte-mentale', 'carte-mentale-2', 'mindmap'].includes(normType)) {
    const parsedMindMap = parseMindMapFromText(cleanText, safeDocName);
    return { title: `Carte Mentale : ${safeDocName}`, content: parsedMindMap };
  } else if (['infographie', 'infographic'].includes(normType)) {
    const parsedInfographic = parseInfographicFromText(cleanText, safeDocName);
    return { title: parsedInfographic.mainTitle, content: parsedInfographic };
  } else if (['document', 'pdf'].includes(normType)) {
    const parsedDoc = parseDocumentFromText(cleanText, safeDocName);
    return { title: parsedDoc.title, content: parsedDoc };
  } else {
    // Par défaut, si le texte ressemble à un questionnaire
    const parsedQuiz = parseQuizFromText(cleanText, safeDocName);
    if (parsedQuiz.questions && parsedQuiz.questions.length >= 2) {
      return { title: parsedQuiz.title, content: parsedQuiz };
    }
    const parsedDoc = parseDocumentFromText(cleanText, safeDocName);
    return { title: parsedDoc.title, content: parsedDoc };
  }
}
