import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, FileText, Clock, BookOpen, BrainCircuit, Calendar, Layers, Lightbulb, CheckCircle2 } from 'lucide-react';

const DEFAULT_FULL_TEXT = `DOCUMENT DE SYNTHÈSE
MÉTHODES COGNITIVES D'EXCELLENCE & STRATÉGIES D'APPRENTISSAGE
Temps de lecture : ~ 4 min | Référence méthodologique

=======================================================
1. LE RAPPEL ACTIF (ACTIVE RECALL)
=======================================================
Le cerveau humain retient très peu d'informations lors d'une relecture passive. La rétention durable s'active exclusivement lors de la tentative volontaire d'extraction d'une information depuis la mémoire à long terme vers la mémoire de travail.

• Le piège classique : Relire ses cours, surligner des pages entières ou regarder passivement des vidéos crée une forte « illusion de compétence » (familiarité superficielle prise à tort pour de la maîtrise).
• Protocoles pratiques d'application :
  - La méthode de la feuille blanche : Après avoir étudié une section, fermer tout support et noter de mémoire tous les concepts clés, formules et liens logiques.
  - L'auto-questionnement continu : Transformer chaque titre ou paragraphe en question et y répondre sans regarder le texte.
  - L'explicitation à voix haute : Expliquer le mécanisme à un auditeur imaginaire avec ses propres termes.

=======================================================
2. LA RÉPÉTITION ESPACÉE (SPACED REPETITION)
=======================================================
Découverte par Hermann Ebbinghaus, la « courbe de l'oubli » montre que plus de 50 % des détails sont oubliés dans les 24 heures suivant la première exposition si aucune réactivation consciente n'a lieu.

• Principe fondamental : Chaque réactivation au moment précis où le souvenir commence à s'estomper aplatit la courbe de l'oubli et prolonge considérablement la durée de mémorisation.
• Cadence recommandée des sessions :
  - Session 1 : J + 1 jour (consolidation immédiate)
  - Session 2 : J + 3 jours (stabilisation du tracé mnésique)
  - Session 3 : J + 7 jours (ancrage à moyen terme)
  - Session 4 : J + 21 jours (intégration durable)
  - Session 5 : J + 60 jours (maîtrise définitive)
• Outils recommandés : Flashcards physiques (système de Leitner) ou outils numériques à algorithme d'espacement.

=======================================================
3. L'ENTRELACEMENT THÉMATIQUE (INTERLEAVING)
=======================================================
Travailler un seul thème en bloc répétitif (ex. 3 heures d'une seule formule) donne une fausse sensation de rapidité mais nuit au discernement en situation d'examen réel.

• Pourquoi alterner : L'entrelacement force le cerveau à catégoriser le problème et à sélectionner la stratégie appropriée plutôt que d'appliquer machinalement la même recette.
• Application concrète :
  - Découper une session de 2 heures en 3 blocs distincts (ex. 40 min Analyse, 40 min Algèbre, 40 min Cas pratique).
  - Mélanger aléatoirement les types d'exercices au sein d'une même séance d'entraînement.

=======================================================
4. L'ÉLABORATION & LA TECHNIQUE FEYNMAN
=======================================================
Comprendre en profondeur, c'est être capable de simplifier à l'extrême sans dénaturer la rigueur.

• Règle de l'explication simple : Si vous ne pouvez pas expliquer un concept en termes simples à un novice de 12 ans, vous ne le maîtrisez pas encore pleinement.
• Les 4 étapes de la technique Feynman :
  1. Choisir le concept cible.
  2. L'enseigner par écrit ou oralement avec un vocabulaire accessible, des analogies et des exemples du quotidien.
  3. Identifier précisément les zones de friction, les hésitations ou le jargon technique non vulgarisé.
  4. Retourner aux sources pour combler ces lacunes et simplifier à nouveau.

=======================================================
5. LE DOUBLE CODAGE (DUAL CODING)
=======================================================
Le cerveau traite et stocke l'information via deux canaux complémentaires : le canal verbal (mots, descriptions) et le canal visuel (schémas, cartes mentales, spatialisation).

• Synergie cognitive : Associer systématiquement une représentation visuelle synthétique à une explication textuelle double les points d'ancrage mnésiques.
• Mise en œuvre : Schémas fléchés, cartes conceptuelles ordonnées, diagrammes de flux et tableaux comparatifs synthétiques.

=======================================================
6. CONCLUSION OPÉRATIONNELLE : LA DIFFICULTÉ DÉSIRABLE
=======================================================
Théorisée par le Pr. Robert Bjork, la règle d'or de l'apprentissage est la suivante :
« Si la session de travail vous semble fluide, facile et sans effort, l'apprentissage réel est minime. C'est l'effort mesuré fourni pour chercher, relier et extraire l'information qui crée un ancrage neuronal durable. »
`;

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

  const docTitle = data?.title || title || (sourceFileName ? `Fiche de synthèse : ${sourceFileName}` : 'Méthodes Cognitives d’Excellence');
  const docSubtitle = data?.overview || data?.summary || data?.description || (hasDynamicData ? 'Synthèse structurée et didactique des points clés de ce cours.' : 'Synthèse structurée des principes scientifiques de l\'apprentissage durable et des protocoles d\'ancrage mnésique rapide.');

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
    if (!hasDynamicData) return DEFAULT_FULL_TEXT;
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
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Synthese_Methodes_Cognitives.txt';
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

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-950 tracking-tight leading-tight">
            {docTitle}
          </h1>
          <p className="text-stone-600 text-sm sm:text-base leading-relaxed max-w-3xl">
            {docSubtitle}
          </p>
        </header>

        {/* Dynamic Key Points if available */}
        {dynamicKeyPoints.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" /> Points clés essentiels
            </h3>
            <ul className="space-y-1.5 text-sm text-stone-800">
              {dynamicKeyPoints.map((kp, kidx) => (
                <li key={kidx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasDynamicData && dynamicSections.length > 0 ? (
          dynamicSections.map((sec, sidx) => (
            <React.Fragment key={sidx}>
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {sec.number || sidx + 1}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                    {sec.heading}
                  </h2>
                </div>
                <p className="text-stone-800 leading-relaxed text-base sm:text-lg whitespace-pre-line">
                  {sec.body}
                </p>
                {sec.points && sec.points.length > 0 && (
                  <div className="space-y-2 text-stone-700 text-sm sm:text-base leading-relaxed pl-2 border-l-2 border-stone-300">
                    <p className="font-semibold text-stone-900">{sec.protocolTitle}</p>
                    <ul className="space-y-2 list-none">
                      {sec.points.map((pt: string, pidx: number) => (
                        <li key={pidx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-stone-600 shrink-0 mt-1" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              {sidx < dynamicSections.length - 1 && <hr className="border-stone-200" />}
            </React.Fragment>
          ))
        ) : (
          <>
            {/* Section 1 : Rappel Actif */}
            <section id="section-rappel-actif" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              1
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Le Rappel Actif (Active Recall)
            </h2>
          </div>

          <p className="text-stone-800 leading-relaxed text-base sm:text-lg">
            Le cerveau retient très peu d'informations lors d'une relecture passive. La rétention s’active véritablement lors de la <strong className="font-semibold text-stone-950 underline decoration-amber-400 decoration-2 underline-offset-2">tentative volontaire d’extraction</strong> d’une information depuis la mémoire.
          </p>

          <div className="space-y-2 text-stone-700 text-sm sm:text-base leading-relaxed pl-2 border-l-2 border-stone-300">
            <p className="font-semibold text-stone-900">Protocoles recommandés à chaque séance :</p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-600 shrink-0 mt-1" />
                <span><strong>La méthode de la page blanche :</strong> À la fin d’un chapitre, refermez le cours et notez tout ce dont vous vous souvenez sans aide.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-600 shrink-0 mt-1" />
                <span><strong>L'auto-interrogation :</strong> Transformez vos titres de cours en questions ciblées et répondez-y avant de vérifier la réponse.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-600 shrink-0 mt-1" />
                <span><strong>La reformulation orale :</strong> Explicitez le concept à voix haute avec vos propres mots sans lire vos notes.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-stone-200" />

        {/* Section 2 : Répétition Espacée */}
        <section id="section-repetition-espacee" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              2
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              La Répétition Espacée (Spaced Repetition)
            </h2>
          </div>

          <p className="text-stone-800 leading-relaxed text-base sm:text-lg">
            La courbe de l’oubli démontre que <strong className="font-semibold text-stone-950 underline decoration-amber-400 decoration-2 underline-offset-2">plus de 50 % des détails sont égarés après 24 heures</strong> sans rappel conscient. Chaque révision espacée renforce et stabilise le chemin synaptique.
          </p>

          {/* Cadence Steps on page background */}
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Cadence optimale des intervalles de révision
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-stone-100/80 rounded-xl border border-stone-200 text-center">
                <span className="text-xs font-medium text-stone-500 block">Session 1</span>
                <span className="text-base font-extrabold text-stone-900">J + 1 jour</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">Consolidation</span>
              </div>
              <div className="p-3.5 bg-stone-100/80 rounded-xl border border-stone-200 text-center">
                <span className="text-xs font-medium text-stone-500 block">Session 2</span>
                <span className="text-base font-extrabold text-stone-900">J + 3 jours</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">Stabilisation</span>
              </div>
              <div className="p-3.5 bg-stone-100/80 rounded-xl border border-stone-200 text-center">
                <span className="text-xs font-medium text-stone-500 block">Session 3</span>
                <span className="text-base font-extrabold text-stone-900">J + 7 jours</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">Moyen terme</span>
              </div>
              <div className="p-3.5 bg-stone-100/80 rounded-xl border border-stone-200 text-center">
                <span className="text-xs font-medium text-stone-500 block">Session 4</span>
                <span className="text-base font-extrabold text-stone-900">J + 30 jours</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">Ancrage durable</span>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-stone-200" />

        {/* Section 3 : L'Entrelacement */}
        <section id="section-entrelacement" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              3
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              L’Entrelacement (Interleaving)
            </h2>
          </div>

          <p className="text-stone-800 leading-relaxed text-base sm:text-lg">
            Alterner différentes sous-matières ou types de problèmes durant un même bloc de travail oblige le cerveau à <strong className="font-semibold text-stone-950 underline decoration-amber-400 decoration-2 underline-offset-2">catégoriser et sélectionner la bonne stratégie</strong> plutôt que d’exécuter mécaniquement la même routine.
          </p>

          <div className="space-y-2 text-stone-700 text-sm sm:text-base leading-relaxed pl-2 border-l-2 border-stone-300">
            <p className="font-semibold text-stone-900">Application pratique :</p>
            <p>
              Plutôt que de faire 20 exercices du même type d'affilée, mixez 5 exercices du chapitre A, 5 du chapitre B et 5 du chapitre C. Cela améliore nettement les performances lors des examens finaux.
            </p>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-stone-200" />

        {/* Section 4 : La Méthode Feynman */}
        <section id="section-feynman" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              4
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              La Technique Feynman & Vulgarisation
            </h2>
          </div>

          <p className="text-stone-800 leading-relaxed text-base sm:text-lg">
            La véritable maîtrise se manifeste par la capacité d'expliquer une notion complexe en termes simples et limpides.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 bg-stone-100/70 rounded-xl border border-stone-200/80">
              <span className="text-xs font-bold text-stone-900 block mb-1">Étape A : Choix du sujet</span>
              <p className="text-xs sm:text-sm text-stone-600">Sélectionnez le concept exact et écrivez son nom en tête de page.</p>
            </div>
            <div className="p-4 bg-stone-100/70 rounded-xl border border-stone-200/80">
              <span className="text-xs font-bold text-stone-900 block mb-1">Étape B : Explication simple</span>
              <p className="text-xs sm:text-sm text-stone-600">Expliquez-le comme si vous vous adressiez à un débutant complet.</p>
            </div>
            <div className="p-4 bg-stone-100/70 rounded-xl border border-stone-200/80">
              <span className="text-xs font-bold text-stone-900 block mb-1">Étape C : Repérage des blocages</span>
              <p className="text-xs sm:text-sm text-stone-600">Identifiez immédiatement où vous hésitez ou recourez au jargon.</p>
            </div>
            <div className="p-4 bg-stone-100/70 rounded-xl border border-stone-200/80">
              <span className="text-xs font-bold text-stone-900 block mb-1">Étape D : Révision et synthèse</span>
              <p className="text-xs sm:text-sm text-stone-600">Revenez aux supports pour clarifier les points flous et simplifier.</p>
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-stone-200" />

        {/* Section 5 : Conclusion Opérationnelle */}
        <section id="section-conclusion-operationnelle" className="space-y-4 pt-2">
          <div className="p-6 rounded-2xl bg-stone-900 text-stone-100 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-wider uppercase">
              <Lightbulb className="w-4 h-4" />
              <span>Principe clé à retenir : La difficulté désirable</span>
            </div>
            <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
              « Si une révision semble trop facile, fluide et sans effort, la trace cérébrale sera minimale. L’effort fourni pour chercher, relier et extraire l’information est le véritable moteur de l’apprentissage durable. »
            </p>
            <p className="text-xs text-stone-400 pt-1">
              — D'après les travaux du Pr. Robert Bjork sur les conditions d'apprentissage optimales.
            </p>
          </div>
        </section>
        </>
        )}
      </article>
    </div>
  );
}
