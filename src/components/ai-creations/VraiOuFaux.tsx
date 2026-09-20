import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, RotateCcw, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { AffirmationVraiFaux } from './types';
import { MathText } from '../MathText';

function normalizeAffirmations(input: any): AffirmationVraiFaux[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : (Array.isArray(input?.affirmations) ? input.affirmations : (Array.isArray(input?.data) ? input.data : []));
  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((a: any, idx: number) => {
    let isTrueVal = true;
    if (typeof a.isTrue === 'boolean') isTrueVal = a.isTrue;
    else if (typeof a.reponse === 'boolean') isTrueVal = a.reponse;
    else if (typeof a.correctAnswer === 'boolean') isTrueVal = a.correctAnswer;
    else if (typeof a.isTrue === 'string') isTrueVal = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
    else if (typeof a.reponse === 'string') isTrueVal = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';

    return {
      id: a.id || `vf_${idx + 1}`,
      statement: a.statement || a.affirmation || a.texte || a.question || `Affirmation n°${idx + 1}`,
      isTrue: isTrueVal,
      explanation: a.explanation || a.explication || a.justification || ''
    };
  });
}

export default function VraiOuFaux({ data }: { data?: any }) {
  const dynamicList = normalizeAffirmations(data);
  const affirmations: AffirmationVraiFaux[] = dynamicList;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setUserChoice(null);
    setScore(0);
    setCompleted(false);
  }, [data]);

  // Si aucune affirmation n'a encore été générée par l'IA
  if (affirmations.length === 0) {
    return (
      <div id="module-vrai-ou-faux" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
        <div id="vrai-faux-empty-card" className="w-full bg-white border border-stone-200 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-bold text-stone-900">
              Vrai ou Faux (Cartes réflexes)
            </h3>
            <p className="text-stone-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
              Espace prêt pour les affirmations. Demandez à l'IA d'extraire les affirmations Vrai ou Faux de votre cours pour tester vos réflexes d'apprentissage avec justifications détaillées.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-600">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Conteneur adaptatif étirable pour toute longueur d'affirmation
            </span>
          </div>
        </div>
      </div>
    );
  }

  const current = affirmations[currentIndex] || affirmations[0];

  const handleAnswer = (choice: boolean) => {
    if (userChoice !== null) return;
    setUserChoice(choice);
    if (choice === current.isTrue) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < affirmations.length - 1) {
      setCurrentIndex((i) => i + 1);
      setUserChoice(null);
    } else {
      setCompleted(true);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setUserChoice(null);
    setScore(0);
    setCompleted(false);
  };

  return (
    <div id="module-vrai-ou-faux" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <div id="vrai-faux-header" className="flex items-center justify-between">
        <div id="vrai-faux-progress" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-700">
          <HelpCircle className="w-4 h-4 text-stone-500" />
          <span>Affirmation {currentIndex + 1} / {affirmations.length}</span>
        </div>
        <div id="vrai-faux-score-badge" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-800">
          <span>Score :</span>
          <span className="font-bold text-stone-900">{score} point{score > 1 ? 's' : ''}</span>
        </div>
      </div>

      {completed ? (
        <motion.div
          id="vrai-faux-result-panel"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-5 shadow-xs"
        >
          <div id="vrai-faux-result-icon" className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 id="vrai-faux-result-heading" className="text-2xl font-bold text-stone-900">
            Session Vrai ou Faux terminée
          </h3>
          <p id="vrai-faux-result-text" className="text-stone-600 max-w-md mx-auto">
            Résultat obtenu : <strong className="text-stone-900">{score}</strong> bonne(s) réponse(s) sur <strong className="text-stone-900">{affirmations.length}</strong>.
          </p>
          <button
            id="btn-vrai-faux-restart"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Recommencer la série
          </button>
        </motion.div>
      ) : (
        <div id="vrai-faux-interactive-card" className="space-y-6">
          <div className="w-full h-auto min-h-fit bg-white border border-stone-200 rounded-2xl p-6 md:p-8 space-y-8 shadow-xs flex flex-col justify-start">
            <div id="affirmation-container" className="w-full h-auto py-6 px-2 flex items-center justify-center text-center">
              <blockquote id="affirmation-text" className="text-lg md:text-2xl font-semibold text-stone-900 w-full leading-relaxed break-words whitespace-normal">
                « <MathText text={current.statement} inline={true} /> »
              </blockquote>
            </div>

            <div id="vrai-faux-buttons-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <button
                id="btn-choice-vrai"
                onClick={() => handleAnswer(true)}
                disabled={userChoice !== null}
                className={`w-full py-4 sm:py-5 px-6 rounded-xl border text-base sm:text-lg font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer ${
                  userChoice === null
                    ? 'border-stone-300 bg-stone-50 hover:bg-emerald-50 hover:border-emerald-400 text-stone-800'
                    : current.isTrue
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                    : userChoice === true
                    ? 'border-rose-500 bg-rose-100 text-rose-900'
                    : 'border-stone-200 bg-stone-50 opacity-40 text-stone-400'
                }`}
              >
                <Check className="w-5 h-5 text-emerald-600" />
                VRAI
              </button>

              <button
                id="btn-choice-faux"
                onClick={() => handleAnswer(false)}
                disabled={userChoice !== null}
                className={`w-full py-4 sm:py-5 px-6 rounded-xl border text-base sm:text-lg font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer ${
                  userChoice === null
                    ? 'border-stone-300 bg-stone-50 hover:bg-rose-50 hover:border-rose-400 text-stone-800'
                    : !current.isTrue
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                    : userChoice === false
                    ? 'border-rose-500 bg-rose-100 text-rose-900'
                    : 'border-stone-200 bg-stone-50 opacity-40 text-stone-400'
                }`}
              >
                <X className="w-5 h-5 text-rose-600" />
                FAUX
              </button>
            </div>

            <AnimatePresence>
              {userChoice !== null && (
                <motion.div
                  id="vrai-faux-feedback"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 sm:p-5 rounded-xl border flex items-start gap-3 w-full h-auto leading-relaxed break-words whitespace-normal ${
                    userChoice === current.isTrue
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}
                >
                  {userChoice === current.isTrue ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5 text-sm sm:text-base flex-1 min-w-0">
                    <p className="font-semibold">
                      {userChoice === current.isTrue ? 'Exact ! Bien vu.' : 'Erreur.'}
                    </p>
                    <div className="text-stone-800 leading-relaxed break-words whitespace-normal">
                      <MathText text={current.explanation} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div id="vrai-faux-controls" className="flex items-center justify-end">
            {userChoice !== null && (
              <button
                id="btn-vrai-faux-next"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
              >
                {currentIndex < affirmations.length - 1 ? 'Affirmation suivante' : 'Terminer'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
