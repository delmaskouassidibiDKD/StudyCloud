import React from 'react';
import { PricingView } from './PricingView';

interface SettingsPricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
  initialTab?: 'storage' | 'ai' | 'renewal';
}

/**
 * SettingsPricingView redirige directement vers PricingView
 * garantissant ainsi une synchronisation absolue, les couleurs exactes de la marque
 * (sable beige, vert forêt, or), l'affichage mensuel par défaut et la barre d'onglets fixe.
 */
export const SettingsPricingView: React.FC<SettingsPricingViewProps> = (props) => {
  return <PricingView {...props} isEmbeddedInSettings={true} />;
};
