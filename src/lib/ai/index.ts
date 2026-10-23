import type { AnalysisMode, CandidateAnalysis, Criterion, JobInfo } from "../types";
import { analyzeWithDemo } from "./demo";
import { getAiConfig, getAnalysisMode } from "./config";
import { analyzeWithModel } from "./openai";

export { analyzeWithDemo, analyzeWithModel, getAiConfig, getAnalysisMode };
export { ModelError } from "./openai";

/**
 * Analyze one extracted CV against the configured criteria.
 *
 * - With AI_API_KEY set: the OpenAI-compatible model evaluates the CV and the
 *   output is validated (zod) and verified against the source text.
 * - Without it: the deterministic demo heuristics run instead. The response
 *   always carries the mode so the UI can label results honestly.
 */
export async function analyzeCandidate(input: {
  job: JobInfo;
  criteria: Criterion[];
  text: string;
  mode: AnalysisMode;
}): Promise<CandidateAnalysis> {
  if (input.mode === "ai") {
    const cfg = getAiConfig();
    if (!cfg) {
      throw new Error("AI_API_KEY tidak terkonfigurasi di server.");
    }
    return analyzeWithModel({
      cfg,
      job: input.job,
      criteria: input.criteria,
      text: input.text,
    });
  }
  return analyzeWithDemo({ text: input.text, criteria: input.criteria });
}
