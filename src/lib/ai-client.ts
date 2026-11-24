import { ANTHROPIC_VERSION, DEFAULT_TEMPERATURE, MODEL_IDS } from "./constants";
import type { ModelType } from "./types";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IDS.gemini}:generateContent`;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

export interface StructuredAiRequest {
  provider: ModelType;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

/**
 * Strips optional markdown JSON fences and parses JSON safely.
 */
export function parseJsonFromModel<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Unified JSON completion helper across Gemini, OpenAI, and Claude.
 * Used by Career Profile CV import, Job Match Scoring, and Bruce Chat Refinement.
 */
export async function callStructuredAi<T>({
  provider,
  apiKey,
  systemPrompt,
  userPrompt,
  temperature = DEFAULT_TEMPERATURE,
}: StructuredAiRequest): Promise<T> {
  if (!apiKey.trim()) {
    throw new Error(`Please enter your ${provider} API key to use Bruce AI features.`);
  }

  const strictSystem = `${systemPrompt}\n\nIMPORTANT: Return ONLY a valid raw JSON object with no markdown fences or extra prose.`;

  if (provider === "gemini") {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: strictSystem }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}): ${err || "Request failed"}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned an empty response.");
    return parseJsonFromModel<T>(text);
  }

  if (provider === "openai") {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_IDS.openai,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: strictSystem },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenAI API error (${res.status}): ${err || "Request failed"}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned an empty response.");
    return parseJsonFromModel<T>(text);
  }

  // Claude
  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      "anthropic-dangerously-allow-browser": "true",
    },
    body: JSON.stringify({
      model: MODEL_IDS.claude,
      max_tokens: 4096,
      temperature,
      system: strictSystem,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Claude API error (${res.status}): ${err || "Request failed"}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Claude returned an empty response.");
  return parseJsonFromModel<T>(text);
}
