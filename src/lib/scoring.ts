import type {
  CandidateAnalysis,
  CandidateResult,
  Criterion,
  CriterionEvaluation,
  EvaluationState,
  ScoreBreakdown,
} from "./types";

/**
 * Pure, deterministic scoring.
 *
 * The score is computed here — never by the model — from the per-criterion
 * statuses and the weights the user configured and can see in the UI:
 *
 *   score = 100 × (Σ weight of criteria with status "met") / (Σ all weights)
 *
 * "unknown" (belum diketahui) earns no points but is reported separately so a
 * lack of evidence is never silently converted into a confident rejection:
 * results containing unknowns are flagged "belum lengkap".
 */

export function scoreCandidate(
  criteria: Criterion[],
  analysis: CandidateAnalysis,
): ScoreBreakdown {
  const evalByCriterion = new Map<string, CriterionEvaluation>();
  for (const ev of analysis.evaluations) {
    evalByCriterion.set(ev.criterionId, ev);
  }

  let earnedWeight = 0;
  let totalWeight = 0;
  let requiredTotal = 0;
  let requiredMet = 0;
  const requiredUnmet: string[] = [];
  const unknownCriteria: string[] = [];
  const bonusMet: string[] = [];

  for (const criterion of criteria) {
    const weight = Math.max(1, Math.min(5, Math.round(criterion.weight)));
    totalWeight += weight;
    const status = evalByCriterion.get(criterion.id)?.status ?? "unknown";

    if (status === "met") earnedWeight += weight;

    if (criterion.kind === "required") {
      requiredTotal += 1;
      if (status === "met") requiredMet += 1;
      else if (status === "not_met") requiredUnmet.push(criterion.text);
    } else if (status === "met") {
      bonusMet.push(criterion.text);
    }

    if (status === "unknown") unknownCriteria.push(criterion.text);
  }

  const score =
    totalWeight === 0 ? 0 : Math.round((100 * earnedWeight) / totalWeight);

  return {
    score,
    earnedWeight,
    totalWeight,
    requiredTotal,
    requiredMet,
    requiredUnmet,
    unknownCriteria,
    bonusMet,
  };
}

/** Overall evaluation state derived from the analysis and its breakdown. */
export function buildResultState(
  analysis: CandidateAnalysis,
  breakdown: ScoreBreakdown,
): EvaluationState {
  if (analysis.insufficientDocument) return "needs_review";
  if (breakdown.unknownCriteria.length > 0) return "incomplete";
  return "complete";
}

/**
 * Guarantee one evaluation per configured criterion.
 * Missing evaluations (e.g. a model skipped one) become "unknown" with an
 * explicit reason instead of silently disappearing.
 */
export function ensureAllCriteriaEvaluated(
  analysis: CandidateAnalysis,
  criteria: Criterion[],
): CandidateAnalysis {
  const seen = new Set(analysis.evaluations.map((ev) => ev.criterionId));
  const extra = criteria
    .filter((c) => !seen.has(c.id))
    .map<CriterionEvaluation>((criterion) => ({
      criterionId: criterion.id,
      status: "unknown",
      evidence: [],
      reason:
        "Evaluasi untuk kriteria ini tidak tersedia; ditandai sebagai belum diketahui.",
    }));
  if (extra.length === 0) return analysis;
  return { ...analysis, evaluations: [...analysis.evaluations, ...extra] };
}

/**
 * Rank candidates: highest score first, then fewest unmet required criteria,
 * then fewest unknowns, then file name for a stable order.
 */
export function rankResults(results: CandidateResult[]): CandidateResult[] {
  return [...results].sort((a, b) => {
    if (b.score.score !== a.score.score) return b.score.score - a.score.score;
    const aUnmet = a.score.requiredUnmet.length;
    const bUnmet = b.score.requiredUnmet.length;
    if (aUnmet !== bUnmet) return aUnmet - bUnmet;
    const aUnknown = a.score.unknownCriteria.length;
    const bUnknown = b.score.unknownCriteria.length;
    if (aUnknown !== bUnknown) return aUnknown - bUnknown;
    return a.fileName.localeCompare(b.fileName);
  });
}

export const EVALUATION_STATE_LABEL: Record<EvaluationState, string> = {
  complete: "Lengkap",
  incomplete: "Belum lengkap",
  needs_review: "Perlu tinjauan",
};
