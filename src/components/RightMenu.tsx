import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, ArrowLeftRight } from 'lucide-react';
import { UniversalContentRenderer } from './universal-render/UniversalContentRenderer';
import DotField from './DotField';

interface RightMenuProps {
  isRightFullscreen: boolean;
  setIsRightFullscreen: (v: boolean) => void;
  isCenterFullscreen: boolean;
  mobilePreviewTab: number;
  activePreviewItem?: any;
  isMobileScreen?: boolean;
  setIsResizingRight?: (v: boolean) => void;
}

export function RightMenu({
  isRightFullscreen,
  setIsRightFullscreen,
  isCenterFullscreen,
  mobilePreviewTab,
  activePreviewItem,
  isMobileScreen,
  setIsResizingRight
}: RightMenuProps) {
  const [activeCreation, setActiveCreation] = useState<any>(null);

  useEffect(() => {
    const handleCreationReady = (e: any) => {
      const creation = e.detail?.creation || e.detail;
      if (creation) {
        setActiveCreation(creation);
      }
    };

    const handleOpenCreation = (e: any) => {
      const creation = e.detail?.creation || e.detail?.item || e.detail;
      if (creation) {
        setActiveCreation(creation);
      }
    };

    const handleClearCreation = () => {
      setActiveCreation(null);
    };

    window.addEventListener('ai-creation-ready', handleCreationReady as any);
    window.addEventListener('studycloud-open-creation', handleOpenCreation as any);
    window.addEventListener('studycloud-clear-creation', handleClearCreation as any);

    return () => {
      window.removeEventListener('ai-creation-ready', handleCreationReady as any);
      window.removeEventListener('studycloud-open-creation', handleOpenCreation as any);
      window.removeEventListener('studycloud-clear-creation', handleClearCreation as any);
    };
  }, []);

  return (
    <div
      className={`w-full h-full pointer-events-auto relative bg-[#120F17] flex flex-col pt-[44px] overflow-hidden ${
        isCenterFullscreen
          ? 'hidden'
          : isMobileScreen
          ? mobilePreviewTab === 2 || isRightFullscreen
            ? 'flex'
            : 'hidden'
          : 'flex'
      }`}
    >
      {/* Poignée de redimensionnement entre CenterMenu et RightMenu */}
      {setIsResizingRight && (
        <div
          className="hidden md:flex absolute -left-[9px] top-0 bottom-0 w-[18px] cursor-col-resize z-50 justify-center items-center group select-none"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizingRight(true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setIsResizingRight(true);
          }}
          title="Glisser pour redimensionner l'espace de droite"
        >
          <div className="w-[3px] h-full bg-transparent group-hover:bg-orange-500 group-active:bg-orange-500 transition-colors" />
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-white dark:bg-stone-800 border border-stone-400 dark:border-stone-600 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none">
            <ArrowLeftRight className="w-2.5 h-2.5 text-stone-600 dark:text-stone-300" />
          </div>
        </div>
      )}

      {/* Barre d'outils supérieure : Bouton Zoom jaune (Plein écran / Réduire) */}
      <div className={`w-full flex items-center justify-between px-3 py-1.5 ${activeCreation ? 'bg-[#1a1c22]/90 border-zinc-700/60' : 'bg-[#120F17]/90 border-purple-900/30'} border-b shrink-0 z-20 shadow-xs backdrop-blur-sm`}>
        <div className="flex items-center gap-2">
          {/* Bouton Zoom jaune */}
          <button
            type="button"
            onClick={() => setIsRightFullscreen(!isRightFullscreen)}
            className="p-1.5 bg-yellow-400 rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 flex items-center justify-center shrink-0"
            title={isRightFullscreen ? 'Réduire' : 'Plein écran'}
          >
            {isRightFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Zone principale : Affiche DotField en fond permanent, et par-dessus la création polymorphe */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative bg-[#120F17]">
        {/* Fond animé WebGL2 avec les petits points colorés */}
        <div className="absolute inset-0 z-0 w-full h-full">
          <DotField
            gradientFrom="#5227FF"
            gradientTo="#FF9FFC"
            dotRadius={1.5}
            dotSpacing={14}
            cursorRadius={240}
            bulgeStrength={0.6}
            glowRadius={160}
            pattern="grid"
            glowColor="#ffffff"
            gradientAngle={135}
            twist={0}
            glowIntensity={0.8}
            baseOpacity={0.55}
            waveAmplitude={0}
            speed={1}
            sparkle={false}
            interactive
            holdToZoom
            intro
            lightMode={false}
          />
        </div>

        {/* Si une création est active : UniversalContentRenderer au premier plan avec transparence élégante */}
        {activeCreation && (
          <div className="absolute inset-0 z-10 overflow-hidden flex flex-col bg-[#14121b]/80 backdrop-blur-sm animate-fadeIn">
            <UniversalContentRenderer
              item={activeCreation}
              onClose={() => setActiveCreation(null)}
              isFullscreen={isRightFullscreen}
            />
          </div>
        )}
      </div>
    </div>
  );
}
