import { GoogleGenAI } from '@google/genai';

export interface GenerateGeminiOptions {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  history?: Array<{ role: string; content: string }>;
  docContent?: string;
  docName?: string;
  imageBase64?: string;
  audioBase64?: string;
  videoBase64?: string;
  videoUrl?: string;
  mediaBlob?: Blob;
  mimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}

/**
 * Service officiel basé sur le SDK @google/genai de Google.
 * Gère nativement gemini-2.0-flash et le multimodalisme (images, audios, vidéos, documents).
 */
export async function callGoogleGenAi(options: GenerateGeminiOptions): Promise<string> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('Clé API Gemini requise pour utiliser le SDK officiel @google/genai.');
  }

  // 1. Initialisation avec le SDK officiel GoogleGenAI
  const ai = new GoogleGenAI({ apiKey });
  const modelName = options.model || 'gemini-2.0-flash';

  // 2. Construction des contenus historiques et multimodaux
  const contents: any[] = [];

  // Traitement de l'historique conversationnel
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

  // Tour utilisateur courant avec parties multimodales
  const currentParts: any[] = [];

  // A. Si un Blob lourd (vidéo, gros audio) est fourni, utilisation de ai.files.upload
  if (options.mediaBlob && options.mediaBlob.size > 0) {
    try {
      const uploadResult = await ai.files.upload({
        file: options.mediaBlob,
        config: {
          mimeType: options.mimeType || options.mediaBlob.type || 'application/octet-stream',
        },
      });
      if (uploadResult) {
        currentParts.push(uploadResult);
      }
    } catch (uploadErr) {
      console.warn('[GeminiGenAiService] Téléversement via ai.files.upload échoué, repli sur inlineData:', uploadErr);
    }
  }

  // B. Images (JPG, PNG, WebP) via inlineData Base64
  if (options.imageBase64 && options.imageBase64.length > 50) {
    const rawBase64 = options.imageBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let mime = options.mimeType || 'image/jpeg';
    if (options.imageBase64.includes('image/png')) mime = 'image/png';
    else if (options.imageBase64.includes('image/webp')) mime = 'image/webp';
    else if (options.imageBase64.includes('image/gif')) mime = 'image/gif';

    if (rawBase64) {
      currentParts.push({
        inlineData: {
          mimeType: mime,
          data: rawBase64,
        }
      });
    }
  }

  // C. Audio (MP3, WAV) via inlineData Base64
  if (options.audioBase64 && options.audioBase64.length > 50) {
    const rawAudio = options.audioBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let mime = options.mimeType || 'audio/mp3';
    if (options.audioBase64.includes('audio/wav')) mime = 'audio/wav';
    else if (options.audioBase64.includes('audio/ogg')) mime = 'audio/ogg';

    if (rawAudio) {
      currentParts.push({
        inlineData: {
          mimeType: mime,
          data: rawAudio,
        }
      });
    }
  }

  // D. Vidéo (MP4, WebM) via inlineData si pas déjà gérée par ai.files
  if (options.videoBase64 && options.videoBase64.length > 50 && !options.mediaBlob) {
    const rawVideo = options.videoBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let mime = options.mimeType || 'video/mp4';
    if (options.videoBase64.includes('video/webm')) mime = 'video/webm';

    if (rawVideo) {
      currentParts.push({
        inlineData: {
          mimeType: mime,
          data: rawVideo,
        }
      });
    }
  }

  // D.bis URL de vidéo en ligne ou stockée
  if (options.videoUrl && options.videoUrl.trim()) {
    currentParts.push({
      text: `[VIDÉO FOURNIE EN LIGNE / CLOUD : ${options.videoUrl.trim()}]`
    });
  }

  // E. Document d'étude textuel associé
  if (options.docContent && options.docContent.trim()) {
    currentParts.push({
      text: `[DOCUMENT FOURNI PAR L'ÉTUDIANT : "${options.docName || 'Document d\'étude'}"]\n${options.docContent.slice(0, 30000)}`
    });
  }

  // F. Prompt de l'utilisateur
  currentParts.push({
    text: options.userPrompt || 'Bonjour !'
  });

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  // 3. Configuration du modèle
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
