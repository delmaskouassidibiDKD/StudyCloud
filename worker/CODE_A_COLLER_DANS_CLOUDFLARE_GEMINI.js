// ============================================================================
// STUDYCLOUD - WORKER GOOGLE GEMINI DÉDIÉ (studycloud-gemini)
// ============================================================================
// Nom du Worker dans Cloudflare : studycloud-gemini
// Modèle IA : Google Gemini 2.0 Flash (Google AI Studio)
//
// POUR INSTALLER / METTRE À JOUR DANS CLOUDFLARE :
// 1. Allez sur votre Cloudflare Dashboard > Workers & Pages > studycloud-gemini.
//    (Si ce Worker n'existe pas encore, créez-le : "Create Worker" > nommez-le "studycloud-gemini").
// 2. Cliquez sur "Edit code" (ou Quick Edit).
// 3. Copiez TOUT le code de ce fichier (Ctrl+A puis Ctrl+C).
// 4. Collez-le dans l'éditeur Cloudflare (Ctrl+A puis Ctrl+V).
// 5. Cliquez sur "Deploy" (Enregistrer et Déployer).
// 6. Ajoutez votre clé secrète dans Settings > Variables and Secrets :
//    - Variable : GEMINI_API_KEY
//    - Valeur : Votre clé Google AI Studio (ex: AIzaSy...)
// ============================================================================

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-requested-with",
    };

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Détection de la clé API Gemini
    const geminiApiKey = env?.GEMINI_API_KEY || 
                         env?.GOOGLE_API_KEY || 
                         env?.GEMINI_KEY || 
                         env?.GEMINI_TOKEN || 
                         env?.STUDYCLOUD_GEMINI_KEY;

    // Route de santé / test de configuration (GET)
    if (request.method === "GET") {
      return new Response(JSON.stringify({
        service: "StudyCloud Gemini Worker (DKD Technologies)",
        worker_name: "studycloud-gemini",
        model: "Google Gemini 2.0 Flash",
        status: geminiApiKey ? "ready" : "missing_gemini_api_key",
        gemini_api_key_configured: Boolean(geminiApiKey),
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    // Traitement des requêtes POST
    if (request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const userPrompt = body.message || body.prompt || body.text || "";
        const requestedType = (body.requested_type || body.toolType || body.type || "").toLowerCase().trim();

        // Clé API prioritaire : passée dans la requête ou stockée dans Cloudflare
        const effectiveApiKey = body.geminiApiKey || body.gemini_api_key || geminiApiKey;

        if (!effectiveApiKey) {
          return new Response(JSON.stringify({
            success: false,
            model: "Google Gemini 2.0 Flash (Clé manquante)",
            error: "GEMINI_API_KEY non configurée",
            response: "⚡ **Worker studycloud-gemini : Clé API requise**\n\nPour que Google Gemini 2.0 Flash puisse vous répondre :\n1. Allez dans Cloudflare Dashboard > Workers & Pages > **studycloud-gemini**.\n2. Allez dans **Settings** > **Variables and Secrets**.\n3. Ajoutez la variable secrète **`GEMINI_API_KEY`** avec votre clé Google AI Studio.\n\n*(Obtenez votre clé gratuite en 1 clic sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey))*"
          }), {
            headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
            status: 200
          });
        }

        // System prompt maître : libre, direct et performant (DKD)
        const masterSystemPrompt = `Tu es l'assistant d'intelligence artificielle d'élite de StudyCloud (développé par DKD Technologies).
Tu es extrêmement intelligent, direct, clair et efficace.
Tu réponds avec un raisonnement approfondi, rigoureux et naturel, exactement comme dans le chat et les conversations de haut niveau.
- Pas de blabla inutile, pas de formules toutes faites ni de structures artificielles imposées.
- Réponds avec précision, créativité et pertinence à la demande exacte de l'utilisateur (questions, explications, synthèses, QCM, quiz, cartes mentales, infographies, résumés, fiches, etc.).
- Si un document est fourni, appuie-toi fidèlement et en profondeur sur son contenu réel.
- Pour toutes les notations et formules scientifiques ou mathématiques, utilise la syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc centré).`;

        // Récupération du document joint
        const rawDocContent = (
          (typeof body.attachedFileContent === "string" && body.attachedFileContent) ||
          (typeof body.file_content === "string" && body.file_content) ||
          (typeof body.fileContent === "string" && body.fileContent) ||
          (typeof body.documentContent === "string" && body.documentContent) ||
          (typeof body.documentText === "string" && body.documentText) ||
          ""
        ).trim();

        let systemInstructionText = masterSystemPrompt;
        if (rawDocContent.length > 0) {
          const docTitle = body.attachedFileName || body.file_name || body.fileName || "Document de cours";
          systemInstructionText += `\n\nCONTENU DU DOCUMENT JOINT ("${docTitle}") :\n${rawDocContent.slice(0, 100000)}\nFIN DU DOCUMENT.`;
        }

        // Construction de l'historique Gemini
        const geminiContents = [];
        const incomingHist = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        for (const m of incomingHist.slice(-10)) {
          if (m && m.role && m.content && m.role !== "system") {
            geminiContents.push({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: String(m.content) }]
            });
          }
        }
        geminiContents.push({
          role: "user",
          parts: [{ text: userPrompt || "Bonjour !" }]
        });

        let ansText = "";
        let usedGeminiModel = "";
        let googleError = "";
        const candidateGeminiModels = [
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-2.5-flash",
          "gemini-1.5-flash",
          "gemini-2.0-flash"
        ];

        for (const mod of candidateGeminiModels) {
          try {
            const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${effectiveApiKey}`;
            const gResponse = await fetch(geminiApiEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstructionText }] },
                contents: geminiContents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 4000,
                }
              })
            });

            if (gResponse.ok) {
              const gData = await gResponse.json();
              const candidateText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText && candidateText.trim()) {
                ansText = candidateText.trim();
                usedGeminiModel = mod;
                break;
              }
            } else {
              const errData = await gResponse.json().catch(() => ({}));
              googleError = errData?.error?.message || `Erreur HTTP ${gResponse.status}`;
              if (gResponse.status === 404 || googleError.includes("no longer available") || googleError.includes("not found")) {
                continue;
              }
            }
          } catch (e) {
            googleError = e?.message || String(e);
          }
        }

        if (ansText) {
          return new Response(JSON.stringify({
            success: true,
            response: ansText,
            model: `Google Gemini (${usedGeminiModel})`,
            type: requestedType || "text"
          }), {
            headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: false,
          model: "Google Gemini 2.0 Flash (Erreur)",
          error: googleError,
          response: `⚠️ **Erreur Google Gemini (${googleError})**\n\nVeuillez vérifier la validité de votre clé API dans les secrets du Worker Cloudflare ou sur Google AI Studio.`
        }), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: err?.message || String(err),
          response: `Erreur interne Worker Gemini : ${err?.message || err}`
        }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ error: "Route non trouvée" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
    });
  }
};
