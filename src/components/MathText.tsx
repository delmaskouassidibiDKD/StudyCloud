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
 * Convertit intelligemment les notations scientifiques ASCII et les fractions avec slash '/'
 * en vraies fractions LaTeX verticales \dfrac{numérateur}{dénominateur} avec barre horizontale nette.
 */
export function convertAsciiMathToLatex(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let res = text;

  // 1. Toujours promouvoir \frac en \dfrac pour assurer une fraction haute avec barre horizontale
  res = res.replace(/\\frac\b/g, '\\dfrac');

  // 2. Conversion de pi et symboles grecs
  res = res.replace(/π/g, '\\pi');

  // 3. Conversion de la racine carrée Unicode √ ou sqrt
  res = res
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/√([a-zA-Z0-9_]+)/g, '\\sqrt{$1}')
    .replace(/\bsqrt\(([^)]+)\)/gi, '\\sqrt{$1}');

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
  res = res.replace(/\\sqrt\{([A-Za-z0-9_\\]+)\s*\/\s*([A-Za-z0-9_\\]+)\}/g, '\\sqrt{\\dfrac{$1}{$2}}');

  // 6. Remplacement des fractions complexes avec crochets / [ ... ] ou parenthèses / ( ... )
  res = res.replace(/([A-Za-z0-9_\\\s^+\-*]+?)\s*\/\s*\[([^\]]+)\]/g, '\\dfrac{$1}{$2}');
  res = res.replace(/([A-Za-z0-9_\\\s^+\-*]+?)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}');

  // 7. Fractions imbriquées avec parenthèses
  for (let i = 0; i < 3; i++) {
    res = res.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}');
    res = res.replace(/\(([^()]+)\)\s*\/\s*([0-9a-zA-Z_\\]+)/g, '\\dfrac{$1}{$2}');
    res = res.replace(/([0-9a-zA-Z_\\]+)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}');
  }

  // 8. Fractions avec racine carrée: X / \sqrt{...}
  res = res.replace(/([0-9a-zA-Z_\\]+)\s*\/\s*(\\sqrt\{[^}]+\})/g, '\\dfrac{$1}{$2}');

  // 9. Fractions simples sans parenthèses: R2/R1, L\omega_0/R1, 1/Q_0, p/\omega_0
  res = res.replace(/([0-9a-zA-Z_\\^]+)\s*\/\s*([0-9a-zA-Z_\\^]+)/g, (match, n, d) => {
    if (match.includes('http') || (/\d{2,4}\/\d{1,2}/.test(match) && !/[a-zA-Z_\\]/.test(match))) {
      return match;
    }
    return `\\dfrac{${n}}{${d}}`;
  });

  // 10. Exposants ² -> ^2
  res = res.replace(/²/g, '^2').replace(/³/g, '^3');

  // Nettoyage des crochets résiduels autour d'une \dfrac
  res = res.replace(/\[\s*(\\dfrac\{[^{}]+\}\{[^{}]+\})\s*\]/g, '$1');

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

  // Si c'est du texte pur en français (prose d'introduction comme "Le module est :" ou "Aux basses fréquences :")
  const isProse = /^(?:Le|La|Les|Mais|Comme|Pour|Avec|Si|Dans|On|Donc|Or|Notons|Soit|En|De|D'après|Aux|Question|Remarque)\b/i.test(line.replace(/^\*+|\*+$/g, '').trim());

  // Détecter si la ligne entière est une expression ou une équation mathématique
  const isEntireEquationLine = !isProse && (
    /^\\(?:boxed|underline|d?frac|sqrt)/.test(line) ||
    /[=]|\\approx|\\to|\\Rightarrow/.test(line)
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

  // Si la ligne contient du LaTeX sans aucun dollar (ex: options de quiz "T(j\omega) = \dfrac{T_0}{...}")
  if (!line.includes('$')) {
    if (/^[A-Za-z\(\)\,\s\\]+=/.test(line) || /^\\(?:d?frac|sqrt|boxed|left|right)/.test(line)) {
      return inlineMode ? `$${line}$` : `$$${line}$$`;
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

  return sanitized;
}

/**
 * Tentative de rendu KaTeX avec réparation automatique si la formule comporte une erreur de syntaxe mineure
 */
function renderKaTeXSafe(mathExpr: string, displayMode: boolean): string | null {
  let trimmed = mathExpr.trim();
  if (!trimmed) return '';

  // Forcer \dfrac pour que la barre horizontale soit toujours bien nette et que le numérateur soit en haut et le dénominateur en bas
  trimmed = trimmed.replace(/\\frac\b/g, '\\dfrac');

  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    // Tentative de réparation de syntaxe en cas de délimiteur ou antislash orphelin
    try {
      let repaired = trimmed
        .replace(/\\+$/, '') // Supprime les antislashs traînants en fin d'expression
        .replace(/(?<!\\)\$/g, ''); // Supprime les dollars résiduels

      // Réparation de l'équilibre des accolades { ... }
      let openBraces = (repaired.match(/\{/g) || []).length;
      let closeBraces = (repaired.match(/\}/g) || []).length;
      while (closeBraces > openBraces && repaired.endsWith('}')) {
        repaired = repaired.slice(0, -1);
        closeBraces--;
      }
      if (openBraces > closeBraces) {
        repaired += '}'.repeat(openBraces - closeBraces);
      }

      return katex.renderToString(repaired, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return null;
    }
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
              className={isBlock ? "my-2.5 block overflow-x-auto custom-scrollbar text-center py-1 select-text" : "inline-math mx-1 inline-block align-middle select-text"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={idx} className="font-mono text-amber-600 dark:text-amber-400">{part}</span>;
      }

      // Formule en ligne ($ ... $)
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const math = part.slice(1, -1).trim();
        const html = renderKaTeXSafe(math, false);
        if (html) {
          return (
            <span
              key={idx}
              className="inline-math mx-0.5 inline-block align-middle select-text"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={idx} className="font-mono text-amber-600 dark:text-amber-400">{part}</span>;
      }

      // Traitement des fractions ou commandes LaTeX orphelines non entourées de dollars (ex: \frac{a}{b}, \dfrac{a}{b})
      if (part.includes('\\frac') || part.includes('\\dfrac') || part.includes('\\sqrt') || part.includes('\\sum') || part.includes('\\boxed')) {
        try {
          const subRegex = /(\\(?:d?frac|sqrt|sum|int|lim|prod|boxed|underline)\b[^{}]*(?:\{[^{}]*\}){1,4})/g;
          const subMathParts = part.split(subRegex);
          if (subMathParts.length > 1) {
            return (
              <span key={idx}>
                {subMathParts.map((subM, smIdx) => {
                  if (subM.startsWith('\\')) {
                    const html = renderKaTeXSafe(subM, false);
                    if (html) {
                      return (
                        <span
                          key={smIdx}
                          className="inline-math mx-0.5 inline-block align-middle select-text"
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      );
                    }
                    return subM;
                  }
                  return subM;
                })}
              </span>
            );
          }
        } catch {}
      }

      // Rendu du texte avec prise en compte du gras **texte**
      const subParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={idx}>
          {subParts.map((sub, sIdx) => {
            if (sub.startsWith('**') && sub.endsWith('**') && sub.length > 4) {
              return (
                <strong key={sIdx} className="font-bold">
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
