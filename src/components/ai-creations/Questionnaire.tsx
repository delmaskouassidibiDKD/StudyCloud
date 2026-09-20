import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, RotateCcw, Award, ChevronRight, HelpCircle } from 'lucide-react';
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

    // 1. Rassembler toutes les sources potentielles d'options
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

    // 2. Vérifier si les options sont toutes des placeholders comme ["Option A", "Option B", ...]
    const allPlaceholders = cleanOptions.length === 0 || cleanOptions.every(isPlaceholderOption);

    if (allPlaceholders) {
      const extracted = extractOptionsFromText(rawQuestion);
      if (extracted.extractedOptions.length >= 2) {
        rawQuestion = extracted.questionText;
        cleanOptions = extracted.extractedOptions;
      }
    }

    // 3. Si TOUJOURS des placeholders ou aucune option, fournir des choix pédagogiques réels au lieu de 'Option A'
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
      id: q.id || `q_${idx + 1}`,
      question: rawQuestion,
      options: cleanOptions,
      correctIndex: Math.max(0, Math.min(corrIdx, cleanOptions.length - 1)),
      explanation: explText
    };
  });
}

export default function Questionnaire({ data }: { data?: any }) {
  const dynamicQuestions = normalizeQuestions(data);
  const questions: QuestionQCM[] = dynamicQuestions;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Réinitialiser les réponses si un nouveau contenu est chargé
  useEffect(() => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setScore(0);
    setIsFinished(false);
  }, [data]);

  // Si aucune question n'est encore générée par l'IA : affichage d'un espace prêt et adaptable
  if (questions.length === 0) {
    return (
      <div id="module-questionnaire" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
        <div id="questionnaire-empty-card" className="w-full bg-white border border-stone-200 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-bold text-stone-900">
              Questionnaire interactif
            </h3>
            <p className="text-stone-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
              Espace prêt à recevoir les questions de l'IA. Envoyez une consigne ou votre document dans le chat pour générer automatiquement les questions, les choix multiples et les corrections détaillées adaptées à votre sujet.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-600">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Format visuel adaptatif prêt pour tout type d'exercice ou problème
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || questions[0];

  const handleSelect = (index: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);
    setShowResult(true);
    if (index === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setScore(0);
    setIsFinished(false);
  };

  return (
    <div id="module-questionnaire" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <div id="questionnaire-header" className="flex items-center justify-between">
        <div id="questionnaire-progress-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-700">
          <HelpCircle className="w-4 h-4 text-stone-500" />
          <span>Question {currentIndex + 1} sur {questions.length}</span>
        </div>
        <div id="questionnaire-score-badge" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-800">
          <span>Score :</span>
          <span className="font-bold text-stone-900">{score} point{score > 1 ? 's' : ''}</span>
        </div>
      </div>

      {isFinished ? (
        <motion.div
          id="questionnaire-finished-panel"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-5 shadow-xs"
        >
          <div id="questionnaire-award-icon" className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Award className="w-8 h-8" />
          </div>
          <h3 id="questionnaire-final-score-title" className="text-2xl font-bold text-stone-900">
            Questionnaire complété !
          </h3>
          <p id="questionnaire-final-score-desc" className="text-stone-600 max-w-md mx-auto">
            Votre score : <strong className="text-stone-900">{score}</strong> sur <strong className="text-stone-900">{questions.length}</strong> bonnes réponses.
          </p>
          <button
            id="btn-questionnaire-restart"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Recommencer le questionnaire
          </button>
        </motion.div>
      ) : (
        <div id="questionnaire-body" className="space-y-6">
          <div id="question-card" className="w-full h-auto min-h-fit bg-white border border-stone-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-xs flex flex-col justify-start">
            <div id="question-text" className="w-full h-auto text-left text-lg md:text-xl font-semibold text-stone-900 leading-relaxed break-words whitespace-normal">
              <MathText text={currentQ.question} />
            </div>

            <div id="question-options-list" className="space-y-3 w-full">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentQ.correctIndex;
                let optionStyle = 'border-stone-200 bg-stone-50/50 hover:bg-stone-100 text-stone-800';

                if (showResult) {
                  if (isCorrect) {
                    optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                  } else if (isSelected) {
                    optionStyle = 'border-rose-500 bg-rose-50 text-rose-950';
                  } else {
                    optionStyle = 'border-stone-200 bg-white opacity-60 text-stone-500';
                  }
                }

                return (
                  <button
                    key={idx}
                    id={`btn-option-${currentIndex}-${idx}`}
                    onClick={() => handleSelect(idx)}
                    disabled={selectedOption !== null}
                    className={`w-full h-auto min-h-[56px] text-left p-4 md:p-5 rounded-xl border text-sm md:text-base font-medium flex items-center justify-between gap-4 transition-all cursor-pointer ${optionStyle}`}
                  >
                    <span className="flex-1 min-w-0 text-left leading-relaxed break-words whitespace-normal"><MathText text={option} inline={true} /></span>
                    {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 ml-2" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-600 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {showResult && (
                <motion.div
                  id="question-explanation-box"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full h-auto p-5 md:p-6 rounded-xl bg-stone-100 border border-stone-200 text-sm text-stone-800 space-y-2 leading-relaxed break-words whitespace-normal"
                >
                  <p className="font-semibold text-stone-900">Explication didactique :</p>
                  <div className="text-stone-800 text-sm leading-relaxed break-words whitespace-normal">
                    <MathText text={currentQ.explanation} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div id="questionnaire-footer-actions" className="flex items-center justify-end">
            {showResult && (
              <button
                id="btn-questionnaire-next"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
              >
                <span>{currentIndex < questions.length - 1 ? 'Question suivante' : 'Voir le bilan'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
