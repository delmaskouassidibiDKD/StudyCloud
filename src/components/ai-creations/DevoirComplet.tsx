import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Printer,
  Award,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Pause,
  Check,
  Sparkles,
  Loader2
} from 'lucide-react';

import { DnaLogo } from '../DnaLogo';
import { MathText } from '../MathText';
import { CertificatExcellence, CertificateData } from './CertificatExcellence';
import { gradeExamPaper } from '../../services/api';

// ==========================================
// COMPOSANT LOGO STUDYCLOUD / DKD TECHNOLOGIES
// ==========================================
function StudyCloudLogo() {
  return (
    <div
      id="studycloud-logo"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0369A1] text-white shadow-xs border border-sky-800 select-none"
      title="StudyCloud - DKD TECHNOLOGIES"
    >
      <DnaLogo className="w-6 h-6 shrink-0" glow={true} />
      <div className="flex flex-col text-left leading-none">
        <div className="flex items-baseline text-sm sm:text-base font-black tracking-tight font-sans">
          <span className="text-[#F38020]">Study</span>
          <span className="text-[#38BDF8]">Cloud</span>
        </div>
        <span className="text-[7.5px] sm:text-[8px] font-sans font-extrabold tracking-[0.22em] text-sky-100 uppercase mt-0.5">
          DKD TECHNOLOGIES
        </span>
      </div>
    </div>
  );
}

// ==========================================
// PARSEUR DE DURÉE D'EXAMEN FIXÉE PAR L'IA
// ==========================================
export function parseDurationToSeconds(dureeStr?: string | number): number {
  if (!dureeStr) return 120 * 60; // 2h00 par défaut
  if (typeof dureeStr === 'number') return dureeStr * 60;
  const str = String(dureeStr).toLowerCase().trim();

  let hours = 0;
  let minutes = 0;

  const hMatch = str.match(/(\d+)\s*(?:h|heure)/i);
  if (hMatch) {
    hours = parseInt(hMatch[1], 10);
  }

  const mMatch = str.match(/(\d+)\s*(?:m|min|minute)/i);
  if (mMatch) {
    minutes = parseInt(mMatch[1], 10);
  } else if (hMatch) {
    const afterH = str.split(/h|heure/i)[1];
    if (afterH) {
      const num = parseInt(afterH.replace(/\D/g, ''), 10);
      if (!isNaN(num)) minutes = num;
    }
  } else {
    const numMatch = str.match(/^(\d+)/);
    if (numMatch) {
      minutes = parseInt(numMatch[1], 10);
    }
  }

  const total = hours * 3600 + minutes * 60;
  return total > 0 ? total : 120 * 60;
}

// ==========================================
// TYPES DE DONNÉES NORMALISÉES
// ==========================================
export interface NormalizedQuestion {
  id: string;
  number: string;
  type: 'open' | 'true_false' | 'multiple_choice';
  texte: string;
  points: number;
  options?: string[];
  correctIndex?: number;
  correctValue?: boolean;
  sampleAnswer?: string;
  explication?: string;
}

export interface NormalizedSection {
  id: string;
  title: string;
  problem_statement?: string;
  questions: NormalizedQuestion[];
  correction?: {
    steps?: string;
    examples?: string[];
  };
}

// ==========================================
// NORMALISATION DYNAMIQUE DE L'ÉPREUVE
// Supporte complete_exam.sections ET legacy exercice1..4
// ==========================================
export function normalizeExamData(data: any, title?: string) {
  const source =
    data?.complete_exam ||
    data?.creation_data?.complete_exam ||
    data?.exam ||
    data?.devoir ||
    data?.creation_data?.exam ||
    data?.creation_data?.devoir ||
    data?.creation_data ||
    data ||
    {};

  const discipline =
    source.title ||
    source.matiere ||
    source.discipline ||
    source.subject ||
    data?.title ||
    data?.matiere ||
    data?.discipline ||
    data?.subject ||
    title ||
    "ÉPREUVE OFFICIELLE D'EXAMEN";

  let rawDuree = source.duree || source.duration || data?.duree || data?.duration;
  if (!rawDuree && (source.duration_minutes || data?.duration_minutes)) {
    const mins = Number(source.duration_minutes || data?.duration_minutes);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    rawDuree = h > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h00`) : `${mins} min`;
  }
  const formattedDuree = rawDuree
    ? (String(rawDuree).toLowerCase().startsWith("durée") ? String(rawDuree) : `Durée : ${rawDuree}`)
    : "Durée : 2h00";

  const durationSec = parseDurationToSeconds(rawDuree || "2h00");

  const rawSections: any[] = Array.isArray(source.sections)
    ? source.sections
    : (Array.isArray(data?.sections) ? data.sections : []);

  let sections: NormalizedSection[] = [];

  if (rawSections.length > 0) {
    sections = rawSections.map((sec: any, sIdx: number) => {
      const secId = sec.section_id || `sec_${sIdx + 1}`;
      const secTitle = sec.title || `Partie ${sIdx + 1}`;
      const problemStatement = sec.problem_statement || sec.enonce || sec.context || sec.contexte || '';

      const rawQList = Array.isArray(sec.questions) ? sec.questions : [];
      const questions: NormalizedQuestion[] = rawQList.map((q: any, qIdx: number) => {
        const qId = (typeof q === 'object' && q.id) ? q.id : `${secId}_q${qIdx + 1}`;
        const qNum = (typeof q === 'object' && q.number) ? q.number : `${qIdx + 1}.`;

        if (typeof q === 'string') {
          return {
            id: qId,
            number: qNum,
            type: 'open',
            texte: q,
            points: 2,
            sampleAnswer: ''
          };
        }

        const isTrueFalse =
          q.type === 'true_false' ||
          q.type === 'vf' ||
          typeof q.correct_answer === 'boolean' ||
          typeof q.correctValue === 'boolean';

        const isMultipleChoice =
          q.type === 'multiple_choice' ||
          q.type === 'qcm' ||
          (Array.isArray(q.options) && q.options.length > 0) ||
          (Array.isArray(q.choices) && q.choices.length > 0);

        if (isTrueFalse) {
          return {
            id: qId,
            number: qNum,
            type: 'true_false',
            texte: q.question || q.texte || `Affirmation ${qIdx + 1}`,
            points: Number(q.points) || 1,
            correctValue:
              typeof q.correct_answer === 'boolean'
                ? q.correct_answer
                : typeof q.correctValue === 'boolean'
                ? q.correctValue
                : true,
            explication: q.explication || q.explanation || ''
          };
        }

        if (isMultipleChoice) {
          const opts = Array.isArray(q.options) ? q.options : (Array.isArray(q.choices) ? q.choices : []);
          return {
            id: qId,
            number: qNum,
            type: 'multiple_choice',
            texte: q.question || q.texte || `Question ${qIdx + 1}`,
            points: Number(q.points) || 1,
            options: opts,
            correctIndex:
              typeof q.correct_index === 'number'
                ? q.correct_index
                : typeof q.correctIndex === 'number'
                ? q.correctIndex
                : 0,
            explication: q.explication || q.explanation || ''
          };
        }

        return {
          id: qId,
          number: qNum,
          type: 'open',
          texte: q.question || q.texte || `Question ${qIdx + 1}`,
          points: Number(q.points) || 2,
          sampleAnswer: q.sampleAnswer || q.reponse || q.correction || ''
        };
      });

      const secCorrection = sec.correction
        ? {
            steps: typeof sec.correction === 'string' ? sec.correction : (sec.correction.steps || sec.correction.explication || ''),
            examples: Array.isArray(sec.correction.examples) ? sec.correction.examples : []
          }
        : undefined;

      return {
        id: secId,
        title: secTitle,
        problem_statement: problemStatement,
        questions,
        correction: secCorrection
      };
    });
  }

  // Si pas de sections explicites, synthétise depuis rawEx1..4
  const rawEx1 = source.exercice1 || source.problem || source.partie1 || (Array.isArray(source.exercices) && source.exercices[0]);
  const rawEx2 = source.exercice2 || source.qcm || source.partie2 || (Array.isArray(source.exercices) && source.exercices[1]);
  const rawEx3 = source.exercice3 || source.questionsRedigees || source.synthese || source.partie3 || (Array.isArray(source.exercices) && source.exercices[2]);
  const rawEx4 = source.exercice4 || source.vraiOuFaux || source.vf || source.partie4 || (Array.isArray(source.exercices) && source.exercices[3]);

  const rawQ1 = Array.isArray(rawEx1?.questions) ? rawEx1.questions : [];
  const exercice1 = {
    titre: rawEx1?.titre || rawEx1?.title || "EXERCICE 1 : PROBLÈME MAJEUR & ÉTUDE DE CAS TECHNIQUE",
    points: Number(rawEx1?.points) || 8,
    enonce: rawEx1?.enonce || rawEx1?.context || rawEx1?.contexte || "",
    questions:
      rawQ1.length > 0
        ? rawQ1.map((q: any, i: number) => ({
            id: q.id || `p1_q${i + 1}`,
            number: q.number || `${i + 1}.`,
            points: Number(q.points) || (i === 0 ? 2 : 3),
            texte: q.texte || q.question || q.text || `Question ${i + 1}`,
            sampleAnswer: q.sampleAnswer || q.reponse || q.correction || q.answer || ""
          }))
        : [
            { id: 'p1_q1', number: '1.', points: 2, texte: "Analyse théorique et modélisation du problème.", sampleAnswer: "" },
            { id: 'p1_q2', number: '2.', points: 3, texte: "Développement analytique et calculs rigoureux.", sampleAnswer: "" },
            { id: 'p1_q3', number: '3.', points: 3, texte: "Interprétation critique et synthèse globale.", sampleAnswer: "" }
          ]
  };

  const rawQ2 = Array.isArray(rawEx2?.questions) ? rawEx2.questions : [];
  const exercice2 = {
    titre: rawEx2?.titre || rawEx2?.title || "EXERCICE 2 : QUESTIONS À CHOIX MULTIPLES",
    points: Number(rawEx2?.points) || 4,
    consigne: rawEx2?.consigne || "Pour chaque question, cochez la seule proposition exacte parmi les quatre choix proposés.",
    questions:
      rawQ2.length > 0
        ? rawQ2.map((q: any, i: number) => ({
            id: q.id || `p2_q${i + 1}`,
            number: q.number || `${i + 1}.`,
            points: Number(q.points) || 1,
            texte: q.texte || q.question || q.text || `Question ${i + 1}`,
            options: Array.isArray(q.options) && q.options.length > 0 ? q.options : (Array.isArray(q.choices) ? q.choices : ["Proposition A", "Proposition B", "Proposition C", "Proposition D"]),
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : (typeof q.bonne_reponse === 'number' ? q.bonne_reponse : 0),
            explication: q.explication || q.explanation || q.justification || ""
          }))
        : [1, 2, 3, 4].map((num) => ({
            id: `p2_q${num}`,
            number: `${num}.`,
            points: 1,
            texte: `Question d'évaluation conceptuelle n°${num}`,
            options: ["Proposition A", "Proposition B", "Proposition C", "Proposition D"],
            correctIndex: 0,
            explication: ""
          }))
  };

  const rawQ3 = Array.isArray(rawEx3?.questions) ? rawEx3.questions : [];
  const exercice3 = {
    titre: rawEx3?.titre || rawEx3?.title || "EXERCICE 3 : QUESTIONS DE SYNTHÈSE RÉDIGÉE",
    points: Number(rawEx3?.points) || 4,
    consigne: rawEx3?.consigne || "Répondez de manière précise et concise directement sur votre copie.",
    questions:
      rawQ3.length > 0
        ? rawQ3.map((q: any, i: number) => ({
            id: q.id || `p3_q${i + 1}`,
            number: q.number || `${i + 1}.`,
            points: Number(q.points) || 2,
            texte: q.texte || q.question || q.text || `Question ${i + 1}`,
            sampleAnswer: q.sampleAnswer || q.reponse || q.correction || ""
          }))
        : [
            { id: 'p3_q1', number: '1.', points: 2, texte: "Synthèse conceptuelle et démonstration rédigée.", sampleAnswer: "" },
            { id: 'p3_q2', number: '2.', points: 2, texte: "Analyse des conditions d'application ou étude critique.", sampleAnswer: "" }
          ]
  };

  const rawQ4 = Array.isArray(rawEx4?.questions) ? rawEx4.questions : [];
  const exercice4 = {
    titre: rawEx4?.titre || rawEx4?.title || "EXERCICE 4 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX",
    points: Number(rawEx4?.points) || 4,
    consigne: rawEx4?.consigne || "Pour chaque affirmation ci-dessous, cochez VRAI ou FAUX.",
    questions:
      rawQ4.length > 0
        ? rawQ4.map((q: any, i: number) => ({
            id: q.id || `p4_q${i + 1}`,
            number: q.number || `${i + 1}.`,
            points: Number(q.points) || 1,
            texte: q.texte || q.affirmation || q.question || `Affirmation ${i + 1}`,
            correctValue: typeof q.correctValue === 'boolean' ? q.correctValue : (typeof q.isTrue === 'boolean' ? q.isTrue : q.reponse === true || q.reponse === 'VRAI' || q.reponse === 'true'),
            explication: q.explication || q.explanation || ""
          }))
        : [1, 2, 3, 4].map((num) => ({
            id: `p4_q${num}`,
            number: `${num}.`,
            points: 1,
            texte: `Affirmation conceptuelle ou cas limite n°${num}`,
            correctValue: num % 2 === 0,
            explication: ""
          }))
  };

  if (sections.length === 0) {
    sections = [
      {
        id: 'sec_1',
        title: exercice1.titre,
        problem_statement: exercice1.enonce,
        questions: exercice1.questions.map((q) => ({ ...q, type: 'open' as const })),
        correction: undefined
      },
      {
        id: 'sec_2',
        title: exercice2.titre,
        questions: exercice2.questions.map((q) => ({ ...q, type: 'multiple_choice' as const })),
        correction: undefined
      },
      {
        id: 'sec_3',
        title: exercice3.titre,
        questions: exercice3.questions.map((q) => ({ ...q, type: 'open' as const })),
        correction: undefined
      },
      {
        id: 'sec_4',
        title: exercice4.titre,
        questions: exercice4.questions.map((q) => ({ ...q, type: 'true_false' as const })),
        correction: undefined
      }
    ];
  }

  const examHeader = {
    institution: source.institution || data?.institution || "DKD School Numérique",
    sousTitre: source.sousTitre || source.subTitle || data?.sousTitre || "Évaluation Officielle d'Examen",
    duree: formattedDuree,
    durationSeconds: durationSec,
    matiere: discipline,
    mention:
      source.mention ||
      data?.mention ||
      source.instructions ||
      `Cette épreuve comporte ${sections.length} partie(s) d'évaluation structurée(s).`,
    calculatrice: source.calculatrice || data?.calculatrice || "Tout modèle de calculatrice scientifique est autorisé.",
    baremeTotal: Number(source.baremeTotal || data?.baremeTotal) || 20
  };

  return { examHeader, sections, exercice1, exercice2, exercice3, exercice4 };
}

export default function DevoirComplet({ data, title }: { data?: any; title?: string }) {
  // Données actives de l'examen normalisées
  const activeData = normalizeExamData(data, title);
  const { examHeader, sections } = activeData;

  const totalPages = Math.max(1, sections.length);

  // Navigation entre les pages (parties)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Minuteur d'examen dynamique initialisé selon le temps fixé par l'IA
  const [secondsLeft, setSecondsLeft] = useState<number>(() => examHeader.durationSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Réponses candidat
  const [openAnswers, setOpenAnswers] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    sections.forEach((sec) => {
      sec.questions.forEach((q) => {
        if (q.type === 'open') {
          init[q.id] = ['', '', ''];
        }
      });
    });
    return init;
  });

  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, number>>({});
  const [booleanAnswers, setBooleanAnswers] = useState<Record<string, boolean>>({});

  // État de soumission et correction
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showCorrectionDetail, setShowCorrectionDetail] = useState<boolean>(false);
  const [gradingResult, setGradingResult] = useState<any>(null);

  // Modale du Certificat Officiel d'Excellence
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);

  // Réinitialisation automatique lorsque data change
  useEffect(() => {
    const initOpen: Record<string, string[]> = {};
    sections.forEach((sec) => {
      sec.questions.forEach((q) => {
        if (q.type === 'open') {
          initOpen[q.id] = ['', '', ''];
        }
      });
    });
    setOpenAnswers(initOpen);
    setChoiceAnswers({});
    setBooleanAnswers({});
    setSecondsLeft(examHeader.durationSeconds);
    setIsTimerRunning(true);
    setIsSubmitted(false);
    setShowCorrectionDetail(false);
    setGradingResult(null);
    setShowCertificateModal(false);
    setCurrentPage(1);
  }, [data]);

  // Gestion du chronomètre
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsLeft > 0 && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsTimerRunning(false);
            triggerGradeExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, secondsLeft, isSubmitted]);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Gestion des lignes pour les questions ouvertes
  const updateOpenLine = (qId: string, index: number, val: string) => {
    const current = [...(openAnswers[qId] || ['', '', ''])];
    current[index] = val;
    setOpenAnswers({ ...openAnswers, [qId]: current });
  };

  const addOpenLine = (qId: string) => {
    const current = [...(openAnswers[qId] || ['', '', ''])];
    current.push('');
    setOpenAnswers({ ...openAnswers, [qId]: current });
    setTimeout(() => {
      const idx = current.length - 1;
      document.getElementById(`input-open-${qId}-${idx}`)?.focus();
    }, 40);
  };

  // Calcul local des scores de secours
  const calculateScores = () => {
    let totalPointsEarned = 0;
    let totalPossible = 0;

    sections.forEach((sec) => {
      sec.questions.forEach((q) => {
        const maxPts = q.points || 1;
        totalPossible += maxPts;

        if (q.type === 'open') {
          const text = (openAnswers[q.id] || []).join(' ').trim();
          if (text.length >= 60) totalPointsEarned += maxPts;
          else if (text.length >= 25) totalPointsEarned += Math.round(maxPts * 0.6 * 2) / 2;
          else if (text.length > 5) totalPointsEarned += Math.round(maxPts * 0.3 * 2) / 2 || 0.5;
        } else if (q.type === 'multiple_choice') {
          if (choiceAnswers[q.id] === q.correctIndex) {
            totalPointsEarned += maxPts;
          }
        } else if (q.type === 'true_false') {
          if (booleanAnswers[q.id] === q.correctValue) {
            totalPointsEarned += maxPts;
          }
        }
      });
    });

    const scaled = totalPossible > 0
      ? Math.round((totalPointsEarned / totalPossible) * 20 * 2) / 2
      : 15;
    const finalScore = Math.min(20, Math.max(0, scaled));

    return {
      total: finalScore,
      earned: totalPointsEarned,
      possible: totalPossible
    };
  };

  // ========================================================================
  // SOUMISSION ET CORRECTION PAR L'IA + DÉLIVRANCE DU CERTIFICAT
  // ========================================================================
  const triggerGradeExam = async () => {
    setIsGrading(true);
    setShowConfirmModal(false);
    setIsTimerRunning(false);

    const userName = localStorage.getItem('unifolder_user_name') || 'Étudiant DKD School Numérique';
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';

    try {
      const res = await gradeExamPaper({
        exam: activeData,
        answers: {
          openAnswers,
          choiceAnswers,
          booleanAnswers,
          answersP1: openAnswers,
          answersP2: choiceAnswers,
          answersP3: openAnswers,
          answersP4: booleanAnswers,
          ...choiceAnswers,
          ...booleanAnswers
        },
        userId,
        studentName: userName,
        sourceFileName: data?.sourceFileName || data?.fileName || examHeader.matiere,
        sourceFileId: data?.sourceFileId || data?.fileId || null,
        topic: examHeader.matiere
      });

      if (res && typeof res.scoreTotal === 'number') {
        setGradingResult(res);
      } else {
        throw new Error("Format de réponse non standard");
      }
    } catch (err) {
      console.warn("[Grade Exam Fallback]", err);
      const local = calculateScores();
      setGradingResult({
        scoreTotal: local.total,
        feedbackGlobal: local.total >= 16
          ? "Excellente prestation académique ! Vos raisonnements sont rigoureux et bien articulés."
          : "Bonne participation. Reprenez attentivement les points clés du corrigé officiel pour progresser.",
        certificateInfo: {
          eligible: local.total >= 16,
          awarded: local.total >= 16,
          alreadyIssued: false,
          certificate: local.total >= 16 ? {
            topic: examHeader.matiere,
            score: local.total,
            max_score: 20,
            certificate_code: `CERT-DKD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            student_name: userName,
            issued_at: new Date().toISOString()
          } : null,
          message: local.total >= 16 ? "Félicitations pour votre certificat !" : ""
        }
      });
    } finally {
      setIsGrading(false);
      setIsSubmitted(true);
      setShowCorrectionDetail(true);
    }
  };

  const handleConfirmSubmit = () => {
    triggerGradeExam();
  };

  const handleResetExam = () => {
    if (window.confirm("Voulez-vous recommencer l'épreuve à zéro ? Vos réponses seront effacées.")) {
      const initOpen: Record<string, string[]> = {};
      sections.forEach((sec) => {
        sec.questions.forEach((q) => {
          if (q.type === 'open') {
            initOpen[q.id] = ['', '', ''];
          }
        });
      });
      setOpenAnswers(initOpen);
      setChoiceAnswers({});
      setBooleanAnswers({});
      setSecondsLeft(examHeader.durationSeconds);
      setIsTimerRunning(true);
      setIsSubmitted(false);
      setShowCorrectionDetail(false);
      setGradingResult(null);
      setShowCertificateModal(false);
      setCurrentPage(1);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const localScores = calculateScores();
  const finalScore = gradingResult?.scoreTotal ?? localScores.total;

  const effectiveCert: CertificateData | null =
    gradingResult?.certificateInfo?.certificate ||
    (finalScore >= 16
      ? {
          topic: examHeader.matiere,
          score: finalScore,
          max_score: 20,
          certificate_code: `CERT-DKD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          student_name: localStorage.getItem('unifolder_user_name') || 'Étudiant DKD School Numérique',
          issued_at: new Date().toISOString()
        }
      : null);

  const activeSection = sections[Math.min(currentPage - 1, sections.length - 1)] || sections[0];

  return (
    <div id="module-devoir-complet" className="w-full min-h-screen bg-stone-200/70 pb-28">
      {/* 
        BARRE D'OUTILS FIXE (STICKY) STYLE EXAMEN / PDF
      */}
      <div
        id="devoir-sticky-toolbar"
        className="sticky top-[53px] sm:top-[57px] z-30 w-full bg-stone-900 text-stone-100 border-b border-stone-800 shadow-md px-3 sm:px-6 py-2.5"
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Chronomètre & Statut */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-mono font-bold text-xs sm:text-sm ${
                secondsLeft < 300 && !isSubmitted
                  ? 'bg-rose-950/80 border-rose-600 text-rose-300 animate-pulse'
                  : 'bg-stone-800 border-stone-700 text-stone-200'
              }`}
            >
              <Clock className="w-4 h-4 text-stone-400" />
              <span>{formatTime(secondsLeft)}</span>
            </div>

            {!isSubmitted && (
              <button
                id="btn-timer-toggle"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors cursor-pointer"
                title={isTimerRunning ? "Suspendre le chronomètre" : "Démarrer le chronomètre"}
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            )}
          </div>

          {/* Navigation des pages (Parties du devoir) */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              id="btn-prev-page"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-200 transition-colors cursor-pointer"
              title="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Onglets pages dynamiques */}
            <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-lg border border-stone-700">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  id={`btn-page-tab-${pNum}`}
                  onClick={() => setCurrentPage(pNum)}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                    currentPage === pNum
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  P.{pNum}
                </button>
              ))}
            </div>

            <button
              id="btn-next-page"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-200 transition-colors cursor-pointer"
              title="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Actions : Imprimer & Réinitialiser */}
          <div className="flex items-center gap-2">
            <button
              id="btn-print-exam"
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors shadow-2xs cursor-pointer"
              title="Imprimer l'épreuve"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              id="btn-reset-exam"
              onClick={handleResetExam}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors shadow-2xs cursor-pointer"
              title="Recommencer l'épreuve"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 
        RÉSULTAT D'EXAMEN APRÈS SOUMISSION (Bannière officielle & Bouton Certificat)
      */}
      {isSubmitted && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <div
            id="exam-result-banner"
            className={`p-5 sm:p-6 rounded-2xl border shadow-md flex flex-col gap-4 ${
              finalScore >= 16
                ? 'bg-gradient-to-r from-amber-50 via-white to-amber-50/80 border-amber-300'
                : 'bg-white border-stone-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    finalScore >= 16
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                      : 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  }`}
                >
                  {finalScore >= 16 ? <Sparkles className="w-6 h-6" /> : <Award className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black font-serif text-stone-900">
                      {finalScore >= 16
                        ? `🎉 Félicitations ! Note d'Excellence : ${finalScore} / 20 points`
                        : `Épreuve Déposée • Note Globale : ${finalScore} / 20 points`}
                    </h3>
                  </div>
                  {gradingResult?.feedbackGlobal && (
                    <p className="text-xs text-stone-700 italic mt-1.5 font-serif">
                      « {gradingResult.feedbackGlobal} »
                    </p>
                  )}
                  {gradingResult?.certificateInfo?.alreadyIssued && (
                    <p className="text-[11px] text-amber-800 font-medium mt-1">
                      ℹ️ Certificat officiel déjà délivré pour ce document. Chaque certificat ne peut être obtenu qu'une seule fois par fichier.
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Post-Évaluation : Bouton Certificat + Corrigé */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                {finalScore >= 16 && (
                  <button
                    id="btn-show-certificate"
                    onClick={() => setShowCertificateModal(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-stone-950" />
                    <span>Afficher votre Certificat</span>
                  </button>
                )}

                <button
                  id="btn-toggle-correction-view"
                  onClick={() => setShowCorrectionDetail(!showCorrectionDetail)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {showCorrectionDetail ? "Masquer le corrigé type" : "Consulter le corrigé type complet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        FEUILLE D'EXAMEN OFFICIELLE STYLE BACCALAURÉAT / CONCOURS
        Espaces 100% auto-extensibles s'adaptant à toute longueur de problème
      */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <article
          id={`exam-sheet-page-${currentPage}`}
          className="bg-white border border-stone-300 rounded-sm shadow-md p-6 sm:p-10 md:p-12 space-y-8 min-h-[850px] h-auto flex flex-col justify-between overflow-visible"
        >
          {/* ========================================================
              EN-TÊTE OFFICIEL DKD SCHOOL NUMÉRIQUE & STUDYCLOUD
              ======================================================== */}
          <header className="border-b-2 border-stone-900 pb-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left space-y-0.5">
                <h2 className="font-serif font-black text-sm sm:text-base tracking-wide text-stone-900 uppercase">
                  {examHeader.institution}
                </h2>
                <p className="text-[10px] sm:text-[11px] font-serif text-stone-600 tracking-wider uppercase">
                  {examHeader.sousTitre}
                </p>
                <p className="text-[11px] font-serif font-bold text-stone-800">
                  {examHeader.duree}
                </p>
              </div>

              <div className="text-right shrink-0">
                <StudyCloudLogo />
              </div>
            </div>

            <div className="text-center py-1 sm:py-2">
              <div className="inline-block border-2 border-stone-900 px-6 sm:px-10 py-2">
                <h1 className="text-base sm:text-xl font-serif font-black tracking-widest text-stone-900 uppercase break-words">
                  {examHeader.matiere}
                </h1>
              </div>
            </div>

            <div className="text-center space-y-1.5 pt-0.5">
              <p className="text-[11px] sm:text-xs font-serif italic text-stone-700">
                {examHeader.mention}
              </p>
              <p className="text-[10px] sm:text-[11px] font-serif italic text-stone-600">
                {examHeader.calculatrice} • Barème officiel sur {examHeader.baremeTotal} points.
              </p>
              <div className="inline-block bg-amber-50 border border-amber-200 rounded-md px-3 py-1 mt-1 text-center">
                <p className="text-[10px] sm:text-[11px] font-serif font-bold text-amber-900">
                  Consigne stricte : après l'heure écoulée ({examHeader.duree}), le sujet sera pris et soumis automatiquement pour la correction.
                </p>
              </div>
            </div>
          </header>

          {/* ========================================================
              CONTENU DE LA PARTIE ACTIVE DU DEVOIR
              ======================================================== */}
          <div className="flex-1 space-y-8 pt-2">
            <div id={`section-container-${activeSection.id}`} className="space-y-6">
              {/* Titre de la partie */}
              <div className="border-b border-stone-300 pb-2">
                <div className="inline-block border border-stone-900 px-3 py-1 text-xs sm:text-sm font-serif font-extrabold uppercase tracking-wider text-stone-900">
                  {activeSection.title}
                </div>
              </div>

              {/* Énoncé / Problème pratique si présent (s'étire dynamiquement) */}
              {activeSection.problem_statement && (
                <div className="bg-stone-50/80 p-4 sm:p-5 border-l-4 border-stone-800 text-stone-800 text-xs sm:text-sm font-serif leading-relaxed space-y-2 h-auto break-words overflow-visible">
                  <span className="font-bold uppercase tracking-wider text-xs block text-stone-900">
                    Énoncé de la situation & données du problème :
                  </span>
                  <div className="text-stone-800 leading-relaxed break-words whitespace-pre-line">
                    <MathText text={activeSection.problem_statement} />
                  </div>
                </div>
              )}

              {/* Questions de la partie */}
              <div className="space-y-6">
                <span className="font-serif font-bold text-xs uppercase tracking-wider text-stone-900 block">
                  Questions à traiter :
                </span>

                <div className="space-y-6 pl-1">
                  {activeSection.questions.map((q) => {
                    return (
                      <div key={q.id} id={`question-block-${q.id}`} className="space-y-3">
                        {/* Énoncé de la question */}
                        <div className="flex items-start gap-2.5 font-serif text-xs sm:text-sm text-stone-900 leading-relaxed">
                          <span className="font-bold shrink-0">{q.number}</span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <MathText text={q.texte} className="font-medium break-words leading-relaxed text-stone-900" />
                            <span className="text-xs text-stone-500 font-sans font-normal">
                              ({q.points} {q.points > 1 ? 'points' : 'point'})
                            </span>
                          </div>
                        </div>

                        {/* Rendu spécifique selon le type de question */}
                        {q.type === 'true_false' && (
                          <div className="pl-5 pt-1 space-y-2">
                            <div className="flex items-center gap-6">
                              <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-serif font-bold text-stone-800 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`vf-${q.id}`}
                                  disabled={isSubmitted}
                                  checked={booleanAnswers[q.id] === true}
                                  onChange={() => setBooleanAnswers({ ...booleanAnswers, [q.id]: true })}
                                  className="accent-stone-900 cursor-pointer"
                                />
                                <span>VRAI</span>
                              </label>

                              <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-serif font-bold text-stone-800 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`vf-${q.id}`}
                                  disabled={isSubmitted}
                                  checked={booleanAnswers[q.id] === false}
                                  onChange={() => setBooleanAnswers({ ...booleanAnswers, [q.id]: false })}
                                  className="accent-stone-900 cursor-pointer"
                                />
                                <span>FAUX</span>
                              </label>
                            </div>

                            {/* Correction type pour Vrai/Faux */}
                            {showCorrectionDetail && (
                              <div className="mt-2 text-xs font-sans text-stone-800 bg-emerald-50/70 p-3 rounded-lg border border-emerald-300 break-words h-auto leading-relaxed">
                                <strong className="text-emerald-900 uppercase text-[11px] block mb-1">
                                  Réponse attendue :{' '}
                                  <span className={q.correctValue ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                    {q.correctValue ? 'VRAI' : 'FAUX'}
                                  </span>
                                </strong>
                                {q.explication && (
                                  <div className="text-stone-800 mt-1">
                                    <MathText text={`Justification : ${q.explication}`} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {q.type === 'multiple_choice' && (
                          <div className="space-y-2 pl-5 sm:pl-6">
                            {(q.options || []).map((opt, optIdx) => {
                              const isChecked = choiceAnswers[q.id] === optIdx;
                              const isCorrect = showCorrectionDetail && optIdx === q.correctIndex;
                              const isWrong = showCorrectionDetail && isChecked && optIdx !== q.correctIndex;

                              return (
                                <label
                                  key={optIdx}
                                  className={`flex items-start gap-3 p-2.5 rounded cursor-pointer transition-colors text-xs sm:text-sm font-serif ${
                                    isCorrect
                                      ? 'bg-emerald-50 text-emerald-950 font-semibold'
                                      : isWrong
                                      ? 'bg-rose-50 text-rose-900'
                                      : isChecked
                                      ? 'bg-stone-100 text-stone-900 font-medium'
                                      : 'hover:bg-stone-50 text-stone-800'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`mc-${q.id}`}
                                    disabled={isSubmitted}
                                    checked={isChecked}
                                    onChange={() => setChoiceAnswers({ ...choiceAnswers, [q.id]: optIdx })}
                                    className="mt-1 accent-stone-900 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <MathText text={opt} className="break-words leading-relaxed" />
                                  </div>
                                </label>
                              );
                            })}

                            {showCorrectionDetail && q.explication && (
                              <div className="mt-1 p-2.5 bg-stone-50 border-l-3 border-stone-700 text-stone-800 text-xs font-sans leading-relaxed break-words h-auto">
                                <strong className="block text-[11px] uppercase tracking-wider text-stone-700 mb-0.5">
                                  Justification officielle :
                                </strong>
                                <MathText text={q.explication} className="break-words leading-relaxed" />
                              </div>
                            )}
                          </div>
                        )}

                        {q.type === 'open' && (
                          <div className="space-y-2.5 pl-2 sm:pl-4">
                            {/* Lignes d'écriture en pointillés extensibles */}
                            <div className="space-y-2 pl-2">
                              {(openAnswers[q.id] || ['', '', '']).map((lineText, lIdx) => {
                                const lines = openAnswers[q.id] || ['', '', ''];
                                const isLast = lIdx === lines.length - 1;

                                return (
                                  <div key={lIdx} className="w-full flex items-center gap-2">
                                    <input
                                      id={`input-open-${q.id}-${lIdx}`}
                                      type="text"
                                      value={lineText}
                                      disabled={isSubmitted}
                                      onChange={(e) => updateOpenLine(q.id, lIdx, (e.target as HTMLInputElement).value)}
                                      placeholder={
                                        lIdx === 0 && lineText === ''
                                          ? 'Rédigez votre réponse ou calcul détaillé ici...'
                                          : ''
                                      }
                                      className="w-full bg-transparent border-b-2 border-dotted border-stone-400 focus:border-stone-900 focus:border-solid focus:outline-hidden py-1.5 text-stone-900 text-xs sm:text-sm font-serif tracking-wide disabled:text-stone-700 placeholder:text-stone-400 placeholder:italic transition-colors"
                                    />

                                    {isLast && !isSubmitted && (
                                      <button
                                        id={`btn-add-line-${q.id}`}
                                        type="button"
                                        onClick={() => addOpenLine(q.id)}
                                        className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs cursor-pointer"
                                        title="Ajouter une ligne supplémentaire"
                                        aria-label="Ajouter une ligne"
                                      >
                                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Corrigé type de la question */}
                            {showCorrectionDetail && q.sampleAnswer && (
                              <div className="mt-2.5 p-3.5 bg-emerald-50/90 border-l-4 border-emerald-600 text-emerald-950 text-xs font-sans leading-relaxed break-words h-auto rounded-r-lg space-y-1">
                                <strong className="block text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                                  Corrigé type de la question :
                                </strong>
                                <MathText text={q.sampleAnswer} className="break-words leading-relaxed text-emerald-950" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 
                CORRECTION COMPLÈTE DE LA SECTION (AVEC LES 2 EXEMPLES CONCRETS OBLIGATOIRES)
              */}
              {showCorrectionDetail && activeSection.correction && (
                <div className="mt-8 p-5 sm:p-6 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50/40 border-2 border-emerald-500/80 rounded-xl space-y-4 text-emerald-950">
                  <div className="flex items-center gap-2 border-b border-emerald-300 pb-2.5">
                    <Sparkles className="w-5 h-5 text-emerald-700 shrink-0" />
                    <h4 className="font-serif font-black text-xs sm:text-sm uppercase tracking-wide text-emerald-900">
                      Corrigé Type Officiel & Exemples Concrets — {activeSection.title}
                    </h4>
                  </div>

                  {activeSection.correction.steps && (
                    <div className="space-y-1.5">
                      <strong className="block text-xs uppercase tracking-wider text-emerald-800 font-bold">
                        Démonstration & Étapes de Résolution :
                      </strong>
                      <div className="text-xs sm:text-sm font-sans leading-relaxed text-emerald-950 bg-white/80 p-3.5 rounded-lg border border-emerald-200 break-words">
                        <MathText text={activeSection.correction.steps} />
                      </div>
                    </div>
                  )}

                  {Array.isArray(activeSection.correction.examples) && activeSection.correction.examples.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <strong className="block text-xs uppercase tracking-wider text-emerald-800 font-bold">
                        Cas d'Usage Réels & Applications Pratiques (2 Exemples Concrets) :
                      </strong>
                      <div className="grid grid-cols-1 gap-2.5">
                        {activeSection.correction.examples.map((exText: string, exIdx: number) => (
                          <div
                            key={exIdx}
                            className="p-3.5 bg-white/90 border border-emerald-300/80 rounded-lg shadow-2xs text-xs sm:text-sm text-emerald-950 leading-relaxed font-sans"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                                {exIdx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <MathText text={exText} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================
              PIED DE PAGE OFFICIEL STYLE BACCALAURÉAT (1/N, 2/N, etc.)
              ======================================================== */}
          <footer className="border-t border-stone-300 pt-4 text-center">
            <span className="text-xs sm:text-sm font-serif font-bold text-stone-800 tracking-widest">
              {currentPage} / {totalPages}
            </span>
          </footer>
        </article>
      </div>

      {/* ========================================================
          ZONE HORS-PAGE EN BAS DE LA DERNIÈRE PAGE
          Bouton "Soumettre le sujet à la correction"
          ======================================================== */}
      {currentPage === totalPages && (
        <div
          id="exam-bottom-actions"
          className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 flex flex-col items-center justify-center gap-3 text-center"
        >
          {!isSubmitted ? (
            <>
              <button
                id="btn-submit-exam-paper"
                type="button"
                disabled={isGrading}
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white font-bold text-sm sm:text-base shadow-lg cursor-pointer transition-all"
              >
                {isGrading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Correction par l'IA en cours...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Soumettre le sujet à la correction</span>
                  </>
                )}
              </button>

              <span className="text-xs text-stone-500 font-sans">
                Temps restant : <strong>{formatTime(secondsLeft)}</strong> • Vérifiez l'ensemble de vos {totalPages} parties avant de déposer.
              </span>
            </>
          ) : (
            <div className="text-center space-y-3">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full">
                <Check className="w-4 h-4" />
                Copie d'examen déposée, notée par l'IA et enregistrée avec succès.
              </span>

              {finalScore >= 16 && (
                <div>
                  <button
                    id="btn-bottom-view-certificate"
                    onClick={() => setShowCertificateModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm shadow-lg transition-all cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>Consulter votre Certificat d'Excellence</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODALE DE CONFIRMATION AVANT L'HEURE (Annuler / Soumettre)
          ======================================================== */}
      {showConfirmModal && (
        <div
          id="confirm-submit-modal"
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Déposer définitivement la feuille ?
                </h3>
                <span className="text-xs text-stone-500">
                  Temps restant : {formatTime(secondsLeft)}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Il vous reste encore <strong>{formatTime(secondsLeft)}</strong> avant la fin de l'épreuve.
              Voulez-vous vraiment déposer dès maintenant votre feuille d'examen pour la correction par l'IA ?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-cancel-modal"
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                id="btn-confirm-modal"
                type="button"
                onClick={handleConfirmSubmit}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                Soumettre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          INDICATEUR DE CHARGEMENT DE LA CORRECTION PAR L'IA
          ======================================================== */}
      {isGrading && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 font-serif">
                Correction par l'IA en cours...
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Le jury évalue vos réponses rédigées, vérifie la rigueur conceptuelle et calcule votre note sur 20 points.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VUE DU CERTIFICAT D'EXCELLENCE ACADÉMIQUE
          ======================================================== */}
      {showCertificateModal && effectiveCert && (
        <CertificatExcellence
          certificate={effectiveCert}
          onClose={() => setShowCertificateModal(false)}
        />
      )}
    </div>
  );
}
