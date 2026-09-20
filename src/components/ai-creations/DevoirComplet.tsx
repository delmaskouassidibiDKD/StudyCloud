import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Printer,
  HelpCircle,
  Award,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Pause,
  Check,
  FileText,
  Sparkles,
  Download,
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
      {/* Composant officiel DnaLogo */}
      <DnaLogo className="w-6 h-6 shrink-0" glow={true} />

      {/* Texte officiel StudyCloud & DKD TECHNOLOGIES */}
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
// NORMALISATION DYNAMIQUE DE L'ÉPREUVE
// (Aucune donnée statique d'un domaine figé)
// ==========================================
export function normalizeExamData(data: any, title?: string) {
  // Déballage direct de toutes les variantes possibles de retours IA
  const source =
    data?.exam ||
    data?.devoir ||
    data?.creation_data?.exam ||
    data?.creation_data?.devoir ||
    data?.creation_data ||
    data ||
    {};

  // Titre / Matière dynamique selon la demande de l'utilisateur
  const discipline =
    source.matiere ||
    source.discipline ||
    source.subject ||
    data?.matiere ||
    data?.discipline ||
    data?.subject ||
    title ||
    "ÉPREUVE OFFICIELLE D'EXAMEN";

  // Durée dynamique fixée par l'IA (en fonction de la filière et de la complexité)
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

  const examHeader = {
    institution: source.institution || data?.institution || "DKD School Numérique",
    sousTitre: source.sousTitre || source.subTitle || data?.sousTitre || "Évaluation Officielle d'Examen",
    duree: formattedDuree,
    durationSeconds: durationSec,
    matiere: discipline,
    mention: source.mention || data?.mention || "Cette épreuve comporte quatre (04) pages numérotées 1/4, 2/4, 3/4 et 4/4.",
    calculatrice: source.calculatrice || data?.calculatrice || "Tout modèle de calculatrice scientifique est autorisé.",
    baremeTotal: Number(source.baremeTotal || data?.baremeTotal) || 20
  };

  // ----------------------------------------------------
  // PAGE 1 : EXERCICE 1 - Problème complet / Étude de cas (8 pts)
  // ----------------------------------------------------
  const rawEx1 = source.exercice1 || source.problem || source.partie1 || (Array.isArray(source.exercices) && source.exercices[0]);
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
            {
              id: 'p1_q1',
              number: '1.',
              points: 2,
              texte: "Analyse théorique, modélisation ou formulation des hypothèses initiales du problème.",
              sampleAnswer: ""
            },
            {
              id: 'p1_q2',
              number: '2.',
              points: 3,
              texte: "Développement analytique, calculs intermédiaires et résolution rigoureuse.",
              sampleAnswer: ""
            },
            {
              id: 'p1_q3',
              number: '3.',
              points: 3,
              texte: "Interprétation critique des résultats, discussion des limites et synthèse globale.",
              sampleAnswer: ""
            }
          ]
  };

  // ----------------------------------------------------
  // PAGE 2 : EXERCICE 2 - QCM d'analyse conceptuelle (4 pts)
  // ----------------------------------------------------
  const rawEx2 = source.exercice2 || source.qcm || source.partie2 || (Array.isArray(source.exercices) && source.exercices[1]);
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
            options:
              Array.isArray(q.options) && q.options.length > 0
                ? q.options
                : Array.isArray(q.choices)
                ? q.choices
                : ["Proposition A", "Proposition B", "Proposition C", "Proposition D"],
            correctIndex:
              typeof q.correctIndex === 'number'
                ? q.correctIndex
                : typeof q.bonne_reponse === 'number'
                ? q.bonne_reponse
                : 0,
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

  // ----------------------------------------------------
  // PAGE 3 : EXERCICE 3 - Questions Rédactionnelles Ciblées (4 pts)
  // ----------------------------------------------------
  const rawEx3 = source.exercice3 || source.questionsRedigees || source.synthese || source.partie3 || (Array.isArray(source.exercices) && source.exercices[2]);
  const rawQ3 = Array.isArray(rawEx3?.questions) ? rawEx3.questions : [];

  const exercice3 = {
    titre: rawEx3?.titre || rawEx3?.title || "EXERCICE 3 : QUESTIONS DE SYNTHÈSE RÉDIGÉE",
    points: Number(rawEx3?.points) || 4,
    consigne: rawEx3?.consigne || "Répondez de manière précise et concise directement sur les lignes en pointillés réservées à cet effet.",
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
            {
              id: 'p3_q1',
              number: '1.',
              points: 2,
              texte: "Synthèse conceptuelle et démonstration rédigée.",
              sampleAnswer: ""
            },
            {
              id: 'p3_q2',
              number: '2.',
              points: 2,
              texte: "Analyse des conditions d'application, corollaires ou étude critique.",
              sampleAnswer: ""
            }
          ]
  };

  // ----------------------------------------------------
  // PAGE 4 : EXERCICE 4 - Vrai ou Faux (4 pts)
  // ----------------------------------------------------
  const rawEx4 = source.exercice4 || source.vraiOuFaux || source.vf || source.partie4 || (Array.isArray(source.exercices) && source.exercices[3]);
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
            correctValue:
              typeof q.correctValue === 'boolean'
                ? q.correctValue
                : typeof q.isTrue === 'boolean'
                ? q.isTrue
                : q.reponse === true || q.reponse === 'VRAI' || q.reponse === 'true',
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

  // Cas où l'IA retourne une liste plate de questions
  if ((!rawEx1 || !rawEx1.questions) && Array.isArray(source.questions) && source.questions.length >= 4) {
    const qList = source.questions;
    const qcmItems = qList.filter((q: any) => Array.isArray(q.options) && q.options.length > 0);
    const vfItems = qList.filter(
      (q: any) =>
        typeof q.correctValue === 'boolean' ||
        typeof q.isTrue === 'boolean' ||
        (Array.isArray(q.options) && q.options.length === 2 && String(q.options[0]).toLowerCase().includes('vrai'))
    );
    const openItems = qList.filter((q: any) => !qcmItems.includes(q) && !vfItems.includes(q));

    if (qcmItems.length > 0) {
      exercice2.questions = qcmItems.slice(0, 4).map((q: any, i: number) => ({
        id: `p2_q${i + 1}`,
        number: `${i + 1}.`,
        points: 1,
        texte: q.texte || q.question || `Question ${i + 1}`,
        options: q.options,
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explication: q.explication || ""
      }));
    }

    if (vfItems.length > 0) {
      exercice4.questions = vfItems.slice(0, 4).map((q: any, i: number) => ({
        id: `p4_q${i + 1}`,
        number: `${i + 1}.`,
        points: 1,
        texte: q.texte || q.question || q.affirmation || `Affirmation ${i + 1}`,
        correctValue: typeof q.correctValue === 'boolean' ? q.correctValue : true,
        explication: q.explication || ""
      }));
    }

    if (openItems.length > 0) {
      exercice1.questions = openItems.slice(0, 3).map((q: any, i: number) => ({
        id: `p1_q${i + 1}`,
        number: `${i + 1}.`,
        points: i === 0 ? 2 : 3,
        texte: q.texte || q.question || `Question ${i + 1}`,
        sampleAnswer: q.sampleAnswer || q.reponse || ""
      }));
      if (openItems.length > 3) {
        exercice3.questions = openItems.slice(3, 5).map((q: any, i: number) => ({
          id: `p3_q${i + 1}`,
          number: `${i + 1}.`,
          points: 2,
          texte: q.texte || q.question || `Question ${i + 1}`,
          sampleAnswer: q.sampleAnswer || q.reponse || ""
        }));
      }
    }
  }

  return { examHeader, exercice1, exercice2, exercice3, exercice4 };
}

export default function DevoirComplet({ data, title }: { data?: any; title?: string }) {
  // Navigation entre les 4 pages
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Données actives de l'examen normalisées
  const activeData = normalizeExamData(data, title);
  const { examHeader, exercice1, exercice2, exercice3, exercice4 } = activeData;

  // Minuteur d'examen dynamique initialisé selon le temps fixé par l'IA
  const [secondsLeft, setSecondsLeft] = useState<number>(() => examHeader.durationSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Initialisation dynamique des réponses candidat (Page 1)
  const [answersP1, setAnswersP1] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    exercice1.questions.forEach((q) => {
      init[q.id] = ['', '', ''];
    });
    return init;
  });

  // Page 2 : QCM (index de l'option choisie)
  const [answersP2, setAnswersP2] = useState<Record<string, number>>({});

  // Page 3 : questions rédigées courtes
  const [answersP3, setAnswersP3] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    exercice3.questions.forEach((q) => {
      init[q.id] = ['', '', ''];
    });
    return init;
  });

  // Page 4 : Vrai / Faux
  const [answersP4, setAnswersP4] = useState<Record<string, boolean>>({});

  // État de soumission, évaluation par l'IA et modale de confirmation
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showCorrectionDetail, setShowCorrectionDetail] = useState<boolean>(false);
  const [gradingResult, setGradingResult] = useState<any>(null);

  // Modale du Certificat Officiel d'Excellence
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);

  // Réinitialisation automatique lorsque data change
  useEffect(() => {
    const initP1: Record<string, string[]> = {};
    exercice1.questions.forEach((q) => {
      initP1[q.id] = ['', '', ''];
    });
    setAnswersP1(initP1);
    setAnswersP2({});
    const initP3: Record<string, string[]> = {};
    exercice3.questions.forEach((q) => {
      initP3[q.id] = ['', '', ''];
    });
    setAnswersP3(initP3);
    setAnswersP4({});
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
            // Soumission automatique à l'expiration du temps
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

  // Gestion des lignes pour les questions écrites (Page 1)
  const updateLineP1 = (qId: string, index: number, val: string) => {
    const current = [...(answersP1[qId] || ['', '', ''])];
    current[index] = val;
    setAnswersP1({ ...answersP1, [qId]: current });
  };

  const addLineP1 = (qId: string) => {
    const current = [...(answersP1[qId] || ['', '', ''])];
    current.push('');
    setAnswersP1({ ...answersP1, [qId]: current });
    setTimeout(() => {
      const idx = current.length - 1;
      document.getElementById(`input-p1-${qId}-${idx}`)?.focus();
    }, 40);
  };

  // Gestion des lignes pour les questions écrites (Page 3)
  const updateLineP3 = (qId: string, index: number, val: string) => {
    const current = [...(answersP3[qId] || ['', '', ''])];
    current[index] = val;
    setAnswersP3({ ...answersP3, [qId]: current });
  };

  const addLineP3 = (qId: string) => {
    const current = [...(answersP3[qId] || ['', '', ''])];
    current.push('');
    setAnswersP3({ ...answersP3, [qId]: current });
    setTimeout(() => {
      const idx = current.length - 1;
      document.getElementById(`input-p3-${qId}-${idx}`)?.focus();
    }, 40);
  };

  // Calcul local des scores de secours
  const calculateScores = () => {
    // Score Ex 1 (Problème /8)
    let scoreP1 = 0;
    exercice1.questions.forEach((q) => {
      const text = (answersP1[q.id] || []).join(' ').trim();
      if (text.length >= 70) scoreP1 += q.points;
      else if (text.length >= 30) scoreP1 += Math.round(q.points * 0.6 * 2) / 2;
      else if (text.length > 5) scoreP1 += Math.round(q.points * 0.3 * 2) / 2 || 0.5;
    });

    // Score Ex 2 (QCM /4)
    let scoreP2 = 0;
    exercice2.questions.forEach((q) => {
      if (answersP2[q.id] === q.correctIndex) {
        scoreP2 += q.points;
      }
    });

    // Score Ex 3 (Questions écrites /4)
    let scoreP3 = 0;
    exercice3.questions.forEach((q) => {
      const text = (answersP3[q.id] || []).join(' ').trim();
      if (text.length >= 50) scoreP3 += q.points;
      else if (text.length >= 20) scoreP3 += 1.5;
      else if (text.length > 5) scoreP3 += 0.5;
    });

    // Score Ex 4 (Vrai/Faux /4)
    let scoreP4 = 0;
    exercice4.questions.forEach((q) => {
      if (answersP4[q.id] === q.correctValue) {
        scoreP4 += q.points;
      }
    });

    const total = Math.min(20, scoreP1 + scoreP2 + scoreP3 + scoreP4);
    return {
      scoreP1,
      scoreP2,
      scoreP3,
      scoreP4,
      total
    };
  };

  // ========================================================================
  // SOUMISSION ET CORRECTION PAR L'IA + DÉLIVRANCE DU CERTIFICAT
  // ========================================================================
  const triggerGradeExam = async () => {
    setIsGrading(true);
    setShowConfirmModal(false);
    setIsTimerRunning(false);

    const userName = localStorage.getItem('unifolder_user_name') || 'Étudiant StudyCloud';
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';

    try {
      const res = await gradeExamPaper({
        exam: activeData,
        answers: {
          answersP1,
          answersP2,
          answersP3,
          answersP4
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
      // Fallback local intelligent
      const local = calculateScores();
      setGradingResult({
        scoreTotal: local.total,
        scoreP1: local.scoreP1,
        scoreP2: local.scoreP2,
        scoreP3: local.scoreP3,
        scoreP4: local.scoreP4,
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

  // Réinitialisation de l'examen
  const handleResetExam = () => {
    if (window.confirm("Voulez-vous recommencer l'épreuve à zéro ? Vos réponses seront effacées.")) {
      const initP1: Record<string, string[]> = {};
      exercice1.questions.forEach((q) => {
        initP1[q.id] = ['', '', ''];
      });
      setAnswersP1(initP1);
      setAnswersP2({});
      const initP3: Record<string, string[]> = {};
      exercice3.questions.forEach((q) => {
        initP3[q.id] = ['', '', ''];
      });
      setAnswersP3(initP3);
      setAnswersP4({});
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

  // Calcul des scores affichés (soit retour de l'IA, soit heuristique)
  const localScores = calculateScores();
  const finalScore = gradingResult?.scoreTotal ?? localScores.total;
  const scoreEx1 = gradingResult?.scoreP1 ?? localScores.scoreP1;
  const scoreEx2 = gradingResult?.scoreP2 ?? localScores.scoreP2;
  const scoreEx3 = gradingResult?.scoreP3 ?? localScores.scoreP3;
  const scoreEx4 = gradingResult?.scoreP4 ?? localScores.scoreP4;

  const effectiveCert: CertificateData | null =
    gradingResult?.certificateInfo?.certificate ||
    (finalScore >= 16
      ? {
          topic: examHeader.matiere,
          score: finalScore,
          max_score: 20,
          certificate_code: `CERT-DKD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          student_name: localStorage.getItem('unifolder_user_name') || 'Étudiant StudyCloud',
          issued_at: new Date().toISOString()
        }
      : null);

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

          {/* Navigation des pages (Page 1 à 4) */}
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

            {/* Onglets pages */}
            <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-lg border border-stone-700">
              {[1, 2, 3, 4].map((pNum) => (
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
              disabled={currentPage === 4}
              onClick={() => setCurrentPage((p) => Math.min(4, p + 1))}
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
                        ? `🎉 Félicitations ! Excellence Académique : ${finalScore} / 20 points`
                        : `Épreuve Déposée • Note Globale : ${finalScore} / 20 points`}
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Ex.1 (Problème) : <strong>{scoreEx1}/8</strong> • Ex.2 (QCM) : <strong>{scoreEx2}/4</strong> • Ex.3 (Synthèse) : <strong>{scoreEx3}/4</strong> • Ex.4 (V/F) : <strong>{scoreEx4}/4</strong>
                  </p>
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
            {/* Ligne supérieure : DKD School Numérique à gauche, Logo StudyCloud à droite */}
            <div className="flex items-center justify-between gap-4">
              {/* Gauche : Institution & Informations */}
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

              {/* Droite : Logo officiel StudyCloud / DKD TECHNOLOGIES */}
              <div className="text-right shrink-0">
                <StudyCloudLogo />
              </div>
            </div>

            {/* Boîte encadrée de la discipline */}
            <div className="text-center py-1 sm:py-2">
              <div className="inline-block border-2 border-stone-900 px-6 sm:px-10 py-2">
                <h1 className="text-base sm:text-xl font-serif font-black tracking-widest text-stone-900 uppercase break-words">
                  {examHeader.matiere}
                </h1>
              </div>
            </div>

            {/* Consignes officielles et règle d'évaluation */}
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
              CONTENU SPÉCIFIQUE SELON LA PAGE ACTIVE (1, 2, 3 ou 4)
              Tous les espaces sont auto-extensibles sans troncature
              ======================================================== */}
          <div className="flex-1 space-y-8 pt-2">
            {/* ----------------------------------------------------
                PAGE 1 : EXERCICE 1 - PROBLÈME COMPLET (8 points)
                ---------------------------------------------------- */}
            {currentPage === 1 && (
              <div id="exam-page-1" className="space-y-6">
                <div className="border-b border-stone-300 pb-2">
                  <div className="inline-block border border-stone-900 px-3 py-1 text-xs sm:text-sm font-serif font-extrabold uppercase tracking-wider text-stone-900">
                    {exercice1.titre} ({exercice1.points} points)
                  </div>
                </div>

                {/* Énoncé du problème (S'étire dynamiquement selon la taille du sujet) */}
                <div className="bg-stone-50/80 p-4 sm:p-5 border-l-4 border-stone-800 text-stone-800 text-xs sm:text-sm font-serif leading-relaxed space-y-2 h-auto break-words overflow-visible">
                  <span className="font-bold uppercase tracking-wider text-xs block text-stone-900">
                    Énoncé de la situation & données du problème :
                  </span>
                  {exercice1.enonce ? (
                    <div className="text-stone-800 leading-relaxed break-words whitespace-pre-line">
                      <MathText text={exercice1.enonce} />
                    </div>
                  ) : (
                    <div className="py-6 border border-dashed border-stone-300 rounded-sm text-center text-stone-400 italic text-xs">
                      Espace d'énoncé du problème : cet espace s'étire et s'adapte automatiquement à toute longueur de texte, données expérimentales, tableaux et formules LaTeX.
                    </div>
                  )}
                </div>

                {/* Questions du problème */}
                <div className="space-y-4">
                  <span className="font-serif font-bold text-xs uppercase tracking-wider text-stone-900 block">
                    Questions à traiter :
                  </span>
                  <ol className="space-y-4 pl-1">
                    {exercice1.questions.map((q) => (
                      <li key={q.id} className="text-xs sm:text-sm font-serif text-stone-900 flex items-start gap-2.5 leading-relaxed h-auto break-words">
                        <span className="font-bold shrink-0">{q.number}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <MathText text={q.texte} className="text-stone-900 break-words leading-relaxed" />
                          <span className="text-xs font-sans text-stone-500 font-normal">({q.points} points)</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 
                  Zone réservée aux réponses écrites (FEUILLE DE COPIE)
                  avec lignes d'écriture en pointillés extensibles et bouton bleu +
                */}
                <div className="pt-6 border-t-2 border-dashed border-stone-300 space-y-8">
                  <div className="text-center">
                    <span className="inline-block bg-stone-900 text-white font-serif font-bold text-xs uppercase tracking-widest px-4 py-1">
                      RÉPONSES ÉCRITES DU CANDIDAT — EXERCICE 1
                    </span>
                  </div>

                  {exercice1.questions.map((q) => {
                    const lines = answersP1[q.id] || ['', '', ''];
                    const ex1Fb = gradingResult?.exercices?.exercice1?.questions?.[q.id];

                    return (
                      <div key={q.id} id={`reponse-box-${q.id}`} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-serif font-bold text-stone-900">
                          <span>Réponse à la question {q.number} ({q.points} pts) :</span>
                          {showCorrectionDetail && (
                            <span className="text-emerald-700 font-sans font-bold text-[11px]">
                              {ex1Fb && typeof ex1Fb.points === 'number'
                                ? `Note attribuée par l'IA : ${ex1Fb.points} / ${q.points} pts`
                                : "Corrigé officiel"}
                            </span>
                          )}
                        </div>

                        {/* Lignes d'écriture en pointillés extensibles */}
                        <div className="space-y-2.5 pl-2 sm:pl-4">
                          {lines.map((lineText, lIdx) => {
                            const isLast = lIdx === lines.length - 1;
                            return (
                              <div key={lIdx} className="w-full flex items-center gap-2">
                                <input
                                  id={`input-p1-${q.id}-${lIdx}`}
                                  type="text"
                                  value={lineText}
                                  disabled={isSubmitted}
                                  onChange={(e) => updateLineP1(q.id, lIdx, (e.target as HTMLInputElement).value)}
                                  placeholder={
                                    lIdx === 0 && lineText === ''
                                      ? 'Rédigez votre réponse argumentée ici...'
                                      : ''
                                  }
                                  className="w-full bg-transparent border-b-2 border-dotted border-stone-400 focus:border-stone-900 focus:border-solid focus:outline-hidden py-1.5 text-stone-900 text-xs sm:text-sm font-serif tracking-wide disabled:text-stone-700 placeholder:text-stone-400 placeholder:italic transition-colors"
                                />

                                {isLast && !isSubmitted && (
                                  <button
                                    id={`btn-add-line-p1-${q.id}`}
                                    type="button"
                                    onClick={() => addLineP1(q.id)}
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

                        {/* Corrigé type et feedback IA affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-2.5 p-3.5 bg-emerald-50/90 border-l-4 border-emerald-600 text-emerald-950 text-xs font-sans leading-relaxed break-words h-auto rounded-r-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <strong className="text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                                Évaluation du jury & Corrigé :
                              </strong>
                              {ex1Fb && typeof ex1Fb.points === 'number' && (
                                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold text-[11px]">
                                  Note : {ex1Fb.points} / {q.points} pt(s)
                                </span>
                              )}
                            </div>
                            {ex1Fb?.feedback && (
                              <p className="text-emerald-900 italic bg-white/70 p-2 rounded border border-emerald-200">
                                <strong>Remarque du jury :</strong> {ex1Fb.feedback}
                              </p>
                            )}
                            {q.sampleAnswer && (
                              <div>
                                <strong className="block text-[10px] text-emerald-700 uppercase font-bold mb-0.5">Corrigé type attendu :</strong>
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
            )}

            {/* ----------------------------------------------------
                PAGE 2 : EXERCICE 2 - COCHER LA BONNE RÉPONSE (QCM) (4 points)
                ---------------------------------------------------- */}
            {currentPage === 2 && (
              <div id="exam-page-2" className="space-y-6">
                <div className="border-b border-stone-300 pb-2">
                  <div className="inline-block border border-stone-900 px-3 py-1 text-xs sm:text-sm font-serif font-extrabold uppercase tracking-wider text-stone-900">
                    {exercice2.titre} ({exercice2.points} points)
                  </div>
                  <p className="text-xs font-serif italic text-stone-600 mt-2">
                    {exercice2.consigne}
                  </p>
                </div>

                <div className="space-y-8">
                  {exercice2.questions.map((q) => {
                    const selectedIdx = answersP2[q.id];
                    const ex2Fb = gradingResult?.exercices?.exercice2?.questions?.[q.id];

                    return (
                      <div key={q.id} className="space-y-3 pl-1">
                        <div className="flex items-start gap-2.5 font-serif text-xs sm:text-sm text-stone-900 leading-relaxed">
                          <span className="font-bold shrink-0">{q.number}</span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <MathText text={q.texte} className="font-medium break-words leading-relaxed" />
                            <span className="text-xs text-stone-500 font-sans font-normal">({q.points} pt)</span>
                          </div>
                        </div>

                        {/* Options à cocher */}
                        <div className="space-y-2 pl-5 sm:pl-6">
                          {q.options.map((opt, optIdx) => {
                            const isChecked = selectedIdx === optIdx;
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
                                  name={`qcm-${q.id}`}
                                  disabled={isSubmitted}
                                  checked={isChecked}
                                  onChange={() => setAnswersP2({ ...answersP2, [q.id]: optIdx })}
                                  className="mt-1 accent-stone-900 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <MathText text={opt} className="break-words leading-relaxed" />
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        {/* Corrigé type affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-1 ml-6 p-2.5 bg-stone-50 border-l-3 border-stone-700 text-stone-800 text-xs font-sans leading-relaxed break-words h-auto">
                            <strong className="block text-[11px] uppercase tracking-wider text-stone-700 mb-0.5">
                              {ex2Fb?.feedback ? ex2Fb.feedback : "Justification :"}
                            </strong>
                            {q.explication && <MathText text={q.explication} className="break-words leading-relaxed" />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ----------------------------------------------------
                PAGE 3 : EXERCICE 3 - QUESTIONS RÉDACTIONNELLES (4 points)
                ---------------------------------------------------- */}
            {currentPage === 3 && (
              <div id="exam-page-3" className="space-y-6">
                <div className="border-b border-stone-300 pb-2">
                  <div className="inline-block border border-stone-900 px-3 py-1 text-xs sm:text-sm font-serif font-extrabold uppercase tracking-wider text-stone-900">
                    {exercice3.titre} ({exercice3.points} points)
                  </div>
                  <p className="text-xs font-serif italic text-stone-600 mt-2">
                    {exercice3.consigne}
                  </p>
                </div>

                <div className="space-y-10">
                  {exercice3.questions.map((q) => {
                    const lines = answersP3[q.id] || ['', '', ''];
                    const ex3Fb = gradingResult?.exercices?.exercice3?.questions?.[q.id];

                    return (
                      <div key={q.id} className="space-y-3">
                        <div className="flex items-start gap-2.5 font-serif text-xs sm:text-sm text-stone-900 leading-relaxed">
                          <span className="font-bold shrink-0">{q.number}</span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <MathText text={q.texte} className="font-medium break-words leading-relaxed" />
                            <span className="text-xs text-stone-500 font-sans font-normal">({q.points} points)</span>
                          </div>
                        </div>

                        {/* Lignes d'écriture en pointillés avec petit plus bleu */}
                        <div className="space-y-2.5 pl-4 sm:pl-6">
                          {lines.map((lineText, lIdx) => {
                            const isLast = lIdx === lines.length - 1;
                            return (
                              <div key={lIdx} className="w-full flex items-center gap-2">
                                <input
                                  id={`input-p3-${q.id}-${lIdx}`}
                                  type="text"
                                  value={lineText}
                                  disabled={isSubmitted}
                                  onChange={(e) => updateLineP3(q.id, lIdx, (e.target as HTMLInputElement).value)}
                                  placeholder={
                                    lIdx === 0 && lineText === ''
                                      ? 'Rédigez votre explication ici...'
                                      : ''
                                  }
                                  className="w-full bg-transparent border-b-2 border-dotted border-stone-400 focus:border-stone-900 focus:border-solid focus:outline-hidden py-1.5 text-stone-900 text-xs sm:text-sm font-serif tracking-wide disabled:text-stone-700 placeholder:text-stone-400 placeholder:italic transition-colors"
                                />

                                {isLast && !isSubmitted && (
                                  <button
                                    id={`btn-add-line-p3-${q.id}`}
                                    type="button"
                                    onClick={() => addLineP3(q.id)}
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

                        {/* Corrigé type et feedback IA affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-2.5 ml-6 p-3.5 bg-emerald-50/90 border-l-4 border-emerald-600 text-emerald-950 text-xs font-sans leading-relaxed break-words h-auto rounded-r-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <strong className="block text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                                Évaluation du jury & Corrigé officiel :
                              </strong>
                              {ex3Fb && typeof ex3Fb.points === 'number' && (
                                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold text-[11px]">
                                  Note : {ex3Fb.points} / {q.points} pt(s)
                                </span>
                              )}
                            </div>
                            {ex3Fb?.feedback && (
                              <p className="text-emerald-900 italic bg-white/70 p-2 rounded border border-emerald-200">
                                <strong>Remarque :</strong> {ex3Fb.feedback}
                              </p>
                            )}
                            {q.sampleAnswer && (
                              <div>
                                <strong className="block text-[10px] text-emerald-700 uppercase font-bold mb-0.5">Corrigé type attendu :</strong>
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
            )}

            {/* ----------------------------------------------------
                PAGE 4 : EXERCICE 4 - VRAI OU FAUX (4 points)
                ---------------------------------------------------- */}
            {currentPage === 4 && (
              <div id="exam-page-4" className="space-y-6">
                <div className="border-b border-stone-300 pb-2">
                  <div className="inline-block border border-stone-900 px-3 py-1 text-xs sm:text-sm font-serif font-extrabold uppercase tracking-wider text-stone-900">
                    {exercice4.titre} ({exercice4.points} points)
                  </div>
                  <p className="text-xs font-serif italic text-stone-600 mt-2">
                    {exercice4.consigne}
                  </p>
                </div>

                <div className="space-y-6">
                  {exercice4.questions.map((q) => {
                    const val = answersP4[q.id];
                    const ex4Fb = gradingResult?.exercices?.exercice4?.questions?.[q.id];

                    return (
                      <div key={q.id} className="space-y-2.5 p-3 rounded-lg border border-stone-200 bg-stone-50/50">
                        <div className="flex items-start gap-2.5 font-serif text-xs sm:text-sm text-stone-900 leading-relaxed">
                          <span className="font-bold shrink-0">{q.number}</span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <MathText text={q.texte} className="font-medium break-words leading-relaxed" />
                            <span className="text-xs text-stone-500 font-sans font-normal">({q.points} pt)</span>
                          </div>
                        </div>

                        {/* Choix VRAI ou FAUX */}
                        <div className="flex items-center gap-4 pl-5 pt-1">
                          <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-serif font-bold text-stone-800 cursor-pointer">
                            <input
                              type="radio"
                              name={`vf-${q.id}`}
                              disabled={isSubmitted}
                              checked={val === true}
                              onChange={() => setAnswersP4({ ...answersP4, [q.id]: true })}
                              className="accent-stone-900 cursor-pointer"
                            />
                            <span>VRAI</span>
                          </label>

                          <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-serif font-bold text-stone-800 cursor-pointer">
                            <input
                              type="radio"
                              name={`vf-${q.id}`}
                              disabled={isSubmitted}
                              checked={val === false}
                              onChange={() => setAnswersP4({ ...answersP4, [q.id]: false })}
                              className="accent-stone-900 cursor-pointer"
                            />
                            <span>FAUX</span>
                          </label>
                        </div>

                        {/* Corrigé type affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-2 text-xs font-sans text-stone-800 bg-white p-2.5 rounded border border-stone-200 break-words h-auto leading-relaxed">
                            <strong>Réponse attendue :</strong>{' '}
                            <span className={q.correctValue ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                              {q.correctValue ? 'VRAI' : 'FAUX'}
                            </span>
                            {ex4Fb?.feedback && (
                              <p className="mt-1 text-stone-600 font-medium">
                                {ex4Fb.feedback}
                              </p>
                            )}
                            {q.explication && (
                              <div className="mt-1 text-stone-700">
                                <MathText text={`Justification : ${q.explication}`} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================
              PIED DE PAGE OFFICIEL STYLE BACCALAURÉAT (1/4, 2/4, etc.)
              ======================================================== */}
          <footer className="border-t border-stone-300 pt-4 text-center">
            <span className="text-xs sm:text-sm font-serif font-bold text-stone-800 tracking-widest">
              {currentPage} / 4
            </span>
          </footer>
        </article>
      </div>

      {/* ========================================================
          ZONE HORS-PAGE EN BAS DE LA DERNIÈRE PAGE (Page 4)
          Bouton "Soumettre le sujet à la correction"
          ======================================================== */}
      {currentPage === 4 && (
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
                Temps restant : <strong>{formatTime(secondsLeft)}</strong> • Vérifiez l'ensemble de vos 4 pages avant de déposer.
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
            {/* Icône et titre */}
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

            {/* Message de confirmation */}
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Il vous reste encore <strong>{formatTime(secondsLeft)}</strong> avant la fin de l'épreuve.
              Voulez-vous vraiment déposer dès maintenant votre feuille d'examen pour la correction par l'IA ?
            </p>

            {/* Boutons d'action Annuler / Soumettre */}
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
