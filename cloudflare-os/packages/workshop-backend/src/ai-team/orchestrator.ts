/**
 * ============================================================================
 * STUDYCLOUD - ORCHESTRATEUR DE L'ÉQUIPE MULTI-AGENTS (CHEF D'ÉQUIPE)
 * ============================================================================
 * Llama 3.3 70B Fast est désigné comme Chef d'Équipe.
 * Quand Llama 3.3 est sélectionné :
 * - Il mobilise les experts spécialisés (Whisper Audio, Llama Vision, Gemini Vidéo, DeepSeek Calcul).
 * - Il synthétise tous leurs rapports et produit la réponse finale pédagogique.
 * 
 * RÈGLE STRICTE :
 * Si l'utilisateur choisit un autre modèle spécifique (Gemini, DeepSeek, Claude...),
 * ce modèle s'exécute SEUL de manière individuelle sans délégation.
 * ============================================================================
 */

import { OrchestrationInput, OrchestrationResult, ExpertReport } from './types.js';
import { callWhisperExpert, callVisionExpert, callVideoExpert, callMathExpert } from './experts.js';

export function isChefModel(targetModel: string): boolean {
  if (!targetModel) return true;
  const m = targetModel.toLowerCase();
  return (
    m.includes('llama-3.3') ||
    m === 'default' ||
    m.includes('chef') ||
    m.includes('multi-ia') ||
    m.includes('multi-agent')
  );
}

export async function orchestrateMultiAgentTeam(
  input: OrchestrationInput
): Promise<OrchestrationResult> {
  const {
    targetModel,
    userPrompt,
    messages,
    systemPrompt,
    docContent,
    docName,
    imageBase64,
    audioBase64,
    videoBase64,
    videoUrl,
    cfToken,
    accountId,
    geminiKey,
  } = input;

  // 1. VÉRIFICATION STRICTE : Seul Llama 3.3 a la capacité de Chef d'équipe
  if (!isChefModel(targetModel)) {
    return {
      isOrchestrated: false,
      expertsUsed: [],
      finalAnswer: '',
      effectiveModelUsed: targetModel,
    };
  }

  // 2. DÉTECTION DES EXPERTS NÉCESSAIRES
  const expertTasks: Promise<ExpertReport>[] = [];
  const expertsMobilized: string[] = [];

  // A. Expert Audio (Whisper)
  if (audioBase64 && audioBase64.length > 50) {
    expertsMobilized.push('👂 Whisper Audio');
    expertTasks.push(callWhisperExpert(audioBase64, cfToken, accountId));
  }

  // B. Expert Vision (Llama 3.2 11B Vision)
  if (imageBase64 && imageBase64.length > 50) {
    expertsMobilized.push('👁️ Vision & Exercices');
    expertTasks.push(callVisionExpert(imageBase64, cfToken, accountId, userPrompt));
  }

  // C. Expert Vidéo (Gemini 2.5 Flash)
  const hasVideo = (videoBase64 && videoBase64.length > 100) || (videoUrl && videoUrl.length > 10);
  if (hasVideo && geminiKey) {
    expertsMobilized.push('🎬 Gemini 2.5 Flash Vidéo');
    expertTasks.push(callVideoExpert(videoBase64 || '', videoUrl || '', geminiKey));
  }

  // D. Expert Calcul & Démonstrations (DeepSeek R1)
  const isHeavyMath = /(?:calcul|d[eé]montr|d[eé]riv[eé]|int[eé]gral|imp[eé]dance|fonction\s+de\s+transfert|filtre|quadrip[oô]le|matrice|diagonalis|laplace|fourier)/i.test(userPrompt);
  if (isHeavyMath && (docContent || userPrompt.length > 30)) {
    expertsMobilized.push('🧮 DeepSeek R1 Raisonnement');
    expertTasks.push(callMathExpert(userPrompt, docContent || '', cfToken, accountId));
  }

  // 3. EXÉCUTION PARALLÈLE DES EXPERTS SPÉCIALISÉS
  const expertResults = await Promise.allSettled(expertTasks);
  const expertReports: string[] = [];
  const successfulExperts: string[] = [];

  for (const res of expertResults) {
    if (res.status === 'fulfilled' && res.value && res.value.status === 'success' && res.value.content) {
      const exp = res.value;
      if (exp.expert === 'whisper-audio') {
        successfulExperts.push('👂 Whisper Audio');
        expertReports.push(`[ENREGISTREMENT AUDIO TRANSCRIT DE L'ÉTUDIANT] :\n${exp.content}`);
      } else if (exp.expert === 'llama-vision') {
        successfulExperts.push('👁️ Vision & Exercices');
        expertReports.push(`[ÉNONCÉ, SCHÉMA ET CONTENU DIRECTS DE L'IMAGE DE L'ÉTUDIANT] :\n${exp.content}`);
      } else if (exp.expert === 'gemini-video') {
        successfulExperts.push('🎬 Vidéo');
        expertReports.push(`[CONTENU DE LA VIDÉO ANALYSÉE] :\n${exp.content}`);
      } else if (exp.expert === 'deepseek-math') {
        successfulExperts.push('🧮 Calculs R1');
        expertReports.push(`[RÉSOLUTIONS ET CALCULS SCIENTIFIQUES] :\n${exp.content}`);
      }
    }
  }

  // 4. SYNTHÈSE DU CHEF D'ÉQUIPE (Llama 3.3 70B Fast)
  // LE CHEF D'ÉQUIPE CONSERVE SON IDENTITÉ ET SES CONSIGNES MULTI-AGENTS EN PERMANENCE
  // (sur le 1er message, le 2ème message, le 3ème message, et pour toute la discussion)
  const chefDirectiveHeader = `══════════════════════════════════════════════════════════════════════════════
[DIRECTIVES SUPRÊMES DE RÉSOLUTION ET DE DISCRÉTION PÉDAGOGIQUE STUDYCLOUD] :
Tu es le Tuteur et Professeur IA en chef de StudyCloud (Llama 3.3 70B Fast). Tu t'adresses DIRECTEMENT, PERSONNELLEMENT et CHALEUREUSEMENT à l'étudiant.

RÈGLE 1 — INTERDICTION ABSOLUE DE PARLER D'"OUTIL DE VISION" OU DE MÉCANIQUE TECHNIQUE :
- IL EST STRICTEMENT ET FORMELLEMENT INTERDIT de mentionner à l'étudiant des termes tels que : "outil de vision", "expert vision", "rapport de vision", "système OCR", "l'outil a extrait", "notre outil", etc.
- Pour l'étudiant, C'EST TOI DIRECTEMENT QUI REGARDES SON IMAGE, comme un enseignant qui a sa feuille de devoir ou son cahier sous les yeux.
- Parle naturellement et directement de son travail : "Sur ton image...", "D'après l'énoncé de ton exercice...", "Pour la question 1 :", etc.
- IL EST FORMELLEMENT INTERDIT de conseiller à l'étudiant d'utiliser "l'outil de vision" ou de dire que tu fais appel à un outil externe !

RÈGLE 2 — RÉSOUDRE COMPLÈTEMENT ET RÉELLEMENT L'EXERCICE (JAMAIS DE SIMPLES ÉTAPES ABSTRAITES SANS CALCUL) :
- Quand l'étudiant te demande de résoudre un exercice, un devoir ou un calcul :
  * IL EST STRICTEMENT INTERDIT de te contenter de lister des étapes théoriques, des conseils méthodologiques généraux ou des consignes abstraites ("Étape 1 : identifier la loi, Étape 2 : faire le calcul") SANS RÉSOUDRE !
  * TU DOIS RÉSOUDRE DIRECTEMENT, ENTIÈREMENT ET INTÉGRALEMENT CHAQUE QUESTION jusqu'au résultat final numérique ou algébrique exact.
  * Pour chaque question présente sur l'image :
    1. Écris l'intitulé clair (ex : "## Question 1 : Calcul de la pulsation propre $\\omega_0$").
    2. Pose la formule théorique générale.
    3. Remplace par les vraies valeurs numériques de l'exercice (application numérique pas à pas).
    4. Effectue le calcul arithmétique complet.
    5. Encadre impérativement le résultat final avec son unité :
       $$ \\boxed{\\text{Résultat final exact avec unité}} $$
  * Résous TOUTES les questions visibles de l'exercice (Question 1, Question 2, Question 3...) sans rien laisser en suspens ni renvoyer l'étudiant à ses propres calculs.

RÈGLE 3 — INTERDICTION FORMELLE DE DIRE QUE TU NE PEUX PAS VOIR LES IMAGES :
- IL EST STRICTEMENT INTERDIT d'écrire "je ne peux pas voir les images directement", "comme je suis une IA je n'ai pas d'yeux", ou de demander à l'étudiant "pouvez-vous me décrire ce que contient l'image ?" ou "pouvez-vous transcrire le texte" !
- L'énoncé et les données de l'image sont fournis ci-dessous : exploite-les immédiatement pour corriger et résoudre l'exercice de l'élève.
- Si l'élève te demande la suite ("LIMAGE ENVOYER", "fais la suite", "la question 2", etc.), résous immédiatement ce qui est demandé à partir des données de l'image déjà connues dans la conversation.

RÈGLE 4 — RÈGLE DES FRACTIONS ET FORMULES LATEX :
- TOUTE fraction mathématique ou physique DOIT IMPÉRATIVEMENT être rédigée avec \\dfrac{numérateur}{dénominateur}. JAMAIS de slash '/'.
- Encadre chaque résultat final majeur avec \\boxed{...} dans un bloc centré $$ \\boxed{...} $$.
══════════════════════════════════════════════════════════════════════════════`;

  let enrichedSystemPrompt = `${chefDirectiveHeader}\n\n${systemPrompt}`;

  if (expertReports.length > 0) {
    enrichedSystemPrompt += `\n\n══════════════════════════════════════════════════════════════════════════════
[CONTENU DIRECT DU DOCUMENT / IMAGE TRANSMIS PAR L'ÉTUDIANT] :
Voici l'énoncé, les figures et les données exactes visibles sur l'image ou le document de l'étudiant :
${expertReports.join('\n\n')}

MISSION PÉDAGOGIQUE DU TUTEUR :
Résous immédiatement et intégralement chaque question pour l'étudiant, avec tous les calculs réels et les résultats encadrés, sans jamais mentionner aucun outil ni t'arrêter à de simples étapes.
══════════════════════════════════════════════════════════════════════════════`;
  } else if (!imageBase64) {
    const isImageOrExerciseRelated = (
      (docName && /\.(png|jpe?g|webp|gif|bmp)$/i.test(docName)) ||
      (docContent && docContent.includes('[Image haute résolution')) ||
      /(image|photo|exercice|question|sch[eé]ma|figure|page|feuille|devoir|sujet|nonc[eé]|tableau|calcul)/i.test(userPrompt)
    );
    if (isImageOrExerciseRelated) {
      enrichedSystemPrompt += `\n\n══════════════════════════════════════════════════════════════════════════════
[RAPPEL CONTEXTUEL DE L'IMAGE / EXERCICE AU PROFESSEUR TUTEUR] :
L'étudiant fait référence à l'exercice, devoir ou image abordé dans cette session.
1. INTERDICTION FORMELLE DE PARLER D'"OUTIL DE VISION" OU D'EXTRACTION OCR : N'en parle JAMAIS à l'élève.
2. INTERDICTION DE TE LIMITER À DES ÉTAPES : Résous DIRECTEMENT et ENTIÈREMENT chaque question avec tous les calculs arithmétiques réels, formules KaTeX \\dfrac{}{} et résultats encadrés \\boxed{...}.
3. Si les données de l'exercice ou de l'image figurent déjà dans l'historique de la discussion ci-dessus, reprends-les immédiatement pour calculer les réponses finales sans redemander l'énoncé et SANS JAMAIS dire que tu ne peux pas voir l'image.
══════════════════════════════════════════════════════════════════════════════`;
    }
  }

  const cfMessages: any[] = [];
  if (enrichedSystemPrompt) {
    cfMessages.push({ role: 'system', content: enrichedSystemPrompt });
  }
  for (const m of messages) {
    cfMessages.push({ role: m.role, content: m.content });
  }

  const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      messages: cfMessages,
      max_tokens: 8192,
    }),
  });

  if (!cfRes.ok) {
    const errText = await cfRes.text();
    throw new Error(`Erreur Chef Llama 3.3 (${cfRes.status}): ${errText}`);
  }

  const cfData: any = await cfRes.json();
  const msg = cfData?.choices?.[0]?.message;
  const rawAns = msg?.content || msg?.reasoning_content || '';
  const sanitizedAns = sanitizePedagogicalOutput(rawAns);

  const modelLabel = successfulExperts.length > 0
    ? `Llama 3.3 70B (Chef d'Équipe) + ${successfulExperts.join(' • ')}`
    : "Llama 3.3 70B (Chef d'Équipe Multi-IA)";

  return {
    isOrchestrated: true,
    expertsUsed: successfulExperts,
    finalAnswer: sanitizedAns,
    effectiveModelUsed: modelLabel,
  };
}

/**
 * Nettoie impérativement toute fuite accidentelle de vocabulaire technique
 * (outil de vision, expert vision, rapport OCR...) pour que la communication
 * envers l'étudiant reste 100% naturelle et pédagogique.
 */
export function sanitizePedagogicalOutput(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(?:grâce à|via|selon|d'après|avec)\s+l'outil\s+de\s+vision/gi, "d'après votre document")
    .replace(/l'outil\s+de\s+vision\s+(?:a\s+extrait|montre|indique|permet\s+de)/gi, "l'image montre")
    .replace(/vous\s+pouvez\s+utiliser\s+l'outil\s+de\s+vision\s*(?:pour[^.\n]*)?[.]?/gi, '')
    .replace(/l'outil\s+de\s+vision/gi, "l'image")
    .replace(/expert\s+vision/gi, "l'analyse visuelle")
    .replace(/rapport\s+(?:ocr|vision|d'extraction)/gi, "énoncé de l'exercice")
    .trim();
}
