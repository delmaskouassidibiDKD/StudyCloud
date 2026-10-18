import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileText,
} from 'lucide-react';
import { MathText } from '../MathText';
import {
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

function cleanFormulaLatex(latex?: string): string {
  if (!latex) return '';
  return latex
    .replace(/(?<!\\)\$/g, '')
    .trim();
}

function isFillerText(str?: string): boolean {
  if (!str) return true;
  return /^(?:application directe du cours|selon les lois fondamentales|d[eé]monstration par application des lois fondamentales|selon le cours|application du cours|n\/a)$/i.test(str.trim());
}

export default function Resume({ data, title, sourceFileName }: ResumeProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Normalisation unifiée et robuste des données (support JSON structuré, Markdown et enrichissement didactique)
  const parsedSummary = useMemo(() => {
    const raw: any =
      data?.summary && typeof data.summary === 'object' && !Array.isArray(data.summary)
        ? data.summary
        : data?.content && typeof data.content === 'object' && !Array.isArray(data.content)
        ? data.content
        : data?.creation_data && typeof data.creation_data === 'object' && !Array.isArray(data.creation_data)
        ? data.creation_data
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

    // Détection d'un titre et d'un thème propre
    let safeTitle =
      raw?.title ||
      data?.title ||
      title ||
      (sourceFileName ? sourceFileName.replace(/\.[^/.]+$/, '') : 'Fiche de Résumé');

    // Nettoyage des préfixes redondants
    safeTitle = safeTitle.replace(/^Fiche de R[ée]sum[ée]\s*:\s*/i, '').trim();

    let safeTheme =
      raw?.theme ||
      raw?.domaine ||
      data?.theme ||
      safeTitle;

    if (rawMarkdown) {
      const titleMatch = rawMarkdown.match(/^#\s*📑?\s*\[?([^\]\n]+)\]?/m);
      if (titleMatch && titleMatch[1]) {
        safeTitle = titleMatch[1].replace(/^Fiche de R[ée]sum[ée]\s*:\s*/i, '').trim();
      }
      const themeMatch = rawMarkdown.match(/\((?:Domaine|Thème)\s*[:–—\-]?\s*([^\)]+)\)/i);
      if (themeMatch && themeMatch[1]) {
        safeTheme = themeMatch[1].trim();
      }
    }

    const rawOverview =
      raw?.overview ||
      (typeof raw?.summary === 'string' ? raw.summary : '') ||
      raw?.description ||
      '';
    const isCompanion = typeof rawOverview === 'string' && /^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨|\*\(Le calcul)/i.test(rawOverview.trim());
    const safeOverview = isCompanion ? '' : rawOverview;

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
          objective: d.objective || d.application || '',
        });
      });
    }

    // 2. Formulaire & Méthodologie
    let formulas: SummaryFormula[] = Array.isArray(raw?.formulas) ? raw.formulas : [];

    if (formulas.length === 0 && rawMarkdown) {
      const formulaRegex =
        /(?:####?\s*🔹?\s*([^\n$]+)\n+)?(?:\*\s*\*\*Formule\s*:\*\*\s*)?(\$\$[\s\S]*?\$\$)/g;
      const fMatches = rawMarkdown.matchAll(formulaRegex);
      for (const m of fMatches) {
        const detectedName = m[1]?.replace(/^[\s#*🔹\-\d\.]+/g, '').trim();
        const rawLatex = m[2].trim();
        const cleanLatex = cleanFormulaLatex(rawLatex);
        if (cleanLatex && !formulas.some((f) => cleanFormulaLatex(f.latex) === cleanLatex)) {
          formulas.push({
            name: detectedName || 'Formule Fondamentale',
            latex: cleanLatex,
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
        const statement = exLines[0] || 'Mini-cas d\'application concrète.';
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

    // Sections rédigées de cours
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

  // Texte intégral pour la copie et le téléchargement
  const fullText = useMemo(() => {
    if (!parsedSummary.hasData) return '';
    let out = `${parsedSummary.title.toUpperCase()}\n`;
    out += `Thème : ${parsedSummary.theme}\n\n`;

    if (parsedSummary.overview) {
      out += `${parsedSummary.overview}\n\n`;
    }

    if (parsedSummary.keyDefinitions.length > 0) {
      out += `I. NOTIONS FONDAMENTALES & DÉFINITIONS :\n`;
      parsedSummary.keyDefinitions.forEach((kd) => {
        const c = kd.concept.replace(/[:\s]+$/, '');
        const d = kd.definition.replace(/^[:\s]+/, '');
        out += `• ${c} : ${d}`;
        if (kd.objective) out += ` (Objectif : ${kd.objective})`;
        out += `\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.formulas.length > 0) {
      out += `II. FORMULAIRE & MÉTHODES DE CALCUL :\n`;
      parsedSummary.formulas.forEach((f, idx) => {
        out += `\n[Formule ${idx + 1}] ${f.name || 'Relation clé'} :\n`;
        out += `   Formule : ${f.latex}\n`;
        if (f.variables) out += `   Variables : ${f.variables}\n`;
        if (f.when_to_use) out += `   Cas d'application : ${f.when_to_use}\n`;
        if (f.how_to_derive) out += `   Démonstration : ${f.how_to_derive}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.comparisonTable) {
      out += `III. TABLEAU SYNTHÉTIQUE :\n`;
      out += `| ${parsedSummary.comparisonTable.headers.join(' | ')} |\n`;
      out += `| ${parsedSummary.comparisonTable.headers.map(() => '---').join(' | ')} |\n`;
      parsedSummary.comparisonTable.rows.forEach((row) => {
        out += `| ${row.join(' | ')} |\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.trapsAndTips.length > 0) {
      out += `IV. PIÈGES À ÉVITER & REMARQUES (NB) :\n`;
      parsedSummary.trapsAndTips.forEach((tt) => {
        const prefix = tt.type === 'trap' ? '⚠️ PIÈGE CLASSIQUE' : '💡 ASTUCE (NB)';
        out += `> [${prefix}] ${tt.title ? `${tt.title} : ` : ''}${tt.content}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.practicalExample) {
      out += `V. EXEMPLE PRATIQUE D'APPLICATION :\n`;
      out += `Énoncé : ${parsedSummary.practicalExample.statement}\n`;
      out += `Résolution pas à pas :\n`;
      parsedSummary.practicalExample.resolution_steps.forEach((step, sidx) => {
        out += `  ${sidx + 1}. ${step}\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.sections.length > 0) {
      out += `DÉVELOPPEMENTS DU COURS :\n`;
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
    link.download = `${(docTitle || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
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
          <span className="truncate">Fiche de Résumé</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bouton Copier */}
          <button
            id="btn-copy-resume"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Copier l'intégralité du texte"
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
            title="Télécharger la fiche"
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
        2. ZONE DE RÉDACTION : PAGE BLANCHE ET ÉCRITURE EN NOIR
        Avec encadrés de couleur clairs (Bleu pour formules, Jaune/Orange pour pièges, Vert pour méthodes)
      */}
      <div className="flex-1 w-full bg-white px-4 sm:px-8 md:px-12 py-8">
        <article id="resume-document-content" className="w-full max-w-4xl mx-auto space-y-8 text-stone-900">
          {/* 
            LE THÈME BIEN EN HAUT AU MILIEU ET ENCADRÉ (PAS GROS)
          */}
          <div className="w-full flex justify-center pt-1 pb-4">
            <div className="inline-block px-5 py-1.5 rounded border border-stone-800 text-stone-900 font-extrabold text-xs sm:text-sm tracking-widest uppercase text-center bg-stone-50 shadow-2xs">
              <MathText text={docTitle || docTheme} inline={true} />
            </div>
          </div>

          {/* Vue d'ensemble / Introduction du chapitre */}
          {docOverview && (
            <div className="text-stone-900 text-base sm:text-lg leading-relaxed font-normal">
              <MathText text={docOverview} />
            </div>
          )}

          {/* I. Notions Clés & Définitions - Sans deux-points isolés sur une ligne */}
          {(parsedSummary.keyDefinitions.length > 0 || parsedSummary.keyPoints.length > 0) && (
            <section className="space-y-4 pt-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                I. Notions Fondamentales & Définitions
              </h2>

              {parsedSummary.keyDefinitions.length > 0 ? (
                <ul className="space-y-3 pl-1">
                  {parsedSummary.keyDefinitions.map((kd, kidx) => {
                    const cleanConcept = kd.concept.replace(/[:\s]+$/, '').trim();
                    const cleanDef = kd.definition.replace(/^[:\s]+/, '').trim();
                    return (
                      <li key={kidx} className="flex items-start gap-2.5 text-stone-900 text-base sm:text-lg leading-relaxed">
                        <span className="text-stone-500 font-bold mt-1 text-sm">•</span>
                        <div className="flex-1">
                          <span className="font-extrabold text-black">
                            <MathText text={cleanConcept} inline={true} />
                          </span>
                          <span className="text-stone-700 font-bold"> : </span>
                          <span className="text-stone-900">
                            <MathText text={cleanDef} inline={true} />
                          </span>
                          {kd.objective && (
                            <div className="text-stone-600 text-sm italic pt-0.5">
                              <span className="font-semibold not-italic text-stone-700">Objectif : </span>
                              <MathText text={kd.objective.replace(/^[:\s]+/, '')} inline={true} />
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="space-y-2.5 pl-1">
                  {parsedSummary.keyPoints.map((kp, kidx) => (
                    <li key={kidx} className="flex items-start gap-2 text-stone-900 text-base sm:text-lg leading-relaxed">
                      <span className="text-stone-500 font-bold mt-1 text-sm">•</span>
                      <div className="flex-1">
                        <MathText text={kp} inline={true} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* II. Formulaire, Règles & Méthodes - Rédigé directement sur le fond de page comme un livre */}
          {parsedSummary.formulas.length > 0 && (
            <section className="space-y-6 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                II. Notions Clés, Formules & Règles Fondamentales
              </h2>

              <div className="space-y-8">
                {parsedSummary.formulas.map((formula, fidx) => {
                  const cleanedLatex = cleanFormulaLatex(formula.latex);
                  const hasObjective = Boolean(formula.target_goal || (!isFillerText(formula.when_to_use) ? formula.when_to_use : null));
                  const hasSteps = Boolean(formula.demonstration_steps && formula.demonstration_steps.length > 0);
                  const hasDerivation = Boolean(formula.how_to_derive && !isFillerText(formula.how_to_derive));
                  const hasTraps = Boolean(formula.exam_trap);

                  return (
                    <div
                      key={fidx}
                      className="space-y-3 pt-2"
                    >
                      {/* En-tête de la formule/règle - style titre de livre de cours */}
                      <div className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
                        <span className="font-extrabold">{fidx + 1}.</span>
                        <span className="uppercase tracking-wide">
                          <MathText text={formula.name || `Règle / Formule ${fidx + 1}`} inline={true} />
                        </span>
                      </div>

                      {/* Formule mathématique centrée directement sur le fond de la page (uniquement si LaTeX présent) */}
                      {cleanedLatex && (
                        <div className="py-2 px-2 text-center overflow-x-auto text-xl sm:text-2xl font-bold text-black my-2">
                          <MathText text={`$$ ${cleanedLatex} $$`} />
                        </div>
                      )}

                      {/* Contenu pédagogique continu sur le fond de page */}
                      <div className="space-y-2.5 text-stone-900 text-base leading-relaxed pl-1 sm:pl-3">
                        {/* 1. Objectif & Utilité */}
                        {hasObjective && (
                          <p className="text-stone-800">
                            <strong className="font-bold text-black">🎯 Objectif & Utilité : </strong>
                            <MathText text={formula.target_goal || formula.when_to_use || ''} inline={true} />
                          </p>
                        )}

                        {/* 2. Démonstration, Logique ou Méthode pas à pas */}
                        {(hasSteps || hasDerivation) && (
                          <div className="space-y-1.5 pt-0.5">
                            <p className="font-bold text-black">
                              🛠️ Démonstration & Méthode d'application pas à pas :
                            </p>
                            {hasSteps ? (
                              <ol className="list-decimal pl-6 space-y-1 text-stone-800 font-normal">
                                {formula.demonstration_steps!.map((step, sidx) => (
                                  <li key={sidx} className="pl-1">
                                    <MathText text={step} inline={true} />
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <div className="pl-4 text-stone-800">
                                <MathText text={formula.how_to_derive!} inline={true} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Variables, Unités ou Conditions */}
                        {formula.variables && (
                          <p className="text-stone-800">
                            <strong className="font-bold text-black">📐 Variables, Unités ou Conditions : </strong>
                            <MathText text={formula.variables} inline={true} />
                          </p>
                        )}

                        {/* 4. Piège classique à l'examen */}
                        {hasTraps && (
                          <p className="text-stone-800">
                            <strong className="font-bold text-black">⚠️ Piège classique à l'examen : </strong>
                            <MathText text={formula.exam_trap!} inline={true} />
                          </p>
                        )}
                      </div>

                      {/* Séparation sobre de livre entre deux formules/règles */}
                      {fidx < parsedSummary.formulas.length - 1 && (
                        <hr className="border-t border-stone-200 my-6" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* III. Tableau Synthétique Comparatif Obligatoire */}
          {parsedSummary.comparisonTable && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                III. Tableau Synthétique Comparatif
              </h2>

              <div className="w-full overflow-x-auto my-3 rounded-lg border border-stone-300 shadow-2xs">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-300 text-stone-900 font-extrabold">
                      {parsedSummary.comparisonTable.headers.map((h, hidx) => (
                        <th key={hidx} className="py-3 px-3.5 uppercase tracking-wide">
                          <MathText text={h} inline={true} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {parsedSummary.comparisonTable.rows.map((row, ridx) => (
                      <tr
                        key={ridx}
                        className={ridx % 2 === 0 ? 'bg-white' : 'bg-stone-50/70'}
                      >
                        {row.map((cell, cidx) => (
                          <td key={cidx} className="py-3 px-3.5 text-stone-900 font-medium leading-relaxed">
                            <MathText text={cell} inline={true} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* IV. Pièges à Éviter & Astuces Méthodologiques (NB) - Sans bloc coloré ni trait vertical */}
          {parsedSummary.trapsAndTips.length > 0 && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                IV. Pièges à Éviter & Astuces Méthodologiques (NB)
              </h2>

              <div className="space-y-4 pt-1">
                {parsedSummary.trapsAndTips.map((item, tidx) => {
                  const isTrap = item.type === 'trap' || /pi[èe]ge/i.test(item.title || '');
                  return (
                    <div key={tidx} className="space-y-1 text-base text-stone-900 leading-relaxed pl-1 sm:pl-3">
                      <p className="font-bold text-black flex items-center gap-2">
                        <span>{isTrap ? '⚠️ PIÈGE CLASSIQUE :' : '💡 ASTUCE MÉTHODOLOGIQUE (NB) :'}</span>
                        {item.title && !/^(pi[èe]ge|astuce)/i.test(item.title) && (
                          <span className="font-semibold text-stone-800">{item.title}</span>
                        )}
                      </p>
                      <div className="pl-6 text-stone-800 font-normal">
                        <MathText text={item.content} inline={true} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* V. Exemple Pratique d'Application - Rédigé directement sur le fond de page */}
          {parsedSummary.practicalExample && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                V. Exemple Pratique d'Application
              </h2>

              <div className="space-y-3 pt-1 text-base text-stone-900 leading-relaxed pl-1 sm:pl-3">
                <div className="space-y-1">
                  <p className="font-bold text-black">
                    🛠️ Cas concret résolu étape par étape
                  </p>
                </div>

                <div className="space-y-1 pl-4">
                  <p className="font-bold text-black">Énoncé :</p>
                  <div className="italic text-stone-800">
                    <MathText text={parsedSummary.practicalExample.statement} inline={true} />
                  </div>
                </div>

                <div className="space-y-2 pt-1 pl-4">
                  <p className="font-bold text-black text-sm uppercase tracking-wide">
                    Résolution détaillée pas à pas :
                  </p>
                  <ol className="space-y-2 list-decimal pl-6 text-stone-900 text-base leading-relaxed">
                    {parsedSummary.practicalExample.resolution_steps.map((step, sidx) => (
                      <li key={sidx} className="pl-1">
                        <MathText text={step.replace(/^\s*\d+[\.\-\)]\s*/, '')} inline={true} />
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          )}

          {/* Sections détaillées de cours complémentaires */}
          {parsedSummary.sections.length > 0 && (
            <div className="space-y-8 pt-4">
              {parsedSummary.sections.map((sec, sidx) => (
                <section key={sidx} className="space-y-3">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                    {sec.number ? `${sec.number}. ` : ''}
                    <MathText text={sec.heading.replace(/^\s*\d+[\.\-\)]\s*/, '') || sec.heading} inline={true} />
                  </h2>

                  <div className="text-stone-900 leading-relaxed text-base sm:text-lg whitespace-pre-line font-normal">
                    <MathText text={sec.body} />
                  </div>

                  {sec.points && sec.points.length > 0 && (
                    <ul className="space-y-2 pl-2">
                      {sec.points.map((pt: string, pidx: number) => (
                        <li key={pidx} className="flex items-start gap-2 text-stone-900 text-base sm:text-lg leading-relaxed">
                          <span className="text-stone-500 font-bold mt-1 text-sm">•</span>
                          <div className="flex-1">
                            <MathText text={pt} inline={true} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* Rendu Markdown complet de repli si la fiche a été rédigée sous forme textuelle */}
          {parsedSummary.markdown && parsedSummary.sections.length === 0 && parsedSummary.formulas.length === 0 && (
            <div className="space-y-6 pt-4 text-stone-900 leading-relaxed text-base sm:text-lg">
              <MathText text={parsedSummary.markdown} />
            </div>
          )}

          {/* État vide si aucune donnée */}
          {!hasDynamicData && (
            <div
              id="resume-empty-card"
              className="w-full text-center py-16 space-y-4"
            >
              <FileText className="w-12 h-12 text-stone-400 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-800">
                  Fiche de Résumé non disponible
                </h3>
                <p className="text-stone-600 text-sm max-w-md mx-auto">
                  La génération de la synthèse n'a pas pu être complétée. Veuillez relancer la création depuis le volet de droite ou dans le chat.
                </p>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
