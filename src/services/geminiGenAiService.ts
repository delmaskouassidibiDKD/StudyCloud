import { GoogleGenAI } from '@google/genai';

export interface GenerateGeminiOptions {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  history?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  // Champs optionnels conservés pour compatibilité de signature sans transfert média
  docContent?: string;
  docName?: string;
  imageBase64?: string;
  audioBase64?: string;
  videoBase64?: string;
  videoUrl?: string;
  mediaBlob?: Blob;
  mimeType?: string;
  videoFrames?: Array<{ base64: string; mimeType?: string; timestamp?: number }>;
  videoMimeType?: string;
}

/**
 * Service de discussion textuelle basé sur le SDK officiel @google/genai de Google.
 * Conversation textuelle pure (Prompt + Historique).
 */
export async function callGoogleGenAi(options: GenerateGeminiOptions): Promise<string> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('Clé API Gemini requise pour utiliser le SDK officiel @google/genai.');
  }

  // 1. Initialisation avec le SDK officiel GoogleGenAI
  const ai = new GoogleGenAI({ apiKey });
  const modelName = options.model || 'gemini-2.0-flash';

  // 2. Construction de l'historique de discussion
  const contents: any[] = [];

  if (Array.isArray(options.history) && options.history.length > 0) {
    for (const h of options.history) {
      if (!h || !h.content) continue;
      if (h.role === 'system') continue;
      const role = h.role === 'assistant' || h.role === 'ai' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: String(h.content).trim() }]
      });
    }
  }

  // Tour utilisateur courant (multimodal selon la spécification Google Cookbook)
  const currentParts: any[] = [];
  if (options.imageBase64 && options.imageBase64.length > 50) {
    const cleanBase64 = options.imageBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let effectiveMime = options.mimeType || 'image/jpeg';
    if (options.imageBase64.includes('image/png')) effectiveMime = 'image/png';
    else if (options.imageBase64.includes('image/webp')) effectiveMime = 'image/webp';
    else if (options.imageBase64.includes('image/gif')) effectiveMime = 'image/gif';
    else if (options.imageBase64.includes('application/pdf')) effectiveMime = 'application/pdf';

    if (cleanBase64) {
      currentParts.push({
        inlineData: {
          mimeType: effectiveMime,
          data: cleanBase64,
        }
      });
    }
  }

  // Séquence chronologique d'images clés de la vidéo (Google Cookbook)
  if (Array.isArray(options.videoFrames) && options.videoFrames.length > 0) {
    currentParts.push({
      text: `[Séquence visuelle chronologique de ${options.videoFrames.length} images clés extraites de la vidéo pour analyse de chaque scène :]`
    });
    for (const f of options.videoFrames) {
      const fBase64 = String(f.base64 || '').replace(/^data:[^;]+;base64,/i, '').trim();
      if (fBase64) {
        if (typeof f.timestamp === 'number') {
          currentParts.push({ text: `[Scène vidéo à ${Math.round(f.timestamp * 10) / 10}s]` });
        }
        currentParts.push({
          inlineData: {
            mimeType: f.mimeType || 'image/jpeg',
            data: fBase64,
          }
        });
      }
    }
  }

  // Flux vidéo direct inline (si vidéo courte < 25MB)
  if (options.videoBase64 && options.videoBase64.length > 50) {
    const cleanVideoBase64 = options.videoBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let effectiveVideoMime = options.videoMimeType || options.mimeType || 'video/mp4';
    if (options.videoBase64.includes('video/webm')) effectiveVideoMime = 'video/webm';
    else if (options.videoBase64.includes('video/quicktime')) effectiveVideoMime = 'video/quicktime';
    else if (options.videoBase64.includes('video/ogg')) effectiveVideoMime = 'video/ogg';

    if (cleanVideoBase64.length < 25 * 1024 * 1024) {
      currentParts.push({
        inlineData: {
          mimeType: effectiveVideoMime,
          data: cleanVideoBase64,
        }
      });
    }
  }

  currentParts.push({ text: options.userPrompt || 'Bonjour !' });

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  // 3. Configuration de génération
  const config: any = {
    temperature: options.temperature ?? 0.7,
  };
  if (options.systemPrompt && options.systemPrompt.trim()) {
    config.systemInstruction = options.systemPrompt.trim();
  }
  if (options.maxOutputTokens) {
    config.maxOutputTokens = options.maxOutputTokens;
  }
  if (options.responseMimeType) {
    config.responseMimeType = options.responseMimeType;
  }

  // 4. Appel du modèle via le SDK officiel @google/genai
  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config,
  });

  return response.text || '';
}
