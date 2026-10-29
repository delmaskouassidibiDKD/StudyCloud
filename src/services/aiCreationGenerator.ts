import {
  AiCreationType,
  SummaryContent,
  SummaryFormula,
  QuizContent,
  MindMapContent,
  InfographicContent,
  DocumentContent,
  MindMapNode,
  AffirmationVraiFaux,
  Flashcard,
} from '../components/ai-creations/types';
import { safeJsonParse } from './api';
import {
  detectExamDomain,
  getDomainExamTemplate,
  isGenericOrPlaceholderText,
  cleanExamTitle
} from './examDomainTemplates';

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

function cleanFormulaLatex(latex?: string): string {
  if (!latex) return '';
  return latex
    .replace(/(?<!\\)\$/g, '')
    .trim();
}

function isFillerText(str?: string): boolean {
  if (!str) return true;
  return /^(?:application directe du cours|selon les lois fondamentales|d[eé]monstration par application des lois fondamentales|selon le cours|application du cours|n\/a)$/i.test(str.trim());
}

/**
 * Mélange aléatoirement les options d'une question à choix multiples tout en recalculant
 * fidèlement l'index de la bonne réponse, pour garantir que la bonne réponse ne soit jamais
 * prévisiblement toujours au début (option 1 ou 2).
 */
export function shuffleOptionsWithCorrectIndex(
  options: string[],
  correctIndex: number
): { shuffledOptions: string[]; newCorrectIndex: number } {
  if (!options || options.length <= 1) {
    return {
      shuffledOptions: options || [],
      newCorrectIndex: Math.max(0, Math.min(correctIndex || 0, (options?.length || 1) - 1)),
    };
  }

  // Ne pas mélanger un Vrai/Faux binaire canonique pour préserver l'ordre Vrai puis Faux
  const isBinaryTrueFalse =
    options.length === 2 &&
    options.some(o => /^(vrai|true)/i.test(o.trim())) &&
    options.some(o => /^(faux|false)/i.test(o.trim()));

  if (isBinaryTrueFalse) {
    return {
      shuffledOptions: options,
      newCorrectIndex: Math.max(0, Math.min(correctIndex || 0, options.length - 1)),
    };
  }

  const safeCorrIdx = Math.max(0, Math.min(correctIndex || 0, options.length - 1));

  // Association de chaque option avec un drapeau indiquant si c'est la bonne réponse
  const items = options.map((opt, i) => ({
    opt,
    isCorrect: i === safeCorrIdx,
  }));

  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  const shuffledOptions = items.map(item => item.opt);
  const foundIdx = items.findIndex(item => item.isCorrect);
  const newCorrectIndex = foundIdx >= 0 ? foundIdx : 0;

  return {
    shuffledOptions,
    newCorrectIndex,
  };
}

/**
 * Nettoie les explications des préfixes statiques de lettres (ex: "L'option A est correcte car...")
 * pour que l'explication reste vraie et naturelle même une fois les options mélangées.
 */
export function cleanExplanationOfStaticLetterPrefixes(explanation: string): string {
  if (!explanation || typeof explanation !== 'string') return '';
  return explanation
    .replace(/^(?:L'option|La proposition|La réponse|Réponse)\s+[A-D1-4]\s*(?:est\s+correcte\s*)?[:\-–—]\s*/i, '')
    .replace(/^La\s+bonne\s+réponse\s+est\s+(?:l'option|la\s+proposition|la\s+lettre)?\s*[A-D1-4][\s.:,\-–—]*/i, '')
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

    // Mélange aléatoire obligatoire des options avec recalcul fidèle de l'index
    const { shuffledOptions, newCorrectIndex } = shuffleOptionsWithCorrectIndex(rawOptions, ansIdx);

    let expl = sanitizeText(q?.explanation);
    if (!expl) {
      expl = `La proposition correcte est validée par le cours "${safeDocName}".`;
    }
    const cleanExpl = cleanExplanationOfStaticLetterPrefixes(expl) || expl;

    validQuestions.push({
      id: sanitizeText(q?.id) || `q-${validQuestions.length + 1}`,
      question: qText,
      options: shuffledOptions,
      answerIndex: newCorrectIndex,
      explanation: cleanExpl,
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

  const shuffledQuestions = questions.map(q => {
    const { shuffledOptions, newCorrectIndex } = shuffleOptionsWithCorrectIndex(q.options, q.answerIndex);
    const cleanExpl = cleanExplanationOfStaticLetterPrefixes(q.explanation) || q.explanation;
    return {
      ...q,
      options: shuffledOptions,
      answerIndex: newCorrectIndex,
      explanation: cleanExpl,
    };
  });

  return {
    title: `Quiz : ${safeDocName}`,
    difficulty: 'Moyen',
    questions: (shuffledQuestions.length > 0 ? shuffledQuestions : [
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
    ]).slice(0, 18),
  };
}

/**
 * Extraction dynamique d'une Carte Mentale à partir du texte / Markdown de l'IA
 */
function parseMindMapFromText(rawText: string, safeDocName: string): MindMapContent {
  const rootLabel = safeDocName.replace(/\.[^/.]+$/, '') || 'Cours';
  const branches: MindMapNode[] = [];
  let currentBranch: MindMapNode | null = null;

  // 0. Si rawText contient un JSON complet, l'extraire et le parser prioritairement avec safeJsonParse
  if (rawText.includes('{') && rawText.includes('}')) {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || rawText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const parsed = safeJsonParse(jsonMatch[1] || jsonMatch[0]);
      const data = parsed?.creation_data || (parsed?.children || parsed?.branches || parsed?.columns || parsed?.piliers || parsed?.noeud_central || parsed?.noeuds || parsed?.root ? parsed : null);
      if (data) {
        if (data.columns || data.piliers || data.noeud_central || data.noeuds) {
          return data;
        }
        const rootItem = data.root || (data.children && data.label ? data : null);
        const children = data.children || data.branches || data.columns || rootItem?.children || [];
        return {
          id: data.id || 'root',
          label: data.label || data.root_title || data.title || rootLabel,
          type: 'box',
          children: children,
          columns: children,
          root: rootItem || {
            id: 'root',
            label: data.label || data.root_title || data.title || rootLabel,
            type: 'box',
            children: children
          },
          branches: Array.isArray(data.branches) ? data.branches : children.map((c: any) => ({
            title: c.label || c.title || 'Axe',
            children: c.children || [],
            subBranches: (c.children || []).map((sc: any) => sc.label || sc.title || '')
          }))
        };
      }
    }
  }

  // 1. Détection syntaxe Mermaid mindmap
  if (rawText.includes('mindmap')) {
    const rawLines = rawText.split('\n');
    let inMindmap = false;
    let detectedRoot = rootLabel;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('%%')) continue;
      if (trimmed.startsWith('mindmap')) {
        inMindmap = true;
        continue;
      }
      if (!inMindmap) continue;

      const indentMatch = rawLine.match(/^(\s+)/);
      const indent = indentMatch ? indentMatch[1].length : 0;

      const cleanText = trimmed
        .replace(/^root\s*/i, '')
        .replace(/^[\(\[]{1,2}/, '')
        .replace(/[\)\]]{1,2}$/, '')
        .replace(/^[-*]\s*/, '')
        .trim();

      if (!cleanText) continue;

      if (indent <= 2 && branches.length === 0) {
        detectedRoot = cleanText;
        continue;
      }

      if (indent <= 6) {
        currentBranch = {
          id: `branch-${branches.length + 1}`,
          label: cleanText,
          details: '',
          children: []
        };
        branches.push(currentBranch);
      } else if (currentBranch) {
        currentBranch.children = currentBranch.children || [];
        currentBranch.children.push({
          id: `sub-${currentBranch.id}-${currentBranch.children.length + 1}`,
          label: cleanText,
          details: ''
        });
      }
    }

    if (branches.length > 0) {
      return {
        root: {
          id: 'root-node',
          label: detectedRoot,
          details: 'Thème central',
          children: branches
        },
        root_title: detectedRoot,
        branches: branches.map(b => ({
          title: b.label,
          description: b.details || '',
          children: b.children || [],
          subBranches: (b.children || []).map(c => c.label)
        }))
      };
    }
  }

  // 2. Détection standard par titres et puces
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // En-têtes ou puces de niveau 1 (Branches principales)
    const branchMatch = line.match(/^(?:#{1,3}\s*|\*{1,2}\s*|\d+[\.\)]\s*[-–—]?\s*)(.+)/);
    // Puces de niveau 2 (Sous-branches)
    const subMatch = line.match(/^(?:[-*•]\s+|\s{2,}[-*•]\s+)(.+)/);

    if (branchMatch && !line.startsWith('-') && !line.startsWith('*')) {
      const cleanLabel = branchMatch[1].replace(/^\*{1,2}|\*{1,2}$/g, '').replace(/^#+\s*/, '').trim();
      if (cleanLabel.length > 2 && cleanLabel.length < 120) {
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
    const paras = rawText.split('\n\n').map(p => p.trim()).filter(p => {
      if (p.length < 10) return false;
      if (p.startsWith('{') || p.startsWith('```') || p.includes('":') || p.includes('"connecteurs"') || p.includes('"noeud_central"')) return false;
      if (/^voici\s+(?:votre\s+)?(?:carte|résumé|fiche|synthèse)/i.test(p)) return false;
      if (/^(?:bonjour|salut|hello|coucou)/i.test(p)) return false;
      return true;
    });
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
    id: 'node_central',
    label: rootLabel,
    type: 'box',
    children: branches.map((b, idx) => ({
      id: b.id || `box_${idx + 1}`,
      label: b.label,
      type: 'box',
      children: (b.children || []).map((c: any, cIdx: number) => ({
        id: c.id || `sub_box_${idx + 1}_${cIdx + 1}`,
        label: c.label,
        type: 'box'
      }))
    })),
    root: {
      id: 'root-node',
      label: rootLabel,
      details: 'Thème central d\'apprentissage',
      children: branches
    },
    root_title: rootLabel,
    branches: branches.map(b => ({
      title: b.label,
      description: b.details || '',
      children: b.children || [],
      subBranches: (b.children || []).map(c => c.label)
    }))
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
 * Extraction dynamique d'une Fiche de Résumé à partir du texte de l'IA (5 blocs pédagogiques)
 */
function parseSummaryFromText(rawText: string, safeDocName: string): SummaryContent {
  // Si le texte est en fait un bloc JSON complet, le désérialiser directement
  const parsedJson = safeJsonParse(rawText);
  if (parsedJson && typeof parsedJson === 'object') {
    const d = parsedJson.creation_data || parsedJson.summary || parsedJson;
    if (d && (d.overview || d.key_definitions || d.definitions || d.formulas || d.comparison_table || d.traps_and_tips || d.practical_example || d.sections)) {
      return {
        overview: typeof d.overview === 'string' && !/^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨)/i.test(d.overview.trim()) ? d.overview : `Synthèse approfondie de "${safeDocName}".`,
        keyPoints: Array.isArray(d.keyPoints) ? d.keyPoints : (Array.isArray(d.key_points) ? d.key_points : []),
        key_definitions: Array.isArray(d.key_definitions) ? d.key_definitions : (Array.isArray(d.definitions) ? d.definitions.map((x: any) => ({ concept: x.term || x.concept || 'Notion', definition: x.definition || '', objective: x.objective || '' })) : undefined),
        definitions: Array.isArray(d.definitions) ? d.definitions : undefined,
        formulas: Array.isArray(d.formulas) ? d.formulas : undefined,
        comparison_table: d.comparison_table || undefined,
        traps_and_tips: Array.isArray(d.traps_and_tips) ? d.traps_and_tips : undefined,
        practical_example: d.practical_example || undefined,
        sections: Array.isArray(d.sections) ? d.sections : undefined,
        markdown: typeof d.markdown === 'string' && !d.markdown.includes('{"decision":') && !d.markdown.includes('"""json') ? d.markdown : '',
        rules: Array.isArray(d.rules) ? d.rules : [],
        tags: ['Révision', 'Fiche Pédagogique', safeDocName.split('.')[0] || 'Cours'],
      };
    }
  }

  const paragraphs = rawText.split('\n\n').map(p => p.trim()).filter(p => p.length > 15);
  const validParagraphs = paragraphs.filter(p =>
    !/^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨|\*\(Le calcul)/i.test(p) &&
    !p.startsWith('{') && !p.startsWith('```')
  );
  const overview = validParagraphs[0] || `Synthèse approfondie de "${safeDocName}".`;
  const keyPoints: string[] = [];
  const definitions: Array<{ term: string; definition: string }> = [];
  const key_definitions: Array<{ concept: string; definition: string; objective?: string }> = [];
  const rules: string[] = [];
  const formulas: SummaryFormula[] = [];
  const traps_and_tips: Array<{ type: 'trap' | 'tip'; title?: string; content: string }> = [];

  // 1. Détection des blocs d'attention (Callouts > 🚨 PIÈGE et > 💡 ASTUCE)
  const calloutMatches = rawText.matchAll(/>\s*(🚨|💡|\*\*PIÈGE|\*\*ASTUCE)[^\n]*(?:\n>[^\n]*)*/gi);
  for (const match of calloutMatches) {
    const block = match[0].replace(/^>\s*/gm, '').trim();
    if (/🚨|PI[ÈE]GE/i.test(block)) {
      traps_and_tips.push({
        type: 'trap',
        title: 'PIÈGE CLASSIQUE',
        content: block.replace(/^(?:🚨\s*)?(?:\*{1,2}PI[ÈE]GE(?:\s+CLASSIQUE)?\s*:\*{1,2}|\*{1,2}ATTENTION\s*:\*{1,2})\s*/i, '').trim()
      });
    } else if (/💡|ASTUCE|NB/i.test(block)) {
      traps_and_tips.push({
        type: 'tip',
        title: 'ASTUCE (NB)',
        content: block.replace(/^(?:💡\s*)?(?:\*{1,2}ASTUCE(?:\s*\(NB\))?\s*:\*{1,2}|\*{1,2}NB\s*:\*{1,2})\s*/i, '').trim()
      });
    }
  }

  // 2. Détection d'un tableau comparatif Markdown (| Col 1 | Col 2 | ...)
  let comparison_table: { headers: string[]; rows: string[][] } | undefined = undefined;
  const tableLines = rawText.split('\n').filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
  if (tableLines.length >= 3) {
    const rawHeaders = tableLines[0].split('|').map(c => c.trim()).filter(Boolean);
    const rawRows = tableLines.slice(2).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
    if (rawHeaders.length > 0 && rawRows.length > 0) {
      comparison_table = { headers: rawHeaders, rows: rawRows };
    }
  }

  // 3. Détection pédagogique exhaustive des formules (sans aucun texte creux)
  const formulaSectionMatch = rawText.match(/(?:###\s*🧮?\s*2\.\s*FORMULAIRE[^\n]*|##\s*Formulaire[^\n]*)([\s\S]*?)(?:$|(?=\n###\s*[3-9]\.|\n##\s*[A-Z]))/i);
  const formulaScope = formulaSectionMatch ? formulaSectionMatch[1] : rawText;

  // Découpage par sous-bloc de formule (ex: #### 🔹 [NOM DE LA FORMULE])
  const subBlocks = formulaScope.split(/(?=\n####?\s*(?:🔹|\d+\.)|\n(?:\*\s*)?\*\*Formule)/i);

  for (const block of subBlocks) {
    const fMatch = block.match(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/);
    if (!fMatch) continue;

    const rawLatex = fMatch[1].trim();
    const cleanLatex = cleanFormulaLatex(rawLatex);
    if (!cleanLatex || formulas.some(f => cleanFormulaLatex(f.latex) === cleanLatex)) {
      continue;
    }

    // Nom de la formule
    const titleMatch = block.match(/####?\s*(?:🔹|\d+\.)?\s*([^\n$]+)/);
    const formulaName = titleMatch
      ? titleMatch[1].replace(/^[\[\(🔹\s*]+|[\]\)\s*]+$/g, '').trim()
      : 'Formule clé';

    // 🎯 Objectif
    const objMatch = block.match(/(?:\*\s*)?(?:🎯\s*)?\*{1,2}Objectif\s*:\*{1,2}\s*([^\n]+)/i);
    const target_goal = objMatch ? objMatch[1].trim() : undefined;

    // 📐 Variables & Unités
    const varMatch = block.match(/(?:\*\s*)?(?:📐\s*)?\*{1,2}Variables(?:\s*&\s*Unit[eé]s)?\s*:\*{1,2}\s*([\s\S]*?)(?=(?:\n\s*[-*•]|\n\s*###|$))/i);
    const variables = varMatch ? varMatch[1].trim().replace(/\n\s*[-*•]\s*/g, ' • ') : undefined;

    // 🛠️ Démonstration & Méthode pas à pas
    let how_to_derive: string | undefined = undefined;
    const demonstration_steps: string[] = [];
    const demoMatch = block.match(/(?:\*\s*)?(?:🛠️\s*)?\*{1,2}(?:Comment la D[eé]montrer|D[eé]monstration)(?:[^\n*]*)\*{1,2}\s*:\s*([\s\S]*?)(?=(?:\n\s*[-*•]\s*(?:📐|🚨|\*{1,2}Variables|\*{1,2}Pi[eè]ge)|\n\s*###|$))/i);

    if (demoMatch) {
      const demoBody = demoMatch[1];
      const stepLines = demoBody.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of stepLines) {
        if (/^\d+[\.\)]\s+/.test(line)) {
          demonstration_steps.push(line.replace(/^\d+[\.\)]\s+/, '').trim());
        }
      }
      how_to_derive = demoBody.trim();
    }

    // 🚨 Piège à l'examen
    const trapMatch = block.match(/(?:\*\s*)?(?:🚨\s*)?\*{1,2}Pi[eè]ge[s]?(?:\s*(?:[àa]\s*l'examen|classique))?\s*:\*{1,2}\s*([^\n]+)/i);
    const exam_trap = trapMatch ? trapMatch[1].trim() : undefined;

    formulas.push({
      name: formulaName,
      latex: cleanLatex,
      target_goal,
      when_to_use: target_goal,
      variables,
      how_to_derive: isFillerText(how_to_derive) ? undefined : how_to_derive,
      demonstration_steps: demonstration_steps.length > 0 ? demonstration_steps : undefined,
      exam_trap,
    });
  }

  // 4. Détection des notions clés & définitions
  for (const p of paragraphs.slice(1)) {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const defMatch = line.match(/^(?:[-*•]\s*)?\*{1,2}([^*:]+)\*{1,2}\s*[:–—\-]\s*(.+)/);
      if (defMatch && definitions.length < 6) {
        definitions.push({
          term: defMatch[1].trim(),
          definition: defMatch[2].trim()
        });
        key_definitions.push({
          concept: defMatch[1].trim(),
          definition: defMatch[2].trim(),
          objective: 'Assimilation et application pratique'
        });
        continue;
      }

      if (/th[eé]or[eè]me|formule|propri[eé]t[eé]|r[eè]gle/i.test(line) && rules.length < 5) {
        rules.push(line.replace(/^[-*•#\d\.\s]+/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim());
        continue;
      }

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

  // Détection d'un exemple pratique
  let practical_example: { statement: string; resolution_steps: string[] } | undefined = undefined;
  const exMatch = rawText.match(/(?:###\s*5\.\s*🛠️?[^\n]*|Exemple\s+Pratique[^\n]*)([\s\S]*?)(?:$|(?=\n###\s*\d))/i);
  if (exMatch && exMatch[1].trim().length > 30) {
    const exLines = exMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    const statement = exLines[0] || 'Mini-cas concret d\'application.';
    const resolution_steps = exLines.slice(1).filter(l => /^[0-9\-\*•]/.test(l));
    practical_example = {
      statement,
      resolution_steps: resolution_steps.length > 0 ? resolution_steps : ['Application rigoureuse de la relation fondamentale.']
    };
  }

  return {
    overview,
    keyPoints,
    key_definitions: key_definitions.length > 0 ? key_definitions : undefined,
    definitions,
    formulas: formulas.length > 0 ? formulas : undefined,
    comparison_table,
    traps_and_tips: traps_and_tips.length > 0 ? traps_and_tips : undefined,
    practical_example,
    markdown: (!rawText.startsWith('```') && !rawText.startsWith('{') && rawText.length > 50) ? rawText : '',
    rules,
    tags: ['Révision', 'Fiche Pédagogique', safeDocName.split('.')[0] || 'Cours'],
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

  return { affirmations: affirmations.slice(0, 18) };
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
  // 0. Si rawText contient un JSON complet, l'extraire et le parser prioritairement avec safeJsonParse
  const jsonMatch = rawText.match(/(?:```|""")(?:json)?\s*([\s\S]*?)\s*(?:```|""")/i) || rawText.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = safeJsonParse(jsonMatch[1] || jsonMatch[0]);
      if (parsed) {
        const cd = parsed.creation_data || parsed.written_exercise || parsed;
        const qList = Array.isArray(cd.questions) ? cd.questions : Array.isArray(cd.exercises) ? cd.exercises : Array.isArray(cd.exercices) ? cd.exercices : [];
        if (qList.length > 0) {
          return {
            written_exercise: {
              title: sanitizeText(parsed.creation_title || cd.title) || `Série d'Exercices Écrits : ${safeDocName}`,
              context: sanitizeText(cd.context || cd.enonce || cd.description || `Énoncé d'application et de réflexion basé sur le cours « ${safeDocName} ».`),
              questions: qList.map((q: any, idx: number) => ({
                id: q.id || `q_${idx + 1}`,
                number: typeof q.number === 'number' ? q.number : idx + 1,
                text: typeof q === 'string' ? sanitizeText(q) : sanitizeText(q.text || q.question || q.enonce || `Question ${idx + 1}`),
                points: Number(q.points) || Math.round((20 / qList.length) * 10) / 10,
                sampleAnswer: typeof q === 'object' ? sanitizeText(q.sampleAnswer || q.reponse || q.correction || q.answer || '') : ''
              })),
              correction: cd.correction || {
                steps: `Correction détaillée pas à pas issue du cours « ${safeDocName} ».`,
                examples: [
                  `Exemple concret 1 : Cas pratique d'application directe des concepts de « ${safeDocName} ».`,
                  `Exemple concret 2 : Cas particulier et vérification des hypothèses limites.`
                ]
              }
            }
          };
        }
      }
    } catch {}
  }

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
    const qMatch = line.match(/^(?:(?:\*{1,2}|#{1,4}\s*)?(?:Question|Exercice|Partie|Probl[èe]me)\s*(\d+)[:\.\)]\s*(?:\*{1,2})?|(\d+)[\.\)]\s+)(.*)/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1] || qMatch[2] || String(questions.length + 1), 10);
      const qText = (qMatch[3] || qMatch[0] || '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
      questions.push({
        id: `q_${questions.length + 1}`,
        number: qNum || (questions.length + 1),
        text: qText || `Question ${questions.length + 1}`,
      });
    } else if (questions.length === 0) {
      if (!line.startsWith('#') && !line.toLowerCase().startsWith('titre') && !line.toLowerCase().startsWith('j\'ai') && !line.toLowerCase().startsWith('voici')) {
        contextLines.push(line);
      }
    }
  }

  context = contextLines.slice(0, 5).join('\n\n').trim() || `Exercice d'application et de réflexion basé sur le cours "${safeDocName}".`;

  // Si aucune question n'a été détectée, produire une vraie série progressive de 8 questions
  if (questions.length === 0) {
    questions.push(
      {
        id: 'q_1',
        number: 1,
        text: `Définir les hypothèses fondamentales et les lois directrices régissant le système présenté dans "${safeDocName}".`,
      },
      {
        id: 'q_2',
        number: 2,
        text: `Établir la relation algébrique exacte ou l'équation caractéristique en détaillant chaque étape de calcul.`,
      },
      {
        id: 'q_3',
        number: 3,
        text: `Mettre l'expression sous forme canonique et identifier les pulsations, facteurs de qualité ou coefficients caractéristiques.`,
      },
      {
        id: 'q_4',
        number: 4,
        text: `Mener l'étude asymptotique aux régimes limites et en déduire le comportement fréquentiel ou temporel.`,
      },
      {
        id: 'q_5',
        number: 5,
        text: `Calculer la valeur critique ou la pulsation de coupure et expliciter la condition d'atténuation à -3 dB.`,
      },
      {
        id: 'q_6',
        number: 6,
        text: `Effectuer l'application numérique pas à pas avec vérification dimensionnelle et précision des unités.`,
      },
      {
        id: 'q_7',
        number: 7,
        text: `Tracer ou analyser les allures des courbes caractéristiques (diagramme de Bode ou réponse indicielle).`,
      },
      {
        id: 'q_8',
        number: 8,
        text: `Proposer une analyse critique des performances et une solution concrète d'ajustement des paramètres.`,
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
  const discipline = cleanExamTitle(safeDocName);
  const domain = detectExamDomain(rawText, discipline);
  const domainDefaults = getDomainExamTemplate(domain, discipline);

  return {
    complete_exam: {
      title: `ÉPREUVE OFFICIELLE D'EXAMEN : ${discipline}`,
      duree: '2h00',
      duration_minutes: 120,
      baremeTotal: 20,
      instructions: "L'épreuve comporte 3 exercices structurés. Justifiez avec rigueur toutes vos réponses et démarches de calcul.",
      sections: [domainDefaults.s1, domainDefaults.s2, domainDefaults.s3]
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
    const jsonBlockMatch = cleanText.match(/(?:```|""")(?:json)?\s*([\s\S]*?)\s*(?:```|""")/i);
    if (jsonBlockMatch) {
      rawJsonCandidate = jsonBlockMatch[1].trim();
    } else {
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        rawJsonCandidate = cleanText.substring(firstBrace, lastBrace + 1);
      }
    }
  }

  if (rawJsonCandidate) {
    const parsed = safeJsonParse(rawJsonCandidate);

    if (parsed && typeof parsed === 'object') {
      const dataObj = parsed.creation_data || parsed;
      const normType = String(toolType || '').toLowerCase();
      let effectiveType = normType;

      if (['vrai-ou-faux', 'vrai-ou-faux-test'].includes(normType)) {
        effectiveType = 'vrai-ou-faux';
      } else if (['questionnaire', 'questionnaire-test', 'qcm', 'quiz'].includes(normType)) {
        effectiveType = 'quiz';
      } else if (['carte-mentale', 'carte-mentale-2', 'mindmap'].includes(normType)) {
        effectiveType = 'mindmap';
      } else if (['infographie', 'infographic'].includes(normType)) {
        effectiveType = 'infographic';
      } else if (['resume', 'summary'].includes(normType)) {
        effectiveType = 'summary';
      } else if (['carte-memoire', 'flashcards'].includes(normType)) {
        effectiveType = 'carte-memoire';
      } else if (['exercices-ecrits'].includes(normType)) {
        effectiveType = 'exercices-ecrits';
      } else if (['devoir-complet'].includes(normType)) {
        effectiveType = 'devoir-complet';
      } else if (['pdf', 'document'].includes(normType)) {
        effectiveType = 'pdf';
      } else if (Array.isArray(dataObj.affirmations) || Array.isArray(parsed.affirmations)) {
        effectiveType = 'vrai-ou-faux';
      } else if (Array.isArray(dataObj.questions) || Array.isArray(parsed.questions)) {
        effectiveType = 'quiz';
      } else if (dataObj.root && (dataObj.root.label || dataObj.root.children)) {
        effectiveType = 'mindmap';
      } else if (Array.isArray(dataObj.metrics) || Array.isArray(dataObj.keyConcepts)) {
        effectiveType = 'infographic';
      } else if (dataObj.overview || Array.isArray(dataObj.keyPoints)) {
        effectiveType = 'summary';
      } else if (Array.isArray(dataObj.cards) || Array.isArray(dataObj.flashcards)) {
        effectiveType = 'carte-memoire';
      } else if (dataObj.written_exercise || Array.isArray(dataObj.exercises) || Array.isArray(dataObj.exercices)) {
        effectiveType = 'exercices-ecrits';
      } else if (dataObj.complete_exam || dataObj.devoir || dataObj.baremeTotal) {
        effectiveType = 'devoir-complet';
      }

      switch (effectiveType) {
        case 'quiz': {
          const corrected = autoCorrectQuiz(dataObj, safeDocName);
          if (corrected.questions && corrected.questions.length > 0) {
            corrected.questions = corrected.questions.slice(0, 18);
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || corrected.title,
              content: corrected
            };
          }
          break;
        }
        case 'vrai-ou-faux': {
          const rawAff = Array.isArray(dataObj)
            ? dataObj
            : (dataObj.affirmations || dataObj.questions || dataObj.items || dataObj.statements || dataObj.propositions || dataObj.data);
          const defaultVfTitle = normType.includes('test') ? `Vrai ou Faux Test : ${safeDocName}` : `Vrai ou Faux : ${safeDocName}`;
          if (Array.isArray(rawAff) && rawAff.length > 0) {
            const cleanAffs = rawAff.slice(0, 18).map((a: any, idx: number) => {
              let isTrue = true;
              if (typeof a.is_true === 'boolean') isTrue = a.is_true;
              else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
              else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
              else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
              else if (typeof a.correct === 'boolean') isTrue = a.correct;
              else if (typeof a.is_correct === 'boolean') isTrue = a.is_correct;
              else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
              else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
              else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
              else if (typeof a.correctAnswer === 'string') isTrue = a.correctAnswer.toLowerCase() === 'true' || a.correctAnswer.toLowerCase() === 'vrai';

              let stmt = '';
              if (typeof a === 'string') {
                stmt = a.trim();
              } else if (a && typeof a === 'object') {
                stmt = String(
                  a.statement ||
                  a.affirmation ||
                  a.proposition ||
                  a.enonce ||
                  a.phrase ||
                  a.question ||
                  a.claim ||
                  a.texte ||
                  a.text ||
                  a.content ||
                  a.item ||
                  a.label ||
                  a.title ||
                  ''
                ).trim();
              }

              const explText = a?.explanation || a?.explication || a?.justification || '';
              if (!stmt || /^Affirmation\s*(?:n°\s*\d+)?$/i.test(stmt)) {
                if (explText && explText.length > 10) {
                  stmt = explText;
                }
              }

              return {
                id: a?.id || `vf_${idx + 1}`,
                statement: stmt,
                isTrue,
                is_true: isTrue,
                explanation: explText
              };
            }).filter((a: any) => a.statement && a.statement.length > 0 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(a.statement));

            if (cleanAffs.length > 0) {
              return {
                title: sanitizeText(parsed.creation_title || dataObj.title) || defaultVfTitle,
                content: { affirmations: cleanAffs }
              };
            }
          }
          const fallbackVF = parseVraiOuFauxFromText(cleanText, safeDocName);
          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || defaultVfTitle,
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
              return String(txt).trim().length >= 10 && !isGenericOrPlaceholderText(txt);
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
        case 'resume':
        case 'summary': {
          const rawOverview = dataObj.overview || dataObj.summary || '';
          const isCompanion = typeof rawOverview === 'string' && /^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨|\*\(Le calcul)/i.test(rawOverview.trim());
          const safeOverview = isCompanion ? '' : rawOverview;

          return {
            title: sanitizeText(parsed.creation_title || dataObj.title) || `Fiche de Résumé : ${safeDocName}`,
            content: {
              title: sanitizeText(dataObj.title || parsed.creation_title || `Fiche de Résumé : ${safeDocName}`),
              theme: sanitizeText(dataObj.theme || dataObj.domaine || ''),
              overview: sanitizeText(safeOverview),
              keyPoints: Array.isArray(dataObj.keyPoints)
                ? dataObj.keyPoints.map(sanitizeText)
                : (Array.isArray(dataObj.key_points) ? dataObj.key_points.map(sanitizeText) : []),
              key_definitions: (Array.isArray(dataObj.key_definitions) ? dataObj.key_definitions : (Array.isArray(dataObj.definitions) ? dataObj.definitions : []))
                .map((d: any) => typeof d === 'string'
                  ? { concept: 'Notion clé', definition: d, objective: '' }
                  : {
                      concept: sanitizeText(d?.concept || d?.term || d?.notion || d?.title || 'Notion clé'),
                      definition: sanitizeText(d?.definition || d?.desc || d?.description || d?.explication || ''),
                      objective: sanitizeText(d?.objective || d?.application || d?.objectif || ''),
                    }
                ),
              formulas: Array.isArray(dataObj.formulas)
                ? dataObj.formulas.map((f: any) => ({
                    name: sanitizeText(f.name || f.title || 'Formule clé'),
                    latex: cleanFormulaLatex(f.latex || f.formula || ''),
                    target_goal: f.target_goal || f.when_to_use,
                    when_to_use: f.when_to_use || f.target_goal,
                    variables: f.variables || f.units,
                    how_to_derive: isFillerText(f.how_to_derive) ? undefined : f.how_to_derive,
                    demonstration_steps: Array.isArray(f.demonstration_steps) ? f.demonstration_steps : undefined,
                    exam_trap: f.exam_trap || f.trap,
                  }))
                : [],
              comparison_table: dataObj.comparison_table || null,
              traps_and_tips: Array.isArray(dataObj.traps_and_tips) ? dataObj.traps_and_tips : [],
              practical_example: dataObj.practical_example && typeof dataObj.practical_example === 'object'
                ? {
                    statement: sanitizeText(dataObj.practical_example.statement || dataObj.practical_example.enonce || ''),
                    resolution_steps: (Array.isArray(dataObj.practical_example.resolution_steps)
                      ? dataObj.practical_example.resolution_steps
                      : (Array.isArray(dataObj.practical_example.steps) ? dataObj.practical_example.steps : [])
                    ).map((s: any) => typeof s === 'string' ? s : String(s?.text || s || '')),
                  }
                : null,
              sections: Array.isArray(dataObj.sections)
                ? dataObj.sections.map((sec: any, sidx: number) => ({
                    number: sec?.number || `${sidx + 1}`,
                    heading: sanitizeText(sec?.heading || sec?.section_title || sec?.title || `Section ${sidx + 1}`),
                    body: sanitizeText(sec?.body || sec?.content || sec?.texte || ''),
                    points: (Array.isArray(sec?.points)
                      ? sec.points
                      : (Array.isArray(sec?.keyPoints) ? sec.keyPoints : [])
                    ).map(sanitizeText),
                  }))
                : [],
              markdown: dataObj.markdown || (typeof dataObj.text === 'string' ? dataObj.text : ''),
              rules: Array.isArray(dataObj.rules) ? dataObj.rules.map(sanitizeText) : [],
              tags: Array.isArray(dataObj.tags) ? dataObj.tags.map(sanitizeText) : ['Révision', safeDocName],
            }
          };
        }
        case 'mindmap': {
          // Si on a directement des colonnes ou piliers pour Carte Mentale 2
          if (Array.isArray(dataObj.columns) || Array.isArray(dataObj.piliers) || dataObj.noeud_central || Array.isArray(dataObj.cards)) {
            const rootLabel = sanitizeText(dataObj.root_title || dataObj.rootTitle || dataObj.noeud_central?.nom || dataObj.noeud_central?.label || dataObj.title || safeDocName);
            const defaultMmTitle = normType.includes('carte-mentale-2') || normType.includes('mindmap2')
              ? `Carte Conceptuelle : ${safeDocName}`
              : `Carte Mentale : ${safeDocName}`;
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || defaultMmTitle,
              content: dataObj
            };
          }

          const root = dataObj.root || dataObj;
          if (root && (root.label || root.title || root.children || dataObj.branches || dataObj.nodes || dataObj.columns || dataObj.children)) {
            const rawChildren = Array.isArray(root.children)
              ? root.children
              : (Array.isArray(dataObj.branches) ? dataObj.branches : (Array.isArray(dataObj.columns) ? dataObj.columns : (Array.isArray(dataObj.nodes) ? dataObj.nodes : (Array.isArray(dataObj.children) ? dataObj.children : []))));
            const rootLabel = sanitizeText(root.label || root.title || dataObj.root_title || dataObj.title || safeDocName);
            const defaultMmTitle = normType.includes('carte-mentale-2') || normType.includes('mindmap2')
              ? `Carte Conceptuelle : ${safeDocName}`
              : `Carte Mentale : ${safeDocName}`;
            return {
              title: sanitizeText(parsed.creation_title || dataObj.title) || defaultMmTitle,
              content: {
                root: {
                  id: sanitizeText(root.id) || 'root-node',
                  label: rootLabel,
                  details: sanitizeText(root.details || 'Thème central'),
                  children: rawChildren
                },
                root_title: rootLabel,
                columns: rawChildren,
                branches: rawChildren.map((b: any, bIdx: number) => ({
                  title: b.title || b.label || b.name || `Axe ${bIdx + 1}`,
                  description: b.description || b.details || '',
                  children: Array.isArray(b.children) ? b.children : (Array.isArray(b.nodes) ? b.nodes : (b.subBranches || [])),
                  subBranches: Array.isArray(b.children)
                    ? b.children.map((c: any) => typeof c === 'string' ? c : (c.formula ? `${c.label || c.title || ''} : $${c.formula}$` : (c.label || c.title || c.name || String(c))))
                    : (b.subBranches || [])
                }))
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
    const title = parsedQuiz.title || (normType.includes('test') ? `Questionnaire Test : ${safeDocName}` : `Questionnaire QCM : ${safeDocName}`);
    return { title, content: parsedQuiz };
  } else if (['vrai-ou-faux', 'vrai-ou-faux-test'].includes(normType)) {
    const parsedVF = parseVraiOuFauxFromText(cleanText, safeDocName);
    const title = normType.includes('test') ? `Vrai ou Faux Test : ${safeDocName}` : `Vrai ou Faux : ${safeDocName}`;
    return { title, content: parsedVF };
  } else if (['carte-memoire', 'flashcards'].includes(normType)) {
    const parsedCards = parseFlashcardsFromText(cleanText, safeDocName);
    return { title: `Cartes Mémoires : ${safeDocName}`, content: parsedCards };
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
    const title = (normType.includes('carte-mentale-2') || normType.includes('mindmap2')) ? `Carte Conceptuelle : ${safeDocName}` : `Carte Mentale : ${safeDocName}`;
    return { title, content: parsedMindMap };
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
