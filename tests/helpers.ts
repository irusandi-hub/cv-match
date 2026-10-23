import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";

/** Build a simple text PDF in memory (Helvetica, one page per ~60 lines). */
export async function makePdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595.28, 841.89]);
  let y = 792;

  for (const line of text.split("\n")) {
    if (y < 72) {
      page = doc.addPage([595.28, 841.89]);
      y = 792;
    }
    if (line.length === 0) {
      y -= 8;
      continue;
    }
    // Keep lines narrow enough for the page.
    const clipped = line.length > 90 ? line.slice(0, 90) : line;
    page.drawText(clipped, { x: 56, y, size: 10, font });
    y -= 14;
  }
  return new Uint8Array(await doc.save());
}

/** Build a one-paragraph DOCX in memory. */
export async function makeDocx(text: string): Promise<Uint8Array> {
  const doc = new Document({
    sections: [
      {
        children: text
          .split("\n")
          .filter((l) => l.length > 0)
          .map(
            (line) =>
              new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }),
          ),
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Read a committed synthetic sample from public/samples. */
export function sampleBytes(fileName: string): Uint8Array {
  return new Uint8Array(
    readFileSync(path.join(process.cwd(), "public", "samples", fileName)),
  );
}

export function sampleText(fileName: string): string {
  return new TextDecoder().decode(sampleBytes(fileName));
}
