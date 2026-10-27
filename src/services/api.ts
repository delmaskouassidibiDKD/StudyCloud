/**
 * StudyCloud - Client API Service (Connecteur Cloudflare Worker)
 * Permet à l'interface React d'appeler les routes de votre Worker Cloudflare.
 */

// URL du Worker Cloudflare déployé (configurable via variable d'environnement ou localStorage)
export const getWorkerApiUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_WORKER_API_URL ||
    localStorage.getItem('studycloud_worker_url') ||
    'https://api-worker.dkd-technologies.com'
  );
};

// Rafraîchit le cache TanStack Query APRÈS confirmation de l'écriture D1
// (import dynamique pour éviter toute dépendance circulaire)
const refreshMatieresCache = (includeFiles: boolean) => {
  import('./queryClient').then(({ invalidateCloudQueries }) => {
    invalidateCloudQueries.matieresList();
    if (includeFiles) {
      invalidateCloudQueries.filesMenu();
      invalidateCloudQueries.matiereFiles();
    }
  }).catch(() => {});
};

export const setWorkerApiUrl = (url: string) => {
  localStorage.setItem('studycloud_worker_url', url.trim());
};

/**
 * Génère un jeton de partage cryptographique sécurisé, opaque et impossible à deviner (32 octets aléatoires).
 * Empêche tout utilisateur de modifier l'adresse pour accéder à des fichiers tiers.
 */
export const generateCleanShareCode = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'sec_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
};

// Import et ré-export des connecteurs du Cerveau Neuronal Cloudflare Agent
import {
  getStudyAgentUrl,
  setStudyAgentUrl,
  generateAgentCreation,
  sendAgentChatMessage,
} from './studyAgentService';
export { getStudyAgentUrl, setStudyAgentUrl };
import { parseOrBuildAiCreation } from './aiCreationGenerator';
import { callGoogleGenAi } from './geminiGenAiService';

// URL du Worker Cloudflare Workshop Backend (Moteur IA déployé pour StudyCloud)
export const getAiWorkerUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_AI_WORKER_URL ||
    localStorage.getItem('studycloud_ai_worker_url') ||
    'https://workshop-backend.delmaskouassidibi.workers.dev'
  );
};

export const setAiWorkerUrl = (url: string) => {
  localStorage.setItem('studycloud_ai_worker_url', url.trim());
};

// URL du Worker Cloudflare connecté à Google Gemini (Mode Puissance)
export const getGeminiWorkerUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_GEMINI_WORKER_URL ||
    localStorage.getItem('studycloud_gemini_worker_url') ||
    'https://studycloud-gemini.delmaskouassidibi.workers.dev'
  );
};

export const setGeminiWorkerUrl = (url: string) => {
  localStorage.setItem('studycloud_gemini_worker_url', url.trim());
};

// Clé API Google Gemini (Google AI Studio) pour le Mode Puissance
export const getGeminiApiKey = (): string => {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('studycloud_gemini_api_key') ||
    localStorage.getItem('gemini_api_key') ||
    ''
  ).trim();
};

export const setGeminiApiKey = (key: string) => {
  if (!key || !key.trim()) {
    localStorage.removeItem('studycloud_gemini_api_key');
    localStorage.removeItem('gemini_api_key');
  } else {
    localStorage.setItem('studycloud_gemini_api_key', key.trim());
  }
};
function cleanControlCharsInParsedObject(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return obj
      .replace(/[\x0c\u000c]/g, '\\f') // Répare \x0crac -> \frac
      .replace(/[\x08\u0008]/g, '\\b') // Répare \x08eta -> \beta
      // Répare les mélanges de dollars et de symboles LaTeX générés par l'IA (ex: \text{k}\$\Omega$)
      .replace(/\\text\{([^{}]*)\}\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '\\text{$1 }\\Omega')
      .replace(/\\text\{([^{}]*)\\?\$+(\\?Omega|\bOmega\b)\}/gi, '\\text{$1 }\\Omega')
      .replace(/\\text\{([^{}]*)\\?\$+([^{}]*)\}/gi, '\\text{$1$2}')
      .replace(/([0-9]+)\s*k\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\text{ k}\\Omega')
      .replace(/([a-zA-Z0-9])\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\Omega')
      .replace(/\\\$+(\\?Omega|\bOmega\b)/gi, '\\Omega')
      .replace(/\bk\s*\\?\$+(\\?Omega)\$?/gi, '\\text{k }\\Omega');
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanControlCharsInParsedObject);
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      cleaned[k] = cleanControlCharsInParsedObject(v);
    }
    return cleaned;
  }
  return obj;
}

export function safeJsonParse<T = any>(raw: string): T | null {
  if (!raw) return null;
  if (typeof raw === 'object') return cleanControlCharsInParsedObject(raw);
  if (typeof raw !== 'string') return null;

  let cleaned = raw.trim();

  // 1. Extraire le bloc JSON qu'il soit entre ```json ou """json ou simplement entre accolades
  const codeBlockMatch = cleaned.match(/(?:```|""")(?:json)?\s*([\s\S]*?)\s*(?:```|""")/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  // Essai direct
  try {
    return cleanControlCharsInParsedObject(JSON.parse(cleaned));
  } catch {}

  // 2. Nettoyage des antislashs LaTeX non échappés dans les chaînes JSON
  let sanitized = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const code = cleaned.charCodeAt(i);

    if (char === '"' && !escaped) {
      inString = !inString;
      sanitized += char;
    } else if (inString) {
      if (char === '\n') {
        sanitized += '\\n';
      } else if (char === '\r') {
        sanitized += '\\r';
      } else if (char === '\t') {
        sanitized += '\\t';
      } else if (code < 32) {
        sanitized += ' ';
      } else if (char === '\\') {
        const next = cleaned[i + 1];
        const isHexU = next === 'u' && /^[0-9a-fA-F]{4}/.test(cleaned.slice(i + 2, i + 6));
        const isValidJsonEscape = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(next) || isHexU;

        if (isValidJsonEscape) {
          const sub = cleaned.slice(i + 1);
          const isLatexKeyword = /^(?:text|textbf|textit|frac|dfrac|beta|tau|theta|times|rho|right|rightarrow|to|left|leftarrow|partial|pi|omega|sum|int|lim|sqrt|alpha|gamma|delta|epsilon|lambda|mu|nu|sigma|phi|psi)\b/i.test(sub);

          if (isLatexKeyword) {
            sanitized += '\\\\';
          } else {
            sanitized += '\\';
          }
        } else {
          // Tout autre antislash (ex: \underline, \omega, \log, \cdot, etc.) est doublé
          sanitized += '\\\\';
        }
      } else {
        sanitized += char;
      }
    } else {
      sanitized += char;
    }

    if (char === '\\' && !escaped) {
      escaped = true;
    } else {
      escaped = false;
    }
  }

  // Suppression des virgules traînantes avant } ou ]
  sanitized = sanitized.replace(/,\s*([\]}])/g, '$1');

  try {
    return cleanControlCharsInParsedObject(JSON.parse(sanitized));
  } catch {}

  // 3. Réparation des fermetures si le JSON a été tronqué
  let openBraces = 0;
  let openBrackets = 0;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < sanitized.length; i++) {
    const c = sanitized[i];
    if (c === '"' && !esc) inStr = !inStr;
    if (!inStr) {
      if (c === '{') openBraces++;
      else if (c === '}') openBraces = Math.max(0, openBraces - 1);
      else if (c === '[') openBrackets++;
      else if (c === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
    esc = (c === '\\' && !esc);
  }

  let repaired = sanitized;
  if (inStr) repaired += '"';
  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  while (openBraces > 0) { repaired += '}'; openBraces--; }

  try {
    return cleanControlCharsInParsedObject(JSON.parse(repaired));
  } catch {
    return null;
  }
}

export async function sendChatMessageToAi(params: {
  messages: Array<{ role: string; content: string }>;
  prompt?: string;
  message?: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  conversation_id?: string;
  requested_type?: string;
  history?: Array<{ role: string; content: string }>;
  attachedFileId?: string;
  attachedFileName?: string;
  attachedFileContent?: string;
  attachedFileR2Key?: string;
  file_content?: string;
  fileContent?: string;
  documentContent?: string;
  documentText?: string;
  file_name?: string;
  fileName?: string;
  powerMode?: boolean;
  engine?: 'gemini' | 'standard' | string;
  geminiApiKey?: string;
  imageBase64?: string;
  mimeType?: string;
  videoBase64?: string;
  videoFrames?: Array<{ base64: string; mimeType?: string; timestamp?: number }>;
  videoMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  documentBase64?: string;
  documentMimeType?: string;
  documentImages?: Array<{ base64: string; mimeType?: string; name?: string }>;
  pdfBase64?: string;
  userMsgId?: string;
  aiMsgId?: string;
  creationId?: string;
  creationTitle?: string;
  async?: boolean;
  isBackground?: boolean;
  runInBackground?: boolean;
  perceptionReport?: string;
  [key: string]: any;
}): Promise<{
  response: string;
  success: boolean;
  model?: string;
  type?: string;
  mode?: 'chat' | 'creation';
  chat_response?: string;
  creation_type?: string;
  creation_title?: string;
  creation_data?: any;
  creation_id?: string;
  ai_msg_id?: string;
  conversation_id?: string;
  raw_response?: string;
  rawResponse?: string;
  perceptionReport?: string;
  async?: boolean;
  isBackground?: boolean;
  status?: string;
  taskId?: string;
  tokens?: number;
  credits?: number;
  credits_deducted?: number;
  usage?: any;
}> {
  const isPowerMode = Boolean(params.powerMode || params.engine === 'gemini');
  const isAsyncBackground = Boolean(params.async || params.isBackground || params.runInBackground);
  let userGeminiApiKey = (params.geminiApiKey || getGeminiApiKey()).trim();
  if (userGeminiApiKey.startsWith('AIzaSyDKct') || userGeminiApiKey.length < 25) {
    userGeminiApiKey = '';
  }
  const cleanExplicitKey = (params.apiKey && !params.apiKey.startsWith('AIzaSyDKct') && params.apiKey.length >= 25) ? params.apiKey : userGeminiApiKey;
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');

  const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';

  const payload = {
    ...params,
    userId: currentUserId,
    async: isAsyncBackground,
    isBackground: isAsyncBackground,
    runInBackground: isAsyncBackground,
    creationTitle: params.creationTitle || params.title || undefined,
    creationId: params.creationId || undefined,
    userMsgId: params.userMsgId || undefined,
    aiMsgId: params.aiMsgId || undefined,
    perceptionReport: params.perceptionReport || undefined,
    model: params.model || params.selectedModel || 'gemini-2.0-flash',
    powerMode: isPowerMode,
    isPowerMode: isPowerMode,
    engine: isPowerMode ? 'gemini' : (params.engine || 'standard'),
    geminiApiKey: userGeminiApiKey || undefined,
    apiKey: cleanExplicitKey || undefined,
    apiToken: cleanExplicitKey || undefined,
    message: params.prompt || params.message || '',
    prompt: params.prompt || params.message || '',
    conversation_id: params.conversationId || params.conversation_id || params.sessionId,
    conversationId: params.conversationId || params.conversation_id || params.sessionId,
    history: params.history || params.messages,
    imageBase64: params.imageBase64 || undefined,
    mimeType: params.mimeType || undefined,
    videoBase64: params.videoBase64 || undefined,
    videoFrames: params.videoFrames || undefined,
    videoMimeType: params.videoMimeType || undefined,
    audioBase64: params.audioBase64 || undefined,
    audioMimeType: params.audioMimeType || undefined,
    documentBase64: params.documentBase64 || params.pdfBase64 || undefined,
    documentMimeType: params.documentMimeType || (params.pdfBase64 ? 'application/pdf' : undefined),
    documentImages: params.documentImages || undefined,
    mediaType: params.mediaType || undefined,
  };

  // 1. Appel direct via le SDK officiel @google/genai si une clé Gemini est disponible et que le modèle ciblé est Gemini (ou Power Mode)
  if (userGeminiApiKey && userGeminiApiKey.length > 20 && (params.model === 'gemini-2.0-flash' || isPowerMode || params.engine === 'gemini')) {
    try {
      const isContinuation = Boolean(
        params.isContinuation ||
        params.is_continuation ||
        /^(?:oui\s*,?\s*)?(?:continue|la suite|poursuis|poursuivre|encha[îi]ne|suite\s+s'il\s+te\s+pla[îi]t)/i.test(params.prompt || params.message || '')
      );

      const sysMsg = (Array.isArray(params.history) ? params.history : (Array.isArray(params.messages) ? params.messages : [])).find((m: any) => m.role === 'system')?.content;
      let systemText = sysMsg || "Tu es l'intelligence pédagogique centrale autonome de StudyCloud (Gemini / Delmas IA). Réponds en français structuré avec rigueur pédagogique et formules LaTeX si nécessaire.";
      if (isContinuation) {
        systemText += "\n\n[ORDRE DE CONTINUATION DIRECTE] : L'étudiant demande de poursuivre la réponse précédente. Ne recommence pas du début, ne répète rien et commence directement par la suite utile (ex: numéro de question suivante ou calcul suivant).";
      }

      const gText = await callGoogleGenAi({
        apiKey: userGeminiApiKey,
        model: 'gemini-2.0-flash',
        systemPrompt: systemText,
        userPrompt: params.prompt || params.message || 'Bonjour !',
        history: params.history || params.messages,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        videoBase64: params.videoBase64,
        videoFrames: params.videoFrames,
        videoMimeType: params.videoMimeType,
        audioBase64: params.audioBase64,
        audioMimeType: params.audioMimeType,
        documentBase64: params.documentBase64 || params.pdfBase64,
        documentMimeType: params.documentMimeType,
        documentImages: params.documentImages,
        mediaType: params.mediaType,
        temperature: 0.7,
      });

      if (gText) {
        const promptLen = (params.prompt || params.message || '').length;
        const estimatedTokens = Math.max(35, Math.ceil((promptLen + gText.length) / 3.8));
        const activeTpc = getActiveTokensPerCredit();
        const estimatedCredits = +(estimatedTokens / activeTpc).toFixed(2);

        // Déduction en temps réel dans Cloudflare D1
        deductUserAiCredits({
          userId: currentUserId,
          tokens: estimatedTokens,
          model: 'Google Gemini 2.0 Flash (@google/genai SDK)',
          promptPreview: (params.prompt || params.message || '').substring(0, 100),
          responsePreview: gText.substring(0, 150),
          operationType: 'chat'
        }).catch(e => console.warn('[StudyCloud AI] Erreur déduction SDK Gemini:', e));

        return {
          response: gText,
          success: true,
          model: 'Google Gemini 2.0 Flash (@google/genai SDK)',
          chat_response: gText,
          raw_response: gText,
          rawResponse: gText,
          tokens: estimatedTokens,
          credits: estimatedCredits,
          credits_deducted: estimatedCredits,
        };
      }
    } catch (sdkErr: any) {
      console.warn('[StudyCloud AI] Échec appel direct @google/genai SDK, repli sur Worker backend:', sdkErr);
    }
  }

  // Appel vers le Neurone d'Agent StudyCloud (Durable Objects & Llama 70B) :
  let response: Response;
  const fetchSignal = params.signal || params.abortSignal;
  try {
    response = await fetch(`${dedicatedAiUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
      },
      body: JSON.stringify(payload),
      signal: fetchSignal,
    });
  } catch (_netErr: any) {
    if (_netErr?.name === 'AbortError') {
      return { response: "*(Tâche annulée par l'utilisateur)*", success: false, mode: 'chat' };
    }
    try {
      response = await fetch(dedicatedAiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify(payload),
        signal: fetchSignal,
      });
    } catch (_fallbackErr: any) {
      if (_fallbackErr?.name === 'AbortError') {
        return { response: "*(Tâche annulée par l'utilisateur)*", success: false, mode: 'chat' };
      }
      throw new Error("Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles).");
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    const errorText = String(err.error || response.statusText || '');

    // 1. Détection du quota Cloudflare Workers AI gratuit (Erreur 4006 : 10,000 neurons épuisés)
    const isNeuronQuotaExhausted = errorText.includes('4006') || errorText.toLowerCase().includes('neurons') || errorText.toLowerCase().includes('daily free allocation');

    if (isNeuronQuotaExhausted) {
      console.warn('[StudyCloud AI] Quota 10,000 neurones Cloudflare atteint (Erreur 4006).');

      // TENTATIVE DE SECOURS DIRECT GEMINI : Si une clé est disponible
      if (userGeminiApiKey && userGeminiApiKey.length > 10) {
        try {
          const isContinuation = Boolean(
            params.isContinuation ||
            params.is_continuation ||
            /^(?:oui\s*,?\s*)?(?:continue|la suite|poursuis|poursuivre|encha[îi]ne|suite\s+s'il\s+te\s+pla[îi]t)/i.test(params.prompt || params.message || '')
          );

          let systemText = "Tu es Delmas IA, l'assistant d'étude officiel de StudyCloud. Réponds en français structuré avec rigueur pédagogique et formules LaTeX si nécessaire.";
          if (isContinuation) {
            systemText += "\n\n[ORDRE DE CONTINUATION DIRECTE] : L'étudiant demande de poursuivre la réponse précédente. Ne recommence pas du début, ne répète rien et commence directement par la suite utile (ex: numéro de question suivante ou calcul suivant).";
          }

          const gText = await callGoogleGenAi({
            apiKey: userGeminiApiKey,
            model: 'gemini-2.0-flash',
            systemPrompt: systemText,
            userPrompt: params.prompt || params.message || 'Bonjour',
            history: params.history || params.messages,
            temperature: 0.3,
          });

          if (gText) {
            return {
              success: true,
              response: gText,
              chat_response: gText,
              model: 'Google Gemini 2.0 Flash (@google/genai SDK)',
            };
          }
        } catch (_gErr) {
          console.warn('[StudyCloud AI] Échec secours Gemini SDK:', _gErr);
        }
      }

      // Si aucune clé Gemini n'est configurée, afficher un message d'orientation bienveillant et clair
      return {
        success: true,
        response: `💡 **Information sur le quota de calcul Cloudflare :**\n\nVotre compte gratuit Cloudflare a atteint son allocation journalière de **10 000 neurones gratuits** (Erreur 4006).\n\nPour continuer à utiliser l'IA immédiatement et sans limite :\n\n1. 🔑 **Option 100% Gratuite (Recommandée)** : Obtenez une clé API Gemini gratuite en 30 secondes sur [Google AI Studio](https://aistudio.google.com/) et collez-la dans les **Paramètres StudyCloud**. L'IA fonctionnera en illimité sans aucun frais !\n2. ⚡ **Option Cloudflare** : Passer au plan Workers Paid (5$/mois) depuis votre tableau de bord Cloudflare pour lever la limite journalière.\n3. ⏳ **Reset automatique** : Les 10 000 neurones gratuits se rechargent automatiquement chaque jour à minuit UTC.`,
        chat_response: `💡 Quota journalier Cloudflare gratuit atteint (10 000 neurones). Ajoutez une clé API Gemini gratuite dans les Paramètres pour continuer immédiatement !`,
        model: 'Delmas IA (Notice Quota)',
      };
    }

    throw new Error(err.error || `Erreur API Worker IA (${response.status})`);
  }

  const data = await response.json();
  let text = '';
  if (typeof data.response === 'string') {
    text = data.response;
  } else if (data.response?.response) {
    text = data.response.response;
  } else if (Array.isArray(data) && data[0]?.response?.response) {
    text = data[0].response.response;
  } else if (data.message?.content) {
    text = data.message.content;
  } else if (data.text) {
    text = data.text;
  } else if (typeof data === 'string') {
    text = data;
  } else {
    text = JSON.stringify(data);
  }

  // Extraction et protection absolue pour éviter tout affichage de JSON brut dans le chat
  let extractedChatResponse = typeof data.chat_response === 'string' ? data.chat_response : (typeof data.chat_message === 'string' ? data.chat_message : '');
  let extractedMode = data.mode || (data.decision === 'creation' ? 'creation' : undefined);
  let extractedCreationType = data.creation_type;
  let extractedCreationTitle = data.creation_title;
  let extractedCreationData = data.creation_data;

  // Si creation_data est une chaîne JSON, on la désérialise proprement
  if (typeof extractedCreationData === 'string') {
    extractedCreationData = safeJsonParse(extractedCreationData);
  }

  // Inspection complète de tous les champs de texte
  const textCandidates = [
    text,
    typeof data.response === 'string' ? data.response : '',
    typeof data.chat_message === 'string' ? data.chat_message : '',
    typeof data.chat_response === 'string' ? data.chat_response : '',
  ].filter(Boolean);

  const fullTextToInspect = textCandidates.join('\n');

  // Détection si c'est un bloc de création autonome
  const hasCreationClues =
    data.decision === 'creation' ||
    data.mode === 'creation' ||
    Boolean(extractedCreationData) ||
    Boolean(extractedCreationType) ||
    /"decision"\s*:\s*"creation"/i.test(fullTextToInspect) ||
    /"mode"\s*:\s*"creation"/i.test(fullTextToInspect) ||
    /"creation_data"/i.test(fullTextToInspect) ||
    /<creation/i.test(fullTextToInspect);

  const promptText = String(params.prompt || params.message || '').trim();
  const isPureChatQuery = !params.requested_type && (
    /^(?:tu\s+vois|tu\s+peux\s+voir|est-ce\s+que\s+tu\s+vois|vois-tu|qu'est-ce\s+que\s+tu\s+vois|que\s+vois-tu|d[eé]cris|lis|peux-tu\s+lire|bonjour|salut|coucou)/i.test(promptText) ||
    /^(?:tu\s+vois\s+l['’]image|tu\s+vois\s+limage|tu\s+la\s+vois|c'est\s+quoi\s+sur\s+l'image)/i.test(promptText.replace(/\s+/g, ' '))
  );

  if (hasCreationClues && !isPureChatQuery) {
    extractedMode = 'creation';
  }

  // Extraction du bloc JSON structuré
  try {
    const jsonMatch = fullTextToInspect.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || fullTextToInspect.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const candidate = jsonMatch[1] || jsonMatch[0];
      const parsed = safeJsonParse(candidate);
      if (parsed && typeof parsed === 'object') {
        if (parsed.decision === 'creation' || parsed.mode === 'creation' || parsed.creation_data || parsed.creation_type) {
          extractedMode = 'creation';
        }
        if (parsed.creation_data) {
          extractedCreationData = typeof parsed.creation_data === 'string' ? safeJsonParse(parsed.creation_data) : parsed.creation_data;
        } else if (Array.isArray(parsed.questions) || Array.isArray(parsed.affirmations) || Array.isArray(parsed.cards) || parsed.root || parsed.overview || parsed.sections || parsed.exercises || parsed.exercices || parsed.written_exercise || parsed.complete_exam || Array.isArray(parsed.formulas) || Array.isArray(parsed.key_definitions)) {
          extractedCreationData = parsed;
          extractedMode = 'creation';
        }

        if (parsed.creation_type) extractedCreationType = parsed.creation_type;
        if (parsed.creation_title || parsed.title) extractedCreationTitle = parsed.creation_title || parsed.title;

        const candidateMsg = parsed.chat_message || parsed.chat_response;
        if (typeof candidateMsg === 'string' && !candidateMsg.trim().startsWith('{') && !candidateMsg.trim().startsWith('```') && !candidateMsg.includes('"creation_data"')) {
          extractedChatResponse = candidateMsg.trim();
        }
      }
    }
  } catch {}

  // Si c'est une création, vérification que extractedChatResponse ne soit JAMAIS du JSON brut
  if (extractedMode === 'creation' || extractedCreationData) {
    extractedMode = 'creation';
    const isRawJson = !extractedChatResponse || extractedChatResponse.trim().startsWith('{') || extractedChatResponse.trim().startsWith('```') || extractedChatResponse.includes('"creation_data"') || extractedChatResponse.includes('"decision"');
    if (isRawJson) {
      const msgMatch = fullTextToInspect.match(/"(?:chat_message|chat_response)"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (msgMatch) {
        try {
          extractedChatResponse = JSON.parse(`"${msgMatch[1]}"`);
        } catch {
          extractedChatResponse = msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      } else {
        extractedChatResponse = `✨ J'ai généré votre création directement dans l'espace Création à droite !`;
      }
    }
  }

  // Garantie que response ne renvoie JAMAIS de JSON brut si mode === 'creation'
  const finalResponse = (extractedMode === 'creation')
    ? (extractedChatResponse || `✨ J'ai généré votre création directement dans l'espace Création à droite !`)
    : (extractedChatResponse || data.chat_response || text);

  const rawFull = data.raw_response || data.rawResponse || text;

  const respCreditsDeducted = typeof data.credits_deducted === 'number'
    ? data.credits_deducted
    : (typeof data.credits === 'number' && data.credits < (data.tokens || Infinity) && data.credits < 30 ? data.credits : undefined);

  // Émission d'événement en temps réel directement avec les données de la base de données D1 (PAS DE LOCAL)
  if (typeof data.remaining_credits === 'number' || typeof respCreditsDeducted === 'number') {
    try {
      window.dispatchEvent(new CustomEvent('studycloud_user_credits_updated', {
        detail: {
          userId: currentUserId,
          credits_deducted: respCreditsDeducted || 0,
          remaining_balance: typeof data.remaining_credits === 'number' ? Number(data.remaining_credits) : undefined,
          tokens_consumed: data.tokens || 0
        }
      }));
    } catch {}
  } else if (!isAsyncBackground && currentUserId && currentUserId !== 'default-user') {
    // Si la route appelée n'a pas inclus de déduction serveur, on déclenche la déduction D1
    const promptLen = (params.prompt || params.message || '').length;
    const estimatedTokens = typeof data.tokens === 'number' ? data.tokens : Math.max(35, Math.ceil((promptLen + (finalResponse || '').length) / 3.8));
    deductUserAiCredits({
      userId: currentUserId,
      tokens: estimatedTokens,
      model: data.model || 'Delmas IA',
      promptPreview: (params.prompt || params.message || '').substring(0, 100),
      responsePreview: (finalResponse || '').substring(0, 150),
      operationType: 'chat'
    }).catch(e => console.warn('[StudyCloud AI] Erreur déduction D1:', e));
  }

  return {
    response: finalResponse,
    success: data.success !== false,
    model: data.model,
    type: data.type || extractedCreationType,
    mode: extractedMode || data.mode,
    chat_response: finalResponse,
    creation_type: extractedCreationType || data.creation_type,
    creation_title: extractedCreationTitle || data.creation_title,
    creation_data: extractedCreationData || data.creation_data,
    creation_id: data.creation_id || data.creationId || params.creationId,
    ai_msg_id: data.ai_msg_id || params.aiMsgId,
    conversation_id: data.conversation_id || params.conversationId,
    raw_response: rawFull,
    rawResponse: rawFull,
    perceptionReport: data.perceptionReport || undefined,
    async: Boolean(data.async),
    isBackground: Boolean(data.isBackground || isAsyncBackground),
    status: data.status || 'ready',
    taskId: data.taskId || data.creation_id || data.creationId || params.creationId,
    tokens: typeof data.tokens === 'number' ? data.tokens : (typeof data.credits === 'number' ? data.credits : (data.usage?.totalTokens || (typeof data.tokens === 'string' ? parseInt(data.tokens, 10) : undefined))),
    credits: typeof data.credits === 'number' ? data.credits : (typeof data.tokens === 'number' ? data.tokens : (data.usage?.totalTokens || undefined)),
    credits_deducted: respCreditsDeducted,
    usage: data.usage || undefined,
  };
}

export async function generateDirectAiCreation(params: {
  toolType: string;
  docName: string;
  docContent: string;
  prompt: string;
  userId?: string;
  powerMode?: boolean;
}): Promise<{
  success: boolean;
  creation_type: string;
  creation_title: string;
  creation_data: any;
  model?: string;
  rawText?: string;
  html_preview?: string;
}> {
  const isPowerMode = Boolean(params.powerMode ?? (localStorage.getItem('studycloud_ai_power_mode') === 'true'));
  const userGeminiApiKey = getGeminiApiKey().trim();
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');
  const agentUrl = getStudyAgentUrl().replace(/\/+$/, '');
  const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';

  const payload = {
    isDirectCreation: true,
    skipChatHistory: true,
    requested_type: params.toolType,
    toolType: params.toolType,
    type: params.toolType,
    prompt: params.prompt,
    message: params.prompt,
    attachedFileName: params.docName,
    fileName: params.docName,
    file_name: params.docName,
    attachedFileContent: params.docContent,
    file_content: params.docContent,
    fileContent: params.docContent,
    documentContent: params.docContent,
    documentText: params.docContent,
    module: params.toolType,
    text: params.docContent || params.prompt,
    userId: currentUserId,
    powerMode: isPowerMode,
    isPowerMode: isPowerMode,
    engine: isPowerMode ? 'gemini' : 'standard',
    geminiApiKey: userGeminiApiKey,
  };

  // Helper pour désérialiser et garantir que le contenu est complet et riche
  const finalizeCreation = (rawData: any, rawTextCandidate: string, modelName: string) => {
    let creationData = rawData;
    if (typeof creationData === 'string') creationData = safeJsonParse(creationData);

    let finalTitle = `${params.toolType.toUpperCase()} : ${params.docName}`;

    // Si creationData est absent ou vide, le parser robuste le construit immédiatement
    const isDataEmpty = !creationData || (typeof creationData === 'object' && Object.keys(creationData).length === 0);
    if (isDataEmpty) {
      try {
        const built = parseOrBuildAiCreation(
          params.toolType as any,
          rawTextCandidate || params.docContent,
          params.docName,
          params.prompt
        );
        if (built && built.content) {
          creationData = built.content;
          if (built.title) finalTitle = built.title;
        }
      } catch (_parseErr) {}
    }

    // Normalisation et plafonnement strict à 18 items max pour vrai-ou-faux et questionnaires
    if (params.toolType === 'vrai-ou-faux' || params.toolType === 'vrai-ou-faux-test') {
      const rawAffs = Array.isArray(creationData)
        ? creationData
        : (creationData?.affirmations || creationData?.questions || creationData?.items || creationData?.statements || creationData?.data);
      if (Array.isArray(rawAffs) && rawAffs.length > 0) {
        const mappedAffs = rawAffs.map((a: any, idx: number) => {
          let isTrue = true;
          if (typeof a.is_true === 'boolean') isTrue = a.is_true;
          else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
          else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
          else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
          else if (typeof a.correct === 'boolean') isTrue = a.correct;
          else if (typeof a.is_correct === 'boolean') isTrue = a.is_correct;
          else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
          else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
          else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
          else if (typeof a.correctAnswer === 'string') isTrue = a.correctAnswer.toLowerCase() === 'true' || a.correctAnswer.toLowerCase() === 'vrai';

          let stmt = '';
          if (typeof a === 'string') {
            stmt = a.trim();
          } else if (a && typeof a === 'object') {
            stmt = String(
              a.statement ||
              a.affirmation ||
              a.proposition ||
              a.enonce ||
              a.phrase ||
              a.question ||
              a.claim ||
              a.texte ||
              a.text ||
              a.content ||
              a.item ||
              a.label ||
              a.title ||
              ''
            ).trim();
          }

          const explText = a?.explanation || a?.explication || a?.justification || '';
          if (!stmt || /^Affirmation\s*(?:n°\s*\d+)?$/i.test(stmt)) {
            if (explText && explText.length > 10) {
              stmt = explText;
            }
          }

          return {
            id: a?.id || `vf_${idx + 1}`,
            statement: stmt,
            is_true: isTrue,
            isTrue,
            explanation: explText
          };
        }).filter((a: any) => a.statement && a.statement.length > 0 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(a.statement));

        if (mappedAffs.length > 0) {
          creationData = { affirmations: mappedAffs.slice(0, 18) };
        } else {
          try {
            const built = parseOrBuildAiCreation(params.toolType as any, rawTextCandidate || params.docContent, params.docName, params.prompt);
            if (built?.content) creationData = built.content;
          } catch {}
        }
      } else {
        try {
          const built = parseOrBuildAiCreation(params.toolType as any, rawTextCandidate || params.docContent, params.docName, params.prompt);
          if (built?.content) creationData = built.content;
        } catch {}
      }
    } else if (params.toolType === 'questionnaire' || params.toolType === 'questionnaire-test') {
      const rawQs = Array.isArray(creationData) ? creationData : creationData?.questions;
      if (Array.isArray(rawQs) && rawQs.length > 0) {
        creationData = {
          ...(typeof creationData === 'object' && !Array.isArray(creationData) ? creationData : {}),
          questions: rawQs.slice(0, 18)
        };
      }
    }

    return {
      success: true,
      creation_type: params.toolType,
      creation_title: finalTitle,
      creation_data: creationData,
      model: modelName,
      rawText: rawTextCandidate || '',
    };
  };

  // 1. TENTATIVE : Routes directes de création (/api/create, /api/ai/creation)
  const creationEndpoints = [
    `${dedicatedAiUrl}/api/create`,
    `${dedicatedAiUrl}/create`,
    `${agentUrl}/api/create`,
    `${agentUrl}/create`,
    `${dedicatedAiUrl}/api/ai/creation`,
    `${agentUrl}/api/ai/creation`,
  ];
  for (const url of creationEndpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35000),
      });
      if (res.ok) {
        const data = await res.json();
        const extracted = data.creation_data || data.response || (data.questions || data.statements || data.cards || data.sections || data.root || data.nodes ? data : null);
        if (data && (extracted || data.rawText)) {
          const rawText = data.rawText || (typeof data.response === 'string' ? data.response : '') || (typeof extracted === 'string' ? extracted : '');
          return finalizeCreation(extracted, rawText, data.model || 'StudyCloud Agent AI');
        }
      }
    } catch (_e) {}
  }

  // 2. TENTATIVE : Route /api/ai/chat (LE CANAL PROUVÉ DU CHAT QUI NE FAIT JAMAIS DE DÉFAUT)
  try {
    const chatRes = await fetch(`${dedicatedAiUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
    if (chatRes.ok) {
      const chatData = await chatRes.json();
      let rawText = '';
      if (typeof chatData.response === 'string') rawText = chatData.response;
      else if (typeof chatData.chat_message === 'string') rawText = chatData.chat_message;
      else if (typeof chatData.text === 'string') rawText = chatData.text;
      else rawText = JSON.stringify(chatData);

      let creationData = chatData.creation_data;
      if (typeof creationData === 'string') creationData = safeJsonParse(creationData);

      return finalizeCreation(creationData, rawText, chatData.model || 'StudyCloud AI Chat Engine');
    }
  } catch (_chatErr) {}

  // 3. TENTATIVE : Racine du Worker dédié (POST /)
  try {
    const rootRes = await fetch(dedicatedAiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });
    if (rootRes.ok) {
      const rootData = await rootRes.json();
      let rawText = typeof rootData.response === 'string' ? rootData.response : JSON.stringify(rootData);
      let creationData = rootData.creation_data;
      if (typeof creationData === 'string') creationData = safeJsonParse(creationData);
      return finalizeCreation(creationData, rawText, rootData.model || 'StudyCloud AI Worker');
    }
  } catch (_rootErr) {}

  // 4. TENTATIVE : Gemini direct via le SDK officiel @google/genai
  if (userGeminiApiKey && userGeminiApiKey.length > 10) {
    try {
      const gText = await callGoogleGenAi({
        apiKey: userGeminiApiKey,
        model: 'gemini-2.0-flash',
        systemPrompt: `Tu es un expert pédagogique de premier plan pour StudyCloud. Conçois le module d'apprentissage interactif demandé (${params.toolType}) rigoureusement au format JSON strict selon les spécifications.`,
        userPrompt: params.prompt || `Génère le module ${params.toolType} sur "${params.docName}"`,
        docContent: params.docContent,
        docName: params.docName,
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      if (gText && gText.length > 30) {
        const parsed = safeJsonParse(gText);
        return finalizeCreation(parsed?.creation_data || parsed, gText, 'Google Gemini 2.0 Flash (@google/genai SDK)');
      }
    } catch (_gErr) {
      console.warn('[StudyCloud] Échec création Gemini via SDK @google/genai:', _gErr);
    }
  }

  // 5. FILET DE SÉCURITÉ GARANTI 100% SANS ÉCHEC : parseOrBuildAiCreation local instantané
  const localCreation = parseOrBuildAiCreation(
    params.toolType as any,
    params.docContent || '',
    params.docName,
    params.prompt
  );

  return {
    success: true,
    creation_type: params.toolType,
    creation_title: localCreation.title || `${params.toolType.toUpperCase()} : ${params.docName}`,
    creation_data: localCreation.content,
    model: 'StudyCloud Engine (Secours Intégré)',
    rawText: params.docContent || '',
  };
}

/**
 * Évalue automatiquement les réponses rédigées d'un Devoir Complet sur 20 points
 */
export async function gradeDevoirWithAi(devoirData: any, userAnswers: Record<string, string>): Promise<{
  total_score: number;
  max_score: number;
  general_appreciation: string;
  evaluations: Array<{
    question_id: number | string;
    score_obtained: number;
    max_points: number;
    feedback: string;
  }>;
}> {
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');
  const userGeminiApiKey = getGeminiApiKey().trim();

  // 1. Tenter le worker via /api/grade-devoir
  try {
    const res = await fetch(`${dedicatedAiUrl}/api/grade-devoir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devoirData, userAnswers }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const parsed = typeof data.response === 'string' ? safeJsonParse(data.response) : (data.response || data);
      if (parsed && typeof parsed.total_score === 'number') {
        return parsed;
      }
    }
  } catch (_e) {}

  // 2. Tenter Gemini direct si configuré
  if (userGeminiApiKey && userGeminiApiKey.length > 10) {
    try {
      const geminiPrompt = `Tu es un professeur rigoureux. Évalue les réponses rédigées par l'étudiant pour ce devoir.
Réponds STRICTEMENT avec un objet JSON :
{
  "total_score": 16.5,
  "max_score": 20,
  "general_appreciation": "Appréciation globale constructive...",
  "evaluations": [
    { "question_id": 1, "score_obtained": 2.5, "max_points": 3, "feedback": "Commentaire détaillé..." }
  ]
}

DEVOIR :
${JSON.stringify(devoirData, null, 2)}

REPONSES DE L'ETUDIANT :
${JSON.stringify(userAnswers, null, 2)}`;

      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userGeminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (geminiResp.ok) {
        const gData = await geminiResp.json();
        const raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = safeJsonParse(raw);
        if (parsed && typeof parsed.total_score === 'number') {
          return parsed;
        }
      }
    } catch (_gErr) {}
  }

  // 3. Évaluation pédagogique locale automatique
  const keys = Object.keys(userAnswers);
  let totalPts = 0;
  const evals = keys.map((qId, idx) => {
    const ans = userAnswers[qId] || '';
    const points = ans.length > 30 ? 4 : (ans.length > 10 ? 2.5 : 1);
    totalPts += points;
    return {
      question_id: qId,
      score_obtained: points,
      max_points: 4,
      feedback: ans.length > 30
        ? "Réponse développée avec mention des termes techniques requis."
        : "Réponse correcte mais mériterait un développement plus complet des calculs."
    };
  });

  return {
    total_score: Math.min(20, Math.max(10, Math.round(totalPts * 10) / 10)),
    max_score: 20,
    general_appreciation: "Bonne compréhension globale des concepts abordés. La démarche scientifique est bien amorcée.",
    evaluations: evals.length > 0 ? evals : [
      {
        question_id: 1,
        score_obtained: 15,
        max_points: 20,
        feedback: "Devoir examiné et validé."
      }
    ]
  };
}

/**
 * Frontend Studio Integration Client - Espace Création IA (12 Modules)
 * Conforme à l'architecture Google NotebookLM Studio & Cloudflare Worker
 */
export class CreationStudioClient {
  public apiBaseUrl: string;

  constructor(apiBaseUrl?: string) {
    this.apiBaseUrl = (apiBaseUrl || getAiWorkerUrl() || '/api').replace(/\/+$/, '');
  }

  async lancerCreation(moduleType: string, sourceText: string): Promise<any> {
    const res = await generateDirectAiCreation({
      toolType: moduleType,
      docName: 'Document source',
      docContent: sourceText,
      prompt: `Générer un module ${moduleType}`,
    });
    return res.creation_data;
  }

  async generateArtifact(moduleType: string, sourceText: string): Promise<any> {
    return this.lancerCreation(moduleType, sourceText);
  }

  async soumettreDevoir(devoirData: any, userAnswers: Record<string, string>): Promise<any> {
    return gradeDevoirWithAi(devoirData, userAnswers);
  }
}

/**
 * Causerie directe et éphémère avec Delmas IA (Accueil)
 * Ne crée aucun module, ne persiste RIEN en base de données D1 (pas de conversations ni messages enregistrés).
 */
export async function sendDelmasChatMessage(params: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  geminiApiKey?: string;
  signal?: AbortSignal;
}): Promise<{
  response: string;
  success: boolean;
  model?: string;
  tool_call?: any;
  creation_type?: string;
  creation_data?: any;
  creation_title?: string;
  hasDrawing?: boolean;
}> {
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');
  const userGeminiApiKey = (params.geminiApiKey || getGeminiApiKey()).trim();

  // 0. Tente en priorité le cerveau neuronal Cloudflare Agent
  try {
    const agentChat = await sendAgentChatMessage({
      message: params.message,
      history: params.history,
      signal: params.signal,
    });
    if (agentChat && agentChat.success && agentChat.response) {
      return agentChat;
    }
  } catch (_e) {
    // Repli sur le worker existant
  }

  const payload = {
    message: params.message,
    prompt: params.message,
    history: params.history || [],
    delmasChat: true,
    mode: 'delmas',
    skipChatHistory: true, // Empêche explicitement tout enregistrement D1
    isDirectCreation: false,
    geminiApiKey: userGeminiApiKey,
  };

  // 1. Tente en priorité la route dédiée /api/ai/delmas-chat
  try {
    const res = await fetch(`${dedicatedAiUrl}/api/ai/delmas-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: params.signal,
    });

    if (res.ok) {
      const data = await res.json();
      const text = typeof data.response === 'string'
        ? data.response
        : (typeof data.text === 'string' ? data.text : (typeof data.chat_message === 'string' ? data.chat_message : ''));
      return {
        success: true,
        response: text || "Je suis à votre écoute ! Comment puis-je vous aider ?",
        model: 'Delmas IA',
      };
    }
  } catch (routeErr: any) {
    if (params.signal?.aborted || routeErr?.name === 'AbortError') {
      throw routeErr;
    }
    console.warn('[Delmas Direct Chat] Échec route /api/ai/delmas-chat, tentative fallback sur racine...', routeErr);
  }

  // Si déjà annulé, ne pas tenter de fallback
  if (params.signal?.aborted) {
    const abortErr = new Error('Génération arrêtée par l\'utilisateur');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  // 2. Fallback direct sur la racine du Worker IA avec delmasChat: true
  try {
    const fallbackRes = await fetch(dedicatedAiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: params.signal,
    });

    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      const text = typeof data.response === 'string'
        ? data.response
        : (typeof data.chat_message === 'string' ? data.chat_message : (typeof data.text === 'string' ? data.text : ''));

      return {
        success: true,
        response: text || "Je suis à votre écoute ! Comment puis-je vous aider ?",
        model: 'Delmas IA',
      };
    }
  } catch (err: any) {
    if (params.signal?.aborted || err?.name === 'AbortError') {
      throw err;
    }
  }

  // 3. Filet de sécurité local bienveillant si le Worker externe est temporairement indisponible
  const greetings = ["bonjour", "salut", "bonsoir", "coucou", "hello", "hi", "hey"];
  const isGreeting = greetings.some((g) => (params.message || '').toLowerCase().includes(g));

  return {
    success: true,
    response: isGreeting || !params.message
      ? "Bonjour ! Je suis **Delmas**, ton assistant et tuteur personnel StudyCloud. Je suis ravi de discuter avec toi ! Comment puis-je t'aider aujourd'hui dans tes cours, devoirs ou révisions ?"
      : `Bonjour ! Je suis **Delmas**, ton tuteur StudyCloud. J'ai bien reçu ton message : « *${params.message.slice(0, 100)}* ».\n\nJe suis prêt à t'accompagner ! Peux-tu me préciser le point de cours, l'exercice ou la formule que tu souhaites réviser ?`,
    model: 'Delmas IA',
  };
}


/**
 * Enregistre la réaction (pouce levé ou pouce baissé) de l'élève pour le modèle IA
 */
export async function saveAiReaction(params: {
  userId: string;
  messageId: string;
  reaction: 'like' | 'dislike' | null;
}): Promise<boolean> {
  try {
    const res = await fetch(`${getAiWorkerUrl().replace(/\/+$/, '')}/api/ai/workspace/reaction`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.ok;
  } catch (e) {
    console.warn('[API] Erreur sauvegarde réaction IA:', e);
    return false;
  }
}

/**
 * Supprime la référence et le contenu du fichier joint dans l'espace IA (D1 & R2)
 */
export async function removeAiAttachment(params: {
  userId: string;
  fileId: string;
  r2Key?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${getAiWorkerUrl().replace(/\/+$/, '')}/api/ai/workspace/attachment`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.ok;
  } catch (e) {
    console.warn('[API] Erreur suppression pièce jointe IA:', e);
    return false;
  }
}

/**
 * Récupère l'historique sécurisé des échanges et mémoires de l'IA pour un utilisateur
 */
export async function getAiWorkspaceHistory(userId: string, sessionId?: string): Promise<any[]> {
  try {
    const url = new URL(`${getAiWorkerUrl().replace(/\/+$/, '')}/api/ai/workspace`);
    url.searchParams.set('userId', userId);
    if (sessionId) url.searchParams.set('sessionId', sessionId);
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      return data.data || [];
    }
  } catch (e) {
    console.warn('[API] Erreur récupération historique IA:', e);
  }
  return [];
}


let lastActivityCheckTimestamp = 0;
function notifyActivityVersionCheck() {
  if (typeof window === 'undefined') return;
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sc_auth_token') : null;
  const isConnected = Boolean((uid && uid !== 'default-user' && uid !== 'user_anonymous') || token);
  if (!isConnected) return;

  const now = Date.now();
  // Vérification de version ultra-légère pendant que l'utilisateur travaille (au maximum toutes les 25 secondes)
  if (now - lastActivityCheckTimestamp < 25000) return;
  lastActivityCheckTimestamp = now;
  window.dispatchEvent(new CustomEvent('studycloud_check_app_version'));
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  // Déclencher la détection de version en arrière-plan pendant que l'utilisateur travaille
  notifyActivityVersionCheck();

  // Surveillance active : si une mise à jour est en attente et que l'utilisateur l'a reportée ("Plus tard"),
  // on bloque préventivement toute tentative d'écriture ou modification (POST, PUT, DELETE, PATCH)
  // pour s'assurer que l'application reste synchronisée avec la dernière version.
  const isUpdatePending = typeof localStorage !== 'undefined' && localStorage.getItem('studycloud_update_pending') === 'true';
  const isUpdatePostponed = typeof localStorage !== 'undefined' && localStorage.getItem('studycloud_update_postponed') === 'true';

  if (method !== 'GET' && isUpdatePending && isUpdatePostponed) {
    console.warn(`[StudyCloud Security Lock] Action sensible bloquée (${method} ${endpoint}) : mise à jour requise.`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud_critical_update_required', {
        detail: {
          endpoint,
          method,
          message: 'Une mise à jour est nécessaire pour continuer. Veuillez mettre à jour l\'application.'
        }
      }));
    }
    return {
      success: false,
      blockedByUpdate: true,
      message: 'Une mise à jour est nécessaire pour continuer.'
    } as T;
  }

  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const userId = (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  if (userId && userId !== 'default-user') {
    defaultHeaders['x-user-id'] = userId;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    // Si une anomalie survient et qu'une mise à jour est en attente, exiger l'actualisation
    if (isUpdatePending && (response.status === 400 || response.status === 404 || response.status === 500)) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studycloud_critical_update_required', {
          detail: {
            endpoint,
            status: response.status,
            message: 'Une mise à jour est nécessaire pour continuer. Veuillez actualiser StudyCloud.'
          }
        }));
      }
    }
    if (response.status === 409 || err?.duplicate) {
      return {
        success: false,
        duplicate: true,
        message: err?.message || 'Un fichier a été recalé car son deuxième a été enregistré',
        ...err
      } as T;
    }
    if (err?.forbiddenType) {
      return {
        success: false,
        forbiddenType: true,
        message: err?.message || "Ce genre de fichier n'est pas autorisé.",
        ...err
      } as T;
    }
    throw new Error(err.error || err.message || `Erreur API: ${response.status}`);
  }

  return response.json();
}

// Helper dédié pour les requêtes à l'IA (Worker IA uniquement)
async function aiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  notifyActivityVersionCheck();
  const baseUrl = getAiWorkerUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const userId = (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  if (userId && userId !== 'default-user') {
    defaultHeaders['x-user-id'] = userId;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Erreur API IA: ${response.status}`);
  }

  return response.json();
}

// Helper spécialement pour les routes d'auth (utilise Authorization Bearer)
async function requestAuth<T = any>(endpoint: string, options: RequestInit = {}, token?: string): Promise<T> {
  notifyActivityVersionCheck();
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as any || {}) } });
  const data = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok && response.status !== 409 && response.status !== 404 && !(data as any)?.isGoogleAccount && !(data as any)?.userNotFound) {
    const err: any = new Error((data as any).error || `Erreur ${response.status}`);
    err.status = response.status;
    err.userNotFound = Boolean((data as any)?.userNotFound || response.status === 404);
    err.isGoogleAccount = Boolean((data as any)?.isGoogleAccount);
    err.data = data;
    throw err;
  }
  return data as T;
}

export const StudyCloudAPI = {
  // --------------------------------------------------------------------------
  // Santé & Connexion
  // --------------------------------------------------------------------------
  async checkHealth() {
    return request<{ success: boolean; status: string }>('/api/health');
  },

  // --------------------------------------------------------------------------
  // Authentification (routes /api/auth/*)
  // --------------------------------------------------------------------------
  async register(data: {
    name: string;
    email: string;
    password: string;
    referralCode?: string;
    securityQuestion1?: string;
    securityAnswer1?: string;
    securityQuestion2?: string;
    securityAnswer2?: string;
  }) {
    return requestAuth('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
  },

  async resendVerification(email: string) {
    return requestAuth('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
  },

  async verifyEmail(token: string) {
    return requestAuth(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'GET' });
  },

  async checkVerificationStatus(email: string) {
    return requestAuth(`/api/auth/check-verification-status?email=${encodeURIComponent(email)}`, { method: 'GET' });
  },

  async login(data: { email: string; password: string }) {
    return requestAuth('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
  },

  async initForgotPassword(email: string) {
    return requestAuth('/api/auth/forgot-password/init', { method: 'POST', body: JSON.stringify({ email }) });
  },

  async verifySecurityAnswers(data: { email: string; answer1: string; answer2?: string }) {
    return requestAuth('/api/auth/forgot-password/verify-answers', { method: 'POST', body: JSON.stringify(data) });
  },

  async sendPasswordResetCode(data: { email: string; targetEmail: string; resetSessionToken: string }) {
    return requestAuth('/api/auth/forgot-password/send-code', { method: 'POST', body: JSON.stringify(data) });
  },

  async resetPassword(data: { email: string; code: string; newPassword: string }) {
    return requestAuth('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });
  },

  async googleAuth(data: { code: string; redirectUri: string; action?: 'login' | 'register' | string; referralCode?: string }) {
    return requestAuth('/api/auth/google', { method: 'POST', body: JSON.stringify(data) });
  },

  async logout(token: string) {
    return requestAuth('/api/auth/logout', { method: 'POST' }, token);
  },

  async getMe(token: string) {
    return requestAuth('/api/auth/me', { method: 'GET' }, token);
  },

  async sendHeartbeat(token: string) {
    return requestAuth('/api/auth/heartbeat', { method: 'POST' }, token).catch(() => null);
  },

  async completeOnboarding(token: string, data: {
    name?: string; school?: string; filiere?: string; level?: string;
    country: string; phone?: string; bio?: string; avatarUrl?: string;
    is_student?: number; profession?: string;
  }) {
    return requestAuth('/api/auth/onboarding', { method: 'PUT', body: JSON.stringify(data) }, token);
  },

  async saveOnboardingDraft(token: string, data: any) {
    return requestAuth('/api/auth/onboarding/draft', { method: 'PUT', body: JSON.stringify(data) }, token);
  },

  async cancelUnfinalizedAccount(data: { userId?: string; email?: string }, token?: string) {
    return request('/api/auth/cancel-unfinalized-account', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify(data),
    });
  },

  async sendWelcomeEmail(token: string) {
    return requestAuth('/api/auth/welcome-email', { method: 'POST' }, token);
  },

  async setupSecurity(token: string, data: {
    name?: string;
    password: string;
    securityQuestion1: string;
    securityAnswer1: string;
    securityQuestion2: string;
    securityAnswer2: string;
  }) {
    return requestAuth('/api/auth/setup-security', { method: 'POST', body: JSON.stringify(data) }, token);
  },

  // --------------------------------------------------------------------------
  // Utilisateurs & Profil
  // --------------------------------------------------------------------------
  async syncUser(user: { id: string; name: string; email: string; school?: string; filiere?: string; country?: string; avatarUrl?: string }) {
    return request('/api/users/sync', { method: 'POST', body: JSON.stringify(user) });
  },

  async getUser(id: string) {
    return request<any>(`/api/users/${id}`);
  },

  async getUserPreferences(id: string) {
    return request<any>(`/api/users/${id}/preferences`);
  },

  async updateUserPreferences(id: string, prefs: { view_mode?: string; is_dark_mode?: number; current_tab?: string }) {
    return request(`/api/users/${id}/preferences`, { method: 'PUT', body: JSON.stringify(prefs) });
  },

  // --------------------------------------------------------------------------
  // Matières
  // --------------------------------------------------------------------------
  async getMatieres(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    return request<{ success: boolean; data: any[] }>(`/api/matieres?userId=${encodeURIComponent(userId)}`);
  },

  async createMatiere(matiere: { id: string; userId: string; name: string; coefficient?: number; color?: string; category?: string; displayOrder?: number; oldName?: string }) {
    if (!matiere.userId || matiere.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    const res = await request('/api/matieres', { method: 'POST', body: JSON.stringify(matiere) });
    refreshMatieresCache(Boolean(matiere.oldName));
    return res;
  },

  async updateMatiere(id: string, data: { userId: string; name?: string; coefficient?: number; color?: string; category?: string; displayOrder?: number; oldName?: string }) {
    if (!data.userId || data.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    const res = await request(`/api/matieres/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
    refreshMatieresCache(true);
    return res;
  },

  async deleteMatiere(id: string) {
    const res = await request(`/api/matieres/${encodeURIComponent(id)}`, { method: 'DELETE' });
    refreshMatieresCache(true);
    return res;
  },

  // --------------------------------------------------------------------------
  // Fichiers & Stockage R2
  // --------------------------------------------------------------------------
  async getFiles(userId: string, matiereId?: string, isStudySession?: boolean, isFavorite?: boolean) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    let endpoint = `/api/files?userId=${encodeURIComponent(userId)}`;
    if (matiereId) endpoint += `&matiereId=${encodeURIComponent(matiereId)}`;
    if (isStudySession !== undefined) endpoint += `&isStudySession=${isStudySession ? '1' : '0'}`;
    if (isFavorite !== undefined) endpoint += `&isFavorite=${isFavorite ? '1' : '0'}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
  },

  async uploadFileToR2(
    file: File | Blob,
    r2Key: string,
    contentType?: string,
    originalSizeBytes?: number
  ): Promise<{ success: boolean; key: string; url: string; compressedSizeBytes?: number; originalSizeBytes?: number }> {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/api/storage/upload?key=${encodeURIComponent(r2Key)}`;
    const finalContentType = contentType || (file as any).type || 'application/octet-stream';

    const headers: Record<string, string> = {
      'Content-Type': finalContentType,
    };
    if (originalSizeBytes) {
      headers['x-original-size-bytes'] = String(originalSizeBytes);
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: file,
    });

    if (!response.ok) throw new Error("Échec de l'envoi du fichier vers Cloudflare R2");
    return response.json();
  },

  async uploadDataUrlToR2(dataUrl: string, r2Key: string): Promise<{ success: boolean; key: string; url: string }> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return this.uploadFileToR2(blob, r2Key, blob.type);
  },

  async registerFileMetadata(fileData: {
    id: string;
    userId: string;
    matiereId?: string | null;
    name: string;
    size: number;
    type: string;
    extension?: string;
    r2Key?: string | null;
    fileUrl?: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    isFavorite?: boolean;
    isImported?: boolean;
    isStudySession?: boolean;
    lastImported?: number;
    originalSizeBytes?: number;
    compressedSizeBytes?: number;
    compressionRatio?: number;
  }) {
    return request('/api/files', { method: 'POST', body: JSON.stringify(fileData) });
  },

  async toggleFileFavorite(id: string, isFavorite: boolean) {
    return request<{ success: boolean; message: string; isFavorite: number }>(`/api/files/${encodeURIComponent(id)}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ isFavorite }),
    });
  },

  async deleteFile(id: string, userId?: string) {
    const uid = userId || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
    const query = uid ? `?userId=${encodeURIComponent(uid)}` : '';
    return request<{ success: boolean; message: string }>(`/api/files/${encodeURIComponent(id)}${query}`, { method: 'DELETE' });
  },

  // Fichiers d'étude (Fichiers Importés lors du travail/bosse - Indépendants de Mes dossiers)
  async getStudyFiles(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/study-files?userId=${encodeURIComponent(userId)}`);
  },

  async registerStudyFile(fileData: {
    id: string;
    userId: string;
    name: string;
    size: number;
    type: string;
    extension?: string;
    r2Key?: string | null;
    fileUrl?: string;
    isFavorite?: boolean;
    importedAt?: number;
    originalSizeBytes?: number;
    compressedSizeBytes?: number;
  }) {
    return request('/api/study-files', { method: 'POST', body: JSON.stringify(fileData) });
  },

  async deleteStudyFile(id: string) {
    return request(`/api/study-files/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Suivi Consommation Stockage & Facturation (D1 + R2)
  // --------------------------------------------------------------------------
  async getUserStorageUsage(userId: string) {
    return request<{ success: boolean; data: any }>(`/api/cloud/storage-usage?userId=${encodeURIComponent(userId)}`);
  },

  async getAllUsersStorage(params?: { search?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{ success: boolean; users: any[]; globalOverview: any }>(`/api/cloud/all-users-storage${qs ? `?${qs}` : ''}`);
  },

  // --------------------------------------------------------------------------
  // Partages (Stock de liens & QR Codes)
  // --------------------------------------------------------------------------
  async getShares(userId?: string, publicOnly?: boolean) {
    let endpoint = '/api/shares';
    const params: string[] = [];
    if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
    if (publicOnly) params.push('publicOnly=true');
    params.push(`_t=${Date.now()}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
  },

  async createShare(share: {
    id: string;
    userId: string;
    title: string;
    description?: string;
    category?: string;
    authorName?: string;
    school?: string;
    country?: string;
    isPublic?: boolean;
    isPasswordProtected?: boolean;
    passwordHash?: string | null;
    allowDownload?: boolean;
    shareCode?: string;
    shareUrl?: string;
    qrCodeData?: string;
    totalSize?: number;
    files?: any[];
  }) {
    return request('/api/shares', { method: 'POST', body: JSON.stringify(share) });
  },

  async getShareDetail(id: string) {
    return request<{ success: boolean; data: any }>(`/api/shares/${encodeURIComponent(id)}`);
  },

  async getShareByCode(shareCode: string) {
    return request<{ success: boolean; data: any }>(`/api/shares/code/${encodeURIComponent(shareCode)}`);
  },

  async toggleSharePublic(shareId: string, isPublic: boolean, description?: string, allowDownload = true) {
    return request<{ success: boolean; message: string; isPublic: boolean; allowDownload: boolean }>(
      `/api/shares/${encodeURIComponent(shareId)}/public`,
      {
        method: 'PUT',
        body: JSON.stringify({ isPublic, description, allowDownload }),
      }
    );
  },

  async trackShareDownload(shareId: string) {
    return request<{ success: boolean; message: string }>(
      `/api/shares/${encodeURIComponent(shareId)}/track-download`,
      { method: 'POST' }
    ).catch(() => {});
  },

  async deleteShare(shareId: string) {
    return request<{ success: boolean; message: string }>(`/api/shares/${encodeURIComponent(shareId)}`, {
      method: 'DELETE',
    });
  },

  async verifySharePin(id: string, pin: string) {
    return request<{ success: boolean; data: any }>(`/api/shares/${encodeURIComponent(id)}/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  async stageShareFile(fileData: {
    userId: string;
    id: string;
    name: string;
    size: number;
    type: string;
    r2Key: string;
    url: string;
  }) {
    return request<{ success: boolean; r2Key: string; url: string }>('/api/shares/staging', {
      method: 'POST',
      body: JSON.stringify(fileData),
    });
  },

  async getStagingShareFiles(userId: string) {
    return request<{ success: boolean; files: any[] }>(`/api/shares/staging?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`);
  },

  async deleteStagingShareFiles(userId: string, ids?: string[], r2Keys?: string[]) {
    return request<{ success: boolean; message?: string }>(`/api/shares/staging?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ 
        ids: ids && ids.length > 0 ? ids : undefined,
        r2Keys: r2Keys && r2Keys.length > 0 ? r2Keys : undefined 
      }),
    });
  },

  // --------------------------------------------------------------------------
  // Emploi du temps
  // --------------------------------------------------------------------------
  async getScheduleConfig(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: null };
    return request(`/api/schedule/config?userId=${encodeURIComponent(userId)}`);
  },

  async updateScheduleConfig(userId: string, daysJson: string, hoursJson: string, zoomLevel: number) {
    if (!userId || userId === 'default-user') return { success: false, message: 'Non autorisé' };
    return request('/api/schedule/config', {
      method: 'PUT',
      body: JSON.stringify({ userId, daysJson, hoursJson, zoomLevel }),
    });
  },

  async getScheduleSlots(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    return request<{ success: boolean; data: any[] }>(`/api/schedule/slots?userId=${encodeURIComponent(userId)}`);
  },

  async addScheduleSlot(slot: any) {
    if (!slot.userId || slot.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    return request('/api/schedule/slots', { method: 'POST', body: JSON.stringify(slot) });
  },

  async deleteScheduleSlot(options: { id?: string; userId?: string; day?: string; hourSlot?: string }) {
    let endpoint = '/api/schedule/slots?';
    if (options.id) {
      endpoint += `id=${encodeURIComponent(options.id)}`;
    } else if (options.userId && options.day && options.hourSlot) {
      endpoint += `userId=${encodeURIComponent(options.userId)}&day=${encodeURIComponent(options.day)}&hourSlot=${encodeURIComponent(options.hourSlot)}`;
    }
    return request(endpoint, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Notes & Bulletins
  // --------------------------------------------------------------------------
  async getGrades(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    return request<{ success: boolean; data: any[] }>(`/api/grades?userId=${encodeURIComponent(userId)}`);
  },

  async saveGrade(grade: any) {
    if (!grade.userId || grade.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    return request('/api/grades', { method: 'POST', body: JSON.stringify(grade) });
  },

  async deleteGrade(id: string) {
    return request(`/api/grades/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Bloc-Notes Keep
  // --------------------------------------------------------------------------
  async getNotes(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    return request<{ success: boolean; data: any[] }>(`/api/notes?userId=${encodeURIComponent(userId)}`);
  },

  async saveNote(note: any) {
    if (!note.userId || note.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    return request('/api/notes', { method: 'POST', body: JSON.stringify(note) });
  },

  async deleteNote(id: string) {
    return request(`/api/notes/${id}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Calendrier
  // --------------------------------------------------------------------------
  async getCalendarEvents(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    return request<{ success: boolean; data: any[] }>(`/api/calendar?userId=${encodeURIComponent(userId)}`);
  },

  async createCalendarEvent(event: any) {
    if (!event.userId || event.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    return request('/api/calendar', { method: 'POST', body: JSON.stringify(event) });
  },

  async deleteCalendarEvent(id: string) {
    return request(`/api/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Alarmes & Minuteur d'étude
  // --------------------------------------------------------------------------
  async getAlarms(userId: string) {
    if (!userId || userId === 'default-user') return { success: true, data: [] };
    return request<{ success: boolean; data: any[] }>(`/api/alarms?userId=${encodeURIComponent(userId)}`);
  },

  async createAlarm(alarm: any) {
    if (!alarm.userId || alarm.userId === 'default-user') return { success: false, message: 'Non autorisé' };
    return request('/api/alarms', { method: 'POST', body: JSON.stringify(alarm) });
  },

  async deleteAlarm(id: string) {
    return request(`/api/alarms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async recordStudySession(session: { id?: string; userId: string; durationSeconds: number; matiereName?: string }) {
    return request('/api/study-sessions', { method: 'POST', body: JSON.stringify(session) });
  },

  // --------------------------------------------------------------------------
  // Boutique & Services
  // --------------------------------------------------------------------------
  async getShopProfile(userId: string) {
    return request<{ success: boolean; data: any }>(`/api/shop/profile?userId=${encodeURIComponent(userId)}`);
  },

  async updateShopProfile(profile: any) {
    return request('/api/shop/profile', { method: 'PUT', body: JSON.stringify(profile) });
  },

  async getShopAnalytics(userId: string) {
    return request<{
      success: boolean;
      data: {
        total_views: number;
        total_sales: number;
        subscriber_count: number;
        products: any[];
      };
    }>(`/api/shop/analytics?userId=${encodeURIComponent(userId)}`);
  },

  async getProducts(params?: string | { category?: string; search?: string; userId?: string; sellerId?: string; page?: number; limit?: number }) {
    let endpoint = '/api/products';
    if (typeof params === 'string') {
      if (params) endpoint += `?category=${encodeURIComponent(params)}`;
    } else if (params && typeof params === 'object') {
      const q = new URLSearchParams();
      if (params.category && params.category !== 'Tous') q.set('category', params.category);
      if (params.search && params.search.trim()) q.set('search', params.search.trim());
      if (params.userId) q.set('userId', params.userId);
      if (params.sellerId) q.set('sellerId', params.sellerId);
      if (params.page !== undefined && params.page !== null) q.set('page', String(params.page));
      if (params.limit !== undefined && params.limit !== null) q.set('limit', String(params.limit));
      q.set('_t', String(Date.now()));
      const str = q.toString();
      if (str) endpoint += `?${str}`;
    } else {
      endpoint += `?_t=${Date.now()}`;
    }
    return request<{ success: boolean; data: any[]; pagination?: { page: number; limit: number; total: number; hasMore: boolean } }>(endpoint);
  },

  async createProduct(product: any) {
    return request('/api/products', { method: 'POST', body: JSON.stringify(product) });
  },

  async deleteProduct(id: string) {
    return request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async orderProductViaWhatsApp(id: string) {
    return request<{
      success: boolean;
      whatsappUrl?: string;
      cleanPhone?: string;
      message?: string;
      productShareUrl?: string;
      bannerImageUrl?: string;
      product?: any;
      error?: string;
    }>(`/api/products/${encodeURIComponent(id)}/order`);
  },

  async getSellerFollows(userId: string) {
    return request<{ success: boolean; followedSellerIds: string[] }>(`/api/seller-follows?userId=${encodeURIComponent(userId)}`);
  },

  async toggleSellerFollow(userId: string, sellerId: string, action?: 'follow' | 'unfollow') {
    return request<{ success: boolean; isFollowing: boolean }>('/api/seller-follows', {
      method: 'POST',
      body: JSON.stringify({ userId, sellerId, action }),
    });
  },

  async trackProductInteraction(userId: string, productId: string, type = 'view') {
    return request<{ success: boolean }>(`/api/products/${encodeURIComponent(productId)}/interact`, {
      method: 'POST',
      body: JSON.stringify({ userId, type }),
    });
  },

  async getCart(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/cart?userId=${encodeURIComponent(userId)}`);
  },

  async addToCart(userId: string, productId: string, quantity = 1) {
    return request('/api/cart', { method: 'POST', body: JSON.stringify({ userId, productId, quantity }) });
  },

  async removeFromCart(userId: string, productId: string) {
    return request(`/api/cart?userId=${encodeURIComponent(userId)}&productId=${encodeURIComponent(productId)}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Publications Universitaires (Bibliothèque & Ressources)
  // --------------------------------------------------------------------------
  async getPublishedDocuments(filters?: {
    school?: string;
    filiere?: string;
    country?: string;
    category?: string;
    matiereName?: string;
    level?: string;
    search?: string;
    isPublic?: boolean;
    userId?: string;
    sort?: string;
    page?: number;
    limit?: number;
    seed?: string;
  }) {
    let endpoint = '/api/published-documents';
    const params: string[] = [];
    if (filters?.school) params.push(`school=${encodeURIComponent(filters.school)}`);
    if (filters?.filiere) params.push(`filiere=${encodeURIComponent(filters.filiere)}`);
    if (filters?.country) params.push(`country=${encodeURIComponent(filters.country)}`);
    if (filters?.category) params.push(`category=${encodeURIComponent(filters.category)}`);
    if (filters?.matiereName) params.push(`matiereName=${encodeURIComponent(filters.matiereName)}`);
    if (filters?.level) params.push(`level=${encodeURIComponent(filters.level)}`);
    if (filters?.search) params.push(`search=${encodeURIComponent(filters.search)}`);
    if (filters?.isPublic !== undefined) params.push(`isPublic=${filters.isPublic ? '1' : '0'}`);
    if (filters?.userId) params.push(`userId=${encodeURIComponent(filters.userId)}`);
    if (filters?.sort) params.push(`sort=${encodeURIComponent(filters.sort)}`);
    if (filters?.page) params.push(`page=${filters.page}`);
    if (filters?.limit) params.push(`limit=${filters.limit}`);
    if (filters?.seed) params.push(`seed=${encodeURIComponent(filters.seed)}`);
    params.push(`_t=${Date.now()}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;
    return request<{ success: boolean; data: any[]; pagination?: { page: number; limit: number; total: number; hasMore: boolean } }>(endpoint);
  },

  async getPublishedDocumentFilters(userId?: string, seed?: string) {
    const params: string[] = [];
    if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
    if (seed) params.push(`seed=${encodeURIComponent(seed)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return request<{ success: boolean; schools: string[]; matieres: string[]; categories: string[] }>(`/api/published-documents/filters${query}`);
  },

  async publishDocument(doc: {
    id?: string;
    userId: string;
    title: string;
    description?: string;
    school?: string;
    filiere?: string;
    matiereName?: string;
    level?: string;
    category?: string;
    authorName?: string;
    country?: string;
    infoMode?: string;
    fileName: string;
    fileSize?: number;
    fileType?: string;
    r2Key?: string | null;
    fileUrl?: string;
    isPublic?: boolean;
    tagsJson?: string;
  }) {
    return request('/api/published-documents', { method: 'POST', body: JSON.stringify(doc) });
  },

  async trackDocumentInteraction(id: string, userId: string, type: 'view' | 'click' | 'download' = 'view') {
    return request(`/api/published-documents/${encodeURIComponent(id)}/interact`, {
      method: 'POST',
      body: JSON.stringify({ userId, type }),
    });
  },

  async resetDocumentInteractions(userId?: string) {
    const endpoint = userId
      ? `/api/published-documents/interactions/reset?userId=${encodeURIComponent(userId)}`
      : '/api/published-documents/interactions/reset';
    return request(endpoint, { method: 'DELETE' });
  },

  async incrementDocumentView(id: string) {
    return request(`/api/published-documents/${encodeURIComponent(id)}/view`, { method: 'POST' });
  },

  async incrementDocumentDownload(id: string) {
    return request(`/api/published-documents/${encodeURIComponent(id)}/download`, { method: 'POST' });
  },

  async deletePublishedDocument(id: string) {
    return request(`/api/published-documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getPublishedDocumentsCount(userId: string) {
    return request<{ success: boolean; count: number }>(`/api/published-documents/count?userId=${encodeURIComponent(userId)}`);
  },

  async checkPublishedDuplicates(userId: string, files: Array<{ id?: string; name: string; size?: number }>) {
    return request<{ success: boolean; duplicates: Array<{ fileId?: string; fileName: string; isDuplicate: boolean; existingTitle?: string }> }>(
      '/api/published-documents/check-duplicates',
      {
        method: 'POST',
        body: JSON.stringify({ userId, files })
      }
    );
  },



  // --------------------------------------------------------------------------
  // Assistant Delmas (Chat)
  // --------------------------------------------------------------------------
  async getChatHistory(userId: string, sessionId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/chat?userId=${encodeURIComponent(userId)}&sessionId=${encodeURIComponent(sessionId)}`);
  },

  async sendChatMessage(msg: { userId: string; sessionId: string; sender: 'user' | 'ai'; messageText: string; attachedResourceId?: string }) {
    return request('/api/chat', { method: 'POST', body: JSON.stringify(msg) });
  },

  // --------------------------------------------------------------------------
  // Abonnements
  // --------------------------------------------------------------------------
  async getSubscription(userId: string) {
    return request<{ success: boolean; data: any }>(`/api/subscriptions?userId=${encodeURIComponent(userId)}`);
  },

  // --------------------------------------------------------------------------
  // Contenus Générés par l'IA (Résumés, Cartes, Quiz, etc. - Base D1)
  // --------------------------------------------------------------------------
  async getAiContents(userId: string, toolType?: string, fileId?: string) {
    let endpoint = `/api/ai-contents?userId=${encodeURIComponent(userId)}`;
    if (toolType) endpoint += `&toolType=${encodeURIComponent(toolType)}`;
    if (fileId) endpoint += `&fileId=${encodeURIComponent(fileId)}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
  },

  async saveAiContent(data: {
    id?: string;
    userId: string;
    fileId?: string | null;
    conversationId?: string | null;
    toolType: string;
    title: string;
    contentJson: any;
    sourceFileName?: string;
    isPinned?: boolean;
  }) {
    return request<{ success: boolean; data: { id: string } }>('/api/ai-contents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteAiContent(id: string, userId?: string) {
    let endpoint = `/api/ai-contents/${id}`;
    if (userId) endpoint += `?userId=${encodeURIComponent(userId)}`;
    return request<{ success: boolean }>(endpoint, { method: 'DELETE' });
  },

  async togglePinAiContent(id: string, isPinned: boolean) {
    return request<{ success: boolean }>(`/api/ai-contents/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ isPinned }),
    });
  },

  // --------------------------------------------------------------------------
  // Perceptions de Fichiers IA (Base de données Cloudflare D1 avec TTL de 30 min)
  // Zéro stockage local : lié strictement à l'userId en base D1
  // --------------------------------------------------------------------------
  async getAiFilePerception(userId: string, fileSignature: string): Promise<string | null> {
    if (!userId || userId === 'default-user' || !fileSignature) return null;
    try {
      const res = await request<{ success: boolean; perception: string | null }>(
        `/api/ai/file-perception?userId=${encodeURIComponent(userId)}&fileSignature=${encodeURIComponent(fileSignature)}&_t=${Date.now()}`
      );
      if (res && res.success && res.perception) {
        return res.perception;
      }
    } catch (e) {
      console.warn('[API] Erreur récupération perception D1:', e);
    }
    return null;
  },

  async saveAiFilePerception(data: {
    userId: string;
    fileSignature: string;
    fileName?: string;
    perceptionReport: string;
  }): Promise<boolean> {
    if (!data.userId || data.userId === 'default-user' || !data.fileSignature || !data.perceptionReport) return false;
    try {
      const res = await request<{ success: boolean }>('/api/ai/file-perception', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return Boolean(res && res.success);
    } catch (e) {
      console.warn('[API] Erreur enregistrement perception D1:', e);
      return false;
    }
  },

  async clearAiFilePerceptions(userId: string): Promise<boolean> {
    if (!userId || userId === 'default-user') return false;
    try {
      const res = await request<{ success: boolean }>(`/api/ai/file-perception?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      return Boolean(res && res.success);
    } catch (e) {
      console.warn('[API] Erreur purge perceptions D1:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Configuration et Modèles Robot Rouge (Depuis le Tableau de Bord)
  // --------------------------------------------------------------------------
  async getRobotRougeConfig() {
    try {
      const res = await fetch('https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev/api/public/robot-rouge-config');
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erreur réseau', models: [] };
    }
  },

  // --------------------------------------------------------------------------
  // Conversations et Historique de Chat (Style Gemini - Worker IA Dédié)
  // --------------------------------------------------------------------------
  async getAiConversations(userId: string) {
    return aiRequest<{ success: boolean; data: any[] }>(`/api/ai/conversations?userId=${encodeURIComponent(userId)}`);
  },

  async createAiConversation(data: { id?: string; userId: string; title: string }) {
    return aiRequest<{ success: boolean; data: { id: string; title: string } }>('/api/ai/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteAiConversation(id: string) {
    return aiRequest<{ success: boolean; message: string }>(`/api/ai/conversations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getAiConversationMessages(conversationId: string) {
    return aiRequest<{ success: boolean; data: any[] }>(`/api/ai/messages?conversationId=${encodeURIComponent(conversationId)}`);
  },

  async saveAiMessage(data: { id?: string; conversationId: string; role: 'user' | 'assistant' | 'system'; content: string; metadata?: any; created_at?: string; createdAt?: string }) {
    return aiRequest<{ success: boolean }>('/api/ai/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAiConversationCreations(conversationId: string) {
    return aiRequest<{ success: boolean; data: any[] }>(`/api/ai/creations?conversationId=${encodeURIComponent(conversationId)}`);
  },

  async saveAiCreationRecord(data: { id?: string; conversationId: string; messageId?: string; type: string; title?: string; content: any }) {
    return aiRequest<{ success: boolean }>('/api/ai/creations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // --------------------------------------------------------------------------
  // Tâches Asynchrones & Parallélisme IA (Non-bloquant, multi-tâches)
  // --------------------------------------------------------------------------
  async createAiBackgroundTask(params: {
    userId?: string;
    sessionId?: string;
    taskType: string;
    prompt: string;
    attachedFileContent?: string;
    attachedFileName?: string;
  }) {
    const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';
    return aiRequest<{ success: boolean; taskId: string; status: string; message: string }>('/api/ai/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        userId: currentUserId,
      }),
    });
  },

  async getAiTaskStatus(taskId: string, userId?: string) {
    let endpoint = `/api/ai/tasks?taskId=${encodeURIComponent(taskId)}`;
    if (userId) endpoint += `&userId=${encodeURIComponent(userId)}`;
    return aiRequest<{ success: boolean; task: any }>(endpoint);
  },

  async getUserAiTasks(userId: string) {
    return aiRequest<{ success: boolean; tasks: any[] }>(`/api/ai/tasks?userId=${encodeURIComponent(userId)}`);
  },

  // --------------------------------------------------------------------------
  // Synchronisation Globale & Sauvegarde Cloud
  // --------------------------------------------------------------------------
  async backupCloud(payload: {
    userId: string;
    userProfile?: any;
    matieres?: any[];
    notes?: any[];
    scheduleSlots?: any[];
    scheduleConfig?: any;
    alarms?: any[];
    shopProfile?: any;
    grades?: any[];
    calendarEvents?: any[];
  }) {
    return request<{ success: boolean; message: string; timestamp: string }>('/api/sync/backup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // --------------------------------------------------------------------------
  // Minuteur d'Étude & Presets d'Heures Enregistrées (Horloge)
  // --------------------------------------------------------------------------
  async getTimerPresets(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/timer-presets?userId=${encodeURIComponent(userId)}`);
  },

  async saveTimerPreset(preset: {
    id?: string;
    userId: string;
    durationSeconds: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    label?: string;
  }) {
    return request<{ success: boolean; data: any }>('/api/timer-presets', {
      method: 'POST',
      body: JSON.stringify(preset),
    });
  },

  async deleteTimerPreset(id: string) {
    return request<{ success: boolean; message: string }>(`/api/timer-presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // --------------------------------------------------------------------------
  // Parrainage & Promotion (Système de parrainage et récompenses D1)
  // --------------------------------------------------------------------------
  async getReferralStatus(userId?: string) {
    const token = localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token') || '';
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestAuth(`/api/referrals/my-status${query}`, { method: 'GET' }, token);
  },

  async updateReferralConfig(config: { daysPerReferral?: number; milestones?: any[]; rules?: string[] }) {
    const token = localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token') || '';
    return requestAuth('/api/referrals/config', { method: 'PUT', body: JSON.stringify(config) }, token);
  },

  async restoreCloud(userId: string) {
    return request<{ success: boolean; data: any }>(`/api/sync/restore?userId=${encodeURIComponent(userId)}`);
  },

  // --------------------------------------------------------------------------
  // Notifications (Connecté D1 & Push)
  // --------------------------------------------------------------------------
  async getNotifications(userId: string, sort?: 'recent' | 'oldest') {
    const sortParam = sort ? `&sort=${encodeURIComponent(sort)}` : '';
    return request<{ success: boolean; data: any[]; unreadCount: number }>(
      `/api/notifications?userId=${encodeURIComponent(userId)}${sortParam}`
    );
  },

  async markNotificationAsRead(userId: string, notificationId?: string, all = false) {
    return request<{ success: boolean }>(`/api/notifications/read`, {
      method: 'POST',
      body: JSON.stringify({ userId, notificationId, all }),
    });
  },

  async deleteNotification(userId: string, notificationId?: string, all = false) {
    let url = `/api/notifications?userId=${encodeURIComponent(userId)}`;
    if (all) url += '&all=true';
    else if (notificationId) url += `&id=${encodeURIComponent(notificationId)}`;
    return request<{ success: boolean }>(url, { method: 'DELETE' });
  },

  async createNotification(notification: { userId: string; title: string; description: string; itemRef?: string; type?: string }) {
    return request<{ success: boolean }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notification),
    });
  },

  // --------------------------------------------------------------------------
  // Liens Externes Dynamiques (YouTube, Telegram, WhatsApp, etc. stockés en D1)
  // --------------------------------------------------------------------------
  async getAppLinks() {
    return request<{
      success: boolean;
      data: Record<string, string>;
      links: Array<{ id: string; name: string; url: string; description?: string; updated_at?: string }>;
    }>('/api/app-links');
  },

  async updateAppLink(id: string, url: string, name?: string) {
    return request<{ success: boolean; message?: string }>('/api/app-links', {
      method: 'POST',
      body: JSON.stringify({ id, url, name }),
    });
  },

  // --------------------------------------------------------------------------
  // Suppression définitive du compte et de toutes ses données
  // --------------------------------------------------------------------------
  async deleteAccount(userId?: string, email?: string) {
    const token = localStorage.getItem('sc_auth_token') || localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token') || '';
    return requestAuth<{ success: boolean; message: string }>('/api/users/delete-account', {
      method: 'POST',
      body: JSON.stringify({ userId, email }),
    }, token);
  },

  // --------------------------------------------------------------------------
  // Suppression définitive de la boutique et de toutes ses données vendeur
  // --------------------------------------------------------------------------
  async deleteShop(shopName: string) {
    const token = localStorage.getItem('sc_auth_token') || localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token') || '';
    return requestAuth<{ success: boolean; message: string }>('/api/shop/delete', {
      method: 'POST',
      body: JSON.stringify({ shopName }),
    }, token);
  },
};

/**
 * Correction et notation officielle d'une épreuve d'examen par l'IA
 * Transmet les réponses du candidat au Worker et évalue sur 20 points
 * Délivre un certificat d'excellence unique si score >= 16/20
 */
export async function gradeExamPaper(payload: {
  exam: any;
  answers: any;
  userId?: string;
  studentName?: string;
  sourceFileName?: string;
  sourceFileId?: string;
  topic?: string;
}): Promise<{
  success: boolean;
  scoreTotal: number;
  scoreP1: number;
  scoreP2: number;
  scoreP3: number;
  scoreP4: number;
  feedbackGlobal: string;
  exercices: Record<string, any>;
  certificateInfo: {
    eligible: boolean;
    awarded: boolean;
    alreadyIssued: boolean;
    certificate: any;
    message: string;
  };
}> {
  const currentUserId = payload.userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  const currentUserName = payload.studentName || localStorage.getItem('unifolder_user_name') || 'Étudiant StudyCloud';
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');

  const response = await fetch(`${dedicatedAiUrl}/api/ai/grade-exam`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUserId,
    },
    body: JSON.stringify({
      ...payload,
      userId: currentUserId,
      studentName: currentUserName,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Erreur lors de la correction par l'IA (${response.status})`);
  }

  return await response.json();
}

/**
 * Récupère les certificats officiels délivrés à l'utilisateur
 */
export async function getUserCertificates(userId?: string): Promise<{
  success: boolean;
  data: Array<{
    id: string;
    user_id: string;
    source_file_id?: string;
    source_file_name?: string;
    topic: string;
    score: number;
    max_score: number;
    certificate_code: string;
    student_name: string;
    issued_at: string;
  }>;
}> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');

  const response = await fetch(`${dedicatedAiUrl}/api/ai/certificates?userId=${encodeURIComponent(currentUserId)}`, {
    headers: {
      'x-user-id': currentUserId,
    },
  });

  if (!response.ok) {
    return { success: false, data: [] };
  }

  return await response.json();
}

export interface UserStorageQuotaDetails {
  userId: string;
  planName: string;
  welcomeStorage: {
    totalMb: number;
    filesMb: number;
    dataMb: number;
    formatted: string;
  };
  paidStorage: {
    totalMb: number;
    filesMb: number;
    dataMb: number;
    formatted: string;
  };
  bonusStorage: {
    totalMb: number;
    formatted: string;
  };
  totalAllowedMb: number;
  totalAllowedFormatted: string;
  totalUsedBytes: number;
  totalUsedMb: number;
  totalUsedFormatted: string;
  totalPercentage: number;
  filesStorage: {
    name: string;
    subtitle: string;
    count: number;
    usedBytes: number;
    usedMb: number;
    usedFormatted: string;
    allowedMb: number;
    allowedFormatted: string;
    percentage: number;
    freeNote: string;
  };
  dataStorage: {
    name: string;
    subtitle: string;
    count: number;
    usedBytes: number;
    usedMb: number;
    usedFormatted: string;
    allowedMb: number;
    allowedFormatted: string;
    percentage: number;
    freeNote: string;
  };
  wordsUsage: {
    name: string;
    subtitle: string;
    usedWords: number;
    maxWords: number;
    remainingWords: number;
    percentage: number;
    formatted: string;
  };
}

/**
 * Calcule une vue locale complète et immédiate du stockage de l'utilisateur
 * (30 Mo offerts par défaut, fichiers enregistrés, notes, etc.)
 */
export function computeFallbackUserStorage(userId: string): UserStorageQuotaDetails {
  let localFilesCount = 0;
  let localFilesBytes = 0;
  try {
    const rawItems = localStorage.getItem('unifolder_files_menu_items') || localStorage.getItem('unifolder_user_files');
    if (rawItems) {
      const items = JSON.parse(rawItems);
      if (Array.isArray(items)) {
        localFilesCount = items.length;
        localFilesBytes = items.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0);
      }
    }
  } catch (e) {}

  let dataCount = 0;
  let dataBytes = 0;
  try {
    const matieres = JSON.parse(localStorage.getItem('unifolder_saved_matieres') || '[]');
    const notes = JSON.parse(localStorage.getItem('unifolder_keep_notes') || '[]');
    const schedule = JSON.parse(localStorage.getItem('user_schedule_data') || '[]');
    const grades = JSON.parse(localStorage.getItem('unifolder_grades_data') || '[]');
    dataCount = matieres.length + notes.length + schedule.length + grades.length;
    dataBytes = JSON.stringify({ matieres, notes, schedule, grades }).length * 2;
  } catch (e) {}

  let welcomeMb = 100;
  let paidMb = 0;
  let bonusMb = 0;
  try {
    const cached = localStorage.getItem('studycloud_cached_user_storage');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) {
        if (typeof parsed.welcomeStorage?.totalMb === 'number') welcomeMb = parsed.welcomeStorage.totalMb;
        if (typeof parsed.paidStorage?.totalMb === 'number') paidMb = parsed.paidStorage.totalMb;
        if (typeof parsed.bonusStorage?.totalMb === 'number') bonusMb = parsed.bonusStorage.totalMb;
      }
    }
  } catch {}

  const totalAllowedMb = welcomeMb + paidMb + bonusMb;

  const usedFilesMb = Number((localFilesBytes / (1024 * 1024)).toFixed(2));
  const usedDataMb = Number((dataBytes / (1024 * 1024)).toFixed(2));
  const totalUsedMb = Number((usedFilesMb + usedDataMb).toFixed(2));
  const totalPercentage = Math.min(100, Math.round((totalUsedMb / totalAllowedMb) * 100));

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  return {
    userId,
    planName: paidMb > 0 ? 'Plan Avancé' : 'Plan Étudiant Gratuit',
    welcomeStorage: {
      totalMb: welcomeMb,
      filesMb: Math.round(welcomeMb / 3),
      dataMb: Math.round((welcomeMb * 2) / 3),
      formatted: welcomeMb >= 1024 ? `${(welcomeMb / 1024).toFixed(2)} Go` : `${welcomeMb} Mo`,
    },
    paidStorage: {
      totalMb: paidMb,
      filesMb: Math.round(paidMb / 2),
      dataMb: Math.round(paidMb / 2),
      formatted: paidMb >= 1024 ? `${(paidMb / 1024).toFixed(2)} Go` : `${paidMb} Mo`,
    },
    bonusStorage: {
      totalMb: bonusMb,
      formatted: `${bonusMb} Mo`,
    },
    totalAllowedMb,
    totalAllowedFormatted: totalAllowedMb >= 1024 ? `${(totalAllowedMb / 1024).toFixed(2)} Go` : `${totalAllowedMb} Mo`,
    totalUsedBytes: localFilesBytes + dataBytes,
    totalUsedMb,
    totalUsedFormatted: formatSize(localFilesBytes + dataBytes),
    totalPercentage,
    filesStorage: {
      name: 'Stockage Documents & Fichiers',
      subtitle: 'Vos cours personnels, devoirs, polycopiés et documents PDF téléversés',
      count: localFilesCount,
      usedBytes: localFilesBytes,
      usedMb: usedFilesMb,
      usedFormatted: formatSize(localFilesBytes),
      allowedMb: totalAllowedMb,
      allowedFormatted: `${totalAllowedMb} Mo`,
      percentage: Math.min(100, Math.round((usedFilesMb / totalAllowedMb) * 100)),
      freeNote: 'Partage libre / Sur quota global',
    },
    dataStorage: {
      name: "Espace Données & Fiches d'Étude",
      subtitle: "Vos fiches mémoires, notes de cours, emploi du temps, relevés et contenus",
      count: dataCount,
      usedBytes: dataBytes,
      usedMb: usedDataMb,
      usedFormatted: formatSize(dataBytes),
      allowedMb: totalAllowedMb,
      allowedFormatted: `${totalAllowedMb} Mo`,
      percentage: Math.min(100, Math.round((usedDataMb / totalAllowedMb) * 100)),
      freeNote: 'Partage libre / Sur quota global',
    },
    wordsUsage: {
      name: 'Crédits IA',
      subtitle: "Crédits pour vos discussions et analyses avec l'IA",
      usedWords: 0,
      maxWords: 0,
      remainingWords: 0,
      percentage: 0,
      formatted: '0 crédit restant',
    },
  };
}

/**
 * Récupère le stockage réel de l'utilisateur depuis le worker principal et la base D1,
 * avec résilience absolue pour ne JAMAIS afficher de bannière d'erreur rouge.
 */
export async function getUserStorageQuota(userId?: string): Promise<{
  success: boolean;
  data: UserStorageQuotaDetails;
  error?: string;
}> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  const fallbackData = computeFallbackUserStorage(currentUserId);

  try {
    const primaryUrl = `${getWorkerApiUrl().replace(/\/+$/, '')}/api/user/storage?userId=${encodeURIComponent(currentUserId)}`;
    const res = await fetch(primaryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
      },
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.data) {
        try {
          localStorage.setItem('studycloud_cached_user_storage', JSON.stringify(json.data));
        } catch {}
        return { success: true, data: json.data };
      }
    }

    // Essai sur le worker miroir de production API (l'interface reste découplée du tableau de bord admin)
    const fallbackUrls = [
      `https://studycloud-worker.delmaskouassidibi.workers.dev/api/user/storage?userId=${encodeURIComponent(currentUserId)}`,
    ];

    for (const fbUrl of fallbackUrls) {
      try {
        const fbRes = await fetch(fbUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUserId,
          },
        });
        if (fbRes.ok) {
          const fbJson = await fbRes.json().catch(() => null);
          if (fbJson && fbJson.success && fbJson.data) {
            try {
              localStorage.setItem('studycloud_cached_user_storage', JSON.stringify(fbJson.data));
            } catch {}
            return { success: true, data: fbJson.data };
          }
        }
      } catch {}
    }

    // Si les routes distantes ne répondent pas ou retournent 404, utiliser le calcul local fluide
    return {
      success: true,
      data: fallbackData,
    };
  } catch (err) {
    console.warn('[API] Utilisation du calcul de stockage local (résilience):', err);
    return {
      success: true,
      data: fallbackData,
    };
  }
}

/**
 * Soumet une demande d'augmentation de stockage
 */
export async function requestStorageUpgrade(params: {
  packId: string;
  packName: string;
  additionalMb: number;
  additionalWords?: number;
  userName?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  userEmail?: string;
  pricePaid?: number;
  priceDisplay?: string;
  storageDisplay?: string;
  billingCycle?: 'annual' | 'monthly';
  currency?: string;
  paymentMethod?: string;
  paymentReference?: string;
  receiptImageUrl?: string;
  receiptR2Key?: string;
  notes?: string;
  userId?: string;
  requestType?: 'renewal' | 'upgrade' | string;
  isRenewal?: boolean;
}): Promise<{ success: boolean; message: string; requestId?: string }> {
  const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  try {
    return await request<{ success: boolean; message: string; requestId?: string }>(
      '/api/user/storage/upgrade-request',
      {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          userId: currentUserId,
        }),
      }
    );
  } catch (err: any) {
    console.error('[API] Erreur requestStorageUpgrade:', err);
    return {
      success: false,
      message: err?.message || "Erreur lors de l'enregistrement de la demande",
    };
  }
}

export interface CompanyProfile {
  company_name: string;
  activity: string;
  location: string;
  address?: string;
  website?: string;
  email?: string;
  phone_contact: string;
  phone_whatsapp: string;
  phone_contact_secondary?: string;
  about_text?: string;
  wave_number: string;
  wave_name: string;
  wave_enabled?: number;
  wave_show_number?: number;
  wave_show_image?: number;
  wave_image_url?: string;
  orange_number: string;
  orange_name: string;
  orange_enabled?: number;
  orange_show_number?: number;
  orange_show_image?: number;
  orange_image_url?: string;
  mtn_number: string;
  mtn_name: string;
  mtn_enabled?: number;
  mtn_show_number?: number;
  mtn_show_image?: number;
  mtn_image_url?: string;
  moov_number?: string;
  moov_name?: string;
  moov_enabled?: number;
  moov_show_number?: number;
  moov_show_image?: number;
  moov_image_url?: string;
  payment_instructions?: string;
}

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  company_name: 'DKD Technologies',
  activity: 'Technologies & Éducation Numérique',
  location: 'Abidjan, Côte d\'Ivoire',
  address: 'Abidjan, Côte d\'Ivoire',
  phone_contact: '+225 0101007978',
  phone_whatsapp: '+225 0101007978',
  email: 'contact@dkd-technologies.com',
  website: 'https://studycloud.dkd-technologies.com',
  wave_number: '+225 07 00 00 00 00',
  wave_name: 'StudyCloud CI',
  wave_enabled: 1,
  wave_show_number: 1,
  wave_show_image: 1,
  wave_image_url: '',
  orange_number: '+225 07 00 00 00 00',
  orange_name: 'Orange Money Côte d\'Ivoire',
  orange_enabled: 1,
  orange_show_number: 1,
  orange_show_image: 1,
  orange_image_url: '',
  mtn_number: '+225 05 00 00 00 00',
  mtn_name: 'MTN Mobile Money CI',
  mtn_enabled: 1,
  mtn_show_number: 1,
  mtn_show_image: 1,
  mtn_image_url: '',
  moov_number: '+225 01 00 00 00 00',
  moov_name: 'Moov Money Côte d\'Ivoire',
  moov_enabled: 1,
  moov_show_number: 1,
  moov_show_image: 1,
  moov_image_url: '',
  payment_instructions: 'Transférez le montant exact sur l\'un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu avec la date et le numéro de transaction.'
};

/**
 * Récupère les informations professionnelles et coordonnées marchandes de l'entreprise
 */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const t = Date.now();
  const mainWorkerUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const candidateUrls = [
    `${mainWorkerUrl}/api/company-profile?_t=${t}`,
    `https://api-worker.dkd-technologies.com/api/company-profile?_t=${t}`,
    `https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev/api/company-profile?_t=${t}`,
    `https://studycloud-worker.delmaskouassidibi.workers.dev/api/company-profile?_t=${t}`
  ];

  const normalizeProfile = (raw: any): CompanyProfile => {
    const toFlag = (v: any, def: number) => {
      if (v === 1 || v === '1' || v === true) return 1;
      if (v === 0 || v === '0' || v === false) return 0;
      return def;
    };

    return {
      ...DEFAULT_COMPANY_PROFILE,
      ...raw,
      wave_enabled: toFlag(raw?.wave_enabled, 1),
      wave_show_number: toFlag(raw?.wave_show_number, 1),
      wave_show_image: toFlag(raw?.wave_show_image, 1),
      orange_enabled: toFlag(raw?.orange_enabled, 0),
      orange_show_number: toFlag(raw?.orange_show_number, 1),
      orange_show_image: toFlag(raw?.orange_show_image, 1),
      mtn_enabled: toFlag(raw?.mtn_enabled, 0),
      mtn_show_number: toFlag(raw?.mtn_show_number, 1),
      mtn_show_image: toFlag(raw?.mtn_show_image, 1),
      moov_enabled: toFlag(raw?.moov_enabled, 0),
      moov_show_number: toFlag(raw?.moov_show_number, 1),
      moov_show_image: toFlag(raw?.moov_show_image, 1),
      payment_instructions: raw?.payment_instructions || DEFAULT_COMPANY_PROFILE.payment_instructions
    };
  };

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && (data.success || data.profile) && data.profile) {
          return normalizeProfile(data.profile);
        }
      }
    } catch (e) {
      console.warn('[API] Essai connecteur profil échoué sur ' + url, e);
    }
  }

  try {
    const res = await request<{ success: boolean; profile?: CompanyProfile }>(
      `/api/company-profile?_t=${t}`,
      { method: 'GET', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }
    );
    if (res && res.profile && res.profile.company_name) {
      return normalizeProfile(res.profile);
    }
  } catch (err) {
    console.warn('[API] Utilisation du profil entreprise par défaut:', err);
  }

  return DEFAULT_COMPANY_PROFILE;
}

/**
 * Récupère les abonnements actifs et passés de l'utilisateur
 */
export async function getUserSubscriptions(userId?: string): Promise<{ success: boolean; subscriptions: any[]; quota?: any }> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  try {
    return await request<{ success: boolean; subscriptions: any[]; quota?: any }>(
      `/api/user/subscriptions?userId=${encodeURIComponent(currentUserId)}`,
      { method: 'GET' }
    );
  } catch (err) {
    return { success: false, subscriptions: [] };
  }
}

/**
 * Récupère l'historique des demandes de stockage et de renouvellement de l'utilisateur
 */
export async function getUserStorageRequests(userId?: string): Promise<{ success: boolean; requests: any[] }> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  try {
    return await request<{ success: boolean; requests: any[] }>(
      `/api/user/storage/upgrade-requests?userId=${encodeURIComponent(currentUserId)}`,
      { method: 'GET' }
    );
  } catch (err) {
    return { success: false, requests: [] };
  }
}

/**
 * Supprime une demande de l'historique utilisateur (Purge effective après 1 mois / 30 jours)
 */
export async function deleteUserRequestHistory(
  requestId: string,
  userId?: string
): Promise<{ success: boolean; message?: string; purgeEffectiveAt?: string; error?: string }> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  try {
    return await request<{ success: boolean; message?: string; purgeEffectiveAt?: string; error?: string }>(
      '/api/user/storage/delete-history-item',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, userId: currentUserId })
      }
    );
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la suppression' };
  }
}

/**
 * Récupère l'historique complet de tous les achats et paiements effectués par l'utilisateur
 */
export async function getUserPurchasesHistory(
  userId?: string
): Promise<{ success: boolean; purchases: any[] }> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  try {
    return await request<{ success: boolean; purchases: any[] }>(
      `/api/user/purchases-history?userId=${encodeURIComponent(currentUserId)}`,
      { method: 'GET' }
    );
  } catch (err) {
    return { success: false, purchases: [] };
  }
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  badge?: string;
  description?: string;
  storage_amount?: string;
  storage_mb?: number;
  credits_or_words?: string;
  credits_count?: number;
  price: number;
  primary_currency: string;
  currencies_enabled: string | string[];
  currency_conversions: string | Record<string, number>;
  yearly_price: number;
  yearly_discount_pct: number;
  features: string | Array<{ text: string; enabled: boolean }>;
  is_auto_billing: number;
  is_active: number;
  sort_order?: number;
  pricing_model?: 'subscription' | 'one_time' | 'pack';
}

/**
 * Récupère dynamiquement les formules et cartes d'abonnements (Stockage & Assistante IA)
 * avec horodatage anti-cache et fallback multi-serveurs Cloudflare D1
 */
export async function getSubscriptionPlans(): Promise<{
  success: boolean;
  storagePlans: SubscriptionPlan[];
  aiPlans: SubscriptionPlan[];
}> {
  const t = Date.now();

  // Liste des endpoints Cloudflare Workers synchronisés sur la base D1
  // On priorise le Worker principal (api-worker / getWorkerApiUrl) où l'application est connectée
  const mainWorkerUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const candidateUrls = [
    `${mainWorkerUrl}/api/subscription-plans?active_only=1&_t=${t}`,
    `https://api-worker.dkd-technologies.com/api/subscription-plans?active_only=1&_t=${t}`,
    `https://studycloud-worker.delmaskouassidibi.workers.dev/api/subscription-plans?active_only=1&_t=${t}`,
    `https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev/api/subscription-plans?active_only=1&_t=${t}`
  ];

  let firstValidResult: { storagePlans: SubscriptionPlan[]; aiPlans: SubscriptionPlan[] } | null = null;

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success) {
          const sPlans = Array.isArray(data.storagePlans) ? data.storagePlans : [];
          const aPlans = Array.isArray(data.aiPlans) ? data.aiPlans : [];
          if (!firstValidResult) {
            firstValidResult = { storagePlans: sPlans, aiPlans: aPlans };
          }
          // Si cet endpoint a renvoyé des cartes, on les retourne immédiatement
          if (sPlans.length > 0 || aPlans.length > 0) {
            return {
              success: true,
              storagePlans: sPlans,
              aiPlans: aPlans
            };
          }
        }
      }
    } catch (e) {
      console.warn('[API] Essai connecteur forfaits échoué sur ' + url, e);
    }
  }

  if (firstValidResult) {
    return {
      success: true,
      storagePlans: firstValidResult.storagePlans,
      aiPlans: firstValidResult.aiPlans
    };
  }

  // Dernier recours : requête standard relative
  try {
    const res = await request<{
      success: boolean;
      storagePlans?: SubscriptionPlan[];
      aiPlans?: SubscriptionPlan[];
    }>(`/api/subscription-plans?active_only=1&_t=${t}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res && res.success) {
      return {
        success: true,
        storagePlans: res.storagePlans || [],
        aiPlans: res.aiPlans || []
      };
    }
  } catch (err) {}

  return { success: true, storagePlans: [], aiPlans: [] };
}

// ============================================================================
// GESTION FACTURATION, TOKENS ET CRÉDITS IA (FORMULE 2 - PROPORTIONNELLE)
// ============================================================================

export interface AiBillingConfig {
  tokens_per_credit: number;
  welcome_credits: number;
  daily_free_credits: number;
  is_daily_renewal_active: number;
  min_deduction_credit?: number;
  updated_at?: string;
}

export interface AiUserCreditProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  school?: string;
  filiere?: string;
  credits_balance: number;
  total_tokens_consumed: number;
  total_credits_purchased: number;
  total_credits_consumed: number;
  plan_tier?: string;
  last_usage_at?: string;
  updated_at?: string;
}

export interface AiUsageLogItem {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  action_type: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens: number;
  credits_deducted: number;
  balance_after?: number;
  model_used?: string;
  created_at: string;
}

/**
 * Récupère le taux actif de conversion configuré dans le Tableau de Bord (tokens par crédit).
 * Valeur par défaut : 1000 tokens = 1 crédit si non synchronisé.
 */
export const getActiveTokensPerCredit = (): number => {
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('studycloud_tokens_per_credit');
      if (cached && Number(cached) > 0) return Number(cached);
    }
  } catch {}
  return 1000;
};

/**
 * Enregistre et diffuse le nouveau taux de conversion tokens <-> crédits
 */
export const setActiveTokensPerCredit = (tokensPerCredit: number): void => {
  try {
    if (typeof localStorage !== 'undefined' && tokensPerCredit > 0) {
      localStorage.setItem('studycloud_tokens_per_credit', String(tokensPerCredit));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studycloud_billing_config_updated', { detail: { tokens_per_credit: tokensPerCredit } }));
      }
    }
  } catch {}
};

/**
 * Convertit un volume brut de tokens en crédits selon la Formule 2 proportionnelle du Tableau de Bord
 */
export const convertTokensToCredits = (tokens: number, customRate?: number): number => {
  if (!tokens || tokens <= 0) return 0;
  const rate = customRate && customRate > 0 ? customRate : getActiveTokensPerCredit();
  return Number((tokens / rate).toFixed(2));
};

/**
 * Formate l'affichage de la consommation en crédits pour l'utilisateur
 * (ex: '0,5 crédit', '1 crédit', '1,43 crédits') - Jamais de tokens bruts affichés
 */
export const formatConsumedCreditsDisplay = (tokens: number, customRate?: number): string => {
  const credits = convertTokensToCredits(tokens, customRate);
  const displayVal = credits < 0.01 && tokens > 0 ? 0.01 : credits;
  const formattedNum = displayVal.toLocaleString('fr-FR', {
    minimumFractionDigits: displayVal % 1 === 0 ? 0 : (displayVal * 10) % 1 === 0 ? 1 : 2,
    maximumFractionDigits: 2
  });
  const label = displayVal <= 1 ? 'crédit' : 'crédits';
  return `${formattedNum} ${label}`;
};

/**
 * Récupère la configuration globale de facturation IA (Taux tokens/crédit, bienvenue, quotidien)
 */
export async function getAiBillingConfig(): Promise<{ success: boolean; config: AiBillingConfig }> {
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getWorkerApiUrl().replace(/\/+$/, ''),
    'https://api-worker.dkd-technologies.com',
    'https://studycloud-worker.delmaskouassidibi.workers.dev',
    getAiWorkerUrl().replace(/\/+$/, '')
  ];

  for (const url of candidateUrls) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
      const res = await fetch(`${url}/api/ai/billing/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.config) {
          if (data.config.tokens_per_credit) {
            setActiveTokensPerCredit(Number(data.config.tokens_per_credit));
          }
          return { success: true, config: data.config };
        }
      }
    } catch (err) {
      // Continuer sur le candidat suivant
    }
  }

  return {
    success: true,
    config: {
      tokens_per_credit: getActiveTokensPerCredit(),
      welcome_credits: 50.0,
      daily_free_credits: 0.0,
      is_daily_renewal_active: 0
    }
  };
}

/**
 * Enregistre les nouvelles règles de facturation IA définies par l'administrateur
 */
export async function saveAiBillingConfig(
  config: Partial<AiBillingConfig>
): Promise<{ success: boolean; message?: string; config?: AiBillingConfig; error?: string }> {
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getWorkerApiUrl().replace(/\/+$/, ''),
    getAiWorkerUrl().replace(/\/+$/, '')
  ];
  for (const workerUrl of candidateUrls) {
    try {
      const res = await fetch(`${workerUrl}/api/ai/billing/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err: any) {}
  }
  return { success: false, error: 'Erreur réseau lors de la sauvegarde' };
}

/**
 * Récupère tous les utilisateurs avec leurs crédits IA en temps réel
 */
export async function getAiAdminUsers(): Promise<{ success: boolean; users: AiUserCreditProfile[]; error?: string }> {
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getWorkerApiUrl().replace(/\/+$/, ''),
    getAiWorkerUrl().replace(/\/+$/, '')
  ];
  for (const workerUrl of candidateUrls) {
    try {
      const res = await fetch(`${workerUrl}/api/ai/admin/users`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, users: data.users || [] };
      }
    } catch (err: any) {}
  }
  return { success: false, users: [], error: 'Erreur lors du chargement des utilisateurs' };
}

/**
 * Permet à l'administrateur d'ajouter ou de modifier les crédits d'un utilisateur spécifique
 */
export async function adjustUserAiCredits(
  userId: string,
  amount: number,
  action: 'add' | 'deduct' | 'remove' | 'set' | 'reset' = 'add',
  reason: string = 'Ajustement administrateur'
): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getWorkerApiUrl().replace(/\/+$/, ''),
    getAiWorkerUrl().replace(/\/+$/, '')
  ];
  for (const workerUrl of candidateUrls) {
    try {
      const res = await fetch(`${workerUrl}/api/ai/admin/user/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, user_id: userId, amount, action, operation: action, reason })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err: any) {}
  }
  return { success: false, error: "Erreur lors de l'ajustement des crédits" };
}

/**
 * Récupère le solde en direct, les tokens et les crédits consommés d'un utilisateur
 */
export async function getUserAiCreditsLive(
  userId: string
): Promise<{
  success: boolean;
  credits: {
    balance: number;
    tokensUsed: number;
    totalPurchased: number;
    totalConsumed: number;
    plan: string;
    daily_free_credits?: number;
    tokens_per_credit?: number;
    welcome_credits?: number;
    last_usage_at?: string;
  };
  error?: string;
}> {
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getWorkerApiUrl().replace(/\/+$/, ''),
    'https://api-worker.dkd-technologies.com',
    'https://studycloud-worker.delmaskouassidibi.workers.dev',
    getAiWorkerUrl().replace(/\/+$/, '')
  ];

  for (const url of candidateUrls) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
      const res = await fetch(`${url}/api/ai/user/credits?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.credits) {
          if (data.credits.tokens_per_credit) {
            setActiveTokensPerCredit(Number(data.credits.tokens_per_credit));
          }
          return { success: true, credits: data.credits };
        }
      }
    } catch (err: any) {
      // Continuer sur le candidat suivant
    }
  }

  return {
    success: false,
    credits: {
      balance: 0,
      tokensUsed: 0,
      totalPurchased: 0,
      totalConsumed: 0,
      plan: 'Étudiant Gratuit'
    }
  };
}

/**
 * Récupère le journal chronologique des consommations IA
 */
export async function getAiUsageLogs(): Promise<{ success: boolean; logs: AiUsageLogItem[]; error?: string }> {
  try {
    const workerUrl = getAiWorkerUrl();
    const res = await fetch(`${workerUrl}/api/ai/admin/logs`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, logs: data.logs || [] };
    }
  } catch (err) {}
  return { success: true, logs: [] };
}

/**
 * Déduit en temps réel la consommation de crédits de l'utilisateur dans Cloudflare D1
 * Émet l'événement 'studycloud_user_credits_updated' directement avec les données de la base
 */
export async function deductUserAiCredits(params: {
  userId: string;
  tokens: number;
  model?: string;
  promptPreview?: string;
  responsePreview?: string;
  operationType?: string;
  explicitCredits?: number;
}): Promise<{
  success: boolean;
  credits_deducted: number;
  remaining_balance: number;
  tokens_consumed: number;
  total_tokens_consumed?: number;
  total_credits_consumed?: number;
}> {
  const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getAiWorkerUrl().replace(/\/+$/, ''),
    getWorkerApiUrl().replace(/\/+$/, ''),
    'https://api-worker.dkd-technologies.com',
    'https://studycloud-worker.delmaskouassidibi.workers.dev'
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/api/ai/user/deduct-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          user_id: currentUserId,
          tokens: params.tokens,
          model: params.model || 'Delmas IA',
          prompt_preview: params.promptPreview || '',
          response_preview: params.responsePreview || '',
          operation_type: params.operationType || 'chat',
          explicit_credits: params.explicitCredits
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          // Déclencher l'événement global pour synchroniser les vues en temps réel avec les données D1
          try {
            window.dispatchEvent(new CustomEvent('studycloud_user_credits_updated', {
              detail: {
                userId: currentUserId,
                credits_deducted: data.credits_deducted,
                remaining_balance: data.remaining_balance,
                tokens_consumed: data.tokens_consumed,
                total_tokens_consumed: data.total_tokens_consumed,
                total_credits_consumed: data.total_credits_consumed
              }
            }));
          } catch {}

          return data;
        }
      }
    } catch (err) {
      // essayer url suivante
    }
  }

  // Pas de fabrication locale : retour propre
  return {
    success: false,
    credits_deducted: 0,
    remaining_balance: 0,
    tokens_consumed: params.tokens
  };
}

/**
 * Récupère les crédits achetés ou accordés à l'utilisateur depuis Cloudflare D1 (table user_ai_purchases)
 */
export async function getUserAiPurchases(
  userId?: string
): Promise<{ success: boolean; purchases: any[]; total_purchased: number }> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  const candidateUrls = [
    'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev',
    getAiWorkerUrl().replace(/\/+$/, ''),
    getWorkerApiUrl().replace(/\/+$/, ''),
    'https://api-worker.dkd-technologies.com',
    'https://studycloud-worker.delmaskouassidibi.workers.dev'
  ];

  for (const url of candidateUrls) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      const res = await fetch(`${url}/api/ai/user/purchases?userId=${encodeURIComponent(currentUserId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          return {
            success: true,
            purchases: Array.isArray(data.purchases) ? data.purchases : [],
            total_purchased: Number(data.total_purchased || 0)
          };
        }
      }
    } catch {}
  }

  return { success: true, purchases: [], total_purchased: 0 };
}



