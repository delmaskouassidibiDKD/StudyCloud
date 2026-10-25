/**
 * Service de gestion d'exécution et persistance en arrière-plan des tâches IA (StudyCloud)
 * 
 * Règles Clés :
 * 1. Limite stricte : Maximum 3 requêtes en simultané vers le serveur IA.
 * 2. À partir de la 4ème demande, la tâche est automatiquement placée EN ATTENTE (queued).
 * 3. Dès qu'un slot se libère (tâche terminée ou échouée), la file d'attente s'exécute automatiquement.
 * 4. Permet à l'utilisateur de continuer à discuter et naviguer sans aucun blocage.
 */

export const MAX_CONCURRENT_REQUESTS = 3;

export interface BackgroundAiTask {
  taskId: string;
  conversationId: string;
  userId: string;
  userMsgId?: string;
  aiMsgId?: string;
  creationId?: string;
  title?: string;
  toolType?: string;
  prompt: string;
  requestedType?: string;
  mainDocName?: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  startedAt?: number;
  enqueuedAt: number;
  lastUpdated: number;
  progressText?: string;
  resultResponse?: string;
  resultCreation?: any;
  errorText?: string;
}

export type TaskExecutor = () => Promise<{ response?: string; creation?: any } | void>;

const STORAGE_KEY = 'studycloud_active_ai_tasks';
const memoryExecutors = new Map<string, TaskExecutor>();

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
  MAX_CONCURRENT_REQUESTS,

  /**
   * Récupère toutes les tâches valides (moins de 30 minutes)
   */
  getActiveTasks(): BackgroundAiTask[] {
    const tasks = safeGetStorage();
    const now = Date.now();
    const valid = tasks.filter(t => {
      const age = now - (t.enqueuedAt || t.startedAt || now);
      if (age > 15 * 60 * 1000) return false;
      // Si une tâche est marquée 'running' depuis plus de 3 minutes sans réponse, elle est expirée
      if (t.status === 'running' && (now - (t.startedAt || t.enqueuedAt || now)) > 3 * 60 * 1000) {
        return false;
      }
      return true;
    });
    if (valid.length !== tasks.length) safeSetStorage(valid);
    return valid;
  },

  /**
   * Récupère les tâches actuellement en cours d'exécution
   */
  getRunningTasks(): BackgroundAiTask[] {
    return this.getActiveTasks().filter(t => t.status === 'running');
  },

  /**
   * Nombre de tâches en cours d'exécution (serveur)
   */
  getRunningCount(): number {
    return this.getRunningTasks().length;
  },

  /**
   * Récupère les tâches en attente dans la file
   */
  getQueuedTasks(): BackgroundAiTask[] {
    return this.getActiveTasks()
      .filter(t => t.status === 'queued')
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  },

  /**
   * Nombre de tâches en attente
   */
  getQueuedCount(): number {
    return this.getQueuedTasks().length;
  },

  /**
   * Récupère la tâche active pour une conversation spécifique
   */
  getActiveTaskForConversation(conversationId: string): BackgroundAiTask | undefined {
    if (!conversationId) return undefined;
    const tasks = this.getActiveTasks();
    return tasks.find(t => t.conversationId === conversationId && (t.status === 'running' || t.status === 'queued'));
  },

  /**
   * Enregistre et planifie une nouvelle création en arrière-plan avec gestion de file
   */
  enqueueCreationTask(
    taskData: {
      taskId: string;
      conversationId: string;
      userId: string;
      userMsgId?: string;
      aiMsgId?: string;
      creationId: string;
      title: string;
      toolType: string;
      prompt: string;
      mainDocName?: string;
    },
    executor?: TaskExecutor
  ): { status: 'running' | 'queued'; isQueued: boolean } {
    const activeTasks = this.getActiveTasks().filter(t => t.taskId !== taskData.taskId && t.creationId !== taskData.creationId);
    const runningCount = activeTasks.filter(t => t.status === 'running').length;
    const willRunNow = runningCount < MAX_CONCURRENT_REQUESTS;
    const status: 'running' | 'queued' = willRunNow ? 'running' : 'queued';

    const now = Date.now();
    const newTask: BackgroundAiTask = {
      ...taskData,
      status,
      enqueuedAt: now,
      startedAt: willRunNow ? now : undefined,
      lastUpdated: now,
      progressText: willRunNow ? 'Création en cours...' : 'En attente...',
    };

    activeTasks.push(newTask);
    safeSetStorage(activeTasks);

    if (executor) {
      memoryExecutors.set(newTask.taskId, executor);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-ai-task-enqueued', {
        detail: { task: newTask, isQueued: !willRunNow }
      }));

      window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', {
        detail: {
          creationId: newTask.creationId,
          taskId: newTask.taskId,
          status: willRunNow ? 'generating' : 'queued',
          title: newTask.title,
          toolType: newTask.toolType,
          progressText: newTask.progressText,
        }
      }));
    }

    if (willRunNow) {
      setTimeout(() => this.executeTask(newTask.taskId), 10);
    }

    return { status, isQueued: !willRunNow };
  },

  /**
   * Lance l'exécution d'une tâche (immédiate ou sortie de file)
   */
  executeTask(taskId: string): void {
    const tasks = safeGetStorage();
    const target = tasks.find(t => t.taskId === taskId);
    if (!target) return;

    if (target.status !== 'running') {
      target.status = 'running';
      target.startedAt = Date.now();
      target.lastUpdated = Date.now();
      target.progressText = 'Création en cours...';
      safeSetStorage(tasks);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', {
        detail: {
          creationId: target.creationId,
          taskId: target.taskId,
          status: 'generating',
          title: target.title,
          toolType: target.toolType,
          progressText: 'Création en cours...',
        }
      }));

      window.dispatchEvent(new CustomEvent('studycloud-ai-task-started', {
        detail: {
          conversationId: target.conversationId,
          taskId: target.taskId,
          aiMsgId: target.aiMsgId,
          prompt: target.prompt,
          creationId: target.creationId,
          toolType: target.toolType,
          isCreation: true,
        }
      }));
    }

    const executor = memoryExecutors.get(taskId);
    if (executor) {
      executor()
        .then((res: any) => {
          this.completeAiTask(
            target.conversationId,
            target.aiMsgId,
            res?.response,
            res?.creation,
            target.taskId
          );
        })
        .catch((err: any) => {
          console.error('[aiBackgroundManager] Échec tâche IA:', err);
          this.failAiTask(target.taskId, err?.message || 'Erreur réseau');
        })
        .finally(() => {
          memoryExecutors.delete(taskId);
          this.processNextInQueue();
        });
    }
  },

  /**
   * Vérifie la file d'attente et lance la tâche suivante si un slot est libre
   */
  processNextInQueue(): void {
    const runningCount = this.getRunningCount();
    if (runningCount >= MAX_CONCURRENT_REQUESTS) return;

    const queuedTasks = this.getQueuedTasks();
    if (queuedTasks.length === 0) return;

    const nextTask = queuedTasks[0];
    this.executeTask(nextTask.taskId);
  },

  /**
   * Marque une tâche comme terminée et diffuse l'événement de complétion
   */
  completeAiTask(
    conversationIdOrTaskId: string,
    aiMsgId?: string,
    resultResponse?: string,
    resultCreation?: any,
    explicitTaskId?: string
  ): void {
    const tasks = safeGetStorage();
    let completedCreationId: string | undefined;

    const updated = tasks.map(t => {
      const match =
        (explicitTaskId && t.taskId === explicitTaskId) ||
        (t.taskId === conversationIdOrTaskId) ||
        (t.conversationId === conversationIdOrTaskId && (!aiMsgId || t.aiMsgId === aiMsgId));

      if (match) {
        completedCreationId = t.creationId;
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

    safeSetStorage(updated);

    if (typeof window !== 'undefined') {
      if (completedCreationId || resultCreation) {
        window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', {
          detail: {
            creationId: completedCreationId || resultCreation?.id,
            status: 'ready',
            creation: resultCreation,
          }
        }));
      }

      window.dispatchEvent(new CustomEvent('studycloud-ai-task-completed', {
        detail: {
          conversationId: conversationIdOrTaskId,
          aiMsgId,
          response: resultResponse,
          creation: resultCreation,
        }
      }));
    }

    // Libère la file et lance la tâche suivante
    this.processNextInQueue();

    // Nettoyage après 15 secondes
    setTimeout(() => {
      const current = safeGetStorage().filter(t => t.status !== 'completed');
      safeSetStorage(current);
    }, 15000);
  },

  /**
   * Signale l'échec d'une tâche
   */
  failAiTask(taskIdOrConvId: string, errorText?: string): void {
    const tasks = safeGetStorage();
    let targetCreationId: string | undefined;

    const updated = tasks.map(t => {
      if (t.taskId === taskIdOrConvId || t.conversationId === taskIdOrConvId) {
        targetCreationId = t.creationId;
        return {
          ...t,
          status: 'error' as const,
          errorText: errorText || 'Erreur lors de la génération',
          lastUpdated: Date.now(),
        };
      }
      return t;
    });

    safeSetStorage(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', {
        detail: {
          creationId: targetCreationId,
          status: 'error',
          errorText,
        }
      }));

      window.dispatchEvent(new CustomEvent('studycloud-ai-task-error', {
        detail: {
          taskId: taskIdOrConvId,
          errorText,
        }
      }));
    }

    this.processNextInQueue();
  },

  /**
   * Enregistre le lancement d'une tâche IA (compatibilité directe)
   */
  registerAiTask(task: Partial<BackgroundAiTask> & { taskId: string; conversationId: string; prompt: string }): void {
    // Ne jamais écraser les tâches de création d'arrière-plan de la même conversation
    const tasks = this.getActiveTasks().filter(t => t.taskId !== task.taskId && (!task.aiMsgId || t.aiMsgId !== task.aiMsgId));
    const now = Date.now();
    tasks.push({
      ...task,
      status: task.status || 'running',
      enqueuedAt: now,
      startedAt: task.startedAt || now,
      lastUpdated: now,
    });
    safeSetStorage(tasks);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-ai-task-started', {
        detail: {
          conversationId: task.conversationId,
          taskId: task.taskId,
          aiMsgId: task.aiMsgId,
          prompt: task.prompt,
          creationId: task.creationId,
          toolType: task.toolType || task.requestedType,
          isCreation: Boolean(task.creationId || task.toolType || task.requestedType),
        }
      }));
    }
  },

  /**
   * Supprime une tâche en cas d'annulation ou d'erreur
   */
  clearTask(conversationIdOrTaskId: string): void {
    memoryExecutors.delete(conversationIdOrTaskId);
    // Si c'est un taskId spécifique, supprimer uniquement cette tâche
    // Si c'est un conversationId, ne nettoyer que les tâches de chat simples sans toucher aux créations en arrière-plan
    const tasks = safeGetStorage().filter(t => {
      if (t.taskId === conversationIdOrTaskId) return false;
      if (t.conversationId === conversationIdOrTaskId && !t.creationId && !t.toolType) return false;
      return true;
    });
    safeSetStorage(tasks);
    this.processNextInQueue();
  },
};
