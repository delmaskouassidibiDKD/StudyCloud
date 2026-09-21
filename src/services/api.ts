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

// URL du Worker Cloudflare Workers AI dédié à l'assistante IA StudyCloud
export const getAiWorkerUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_AI_WORKER_URL ||
    localStorage.getItem('studycloud_ai_worker_url') ||
    'https://studycloud-ai.delmaskouassidibi.workers.dev'
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

  // Le Worker IA dédié (studycloud-ai) gère tout en interne :
  // - Si Mode Puissant actif : il utilise la clé StudyCloud-gemini pour Google Gemini 2.0 Flash
  // - Si Mode Puissant inactif : il utilise l'IA principale (Workers AI Llama)
  // Le Worker principal n'est pas interrogé.
  const response = await fetch(dedicatedAiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUserId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
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
    userId: currentUserId,
    powerMode: isPowerMode,
    isPowerMode: isPowerMode,
    engine: isPowerMode ? 'gemini' : 'standard',
    geminiApiKey: userGeminiApiKey,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER : Parse & normalise la réponse brute JSON du modèle IA
  // ─────────────────────────────────────────────────────────────────────────
  const parseCreationResponse = (data: any, rawText: string) => {
    let creationData = data.creation_data;
    if (typeof creationData === 'string') creationData = safeJsonParse(creationData);

    if (!creationData || (typeof creationData === 'object' && Object.keys(creationData).length === 0)) {
      try {
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || rawText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          const candidate = jsonMatch[1] || jsonMatch[0];
          const parsed = safeJsonParse(candidate);
          if (parsed && typeof parsed === 'object') {
            creationData = parsed.creation_data || (
              parsed.questions || parsed.affirmations || parsed.cards || parsed.root ||
              parsed.overview || parsed.sections || parsed.exercises || parsed.exercices ||
              parsed.written_exercise || parsed.complete_exam ? parsed : null
            );
          }
        }
      } catch {}
    }

    const creationType = data.creation_type || params.toolType;
    const creationTitle = data.creation_title || data.title || `${params.toolType.toUpperCase()} : ${params.docName}`;
    return { creationData, creationType, creationTitle };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER : Appel direct Gemini depuis le navigateur (fallback sans worker)
  // ─────────────────────────────────────────────────────────────────────────
  const callGeminiDirect = async (): Promise<{ success: boolean; creation_type: string; creation_title: string; creation_data: any; model?: string; rawText?: string }> => {
    // Clés Gemini connues (hardcodées en dernier recours) + clé utilisateur
    const knownKeys = [
      userGeminiApiKey,
      // Les clés seront tentées dans l'ordre, les vides ignorées
    ].filter(k => k && k.length > 10);

    if (knownKeys.length === 0) {
      throw new Error("Aucune clé API Gemini disponible pour le mode fallback. Veuillez configurer une clé dans les paramètres.");
    }

    const docSection = params.docContent && params.docContent.length > 20
      ? `\n\nDOCUMENT DE L'ÉTUDIANT ("${params.docName}") :\n${params.docContent.slice(0, 180000)}`
      : `\n\nDocument : "${params.docName}" (contenu non disponible, génère basé sur tes connaissances).`;

    const systemPrompt = `Tu es un expert pédagogique StudyCloud. Génère une création de type "${params.toolType}" basée sur le document ci-dessous.
RÈGLE ABSOLUE : Réponds UNIQUEMENT avec un objet JSON valide (sans bloc de code markdown). Le JSON doit contenir "creation_type", "creation_title", et "creation_data".
Pour "devoir-complet", "creation_data" doit avoir une clé "complete_exam" avec exactement 3 "sections" : Exercice 1 (open), Exercice 2 (multiple_choice), Exercice 3 (true_false).
INTERDIT : "Proposition A", "Option A", "Affirmation conceptuelle". Tout doit être du vrai contenu technique.

RÈGLE ABSOLUE DE SYNTAXE LATEX :
- Ne mets JAMAIS de symboles $ isolés à l'intérieur d'une expression LaTeX (interdit absolu d'écrire \\text{k}\\$\\Omega$ ou \\$\\Omega$).
- Pour l'ohm, écris toujours \\Omega (ex: $10\\text{ k}\\Omega$ ou $R_2 = 120\\text{ k}\\Omega$).
- Encadre TOUJOURS une formule mathématique par un unique symbole dollar de chaque côté pour du texte en ligne (ex: $R_{in} = R_1$) et par de doubles dollars pour les équations centrées ($$V_s = -\\frac{R_2}{R_1} V_e$$).
- Dans le JSON, double impérativement chaque antislash LaTeX (\\\\frac, \\\\sqrt, \\\\Omega, \\\\alpha, \\\\beta, \\\\times) afin qu'il ne soit jamais interprété comme un caractère de contrôle JSON (ex: \\f = Form Feed).
- Vérifie scrupuleusement que chaque balise ou délimiteur ouvert ({}, $ ou $$) est correctement fermé pour éviter l'affichage de code brut.
${docSection}`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-pro'];

    for (const apiKey of knownKeys) {
      for (const model of candidateModels) {
        try {
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: params.prompt || `Génère un(e) ${params.toolType} complet(e).` }] }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 8192,
                  responseMimeType: 'application/json',
                },
              }),
            }
          );

          if (geminiResp.ok) {
            const geminiData = await geminiResp.json();
            const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawText && rawText.length > 50) {
              const parsed = safeJsonParse(rawText) || {};
              const { creationData, creationType, creationTitle } = parseCreationResponse(
                { creation_type: parsed.creation_type || params.toolType, creation_title: parsed.creation_title, creation_data: parsed.creation_data || parsed },
                rawText
              );
              console.info(`[StudyCloud AI Fallback] Succès via Gemini direct : ${model}`);
              return {
                success: true,
                creation_type: creationType,
                creation_title: creationTitle,
                creation_data: creationData,
                model: `Gemini Direct (${model})`,
                rawText,
              };
            }
          } else if (geminiResp.status === 404) {
            // Modèle non disponible, essayer le suivant
            continue;
          } else if (geminiResp.status === 429) {
            // Si quota dépassé sur ce modèle, essayer le modèle suivant, sinon passer à la clé suivante
            if (model === 'gemini-2.5-pro') {
              break;
            }
            continue;
          }
        } catch (e) {
          console.warn(`[StudyCloud AI Fallback] Erreur Gemini direct (${model}):`, e);
        }
      }
    }
    throw new Error("Le service IA est temporairement surchargé. Veuillez réessayer dans quelques instants.");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ÉTAPE 1 : Essayer le worker Cloudflare
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const response = await fetch(dedicatedAiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000), // 55s timeout
    });

    if (response.ok) {
      const data = await response.json();

      // Si le worker renvoie success:false (modèles dépréciés, surchargés), basculer sur fallback
      if (data.success === false) {
        console.warn('[StudyCloud AI] Worker a retourné success:false, tentative fallback Gemini direct...', data.error);
        return await callGeminiDirect();
      }

      let rawText = '';
      if (typeof data.response === 'string') rawText = data.response;
      else if (typeof data.chat_message === 'string') rawText = data.chat_message;
      else if (typeof data.text === 'string') rawText = data.text;
      else rawText = JSON.stringify(data);

      const { creationData, creationType, creationTitle } = parseCreationResponse(data, rawText);

      return {
        success: true,
        creation_type: creationType,
        creation_title: creationTitle,
        creation_data: creationData,
        model: data.model,
        rawText,
        html_preview: data.html_preview,
      };
    } else {
      // Erreur HTTP du worker → fallback
      console.warn(`[StudyCloud AI] Worker HTTP ${response.status}, tentative fallback Gemini direct...`);
      return await callGeminiDirect();
    }
  } catch (workerErr: any) {
    // Timeout ou réseau → fallback
    if (workerErr?.name === 'AbortError' || workerErr?.name === 'TimeoutError') {
      console.warn('[StudyCloud AI] Worker timeout, tentative fallback Gemini direct...');
      return await callGeminiDirect();
    }
    // Autre erreur → fallback
    console.warn('[StudyCloud AI] Worker error:', workerErr?.message, '→ fallback Gemini direct...');
    return await callGeminiDirect();
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
 * Récupère le stockage réel de l'utilisateur depuis le worker principal et la base D1
 */
export async function getUserStorageQuota(userId?: string): Promise<{
  success: boolean;
  data: UserStorageQuotaDetails | null;
  error?: string;
}> {
  const currentUserId = userId || localStorage.getItem('unifolder_user_id') || 'default-user';
  try {
    const res = await request<{ success: boolean; data: UserStorageQuotaDetails }>(
      `/api/user/storage?userId=${encodeURIComponent(currentUserId)}`
    );
    return res;
  } catch (err: any) {
    console.error('[API] Erreur getUserStorageQuota:', err);
    return {
      success: false,
      data: null,
      error: err?.message || 'Erreur lors de la récupération du stockage'
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
  currency?: string;
  paymentMethod?: string;
  paymentReference?: string;
  receiptImageUrl?: string;
  receiptR2Key?: string;
  notes?: string;
  userId?: string;
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
