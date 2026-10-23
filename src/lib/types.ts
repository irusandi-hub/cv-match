/**
 * Shared domain types for CV Match.
 *
 * The screening pipeline is split into clearly separated stages:
 *   1. Document extraction  (src/lib/extract)     – PDF/DOCX -> plain text
 *   2. Candidate evaluation (src/lib/ai)          – text + criteria -> structured analysis
 *   3. Scoring              (src/lib/scoring)     – analysis + weights -> 0-100 score
 *   4. Presentation/export  (src/components, csv) – results table, detail, CSV
 */

export type CriterionKind = "required" | "bonus";

export interface Criterion {
  id: string;
  text: string;
  /** 1 (low) – 5 (high). Same scale for required and bonus criteria. */
  weight: number;
  kind: CriterionKind;
}

export interface JobInfo {
  title: string;
  company: string;
  location: string;
  description: string;
}

/** Status of a single criterion for one candidate, based strictly on CV evidence. */
export type CriterionStatus = "met" | "not_met" | "unknown";

export interface CriterionEvaluation {
  criterionId: string;
  status: CriterionStatus;
  /** Verbatim quotes/references taken from the candidate's CV. */
  evidence: string[];
  /** Human-readable justification for the status. */
  reason: string;
}

/** Structured evaluation of one candidate, produced by the AI/demo evaluator. */
export interface CandidateAnalysis {
  candidateName: string | null;
  summary: string;
  relevantExperience: string[];
  education: string[];
  skills: string[];
  evaluations: CriterionEvaluation[];
  /** Facts present in the CV that still need manual verification (e.g. passport validity). */
  unverified: string[];
  /** True when the document carries too little information to be meaningfully evaluated. */
  insufficientDocument: boolean;
  reasoning: string;
}

export interface ScoreBreakdown {
  /** 0–100 evidence-weighted match score. */
  score: number;
  earnedWeight: number;
  totalWeight: number;
  requiredTotal: number;
  requiredMet: number;
  /** Texts of required criteria that are explicitly NOT met. */
  requiredUnmet: string[];
  /** Texts of criteria whose status is unknown/unverified. */
  unknownCriteria: string[];
  /** Texts of bonus criteria that are met. */
  bonusMet: string[];
}

/** Overall evaluation state of a candidate result. */
export type EvaluationState = "complete" | "incomplete" | "needs_review";

export interface CandidateResult {
  fileId: string;
  fileName: string;
  analysis: CandidateAnalysis;
  score: ScoreBreakdown;
  state: EvaluationState;
  /** Per-document analysis failure (model error etc.); result is excluded when set. */
  error?: string;
}

/** A successfully extracted document, ready for evaluation. */
export interface ExtractedDoc {
  fileId: string;
  fileName: string;
  text: string;
  charCount: number;
  pages: number | null;
}

export type AnalysisMode = "demo" | "ai";
