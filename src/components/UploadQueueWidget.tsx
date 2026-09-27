import React, { useState, useEffect } from 'react';
import { UploadQueue, UploadQueueState, UploadTask } from '../services/uploadQueue';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  RotateCw,
  FileText
} from 'lucide-react';

export const UploadQueueWidget: React.FC = () => {
  const [state, setState] = useState<UploadQueueState>(UploadQueue.getState());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = UploadQueue.subscribe((newState) => {
      setState(newState);
      if (newState.isProcessing) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  // Ne rien afficher si la file est vide ou masquée par l'utilisateur
  if (state.totalCount === 0 || isDismissed) {
    return null;
  }

  const { activeCount, completedCount, errorCount, totalCount, isProcessing, tasks } = state;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <aside 
      aria-label="File d'attente d'importation de fichiers"
      className="fixed bottom-4 right-4 z-[9999] w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-[#1C1F26]/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 font-sans"
    >
      {/* En-tête du widget (Style Google Drive) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white cursor-pointer select-none"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-emerald-200" />
          ) : errorCount > 0 ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-300" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-300" />
          )}

          <div className="truncate text-sm font-semibold">
            {isProcessing ? (
              <span>Importation de {totalCount} fichier{totalCount > 1 ? 's' : ''}...</span>
            ) : errorCount > 0 ? (
              <span>{completedCount}/{totalCount} importé{totalCount > 1 ? 's' : ''} ({errorCount} échec{errorCount > 1 ? 's' : ''})</span>
            ) : (
              <span>{completedCount} fichier{completedCount > 1 ? 's' : ''} importé{completedCount > 1 ? 's' : ''} avec succès</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
            title={isExpanded ? "Réduire" : "Agrandir"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button 
            type="button"
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsDismissed(true); 
              if (!isProcessing) UploadQueue.clearCompleted();
            }}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
            title="Fermer la notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barre de progression globale en haut */}
      {isProcessing && (
        <div className="h-1 w-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(progressPercent, 10)}%` }}
          />
        </div>
      )}

      {/* Liste détaillée des fichiers (si déroulé) */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 p-1">
          {tasks.slice().reverse().map((task: UploadTask) => (
            <div 
              key={task.id} 
              className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-xs"
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-[220px]">
                    {task.fileName}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {task.fileItem.size} • {task.category} {task.folderName ? `• ${task.folderName}` : ''}
                  </div>
                </div>
              </div>

              {/* État de la tâche */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {task.status === 'uploading' && (
                  <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[10px]">Envoi...</span>
                  </div>
                )}

                {task.status === 'pending' && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                    En attente
                  </span>
                )}

                {task.status === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}

                {task.status === 'error' && (
                  <div className="flex items-center space-x-1 text-red-500">
                    <span className="text-[10px]" title={task.error}>Erreur</span>
                    <button
                      type="button"
                      onClick={() => UploadQueue.retryTask(task.id)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-600 dark:text-red-400"
                      title="Réessayer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pied du widget si erreurs */}
      {isExpanded && errorCount > 0 && (
        <div className="p-2.5 bg-red-50/60 dark:bg-red-950/20 border-t border-red-100 dark:border-red-900/30 flex items-center justify-between text-xs">
          <span className="text-red-600 dark:text-red-400 font-medium">
            {errorCount} fichier(s) non envoyé(s)
          </span>
          <button
            type="button"
            onClick={() => UploadQueue.retryAllFailed()}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-medium transition-colors flex items-center space-x-1"
          >
            <RotateCw className="w-3 h-3" />
            <span>Tout réécouter</span>
          </button>
        </div>
      )}
    </aside>
  );
};
