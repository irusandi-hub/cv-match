/**
 * Generate synthetic sample CVs for the built-in "The Bali Saudi" demo
 * scenario. Every name, employer and contact detail below is FICTIONAL and
 * generated for testing only — no real person's data is used.
 *
 * Run: bun run generate-samples  (output: public/samples/)
 * Keep the file names in sync with SAMPLE_CVS in src/lib/presets.ts.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";

const OUT_DIR = path.join(process.cwd(), "public", "samples");

// ---------------------------------------------------------------- helpers

function wrap(text, max = 92) {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** Minimal multi-page PDF writer using the built-in Helvetica fonts. */
async function buildPdf(text) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]);
  let y = 792;

  for (const rawLine of text.split("\n")) {
    if (y < 72) {
      page = doc.addPage([595.28, 841.89]);
      y = 792;
    }
    const isHeading =
      rawLine.length > 0 &&
      rawLine === rawLine.toUpperCase() &&
      /[A-Z]/.test(rawLine);
    const font = isHeading ? bold : regular;
    const size = isHeading ? 11 : 10;

    for (const line of wrap(rawLine)) {
      if (line.length === 0) {
        y -= 6;
        continue;
      }
      page.drawText(line, { x: 56, y, size, font, lineHeight: 13 });
      y -= isHeading ? 16 : 13.5;
    }
  }

  return Buffer.from(await doc.save());
}

async function buildDocx(text) {
  const paragraphs = text.split("\n").map((line) => {
    const isHeading =
      line.length > 0 && line === line.toUpperCase() && /[A-Z]/.test(line);
    return new Paragraph({
      spacing: { after: isHeading ? 120 : 60 },
      children: [
        new TextRun({
          text: line || " ",
          bold: isHeading,
          size: isHeading ? 22 : 20,
        }),
      ],
    });
  });
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

// ------------------------------------------------------------- synthetic CVs

const CV_01 = `ALYA RAHMAWATI
Jakarta, Indonesia | alya.sintetis@contoh.test | +62 812-0000-0001

PROFIL
Barista dengan pengalaman 3 tahun di kedai kopi speciality dan restoran hotel.

PENGALAMAN KERJA
Barista - Kopi Senja (Jakarta), 2021-2024
- Menyajikan espresso dan manual brew, menjaga kualitas rasa dan presentasi.
- Mengoperasikan mesin espresso dan grinder harian, merawat kebersihan area bar.
- Melayani rata-rata 150 pelanggan per hari serta menangani transaksi melalui sistem kasir POS Moka.
Bartender - Teras Nusantara (Bandung), 2020-2021
- Meracik minuman standar bar dan menyusun menu minuman musiman.

KEAHLIAN
Espresso extraction, manual brew, latte art, POS Moka, cash handling, pelayanan pelanggan

BAHASA
Bahasa: Indonesia (native), English (professional working proficiency - lisan dan tulisan)

PENDIDIKAN
D3 Manajemen Perhotelan, Politeknik Nusantara, 2017-2020

SERTIFIKASI
Sertifikat Kompetensi Profesional BNSP sebagai Barista, tahun 2022 (nomor sertifikat sintetis-0001).

DOKUMEN
Passport: paspor Indonesia aktif, berlaku hingga 2029 untuk keperluan kerja luar negeri.
Catatan: seluruh data pada CV ini adalah data sintetis untuk pengujian aplikasi.`;

const CV_02 = `BUDI SANTOSO
Surabaya, Indonesia | budi.sintetis@contoh.test

PROFIL
Barista dengan pengalaman 2,5 tahun di kedai kopi speciality.

PENGALAMAN KERJA
Barista - Kopi Pagi (Surabaya), 2022-2024
- Menyajikan kopi dan mengoperasikan mesin espresso setiap hari.
- Kasir dan transaksi tunai/non-tunai menggunakan sistem POS Olsera.
- Berinteraksi dengan pelanggan internasional menggunakan English dan Bahasa Indonesia.

KEAHLIAN
Espresso, milk steaming, POS Olsera, cash handling, pelayanan pelanggan

SERTIFIKASI
Sertifikat pelatihan barista dari asosiasi kopi lokal, tahun 2022.

DOKUMEN
Passport: paspor Indonesia, masa berlaku tidak dinyatakan pada CV.
Catatan: seluruh data pada CV ini adalah data sintetis untuk pengujian aplikasi.`;

const CV_03 = `CITRA LESTARI
Malang, Indonesia | citra.sintetis@contoh.test

PROFIL
Lulusan SMK Perhotelan dengan pengalaman 1 tahun sebagai barista paruh waktu.

PENGALAMAN KERJA
Barista paruh waktu - Kedai Kopi Melati (Malang), 2023-2024
- Membantu penyajian kopi sederhana dan menjaga kebersihan area bar.

KEAHLIAN
Penyajian kopi dasar, pelayanan pelanggan

BAHASA
Bahasa: Indonesia saja

Catatan: seluruh data pada CV ini adalah data sintetis untuk pengujian aplikasi.`;

const CV_04 = `DEWANGGA PRATAMA
Denpasar, Indonesia | dewangga.sintetis@contoh.test

PROFIL
Bartender dengan pengalaman 4 tahun di bar hotel dan beach club.

PENGALAMAN KERJA
Bartender - Beach Club Seminyak (Denpasar), 2020-2024
- Meracik minuman standar bar dan mengelola stok bar mingguan.
- Mengoperasikan sistem kasir POS di area bar untuk transaksi harian.
Bartender - Lounge Nusa (Denpasar), 2019-2020
- Melayani tamu lounge dan mengatur jadwal operasional bar.

KEAHLIAN
Mixology, bar operation, POS kasir, manajemen stok bar

PENDIDIKAN
SMA Negeri Denpasar, lulus tahun 2018.

DOKUMEN
Passport: paspor Indonesia, berlaku sampai 2024 dan perlu perpanjangan.
Catatan: seluruh data pada CV ini adalah data sintetis untuk pengujian aplikasi.`;

const CV_05 = `EKA PUSPITA
Semarang, Indonesia | eka.sintetis@contoh.test

PROFIL
Barista dengan pengalaman 2 tahun di kedai kopi dan hotel bintang empat.

PENGALAMAN KERJA
Barista - Hotel Grand Atlas (Semarang), 2022-2024
- Menyajikan kopi untuk sarapan prasmanan dan layanan kamar.
- Berkoordinasi dengan tim F&B menggunakan Bahasa Inggris dalam pekerjaan harian.
Barista - Kopi Tawang (Semarang), 2022 paruh waktu selama 6 bulan.

KEAHLIAN
Espresso, service sarapan, komunikasi Bahasa Inggris lisan

SERTIFIKASI
Pelatihan barista tingkat kota, tahun 2022.

DOKUMEN
Passport: belum memiliki paspor dan berencana mengurus untuk rencana kerja luar negeri.
Catatan: seluruh data pada CV ini adalah data sintetis untuk pengujian aplikasi.`;

const CV_06 = `Fajar Ardiansyah
Barista paruh waktu.`;

const CV_07 = ""; // Intentionally blank: image-only PDF simulating a scan.

// ---------------------------------------------------------------- run

await mkdir(OUT_DIR, { recursive: true });

const pdfJobs = [
  ["cv-01-alya-rahmawati.pdf", CV_01],
  ["cv-02-budi-santoso.pdf", CV_02],
  ["cv-03-citra-lestari.pdf", CV_03],
  ["cv-04-dewangga-pratama.pdf", CV_04],
  ["cv-06-fajar-incomplete.pdf", CV_06],
  ["cv-07-scan-no-text.pdf", CV_07],
];

for (const [name, text] of pdfJobs) {
  const bytes = await buildPdf(text);
  await writeFile(path.join(OUT_DIR, name), bytes);
  console.log(`wrote ${name} (${bytes.length} bytes)`);
}

const docxBytes = await buildDocx(CV_05);
await writeFile(path.join(OUT_DIR, "cv-05-eka-puspita.docx"), docxBytes);
console.log(`wrote cv-05-eka-puspita.docx (${docxBytes.length} bytes)`);

console.log("Done. Synthetic samples only - no real candidate data.");
