import React, { useState } from 'react';
import { Copy, Check, FileText, Code as CodeIcon } from 'lucide-react';
import katex from 'katex';

interface TextCodeRendererProps {
  data: {
    text?: string;
    code?: string;
    content?: any;
    language?: string;
    latex?: string;
  };
  title?: string;
}

export function TextCodeRenderer({ data, title }: TextCodeRendererProps) {
  const [copied, setCopied] = useState(false);

  const rawText = data.text || data.code || (typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2)) || '';
  const isCode = !!data.code || !!data.language;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Traiter les éventuelles formules LaTeX
  const renderLatex = (formula: string) => {
    try {
      return {
        __html: katex.renderToString(formula, { throwOnError: false, displayMode: true })
      };
    } catch {
      return { __html: formula };
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar text-zinc-100">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-700/60">
        <div className="flex items-center gap-2 min-w-0">
          {isCode ? (
            <CodeIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="text-sm font-bold text-zinc-200 truncate">
            {title || (isCode ? 'Code source' : 'Document texte')}
          </span>
          {data.language && (
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {data.language}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-zinc-700 shrink-0"
          title="Copier le contenu"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copié' : 'Copier'}</span>
        </button>
      </div>

      {data.latex && (
        <div 
          className="my-3 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 text-center overflow-x-auto"
          dangerouslySetInnerHTML={renderLatex(data.latex)}
        />
      )}

      {isCode ? (
        <pre className="font-mono text-xs sm:text-sm bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 overflow-x-auto text-emerald-300 leading-relaxed shadow-inner">
          <code>{rawText}</code>
        </pre>
      ) : (
        <div className="text-sm sm:text-base leading-relaxed text-zinc-200 whitespace-pre-wrap font-sans">
          {rawText}
        </div>
      )}
    </div>
  );
}
export default TextCodeRenderer;
