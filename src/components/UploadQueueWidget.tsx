import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Sparkles
} from 'lucide-react';

export const UploadQueueWidget: React.FC = () => {
  const [state, setState] = useState<UploadQueueState>(UploadQueue.getState());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const hoverTimeoutRef = useRef<any>(null);

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

  const { completedCount, errorCount, totalCount, isProcessing, tasks } = state;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allCompleted = !isProcessing && completedCount > 0 && errorCount === 0;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'audio':
        return <Music className="w-4 h-4 text-amber-400" />;
      case 'videos':
        return <Film className="w-4 h-4 text-purple-400" />;
      case 'images':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'classeur':
        return <Folder className="w-4 h-4 text-orange-400" />;
      default:
        return <FileText className="w-4 h-4 text-blue-400" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'audio':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'videos':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'images':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'classeur':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'audio':
        return 'Audio';
      case 'videos':
        return 'Vidéos';
      case 'images':
        return 'Images';
      case 'classeur':
        return 'Classeur';
      default:
        return 'Documents';
    }
  };

  return (
    <aside 
      aria-label="Progression de l'enregistrement des fichiers"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100000] w-[95%] sm:w-[520px] max-w-xl rounded-2xl bg-[#090D16]/95 dark:bg-[#070A10]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-4 font-sans select-none"
    >
      {/* En-tête de la notification supérieure */}
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
            <div className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
              {isProcessing ? (
                <span>Enregistrement en cours ({completedCount}/{totalCount})</span>
              ) : allCompleted ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
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
                ? 'Les fichiers sont distribués dans leurs menus respectifs...' 
                : allCompleted 
                  ? 'Tous vos fichiers sont prêts et consultables dans leurs menus respectifs' 
                  : 'Téléversement terminé'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
            title={isExpanded ? "Réduire les détails" : "Afficher les détails"}
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

      {/* Barre de progression globale en haut */}
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

      {/* Liste détaillée des fichiers avec les lignes de progression qui se remplissent */}
      {isExpanded && (
        <div className="max-h-72 overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
          {tasks.slice().reverse().map((task: UploadTask) => {
            const isDone = task.status === 'completed';
            const isUploading = task.status === 'uploading';
            const isPending = task.status === 'pending';
            const isError = task.status === 'error';
            const catName = getCategoryName(task.category);

            return (
              <div 
                key={task.id} 
                className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-xs flex flex-col gap-1.5 bg-black/20"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Info Fichier */}
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {getCategoryIcon(task.category)}
                    </div>
                    <div className="truncate flex-1">
                      <div className="font-bold text-white truncate max-w-[200px] sm:max-w-[260px]" title={task.fileName}>
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

                  {/* État / Pourcentage & Lien */}
                  <div className="flex items-center space-x-2 shrink-0">
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
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Enregistré</span>
                        </span>
                        {task.fileItem?.url && (
                          <a
                            href={task.fileItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-white font-bold text-[11px] border border-blue-500/30 transition-all active:scale-95 cursor-pointer shadow-xs"
                            title={`Ouvrir le fichier dans un nouvel onglet : ${task.fileName}`}
                          >
                            <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                            <span>Lien</span>
                          </a>
                        )}
                      </div>
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

                {/* Ligne de progression individuelle qui se remplit au fur et à mesure */}
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden relative">
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

      {/* Message récapitulatif avec liens ou erreurs en pied de widget */}
      {isExpanded && (
        <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs">
          {errorCount > 0 ? (
            <>
              <span className="text-amber-400 font-medium text-[11px]">
                ⚠️ {errorCount} fichier(s) n'ont pas pu être synchronisés
              </span>
              <button
                type="button"
                onClick={() => UploadQueue.retryAllFailed()}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1"
              >
                <RotateCw className="w-3 h-3" />
                <span>Tout réécouter</span>
              </button>
            </>
          ) : allCompleted ? (
            <div className="w-full flex items-center justify-between">
              <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Tous les liens sont actifs et enregistrés</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsDismissed(true);
                  UploadQueue.clearCompleted();
                }}
                className="px-2.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-medium text-[11px] transition-colors"
              >
                OK
              </button>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">
              Traitement fluide en cours • 2 fichiers en simultané max
            </span>
          )}
        </div>
      )}
    </aside>
  );
};
