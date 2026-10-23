import { describe, expect, it } from "vitest";
import {
  EXPORT_HEADERS,
  escapeCsvCell,
  exportFileName,
  resultsToCsv,
  sanitizeCell,
  toCsv,
} from "@/lib/csv";
import type { CandidateResult, Criterion, JobInfo } from "@/lib/types";

describe("escapeCsvCell", () => {
  it("passes plain values through", () => {
    expect(escapeCsvCell("Barista")).toBe("Barista");
  });

  it("quotes cells containing commas", () => {
    expect(escapeCsvCell("kopi, teh")).toBe('"kopi, teh"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvCell('kata "kutip"')).toBe('"kata ""kutip"""');
  });

  it("quotes cells containing newlines", () => {
    expect(escapeCsvCell("baris satu\nbaris dua")).toBe(
      '"baris satu\nbaris dua"',
    );
  });

  it("renders empty values safely", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(0)).toBe("0");
  });
});

describe("sanitizeCell (CSV formula injection)", () => {
  it("neutralizes formulas starting with =, +, -, @, TAB and CR", () => {
    for (const dangerous of ["=SUM(A1:A9)", "+1", "-1", "@cmd", "\tx", "\rx"]) {
      const safe = sanitizeCell(dangerous);
      expect(safe.startsWith("'")).toBe(true);
      expect(safe.slice(1)).toBe(dangerous);
    }
  });

  it("leaves normal text untouched", () => {
    expect(sanitizeCell("Pengalaman 2 tahun")).toBe("Pengalaman 2 tahun");
    expect(sanitizeCell("- Membuat minuman")).toBe("'- Membuat minuman");
  });
});

describe("toCsv", () => {
  it("prefixes a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = toCsv([["a", "b"], ["c", "d"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("a,b\r\nc,d\r\n");
  });

  it("preserves Unicode text", () => {
    const csv = toCsv([["Kopi Kenangan", "中文字", "café ☕"]]);
    expect(csv).toContain("Kopi Kenangan");
    expect(csv).toContain("中文字");
    expect(csv).toContain("café ☕");
  });
});

// ---------------------------------------------------------------- fixtures

const JOB: JobInfo = {
  title: "Barista / Bartender",
  company: "The Bali Saudi (contoh)",
  location: "Al Khobar, Arab Saudi",
  description: "Deskripsi singkat untuk pengujian ekspor.",
};

const CRITERIA: Criterion[] = [
  { id: "exp", text: "Pengalaman minimal 2 tahun", weight: 5, kind: "required" },
  { id: "bnsp", text: "Sertifikat BNSP", weight: 2, kind: "bonus" },
];

function makeResult(overrides: Partial<CandidateResult> = {}): CandidateResult {
  return {
    fileId: "abc123",
    fileName: "cv-sintetis.pdf",
    state: "incomplete",
    analysis: {
      candidateName: "Kandidat Sintetis",
      summary: "Barista dengan pengalaman 3 tahun, paspor perlu verifikasi.",
      relevantExperience: ["Barista di Kopi Senja, 2021-2024"],
      education: ["D3 Manajemen Perhotelan"],
      skills: ["Espresso", "POS"],
      evaluations: [
        {
          criterionId: "exp",
          status: "met",
          evidence: ["pengalaman 3 tahun sebagai barista"],
          reason: "Durasi pengalaman tercatat 3 tahun.",
        },
        {
          criterionId: "bnsp",
          status: "unknown",
          evidence: [],
          reason: "Sertifikat tidak disebutkan.",
        },
      ],
      unverified: ["Masa berlaku paspor tidak dinyatakan di CV"],
      insufficientDocument: false,
      reasoning: "Bukti kuat untuk pengalaman; sertifikat tidak disebutkan.",
    },
    score: {
      score: 71,
      earnedWeight: 5,
      totalWeight: 7,
      requiredTotal: 1,
      requiredMet: 1,
      requiredUnmet: [],
      unknownCriteria: ["Sertifikat BNSP"],
      bonusMet: [],
    },
    ...overrides,
  };
}

describe("resultsToCsv", () => {
  const csv = resultsToCsv([makeResult()], JOB, CRITERIA, "demo");

  it("starts with the documented header row", () => {
    const firstLine = csv.replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(firstLine).toBe(EXPORT_HEADERS.map(escapeCsvCell).join(","));
  });

  it("includes candidate, score, requirement status, evidence and reasoning", () => {
    expect(csv).toContain("Kandidat Sintetis");
    expect(csv).toContain("cv-sintetis.pdf");
    expect(csv).toContain("71");
    expect(csv).toContain("1/1");
    expect(csv).toContain("pengalaman 3 tahun sebagai barista");
    expect(csv).toContain("Durasi pengalaman tercatat 3 tahun.");
    expect(csv).toContain("Masa berlaku paspor tidak dinyatakan di CV");
    expect(csv).toContain("Demo (heuristik lokal)");
  });

  it("contains one data row per result", () => {
    const bodyRows = csv
      .replace(/^\uFEFF/, "")
      .trimEnd()
      .split("\r\n");
    expect(bodyRows).toHaveLength(1 + 1);
  });

  it("guards against formula injection in candidate names", () => {
    const hostile = makeResult();
    hostile.analysis.candidateName = "=HYPERLINK(\"http://evil\")";
    const out = resultsToCsv([hostile], JOB, CRITERIA, "demo");
    expect(out).toContain("'=HYPERLINK");
    expect(out).not.toContain(',"=HYPERLINK');
  });
});

describe("exportFileName", () => {
  it("builds a safe slug from job info", () => {
    expect(exportFileName(JOB)).toBe(
      "cv-match-barista-bartender-the-bali-saudi-contoh.csv",
    );
  });

  it("falls back when the job has no title", () => {
    expect(
      exportFileName({ title: "", company: "", location: "", description: "" }),
    ).toBe("cv-match-screening.csv");
  });
});
