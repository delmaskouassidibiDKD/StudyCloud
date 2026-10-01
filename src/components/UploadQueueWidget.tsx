import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadQueue, UploadQueueState, UploadTask } from '../services/uploadQueue';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  RotateCw,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  Folder,
} from 'lucide-react';

export const UploadQueueWidget: React.FC = () => {
  const [state, setState] = useState<UploadQueueState>(UploadQueue.getState());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  // IDs des tâches dont la barre a terminé et qui doivent s'effacer
  const [fadingTaskIds, setFadingTaskIds] = useState<Set<string>>(new Set());
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(new Set());

  const taskTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Démarre le minuteur d'auto-effacement d'une tâche terminée
  const scheduleTaskHide = useCallback((taskId: string) => {
    if (taskTimers.current.has(taskId)) return;
    // Étape 1 : après 1 s, lancer le fondu (classe opacity-0 + scale-95)
    const t1 = setTimeout(() => {
      setFadingTaskIds(prev => new Set([...prev, taskId]));
      // Étape 2 : après 250 ms de transition CSS, supprimer du DOM
      const t2 = setTimeout(() => {
        setHiddenTaskIds(prev => new Set([...prev, taskId]));
        taskTimers.current.delete(taskId);
      }, 260);
      taskTimers.current.set(taskId + '_t2', t2);
    }, 1000);
    taskTimers.current.set(taskId, t1);
  }, []);

  useEffect(() => {
    const unsubscribe = UploadQueue.subscribe((newState: UploadQueueState) => {
      setState(newState);

      if (newState.isProcessing) {
        setIsDismissed(false);
        // Annuler auto-dismiss si on repart en traitement
        if (autoDismissTimer.current) {
          clearTimeout(autoDismissTimer.current);
          autoDismissTimer.current = null;
        }
      }

      // Planifier l'effacement de chaque tâche terminée
      (newState.tasks || []).forEach((task: UploadTask) => {
        if (task.status === 'completed') {
          scheduleTaskHide(task.id);
        }
      });
    });

    return () => {
      unsubscribe();
      taskTimers.current.forEach(t => clearTimeout(t));
      taskTimers.current.clear();
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, [scheduleTaskHide]);

  // Auto-fermeture du widget quand tout est terminé
  useEffect(() => {
    const { completedCount, errorCount, totalCount, isProcessing } = state;
    const allDone = !isProcessing && totalCount > 0 && completedCount + errorCount >= totalCount;

    if (allDone && errorCount === 0 && !autoDismissTimer.current) {
      // Attendre que les barres aient eu le temps de s'effacer (≈ 1,2 s) + 1,6 s de lisibilité
      autoDismissTimer.current = setTimeout(() => {
        setIsDismissed(true);
        UploadQueue.clearCompleted();
        autoDismissTimer.current = null;
      }, 2800);
    }
    // Si erreurs : ne pas auto-fermer, l'utilisateur doit agir
  }, [state]);

  if (state.totalCount === 0 || isDismissed) return null;

  const { completedCount, errorCount, totalCount, isProcessing, tasks } = state;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allCompleted = !isProcessing && completedCount > 0 && errorCount === 0;

  const visibleTasks = (tasks as UploadTask[])
    .slice()
    .reverse()
    .filter(t => !hiddenTaskIds.has(t.id));

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'audio': return <Music className="w-4 h-4 text-amber-400" />;
      case 'videos': return <Film className="w-4 h-4 text-purple-400" />;
      case 'images': return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'classeur': return <Folder className="w-4 h-4 text-orange-400" />;
      default: return <FileText className="w-4 h-4 text-blue-400" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'audio': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'videos': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'images': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'classeur': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'audio': return 'Audio';
      case 'videos': return 'Vidéos';
      case 'images': return 'Images';
      case 'classeur': return 'Classeur';
      default: return 'Documents';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <aside
      aria-label="Progression de l'enregistrement des fichiers"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100000] w-[95%] sm:w-[520px] max-w-xl rounded-2xl bg-[#090D16]/95 dark:bg-[#070A10]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-4 font-sans select-none"
    >
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border-b border-white/10 cursor-pointer"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative shrink-0">
            {isProcessing ? (
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : errorCount > 0 ? (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}
          </div>

          <div className="truncate">
            <div className="text-xs sm:text-sm font-black text-white truncate">
              {isProcessing ? (
                <span>Enregistrement en cours ({completedCount}/{totalCount})</span>
              ) : allCompleted ? (
                <span className="text-emerald-400">
                  {totalCount} fichier{totalCount > 1 ? 's' : ''} enregistré{totalCount > 1 ? 's' : ''} avec succès !
                </span>
              ) : errorCount > 0 ? (
                <span>{completedCount}/{totalCount} enregistré{totalCount > 1 ? 's' : ''} ({errorCount} échec{errorCount > 1 ? 's' : ''})</span>
              ) : (
                <span>{completedCount} fichier{completedCount > 1 ? 's' : ''} enregistré{completedCount > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {isProcessing
                ? 'Distribution dans leurs menus respectifs...'
                : allCompleted
                  ? 'Vos fichiers sont disponibles dans leurs menus'
                  : 'Téléversement terminé'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
            title={isExpanded ? 'Réduire les détails' : 'Afficher les détails'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
              if (!isProcessing) UploadQueue.clearCompleted();
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
            title="Fermer la notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Barre de progression globale ─────────────────────────────────── */}
      <div className="h-1.5 w-full bg-white/10 overflow-hidden relative">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            allCompleted
              ? 'bg-emerald-400'
              : errorCount > 0
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400'
          }`}
          style={{ width: `${Math.max(progressPercent, isProcessing ? 12 : 100)}%` }}
        />
      </div>

      {/* ── Liste des fichiers ───────────────────────────────────────────── */}
      {isExpanded && visibleTasks.length > 0 && (
        <div className="max-h-72 overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
          {visibleTasks.map((task: UploadTask) => {
            const isDone = task.status === 'completed';
            const isUploading = task.status === 'uploading';
            const isPending = task.status === 'pending';
            const isError = task.status === 'error';
            const isFading = fadingTaskIds.has(task.id);
            const catName = getCategoryName(task.category);

            return (
              <div
                key={task.id}
                className={`p-2.5 rounded-xl text-xs flex flex-col gap-1.5 bg-black/20 transition-all duration-250 ${
                  isFading ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Info fichier */}
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {getCategoryIcon(task.category)}
                    </div>
                    <div className="truncate flex-1">
                      <div className="font-bold text-white truncate max-w-[200px] sm:max-w-[280px]" title={task.fileName}>
                        {task.fileName}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{task.fileItem.size || 'Taille inconnue'}</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-semibold ${getCategoryBadgeClass(task.category)}`}>
                          Menu {catName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* État */}
                  <div className="flex items-center shrink-0">
                    {isUploading && (
                      <div className="flex items-center space-x-1 text-blue-400 font-bold text-[11px]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{task.progress}%</span>
                      </div>
                    )}
                    {isPending && (
                      <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-medium">
                        En attente...
                      </span>
                    )}
                    {isDone && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enregistré</span>
                      </span>
                    )}
                    {isError && (
                      <div className="flex items-center space-x-1.5 text-red-400">
                        <span className="text-[10px] font-bold" title={task.error}>Échec</span>
                        <button
                          type="button"
                          onClick={() => UploadQueue.retryTask(task.id)}
                          className="p-1 hover:bg-red-500/20 rounded-md text-red-400 border border-red-500/30"
                          title="Réessayer l'envoi"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barre de progression individuelle */}
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      isDone
                        ? 'bg-emerald-400'
                        : isError
                          ? 'bg-red-500'
                          : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                    }`}
                    style={{ width: `${isDone ? 100 : Math.max(task.progress, 10)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pied de widget : uniquement affiché en cas d'erreurs ─────────── */}
      {isExpanded && errorCount > 0 && (
        <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-amber-400 font-medium text-[11px]">
            ⚠️ {errorCount} fichier{errorCount > 1 ? 's' : ''} n'ont pas pu être synchronisés
          </span>
          <button
            type="button"
            onClick={() => UploadQueue.retryAllFailed()}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1"
          >
            <RotateCw className="w-3 h-3" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* Légende en cours (sans erreurs) */}
      {isExpanded && !errorCount && isProcessing && (
        <div className="px-4 py-2 bg-black/30 border-t border-white/10">
          <span className="text-slate-400 text-[11px]">
            Traitement en cours • 2 fichiers en simultané max
          </span>
        </div>
      )}
    </aside>
  );
};
