import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import { QuestionQCM } from './types';
import { MathText } from '../MathText';

function normalizeQuestions(input: any): QuestionQCM[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : (Array.isArray(input?.questions) ? input.questions : (Array.isArray(input?.data) ? input.data : []));
  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((q: any, idx: number) => {
    const rawOptions = Array.isArray(q.options) ? q.options : (Array.isArray(q.choices) ? q.choices : (Array.isArray(q.reponses) ? q.reponses : []));
    const cleanOptions = rawOptions.length >= 2 ? rawOptions.map(String) : [
      q.optionA || 'Option A',
      q.optionB || 'Option B',
      q.optionC || 'Option C',
      q.optionD || 'Option D'
    ].filter(Boolean);

    let corrIdx = 0;
    if (typeof q.correctIndex === 'number') corrIdx = q.correctIndex;
    else if (typeof q.correctAnswer === 'number') corrIdx = q.correctAnswer;
    else if (typeof q.bonneReponse === 'number') corrIdx = q.bonneReponse;
    else if (typeof q.correctIndex === 'string') corrIdx = parseInt(q.correctIndex, 10) || 0;
    else if (typeof q.correctAnswer === 'string' || typeof q.correct_answer === 'string') {
      const rawAns = String(q.correctAnswer || q.correct_answer).trim();
      const letterIdx = ['a', 'b', 'c', 'd'].indexOf(rawAns.toLowerCase());
      if (letterIdx !== -1 && letterIdx < cleanOptions.length) {
        corrIdx = letterIdx;
      } else {
        const foundIdx = cleanOptions.findIndex((o: string) => o.trim().toLowerCase() === rawAns.toLowerCase());
        if (foundIdx !== -1) corrIdx = foundIdx;
      }
    }

    let explText = '';
    if (typeof q.explanation === 'string') {
      explText = q.explanation;
    } else if (q.explanation && typeof q.explanation === 'object') {
      const parts: string[] = [];
      if (q.explanation.theory) parts.push(q.explanation.theory);
      if (Array.isArray(q.explanation.examples) && q.explanation.examples.length > 0) {
        parts.push(q.explanation.examples.map((ex: string, i: number) => `• Exemple ${i + 1} : ${ex}`).join('\n'));
      }
      explText = parts.join('\n\n') || JSON.stringify(q.explanation);
    } else {
      explText = q.explication || q.justification || '';
    }

    return {
      id: q.id || `qt_${idx + 1}`,
      question: q.question || q.texte || q.title || `Question n°${idx + 1}`,
      options: cleanOptions.length > 0 ? cleanOptions : ['Vrai', 'Faux'],
      correctIndex: Math.max(0, Math.min(corrIdx, (cleanOptions.length > 0 ? cleanOptions.length : 2) - 1)),
      explanation: explText
    };
  });
}

export default function QuestionnaireTest({ data }: { data?: any }) {
  const dynamicQuestions = normalizeQuestions(data);
  const questions: QuestionQCM[] = dynamicQuestions;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setIsSubmitted(false);
  }, [data]);

  // Affichage d'un espace prêt et récepteur si aucune question n'a été générée par l'IA
  if (questions.length === 0) {
    return (
      <div id="module-questionnaire-test" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
        <div id="questionnaire-test-empty-card" className="w-full bg-white border border-stone-200 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-bold text-stone-900">
              Questionnaire Test (Évaluation notée)
            </h3>
            <p className="text-stone-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
              Espace d'évaluation prêt. Demandez à l'IA de générer un test ou examen complet à partir de votre cours. Les questions notées, les options à cocher, le score final et le corrigé détaillé s'afficheront ici.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-600">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Conteneur adaptatif étirable pour tout sujet ou problème complexe
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || questions[0];
  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = answeredCount === questions.length;

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    setCurrentIndex(0);
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentIndex(0);
    setIsSubmitted(false);
  };

  // Score calculation
  const totalScore = questions.reduce((acc, q, idx) => {
    return acc + (answers[idx] === q.correctIndex ? 1 : 0);
  }, 0);

  const percentage = Math.round((totalScore / questions.length) * 100);

  return (
    <div id="module-questionnaire-test" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      {/* Top Header Bar */}
      <div id="questionnaire-test-header" className="flex items-center justify-between">
        {!isSubmitted ? (
          <>
            <div id="questionnaire-test-progress-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-700">
              <HelpCircle className="w-4 h-4 text-stone-500" />
              <span>Question {currentIndex + 1} sur {questions.length}</span>
            </div>
            <div id="questionnaire-test-answered-badge" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-700">
              <span>{answeredCount} / {questions.length} répondue{answeredCount > 1 ? 's' : ''}</span>
            </div>
          </>
        ) : (
          <>
            <div id="questionnaire-test-finished-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test terminé • Résultats et correction</span>
            </div>
            <div id="questionnaire-test-score-badge" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-800">
              <span>Score :</span>
              <span className="font-bold text-stone-900">{totalScore} / {questions.length} ({percentage}%)</span>
            </div>
          </>
        )}
      </div>

      {!isSubmitted ? (
        /* Test in progress: Answering view */
        <div id="questionnaire-test-body" className="space-y-6">
          {/* Question Stepper / Navigator */}
          <div id="questionnaire-test-stepper" className="flex items-center gap-2 flex-wrap">
            {questions.map((_, idx) => {
              const isAnswered = answers[idx] !== undefined;
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={idx}
                  id={`btn-stepper-q-${idx + 1}`}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex-1 min-w-[90px] py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                      : isAnswered
                      ? 'border-stone-300 bg-stone-100 text-stone-800'
                      : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  Question {idx + 1} {isAnswered && '✓'}
                </button>
              );
            })}
          </div>

          {/* Current Question Card */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            id="questionnaire-test-card"
            className="w-full h-auto min-h-fit bg-white border border-stone-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-xs flex flex-col justify-start"
          >
            <div id="questionnaire-test-question-text" className="w-full h-auto text-left text-lg md:text-xl font-semibold text-stone-900 leading-relaxed break-words whitespace-normal">
              <MathText text={currentQ.question} />
            </div>

            <div id="questionnaire-test-options-list" className="space-y-3 w-full">
              {currentQ.options.map((option, idx) => {
                const isSelected = answers[currentIndex] === idx;

                return (
                  <button
                    key={idx}
                    id={`btn-test-option-${currentIndex}-${idx}`}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full h-auto min-h-[56px] text-left p-4 md:p-5 rounded-xl border text-sm md:text-base font-medium flex items-center justify-between gap-4 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-stone-900 bg-stone-100/80 text-stone-950 ring-1 ring-stone-900 shadow-xs'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100 text-stone-800'
                    }`}
                  >
                    <span className="flex-1 min-w-0 text-left leading-relaxed break-words whitespace-normal"><MathText text={option} inline={true} /></span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                        isSelected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 bg-white'
                      }`}
                    >
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Navigation Controls */}
          <div id="questionnaire-test-navigation" className="flex items-center justify-between gap-4">
            <button
              id="btn-test-prev"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                currentIndex === 0
                  ? 'border-stone-200 text-stone-300 cursor-not-allowed'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédente</span>
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <button
                  id="btn-test-next"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  <span>Suivante</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="btn-test-submit"
                  onClick={handleSubmit}
                  disabled={!isAllAnswered}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isAllAnswered
                      ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-xs cursor-pointer'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                  title={!isAllAnswered ? 'Répondez à toutes les questions avant de valider' : ''}
                >
                  <span>Terminer et voir la correction</span>
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Results & Full Correction view */
        <motion.div
          id="questionnaire-test-results-panel"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* Summary Score Card */}
          <div id="test-summary-card" className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-5 shadow-xs">
            <div id="test-award-icon" className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Award className="w-8 h-8" />
            </div>

            <h3 id="test-results-heading" className="text-2xl font-bold text-stone-900">
              Bilan du Questionnaire
            </h3>

            <p id="test-results-score-phrase" className="text-stone-600 max-w-md mx-auto">
              Vous avez obtenu <strong className="text-stone-900 text-lg">{totalScore}</strong> sur <strong className="text-stone-900 text-lg">{questions.length}</strong> bonnes réponses (<span className="font-semibold text-stone-900">{percentage}%</span>).
            </p>

            <button
              id="btn-test-restart"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recommencer le test</span>
            </button>
          </div>

          {/* Detailed Correction of all questions */}
          <div id="test-correction-section" className="space-y-4">
            <h4 id="test-correction-title" className="text-lg font-bold text-stone-900">
              Correction détaillée des {questions.length} questions
            </h4>

            <div id="test-correction-cards-list" className="space-y-4">
              {questions.map((q, qIndex) => {
                const userAnswer = answers[qIndex];
                const isCorrect = userAnswer === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    id={`correction-card-${qIndex + 1}`}
                    className={`w-full h-auto bg-white border rounded-2xl p-6 md:p-7 space-y-5 shadow-xs ${
                      isCorrect ? 'border-emerald-200' : 'border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Question {qIndex + 1}</span>
                        <div className="font-semibold text-stone-900 text-base md:text-lg leading-relaxed break-words whitespace-normal">
                          <MathText text={q.question} />
                        </div>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Correct (+1 pt)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Incorrect (0 pt)</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-1 w-full">
                      {q.options.map((option, optIdx) => {
                        const isUserChoice = userAnswer === optIdx;
                        const isCorrectAnswer = optIdx === q.correctIndex;

                        let optClass = 'border-stone-200 bg-stone-50/40 text-stone-700 opacity-60';

                        if (isCorrectAnswer) {
                          optClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium opacity-100';
                        } else if (isUserChoice && !isCorrect) {
                          optClass = 'border-rose-500 bg-rose-50 text-rose-950 font-medium opacity-100';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3.5 sm:p-4 rounded-xl border text-sm md:text-base flex items-center justify-between gap-3 w-full h-auto break-words whitespace-normal ${optClass}`}
                          >
                            <span className="flex-1 min-w-0 text-left leading-relaxed break-words whitespace-normal"><MathText text={option} inline={true} /></span>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              {isUserChoice && !isCorrect && (
                                <span className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                                  Votre réponse <XCircle className="w-4 h-4 text-rose-600" />
                                </span>
                              )}
                              {isCorrectAnswer && (
                                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                  {isUserChoice ? 'Votre réponse (Correct)' : 'Bonne réponse'}
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 md:p-5 rounded-xl bg-stone-100 border border-stone-200 text-sm text-stone-800 space-y-2 w-full h-auto leading-relaxed break-words whitespace-normal">
                      <p className="font-semibold text-stone-900 text-xs uppercase tracking-wider">
                        Explication didactique :
                      </p>
                      <div className="text-stone-800 text-sm leading-relaxed break-words whitespace-normal">
                        <MathText text={q.explanation} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
