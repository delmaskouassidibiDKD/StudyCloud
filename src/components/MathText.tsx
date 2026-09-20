import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text?: string;
  className?: string;
  inline?: boolean;
}

export const MathText: React.FC<MathTextProps> = ({ text = '', className = '', inline = false }) => {
  const renderedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return null;

    // 1. Nettoyage et assainissement des corruptions et variantes de syntaxe LaTeX
    let sanitized = text
      // Répare les caractères de contrôle corrompus par le parsing JSON :
      // \f (Form Feed, ASCII 12, \x0c) corrompt \frac en "\x0crac" (affiché comme une flèche noire ou symbole bizarre)
      .replace(/[\x0c\u000c]/g, '\\f')
      // \b (Backspace, ASCII 8, \x08) corrompt \beta en "\x08eta"
      .replace(/[\x08\u0008]/g, '\\b')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\${3,}/g, '$$') // Corrige les séries anormales de dollars ($$$$$ -> $$)
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$') // Standardise \[ ... \] en $$ ... $$
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');   // Standardise \( ... \) en $ ... $

    // 2. Encadrement automatique des équations scientifiques orphelines (non entourées de $)
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

    // 3. Pattern pour extraire les blocs mathématiques $$...$$ et inline $...$
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n\r]+?\$)/g;
    const parts = sanitized.split(regex);

    return parts.map((part, idx) => {
      // Formule en bloc ($$ ... $$)
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={idx}
              className="my-2.5 block overflow-x-auto custom-scrollbar text-center py-1 select-text"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={idx} className="font-mono text-amber-600 dark:text-amber-400">{part}</span>;
        }
      }

      // Formule en ligne ($ ... $)
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={idx}
              className="inline-math mx-0.5 inline-block align-middle select-text"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={idx} className="font-mono text-amber-600 dark:text-amber-400">{part}</span>;
        }
      }

      // Traitement des fractions LaTeX non entourées de dollars (ex: \frac{a}{b})
      if (part.includes('\\frac{') || part.includes('\\sqrt{') || part.includes('\\sum_')) {
        try {
          const subRegex = /(\\(?:frac|sqrt|sum|int|lim|prod)\b[^{}]*(?:\{[^{}]*\}){1,3})/g;
          const subMathParts = part.split(subRegex);
          if (subMathParts.length > 1) {
            return (
              <span key={idx}>
                {subMathParts.map((subM, smIdx) => {
                  if (subM.startsWith('\\')) {
                    try {
                      const html = katex.renderToString(subM, {
                        displayMode: false,
                        throwOnError: false,
                        strict: false,
                      });
                      return (
                        <span
                          key={smIdx}
                          className="inline-math mx-0.5 inline-block align-middle select-text"
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      );
                    } catch {
                      return subM;
                    }
                  }
                  return subM;
                })}
              </span>
            );
          }
        } catch {}
      }

      // Rendu du texte avec prise en compte du gras **texte** (couleur adaptable au thème)
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
  }, [text]);

  if (inline) {
    return <span className={className}>{renderedContent}</span>;
  }

  return <div className={className}>{renderedContent}</div>;
};
