export type UniversalContentType =
  | 'video'
  | 'audio'
  | '3d'
  | 'pdf'
  | 'chart'
  | 'code'
  | 'text'
  | 'markdown'
  | 'diagram'
  | 'mindmap'
  | 'quiz'
  | 'vrai-faux'
  | 'flashcards'
  | 'summary'
  | 'live_stream'
  | 'html';

export interface UniversalItem {
  id: string;
  type: UniversalContentType | string;
  title: string;
  data: {
    url?: string;
    content?: any;
    text?: string;
    code?: string;
    language?: string;
    chartType?: 'bar' | 'line' | 'pie' | 'area' | 'radar' | string;
    chartData?: any[];
    chartConfig?: Record<string, any>;
    waveformColor?: string;
    modelType?: string;
    diagramType?: string;
    nodes?: any[];
    links?: any[];
    questions?: any[];
    html?: string;
    config?: Record<string, any>;
    [key: string]: any;
  };
  metadata?: {
    author?: string;
    createdAt?: string;
    updatedAt?: string;
    sourceFileName?: string;
    tags?: string[];
    [key: string]: any;
  };
}
