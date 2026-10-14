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
function getLiveAiActivity(prompt: string, docNames: string[], elapsedSec: number, requestedType?: string): string {
  const cleanPrompt = (prompt || '').trim().toLowerCase();
  const mainDoc = docNames && docNames.length > 0 ? docNames[0] : '';
  const hasDoc = Boolean(mainDoc);

  // 1. Mathématiques, calculs, sciences dures, physique, électronique
  const isMathScience = /(calcul|dériv|intégral|équat|formule|résoud|résous|schéma|circuit|aop|filtre|rlc|valeur|\$|\\dfrac|impédance|tension|courant|puissance|théorème|démonstr|vecteur|matrice|harmonique)/i.test(cleanPrompt);
  if (isMathScience) {
    if (elapsedSec <= 2) return "J'analyse les données et équations...";
    if (elapsedSec <= 5) return "Je réfléchis aux étapes de calcul et à la démonstration...";
    if (elapsedSec <= 8) return "Je résous les formules et vérifie les résultats...";
    return "Je finalise la résolution méthodique...";
  }

  // 2. Création de modules d'apprentissage (Quiz, QCM, Cartes, Résumé, Devoir...)
  const isCreation = Boolean(requestedType) || /(créer|conçois|concevoir|fais-moi un|génère|quiz|qcm|questionnaire|carte mentale|flashcards?|carte mémoire|résumé|fiche|devoir|examen|infographie)/i.test(cleanPrompt);
  if (isCreation) {
    const isQuiz = requestedType?.includes('questionnaire') || requestedType?.includes('quiz') || /(quiz|qcm|questionnaire)/i.test(cleanPrompt);
    const isMindmap = requestedType?.includes('carte-mentale') || /(carte mentale|mindmap)/i.test(cleanPrompt);
    const isSummary = requestedType?.includes('resume') || /(résumé|fiche|synthèse)/i.test(cleanPrompt);

    if (isQuiz) {
      if (elapsedSec <= 2) return "J'analyse le sujet pour concevoir le questionnaire...";
      if (elapsedSec <= 5) return "Je réfléchis aux questions et aux options de réponse...";
      if (elapsedSec <= 8) return "Je rédige les explications pédagogiques...";
      return "Je finalise le questionnaire interactif...";
    }
    if (isMindmap) {
      if (elapsedSec <= 2) return "J'extrais l'arborescence des notions...";
      if (elapsedSec <= 5) return "Je structure les branches et concepts clés...";
      return "Je finalise la carte mentale...";
    }
    if (isSummary) {
      if (elapsedSec <= 2) return "J'extrais les points fondamentaux...";
      if (elapsedSec <= 5) return "Je réfléchis à la synthèse des règles clés...";
      return "Je finalise la fiche de synthèse...";
    }
    if (elapsedSec <= 2) return "J'analyse les consignes de création...";
    if (elapsedSec <= 5) return "Je conçois le module pédagogique...";
    return "Je finalise votre création...";
  }

  // 3. Document support d'étude ouvert ou joint
  if (hasDoc) {
    if (elapsedSec <= 2) return `J'explore le document « ${mainDoc} »...`;
    if (elapsedSec <= 5) return "Je réfléchis aux concepts clés du cours...";
    if (elapsedSec <= 8) return "Je structure l'explication adaptée à vos supports...";
    return "Je finalise la réponse détaillée...";
  }

  // 4. Code / Informatique
  const isCode = /(code|programme|fonction|python|javascript|typescript|c\+\+|java|algorithme|script|html|css|sql|bug|erreur)/i.test(cleanPrompt);
  if (isCode) {
    if (elapsedSec <= 2) return "J'analyse le code et la logique...";
    if (elapsedSec <= 5) return "Je réfléchis à la solution optimale...";
    if (elapsedSec <= 8) return "Je structure l'implémentation et les explications...";
    return "Je vérifie la syntaxe et finalise...";
  }

  // 5. Schéma / Dessin vectoriel
  const isDrawing = /(dessin|schéma|figure|graphique|svg|tracer|illustr|circuit)/i.test(cleanPrompt);
  if (isDrawing) {
    if (elapsedSec <= 2) return "J'analyse la structure visuelle à représenter...";
    if (elapsedSec <= 5) return "Je conçois le schéma vectoriel...";
    return "Je finalise le tracé graphique...";
  }

  // 6. Message court ou salutation
  if (cleanPrompt.length < 15 && /(cc|salut|bonjour|coucou|hello|hi|hey|merci)/i.test(cleanPrompt)) {
    if (elapsedSec <= 2) return "Je vous réponds...";
    return "Je prépare votre réponse...";
  }

  // 7. Question générale / explication de cours (cas par défaut)
  if (elapsedSec <= 2) return "J'analyse votre question...";
  if (elapsedSec <= 5) return "Je réfléchis...";
  if (elapsedSec <= 8) return "Je structure les explications pas à pas...";
  return "Je finalise la réponse détaillée...";
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
}: {
  retryPrompt?: string;
  onRetry: () => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleAction = () => {
    setIsRetrying(true);
    onRetry();
  };

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
          onClick={handleAction}
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

function SvgDiagramCard({ svgContent }: { svgContent: string }) {
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
  const [aiActivityText, setAiActivityText] = useState<string>('Je réfléchis...');
  const activityTimerRef = useRef<any>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  
  // Barre de propositions collée au clavier
  const [showProposalBar, setShowProposalBar] = useState(true);
  
  // Création active suivie pour modification et itération continue
  const [activeCreation, setActiveCreation] = useState<AiCreation | null>(null);

  // Modèles IA configurés dans le Tableau de Bord
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; nickname?: string; rawName?: string; provider: string; model_id?: string }>>([
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (Fast)', provider: 'cloudflare' },
    { id: 'gemini-3.8-flash', name: 'Google Gemini 3.8 Flash', provider: 'google' },
    { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B', provider: 'cloudflare' },
    { id: '@cf/moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: 'cloudflare' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini', provider: 'openai' },
  ]);

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

  // Chargement dynamique des modèles configurés dans le Tableau de Bord
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
              
              // Priorité absolue au surnom personnalisé configuré dans le Tableau de Bord
              const cleanNick = (m.nickname && typeof m.nickname === 'string') ? stripWorkerAi(m.nickname) : '';
              const rawName = m.name || id;
              const displayName = cleanNick.length > 0 ? cleanNick : stripWorkerAi(rawName);

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
            const currentExists = cleaned.some((m: any) => m.id === selectedModel);
            if (!currentExists && res.config?.default_model) {
              let def = res.config.default_model;
              if (def === '@cf/meta/llama-3.3-70b-instruct') def = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
              if (def === 'gemini-2.0-flash' || def === 'gemini-2.5-flash') def = 'gemini-3.8-flash';
              const defExists = cleaned.some((m: any) => m.id === def);
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
          }
        }
      })
      .catch((err) => {
        console.warn('[AssistantChat] Erreur chargement modèles du Tableau de Bord:', err);
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

    // Initialisation du statut dynamique à l'instant T
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    const startTimestamp = Date.now();
    const activeDocName = resolvedActiveItem?.name || resolvedActiveItem?.title || '';
    const initialDocNames: string[] = activeDocName ? [activeDocName] : [];
    if (Array.isArray(attachedResources)) {
      for (const r of attachedResources) {
        if (r?.name && !initialDocNames.includes(r.name)) initialDocNames.push(r.name);
      }
    }
    setAiActivityText(getLiveAiActivity(userText, initialDocNames, 0, requestedTypeOverride));
    activityTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      setAiActivityText(getLiveAiActivity(userText, initialDocNames, elapsed, requestedTypeOverride));
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
      // 1. Rassemblement de tous les documents (Actif en Orange + Pièces jointes en Bleu, jusqu'à 3 max)
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
Uniquement si l'étudiant te demande expressément et clairement de CONCEVOIR / FABRIQUER / GÉNÉRER un module d'apprentissage interactif complet parmi les 4 grandes catégories :
- Faire un Résumé ou créer un PDF :
  * 'resume' : Fiche de synthèse structurée (overview, key_points, definitions, rules)
  * 'pdf' : Polycopié ou document d'étude officiel (title, sections, content)
- Questionnaire ou Carte Mentale :
  * 'questionnaire' : Quiz QCM interactif (questions avec choix A/B/C/D, correct, explanation)
  * 'questionnaire-test' : Test noté avec chronomètre et barème
  * 'carte-mentale' : Mindmap arborescente (thème central, branches principales, sous-branches)
  * 'carte-memoire' : Flashcards mémorisation (recto question/concept, verso réponse/détail)
- Vrai ou Faux / Exercice Écrit / Devoir Complet :
  * 'vrai-ou-faux' : Affirmations Vrai ou Faux avec justification détaillée
  * 'vrai-ou-faux-test' : Épreuve Vrai/Faux notée
  * 'exercices-ecrits' : Série d'exercices d'application avec énoncé et correction guidée
  * 'devoir-complet' : Sujet d'examen complet avec parties, exercices et barème
- Infographie :
  * 'infographie' : Fiche visuelle avec repères visuels, chiffres clés, métriques, chronologie

DANS CE CAS DE CRÉATION EXCLUSIVEMENT :
Tu réponds sous la forme d'un objet JSON strict :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "questionnaire" | "carte-mentale" | "carte-memoire" | "resume" | "pdf" | "infographie" | "vrai-ou-faux" | "exercices-ecrits" | "devoir-complet",
  "creation_title": "Titre explicite de la création",
  "chat_response": "Court message amical d'une phrase pour le fil de discussion (ex: J'ai conçu votre questionnaire dans l'espace Création à droite !)",
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
- DANS LES CRÉATIONS (Questionnaires, QCM, Cartes, Exercices) : Toute formule dans l'énoncé et dans CHAQUE option de réponse DOIT impérativement être entourée de dollars, par exemple : "$T(j\\omega) = \\dfrac{T_0}{1 + j\\dfrac{\\omega}{\\omega_0}}$".`;

      if (docNames.length > 0) {
        systemContent += `\n\nDOCUMENTS FOURNIS PAR L'ÉTUDIANT :\nL'utilisateur a ouvert ${docNames.length} document(s) d'étude : ${docNames.map(n => `"${n}"`).join(', ')}. Tu as un accès direct et complet au contenu textuel de ces documents.`;
      }

      if (activeCreation) {
        systemContent += `\n\nCRÉATION ACTUELLE DANS L'ESPACE DE DROITE ("${activeCreation.title}", type: "${activeCreation.toolType}") : Si l'utilisateur demande explicitement de la modifier, l'enrichir ou la mettre à jour, réponds en mode création JSON avec la version actualisée.`;
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
        return;
      }

      const rawResponseText = aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.";
      setIsWaitingServer(false);

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
        const normType = normalizeCreationType(aiResult.creation_type || explicitToolType || 'questionnaire');
        creationParsed = {
          title: aiResult.creation_title || `${normType.toUpperCase()} : ${mainDocName}`,
          content: aiResult.creation_data,
          toolType: normType,
        };
        companionChatMessage = aiResult.chat_response || '';
      } else if (hasCreationClues) {
        const jsonMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || rawResponseText.match(/(\{[\s\S]*\})/);
        const candidate = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawResponseText;
        const parsed = safeJsonParse(candidate);

        if (parsed && typeof parsed === 'object') {
          const parsedData = parsed.creation_data || (parsed.questions || parsed.affirmations || parsed.cards || parsed.root || parsed.overview || parsed.sections || parsed.exercises || parsed.exercices || parsed.written_exercise || parsed.complete_exam ? parsed : null);
          if (parsedData) {
            const detectedType = parsed.creation_type || (parsed.questions ? 'questionnaire' : parsed.affirmations ? 'vrai-ou-faux' : parsed.cards ? 'carte-memoire' : parsed.root ? 'carte-mentale' : parsed.overview ? 'resume' : explicitToolType || 'questionnaire');
            const normType = normalizeCreationType(detectedType);
            creationParsed = {
              title: parsed.creation_title || parsed.title || `${normType.toUpperCase()} : ${mainDocName}`,
              content: parsedData,
              toolType: normType,
            };
            companionChatMessage = parsed.chat_message || parsed.chat_response || '';
          }
        }

        // Si l'utilisateur a explicitement cliqué sur un bouton d'action (override)
        if (!creationParsed && isExplicitOverride && explicitToolType) {
          const p = parseOrBuildAiCreation(explicitToolType, rawResponseText, mainDocName, userText);
          if (p.content && (p.content.questions?.length > 0 || p.content.overview || p.content.root || p.content.metrics || p.content.sections || p.content.affirmations || p.content.cards || p.content.exercises || p.content.exercices)) {
            creationParsed = {
              title: p.title,
              content: p.content,
              toolType: explicitToolType,
            };
          } else {
            creationParsed = {
              title: p.title || `${explicitToolType} : ${mainDocName}`,
              content: p.content || null,
              toolType: explicitToolType,
            };
          }
        }
      }

      if (creationParsed && creationParsed.content) {
        const effectiveToolType = creationParsed.toolType || explicitToolType || 'questionnaire';
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
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));

        // Nettoyage radical du texte pour la discussion : JAMAIS de JSON brut !
        const cleanIntro = cleanChatText(companionChatMessage || aiResult.chat_response || rawResponseText);

        fullResponseText = `${cleanIntro ? cleanIntro + '\n\n' : ''}✨ J'ai généré votre **${newCreation.title}** directement dans votre espace **Création** !

👉 *Retrouvez et testez votre création dans le volet de droite (ou l'onglet Création sur mobile).*`;
      } else {
        // BRANCHE DISCUSSION SIMPLE DANS LE CHAT : Réponse directe sans rien déranger dans l'espace création
        const cleaned = cleanChatText(aiResult.chat_response || rawResponseText);
        fullResponseText = stripAiReasoningScratchpad(cleaned) || "✨ Votre demande a été traitée avec succès.";
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
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        setIsWaitingServer(false);
        setIsTyping(false);
        return;
      }
      console.error('[AssistantChat] Erreur appel IA:', err);
      setIsWaitingServer(false);
      setIsTyping(false);
      window.dispatchEvent(new CustomEvent('ai-creation-error', { detail: { error: err.message } }));
      
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
      const promptText = e.detail?.prompt;
      const reqType = e.detail?.requested_type;
      if (promptText) {
        sendMessage(promptText, reqType);
      }
    };
    window.addEventListener('auto-prompt', handleAutoPrompt as any);
    return () => window.removeEventListener('auto-prompt', handleAutoPrompt as any);
  }, [messages, isTyping, activePreviewItem, attachedResources, activeCreation, currentConversationId]);

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

          {/* Sélecteur de Modèle IA (Configurés dans le Tableau de Bord) */}
          <div className="relative shrink-0" ref={modelDropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white active:scale-95 shrink-0 shadow-xs"
              title="Changer de modèle IA (Configurés depuis le Tableau de Bord)"
            >
              <span className="max-w-[110px] sm:max-w-[140px] truncate">{currentModelDisplay}</span>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-60 sm:w-68 bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Modèles IA du Tableau de Bord</span>
                  <span className="text-[9px] text-zinc-500 font-normal">{availableModels.length} actifs</span>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {availableModels.map((m) => {
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
                  })}
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
                      onRetry={() => {
                        const targetPrompt = msg.retryPrompt || (() => {
                          const idx = messages.findIndex(m => m.id === msg.id);
                          const before = idx >= 0 ? messages.slice(0, idx) : messages;
                          const lastUser = [...before].reverse().find(m => m.sender === 'user');
                          return lastUser?.text || '';
                        })();
                        setMessages(prev => prev.filter(m => m.id !== msg.id));
                        if (targetPrompt) sendMessage(targetPrompt);
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
                          onClick={() => {
                            const targetPrompt = msg.retryPrompt || (() => {
                              const idx = messages.findIndex(m => m.id === msg.id);
                              const before = idx >= 0 ? messages.slice(0, idx) : messages;
                              const lastUser = [...before].reverse().find(m => m.sender === 'user');
                              return lastUser?.text || '';
                            })();
                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                            if (targetPrompt) sendMessage(targetPrompt);
                          }}
                          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95"
                        >
                          <RotateCw className="w-3 h-3 text-orange-400" />
                          <span>Réessayer</span>
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
