import { getAiConfig, getAnalysisMode } from "@/lib/ai";
import { ModelError, chatJson } from "@/lib/ai/openai";
import {
  SUGGEST_CRITERIA_JSON_SCHEMA,
  SYSTEM_PROMPT,
  buildSuggestUserPrompt,
} from "@/lib/ai/prompts";
import {
  suggestCriteriaRequestSchema,
  suggestedCriteriaResponseSchema,
} from "@/lib/schemas";
import { suggestCriteriaDemo } from "@/lib/suggest";

export const runtime = "nodejs";

/**
 * POST /api/suggest-criteria — draft screening criteria from a pasted job
 * description. Suggestions are always editable in the UI before screening;
 * nothing runs automatically.
 */

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Permintaan tidak valid: body harus JSON." },
      { status: 400 },
    );
  }

  const parsed = suggestCriteriaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Deskripsi pekerjaan tidak valid atau terlalu pendek." },
      { status: 400 },
    );
  }

  const { position, jobDescription } = parsed.data;
  const mode = getAnalysisMode();

  if (mode === "demo") {
    const suggestions = suggestCriteriaDemo({ position, jobDescription });
    return Response.json({ mode, criteria: suggestions });
  }

  const cfg = getAiConfig();
  if (!cfg) {
    return Response.json(
      { error: "Konfigurasi AI tidak ditemukan." },
      { status: 500 },
    );
  }

  try {
    const raw = await chatJson(cfg, {
      system: `${SYSTEM_PROMPT}\n\nToday's task is different: extract screening criteria from a job posting, not to evaluate a candidate.`,
      user: buildSuggestUserPrompt({ position, jobDescription }),
      schemaName: "screening_criteria",
      jsonSchema: SUGGEST_CRITERIA_JSON_SCHEMA.schema,
    });

    const validated = suggestedCriteriaResponseSchema.safeParse(raw);
    if (!validated.success) {
      throw new ModelError("Respons model tidak valid.");
    }

    const criteria = validated.data.criteria
      .slice(0, 20)
      .map((c) => ({
        text: c.text,
        kind: c.kind,
        weight: Math.min(5, Math.max(1, Math.round(c.weight))),
      }))
      .filter((c) => c.text.length >= 3);

    if (criteria.length === 0) {
      throw new ModelError("Model tidak menghasilkan kriteria yang valid.");
    }

    return Response.json({ mode, criteria });
  } catch (err) {
    const message =
      err instanceof ModelError
        ? err.message
        : "Gagal menyusun kriteria dengan model AI.";
    return Response.json({ error: message }, { status: 502 });
  }
}
