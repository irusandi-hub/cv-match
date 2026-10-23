import { describe, expect, it } from "vitest";
import {
  MIN_TEXT_CHARS,
  extractFromFile,
  hashBytes,
  normalizeText,
} from "@/lib/extract";
import { makeDocx, makePdf, sampleBytes } from "./helpers";

const LONG_CV = `JOHN DOE
Profesional dengan pengalaman panjang di bidang layanan pelanggan dan
operasional harian yang membutuhkan teks yang cukup panjang agar lolos
ambang minimal karakter ekstraksi dokumen.`;

describe("extractFromFile", () => {
  it("extracts text from a text-based PDF", async () => {
    const bytes = await makePdf(LONG_CV);
    const result = await extractFromFile({ name: "cv.pdf", bytes });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.text).toContain("JOHN DOE");
    expect(result.doc.charCount).toBeGreaterThan(MIN_TEXT_CHARS);
    expect(result.doc.pages).toBeGreaterThanOrEqual(1);
    expect(result.doc.fileId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("extracts text from a DOCX file", async () => {
    const bytes = await makeDocx(LONG_CV);
    const result = await extractFromFile({ name: "cv.docx", bytes });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.text).toContain("JOHN DOE");
  });

  it("extracts the committed synthetic sample PDFs", async () => {
    const bytes = sampleBytes("cv-01-alya-rahmawati.pdf");
    const result = await extractFromFile({ name: "cv-01.pdf", bytes });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.text).toContain("ALYA RAHMAWATI");
  });

  it("rejects a PDF without a text layer (simulated scan) with a clear message", async () => {
    const bytes = await makePdf("");
    const result = await extractFromFile({ name: "scan.pdf", bytes });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("no_text");
    expect(result.error.message).toMatch(/scan|OCR/i);
  });

  it("rejects a corrupt PDF that only has a %PDF header", async () => {
    const corrupt = new TextEncoder().encode(
      "%PDF-1.7\nthis is not a real pdf body",
    );
    const result = await extractFromFile({ name: "rusak.pdf", bytes: corrupt });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unreadable");
  });

  it("rejects unsupported extensions", async () => {
    const result = await extractFromFile({
      name: "cv.exe",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_type");
  });

  it("tells the user to convert legacy .doc files", async () => {
    const result = await extractFromFile({
      name: "cv-lama.doc",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/docx/i);
  });

  it("rejects a PDF whose content is not actually a PDF", async () => {
    const fake = new TextEncoder().encode("PK\u0003\u0004 plain text file");
    const result = await extractFromFile({ name: "palsu.pdf", bytes: fake });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("mismatched_content");
  });

  it("rejects a .docx whose content is a PDF", async () => {
    const bytes = await makePdf(LONG_CV);
    const result = await extractFromFile({ name: "salah.docx", bytes });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("mismatched_content");
  });

  it("rejects empty files", async () => {
    const result = await extractFromFile({
      name: "kosong.pdf",
      bytes: new Uint8Array(0),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("empty_file");
  });

  it("produces stable content hashes for duplicate detection", async () => {
    const a = await makePdf(LONG_CV);
    const b = await makePdf(LONG_CV);
    expect(hashBytes(a)).toBe(hashBytes(b));
  });
});

describe("normalizeText", () => {
  it("collapses whitespace and strips null bytes", () => {
    expect(normalizeText("a \t b\u0000c\r\n\nd")).toBe("a bc\n\nd");
  });
});
