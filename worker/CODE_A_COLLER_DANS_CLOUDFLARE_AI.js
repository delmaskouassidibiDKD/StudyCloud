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

    // Gestion des créations IA (résumés, cartes mémoire, quiz, cartes mentales)
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
      q += " ORDER BY is_pinned DESC, created_at DESC";
      const { results } = await db.prepare(q).bind(...params).all();
      const formatted = (results || []).map(r => ({
        ...r,
        contentJson: typeof r.content_json === "string" ? JSON.parse(r.content_json || "{}") : r.content_json
      }));
      return new Response(JSON.stringify({ success: true, data: formatted }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method === "POST" && path === "/api/ai-contents") {
      const body = await request.json().catch(() => ({}));
      const { id, userId, fileId, toolType, title, contentJson, sourceFileName, isPinned } = body;
      if (!userId || !toolType || !title) {
        return new Response(JSON.stringify({ error: "userId, toolType et title requis" }), { status: 400, headers: corsHeaders });
      }
      if (!db) return new Response(JSON.stringify({ error: "D1 non configuré" }), { status: 500, headers: corsHeaders });

      const contentId = id || crypto.randomUUID();
      const jsonStr = typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson || {});
      await db.prepare(`
        INSERT INTO ai_generated_contents (id, user_id, file_id, tool_type, title, content_json, source_file_name, is_pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content_json = excluded.content_json,
          source_file_name = excluded.source_file_name,
          is_pinned = excluded.is_pinned,
          updated_at = CURRENT_TIMESTAMP
      `).bind(contentId, userId, fileId || null, toolType, title, jsonStr, sourceFileName || null, isPinned ? 1 : 0).run();

      return new Response(JSON.stringify({ success: true, data: { id: contentId } }), {
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

    // ------------------------------------------------------------------------
    // GESTION DES CONVERSATIONS (SESSIONS DE CHAT STYLE GEMINI)
    // ------------------------------------------------------------------------
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
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true, message: "Conversation supprimée" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ------------------------------------------------------------------------
    // GESTION DES MESSAGES DE CONVERSATION (MÉMOIRE PERSISTANTE)
    // ------------------------------------------------------------------------
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
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ------------------------------------------------------------------------
    // GESTION DES CRÉATIONS IA ASSOCIÉES (TABLE ai_creations)
    // ------------------------------------------------------------------------
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
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true }), {
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
      const userPrompt = body.message || body.prompt || body.text || "";
      const conversationId = body.conversation_id || body.conversationId || body.sessionId || "default-session";
      const requestedType = (body.requested_type || body.toolType || body.type || "").toLowerCase().trim();
      const userId = body.userId;
      const sessionId = body.sessionId || conversationId;
      const isPowerMode = Boolean(body.powerMode || body.engine === "gemini");

      // ------------------------------------------------------------------------
      // MODE PUISSANCE : DÉLÉGATION À GOOGLE GEMINI (studycloud-gemini)
      // ------------------------------------------------------------------------
      if (isPowerMode) {
        // 1. Détection liaison de service Cloudflare 'studycloud-gemini'
        const geminiBinding = env?.["studycloud-gemini"] || env?.STUDYCLOUD_GEMINI || env?.GEMINI;
        if (geminiBinding && typeof geminiBinding.fetch === "function") {
          try {
            const geminiRes = await geminiBinding.fetch(new Request(request.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            }));
            if (geminiRes.ok) {
              const resData = await geminiRes.json();
              return new Response(JSON.stringify(resData), {
                headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
              });
            }
          } catch (bindErr) {
            console.warn("[Puissance] Erreur liaison service studycloud-gemini:", bindErr);
          }
        }

        // 2. Appel direct par URL vers le worker studycloud-gemini
        try {
          const geminiExternalUrl = env?.GEMINI_WORKER_URL || "https://studycloud-gemini.delmaskouassidibi.workers.dev";
          const extRes = await fetch(geminiExternalUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          if (extRes.ok) {
            const extData = await extRes.json();
            return new Response(JSON.stringify(extData), {
              headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
            });
          }
        } catch (extErr) {
          console.warn("[Puissance] Erreur appel HTTP studycloud-gemini:", extErr);
        }
      }

      // 1. SYSTEM PROMPT MAÎTRE ("Le Méga-Neurone" de StudyCloud / DKDSCHOOL-NUMÉRIQUE)
      const masterSystemPrompt = `Tu es le tuteur pédagogique personnel d'élite de StudyCloud / DKDSCHOOL-NUMÉRIQUE, développé par DKD Technologies.
Ton rôle absolu est d'ENSEIGNER directement et de FAIRE COMPRENDRE le cours en profondeur à l'élève, et JAMAIS de survoler ou de donner de simples listes de conseils d'organisation.

RÈGLE D'OR PÉDAGOGIQUE (INTERDICTION ABSOLUE DU SURVOL SUPERFICIEL) :
- CONTRE-EXEMPLE FORMELLEMENT INTERDIT : Ne réponds JAMAIS par des phrases creuses du genre : "Voici les 4 étapes pour comprendre : 1. Lisez la leçon, 2. Apprenez les formules, 3. Faites des exercices". C'est du remplissage inutile qui n'aide personne !
- L'élève est devant toi pour COMPRENDRE LE FOND DU COURS MAINTENANT. Prends-le par la main avec cette méthode d'enseignement d'élite :
  1. L'Intuition et l'Analogie concrète : Explique d'abord pourquoi ce concept existe, à quel problème réel il répond, avec une métaphore parlante de la vie courante (ex: la transformée de Laplace comme un dictionnaire bilingue qui transforme des équations différentielles infernales en simples multiplications d'algèbre de collège).
  2. Décortique chaque formule lettre par lettre : Ne jette JAMAIS une formule brute. Rédige TOUTES les formules en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc centré). Explique le rôle de chaque variable, constante, opérateur ($p$, $t$, \\int, bornes, limites) et son sens physique ou mathématique.
  3. L'Exemple résolu pas à pas sous ses yeux : Déroule un exemple concret ou un exercice type extrait de son cours, résolu et calculé étape par étape en justifiant chaque transformation algébrique.
  4. Le Piège d'Examen : Signale les erreurs classiques que font les étudiants aux examens pour qu'il ne tombe pas dedans.
  5. Validation interactive : Termine toujours par une question simple ou un petit défi de compréhension pour valider qu'il a assimilé la notion.

Règles selon le type de création demandé ('${requestedType || "auto"}') :
- Si QCM / QUIZ : Propose des questions claires avec LaTeX, exactement 4 options identifiées (A, B, C, D), la bonne réponse et un indice pédagogique.
- Si CARTE MENTALE (Mindmap) : Définis un concept central et des branches hiérarchiques nettes (Définitions, Propriétés clés, Applications, Méthodes de calcul).
- Si INFOGRAPHIE / DIAPORAMA : Structure en blocs étagés et étapes séquentielles avec des repères visuels clairs.
- Si FLASHCARDS : Définis des paires recto (question/formule) et verso (réponse/application).
- Si RÉSUMÉ : Rédige une synthèse fluide, complète, avec les définitions et théorèmes fondamentaux bien mis en valeur.`;

      // Document support attaché si présent (supporte toutes les clés : attachedFileContent, file_content, etc.)
      const rawDocContent = (
        (typeof body.attachedFileContent === "string" && body.attachedFileContent) ||
        (typeof body.file_content === "string" && body.file_content) ||
        (typeof body.fileContent === "string" && body.fileContent) ||
        (typeof body.documentContent === "string" && body.documentContent) ||
        (typeof body.documentText === "string" && body.documentText) ||
        ""
      ).trim();

      // INJECTION DIRECTE DU DOCUMENT DANS L'UNIQUE MESSAGE SYSTÈME (Obligatoire pour Cloudflare Workers AI)
      let fullSystemPrompt = masterSystemPrompt;
      if (rawDocContent.length > 0) {
        const docTitle = body.attachedFileName || body.file_name || body.fileName || body.documentName || "Document de cours";
        const maxDocChars = 50000;
        const cleanDocContent = rawDocContent.slice(0, maxDocChars);
        fullSystemPrompt += `

======================================================================
DOCUMENT JOINT DE L'ÉLÈVE ("${docTitle}") - ANALYSE INTÉGRALE :
======================================================================
${cleanDocContent}
======================================================================
FIN DU DOCUMENT JOINT
======================================================================
DIRECTIVES OBLIGATOIRES POUR CE DOCUMENT :
- Tu as le texte ci-dessus sous les yeux de la première à la dernière ligne.
- Appuie-toi rigoureusement sur les définitions, théorèmes, formules et exemples de CE document.
- Cite expressément les pages réelles ([Page X]) de son cours pour qu'il s'y repère instantanément.
- Ne survole pas : enseigne le contenu de ce cours en profondeur et avec rigueur.`;
      }

      // Construction de la liste des messages avec un SEUL rôle système à l'indice 0
      const messages = [
        { role: "system", content: fullSystemPrompt }
      ];

      // Ajout de l'historique récent avec alternance stricte des rôles
      let incomingHistory = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
      let lastRole = "system";

      for (const m of incomingHistory.slice(-8)) {
        if (m && m.role && m.content && m.role !== "system") {
          const role = m.role === "user" ? "user" : "assistant";
          const content = String(m.content).trim();
          if (content && (role !== lastRole || role === "assistant")) {
            messages.push({ role, content });
            lastRole = role;
          }
        }
      }

      // Message utilisateur actuel
      const currentPrompt = userPrompt.trim() || (messages.length === 1 ? "Bonjour ! Peux-tu m'expliquer ce cours en détail ?" : "");
      if (currentPrompt) {
        if (lastRole === "user") {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.content !== currentPrompt) {
            lastMsg.content = `${lastMsg.content}\n\n${currentPrompt}`;
          }
        } else {
          messages.push({ role: "user", content: currentPrompt });
        }
      }

      // Modèles candidats performants (priorité à Llama-3.1-8b pour une vitesse et une compatibilité maximale sans timeout)
      const candidateModels = [
        "@cf/meta/llama-3.1-8b-instruct",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-3-8b-instruct",
        "@cf/mistral/mistral-7b-instruct-v0.2",
        "@cf/qwen/qwen1.5-14b-chat-awq"
      ];

      // --- PASSE 1 : GÉNÉRATION INITIALE DE HAUTE QUALITÉ ---
      let aiResult = null;
      let usedModel = "";
      let lastError = null;

      for (const m of candidateModels) {
        try {
          aiResult = await ai.run(m, {
            messages: messages,
            max_tokens: 3000,
            temperature: 0.3, // Température optimale pour rigueur pédagogique et clarté
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

      let generatedContent = "";
      if (typeof aiResult?.response === "string") {
        generatedContent = aiResult.response;
      } else if (typeof aiResult === "string") {
        generatedContent = aiResult;
      } else if (aiResult && typeof aiResult === "object") {
        generatedContent = aiResult.response || aiResult.text || aiResult.result || JSON.stringify(aiResult);
      }

      // --- PASSE 2 : LE NEURONE DE VÉRIFICATION & D'AUTO-CORRECTION ---
      // Si une création structurée est demandée, on applique un contrôle qualité strict à basse température
      if (requestedType && requestedType !== "text" && generatedContent.trim().length > 20) {
        const critiquePrompt = `Tu es le module de contrôle qualité, de vérification mathématique et d'auto-correction du Méga-Neurone StudyCloud.
Analyse le contenu généré ci-dessous pour le format "${requestedType}".
Vérifications obligatoires :
1. Formules mathématiques : Vérifie l'exactitude des calculs, intégrales, dérivées, limites et la syntaxe LaTeX standard ($...$ ou $$...$$).
2. Structure :
   - Si QCM : Vérifie que chaque question a 4 choix (A, B, C, D) clairs, la bonne réponse et une explication pédagogique.
   - Si Carte Mentale : Vérifie la cohérence du nœud central et des branches hiérarchiques.
   - Si Infographie / Diaporama : Vérifie que les étapes ou blocs sont progressifs et percutants.
   - Si Résumé / Flashcard : Vérifie la clarté et la concision.
3. Si une coquille, une formule tronquée ou une incohérence est détectée, corrige-la immédiatement.
Renvoie UNIQUEMENT le contenu final vérifié, corrigé et prêt à l'emploi pour l'application, sans aucun commentaire méta ni préambule.

CONTENU À CONTRÔLER ET CORRIGER :
${generatedContent}`;

        try {
          const critiqueResult = await ai.run(usedModel || "@cf/meta/llama-3.1-8b-instruct", {
            messages: [{ role: "system", content: critiquePrompt }],
            temperature: 0.1, // Contrôle strict et déterministe
            max_tokens: 2500,
          });

          const refined = critiqueResult?.response || critiqueResult?.result || critiqueResult?.text || (typeof critiqueResult === "string" ? critiqueResult : "");
          if (refined && refined.trim().length > 30) {
            generatedContent = refined.trim();
          }
        } catch (critiqueErr) {
          console.warn("[Neurone] Vérification échouée, conservation de la passe 1:", critiqueErr?.message || critiqueErr);
        }
      }

      // --- ÉTAPE 3 : SAUVEGARDE PERSISTANTE DANS D1 ---
      if (db) {
        const userMsgId = crypto.randomUUID();
        const aiMsgId = crypto.randomUUID();

        // 1. Sauvegarde dans la table messages pour l'historique Gemini
        if (conversationId) {
          try {
            await db.prepare(`
              INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
              VALUES (?, ?, 'user', ?, ?, CURRENT_TIMESTAMP)
            `).bind(userMsgId, conversationId, userPrompt, JSON.stringify({ attachedFileName: body.attachedFileName || null })).run();

            await db.prepare(`
              INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
              VALUES (?, ?, 'assistant', ?, ?, CURRENT_TIMESTAMP)
            `).bind(aiMsgId, conversationId, generatedContent, JSON.stringify({ model: usedModel, type: requestedType || "text" })).run();

            await db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(conversationId).run();
          } catch (msgErr) {
            console.warn("[Workspace AI] Erreur insertion messages D1:", msgErr);
          }
        }

        // 2. Si c'est une création dédiée, sauvegarde dans la table ai_creations
        if (requestedType && requestedType !== "text" && conversationId) {
          try {
            const creationId = body.creationId || crypto.randomUUID();
            const creationTitle = `${requestedType.toUpperCase()} : ${(userPrompt || body.attachedFileName || "Création").slice(0, 50)}`;
            await db.prepare(`
              INSERT INTO ai_creations (id, conversation_id, message_id, type, title, content, created_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content
            `).bind(creationId, conversationId, aiMsgId, requestedType, creationTitle, generatedContent).run();
          } catch (creatErr) {
            console.warn("[Workspace AI] Erreur insertion ai_creations D1:", creatErr);
          }
        }

        // 3. Sauvegarde de rétro-compatibilité dans user_ai_workspace
        if (userId) {
          try {
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
              generatedContent
            ).run();
          } catch (dbSaveErr) {
            console.warn("[Workspace AI] Erreur sauvegarde user_ai_workspace D1:", dbSaveErr);
          }
        }
      }

      // --- 4. RETOUR AU FRONT-END ---
      return new Response(JSON.stringify({
        success: true,
        response: generatedContent,
        type: requestedType || "text",
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

