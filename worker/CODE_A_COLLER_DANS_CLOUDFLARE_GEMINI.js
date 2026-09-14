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

        // Fonction helper : formate la réponse IA en routant vers le Chat et/ou l'Espace Création
        function formatAiResponsePayload(rawText, defaultType) {
          let mode = "chat";
          let chat_response = "";
          let creation_type = null;
          let creation_title = null;
          let creation_data = null;

          if (typeof rawText !== "string") {
            rawText = String(rawText || "");
          }

          const protectLatex = (str) => {
            return str.replace(/(\$\$?)([\s\S]*?)(\$\$?)/g, (_match, open, math, close) => {
              return open + math.replace(/\\/g, '\\\\') + close;
            });
          };

          const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          const tagMatch = rawText.match(/<creation[^>]*>([\s\S]*?)<\/creation>/i);
          const jsonRawCandidate = tagMatch ? tagMatch[1].trim() : (jsonBlockMatch ? jsonBlockMatch[1].trim() : (rawText.match(/(\{[\s\S]*\})/)?.[1]?.trim() || ""));

          let parsed = null;

          if (jsonRawCandidate) {
            try {
              let sanitized = jsonRawCandidate.replace(/,\s*([\]}])/g, '$1');
              parsed = JSON.parse(sanitized);
            } catch {
              try {
                let fixed = protectLatex(jsonRawCandidate)
                  .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\')
                  .replace(/,\s*([\]}])/g, '$1');
                parsed = JSON.parse(fixed);
              } catch {
                // Extraction regex chirurgicale du champ chat_response
                const chatMatch = jsonRawCandidate.match(/"chat_response"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
                if (chatMatch) {
                  try {
                    chat_response = JSON.parse(`"${protectLatex(chatMatch[1])}"`);
                  } catch {
                    chat_response = chatMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                  }
                }
              }
            }
          }

          if (parsed && typeof parsed === "object") {
            if (parsed.mode === "creation" || parsed.creation_type || parsed.creation_data) {
              mode = "creation";
              chat_response = parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ J'ai généré votre création directement dans votre espace à droite !");
              creation_type = parsed.creation_type || defaultType || "quiz";
              creation_title = parsed.creation_title || "Création";
              creation_data = parsed.creation_data || parsed;
            } else if (Array.isArray(parsed.questions)) {
              mode = "creation";
              creation_type = "quiz";
              creation_title = parsed.title || "Quiz interactif";
              creation_data = parsed;
              chat_response = parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ Voici votre questionnaire interactif préparé à droite !");
            } else if (parsed.root && (parsed.root.label || parsed.root.children)) {
              mode = "creation";
              creation_type = "mindmap";
              creation_title = parsed.root.label || "Carte mentale";
              creation_data = parsed;
              chat_response = parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ Voici votre carte mentale à droite !");
            } else if (parsed.overview || Array.isArray(parsed.keyPoints)) {
              mode = "creation";
              creation_type = "summary";
              creation_title = parsed.title || "Fiche de synthèse";
              creation_data = parsed;
              chat_response = parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ Voici votre résumé détaillé à droite !");
            } else if (Array.isArray(parsed.metrics) || Array.isArray(parsed.keyConcepts)) {
              mode = "creation";
              creation_type = "infographic";
              creation_title = parsed.mainTitle || "Infographie";
              creation_data = parsed;
              chat_response = parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ Voici vos repères visuels à droite !");
            } else if (Array.isArray(parsed.sections)) {
              mode = "creation";
              creation_type = "document";
              creation_title = parsed.title || "Fiche d'étude";
              creation_data = parsed;
              chat_response = parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ Voici votre fiche d'étude à droite !");
            } else if (parsed.mode === "chat" || parsed.chat_response) {
              mode = "chat";
              chat_response = parsed.chat_response || "";
            }
          }

          if (!chat_response) {
            const directRegex = /"chat_response"\s*:\s*"((?:[^"\\]|\\.)*)"/s.exec(rawText);
            if (directRegex) {
              try {
                chat_response = JSON.parse(`"${protectLatex(directRegex[1])}"`);
              } catch {
                chat_response = directRegex[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              }
            } else if (rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
              chat_response = rawText;
            } else {
              chat_response = rawText;
            }
          }

          return {
            mode,
            chat_response: chat_response || rawText,
            creation_type,
            creation_title,
            creation_data,
            response: chat_response || rawText
          };
        }

        // System prompt maître : Cerveau central autonome de StudyCloud (DKD)
        const masterSystemPrompt = `Tu es l'intelligence centrale autonome de l'application de cours StudyCloud (développée par DKD Technologies).
Tu es directement connectée à deux espaces distincts de l'interface de l'étudiant :
1. LE CHAT (Fil de discussion textuel) : Pour les questions simples, les explications, les calculs, le cours et le dialogue général.
2. L'ESPACE DE CRÉATION (Panneau droit interactif) : Réservé pour concevoir et afficher les outils interactifs :
   - 'quiz' : Questionnaires QCM interactifs (questions, choix A/B/C/D, réponse, explication)
   - 'mindmap' : Cartes mentales arborescentes (thème central, branches, sous-branches)
   - 'summary' : Fiches de résumé et synthèses structurées (vue d'ensemble, points clés, définitions, règles)
   - 'infographic' : Infographies, chiffres clés, repères visuels et notions
   - 'document' : Fiches d'étude complètes et polycopiés

TON RÔLE D'AUTONOMIE & PRISE DE CONSCIENCE DE L'INTERFACE :
- Analyse précisément l'intention de l'étudiant :
  * MODE CHAT (question simple, explication, calcul, salutation ou discussion générale) :
    -> Réponds DIRECTEMENT ET NATURELLEMENT en texte Markdown fluide (avec formules LaTeX syntaxe $...$ et $$...$$ si pertinent).
    -> RÈGLE CRUCIALE : NE METS AUCUN CODE JSON, PAS D'ACCOLADES {} NI DE BALISES JSON pour les réponses de chat ! Parle directement comme un tuteur bienveillant et pédagogue.
  * MODE CRÉATION (demande explicite de créer ou générer un QCM/quiz, carte mentale, résumé, infographie ou fiche d'étude) :
    -> Génère obligatoirement un objet JSON structuré (dans un bloc \`\`\`json ... \`\`\`) avec ce format :
    {
      "mode": "creation",
      "chat_response": "Court message amical d'accompagnement pour le fil de discussion",
      "creation_type": "quiz" | "mindmap" | "summary" | "infographic" | "document",
      "creation_title": "Titre explicite de la création",
      "creation_data": {
        // Données complètes selon le type (questions pour quiz, root pour mindmap, etc.)
      }
    }

RÈGLES D'EXCELLENCE :
- Pas de blabla inutile ni de règles artificielles.
- Si un document est fourni, exploite fidèlement ses notions réelles.
- Rédige toutes les formules scientifiques en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc).`;

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
          const formatted = formatAiResponsePayload(ansText, requestedType);
          return new Response(JSON.stringify({
            success: true,
            ...formatted,
            model: `Google Gemini (${usedGeminiModel})`,
            type: formatted.creation_type || requestedType || "text"
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
