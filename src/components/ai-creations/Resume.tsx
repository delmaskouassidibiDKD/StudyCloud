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
    ]
  };
}

export default function Resume({ data, title, sourceFileName }: ResumeProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

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

    const rawOverview =
      raw?.overview ||
      (typeof raw?.summary === 'string' ? raw.summary : '') ||
      raw?.description ||
      '';
    const isCompanion = typeof rawOverview === 'string' && /^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨|\*\(Le calcul)/i.test(rawOverview.trim());
    const safeOverview = isCompanion ? '' : rawOverview;

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
    }

    const hasData = Boolean(
      finalOverview ||
        finalDefs.length > 0 ||
        finalFormulas.length > 0 ||
        finalTable ||
        finalTraps.length > 0 ||
        finalPe ||
        finalSecs.length > 0 ||
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="module-resume" className="w-full min-h-full bg-white flex flex-col font-sans">
      {/* 
        1. BANDE HORIZONTALE D'ACTIONS STICKY
      */}
      <div
        id="resume-sticky-actions"
        className="sticky top-0 z-30 w-full px-4 sm:px-6 md:px-8 py-2.5 bg-white/95 backdrop-blur-md border-b border-stone-200 flex items-center justify-between gap-3 shadow-xs shrink-0 no-print"
      >
        <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-bold min-w-0">
          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
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
        2. ZONE PRINCIPALE DE LECTURE : STRUCTURE PÉDAGOGIQUE COLORÉE & ÉLÉGANTE SUR FOND BLANC
      */}
      <div className="flex-1 w-full bg-white px-4 sm:px-8 md:px-12 py-8">
        <article id="resume-document-content" className="w-full max-w-4xl mx-auto space-y-8 text-black bg-white">
          
          {/* En-tête avec cadre élégant : Thème bien encadré et Titre en grand noir profond */}
          <header className="w-full rounded-2xl border-2 border-stone-200 bg-white p-6 sm:p-8 shadow-xs text-center space-y-4">
            {/* Boîte / Encadré du Thème adaptatif avec contour net */}
            <div className="inline-flex max-w-full items-center justify-center gap-2.5 px-4 sm:px-6 py-2 rounded-xl border-2 border-indigo-200 bg-indigo-50/90 text-indigo-950 font-black text-xs sm:text-sm tracking-wider uppercase shadow-2xs">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="break-words">
                <MathText text={docTheme || docTitle} inline={true} />
              </span>
            </div>

            {/* Titre du Cours en écriture bien noire, nette et aérée */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-black tracking-tight px-2 leading-snug break-words">
              <MathText text={docTitle} inline={true} />
            </h1>

            {/* Badge de sous-titre explicatif */}
            <div className="flex items-center justify-center gap-2 text-stone-500 text-xs sm:text-sm font-semibold pt-1">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Fiche de Révision & Masterclass Synthétique</span>
            </div>
          </header>

          {/* Vue d'ensemble / Synthèse Globale du Chapitre */}
          {docOverview && (
            <div className="rounded-2xl bg-white border-2 border-indigo-200 p-5 sm:p-6 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-xs sm:text-sm uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Synthèse Globale & Objectifs du Chapitre</span>
              </div>
              <div className="text-black text-base sm:text-lg leading-relaxed font-normal">
                <MathText text={docOverview} />
              </div>
            </div>
          )}

          {/* Piliers Thématiques & Développements Approfondis du Cours */}
          {parsedSummary.sections.length > 0 && (
            <section className="space-y-6 pt-2">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-indigo-300">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  ★
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Piliers Fondamentaux & Développements Pédagogiques
                </h2>
              </div>

              <div className="space-y-6">
                {parsedSummary.sections.map((sec, sidx) => {
                  const headingText = String(sec?.heading || `Pilier ${sidx + 1}`);
                  return (
                    <div
                      key={sidx}
                      className="bg-white rounded-2xl border-2 border-stone-200 p-6 sm:p-7 space-y-4 shadow-xs hover:border-indigo-300 transition-all"
                    >
                      <div className="flex items-center gap-3 pb-3 border-b border-stone-200">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-900 text-xs font-black flex items-center justify-center shrink-0">
                          {sec.number || sidx + 1}
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-black">
                          <MathText text={headingText.replace(/^\s*\d+[\.\-\)]\s*/, '') || headingText} inline={true} />
                        </h3>
                      </div>

                      <div className="text-black leading-relaxed text-base sm:text-lg whitespace-pre-line font-normal">
                        <MathText text={sec.body} />
                      </div>

                      {sec.points && sec.points.length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs font-black uppercase tracking-wider text-indigo-950 pb-2">
                            Points directeurs à retenir :
                          </p>
                          <ul className="space-y-2">
                            {sec.points.map((pt: string, pidx: number) => (
                              <li key={pidx} className="flex items-start gap-2.5 text-black text-sm sm:text-base leading-relaxed bg-stone-50/80 p-2.5 rounded-xl border border-stone-200">
                                <span className="text-indigo-600 font-black mt-0.5">•</span>
                                <div className="flex-1">
                                  <MathText text={pt} inline={true} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* I. Notions Clés & Définitions */}
          {(parsedSummary.keyDefinitions.length > 0 || parsedSummary.keyPoints.length > 0) && (
            <section className="space-y-4 pt-2">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-indigo-200">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  I
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Notions Fondamentales & Définitions
                </h2>
              </div>

              {parsedSummary.keyDefinitions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parsedSummary.keyDefinitions.map((kd, kidx) => {
                    const cleanConcept = String(kd?.concept || 'Notion clé').replace(/[:\s]+$/, '').trim();
                    const cleanDef = String(kd?.definition || '').replace(/^[:\s]+/, '').trim();
                    const rawObj = kd?.objective ? String(kd.objective) : '';
                    const cleanObj = rawObj ? rawObj.replace(/^[:\s]+/, '').trim() : '';

                    return (
                      <div
                        key={kidx}
                        className="bg-white rounded-xl border-2 border-stone-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all p-4 border-l-4 border-l-indigo-600 flex flex-col justify-between space-y-2.5"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-indigo-950 font-black text-base sm:text-lg">
                            <BookmarkCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                            <MathText text={cleanConcept} inline={true} />
                          </div>
                          <div className="text-black text-sm sm:text-base leading-relaxed">
                            <MathText text={cleanDef} inline={true} />
                          </div>
                        </div>
                        {cleanObj && (
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg px-2.5 py-1 text-xs font-semibold">
                              <Target className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>Objectif : <MathText text={cleanObj} inline={true} /></span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ul className="space-y-2.5 pl-1">
                  {parsedSummary.keyPoints.map((kp, kidx) => (
                    <li key={kidx} className="flex items-start gap-2.5 text-black text-base leading-relaxed bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-indigo-600 font-bold mt-1 text-sm">•</span>
                      <div className="flex-1">
                        <MathText text={kp} inline={true} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* II. Formulaire, Règles & Méthodes de Calcul */}
          {parsedSummary.formulas.length > 0 && (
            <section className="space-y-6 pt-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-blue-200">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  II
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Formules, Lois & Règles Fondamentales
                </h2>
              </div>

              <div className="space-y-6">
                {parsedSummary.formulas.map((formula, fidx) => {
                  const cleanedLatex = cleanFormulaLatex(formula.latex);
                  const hasObjective = Boolean(formula.target_goal || (!isFillerText(formula.when_to_use) ? formula.when_to_use : null));
                  const hasSteps = Boolean(formula.demonstration_steps && formula.demonstration_steps.length > 0);
                  const hasDerivation = Boolean(formula.how_to_derive && !isFillerText(formula.how_to_derive));
                  const hasTraps = Boolean(formula.exam_trap);

                  return (
                    <div
                      key={fidx}
                      className="bg-white rounded-2xl border-2 border-stone-200 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 space-y-4"
                    >
                      {/* En-tête avec badge et titre */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-wider shadow-2xs">
                            #{fidx + 1}
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-black">
                            <MathText text={formula.name || `Formule ${fidx + 1}`} inline={true} />
                          </h3>
                        </div>
                        {formula.target_goal && (
                          <span className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-full px-3 py-0.5">
                            Formule Clé
                          </span>
                        )}
                      </div>

                      {/* Encadré de Formule LaTeX Bleu Vibrant */}
                      {cleanedLatex && (
                        <div className="py-3.5 px-4 rounded-xl bg-blue-50/70 border-2 border-blue-300 text-center overflow-x-auto shadow-inner my-2">
                          <div className="text-xl sm:text-2xl font-bold text-blue-950 inline-block">
                            <MathText text={`$$ ${cleanedLatex} $$`} />
                          </div>
                        </div>
                      )}

                      {/* Objectif & Application */}
                      {hasObjective && (
                        <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-r-xl p-3 text-sm text-black">
                          <strong className="font-bold text-blue-950">🎯 Objectif & Utilité : </strong>
                          <MathText text={formula.target_goal || formula.when_to_use || ''} inline={true} />
                        </div>
                      )}

                      {/* Démonstration ou Méthode pas à pas */}
                      {(hasSteps || hasDerivation) && (
                        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2.5">
                          <p className="font-bold text-black text-sm flex items-center gap-2">
                            <span>🛠️ Démonstration & Méthode d'application pas à pas :</span>
                          </p>
                          {hasSteps ? (
                            <ol className="space-y-2">
                              {formula.demonstration_steps!.map((step, sidx) => (
                                <li key={sidx} className="flex items-start gap-2.5 text-black text-sm sm:text-base leading-relaxed">
                                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                    {sidx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <MathText text={step} inline={true} />
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <div className="text-black text-sm sm:text-base leading-relaxed pl-2">
                              <MathText text={formula.how_to_derive!} inline={true} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Variables & Unités */}
                      {formula.variables && (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-sm text-black flex items-start gap-2.5">
                          <span className="text-amber-600 text-base shrink-0">📐</span>
                          <div>
                            <strong className="font-bold text-amber-950">Variables, Unités & Conditions : </strong>
                            <MathText text={formula.variables} inline={true} />
                          </div>
                        </div>
                      )}

                      {/* Piège classique pour cette formule */}
                      {hasTraps && (
                        <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-3 text-sm text-rose-950 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold text-rose-900">Piège classique à l'examen : </strong>
                            <MathText text={formula.exam_trap!} inline={true} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* III. Tableau Synthétique Comparatif */}
          {parsedSummary.comparisonTable && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-purple-200">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  III
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Tableau Synthétique Comparatif
                </h2>
              </div>

              <div className="w-full overflow-x-auto rounded-2xl border-2 border-purple-200 shadow-xs bg-white">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-purple-700 text-white font-extrabold">
                      {parsedSummary.comparisonTable.headers.map((h, hidx) => (
                        <th key={hidx} className="py-3.5 px-4 uppercase tracking-wider text-xs">
                          <MathText text={h} inline={true} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {parsedSummary.comparisonTable.rows.map((row, ridx) => (
                      <tr
                        key={ridx}
                        className={ridx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-purple-50/20 hover:bg-purple-50/50 transition-colors'}
                      >
                        {row.map((cell, cidx) => (
                          <td key={cidx} className="py-3 px-4 text-black font-medium leading-relaxed">
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

          {/* IV. Pièges à Éviter & Astuces Méthodologiques (NB) */}
          {parsedSummary.trapsAndTips.length > 0 && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-amber-200">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  IV
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Pièges à Éviter & Astuces Méthodologiques (NB)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsedSummary.trapsAndTips.map((item, tidx) => {
                  const isTrap = item.type === 'trap' || /pi[èe]ge/i.test(item.title || '');
                  return isTrap ? (
                    <div
                      key={tidx}
                      className="bg-white border-2 border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-2xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            PIÈGE CLASSIQUE
                          </span>
                          {item.title && !/^(pi[èe]ge|astuce)/i.test(item.title) && (
                            <span className="font-extrabold text-rose-950 text-sm">
                              {item.title}
                            </span>
                          )}
                        </div>
                        <div className="text-black text-sm sm:text-base leading-relaxed">
                          <MathText text={item.content} inline={true} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={tidx}
                      className="bg-white border-2 border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-2xs">
                            <Lightbulb className="w-3.5 h-3.5" />
                            ASTUCE (NB)
                          </span>
                          {item.title && !/^(pi[èe]ge|astuce)/i.test(item.title) && (
                            <span className="font-extrabold text-amber-950 text-sm">
                              {item.title}
                            </span>
                          )}
                        </div>
                        <div className="text-black text-sm sm:text-base leading-relaxed">
                          <MathText text={item.content} inline={true} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* V. Exemple Pratique d'Application Résolu */}
          {parsedSummary.practicalExample && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-emerald-200">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  V
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Exemple Pratique Résolu Pas à Pas
                </h2>
              </div>

              <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                {/* Énoncé */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-900 font-black text-xs sm:text-sm uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Énoncé du problème</span>
                  </div>
                  <div className="text-black text-sm sm:text-base leading-relaxed italic pl-1">
                    <MathText text={parsedSummary.practicalExample.statement} inline={true} />
                  </div>
                </div>

                {/* Étapes de résolution */}
                <div className="space-y-3 pt-1">
                  <p className="font-black text-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                    <span>🔍 Résolution détaillée étape par étape :</span>
                  </p>
                  <ol className="space-y-2.5">
                    {parsedSummary.practicalExample.resolution_steps.map((step, sidx) => {
                      const stepStr = typeof step === 'string' ? step : String(step || '');
                      return (
                        <li key={sidx} className="flex items-start gap-3 bg-white border border-stone-200 rounded-xl p-3 shadow-2xs text-black text-sm sm:text-base leading-relaxed">
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            {sidx + 1}
                          </span>
                          <div className="flex-1">
                            <MathText text={stepStr.replace(/^\s*\d+[\.\-\)]\s*/, '') || stepStr} inline={true} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </section>
          )}



          {/* Rendu Markdown propre de repli (uniquement si aucune formule/section et si markdown assaini) */}
          {parsedSummary.markdown && parsedSummary.markdown.length > 50 && !parsedSummary.markdown.includes('```json') && !parsedSummary.markdown.startsWith('{') && parsedSummary.sections.length === 0 && parsedSummary.formulas.length === 0 && parsedSummary.keyDefinitions.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4 text-stone-800 leading-relaxed text-base">
              <MathText text={parsedSummary.markdown} />
            </div>
          )}

          {/* État vide si aucune donnée */}
          {!hasDynamicData && (
            <div
              id="resume-empty-card"
              className="w-full text-center py-16 space-y-4 bg-white rounded-2xl border border-stone-200 shadow-xs"
            >
              <FileText className="w-12 h-12 text-stone-400 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-800">
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
