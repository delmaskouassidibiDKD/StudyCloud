import React from 'react';
import Questionnaire from '../../ai-creations/Questionnaire';
import QuestionnaireTest from '../../ai-creations/QuestionnaireTest';
import VraiOuFaux from '../../ai-creations/VraiOuFaux';
import VraiOuFauxTest from '../../ai-creations/VraiOuFauxTest';
import Resume from '../../ai-creations/Resume';
import CarteMentale from '../../ai-creations/CarteMentale';
import CarteMentaleConceptuelle from '../../ai-creations/CarteMentaleConceptuelle';
import CarteMemoire from '../../ai-creations/CarteMemoire';
import PdfCreation from '../../ai-creations/Pdf';
import Infographie from '../../ai-creations/Infographie';
import ExercicesEcrits from '../../ai-creations/ExercicesEcrits';
import DevoirComplet from '../../ai-creations/DevoirComplet';

interface AiPedagogyRendererProps {
  type: string;
  data: any;
  title?: string;
  sourceFileName?: string;
}

export function AiPedagogyRenderer({ type, data, title, sourceFileName }: AiPedagogyRendererProps) {
  const normType = (type || '').toLowerCase().replace(/_/g, '-');

  const renderComponent = () => {
    switch (normType) {
      case 'questionnaire':
      case 'quiz':
      case 'qcm':
        return <Questionnaire data={data} />;
      case 'questionnaire-test':
        return <QuestionnaireTest data={data} title={title} />;
      case 'vrai-ou-faux':
      case 'vrai-faux':
        return <VraiOuFaux data={data} />;
      case 'vrai-ou-faux-test':
        return <VraiOuFauxTest data={data} />;
      case 'resume':
      case 'summary':
        return <Resume data={data} title={title} sourceFileName={sourceFileName} />;
      case 'carte-mentale':
      case 'mindmap':
        return <CarteMentale data={data} title={title} />;
      case 'carte-mentale-2':
      case 'carte-mentale-conceptuelle':
      case 'mindmap2':
        return <CarteMentaleConceptuelle data={data} title={title} />;
      case 'carte-memoire':
      case 'flashcards':
        return <CarteMemoire data={data} />;
      case 'pdf':
      case 'document':
        return <PdfCreation data={data} title={title} />;
      case 'infographie':
      case 'infographic':
        return <Infographie data={data} title={title} />;
      case 'exercices-ecrits':
      case 'exercices':
        return <ExercicesEcrits data={data} title={title} />;
      case 'devoir-complet':
      case 'devoir':
        return <DevoirComplet data={data} title={title} />;
      default:
        return <Resume data={data} title={title} sourceFileName={sourceFileName} />;
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      {renderComponent()}
    </div>
  );
}
export default AiPedagogyRenderer;
