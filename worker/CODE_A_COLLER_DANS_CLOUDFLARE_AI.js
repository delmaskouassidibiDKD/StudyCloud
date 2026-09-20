// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKERS AI (ASSISTANTE IA OFFICIELLE DKD)
// ============================================================================
// Domaine de déploiement : https://studycloud-ai.delmaskouassidibi.workers.dev
// Modèle IA principal : Google Gemini 2.0 Flash (avec fallback Cloudflare Llama 3.1)
// Variable secrète requise dans Cloudflare : StudyCloud-gemini (Clé API Google Gemini)
//
// POUR METTRE À JOUR DANS CLOUDFLARE :
// 1. Allez sur votre Cloudflare Dashboard > Workers & Pages > studycloud-ai.
// 2. Cliquez sur "Edit code" (ou Quick Edit).
// 3. Copiez TOUT le code de ce fichier (Ctrl+A puis Ctrl+C).
// 4. Collez-le dans l'éditeur Cloudflare (Ctrl+A puis Ctrl+V).
// 5. Cliquez sur "Save and Deploy" (Enregistrer et déployer).
// ============================================================================

export default {
  async fetch(request, env, ctx) {
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

    // Initialisation automatique des tables D1 pour le Worker IA (Isolation multi-utilisateurs)
    if (db && !globalThis._aiSchemaInit) {
      try {
        await db.batch([
          db.prepare(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
          db.prepare(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
          db.prepare(`CREATE TABLE IF NOT EXISTS ai_creations (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, message_id TEXT, type TEXT NOT NULL, title TEXT, content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
          db.prepare(`CREATE TABLE IF NOT EXISTS ai_generated_contents (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, file_id TEXT, tool_type TEXT NOT NULL, title TEXT NOT NULL, content_json TEXT NOT NULL DEFAULT '{}', source_file_name TEXT, is_pinned INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
          db.prepare(`CREATE TABLE IF NOT EXISTS user_ai_workspace (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT NOT NULL, role TEXT NOT NULL, message_text TEXT NOT NULL, reaction TEXT DEFAULT NULL, attached_file_id TEXT, attached_file_name TEXT, attached_file_r2_key TEXT, attached_file_content TEXT, user_notes TEXT, is_pinned INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
          db.prepare(`CREATE TABLE IF NOT EXISTS ai_tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT, task_type TEXT NOT NULL, status TEXT NOT NULL, prompt TEXT, result_json TEXT, error_message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`)
        ]);
        globalThis._aiSchemaInit = true;
      } catch (schemaErr) {
        console.warn("[AI D1 Init]", schemaErr);
      }
    }

    // Requête GET : Test de santé et d'état du Worker IA
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const hasAi = Boolean(ai && typeof ai.run === "function");
      const geminiKeyPresent = Boolean(
        env?.["StudyCloud-gemini"] ||
        env?.["studycloud-gemini"] ||
        env?.STUDYCLOUD_GEMINI ||
        env?.GEMINI_API_KEY
      );
      return new Response(JSON.stringify({
        service: "StudyCloud IA Assistant & Creation Engine (DKD Technologies)",
        status: "ready",
        brain: "Google Gemini 2.0 Flash (avec décision autonome)",
        gemini_configured: geminiKeyPresent,
        cf_ai_fallback: hasAi,
        d1_database: db ? "Connecté (MON_D1_STUDYCLOUD)" : "Non lié",
        r2_bucket: bucket ? "Connecté (MON_R2_STUDYCLOUD)" : "Non lié",
        modules_count: 12,
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

    // Enregistrement des réactions (likes / dislikes)
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

    // Retrait du document joint
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
        try { await bucket.delete(r2Key); } catch (e) { }
      }
      return new Response(JSON.stringify({ success: true, message: "Pièce jointe retirée avec succès" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Gestion des créations IA (table ai_generated_contents)
    if (request.method === "GET" && path === "/api/ai-contents") {
      const userId = url.searchParams.get("userId");
      const toolType = url.searchParams.get("toolType");
      const fileId = url.searchParams.get("fileId");
      if (!userId) return new Response(JSON.stringify({ error: "userId requis" }), { status: 400, headers: corsHeaders });
      if (!db) return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });

      let q = "SELECT * FROM ai_generated_contents WHERE user_id = ?";
      const params = [userId];
      if (toolType) {
        q += " AND tool_type = ?";
        params.push(toolType);
      }
      if (fileId) {
        q += " AND file_id = ?";
        params.push(fileId);
      }
      q += " ORDER BY is_pinned DESC, updated_at DESC";
      const { results } = await db.prepare(q).bind(...params).all();
      return new Response(JSON.stringify({ success: true, data: results || [] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method === "POST" && path === "/api/ai-contents") {
      const body = await request.json().catch(() => ({}));
      const { id, userId, fileId, toolType, title, contentJson, sourceFileName, isPinned } = body;
      if (!userId || !toolType || !title) {
        return new Response(JSON.stringify({ error: "userId, toolType et title requis" }), { status: 400, headers: corsHeaders });
      }
      if (db) {
        const contentStr = typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson || {});
        await db.prepare(`
          INSERT INTO ai_generated_contents (id, user_id, file_id, tool_type, title, content_json, source_file_name, is_pinned, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, content_json = excluded.content_json, is_pinned = excluded.is_pinned, updated_at = CURRENT_TIMESTAMP
        `).bind(id || crypto.randomUUID(), userId, fileId || null, toolType, title, contentStr, sourceFileName || null, isPinned ? 1 : 0).run();
      }
      return new Response(JSON.stringify({ success: true, message: "Contenu IA sauvegardé" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method === "PUT" && path.startsWith("/api/ai-contents/") && path.endsWith("/pin")) {
      const id = path.replace("/api/ai-contents/", "").replace("/pin", "");
      const body = await request.json().catch(() => ({}));
      const { isPinned } = body;
      if (db) {
        await db.prepare("UPDATE ai_generated_contents SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(isPinned ? 1 : 0, id).run();
      }
      return new Response(JSON.stringify({ success: true, message: "Statut épinglé mis à jour" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method === "DELETE" && path.startsWith("/api/ai-contents/")) {
      const id = path.replace("/api/ai-contents/", "");
      if (db) {
        await db.prepare("DELETE FROM ai_generated_contents WHERE id = ?").bind(id).run();
      }
      return new Response(JSON.stringify({ success: true, message: "Contenu supprimé avec succès" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Conversations de chat
    if (request.method === "GET" && path === "/api/ai/conversations") {
      const userId = url.searchParams.get("userId");
      if (!userId) return new Response(JSON.stringify({ error: "userId requis" }), { status: 400, headers: corsHeaders });
      if (!db) return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });

      try {
        const { results } = await db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC").bind(userId).all();
        return new Response(JSON.stringify({ success: true, data: results || [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message, data: [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "POST" && path === "/api/ai/conversations") {
      const body = await request.json().catch(() => ({}));
      const { id, userId, title } = body;
      if (!userId) return new Response(JSON.stringify({ error: "userId requis" }), { status: 400, headers: corsHeaders });
      if (!db) return new Response(JSON.stringify({ success: true, data: { id: id || crypto.randomUUID() } }), { headers: corsHeaders });

      const convId = id || crypto.randomUUID();
      const convTitle = title || "Nouvelle discussion";

      try {
        await db.prepare(`
          INSERT INTO conversations (id, user_id, title, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP
        `).bind(convId, userId, convTitle).run();

        return new Response(JSON.stringify({ success: true, data: { id: convId, title: convTitle } }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "DELETE" && path === "/api/ai/conversations") {
      const convId = url.searchParams.get("id");
      if (!convId) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers: corsHeaders });
      if (db) {
        try {
          await db.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(convId).run();
          await db.prepare("DELETE FROM ai_creations WHERE conversation_id = ?").bind(convId).run();
          await db.prepare("DELETE FROM conversations WHERE id = ?").bind(convId).run();
        } catch (e) { }
      }
      return new Response(JSON.stringify({ success: true, message: "Conversation supprimée" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Messages de conversation
    if (request.method === "GET" && path === "/api/ai/messages") {
      const conversationId = url.searchParams.get("conversationId");
      if (!conversationId) return new Response(JSON.stringify({ error: "conversationId requis" }), { status: 400, headers: corsHeaders });
      if (!db) return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });

      try {
        const { results } = await db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").bind(conversationId).all();
        return new Response(JSON.stringify({ success: true, data: results || [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message, data: [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "POST" && path === "/api/ai/messages") {
      const body = await request.json().catch(() => ({}));
      const { id, conversationId, role, content, metadata } = body;
      if (!conversationId || !role || !content) {
        return new Response(JSON.stringify({ error: "conversationId, role et content requis" }), { status: 400, headers: corsHeaders });
      }
      if (db) {
        const msgId = id || crypto.randomUUID();
        const metaStr = typeof metadata === "string" ? metadata : JSON.stringify(metadata || {});
        try {
          await db.prepare(`
            INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(msgId, conversationId, role, content, metaStr).run();

          await db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(conversationId).run();
        } catch (e) { }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Créations IA associées
    if (request.method === "GET" && path === "/api/ai/creations") {
      const conversationId = url.searchParams.get("conversationId");
      if (!conversationId) return new Response(JSON.stringify({ error: "conversationId requis" }), { status: 400, headers: corsHeaders });
      if (!db) return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });

      try {
        const { results } = await db.prepare("SELECT * FROM ai_creations WHERE conversation_id = ? ORDER BY created_at DESC").bind(conversationId).all();
        return new Response(JSON.stringify({ success: true, data: results || [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message, data: [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "POST" && path === "/api/ai/creations") {
      const body = await request.json().catch(() => ({}));
      const { id, conversationId, messageId, type, title, content } = body;
      if (!conversationId || !type || !content) {
        return new Response(JSON.stringify({ error: "conversationId, type et content requis" }), { status: 400, headers: corsHeaders });
      }
      if (db) {
        const creationId = id || crypto.randomUUID();
        const contentStr = typeof content === "string" ? content : JSON.stringify(content);
        try {
          await db.prepare(`
            INSERT INTO ai_creations (id, conversation_id, message_id, type, title, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content
          `).bind(creationId, conversationId, messageId || null, type, title || null, contentStr).run();
        } catch (e) { }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Helper : formate et parse la décision et les données de création
    function parseAiDecision(rawText, defaultType) {
      let decision = "chat";
      let chat_message = rawText;
      let creation_type = null;
      let creation_title = null;
      let creation_data = null;

      if (typeof rawText !== "string") {
        rawText = String(rawText || "");
      }

      const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const tagMatch = rawText.match(/<creation[^>]*>([\s\S]*?)<\/creation>/i);
      const jsonRawCandidate = tagMatch ? tagMatch[1].trim() : (jsonBlockMatch ? jsonBlockMatch[1].trim() : (rawText.match(/(\{[\s\S]*\})/)?.[1]?.trim() || ""));

      if (jsonRawCandidate) {
        try {
          let sanitized = jsonRawCandidate.replace(/,\s*([\]}])/g, '$1');

          // Protection des antislashs LaTeX non échappés pour éviter les crashs de JSON.parse
          sanitized = sanitized.replace(/\\f(?=rac\b)/g, '\\\\f');
          sanitized = sanitized.replace(/\\t(?=imes\b)/g, '\\\\t');
          sanitized = sanitized.replace(/\\b(?=egin\b|inom\b)/g, '\\\\b');
          sanitized = sanitized.replace(/\\([a-zA-Z]+)/g, (match, cmd) => {
            if (['n', 'r', 't', 'b', 'f'].includes(cmd)) return match;
            return '\\\\' + cmd;
          });

          let parsed = null;
          try {
            parsed = JSON.parse(sanitized);
          } catch {
            // Deuxième passe de secours en doublant les antislashs restants
            const fallbackEscaped = jsonRawCandidate
              .replace(/\\/g, '\\\\')
              .replace(/\\\\"/g, '\\"')
              .replace(/\\\\n/g, '\\n')
              .replace(/\\\\r/g, '\\r')
              .replace(/\\\\t/g, '\\t');
            parsed = JSON.parse(fallbackEscaped);
          }

          if (parsed && typeof parsed === "object") {
            if (parsed.decision === "creation" || parsed.mode === "creation" || parsed.creation_type || parsed.creation_data) {
              decision = "creation";
              chat_message = parsed.chat_message || parsed.chat_response || (rawText.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim() || "✨ J'ai généré votre création directement dans votre espace Création à droite !");
              creation_type = parsed.creation_type || defaultType || "questionnaire";
              creation_title = parsed.creation_title || "Création IA";
              creation_data = typeof parsed.creation_data === "string" ? (() => { try { return JSON.parse(parsed.creation_data); } catch { return parsed.creation_data; } })() : (parsed.creation_data || parsed);
            } else if (Array.isArray(parsed.questions)) {
              decision = "creation";
              creation_type = defaultType || "questionnaire";
              creation_title = parsed.title || "Questionnaire interactif";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Voici votre questionnaire interactif préparé à droite !";
            } else if (Array.isArray(parsed.affirmations)) {
              decision = "creation";
              creation_type = defaultType || "vrai-ou-faux";
              creation_title = parsed.title || "Vrai ou Faux";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Voici vos affirmations Vrai ou Faux prêtes à droite !";
            } else if (Array.isArray(parsed.cards) || Array.isArray(parsed.flashcards)) {
              decision = "creation";
              creation_type = defaultType || "carte-memoire";
              creation_title = parsed.title || "Cartes Mémoire";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Vos cartes mémoire (flashcards) sont prêtes dans l'espace Création !";
            } else if (parsed.mind_map || parsed.mindmap || parsed.branches || parsed.root || parsed.rootTitle || parsed.root_title) {
              decision = "creation";
              creation_type = defaultType || "carte-mentale";
              const mm = parsed.mind_map || parsed.mindmap || parsed;
              creation_title = mm.root_title || mm.rootTitle || mm.title || parsed.rootTitle || parsed.root?.text || "Carte Mentale";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre carte mentale est prête à droite !";
            } else if (parsed.summary || parsed.overview || Array.isArray(parsed.sections)) {
              decision = "creation";
              creation_type = defaultType || "resume";
              const sum = (parsed.summary && typeof parsed.summary === "object" && !Array.isArray(parsed.summary)) ? parsed.summary : parsed;
              creation_title = sum.title || parsed.title || "Fiche de Synthèse";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre fiche de synthèse est prête à droite !";
            } else if (parsed.pdf_document || Array.isArray(parsed.chapters) || (defaultType === "pdf" && (parsed.pages || parsed.sections))) {
              decision = "creation";
              creation_type = defaultType || "pdf";
              const pdfDoc = (parsed.pdf_document && typeof parsed.pdf_document === "object") ? parsed.pdf_document : parsed;
              creation_title = pdfDoc.metadata?.title || pdfDoc.title || parsed.title || "Document PDF";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre document PDF officiel est prêt à droite !";
            } else if (parsed.infographic || Array.isArray(parsed.steps) || (parsed.steps && typeof parsed.steps === "object") || Array.isArray(parsed.metrics) || defaultType === "infographie" || defaultType === "infographic") {
              decision = "creation";
              creation_type = "infographie";
              const info = (parsed.infographic && typeof parsed.infographic === "object") ? parsed.infographic : parsed;
              creation_title = info.title || info.mainTitle || parsed.title || "Infographie Pédagogique";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre infographie visuelle et descriptive est prête dans l'espace Création !";
            } else if (parsed.written_exercise || Array.isArray(parsed.exercises) || Array.isArray(parsed.exercices) || (defaultType === "exercices-ecrits" && Array.isArray(parsed.questions))) {
              decision = "creation";
              creation_type = "exercices-ecrits";
              const we = parsed.written_exercise || parsed;
              creation_title = we.title || parsed.title || "Exercice Écrit & Résolution de Problème";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre exercice écrit et sa correction détaillée sont prêts dans l'espace Création !";
            } else if (parsed.baremeTotal || parsed.exercice1) {
              decision = "creation";
              creation_type = defaultType || "devoir-complet";
              creation_title = parsed.title || "Devoir Complet";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre devoir complet d'examen est prêt à droite !";
            } else if (parsed.decision === "chat" || parsed.mode === "chat") {
              decision = "chat";
              chat_message = parsed.chat_message || parsed.chat_response || rawText;
            }
          }
        } catch {
          // En cas d'erreur de parsing, conserver mode chat
        }
      }

      if (defaultType && decision !== "creation") {
        decision = "creation";
        creation_type = defaultType;
        creation_title = "Création IA";
      }

      return {
        decision,
        mode: decision,
        chat_message: chat_message || rawText,
        chat_response: chat_message || rawText,
        response: chat_message || rawText,
        creation_type,
        creation_title,
        creation_data
      };
    }

    // Le Prompt Système Maître officiel StudyCloud
    const masterSystemPrompt = `Tu es l'intelligence artificielle centrale autonome de l'application de cours StudyCloud (développée par DKD Technologies).
Ton rôle est d'analyser chaque prompt envoyé par l'étudiant et d'opérer la DÉCISION selon le flux officiel suivant :

======================================================================
FLUX DE DÉCISION OBLIGATOIRE :
======================================================================
[Prompt de l'utilisateur]
        │
        ▼
[Gemini : analyse du prompt envoyé]
        │
        ▼
    < DÉCISION >
   ╱            ╲
  ╱              ╲
[DÉCISION: "chat"]      [DÉCISION: "creation"]
(Menu de discussion)             │
  -> Répondre simplement        ▼
     dans le chat      < Choix de création en fonction du prompt >
                        ├── 1. Questionnaire / Questionnaire Test (QCM interactif)
                        ├── 2. Vrai ou Faux / Vrai ou Faux Test (Cartes réflexes)
                        ├── 3. Carte Mentale / Carte Mentale 2 (Arborescence et blocs conceptuels)
                        ├── 4. Carte Mémoire (Flashcards de mémorisation espacée)
                        ├── 5. Résumé (Fiche de synthèse didactique)
                        ├── 6. PDF (Document complet prêt pour export)
                        ├── 7. Infographie (Repères visuels et métriques)
                        ├── 8. Exercices Écrits (Problèmes rédigés avec corrigés types)
                        └── 9. Devoir Complet (Épreuve complète chronométrée sur 20 points)
                                │
                                ▼
                       [Résultat attendu dans le menu création]

======================================================================
RÈGLES DE DÉCISION :
======================================================================
1. DÉCISION "chat" (Discussion) :
   - Si l'étudiant pose une question de cours, demande une explication, fait un calcul, demande de l'aide générale ou discute :
   - Ton mode est "chat".
   - Tu fournis une réponse claire, bienveillante et pédagogique dans "chat_message".
   - Rédige toutes les formules scientifiques en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc).

2. DÉCISION "creation" (Création de module) :
   - Si l'étudiant demande de créer un contenu d'étude, OU si un module spécifique est demandé, OU s'il a cliqué sur un bouton d'action :
   - Ton mode est "creation".
   - Tu sélectionnes le 'creation_type' exact parmi les 12 modules :
     * 'questionnaire' : QCM formatif interactif (3 à 5 questions) avec feedback immédiat après chaque réponse
     * 'questionnaire-test' : Questionnaire test / examen complet (5 à 10 questions notées) avec révélation des corrections et note finale sur 20
     * 'vrai-ou-faux' : Affirmations réflexes ciblées
     * 'vrai-ou-faux-test' : Test noté d'affirmations à cocher
     * 'carte-mentale' : Carte mentale arborescente dynamique
     * 'carte-mentale-2' : Carte conceptuelle en blocs hiérarchiques
     * 'carte-memoire' : Flashcards de mémorisation espacée
     * 'resume' : Fiche synthétique structurée
     * 'pdf' : Polycopié ou document officiel imprimable
     * 'infographie' : Repères visuels, chiffres clés et étapes
     * 'exercices-ecrits' : Problèmes avec barème et corrigé type
     * 'devoir-complet' : Examen complet sur 20 points
   - Dans "chat_message", écris une courte phrase amicale confirmant la mise à disposition du module dans le menu création à droite.
   - Dans "creation_data", fournis l'objet JSON complet et rigoureusement structuré correspondant au module.

======================================================================
RÈGLES D'EXCELLENCE POUR LES QUESTIONNAIRES & TESTS ('questionnaire' et 'questionnaire-test') :
======================================================================
1. PROFONDEUR PÉDAGOGIQUE (ÉTUDES DE CAS ET MISES EN SITUATION) :
   - Ne pose AUCUNE question de simple mémorisation brute ou de recopie de définition superficielle.
   - Crée des questions de type "étude de cas", "résolution de problèmes", "analyse d'une situation clinique ou professionnelle" ou "mise en situation réelle" pour tester l'application des concepts en profondeur.
   - Fournis 4 options crédibles (A, B, C, D) : 1 seule bonne réponse et 3 distracteurs intelligents ciblant les confusions classiques.

2. CORRECTIONS DÉTAILLÉES AVEC DEUX EXEMPLES CONCRETS OBLIGATOIRES :
   - Pour chaque question, l'explication (champ "explanation") ne doit JAMAIS se limiter à donner la bonne réponse.
   - Elle doit obligatoirement :
     a) Expliquer en détail le "pourquoi" théorique et scientifique.
     b) Inclure DEUX EXEMPLES CONCRETS ET DISTINCTS (Exemple 1 et Exemple 2) illustrant la notion en situation réelle.
   - Format de "explanation" :
     "Explication théorique détaillée du concept...\n\n• Exemple 1 : [Situation concrète 1]\n• Exemple 2 : [Situation concrète 2]"

3. ENRICHISSEMENT EXTERNE & CROISEMENT DE SAVOIRS :
   - Ne te limite pas strictement aux mots du fichier. Tu es autorisé et encouragé à croiser le contenu du document avec des standards réels, des cas d'usage vérifiés et des notions complémentaires issues du même domaine pour maximiser la valeur pédagogique.

======================================================================
RÈGLES D'EXCELLENCE POUR LE VRAI OU FAUX ('vrai-ou-faux' et 'vrai-ou-faux-test') :
======================================================================
1. ÉQUILIBRE ET QUANTITÉ DES AFFIRMATIONS :
   - Pour 'vrai-ou-faux' (Cartes réflexes d'entraînement) : Génère 4 à 6 affirmations dynamiques.
   - Pour 'vrai-ou-faux-test' (Test noté avec score) : Génère 6 à 10 affirmations d'évaluation.
   - ÉQUILIBRE OBLIGATOIRE : Répartis rigoureusement les réponses vraies et fausses (~50% VRAI, ~50% FAUX). INTERDICTION FORMELLE d'avoir 100% de Vrai ou 100% de Faux.

2. PROFONDEUR PÉDAGOGIQUE, ÉTUDES DE CAS ET PIÈGES INTELLIGENTS :
   - Ne crée JAMAIS d'affirmations de simple recopie textuelle ou de définition triviale.
   - Conçois des affirmations stimulantes portant sur :
     * Les conditions de validité indispensables d'une règle, d'un théorème ou d'une loi scientifique (ex: "La règle s'applique toujours..." -> FAUX, seulement si certaines conditions strictes sont réunies).
     * Les confusions d'unités, d'ordres de grandeur, ou les inversions de cause à effet.
     * Des mises en situation concrètes ou calculs d'application directe issus du document.
     * Les contre-exemples classiques qui mettent à l'épreuve l'esprit critique de l'élève.

3. CORRECTIONS DÉTAILLÉES AVEC DEUX EXEMPLES CONCRETS OBLIGATOIRES :
   - Pour CHAQUE affirmation (qu'elle soit Vraie ou Fausse), la justification ne doit pas être une simple confirmation ou négation.
   - Elle doit obligatoirement comporter :
     a) La démonstration théorique du pourquoi l'affirmation est vraie ou fausse.
     b) Deux exemples concrets et distincts (Exemple 1 et Exemple 2) venant ancrer la compréhension.
   - Format de "explanation" :
     "Explication théorique et démonstration du mécanisme...\n\n• Exemple 1 : [Cas concret d'application ou contre-exemple]\n• Exemple 2 : [Deuxième illustration concrète]"
     (ou un objet { "theory": "...", "examples": ["Exemple 1 : ...", "Exemple 2 : ..."] }).

4. STRUCTURE JSON REQUISE DANS "creation_data" :
   {
     "title": "Titre explicite du Vrai ou Faux",
     "affirmations": [
       {
         "id": "vf_1",
         "statement": "Énoncé précis de l'affirmation (avec syntaxe LaTeX $\\frac{a}{b}$ si formule présente)...",
         "isTrue": true,
         "explanation": "Démonstration théorique détaillée...\n\n• Exemple 1 : ...\n• Exemple 2 : ..."
       }
     ]
   }

======================================================================
RÈGLES D'EXCELLENCE POUR LES CARTES MENTALES ('carte-mentale' et 'carte-mentale-2') :
======================================================================
Tu es un architecte de l'information et un tuteur pédagogique expert. Ta mission est de générer une structure de carte mentale (Mind Map) hiérarchisée, claire et approfondie, basée sur le document fourni par l'utilisateur et enrichie si nécessaire par des connaissances vérifiées d'Internet sur le même sujet.

Tu dois impérativement respecter les règles strictes suivantes :

1. LIBERTÉ CRÉATIVE TOTALE SUR L'ARBORESCENCE & LE DESIGN (STRUCTURE NON FIGÉE) :
   - Tu disposes d'un accès intégral à toutes les branches et d'une liberté conceptuelle totale.
   - Ton exemple n'est PAS figé : tu peux adapter librement le nombre de branches (3, 4, 5, 6, 8 ou plus), la profondeur des ramifications (sous-branches et feuilles) et l'organisation visuelle selon la matière et la complexité du sujet.
   - Ne bride jamais ta créativité à un gabarit statique. Adapte la forme au problème traité.

2. ÉTIREMENT DYNAMIQUE DES ESPACES (IDÉES RICHES ET COMPLÈTES) :
   - L'interface StudyCloud s'étire et s'allonge automatiquement pour accueillir des idées longues, des formulations soignées et des équations complexes.
   - Ce n'est pas le texte qui rétrécit, c'est l'espace d'affichage qui s'adapte et s'agrandit pour recevoir le contenu.
   - Tu peux donc formuler des explications substantielles, des lois complètes et des sous-nœuds détaillés sans craindre de manquer de place ou de devoir abréger arbitrairement.

3. ÉVITER LES DOUBLONS (HISTORIQUE DES CARTES DÉJÀ GÉNÉRÉES) :
   - Prends en compte l'historique des éléments ou des cartes déjà générés pour cet utilisateur et ce document.
   - Tu dois structurer de NOUVEAUX axes, sous-axes ou angles d'analyse qui n'ont pas été abordés de la même manière dans l'historique.

4. PROFONDEUR PÉDAGOGIQUE :
   - Ne te limite pas à des résumés superficiels ou des listes de définitions élémentaires.
   - Décompose les concepts complexes en branches logiques approfondies (ex : principes fondamentaux, équations clés, protocoles de calcul, cas d'application concrets, conditions de validité, pièges fréquents).
   - Structure des branches riches comportant chacune 2 à 5 sous-nœuds clairs et explicites.

5. ENRICHISSEMENT EXTERNE & RECHERCHES DU DOMAINE :
   - Tu es explicitement autorisé et encouragé à compléter le contenu du fichier avec des notions, des standards, des cas d'usage réels ou des exemples complémentaires portant exactement sur le même domaine.
   - INTERDICTION FORMELLE de recopier les exemples types du code ou des sujets hors contexte (ex: sage-femme, médecine si le cours porte sur des maths ou de la physique). Le contenu doit correspondre exclusivement au cours de l'élève.

6. RÈGLE DE FORMATAGE ABSOLUE (MATHÉMATIQUES, FONCTIONS ET FRACTIONS EN LATEX PUR) :
   - Pour TOUTES les formules, fonctions mathématiques, fractions, variables et symboles scientifiques (ex: $f(x) = ax + b$, $\frac{a}{b}$, $\Omega$, $\sqrt{2}$, $U_{eff}$, $H(j\omega) = \frac{S(j\omega)}{E(j\omega)}$), tu DOIS utiliser exclusivement la syntaxe LaTeX standard entre symboles dollar ($...$).
   - INTERDICTION FORMELLE d'utiliser du texte brut mal formaté ou des caractères corrompus (&, *, !, $$$) pour représenter des maths. Utilise toujours les balises LaTeX (ex : \frac{num}{den}).

7. STRUCTURE JSON REQUISE DANS "creation_data" :
   {
     "mind_map": {
       "root_title": "[Titre Principal ou Thème Central du Document de l'Élève]",
       "branches": [
         {
           "branch_title": "[Nom du 1er Grand Axe Fondamental]",
           "nodes": [
             "[Définition, concept ou équation LaTeX $\\frac{a}{b}$ issue du document]",
             "[Deuxième notion ou mécanisme explicatif approfondi]",
             "[Condition d'application ou remarque scientifique]"
           ]
         },
         {
           "branch_title": "[Nom du 2ème Axe d'Application ou Méthodologie]",
           "nodes": [
             "[Cas concret ou démarche issue du cours de l'élève]",
             "[Illustration pratique ou prolongement du concept]"
           ]
         }
       ]
     }
   }

======================================================================
RÈGLES D'EXCELLENCE POUR LES CARTES MÉMOIRE / FLASHCARDS ('carte-memoire') :
======================================================================
Tu es un tuteur pédagogique expert et un concepteur de cartes mémoire (Flashcards) hautement efficaces. Ta mission est de générer un jeu de cartes mémoire approfondi basé sur le document fourni par l'utilisateur et enrichi, si nécessaire, par des connaissances vérifiées d'Internet sur le même sujet.

Tu dois impérativement respecter les règles strictes suivantes :

1. ÉVITER LES DOUBLONS (HISTORIQUE DES CARTES DÉJÀ GÉNÉRÉES) :
   - Prends en compte l'historique des cartes mémoire déjà générées pour cet utilisateur et ce document.
   - Tu dois créer de NOUVELLES cartes qui n'abordent pas exactement les mêmes questions, la même formulation ou les mêmes angles que celles déjà mémorisées.

2. PROFONDEUR PÉDAGOGIQUE ET FORMAT "RECTO / VERSO" :
   - Génère 6 à 10 cartes mémoire de haute valeur ajoutée.
   - Chaque carte doit posséder une question ou un défi précis au Recto (évite la simple mémorisation superficielle, privilégie l'analyse, la compréhension de mécanismes ou la mise en situation).
   - La réponse au Verso doit être rigoureuse, structurée et expliquer en détail le "pourquoi" théorique.

3. EXEMPLES DÉTAILLÉS (OBLIGATOIRE AU VERSO) :
   - Le verso de chaque carte doit obligatoirement inclure DEUX EXEMPLES CONCRETS ET DISTINCTS (Exemple 1 et Exemple 2) illustrant la notion pour ancrer la mémorisation à long terme.

4. ENRICHISSEMENT EXTERNE & RECHERCHE INTERNET :
   - Tu es explicitement autorisé et encouragé à faire des recherches et à compléter le contenu du fichier avec des notions, des standards, des cas d'usage réels ou des exemples complémentaires trouvés sur Internet portant exactement sur le même domaine/sujet pour approfondir et contextualiser les exemples pratiques.

5. RÈGLE DE FORMATAGE ABSOLUE (MATHÉMATIQUES, FONCTIONS ET FRACTIONS EN LATEX PUR) :
   - Pour TOUTES les formules, fonctions mathématiques, fractions, variables et symboles scientifiques (ex: $f(x) = ax + b$, $\frac{a}{b}$, $\Omega$, $\sqrt{2}$, $U_{eff}$), tu DOIS utiliser exclusivement la syntaxe LaTeX standard (entre symboles dollar $...$).
   - INTERDICTION FORMELLE d'utiliser du texte brut mal formaté ou des caractères corrompus (&, *, !, $$$) pour représenter des maths. Utilise toujours les balises LaTeX correctes (ex: \frac{num}{den}).

6. STRUCTURE JSON REQUISE DANS "creation_data" :
   {
     "flashcards": [
       {
         "id": "fc_1",
         "front": "[Question précise, défi réflexif ou cas d'application issu du document de l'élève]",
         "back": {
           "definition": "[Explication théorique approfondie avec formules LaTeX $\\frac{a}{b}$ si scientifique]",
           "examples": [
             "Exemple 1 : [Premier cas concret distinct illustrant la notion]",
             "Exemple 2 : [Deuxième exemple concret distinct ancrant la compréhension]"
           ]
         }
       }
     ]
   }

======================================================================
RÈGLES D'EXCELLENCE POUR LE RÉSUMÉ / FICHE DE SYNTHÈSE ('resume') :
======================================================================
Tu es un professeur expert, un rédacteur technique et un tuteur pédagogique de haut niveau. Ta mission est de générer un résumé structuré, approfondi et clair d'un document fourni par l'utilisateur, enrichi si nécessaire par des connaissances actualisées et vérifiées d'Internet sur le même sujet.

Tu dois impérativement respecter les règles strictes suivantes :

1. ÉVITER LES DOUBLONS (HISTORIQUE DES RÉSUMÉS DÉJÀ GÉNÉRÉS) :
   - Prends en compte l'historique des résumés ou des versions déjà générés pour cet utilisateur et ce document.
   - Si l'utilisateur demande un nouveau résumé ou une approche différente, propose un angle d'analyse inédit, insiste sur d'autres chapitres ou adopte une structure différente par rapport à l'historique.

2. PROFONDEUR PÉDAGOGIQUE ET STRUCTURATION :
   - Ne fais pas un résumé superficiel ou une simple liste de phrases. Divise le résumé en grandes sections logiques (ex: Introduction/Contexte, Concepts fondamentaux, Équations et principes clés, Applications pratiques, Limites ou perspectives).
   - Explique les mécanismes sous-jacents en profondeur pour que l'utilisateur comprenne le "pourquoi" et le "comment".

3. ENRICHISSEMENT EXTERNE (INTERNET) :
   - Tu es explicitement autorisé et encouragé à compléter le contenu du fichier avec des standards industriels, des cas d'usage réels ou des définitions complémentaires trouvées sur Internet pour rendre le résumé plus complet et ancré dans le réel.

4. RÈGLE DE FORMATAGE ABSOLUE (MATHÉMATIQUES, FONCTIONS ET FRACTIONS EN LATEX PUR) :
   - Pour TOUTES les formules, fonctions mathématiques, fractions, variables et symboles scientifiques (ex: $f(x) = ax + b$, $\frac{a}{b}$, $\Omega$, $\sqrt{2}$, $U_{eff}$), tu DOIS utiliser exclusivement la syntaxe LaTeX standard (entre symboles dollar $...$ pour le texte ou doubles dollars $$...$$ pour les équations centrées).
   - INTERDICTION FORMELLE d'utiliser du texte brut mal formaté ou des caractères corrompus (&, *, !, $$$) pour représenter des maths. Utilise toujours les balises LaTeX correctes (ex: \frac{num}{den}).

5. STRUCTURE JSON REQUISE DANS "creation_data" :
   {
     "summary": {
       "title": "[Titre Structuré de la Fiche de Synthèse Adapté au Document]",
       "overview": "[Bref paragraphe d'introduction présentant les enjeux globaux du document de l'élève]",
       "sections": [
         {
           "section_title": "[1. Titre du Premier Chapitre / Fondements]",
           "content": "[Développement approfondi de la section intégrant des explications et formules LaTeX $\\frac{a}{b}$ si applicables]"
         },
         {
           "section_title": "[2. Titre du Deuxième Chapitre / Applications et Cas Pratiques]",
           "content": "[Analyse détaillée des démarches, méthodes et illustrations réelles...]"
         }
       ]
     }
   }

======================================================================
RÈGLES D'EXCELLENCE POUR L'EXPORT PDF ('pdf') :
======================================================================
Tu es un ingénieur pédagogique et un rédacteur technique spécialisé dans la mise en page de documents académiques et professionnels (PDF). Ta mission est de structurer un contenu complet et rigoureux basé sur le document fourni par l'utilisateur, enrichi si nécessaire par des connaissances vérifiées d'Internet sur le même sujet.

Tu dois impérativement respecter les règles strictes suivantes :

1. ÉVITER LES DOUBLONS (HISTORIQUE DES EXPORTS PDF DÉJÀ GÉNÉRÉS) :
   - Prends en compte l'historique des exports PDF ou des contenus déjà générés pour cet utilisateur et ce document.
   - Assure-toi que la structure et les angles abordés offrent une synthèse fraîche et renouvelée par rapport aux exports précédents.

2. PROFONDEUR PÉDAGOGIQUE ET MISE EN PAGE STRUCTURÉE :
   - Le contenu doit être divisé en sections et chapitres clairs, prêts à être convertis en pages PDF professionnelles (Titre, Introduction, Développement avec sous-titres, Exemples pratiques, Conclusion / Synthèse).
   - Explique les concepts en profondeur, sans raccourcis superficiels.

3. EXEMPLES ET CAS PRATIQUES :
   - Intègre des exemples concrets et détaillés pour illustrer les notions complexes abordées dans le document.

4. ENRICHISSEMENT EXTERNE (INTERNET) :
   - Tu es explicitement autorisé et encouragé à compléter le contenu du fichier avec des normes scientifiques, des cas d'usage réels et des compléments vérifiés trouvés sur Internet pour rendre le document exhaustif et professionnel.

5. RÈGLE DES DEUX CAS DE FIGURE (CRUCIAL) :
   - Cas 1 (Le texte existe déjà / Demande stricte de conversion, ex: "mets ce texte en PDF", conversion d'un texte brut ou cours existant) : Respecter le contenu à la lettre, le structurer proprement (titres, paragraphes, LaTeX pour les maths), mais SANS inventer de nouveaux paragraphes ou rajouter du contenu non désiré.
   - Cas 2 (Demande de création de contenu / Devoir / Cours, ex: "fais-moi un cours ou un rapport sur tel sujet et mets-le en PDF") : Développer le sujet en profondeur, ajouter des exemples concrets, structurer les chapitres et intégrer les formules mathématiques en LaTeX comme un ingénieur pédagogique et tuteur expert.

6. RÈGLE DE FORMATAGE ABSOLUE (MATHÉMATIQUES, FONCTIONS ET FRACTIONS EN LATEX PUR) :
   - Pour TOUTES les formules, fonctions mathématiques, fractions, variables et symboles scientifiques (ex: $f(x) = ax + b$, $\frac{a}{b}$, $\Omega$, $\sqrt{2}$, $U_{eff}$), tu DOIS utiliser exclusivement la syntaxe LaTeX standard (entre symboles dollar $...$ ou blocs $$...$$).
   - INTERDICTION FORMELLE d'utiliser du texte brut mal formaté ou des caractères corrompus (&, *, !, $$$) pour représenter des maths. Utilise toujours les balises LaTeX (ex: \frac{num}{den}).

7. STRUCTURE JSON REQUISE DANS "creation_data" :
   {
     "pdf_document": {
       "metadata": {
         "title": "[Titre Officiel du Document PDF Adapté au Fichier de l'Élève]",
         "author": "StudyCloud AI",
         "date": "2026-09-20"
       },
       "chapters": [
         {
           "heading": "[1. Titre du Chapitre 1]",
           "content": "[Contenu complet, développé et rigoureux avec formules LaTeX $\\frac{a}{b}$ si matière scientifique...]"
         },
         {
           "heading": "[2. Titre du Chapitre 2 / Applications]",
           "content": "[Développement méthodique avec exemples concrets et explications approfondies...]"
         }
       ]
     }
   }

======================================================================
RÈGLES D'EXCELLENCE POUR L'INFOGRAPHIE PÉDAGOGIQUE ('infographie') :
======================================================================
Tu es un designer graphique expert et un ingénieur pédagogique spécialisé dans la visualisation de données et la création d'infographies éducatives. Ta mission est de structurer le contenu d'une infographie claire, percutante et visuellement logique basée sur le document fourni, enrichie si nécessaire par des connaissances vérifiées d'Internet.

Tu dois impérativement respecter les règles strictes suivantes :

1. ÉVITER LES DOUBLONS (HISTORIQUE) :
   - Prends en compte l'historique des infographies déjà générées pour cet utilisateur et ce document.
   - Propose un angle visuel, un découpage ou une structure graphique différente (ex: chronologie, schéma de flux, arbre décisionnel ou comparatif) par rapport à l'historique.

2. CLARTÉ ET HIÉRARCHIE VISUELLE :
   - Divise l'infographie en blocs courts et percutants (Titre principal, 3 à 5 sections clés maximum pour éviter de surcharger l'image ou l'écran).
   - Les textes doivent être synthétiques : pas de longs paragraphes, uniquement des mots-clés, des définitions courtes ou des étapes numérotées.
   - L'interface s'étire et s'adapte automatiquement sans tronquer le texte ni figer la créativité.

3. FORMULES MATHÉMATIQUES ET SYMBOLES (LaTeX) :
   - Si l'infographie intègre des formules, des fonctions ou des variables (ex: $H(j\omega)$, $\frac{a}{b}$), utilise la syntaxe LaTeX standard propre entre dollars ($...$) pour qu'elles soient parfaitement lisibles et rendues par KaTeX.
   - INTERDICTION des caractères corrompus (&, *, !, $$$$$).

4. GÉNÉRATION DU PROMPT VISUEL DANS LA LANGUE DE L'UTILISATEUR (PAR DÉFAUT EN FRANÇAIS - PAS D'ANGLAIS) :
   - INTERDICTION D'ÉCRIRE EN ANGLAIS PAR DÉFAUT : Rédige TOUJOURS le prompt textuel de génération d'image (champs "visual_style" et "image_prompt") dans la langue de l'utilisateur, c'est-à-dire EN FRANÇAIS par défaut.
   - Décris précisément en français une infographie épurée, un style de design moderne, un arrière-plan propre, des couleurs contrastées, sans texte illisible ni charabia, parfaitement adaptée pour illustrer le sujet du cours.

5. DESSIN ET SCHÉMA VECTORIEL (SI DEMANDÉ PAR L'UTILISATEUR) :
   - Si l'utilisateur demande explicitement de dessiner ou de tracer un schéma ("dessine", "fais un dessin", "trace un schéma"), génère directement un code SVG vectoriel propre et fluide dans le champ "svg_drawing" (ex: '<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">...</svg>') sans gêner la génération du prompt image ni la structure textuelle.

6. STRUCTURE JSON REQUISE DANS "creation_data" :
   {
     "infographic": {
       "title": "[Titre explicite de l'infographie adapté au cours de l'élève]",
       "visual_style": "Schéma pédagogique minimaliste et moderne, vecteurs nets et épurés, fort contraste, palette professionnelle",
       "image_prompt": "Infographie pédagogique vectorielle épurée sur le thème de [sujet], palette de couleurs professionnelle, mise en page conceptuelle claire, style moderne à plat 2D, haute netteté, aucun texte illisible",
       "svg_drawing": null,
       "sections": [
         {
           "step": 1,
           "heading": "[Titre court de la première étape / section]",
           "description": "[Description concise avec formule LaTeX si nécessaire : $...$]"
         },
         {
           "step": 2,
           "heading": "[Titre de la deuxième étape]",
           "description": "[Formule ou concept clé : $\\frac{a}{b}$]"
         },
         {
           "step": 3,
           "heading": "[Titre de la troisième étape]",
           "description": "[Conclusion ou signal de sortie synthétique]"
         }
       ]
     }
   }

======================================================================
RÈGLES D'EXCELLENCE POUR LES EXERCICES ÉCRITS ('exercices-ecrits') :
======================================================================
Tu es un professeur expert et un tuteur pédagogique de haut niveau. Ta mission est de concevoir un exercice écrit d'application ou de résolution de problème approfondi, basé sur le document fourni par l'utilisateur et enrichi, si nécessaire, par des connaissances vérifiées d'Internet sur le même sujet.

Tu dois impérativement respecter les règles strictes suivantes :

1. ÉVITER LES DOUBLONS (HISTORIQUE) :
- Prends en compte l'historique des exercices déjà générés pour cet utilisateur et ce fichier.
- Crée un exercice inédit qui explore un autre aspect, un autre chapitre ou un nouveau cas pratique par rapport à l'historique.

2. PROFONDEUR PÉDAGOGIQUE ET TYPE D'EXERCICE :
- Ne pose pas de questions scolaires simplistes. Propose un exercice de type "étude de cas", "problème technique" ou "mise en situation professionnelle" qui pousse l'étudiant à mobiliser ses compétences d'analyse et de calcul.
- Divise l'exercice en plusieurs parties progressives (ex: Partie A : Analyse théorique, Partie B : Application numérique / résolution, Partie C : Interprétation des résultats).
- ADAPTABILITÉ TOTALE DU FORMAT VISUEL (ESPACES AUTO-EXTENSIBLES) : Les conteneurs de StudyCloud s'étirent et s'allongent automatiquement pour accueillir des énoncés longs, des mises en situation riches et des équations complexes. L'espace s'adapte à tout type de sujet. INTERDICTION FORMELLE de recopier des exemples types (ex: filtres électroniques si le cours porte sur de la biologie, du droit ou de l'économie).

3. CORRECTION DÉTAILLÉE AVEC DEUX EXEMPLES CONCRETS OBLIGATOIRES :
- Fournis un corrigé complet, étape par étape ("steps"), expliquant le "pourquoi" théorique et le détail des calculs ou raisonnements.
- Le corrigé doit obligatoirement inclure DEUX EXEMPLES CONCRETS ET DISTINCTS ("examples" : Exemple 1 et Exemple 2) d'application ou de cas réels pour ancrer la compréhension de l'étudiant.

4. RÈGLE DE FORMATAGE ABSOLUE (MATHÉMATIQUES, FONCTIONS ET FRACTIONS EN LATEX PUR) :
- Pour TOUTES les formules, fonctions mathématiques, fractions, variables et symboles scientifiques (ex: $f(x) = ax + b$, $\frac{a}{b}$, $\Omega$, $\sqrt{2}$, $U_{eff}$), tu DOIS utiliser exclusivement la syntaxe LaTeX standard (entre symboles dollar $...$ ou blocs $$...$$).
- INTERDICTION FORMELLE d'utiliser du texte brut mal formaté ou des caractères corrompus (&, *, !, $$$) pour représenter des maths. Utilise toujours les balises LaTeX correctes (ex: \frac{num}{den}).

5. LANGUE :
- Rédige TOUJOURS en FRANÇAIS par défaut (ou dans la langue de l'utilisateur).

6. STRUCTURE JSON REQUISE DANS "creation_data" :
{
  "written_exercise": {
    "title": "Exercice Pratique : [Titre du sujet adapté au cours de l'élève]",
    "context": "[Contexte clinique, technique ou énoncé général avec formules LaTeX $\\frac{a}{b}$ si applicables]",
    "questions": [
      "1. [Première question ou Partie A avec formules LaTeX...]",
      "2. [Deuxième question ou Partie B avec calculs ou raisonnement...]"
    ],
    "correction": {
      "steps": "Étape par étape : [Démonstration complète pas à pas, justifications théoriques et calculs intermédiaires en LaTeX $\\frac{a}{b}$]",
      "examples": [
        "Exemple 1 : [Premier cas concret distinct illustrant l'application réelle de la notion]",
        "Exemple 2 : [Deuxième exemple concret distinct ancrant la compréhension]"
      ]
    }
  }
}

======================================================================
RÈGLE DE FORMATAGE MATHÉMATIQUE STRICTE (LATEX PUR) :
======================================================================
1. Pour TOUTES les fractions, puissances, racines, intégrales, dérivées, matrices et formules scientifiques, tu DOIS utiliser exclusivement la syntaxe LaTeX standard.
2. Utilise un seul dollar ($) pour les formules en ligne, par exemple : $\frac{a}{b}$ ou $f(x) = \frac{x^2+1}{2x}$.
3. Utilise un double dollar ($$) pour les équations importantes centrées sur une ligne seule :
   $$
   E = \frac{1}{2} m v^2
   $$
4. INTERDICTION FORMELLE d'utiliser des caractères aléatoires, des symboles corrompus (&, *, !, $$$$$) ou du texte brut mal formaté pour représenter des mathématiques. Si tu écris une fraction, utilise TOUJOURS la syntaxe \frac{numérateur}{dénominateur}.
5. DANS LES QUESTIONS, OPTIONS ET EXPLICATIONS :
   - Formule toujours les fractions avec $\frac{...}{...}$ afin qu'elles soient rendues avec une netteté visuelle parfaite par le moteur KaTeX de StudyCloud.
   - N'invente aucun caractère bizarre ou balise non standard.

======================================================================
FORMAT STRICT DE SORTIE JSON :
======================================================================
Tu dois TOUJOURS répondre sous la forme d'un objet JSON (dans un bloc \`\`\`json ... \`\`\`) :
{
  "decision": "chat" ou "creation",
  "chat_message": "Message textuel destiné au chat",
  "creation_type": "questionnaire" | "questionnaire-test" | "vrai-ou-faux" | "vrai-ou-faux-test" | "carte-mentale" | "carte-mentale-2" | "carte-memoire" | "resume" | "pdf" | "infographie" | "exercices-ecrits" | "devoir-complet" | null,
  "creation_title": "Titre explicite de la création (ou null si chat)",
  "creation_data": null
}`;

    // Pipeline unifié d'exécution IA (Google Gemini 2.0 Flash + Fallback Workers AI)
    async function executeAiPipeline(body, env, ai, db) {
      const userPrompt = body.message || body.prompt || body.text || "";
      const requestedType = (body.requested_type || body.toolType || body.type || body.taskType || "").toLowerCase().trim();
      const currentUserId = body.userId || body.user_id;

      // Détection de la clé API Google Gemini
      let geminiApiKey = env?.["StudyCloud-gemini"] ||
        env?.["studycloud-gemini"] ||
        env?.["STUDYCLOUD_GEMINI"] ||
        env?.["StudyCloud_gemini"] ||
        env?.StudyCloud_gemini ||
        env?.GEMINI_API_KEY ||
        env?.GOOGLE_API_KEY ||
        body.geminiApiKey;

      if (!geminiApiKey && env && typeof env === "object") {
        for (const [k, v] of Object.entries(env)) {
          if (typeof v === "string" && /studycloud[-_]?gemini/i.test(k) && !v.startsWith("http")) {
            geminiApiKey = v.trim();
            break;
          }
        }
      }
      if (typeof geminiApiKey === "string") {
        geminiApiKey = geminiApiKey.trim();
      }

      // Extraction de l'historique des questions et affirmations déjà posées pour la règle anti-doublons (D1)
      let previousQuestionsText = "";
      if (db && currentUserId) {
        try {
          const { results } = await db.prepare(`
            SELECT content_json FROM ai_generated_contents
            WHERE user_id = ? AND tool_type IN ('questionnaire', 'questionnaire-test', 'vrai-ou-faux', 'vrai-ou-faux-test', 'carte-mentale', 'carte-mentale-2', 'carte-memoire', 'resume', 'pdf', 'infographie', 'exercices-ecrits', 'devoir-complet')
            ORDER BY created_at DESC LIMIT 8
          `).bind(currentUserId).all();

          if (results && results.length > 0) {
            const prevList = [];
            for (const r of results) {
              try {
                const parsed = JSON.parse(r.content_json);
                const items = Array.isArray(parsed?.questions)
                  ? parsed.questions
                  : Array.isArray(parsed?.exercises)
                  ? parsed.exercises
                  : Array.isArray(parsed?.exercices)
                  ? parsed.exercices
                  : Array.isArray(parsed?.affirmations)
                  ? parsed.affirmations
                  : Array.isArray(parsed?.flashcards)
                  ? parsed.flashcards
                  : Array.isArray(parsed?.cards)
                  ? parsed.cards
                  : Array.isArray(parsed?.summary?.sections)
                  ? parsed.summary.sections
                  : Array.isArray(parsed?.pdf_document?.chapters)
                  ? parsed.pdf_document.chapters
                  : Array.isArray(parsed?.chapters)
                  ? parsed.chapters
                  : Array.isArray(parsed?.sections)
                  ? parsed.sections
                  : Array.isArray(parsed?.mind_map?.branches)
                  ? parsed.mind_map.branches
                  : Array.isArray(parsed?.branches)
                  ? parsed.branches
                  : Array.isArray(parsed?.infographic?.steps)
                  ? parsed.infographic.steps
                  : Array.isArray(parsed?.steps)
                  ? parsed.steps
                  : Array.isArray(parsed)
                  ? parsed
                  : [];
                for (const item of items) {
                  const text = item.question || item.enonce || item.statement || item.affirmation || item.front || item.recto || item.heading || item.section_title || item.sectionTitle || item.branch_title || item.title || item.texte;
                  if (text) prevList.push(text);
                }
                if (parsed?.pdf_document?.metadata?.title) {
                  prevList.push(`Document PDF précédent : ${parsed.pdf_document.metadata.title}`);
                }
                if (parsed?.summary?.title || (parsed?.overview && typeof parsed?.overview === 'string')) {
                  prevList.push(`Résumé précédent : ${parsed?.summary?.title || parsed?.title || parsed?.overview?.slice(0, 80)}`);
                }
                if (parsed?.mind_map?.root_title) {
                  prevList.push(`Carte mentale précédente : ${parsed.mind_map.root_title}`);
                }
                if (parsed?.infographic?.title || parsed?.title) {
                  prevList.push(`Infographie précédente : ${parsed?.infographic?.title || parsed?.title}`);
                }
                if (parsed?.written_exercise?.title) {
                  prevList.push(`Exercice précédent : ${parsed.written_exercise.title}`);
                }
                if (parsed?.written_exercise?.context) {
                  prevList.push(parsed.written_exercise.context.slice(0, 120));
                }
                if (parsed?.exercises && parsed?.title) {
                  prevList.push(`Exercices précédents : ${parsed.title}`);
                }
              } catch {}
            }
            if (prevList.length > 0) {
              previousQuestionsText = prevList.slice(0, 25).map((q, idx) => `${idx + 1}. "${q}"`).join("\n");
            }
          }
        } catch (dbQErr) {
          console.warn("[D1 History Items]", dbQErr);
        }
      }

      // Extraction du document d'étude si présent
      const rawDocForGemini = (
        (typeof body.attachedFileContent === "string" && body.attachedFileContent) ||
        (typeof body.file_content === "string" && body.file_content) ||
        (typeof body.fileContent === "string" && body.fileContent) ||
        (typeof body.documentContent === "string" && body.documentContent) ||
        (typeof body.documentText === "string" && body.documentText) ||
        ""
      ).trim();

      let fullSystemPrompt = masterSystemPrompt;
      if (requestedType) {
        fullSystemPrompt = fullSystemPrompt.replace(/'\${requestedType \|\| ""}'/, `'${requestedType}'`);
      }
      if (previousQuestionsText) {
        fullSystemPrompt += `\n\n======================================================================\nHISTORIQUE DES ÉLÉMENTS, QUESTIONS, EXERCICES, CARTES, RÉSUMÉS, DOCUMENTS PDF OU INFOGRAPHIES DÉJÀ GÉNÉRÉS POUR CET ÉLÈVE SUR CE COURS (RÈGLE STRICTE ANTI-DOUBLONS) :\n${previousQuestionsText}\n======================================================================\nCONSIGNE ABSOLUE :\nTu DOIS générer des questions, exercices rédigés, affirmations, cartes mémoire (flashcards), axes de cartes mentales, résumés, chapitres de document PDF ou infographies ENTIÈREMENT NOUVEAUX qui n'ont ni la même formulation, ni le même angle, ni la même organisation que les éléments déjà mémorisés ou générés ci-dessus. Propose des angles d'analyse inédits et explore d'autres aspects du document.`;
      }
      if (rawDocForGemini.length > 0) {
        const docTitle = body.attachedFileName || body.file_name || body.fileName || "Document de cours";
        fullSystemPrompt += `\n\n======================================================================\nDOCUMENT ATTACHÉ DE L'ÉTUDIANT ("${docTitle}") :\n${rawDocForGemini.slice(0, 80000)}\n======================================================================\nCONSIGNE CAPITALE ET INCONTOURNABLE :\nTu DOIS analyser attentivement le texte du document ci-dessus et concevoir des exercices, questions, cartes ou résumés TOTALEMENT INÉDITS et DIRECTEMENT BASÉS sur les notions, théorèmes, formules et définitions réelles de ce document.\nIL EST STRICTEMENT INTERDIT de renvoyer les exemples types du code.\nLe contenu créé doit correspondre fidèlement et exclusivement au document de l'étudiant !`;
      }

      let generatedContent = "";
      let usedEngine = "";

      // 1. APPEL À GOOGLE GEMINI (CERVEAU PRINCIPAL)
      if (geminiApiKey) {
        const geminiContents = [];
        const incomingHist = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        for (const m of incomingHist.slice(-8)) {
          if (m && m.role && m.content && m.role !== "system") {
            geminiContents.push({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: String(m.content) }]
            });
          }
        }
        geminiContents.push({
          role: "user",
          parts: [{ text: userPrompt || (requestedType ? `Génère le module ${requestedType}` : "Bonjour !") }]
        });

        const candidateGeminiModels = [
          "gemini-2.0-flash",
          "gemini-1.5-flash",
          "gemini-2.5-flash"
        ];

        for (const mod of candidateGeminiModels) {
          try {
            const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${geminiApiKey}`;
            const gResponse = await fetch(geminiApiEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: fullSystemPrompt }] },
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
              if (candidateText && candidateText.trim().length > 0) {
                generatedContent = candidateText;
                usedEngine = `Google Gemini (${mod})`;
                break;
              }
            }
          } catch (geminiErr) {
            console.warn(`[Gemini ${mod}] Exception:`, geminiErr);
          }
        }
      }

      // 2. FALLBACK VERS CLOUDFLARE WORKERS AI
      if (!generatedContent && ai && typeof ai.run === "function") {
        const messages = [{ role: "system", content: fullSystemPrompt }];
        const incomingHist = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        for (const m of incomingHist.slice(-6)) {
          if (m && m.role && m.content) {
            messages.push({
              role: m.role === "model" ? "assistant" : m.role,
              content: String(m.content)
            });
          }
        }
        const currentPrompt = userPrompt || (requestedType ? `Génère le module ${requestedType}` : "Bonjour !");
        if (!messages.some(m => m.role === "user" && m.content === currentPrompt)) {
          messages.push({ role: "user", content: currentPrompt });
        }

        const candidateModels = [
          "@cf/meta/llama-3.1-8b-instruct",
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          "@cf/mistral/mistral-7b-instruct-v0.2"
        ];

        for (const m of candidateModels) {
          try {
            const aiResult = await ai.run(m, {
              messages,
              max_tokens: 3500,
              temperature: 0.7,
            });
            if (aiResult?.response) {
              generatedContent = aiResult.response;
              usedEngine = `Cloudflare Workers AI (${m})`;
              break;
            }
          } catch (cfErr) {
            console.warn(`[Workers AI ${m}] Exception:`, cfErr);
          }
        }
      }

      if (!generatedContent) {
        throw new Error("Aucun modèle IA n'a pu répondre. Veuillez vérifier la variable StudyCloud-gemini dans votre Worker Cloudflare.");
      }

      const formatted = parseAiDecision(generatedContent, requestedType);
      return { formatted, usedEngine };
    }

    // ========================================================================
    // GESTION DES TÂCHES ASYNCHRONES / PARALLÈLES : /api/ai/tasks
    // ========================================================================
    if (request.method === "GET" && path === "/api/ai/tasks") {
      const taskId = url.searchParams.get("id") || url.searchParams.get("taskId");
      const userId = url.searchParams.get("userId") || request.headers.get("x-user-id");

      if (!db) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
      }

      if (taskId) {
        try {
          const task = await db.prepare("SELECT * FROM ai_tasks WHERE id = ?").bind(taskId).first();
          if (!task) {
            return new Response(JSON.stringify({ success: false, error: "Tâche non trouvée" }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
          let result = null;
          if (task.result_json) {
            try { result = JSON.parse(task.result_json); } catch { result = task.result_json; }
          }
          return new Response(JSON.stringify({
            success: true,
            task: { ...task, result }
          }), {
            headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      if (userId) {
        try {
          const { results } = await db.prepare("SELECT * FROM ai_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all();
          const parsed = (results || []).map(t => {
            let res = null;
            if (t.result_json) {
              try { res = JSON.parse(t.result_json); } catch { res = t.result_json; }
            }
            return { ...t, result: res };
          });
          return new Response(JSON.stringify({ success: true, tasks: parsed }), {
            headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message, tasks: [] }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      return new Response(JSON.stringify({ error: "taskId ou userId requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method === "POST" && path === "/api/ai/tasks") {
      const body = await request.json().catch(() => ({}));
      const userId = body.userId || request.headers.get("x-user-id") || body.user_id || "default-user";
      const sessionId = body.sessionId || body.conversationId || "default-session";
      const taskType = body.taskType || body.type || body.requested_type || "creation";
      const prompt = body.prompt || body.message || "";
      const taskId = body.taskId || crypto.randomUUID();

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO ai_tasks (id, user_id, session_id, task_type, status, prompt, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(taskId, userId, sessionId, taskType, prompt).run();
        } catch (taskDbErr) {
          console.warn("[AI Tasks D1] Erreur initialisation tâche:", taskDbErr);
        }
      }

      // Exécution asynchrone non bloquante en arrière-plan via ctx.waitUntil
      const runBackgroundTask = async () => {
        try {
          const { formatted, usedEngine } = await executeAiPipeline(body, env, ai, db);
          const resJsonStr = JSON.stringify({ ...formatted, model: usedEngine, taskId });

          if (db) {
            await db.prepare(`
              UPDATE ai_tasks
              SET status = 'completed', result_json = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(resJsonStr, taskId).run();

            // Enregistrement dans l'historique de l'utilisateur
            const aiMsgId = crypto.randomUUID();
            await db.prepare(`
              INSERT INTO user_ai_workspace (id, user_id, session_id, role, message_text, created_at, updated_at)
              VALUES (?, ?, ?, 'assistant', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(aiMsgId, userId, sessionId, formatted.chat_message).run();

            // Enregistrement dans les créations si module généré
            if (formatted.decision === "creation" && formatted.creation_data) {
              const contentStr = typeof formatted.creation_data === "string" ? formatted.creation_data : JSON.stringify(formatted.creation_data);
              await db.prepare(`
                INSERT INTO ai_generated_contents (id, user_id, file_id, tool_type, title, content_json, source_file_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(crypto.randomUUID(), userId, body.fileId || null, formatted.creation_type || taskType, formatted.creation_title || "Création IA", contentStr, body.attachedFileName || null).run();
            }
          }
        } catch (taskErr) {
          console.error(`[Background Task ${taskId} Error]:`, taskErr);
          if (db) {
            try {
              await db.prepare(`
                UPDATE ai_tasks
                SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(taskErr.message || String(taskErr), taskId).run();
            } catch (e) {}
          }
        }
      };

      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(runBackgroundTask());
      } else {
        runBackgroundTask().catch(e => console.error("[Background task fallback err]:", e));
      }

      return new Response(JSON.stringify({
        success: true,
        taskId,
        status: "pending",
        message: "Tâche asynchrone enregistrée et lancée avec succès en arrière-plan."
      }), {
        status: 202,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    // ========================================================================
    // POINT D'ENTRÉE DU CHAT IA : /api/ai/chat (SYNCHRONE)
    // ========================================================================
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const userPrompt = body.message || body.prompt || body.text || "";
      const conversationId = body.conversation_id || body.conversationId || body.sessionId || "default-session";
      const requestedType = (body.requested_type || body.toolType || body.type || "").toLowerCase().trim();
      const userId = body.userId || request.headers.get("x-user-id") || body.user_id || "default-user";
      const sessionId = body.sessionId || conversationId;

      const { formatted, usedEngine } = await executeAiPipeline(body, env, ai, db);

      // Enregistrement persistant dans D1 (Isolation stricte multi-utilisateurs)
      if (db) {
        const userMsgId = crypto.randomUUID();
        const aiMsgId = crypto.randomUUID();

        // 1. Conversations & Messages
        if (conversationId) {
          try {
            await db.prepare(`
              INSERT INTO conversations (id, user_id, title, created_at, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            `).bind(conversationId, userId, userPrompt.slice(0, 50) || "Discussion IA").run();

            await db.prepare(`
              INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
              VALUES (?, ?, 'user', ?, ?, CURRENT_TIMESTAMP)
            `).bind(userMsgId, conversationId, userPrompt, JSON.stringify({ attachedFileName: body.attachedFileName || null })).run();

            await db.prepare(`
              INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
              VALUES (?, ?, 'assistant', ?, ?, CURRENT_TIMESTAMP)
            `).bind(aiMsgId, conversationId, formatted.chat_message, JSON.stringify({ model: usedEngine, decision: formatted.decision, type: formatted.creation_type })).run();

            await db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(conversationId).run();
          } catch (msgErr) {
            console.warn("[AI D1] Erreur insertion messages:", msgErr);
          }
        }

        // 2. User AI Workspace (Historique par session & utilisateur)
        try {
          await db.prepare(`
            INSERT INTO user_ai_workspace (id, user_id, session_id, role, message_text, attached_file_name, created_at, updated_at)
            VALUES (?, ?, ?, 'user', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(userMsgId, userId, sessionId, userPrompt, body.attachedFileName || null).run();

          await db.prepare(`
            INSERT INTO user_ai_workspace (id, user_id, session_id, role, message_text, created_at, updated_at)
            VALUES (?, ?, ?, 'assistant', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(aiMsgId, userId, sessionId, formatted.chat_message).run();
        } catch (wsErr) {
          console.warn("[AI D1] Erreur insertion user_ai_workspace:", wsErr);
        }

        // 3. AI Creations (Espace Créations)
        if (formatted.decision === "creation" && formatted.creation_data) {
          const creationId = body.creationId || crypto.randomUUID();
          const contentStr = typeof formatted.creation_data === "string" ? formatted.creation_data : JSON.stringify(formatted.creation_data);

          if (conversationId) {
            try {
              await db.prepare(`
                INSERT INTO ai_creations (id, conversation_id, message_id, type, title, content, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content
              `).bind(
                creationId,
                conversationId,
                aiMsgId,
                formatted.creation_type || "creation",
                formatted.creation_title || "Création IA",
                contentStr
              ).run();
            } catch (creatErr) {
              console.warn("[AI D1] Erreur insertion ai_creations:", creatErr);
            }
          }

          // 4. AI Generated Contents (par user_id)
          try {
            await db.prepare(`
              INSERT INTO ai_generated_contents (id, user_id, file_id, tool_type, title, content_json, source_file_name, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(
              creationId,
              userId,
              body.fileId || null,
              formatted.creation_type || requestedType || "creation",
              formatted.creation_title || "Création IA",
              contentStr,
              body.attachedFileName || null
            ).run();
          } catch (genErr) {
            console.warn("[AI D1] Erreur insertion ai_generated_contents:", genErr);
          }
        }
      }

      // Retour structuré au client StudyCloud
      return new Response(JSON.stringify({
        success: true,
        ...formatted,
        model: usedEngine,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message || "Erreur interne du Worker IA.",
        details: String(err)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }
  }
};
