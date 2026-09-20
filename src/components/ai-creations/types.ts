export type ModuleId =
  | 'questionnaire'
  | 'questionnaire-test'
  | 'vrai-ou-faux'
  | 'vrai-ou-faux-test'
  | 'carte-mentale'
  | 'carte-mentale-2'
  | 'carte-memoire'
  | 'resume'
  | 'pdf'
  | 'infographie'
  | 'exercices-ecrits'
  | 'devoir-complet';

export type AiCreationType = ModuleId | 'summary' | 'quiz' | 'mindmap' | 'infographic' | 'document' | 'flashcards';

export interface ModuleNav {
  id: ModuleId;
  label: string;
  iconName: string;
  description: string;
}

export interface QuestionQCM {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AffirmationVraiFaux {
  id: string;
  statement: string;
  isTrue: boolean;
  explanation: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tag: string;
  definition?: string;
  examples?: string[];
}

export interface MindMapNode {
  id: string;
  title?: string;
  label?: string;
  notes?: string;
  details?: string;
  color?: string;
  isExpanded?: boolean;
  children?: MindMapNode[];
  [key: string]: any;
}

export interface WrittenExercise {
  id: string;
  title: string;
  difficulty: 'Facile' | 'Moyen' | 'Avancé';
  statement: string;
  sampleAnswer: string;
  tips: string[];
}

export interface QuestionItem {
  id: string;
  number: number;
  points: number;
  question: string;
  keywords: string[];
  sampleAnswer: string;
  hint: string;
}

export interface EvaluationResult {
  score: number;
  maxScore: number;
  status: 'excellent' | 'bon' | 'moyen' | 'insuffisant';
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
}

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
  content: any;
  sourceFileName?: string;
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}
