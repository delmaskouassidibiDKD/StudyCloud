import type { AiChatAuthorInfo } from "@gadgets/workshop-shared/api";

const LAST_SELECTED_MODEL_KEY = "lastSelectedModel";

/** Sentinel used for UI values and localStorage so an explicit null choice can persist. */
export const NO_AGENT_OPTION_VALUE = "__gadgets_no_agent__";

export function getStoredSelectedModel(
  models: AiChatAuthorInfo[],
): string | null {
  let storedModel = localStorage.getItem(LAST_SELECTED_MODEL_KEY);

  if (storedModel === NO_AGENT_OPTION_VALUE) {
    return null;
  }

  if (storedModel === "@cf/meta/llama-3.3-70b-instruct") {
    storedModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  } else if (storedModel === "gemini-2.0-flash" || storedModel === "gemini-2.5-flash" || storedModel?.includes("gemini-2.0")) {
    storedModel = "gemini-3.8-flash";
  } else if (storedModel && storedModel.includes("claude-3-5")) {
    storedModel = "claude-sonnet-4-5";
  }

  if (storedModel && models.some((model) => model.id === storedModel)) {
    return storedModel;
  }

  // Default: Return the first configured model, or null if none are configured.
  return models[0]?.id ?? null;
}

export function persistSelectedModel(modelId: string | null): void {
  localStorage.setItem(
    LAST_SELECTED_MODEL_KEY,
    modelId ?? NO_AGENT_OPTION_VALUE,
  );
}

export function toModelSelectValue(modelId: string | null): string {
  return modelId ?? NO_AGENT_OPTION_VALUE;
}

export function fromModelSelectValue(value: string): string | null {
  return value === NO_AGENT_OPTION_VALUE ? null : value;
}
