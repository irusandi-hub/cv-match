import { candidateAnalysisSchema } from "../schemas";
import type { CandidateAnalysis, Criterion, JobInfo } from "../types";
import type { AiConfig } from "./config";
import {
  ANALYSIS_JSON_SCHEMA,
  SYSTEM_PROMPT,
  buildCandidateUserPrompt,
} from "./prompts";
import { verifyEvidence } from "./evidence";

export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}

interface ChatCompletionsResponse {
  choices?: { message?: { content?: string } }[];
}

function extractJson(content: string): unknown {
  let text = content.trim();
  // Strip accidental code fences.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1];
  try {
    return JSON.parse(text);
  } catch {
    throw new ModelError("Respons model bukan JSON yang valid.");
  }
}

/**
 * Call an OpenAI-compatible /chat/completions endpoint and parse structured
 * JSON out of it. Uses strict json_schema response format when supported and
 * falls back to json_object on providers that reject json_schema.
 */
export async function chatJson(
  cfg: AiConfig,
  opts: {
    system: string;
    user: string;
    schemaName: string;
    jsonSchema: object;
  },
): Promise<unknown> {
  const url = `${cfg.baseUrl}/chat/completions`;
  const baseBody = {
    model: cfg.model,
    temperature: 0,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };

  const send = (responseFormat: object) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ ...baseBody, response_format: responseFormat }),
    });

  let res = await send({
    type: "json_schema",
    json_schema: {
      name: opts.schemaName,
      strict: true,
      schema: opts.jsonSchema,
    },
  });

  if (res.status === 400) {
    // Some OpenAI-compatible providers do not support json_schema.
    res = await send({ type: "json_object" });
  }

  if (!res.ok) {
    throw new ModelError(
      `Permintaan ke model gagal (HTTP ${res.status}). Periksa AI_BASE_URL, AI_MODEL, dan AI_API_KEY.`,
    );
  }

  let data: ChatCompletionsResponse;
  try {
    data = (await res.json()) as ChatCompletionsResponse;
  } catch {
    throw new ModelError("Respons model tidak dapat dibaca.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ModelError("Model tidak mengembalikan isi respons.");
  }
  return extractJson(content);
}

/** Evaluate one candidate document with the real AI model. */
export async function analyzeWithModel(input: {
  cfg: AiConfig;
  job: JobInfo;
  criteria: Criterion[];
  text: string;
}): Promise<CandidateAnalysis> {
  const raw = await chatJson(input.cfg, {
    system: SYSTEM_PROMPT,
    user: buildCandidateUserPrompt({
      job: input.job,
      criteria: input.criteria,
      cvText: input.text,
    }),
    schemaName: "candidate_analysis",
    jsonSchema: ANALYSIS_JSON_SCHEMA.schema,
  });

  const parsed = candidateAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ModelError("Respons model tidak valid dan tidak dapat digunakan.");
  }

  // Never trust model output: re-check every quote against the source text.
  return verifyEvidence(parsed.data, input.text);
}
