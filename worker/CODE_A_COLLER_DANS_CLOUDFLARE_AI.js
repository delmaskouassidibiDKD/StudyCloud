// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKERS AI (ASSISTANTE IA OFFICIELLE DKD)
// ============================================================================
// Domaine de déploiement : https://studycloud-ai.delmaskouassidibi.workers.dev
// Liaison Workers AI supportée : STUDYCLOUD-IA ou AI
// Modèle IA : @cf/meta/llama-3-8b-instruct
//
// POUR METTRE À JOUR DANS CLOUDFLARE :
// 1. Allez sur votre Cloudflare Dashboard > Workers & Pages > studycloud-ai.
// 2. Cliquez sur "Edit code" (ou Quick Edit).
// 3. Copiez TOUT le code de ce fichier (Ctrl+A puis Ctrl+C).
// 4. Collez-le dans l'éditeur Cloudflare (Ctrl+A puis Ctrl+V).
// 5. Cliquez sur "Save and Deploy" (Enregistrer et déployer).
// ============================================================================

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    };

    // Gestion du preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // Détection universelle et automatique de la liaison Workers AI
    // (Supporte STUDYCLOUD-IA, STUDYCLOUD_IA, AI, ou tout binding ayant la fonction run)
    const ai = env?.["STUDYCLOUD-IA"] || 
               env?.STUDYCLOUD_IA || 
               env?.["STUDYCLOUD-AI"] || 
               env?.STUDYCLOUD_AI || 
               env?.["studycloud-ia"] || 
               env?.studycloud_ia || 
               env?.AI || 
               env?.ai ||
               (env && typeof env === "object" ? Object.values(env).find(v => v && typeof v.run === "function") : null);

    // Requête GET : Test de santé et d'état du Worker
    if (request.method === "GET") {
      const hasAi = Boolean(ai && typeof ai.run === "function");
      const availableBindings = env && typeof env === "object" ? Object.keys(env) : [];
      return new Response(JSON.stringify({
        service: "StudyCloud Workers AI Assistant (DKD Technologies)",
        status: hasAi ? "ready" : "missing_ai_binding",
        model: "@cf/meta/llama-3-8b-instruct",
        ai_binding_detected: hasAi,
        detected_bindings: availableBindings,
        message: hasAi 
          ? "L'IA StudyCloud est 100% opérationnelle et prête à répondre !"
          : "Attention : aucune liaison Workers AI n'a été détectée. Vérifiez vos liaisons dans Cloudflare (Settings > Variables and Bindings > Workers AI).",
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    try {
      // 1. Vérification de la liaison Workers AI
      if (!ai || typeof ai.run !== "function") {
        const bindingsList = env && typeof env === "object" ? Object.keys(env).join(", ") : "aucun";
        return new Response(JSON.stringify({
          success: false,
          error: `Liaison Workers AI introuvable. Liaisons actuelles : [${bindingsList}]. Dans Cloudflare Dashboard > Settings > Variables and Bindings > Workers AI, ajoutez une liaison nommée 'STUDYCLOUD-IA' ou 'AI'.`
        }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }

      // 2. Lecture du corps de la requête
      const body = await request.json().catch(() => ({}));
      let messages = Array.isArray(body.messages) ? body.messages : [];
      const userPrompt = body.prompt || body.text || "";

      // Si aucune liste de messages n'est fournie, construire à partir du prompt
      if (messages.length === 0) {
        messages = [
          { role: "user", content: userPrompt || "Bonjour !" }
        ];
      }

      // S'assurer que le premier message est le prompt système pédagogique StudyCloud DKD
      const hasSystemMessage = messages.some(m => m.role === "system");
      if (!hasSystemMessage) {
        messages.unshift({
          role: "system",
          content: "Tu es l'assistante IA officielle de la plateforme StudyCloud, créée par DKD Technologies. Tu es une tutrice académique et pédagogique bienveillante, dynamique, très claire et structurée. Tu réponds TOUJOURS en français avec des explications simples, complètes et faciles à comprendre pour aider l'élève ou l'étudiant dans ses révisions, ses devoirs et sa compréhension des documents."
        });
      }

      // 3. Exécution du modèle LLaMA 3 8B Instruct de Cloudflare Workers AI
      const model = "@cf/meta/llama-3-8b-instruct";
      const aiResult = await ai.run(model, {
        messages: messages,
        max_tokens: 1200,
        temperature: 0.65,
      });

      // Extraction du texte de réponse
      let replyText = "";
      if (typeof aiResult?.response === "string") {
        replyText = aiResult.response;
      } else if (typeof aiResult === "string") {
        replyText = aiResult;
      } else if (aiResult && typeof aiResult === "object") {
        replyText = aiResult.response || aiResult.text || JSON.stringify(aiResult);
      }

      return new Response(JSON.stringify({
        success: true,
        response: replyText,
        model: model,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message || "Erreur interne lors de l'exécution de l'IA.",
        details: String(err)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }
  }
};
