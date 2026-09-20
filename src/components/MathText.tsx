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
function sanitizeLatexInput(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let sanitized = rawText
    // 1. Répare les caractères de contrôle corrompus par le parsing JSON :
    // \f (Form Feed, ASCII 12, \x0c) corrompt \frac en "\x0crac" (affiché comme une flèche noire ou symbole bizarre)
    .replace(/[\x0c\u000c]/g, '\\f')
    // \b (Backspace, ASCII 8, \x08) corrompt \beta en "\x08eta"
    .replace(/[\x08\u0008]/g, '\\b')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Corrige les séries anormales de dollars ($$$$$ -> $$)
    .replace(/\${3,}/g, '$$')
    // Standardise \[ ... \] en $$ ... $$ et \( ... \) en $ ... $
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 2. CORRECTION CRUCIALE DES SYMBOLES PARASITES (ex: $R_2 = 120 \text{k}\$\Omega$)
  // L'IA génère parfois des $ parasites avant \Omega ou à l'intérieur de \text{...}
  sanitized = sanitized
    // \text{k}\$\Omega ou \text{k}$\Omega -> \text{k }\Omega
    .replace(/\\text\{([^{}]*)\}\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '\\text{$1 }\\Omega')
    // \text{k\$\Omega} -> \text{k }\Omega
    .replace(/\\text\{([^{}]*)\\?\$+(\\?Omega|\bOmega\b)\}/gi, '\\text{$1 }\\Omega')
    // \text{k\$} -> \text{k}
    .replace(/\\text\{([^{}]*)\\?\$+([^{}]*)\}/gi, '\\text{$1$2}')
    // 120 k\$\Omega ou 120 k$\Omega -> 120 \text{ k}\Omega
    .replace(/([0-9]+)\s*k\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\text{ k}\\Omega')
    // (lettre ou chiffre)\$\Omega ou \$\Omega -> \Omega
    .replace(/([a-zA-Z0-9])\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\Omega')
    .replace(/\\\$+(\\?Omega|\bOmega\b)/gi, '\\Omega')
    // k$\Omega$ -> \text{k}\Omega
    .replace(/\bk\s*\\?\$+(\\?Omega)\$?/gi, '\\text{k }\\Omega')
    // Traitement de \k\Omega -> \text{k}\Omega
    .replace(/\\k\\Omega\b/gi, '\\text{k}\\Omega');

  // 3. Fermeture automatique des blocs $$ non fermés avant double saut de ligne ou fin de texte
  const paragraphs = sanitized.split(/\n{2,}/);
  sanitized = paragraphs
    .map((para) => {
      const doubleDollarMatches = para.match(/\$\$/g);
      if (doubleDollarMatches && doubleDollarMatches.length % 2 !== 0) {
        // Un bloc $$ n'a pas été refermé dans ce paragraphe
        return para.trimEnd() + ' $$';
      }
      return para;
    })
    .join('\n\n');

  // 4. Encadrement automatique des équations scientifiques orphelines (non entourées de $)
  // Capture les équations avec fractions ou signes comme : V_s = -\frac{R_2}{R_1} V_e
  sanitized = sanitized.replace(
    /(?<!\$)(?:[A-Za-z_0-9]+(?:_[A-Za-z0-9]+)?\s*=\s*)?[-+]?\\frac\{[^{}]+\}\{[^{}]+\}(?:\s*[A-Za-z_0-9]+(?:_[A-Za-z0-9]+)?)?(?!\$)/g,
    (match) => `$${match.trim()}$`
  );

  // Capture les fractions isolées \frac{...}{...} non entourées de $
  sanitized = sanitized.replace(/(?<!\$)\\frac\{[^{}]+\}\{[^{}]+\}(?!\$)/g, (match) => `$${match.trim()}$`);

  // Capture les fonctions ou symboles scientifiques majeurs orphelins (ex: \sqrt{...}, \Omega, \sum, \int, \alpha, \beta, etc.)
  sanitized = sanitized.replace(
    /(?<!\$)\\(?:sqrt|sum|int|prod|lim|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|omega|Delta|Omega|times|pm|approx|infty)\b[^{}\s]*(?:\{[^{}]*\})*(?!\$)/g,
    (match) => `$${match.trim()}$`
  );

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
        .replace(/\\?\$+$/, '') // Supprime les dollars résiduels à la fin
        .replace(/^\\?\$+/, ''); // Supprime les dollars résiduels au début

      // Réparation de l'équilibre des accolades { ... }
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
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
    const sanitized = sanitizeLatexInput(sourceText);

    // 2. Pattern pour extraire les blocs mathématiques $$...$$ et inline $...$
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n\r]+?\$)/g;
    const parts = sanitized.split(regex);

    return parts.map((part, idx) => {
      // Formule en bloc ($$ ... $$)
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        const math = part.slice(2, -2).trim();
        const html = renderKaTeXSafe(math, true);
        if (html) {
          return (
            <span
              key={idx}
              className="my-2.5 block overflow-x-auto custom-scrollbar text-center py-1 select-text"
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

      // Traitement des fractions LaTeX orphelines non entourées de dollars (ex: \frac{a}{b})
      if (part.includes('\\frac{') || part.includes('\\sqrt{') || part.includes('\\sum_')) {
        try {
          const subRegex = /(\\(?:frac|sqrt|sum|int|lim|prod)\b[^{}]*(?:\{[^{}]*\}){1,3})/g;
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
  }, [sourceText]);

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
