import React from 'react';
import { Loader2 } from 'lucide-react';
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

  const isGenerating = Boolean(
    data?.status === 'generating' ||
    data?.status === 'queued' ||
    data?.content?.status === 'generating' ||
    data?.content?.status === 'queued'
  );

  if (isGenerating) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 bg-[#131417]">
        <div className="flex flex-col items-center gap-4 max-w-sm px-8 py-7 rounded-3xl bg-zinc-900/90 backdrop-blur-md border border-orange-500/25 shadow-[0_0_30px_rgba(249,115,22,0.18)] text-center animate-pulse">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
            <span className="text-[11px] font-bold text-orange-300 uppercase tracking-wider">
              {data?.status === 'queued' || data?.content?.status === 'queued' ? 'EN ATTENTE' : 'CONCEPTION EN COURS'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-white tracking-wide">
            {data?.progressText || data?.content?.progressText || "L'agent IA conçoit actuellement votre support en arrière-plan..."}
          </p>
        </div>
      </div>
    );
  }

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
