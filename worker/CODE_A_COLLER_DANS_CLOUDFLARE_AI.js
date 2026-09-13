// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKERS AI (ASSISTANTE IA OFFICIELLE DKD)
// ============================================================================
// Domaine de déploiement : https://studycloud-ai.delmaskouassidibi.workers.dev
// Liaison Workers AI : MON-STUDYCLOUD-ia (ou STUDYCLOUD-IA, AI)
// Modèle IA principal : @cf/meta/llama-3.1-8b-instruct
//
// POUR METTRE À JOUR DANS CLOUDFLARE :
// 1. Allez sur votre Cloudflare Dashboard > Workers & Pages > studycloud-ai.
// 2. Cliquez sur "Edit code" (ou Quick Edit).
// 3. Copiez TOUT le code de ce fichier (Ctrl+A puis Ctrl+C).
// 4. Collez-le dans l'éditeur Cloudflare (Ctrl+A puis Ctrl+V).
// 5. Cliquez sur "Save and Deploy" (Enregistrer et déployer).
// ============================================================================

// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKERS AI (ASSISTANTE IA OFFICIELLE DKD)
// ============================================================================
// Domaine de déploiement : https://studycloud-ai.delmaskouassidibi.workers.dev
// Liaisons configurées dans Cloudflare :
// - Workers AI : MON-STUDYCLOUD-ia (ou STUDYCLOUD-IA, AI)
// - Base de données D1 : MON_D1_STUDYCLOUD (ou MON_D1-STUDYCLOUD, DB)
// - Bucket R2 : MON_R2_STUDYCLOUD (ou MON_R2-STUDYCLOUD, BUCKET)
// ============================================================================

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    };

    // Gestion du preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Détection universelle de la liaison Workers AI (nom officiel: MON-STUDYCLOUD-ia)
    const ai = env?.["MON-STUDYCLOUD-ia"] || 
               env?.MON_STUDYCLOUD_IA || 
               env?.["MON-STUDYCLOUD-IA"] || 
               env?.["STUDYCLOUD-IA"] || 
               env?.STUDYCLOUD_IA || 
               env?.AI || 
               env?.ai ||
               (env && typeof env === "object" ? Object.values(env).find(v => v && typeof v.run === "function") : null);

    // Détection de la base D1 et du bucket R2
    const db = env?.MON_D1_STUDYCLOUD || env?.["MON_D1-STUDYCLOUD"] || env?.DB;
    const bucket = env?.MON_R2_STUDYCLOUD || env?.["MON_R2-STUDYCLOUD"] || env?.BUCKET;

    // Auto-initialisation sécurisée de la table user_ai_workspace dans D1 si connectée
    if (db) {
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS user_ai_workspace (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            message_text TEXT NOT NULL,
            reaction TEXT DEFAULT NULL,
            attached_file_id TEXT,
            attached_file_name TEXT,
            attached_file_r2_key TEXT,
            attached_file_content TEXT,
            user_notes TEXT,
            is_pinned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      } catch (e) {}
    }

    // Requête GET : Test de santé et d'état du Worker IA
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const hasAi = Boolean(ai && typeof ai.run === "function");
      const availableBindings = env && typeof env === "object" ? Object.keys(env) : [];
      return new Response(JSON.stringify({
        service: "StudyCloud Workers AI Assistant (DKD Technologies)",
        status: hasAi ? "ready" : "missing_ai_binding",
        model: "@cf/meta/llama-3.1-8b-instruct",
        ai_binding_detected: hasAi,
        d1_database: db ? "Connecté (MON_D1_STUDYCLOUD)" : "Non lié",
        r2_bucket: bucket ? "Connecté (MON_R2_STUDYCLOUD)" : "Non lié",
        detected_bindings: availableBindings,
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    // Récupération de l'historique sécurisé par utilisateur
    if (request.method === "GET" && path === "/api/ai/workspace") {
      const userId = url.searchParams.get("userId");
      const sessionId = url.searchParams.get("sessionId");
      if (!userId) return new Response(JSON.stringify({ error: "userId requis" }), { status: 400, headers: corsHeaders });
      if (!db) return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });

      let q = "SELECT * FROM user_ai_workspace WHERE user_id = ?";
      const params = [userId];
      if (sessionId) {
        q += " AND session_id = ?";
        params.push(sessionId);
      }
      q += " ORDER BY created_at ASC";
      const { results } = await db.prepare(q).bind(...params).all();
      return new Response(JSON.stringify({ success: true, data: results || [] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Enregistrement des pouces (likes / dislikes)
    if (request.method === "PUT" && path === "/api/ai/workspace/reaction") {
      const body = await request.json().catch(() => ({}));
      const { userId, messageId, reaction } = body;
      if (!userId || !messageId) return new Response(JSON.stringify({ error: "userId et messageId requis" }), { status: 400, headers: corsHeaders });
      if (db) {
        await db.prepare("UPDATE user_ai_workspace SET reaction = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
          .bind(reaction || null, messageId, userId).run();
      }
      return new Response(JSON.stringify({ success: true, message: "Réaction enregistrée" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Retrait et suppression du document joint
    if (request.method === "DELETE" && path === "/api/ai/workspace/attachment") {
      const body = await request.json().catch(() => ({}));
      const { userId, fileId, r2Key } = body;
      if (!userId || !fileId) return new Response(JSON.stringify({ error: "userId et fileId requis" }), { status: 400, headers: corsHeaders });
      if (db) {
        await db.prepare(`
          UPDATE user_ai_workspace 
          SET attached_file_id = NULL, attached_file_name = NULL, attached_file_content = NULL, attached_file_r2_key = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND attached_file_id = ?
        `).bind(userId, fileId).run();
      }
      if (r2Key && bucket) {
        try { await bucket.delete(r2Key); } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true, message: "Pièce jointe retirée avec succès" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    try {
      if (!ai || typeof ai.run !== "function") {
        const bindingsList = env && typeof env === "object" ? Object.keys(env).join(", ") : "aucun";
        return new Response(JSON.stringify({
          success: false,
          error: `Liaison Workers AI introuvable. Liaisons actuelles : [${bindingsList}]. Dans Cloudflare > Workers > Settings > Variables and Bindings > Workers AI, ajoutez 'MON-STUDYCLOUD-ia'.`
        }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }

      const body = await request.json().catch(() => ({}));
      let messages = Array.isArray(body.messages) ? body.messages : [];
      const userPrompt = body.prompt || body.text || "";
      const userId = body.userId;
      const sessionId = body.sessionId || "default-session";

      if (messages.length === 0) {
        messages = [
          { role: "user", content: userPrompt || "Bonjour !" }
        ];
      }

      // Si un document PDF ou texte est joint, l'intégrer au contexte prioritaire
      if (body.attachedFileContent && typeof body.attachedFileContent === "string" && body.attachedFileContent.trim().length > 0) {
        const docTitle = body.attachedFileName || "Document joint";
        const maxDocChars = 32000;
        const cleanDocContent = body.attachedFileContent.slice(0, maxDocChars);
        messages.unshift({
          role: "system",
          content: `=== DOCUMENT JOINT DE L'ÉLÈVE ("${docTitle}") ===\n${cleanDocContent}\n=== FIN DU DOCUMENT ===\nInstructions : Tu as un accès COMPLET et DIRECT à ce document. Réponds précisément aux questions de l'élève en t'appuyant rigoureusement sur les leçons, théorèmes, exercices et explications contenus dans ce fichier.`
        });
      }

      const hasSystemMessage = messages.some(m => m.role === "system");
      if (!hasSystemMessage) {
        messages.unshift({
          role: "system",
          content: "Tu es l'assistante IA officielle de la plateforme StudyCloud, créée par DKD Technologies. Tu es une tutrice académique et pédagogique bienveillante, dynamique, très claire et structurée. Tu réponds TOUJOURS en français avec des explications simples, complètes et faciles à comprendre pour aider l'élève ou l'étudiant dans ses révisions, ses devoirs et sa compréhension des documents."
        });
      }

      const candidateModels = [
        "@cf/meta/llama-3.1-8b-instruct",
        "@cf/meta/llama-3.2-3b-instruct",
        "@cf/meta/llama-3.1-8b-instruct-fast",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/mistral/mistral-7b-instruct-v0.2"
      ];

      let aiResult = null;
      let usedModel = "";
      let lastError = null;

      for (const m of candidateModels) {
        try {
          aiResult = await ai.run(m, {
            messages: messages,
            max_tokens: 1500,
            temperature: 0.65,
          });
          usedModel = m;
          break;
        } catch (err) {
          lastError = err;
          console.warn(`Modèle ${m} a échoué:`, err?.message || err);
        }
      }

      if (!aiResult) {
        throw lastError || new Error("Aucun modèle IA n'a pu répondre");
      }

      let replyText = "";
      if (typeof aiResult?.response === "string") {
        replyText = aiResult.response;
      } else if (typeof aiResult === "string") {
        replyText = aiResult;
      } else if (aiResult && typeof aiResult === "object") {
        replyText = aiResult.response || aiResult.text || JSON.stringify(aiResult);
      }

      // Sauvegarde sécurisée isolée par utilisateur dans D1 si connecté
      if (userId && db) {
        try {
          const userMsgId = crypto.randomUUID();
          const aiMsgId = crypto.randomUUID();

          await db.prepare(`
            INSERT INTO user_ai_workspace (id, user_id, session_id, role, message_text, attached_file_id, attached_file_name, attached_file_r2_key, attached_file_content)
            VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?)
          `).bind(
            userMsgId,
            userId,
            sessionId,
            userPrompt,
            body.attachedFileId || null,
            body.attachedFileName || null,
            body.attachedFileR2Key || null,
            body.attachedFileContent || null
          ).run();

          await db.prepare(`
            INSERT INTO user_ai_workspace (id, user_id, session_id, role, message_text)
            VALUES (?, ?, ?, 'assistant', ?)
          `).bind(
            aiMsgId,
            userId,
            sessionId,
            replyText
          ).run();
        } catch (dbSaveErr) {
          console.warn("[Workspace AI] Erreur sauvegarde D1:", dbSaveErr);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        response: replyText,
        model: usedModel,
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

