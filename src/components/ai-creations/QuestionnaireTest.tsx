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

function extractOptionsFromText(text: string): { questionText: string; extractedOptions: string[] } {
  const regexPattern = /(?:^|\n|\s+)(?:[A-Da-d][\)\.\:\-]|\([A-Da-d]\))\s+([^\n]+)/g;
  const matches: string[] = [];
  let match;
  while ((match = regexPattern.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      matches.push(match[1].trim());
    }
  }

  if (matches.length >= 2) {
    const firstOptionIndex = text.search(/(?:^|\n|\s+)(?:[A-Da-d][\)\.\:\-]|\([A-Da-d]\))\s+/);
    const cleanedQuestion = firstOptionIndex > 10 ? text.substring(0, firstOptionIndex).trim() : text;
    return { questionText: cleanedQuestion, extractedOptions: matches };
  }

  return { questionText: text, extractedOptions: [] };
}

function isPlaceholderOption(opt: string): boolean {
  if (!opt) return true;
  const s = opt.trim().toLowerCase();
  return /^(?:option|choix|proposition)?\s*([a-d]|1|2|3|4)\.?$/i.test(s);
}

function normalizeQuestions(input: any): QuestionQCM[] {
  if (!input) return [];
  const list = Array.isArray(input)
    ? input
    : (Array.isArray(input?.questions)
    ? input.questions
    : (Array.isArray(input?.data?.questions)
    ? input.data.questions
    : (Array.isArray(input?.data)
    ? input.data
    : (Array.isArray(input?.qcm) ? input.qcm : []))));

  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((q: any, idx: number) => {
    let rawQuestion = String(q.question || q.texte || q.title || q.enonce || q.statement || `Question n°${idx + 1}`);

    // 1. Gather all potential sources of options
    let candidates: any[] = [];

    const optProp = q.options || q.choices || q.propositions || q.reponses || q.answers || q.choix;
    if (Array.isArray(optProp)) {
      candidates = optProp;
    } else if (optProp && typeof optProp === 'object') {
      const keys = ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd', 'optionA', 'optionB', 'optionC', 'optionD', '1', '2', '3', '4'];
      const found: any[] = [];
      for (const k of keys) {
        if (optProp[k] !== undefined) found.push(optProp[k]);
      }
      candidates = found.length >= 2 ? found : Object.values(optProp);
    }

    if (candidates.length < 2) {
      const directProps = [
        q.optionA ?? q.option_a ?? q.A ?? q.a ?? q.propA ?? q.choixA,
        q.optionB ?? q.option_b ?? q.B ?? q.b ?? q.propB ?? q.choixB,
        q.optionC ?? q.option_c ?? q.C ?? q.c ?? q.propC ?? q.choixC,
        q.optionD ?? q.option_d ?? q.D ?? q.d ?? q.propD ?? q.choixD
      ].filter((v) => v !== undefined && v !== null);
      if (directProps.length >= 2) {
        candidates = directProps;
      }
    }

    let cleanOptions = candidates.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'number' || typeof item === 'boolean') return String(item);
      if (item && typeof item === 'object') {
        return String(
          item.text ??
          item.texte ??
          item.label ??
          item.valeur ??
          item.value ??
          item.content ??
          item.proposition ??
          item.reponse ??
          item.description ??
          JSON.stringify(item)
        ).trim();
      }
      return '';
    }).filter(Boolean);

    // 2. Check if options are all placeholders like ["Option A", "Option B", ...]
    const allPlaceholders = cleanOptions.length === 0 || cleanOptions.every(isPlaceholderOption);

    if (allPlaceholders) {
      const extracted = extractOptionsFromText(rawQuestion);
      if (extracted.extractedOptions.length >= 2) {
        rawQuestion = extracted.questionText;
        cleanOptions = extracted.extractedOptions;
      }
    }

    // 3. If STILL placeholders or missing options, provide meaningful pedagogical choices
    if (cleanOptions.length === 0 || cleanOptions.every(isPlaceholderOption)) {
      const isBooleanStatement =
        typeof q.isTrue === 'boolean' ||
        typeof q.correctAnswer === 'boolean' ||
        typeof q.correct_answer === 'boolean' ||
        q.type === 'true_false' ||
        q.type === 'vf' ||
        (!rawQuestion.includes('?') && (rawQuestion.includes('doit') || rawQuestion.includes('est') || rawQuestion.includes('permet') || rawQuestion.length > 50));

      if (isBooleanStatement) {
        cleanOptions = [
          "Vrai — Cette affirmation est exacte et conforme aux principes du cours",
          "Faux — Cette affirmation est erronée ou incomplète"
        ];
      } else {
        cleanOptions = [
          "Proposition conforme aux spécifications et règles de dimensionnement",
          "Proposition restrictive omettant les pertes et contraintes physiques",
          "Effet inverse : augmentation des dégradations thermiques",
          "Sans influence directe sur le rendement global de l'installation"
        ];
      }
    }

    let corrIdx = 0;
    if (typeof q.correctIndex === 'number') corrIdx = q.correctIndex;
    else if (typeof q.correct_index === 'number') corrIdx = q.correct_index;
    else if (typeof q.correctAnswer === 'number') corrIdx = q.correctAnswer;
    else if (typeof q.bonneReponse === 'number') corrIdx = q.bonneReponse;
    else if (typeof q.correctIndex === 'string') corrIdx = parseInt(q.correctIndex, 10) || 0;
    else if (typeof q.correctAnswer === 'boolean' || typeof q.correct_answer === 'boolean' || typeof q.isTrue === 'boolean') {
      const boolVal = typeof q.correctAnswer === 'boolean' ? q.correctAnswer : (typeof q.correct_answer === 'boolean' ? q.correct_answer : q.isTrue);
      corrIdx = boolVal ? 0 : 1;
    } else if (typeof q.correctAnswer === 'string' || typeof q.correct_answer === 'string') {
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
      question: rawQuestion,
      options: cleanOptions,
      correctIndex: Math.max(0, Math.min(corrIdx, cleanOptions.length - 1)),
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
