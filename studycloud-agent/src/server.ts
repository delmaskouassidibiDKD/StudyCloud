import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  generateText,
  tool
} from "ai";
import { z } from "zod";

// Modèles Cloudflare Workers AI
const PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// En-têtes CORS universels pour l'application StudyCloud
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-agent-id",
  "Access-Control-Max-Age": "86400",
};

/**
 * Nettoyage et extraction rigoureuse du JSON produit par le modèle IA
 */
function extractAndSanitizeJson(rawText: string): any {
  if (!rawText || typeof rawText !== "string") return null;

  // 1. Nettoyer les balises Markdown ```json ... ```
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. Extraire le premier bloc {...} ou [...] si du texte entoure le JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Réparer les caractères d'échappement LaTeX fréquents dans les cours scientifiques
  // \frac -> \\frac, \Omega -> \\Omega, \beta -> \\beta, etc.
  const sanitized = cleaned
    .replace(/\\(frac|Omega|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|omega|times|div|approx|neq|le|ge|cdot|infty|sqrt)/g, "\\\\$1")
    .replace(/[\x00-\x1F\x7F]/g, (char) => (char === "\n" || char === "\r" || char === "\t" ? char : ""));

  try {
    return JSON.parse(sanitized);
  } catch (_e) {
    try {
      return JSON.parse(cleaned);
    } catch (_e2) {
      return null;
    }
  }
}

/**
 * Générateur dédié de modules pédagogiques structurés pour StudyCloud
 */
export async function generateStudyCloudCreation(env: Env, params: {
  toolType: string;
  docName?: string;
  docContent?: string;
  prompt?: string;
  userId?: string;
}) {
  const workersai = createWorkersAI({ binding: env.AI });
  const toolType = (params.toolType || "resume").toLowerCase();
  const docName = params.docName || "Document de cours";
  const docContent = (params.docContent || "").slice(0, 32000); // 32k tokens de contexte
  const userPrompt = params.prompt || "";

  // Définition des schémas et consignes par module pédagogique StudyCloud
  let typeLabel = "Résumé Pédagogique";
  let jsonInstructions = "";

  switch (toolType) {
    case "questionnaire":
    case "questionnaire-test":
      typeLabel = "Questionnaire QCM Interactif";
      jsonInstructions = `Générez un ensemble de 5 à 10 questions QCM stimulantes basées sur le cours.
Format JSON STRICT attendu :
{
  "title": "QCM : Titre du cours",
  "questions": [
    {
      "id": "q1",
      "question": "Énoncé clair et précis de la question ?",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
      "correctIndex": 0,
      "explanation": "Explication détaillée de la bonne réponse."
    }
  ]
}`;
      break;

    case "vrai-ou-faux":
    case "vrai-ou-faux-test":
      typeLabel = "Test Vrai ou Faux";
      jsonInstructions = `Générez 6 à 10 affirmations clés (certaines vraies, certaines fausses avec pièges classiques d'examen).
Format JSON STRICT attendu :
{
  "title": "Vrai ou Faux : Titre du cours",
  "affirmations": [
    {
      "id": "v1",
      "statement": "Affirmation conceptuelle précise.",
      "isTrue": true,
      "explanation": "Justification théorique rigoureuse basée sur le cours."
    }
  ]
}`;
      break;

    case "carte-mentale":
    case "carte-mentale-2":
      typeLabel = "Carte Mentale Conceptuelle";
      jsonInstructions = `Structurez le cours sous forme d'une arborescence logique (Mind Map) avec nœud racine et branches hiérarchiques.
Format JSON STRICT attendu :
{
  "title": "Carte Mentale : Titre du cours",
  "root": {
    "id": "root-1",
    "title": "Concept Principal",
    "label": "Concept Principal",
    "notes": "Définition globale synthétique",
    "color": "#3b82f6",
    "children": [
      {
        "id": "branch-1",
        "title": "Sous-thème A",
        "label": "Sous-thème A",
        "notes": "Explication clé",
        "color": "#10b981",
        "children": [
          { "id": "sub-1-1", "title": "Détail 1", "label": "Détail 1", "notes": "Formule ou règle" }
        ]
      },
      {
        "id": "branch-2",
        "title": "Sous-thème B",
        "label": "Sous-thème B",
        "notes": "Applications concrètes",
        "color": "#f59e0b",
        "children": []
      }
    ]
  }
}`;
      break;

    case "carte-memoire":
      typeLabel = "Cartes Mémoire (Flashcards)";
      jsonInstructions = `Générez 8 à 15 cartes mémoires mémorisables (style Anki/Leitner) pour ancrer les formules, théorèmes et définitions.
Format JSON STRICT attendu :
{
  "title": "Flashcards : Titre du cours",
  "cards": [
    {
      "id": "card-1",
      "front": "Question ou terme clé au recto ?",
      "back": "Définition ou formule exacte au verso",
      "tag": "Formule / Théorie",
      "definition": "Contexte d'application",
      "examples": ["Exemple concret 1"]
    }
  ]
}`;
      break;

    case "resume":
      typeLabel = "Fiche de Synthèse & Résumé";
      jsonInstructions = `Produisez un résumé académique d'excellence synthétisant la totalité du document.
Format JSON STRICT attendu :
{
  "title": "Fiche de Synthèse : Titre du cours",
  "overview": "Vue d'ensemble et problématique centrale (2 à 3 paragraphes denses).",
  "keyPoints": [
    "Point fondamental 1 avec explications",
    "Point fondamental 2"
  ],
  "definitions": [
    { "term": "Terme technique", "definition": "Définition exacte" }
  ],
  "rules": [
    "Règle ou théorème 1",
    "Règle ou théorème 2"
  ],
  "tags": ["Matière", "Niveau", "Chapitre"]
}`;
      break;

    case "infographie":
      typeLabel = "Infographie Visuelle Pédagogique";
      jsonInstructions = `Concevez une infographie textuelle enrichie de chiffres clés, métriques, concepts visuels et alertes.
Format JSON STRICT attendu :
{
  "title": "Infographie : Titre du cours",
  "mainTitle": "Titre Impactant",
  "subtitle": "Sous-titre descriptif",
  "metrics": [
    { "value": "100%", "label": "Rendement théorique", "color": "emerald" },
    { "value": "3", "label": "Piliers fondamentaux", "color": "blue" }
  ],
  "keyConcepts": [
    { "title": "Concept 1", "desc": "Explication percutante en 2 lignes.", "badge": "Important" }
  ],
  "highlights": [
    { "type": "tip", "title": "Astuce d'Examen", "text": "Conseil méthodologique pour réussir les épreuves." },
    { "type": "warning", "title": "Erreur Fréquente", "text": "Le piège classique à éviter absolument." }
  ]
}`;
      break;

    case "exercices-ecrits":
      typeLabel = "Exercices d'Application & Problèmes";
      jsonInstructions = `Concevez 3 à 5 exercices d'application graduelle (Facile, Moyen, Avancé) avec corrigés détaillés et étapes de calculs.
Format JSON STRICT attendu :
{
  "title": "Exercices Écrits : Titre du cours",
  "exercises": [
    {
      "id": "ex-1",
      "title": "Exercice 1 : Application directe",
      "difficulty": "Facile",
      "statement": "Énoncé complet du problème avec données numériques ou textuelles.",
      "sampleAnswer": "Correction détaillée pas à pas avec formules et résultats numériques.",
      "tips": ["Conseil pour démarrer", "Vérification dimensionnelle"]
    }
  ]
}`;
      break;

    case "devoir-complet":
      typeLabel = "Sujet d'Examen Complet & Barème";
      jsonInstructions = `Concevez une épreuve d'examen complète type partiel universitaire avec barème sur 20 points et corrigé type officiel.
Format JSON STRICT attendu :
{
  "title": "Devoir d'Évaluation : Titre du cours",
  "duration": "2 Heures",
  "totalPoints": 20,
  "instructions": [
    "Calculatrice autorisée",
    "Justifier rigoureusement toutes vos réponses"
  ],
  "parties": [
    {
      "partNumber": 1,
      "title": "Partie 1 : Questions de Cours & Théorie",
      "points": 8,
      "questions": [
        {
          "id": "q1-1",
          "number": 1,
          "points": 4,
          "question": "Énoncé précis de la question ?",
          "keywords": ["mot-clé 1", "formule"],
          "sampleAnswer": "Réponse idéale attendue par le correcteur.",
          "hint": "Indice pour l'étudiant"
        }
      ]
    },
    {
      "partNumber": 2,
      "title": "Partie 2 : Problème d'Ingénierie / Étude de Cas",
      "points": 12,
      "questions": [
        {
          "id": "q2-1",
          "number": 1,
          "points": 6,
          "question": "Énoncé de l'analyse ou du calcul complexe ?",
          "keywords": ["démonstration", "calcul"],
          "sampleAnswer": "Développement analytique complet.",
          "hint": "Méthode recommandée"
        }
      ]
    }
  ]
}`;
      break;

    default: // pdf / document
      typeLabel = "Document de Cours Magistral";
      jsonInstructions = `Structurez un fascicule de cours complet divisé en chapitres et sections.
Format JSON STRICT attendu :
{
  "title": "Fascicule : Titre du cours",
  "subtitle": "Polycopié d'étude",
  "subject": "Discipline académique",
  "academicLevel": "Enseignement Supérieur",
  "sections": [
    {
      "heading": "Chapitre 1 : Introduction et Fondements",
      "body": "Développement théorique détaillé et soigné...",
      "bulletPoints": ["Point clé A", "Point clé B"],
      "highlightBox": "Formule clé ou encadré récapitulatif"
    }
  ]
}`;
      break;
  }

  const systemPrompt = `Vous êtes le Moteur d'Ingénierie Pédagogique de StudyCloud.
Votre mission : examiner le document de cours fourni et générer un module d'apprentissage haute fidélité "${typeLabel}".
Vous DEVEZ répondre STRICTEMENT avec un objet JSON valide, sans texte d'introduction ni bavardage, conforme au schéma demandé.

${jsonInstructions}`;

  const promptContent = `DOCUMENT SOURCE : ${docName}
CONTENU DU COURS :
"""
${docContent || "Cours théorique sur " + docName}
"""

INSTRUCTIONS SPÉCIFIQUES DE L'UTILISATEUR :
${userPrompt || "Génère un module pédagogique complet, rigoureux et directement exploitable pour les révisions."}`;

  let rawOutput = "";
  try {
    const result = await generateText({
      model: workersai(PRIMARY_MODEL),
      system: systemPrompt,
      prompt: promptContent,
      maxOutputTokens: 3500,
    });
    rawOutput = result.text;
  } catch (primaryErr) {
    console.warn("[StudyCloud Agent] Erreur modèle principal 70B, bascule sur modèle 8B:", primaryErr);
    const fallbackResult = await generateText({
      model: workersai(FALLBACK_MODEL),
      system: systemPrompt,
      prompt: promptContent,
      maxOutputTokens: 2500,
    });
    rawOutput = fallbackResult.text;
  }

  const parsedData = extractAndSanitizeJson(rawOutput);

  if (!parsedData) {
    throw new Error("L'agent n'a pas pu formater une réponse JSON valide pour ce document.");
  }

  const finalTitle = parsedData.title || `${typeLabel} - ${docName.replace(/\.[^/.]+$/, "")}`;

  return {
    success: true,
    creation_type: toolType,
    creation_title: finalTitle,
    creation_data: parsedData,
    rawText: rawOutput,
    model: PRIMARY_MODEL,
  };
}

/**
 * Analyseur de document académique
 */
export async function analyzeStudyCloudDocument(env: Env, params: {
  docName?: string;
  docContent?: string;
}) {
  const workersai = createWorkersAI({ binding: env.AI });
  const docName = params.docName || "Document";
  const docContent = (params.docContent || "").slice(0, 24000);

  const prompt = `Analysez ce cours "${docName}" et produisez un audit pédagogique JSON au format suivant :
{
  "documentTitle": "Titre clair",
  "domain": "Domaine (ex: Électronique, Droit, Mathématiques)",
  "academicLevel": "Niveau recommandé (L1, L2, L3, M1, etc.)",
  "summary": "Résumé concis en 3 phrases.",
  "keyTopics": ["Thème 1", "Thème 2", "Thème 3"],
  "prerequisites": ["Prérequis 1", "Prérequis 2"],
  "recommendedModules": ["questionnaire", "carte-mentale", "devoir-complet"]
}

CONTENU :
${docContent}`;

  const result = await generateText({
    model: workersai(PRIMARY_MODEL),
    prompt,
    maxOutputTokens: 1500,
  });

  const parsed = extractAndSanitizeJson(result.text) || {
    documentTitle: docName,
    summary: result.text.slice(0, 300),
    keyTopics: [],
    recommendedModules: ["resume", "questionnaire", "carte-mentale"]
  };

  return {
    success: true,
    analysis: parsed
  };
}

/**
 * Classe d'Agent Persistant StudyCloud (Durable Object avec SQLite)
 * Implémente l'architecture officielle Cloudflare Agents SDK
 */
export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 150;
  chatRecovery = true;
  waitForMcpConnections = true;

  onStart() {
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  @callable()
  async generateCreation(params: {
    toolType: string;
    docName?: string;
    docContent?: string;
    prompt?: string;
  }) {
    return await generateStudyCloudCreation(this.env, params);
  }

  @callable()
  async analyzeDoc(params: { docName?: string; docContent?: string }) {
    return await analyzeStudyCloudDocument(this.env, params);
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai(PRIMARY_MODEL, {
        sessionAffinity: this.sessionAffinity
      }),
      system: `Vous êtes Delmas IA, le tuteur d'étude neuronal et l'assistant officiel de StudyCloud.
Votre objectif est d'aider les étudiants et professeurs à comprendre en profondeur leurs cours universitaires, résoudre des exercices pas à pas et synthétiser leurs documents.
Règles :
1. Répondez toujours en français soigné, structuré avec des titres en Markdown et des puces claires.
2. Pour les équations et formules mathématiques, utilisez la syntaxe LaTeX standard ($...$ pour les formules inline et $$...$$ pour les blocs centrés).
3. Soyez précis, rigoureux et encourageant.
4. Vous avez accès à des outils pour calculer, planifier des rappels de révision et explorer l'environnement de l'étudiant.

${getSchedulePrompt({ date: new Date() })}`,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message"
      }),
      tools: {
        ...mcpTools,

        calculate: tool({
          description: "Effectue un calcul mathématique exact",
          inputSchema: z.object({
            expression: z.string().describe("L'expression mathématique à évaluer")
          }),
          execute: async ({ expression }) => {
            try {
              // Évaluation mathématique sécurisée basique
              const sanitized = expression.replace(/[^0-9+\-*/().^ ]/g, "");
              const res = Function(`"use strict"; return (${sanitized})`)();
              return { expression, result: res };
            } catch (err: any) {
              return { error: `Impossible d'évaluer l'expression: ${err?.message}` };
            }
          }
        }),

        scheduleTask: tool({
          description: "Planifie une session de révision ou un rappel pour l'étudiant",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Type de planification non valide";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Paramètre de planification manquant";
            try {
              this.schedule(input, "executeTask", description, {
                idempotent: true
              });
              return `Session planifiée avec succès : "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Erreur de planification : ${error}`;
            }
          }
        }),

        getScheduledTasks: tool({
          description: "Consulte la liste des sessions de révision planifiées",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "Aucune session planifiée pour le moment.";
          }
        }),

        cancelScheduledTask: tool({
          description: "Annule une tâche ou rappel planifié par son ID",
          inputSchema: z.object({
            taskId: z.string().describe("ID de la tâche à annuler")
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId);
              return `Tâche ${taskId} annulée.`;
            } catch (error) {
              return `Erreur lors de l'annulation : ${error}`;
            }
          }
        })
      },
      stopWhen: stepCountIs(15),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`[StudyCloud Agent] Exécution du rappel planifié : ${description}`);
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}

/**
 * Routeur HTTP du Worker Cloudflare
 * Gère à la fois les routes REST universelles (/api/ai/...) et l'orchestration des Agents (/agents/...)
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Gestion des requêtes préliminaires CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // 2. Health check
    if (url.pathname === "/api/ai/health" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "healthy",
          agent: "studycloud-agent",
          architecture: "Cloudflare Agents Starter (Durable Objects + SQLite)",
          models: [PRIMARY_MODEL, FALLBACK_MODEL],
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. API Création de modules pédagogiques (QCM, Vrai/Faux, Cartes Mentales, Résumés, Devoirs, Flashcards...)
    if (url.pathname === "/api/ai/creation" && request.method === "POST") {
      try {
        const body: any = await request.json().catch(() => ({}));
        const creation = await generateStudyCloudCreation(env, body);
        return new Response(JSON.stringify(creation), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err?.message || "Erreur lors de la génération du module pédagogique"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // 4. API Analyse approfondie de document
    if (url.pathname === "/api/ai/analyze" && request.method === "POST") {
      try {
        const body: any = await request.json().catch(() => ({}));
        const analysis = await analyzeStudyCloudDocument(env, body);
        return new Response(JSON.stringify(analysis), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err?.message || "Erreur lors de l'analyse du document"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // 5. API Causerie directe avec Delmas IA (Chat éphémère / Assistant)
    if ((url.pathname === "/api/ai/delmas-chat" || url.pathname === "/api/ai/chat") && request.method === "POST") {
      try {
        const body: any = await request.json().catch(() => ({}));
        const message = body.message || body.prompt || "Bonjour !";
        const history = Array.isArray(body.history) ? body.history : [];
        const docText = body.attachedFileContent || body.documentText || "";
        const workersai = createWorkersAI({ binding: env.AI });

        const system = `Vous êtes Delmas IA, le tuteur d'étude universitaire de StudyCloud.
Vous aidez l'étudiant à comprendre le cours avec des explications claires, méthodiques et pédagogiques.
${docText ? `DOCUMENT FOURNI PAR L'ÉTUDIANT :\n"""\n${docText.slice(0, 15000)}\n"""` : ""}`;

        const messages = [
          ...history.map((h: any) => ({ role: h.role === "user" ? "user" as const : "assistant" as const, content: h.content })),
          { role: "user" as const, content: message }
        ];

        const textResult = await generateText({
          model: workersai(PRIMARY_MODEL),
          system,
          messages,
          maxOutputTokens: 2000,
        });

        return new Response(
          JSON.stringify({
            success: true,
            response: textResult.text,
            chat_response: textResult.text,
            model: "Delmas IA (Cloudflare Agent 70B)"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (chatErr: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: chatErr?.message || "Erreur de communication avec Delmas IA"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // 6. Routage automatique du Cloudflare Agents SDK (WebSockets, SSE streaming, RPC /agents/*)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      // Injecter les en-têtes CORS si ce n'est pas un flux WebSocket
      const newHeaders = new Headers(agentResponse.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(agentResponse.body, {
        status: agentResponse.status,
        statusText: agentResponse.statusText,
        headers: newHeaders
      });
    }

    // 7. Route par défaut
    return new Response(
      JSON.stringify({ error: "Route non trouvée sur StudyCloud Agent" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
} satisfies ExportedHandler<Env>;
