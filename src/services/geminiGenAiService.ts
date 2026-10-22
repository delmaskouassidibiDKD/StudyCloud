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
  audioMimeType?: string;
  documentBase64?: string;
  documentMimeType?: string;
  documentImages?: Array<{ base64: string; mimeType?: string; name?: string }>;
  videoFrames?: Array<{ base64: string; mimeType?: string; timestamp?: number }>;
  videoMimeType?: string;
  mediaType?: string;
}

function cleanTechnicalMediaJargon(text: string): string {
  if (!text) return text;
  return text
    .replace(/^.*(?:j['’]ai bien re[çc]u les \d+ images cl[ée]s|clich[ée]s captur[ée]s au cours de la vid[ée]o).*$/gim, '')
    .replace(/^.*voici une analyse d[ée]taill[ée]e de l['’][ée]volution des sc[èe]nes.*$/gim, '')
    .replace(/^(?:#+\s*)?(?:\d+\.\s*)?Sc[èe]ne\s*[àa]\s*\d+(?:\.\d+)?s\s*:?/gim, '')
    .replace(/^\s*[-*•]\s*Description\s+visuelle\s*:\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Service de discussion textuelle et multimodale basé sur le SDK officiel @google/genai de Google.
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

  // 1. Flux vidéo direct inline (avec piste audio native)
  if (options.videoBase64 && options.videoBase64.length > 50) {
    const cleanVideoBase64 = options.videoBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let effectiveVideoMime = options.videoMimeType || options.mimeType || 'video/mp4';
    if (options.videoBase64.includes('video/webm')) effectiveVideoMime = 'video/webm';
    else if (options.videoBase64.includes('video/quicktime')) effectiveVideoMime = 'video/quicktime';
    else if (options.videoBase64.includes('video/ogg')) effectiveVideoMime = 'video/ogg';

    if (cleanVideoBase64.length < 28 * 1024 * 1024) {
      currentParts.push({
        inlineData: {
          mimeType: effectiveVideoMime,
          data: cleanVideoBase64,
        }
      });
    }
  }

  // 2. Flux audio direct inline
  if (options.audioBase64 && options.audioBase64.length > 50) {
    const cleanAudioBase64 = options.audioBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let effectiveAudioMime = options.audioMimeType || 'audio/mp3';
    if (options.audioBase64.includes('audio/wav')) effectiveAudioMime = 'audio/wav';
    else if (options.audioBase64.includes('audio/ogg') || options.audioBase64.includes('audio/opus')) effectiveAudioMime = 'audio/ogg';
    else if (options.audioBase64.includes('audio/m4a') || options.audioBase64.includes('audio/x-m4a')) effectiveAudioMime = 'audio/m4a';
    else if (options.audioBase64.includes('audio/webm')) effectiveAudioMime = 'audio/webm';
    else if (options.audioBase64.includes('audio/aac')) effectiveAudioMime = 'audio/aac';

    if (cleanAudioBase64.length < 28 * 1024 * 1024) {
      currentParts.push({
        inlineData: {
          mimeType: effectiveAudioMime,
          data: cleanAudioBase64,
        }
      });
    }
  }

  // 3. Document PDF direct inline (Vision et OCR natif de chaque page, graphiques, figures, schémas, tableaux)
  if (options.documentBase64 && options.documentBase64.length > 50) {
    const cleanDocBase64 = options.documentBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    let effectiveDocMime = options.documentMimeType || 'application/pdf';
    if (options.documentBase64.includes('application/pdf')) effectiveDocMime = 'application/pdf';
    if (cleanDocBase64.length < 28 * 1024 * 1024) {
      currentParts.push({
        inlineData: {
          mimeType: effectiveDocMime,
          data: cleanDocBase64,
        }
      });
    }
  }

  // 4. Schémas et images extraits de documents (dessins, circuits, graphiques d'un fichier Word .docx)
  if (Array.isArray(options.documentImages) && options.documentImages.length > 0) {
    for (const dImg of options.documentImages) {
      const rawImg = typeof dImg === 'string' ? dImg : (dImg.base64 || '');
      const cleanImg = rawImg.replace(/^data:[^;]+;base64,/i, '').trim();
      const mime = (typeof dImg === 'object' && dImg.mimeType) ? dImg.mimeType : 'image/jpeg';
      if (cleanImg && cleanImg.length < 28 * 1024 * 1024) {
        currentParts.push({
          inlineData: {
            mimeType: mime,
            data: cleanImg,
          }
        });
      }
    }
  }

  // 5. Image directe inline
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

  // 6. Frames vidéo (si aucun flux vidéo direct n'a pu être fourni)
  if ((!options.videoBase64 || options.videoBase64.length <= 50) && Array.isArray(options.videoFrames) && options.videoFrames.length > 0) {
    for (const f of options.videoFrames) {
      const fBase64 = String(f.base64 || '').replace(/^data:[^;]+;base64,/i, '').trim();
      if (fBase64) {
        currentParts.push({
          inlineData: {
            mimeType: f.mimeType || 'image/jpeg',
            data: fBase64,
          }
        });
      }
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

  let effectiveSystemPrompt = (options.systemPrompt || '').trim();
  effectiveSystemPrompt += `\n\n══════════════════════════════════════════════════════════════════════════════
[DIRECTIVES MULTIMÉDIAS STRICTES - VIDÉO, AUDIO, IMAGE, DOCUMENT] :
1. DÉTECTION DU TYPE DE CONTENU :
   - VIDÉO : Si le document est une vidéo (WhatsApp, MP4, WebM, etc.), traite-le formellement comme une VIDÉO.
   - AUDIO : Si le document est un fichier sonore (vocal WhatsApp, MP3, WAV, podcast, cours audio), traite-le formellement comme un ENREGISTREMENT AUDIO.
   - IMAGE : Si le document est une image, photo ou scan, traite-le comme une IMAGE.
   - DOCUMENT (PDF, Word, etc.) : Si le document est un PDF, un fichier Word ou un texte, traite-le formellement comme un DOCUMENT. Analyse son contenu textuel ET observe attentivement tous ses éléments visuels (images, schémas, dessins, graphiques, figures géométriques, diagrammes, courbes, tableaux, formules manuscrites ou encadrées).

2. STYLE NATUREL ET HUMAIN (STYLE OFFICIEL GOOGLE GEMINI) :
   - INTERDICTION STRICTE DE JARGON TECHNIQUE : Ne mentionne JAMAIS de termes internes de traitement ou d'ingénierie (interdiction absolue de dire "j'ai reçu X images clés", "clichés capturés", "frames", "échantillons", "rapport ocr", ou de découper artificiellement la réponse par "Scène à X.Xs").
   - Parle directement et naturellement comme le fait l'assistant Google Gemini officiel (ex: "Ce document présente...", "Dans ce document PDF, on observe...", "Cette vidéo montre...", "Cet enregistrement audio présente...").

3. ANALYSE GLOBALE HARMONIEUSE :
   - Pour une vidéo : Décris le contenu visuel (personnes, actions, décor, tenues, textes et incrustations à l'écran) ET intègre naturellement l'ambiance et la piste sonore (musique, paroles, voix, ce qui est dit).
   - Pour un audio : Retranscris et synthétise ce qui est dit, les intervenants, le ton et les notions clés.
   - Pour un document (PDF, Word) : Intègre à la fois le texte du cours et l'analyse visuelle de TOUS les schémas, graphiques, illustrations ou figures présents. Si un schéma ou un dessin est présent (par exemple un circuit électrique, une cellule biologique, un graphique, un polygone, une courbe), décris-le précisément et intègre-le dans ton explication ou la résolution des exercices !
══════════════════════════════════════════════════════════════════════════════`;

  config.systemInstruction = effectiveSystemPrompt;
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

  return cleanTechnicalMediaJargon(response.text || '');
}
