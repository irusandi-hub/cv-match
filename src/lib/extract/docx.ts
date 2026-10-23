import mammoth from "mammoth";
import { ExtractionError } from "./pdf";

export interface DocxExtraction {
  text: string;
  pages: null;
}

/** Extract raw text from a DOCX (OOXML zip) document. */
export async function extractDocxText(
  bytes: Uint8Array,
): Promise<DocxExtraction> {
  let result: { value: string };
  try {
    result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/password|encrypt/i.test(message)) {
      throw new ExtractionError(
        "encrypted",
        "DOCX terproteksi kata sandi. Lepaskan proteksi lalu unggah ulang.",
      );
    }
    throw new ExtractionError(
      "unreadable",
      "DOCX tidak dapat dibaca (bukan berkas Word yang valid atau rusak).",
    );
  }
  return { text: result.value ?? "", pages: null };
}
