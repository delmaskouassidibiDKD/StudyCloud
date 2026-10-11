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
  const trimmed = mathExpr.trim();
  if (!trimmed) return '';

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
