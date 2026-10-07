import React, { Suspense, lazy } from 'react';
import { UniversalItem } from './types';
import { Loader2, X, Sparkles } from 'lucide-react';

const VideoRenderer = lazy(() => import('./renderers/VideoRenderer'));
const AudioRenderer = lazy(() => import('./renderers/AudioRenderer'));
const ThreeDRenderer = lazy(() => import('./renderers/ThreeDRenderer'));
const PdfRenderer = lazy(() => import('./renderers/PdfRenderer'));
const ChartRenderer = lazy(() => import('./renderers/ChartRenderer'));
const DiagramRenderer = lazy(() => import('./renderers/DiagramRenderer'));
const TextCodeRenderer = lazy(() => import('./renderers/TextCodeRenderer'));
const AiPedagogyRenderer = lazy(() => import('./renderers/AiPedagogyRenderer'));

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
        return <PdfRenderer data={data} title={title} />;

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

  return (
    <div className="w-full h-full flex flex-col bg-[#16181f] text-zinc-100 overflow-hidden relative">
      {/* Barre d'en-tête de la création avec bouton de fermeture */}
      <div className="w-full flex items-center justify-between px-4 py-2 bg-[#1a1c22] border-b border-zinc-800 shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-xs font-bold text-zinc-200 truncate">
            {title}
          </span>
          {detectedType && (
            <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/80 shrink-0">
              {detectedType}
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="Fermer la création"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Corps du renderer avec Suspense pour lazy loading */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
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
      </div>
    </div>
  );
}
export default UniversalContentRenderer;
