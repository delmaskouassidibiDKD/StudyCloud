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

export default function Resume({ data, title, sourceFileName }: ResumeProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Normalisation unifiée et robuste des données (support JSON structuré et Markdown continu)
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
          objective: d.objective || d.application || '',
        });
      });
    }

    // 2. Formulaire & Méthodologie
    const formulas: SummaryFormula[] = Array.isArray(raw?.formulas) ? raw.formulas : [];

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
            when_to_use: 'Application directe dans les configurations du cours',
            how_to_derive: 'Application des lois fondamentales du chapitre',
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
        out += `• ${kd.concept} : ${kd.definition}`;
        if (kd.objective) out += ` (Objectif : ${kd.objective})`;
        out += `\n`;
      });
      out += `\n`;
    }

    if (parsedSummary.formulas.length > 0) {
      out += `II. FORMULAIRE & MÉTHODOLOGIE :\n`;
      parsedSummary.formulas.forEach((f, idx) => {
        out += `\n${idx + 1}. ${f.name || 'Relation clé'} :\n`;
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
        const prefix = tt.type === 'trap' ? '🚨 PIÈGE CLASSIQUE' : '💡 ASTUCE (NB)';
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
        SANS BADGE superflu (badge '5 Blocs Clés' supprimé comme demandé)
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
        2. ZONE DE RÉDACTION : PAGE BLANCHE ET ÉCRITURE EN NOIR DIRECTEMENT DANS LE FOND DE PAGE
        (Pas de gros bloc rond encadré et séparé, flux continu comme un livre structuré)
      */}
      <div className="flex-1 w-full bg-white px-4 sm:px-8 md:px-12 py-8">
        <article id="resume-document-content" className="w-full max-w-4xl mx-auto space-y-8 text-stone-900">
          {/* 
            LE THÈME BIEN EN HAUT AU MILIEU ET ENCADRÉ (PAS GROS)
            Tous les autres éléments superflus (badges noirs, lecture 5 min, etc.) sont retirés.
          */}
          <div className="w-full flex justify-center pt-1 pb-4">
            <div className="inline-block px-5 py-1.5 rounded border border-stone-800 text-stone-900 font-extrabold text-xs sm:text-sm tracking-widest uppercase text-center bg-stone-50 shadow-2xs">
              <MathText text={docTitle || docTheme} />
            </div>
          </div>

          {/* 
            DÉVELOPPEMENT CONTINU RÉDIGÉ COMME UN LIVRE STRUCTURÉ :
            Le texte s'affiche directement sur le fond de la page (comme dans le chat).
          */}

          {/* Vue d'ensemble / Introduction du chapitre */}
          {docOverview && (
            <div className="text-stone-900 text-base sm:text-lg leading-relaxed space-y-3 font-normal">
              <MathText text={docOverview} />
            </div>
          )}

          {/* I. Notions Clés & Définitions */}
          {(parsedSummary.keyDefinitions.length > 0 || parsedSummary.keyPoints.length > 0) && (
            <section className="space-y-4 pt-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                I. Notions Fondamentales & Définitions
              </h2>

              {parsedSummary.keyDefinitions.length > 0 ? (
                <ul className="space-y-3.5 pl-1">
                  {parsedSummary.keyDefinitions.map((kd, kidx) => (
                    <li key={kidx} className="flex items-start gap-2.5 text-stone-900 text-base sm:text-lg leading-relaxed">
                      <span className="text-stone-500 font-bold mt-1 text-sm">•</span>
                      <div className="flex-1">
                        <span className="font-extrabold text-black">
                          <MathText text={kd.concept} />
                        </span>
                        <span className="text-stone-700 font-medium"> : </span>
                        <MathText text={kd.definition} />
                        {kd.objective && (
                          <div className="text-stone-600 text-sm italic pt-0.5">
                            <span className="font-semibold not-italic text-stone-700">Objectif : </span>
                            <MathText text={kd.objective} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2.5 pl-1">
                  {parsedSummary.keyPoints.map((kp, kidx) => (
                    <li key={kidx} className="flex items-start gap-2.5 text-stone-900 text-base sm:text-lg leading-relaxed">
                      <span className="text-stone-500 font-bold mt-1 text-sm">•</span>
                      <div className="flex-1">
                        <MathText text={kp} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* II. Formulaire & Modélisation Mathématique */}
          {parsedSummary.formulas.length > 0 && (
            <section className="space-y-5 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                II. Formulaire & Méthodologie de Calcul
              </h2>

              <div className="space-y-6">
                {parsedSummary.formulas.map((formula, fidx) => (
                  <div key={fidx} className="space-y-2.5 py-2 border-b border-stone-100 last:border-0">
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                      <span className="text-stone-600">{fidx + 1}.</span>
                      <MathText text={formula.name || `Relation fondamentale`} />
                    </h3>

                    {/* Formule mathématique centrée KaTeX directement dans la page */}
                    <div className="py-2.5 text-center overflow-x-auto text-lg sm:text-xl font-bold text-black my-1">
                      <MathText text={formula.latex.startsWith('$$') ? formula.latex : `$$ ${formula.latex} $$`} />
                    </div>

                    {/* Explications au fil de l'eau */}
                    <div className="space-y-1.5 text-sm sm:text-base text-stone-800 pl-4 border-l-2 border-stone-300">
                      {formula.variables && (
                        <p className="leading-relaxed">
                          <span className="font-semibold text-black">Signification des variables : </span>
                          <MathText text={formula.variables} />
                        </p>
                      )}
                      {formula.when_to_use && (
                        <p className="leading-relaxed">
                          <span className="font-semibold text-black">Quand l'utiliser : </span>
                          <MathText text={formula.when_to_use} />
                        </p>
                      )}
                      {formula.how_to_derive && (
                        <p className="leading-relaxed">
                          <span className="font-semibold text-black">Comment la retrouver / démontrer : </span>
                          <MathText text={formula.how_to_derive} />
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* III. Tableau Synthétique / Comparatif */}
          {parsedSummary.comparisonTable && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                III. Tableau Synthétique
              </h2>

              <div className="w-full overflow-x-auto my-3">
                <table className="w-full text-left border border-stone-300 text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-300 text-stone-900 font-extrabold">
                      {parsedSummary.comparisonTable.headers.map((h, hidx) => (
                        <th key={hidx} className="py-2.5 px-3.5 uppercase tracking-wide">
                          <MathText text={h} />
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
                          <td key={cidx} className="py-2.5 px-3.5 text-stone-900 font-medium leading-relaxed">
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

          {/* IV. Pièges à éviter & Remarques (NB) */}
          {parsedSummary.trapsAndTips.length > 0 && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                IV. Pièges à Éviter & Astuces Méthodologiques (NB)
              </h2>

              <div className="space-y-3.5">
                {parsedSummary.trapsAndTips.map((item, tidx) => {
                  const isTrap = item.type === 'trap' || /pi[èe]ge/i.test(item.title || '');
                  return (
                    <blockquote
                      key={tidx}
                      className={
                        isTrap
                          ? 'border-l-4 border-rose-500 bg-rose-50/60 pl-4 pr-3.5 py-3 rounded-r text-stone-950 my-2 text-sm sm:text-base leading-relaxed'
                          : 'border-l-4 border-emerald-500 bg-emerald-50/60 pl-4 pr-3.5 py-3 rounded-r text-stone-950 my-2 text-sm sm:text-base leading-relaxed'
                      }
                    >
                      <p className="font-extrabold text-black mb-1 flex items-center gap-1.5">
                        <span>{isTrap ? '🚨 PIÈGE CLASSIQUE :' : '💡 ASTUCE MÉTHODOLOGIQUE (NB) :'}</span>
                        {item.title && !/^(pi[èe]ge|astuce)/i.test(item.title) && (
                          <span className="font-bold text-stone-800">{item.title}</span>
                        )}
                      </p>
                      <div className="text-stone-900 font-medium">
                        <MathText text={item.content} />
                      </div>
                    </blockquote>
                  );
                })}
              </div>
            </section>
          )}

          {/* V. Exemple Pratique d'Application */}
          {parsedSummary.practicalExample && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black pb-2 border-b border-stone-200">
                V. Exemple Pratique d'Application
              </h2>

              <div className="space-y-3 pl-4 border-l-2 border-stone-300 py-1">
                <p className="text-base sm:text-lg text-stone-900 leading-relaxed">
                  <span className="font-bold text-black">Énoncé : </span>
                  <MathText text={parsedSummary.practicalExample.statement} />
                </p>

                <div className="space-y-2 pt-2">
                  <p className="font-bold text-black text-sm uppercase tracking-wide">
                    Résolution étape par étape :
                  </p>
                  <ol className="space-y-2 list-decimal list-inside text-stone-900 text-base sm:text-lg leading-relaxed pl-1">
                    {parsedSummary.practicalExample.resolution_steps.map((step, sidx) => (
                      <li key={sidx} className="pl-1">
                        <MathText text={step.replace(/^\s*\d+[\.\-\)]\s*/, '')} />
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
                    <MathText text={sec.heading.replace(/^\s*\d+[\.\-\)]\s*/, '') || sec.heading} />
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
                            <MathText text={pt} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* État vide si aucune donnée */}
          {!hasDynamicData && (
            <div
              id="resume-empty-card"
              className="w-full text-center py-16 space-y-4"
            >
              <FileText className="w-12 h-12 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-stone-800">
                  Fiche de Résumé
                </h3>
                <p className="text-stone-600 text-sm max-w-md mx-auto">
                  Demandez à l'IA de rédiger la synthèse complète du document. Elle sera structurée comme un véritable livre de cours.
                </p>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
