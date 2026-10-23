import { createHash } from "node:crypto";
import type { ExtractedDoc } from "../types";
import { extractDocxText } from "./docx";
import { ExtractionError, extractPdfText } from "./pdf";
import { validateFile } from "./validate";

export * from "./validate";
export { ExtractionError };
export type { ExtractedDoc } from "../types";

/** Minimum characters of extracted text before a document is considered unreadable. */
export const MIN_TEXT_CHARS = 30;

export interface FileExtractError {
  fileName: string;
  code: string;
  message: string;
}

export type FileExtractResult =
  | { ok: true; doc: ExtractedDoc }
  | { ok: false; error: FileExtractError };

/** Collapse whitespace so downstream matching is predictable. */
export function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Extract text from one uploaded file.
 *
 * - Validates extension, magic bytes and size before parsing.
 * - Detects documents with no/sparse text (scanned PDFs) instead of sending
 *   empty content downstream to the AI evaluator.
 * - Never stores the file; processing happens fully in memory and the bytes
 *   are dropped as soon as text is extracted.
 */
export async function extractFromFile(input: {
  name: string;
  bytes: Uint8Array;
}): Promise<FileExtractResult> {
  const { name, bytes } = input;
  const valid = validateFile(name, bytes);
  if (!valid.ok) {
    return { ok: false, error: { fileName: name, ...valid.rejection } };
  }

  let raw: { text: string; pages: number | null };
  try {
    raw =
      valid.type === "pdf"
        ? await extractPdfText(bytes)
        : await extractDocxText(bytes);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return { ok: false, error: { fileName: name, code: err.code, message: err.message } };
    }
    return {
      ok: false,
      error: {
        fileName: name,
        code: "unreadable",
        message: `Gagal memproses "${name}".`,
      },
    };
  }

  const text = normalizeText(raw.text);

  if (text.length < MIN_TEXT_CHARS) {
    const scanned = valid.type === "pdf";
    return {
      ok: false,
      error: {
        fileName: name,
        code: "no_text",
        message: scanned
          ? `"${name}": tidak ditemukan lapisan teks (kemungkinan hasil scan/gambar). OCR belum tersedia, jadi file ini tidak dinilai.`
          : `"${name}": isi dokumen kosong atau tidak berisi teks yang dapat dibaca.`,
      },
    };
  }

  return {
    ok: true,
    doc: {
      fileId: hashBytes(bytes),
      fileName: name,
      text,
      charCount: text.length,
      pages: raw.pages,
    },
  };
}
