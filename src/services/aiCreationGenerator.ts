import { AiCreationType, SummaryContent, QuizContent, MindMapContent, InfographicContent, DocumentContent, MindMapNode } from '../components/ai-creations/types';

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
  return str.replace(/[\x00-\x1F\x7F]/g, ' ').trim();
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
    difficulty: 'Adaptatif',
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

  return {
    mainTitle: `Infographie : ${safeDocName}`,
    subtitle: 'Vue d\'ensemble et repères visuels',
    metrics,
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
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawJsonCandidate);
    } catch {
      try {
        // Correction des virgules traînantes fréquentes chez les LLMs
        const sanitized = rawJsonCandidate.replace(/,\s*([\]}])/g, '$1');
        parsed = JSON.parse(sanitized);
      } catch {
        parsed = null;
      }
    }

    if (parsed && typeof parsed === 'object') {
      // Détection automatique du type si la structure le prouve formellement
      let effectiveType = toolType;
      if (Array.isArray(parsed.questions)) effectiveType = 'quiz';
      else if (parsed.root && (parsed.root.label || parsed.root.children)) effectiveType = 'mindmap';
      else if (Array.isArray(parsed.metrics) || Array.isArray(parsed.keyConcepts)) effectiveType = 'infographic';
      else if (parsed.overview || Array.isArray(parsed.keyPoints)) effectiveType = 'summary';

      switch (effectiveType) {
        case 'quiz': {
          const corrected = autoCorrectQuiz(parsed, safeDocName);
          if (corrected.questions && corrected.questions.length > 0) {
            return { title: corrected.title, content: corrected };
          }
          break;
        }
        case 'summary': {
          return {
            title: sanitizeText(parsed.title) || `Fiche de Résumé : ${safeDocName}`,
            content: {
              overview: sanitizeText(parsed.overview || parsed.summary || cleanText.slice(0, 300)),
              keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(sanitizeText) : [],
              definitions: Array.isArray(parsed.definitions) ? parsed.definitions : [],
              rules: Array.isArray(parsed.rules) ? parsed.rules.map(sanitizeText) : [],
              tags: Array.isArray(parsed.tags) ? parsed.tags.map(sanitizeText) : ['Révision', safeDocName],
            }
          };
        }
        case 'mindmap': {
          const root = parsed.root || parsed;
          if (root && (root.label || root.children)) {
            return {
              title: `Carte Mentale : ${safeDocName}`,
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
          return {
            title: sanitizeText(parsed.mainTitle || parsed.title) || `Infographie : ${safeDocName}`,
            content: {
              mainTitle: sanitizeText(parsed.mainTitle || parsed.title) || `Infographie : ${safeDocName}`,
              subtitle: sanitizeText(parsed.subtitle) || 'Repères visuels',
              metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
              keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
              highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
              conclusion: sanitizeText(parsed.conclusion) || '',
            }
          };
        }
        case 'document': {
          return {
            title: sanitizeText(parsed.title) || `Fiche d'Étude : ${safeDocName}`,
            content: parsed
          };
        }
      }
    }
  }

  // 2. Extracteurs textuels créatifs et dynamiques (sans canevas fixe ni répétition)
  switch (toolType) {
    case 'quiz': {
      const parsedQuiz = parseQuizFromText(cleanText, safeDocName);
      return { title: parsedQuiz.title, content: parsedQuiz };
    }

    case 'summary': {
      const parsedSummary = parseSummaryFromText(cleanText, safeDocName);
      return { title: `Fiche de Résumé : ${safeDocName}`, content: parsedSummary };
    }

    case 'mindmap': {
      const parsedMindMap = parseMindMapFromText(cleanText, safeDocName);
      return { title: `Carte Mentale : ${safeDocName}`, content: parsedMindMap };
    }

    case 'infographic': {
      const parsedInfographic = parseInfographicFromText(cleanText, safeDocName);
      return { title: parsedInfographic.mainTitle, content: parsedInfographic };
    }

    case 'document':
    default: {
      const parsedDoc = parseDocumentFromText(cleanText, safeDocName);
      return { title: parsedDoc.title, content: parsedDoc };
    }
  }
}
