/**
 * ============================================================================
 * STUDYCLOUD - MULTI-AGENT TEAM SYSTEM TYPES
 * ============================================================================
 */

export interface ExpertReport {
  expert: 'whisper-audio' | 'llama-vision' | 'gemini-video' | 'deepseek-math' | 'gemini-perception' | 'kimi-code';
  status: 'success' | 'skipped' | 'failed';
  summary: string;
  content: string;
}

export interface OrchestrationInput {
  targetModel: string;
  userPrompt: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  systemPrompt: string;
  docContent?: string;
  docName?: string;
  imageBase64?: string;
  audioBase64?: string;
  videoBase64?: string;
  videoUrl?: string;
  documentBase64?: string;
  documentImages?: any[];
  cfToken: string;
  accountId: string;
  geminiKey?: string;
  requestedType?: string;
  perceptionReport?: string;
}

export interface OrchestrationResult {
  isOrchestrated: boolean;
  expertsUsed: string[];
  finalAnswer: string;
  effectiveModelUsed: string;
}
