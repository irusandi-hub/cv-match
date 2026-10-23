import type {
  CandidateAnalysis,
  Criterion,
  CriterionEvaluation,
  CriterionStatus,
} from "../types";

/**
 * Demo mode: a deterministic, fully local heuristic evaluator.
 *
 * It performs keyword/signal matching against the extracted CV text so the
 * whole product flow (upload → analysis → ranking → CSV) works without any AI
 * credentials. Results are clearly labelled as demo output everywhere — they
 * are NOT presented as AI analysis.
 *
 * Because it only pattern-matches text, embedded instructions inside a CV
 * (prompt injection) cannot influence it; instruction-like lines are also
 * excluded from evidence.
 */

const INJECTION_LIKE =
  /ignore (all |previous |prior )?(the )?(instructions|rules|prompts)|disregard|you are an? ai|system message|pretend|roleplay|give (me )?(a )?(score|100)|beri (saya )?skor|abaikan (instruksi|aturan)|prompt injection/i;

const SENTENCE_SPLIT = /(?<=[.!?;])\s+(?=[A-Z0-9"'(])/;

export function splitIntoLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const cleaned = raw.replace(/^[\s•·▪◦*\-–—]+/, "").trim();
    if (cleaned.length === 0) continue;
    // Some PDFs extract as very long lines; split them into sentence chunks
    // so evidence matching stays granular.
    if (cleaned.length > 300) {
      for (const sentence of cleaned.split(SENTENCE_SPLIT)) {
        if (sentence.trim().length > 0) lines.push(sentence.trim());
      }
    } else {
      lines.push(cleaned);
    }
  }
  return lines;
}

function isEvidenceLine(line: string): boolean {
  return line.length >= 8 && line.length <= 400 && !INJECTION_LIKE.test(line);
}

function findEvidence(lines: string[], re: RegExp, max = 3): string[] {
  return lines.filter((l) => isEvidenceLine(l) && re.test(l)).slice(0, max);
}

function parseDurations(lines: string[], re: RegExp): number[] {
  const out: number[] = [];
  const durRe = /(\d+(?:[.,]\d+)?)\s*(?:\+\s*)?(?:tahun|thn|years?|yrs?\b)/gi;
  for (const line of lines) {
    if (!re.test(line)) continue;
    for (const m of line.matchAll(durRe)) {
      out.push(parseFloat(m[1].replace(",", ".")));
    }
    const rangeRe = /(20\d{2})\s*[-–—/]\s*(20\d{2}|present|sekarang|now|kini|current)/gi;
    for (const m of line.matchAll(rangeRe)) {
      const start = parseInt(m[1], 10);
      const end = /20\d{2}/.test(m[2])
        ? parseInt(m[2], 10)
        : new Date().getFullYear();
      if (end >= start && end - start <= 50) out.push(end - start);
    }
    re.lastIndex = 0;
  }
  return out;
}

interface FamilyOutcome {
  status: CriterionStatus;
  reason: string;
  evidence: string[];
  unverified?: string[];
}

type Family = "experience" | "english" | "pos" | "passport" | "bnsp";

// Order matters: more specific families are tested first, because e.g. a BNSP
// criterion also mentions "Barista" and must not be treated as experience.
const FAMILY_PATTERNS: { family: Family; re: RegExp }[] = [
  { family: "bnsp", re: /bnsp|sertifikat kompetensi|competency cert/i },
  { family: "passport", re: /paspor|passport/i },
  { family: "pos", re: /point of sale|\bpos\b|kasir|cashier/i },
  { family: "english", re: /english|inggris/i },
  { family: "experience", re: /barista|bartender/i },
];

export function detectFamily(criterionText: string): Family | null {
  for (const { family, re } of FAMILY_PATTERNS) {
    if (re.test(criterionText)) return family;
  }
  return null;
}

const ROLE_RE = /\bbarista\b|\bbartender\b/i;

function evaluateExperience(criterionText: string, lines: string[]): FamilyOutcome {
  const requiredMatch = criterionText.match(
    /(?:minimal|min\.?|at least|>=?)\s*(\d+(?:[.,]\d+)?)/i,
  );
  const requiredYears = requiredMatch
    ? parseFloat(requiredMatch[1].replace(",", "."))
    : 2;

  const roleLines = findEvidence(lines, ROLE_RE, 4);
  if (roleLines.length === 0) {
    return {
      status: "unknown",
      reason: `Tidak ditemukan bukti pengalaman pada peran yang disebutkan kriteria (±${requiredYears} tahun). Data tidak tersedia di CV.`,
      evidence: [],
      unverified: ["Pengalaman pada peran yang disyaratkan tidak disebutkan di CV"],
    };
  }

  const durations = parseDurations(lines, ROLE_RE);
  if (durations.length === 0) {
    return {
      status: "unknown",
      reason: `Peran relevan disebutkan, tetapi durasi pengalaman tidak dinyatakan sehingga kriteria minimal ${requiredYears} tahun belum dapat dipastikan.`,
      evidence: roleLines.slice(0, 3),
      unverified: ["Durasi pengalaman tidak dinyatakan secara eksplisit di CV"],
    };
  }

  const maxYears = Math.max(...durations);
  if (maxYears >= requiredYears) {
    return {
      status: "met",
      reason: `Tercatat pengalaman ±${maxYears} tahun pada peran relevan (kriteria: minimal ${requiredYears} tahun).`,
      evidence: roleLines.slice(0, 3),
    };
  }
  return {
    status: "not_met",
    reason: `Durasi pengalaman tercatat ±${maxYears} tahun, di bawah kriteria minimal ${requiredYears} tahun.`,
    evidence: roleLines.slice(0, 3),
  };
}

function evaluateEnglish(lines: string[]): FamilyOutcome {
  const englishLines = findEvidence(lines, /english|inggris/i, 3);
  if (englishLines.length > 0) {
    return {
      status: "met",
      reason: "CV memuat bukti kemampuan bahasa Inggris (lisan/tulisan).",
      evidence: englishLines,
    };
  }
  const otherLanguage = lines.find(
    (l) =>
      (/^(bahasa|language|languages)\b/i.test(l) || /berbahasa/i.test(l)) &&
      l.length >= 15,
  );
  if (otherLanguage && isEvidenceLine(otherLanguage)) {
    return {
      status: "not_met",
      reason:
        "Bagian bahasa pada CV hanya menyebutkan bahasa selain Inggris; kemampuan bahasa Inggris tidak dinyatakan.",
      evidence: [otherLanguage],
    };
  }
  return {
    status: "unknown",
    reason:
      "CV tidak memuat informasi kemampuan bahasa Inggris; perlu wawancara atau tes bahasa.",
    evidence: [],
    unverified: ["Kemampuan bahasa Inggris perlu diverifikasi"],
  };
}

function evaluatePos(lines: string[]): FamilyOutcome {
  const posLines = findEvidence(lines, /point of sale|\bpos\b|kasir|cashier/i, 3);
  if (posLines.length > 0) {
    return {
      status: "met",
      reason: "CV menyebutkan pengalaman/penguasaan POS atau sistem kasir.",
      evidence: posLines,
    };
  }
  return {
    status: "unknown",
    reason:
      "CV tidak menyebutkan POS atau sistem kasir; ketidakhadiran bukti bukan bukti ketidakmampuan.",
    evidence: [],
    unverified: ["Penguasaan POS/kasir perlu diverifikasi"],
  };
}

function evaluatePassport(lines: string[]): FamilyOutcome {
  const passportLines = findEvidence(lines, /paspor|passport/i, 3);
  if (passportLines.length === 0) {
    return {
      status: "unknown",
      reason:
        "CV tidak menyebutkan kepemilikan paspor; masa berlaku tidak dapat disimpulkan.",
      evidence: [],
      unverified: ["Kepemilikan dan masa berlaku paspor perlu diverifikasi"],
    };
  }

  const NO_PASSPORT =
    /belum memiliki paspor|tidak memiliki paspor|belum punya paspor|no passport|does not have a passport|belum mengurus paspor/i;
  const deniedLine = passportLines.find((l) => NO_PASSPORT.test(l));
  if (deniedLine) {
    return {
      status: "not_met",
      reason:
        "CV secara eksplisit menyatakan belum memiliki paspor (dokumen wajib untuk keberangkatan).",
      evidence: [deniedLine],
    };
  }

  const currentYear = new Date().getFullYear();
  for (const line of passportLines) {
    const yearMatch = line.match(
      /(?:berlaku hingga|berlaku s\/d|berlaku sampai|valid until|expires?|expiry|sampai)\D{0,20}(20\d{2})/i,
    );
    const fallbackYear = line.match(/\b(20\d{2})\b/);
    const year = yearMatch
      ? parseInt(yearMatch[1], 10)
      : fallbackYear
        ? parseInt(fallbackYear[1], 10)
        : null;

    if (year !== null) {
      const note =
        "Masa berlaku paspor berasal dari klaim di CV — verifikasi dokumen asli.";
      if (year >= currentYear) {
        return {
          status: "met",
          reason: `Paspor disebutkan masih berlaku hingga ${year} (perlu verifikasi dokumen asli).`,
          evidence: passportLines.slice(0, 2),
          unverified: [note],
        };
      }
      return {
        status: "not_met",
        reason: `Paspor disebutkan berlaku sampai ${year} (sudah kedaluwarsa dibanding tahun ${currentYear}).`,
        evidence: passportLines.slice(0, 2),
      };
    }
  }

  return {
    status: "unknown",
    reason:
      "Paspor disebutkan tanpa tanggal masa berlaku; validitas tidak dapat disimpulkan dari CV.",
    evidence: passportLines.slice(0, 2),
    unverified: ["Masa berlaku paspor tidak dinyatakan di CV"],
  };
}

function evaluateBnsp(lines: string[]): FamilyOutcome {
  const certLines = findEvidence(lines, /bnsp|sertifikat kompetensi|competency cert/i, 3);
  if (certLines.length > 0) {
    return {
      status: "met",
      reason: "CV memuat sertifikat kompetensi/BNSP yang relevan.",
      evidence: certLines,
    };
  }
  return {
    status: "unknown",
    reason: "Sertifikat BNSP/kompetensi tidak disebutkan di CV (kriteria nilai tambah).",
    evidence: [],
  };
}

const GENERIC_STOPWORDS = new Set([
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
  "dapat",
  "bisa",
  "akan",
  "minimal",
  "memiliki",
  "mampu",
  "harus",
  "wajib",
  "serta",
  "baik",
  "lebih",
  "lain",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "are",
  "must",
  "should",
  "have",
  "good",
  "able",
  "well",
  "their",
]);

function criterionTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .filter((t) => t.length >= 4 && !GENERIC_STOPWORDS.has(t));
}

function evaluateGeneric(criterionText: string, lines: string[]): FamilyOutcome {
  const tokens = criterionTokens(criterionText);
  if (tokens.length === 0) {
    return {
      status: "unknown",
      reason: "Kriteria terlalu umum untuk dinilai secara otomatis dalam mode demo.",
      evidence: [],
    };
  }

  const scored = lines
    .filter(isEvidenceLine)
    .map((line) => {
      const lower = line.toLowerCase();
      const hits = tokens.filter((t) => lower.includes(t)).length;
      return { line, hits };
    })
    .filter((s) => s.hits >= Math.min(2, tokens.length))
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) {
    return {
      status: "unknown",
      reason:
        "Tidak ditemukan bukti teks yang cocok dengan kriteria ini pada CV; ditandai untuk verifikasi, bukan otomatis gagal.",
      evidence: [],
    };
  }
  return {
    status: "met",
    reason: "Terdapat bukti langsung di CV yang memuat aspek kriteria ini.",
    evidence: scored.slice(0, 3).map((s) => s.line),
  };
}

export interface DemoEvaluation extends CriterionEvaluation {
  /** Items a human reviewer must verify (kept separate from scoring). */
  unverified: string[];
}

export function evaluateCriterion(
  criterion: Criterion,
  lines: string[],
): DemoEvaluation {
  const family = detectFamily(criterion.text);
  let outcome: FamilyOutcome;
  switch (family) {
    case "experience":
      outcome = evaluateExperience(criterion.text, lines);
      break;
    case "english":
      outcome = evaluateEnglish(lines);
      break;
    case "pos":
      outcome = evaluatePos(lines);
      break;
    case "passport":
      outcome = evaluatePassport(lines);
      break;
    case "bnsp":
      outcome = evaluateBnsp(lines);
      break;
    default:
      outcome = evaluateGeneric(criterion.text, lines);
  }
  return {
    criterionId: criterion.id,
    status: outcome.status,
    evidence: outcome.evidence,
    reason: outcome.reason,
    unverified: outcome.unverified ?? [],
  };
}

const NAME_FIELD_RE = /^(?:nama|name)\s*[:\-–]\s*(.+)$/i;
const NAME_LIKE_RE = /^[A-Z][A-Za-z.'’-]*(?:\s+[A-Z][A-Za-z.'’-]*){1,3}$/;
const NOT_NAME_RE =
  /curriculum|resume|riwayat|cv\b|alamat|address|phone|telepon|telp|email|@|https?:\/\/|\d{3,}/i;

export function detectCandidateName(lines: string[]): string | null {
  for (const line of lines.slice(0, 12)) {
    const field = line.match(NAME_FIELD_RE);
    if (field) {
      const name = field[1].trim();
      if (name.length >= 3 && name.length <= 80 && !/\d/.test(name)) return name;
    }
  }
  for (const line of lines.slice(0, 6)) {
    if (line.length < 3 || line.length > 60) continue;
    if (NOT_NAME_RE.test(line)) continue;
    if (/\d/.test(line)) continue;
    if (NAME_LIKE_RE.test(line)) return line.replace(/\s{2,}/g, " ");
  }
  return null;
}

function sectionLines(
  lines: string[],
  headingRe: RegExp,
  max = 8,
): string[] {
  const out: string[] = [];
  let active = false;
  for (const line of lines) {
    const isHeading =
      line.length <= 40 && (/^[A-Z\s:]+$/.test(line) || /^(?:[a-z]+\s*){1,4}:$/i.test(line));
    if (headingRe.test(line) && line.length <= 60) {
      active = true;
      continue;
    }
    if (active) {
      if (isHeading) break;
      for (const part of line.split(/[,;|•·]/)) {
        const p = part.trim();
        if (p.length >= 2 && p.length <= 120) out.push(p);
      }
      if (out.length >= max * 2) break;
    }
  }
  return out.slice(0, max);
}

const EDUCATION_RE =
  /universitas|university|institut|politeknik|akademi|\bsmk\b|\bsma\b|\bs1\b|\bs2\b|\bd3\b|bachelor|master|diploma|degree|sertifikasi|certification|lulus/i;

/** Deterministic demo analysis of one extracted CV against the criteria. */
export function analyzeWithDemo(input: {
  text: string;
  criteria: Criterion[];
}): CandidateAnalysis {
  const lines = splitIntoLines(input.text);
  const candidateName = detectCandidateName(lines);
  const insufficientDocument = input.text.trim().length < 400;

  const demoEvaluations = input.criteria.map((c) => evaluateCriterion(c, lines));
  const evaluations: CriterionEvaluation[] = demoEvaluations.map((e) => ({
    criterionId: e.criterionId,
    status: e.status,
    evidence: e.evidence,
    reason: e.reason,
  }));
  const met = evaluations.filter((e) => e.status === "met").length;
  const notMet = evaluations.filter((e) => e.status === "not_met").length;
  const unknown = evaluations.filter((e) => e.status === "unknown").length;

  const unverified = demoEvaluations.flatMap((e) => {
    const criterion = input.criteria.find((c) => c.id === e.criterionId);
    return e.unverified.map((item) => `[${criterion?.text ?? e.criterionId}] ${item}`);
  });

  const experienceEvidence = demoEvaluations.find(
    (e) =>
      detectFamily(
        input.criteria.find((c) => c.id === e.criterionId)?.text ?? "",
      ) === "experience",
  );
  const roleLines = lines.filter((l) => ROLE_RE.test(l));
  const relevantExperience = (
    experienceEvidence?.evidence.length ? experienceEvidence.evidence : roleLines
  ).slice(0, 4);

  const education = sectionLines(lines, /pendidikan|education|riwayat pendidikan/i);
  const educationFallback =
    education.length > 0
      ? education
      : lines.filter((l) => EDUCATION_RE.test(l)).slice(0, 6);
  const skills = sectionLines(lines, /keahlian|skills?|keterampilan/i);

  const firstProse = lines.find((l) => l.length > 100);
  const summary = insufficientDocument
    ? "Dokumen terlalu singkat untuk disimpulkan. Hasil dinandai 'perlu tinjauan'."
    : `Kandidat${
        candidateName ? ` ${candidateName}` : ""
      }; ${met} dari ${input.criteria.length} kriteria terpenuhi berdasarkan bukti di CV (${notMet} tidak terpenuhi, ${unknown} belum diketahui).${
        firstProse ? ` Catatan awal: ${firstProse.slice(0, 160)}…` : ""
      }`;

  return {
    candidateName,
    summary,
    relevantExperience: relevantExperience.length
      ? relevantExperience
      : lines.filter((l) => /pengalaman|experience/i.test(l)).slice(0, 4),
    education: educationFallback,
    skills,
    evaluations,
    unverified,
    insufficientDocument,
    reasoning: `Mode demo (heuristik lokal, bukan AI): ${met} kriteria terpenuhi, ${notMet} tidak terpenuhi berdasarkan bukti, ${unknown} belum diketahui. Konfigurasikan AI_API_KEY untuk analisis AI nyata dengan penalaran dan kutipan per kandidat.`,
  };
}
