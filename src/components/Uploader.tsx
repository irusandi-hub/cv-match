import { useRef, useState } from "react";
import type { ExtractedDoc } from "@/lib/types";
import { MAX_FILE_BYTES, MAX_FILES_PER_REQUEST } from "@/lib/extract/validate";
import { SectionHeader, formatBytes } from "./bits";

export type UploadFileStatus =
  | "queued"
  | "extracting"
  | "ready"
  | "error"
  | "duplicate";

export interface UploadFileEntry {
  key: string;
  name: string;
  size: number;
  status: UploadFileStatus;
  error?: string;
  doc?: ExtractedDoc;
  source: File;
}

const STATUS_META: Record<
  UploadFileStatus,
  { label: string; cls: string }
> = {
  queued: { label: "Antre", cls: "chip-neutral" },
  extracting: { label: "Memproses…", cls: "chip-unknown" },
  ready: { label: "Siap", cls: "chip-met" },
  error: { label: "Gagal", cls: "chip-not-met" },
  duplicate: { label: "Duplikat", cls: "chip-bonus" },
};

export function Uploader({
  files,
  onAdd,
  onRetry,
  onRemove,
  onUseSamples,
  samplesLoading,
}: {
  files: UploadFileEntry[];
  onAdd: (list: File[]) => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
  onUseSamples: () => void;
  samplesLoading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const counts = files.reduce(
    (acc, f) => {
      acc[f.status] += 1;
      return acc;
    },
    { queued: 0, extracting: 0, ready: 0, error: 0, duplicate: 0 },
  );

  const accept = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onAdd(Array.from(list));
  };

  return (
    <section id="unggah" className="card p-6">
      <SectionHeader
        step="03 — Unggah CV"
        title="Kumpulkan CV kandidat"
        hint={`PDF dan DOCX, maksimal ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB per file dan ${MAX_FILES_PER_REQUEST} file per batch. File tidak disimpan permanen — teks diekstrak lalu berkas dibuang.`}
        right={
          <button
            type="button"
            className="btn btn-quiet"
            onClick={onUseSamples}
            disabled={samplesLoading}
          >
            {samplesLoading ? "Menyiapkan…" : "Gunakan 7 CV contoh"}
          </button>
        }
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Unggah file CV"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line bg-white/50 hover:border-accent/60"
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
      >
        <div className="text-3xl" aria-hidden>
          📄
        </div>
        <p className="mt-2 text-sm font-semibold">
          Seret file CV ke sini, atau klik untuk memilih
        </p>
        <p className="mt-1 text-xs text-muted">
          Mendukung banyak file sekaligus · PDF dan DOCX
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>Berhasil diproses: <strong className="text-ink">{counts.ready}</strong></span>
        <span>Gagal: <strong className="text-ink">{counts.error}</strong></span>
        <span>Duplikat dilewati: <strong className="text-ink">{counts.duplicate}</strong></span>
        <span>Antre/memproses: <strong className="text-ink">{counts.queued + counts.extracting}</strong></span>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {files.map((f) => {
            const meta = STATUS_META[f.status];
            return (
              <li
                key={f.key}
                className="flex flex-wrap items-center gap-2 bg-white/70 px-3 py-2"
              >
                <span className="max-w-[55%] truncate text-sm font-medium" title={f.name}>
                  {f.name}
                </span>
                <span className="text-xs text-muted">{formatBytes(f.size)}</span>
                <span className={`chip ${meta.cls}`}>{meta.label}</span>
                {f.doc ? (
                  <span className="text-xs text-muted">
                    {f.doc.charCount.toLocaleString("id-ID")} karakter teks
                  </span>
                ) : null}
                {f.error ? (
                  <span className="w-full text-xs text-danger">{f.error}</span>
                ) : null}
                <span className="ml-auto flex items-center gap-1">
                  {f.status === "error" && (
                    <button
                      type="button"
                      className="btn btn-quiet px-2 py-1 text-xs"
                      onClick={() => onRetry(f.key)}
                    >
                      Coba ulang
                    </button>
                  )}
                  {(f.status === "error" || f.status === "duplicate") && (
                    <button
                      type="button"
                      className="btn btn-quiet px-2 py-1 text-xs"
                      onClick={() => onRemove(f.key)}
                    >
                      Hapus
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {counts.ready > 0 && (
        <p className="mt-3 text-xs text-muted">
          Contoh data sintetis tersedia melalui tombol “Gunakan 7 CV contoh” —
          seluruhnya fiktif dan dibuat untuk pengujian, bukan kandidat sungguhan.
        </p>
      )}
    </section>
  );
}
