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
    localStorage.setItem('gemini_api_key', key.trim());
  }
};


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

  const payload = {
    ...params,
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

  // Extraction robuste pour éviter tout affichage de JSON brut dans le chat
  let extractedChatResponse = data.chat_response;
  let extractedMode = data.mode;
  let extractedCreationType = data.creation_type;
  let extractedCreationTitle = data.creation_title;
  let extractedCreationData = data.creation_data;

  if (!extractedChatResponse && typeof text === 'string') {
    // 1. Détection regex de chat_response avec protection des formules LaTeX
    const inlineMatch = text.match(/"chat_response"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (inlineMatch) {
      const candidate = inlineMatch[1].replace(/(\$\$?)([\s\S]*?)(\$\$?)/g, (_m, op, ma, cl) => op + ma.replace(/\\/g, '\\\\') + cl);
      try {
        extractedChatResponse = JSON.parse(`"${candidate}"`);
      } catch {
        extractedChatResponse = inlineMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    const modeMatch = text.match(/"mode"\s*:\s*"(chat|creation)"/i);
    if (modeMatch) {
      extractedMode = modeMatch[1].toLowerCase() as any;
    }
    const typeMatch = text.match(/"creation_type"\s*:\s*"([a-zA-Z0-9_-]+)"/i);
    if (typeMatch) {
      extractedCreationType = typeMatch[1];
    }
    const titleMatch = text.match(/"creation_title"\s*:\s*"([^"]+)"/i);
    if (titleMatch) {
      extractedCreationTitle = titleMatch[1];
    }
  }

  return {
    response: extractedChatResponse || data.chat_response || text,
    success: data.success !== false,
    model: data.model,
    type: data.type || extractedCreationType,
    mode: extractedMode || data.mode,
    chat_response: extractedChatResponse || data.chat_response,
    creation_type: extractedCreationType || data.creation_type,
    creation_title: extractedCreationTitle || data.creation_title,
    creation_data: extractedCreationData || data.creation_data,
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
    throw new Error(err.error || `Erreur API: ${response.status}`);
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

  async uploadFileToR2(file: File, r2Key: string): Promise<{ success: boolean; key: string; url: string }> {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/api/storage/upload?key=${encodeURIComponent(r2Key)}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!response.ok) throw new Error("Échec de l'envoi du fichier vers Cloudflare R2");
    return response.json();
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

  async getProducts(category?: string) {
    let endpoint = '/api/products';
    if (category) endpoint += `?category=${encodeURIComponent(category)}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
  },

  async createProduct(product: any) {
    return request('/api/products', { method: 'POST', body: JSON.stringify(product) });
  },

  async deleteProduct(id: string) {
    return request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    page?: number;
    limit?: number;
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
    if (filters?.page) params.push(`page=${filters.page}`);
    if (filters?.limit) params.push(`limit=${filters.limit}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;
    return request<{ success: boolean; data: any[]; pagination?: { page: number; limit: number; total: number; hasMore: boolean } }>(endpoint);
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
};
