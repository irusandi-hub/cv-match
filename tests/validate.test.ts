import { describe, expect, it } from "vitest";
import {
  MAX_FILES_PER_REQUEST,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  detectTypeByContent,
  getExtension,
  validateFile,
  validateFileBatch,
} from "@/lib/extract/validate";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 body body body");
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe("getExtension", () => {
  it("lowercases the extension", () => {
    expect(getExtension("CV.PDF")).toBe("pdf");
    expect(getExtension("a.b.docx")).toBe("docx");
    expect(getExtension("noext")).toBe("");
  });
});

describe("detectTypeByContent", () => {
  it("finds the PDF header even with leading junk", () => {
    const junk = new Uint8Array([0, 159, 146, 150, ...PDF_BYTES]);
    expect(detectTypeByContent(junk)).toBe("pdf");
  });

  it("detects the DOCX zip header", () => {
    expect(detectTypeByContent(DOCX_BYTES)).toBe("docx");
  });

  it("returns null for unknown content", () => {
    expect(detectTypeByContent(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
});

describe("validateFile", () => {
  it("accepts a real PDF named .pdf", () => {
    const res = validateFile("cv.pdf", PDF_BYTES);
    expect(res).toEqual({ ok: true, type: "pdf" });
  });

  it("rejects content/extension mismatches", () => {
    const res = validateFile("cv.pdf", DOCX_BYTES);
    expect(res.ok).toBe(false);
  });

  it("enforces the per-file size limit", () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(PDF_BYTES, 0);
    const res = validateFile("besar.pdf", big);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejection.code).toBe("too_large");
  });
});

describe("validateFileBatch", () => {
  it("limits the number of files per request", () => {
    const files = Array.from({ length: MAX_FILES_PER_REQUEST + 1 }, (_, i) => ({
      name: `cv-${i}.pdf`,
      size: 10,
    }));
    const res = validateFileBatch(files);
    expect(res?.code).toBe("too_many_files");
  });

  it("limits the total upload size", () => {
    const files = [
      { name: "a.pdf", size: MAX_TOTAL_BYTES - 1 },
      { name: "b.pdf", size: 1024 },
    ];
    const res = validateFileBatch(files);
    expect(res?.code).toBe("too_large");
  });

  it("accepts a normal batch", () => {
    const files = [
      { name: "a.pdf", size: 1024 },
      { name: "b.docx", size: 2048 },
    ];
    expect(validateFileBatch(files)).toBeNull();
  });
});
