export type AiCreationType = 'summary' | 'quiz' | 'mindmap' | 'infographic' | 'document' | 'flashcards';

export interface SummaryContent {
  overview: string;
  keyPoints: string[];
  definitions?: { term: string; definition: string }[];
  rules?: string[];
  tags?: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface QuizContent {
  title: string;
  description?: string;
  difficulty?: 'Facile' | 'Moyen' | 'Avancé';
  questions: QuizQuestion[];
}

export interface MindMapNode {
  id: string;
  label: string;
  details?: string;
  color?: string;
  isExpanded?: boolean;
  children?: MindMapNode[];
}

export interface MindMapContent {
  root: MindMapNode;
}

export interface InfographicMetric {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface InfographicConcept {
  title: string;
  desc: string;
  icon?: string;
  badge?: string;
}

export interface InfographicHighlight {
  type: 'tip' | 'warning' | 'info';
  title?: string;
  text: string;
}

export interface InfographicContent {
  mainTitle: string;
  subtitle?: string;
  metrics: InfographicMetric[];
  keyConcepts: InfographicConcept[];
  highlights: InfographicHighlight[];
  conclusion?: string;
}

export interface DocumentSection {
  heading: string;
  body: string;
  bulletPoints?: string[];
  highlightBox?: string;
}

export interface DocumentContent {
  title: string;
  subtitle?: string;
  subject?: string;
  academicLevel?: string;
  dateStr?: string;
  sections: DocumentSection[];
  summaryBox?: string;
}

export interface AiCreation {
  id: string;
  userId?: string;
  fileId?: string;
  toolType: AiCreationType;
  title: string;
  content: SummaryContent | QuizContent | MindMapContent | InfographicContent | DocumentContent | any;
  sourceFileName?: string;
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}
