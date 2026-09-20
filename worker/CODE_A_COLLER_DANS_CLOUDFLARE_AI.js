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
        brain: "Google Gemini 2.0 Flash (Multi-Clés avec Basculement Automatique)",
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
        let status = "inconnu";
        let detail = null;
        try {
          const testEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k}`;
          const gTest = await fetch(testEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ping" }] }]
            })
          });
          status = `HTTP ${gTest.status}`;
          if (gTest.ok) {
            const data = await gTest.json();
            detail = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK";
          } else {
            detail = (await gTest.text()).slice(0, 200);
          }
        } catch (e) {
          status = "Exception";
          detail = e.message;
        }
        keyReports.push({
          keyNumber: i + 1,
          prefix: `${k.slice(0, 6)}...${k.slice(-4)}`,
          status,
          detail
        });
      }

      let cfAiStatus = "not_bound";
      if (ai && typeof ai.run === "function") {
        try {
          const cfTest = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [{ role: "user", content: "Bonjour en un mot" }]
          });
          cfAiStatus = cfTest?.response ? "OK" : "Réponse vide";
        } catch (cfErr) {
          cfAiStatus = "Exception: " + cfErr.message;
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
          .replace(/[\x08\u0008]/g, "\\b"); // Répare \x08eta -> \beta
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

4. ZÉRO CARACTÈRE BIZARRE ET RESPECT INVIOLABLE DU FORMAT LATEX DANS LE JSON :
   - Chaque formule, fraction, équation ou variable scientifique ($V_s$, $V_e$, $R_1$, $R_2$, $I_c$, $\\omega$, $\\Omega$) DOIT être rigoureusement entourée de symboles dollar "$ ... $" en ligne ou "$$ ... $$" en bloc.
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
   - Pour TOUTES les formules, fractions, grandeurs et équations dans les questions, options et explications, utilise la syntaxe LaTeX standard ($...$).

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
          "gemini-1.5-flash",
          "gemini-1.5-pro",
          "gemini-2.0-flash-lite"
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

                // Si quota/surcharge (429) ou problème de clé (400, 403), basculer immédiatement sur la clé Gemini suivante
                if (gResponse.status === 429 || gResponse.status === 400 || gResponse.status === 403) {
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
          "@cf/meta/llama-3.1-8b-instruct",
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          "@cf/mistral/mistral-7b-instruct-v0.2"
        ];

        for (const m of candidateModels) {
          try {
            const aiResult = await ai.run(m, {
              messages,
              max_tokens: 3000,
              temperature: 0.7,
            });
            if (aiResult?.response) {
              generatedContent = aiResult.response;
              usedEngine = `Cloudflare Workers AI (${m})`;
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
        throw new Error("L'assistante StudyCloud n'est pas disponible pour le moment.");
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
            for (const mod of ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"]) {
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
