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

    // Pattern pour détecter $$math$$ (bloc) et $math$ (inline)
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
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
              className="my-2 block overflow-x-auto custom-scrollbar text-center py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={idx} className="font-mono text-orange-400">{part}</span>;
        }
      } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
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
              className="inline-math mx-0.5 inline-block align-middle"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={idx} className="font-mono text-orange-400">{part}</span>;
        }
      }

      // Rendu du texte régulier avec prise en compte du gras **texte**
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
  }, [text]);

  if (inline) {
    return <span className={className}>{renderedContent}</span>;
  }

  return <div className={className}>{renderedContent}</div>;
};
