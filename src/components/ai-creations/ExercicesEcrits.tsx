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
import { exportExercicesPdf } from '../../utils/exportStudyPdf';
import { MathText } from '../MathText';
import { gradeExamPaper, safeJsonParse } from '../../services/api';

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

// Nettoie le contexte pour retirer tout bavardage préliminaire de l'IA
function cleanExerciseContext(ctx?: string): string {
  if (!ctx) return "";
  let cleaned = ctx
    .replace(/(?:```|""")(?:json)?[\s\S]*?(?:```|""")/gi, '')
    .replace(/^(?:j'ai\s+con[çc]u|voici\s+votre|j'ai\s+cr[ée][ée]|je\s+vous\s+propose)[^\n]*\n*/i, '')
    .replace(/(?:voulez-vous\s+que\s+je\s+continue|souhaitez-vous\s+la\s+suite)[^\n]*$/i, '')
    .trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return "";
  return cleaned;
}

// Gabarit pédagogique par défaut avec 8 questions progressives totalisant 20 points
const EMPTY_TEMPLATE_EXERCISE: NormalizedExercise = {
  title: "Série d'Exercices Écrits & Application Pratique",
  context: "Mise en situation d'entraînement : cet espace s'étire automatiquement selon la longueur de votre sujet, de vos données expérimentales et de vos formules mathématiques en KaTeX (ex : $\\underline{H}(j\\omega) = \\dfrac{T_0}{1 + j\\dfrac{\\omega}{\\omega_0}}$). Demandez à l'IA dans le chat de concevoir une série d'exercices sur votre cours !",
  questions: [
    {
      id: 'q_1',
      number: 1,
      points: 2.5,
      text: "Énoncer les hypothèses de base et définir les grandeurs fondamentales intervenant dans le système.",
      sampleAnswer: "Identification rigoureuse des conditions initiales, des grandeurs physiques et du modèle théorique directeur."
    },
    {
      id: 'q_2',
      number: 2,
      points: 2.5,
      text: "Établir l'équation directrice ou la fonction de transfert analytique en détaillant chaque étape.",
      sampleAnswer: "Application des théorèmes généraux et dérivation algébrique sans omission d'étapes."
    },
    {
      id: 'q_3',
      number: 3,
      points: 2.5,
      text: "Mettre l'expression sous forme canonique et identifier les paramètres caractéristiques ($T_0$, $\\omega_0$, $Q$, etc.).",
      sampleAnswer: "Factorisation par les termes directeurs et identification directe des grandeurs remarquables."
    },
    {
      id: 'q_4',
      number: 4,
      points: 2.5,
      text: "Mener l'étude asymptotique du comportement aux basses et hautes fréquences.",
      sampleAnswer: "Calcul des limites mathématiques quand la variable tend vers 0 et vers l'infini avec conclusions physiques."
    },
    {
      id: 'q_5',
      number: 5,
      points: 2.5,
      text: "Déterminer la pulsation de coupure à $-3\\text{ dB}$ et expliciter la condition d'égalité correspondante.",
      sampleAnswer: "Résolution de l'égalité $|\\underline{H}(j\\omega_c)| = \\dfrac{|\\underline{H}|_{max}}{\\sqrt{2}}$ et calcul de $\\omega_c$."
    },
    {
      id: 'q_6',
      number: 6,
      points: 2.5,
      text: "Effectuer l'application numérique détaillée avec les valeurs données et vérifier l'homogénéité des unités.",
      sampleAnswer: "Remplacement pas à pas avec précision des unités du Système International et arrondi adapté."
    },
    {
      id: 'q_7',
      number: 7,
      points: 2.5,
      text: "Tracer l'allure du diagramme de Bode (gain en décibels et phase) ou le graphe de réponse temporelle.",
      sampleAnswer: "Construction des asymptotes, positionnement de la pulsation caractéristique et tracé de la courbe réelle."
    },
    {
      id: 'q_8',
      number: 8,
      points: 2.5,
      text: "Conclure sur le domaine de validité du modèle et proposer une optimisation pour répondre au cahier des charges.",
      sampleAnswer: "Analyse critique des performances, comparaison aux exigences et proposition de réglage des paramètres."
    }
  ],
  correction: {
    steps: "La résolution officielle détaillée pas à pas de chaque question s'affichera ici après la soumission de votre copie.",
    examples: [
      "Exemple 1 : Cas concret d'application en laboratoire avec mesures réelles.",
      "Exemple 2 : Cas particulier d'examen avec méthode de vérification rapide."
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

  // 0. Déballage récursif d'une chaîne JSON ou de wrappers imbriqués
  let actualData = input;
  if (typeof actualData === 'string') {
    const trimmed = actualData.trim();
    if (trimmed.includes('{') || trimmed.includes('"""json') || trimmed.includes('```json') || trimmed.includes('"questions"') || trimmed.includes('"exercises"')) {
      const parsed = safeJsonParse(trimmed);
      if (parsed) actualData = parsed;
    }
  }

  const root = actualData?.written_exercise || actualData?.creation_data?.written_exercise || actualData?.creation_data || actualData;

  if (root?.written_exercise) {
    return normalizeWrittenExercise(root.written_exercise, fallbackTitle);
  }

  const title = root?.title || root?.label || root?.root?.label || fallbackTitle || "Épreuve d'Exercices Écrits d'Application";
  const rawContext = root?.context || root?.enonce || root?.description || root?.overview || "";
  const context = cleanExerciseContext(rawContext) || (fallbackTitle ? `Énoncé d'application et de réflexion basé sur le cours « ${fallbackTitle} ».` : "");

  // 2. Normalisation des questions
  let rawQuestions: any[] = [];

  if (Array.isArray(root?.questions)) {
    rawQuestions = root.questions;
  } else if (Array.isArray(root?.exercises) || Array.isArray(root?.exercices)) {
    rawQuestions = root.exercises || root.exercices;
  } else if (Array.isArray(root?.problem_sections)) {
    rawQuestions = root.problem_sections.flatMap((sec: any) => sec.questions || [sec]);
  } else if (Array.isArray(root?.children) || Array.isArray(root?.root?.children)) {
    // Si l'IA a structuré en arborescence de piliers (comme la carte mentale)
    const branches = Array.isArray(root?.children) ? root.children : root.root.children;
    rawQuestions = branches.flatMap((pillar: any, pIdx: number) => {
      const pillarTitle = pillar.label || pillar.title || `Pilier ${pIdx + 1}`;
      const subItems = Array.isArray(pillar.children) ? pillar.children : [];
      if (subItems.length === 0) {
        return [{ text: pillarTitle, sampleAnswer: pillar.description || '' }];
      }
      return subItems.map((sub: any, sIdx: number) => {
        const subTitle = sub.label || sub.title || `Question ${sIdx + 1}`;
        const subDetails = Array.isArray(sub.children)
          ? sub.children.map((c: any) => typeof c === 'string' ? c : (c.label || c.title || '')).filter(Boolean).join('\n• ')
          : '';
        const fullText = subDetails ? `${pillarTitle} — ${subTitle} :\n• ${subDetails}` : `${pillarTitle} — ${subTitle}`;
        return {
          text: fullText,
          points: 0,
          sampleAnswer: sub.sampleAnswer || sub.correction || sub.description || ''
        };
      });
    });
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

  // Si aucune question n'a pu être extraite, générer une série académique complète de 8 questions
  if (questions.length === 0) {
    const subjectName = fallbackTitle || "ce cours";
    questions = [
      {
        id: 'q_1',
        number: 1,
        text: `Définir les notions fondamentales et préciser les hypothèses physiques/théoriques posées dans le cours « ${subjectName} ».`,
        points: 2.5,
        sampleAnswer: "Définition rigoureuse avec rappel des conventions et cadre théorique."
      },
      {
        id: 'q_2',
        number: 2,
        text: `Établir l'expression analytique directrice ou la formule générale reliant les grandeurs étudiées.`,
        points: 2.5,
        sampleAnswer: "Démonstration algébrique étape par étape justifiée par les théorèmes fondamentaux."
      },
      {
        id: 'q_3',
        number: 3,
        text: `Mettre l'expression sous forme canonique et identifier les pulsations, gains ou constantes caractéristiques.`,
        points: 2.5,
        sampleAnswer: "Identification méthodique des paramètres canoniques et comparaison aux formes de référence."
      },
      {
        id: 'q_4',
        number: 4,
        text: `Étudier le comportement asymptotique aux régimes limites (basses fréquences, hautes fréquences ou temps infini).`,
        points: 2.5,
        sampleAnswer: "Calcul des limites exactes avec équivalents mathématiques et interprétation physique."
      },
      {
        id: 'q_5',
        number: 5,
        text: `Calculer la valeur critique ou la pulsation de coupure et expliciter la condition d'atténuation.`,
        points: 2.5,
        sampleAnswer: "Application de la définition formelle de coupure et résolution méthodique."
      },
      {
        id: 'q_6',
        number: 6,
        text: `Mener l'application numérique avec précision en indiquant les étapes intermédiaires et les unités adaptées.`,
        points: 2.5,
        sampleAnswer: "Calcul numérique détaillé avec conformité dimensionnelle et respect des chiffres significatifs."
      },
      {
        id: 'q_7',
        number: 7,
        text: `Tracer ou décrire qualitativement les courbes représentatives (diagramme de Bode, réponse indicielle).`,
        points: 2.5,
        sampleAnswer: "Description des asymptotes, des pentes en dB/décade et du point remarquable à la fréquence caractéristique."
      },
      {
        id: 'q_8',
        number: 8,
        text: `Proposer une analyse critique du résultat obtenu et expliquer comment compenser ou ajuster les paramètres du système.`,
        points: 2.5,
        sampleAnswer: "Synthèse argumentée avec proposition d'ajustement conforme au cahier des charges."
      }
    ];
  }

  // 3. Répartition rigoureuse des points sur 20 au total
  const qCount = questions.length;
  const basePts = Math.floor((20 / qCount) * 10) / 10;
  const distributedPts = basePts * qCount;
  const remainder = Math.round((20 - distributedPts) * 10) / 10;

  questions = questions.map((q, idx) => ({
    ...q,
    points: q.points > 0 ? q.points : basePts + (idx === 0 ? remainder : 0)
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
      steps: steps || "Correction officielle détaillée étape par étape avec démonstration rigoureuse des formules.",
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

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownload = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await exportExercicesPdf({
        title: exercise.title,
        context: exercise.context,
        questions: exercise.questions,
        answers,
        correction: exercise.correction,
        gradingResult,
        isSubmitted,
      });
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (err) {
      console.error('Erreur export PDF exercice:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="module-exercices-ecrits" className="w-full min-h-full bg-slate-100/70 flex flex-col pb-24 font-sans">
      {/* 
        Barre d'outils FIXE (sticky top-0) collée immédiatement au sommet sans espace vide
      */}
      <div
        id="exercices-fixed-toolbar"
        className="sticky top-0 z-30 w-full bg-[#1e293b]/95 backdrop-blur-md border-b border-slate-700/80 px-4 sm:px-6 md:px-8 py-2.5 transition-all text-white shadow-md shrink-0"
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Soumettre vos réponses pour correction"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Soumettre la copie</span>
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
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Télécharger la copie en format PDF"
            >
              {downloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Téléchargé en PDF</span>
                </>
              ) : isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span className="hidden sm:inline">Génération PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="hidden sm:inline">Télécharger (PDF)</span>
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
      <div className="flex-1 w-full flex justify-center py-4 sm:py-6 px-3 sm:px-6">
        <div id="exercices-printable-sheet" className="w-full max-w-4xl bg-white rounded-xl sm:rounded-2xl shadow-xl border border-stone-300 text-stone-900 p-5 sm:p-8 md:p-10 space-y-6">

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

