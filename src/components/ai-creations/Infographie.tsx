import { useState } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCcw, Check, Sparkles, ArrowRight } from 'lucide-react';
import infographicImg from '../../assets/infographie.png';

interface InfographicStep {
  number: number;
  title: string;
  description: string;
  badge?: string;
  color: string;
}

const STEP_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'];

function normalizeInfographicData(data: any, defaultTitle?: string) {
  if (!data || typeof data !== 'object') return null;

  const title = data.title || defaultTitle || "Infographie Synthétique";
  const subtitle = data.subtitle || data.description || data.overview || "Les étapes clés et concepts fondamentaux à retenir";

  const rawSteps = data.steps || data.etapes || data.points || data.sections || data.keyPoints;
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return null;

  const steps: InfographicStep[] = rawSteps.map((s: any, idx: number) => {
    const num = idx + 1;
    const color = STEP_COLORS[idx % STEP_COLORS.length];
    if (typeof s === 'string') {
      return {
        number: num,
        title: `Étape ${num}`,
        description: s,
        color
      };
    }
    return {
      number: s.step || s.number || num,
      title: s.title || s.heading || `Étape ${num}`,
      description: s.description || s.desc || s.body || s.content || '',
      badge: s.badge || s.tag || undefined,
      color
    };
  });

  return { title, subtitle, steps };
}

export default function Infographie({ data, title }: { data?: any; title?: string }) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [downloaded, setDownloaded] = useState(false);

  const dynamicInfo = normalizeInfographicData(data, title);

  const handleDownload = () => {
    if (dynamicInfo) {
      let text = `================================================================================\nINFOGRAPHIE : ${dynamicInfo.title.toUpperCase()}\n${dynamicInfo.subtitle}\n================================================================================\n\n`;
      dynamicInfo.steps.forEach((s) => {
        text += `[ ÉTAPE ${s.number} : ${s.title.toUpperCase()} ]\n${s.description}\n\n`;
      });
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dynamicInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}_infographie.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const link = document.createElement('a');
      link.href = infographicImg;
      link.download = 'infographie_5_steps.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div id="module-infographie" className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 flex flex-col items-center">
      {/* Barre d'outils d'action et zoom */}
      <div
        id="infographie-toolbar"
        className="w-full max-w-2xl flex items-center justify-between gap-3 mb-6 p-2 rounded-xl bg-white border border-stone-200 shadow-xs"
      >
        <span className="text-xs font-semibold text-stone-600 pl-2 truncate">
          {dynamicInfo ? dynamicInfo.title : "Infographie : 5 étapes clés"}
        </span>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 text-xs">
            <button
              id="btn-infographie-zoom-out"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
              className="p-1.5 hover:bg-stone-200 rounded text-stone-700 transition-colors cursor-pointer"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono font-medium text-stone-700 min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              id="btn-infographie-zoom-in"
              onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
              className="p-1.5 hover:bg-stone-200 rounded text-stone-700 transition-colors cursor-pointer"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 100 && (
              <button
                id="btn-infographie-zoom-reset"
                onClick={() => setZoomLevel(100)}
                className="p-1.5 hover:bg-stone-200 rounded text-stone-500 hover:text-stone-800 transition-colors border-l border-stone-200 cursor-pointer"
                title="Réinitialiser le zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Bouton Télécharger */}
          <button
            id="btn-download-infographie"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Télécharger l'infographie"
          >
            {downloaded ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Téléchargé !</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Affichage de l'infographie */}
      <div className="w-full flex justify-center overflow-auto py-2">
        <div
          id="infographie-image-wrapper"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
          className="max-w-2xl w-full"
        >
          {dynamicInfo ? (
            <div className="w-full bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-stone-200 space-y-8">
              {/* En-tête de l'infographie */}
              <div className="text-center space-y-2 border-b border-stone-200 pb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  Infographie Pédagogique
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  {dynamicInfo.title}
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
                  {dynamicInfo.subtitle}
                </p>
              </div>

              {/* Étapes visuelles connectées */}
              <div className="space-y-4">
                {dynamicInfo.steps.map((step, idx) => {
                  const isLast = idx === dynamicInfo.steps.length - 1;
                  return (
                    <div key={step.number} className="relative">
                      <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100/80 transition-colors shadow-2xs">
                        {/* Numéro avec couleur dédiée */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm shrink-0"
                          style={{ backgroundColor: step.color }}
                        >
                          {step.number}
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-sm sm:text-base text-stone-900">
                              {step.title}
                            </h3>
                            {step.badge && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                style={{
                                  backgroundColor: `${step.color}15`,
                                  color: step.color,
                                  border: `1px solid ${step.color}30`
                                }}
                              >
                                {step.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      {!isLast && (
                        <div className="flex justify-center py-1">
                          <div className="w-0.5 h-4 bg-stone-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pied de page infographie */}
              <div className="pt-4 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
                <span>StudyCloud • Synthèse visuelle</span>
                <span className="font-bold text-stone-700">{dynamicInfo.steps.length} Étapes Validées</span>
              </div>
            </div>
          ) : (
            <img
              id="infographie-image"
              src={infographicImg}
              alt="Infographie en 5 étapes"
              className="w-full h-auto rounded-xl shadow-lg border border-stone-200 object-contain mx-auto select-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
