import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, FileText, Clock, BookOpen, BrainCircuit, Calendar, Layers, Lightbulb, CheckCircle2 } from 'lucide-react';
import { MathText } from '../MathText';

export default function Resume({ data, title, sourceFileName }: { data?: any; title?: string; sourceFileName?: string }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const hasDynamicData = Boolean(
    data && (
      data.overview ||
      data.summary ||
      (Array.isArray(data.sections) && data.sections.length > 0) ||
      (Array.isArray(data.keyPoints) && data.keyPoints.length > 0) ||
      typeof data.text === 'string' ||
      typeof data.content === 'string'
    )
  );

  const docTitle = data?.title || title || (sourceFileName ? `Fiche de synthèse : ${sourceFileName}` : 'Fiche de synthèse');
  const docSubtitle = data?.overview || data?.summary || data?.description || (hasDynamicData ? 'Synthèse structurée et didactique des points clés de ce cours.' : '');

  const dynamicSections = useMemo(() => {
    if (!data?.sections || !Array.isArray(data.sections)) return [];
    return data.sections.map((sec: any, idx: number) => ({
      number: sec.number || idx + 1,
      heading: sec.heading || sec.title || sec.titre || `Axe clé n°${idx + 1}`,
      body: sec.body || sec.content || sec.texte || '',
      points: Array.isArray(sec.points) ? sec.points : (Array.isArray(sec.keyPoints) ? sec.keyPoints : (Array.isArray(sec.bulletPoints) ? sec.bulletPoints : [])),
      protocolTitle: sec.protocolTitle || sec.highlightTitle || 'Points fondamentaux à retenir :'
    }));
  }, [data]);

  const dynamicKeyPoints: string[] = useMemo(() => {
    if (Array.isArray(data?.keyPoints)) return data.keyPoints;
    if (Array.isArray(data?.pointsCles)) return data.pointsCles;
    return [];
  }, [data]);

  const fullText = useMemo(() => {
    if (!hasDynamicData) return "";
    let out = `DOCUMENT DE SYNTHÈSE\n${docTitle.toUpperCase()}\n`;
    if (docSubtitle) out += `\n${docSubtitle}\n`;
    if (dynamicKeyPoints.length > 0) {
      out += `\nPOINTS CLÉS :\n` + dynamicKeyPoints.map((p) => `• ${p}`).join('\n') + '\n';
    }
    dynamicSections.forEach((sec) => {
      out += `\n=======================================================\n${sec.number}. ${sec.heading.toUpperCase()}\n=======================================================\n${sec.body}\n`;
      if (sec.points && sec.points.length > 0) {
        out += sec.points.map((p: string) => `  - ${p}`).join('\n') + '\n';
      }
    });
    return out;
  }, [hasDynamicData, docTitle, docSubtitle, dynamicKeyPoints, dynamicSections]);

  const handleCopy = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!fullText) return;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(docTitle || 'Synthese').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div id="module-resume" className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-16">
      {/* 
        FIXED / STICKY CONTROLS BAR:
        Elevated, stationary, pinned below the navigation when scrolling.
        Only Copier and Télécharger buttons (Surlignage removed).
      */}
      <div
        id="resume-sticky-actions"
        className="sticky top-[53px] sm:top-[57px] z-30 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2 bg-stone-50/95 backdrop-blur-md border-b border-stone-200/80 flex items-center justify-between gap-3 mb-6 transition-shadow"
      >
        <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold">
          <FileText className="w-4 h-4 text-stone-700" />
          <span className="hidden sm:inline">Synthèse méthodologique</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton Copier */}
          <button
            id="btn-copy-resume"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95"
            title="Copier l'intégralité du texte"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-stone-600" />
                <span>Copier le texte</span>
              </>
            )}
          </button>

          {/* Bouton Télécharger */}
          <button
            id="btn-download-resume"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95"
            title="Télécharger le document au format texte"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Téléchargé !</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 
        RÉSUMÉ DIRECTEMENT SUR LE FOND DE LA PAGE (SANS BLOC / SANS CARD)
        Parfaitement ordonné, typographie soignée, hiérarchie claire.
      */}
      <article id="resume-document-content" className="space-y-12">
        {/* Document Header */}
        <header className="space-y-3 pb-8 border-b border-stone-200">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <span className="px-2.5 py-1 rounded-md bg-stone-200/80 text-stone-800">
              Document de synthèse
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-stone-600">
              <Clock className="w-3.5 h-3.5" /> Lecture 4 min
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-stone-600">
              <BookOpen className="w-3.5 h-3.5" /> Référence d'étude
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-950 tracking-tight leading-tight break-words whitespace-normal">
            <MathText text={docTitle} />
          </h1>
          {docSubtitle && (
            <div className="text-stone-600 text-sm sm:text-base leading-relaxed max-w-3xl break-words whitespace-normal">
              <MathText text={docSubtitle} />
            </div>
          )}
        </header>

        {/* Dynamic Key Points if available */}
        {dynamicKeyPoints.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 w-full h-auto">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" /> Points clés essentiels
            </h3>
            <ul className="space-y-1.5 text-sm text-stone-800">
              {dynamicKeyPoints.map((kp, kidx) => (
                <li key={kidx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="font-medium break-words whitespace-normal leading-relaxed">
                    <MathText text={kp} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasDynamicData && dynamicSections.length > 0 ? (
          dynamicSections.map((sec, sidx) => (
            <React.Fragment key={sidx}>
              <section className="space-y-4 w-full h-auto">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {sec.number || sidx + 1}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight leading-relaxed break-words whitespace-normal">
                    <MathText text={sec.heading} />
                  </h2>
                </div>
                <div className="text-stone-800 leading-relaxed text-base sm:text-lg whitespace-pre-line break-words w-full h-auto">
                  <MathText text={sec.body} />
                </div>
                {sec.points && sec.points.length > 0 && (
                  <div className="space-y-2 text-stone-700 text-sm sm:text-base leading-relaxed pl-3 border-l-2 border-stone-300 w-full h-auto break-words">
                    <p className="font-semibold text-stone-900">{sec.protocolTitle}</p>
                    <ul className="space-y-2 list-none">
                      {sec.points.map((pt: string, pidx: number) => (
                        <li key={pidx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-stone-600 shrink-0 mt-1" />
                          <span className="break-words whitespace-normal leading-relaxed">
                            <MathText text={pt} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              {sidx < dynamicSections.length - 1 && <hr className="border-stone-200" />}
            </React.Fragment>
          ))
        ) : !hasDynamicData ? (
          <div id="resume-empty-card" className="w-full bg-white border border-stone-200 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-xs my-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-bold text-stone-900">
                Fiche de Synthèse
              </h3>
              <p className="text-stone-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
                Espace prêt à recevoir la synthèse structurée. Demandez à l'IA d'analyser votre cours ou document pour extraire les grands axes, points clés et résumés détaillés adaptés à votre sujet.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Format pleine page adaptatif sans contrainte de hauteur
              </span>
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
