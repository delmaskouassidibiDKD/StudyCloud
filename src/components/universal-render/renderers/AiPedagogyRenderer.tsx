import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

const Questionnaire = lazy(() => import('../../ai-creations/Questionnaire'));
const QuestionnaireTest = lazy(() => import('../../ai-creations/QuestionnaireTest'));
const VraiOuFaux = lazy(() => import('../../ai-creations/VraiOuFaux'));
const VraiOuFauxTest = lazy(() => import('../../ai-creations/VraiOuFauxTest'));
const Resume = lazy(() => import('../../ai-creations/Resume'));
const CarteMentale = lazy(() => import('../../ai-creations/CarteMentale'));
const CarteMentaleConceptuelle = lazy(() => import('../../ai-creations/CarteMentaleConceptuelle'));
const CarteMemoire = lazy(() => import('../../ai-creations/CarteMemoire'));
const PdfCreation = lazy(() => import('../../ai-creations/Pdf'));
const Infographie = lazy(() => import('../../ai-creations/Infographie'));
const ExercicesEcrits = lazy(() => import('../../ai-creations/ExercicesEcrits'));
const DevoirComplet = lazy(() => import('../../ai-creations/DevoirComplet'));

interface AiPedagogyRendererProps {
  type: string;
  data: any;
  title?: string;
  sourceFileName?: string;
}

export function AiPedagogyRenderer({ type, data, title, sourceFileName }: AiPedagogyRendererProps) {
  const normType = type.toLowerCase().replace(/_/g, '-');

  const renderComponent = () => {
    switch (normType) {
      case 'questionnaire':
      case 'quiz':
      case 'qcm':
        return <Questionnaire data={data} />;
      case 'questionnaire-test':
        return <QuestionnaireTest data={data} />;
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
        return <CarteMentale data={data} />;
      case 'carte-mentale-2':
      case 'carte-mentale-conceptuelle':
        return <CarteMentaleConceptuelle data={data} />;
      case 'carte-memoire':
      case 'flashcards':
        return <CarteMemoire data={data} />;
      case 'pdf':
      case 'document':
        return <PdfCreation data={data} />;
      case 'infographie':
      case 'infographic':
        return <Infographie data={data} />;
      case 'exercices-ecrits':
      case 'exercices':
        return <ExercicesEcrits data={data} />;
      case 'devoir-complet':
      case 'devoir':
        return <DevoirComplet data={data} />;
      default:
        return <Resume data={data} title={title} sourceFileName={sourceFileName} />;
    }
  };

  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-orange-400 mb-2" />
          <span className="text-xs">Chargement du module interactif...</span>
        </div>
      }
    >
      <div className="w-full h-full overflow-y-auto custom-scrollbar">
        {renderComponent()}
      </div>
    </Suspense>
  );
}
export default AiPedagogyRenderer;
