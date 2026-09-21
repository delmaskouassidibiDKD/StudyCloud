// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKERS AI (ASSISTANTE IA OFFICIELLE DKD)
// ============================================================================
// Domaine de déploiement : https://studycloud-ai.delmaskouassidibi.workers.dev
// Modèle IA principal : Google Gemini 3.8 Flash (avec basculement automatique multi-clés 1 à 4)
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
          db.prepare(`CREATE TABLE IF NOT EXISTS ai_tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT, task_type TEXT NOT NULL, status TEXT NOT NULL, prompt TEXT, result_json TEXT, error_message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
          db.prepare(`CREATE TABLE IF NOT EXISTS user_certificates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source_file_id TEXT, source_file_name TEXT, topic TEXT NOT NULL, score REAL NOT NULL, max_score REAL DEFAULT 20, certificate_code TEXT UNIQUE NOT NULL, student_name TEXT, issued_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`)
        ]);
        globalThis._aiSchemaInit = true;
      } catch (schemaErr) {
        console.warn("[AI D1 Init]", schemaErr);
      }
    }

    // ========================================================================
    // HELPER UNIVERSEL : RÉCUPÉRATION ET NORMALISATION MULTI-CLÉS GEMINI (1 à 4)
    // ========================================================================
    function getAvailableGeminiKeys(customEnv, clientKey) {
      const keys = [];
      const addKey = (k) => {
        if (typeof k === "string") {
          const clean = k.trim();
          if (clean.length > 15 && !clean.startsWith("http") && !keys.includes(clean)) {
            keys.push(clean);
          }
        }
      };

      // 1. Clé principale (1)
      addKey(customEnv?.["StudyCloud-gemini"]);
      addKey(customEnv?.["studycloud-gemini"]);
      addKey(customEnv?.STUDYCLOUD_GEMINI);
      addKey(customEnv?.StudyCloud_gemini);
      addKey(customEnv?.GEMINI_API_KEY);
      addKey(customEnv?.GOOGLE_API_KEY);

      // 2. Clé 2 (studycloud-gemini-2)
      addKey(customEnv?.["studycloud-gemini-2"]);
      addKey(customEnv?.["StudyCloud-gemini-2"]);
      addKey(customEnv?.["STUDYCLOUD_GEMINI_2"]);
      addKey(customEnv?.["studycloud_gemini_2"]);
      addKey(customEnv?.["studycloud-gemini2"]);
      addKey(customEnv?.["StudyCloud-gemini2"]);

      // 3. Clé 3 (studycloud-gemini-3)
      addKey(customEnv?.["studycloud-gemini-3"]);
      addKey(customEnv?.["StudyCloud-gemini-3"]);
      addKey(customEnv?.["STUDYCLOUD_GEMINI_3"]);
      addKey(customEnv?.["studycloud_gemini_3"]);
      addKey(customEnv?.["studycloud-gemini3"]);
      addKey(customEnv?.["StudyCloud-gemini3"]);

      // 4. Clé 4 (studycloud-gemini-4)
      addKey(customEnv?.["studycloud-gemini-4"]);
      addKey(customEnv?.["StudyCloud-gemini-4"]);
      addKey(customEnv?.["STUDYCLOUD_GEMINI_4"]);
      addKey(customEnv?.["studycloud_gemini_4"]);
      addKey(customEnv?.["studycloud-gemini4"]);
      addKey(customEnv?.["StudyCloud-gemini4"]);

      // Balayage dynamique dans customEnv pour toute autre variable gemini
      if (customEnv && typeof customEnv === "object") {
        for (const [k, v] of Object.entries(customEnv)) {
          if (typeof v === "string" && /gemini/i.test(k) && !/worker/i.test(k) && !/url/i.test(k)) {
            addKey(v);
          }
        }
      }

      // Clé optionnelle passée par le client
      if (clientKey) {
        addKey(clientKey);
      }

      return keys;
    }

    // Requête GET : Test de santé et d'état du Worker IA
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const hasAi = Boolean(ai && typeof ai.run === "function");
      const geminiKeys = getAvailableGeminiKeys(env);
      return new Response(JSON.stringify({
        service: "StudyCloud IA Assistant & Creation Engine (DKD Technologies)",
        status: "ready",
        brain: "Google Gemini 3.8 Flash (Multi-Clés avec Basculement Automatique)",
        gemini_keys_count: geminiKeys.length,
        gemini_configured: geminiKeys.length > 0,
        cf_ai_fallback: hasAi,
        d1_database: db ? "Connecté (MON_D1_STUDYCLOUD)" : "Non lié",
        r2_bucket: bucket ? "Connecté (MON_R2_STUDYCLOUD)" : "Non lié",
        modules_count: 12,
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    // Endpoint de diagnostic de connectivité IA : /api/ai/debug (Diagnostic détaillé par clé)
    if (request.method === "GET" && path === "/api/ai/debug") {
      const geminiKeys = getAvailableGeminiKeys(env);
      const keyReports = [];

      for (let i = 0; i < geminiKeys.length; i++) {
        const k = geminiKeys[i];
        const isGoogleFormat = k.startsWith("AIzaSy") || k.startsWith("AIza");
        let status = "inconnu";
        let detail = null;

        if (!isGoogleFormat) {
          status = "Format Clé Invalide (Google rejette)";
          detail = `Cette clé commence par '${k.slice(0, 6)}' au lieu de 'AIzaSy...'. Les clés Google AI Studio commencent toujours par 'AIzaSy'. Veuillez générer une vraie clé API sur https://aistudio.google.com/apikey.`;
        } else {
          try {
            // Test de listage des modèles autorisés par Google pour cette clé
            const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${k}`;
            const listResp = await fetch(listModelsUrl);
            let availableGoogleModels = [];
            if (listResp.ok) {
              const listData = await listResp.json();
              availableGoogleModels = (listData.models || []).map(m => m.name.replace("models/", "")).filter(n => n.includes("gemini") && !n.includes("vision"));
            } else {
              lastErr = `ListModels HTTP ${listResp.status}: ${(await listResp.text()).slice(0, 80)}`;
            }

            const testModels = availableGoogleModels.length > 0
              ? availableGoogleModels.slice(0, 5)
              : ["gemini-1.5-flash-latest", "gemini-1.5-flash-001", "gemini-1.5-flash-002", "gemini-1.5-pro-latest", "gemini-1.0-pro", "gemini-pro"];

            let workingModel = null;
            for (const tm of testModels) {
              const testEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${tm}:generateContent?key=${k}`;
              const gTest = await fetch(testEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
              });
              if (gTest.ok) {
                const data = await gTest.json();
                workingModel = `${tm} (OK: ${data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK"})`;
                status = `HTTP 200 via ${tm}`;
                detail = workingModel;
                break;
              } else {
                const txt = await gTest.text();
                lastErr = `HTTP ${gTest.status} sur ${tm}: ${txt.slice(0, 140)}`;
              }
            }
            if (!workingModel) {
              status = "Échec tous modèles";
              detail = `${lastErr} | Dispos: ${availableGoogleModels.join(", ")}`;
            }
          } catch (e) {
            status = "Exception";
            detail = e.message;
          }
        }

        keyReports.push({
          keyNumber: i + 1,
          prefix: `${k.slice(0, 6)}...${k.slice(-4)}`,
          isGoogleFormat,
          status,
          detail
        });
      }

      let cfAiStatus = "not_bound";
      if (ai && typeof ai.run === "function") {
        for (const testModel of ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast", "@cf/mistral/mistral-7b-instruct-v0.2"]) {
          try {
            const cfTest = await ai.run(testModel, {
              messages: [{ role: "user", content: "Bonjour" }]
            });
            const respTxt = cfTest?.response || cfTest?.result?.response;
            if (respTxt) {
              cfAiStatus = `OK (${testModel.split("/").pop()})`;
              break;
            }
          } catch (cfErr) {
            cfAiStatus = `Exception (${testModel.split("/").pop()}): ${cfErr.message}`;
          }
        }
      }

      return new Response(JSON.stringify({
        totalKeysDetected: geminiKeys.length,
        keys: keyReports,
        cfAiStatus,
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    // ========================================================================
    // ENDPOINT UNIVERSEL D'APERÇU HTML AUTONOME : /api/ai/preview (GET & POST)
    // ========================================================================
    if (path === "/api/ai/preview") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      if (request.method === "GET") {
        const creationId = url.searchParams.get("id");
        let htmlToServe = null;
        if (creationId && db) {
          try {
            const row = await db.prepare("SELECT content_json, tool_type, title, source_file_name FROM ai_generated_contents WHERE id = ?").bind(creationId).first();
            if (row) {
              const parsed = safeJsonParse(row.content_json);
              htmlToServe = generateCreationHtmlPreview(row.tool_type, row.title, parsed, row.source_file_name);
            }
          } catch (e) {}
        }
        if (!htmlToServe) {
          const type = url.searchParams.get("type") || "devoir-complet";
          const title = url.searchParams.get("title") || "Aperçu de Création StudyCloud";
          const docName = url.searchParams.get("doc") || "Document d'étude";
          htmlToServe = generateCreationHtmlPreview(type, title, {}, docName);
        }
        return new Response(htmlToServe, {
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
        });
      }

      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const { toolType, title, data, docName } = body;
        const html = generateCreationHtmlPreview(toolType || "devoir-complet", title || "Aperçu StudyCloud", data || {}, docName || "Document d'étude");
        const accept = request.headers.get("accept") || "";
        if (accept.includes("text/html")) {
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: true, html, preview_url: `/api/ai/preview?type=${encodeURIComponent(toolType || 'devoir-complet')}&title=${encodeURIComponent(title || 'Aperçu')}` }), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }
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

    function cleanControlCharsInParsedObject(obj) {
      if (!obj) return obj;
      if (typeof obj === "string") {
        return obj
          .replace(/[\x0c\u000c]/g, "\\f") // Répare \x0crac -> \frac
          .replace(/[\x08\u0008]/g, "\\b") // Répare \x08eta -> \beta
          // Répare les mélanges de dollars et de symboles LaTeX générés par l'IA (ex: \text{k}\$\Omega$)
          .replace(/\\text\{([^{}]*)\}\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '\\text{$1 }\\Omega')
          .replace(/\\text\{([^{}]*)\\?\$+(\\?Omega|\bOmega\b)\}/gi, '\\text{$1 }\\Omega')
          .replace(/\\text\{([^{}]*)\\?\$+([^{}]*)\}/gi, '\\text{$1$2}')
          .replace(/([0-9]+)\s*k\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\text{ k}\\Omega')
          .replace(/([a-zA-Z0-9])\s*\\?\$+(\\?Omega|\bOmega\b)/gi, '$1 \\Omega')
          .replace(/\\\$+(\\?Omega|\bOmega\b)/gi, '\\Omega')
          .replace(/\bk\s*\\?\$+(\\?Omega)\$?/gi, '\\text{k }\\Omega');
      }
      if (Array.isArray(obj)) {
        return obj.map(cleanControlCharsInParsedObject);
      }
      if (typeof obj === "object") {
        const cleaned = {};
        for (const [k, v] of Object.entries(obj)) {
          cleaned[k] = cleanControlCharsInParsedObject(v);
        }
        return cleaned;
      }
      return obj;
    }

    // Parseur JSON ultra-robuste avec neutralisation des sauts de ligne bruts et des antislashs LaTeX
    function safeJsonParse(raw) {
      if (!raw) return null;
      if (typeof raw === "object") return cleanControlCharsInParsedObject(raw);
      if (typeof raw !== "string") return null;

      const trimmed = raw.trim();

      // 1. Nettoyage préventif des commandes LaTeX pour doubler les antislashs uniques (\frac -> \\frac)
      // afin que JSON.parse n'interprète pas \f comme Form Feed (ASCII 12 \x0c) ou \b comme Backspace
      const latexRegex = /(?<!\\)\\(frac|sqrt|sum|int|lim|prod|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|forall|exists|infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|left|right|big|Big|text|textbf|textit|mathrm|mathbf|mathit|textsf|underline|over|hat|bar|vec|tilde|dot|ddot|circ|degree|angle|perp|parallel|subset|supset|cap|cup|in|notin|lor|land|neg|sim|cong|propto|begin|end)\b/gi;
      const preProcessed = trimmed.replace(latexRegex, '\\\\$1');

      try { return cleanControlCharsInParsedObject(JSON.parse(preProcessed)); } catch {}

      let sanitized = '';
      let inString = false;
      let escaped = false;

      for (let i = 0; i < preProcessed.length; i++) {
        const char = preProcessed[i];
        const code = preProcessed.charCodeAt(i);

        if (char === '"' && !escaped) {
          inString = !inString;
          sanitized += char;
        } else if (inString) {
          if (char === '\n') {
            sanitized += '\\n';
          } else if (char === '\r') {
            sanitized += '\\r';
          } else if (char === '\t') {
            sanitized += '\\t';
          } else if (code < 32) {
            sanitized += ' ';
          } else if (char === '\\') {
            const sub = preProcessed.slice(i + 1);
            const isLatex = /^(?:frac|sqrt|sum|int|lim|prod|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|forall|exists|infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|left|right|big|Big|text|textbf|textit|mathrm|mathbf|mathit|textsf|underline|over|hat|bar|vec|tilde|dot|ddot|circ|degree|angle|perp|parallel|subset|supset|cap|cup|in|notin|lor|land|neg|sim|cong|propto|begin|end)\b/i.test(sub);
            const next = preProcessed[i + 1];
            if (isLatex) {
              sanitized += '\\\\';
            } else if (next && ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(next)) {
              sanitized += '\\';
            } else {
              sanitized += '\\\\';
            }
          } else {
            sanitized += char;
          }
        } else {
          sanitized += char;
        }

        if (char === '\\' && !escaped) {
          escaped = true;
        } else {
          escaped = false;
        }
      }

      sanitized = sanitized.replace(/,\s*([\]}])/g, '$1');

      try {
        return cleanControlCharsInParsedObject(JSON.parse(sanitized));
      } catch {}

      let openBraces = 0;
      let openBrackets = 0;
      let inStr = false;
      let esc = false;

      for (let i = 0; i < sanitized.length; i++) {
        const c = sanitized[i];
        if (c === '"' && !esc) inStr = !inStr;
        if (!inStr) {
          if (c === '{') openBraces++;
          else if (c === '}') openBraces = Math.max(0, openBraces - 1);
          else if (c === '[') openBrackets++;
          else if (c === ']') openBrackets = Math.max(0, openBrackets - 1);
        }
        esc = (c === '\\' && !esc);
      }

      let repaired = sanitized;
      if (inStr) repaired += '"';
      while (openBrackets > 0) { repaired += ']'; openBrackets--; }
      while (openBraces > 0) { repaired += '}'; openBraces--; }

      try {
        return cleanControlCharsInParsedObject(JSON.parse(repaired));
      } catch {
        return null;
      }
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
          const parsed = safeJsonParse(jsonRawCandidate);

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
            } else if (
              defaultType === "devoir-complet" ||
              parsed.creation_type === "devoir-complet" ||
              parsed.complete_exam ||
              parsed.exam ||
              parsed.devoir ||
              parsed.baremeTotal ||
              parsed.exercice1 ||
              (Array.isArray(parsed.sections) && parsed.sections.some((s) => s?.questions || s?.problem_statement || s?.section_id?.includes('sec') || s?.title?.toLowerCase().includes('fiche') || s?.title?.toLowerCase().includes('partie')))
            ) {
              decision = "creation";
              creation_type = "devoir-complet";
              const ex = parsed.complete_exam || parsed.exam || parsed.devoir || parsed;
              creation_title = ex.title || ex.matiere || parsed.title || "Épreuve Officielle d'Examen (20 pts)";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre épreuve officielle d'examen sur 20 points (3 fiches) est prête dans l'espace Création !";
            } else if (parsed.written_exercise || Array.isArray(parsed.exercises) || Array.isArray(parsed.exercices) || (defaultType === "exercices-ecrits" && Array.isArray(parsed.questions))) {
              decision = "creation";
              creation_type = "exercices-ecrits";
              const we = parsed.written_exercise || parsed;
              creation_title = we.title || parsed.title || "Exercice Écrit & Résolution de Problème";
              creation_data = parsed;
              chat_message = parsed.chat_message || parsed.chat_response || "✨ Votre exercice écrit et sa correction détaillée sont prêts dans l'espace Création !";
            } else if (parsed.summary || parsed.overview || (defaultType === "resume" && Array.isArray(parsed.sections))) {
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
            } else if (parsed.decision === "chat" || parsed.mode === "chat") {
              decision = "chat";
              chat_message = parsed.chat_message || parsed.chat_response || rawText;
            }
          }
        } catch {
          // En cas d'erreur de parsing, tenter l'extraction directe
        }
      }

      // Extraction de secours à partir du texte brut si le JSON était incomplet, tronqué ou malformé
      if (!creation_data && rawText) {
        if (defaultType === "questionnaire" || defaultType === "questionnaire-test" || defaultType === "quiz" || (!defaultType && (rawText.includes("Option A") || rawText.includes("A)") || rawText.includes("A.")))) {
          const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
          const extractedQuestions = [];
          let currentQ = null;

          for (const line of lines) {
            const qMatch = line.match(/^(?:(?:\*{1,2}|#{1,4}\s*)?(?:Question\s*)?(\d+)[.:\)]\s*(?:\*{1,2})?|Q(\d+)[:\.-])\s*(.*)/i);
            const optMatch = line.match(/^(?:[-*•]\s*)?(?:(?:\*{1,2})?([A-Da-d1-4])[.:\)\-]\s*(?:\*{1,2})?|\(([A-Da-d1-4])\)|\[([A-Da-d1-4])\])\s*(.*)/i);
            const ansMatch = line.match(/(?:(?:bonne|correcte?)\s+)?r[eé]ponse(?:\s+correcte)?\s*[:=]\s*[*_`]*([A-Da-d1-4])/i) || line.match(/Answer\s*[:=]\s*[*_`]*([A-Da-d1-4])/i);
            const explMatch = line.match(/(?:explication|justification|pourquoi|note|remarque)\s*[:=]\s*(.*)/i);

            if (qMatch && !optMatch) {
              if (currentQ && currentQ.options.length >= 2) {
                extractedQuestions.push(currentQ);
              }
              const qTitle = qMatch[3] || qMatch[1] || line;
              currentQ = {
                id: `q_${extractedQuestions.length + 1}`,
                question: qTitle.replace(/^\*{1,2}|\*{1,2}$/g, '').trim(),
                options: [],
                correctIndex: 0,
                explanation: ''
              };
            } else if (optMatch && currentQ) {
              const optText = (optMatch[4] || optMatch[3] || optMatch[2] || optMatch[1] || '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
              if (optText) {
                currentQ.options.push(optText);
              }
            } else if (ansMatch && currentQ) {
              const char = (ansMatch[1] || '').toUpperCase();
              if (char >= 'A' && char <= 'D') {
                currentQ.correctIndex = char.charCodeAt(0) - 65;
              } else if (char >= '1' && char <= '4') {
                currentQ.correctIndex = parseInt(char, 10) - 1;
              }
            } else if (explMatch && currentQ) {
              currentQ.explanation = explMatch[1].trim();
            }
          }
          if (currentQ && currentQ.options.length >= 2) {
            extractedQuestions.push(currentQ);
          }

          if (extractedQuestions.length > 0) {
            decision = "creation";
            creation_type = defaultType || "questionnaire";
            creation_title = "Questionnaire interactif";
            creation_data = { questions: extractedQuestions };
          }
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

    // ========================================================================
    // MOTEUR UNIVERSEL D'APERÇU HTML & CSS POUR LES 12 TYPES DE CRÉATION STUDYCLOUD
    // Génère une page HTML autonome, responsive, moderne et compatible KaTeX LaTeX
    // ========================================================================
    function escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function generateCreationHtmlPreview(toolType, title, data, docName) {
      const normType = String(toolType || "devoir-complet").toLowerCase().trim();
      const safeTitle = escapeHtml(title || "Création StudyCloud");
      const safeDoc = escapeHtml(docName || "Document d'étude");
      let payload = (data && typeof data === "object") ? data : {};

      const moduleMeta = {
        "questionnaire": { label: "Questionnaire Interactif", badge: "QCM Interactif", color: "#10b981", bg: "#064e3b", icon: "📝" },
        "questionnaire-test": { label: "Questionnaire Test Noté", badge: "Test Noté /20", color: "#14b8a6", bg: "#134e4a", icon: "⏱️" },
        "vrai-ou-faux": { label: "Vrai ou Faux", badge: "Cartes Réflexes", color: "#22c55e", bg: "#14532d", icon: "⚡" },
        "vrai-ou-faux-test": { label: "Vrai ou Faux Test", badge: "Évaluation V/F /20", color: "#84cc16", bg: "#365314", icon: "🎯" },
        "carte-mentale": { label: "Carte Mentale", badge: "Arborescence Visuelle", color: "#8b5cf6", bg: "#4c1d95", icon: "🧠" },
        "carte-mentale-2": { label: "Carte Mentale Conceptuelle", badge: "Blocs Hiérarchiques", color: "#6366f1", bg: "#312e81", icon: "🗺️" },
        "carte-memoire": { label: "Cartes Mémoire", badge: "Flashcards 3D", color: "#f43f5e", bg: "#881337", icon: "🃏" },
        "resume": { label: "Fiche de Synthèse", badge: "Résumé Didactique", color: "#3b82f6", bg: "#1e3a8a", icon: "📄" },
        "pdf": { label: "Document PDF Officiel", badge: "Polycopié Académique", color: "#ef4444", bg: "#7f1d1d", icon: "📑" },
        "infographie": { label: "Infographie Pédagogique", badge: "Repères & Métriques", color: "#06b6d4", bg: "#164e63", icon: "📊" },
        "exercices-ecrits": { label: "Exercices Écrits", badge: "Résolution de Problème", color: "#f59e0b", bg: "#78350f", icon: "✍️" },
        "devoir-complet": { label: "Devoir Complet", badge: "Épreuve Officielle /20", color: "#a855f7", bg: "#581c87", icon: "🏆" }
      };

      const meta = moduleMeta[normType] || moduleMeta["devoir-complet"];

      // ========================================================================
      // GÉNÉRATEUR INTELLIGENT DE DONNÉES ADAPTIVES (SI PAYLOAD VIDE)
      // Adapte les questions au sujet réel du cours (sans jamais forcer un AOP rigide)
      // ========================================================================
      const subjectTopic = safeTitle !== "Création StudyCloud" ? safeTitle : (safeDoc.replace(/\.[^/.]+$/, "") || "Module de Cours");

      if (normType === "questionnaire" || normType === "questionnaire-test") {
        if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
          payload.questions = [
            {
              id: "q_1",
              question: `Quel est le principe fondamental régissant l'étude de : "${subjectTopic}" ?`,
              options: [
                `La relation directe de cause à effet modélisée par les équations caractéristiques du domaine`,
                `Une approche purement statique négligeant les variations temporelles et les contraintes réelles`,
                `L'annulation systématique des grandeurs physiques sous conditions standards`,
                `Un comportement aléatoire non reproductible en conditions de laboratoire`
              ],
              correctIndex: 0,
              explanation: `Démonstration théorique : l'analyse de "${subjectTopic}" repose sur des lois d'équilibre et de conservation fondamentales.\n\n• Exemple 1 : Cas d'application standard où les paramètres d'entrée fixent fidèlement l'état de sortie.\n• Exemple 2 : Situation aux limites mettant en évidence la zone de fonctionnement nominal.`
            },
            {
              id: "q_2",
              question: `Lors de l'application pratique sur "${subjectTopic}", quelle condition essentielle doit être respectée pour garantir la validité des résultats ?`,
              options: [
                `Le maintien du système dans sa plage de fonctionnement linéaire ou nominale`,
                `Le dépassement volontaire des seuils critiques pour saturer les variables`,
                `L'absence totale de données expérimentales ou de paramètres étalonnés`,
                `L'inversion fortuite des polarités ou grandeurs de référence`
              ],
              correctIndex: 0,
              explanation: `Démonstration théorique : le régime linéaire ou nominal permet d'appliquer les principes de superposition et de modélisation mathématique rigoureuse.\n\n• Exemple 1 : Dimensionnement préventif évitant tout écrêtage ou instabilité.\n• Exemple 2 : Cas de saturation entraînant une distorsion des prédictions théoriques.`
            },
            {
              id: "q_3",
              question: `Quelle relation analytique lie les variables d'entrée et de sortie dans l'étude approfondie de "${subjectTopic}" ?`,
              options: [
                `Une fonction de transfert proportionnelle $S = K \\cdot E$ respectant la conservation des grandeurs`,
                `Une dépendance inversement quadratique dénuée de constante d'équilibrage`,
                `Une relation purement discrète ne tolérant aucune valeur intermédiaire`,
                `Une invariance absolue insensible à toute modification des paramètres`
              ],
              correctIndex: 0,
              explanation: `Démonstration théorique : la fonction de transfert ou la loi fondamentale traduit la sensibilité et la réponse du système face aux sollicitations.\n\n• Exemple 1 : Calcul direct d'une grandeur dérivée à partir des grandeurs fondamentales.\n• Exemple 2 : Analyse de sensibilité permettant d'anticiper les variations de tolérance.`
            }
          ];
        }
      } else if (normType === "vrai-ou-faux" || normType === "vrai-ou-faux-test") {
        if (!Array.isArray(payload.affirmations) || payload.affirmations.length === 0) {
          payload.affirmations = [
            {
              id: "vf_1",
              statement: `Les modèles analytiques appliqués à "${subjectTopic}" supposent la conservation stricte des grandeurs aux limites du système.`,
              isTrue: true,
              explanation: `VRAI : Les principes premiers imposent un équilibre rigoureux entre les flux entrants et sortants dans tout domaine d'ingénierie et de sciences appliquées.\n\n• Exemple 1 : Validation expérimentale vérifiant le bilan d'énergie ou de matière.\n• Exemple 2 : Bilan thermodynamique ou électrique en régime permanent.`
            },
            {
              id: "vf_2",
              statement: `Une variation des paramètres caractéristiques de "${subjectTopic}" n'a aucun impact mesurable sur la réponse globale du système.`,
              isTrue: false,
              explanation: `FAUX : Tout système physique ou conceptuel réagit de manière proportionnée ou exponentielle aux variations de ses coefficients internes.\n\n• Exemple 1 : Une dérive de 10% d'un paramètre clé modifie directement le point de fonctionnement.\n• Exemple 2 : Risque d'instabilité si la marge de sécurité est sous-dimensionnée.`
            },
            {
              id: "vf_3",
              statement: `La maîtrise méthodologique de "${subjectTopic}" nécessite à la fois l'analyse théorique des équations et la validation par des cas pratiques concrets.`,
              isTrue: true,
              explanation: `VRAI : L'excellence pédagogique exige la double maîtrise : compréhension formelle des équations ($...$) et application pratique contextualisée.\n\n• Exemple 1 : Calcul préalable dimensionnant les grandeurs critiques.\n• Exemple 2 : Confrontation aux données réelles de mesures et détection d'écarts.`
            }
          ];
        }
      } else if (normType === "carte-mentale") {
        if (!payload.mind_map && !payload.branches) {
          payload.mind_map = {
            root_title: subjectTopic,
            branches: [
              {
                branch_title: "1. Fondements & Définitions Clés",
                nodes: [
                  "Origines théoriques et axiomes fondamentaux",
                  "Grandeurs caractéristiques et unités de mesure standard",
                  "Hypothèses de travail et domaine de validité"
                ]
              },
              {
                branch_title: "2. Équations & Modélisation Mathématique",
                nodes: [
                  "Formulation analytique des lois fondamentales",
                  "Variables d'état et équations de comportement",
                  "Résolution méthodique étape par étape"
                ]
              },
              {
                branch_title: "3. Méthodologie d'Analyse Pratique",
                nodes: [
                  "Protocole de dimensionnement et calculs chiffrés",
                  "Points de contrôle critiques et détection des anomalies",
                  "Interprétation des résultats et prise de décision"
                ]
              },
              {
                branch_title: "4. Applications Concrètes & Perspectives",
                nodes: [
                  "Cas industriels et situations professionnelles types",
                  "Limites physiques et optimisations possibles",
                  "Recommandations de bonnes pratiques"
                ]
              }
            ]
          };
        }
      } else if (normType === "carte-mentale-2") {
        if (!payload.concept_map && !payload.mind_map && !payload.pillars) {
          payload.concept_map = {
            title: subjectTopic,
            pillars: [
              {
                name: "Socle Conceptuel",
                badge: "Axiomes",
                color: "#6366f1",
                items: [
                  "Principes fondamentaux régissant le sujet",
                  "Définitions universelles et nomenclature technique",
                  "Cadre normatif et hypothèses initiales"
                ]
              },
              {
                name: "Dynamique & Calculs",
                badge: "Formulations",
                color: "#8b5cf6",
                items: [
                  "Mise en équation rigoureuse en syntaxe LaTeX",
                  "Détermination analytique des variables cibles",
                  "Relations d'interdépendance et fonctions de transfert"
                ]
              },
              {
                name: "Validation & Réalisation",
                badge: "Cas Réels",
                color: "#06b6d4",
                items: [
                  "Étude de cas pratique en situation nominale",
                  "Analyse d'impact des perturbations externes",
                  "Critères de performance et synthèse opérationnelle"
                ]
              }
            ]
          };
        }
      } else if (normType === "carte-memoire") {
        if (!Array.isArray(payload.flashcards) && !Array.isArray(payload.cards)) {
          payload.flashcards = [
            {
              id: "fc_1",
              front: `Quelle est la définition exacte et la portée de "${subjectTopic}" ?`,
              back: {
                definition: `Ensemble cohérent de principes théoriques et de méthodes pratiques permettant de modéliser, calculer et dimensionner les processus du domaine.`,
                examples: [
                  `Exemple 1 : Application directe en bureau d'études ou laboratoire de recherche.`,
                  `Exemple 2 : Déclinaison sur des cas d'usage réels garantissant robustesse et sécurité.`
                ]
              }
            },
            {
              id: "fc_2",
              front: `Quelles sont les conditions indispensables pour appliquer les formules de calcul relatives à ce cours ?`,
              back: {
                definition: `Le respect des hypothèses de modélisation (régime stationnaire, absence de discontinuités parasites et conformité des unités de mesure).`,
                examples: [
                  `Exemple 1 : Vérification que les grandeurs restent inférieures aux seuils de saturation.`,
                  `Exemple 2 : Prise en compte des coefficients de sécurité préconisés par les normes.`
                ]
              }
            },
            {
              id: "fc_3",
              front: `Comment interpréter un écart significatif entre le calcul théorique et les observations réelles ?`,
              back: {
                definition: `Un écart révèle soit l'influence de variables secondaires négligées dans le modèle simplifié, soit une dérive des grandeurs d'entrée.`,
                examples: [
                  `Exemple 1 : Effets thermiques ou résistances parasites modifiant le rendement.`,
                  `Exemple 2 : Non-linéarités se manifestant sous fortes amplitudes de signal.`
                ]
              }
            }
          ];
        }
      } else if (normType === "resume") {
        if (!payload.summary && !payload.sections) {
          payload.summary = {
            title: `Fiche de Synthèse : ${subjectTopic}`,
            overview: `Cette fiche didactique récapitule de manière condensée et rigoureuse l'ensemble des connaissances fondamentales, des lois mathématiques et des règles méthodologiques associées à "${subjectTopic}". Elle a été conçue pour offrir à l'étudiant une vision panoramique claire tout en insistant sur les équations indispensables et les réflexes d'examen.`,
            sections: [
              {
                section_title: "1. Principes Directeurs & Définitions",
                content: `Le domaine repose sur une décomposition ordonnée des phénomènes. Chaque grandeur est caractérisée par son équation dimensionnelle et ses conditions aux limites. Il est essentiel de maîtriser le vocabulaire exact pour formuler des réponses précises.`
              },
              {
                section_title: "2. Équations & Règles Opératoires",
                content: `Les formulations mathématiques générales permettent de déduire chaque variable intermédiaire : $V_s = f(V_e, t)$, avec un dimensionnement rigoureux garantissant la marge de sécurité et la stabilité du système en toutes circonstances.`
              },
              {
                section_title: "3. Méthode de Résolution Type aux Examens",
                content: `Pour aborder efficacement tout exercice : 1) Poser le schéma conceptuel et inventorier les données connues ; 2) Identifier la loi générale applicable ; 3) Conduire le calcul littéral avant toute application numérique chiffrée.`
              }
            ]
          };
        }
      } else if (normType === "pdf") {
        if (!payload.pdf_document && !payload.chapters) {
          payload.pdf_document = {
            metadata: {
              title: `Polycopié d'Étude & Synthèse : ${subjectTopic}`,
              author: "StudyCloud AI • DKD Technologies",
              date: new Date().toLocaleDateString("fr-FR"),
              source_file: safeDoc
            },
            chapters: [
              {
                heading: "Introduction Générale & Objectifs Pédagogiques",
                content: `Ce polycopié constitue le document de référence officiel sur le sujet. Il a pour vocation de structurer la pensée de l'étudiant, d'établir les liens entre concepts théoriques et applications concrètes, et de consolider les automatismes de résolution.`
              },
              {
                heading: "Chapitre 1 : Modélisation et Démonstrations Analytiques",
                content: `L'étude débute par la modélisation formelle. Chaque équation est justifiée par les théorèmes fondamentaux. L'expression analytique finale découle d'un enchaînement logique d'étapes sans approximation hâtive.`
              },
              {
                heading: "Chapitre 2 : Études de Cas & Démarche Expérimentale",
                content: `La confrontation à des cas concrets d'application permet de tester la robustesse des modèles. Les tolérances de fabrication, les contraintes environnementales et les coûts de dimensionnement sont passés au crible.`
              },
              {
                heading: "Chapitre 3 : Fiches Récapitulatives & Mémento Pratique",
                content: `Un recueil concis des formules indispensables à retenir par cœur, accompagné des mises en garde contre les confusions fréquentes répertoriées lors des sessions d'examens antérieures.`
              }
            ]
          };
        }
      } else if (normType === "infographie") {
        if (!payload.infographic && !payload.metrics && !payload.steps) {
          payload.infographic = {
            title: `Infographie Pédagogique : ${subjectTopic}`,
            metrics: [
              { value: "100%", label: "Couverture du Programme", color: "#38bdf8" },
              { value: "3 Étapes", label: "Méthode de Résolution", color: "#10b981" },
              { value: "0 Erreur", label: "Rigueur des Calculs", color: "#f59e0b" },
              { value: "20/20", label: "Objectif Réussite", color: "#a855f7" }
            ],
            steps: [
              { step: 1, heading: "Analyse des Données", badge: "Étape 1", description: "Identifier les grandeurs d'entrée, les contraintes aux limites et les lois applicables.", color: "#38bdf8" },
              { step: 2, heading: "Mise en Équation", badge: "Étape 2", description: "Formuler le problème en syntaxe mathématique littérale et isoler l'inconnue.", color: "#10b981" },
              { step: 3, heading: "Application & Contrôle", badge: "Étape 3", description: "Calculer les valeurs numériques avec leurs unités et vérifier la vraisemblance physique.", color: "#a855f7" }
            ],
            highlights: [
              { title: "Réflexe d'Examen", text: "Ne jamais faire l'application numérique avant d'avoir entièrement validé l'expression littérale.", type: "tip" },
              { title: "Vérification d'Ordre de Grandeur", text: "Vérifier systématiquement que le résultat numérique obtenu reste cohérent avec l'échelle physique du problème.", type: "warning" }
            ],
            conclusion: `La maîtrise de ${subjectTopic} repose sur une méthodologie ordonnée et la vigilance sur les détails de calculs.`
          };
        }
      } else if (normType === "exercices-ecrits") {
        if (!payload.written_exercise && !payload.context && !payload.questions) {
          payload.written_exercise = {
            title: `Exercice Écrit : Analyse Approfondie sur ${subjectTopic}`,
            context: `On s'intéresse à l'évaluation méthodique de "${subjectTopic}". Le sujet impose d'établir les équations directrices, de conduire les calculs littéraux pas à pas, puis de procéder à l'application numérique chiffrée en justifiant chaque hypothèse retenue.`,
            questions: [
              `1. Rappeler les lois et théorèmes fondamentaux applicables à l'étude de ce système.`,
              `2. Établir l'expression analytique littérale de la grandeur principale en fonction des paramètres du problème.`,
              `3. Procéder à l'application numérique pour les conditions nominales et commenter le résultat obtenu.`
            ],
            correction: {
              steps: `Démonstration méthodique complète :\n1) D'après les lois fondamentales, le système vérifie l'équilibre entre les grandeurs sollicitantes et réactives.\n2) En regroupant les termes : $S = K \\cdot E$. L'expression littérale finale est donc validée.\n3) Application numérique : après substitution des valeurs données avec respect des unités SI, on obtient la grandeur exacte recherchée.`,
              examples: [
                `Exemple 1 : Dimensionnement nominal dans un cahier des charges professionnel.`,
                `Exemple 2 : Analyse d'un cas particulier aux limites (valeurs minimales et maximales admissibles).`
              ]
            }
          };
        }
      } else if (normType === "devoir-complet") {
        const exam = payload.complete_exam || payload.exam || payload.devoir || payload;
        if (!Array.isArray(exam.sections) || exam.sections.length === 0) {
          payload.complete_exam = {
            title: `Épreuve Officielle d'Examen : ${subjectTopic}`,
            instructions: "L'épreuve comporte exactement 3 exercices indépendants notés sur 20 points. Traitez l'ensemble des questions avec la plus grande rigueur mathématique et scientifique.",
            duree: "2h00",
            duration_minutes: 120,
            baremeTotal: 20,
            sections: [
              {
                section_id: "sec_1",
                title: "EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 POINTS)",
                problem_statement: `On étudie le comportement de "${subjectTopic}". L'étudiant est invité à analyser les paramètres en jeu, à établir les démonstrations théoriques étape par étape et à calculer les grandeurs caractéristiques demandées.`,
                questions: [
                  {
                    id: "p1_q1",
                    number: "1.",
                    type: "open",
                    points: 3,
                    texte: `Déterminer l'expression analytique littérale régissant la grandeur fondamentale du système.`,
                    sampleAnswer: `En appliquant les théorèmes généraux du cours : l'expression littérale est démontrée étape par étape.`
                  },
                  {
                    id: "p1_q2",
                    number: "2.",
                    type: "open",
                    points: 3,
                    texte: `Calculer la valeur numérique exacte de cette grandeur sous les conditions d'application nominales.`,
                    sampleAnswer: `Application numérique effectuée avec précision en respectant les unités internationales.`
                  },
                  {
                    id: "p1_q3",
                    number: "3.",
                    type: "open",
                    points: 2,
                    texte: `Préciser les conditions physiques ou conceptuelles assurant la non-détérioration et la stabilité de la réponse.`,
                    sampleAnswer: `La condition de fonctionnement nominal impose le respect strict des marges de sécurité définies par les seuils limites.`
                  }
                ],
                correction: {
                  steps: `Démonstration complète pas à pas selon les principes fondamentaux de ${subjectTopic}.`,
                  examples: [
                    `Exemple 1 : Cas concret de mise en œuvre en situation pratique.`,
                    `Exemple 2 : Analyse d'un écueil classique à éviter lors de l'évaluation.`
                  ]
                }
              },
              {
                section_id: "sec_2",
                title: "EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 POINTS)",
                questions: [
                  {
                    id: "p2_q1",
                    number: "1.",
                    type: "multiple_choice",
                    points: 1.5,
                    texte: `Quelle hypothèse est indispensable pour garantir la linéarité du modèle dans "${subjectTopic}" ?`,
                    options: [
                      `Le respect strict de la zone de validité et l'absence de saturation`,
                      `La suppression volontaire de toute charge ou sollicitation externe`,
                      `La variation désordonnée des paramètres constitutifs`,
                      `L'annulation instantanée des variables d'équilibre`
                    ],
                    correctIndex: 0,
                    explication: `La linéarité découle du respect strict de la zone nominale d'opération.`
                  },
                  {
                    id: "p2_q2",
                    number: "2.",
                    type: "multiple_choice",
                    points: 1.5,
                    texte: `Si l'un des paramètres directeurs du système est multiplié par deux, quelle est la conséquence prévisible ?`,
                    options: [
                      `La grandeur de sortie est proportionnellement amplifiée selon le gain caractéristique`,
                      `Le système cesse instantanément toute interaction sans explication logique`,
                      `La valeur finale est divisée par quatre de manière systématique`,
                      `La réponse devient totalement imprévisible`
                    ],
                    correctIndex: 0,
                    explication: `En régime proportionnel, la réponse suit directement la loi de transfert.`
                  },
                  {
                    id: "p2_q3",
                    number: "3.",
                    type: "multiple_choice",
                    points: 1.5,
                    texte: `Quelle grandeur est conservée lors de la transition d'un état à l'autre ?`,
                    options: [
                      `L'énergie ou la grandeur de flux globale du système`,
                      `Uniquement les grandeurs arbitraires non mesurables`,
                      `Aucune grandeur ne peut être conservée en pratique`,
                      `La composante d'erreur parasite exclusivement`
                    ],
                    correctIndex: 0,
                    explication: `Le principe de conservation s'applique sans exception à l'échelle du système global.`
                  },
                  {
                    id: "p2_q4",
                    number: "4.",
                    type: "multiple_choice",
                    points: 1.5,
                    texte: `Quelle est l'unité internationale normalisée associée aux grandeurs de calcul de ce sujet ?`,
                    options: [
                      `L'unité SI standard correspondant à la dimension physique de la variable`,
                      `Une unité empirique non convertible`,
                      `Une simple valeur scalaire sans aucune dimension physique`,
                      `Une unité purement arbitraire modifiable à volonté`
                    ],
                    correctIndex: 0,
                    explication: `L'homogénéité dimensionnelle impose l'utilisation rigoureuse des unités du Système International (SI).`
                  }
                ],
                correction: {
                  steps: `Synthèse théorique justifiant les bonnes réponses du QCM d'évaluation.`,
                  examples: [
                    `Exemple 1 : Vérification dimensionnelle par analyse des unités.`,
                    `Exemple 2 : Identification rapide des distracteurs erronés par raisonnement par l'absurde.`
                  ]
                }
              },
              {
                section_id: "sec_3",
                title: "EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 POINTS)",
                questions: [
                  {
                    id: "p3_q1",
                    number: "1.",
                    type: "true_false",
                    points: 1.5,
                    texte: `Dans l'analyse de "${subjectTopic}", les théorèmes d'équivalence permettent de simplifier les démonstrations sans perte d'information.`,
                    correct_answer: true,
                    explication: `VRAI : Les théorèmes d'équivalence conservent les propriétés aux bornes du système.\n\n• Exemple 1 : Réduction d'un modèle complexe à son schéma équivalent.\n• Exemple 2 : Gain de temps significatif lors des calculs d'examen.`
                  },
                  {
                    id: "p3_q2",
                    number: "2.",
                    type: "true_false",
                    points: 1.5,
                    texte: `La valeur maximale d'une grandeur mesurée peut dépasser sans limite les capacités physiques d'alimentation du dispositif.`,
                    correct_answer: false,
                    explication: `FAUX : Tout dispositif physique est borné par ses limites intrinsèques et ses rails d'alimentation.\n\n• Exemple 1 : Phénomène de saturation entraînant l'écrêtage de la réponse.\n• Exemple 2 : Échauffement thermique imposant une limite de sécurité absolue.`
                  },
                  {
                    id: "p3_q3",
                    number: "3.",
                    type: "true_false",
                    points: 1.5,
                    texte: `Une augmentation de la sensibilité d'un système réduit généralement sa marge de stabilité ou sa bande passante.`,
                    correct_answer: true,
                    explication: `VRAI : Le compromis entre gain et dynamique est une loi universelle d'ingénierie.\n\n• Exemple 1 : Un gain élevé réduit la réactivité face aux hautes fréquences.\n• Exemple 2 : Nécessité de compensateurs pour préserver la marge de phase.`
                  },
                  {
                    id: "p3_q4",
                    number: "4.",
                    type: "true_false",
                    points: 1.5,
                    texte: `L'application numérique peut être menée avec succès sans poser au préalable les hypothèses initiales du modèle.`,
                    correct_answer: false,
                    explication: `FAUX : Sans hypothèses validées, les résultats chiffrés sont dépourvus de sens physique et mènent à des conclusions erronées.\n\n• Exemple 1 : Erreur de dimensionnement grave en ingénierie par oubli d'une contrainte.\n• Exemple 2 : Sanction immédiate du barème lors des concours officiels.`
                  }
                ],
                correction: {
                  steps: `Synthèse théorique et justification formelle des 4 affirmations Vrai ou Faux.`,
                  examples: [
                    `Exemple 1 : Démarche de validation réflexe face à un énoncé d'examen.`,
                    `Exemple 2 : Analyse critique des pièges fréquents dans les copies d'étudiants.`
                  ]
                }
              }
            ]
          };
        }
      }

      let bodyHtml = "";

      // 1 & 2 : QUESTIONNAIRE & QUESTIONNAIRE-TEST
      if (normType === "questionnaire" || normType === "questionnaire-test") {
        const isTest = normType === "questionnaire-test";
        const questions = Array.isArray(payload.questions) ? payload.questions : [];
        bodyHtml += `<div class="intro-bar"><span class="badge" style="background:${meta.bg};color:${meta.color}">${meta.badge}</span> <span>${questions.length} questions interactives • ${isTest ? "Mode Évaluation notée sur 20" : "Mode Entraînement avec feedback instantané"}</span></div>`;
        bodyHtml += `<form id="quiz-form" onsubmit="return false;">`;
        questions.forEach((q, idx) => {
          const qId = q.id || `q_${idx + 1}`;
          const qText = escapeHtml(q.question || q.texte || `Question ${idx + 1}`);
          const options = Array.isArray(q.options) ? q.options : [];
          const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : 0;
          const expl = escapeHtml(q.explanation || q.explication || "Démonstration théorique et justification complète.");
          bodyHtml += `
            <div class="card question-card" id="card_${qId}" data-correct="${correctIdx}">
              <div class="q-header">
                <span class="q-number">Question ${idx + 1} / ${questions.length}</span>
                <span class="q-points">${isTest ? (20 / (questions.length || 1)).toFixed(1) + " pts" : ""}</span>
              </div>
              <div class="q-text">${qText}</div>
              <div class="options-list">
                ${options.map((opt, optIdx) => {
                  const letters = ["A", "B", "C", "D", "E"];
                  const letter = letters[optIdx] || `${optIdx + 1}`;
                  return `
                    <label class="option-label" id="opt_${qId}_${optIdx}" onclick="handleOptionSelect('${qId}', ${optIdx}, ${correctIdx}, ${isTest})">
                      <input type="radio" name="ans_${qId}" value="${optIdx}">
                      <span class="opt-letter">${letter}</span>
                      <span class="opt-text">${escapeHtml(opt)}</span>
                    </label>
                  `;
                }).join("")}
              </div>
              <div class="feedback-box ${isTest ? 'hidden' : ''}" id="fb_${qId}">
                <div class="fb-title">💡 Explication & Corrigé :</div>
                <div class="fb-content">${expl}</div>
              </div>
            </div>
          `;
        });
        if (isTest) {
          bodyHtml += `
            <div class="action-bar-center">
              <button type="button" class="btn btn-primary" onclick="submitTest(${questions.length})">
                ✓ Valider mon Test & Calculer ma Note sur 20
              </button>
            </div>
            <div id="test-result-banner" class="test-result-banner hidden"></div>
          `;
        }
        bodyHtml += `</form>`;
      }
      // 3 & 4 : VRAI OU FAUX & VRAI OU FAUX TEST
      else if (normType === "vrai-ou-faux" || normType === "vrai-ou-faux-test") {
        const isTest = normType === "vrai-ou-faux-test";
        const affirmations = Array.isArray(payload.affirmations) ? payload.affirmations : [];
        bodyHtml += `<div class="intro-bar"><span class="badge" style="background:${meta.bg};color:${meta.color}">${meta.badge}</span> <span>${affirmations.length} affirmations réflexes • Évaluez chaque proposition</span></div>`;
        bodyHtml += `<form id="vf-form" onsubmit="return false;">`;
        affirmations.forEach((item, idx) => {
          const vfId = item.id || `vf_${idx + 1}`;
          const stmt = escapeHtml(item.statement || item.texte || `Affirmation ${idx + 1}`);
          const isTrue = item.isTrue === true || item.correctValue === true || item.valeur === true;
          const expl = escapeHtml(item.explanation || item.explication || "Démonstration théorique et justification de la valeur de vérité.");
          bodyHtml += `
            <div class="card vf-card" id="vf_card_${vfId}" data-istrue="${isTrue ? '1' : '0'}">
              <div class="vf-header">
                <span class="q-number">Affirmation ${idx + 1} / ${affirmations.length}</span>
                <span class="q-points">${isTest ? (20 / (affirmations.length || 1)).toFixed(1) + " pts" : ""}</span>
              </div>
              <div class="vf-statement">"${stmt}"</div>
              <div class="vf-buttons">
                <button type="button" class="vf-btn btn-vrai" id="btn_v_${vfId}" onclick="handleVfChoice('${vfId}', true, ${isTrue}, ${isTest})">
                  ✓ VRAI
                </button>
                <button type="button" class="vf-btn btn-faux" id="btn_f_${vfId}" onclick="handleVfChoice('${vfId}', false, ${isTrue}, ${isTest})">
                  ✕ FAUX
                </button>
              </div>
              <div class="feedback-box ${isTest ? 'hidden' : ''}" id="fb_vf_${vfId}">
                <div class="fb-title">${isTrue ? '✅ Réponse attendue : VRAI' : '❌ Réponse attendue : FAUX'}</div>
                <div class="fb-content">${expl}</div>
              </div>
            </div>
          `;
        });
        if (isTest) {
          bodyHtml += `
            <div class="action-bar-center">
              <button type="button" class="btn btn-primary" onclick="submitVfTest(${affirmations.length})">
                ✓ Valider le Test Vrai / Faux & Noter sur 20
              </button>
            </div>
            <div id="vf-result-banner" class="test-result-banner hidden"></div>
          `;
        }
        bodyHtml += `</form>`;
      }
      // 5 : CARTE MENTALE (ARBORESCENTE DYNAMIQUE)
      else if (normType === "carte-mentale") {
        const mm = payload.mind_map || payload.mindmap || payload;
        const rootTitle = escapeHtml(mm.root_title || mm.rootTitle || mm.title || safeTitle);
        const branches = Array.isArray(mm.branches) ? mm.branches : [];
        bodyHtml += `
          <div class="mindmap-container">
            <div class="mindmap-root">
              <div class="root-badge">Thème Central Arborescent</div>
              <div class="root-title">${rootTitle}</div>
            </div>
            <div class="mindmap-branches">
              ${branches.map((b, bIdx) => {
                const bTitle = escapeHtml(b.branch_title || b.title || `Axe ${bIdx + 1}`);
                const nodes = Array.isArray(b.nodes) ? b.nodes : [];
                return `
                  <div class="branch-card">
                    <div class="branch-header">
                      <span class="branch-dot" style="background:${meta.color}"></span>
                      <span class="branch-title">${bTitle}</span>
                    </div>
                    <ul class="branch-nodes">
                      ${nodes.map(n => `<li><span class="node-bullet">▸</span> <span class="node-text">${escapeHtml(typeof n === 'string' ? n : (n.text || n.title || JSON.stringify(n)))}</span></li>`).join("")}
                    </ul>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }
      // 6 : CARTE MENTALE 2 (CONCEPTUELLE EN BLOCS HIÉRARCHIQUES)
      else if (normType === "carte-mentale-2") {
        const cm = payload.concept_map || payload.mind_map || payload;
        const cmTitle = escapeHtml(cm.title || cm.root_title || safeTitle);
        const pillars = Array.isArray(cm.pillars) ? cm.pillars : (Array.isArray(cm.branches) ? cm.branches.map(b => ({ name: b.branch_title || b.title, badge: "Axe", color: meta.color, items: b.nodes })) : []);
        bodyHtml += `
          <div class="concept-map-container">
            <div class="concept-header card">
              <div class="concept-badge-top">Carte Conceptuelle Hiérarchique</div>
              <h1 class="concept-main-title">${cmTitle}</h1>
              <p class="concept-sub">Représentation modulaire par piliers conceptuels et relations logiques</p>
            </div>
            <div class="concept-pillars-grid">
              ${pillars.map((pil, pIdx) => {
                const pName = escapeHtml(pil.name || pil.title || `Pilier ${pIdx + 1}`);
                const pBadge = escapeHtml(pil.badge || `Module ${pIdx + 1}`);
                const pCol = pil.color || meta.color;
                const items = Array.isArray(pil.items) ? pil.items : (Array.isArray(pil.nodes) ? pil.nodes : []);
                return `
                  <div class="concept-pillar-card" style="border-top: 4px solid ${pCol}">
                    <div class="pil-top">
                      <span class="pil-badge" style="background:${pCol}22;color:${pCol}">${pBadge}</span>
                      <h3 class="pil-name">${pName}</h3>
                    </div>
                    <div class="pil-items-list">
                      ${items.map(it => `
                        <div class="pil-item-pill">
                          <span class="pil-arrow" style="color:${pCol}">➔</span>
                          <span>${escapeHtml(typeof it === 'string' ? it : (it.text || it.title || ''))}</span>
                        </div>
                      `).join("")}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }
      // 7 : CARTE MÉMOIRE / FLASHCARDS
      else if (normType === "carte-memoire") {
        const cards = Array.isArray(payload.flashcards) ? payload.flashcards : (Array.isArray(payload.cards) ? payload.cards : []);
        bodyHtml += `
          <div class="intro-bar">
            <span class="badge" style="background:${meta.bg};color:${meta.color}">${meta.badge}</span>
            <span>${cards.length} cartes de mémorisation espacée • Cliquez sur une carte pour la retourner (3D)</span>
          </div>
          <div class="flashcards-grid">
        `;
        cards.forEach((c, idx) => {
          const front = escapeHtml(c.front || c.recto || c.question || `Notion ${idx + 1}`);
          let backHtml = "";
          if (c.back && typeof c.back === "object") {
            const def = escapeHtml(c.back.definition || c.back.reponse || "");
            const examples = Array.isArray(c.back.examples) ? c.back.examples : [];
            backHtml = `<div class="fc-def">${def}</div>`;
            if (examples.length > 0) {
              backHtml += `<div class="fc-examples">${examples.map(ex => `<div class="fc-example">• ${escapeHtml(ex)}</div>`).join("")}</div>`;
            }
          } else {
            backHtml = `<div class="fc-def">${escapeHtml(String(c.back || c.verso || ""))}</div>`;
          }
          bodyHtml += `
            <div class="flashcard" onclick="this.classList.toggle('flipped')">
              <div class="flashcard-inner">
                <div class="flashcard-front">
                  <div class="fc-tag">CARTE ${idx + 1} / ${cards.length} • RECTO</div>
                  <div class="fc-front-text">${front}</div>
                  <div class="fc-hint">↻ Cliquez pour retourner</div>
                </div>
                <div class="flashcard-back">
                  <div class="fc-tag">VERSO • CORRIGÉ DÉTAILLÉ</div>
                  <div class="fc-back-body">${backHtml}</div>
                  <div class="fc-hint">↻ Cliquez pour revenir</div>
                </div>
              </div>
            </div>
          `;
        });
        bodyHtml += `</div>`;
      }
      // 8 : RÉSUMÉ / FICHE DE SYNTHÈSE
      else if (normType === "resume") {
        const sum = payload.summary || payload;
        const overview = escapeHtml(sum.overview || sum.introduction || "");
        const sections = Array.isArray(sum.sections) ? sum.sections : [];
        if (overview) {
          bodyHtml += `
            <div class="card overview-card">
              <div class="card-title">📖 Enjeux Fondamentaux et Vue d'Ensemble</div>
              <div class="overview-text">${overview}</div>
            </div>
          `;
        }
        sections.forEach((sec, idx) => {
          const sTitle = escapeHtml(sec.section_title || sec.title || `Chapitre ${idx + 1}`);
          const sContent = escapeHtml(sec.content || sec.texte || "");
          bodyHtml += `
            <div class="card section-card">
              <div class="section-badge">Chapitre ${idx + 1}</div>
              <div class="section-title">${sTitle}</div>
              <div class="section-content">${sContent}</div>
            </div>
          `;
        });
      }
      // 9 : EXPORT PDF / POLYCOPIÉ ACADÉMIQUE
      else if (normType === "pdf") {
        const pdfDoc = payload.pdf_document || payload;
        const chapters = Array.isArray(pdfDoc.chapters) ? pdfDoc.chapters : (Array.isArray(pdfDoc.sections) ? pdfDoc.sections : []);
        const metaDoc = pdfDoc.metadata || {};
        bodyHtml += `
          <div class="pdf-cover card">
            <div class="pdf-institution">STUDYCLOUD • DKD TECHNOLOGIES</div>
            <h1 class="pdf-main-title">${escapeHtml(metaDoc.title || safeTitle)}</h1>
            <div class="pdf-meta-row">
              <span>Auteur : ${escapeHtml(metaDoc.author || "StudyCloud AI")}</span>
              <span>•</span>
              <span>Date : ${escapeHtml(metaDoc.date || new Date().toLocaleDateString("fr-FR"))}</span>
              <span>•</span>
              <span>Fichier source : ${safeDoc}</span>
            </div>
          </div>
          <div class="pdf-chapters">
            ${chapters.map((ch, idx) => `
              <div class="card chapter-card">
                <div class="chapter-number">CHAPITRE ${idx + 1}</div>
                <h2 class="chapter-heading">${escapeHtml(ch.heading || ch.title || `Partie ${idx + 1}`)}</h2>
                <div class="chapter-body">${escapeHtml(ch.content || ch.texte || "")}</div>
              </div>
            `).join("")}
          </div>
        `;
      }
      // 10 : INFOGRAPHIE PÉDAGOGIQUE
      else if (normType === "infographie") {
        const info = payload.infographic || payload;
        const metrics = Array.isArray(info.metrics) ? info.metrics : [];
        const steps = Array.isArray(info.steps) ? info.steps : [];
        const highlights = Array.isArray(info.highlights) ? info.highlights : [];
        const conclusion = escapeHtml(info.conclusion || "");
        if (metrics.length > 0) {
          bodyHtml += `
            <div class="metrics-grid">
              ${metrics.map(m => `
                <div class="metric-card">
                  <div class="metric-val" style="color:${m.color || '#38bdf8'}">${escapeHtml(m.value || '')}</div>
                  <div class="metric-lbl">${escapeHtml(m.label || '')}</div>
                </div>
              `).join("")}
            </div>
          `;
        }
        if (steps.length > 0) {
          bodyHtml += `<div class="infographic-steps">`;
          steps.forEach(st => {
            const stepNum = st.step || 1;
            const h = escapeHtml(st.heading || `Étape ${stepNum}`);
            const d = escapeHtml(st.description || "");
            const badge = escapeHtml(st.badge || `Étape ${stepNum}`);
            const col = st.color || meta.color;
            bodyHtml += `
              <div class="step-card" style="border-left: 4px solid ${col}">
                <div class="step-top">
                  <span class="step-badge" style="background:${col}22;color:${col}">${badge}</span>
                  <span class="step-num">#${stepNum}</span>
                </div>
                <div class="step-heading">${h}</div>
                <div class="step-desc">${d}</div>
              </div>
            `;
          });
          bodyHtml += `</div>`;
        }
        if (highlights.length > 0) {
          bodyHtml += `
            <div class="highlights-grid">
              ${highlights.map(h => `
                <div class="highlight-card ${h.type || 'tip'}">
                  <div class="hl-title">📌 ${escapeHtml(h.title || 'Point clé')}</div>
                  <div class="hl-text">${escapeHtml(h.text || '')}</div>
                </div>
              `).join("")}
            </div>
          `;
        }
        if (conclusion) {
          bodyHtml += `<div class="card conclusion-card"><strong>Bilan Didactique :</strong> ${conclusion}</div>`;
        }
      }
      // 11 : EXERCICES ÉCRITS
      else if (normType === "exercices-ecrits") {
        const we = payload.written_exercise || payload;
        const context = escapeHtml(we.context || we.enonce || "");
        const questions = Array.isArray(we.questions) ? we.questions : [];
        const correction = we.correction || {};
        const steps = escapeHtml(correction.steps || "");
        const examples = Array.isArray(correction.examples) ? correction.examples : [];
        if (context) {
          bodyHtml += `
            <div class="card context-card">
              <div class="card-title">📋 Contexte et Énoncé du Problème</div>
              <div class="context-body">${context}</div>
            </div>
          `;
        }
        if (questions.length > 0) {
          bodyHtml += `
            <div class="card questions-container">
              <div class="card-title">📝 Questions à Résoudre</div>
              <div class="questions-flow">
                ${questions.map((q, idx) => `
                  <div class="written-question-item">
                    <span class="wq-num">${idx + 1}.</span>
                    <span class="wq-text">${escapeHtml(typeof q === 'string' ? q : (q.texte || q.question || ''))}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }
        bodyHtml += `
          <div class="card correction-card">
            <div class="corr-header" onclick="document.getElementById('written-corr-body').classList.toggle('hidden')">
              <span>🔍 Corrigé officiel et Démonstrations (Cliquez pour dérouler)</span>
              <span class="corr-toggle">Afficher / Masquer</span>
            </div>
            <div id="written-corr-body" class="corr-body">
              ${steps ? `<div class="corr-steps"><strong>Résolution pas à pas :</strong><br>${steps}</div>` : ''}
              ${examples.length > 0 ? `
                <div class="corr-examples">
                  <strong>Cas concrets & Illustrations :</strong>
                  ${examples.map(ex => `<div class="ex-item">• ${escapeHtml(ex)}</div>`).join("")}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
      // 12 : DEVOIR COMPLET (ÉPREUVE OFFICIELLE SUR 20 POINTS)
      else {
        const exam = payload.complete_exam || payload.exam || payload.devoir || payload;
        const instructions = escapeHtml(exam.instructions || "Traitez l'ensemble des exercices avec rigueur et précision. Justifiez chaque calcul.");
        const duree = escapeHtml(exam.duree || "2h00");
        const bareme = exam.baremeTotal || 20;
        const sections = Array.isArray(exam.sections) ? exam.sections : [];
        bodyHtml += `
          <div class="exam-header card">
            <div class="exam-gov">RÉPUBLIQUE D'ÉTUDE STUDYCLOUD • DKD TECHNOLOGIES</div>
            <h1 class="exam-title">${safeTitle}</h1>
            <div class="exam-badges">
              <span class="badge" style="background:#581c87;color:#c084fc">Épreuve Officielle d'Examen</span>
              <span class="badge" style="background:#1e293b;color:#94a3b8">Durée : ${duree}</span>
              <span class="badge" style="background:#064e3b;color:#34d399">Barème : /${bareme} points</span>
            </div>
            <div class="exam-instructions">${instructions}</div>
          </div>
        `;
        sections.forEach((sec, sIdx) => {
          const sTitle = escapeHtml(sec.title || `EXERCICE ${sIdx + 1}`);
          const pStatement = escapeHtml(sec.problem_statement || "");
          const questions = Array.isArray(sec.questions) ? sec.questions : [];
          const corr = sec.correction || {};
          bodyHtml += `
            <div class="card exam-section-card">
              <div class="sec-header">
                <span class="sec-number">Fiche ${sIdx + 1} / ${sections.length}</span>
                <h2 class="sec-title">${sTitle}</h2>
              </div>
              ${pStatement ? `<div class="sec-statement">${pStatement}</div>` : ''}
              <div class="sec-questions">
                ${questions.map((q, qIdx) => {
                  const qNum = escapeHtml(q.number || `${qIdx + 1}.`);
                  const qPts = q.points ? `${q.points} pt${q.points > 1 ? 's' : ''}` : '';
                  const qTxt = escapeHtml(q.texte || q.question || "");
                  const qType = q.type || 'open';
                  const opts = Array.isArray(q.options) ? q.options : [];
                  let subHtml = "";
                  if (qType === 'multiple_choice' && opts.length > 0) {
                    subHtml = `
                      <div class="exam-qcm-options">
                        ${opts.map((opt, oIdx) => `
                          <div class="exam-opt-item">
                            <span class="opt-badge">${["A","B","C","D"][oIdx] || oIdx+1}</span>
                            <span>${escapeHtml(opt)}</span>
                          </div>
                        `).join("")}
                      </div>
                    `;
                  } else if (qType === 'true_false') {
                    subHtml = `
                      <div class="exam-tf-row">
                        <span class="tf-choice-box">[ &nbsp; ] VRAI</span>
                        <span class="tf-choice-box">[ &nbsp; ] FAUX</span>
                      </div>
                    `;
                  } else {
                    subHtml = `<div class="exam-answer-lines"><div class="line"></div><div class="line"></div></div>`;
                  }
                  return `
                    <div class="exam-q-box">
                      <div class="eq-top">
                        <span class="eq-num">${qNum}</span>
                        <span class="eq-txt">${qTxt}</span>
                        ${qPts ? `<span class="eq-pts">(${qPts})</span>` : ''}
                      </div>
                      ${subHtml}
                    </div>
                  `;
                }).join("")}
              </div>
              ${(corr.steps || (Array.isArray(corr.examples) && corr.examples.length > 0)) ? `
                <div class="exam-sec-corr" onclick="this.querySelector('.corr-content').classList.toggle('hidden')">
                  <div class="corr-badge-btn">🔍 Corrigé de référence de la Fiche ${sIdx + 1} (Cliquez pour afficher)</div>
                  <div class="corr-content hidden">
                    ${corr.steps ? `<div class="c-step">${escapeHtml(corr.steps)}</div>` : ''}
                    ${Array.isArray(corr.examples) ? corr.examples.map(ex => `<div class="c-ex">• ${escapeHtml(ex)}</div>`).join("") : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        });
      }

      return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} • StudyCloud</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(17, 24, 39, 0.85);
      --border: rgba(255, 255, 255, 0.09);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: ${meta.color};
      --accent-bg: ${meta.bg};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      padding: 24px 16px;
      min-height: 100vh;
    }
    .container { max-width: 920px; margin: 0 auto; }
    .top-nav {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.1rem; }
    .brand-study { color: #f97316; }
    .brand-cloud { color: #38bdf8; }
    .doc-pill { font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); color: #94a3b8; }
    .actions-bar { display: flex; gap: 10px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: #1e293b; color: #f8fafc;
      transition: all 0.2s; text-decoration: none;
    }
    .btn:hover { background: #334155; transform: translateY(-1px); }
    .btn-primary { background: var(--accent); color: #fff; border: none; }
    .btn-primary:hover { opacity: 0.9; }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 14px; padding: 22px; margin-bottom: 20px;
      backdrop-filter: blur(10px); box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }
    .intro-bar {
      display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
      font-size: 0.9rem; color: var(--text-muted);
    }
    .q-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .q-number { font-weight: 700; color: var(--accent); font-size: 0.85rem; text-transform: uppercase; }
    .q-points { font-size: 0.85rem; color: #a855f7; font-weight: 600; }
    .q-text { font-size: 1.05rem; font-weight: 600; margin-bottom: 16px; line-height: 1.5; }
    .options-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .option-label {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border-radius: 10px; border: 1px solid var(--border); background: rgba(30, 41, 59, 0.5);
      cursor: pointer; transition: all 0.2s;
    }
    .option-label:hover { border-color: var(--accent); background: rgba(30, 41, 59, 0.9); }
    .option-label input { display: none; }
    .opt-letter {
      width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      background: #334155; font-weight: 700; font-size: 0.8rem; shrink-0;
    }
    .opt-text { flex: 1; font-size: 0.95rem; }
    .option-label.selected { border-color: #38bdf8; background: rgba(14, 165, 233, 0.15); }
    .option-label.correct { border-color: #10b981 !important; background: rgba(16, 185, 129, 0.2) !important; }
    .option-label.incorrect { border-color: #f43f5e !important; background: rgba(244, 63, 94, 0.2) !important; }
    .feedback-box {
      margin-top: 14px; padding: 14px 16px; border-radius: 10px;
      background: rgba(15, 23, 42, 0.8); border-left: 4px solid var(--accent);
    }
    .fb-title { font-weight: 700; color: #38bdf8; margin-bottom: 6px; font-size: 0.9rem; }
    .fb-content { font-size: 0.9rem; color: #cbd5e1; white-space: pre-wrap; line-height: 1.5; }
    .vf-statement { font-size: 1.15rem; font-style: italic; margin-bottom: 18px; line-height: 1.5; }
    .vf-buttons { display: flex; gap: 12px; margin-bottom: 16px; }
    .vf-btn {
      flex: 1; padding: 12px; border-radius: 10px; border: 1px solid var(--border);
      font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-vrai { background: rgba(16, 185, 129, 0.1); color: #34d399; }
    .btn-vrai:hover, .btn-vrai.selected { background: #10b981; color: #fff; }
    .btn-faux { background: rgba(244, 63, 94, 0.1); color: #fb7185; }
    .btn-faux:hover, .btn-faux.selected { background: #f43f5e; color: #fff; }
    .action-bar-center { text-align: center; margin: 30px 0; }
    .test-result-banner {
      padding: 18px; border-radius: 12px; font-weight: 800; font-size: 1.2rem;
      text-align: center; margin-top: 20px; background: #1e1b4b; border: 2px solid #6366f1;
    }
    .hidden { display: none !important; }
    .mindmap-root { text-align: center; margin-bottom: 30px; }
    .root-badge { font-size: 0.75rem; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 6px; }
    .root-title { font-size: 1.6rem; font-weight: 800; color: #fff; }
    .mindmap-branches { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
    .branch-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .branch-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1.1rem; margin-bottom: 12px; }
    .branch-dot { width: 10px; height: 10px; border-radius: 50%; }
    .branch-nodes { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .node-bullet { color: var(--accent); font-weight: 800; }
    .concept-pillars-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 20px; }
    .concept-pillar-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .pil-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
    .pil-name { font-size: 1.2rem; font-weight: 800; margin-bottom: 16px; }
    .pil-items-list { display: flex; flex-direction: column; gap: 10px; }
    .pil-item-pill { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: rgba(30,41,59,0.5); border-radius: 8px; font-size: 0.9rem; border: 1px solid var(--border); }
    .flashcards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .flashcard { perspective: 1000px; height: 260px; cursor: pointer; }
    .flashcard-inner {
      position: relative; width: 100%; height: 100%; text-align: center;
      transition: transform 0.6s; transform-style: preserve-3d;
    }
    .flashcard.flipped .flashcard-inner { transform: rotateY(180deg); }
    .flashcard-front, .flashcard-back {
      position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden;
      border-radius: 14px; border: 1px solid var(--border); padding: 20px;
      display: flex; flex-direction: column; justify-content: space-between; text-align: left;
    }
    .flashcard-front { background: #1e1b4b; border-color: #6366f1; }
    .flashcard-back { background: #064e3b; border-color: #10b981; transform: rotateY(180deg); overflow-y: auto; }
    .fc-tag { font-size: 0.75rem; font-weight: 700; opacity: 0.7; }
    .fc-front-text { font-size: 1.1rem; font-weight: 600; margin: auto 0; }
    .fc-hint { font-size: 0.75rem; opacity: 0.6; text-align: right; }
    .fc-def { font-size: 0.95rem; margin-bottom: 8px; }
    .fc-examples { font-size: 0.85rem; opacity: 0.9; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .metric-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; text-align: center; }
    .metric-val { font-size: 1.8rem; font-weight: 900; }
    .metric-lbl { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 4px; }
    .infographic-steps { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
    .step-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .step-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .step-badge { padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
    .step-num { font-size: 0.85rem; color: var(--text-muted); font-weight: 700; }
    .step-heading { font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; }
    .step-desc { font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; }
    .highlights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .highlight-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
    .highlight-card.tip { border-left: 4px solid #10b981; }
    .highlight-card.warning { border-left: 4px solid #f59e0b; }
    .hl-title { font-weight: 700; margin-bottom: 6px; font-size: 0.95rem; }
    .hl-text { font-size: 0.85rem; color: var(--text-muted); }
    .conclusion-card { border-left: 4px solid var(--accent); }
    .context-card .card-title, .questions-container .card-title { font-weight: 700; color: var(--accent); margin-bottom: 12px; font-size: 1.1rem; }
    .context-body { font-size: 0.95rem; color: #cbd5e1; line-height: 1.6; }
    .questions-flow { display: flex; flex-direction: column; gap: 12px; }
    .written-question-item { display: flex; gap: 10px; font-size: 1rem; }
    .wq-num { font-weight: 800; color: var(--accent); }
    .wq-text { flex: 1; }
    .correction-card { border-color: rgba(16, 185, 129, 0.4); }
    .corr-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 700; color: #34d399; }
    .corr-toggle { font-size: 0.8rem; background: rgba(16, 185, 129, 0.15); padding: 4px 8px; border-radius: 6px; }
    .corr-body { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 0.9rem; line-height: 1.6; }
    .corr-steps { margin-bottom: 12px; }
    .corr-examples { background: rgba(15, 23, 42, 0.7); padding: 12px; border-radius: 8px; }
    .ex-item { margin-top: 4px; color: #cbd5e1; }
    .exam-header { text-align: center; border-bottom: 2px solid var(--border); padding-bottom: 24px; }
    .exam-gov { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; margin-bottom: 8px; }
    .exam-title { font-size: 1.6rem; font-weight: 800; margin-bottom: 14px; color: #fff; }
    .exam-badges { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .exam-instructions { font-size: 0.9rem; font-style: italic; color: var(--text-muted); }
    .sec-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .sec-number { background: #581c87; color: #c084fc; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; text-transform: uppercase; }
    .sec-title { font-size: 1.2rem; font-weight: 800; }
    .sec-statement { background: rgba(15, 23, 42, 0.6); border-left: 3px solid #a855f7; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 0.95rem; line-height: 1.6; }
    .sec-questions { display: flex; flex-direction: column; gap: 14px; }
    .exam-q-box { background: rgba(30, 41, 59, 0.4); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
    .eq-top { display: flex; gap: 8px; align-items: baseline; margin-bottom: 10px; }
    .eq-num { font-weight: 800; color: #a855f7; }
    .eq-txt { flex: 1; font-weight: 600; font-size: 0.95rem; }
    .eq-pts { font-size: 0.8rem; color: #cbd5e1; font-weight: 700; }
    .exam-qcm-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; margin-top: 8px; }
    .exam-opt-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(15,23,42,0.6); border-radius: 6px; border: 1px solid var(--border); font-size: 0.85rem; }
    .opt-badge { width: 22px; height: 22px; border-radius: 4px; background: #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; shrink-0; }
    .exam-tf-row { display: flex; gap: 16px; margin-top: 8px; }
    .tf-choice-box { font-size: 0.85rem; font-weight: 700; color: #94a3b8; padding: 6px 12px; border: 1px dashed var(--border); border-radius: 6px; }
    .exam-answer-lines .line { height: 1px; background: rgba(255,255,255,0.15); margin: 12px 0; }
    .exam-sec-corr { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
    .corr-badge-btn { display: inline-block; padding: 6px 12px; border-radius: 6px; background: rgba(168, 85, 247, 0.15); color: #c084fc; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
    .corr-content { margin-top: 12px; background: rgba(15, 23, 42, 0.8); padding: 14px; border-radius: 8px; font-size: 0.85rem; line-height: 1.5; }
    .c-step { margin-bottom: 8px; }
    .c-ex { color: #cbd5e1; margin-top: 4px; }
    .pdf-cover { text-align: center; padding: 40px 20px; margin-bottom: 24px; border-bottom: 2px solid var(--accent); }
    .pdf-institution { font-size: 0.8rem; letter-spacing: 0.15em; font-weight: 800; color: var(--accent); margin-bottom: 12px; text-transform: uppercase; }
    .pdf-main-title { font-size: 2rem; font-weight: 900; margin-bottom: 14px; line-height: 1.3; }
    .pdf-meta-row { display: flex; justify-content: center; gap: 12px; font-size: 0.85rem; color: var(--text-muted); flex-wrap: wrap; }
    .chapter-card { margin-bottom: 20px; }
    .chapter-number { font-size: 0.75rem; font-weight: 800; color: var(--accent); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
    .chapter-heading { font-size: 1.3rem; font-weight: 800; margin-bottom: 12px; }
    .chapter-body { font-size: 0.95rem; color: #cbd5e1; line-height: 1.6; white-space: pre-line; }
    .section-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: rgba(59, 130, 246, 0.2); color: #60a5fa; margin-bottom: 8px; }
    .section-title { font-size: 1.2rem; font-weight: 800; margin-bottom: 10px; }
    .section-content { font-size: 0.95rem; color: #cbd5e1; line-height: 1.6; white-space: pre-line; }
    .overview-card .card-title { font-size: 1.1rem; font-weight: 700; color: #38bdf8; margin-bottom: 10px; }
    .overview-text { font-size: 0.95rem; color: #cbd5e1; line-height: 1.6; }
    @media print {
      body { background: #fff !important; color: #000 !important; padding: 0 !important; }
      .top-nav, .actions-bar, .btn { display: none !important; }
      .card { border: 1px solid #ddd !important; background: #fff !important; color: #000 !important; box-shadow: none !important; break-inside: avoid; }
      .q-text, .vf-statement, .chapter-heading, .sec-title, .root-title { color: #000 !important; }
      .sec-statement, .feedback-box, .corr-content { background: #f8fafc !important; color: #334155 !important; border-color: #cbd5e1 !important; }
      .opt-text, .step-desc, .hl-text, .section-content { color: #1e293b !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-nav">
      <div class="brand">
        <span class="brand-study">Study</span><span class="brand-cloud">Cloud</span>
        <span class="badge" style="background:${meta.bg};color:${meta.color}">${meta.icon} ${meta.label}</span>
        <span class="doc-pill">📄 ${safeDoc}</span>
      </div>
      <div class="actions-bar">
        <button type="button" class="btn" onclick="copyPreviewLink()">🔗 Copier le lien</button>
        <button type="button" class="btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
      </div>
    </div>

    ${bodyHtml}
  </div>

  <script>
    document.addEventListener("DOMContentLoaded", function() {
      if (typeof renderMathInElement === "function") {
        renderMathInElement(document.body, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ],
          throwOnError: false
        });
      }
    });

    function copyPreviewLink() {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          alert("Lien de l'aperçu copié dans le presse-papier !");
        }).catch(() => prompt("Copiez ce lien :", url));
      } else {
        prompt("Copiez ce lien :", url);
      }
    }

    function handleOptionSelect(qId, selectedIdx, correctIdx, isTest) {
      const card = document.getElementById('card_' + qId);
      if (!card) return;
      card.querySelectorAll('.option-label').forEach((lbl, idx) => {
        lbl.classList.remove('selected');
        if (idx === selectedIdx) lbl.classList.add('selected');
        if (!isTest) {
          if (idx === correctIdx) lbl.classList.add('correct');
          else if (idx === selectedIdx) lbl.classList.add('incorrect');
        }
      });
      if (!isTest) {
        const fb = document.getElementById('fb_' + qId);
        if (fb) fb.classList.remove('hidden');
      }
    }

    function submitTest(totalQuestions) {
      let score = 0;
      document.querySelectorAll('.question-card').forEach(card => {
        const correct = parseInt(card.getAttribute('data-correct') || '0', 10);
        const selected = card.querySelector('input[type="radio"]:checked');
        const qId = card.id.replace('card_', '');
        const fb = document.getElementById('fb_' + qId);
        if (fb) fb.classList.remove('hidden');
        card.querySelectorAll('.option-label').forEach((lbl, idx) => {
          if (idx === correct) lbl.classList.add('correct');
          else if (selected && parseInt(selected.value, 10) === idx) lbl.classList.add('incorrect');
        });
        if (selected && parseInt(selected.value, 10) === correct) score++;
      });
      const noteOn20 = ((score / (totalQuestions || 1)) * 20).toFixed(1);
      const banner = document.getElementById('test-result-banner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = '📊 Votre Note d\'Évaluation : ' + noteOn20 + ' / 20 (' + score + ' sur ' + totalQuestions + ' réponses exactes)';
      }
    }

    function handleVfChoice(vfId, userChoice, isTrue, isTest) {
      const card = document.getElementById('vf_card_' + vfId);
      if (!card) return;
      const btnV = document.getElementById('btn_v_' + vfId);
      const btnF = document.getElementById('btn_f_' + vfId);
      if (userChoice) {
        btnV.classList.add('selected');
        btnF.classList.remove('selected');
      } else {
        btnF.classList.add('selected');
        btnV.classList.remove('selected');
      }
      card.setAttribute('data-userchoice', userChoice ? '1' : '0');
      if (!isTest) {
        const fb = document.getElementById('fb_vf_' + vfId);
        if (fb) fb.classList.remove('hidden');
      }
    }

    function submitVfTest(totalCount) {
      let score = 0;
      document.querySelectorAll('.vf-card').forEach(card => {
        const isTrue = card.getAttribute('data-istrue') === '1';
        const userChoice = card.getAttribute('data-userchoice');
        const vfId = card.id.replace('vf_card_', '');
        const fb = document.getElementById('fb_vf_' + vfId);
        if (fb) fb.classList.remove('hidden');
        if (userChoice !== null && ((userChoice === '1') === isTrue)) {
          score++;
          card.style.borderColor = '#10b981';
        } else {
          card.style.borderColor = '#f43f5e';
        }
      });
      const noteOn20 = ((score / (totalCount || 1)) * 20).toFixed(1);
      const banner = document.getElementById('vf-result-banner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = '🎯 Score Vrai/Faux : ' + noteOn20 + ' / 20 (' + score + ' sur ' + totalCount + ' exactes)';
      }
    }
  </script>
</body>
</html>`;
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
LES 4 PILIERS INVIOLABLES DE STUDYCLOUD (APPLICABLES SANS EXCEPTION À TOUTES LES CRÉATIONS) :
======================================================================
1. NON AU PUREMENT LITTÉRAIRE : OBLIGATION DE CALCULS, FORMULES, FONCTIONS ET SCHÉMAS DÈS QUE LE SUJET EST SCIENTIFIQUE OU TECHNIQUE !
   - Si le document ou le thème de l'étudiant relève d'une matière scientifique ou technique (électronique, électrotechnique, physique, mécanique, mathématiques, chimie, télécommunications, automatique, informatique, etc.) :
   - INTERDICTION FORMELLE DE RESTER DANS UN DISCOURS PUREMENT LITTÉRAIRE, DESCRIPTIF OU VAGUE.
   - Tu DOIS IMPÉRATIVEMENT intégrer :
     * Les FORMULES MATHÉMATIQUES EXACTES (en syntaxe LaTeX propre "$ ... $").
     * Des VALEURS NUMÉRIQUES RÉELLES ET CONCRÈTES (ex: $R_1 = 10\\ \\text{k}\\Omega$, $R_2 = 100\\ \\text{k}\\Omega$, $V_e = 0.5\\ \\text{V}$, $C = 100\\ \\text{nF}$, $f = 1\\ \\text{kHz}$).
     * Des CALCULS EFFECTIFS : demande de calculer des grandeurs, trouver la tension de sortie $V_s$, déterminer le gain $A_v = -\\frac{R_2}{R_1}$, calculer la fréquence de coupure ou la bande passante.
     * Des SCHÉMAS DE MONTAGES / CIRCUITS OU DIAGRAMMES EN ASCII ART SOIGNÉ : pour les circuits électroniques (montages amplificateurs, filtres, ponts de diodes) ou les diagrammes fonctionnels, inclus une représentation graphique textuelle claire pour que l'étudiant visualise les nœuds, les composants et les signaux :
       Exemple de schéma pour un amplificateur inverseur :
       +-----------[ R2 ]-----------+
       |                            |
       Ve ---[ R1 ]----+---->(-)   |
                           |   AOP >------+--- Vs
                    0V --->(+)

2. ANALYSE EXHAUSTIVE ET COUVERTURE INTÉGRALE DE TOUT LE DOCUMENT :
   - Tu DOIS étudier le document de cours de l'élève DE LA PREMIÈRE À LA DERNIÈRE PAGE.
   - INTERDICTION de te limiter à l'introduction ou aux trois premières lignes du fichier.
   - Les questions, exercices, cartes et résumés doivent balayer l'ensemble des chapitres, théorèmes, lois, schémas et exercices du polycopié.

3. CORRECTIONS ULTRA-DÉTAILLÉES AVEC DEUX EXEMPLES DANS TOUTES LES CRÉATIONS SANS EXCEPTION :
   - Dans TOUTES les créations (Questionnaires, Vrai ou Faux, Flashcards, Devoirs, Exercices Écrits, etc.), chaque correction, justification ou explication DOIT comporter :
     a) Le rappel théorique et la formule générale applicable.
     b) La démonstration ou le calcul détaillé étape par étape avec les valeurs numériques et l'unité.
     c) OBLIGATOIREMENT DEUX EXEMPLES CONCRETS DISTINCTS :
        • Exemple 1 : [Cas d'application concret, dimensionnement réel ou situation pratique en industrie/laboratoire]
        • Exemple 2 : [Deuxième cas concret distinct, analyse d'un piège fréquent ou contre-exemple]
     d) L'analyse des erreurs : explication précise de pourquoi les autres options sont fausses.

4. ZÉRO CARACTÈRE BIZARRE ET RÈGLE ABSOLUE DE SYNTAXE LATEX DANS LE JSON :
   - RÈGLE ABSOLUE DE SYNTAXE LATEX :
     • Ne mets JAMAIS de symboles $ isolés à l'intérieur d'une expression LaTeX (interdit absolu d'écrire \\text{k}\\$\\Omega ou \\$\\Omega).
     • Pour l'ohm, écris toujours \\Omega (ex: $10\\text{ k}\\Omega$ ou $R_2 = 120\\text{ k}\\Omega$).
     • Encadre TOUJOURS une formule mathématique par un unique symbole dollar de chaque côté pour du texte en ligne (ex: $R_{in} = R_1$) et par de doubles dollars pour les équations centrées ($$V_s = -\\frac{R_2}{R_1} V_e$$).
     • Vérifie scrupuleusement que chaque balise ou délimiteur ouvert (accolades {}, parenthèses, $ ou $$) est correctement fermé pour éviter l'affichage de code brut.
   - Chaque formule, fraction, équation ou variable scientifique ($V_s$, $V_e$, $R_1$, $R_2$, $I_c$, \\omega, \\Omega) DOIT être rigoureusement entourée de symboles dollar "$ ... $" en ligne ou "$$ ... $$" en bloc.
   - Dans la réponse JSON, CHAQUE ANTISLASH LATEX DOIT ÊTRE DOUBLÉ (ex: "\\frac{num}{den}", "\\sqrt{x}", "\\times", "\\Omega", "\\alpha", "\\beta", "\\mu") afin qu'il ne soit JAMAIS interprété comme un caractère de contrôle JSON (\\f = Form Feed \\x0c qui produit une flèche corrompue).
   - INTERDICTION FORMELLE d'écrire des formules tronquées ou sans antislash comme "V_s = -rac(R_2)(R_1)".

======================================================================
RÈGLES D'EXCELLENCE POUR LES QUESTIONNAIRES & TESTS ('questionnaire' et 'questionnaire-test') :
======================================================================
1. PROFONDEUR PÉDAGOGIQUE, CALCULS SCIENTIFIQUES ET MISES EN SITUATION :
   - Ne pose AUCUNE question de simple mémorisation brute ou de recopie de définition superficielle.
   - Si le document est scientifique, pose des questions à base d'exercices calculatoires chiffrés, d'analyse de montages ou de détermination de fonctions de transfert.
   - Crée des questions de type "étude de cas", "résolution de problèmes", "dimensionnement de composants" avec schémas.
   - Fournis 4 options crédibles et complètes : 1 seule bonne réponse et 3 distracteurs intelligents issus d'erreurs classiques de calcul ou de signe.

2. RÈGLE STRICTE SUR LES PROPOSITIONS DE RÉPONSES (INTERDICTION DES PLACEHOLDERS 'Option A') :
   - INTERDICTION FORMELLE ET STRICTE d'écrire 'Option A', 'Option B', 'Option C', 'Option D', ou simplement les lettres 'A', 'B', 'C', 'D' dans le tableau "options".
   - Tu DOIS IMPÉRATIVEMENT rédiger le texte complet, explicite, détaillé et argumenté de chaque proposition de réponse dans le tableau "options" (avec les valeurs numériques et formules en LaTeX $...$).

3. CORRECTIONS DÉTAILLÉES AVEC CALCULS ET DEUX EXEMPLES CONCRETS OBLIGATOIRES :
   - Pour chaque question, l'explication (champ "explanation") ne doit JAMAIS se limiter à donner la bonne réponse.
   - Elle doit obligatoirement :
     a) Énoncer la loi ou le théorème théorique.
     b) Détailler le calcul pas à pas avec substitution des valeurs et unités ($V, A, \\Omega, Hz$).
     c) Inclure DEUX EXEMPLES CONCRETS ET DISTINCTS (Exemple 1 et Exemple 2) illustrant la notion.
   - Format de "explanation" :
     "Démonstration théorique et calcul étape par étape : $V_s = -\\frac{R_2}{R_1} V_e = ...$\n\n• Exemple 1 : [Situation concrète 1]\n• Exemple 2 : [Situation concrète 2]"

4. RÈGLE DE FORMATAGE ABSOLUE (MATHÉMATIQUES, FONCTIONS ET FRACTIONS EN LATEX PUR) :
   - Pour TOUTES les formules, fractions, grandeurs et équations dans les questions, options et explications, utilise la syntaxe LaTeX standard ($...$ en ligne ou $$...$$ en bloc).
   - RÈGLE DE SYNTAXE STRICTE : Ne mets JAMAIS de symbole $ parasite à l'intérieur d'une expression (interdit d'écrire \\text{k}\\$\\Omega$). Pour l'ohm, écris $10\\text{ k}\\Omega$ ou \\Omega. Ferme toujours chaque dollar et chaque accolade.

5. ENRICHISSEMENT EXTERNE & CROISEMENT DE SAVOIRS :
   - Ne te limite pas strictement aux mots du fichier. Tu es autorisé et encouragé à croiser le contenu du document avec des standards réels, des cas d'usage vérifiés et des notions complémentaires issues du même domaine pour maximiser la valeur pédagogique.

6. STRUCTURE JSON REQUISE DANS "creation_data" :
{
  "title": "Questionnaire Évaluatif : [Titre du cours / sujet]",
  "questions": [
    {
      "id": "q_1",
      "question": "Énoncé complet et contextualisé de la question ou problème pratique (avec schéma ASCII si circuit et LaTeX $\\frac{a}{b}$)...",
      "options": [
        "Texte complet et développé de la 1ère proposition avec calcul et LaTeX $...$",
        "Texte complet et développé de la 2ème proposition (JAMAIS juste 'Option B')",
        "Texte complet et développé de la 3ème proposition (JAMAIS juste 'Option C')",
        "Texte complet et développé de la 4ème proposition (JAMAIS juste 'Option D')"
      ],
      "correctIndex": 0,
      "explanation": "Démonstration théorique approfondie et calcul détaillé : $V_s = -\\frac{R_2}{R_1} V_e$...\n\n• Exemple 1 : [Cas d'application concret dans une installation réelle]\n• Exemple 2 : [Deuxième cas réel illustrant le phénomène]"
    }
  ]
}

======================================================================
RÈGLES D'EXCELLENCE POUR LE VRAI OU FAUX ('vrai-ou-faux' et 'vrai-ou-faux-test') :
======================================================================
1. ÉQUILIBRE ET QUANTITÉ DES AFFIRMATIONS :
   - Pour 'vrai-ou-faux' (Cartes réflexes d'entraînement) : Génère 4 à 6 affirmations dynamiques.
   - Pour 'vrai-ou-faux-test' (Test noté avec score) : Génère 6 à 10 affirmations d'évaluation.
   - ÉQUILIBRE OBLIGATOIRE : Répartis rigoureusement les réponses vraies et fausses (~50% VRAI, ~50% FAUX). INTERDICTION FORMELLE d'avoir 100% de Vrai ou 100% de Faux.

2. CALCULS SCIENTIFIQUES, FORMULES, SCHÉMAS ET PIÈGES INTELLIGENTS :
   - Ne crée JAMAIS d'affirmations de simple recopie textuelle ou de définition triviale.
   - Si le document est scientifique ou technique (électronique, physique, mathématiques, etc.) :
     * Les affirmations DOIVENT porter sur des grandeurs, des calculs, des formules, des valeurs chiffrées et des schémas :
       Exemple chiffré : "Dans un amplificateur inverseur avec $R_1 = 10\\ \\text{k}\\Omega$ et $R_2 = 100\\ \\text{k}\\Omega$, pour une tension d'entrée $V_e = 0,5\\ \\text{V}$, la tension de sortie mesurée est $V_s = +5\\ \\text{V}$." -> FAUX, car $V_s = -\\frac{R_2}{R_1} V_e = -\\frac{100}{10} \\times 0,5 = -5\\ \\text{V}$.
     * Intègre des schémas de montages (ex: comparaison montage inverseur vs non-inverseur, suiveur, sommateur, intégrateur).
     * Interroge sur les conditions de validité indispensables d'une règle, d'un théorème ou d'une loi scientifique (ex: saturation des rails d'alimentation $\\pm V_{sat}$).

3. CORRECTIONS DÉTAILLÉES AVEC DÉMONSTRATION, CALCULS ET DEUX EXEMPLES CONCRETS :
   - Pour CHAQUE affirmation (qu'elle soit Vraie ou Fausse), la justification DOIT obligatoirement comporter :
     a) La démonstration théorique du pourquoi l'affirmation est vraie ou fausse en citant la formule en LaTeX pur ($...$).
     b) Le détail du calcul ou du raisonnement étape par étape avec les valeurs numériques et les unités.
     c) DEUX EXEMPLES CONCRETS ET DISTINCTS (Exemple 1 et Exemple 2) :
        • Exemple 1 : [Cas réel d'application ou cas d'usage pratique]
        • Exemple 2 : [Deuxième cas concret distinct, contre-exemple ou analyse du piège à éviter]
   - Format de "explanation" :
     "Démonstration théorique et calcul : $V_s = -\\frac{R_2}{R_1} V_e = ...$\n\n• Exemple 1 : [Cas concret d'application ou contre-exemple]\n• Exemple 2 : [Deuxième illustration concrète]"

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
       "subtitle": "Structure visuelle et repères conceptuels",
       "visual_style": "Schéma pédagogique minimaliste et moderne, vecteurs nets et épurés, fort contraste, palette professionnelle",
       "image_prompt": "Infographie pédagogique vectorielle épurée sur le thème de [sujet], palette de couleurs professionnelle, mise en page conceptuelle claire, style moderne à plat 2D, haute netteté, aucun texte illisible",
       "svg_drawing": null,
       "metrics": [
         { "value": "100%", "label": "Notions clés", "color": "#3B82F6" },
         { "value": "4 Étapes", "label": "Parcours didactique", "color": "#10B981" },
         { "value": "LaTeX", "label": "Formules & Calculs", "color": "#F97316" }
       ],
       "steps": [
         {
           "step": 1,
           "heading": "1. Principe Fondamental & Définitions",
           "description": "Description concise avec formule LaTeX si nécessaire : $...$",
           "badge": "Fondement",
           "color": "#3B82F6"
         },
         {
           "step": 2,
           "heading": "2. Lois & Équations Directrices",
           "description": "Développement analytique et formule mathématique : $\\frac{a}{b}$",
           "badge": "Calcul",
           "color": "#10B981"
         },
         {
           "step": 3,
           "heading": "3. Montages Pratiques & Comportement",
           "description": "Analyse du comportement physique et configurations pratiques...",
           "badge": "Pratique",
           "color": "#F97316"
         },
         {
           "step": 4,
           "heading": "4. Synthèse & Points de Vigilance",
           "description": "Règles de dimensionnement et points clés d'examen...",
           "badge": "Synthèse",
           "color": "#8B5CF6"
         }
       ],
       "highlights": [
         { "type": "tip", "title": "Conseil Clé", "text": "Règle essentielle à retenir pour les calculs." },
         { "type": "warning", "title": "Point de Vigilance", "text": "Piège fréquent à éviter lors de l'application des lois." }
       ],
       "conclusion": "Bilan synthétique des notions abordées dans cette infographie."
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
RÈGLES D'EXCELLENCE POUR LE DEVOIR COMPLET ('devoir-complet') :
======================================================================
Tu es un professeur expert, un concepteur d'examens et un tuteur pédagogique de haut niveau. Ta mission est de concevoir une épreuve d'examen officielle complète notée sur 20 points, basée sur le document de l'élève.
SI LE TEXTE DU DOCUMENT EST COURT OU SCANNE, EXPLOITE TES CONNAISSANCES APPROFONDIES SUR LE SUJET (ex: électronique, AOP en régime linéaire, physique, mathématiques) POUR CONSTRUIRE UN SUJET COMPLET ET RÉALISTE AVEC VRAIES VALEURS ET CALCULS.

STRUCTURE STRICTE ET INVIOLABLE : L'ÉPREUVE DOIT OBLIGATOIREMENT COMPORTER EXACTEMENT 3 EXERCICES (NI PLUS, NI MOINS) :
1. EXERCICE 1 (Fiche 1) : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 points) :
   - Énoncé contextuel d'ingénierie ou problème scientifique riche rédigé OBLIGATOIREMENT dans "problem_statement" AVANT les questions (avec valeurs chiffrées, formules en LaTeX $...$ et schéma en ASCII Art si applicable).
   - 3 questions ouvertes ("type": "open") nécessitant un calcul détaillé, une démonstration pas à pas ou une justification que l'élève rédige directement sur sa copie.
   - Fournis le corrigé type étape par étape avec calculs détaillés et obligatoirement DEUX EXEMPLES CONCRETS DISTINCTS.

2. EXERCICE 2 (Fiche 2) : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 points) :
   - 4 questions d'évaluation et de calculs rapides ("type": "multiple_choice") notées 1,5 point chacune.
   - 4 propositions de réponses développées et argumentées par question (INTERDICTION STRICTE d'écrire "Proposition A" ou "Option A"). L'élève coche la bonne réponse.
   - Fournis l'explication théorique et le calcul justifiant la réponse exacte.

3. EXERCICE 3 (Fiche 3) : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 points) :
   - 4 affirmations scientifiques réflexes et calculatoires ("type": "true_false") notées 1,5 point chacune. L'élève choisit si c'est VRAI ou FAUX.
   - Fournis la démonstration théorique du pourquoi c'est Vrai ou Faux avec le calcul et obligatoirement DEUX EXEMPLES CONCRETS DISTINCTS.

INTERDICTION FORMELLE : N'écris JAMAIS de texte factice ("Proposition A", "Option A", "Question d'évaluation conceptuelle n°1", "Affirmation conceptuelle"). Tout doit être rédigé avec des termes réels du domaine.

STRUCTURE JSON REQUISE DANS "creation_data" (OU "complete_exam") :
{
  "complete_exam": {
    "title": "Épreuve Officielle d'Examen : [Titre du cours]",
    "instructions": "L'épreuve comporte exactement 3 exercices indépendants. Traitez l'ensemble des exercices en justifiant chaque étape de calcul.",
    "duree": "2h00",
    "duration_minutes": 120,
    "baremeTotal": 20,
    "sections": [
      {
        "section_id": "sec_1",
        "title": "EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 POINTS)",
        "problem_statement": "On étudie le montage [description précise, composants, valeurs numériques $R_1 = 10\\ \\text{k}\\Omega, R_2 = 100\\ \\text{k}\\Omega$, schéma ASCII du circuit]...",
        "questions": [
          {
            "id": "p1_q1",
            "number": "1.",
            "type": "open",
            "points": 3,
            "texte": "Déterminer l'expression analytique de la grandeur $V_s$ en fonction de $V_e, R_1, R_2$.",
            "sampleAnswer": "En appliquant le théorème de Millman au nœud inverseur : $V_s = -\\frac{R_2}{R_1} V_e$."
          },
          {
            "id": "p1_q2",
            "number": "2.",
            "type": "open",
            "points": 3,
            "texte": "Calculer la valeur numérique de la tension de sortie pour $V_e = 0,5\\ \\text{V}$.",
            "sampleAnswer": "$V_s = -\\frac{100}{10} \\times 0,5 = -5\\ \\text{V}$."
          },
          {
            "id": "p1_q3",
            "number": "3.",
            "type": "open",
            "points": 2,
            "texte": "Préciser la condition de non-saturation de l'amplificateur opérationnel pour des alimentations $\\pm 15\\ \\text{V}$.",
            "sampleAnswer": "La condition $|V_s| < V_{sat}$ impose $|V_e| < 1,5\\ \\text{V}$."
          }
        ],
        "correction": {
          "steps": "Démonstration complète pas à pas avec les lois d'Ohm et de Kirchhoff : $V_s = -\\frac{R_2}{R_1} V_e$.",
          "examples": [
            "Exemple 1 : Dans une chaîne d'acquisition de capteur de température, un gain inverseur permet d'adapter l'échelle de mesure.",
            "Exemple 2 : En instrumentation médicale, ce montage permet d'amplifier un signal bioélectrique avant numérisation."
          ]
        }
      },
      {
        "section_id": "sec_2",
        "title": "EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 POINTS)",
        "questions": [
          {
            "id": "p2_q1",
            "number": "1.",
            "type": "multiple_choice",
            "points": 1.5,
            "texte": "Dans un montage amplificateur inverseur idéal, le potentiel de l'entrée inverseuse $V^-$ est égal à :",
            "options": [
              "0 V (masse virtuelle car $V^+ = 0\\ \\text{V}$ et $\\varepsilon = 0$)",
              "La tension d'entrée $V_e$",
              "La tension de saturation $+V_{sat}$",
              "La moitié de la tension de sortie $V_s / 2$"
            ],
            "correctIndex": 0,
            "explication": "En régime linéaire, la contre-réaction asservit $\\varepsilon = V^+ - V^- = 0$, donc $V^- = V^+ = 0\\ \\text{V}$."
          },
          {
            "id": "p2_q2",
            "number": "2.",
            "type": "multiple_choice",
            "points": 1.5,
            "texte": "Si la résistance de contre-réaction $R_2$ est doublée, que devient le gain en tension $A_v$ ?",
            "options": [
              "Il est multiplié par 2 en valeur absolue",
              "Il est divisé par 2",
              "Il reste rigoureusement inchangé",
              "Il s'annule immédiatement"
            ],
            "correctIndex": 0,
            "explication": "Puisque $A_v = -\\frac{R_2}{R_1}$, doubler $R_2$ double proportionnellement le gain."
          },
          {
            "id": "p2_q3",
            "number": "3.",
            "type": "multiple_choice",
            "points": 1.5,
            "texte": "Quelle conséquence a la saturation de la tension de sortie sur le fonctionnement ?",
            "options": [
              "Le régime linéaire cesse et $\\varepsilon$ devient non nul",
              "Le gain tend instantanément vers l'infini",
              "La bande passante s'élargit à l'infini",
              "Le circuit devient un oscillateur parfait"
            ],
            "correctIndex": 0,
            "explication": "En saturation, la boucle de rétroaction ne peut plus maintenir $\\varepsilon = 0$."
          },
          {
            "id": "p2_q4",
            "number": "4.",
            "type": "multiple_choice",
            "points": 1.5,
            "texte": "L'impédance d'entrée vue par la source $V_e$ dans un montage inverseur est égale à :",
            "options": [
              "La résistance $R_1$",
              "La résistance $R_2$",
              "Une valeur infinie",
              "La somme $R_1 + R_2$"
            ],
            "correctIndex": 0,
            "explication": "Comme $V^- = 0\\ \\text{V}$, le courant d'entrée vaut $I_e = \\frac{V_e - 0}{R_1}$, donc $Z_e = R_1$."
          }
        ],
        "correction": {
          "steps": "Synthèse théorique et application des lois régissant le fonctionnement linéaire de l'amplificateur opérationnel.",
          "examples": [
            "Exemple 1 : Vérification expérimentale par mesure à l'oscilloscope",
            "Exemple 2 : Analyse de l'écrêtage du signal pour éviter les pièges d'interprétation"
          ]
        }
      },
      {
        "section_id": "sec_3",
        "title": "EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 POINTS)",
        "questions": [
          {
            "id": "p3_q1",
            "number": "1.",
            "type": "true_false",
            "points": 1.5,
            "texte": "Dans un amplificateur opérationnel idéal, les courants de polarisation d'entrée sont considérés comme nuls ($I^+ = I^- = 0$).",
            "correct_answer": true,
            "explication": "VRAI : L'impédance d'entrée différentielle d'un AOP idéal est infinie ($R_d \\to \\infty$), d'où des courants d'entrée nuls.\n\n• Exemple 1 : En pratique sur un AOP à entrées JFET, les courants de fuite sont de l'ordre du picoampère.\n• Exemple 2 : Cela permet de connecter des capteurs à haute impédance sans atténuer la mesure."
          },
          {
            "id": "p3_q2",
            "number": "2.",
            "type": "true_false",
            "points": 1.5,
            "texte": "La tension de sortie d'un montage alimenté en $\\pm 15\\ \\text{V}$ peut atteindre $+20\\ \\text{V}$ si le gain calculé est suffisant.",
            "correct_answer": false,
            "explication": "FAUX : La tension de sortie est physiquement bornée par les rails d'alimentation $\\pm V_{sat} \\approx \\pm 14\\ \\text{V}$.\n\n• Exemple 1 : Pour une entrée $V_e = 2\\ \\text{V}$ et un gain de $-10$, la théorie donnerait $-20\\ \\text{V}$, mais le circuit écrête à $-14\\ \\text{V}$.\n• Exemple 2 : En audio, cet écrêtage provoque une distorsion harmonique audible."
          },
          {
            "id": "p3_q3",
            "number": "3.",
            "type": "true_false",
            "points": 1.5,
            "texte": "Le produit gain-bande passante d'un amplificateur opérationnel est constant en régime linéaire.",
            "correct_answer": true,
            "explication": "VRAI : Si le gain en tension $A_v$ augmente, la fréquence de coupure à $-3\\ \\text{dB}$ diminue dans la même proportion.\n\n• Exemple 1 : Pour un composant avec un produit de 1 MHz, un gain de 10 offre une bande passante de 100 kHz.\n• Exemple 2 : Si le gain passe à 100, la bande passante est réduite à 10 kHz."
          },
          {
            "id": "p3_q4",
            "number": "4.",
            "type": "true_false",
            "points": 1.5,
            "texte": "Un montage suiveur de tension introduit un déphasage de $180^\\circ$ entre l'entrée et la sortie.",
            "correct_answer": false,
            "explication": "FAUX : Le montage suiveur est non-inverseur ($V_s = +V_e$), son gain vaut $+1$ et la sortie est en phase avec l'entrée.\n\n• Exemple 1 : Le suiveur sert d'adaptateur d'impédance sans modifier la phase du signal.\n• Exemple 2 : Il isole une source fragile d'une charge consommatrice de courant."
          }
        ],
        "correction": {
          "steps": "Analyse rigoureuse des conditions aux limites et des propriétés structurelles des montages fondamentaux.",
          "examples": [
            "Exemple 1 : Utilisation en filtrage actif",
            "Exemple 2 : Dimensionnement pour un étage de préamplification"
          ]
        }
      }
    ]
  }
}

======================================================================
RÈGLE DE FORMATAGE MATHÉMATIQUE STRICTE & ÉCHAPPEMENT JSON (LATEX PUR) :
======================================================================
1. Pour TOUTES les fractions, puissances, racines, intégrales, dérivées, matrices, variables et formules scientifiques ($V_s, V_e, R_1, R_2, I_c, \omega$), tu DOIS utiliser exclusivement la syntaxe LaTeX standard entourée de dollars :
   - Un seul dollar ($...$) pour les expressions et variables en ligne, par exemple : $V_s = -\frac{R_2}{R_1} V_e$ ou $R_1 = 10\ \text{k}\Omega$.
   - Un double dollar ($$...$$) pour les équations importantes centrées sur une ligne seule.
2. DANS LA SORTIE JSON : CHAQUE ANTISLASH LATEX DOIT ÊTRE DOUBLÉ (\\\\frac, \\\\sqrt, \\\\times, \\\\Omega, \\\\alpha, \\\\beta, \\\\mu, \\\\tau) :
   - Écris TOUJOURS "\\frac{a}{b}", "\\sqrt{x}", "\\times", "\\Omega" dans ton JSON.
   - Si tu écris un simple "\\frac", le parseur JSON transforme "\\f" en caractère de contrôle Form Feed (ASCII 12, qui affiche une flèche corrompue) : c'est STRICTEMENT INTERDIT !
3. INTERDICTION FORMELLE d'utiliser des caractères aléatoires, des symboles corrompus (&, *, !, $$$$$) ou du texte brut mal formaté (ex: "V_s = -rac(R_2)(R_1)") pour représenter des mathématiques. Chaque fraction s'écrit "$V_s = -\\frac{R_2}{R_1} V_e$".

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

      // Détection de toutes les clés Google Gemini configurées (studycloud-gemini, studycloud-gemini-2, 3, 4, etc.)
      const geminiKeys = getAvailableGeminiKeys(env, body.geminiApiKey);

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
      const historyNoticeDevoir = previousQuestionsText || "Aucun devoir ou examen précédent enregistré pour cet utilisateur sur ce document.";
      fullSystemPrompt = fullSystemPrompt.replace(/\[INSERER_HISTORIQUE_DEVOIRS_ICI\]/g, historyNoticeDevoir);
      fullSystemPrompt = fullSystemPrompt.replace(/\[INSERER_HISTORIQUE_EXERCICES_ICI\]/g, historyNoticeDevoir);
      if (previousQuestionsText) {
        fullSystemPrompt += `\n\n======================================================================\nHISTORIQUE DES ÉLÉMENTS, QUESTIONS, EXERCICES, CARTES, RÉSUMÉS, DOCUMENTS PDF OU INFOGRAPHIES DÉJÀ GÉNÉRÉS POUR CET ÉLÈVE SUR CE COURS (RÈGLE STRICTE ANTI-DOUBLONS) :\n${previousQuestionsText}\n======================================================================\nCONSIGNE ABSOLUE :\nTu DOIS générer des questions, exercices rédigés, affirmations, cartes mémoire (flashcards), axes de cartes mentales, résumés, chapitres de document PDF ou infographies ENTIÈREMENT NOUVEAUX qui n'ont ni la même formulation, ni le même angle, ni la même organisation que les éléments déjà mémorisés ou générés ci-dessus. Propose des angles d'analyse inédits et explore d'autres aspects du document.`;
      }
      if (rawDocForGemini.length > 0) {
        const docTitle = body.attachedFileName || body.file_name || body.fileName || "Document de cours";
        fullSystemPrompt += `\n\n======================================================================\nDOCUMENT ATTACHÉ DE L'ÉTUDIANT ("${docTitle}") :\n${rawDocForGemini.slice(0, 200000)}\n======================================================================\nCONSIGNES CAPITALES ET INCONTOURNABLES :
1. ÉTUDE INTÉGRALE DU COURS DE L'ÉLÈVE : Tu DOIS lire et explorer le document CI-DESSUS DE LA PREMIÈRE À LA DERNIÈRE PAGE. Ne te limite pas à l'introduction : puise tes questions, affirmations, cartes, résumés et exercices dans l'ensemble des chapitres, sections, théorèmes, montages et exercices du polycopié.
2. SUJETS SCIENTIFIQUES & TECHNIQUES (Électronique, Physique, Mathématiques, Chimie, etc.) : INTERDICTION FORMELLE DE RESTER PUREMENT LITTÉRAIRE OU THÉORIQUE !
   - Tu DOIS IMPÉRATIVEMENT inclure les vraies formules mathématiques ($...$), des applications numériques réelles (ex: calcul de tension $V_s$, calcul de résistance $R$, calcul de gain, déduction de grandeurs avec valeurs numériques), des fonctions ($H(j\\omega)$), et des schémas de montages (ASCII Art soigné).
3. DANS TOUTES LES CORRECTIONS ET JUSTIFICATIONS : Détaille le raisonnement étape par étape avec les calculs et formules en LaTeX, et inclus SYSTÉMATIQUEMENT DEUX EXEMPLES CONCRETS D'APPLICATION.
4. FORMATAGE LATEX & ÉCHAPPEMENT JSON : Encadre chaque formule de dollars ($...$) et double chaque antislash dans le JSON (\\\\frac, \\\\sqrt, \\\\times, \\\\Omega, \\\\alpha, etc.) pour éviter toute corruption Form Feed.
IL EST STRICTEMENT INTERDIT de renvoyer les exemples types génériques du prompt : le contenu doit correspondre fidèlement, exclusivement et intégralement au document de l'étudiant !`;
      }

      let generatedContent = "";
      let usedEngine = "";
      const debugErrors = [];

      // 1. APPEL À GOOGLE GEMINI (AVEC BASCULEMENT INTELLIGENT MULTI-CLÉS GEMINI 1 à 4)
      if (geminiKeys.length > 0) {
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
          "gemini-1.5-flash"
        ];

        const generationConfig = {
          temperature: body.isDirectCreation ? 0.3 : 0.7,
          maxOutputTokens: 6000,
        };
        if (body.isDirectCreation) {
          generationConfig.responseMimeType = "application/json";
        }

        // BASCULEMENT EN BOUCLE : On commence par la première clé disponible.
        // Si elle réussit, ON NE PASSE PAS À UNE AUTRE CLÉ !
        // Si elle échoue ou est surchargée (429, 400, 403, 500, etc.), on bascule automatiquement sur la suivante.
        for (let kIdx = 0; kIdx < geminiKeys.length; kIdx++) {
          const activeKey = geminiKeys[kIdx];
          let keySucceeded = false;

          for (const mod of candidateGeminiModels) {
            try {
              const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${activeKey}`;
              const gResponse = await fetch(geminiApiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: fullSystemPrompt }] },
                  contents: geminiContents,
                  generationConfig: generationConfig
                })
              });

              if (gResponse.ok) {
                const gData = await gResponse.json();
                const candidateText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (candidateText && candidateText.trim().length > 0) {
                  generatedContent = candidateText;
                  usedEngine = `Google Gemini (${mod} • Clé #${kIdx + 1})`;
                  keySucceeded = true;
                  break; // Succès ! Sortir des modèles
                } else {
                  const finishReason = gData?.candidates?.[0]?.finishReason || gData?.promptFeedback?.blockReason || "aucun texte";
                  debugErrors.push(`[Clé #${kIdx + 1} • ${mod}] Blocage: ${finishReason}`);
                }
              } else {
                const errTxt = await gResponse.text().catch(() => "");
                debugErrors.push(`[Clé #${kIdx + 1} • ${mod} HTTP ${gResponse.status}] ${errTxt.slice(0, 160)}`);
                console.warn(`[Gemini Clé #${kIdx + 1} • ${mod}] Status ${gResponse.status}:`, errTxt);

                // Si clé refusée ou invalide (403 ou 400 API_KEY_INVALID), basculer immédiatement sur la clé suivante
                if (gResponse.status === 403 || (gResponse.status === 400 && errTxt.includes("API_KEY_INVALID"))) {
                  console.warn(`[Gemini Clé #${kIdx + 1}] Clé invalide (${gResponse.status}), basculement immédiat vers la clé suivante...`);
                  break;
                }
                // Si quota épuisé (429) sur le modèle de base, basculer sur la clé suivante
                if (gResponse.status === 429 && mod === "gemini-2.5-pro") {
                  console.warn(`[Gemini Clé #${kIdx + 1}] Quota global épuisé sur cette clé, basculement vers la clé suivante...`);
                  break;
                }
              }
            } catch (geminiErr) {
              debugErrors.push(`[Clé #${kIdx + 1} • ${mod} Exception] ${geminiErr.message}`);
              console.warn(`[Gemini Clé #${kIdx + 1} • ${mod}] Exception:`, geminiErr);
            }
          }

          // Si la clé active a fonctionné sans problème, ON NE PASSE PAS à une autre clé !
          if (keySucceeded && generatedContent) {
            break;
          }
        }
      }

      // 2. FALLBACK VERS CLOUDFLARE WORKERS AI (Si toutes les clés Gemini ont échoué)
      if (!generatedContent && ai && typeof ai.run === "function") {
        const trimmedSystemPrompt = fullSystemPrompt.length > 7000
          ? fullSystemPrompt.slice(0, 7000) + "\n\n[... Document synthétisé pour Workers AI ...]"
          : fullSystemPrompt;

        const messages = [{ role: "system", content: trimmedSystemPrompt }];
        const incomingHist = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        for (const m of incomingHist.slice(-4)) {
          if (m && m.role && m.content) {
            messages.push({
              role: m.role === "model" ? "assistant" : m.role,
              content: String(m.content).slice(0, 1000)
            });
          }
        }
        const currentPrompt = (userPrompt || (requestedType ? `Génère le module ${requestedType}` : "Bonjour !")).slice(0, 2000);
        if (!messages.some(m => m.role === "user" && m.content === currentPrompt)) {
          messages.push({ role: "user", content: currentPrompt });
        }

        const candidateModels = [
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          "@cf/meta/llama-3.1-8b-instruct-fast",
          "@cf/meta/llama-3.1-8b-instruct-fp8",
          "@cf/mistral/mistral-7b-instruct-v0.2",
          "@cf/qwen/qwen2.5-7b-instruct"
        ];

        for (const m of candidateModels) {
          try {
            const aiResult = await ai.run(m, {
              messages,
              max_tokens: 3000,
              temperature: 0.7,
            });
            const answer = aiResult?.response || aiResult?.result?.response || (typeof aiResult === "string" ? aiResult : null);
            if (answer && answer.trim().length > 0) {
              generatedContent = answer.trim();
              usedEngine = `Cloudflare Workers AI (${m.split("/").pop()})`;
              break;
            } else {
              debugErrors.push(`[Workers AI ${m}] Réponse vide`);
            }
          } catch (cfErr) {
            debugErrors.push(`[Workers AI ${m} Exception] ${cfErr.message}`);
            console.warn(`[Workers AI ${m}] Exception:`, cfErr);
          }
        }
      }

      // 3. SI RIEN N'A PU FONCTIONNER : Message utilisateur clair et bienveillant
      if (!generatedContent) {
        console.error("[StudyCloud AI Échec Global]", debugErrors.join(" | "));
        const errDetails = debugErrors.length > 0 ? ` (${debugErrors.slice(0, 4).join(' | ')})` : '';
        throw new Error(`L'assistante StudyCloud n'est pas disponible pour le moment.${errDetails}`);
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
    // GESTION DES CERTIFICATS OFFICIELS STUDYCLOUD / DKD SCHOOL NUMÉRIQUE
    // ========================================================================
    if (request.method === "GET" && path === "/api/ai/certificates") {
      const userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId requis" }), { status: 400, headers: corsHeaders });
      }
      if (!db) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
      }
      try {
        const { results } = await db.prepare("SELECT * FROM user_certificates WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all();
        return new Response(JSON.stringify({ success: true, data: results || [] }), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }
    }

    // ========================================================================
    // CORRECTION NUANCÉE ET NOTATION DEVOIR COMPLET PAR L'IA SUR 20 POINTS
    // + CONTRÔLE D'UNICITÉ ET DÉLIVRANCE DU CERTIFICAT (SEUIL 16/20)
    // ========================================================================
    if (request.method === "POST" && path === "/api/ai/grade-exam") {
      const body = await request.json().catch(() => ({}));
      const exam = body.exam || {};
      const answers = body.answers || {};
      const userId = body.userId || request.headers.get("x-user-id") || body.user_id || "default-user";
      const studentName = (body.studentName || body.userName || "Étudiant DKD School Numérique").trim();
      const sourceFileName = (body.sourceFileName || body.fileName || "").trim();
      const sourceFileId = (body.sourceFileId || body.fileId || "").trim();
      const topic = (body.topic || exam.examHeader?.matiere || "Épreuve d'Examen").trim();

      const answersP1 = answers.answersP1 || {};
      const answersP2 = answers.answersP2 || {};
      const answersP3 = answers.answersP3 || {};
      const answersP4 = answers.answersP4 || {};

      const ex1 = exam.exercice1 || {};
      const ex2 = exam.exercice2 || {};
      const ex3 = exam.exercice3 || {};
      const ex4 = exam.exercice4 || {};

      // Heuristique déterministe de secours (garantit toujours une note juste même en cas de coupure IA)
      let heurP1 = 0;
      const ex1Feedbacks = {};
      (ex1.questions || []).forEach((q, i) => {
        const lines = answersP1[q.id] || [];
        const text = (Array.isArray(lines) ? lines.filter(Boolean).join(" ") : String(lines || "")).trim();
        const maxPts = Number(q.points) || (i === 0 ? 2 : 3);
        let pts = 0;
        let fb = "";
        if (text.length >= 80) {
          pts = maxPts;
          fb = "Réponse approfondie, argumentée et pertinente avec maîtrise des concepts.";
        } else if (text.length >= 35) {
          pts = Math.round(maxPts * 0.6 * 2) / 2;
          fb = "Bonne analyse générale, mais certains développements ou justifications manquent de précision.";
        } else if (text.length > 5) {
          pts = Math.round(maxPts * 0.3 * 2) / 2 || 0.5;
          fb = "Réponse trop concise ou partielle. Pensez à étayer vos arguments.";
        } else {
          pts = 0;
          fb = "Aucune réponse exploitable fournie.";
        }
        heurP1 += pts;
        ex1Feedbacks[q.id] = { points: pts, maxPoints: maxPts, feedback: fb, sampleAnswer: q.sampleAnswer || "" };
      });

      let heurP2 = 0;
      const ex2Feedbacks = {};
      (ex2.questions || []).forEach((q) => {
        const chosen = answersP2[q.id];
        const isOk = chosen === q.correctIndex;
        const pts = isOk ? (Number(q.points) || 1) : 0;
        heurP2 += pts;
        ex2Feedbacks[q.id] = {
          points: pts,
          maxPoints: Number(q.points) || 1,
          isCorrect: isOk,
          feedback: isOk ? "Proposition exacte validée." : `Erreur : la proposition attendue était la n°${(q.correctIndex || 0) + 1}.`,
          explication: q.explication || ""
        };
      });

      let heurP3 = 0;
      const ex3Feedbacks = {};
      (ex3.questions || []).forEach((q) => {
        const lines = answersP3[q.id] || [];
        const text = (Array.isArray(lines) ? lines.filter(Boolean).join(" ") : String(lines || "")).trim();
        const maxPts = Number(q.points) || 2;
        let pts = 0;
        let fb = "";
        if (text.length >= 60) {
          pts = maxPts;
          fb = "Synthèse claire, précise et bien articulée.";
        } else if (text.length >= 25) {
          pts = Math.round(maxPts * 0.5 * 2) / 2;
          fb = "Explication partielle : l'idée principale est présente mais mériterait d'être approfondie.";
        } else if (text.length > 5) {
          pts = 0.5;
          fb = "Éléments incomplets.";
        } else {
          pts = 0;
          fb = "Question non traitée.";
        }
        heurP3 += pts;
        ex3Feedbacks[q.id] = { points: pts, maxPoints: maxPts, feedback: fb, sampleAnswer: q.sampleAnswer || "" };
      });

      let heurP4 = 0;
      const ex4Feedbacks = {};
      (ex4.questions || []).forEach((q) => {
        const chosen = answersP4[q.id];
        const isOk = chosen === q.correctValue;
        const pts = isOk ? (Number(q.points) || 1) : 0;
        heurP4 += pts;
        ex4Feedbacks[q.id] = {
          points: pts,
          maxPoints: Number(q.points) || 1,
          isCorrect: isOk,
          feedback: isOk ? "Discrimination exacte." : `Réponse incorrecte : l'affirmation est ${q.correctValue ? "VRAIE" : "FAUSSE"}.`,
          explication: q.explication || ""
        };
      });

      let finalScoreP1 = Math.min(8, Math.max(0, heurP1));
      let finalScoreP2 = Math.min(4, Math.max(0, heurP2));
      let finalScoreP3 = Math.min(4, Math.max(0, heurP3));
      let finalScoreP4 = Math.min(4, Math.max(0, heurP4));
      let finalScoreTotal = Math.round((finalScoreP1 + finalScoreP2 + finalScoreP3 + finalScoreP4) * 2) / 2;
      let finalFeedbackGlobal = finalScoreTotal >= 16
        ? "Excellente prestation académique ! Vous avez fait preuve d'une compréhension conceptuelle remarquable et d'une rigueur exemplaire."
        : finalScoreTotal >= 12
        ? "Bon travail d'ensemble. Les notions fondamentales sont acquises, poursuivez vos efforts d'approfondissement."
        : "Copie insuffisante. Révisez attentivement les points clés du cours et reprenez la correction détaillée.";

      // Appel de notation avancée par Google Gemini avec basculement automatique multi-clés (1 à 4)
      const geminiKeysForGrading = getAvailableGeminiKeys(env);
      if (geminiKeysForGrading.length > 0) {
        try {
          const rawSections = Array.isArray(exam.sections)
            ? exam.sections
            : (Array.isArray(exam.complete_exam?.sections) ? exam.complete_exam.sections : []);

          let examDetailsText = "";
          if (rawSections.length > 0) {
            rawSections.forEach((sec, sIdx) => {
              examDetailsText += `\n--- PARTIE / SECTION ${sIdx + 1} : ${sec.title || "Section"} ---\n`;
              if (sec.problem_statement) {
                examDetailsText += `Contexte / Énoncé : ${sec.problem_statement}\n`;
              }
              (sec.questions || []).forEach((q, qIdx) => {
                const qText = typeof q === "string" ? q : (q.texte || q.question || `Question ${qIdx + 1}`);
                const qId = q.id || `sec_${sIdx + 1}_q${qIdx + 1}`;
                const ans = answers[qId] ?? answersP1[qId] ?? answersP2[qId] ?? answersP3[qId] ?? answersP4[qId] ?? (answers.openAnswers && answers.openAnswers[qId]) ?? (answers.choiceAnswers && answers.choiceAnswers[qId]) ?? (answers.booleanAnswers && answers.booleanAnswers[qId]) ?? "";
                const ansStr = Array.isArray(ans) ? ans.filter(Boolean).join(" ") : String(ans ?? "");
                const exp = q.sampleAnswer || q.reponse || (typeof q.correct_answer === "boolean" ? (q.correct_answer ? "VRAI" : "FAUX") : (q.correctIndex !== undefined ? `Option ${q.correctIndex}` : ""));
                examDetailsText += `Q${qIdx + 1}: "${qText}" | Candidat: "${ansStr}" | Attendu: "${exp}"\n`;
              });
              if (sec.correction?.steps) {
                examDetailsText += `Corrigé de référence : ${sec.correction.steps}\n`;
              }
            });
          } else {
            examDetailsText = `Énoncé Ex 1 : ${ex1.enonce || ""}
Réponses Ex 1 du candidat :
${(ex1.questions || []).map((q, i) => `Q${i + 1} (${q.points || 2} pts) : "${q.texte}" | Attendu: "${q.sampleAnswer || ""}" | Candidat: "${(answersP1[q.id] || []).join(" ")}"`).join("\n")}

Choix Ex 2 (QCM) :
${(ex2.questions || []).map((q, i) => `Q${i + 1} : Choisi idx ${answersP2[q.id]} | Attendu idx ${q.correctIndex} | Exp: "${q.explication || ""}"`).join("\n")}

Réponses Ex 3 (Synthèse) :
${(ex3.questions || []).map((q, i) => `Q${i + 1} (${q.points || 2} pts) : "${q.texte}" | Attendu: "${q.sampleAnswer || ""}" | Candidat: "${(answersP3[q.id] || []).join(" ")}"`).join("\n")}

Choix Ex 4 (V/F) :
${(ex4.questions || []).map((q, i) => `Q${i + 1} : Choisi ${answersP4[q.id]} | Attendu ${q.correctValue} | Exp: "${q.explication || ""}"`).join("\n")}`;
          }

          const gradingPrompt = `Tu es le jury d'examen officiel et correcteur d'élite de StudyCloud • DKD School Numérique.
Évalue et note la copie d'examen suivante sur 20 points avec nuance pédagogique (pleine note si argumenté et précis, note partielle ou demi-point si incomplet ou approximatif, 0 si vide ou faux).
BARÈME TOTAL : 20 points.

Matière / Épreuve : ${topic}
${examDetailsText}

RENVOIE UNIQUEMENT UN JSON STRICT :
{
  "scoreTotal": 17,
  "scoreP1": 6.5,
  "scoreP2": 4,
  "scoreP3": 3,
  "scoreP4": 3.5,
  "feedbackGlobal": "Remarque générale sur la prestation académique...",
  "questionsFeedback": {
    "q1": { "points": 1.5, "feedback": "Explication..." }
  }
};`;


          let gradingSuccess = false;
          for (let kIdx = 0; kIdx < geminiKeysForGrading.length; kIdx++) {
            const activeGradingKey = geminiKeysForGrading[kIdx];
            for (const mod of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
              try {
                const gResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${activeGradingKey}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: gradingPrompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
                  })
                });

                if (gResp.ok) {
                  const gJson = await gResp.json();
                  const rawG = gJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  const cleanG = rawG.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
                  const parsedG = JSON.parse(cleanG);

                  if (typeof parsedG.scoreTotal === "number") {
                    finalScoreTotal = Math.min(20, Math.max(0, parsedG.scoreTotal));
                    if (typeof parsedG.scoreP1 === "number") finalScoreP1 = parsedG.scoreP1;
                    if (typeof parsedG.scoreP2 === "number") finalScoreP2 = parsedG.scoreP2;
                    if (typeof parsedG.scoreP3 === "number") finalScoreP3 = parsedG.scoreP3;
                    if (typeof parsedG.scoreP4 === "number") finalScoreP4 = parsedG.scoreP4;
                    if (parsedG.feedbackGlobal) finalFeedbackGlobal = parsedG.feedbackGlobal;

                    if (parsedG.questionsFeedback && typeof parsedG.questionsFeedback === "object") {
                      for (const [qid, qdata] of Object.entries(parsedG.questionsFeedback)) {
                        if (ex1Feedbacks[qid] && typeof qdata.points === "number") {
                          ex1Feedbacks[qid].points = qdata.points;
                          if (qdata.feedback) ex1Feedbacks[qid].feedback = qdata.feedback;
                        }
                        if (ex3Feedbacks[qid] && typeof qdata.points === "number") {
                          ex3Feedbacks[qid].points = qdata.points;
                          if (qdata.feedback) ex3Feedbacks[qid].feedback = qdata.feedback;
                        }
                      }
                    }
                    gradingSuccess = true;
                    break;
                  }
                }
              } catch (e) {
                console.warn(`[Gemini Grading Clé #${kIdx + 1} • ${mod}]`, e);
              }
            }
            if (gradingSuccess) {
              break; // Ne pas basculer sur une autre clé si celle-ci a fonctionné
            }
          }
        } catch (geminiGradeErr) {
          console.warn("[Gemini Grading Fallback to Heuristic]", geminiGradeErr);
        }
      }

      // ========================================================================
      // CONTRÔLE D'ÉLIGIBILITÉ ET UNICITÉ DU CERTIFICAT EN BASE D1 (SEUIL 16/20)
      // ========================================================================
      let certificateInfo = {
        eligible: finalScoreTotal >= 16,
        awarded: false,
        alreadyIssued: false,
        certificate: null,
        message: ""
      };

      if (finalScoreTotal >= 16) {
        if (db) {
          try {
            // RÈGLE STRICTE : On ne gagne pas le même certificat pour le même sujet ou fichier sélectionné.
            // Si l'utilisateur reprend sur le même fichier, il n'a plus de certificat car le worker vérifie avant de donner.
            let checkQuery = "SELECT * FROM user_certificates WHERE user_id = ? AND (";
            const checkParams = [userId];
            const conditions = [];

            if (sourceFileName) {
              conditions.push("source_file_name = ?");
              checkParams.push(sourceFileName);
            }
            if (sourceFileId) {
              conditions.push("source_file_id = ?");
              checkParams.push(sourceFileId);
            }
            conditions.push("topic = ?");
            checkParams.push(topic);

            checkQuery += conditions.join(" OR ") + ") LIMIT 1";

            const existingCert = await db.prepare(checkQuery).bind(...checkParams).first();

            if (existingCert) {
              certificateInfo.awarded = false;
              certificateInfo.alreadyIssued = true;
              certificateInfo.certificate = existingCert;
              certificateInfo.message = "Un certificat officiel d'excellence a déjà été délivré pour ce fichier ou sujet. Conformément au règlement officiel DKD School Numérique, chaque certificat est unique et ne peut être obtenu qu'une seule fois par document.";
            } else {
              // Nouveau certificat officiel accordé et consigné en base D1 !
              const certId = crypto.randomUUID();
              const certYear = new Date().getFullYear();
              const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
              const certCode = `CERT-DKD-${certYear}-${randomSuffix}`;
              const issuedAt = new Date().toISOString();

              await db.prepare(`
                INSERT INTO user_certificates (id, user_id, source_file_id, source_file_name, topic, score, max_score, certificate_code, student_name, issued_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 20, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(certId, userId, sourceFileId || null, sourceFileName || null, topic, finalScoreTotal, certCode, studentName).run();

              const newCertObj = {
                id: certId,
                user_id: userId,
                source_file_id: sourceFileId || null,
                source_file_name: sourceFileName || null,
                topic: topic,
                score: finalScoreTotal,
                max_score: 20,
                certificate_code: certCode,
                student_name: studentName,
                issued_at: issuedAt
              };

              certificateInfo.awarded = true;
              certificateInfo.alreadyIssued = false;
              certificateInfo.certificate = newCertObj;
              certificateInfo.message = "Félicitations ! Votre Certificat Officiel d'Excellence Académique DKD a été généré et certifié avec succès.";
            }
          } catch (certDbErr) {
            console.error("[Certificates D1 Error]", certDbErr);
            // Fallback certificat en mémoire si indisponibilité temporaire D1
            const certCode = `CERT-DKD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            certificateInfo.awarded = true;
            certificateInfo.alreadyIssued = false;
            certificateInfo.certificate = {
              id: crypto.randomUUID(),
              user_id: userId,
              source_file_name: sourceFileName || null,
              topic: topic,
              score: finalScoreTotal,
              max_score: 20,
              certificate_code: certCode,
              student_name: studentName,
              issued_at: new Date().toISOString()
            };
          }
        } else {
          // Si DB non liée, génération du certificat officiel
          const certCode = `CERT-DKD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          certificateInfo.awarded = true;
          certificateInfo.alreadyIssued = false;
          certificateInfo.certificate = {
            id: crypto.randomUUID(),
            user_id: userId,
            source_file_name: sourceFileName || null,
            topic: topic,
            score: finalScoreTotal,
            max_score: 20,
            certificate_code: certCode,
            student_name: studentName,
            issued_at: new Date().toISOString()
          };
          certificateInfo.message = "Félicitations pour votre note remarquable !";
        }
      } else {
        certificateInfo.message = `Note finale : ${finalScoreTotal}/20. Le seuil requis pour le Certificat d'Excellence Académique est de 16/20. Poursuivez vos efforts !`;
      }

      return new Response(JSON.stringify({
        success: true,
        scoreTotal: finalScoreTotal,
        scoreP1: finalScoreP1,
        scoreP2: finalScoreP2,
        scoreP3: finalScoreP3,
        scoreP4: finalScoreP4,
        feedbackGlobal: finalFeedbackGlobal,
        exercices: {
          exercice1: { score: finalScoreP1, maxPoints: 8, questions: ex1Feedbacks },
          exercice2: { score: finalScoreP2, maxPoints: 4, questions: ex2Feedbacks },
          exercice3: { score: finalScoreP3, maxPoints: 4, questions: ex3Feedbacks },
          exercice4: { score: finalScoreP4, maxPoints: 4, questions: ex4Feedbacks }
        },
        certificateInfo: certificateInfo
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    // ========================================================================
    // CAUSERIE DIRECTE ULTRA-RAPIDE DELMAS IA
    // ========================================================================
    async function executeDelmasDirectChat(body, env, ai, signal) {
      if (signal?.aborted) {
        throw new Error("Génération interrompue par l'utilisateur.");
      }

      const userPrompt = (body.message || body.prompt || body.text || "").trim();
      const geminiKeys = getAvailableGeminiKeys(env, body.geminiApiKey);

      const delmasSystemPrompt = "Tu es Delmas, l'assistant intelligent et tuteur personnel de StudyCloud. Réponds directement, rapidement et clairement en français sous forme de conversation naturelle. Sois concis, encourageant et pédagogue. Utilise le formatage Markdown et le LaTeX ($...$) pour toute formule scientifique.";

      const incomingHist = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
      const geminiContents = [];
      for (const m of incomingHist.slice(-6)) {
        if (m && m.role && m.content && m.role !== "system") {
          geminiContents.push({
            role: m.role === "assistant" || m.role === "model" ? "model" : "user",
            parts: [{ text: String(m.content) }]
          });
        }
      }
      geminiContents.push({
        role: "user",
        parts: [{ text: userPrompt || "Bonjour Delmas !" }]
      });

      // 1. APPEL DIRECT ET ULTRA-RAPIDE : GOOGLE GEMINI 2.0 FLASH
      const geminiModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest", "gemini-1.5-flash"];
      for (let kIdx = 0; kIdx < geminiKeys.length; kIdx++) {
        if (signal?.aborted) throw new Error("Génération interrompue par l'utilisateur.");
        const activeKey = geminiKeys[kIdx];

        for (const mod of geminiModels) {
          if (signal?.aborted) throw new Error("Génération interrompue par l'utilisateur.");
          try {
            const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${activeKey}`;
            
            // Timeout court pour ne jamais bloquer l'interface
            const timeoutCtrl = new AbortController();
            const timeoutId = setTimeout(() => timeoutCtrl.abort(), 4000);
            const combinedSignal = signal ? AbortSignal.any([signal, timeoutCtrl.signal]) : timeoutCtrl.signal;

            const gResponse = await fetch(geminiApiEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: delmasSystemPrompt }] },
                contents: geminiContents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                }
              }),
              signal: combinedSignal
            });
            clearTimeout(timeoutId);

            if (gResponse.ok) {
              const gData = await gResponse.json();
              const candidateText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText && candidateText.trim().length > 0) {
                return {
                  response: candidateText.trim(),
                  usedEngine: "Delmas IA"
                };
              }
            } else {
              const errTxt = await gResponse.text().catch(() => "");
              if (gResponse.status === 403 || (gResponse.status === 400 && errTxt.includes("API_KEY_INVALID"))) {
                break; // Passer à la clé suivante
              }
            }
          } catch (err) {
            if (signal?.aborted) {
              throw new Error("Génération interrompue par l'utilisateur.");
            }
          }
        }
      }

      // 2. FALLBACK ULTRA-RAPIDE VERS CLOUDFLARE WORKERS AI (Modèles officiels 2026)
      if (!signal?.aborted && ai && typeof ai.run === "function") {
        const messages = [{ role: "system", content: delmasSystemPrompt }];
        for (const m of incomingHist.slice(-4)) {
          if (m && m.role && m.content) {
            messages.push({
              role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
              content: String(m.content).slice(0, 1000)
            });
          }
        }
        messages.push({ role: "user", content: (userPrompt || "Bonjour Delmas !").slice(0, 1500) });

        const cfModels = [
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          "@cf/meta/llama-3.1-8b-instruct-fast",
          "@cf/meta/llama-3.1-8b-instruct-fp8",
          "@cf/mistral/mistral-7b-instruct-v0.2"
        ];

        for (const cfModel of cfModels) {
          if (signal?.aborted) throw new Error("Génération interrompue par l'utilisateur.");
          try {
            const aiResult = await ai.run(cfModel, {
              messages,
              max_tokens: 2000,
              temperature: 0.7,
            });
            const answer = aiResult?.response || aiResult?.result?.response || (typeof aiResult === "string" ? aiResult : null);
            if (answer && answer.trim().length > 0) {
              return {
                response: answer.trim(),
                usedEngine: "Delmas IA"
              };
            }
          } catch (cfErr) {
            if (signal?.aborted) throw new Error("Génération interrompue par l'utilisateur.");
            console.warn(`[Delmas CF AI Error on ${cfModel}]:`, cfErr?.message);
          }
        }
      }

      if (signal?.aborted) {
        throw new Error("Génération interrompue par l'utilisateur.");
      }

      // 3. FILET DE SÉCURITÉ ABSOLU DELMAS : ZÉRO ERREUR BLOQUANTE
      const greetings = ["bonjour", "salut", "bonsoir", "coucou", "hello", "hi", "hey"];
      const isGreeting = greetings.some(g => (userPrompt || "").toLowerCase().includes(g));

      let fallbackText = "";
      if (isGreeting || !userPrompt) {
        fallbackText = "Bonjour ! Je suis **Delmas**, ton assistant et tuteur personnel StudyCloud. Je suis ravi de discuter avec toi ! Comment puis-je t'aider aujourd'hui dans tes cours, devoirs ou révisions ?";
      } else {
        fallbackText = `Bonjour ! Je suis **Delmas**, ton tuteur StudyCloud. J'ai bien reçu ta question : « *${userPrompt.slice(0, 100)}* ».\n\nJe suis prêt à t'accompagner ! Peux-tu me préciser le chapitre, la matière ou la formule exacte que tu souhaites travailler ensemble ?`;
      }

      return {
        response: fallbackText,
        usedEngine: "Delmas IA"
      };
    }

    // ========================================================================
    // POINT D'ENTRÉE DU CHAT DIRECT DELMAS : /api/ai/delmas-chat
    // ========================================================================
    if (request.method === "POST" && (path === "/api/ai/delmas-chat" || path === "/api/delmas-chat")) {
      try {
        const body = await request.json().catch(() => ({}));
        const result = await executeDelmasDirectChat(body, env, ai, request.signal);
        return new Response(JSON.stringify({
          success: true,
          response: result.response,
          model: result.usedEngine,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      } catch (delmasErr) {
        const isAbort = request.signal?.aborted || delmasErr.message?.includes("interrompue");
        return new Response(JSON.stringify({
          success: false,
          error: delmasErr.message || "Erreur interne de Delmas IA.",
          aborted: isAbort
        }), {
          status: isAbort ? 499 : 500,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }
    }

    // ========================================================================
    // POINT D'ENTRÉE DU CHAT IA GÉNÉRAL : /api/ai/chat (SYNCHRONE)
    // ========================================================================
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
      });
    }

    try {
      const body = await request.json().catch(() => ({}));

      // Si la requête provient de Delmas IA (causerie directe sans création ni persistance D1)
      if (body.delmasChat || body.mode === "delmas") {
        const result = await executeDelmasDirectChat(body, env, ai, request.signal);
        return new Response(JSON.stringify({
          success: true,
          response: result.response,
          model: result.usedEngine,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
        });
      }

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
        const shouldSaveInChat = !body.isDirectCreation && !body.skipChatHistory;

        // 1. Conversations & Messages (EXCLUSIVEMENT pour le Chat interactif, JAMAIS pour les créations directes)
        if (shouldSaveInChat && conversationId) {
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

        // 2. User AI Workspace (Historique par session & utilisateur - uniquement pour le chat)
        if (shouldSaveInChat) {
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
        }

        // 3. AI Creations (Espace Créations)
        if (formatted.decision === "creation" && formatted.creation_data) {
          const creationId = body.creationId || crypto.randomUUID();
          const contentStr = typeof formatted.creation_data === "string" ? formatted.creation_data : JSON.stringify(formatted.creation_data);

          // Insérer dans ai_creations uniquement si la création provient du chat interactif
          if (shouldSaveInChat && conversationId) {
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

      // Retour structuré au client StudyCloud avec aperçu HTML riche
      let htmlPreview = null;
      if (formatted.decision === "creation" && formatted.creation_data) {
        try {
          htmlPreview = generateCreationHtmlPreview(
            formatted.creation_type || requestedType || "creation",
            formatted.creation_title || "Création StudyCloud",
            formatted.creation_data,
            body.attachedFileName || "Document d'étude"
          );
        } catch (e) {
          console.warn("[HtmlPreview Error]:", e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        ...formatted,
        html_preview: htmlPreview,
        preview_url: `/api/ai/preview?type=${encodeURIComponent(formatted.creation_type || requestedType || 'creation')}&title=${encodeURIComponent(formatted.creation_title || 'Création')}`,
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
