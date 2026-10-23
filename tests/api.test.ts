import { beforeAll, describe, expect, it } from "vitest";
import { extractRouteResponse, type ExtractResponse } from "./support/extract-harness";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as suggestPOST } from "@/app/api/suggest-criteria/route";
import { BALI_SAUDI_CRITERIA, BALI_SAUDI_JOB } from "@/lib/presets";
import { sampleBytes } from "./helpers";

beforeAll(() => {
  // Ensure deterministic demo mode in tests, regardless of the host env.
  delete process.env.AI_API_KEY;
});

describe("POST /api/extract", () => {
  it("extracts text from uploaded PDFs and reports a content hash", async () => {
    const res = await extractRouteResponse([
      { name: "cv-01.pdf", bytes: sampleBytes("cv-01-alya-rahmawati.pdf") },
    ]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractResponse;
    expect(body.docs).toHaveLength(1);
    expect(body.docs[0].text).toContain("ALYA RAHMAWATI");
    expect(body.docs[0].fileId).toMatch(/^[0-9a-f]{64}$/);
    expect(body.errors).toHaveLength(0);
  });

  it("mixes successes and per-file errors in one batch", async () => {
    const res = await extractRouteResponse([
      { name: "cv-02.pdf", bytes: sampleBytes("cv-02-budi-santoso.pdf") },
      { name: "cv.docx", bytes: new TextEncoder().encode("not a real docx") },
    ]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractResponse;
    expect(body.docs).toHaveLength(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].fileName).toBe("cv.docx");
  });

  it("rejects requests without files", async () => {
    const res = await extractRouteResponse([]);
    expect(res.status).toBe(400);
  });

  it("reports the simulated scanned PDF with a clear OCR message", async () => {
    const res = await extractRouteResponse([
      { name: "scan.pdf", bytes: sampleBytes("cv-07-scan-no-text.pdf") },
    ]);
    const body = (await res.json()) as ExtractResponse;
    expect(body.docs).toHaveLength(0);
    expect(body.errors[0].message).toMatch(/OCR/i);
  });
});

describe("POST /api/analyze", () => {
  it("analyzes extracted CVs in demo mode and returns scored results", async () => {
    const res = await analyzePOST(
      new Request("http://test.local/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: BALI_SAUDI_JOB,
          criteria: BALI_SAUDI_CRITERIA,
          documents: [
            {
              fileId: "doc1",
              fileName: "cv-01.pdf",
              text: await extractTextOf("cv-01-alya-rahmawati.pdf"),
            },
            {
              fileId: "doc2",
              fileName: "cv-03.pdf",
              text: await extractTextOf("cv-03-citra-lestari.pdf"),
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mode: string;
      results: {
        fileId: string;
        score: { score: number; requiredUnmet: string[] };
        state: string;
        analysis: { evaluations: unknown[]; candidateName: string | null };
      }[];
      errors: unknown[];
    };

    expect(body.mode).toBe("demo");
    expect(body.errors).toHaveLength(0);
    expect(body.results).toHaveLength(2);

    const strong = body.results.find((r) => r.fileId === "doc1")!;
    const weak = body.results.find((r) => r.fileId === "doc2")!;
    expect(strong.score.score).toBeGreaterThan(weak.score.score);
    expect(strong.analysis.evaluations).toHaveLength(BALI_SAUDI_CRITERIA.length);
    expect(strong.state).toBe("complete");
    expect(weak.state).toBe("incomplete");
  });

  it("rejects invalid payloads with a 400", async () => {
    const res = await analyzePOST(
      new Request("http://test.local/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: BALI_SAUDI_JOB, criteria: [], documents: [] }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON bodies", async () => {
    const res = await analyzePOST(
      new Request("http://test.local/api/analyze", {
        method: "POST",
        body: "bukan-json",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/suggest-criteria", () => {
  it("drafts criteria from a job description in demo mode", async () => {
    const res = await suggestPOST(
      new Request("http://test.local/api/suggest-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: "Barista",
          jobDescription: `Persyaratan:
- Pengalaman minimal 2 tahun sebagai barista.
- Menguasai sistem kasir POS.
- Sertifikat BNSP merupakan nilai tambah.`,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mode: string;
      criteria: { text: string; kind: string; weight: number }[];
    };
    expect(body.mode).toBe("demo");
    expect(body.criteria.length).toBeGreaterThan(0);
    expect(body.criteria.some((c) => /kasir|POS/i.test(c.text))).toBe(true);
    expect(body.criteria.every((c) => c.weight >= 1 && c.weight <= 5)).toBe(true);
  });

  it("rejects descriptions that are too short", async () => {
    const res = await suggestPOST(
      new Request("http://test.local/api/suggest-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: "", jobDescription: "pendek" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

async function extractTextOf(fileName: string): Promise<string> {
  const res = await extractRouteResponse([{ name: fileName, bytes: sampleBytes(fileName) }]);
  const body = (await res.json()) as ExtractResponse;
  const doc = body.docs[0];
  if (!doc) throw new Error(`ekstraksi ${fileName} gagal: ${body.errors[0]?.message}`);
  return doc.text;
}
