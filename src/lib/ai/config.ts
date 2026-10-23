import type { AnalysisMode } from "../types";

/**
 * Server-side AI configuration. Keys are read only from environment
 * variables — never exposed to the client bundle.
 *
 *   AI_API_KEY   – API key for an OpenAI-compatible chat-completions endpoint
 *   AI_BASE_URL  – base URL (default https://api.openai.com/v1)
 *   AI_MODEL     – model name (default gpt-4o-mini)
 */

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";

export function getAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function getAnalysisMode(env: NodeJS.ProcessEnv = process.env): AnalysisMode {
  return getAiConfig(env) ? "ai" : "demo";
}
