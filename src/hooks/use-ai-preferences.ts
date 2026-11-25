import { useState, useEffect, useCallback } from "react";
import { MODEL_IDS, PROVIDER_MODELS } from "@/lib/constants";
import type { ModelType, ThinkingLevel } from "@/lib/types";

const PROVIDER_KEY = "cv-spruce-active-provider";
const MODEL_ID_KEY = "cv-spruce-active-model-id";
const THINKING_KEY = "cv-spruce-thinking-level";

function loadProvider(): ModelType {
  if (typeof window === "undefined") return "gemini";
  const saved = localStorage.getItem(PROVIDER_KEY);
  if (saved === "gemini" || saved === "claude" || saved === "openai") return saved;
  return "gemini";
}

function loadModelId(provider: ModelType): string {
  if (typeof window === "undefined") return MODEL_IDS[provider];
  const saved = localStorage.getItem(MODEL_ID_KEY);
  if (saved && PROVIDER_MODELS[provider].some((m) => m.id === saved)) {
    return saved;
  }
  return MODEL_IDS[provider];
}

function loadThinking(): ThinkingLevel {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(THINKING_KEY);
  if (saved === "auto" || saved === "low" || saved === "medium" || saved === "high") {
    return saved;
  }
  return "auto";
}

/**
 * Persists the user's selected AI provider, exact model tier (e.g. gemini-3.8-flash),
 * and thinking level across all pages (Quick Tailor, Profile, Discover, Board Studio).
 */
export function useAiPreferences() {
  const [provider, setProviderState] = useState<ModelType>(() => loadProvider());
  const [modelId, setModelIdState] = useState<string>(() => loadModelId(loadProvider()));
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>(() => loadThinking());

  useEffect(() => {
    localStorage.setItem(PROVIDER_KEY, provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem(MODEL_ID_KEY, modelId);
  }, [modelId]);

  useEffect(() => {
    localStorage.setItem(THINKING_KEY, thinkingLevel);
  }, [thinkingLevel]);

  const setProvider = useCallback((nextProvider: ModelType) => {
    setProviderState(nextProvider);
    setModelIdState(MODEL_IDS[nextProvider]);
  }, []);

  const setModelId = useCallback((nextModelId: string) => {
    setModelIdState(nextModelId);
  }, []);

  const setThinkingLevel = useCallback((nextLevel: ThinkingLevel) => {
    setThinkingLevelState(nextLevel);
  }, []);

  return {
    provider,
    modelId,
    thinkingLevel,
    setProvider,
    setModelId,
    setThinkingLevel,
  };
}
