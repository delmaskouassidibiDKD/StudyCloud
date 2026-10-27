/**
 * Service de gestion d'exécution et persistance en arrière-plan des tâches IA (StudyCloud)
 * 
 * Règles Clés :
 * 1. Limite stricte : Maximum 3 requêtes en simultané vers le serveur IA.
 * 2. À partir de la 4ème demande, la tâche est automatiquement placée EN ATTENTE (queued).
 * 3. Dès qu'un slot se libère (tâche terminée ou échouée), la file d'attente s'exécute automatiquement.
 * 4. Permet à l'utilisateur de continuer à discuter et naviguer sans aucun blocage.
 */

import { StudyCloudAPI } from './api';

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

export type TaskExecutor = () => Promise<{ response?: string; creation?: any; async?: boolean; status?: string } | void>;

const STORAGE_KEY = 'studycloud_active_ai_tasks';
const memoryExecutors = new Map<string, TaskExecutor>();
let cloudPollerTimer: any = null;

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

    // Enregistrement immédiat dans la base Cloudflare D1 avec son statut initial
    if (taskData.userId && taskData.userId !== 'default-user') {
      StudyCloudAPI.saveAiContent({
        id: taskData.creationId,
        userId: taskData.userId,
        fileId: null,
        conversationId: taskData.conversationId || null,
        toolType: taskData.toolType,
        title: taskData.title,
        contentJson: { status, title: taskData.title, sourceFileName: taskData.mainDocName },
        sourceFileName: taskData.mainDocName || undefined,
        isPinned: false,
      }).catch(e => console.warn('[aiBackgroundManager] Erreur init D1:', e));
    }

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
          if (res?.async || res?.status === 'generating') {
            // OPTION 2 : Le Cloudflare Worker a pris le relais en arrière-plan (ctx.waitUntil) !
            // La tâche reste en cours ('running') côté cloud et libère le slot local pour la suite.
            this.ensureCloudPollerStarted();
            return;
          }

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

    // Sauvegarde garantie dans la base de données Cloudflare D1 (indépendamment de la navigation de l'utilisateur)
    const finalCreationId = completedCreationId || resultCreation?.id;
    const finalUserId = resultCreation?.userId || (typeof window !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null);
    if (finalCreationId && finalUserId && finalUserId !== 'default-user' && resultCreation) {
      const parsedContent = resultCreation.content || resultCreation.data || resultCreation;
      StudyCloudAPI.saveAiContent({
        id: finalCreationId,
        userId: finalUserId,
        fileId: resultCreation.fileId || null,
        conversationId: resultCreation.conversationId || (conversationIdOrTaskId !== explicitTaskId ? conversationIdOrTaskId : null),
        toolType: resultCreation.toolType || resultCreation.type || 'creation',
        title: resultCreation.title || 'Création Studio',
        contentJson: parsedContent,
        sourceFileName: resultCreation.sourceFileName || undefined,
        isPinned: Boolean(resultCreation.isPinned),
      }).catch(e => console.warn('[aiBackgroundManager] Erreur sauvegarde D1 dans completeAiTask:', e));
    }

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
    if (!conversationIdOrTaskId) return;
    const tasks = safeGetStorage();
    const matched = tasks.find(t => t.taskId === conversationIdOrTaskId || t.creationId === conversationIdOrTaskId || t.conversationId === conversationIdOrTaskId);
    if (matched) {
      memoryExecutors.delete(matched.taskId);
    }
    memoryExecutors.delete(conversationIdOrTaskId);

    // Supprimer la tâche correspondante (par taskId ou creationId)
    // Si c'est un conversationId, ne nettoyer que les tâches de chat simples sans toucher aux créations en arrière-plan
    const remaining = tasks.filter(t => {
      if (t.taskId === conversationIdOrTaskId) return false;
      if (t.creationId === conversationIdOrTaskId) return false;
      if (t.conversationId === conversationIdOrTaskId && !t.creationId && !t.toolType) return false;
      return true;
    });
    safeSetStorage(remaining);
    this.processNextInQueue();
  },

  /**
   * Démarre la vérification périodique des créations en arrière-plan sur Cloudflare D1
   */
  ensureCloudPollerStarted(): void {
    if (typeof window === 'undefined') return;
    if (!cloudPollerTimer) {
      cloudPollerTimer = setInterval(() => {
        this.syncCloudTasksFromD1();
      }, 3500);
    }
    // Lancer une première vérification rapide
    setTimeout(() => this.syncCloudTasksFromD1(), 1000);
  },

  /**
   * Arrête le timer de vérification Cloudflare D1
   */
  stopCloudPoller(): void {
    if (cloudPollerTimer) {
      clearInterval(cloudPollerTimer);
      cloudPollerTimer = null;
    }
  },

  /**
   * Synchronise l'état des créations en cours avec la base Cloudflare D1
   * Essentiel lors du réveil du smartphone (déverrouillage de l'écran, retour sur l'onglet, reconnexion)
   */
  async syncCloudTasksFromD1(): Promise<void> {
    const runningTasks = this.getRunningTasks();
    if (runningTasks.length === 0) {
      this.stopCloudPoller();
      return;
    }

    const userId = runningTasks[0]?.userId || (typeof window !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null) || 'default-user';
    if (!userId || userId === 'default-user') return;

    try {
      const res = await StudyCloudAPI.getAiContents(userId);
      if (res && res.success && Array.isArray(res.data)) {
        const cloudContents = res.data;

        for (const task of runningTasks) {
          const match = cloudContents.find((c: any) => c.id === task.creationId || c.id === task.taskId);
          if (match) {
            const isReady = match.status === 'ready' || (
              match.content &&
              match.content.status !== 'generating' &&
              (match.content.questions || match.content.nodes || match.content.resume || match.content.flashcards || match.content.data || typeof match.content === 'object')
            );
            const isFailed = match.status === 'failed' || (match.content && match.content.status === 'failed');

            if (isReady) {
              const fullCreation = {
                id: match.id,
                type: match.toolType,
                toolType: match.toolType,
                title: match.title,
                content: match.content,
                createdAt: match.createdAt,
              };

              // Mettre à jour les caches locaux pour que l'interface s'affiche instantanément
              try {
                if (typeof window !== 'undefined') {
                  const savedRaw = localStorage.getItem('studycloud_saved_creations_cache');
                  const list = savedRaw ? JSON.parse(savedRaw) : [];
                  const existingIdx = list.findIndex((x: any) => x.id === match.id);
                  if (existingIdx >= 0) {
                    list[existingIdx] = { ...list[existingIdx], ...fullCreation, status: 'ready' };
                  } else {
                    list.unshift({ ...fullCreation, status: 'ready' });
                  }
                  localStorage.setItem('studycloud_saved_creations_cache', JSON.stringify(list));

                  if (task.conversationId) {
                    const convKey = `studycloud_conv_creations_${task.conversationId}`;
                    const convRaw = localStorage.getItem(convKey);
                    const convList = convRaw ? JSON.parse(convRaw) : [];
                    const cIdx = convList.findIndex((x: any) => x.id === match.id);
                    if (cIdx >= 0) {
                      convList[cIdx] = { ...convList[cIdx], ...fullCreation, status: 'ready' };
                    } else {
                      convList.unshift({ ...fullCreation, status: 'ready' });
                    }
                    localStorage.setItem(convKey, JSON.stringify(convList));
                  }
                }
              } catch (cacheErr) {
                console.warn('[aiBackgroundManager] Erreur mise à jour cache local:', cacheErr);
              }

              this.completeAiTask(task.conversationId, task.aiMsgId, undefined, fullCreation, task.taskId);
            } else if (isFailed) {
              this.failAiTask(task.taskId, match.content?.error || 'Échec de la génération sur le serveur');
            }
          }
        }
      }
    } catch (pollErr) {
      console.warn('[aiBackgroundManager] syncCloudTasksFromD1 avertissement:', pollErr);
    }

    if (this.getRunningTasks().length === 0) {
      this.stopCloudPoller();
    }
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// OPTION 2 : ÉCOUTEURS GLOBAUX DE SORTIE DE VEILLE DU SMARTPHONE
// Lorsque l'étudiant verrouille son téléphone puis le déverrouille 5 minutes plus tard,
// l'événement visibilitychange (ou window.focus / online) se déclenche aussitôt.
// On interroge immédiatement Cloudflare D1 pour récupérer toutes les créations terminées !
// ══════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      aiBackgroundManager.syncCloudTasksFromD1();
    }
  });

  window.addEventListener('focus', () => {
    aiBackgroundManager.syncCloudTasksFromD1();
  });

  window.addEventListener('online', () => {
    aiBackgroundManager.syncCloudTasksFromD1();
  });

  // Vérification de reprise au rechargement de la page si des tâches étaient en cours
  setTimeout(() => {
    if (aiBackgroundManager.getRunningCount() > 0) {
      aiBackgroundManager.ensureCloudPollerStarted();
      aiBackgroundManager.syncCloudTasksFromD1();
    }
  }, 1200);
}
