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
import { callWhisperExpert, callVisionExpert, callVideoExpert, callMathExpert, callCodeExpert } from './experts.js';

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
    documentBase64,
    documentImages,
    cfToken,
    accountId,
    geminiKey,
    requestedType,
    perceptionReport,
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

  // 2. DÉTECTION ET MOBILISATION DES EXPERTS DE L'ÉQUIPE
  const expertTasks: Promise<ExpertReport>[] = [];
  const expertsMobilized: string[] = [];

  // A. Expert Audio (Whisper)
  if (audioBase64 && audioBase64.length > 50) {
    expertsMobilized.push('👂 Whisper Audio');
    expertTasks.push(callWhisperExpert(audioBase64, cfToken, accountId));
  }

  // B. Expert Vision de secours (Llama 3.2 11B Vision) - si pas de rapport visuel complet
  if (imageBase64 && imageBase64.length > 50 && (!perceptionReport || perceptionReport.length < 20)) {
    expertsMobilized.push('👁️ Llama Vision');
    expertTasks.push(callVisionExpert(imageBase64, cfToken, accountId, userPrompt));
  }

  // C. Expert Vidéo dédié
  const hasVideo = (videoBase64 && videoBase64.length > 100) || (videoUrl && videoUrl.length > 10);
  if (hasVideo && geminiKey) {
    expertsMobilized.push('🎬 Gemini Flash Vidéo');
    expertTasks.push(callVideoExpert(videoBase64 || '', videoUrl || '', geminiKey));
  }

  // Analyse contextuelle élargie (Prompt + Nom de doc + Contenu + Rapport de perception Gemini)
  const combinedContext = `${userPrompt} ${docName || ''} ${(docContent || '').slice(0, 4000)} ${(perceptionReport || '').slice(0, 4000)}`;

  // D. Expert Calcul & Démonstrations Algébriques (DeepSeek R1 Raisonnement 32B)
  const isHeavyMathOrScience = /(?:calcul|d[eé]montr|d[eé]riv[eé]|int[eé]gral|imp[eé]dance|fonction\s+de\s+transfert|filtre|quadrip[oô]le|matrice|diagonalis|laplace|fourier|bode|pulsation|fr[eé]quence\s+de\s+coupure|th[eé]or[eè]me|ohm|amp[eè]re|volt|watt|r[eé]sistance|condensateur|bobine|aop|amplificateur|primitive|limite|suite|complexe|vecteur|diff[eé]rentiel|physique|chimie|m[eé]canique|r[eé]solution|exercice|valeur\s+num[eé]rique)/i.test(combinedContext);
  if (isHeavyMathOrScience && (docContent || perceptionReport || userPrompt.length > 15)) {
    expertsMobilized.push('🧮 DeepSeek R1 Raisonnement');
    const mathContext = perceptionReport || docContent || '';
    expertTasks.push(callMathExpert(userPrompt, mathContext, cfToken, accountId));
  }

  // E. Expert Programmation & Algorithmes (Kimi K2.7 Code)
  const isCodeOrAlgorithm = /(?:code|programme|algorithme|python|script|javascript|typescript|c\+\+|java|html|css|sql|boucle|fonction|array|tableau|pile|file|arborescence|d[eé]bog|compiler|syntaxe|terminal|api|json|git|d[eé]veloppement)/i.test(combinedContext);
  if (isCodeOrAlgorithm && (docContent || perceptionReport || userPrompt.length > 15)) {
    expertsMobilized.push('💻 Kimi K2.7 Code');
    const codeContext = perceptionReport || docContent || '';
    expertTasks.push(callCodeExpert(userPrompt, codeContext, cfToken, accountId));
  }

  // 3. EXÉCUTION PARALLÈLE DES EXPERTS SPÉCIALISÉS
  const expertResults = await Promise.allSettled(expertTasks);
  const expertReports: string[] = [];
  const successfulExperts: string[] = [];

  // Intégration prioritaire du dossier de perception multimédia Gemini Flash (Images, Documents PDF/Word, Schémas, Audio/Vidéo)
  if (perceptionReport && perceptionReport.trim().length > 15) {
    successfulExperts.push('👁️ Gemini Flash (Perception Multimodale)');
    expertReports.push(`[DOSSIER DE PERCEPTION MULTIMODALE DU FICHIER TRANSMIS PAR GEMINI FLASH] :\n${perceptionReport.trim()}`);
  }

  for (const res of expertResults) {
    if (res.status === 'fulfilled' && res.value && res.value.status === 'success' && res.value.content) {
      const exp = res.value;
      if (exp.expert === 'whisper-audio') {
        successfulExperts.push('👂 Whisper Audio');
        expertReports.push(`[ENREGISTREMENT AUDIO TRANSCRIT DE L'ÉTUDIANT (WHISPER)] :\n${exp.content}`);
      } else if (exp.expert === 'llama-vision') {
        successfulExperts.push('👁️ Llama Vision');
        expertReports.push(`[ÉNONCÉ ET OBSERVATIONS DU SCHÉMA / IMAGE (LLAMA VISION)] :\n${exp.content}`);
      } else if (exp.expert === 'gemini-video') {
        successfulExperts.push('🎬 Gemini Vidéo');
        expertReports.push(`[ANALYSE DE LA VIDÉO DE COURS (GEMINI FLASH)] :\n${exp.content}`);
      } else if (exp.expert === 'deepseek-math') {
        successfulExperts.push('🧮 DeepSeek R1 Calcul');
        expertReports.push(`[RÉSOLUTIONS, CALCULS ET DÉMONSTRATIONS PAS À PAS (DEEPSEEK R1)] :\n${exp.content}`);
      } else if (exp.expert === 'kimi-code') {
        successfulExperts.push('💻 Kimi K2.7 Code');
        expertReports.push(`[SOLUTION ALGORITHMIQUE ET CODE SOURCE COMMENTÉ (KIMI CODE)] :\n${exp.content}`);
      }
    }
  }

  // 4. SYNTHÈSE DU CHEF D'ÉQUIPE (Llama 3.3 70B Fast)
  // LE CHEF D'ÉQUIPE CONSERVE SON IDENTITÉ ET SES CONSIGNES MULTI-AGENTS EN PERMANENCE
  const chefDirectiveHeader = `══════════════════════════════════════════════════════════════════════════════
[DIRECTIVES SUPRÊMES DU CHEF D'ÉQUIPE STUDYCLOUD - AGENT DELMAS (LLAMA 3.3 70B)] :
Tu es l'Agent Delmas, le Tuteur et Professeur IA en chef de StudyCloud. Tu t'adresses DIRECTEMENT, CHALEUREUSEMENT et PÉDAGOGIQUEMENT à l'étudiant.

RÈGLE 1 — CONFIDENTIALITÉ ABSOLUE DES OUTILS INTERNES :
- Il est strictement interdit de mentionner des termes d'ingénierie interne tels que "outil de vision", "rapport OCR", "extraction brute" ou "appel aux experts".
- Parle naturellement : "Sur ton schéma...", "Dans ton cours...", "L'énoncé de l'exercice indique...", "La fonction de transfert s'écrit...".

RÈGLE 2 — RÉSOUDRE COMPLÈTEMENT ET RÉELLEMENT SANS RESTER AU STADE DES ÉTAPES :
- Quand l'étudiant pose une question ou demande la résolution d'un exercice :
  * Ne te limite JAMAIS à donner des conseils généraux ou des étapes vagues.
  * Résous directement et entièrement chaque question avec calculs réels, formules KaTeX standard ($...$ en ligne, $$...$$ en bloc centré avec \\dfrac{}{}) et résultats finaux encadrés $$ \\boxed{\\text{Résultat}} $$.

RÈGLE 3 — SYNTHÈSE PÉDAGOGIQUE PARFAITE :
- Exploite harmonieusement les observations visuelles de Gemini Flash, les calculs précis de DeepSeek R1, les codes de Kimi et les transcriptions audio pour donner une réponse limpide et encourageante.
══════════════════════════════════════════════════════════════════════════════`;

  let enrichedSystemPrompt = `${chefDirectiveHeader}\n\n${systemPrompt}`;

  if (expertReports.length > 0) {
    enrichedSystemPrompt += `\n\n══════════════════════════════════════════════════════════════════════════════
[SYNTHÈSE DU DOCUMENT & DOSSIERS DES EXPERTS DE L'ÉQUIPE] :
Voici les éléments précis observés, calculés et programmés pour ce cours ou cet exercice :
${expertReports.join('\n\n')}

MISSION DU PROFESSEUR EN CHEF :
Rédige ta réponse pédagogique complète pour l'élève en t'appuyant sur ces données exactes.
══════════════════════════════════════════════════════════════════════════════`;
  }

  const cfMessages: any[] = [];
  if (enrichedSystemPrompt) {
    cfMessages.push({ role: 'system', content: enrichedSystemPrompt });
  }

  const activeDocInfo = perceptionReport || docContent;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (i === messages.length - 1 && m.role === 'user') {
      if (activeDocInfo || docName) {
        cfMessages.push({
          role: 'user',
          content: `[DOCUMENT / COURS ACTIF DE L'ÉTUDIANT : « ${docName || "Document d'étude"} »] :\n${activeDocInfo ? activeDocInfo.slice(0, 25000) : "Document joint par l'étudiant."}\n\n[CONSIGNE PÉDAGOGIQUE POUR LE CHEF TUTEUR] :\nL'étudiant travaille activement sur ce cours (« ${docName || "Document d'étude"} ») et demande : « ${m.content} ».\nRéponds directement, chaleureusement et précisément à sa question en t'appuyant sur ce document et les dossiers de ton équipe.\nNe mentionne aucun ancien sujet de la conversation et ne demande jamais de renvoyer le document.\n\n[MESSAGE DE L'ÉTUDIANT] :\n${m.content}`,
        });
      } else {
        cfMessages.push({ role: m.role, content: m.content });
      }
    } else {
      cfMessages.push({ role: m.role, content: m.content });
    }
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
    ? `Agent Delmas (Chef Multi-IA) • ${successfulExperts.join(' • ')}`
    : "Agent Delmas (Chef Multi-IA)";

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
