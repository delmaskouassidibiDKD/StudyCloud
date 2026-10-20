/**
 * ============================================================================
 * STUDYCLOUD - LES 12 FORMATS DE CRÉATION PÉDAGOGIQUE OFFICIELS
 * ============================================================================
 */

export type CreationType =
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

export interface CreationResult {
  mode: 'chat' | 'creation';
  decision: 'chat' | 'creation';
  creation_type: CreationType | null;
  creation_title: string | null;
  creation_data: any;
  chat_response: string;
}
