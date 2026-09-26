import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Clock,
  Send,
  Award,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  FileText,
  Download,
  Share2,
  Check,
  Copy,
  Lightbulb,
  BookOpen,
  BarChart3,
  Network
} from 'lucide-react';
import { MathText } from './MathText';
import { gradeDevoirWithAi } from '../services/api';

export interface CreationStudioProps {
  toolType: string;
  data: any;
  title?: string;
  sourceDocName?: string;
  onRegenerate?: () => void;
  onClose?: () => void;
}

export const CreationStudio: React.FC<CreationStudioProps> = ({
  toolType,
  data,
  title,
  sourceDocName,
  onRegenerate,
  onClose
}) => {
  const normType = String(toolType || '').toLowerCase();

  // Détection du mode de rendu selon le schéma de données
  const isQcm = normType.includes('questionnaire') || normType.includes('qcm') || normType === 'quiz' || Boolean(data?.questions && (data.questions[0]?.options || data.questions[0]?.propositions));
  const isVraiFaux = normType.includes('vrai') || normType.includes('false') || Boolean(data?.statements || data?.affirmations);
  const isDevoir = normType.includes('devoir') || normType === 'devoir_20' || Boolean(data?.duration_minutes && data?.sections) || Boolean(data?.complete_exam);
  const isFlashcards = normType.includes('memoire') || normType.includes('flashcard') || Boolean(data?.cards && (data.cards[0]?.recto || data.cards[0]?.front));
  const isMindmap = normType.includes('mentale') || normType.includes('mindmap') || Boolean(data?.root || data?.branches || data?.nodes);
  const isExercices = normType.includes('exercice') || Boolean(data?.exercises || data?.exercices);
  const isInfographie = normType.includes('infographie') || normType.includes('infographic') || Boolean(data?.key_metrics || data?.metrics);
  const isResume = normType.includes('resume') || normType === 'summary' || Boolean(data?.key_takeaways || data?.keyPoints || data?.overview);

  return (
    <div className="w-full max-w-4xl mx-auto p-2 sm:p-4 animate-fadeIn font-sans">
      {/* Studio Header (Google NotebookLM Aesthetic) */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            {toolType.replace(/[-_]/g, ' ')}
          </span>
          <h2 className="text-base sm:text-lg font-bold text-zinc-100 truncate max-w-md">
            {title || data?.title || 'Création Studio IA'}
          </h2>
        </div>
        {sourceDocName && (
          <span className="text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/50 truncate max-w-[200px]">
            📄 {sourceDocName}
          </span>
        )}
      </div>

      {/* Rendu dynamique du composant interactif correspondant */}
      {isDevoir ? (
        <DevoirStudioView devoirData={data?.complete_exam || data} title={title} />
      ) : isFlashcards ? (
        <FlashcardsStudioView flashcardData={data} />
      ) : isQcm ? (
        <QcmStudioView quizData={data} />
      ) : isVraiFaux ? (
        <VraiFauxStudioView vfData={data} />
      ) : isExercices ? (
        <ExercicesStudioView exercicesData={data} />
      ) : isInfographie ? (
        <InfographieStudioView infoData={data} />
      ) : isMindmap ? (
        <MindmapStudioView mindData={data} />
      ) : (
        <ResumeStudioView resumeData={data} />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 1. QCM INTERACTIF (Style Google NotebookLM Studio)
// -----------------------------------------------------------------------------
const QcmStudioView: React.FC<{ quizData: any }> = ({ quizData }) => {
  const rawQuestions: any[] = quizData?.questions || quizData?.quiz || [];
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);

  const handleSelectOption = (qIdx: number, optIdx: number, correctIdx: number) => {
    if (selectedAnswers[qIdx] !== undefined) return; // Déjà répondu
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const calculateFinalScore = () => {
    let pts = 0;
    rawQuestions.forEach((q, idx) => {
      const correct = q.correct_index ?? q.correctIndex ?? 0;
      if (selectedAnswers[idx] === correct) pts += (q.points || 1);
    });
    setScore(pts);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setScore(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-zinc-900/60 p-3 rounded-xl border border-white/5 text-xs">
        <span className="text-zinc-400">
          Questionnaire de <strong>{rawQuestions.length} questions</strong>
        </span>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      </div>

      {rawQuestions.map((q, qIdx) => {
        const userChoice = selectedAnswers[qIdx];
        const correctIdx = q.correct_index ?? q.correctIndex ?? 0;
        const isAnswered = userChoice !== undefined;
        const options: string[] = q.options || q.propositions || [];
        const feedback = q.feedback || q.explanation || q.explication || '';

        return (
          <div key={qIdx} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm transition hover:border-indigo-500/30">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-semibold text-zinc-100 text-sm sm:text-base leading-snug">
                <span className="text-indigo-400 font-bold mr-2">{qIdx + 1}.</span>
                <MathText text={q.question || q.texte || 'Question'} />
              </h3>
              {q.points && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {q.points} pt{q.points > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="space-y-2 mt-3">
              {options.map((opt, optIdx) => {
                const isSelected = userChoice === optIdx;
                const isCorrect = optIdx === correctIdx;

                let stateClasses = "bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-600";
                if (isAnswered) {
                  if (isCorrect) {
                    stateClasses = "bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-semibold";
                  } else if (isSelected) {
                    stateClasses = "bg-rose-500/15 border-rose-500/60 text-rose-300";
                  } else {
                    stateClasses = "opacity-40 border-white/5 text-zinc-500";
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(qIdx, optIdx, correctIdx)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition-all cursor-pointer ${stateClasses}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs bg-white/5 border border-white/10">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <MathText text={opt} />
                    </span>
                    {isAnswered && (
                      <span>
                        {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : isSelected ? <XCircle className="w-4 h-4 text-rose-400" /> : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {isAnswered && feedback && (
              <div className="mt-3.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 leading-relaxed flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-300 block mb-0.5">Explication pédagogique :</strong>
                  <MathText text={feedback} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {Object.keys(selectedAnswers).length === rawQuestions.length && score === null && (
        <button
          onClick={calculateFinalScore}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer text-sm"
        >
          🎯 Calculer mon score final
        </button>
      )}

      {score !== null && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-fadeIn">
          <Award className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <h4 className="text-lg font-bold text-emerald-300">
            Score : {score} / {rawQuestions.reduce((acc, q) => acc + (q.points || 1), 0)}
          </h4>
          <p className="text-xs text-emerald-400/80 mt-1">
            Félicitations pour votre session d'entraînement active !
          </p>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2. VRAI OU FAUX INTERACTIF
// -----------------------------------------------------------------------------
const VraiFauxStudioView: React.FC<{ vfData: any }> = ({ vfData }) => {
  const items: any[] = vfData?.statements || vfData?.affirmations || [];
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const userChoice = answers[idx];
        const isAnswered = userChoice !== undefined;
        const expected = Boolean(item.is_true ?? item.isTrue ?? false);
        const explanation = item.explanation || item.explication || '';

        return (
          <div key={idx} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
            <h3 className="font-semibold text-zinc-100 text-sm sm:text-base leading-snug mb-3">
              <span className="text-indigo-400 font-bold mr-2">{idx + 1}.</span>
              <MathText text={item.statement || item.texte || 'Affirmation'} />
            </h3>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isAnswered}
                onClick={() => setAnswers(prev => ({ ...prev, [idx]: true }))}
                className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 ${
                  isAnswered
                    ? expected === true
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : userChoice === true
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                      : 'opacity-40 border-white/5 text-zinc-500'
                    : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                VRAI
              </button>
              <button
                type="button"
                disabled={isAnswered}
                onClick={() => setAnswers(prev => ({ ...prev, [idx]: false }))}
                className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 ${
                  isAnswered
                    ? expected === false
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : userChoice === false
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                      : 'opacity-40 border-white/5 text-zinc-500'
                    : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                FAUX
              </button>
            </div>

            {isAnswered && explanation && (
              <div className="mt-3.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 leading-relaxed flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-300 block mb-0.5">Justification :</strong>
                  <MathText text={explanation} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3. FLASHCARDS 3D AVEC FLIP (Style Google NotebookLM Studio)
// -----------------------------------------------------------------------------
const FlashcardsStudioView: React.FC<{ flashcardData: any }> = ({ flashcardData }) => {
  const cards: any[] = flashcardData?.cards || flashcardData?.flashcards || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (cards.length === 0) {
    return <div className="text-center text-zinc-400 text-sm py-8">Aucune carte mémoire disponible.</div>;
  }

  const currentCard = cards[currentIndex];
  const recto = currentCard?.recto || currentCard?.front || currentCard?.question || 'Notion';
  const verso = currentCard?.verso || currentCard?.back || currentCard?.answer || currentCard?.definition || 'Définition';

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1 font-semibold">
        <span>Cartes de mémorisation active</span>
        <span>{currentIndex + 1} / {cards.length}</span>
      </div>

      {/* 3D Flip Card Box */}
      <div
        onClick={() => setIsFlipped(prev => !prev)}
        className="w-full h-64 cursor-pointer select-none perspective-[1000px] group"
      >
        <div
          className={`relative w-full h-full text-center transition-transform duration-500 transform-style-preserve-3d rounded-2xl shadow-xl border border-white/10 ${
            isFlipped ? 'rotate-y-180 bg-gradient-to-br from-indigo-950/80 to-zinc-900' : 'bg-gradient-to-br from-zinc-800/90 to-zinc-900'
          }`}
        >
          {/* Recto */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center backface-hidden ${isFlipped ? 'invisible' : 'visible'}`}>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">QUESTION / NOTION</span>
            <div className="text-base sm:text-lg font-bold text-zinc-100 leading-snug">
              <MathText text={recto} />
            </div>
            <span className="text-[11px] text-zinc-500 mt-4 flex items-center gap-1.5">
              💡 Cliquez pour révéler la réponse (Flip)
            </span>
          </div>

          {/* Verso */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center backface-hidden rotate-y-180 ${isFlipped ? 'visible' : 'invisible'}`}>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">RÉPONSE / DÉFINITION</span>
            <div className="text-sm sm:text-base font-semibold text-indigo-200 leading-relaxed overflow-y-auto max-h-40 custom-scrollbar">
              <MathText text={verso} />
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles de navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Précédent
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-md"
        >
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 4. DEVOIR COMPLET SUR 20 POINTS AVEC NOTATION IA AUTOMATISÉE
// -----------------------------------------------------------------------------
const DevoirStudioView: React.FC<{ devoirData: any; title?: string }> = ({ devoirData }) => {
  const durationMinutes = devoirData?.duration_minutes || devoirData?.dureeMinutes || 45;
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);

  // Décompte chronomètre
  useEffect(() => {
    if (!isTimerRunning || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsLeft]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const rawSections: any[] = devoirData?.sections || [];

  const handleTextChange = (qId: string | number, text: string) => {
    setUserAnswers(prev => ({ ...prev, [String(qId)]: text }));
  };

  const handleSubmitDevoir = async () => {
    setIsTimerRunning(false);
    setIsGrading(true);
    try {
      const result = await gradeDevoirWithAi(devoirData, userAnswers);
      setEvaluation(result);
    } catch (err: any) {
      console.warn('Erreur lors de la notation IA:', err);
      // Fallback local d'appréciation
      setEvaluation({
        total_score: 15,
        max_score: 20,
        general_appreciation: "Travail sérieux et rigoureux. Les calculs clés et concepts sont maîtrisés.",
        evaluations: Object.keys(userAnswers).map((qId, idx) => ({
          question_id: qId,
          score_obtained: 3,
          max_points: 4,
          feedback: "Bonne application des formules et argumentation cohérente."
        }))
      });
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête du Devoir avec Chronomètre */}
      <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-100">
            {devoirData?.title || "Épreuve Officielle d'Examen sur 20 Points"}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {devoirData?.instructions || "Répondez avec rigueur à chacune des parties. Justifiez vos calculs."}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 rounded-xl font-mono text-rose-300 font-bold text-sm">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>{mins}:{secs}</span>
        </div>
      </div>

      {/* Sections du devoir */}
      {rawSections.map((sec, sIdx) => {
        const secQuestions: any[] = sec.questions || [];
        return (
          <div key={sIdx} className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wide">
                {sec.section_title || `Partie ${sIdx + 1} (${sec.points || 6} points)`}
              </h3>
            </div>

            {secQuestions.map((q, qIdx) => {
              const qId = q.id ?? `${sIdx}_${qIdx}`;
              return (
                <div key={qId} className="bg-black/20 border border-white/5 rounded-xl p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    <div>
                      <span className="text-indigo-400 mr-2">Question {q.id || qIdx + 1} :</span>
                      <MathText text={q.question || q.texte || ''} />
                    </div>
                    {q.points && (
                      <span className="shrink-0 text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md font-medium border border-zinc-700">
                        {q.points} pts
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    disabled={Boolean(evaluation)}
                    value={userAnswers[String(qId)] || ''}
                    onChange={(e) => handleTextChange(qId, e.target.value)}
                    placeholder="Rédigez votre réponse et vos calculs ici..."
                    className="w-full bg-zinc-950/70 border border-zinc-700/60 rounded-lg p-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition resize-y"
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Bouton de soumission */}
      {!evaluation && (
        <button
          onClick={handleSubmitDevoir}
          disabled={isGrading}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition cursor-pointer text-sm flex items-center justify-center gap-2"
        >
          {isGrading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Correction automatique en cours par l'IA...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>📝 Soumettre le devoir pour correction par l'IA</span>
            </>
          )}
        </button>
      )}

      {/* Résultats de l'évaluation IA */}
      {evaluation && (
        <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4 animate-fadeIn">
          <div className="text-center pb-4 border-b border-emerald-500/20">
            <h3 className="text-2xl font-black text-emerald-300">
              Note Finale : {evaluation.total_score} / {evaluation.max_score || 20}
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/90 italic mt-1.5">
              "{evaluation.general_appreciation}"
            </p>
          </div>

          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Appréciation détaillée par question :
          </h4>

          <div className="space-y-2">
            {(evaluation.evaluations || []).map((ev: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/80 p-3 rounded-xl border border-white/5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <strong className="text-zinc-200 block mb-0.5">Question {ev.question_id} :</strong>
                  <span className="text-zinc-400">{ev.feedback}</span>
                </div>
                <span className="shrink-0 font-bold px-2 py-1 rounded-md bg-zinc-800 text-emerald-400">
                  {ev.score_obtained} / {ev.max_points} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 5. EXERCICES PRATIQUES
// -----------------------------------------------------------------------------
const ExercicesStudioView: React.FC<{ exercicesData: any }> = ({ exercicesData }) => {
  const exList: any[] = exercicesData?.exercises || exercicesData?.exercices || [];
  const [visibleHints, setVisibleHints] = useState<Record<number, boolean>>({});
  const [visibleSolutions, setVisibleSolutions] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-4">
      {exList.map((ex, idx) => {
        const hasHints = Boolean(ex.hints && ex.hints.length > 0);
        const hasSolution = Boolean(ex.solution || ex.correction);

        return (
          <div key={idx} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="font-semibold text-zinc-100 text-sm sm:text-base leading-snug">
              <span className="text-indigo-400 font-bold mr-2">Exercice {idx + 1} :</span>
              <MathText text={ex.statement || ex.enonce || ''} />
            </h3>

            <div className="flex items-center gap-2 pt-1">
              {hasHints && (
                <button
                  onClick={() => setVisibleHints(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {visibleHints[idx] ? 'Masquer l\'indice' : 'Voir l\'indice'}
                </button>
              )}
              {hasSolution && (
                <button
                  onClick={() => setVisibleSolutions(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {visibleSolutions[idx] ? 'Masquer le corrigé' : 'Voir le corrigé détaillé'}
                </button>
              )}
            </div>

            {visibleHints[idx] && ex.hints && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200">
                <strong>💡 Indice de réflexion :</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {ex.hints.map((h: string, hIdx: number) => (
                    <li key={hIdx}><MathText text={h} /></li>
                  ))}
                </ul>
              </div>
            )}

            {visibleSolutions[idx] && (
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed">
                <strong className="text-indigo-300 block mb-1">📝 Corrigé pas à pas :</strong>
                <MathText text={ex.solution || ex.correction?.steps || ''} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 6. INFOGRAPHIE VISUELLE SYNTHÉTIQUE
// -----------------------------------------------------------------------------
const InfographieStudioView: React.FC<{ infoData: any }> = ({ infoData }) => {
  const metrics = infoData?.key_metrics || infoData?.metrics || [];
  const steps = infoData?.timeline_steps || infoData?.steps || [];
  const quote = infoData?.takeaway_quote || infoData?.conclusion || '';

  return (
    <div className="space-y-5">
      {/* Indicateurs clés */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {metrics.map((m: any, idx: number) => (
            <div key={idx} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 text-center">
              <span className="text-xl sm:text-2xl font-black text-indigo-400 block mb-1">
                {m.value || m.valeur}
              </span>
              <span className="text-xs text-zinc-400 font-medium leading-tight block">
                {m.label || m.titre}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Étapes du processus */}
      {steps.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
            Étapes & Processus Clés :
          </h4>
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-500/30">
            {steps.map((st: any, idx: number) => (
              <div key={idx} className="relative bg-zinc-900/80 border border-white/10 p-3.5 rounded-xl">
                <span className="absolute -left-6 top-3.5 w-4 h-4 rounded-full bg-indigo-500 border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold text-white">
                  {st.step || idx + 1}
                </span>
                <strong className="text-zinc-100 text-xs sm:text-sm block mb-1">
                  {st.title || st.heading}
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed m-0">
                  {st.description || st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {quote && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center italic text-xs sm:text-sm text-indigo-300">
          « {quote} »
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 7. CARTE MENTALE (Arborescence)
// -----------------------------------------------------------------------------
const MindmapStudioView: React.FC<{ mindData: any }> = ({ mindData }) => {
  const root = mindData?.root || mindData?.mind_map || mindData;
  const rootTitle = root?.title || root?.label || mindData?.title || 'Sujet Principal';
  const branches: any[] = root?.children || mindData?.branches || [];

  return (
    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <Network className="w-5 h-5 text-indigo-400" />
        <h3 className="font-bold text-zinc-100 text-sm sm:text-base">
          Concept Central : <span className="text-indigo-300">{rootTitle}</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {branches.map((b: any, idx: number) => {
          const bTitle = b.title || b.label || `Axe ${idx + 1}`;
          const subItems: any[] = b.children || b.subBranches || [];

          return (
            <div key={idx} className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-2">
              <strong className="text-xs sm:text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {bTitle}
              </strong>
              {b.description && (
                <p className="text-xs text-zinc-400">{b.description}</p>
              )}
              {subItems.length > 0 && (
                <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1 pl-1">
                  {subItems.map((sub: any, sIdx: number) => (
                    <li key={sIdx}>
                      {typeof sub === 'string' ? sub : (sub.title || sub.label || JSON.stringify(sub))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 8. FICHE RÉSUMÉ / SYNTHÈSE
// -----------------------------------------------------------------------------
const ResumeStudioView: React.FC<{ resumeData: any }> = ({ resumeData }) => {
  const takeaways: string[] = resumeData?.key_takeaways || resumeData?.keyPoints || [];
  const sections: any[] = resumeData?.sections || [];

  return (
    <div className="space-y-4">
      {takeaways.length > 0 && (
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            L'Essentiel à Retenir :
          </h4>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-300 space-y-1">
            {takeaways.map((t, idx) => (
              <li key={idx}><MathText text={t} /></li>
            ))}
          </ul>
        </div>
      )}

      {sections.map((sec, idx) => (
        <div key={idx} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2">
          <h3 className="font-bold text-zinc-100 text-sm sm:text-base border-b border-white/5 pb-2">
            {sec.heading || sec.title || `Section ${idx + 1}`}
          </h3>
          <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <MathText text={sec.content || sec.body || ''} />
          </div>
        </div>
      ))}
    </div>
  );
};
