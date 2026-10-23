import { extractText, getDocumentProxy } from "unpdf";

export class ExtractionError extends Error {
  constructor(
    public readonly code: "unreadable" | "encrypted" | "no_text",
    message: string,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export interface PdfExtraction {
  text: string;
  pages: number;
}

/**
 * Extract text from a text-based PDF.
 * Scanned/image-only PDFs yield (almost) no text – that is surfaced as
 * `no_text` so the UI can explain that OCR is not available.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/password|encrypt/i.test(message)) {
      throw new ExtractionError(
        "encrypted",
        "PDF terproteksi kata sandi. Lepaskan proteksi lalu unggah ulang.",
      );
    }
    throw new ExtractionError(
      "unreadable",
      "PDF tidak dapat dibaca atau rusak. Coba ekspor ulang dari sumbernya.",
    );
  }

  try {
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { text: text ?? "", pages: totalPages ?? 0 };
  } catch {
    throw new ExtractionError("unreadable", "Gagal membaca isi PDF.");
  }
}
