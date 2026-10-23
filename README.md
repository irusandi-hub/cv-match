# CV Match

AI-assisted CV screening: paste one job opening, set the criteria, upload dozens of
CVs (PDF/DOCX), get an evidence-based candidate ranking, inspect the evidence per
candidate, and export an Excel-compatible CSV.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**. No database, no
accounts — files are processed **in memory** and never stored.

---

## Cara menjalankan aplikasi

Prasyarat: Node.js 20+ (Bun juga bisa).

```bash
bun install        # atau: npm install
bun run dev        # atau: npm run dev  → http://localhost:3000
```

Alur pemakaian:

1. **01 — Lowongan**: isi nama posisi/deskripsi (atau klik *Isi contoh “The Bali Saudi”*).
   Gunakan *Susun kriteria dari deskripsi* untuk draf kriteria otomatis, lalu tinjau/ubah.
2. **02 — Kriteria**: atur kriteria **wajib** vs **nilai tambah** dan bobot 1–5.
3. **03 — Unggah CV**: unggah banyak PDF/DOCX sekaligus (drag & drop). Status
   ekstraksi tampil per file, file gagal bisa dicoba ulang, duplikat otomatis dilewati.
   Tombol *Gunakan 7 CV contoh* memuat CV sintetis untuk langsung mencoba.
4. **04 — Analisis**: tekan *Jalankan screening*. Pemrosesan berjalan per batch.
5. **05 — Hasil**: tabel peringkat dengan pencarian + filter status, klik baris
   untuk detail bukti per kriteria, lalu *Ekspor CSV (Excel)*.

## Cara menjalankan pengujian

```bash
bun run test        # vitest: 92 pengujian (ekstraksi, skoring, CSV, validasi AI, dll.)
bun run typecheck   # tsc --noEmit
bun run lint        # eslint (next/core-web-vitals + next/typescript)
bun run build       # build produksi Next.js
```

Cakupan pengujian: ekstraksi PDF/DOCX, file rusak/tidak didukung, validasi unggahan
(magic byte, ukuran, jumlah), teks kosong/PDF scan, validasi respons AI (zod),
verifikasi bukti anti-halusinasi, perhitungan skor 0–100, pemisahan status
terpenuhi/tidak terpenuhi/belum diketahui, peringkat kandidat, ekspor CSV
(escaping + proteksi formula injection), kandidat berdata kurang lengkap, dan
ketahanan terhadap instruksi manipulatif (prompt injection) di dalam CV.

## Environment variables

Semua opsional — tanpa variabel apa pun aplikasi tetap jalan dalam **mode demo**.

| Variabel       | Wajib | Default                     | Fungsi                                        |
| -------------- | ----- | --------------------------- | --------------------------------------------- |
| `AI_API_KEY`   | Tidak | —                           | API key untuk endpoint chat-completions yang kompatibel OpenAI. Mengaktifkan **mode AI**. |
| `AI_BASE_URL`  | Tidak | `https://api.openai.com/v1` | Base URL provider (OpenAI, Azure-compatible, vLLM, dsb.).      |
| `AI_MODEL`     | Tidak | `gpt-4o-mini`               | Nama model yang dipakai.                      |

Atur nilai di environment server (pada Freebuff: tab *Settings → Environment* /
*Keys*), lalu restart. Kunci hanya dibaca di sisi server — tidak pernah masuk
bundle browser, log, atau ekspor CSV.

## Cara mengaktifkan integrasi AI

1. Sediakan API key dari penyedia model (mis. OpenAI) sebagai `AI_API_KEY`.
2. Bila perlu, set `AI_BASE_URL` dan `AI_MODEL` sesuai penyedia Anda.
3. Restart aplikasi. Badge di header berubah menjadi **“Mode AI aktif”**.

Pada mode AI, setiap CV dikirim ke endpoint model yang Anda konfigurasi. Respons
model wajib lolos dua lapis pengaman sebelum dipakai:

- **Validasi skema (zod)** — status, jenis, dan panjang setiap field diperiksa.
- **Verifikasi bukti** — setiap kutipan wajib muncul *verbatim* di teks CV;
  kutipan yang tidak ditemukan dibuang, dan status “terpenuhi” tanpa bukti
  tersisa diturunkan menjadi “belum diketahui”.

Sistem prompt juga memerintahkan model memperlakukan isi CV sebagai **data tidak
tepercaya** (menanggulangi prompt injection di dalam dokumen) dan melarang
penilaian berdasarkan nama, usia, jenis kelamin, etnis, agama, disabilitas, atau
atribut pribadi lain.

## Cara menggunakan mode demo

Tanpa `AI_API_KEY`, screening berjalan dengan **heuristik lokal deterministik**
(kata kunci, durasi pengalaman, tanggal paspor, dsb.) — sepenuhnya di server Anda,
tanpa mengirim CV ke pihak mana pun. Hasil ditandai jelas: badge “Mode demo —
bukan AI” dan catatan di bagian hasil. **Hasil demo bukan analisis AI** dan tidak
boleh dipresentasikan sebagai output model.

Contoh lowongan “The Bali Saudi” (Barista/Bartender — Al Khobar) plus 7 CV sintetis
tersedia langsung di aplikasi. CV contoh dibuat oleh `bun run generate-samples`
(`scripts/generate-samples.mjs`) — seluruh nama dan isi adalah **data fiktif**,
bukan kandidat sungguhan.

Skoring (berlaku di kedua mode, dihitung di server, bukan oleh model):

```
skor = 100 × (Σ bobot kriteria berstatus "terpenuhi") / (Σ seluruh bobot)
```

- Kriteria **wajib** dan **nilai tambah** dihitung dan ditampilkan terpisah;
  kriteria wajib yang gagal selalu tampil eksplisit (tabel, detail, CSV).
- Status “belum diketahui” tidak menambah skor, tetapi menandai hasil sebagai
  **belum lengkap** — ketiadaan bukti tidak pernah dianggap kegagalan otomatis.

## Batasan yang masih ada

- **OCR belum tersedia.** PDF hasil scan/gambar tanpa lapisan teks ditolak dengan
  pesan yang jelas (status “no text layer”), bukan diam-diam dinilai.
- **Mode demo adalah heuristik**, bukan AI: cocok untuk alur/uji coba, bukan
  pengganti evaluasi model. Selalu ditandai sebagai demo.
- **Belum diuji pada skala ratusan CV secara nyata.** Upload diproses per batch
  (maksimal 10 file, 8 MB/file, teks maksimal 60.000 karakter per file untuk
  analisis) sehingga puluhan CV nyaman; untuk ratusan, jalankan bertahap dan
  ukur sendiri sebelum mengandalkannya.
- **Tanpa database/autentikasi** (sengaja untuk MVP). Hasil hilang saat halaman
  dimuat ulang; ekspor CSV adalah cara menyimpan hasil.
- **File .doc lama** harus dikonversi ke .docx lebih dulu.
- **Bukan keputusan otomatis.** CV Match memberi rekomendasi berbasis bukti untuk
  HR. Kepatuhan privasi (PDPA dsb.) memerlukan audit tersendiri; aplikasi ini
  hanya membatasi data seminimal mungkin (proses in-memory, tanpa log isi CV,
  tanpa penyimpanan permanen).

## Struktur proyek

```
src/
  app/
    page.tsx                  # Alur screening (client)
    api/extract/              # Ekstraksi PDF/DOCX per batch (in-memory)
    api/analyze/              # Evaluasi + skoring per batch (AI/demo)
    api/suggest-criteria/     # Draf kriteria dari deskripsi lowongan
  lib/
    extract/                  # Validasi berkas, ekstraksi PDF (unpdf) & DOCX (mammoth)
    ai/                       # Konfigurasi AI, prompt, klien model, verifikasi bukti, demo
    scoring.ts                # Skor 0–100, status evaluasi, peringkat (murni, teruji)
    csv.ts                    # Ekspor CSV Excel-safe (BOM, CRLF, anti formula injection)
    presets.ts                # Lowongan contoh “The Bali Saudi” + daftar CV contoh
  components/                 # Form lowongan, editor kriteria, uploader, tabel, detail
scripts/generate-samples.mjs  # Membuat CV sintetis ke public/samples/
tests/                        # 92 pengujian vitest
```

## Keamanan & privasi

- Validasi tipe berkas di server berbasis **magic byte** (%PDF / ZIP), bukan
  ekstensi semata; batas ukuran dan jumlah file ditegakkan di server.
- File diproses di memori lalu dibuang; tidak ada penyimpanan permanen.
- Error ditampilkan sebagai pesan ramah pengguna — tanpa stack trace.
- Isi CV dan API key tidak pernah ditulis ke log aplikasi.
