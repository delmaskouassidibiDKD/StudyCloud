import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  BookmarkCheck,
  GraduationCap,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Flashcard } from './types';
import { MathText } from '../MathText';

interface TestQuestion {
  cardId: string;
  front: string;
  correctAnswer: string;
  options: string[];
}

function normalizeCards(input: any): Flashcard[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : (Array.isArray(input?.cards) ? input.cards : (Array.isArray(input?.data) ? input.data : []));
  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((c: any, i: number) => ({
    id: c.id || `c_${i + 1}`,
    front: c.front || c.recto || c.question || c.term || c.concept || `Notion ${i + 1}`,
    back: c.back || c.verso || c.answer || c.definition || c.explication || '',
    tag: c.tag || c.theme || c.category || 'Mémorisation'
  }));
}

export default function CarteMemoire({ data }: { data?: any }) {
  const dynamicCards = normalizeCards(data);
  const cards: Flashcard[] = dynamicCards;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredIds(new Set());
    setIsTesting(false);
  }, [data]);

  // Si aucune carte mémoire n'est encore générée par l'IA
  if (cards.length === 0) {
    return (
      <div id="module-carte-memoire" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
        <div id="carte-memoire-empty-card" className="w-full bg-white border border-stone-200 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-bold text-stone-900">
              Cartes Mémoire (Flashcards)
            </h3>
            <p className="text-stone-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
              Espace prêt à recevoir vos cartes de mémorisation. Demandez à l'IA d'extraire les définitions, formules et notions clés de votre cours. Les cartes interactives recto / verso apparaîtront ici.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-600">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Espace adaptatif auto-extensible pour toute notion ou formule
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Test mode state
  const [isTesting, setIsTesting] = useState(false);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [testIndex, setTestIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [testScore, setTestScore] = useState(0);
  const [testFinished, setTestFinished] = useState(false);

  const current = cards[currentIndex];
  const isMastered = masteredIds.has(current.id);
  const allMastered = cards.length > 0 && masteredIds.size === cards.length;

  const toggleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const markMastered = (mastered: boolean) => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (mastered) {
        next.add(current.id);
      } else {
        next.delete(current.id);
      }
      return next;
    });
    handleNext();
  };

  // Launch test on mastered cards
  const startTest = () => {
    // Generate test questions from mastered cards
    const questions: TestQuestion[] = cards.map((card) => {
      // Options are the card's answer + other cards' answers as distractors
      const distractors = cards
        .filter((c) => c.id !== card.id)
        .map((c) => c.back);
      const shuffledOptions = [...distractors, card.back].sort(() => Math.random() - 0.5);
      return {
        cardId: card.id,
        front: card.front,
        correctAnswer: card.back,
        options: shuffledOptions
      };
    });

    // Shuffle questions
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    setTestQuestions(shuffledQuestions);
    setTestIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setTestScore(0);
    setTestFinished(false);
    setIsTesting(true);
  };

  const handleValidateTestAnswer = () => {
    if (!selectedOption || isAnswerSubmitted) return;
    const currentQ = testQuestions[testIndex];
    if (selectedOption === currentQ.correctAnswer) {
      setTestScore((prev) => prev + 1);
    }
    setIsAnswerSubmitted(true);
  };

  const handleNextTestQuestion = () => {
    if (testIndex + 1 < testQuestions.length) {
      setTestIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setTestFinished(true);
    }
  };

  const exitTest = () => {
    setIsTesting(false);
    setTestFinished(false);
  };

  // If in Test Mode
  if (isTesting) {
    const currentQ = testQuestions[testIndex];

    return (
      <div id="module-carte-memoire-test" className="w-full max-w-3xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Test Header */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                Évaluation des Cartes Maîtrisées
              </h2>
              <p className="text-xs text-stone-500">
                Vérifiez vos connaissances sur les {testQuestions.length} cartes validées
              </p>
            </div>
          </div>
          <button
            onClick={exitTest}
            className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-600 text-xs font-semibold transition-colors"
          >
            Quitter le test
          </button>
        </div>

        {!testFinished ? (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-stone-600">
                <span>Question {testIndex + 1} sur {testQuestions.length}</span>
                <span>Score actuel : {testScore} / {testIndex + (isAnswerSubmitted ? 1 : 0)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-300 rounded-full"
                  style={{ width: `${((testIndex + 1) / testQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
              <div className="text-center py-4 border-b border-stone-100">
                <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full mb-3">
                  Question
                </span>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-stone-900 leading-relaxed break-words whitespace-normal">
                  <MathText text={currentQ.front} />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3 w-full">
                {currentQ.options.map((option, idx) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentQ.correctAnswer;

                  let optionStyle = 'border-stone-200 hover:border-slate-400 bg-white text-stone-800';

                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium';
                    } else if (isSelected && !isCorrect) {
                      optionStyle = 'border-rose-400 bg-rose-50 text-rose-950 line-through';
                    } else {
                      optionStyle = 'border-stone-200 opacity-50 bg-white text-stone-500';
                    }
                  } else if (isSelected) {
                    optionStyle = 'border-slate-900 bg-slate-50 text-slate-900 shadow-xs ring-1 ring-slate-900 font-medium';
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswerSubmitted}
                      onClick={() => setSelectedOption(option)}
                      className={`w-full h-auto min-h-[56px] text-left p-4 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${optionStyle}`}
                    >
                      <span className="w-6 h-6 rounded-full border border-stone-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm sm:text-base leading-relaxed flex-1 min-w-0 text-left break-words whitespace-normal">
                        <MathText text={option} inline={true} />
                      </span>
                      {isAnswerSubmitted && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      {isAnswerSubmitted && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end">
                {!isAnswerSubmitted ? (
                  <button
                    disabled={!selectedOption}
                    onClick={handleValidateTestAnswer}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
                  >
                    Valider la réponse
                  </button>
                ) : (
                  <button
                    onClick={handleNextTestQuestion}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all"
                  >
                    <span>{testIndex + 1 === testQuestions.length ? 'Voir les résultats' : 'Question suivante'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Test Results */
          <div className="bg-white rounded-2xl p-8 border border-stone-200 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-stone-900">
                {testScore === testQuestions.length
                  ? 'Félicitations ! Parfaite maîtrise !'
                  : testScore >= testQuestions.length / 2
                  ? 'Bien joué !'
                  : 'Entraînement terminé !'}
              </h3>
              <p className="text-stone-600 text-sm max-w-md mx-auto">
                {testScore === testQuestions.length
                  ? 'Vous avez répondu correctement à toutes les notions de vos cartes mémoires.'
                  : 'Continuez à réviser régulièrement vos cartes pour consolider vos acquis.'}
              </p>
            </div>

            <div className="inline-block bg-stone-50 border border-stone-200 px-6 py-4 rounded-2xl">
              <div className="text-4xl font-extrabold text-stone-900">
                {testScore} / {testQuestions.length}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mt-1">
                Score final ({Math.round((testScore / testQuestions.length) * 100)}%)
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <button
                onClick={startTest}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 font-semibold text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recommencer le test</span>
              </button>
              <button
                onClick={exitTest}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
              >
                <span>Retourner aux cartes mémoires</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="module-carte-memoire" className="w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header bar with Mastered count and Test button */}
      <div id="carte-memoire-header" className="flex items-center justify-between gap-3">
        <span
          id="carte-memoire-progress-count"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
            allMastered
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
              : 'bg-stone-100 border-stone-300 text-stone-700'
          }`}
        >
          {masteredIds.size} / {cards.length} maîtrisée(s)
        </span>

        {/* Le bouton "Se tester" apparaît UNIQUEMENT lorsque TOUTES les cartes sont maîtrisées */}
        {allMastered && (
          <button
            id="btn-start-mastery-test"
            onClick={startTest}
            className="inline-flex items-center gap-2 px-4 py-1.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 animate-in fade-in slide-in-from-right-2 duration-200"
          >
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span>Se tester</span>
          </button>
        )}
      </div>

      {/* Bannière de déblocage lorsque tout est maîtrisé */}
      {allMastered && (
        <div
          id="carte-memoire-mastery-banner"
          className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-semibold">
              Toutes les cartes sont maîtrisées ! Vous pouvez maintenant passer le test pour évaluer vos acquis.
            </p>
          </div>
          <button
            onClick={startTest}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Lancer le test</span>
          </button>
        </div>
      )}

      <div id="flashcard-stage" className="flex flex-col items-center justify-center space-y-6 py-4">
        {/* Flip card box */}
        <div
          id="flashcard-interactive-box"
          onClick={toggleFlip}
          className="w-full max-w-2xl min-h-[300px] h-auto cursor-pointer perspective-1000 select-none group"
        >
          <motion.div
            id="flashcard-motion-wrapper"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="w-full h-auto min-h-[300px] relative rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between transform-style-3d hover:shadow-md transition-shadow"
          >
            <div className="my-auto py-6 text-center w-full">
              {!isFlipped ? (
                <div id="flashcard-front-text" className="text-xl md:text-2xl font-semibold text-stone-900 leading-relaxed break-words whitespace-normal">
                  <MathText text={current.front} />
                </div>
              ) : (
                <div id="flashcard-back-text" className="text-base md:text-lg font-normal text-stone-800 leading-relaxed break-words whitespace-normal [transform:rotateY(180deg)]">
                  <MathText text={current.back} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-stone-400 pt-4 border-t border-stone-100">
              <span>Carte {currentIndex + 1} sur {cards.length}</span>
              {isMastered && (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <BookmarkCheck className="w-4 h-4" /> Maîtrisée
                </span>
              )}
            </div>
          </motion.div>
        </div>

        {/* Evaluation buttons */}
        <div id="flashcard-evaluation-row" className="flex items-center gap-3 w-full max-w-2xl justify-center">
          <button
            id="btn-card-to-review"
            onClick={() => markMastered(false)}
            className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <X className="w-4 h-4 text-rose-500" />
            À revoir
          </button>
          <button
            id="btn-card-flip"
            onClick={toggleFlip}
            className="py-2.5 px-4 rounded-xl border border-stone-200 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <RotateCw className="w-4 h-4" />
            Retourner
          </button>
          <button
            id="btn-card-mastered"
            onClick={() => markMastered(true)}
            className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-stone-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            Maîtrisé
          </button>
        </div>

        {/* Navigation pagination */}
        <div id="flashcard-nav-controls" className="flex items-center gap-4">
          <button
            id="btn-card-prev"
            onClick={handlePrev}
            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors active:scale-95"
            title="Carte précédente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-stone-600">
            {currentIndex + 1} / {cards.length}
          </span>
          <button
            id="btn-card-next"
            onClick={handleNext}
            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition-colors active:scale-95"
            title="Carte suivante"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

