import { z } from "zod";

/**
 * Zod schemas for every API boundary. All request payloads are validated on the
 * server before touching the extraction/scoring pipelines, and every AI model
 * response is validated before it is trusted.
 */

export const criterionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "id must be alphanumeric with - or _"),
  text: z.string().trim().min(3).max(500),
  weight: z.number().int().min(1).max(5),
  kind: z.enum(["required", "bonus"]),
});

export const jobInfoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  description: z.string().trim().max(20000).default(""),
});

/** Max characters of CV text accepted per document for analysis. */
export const MAX_ANALYZE_TEXT_CHARS = 60000;
/** Max documents per analysis request (client uploads in batches). */
export const MAX_ANALYZE_DOCS = 10;
/** Max criteria per screening. */
export const MAX_CRITERIA = 20;

export const analyzeRequestSchema = z.object({
  job: jobInfoSchema,
  criteria: z.array(criterionSchema).min(1).max(MAX_CRITERIA),
  documents: z
    .array(
      z.object({
        fileId: z.string().min(1).max(128),
        fileName: z.string().trim().min(1).max(255),
        text: z.string().min(1).max(MAX_ANALYZE_TEXT_CHARS),
      }),
    )
    .min(1)
    .max(MAX_ANALYZE_DOCS),
});

export const suggestCriteriaRequestSchema = z.object({
  position: z.string().trim().max(200).default(""),
  jobDescription: z.string().trim().min(10).max(20000),
});

/**
 * Schema for a single criterion evaluation returned by the AI model.
 * Evidence quotes must be verbatim excerpts from the CV (re-checked afterwards
 * against the source text in src/lib/ai/evidence.ts).
 */
export const criterionEvaluationSchema = z.object({
  criterionId: z.string().min(1).max(64),
  status: z.enum(["met", "not_met", "unknown"]),
  evidence: z.array(z.string().min(1).max(600)).max(6),
  reason: z.string().min(1).max(1200),
});

/** Full candidate analysis as returned by the AI model (pre-verification). */
export const candidateAnalysisSchema = z
  .object({
    candidateName: z.string().max(200).nullable(),
    summary: z.string().max(2000),
    relevantExperience: z.array(z.string().max(600)).max(12),
    education: z.array(z.string().max(400)).max(8),
    skills: z.array(z.string().max(120)).max(40),
    evaluations: z.array(criterionEvaluationSchema).max(40),
    unverified: z.array(z.string().max(400)).max(20),
    insufficientDocument: z.boolean(),
    reasoning: z.string().max(4000),
  })
  .superRefine((val, ctx) => {
    const ids = new Set<string>();
    for (const ev of val.evaluations) {
      if (ids.has(ev.criterionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate criterionId "${ev.criterionId}"`,
          path: ["evaluations"],
        });
      }
      ids.add(ev.criterionId);
    }
  });

export const suggestedCriterionSchema = z.object({
  text: z.string().trim().min(3).max(500),
  kind: z.enum(["required", "bonus"]),
  weight: z.number().int().min(1).max(5),
});

export const suggestedCriteriaResponseSchema = z.object({
  criteria: z.array(suggestedCriterionSchema).min(1).max(MAX_CRITERIA),
});
