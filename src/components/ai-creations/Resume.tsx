import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileText,
  Clock,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  Table as TableIcon,
  Wrench,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import { MathText } from '../MathText';
import {
  SummaryContent,
  SummaryFormula,
  SummaryComparisonTable,
  SummaryTrapOrTip,
  SummaryPracticalExample,
  SummaryKeyDefinition,
} from './types';

interface ResumeProps {
  data?: any;
  title?: string;
  sourceFileName?: string;
}

export default function Resume({ data, title, sourceFileName }: ResumeProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Normalisation unifiée et robuste des données (support JSON structuré et Markdown hybride)
  const parsedSummary = useMemo(() => {
    const raw: any =
      data?.summary && typeof data.summary === 'object' && !Array.isArray(data.summary)
        ? data.summary
        : data?.content && typeof data.content === 'object' && !Array.isArray(data.content)
        ? data.content
        : data || {};

    const rawMarkdown: string =
      typeof raw?.markdown === 'string'
        ? raw.markdown
        : typeof raw?.text === 'string'
        ? raw.text
        : typeof raw?.content === 'string'
        ? raw.content
        : typeof data?.markdown === 'string'
        ? data.markdown
        : '';

    // Détection d'un titre et d'un domaine
    let safeTitle =
      raw?.title ||
      data?.title ||
      title ||
      (sourceFileName ? `Fiche de synthèse : ${sourceFileName}` : 'Fiche de Révision Pédagogique');

    let safeTheme =
      raw?.theme ||
      raw?.domaine ||
      data?.theme ||
      'Synthèse & Méthodologie Universitaire';

    if (rawMarkdown) {
      const titleMatch = rawMarkdown.match(/^#\s*📑?\s*\[?([^\]\n]+)\]?/m);
      if (titleMatch && titleMatch[1]) {
        safeTitle = titleMatch[1].trim();
      }
      const themeMatch = rawMarkdown.match(/\((?:Domaine|Thème)\s*[:–—\-]?\s*([^\)]+)\)/i);
      if (themeMatch && themeMatch[1]) {
        safeTheme = themeMatch[1].trim();
      }
    }

    const safeOverview =
      raw?.overview ||
      (typeof raw?.summary === 'string' ? raw.summary : '') ||
      raw?.description ||
      '';

    // 1. Notions Clés & Définitions
    const rawKeyDefs: SummaryKeyDefinition[] = Array.isArray(raw?.key_definitions)
      ? raw.key_definitions
      : [];

    const rawDefs = Array.isArray(raw?.definitions) ? raw.definitions : [];
    if (rawKeyDefs.length === 0 && rawDefs.length > 0) {
      rawDefs.forEach((d: any) => {
        rawKeyDefs.push({
          concept: d.term || d.concept || 'Notion clé',
          definition: d.definition || d.desc || '',
          objective: d.objective || d.application || 'Assimilation et maîtrise pratique',
        });
      });
    }

    // 2. Formulaire & Méthodologie
    const formulas: SummaryFormula[] = Array.isArray(raw?.formulas) ? raw.formulas : [];

    // Extraction de formules depuis le Markdown si non fournies
    if (formulas.length === 0 && rawMarkdown) {
      const formulaRegex =
        /(?:\*\s*\*\*Formule\s*:\*\*\s*)?(\$\$[\s\S]*?\$\$)/g;
      const fMatches = rawMarkdown.matchAll(formulaRegex);
      for (const m of fMatches) {
        const latex = m[1].trim();
        if (latex && !formulas.some((f) => f.latex === latex)) {
          formulas.push({
            name: 'Formule Fondamentale',
            latex,
            when_to_use: 'Application directe dans les exercices et configurations types',
            how_to_derive: 'Démonstration par application rigoureuse des lois physiques/mathématiques du cours',
          });
        }
      }
    }

    // 3. Tableau Synthétique
    let comparisonTable: SummaryComparisonTable | null =
      raw?.comparison_table &&
      Array.isArray(raw.comparison_table.headers) &&
      Array.isArray(raw.comparison_table.rows)
        ? raw.comparison_table
        : null;

    if (!comparisonTable && rawMarkdown) {
      const tableLines = rawMarkdown
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|') && l.endsWith('|'));
      if (tableLines.length >= 3) {
        const headers = tableLines[0]
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        const rows = tableLines
          .slice(2)
          .map((r) =>
            r
              .split('|')
              .map((c) => c.trim())
              .filter(Boolean)
          )
          .filter((row) => row.length > 0);
        if (headers.length > 0 && rows.length > 0) {
          comparisonTable = { headers, rows };
        }
      }
    }

    // 4. Blocs d'Attention (Pièges & Remarques NB)
    const trapsAndTips: SummaryTrapOrTip[] = Array.isArray(raw?.traps_and_tips)
      ? raw.traps_and_tips
      : [];

    if (trapsAndTips.length === 0 && rawMarkdown) {
      const calloutMatches = rawMarkdown.matchAll(
        />\s*(🚨|💡|\*\*PIÈGE|\*\*ASTUCE)[^\n]*(?:\n>[^\n]*)*/gi
      );
      for (const m of calloutMatches) {
        const block = m[0].replace(/^>\s*/gm, '').trim();
        if (/🚨|PI[ÈE]GE/i.test(block)) {
          trapsAndTips.push({
            type: 'trap',
            title: 'PIÈGE CLASSIQUE',
            content: block
              .replace(
                /^(?:🚨\s*)?(?:\*{1,2}PI[ÈE]GE(?:\s+CLASSIQUE)?\s*:\*{1,2}|\*{1,2}ATTENTION\s*:\*{1,2})\s*/i,
                ''
              )
              .trim(),
          });
        } else if (/💡|ASTUCE|NB/i.test(block)) {
          trapsAndTips.push({
            type: 'tip',
            title: 'ASTUCE (NB)',
            content: block
              .replace(
                /^(?:💡\s*)?(?:\*{1,2}ASTUCE(?:\s*\(NB\))?\s*:\*{1,2}|\*{1,2}NB\s*:\*{1,2})\s*/i,
                ''
              )
              .trim(),
          });
        }
      }
    }

    // 5. Exemple Pratique d'Application
    let practicalExample: SummaryPracticalExample | null =
      raw?.practical_example && typeof raw.practical_example.statement === 'string'
        ? raw.practical_example
        : null;

    if (!practicalExample && rawMarkdown) {
      const exMatch = rawMarkdown.match(
        /(?:###\s*5\.\s*🛠️?[^\n]*|Exemple\s+Pratique[^\n]*)([\s\S]*?)(?:$|(?=\n###\s*\d))/i
      );
      if (exMatch && exMatch[1].trim().length > 30) {
        const exLines = exMatch[1]
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const statement = exLines[0] || 'Mini-cas concret d\'application.';
        const resolution_steps = exLines
          .slice(1)
          .filter((l) => /^[0-9\-\*•]/.test(l));
        if (resolution_steps.length > 0) {
          practicalExample = { statement, resolution_steps };
        }
      }
    }

    // Points clés additionnels
    const rawKeyPoints = Array.isArray(raw?.keyPoints)
      ? raw.keyPoints
      : Array.isArray(raw?.key_points)
      ? raw.key_points
      : Array.isArray(data?.keyPoints)
      ? data.keyPoints
      : [];

    // Sections rédigées additionnelles
    const rawSections = raw?.sections || data?.sections;
    const sections = Array.isArray(rawSections)
      ? rawSections.map((sec: any, idx: number) => ({
          number: sec.number || idx + 1,
          heading:
            sec.section_title ||
            sec.sectionTitle ||
            sec.heading ||
            sec.title ||
            sec.titre ||
            `Section ${idx + 1}`,
          body: sec.content || sec.body || sec.texte || '',
          points: Array.isArray(sec.points)
            ? sec.points
            : Array.isArray(sec.keyPoints)
            ? sec.keyPoints
            : Array.isArray(sec.key_takeaways)
            ? sec.key_takeaways
            : [],
          protocolTitle:
            sec.protocolTitle || sec.highlightTitle || 'Points fondamentaux à retenir :',
        }))
      : [];

    const hasData = Boolean(
      safeOverview ||
        rawKeyDefs.length > 0 ||
        formulas.length > 0 ||
        comparisonTable ||
        trapsAndTips.length > 0 ||
        practicalExample ||
        sections.length > 0 ||
        rawKeyPoints.length > 0 ||
        rawMarkdown
    );

    return {
      hasData,
      title: safeTitle,
      theme: safeTheme,
      overview: safeOverview,
      keyDefinitions: rawKeyDefs,
      formulas,
      comparisonTable,
      trapsAndTips,
      practicalExample,
      keyPoints: rawKeyPoints,
      sections,
      markdown: rawMarkdown,
    };
  }, [data, title, sourceFileName]);

  const docTitle = parsedSummary.title;
  const docTheme = parsedSummary.theme;
  const docOverview = parsedSummary.overview;
  const hasDynamicData = parsedSummary.hasData;

  // Texte intégral propre pour la copie et le téléchargement
  const fullText = useMemo(() => {
    if (!parsedSummary.hasData) return '';
    let out = `=======================================================\n`;
    out += `📑 FICHE DE RÉSUMÉ PÉDAGOGIQUE : ${parsedSummary.title.toUpperCase()}\n`;
    out += `DOMAINE : ${parsedSummary.theme}\n`;
    out += `=======================================================\n\n`;

    if (parsedSummary.overview) {
      out += `ESSENTIEL DU COURS (OVERVIEW) :\n${parsedSummary.overview}\n\n`;
    }

    if (parsedSummary.keyDefinitions.length > 0) {
      out += `1. NOTIONS CLÉS & DÉFINITIONS :\n`;
      parsedSummary.keyDefinitions.forEach((kd, idx) => {
        out += `  [${idx + 1}] ${kd.concept} :\n`;
        out += `      • Définition : ${kd.definition}\n`;
        if (kd.objective) out += `      • Objectif : ${kd.objective}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.formulas.length > 0) {
      out += `2. FORMULAIRE & MÉTHODOLOGIE :\n`;
      parsedSummary.formulas.forEach((f, idx) => {
        out += `  [Formule ${idx + 1}] ${f.name || 'Relation clé'} :\n`;
        out += `      Formule : ${f.latex}\n`;
        if (f.variables) out += `      Variables : ${f.variables}\n`;
        if (f.when_to_use) out += `      Quand l'utiliser : ${f.when_to_use}\n`;
        if (f.how_to_derive) out += `      Démonstration : ${f.how_to_derive}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.comparisonTable) {
      out += `3. TABLEAU SYNTHÉTIQUE :\n`;
      out += `  | ${parsedSummary.comparisonTable.headers.join(' | ')} |\n`;
      out += `  | ${parsedSummary.comparisonTable.headers.map(() => '---').join(' | ')} |\n`;
      parsedSummary.comparisonTable.rows.forEach((row) => {
        out += `  | ${row.join(' | ')} |\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.trapsAndTips.length > 0) {
      out += `4. PIÈGES À ÉVITER & REMARQUES (NB) :\n`;
      parsedSummary.trapsAndTips.forEach((tt) => {
        const prefix = tt.type === 'trap' ? '🚨 PIÈGE CLASSIQUE' : '💡 ASTUCE (NB)';
        out += `  [${prefix}] ${tt.title ? `${tt.title} : ` : ''}${tt.content}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.practicalExample) {
      out += `5. EXEMPLE PRATIQUE D'APPLICATION :\n`;
      out += `  Énoncé : ${parsedSummary.practicalExample.statement}\n`;
      out += `  Résolution pas à pas :\n`;
      parsedSummary.practicalExample.resolution_steps.forEach((step, sidx) => {
        out += `    ${sidx + 1}. ${step}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.sections.length > 0) {
      out += `SECTIONS DÉTAILLÉES DU COURS :\n`;
      parsedSummary.sections.forEach((sec) => {
        out += `\n--- ${sec.number}. ${sec.heading} ---\n${sec.body}\n`;
        if (sec.points && sec.points.length > 0) {
          out += sec.points.map((p: string) => `  • ${p}`).join('\n') + '\n';
        }
      });
    }

    return out;
  }, [parsedSummary]);

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
    link.download = `${(docTitle || 'Fiche_Revision').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div id="module-resume" className="w-full min-h-full bg-white flex flex-col font-sans">
      {/* 
        1. BANDE HORIZONTALE D'ACTIONS :
        Colle directement à la barre supérieure (top-0, aucun espace vide, pleine largeur)
      */}
      <div
        id="resume-sticky-actions"
        className="sticky top-0 z-30 w-full px-4 sm:px-6 md:px-8 py-2.5 bg-white border-b border-stone-200 flex items-center justify-between gap-3 shadow-xs shrink-0"
      >
        <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-bold min-w-0">
          <FileText className="w-4 h-4 text-stone-900 shrink-0" />
          <span className="truncate">Fiche de Révision Pédagogique</span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            5 Blocs Clés
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bouton Copier */}
          <button
            id="btn-copy-resume"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Copier l'intégralité du texte de la fiche"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copié !</span>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Télécharger la fiche au format texte"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Téléchargé !</span>
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
        2. ZONE DE RÉDACTION DU RÉSUMÉ : PAGE BLANCHE ET ÉCRITURE EN NOIR
      */}
      <div className="flex-1 w-full bg-white px-4 sm:px-6 md:px-10 py-8">
        <article id="resume-document-content" className="w-full max-w-4xl mx-auto space-y-10 text-stone-900">
          {/* 
            ========================================================================
            EN-TÊTE : THÈME ET TITRE ENCADRÉS (Boîte stylisée avec border, bg, radius)
            ========================================================================
          */}
          <header className="rounded-2xl border-2 border-stone-300/80 bg-stone-50/70 p-6 sm:p-8 space-y-4 shadow-xs relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-stone-600">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-stone-900 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-xs">
                  <Bookmark className="w-3 h-3 text-amber-400" />
                  {docTheme}
                </span>
                <span className="hidden sm:inline text-stone-400">•</span>
                <span className="hidden sm:flex items-center gap-1 text-stone-600 font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Lecture 5 min
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300/80 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 text-amber-600" /> Support Pédagogique Officiel
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-black tracking-tight leading-tight break-words whitespace-normal">
              <MathText text={docTitle} />
            </h1>

            {docOverview && (
              <div className="text-stone-800 text-base sm:text-lg leading-relaxed pt-2 border-t border-stone-200">
                <MathText text={docOverview} />
              </div>
            )}
          </header>

          {/* 
            ========================================================================
            BLOC 1 : 📌 NOTIONS CLÉS & DÉFINITIONS
            ========================================================================
          */}
          {(parsedSummary.keyDefinitions.length > 0 || parsedSummary.keyPoints.length > 0) && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b-2 border-stone-200">
                <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  1
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-black flex items-center gap-2">
                  <span>📌 Notions Clés & Définitions</span>
                </h2>
              </div>

              {parsedSummary.keyDefinitions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3.5">
                  {parsedSummary.keyDefinitions.map((kd, kidx) => (
                    <div
                      key={kidx}
                      className="p-4 sm:p-5 rounded-xl border border-stone-200 bg-white shadow-xs space-y-2 hover:border-stone-300 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-1" />
                        <div className="space-y-1.5 w-full">
                          <p className="font-bold text-black text-base sm:text-lg">
                            <MathText text={kd.concept} />
                          </p>
                          <div className="text-stone-900 text-sm sm:text-base leading-relaxed pl-1">
                            <span className="font-semibold text-stone-700">Définition : </span>
                            <MathText text={kd.definition} />
                          </div>
                          {kd.objective && (
                            <div className="text-stone-800 text-xs sm:text-sm leading-relaxed pl-1 pt-1 border-t border-stone-100 flex items-start gap-1.5">
                              <span className="font-semibold text-amber-800">🎯 Objectif :</span>
                              <MathText text={kd.objective} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback sur les keyPoints */
                <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-3 w-full shadow-xs">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-700" /> Points clés essentiels
                  </h3>
                  <ul className="space-y-2.5 text-sm sm:text-base text-stone-900">
                    {parsedSummary.keyPoints.map((kp, kidx) => (
                      <li key={kidx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-1" />
                        <span className="font-medium break-words whitespace-normal leading-relaxed text-stone-900">
                          <MathText text={kp} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* 
            ========================================================================
            BLOC 2 : 🧮 FORMULAIRE & MÉTHODOLOGIE
            ========================================================================
          */}
          {parsedSummary.formulas.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b-2 border-stone-200">
                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  2
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-black flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <span>Formulaire & Méthodologie</span>
                </h2>
              </div>

              <div className="space-y-4">
                {parsedSummary.formulas.map((formula, fidx) => (
                  <div
                    key={fidx}
                    className="p-5 sm:p-6 rounded-2xl border-2 border-blue-100 bg-white shadow-xs space-y-4 hover:border-blue-200 transition-colors"
                  >
                    {/* Nom de la formule */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-900 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200">
                        {formula.name || `Formule Fondamentale ${fidx + 1}`}
                      </span>
                    </div>

                    {/* Bloc Formule KaTeX centré et mis en valeur */}
                    <div className="py-4 px-6 rounded-xl bg-stone-50 border border-stone-200 text-center overflow-x-auto">
                      <div className="text-lg sm:text-xl font-bold text-stone-950 inline-block">
                        <MathText text={formula.latex.startsWith('$$') ? formula.latex : `$$ ${formula.latex} $$`} />
                      </div>
                    </div>

                    {/* Détails méthodologiques sous forme de cartes d'informations */}
                    <div className="grid grid-cols-1 gap-2.5 text-xs sm:text-sm text-stone-900 pt-1">
                      {formula.variables && (
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                          <p className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Signification des variables & unités :
                          </p>
                          <div className="text-stone-700 leading-relaxed pl-3">
                            <MathText text={formula.variables} />
                          </div>
                        </div>
                      )}

                      {formula.when_to_use && (
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                          <p className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Quand l'utiliser ? (Cas d'application) :
                          </p>
                          <div className="text-stone-700 leading-relaxed pl-3">
                            <MathText text={formula.when_to_use} />
                          </div>
                        </div>
                      )}

                      {formula.how_to_derive && (
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                          <p className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            Comment la retrouver / démontrer ? (Méthode étape par étape) :
                          </p>
                          <div className="text-stone-700 leading-relaxed pl-3">
                            <MathText text={formula.how_to_derive} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 
            ========================================================================
            BLOC 3 : 📊 TABLEAU SYNTHÉTIQUE / COMPARATIF
            ========================================================================
          */}
          {parsedSummary.comparisonTable && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b-2 border-stone-200">
                <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  3
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-black flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-purple-600" />
                  <span>Tableau Synthétique</span>
                </h2>
              </div>

              <div className="w-full overflow-x-auto rounded-2xl border border-stone-300 shadow-xs bg-white">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-300 text-stone-900 font-extrabold">
                      {parsedSummary.comparisonTable.headers.map((h, hidx) => (
                        <th key={hidx} className="py-3 px-4 uppercase tracking-wider text-xs">
                          <MathText text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {parsedSummary.comparisonTable.rows.map((row, ridx) => (
                      <tr
                        key={ridx}
                        className={ridx % 2 === 0 ? 'bg-white hover:bg-stone-50/80' : 'bg-stone-50/50 hover:bg-stone-50'}
                      >
                        {row.map((cell, cidx) => (
                          <td key={cidx} className="py-3 px-4 text-stone-900 font-medium leading-relaxed">
                            <MathText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 
            ========================================================================
            BLOC 4 : ⚠️ PIÈGES À ÉVITER & REMARQUES (NB)
            Cadres de couleur dédiés : Rouge/Orange pour Piège, Vert/Bleu pour Astuce
            ========================================================================
          */}
          {parsedSummary.trapsAndTips.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b-2 border-stone-200">
                <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  4
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-black flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Pièges à éviter & Remarques (NB)</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {parsedSummary.trapsAndTips.map((item, tidx) => {
                  const isTrap = item.type === 'trap' || /pi[èe]ge/i.test(item.title || '');
                  return (
                    <div
                      key={tidx}
                      className={
                        isTrap
                          ? 'p-5 sm:p-6 rounded-2xl border-2 border-rose-300 bg-rose-50/90 text-rose-950 space-y-2 shadow-xs'
                          : 'p-5 sm:p-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 text-emerald-950 space-y-2 shadow-xs'
                      }
                    >
                      <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base uppercase tracking-wide">
                        {isTrap ? (
                          <>
                            <span className="text-xl">🚨</span>
                            <span className="text-rose-950">{item.title || 'PIÈGE CLASSIQUE :'}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xl">💡</span>
                            <span className="text-emerald-950">{item.title || 'ASTUCE MÉTHODOLOGIQUE (NB) :'}</span>
                          </>
                        )}
                      </div>
                      <div
                        className={
                          isTrap
                            ? 'text-sm sm:text-base leading-relaxed text-rose-900 pl-7 font-medium'
                            : 'text-sm sm:text-base leading-relaxed text-emerald-900 pl-7 font-medium'
                        }
                      >
                        <MathText text={item.content} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 
            ========================================================================
            BLOC 5 : 🛠️ EXEMPLE PRATIQUE D'APPLICATION
            Mini-cas concret avec résolution étape par étape
            ========================================================================
          */}
          {parsedSummary.practicalExample && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b-2 border-stone-200">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  5
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-black flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-emerald-600" />
                  <span>Exemple Pratique d'Application</span>
                </h2>
              </div>

              <div className="p-6 sm:p-7 rounded-2xl border-2 border-stone-200 bg-stone-50/70 shadow-xs space-y-4">
                {/* Énoncé concret */}
                <div className="space-y-1.5 pb-3 border-b border-stone-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Mini-cas d'application concrète :
                  </span>
                  <p className="text-base sm:text-lg font-bold text-black leading-relaxed">
                    <MathText text={parsedSummary.practicalExample.statement} />
                  </p>
                </div>

                {/* Résolution étape par étape */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Résolution détaillée pas à pas :
                  </span>
                  <div className="space-y-2">
                    {parsedSummary.practicalExample.resolution_steps.map((step, sidx) => (
                      <div
                        key={sidx}
                        className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs text-stone-900 text-sm sm:text-base leading-relaxed"
                      >
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {sidx + 1}
                        </span>
                        <div className="flex-1 font-medium">
                          <MathText text={step.replace(/^\s*\d+[\.\-\)]\s*/, '')} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 
            ========================================================================
            SECTIONS DÉTAILLÉES DU COURS (Si fournies par l'IA ou les documents)
            ========================================================================
          */}
          {parsedSummary.sections.length > 0 && (
            <div className="space-y-8 pt-4">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-200 text-xs font-bold uppercase tracking-wider text-stone-500">
                <BookOpen className="w-4 h-4 text-stone-700" />
                <span>Développements & Synthèses par Section</span>
              </div>

              {parsedSummary.sections.map((sec, sidx) => (
                <section key={sidx} className="space-y-3.5 w-full">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-stone-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {sec.number || sidx + 1}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-black tracking-tight leading-relaxed break-words whitespace-normal">
                      <MathText text={sec.heading.replace(/^\s*\d+[\.\-\)]\s*/, '') || sec.heading} />
                    </h3>
                  </div>

                  <div className="text-stone-900 leading-relaxed text-base sm:text-lg whitespace-pre-line break-words w-full font-normal">
                    <MathText text={sec.body} />
                  </div>

                  {sec.points && sec.points.length > 0 && (
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5 space-y-2.5 text-stone-900 text-sm sm:text-base leading-relaxed w-full break-words">
                      <p className="font-bold text-black text-xs uppercase tracking-wide">
                        {sec.protocolTitle}
                      </p>
                      <ul className="space-y-2 list-none">
                        {sec.points.map((pt: string, pidx: number) => (
                          <li key={pidx} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0 mt-1" />
                            <span className="break-words whitespace-normal leading-relaxed text-stone-900">
                              <MathText text={pt} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sidx < parsedSummary.sections.length - 1 && <hr className="border-stone-200 pt-2" />}
                </section>
              ))}
            </div>
          )}

          {/* État vide si aucune donnée */}
          {!hasDynamicData && (
            <div
              id="resume-empty-card"
              className="w-full bg-white border border-stone-200 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-xs my-6"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-bold text-stone-900">
                  Fiche de Révision Pédagogique
                </h3>
                <p className="text-stone-600 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
                  Prêt à générer la fiche de synthèse complète structurée en 5 blocs : Notions Clés, Formulaire & Méthodologie, Tableau Synthétique, Pièges à éviter & Astuces (NB), et Exemple Pratique d'Application.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Format pleine page blanche avec écriture noire et encadrés colorés
                </span>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
