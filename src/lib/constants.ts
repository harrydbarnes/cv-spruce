export const ANTHROPIC_VERSION = "2023-06-01";

export const DEFAULT_TEMPERATURE = 0.7;

export const MODEL_IDS = {
  gemini: "gemini-2.5-flash",
  claude: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
} as const;

export const MODEL_LABELS = {
  gemini: "Gemini 2.5",
  claude: "Claude 4",
  openai: "GPT-4o",
};

export const MODEL_FULL_LABELS = {
  gemini: "Powered by Gemini 2.5 Flash",
  claude: "Powered by Claude Sonnet 4",
  openai: "Powered by GPT-4o",
};

export const MODEL_PROVIDER_NAMES = {
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openai: "OpenAI",
};
