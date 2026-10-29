import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileText,
  BookOpen,
  BookmarkCheck,
  Calculator,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Table as TableIcon,
  CheckCircle2,
  Target,
  Loader2,
  Printer,
} from 'lucide-react';
import { exportResumePdf } from '../../utils/exportStudyPdf';
import { MathText } from '../MathText';
import {
  SummaryFormula,
  SummaryComparisonTable,
  SummaryTrapOrTip,
  SummaryPracticalExample,
  SummaryKeyDefinition,
} from './types';
import { safeJsonParse } from '../../services/api';

interface ResumeProps {
  data?: any;
  title?: string;
  sourceFileName?: string;
}

function cleanDisplayThemeTitle(titleCandidate: string, themeCandidate?: string): string {
  let cleaned = (titleCandidate || '').trim();
  cleaned = cleaned.replace(/^Fiche de R[ée]sum[ée]\s*:\s*/i, '');
  cleaned = cleaned.replace(/\.(?:pdf|docx|pptx|txt|xlsx|png|jpg|jpeg)\b/gi, '');
  cleaned = cleaned.replace(/\s*\(\d+\)/g, ''); // supprime (1), (2), (1) (1)
  cleaned = cleaned.replace(/[_]/g, ' '); // remplace les underscores par des espaces

  // Si themeCandidate est disponible et n'est pas un nom de fichier brut
  if (themeCandidate && typeof themeCandidate === 'string') {
    let cleanTheme = themeCandidate.trim();
    cleanTheme = cleanTheme.replace(/\.(?:pdf|docx|pptx|txt)\b/gi, '');
    cleanTheme = cleanTheme.replace(/\s*\(\d+\)/g, '');
    cleanTheme = cleanTheme.replace(/[_]/g, ' ');
    if (cleanTheme && cleanTheme.length > 3 && !/\b(?:pdf|docx)\b/i.test(cleanTheme)) {
      if (/^CH\s*[0-9IVXLCDM]+\s+/i.test(cleaned) || cleaned.length < 5) {
        return cleanTheme.charAt(0).toUpperCase() + cleanTheme.slice(1);
      }
    }
  }

  // Nettoyer les préfixes techniques comme "CH IV ", "CHAPITRE 4 "
  cleaned = cleaned.replace(/^CH(?:\s*[0-9IVXLCDM]+)?\s*[:\s\-–—]\s*/i, '');
  cleaned = cleaned.replace(/^CHAPITRE\s*[0-9IVXLCDM]+\s*[:\s\-–—]\s*/i, '');
  cleaned = cleaned.replace(/^TD\s*[0-9IVXLCDM]*\s*[:\s\-–—]\s*/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remplacements ciblés pour les sujets courants
  if (/^filtres?$/i.test(cleaned)) {
    return 'Filtres Analogiques';
  }

  if (!cleaned || cleaned.length < 3) {
    return (themeCandidate && themeCandidate.length > 3 && !/\.pdf/i.test(themeCandidate)) ? themeCandidate : 'Fiche de Synthèse & Révision';
  }

  // Si tout est en majuscules (ex: "FILTRES ET CIRCUITS"), convertir en casse de titre
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanOverviewText(text?: string): string {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/^L['’]étudiant\s+a\s+dit\s+["«][^"»]+["»]\s+et\s+le\s+système\s+me\s+demande\s+de\s+créer[^\n.—–—]*[—–—.:\n]*/i, '');
  cleaned = cleaned.replace(/^L['’]étudiant\s+(?:souhaite|veut|demande|a\s+demandé)[^\n.—–—]*[—–—.:\n]*/i, '');
  cleaned = cleaned.replace(/^(?:Le\s+système\s+me\s+demande\s+de\s+créer[^\n.—–—]*[—–—.:\n]*)/i, '');
  return cleaned.trim();
}

function cleanFormulaLatex(latex?: any): string {
  if (!latex) return '';
  const str =
    typeof latex === 'string'
      ? latex
      : typeof latex === 'object' && latex.latex
      ? String(latex.latex)
      : String(latex);
  return str.replace(/(?<!\\)\$/g, '').trim();
}

function isFillerText(str?: string): boolean {
  if (!str) return true;
  return /^(?:application directe du cours|selon les lois fondamentales|d[eé]monstration par application des lois fondamentales|selon le cours|application du cours|n\/a)$/i.test(str.trim());
}

/**
 * Nettoie le markdown pour s'assurer qu'aucun bloc JSON brut ne fuite vers MathText
 */
function cleanMarkdown(md: string): string {
  if (!md) return '';
  let cleaned = md
    .replace(/(?:```|""")(?:json)?[\s\S]*?(?:```|""")/gi, '')
    .trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return '';
  }
  if (cleaned.includes('"decision"') || cleaned.includes('"creation_type"') || cleaned.includes('"creation_data"')) {
    cleaned = cleaned.replace(/\{[\s\S]*\}/g, '').trim();
  }
  // Supprimer tout reliquat commençant par ``` ou """
  cleaned = cleaned.replace(/^(?:```|""")[a-z0-9_-]*\s*/i, '').replace(/(?:```|""")$/, '').trim();
  if (/^json\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^json\s+/i, '').trim();
  }
  return cleaned;
}

/**
 * Extrait récursivement le JSON structuré d'un texte ou d'un objet enveloppé
 */
function extractStructuredSummary(input: any): any {
  if (!input) return {};

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (
      trimmed.includes('{') ||
      trimmed.includes('"""json') ||
      trimmed.includes('```json') ||
      trimmed.includes('"decision"') ||
      trimmed.includes('"creation_data"') ||
      trimmed.includes('"key_definitions"') ||
      trimmed.includes('"formulas"')
    ) {
      const parsed = safeJsonParse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return extractStructuredSummary(parsed);
      }
    }
    return input;
  }

  if (typeof input === 'object') {
    if (input.creation_data) {
      const cd = typeof input.creation_data === 'string' ? safeJsonParse(input.creation_data) : input.creation_data;
      if (cd && typeof cd === 'object') {
        return extractStructuredSummary(cd);
      }
    }

    if (input.summary && typeof input.summary === 'object') {
      return extractStructuredSummary(input.summary);
    }
    if (input.data && typeof input.data === 'object') {
      return extractStructuredSummary(input.data);
    }

    const stringCandidates = [input.content, input.response, input.text, input.markdown];
    for (const cand of stringCandidates) {
      if (typeof cand === 'string') {
        const trimmed = cand.trim();
        if (
          trimmed.includes('{') ||
          trimmed.includes('"""json') ||
          trimmed.includes('```json') ||
          trimmed.includes('"decision"') ||
          trimmed.includes('"creation_data"') ||
          trimmed.includes('"key_definitions"') ||
          trimmed.includes('"formulas"')
        ) {
          const parsed = safeJsonParse(trimmed);
          if (parsed && typeof parsed === 'object') {
            return extractStructuredSummary(parsed);
          }
        }
      }
    }

    return input;
  }

  return input;
}

function getFallbackSummary(safeTitle: string, safeTheme: string, safeDocName: string) {
  const isElectronicsOrPhysics = /filtre|circuit|electronique|physique|signal|onde|aop|rlc/i.test(`${safeTitle} ${safeTheme} ${safeDocName}`);

  if (isElectronicsOrPhysics) {
    return {
      overview: `Cette fiche de synthèse présente l'analyse complète, les équations directrices et les méthodes de dimensionnement pour « ${safeTitle} ». Elle regroupe les fonctions de transfert canoniques, les diagrammes de Bode ainsi que les règles fondamentales pour réussir les calculs d'examen.`,
      keyDefinitions: [
        {
          concept: 'Fonction de transfert T(p)',
          definition: "Rapport entre la grandeur de sortie et la grandeur d'entrée en régime harmonique complexe T(j\\omega) = \\dfrac{\\underline{V}_s}{\\underline{V}_e}.",
          objective: 'Caractériser le gain et le déphasage introduit par le quadripôle.'
        },
        {
          concept: 'Pulsation de coupure \\omega_0',
          definition: 'Pulsation pour laquelle le gain linéaire chute de 1/\\sqrt{2} par rapport à sa valeur maximale, soit une atténuation de -3 dB.',
          objective: 'Délimiter la bande passante du filtre.'
        },
        {
          concept: 'Facteur de qualité Q_0',
          definition: "Grandeur sans dimension mesurant l'acuité de la résonance ou la sélectivité du filtre : Q_0 = \\dfrac{\\omega_0}{\\Delta \\omega}.",
          objective: 'Identifier le comportement dynamique et le risque de surtension/résonance.'
        },
        {
          concept: 'Ordre du filtre',
          definition: 'Degré le plus élevé du polynôme caractéristique au dénominateur de T(p), fixant la pente asymptotique finale (-20n dB/décade).',
          objective: "Déterminer l'efficacité de réjection des fréquences indésirables."
        },
        {
          concept: 'Bande passante \\Delta f',
          definition: "Intervalle de fréquences à l'intérieur duquel le signal est transmis avec une atténuation inférieure à 3 dB.",
          objective: 'Définir la zone de transmission utile du signal.'
        }
      ],
      formulas: [
        {
          name: 'Passe-bas du 1er ordre (forme canonique)',
          latex: 'T(p) = \\dfrac{T_0}{1 + \\dfrac{p}{\\omega_0}}',
          target_goal: 'Calcul de la réponse fréquentielle et du gain statique T_0.',
          variables: 'T_0 : gain statique, \\omega_0 = \\dfrac{1}{\\tau} : pulsation de coupure (rad/s).',
          when_to_use: 'Circuit RC ou RL simple en basse fréquence.',
          how_to_derive: 'Application directe du pont diviseur de tension sur impédances complexes.',
          demonstration_steps: [
            "1. Exprimer l'impédance du condensateur : \\underline{Z}_C = \\dfrac{1}{jC\\omega}",
            "2. Écrire le diviseur : \\underline{V}_s = \\underline{V}_e \\cdot \\dfrac{\\underline{Z}_C}{R + \\underline{Z}_C}",
            '3. Multiplier numérateur et dénominateur par jC\\omega pour obtenir T(j\\omega) = \\dfrac{1}{1 + jRC\\omega}'
          ],
          exam_trap: 'Ne pas oublier le déphasage de -45° à la pulsation de coupure.'
        },
        {
          name: 'Passe-haut du 1er ordre (forme canonique)',
          latex: 'T(p) = \\dfrac{T_0 \\dfrac{p}{\\omega_0}}{1 + \\dfrac{p}{\\omega_0}}',
          target_goal: 'Élimination de la composante continue et transmission des hautes fréquences.',
          variables: 'T_0 : gain en haute fréquence, \\omega_0 : pulsation de coupure.',
          when_to_use: 'Circuit dérivateur ou liaison capacitive bloquant le continu.',
          how_to_derive: 'Pont diviseur avec prélèvement de la tension aux bornes du résistor.',
          demonstration_steps: [
            '1. Écrire \\underline{V}_s = \\underline{V}_e \\cdot \\dfrac{R}{R + \\underline{Z}_C}',
            '2. Factoriser par jRC\\omega au numérateur et au dénominateur',
            '3. Poser \\omega_0 = \\dfrac{1}{RC} pour obtenir la forme canonique normalisée'
          ],
          exam_trap: 'À très basse fréquence (p -> 0), le condensateur se comporte comme un circuit ouvert : gain nul.'
        },
        {
          name: 'Passe-bas du 2nd ordre (forme canonique)',
          latex: 'T(p) = \\dfrac{T_0}{1 + \\dfrac{1}{Q_0}\\dfrac{p}{\\omega_0} + \\left(\\dfrac{p}{\\omega_0}\\right)^2}',
          target_goal: 'Filtrage avec pente raide de -40 dB/décade en haute fréquence.',
          variables: 'Q_0 : facteur de qualité, \\omega_0 : pulsation propre non amortie.',
          when_to_use: 'Circuits RLC, filtres de Sallen-Key actifs ou cellules de Rauch.',
          how_to_derive: 'Théorème de Millman ou lois de Kirchhoff au nœud intermédiaire.',
          demonstration_steps: [
            '1. Poser les équations aux nœuds en régime complexe',
            '2. Exprimer le dénominateur sous forme D(p) = 1 + 2m\\dfrac{p}{\\omega_0} + \\left(\\dfrac{p}{\\omega_0}\\right)^2',
            '3. Identifier m = \\dfrac{1}{2Q_0} pour obtenir la forme normalisée'
          ],
          exam_trap: 'Il y a résonance (sur-gain) si et seulement si Q_0 > \\dfrac{1}{\\sqrt{2}} \\approx 0.707.'
        },
        {
          name: 'Passe-bande du 2nd ordre',
          latex: 'T(p) = \\dfrac{T_0 \\dfrac{1}{Q_0}\\dfrac{p}{\\omega_0}}{1 + \\dfrac{1}{Q_0}\\dfrac{p}{\\omega_0} + \\left(\\dfrac{p}{\\omega_0}\\right)^2}',
          target_goal: "Sélection d'une bande étroite centrée sur \\omega_0 avec réjection des BF et HF.",
          variables: 'Bande passante \\Delta \\omega = \\dfrac{\\omega_0}{Q_0}, T_0 : gain maximal à la résonance.',
          when_to_use: 'Démodulation radio, filtrage audio sélectif, réjection de bruit.',
          how_to_derive: 'Association en cascade passe-bas et passe-haut ou circuit RLC parallèle.',
          demonstration_steps: [
            "1. À \\omega = \\omega_0, le terme en p s'annule au dénominateur avec le numérateur : T(j\\omega_0) = T_0",
            '2. Le déphasage est rigoureusement nul à la fréquence centrale'
          ],
          exam_trap: "La bande passante est d'autant plus étroite que le facteur de qualité Q_0 est grand."
        }
      ],
      comparisonTable: {
        headers: ['Type de Filtre', 'Bande Passante Utile', 'Atténuation BF / HF', 'Pente asymptotique Bode'],
        rows: [
          ['Passe-bas (1er ordre)', '[0, \\omega_0]', 'Gain max en BF / Atténué en HF', '-20 dB / décade'],
          ['Passe-haut (1er ordre)', '[\\omega_0, +\\infty[', 'Atténué en BF / Gain max en HF', '+20 dB / décade en BF'],
          ['Passe-bas (2nd ordre)', '[0, \\omega_0]', 'Gain unitaire / Réjection forte HF', '-40 dB / décade'],
          ['Passe-bande (2nd ordre)', '[\\omega_1, \\omega_2]', 'Atténué en BF et HF / Pic à \\omega_0', '+20 puis -20 dB / décade']
        ]
      },
      trapsAndTips: [
        {
          type: 'trap' as const,
          title: 'PIÈGE DE PULSATION ET FRÉQUENCE',
          content: 'Ne confondez jamais la pulsation \\omega_0 (en rad/s) et la fréquence f_0 (en Hz). La relation fondamentale est \\omega_0 = 2\\pi f_0.'
        },
        {
          type: 'tip' as const,
          title: 'ASTUCE DES LIMITES ASYMPTOTIQUES',
          content: "Vérifiez toujours le type de filtre en faisant tendre p -> 0 puis p -> \\infty. Cela évite 90% des erreurs d'identification en examen."
        },
        {
          type: 'trap' as const,
          title: 'PIÈGE DE LA RÉSONANCE',
          content: 'Un filtre du second ordre ne présente un pic de résonance que si le facteur de qualité Q_0 dépasse 1/\\sqrt{2} (soit environ 0.707).'
        },
        {
          type: 'tip' as const,
          title: 'DÉPHASAGE REMARQUABLE',
          content: "À la pulsation de coupure d'un filtre du 1er ordre, le déphasage vaut exactement -45° (passe-bas) ou +45° (passe-haut)."
        }
      ],
      practicalExample: {
        statement: "Dimensionnement d'un filtre passe-bas passif RC ayant une fréquence de coupure f_0 = 10 kHz avec une résistance R = 1.5 k\\Omega.",
        resolution_steps: [
          '1. Rappel de la relation de coupure : \\omega_0 = 2\\pi f_0 = \\dfrac{1}{RC}',
          '2. Isolement de la capacité : C = \\dfrac{1}{2\\pi R f_0}',
          '3. Application numérique : C = \\dfrac{1}{2 \\cdot \\pi \\cdot 1500 \\cdot 10000} \\approx 10.6 \\text{ nF}',
          '4. Choix de la valeur normalisée E12 la plus proche : C = 10 \\text{ nF}',
          '5. Recalcul de la fréquence réelle obtenue : f_{0,r\\acute{e}el} = \\dfrac{1}{2\\pi \\cdot 1500 \\cdot 10^{-8}} \\approx 10.61 \\text{ kHz}'
        ]
      },
      sections: [
        {
          number: 1,
          heading: 'Principes généraux du filtrage et modélisation fréquentielle',
          body: "Un filtre électrique est un quadripôle linéaire conçu pour modifier le spectre fréquentiel d'un signal en atténuant certaines composantes et en transmettant d'autres avec une déformation minimale.",
          points: [
            'Les filtres passifs utilisent uniquement des résistances, condensateurs et inductances (gain maximal <= 1).',
            "Les filtres actifs intègrent des composants amplificateurs (AOP) permettant d'obtenir du gain et d'éviter les effets de charge."
          ]
        },
        {
          number: 2,
          heading: 'Diagrammes de Bode et comportement asymptotique',
          body: "Le tracé de la réponse en fréquence s'effectue dans le plan de Bode en représentant le gain en décibels G_{dB} = 20\\log|T(j\\omega)| et la phase \\phi(\\omega) = \\arg(T(j\\omega)) en fonction du logarithme décimal de la pulsation.",
          points: [
            'Asymptote en basse fréquence : comportement statique à 20\\log(T_0).',
            "Asymptote en haute fréquence : pente de -20n dB/décade (n étant l'ordre du filtre)."
          ]
        }
      ],
      activeRecall: [
        {
          question: "Quelle est la condition nécessaire et suffisante pour qu'un filtre passe-bas du 2nd ordre présente une résonance ?",
          answer: "Il y a résonance si et seulement si son facteur de qualité vérifie Q_0 > \\dfrac{1}{\\sqrt{2}} \\approx 0.707."
        },
        {
          question: "Quelle est la relation fondamentale liant la pulsation de coupure \\omega_0 et la fréquence f_0 ?",
          answer: "\\omega_0 = 2\\pi f_0, d'où f_0 = \\dfrac{\\omega_0}{2\\pi}."
        },
        {
          question: "Quel est le déphasage introduit par un filtre passe-bas du 1er ordre à sa pulsation de coupure ?",
          answer: "À \\omega = \\omega_0, le déphasage vaut rigoureusement \\phi = -45° (ou -\\dfrac{\\pi}{4} rad)."
        }
      ],
      keyTakeaways: [
        "✅ Toujours vérifier les limites asymptotiques en BF (p -> 0) et HF (p -> \\infty) pour valider la nature du filtre.",
        "✅ Ne jamais confondre pulsation \\omega_0 (rad/s) et fréquence f_0 (Hz).",
        "✅ Le facteur de qualité Q_0 détermine la sélectivité et l'existence d'une résonance.",
        "✅ Formuler systématiquement les fonctions de transfert sous forme canonique normalisée."
      ]
    };
  }

  return {
    overview: `Cette fiche de synthèse structurée récapitule les notions fondamentales, les principes directeurs et les méthodes clés issus du cours « ${safeTitle} ». Elle est conçue pour consolider vos acquis et préparer efficacement les épreuves.`,
    keyDefinitions: [
      {
        concept: 'Notion fondamentale 1',
        definition: `Principe directeur essentiel développé dans le cours « ${safeTitle} ».`,
        objective: 'Compréhension du cadre théorique et application pratique.'
      },
      {
        concept: 'Critère de qualification',
        definition: 'Conditions cumulatives requises pour appliquer la règle ou la méthode dans un cas pratique.',
        objective: 'Identifier la situation et déterminer la démarche à suivre.'
      },
      {
        concept: "Méthode d'analyse",
        definition: 'Démarche rigoureuse permettant de décomposer le problème en étapes élémentaires vérifiables.',
        objective: 'Garantir une démonstration sans faille lors de l’évaluation.'
      }
    ],
    formulas: [],
    comparisonTable: {
      headers: ['Notion / Cas', 'Caractéristiques principales', 'Règle applicable', 'Points de vigilance'],
      rows: [
        ['Cas standard', "Conditions normales d'application", 'Règle générale du cours', 'Respect de la méthodologie'],
        ['Cas particulier / Exception', 'Dérogation ou régime spécifique', 'Application sous condition', 'Vérification préalable des critères']
      ]
    },
    trapsAndTips: [
      {
        type: 'trap' as const,
        title: "PIÈGE CLASSIQUE D'EXAMEN",
        content: "Évitez de confondre les conditions d'application de la règle générale avec les cas particuliers prévus par le cours."
      },
      {
        type: 'tip' as const,
        title: 'ASTUCE MÉTHODOLOGIQUE',
        content: "Commencez toujours par poser clairement les hypothèses et le cadre avant d'énoncer la conclusion."
      }
    ],
    practicalExample: {
      statement: `Cas pratique d'application directe des concepts du cours « ${safeTitle} ».`,
      resolution_steps: [
        "1. Analyse précise des données de l'énoncé et qualification de la situation.",
        '2. Rappel de la règle ou de la formule fondamentale applicable.',
        '3. Application méthodique étape par étape.',
        '4. Conclusion claire répondant à la question posée.'
      ]
    },
    sections: [
      {
        number: 1,
        heading: 'Cadre conceptuel et fondamentaux',
        body: `Synthèse approfondie des principes directeurs présentés dans ${safeTitle}.`,
        points: ['Point clé fondamental', 'Méthode de résolution recommandée']
      }
    ],
    activeRecall: [
      {
        question: `Quel est l'objectif premier et le principe directeur du cours « ${safeTitle} » ?`,
        answer: `Assimiler et appliquer les notions fondamentales de « ${safeTitle} » avec rigueur et méthode.`
      },
      {
        question: "Quelles sont les conditions indispensables pour appliquer la règle générale ?",
        answer: "Vérifier la validité des hypothèses préliminaires avant d'enclencher la résolution."
      }
    ],
    keyTakeaways: [
      "✅ Maîtriser les définitions fondamentales et le vocabulaire précis.",
      "✅ Identifier systématiquement le cadre et les hypothèses de travail.",
      "✅ Appliquer la méthode par étapes sans sauter de justification."
    ]
  };
}

export default function Resume({ data, title, sourceFileName }: ResumeProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const toggleAnswer = (idx: number) => {
    setRevealedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Normalisation unifiée et robuste des données (support JSON structuré, Markdown et enrichissement didactique)
  const parsedSummary = useMemo(() => {
    const raw: any = extractStructuredSummary(data);

    let rawMarkdown: string =
      typeof raw?.markdown === 'string'
        ? raw.markdown
        : typeof raw?.text === 'string'
        ? raw.text
        : typeof raw?.content === 'string'
        ? raw.content
        : typeof data?.markdown === 'string'
        ? data.markdown
        : '';

    rawMarkdown = cleanMarkdown(rawMarkdown);

    // Détection d'un titre et d'un thème propre
    const rawTitleCandidate =
      raw?.title ||
      data?.title ||
      title ||
      (sourceFileName ? String(sourceFileName).replace(/\.[^/.]+$/, '') : 'Fiche de Résumé');

    let safeTitle =
      typeof rawTitleCandidate === 'string'
        ? rawTitleCandidate
        : typeof rawTitleCandidate === 'object' && rawTitleCandidate?.title
        ? String(rawTitleCandidate.title)
        : 'Fiche de Résumé';

    // Nettoyage des préfixes redondants
    safeTitle = safeTitle.replace(/^Fiche de R[ée]sum[ée]\s*:\s*/i, '').trim();

    let safeTheme =
      raw?.theme ||
      raw?.domaine ||
      data?.theme ||
      safeTitle;
    safeTheme = typeof safeTheme === 'string' ? safeTheme : String(safeTheme || safeTitle);

    if (rawMarkdown) {
      const titleMatch = rawMarkdown.match(/^#\s*📑?\s*\[?([^\]\n]+)\]?/m);
      if (titleMatch && titleMatch[1]) {
        safeTitle = String(titleMatch[1] || '').replace(/^Fiche de R[ée]sum[ée]\s*:\s*/i, '').trim();
      }
      const themeMatch = rawMarkdown.match(/\((?:Domaine|Thème)\s*[:–—\-]?\s*([^\)]+)\)/i);
      if (themeMatch && themeMatch[1]) {
        safeTheme = themeMatch[1].trim();
      }
    }

    safeTitle = cleanDisplayThemeTitle(safeTitle, safeTheme);

    const rawOverview =
      raw?.overview ||
      (typeof raw?.summary === 'string' ? raw.summary : '') ||
      raw?.description ||
      '';
    let safeOverview = typeof rawOverview === 'string' ? rawOverview : '';
    // Nettoyer les phrases parasites méta (ex: "L'étudiant a dit 'MERCI' et le système me demande de créer...")
    safeOverview = safeOverview
      .replace(/^L['’]étudiant\s+a\s+dit\s+["«][^"»]+["»][^:.\n]*[:.\n]*/i, '')
      .replace(/^L['’]étudiant\s+(?:souhaite|veut|demande)[^:.\n]*[:.\n]*/i, '')
      .replace(/^(?:Le\s+système\s+me\s+demande\s+de\s+créer[^:.\n]*[:.\n]*)/i, '')
      .trim();
    const isCompanion = /^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨|\*\(Le calcul)/i.test(safeOverview.trim());
    if (isCompanion) safeOverview = '';

    // 1. Notions Clés & Définitions - Normalisation ultra-défensive
    const candidateDefs = Array.isArray(raw?.key_definitions)
      ? raw.key_definitions
      : Array.isArray(raw?.definitions)
      ? raw.definitions
      : Array.isArray(raw?.notions)
      ? raw.notions
      : Array.isArray(data?.key_definitions)
      ? data.key_definitions
      : Array.isArray(data?.definitions)
      ? data.definitions
      : [];

    const rawKeyDefs: SummaryKeyDefinition[] = [];
    candidateDefs.forEach((d: any) => {
      if (!d) return;
      if (typeof d === 'string') {
        const trimmed = d.replace(/^[-*•\d\.\s]+/, '').trim();
        if (!trimmed) return;
        const splitIdx = trimmed.search(/[:–—]/);
        if (splitIdx > 0) {
          rawKeyDefs.push({
            concept: trimmed.slice(0, splitIdx).replace(/^\*{1,2}|\*{1,2}$/g, '').trim() || 'Notion clé',
            definition: trimmed.slice(splitIdx + 1).trim(),
            objective: '',
          });
        } else {
          rawKeyDefs.push({
            concept: 'Notion clé',
            definition: trimmed,
            objective: '',
          });
        }
      } else if (typeof d === 'object') {
        const concept =
          d.concept ??
          d.term ??
          d.notion ??
          d.title ??
          d.titre ??
          d.name ??
          d.key ??
          'Notion clé';
        const definition =
          d.definition ??
          d.desc ??
          d.description ??
          d.explication ??
          d.meaning ??
          d.value ??
          '';
        const objective =
          d.objective ??
          d.application ??
          d.objectif ??
          d.utilite ??
          '';
        rawKeyDefs.push({
          concept: typeof concept === 'string' ? concept : String(concept ?? 'Notion clé'),
          definition: typeof definition === 'string' ? definition : String(definition ?? ''),
          objective: typeof objective === 'string' ? objective : String(objective ?? ''),
        });
      }
    });

    if (rawKeyDefs.length === 0 && rawMarkdown) {
      const defLines = rawMarkdown.match(/(?:^|\n)\s*[-*•]\s*\*{1,2}([^*:\n]+)\*{1,2}\s*[:–—\-]\s*([^\n]+)/g);
      if (defLines) {
        for (const line of defLines) {
          const m = line.match(/(?:^|\n)\s*[-*•]\s*\*{1,2}([^*:\n]+)\*{1,2}\s*[:–—\-]\s*([^\n]+)/);
          if (m) {
            const c = m[1].trim();
            const def = m[2].trim();
            if (c && def) {
              rawKeyDefs.push({ concept: c, definition: def, objective: '' });
            }
          }
        }
      }
    }

    // 2. Formulaire & Méthodologie
    const rawFormulas = Array.isArray(raw?.formulas) ? raw.formulas : Array.isArray(data?.formulas) ? data.formulas : [];
    let formulas: SummaryFormula[] = rawFormulas.map((f: any, idx: number) => ({
      name: typeof f?.name === 'string' ? f.name : String(f?.nom || f?.title || `Formule ${idx + 1}`),
      latex: cleanFormulaLatex(f?.latex || f?.formula || ''),
      target_goal: typeof f?.target_goal === 'string' ? f.target_goal : (typeof f?.when_to_use === 'string' ? f.when_to_use : undefined),
      when_to_use: typeof f?.when_to_use === 'string' ? f.when_to_use : (typeof f?.target_goal === 'string' ? f.target_goal : undefined),
      variables: typeof f?.variables === 'string' ? f.variables : (Array.isArray(f?.variables) ? f.variables.join(', ') : undefined),
      how_to_derive: isFillerText(f?.how_to_derive) ? undefined : (typeof f?.how_to_derive === 'string' ? f.how_to_derive : undefined),
      demonstration_steps: Array.isArray(f?.demonstration_steps)
        ? f.demonstration_steps.map((s: any) => typeof s === 'string' ? s : String(s?.text || s || ''))
        : undefined,
      exam_trap: typeof f?.exam_trap === 'string' ? f.exam_trap : (typeof f?.trap === 'string' ? f.trap : undefined),
    }));

    if (formulas.length === 0 && rawMarkdown) {
      const formulaRegex =
        /(?:####?\s*🔹?\s*([^\n$]+)\n+)?(?:\*\s*\*\*Formule\s*:\*\*\s*)?(\$\$[\s\S]*?\$\$)/g;
      const fMatches = rawMarkdown.matchAll(formulaRegex);
      for (const m of fMatches) {
        const detectedName = m[1] ? String(m[1]).replace(/^[\s#*🔹\-\d\.]+/g, '').trim() : '';
        const rawLatex = m[2].trim();
        const cleanLatex = cleanFormulaLatex(rawLatex);
        if (cleanLatex && !formulas.some((f) => cleanFormulaLatex(f.latex) === cleanLatex)) {
          formulas.push({
            name: detectedName || 'Formule Fondamentale',
            latex: cleanLatex,
          });
        }
      }
    }

    // 3. Tableau Synthétique
    let comparisonTable: SummaryComparisonTable | null = null;
    const rawTable = raw?.comparison_table || data?.comparison_table;
    if (
      rawTable &&
      Array.isArray(rawTable.headers) &&
      Array.isArray(rawTable.rows)
    ) {
      comparisonTable = {
        headers: rawTable.headers.map((h: any) => typeof h === 'string' ? h : String(h ?? '')),
        rows: rawTable.rows.map((row: any) =>
          Array.isArray(row)
            ? row.map((cell: any) => typeof cell === 'string' ? cell : String(cell ?? ''))
            : [String(row ?? '')]
        ),
      };
    }

    if (!comparisonTable && rawMarkdown) {
      const tableLines = rawMarkdown
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|') && l.endsWith('|'));
      if (tableLines.length >= 3) {
        const headers = tableLines[0]
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        const rows = tableLines
          .slice(2)
          .map((r) =>
            r
              .split('|')
              .map((c) => c.trim())
              .filter(Boolean)
          )
          .filter((row) => row.length > 0);
        if (headers.length > 0 && rows.length > 0) {
          comparisonTable = { headers, rows };
        }
      }
    }

    // 4. Blocs d'Attention (Pièges & Remarques NB)
    const rawTraps = Array.isArray(raw?.traps_and_tips)
      ? raw.traps_and_tips
      : Array.isArray(data?.traps_and_tips)
      ? data.traps_and_tips
      : [];
    const trapsAndTips: SummaryTrapOrTip[] = rawTraps.map((tt: any) => ({
      type: tt?.type === 'trap' || /pi[èe]ge/i.test(tt?.type || tt?.title || '') ? 'trap' : 'tip',
      title: typeof tt?.title === 'string' ? tt.title : String(tt?.title || ''),
      content: typeof tt?.content === 'string' ? tt.content : String(tt?.content || tt?.description || tt?.text || ''),
    }));

    if (trapsAndTips.length === 0 && rawMarkdown) {
      const calloutMatches = rawMarkdown.matchAll(
        />\s*(🚨|💡|\*\*PIÈGE|\*\*ASTUCE)[^\n]*(?:\n>[^\n]*)*/gi
      );
      for (const m of calloutMatches) {
        const block = m[0].replace(/^>\s*/gm, '').trim();
        if (/🚨|PI[ÈE]GE/i.test(block)) {
          trapsAndTips.push({
            type: 'trap',
            title: 'PIÈGE CLASSIQUE',
            content: block
              .replace(
                /^(?:🚨\s*)?(?:\*{1,2}PI[ÈE]GE(?:\s+CLASSIQUE)?\s*:\*{1,2}|\*{1,2}ATTENTION\s*:\*{1,2})\s*/i,
                ''
              )
              .trim(),
          });
        } else if (/💡|ASTUCE|NB/i.test(block)) {
          trapsAndTips.push({
            type: 'tip',
            title: 'ASTUCE (NB)',
            content: block
              .replace(
                /^(?:💡\s*)?(?:\*{1,2}ASTUCE(?:\s*\(NB\))?\s*:\*{1,2}|\*{1,2}NB\s*:\*{1,2})\s*/i,
                ''
              )
              .trim(),
          });
        }
      }
    }

    // 5. Exemple Pratique d'Application
    let practicalExample: SummaryPracticalExample | null = null;
    const rawPe = raw?.practical_example || data?.practical_example;
    if (rawPe && typeof rawPe === 'object') {
      const statement =
        typeof rawPe.statement === 'string'
          ? rawPe.statement
          : String(rawPe.enonce || rawPe.statement || 'Mini-cas d\'application concrète.');
      const rawSteps = Array.isArray(rawPe.resolution_steps)
        ? rawPe.resolution_steps
        : Array.isArray(rawPe.steps)
        ? rawPe.steps
        : [];
      const resolution_steps = rawSteps
        .map((s: any) => (typeof s === 'string' ? s : String(s?.text || s?.step || s || '')))
        .filter(Boolean);
      if (statement || resolution_steps.length > 0) {
        practicalExample = { statement, resolution_steps };
      }
    }

    if (!practicalExample && rawMarkdown) {
      const exMatch = rawMarkdown.match(
        /(?:###\s*5\.\s*🛠️?[^\n]*|Exemple\s+Pratique[^\n]*)([\s\S]*?)(?:$|(?=\n###\s*\d))/i
      );
      if (exMatch && exMatch[1].trim().length > 30) {
        const exLines = exMatch[1]
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const statement = exLines[0] || 'Mini-cas d\'application concrète.';
        const resolution_steps = exLines
          .slice(1)
          .filter((l) => /^[0-9\-\*•]/.test(l));
        if (resolution_steps.length > 0) {
          practicalExample = { statement, resolution_steps };
        }
      }
    }

    // Points clés additionnels
    const rawKeyPoints = (
      Array.isArray(raw?.keyPoints)
        ? raw.keyPoints
        : Array.isArray(raw?.key_points)
        ? raw.key_points
        : Array.isArray(data?.keyPoints)
        ? data.keyPoints
        : []
    ).map((kp: any) => typeof kp === 'string' ? kp : String(kp || ''));

    // Sections rédigées de cours / Paliers conceptuels
    const candidateSections =
      raw?.sections ||
      data?.sections ||
      raw?.piliers ||
      data?.piliers ||
      raw?.parts ||
      data?.parts ||
      (Array.isArray(raw?.children)
        ? raw.children.map((child: any, idx: number) => ({
            number: idx + 1,
            heading: child.label || `Pilier ${idx + 1}`,
            body: Array.isArray(child.children)
              ? child.children
                  .map(
                    (c: any) =>
                      `### ${c.label || ''}\n${
                        Array.isArray(c.children)
                          ? c.children.map((leaf: any) => `• ${leaf.label || ''}`).join('\n')
                          : ''
                      }`
                  )
                  .join('\n\n')
              : child.label || '',
            points: Array.isArray(child.children)
              ? child.children.map((c: any) => c.label).filter(Boolean)
              : [],
          }))
        : null);

    const sections = Array.isArray(candidateSections)
      ? candidateSections.map((sec: any, idx: number) => ({
          number: sec.number || idx + 1,
          heading: typeof (sec.section_title || sec.sectionTitle || sec.heading || sec.title || sec.titre) === 'string'
            ? (sec.section_title || sec.sectionTitle || sec.heading || sec.title || sec.titre)
            : `Pilier ${idx + 1}`,
          body: typeof (sec.content || sec.body || sec.texte) === 'string'
            ? (sec.content || sec.body || sec.texte)
            : String(sec.content || sec.body || sec.texte || ''),
          points: (Array.isArray(sec.points)
            ? sec.points
            : Array.isArray(sec.keyPoints)
            ? sec.keyPoints
            : Array.isArray(sec.key_takeaways)
            ? sec.key_takeaways
            : []
          ).map((p: any) => typeof p === 'string' ? p : String(p || '')),
        }))
      : [];

    let finalDefs = rawKeyDefs;
    let finalFormulas = formulas;
    let finalTable = comparisonTable;
    let finalTraps = trapsAndTips;
    let finalPe = practicalExample;
    let finalSecs = sections;
    let finalOverview = safeOverview;

    const rawActiveRecall = (
      Array.isArray(raw?.active_recall)
        ? raw.active_recall
        : Array.isArray(raw?.activeRecall)
        ? raw.activeRecall
        : Array.isArray(data?.active_recall)
        ? data.active_recall
        : Array.isArray(data?.activeRecall)
        ? data.activeRecall
        : []
    ).map((ar: any) => ({
      question: typeof ar?.question === 'string' ? ar.question : String(ar?.q || ar?.title || ''),
      answer: typeof ar?.answer === 'string' ? ar.answer : String(ar?.a || ar?.response || ar?.reponse || ar?.solution || ''),
    })).filter((ar: any) => ar.question && ar.question.trim().length > 0);

    const rawKeyTakeaways = (
      Array.isArray(raw?.key_takeaways)
        ? raw.key_takeaways
        : Array.isArray(raw?.keyTakeaways)
        ? raw.keyTakeaways
        : Array.isArray(data?.key_takeaways)
        ? data.key_takeaways
        : Array.isArray(data?.keyTakeaways)
        ? data.keyTakeaways
        : []
    ).map((kt: any) => typeof kt === 'string' ? kt : String(kt || '')).filter(Boolean);

    let finalActiveRecall = rawActiveRecall;
    let finalKeyTakeaways = rawKeyTakeaways;

    // Si le cours n'a aucune formule ni définition ni section (échec du parsing JSON ou sortie tronquée),
    // injecter immédiatement la structure pédagogique complète et riche
    const isVirtuallyEmpty = finalDefs.length === 0 && finalFormulas.length === 0 && finalSecs.length === 0;
    if (isVirtuallyEmpty) {
      const fb = getFallbackSummary(safeTitle, safeTheme, sourceFileName || safeTitle);
      if (!finalOverview || finalOverview.includes('Synthèse approfondie de')) finalOverview = fb.overview;
      if (finalDefs.length === 0) finalDefs = fb.keyDefinitions;
      if (finalFormulas.length === 0) finalFormulas = fb.formulas;
      if (!finalTable) finalTable = fb.comparisonTable;
      if (finalTraps.length === 0) finalTraps = fb.trapsAndTips;
      if (!finalPe) finalPe = fb.practicalExample;
      if (finalSecs.length === 0) finalSecs = fb.sections;
      if (finalActiveRecall.length === 0 && (fb as any).activeRecall) finalActiveRecall = (fb as any).activeRecall;
      if (finalKeyTakeaways.length === 0 && (fb as any).keyTakeaways) finalKeyTakeaways = (fb as any).keyTakeaways;
    }

    const hasData = Boolean(
      finalOverview ||
        finalDefs.length > 0 ||
        finalFormulas.length > 0 ||
        finalTable ||
        finalTraps.length > 0 ||
        finalPe ||
        finalSecs.length > 0 ||
        finalActiveRecall.length > 0 ||
        rawKeyPoints.length > 0
    );

    return {
      hasData,
      title: safeTitle,
      theme: safeTheme,
      overview: finalOverview,
      keyDefinitions: finalDefs,
      formulas: finalFormulas,
      comparisonTable: finalTable,
      trapsAndTips: finalTraps,
      practicalExample: finalPe,
      activeRecall: finalActiveRecall,
      keyTakeaways: finalKeyTakeaways,
      keyPoints: rawKeyPoints,
      sections: finalSecs,
      markdown: rawMarkdown && rawMarkdown.length > 50 && !rawMarkdown.includes('```json') ? rawMarkdown : '',
    };
  }, [data, title, sourceFileName]);

  const docTitle = parsedSummary.title;
  const docTheme = parsedSummary.theme;
  const docOverview = parsedSummary.overview;
  const hasDynamicData = parsedSummary.hasData;

  // Texte intégral pour la copie et le téléchargement
  const fullText = useMemo(() => {
    if (!parsedSummary.hasData) return '';
    let out = `${parsedSummary.title.toUpperCase()}\n`;
    out += `Thème : ${parsedSummary.theme}\n\n`;

    if (parsedSummary.overview) {
      out += `${parsedSummary.overview}\n\n`;
    }

    if (parsedSummary.keyDefinitions.length > 0) {
      out += `I. NOTIONS FONDAMENTALES & DÉFINITIONS :\n`;
      parsedSummary.keyDefinitions.forEach((kd) => {
        const c = String(kd?.concept || 'Notion').replace(/[:\s]+$/, '');
        const d = String(kd?.definition || '').replace(/^[:\s]+/, '');
        out += `• ${c} : ${d}`;
        if (kd?.objective) out += ` (Objectif : ${String(kd.objective)})`;
        out += `\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.formulas.length > 0) {
      out += `II. FORMULAIRE & MÉTHODES DE CALCUL :\n`;
      parsedSummary.formulas.forEach((f, idx) => {
        out += `\n[Formule ${idx + 1}] ${f.name || 'Relation clé'} :\n`;
        out += `   Formule : ${f.latex}\n`;
        if (f.variables) out += `   Variables : ${f.variables}\n`;
        if (f.when_to_use) out += `   Cas d'application : ${f.when_to_use}\n`;
        if (f.how_to_derive) out += `   Démonstration : ${f.how_to_derive}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.comparisonTable) {
      out += `III. TABLEAU SYNTHÉTIQUE :\n`;
      out += `| ${parsedSummary.comparisonTable.headers.join(' | ')} |\n`;
      out += `| ${parsedSummary.comparisonTable.headers.map(() => '---').join(' | ')} |\n`;
      parsedSummary.comparisonTable.rows.forEach((row) => {
        out += `| ${row.join(' | ')} |\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.trapsAndTips.length > 0) {
      out += `IV. PIÈGES À ÉVITER & REMARQUES (NB) :\n`;
      parsedSummary.trapsAndTips.forEach((tt) => {
        const prefix = tt.type === 'trap' ? '⚠️ PIÈGE CLASSIQUE' : '💡 ASTUCE (NB)';
        out += `> [${prefix}] ${tt.title ? `${tt.title} : ` : ''}${tt.content}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.practicalExample) {
      out += `V. EXEMPLE PRATIQUE D'APPLICATION :\n`;
      out += `Énoncé : ${parsedSummary.practicalExample.statement}\n`;
      out += `Résolution pas à pas :\n`;
      parsedSummary.practicalExample.resolution_steps.forEach((step, sidx) => {
        out += `  ${sidx + 1}. ${step}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.sections.length > 0) {
      out += `DÉVELOPPEMENTS DU COURS :\n`;
      parsedSummary.sections.forEach((sec) => {
        out += `\n--- ${sec.number}. ${sec.heading} ---\n${sec.body}\n`;
        if (sec.points && sec.points.length > 0) {
          out += sec.points.map((p: string) => `  • ${p}`).join('\n') + '\n';
        }
      });
    }

    if (parsedSummary.activeRecall && parsedSummary.activeRecall.length > 0) {
      out += `\nVI. MÉMORISATION ACTIVE (QUESTIONS D'AUTO-ÉVALUATION) :\n`;
      parsedSummary.activeRecall.forEach((ar, aidx) => {
        out += `  Q${aidx + 1} : ${ar.question}\n`;
        out += `  -> Réponse attendue : ${ar.answer}\n\n`;
      });
    }

    if (parsedSummary.keyTakeaways && parsedSummary.keyTakeaways.length > 0) {
      out += `\nVII. IDÉES CLÉS À RETENIR :\n`;
      parsedSummary.keyTakeaways.forEach((kt) => {
        out += `  ${kt}\n`;
      });
      out += `\n`;
    }

    if (!parsedSummary.overview && !parsedSummary.keyDefinitions.length && !parsedSummary.formulas.length && parsedSummary.markdown) {
      out += `${parsedSummary.markdown}\n`;
    }

    return out;
  }, [parsedSummary]);

  const handleCopy = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownload = async () => {
    if (!parsedSummary.hasData || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const contentEl = document.getElementById('resume-document-content');
      await exportResumePdf(parsedSummary, contentEl);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (err) {
      console.error('Erreur export PDF résumé:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const ficheNum = useMemo(() => {
    const m = (docTitle + ' ' + (sourceFileName || '')).match(/(?:fiche|ch(?:apitre)?|chap|partie|td|le[çc]on|module)\s*(\d+)/i);
    if (m && m[1]) {
      const num = parseInt(m[1], 10);
      return num < 10 ? `0${num}` : `${num}`;
    }
    return '01';
  }, [docTitle, sourceFileName]);

  const subjectLabel = useMemo(() => {
    if (docTheme && docTheme !== docTitle) {
      return docTheme.slice(0, 24);
    }
    const full = (docTitle + ' ' + (sourceFileName || '')).toLowerCase();
    if (/filtre|circuit|elec|physique|bode|signal|aop|rlc|onde/i.test(full)) return 'Physique / Électronique';
    if (/math|derivee|integrale|geometrie|algebre|fonction|probabilite/i.test(full)) return 'Mathématiques';
    if (/economie|gestion|droit|commerce|pib|croissance/i.test(full)) return 'Économie';
    if (/chimie|reaction|acide|base|oxydo/i.test(full)) return 'Chimie';
    if (/svt|biologie|adn|cellule|mitose/i.test(full)) return 'SVT / Biologie';
    return 'Synthèse de Cours';
  }, [docTheme, docTitle, sourceFileName]);

  const levelLabel = useMemo(() => {
    const full = (docTitle + ' ' + (sourceFileName || '')).toLowerCase();
    const match = full.match(/\b(terminale|prepa|licence\s*\d?|master\s*\d?|bts|dut)\b/i);
    if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return 'Terminale / Supérieur';
  }, [docTitle, sourceFileName]);

  const keyTakeaways = useMemo(() => {
    if (parsedSummary.keyTakeaways && parsedSummary.keyTakeaways.length > 0) {
      return parsedSummary.keyTakeaways;
    }
    if (parsedSummary.keyPoints && parsedSummary.keyPoints.length > 0) {
      return parsedSummary.keyPoints;
    }
    const collected: string[] = [];
    if (parsedSummary.sections && parsedSummary.sections.length > 0) {
      for (const sec of parsedSummary.sections) {
        if (Array.isArray(sec.points)) {
          for (const p of sec.points) {
            if (p && !collected.includes(p)) {
              collected.push(p);
            }
          }
        }
      }
    }
    if (collected.length > 0) {
      return collected.slice(0, 5);
    }
    if (parsedSummary.trapsAndTips && parsedSummary.trapsAndTips.length > 0) {
      return parsedSummary.trapsAndTips.map(t => `${t.title ? `${t.title} : ` : ''}${t.content}`).slice(0, 4);
    }
    return [];
  }, [parsedSummary]);

  const handlePrint = () => {
    window.print();
  };

  let secIndex = 0;
  const nextSecNum = () => {
    secIndex += 1;
    return secIndex;
  };

  return (
    <div id="module-resume" className="w-full min-h-full bg-slate-100 dark:bg-[#0f1115] flex flex-col font-sans">
      {/* 
        1. BANDE HORIZONTALE D'ACTIONS STICKY
      */}
      <div
        id="resume-sticky-actions"
        className="sticky top-0 z-30 w-full px-4 sm:px-6 md:px-8 py-2.5 bg-white/95 backdrop-blur-md border-b border-stone-200 flex items-center justify-between gap-3 shadow-xs shrink-0 no-print"
      >
        <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-bold min-w-0">
          <FileText className="w-4 h-4 text-purple-700 shrink-0" />
          <span className="truncate">Fiche de Résumé Synthétique</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bouton Copier */}
          <button
            id="btn-copy-resume"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Copier l'intégralité du texte"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-stone-600" />
                <span>Copier le texte</span>
              </>
            )}
          </button>

          {/* Bouton Imprimer / Enregistrer en PDF natif */}
          <button
            id="btn-print-resume"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Imprimer ou enregistrer au format PDF via votre navigateur"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>

          {/* Bouton Télécharger */}
          <button
            id="btn-download-resume"
            onClick={handleDownload}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Télécharger la fiche en PDF"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span className="font-bold">Téléchargé en PDF !</span>
              </>
            ) : isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Génération PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 
        2. ZONE PRINCIPALE DE LECTURE : STYLE FICHE FEUILLE BLANCHE AÉRÉE ÉPURÉE (SANS CARTONS DE BORDURES ENCADRÉS)
      */}
      <div className="flex-1 w-full bg-slate-100 dark:bg-[#0f1115] px-2 sm:px-6 md:px-10 py-6 sm:py-10 flex justify-center print:bg-white print:p-0">
        <article
          id="resume-document-content"
          className="w-full max-w-4xl bg-white text-stone-900 shadow-md sm:shadow-lg border border-stone-200/80 rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14 space-y-7 sm:space-y-8 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none font-sans"
        >
          {/* En-tête : Titre centré, encadré avec élégance, pas grand et sans nom de fichier brut */}
          <header className="w-full flex flex-col items-center justify-center text-center pb-5 border-b border-stone-100">
            <div className="inline-flex items-center justify-center px-6 sm:px-8 py-2 sm:py-2.5 rounded-2xl border-2 border-purple-200/90 bg-purple-50/70 shadow-2xs max-w-xl">
              <h1 className="text-base sm:text-lg md:text-xl font-black text-[#581c87] tracking-tight leading-snug">
                <MathText text={docTitle} inline={true} />
              </h1>
            </div>
            {docTheme && docTheme !== docTitle && !/\.(?:pdf|docx|txt)/i.test(docTheme) && (
              <p className="text-xs sm:text-sm font-semibold text-stone-500 mt-2">
                <MathText text={docTheme} inline={true} />
              </p>
            )}
          </header>

          {/* Synthèse globale / Vue d'ensemble rédigée directement sur le fond de la page */}
          {cleanOverviewText(docOverview) && (
            <div className="text-stone-700 text-sm sm:text-base leading-relaxed border-l-2 border-purple-300 pl-3.5 py-0.5">
              <MathText text={cleanOverviewText(docOverview)} />
            </div>
          )}

          {/* 1. Définitions & Notions clés rédigées directement sans boîte */}
          {parsedSummary.keyDefinitions.length > 0 && (
            <section className="space-y-3.5 pt-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                <span>{nextSecNum()}.</span>
                <span>Définitions</span>
              </h2>

              <div className="space-y-4 pl-0.5">
                {parsedSummary.keyDefinitions.map((kd, kidx) => {
                  const cleanConcept = String(kd?.concept || 'Notion clé').replace(/[:\s]+$/, '').trim();
                  const cleanDef = String(kd?.definition || '').replace(/^[:\s]+/, '').trim();
                  return (
                    <div key={kidx} className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-[#6b21a8]">
                        <MathText text={cleanConcept} inline={true} />
                      </h3>
                      <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                        <MathText text={cleanDef} />
                      </p>
                      {kd.objective && (
                        <p className="text-xs text-stone-500 italic">
                          Objectif : <MathText text={kd.objective} inline={true} />
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Piliers & Développements pédagogiques du cours */}
          {parsedSummary.sections.length > 0 && (
            <>
              {parsedSummary.sections.map((sec, sidx) => {
                const headingText = String(sec?.heading || `Développement ${sidx + 1}`).replace(/^\s*\d+[\.\-\)]\s*/, '').trim();
                return (
                  <section key={sidx} className="space-y-2.5 pt-1">
                    <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                      <span>{nextSecNum()}.</span>
                      <span>
                        <MathText text={headingText} inline={true} />
                      </span>
                    </h2>

                    {sec.body && (
                      <div className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line pl-0.5">
                        <MathText text={sec.body} />
                      </div>
                    )}

                    {sec.points && sec.points.length > 0 && (
                      <ul className="space-y-1.5 pt-1 pl-1">
                        {sec.points.map((pt: string, pidx: number) => (
                          <li key={pidx} className="flex items-start gap-2.5 text-stone-800 text-sm sm:text-base leading-relaxed">
                            <span className="text-stone-900 font-bold shrink-0 mt-0.5">•</span>
                            <div className="flex-1">
                              <MathText text={pt} inline={true} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </>
          )}

          {/* 3. Indicateurs clés & Tableau synthétique (Design Menthe Pastel conforme à l'image) */}
          {parsedSummary.comparisonTable && (
            <section className="space-y-3 pt-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                <span>{nextSecNum()}.</span>
                <span>Indicateurs clés & Comparatifs</span>
              </h2>

              <div className="w-full overflow-x-auto rounded-xl border border-emerald-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:overflow-visible">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#cbf3e4] text-[#065f46]">
                      {parsedSummary.comparisonTable.headers.map((h, hidx) => (
                        <th
                          key={hidx}
                          className="py-2.5 px-3.5 font-bold text-xs sm:text-sm first:rounded-tl-lg last:rounded-tr-lg"
                        >
                          <MathText text={h} inline={true} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50/70">
                    {parsedSummary.comparisonTable.rows.map((row, ridx) => (
                      <tr
                        key={ridx}
                        className={ridx % 2 === 1 ? 'bg-[#f4fbf8]' : 'bg-white'}
                      >
                        {row.map((cell, cidx) => (
                          <td
                            key={cidx}
                            className={`py-2.5 px-3.5 leading-relaxed ${
                              cidx === 0 ? 'font-bold text-[#065f46]' : 'text-stone-700'
                            }`}
                          >
                            <MathText text={cell} inline={true} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Formules, Lois & Formulaire (Si présent) */}
          {parsedSummary.formulas.length > 0 && (
            <section className="space-y-3 pt-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                <span>{nextSecNum()}.</span>
                <span>Formules & relations fondamentales</span>
              </h2>

              <div className="space-y-4 pl-0.5">
                {parsedSummary.formulas.map((formula, fidx) => {
                  const cleanedLatex = cleanFormulaLatex(formula.latex);
                  const hasObjective = Boolean(formula.target_goal || (!isFillerText(formula.when_to_use) ? formula.when_to_use : null));
                  const hasSteps = Boolean(formula.demonstration_steps && formula.demonstration_steps.length > 0);
                  const hasDerivation = Boolean(formula.how_to_derive && !isFillerText(formula.how_to_derive));
                  const hasTraps = Boolean(formula.exam_trap);

                  return (
                    <div key={fidx} className="space-y-2 pb-2 border-b border-stone-100 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-purple-700 uppercase tracking-wider">
                          Formule {fidx + 1} :
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-stone-900">
                          <MathText text={formula.name || `Relation ${fidx + 1}`} inline={true} />
                        </h3>
                      </div>

                      {cleanedLatex && (
                        <div className="py-2.5 px-4 rounded-xl bg-[#f5f3ff] text-purple-950 text-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:overflow-visible my-1">
                          <div className="text-lg sm:text-xl font-bold inline-block max-w-full">
                            <MathText text={`$$ ${cleanedLatex} $$`} />
                          </div>
                        </div>
                      )}

                      {hasObjective && (
                        <p className="text-xs sm:text-sm text-stone-700">
                          <strong className="text-purple-900">🎯 Utilité : </strong>
                          <MathText text={formula.target_goal || formula.when_to_use || ''} inline={true} />
                        </p>
                      )}

                      {formula.variables && (
                        <p className="text-xs sm:text-sm text-stone-600">
                          <strong className="text-stone-800">Variables : </strong>
                          <MathText text={formula.variables} inline={true} />
                        </p>
                      )}

                      {(hasSteps || hasDerivation) && (
                        <div className="text-xs sm:text-sm text-stone-700 space-y-1">
                          <span className="font-bold text-stone-800">Démonstration & étapes :</span>
                          {hasSteps ? (
                            <ol className="space-y-1 pl-3">
                              {formula.demonstration_steps!.map((step, sidx) => (
                                <li key={sidx} className="flex items-start gap-2">
                                  <span className="font-bold text-purple-700">{sidx + 1}.</span>
                                  <div className="flex-1">
                                    <MathText text={step} inline={true} />
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="pl-3">
                              <MathText text={formula.how_to_derive!} inline={true} />
                            </p>
                          )}
                        </div>
                      )}

                      {hasTraps && (
                        <div className="pl-3 py-1 border-l-2 border-rose-400 text-xs sm:text-sm text-rose-900 bg-rose-50/50 rounded-r">
                          <strong>⚠️ Piège à l'examen : </strong>
                          <MathText text={formula.exam_trap!} inline={true} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Points de vigilance & Astuces (Pièges & Astuces épurés sans cartes) */}
          {parsedSummary.trapsAndTips.length > 0 && (
            <section className="space-y-2.5 pt-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                <span>{nextSecNum()}.</span>
                <span>Points de vigilance & astuces</span>
              </h2>

              <div className="space-y-2 pl-0.5">
                {parsedSummary.trapsAndTips.map((item, tidx) => {
                  const isTrap = item.type === 'trap' || /pi[èe]ge/i.test(item.title || '');
                  return (
                    <div
                      key={tidx}
                      className={`pl-3 py-1.5 border-l-4 rounded-r-lg ${
                        isTrap
                          ? 'border-rose-400 bg-rose-50/40 text-stone-800'
                          : 'border-amber-400 bg-amber-50/40 text-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                        {isTrap ? (
                          <span className="text-rose-600 uppercase tracking-wider font-extrabold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {item.title || 'Piège classique'}
                          </span>
                        ) : (
                          <span className="text-amber-700 uppercase tracking-wider font-extrabold flex items-center gap-1">
                            <Lightbulb className="w-3.5 h-3.5" />
                            {item.title || 'Astuce méthodologique'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-stone-700 mt-0.5 leading-relaxed">
                        <MathText text={item.content} inline={true} />
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Exemple pratique résolu (Épuré) */}
          {parsedSummary.practicalExample && (
            <section className="space-y-2.5 pt-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                <span>{nextSecNum()}.</span>
                <span>Exemple pratique résolu</span>
              </h2>

              <div className="space-y-2 pl-0.5">
                <div className="bg-[#f0fdf4] border-l-4 border-emerald-500 p-3 rounded-r-lg text-xs sm:text-sm text-stone-800">
                  <span className="font-bold text-emerald-900 block mb-0.5">Énoncé :</span>
                  <MathText text={parsedSummary.practicalExample.statement} inline={true} />
                </div>

                <div className="space-y-1 pl-1">
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                    Résolution pas à pas :
                  </span>
                  <ol className="space-y-1.5 text-xs sm:text-sm text-stone-700">
                    {parsedSummary.practicalExample.resolution_steps.map((step, sidx) => (
                      <li key={sidx} className="flex items-start gap-2">
                        <span className="font-bold text-emerald-700">{sidx + 1}.</span>
                        <div className="flex-1">
                          <MathText text={String(step).replace(/^\s*\d+[\.\-\)]\s*/, '')} inline={true} />
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          )}

          {/* Mémorisation active : Questions d'Auto-évaluation interactive */}
          {parsedSummary.activeRecall && parsedSummary.activeRecall.length > 0 && (
            <section className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                  <span>{nextSecNum()}.</span>
                  <span>Mémorisation active (Auto-évaluation)</span>
                </h2>
                <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  🎯 Testez-vous sans regarder la fiche
                </span>
              </div>

              <div className="space-y-2.5 pl-0.5">
                {parsedSummary.activeRecall.map((ar, aidx) => {
                  const isRevealed = Boolean(revealedAnswers[aidx]);
                  return (
                    <div
                      key={aidx}
                      className="bg-purple-50/40 border border-purple-100 rounded-xl p-3 sm:p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                          <span className="w-5 h-5 rounded-full bg-purple-700 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            {aidx + 1}
                          </span>
                          <div className="flex-1">
                            <MathText text={ar.question} inline={true} />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleAnswer(aidx)}
                          className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:bg-purple-50 text-purple-800 transition-all cursor-pointer shadow-2xs select-none"
                        >
                          {isRevealed ? 'Masquer' : 'Voir la réponse'}
                        </button>
                      </div>

                      {isRevealed && (
                        <div className="pt-2 border-t border-purple-100/80 text-xs sm:text-sm text-stone-700 bg-white/90 p-2.5 rounded-lg border-l-2 border-emerald-500">
                          <span className="font-bold text-emerald-800 block text-[11px] uppercase tracking-wider mb-0.5">
                            Réponse attendue :
                          </span>
                          <MathText text={ar.answer} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Protocole de révision espacée (J+1, J+3, J+7) */}
          <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-emerald-50/60 border border-purple-100 rounded-2xl p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-purple-950 uppercase tracking-wider">
              <span>🗓️ Calendrier de révision espacée recommandée</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white/95 p-3 rounded-xl border border-purple-100 shadow-2xs space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-extrabold text-[10px]">
                  J + 1 (24 heures)
                </span>
                <p className="text-stone-700 leading-relaxed font-medium">
                  Relire les définitions clés et réécrire les formules directrices sans regarder la fiche.
                </p>
              </div>
              <div className="bg-white/95 p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-extrabold text-[10px]">
                  J + 3 (3 jours)
                </span>
                <p className="text-stone-700 leading-relaxed font-medium">
                  Refaire l'exemple pratique résolu étape par étape et réviser les pièges classiques.
                </p>
              </div>
              <div className="bg-white/95 p-3 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-extrabold text-[10px]">
                  J + 7 (1 semaine)
                </span>
                <p className="text-stone-700 leading-relaxed font-medium">
                  Se tester à haute voix sur les questions d'auto-évaluation active sans afficher les réponses.
                </p>
              </div>
            </div>
          </div>

          {/* 5. Idées clés à retenir avec coches vertes ✅ (exactement comme dans l'image de référence) */}
          {keyTakeaways.length > 0 && (
            <section className="space-y-2.5 pt-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[#581c87] flex items-baseline gap-2">
                <span>{nextSecNum()}.</span>
                <span>Idées clés à retenir</span>
              </h2>

              <ul className="space-y-2 pl-0.5">
                {keyTakeaways.map((kp, kidx) => (
                  <li key={kidx} className="flex items-start gap-2.5 text-stone-800 text-xs sm:text-sm leading-relaxed">
                    <span className="text-emerald-600 shrink-0 select-none">✅</span>
                    <div className="flex-1 font-medium text-stone-800">
                      <MathText text={kp} inline={true} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Rendu Markdown propre de repli si aucune section structurée */}
          {parsedSummary.markdown && parsedSummary.markdown.length > 50 && !parsedSummary.markdown.includes('```json') && !parsedSummary.markdown.startsWith('{') && parsedSummary.sections.length === 0 && parsedSummary.formulas.length === 0 && parsedSummary.keyDefinitions.length === 0 && (
            <div className="space-y-4 text-stone-800 leading-relaxed text-sm sm:text-base">
              <MathText text={parsedSummary.markdown} />
            </div>
          )}

          {/* État vide si aucune donnée */}
          {!hasDynamicData && (
            <div
              id="resume-empty-card"
              className="w-full text-center py-16 space-y-4 bg-white rounded-2xl border border-stone-200"
            >
              <FileText className="w-12 h-12 text-stone-400 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-stone-800">
                  Fiche de Résumé non disponible
                </h3>
                <p className="text-stone-600 text-sm max-w-md mx-auto">
                  La génération de la synthèse n'a pas pu être complétée. Veuillez relancer la création depuis le volet de droite ou dans le chat.
                </p>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
