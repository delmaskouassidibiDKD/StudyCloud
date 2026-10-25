/**
 * Service de gestion d'exécution et persistance en arrière-plan des tâches IA (StudyCloud)
 * Permet à l'IA de poursuivre ses générations et calculs même si :
 * - L'utilisateur quitte le chat ou navigue ailleurs
 * - L'utilisateur change de session de discussion ou crée une nouvelle conversation
 * - L'écran se recharge (rechargement de page / refresh PWA)
 */

export interface BackgroundAiTask {
  taskId: string;
  conversationId: string;
  userId: string;
  userMsgId: string;
  aiMsgId: string;
  creationId?: string;
  prompt: string;
  requestedType?: string;
  mainDocName?: string;
  status: 'running' | 'completed' | 'error';
  startedAt: number;
  lastUpdated: number;
  resultResponse?: string;
  resultCreation?: any;
}

const STORAGE_KEY = 'studycloud_active_ai_tasks';

function safeGetStorage(): BackgroundAiTask[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSetStorage(tasks: BackgroundAiTask[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('[aiBackgroundManager] Erreur écriture storage:', e);
  }
}

export const aiBackgroundManager = {
  /**
   * Récupère toutes les tâches enregistrées
   */
  getActiveTasks(): BackgroundAiTask[] {
    const tasks = safeGetStorage();
    const now = Date.now();
    // Purge des tâches fantômes de plus de 15 minutes
    const valid = tasks.filter(t => now - t.startedAt < 15 * 60 * 1000);
    if (valid.length !== tasks.length) safeSetStorage(valid);
    return valid;
  },

  /**
   * Récupère la tâche active pour une conversation spécifique
   */
  getActiveTaskForConversation(conversationId: string): BackgroundAiTask | undefined {
    if (!conversationId) return undefined;
    const tasks = this.getActiveTasks();
    return tasks.find(t => t.conversationId === conversationId && t.status === 'running');
  },

  /**
   * Enregistre le lancement d'une tâche IA en arrière-plan
   */
  registerAiTask(task: BackgroundAiTask): void {
    const tasks = this.getActiveTasks().filter(t => t.conversationId !== task.conversationId);
    tasks.push({
      ...task,
      status: 'running',
      startedAt: task.startedAt || Date.now(),
      lastUpdated: Date.now(),
    });
    safeSetStorage(tasks);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-ai-task-started', {
        detail: {
          conversationId: task.conversationId,
          taskId: task.taskId,
          aiMsgId: task.aiMsgId,
          prompt: task.prompt,
        }
      }));
    }
  },

  /**
   * Marque une tâche comme terminée et diffuse l'événement de complétion
   */
  completeAiTask(conversationId: string, aiMsgId?: string, resultResponse?: string, resultCreation?: any): void {
    const tasks = safeGetStorage();
    const updated = tasks.map(t => {
      if (t.conversationId === conversationId && (!aiMsgId || t.aiMsgId === aiMsgId)) {
        return {
          ...t,
          status: 'completed' as const,
          lastUpdated: Date.now(),
          resultResponse: resultResponse || t.resultResponse,
          resultCreation: resultCreation || t.resultCreation,
        };
      }
      return t;
    });
    // Conserver un court instant pour vérification post-rechargement puis purger
    safeSetStorage(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-ai-task-completed', {
        detail: {
          conversationId,
          aiMsgId,
          response: resultResponse,
          creation: resultCreation,
        }
      }));
    }

    // Nettoyage après 15 secondes
    setTimeout(() => {
      const current = safeGetStorage().filter(t => !(t.conversationId === conversationId && t.status === 'completed'));
      safeSetStorage(current);
    }, 15000);
  },

  /**
   * Supprime une tâche en cas d'annulation ou d'erreur
   */
  clearTask(conversationId: string): void {
    const tasks = safeGetStorage().filter(t => t.conversationId !== conversationId);
    safeSetStorage(tasks);
  },
};
