// ============================================================================
// STUDYCLOUD - NEURONE D'AGENT IA (CLOUDFLARE WORKERS AI + LLAMA 3.3 70B & 8B)
// ============================================================================
// Architecture : Worker Autonome Standalone (Zéro dépendance externe, Zéro build)
// Ce fichier est 100% PRÊT À ÊTRE COPIÉ ET COLLÉ DIRECTEMENT DANS CLOUDFLARE.
//
// 📋 COMMENT DÉPLOYER EN 30 SECONDES DANS CLOUDFLARE :
// 1. Rendez-vous sur votre Cloudflare Dashboard (dash.cloudflare.com)
// 2. Allez dans "Workers & Pages" > Sélectionnez votre Worker (ex: studycloud-ai ou studycloud-agent)
// 3. Cliquez sur "Edit code" (ou "Quick Edit")
// 4. Sélectionnez tout le code actuel (Ctrl+A) et supprimez-le
// 5. Copiez TOUT le contenu de ce fichier (Ctrl+A puis Ctrl+C)
// 6. Collez-le dans l'éditeur Cloudflare (Ctrl+V)
// 7. Cliquez en haut à droite sur "Save and Deploy" (Enregistrer et déployer)
//
// ⚙️ LIAISONS RECOMMANDÉES DANS CLOUDFLARE (Settings > Variables & Bindings) :
// - Workers AI : Liaison nommée "AI" (ou "MON-STUDYCLOUD-ia")
// - (Optionnel) Clé secrète "StudyCloud-gemini" pour le secours automatique
// ============================================================================

// Modèles Cloudflare Workers AI
const PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// En-têtes CORS universels
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-agent-id",
  "Access-Control-Max-Age": "86400",
};

/**
 * Nettoyeur et extracteur rigoureux de JSON produit par les modèles IA
 */
function extractAndSanitizeJson(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  // 1. Nettoyer les balises Markdown ```json ... ```
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. Extraire le premier bloc {...} ou [...] si du texte entoure le JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Réparer les caractères LaTeX fréquents dans les cours scientifiques
  const sanitized = cleaned
    .replace(/\\(frac|Omega|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|omega|times|div|approx|neq|le|ge|cdot|infty|sqrt)/g, "\\\\$1")
    .replace(/,\s*([}\]])/g, "$1") // supprime les virgules traînantes
    .replace(/[\x00-\x1F\x7F]/g, (char) => (char === "\n" || char === "\r" || char === "\t" ? char : ""));

  try {
    return JSON.parse(sanitized);
  } catch (_e) {
    try {
      return JSON.parse(cleaned);
    } catch (_e2) {
      return null;
    }
  }
}

/**
 * Moteur d'exécution universel pour Workers AI avec gestion automatique du fallback
 */
async function runWorkersAi(ai, messages, maxTokens = 3500) {
  if (!ai || typeof ai.run !== "function") {
    throw new Error("Liaison Workers AI non trouvée sur ce Worker Cloudflare. Veuillez lier 'AI' dans Settings > Bindings.");
  }

  try {
    const result = await ai.run(PRIMARY_MODEL, {
      messages,
      max_tokens: maxTokens,
    });
    const output = result?.response || result?.result?.response || (typeof result === "string" ? result : "");
    if (output && output.trim()) return output;
  } catch (err70b) {
    console.warn("[Agent Neurone] Erreur Llama 70B, bascule sur Llama 8B :", err70b?.message);
  }

  // Secours Llama 8B
  const fallbackResult = await ai.run(FALLBACK_MODEL, {
    messages,
    max_tokens: Math.min(maxTokens, 2500),
  });
  return fallbackResult?.response || fallbackResult?.result?.response || "";
}

/**
 * Secours Google Gemini si la clé est présente et que Workers AI est indisponible
 */
async function runGeminiFallback(apiKey, systemPrompt, userPrompt) {
  if (!apiKey || apiKey.length < 15) return null;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ],
      generationConfig: { maxOutputTokens: 3500 }
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/**
 * Générateur dédié des 12 modules d'apprentissage StudyCloud
 */
async function generateModule(env, params) {
  const ai = env?.AI || env?.["MON-STUDYCLOUD-ia"] || env?.MON_STUDYCLOUD_IA || env?.ai ||
    (env && typeof env === "object" ? Object.values(env).find(v => v && typeof v.run === "function") : null);

  const geminiKey = env?.["StudyCloud-gemini"] || env?.STUDYCLOUD_GEMINI || env?.GEMINI_API_KEY || "";

  const rawType = params.toolType || params.requested_type || params.type || "resume";
  const toolType = String(rawType).toLowerCase();
  const docName = params.docName || params.fileName || "Document de cours";
  const docContent = (params.docContent || params.fileContent || params.documentText || "").slice(0, 32000);
  const userPrompt = params.prompt || params.message || "";

  let typeLabel = "Résumé Pédagogique";
  let jsonInstructions = "";

  switch (toolType) {
    case "questionnaire":
    case "questionnaire-test":
      typeLabel = "Questionnaire QCM Interactif";
      jsonInstructions = `Générez un QCM d'excellence de 5 à 10 questions avec options et explications détaillées.
Format JSON STRICT attendu :
{
  "title": "QCM : Titre du cours",
  "questions": [
    {
      "id": "q1",
      "question": "Énoncé clair de la question ?",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
      "correctIndex": 0,
      "explanation": "Explication rigoureuse de la bonne réponse."
    }
  ]
}`;
      break;

    case "vrai-ou-faux":
    case "vrai-ou-faux-test":
      typeLabel = "Test Vrai ou Faux";
      jsonInstructions = `Générez 6 à 10 affirmations conceptuelles (avec pièges d'examen classiques) et explications.
Format JSON STRICT attendu :
{
  "title": "Vrai ou Faux : Titre du cours",
  "affirmations": [
    {
      "id": "v1",
      "statement": "Affirmation conceptuelle précise.",
      "isTrue": true,
      "explanation": "Justification théorique rigoureuse basée sur le cours."
    }
  ]
}`;
      break;

    case "carte-mentale":
    case "carte-mentale-2":
      typeLabel = "Carte Mentale Conceptuelle";
      jsonInstructions = `Générez une arborescence complète avec nœud racine, sous-branches et liste de branches.
Format JSON STRICT attendu :
{
  "title": "Carte Mentale : Titre du cours",
  "root_title": "${docName}",
  "root": {
    "id": "root-1",
    "title": "Concept Principal",
    "label": "Concept Principal",
    "notes": "Définition globale synthétique",
    "color": "#3b82f6",
    "children": [
      {
        "id": "branch-1",
        "title": "Sous-thème A",
        "label": "Sous-thème A",
        "notes": "Explication clé",
        "color": "#10b981",
        "children": [
          { "id": "sub-1-1", "title": "Détail 1", "label": "Détail 1", "notes": "Formule ou règle" }
        ]
      },
      {
        "id": "branch-2",
        "title": "Sous-thème B",
        "label": "Sous-thème B",
        "notes": "Applications concrètes",
        "color": "#f59e0b",
        "children": []
      }
    ]
  },
  "branches": [
    { "title": "Axe 1 : Fondements", "description": "Principes de base", "subBranches": ["Point A", "Point B"] },
    { "title": "Axe 2 : Applications", "description": "Mise en pratique", "subBranches": ["Cas 1", "Cas 2"] }
  ]
}`;
      break;

    case "carte-memoire":
    case "flashcards":
      typeLabel = "Cartes Mémoire (Flashcards)";
      jsonInstructions = `Générez 8 à 15 cartes mémoires mémorisables (style Anki/Leitner) pour ancrer les formules, théorèmes et définitions.
Format JSON STRICT attendu :
{
  "title": "Flashcards : Titre du cours",
  "cards": [
    {
      "id": "card-1",
      "front": "Question ou formule clé au recto ?",
      "back": "Définition ou formule exacte au verso",
      "tag": "Formule / Théorie",
      "definition": "Contexte d'application",
      "examples": ["Exemple concret 1"]
    }
  ],
  "flashcards": [
    { "id": "card-1", "front": "Question ou terme clé", "back": "Explication complète" }
  ]
}`;
      break;

    case "resume":
      typeLabel = "Fiche de Synthèse & Résumé";
      jsonInstructions = `Produisez un résumé académique d'excellence synthétisant la totalité du document.
Format JSON STRICT attendu :
{
  "title": "Fiche de Synthèse : Titre du cours",
  "overview": "Vue d'ensemble et problématique centrale (2 à 3 paragraphes denses).",
  "keyPoints": [
    "Point fondamental 1 avec explications",
    "Point fondamental 2 avec explications"
  ],
  "definitions": [
    { "term": "Terme technique", "definition": "Définition exacte" }
  ],
  "rules": [
    "Règle ou théorème 1",
    "Règle ou théorème 2"
  ],
  "sections": [
    { "section_title": "1. Notions Fondamentales", "content": "Développement complet du chapitre..." }
  ],
  "summary": {
    "content": "Résumé analytique global.",
    "sections": ["Section 1", "Section 2"]
  },
  "tags": ["Matière", "Niveau", "Chapitre"]
}`;
      break;

    case "infographie":
      typeLabel = "Infographie Visuelle Pédagogique";
      jsonInstructions = `Concevez une infographie textuelle enrichie de chiffres clés, métriques, concepts visuels et alertes.
Format JSON STRICT attendu :
{
  "title": "Infographie : Titre du cours",
  "mainTitle": "Titre Impactant",
  "subtitle": "Sous-titre descriptif",
  "metrics": [
    { "value": "100%", "label": "Rendement théorique", "color": "emerald" },
    { "value": "3", "label": "Piliers fondamentaux", "color": "blue" }
  ],
  "keyConcepts": [
    { "title": "Concept 1", "desc": "Explication percutante en 2 lignes.", "badge": "Important" }
  ],
  "highlights": [
    { "type": "tip", "title": "Astuce d'Examen", "text": "Conseil méthodologique pour réussir les épreuves." },
    { "type": "warning", "title": "Erreur Fréquente", "text": "Le piège classique à éviter absolument." }
  ],
  "steps": [
    { "title": "Étape 1", "description": "Phase préparatoire" }
  ]
}`;
      break;

    case "exercices-ecrits":
      typeLabel = "Exercices d'Application & Problèmes";
      jsonInstructions = `Concevez 3 à 5 exercices d'application graduelle (Facile, Moyen, Avancé) avec corrigés détaillés et étapes de calculs.
Format JSON STRICT attendu :
{
  "title": "Exercices Écrits : Titre du cours",
  "exercises": [
    {
      "id": "ex-1",
      "title": "Exercice 1 : Application directe",
      "difficulty": "Facile",
      "statement": "Énoncé complet du problème avec données numériques ou textuelles.",
      "sampleAnswer": "Correction détaillée pas à pas avec formules et résultats numériques.",
      "tips": ["Conseil pour démarrer", "Vérification dimensionnelle"]
    }
  ]
}`;
      break;

    case "devoir-complet":
      typeLabel = "Sujet d'Examen Complet & Barème";
      jsonInstructions = `Concevez une épreuve d'examen complète type partiel universitaire avec barème sur 20 points et corrigé type officiel.
Format JSON STRICT attendu :
{
  "title": "Devoir d'Évaluation : Titre du cours",
  "duration": "2 Heures",
  "totalPoints": 20,
  "instructions": [
    "Calculatrice autorisée",
    "Justifier rigoureusement toutes vos réponses"
  ],
  "parties": [
    {
      "partNumber": 1,
      "title": "Partie 1 : Questions de Cours & Théorie",
      "points": 8,
      "questions": [
        {
          "id": "q1-1",
          "number": 1,
          "points": 4,
          "question": "Énoncé précis de la question ?",
          "keywords": ["mot-clé 1", "formule"],
          "sampleAnswer": "Réponse idéale attendue par le correcteur.",
          "hint": "Indice pour l'étudiant"
        }
      ]
    },
    {
      "partNumber": 2,
      "title": "Partie 2 : Problème d'Ingénierie / Étude de Cas",
      "points": 12,
      "questions": [
        {
          "id": "q2-1",
          "number": 1,
          "points": 6,
          "question": "Énoncé de l'analyse ou du calcul complexe ?",
          "keywords": ["démonstration", "calcul"],
          "sampleAnswer": "Développement analytique complet.",
          "hint": "Méthode recommandée"
        }
      ]
    }
  ],
  "sections": [
    {
      "title": "Partie 1 : Questions de Cours & Théorie",
      "points": 8,
      "questions": [
        {
          "id": "q1-1",
          "number": 1,
          "points": 4,
          "question": "Énoncé précis de la question ?",
          "sampleAnswer": "Réponse idéale attendue."
        }
      ]
    }
  ],
  "complete_exam": {
    "title": "Devoir d'Évaluation : Titre du cours",
    "duration": "2h00",
    "sections": [
      {
        "title": "Partie 1 : Questions de Cours & Théorie",
        "points": 8,
        "questions": [
          { "id": "q1-1", "question": "Question de cours ?", "points": 4, "sampleAnswer": "Réponse type." }
        ]
      }
    ]
  }
}`;
      break;

    default: // pdf / cours / document
      typeLabel = "Document de Cours Magistral";
      jsonInstructions = `Structurez un fascicule de cours complet divisé en chapitres et sections.
Format JSON STRICT attendu :
{
  "title": "Fascicule : Titre du cours",
  "subtitle": "Polycopié d'étude",
  "subject": "Discipline académique",
  "academicLevel": "Enseignement Supérieur",
  "chapters": [
    { "heading": "1. Introduction et Principes", "content": "Contenu exhaustif du premier chapitre..." }
  ],
  "sections": [
    {
      "heading": "Chapitre 1 : Introduction et Fondements",
      "body": "Développement théorique détaillé et soigné...",
      "bulletPoints": ["Point clé A", "Point clé B"],
      "highlightBox": "Formule clé ou encadré récapitulatif"
    }
  ]
}`;
      break;
  }

  const systemPrompt = `Vous êtes le Cerveau Neuronal et Moteur d'Ingénierie Pédagogique officiel de StudyCloud.
Votre mission : examiner le document de cours fourni et générer un module d'apprentissage haute fidélité "${typeLabel}".
Vous DEVEZ répondre STRICTEMENT avec un objet JSON valide, sans texte d'introduction ni bavardage, conforme au schéma demandé.

${jsonInstructions}`;

  const promptContent = `DOCUMENT SOURCE : ${docName}
CONTENU DU COURS :
"""
${docContent || "Cours théorique sur " + docName}
"""

INSTRUCTIONS SPÉCIFIQUES :
${userPrompt || "Génère un module pédagogique complet, rigoureux et directement exploitable pour les révisions."}`;

  let rawOutput = "";
  if (ai) {
    try {
      rawOutput = await runWorkersAi(ai, [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptContent }
      ], 3500);
    } catch (aiErr) {
      console.warn("[Agent] Échec Workers AI, tentative Gemini :", aiErr?.message);
    }
  }

  if (!rawOutput && geminiKey) {
    rawOutput = (await runGeminiFallback(geminiKey, systemPrompt, promptContent)) || "";
  }

  const parsedData = extractAndSanitizeJson(rawOutput);

  if (!parsedData) {
    throw new Error("Le modèle IA n'a pas pu formater une réponse JSON valide. Veuillez réessayer.");
  }

  // Garantir compatibilité carte-mentale
  if (toolType.includes("carte-mentale") && !parsedData.branches && parsedData.root?.children) {
    parsedData.branches = parsedData.root.children.map((c) => ({
      title: c.title || c.label || "Sous-thème",
      description: c.notes || "",
      subBranches: (c.children || []).map((sc) => sc.title || sc.label || "")
    }));
  }

  // Garantir compatibilité devoir-complet
  if (toolType.includes("devoir") && !parsedData.sections && parsedData.parties) {
    parsedData.sections = parsedData.parties;
  }

  const finalTitle = parsedData.title || `${typeLabel} - ${docName.replace(/\.[^/.]+$/, "")}`;

  return {
    success: true,
    creation_type: toolType,
    creation_title: finalTitle,
    creation_data: parsedData,
    rawText: rawOutput,
    model: PRIMARY_MODEL,
  };
}

/**
 * Audit et analyse de document
 */
async function analyzeDocument(env, params) {
  const ai = env?.AI || env?.["MON-STUDYCLOUD-ia"] || env?.MON_STUDYCLOUD_IA || env?.ai;
  const docName = params.docName || "Document";
  const docContent = (params.docContent || "").slice(0, 24000);

  const prompt = `Analysez ce cours "${docName}" et produisez un audit pédagogique JSON au format suivant :
{
  "documentTitle": "Titre clair",
  "domain": "Domaine (ex: Électronique, Droit, Mathématiques)",
  "academicLevel": "Niveau recommandé (L1, L2, L3, M1, etc.)",
  "summary": "Résumé concis en 3 phrases.",
  "keyTopics": ["Thème 1", "Thème 2", "Thème 3"],
  "prerequisites": ["Prérequis 1", "Prérequis 2"],
  "recommendedModules": ["questionnaire", "carte-mentale", "devoir-complet"]
}

CONTENU :
${docContent}`;

  let raw = "";
  if (ai) {
    raw = await runWorkersAi(ai, [
      { role: "system", content: "Vous êtes un auditeur pédagogique universitaire. Répondez strictement en JSON." },
      { role: "user", content: prompt }
    ], 1500);
  }

  const parsed = extractAndSanitizeJson(raw) || {
    documentTitle: docName,
    summary: raw.slice(0, 300) || "Document analysé.",
    keyTopics: [],
    recommendedModules: ["resume", "questionnaire", "carte-mentale"]
  };

  return { success: true, analysis: parsed };
}

/**
 * Discussion interactive avec Delmas IA
 */
async function chatWithDelmas(env, params) {
  const ai = env?.AI || env?.["MON-STUDYCLOUD-ia"] || env?.MON_STUDYCLOUD_IA || env?.ai;
  const geminiKey = env?.["StudyCloud-gemini"] || env?.STUDYCLOUD_GEMINI || env?.GEMINI_API_KEY || "";

  const message = params.message || params.prompt || "Bonjour !";
  const history = Array.isArray(params.history) ? params.history : [];
  const docText = params.attachedFileContent || params.documentText || params.fileContent || "";

  const system = `Vous êtes Delmas IA, le tuteur d'étude universitaire et l'assistant officiel de StudyCloud (DKD Technologies).
Vous aidez l'étudiant à comprendre en profondeur son cours avec clarté, bienveillance et rigueur.
Formatez toujours vos réponses en Markdown structuré avec des puces claires et utilisez LaTeX pour les formules ($...$).
${docText ? `\nDOCUMENT FOURNI PAR L'ÉTUDIANT :\n"""\n${docText.slice(0, 15000)}\n"""` : ""}`;

  const messages = [
    { role: "system", content: system },
    ...history.map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: h.content })),
    { role: "user", content: message }
  ];

  let reply = "";
  if (ai) {
    try {
      reply = await runWorkersAi(ai, messages, 2000);
    } catch (err) {
      console.warn("[Delmas Chat] Erreur Workers AI :", err?.message);
    }
  }

  if (!reply && geminiKey) {
    reply = (await runGeminiFallback(geminiKey, system, message)) || "";
  }

  if (!reply) {
    reply = "Bonjour ! Je suis Delmas IA, votre assistant StudyCloud. Posez-moi vos questions sur vos cours ou révisions.";
  }

  return {
    success: true,
    response: reply,
    chat_response: reply,
    text: reply,
    model: "Delmas IA (Cloudflare Neurone 70B)"
  };
}

// ============================================================================
// GESTIONNAIRE PRINCIPAL DES REQUÊTES HTTP (Export Cloudflare Worker)
// ============================================================================
export default {
  async fetch(request, env, ctx) {
    // 1. Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 2. Health check
    if (path === "/" && request.method === "GET" || path === "/health" || path === "/api/ai/health") {
      const hasAi = Boolean(env?.AI || env?.["MON-STUDYCLOUD-ia"] || env?.ai);
      return new Response(
        JSON.stringify({
          service: "StudyCloud Neurone Agent IA",
          status: "healthy",
          architecture: "Cloudflare Standalone Neurone (Llama 3.3 70B & 8B)",
          workers_ai_connected: hasAi,
          primary_model: PRIMARY_MODEL,
          fallback_model: FALLBACK_MODEL,
          modules_count: 12,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Création de modules pédagogiques (/api/ai/creation & /api/ai/generate)
    if ((path === "/api/ai/creation" || path === "/api/ai/generate") && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const creation = await generateModule(env, body);
        return new Response(JSON.stringify(creation), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err?.message || "Erreur de génération du module pédagogique" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // 4. Analyse de document (/api/ai/analyze)
    if (path === "/api/ai/analyze" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const result = await analyzeDocument(env, body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err?.message || "Erreur d'analyse" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // 5. Chat avec Delmas IA (/api/ai/chat & /api/ai/delmas-chat & POST /)
    if ((path === "/api/ai/chat" || path === "/api/ai/delmas-chat" || path === "/") && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));

        // Si le POST demande une création directe (compatibilité anciens appels)
        if (body.isDirectCreation || body.toolType || body.requested_type) {
          const creation = await generateModule(env, body);
          return new Response(JSON.stringify(creation), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          });
        }

        const chatResult = await chatWithDelmas(env, body);
        return new Response(JSON.stringify(chatResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err?.message || "Erreur de discussion" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // 6. Espace de travail / Workspace StudyCloud
    if (path === "/api/ai/workspace") {
      return new Response(
        JSON.stringify({ success: true, data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "/api/ai/workspace/reaction" || path === "/api/ai/workspace/attachment") {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Route 404 par défaut
    return new Response(
      JSON.stringify({ error: `Route non trouvée sur StudyCloud Agent (${path})` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};
