"use client";

import { useCallback, useRef, useState } from "react";
import { CriteriaEditor } from "@/components/CriteriaEditor";
import { JobPanel } from "@/components/JobPanel";
import { CandidateDetail } from "@/components/CandidateDetail";
import { ModeBanner, SectionHeader } from "@/components/bits";
import {
  ResultsTable,
  type StatusFilter,
} from "@/components/ResultsTable";
import {
  Uploader,
  type UploadFileEntry,
  type UploadFileStatus,
} from "@/components/Uploader";
import { MAX_ANALYZE_DOCS } from "@/lib/schemas";
import { MAX_FILES_PER_REQUEST as MAX_EXTRACT_FILES } from "@/lib/extract/validate";
import { exportFileName, resultsToCsv } from "@/lib/csv";
import { BALI_SAUDI_CRITERIA, BALI_SAUDI_JOB, SAMPLE_CVS } from "@/lib/presets";
import { rankResults } from "@/lib/scoring";
import { nextCriterionId } from "@/lib/suggest";
import type {
  AnalysisMode,
  CandidateResult,
  Criterion,
  CriterionKind,
  ExtractedDoc,
  JobInfo,
} from "@/lib/types";

const EMPTY_JOB: JobInfo = {
  title: "",
  company: "",
  location: "",
  description: "",
};

interface AnalyzeErrorRow {
  fileName: string;
  message: string;
}

export default function HomePage() {
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [results, setResults] = useState<CandidateResult[] | null>(null);
  const [analyzeErrors, setAnalyzeErrors] = useState<AnalyzeErrorRow[]>([]);
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<CandidateResult | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const seenHashesRef = useRef<Map<string, string>>(new Map());
  const keyCounter = useRef(0);

  const validCriteria = criteria.filter((c) => c.text.trim().length >= 3);
  const readyFiles = files.filter((f) => f.status === "ready" && f.doc);
  const canRun =
    job.title.trim().length > 0 &&
    validCriteria.length > 0 &&
    readyFiles.length > 0 &&
    !analyzing &&
    !extractionBusy;

  const handleCriteriaChange = useCallback(
    (next: Criterion[]) => {
      setCriteria(next);
      // Scores depend on criteria — stale results must not linger.
      setResults((prev) => (prev ? null : prev));
      setAnalyzeErrors([]);
    },
    [],
  );

  const extractEntries = useCallback(async (entries: UploadFileEntry[]) => {
    if (entries.length === 0) return;
    const keys = new Set(entries.map((e) => e.key));
    setExtractionBusy(true);
    setFiles((prev) =>
      prev.map((f) =>
        keys.has(f.key) ? { ...f, status: "extracting" as UploadFileStatus } : f,
      ),
    );

    for (let i = 0; i < entries.length; i += MAX_EXTRACT_FILES) {
      const chunk = entries.slice(i, i + MAX_EXTRACT_FILES);
      const updates = new Map<string, Partial<UploadFileEntry>>();

      const formData = new FormData();
      chunk.forEach((e) => formData.append("files", e.source, e.name));

      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as {
          docs?: ExtractedDoc[];
          errors?: { fileName: string; message: string }[];
          error?: string;
        };

        if (!res.ok) {
          const message = data.error ?? "Gagal memproses batch file.";
          chunk.forEach((e) =>
            updates.set(e.key, { status: "error", error: message, doc: undefined }),
          );
        } else {
          const byName = new Map<string, UploadFileEntry[]>();
          chunk.forEach((e) => {
            const list = byName.get(e.name) ?? [];
            list.push(e);
            byName.set(e.name, list);
          });
          const takeByName = (name: string): UploadFileEntry | undefined => {
            const list = byName.get(name);
            return list && list.length > 0 ? list.shift() : undefined;
          };

          for (const doc of data.docs ?? []) {
            const target = takeByName(doc.fileName);
            if (!target) continue;
            const existing = seenHashesRef.current.get(doc.fileId);
            if (existing) {
              updates.set(target.key, {
                status: "duplicate",
                doc: undefined,
                error: `Konten sama dengan "${existing}" — dilewati.`,
              });
            } else {
              seenHashesRef.current.set(doc.fileId, doc.fileName);
              updates.set(target.key, { status: "ready", doc, error: undefined });
            }
          }

          for (const err of data.errors ?? []) {
            const target = takeByName(err.fileName);
            if (!target) continue;
            updates.set(target.key, {
              status: "error",
              doc: undefined,
              error: err.message,
            });
          }

          chunk.forEach((e) => {
            if (!updates.has(e.key)) {
              updates.set(e.key, {
                status: "error",
                doc: undefined,
                error: "File tidak diproses oleh server.",
              });
            }
          });
        }
      } catch {
        chunk.forEach((e) =>
          updates.set(e.key, {
            status: "error",
            doc: undefined,
            error: "Tidak dapat terhubung ke server ekstraksi.",
          }),
        );
      }

      setFiles((prev) =>
        prev.map((f) =>
          keys.has(f.key) && updates.has(f.key)
            ? { ...f, ...updates.get(f.key) }
            : f,
        ),
      );
    }

    setExtractionBusy(false);
  }, []);

  const addFiles = useCallback(
    async (list: File[]) => {
      if (list.length === 0) return;
      const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
      const entries: UploadFileEntry[] = [];
      let skipped = 0;

      for (const file of list) {
        const sig = `${file.name}:${file.size}`;
        if (seen.has(sig)) {
          skipped += 1;
          continue;
        }
        seen.add(sig);
        const lower = file.name.toLowerCase();
        const supported = lower.endsWith(".pdf") || lower.endsWith(".docx");
        entries.push({
          key: `f${(keyCounter.current += 1)}`,
          name: file.name,
          size: file.size,
          status: supported ? "queued" : "error",
          error: supported
            ? undefined
            : "Tipe berkas tidak didukung. Gunakan PDF atau DOCX.",
          source: file,
        });
      }

      setFiles((prev) => [...prev, ...entries]);
      if (skipped > 0) {
        setNotice(
          `${skipped} file dilewati karena duplikat (nama dan ukuran sama dengan file yang sudah ada).`,
        );
      }
      await extractEntries(entries.filter((e) => e.status === "queued"));
    },
    [files, extractEntries],
  );

  const retryFile = useCallback(
    async (key: string) => {
      const entry = files.find((f) => f.key === key);
      if (!entry) return;
      await extractEntries([{ ...entry, status: "queued" }]);
    },
    [files, extractEntries],
  );

  const removeFile = useCallback((key: string) => {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const loadSamples = useCallback(async () => {
    setSamplesLoading(true);
    try {
      const fetched: File[] = [];
      for (const sample of SAMPLE_CVS) {
        try {
          const res = await fetch(`/samples/${sample.file}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          fetched.push(
            new File([blob], sample.file, {
              type: blob.type || "application/octet-stream",
            }),
          );
        } catch {
          // Skip individual sample that fails to load.
        }
      }
      await addFiles(fetched);
      setNotice(
        "CV contoh dimuat — seluruhnya data sintetis fiktif untuk pengujian.",
      );
    } finally {
      setSamplesLoading(false);
    }
  }, [addFiles]);

  const applyPreset = useCallback(() => {
    setJob(BALI_SAUDI_JOB);
    setCriteria(BALI_SAUDI_CRITERIA);
    setResults(null);
    setNotice(
      "Lowongan contoh “The Bali Saudi” dimuat. Tinjau kriteria sebelum screening.",
    );
    document.getElementById("lowongan")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const suggestCriteria = useCallback(async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/suggest-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: job.title,
          jobDescription: job.description,
        }),
      });
      const data = (await res.json()) as {
        mode?: AnalysisMode;
        criteria?: { text: string; kind: CriterionKind; weight: number }[];
        error?: string;
      };
      if (!res.ok || !data.criteria) {
        setNotice(data.error ?? "Gagal menyusun kriteria.");
        return;
      }
      setMode(data.mode ?? "demo");
      setCriteria(
        data.criteria.map((c) => ({
          id: nextCriterionId(),
          text: c.text,
          weight: Math.min(5, Math.max(1, Math.round(c.weight))),
          kind: c.kind,
        })),
      );
      setResults(null);
      setNotice(
        `${data.criteria.length} kriteria disusun dari deskripsi. Tinjau dan ubah sebelum screening.`,
      );
      document.getElementById("kriteria")?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setNotice("Tidak dapat terhubung ke server.");
    } finally {
      setSuggesting(false);
    }
  }, [job.title, job.description]);

  const runScreening = useCallback(async () => {
    if (!canRun) return;
    setAnalyzing(true);
    setAnalyzeErrors([]);
    setProgress({ done: 0, total: readyFiles.length });

    const collected: CandidateResult[] = [];
    const errors: AnalyzeErrorRow[] = [];

    for (let i = 0; i < readyFiles.length; i += MAX_ANALYZE_DOCS) {
      const chunk = readyFiles.slice(i, i + MAX_ANALYZE_DOCS);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job,
            criteria: validCriteria,
            documents: chunk.map((f) => ({
              fileId: f.doc!.fileId,
              fileName: f.name,
              text: f.doc!.text,
            })),
          }),
        });
        const data = (await res.json()) as {
          mode?: AnalysisMode;
          results?: CandidateResult[];
          errors?: AnalyzeErrorRow[];
          error?: string;
        };
        if (!res.ok) {
          errors.push({
            fileName: `Batch ${Math.floor(i / MAX_ANALYZE_DOCS) + 1}`,
            message: data.error ?? "Gagal menganalisis batch.",
          });
        } else {
          if (data.mode) setMode(data.mode);
          collected.push(...(data.results ?? []));
          errors.push(...(data.errors ?? []));
        }
      } catch {
        errors.push({
          fileName: `Batch ${Math.floor(i / MAX_ANALYZE_DOCS) + 1}`,
          message: "Tidak dapat terhubung ke server analisis.",
        });
      }
      setProgress({
        done: Math.min(i + MAX_ANALYZE_DOCS, readyFiles.length),
        total: readyFiles.length,
      });
    }

    setResults(rankResults(collected));
    setAnalyzeErrors(errors);
    setAnalyzing(false);
    requestAnimationFrame(() =>
      document.getElementById("hasil")?.scrollIntoView({ behavior: "smooth" }),
    );
  }, [canRun, job, readyFiles, validCriteria]);

  const exportCsv = useCallback(() => {
    if (!results) return;
    setExporting(true);
    try {
      const csv = resultsToCsv(
        results,
        job,
        validCriteria,
        mode ?? "demo",
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName(job);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [results, job, validCriteria, mode]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-mono text-lg font-bold text-white">
              CM
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                CV <span className="text-accent">Match</span>
              </h1>
              <p className="text-sm text-muted">
                Skrining puluhan CV untuk satu lowongan — ekstraksi nyata,
                penilaian berbasis bukti, ekspor Excel.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeBanner mode={mode} />
        </div>
      </header>

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm">
          <span>{notice}</span>
          <button
            type="button"
            className="btn btn-quiet px-2 py-0.5"
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      <ol className="mb-8 flex flex-wrap gap-2" aria-label="Alur screening">
        {[
          { n: "01", label: "Lowongan", done: job.title.trim().length > 0 },
          { n: "02", label: "Kriteria", done: validCriteria.length > 0 },
          { n: "03", label: "Unggah CV", done: readyFiles.length > 0 },
          {
            n: "04",
            label: "Analisis",
            done: analyzing || (progress.done > 0 && progress.done >= progress.total),
          },
          { n: "05", label: "Hasil & ekspor", done: (results?.length ?? 0) > 0 },
        ].map((s) => (
          <li
            key={s.n}
            className={`chip ${s.done ? "chip-met" : "chip-neutral"}`}
          >
            {s.n} · {s.label}
            {s.done ? " ✓" : ""}
          </li>
        ))}
      </ol>

      <div className="space-y-6">
        <JobPanel
          job={job}
          onChange={setJob}
          onPreset={applyPreset}
          onSuggest={suggestCriteria}
          suggesting={suggesting}
        />

        <CriteriaEditor
          criteria={criteria}
          onChange={handleCriteriaChange}
        />

        <Uploader
          files={files}
          onAdd={addFiles}
          onRetry={retryFile}
          onRemove={removeFile}
          onUseSamples={loadSamples}
          samplesLoading={samplesLoading}
        />

        <section className="card p-6">
          <SectionHeader
            step="04 — Analisis"
            title="Jalankan screening"
            hint="File diekstrak lalu dinilai terhadap seluruh kriteria. Bila API model belum dikonfigurasi, screening berjalan dalam mode demo yang ditandai jelas."
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary px-6"
              onClick={runScreening}
              disabled={!canRun}
            >
              {analyzing ? "Menganalisis…" : "Jalankan screening"}
            </button>
            <span className="text-sm text-muted">
              {readyFiles.length} CV siap · {validCriteria.length} kriteria
              {validCriteria.length < criteria.length
                ? ` (${criteria.length - validCriteria.length} kriteria kosong diabaikan)`
                : ""}
            </span>
            {analyzing && (
              <span className="font-mono text-sm text-accent">
                {progress.done}/{progress.total} file
              </span>
            )}
          </div>

          {!canRun && !analyzing && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {job.title.trim().length === 0 && (
                <li>• Isi nama posisi terlebih dahulu.</li>
              )}
              {validCriteria.length === 0 && (
                <li>• Tambahkan minimal satu kriteria skrining.</li>
              )}
              {readyFiles.length === 0 && (
                <li>• Unggah minimal satu CV yang berhasil diekstrak.</li>
              )}
            </ul>
          )}

          {analyzeErrors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl border border-danger/30 bg-danger-soft/60 px-3 py-2 text-xs text-danger">
              {analyzeErrors.map((e, i) => (
                <li key={i}>
                  <strong>{e.fileName}</strong>: {e.message}
                </li>
              ))}
            </ul>
          )}

          {mode === "demo" && results && results.length > 0 && (
            <p className="mt-4 rounded-xl border border-bonus/40 bg-bonus-soft px-3 py-2 text-xs text-bonus">
              Hasil ini dihasilkan <strong>mode demo (heuristik lokal)</strong>,
              bukan model AI. Konfigurasikan <code className="font-mono">AI_API_KEY</code> di
              environment server untuk analisis AI nyata dengan kutipan bukti per
              kandidat.
            </p>
          )}
        </section>

        {results && (
          <ResultsTable
            results={results}
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
            onOpen={setSelected}
            onExport={exportCsv}
            exporting={exporting}
            mode={mode}
          />
        )}
      </div>

      <footer className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          <strong className="text-ink">Privasi:</strong> CV diproses di memori
          server dan tidak disimpan permanen; isi CV tidak dicatat ke log. Dalam
          mode AI, teks CV dikirim ke penyedia model yang Anda konfigurasi
          sendiri.
        </p>
        <p className="mt-2">
          <strong className="text-ink">Catatan:</strong> CV Match memberi
          rekomendasi berbasis bukti untuk membantu proses HR — bukan keputusan
          penolakan otomatis. Nama, usia, jenis kelamin, etnis, agama, dan sifat
          pribadi lain tidak pernah digunakan sebagai dasar penilaian.
        </p>
      </footer>

      {selected && (
        <CandidateDetail
          result={selected}
          criteria={validCriteria}
          job={job}
          mode={mode}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
