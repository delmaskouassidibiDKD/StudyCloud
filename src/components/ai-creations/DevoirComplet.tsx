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
  Download
} from 'lucide-react';

import { DnaLogo } from '../DnaLogo';

// ==========================================
// COMPOSANT LOGO STUDYCLOUD / DKD TECHNOLOGIES (Utilisant votre DnaLogo officiel)
// ==========================================
function StudyCloudLogo() {
  return (
    <div
      id="studycloud-logo"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0369A1] text-white shadow-xs border border-sky-800"
      title="StudyCloud - DKD TECHNOLOGIES"
    >
      {/* Votre composant officiel DnaLogo */}
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
// DONNÉES DE L'ÉPREUVE OFFICIELLE DKD
// ==========================================

const EXAM_HEADER = {
  institution: "DKD School Numérique",
  sousTitre: "Évaluation Officielle",
  duree: "Durée : 45 min",
  matiere: "SCIENCES COGNITIVES & STRATÉGIES D'APPRENTISSAGE",
  mention: "Cette épreuve comporte quatre (04) pages numérotées 1/4, 2/4, 3/4 et 4/4.",
  calculatrice: "Tout modèle de calculatrice scientifique est autorisé.",
  baremeTotal: 20
};

// PAGE 1: EXERCICE 1 - Problème complet
const EXERCICE_1_PROBLEM = {
  titre: "EXERCICE 1 : PROBLÈME D'INGÉNIERIE COGNITIVE & ÉTUDE DE CAS",
  points: 8,
  enonce: `Contexte clinique et pédagogique :
Julien, élève en classe terminale, prépare son examen sélectif dans 3 semaines. Son rythme actuel consiste à relire ses manuels de cours 6 heures par jour en surlignant abondamment les définitions et en recopiant mécaniquement des pages entières sans jamais tester sa mémoire. 

Après 80 heures cumulées de révision intensive, Julien a obtenu la note de 06/20 au premier devoir blanc. Épuisé, il souffre d'un sentiment d'injustice (« pourtant j'ai passé des nuits entières sur mon cours ») et envisage de doubler son temps de relecture nocturne pour rattraper son retard.`,
  questions: [
    {
      id: 'p1_q1',
      number: '1.',
      points: 2,
      texte: "Diagnostiquez les deux failles méthodologiques majeures de Julien en mobilisant les concepts de « reconnaissance passive » et « d'illusion de compétence ».",
      sampleAnswer: "Julien confond la reconnaissance passive (l'information lui semble familière car elle est sous ses yeux) avec l'assimilation réelle. Le surlignage et la relecture créent une illusion de compétence temporaire : le cerveau ne fait aucun effort d'extraction synaptique, ce qui empêche tout ancrage en mémoire à long terme."
    },
    {
      id: 'p1_q2',
      number: '2.',
      points: 3,
      texte: "Concevez pour Julien un calendrier stratégique de réactivation sur 21 jours fondé sur la « répétition espacée » (courbe d'Ebbinghaus). Précisez les jalons clés (J+1, J+3, J+7, J+15) et la nature de chaque séance.",
      sampleAnswer: "Protocole recommandé sur 21 jours : J0 = Synthèse active et création de flashcards ; J+1 = Première séance de rappel actif sans notes (correction immédiate des lacunes) ; J+3 = Deuxième restitution ciblée sur les cartes difficiles ; J+7 = Mise en application sur exercices types d'examen ; J+15 = Épreuve blanche chronométrée complète pour valider l'autonomie mnésique."
    },
    {
      id: 'p1_q3',
      number: '3.',
      points: 3,
      texte: "Proposez un protocole d'application concrète de la méthode de vulgarisation selon Feynman afin que Julien valide sa compréhension d'un théorème complexe.",
      sampleAnswer: "Julien doit : 1. Choisir le concept clé ; 2. L'expliquer par écrit ou à voix haute comme s'il s'adressait à un collégien de 12 ans, en proscrivant tout jargon technique ; 3. Repérer immédiatement les hésitations et blocages conceptuels ; 4. Retourner à la source pour combler précisément ces zones d'ombre avec des analogies de la vie quotidienne."
    }
  ]
};

// PAGE 2: EXERCICE 2 - QCM
const EXERCICE_2_QCM = {
  titre: "EXERCICE 2 : QUESTIONS À CHOIX MULTIPLES",
  points: 4,
  consigne: "Pour chaque question, cochez la seule proposition exacte parmi les quatre choix proposés.",
  questions: [
    {
      id: 'p2_q1',
      number: '1.',
      points: 1,
      texte: "D'après la théorie du double codage d'Allan Paivio, pourquoi l'association d'une infographie à un texte renforce-t-elle la rétention ?",
      options: [
        "Elle oblige l'élève à dessiner chaque jour",
        "Elle crée deux voies d'accès indépendantes (canal verbal et canal visuel) vers le même souvenir",
        "Elle remplace totalement le besoin de lire des explications textuelles",
        "Elle empêche la fatigue des muscles oculaires pendant la lecture"
      ],
      correctIndex: 1,
      explication: "Le cerveau traite séparément les flux verbaux et visuels ; les combiner double les chances d'extraction du souvenir."
    },
    {
      id: 'p2_q2',
      number: '2.',
      points: 1,
      texte: "Quelle phase physiologique du sommeil assure le transfert des données de l'hippocampe vers le néocortex ?",
      options: [
        "La phase d'endormissement léger",
        "Le sommeil lent profond et le sommeil paradoxal",
        "L'état de somnolence post-prandiale",
        "Aucune : la consolidation s'effectue uniquement pendant l'éveil actif"
      ],
      correctIndex: 1,
      explication: "Durant le sommeil profond et paradoxal, les ondes cérébrales lentes orchestrent le transfert des traces mnésiques vers le cortex."
    },
    {
      id: 'p2_q3',
      number: '3.',
      points: 1,
      texte: "Qu'est-ce que le principe d'entrelacement thématique (interleaving) ?",
      options: [
        "Travailler une seule formule mathématique pendant 8 heures d'affilée",
        "Alterner des types de problèmes distincts au sein d'une même session pour forcer le diagnostic cognitif",
        "Réviser deux cours différents en même temps en écoutant de la musique",
        "Alterner 5 minutes d'étude avec 55 minutes de divertissement"
      ],
      correctIndex: 1,
      explication: "L'entrelacement empêche l'application machinale d'un patron unique et développe la capacité à discriminer le bon outil."
    },
    {
      id: 'p2_q4',
      number: '4.',
      points: 1,
      texte: "D'après les travaux d'Hermann Ebbinghaus, à quel moment la déperdition d'information est-elle la plus critique si aucune révision n'a lieu ?",
      options: [
        "Après 6 mois d'inactivité",
        "Dans les premières 24 à 48 heures suivant l'apprentissage initial",
        "Uniquement après la fin de l'année scolaire",
        "La mémoire ne perd aucune donnée sans lésion cérébrale"
      ],
      correctIndex: 1,
      explication: "Plus de la moitié des détails appris s'effacent dès le premier jour en l'absence de réactivation active à J+1."
    }
  ]
};

// PAGE 3: EXERCICE 3 - Questions Rédactionnelles Ciblées
const EXERCICE_3_QUESTIONS = {
  titre: "EXERCICE 3 : QUESTIONS DE SYNTHÈSE RÉDIGÉE",
  points: 4,
  consigne: "Répondez de manière précise et concise directement sur les lignes en pointillés réservées à cet effet.",
  questions: [
    {
      id: 'p3_q1',
      number: '1.',
      points: 2,
      texte: "Expliquez en quoi la « méthode de la feuille blanche » (refermer son cours et restituer tout ce dont on se souvient sans aide) surpasse qualitativement le simple surlignage.",
      sampleAnswer: "La feuille blanche exige un rappel libre absolu : le cerveau doit reconstituer l'arborescence des connaissances à partir de zéro, ce qui active la plasticité synaptique et identifie immédiatement les lacunes réelles, tandis que le surlignage n'est qu'un repérage visuel passif sans effort cognitif."
    },
    {
      id: 'p3_q2',
      number: '2.',
      points: 2,
      texte: "Pourquoi l'obtention d'un feedback immédiat (confrontation avec le corrigé juste après l'effort de restitution) est-elle capitale pour la consolidation neuronale ?",
      sampleAnswer: "Le feedback immédiat prévient l'ancrage durable d'erreurs ou de raisonnements faux dans les réseaux de neurones. Il permet au cerveau de corriger instantanément la trace mnésique pendant que les connexions synaptiques liées au problème sont encore actives et malléables."
    }
  ]
};

// PAGE 4: EXERCICE 4 - Vrai ou Faux
const EXERCICE_4_VF = {
  titre: "EXERCICE 4 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX",
  points: 4,
  consigne: "Pour chaque affirmation ci-dessous, cochez VRAI ou FAUX.",
  questions: [
    {
      id: 'p4_q1',
      number: '1.',
      points: 1,
      texte: "Relire un cours 10 fois d'affilée en une journée garantit un ancrage mnésique supérieur à trois sessions de rappel actif de 20 minutes espacées sur une semaine.",
      correctValue: false,
      explication: "Faux : La répétition massive en bloc engendre une saturation rapide et s'évapore rapidement, alors que l'espacement consolide durablement."
    },
    {
      id: 'p4_q2',
      number: '2.',
      points: 1,
      texte: "L'effort cognitif fourni lors de l'extraction d'une information sans aide externe renforce directement la solidité des voies synaptiques.",
      correctValue: true,
      explication: "Vrai : C'est le principe fondamental du rappel actif (« testing effect »)."
    },
    {
      id: 'p4_q3',
      number: '3.',
      points: 1,
      texte: "La sensation de fluidité ressentie en relisant un cours surligné est un indicateur fiable de réussite à un examen sans notes.",
      correctValue: false,
      explication: "Faux : C'est le piège typique de « l'illusion de compétence » causée par la présence continue des indices sous les yeux."
    },
    {
      id: 'p4_q4',
      number: '4.',
      points: 1,
      texte: "Le cerveau humain est biologiquement incapable d'intégrer de nouveaux schémas conceptuels profonds sans sommeil récupérateur régulier.",
      correctValue: true,
      explication: "Vrai : Le sommeil lent et paradoxal est le moment indispensable de réorganisation synaptique et d'intégration corticale."
    }
  ]
};

function normalizeExamData(data: any, title?: string) {
  if (!data || typeof data !== 'object') {
    return {
      examHeader: {
        ...EXAM_HEADER,
        matiere: title || EXAM_HEADER.matiere
      },
      exercice1: EXERCICE_1_PROBLEM,
      exercice2: EXERCICE_2_QCM,
      exercice3: EXERCICE_3_QUESTIONS,
      exercice4: EXERCICE_4_VF,
    };
  }

  // En-tête officiel
  const examHeader = {
    institution: data.institution || EXAM_HEADER.institution,
    sousTitre: data.sousTitre || data.subTitle || EXAM_HEADER.sousTitre,
    duree: data.duree || data.duration || EXAM_HEADER.duree,
    matiere: data.matiere || data.discipline || data.subject || title || EXAM_HEADER.matiere,
    mention: data.mention || EXAM_HEADER.mention,
    calculatrice: data.calculatrice || EXAM_HEADER.calculatrice,
    baremeTotal: 20
  };

  // Exercice 1 (Problème / Étude de cas)
  const rawEx1 = data.exercice1 || data.problem || data.partie1 || (Array.isArray(data.exercices) && data.exercices[0]);
  let exercice1 = EXERCICE_1_PROBLEM;
  if (rawEx1 && typeof rawEx1 === 'object') {
    const rawQuestions = Array.isArray(rawEx1.questions) ? rawEx1.questions : [];
    exercice1 = {
      titre: rawEx1.titre || rawEx1.title || "EXERCICE 1 : ÉTUDE DE CAS & PROBLÈME D'ANALYSE",
      points: Number(rawEx1.points) || 8,
      enonce: rawEx1.enonce || rawEx1.context || rawEx1.contexte || EXERCICE_1_PROBLEM.enonce,
      questions: rawQuestions.length > 0 ? rawQuestions.map((q: any, i: number) => ({
        id: q.id || `p1_q${i + 1}`,
        number: q.number || `${i + 1}.`,
        points: Number(q.points) || (i === 0 ? 2 : 3),
        texte: q.texte || q.question || q.text || `Question ${i + 1}`,
        sampleAnswer: q.sampleAnswer || q.reponse || q.correction || q.answer || "Réponse détaillée attendue selon les principes vus en cours."
      })) : EXERCICE_1_PROBLEM.questions
    };
  }

  // Exercice 2 (QCM)
  const rawEx2 = data.exercice2 || data.qcm || data.partie2 || (Array.isArray(data.exercices) && data.exercices[1]);
  let exercice2 = EXERCICE_2_QCM;
  if (rawEx2 && typeof rawEx2 === 'object') {
    const rawQuestions = Array.isArray(rawEx2.questions) ? rawEx2.questions : [];
    exercice2 = {
      titre: rawEx2.titre || rawEx2.title || "EXERCICE 2 : QUESTIONS À CHOIX MULTIPLES",
      points: Number(rawEx2.points) || 4,
      consigne: rawEx2.consigne || "Pour chaque question, cochez la seule proposition exacte parmi les quatre choix proposés.",
      questions: rawQuestions.length > 0 ? rawQuestions.map((q: any, i: number) => ({
        id: q.id || `p2_q${i + 1}`,
        number: q.number || `${i + 1}.`,
        points: Number(q.points) || 1,
        texte: q.texte || q.question || q.text || `Question ${i + 1}`,
        options: Array.isArray(q.options) && q.options.length > 0 ? q.options : (Array.isArray(q.choices) ? q.choices : ["Option A", "Option B", "Option C", "Option D"]),
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : (typeof q.bonne_reponse === 'number' ? q.bonne_reponse : 0),
        explication: q.explication || q.explanation || q.justification || "Justification pédagogique selon le cours."
      })) : EXERCICE_2_QCM.questions
    };
  }

  // Exercice 3 (Questions rédigées)
  const rawEx3 = data.exercice3 || data.questionsRedigees || data.synthese || data.partie3 || (Array.isArray(data.exercices) && data.exercices[2]);
  let exercice3 = EXERCICE_3_QUESTIONS;
  if (rawEx3 && typeof rawEx3 === 'object') {
    const rawQuestions = Array.isArray(rawEx3.questions) ? rawEx3.questions : [];
    exercice3 = {
      titre: rawEx3.titre || rawEx3.title || "EXERCICE 3 : QUESTIONS DE SYNTHÈSE RÉDIGÉE",
      points: Number(rawEx3.points) || 4,
      consigne: rawEx3.consigne || "Répondez de manière précise et concise directement sur les lignes en pointillés réservées à cet effet.",
      questions: rawQuestions.length > 0 ? rawQuestions.map((q: any, i: number) => ({
        id: q.id || `p3_q${i + 1}`,
        number: q.number || `${i + 1}.`,
        points: Number(q.points) || 2,
        texte: q.texte || q.question || q.text || `Question ${i + 1}`,
        sampleAnswer: q.sampleAnswer || q.reponse || q.correction || "Explication argumentée et concrète."
      })) : EXERCICE_3_QUESTIONS.questions
    };
  }

  // Exercice 4 (Vrai / Faux)
  const rawEx4 = data.exercice4 || data.vraiOuFaux || data.vf || data.partie4 || (Array.isArray(data.exercices) && data.exercices[3]);
  let exercice4 = EXERCICE_4_VF;
  if (rawEx4 && typeof rawEx4 === 'object') {
    const rawQuestions = Array.isArray(rawEx4.questions) ? rawEx4.questions : [];
    exercice4 = {
      titre: rawEx4.titre || rawEx4.title || "EXERCICE 4 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX",
      points: Number(rawEx4.points) || 4,
      consigne: rawEx4.consigne || "Pour chaque affirmation ci-dessous, cochez VRAI ou FAUX.",
      questions: rawQuestions.length > 0 ? rawQuestions.map((q: any, i: number) => ({
        id: q.id || `p4_q${i + 1}`,
        number: q.number || `${i + 1}.`,
        points: Number(q.points) || 1,
        texte: q.texte || q.affirmation || q.question || `Affirmation ${i + 1}`,
        correctValue: typeof q.correctValue === 'boolean' ? q.correctValue : (typeof q.isTrue === 'boolean' ? q.isTrue : (q.reponse === true || q.reponse === 'VRAI' || q.reponse === 'true')),
        explication: q.explication || q.explanation || "Explication conceptuelle."
      })) : EXERCICE_4_VF.questions
    };
  }

  // Cas où l'IA retourne une liste plate de questions
  if (!rawEx1 && !rawEx2 && !rawEx3 && !rawEx4 && Array.isArray(data.questions) && data.questions.length >= 4) {
    const qList = data.questions;
    const qcmItems = qList.filter((q: any) => Array.isArray(q.options) && q.options.length > 0);
    const vfItems = qList.filter((q: any) => typeof q.correctValue === 'boolean' || typeof q.isTrue === 'boolean' || (Array.isArray(q.options) && q.options.length === 2 && String(q.options[0]).toLowerCase().includes('vrai')));
    const openItems = qList.filter((q: any) => !qcmItems.includes(q) && !vfItems.includes(q));

    if (qcmItems.length > 0) {
      exercice2 = {
        titre: "EXERCICE 2 : QUESTIONS À CHOIX MULTIPLES",
        points: 4,
        consigne: "Pour chaque question, cochez la seule proposition exacte parmi les choix proposés.",
        questions: qcmItems.slice(0, 4).map((q: any, i: number) => ({
          id: `p2_q${i + 1}`,
          number: `${i + 1}.`,
          points: 1,
          texte: q.texte || q.question || `Question ${i + 1}`,
          options: q.options,
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          explication: q.explication || "Explication basée sur le cours."
        }))
      };
    }

    if (vfItems.length > 0) {
      exercice4 = {
        titre: "EXERCICE 4 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX",
        points: 4,
        consigne: "Pour chaque affirmation ci-dessous, cochez VRAI ou FAUX.",
        questions: vfItems.slice(0, 4).map((q: any, i: number) => ({
          id: `p4_q${i + 1}`,
          number: `${i + 1}.`,
          points: 1,
          texte: q.texte || q.question || q.affirmation || `Affirmation ${i + 1}`,
          correctValue: typeof q.correctValue === 'boolean' ? q.correctValue : true,
          explication: q.explication || "Explication basée sur le cours."
        }))
      };
    }

    if (openItems.length > 0) {
      exercice1 = {
        titre: "EXERCICE 1 : ÉTUDE DE CAS & PROBLÈME D'APPLICATION",
        points: 8,
        enonce: data.enonce || data.context || "À partir des notions et théorèmes étudiés dans le cours, analysez la situation et traitez les questions suivantes :",
        questions: openItems.slice(0, 3).map((q: any, i: number) => ({
          id: `p1_q${i + 1}`,
          number: `${i + 1}.`,
          points: i === 0 ? 2 : 3,
          texte: q.texte || q.question || `Question ${i + 1}`,
          sampleAnswer: q.sampleAnswer || q.reponse || "Réponse attendue."
        }))
      };
      if (openItems.length > 3) {
        exercice3 = {
          titre: "EXERCICE 3 : QUESTIONS DE SYNTHÈSE RÉDIGÉE",
          points: 4,
          consigne: "Répondez de manière précise et synthétique directement sur votre copie.",
          questions: openItems.slice(3, 5).map((q: any, i: number) => ({
            id: `p3_q${i + 1}`,
            number: `${i + 1}.`,
            points: 2,
            texte: q.texte || q.question || `Question ${i + 1}`,
            sampleAnswer: q.sampleAnswer || q.reponse || "Réponse attendue."
          }))
        };
      }
    }
  }

  return { examHeader, exercice1, exercice2, exercice3, exercice4 };
}

export default function DevoirComplet({ data, title }: { data?: any; title?: string }) {
  // Navigation entre les 4 pages
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Minuteur d'examen (45 minutes)
  const [secondsLeft, setSecondsLeft] = useState<number>(45 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Données actives de l'examen normalisées
  const activeData = normalizeExamData(data, title);
  const { examHeader, exercice1, exercice2, exercice3, exercice4 } = activeData;

  // Initialisation dynamique des réponses
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

  // État de soumission et modale de confirmation
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showCorrectionDetail, setShowCorrectionDetail] = useState<boolean>(false);

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
    setSecondsLeft(45 * 60);
    setIsTimerRunning(true);
    setIsSubmitted(false);
    setShowCorrectionDetail(false);
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
            // Soumission automatique à la fin du temps
            setIsSubmitted(true);
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
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
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

  // Calcul des scores lors de la soumission
  const calculateScores = () => {
    // Score Ex 1 (Problème /8) : basé sur la présence de rédaction et concepts
    let scoreP1 = 0;
    exercice1.questions.forEach((q) => {
      const text = (answersP1[q.id] || []).join(' ').trim();
      if (text.length >= 60) scoreP1 += q.points;
      else if (text.length >= 25) scoreP1 += Math.round((q.points * 0.7) * 2) / 2;
      else if (text.length > 5) scoreP1 += 1;
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

    const total = scoreP1 + scoreP2 + scoreP3 + scoreP4;
    return {
      scoreP1,
      scoreP2,
      scoreP3,
      scoreP4,
      total
    };
  };

  const scores = calculateScores();

  // Soumission définitive
  const handleConfirmSubmit = () => {
    setIsSubmitted(true);
    setIsTimerRunning(false);
    setShowConfirmModal(false);
    setShowCorrectionDetail(true);
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
      setSecondsLeft(45 * 60);
      setIsTimerRunning(true);
      setIsSubmitted(false);
      setShowCorrectionDetail(false);
      setCurrentPage(1);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="module-devoir-complet" className="w-full min-h-screen bg-stone-200/70 pb-28">
      {/* 
        BARRE D'OUTILS FIXE (STICKY) STYLE EXAMEN / PDF
        Collée immédiatement en haut sans espace vide
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
        RÉSULTAT D'EXAMEN APRÈS SOUMISSION (Bannière officielle)
      */}
      {isSubmitted && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <div
            id="exam-result-banner"
            className="p-5 rounded-xl bg-white border border-stone-300 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold">
                <Award className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-stone-900">
                  Épreuve Déposée • Note Globale : {scores.total} / 20 points
                </h3>
                <p className="text-xs text-stone-600">
                  Ex.1 (Problème) : {scores.scoreP1}/8 • Ex.2 (QCM) : {scores.scoreP2}/4 • Ex.3 (Questions) : {scores.scoreP3}/4 • Ex.4 (V/F) : {scores.scoreP4}/4
                </p>
              </div>
            </div>

            <button
              id="btn-toggle-correction-view"
              onClick={() => setShowCorrectionDetail(!showCorrectionDetail)}
              className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              {showCorrectionDetail ? "Masquer le corrigé type" : "Consulter le corrigé type complet"}
            </button>
          </div>
        </div>
      )}

      {/* 
        FEUILLE D'EXAMEN OFFICIELLE STYLE BACCALAURÉAT (Directement sur le fond de page)
      */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <article
          id={`exam-sheet-page-${currentPage}`}
          className="bg-white border border-stone-300 rounded-sm shadow-md p-6 sm:p-10 md:p-12 space-y-8 min-h-[850px] flex flex-col justify-between"
        >
          {/* ========================================================
              EN-TÊTE OFFICIEL DKD SCHOOL NUMÉRIQUE & STUDYCLOUD
              ======================================================== */}
          <header className="border-b-2 border-stone-900 pb-5 space-y-4">
            {/* Ligne supérieure : DKD School Numérique à gauche, Logo StudyCloud à droite */}
            <div className="flex items-center justify-between gap-4">
              {/* Gauche : DKD School Numérique */}
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
                <h1 className="text-base sm:text-xl font-serif font-black tracking-widest text-stone-900 uppercase">
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
              ======================================================== */}
          <div className="flex-1 space-y-8 pt-2">
            {/* ----------------------------------------------------
                PAGE 1 : EXERCICE 1 - PROBLÈME COMPLET
                ---------------------------------------------------- */}
            {currentPage === 1 && (
              <div id="exam-page-1" className="space-y-6">
                <div className="border-b border-stone-300 pb-2">
                  <div className="inline-block border border-stone-900 px-3 py-1 text-xs sm:text-sm font-serif font-extrabold uppercase tracking-wider text-stone-900">
                    {exercice1.titre}
                  </div>
                </div>

                {/* Énoncé du problème */}
                <div className="bg-stone-50/80 p-4 border-l-3 border-stone-800 text-stone-800 text-xs sm:text-sm font-serif leading-relaxed space-y-2">
                  <span className="font-bold uppercase tracking-wider text-xs block text-stone-900">
                    Énoncé de la situation :
                  </span>
                  <p className="whitespace-pre-line text-stone-800">
                    {exercice1.enonce}
                  </p>
                </div>

                {/* Questions du problème */}
                <div className="space-y-4">
                  <span className="font-serif font-bold text-xs uppercase tracking-wider text-stone-900 block">
                    Questions à traiter :
                  </span>
                  <ol className="space-y-3 pl-2">
                    {exercice1.questions.map((q) => (
                      <li key={q.id} className="text-xs sm:text-sm font-serif text-stone-900 flex items-start gap-2">
                        <span className="font-bold">{q.number}</span>
                        <div className="flex-1">
                          <span>{q.texte}</span>
                          <span className="text-xs font-sans text-stone-500 ml-1">({q.points} points)</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 
                  Zone réservée aux réponses écrites (FEUILLE DE COPIE)
                  avec lignes d'écriture en pointillés et bouton bleu +
                */}
                <div className="pt-6 border-t-2 border-dashed border-stone-300 space-y-8">
                  <div className="text-center">
                    <span className="inline-block bg-stone-900 text-white font-serif font-bold text-xs uppercase tracking-widest px-4 py-1">
                      RÉPONSES ÉCRITES DU CANDIDAT — EXERCICE 1
                    </span>
                  </div>

                  {exercice1.questions.map((q) => {
                    const lines = answersP1[q.id] || ['', '', ''];

                    return (
                      <div key={q.id} id={`reponse-box-${q.id}`} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-serif font-bold text-stone-900">
                          <span>Réponse à la question {q.number} ({q.points} pts) :</span>
                          {showCorrectionDetail && (
                            <span className="text-emerald-700 font-sans font-bold text-[11px]">
                              Corrigé disponible ci-dessous
                            </span>
                          )}
                        </div>

                        {/* Lignes d'écriture en pointillés */}
                        <div className="space-y-2 pl-2 sm:pl-4">
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
                                  className="w-full bg-transparent border-b-2 border-dotted border-stone-400 focus:border-stone-900 focus:border-solid focus:outline-hidden py-1 text-stone-900 text-xs sm:text-sm font-serif tracking-wide disabled:text-stone-700 placeholder:text-stone-400 placeholder:italic"
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

                        {/* Corrigé type affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-2 p-3 bg-emerald-50 border-l-2 border-emerald-600 text-emerald-900 text-xs font-sans leading-relaxed">
                            <strong className="block text-[11px] uppercase tracking-wider text-emerald-800">
                              Éléments de correction attendus :
                            </strong>
                            {q.sampleAnswer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ----------------------------------------------------
                PAGE 2 : EXERCICE 2 - COCHER LA BONNE RÉPONSE (QCM)
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

                    return (
                      <div key={q.id} className="space-y-3 pl-1">
                        <div className="flex items-start gap-2 font-serif text-xs sm:text-sm text-stone-900">
                          <span className="font-bold">{q.number}</span>
                          <span className="font-medium">{q.texte}</span>
                          <span className="text-xs text-stone-500 font-sans">({q.points} pt)</span>
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
                                className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors text-xs sm:text-sm font-serif ${
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
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Corrigé type affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-1 ml-6 p-2 bg-stone-50 border-l-2 border-stone-700 text-stone-700 text-xs font-sans">
                            <strong>Justification :</strong> {q.explication}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ----------------------------------------------------
                PAGE 3 : EXERCICE 3 - QUESTIONS RÉDACTIONNELLES
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

                    return (
                      <div key={q.id} className="space-y-3">
                        <div className="flex items-start gap-2 font-serif text-xs sm:text-sm text-stone-900">
                          <span className="font-bold">{q.number}</span>
                          <span className="font-medium">{q.texte}</span>
                          <span className="text-xs text-stone-500 font-sans">({q.points} points)</span>
                        </div>

                        {/* Lignes d'écriture en pointillés avec petit plus bleu */}
                        <div className="space-y-2 pl-4 sm:pl-6">
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
                                  className="w-full bg-transparent border-b-2 border-dotted border-stone-400 focus:border-stone-900 focus:border-solid focus:outline-hidden py-1 text-stone-900 text-xs sm:text-sm font-serif tracking-wide disabled:text-stone-700 placeholder:text-stone-400 placeholder:italic"
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

                        {/* Corrigé type affiché après soumission */}
                        {showCorrectionDetail && (
                          <div className="mt-2 ml-6 p-3 bg-emerald-50 border-l-2 border-emerald-600 text-emerald-900 text-xs font-sans leading-relaxed">
                            <strong className="block text-[11px] uppercase tracking-wider text-emerald-800">
                              Corrigé type officiel :
                            </strong>
                            {q.sampleAnswer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ----------------------------------------------------
                PAGE 4 : EXERCICE 4 - VRAI OU FAUX
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

                    return (
                      <div key={q.id} className="space-y-2 p-3 rounded-lg border border-stone-200 bg-stone-50/50">
                        <div className="flex items-start gap-2 font-serif text-xs sm:text-sm text-stone-900">
                          <span className="font-bold">{q.number}</span>
                          <span className="font-medium flex-1">{q.texte}</span>
                          <span className="text-xs text-stone-500 font-sans">({q.points} pt)</span>
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
                          <div className="mt-2 text-xs font-sans text-stone-700 bg-white p-2 rounded border border-stone-200">
                            <strong>Réponse attendue :</strong>{' '}
                            <span className={q.correctValue ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                              {q.correctValue ? 'VRAI' : 'FAUX'}
                            </span>{' '}
                            — {q.explication}
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
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm sm:text-base shadow-lg cursor-pointer transition-all"
              >
                <Sparkles className="w-5 h-5" />
                <span>Soumettre le sujet à la correction</span>
              </button>

              <span className="text-xs text-stone-500 font-sans">
                Temps restant : <strong>{formatTime(secondsLeft)}</strong> • Vérifiez l'ensemble de vos 4 pages avant de déposer.
              </span>
            </>
          ) : (
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full">
                <Check className="w-4 h-4" />
                Copie d'examen déposée et corrigée avec succès.
              </span>
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
              Voulez-vous vraiment déposer dès maintenant votre feuille d'examen pour la correction ?
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
    </div>
  );
}
