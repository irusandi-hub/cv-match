import { useMemo } from "react";
import type { CandidateResult, EvaluationState } from "@/lib/types";
import { EVALUATION_STATE_LABEL } from "@/lib/scoring";
import { EvaluationStateChip, SectionHeader } from "./bits";

export type StatusFilter = "all" | EvaluationState;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Semua status" },
  { value: "complete", label: "Lengkap" },
  { value: "incomplete", label: "Belum lengkap" },
  { value: "needs_review", label: "Perlu tinjauan" },
];

export function ResultsTable({
  results,
  search,
  onSearch,
  filter,
  onFilter,
  onOpen,
  onExport,
  exporting,
  mode,
}: {
  results: CandidateResult[];
  search: string;
  onSearch: (v: string) => void;
  filter: StatusFilter;
  onFilter: (v: StatusFilter) => void;
  onOpen: (result: CandidateResult) => void;
  onExport: () => void;
  exporting: boolean;
  mode: "demo" | "ai" | null;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (filter !== "all" && r.state !== filter) return false;
      if (!q) return true;
      const haystack = `${r.analysis.candidateName ?? ""} ${r.fileName}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [results, search, filter]);

  return (
    <section id="hasil" className="card p-6">
      <SectionHeader
        step="05 — Hasil"
        title="Peringkat kandidat"
        hint="Klik baris untuk melihat bukti penilaian per kriteria. Ekspor menghasilkan CSV UTF-8 yang aman dibuka di Excel."
        right={
          <button
            type="button"
            className="btn btn-primary"
            onClick={onExport}
            disabled={exporting || results.length === 0}
          >
            {exporting ? "Mengekspor…" : "Ekspor CSV (Excel)"}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          value={search}
          placeholder="Cari nama kandidat atau file…"
          aria-label="Cari kandidat"
          onChange={(e) => onSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={filter}
          aria-label="Saring berdasarkan status evaluasi"
          onChange={(e) => onFilter(e.target.value as StatusFilter)}
        >
          {FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">
          Menampilkan {filtered.length} dari {results.length} kandidat
          {mode === "demo" ? " · hasil mode demo" : ""}
        </span>
      </div>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          Belum ada hasil. Lengkapi lowongan, kriteria, dan unggah CV minimal
          satu berkas, lalu jalankan screening.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          Tidak ada kandidat yang cocok dengan pencarian/saringan.
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-2 py-2 font-semibold">#</th>
                <th className="px-2 py-2 font-semibold">Nama kandidat</th>
                <th className="px-2 py-2 font-semibold">Skor</th>
                <th className="px-2 py-2 font-semibold">Wajib terpenuhi</th>
                <th className="px-2 py-2 font-semibold">Status evaluasi</th>
                <th className="px-2 py-2 font-semibold">Keterampilan utama</th>
                <th className="px-2 py-2 font-semibold">Perlu verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const rank = results.indexOf(r) + 1;
                const skills = r.analysis.skills.slice(0, 3).join(", ");
                return (
                  <tr
                    key={r.fileId}
                    tabIndex={0}
                    role="button"
                    className="cursor-pointer border-b border-line/70 transition-colors hover:bg-accent-soft/50 focus:bg-accent-soft/60 focus:outline-none"
                    onClick={() => onOpen(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(r);
                      }
                    }}
                  >
                    <td className="px-2 py-2.5 font-mono text-xs text-muted">
                      {String(rank).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="font-medium">
                        {r.analysis.candidateName ?? (
                          <span className="text-muted">Nama tidak ditemukan</span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted" title={r.fileName}>
                        {r.fileName}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold tabular-nums">
                          {r.score.score}
                        </span>
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${r.score.score}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`chip ${
                          r.score.requiredUnmet.length > 0
                            ? "chip-not-met"
                            : "chip-met"
                        }`}
                        title={
                          r.score.requiredUnmet.length > 0
                            ? `Belum terpenuhi: ${r.score.requiredUnmet.join("; ")}`
                            : "Seluruh persyaratan wajib terpenuhi"
                        }
                      >
                        {r.score.requiredMet}/{r.score.requiredTotal}
                        {r.score.requiredUnmet.length > 0
                          ? ` · ${r.score.requiredUnmet.length} gagal`
                          : ""}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <EvaluationStateChip state={r.state} />
                      <span className="ml-1 text-xs text-muted">
                        {EVALUATION_STATE_LABEL[r.state]}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-xs text-muted">
                      {skills || "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-xs text-unknown" title={r.analysis.unverified.join("\n")}>
                      {r.analysis.unverified.length > 0
                        ? `${r.analysis.unverified.length} hal`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
