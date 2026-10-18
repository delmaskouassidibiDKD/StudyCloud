import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, ThumbsUp, ThumbsDown, Copy, Check, X, FileText, Sparkles, Loader2, Clock, Plus, Trash2, Search, MessageSquare, ChevronRight, Brain, Presentation, ChevronDown, ChevronUp, Layers, Zap, Palette, HelpCircle, Download, Square, WifiOff, RotateCw, AlertTriangle } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { DelmasRobot } from './DelmasRobot';
import { FileIconBadge } from './FileIconBadge';
import { MathText, stripAiReasoningScratchpad } from './MathText';
import { sendChatMessageToAi, saveAiReaction, removeAiAttachment, StudyCloudAPI, getGeminiApiKey, safeJsonParse } from '../services/api';
import { safeSetItem, safeGetItem, safeLocalStorageRemove } from '../utils/safeStorage';
import { extractDocumentText } from '../services/documentTextExtractor';
import { parseOrBuildAiCreation } from '../services/aiCreationGenerator';
import { AiCreation, AiCreationType, ModuleId } from './ai-creations/types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isStreaming?: boolean;
  reaction?: 'like' | 'dislike' | null;
  attachedFileName?: string;
  createdAt?: string;
  model?: string;
  isPowerMode?: boolean;
  isError?: boolean;
  errorType?: 'network' | 'server';
  retryPrompt?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export function stripWorkerAi(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/\s*\(?\s*workers?\s*ai\s*\)?/gi, '')
    .replace(/\s*\(?\s*cloudflare\s*\)?/gi, '')
    .replace(/\bworkers?\s*ai\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeCreationType(type: string | undefined): ModuleId {
  if (!type) return 'questionnaire';
  const t = type.toLowerCase().trim();
  if (t === 'quiz' || t === 'qcm' || t === 'questionnaire') return 'questionnaire';
  if (t === 'test' || t === 'questionnaire-test') return 'questionnaire-test';
  if (t === 'vrai-ou-faux' || t === 'vrai-faux' || t === 'vf') return 'vrai-ou-faux';
  if (t === 'vrai-ou-faux-test' || t === 'vf-test') return 'vrai-ou-faux-test';
  if (t === 'mindmap' || t === 'carte-mentale' || t === 'mind-map') return 'carte-mentale';
  if (t === 'carte-mentale-2' || t === 'mindmap2') return 'carte-mentale-2';
  if (t === 'carte-memoire' || t === 'flashcard' || t === 'flashcards' || t === 'cartes-memoire') return 'carte-memoire';
  if (t === 'summary' || t === 'resume' || t === 'fiche') return 'resume';
  if (t === 'document' || t === 'pdf') return 'pdf';
  if (t === 'infographic' || t === 'infographie') return 'infographie';
  if (t === 'exercices-ecrits' || t === 'exercices' || t === 'written-exercise') return 'exercices-ecrits';
  if (t === 'devoir-complet' || t === 'devoir' || t === 'exam') return 'devoir-complet';
  return (t as ModuleId) || 'questionnaire';
}

// Helper robuste pour nettoyer tout résidu JSON du chat et garantir un texte pur avec LaTeX intact
function cleanChatText(text: string): string {
  if (!text) return '';
  let clean = text.trim();

  // Si le texte est ou contient un payload JSON de création
  if (clean.includes('"decision"') || clean.includes('"creation_data"') || clean.includes('"creation_type"') || clean.startsWith('{') || clean.startsWith('```json')) {
    const jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || clean.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const parsed = safeJsonParse(jsonMatch[1] || jsonMatch[0]);
      if (parsed && typeof parsed === 'object') {
        const msg = parsed.chat_message || parsed.chat_response;
        if (typeof msg === 'string' && !msg.trim().startsWith('{') && !msg.trim().startsWith('```') && !msg.includes('"creation_data"')) {
          return msg.trim();
        }
      }
    }

    // Regex d'extraction du message conversationnel
    const msgMatch = clean.match(/"(?:chat_message|chat_response)"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (msgMatch) {
      try {
        return JSON.parse(`"${msgMatch[1]}"`).trim();
      } catch {
        return msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      }
    }

    // Nettoyage de résidus JSON de création
    clean = clean
      .replace(/```(?:json)?\s*\{[\s\S]*?"(?:decision|creation_data|creation_type)"[\s\S]*?\}\s*```/gi, '')
      .replace(/<creation[^>]*>[\s\S]*?<\/creation>/gi, '')
      .replace(/\{[\s\S]*"(?:decision|creation_data|creation_type|questions|affirmations)"[\s\S]*\}/gi, '')
      .trim();
  }

  return clean;
}

// Détermine dynamiquement ce que l'IA réalise en temps réel (à l'instant T) selon le contexte et le délai
// Rédigé avec des messages pédagogiques rassurants, fluides et sans jargon technique
function getLiveAiActivity(prompt: string, docNames: string[], elapsedSec: number, requestedType?: string): string {
  const cleanPrompt = (prompt || '').trim().toLowerCase();
  const mainDoc = docNames && docNames.length > 0 ? docNames[0] : '';
  const hasDoc = Boolean(mainDoc);
  const normType = (requestedType || '').toLowerCase().replace(/_/g, '-');

  const pickReassuringStep = (steps: string[]): string => {
    if (!steps || steps.length === 0) return "Je prépare votre réponse avec soin...";
    const idx = Math.min(Math.floor(elapsedSec / 3), steps.length - 1);
    if (Math.floor(elapsedSec / 3) >= steps.length) {
      const extraIdx = (Math.floor(elapsedSec / 3) - steps.length) % 2;
      return extraIdx === 0 
        ? steps[steps.length - 1] 
        : "Je peaufine les derniers détails pour vous...";
    }
    return steps[idx];
  };

  // 1. Questionnaire Test (Test noté avec chronomètre)
  if (normType.includes('questionnaire-test') || normType === 'test' || /(questionnaire test|test noté|test chrono|épreuve notée)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare les questions de votre test noté...",
      "J'ajuste le barème, le chronomètre et les critères d'évaluation...",
      "Je formule les explications pédagogiques détaillées pour chaque question...",
      "Tout est bientôt prêt pour votre test noté..."
    ]);
  }

  // 2. Questionnaire / Quiz QCM
  if (normType.includes('questionnaire') || normType.includes('quiz') || /(quiz|qcm|questionnaire)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "J'étudie votre sujet avec attention...",
      "Je sélectionne les questions les plus utiles pour votre révision...",
      "Je formule des explications claires pour vous guider...",
      "Je prépare les options de réponses pour vous entraîner...",
      "Votre questionnaire interactif arrive dans un instant..."
    ]);
  }

  // 3. Carte Mentale 2 (Conceptuelle)
  if (normType.includes('carte-mentale-2') || normType.includes('mindmap2') || /(carte mentale 2|carte conceptuelle|mindmap 2)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "J'analyse les piliers et relations conceptuelles de votre cours...",
      "Je structure les concepts en blocs hiérarchiques et connecteurs...",
      "Je relie les notions maîtresses pour une vue d'ensemble limpide...",
      "Votre carte mentale 2 (conceptuelle) est bientôt prête..."
    ]);
  }

  // 4. Carte Mentale (Arborescente)
  if (normType.includes('carte-mentale') || normType.includes('mindmap') || /(carte mentale|mindmap)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "J'organise les idées maîtresses de votre cours...",
      "Je relie les notions entre elles pour simplifier votre compréhension...",
      "Je structure les concepts clés de manière visuelle...",
      "J'harmonise la vue d'ensemble pour faciliter votre révision...",
      "Votre carte mentale est presque prête..."
    ]);
  }

  // 5. Cartes Mémoires / Flashcards
  if (normType.includes('carte-memoire') || normType.includes('flashcard') || /(flashcards?|carte mémoire)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je repère les définitions et notions indispensables...",
      "Je rédige des cartes claires pour stimuler votre mémoire...",
      "Je prépare les explications détaillées au verso...",
      "Je vérifie les réponses pour faciliter votre mémorisation...",
      "Vos cartes mémoires sont bientôt prêtes..."
    ]);
  }

  // 6. Fiche de Résumé / Synthèse
  if (normType.includes('resume') || /(résumé|fiche|synthèse)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je parcours les points clés de votre cours...",
      "Je synthétise les règles majeures pour aller à l'essentiel...",
      "J'organise les points de repère pour vous faire gagner du temps...",
      "Je soigne la clarté et la mise en page...",
      "Votre fiche de synthèse est prête dans un instant..."
    ]);
  }

  // 7. Document PDF
  if (normType.includes('pdf') || /document pdf/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je structure votre document d'étude...",
      "Je rédige un contenu complet, clair et bien expliqué...",
      "J'organise les chapitres pour vous faciliter l'apprentissage...",
      "Je peaufine la mise en page pour une lecture agréable...",
      "Votre document est presque prêt..."
    ]);
  }

  // 8. Vrai ou Faux Test (Épreuve notée)
  if (normType.includes('vrai-ou-faux-test') || normType.includes('vf-test') || /(vrai ou faux test|épreuve vrai faux|test vrai ou faux)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare la série d'affirmations ciblées pour votre épreuve...",
      "Je configure le barème et la notation globale de l'épreuve...",
      "J'ajoute les justifications pédagogiques pour chaque énoncé...",
      "Votre épreuve de vrai ou faux test est presque prête..."
    ]);
  }

  // 9. Vrai ou Faux
  if (normType.includes('vrai') || /vrai ou faux/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare des affirmations ciblées sur votre cours...",
      "Je formule des cas concrets pour consolider vos acquis...",
      "J'ajoute les justifications pédagogiques pour chaque réponse...",
      "Votre série de vrai ou faux est presque prête..."
    ]);
  }

  // 10. Devoir Complet (Examen officiel)
  if (normType.includes('devoir-complet') || /(devoir complet|sujet d'examen|épreuve d'examen|examen officiel)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je conçois un sujet d'examen officiel complet avec plusieurs parties...",
      "J'élabore les énoncés d'application et les questions pas à pas...",
      "Je prépare le barème officiel sur 20 points et le corrigé détaillé...",
      "Votre devoir complet d'examen est bientôt prêt..."
    ]);
  }

  // 11. Exercices Écrits
  if (normType.includes('exercice') || normType.includes('devoir') || /(exercice|devoir|exercices écrits)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare des exercices progressifs et adaptés à votre niveau...",
      "Je rédige des énoncés limpides et encourageants...",
      "Je détaille la méthode pas à pas pour vous accompagner...",
      "Je vérifie chaque consigne pour vous guider au mieux...",
      "Votre entraînement arrive dans un instant..."
    ]);
  }

  // 12. Infographie
  if (normType.includes('infographie') || /infographie/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je regroupe les repères et informations indispensables...",
      "Je mets en valeur les points clés pour une lecture intuitive...",
      "J'harmonise la présentation de votre infographie...",
      "Votre infographie pédagogique est presque prête..."
    ]);
  }

  // 10. Mathématiques, calculs, sciences dures (sans jargon technique)
  const isMathScience = /(calcul|dériv|intégral|équat|formule|résoud|résous|schéma|circuit|aop|filtre|rlc|valeur|\$|\\dfrac|impédance|tension|courant|puissance|théorème|démonstr|vecteur|matrice|harmonique)/i.test(cleanPrompt);
  if (isMathScience) {
    return pickReassuringStep([
      "J'examine attentivement votre énoncé...",
      "Je prépare une explication simple, étape par étape...",
      "Je vérifie chaque résultat pour vous assurer une parfaite compréhension...",
      "Je termine la présentation claire de la solution...",
      "Votre explication détaillée est prête dans un instant..."
    ]);
  }

  // 11. Document d'étude ouvert ou joint
  if (hasDoc) {
    return pickReassuringStep([
      `Je m'appuie sur votre document « ${mainDoc} »...`,
      "Je sélectionne les passages importants pour répondre au mieux...",
      "Je prépare une réponse claire adaptée à votre cours...",
      "Je peaufine les explications pour vous guider...",
      "Votre réponse est bientôt prête..."
    ]);
  }

  // 12. Cas général (Discussion normale)
  return pickReassuringStep([
    "J'analyse votre question avec attention...",
    "Je prépare une explication claire et détaillée...",
    "Je structure la réponse étape par étape...",
    "Je peaufine les conseils pour vous...",
    "Votre réponse arrive dans un instant..."
  ]);
}

// Détection professionnelle des coupures réseau et absence de connexion
export function isNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('network_disconnected') ||
    msg.includes('connexion internet') ||
    msg.includes('hors ligne') ||
    msg.includes('offline') ||
    msg.includes('load failed') ||
    msg.includes('net::err') ||
    (err?.name === 'TypeError' && (msg.includes('fetch') || msg.includes('network')))
  );
}

function isNetworkErrorMessage(msg: Message): boolean {
  if (msg.errorType === 'network') return true;
  if (!msg.text) return false;
  const t = msg.text.toLowerCase();
  return (
    t.includes('failed to fetch') ||
    t.includes('network_disconnected') ||
    t.includes('connexion internet') ||
    t.includes('hors ligne') ||
    t.includes('networkerror') ||
    t.includes('vérifier votre connexion') ||
    t.includes('vérifier votre réseau')
  );
}

// Carte d'information de connexion (sans texte superflu ni bouton rouge)
function NetworkErrorCard({
  retryPrompt,
  onRetry,
  isRetrying = false,
}: {
  retryPrompt?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div className="my-2 p-3 sm:p-3.5 rounded-2xl bg-[#1e2026] border border-zinc-700/80 shadow-md w-full max-w-xl transition-all animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shrink-0">
          <WifiOff className="w-4 h-4 text-orange-400" />
        </div>
        <p className="flex-1 text-xs sm:text-[13px] text-zinc-200 leading-relaxed font-medium">
          Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles).
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60 shrink-0 active:scale-95 shadow-sm"
          title="Réessayer"
        >
          <RotateCw className={`w-3 h-3 text-orange-400 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Connexion...' : 'Réessayer'}</span>
        </button>
      </div>
    </div>
  );
}

function ChatRecommendationCard({ recoType }: { recoType: string; key?: any }) {
  const norm = recoType.trim().toLowerCase();
  let cardTitle = 'Fiches & exercices de révision';
  let cardDesc = 'Un ensemble interactif optimisé pour mémoriser rapidement les concepts clés de ce chapitre.';

  if (norm.includes('flashcard') || norm.includes('carte')) {
    cardTitle = 'Flashcards & cartes mémoire';
    cardDesc = 'Un jeu de cartes interactif pour associer rapidement chaque formule et notion essentielle.';
  } else if (norm.includes('diaporama') || norm.includes('présentation')) {
    cardTitle = 'Guide visuel & diaporama';
    cardDesc = 'Une présentation pas-à-pas illustrant les propriétés fondamentales et la méthode de résolution.';
  } else if (norm.includes('quiz') || norm.includes('qcm')) {
    cardTitle = "Quiz d'entraînement interactif";
    cardDesc = 'Testez vos connaissances avec 10 questions corrigées pas à pas.';
  } else if (norm.includes('mindmap') || norm.includes('mentale')) {
    cardTitle = 'Carte mentale synthétique';
    cardDesc = 'Une vue arborescente pour visualiser toutes les connexions entre les théorèmes.';
  }

  return (
    <div className="my-3 p-4 rounded-2xl bg-[#23262d] border border-zinc-700/80 shadow-md flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-300">
          <Layers className="w-3.5 h-3.5 text-orange-400" />
          <span className="capitalize">Recommandé : {norm}</span>
        </div>
      </div>
      <h4 className="text-sm font-bold text-white leading-tight">{cardTitle}</h4>
      <p className="text-xs text-zinc-400 leading-relaxed">{cardDesc}</p>
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('auto-prompt', {
              detail: { prompt: `Crée une création de type ${norm} sur ce cours` }
            }));
          }}
          className="px-4 py-1.5 rounded-full bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function sanitizeSvg(rawSvg: string): string {
  if (!rawSvg) return '';
  return rawSvg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:/gi, '');
}

function extractSvgBlocks(content: string): { cleanText: string; svgBlocks: string[] } {
  const svgBlocks: string[] = [];
  let cleanText = content;

  // 1. Blocs de code ```svg ... ```
  cleanText = cleanText.replace(/```(?:svg|xml)?\s*(<svg[\s\S]*?<\/svg>)\s*```/gi, (_match, svg) => {
    svgBlocks.push(sanitizeSvg(svg));
    return `\n\n__STUDYCLOUD_SVG_BLOCK_${svgBlocks.length - 1}__\n\n`;
  });

  // 2. Balises brutes <svg ... </svg>
  cleanText = cleanText.replace(/(<svg\b[^>]*>[\s\S]*?<\/svg>)/gi, (match) => {
    svgBlocks.push(sanitizeSvg(match));
    return `\n\n__STUDYCLOUD_SVG_BLOCK_${svgBlocks.length - 1}__\n\n`;
  });

  return { cleanText, svgBlocks };
}

// Formats de création StudyCloud officiels
const CREATION_FORMAT_LABELS: Record<string, string> = {
  'questionnaire': 'Questionnaire Quiz QCM interactif',
  'quiz': 'Questionnaire Quiz QCM interactif',
  'questionnaire-test': 'Questionnaire Test noté avec chronomètre',
  'carte-mentale': 'Carte Mentale arborescente',
  'mindmap': 'Carte Mentale arborescente',
  'carte-mentale-2': 'Carte Mentale 2 (Conceptuelle)',
  'mindmap2': 'Carte Mentale 2 (Conceptuelle)',
  'carte-memoire': 'Cartes Mémoires (Flashcards)',
  'flashcards': 'Cartes Mémoires (Flashcards)',
  'resume': 'Fiche de Résumé structurée',
  'pdf': 'Document PDF polycopié d\'étude',
  'vrai-ou-faux': 'Série Vrai ou Faux interactive',
  'vrai-ou-faux-test': 'Épreuve Vrai ou Faux Test notée',
  'vf-test': 'Épreuve Vrai ou Faux Test notée',
  'exercices-ecrits': 'Série d\'Exercices Écrits d\'application',
  'exercices': 'Série d\'Exercices Écrits d\'application',
  'devoir-complet': 'Devoir Complet d\'examen officiel',
  'devoir': 'Devoir Complet d\'examen officiel',
  'infographie': 'Infographie pédagogique visuelle',
};

// Suggestions de prompts avec sujets concrets selon le format demandé
function getSuggestedPromptsForFormat(formatType: string): string[] {
  const norm = (formatType || '').toLowerCase().replace(/_/g, '-');
  if (norm.includes('carte-mentale-2') || norm.includes('mindmap2')) {
    return [
      'Carte Mentale 2 sur les Fonctions et Dérivées en Mathématiques',
      'Carte Mentale 2 sur l\'Architecture des Systèmes Informatiques',
      'Carte Mentale 2 sur les Réactions d\'Oxydoréduction en Chimie',
      'Carte Mentale 2 sur les Structures de Données et Graphes'
    ];
  }
  if (norm.includes('carte-mentale') || norm.includes('mindmap')) {
    return [
      'Carte Mentale sur les Fonctions et Dérivées en Mathématiques',
      'Carte Mentale sur les Réactions d\'Oxydoréduction en Chimie',
      'Carte Mentale sur la Mitose et la Méiose en Biologie SVT',
      'Carte Mentale sur les Structures de Données et Algorithmes en Informatique'
    ];
  }
  if (norm.includes('carte-memoire') || norm.includes('flashcard')) {
    return [
      'Cartes Mémoires sur les Formules de Trigonométrie et Dérivées',
      'Cartes Mémoires sur le Vocabulaire Anglais du Monde du Travail',
      'Cartes Mémoires sur les Définitions Fondamentales du Droit Constitutionnel',
      'Cartes Mémoires sur la Photosynthèse et la Respiration Cellulaire'
    ];
  }
  if (norm.includes('resume')) {
    return [
      'Fiche de Résumé sur la Thermodynamique et les Transferts Thermiques',
      'Fiche de Résumé sur les Espaces Vectoriels et Matrices en Algèbre',
      'Fiche de Résumé sur les Notions Clés de la Microéconomie',
      'Fiche de Résumé sur l\'Architecture des Processeurs et Mémoires'
    ];
  }
  if (norm.includes('pdf')) {
    return [
      'Document PDF complet sur le Calcul Intégral et Équations Différentielles',
      'Document PDF sur les Principes de la Mécanique Newtonienne',
      'Document PDF sur la Programmation Orientée Objet en Python',
      'Document PDF sur les Institutions de la Ve République'
    ];
  }
  if (norm.includes('vrai-ou-faux-test') || norm.includes('vf-test')) {
    return [
      'Vrai ou Faux Test noté sur les Nombres Complexes et Trigonométrie',
      'Vrai ou Faux Test sur la Génétique et l\'ADN en SVT',
      'Vrai ou Faux Test sur les Lois de Newton et Énergie Mécanique',
      'Vrai ou Faux Test sur les Circuits Électriques et Théorèmes de Kirchhoff'
    ];
  }
  if (norm.includes('vrai-ou-faux')) {
    return [
      'Vrai ou Faux sur les Nombres Complexes et Géométrie dans le Plan',
      'Vrai ou Faux sur la Génétique et les Lois de Mendel en SVT',
      'Vrai ou Faux sur les Circuits Électriques et Théorème de Millman',
      'Vrai ou Faux sur la Programmation et Complexité Algorithmique'
    ];
  }
  if (norm.includes('exercice')) {
    return [
      'Exercices Écrits corrigés sur les Équations Différentielles du 1er et 2nd ordre',
      'Exercices Écrits sur la Cinématique et Mouvement Rectiligne Uniforme',
      'Exercices Écrits sur les Suites Numériques et Récurrence',
      'Exercices Écrits sur les Arbres Binaires et Parcours en Informatique'
    ];
  }
  if (norm.includes('devoir') || norm.includes('examen')) {
    return [
      'Devoir Complet d\'examen sur les Amplificateurs Opérationnels (AOP en régime linéaire)',
      'Devoir Complet sur les Probabilités, Variables Aléatoires et Lois de Densité',
      'Devoir Complet sur l\'Optique Géométrique et Lentilles Minces',
      'Devoir Complet sur les Bases de Données et Requêtes SQL Avancées'
    ];
  }
  if (norm.includes('infographie')) {
    return [
      'Infographie sur le Cycle Cellulaire et les Phases de la Mitose',
      'Infographie sur le Spectre Électromagnétique et Longueurs d\'Onde',
      'Infographie sur la Chronologie de la Construction Européenne',
      'Infographie sur le Modèle OSI et Protocoles Réseaux'
    ];
  }
  if (norm.includes('test') || norm.includes('questionnaire-test')) {
    return [
      'Questionnaire Test noté sur les Dérivées et Études de Fonctions',
      'Questionnaire Test noté sur les Principes Fondamentaux de la Thermodynamique',
      'Questionnaire Test avec chronomètre sur les Lois de Newton',
      'Questionnaire Test noté sur les Algorithmes de Tri et Recherche'
    ];
  }
  return [
    'Questionnaire QCM sur les Lois de Newton et l\'Énergie Mécanique',
    'Questionnaire QCM sur les Équations du Second Degré en Mathématiques',
    'Questionnaire QCM sur la Révolution Industrielle et Société au XIXe siècle',
    'Questionnaire QCM sur les Listes et Dictionnaires en Python'
  ];
}

// Détection du format de création demandé
function detectCreationFormat(userText: string, requestedType?: string): string | null {
  if (requestedType && typeof requestedType === 'string' && requestedType.trim()) {
    return requestedType.trim().toLowerCase();
  }
  if (!userText || typeof userText !== 'string') return null;
  const t = userText.trim().toLowerCase();

  // Test noté / Questionnaire Test
  if (/(?:questionnaire\s+test|test\s+not[eé]|test\s+chrono|[eé]preuve\s+not[eé]e)/i.test(t)) {
    return 'questionnaire-test';
  }
  if (/(?:questionnaire\s+quiz|quiz\s+qcm|questionnaire\s+qcm|faire\s+un\s+quiz|fais-moi\s+un\s+quiz|cr[eé]e\s+un\s+quiz|un\s+quiz|le\s+quiz|un\s+qcm|le\s+qcm|des\s+qcm|questionnaire)/i.test(t)) {
    if (t.includes('test') || t.includes('noté') || t.includes('chrono')) return 'questionnaire-test';
    return 'questionnaire';
  }
  // Vrai ou Faux Test vs Vrai ou Faux
  if (/(?:vrai\s+ou\s+faux\s+test|vrai\/faux\s+test|vf\s+test|[eé]preuve\s+vrai\s+ou\s+faux)/i.test(t)) {
    return 'vrai-ou-faux-test';
  }
  if (/(?:vrai\s+ou\s+faux|vrai\/faux)/i.test(t)) {
    return 'vrai-ou-faux';
  }
  // Carte Mentale 2 vs Carte Mentale
  if (/(?:carte\s+mentale\s+2|mindmap\s*2|carte\s+conceptuelle)/i.test(t)) {
    return 'carte-mentale-2';
  }
  if (/(?:carte\s+mentale|mindmap|arborescence)/i.test(t)) {
    return 'carte-mentale';
  }
  if (/(?:carte\s+m[eé]moire|cartes\s+m[eé]moires|flashcard|flashcards)/i.test(t)) {
    return 'carte-memoire';
  }
  if (/(?:fiche\s+de\s+r[eé]sum[eé]|r[eé]sum[eé]|synth[eè]se|fiche\s+de\s+synth[eè]se)/i.test(t)) {
    return 'resume';
  }
  if (/(?:document\s+pdf|polycopi[eé]|polycopie|g[eé]n[eé]rer\s+un\s+pdf|cr[eé]er\s+un\s+pdf|faire\s+un\s+pdf)/i.test(t)) {
    return 'pdf';
  }
  if (/(?:devoir\s+complet|sujet\s+d['’]examen|[eé]preuve\s+d['’]examen|devoir\s+d['’]examen)/i.test(t)) {
    return 'devoir-complet';
  }
  if (/(?:exercices?\s+[eé]crits?|exercices?\s+d['’]application|s[eé]rie\s+d['’]exercices)/i.test(t)) {
    return 'exercices-ecrits';
  }
  if (/(?:infographie|fiche\s+visuelle)/i.test(t)) {
    return 'infographie';
  }

  return null;
}

// Détection si le prompt utilisateur spécifie un vrai sujet d'étude
function detectHasSpecificSubject(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();

  // Phrases des 10 cartes de RightMenu quand aucun document n'est ouvert
  const genericPhrases = [
    'pour tester mes connaissances',
    'des concepts fondamentaux avec branches hiérarchiques',
    'pour réviser et mémoriser les notions clés',
    'avec vue d\'ensemble, points clés, définitions',
    'avec sections, titres et contenu approfondi',
    'avec justifications détaillées et pièges fréquents',
    'avec énoncé pas à pas et correction guidée',
    'avec plusieurs parties, barème de points et corrigé',
    'avec repères visuels, chiffres clés, métriques',
    'pour évaluer mes acquis en conditions réelles',
  ];
  for (const gp of genericPhrases) {
    if (t.toLowerCase().includes(gp.toLowerCase())) {
      const m = t.match(/sur\s+«\s*([^»]+)\s*»/i);
      if (m && m[1]?.trim().length > 1) return true;
      return false;
    }
  }

  // Phrases courtes purement génériques ("fais un quiz", etc.)
  const shortGeneric = /^(?:bonjour\s*,?\s*)?(?:s['’]il\s+te\s+pla[îi]t\s*,?\s*)?(?:peux-tu\s+|pourrais-tu\s+|je\s+veux\s+|je\s+voudrais\s+|fais(?:-moi)?\s+|fais\s+|faire\s+|cr[eé]er?\s+|g[eé]n[eé]rer?\s+|conçois\s+|donne-moi\s+|pr[eé]pare\s+|bâtis\s+)?(?:un|une|des)?\s*(?:questionnaire|quiz|qcm|carte\s+mentale|mindmap|cartes?\s+m[eé]moires?|flashcards?|r[eé]sum[eé]|fiche(?:\s+de\s+r[eé]sum[eé])?|document\s+pdf|pdf|polycopi[eé]|vrai\s+ou\s+faux|exercices?(?:\s+[eé]crits?)?|devoir(?:\s+complet)?|examen|infographie|test(?:\s+not[eé])?)\s*(?:s['’]il\s+te\s+pla[îi]t|svp|stp|maintenant|rapide|interactif)?\s*[.!?]?$/i;
  if (shortGeneric.test(t)) {
    return false;
  }

  // Détection de "sur [matière/chapitre]" ou "concernant [notion]" ou "à propos de [notion]"
  const subjectIntro = /\b(?:sur|concernant|portant\s+sur|à\s+propos\s+de|en|d['’]|de)\s+([a-zA-ZÀ-ÿ0-9\s'’-]{3,})/i;
  const match = t.match(subjectIntro);
  if (match) {
    const candidate = match[1].trim().toLowerCase();
    const vaguePhrases = ['mes cours', 'mes connaissances', 'ce cours', 'ce document', 'mon cours', 'mon document', 'la matière', 'mon examen', 'ceci', 'cela', 'ça', 'tout', 'un sujet', 'n\'importe quoi', 'mon niveau'];
    if (!vaguePhrases.includes(candidate) && candidate.length >= 3) {
      return true;
    }
  }

  // Présence de vocabulaire disciplinaire
  const academicTerms = /(math|physique|chimie|svt|biologie|histoire|g[eé]o|droit|économie|gestion|informatique|python|algorithme|code|philosophie|fran[çc]ais|anglais|espagnol|litt[eé]rature|m[eé]canique|optique|thermo|quantique|cellule|mitose|adn|r[eé]action|mol[eé]cule|atome|fonction|d[eé]riv[eé]|int[eé]gral|matrice|vecteur|th[eé]or[eè]me|loi|article|constitution|programme|base\s+de\s+donn[eé]es|sql|r[eé]seau|circuit|aop|courant|tension)/i;
  if (t.length > 30 && academicTerms.test(t)) {
    return true;
  }

  return false;
}

// Détection si la discussion récente porte sur un vrai sujet d'étude
function hasRecentAcademicContext(messages: Array<{ sender: string; text: string }>): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const recent = messages.slice(-6);
  for (const m of recent) {
    const text = (m.text || '').trim();
    if (text.length < 25) continue;
    if (/^(bonjour|salut|hello|coucou|merci|de rien|au revoir|comment vas-tu|qui es-tu)/i.test(text) && text.length < 50) {
      continue;
    }
    if (text.includes('$') || text.includes('\\') || text.length > 70) {
      return true;
    }
    if (/(math|physique|chimie|svt|biologie|histoire|droit|économie|informatique|algorithme|cours|chapitre|formule|exercice|problème|théorème)/i.test(text)) {
      return true;
    }
  }
  return false;
}

function extractSuggestedQuestions(content: string): { cleanText: string; questions: string[] } {
  const questions: string[] = [];
  let cleanText = content;

  const markerRegex = /(?:\[QUESTIONS_SUGG[EÉ]R[EÉ]ES\]|###\s*(?:Questions|Pistes)\s*(?:d['’]approfondissement|sugg[eé]r[eé]es|de\s*r[eé]flexion))([\s\S]*?)$/i;
  const match = cleanText.match(markerRegex);

  if (match) {
    const questionsBlock = match[1];
    cleanText = cleanText.replace(markerRegex, '').trim();

    const qLines = questionsBlock.split('\n');
    for (const line of qLines) {
      const qClean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
      if (qClean && qClean.length > 5 && !qClean.toLowerCase().startsWith('cliquez') && !qClean.toLowerCase().startsWith('vous pouvez')) {
        questions.push(qClean);
      }
    }
  }

  return { cleanText, questions };
}

function SvgDiagramCard({ svgContent }: { svgContent: string; key?: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(svgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schema_studycloud_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Erreur téléchargement SVG:', e);
    }
  };

  return (
    <div className="my-4 rounded-2xl bg-[#0f1118] border border-orange-500/35 shadow-xl overflow-hidden w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#171922] border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-orange-400" />
          <span className="font-bold text-white tracking-wide">Schéma technique & Illustration</span>
          <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-semibold text-[10px]">
            Dessiné par l'IA
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Copier le code SVG"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Télécharger l'image vectorielle SVG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div 
        className="p-4 sm:p-6 overflow-x-auto custom-scrollbar flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}

const ChatMessageText = ({ 
  text, 
  isUser, 
  isStreaming,
  onSelectSuggestion 
}: { 
  text: string; 
  isUser: boolean; 
  isStreaming?: boolean;
  onSelectSuggestion?: (question: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  const maxUserPromptLength = 350;
  const isLongUserMsg = isUser && text.length > maxUserPromptLength;
  const displayText = isLongUserMsg && !expanded ? text.slice(0, maxUserPromptLength) + '...' : text;

  if (isUser) {
    return (
      <div className="flex flex-col w-full items-end select-text chat-selectable cursor-text">
        <p className="whitespace-pre-wrap break-words text-left w-full select-text chat-selectable cursor-text">
          {displayText}
        </p>
        {isLongUserMsg && (
          <button 
            type="button"
            onClick={() => setExpanded(!expanded)} 
            className="mt-1.5 text-[10px] font-bold underline transition-colors cursor-pointer text-orange-200 hover:text-white"
          >
            {expanded ? 'Masquer' : 'Démasquer'}
          </button>
        )}
      </div>
    );
  }

  // 1. Extraction préalable des questions suggérées et des blocs SVG
  const { textWithoutQuestions, suggestedQuestions } = useMemo(() => {
    if (isUser || !displayText) return { textWithoutQuestions: displayText, suggestedQuestions: [] };
    const res = extractSuggestedQuestions(displayText);
    return { textWithoutQuestions: res.cleanText, suggestedQuestions: res.questions };
  }, [displayText, isUser]);

  const { textWithoutSvg, svgBlocks } = useMemo(() => {
    if (isUser || !textWithoutQuestions) return { textWithoutSvg: textWithoutQuestions, svgBlocks: [] };
    const res = extractSvgBlocks(textWithoutQuestions);
    return { textWithoutSvg: res.cleanText, svgBlocks: res.svgBlocks };
  }, [textWithoutQuestions, isUser]);

  // 2. Normalisation préalable pour KaTeX et nettoyage des résidus JSON
  const normalizedDisplayText = useMemo(() => {
    if (!textWithoutSvg) return '';
    let cleaned = textWithoutSvg;
    if (!isUser) {
      cleaned = stripAiReasoningScratchpad(cleaned);
      if (cleaned.includes('"decision"') || cleaned.includes('"creation_data"')) {
        cleaned = cleanChatText(cleaned);
        if (!cleaned) {
          cleaned = "✨ Votre création a été générée avec succès dans le volet Création à droite.";
        }
      }
    }
    cleaned = cleaned
      .replace(/\${3,}/g, '$$')
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

    // Isoler TOUJOURS les équations en bloc $$ ... $$ sur leur propre ligne avec sauts doubles
    // pour garantir un rendu aéré, clair et lisible sans jamais se coller au texte
    cleaned = cleaned.replace(/\$\$([\s\S]*?)\$\$/g, (_match, eq) => {
      const cleanEq = eq.replace(/\r?\n/g, ' ').trim();
      return `\n\n$$${cleanEq}$$\n\n`;
    });

    // Aérer et décoller les étapes de calculs collées sur une même ligne
    if (!isUser) {
      cleaned = cleaned
        .replace(/([.;?!])\s*(\b(?:Num[eé]rateur|D[eé]nominateur|Numerator|Denominator|Ratio|Posons|Soit|On a|En rempla[çc]ant|D'o[ùu]|Par cons[eé]quent|Pour la question|Question \d+|[EÉ]tape \d+)\b)/gi, '$1\n\n$2')
        .replace(/([.;])\s*(Noeud\s+[A-Z0-9]+|L'équation|Equation|Soit\b|Or\b|Donc\b|On a\b|En substituant|A substituer|D'après)\b/gi, '$1\n\n$2')
        .replace(/(?<!\n)\s*(=>|\\Rightarrow|⟹)\s*/g, '\n\n$1 ')
        .replace(/\n{3,}/g, '\n\n');
    }

    return cleaned;
  }, [textWithoutSvg, isUser]);

  const lines = normalizedDisplayText.split('\n');

  return (
    <div className="flex flex-col w-full items-start select-text chat-selectable cursor-text">
      <div className="space-y-2 text-zinc-100 text-left w-full leading-[1.8] font-normal text-[15px] sm:text-[16px] md:text-[17px] [&_.katex]:text-[1.12em] [&_.katex-display]:text-[1.25em] select-text chat-selectable cursor-text">
        {lines.map((line, idx) => {
          const isLastLine = idx === lines.length - 1;
          const trimmed = line.trim();

          // Espacement aéré pour les lignes vides (évite que tout soit groupé)
          if (!trimmed) {
            return <div key={idx} className="h-3.5 sm:h-4 w-full" aria-hidden="true" />;
          }

          // Détection d'un bloc SVG à insérer
          const svgTokenMatch = trimmed.match(/^__STUDYCLOUD_SVG_BLOCK_(\d+)__$/);
          if (svgTokenMatch) {
            const svgIndex = parseInt(svgTokenMatch[1], 10);
            if (svgBlocks[svgIndex]) {
              return <SvgDiagramCard key={idx} svgContent={svgBlocks[svgIndex]} />;
            }
            return null;
          }

          // Détection d'une carte de recommandation interactive (ex: Recommandé : flashcards)
          const recoMatch = trimmed.match(/^(?:\[?💡?\s*Recommand[ée]\s*:\s*([a-zA-ZÀ-ÿ\s]+)\]?)/i);
          if (recoMatch) {
            return <ChatRecommendationCard key={idx} recoType={recoMatch[1]} />;
          }

          // Grand Titre principal (H1) avec dégradé et icône lumineuse
          if (trimmed.startsWith('# ')) {
            return (
              <div key={idx} className="pt-5 pb-2.5 mt-3 mb-2 border-b border-orange-500/25 w-full">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 flex items-center gap-2.5">
                  <span className="p-1 rounded-lg bg-orange-500/10 text-orange-400 text-sm">✦</span>
                  <MathText text={trimmed.slice(2)} inline={true} />
                </h1>
              </div>
            );
          }

          // Titre de section ou question (H2) avec bande latérale orange
          if (trimmed.startsWith('## ')) {
            return (
              <div key={idx} className="pt-4 pb-2 mt-3 mb-1.5 w-full">
                <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2.5 border-l-4 border-orange-500 pl-3 py-1 bg-gradient-to-r from-orange-500/10 to-transparent rounded-r-xl">
                  <MathText text={trimmed.slice(3)} inline={true} />
                </h2>
              </div>
            );
          }

          // Sous-titre (H3)
          if (trimmed.startsWith('### ')) {
            return (
              <div key={idx} className="pt-2.5 pb-1 mt-2 mb-1 w-full">
                <h3 className="text-base font-bold text-amber-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  <MathText text={trimmed.slice(4)} inline={true} />
                </h3>
              </div>
            );
          }

          // Commentaires & Remarques (ne doivent JAMAIS être confondus avec des explications ou calculs)
          const commentMatch = trimmed.match(/^(?:>\s*)?(?:\*\*)?(Remarque|Note|Astuce|Attention|Observation|Conseil|Point clé|Rappel)(?:\s+[^:]*?)?(?:\*\*)?\s*[:.-]\s*(.*)$/i) || (trimmed.startsWith('> ') ? [null, 'Remarque', trimmed.slice(2).trim()] : null);
          if (commentMatch) {
            const commentLabel = commentMatch[1] || 'Remarque méthodologique';
            const commentBody = commentMatch[2] || '';
            return (
              <div key={idx} className="my-3 p-3.5 sm:p-4 rounded-2xl bg-sky-950/25 border-l-4 border-sky-400 text-sky-100 shadow-sm w-full">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-sky-300">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="uppercase tracking-wider">{commentLabel}</span>
                </div>
                <div className="text-[14px] sm:text-[15px] md:text-[16px] text-sky-100/90 leading-relaxed font-normal italic">
                  <MathText text={commentBody} inline={true} />
                </div>
              </div>
            );
          }

          // Détection d'une Question, Étape ou Exercice -> Carte stylée avec badge
          const stepMatch = trimmed.match(/^(Question\s*\d+|[EÉ]tape\s*\d+|Exercice\s*\d+|Partie\s*[A-Z0-9]+)\s*[:.-]?\s*(.*)$/i);
          if (stepMatch) {
            return (
              <div key={idx} className="my-3 p-3.5 rounded-xl bg-[#1a1c26] border border-orange-500/30 shadow-md w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-orange-500 text-black shadow-sm">
                    {stepMatch[1]}
                  </span>
                </div>
                {stepMatch[2] ? (
                  <div className="text-sm sm:text-base font-semibold text-zinc-100 mt-1">
                    <MathText text={stepMatch[2]} inline={true} />
                  </div>
                ) : null}
              </div>
            );
          }

          // Formule bloc isolée ($$ ... $$) -> Encadré mathématique dédié centré
          if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
            return (
              <div key={idx} className="my-3.5 py-3.5 px-4 rounded-2xl bg-[#13151f] border border-zinc-700/60 shadow-inner text-center overflow-x-auto custom-scrollbar w-full">
                <MathText text={trimmed} inline={false} />
              </div>
            );
          }

          // Mise en valeur des conclusions ou déductions (Donc :, Conclusion :, etc.)
          if (/^(Donc|Conclusion|Résultat final|On en déduit|En conclusion)\s*[:.-]/i.test(trimmed)) {
            return (
              <div key={idx} className="my-2.5 p-3 rounded-xl bg-amber-500/10 border-l-4 border-amber-400 text-zinc-100 font-medium">
                <MathText text={line} inline={true} />
              </div>
            );
          }

          // Alinéas pour sous-questions et étapes indentées (ex: a), b), 1), 2), i.)
          const alineaMatch = trimmed.match(/^(?:([a-zA-Z]|\d+|[ivxIVX]+)\)\s+)(.*)$/);
          if (alineaMatch) {
            return (
              <div key={idx} className="ml-3 sm:ml-7 pl-3.5 border-l-2 border-orange-500/40 my-2.5 bg-white/[0.02] rounded-r-xl py-2 flex items-start gap-2.5 w-full">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold text-xs shrink-0 select-none">
                  {alineaMatch[1]})
                </span>
                <div className="flex-1 text-zinc-100 leading-relaxed text-[15px] sm:text-[16px] md:text-[17px]">
                  <MathText text={alineaMatch[2]} inline={true} />
                </div>
              </div>
            );
          }

          // Puces de listes avec losange doré et espacement aéré
          const bulletMatch = trimmed.match(/^([-*•])\s+(.*)$/);
          if (bulletMatch) {
            return (
              <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2 leading-relaxed">
                <span className="text-orange-400 mt-1 select-none text-xs">◆</span>
                <div className="flex-1">
                  <MathText text={bulletMatch[2]} inline={true} />
                </div>
              </div>
            );
          }

          // Ligne normale avec KaTeX
          return (
            <div key={idx} className="whitespace-pre-wrap break-words leading-relaxed text-zinc-200 select-text chat-selectable cursor-text">
              <MathText text={line} inline={true} />
              {isStreaming && isLastLine && (
                <span className="inline-flex items-center align-middle ml-2 select-none" title="L'IA écrit en temps réel...">
                  <DnaLogo className="w-4 h-4 animate-dna-spin-float text-orange-500 drop-shadow-[0_0_8px_rgba(243,128,32,0.9)]" glow={true} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Propositions de questions sous forme de boutons carrés (décidé par l'IA) */}
      {!isStreaming && suggestedQuestions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-zinc-800/80 w-full animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-300">
              Pistes & Questions d'approfondissement proposées
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
            {suggestedQuestions.map((q, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => onSelectSuggestion?.(q)}
                className="group relative p-4 rounded-2xl bg-[#1b1d25] hover:bg-[#252834] border border-zinc-700/80 hover:border-orange-500/60 shadow-md hover:shadow-orange-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between text-left active:scale-[0.98] min-h-[110px]"
              >
                <div className="flex items-start justify-between gap-2 mb-2 w-full">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-black">
                    {qIdx + 1}
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-white leading-snug my-1 line-clamp-3">
                  <MathText text={q} inline={true} />
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] font-bold text-orange-400/90 group-hover:text-orange-400">
                  <span>Poser cette question</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Générateur de messages d'accueil spontanés et chaleureux envoyés en direct par l'IA
function getSpontaneousAiGreeting(modelName: string, activeDocName?: string | null): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  const timeGreeting = hour >= 5 && hour < 12 ? 'Bonjour !' : hour >= 18 ? 'Bonsoir !' : 'Salut !';

  const friendlyTitles = [
    "Comment vas-tu aujourd'hui ?",
    "On fait quoi aujourd'hui ?",
    "Ravi de te retrouver ! Qu'est-ce qu'on étudie ensemble ?",
    `${timeGreeting} Prêt à progresser aujourd'hui ?`,
    "Comment se passe ta journée d'étude ?",
    "Je suis là pour toi. Sur quoi souhaites-tu travailler ?",
    "Dis-moi tout, sur quel sujet veux-tu avancer ?",
    "Une question, un exercice ou une notion à explorer ?",
    "Prêt pour une bonne session d'apprentissage ?",
    "Hello ! Quel défi académique relève-t-on ensemble ?",
    "Je suis à ton écoute, par quoi commence-t-on ?",
    "Besoin d'un coup de pouce sur tes cours aujourd'hui ?",
    "Je suis prêt ! Qu'aimerais-tu découvrir ou réviser ?"
  ];

  let subtitles: string[] = [];
  if (activeDocName) {
    subtitles = [
      `Je suis prêt à analyser « ${activeDocName} » avec toi.`,
      `On explore « ${activeDocName} » ensemble ? Pose-moi toutes tes questions.`,
      `Pose ta question sur « ${activeDocName} » ou demande un résumé clair.`,
      `Dis-moi ce que tu souhaites comprendre ou approfondir dans « ${activeDocName} ».`
    ];
  } else {
    subtitles = [
      "Pose ta question, colle ton cours ou explore tes documents.",
      "Je t'accompagne pas à pas pour comprendre et réussir tes cours.",
      "Demande-moi des explications, des résumés ou de l'aide sur tes exercices.",
      "Pose n'importe quelle question, avance à ton propre rythme.",
      "Colle un exercice difficile ou une notion floue, on débloque ça ensemble.",
      "Synthèses, fiches de révision ou quiz : dis-moi ce dont tu as besoin."
    ];
  }

  const title = friendlyTitles[Math.floor(Math.random() * friendlyTitles.length)];
  const subtitle = subtitles[Math.floor(Math.random() * subtitles.length)];

  return { title, subtitle };
}

export interface AssistantChatProps {
  onClose: () => void;
  onHasMessagesChange?: (has: boolean) => void;
  activePreviewItem?: any;
  attachedResources?: any[];
  setAttachedResources?: any;
  key?: React.Key;
}

export function AssistantChat({ onClose, onHasMessagesChange, activePreviewItem, attachedResources = [], setAttachedResources }: AssistantChatProps) {
  // Document actif à l'écran (Orange) : prop direct ou rechargement local de secours
  const resolvedActiveItem = activePreviewItem || (() => {
    try {
      const raw = localStorage.getItem('studycloud_active_preview_item');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const resolvedActiveName = resolvedActiveItem?.name || resolvedActiveItem?.title || resolvedActiveItem?.fileName;

  const currentUserId = typeof window !== 'undefined'
    ? (safeGetItem('unifolder_user_id') || safeGetItem('studycloud_user_id') || 'default-user')
    : 'default-user';

  // Session courante (Style Gemini)
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    const saved = safeGetItem('studycloud_current_conversation_id');
    if (saved && !saved.startsWith('creation-')) return saved;
    const newId = 'conv-' + Date.now();
    safeSetItem('studycloud_current_conversation_id', newId);
    return newId;
  });
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string>('Nouvelle discussion');

  // Tiroir Historique Gemini
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const [messages, setMessages] = useState<Message[]>(() => {
    const savedId = safeGetItem('studycloud_current_conversation_id');
    if (savedId && !savedId.startsWith('creation-')) {
      const local = safeGetItem(`studycloud_conv_msgs_${savedId}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaitingServer, setIsWaitingServer] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [aiActivityText, setAiActivityText] = useState<string>('Je réfléchis...');
  const activityTimerRef = useRef<any>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  
  // Barre de propositions collée au clavier
  const [showProposalBar, setShowProposalBar] = useState(true);
  
  // Création active suivie pour modification et itération continue
  const [activeCreation, setActiveCreation] = useState<AiCreation | null>(null);

  // Cache des modèles IA actifs pour éviter tout clignotement / disparition à l'écran
  const getCachedActiveModels = (): Array<{ id: string; name: string; nickname?: string; rawName?: string; provider: string; model_id?: string }> => {
    try {
      const raw = safeGetItem('studycloud_active_ai_models_v2', '');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            name: stripWorkerAi(m.nickname || m.name || m.id),
            nickname: stripWorkerAi(m.nickname || ''),
            rawName: stripWorkerAi(m.rawName || m.name || m.id)
          }));
        }
      }
    } catch (e) {}
    return [];
  };

  // Modèles IA actifs uniquement (aucun modèle désactivé n'apparaît même brièvement)
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; nickname?: string; rawName?: string; provider: string; model_id?: string }>>(() => getCachedActiveModels());
  const [isModelsLoading, setIsModelsLoading] = useState<boolean>(() => getCachedActiveModels().length === 0);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return safeGetItem('studycloud_selected_ai_model', '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  });

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    safeSetItem('studycloud_selected_ai_model', selectedModel);
  }, [selectedModel]);

  // Fermer le dropdown des modèles au clic en dehors
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isModelDropdownOpen]);

  // Chargement dynamique des modèles configurés (seuls les modèles activés sont conservés)
  useEffect(() => {
    StudyCloudAPI.getRobotRougeConfig()
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.models)) {
          // Filtrer strictement les modèles actifs (exclut immédiatement les modèles désactivés)
          const active = res.models.filter((m: any) => m.is_active === 1 || m.is_active === true || m.is_active === '1' || m.enabled === 1 || m.enabled === true);
          if (active.length > 0) {
            const cleaned = active.map((m: any) => {
              let id = m.id || m.model_id;
              if (id === '@cf/meta/llama-3.3-70b-instruct') id = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
              if (id === 'gemini-2.0-flash' || id === 'gemini-2.5-flash') id = 'gemini-3.8-flash';
              
              // Priorité absolue au surnom personnalisé configuré
              const cleanNick = (m.nickname && typeof m.nickname === 'string') ? stripWorkerAi(m.nickname) : '';
              const rawName = stripWorkerAi(m.name || id);
              const displayName = cleanNick.length > 0 ? cleanNick : rawName;

              return {
                id,
                name: displayName,
                rawName: rawName,
                nickname: cleanNick,
                provider: m.provider || 'cloudflare',
                model_id: id,
                api_token: m.api_token,
              };
            });
            setAvailableModels(cleaned);
            safeSetItem('studycloud_active_ai_models_v2', JSON.stringify(cleaned));

            const currentExists = cleaned.some((m: any) => m.id === selectedModel || m.model_id === selectedModel);
            if (!currentExists && res.config?.default_model) {
              let def = res.config.default_model;
              if (def === '@cf/meta/llama-3.3-70b-instruct') def = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
              if (def === 'gemini-2.0-flash' || def === 'gemini-2.5-flash') def = 'gemini-3.8-flash';
              const defExists = cleaned.some((m: any) => m.id === def || m.model_id === def);
              if (defExists) {
                setSelectedModel(def);
              } else if (cleaned[0]) {
                setSelectedModel(cleaned[0].id);
              }
            } else if (!currentExists && cleaned[0]) {
              setSelectedModel(cleaned[0].id);
            }
          } else {
            setAvailableModels([]);
            safeSetItem('studycloud_active_ai_models_v2', JSON.stringify([]));
          }
        }
      })
      .catch((err) => {
        console.warn('[AssistantChat] Erreur chargement modèles IA:', err);
      })
      .finally(() => {
        setIsModelsLoading(false);
      });
  }, []);

  const currentModelDisplay = useMemo(() => {
    const found = availableModels.find(m => m.id === selectedModel || m.model_id === selectedModel);
    if (found) {
      if (found.nickname && found.nickname.trim() !== '') {
        return stripWorkerAi(found.nickname);
      }
      return stripWorkerAi(found.name).replace(/Instruct/i, '').replace(/Google /i, '').trim();
    }
    if (selectedModel.includes('llama')) return 'Llama 3.3 70B';
    if (selectedModel.includes('gemini')) return 'Gemini Flash';
    if (selectedModel.includes('deepseek')) return 'DeepSeek R1';
    if (selectedModel.includes('kimi')) return 'Kimi K2.7 Code';
    if (selectedModel.includes('claude')) return 'Claude 3.5';
    if (selectedModel.includes('gpt')) return 'GPT-4o Mini';
    return stripWorkerAi(selectedModel);
  }, [availableModels, selectedModel]);

  // Message d'accueil spontané et dynamique envoyé de manière instantanée et fluide par l'IA sélectionnée
  const [welcomeGreeting, setWelcomeGreeting] = useState<{ title: string; subtitle: string }>(() =>
    getSpontaneousAiGreeting(currentModelDisplay, resolvedActiveName)
  );
  const [displayedWelcomeTitle, setDisplayedWelcomeTitle] = useState<string>('');
  const [displayedWelcomeSubtitle, setDisplayedWelcomeSubtitle] = useState<string>('');
  const [isTypingWelcome, setIsTypingWelcome] = useState<boolean>(true);
  const welcomeAnimTimeoutRef = useRef<any[]>([]);

  useEffect(() => {
    // Nettoyer toute animation précédente
    welcomeAnimTimeoutRef.current.forEach(clearTimeout);
    welcomeAnimTimeoutRef.current = [];

    // Ne s'active que si la conversation est vide
    if (messages.length > 0) return;

    const newGreeting = getSpontaneousAiGreeting(currentModelDisplay, resolvedActiveName);
    setWelcomeGreeting(newGreeting);
    setDisplayedWelcomeTitle('');
    setDisplayedWelcomeSubtitle('');
    setIsTypingWelcome(true);

    const titleText = newGreeting.title;
    const subtitleText = newGreeting.subtitle;

    // Frappe instantanée et fluide du titre (18ms par caractère)
    for (let i = 1; i <= titleText.length; i++) {
      const t = setTimeout(() => {
        setDisplayedWelcomeTitle(titleText.slice(0, i));
      }, i * 18);
      welcomeAnimTimeoutRef.current.push(t);
    }

    // Le sous-titre commence à s'écrire juste après la fin du titre (12ms par caractère)
    const titleDuration = titleText.length * 18 + 70;
    for (let j = 1; j <= subtitleText.length; j++) {
      const t = setTimeout(() => {
        setDisplayedWelcomeSubtitle(subtitleText.slice(0, j));
        if (j === subtitleText.length) {
          setIsTypingWelcome(false);
        }
      }, titleDuration + j * 12);
      welcomeAnimTimeoutRef.current.push(t);
    }

    return () => {
      welcomeAnimTimeoutRef.current.forEach(clearTimeout);
      welcomeAnimTimeoutRef.current = [];
    };
  }, [selectedModel, currentConversationId, messages.length === 0, resolvedActiveName, currentModelDisplay]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<any>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isScrolledUp = distanceFromBottom > 90;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottomBtn(isScrolledUp);
  };

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      isUserScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Annuler / interrompre immédiatement la tâche IA en cours
  const handleCancelTask = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (activityTimerRef.current) {
      clearInterval(activityTimerRef.current);
      activityTimerRef.current = null;
    }
    setIsWaitingServer(false);
    setIsTyping(false);
    setRetryingMessageId(null);
    window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
      detail: { isLoading: false, isCancelled: true }
    }));
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === 'ai' && last.isStreaming) {
        return prev.map((m, i) => i === prev.length - 1 ? {
          ...m,
          isStreaming: false,
          text: m.text ? `${m.text}\n\n*(Génération interrompue par l'utilisateur)*` : "*(Tâche annulée)*"
        } : m);
      }
      return prev;
    });
  };

  // Sauvegarde ID de session courante (uniquement si ce n'est pas une création directe)
  useEffect(() => {
    if (!currentConversationId.startsWith('creation-')) {
      safeSetItem('studycloud_current_conversation_id', currentConversationId);
    }
  }, [currentConversationId]);

  // Sauvegarde automatique du fil de discussion actif pour reprise immédiate sans perte
  useEffect(() => {
    if (currentConversationId && !currentConversationId.startsWith('creation-') && messages.length > 0) {
      safeSetItem(`studycloud_conv_msgs_${currentConversationId}`, JSON.stringify(messages));
    }
  }, [messages, currentConversationId]);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    // Défilement automatique fluide UNIQUEMENT si l'utilisateur n'a pas délibérément défilé vers le haut
    if (scrollContainerRef.current && !isUserScrolledUpRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isWaitingServer]);

  // Chargement de la liste des conversations (Historique Gemini) depuis Cloudflare D1
  const loadConversations = async () => {
    try {
      const res = await StudyCloudAPI.getAiConversations(currentUserId);
      if (res && res.success && Array.isArray(res.data)) {
        // Filtrer strictement les conversations réelles du chat en éliminant les créations directes
        const filtered = res.data.filter((c: any) => !c.id?.startsWith('creation-') && !c.title?.startsWith('Conçois un '));
        setConversations(filtered);
      }
    } catch (e) {
      // Fallback localStorage
      const local = localStorage.getItem('studycloud_conversations_cache');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            setConversations(parsed.filter((c: any) => !c.id?.startsWith('creation-') && !c.title?.startsWith('Conçois un ')));
          }
        } catch {}
      }
    }
  };

  useEffect(() => {
    loadConversations();
    const handleRestore = () => {
      loadConversations();
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, [currentUserId]);

  // Chargement des messages de la conversation active
  const loadConversationMessages = async (convId: string) => {
    if (!convId || convId.startsWith('creation-')) {
      setMessages([]);
      return;
    }
    // 1. Chargement instantané du cache local (zéro latence)
    const local = safeGetItem(`studycloud_conv_msgs_${convId}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {}
    }

    try {
      // 2. Synchronisation en arrière-plan avec la base Cloudflare D1
      const res = await StudyCloudAPI.getAiConversationMessages(convId);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const loaded: Message[] = res.data.map((row: any) => {
          let attachedFileName = undefined;
          let modelName = undefined;
          if (row.metadata) {
            try {
              const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
              attachedFileName = meta?.attachedFileName;
              modelName = meta?.model;
            } catch {}
          }
          return {
            id: row.id,
            text: row.content,
            sender: row.role === 'user' ? 'user' : 'ai',
            attachedFileName,
            model: modelName || row.model,
            createdAt: row.created_at,
          };
        });
        setMessages(loaded);
        safeSetItem(`studycloud_conv_msgs_${convId}`, JSON.stringify(loaded));
      }

      // Recharger également la dernière création associée à cette conversation si elle vient du chat
      const crRes = await StudyCloudAPI.getAiConversationCreations(convId);
      if (crRes && crRes.success && Array.isArray(crRes.data) && crRes.data.length > 0) {
        const lastCreation = crRes.data[0];
        let contentParsed = lastCreation.content;
        if (typeof contentParsed === 'string') {
          try { contentParsed = JSON.parse(contentParsed); } catch {}
        }
        const restoredCreation: AiCreation = {
          id: lastCreation.id,
          userId: currentUserId,
          toolType: lastCreation.type,
          title: lastCreation.title || 'Création IA',
          content: contentParsed,
          createdAt: lastCreation.created_at,
        };
        setActiveCreation(restoredCreation);
      }
    } catch (e) {
      console.warn('[AssistantChat] Erreur chargement messages:', e);
    }
  };

  useEffect(() => {
    loadConversationMessages(currentConversationId);
  }, [currentConversationId]);

  // Synchronisation avec les créations actives du panneau droit UNIQUEMENT si issues du chat
  useEffect(() => {
    const handleReady = (e: any) => {
      if (e.detail?.creation && e.detail?.isFromChat) {
        setActiveCreation(e.detail.creation);
        StudyCloudAPI.saveAiCreationRecord({
          id: e.detail.creation.id,
          conversationId: currentConversationId,
          type: e.detail.creation.toolType,
          title: e.detail.creation.title,
          content: e.detail.creation.content,
        }).catch(() => {});
      }
    };
    const handleUpdate = (e: any) => {
      if (e.detail?.updatedContent && activeCreation && e.detail?.isFromChat) {
        setActiveCreation(prev => prev ? { ...prev, content: e.detail.updatedContent } : null);
        StudyCloudAPI.saveAiCreationRecord({
          id: activeCreation.id,
          conversationId: currentConversationId,
          type: activeCreation.toolType,
          title: activeCreation.title,
          content: e.detail.updatedContent,
        }).catch(() => {});
      }
    };
    window.addEventListener('ai-creation-ready', handleReady as any);
    window.addEventListener('ai-creation-update', handleUpdate as any);
    return () => {
      window.removeEventListener('ai-creation-ready', handleReady as any);
      window.removeEventListener('ai-creation-update', handleUpdate as any);
    };
  }, [activeCreation, currentConversationId]);

  // Nettoyage des timers d'animation et d'activité
  useEffect(() => {
    if (!isWaitingServer && activityTimerRef.current) {
      clearInterval(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, [isWaitingServer]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    };
  }, []);

  // Création d'une nouvelle session de discussion
  const handleStartNewConversation = () => {
    const newId = 'conv-' + Date.now();
    setCurrentConversationId(newId);
    setCurrentConversationTitle('Nouvelle discussion');
    setMessages([]);
    setActiveCreation(null);
    setRetryingMessageId(null);
    setIsHistoryDrawerOpen(false);
    setShowProposalBar(true);
    safeSetItem('studycloud_current_conversation_id', newId);
    safeLocalStorageRemove(`studycloud_conv_msgs_${newId}`);

    // Initialisation D1
    StudyCloudAPI.createAiConversation({
      id: newId,
      userId: currentUserId,
      title: 'Nouvelle discussion',
    }).catch(() => {});
  };

  // Suppression d'une session
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await StudyCloudAPI.deleteAiConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      safeLocalStorageRemove(`studycloud_conv_msgs_${convId}`);
      if (currentConversationId === convId) {
        handleStartNewConversation();
      }
    } catch (err) {
      console.warn('[AssistantChat] Erreur suppression session:', err);
    }
  };

  const handleReaction = async (messageId: string, reaction: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const next = m.reaction === reaction ? null : reaction;
        return { ...m, reaction: next };
      }
      return m;
    }));

    if (currentUserId) {
      await saveAiReaction({
        userId: currentUserId,
        messageId,
        reaction,
      });
    }
  };

  const handleRemoveAttachment = async (res: any) => {
    setAttachedResources?.((prev: any[]) => prev.filter((r: any) => r.id !== res.id));
    if (currentUserId && res.id) {
      await removeAiAttachment({
        userId: currentUserId,
        fileId: res.id,
        r2Key: res.r2_key || res.r2Key,
      });
    }
  };

  const sendMessage = async (textToSend: string, requestedTypeOverride?: string) => {
    if (!textToSend.trim()) return;

    // Si une tâche IA est déjà en cours, on l'interrompt pour exécuter immédiatement la nouvelle tâche
    if (isTyping || isWaitingServer) {
      handleCancelTask();
    }

    // Réinitialise le défilement pour suivre le nouveau prompt
    isUserScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);

    // Initialisation du contrôleur d'annulation pour cette requête
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const userText = textToSend.trim();
    const newUserMsgId = Date.now().toString();
    const newUserMsg: Message = { id: newUserMsgId, text: userText, sender: 'user' };
    
    // Ajout immédiat du message utilisateur à la liste et au cache local
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    try {
      safeSetItem(`studycloud_conv_msgs_${currentConversationId}`, JSON.stringify(updatedMessages));
    } catch {}
    setInputValue('');
    setIsTyping(true);
    setIsWaitingServer(true);

    // Détection immédiate hors ligne avant envoi réseau
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsWaitingServer(false);
      setIsTyping(false);
      setRetryingMessageId(null);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles).",
        sender: 'ai',
        isStreaming: false,
        isError: true,
        errorType: 'network',
        retryPrompt: userText,
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }

    // 1. Rassemblement et vérification préalable de tous les documents (Actif en Orange + Pièces jointes en Bleu)
    const allDocs: any[] = [];
    const currentActive = resolvedActiveItem;
    if (currentActive && (currentActive.id || currentActive.name || currentActive.title || currentActive.file || currentActive.blob)) {
      allDocs.push({ ...currentActive, isOrangeActive: true });
    }
    if (Array.isArray(attachedResources)) {
      for (const res of attachedResources) {
        if (res) {
          const alreadyIn = allDocs.some(d =>
            (d.id && res.id && d.id === res.id) ||
            (d.name && res.name && d.name === res.name) ||
            (d.title && res.title && d.title === res.title)
          );
          if (!alreadyIn) {
            allDocs.push({ ...res, isOrangeActive: false });
          }
        }
      }
    }

    const hasAttachedDoc = allDocs.length > 0;
    const detectedFormat = detectCreationFormat(userText, requestedTypeOverride);
    const isCreationIntent = Boolean(detectedFormat);
    const hasPromptSubject = detectHasSpecificSubject(userText);
    const hasConversationContext = hasRecentAcademicContext(messages);

    // INTERPELLATION OBLIGATOIRE : Si l'utilisateur demande une création sans document, sans sujet précis et sans contexte de discussion
    const needsSubjectClarification = isCreationIntent && !hasAttachedDoc && !hasPromptSubject && !hasConversationContext;

    if (needsSubjectClarification && detectedFormat) {
      setIsWaitingServer(false);
      setRetryingMessageId(null);
      window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
        detail: { isLoading: false, isCreation: false }
      }));
      window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 1 } }));

      const formatName = CREATION_FORMAT_LABELS[detectedFormat] || 'création interactive';
      const suggestions = getSuggestedPromptsForFormat(detectedFormat);

      const interpellationText = `Pour que je puisse concevoir votre **${formatName}**, vous devez d'abord m'indiquer précisément sur quoi elle doit porter !

Je ne peux pas concevoir de support d'étude « dans le vide » sans sujet ni document d'appui.

👉 **Pour m'indiquer votre sujet, vous pouvez :**
1. **Écrire directement le thème ou chapitre** dans votre message (par exemple : *« Sur les fonctions dérivées en maths »*, *« Sur la Seconde Guerre Mondiale »*, *« Sur les réactions d'oxydoréduction »*...).
2. Ou **joindre votre fichier de cours** (document PDF, Word, fiche ou photo d'exercice) en cliquant sur le trombone 📎 d'importation en bas.

---
Voici quelques exemples concrets sur lesquels vous pouvez lancer votre création immédiatement en un clic :

[QUESTIONS_SUGGÉRÉES]
${suggestions.map(s => `- ${s}`).join('\n')}`;

      // Animation machine à écrire pour l'interpellation
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        isStreaming: true,
        model: currentModelDisplay,
        isPowerMode: false,
      };
      setMessages(prev => [...prev, initialAiMsg]);

      try {
        safeSetItem(`studycloud_conv_msgs_${currentConversationId}`, JSON.stringify([...updatedMessages, { ...initialAiMsg, text: interpellationText, isStreaming: false, model: currentModelDisplay }]));
      } catch {}

      let index = 0;
      const chunkSize = 4;
      const tickSpeed = 16;
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);

      typingTimerRef.current = setInterval(() => {
        index += chunkSize;
        if (index >= interpellationText.length) {
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId ? { ...m, text: interpellationText, isStreaming: false, model: currentModelDisplay } : m
            )
          );
          setIsTyping(false);
          StudyCloudAPI.saveAiMessage({
            id: aiMsgId,
            conversationId: currentConversationId,
            role: 'assistant',
            content: interpellationText,
            metadata: { model: currentModelDisplay }
          }).catch(() => {});
        } else {
          const partial = interpellationText.slice(0, index);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId ? { ...m, text: partial, model: currentModelDisplay } : m
            )
          );
        }

        if (scrollContainerRef.current && !isUserScrolledUpRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, tickSpeed);

      return;
    }

    // Initialisation du statut dynamique à l'instant T (avec confirmation d'un document ou d'un sujet)
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    const startTimestamp = Date.now();
    const activeDocName = resolvedActiveItem?.name || resolvedActiveItem?.title || '';
    const initialDocNames: string[] = activeDocName ? [activeDocName] : [];
    if (Array.isArray(attachedResources)) {
      for (const r of attachedResources) {
        if (r?.name && !initialDocNames.includes(r.name)) initialDocNames.push(r.name);
      }
    }
    const effectiveRequestedType = requestedTypeOverride || (isCreationIntent ? (detectedFormat as any) : undefined);
    const isExplicitCreationRequest = Boolean(effectiveRequestedType);
    const initialLiveStatus = getLiveAiActivity(userText, initialDocNames, 0, effectiveRequestedType);
    setAiActivityText(initialLiveStatus);
    if (isExplicitCreationRequest) {
      window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
        detail: { statusText: initialLiveStatus, isLoading: true, isCreation: true, prompt: userText, toolType: effectiveRequestedType }
      }));
    }
    activityTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const liveStatus = getLiveAiActivity(userText, initialDocNames, elapsed, effectiveRequestedType);
      setAiActivityText(liveStatus);
      if (isExplicitCreationRequest) {
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
          detail: { statusText: liveStatus, isLoading: true, isCreation: true, prompt: userText, toolType: effectiveRequestedType }
        }));
      }
    }, 1000);

    // Mise à jour du titre de conversation si c'est le 1er message
    if (messages.length === 0) {
      const generatedTitle = userText.slice(0, 38).trim() + (userText.length > 38 ? '...' : '');
      setCurrentConversationTitle(generatedTitle);
      StudyCloudAPI.createAiConversation({
        id: currentConversationId,
        userId: currentUserId,
        title: generatedTitle,
      }).then(() => loadConversations()).catch(() => {});
    }

    try {
      const targetDocs = allDocs.slice(0, 3);
      const docNames: string[] = [];
      const docIds: string[] = [];
      const docR2Keys: string[] = [];
      const docContents: string[] = [];

      if (targetDocs.length > 0) {
        try {
          setIsExtractingDoc(true);
          for (let i = 0; i < targetDocs.length; i++) {
            const doc = targetDocs[i];
            const name = doc.name || doc.title || `Document_${i + 1}`;
            docNames.push(name);
            if (doc.id) docIds.push(doc.id);
            const r2 = doc.r2_key || doc.r2Key;
            if (r2) docR2Keys.push(r2);

            try {
              const text = await extractDocumentText(doc);
              if (text && text.trim()) {
                const tag = doc.isOrangeActive ? "Document actif à l'écran (Orange)" : `Document joint (${i + 1}) (Bleu)`;
                docContents.push(`=== DOCUMENT [${i + 1}/${targetDocs.length}] : "${name}" (${tag}) ===\n${text.trim()}\n=== FIN DE "${name}" ===`);
              }
            } catch (err) {
              console.warn('[AssistantChat] Erreur extraction document:', name, err);
            }
          }
        } finally {
          setIsExtractingDoc(false);
        }
      }

      const attachedFileContent = docContents.join('\n\n');
      const attachedFileName = docNames.join(', ');
      const attachedFileId = docIds.join(',');
      const attachedFileR2Key = docR2Keys.join(',');
      const mainDocName = docNames[0] || activePreviewItem?.name || 'Document d\'étude';
      const attachedImageBase64 = targetDocs.find(d => d.imageBase64)?.imageBase64 || activePreviewItem?.imageBase64 || '';
      const attachedAudioBase64 = targetDocs.find(d => d.audioBase64)?.audioBase64 || activePreviewItem?.audioBase64 || '';

      // Sauvegarde immédiate Cloudflare D1 du message utilisateur
      StudyCloudAPI.saveAiMessage({
        id: newUserMsgId,
        conversationId: currentConversationId,
        role: 'user',
        content: userText,
        metadata: { attachedFileName: attachedFileName || undefined, model: selectedModel }
      }).catch(() => {});

      // 2. ANALYSE D'HÉSITATION ÉTUDIANTE (Suggestions d'aide douce)
      const isHesitating = /(je ne sais pas|que (peux|doit|puis)-tu|propose|id[eé]es|aide-moi à (choisir|r[eé]viser)|quelles options|que me conseilles-tu|conseille-moi|que faire)/i.test(userText);
      if (isHesitating) {
        setShowProposalBar(true);
      }

      // AUCUN mot clé client ne déclenche ou n'intercepte la discussion.
      // Le prompt de l'utilisateur va DIRECTEMENT à l'IA sans rien déranger.
      // Seul un clic explicite sur un bouton d'action (override) définit explicitToolType.
      const isExplicitOverride = Boolean(requestedTypeOverride);
      const explicitToolType = requestedTypeOverride as AiCreationType | undefined;

      if (isExplicitOverride && explicitToolType) {
        const creationTitle = `${explicitToolType.toUpperCase()} : ${mainDocName}`;
        window.dispatchEvent(new CustomEvent('ai-creation-start', {
          detail: { toolType: explicitToolType, title: creationTitle, sourceFileName: mainDocName }
        }));
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
      }

      // 3. Contexte du document actif et prompt autonome de décision (Architecture Gemini / StudyCloud)
      let systemContent = `Tu es l'intelligence pédagogique centrale autonome de StudyCloud (Gemini / Delmas IA).
Tu es directement connectée à l'espace d'étude de l'étudiant, avec deux modes de fonctionnement distincts selon ton analyse du prompt :

1. BRANCHE DISCUSSION SIMPLE DANS LE CHAT (Mode par défaut) :
Si l'étudiant discute, échange, pose une question, demande une explication de cours, une démonstration, une formule, une méthode ou un exemple — MÊME s'il emploie des termes comme "créer", "faire", "questions" dans un sens conversationnel (ex: "Comment créer une SARL ?", "Quelles questions penses-tu qu'on aura à l'examen ?", "Explique-moi comment faire cet exercice", "Que penses-tu de ce sujet ?") :
-> Tu réponds DIRECTEMENT ET NATURELLEMENT DANS LE CHAT en texte Markdown fluide.
-> Formules mathématiques et scientifiques rédigées impérativement en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc).
-> IMPORTANTISSIME : NE PRODUIS AUCUN CODE JSON, PAS D'ACCOLADES {} NI DE BALISES JSON DANS CETTE RÉPONSE. Parle directement à l'étudiant avec pédagogie, clarté et bienveillance.

2. BRANCHE CRÉATION D'UN MODULE D'ÉTUDE (Dans l'espace création à droite) :
Uniquement si l'étudiant te demande expressément et clairement de CONCEVOIR / FABRIQUER / GÉNÉRER un module d'apprentissage interactif complet parmi les 12 formats officiels StudyCloud :
- Questionnaires et Tests :
  * 'questionnaire' : Quiz QCM interactif avec feedback immédiat (questions avec choix A/B/C/D, correctIndex, explanation)
  * 'questionnaire-test' : Questionnaire Test (épreuve notée avec chronomètre et barème, résultats et corrigé à la fin)
- Vrai ou Faux :
  * 'vrai-ou-faux' : Affirmations Vrai ou Faux avec justification détaillée immédiate
  * 'vrai-ou-faux-test' : Vrai ou Faux Test (épreuve notée avec validation d'ensemble et score final)
- Cartes Mentales et Conceptuelles :
  * 'carte-mentale' : Carte Mentale arborescente (thème central, branches principales, sous-branches)
  * 'carte-mentale-2' : Carte Mentale 2 (carte conceptuelle en blocs hiérarchiques avec piliers et connecteurs)
- Cartes Mémoires :
  * 'carte-memoire' : Flashcards mémorisation (recto question/concept, verso réponse/détail)
- Documents et Fiches de Synthèse :
  * 'resume' : Fiche de Résumé structurée (overview, keyPoints, definitions, rules)
  * 'pdf' : Polycopié ou Document PDF d'étude officiel (title, sections, content)
  * 'infographie' : Infographie visuelle (chiffres clés, métriques, repères visuels, chronologie)
- Exercices et Examens :
  * 'exercices-ecrits' : Série d'exercices d'application avec énoncé pas à pas et correction guidée
  * 'devoir-complet' : Devoir Complet officiel d'examen avec parties, barème sur 20 points et corrigé

DANS CE CAS DE CRÉATION EXCLUSIVEMENT :
Tu réponds sous la forme d'un objet JSON strict :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "questionnaire" | "questionnaire-test" | "vrai-ou-faux" | "vrai-ou-faux-test" | "carte-mentale" | "carte-mentale-2" | "carte-memoire" | "resume" | "pdf" | "infographie" | "exercices-ecrits" | "devoir-complet",
  "creation_title": "Titre explicite de la création",
  "chat_response": "Court message amical d'une phrase pour le fil de discussion (ex: J'ai conçu votre création dans l'espace Création à droite !)",
  "creation_data": {
    // Les données complètes selon le type demandé
  }
}
\`\`\`

RÈGLES D'EXCELLENCE POUR LA MISE EN PAGE, LES TITRES ET LES FRACTIONS :
0. LANGUE FRANÇAISE STRICTE ET ZÉRO MONOLOGUE INTERNE (ANTI-SCRATCHPAD) :
   - TU RÉPONDS EXCLUSIVEMENT ET TOTALEMENT EN FRANÇAIS SOIGNÉ, CLAIR ET PÉDAGOGIQUE.
   - IL EST STRICTEMENT INTERDIT D'ÉCRIRE EN ANGLAIS ET D'AFFICHER UN MONOLOGUE DE RÉFLEXION INTERNE, DU BRAINSTORMING OU UN BROUILLON ('Let's think', 'Waitcheck', 'The figure caption text', 'Hmm', 'Actually', etc.).
   - NE DIVAGUE PAS. DONNE DIRECTEMENT LA RÉPONSE PÉDAGOGIQUE COMPLÈTE ET STRUCTURÉE POUR L'ÉTUDIANT.
   - AÈRE AU MAXIMUM : GRANDS TITRES (#, ##, ###), DOUBLES SAUTS DE LIGNE ENTRE CHAQUE ÉTAPE, ET FORMULES ISOLÉES EN BLOC $$ ... $$.

1. INTERDICTION FORMELLE D'ÉCRIRE DES FRACTIONS AVEC LE SLASH '/' :
   - IL EST STRICTEMENT INTERDIT d'écrire des fractions sous la forme a/b ou 1/√(LC) ou A0 = -R2/R1 ou (1/Q0)(p/w0).
   - TOUTE fraction mathématique ou scientifique DOIT IMPÉRATIVEMENT être écrite sous forme de vraie fraction verticale avec \\dfrac{numérateur}{dénominateur} :
     * Le numérateur en haut,
     * La barre horizontale nette au milieu,
     * Le dénominateur en bas.
   - Exemples obligatoires :
     * JAMAIS : w0 = 1/√(LC)  --> TOUJOURS : $$ \\omega_0 = \\dfrac{1}{\\sqrt{LC}} $$
     * JAMAIS : f0 = 1/(2π√(LC)) --> TOUJOURS : $$ f_0 = \\dfrac{1}{2\\pi \\sqrt{LC}} $$
     * JAMAIS : Q0 = Lw0/R1 --> TOUJOURS : $$ Q_0 = \\dfrac{L\\omega_0}{R_1} = \\dfrac{1}{R_1 C \\omega_0} = \\dfrac{1}{R_1}\\sqrt{\\dfrac{L}{C}} $$
     * JAMAIS : A0 = -R2/R1 --> TOUJOURS : $$ A_0 = -\\dfrac{R_2}{R_1} $$
     * JAMAIS : T(p) = -R2 C p / [...] --> TOUJOURS : $$ T(p) = \\dfrac{-R_2 C p}{1 + \\dfrac{1}{Q_0}\\dfrac{p}{\\omega_0} + \\left(\\dfrac{p}{\\omega_0}\\right)^2} $$
   - Utilise TOUJOURS les symboles scientifiques corrects : \\omega_0 (jamais w0), \\pi (jamais pi), \\tau, \\alpha, \\beta, \\Omega.

2. STRUCTURE AÉRÉE, GRANDS TITRES ET MISE EN VALEUR :
   - Structure TOUJOURS ta réponse avec des grands titres clairs (# Grand Titre pour le sujet, ## Titre pour chaque question ou étape majeure, ### Sous-titre).
   - Sépare clairement chaque question ou étape (ex: ## Question 5 : Expressions canoniques de A₀, f₀, Q₀).
   - Fais de VRAIS sauts de ligne doubles entre chaque paragraphe ou étape pour que le texte ne soit JAMAIS compacté ni groupé.
   - Pour chaque formule majeure, écris-la isolée sur sa propre ligne entre doubles dollars $$ ... $$ pour qu'elle s'affiche en grand, centrée et aérée.
   - Encadre systématiquement le résultat final de chaque question avec \\boxed{...} dans un bloc centré $$ \\boxed{...} $$.
   - Souligne les concepts essentiels avec **gras** ou \\underline{...}.

3. GESTION DES EXERCICES LONGS ET DÉCOUPAGE PÉDAGOGIQUE INTELLIGENT (ZÉRO COUPURE BRUTALE) :
   - Tu dois TOUT FAIRE et résoudre le sujet avec une rigueur absolue.
   - SI L'EXERCICE OU LA DÉMONSTRATION EST PARTICULIÈREMENT LONGUE OU DENSE (plusieurs questions successives, gros calculs) :
     * Résous méthodiquement les étapes ou questions en cours jusqu'au bout, avec leurs résultats intermédiaires encadrés dans \\boxed{...}.
     * NE TE COUPE JAMAIS EN PLEIN MILIEU d'une équation ou d'une phrase !
     * Si une étape/question importante est achevée et que la suite risque d'être trop lourde ou volumineuse pour un seul message, ARRÊTE-TOI AU BON MOMENT à la fin de cette étape propre.
     * Demande alors clairement à l'étudiant : "Voulez-vous que je poursuive avec la question suivante / la suite de la démonstration ?"
   - SI L'ÉTUDIANT RÉPOND "OUI", "CONTINUE", OU DEMANDE LA SUITE :
     * Enchaîne IMMÉDIATEMENT avec la suite exacte (les questions suivantes ou la seconde partie de la démonstration), sans répéter ce qui a déjà été expliqué.

4. SCHÉMAS, CIRCUITS ET DESSINS VECTORIELS (DESSINER SI NÉCESSAIRE) :
   - Si la résolution ou l'explication concerne un circuit électronique (ex: AOP, filtre RLC, quadripôle, pont diviseur), un repère géométrique, un signal ou un schéma bloc :
     DESSINE-LE DIRECTEMENT sous forme de schéma vectoriel SVG propre et net dans un bloc de code \`\`\`svg ... \`\`\` :
     * Utilise une balise <svg viewBox="0 0 550 250" xmlns="http://www.w3.org/2000/svg" className="w-full">
     * Style moderne et sombre : fond sombre (#0d0f17) ou transparent, traits en orange (#f97316) ou cyan (#38bdf8), textes lisibles en blanc (#f3f4f6) avec font-size adaptée.
     * Indique clairement les composants (Ve, Vs, R1, R2, C, L, noeuds, masse GND, entrées + et - de l'AOP).

5. DÉCISION AUTONOME SUR LES QUESTIONS SUGGÉRÉES (PROPOSITIONS SOUS FORME DE CARTES BOUTONS) :
   - À la fin d'un problème, exercice, démonstration ou situation, C'EST TOI L'IA QUI DÉCIDES AUTONOMEMENT s'il est pertinent de suggérer des questions de prolongement ou d'approfondissement à l'étudiant.
   - Si tu juges pertinent d'en proposer (et uniquement quand la situation s'y prête bien), ajoute à la toute fin de ta réponse le bloc :
[QUESTIONS_SUGGÉRÉES]
- Question ou piste de calcul 1
- Question ou piste de calcul 2
- Question ou piste de calcul 3
   Ces questions seront automatiquement transformées en boutons carrés cliquables pour l'étudiant. Si la situation ne nécessite aucun prolongement, ne mets pas ce bloc.

6. STRUCTURATION STRICTE, ALINÉAS ET SÉPARATION DES COMMENTAIRES :
   - NE CONFONDS JAMAIS les commentaires avec les calculs ou les explications théoriques !
   - EXPLICATIONS : Rédige des phrases claires et aérées avec de grands titres (#, ##, ###).
   - ALINÉAS : Pour les sous-questions ou sous-étapes, utilise systématiquement des alinéas avec 'a) ', 'b) ', 'c) ' ou '1) ', '2) ' pour que chaque étape soit bien indentée et aérée.
   - CALCULS PURS : Isole chaque formule majeure dans un bloc centré $$ ... $$ avec \\dfrac{}{} et le résultat final encadré dans $$ \\boxed{...} $$.
   - COMMENTAIRES ET REMARQUES : Mets TOUJOURS tes commentaires, observations physiques, astuces ou conseils sous la forme :
> **Remarque :** Ton commentaire méthodologique ici.
ou
> **Note :** Ta note de vigilance ici.
   Ils seront ainsi isolés dans un encadré distinct bleu ciel sans jamais se mélanger aux calculs.
- DANS LES CRÉATIONS (Questionnaires, QCM, Cartes, Exercices) : Toute formule dans l'énoncé et dans CHAQUE option de réponse DOIT impérativement être entourée de dollars, par exemple : "$T(j\\omega) = \\dfrac{T_0}{1 + j\\dfrac{\\omega}{\\omega_0}}$".

7. RÈGLE FONDAMENTALE DE DÉCISION — OBLIGATION D'UN SUJET D'ÉTUDE POUR TOUTE CRÉATION :
   - IL EST STRICTEMENT INTERDIT de concevoir ou créer un module d'apprentissage (QCM, carte mentale, résumé, devoir, flashcards, exercices, infographie, etc.) « DANS LE VIDE », sans sujet, sans cours, ou sans contexte !
   - Si l'étudiant te demande une création (ou a cliqué sur un bouton de création) MAIS qu'il n'a joint AUCUN document, n'a précisé AUCUN sujet de cours dans son message, ET que la discussion précédente ne porte sur aucun sujet d'étude précis :
     -> TU NE DOIS EN AUCUN CAS PRODUIRE D'OBJET JSON DE CRÉATION NI CRÉER DANS LE VIDE.
     -> TU DOIS IMPÉRATIVEMENT L'INTERPELLER DANS LE CHAT en lui demandant avec bienveillance d'indiquer la matière ou le chapitre précis qu'il souhaite réviser, ou de joindre son fichier de cours.
     -> TU DOIS OBLIGATOIREMENT terminer ta réponse par le bloc [QUESTIONS_SUGGÉRÉES] avec 4 exemples concrets de prompts de création portant sur des matières variées (Maths, Physique, SVT, Informatique, etc.) sous forme de boutons cliquables.`;

      systemContent += `\n\n8. POSITION ALÉATOIRE, DIVERSITÉ ET NOMBRE MAXIMUM (18 MAXIMUM) POUR QUESTIONNAIRES ET VRAI OU FAUX :
- RÈGLE STRICTE SUR LE NOMBRE DE QUESTIONS / AFFIRMATIONS :
  * Si l'étudiant ne spécifie aucun nombre exact : GÉNÈRE LE MAXIMUM POSSIBLE pour couvrir exhaustivement le document ou le cours (entre 15 et 18 questions ou affirmations).
  * Si l'étudiant demande un nombre spécifique : respecte scrupuleusement sa demande SANS JAMAIS DÉPASSER 18.
  * Si l'étudiant demande plus de 18 (par exemple 20, 25, 30, 50, etc.) : TU DOIS OBLIGATOIREMENT LIMITER À STRICTEMENT 18 MAXIMUM. Ne crée JAMAIS plus de 18 items.
  * Cette règle est ABSOLUE pour les questionnaires ('questionnaire', 'questionnaire-test') et pour les vrai ou faux ('vrai-ou-faux', 'vrai-ou-faux-test').
- POSITION STRICTEMENT ALÉATOIRE DANS LES QCM ET QUIZ ('questionnaire', 'questionnaire-test') :
  * IL EST STRICTEMENT INTERDIT de placer systématiquement la bonne réponse en première ou deuxième position (index 0 ou 1) !
  * La bonne réponse DOIT se cacher dedans de manière totalement aléatoire : répartis-la équitablement entre toutes les positions (tantôt A [index 0], tantôt B [index 1], tantôt C [index 2], tantôt D [index 3]).
  * Les distracteurs (fausses options) doivent être plausibles et éducatifs (erreurs typiques d'étudiants, pièges d'unités, formules approchées, faux théorèmes).
  * Dans "explanation", explique directement la réalité scientifique ou le calcul sans faire référence à une lettre statique ("L'option A...").
- DIVERSITÉ MAXIMALE ET NON-RÉPÉTITION SUR UN MÊME DOCUMENT (ANTI-DOUBLONS INTRA ET INTER-MODULES) :
  * Sur un polycopié, PDF ou cours, il y a des centaines de questions possibles. NE REPOSE JAMAIS LES MÊMES QUESTIONS d'un module à l'autre !
  * Si l'étudiant te demande un questionnaire, puis un vrai/faux, un test, des flashcards ou des exercices :
    -> Interdiction absolue de répéter les mêmes questions ou les mêmes 3 définitions introductives.
    -> Explore d'AUTRES SECTIONS, d'autres chapitres, théorèmes et paragraphes du document.
    -> INTÈGRE DES CALCULS ET PROBLÈMES CONCRETS : Ne te limite pas à des définitions verbales. Pose des vrais calculs numériques chiffrés dès que le cours comporte des formules ($f_0$, bande passante \\Delta f, facteur de qualité Q_0, valeurs numériques réelles, dérivées, impédances, intégrales, lois physiques).
- FORMAT STRICT ET OBLIGATOIRE POUR VRAI OU FAUX ('vrai-ou-faux', 'vrai-ou-faux-test') :
  * Équilibre rigoureusement environ 50% de VRAI et 50% de FAUX avec affirmations stimulantes, subtiles et calculs réels.
  * Structure JSON obligatoire dans 'creation_data' :
    \`\`\`json
    {
      "affirmations": [
        {
          "id": 1,
          "statement": "Énoncé précis avec formule KaTeX ($...$)",
          "is_true": true,
          "explanation": "Démonstration pédagogique complète expliquant pourquoi c'est vrai ou faux."
        }
      ]
    }
    \`\`\``;

      systemContent += `\n\n9. CONSIGNE STRICTE DE STRUCTURATION HIÉRARCHIQUE (CARTE MENTALE - 'carte-mentale' et 'carte-mentale-2') :
Tu es le moteur de structuration pédagogique de l'application StudyCloud. Lorsque l'utilisateur te soumet un cours, un document ou un sujet, tu dois OBLIGATOIREMENT construire une arborescence logique et équilibrée à 3 NIVEAUX MINIMUM (Niveau 0 -> Niveau 1 -> Niveau 2 -> Niveau 3).

INTERDICTION FORMELLE DE FAIRE UNE STRUCTURE À PLAT ("hérisson" de 20 ou 30 branches connectées au centre).
IL EST STRICTEMENT INTERDIT de connecter directement plus de 4 à 6 branches principales au nœud central.

STRUCTURE OBLIGATOIRE EN 4 PALIERS :
- NIVEAU 0 (Racine) : Le Sujet Global uniquement (ex: "Filtres Analogiques").
- NIVEAU 1 (Branches Principales - Max 4 à 6 piliers) : Les grands piliers du cours (ex: "Généralités & Définitions", "Filtre Passe-Bas", "Filtre Passe-Haut", "Filtre Passe-Bande", "Filtre Coupe-Bande").
- NIVEAU 2 (Sous-branches par catégorie) : Les caractéristiques de chaque grand pilier. Chaque branche de Niveau 1 DOIT contenir :
  * "Définition / Rôle"
  * "Fonction de Transfert"
  * "Ordre 1 / Ordre 2"
  * "Diagramme de Bode"
- NIVEAU 3 (Feuilles de détails) : Les expressions exactes, formules ou valeurs numériques.
  Exemple de cheminement :
  Niveau 0 ("Filtres Analogiques") -> Niveau 1 ("Filtre Passe-Bas") -> Niveau 2 ("Ordre 1") -> Niveau 3 ("$\\underline{T}(p) = \\dfrac{T_0}{1 + \\dfrac{p}{\\omega_0}}$")

RÈGLE ABSOLUE POUR LES FORMULES LATEX :
- Toutes les formules mathématiques/scientifiques LaTeX doivent être valides, proprement échappées avec double antislash dans les chaînes JSON (ex: "$\\underline{T}(p) = \\dfrac{T_0}{1 + \\dfrac{p}{\\omega_0}}$", "$Q_0 = \\dfrac{1}{R}\\sqrt{\\dfrac{L}{C}}$", "$f_c = \\dfrac{1}{2\\pi RC}$").
- Les formules se placent UNIQUEMENT dans les nœuds finaux de détails (Niveau 3), jamais mélangées en vrac au niveau 1.
- CHAQUE NŒUD EST UN BLOC / BOÎTE FERMÉE ("type": "box").
- PAS DE PHRASES NARRATIVES NI DE LONGS PARAGRAPHES : utilise des mots-clés courts et percutants.
- INTERDICTION FORMELLE d'utiliser des placeholders vides ('Sous-notion 1', 'Branche 1') ou du Mermaid brut pour les cartes mentales.

EXEMPLE STRICT DU SCHÉMA JSON HIÉRARCHIQUE DANS 'creation_data' :
\`\`\`json
{
  "id": "root",
  "label": "Filtres Analogiques",
  "type": "box",
  "children": [
    {
      "id": "b1",
      "label": "Filtre Passe-Bas",
      "type": "box",
      "children": [
        {
          "id": "b1-1",
          "label": "Rôle",
          "type": "box",
          "children": [{ "id": "b1-1-1", "label": "Laisse passer les basses fréquences [0 ; f_C]", "type": "box" }]
        },
        {
          "id": "b1-2",
          "label": "Ordre 1",
          "type": "box",
          "children": [{ "id": "b1-2-1", "label": "$\\underline{T}(p) = \\dfrac{T_0}{1 + \\dfrac{p}{\\omega_0}}$", "type": "box" }]
        },
        {
          "id": "b1-3",
          "label": "Ordre 2",
          "type": "box",
          "children": [{ "id": "b1-3-1", "label": "$\\underline{T}(p) = \\dfrac{T_0}{1 + 2m\\dfrac{p}{\\omega_0} + (\\dfrac{p}{\\omega_0})^2}$", "type": "box" }]
        }
      ]
    },
    {
      "id": "b2",
      "label": "Filtre Passe-Haut",
      "type": "box",
      "children": [
        {
          "id": "b2-1",
          "label": "Rôle",
          "type": "box",
          "children": [{ "id": "b2-1-1", "label": "Laisse passer les hautes fréquences", "type": "box" }]
        },
        {
          "id": "b2-2",
          "label": "Ordre 1",
          "type": "box",
          "children": [{ "id": "b2-2-1", "label": "$\\underline{T}(p) = \\dfrac{T_0\\dfrac{p}{\\omega_0}}{1 + \\dfrac{p}{\\omega_0}}$", "type": "box" }]
        }
      ]
    }
  ]
}
\`\`\``;

      if (docNames.length > 0) {
        systemContent += `\n\nDOCUMENTS FOURNIS PAR L'ÉTUDIANT :\nL'utilisateur a ouvert ${docNames.length} document(s) d'étude : ${docNames.map(n => `"${n}"`).join(', ')}. Tu as un accès direct et complet au contenu textuel de ces documents.`;
      }

      if (activeCreation) {
        systemContent += `\n\nCRÉATION ACTUELLE DANS L'ESPACE DE DROITE ("${activeCreation.title}", type: "${activeCreation.toolType}") : Si l'utilisateur demande explicitement de la modifier, l'enrichir ou la mettre à jour, réponds en mode création JSON avec la version actualisée.`;
      }

      if (isExplicitOverride && explicitToolType && (docNames.length > 0 || hasPromptSubject || hasConversationContext)) {
        systemContent += `\n\nCOMMANDE EXPLICITE DE CRÉATION DEPUIS LE MENU CRÉATION :\nL'étudiant a expressément sélectionné le format de création « ${explicitToolType} » pour le sujet/document d'étude.\nTu DOIS te placer dans la BRANCHE 2 (CRÉATION D'UN MODULE D'ÉTUDE) et répondre avec l'objet JSON strict de création ("decision": "creation", "mode": "creation", "creation_type": "${explicitToolType}", "creation_title": "...", "chat_response": "...", "creation_data": { ... }). Ne produis aucun monologue ni texte Markdown de discussion libre dans ce cas. Remplis directement toutes les données complètes de création.`;
      }

      // 4. Préparation de l'historique complet pour alimenter le RAG conversationnel
      const chatHistory = [
        { role: 'system', content: systemContent },
        ...updatedMessages.slice(-12).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      ];

      // 5. Appel au moteur d'IA officiel StudyCloud (Workshop Backend / Robot Rouge)
      const selectedModelObj = availableModels.find(m => m.id === selectedModel || m.model_id === selectedModel);
      const configuredToken = selectedModelObj?.api_token;

      const aiResult = await sendChatMessageToAi({
        messages: chatHistory,
        prompt: userText,
        message: userText,
        userId: currentUserId,
        sessionId: currentConversationId,
        conversationId: currentConversationId,
        model: selectedModel,
        selectedModel: selectedModel,
        apiKey: configuredToken || getGeminiApiKey() || undefined,
        apiToken: configuredToken || undefined,
        geminiApiKey: configuredToken || getGeminiApiKey() || undefined,
        requested_type: explicitToolType || undefined,
        attachedFileId,
        attachedFileName,
        attachedFileContent,
        attachedFileR2Key,
        file_content: attachedFileContent,
        fileContent: attachedFileContent,
        documentContent: attachedFileContent,
        documentText: attachedFileContent,
        file_name: attachedFileName,
        fileName: attachedFileName,
        imageBase64: attachedImageBase64 || undefined,
        audioBase64: attachedAudioBase64 || undefined,
        signal: abortSignal,
        abortSignal,
      });

      if (abortSignal.aborted) {
        setIsWaitingServer(false);
        setIsTyping(false);
        setRetryingMessageId(null);
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { isLoading: false, isCancelled: true } }));
        return;
      }

      const rawResponseText = aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.";
      setIsWaitingServer(false);
      setRetryingMessageId(null);

      let fullResponseText = rawResponseText;

      // 6. L'IA CHEF D'ORCHESTRE AUTONOME : DÉCISION DE L'IA ENTRE CHAT ET CRÉATION
      const hasCreationClues = Boolean(
        aiResult.mode === 'creation' ||
        (aiResult.creation_type && aiResult.creation_data) ||
        (isExplicitOverride && explicitToolType) ||
        /"decision"\s*:\s*"creation"/i.test(rawResponseText) ||
        /"creation_data"/i.test(rawResponseText) ||
        /<creation/i.test(rawResponseText)
      );

      let creationParsed: any = null;
      let companionChatMessage = '';

      if (aiResult.creation_data) {
        let normType = normalizeCreationType(aiResult.creation_type || explicitToolType || 'questionnaire');
        if (explicitToolType && (explicitToolType.includes('vrai') || explicitToolType.includes('faux'))) {
          normType = explicitToolType.includes('test') ? 'vrai-ou-faux-test' : 'vrai-ou-faux';
        }
        let finalContent = aiResult.creation_data;
        if (normType === 'vrai-ou-faux' || normType === 'vrai-ou-faux-test') {
          const rawAffs = Array.isArray(finalContent)
            ? finalContent
            : (finalContent.affirmations || finalContent.questions || finalContent.items || finalContent.statements || finalContent.data);
          if (Array.isArray(rawAffs) && rawAffs.length > 0) {
            finalContent = {
              affirmations: rawAffs.slice(0, 18).map((a: any, idx: number) => {
                let isTrue = true;
                if (typeof a.is_true === 'boolean') isTrue = a.is_true;
                else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
                else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
                else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
                else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
                else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
                return {
                  id: a.id || `vf_${idx + 1}`,
                  statement: a.statement || a.affirmation || a.question || a.texte || a.text || `Affirmation n°${idx + 1}`,
                  is_true: isTrue,
                  isTrue,
                  explanation: a.explanation || a.explication || a.justification || ''
                };
              })
            };
          }
        } else if (normType === 'questionnaire' || normType === 'questionnaire-test') {
          const rawQs = Array.isArray(finalContent) ? finalContent : finalContent.questions;
          if (Array.isArray(rawQs)) {
            finalContent = {
              ...(typeof finalContent === 'object' && !Array.isArray(finalContent) ? finalContent : {}),
              questions: rawQs.slice(0, 18)
            };
          }
        }
        creationParsed = {
          title: aiResult.creation_title || `${normType.toUpperCase()} : ${mainDocName}`,
          content: finalContent,
          toolType: normType,
        };
        companionChatMessage = aiResult.chat_response || '';
      } else if (hasCreationClues || rawResponseText.includes('mindmap')) {
        const jsonMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || rawResponseText.match(/(\{[\s\S]*\})/);
        const candidate = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawResponseText;
        const parsed = safeJsonParse(candidate);

        if (parsed && typeof parsed === 'object') {
          const parsedData = parsed.creation_data || (parsed.questions || parsed.affirmations || parsed.cards || parsed.root || parsed.branches || parsed.mermaid || parsed.overview || parsed.sections || parsed.exercises || parsed.exercices || parsed.written_exercise || parsed.complete_exam ? parsed : null);
          if (parsedData) {
            let detectedType = parsed.creation_type;
            if (explicitToolType && (explicitToolType.includes('vrai') || explicitToolType.includes('faux'))) {
              detectedType = explicitToolType;
            } else if (!detectedType) {
              if (explicitToolType) {
                detectedType = explicitToolType;
              } else if (parsed.affirmations) {
                detectedType = 'vrai-ou-faux';
              } else if (parsed.questions) {
                detectedType = 'questionnaire';
              } else if (parsed.cards) {
                detectedType = 'carte-memoire';
              } else if (parsed.root || parsed.branches || parsed.mermaid) {
                detectedType = 'carte-mentale';
              } else if (parsed.overview) {
                detectedType = 'resume';
              } else {
                detectedType = 'questionnaire';
              }
            }
            const normType = normalizeCreationType(detectedType);
            let finalContent = parsedData;
            if (normType === 'vrai-ou-faux' || normType === 'vrai-ou-faux-test') {
              const rawAffs = Array.isArray(finalContent)
                ? finalContent
                : (finalContent.affirmations || finalContent.questions || finalContent.items || finalContent.statements || finalContent.data || parsed.affirmations || parsed.questions || []);
              if (Array.isArray(rawAffs) && rawAffs.length > 0) {
                finalContent = {
                  affirmations: rawAffs.slice(0, 18).map((a: any, idx: number) => {
                    let isTrue = true;
                    if (typeof a.is_true === 'boolean') isTrue = a.is_true;
                    else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
                    else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
                    else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
                    else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                    else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
                    else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
                    return {
                      id: a.id || `vf_${idx + 1}`,
                      statement: a.statement || a.affirmation || a.question || a.texte || a.text || `Affirmation n°${idx + 1}`,
                      is_true: isTrue,
                      isTrue,
                      explanation: a.explanation || a.explication || a.justification || ''
                    };
                  })
                };
              }
            } else if (normType === 'questionnaire' || normType === 'questionnaire-test') {
              const rawQs = Array.isArray(finalContent) ? finalContent : (finalContent.questions || parsed.questions || []);
              if (Array.isArray(rawQs)) {
                finalContent = {
                  ...(typeof finalContent === 'object' && !Array.isArray(finalContent) ? finalContent : {}),
                  questions: rawQs.slice(0, 18)
                };
              }
            }
            creationParsed = {
              title: parsed.creation_title || parsed.title || `${normType.toUpperCase()} : ${mainDocName}`,
              content: finalContent,
              toolType: normType,
            };
            companionChatMessage = parsed.chat_message || parsed.chat_response || '';
          }
        }

        // Détection de Mermaid Mindmap direct dans la réponse
        if (!creationParsed) {
          const mermaidMindmapMatch = rawResponseText.match(/```(?:mermaid)?\s*(mindmap[\s\S]*?)```/i) || (rawResponseText.trim().startsWith('mindmap') ? [rawResponseText, rawResponseText] : null);
          if (mermaidMindmapMatch) {
            creationParsed = {
              title: `Carte Mentale : ${mainDocName}`,
              content: { mermaid: mermaidMindmapMatch[1].trim() },
              toolType: 'carte-mentale'
            };
            companionChatMessage = "J'ai conçu votre carte mentale logique interactive !";
          }
        }

        // Si l'utilisateur a explicitement cliqué sur un bouton d'action ou demandé un module dans son message
        const explicitOrInferredType = explicitToolType || (
          /vrai.*faux/i.test(userText) ? (/test/i.test(userText) ? 'vrai-ou-faux-test' : 'vrai-ou-faux') :
          /questionnaire|quiz|qcm/i.test(userText) ? (/test/i.test(userText) ? 'questionnaire-test' : 'questionnaire') :
          /carte\s*mentale|mindmap/i.test(userText) ? 'carte-mentale' :
          /flashcard|carte\s*m[ée]moire/i.test(userText) ? 'carte-memoire' :
          /r[ée]sum[ée]|synth[èe]se/i.test(userText) ? 'resume' : null
        );

        if (!creationParsed && explicitOrInferredType) {
          const p = parseOrBuildAiCreation(explicitOrInferredType as any, rawResponseText, mainDocName, userText);
          if (p.content && (p.content.questions?.length > 0 || p.content.overview || p.content.root || p.content.metrics || p.content.sections || p.content.affirmations?.length > 0 || p.content.cards || p.content.exercises || p.content.exercices)) {
            creationParsed = {
              title: p.title,
              content: p.content,
              toolType: explicitOrInferredType,
            };
          } else if (isExplicitOverride && explicitToolType) {
            creationParsed = {
              title: p.title || `${explicitToolType} : ${mainDocName}`,
              content: p.content || null,
              toolType: explicitToolType,
            };
          }
        }
      }

      // Sécurité anti-création dans le vide pour TOUS les modèles IA (actuels et futurs) :
      if (creationParsed && (!allDocs || allDocs.length === 0) && !hasPromptSubject && !hasConversationContext) {
        creationParsed = null;
        fullResponseText = `Pour que je puisse concevoir votre **création**, merci de me préciser sur quel cours ou sujet elle doit porter, ou de joindre votre fichier de cours (PDF, Word, photo d'exercice).\n\n[QUESTIONS_SUGGÉRÉES]\n- Questionnaire Test noté sur les Lois de Newton en Physique\n- Vrai ou Faux Test sur la Génétique et l'ADN en SVT\n- Carte Mentale 2 sur les Fonctions et Dérivées en Mathématiques\n- Devoir Complet d'examen officiel sur la Thermodynamique`;
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { isLoading: false, isCreation: false } }));
      }

      if (creationParsed && creationParsed.content) {
        let effectiveToolType = creationParsed.toolType || explicitToolType || 'questionnaire';
        if (effectiveToolType === 'vrai-ou-faux' || effectiveToolType === 'vrai-ou-faux-test') {
          const rawAffs = Array.isArray(creationParsed.content)
            ? creationParsed.content
            : (creationParsed.content.affirmations || creationParsed.content.questions || creationParsed.content.items || creationParsed.content.statements || creationParsed.content.data || []);
          if (Array.isArray(rawAffs) && rawAffs.length > 0) {
            creationParsed.content = {
              affirmations: rawAffs.slice(0, 18).map((a: any, idx: number) => {
                let isTrue = true;
                if (typeof a.is_true === 'boolean') isTrue = a.is_true;
                else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
                else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
                else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
                else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
                else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
                return {
                  id: a.id || `vf_${idx + 1}`,
                  statement: a.statement || a.affirmation || a.question || a.texte || a.text || `Affirmation n°${idx + 1}`,
                  is_true: isTrue,
                  isTrue,
                  explanation: a.explanation || a.explication || a.justification || ''
                };
              })
            };
          }
        } else if (effectiveToolType === 'questionnaire' || effectiveToolType === 'questionnaire-test') {
          const rawQs = Array.isArray(creationParsed.content) ? creationParsed.content : creationParsed.content.questions;
          if (Array.isArray(rawQs)) {
            creationParsed.content = {
              ...(typeof creationParsed.content === 'object' && !Array.isArray(creationParsed.content) ? creationParsed.content : {}),
              questions: rawQs.slice(0, 18)
            };
          }
        }
        const newCreation: AiCreation = {
          id: 'ai-' + Date.now(),
          userId: currentUserId,
          fileId: activePreviewItem?.id,
          toolType: effectiveToolType,
          title: creationParsed.title,
          content: creationParsed.content,
          sourceFileName: mainDocName,
          createdAt: new Date().toISOString(),
          version: 1,
        };

        setActiveCreation(newCreation);
        window.dispatchEvent(new CustomEvent('ai-creation-ready', { detail: { creation: newCreation } }));
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { isLoading: false } }));
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));

        // Nettoyage radical du texte pour la discussion : JAMAIS de JSON brut !
        const cleanIntro = cleanChatText(companionChatMessage || aiResult.chat_response || rawResponseText);

        fullResponseText = `${cleanIntro ? cleanIntro + '\n\n' : ''}✨ J'ai généré votre **${newCreation.title}** directement dans votre espace **Création** !

👉 *Retrouvez et testez votre création dans le volet de droite (ou l'onglet Création sur mobile).*`;
      } else {
        // BRANCHE DISCUSSION SIMPLE DANS LE CHAT : Réponse directe sans rien déranger dans l'espace création
        const cleaned = cleanChatText(aiResult.chat_response || rawResponseText);
        fullResponseText = stripAiReasoningScratchpad(cleaned) || "✨ Votre demande a été traitée avec succès.";
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { isLoading: false } }));
      }

      const effectiveModelName = aiResult.model || currentModelDisplay;

      // 7. Initialisation du message IA avec écriture fluide
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        isStreaming: true,
        attachedFileName: attachedFileName || undefined,
        model: effectiveModelName,
        isPowerMode: false,
      };
      setMessages(prev => [...prev, initialAiMsg]);

      // Sauvegarde locale du fil de discussion
      try {
        safeSetItem(`studycloud_conv_msgs_${currentConversationId}`, JSON.stringify([...updatedMessages, { ...initialAiMsg, text: fullResponseText, isStreaming: false, model: effectiveModelName }]));
      } catch {}

      // 8. Animation machine à écrire
      let index = 0;
      const chunkSize = 3;
      const tickSpeed = 16;

      if (typingTimerRef.current) clearInterval(typingTimerRef.current);

      typingTimerRef.current = setInterval(() => {
        index += chunkSize;
        if (index >= fullResponseText.length) {
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId ? { ...m, text: fullResponseText, isStreaming: false, model: effectiveModelName } : m
            )
          );
          setIsTyping(false);
          setRetryingMessageId(null);
          // Sauvegarde Cloudflare D1 du message assistant complet
          StudyCloudAPI.saveAiMessage({
            id: aiMsgId,
            conversationId: currentConversationId,
            role: 'assistant',
            content: fullResponseText,
            metadata: { model: effectiveModelName }
          }).catch(() => {});
        } else {
          const partial = fullResponseText.slice(0, index);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId ? { ...m, text: partial, model: effectiveModelName } : m
            )
          );
        }

        if (scrollContainerRef.current && !isUserScrolledUpRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, tickSpeed);

    } catch (err: any) {
      setRetryingMessageId(null);
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        setIsWaitingServer(false);
        setIsTyping(false);
        return;
      }
      console.error('[AssistantChat] Erreur appel IA:', err);
      setIsWaitingServer(false);
      setIsTyping(false);
      window.dispatchEvent(new CustomEvent('ai-creation-error', { detail: { error: err.message } }));
      window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { isLoading: false, isError: true } }));
      
      const isNetwork = isNetworkError(err);
      const isFriendlyMsg = err.message && (err.message.includes("StudyCloud") || err.message.includes("disponible"));
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: isNetwork 
          ? "Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles)."
          : (isFriendlyMsg ? `⚠️ ${err.message}` : `⚠️ Erreur : ${err.message || "L'assistante StudyCloud n'est pas disponible pour le moment."}`),
        sender: 'ai',
        isStreaming: false,
        isError: true,
        errorType: isNetwork ? 'network' : 'server',
        retryPrompt: userText,
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  useEffect(() => {
    const handleAutoPrompt = (e: any) => {
      const promptText = e.detail?.prompt || e.detail?.text;
      const reqType = e.detail?.requested_type || e.detail?.requestedType || e.detail?.toolType;
      if (promptText) {
        sendMessage(promptText, reqType);
      }
    };
    window.addEventListener('auto-prompt', handleAutoPrompt as any);
    window.addEventListener('studycloud-trigger-creation', handleAutoPrompt as any);
    window.addEventListener('studycloud-submit-prompt', handleAutoPrompt as any);
    return () => {
      window.removeEventListener('auto-prompt', handleAutoPrompt as any);
      window.removeEventListener('studycloud-trigger-creation', handleAutoPrompt as any);
      window.removeEventListener('studycloud-submit-prompt', handleAutoPrompt as any);
    };
  }, [messages, isTyping, activePreviewItem, attachedResources, activeCreation, currentConversationId]);

  useEffect(() => {
    const handleCancelFromCreation = () => {
      handleCancelTask();
    };
    window.addEventListener('studycloud-cancel-creation', handleCancelFromCreation as any);
    return () => window.removeEventListener('studycloud-cancel-creation', handleCancelFromCreation as any);
  }, []);

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (toolType: AiCreationType) => {
    const docName = activePreviewItem?.name || 'ce document';
    let prompt = '';
    switch (toolType) {
      case 'quiz':
        prompt = `Prépare un questionnaire QCM interactif sur "${docName}"`;
        break;
      case 'summary':
        prompt = `Génère un résumé détaillé et structuré de "${docName}"`;
        break;
      case 'mindmap':
        prompt = `Crée une carte mentale complète à partir de "${docName}"`;
        break;
      case 'infographic':
        prompt = `Élabore une infographie de synthèse sur "${docName}"`;
        break;
      case 'document':
        prompt = `Rédige une fiche d'étude exportable en PDF sur "${docName}"`;
        break;
    }
    sendMessage(prompt);
  };

  // Groupement temporel des conversations façon Gemini (Aujourd'hui, Hier, 7 derniers jours, Plus ancien)
  const filteredConversations = conversations.filter(c => 
    !historySearch.trim() || c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#1e2024] font-nunito relative z-50 overflow-hidden">
      
      {/* EN-TÊTE SUPÉRIEUR (BOUTON HISTORIQUE, NOUVELLE CONVERSATION, PUISSANT/MOYEN, FERMER) */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#23252a] border-b border-zinc-700/60 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Bouton Historique */}
          <button
            type="button"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0"
            title="Historique des discussions"
          >
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>Historique</span>
            {conversations.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-orange-500/25 text-orange-400 text-[10px] font-black">
                {conversations.length}
              </span>
            )}
          </button>

          {/* Bouton + (Nouvelle discussion) */}
          <button
            type="button"
            onClick={handleStartNewConversation}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0 flex items-center justify-center"
            title="Nouvelle discussion"
          >
            <Plus className="w-4 h-4 text-orange-400" />
          </button>

          {/* Sélecteur de Modèle IA */}
          <div className="relative shrink-0" ref={modelDropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white active:scale-95 shrink-0 shadow-xs"
              title="Changer de modèle IA"
            >
              <span className="max-w-[110px] sm:max-w-[140px] truncate">{currentModelDisplay}</span>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-60 sm:w-68 bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  <span>Modèles IA</span>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {isModelsLoading && availableModels.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                      <span>Chargement des modèles...</span>
                    </div>
                  ) : availableModels.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-zinc-500">
                      Aucun modèle actif
                    </div>
                  ) : (
                    availableModels.map((m) => {
                      const isSelected = selectedModel === m.id || selectedModel === m.model_id;
                      const providerColor =
                        m.provider === 'google' ? 'bg-blue-400' :
                        m.provider === 'cloudflare' ? 'bg-orange-400' :
                        m.provider === 'anthropic' ? 'bg-amber-400' : 'bg-emerald-400';
                      return (
                        <button
                          key={m.id || m.model_id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.id || m.model_id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                            isSelected ? 'bg-orange-500/15 text-orange-400 font-bold' : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${providerColor}`} />
                            <span className="truncate">{stripWorkerAi(m.nickname || m.name || m.model_id || m.id)}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bouton Fermer */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[10px] font-black cursor-pointer hover:bg-orange-500/30 transition-colors"
              title="Fermer l'Assistante DKD"
            >
              <DelmasRobot size={20} />
              <span>Fermer</span>
            </button>
          )}
        </div>
      </div>

      {/* TIROIR HISTORIQUE COULISSANT STYLE GEMINI */}
      {isHistoryDrawerOpen && (
        <div 
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-fadeIn"
          onClick={() => setIsHistoryDrawerOpen(false)}
        >
          <div 
            className="w-full max-w-[310px] sm:max-w-[340px] h-full bg-[#1e2024] border-r border-zinc-800 flex flex-col p-4 shadow-2xl animate-slideInLeft"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Discussions Récentes</h3>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Conversation Button inside drawer */}
            <button
              onClick={handleStartNewConversation}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nouvelle discussion</span>
            </button>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Rechercher une discussion..."
                className="w-full bg-[#282a2f] border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-400 outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {filteredConversations.length === 0 ? (
                <div className="text-center text-zinc-500 text-xs py-8">
                  Aucune discussion trouvée
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isActive = conv.id === currentConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setCurrentConversationId(conv.id);
                        setCurrentConversationTitle(conv.title);
                        setIsHistoryDrawerOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-orange-500/15 border-orange-500/50 text-white shadow-sm'
                          : 'bg-[#26282d] border-zinc-800 text-zinc-300 hover:bg-[#2c2f35] hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-400' : 'text-zinc-400'}`} />
                        <span className="text-xs font-bold truncate">
                          {conv.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0"
                        title="Supprimer cette discussion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 flex flex-col select-text chat-selectable"
      >
        {messages.length === 0 && !isTyping && !isWaitingServer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-10 px-4 animate-fadeIn">
            {/* Logo ADN officiel */}
            <div className="mb-3 relative group">
              <DnaLogo className="w-12 h-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-transform duration-300 group-hover:scale-105" glow={false} />
            </div>

            {/* Badge de l'IA active sélectionnée qui s'adresse spontanément à l'utilisateur */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2.5 rounded-full bg-zinc-800/85 border border-zinc-700/60 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
                {currentModelDisplay}
              </span>
            </div>

            {/* Titre spontané et fluide envoyé en temps réel par l'IA */}
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight min-h-[32px] flex items-center justify-center">
              <span>{displayedWelcomeTitle || welcomeGreeting.title}</span>
              {isTypingWelcome && (
                <span className="inline-block w-0.5 h-5 bg-orange-400 ml-1.5 animate-pulse align-middle" />
              )}
            </h2>

            {/* Sous-titre dynamique bienveillant */}
            <p className="text-xs sm:text-sm font-medium text-white/85 max-w-sm leading-relaxed min-h-[22px]">
              {displayedWelcomeSubtitle || (!isTypingWelcome ? welcomeGreeting.subtitle : '')}
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="w-full shrink-0">
              {msg.sender === 'user' ? (
                <div className="flex justify-end w-full group relative">
                  <div className="flex items-center gap-1.5 max-w-[85%]">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.text);
                        setCopiedMsgId(msg.id);
                        setTimeout(() => setCopiedMsgId(null), 2000);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer shrink-0"
                      title="Copier mon message"
                    >
                      {copiedMsgId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <div className="bg-[#2a2b2f] text-zinc-100 px-4 py-2.5 rounded-[24px] rounded-tr-[4px] text-[14px] sm:text-[15px] md:text-[16px] break-words shadow-sm select-text chat-selectable cursor-text">
                      <ChatMessageText text={msg.text} isUser={true} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col w-full text-zinc-100">
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] text-orange-500" glow={true} />
                      <span className="text-xs font-bold text-orange-500/90 tracking-wide uppercase">Assistant StudyCloud</span>
                      {(msg.model || currentModelDisplay) && (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800/95 border border-zinc-700 text-[10px] font-bold text-orange-400 shadow-xs"
                          title={`Modèle ayant généré cette réponse : ${stripWorkerAi(msg.model || currentModelDisplay)}`}
                        >
                          <span>{stripWorkerAi(msg.model || currentModelDisplay)}</span>
                        </span>
                      )}
                      {msg.isPowerMode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 shadow-xs">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>Puissant</span>
                        </span>
                      )}
                    </div>
                    {msg.attachedFileName && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {msg.attachedFileName.split(', ').map((docName, idx) => (
                          <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-semibold text-orange-300">
                            <FileText className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{docName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {isNetworkErrorMessage(msg) ? (
                    <NetworkErrorCard
                      retryPrompt={msg.retryPrompt}
                      isRetrying={retryingMessageId === msg.id && (isWaitingServer || isTyping)}
                      onRetry={() => {
                        const targetPrompt = msg.retryPrompt || (() => {
                          const idx = messages.findIndex(m => m.id === msg.id);
                          const before = idx >= 0 ? messages.slice(0, idx) : messages;
                          const lastUser = [...before].reverse().find(m => m.sender === 'user');
                          return lastUser?.text || '';
                        })();
                        setRetryingMessageId(msg.id);
                        if (targetPrompt) {
                          sendMessage(targetPrompt);
                        } else {
                          setRetryingMessageId(null);
                        }
                      }}
                    />
                  ) : msg.isError ? (
                    <div className="my-2 p-3 sm:p-3.5 rounded-2xl bg-[#1e2026] border border-zinc-700/80 text-zinc-200 flex items-start gap-3 w-full max-w-xl animate-fadeIn">
                      <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white mb-1">Service temporairement indisponible</div>
                        <div className="text-xs text-zinc-300 leading-relaxed font-normal">
                          {msg.text.replace(/^⚠️\s*(Erreur\s*(du\s*serveur|IA)?\s*:\s*)?/i, '')}
                        </div>
                        <button
                          type="button"
                          disabled={retryingMessageId === msg.id && (isWaitingServer || isTyping)}
                          onClick={() => {
                            const targetPrompt = msg.retryPrompt || (() => {
                              const idx = messages.findIndex(m => m.id === msg.id);
                              const before = idx >= 0 ? messages.slice(0, idx) : messages;
                              const lastUser = [...before].reverse().find(m => m.sender === 'user');
                              return lastUser?.text || '';
                            })();
                            setRetryingMessageId(msg.id);
                            if (targetPrompt) {
                              sendMessage(targetPrompt);
                            } else {
                              setRetryingMessageId(null);
                            }
                          }}
                          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95 disabled:opacity-60"
                        >
                          <RotateCw className={`w-3 h-3 text-orange-400 ${retryingMessageId === msg.id && (isWaitingServer || isTyping) ? 'animate-spin' : ''}`} />
                          <span>{retryingMessageId === msg.id && (isWaitingServer || isTyping) ? 'Connexion...' : 'Réessayer'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[15px] sm:text-[16px] md:text-[17px] leading-[1.8] font-normal text-zinc-100 pl-1 select-text chat-selectable cursor-text">
                      <ChatMessageText text={msg.text} isUser={false} isStreaming={msg.isStreaming} onSelectSuggestion={(q) => sendMessage(q)} />
                    </div>
                  )}

                  {!msg.isStreaming && msg.text && !msg.isError && !isNetworkErrorMessage(msg) && (() => {
                    const isLastAssistant = msg.id === messages[messages.length - 1]?.id;
                    const offersContinuation = isLastAssistant && /(voulez-vous|souhaitez-vous|veux-tu|on continue|continuer\s*\?|la suite\s*\?|je poursuis|dois-je continuer|on passe à la suite|continuer\s*:\s*oui)/i.test(msg.text);
                    return offersContinuation ? (
                      <div className="mt-3.5 mb-1 pl-1 flex items-center gap-2 flex-wrap animate-fadeIn">
                        <button
                          type="button"
                          onClick={() => sendMessage("Oui, continue s'il te plaît avec la suite détaillée !")}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer border border-orange-400/40 group"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-yellow-200 animate-pulse" />
                          <span>Oui, continuer la suite</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    ) : null;
                  })()}

                  {!msg.isStreaming && msg.text && !msg.isError && !isNetworkErrorMessage(msg) && (
                    <div className="flex items-center mt-3 pl-1">
                      <div className="flex items-center gap-1 sm:gap-2 text-zinc-400">
                        <button 
                          type="button"
                          onClick={() => handleReaction(msg.id, 'like')}
                          className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${
                            msg.reaction === 'like'
                              ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                          title="Bonne réponse (j'aime)"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleReaction(msg.id, 'dislike')}
                          className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${
                            msg.reaction === 'dislike'
                              ? 'text-rose-400 bg-rose-500/20 hover:bg-rose-500/30'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                          title="Mauvaise réponse"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <div className="w-1 sm:w-2" />
                        <button 
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            setCopiedMsgId(msg.id);
                            setTimeout(() => setCopiedMsgId(null), 2000);
                          }}
                          className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-400 hover:text-white flex items-center gap-1.5"
                          title="Copier la réponse"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-[11px] font-bold text-emerald-400">Copié</span>
                            </>
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        
        {isWaitingServer && (
          <div className="flex flex-col w-full text-zinc-100 mb-4 animate-fadeIn">
            <div className="flex items-center gap-2.5 bg-[#26282d] px-3.5 py-2.5 rounded-2xl w-fit max-w-[90%] shadow-md">
              <DnaLogo className="w-5 h-5 animate-dna-spin-float shrink-0 text-orange-500" glow={true} />
              <span className="text-xs sm:text-[13px] font-medium text-zinc-200 animate-pulse tracking-wide select-none">
                {aiActivityText || 'Je réfléchis...'}
              </span>
            </div>
          </div>
        )}

        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="sticky bottom-2 self-end z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a2d35]/95 hover:bg-orange-500 border border-zinc-700 hover:border-orange-400 text-zinc-300 hover:text-white text-xs font-bold shadow-xl transition-all cursor-pointer backdrop-blur-sm active:scale-95 animate-fadeIn"
            title="Revenir en bas du fil de discussion"
          >
            <ChevronDown className="w-3.5 h-3.5 text-orange-400 group-hover:text-white" />
            <span>Bas</span>
          </button>
        )}
      </div>

      {/* ZONE BASSE : FORMULAIRE */}
      <div className="px-3 sm:px-5 pt-2 pb-6 sm:pb-8 shrink-0">
        <div className="relative mx-2 md:mx-4 rounded-3xl p-[1.5px] overflow-hidden bg-zinc-700/60 shadow-lg group">
          {/* Liseré fin arc-en-ciel rotatif à 360° qui fait le tour complet */}
          <div
            className="absolute -inset-[250%] pointer-events-none animate-rainbow-spin"
            style={{
              background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 160deg, #ff3b30 200deg, #ff9500 230deg, #ffcc00 260deg, #34c759 290deg, #00c7be 315deg, #007aff 335deg, #af52de 355deg, transparent 360deg)',
              animation: 'rainbowBorderSpin 5s linear infinite',
            }}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex flex-col gap-2 bg-[#282a2f] rounded-[22.5px] p-3 sm:p-3.5 transition-all w-full h-full"
          >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question ou collez votre cours..."
            rows={3}
            className="w-full bg-transparent text-white placeholder-zinc-400 text-sm outline-none resize-none overflow-y-auto select-text"
          />

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-2 custom-scrollbar pb-1">
               {!resolvedActiveName && attachedResources.length === 0 && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-zinc-400 text-[10px] sm:text-[11px] font-medium shrink-0 select-none" title="Aucun fichier d'étude n'est actuellement sélectionné">
                   <FileText className="w-3 h-3 text-zinc-500 shrink-0" />
                   <span>Aucun fichier sélectionné</span>
                 </div>
               )}

               {resolvedActiveName && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/40 rounded-lg max-w-[160px] sm:max-w-[210px] shrink-0" title="Document ouvert à l'écran (sélectionné en orange)">
                   <div className="shrink-0 flex items-center justify-center">
                     <FileIconBadge fileName={resolvedActiveName} size={16} />
                   </div>
                   <span className="text-[10px] sm:text-[11px] font-bold text-orange-300 truncate">
                     {resolvedActiveName}
                   </span>
                   <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-orange-500/25 text-orange-400 shrink-0">
                     Actif
                   </span>
                   {(resolvedActiveItem?.isExtracting || isExtractingDoc) && (
                     <Loader2 className="w-3 h-3 animate-spin text-orange-400 ml-1 shrink-0" />
                   )}
                 </div>
               )}
               
               {attachedResources.map(res => (
                 <div key={res.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/40 rounded-lg max-w-[160px] sm:max-w-[210px] shrink-0" title="Document joint (sélectionné en bleu)">
                   <div className="shrink-0 flex items-center justify-center">
                     <FileIconBadge fileName={res.name} size={16} />
                   </div>
                   <span className="text-[10px] sm:text-[11px] font-bold text-blue-300 truncate">
                     {res.name}
                   </span>
                   {res.isExtracting ? (
                     <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-1 shrink-0" />
                   ) : (
                     <button 
                       type="button"
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         handleRemoveAttachment(res);
                       }}
                       className="ml-1 text-blue-400 hover:text-white p-0.5 rounded-full hover:bg-blue-700/50 transition-colors cursor-pointer"
                       title="Retirer ce document"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   )}
                 </div>
               ))}
            </div>

            {isTyping || isWaitingServer ? (
              <button
                type="button"
                onClick={handleCancelTask}
                className="self-end px-3.5 py-2 font-bold rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs shrink-0"
                title="Arrêter la tâche en cours"
              >
                <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                <span>Arrêter</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="self-end p-2.5 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950"
                title="Envoyer"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
        </div>
      </div>


    </div>
  );
}
