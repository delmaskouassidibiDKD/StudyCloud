import React, { Suspense, lazy, Component } from 'react';
import { UniversalItem } from './types';
import { Loader2, X, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (!mod) {
        throw new Error('Module import returned undefined');
      }
      return mod.default ? mod : { default: mod };
    } catch (err: any) {
      console.warn('[UniversalContentRenderer] Dynamic import error:', err);
      const reloadKey = 'studycloud_chunk_fail_reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
      throw err;
    }
  });
}

const VideoRenderer = safeLazy(() => import('./renderers/VideoRenderer'));
const AudioRenderer = safeLazy(() => import('./renderers/AudioRenderer'));
const ThreeDRenderer = safeLazy(() => import('./renderers/ThreeDRenderer'));
const PdfRenderer = safeLazy(() => import('./renderers/PdfRenderer'));
const ChartRenderer = safeLazy(() => import('./renderers/ChartRenderer'));
const DiagramRenderer = safeLazy(() => import('./renderers/DiagramRenderer'));
const TextCodeRenderer = safeLazy(() => import('./renderers/TextCodeRenderer'));
const AiPedagogyRenderer = safeLazy(() => import('./renderers/AiPedagogyRenderer'));

class StudioErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[StudioErrorBoundary caught error]:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-300 space-y-4 bg-zinc-900/60">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-bold text-white">Affichage temporairement indisponible</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {this.state.error?.message || "Le module n'a pas pu s'afficher correctement."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réessayer l'affichage</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface UniversalContentRendererProps {
  item: UniversalItem | any;
  onClose?: () => void;
  isFullscreen?: boolean;
}

export function UniversalContentRenderer({ item, onClose }: UniversalContentRendererProps) {
  if (!item) return null;

  // Normalisation du type et des données
  const rawType = (item.type || item.toolType || '').toString().toLowerCase().trim();
  const title = item.title || item.name || 'Création';
  const data = item.data || item.content || item;

  // Détection automatique du type si non spécifié explicitement
  let detectedType = rawType;
  if (!detectedType || detectedType === 'generic') {
    const url = (data?.url || data?.audioUrl || data?.videoUrl || '').toLowerCase();
    if (url.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/) || url.includes('youtube.com') || url.includes('youtu.be')) {
      detectedType = 'video';
    } else if (url.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/)) {
      detectedType = 'audio';
    } else if (url.match(/\.pdf(\?.*)?$/)) {
      detectedType = 'pdf';
    } else if (data?.chartData || data?.chartType) {
      detectedType = 'chart';
    } else if (data?.nodes || data?.links) {
      detectedType = 'diagram';
    } else if (data?.code || data?.language) {
      detectedType = 'code';
    } else if (typeof data?.text === 'string' || typeof data?.content === 'string') {
      detectedType = 'text';
    }
  }

  const renderContent = () => {
    switch (detectedType) {
      case 'video':
      case 'stream':
      case 'live_stream':
        return <VideoRenderer data={data} title={title} />;

      case 'audio':
      case 'sound':
      case 'voice':
      case 'music':
        return <AudioRenderer data={data} title={title} />;

      case '3d':
      case 'model':
      case 'three':
        return <ThreeDRenderer data={data} title={title} />;

      case 'pdf':
      case 'document_pdf':
      case 'document':
      case 'polycopie': {
        const rawUrl = data?.url || data?.pdfUrl || '';
        const isExternalPdfUrl = typeof rawUrl === 'string' &&
          (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:application/pdf')) &&
          !data.pages && !data.chapters && !data.sections && !data.pdf_document;
        if (isExternalPdfUrl) {
          return <PdfRenderer data={data} title={title} />;
        }
        return (
          <AiPedagogyRenderer
            type="pdf"
            data={data.content || data}
            title={title}
            sourceFileName={item.sourceFileName}
          />
        );
      }

      case 'chart':
      case 'graph':
      case 'stats':
        return <ChartRenderer data={data} title={title} />;

      case 'diagram':
      case 'diagramme':
      case 'schema':
      case 'flowchart':
        return <DiagramRenderer data={data} title={title} />;

      case 'text':
      case 'code':
      case 'markdown':
      case 'latex':
      case 'note':
        return <TextCodeRenderer data={data} title={title} />;

      case 'quiz':
      case 'qcm':
      case 'questionnaire':
      case 'questionnaire-test':
      case 'vrai-faux':
      case 'vrai-ou-faux':
      case 'vrai-ou-faux-test':
      case 'mindmap':
      case 'carte-mentale':
      case 'carte-mentale-2':
      case 'carte-mentale-conceptuelle':
      case 'mindmap2':
      case 'flashcards':
      case 'carte-memoire':
      case 'resume':
      case 'summary':
      case 'infographie':
      case 'infographic':
      case 'exercices-ecrits':
      case 'exercices':
      case 'devoir-complet':
      case 'devoir':
        return (
          <AiPedagogyRenderer
            type={detectedType}
            data={data.content || data}
            title={title}
            sourceFileName={item.sourceFileName}
          />
        );

      default:
        // Si du HTML autonome est fourni
        if (item.htmlPreview || data.html) {
          return (
            <div className="w-full h-full p-4 overflow-auto">
              <div dangerouslySetInnerHTML={{ __html: item.htmlPreview || data.html }} />
            </div>
          );
        }

        // Rendu texte/code/données de repli
        return <TextCodeRenderer data={data} title={title} />;
    }
  };

  const isWhiteDoc = ['resume', 'summary'].includes(detectedType);

  return (
    <div className={`w-full h-full flex flex-col ${isWhiteDoc ? 'bg-white text-stone-900' : 'bg-transparent text-zinc-100'} overflow-hidden relative`}>
      {/* Barre d'en-tête de la création avec bouton de fermeture */}
      <div className={`w-full flex items-center justify-between px-4 py-2 ${isWhiteDoc ? 'bg-white border-b border-stone-200 text-stone-900' : 'bg-[#1a1c22]/90 border-b border-zinc-800/80 text-zinc-100'} backdrop-blur-md shrink-0 z-10`}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className={`w-3.5 h-3.5 ${isWhiteDoc ? 'text-indigo-600' : 'text-orange-400'} shrink-0`} />
          <span className={`text-xs font-bold ${isWhiteDoc ? 'text-stone-900' : 'text-zinc-200'} truncate`}>
            {title}
          </span>
          {detectedType && (
            <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded ${isWhiteDoc ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/80'} shrink-0`}>
              {detectedType}
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg ${isWhiteDoc ? 'text-stone-500 hover:text-stone-900 hover:bg-stone-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'} transition-colors cursor-pointer shrink-0`}
            title="Fermer la création"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Corps du renderer avec StudioErrorBoundary et Suspense */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        <StudioErrorBoundary>
          <Suspense
            fallback={
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-zinc-400">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400 mb-2" />
                <span className="text-xs">Chargement du contenu...</span>
              </div>
            }
          >
            {renderContent()}
          </Suspense>
        </StudioErrorBoundary>
      </div>
    </div>
  );
}
export default UniversalContentRenderer;
