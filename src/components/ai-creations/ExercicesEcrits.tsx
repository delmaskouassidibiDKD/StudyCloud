import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  RotateCcw,
  Printer,
  Download,
  Check,
  Send,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  GraduationCap
} from 'lucide-react';

interface QuestionItem {
  id: string;
  number: number;
  points: number;
  question: string;
  keywords: string[];
  sampleAnswer: string;
  hint: string;
}

interface EvaluationResult {
  score: number;
  maxScore: number;
  status: 'excellent' | 'bon' | 'moyen' | 'insuffisant';
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
}

const COURSE_TITLE = "Sciences Cognitives & Stratégies d'Apprentissage";

const QUESTIONS: QuestionItem[] = [
  {
    id: 'q1',
    number: 1,
    points: 4,
    question: `Prenez le principe de la « Répétition Espacée » et expliquez pourquoi réviser à intervalles réguliers (J+1, J+3, J+7) est nettement plus efficace qu'une session intensive de 10 heures d'affilée.`,
    keywords: ['ebbinghaus', 'oubli', 'courbe', 'intervalle', 'consolidation', 'synapse', 'synaptique', 'saturation', 'trace', 'mnésique', 'espace', 'espacée'],
    sampleAnswer: `La répétition espacée s'appuie sur la courbe de l'oubli d'Ebbinghaus : chaque réactivation synaptique intervient au moment précis où le souvenir commence à s'estomper, ce qui oblige le cerveau à reconstruire activement la trace mnésique et la consolide durablement dans les réseaux neuronaux. À l'inverse, 10 heures intensives d'affilée provoquent une saturation de la mémoire de travail et créent une « illusion de compétence » temporaire qui s'effondre en quelques jours sans ancrage profond.`,
    hint: `Exploitez la courbe de l'oubli, le concept de consolidation synaptique et la saturation cognitive.`
  },
  {
    id: 'q2',
    number: 2,
    points: 3,
    question: `Quelle est la différence fondamentale entre la « reconnaissance passive » (relecture d'un cours, surlignage) et le « rappel actif » (restitution sans support) ?`,
    keywords: ['reconnaissance', 'passive', 'rappel', 'actif', 'relecture', 'surlignage', 'familiarité', 'illusion', 'compétence', 'long terme', 'extraction', 'support', 'effort'],
    sampleAnswer: `La reconnaissance passive n'active que la familiarité superficielle : l'information paraît maîtrisée car elle est présente sous les yeux, mais elle reste inaccessible de mémoire autonome. Le rappel actif oblige le cerveau à faire un effort conscient d'extraction de l'information depuis la mémoire à long terme sans aucun indice visuel, ce qui fortifie durablement les circuits neuronaux et garantit la capacité de mobilisation le jour de l'examen.`,
    hint: `Distinguez la simple familiarité visuelle de l'effort d'extraction mnésique.`
  },
  {
    id: 'q3',
    number: 3,
    points: 4,
    question: `Expliquez le principe du « Double Codage » (Paivio) et décrivez comment associer du texte à un schéma ou une infographie renforce la mémoire.`,
    keywords: ['paivio', 'double codage', 'verbal', 'visuel', 'canaux', 'canal', 'mots', 'schéma', 'carte', 'infographie', 'indépendant', 'accès', 'souvenir', 'consolidation'],
    sampleAnswer: `Selon la théorie du double codage d'Allan Paivio, le cerveau humain traite et stocke l'information via deux canaux cognitifs indépendants mais interconnectés : le canal verbal (mots, définitions, explications écrites) et le canal visuel (schémas, agencements spatiaux, infographies, couleurs). Associer du texte à un visuel approprié crée deux voies d'accès distinctes vers le même souvenir, doublant les chances d'encodage réussi et facilitant la récupération en cas d'oubli d'une des voies.`,
    hint: `Mentionnez les deux voies cognitives indépendantes (verbale et visuelle) et le dédoublement de l'accès au souvenir.`
  },
  {
    id: 'q4',
    number: 4,
    points: 3,
    question: `Dans la méthode de vulgarisation selon Feynman, pourquoi est-il impératif d'expliquer un concept complexe avec des mots simples du quotidien, sans aucun jargon ?`,
    keywords: ['feynman', 'jargon', 'simple', 'analogie', 'quotidien', 'illusion', 'compréhension', 'maîtrise', 'vulgarisation', 'enfant', 'métaphore', 'masquer', 'lacune'],
    sampleAnswer: `Le recours au jargon technique permet souvent de masquer des lacunes et une incompréhension réelle sous une illusion de savoir. Expliquer un concept complexe à l'aide de mots élémentaires et d'analogies concrètes du quotidien oblige l'esprit à décomposer le mécanisme dans sa logique fondamentale, ce qui met immédiatement en lumière les zones d'ombre et valide une maîtrise conceptuelle authentique.`,
    hint: `Le jargon est un refuge confortable ; la simplicité du quotidien est le véritable test de maîtrise.`
  },
  {
    id: 'q5',
    number: 3,
    points: 3,
    question: `Comment planifieriez-vous un cycle de réactivation efficace sur 30 jours pour retenir l'ensemble d'un protocole technique avant un examen ?`,
    keywords: ['j0', 'j+1', 'j+3', 'j+7', 'j+15', 'j+29', 'j+30', 'jalons', 'flashcard', 'test', 'blanc', 'réactivation', 'planification', 'programme', 'jours', 'espacement'],
    sampleAnswer: `Un cycle optimal sur 30 jours s'articule ainsi : J0 (apprentissage initial et synthèse visuelle) ; J+1 (première séance de flashcards et rappel actif à blanc) ; J+3 (restitution ciblée sur les erreurs constatées) ; J+7 (mise en situation pratique sur un cas concret sans support) ; J+15 (test blanc chronométré complet) ; J+29 (ultime réactivation légère sur les derniers points de vigilance).`,
    hint: `Proposez un cadencement précis avec des intervalles exponentiels (J+1, J+3, J+7, J+15, J+29).`
  },
  {
    id: 'q6',
    number: 3,
    points: 3,
    question: `Quels sont les impacts physiologiques et cognitifs du manque de sommeil sur la mémoire de travail et la restitution des connaissances le jour d'un examen ?`,
    keywords: ['sommeil', 'hippocampe', 'cortex', 'néocortex', 'consolidation', 'profond', 'paradoxal', 'mémoire de travail', 'fatigue', 'attention', 'transfert', 'sommeil lent'],
    sampleAnswer: `Durant les phases de sommeil lent profond et paradoxal, l'hippocampe transfère et réorganise les données acquises vers le néocortex pour les consolider durablement. La privation de sommeil interrompt ce processus de transfert biologique, réduit considérablement la capacité de la mémoire de travail, altère les temps de réaction et inhibe l'accès aux souvenirs pourtant étudiés la veille.`,
    hint: `Abordez le rôle de l'hippocampe, le transfert néocortical et l'impact sur la mémoire de travail.`
  }
];

function normalizeExercices(input: any): QuestionItem[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : (Array.isArray(input?.questions) ? input.questions : (Array.isArray(input?.exercises) ? input.exercises : (Array.isArray(input?.exercices) ? input.exercices : [])));
  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((q: any, idx: number) => ({
    id: q.id || `eq_${idx + 1}`,
    number: typeof q.number === 'number' ? q.number : idx + 1,
    points: typeof q.points === 'number' ? q.points : 4,
    question: q.question || q.enonce || q.texte || `Exercice n°${idx + 1}`,
    keywords: Array.isArray(q.keywords) ? q.keywords : (q.motsCles || []),
    sampleAnswer: q.sampleAnswer || q.corrigetype || q.reponse || q.correction || '',
    hint: q.hint || q.indice || ''
  }));
}

export default function ExercicesEcrits({ data, title }: { data?: any; title?: string }) {
  const dynamicQuestions = useMemo(() => normalizeExercices(data), [data]);
  const questionsList: QuestionItem[] = dynamicQuestions.length > 0 ? dynamicQuestions : QUESTIONS;
  const courseTitle = data?.title || title || (dynamicQuestions.length > 0 ? (title || 'Exercices d’Application & Problèmes Rédigés') : COURSE_TITLE);
  const totalPoints = questionsList.reduce((sum, q) => sum + q.points, 0);

  // Réponses saisies par l'utilisateur
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    questionsList.forEach((q) => {
      initial[q.id] = ['', '', ''];
    });
    return initial;
  });

  // Évaluations par question
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationResult>>({});

  useEffect(() => {
    const fresh: Record<string, string[]> = {};
    questionsList.forEach((q) => {
      fresh[q.id] = ['', '', ''];
    });
    setAnswers(fresh);
    setEvaluations({});
  }, [data]);

  // État de chargement de l'analyse par question
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const saveAnswers = (newAnswers: Record<string, string[]>) => {
    setAnswers(newAnswers);
    try {
      localStorage.setItem('exercices_ecrits_answers', JSON.stringify(newAnswers));
    } catch {
      // ignore
    }
  };

  const saveEvaluations = (newEvals: Record<string, EvaluationResult>) => {
    setEvaluations(newEvals);
    try {
      localStorage.setItem('exercices_ecrits_evaluations', JSON.stringify(newEvals));
    } catch {
      // ignore
    }
  };

  const updateLine = (questionId: string, lineIndex: number, text: string) => {
    const lines = [...(answers[questionId] || ['', '', ''])];
    lines[lineIndex] = text;
    saveAnswers({ ...answers, [questionId]: lines });
  };

  const addLine = (questionId: string) => {
    const lines = [...(answers[questionId] || ['', '', ''])];
    lines.push('');
    saveAnswers({ ...answers, [questionId]: lines });
    setTimeout(() => {
      const newIndex = lines.length - 1;
      const el = document.getElementById(`input-${questionId}-${newIndex}`);
      if (el) el.focus();
    }, 40);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    questionId: string,
    lineIndex: number,
    totalLines: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lineIndex < totalLines - 1) {
        document.getElementById(`input-${questionId}-${lineIndex + 1}`)?.focus();
      } else {
        addLine(questionId);
      }
    } else if (e.key === 'Backspace' && answers[questionId]?.[lineIndex] === '' && totalLines > 2) {
      e.preventDefault();
      const lines = [...(answers[questionId] || [])];
      lines.splice(lineIndex, 1);
      saveAnswers({ ...answers, [questionId]: lines });
      setTimeout(() => {
        const prevIndex = Math.max(0, lineIndex - 1);
        document.getElementById(`input-${questionId}-${prevIndex}`)?.focus();
      }, 40);
    }
  };

  // Analyse et correction intelligente de la réponse
  const evaluateQuestion = (text: string, q: QuestionItem): EvaluationResult => {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.length < 15) {
      return {
        score: 0.5,
        maxScore: q.points,
        status: 'insuffisant',
        strengths: ['Tentative de réponse enregistrée.'],
        improvements: ['Votre réponse est trop courte : développez votre raisonnement en formulant des phrases complètes.'],
        detailedFeedback: 'La réponse manque d’éléments conceptuels pour valider le barème de la question.'
      };
    }

    const matchedKeywords = q.keywords.filter((k) => trimmed.includes(k.toLowerCase()));
    const matchRatio = Math.min(1, matchedKeywords.length / Math.min(q.keywords.length, 4));

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    let lengthFactor = 0.5;
    if (wordCount >= 30) lengthFactor = 1.0;
    else if (wordCount >= 16) lengthFactor = 0.8;
    else if (wordCount >= 8) lengthFactor = 0.6;

    const rawScore = q.points * (matchRatio * 0.65 + lengthFactor * 0.35);
    const finalScore = Math.max(1, Math.min(q.points, Math.round(rawScore * 2) / 2));

    let status: 'excellent' | 'bon' | 'moyen' | 'insuffisant' = 'moyen';
    if (finalScore >= q.points * 0.85) status = 'excellent';
    else if (finalScore >= q.points * 0.65) status = 'bon';
    else if (finalScore >= q.points * 0.4) status = 'moyen';
    else status = 'insuffisant';

    const strengths: string[] = [];
    if (matchedKeywords.length >= 2) {
      strengths.push(`Bonne mobilisation de concepts clés du cours : ${matchedKeywords.slice(0, 3).join(', ')}.`);
    }
    if (wordCount >= 18) {
      strengths.push('Explication structurée et vocabulaire pertinent.');
    }
    if (strengths.length === 0) {
      strengths.push('Effort de synthèse et réponse bien ciblée sur le sujet.');
    }

    const improvements: string[] = [];
    if (finalScore < q.points) {
      const missing = q.keywords.filter((k) => !matchedKeywords.includes(k)).slice(0, 3);
      if (missing.length > 0) {
        improvements.push(`Pour atteindre la note maximale (${q.points}/${q.points}), intégrez les notions : ${missing.join(', ')}.`);
      }
      improvements.push('Consultez le corrigé type officiel ci-dessous pour enrichir votre argumentaire.');
    }

    return {
      score: finalScore,
      maxScore: q.points,
      status,
      strengths,
      improvements,
      detailedFeedback:
        finalScore >= q.points * 0.8
          ? 'Excellente réponse : votre analyse est rigoureuse, précise et conforme aux principes du cours.'
          : 'Bonne réponse dans l’ensemble, mais certains mécanismes explicatifs méritent d’être précisés.'
    };
  };

  const handleGradeQuestion = (questionId: string) => {
    const q = questionsList.find((item) => item.id === questionId);
    if (!q) return;

    const fullText = (answers[questionId] || []).join(' ').trim();
    if (!fullText) return;

    setEvaluatingId(questionId);

    // Animation d'analyse du correcteur
    setTimeout(() => {
      const result = evaluateQuestion(fullText, q);
      const updated = { ...evaluations, [questionId]: result };
      saveEvaluations(updated);
      setEvaluatingId(null);
    }, 600);
  };

  const handleGradeAll = () => {
    setEvaluatingId('all');
    setTimeout(() => {
      const updated = { ...evaluations };
      questionsList.forEach((q) => {
        const fullText = (answers[q.id] || []).join(' ').trim();
        if (fullText) {
          updated[q.id] = evaluateQuestion(fullText, q);
        }
      });
      saveEvaluations(updated);
      setEvaluatingId(null);
    }, 800);
  };

  const handleResetAll = () => {
    if (window.confirm('Voulez-vous effacer l’ensemble de vos réponses et réinitialiser les corrections ?')) {
      const cleared: Record<string, string[]> = {};
      questionsList.forEach((q) => {
        cleared[q.id] = ['', '', ''];
      });
      saveAnswers(cleared);
      saveEvaluations({});
    }
  };

  const handleDownload = () => {
    let doc = `========================================================================\n`;
    doc += `${courseTitle.toUpperCase()}\n`;
    doc += `FEUILLE D'EXERCICES RÉDACTIONNELS & CORRECTION DÉTAILLÉE\n`;
    doc += `Date : ${new Date().toLocaleDateString('fr-FR')}\n`;
    doc += `Total épreuve : ${totalPoints} points\n`;

    const evaluatedCount = Object.keys(evaluations).length;
    const currentScore = Object.values(evaluations).reduce((acc: number, curr: any) => acc + (curr?.score || 0), 0);
    if (evaluatedCount > 0) {
      doc += `Note obtenue : ${currentScore} / ${totalPoints} points (${evaluatedCount}/${questionsList.length} questions corrigées)\n`;
    }
    doc += `========================================================================\n\n`;

    questionsList.forEach((q) => {
      const lines = (answers[q.id] || []).filter((l) => l.trim().length > 0);
      const evalData = evaluations[q.id];

      doc += `------------------------------------------------------------------------\n`;
      doc += `QUESTION ${q.number} (Barème : ${q.points} points) :\n`;
      doc += `${q.question}\n\n`;
      doc += `VOTRE RÉPONSE ÉCRITE :\n`;
      if (lines.length > 0) {
        lines.forEach((l, idx) => {
          doc += `  ${idx + 1}. ${l}\n`;
        });
      } else {
        doc += `  [Aucune réponse saisie]\n`;
      }
      doc += `\n`;

      if (evalData) {
        doc += `ANALYSE DU CORRECTEUR (Note : ${evalData.score} / ${evalData.maxScore} pts) :\n`;
        doc += `  • Bilan : ${evalData.detailedFeedback}\n`;
        doc += `  • Points forts : ${evalData.strengths.join(' | ')}\n`;
        if (evalData.improvements.length > 0) {
          doc += `  • Axes d'amélioration : ${evalData.improvements.join(' | ')}\n`;
        }
        doc += `\n`;
      }

      doc += `CORRIGÉ TYPE DE RÉFÉRENCE :\n`;
      doc += `${q.sampleAnswer}\n\n`;
    });

    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sciences_Cognitives_Exercices_Notes.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Calcul du score global
  const totalEarnedScore = Object.values(evaluations).reduce((acc: number, curr: any) => acc + (curr?.score || 0), 0);
  const totalGradedCount = Object.keys(evaluations).length;

  return (
    <div id="module-exercices-ecrits" className="w-full pb-24">
      {/* 
        Barre d'outils FIXE (sticky) en haut lors du défilement
        Sans espace blanc au-dessus, fixée à top-[53px] sm:top-[57px]
      */}
      <div
        id="exercices-fixed-toolbar"
        className="sticky top-[53px] sm:top-[57px] z-20 w-full bg-stone-100/95 backdrop-blur-md border-b border-stone-200 px-4 sm:px-6 py-2.5 sm:py-3 transition-all"
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Nom du cours / En-tête */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                {courseTitle}
              </h2>
              <span className="text-[11px] text-stone-500 hidden sm:inline-block">
                Évaluation formative • {questionsList.length} questions rédactionnelles
              </span>
            </div>
          </div>

          {/* Indicateur de barème total + Actions sur la même ligne */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Badge Note / Barème */}
            <div
              id="exercices-score-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs font-semibold shadow-2xs"
            >
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-stone-600 font-mono">
                {totalGradedCount > 0 ? (
                  <span className="text-blue-700 font-bold">
                    {totalEarnedScore} / {totalPoints} pts
                  </span>
                ) : (
                  <span>Total : {totalPoints} points</span>
                )}
              </span>
            </div>

            {/* Bouton Télécharger */}
            <button
              id="btn-download-exercices"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Télécharger la feuille d'exercices et les corrections"
            >
              {downloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Téléchargé !</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </>
              )}
            </button>

            {/* Bouton Imprimer */}
            <button
              id="btn-print-exercices"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-200/70 text-stone-800 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Imprimer"
            >
              <Printer className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>

            {/* Bouton Réinitialiser */}
            <button
              id="btn-reset-exercices"
              onClick={handleResetAll}
              className="p-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-200/70 text-stone-600 hover:text-stone-900 transition-colors shadow-2xs cursor-pointer"
              title="Effacer et réinitialiser tout"
              aria-label="Réinitialiser"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal : liste des questions directement sur le fond de page */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pt-6 space-y-12">
        {questionsList.map((item) => {
          const lines = answers[item.id] || ['', '', ''];
          const fullAnswerText = lines.join(' ').trim();
          const hasWritten = fullAnswerText.length > 0;
          const evalData = evaluations[item.id];
          const isEvaluating = evaluatingId === item.id || evaluatingId === 'all';

          return (
            <section
              key={item.id}
              id={`question-section-${item.id}`}
              className="space-y-3 scroll-mt-28"
            >
              {/* En-tête de la question avec poids et barème bien visible en haut */}
              <div className="flex items-baseline justify-between gap-3 border-b border-stone-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Question {item.number}
                  </span>
                  <span className="text-xs font-semibold text-stone-500">
                    Barème : {item.points} points
                  </span>
                </div>

                {evalData && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Note : {evalData.score} / {evalData.maxScore} pts
                  </span>
                )}
              </div>

              {/* Énoncé de la question écrit directement sur le fond */}
              <div className="flex items-start gap-2 pt-1">
                <span className="font-bold text-stone-900 text-base sm:text-lg min-w-[20px]">
                  {item.number}.
                </span>
                <p className="text-stone-900 text-sm sm:text-base font-medium leading-relaxed">
                  {item.question}
                </p>
              </div>

              {/* Lignes d'écriture en pointillés avec le petit plus bleu au bout de la dernière ligne */}
              <div id={`question-lines-${item.id}`} className="pl-6 sm:pl-7 space-y-2 pt-1">
                {lines.map((lineText, lineIdx) => {
                  const isLastLine = lineIdx === lines.length - 1;

                  return (
                    <div key={lineIdx} className="w-full flex items-center gap-2 group">
                      <div className="flex-1 relative flex items-center">
                        <input
                          id={`input-${item.id}-${lineIdx}`}
                          type="text"
                          value={lineText}
                          onChange={(e) => updateLine(item.id, lineIdx, (e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => handleKeyDown(e, item.id, lineIdx, lines.length)}
                          placeholder={
                            lineIdx === 0 && lineText === ''
                              ? 'Écrivez votre réponse ici avec votre clavier...'
                              : ''
                          }
                          className="w-full bg-transparent border-b-2 border-dotted border-stone-400 focus:border-blue-600 focus:border-solid focus:outline-hidden py-1 px-0.5 text-stone-900 text-sm sm:text-base font-sans tracking-wide transition-colors placeholder:text-stone-400 placeholder:italic"
                        />
                      </div>

                      {/* Bouton petit plus bleu à la fin de la dernière ligne */}
                      {isLastLine && (
                        <button
                          id={`btn-add-line-${item.id}`}
                          type="button"
                          onClick={() => addLine(item.id)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs cursor-pointer transition-transform ml-1"
                          title="Ajouter une ligne supplémentaire"
                          aria-label="Ajouter une ligne"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 
                  Zone d'envoi à la correction :
                  Pas de corrigé brut direct, mais le bouton "Envoyer à la correction" 
                  lorsque quelque chose a été écrit sur les lignes !
                */}
                <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
                  {hasWritten ? (
                    <button
                      id={`btn-submit-correction-${item.id}`}
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleGradeQuestion(item.id)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isEvaluating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Analyse de votre rédaction en cours...</span>
                        </>
                      ) : evalData ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Réévaluer ma réponse ({item.points} pts)</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Envoyer à la correction ({item.points} pts)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-stone-500 italic flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-stone-300 inline-block" />
                      Rédigez votre réponse ci-dessus pour l’envoyer à la correction.
                    </span>
                  )}

                  <span className="text-[11px] text-stone-400 italic">
                    Touche Entrée pour passer à la ligne suivante
                  </span>
                </div>

                {/* 
                  Résultats après analyse par le correcteur :
                  Affiche la note, l'analyse des points forts et axes de progrès, 
                  ainsi que le corrigé type officiel.
                */}
                {evalData && (
                  <div
                    id={`evaluation-result-${item.id}`}
                    className="mt-4 p-4 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-3.5 animate-in fade-in duration-200"
                  >
                    {/* Bilan de la note */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                          Résultats de l'analyse du correcteur
                        </h4>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                        Note : {evalData.score} / {evalData.maxScore} points
                      </span>
                    </div>

                    {/* Appréciation pédagogique */}
                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-medium">
                      {evalData.detailedFeedback}
                    </p>

                    {/* Points forts constatés */}
                    {evalData.strengths.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Points forts identifiés :
                        </span>
                        <ul className="text-xs text-stone-600 space-y-1 pl-5 list-disc">
                          {evalData.strengths.map((str, sIdx) => (
                            <li key={sIdx}>{str}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Points à améliorer */}
                    {evalData.improvements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Axes d'amélioration :
                        </span>
                        <ul className="text-xs text-stone-600 space-y-1 pl-5 list-disc">
                          {evalData.improvements.map((imp, iIdx) => (
                            <li key={iIdx}>{imp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Corrigé type officiel */}
                    <div className="pt-2 border-t border-stone-100 space-y-1.5">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-stone-700 block">
                        Corrigé type de référence :
                      </span>
                      <p className="text-xs sm:text-sm text-stone-800 bg-stone-50 p-3 rounded-lg border border-stone-200 leading-relaxed font-sans">
                        {item.sampleAnswer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {/* Soumission de la feuille pour la correction */}
        <div
          id="exercices-bottom-submission"
          className="mt-12 pt-8 border-t border-stone-200 flex flex-col items-center text-center space-y-2.5"
        >
          {(() => {
            const answeredCount = QUESTIONS.filter((q) => {
              const qLines = answers[q.id] || [];
              return qLines.some((l) => l.trim().length > 0);
            }).length;
            const isAllAnswered = answeredCount === QUESTIONS.length;

            return (
              <>
                <button
                  id="btn-grade-all-bottom"
                  type="button"
                  onClick={handleGradeAll}
                  disabled={!isAllAnswered || evaluatingId !== null}
                  className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                    isAllAnswered && evaluatingId === null
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white cursor-pointer shadow-md'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {evaluatingId === 'all' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analyse et correction de la feuille en cours...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Soumettre la feuille pour la correction</span>
                    </>
                  )}
                </button>

                {/* Mention explicative sous le bouton */}
                <p className="text-xs text-stone-500">
                  {isAllAnswered ? (
                    <span className="text-emerald-700 font-medium flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Toutes les questions ont été rédigées ({answeredCount}/{QUESTIONS.length}) • Vous pouvez soumettre la feuille
                    </span>
                  ) : (
                    <span>
                      (Au moins quelque chose doit être écrit pour chaque question • {answeredCount}/{QUESTIONS.length} rédigée{answeredCount > 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
