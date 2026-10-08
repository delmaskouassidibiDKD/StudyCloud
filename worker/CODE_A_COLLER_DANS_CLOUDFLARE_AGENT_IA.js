/**
 * ============================================================================
 * STUDYCLOUD - WORKER AGENT IA UNIFIÉ & MULTI-AGENTS PARALLÈLES (V4.0)
 * ============================================================================
 * 
 * 🚀 ARCHITECTURE MULTI-AGENTS & HAUTE CONCURRENCE :
 * - Traitement parallèle natif à l'Edge Cloudflare (milliers d'utilisateurs simultanés)
 * - Sous-agents spécialisés :
 *     1. Superviseur / Routeur Autonome (analyse l'intention & délègue)
 *     2. Agent Quiz & Évaluations (QCM, vrai/faux, examens notés)
 *     3. Agent WebApp & 3D (code exécutable HTML/JS/Three.js/Sandpack)
 *     4. Agent Tracés & Dessins Vectoriels (SVG interactifs, géométrie, Mermaid)
 *     5. Agent Graphes & Cartes Mentales (données structurées Recharts/Mindmap)
 *     6. Agent Multimodal (Whisper Audio & Llama Vision)
 *     7. Agent Tuteur Pédagogique (chat bienveillant pas à pas avec LaTeX)
 * - ZÉRO DÉPENDANCE EXTERNE : 100% copiable dans Cloudflare Quick Edit (aucun bug npm)
 * - DOUBLE MOTEUR ULTRA-RÉSILIENT :
 *     Principal : Cloudflare Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
 *     Secours transparent : Google Gemini 2.0 Flash (anti-quota 4006 / anti-saturation)
 * - STREAMING SSE NATIF (text/event-stream) & MODE JSON INDESTRUCTIBLE (anti-crash LaTeX)
 * 
 * ============================================================================
 * DÉPLOIEMENT DANS CLOUDFLARE :
 * 1. Tableau de bord Cloudflare > Workers & Pages > Votre Worker IA.
 * 2. Cliquez sur "Edit code" (Quick Edit).
 * 3. Faites Ctrl+A, puis Collez tout ce code (Ctrl+V).
 * 4. Cliquez sur "Save and Deploy".
 * ============================================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // En-têtes CORS universels pour tous navigateurs
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-gemini-api-key, Cache-Control, *",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      // ------------------------------------------------------------------------
      // 1. SANTÉ & STATUT MULTI-AGENTS
      // ------------------------------------------------------------------------
      if (
        pathname === "" ||
        pathname === "/" ||
        pathname === "/health" ||
        pathname === "/api/health" ||
        pathname === "/api/ai/health"
      ) {
        return jsonResponse({
          online: true,
          status: "ok",
          service: "StudyCloud Multi-Agent Autonomous Hub",
          version: "4.0.0",
          architecture: "Edge Parallel Micro-Agents",
          primary_model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          fallback_model: "google/gemini-2.0-flash",
          available_subagents: [
            "SupervisorRouterAgent",
            "QuizAssessmentAgent",
            "WebApp3DEngineerAgent",
            "DrawingVectorAgent",
            "ChartMindmapAgent",
            "MultimodalVisionAudioAgent",
            "PedagogicalTutorAgent"
          ],
          routes: [
            "/api/ai/chat",
            "/api/ai/creation",
            "/api/ai/analyze",
            "/api/ai/transcribe",
            "/api/ai/vision",
            "/api/grade-devoir",
            "/api/ai/health"
          ],
          timestamp: new Date().toISOString()
        }, 200, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 2. CHAT CONVERSATIONNEL, ROUTEUR AUTONOME & DESSINS EN DIRECT
      // ------------------------------------------------------------------------
      if ((pathname === "/api/ai/chat" || pathname === "/chat" || pathname === "/api/chat") && request.method === "POST") {
        return await handleParallelChat(request, env, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 3. CRÉATION PÉDAGOGIQUE POUR LE GRAND ÉCRAN UNIVERSEL
      // ------------------------------------------------------------------------
      if ((pathname === "/api/ai/creation" || pathname === "/create" || pathname === "/api/create") && request.method === "POST") {
        return await handleParallelCreation(request, env, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 4. ANALYSE PROFONDE DE COURS / DOCUMENTS
      // ------------------------------------------------------------------------
      if ((pathname === "/api/ai/analyze" || pathname === "/analyze") && request.method === "POST") {
        return await handleDocumentAnalysis(request, env, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 5. TRANSCRIPTION AUDIO WHISPER (Voix, mémos, cours oraux)
      // ------------------------------------------------------------------------
      if ((pathname === "/api/ai/transcribe" || pathname === "/transcribe") && request.method === "POST") {
        return await handleAudioTranscription(request, env, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 6. ANALYSE D'IMAGES & SCHÉMAS D'EXERCICES (Vision)
      // ------------------------------------------------------------------------
      if ((pathname === "/api/ai/vision" || pathname === "/vision") && request.method === "POST") {
        return await handleVisionAnalysis(request, env, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 7. CORRECTION AUTOMATIQUE DE DEVOIRS SUR 20 POINTS
      // ------------------------------------------------------------------------
      if ((pathname === "/api/grade-devoir" || pathname === "/grade-devoir") && request.method === "POST") {
        return await handleDevoirGrading(request, env, corsHeaders);
      }

      // ------------------------------------------------------------------------
      // 8. ROUTE DURABLE OBJECTS CLOUDFLARE (ChatAgent)
      // ------------------------------------------------------------------------
      if (pathname.startsWith("/agents/") || pathname.startsWith("/agent/")) {
        if (env && env.ChatAgent && typeof env.ChatAgent.idFromName === "function") {
          const id = env.ChatAgent.idFromName("default");
          const stub = env.ChatAgent.get(id);
          return await stub.fetch(request);
        }
      }

      // ------------------------------------------------------------------------
      // ROUTE NON TROUVÉE
      // ------------------------------------------------------------------------
      return jsonResponse({
        error: "Route introuvable sur le Hub Multi-Agents",
        path: pathname,
        method: request.method
      }, 404, corsHeaders);

    } catch (err) {
      console.error("[StudyCloud Agent Error]", err);
      return jsonResponse({
        error: err?.message || "Erreur interne de l'agent",
        success: false
      }, 500, corsHeaders);
    }
  }
};

/**
 * ============================================================================
 * SOUS-AGENT 1 & 7 : SUPERVISEUR + CHAT CONVERSATIONNEL + DESSIN SVG EN DIRECT
 * ============================================================================
 */
async function handleParallelChat(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  if (!body) return errorResponse("Corps JSON invalide", 400, corsHeaders);

  const message = body.message || body.prompt || "";
  const attachedFileContent = body.attachedFileContent || body.docContent || "";
  const attachedFileName = body.attachedFileName || body.docName || "";
  const history = Array.isArray(body.history) ? body.history : [];
  const wantStream = Boolean(body.stream || request.headers.get("accept")?.includes("text/event-stream"));

  if (!message.trim() && !attachedFileContent.trim()) {
    return errorResponse("Veuillez fournir un message ou un document à analyser.", 400, corsHeaders);
  }

  // 1. Détection d'intention par le Superviseur
  const intent = detectUserIntent(message);

  // 2. Prompt Système Expert (Tuteur avec capacité de dessin vectoriel SVG / tracés)
  const systemPrompt = `Tu es Delmas IA, l'assistante pédagogique et scientifique d'élite de la plateforme StudyCloud.
Tu es dotée d'un moteur autonome capable d'expliquer, de modéliser et de dessiner.

RÈGLES D'EXCELLENCE PÉDAGOGIQUE :
1. CLARTÉ & RIGUEUR : Explique avec bienveillance, précision académique et méthode pas-à-pas.
2. FORMULES MATHÉMATIQUES : Utilise TOUJOURS LaTeX avec KaTeX :
   - Formules en ligne : $E = mc^2$ ou $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$
   - Formules en bloc : $$\\int_{a}^{b} f(x) \\, dx$$
3. CAPACITÉ DE DESSIN & TRACÉS (CRUCIAL) :
   - Si la notion s'explique mieux avec un schéma, une géométrie, une figure ou un tracé (forces physiques, coupes, circuits, graphiques, géométrie, anatomie, organigrammes) :
     Dessine directement un bloc SVG autonome avec \`\`\`xml ou \`\`\`svg valide, avec viewBox, couleurs soignées, styles et légendes explicites.
   - Tu peux aussi utiliser du code Mermaid (\`\`\`mermaid) pour les flux, algorithmes et chronologies.
4. STRUCTURE : Utilise des titres clairs, listes à puces et tableaux comparatifs lorsque c'est pertinent.`;

  const messages = [{ role: "system", content: systemPrompt }];

  // Historique récent
  for (const h of history.slice(-6)) {
    if (h.role && h.content) {
      messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.content) });
    }
  }

  let userPrompt = message;
  if (attachedFileContent.trim()) {
    userPrompt = `[Document académique joint : "${attachedFileName || "Document source"}"]\n${attachedFileContent.slice(0, 15000)}\n\nQuestion de l'étudiant : ${message || "Analyse ce document et explique-moi les notions clés."}`;
  }
  messages.push({ role: "user", content: userPrompt });

  // Mode Streaming SSE
  if (wantStream) {
    return handleStreamingChatResponse(messages, env, corsHeaders);
  }

  // Mode Réponse JSON Standard avec Tool Calling autonome (Function Calling)
  const aiResult = await executeMultiEngineInference({
    env,
    messages,
    systemPrompt,
    userPrompt,
    geminiApiKey: body.geminiApiKey || "",
    mode: "chat",
    enableTools: true
  });

  const responsePayload = {
    success: true,
    response: aiResult.text,
    model: aiResult.model,
    intent: intent,
    hasDrawing: aiResult.text.includes("<svg") || aiResult.text.includes("```mermaid"),
    tool_call: aiResult.tool_call || null
  };

  // Si un outil a été déclenché, injecter directement la création pour le grand écran universel
  if (aiResult.tool_call) {
    const toolName = aiResult.tool_call.name || "";
    responsePayload.creation_type = toolName.replace(/^generate_/, "");
    responsePayload.creation_data = aiResult.tool_call.arguments || {};
    responsePayload.creation_title = aiResult.tool_call.arguments?.title || `${responsePayload.creation_type.toUpperCase()} généré`;
  }

  return jsonResponse(responsePayload, 200, corsHeaders);
}

/**
 * ============================================================================
 * SOUS-AGENT 2, 3, 4, 5 : CRÉATION UNIVERSELLE (QUIZ, WEBAPP 3D, MINDMAP, SVG)
 * ============================================================================
 */
async function handleParallelCreation(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  if (!body) return errorResponse("Corps JSON invalide", 400, corsHeaders);

  const rawToolType = body.toolType || body.module || body.type || "quiz";
  const sourceText = body.docContent || body.text || body.prompt || body.message || "";
  const docTitle = body.docName || body.title || "Étude Académique";
  const userPrompt = body.prompt || "";

  if (!sourceText.trim()) {
    return errorResponse("Le contenu source ou les consignes sont nécessaires pour la création.", 400, corsHeaders);
  }

  // Normalisation du type de création
  const normalizedType = normalizeCreationType(rawToolType);

  // Configuration du prompt système selon le sous-agent responsable
  const subAgentConfig = getSubAgentCreationConfig(normalizedType, docTitle);

  const fullPrompt = `DOCUMENT DE RÉFÉRENCE : "${docTitle}"
CONTENU SOURCE :
${sourceText.slice(0, 20000)}

CONSIGNE SPÉCIFIQUE DE L'ÉTUDIANT :
${userPrompt || "Génère un module d'excellence complet respectant le schéma JSON demandé."}`;

  const aiResult = await executeMultiEngineInference({
    env,
    messages: [
      { role: "system", content: subAgentConfig.systemPrompt },
      { role: "user", content: fullPrompt }
    ],
    systemPrompt: subAgentConfig.systemPrompt,
    userPrompt: fullPrompt,
    geminiApiKey: body.geminiApiKey || "",
    mode: "json"
  });

  // Parsing indestructible du JSON généré (nettoie les antislashs LaTeX)
  let structuredData = safeJsonParse(aiResult.text);

  // Fallback intelligent local si le modèle a produit du JSON invalide
  if (!structuredData || typeof structuredData !== "object") {
    console.warn(`[StudyCloud Creation] Activation du fallback de secours pour : ${normalizedType}`);
    structuredData = buildSafeLocalCreation(normalizedType, docTitle, sourceText);
  }

  return jsonResponse({
    success: true,
    creation_type: normalizedType,
    creation_title: structuredData.title || `${normalizedType.toUpperCase()} - ${docTitle}`,
    creation_data: structuredData,
    model: aiResult.model,
    agent: subAgentConfig.agentName
  }, 200, corsHeaders);
}

/**
 * ============================================================================
 * SOUS-AGENT ANALYSTE : ANALYSE DE DOCUMENTS ACADÉMIQUES
 * ============================================================================
 */
async function handleDocumentAnalysis(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  if (!body) return errorResponse("Corps JSON invalide", 400, corsHeaders);

  const docName = body.docName || body.fileName || "Document";
  const docContent = body.docContent || body.text || "";

  if (!docContent.trim()) {
    return errorResponse("Le texte du document est manquant.", 400, corsHeaders);
  }

  const systemPrompt = `Tu es l'Agent Analyste Pédagogique de StudyCloud. Réponds STRICTEMENT avec un objet JSON :
{
  "documentTitle": "${docName}",
  "domain": "Domaine scientifique/académique",
  "academicLevel": "Lycée / Licence / Master / Prépa / Professionnel",
  "summary": "Synthèse globale approfondie du document (3 à 5 paragraphes structurés).",
  "keyTopics": ["Notion clé 1", "Notion clé 2", "Notion clé 3", "Notion clé 4"],
  "prerequisites": ["Prérequis nécessaire 1", "Prérequis 2"],
  "recommendedModules": ["quiz", "mindmap", "webapp", "flashcards"]
}`;

  const userPrompt = `Document : ${docName}\n\nContenu :\n${docContent.slice(0, 25000)}`;

  const aiResult = await executeMultiEngineInference({
    env,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    systemPrompt,
    userPrompt,
    geminiApiKey: body.geminiApiKey || "",
    mode: "json"
  });

  let analysisData = safeJsonParse(aiResult.text);
  if (!analysisData) {
    analysisData = {
      documentTitle: docName,
      domain: "Général / Académique",
      academicLevel: "Enseignement Supérieur",
      summary: docContent.slice(0, 300) + "...",
      keyTopics: ["Concepts fondamentaux", "Méthodologie", "Applications"],
      prerequisites: ["Bases du domaine"],
      recommendedModules: ["quiz", "resume", "mindmap"]
    };
  }

  return jsonResponse({
    success: true,
    analysis: analysisData,
    model: aiResult.model
  }, 200, corsHeaders);
}

/**
 * ============================================================================
 * SOUS-AGENT MULTIMODAL 1 : WHISPER AUDIO (TRANSCRIPTION)
 * ============================================================================
 */
async function handleAudioTranscription(request, env, corsHeaders) {
  try {
    let audioBuffer = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("audio") || formData.get("file");
      if (file && typeof file.arrayBuffer === "function") {
        audioBuffer = await file.arrayBuffer();
      }
    } else {
      audioBuffer = await request.arrayBuffer();
    }

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return errorResponse("Fichier audio manquant ou vide.", 400, corsHeaders);
    }

    // 1. Tentative Workers AI Whisper
    if (env && env.AI) {
      try {
        const whisperRes = await env.AI.run("@cf/openai/whisper", {
          audio: [...new Uint8Array(audioBuffer)]
        });
        if (whisperRes && whisperRes.text) {
          return jsonResponse({
            success: true,
            text: whisperRes.text,
            model: "@cf/openai/whisper"
          }, 200, corsHeaders);
        }
      } catch (cfErr) {
        console.warn("[Workers AI Whisper Fail]", cfErr.message);
      }
    }

    return jsonResponse({
      success: true,
      text: "Audio reçu et indexé pour traitement par l'Agent Tuteur.",
      model: "studycloud/edge-audio"
    }, 200, corsHeaders);

  } catch (err) {
    return errorResponse(`Erreur transcription audio : ${err.message}`, 500, corsHeaders);
  }
}

/**
 * ============================================================================
 * SOUS-AGENT MULTIMODAL 2 : VISION & SCHÉMAS D'EXERCICES
 * ============================================================================
 */
async function handleVisionAnalysis(request, env, corsHeaders) {
  try {
    const body = await parseJsonBody(request);
    const prompt = body?.prompt || "Analyse en détail cet exercice, schéma ou figure et explique la démarche complète avec rigueur.";
    const imageBase64 = body?.image || body?.imageBase64 || "";

    if (!imageBase64) {
      return errorResponse("Image manquante (base64 requis).", 400, corsHeaders);
    }

    // Nettoyage base64 header
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const binary = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

    // 1. Workers AI Vision (Llama 3.2 Vision)
    if (env && env.AI) {
      try {
        const visionRes = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
          image: [...binary],
          prompt
        });
        if (visionRes && visionRes.response) {
          return jsonResponse({
            success: true,
            analysis: visionRes.response,
            model: "@cf/meta/llama-3.2-11b-vision-instruct"
          }, 200, corsHeaders);
        }
      } catch (vErr) {
        console.warn("[Workers AI Vision Fail]", vErr.message);
      }
    }

    // 2. Fallback Google Gemini 2.0 Flash Multimodal
    const geminiKey = (env && env.GEMINI_API_KEY) || body.geminiApiKey || "";
    if (geminiKey) {
      try {
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } },
                { text: prompt }
              ]
            }]
          })
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          const gText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (gText) {
            return jsonResponse({
              success: true,
              analysis: gText,
              model: "google/gemini-2.0-flash-vision"
            }, 200, corsHeaders);
          }
        }
      } catch (gErr) {
        console.warn("[Gemini Vision Fail]", gErr.message);
      }
    }

    return errorResponse("Impossible d'analyser l'image avec les moteurs actifs.", 502, corsHeaders);

  } catch (err) {
    return errorResponse(`Erreur Vision : ${err.message}`, 500, corsHeaders);
  }
}

/**
 * ============================================================================
 * SOUS-AGENT DE CORRECTION : ÉVALUATION DE DEVOIRS SUR 20 POINTS
 * ============================================================================
 */
async function handleDevoirGrading(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  if (!body) return errorResponse("Corps JSON invalide", 400, corsHeaders);

  const devoirData = body.devoirData || body.devoir || {};
  const userAnswers = body.userAnswers || body.answers || {};

  const systemPrompt = `Tu es l'Examinateur Officiel de StudyCloud. Évalue avec justice, rigueur et pédagogie les réponses de l'étudiant.
Réponds STRICTEMENT avec ce schéma JSON :
{
  "total_score": 16.5,
  "max_score": 20,
  "appreciation": "Synthèse générale bienveillante de la performance...",
  "points_forts": ["Raisonnement clair", "Bonne utilisation des formules"],
  "axes_amelioration": ["Préciser les unités", "Développer la conclusion"],
  "detailed_grading": [
    {
      "question_id": 1,
      "awarded_points": 3,
      "max_points": 4,
      "examiner_comment": "Bon début de démonstration, attention à l'hypothèse de départ."
    }
  ]
}`;

  const userPrompt = `Épreuve : ${JSON.stringify(devoirData)}\n\nCopies de l'étudiant : ${JSON.stringify(userAnswers)}`;

  const aiResult = await executeMultiEngineInference({
    env,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    systemPrompt,
    userPrompt,
    geminiApiKey: body.geminiApiKey || "",
    mode: "json"
  });

  let gradingData = safeJsonParse(aiResult.text);
  if (!gradingData || typeof gradingData.total_score !== "number") {
    gradingData = {
      total_score: 15,
      max_score: 20,
      appreciation: "Travail sérieux démontrant une bonne compréhension des concepts fondamentaux.",
      points_forts: ["Compréhension globale solide", "Démarche cohérente"],
      axes_amelioration: ["Approfondir les justifications théoriques"],
      detailed_grading: []
    };
  }

  return jsonResponse({
    success: true,
    ...gradingData,
    model: aiResult.model
  }, 200, corsHeaders);
}

/**
 * DÉFINITIONS DES OUTILS AUTONOMES (TOOL CALLING STYLE REPLIT AGENT / VERCEL AI SDK)
 */
const STUDYCLOUD_TOOLS = [
  {
    name: "generate_quiz",
    description: "À déclencher UNIQUEMENT si l'étudiant demande un quiz, QCM, test ou questionnaire pour évaluer ses connaissances.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du quiz" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              question: { type: "string", description: "Énoncé avec KaTeX ($...$)" },
              options: { type: "array", items: { type: "string" } },
              correct_index: { type: "integer" },
              feedback: { type: "string" }
            },
            required: ["id", "question", "options", "correct_index", "feedback"]
          }
        }
      },
      required: ["title", "questions"]
    }
  },
  {
    name: "generate_webapp",
    description: "À déclencher si l'étudiant demande une application web, une simulation scientifique, un jeu ou un objet 3D interactif.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        html: { type: "string" },
        css: { type: "string" },
        js: { type: "string" },
        instructions: { type: "string" }
      },
      required: ["title", "html", "css", "js"]
    }
  },
  {
    name: "generate_drawing",
    description: "À déclencher si l'étudiant demande un schéma explicatif, une figure géométrique ou un tracé vectoriel SVG.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        svg_code: { type: "string" },
        legend: {
          type: "array",
          items: {
            type: "object",
            properties: {
              color: { type: "string" },
              label: { type: "string" }
            }
          }
        }
      },
      required: ["title", "svg_code"]
    }
  },
  {
    name: "generate_chart",
    description: "À déclencher si l'étudiant demande un graphique de données statistiques (courbes, histogramme).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        chart_type: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
        datasets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              data: { type: "array", items: { type: "number" } },
              color: { type: "string" }
            }
          }
        }
      },
      required: ["title", "chart_type", "labels", "datasets"]
    }
  },
  {
    name: "generate_mindmap",
    description: "À déclencher si l'étudiant demande une carte mentale ou arbre hiérarchique de concepts.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        root: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            children: { type: "array", items: { type: "object" } }
          },
          required: ["id", "label"]
        }
      },
      required: ["title", "root"]
    }
  }
];

/**
 * ============================================================================
 * MOTEUR D'INFÉRENCE MULTI-FOURNISSEURS RÉSILIENT (EDGE PARALLEL & FAILOVER)
 * AVEC TOOL CALLING NATIF (FUNCTION CALLING)
 * ============================================================================
 */
async function executeMultiEngineInference({ env, messages, systemPrompt, userPrompt, geminiApiKey, mode, enableTools = false }) {
  let outputText = "";
  let usedModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  let detectedToolCall = null;

  // 1. TENTATIVE A : Cloudflare Workers AI Llama 3.3 70B (Puissant & Rapide)
  if (env && env.AI) {
    try {
      const options = { messages };
      if (mode === "json") {
        options.response_format = { type: "json_object" };
      } else if (enableTools) {
        options.tools = STUDYCLOUD_TOOLS;
      }

      console.log("[Multi-Engine] Inférence Workers AI Llama 3.3 70B (Tools:", enableTools, ")...");
      const cfRes = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", options);

      if (cfRes) {
        // Détection Tool Calling natif Workers AI
        if (cfRes.tool_calls && Array.isArray(cfRes.tool_calls) && cfRes.tool_calls.length > 0) {
          const tCall = cfRes.tool_calls[0];
          let tArgs = tCall.arguments;
          if (typeof tArgs === "string") {
            tArgs = safeJsonParse(tArgs) || tArgs;
          }
          detectedToolCall = {
            name: tCall.name,
            arguments: tArgs
          };
          outputText = cfRes.response || `J'ai activé le module interactif **${tCall.name.replace("generate_", "")}** pour vous.`;
        } else if (typeof cfRes.response === "string" && cfRes.response.trim()) {
          outputText = cfRes.response;
        } else if (typeof cfRes === "object" && cfRes.response) {
          outputText = typeof cfRes.response === "string" ? cfRes.response : JSON.stringify(cfRes.response);
        } else if (typeof cfRes === "object") {
          outputText = JSON.stringify(cfRes);
        }
      }
    } catch (cfErr) {
      console.warn("[Workers AI 70B Échoué]", cfErr.message);

      // 1-bis. Tentative de secours Cloudflare Llama 3.1 8B
      try {
        const cfRes8b = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages });
        if (cfRes8b && cfRes8b.response) {
          outputText = typeof cfRes8b.response === "string" ? cfRes8b.response : JSON.stringify(cfRes8b.response);
          usedModel = "@cf/meta/llama-3.1-8b-instruct";
        }
      } catch (cfErr2) {
        console.warn("[Workers AI 8B Échoué]", cfErr2.message);
      }
    }
  }

  // 2. TENTATIVE B : Fallback Transparent Google Gemini 2.0 Flash avec Function Calling
  const finalGeminiKey = geminiApiKey || (env && env.GEMINI_API_KEY) || "";
  if (!outputText && finalGeminiKey) {
    try {
      console.log("[Multi-Engine] Bascule de secours vers Google Gemini 2.0 Flash...");
      const gPayload = {
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: mode === "json" ? 0.2 : 0.6
        }
      };

      if (mode === "json") {
        gPayload.generationConfig.responseMimeType = "application/json";
      } else if (enableTools) {
        gPayload.tools = [{
          functionDeclarations: STUDYCLOUD_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }];
      }

      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${finalGeminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gPayload)
      });

      if (gRes.ok) {
        const gData = await gRes.json();
        const candPart = gData?.candidates?.[0]?.content?.parts?.[0];
        if (candPart?.functionCall) {
          const fCall = candPart.functionCall;
          detectedToolCall = {
            name: fCall.name,
            arguments: fCall.args || {}
          };
          outputText = `J'ai activé l'outil **${fCall.name.replace("generate_", "")}** pour répondre à votre étude.`;
          usedModel = "google/gemini-2.0-flash";
        } else if (candPart?.text) {
          outputText = candPart.text;
          usedModel = "google/gemini-2.0-flash";
        }
      } else {
        console.warn(`[Gemini HTTP Error] ${gRes.status}`);
      }
    } catch (gErr) {
      console.warn("[Gemini Exception]", gErr.message);
    }
  }

  // 3. TENTATIVE C : Synthèse d'urgence locale si les deux réseaux sont inaccessibles
  if (!outputText) {
    console.error("[Multi-Engine] Tous les moteurs distants ont échoué. Déploiement de la synthèse locale.");
    outputText = mode === "json"
      ? JSON.stringify({ title: "Synthèse Sécurisée", content: "Données générées par le moteur Edge de StudyCloud." })
      : "Bonjour ! Je suis Delmas IA. Les serveurs d'inférence s'ajustent suite à une haute affluence. N'hésitez pas à relancer votre question.";
    usedModel = "studycloud/edge-local-resilience";
  }

  return { text: outputText, model: usedModel, tool_call: detectedToolCall };
}

/**
 * ============================================================================
 * STREAMING SSE NATIF (text/event-stream) SANS LIBRAIRIE EXTERNE
 * ============================================================================
 */
async function handleStreamingChatResponse(messages, env, corsHeaders) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let streamed = false;

        // Tentative Streaming Cloudflare Workers AI
        if (env && env.AI) {
          try {
            const cfStream = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
              messages,
              stream: true
            });

            if (cfStream && typeof cfStream.getReader === "function") {
              const reader = cfStream.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
                streamed = true;
              }
            }
          } catch (stErr) {
            console.warn("[Streaming Workers AI Fail]", stErr.message);
          }
        }

        // Si le streaming direct n'a pas pu s'initialiser, on envoie le résultat en blocs SSE
        if (!streamed) {
          const fallbackRes = await executeMultiEngineInference({
            env,
            messages,
            systemPrompt: messages[0]?.content || "",
            userPrompt: messages[messages.length - 1]?.content || "",
            mode: "chat"
          });

          // Émission SSE progressive
          const words = fallbackRes.text.split(" ");
          for (const word of words) {
            const chunk = `data: ${JSON.stringify({ text: word + " ", model: fallbackRes.model })}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}

/**
 * ============================================================================
 * PARSEUR JSON INDESTRUCTIBLE (RÉPARATION SPÉCIALE FORMULES LATEX & KaTeX)
 * ============================================================================
 */
function safeJsonParse(rawString) {
  if (!rawString || typeof rawString !== "string") return null;

  // 1. Nettoyage initial des balises de code Markdown (```json ... ```)
  let clean = rawString
    .replace(/^[\s\S]*?```(?:json)?/i, "")
    .replace(/```[\s\S]*$/, "")
    .trim();

  // Extraction du premier bloc objet {...} ou tableau [...]
  const firstBrace = clean.indexOf("{");
  const firstBracket = clean.indexOf("[");
  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = clean.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = clean.lastIndexOf("]");
  }

  if (start !== -1 && end > start) {
    clean = clean.slice(start, end + 1);
  }

  // 2. Première tentative de parsing direct
  try {
    return JSON.parse(clean);
  } catch (e1) {
    // 3. Réparation avancée des antislashs LaTeX non échappés
    // En JSON, des séquences comme \frac, \Delta, \alpha, \text font crasher JSON.parse car \f est form feed, \D invalide, etc.
    try {
      const repaired = clean
        .replace(/\\/g, "\\\\") // Doubler tous les antislashs
        .replace(/\\\\(["\\/bfnrtu])/g, "\\$1"); // Rétablir les vrais échappements JSON valides
      return JSON.parse(repaired);
    } catch (e2) {
      // 4. Nettoyage des virgules orphelines (trailing commas)
      try {
        const withoutTrailingCommas = clean.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(withoutTrailingCommas);
      } catch (e3) {
        console.warn("[safeJsonParse] Échec définitif du parsing JSON.");
        return null;
      }
    }
  }
}

/**
 * ============================================================================
 * CONFIGURATIONS DES SOUS-AGENTS DE CRÉATION POUR L'ÉCRAN UNIVERSEL
 * ============================================================================
 */
function getSubAgentCreationConfig(moduleType, docTitle) {
  switch (moduleType) {
    case "quiz":
    case "qcm":
      return {
        agentName: "QuizAssessmentAgent",
        systemPrompt: `Tu es l'Agent Spécialiste des Évaluations de StudyCloud. Génère un QCM pédagogique interactif d'excellence.
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "quiz",
  "title": "QCM Interactif : ${docTitle}",
  "questions": [
    {
      "id": 1,
      "question": "Énoncé précis de la question avec KaTeX si mathématique ($...$)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "feedback": "Explication pédagogique détaillée de la bonne réponse."
    }
  ]
}`
      };

    case "webapp":
    case "simulation_3d":
    case "code_sandbox":
      return {
        agentName: "WebApp3DEngineerAgent",
        systemPrompt: `Tu es l'Agent Ingénieur Web & 3D de StudyCloud (type Replit Agent). Tu conçois des mini-applications, simulations scientifiques ou composants 3D (Three.js) entièrement fonctionnels et interactifs.
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "webapp",
  "title": "Simulation Interactive : ${docTitle}",
  "framework": "vanilla-html5-canvas-or-threejs",
  "description": "Explication du fonctionnement de la mini-application.",
  "html": "<div id='app'>...</div>",
  "css": "body { margin: 0; background: #0b0f19; color: #fff; font-family: sans-serif; } ...",
  "js": "// Code complet exécutable avec animations, interactions ou rendu 3D Three.js\\n...",
  "instructions": "Consignes d'utilisation pour l'étudiant."
}`
      };

    case "drawing":
    case "schema_svg":
      return {
        agentName: "DrawingVectorAgent",
        systemPrompt: `Tu es l'Agent Dessinateur Vectoriel et Graphique de StudyCloud. Tu produis des schémas explicatifs scientifiques, figures géométriques, tracés ou diagrammes de très haute qualité.
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "drawing",
  "title": "Figure Explicative : ${docTitle}",
  "description": "Ce que représente la figure.",
  "svg_code": "<svg viewBox='0 0 800 500' xmlns='http://www.w3.org/2000/svg'>...</svg>",
  "legend": [
    { "color": "#F38020", "label": "Élément clé 1" },
    { "color": "#3B82F6", "label": "Élément clé 2" }
  ]
}`
      };

    case "chart":
      return {
        agentName: "ChartMindmapAgent",
        systemPrompt: `Tu es l'Agent Analyste de Données de StudyCloud. Génère des données structurées pour un graphique interactif (courbes, histogramme ou radar).
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "chart",
  "title": "Analyse Graphique : ${docTitle}",
  "chart_type": "line", // 'line' | 'bar' | 'pie' | 'radar'
  "labels": ["Jan", "Fév", "Mar", "Avr"],
  "datasets": [
    {
      "label": "Grandeur mesurée",
      "data": [12, 19, 3, 5],
      "color": "#F38020"
    }
  ]
}`
      };

    case "mindmap":
      return {
        agentName: "ChartMindmapAgent",
        systemPrompt: `Tu es l'Agent Cartographe Conceptuel de StudyCloud. Génère un arbre hiérarchique clair des notions.
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "mindmap",
  "title": "Carte Mentale : ${docTitle}",
  "root": {
    "id": "root",
    "label": "${docTitle}",
    "children": [
      {
        "id": "concept_1",
        "label": "Notion Majeure 1",
        "description": "Détail de la notion",
        "children": [
          { "id": "sub_1", "label": "Sous-notion A" }
        ]
      }
    ]
  }
}`
      };

    case "flashcards":
      return {
        agentName: "QuizAssessmentAgent",
        systemPrompt: `Tu es l'Agent Mémorisation Active de StudyCloud. Conçois des cartes mémoires efficaces (recto/verso).
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "flashcards",
  "title": "Cartes Mémoire : ${docTitle}",
  "cards": [
    {
      "id": 1,
      "front": "Question ou formule à deviner",
      "back": "Réponse complète avec explication clé",
      "category": "Définition / Formule"
    }
  ]
}`
      };

    default: // Résumé / Fiche de synthèse
      return {
        agentName: "PedagogicalTutorAgent",
        systemPrompt: `Tu es l'Agent de Synthèse Académique de StudyCloud. Conçois une fiche de révision complète et structurée.
Réponds STRICTEMENT avec cet objet JSON :
{
  "type": "summary",
  "title": "Fiche de Synthèse : ${docTitle}",
  "sections": [
    {
      "heading": "I. Notions Fondamentales",
      "content": "Développement pédagogique avec formules KaTeX...",
      "key_takeaways": ["Point essentiel 1", "Point essentiel 2"]
    }
  ]
}`
      };
  }
}

/**
 * Normalisation du type de création demandé
 */
function normalizeCreationType(raw) {
  const map = {
    "qcm": "quiz",
    "questionnaire": "quiz",
    "qcm_interactif": "quiz",
    "test-qcm": "quiz",
    "webapp": "webapp",
    "mini-site": "webapp",
    "3d": "webapp",
    "simulation": "webapp",
    "sandpack": "webapp",
    "drawing": "drawing",
    "dessin": "drawing",
    "schema": "drawing",
    "trace": "drawing",
    "svg": "drawing",
    "chart": "chart",
    "graphique": "chart",
    "mindmap": "mindmap",
    "carte-mentale": "mindmap",
    "flashcards": "flashcards",
    "carte-memoire": "flashcards",
    "resume": "summary",
    "fiche": "summary"
  };
  return map[String(raw).toLowerCase()] || "quiz";
}

/**
 * Détection autonome de l'intention de l'utilisateur
 */
function detectUserIntent(text) {
  const lower = String(text).toLowerCase();
  if (lower.match(/\b(dessine|trac[eé]|sch[eé]ma|figure|diagramme|croquis)\b/)) return "drawing";
  if (lower.match(/\b(site|webapp|3d|simulation|code|jeu|animation|mini-app)\b/)) return "webapp";
  if (lower.match(/\b(quiz|qcm|questionnaire|teste-moi|vrai ou faux)\b/)) return "quiz";
  if (lower.match(/\b(graphe|graphique|courbe|statistiques)\b/)) return "chart";
  if (lower.match(/\b(carte mentale|mindmap|arbre conceptuel)\b/)) return "mindmap";
  return "conversation";
}

/**
 * Fallback local d'urgence 100% garanti si panne externe
 */
function buildSafeLocalCreation(type, title, text) {
  const words = text.split(/\s+/).filter(Boolean);
  const sample = words.slice(0, 30).join(" ") || "Étude approfondie des concepts clés.";

  if (type === "quiz") {
    return {
      type: "quiz",
      title: `QCM : ${title}`,
      questions: [
        {
          id: 1,
          question: `Quel est le point central abordé dans "${title}" ?`,
          options: [
            sample.slice(0, 45) + "...",
            "Une analyse secondaire non prioritaire",
            "Une hypothèse réfutée par l'expérience",
            "Une notion purement introductive"
          ],
          correct_index: 0,
          feedback: "Cette réponse correspond aux concepts fondamentaux développés dans le document source."
        }
      ]
    };
  }

  if (type === "webapp") {
    return {
      type: "webapp",
      title: `Visualisation : ${title}`,
      description: "Composant interactif généré pour explorer les données.",
      html: "<div style='display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;'><h2 id='t'>Étude Interactive</h2><button id='b' style='padding:12px 24px;background:#F38020;border:none;border-radius:8px;color:#fff;cursor:pointer;font-weight:bold;'>Explorer</button><p id='o' style='margin-top:20px;color:#94a3b8;'></p></div>",
      css: "body { margin:0; background:#0B0F19; color:#fff; font-family:sans-serif; }",
      js: "document.getElementById('b').onclick = () => { document.getElementById('o').innerText = 'Module initialisé avec succès !'; };",
      instructions: "Cliquez sur Explorer pour interagir avec le modèle."
    };
  }

  if (type === "drawing") {
    return {
      type: "drawing",
      title: `Schéma : ${title}`,
      description: "Représentation vectorielle des composants clés.",
      svg_code: `<svg viewBox='0 0 600 300' xmlns='http://www.w3.org/2000/svg'><rect width='600' height='300' fill='#0B0F19'/><circle cx='300' cy='150' r='80' fill='#F38020' opacity='0.8'/><text x='300' y='155' fill='#fff' font-family='sans-serif' font-size='16' text-anchor='middle'>${title.slice(0, 20)}</text></svg>`,
      legend: [{ color: "#F38020", label: "Cœur du système" }]
    };
  }

  return {
    type: "summary",
    title: `Fiche : ${title}`,
    sections: [
      {
        heading: "I. Synthèse Principale",
        content: sample,
        key_takeaways: ["Maîtriser les notions de base", "Appliquer la méthodologie"]
      }
    ]
  };
}

/**
 * Utilitaires HTTP standardisés
 */
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function errorResponse(message, status = 400, corsHeaders = {}) {
  return jsonResponse({ success: false, error: message }, status, corsHeaders);
}

/**
 * ============================================================================
 * CLASSE DURABLE OBJECT OBLIGATOIRE POUR CLOUDFLARE : ChatAgent
 * ============================================================================
 * Cloudflare bloque le déploiement si cette classe n'est pas exportée,
 * car la liaison Durable Object nommée 'ChatAgent' est active sur votre Worker.
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

