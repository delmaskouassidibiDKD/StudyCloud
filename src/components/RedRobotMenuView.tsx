import React from 'react';
import { ArrowLeft, Hexagon } from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { CloudflareOSApp } from './CloudflareOS/CloudflareOSApp';

interface RedRobotMenuViewProps {
  onBack: () => void;
}

export const RedRobotMenuView: React.FC<RedRobotMenuViewProps> = ({ onBack }) => {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#fcfcfb] dark:bg-[#090d16] text-[#1c1a18] dark:text-[#f1f5f9] flex flex-col min-h-[calc(100vh-66px)] transition-colors duration-300 overflow-hidden">
      {/* Barre supérieure avec bouton Retour et Badge Cloudflare OS fusionné */}
      <div className="w-full flex items-center justify-between px-3 sm:px-6 py-2.5 bg-[#f8f8f7] dark:bg-[#0d1322] border-b border-[#1411100f] dark:border-white/10 shrink-0 z-30">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 shadow-xs transition-all cursor-pointer active:scale-95"
          title="Retour à l'écran d'accueil StudyCloud"
        >
          <ArrowLeft className="w-4 h-4 text-[#ff4801]" />
          <span>Retour à l'accueil</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <DelmasRobot size={20} variant="red" floating={false} />
          <div className="w-3 h-3 rounded-md bg-[#ff4801] flex items-center justify-center text-white">
            <Hexagon className="w-2 h-2 fill-white stroke-[#ff4801]" />
          </div>
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
            Cloudflare OS <span className="text-[#ff4801] font-black">v2</span>
          </span>
        </div>
      </div>

      {/* Conteneur principal intégrant fidèlement Cloudflare OS */}
      <div className="flex-1 w-full overflow-hidden flex flex-col relative">
        <CloudflareOSApp />
      </div>
    </div>
  );
};
