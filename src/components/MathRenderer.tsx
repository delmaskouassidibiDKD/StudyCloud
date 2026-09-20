import React from 'react';
import { MathText, MathRenderer as MathRendererComponent } from './MathText';

export interface MathProps {
  content?: string;
  text?: string;
  className?: string;
  inline?: boolean;
}

/**
 * Composant MathRenderer universel pour StudyCloud.
 * Utilise KaTeX pour convertir automatiquement le LaTeX ($...$, $$...$$, symboles et fractions)
 * en typographie scientifique de haute précision.
 */
export const MathRenderer: React.FC<MathProps> = ({ content, text, className, inline }) => {
  return <MathRendererComponent text={content ?? text} className={className} inline={inline} />;
};

export { MathText };
export default MathRenderer;
