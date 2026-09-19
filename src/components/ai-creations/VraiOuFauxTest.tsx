import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  X,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Award,
  ListFilter
} from 'lucide-react';
import { AffirmationVraiFaux } from './types';

const STATEMENTS: AffirmationVraiFaux[] = [
  {
    id: 'vft1',
    statement: 'La relecture passive surlignée au feutre est la méthode la plus efficace pour réviser un examen.',
    isTrue: false,
    explanation: 'Faux : C’est une illusion de compétence fréquente. L’effort de restitution active et les tests pratiques sont prouvés bien plus durables.'
  },
  {
    id: 'vft2',
    statement: 'Espacer les sessions de révision dans le temps (courbe d’Ebbinghaus) ralentit significativement l’oubli.',
    isTrue: true,
    explanation: 'Vrai : La répétition espacée réactive les souvenirs juste avant leur dégradation, consolidant l’empreinte mémorielle.'
  },
  {
    id: 'vft3',
    statement: 'Le cerveau humain retient mieux les informations lorsqu’elles sont reliées à des images ou des schémas visuels.',
    isTrue: true,
    explanation: 'Vrai : Le principe du double codage (mots + visuels/infographies) double les voies d’accès au souvenir.'
  },
  {
    id: 'vft4',
    statement: 'Faire du multitâche (travailler tout en consultant ses réseaux sociaux) n’impacte pas la mémorisation si on est jeune.',
    isTrue: false,
    explanation: 'Faux : Le multitâche fragmente l’attention sélective et empêche le transfert des données vers la mémoire de travail profonde.'
  },
  {
    id: 'vft5',
    statement: 'Un sommeil de qualité après une session de travail participe activement à la consolidation synaptique des acquis.',
    isTrue: true,
    explanation: 'Vrai : Durant les phases de sommeil lent profond et paradoxal, le cerveau réactive et stabilise durablement les réseaux neuronaux stimulés en journée.'
  }
];

export default function VraiOuFauxTest({ data }: { data?: AffirmationVraiFaux[] | { affirmations?: AffirmationVraiFaux[] } }) {
  const rawList = Array.isArray(data) ? data : (data?.affirmations || STATEMENTS);
  const affirmations: AffirmationVraiFaux[] = (rawList && rawList.length > 0) ? rawList : STATEMENTS;

  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = answeredCount === affirmations.length;

  const handleSelect = (id: string, choice: boolean) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({
      ...prev,
      [id]: choice
    }));
  };

  const handleSubmit = () => {
    if (!isAllAnswered) return;
    setIsSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setAnswers({});
    setIsSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Score calculation
  const totalScore = affirmations.reduce((acc, item) => {
    return acc + (answers[item.id] === item.isTrue ? 1 : 0);
  }, 0);

  const percentage = Math.round((totalScore / affirmations.length) * 100);

  return (
    <div id="module-vrai-ou-faux-test" className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      {/* Top Header Bar */}
      <div id="vrai-faux-test-header" className="flex items-center justify-between">
        {!isSubmitted ? (
          <>
            <div id="vrai-faux-test-progress" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-700">
              <ListFilter className="w-4 h-4 text-stone-500" />
              <span>{answeredCount} / {affirmations.length} cochée{answeredCount > 1 ? 's' : ''}</span>
            </div>
            <div id="vrai-faux-test-mode-badge" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-700">
              <span>Mode Évaluation globale</span>
            </div>
          </>
        ) : (
          <>
            <div id="vrai-faux-test-finished-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test terminé • Résultats et correction</span>
            </div>
            <div id="vrai-faux-test-score-badge" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-xs font-semibold text-stone-800">
              <span>Score :</span>
              <span className="font-bold text-stone-900">{totalScore} / {affirmations.length} ({percentage}%)</span>
            </div>
          </>
        )}
      </div>

      {isSubmitted && (
        /* Summary Card when submitted */
        <motion.div
          id="vrai-faux-test-summary"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-5 shadow-xs"
        >
          <div id="vf-award-icon" className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Award className="w-8 h-8" />
          </div>

          <h3 id="vf-results-heading" className="text-2xl font-bold text-stone-900">
            Bilan du Test Vrai ou Faux
          </h3>

          <p id="vf-results-score-phrase" className="text-stone-600 max-w-md mx-auto">
            Vous avez obtenu <strong className="text-stone-900 text-lg">{totalScore}</strong> sur <strong className="text-stone-900 text-lg">{affirmations.length}</strong> affirmations exactes (<span className="font-semibold text-stone-900">{percentage}%</span>).
          </p>

          <button
            id="btn-vf-test-restart"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Recommencer le test</span>
          </button>
        </motion.div>
      )}

      {/* List of Statements */}
      <div id="vrai-faux-test-list" className="space-y-4">
        {affirmations.map((item, index) => {
          const userChoice = answers[item.id];
          const hasAnswered = userChoice !== undefined;
          const isCorrect = userChoice === item.isTrue;

          return (
            <div
              key={item.id}
              id={`statement-card-${item.id}`}
              className={`bg-white border rounded-xl p-5 sm:p-6 transition-all shadow-xs space-y-4 ${
                isSubmitted
                  ? isCorrect
                    ? 'border-emerald-200 bg-emerald-50/15'
                    : 'border-rose-200 bg-rose-50/15'
                  : hasAnswered
                  ? 'border-stone-400/80 bg-white'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Affirmation {index + 1}
                  </span>
                  <p className="text-base sm:text-lg font-semibold text-stone-900 leading-snug">
                    {item.statement}
                  </p>
                </div>

                {isSubmitted && (
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
                        <span>Erreur (0 pt)</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons / Choices (Vrai / Faux) */}
              <div id={`choices-container-${item.id}`} className="grid grid-cols-2 gap-3 pt-1">
                {/* VRAI BUTTON */}
                <button
                  type="button"
                  id={`btn-choice-vrai-${item.id}`}
                  disabled={isSubmitted}
                  onClick={() => handleSelect(item.id, true)}
                  className={`p-3.5 rounded-lg border text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-all ${
                    userChoice === true
                      ? isSubmitted
                        ? item.isTrue
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                          : 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500'
                        : 'border-stone-900 bg-stone-900 text-white ring-1 ring-stone-900 shadow-xs'
                      : isSubmitted && item.isTrue
                      ? 'border-emerald-400 bg-emerald-50/70 text-emerald-900 font-bold border-dashed'
                      : 'border-stone-200 bg-stone-50/60 hover:bg-stone-100 text-stone-800'
                  } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>VRAI</span>
                  {userChoice === true && !isSubmitted && (
                    <span className="w-2 h-2 rounded-full bg-white ml-1" />
                  )}
                </button>

                {/* FAUX BUTTON */}
                <button
                  type="button"
                  id={`btn-choice-faux-${item.id}`}
                  disabled={isSubmitted}
                  onClick={() => handleSelect(item.id, false)}
                  className={`p-3.5 rounded-lg border text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-all ${
                    userChoice === false
                      ? isSubmitted
                        ? !item.isTrue
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                          : 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500'
                        : 'border-stone-900 bg-stone-900 text-white ring-1 ring-stone-900 shadow-xs'
                      : isSubmitted && !item.isTrue
                      ? 'border-emerald-400 bg-emerald-50/70 text-emerald-900 font-bold border-dashed'
                      : 'border-stone-200 bg-stone-50/60 hover:bg-stone-100 text-stone-800'
                  } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>FAUX</span>
                  {userChoice === false && !isSubmitted && (
                    <span className="w-2 h-2 rounded-full bg-white ml-1" />
                  )}
                </button>
              </div>

              {/* Correction explanation revealed only when submitted */}
              {isSubmitted && (
                <div
                  id={`explanation-${item.id}`}
                  className="mt-3 p-3.5 rounded-lg bg-stone-100/90 border border-stone-200 text-sm text-stone-800 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      Correction officielle :
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                        item.isTrue
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {item.isTrue ? 'VRAI' : 'FAUX'}
                    </span>
                    <span className="text-xs text-stone-500">
                      • Votre réponse : <strong>{userChoice ? 'Vrai' : 'Faux'}</strong>
                    </span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-sm pt-0.5">
                    {item.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Submit Action */}
      {!isSubmitted && (
        <div id="vrai-faux-test-submit-bar" className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-200">
          <p className="text-xs text-stone-500">
            {isAllAnswered
              ? 'Toutes les affirmations ont été cochées. Vous pouvez valider.'
              : `Il vous reste ${affirmations.length - answeredCount} affirmation(s) à cocher avant de valider.`}
          </p>

          <button
            id="btn-submit-vrai-faux-test"
            type="button"
            onClick={handleSubmit}
            disabled={!isAllAnswered}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              isAllAnswered
                ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-xs'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            <span>Valider et voir la correction</span>
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
