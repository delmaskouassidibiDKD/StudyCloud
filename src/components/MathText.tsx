import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text?: string;
  content?: string;
  className?: string;
  inline?: boolean;
}

/**
 * Nettoie et répare les corruptions fréquentes du code LaTeX généré par les LLMs
 * notamment : mélanges de $ et symboles (ex: \text{k}\$\Omega), blocs $$ non fermés, etc.
 */
/**
 * Vérifie si un jeton est une variable mathématique ou un nombre valide
 * (ex: R_1, R2, C, L, p, \omega_0, f_0, 1, 1000, j\omega, LC\omega^2)
 * et NON un mot de la langue courante (ex: series, parallel, input, feedback, and, or...)
 */
function isMathToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  // Nombre pur ou avec puissance (ex: 1, 2, 1000, 10^3, 2.5)
  if (/^\d+(?:\.\d+)?(?:\^\d+)?$/.test(t)) return true;
  // Symbole grec LaTeX (ex: \omega, \omega_0, \pi, \Delta, \tau)
  if (/^\\[a-zA-Z]+(?:_[0-9a-zA-Z]+)?$/.test(t)) return true;
  // Variable simple ou indexée (ex: R, C, L, p, s, j, w, R_1, R1, C_2, w_0, f_0, Q_0, A_0, U_e, U_s, V_e, V_s, j\omega, LC\omega^2)
  if (/^[a-zA-Z](?:_[0-9a-zA-Z]+|\d+)?$/.test(t)) return true;
  // Expression courte avec produit ou puissance de variables (ex: jCw, LCw^2, R2Cp, 1+LCw^2)
  if (/^(?:[0-9a-zA-Z_\\^]+)$/.test(t)) {
    // Exclure formellement les mots de la langue courante (anglais & français)
    const commonWords = /^(?:series|parallel|serie|parallele|input|output|feedback|filter|filtre|gain|signal|circuit|ground|masse|and|or|et|ou|in|out|to|from|for|pour|avec|sans|dans|sur|soit|donc|comme|page|fig|figure|step|etape|part|partie|case|cas|true|false|yes|no|min|max|all|low|high|band|stop|pass|notch|trap|mode|type|left|right|gauche|droite|the|this|that|with|without|between|about|maybe|suggests|removes|removing|leaving|replaces|replacing|inductor|capacitor|resistor|impedance|resistance|transfer|function|frequency|pulsation|tension|courant|ampli|op-amp|aop)$/i;
    if (commonWords.test(t)) return false;
    // Si c'est un mot de 4 lettres ou plus sans chiffres ni tirets ni antislashes (ex: "sistor", "branch", "inductor"), ce n'est PAS une variable mathématique
    if (t.length >= 4 && !/[0-9_\\^]/.test(t)) return false;
    return true;
  }
  return false;
}

/**
 * Détecte si une ligne contient du texte explicatif ou de la prose en langage naturel
 * (en français ou en anglais), pour éviter absolument de l'envelopper dans $$...$$
 */
function containsNaturalLanguageProse(line: string): boolean {
  if (!line || typeof line !== 'string') return false;
  // Supprimer les commandes LaTeX connues
  const stripped = line
    .replace(/\\(?:dfrac|frac|sqrt|boxed|underline|omega|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|Omega|Delta|times|approx|infty|pm|to|Rightarrow|leftarrow|Leftarrow|quad|qquad|left|right|sum|int|prod|lim|cdot|text)\b/gi, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[$_{}^=+\-*/()\[\]0-9.:,;?!|~<>]/g, ' ');
  const words = stripped.match(/[a-zA-ZÀ-ÿ]{3,}/g) || [];
  // Mots mathématiques valides de 3 lettres
  const mathKeywords = new Set(['max', 'min', 'cos', 'sin', 'tan', 'log', 'exp', 'sup', 'inf', 'lim', 'det']);
  const proseWords = words.filter(w => !mathKeywords.has(w.toLowerCase()));
  // S'il y a 2 mots ou plus de langage courant (ex: "Transfer function", "Multiply numerator", "This is", "En déduire", "Dans le circuit"), c'est de la prose !
  return proseWords.length >= 2;
}

/**
 * Supprime radicalement les réflexions internes (scratchpad), balises <think>
 * et monologues de brainstorming en anglais générés par les modèles de raisonnement (Kimi, DeepSeek R1, Qwen...)
 */
export function stripAiReasoningScratchpad(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  // 1. Suppression des balises <think>...</think>, <thought>...</thought>, <reasoning>...</reasoning>
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();

  // 2. Balise <think> ouverte mais non fermée (si la réponse a été tronquée en cours de pensée)
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*$/gi, '').trim();
  cleaned = cleaned.replace(/<reasoning>[\s\S]*$/gi, '').trim();

  // 3. Suppression des préambules de réflexion interne en anglais
  const reasoningMonologuePatterns = [
    /^(?:[\s\S]*?\b(?:Let['’]s think|Waitcheck|The figure caption|doesn['’]t indicate|We need infer|retire la self['’]? ambiguous|Thisisaband-stop|Actually in the original circuit)\b[\s\S]*?\n\n)/i,
    /^(?:(?:out and feedback branches|Standard active first-order|The figure caption text)[\s\S]*?\n\n)/i,
  ];

  for (const pat of reasoningMonologuePatterns) {
    if (pat.test(cleaned)) {
      cleaned = cleaned.replace(pat, '').trim();
    }
  }

  // 4. Si après nettoyage le texte commence encore par un monologue en anglais,
  // cherchons le premier vrai titre Markdown (#, ##, ###) ou le début d'une explication en français
  const frenchOrHeadingIdx = cleaned.search(/(?:\n\s*|^)(?:#{1,3}\s+|(?:\*\*|__)?(?:Question|Exercice|[EÉ]tape|Partie|Démonstration|Calcul|Analyse|Pour|Dans|Soit|On|Le|La|Les|D'après|Notons|Considérons)\b)/i);
  if (frenchOrHeadingIdx > 0 && frenchOrHeadingIdx < 1500) {
    const preamble = cleaned.slice(0, frenchOrHeadingIdx);
    if (/\b(?:think|wait|circuit|maybe|suggests|removes|removing|leaving|replaces|sistor|op-amp|inverting|feedback|series|parallel|branch|figure|caption|infer)\b/i.test(preamble) &&
        !/\b(?:bonjour|voici|étudiant|question|résolution|exercice)\b/i.test(preamble)) {
      cleaned = cleaned.slice(frenchOrHeadingIdx).trim();
    }
  }

  return cleaned;
}

/**
 * Convertit intelligemment les notations scientifiques ASCII et les fractions avec slash '/'
 * en vraies fractions LaTeX verticales \dfrac{numérateur}{dénominateur} avec barre horizontale nette.
 */
export function convertAsciiMathToLatex(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let res = text;

  // 1. Toujours promouvoir \frac en \dfrac pour assurer une fraction haute avec barre horizontale
  res = res.replace(/\\frac\b/g, '\\dfrac');

  // Répare les commandes LaTeX dénudées de leur antislash (ex: underlineT -> \underline{T}, underlineU -> \underline{U})
  res = res
    .replace(/(?<!\\)\bunderline([A-Za-z])(?:_([0-9a-zA-Z]+))?/g, '\\underline{$1}$2')
    .replace(/(?<!\\)\bunderline\{/g, '\\underline{')
    .replace(/(?<!\\)\bdfrac\b/g, '\\dfrac')
    .replace(/(?<!\\)\bleft\(/g, '\\left(')
    .replace(/(?<!\\)\bright\)/g, '\\right)')
    .replace(/(?<!\\)\bmathrm\{/g, '\\mathrm{')
    .replace(/(?<!\\)\binfty\b/g, '\\infty')
    .replace(/(?<!\\)\bomega_0\b/g, '\\omega_0')
    .replace(/(?<!\\)\bomega\b/g, '\\omega')
    .replace(/(?<!\\)\bDelta\s*([a-zA-Z])/g, '\\Delta $1');

  // Nettoyage préalable de fractions corrompues comme \dfrac{R_2}{\dfrac}{R_1}
  res = res.replace(/\\dfrac\{([^{}]+)\}\{\\dfrac\}\{([^{}]+)\}/g, '\\dfrac{$1}{$2}');

  // 2. Conversion de pi et symboles grecs
  res = res.replace(/π/g, '\\pi');

  // 3. Conversion de la racine carrée Unicode √ ou sqrt
  res = res
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/√([a-zA-Z0-9_]+)/g, '\\sqrt{$1}')
    .replace(/\bsqrt\(([^)]+)\)/gi, '\\sqrt{$1}')
    .replace(/(?<!\\)\bsqrt\{/g, '\\sqrt{');

  // 4. Variables fréquentes avec indices (w0, f0, Q0, A0, R1, R2, etc.)
  res = res
    .replace(/w0/g, '\\omega_0')
    .replace(/w_0/g, '\\omega_0')
    .replace(/\bf0\b/g, 'f_0')
    .replace(/\bf_0\b/g, 'f_0')
    .replace(/\bQ0\b/g, 'Q_0')
    .replace(/\bQ_0\b/g, 'Q_0')
    .replace(/\bA0\b/g, 'A_0')
    .replace(/\bA_0\b/g, 'A_0')
    .replace(/\bR1\b/g, 'R_1')
    .replace(/\bR2\b/g, 'R_2')
    .replace(/\bC1\b/g, 'C_1')
    .replace(/\bC2\b/g, 'C_2');

  // En contexte de pulsation (ex: w/\omega_0 ou \omega_0/w ou jw)
  res = res
    .replace(/jw\b/g, 'j\\omega')
    .replace(/\bj\s*w\b/g, 'j\\omega')
    .replace(/\bw\s*\/\s*\\omega_0/g, '\\dfrac{\\omega}{\\omega_0}')
    .replace(/\\omega_0\s*\/\s*w\b/g, '\\dfrac{\\omega_0}{\\omega}');

  // 5. Fractions dans les racines \sqrt{L/C}
  res = res.replace(/\\sqrt\{([A-Za-z0-9_\\]+)\s*\/\s*([A-Za-z0-9_\\]+)\}/g, (match, n, d) => {
    if (!isMathToken(n) || !isMathToken(d)) return match;
    return `\\sqrt{\\dfrac{${n}}{${d}}}`;
  });

  // 6. Remplacement des fractions complexes avec crochets / [ ... ] ou parenthèses / ( ... )
  res = res.replace(/([A-Za-z0-9_\\\s^+\-*]+?)\s*\/\s*\[([^\]]+)\]/g, (match, n, d) => {
    if (!isMathToken(n)) return match;
    return `\\dfrac{${n}}{${d}}`;
  });
  res = res.replace(/([A-Za-z0-9_\\\s^+\-*]+?)\s*\/\s*\(([^()]+)\)/g, (match, n, d) => {
    if (!isMathToken(n)) return match;
    return `\\dfrac{${n}}{${d}}`;
  });

  // 7. Fractions imbriquées avec parenthèses
  for (let i = 0; i < 3; i++) {
    res = res.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}');
    res = res.replace(/\(([^()]+)\)\s*\/\s*([0-9a-zA-Z_\\]+)/g, (match, n, d) => {
      if (!isMathToken(d)) return match;
      return `\\dfrac{${n}}{${d}}`;
    });
    res = res.replace(/([0-9a-zA-Z_\\]+)\s*\/\s*\(([^()]+)\)/g, (match, n, d) => {
      if (!isMathToken(n)) return match;
      return `\\dfrac{${n}}{${d}}`;
    });
  }

  // 8. Fractions avec racine carrée: X / \sqrt{...}
  res = res.replace(/([0-9a-zA-Z_\\]+)\s*\/\s*(\\sqrt\{[^}]+\})/g, (match, n, d) => {
    if (!isMathToken(n)) return match;
    return `\\dfrac{${n}}{${d}}`;
  });

  // 9. Fractions simples sans parenthèses: R2/R1, L\omega_0/R1, 1/Q_0, p/\omega_0
  // Ne JAMAIS convertir des mots ordinaires comme series/parallel, input/output, and/or
  res = res.replace(/([0-9a-zA-Z_\\^]+)\s*\/\s*([0-9a-zA-Z_\\^]+)/g, (match, n, d) => {
    if (match.includes('http') || (/\d{2,4}\/\d{1,2}/.test(match) && !/[a-zA-Z_\\]/.test(match))) {
      return match;
    }
    if (!isMathToken(n) || !isMathToken(d)) {
      return match;
    }
    return `\\dfrac{${n}}{${d}}`;
  });

  // 10. Exposants ² -> ^2
  res = res.replace(/²/g, '^2').replace(/³/g, '^3');

  // Nettoyage des crochets résiduels autour d'une \dfrac
  res = res.replace(/\[\s*(\\dfrac\{[^{}]+\}\{[^{}]+\})\s*\]/g, '$1');

  // Réparation finale des fractions corrompues imbriquées
  res = res.replace(/\\dfrac\{([^{}]+)\}\{\\dfrac\}\{([^{}]+)\}/g, '\\dfrac{$1}{$2}');

  return res;
}

/**
 * Nettoie, répare et unifie les formules mathématiques (LaTeX / KaTeX)
 * Résout les corruptions typiques des LLMs :
 * 1. Dollars hachés au milieu des expressions (ex: Q$_0 = \frac{1}{1000}$\sqrt{...}$)
 * 2. Formules et options de quiz sans délimiteurs (ex: T(j\omega) = \dfrac{T_0}{...})
 * 3. Commandes mathématiques hors mode maths (ex: \boxed{...}, \underline{...})
 * 4. Caractères d'échappement corrompus (\x0c, \x08)
 */
function healMathLine(rawLine: string, inlineMode: boolean): string {
  let line = rawLine.trim();
  if (!line) return '';

  // 1. Convertir les fractions ASCII / et variables scientifiques si la ligne semble contenir des formules
  const seemsMath = /[=+\-*/^√π]|\\(?:d?frac|sqrt|omega|alpha|beta|pi|boxed)|(?:\b(?:w0|f0|Q0|A0|R1|R2|Cp)\b)/.test(line);
  if (seemsMath) {
    line = convertAsciiMathToLatex(line);
  }

  const hasLatexCmds = /\\(?:d?frac|sqrt|boxed|underline|omega|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|Omega|Delta|times|approx|infty|pm|to|Rightarrow|leftarrow|Leftarrow|quad|qquad|left|right|sum|int|prod|lim|cdot|text)\b/i.test(line);

  // Si aucun symbole LaTeX, retourner tel quel
  if (!hasLatexCmds) return line;

  // Détecter formellement si la ligne contient de la prose explicative
  const hasProse = containsNaturalLanguageProse(line);

  // Détecter si la ligne entière est une expression ou une équation mathématique PURE
  // RÈGLE CRITIQUE : Si la ligne contient de la prose (du texte avec des mots ordinaires),
  // elle ne doit JAMAIS être considérée comme une équation complète et ne doit JAMAIS
  // être emballée dans $$...$$, car cela supprimerait les espaces entre les mots !
  const isEntireEquationLine = !hasProse && (
    /^\\(?:boxed|underline|d?frac|sqrt)/.test(line) ||
    /^[A-Za-z0-9\(\)\,\s\\_]+\s*=\s*[^=]+$/.test(line) ||
    /^[\$\s]*[A-Za-z0-9\(\)\,\s\\_]+(=|\\approx|\\to|\\Rightarrow)/.test(line)
  );

  if (isEntireEquationLine) {
    // Retirer tous les $ non échappés disséminés à l'intérieur
    let cleanEq = line.replace(/(?<!\\)\$/g, '').trim();

    // Répare \text{k\Omega} ou k\Omega
    cleanEq = cleanEq
      .replace(/\\text\{\s*k\s*\\?\s*Omega\s*\}/gi, '\\text{k}\\Omega')
      .replace(/k\s*\\Omega/gi, '\\text{k}\\Omega');

    // Équilibrage parfait des accolades { ... }
    let openBraces = (cleanEq.match(/\{/g) || []).length;
    let closeBraces = (cleanEq.match(/\}/g) || []).length;
    while (closeBraces > openBraces && cleanEq.endsWith('}')) {
      cleanEq = cleanEq.slice(0, -1);
      closeBraces--;
    }
    if (openBraces > closeBraces) {
      cleanEq += '}'.repeat(openBraces - closeBraces);
    }

    return inlineMode ? `$${cleanEq}$` : `$$${cleanEq}$$`;
  }

  // 3. Détecter un préfixe textuel (ex: "Ordre 1 : ", "Gain statique : ", "Fonction de transfert : ") suivi d'une formule
  if (!line.includes('$')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < line.length - 2) {
      const prefix = line.substring(0, colonIdx + 1);
      const remainder = line.substring(colonIdx + 1).trim();
      const remainderHasLatex = /\\(?:d?frac|sqrt|boxed|underline|omega|alpha|beta|pi|Delta|infty|left|right)\b|(?:\b(?:w0|f0|Q0|A0|R1|R2)\b)/i.test(remainder);
      if (remainderHasLatex && !containsNaturalLanguageProse(remainder)) {
        return `${prefix} $${remainder}$`;
      }
    }
    // Si la ligne entière contient du LaTeX sans aucun dollar (ex: options de quiz ou expressions brutes)
    if (!hasProse) {
      if (/^[A-Za-z\(\)\,\s\\]+=/.test(line) || /^\\(?:d?frac|sqrt|boxed|left|right|underline)/.test(line) || /\\(?:d?frac|sqrt|boxed|underline|omega|alpha|beta|pi|Delta|infty)\b/.test(line)) {
        return inlineMode ? `$${line}$` : `$$${line}$$`;
      }
    }
  }

  return line;
}

function sanitizeLatexInput(rawText: string, inlineMode: boolean): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let sanitized = rawText
    // 1. Répare les caractères de contrôle corrompus par le parsing JSON :
    .replace(/[\x0c\u000c]/g, '\\f')
    .replace(/[\x08\u0008]/g, '\\b')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\${3,}/g, '$$')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 2. Traitement ligne par ligne pour soigner les équations morcelées
  const lines = sanitized.split('\n');
  sanitized = lines.map(l => healMathLine(l, inlineMode)).join('\n');

  // 3. Correction des symboles parasites dans \text{...}
  sanitized = sanitized
    .replace(/\\text\{([^{}]*)\}\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '\\text{$1 }\\Omega')
    .replace(/\\text\{([^{}]*)\\?\$+(\\?Omega|\bOmega\b)\}/gi, '\\text{$1 }\\Omega')
    .replace(/\\text\{([^{}]*)\\?\$+([^{}]*)\}/gi, '\\text{$1$2}')
    .replace(/([0-9]+)\s*k\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\text{ k}\\Omega')
    .replace(/([a-zA-Z0-9])\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\Omega')
    .replace(/\\\$+(\\?Omega|\bOmega\b)/gi, '\\Omega')
    .replace(/\bk\s*\\?\$+(\\?Omega)\$?/gi, '\\text{k }\\Omega')
    .replace(/\\k\\Omega\b/gi, '\\text{k}\\Omega');

  // 4. Fermeture automatique des blocs $$ non fermés
  const paragraphs = sanitized.split(/\n{2,}/);
  sanitized = paragraphs
    .map((para) => {
      const doubleDollarMatches = para.match(/\$\$/g);
      if (doubleDollarMatches && doubleDollarMatches.length % 2 !== 0) {
        return para.trimEnd() + ' $$';
      }
      return para;
    })
    .join('\n\n');

  // 5. Envelopper les commandes LaTeX orphelines avec accolades imbriquées dans des $ ... $
  sanitized = wrapOrphanLatexInDollars(sanitized);

  return sanitized;
}

/**
 * Extrait proprement une commande LaTeX complète avec équilibrage parfait des accolades imbriquées
 */
function extractBalancedLatexCommand(str: string, startIdx: number): { fullMatch: string; endIdx: number } | null {
  const cmdMatch = str.slice(startIdx).match(/^\\(?:d?frac|sqrt|boxed|underline)\b/);
  if (!cmdMatch) return null;
  const cmd = cmdMatch[0];
  let idx = startIdx + cmd.length;
  const expectedArgs = (cmd.includes('frac')) ? 2 : 1;
  const args: string[] = [];

  while (args.length < expectedArgs && idx < str.length) {
    while (idx < str.length && str[idx] !== '{' && /\s/.test(str[idx])) {
      idx++;
    }
    if (str[idx] !== '{') break;

    const openIdx = idx;
    let depth = 0;
    while (idx < str.length) {
      if (str[idx] === '{') depth++;
      else if (str[idx] === '}') {
        depth--;
        if (depth === 0) {
          args.push(str.slice(openIdx, idx + 1));
          idx++;
          break;
        }
      }
      idx++;
    }
  }

  if (args.length === expectedArgs) {
    return { fullMatch: str.slice(startIdx, idx), endIdx: idx };
  }
  return null;
}

/**
 * Parcourt le texte et enveloppe toute commande LaTeX (\dfrac, \frac, \sqrt) orpheline
 * non entourée de dollars dans des délimiteurs $ ... $ complets.
 */
function wrapOrphanLatexInDollars(text: string): string {
  if (!text || !text.includes('\\')) return text;

  let result = '';
  let i = 0;
  let inSingleDollar = false;
  let inDoubleDollar = false;

  while (i < text.length) {
    if (text.startsWith('$$', i)) {
      inDoubleDollar = !inDoubleDollar;
      result += '$$';
      i += 2;
      continue;
    }
    if (text[i] === '$' && !inDoubleDollar) {
      inSingleDollar = !inSingleDollar;
      result += '$';
      i++;
      continue;
    }

    if (inSingleDollar || inDoubleDollar) {
      result += text[i];
      i++;
      continue;
    }

    if (text[i] === '\\') {
      const balanced = extractBalancedLatexCommand(text, i);
      if (balanced) {
        result += `$${balanced.fullMatch}$`;
        i = balanced.endIdx;
        continue;
      }
    }

    result += text[i];
    i++;
  }

  return result;
}

/**
 * Tentative de rendu KaTeX avec réparation automatique si la formule comporte une erreur de syntaxe mineure
 */
function renderKaTeXSafe(mathExpr: string, displayMode: boolean): string | null {
  let trimmed = mathExpr.trim();
  if (!trimmed) return '';

  // Forcer \dfrac pour que la barre horizontale soit toujours bien nette et que le numérateur soit en haut et le dénominateur en bas
  trimmed = trimmed.replace(/\\frac\b/g, '\\dfrac');

  // Réparation de l'équilibre des accolades { ... }
  let openBraces = (trimmed.match(/\{/g) || []).length;
  let closeBraces = (trimmed.match(/\}/g) || []).length;
  while (closeBraces > openBraces && trimmed.endsWith('}')) {
    trimmed = trimmed.slice(0, -1);
    closeBraces--;
  }
  if (openBraces > closeBraces) {
    trimmed += '}'.repeat(openBraces - closeBraces);
  }

  try {
    let html = katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
    // SUPPRESSION STRICTE DU ROUGE : Ne jamais polluer l'affichage de l'étudiant avec du rouge
    if (html.includes('katex-error') || html.includes('#cc0000')) {
      html = html.replace(/style="color:#cc0000"/gi, 'class="font-mono text-zinc-300"');
      html = html.replace(/class="katex-error"/gi, 'class="katex-fallback text-zinc-300 font-mono"');
    }
    return html;
  } catch {
    return null;
  }
}

export const MathText: React.FC<MathTextProps> = ({
  text,
  content,
  className = '',
  inline = false,
}) => {
  const sourceText = text ?? content ?? '';

  const renderedContent = useMemo(() => {
    if (!sourceText || typeof sourceText !== 'string') return null;

    // 1. Nettoyage et assainissement des corruptions LaTeX
    const sanitized = sanitizeLatexInput(sourceText, inline);

    // 2. Pattern pour extraire les blocs mathématiques $$...$$ et inline $...$
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n\r]+?\$)/g;
    const parts = sanitized.split(regex);

    return parts.map((part, idx) => {
      // Formule en bloc ($$ ... $$)
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        const math = part.slice(2, -2).trim();
        const isBlock = !inline;
        const html = renderKaTeXSafe(math, isBlock);
        if (html) {
          return (
            <span
              key={idx}
              className={isBlock ? "my-3 block overflow-x-auto custom-scrollbar text-center py-1 select-text text-[1.15em]" : "inline-math mx-1.5 inline-block align-middle select-text text-[1.12em]"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={idx} className="font-mono text-zinc-300">{part}</span>;
      }

      // Formule en ligne ($ ... $)
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const math = part.slice(1, -1).trim();
        const html = renderKaTeXSafe(math, false);
        if (html) {
          return (
            <span
              key={idx}
              className="inline-math mx-1.5 inline-block align-middle select-text text-[1.12em]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={idx} className="font-mono text-zinc-300">{part}</span>;
      }

      // Rendu du texte avec prise en compte du gras **texte**
      const subParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={idx}>
          {subParts.map((sub, sIdx) => {
            if (sub.startsWith('**') && sub.endsWith('**') && sub.length > 4) {
              return (
                <strong key={sIdx} className="font-bold text-white">
                  {sub.slice(2, -2)}
                </strong>
              );
            }
            return sub;
          })}
        </span>
      );
    });
  }, [sourceText, inline]);

  if (inline) {
    return <span className={className}>{renderedContent}</span>;
  }

  return <div className={className}>{renderedContent}</div>;
};

/**
 * Composant MathRenderer réutilisable (alias pour compatibilité avec toutes les conventions de props)
 */
export const MathRenderer: React.FC<MathTextProps> = (props) => {
  return <MathText {...props} />;
};

export default MathText;
