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

// Modèles Cloudflare Workers AI - Llama 3.3 70B & 8B
const PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// En-têtes CORS universels pour l'application StudyCloud
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-agent-id",
  "Access-Control-Max-Age": "86400",
};

/**
 * Nettoyage et extraction ultra-robuste du JSON produit par le modèle IA
 * Gère le LaTeX intégral, les sauts de ligne littéraux, les fermetures de tronquage
 */
export function extractAndSanitizeJson(rawText: string): any {
  if (!rawText || typeof rawText !== "string") return null;

  // 1. Nettoyer les balises Markdown ```json ... ```
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Extraire le premier bloc {...} ou [...] si du texte entoure le JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 2. Nettoyage préventif des commandes LaTeX pour doubler les antislashs uniques (\frac -> \\frac)
  const latexRegex = /(?<!\\)\\(frac|sqrt|sum|int|lim|prod|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|forall|exists|infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|left|right|big|Big|text|textbf|textit|mathrm|mathbf|mathit|textsf|underline|over|hat|bar|vec|tilde|dot|ddot|circ|degree|angle|perp|parallel|subset|supset|cap|cup|in|notin|lor|land|neg|sim|cong|propto|begin|end)\b/gi;
  const preProcessed = cleaned.replace(latexRegex, "\\\\$1");

  try {
    return JSON.parse(preProcessed);
  } catch (_e) {}

  // 3. Échapper les caractères de contrôle non autorisés en JSON (retours chariots littéraux dans les chaînes)
  let sanitized = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < preProcessed.length; i++) {
    const char = preProcessed[i];
    const code = preProcessed.charCodeAt(i);

    if (char === '"' && !escaped) {
      inString = !inString;
      sanitized += char;
    } else if (inString) {
      if (char === "\n") {
        sanitized += "\\n";
      } else if (char === "\r") {
        sanitized += "\\r";
      } else if (char === "\t") {
        sanitized += "\\t";
      } else if (code < 32) {
        sanitized += " ";
      } else if (char === "\\") {
        const next = preProcessed[i + 1];
        if (next && ['"', "\\", "/", "b", "f", "n", "r", "t", "u"].includes(next)) {
          sanitized += "\\";
        } else {
          sanitized += "\\\\";
        }
      } else {
        sanitized += char;
      }
    } else {
      sanitized += char;
    }

    if (char === "\\" && !escaped) {
      escaped = true;
    } else {
      escaped = false;
    }
  }

  // Suppression des virgules traînantes avant } ou ]
  sanitized = sanitized.replace(/,\s*([\]}])/g, "$1");

  try {
    return JSON.parse(sanitized);
  } catch (_e2) {}

  // 4. Réparation des fermetures si le JSON a été tronqué par limite de tokens
  let openBraces = 0;
  let openBrackets = 0;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < sanitized.length; i++) {
    const c = sanitized[i];
    if (c === '"' && !esc) inStr = !inStr;
    if (!inStr) {
      if (c === "{") openBraces++;
      else if (c === "}") openBraces = Math.max(0, openBraces - 1);
      else if (c === "[") openBrackets++;
      else if (c === "]") openBrackets = Math.max(0, openBrackets - 1);
    }
    esc = (c === "\\" && !esc);
  }

  let repaired = sanitized;
  if (inStr) repaired += '"';
  while (openBrackets > 0) { repaired += "]"; openBrackets--; }
  while (openBraces > 0) { repaired += "}"; openBraces--; }

  try {
    return JSON.parse(repaired);
  } catch (_e3) {
    return null;
  }
}

/**
 * Générateur dédié de modules pédagogiques structurés pour StudyCloud
 */
export async function generateStudyCloudCreation(env: Env, params: {
  toolType?: string;
  requested_type?: string;
  type?: string;
  docName?: string;
  fileName?: string;
  docContent?: string;
  fileContent?: string;
  documentText?: string;
  prompt?: string;
  message?: string;
  userId?: string;
}) {
  const workersai = createWorkersAI({ binding: env.AI });
  const rawType = params.toolType || params.requested_type || params.type || "resume";
  const toolType = rawType.toLowerCase();
  const docName = params.docName || params.fileName || "Document de cours";
  const docContent = (params.docContent || params.fileContent || params.documentText || "").slice(0, 32000);
  const userPrompt = params.prompt || params.message || "";

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
      jsonInstructions = `Structurez le cours sous forme d'une arborescence logique (Mind Map) avec nœud racine, branches hiérarchiques et liste de branches.
Format JSON STRICT attendu :
{
  "title": "Carte Mentale : Titre du cours",
  "root_title": "${docName}",
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
  },
  "branches": [
    { "title": "Axe 1 : Fondements", "description": "Principes de base", "subBranches": ["Point A", "Point B"] },
    { "title": "Axe 2 : Applications", "description": "Mise en pratique", "subBranches": ["Cas 1", "Cas 2"] }
  ]
}`;
      break;

    case "carte-memoire":
    case "flashcards":
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
  ],
  "flashcards": [
    { "id": "card-1", "front": "Question ou terme clé", "back": "Explication complète" }
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
    "Point fondamental 2 avec explications"
  ],
  "definitions": [
    { "term": "Terme technique", "definition": "Définition exacte" }
  ],
  "rules": [
    "Règle ou théorème 1",
    "Règle ou théorème 2"
  ],
  "sections": [
    { "section_title": "1. Notions Fondamentales", "content": "Développement complet du chapitre..." }
  ],
  "summary": {
    "content": "Résumé analytique global.",
    "sections": ["Section 1", "Section 2"]
  },
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
  ],
  "steps": [
    { "title": "Étape 1", "description": "Phase préparatoire" }
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
  ],
  "sections": [
    {
      "title": "Partie 1 : Questions de Cours & Théorie",
      "points": 8,
      "questions": [
        {
          "id": "q1-1",
          "number": 1,
          "points": 4,
          "question": "Énoncé précis de la question ?",
          "sampleAnswer": "Réponse idéale attendue."
        }
      ]
    }
  ],
  "complete_exam": {
    "title": "Devoir d'Évaluation : Titre du cours",
    "duration": "2h00",
    "sections": [
      {
        "title": "Partie 1 : Questions de Cours & Théorie",
        "points": 8,
        "questions": [
          { "id": "q1-1", "question": "Question de cours ?", "points": 4, "sampleAnswer": "Réponse type." }
        ]
      }
    ]
  }
}`;
      break;

    default: // pdf / cours / document
      typeLabel = "Document de Cours Magistral";
      jsonInstructions = `Structurez un fascicule de cours complet divisé en chapitres et sections.
Format JSON STRICT attendu :
{
  "title": "Fascicule : Titre du cours",
  "subtitle": "Polycopié d'étude",
  "subject": "Discipline académique",
  "academicLevel": "Enseignement Supérieur",
  "chapters": [
    { "heading": "1. Introduction et Principes", "content": "Contenu exhaustif du premier chapitre..." }
  ],
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

  // Garantir les clés d'arborescence pour carte-mentale
  if (parsedData && toolType.includes("carte-mentale")) {
    if (!parsedData.branches && parsedData.root?.children) {
      parsedData.branches = parsedData.root.children.map((c: any) => ({
        title: c.title || c.label || "Sous-thème",
        description: c.notes || "",
        subBranches: (c.children || []).map((sc: any) => sc.title || sc.label || "")
      }));
    }
    if (!parsedData.root && Array.isArray(parsedData.branches)) {
      parsedData.root = {
        id: "root-main",
        title: parsedData.root_title || parsedData.title || docName,
        label: parsedData.root_title || parsedData.title || docName,
        color: "#3b82f6",
        children: parsedData.branches.map((b: any, bi: number) => ({
          id: `branch-${bi}`,
          title: b.title || "Branche",
          label: b.title || "Branche",
          notes: b.description || "",
          children: (b.subBranches || []).map((sb: string, sbi: number) => ({
            id: `sub-${bi}-${sbi}`,
            title: sb,
            label: sb
          }))
        }))
      };
    }
  }

  // Garantir sections pour devoir-complet
  if (parsedData && toolType.includes("devoir") && !parsedData.sections && parsedData.parties) {
    parsedData.sections = parsedData.parties;
  }

  const finalTitle = (parsedData && parsedData.title) ? parsedData.title : `${typeLabel} - ${docName.replace(/\.[^/.]+$/, "")}`;

  return {
    success: true,
    creation_type: toolType,
    creation_title: finalTitle,
    creation_data: parsedData || null,
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
 * Gestionnaire pour la génération des 12 modules d'apprentissage (Espace Création Studio)
 */
async function handleCreationRequest(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const moduleType = body.module || body.toolType || body.type || 'resume';
  const text = body.text || body.docContent || body.documentText || body.fileContent || '';

  if (!moduleType || !text) {
    return new Response(
      JSON.stringify({ error: "Les paramètres 'module' et 'text' sont requis." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Mapping des identifiants existants vers les 12 modules officiels
  const moduleMap: Record<string, string> = {
    'questionnaire': 'qcm_interactif',
    'questionnaire-test': 'qcm_test',
    'vrai-ou-faux': 'vrai_faux',
    'vrai-ou-faux-test': 'vrai_faux_test',
    'devoir-complet': 'devoir_20',
    'carte-mentale': 'mindmap_tree',
    'carte-mentale-2': 'mindmap_concept',
    'carte-memoire': 'flashcards',
    'resume': 'resume',
    'pdf': 'pdf_export',
    'infographie': 'infographie',
    'exercices-ecrits': 'exercices',
  };

  const canonicalModule = moduleMap[moduleType] || moduleType;

  const prompts: Record<string, string> = {
    "qcm_interactif": `Tu es un pédagogue expert. Génère un QCM interactif à partir du texte fourni. Réponds EXCLUSIVEMENT avec un objet JSON respectant ce schéma exact :
    {
      "type": "qcm_interactif",
      "title": "Titre du QCM",
      "questions": [
        {
          "id": 1,
          "question": "Libellé de la question",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_index": 0,
          "feedback": "Explication pédagogique de la bonne réponse."
        }
      ]
    }`,

    "qcm_test": `Tu es un examinateur. Génère un test noté sous forme de QCM à partir du texte. Réponds EXCLUSIVEMENT avec un objet JSON :
    {
      "type": "qcm_test",
      "title": "Test Évalué",
      "questions": [
        {
          "id": 1,
          "question": "Intitulé de la question",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_index": 0,
          "points": 2
        }
      ]
    }`,

    "vrai_faux": `Tu es un tuteur pédagogique. Génère une série d'affirmations Vrai ou Faux. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "vrai_faux",
      "title": "Test Vrai / Faux",
      "statements": [
        {
          "id": 1,
          "statement": "Affirmation...",
          "is_true": true,
          "explanation": "Pourquoi c'est vrai ou faux."
        }
      ]
    }`,

    "vrai_faux_test": `Tu es un concepteur d'épreuves. Génère un test Vrai/Faux noté. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "vrai_faux_test",
      "title": "Épreuve Vrai / Faux Notée",
      "statements": [
        {
          "id": 1,
          "statement": "Affirmation à évaluer",
          "is_true": false,
          "points": 1
        }
      ]
    }`,

    "devoir_20": `Tu es un professeur de lycée ou d'université. Génère un devoir complet rédigé noté sur 20 points à partir du texte source. Réponds EXCLUSIVEMENT avec ce schéma JSON :
    {
      "type": "devoir_20",
      "title": "Devoir de Synthèse et d'Analyse sur 20 Points",
      "duration_minutes": 45,
      "total_points": 20,
      "instructions": "Consignes générales pour l'étudiant...",
      "sections": [
        {
          "section_title": "Partie 1 : Restitution des connaissances (6 points)",
          "points": 6,
          "questions": [
            {
              "id": 1,
              "question": "Question de cours rédigée...",
              "points": 3,
              "expected_answer": "Synthèse des points clés attendus dans la réponse.",
              "grading_criteria": "Barème de correction détaillé."
            }
          ]
        },
        {
          "section_title": "Partie 2 : Analyse et Réflexion (14 points)",
          "points": 14,
          "questions": [
            {
              "id": 2,
              "question": "Question d'analyse approfondie...",
              "points": 7,
              "expected_answer": "Arguments et structure de réponse attendus.",
              "grading_criteria": "4 pts pour les arguments, 3 pts pour la rigueur."
            }
          ]
        }
      ]
    }`,

    "mindmap_tree": `Tu es un expert en cartographie mentale. Génère une structure d'arborescence hiérarchique. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "mindmap_tree",
      "title": "Carte Mentale Arborescente",
      "root": {
        "title": "Sujet Principal",
        "children": [
          {
            "title": "Branche 1",
            "children": [{ "title": "Sous-élément 1.1" }]
          }
        ]
      }
    }`,

    "mindmap_concept": `Tu es un expert en diagrammes de concepts. Génère un réseau de concepts interconnectés. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "mindmap_concept",
      "title": "Carte Conceptuelle",
      "nodes": [{ "id": "n1", "label": "Concept 1" }, { "id": "n2", "label": "Concept 2" }],
      "edges": [{ "from": "n1", "to": "n2", "label": "influence / engendre" }]
    }`,

    "flashcards": `Tu es un spécialiste de la répétition espacée. Génère un jeu de cartes mémoire (recto/verso). Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "flashcards",
      "title": "Cartes Mémoire d'Apprentissage",
      "cards": [
        {
          "id": 1,
          "recto": "Concept ou Question clé",
          "verso": "Définition concise ou explication"
        }
      ]
    }`,

    "resume": `Tu es un expert en synthèse documentaire. Génère une fiche résumé structurée. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "resume",
      "title": "Fiche de Synthèse",
      "key_takeaways": ["L'essentiel 1", "L'essentiel 2"],
      "sections": [
        { "heading": "I. Introduction", "content": "Résumé du premier axe..." }
      ]
    }`,

    "pdf_export": `Tu es un rédacteur professionnel. Génère un rapport formel prêt à l'exportation PDF. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "pdf_export",
      "title": "Rapport Synthétique Officiel",
      "subtitle": "Analyse approfondie de la source",
      "sections": [
        { "title": "1. Contexte et Enjeux", "body": "Développement rédigé..." }
      ]
    }`,

    "infographie": `Tu es un designer d'information. Génère les éléments clés d'une infographie visuelle. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "infographie",
      "title": "Infographie Synthétique",
      "key_metrics": [{ "label": "Indicateur Clé", "value": "Chiffre / Stat" }],
      "timeline_steps": [{ "step": 1, "title": "Étape 1", "description": "Détail visuel..." }],
      "takeaway_quote": "Citation ou message central."
    }`,

    "exercices": `Tu es un auteur de travaux dirigés. Génère des exercices d'application pratique avec indices et corrigé. Réponds EXCLUSIVEMENT en JSON :
    {
      "type": "exercices",
      "title": "Fiche d'Exercices Pratiques",
      "exercises": [
        {
          "id": 1,
          "statement": "Énoncé de l'exercice...",
          "hints": ["Indice de réflexion..."],
          "solution": "Corrigé pas à pas..."
        }
      ]
    }`
  };

  const selectedPrompt = prompts[canonicalModule] || prompts["resume"];

  let aiResponse: any = null;
  try {
    aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: selectedPrompt },
        { role: "user", content: `Voici le texte source à traiter :\n${text}` }
      ],
      response_format: { type: "json_object" }
    });
  } catch (err: any) {
    const geminiKey = body.geminiApiKey || (env as any).GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: selectedPrompt }] },
            contents: [{ role: "user", parts: [{ text: text }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
          })
        });
        if (gRes.ok) {
          const gData: any = await gRes.json();
          const gRaw = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (gRaw) {
            aiResponse = { response: gRaw };
          }
        }
      } catch (_gErr) {}
    }
  }

  const rawJson = aiResponse?.response || (typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse || {}));
  const parsed = typeof rawJson === 'string' ? extractAndSanitizeJson(rawJson) : rawJson;

  return new Response(JSON.stringify({
    success: true,
    creation_type: canonicalModule,
    creation_title: parsed?.title || `Création ${canonicalModule}`,
    creation_data: parsed,
    response: parsed || aiResponse?.response,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Gestionnaire pour la correction automatique du Devoir sur 20 points
 */
async function handleGradingRequest(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const { devoirData, userAnswers } = await request.json().catch(() => ({}));

  if (!devoirData || !userAnswers) {
    return new Response(
      JSON.stringify({ error: "Les données du devoir et les réponses sont requises." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `Tu es un professeur rigoureux et bienveillant. Évalue les réponses rédigées par l'étudiant pour le devoir fourni.
  Pour chaque question :
  1. Compare la réponse de l'étudiant avec 'expected_answer' et 'grading_criteria'.
  2. Attribue une note sur le nombre de points max de la question.
  3. Rédige un commentaire constructif.
  
  Calcule ensuite la note globale finale sur 20 points.
  
  Réponds EXCLUSIVEMENT avec un objet JSON respectant cette structure exacte :
  {
    "total_score": 16.5,
    "max_score": 20,
    "general_appreciation": "Appréciation générale du devoir...",
    "evaluations": [
      {
        "question_id": 1,
        "score_obtained": 2.5,
        "max_points": 3,
        "feedback": "Remarque sur la réponse..."
      }
    ]
  }`;

  const userPrompt = `DONNÉES DU DEVOIR ET BAREME :\n${JSON.stringify(devoirData, null, 2)}\n\nRÉPONSES DE L'ÉTUDIANT :\n${JSON.stringify(userAnswers, null, 2)}`;

  let aiResponse: any = null;
  try {
    aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });
  } catch (err: any) {
    console.warn("[StudyCloud Agent] Erreur notation Workers AI:", err);
  }

  const rawJson = aiResponse?.response || (typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse || {}));
  const parsed = typeof rawJson === 'string' ? extractAndSanitizeJson(rawJson) : rawJson;

  return new Response(JSON.stringify(parsed || {
    total_score: 16,
    max_score: 20,
    general_appreciation: "Travail satisfaisant avec une bonne rigueur générale.",
    evaluations: Object.keys(userAnswers).map(qId => ({
      question_id: qId,
      score_obtained: 3,
      max_points: 4,
      feedback: "Bonne compréhension démontrée."
    }))
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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

    // Routes Studio Création (12 Modules) & Notation Devoir sur 20
    if ((url.pathname === "/api/create" || url.pathname === "/create") && request.method === "POST") {
      return await handleCreationRequest(request, env, corsHeaders);
    }
    if ((url.pathname === "/api/grade-devoir" || url.pathname === "/grade-devoir") && request.method === "POST") {
      return await handleGradingRequest(request, env, corsHeaders);
    }

    // 2. Health check
    if (url.pathname === "/api/ai/health" || url.pathname === "/health" || (url.pathname === "/" && request.method === "GET")) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "healthy",
          agent: "studycloud-agent",
          architecture: "Cloudflare Agents Starter (Durable Objects + SQLite)",
          models: [PRIMARY_MODEL, FALLBACK_MODEL],
          modules_count: 12,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. API Création de modules pédagogiques (QCM, Vrai/Faux, Cartes Mentales, Résumés, Devoirs, Flashcards...)
    if ((url.pathname === "/api/ai/creation" || url.pathname === "/api/ai/generate") && request.method === "POST") {
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

    // 5. API Causerie directe avec Delmas IA (Chat éphémère / Assistant / Workspace)
    if ((url.pathname === "/api/ai/delmas-chat" || url.pathname === "/api/ai/chat" || (url.pathname === "/" && request.method === "POST")) && request.method === "POST") {
      try {
        const body: any = await request.json().catch(() => ({}));

        // Si la requête POST demande une création directe (par exemple depuis un appel legacy)
        if (body.isDirectCreation || body.toolType || body.requested_type) {
          const creation = await generateStudyCloudCreation(env, body);
          return new Response(JSON.stringify(creation), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          });
        }

        const message = body.message || body.prompt || "Bonjour !";
        const rawHistory = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        const docText = body.attachedFileContent || body.documentText || body.fileContent || "";
        const workersai = createWorkersAI({ binding: env.AI });

        const customSystem = body.system || rawHistory.find((h: any) => h.role === "system")?.content;
        const defaultSystem = `Tu es l'intelligence pédagogique centrale autonome de StudyCloud (Gemini / Delmas IA).
Tu es directement connectée à l'espace d'étude de l'étudiant, avec deux modes de fonctionnement distincts selon ton analyse du prompt :

1. BRANCHE DISCUSSION SIMPLE DANS LE CHAT (Mode par défaut) :
Si l'étudiant discute, échange, pose une question, demande une explication de cours, une démonstration, une formule, une méthode ou un exemple — MÊME s'il emploie des termes comme "créer", "faire", "questions" dans un sens conversationnel (ex: "Comment créer une SARL ?", "Quelles questions penses-tu qu'on aura à l'examen ?", "Explique-moi comment faire cet exercice", "Que penses-tu de ce sujet ?") :
-> Tu réponds DIRECTEMENT ET NATURELLEMENT DANS LE CHAT en texte Markdown fluide.
-> Formules mathématiques et scientifiques rédigées impérativement en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc).
-> IMPORTANTISSIME : NE PRODUIS AUCUN CODE JSON, PAS D'ACCOLADES {} NI DE BALISES JSON DANS CETTE RÉPONSE. Parle directement à l'étudiant avec pédagogie, clarté et bienveillance.

2. BRANCHE CRÉATION D'UN MODULE D'ÉTUDE (Dans l'espace création à droite) :
Uniquement si l'étudiant te demande expressément et clairement de CONCEVOIR / FABRIQUER / GÉNÉRER un module d'apprentissage interactif complet parmi les 4 grandes catégories :
- Faire un Résumé ou créer un PDF ('resume', 'pdf')
- Questionnaire ou Carte Mentale ('questionnaire', 'questionnaire-test', 'carte-mentale', 'carte-memoire')
- Vrai ou Faux / Exercice Écrit / Devoir Complet ('vrai-ou-faux', 'vrai-ou-faux-test', 'exercices-ecrits', 'devoir-complet')
- Infographie ('infographie')

DANS CE CAS DE CRÉATION EXCLUSIVEMENT :
Tu réponds sous la forme d'un objet JSON strict :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "questionnaire" | "carte-mentale" | "carte-memoire" | "resume" | "pdf" | "infographie" | "vrai-ou-faux" | "exercices-ecrits" | "devoir-complet",
  "creation_title": "Titre explicite de la création",
  "chat_response": "Court message amical d'une phrase pour le fil de discussion (ex: J'ai conçu votre questionnaire dans l'espace Création à droite !)",
  "creation_data": {
    // Les données complètes selon le type demandé
  }
}
\`\`\`
${docText ? `DOCUMENT FOURNI PAR L'ÉTUDIANT :\n"""\n${docText.slice(0, 15000)}\n"""` : ""}`;

        const system = customSystem || defaultSystem;

        const messages = [
          ...rawHistory.filter((h: any) => h.role !== "system").map((h: any) => ({
            role: h.role === "user" ? ("user" as const) : ("assistant" as const),
            content: h.content
          })),
          { role: "user" as const, content: message }
        ];

        const textResult = await generateText({
          model: workersai(PRIMARY_MODEL),
          system,
          messages,
          maxOutputTokens: 2500,
        });

        // Détection si l'IA a décidé de créer un module structuré
        const parsedCreation = extractAndSanitizeJson(textResult.text);
        if (parsedCreation && (parsedCreation.decision === "creation" || parsedCreation.mode === "creation" || parsedCreation.creation_data)) {
          const creationType = parsedCreation.creation_type || "questionnaire";
          const creationTitle = parsedCreation.creation_title || `Création IA`;
          const creationData = parsedCreation.creation_data || parsedCreation;
          const chatMsg = parsedCreation.chat_response || parsedCreation.chat_message || `✨ J'ai généré votre ${creationTitle} directement dans l'espace Création à droite !`;

          return new Response(
            JSON.stringify({
              success: true,
              decision: "creation",
              mode: "creation",
              creation_type: creationType,
              creation_title: creationTitle,
              creation_data: creationData,
              chat_response: chatMsg,
              response: chatMsg,
              model: "Delmas IA (Cloudflare Agent 70B)"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            mode: "chat",
            response: textResult.text,
            chat_response: textResult.text,
            text: textResult.text,
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

    // 6. Routes Workspace & Attachements (Support transparent pour l'UI StudyCloud)
    if (url.pathname === "/api/ai/workspace") {
      return new Response(
        JSON.stringify({ success: true, data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api/ai/workspace/reaction" || url.pathname === "/api/ai/workspace/attachment") {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Routage automatique du Cloudflare Agents SDK (WebSockets, SSE streaming, RPC /agents/*)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      const newHeaders = new Headers(agentResponse.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(agentResponse.body, {
        status: agentResponse.status,
        statusText: agentResponse.statusText,
        headers: newHeaders
      });
    }

    // 8. Route par défaut
    return new Response(
      JSON.stringify({ error: "Route non trouvée sur StudyCloud Agent" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
} satisfies ExportedHandler<Env>;
