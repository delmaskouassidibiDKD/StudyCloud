import React, { useState } from 'react';
import { FileText, Printer, Download, Copy, Check, Sparkles, BookOpen } from 'lucide-react';
import { DocumentContent } from './types';

interface ExportableDocumentViewProps {
  title: string;
  sourceFileName?: string;
  content: DocumentContent;
  onUpdateContent?: (newContent: DocumentContent) => void;
}

export const ExportableDocumentView: React.FC<ExportableDocumentViewProps> = ({
  title,
  sourceFileName,
  content,
}) => {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    let fullText = `${content.title || title}\n`;
    if (content.subtitle) fullText += `${content.subtitle}\n`;
    if (sourceFileName) fullText += `Source : ${sourceFileName}\n`;
    fullText += `Date : ${content.dateStr || new Date().toLocaleDateString('fr-FR')}\n\n`;

    content.sections?.forEach((sec, idx) => {
      fullText += `=== ${idx + 1}. ${sec.heading} ===\n${sec.body}\n`;
      if (sec.bulletPoints?.length) {
        fullText += sec.bulletPoints.map(b => `• ${b}`).join('\n') + '\n';
      }
      if (sec.highlightBox) {
        fullText += `[Note importante : ${sec.highlightBox}]\n`;
      }
      fullText += '\n';
    });

    if (content.summaryBox) {
      fullText += `=== CONCLUSION & SYNTHÈSE ===\n${content.summaryBox}\n`;
    }

    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 animate-fadeIn p-1">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">Document d'Étude</h2>
            <p className="text-xs text-zinc-400 font-medium">Exportable PDF & Word</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            title="Copier pour Word ou Google Docs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            title="Imprimer ou enregistrer en PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer / PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet View */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <div className="bg-[#FAF8F5] text-stone-900 border-2 border-stone-800 rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#1c1917] space-y-6 print:shadow-none print:border-none print:p-0">
          {/* Academic Header */}
          <div className="border-b-2 border-stone-800 pb-4 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                StudyCloud • Document Officiel de Révision
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
                {content.title || title}
              </h1>
              {content.subtitle && (
                <p className="text-sm font-semibold text-stone-600 mt-0.5">
                  {content.subtitle}
                </p>
              )}
            </div>

            <div className="text-right text-[11px] text-stone-500 font-medium">
              <div>{content.dateStr || new Date().toLocaleDateString('fr-FR')}</div>
              {sourceFileName && <div className="font-semibold text-stone-700">Source: {sourceFileName}</div>}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {content.sections?.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-stone-900 text-white flex items-center justify-center text-xs font-black">
                    {idx + 1}
                  </span>
                  {sec.heading}
                </h3>
                <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-normal">
                  {sec.body}
                </p>

                {sec.bulletPoints && sec.bulletPoints.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-stone-700">
                    {sec.bulletPoints.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}

                {sec.highlightBox && (
                  <div className="bg-amber-100 border-l-4 border-amber-500 p-3 rounded-r-lg text-xs sm:text-sm text-amber-900 font-medium">
                    📌 <strong>Remarque :</strong> {sec.highlightBox}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Callout Box */}
          {content.summaryBox && (
            <div className="bg-stone-100 border border-stone-300 rounded-xl p-4 mt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1">
                Synthèse générale
              </span>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                {content.summaryBox}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
