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
      body: bytes.buffer,
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

/**
 * Expert Vision : Décrit et extrait les schémas/manuscrits via Llama 3.2 Vision (Cloudflare Workers AI)
 */
export async function callVisionExpert(
  imageBase64: string,
  cfToken: string,
  accountId: string
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

    const runUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`;
    const promptVision = "Tu es l'Expert Vision de l'équipe pédagogique StudyCloud. Décris précisément et exhaustivement tout ce que tu vois dans cette image de cours : tout le texte visible, énoncés, exercices, questions, schémas techniques, équations et formules mathématiques en LaTeX standard ($...$), tableaux, graphiques et annotations manuscrites. Ne dis jamais que tu ne peux pas voir, analyse méticuleusement l'image fournie.";

    // Tentative 1 : Envoi direct du Base64 à Cloudflare Workers AI Run
    let runRes = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: promptVision,
        image: rawB64,
        max_tokens: 3000,
      }),
    });

    // Si erreur 403 (Model agreement required), auto-acceptation des termes Meta puis rejeu immédiat
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
            max_tokens: 3000,
          }),
        });
      }
    }

    if (runRes.ok) {
      const runData: any = await runRes.json();
      const runContent = runData?.result?.response || runData?.response || '';
      if (runContent.trim()) {
        return {
          expert: 'llama-vision',
          status: 'success',
          summary: 'Image analysée par Llama 3.2 Vision',
          content: runContent.trim(),
        };
      }
    }

    // Tentative 2 : Format array d'octets de secours
    const bytes = base64ToUint8Array(rawB64);
    const subBytes = Array.from(bytes.slice(0, 500000));
    const runRes2 = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: promptVision,
        image: subBytes,
        max_tokens: 3000,
      }),
    });

    if (runRes2.ok) {
      const runData2: any = await runRes2.json();
      const runContent2 = runData2?.result?.response || runData2?.response || '';
      if (runContent2.trim()) {
        return {
          expert: 'llama-vision',
          status: 'success',
          summary: 'Image analysée par Llama 3.2 Vision (Bytes)',
          content: runContent2.trim(),
        };
      }
    }

    return {
      expert: 'llama-vision',
      status: 'failed',
      summary: 'Échec analyse visuelle Llama Vision',
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
