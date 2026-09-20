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
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\${3,}/g, '$$') // Corrige les séries anormales de dollars ($$$$$ -> $$)
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$') // Standardise \[ ... \] en $$ ... $$
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');   // Standardise \( ... \) en $ ... $

    // 2. Pattern pour extraire les blocs mathématiques $$...$$ et inline $...$
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
