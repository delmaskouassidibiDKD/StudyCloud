import { useState } from 'react';
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Sparkles,
  TrendingUp,
  Lightbulb,
  AlertTriangle,
  Info,
  Layers,
  ArrowDown
} from 'lucide-react';
import { MathText } from '../MathText';

interface InfographicStep {
  number: number;
  title: string;
  description: string;
  badge?: string;
  color: string;
}

interface InfographicMetric {
  value: string;
  label: string;
  color?: string;
}

interface InfographicHighlight {
  type: 'tip' | 'warning' | 'info';
  title?: string;
  text: string;
}

interface NormalizedInfographic {
  title: string;
  subtitle: string;
  metrics: InfographicMetric[];
  steps: InfographicStep[];
  highlights: InfographicHighlight[];
  conclusion?: string;
}

const STEP_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B', '#14B8A6'];

function normalizeInfographicData(data: any, defaultTitle?: string): NormalizedInfographic | null {
  if (!data || typeof data !== 'object') return null;

  // Support direct object or wrapped in infographic/content
  const raw = (data.infographic && typeof data.infographic === 'object')
    ? data.infographic
    : ((data.content && typeof data.content === 'object') ? data.content : data);

  const title = raw.title || raw.mainTitle || defaultTitle;
  const subtitle = raw.subtitle || raw.description || raw.overview || raw.desc || "Repères visuels, concepts clés et démarche d'assimilation";

  // Extraction des métriques
  const rawMetrics = Array.isArray(raw.metrics) ? raw.metrics : (Array.isArray(data.metrics) ? data.metrics : []);
  const metrics: InfographicMetric[] = rawMetrics.map((m: any, idx: number) => ({
    value: String(m.value || m.val || m.chiffre || ''),
    label: String(m.label || m.titre || m.title || m.nom || ''),
    color: m.color || STEP_COLORS[idx % STEP_COLORS.length]
  })).filter((m: InfographicMetric) => m.value || m.label);

  // Extraction des étapes / branches
  const rawSteps = raw.steps || raw.etapes || raw.branches || raw.keyConcepts || raw.points || raw.sections || raw.keyPoints;
  const steps: InfographicStep[] = [];

  if (Array.isArray(rawSteps) && rawSteps.length > 0) {
    rawSteps.forEach((s: any, idx: number) => {
      const num = idx + 1;
      const color = s.color || STEP_COLORS[idx % STEP_COLORS.length];
      if (typeof s === 'string') {
        steps.push({
          number: num,
          title: `Étape ${num}`,
          description: s,
          color
        });
      } else if (s && typeof s === 'object') {
        steps.push({
          number: s.number || s.step || s.etape || num,
          title: s.title || s.heading || s.titre || s.branch_title || s.pillTitle || `Étape ${num}`,
          description: s.description || s.desc || s.body || s.content || (Array.isArray(s.nodes) ? s.nodes.join('\n\n') : '') || '',
          badge: s.badge || s.tag || undefined,
          color
        });
      }
    });
  }

  // Extraction des highlights (conseils / alertes)
  const rawHighlights = Array.isArray(raw.highlights) ? raw.highlights : [];
  const highlights: InfographicHighlight[] = rawHighlights.map((h: any) => ({
    type: (h.type === 'tip' || h.type === 'warning') ? h.type : 'info',
    title: h.title || h.heading || undefined,
    text: h.text || h.message || h.content || ''
  })).filter((h: InfographicHighlight) => h.text);

  const conclusion = raw.conclusion || raw.key_takeaway || raw.takeaway || raw.bilan || raw.summaryBox || undefined;

  // Si tout est vide, pas d'infographie affichable
  if (!title && steps.length === 0 && metrics.length === 0) {
    return null;
  }

  return {
    title: title || "Infographie Pédagogique",
    subtitle,
    metrics,
    steps,
    highlights,
    conclusion
  };
}

export default function Infographie({ data, title }: { data?: any; title?: string }) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [downloaded, setDownloaded] = useState(false);

  const dynamicInfo = normalizeInfographicData(data, title);

  const handleDownload = () => {
    if (dynamicInfo) {
      let text = `================================================================================\nINFOGRAPHIE : ${dynamicInfo.title.toUpperCase()}\n${dynamicInfo.subtitle}\n================================================================================\n\n`;

      if (dynamicInfo.metrics.length > 0) {
        text += `[ CHIFFRES ET REPÈRES CLÉS ]\n`;
        dynamicInfo.metrics.forEach(m => {
          text += `• ${m.value} : ${m.label}\n`;
        });
        text += `\n--------------------------------------------------------------------------------\n\n`;
      }

      if (dynamicInfo.steps.length > 0) {
        text += `[ ÉTAPES ET BRANCHES DE L'INFOGRAPHIE ]\n`;
        dynamicInfo.steps.forEach(s => {
          text += `[ ÉTAPE ${s.number} : ${s.title.toUpperCase()}${s.badge ? ` (${s.badge})` : ''} ]\n`;
          text += `${s.description}\n\n`;
        });
        text += `--------------------------------------------------------------------------------\n\n`;
      }

      if (dynamicInfo.highlights.length > 0) {
        text += `[ POINTS D'ATTENTION ET CONSEILS CLÉS ]\n`;
        dynamicInfo.highlights.forEach(h => {
          text += `• ${h.title ? `[${h.title}] ` : ''}${h.text}\n`;
        });
        text += `\n--------------------------------------------------------------------------------\n\n`;
      }

      if (dynamicInfo.conclusion) {
        text += `[ CONCLUSION ET SYNTHÈSE ]\n${dynamicInfo.conclusion}\n\n`;
      }

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dynamicInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}_infographie.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div id="module-infographie" className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 flex flex-col items-center">
      {/* Barre d'outils d'action et zoom */}
      <div
        id="infographie-toolbar"
        className="w-full max-w-3xl flex items-center justify-between gap-3 mb-6 p-2 rounded-xl bg-white border border-stone-200 shadow-xs"
      >
        <span className="text-xs font-semibold text-stone-600 pl-2 truncate">
          {dynamicInfo ? dynamicInfo.title : "Infographie Pédagogique"}
        </span>

        <div className="flex items-center gap-2">
          {/* Contrôles de zoom */}
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
          {dynamicInfo && (
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
          )}
        </div>
      </div>

      {/* Affichage adaptatif de l'infographie */}
      <div className="w-full flex justify-center overflow-auto py-2">
        <div
          id="infographie-image-wrapper"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
          className="max-w-3xl w-full"
        >
          {dynamicInfo ? (
            <div className="w-full bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-stone-200 space-y-8">
              {/* En-tête de l'infographie avec support LaTeX */}
              <div className="text-center space-y-3 border-b border-stone-200 pb-6">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 text-xs font-bold uppercase tracking-wider border border-orange-200/60 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  Infographie Synthétique & Descriptive
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight leading-tight">
                  <MathText text={dynamicInfo.title} />
                </h1>
                {dynamicInfo.subtitle && (
                  <p className="text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
                    <MathText text={dynamicInfo.subtitle} />
                  </p>
                )}
              </div>

              {/* Barre de métriques / Repères visuels (si présents) */}
              {dynamicInfo.metrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {dynamicInfo.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-2xs hover:bg-stone-100/70 transition-colors"
                      style={{ borderTop: `4px solid ${m.color || STEP_COLORS[idx % STEP_COLORS.length]}` }}
                    >
                      <div
                        className="text-xl sm:text-2xl font-black mb-1"
                        style={{ color: m.color || STEP_COLORS[idx % STEP_COLORS.length] }}
                      >
                        <MathText text={m.value} />
                      </div>
                      <span className="text-xs font-bold text-stone-600 leading-tight">
                        <MathText text={m.label} />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Étapes visuelles connectées et auto-extensibles */}
              {dynamicInfo.steps.length > 0 && (
                <div className="space-y-4">
                  {dynamicInfo.steps.map((step, idx) => {
                    const isLast = idx === dynamicInfo.steps.length - 1;
                    return (
                      <div key={step.number} className="relative">
                        {/* Conteneur auto-extensible : min-h-auto, étirement naturel pour toutes les idées */}
                        <div
                          className="w-full flex items-start gap-4 p-5 rounded-2xl border border-stone-200 bg-stone-50/80 hover:bg-stone-100/90 transition-all shadow-xs"
                          style={{ borderLeft: `5px solid ${step.color}` }}
                        >
                          {/* Numéro avec couleur dédiée */}
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0"
                            style={{ backgroundColor: step.color }}
                          >
                            {step.number}
                          </div>

                          {/* Contenu textuel sans limite de hauteur, s'étire selon la longueur des idées */}
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="font-bold text-base sm:text-lg text-stone-900 leading-snug">
                                <MathText text={step.title} />
                              </h3>
                              {step.badge && (
                                <span
                                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `${step.color}15`,
                                    color: step.color,
                                    border: `1px solid ${step.color}35`
                                  }}
                                >
                                  {step.badge}
                                </span>
                              )}
                            </div>
                            {/* Description étirable et support complet du KaTeX pour les maths/sciences */}
                            <div className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line break-words font-normal">
                              <MathText text={step.description} />
                            </div>
                          </div>
                        </div>

                        {/* Ligne connectrice visuelle vers l'étape suivante */}
                        {!isLast && (
                          <div className="flex justify-center py-1.5">
                            <div className="w-0.5 h-5 bg-stone-300 flex items-center justify-center">
                              <ArrowDown className="w-3 h-3 text-stone-400 mt-5" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Points d'attention / Conseils clés (si présents) */}
              {dynamicInfo.highlights.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-black text-stone-700 uppercase tracking-wider pl-1">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                    <span>Points d'Attention & Règles d'Or</span>
                  </div>
                  <div className="space-y-2.5">
                    {dynamicInfo.highlights.map((h, idx) => {
                      const isTip = h.type === 'tip';
                      const isWarn = h.type === 'warning';
                      const borderClass = isTip
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                        : isWarn
                        ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                        : 'border-blue-200 bg-blue-50/70 text-blue-900';

                      const IconComp = isTip ? Lightbulb : isWarn ? AlertTriangle : Info;

                      return (
                        <div key={idx} className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xs ${borderClass}`}>
                          <IconComp className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="text-xs sm:text-sm leading-relaxed min-w-0 flex-1">
                            {h.title && (
                              <strong className="block font-bold mb-1">
                                <MathText text={h.title} />
                              </strong>
                            )}
                            <MathText text={h.text} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conclusion / Takeaway synthétique */}
              {dynamicInfo.conclusion && (
                <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200/80 rounded-2xl p-5 flex items-start gap-3.5 shadow-2xs">
                  <Sparkles className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-stone-800 font-medium leading-relaxed min-w-0 flex-1">
                    <strong className="block text-orange-950 font-bold mb-0.5">Synthèse Clé</strong>
                    <MathText text={dynamicInfo.conclusion} />
                  </div>
                </div>
              )}

              {/* Pied de page infographie */}
              <div className="pt-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 font-medium">
                <span>StudyCloud • Synthèse Visuelle Descriptive</span>
                <span className="font-bold text-stone-700">
                  {dynamicInfo.steps.length > 0 ? `${dynamicInfo.steps.length} Étapes Validées` : 'Généré par IA'}
                </span>
              </div>
            </div>
          ) : (
            /* Gabarit visuel neutre et adaptatif : aucun exercice ou faux sujet hardcodé */
            <div className="w-full bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-stone-200 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-xs">
                <Layers className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  Infographie Pédagogique Prête à Générer
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  Demandez à l'IA de concevoir une infographie descriptive adaptée à votre document.
                  Les branches, étapes, chiffres clés et explications s'étireront et s'adapteront sur mesure à votre sujet.
                </p>
              </div>

              {/* Aperçu conceptuel de la structure étirable (emplacements neutres) */}
              <div className="max-w-md mx-auto space-y-3 pt-2">
                {[
                  { num: 1, label: "Étape 1 : Notions & principes fondamentaux", color: '#F97316' },
                  { num: 2, label: "Étape 2 : Méthodologie, lois & équations", color: '#3B82F6' },
                  { num: 3, label: "Étape 3 : Applications concrètes & synthèse", color: '#10B981' }
                ].map((item) => (
                  <div
                    key={item.num}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-stone-300 bg-stone-50 text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-3 bg-stone-200 rounded-full w-3/4 mb-1.5 animate-pulse" />
                      <span className="text-[11px] text-stone-400 font-medium truncate block">
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-xs text-stone-500">
                ✨ Cliquez sur « Infographie » dans le chat pour lancer la génération personnalisée
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
