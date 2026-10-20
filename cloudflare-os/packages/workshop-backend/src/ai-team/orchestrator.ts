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
    expertsMobilized.push('👁️ Llama 3.2 Vision');
    expertTasks.push(callVisionExpert(imageBase64, cfToken, accountId));
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

  for (const res of expertResults) {
    if (res.status === 'fulfilled' && res.value && res.value.status === 'success' && res.value.content) {
      const exp = res.value;
      if (exp.expert === 'whisper-audio') {
        expertReports.push(`[RAPPORT EXPERT AUDIO (Whisper)] :\n${exp.content}`);
      } else if (exp.expert === 'llama-vision') {
        expertReports.push(`[RAPPORT EXPERT VISION (Llama 3.2 Vision)] :\n${exp.content}`);
      } else if (exp.expert === 'gemini-video') {
        expertReports.push(`[RAPPORT EXPERT VIDÉO (Gemini 2.5 Flash)] :\n${exp.content}`);
      } else if (exp.expert === 'deepseek-math') {
        expertReports.push(`[RAPPORT EXPERT CALCUL ALGEBRIQUE (DeepSeek R1)] :\n${exp.content}`);
      }
    }
  }

  // 4. SYNTHÈSE DU CHEF D'ÉQUIPE (Llama 3.3 70B Fast)
  let enrichedSystemPrompt = systemPrompt;

  if (expertReports.length > 0) {
    enrichedSystemPrompt += `\n\n══════════════════════════════════════════════════════════════════════════════
[CONSULTATION MULTI-AGENTS - RAPPORTS TRANSMIS AU CHEF D'ÉQUIPE] :
En tant que Chef d'équipe, tes experts spécialisés ont analysé les fichiers multimédias et calculs complexes de l'étudiant :
${expertReports.join('\n\n')}

MISSION DU CHEF D'ÉQUIPE :
Intègre harmonieusement ces données d'experts dans ta réponse finale.
Ne dis pas de jargon technique aux étudiants : parle avec fluidité, pédagogie et bienveillance en t'appuyant sur ces éléments réels.
══════════════════════════════════════════════════════════════════════════════`;
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

  const modelLabel = expertsMobilized.length > 0
    ? `Llama 3.3 70B (Chef d'Équipe) + ${expertsMobilized.join(', ')}`
    : "Llama 3.3 70B (Chef d'Équipe Multi-IA)";

  return {
    isOrchestrated: true,
    expertsUsed: expertsMobilized,
    finalAnswer: rawAns,
    effectiveModelUsed: modelLabel,
  };
}
