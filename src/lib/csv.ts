import { EVALUATION_STATE_LABEL } from "./scoring";
import type { AnalysisMode, CandidateResult, Criterion, JobInfo } from "./types";

/**
 * CSV export compatible with Excel (UTF-8 BOM, CRLF, RFC 4180 quoting).
 *
 * - Cells containing commas, quotes or newlines are quoted correctly.
 * - Cells starting with =, +, -, @, TAB or CR are prefixed with a single
 *   quote so Excel does not execute them as formulas (CSV injection).
 */

const NEEDS_QUOTING = /[",\n\r]/;
const FORMULA_START = /^[=+\-@\t\r]/;

export function sanitizeCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = sanitizeCell(String(value));
  if (NEEDS_QUOTING.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build the full CSV document (with BOM and CRLF line endings). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}

export const EXPORT_HEADERS = [
  "Peringkat",
  "Nama Kandidat",
  "Nama File",
  "Skor Kecocokan",
  "Status Evaluasi",
  "Persyaratan Wajib Terpenuhi",
  "Persyaratan Wajib Belum Terpenuhi",
  "Kriteria Belum Diketahui",
  "Nilai Tambah Terpenuhi",
  "Ringkasan",
  "Pengalaman Relevan",
  "Keterampilan Utama",
  "Pendidikan & Sertifikasi",
  "Informasi Untuk Diverifikasi",
  "Rincian Penilaian per Kriteria",
  "Alasan Penilaian",
  "Mode Analisis",
] as const;

function joinList(items: string[], sep = " | "): string {
  return items.map((i) => i.replace(/\s+/g, " ").trim()).join(sep);
}

/** One detailed cell per criterion: text, status, reason, evidence quotes. */
function criterionDetails(
  result: CandidateResult,
  criteria: Criterion[],
): string {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  return result.analysis.evaluations
    .map((ev) => {
      const criterion = byId.get(ev.criterionId);
      const label = criterion?.text ?? ev.criterionId;
      const kind = criterion?.kind === "bonus" ? " [nilai tambah]" : " [wajib]";
      const quotes = ev.evidence.length
        ? ` Bukti: ${ev.evidence.map((q) => `"${q}"`).join(" ; ")}`
        : "";
      return `${label}${kind}: ${ev.status} — ${ev.reason}${quotes}`;
    })
    .join("\n");
}

export function buildExportRows(
  rankedResults: CandidateResult[],
  job: JobInfo,
  criteria: Criterion[],
  mode: AnalysisMode,
): (string | number)[][] {
  const rows: (string | number)[][] = [([...EXPORT_HEADERS] as string[]).slice()];

  rankedResults.forEach((result, index) => {
    const { analysis, score, state } = result;
    rows.push([
      index + 1,
      analysis.candidateName ?? "(nama tidak ditemukan di CV)",
      result.fileName,
      score.score,
      EVALUATION_STATE_LABEL[state],
      `${score.requiredMet}/${score.requiredTotal}`,
      score.requiredUnmet.length ? joinList(score.requiredUnmet, "; ") : "-",
      score.unknownCriteria.length ? joinList(score.unknownCriteria, "; ") : "-",
      score.bonusMet.length ? joinList(score.bonusMet, "; ") : "-",
      analysis.summary,
      joinList(analysis.relevantExperience),
      joinList(analysis.skills, "; "),
      joinList(analysis.education, "; "),
      analysis.unverified.length ? joinList(analysis.unverified, "\n") : "-",
      criterionDetails(result, criteria),
      analysis.reasoning,
      mode === "ai" ? "AI" : "Demo (heuristik lokal)",
    ]);
  });

  return rows;
}

export function resultsToCsv(
  rankedResults: CandidateResult[],
  job: JobInfo,
  criteria: Criterion[],
  mode: AnalysisMode,
): string {
  return toCsv(buildExportRows(rankedResults, job, criteria, mode));
}

export function exportFileName(job: JobInfo): string {
  const slug =
    `${job.title}-${job.company}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "screening";
  return `cv-match-${slug}.csv`;
}
