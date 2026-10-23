import type { CandidateAnalysis } from "../types";

/**
 * Post-verification of a model's analysis against the actual CV text.
 *
 * The model is instructed to quote verbatim, but we never trust it blindly:
 *   - evidence quotes must appear (normalized) in the source text, otherwise
 *     they are dropped as hallucinations;
 *   - a "met" status left without any surviving evidence is downgraded to
 *     "unknown" with an explicit note;
 *   - listed skills/experience/education items must be textually supported.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

const SUPPORT_STOPWORDS = new Set([
  "dan",
  "atau",
  "yang",
  "dengan",
  "untuk",
  "dari",
  "ini",
  "itu",
  "pada",
  "adalah",
  "serta",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "are",
  "was",
  "were",
  "have",
  "has",
]);

function contentTokens(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9À-ÿ+#.]+/i)
    .filter((t) => t.length >= 4 && !SUPPORT_STOPWORDS.has(t));
}

/** True when at least half of the item's content tokens exist in the source. */
export function isTextuallySupported(item: string, normSource: string): boolean {
  const tokens = contentTokens(item);
  if (tokens.length === 0) return normSource.includes(normalize(item));
  const hits = tokens.filter((t) => normSource.includes(t)).length;
  return hits / tokens.length >= 0.5;
}

export function quoteAppearsInSource(quote: string, normSource: string): boolean {
  const q = normalize(quote);
  if (q.length < 8) return false;
  return normSource.includes(q);
}

export function verifyEvidence(
  analysis: CandidateAnalysis,
  sourceText: string,
): CandidateAnalysis {
  const normSource = normalize(sourceText);

  const evaluations = analysis.evaluations.map((ev) => {
    const evidence = ev.evidence
      .map((q) => q.trim())
      .filter((q) => quoteAppearsInSource(q, normSource))
      .filter((q, i, arr) => arr.indexOf(q) === i)
      .slice(0, 6);

    if (ev.status === "met" && evidence.length === 0) {
      return {
        ...ev,
        status: "unknown" as const,
        evidence,
        reason: `${ev.reason} [Diturunkan menjadi "belum diketahui": kutipan bukti tidak ditemukan verbatim pada teks CV — kemungkinan halusinasi model.]`,
      };
    }
    return { ...ev, evidence };
  });

  return {
    ...analysis,
    evaluations,
    relevantExperience: analysis.relevantExperience
      .filter((item) => isTextuallySupported(item, normSource))
      .slice(0, 12),
    education: analysis.education
      .filter((item) => isTextuallySupported(item, normSource))
      .slice(0, 8),
    skills: analysis.skills
      .filter((item) => isTextuallySupported(item, normSource))
      .slice(0, 40),
  };
}
