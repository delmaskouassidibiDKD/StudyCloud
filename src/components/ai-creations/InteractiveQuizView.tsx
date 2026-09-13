import React, { useState } from 'react';
import { MessageSquare, CheckCircle2, XCircle, RotateCcw, Award, HelpCircle, ArrowRight } from 'lucide-react';
import { QuizContent } from './types';

interface InteractiveQuizViewProps {
  title: string;
  sourceFileName?: string;
  content: QuizContent;
  onUpdateContent?: (newContent: QuizContent) => void;
}

export const InteractiveQuizView: React.FC<InteractiveQuizViewProps> = ({
  title,
  sourceFileName,
  content,
}) => {
  const questions = content.questions || [];
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    // Si déjà répondu, ne pas changer pour garder la fidélité de l'exercice
    if (selectedAnswers[qIdx] !== undefined) return;

    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
    setShowExplanations(prev => ({ ...prev, [qIdx]: true }));
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setShowExplanations({});
  };

  const totalAnswered = Object.keys(selectedAnswers).length;
  const correctCount = questions.reduce((acc, q, idx) => {
    return selectedAnswers[idx] === q.answerIndex ? acc + 1 : acc;
  }, 0);

  const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const isFinished = totalAnswered === questions.length && questions.length > 0;

  return (
    <div className="w-full h-full flex flex-col space-y-5 animate-fadeIn p-1">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">{title}</h2>
            {sourceFileName && (
              <p className="text-xs text-zinc-400 font-medium truncate max-w-[240px]">
                Sur le document <span className="text-emerald-300 font-semibold">{sourceFileName}</span>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleResetQuiz}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
          title="Recommencer le quiz"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Rejouer</span>
        </button>
      </div>

      {/* Live Score Banner */}
      <div className="bg-[#24262b] border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isFinished ? 'bg-emerald-500 text-white animate-bounce' : 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'}`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-zinc-400">Score en direct</div>
            <div className="text-base sm:text-lg font-black text-white">
              {correctCount} / {questions.length} <span className="text-xs font-bold text-emerald-400">({percentage}%)</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-zinc-400 block">Progression</span>
          <span className="text-xs font-bold text-zinc-200">{totalAnswered} / {questions.length} questions</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
          style={{ width: `${(totalAnswered / Math.max(1, questions.length)) * 100}%` }}
        />
      </div>

      {/* Questions List */}
      <div className="space-y-6 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {questions.map((q, qIdx) => {
          const userChoice = selectedAnswers[qIdx];
          const hasAnswered = userChoice !== undefined;
          const isCorrect = userChoice === q.answerIndex;

          return (
            <div
              key={q.id || qIdx}
              className={`bg-[#26282d] border rounded-2xl p-4 sm:p-5 transition-all shadow-md ${
                hasAnswered
                  ? isCorrect
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-rose-500/40 bg-rose-950/10'
                  : 'border-zinc-700/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Question {qIdx + 1}
                </span>
                {hasAnswered && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                    isCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isCorrect ? 'Correct !' : 'Incorrect'}
                  </span>
                )}
              </div>

              <h3 className="text-sm sm:text-base font-bold text-white mb-4 leading-relaxed">
                {q.question}
              </h3>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2.5">
                {q.options.map((opt, optIdx) => {
                  const isSelected = userChoice === optIdx;
                  const isTargetCorrect = optIdx === q.answerIndex;

                  let optClasses = "bg-[#1f2125] border-zinc-700/70 text-zinc-200 hover:border-zinc-500 hover:bg-[#282a2f]";
                  let badgeClasses = "bg-zinc-800 text-zinc-400 border-zinc-700";

                  if (hasAnswered) {
                    if (isTargetCorrect) {
                      optClasses = "bg-emerald-900/40 border-emerald-500 text-white font-semibold shadow-[0_0_10px_rgba(16,185,129,0.2)]";
                      badgeClasses = "bg-emerald-500 text-white";
                    } else if (isSelected && !isTargetCorrect) {
                      optClasses = "bg-rose-900/40 border-rose-500 text-rose-200";
                      badgeClasses = "bg-rose-500 text-white";
                    } else {
                      optClasses = "bg-[#1f2125] border-zinc-800 text-zinc-500 opacity-60";
                    }
                  }

                  const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={hasAnswered}
                      onClick={() => handleSelectOption(qIdx, optIdx)}
                      className={`w-full text-left p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer disabled:cursor-default ${optClasses}`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border ${badgeClasses}`}>
                        {letter}
                      </span>
                      <span className="text-xs sm:text-sm font-medium flex-1">
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Pedagogical Explanation */}
              {hasAnswered && q.explanation && (
                <div className="mt-4 pt-3 border-t border-zinc-700/50 flex items-start gap-2.5 text-xs text-zinc-300 animate-fadeIn">
                  <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-300 block mb-0.5">Explication pédagogique :</span>
                    <p className="leading-relaxed font-normal">{q.explanation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
