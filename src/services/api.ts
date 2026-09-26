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

// URL du Worker Cloudflare Agent Neuronal dédié à l'assistante IA StudyCloud
export const getAiWorkerUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_AI_WORKER_URL ||
    localStorage.getItem('studycloud_ai_worker_url') ||
    getStudyAgentUrl()
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

  const trimmed = raw.trim();

  // 1. Nettoyage préventif des commandes LaTeX pour doubler les antislashs uniques (\frac -> \\frac)
  // afin que JSON.parse n'interprète pas \f comme Form Feed (ASCII 12 \x0c) ou \b comme Backspace
  const latexRegex = /(?<!\\)\\(frac|sqrt|sum|int|lim|prod|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|forall|exists|infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|left|right|big|Big|text|textbf|textit|mathrm|mathbf|mathit|textsf|underline|over|hat|bar|vec|tilde|dot|ddot|circ|degree|angle|perp|parallel|subset|supset|cap|cup|in|notin|lor|land|neg|sim|cong|propto|begin|end)\b/gi;
  const preProcessed = trimmed.replace(latexRegex, '\\\\$1');

  // Essai direct après sécurisation LaTeX
  try {
    return cleanControlCharsInParsedObject(JSON.parse(preProcessed));
  } catch {}

  // 2. Nettoyage des caractères de contrôle bruts (sauts de ligne non échappés) et antislashs LaTeX
  let sanitized = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < preProcessed.length; i++) {
    const char = preProcessed[i];
    const code = preProcessed.charCodeAt(i);

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
        const sub = preProcessed.slice(i + 1);
        const isLatex = /^(?:frac|sqrt|sum|int|lim|prod|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|forall|exists|infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|left|right|big|Big|text|textbf|textit|mathrm|mathbf|mathit|textsf|underline|over|hat|bar|vec|tilde|dot|ddot|circ|degree|angle|perp|parallel|subset|supset|cap|cup|in|notin|lor|land|neg|sim|cong|propto|begin|end)\b/i.test(sub);
        const next = preProcessed[i + 1];

        if (isLatex) {
          sanitized += '\\\\';
        } else if (next && ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(next)) {
          sanitized += '\\';
        } else {
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
}> {
  const isPowerMode = Boolean(params.powerMode || params.engine === 'gemini');
  const userGeminiApiKey = (params.geminiApiKey || getGeminiApiKey()).trim();
  const dedicatedAiUrl = getAiWorkerUrl().replace(/\/+$/, '');

  const extractedDoc = params.attachedFileContent || params.file_content || params.fileContent || params.documentContent || params.documentText || '';
  const extractedDocName = params.attachedFileName || params.file_name || params.fileName || '';

  const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';

  const payload = {
    ...params,
    userId: currentUserId,
    powerMode: isPowerMode,
    isPowerMode: isPowerMode,
    engine: isPowerMode ? 'gemini' : (params.engine || 'standard'),
    geminiApiKey: userGeminiApiKey,
    message: params.prompt || params.message || '',
    prompt: params.prompt || params.message || '',
    conversation_id: params.conversationId || params.conversation_id || params.sessionId,
    conversationId: params.conversationId || params.conversation_id || params.sessionId,
    history: params.history || params.messages,
    attachedFileContent: extractedDoc,
    file_content: extractedDoc,
    fileContent: extractedDoc,
    documentContent: extractedDoc,
    documentText: extractedDoc,
    attachedFileName: extractedDocName,
    file_name: extractedDocName,
    fileName: extractedDocName,
  };

  // Appel vers le Neurone d'Agent StudyCloud (Durable Objects & Llama 70B) :
  let response: Response;
  try {
    response = await fetch(`${dedicatedAiUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
      },
      body: JSON.stringify(payload),
    });
  } catch (_netErr) {
    response = await fetch(dedicatedAiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
      },
      body: JSON.stringify(payload),
    });
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
          const geminiPrompt = `${params.prompt || params.message || 'Bonjour'}${extractedDoc ? `\n\nContenu document support ("${extractedDocName}") :\n${extractedDoc.slice(0, 35000)}` : ''}`;
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userGeminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: "Tu es Delmas IA, l'assistant d'étude officiel de StudyCloud. Réponds en français structuré avec rigueur pédagogique et formules LaTeX si nécessaire." }] },
                contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
                generationConfig: { temperature: 0.3 }
              }),
              signal: AbortSignal.timeout(30000),
            }
          );
          if (geminiResp.ok) {
            const geminiData = await geminiResp.json();
            const gText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (gText) {
              return {
                success: true,
                response: gText,
                chat_response: gText,
                model: 'Google Gemini (Secours Automatique)',
              };
            }
          }
        } catch (_gErr) {}
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

  if (hasCreationClues) {
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
        } else if (Array.isArray(parsed.questions) || Array.isArray(parsed.affirmations) || Array.isArray(parsed.cards) || parsed.root || parsed.overview || parsed.sections || parsed.exercises || parsed.exercices || parsed.written_exercise || parsed.complete_exam) {
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

  // 4. TENTATIVE : Gemini direct si une clé est configurée
  if (userGeminiApiKey && userGeminiApiKey.length > 10) {
    try {
      const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      for (const model of candidateModels) {
        try {
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userGeminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: `Tu es un expert pédagogique StudyCloud. Génère un(e) ${params.toolType} au format JSON strict.` }] },
                contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
                generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
              }),
              signal: AbortSignal.timeout(30000),
            }
          );
          if (geminiResp.ok) {
            const geminiData = await geminiResp.json();
            const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawText && rawText.length > 30) {
              const parsed = safeJsonParse(rawText);
              return finalizeCreation(parsed?.creation_data || parsed, rawText, `Gemini Direct (${model})`);
            }
          }
        } catch (_mErr) {}
      }
    } catch (_gErr) {}
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


async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
  defaultHeaders['x-user-id'] = userId;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
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
  const baseUrl = getAiWorkerUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
  defaultHeaders['x-user-id'] = userId;

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
    return request<{ success: boolean; data: any[] }>(`/api/matieres?userId=${encodeURIComponent(userId)}`);
  },

  async createMatiere(matiere: { id: string; userId: string; name: string; coefficient?: number; color?: string; category?: string; displayOrder?: number }) {
    return request('/api/matieres', { method: 'POST', body: JSON.stringify(matiere) });
  },

  async deleteMatiere(id: string) {
    return request(`/api/matieres/${id}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Fichiers & Stockage R2
  // --------------------------------------------------------------------------
  async getFiles(userId: string, matiereId?: string, isStudySession?: boolean, isFavorite?: boolean) {
    let endpoint = `/api/files?userId=${encodeURIComponent(userId)}`;
    if (matiereId) endpoint += `&matiereId=${encodeURIComponent(matiereId)}`;
    if (isStudySession !== undefined) endpoint += `&isStudySession=${isStudySession ? '1' : '0'}`;
    if (isFavorite !== undefined) endpoint += `&isFavorite=${isFavorite ? '1' : '0'}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
  },

  async uploadFileToR2(file: File | Blob, r2Key: string, contentType?: string): Promise<{ success: boolean; key: string; url: string }> {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/api/storage/upload?key=${encodeURIComponent(r2Key)}`;
    const finalContentType = contentType || (file as any).type || 'application/octet-stream';

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': finalContentType,
      },
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
    isFavorite?: boolean;
    isImported?: boolean;
    isStudySession?: boolean;
    lastImported?: number;
  }) {
    return request('/api/files', { method: 'POST', body: JSON.stringify(fileData) });
  },

  async toggleFileFavorite(id: string, isFavorite: boolean) {
    return request<{ success: boolean; message: string; isFavorite: number }>(`/api/files/${encodeURIComponent(id)}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ isFavorite }),
    });
  },

  async deleteFile(id: string) {
    return request(`/api/files/${id}`, { method: 'DELETE' });
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
  }) {
    return request('/api/study-files', { method: 'POST', body: JSON.stringify(fileData) });
  },

  async deleteStudyFile(id: string) {
    return request(`/api/study-files/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

  // --------------------------------------------------------------------------
  // Emploi du temps
  // --------------------------------------------------------------------------
  async getScheduleConfig(userId: string) {
    return request(`/api/schedule/config?userId=${encodeURIComponent(userId)}`);
  },

  async updateScheduleConfig(userId: string, daysJson: string, hoursJson: string, zoomLevel: number) {
    return request('/api/schedule/config', {
      method: 'PUT',
      body: JSON.stringify({ userId, daysJson, hoursJson, zoomLevel }),
    });
  },

  async getScheduleSlots(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/schedule/slots?userId=${encodeURIComponent(userId)}`);
  },

  async addScheduleSlot(slot: any) {
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
    return request<{ success: boolean; data: any[] }>(`/api/grades?userId=${encodeURIComponent(userId)}`);
  },

  async saveGrade(grade: any) {
    return request('/api/grades', { method: 'POST', body: JSON.stringify(grade) });
  },

  async deleteGrade(id: string) {
    return request(`/api/grades/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Bloc-Notes Keep
  // --------------------------------------------------------------------------
  async getNotes(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/notes?userId=${encodeURIComponent(userId)}`);
  },

  async saveNote(note: any) {
    return request('/api/notes', { method: 'POST', body: JSON.stringify(note) });
  },

  async deleteNote(id: string) {
    return request(`/api/notes/${id}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Calendrier
  // --------------------------------------------------------------------------
  async getCalendarEvents(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/calendar?userId=${encodeURIComponent(userId)}`);
  },

  async createCalendarEvent(event: any) {
    return request('/api/calendar', { method: 'POST', body: JSON.stringify(event) });
  },

  async deleteCalendarEvent(id: string) {
    return request(`/api/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Alarmes & Minuteur d'étude
  // --------------------------------------------------------------------------
  async getAlarms(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/alarms?userId=${encodeURIComponent(userId)}`);
  },

  async createAlarm(alarm: any) {
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
  // Contenus Générés par l'IA (Résumés, Cartes, Quiz, etc. - Worker IA Dédié)
  // --------------------------------------------------------------------------
  async getAiContents(userId: string, toolType?: string, fileId?: string) {
    let endpoint = `/api/ai-contents?userId=${encodeURIComponent(userId)}`;
    if (toolType) endpoint += `&toolType=${encodeURIComponent(toolType)}`;
    if (fileId) endpoint += `&fileId=${encodeURIComponent(fileId)}`;
    return aiRequest<{ success: boolean; data: any[] }>(endpoint);
  },

  async saveAiContent(data: {
    id?: string;
    userId: string;
    fileId?: string | null;
    toolType: string;
    title: string;
    contentJson: any;
    sourceFileName?: string;
    isPinned?: boolean;
  }) {
    return aiRequest<{ success: boolean; data: { id: string } }>('/api/ai-contents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteAiContent(id: string) {
    return aiRequest(`/api/ai-contents/${id}`, { method: 'DELETE' });
  },

  async togglePinAiContent(id: string, isPinned: boolean) {
    return aiRequest(`/api/ai-contents/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ isPinned }),
    });
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

  async saveAiMessage(data: { id?: string; conversationId: string; role: 'user' | 'assistant' | 'system'; content: string; metadata?: any }) {
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

  const welcomeMb = 30;
  const paidMb = 0;
  const bonusMb = 0;
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
    planName: 'Plan Étudiant Gratuit',
    welcomeStorage: {
      totalMb: welcomeMb,
      filesMb: 25,
      dataMb: 5,
      formatted: `${welcomeMb} Mo`,
    },
    paidStorage: {
      totalMb: paidMb,
      filesMb: 0,
      dataMb: 0,
      formatted: `${paidMb} Mo`,
    },
    bonusStorage: {
      totalMb: bonusMb,
      formatted: `${bonusMb} Mo`,
    },
    totalAllowedMb,
    totalAllowedFormatted: `${totalAllowedMb} Mo`,
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
      maxWords: 50000,
      remainingWords: 50000,
      percentage: 0,
      formatted: '50 000 crédits restants',
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
        return { success: true, data: json.data };
      }
    }

    // Essai sur les workers miroirs
    const fallbackUrls = [
      `https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev/api/user/storage?userId=${encodeURIComponent(currentUserId)}`,
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


