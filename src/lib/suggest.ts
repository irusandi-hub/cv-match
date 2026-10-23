import type { Criterion } from "./types";

/**
 * Demo-mode criteria suggestion: extracts checkable criteria candidates from
 * a pasted job description with simple sentence heuristics. The user must
 * always review and edit the result before screening starts — the UI enforces
 * that by presenting suggestions in the editable criteria list, never by
 * auto-starting a screening.
 */

interface SuggestedCriterion {
  text: string;
  kind: "required" | "bonus";
  weight: number;
}

const BONUS_RE =
  /nilai tambah|diutamakan|advantage|nice to have|preferably|preferred|bonus|a plus|plus point/i;
const REQUIRED_RE =
  /wajib|harus|must|required|syarat|minimal|min\.|minimum|at least|primary/i;
const CRITERIA_LIKE_RE =
  /berpengalaman|pengalaman|menguasai|familiar|paham|minimal|must|required|wajib|harus|mampu|bisa|degree|gelar|sertifikat|certificat|bahasa|language|able to|proficient|experience|skilled|keahlian/i;

function cleanLine(line: string): string {
  let text = line.replace(/^[\s•·▪◦*\-–—]+/, "").trim();
  text = text.replace(/^[^.!?\n]{0,60}:\s*/, (m) =>
    /^(catatan|requirements|persyaratan|kualifikasi|qualifications|job ?description|deskripsi)\s*:\s*$/i.test(
      m,
    )
      ? ""
      : m,
  );
  if (text.length > 220) text = `${text.slice(0, 217).trimEnd()}…`;
  return text;
}

export function suggestCriteriaDemo(input: {
  position: string;
  jobDescription: string;
}): SuggestedCriterion[] {
  const lines = input.jobDescription
    .split(/\n|[.;]/)
    .map(cleanLine)
    .filter((l) => l.length >= 15);

  const out: SuggestedCriterion[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!CRITERIA_LIKE_RE.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const isBonus = BONUS_RE.test(line);
    const kind = isBonus ? "bonus" : "required";
    let weight = isBonus ? 2 : REQUIRED_RE.test(line) ? 4 : 3;
    if (/minimal\s*\d+\s*tahun|at least\s*\d+\s*year/i.test(line)) weight = 5;
    out.push({ text: line, kind, weight });
    if (out.length >= 8) break;
  }

  if (out.length === 0) {
    // Fall back to a small, honest default set the user can edit.
    const position = input.position.trim() || "posisi ini";
    out.push(
      {
        text: `Pengalaman kerja relevan untuk posisi ${position}`,
        kind: "required",
        weight: 4,
      },
      {
        text: "Pendidikan dan keahlian teknis sesuai kebutuhan posisi",
        kind: "required",
        weight: 3,
      },
      {
        text: "Kemampuan komunikasi yang baik",
        kind: "required",
        weight: 3,
      },
    );
  }

  return out;
}

let counter = 0;
export function nextCriterionId(): string {
  counter += 1;
  return `c${Date.now().toString(36)}${counter}`;
}

export function toCriteria(
  suggestions: SuggestedCriterion[],
): Criterion[] {
  return suggestions.map((s) => ({
    id: nextCriterionId(),
    text: s.text,
    weight: s.weight,
    kind: s.kind,
  }));
}
