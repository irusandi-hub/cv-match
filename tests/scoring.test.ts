import { describe, expect, it } from "vitest";
import {
  buildResultState,
  ensureAllCriteriaEvaluated,
  rankResults,
  scoreCandidate,
} from "@/lib/scoring";
import type {
  CandidateAnalysis,
  CandidateResult,
  Criterion,
  CriterionStatus,
} from "@/lib/types";

const CRITERIA: Criterion[] = [
  { id: "c1", text: "Pengalaman minimal 2 tahun", weight: 5, kind: "required" },
  { id: "c2", text: "Kemampuan bahasa Inggris", weight: 4, kind: "required" },
  { id: "c3", text: "Sertifikat BNSP", weight: 2, kind: "bonus" },
];

function analysis(
  statuses: Record<string, CriterionStatus>,
  overrides: Partial<CandidateAnalysis> = {},
): CandidateAnalysis {
  return {
    candidateName: "Kandidat Uji",
    summary: "Ringkasan uji.",
    relevantExperience: [],
    education: [],
    skills: [],
    evaluations: Object.entries(statuses).map(([criterionId, status]) => ({
      criterionId,
      status,
      evidence: ["bukti dari dokumen kandidat"],
      reason: "alasan",
    })),
    unverified: [],
    insufficientDocument: false,
    reasoning: "tes",
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  it("computes a weighted 0-100 score from per-criterion statuses", () => {
    const result = scoreCandidate(
      CRITERIA,
      analysis({ c1: "met", c2: "met", c3: "met" }),
    );
    expect(result.score).toBe(100);
    expect(result.earnedWeight).toBe(11);
    expect(result.totalWeight).toBe(11);
  });

  it("treats unknown as zero points but records it separately", () => {
    const result = scoreCandidate(
      CRITERIA,
      analysis({ c1: "met", c2: "unknown", c3: "met" }),
    );
    // 7 of 11 weight points earned.
    expect(result.score).toBe(64);
    expect(result.unknownCriteria).toEqual(["Kemampuan bahasa Inggris"]);
    expect(result.requiredMet).toBe(1);
    expect(result.requiredTotal).toBe(2);
  });

  it("separates unmet required criteria from bonus criteria", () => {
    const result = scoreCandidate(
      CRITERIA,
      analysis({ c1: "not_met", c2: "met", c3: "met" }),
    );
    expect(result.requiredUnmet).toEqual(["Pengalaman minimal 2 tahun"]);
    expect(result.bonusMet).toEqual(["Sertifikat BNSP"]);
    expect(result.score).toBe(55);
  });

  it("does not count bonus criteria as required", () => {
    const result = scoreCandidate(
      CRITERIA,
      analysis({ c1: "met", c2: "met", c3: "not_met" }),
    );
    expect(result.requiredUnmet).toEqual([]);
    expect(result.requiredMet).toBe(2);
    expect(result.score).toBe(82);
  });

  it("marks missing evaluations as unknown instead of crashing", () => {
    const result = scoreCandidate(CRITERIA, analysis({ c1: "met" }));
    expect(result.unknownCriteria).toHaveLength(2);
    expect(result.score).toBe(45);
  });

  it("clamps out-of-range weights into the 1-5 scale", () => {
    const weird: Criterion[] = [
      { id: "x", text: "Kriteria aneh", weight: 99, kind: "required" },
    ];
    const result = scoreCandidate(weird, analysis({ x: "met" }));
    expect(result.totalWeight).toBe(5);
    expect(result.score).toBe(100);
  });
});

describe("buildResultState", () => {
  it("is complete when every criterion has evidence-based status", () => {
    const a = analysis({ c1: "met", c2: "not_met", c3: "met" });
    expect(buildResultState(a, scoreCandidate(CRITERIA, a))).toBe("complete");
  });

  it("is incomplete when any criterion is unknown", () => {
    const a = analysis({ c1: "met", c2: "unknown", c3: "met" });
    expect(buildResultState(a, scoreCandidate(CRITERIA, a))).toBe("incomplete");
  });

  it("is needs_review for insufficient documents", () => {
    const a = analysis(
      { c1: "met", c2: "met", c3: "met" },
      { insufficientDocument: true },
    );
    expect(buildResultState(a, scoreCandidate(CRITERIA, a))).toBe("needs_review");
  });
});

describe("ensureAllCriteriaEvaluated", () => {
  it("fills skipped criteria with explicit unknown evaluations", () => {
    const covered = ensureAllCriteriaEvaluated(
      analysis({ c1: "met" }),
      CRITERIA,
    );
    expect(covered.evaluations).toHaveLength(3);
    const missing = covered.evaluations.find((e) => e.criterionId === "c2");
    expect(missing?.status).toBe("unknown");
    expect(missing?.reason).toMatch(/belum diketahui/i);
  });

  it("keeps existing evaluations untouched", () => {
    const a = analysis({ c1: "met", c2: "met", c3: "met" });
    expect(ensureAllCriteriaEvaluated(a, CRITERIA)).toBe(a);
  });
});

function result(
  id: string,
  score: number,
  unmet: string[] = [],
  unknowns: string[] = [],
  state: CandidateResult["state"] = "complete",
): CandidateResult {
  return {
    fileId: id,
    fileName: `${id}.pdf`,
    analysis: { ...analysis({}), candidateName: id },
    state,
    score: {
      score,
      earnedWeight: score,
      totalWeight: 100,
      requiredTotal: 2,
      requiredMet: 2 - unmet.length,
      requiredUnmet: unmet,
      unknownCriteria: unknowns,
      bonusMet: [],
    },
  };
}

describe("rankResults", () => {
  it("sorts by score descending", () => {
    const ranked = rankResults([
      result("low", 20),
      result("high", 90),
      result("mid", 55),
    ]);
    expect(ranked.map((r) => r.fileId)).toEqual(["high", "mid", "low"]);
  });

  it("breaks ties by unmet required criteria, then unknowns, then name", () => {
    const ranked = rankResults([
      result("b", 50, [], ["k1"]),
      result("a", 50, [], ["k1"]),
      result("c", 50, ["w1"]),
      result("d", 50, [], []),
    ]);
    expect(ranked.map((r) => r.fileId)).toEqual(["d", "a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = [result("low", 10), result("high", 90)];
    rankResults(input);
    expect(input[0].fileId).toBe("low");
  });
});
