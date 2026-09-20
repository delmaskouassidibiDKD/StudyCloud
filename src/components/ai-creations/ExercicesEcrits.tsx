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
  Eye,
  EyeOff,
  Columns,
  Maximize2
} from 'lucide-react';
import { MathText } from '../MathText';

export interface QuestionData {
  id: string;
  number: number;
  text: string;
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

// Gabarit visuel neutre par défaut lorsque aucun exercice n'a encore été généré
const EMPTY_TEMPLATE_EXERCISE: NormalizedExercise = {
  title: "Exercice Pratique & Résolution de Problème",
  context: "Espace d'énoncé et de contexte : cet espace est 100% dynamique et s'étire automatiquement selon la longueur de votre sujet, de votre mise en situation ou de vos équations mathématiques en LaTeX (ex : $H(j\\omega) = \\frac{1}{1 + j\\frac{\\omega}{\\omega_0}}$). Demandez à l'IA dans le chat de concevoir un exercice écrit sur votre cours !",
  questions: [
    {
      id: 'q_1',
      number: 1,
      text: "Première question ou Partie A : Analyse théorique, modélisation ou démonstration (avec rendu KaTeX pour toutes les formules : $\\frac{a}{b}$, $\\sqrt{2}$, etc.)."
    },
    {
      id: 'q_2',
      number: 2,
      text: "Deuxième question ou Partie B : Application numérique, calculs détaillés ou interprétation des résultats."
    }
  ],
  correction: {
    steps: "La résolution étape par étape détaillant les démonstrations théoriques et les calculs s'affichera ici après génération.",
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
  let questions: QuestionData[] = [];

  if (Array.isArray(root?.questions)) {
    questions = root.questions.map((q: any, idx: number) => {
      if (typeof q === 'string') {
        return {
          id: `q_${idx + 1}`,
          number: idx + 1,
          text: q
        };
      }
      return {
        id: q.id || `q_${idx + 1}`,
        number: typeof q.number === 'number' ? q.number : idx + 1,
        text: q.text || q.question || q.enonce || `Question ${idx + 1}`
      };
    });
  } else if (Array.isArray(root?.exercises) || Array.isArray(root?.exercices)) {
    const list = root.exercises || root.exercices;
    questions = list.map((item: any, idx: number) => ({
      id: item.id || `q_${idx + 1}`,
      number: item.number || idx + 1,
      text: item.question || item.enonce || item.text || `Question ${idx + 1}`
    }));
  }

  if (questions.length === 0) {
    questions = [
      {
        id: 'q_1',
        number: 1,
        text: "Analyser la situation proposée et résoudre le problème posé."
      }
    ];
  }

  // 3. Normalisation de la correction (steps + 2 examples)
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
      steps: steps || "Correction détaillée en attente de génération.",
      examples
    },
    isTemplate: false
  };
}

export default function ExercicesEcrits({ data, title }: { data?: any; title?: string }) {
  const exercise = useMemo(() => normalizeWrittenExercise(data, title), [data, title]);

  // Mode d'affichage de la correction côte à côte
  const [showCorrection, setShowCorrection] = useState(true);
  const [isFullCorrectionMode, setIsFullCorrectionMode] = useState(false);

  // Réponses rédigées par l'étudiant sous chaque question
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    exercise.questions.forEach((q) => {
      initial[q.id] = ['', '', ''];
    });
    return initial;
  });

  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const fresh: Record<string, string[]> = {};
    exercise.questions.forEach((q) => {
      fresh[q.id] = ['', '', ''];
    });
    setAnswers(fresh);
  }, [data]);

  const updateLine = (questionId: string, lineIndex: number, text: string) => {
    const lines = [...(answers[questionId] || ['', '', ''])];
    lines[lineIndex] = text;
    setAnswers((prev) => ({ ...prev, [questionId]: lines }));
  };

  const addLine = (questionId: string) => {
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

  const handleResetAll = () => {
    if (window.confirm('Voulez-vous effacer l’ensemble de vos réponses rédigées sur cette feuille ?')) {
      const cleared: Record<string, string[]> = {};
      exercise.questions.forEach((q) => {
        cleared[q.id] = ['', '', ''];
      });
      setAnswers(cleared);
    }
  };

  const handleDownload = () => {
    let doc = `========================================================================\n`;
    doc += `${exercise.title.toUpperCase()}\n`;
    doc += `EXERCICE ÉCRIT & CORRECTION DÉTAILLÉE (STUDYCLOUD)\n`;
    doc += `Date : ${new Date().toLocaleDateString('fr-FR')}\n`;
    doc += `========================================================================\n\n`;

    if (exercise.context) {
      doc += `[ ÉNONCÉ & CONTEXTE DU PROBLÈME ]\n`;
      doc += `${exercise.context}\n\n`;
      doc += `------------------------------------------------------------------------\n\n`;
    }

    doc += `[ QUESTIONS & VOS RÉPONSES ÉCRITES ]\n`;
    exercise.questions.forEach((q) => {
      doc += `Question ${q.number} : ${q.text}\n`;
      const lines = (answers[q.id] || []).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        lines.forEach((l, idx) => {
          doc += `   ${idx + 1}. ${l}\n`;
        });
      } else {
        doc += `   [Aucune réponse saisie]\n`;
      }
      doc += `\n`;
    });

    doc += `========================================================================\n`;
    doc += `[ CORRECTION DÉTAILLÉE ÉTAPE PAR ÉTAPE ]\n`;
    doc += `${exercise.correction.steps}\n\n`;

    if (exercise.correction.examples.length > 0) {
      doc += `[ DEUX EXEMPLES CONCRETS D'APPLICATION ]\n`;
      exercise.correction.examples.forEach((ex, idx) => {
        doc += `• ${ex}\n`;
      });
      doc += `\n`;
    }

    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = exercise.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}_Exercice_Correction.txt`;
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
    <div id="module-exercices-ecrits" className="w-full pb-24 min-h-full">
      {/* 
        Barre d'outils FIXE (sticky) en haut lors du défilement
      */}
      <div
        id="exercices-fixed-toolbar"
        className="sticky top-[53px] sm:top-[57px] z-20 w-full bg-[#23252a]/95 backdrop-blur-md border-b border-zinc-700/60 px-4 sm:px-6 py-2.5 sm:py-3 transition-all text-white shadow-sm"
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Titre de l'exercice */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
                {exercise.title}
              </h2>
              <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
                {!exercise.isTemplate
                  ? `Étude de cas approfondie • ${exercise.questions.length} question${exercise.questions.length > 1 ? 's' : ''}`
                  : "Gabarit adaptatif neutre • En attente de votre sujet"}
              </span>
            </div>
          </div>

          {/* Boutons d'actions et affichage côte à côte */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Toggle Afficher / Masquer la correction côte à côte */}
            <button
              id="btn-toggle-correction"
              type="button"
              onClick={() => setShowCorrection(!showCorrection)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                showCorrection
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700'
              }`}
              title={showCorrection ? "Masquer la colonne correction" : "Afficher la correction côte à côte"}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {showCorrection ? "Mode Côte à Côte" : "Afficher le Corrigé"}
              </span>
            </button>

            {/* Bouton Télécharger */}
            <button
              id="btn-download-exercices"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Télécharger la feuille d'exercice et sa correction détaillée"
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
              title="Effacer mes réponses rédigées"
              aria-label="Réinitialiser"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 
        FEUILLE D'EXERCICE ACADÉMIQUE BLANCHE À FORT CONTRASTE :
        Affiche l'énoncé d'un côté et la correction détaillée de l'autre
        (avec rendu KaTeX pour les mathématiques et les fractions).
      */}
      <div className="w-full flex justify-center py-4 sm:py-6 px-2 sm:px-4 md:px-6">
        <div className="w-full max-w-6xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 text-stone-900 p-5 sm:p-8 md:p-10 space-y-8">

          {/* En-tête officiel de l'épreuve */}
          <div className="text-center space-y-2 border-b border-stone-200 pb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 text-amber-900 text-xs font-bold uppercase tracking-wider border border-amber-200/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Exercice d'Application & Résolution de Problème
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 tracking-tight leading-tight">
              <MathText text={exercise.title} />
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl mx-auto leading-relaxed">
              Travail méthodique de rédaction et d'analyse. Rédigez vos étapes de raisonnement dans l'espace extensible ci-dessous et comparez avec la correction détaillée.
            </p>
          </div>

          {/* Bannière en mode gabarit neutre si aucun document n'a encore été généré */}
          {exercise.isTemplate && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 shadow-2xs">
              <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                  Gabarit visuel interactif prêt
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Ce format d'exercice s'adapte à tout sujet. Il affiche l'énoncé d'un côté et la correction détaillée de l'autre avec KaTeX. Demandez à l'IA dans le chat : <em>« Génère un exercice écrit sur mon cours »</em> pour remplir automatiquement cette feuille !
                </p>
              </div>
            </div>
          )}

          {/* 
            DISPOSITION DOUBLE VOLET :
            - Colonne 1 : Énoncé du problème & Espace d'écriture de l'étudiant
            - Colonne 2 : Correction détaillée étape par étape & 2 exemples concrets
          */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ================================================================= */}
            {/* COLONNE GAUCHE : ÉNONCÉ & ESPACE DE RÉDACTION                     */}
            {/* ================================================================= */}
            <div className={showCorrection ? "lg:col-span-7 space-y-6" : "lg:col-span-12 space-y-6"}>
              
              {/* Contexte / Mise en situation de l'exercice */}
              {exercise.context && (
                <div className="w-full bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-200/90 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <span>Contexte & Données du problème :</span>
                  </div>
                  <div className="text-stone-900 text-sm sm:text-base font-medium leading-relaxed select-text break-words">
                    <MathText text={exercise.context} />
                  </div>
                </div>
              )}

              {/* Questions de l'exercice */}
              <div className="space-y-8 pt-2">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-stone-800 flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-blue-600" />
                    <span>Questions & Rédaction de la Copie</span>
                  </h3>
                  <span className="text-xs text-stone-500 font-medium">
                    {exercise.questions.length} question{exercise.questions.length > 1 ? 's' : ''} à traiter
                  </span>
                </div>

                {exercise.questions.map((q) => {
                  const lines = answers[q.id] || ['', '', ''];

                  return (
                    <section
                      key={q.id}
                      id={`question-card-${q.id}`}
                      className="space-y-4 border-b border-stone-200/80 pb-8 last:border-b-0 scroll-mt-28"
                    >
                      {/* En-tête et Énoncé de la question */}
                      <div className="w-full bg-stone-50 border border-stone-200/90 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                            {q.number}
                          </span>
                          <div className="w-full text-stone-900 text-sm sm:text-base font-semibold leading-relaxed select-text break-words">
                            <MathText text={q.text} />
                          </div>
                        </div>
                      </div>

                      {/* Lignes d'écriture en pointillés de l'étudiant */}
                      <div className="space-y-2 pt-1 pl-2 sm:pl-4">
                        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 pb-1">
                          <PenLine className="w-3.5 h-3.5 text-blue-600" />
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
                                  onChange={(e) => updateLine(q.id, lineIdx, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, q.id, lineIdx, lines.length)}
                                  placeholder={
                                    lineIdx === 0 && lineText === ''
                                      ? 'Rédigez votre démonstration ou calcul ici...'
                                      : ''
                                  }
                                  className="w-full bg-transparent border-b-2 border-dotted border-stone-300 group-hover:border-stone-400 focus:border-blue-600 focus:border-solid focus:outline-hidden py-1.5 px-1 text-stone-900 text-sm sm:text-base font-sans tracking-wide transition-colors placeholder:text-stone-400 placeholder:italic"
                                />
                              </div>

                              {/* Petit bouton plus bleu à la fin de la dernière ligne */}
                              {isLastLine && (
                                <button
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
                    </section>
                  );
                })}
              </div>
            </div>

            {/* ================================================================= */}
            {/* COLONNE DROITE : CORRECTION DÉTAILLÉE & 2 EXEMPLES CONCRETS       */}
            {/* ================================================================= */}
            {showCorrection && (
              <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
                <div className="w-full bg-slate-50/90 border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
                  
                  {/* En-tête de la correction */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                          Correction Détaillée Officielle
                        </h3>
                        <span className="text-[10px] text-slate-500">
                          Résolution pas à pas & Exemples d'application
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Résolution Étape par Étape ("steps") */}
                  <div className="space-y-2">
                    <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      Résolution Étape par Étape :
                    </span>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 text-stone-900 text-xs sm:text-sm leading-relaxed select-text shadow-2xs whitespace-pre-line break-words">
                      <MathText text={exercise.correction.steps} />
                    </div>
                  </div>

                  {/* Deux Exemples Concrets et Distincts ("examples") */}
                  {exercise.correction.examples && exercise.correction.examples.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Deux Exemples Concrets d'Application :
                      </span>

                      {exercise.correction.examples.map((ex, exIdx) => (
                        <div
                          key={exIdx}
                          className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed select-text shadow-2xs space-y-1.5 ${
                            exIdx === 0
                              ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-950'
                              : 'bg-indigo-50/80 border-indigo-200/90 text-indigo-950'
                          }`}
                        >
                          <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            exIdx === 0 ? 'text-emerald-800' : 'text-indigo-800'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Exemple Concret {exIdx + 1} :
                          </span>
                          <div className="font-normal text-stone-900">
                            <MathText text={ex} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note méthodologique de fin de correction */}
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2 text-[11px] text-amber-900 leading-relaxed">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Conseil méthodologique :</strong> Comparez votre démarche étape par étape avec la résolution officielle pour vérifier la rigueur de vos calculs et de vos arguments.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
