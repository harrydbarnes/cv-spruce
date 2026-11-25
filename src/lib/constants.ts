import type { ApiWorkload, ModelType, ThinkingLevel } from "./types";

export const ANTHROPIC_VERSION = "2023-06-01";

export const DEFAULT_TEMPERATURE = 0.7;

export interface ProviderModelOption {
  id: string;
  label: string;
  badge: string;
  description: string;
}

export const PROVIDER_MODELS: Record<ModelType, ProviderModelOption[]> = {
  gemini: [
    {
      id: "gemini-4-hydrogen",
      label: "Gemini 4 Hydrogen",
      badge: "Free Tier",
      description: "Latest agentic reasoning & fast execution",
    },
    {
      id: "gemini-3.8-flash",
      label: "Gemini 3.8 Flash",
      badge: "Free Tier • Lite",
      description: "High-speed lightweight Flash model",
    },
  ],
  claude: [
    {
      id: "claude-sonnet-5-5",
      label: "Claude Sonnet 5.5",
      badge: "Recommended",
      description: "Strongest balance of writing & reasoning",
    },
    {
      id: "claude-haiku-5-5",
      label: "Claude Haiku 5.5",
      badge: "Fast & Low Cost",
      description: "Lightweight Claude tier for quick drafts",
    },
  ],
  openai: [
    {
      id: "gpt-6.2-sol",
      label: "GPT-6.2 Sol",
      badge: "Recommended",
      description: "Balanced everyday workhorse",
    },
    {
      id: "gpt-6.1-terra",
      label: "GPT-6.1 Terra",
      badge: "Natural Writing",
      description: "Fast & crisp prose at half the price",
    },
    {
      id: "gpt-6-luna",
      label: "GPT-6 Luna",
      badge: "Ultra-Low Cost",
      description: "Economical high-volume tier",
    },
  ],
};

export const MODEL_IDS = {
  gemini: PROVIDER_MODELS.gemini[0].id,
  claude: PROVIDER_MODELS.claude[0].id,
  openai: PROVIDER_MODELS.openai[0].id,
} as const;

export const MODEL_LABELS: Record<ModelType, string> = {
  gemini: "Gemini",
  claude: "Claude",
  openai: "ChatGPT",
};

export const MODEL_FULL_LABELS: Record<ModelType, string> = {
  gemini: "Powered by Gemini 4 Hydrogen",
  claude: "Powered by Claude Sonnet 5.5",
  openai: "Powered by GPT-6.2 Sol",
};

export const MODEL_PROVIDER_NAMES: Record<ModelType, string> = {
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openai: "OpenAI",
};

export function getModelOptionLabel(provider: ModelType, modelId?: string): string {
  const found = PROVIDER_MODELS[provider].find((m) => m.id === modelId);
  return found?.label ?? PROVIDER_MODELS[provider][0].label;
}

/**
 * Resolves "auto" thinking level based on the selected API workload:
 * - Minimal -> low
 * - Reduced -> medium
 * - Normal  -> high
 */
export function resolveThinkingLevel(
  level: ThinkingLevel,
  workload: ApiWorkload
): "low" | "medium" | "high" {
  if (level !== "auto") return level;
  if (workload === "Minimal") return "low";
  if (workload === "Reduced") return "medium";
  return "high";
}
