/**
 * ============================================================================
 * STUDYCLOUD - EXPERTS SPÉCIALISÉS DE L'ÉQUIPE MULTI-AGENTS
 * ============================================================================
 * 1. 👂 Expert Audio : Whisper (@cf/openai/whisper)
 * 2. 👁️ Expert Vision : Llama 3.2 11B Vision (@cf/meta/llama-3.2-11b-vision-instruct)
 * 3. 🎬 Expert Vidéo : Gemini 2.5 Flash Multimodal (Google AI)
 * 4. 🧮 Expert Calcul : DeepSeek R1 Distill 32B (@cf/deepseek-ai/deepseek-r1-distill-qwen-32b)
 * ============================================================================
 */

import { ExpertReport } from './types.js';

function base64ToUint8Array(base64Str: string): Uint8Array {
  const clean = base64Str.replace(/^data:[^;]+;base64,/, '').trim();
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Expert Audio : Transcrit l'audio ou note vocale via Whisper (Cloudflare Workers AI)
 */
export async function callWhisperExpert(
  audioBase64: string,
  cfToken: string,
  accountId: string
): Promise<ExpertReport> {
  try {
    const bytes = base64ToUint8Array(audioBase64);
    if (bytes.length === 0) {
      return { expert: 'whisper-audio', status: 'skipped', summary: 'Audio vide', content: '' };
    }

    // Tentative 1 : Envoi binaire application/octet-stream
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper`;
    let res = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes as any,
    });

    // Tentative 2 : Si échec octet-stream, essai avec JSON { audio: [...] }
    if (!res.ok) {
      res = await fetch(cfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: Array.from(bytes.slice(0, 1000000)) }),
      });
    }

    if (res.ok) {
      const data: any = await res.json();
      const transcription = data?.result?.text || data?.text || '';
      if (transcription.trim()) {
        return {
          expert: 'whisper-audio',
          status: 'success',
          summary: 'Audio oral retranscrit par Whisper',
          content: transcription.trim(),
        };
      }
    }
    return {
      expert: 'whisper-audio',
      status: 'failed',
      summary: 'Échec transcription Whisper',
      content: '',
    };
  } catch (err: any) {
    return {
      expert: 'whisper-audio',
      status: 'failed',
      summary: `Erreur Whisper: ${err?.message}`,
      content: '',
    };
  }
}

// Cache en mémoire des extractions OCR pour accélérer les tours de conversation suivants
const visionOcrCache = new Map<string, string>();

/**
 * Expert Vision & Extraction OCR : Analyse et extrait les exercices, devoirs, manuscrits
 * et schémas via Llama 3.2 11B Vision Instruct (100% Cloudflare Workers AI sans clé externe).
 */
export async function callVisionExpert(
  imageBase64: string,
  cfToken: string,
  accountId: string,
  userPrompt?: string
): Promise<ExpertReport> {
  try {
    const rawB64 = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1].trim()
      : imageBase64.trim();

    if (!rawB64 || rawB64.length < 20) {
      return {
        expert: 'llama-vision',
        status: 'failed',
        summary: 'Base64 image vide ou invalide',
        content: '',
      };
    }

    const studentDemand = (userPrompt || '').trim();

    // Vérification du cache OCR en mémoire (pour les tours de conversation 2, 3...)
    const cacheKey = `${rawB64.length}_${rawB64.slice(0, 80)}_${studentDemand.slice(0, 40)}`;
    if (visionOcrCache.has(cacheKey)) {
      const cachedContent = visionOcrCache.get(cacheKey)!;
      return {
        expert: 'llama-vision',
        status: 'success',
        summary: 'Image et exercice résolus par le modèle Vision (Cache instantané)',
        content: cachedContent,
      };
    }

    const promptVision = `Tu es le professeur tuteur spécialiste en analyse d'images et résolution d'exercices de StudyCloud.
CONSIGNE DIRECTE DE L'ÉTUDIANT : "${studentDemand || "Résous complètement l'exercice présent sur cette image."}"

DIRECTIVES STRICTES ET OBLIGATOIRES :
1. TRANSCRIPTION EXACTE DE L'ÉNONCÉ ET DES VALEURS :
   - Extrais avec exactitude tout le texte, les numéros de questions, toutes les valeurs numériques avec leurs unités, et toutes les formules mathématiques en LaTeX standard ($...$ en ligne, $$...$$ en bloc).
2. RÉSOLUTION COMPLÈTE ET CORRIGÉ DÉTAILLÉ (INTERDICTION DE SE LIMITER AUX ÉTAPES) :
   - RÉSOUD COMPLÈTEMENT ET TOTALEMENT chaque question ou exercice présent sur l'image.
   - Ne te contente JAMAIS de lister des étapes abstraites ou de donner des conseils généraux sans calculer !
   - Pour chaque question :
     * Rappelle la formule de départ.
     * Pose l'application numérique avec TOUTES les valeurs de l'énoncé.
     * Effectue le calcul mathématique/physique complet jusqu'à la valeur numérique finale.
     * Encadre le résultat final avec \\boxed{...} et ses unités.
3. SCHÉMAS, CIRCUITS ET FIGURES :
   - Si l'image comporte un schéma ou circuit, décris fidèlement chaque composant, valeur et liaison.`;

    const runUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`;

    let runRes = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: promptVision,
        image: rawB64,
        max_tokens: 4096,
      }),
    });

    // Gestion automatique des conditions de licence Meta si nécessaire
    if (runRes.status === 403) {
      const errText = await runRes.text();
      if (errText.includes('agree')) {
        await fetch(runUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'agree' }),
        }).catch(() => {});

        runRes = await fetch(runUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptVision,
            image: rawB64,
            max_tokens: 4096,
          }),
        });
      }
    }

    if (runRes.ok) {
      const runData: any = await runRes.json();
      const runContent = runData?.result?.response || runData?.response || '';
      if (runContent.trim()) {
        visionOcrCache.set(cacheKey, runContent.trim());
        return {
          expert: 'llama-vision',
          status: 'success',
          summary: 'Image et exercice résolus par le modèle Vision',
          content: runContent.trim(),
        };
      }
    }

    return {
      expert: 'llama-vision',
      status: 'failed',
      summary: 'Échec analyse visuelle Llama 3.2 Vision',
      content: '',
    };
  } catch (err: any) {
    return {
      expert: 'llama-vision',
      status: 'failed',
      summary: `Erreur Llama Vision: ${err?.message}`,
      content: '',
    };
  }
}

/**
 * Expert Vidéo : Analyse les séquences vidéo de cours via Gemini 2.5 Flash
 */
export async function callVideoExpert(
  videoBase64: string,
  videoUrl: string,
  geminiKey: string
): Promise<ExpertReport> {
  if (!geminiKey) {
    return {
      expert: 'gemini-video',
      status: 'skipped',
      summary: 'Clé Gemini absente pour l\'Expert Vidéo',
      content: '',
    };
  }

  try {
    const cleanB64 = videoBase64.replace(/^data:[^;]+;base64,/, '').trim();
    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const parts: any[] = [];
    if (cleanB64) {
      parts.push({
        inlineData: {
          mimeType: 'video/mp4',
          data: cleanB64,
        },
      });
    }

    parts.push({
      text: `Tu es l'Expert Vidéo de l'équipe pédagogique StudyCloud.
Analyse minutieusement cette vidéo de cours :
1. Ce qui est écrit et dessiné au tableau (équations, schémas).
2. Les explications orales de l'enseignant.
3. La chronologie des notions clés abordées.
${videoUrl ? `Lien vidéo source : ${videoUrl}` : ''}
Produis un rapport pédagogique complet et structuré en français.`,
    });

    const res = await fetch(gUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';
      if (content.trim()) {
        return {
          expert: 'gemini-video',
          status: 'success',
          summary: 'Vidéo analysée par Gemini 2.5 Flash',
          content: content.trim(),
        };
      }
    }

    return {
      expert: 'gemini-video',
      status: 'failed',
      summary: 'Échec analyse Gemini Vidéo',
      content: '',
    };
  } catch (err: any) {
    return {
      expert: 'gemini-video',
      status: 'failed',
      summary: `Erreur Gemini Vidéo: ${err?.message}`,
      content: '',
    };
  }
}

/**
 * Expert Math & Raisonnement : Établit les calculs lourds via DeepSeek R1 32B
 */
export async function callMathExpert(
  userPrompt: string,
  context: string,
  cfToken: string,
  accountId: string
): Promise<ExpertReport> {
  try {
    const chatUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
        messages: [
          {
            role: 'system',
            content: 'Tu es l\'Expert Calcul et Démonstrations Algébriques de StudyCloud. Résous avec rigueur les calculs et démonstrations demandés. Écris toutes les fractions verticales avec \\dfrac{numérateur}{dénominateur} et encadre les résultats avec \\boxed{...}.',
          },
          {
            role: 'user',
            content: `Contexte du document : ${context.slice(0, 4000)}\n\nCalcul à résoudre : ${userPrompt}`,
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      const msg = data?.choices?.[0]?.message;
      const content = msg?.content || msg?.reasoning_content || '';
      if (content.trim()) {
        return {
          expert: 'deepseek-math',
          status: 'success',
          summary: 'Calculs résolus par DeepSeek R1',
          content: content.trim(),
        };
      }
    }
    return {
      expert: 'deepseek-math',
      status: 'failed',
      summary: 'Échec calcul DeepSeek R1',
      content: '',
    };
  } catch (err: any) {
    return {
      expert: 'deepseek-math',
      status: 'failed',
      summary: `Erreur DeepSeek: ${err?.message}`,
      content: '',
    };
  }
}
