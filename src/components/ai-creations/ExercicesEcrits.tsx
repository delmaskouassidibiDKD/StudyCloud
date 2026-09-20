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
  GraduationCap,
  Lightbulb,
  PenLine
} from 'lucide-react';
import { MathText } from '../MathText';

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

// Gabarit visuel neutre lorsque aucun exercice n'a encore été généré par l'IA
// Permet à l'étudiant et à l'IA de voir immédiatement la disposition visuelle adaptable
const EMPTY_TEMPLATE_QUESTIONS: QuestionItem[] = [
  {
    id: 'tpl_1',
    number: 1,
    points: 4,
    question: "Espace d'exercice rédactionnel prêt : cet espace s'étire et s'allonge automatiquement selon la longueur de votre problème, de votre énoncé ou de vos formules scientifiques en LaTeX (ex : $\\frac{a}{b}$ ou $f(x) = ax + b$). Demandez à l'IA dans le chat de générer des exercices écrits sur votre cours !",
    keywords: [],
    sampleAnswer: "",
    hint: "Les conseils méthodologiques et pistes de réflexion apparaîtront ici pour guider votre démarche étape par étape."
  },
  {
    id: 'tpl_2',
    number: 2,
    points: 4,
    question: "Deuxième espace de problème extensible : adapté pour tout type de matière (mathématiques, physique, SVT, droit, médecine, économie, littérature). L'espace de rédaction ci-dessous s'adapte à votre réponse.",
    keywords: [],
    sampleAnswer: "",
    hint: ""
  }
];

function normalizeExercices(input: any): QuestionItem[] {
  if (!input) return [];
  const raw = input?.creation_data || input?.exercises_document || input;
  const list = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.exercises)
      ? raw.exercises
      : (Array.isArray(raw?.exercices)
        ? raw.exercices
        : (Array.isArray(raw?.questions)
          ? raw.questions
          : [])));

  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((q: any, idx: number) => ({
    id: q.id || `eq_${idx + 1}`,
    number: typeof q.number === 'number' ? q.number : idx + 1,
    points: typeof q.points === 'number' ? q.points : (typeof q.bareme === 'number' ? q.bareme : 4),
    question: q.question || q.enonce || q.texte || q.problem || `Exercice n°${idx + 1}`,
    keywords: Array.isArray(q.keywords)
      ? q.keywords
      : (Array.isArray(q.motsCles) ? q.motsCles : (Array.isArray(q.mots_cles) ? q.mots_cles : [])),
    sampleAnswer: q.sampleAnswer || q.corrigetype || q.reponse || q.correction || q.solution || '',
    hint: q.hint || q.indice || q.conseil || ''
  }));
}

export default function ExercicesEcrits({ data, title }: { data?: any; title?: string }) {
  const dynamicQuestions = useMemo(() => normalizeExercices(data), [data]);
  const isTemplateMode = dynamicQuestions.length === 0;
  const questionsList: QuestionItem[] = isTemplateMode ? EMPTY_TEMPLATE_QUESTIONS : dynamicQuestions;

  const courseTitle = data?.title || title || (isTemplateMode ? 'Feuille d’Exercices Rédigés & Problèmes d’Application' : (title || 'Exercices d’Application & Problèmes Rédigés'));
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

  // Analyse et correction intelligente de la réponse rédigée
  const evaluateQuestion = (text: string, q: QuestionItem): EvaluationResult => {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.length < 15) {
      return {
        score: 0.5,
        maxScore: q.points,
        status: 'insuffisant',
        strengths: ['Tentative de rédaction enregistrée.'],
        improvements: ['Votre réponse est trop courte : développez votre démarche et formulez des explications complètes.'],
        detailedFeedback: 'La réponse manque d’éléments démonstratifs pour valider le barème de la question.'
      };
    }

    const matchedKeywords = (q.keywords || []).filter((k) => trimmed.includes(k.toLowerCase()));
    const matchRatio = (q.keywords && q.keywords.length > 0)
      ? Math.min(1, matchedKeywords.length / Math.min(q.keywords.length, 4))
      : 0.75;

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
      strengths.push(`Bonne mobilisation de termes clés attendus : ${matchedKeywords.slice(0, 3).join(', ')}.`);
    }
    if (wordCount >= 18) {
      strengths.push('Explication structurée et vocabulaire pertinent.');
    }
    if (strengths.length === 0) {
      strengths.push('Effort de synthèse et réponse bien ciblée sur le sujet.');
    }

    const improvements: string[] = [];
    if (finalScore < q.points) {
      const missing = (q.keywords || []).filter((k) => !matchedKeywords.includes(k)).slice(0, 3);
      if (missing.length > 0) {
        improvements.push(`Pour atteindre la note maximale (${q.points}/${q.points}), intégrez les notions : ${missing.join(', ')}.`);
      }
      if (q.sampleAnswer) {
        improvements.push('Consultez le corrigé type officiel ci-dessous pour enrichir votre argumentaire.');
      }
    }

    return {
      score: finalScore,
      maxScore: q.points,
      status,
      strengths,
      improvements,
      detailedFeedback:
        finalScore >= q.points * 0.8
          ? 'Excellente réponse : votre analyse est rigoureuse, précise et conforme aux exigences de l’épreuve.'
          : 'Bonne tentative dans l’ensemble, mais certains mécanismes explicatifs méritent d’être approfondis.'
    };
  };

  const handleGradeQuestion = (questionId: string) => {
    const q = questionsList.find((item) => item.id === questionId);
    if (!q) return;

    const fullText = (answers[questionId] || []).join(' ').trim();
    if (!fullText) return;

    setEvaluatingId(questionId);

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

      if (q.sampleAnswer) {
        doc += `CORRIGÉ TYPE DE RÉFÉRENCE :\n`;
        doc += `${q.sampleAnswer}\n\n`;
      }
    });

    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}_Exercices.txt`;
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
    <div id="module-exercices-ecrits" className="w-full pb-24 min-h-full">
      {/* 
        Barre d'outils FIXE (sticky) en haut lors du défilement
        Fond sombre élégant avec texte blanc contrasté
      */}
      <div
        id="exercices-fixed-toolbar"
        className="sticky top-[53px] sm:top-[57px] z-20 w-full bg-[#23252a]/95 backdrop-blur-md border-b border-zinc-700/60 px-4 sm:px-6 py-2.5 sm:py-3 transition-all text-white shadow-sm"
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Nom du cours / En-tête */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                {courseTitle}
              </h2>
              <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
                {!isTemplateMode
                  ? `Évaluation formative • ${questionsList.length} questions rédactionnelles`
                  : "Gabarit d'exercices adaptatif • En attente de votre sujet"}
              </span>
            </div>
          </div>

          {/* Indicateur de barème total + Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Badge Note / Barème */}
            <div
              id="exercices-score-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-semibold shadow-2xs"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zinc-200 font-mono">
                {totalGradedCount > 0 ? (
                  <span className="text-amber-400 font-bold">
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
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Télécharger la feuille d'exercices et les corrections"
            >
              {downloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-stone-950" />
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
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Imprimer"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>

            {/* Bouton Réinitialiser */}
            <button
              id="btn-reset-exercices"
              onClick={handleResetAll}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors shadow-2xs cursor-pointer"
              title="Effacer et réinitialiser tout"
              aria-label="Réinitialiser"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 
        FEUILLE D'EXERCICES BLANCHE & HAUT CONTRASTE :
        RÉSOUT DÉFINITIVEMENT LE BUG DU FOND SOMBRE / ÉNONCÉS INVISIBLES.
        Toutes les questions et les formules s'affichent sur une page blanche éclatante,
        avec des conteneurs qui s'étirent et s'allongent dynamiquement selon la longueur du problème.
      */}
      <div className="w-full flex justify-center py-4 sm:py-6 px-2 sm:px-4 md:px-6">
        <div className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 text-stone-900 p-5 sm:p-8 md:p-10 space-y-10">

          {/* En-tête de la feuille académique */}
          <div className="text-center space-y-2 border-b border-stone-200 pb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 text-amber-900 text-xs font-bold uppercase tracking-wider border border-amber-200/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Évaluation Formative & Problèmes Rédigés
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 tracking-tight leading-tight">
              <MathText text={courseTitle} />
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl mx-auto leading-relaxed">
              Feuille officielle d'entraînement rédactionnel. Rédigez vos démarches complètes, calculs intermédiaires et démonstrations. L'espace s'étire automatiquement.
            </p>
          </div>

          {/* Message si aucun exercice n'a encore été généré (Mode gabarit adaptatif neutre) */}
          {isTemplateMode && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 shadow-2xs">
              <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                  Gabarit visuel interactif prêt
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Le format ci-dessous est 100% adaptable à tout type de sujet. Les espaces s'étirent pour recevoir des énoncés longs et des équations mathématiques en LaTeX. Demandez à l'IA dans le chat : <em>« Génère des exercices écrits sur mon cours »</em> pour remplir cette feuille automatiquement !
                </p>
              </div>
            </div>
          )}

          {/* Liste des questions & problèmes */}
          <div className="space-y-12">
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
                  className="space-y-4 border-b border-stone-200 pb-10 last:border-b-0 scroll-mt-28"
                >
                  {/* En-tête de la question avec poids et barème */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 shadow-2xs">
                        Question {item.number}
                      </span>
                      <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200">
                        Barème : {item.points} point{item.points > 1 ? 's' : ''}
                      </span>
                    </div>

                    {evalData && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Note : {evalData.score} / {evalData.maxScore} pts
                      </span>
                    )}
                  </div>

                  {/* 
                    Énoncé de la question :
                    - S'ÉTIRE AUTOMATIQUEMENT (h-auto, min-h-0, sans hauteur fixe).
                    - 100% LISIBLE : texte sombre text-stone-900 sur fond clair bg-stone-50.
                    - Support complet des formules mathématiques KaTeX via <MathText />.
                  */}
                  <div className="w-full bg-stone-50 border border-stone-200/80 rounded-2xl p-4 sm:p-6 space-y-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <span className="font-black text-stone-900 text-base sm:text-lg shrink-0 mt-0.5">
                        {item.number}.
                      </span>
                      <div className="w-full min-h-0 h-auto text-stone-900 text-sm sm:text-base font-medium leading-relaxed select-text break-words">
                        <MathText text={item.question} />
                      </div>
                    </div>

                    {/* Indice / Conseil méthodologique si disponible */}
                    {item.hint && (
                      <div className="pt-2.5 border-t border-stone-200 flex items-start gap-2.5 text-xs sm:text-sm text-amber-900 bg-amber-50/70 p-3 rounded-xl border border-amber-200/70">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <span className="font-bold text-amber-950">Conseil méthodologique : </span>
                          <MathText text={item.hint} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lignes d'écriture en pointillés de l'étudiant */}
                  <div id={`question-lines-${item.id}`} className="space-y-2.5 pt-2 pl-2 sm:pl-4">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 pb-1">
                      <PenLine className="w-3.5 h-3.5 text-blue-600" />
                      Votre réponse rédigée :
                    </div>

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
                                  ? 'Rédigez votre réponse ou démonstration ici avec votre clavier...'
                                  : ''
                              }
                              className="w-full bg-transparent border-b-2 border-dotted border-stone-300 group-hover:border-stone-400 focus:border-blue-600 focus:border-solid focus:outline-hidden py-1.5 px-1 text-stone-900 text-sm sm:text-base font-sans tracking-wide transition-colors placeholder:text-stone-400 placeholder:italic"
                            />
                          </div>

                          {/* Bouton petit plus bleu à la fin de la dernière ligne */}
                          {isLastLine && (
                            <button
                              id={`btn-add-line-${item.id}`}
                              type="button"
                              onClick={() => addLine(item.id)}
                              className="w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs cursor-pointer transition-transform ml-1"
                              title="Ajouter une ligne supplémentaire"
                              aria-label="Ajouter une ligne"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Zone d'envoi à la correction */}
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

                    {/* Résultats après analyse par le correcteur */}
                    {evalData && (
                      <div
                        id={`evaluation-result-${item.id}`}
                        className="mt-4 p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs space-y-4 animate-in fade-in duration-200"
                      >
                        {/* Bilan de la note */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200">
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
                        <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                          <MathText text={evalData.detailedFeedback} />
                        </div>

                        {/* Points forts constatés */}
                        {evalData.strengths.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Points forts constatés :
                            </span>
                            <ul className="text-xs text-stone-700 space-y-1 pl-5 list-disc">
                              {evalData.strengths.map((str, sIdx) => (
                                <li key={sIdx}>
                                  <MathText text={str} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Points à améliorer */}
                        {evalData.improvements.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              Axes d'amélioration :
                            </span>
                            <ul className="text-xs text-stone-700 space-y-1 pl-5 list-disc">
                              {evalData.improvements.map((imp, iIdx) => (
                                <li key={iIdx}>
                                  <MathText text={imp} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Corrigé type officiel */}
                        {item.sampleAnswer && (
                          <div className="pt-3 border-t border-stone-200 space-y-2">
                            <span className="text-[11px] uppercase tracking-wider font-bold text-blue-900 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                              Corrigé type de référence officiel :
                            </span>
                            <div className="text-xs sm:text-sm text-stone-900 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200/70 leading-relaxed select-text">
                              <MathText text={item.sampleAnswer} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Soumission globale de la feuille pour la correction */}
          <div
            id="exercices-bottom-submission"
            className="mt-12 pt-8 border-t border-stone-200 flex flex-col items-center text-center space-y-3"
          >
            {(() => {
              const answeredCount = questionsList.filter((q) => {
                const qLines = answers[q.id] || [];
                return qLines.some((l) => l.trim().length > 0);
              }).length;
              const isAllAnswered = answeredCount === questionsList.length && questionsList.length > 0;

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

                  <p className="text-xs text-stone-500">
                    {isAllAnswered ? (
                      <span className="text-emerald-700 font-medium flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Toutes les questions ont été rédigées ({answeredCount}/{questionsList.length}) • Vous pouvez soumettre la feuille
                      </span>
                    ) : (
                      <span>
                        (Au moins quelque chose doit être écrit pour chaque question • {answeredCount}/{questionsList.length} rédigée{answeredCount > 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
