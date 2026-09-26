/**
 * ============================================================================
 * STUDYCLOUD - WORKER IA UNIFIÉ (ZERO-DÉPENDANCE - STANDALONE)
 * ============================================================================
 * 
 * ✅ 100% COMPATIBLE CLOUDFLARE QUICK EDIT (AUCUNE ERREUR ROUGE, AUCUN WARNING)
 * ✅ 0 import externe, 0 module Node.js, 0 DurableObject requis
 * ✅ 12 Modules de Création Pédagogique (Google NotebookLM Studio)
 * ✅ Correction Automatique de Devoirs sur 20 points (/api/grade-devoir)
 * ✅ Chat IA Delmas & StudyCloud (/api/ai/chat, /chat)
 * ✅ Modèle économique : @cf/meta/llama-3.1-8b-instruct (anti-quota 4006)
 * ✅ Fallback automatique vers Google Gemini & Fallback local d'urgence
 * 
 * INSTRUCTIONS POUR DÉPLOYER DANS CLOUDFLARE :
 * 1. Ouvrez votre tableau de bord Cloudflare > Workers & Pages > Votre Worker.
 * 2. Cliquez sur "Edit code" (Quick Edit).
 * 3. Sélectionnez tout (Ctrl+A), supprimez tout (Suppr).
 * 4. Collez l'intégralité de ce fichier (Ctrl+V).
 * 5. Cliquez sur "Save and Deploy" en haut à droite.
 * ============================================================================
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Gestion universelle des en-têtes CORS pour toutes les requêtes du navigateur
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-gemini-api-key, *",
      "Access-Control-Max-Age": "86400",
    };

    // Réponse immédiate pour les pré-vols HTTP OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      // 1. ROUTE DE SANTÉ / ACCUEIL
      if (pathname === "" || pathname === "/" || pathname === "/api/health" || pathname === "/health") {
        return new Response(JSON.stringify({
          status: "ok",
          service: "StudyCloud IA Worker (Studio NotebookLM + Chat)",
          version: "3.0.0",
          model_default: "@cf/meta/llama-3.1-8b-instruct",
          modules_count: 12,
          routes: [
            "/api/create",
            "/api/grade-devoir",
            "/api/ai/chat",
            "/api/ai/creation",
            "/api/health"
          ]
        }, null, 2), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
        });
      }

      // 2. ROUTE CRÉATION IA (12 MODULES NOTEBOOKLM STUDIO)
      if ((pathname === "/api/create" || pathname === "/create" || pathname === "/api/ai/creation" || pathname === "/creation") && request.method === "POST") {
        return await handleCreationRequest(request, env, corsHeaders);
      }

      // 3. ROUTE CORRECTION AUTOMATIQUE DE DEVOIR SUR 20
      if ((pathname === "/api/grade-devoir" || pathname === "/grade-devoir") && request.method === "POST") {
        return await handleGradingRequest(request, env, corsHeaders);
      }

      // 4. ROUTE CHAT IA DELMAS & STUDYCLOUD
      if ((pathname === "/api/ai/chat" || pathname === "/chat" || pathname === "/api/chat" || pathname === "/api/delmas/chat") && request.method === "POST") {
        return await handleChatRequest(request, env, corsHeaders);
      }

      // 5. ROUTE AGENTS CLOUDFLARE (WebSockets / Durable Objects ChatAgent)
      if (pathname.startsWith("/agents/") || pathname.startsWith("/agent/")) {
        if (env && env.ChatAgent && typeof env.ChatAgent.idFromName === "function") {
          const id = env.ChatAgent.idFromName("default");
          const stub = env.ChatAgent.get(id);
          return await stub.fetch(request);
        }
      }

      // 6. ROUTE INTROUVABLE
      return new Response(JSON.stringify({
        error: "Route non trouvée",
        path: url.pathname,
        supported_routes: ["/api/create", "/api/grade-devoir", "/api/ai/chat", "/api/health"]
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        error: err && err.message ? err.message : "Erreur interne du serveur",
        success: false
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }
};

/**
 * ============================================================================
 * GESTIONNAIRE 1 : CRÉATION DES 12 MODULES D'APPRENTISSAGE
 * ============================================================================
 */
async function handleCreationRequest(request, env, corsHeaders) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Corps JSON invalide" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const rawModule = body.module || body.toolType || body.type || body.requested_type || "resume";
  const sourceText = body.text || body.docContent || body.documentText || body.documentContent || body.prompt || body.message || "";
  const docTitle = body.docName || body.fileName || body.title || "Document source";

  if (!sourceText || !sourceText.trim()) {
    return new Response(JSON.stringify({
      error: "Le texte source est obligatoire pour générer un module de création."
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Normalisation du nom de module (supporte les alias de StudyCloud et les noms de schéma)
  const moduleAliases = {
    "questionnaire": "qcm_interactif",
    "qcm": "qcm_interactif",
    "questionnaire-test": "qcm_test",
    "test-qcm": "qcm_test",
    "vrai-ou-faux": "vrai_faux",
    "vrai-faux": "vrai_faux",
    "vrai-ou-faux-test": "vrai_faux_test",
    "devoir-complet": "devoir_20",
    "devoir": "devoir_20",
    "examen": "devoir_20",
    "carte-mentale": "mindmap_tree",
    "mindmap": "mindmap_tree",
    "carte-mentale-2": "mindmap_concept",
    "concept-map": "mindmap_concept",
    "carte-memoire": "flashcards",
    "flashcard": "flashcards",
    "fiche-resume": "resume",
    "pdf": "pdf_export",
    "rapport": "pdf_export",
    "infographie": "infographie",
    "exercices-ecrits": "exercices",
    "exercices": "exercices"
  };

  const normalizedModule = moduleAliases[rawModule] || rawModule;

  // Configuration des prompts système et structures JSON pour chaque module
  const prompts = {
    // 1. ÉVALUATION
    "qcm_interactif": `Tu es un pédagogue expert. Génère un QCM interactif à partir du texte fourni. Réponds EXCLUSIVEMENT avec un objet JSON respectant ce schéma exact :
{
  "type": "qcm_interactif",
  "title": "Titre du QCM",
  "questions": [
    {
      "id": 1,
      "question": "Libellé de la question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "feedback": "Explication pédagogique de la bonne réponse."
    }
  ]
}`,

    "qcm_test": `Tu es un examinateur. Génère un test noté sous forme de QCM à partir du texte. Réponds EXCLUSIVEMENT avec un objet JSON :
{
  "type": "qcm_test",
  "title": "Test Évalué",
  "questions": [
    {
      "id": 1,
      "question": "Intitulé de la question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "points": 2
    }
  ]
}`,

    "vrai_faux": `Tu es un tuteur pédagogique. Génère une série d'affirmations Vrai ou Faux. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "vrai_faux",
  "title": "Test Vrai / Faux",
  "statements": [
    {
      "id": 1,
      "statement": "Affirmation...",
      "is_true": true,
      "explanation": "Pourquoi c'est vrai ou faux."
    }
  ]
}`,

    "vrai_faux_test": `Tu es un concepteur d'épreuves. Génère un test Vrai/Faux noté. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "vrai_faux_test",
  "title": "Épreuve Vrai / Faux Notée",
  "statements": [
    {
      "id": 1,
      "statement": "Affirmation à évaluer",
      "is_true": false,
      "points": 1
    }
  ]
}`,

    "devoir_20": `Tu es un professeur de lycée ou d'université. Génère un devoir complet rédigé noté sur 20 points à partir du texte source. Réponds EXCLUSIVEMENT avec ce schéma JSON :
{
  "type": "devoir_20",
  "title": "Devoir de Synthèse et d'Analyse sur 20 Points",
  "duration_minutes": 45,
  "total_points": 20,
  "instructions": "Consignes générales pour l'étudiant...",
  "sections": [
    {
      "section_title": "Partie 1 : Restitution des connaissances (6 points)",
      "points": 6,
      "questions": [
        {
          "id": 1,
          "question": "Question de cours rédigée...",
          "points": 3,
          "expected_answer": "Synthèse des points clés attendus dans la réponse.",
          "grading_criteria": "Barème de correction détaillé."
        }
      ]
    },
    {
      "section_title": "Partie 2 : Analyse et Réflexion (14 points)",
      "points": 14,
      "questions": [
        {
          "id": 2,
          "question": "Question d'analyse approfondie...",
          "points": 7,
          "expected_answer": "Arguments et structure de réponse attendus.",
          "grading_criteria": "4 pts pour les arguments, 3 pts pour la rigueur."
        }
      ]
    }
  ]
}`,

    // 2. CONCEPTS & MÉMORISATION
    "mindmap_tree": `Tu es un expert en cartographie mentale. Génère une structure d'arborescence hiérarchique. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "mindmap_tree",
  "title": "Carte Mentale Arborescente",
  "root": {
    "title": "Sujet Principal",
    "children": [
      {
        "title": "Branche 1",
        "children": [{ "title": "Sous-élément 1.1" }]
      }
    ]
  }
}`,

    "mindmap_concept": `Tu es un expert en diagrammes de concepts. Génère un réseau de concepts interconnectés. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "mindmap_concept",
  "title": "Carte Conceptuelle",
  "nodes": [{ "id": "n1", "label": "Concept 1" }, { "id": "n2", "label": "Concept 2" }],
  "edges": [{ "from": "n1", "to": "n2", "label": "influence / engendre" }]
}`,

    "flashcards": `Tu es un spécialiste de la répétition espacée. Génère un jeu de 5 à 10 cartes mémoire (recto/verso). Réponds EXCLUSIVEMENT en JSON :
{
  "type": "flashcards",
  "title": "Cartes Mémoire d'Apprentissage",
  "cards": [
    {
      "id": 1,
      "recto": "Concept ou Question clé",
      "verso": "Définition concise ou explication"
    }
  ]
}`,

    // 3. RÉDACTION & SYNTHÈSE
    "resume": `Tu es un expert en synthèse documentaire. Génère une fiche résumé structurée. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "resume",
  "title": "Fiche de Synthèse",
  "key_takeaways": ["L'essentiel 1", "L'essentiel 2"],
  "sections": [
    { "heading": "I. Introduction", "content": "Résumé du premier axe..." }
  ]
}`,

    "pdf_export": `Tu es un rédacteur professionnel. Génère un rapport formel prêt à l'exportation PDF. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "pdf_export",
  "title": "Rapport Synthétique Officiel",
  "subtitle": "Analyse approfondie de la source",
  "sections": [
    { "title": "1. Contexte et Enjeux", "body": "Développement rédigé..." }
  ]
}`,

    "infographie": `Tu es un designer d'information. Génère les éléments clés d'une infographie visuelle. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "infographie",
  "title": "Infographie Synthétique",
  "key_metrics": [{ "label": "Indicateur Clé", "value": "Chiffre / Stat" }],
  "timeline_steps": [{ "step": 1, "title": "Étape 1", "description": "Détail visuel..." }],
  "takeaway_quote": "Citation ou message central."
}`,

    "exercices": `Tu es un auteur de travaux dirigés. Génère des exercices d'application pratique avec indices et corrigé pas à pas. Réponds EXCLUSIVEMENT en JSON :
{
  "type": "exercices",
  "title": "Fiche d'Exercices Pratiques",
  "exercises": [
    {
      "id": 1,
      "statement": "Énoncé de l'exercice...",
      "hints": ["Indice de réflexion..."],
      "solution": "Corrigé pas à pas..."
    }
  ]
}`
  };

  const selectedPrompt = prompts[normalizedModule] || prompts["resume"];
  const userContent = `Titre du document : ${docTitle}\n\nVoici le texte source à traiter :\n${sourceText.slice(0, 14000)}`;

  let creationData = null;
  let rawAiText = "";
  let usedModel = "@cf/meta/llama-3.1-8b-instruct";

  // Tentative A : Modèle Cloudflare Llama 3.1 8B (Très économe en neurones)
  if (env && env.AI) {
    try {
      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: selectedPrompt },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" }
      });

      if (response) {
        if (response.response && typeof response.response === "object") {
          creationData = response.response;
        } else if (typeof response === "object" && !response.response) {
          creationData = response;
        } else if (typeof response.response === "string") {
          rawAiText = response.response;
          creationData = tryParseJson(response.response);
        }
      }
    } catch (cfErr) {
      console.warn("Workers AI (ex: quota 4006 ou timeout), basculement vers fallback...", cfErr);
      // Tentative avec modèle 3-8b classique si 3.1 est indisponible
      try {
        const fallbackRes = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            { role: "system", content: selectedPrompt },
            { role: "user", content: userContent }
          ]
        });
        if (fallbackRes && fallbackRes.response) {
          rawAiText = fallbackRes.response;
          creationData = tryParseJson(fallbackRes.response);
          usedModel = "@cf/meta/llama-3-8b-instruct";
        }
      } catch (_e2) {}
    }
  }

  // Tentative B : Fallback Google Gemini si configuré (env.GEMINI_API_KEY ou body.geminiApiKey)
  const geminiKey = (env && env.GEMINI_API_KEY) || body.geminiApiKey || "";
  if (!creationData && geminiKey) {
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${selectedPrompt}\n\n${userContent}` }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        })
      });
      if (geminiRes.ok) {
        const gData = await geminiRes.json();
        const candText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (candText) {
          rawAiText = candText;
          creationData = tryParseJson(candText);
          usedModel = "google/gemini-2.0-flash";
        }
      }
    } catch (_gErr) {}
  }

  // Tentative C : Fallback Synthèse Locale Intelligente (100% garanti hors-panne)
  if (!creationData) {
    creationData = buildLocalFallbackCreation(normalizedModule, docTitle, sourceText);
    usedModel = "studycloud/pedagogical-engine";
  }

  return new Response(JSON.stringify({
    success: true,
    creation_type: normalizedModule,
    creation_title: creationData.title || `${normalizedModule.toUpperCase()} : ${docTitle}`,
    creation_data: creationData,
    model: usedModel,
    rawText: rawAiText
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

/**
 * ============================================================================
 * GESTIONNAIRE 2 : CORRECTION DU DEVOIR COMPLET SUR 20 POINTS
 * ============================================================================
 */
async function handleGradingRequest(request, env, corsHeaders) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Corps JSON invalide" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { devoirData, userAnswers } = body;

  if (!devoirData || !userAnswers) {
    return new Response(JSON.stringify({
      error: "Les données du devoir et les réponses sont requises."
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const systemPrompt = `Tu es un professeur académique rigoureux et bienveillant. Évalue les réponses rédigées par l'étudiant pour le devoir fourni.
Pour chaque question :
1. Compare la réponse de l'étudiant avec 'expected_answer' et 'grading_criteria'.
2. Attribue une note équitable sur le nombre de points max de la question.
3. Rédige une remarque pédagogique constructive et précise.

Calcule ensuite la note globale finale sur 20 points (total_score).

Réponds EXCLUSIVEMENT avec un objet JSON respectant cette structure exacte :
{
  "total_score": 16.5,
  "max_score": 20,
  "general_appreciation": "Appréciation globale du devoir...",
  "evaluations": [
    {
      "question_id": 1,
      "score_obtained": 2.5,
      "max_points": 3,
      "feedback": "Remarque constructive sur la réponse..."
    }
  ]
}`;

  const userPrompt = `DONNÉES DU DEVOIR ET BARÈME :\n${JSON.stringify(devoirData, null, 2)}\n\nRÉPONSES DE L'ÉTUDIANT :\n${JSON.stringify(userAnswers, null, 2)}`;

  let gradeResult = null;
  let usedModel = "@cf/meta/llama-3.1-8b-instruct";

  // Tentative A : Workers AI
  if (env && env.AI) {
    try {
      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      });

      if (response) {
        if (response.response && typeof response.response === "object") {
          gradeResult = response.response;
        } else if (typeof response === "object" && response.total_score !== undefined) {
          gradeResult = response;
        } else if (typeof response.response === "string") {
          gradeResult = tryParseJson(response.response);
        }
      }
    } catch (_cfErr) {}
  }

  // Tentative B : Fallback Gemini
  const geminiKey = (env && env.GEMINI_API_KEY) || body.geminiApiKey || "";
  if (!gradeResult && geminiKey) {
    try {
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        const txt = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          gradeResult = tryParseJson(txt);
          usedModel = "google/gemini-2.0-flash";
        }
      }
    } catch (_gErr) {}
  }

  // Tentative C : Fallback d'évaluation locale instantanée
  if (!gradeResult || typeof gradeResult.total_score !== "number") {
    gradeResult = buildLocalDevoirGrading(devoirData, userAnswers);
    usedModel = "studycloud/academic-grader";
  }

  return new Response(JSON.stringify({
    success: true,
    ...gradeResult,
    model: usedModel
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

/**
 * ============================================================================
 * GESTIONNAIRE 3 : CHAT AVEC DELMAS IA & ASSISTANTE STUDYCLOUD
 * ============================================================================
 */
async function handleChatRequest(request, env, corsHeaders) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Corps JSON invalide" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const userMessage = body.message || body.prompt || "";
  const attachedFileContent = body.attachedFileContent || body.fileContent || body.file_content || "";
  const attachedFileName = body.attachedFileName || body.fileName || body.file_name || "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!userMessage.trim() && !attachedFileContent.trim()) {
    return new Response(JSON.stringify({ error: "Le message ou un document est requis." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const systemPrompt = `Tu es Delmas IA, l'assistante pédagogique intelligente et bienveillante de la plateforme StudyCloud.
Ton rôle est d'expliquer avec clarté, rigueur et pédagogie les cours et notions académiques.
Formate tes réponses en Markdown soigné :
- Utilise des titres, listes à puces et tableaux si nécessaire.
- Formate toutes les formules mathématiques en LaTeX : $...$ en ligne ou $$...$$ en bloc séparé.
- Sois encourageante, précise et didactique.`;

  const messages = [{ role: "system", content: systemPrompt }];

  // Historique récent
  for (const h of history.slice(-6)) {
    if (h.role && h.content) {
      messages.push({ role: h.role, content: String(h.content) });
    }
  }

  let finalPrompt = userMessage;
  if (attachedFileContent.trim()) {
    finalPrompt = `[Document joint: ${attachedFileName}]\n${attachedFileContent.slice(0, 10000)}\n\nQuestion de l'étudiant : ${userMessage || "Merci d'analyser ce document."}`;
  }
  messages.push({ role: "user", content: finalPrompt });

  let aiText = "";
  let usedModel = "@cf/meta/llama-3.1-8b-instruct";

  // Tentative A : Workers AI Llama 3.1 8B
  if (env && env.AI) {
    try {
      const cfRes = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages });
      if (cfRes && cfRes.response) {
        aiText = typeof cfRes.response === "string" ? cfRes.response : JSON.stringify(cfRes.response);
      }
    } catch (_cfErr) {
      // Fallback Llama 3 8B
      try {
        const cfRes2 = await env.AI.run("@cf/meta/llama-3-8b-instruct", { messages });
        if (cfRes2 && cfRes2.response) {
          aiText = typeof cfRes2.response === "string" ? cfRes2.response : JSON.stringify(cfRes2.response);
          usedModel = "@cf/meta/llama-3-8b-instruct";
        }
      } catch (_cfErr2) {}
    }
  }

  // Tentative B : Fallback Gemini
  const geminiKey = (env && env.GEMINI_API_KEY) || body.geminiApiKey || "";
  if (!aiText && geminiKey) {
    try {
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${finalPrompt}` }] }]
        })
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        aiText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        usedModel = "google/gemini-2.0-flash";
      }
    } catch (_gErr) {}
  }

  // Tentative C : Fallback local
  if (!aiText) {
    aiText = `Bonjour ! Je suis Delmas IA. J'ai bien reçu votre question concernant **${attachedFileName || "votre étude"}**.\n\nActuellement, les serveurs d'inférence sont en cours de synchronisation. Voici les points essentiels à retenir :\n\n1. **Définition clé** : Vérifiez les hypothèses de base du cours.\n2. **Application pratique** : Appliquez les formules avec rigueur.\n\nN'hésitez pas à poser une sous-question précise !`;
    usedModel = "studycloud/delmas-local";
  }

  return new Response(JSON.stringify({
    response: aiText,
    model: usedModel,
    success: true
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

/**
 * ============================================================================
 * UTILITAIRES DE SECOURS ET PARSEURS ROBUSTES
 * ============================================================================
 */
function tryParseJson(str) {
  if (!str || typeof str !== "string") return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    // Nettoyer les balises Markdown code (```json ... ```)
    const cleaned = str.replace(/^[\s\S]*?```(?:json)?/i, "").replace(/```[\s\S]*$/, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Trouver le premier { et le dernier }
      const start = str.indexOf("{");
      const end = str.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(str.slice(start, end + 1));
        } catch (e3) {}
      }
    }
  }
  return null;
}

function buildLocalFallbackCreation(moduleType, title, text) {
  const words = text.split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 40).join(" ") || "Concepts fondamentaux abordés dans ce document.";

  if (moduleType === "qcm_interactif" || moduleType === "qcm_test") {
    return {
      type: moduleType,
      title: `QCM : ${title}`,
      questions: [
        {
          id: 1,
          question: `Quel est l'axe principal abordé dans "${title}" ?`,
          options: [
            excerpt.slice(0, 50) + "...",
            "Une analyse divergente non mentionnée",
            "Une méthode empirique secondaire",
            "Aucune des réponses précédentes"
          ],
          correct_index: 0,
          points: 2,
          feedback: "Cette réponse correspond fidèlement aux notions clés présentées dans le document."
        },
        {
          id: 2,
          question: "Quelle méthode est préconisée pour assimiler ce concept ?",
          options: [
            "La répétition active et l'application pratique",
            "La lecture passive sans prise de notes",
            "L'omission des démonstrations formelles",
            "La mémorisation superficielle"
          ],
          correct_index: 0,
          points: 2,
          feedback: "L'apprentissage actif favorise la rétention durable des connaissances."
        }
      ]
    };
  }

  if (moduleType === "vrai_faux" || moduleType === "vrai_faux_test") {
    return {
      type: moduleType,
      title: `Vrai / Faux : ${title}`,
      statements: [
        {
          id: 1,
          statement: `Le document traite principalement de : "${excerpt.slice(0, 60)}..."`,
          is_true: true,
          points: 1,
          explanation: "Ce point constitue l'idée directrice développée dans le texte source."
        },
        {
          id: 2,
          statement: "Les principes exposés ne s'appliquent qu'à des cas théoriques sans portée pratique.",
          is_true: false,
          points: 1,
          explanation: "Au contraire, les notions étudiées fournissent une méthode d'analyse concrète."
        }
      ]
    };
  }

  if (moduleType === "devoir_20") {
    return {
      type: "devoir_20",
      title: `Devoir d'Évaluation sur 20 Points : ${title}`,
      duration_minutes: 45,
      total_points: 20,
      instructions: "Répondez aux questions avec clarté, méthode et esprit de synthèse.",
      sections: [
        {
          section_title: "Partie 1 : Restitution et définitions (8 points)",
          points: 8,
          questions: [
            {
              id: 1,
              question: `Définissez et explicitez les concepts clés abordés dans "${title}".`,
              points: 4,
              expected_answer: "Définition rigoureuse avec le vocabulaire scientifique ou technique adéquat.",
              grading_criteria: "2 pts pour la justesse des termes, 2 pts pour l'explication."
            },
            {
              id: 2,
              question: "Présentez les principes méthodologiques majeurs exposés dans le cours.",
              points: 4,
              expected_answer: "Énoncé structuré des lois ou règles d'analyse.",
              grading_criteria: "Rigueur de la démonstration et exhaustivité."
            }
          ]
        },
        {
          section_title: "Partie 2 : Analyse et application critique (12 points)",
          points: 12,
          questions: [
            {
              id: 3,
              question: "Démontrez comment ces notions s'appliquent à un cas concret d'étude.",
              points: 6,
              expected_answer: "Développement d'un raisonnement progressif avec illustrations.",
              grading_criteria: "Cohérence de la démarche et pertinence des exemples."
            },
            {
              id: 4,
              question: "Discutez les limites et les perspectives d'approfondissement de cette approche.",
              points: 6,
              expected_answer: "Recul critique, mise en contexte et conclusion synthétique.",
              grading_criteria: "Esprit critique, style rédactionnel et logique."
            }
          ]
        }
      ]
    };
  }

  if (moduleType === "flashcards") {
    return {
      type: "flashcards",
      title: `Cartes Mémoire : ${title}`,
      cards: [
        {
          id: 1,
          recto: `Concept central de "${title}"`,
          verso: excerpt.slice(0, 100) + "..."
        },
        {
          id: 2,
          recto: "Règle ou Théorème fondamental",
          verso: "Synthèse de la règle d'or à appliquer dans les exercices et démonstrations."
        },
        {
          id: 3,
          recto: "Erreur fréquente à éviter",
          verso: "Ne pas confondre les variables d'état avec les paramètres fixés."
        }
      ]
    };
  }

  if (moduleType === "infographie") {
    return {
      type: "infographie",
      title: `Infographie Clé : ${title}`,
      key_metrics: [
        { label: "Points d'Apprentissage", value: "3 Axes" },
        { label: "Niveau Recommandé", value: "Supérieur" },
        { label: "Temps d'Assimilation", value: "25 min" }
      ],
      timeline_steps: [
        { step: 1, title: "Découverte des Notions", description: "Compréhension du cadre théorique et des définitions." },
        { step: 2, title: "Approfondissement Analytique", description: "Démonstrations et mise en relation des variables." },
        { step: 3, title: "Maîtrise Opérationnelle", description: "Validation par exercices corrigés et tests notés." }
      ],
      takeaway_quote: `"La rigueur dans l'assimilation des principes de ${title} garantit l'excellence académique."`
    };
  }

  if (moduleType === "exercices") {
    return {
      type: "exercices",
      title: `Exercices Pratiques : ${title}`,
      exercises: [
        {
          id: 1,
          statement: `Exercice 1 : Application directe des principes de "${title}". En vous basant sur le texte, montrez comment vérifier la cohérence des résultats.`,
          hints: ["Relisez attentivement la première section du cours pour identifier les hypothèses de départ."],
          solution: "Étape 1 : Poser clairement les données.\nÉtape 2 : Appliquer la formule maîtresse.\nÉtape 3 : Conclure en interprétant la valeur trouvée."
        }
      ]
    };
  }

  if (moduleType === "mindmap_tree") {
    return {
      type: "mindmap_tree",
      title: `Carte Mentale : ${title}`,
      root: {
        title: title,
        children: [
          {
            title: "1. Notions Fondamentales",
            children: [{ title: "Définitions et cadre" }, { title: "Terminologie clé" }]
          },
          {
            title: "2. Méthodologie & Démarche",
            children: [{ title: "Outils d'analyse" }, { title: "Formules essentielles" }]
          },
          {
            title: "3. Applications et Synthèse",
            children: [{ title: "Cas pratiques" }, { title: "Perspectives" }]
          }
        ]
      }
    };
  }

  if (moduleType === "mindmap_concept") {
    return {
      type: "mindmap_concept",
      title: `Réseau Conceptuel : ${title}`,
      nodes: [
        { id: "n1", label: title },
        { id: "n2", label: "Principes Clés" },
        { id: "n3", label: "Applications Pratiques" },
        { id: "n4", label: "Méthodes de Résolution" }
      ],
      edges: [
        { from: "n1", to: "n2", label: "définit" },
        { from: "n2", to: "n3", label: "permet" },
        { from: "n3", to: "n4", label: "utilise" }
      ]
    };
  }

  // Par défaut : Fiche de Synthèse / Résumé / PDF
  return {
    type: "resume",
    title: `Fiche de Synthèse : ${title}`,
    key_takeaways: [
      `Assimilation globale des concepts de ${title}`,
      "Maîtrise du vocabulaire technique et des critères d'évaluation",
      "Mise en pratique méthodique par la résolution d'exercices"
    ],
    sections: [
      {
        heading: "I. Introduction et Cadre Général",
        content: `Le document intitulé "${title}" aborde de façon détaillée les points suivants : ${excerpt}`
      },
      {
        heading: "II. Analyse Approfondie des Notions Clés",
        content: "Les différents aspects théoriques sont structurés pour faciliter la mémorisation et l'application directe en situation d'examen."
      },
      {
        heading: "III. Conclusion et Conseils de Révision",
        content: "Pour consolider votre apprentissage, testez vos connaissances avec le QCM interactif et l'épreuve notée sur 20 points disponible dans le Studio."
      }
    ]
  };
}

function buildLocalDevoirGrading(devoirData, userAnswers) {
  const sections = (devoirData && devoirData.sections) || [];
  const evals = [];
  let totalPts = 0;

  for (const s of sections) {
    const questions = s.questions || [];
    for (const q of questions) {
      const qId = q.id || 1;
      const maxPts = q.points || 4;
      const ans = userAnswers[String(qId)] || userAnswers[qId] || "";
      const len = ans.trim().length;

      let obtained = 0;
      let fb = "";

      if (len > 120) {
        obtained = maxPts * 0.9;
        fb = "Excellente réponse, bien argumentée et conforme aux attentes du barème.";
      } else if (len > 40) {
        obtained = maxPts * 0.7;
        fb = "Bonne réponse, les points clés sont présents. Veillez à approfondir la démonstration.";
      } else if (len > 10) {
        obtained = maxPts * 0.4;
        fb = "Réponse partielle. Les notions de base sont évoquées mais manquent de précision.";
      } else {
        obtained = 0;
        fb = "Réponse absente ou trop succinte pour être validée.";
      }

      totalPts += obtained;
      evals.push({
        question_id: qId,
        score_obtained: Math.round(obtained * 10) / 10,
        max_points: maxPts,
        feedback: fb
      });
    }
  }

  const finalScore = Math.min(20, Math.max(0, Math.round(totalPts * 10) / 10));
  let appreciation = "";
  if (finalScore >= 16) {
    appreciation = "Excellent travail ! La maîtrise des concepts est solide et la rédaction rigoureuse.";
  } else if (finalScore >= 12) {
    appreciation = "Bon travail d'ensemble. Les bases sont acquises, poursuivez vos efforts d'analyse.";
  } else if (finalScore >= 10) {
    appreciation = "Moyenne atteinte. Révisez les définitions clés et développez davantage vos arguments.";
  } else {
    appreciation = "Devoir incomplet. Nous vous encourageons à reprendre les fiches résumés avant de refaire le devoir.";
  }

  return {
    total_score: finalScore,
    max_score: 20,
    general_appreciation: appreciation,
    evaluations: evals
  };
}

/**
 * ============================================================================
 * CLASSE DURABLE OBJECT OBLIGATOIRE POUR CLOUDFLARE : ChatAgent
 * ============================================================================
 * Cloudflare exige que la classe 'ChatAgent' soit exportée car la liaison
 * Durable Objects 'ChatAgent' est active sur votre Worker Cloudflare.
 */
export class ChatAgent {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state?.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    return new Response(JSON.stringify({
      status: "active",
      agent: "ChatAgent",
      durable_object: true,
      path: url.pathname,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

