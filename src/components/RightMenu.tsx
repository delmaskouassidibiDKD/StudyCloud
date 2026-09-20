import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize,
  Minimize,
  X,
  Clock,
  Plus,
  HelpCircle,
  ListChecks,
  CheckSquare,
  FileCheck2,
  Network,
  Workflow,
  Layers,
  FileText,
  FileDown,
  BarChart2,
  PenTool,
  ClipboardCheck,
  Sparkles,
  AlertCircle,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { StudyCloudAPI, generateDirectAiCreation } from '../services/api';
import { extractDocumentText } from '../services/documentTextExtractor';
import { parseOrBuildAiCreation } from '../services/aiCreationGenerator';
import { DnaLogo } from './DnaLogo';
import { AiCreation, ModuleId } from './ai-creations/types';
import Questionnaire from './ai-creations/Questionnaire';
import QuestionnaireTest from './ai-creations/QuestionnaireTest';
import VraiOuFaux from './ai-creations/VraiOuFaux';
import VraiOuFauxTest from './ai-creations/VraiOuFauxTest';
import CarteMentale from './ai-creations/CarteMentale';
import CarteMentaleConceptuelle from './ai-creations/CarteMentaleConceptuelle';
import CarteMemoire from './ai-creations/CarteMemoire';
import Resume from './ai-creations/Resume';
import Pdf from './ai-creations/Pdf';
import Infographie from './ai-creations/Infographie';
import ExercicesEcrits from './ai-creations/ExercicesEcrits';
import DevoirComplet, { normalizeExamData } from './ai-creations/DevoirComplet';

interface RightMenuProps {
  isRightFullscreen: boolean;
  setIsRightFullscreen: (v: boolean) => void;
  isCenterFullscreen: boolean;
  mobilePreviewTab: number;
  activePreviewItem?: any;
  isMobileScreen?: boolean;
}

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: 'evaluation' | 'concept' | 'memorisation' | 'redaction';
  badge: string;
  colorClass: string;
  borderColor: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'questionnaire',
    label: 'Questionnaire',
    icon: HelpCircle,
    description: 'QCM interactif d’évaluation active avec feedback immédiat.',
    category: 'evaluation',
    badge: 'QCM Interactif',
    colorClass: 'bg-emerald-950/40 text-emerald-200 border-emerald-700/50 hover:bg-emerald-900/50 hover:border-emerald-500',
    borderColor: '#059669',
  },
  {
    id: 'questionnaire-test',
    label: 'Questionnaire Test',
    icon: ListChecks,
    description: 'Mêmes cartes en mode évaluation : réponses complètes avant le score et la correction.',
    category: 'evaluation',
    badge: 'Test Noté',
    colorClass: 'bg-teal-950/40 text-teal-200 border-teal-700/50 hover:bg-teal-900/50 hover:border-teal-500',
    borderColor: '#0d9488',
  },
  {
    id: 'vrai-ou-faux',
    label: 'Vrai ou Faux',
    icon: CheckSquare,
    description: 'Affirmations ciblées pour tester les réflexes critiques.',
    category: 'evaluation',
    badge: 'Vrai / Faux',
    colorClass: 'bg-green-950/40 text-green-200 border-green-700/50 hover:bg-green-900/50 hover:border-green-500',
    borderColor: '#16a34a',
  },
  {
    id: 'vrai-ou-faux-test',
    label: 'Vrai ou Faux Test',
    icon: FileCheck2,
    description: 'Liste d’affirmations à cocher : score et correction révélés après validation.',
    category: 'evaluation',
    badge: 'Test V/F',
    colorClass: 'bg-lime-950/40 text-lime-200 border-lime-700/50 hover:bg-lime-900/50 hover:border-lime-500',
    borderColor: '#65a30d',
  },
  {
    id: 'carte-mentale',
    label: 'Carte Mentale',
    icon: Network,
    description: 'Arborescence dynamique et modélisation des concepts.',
    category: 'concept',
    badge: 'Arborescence',
    colorClass: 'bg-violet-950/40 text-violet-200 border-violet-700/50 hover:bg-violet-900/50 hover:border-violet-500',
    borderColor: '#7c3aed',
  },
  {
    id: 'carte-mentale-2',
    label: 'Carte Mentale 2',
    icon: Workflow,
    description: 'Carte conceptuelle en blocs hiérarchiques avec connecteurs orthogonaux et ombres graphiques.',
    category: 'concept',
    badge: 'Conceptuelle',
    colorClass: 'bg-indigo-950/40 text-indigo-200 border-indigo-700/50 hover:bg-indigo-900/50 hover:border-indigo-500',
    borderColor: '#4f46e5',
  },
  {
    id: 'carte-memoire',
    label: 'Carte Mémoire',
    icon: Layers,
    description: 'Flashcards de mémorisation avec répétition espacée.',
    category: 'memorisation',
    badge: 'Flashcards',
    colorClass: 'bg-rose-950/40 text-rose-200 border-rose-700/50 hover:bg-rose-900/50 hover:border-rose-500',
    borderColor: '#e11d48',
  },
  {
    id: 'resume',
    label: 'Résumé',
    icon: FileText,
    description: 'Fiche synthétique structurée avec surlignage didactique.',
    category: 'redaction',
    badge: 'Fiche Résumé',
    colorClass: 'bg-blue-950/40 text-blue-200 border-blue-700/50 hover:bg-blue-900/50 hover:border-blue-500',
    borderColor: '#2563eb',
  },
  {
    id: 'pdf',
    label: 'PDF',
    icon: FileDown,
    description: 'Document prêt pour l’export, l’impression et la relecture.',
    category: 'redaction',
    badge: 'Export PDF',
    colorClass: 'bg-red-950/40 text-red-200 border-red-700/50 hover:bg-red-900/50 hover:border-red-500',
    borderColor: '#dc2626',
  },
  {
    id: 'infographie',
    label: 'Infographie',
    icon: BarChart2,
    description: 'Représentation visuelle des étapes et métriques cognitives.',
    category: 'concept',
    badge: 'Infographie',
    colorClass: 'bg-cyan-950/40 text-cyan-200 border-cyan-700/50 hover:bg-cyan-900/50 hover:border-cyan-500',
    borderColor: '#0891b2',
  },
  {
    id: 'exercices-ecrits',
    label: 'Exercices Écrits',
    icon: PenTool,
    description: 'Problèmes rédigés avec correction et conseils méthodologiques.',
    category: 'evaluation',
    badge: 'Exercices',
    colorClass: 'bg-amber-950/40 text-amber-200 border-amber-700/50 hover:bg-amber-900/50 hover:border-amber-500',
    borderColor: '#d97706',
  },
  {
    id: 'devoir-complet',
    label: 'Devoir Complet',
    icon: ClipboardCheck,
    description: 'Épreuve complète chronométrée sur 20 points avec corrigé.',
    category: 'evaluation',
    badge: 'Devoir / 20',
    colorClass: 'bg-purple-950/40 text-purple-200 border-purple-700/50 hover:bg-purple-900/50 hover:border-purple-500',
    borderColor: '#9333ea',
  }
];

export const CATEGORY_TABS = [
  { id: 'all', label: 'Tous (12)' },
  { id: 'evaluation', label: 'Évaluation' },
  { id: 'concept', label: 'Concepts' },
  { id: 'memorisation', label: 'Mémorisation' },
  { id: 'redaction', label: 'Rédaction & PDF' },
];

export function RightMenu({ 
  isRightFullscreen, 
  setIsRightFullscreen, 
  isCenterFullscreen, 
  mobilePreviewTab,
  activePreviewItem,
  isMobileScreen
}: RightMenuProps) {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeCreation, setActiveCreation] = useState<AiCreation | null>(null);
  const [activeTabModule, setActiveTabModule] = useState<ModuleId>('questionnaire');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingInfo, setGeneratingInfo] = useState<{ type: string; title: string; subtitle?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [historyItems, setHistoryItems] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_ai_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Synchronisation descendante depuis Cloudflare D1 au chargement
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getAiContents(userId).then(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const fromD1 = res.data.map((item: any) => {
          const mod = MODULES.find(m => m.id === item.tool_type);
          return {
            id: item.id,
            toolType: item.tool_type,
            title: item.title,
            dateStr: item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : "Récemment",
            colorClass: mod ? mod.colorClass.split(' ').find((c: string) => c.startsWith('text-')) || 'text-orange-300' : 'text-orange-300',
            desc: item.source_file_name ? `Généré pour "${item.source_file_name}"` : 'Création IA',
            pinned: Boolean(item.is_pinned),
            contentJson: item.contentJson,
            sourceFileName: item.source_file_name,
          };
        });

        setHistoryItems((prev: any[]) => {
          const ids = new Set(fromD1.map((d: any) => d.id));
          const localOnly = prev.filter((p: any) => !ids.has(p.id) && !p.id.startsWith('h'));
          const merged = [...fromD1, ...localOnly];
          localStorage.setItem('unifolder_ai_history', JSON.stringify(merged));
          return merged;
        });
      }
    }).catch(() => {});
  }, []);

  // Écoute des événements de création IA venant du Chat / Assistant
  useEffect(() => {
    const handleStart = (e: any) => {
      const { toolType, title, sourceFileName } = e.detail || {};
      setIsGenerating(true);
      const mod = MODULES.find(m => m.id === toolType);
      setGeneratingInfo({
        type: toolType || 'contenu',
        title: title || (mod ? mod.label : 'Création IA'),
        subtitle: sourceFileName ? `Document support : "${sourceFileName}"` : 'Analyse et modélisation en cours',
      });
    };

    const handleReady = (e: any) => {
      const { creation } = e.detail || {};
      if (creation) {
        setActiveCreation(creation);
        const mappedId = (creation.toolType as ModuleId) || 'questionnaire';
        setActiveTabModule(mappedId);
        setIsGenerating(false);
        setGeneratingInfo(null);

        // Sauvegarder dans l'historique local et D1
        setHistoryItems((prev: any[]) => {
          const updated = [
            {
              id: creation.id,
              toolType: creation.toolType,
              title: creation.title,
              dateStr: "À l'instant",
              colorClass: 'text-orange-300',
              desc: `Généré pour "${creation.sourceFileName || 'Document'}"`,
              pinned: false,
              contentJson: creation.content,
              sourceFileName: creation.sourceFileName,
            },
            ...prev.filter(p => p.id !== creation.id)
          ];
          localStorage.setItem('unifolder_ai_history', JSON.stringify(updated));
          return updated;
        });

        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        StudyCloudAPI.saveAiContent({
          id: creation.id,
          userId,
          fileId: creation.fileId || null,
          toolType: creation.toolType,
          title: creation.title,
          contentJson: creation.content,
          sourceFileName: creation.sourceFileName || '',
          isPinned: false,
        }).catch(() => {});
      }
    };

    const handleUpdate = (e: any) => {
      const { updatedContent, title } = e.detail || {};
      if (updatedContent && activeCreation) {
        const updated: AiCreation = {
          ...activeCreation,
          title: title || activeCreation.title,
          content: updatedContent,
          updatedAt: new Date().toISOString(),
          version: (activeCreation.version || 1) + 1,
        };
        setActiveCreation(updated);
        setIsGenerating(false);

        // Mise à jour D1
        const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
        StudyCloudAPI.saveAiContent({
          id: updated.id,
          userId,
          fileId: updated.fileId || null,
          toolType: updated.toolType,
          title: updated.title,
          contentJson: updated.content,
          sourceFileName: updated.sourceFileName || '',
          isPinned: Boolean(updated.isPinned),
        }).catch(() => {});
      }
    };

    const handleError = () => {
      setIsGenerating(false);
      setGeneratingInfo(null);
    };

    const handleTrigger = (e: any) => {
      const type = e?.detail?.type || 'questionnaire';
      const mod = MODULES.find(m => m.id === type) || MODULES[0];
      handleProposalClick(mod);
    };

    window.addEventListener('ai-creation-start', handleStart as any);
    window.addEventListener('ai-creation-ready', handleReady as any);
    window.addEventListener('ai-creation-update', handleUpdate as any);
    window.addEventListener('ai-creation-error', handleError as any);
    window.addEventListener('trigger-creation-generate', handleTrigger as any);

    return () => {
      window.removeEventListener('ai-creation-start', handleStart as any);
      window.removeEventListener('ai-creation-ready', handleReady as any);
      window.removeEventListener('ai-creation-update', handleUpdate as any);
      window.removeEventListener('ai-creation-error', handleError as any);
      window.removeEventListener('trigger-creation-generate', handleTrigger as any);
    };
  }, [activeCreation]);

  const saveHistory = (items: any[]) => {
    setHistoryItems(items);
    localStorage.setItem('unifolder_ai_history', JSON.stringify(items));
  };

  const sortedHistory = [...historyItems].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const handleHistoryClick = (item: any) => {
    const targetType = (item.toolType as ModuleId) || 'questionnaire';
    setActiveTabModule(targetType);
    if (item.contentJson) {
      setActiveCreation({
        id: item.id,
        toolType: targetType,
        title: item.title,
        content: item.contentJson,
        sourceFileName: item.sourceFileName,
      });
    } else {
      setActiveCreation({
        id: item.id,
        toolType: targetType,
        title: item.title,
        content: null,
        sourceFileName: item.sourceFileName,
      });
    }
    setIsRightSidebarOpen(false);
  };

  // Génère un prompt rigoureusement typé pour le module avec schéma JSON strict
  const getModuleCreationPrompt = (modId: string, modLabel: string, docName: string) => {
    const base = `Tu es l'IA éducative d'excellence de StudyCloud (DKD Technologies). Ta mission est de concevoir un module "${modLabel}" complet, inédit, approfondi et directement basé sur l'INTÉGRALITÉ du document d'étude joint "${docName}".
CONSIGNES STRICTES ET INVIOLABLES :
1. ÉTUDE INTÉGRALE DU DOCUMENT : Parcours le document de la première à la dernière page. Ne t'arrête pas au début : puise dans tous les chapitres, sections, théorèmes, lois, calculs et schémas du fichier.
2. SUJETS SCIENTIFIQUES & TECHNIQUES (Électronique, Physique, Mathématiques, Chimie, Informatique, etc.) : INTERDICTION FORMELLE DE RESTER PUREMENT LITTÉRAIRE ! Intègre obligatoirement des calculs réels, des formules mathématiques exactes ($...$), des grandeurs numériques concrètes (ex: $R_1 = 10\\ \\text{k}\\Omega, R_2 = 100\\ \\text{k}\\Omega, V_e = 0.5\\ \\text{V} \\implies V_s = -5\\ \\text{V}$), des fonctions et des schémas de montages (en ASCII Art soigné).
3. CORRECTIONS DÉTAILLÉES : Chaque correction doit comporter un rappel théorique, la démonstration ou le calcul détaillé étape par étape, et obligatoirement DEUX EXEMPLES CONCRETS DISTINCTS (Exemple 1 et Exemple 2).
4. LATEX PUR & RÈGLE ABSOLUE DE SYNTAXE (ZÉRO CARACTÈRE BIZARRE) :
   - Entoure chaque formule de dollars ($V_s = -\\frac{R_2}{R_1} V_e$ en ligne, $$...$$ en bloc).
   - Ne mets JAMAIS de symboles $ isolés à l'intérieur d'une expression LaTeX (interdit d'écrire \\text{k}\\$\\Omega$ ou \\$\\Omega$).
   - Pour l'ohm, écris toujours \\Omega (ex: $10\\text{ k}\\Omega$ ou $R_2 = 120\\text{ k}\\Omega$).
   - Dans le JSON, double impérativement chaque antislash LaTeX (\\\\frac, \\\\sqrt, \\\\Omega, \\\\alpha, \\\\beta, etc.) pour éviter toute corruption Form Feed.
   - Ferme scrupuleusement chaque balise ou délimiteur ({}, $ ou $$) ouvert.
Génère STRICTEMENT un objet JSON valide conforme au schéma ci-dessous, sans texte parasite avant ou après.`;

    switch (modId) {
      case 'exercices-ecrits':
        return `${base}
CONSIGNE : Conçois un exercice écrit de haut niveau avec énoncé contextualisé, questions numérotées, et corrigé pas à pas avec deux exemples concrets distincts.
{
  "creation_type": "exercices-ecrits",
  "creation_title": "Exercices Écrits : ${docName}",
  "creation_data": {
    "title": "Exercice Pratique : ${docName}",
    "context": "Énoncé et données du problème (avec formules LaTeX $...$ et valeurs chiffrées)...",
    "questions": [
      "1. Première question détaillée avec calcul...",
      "2. Deuxième question d'application ou de dimensionnement...",
      "3. Troisième question d'interprétation..."
    ],
    "correction": {
      "steps": "Démonstration complète pas à pas, justifications théoriques et calculs intermédiaires...",
      "examples": [
        "Exemple 1 : Cas concret illustrant l'application de la notion",
        "Exemple 2 : Deuxième exemple pratique en situation réelle"
      ]
    }
  }
}`;

      case 'devoir-complet':
        return `${base}
CONSIGNE MAÎTRESSE D'EXAMEN & DIRECTIVE PÉDAGOGIQUE INVIOLABLE :
Tu es un professeur agrégé et concepteur officiel d'épreuves d'examen. Analyse le document '${docName}' pour concevoir une ÉPREUVE OFFICIELLE D'EXAMEN NOTÉE SUR 20 POINTS.
SI LE TEXTE EST COURT OU TECHNIQUE (ex: électronique, AOP, physique, mathématiques...), MOBILISE TES CONNAISSANCES ENCYCLOPÉDIQUES SUR CE DOMAINE POUR CRÉER UN SUJET COMPLET ET RÉALISTE AVEC VRAIES VALEURS NUMÉRIQUES, SCHÉMA DU CIRCUIT EN ASCII ET CALCULS EXACTS.

L'ÉPREUVE DOIT COMPORTER STRICTEMENT 3 EXERCICES (NI PLUS, NI MOINS) :
1. EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 points) :
   - Rédige OBLIGATOIREMENT un énoncé de mise en situation complet dans "problem_statement" AVANT les questions (avec contexte concret, valeurs chiffrées, formules en LaTeX $...$ et schéma ASCII du montage si applicable).
   - Suivi de 3 questions ouvertes ("type": "open") de démonstration et d'application numérique avec barème (3 pts, 3 pts, 2 pts).
2. EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 points) :
   - 4 questions précises d'application et de calcul ("type": "multiple_choice") notées 1,5 point chacune.
   - 4 propositions de réponses réelles, distinctes et argumentées par question.
   - INTERDICTION FORMELLE d'écrire "Proposition A", "Option A", "Choix A". Écris de vraies valeurs ou formules !
3. EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 points) :
   - 4 affirmations scientifiques et calculatoires ("type": "true_false") notées 1,5 point chacune.

INTERDICTION STRICTE : N'utilise JAMAIS de placeholders ("Proposition A", "Option A", "Question d'évaluation conceptuelle", "Affirmation conceptuelle"). Tout doit être rédigé avec rigueur et précision.

{
  "creation_type": "devoir-complet",
  "creation_title": "Épreuve Officielle d'Examen : ${docName}",
  "creation_data": {
    "title": "Épreuve Officielle d'Examen : ${docName}",
    "duree": "2h00",
    "duration_minutes": 120,
    "baremeTotal": 20,
    "instructions": "L'épreuve comporte exactement 3 exercices indépendants. Justifiez avec rigueur chaque étape de vos calculs.",
    "sections": [
      {
        "section_id": "sec_1",
        "title": "EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 POINTS)",
        "problem_statement": "On étudie le montage [description détaillée du circuit ou du problème, composants, valeurs $R_1 = 10\\ \\text{k}\\Omega, R_2 = 120\\ \\text{k}\\Omega, V_{cc} = \\pm 15\\ \\text{V}$, schéma de circuit ASCII]...",
        "questions": [
          { "id": "p1_q1", "number": "1.", "type": "open", "points": 3, "texte": "Établir l'expression analytique de la grandeur $V_s$ en fonction des grandeurs d'entrée.", "sampleAnswer": "Démonstration complète pas à pas avec formules en LaTeX..." },
          { "id": "p1_q2", "number": "2.", "type": "open", "points": 3, "texte": "Calculer la valeur numérique exacte pour la valeur nominale donnée.", "sampleAnswer": "Calcul méthodique détaillé et résultat avec son unité..." },
          { "id": "p1_q3", "number": "3.", "type": "open", "points": 2, "texte": "Déterminer la limite de saturation ou de stabilité du système.", "sampleAnswer": "Analyse physique des conditions aux limites..." }
        ],
        "correction": {
          "steps": "Corrigé analytique étape par étape de l'Exercice 1...",
          "examples": ["Exemple 1 : Cas concret d'application en laboratoire", "Exemple 2 : Dimensionnement pratique en situation réelle"]
        }
      },
      {
        "section_id": "sec_2",
        "title": "EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 POINTS)",
        "questions": [
          { "id": "p2_q1", "number": "1.", "type": "multiple_choice", "points": 1.5, "texte": "Quelle relation fondamentale caractérise le régime linéaire du montage ?", "options": ["$V^- = 0\\ \\text{V}$ (masse virtuelle)", "$V^- = V_e$", "$V^- = -14\\ \\text{V}$", "$V^- = V_s / 2$"], "correctIndex": 0, "explication": "Démonstration théorique de la bonne réponse..." },
          { "id": "p2_q2", "number": "2.", "type": "multiple_choice", "points": 1.5, "texte": "Pour les valeurs numériques données, quelle est la valeur calculée ?", "options": ["$A_v = -12$", "$A_v = +12$", "$A_v = -0,083$", "$A_v = +13$"], "correctIndex": 0, "explication": "Calcul méthodique de la grandeur..." },
          { "id": "p2_q3", "number": "3.", "type": "multiple_choice", "points": 1.5, "texte": "Quelle est l'impédance d'entrée caractéristique du montage ?", "options": ["$R_{in} = 10\\ \\text{k}\\Omega$", "$R_{in} = 130\\ \\text{k}\\Omega$", "$R_{in} \\to \\infty$", "$R_{in} = 0\\ \\Omega$"], "correctIndex": 0, "explication": "Justification théorique..." },
          { "id": "p2_q4", "number": "4.", "type": "multiple_choice", "points": 1.5, "texte": "Si le paramètre de boucle est modifié, quelle est la conséquence mesurée ?", "options": ["Le montage sature à $-14\\ \\text{V}$", "Le montage reste à $-16\\ \\text{V}$", "La sortie s'annule", "La phase reste à $0^\\circ$"], "correctIndex": 0, "explication": "Analyse de la condition limite..." }
        ],
        "correction": {
          "steps": "Justification analytique de chaque question du QCM...",
          "examples": ["Exemple 1 : Vérification par calcul direct", "Exemple 2 : Piège classique et contre-mesure"]
        }
      },
      {
        "section_id": "sec_3",
        "title": "EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 POINTS)",
        "questions": [
          { "id": "p3_q1", "number": "1.", "type": "true_false", "points": 1.5, "texte": "En régime linéaire, le courant de contre-réaction est égal au courant d'entrée.", "correct_answer": true, "explication": "Démonstration théorique..." },
          { "id": "p3_q2", "number": "2.", "type": "true_false", "points": 1.5, "texte": "La tension de sortie peut dépasser les tensions d'alimentation sans saturation.", "correct_answer": false, "explication": "Démonstration de l'écrêtage physique..." },
          { "id": "p3_q3", "number": "3.", "type": "true_false", "points": 1.5, "texte": "Dans un montage suiveur de tension, le gain en tension vaut rigoureusement +1.", "correct_answer": true, "explication": "Démonstration de l'étage tampon..." },
          { "id": "p3_q4", "number": "4.", "type": "true_false", "points": 1.5, "texte": "Une boucle de réaction positive sur l'entrée (+) maintient le régime linéaire.", "correct_answer": false, "explication": "Démonstration du basculement en saturation..." }
        ],
        "correction": {
          "steps": "Synthèse théorique des affirmations Vrai ou Faux...",
          "examples": ["Exemple 1 : Cas concret d'application", "Exemple 2 : Analyse critique du contre-exemple"]
        }
      }
    ]
  }
}`;

      case 'questionnaire':
      case 'questionnaire-test':
        return `${base}
CONSIGNE : Conçois 5 questions d'évaluation stimulantes avec calculs chiffrés et formules pour les sujets scientifiques. Rédige 4 propositions développées par question (JAMAIS 'Option A').
{
  "creation_type": "${modId}",
  "creation_title": "Questionnaire : ${docName}",
  "creation_data": {
    "title": "Questionnaire : ${docName}",
    "questions": [
      {
        "id": "q_1",
        "question": "Énoncé complet et contextualisé de la question (avec calcul et LaTeX $...$)...",
        "options": ["Proposition 1 détaillée", "Proposition 2 détaillée", "Proposition 3 détaillée", "Proposition 4 détaillée"],
        "correctIndex": 0,
        "explanation": "Démonstration théorique et calcul pas à pas : $V_s = -\\frac{R_2}{R_1} V_e$...\n\n• Exemple 1 : ...\n• Exemple 2 : ..."
      }
    ]
  }
}`;

      case 'vrai-ou-faux':
      case 'vrai-ou-faux-test':
        return `${base}
CONSIGNE : Conçois 6 affirmations réflexes équilibrées (~50% Vrai, ~50% Faux).
Pour les sujets scientifiques, les affirmations DOIVENT inclure des formules ($...$), des grandeurs chiffrées précises et des calculs réels (ex: calcul de gain, de tension avec $R_1, R_2$).
Dans l'explication, démontre la réponse étape par étape avec la formule et deux exemples concrets distincts.
{
  "creation_type": "${modId}",
  "creation_title": "Vrai ou Faux : ${docName}",
  "creation_data": {
    "title": "Vrai ou Faux : ${docName}",
    "affirmations": [
      {
        "id": "vf_1",
        "statement": "Affirmation scientifique ciblée avec calcul et formule en LaTeX $...$",
        "isTrue": false,
        "explanation": "Démonstration théorique et calcul étape par étape : $V_s = -\\frac{R_2}{R_1} V_e = ...$\n\n• Exemple 1 : ...\n• Exemple 2 : ..."
      }
    ]
  }
}`;

      case 'carte-memoire':
        return `${base}
CONSIGNE : Conçois 8 cartes mémoire (flashcards) avec recto percutant et verso détaillé.
{
  "creation_type": "carte-memoire",
  "creation_title": "Cartes Mémoire : ${docName}",
  "creation_data": {
    "title": "Cartes Mémoire : ${docName}",
    "cards": [
      { "id": "card_1", "front": "Question ou formule clé", "back": "Explication complète et application" }
    ]
  }
}`;

      case 'carte-mentale':
      case 'carte-mentale-2':
        return `${base}
CONSIGNE : Conçois une carte mentale hiérarchique avec au moins 4 branches structurées.
{
  "creation_type": "${modId}",
  "creation_title": "Carte Mentale : ${docName}",
  "creation_data": {
    "root_title": "${docName}",
    "branches": [
      { "title": "Axe 1", "description": "Synthèse", "subBranches": ["Point A", "Point B"] }
    ]
  }
}`;

      case 'resume':
        return `${base}
CONSIGNE : Conçois une fiche de synthèse didactique divisée en grands chapitres avec points clés.
{
  "creation_type": "resume",
  "creation_title": "Fiche de Synthèse : ${docName}",
  "creation_data": {
    "title": "Fiche de Synthèse : ${docName}",
    "overview": "Introduction générale au document...",
    "keyPoints": ["Point clé 1", "Point clé 2"],
    "sections": [
      { "section_title": "1. Notions fondamentales", "content": "Développement complet..." }
    ]
  }
}`;

      case 'pdf':
        return `${base}
CONSIGNE : Rédige un document d'étude officiel complet pour export PDF.
{
  "creation_type": "pdf",
  "creation_title": "Document d'Étude : ${docName}",
  "creation_data": {
    "title": "Document d'Étude : ${docName}",
    "chapters": [
      { "heading": "1. Introduction et Principes", "content": "Contenu exhaustif..." }
    ]
  }
}`;

      case 'infographie':
        return `${base}
CONSIGNE : Structure une infographie pédagogique complète, ultra-visuelle et structurée avec des chiffres clés, des étapes méthodologiques détaillées et des repères essentiels.
{
  "creation_type": "infographie",
  "creation_title": "Infographie : ${docName}",
  "creation_data": {
    "title": "Titre synthétique du sujet",
    "subtitle": "Repères clés et synthèse conceptuelle",
    "visual_style": "Design technique moderne, schématique et épuré",
    "image_prompt": "Infographie scientifique moderne sur ${docName} avec diagrammes et composants",
    "metrics": [
      { "value": "100%", "label": "Notions clés", "color": "#3B82F6" },
      { "value": "Méthode", "label": "Rigueur de calcul", "color": "#10B981" },
      { "value": "Formules", "label": "Lois directrices", "color": "#F97316" }
    ],
    "steps": [
      { "step": 1, "heading": "1. Principe Fondamental", "description": "Explication détaillée de la première notion clé du cours avec formules LaTeX $...$...", "badge": "Fondement", "color": "#3B82F6" },
      { "step": 2, "heading": "2. Lois & Équations Directrices", "description": "Développement analytique et relations mathématiques exactes...", "badge": "Calcul", "color": "#10B981" },
      { "step": 3, "heading": "3. Montages Pratiques & Comportement", "description": "Analyse du comportement physique et configurations en situation réelle...", "badge": "Pratique", "color": "#F97316" },
      { "step": 4, "heading": "4. Synthèse & Points de Vigilance", "description": "Règles de dimensionnement, erreurs classiques et points clés d'examen...", "badge": "Synthèse", "color": "#8B5CF6" }
    ],
    "highlights": [
      { "type": "tip", "title": "Conseil Clé", "text": "Règle essentielle à retenir pour les calculs." },
      { "type": "warning", "title": "Point de Vigilance", "text": "Piège fréquent à éviter lors de l'application des lois." }
    ],
    "conclusion": "Bilan synthétique des notions abordées dans cette infographie."
  }
}`;

      default:
        return `${base}
Génère le module "${modLabel}" structuré sous forme de JSON valide.`;
    }
  };

  // Clic 1-clic direct sur l'un des 12 boutons officiels de création (100% DÉCOUPLÉ DU CHAT)
  const handleProposalClick = async (mod: ModuleDefinition) => {
    if (isGenerating) return;

    // Récupérer le document actif (via prop ou localStorage)
    const previewItem = activePreviewItem || (() => {
      try {
        const stored = localStorage.getItem('studycloud_active_preview_item') || localStorage.getItem('unifolder_active_file');
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    })();

    const docName = previewItem?.name || previewItem?.title || previewItem?.fileName || 'Document sélectionné';
    setActiveCreation(null); // ← CRITICAL : effacer l'ancienne fiche pour éviter l'affichage en boucle
    setIsGenerating(true);
    setGeneratingInfo({
      type: mod.id,
      title: mod.label,
      subtitle: `Conception de "${mod.label}" en cours...`,
    });
    setActiveTabModule(mod.id);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Extraction éventuelle du texte du document sélectionné
      let extractedDocText = '';
      if (previewItem) {
        try {
          extractedDocText = await extractDocumentText(previewItem);
        } catch (err) {
          console.warn('[RightMenu] Erreur extraction texte document:', err);
        }
      }

      const promptText = getModuleCreationPrompt(mod.id, mod.label, docName);

      // 2. Appel DIRECT et DÉCOUPLÉ au moteur IA (JAMAIS injecté dans le Chat)
      const res = await generateDirectAiCreation({
        toolType: mod.id,
        docName: docName,
        docContent: extractedDocText,
        prompt: promptText,
        userId: localStorage.getItem('unifolder_user_id') || 'default-user',
      });

      if (!res || !res.success) {
        throw new Error(res?.rawText || "L'assistante StudyCloud n'est pas disponible pour le moment.");
      }

      const targetType = (res.creation_type as ModuleId) || mod.id;
      let effectiveContent = res.creation_data || null;
      let effectiveTitle = res.creation_title || `${mod.label} : ${docName}`;

      // Si creation_data est vide, tenter le parsing SEULEMENT si rawText est un vrai contenu (non une erreur)
      const isCreationDataEmpty = !effectiveContent || (typeof effectiveContent === 'object' && Object.keys(effectiveContent).length === 0);
      if (isCreationDataEmpty && res.rawText && res.rawText.length > 50) {
        const isErrorMsg = res.rawText.toLowerCase().includes("n'est pas disponible") || res.rawText.toLowerCase().includes("erreur");
        if (!isErrorMsg) {
          try {
            const parsedCreation = parseOrBuildAiCreation(
              targetType as any,
              res.rawText,
              docName,
              promptText
            );
            if (parsedCreation && parsedCreation.content) {
              effectiveContent = parsedCreation.content;
              if (parsedCreation.title) effectiveTitle = parsedCreation.title;
            }
          } catch (parseErr) {
            console.warn('[RightMenu] Erreur parsing secours creation:', parseErr);
          }
        }
      }

      // Vérifier rigoureusement que le contenu provient bien de l'IA et n'est pas vide
      const hasRealAiContent = Boolean(
        effectiveContent &&
        typeof effectiveContent === 'object' &&
        !effectiveContent.error &&
        (
          (effectiveContent.complete_exam && Array.isArray(effectiveContent.complete_exam.sections) && effectiveContent.complete_exam.sections.length > 0) ||
          (Array.isArray(effectiveContent.sections) && effectiveContent.sections.length > 0) ||
          (Array.isArray(effectiveContent.questions) && effectiveContent.questions.length > 0) ||
          (Array.isArray(effectiveContent.affirmations) && effectiveContent.affirmations.length > 0) ||
          (Array.isArray(effectiveContent.cards) && effectiveContent.cards.length > 0) ||
          (Array.isArray(effectiveContent.flashcards) && effectiveContent.flashcards.length > 0) ||
          (effectiveContent.summary && (effectiveContent.summary.content || effectiveContent.summary.sections)) ||
          (effectiveContent.mind_map || effectiveContent.branches) ||
          (effectiveContent.infographic || effectiveContent.steps) ||
          (effectiveContent.written_exercise || effectiveContent.exercises)
        )
      );

      // Si l'IA n'a pas pu générer de vrai contenu, ne JAMAIS afficher de faux exercices en mémoire :
      if (!hasRealAiContent) {
        throw new Error("L'assistante StudyCloud n'est pas disponible pour le moment.");
      }

      // Normalisation défensive immédiate pour devoir-complet pour garantir les 3 fiches peuplées
      if (targetType === 'devoir-complet') {
        try {
          effectiveContent = normalizeExamData(effectiveContent, docName);
          effectiveTitle = `Épreuve Officielle d'Examen : ${docName}`;
        } catch (normErr) {
          console.warn('[RightMenu] Erreur normalisation devoir-complet:', normErr);
        }
      }

      const newCreation: AiCreation = {
        id: 'ai-' + Date.now(),
        userId: localStorage.getItem('unifolder_user_id') || 'default-user',
        fileId: previewItem?.id,
        toolType: targetType,
        title: effectiveTitle,
        content: effectiveContent,
        sourceFileName: docName,
        createdAt: new Date().toISOString(),
        version: 1,
        htmlPreview: res.html_preview,
      };

      setActiveCreation(newCreation);
      setActiveTabModule(targetType);
      setIsGenerating(false);
      setGeneratingInfo(null);
      abortControllerRef.current = null;

      // Sauvegarde dans l'historique local et D1
      setHistoryItems((prev: any[]) => {
        const updated = [
          {
            id: newCreation.id,
            toolType: newCreation.toolType,
            title: newCreation.title,
            dateStr: "À l'instant",
            colorClass: 'text-orange-300',
            desc: `Généré pour "${docName}"`,
            pinned: false,
            contentJson: newCreation.content,
            sourceFileName: docName,
          },
          ...prev.filter(p => p.id !== newCreation.id),
        ];
        saveHistory(updated);
        return updated;
      });

      try {
        StudyCloudAPI.saveAiContent({
          id: newCreation.id,
          userId: localStorage.getItem('unifolder_user_id') || 'default-user',
          fileId: newCreation.fileId || null,
          toolType: newCreation.toolType,
          title: newCreation.title,
          contentJson: newCreation.content,
          sourceFileName: newCreation.sourceFileName || '',
          isPinned: false,
        }).catch(() => {});
      } catch {}

      // REMARQUE : Aucun événement vers le Chat n'est émis ici pour garantir le découplage total !

    } catch (err: any) {
      console.warn('[RightMenu] Erreur lors de la création IA:', err);

      if (err.name === 'AbortError' && !abortControllerRef.current) {
        setIsGenerating(false);
        setGeneratingInfo(null);
        return;
      }

      const fallbackCreation: AiCreation = {
        id: 'ai-' + Date.now(),
        userId: localStorage.getItem('unifolder_user_id') || 'default-user',
        fileId: activePreviewItem?.id,
        toolType: mod.id,
        title: `${mod.label} : ${docName}`,
        content: {
          error: true,
          errorMessage: err.message || "L'assistante StudyCloud n'est pas disponible pour le moment.",
          canRetry: true,
          failedModId: mod.id
        },
        sourceFileName: docName,
        createdAt: new Date().toISOString(),
        version: 1,
      };

      setActiveCreation(fallbackCreation);
      setActiveTabModule(mod.id);
      setIsGenerating(false);
      setGeneratingInfo(null);
      abortControllerRef.current = null;
    }
  };

  // Rendu du composant correspondant au module actif
  const renderActiveCreation = () => {
    const currentType = activeCreation?.toolType || activeTabModule;
    const currentData = activeCreation?.content;
    const currentTitle = activeCreation?.title;

    // Si la génération a échoué, afficher un écran d'erreur clair avec bouton Réessayer
    if (currentData?.error) {
      const failedMod = MODULES.find(m => m.id === (currentData.failedModId || currentType));
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center animate-fadeIn max-w-md mx-auto my-auto">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/5">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-zinc-100 mb-2">
            L'assistante StudyCloud n'est pas disponible pour le moment
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mb-5 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 text-center">
            ⚠️ {currentData.errorMessage || "L'assistante StudyCloud n'est pas disponible pour le moment."}
          </p>
          <div className="flex items-center gap-3">
            {failedMod && (
              <button
                type="button"
                onClick={() => handleProposalClick(failedMod)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveCreation(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95 cursor-pointer border border-zinc-700"
            >
              Retour aux modules
            </button>
          </div>
        </div>
      );
    }

    switch (currentType) {
      case 'questionnaire':
        return <Questionnaire data={currentData} />;
      case 'questionnaire-test':
        return <QuestionnaireTest data={currentData} />;
      case 'vrai-ou-faux':
        return <VraiOuFaux data={currentData} />;
      case 'vrai-ou-faux-test':
        return <VraiOuFauxTest data={currentData} />;
      case 'carte-mentale':
        return <CarteMentale data={currentData} title={currentTitle} />;
      case 'carte-mentale-2':
        return <CarteMentaleConceptuelle data={currentData} title={currentTitle} />;
      case 'carte-memoire':
      case 'flashcards':
        return <CarteMemoire data={currentData} />;
      case 'resume':
      case 'summary':
        return <Resume data={currentData} title={currentTitle} sourceFileName={activeCreation?.sourceFileName} />;
      case 'pdf':
      case 'document':
        return <Pdf data={currentData} title={currentTitle} />;
      case 'infographie':
      case 'infographic':
        return <Infographie data={currentData} title={currentTitle} />;
      case 'exercices-ecrits':
        return <ExercicesEcrits data={currentData} title={currentTitle} />;
      case 'devoir-complet':
        return <DevoirComplet data={currentData} title={currentTitle} />;
      case 'quiz':
        return <Questionnaire data={currentData} />;
      case 'mindmap':
        return <CarteMentale data={currentData} title={currentTitle} />;
      default:
        return <Questionnaire data={currentData} />;
    }
  };

  return (
    <div className={`w-full h-full pointer-events-auto relative bg-[#1e2024] flex flex-col overflow-hidden ${isCenterFullscreen ? 'hidden' : (isMobileScreen ? (mobilePreviewTab === 2 || isRightFullscreen ? 'flex' : 'hidden') : 'flex')}`}>
      {/* Barre supérieure en haut dans le creux : Bouton Zoom (jaune) + Bouton + (Retour aux 12 boutons) + Bouton Historique (horloge) */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-[#23252a] border-b border-zinc-700/60 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Bouton Zoom jaune */}
          <button
            type="button"
            onClick={() => setIsRightFullscreen(!isRightFullscreen)}
            className="p-1.5 bg-yellow-400 rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center"
            title={isRightFullscreen ? "Réduire" : "Plein écran"}
          >
            {isRightFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Bouton + placé derrière le bouton zoom jaune (retour à la sélection des 12 modules) */}
          <button
            type="button"
            onClick={() => {
              setActiveCreation(null);
              setIsGenerating(false);
            }}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
            title="Nouvelle création / Afficher les 12 modules"
          >
            <Plus className="w-4 h-4 text-orange-400 font-black" />
          </button>
        </div>

        {/* Titre ou indicateur d'état */}
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 truncate px-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="truncate">
            {activeCreation ? activeCreation.title : 'Espace Création IA (12 Modules)'}
          </span>
        </div>

        {/* Bouton Aperçu Web Worker si disponible */}
        {activeCreation?.htmlPreview && (
          <button
            type="button"
            onClick={() => {
              const win = window.open();
              if (win) {
                win.document.open();
                win.document.write(activeCreation.htmlPreview!);
                win.document.close();
              }
            }}
            className="p-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 rounded-lg border-2 border-cyan-800/60 shadow-[2px_2px_0px_0px_#0e7490] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 text-[11px] font-bold shrink-0"
            title="Ouvrir l'aperçu HTML standalone généré par le Worker"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Aperçu Web</span>
          </button>
        )}

        {/* Bouton Horloge (Historique des créations) */}
        <button
          type="button"
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className="p-1.5 bg-white rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-stone-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center shrink-0"
          title={isRightSidebarOpen ? "Fermer l'historique" : "Historique des créations"}
        >
          {isRightSidebarOpen ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Creation Area */}
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-start min-h-0 bg-[#16181f] text-zinc-100">
        {/* ÉTAT 1 : ANIMATION ADN PENDANT LA CRÉATION */}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-6 animate-fadeIn h-full my-auto text-center px-4 max-w-sm py-12">
            <div className="relative flex items-center justify-center w-28 h-28">
              {/* Outer rotating dashed ring */}
              <div className="absolute inset-0 border-3 border-dashed border-orange-500/50 rounded-full animate-[spin_5s_linear_infinite]" />
              {/* Inner rotating solid ring (reverse) */}
              <div className="absolute inset-2.5 border-2 border-orange-400/70 rounded-full animate-[spin_3.5s_linear_reverse_infinite]" />
              {/* Center glowing DNA icon */}
              <div className="absolute animate-pulse text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.9)]">
                <DnaLogo className="w-12 h-12" glow={true} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 mt-2">
              <span className="text-orange-500 font-black text-xl tracking-wide animate-pulse">
                Je suis en train de créer...
              </span>
              <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                {generatingInfo?.title || "Génération du module IA"}
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">
                {generatingInfo?.subtitle || "Structuration des données en temps réel"}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                    abortControllerRef.current = null;
                  }
                  setIsGenerating(false);
                  setGeneratingInfo(null);
                }}
                className="mt-4 px-4 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-[#22252e] hover:bg-[#2a2f3a] border border-zinc-700/60 transition-all cursor-pointer select-none active:scale-95"
              >
                Annuler la création
              </button>
            </div>
          </div>
        ) : activeCreation ? (
          /* ÉTAT 2 : CRÉATION ACTIVE INTERACTIVE (RENDU DU MODULE SÉLECTIONNÉ) */
          <div className="w-full h-full flex flex-col animate-fadeIn min-h-0 bg-[#16181f]">
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar scroll-smooth min-h-0">
              {renderActiveCreation()}
            </div>
          </div>
        ) : (
          /* ÉTAT 3 : LES 12 BOUTONS OFFICIELS DE CRÉATION 1-CLIC */
          <div className="w-full max-w-5xl mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
            <div className="text-center space-y-1.5 max-w-xl mx-auto pt-1 sm:pt-2">
              <h2 className="text-lg sm:text-2xl font-black text-zinc-100 tracking-tight">
                Que souhaitez-vous concevoir ?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
                Cliquez sur un outil ci-dessous pour lancer instantanément la création sans écrire à l’IA, ou demandez-le lui directement dans le chat.
              </p>

              {/* Filtres thématiques par catégorie */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
                {CATEGORY_TABS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                      selectedCategory === cat.id
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-[#21242d] text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 hover:border-zinc-500'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grille responsive des 12 modules */}
            <div
              id="ai-modules-grid"
              className={`grid gap-3 w-full ${
                isRightFullscreen
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  : 'grid-cols-1 min-[520px]:grid-cols-2'
              }`}
            >
              {(selectedCategory === 'all' ? MODULES : MODULES.filter(m => m.category === selectedCategory)).map((mod, idx) => {
                const IconComp = mod.icon;
                return (
                  <button
                    key={mod.id}
                    id={`btn-creation-module-${mod.id}`}
                    type="button"
                    onClick={() => handleProposalClick(mod)}
                    className="group relative flex flex-col text-left p-3.5 sm:p-4 rounded-xl border border-zinc-700/60 bg-[#21242d] hover:bg-[#272b36] hover:border-orange-500/70 hover:shadow-lg hover:shadow-black/25 transition-all duration-200 cursor-pointer active:scale-[0.99] select-none shadow-xs"
                    style={{ animationDelay: `${idx * 25}ms` }}
                  >
                    {/* En-tête : Icône stylisée + Badge court */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs"
                        style={{ backgroundColor: `${mod.borderColor}22`, color: mod.borderColor }}
                      >
                        <IconComp className="w-4.5 h-4.5" />
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 whitespace-nowrap"
                        style={{
                          backgroundColor: `${mod.borderColor}18`,
                          color: mod.borderColor,
                          border: `1px solid ${mod.borderColor}35`
                        }}
                      >
                        {mod.badge}
                      </span>
                    </div>

                    {/* Titre */}
                    <h3 className="text-sm font-bold text-zinc-100 group-hover:text-orange-400 transition-colors line-clamp-1 mb-1">
                      {mod.label}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {mod.description}
                    </p>

                    {/* Footer / Bouton d'action */}
                    <div className="mt-3 pt-2 border-t border-zinc-700/50 flex items-center justify-between text-[11px] font-semibold text-orange-400 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>Lancer la création</span>
                      <span className="text-xs font-black transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right History Sidebar */}
      <div 
        className={`absolute top-[44px] right-0 bottom-0 z-40 bg-[#1e2024] border-l border-zinc-800 text-white flex flex-col p-4 transition-transform duration-300 ease-in-out ${
          isRightFullscreen ? 'w-full md:w-[360px] shadow-2xl' : 'w-full'
        } ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col gap-2 border-b border-zinc-700 pb-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-zinc-100">Historique des Créations</h3>
            </div>
            {historyItems.length > 0 && (
              <button 
                onClick={() => {
                  if (selectedHistoryIds.length === historyItems.length) {
                    setSelectedHistoryIds([]);
                  } else {
                    setSelectedHistoryIds(historyItems.map(h => h.id));
                  }
                }}
                className="text-xs text-[#70a5ff] hover:text-blue-400 font-semibold cursor-pointer"
              >
                {selectedHistoryIds.length === historyItems.length ? 'Tout décocher' : 'Tout cocher'}
              </button>
            )}
          </div>

          {selectedHistoryIds.length > 0 && (
            <div className="flex items-center justify-between bg-red-900/20 border border-red-900/50 p-2 rounded-lg">
              <span className="text-xs text-red-200">{selectedHistoryIds.length} sélectionné(s)</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedHistoryIds([])}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer px-2 py-1"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    const updated = historyItems.filter(h => !selectedHistoryIds.includes(h.id));
                    saveHistory(updated);
                    selectedHistoryIds.forEach(id => {
                      try { StudyCloudAPI.deleteAiContent(id).catch(() => {}); } catch {}
                    });
                    setSelectedHistoryIds([]);
                  }}
                  className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1 rounded cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 text-zinc-400 text-xs overflow-y-auto pr-1 custom-scrollbar space-y-2">
          {sortedHistory.length === 0 ? (
            <p className="text-center text-zinc-500 my-8">Aucune création dans l'historique</p>
          ) : (
            sortedHistory.map(item => (
              <div 
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className="bg-[#26282d] p-3 rounded-xl border border-zinc-700/60 hover:bg-[#2e3137] hover:border-zinc-500 transition-all cursor-pointer group flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${item.colorClass || 'text-orange-300'} truncate`}>
                    {item.title}
                  </span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{item.dateStr}</span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">{item.desc}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
