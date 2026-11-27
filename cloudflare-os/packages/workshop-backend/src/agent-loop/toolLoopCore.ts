/**
 * ============================================================================
 * STUDYCLOUD - MOTEUR DE BOUCLE AGENT NATIVE (TOOL CALLING + ZOD + AUTO-CORRECTION)
 * ============================================================================
 * Orchestre une vraie boucle multi-étapes (maxSteps) sur l'API OpenAI-compatible
 * de Cloudflare Workers AI (Kimi K2.7 Code, Kimi K2.5, Llama 3.3, DeepSeek, etc.)
 * ou OpenAI :
 *   1. Déclare des outils typés (schéma JSON OpenAI + validation stricte Zod)
 *   2. Valide chaque appel d'outil avec Zod avant exécution
 *   3. Renvoie les erreurs de validation ou d'incomplétude au modèle (role: "tool")
 *      pour qu'il s'auto-corrige dans la boucle avant de répondre à l'utilisateur
 *   4. Baisse gracieusement en repli classique (`supported: false`) si un modèle
 *      refuse le paramètre `tools`.
 * ============================================================================
 */

import { type z } from "zod";
import { safeJsonParse } from "../creations/validator.js";

export interface OpenAiToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AgentToolExecutionResult {
  ok: boolean;
  summary?: string;
  data?: unknown;
  error?: string;
  validation_errors?: string[];
  instruction?: string;
}

export interface RegisteredAgentTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  schema: TSchema;
  execute: (args: z.infer<TSchema>) => Promise<AgentToolExecutionResult> | AgentToolExecutionResult;
}

export interface AgentToolTraceEntry {
  step: number;
  tool: string;
  status: "ok" | "validation_error" | "error";
  summary: string;
}

export interface ChatCompletionCallParams {
  model: string;
  messages: any[];
  tools: OpenAiToolDefinition[];
  toolChoice?: "auto" | "required" | "none" | { type: "function"; function: { name: string } };
  maxTokens: number;
}

export interface ChatCompletionCallResponse {
  ok: boolean;
  status: number;
  unsupportedTools?: boolean;
  message?: {
    role?: string;
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: Array<{
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string | Record<string, unknown>;
      };
    }>;
  };
  errorText?: string;
}

export type ChatCompletionRequester = (
  params: ChatCompletionCallParams
) => Promise<ChatCompletionCallResponse>;

export interface RunAgentToolLoopOptions {
  models: string[];
  initialMessages: any[];
  tools: RegisteredAgentTool[];
  maxSteps?: number;
  maxTokens?: number;
  firstStepToolChoice?: ChatCompletionCallParams["toolChoice"];
  requester: ChatCompletionRequester;
  stripReasoning?: (text: string) => string;
  /**
   * Hook optionnel appelé juste après l'exécution réussie d'un tour d'outils :
   * retourner un texte final (non null) termine immédiatement la boucle sans
   * consommer d'appel LLM superflu (ex: création studio déjà 100 % validée).
   */
  onAfterTools?: (info: {
    step: number;
    toolTrace: AgentToolTraceEntry[];
  }) => string | null;
  /**
   * Hook appelé si le modèle répond en texte final sans appeler d'outil :
   * retourner une consigne corrective non vide force 1 tour d'auto-réparation supplémentaire.
   */
  onBeforeFinish?: (info: {
    finalText: string;
    step: number;
    toolTrace: AgentToolTraceEntry[];
  }) => string | null;
}

export interface RunAgentToolLoopResult {
  supported: boolean;
  modelUsed: string | null;
  finalText: string;
  stepsUsed: number;
  toolTrace: AgentToolTraceEntry[];
  totalPromptChars: number;
  totalCompletionChars: number;
  error?: string;
}

export function createCloudflareOpenAiRequester(params: {
  accountId: string;
  apiToken: string;
  endpointUrl?: string;
}): ChatCompletionRequester {
  const endpoint =
    params.endpointUrl ||
    `https://api.cloudflare.com/client/v4/accounts/${params.accountId}/ai/v1/chat/completions`;

  return async ({ model, messages, tools, toolChoice, maxTokens }) => {
    const bodyObj: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
    };
    if (tools.length > 0) {
      bodyObj.tools = tools;
      if (toolChoice) {
        bodyObj.tool_choice = toolChoice;
      }
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyObj),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const lower = errText.toLowerCase();
      const unsupportedTools =
        res.status === 400 ||
        res.status === 422 ||
        lower.includes("tool") ||
        lower.includes("function") ||
        lower.includes("unsupported");
      return {
        ok: false,
        status: res.status,
        unsupportedTools,
        errorText: errText.slice(0, 400),
      };
    }

    const data: any = await res.json().catch(() => null);
    const msg = data?.choices?.[0]?.message;
    if (!msg) {
      return {
        ok: false,
        status: 502,
        errorText: "Réponse vide du modèle",
      };
    }

    return {
      ok: true,
      status: res.status,
      message: msg,
    };
  };
}

function formatZodIssues(error: z.ZodError): string[] {
  const issues = Array.isArray((error as any)?.issues) ? (error as any).issues : [];
  if (issues.length === 0) return [String(error?.message || "Paramètres invalides")];
  return issues.slice(0, 8).map((iss: any) => {
    const pathStr = Array.isArray(iss.path) && iss.path.length > 0 ? iss.path.join(".") : "racine";
    return `${pathStr}: ${iss.message}`;
  });
}

function parseToolCallArguments(rawArgs: unknown): Record<string, unknown> | null {
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>;
  }
  if (typeof rawArgs === "string") {
    const trimmed = rawArgs.trim();
    if (!trimmed) return {};
    try {
      const direct = JSON.parse(trimmed);
      if (direct && typeof direct === "object" && !Array.isArray(direct)) {
        return direct as Record<string, unknown>;
      }
    } catch {
      const repaired = safeJsonParse(trimmed);
      if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) {
        return repaired as Record<string, unknown>;
      }
    }
  }
  return null;
}

export async function runAgentToolLoop(
  options: RunAgentToolLoopOptions
): Promise<RunAgentToolLoopResult> {
  const maxSteps = Math.max(1, Math.min(8, options.maxSteps ?? 5));
  const maxTokens = options.maxTokens ?? 8192;
  const toolMap = new Map<string, RegisteredAgentTool>();
  const openAiTools: OpenAiToolDefinition[] = options.tools.map((t) => {
    toolMap.set(t.name, t);
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    };
  });

  const messages: any[] = options.initialMessages.map((m) => ({ ...m }));
  const toolTrace: AgentToolTraceEntry[] = [];
  let activeModel: string | null = null;
  let totalPromptChars = messages.reduce(
    (sum, m) => sum + (typeof m.content === "string" ? m.content.length : 250),
    0
  );
  let totalCompletionChars = 0;
  let correctionNudgesUsed = 0;

  for (let step = 1; step <= maxSteps; step++) {
    const candidateModels = activeModel ? [activeModel] : options.models;
    let res: ChatCompletionCallResponse | null = null;
    let chosenModel: string | null = activeModel;

    const toolChoiceForStep =
      step === 1 && options.firstStepToolChoice
        ? options.firstStepToolChoice
        : "auto";

    for (const modelId of candidateModels) {
      const attempt = await options.requester({
        model: modelId,
        messages,
        tools: openAiTools,
        toolChoice: toolChoiceForStep,
        maxTokens,
      });

      // Si tool_choice forcé (ex: { type: "function" } ou "required") est refusé en 400, réessayer avec "auto" avant de déclarer le modèle incompatible
      if (!attempt.ok && toolChoiceForStep !== "auto" && (attempt.status === 400 || attempt.status === 422)) {
        const autoRetry = await options.requester({
          model: modelId,
          messages,
          tools: openAiTools,
          toolChoice: "auto",
          maxTokens,
        });
        if (autoRetry.ok) {
          res = autoRetry;
          chosenModel = modelId;
          break;
        }
        res = autoRetry;
        continue;
      }

      res = attempt;
      if (attempt.ok) {
        chosenModel = modelId;
        break;
      }
    }

    if (!res || !res.ok || !res.message) {
      return {
        supported: step > 1 ? true : !res?.unsupportedTools,
        modelUsed: activeModel,
        finalText: "",
        stepsUsed: step - 1,
        toolTrace,
        totalPromptChars,
        totalCompletionChars,
        error: res?.errorText || "Échec de l'appel modèle",
      };
    }

    activeModel = chosenModel;
    const msg = res.message;
    const rawContent = typeof msg.content === "string" ? msg.content : "";
    const cleanContent = options.stripReasoning
      ? options.stripReasoning(rawContent)
      : rawContent.trim();
    totalCompletionChars += rawContent.length;

    const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls.filter((tc) => tc?.function?.name) : [];

    if (toolCalls.length > 0) {
      // Conserver le message assistant exact avec ses tool_calls dans l'historique de boucle
      messages.push({
        role: "assistant",
        content: rawContent || null,
        tool_calls: toolCalls.map((tc, idx) => ({
          id: tc.id || `call_${step}_${idx + 1}`,
          type: "function",
          function: {
            name: String(tc.function?.name || ""),
            arguments:
              typeof tc.function?.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments ?? {}),
          },
        })),
      });

      for (let idx = 0; idx < toolCalls.length; idx++) {
        const tc = toolCalls[idx];
        const callId = tc.id || `call_${step}_${idx + 1}`;
        const toolName = String(tc.function?.name || "").trim();
        const registered = toolMap.get(toolName);

        let toolResult: AgentToolExecutionResult;

        if (!registered) {
          toolResult = {
            ok: false,
            error: `Outil inconnu : "${toolName}".`,
            instruction: `Utilise uniquement l'un des outils disponibles : ${Array.from(toolMap.keys()).join(", ")}.`,
          };
          toolTrace.push({
            step,
            tool: toolName,
            status: "error",
            summary: `Outil inconnu (${toolName})`,
          });
        } else {
          const parsedArgs = parseToolCallArguments(tc.function?.arguments);
          if (!parsedArgs) {
            toolResult = {
              ok: false,
              error: "Arguments JSON malformés ou illisibles.",
              instruction: "Corrige la syntaxe JSON des arguments et rappelle l'outil.",
            };
            toolTrace.push({
              step,
              tool: toolName,
              status: "validation_error",
              summary: "Arguments JSON invalides",
            });
          } else {
            const validated = registered.schema.safeParse(parsedArgs);
            if (!validated.success) {
              const issues = formatZodIssues(validated.error);
              toolResult = {
                ok: false,
                error: "Validation Zod échouée.",
                validation_errors: issues,
                instruction: "Corrige exactement les champs signalés et rappelle l'outil.",
              };
              toolTrace.push({
                step,
                tool: toolName,
                status: "validation_error",
                summary: issues[0] || "Erreur de validation Zod",
              });
            } else {
              try {
                toolResult = await registered.execute(validated.data);
                toolTrace.push({
                  step,
                  tool: toolName,
                  status: toolResult.ok ? "ok" : "error",
                  summary:
                    toolResult.summary ||
                    (toolResult.ok ? "Exécuté" : toolResult.error || "Erreur d'exécution"),
                });
              } catch (execErr: any) {
                toolResult = {
                  ok: false,
                  error: execErr?.message || "Erreur interne lors de l'exécution de l'outil.",
                };
                toolTrace.push({
                  step,
                  tool: toolName,
                  status: "error",
                  summary: toolResult.error || "Exception outil",
                });
              }
            }
          }
        }

        const serializedResult = JSON.stringify(toolResult);
        totalPromptChars += serializedResult.length;
        messages.push({
          role: "tool",
          tool_call_id: callId,
          name: toolName,
          content: serializedResult,
        });
      }

      if (options.onAfterTools) {
        const earlyFinal = options.onAfterTools({ step, toolTrace });
        if (earlyFinal !== null) {
          return {
            supported: true,
            modelUsed: activeModel,
            finalText: earlyFinal,
            stepsUsed: step,
            toolTrace,
            totalPromptChars,
            totalCompletionChars,
          };
        }
      }

      // Continuer la boucle pour que le modèle observe les résultats et finalise ou corrige
      continue;
    }

    // Aucun tool_call sur ce tour : vérifier le hook d'auto-correction avant de clôturer
    if (options.onBeforeFinish && step < maxSteps && correctionNudgesUsed < 1) {
      const nudge = options.onBeforeFinish({
        finalText: cleanContent,
        step,
        toolTrace,
      });
      if (nudge) {
        correctionNudgesUsed++;
        messages.push({ role: "assistant", content: cleanContent || "..." });
        messages.push({ role: "user", content: nudge });
        totalPromptChars += nudge.length;
        continue;
      }
    }

    return {
      supported: true,
      modelUsed: activeModel,
      finalText: cleanContent,
      stepsUsed: step,
      toolTrace,
      totalPromptChars,
      totalCompletionChars,
    };
  }

  return {
    supported: true,
    modelUsed: activeModel,
    finalText: "",
    stepsUsed: maxSteps,
    toolTrace,
    totalPromptChars,
    totalCompletionChars,
  };
}
