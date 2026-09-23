import React from 'react';
import { Presentation, TrendingUp, CheckCircle, AlertTriangle, Lightbulb, Info, Sparkles } from 'lucide-react';
import { InfographicContent } from './types';

interface InfographicViewProps {
  title: string;
  sourceFileName?: string;
  content: InfographicContent;
  onUpdateContent?: (newContent: InfographicContent) => void;
}

export const InfographicView: React.FC<InfographicViewProps> = ({
  title,
  sourceFileName,
  content,
}) => {
  return (
    <div className="w-full h-full flex flex-col space-y-5 animate-fadeIn p-1 overflow-y-auto custom-scrollbar">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">
              {content.mainTitle || title}
            </h2>
            {sourceFileName && (
              <p className="text-xs text-zinc-400 font-medium truncate max-w-[240px]">
                Infographie de <span className="text-cyan-300 font-semibold">{sourceFileName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {content.subtitle && (
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic bg-[#23252a] p-3 rounded-xl border border-zinc-700/50">
          « {content.subtitle} »
        </p>
      )}

      {/* Metrics Row (Stats Clés) */}
      {content.metrics && content.metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {content.metrics.map((m, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-[#27292f] to-[#1f2125] border border-cyan-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md relative overflow-hidden group hover:border-cyan-400/60 transition-all"
            >
              <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300 mb-1">
                {m.value}
              </div>
              <span className="text-xs font-bold text-zinc-300 leading-tight">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Key Concepts Blocks */}
      {content.keyConcepts && content.keyConcepts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-cyan-400 uppercase tracking-wider pl-1">
            <TrendingUp className="w-4 h-4" />
            <span>Piliers Fondamentaux ({content.keyConcepts.length})</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {content.keyConcepts.map((concept, idx) => (
              <div
                key={idx}
                className="bg-[#26282d] border border-zinc-700/60 rounded-xl p-4 hover:border-zinc-500 transition-all flex flex-col gap-1.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    {concept.title}
                  </h4>
                  {concept.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      {concept.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                  {concept.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights / Alert Callouts */}
      {content.highlights && content.highlights.length > 0 && (
        <div className="space-y-2.5">
          {content.highlights.map((h, idx) => {
            const isTip = h.type === 'tip';
            const isWarn = h.type === 'warning';
            const borderClass = isTip
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
              : isWarn
              ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
              : 'border-blue-500/30 bg-blue-950/20 text-blue-200';

            const IconComp = isTip ? Lightbulb : isWarn ? AlertTriangle : Info;

            return (
              <div key={idx} className={`p-3.5 rounded-xl border flex items-start gap-3 ${borderClass}`}>
                <IconComp className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  {h.title && <strong className="block font-bold mb-0.5">{h.title}</strong>}
                  <span>{h.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Conclusion / Takeaway */}
      {content.conclusion && (
        <div className="bg-gradient-to-r from-cyan-950/30 via-[#27292f] to-[#27292f] border border-cyan-500/40 rounded-2xl p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
          <p className="text-xs sm:text-sm text-cyan-100 font-medium leading-relaxed">
            {content.conclusion}
          </p>
        </div>
      )}
    </div>
  );
};
