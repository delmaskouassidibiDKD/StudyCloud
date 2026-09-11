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

  async googleAuth(data: { code: string; redirectUri: string; action?: 'login' | 'register' | string }) {
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
  async getFiles(userId: string, matiereId?: string, isStudySession?: boolean) {
    let endpoint = `/api/files?userId=${encodeURIComponent(userId)}`;
    if (matiereId) endpoint += `&matiereId=${encodeURIComponent(matiereId)}`;
    if (isStudySession !== undefined) endpoint += `&isStudySession=${isStudySession ? '1' : '0'}`;
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

  async deleteFile(id: string) {
    return request(`/api/files/${id}`, { method: 'DELETE' });
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

  async toggleSharePublic(shareId: string, isPublic: boolean, allowDownload = true) {
    return request<{ success: boolean; message: string; isPublic: boolean; allowDownload: boolean }>(
      `/api/shares/${encodeURIComponent(shareId)}/public`,
      {
        method: 'PUT',
        body: JSON.stringify({ isPublic, allowDownload }),
      }
    );
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

  // --------------------------------------------------------------------------
  // Notes & Bulletins
  // --------------------------------------------------------------------------
  async getGrades(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/grades?userId=${encodeURIComponent(userId)}`);
  },

  async saveGrade(grade: any) {
    return request('/api/grades', { method: 'POST', body: JSON.stringify(grade) });
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

  // --------------------------------------------------------------------------
  // Alarmes & Minuteur d'étude
  // --------------------------------------------------------------------------
  async getAlarms(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/alarms?userId=${encodeURIComponent(userId)}`);
  },

  async createAlarm(alarm: any) {
    return request('/api/alarms', { method: 'POST', body: JSON.stringify(alarm) });
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

  async getCart(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/cart?userId=${encodeURIComponent(userId)}`);
  },

  async addToCart(userId: string, productId: string, quantity = 1) {
    return request('/api/cart', { method: 'POST', body: JSON.stringify({ userId, productId, quantity }) });
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
    if (params.length > 0) endpoint += `?${params.join('&')}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
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
  // Notifications
  // --------------------------------------------------------------------------
  async getNotifications(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/notifications?userId=${encodeURIComponent(userId)}`);
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
  // Contenus Générés par l'IA (Résumés, Cartes, Quiz, etc.)
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

  async deleteAiContent(id: string) {
    return request(`/api/ai-contents/${id}`, { method: 'DELETE' });
  },

  async togglePinAiContent(id: string, isPinned: boolean) {
    return request(`/api/ai-contents/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ isPinned }),
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

  async restoreCloud(userId: string) {
    return request<{ success: boolean; data: any }>(`/api/sync/restore?userId=${encodeURIComponent(userId)}`);
  },
};
