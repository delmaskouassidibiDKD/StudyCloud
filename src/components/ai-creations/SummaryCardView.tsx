import React, { useState } from 'react';
import { AlignLeft, CheckCircle2, Bookmark, Lightbulb, BookOpen, Copy, Check, Sparkles } from 'lucide-react';
import { SummaryContent } from './types';
import { MathText } from '../MathText';

interface SummaryCardViewProps {
  title: string;
  sourceFileName?: string;
  content: SummaryContent;
  onUpdateContent?: (newContent: SummaryContent) => void;
}

export const SummaryCardView: React.FC<SummaryCardViewProps> = ({
  title,
  sourceFileName,
  content,
}) => {
  const [copied, setCopied] = useState(false);
  const [checkedPoints, setCheckedPoints] = useState<Record<number, boolean>>({});

  const togglePoint = (idx: number) => {
    setCheckedPoints(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopy = () => {
    let fullText = `${title}\n`;
    if (sourceFileName) fullText += `Source : ${sourceFileName}\n\n`;
    fullText += `--- VUE D'ENSEMBLE ---\n${content.overview}\n\n`;
    if (content.keyPoints?.length) {
      fullText += `--- POINTS CLÉS ---\n` + content.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') + '\n\n';
    }
    if (content.definitions?.length) {
      fullText += `--- DÉFINITIONS ---\n` + content.definitions.map(d => `• ${d.term} : ${d.definition}`).join('\n') + '\n\n';
    }
    if (content.rules?.length) {
      fullText += `--- RÈGLES / FORMULES ---\n` + content.rules.map(r => `• ${r}`).join('\n');
    }

    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="w-full h-full flex flex-col space-y-5 animate-fadeIn p-1">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm">
            <AlignLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">{title}</h2>
            {sourceFileName && (
              <p className="text-xs text-zinc-400 font-medium truncate max-w-[240px]">
                Basé sur <span className="text-blue-300 font-semibold">{sourceFileName}</span>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
          title="Copier le résumé"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copié</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>

      {/* Tags if any */}
      {content.tags && content.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {content.tags.map((tag, i) => (
            <span key={i} className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Overview Card */}
      {content.overview && (
        <div className="bg-[#282b31] border border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Synthèse essentielle</span>
          </div>
          <div className="text-sm text-zinc-200 leading-relaxed font-normal">
            <MathText text={content.overview} />
          </div>
        </div>
      )}

      {/* Key Points */}
      {content.keyPoints && content.keyPoints.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-zinc-300 uppercase tracking-wider pl-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Points clés à maîtriser ({content.keyPoints.length})</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {content.keyPoints.map((pt, idx) => {
              const isChecked = !!checkedPoints[idx];
              return (
                <div
                  key={idx}
                  onClick={() => togglePoint(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-400 line-through'
                      : 'bg-[#26282d] border-zinc-700/60 text-zinc-100 hover:border-zinc-500 hover:bg-[#2c2f35]'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 transition-colors ${
                    isChecked ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {isChecked ? '✓' : idx + 1}
                  </span>
                  <div className="text-xs sm:text-sm leading-snug font-medium flex-1">
                    <MathText text={pt} inline={true} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Definitions Card */}
      {content.definitions && content.definitions.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-violet-400 uppercase tracking-wider pl-1">
            <BookOpen className="w-4 h-4" />
            <span>Notions & Définitions ({content.definitions.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {content.definitions.map((def, idx) => (
              <div key={idx} className="bg-[#24262b] border border-violet-500/25 rounded-xl p-3.5 hover:border-violet-500/50 transition-colors">
                <span className="text-xs font-bold text-violet-300 block mb-1">
                  <MathText text={def.term} inline={true} />
                </span>
                <div className="text-[12px] text-zinc-300 leading-relaxed">
                  <MathText text={def.definition} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules / Formulas */}
      {content.rules && content.rules.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider pl-1">
            <Lightbulb className="w-4 h-4" />
            <span>Règles & Formules Clés</span>
          </div>
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 space-y-2">
            {content.rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-amber-200 font-medium">
                <span className="text-amber-400 font-bold">•</span>
                <div className="flex-1">
                  <MathText text={rule} inline={true} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
