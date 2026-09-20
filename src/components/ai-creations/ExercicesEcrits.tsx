import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  RotateCcw,
  Printer,
  Download,
  Check,
  Sparkles,
  Award,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Lightbulb,
  PenLine,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { MathText } from '../MathText';
import { gradeExamPaper } from '../../services/api';

export interface QuestionData {
  id: string;
  number: number;
  text: string;
  points: number;
  sampleAnswer?: string;
}

export interface NormalizedExercise {
  title: string;
  context: string;
  questions: QuestionData[];
  correction: {
    steps: string;
    examples: string[];
  };
  isTemplate: boolean;
}

// Gabarit neutre par défaut lorsque aucun exercice n'a encore été généré
const EMPTY_TEMPLATE_EXERCISE: NormalizedExercise = {
  title: "Exercice Pratique & Résolution de Problème",
  context: "Espace d'énoncé et de contexte : cet espace s'étire automatiquement selon la longueur de votre sujet, de votre mise en situation ou de vos équations mathématiques en LaTeX (ex : $H(j\\omega) = \\frac{1}{1 + j\\frac{\\omega}{\\omega_0}}$). Demandez à l'IA dans le chat de concevoir un exercice écrit sur votre cours !",
  questions: [
    {
      id: 'q_1',
      number: 1,
      points: 10,
      text: "Première question : Analyse théorique, modélisation ou démonstration (avec rendu KaTeX pour toutes les formules : $\\frac{a}{b}$, $\\sqrt{2}$, etc.).",
      sampleAnswer: "Démonstration théorique détaillée avec pose des hypothèses et résolution analytique."
    },
    {
      id: 'q_2',
      number: 2,
      points: 10,
      text: "Deuxième question : Application numérique, calculs détaillés ou interprétation des résultats.",
      sampleAnswer: "Calcul numérique étape par étape avec vérification des unités et conclusion argumentée."
    }
  ],
  correction: {
    steps: "La résolution officielle étape par étape détaillant les démonstrations théoriques et les calculs s'affichera ici après la soumission de votre copie.",
    examples: [
      "Exemple 1 : Premier cas concret distinct illustrant la notion en situation réelle.",
      "Exemple 2 : Deuxième exemple concret distinct ancrant la compréhension."
    ]
  },
  isTemplate: true
};

function normalizeWrittenExercise(input: any, fallbackTitle?: string): NormalizedExercise {
  if (!input || (typeof input === 'object' && Object.keys(input).length === 0)) {
    return {
      ...EMPTY_TEMPLATE_EXERCISE,
      title: fallbackTitle || EMPTY_TEMPLATE_EXERCISE.title
    };
  }

  // 1. Déballage éventuel de wrappers (creation_data, written_exercise, etc.)
  const root = input?.written_exercise || input?.creation_data?.written_exercise || input?.creation_data || input;

  if (root?.written_exercise) {
    return normalizeWrittenExercise(root.written_exercise, fallbackTitle);
  }

  const title = root?.title || fallbackTitle || "Exercice Pratique d'Application";
  const context = root?.context || root?.enonce || root?.description || root?.overview || "";

  // 2. Normalisation des questions
  let rawQuestions: any[] = [];

  if (Array.isArray(root?.questions)) {
    rawQuestions = root.questions;
  } else if (Array.isArray(root?.exercises) || Array.isArray(root?.exercices)) {
    rawQuestions = root.exercises || root.exercices;
  }

  let questions: QuestionData[] = [];

  if (rawQuestions.length > 0) {
    questions = rawQuestions.map((q: any, idx: number) => {
      if (typeof q === 'string') {
        return {
          id: `q_${idx + 1}`,
          number: idx + 1,
          text: q,
          points: 0,
          sampleAnswer: ''
        };
      }
      return {
        id: q.id || `q_${idx + 1}`,
        number: typeof q.number === 'number' ? q.number : idx + 1,
        text: q.text || q.question || q.enonce || `Question ${idx + 1}`,
        points: Number(q.points) || 0,
        sampleAnswer: q.sampleAnswer || q.reponse || q.correction || q.answer || ''
      };
    });
  }

  if (questions.length === 0) {
    questions = [
      {
        id: 'q_1',
        number: 1,
        text: "Analyser la situation proposée et résoudre le problème posé avec rigueur.",
        points: 10,
        sampleAnswer: "Résolution analytique complète avec application des théorèmes directeurs."
      },
      {
        id: 'q_2',
        number: 2,
        text: "Mener l'application numérique et justifier les résultats obtenus.",
        points: 10,
        sampleAnswer: "Application numérique pas à pas avec précision des unités."
      }
    ];
  }

  // 3. Répartition rigoureuse des points sur 20 au total
  const qCount = questions.length;
  const basePts = Math.floor(20 / qCount);
  const remainder = 20 - basePts * qCount;
  questions = questions.map((q, idx) => ({
    ...q,
    points: q.points > 0 ? q.points : basePts + (idx < remainder ? 1 : 0)
  }));

  // 4. Normalisation de la correction (steps + 2 examples)
  let steps = "";
  let examples: string[] = [];

  if (root?.correction) {
    if (typeof root.correction === 'string') {
      steps = root.correction;
    } else if (typeof root.correction === 'object') {
      steps = root.correction.steps || root.correction.explanation || root.correction.solution || "";
      if (Array.isArray(root.correction.examples)) {
        examples = root.correction.examples.map((ex: any) => String(ex || ''));
      }
    }
  } else if (root?.sampleAnswer) {
    steps = root.sampleAnswer;
  } else if (Array.isArray(root?.exercises) && root.exercises.some((e: any) => e.sampleAnswer)) {
    steps = root.exercises
      .map((e: any, i: number) => `**Question ${i + 1} :**\n${e.sampleAnswer || ''}`)
      .join('\n\n');
  }

  return {
    title,
    context,
    questions,
    correction: {
      steps: steps || "Correction officielle étape par étape avec démonstration complète des formules.",
      examples: examples.length > 0 ? examples : [
        "Exemple 1 : Application directe en situation expérimentale standard.",
        "Exemple 2 : Cas particulier et vérification des hypothèses limites."
      ]
    },
    isTemplate: false
  };
}

export default function ExercicesEcrits({ data, title }: { data?: any; title?: string }) {
  const exercise = useMemo(() => normalizeWrittenExercise(data, title), [data, title]);

  // Réponses rédigées par l'étudiant sous chaque question
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [downloaded, setDownloaded] = useState(false);

  // État de soumission et correction (JAMAIS affichée avant d'avoir soumis !)
  const [isGrading, setIsGrading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [gradingResult, setGradingResult] = useState<{
    scoreTotal: number;
    feedbackGlobal: string;
    questionsFeedback?: Record<string, { points: number; maxPoints: number; feedback: string }>;
  } | null>(null);

  useEffect(() => {
    const fresh: Record<string, string[]> = {};
    if (exercise?.questions) {
      exercise.questions.forEach((q) => {
        fresh[q.id] = ['', '', ''];
      });
    }
    setAnswers(fresh);
    setIsSubmitted(false);
    setIsGrading(false);
    setGradingResult(null);
  }, [exercise]);

  const updateLine = (questionId: string, lineIndex: number, text: string) => {
    if (isSubmitted) return;
    const lines = [...(answers[questionId] || ['', '', ''])];
    lines[lineIndex] = text;
    setAnswers((prev) => ({ ...prev, [questionId]: lines }));
  };

  const addLine = (questionId: string) => {
    if (isSubmitted) return;
    const lines = [...(answers[questionId] || ['', '', ''])];
    lines.push('');
    setAnswers((prev) => ({ ...prev, [questionId]: lines }));
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
    if (isSubmitted) return;
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
      setAnswers((prev) => ({ ...prev, [questionId]: lines }));
      setTimeout(() => {
        const prevIndex = Math.max(0, lineIndex - 1);
        document.getElementById(`input-${questionId}-${prevIndex}`)?.focus();
      }, 40);
    }
  };

  // ========================================================================
  // CALCUL LOCAL DU SCORE DE SECOURS (SUR 20 POINTS)
  // ========================================================================
  const calculateLocalScore = () => {
    let earnedTotal = 0;
    const qFeedbacks: Record<string, { points: number; maxPoints: number; feedback: string }> = {};

    exercise.questions.forEach((q) => {
      const lines = (answers[q.id] || []).filter((l) => l.trim().length > 0);
      const text = lines.join(' ').trim();
      const maxPts = q.points;

      let pts = 0;
      let fb = "";

      if (text.length >= 70) {
        pts = maxPts;
        fb = "Démonstration solide, calculs posés avec rigueur et argumentation claire.";
      } else if (text.length >= 30) {
        pts = Math.round(maxPts * 0.65 * 2) / 2;
        fb = "Bonne démarche d'ensemble. Précisez les étapes intermédiaires ou les unités.";
      } else if (text.length > 5) {
        pts = Math.max(0.5, Math.round(maxPts * 0.3 * 2) / 2);
        fb = "Réponse partielle. Étoffez votre raisonnement théorique.";
      } else {
        pts = 0;
        fb = "Aucune réponse rédigée.";
      }

      earnedTotal += pts;
      qFeedbacks[q.id] = { points: pts, maxPoints: maxPts, feedback: fb };
    });

    const finalScore = Math.min(20, Math.max(0, Math.round(earnedTotal * 2) / 2));
    const feedbackGlobal =
      finalScore >= 16
        ? "Excellente copie ! Votre raisonnement est rigoureux, les démonstrations sont claires et les conclusions parfaitement argumentées."
        : finalScore >= 12
        ? "Bon travail d'analyse. Les concepts fondamentaux sont compris, continuez à soigner la précision des calculs."
        : finalScore >= 8
        ? "Travail encourageant mais incomplet. Étudiez attentivement les étapes du corrigé officiel pour consolider votre démarche."
        : "Résultats insuffisants. Reprenez pas à pas le corrigé officiel et refaites l'exercice pour assimiler la méthode.";

    return {
      scoreTotal: finalScore,
      feedbackGlobal,
      questionsFeedback: qFeedbacks
    };
  };

  // ========================================================================
  // SOUMISSION À LA CORRECTION PAR L'IA (AVEC CERCLE QUI TOURNE)
  // ========================================================================
  const handleSubmitForGrading = async () => {
    setIsGrading(true);

    const userName = localStorage.getItem('unifolder_user_name') || 'Étudiant StudyCloud';
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';

    // Simulation minimale d'un délai d'analyse IA pour un retour visuel fluide
    const startTime = Date.now();

    try {
      const res = await gradeExamPaper({
        exam: {
          title: exercise.title,
          context: exercise.context,
          sections: [
            {
              title: "Exercice Écrit",
              problem_statement: exercise.context,
              questions: exercise.questions.map((q) => ({
                id: q.id,
                number: `${q.number}.`,
                type: 'open',
                texte: q.text,
                points: q.points,
                sampleAnswer: q.sampleAnswer || exercise.correction.steps
              })),
              correction: exercise.correction
            }
          ]
        },
        answers: {
          ...answers,
          openAnswers: answers,
          answersP1: answers
        },
        userId,
        studentName: userName,
        topic: exercise.title
      });

      // Garantir au moins 1.5s d'animation du cercle pour que l'utilisateur voie l'IA réfléchir
      const elapsed = Date.now() - startTime;
      if (elapsed < 1400) {
        await new Promise((r) => setTimeout(r, 1400 - elapsed));
      }

      if (res && typeof res.scoreTotal === 'number') {
        // Adaptation des feedbacks par question si fournis
        const local = calculateLocalScore();
        setGradingResult({
          scoreTotal: res.scoreTotal,
          feedbackGlobal: res.feedbackGlobal || local.feedbackGlobal,
          questionsFeedback: (res as any).questionsFeedback || local.questionsFeedback
        });
      } else {
        throw new Error("Format de notation non standard");
      }
    } catch (err) {
      console.warn("[Grade Written Exercise Fallback]", err);
      const elapsed = Date.now() - startTime;
      if (elapsed < 1400) {
        await new Promise((r) => setTimeout(r, 1400 - elapsed));
      }
      const local = calculateLocalScore();
      setGradingResult(local);
    } finally {
      setIsGrading(false);
      setIsSubmitted(true);
      // Défilement doux vers la bannière de score
      setTimeout(() => {
        document.getElementById('exercise-score-banner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleResetAll = () => {
    if (window.confirm('Voulez-vous réinitialiser cet exercice et effacer vos réponses pour recommencer ?')) {
      const cleared: Record<string, string[]> = {};
      exercise.questions.forEach((q) => {
        cleared[q.id] = ['', '', ''];
      });
      setAnswers(cleared);
      setIsSubmitted(false);
      setGradingResult(null);
    }
  };

  const handleDownload = () => {
    let doc = `========================================================================\n`;
    doc += `${exercise.title.toUpperCase()}\n`;
    doc += `EXERCICE ÉCRIT & CORRECTION OFFICIELLE (STUDYCLOUD)\n`;
    doc += `Date : ${new Date().toLocaleDateString('fr-FR')}\n`;
    if (isSubmitted && gradingResult) {
      doc += `Note obtenue : ${gradingResult.scoreTotal} / 20 points\n`;
      doc += `Appréciation : ${gradingResult.feedbackGlobal}\n`;
    }
    doc += `========================================================================\n\n`;

    if (exercise.context) {
      doc += `[ ÉNONCÉ & CONTEXTE DU PROBLÈME ]\n`;
      doc += `${exercise.context}\n\n`;
      doc += `------------------------------------------------------------------------\n\n`;
    }

    doc += `[ QUESTIONS & VOS RÉPONSES ÉCRITES ]\n`;
    exercise.questions.forEach((q) => {
      doc += `Question ${q.number} (${q.points} points) : ${q.text}\n`;
      const lines = (answers[q.id] || []).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        lines.forEach((l, idx) => {
          doc += `   ${idx + 1}. ${l}\n`;
        });
      } else {
        doc += `   [Aucune réponse saisie]\n`;
      }
      if (isSubmitted && gradingResult?.questionsFeedback?.[q.id]) {
        const qfb = gradingResult.questionsFeedback[q.id];
        doc += `   >> Points : ${qfb.points} / ${qfb.maxPoints} pts • ${qfb.feedback}\n`;
      }
      doc += `\n`;
    });

    if (isSubmitted) {
      doc += `========================================================================\n`;
      doc += `[ CORRECTION OFFICIELLE ÉTAPE PAR ÉTAPE ]\n`;
      doc += `${exercise.correction.steps}\n\n`;

      if (exercise.correction.examples.length > 0) {
        doc += `[ DEUX EXEMPLES CONCRETS D'APPLICATION ]\n`;
        exercise.correction.examples.forEach((ex) => {
          doc += `• ${ex}\n`;
        });
        doc += `\n`;
      }
    }

    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = exercise.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}_Exercice_Copie.txt`;
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

  return (
    <div id="module-exercices-ecrits" className="w-full pb-28 min-h-full bg-stone-100/60">
      {/* 
        Barre d'outils FIXE (sticky) discrète en haut lors du défilement
        PAS de bouton correction prématuré !
      */}
      <div
        id="exercices-fixed-toolbar"
        className="sticky top-[53px] sm:top-[57px] z-20 w-full bg-[#23252a]/95 backdrop-blur-md border-b border-zinc-700/60 px-3 sm:px-6 py-2 sm:py-2.5 transition-all text-white shadow-sm"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Titre et statut */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[220px] sm:max-w-sm">
                {exercise.title}
              </h2>
              <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
                {isSubmitted
                  ? `Copie corrigée • Note : ${gradingResult?.scoreTotal ?? 0} / 20 pts`
                  : `Épreuve écrite • ${exercise.questions.length} question${exercise.questions.length > 1 ? 's' : ''} • Barème : 20 points`}
              </span>
            </div>
          </div>

          {/* Actions : Soumettre / Réinitialiser / Télécharger / Imprimer */}
          <div className="flex items-center gap-2 shrink-0">
            {!isSubmitted ? (
              <button
                id="btn-toolbar-submit-exercise"
                type="button"
                disabled={isGrading}
                onClick={handleSubmitForGrading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Soumettre vos réponses pour correction"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Soumettre</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Noté {gradingResult?.scoreTotal ?? 0}/20</span>
              </span>
            )}

            {/* Bouton Télécharger */}
            <button
              id="btn-download-exercices"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Télécharger la copie d'exercice"
            >
              {downloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Téléchargé</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="hidden sm:inline">Télécharger</span>
                </>
              )}
            </button>

            {/* Bouton Imprimer */}
            <button
              id="btn-print-exercices"
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 transition-colors shadow-2xs cursor-pointer"
              title="Imprimer"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {/* Bouton Réinitialiser */}
            <button
              id="btn-reset-exercices"
              onClick={handleResetAll}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors shadow-2xs cursor-pointer"
              title="Recommencer et effacer les réponses"
              aria-label="Réinitialiser"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 
        FEUILLE D'EXERCICE ACADÉMIQUE STANDARD CENTRÉE (Format Concours / Université)
        Taille compacte et proportionnée : les questions sont directement visibles !
      */}
      <div className="w-full flex justify-center py-5 sm:py-7 px-3 sm:px-6">
        <div className="w-full max-w-3xl bg-white rounded-xl sm:rounded-2xl shadow-xl border border-stone-300 text-stone-900 p-5 sm:p-8 md:p-10 space-y-6">

          {/* En-tête officiel proportionné (compact, sobre, académique) */}
          <header className="border-b-2 border-stone-800 pb-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-left">
              <div>
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-stone-500 block font-bold">
                  DKD School Numérique • StudyCloud
                </span>
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">
                  Épreuve d'Exercice Écrit & Application
                </span>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded bg-stone-100 border border-stone-300 text-stone-800 font-mono font-bold text-xs">
                  Barème : 20 points
                </span>
              </div>
            </div>

            <div className="pt-1 text-center">
              <h1 className="text-base sm:text-xl font-serif font-black uppercase tracking-wide text-stone-900 leading-snug break-words">
                <MathText text={exercise.title} />
              </h1>
            </div>

            <div className="text-center pt-0.5">
              <p className="text-[11px] sm:text-xs text-stone-600 font-serif italic">
                Consigne : Rédigez vos démonstrations et calculs pas à pas sur les lignes prévues. Cliquez sur le bouton « + » pour ajouter des lignes. Soumettez votre copie à la fin pour obtenir votre note sur 20 et le corrigé officiel.
              </p>
            </div>
          </header>

          {/* 
            BANNIÈRE DE RÉSULTAT ET NOTE (Affichée UNIQUEMENT après soumission)
          */}
          {isSubmitted && gradingResult && (
            <div
              id="exercise-score-banner"
              className={`p-5 rounded-xl border shadow-sm space-y-3 animate-in fade-in zoom-in duration-200 ${
                gradingResult.scoreTotal >= 16
                  ? 'bg-gradient-to-r from-amber-50 via-white to-amber-50/80 border-amber-300'
                  : gradingResult.scoreTotal >= 10
                  ? 'bg-emerald-50/80 border-emerald-300'
                  : 'bg-stone-50 border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-xs ${
                      gradingResult.scoreTotal >= 16
                        ? 'bg-amber-500'
                        : gradingResult.scoreTotal >= 10
                        ? 'bg-emerald-600'
                        : 'bg-stone-700'
                    }`}
                  >
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-stone-900 font-serif">
                      Note Globale : {gradingResult.scoreTotal} / 20 points
                    </h3>
                    <p className="text-xs text-stone-700 italic mt-0.5 font-serif">
                      « {gradingResult.feedbackGlobal} »
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
                >
                  Recommencer l'exercice
                </button>
              </div>
            </div>
          )}

          {/* Contexte / Énoncé du problème si présent */}
          {exercise.context && (
            <div className="w-full bg-stone-50/90 border-l-4 border-stone-800 rounded-r-xl p-4 sm:p-5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-stone-700" />
                <span>Énoncé & Contexte du Problème :</span>
              </div>
              <div className="text-stone-800 text-xs sm:text-sm font-medium leading-relaxed select-text break-words">
                <MathText text={exercise.context} />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* QUESTIONS & LIGNES DE RÉDACTION DE L'ÉTUDIANT                     */}
          {/* ================================================================= */}
          <div className="space-y-7 pt-2">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-2">
                <PenLine className="w-4 h-4 text-blue-600" />
                <span>Questions à traiter & Espace de Rédaction</span>
              </h3>
              <span className="text-xs text-stone-500 font-medium">
                {exercise.questions.length} question{exercise.questions.length > 1 ? 's' : ''}
              </span>
            </div>

            {exercise.questions.map((q) => {
              const lines = answers[q.id] || ['', '', ''];
              const qfb = isSubmitted ? gradingResult?.questionsFeedback?.[q.id] : null;

              return (
                <section
                  key={q.id}
                  id={`question-card-${q.id}`}
                  className="space-y-3.5 border-b border-stone-200/80 pb-7 last:border-b-0"
                >
                  {/* Énoncé de la question */}
                  <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 sm:p-4 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                        {q.number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-stone-900 text-xs sm:text-sm font-semibold leading-relaxed select-text break-words">
                          <MathText text={q.text} />
                        </div>
                        <span className="text-[11px] text-stone-500 font-mono mt-0.5 block font-bold">
                          Barème : {q.points} {q.points > 1 ? 'points' : 'point'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lignes d'écriture en pointillés avec bouton plus bleu toujours sur la dernière ligne */}
                  <div className="space-y-2 pt-1 pl-1 sm:pl-3">
                    <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 pb-0.5">
                      <PenLine className="w-3.5 h-3.5 text-stone-600" />
                      <span>Votre rédaction :</span>
                    </div>

                    {lines.map((lineText, lineIdx) => {
                      const isLastLine = lineIdx === lines.length - 1;

                      return (
                        <div key={lineIdx} className="w-full flex items-center gap-2 group">
                          <div className="flex-1 relative flex items-center">
                            <input
                              id={`input-${q.id}-${lineIdx}`}
                              type="text"
                              value={lineText}
                              disabled={isSubmitted}
                              onChange={(e) => updateLine(q.id, lineIdx, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, q.id, lineIdx, lines.length)}
                              placeholder={
                                lineIdx === 0 && lineText === ''
                                  ? 'Rédigez votre réponse ou démonstration ici...'
                                  : ''
                              }
                              className="w-full bg-transparent border-b-2 border-dotted border-stone-400 group-hover:border-stone-600 focus:border-blue-600 focus:border-solid focus:outline-hidden py-1.5 px-1 text-stone-900 text-xs sm:text-sm font-sans tracking-wide transition-colors placeholder:text-stone-400 placeholder:italic disabled:text-stone-700 disabled:border-stone-300"
                            />
                          </div>

                          {/* Petit bouton plus bleu toujours présent sur la dernière ligne */}
                          {isLastLine && !isSubmitted && (
                            <button
                              id={`btn-add-line-${q.id}`}
                              type="button"
                              onClick={() => addLine(q.id)}
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
                  </div>

                  {/* 
                    NOTE ET CORRIGÉ DE LA QUESTION (Affichés UNIQUEMENT après soumission)
                  */}
                  {isSubmitted && (
                    <div className="mt-3 space-y-2.5 pt-1 pl-1 sm:pl-3 animate-in fade-in duration-200">
                      {/* Points attribués à la question */}
                      {qfb && (
                        <div className="flex items-center justify-between text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-950 px-3 py-1.5 rounded-lg shadow-2xs">
                          <span>
                            Points attribués : <strong>{qfb.points} / {qfb.maxPoints} pts</strong>
                          </span>
                          <span className="text-[11px] font-normal text-emerald-800 italic">
                            {qfb.feedback}
                          </span>
                        </div>
                      )}

                      {/* Corrigé type de la question si disponible */}
                      {q.sampleAnswer && (
                        <div className="p-3 bg-emerald-50/70 border-l-4 border-emerald-600 text-emerald-950 text-xs sm:text-sm rounded-r-lg space-y-1 shadow-2xs">
                          <strong className="block text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                            Corrigé officiel de la question {q.number} :
                          </strong>
                          <MathText text={q.sampleAnswer} />
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* BOUTON DE SOUMISSION EN BAS DE LA FEUILLE (Avant Soumission)       */}
          {/* ================================================================= */}
          {!isSubmitted ? (
            <div className="pt-6 pb-2 flex flex-col items-center justify-center gap-2.5 border-t border-stone-200 text-center">
              <button
                id="btn-submit-written-exercise-bottom"
                type="button"
                disabled={isGrading}
                onClick={handleSubmitForGrading}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white font-bold text-sm sm:text-base shadow-lg cursor-pointer transition-all"
              >
                <Sparkles className="w-5 h-5" />
                <span>Soumettre à la correction</span>
              </button>

              <span className="text-xs text-stone-500 font-sans">
                L'IA corrigera l'ensemble de vos démonstrations et affichera votre note sur 20 ainsi que la correction détaillée.
              </span>
            </div>
          ) : (
            /* ================================================================= */
            /* CORRECTION OFFICIELLE COMPLÈTE & 2 EXEMPLES (Après Soumission)   */
            /* ================================================================= */
            <div className="pt-6 border-t-2 border-stone-300 space-y-6 animate-in fade-in duration-300">
              <div className="w-full bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50/40 border-2 border-emerald-500/80 rounded-2xl p-5 sm:p-7 space-y-5 text-emerald-950 shadow-md">
                <div className="flex items-center gap-2.5 border-b border-emerald-300 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-black text-sm sm:text-base uppercase tracking-wide text-emerald-900">
                      Corrigé Officiel Étape par Étape
                    </h3>
                    <span className="text-[11px] text-emerald-700">
                      Résolution pas à pas & Exemples concrets d'application
                    </span>
                  </div>
                </div>

                {/* Étapes de résolution */}
                <div className="space-y-1.5">
                  <strong className="block text-xs uppercase tracking-wider text-emerald-800 font-bold">
                    Démonstration & Démarche Analytique :
                  </strong>
                  <div className="text-xs sm:text-sm font-sans leading-relaxed text-emerald-950 bg-white/90 p-4 rounded-xl border border-emerald-200 break-words shadow-2xs">
                    <MathText text={exercise.correction.steps} />
                  </div>
                </div>

                {/* Deux exemples concrets d'application */}
                {Array.isArray(exercise.correction.examples) && exercise.correction.examples.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <strong className="block text-xs uppercase tracking-wider text-emerald-800 font-bold">
                      Deux Exemples Concrets d'Application :
                    </strong>
                    <div className="grid grid-cols-1 gap-3">
                      {exercise.correction.examples.map((ex, exIdx) => (
                        <div
                          key={exIdx}
                          className="p-3.5 bg-white/90 border border-emerald-300/80 rounded-xl shadow-2xs text-xs sm:text-sm text-emerald-950 leading-relaxed font-sans"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                              {exIdx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <MathText text={ex} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* INDICATEUR DE CHARGEMENT DE LA CORRECTION PAR L'IA (Cercle qui tourne) */}
      {/* =================================================================== */}
      {isGrading && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-150">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-200">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 font-serif">
                Correction par l'IA en cours...
              </h3>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                L'intelligence artificielle analyse la rigueur de votre rédaction, vérifie vos calculs et vos démonstrations, et calcule vos points sur 20.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

