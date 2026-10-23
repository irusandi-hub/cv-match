import { analyzeCandidate, getAnalysisMode } from "@/lib/ai";
import { ModelError } from "@/lib/ai/openai";
import { analyzeRequestSchema } from "@/lib/schemas";
import {
  buildResultState,
  ensureAllCriteriaEvaluated,
  scoreCandidate,
} from "@/lib/scoring";
import type { CandidateResult, Criterion } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/analyze — evaluate a small batch of extracted CVs against the
 * screening criteria.
 *
 * Mode is decided server-side:
 *   - AI_API_KEY configured  -> real model analysis (validated + verified)
 *   - otherwise              -> deterministic local demo heuristics
 *
 * The response always states which mode produced the results so the UI can
 * label them honestly. Demo analysis never leaves the server.
 */

export interface AnalyzeResponse {
  mode: "demo" | "ai";
  results: CandidateResult[];
  errors: { fileId: string; fileName: string; message: string }[];
}

/** Minimal concurrency limiter for model calls. */
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

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

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: `Data tidak valid: ${issue?.path.join(".") || "payload"} — ${issue?.message}` },
      { status: 400 },
    );
  }

  const { job, criteria, documents } = parsed.data;
  const typedCriteria: Criterion[] = criteria;
  const mode = getAnalysisMode();

  const results: CandidateResult[] = [];
  const errors: AnalyzeResponse["errors"] = [];
  const limit = createLimiter(mode === "ai" ? 3 : 8);

  await Promise.all(
    documents.map((doc) =>
      limit(async () => {
        try {
          const analysis = await analyzeCandidate({
            job,
            criteria: typedCriteria,
            text: doc.text,
            mode,
          });
          const covered = ensureAllCriteriaEvaluated(analysis, typedCriteria);
          const score = scoreCandidate(typedCriteria, covered);
          results.push({
            fileId: doc.fileId,
            fileName: doc.fileName,
            analysis: covered,
            score,
            state: buildResultState(covered, score),
          });
        } catch (err) {
          // Safe error: never include CV text or provider payloads.
          const message =
            err instanceof ModelError
              ? err.message
              : "Terjadi kesalahan saat menganalisis dokumen ini.";
          errors.push({
            fileId: doc.fileId,
            fileName: doc.fileName,
            message,
          });
        }
      }),
    ),
  );

  return Response.json({ mode, results, errors } satisfies AnalyzeResponse);
}
