/**
 * StudyCloud - Client API Service (Connecteur Cloudflare Worker)
 * Permet à l'interface React d'appeler les routes de votre Worker Cloudflare.
 */

// URL du Worker Cloudflare déployé (configurable via variable d'environnement ou localStorage)
export const getWorkerApiUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_WORKER_API_URL ||
    localStorage.getItem('studycloud_worker_url') ||
    'https://studycloud-worker.votre-nom.workers.dev'
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

export const StudyCloudAPI = {
  // --------------------------------------------------------------------------
  // Santé & Connexion
  // --------------------------------------------------------------------------
  async checkHealth() {
    return request<{ success: boolean; status: string }>('/api/health');
  },

  // --------------------------------------------------------------------------
  // Utilisateurs & Profil
  // --------------------------------------------------------------------------
  async syncUser(user: { id: string; name: string; email: string; school?: string; filiere?: string; avatarUrl?: string }) {
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
  async getFiles(userId: string, matiereId?: string) {
    let endpoint = `/api/files?userId=${encodeURIComponent(userId)}`;
    if (matiereId) endpoint += `&matiereId=${encodeURIComponent(matiereId)}`;
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
    r2Key: string;
    fileUrl: string;
    isFavorite?: boolean;
    isImported?: boolean;
  }) {
    return request('/api/files', { method: 'POST', body: JSON.stringify(fileData) });
  },

  async deleteFile(id: string) {
    return request(`/api/files/${id}`, { method: 'DELETE' });
  },

  // --------------------------------------------------------------------------
  // Partages
  // --------------------------------------------------------------------------
  async getShares(userId: string) {
    return request<{ success: boolean; data: any[] }>(`/api/shares?userId=${encodeURIComponent(userId)}`);
  },

  async createShare(share: any) {
    return request('/api/shares', { method: 'POST', body: JSON.stringify(share) });
  },

  async getShareDetail(id: string) {
    return request<{ success: boolean; data: any }>(`/api/shares/${id}`);
  },

  async verifySharePin(id: string, pin: string) {
    return request<{ success: boolean; data: any }>(`/api/shares/${id}/verify-pin`, {
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
  // Publications Universitaires
  // --------------------------------------------------------------------------
  async getPublishedDocuments(school?: string, filiere?: string) {
    let endpoint = '/api/published-documents';
    const params: string[] = [];
    if (school) params.push(`school=${encodeURIComponent(school)}`);
    if (filiere) params.push(`filiere=${encodeURIComponent(filiere)}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;
    return request<{ success: boolean; data: any[] }>(endpoint);
  },

  async publishDocument(doc: any) {
    return request('/api/published-documents', { method: 'POST', body: JSON.stringify(doc) });
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
};
