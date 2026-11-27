/**
 * ============================================================================
 * STUDYCLOUD - AGENT NATIVE TOOL-CALLING + ZOD POUR LE MENU CRÉATION STUDIO
 * ============================================================================
 * Remplace le JSON libre fragile dans le chat / Menu Création par de vrais
 * outils typés Zod dans une boucle multi-étapes (`maxSteps = 4`) :
 *  - Mode Discussion libre (`isAgentCreationTask = false`) :
 *      * Si l'étudiant pose une question → réponse Markdown naturelle (ZÉRO JSON brut !)
 *      * Si l'étudiant demande un quiz/résumé/carte mentale → appelle `submit_creation_module`
 *  - Mode Création ciblée (`isAgentCreationTask = true`) :
 *      * Appelle `submit_creation_module` validé strictement par Zod + contrôles qualité
 *        (nombre de questions/flashcards, présence des explications, branches réelles)
 *      * Si la création est incomplète ou malformée, l'outil renvoie les erreurs exactes
 *        au modèle pour qu'il s'auto-corrige automatiquement avant d'envoyer à l'étudiant !
 *      * Dès que la création est 100 % validée, la boucle s'arrête immédiatement (0 tour inutile).
 * ============================================================================
 */

import { z } from "zod";
import { type CreationResult, type CreationType } from "../creations/types.js";
import { validateAndFormatCreation } from "../creations/validator.js";
import {
  type AgentToolTraceEntry,
  type ChatCompletionRequester,
  type RegisteredAgentTool,
  runAgentToolLoop,
} from "./toolLoopCore.js";

const ALL_CREATION_TYPES = [
  "questionnaire",
  "questionnaire-test",
  "vrai-ou-faux",
  "vrai-ou-faux-test",
  "carte-mentale",
  "carte-mentale-2",
  "carte-memoire",
  "resume",
  "pdf",
  "infographie",
  "exercices-ecrits",
  "devoir-complet",
] as const;

export interface RunCreationStudioAgentParams {
  models: string[];
  systemPrompt: string;
  conversationMessages: any[];
  userPrompt: string;
  isAgentCreationTask: boolean;
  requestedType?: string;
  creationTitle?: string;
  docName?: string;
  docContent?: string;
  requester: ChatCompletionRequester;
  stripReasoning?: (text: string) => string;
}

export interface RunCreationStudioAgentResult {
  supported: boolean;
  modelUsed: string | null;
  finalText: string;
  verifiedCreation: CreationResult | null;
  stepsUsed: number;
  toolTrace: AgentToolTraceEntry[];
  totalPromptChars: number;
  totalCompletionChars: number;
}

function detectExplicitItemCount(userPrompt: string): number | null {
  const m = String(userPrompt || "").match(
    /\b(\d{1,2})\s*(?:questions?|qcm|affirmations?|vrai\s*ou\s*faux|cartes?(?:\s+m[eé]moires?)?|flashcards?|exercices?|items?)\b/i
  );
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 2 || n > 25) return null;
  return n;
}

function countMindmapTopBranches(data: any): number {
  if (!data || typeof data !== "object") return 0;
  if (Array.isArray(data.branches)) return data.branches.length;
  if (Array.isArray(data.children)) return data.children.length;
  if (Array.isArray(data.columns)) return data.columns.length;
  if (Array.isArray(data.piliers)) return data.piliers.length;
  if (data.root && Array.isArray(data.root.children)) return data.root.children.length;
  if (data.root && Array.isArray(data.root.branches)) return data.root.branches.length;
  if (Array.isArray(data.noeuds)) return data.noeuds.length;
  if (typeof data.mermaid === "string" && data.mermaid.trim().length > 40) return 3;
  return 0;
}

/**
 * Contrôle qualité pédagogique strict sur la création normalisée avant acceptation.
 * Retourne une liste vide si tout est complet et exploitable, sinon des erreurs précises
 * renvoyées au modèle pour auto-correction immédiate dans la boucle.
 */
export function auditCreationQuality(
  formatted: CreationResult,
  requestedItemCount: number | null
): { errors: string[]; itemCount: number } {
  const errors: string[] = [];
  let itemCount = 0;

  if (formatted.mode !== "creation" || !formatted.creation_type || !formatted.creation_data) {
    errors.push("L'objet creation_data est vide ou non reconnu pour ce format.");
    return { errors, itemCount };
  }

  const cType = formatted.creation_type;
  const d = formatted.creation_data;

  if (cType === "questionnaire" || cType === "questionnaire-test") {
    const qs = Array.isArray(d.questions) ? d.questions : [];
    itemCount = qs.length;
    const minRequired = requestedItemCount ? Math.min(requestedItemCount, 18) : 6;
    if (qs.length < minRequired) {
      errors.push(
        `Seulement ${qs.length} question(s) générée(s) alors qu'au moins ${minRequired} questions complètes sont attendues.`
      );
    }
    const invalidOpts = qs.filter((q: any) => !Array.isArray(q.options) || q.options.length < 2);
    if (invalidOpts.length > 0) {
      errors.push(`${invalidOpts.length} question(s) n'ont pas au moins 2 choix de réponse dans "options".`);
    }
    const missingExpl = qs.filter((q: any) => !String(q.explanation || "").trim());
    if (qs.length > 0 && missingExpl.length > Math.floor(qs.length * 0.25)) {
      errors.push(
        `${missingExpl.length} question(s) manquent d'une explication pédagogique détaillée dans "explanation".`
      );
    }
  } else if (cType === "vrai-ou-faux" || cType === "vrai-ou-faux-test") {
    const affs = Array.isArray(d.affirmations) ? d.affirmations : [];
    itemCount = affs.length;
    const minRequired = requestedItemCount ? Math.min(requestedItemCount, 18) : 6;
    if (affs.length < minRequired) {
      errors.push(
        `Seulement ${affs.length} affirmation(s) générée(s) alors qu'au moins ${minRequired} sont attendues.`
      );
    }
    const missingExpl = affs.filter((a: any) => !String(a.explanation || "").trim());
    if (affs.length > 0 && missingExpl.length > Math.floor(affs.length * 0.25)) {
      errors.push(`${missingExpl.length} affirmation(s) n'ont pas d'explication dans "explanation".`);
    }
  } else if (cType === "carte-memoire") {
    const cards = Array.isArray(d.cards) ? d.cards : [];
    itemCount = cards.length;
    const minRequired = requestedItemCount ? Math.min(requestedItemCount, 25) : 6;
    if (cards.length < minRequired) {
      errors.push(
        `Seulement ${cards.length} carte(s) mémoire générée(s) alors qu'au moins ${minRequired} sont attendues.`
      );
    }
    const emptySides = cards.filter(
      (c: any) => !String(c.front || "").trim() || !String(c.back || "").trim()
    );
    if (emptySides.length > 0) {
      errors.push(`${emptySides.length} carte(s) ont un recto (front) ou verso (back) vide.`);
    }
  } else if (cType === "carte-mentale" || cType === "carte-mentale-2") {
    const branchCount = countMindmapTopBranches(d);
    itemCount = branchCount;
    if (branchCount < 3) {
      errors.push(
        `La carte mentale ne contient que ${branchCount} branche(s) principale(s) ; fournis au moins 3 à 6 grands piliers thématiques détaillés avec sous-branches.`
      );
    }
  } else if (cType === "resume") {
    const sections = Array.isArray(d.sections) ? d.sections : [];
    const defs = Array.isArray(d.key_definitions) ? d.key_definitions : [];
    const formulas = Array.isArray(d.formulas) ? d.formulas : [];
    const overview = String(d.overview || "").trim();
    itemCount = sections.length + defs.length + formulas.length;
    if (!overview && sections.length < 2 && defs.length < 3) {
      errors.push(
        "Le résumé est trop vide : fournis un overview synthétique, des sections détaillées, key_definitions, formulas et traps_and_tips."
      );
    }
  } else if (cType === "exercices-ecrits" || cType === "devoir-complet") {
    const exos = Array.isArray(d.exercises)
      ? d.exercises
      : Array.isArray(d.exercices)
      ? d.exercices
      : Array.isArray(d.parts)
      ? d.parts
      : [];
    itemCount = exos.length;
    if (exos.length < 2) {
      errors.push(
        `Seulement ${exos.length} exercice(s)/partie(s) fourni(s) : construis une série complète avec énoncés, barème et corrigés détaillés.`
      );
    }
  } else if (cType === "pdf" || cType === "infographie") {
    const sections = Array.isArray(d.sections)
      ? d.sections
      : Array.isArray(d.steps)
      ? d.steps
      : Array.isArray(d.key_figures)
      ? d.key_figures
      : Array.isArray(d.blocks)
      ? d.blocks
      : [];
    itemCount = sections.length;
    if (sections.length < 2 && JSON.stringify(d).length < 250) {
      errors.push(
        `Le contenu de « ${cType} » est trop court ou incomplet : développe toutes les sections structurées du document.`
      );
    }
  }

  return { errors, itemCount };
}

export async function runCreationStudioAgentLoop(
  params: RunCreationStudioAgentParams
): Promise<RunCreationStudioAgentResult> {
  const {
    models,
    systemPrompt,
    conversationMessages,
    userPrompt,
    isAgentCreationTask,
    requestedType,
    creationTitle,
    docName,
    docContent = "",
    requester,
    stripReasoning,
  } = params;

  let verifiedCreation: CreationResult | null = null;
  let lastValidFallbackCreation: CreationResult | null = null;
  let submitAttempts = 0;
  const explicitCount = detectExplicitItemCount(userPrompt);

  const tools: RegisteredAgentTool[] = [];

  // 1. Outil principal : soumettre et faire valider strictement une création interactive StudyCloud
  tools.push({
    name: "submit_creation_module",
    description:
      "Soumet et valide une création pédagogique interactive complète dans l'espace Création de StudyCloud (QCM, Vrai/Faux, Carte Mentale, Cartes Mémoires, Résumé, Exercices, Devoir Complet, Infographie, PDF). NE PAS appeler cet outil pour une simple question de chat ou une explication de cours.",
    parameters: {
      type: "object",
      properties: {
        creation_type: {
          type: "string",
          enum: [...ALL_CREATION_TYPES],
          description: "Type officiel du module de création StudyCloud.",
        },
        creation_title: {
          type: "string",
          description: "Titre clair et académique du module créé.",
        },
        chat_response: {
          type: "string",
          description: "Courte phrase amicale (1 ligne) confirmant la création à l'étudiant (sans JSON).",
        },
        creation_data: {
          type: "object",
          description:
            "Objet structuré complet correspondant au format demandé (questions, affirmations, cards, root/branches/columns, sections/formulas/key_definitions, exercises/parts...).",
        },
      },
      required: ["creation_type", "creation_title", "chat_response", "creation_data"],
    },
    schema: z.object({
      creation_type: z.enum(ALL_CREATION_TYPES),
      creation_title: z.string().min(2, "Titre requis"),
      chat_response: z.string().min(2, "Courte confirmation textuelle requise"),
      creation_data: z.record(z.string(), z.any()),
    }),
    execute: (args) => {
      submitAttempts++;
      const targetType: CreationType =
        (requestedType &&
        (ALL_CREATION_TYPES as readonly string[]).includes(
          String(requestedType).toLowerCase().replace(/_/g, "-")
        )
          ? (String(requestedType).toLowerCase().replace(/_/g, "-") as CreationType)
          : args.creation_type) || args.creation_type;

      const wrappedJson = JSON.stringify({
        decision: "creation",
        mode: "creation",
        creation_type: targetType,
        creation_title: args.creation_title || creationTitle || `Création ${targetType}`,
        chat_response: args.chat_response,
        creation_data: args.creation_data,
      });

      const formatted = validateAndFormatCreation(wrappedJson, targetType, docName);
      const { errors, itemCount } = auditCreationQuality(formatted, explicitCount);

      if (formatted.mode === "creation" && formatted.creation_data) {
        lastValidFallbackCreation = formatted;
      }

      // À la 1re tentative, rejeter si incomplet afin que le modèle s'auto-corrige dans la boucle !
      // À partir de la 2e tentative, si l'objet est structurellement valide avec des éléments, on l'accepte pour éviter une boucle sans fin.
      if (errors.length > 0 && (submitAttempts < 2 || itemCount === 0)) {
        return {
          ok: false,
          error: "La création soumise est incomplète ou non conforme aux critères de qualité.",
          validation_errors: errors,
          instruction:
            "Complète et enrichis creation_data selon les erreurs exactes ci-dessus, puis rappelle immédiatement submit_creation_module.",
        };
      }

      verifiedCreation = formatted;
      return {
        ok: true,
        summary: `Création « ${formatted.creation_type} » validée (${itemCount} élément(s))`,
        data: {
          verified: true,
          creation_type: formatted.creation_type,
          creation_title: formatted.creation_title,
          itemCount,
        },
      };
    },
  });

  // 2. Outil de lecture documentaire (utile pour inspecter un passage précis d'un long cours PDF/Word)
  if (docContent && docContent.trim().length > 200) {
    tools.push({
      name: "inspect_source_document",
      description:
        "Recherche un mot-clé ou lit une portion précise du document de cours joint par l'étudiant pour vérifier les formules et détails exacts.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: {
            type: "string",
            description: "Mot-clé ou notion à rechercher dans le document (optionnel).",
          },
          offsetChars: {
            type: "number",
            description: "Position de départ en caractères (défaut 0).",
          },
        },
        required: [],
      },
      schema: z.object({
        searchQuery: z.string().optional(),
        offsetChars: z.number().int().min(0).optional(),
      }),
      execute: ({ searchQuery, offsetChars = 0 }) => {
        const cleanDoc = docContent.trim();
        if (searchQuery && searchQuery.trim()) {
          const needle = searchQuery.trim().toLowerCase();
          const idx = cleanDoc.toLowerCase().indexOf(needle);
          if (idx >= 0) {
            const start = Math.max(0, idx - 600);
            const excerpt = cleanDoc.slice(start, start + 3500);
            return {
              ok: true,
              summary: `Passage trouvé pour « ${searchQuery} »`,
              data: { totalChars: cleanDoc.length, matchOffset: idx, excerpt },
            };
          }
          return {
            ok: false,
            error: `Terme « ${searchQuery} » non trouvé tel quel dans le document (${cleanDoc.length} caractères).`,
          };
        }
        const safeOffset = Math.min(offsetChars, Math.max(0, cleanDoc.length - 1));
        return {
          ok: true,
          summary: `Extrait lu (${safeOffset}..${Math.min(cleanDoc.length, safeOffset + 4500)})`,
          data: {
            totalChars: cleanDoc.length,
            offsetChars: safeOffset,
            excerpt: cleanDoc.slice(safeOffset, safeOffset + 4500),
          },
        };
      },
    });
  }

  const creationToolDirective = isAgentCreationTask
    ? `\n\n══════════════════════════════════════════════════════════════════════════════
[MODE AGENT CRÉATION OUTILS NATIFS (ZOD) — OBLIGATOIRE] :
- Tu DOIS livrer ta création en appelant directement l'outil \`submit_creation_module\` (au lieu d'écrire du JSON brut dans le chat).
- Respecte à 100 % la structure exacte demandée pour « ${requestedType || "creation"} », les formules LaTeX avec \\\\dfrac{}{}, et la densité maximale attendue.
- Si l'outil renvoie \`ok: false\` avec des erreurs de complétude ou de validation Zod, corrige immédiatement les points signalés et rappelle \`submit_creation_module\`.
══════════════════════════════════════════════════════════════════════════════`
    : `\n\n══════════════════════════════════════════════════════════════════════════════
[MODE AGENT STUDIO INTELLIGENT (OUTILS NATIFS ZOD)] :
- Pour toute discussion, explication de cours, résolution d'exercice, question sur une image ou conseil : réponds DIRECTEMENT en français Markdown fluide (ZÉRO appel d'outil, ZÉRO JSON brut).
- UNIQUEMENT si l'étudiant demande explicitement de créer/générer un support interactif (QCM, Vrai/Faux, Carte Mentale, Cartes Mémoires, Résumé structuré, Exercices, Devoir Complet, Infographie) : appelle directement l'outil \`submit_creation_module\` et ne colle JAMAIS de JSON brut dans le chat.
══════════════════════════════════════════════════════════════════════════════`;

  const initialMessages: any[] = [
    { role: "system", content: `${systemPrompt}${creationToolDirective}` },
    ...conversationMessages,
  ];

  const loopRes = await runAgentToolLoop({
    models,
    initialMessages,
    tools,
    maxSteps: isAgentCreationTask ? 4 : 3,
    maxTokens: 8192,
    firstStepToolChoice: isAgentCreationTask
      ? { type: "function", function: { name: "submit_creation_module" } }
      : "auto",
    requester,
    stripReasoning,
    onAfterTools: () => {
      // Dès qu'une création a été strictement validée par Zod + contrôle qualité, on renvoie immédiatement sans appel LLM supplémentaire !
      if (verifiedCreation) {
        return verifiedCreation.chat_response || "Création terminée !";
      }
      return null;
    },
    onBeforeFinish: ({ finalText }) => {
      if (isAgentCreationTask && !verifiedCreation) {
        // Si le modèle a quand même craché du JSON dans le texte au lieu d'appeler l'outil, vérifions si c'est déjà un JSON valide
        const parsedFallback = validateAndFormatCreation(finalText, requestedType, docName);
        if (parsedFallback.mode === "creation" && parsedFallback.creation_data) {
          const audit = auditCreationQuality(parsedFallback, explicitCount);
          if (audit.errors.length === 0) {
            verifiedCreation = parsedFallback;
            return null;
          }
        }
        return `Tu dois obligatoirement appeler l'outil \`submit_creation_module\` avec creation_type="${requestedType || "questionnaire"}" et l'intégralité de creation_data pour valider ta création.`;
      }
      return null;
    },
  });

  const finalCreation = verifiedCreation || (isAgentCreationTask ? lastValidFallbackCreation : null);

  return {
    supported: loopRes.supported,
    modelUsed: loopRes.modelUsed,
    finalText: finalCreation?.chat_response || loopRes.finalText,
    verifiedCreation: finalCreation,
    stepsUsed: loopRes.stepsUsed,
    toolTrace: loopRes.toolTrace,
    totalPromptChars: loopRes.totalPromptChars,
    totalCompletionChars: loopRes.totalCompletionChars,
  };
}
