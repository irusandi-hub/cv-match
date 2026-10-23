import type { Criterion, JobInfo } from "./types";

/**
 * First test case: "The Bali Saudi" — a fictional Barista/Bartender opening in
 * Al Khobar, Saudi Arabia, used as the built-in demo scenario.
 */

export const BALI_SAUDI_JOB: JobInfo = {
  title: "Barista / Bartender",
  company: "The Bali Saudi (contoh)",
  location: "Al Khobar, Arab Saudi",
  description: `Kami membuka kesempatan untuk posisi Barista / Bartender di Al Khobar, Arab Saudi.

Tanggung jawab utama:
- Menyajikan kopi dan minuman sesuai standar, menjaga kualitas rasa dan presentasi.
- Mengoperasikan mesin espresso dan peralatan bar, merawat kebersihan area kerja.
- Melayani pelanggan dengan ramah dan menangani transaksi melalui sistem kasir/POS.

Persyaratan:
- Pengalaman minimal 2 tahun sebagai Barista atau Bartender.
- Kemampuan bahasa Inggris lisan dan tulisan yang baik (komunikasi dengan tim internasional).
- Familiar dengan POS dan sistem kasir.
- Memiliki paspor yang masih berlaku (migrasi kerja ke Arab Saudi).

Nilai tambah:
- Sertifikat Kompetensi Profesional BNSP bidang Barista atau Bartending.`,
};

export const BALI_SAUDI_CRITERIA: Criterion[] = [
  {
    id: "exp-2yr",
    text: "Pengalaman relevan minimal 2 tahun sebagai Barista atau Bartender",
    weight: 5,
    kind: "required",
  },
  {
    id: "english",
    text: "Kemampuan bahasa Inggris lisan dan tulisan yang baik",
    weight: 4,
    kind: "required",
  },
  {
    id: "pos",
    text: "Familiar dengan POS dan sistem kasir",
    weight: 3,
    kind: "required",
  },
  {
    id: "passport",
    text: "Memiliki paspor yang masih berlaku",
    weight: 3,
    kind: "required",
  },
  {
    id: "bnsp",
    text: "Sertifikat Kompetensi Profesional BNSP bidang Barista atau Bartending",
    weight: 2,
    kind: "bonus",
  },
];

/** Sample CV files shipped in public/samples (synthetic data, no real people). */
export interface SampleCv {
  file: string;
  label: string;
  note: string;
}

export const SAMPLE_CVS: SampleCv[] = [
  {
    file: "cv-01-alya-rahmawati.pdf",
    label: "CV 01 — profil kuat",
    note: "3 tahun barista, Inggris, POS, paspor berlaku, bersertifikat BNSP",
  },
  {
    file: "cv-02-budi-santoso.pdf",
    label: "CV 02 — paspor tanpa tanggal",
    note: "2,5 tahun barista, Inggris, POS, paspor disebut tanpa masa berlaku",
  },
  {
    file: "cv-03-citra-lestari.pdf",
    label: "CV 03 — pengalaman kurang",
    note: "1 tahun pengalaman, tanpa POS, tanpa paspor",
  },
  {
    file: "cv-04-dewangga-pratama.pdf",
    label: "CV 04 — paspor kedaluwarsa",
    note: "4 tahun bartender, paspor kedaluwarsa, Inggris tidak dinyatakan",
  },
  {
    file: "cv-05-eka-puspita.docx",
    label: "CV 05 — DOCX",
    note: "Format DOCX: 2 tahun barista, Inggris, tanpa BNSP",
  },
  {
    file: "cv-06-fajar-incomplete.pdf",
    label: "CV 06 — sangat singkat",
    note: "CV hampir kosong: status 'perlu tinjauan'",
  },
  {
    file: "cv-07-scan-no-text.pdf",
    label: "CV 07 — hasil scan",
    note: "PDF tanpa lapisan teks: ditolak dengan pesan jelas (OCR belum tersedia)",
  },
];
