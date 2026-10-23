import type { JobInfo } from "@/lib/types";
import { SectionHeader } from "./bits";

export function JobPanel({
  job,
  onChange,
  onPreset,
  onSuggest,
  suggesting,
}: {
  job: JobInfo;
  onChange: (job: JobInfo) => void;
  onPreset: () => void;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  const set = (patch: Partial<JobInfo>) => onChange({ ...job, ...patch });

  return (
    <section id="lowongan" className="card p-6">
      <SectionHeader
        step="01 — Lowongan"
        title="Informasi lowongan"
        hint="Tempel deskripsi pekerjaan lengkap, lalu susun kriteria skrining. Kriteria tetap bisa ditinjau dan diubah sebelum screening dimulai."
        right={
          <>
            <button type="button" className="btn btn-quiet" onClick={onPreset}>
              Isi contoh “The Bali Saudi”
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onSuggest}
              disabled={suggesting || job.description.trim().length < 10}
            >
              {suggesting ? "Menyusun…" : "Susun kriteria dari deskripsi"}
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label-mono">Nama posisi *</span>
          <input
            className="input mt-1.5"
            value={job.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="mis. Barista / Bartender"
          />
        </label>
        <label className="block">
          <span className="label-mono">Perusahaan (opsional)</span>
          <input
            className="input mt-1.5"
            value={job.company}
            onChange={(e) => set({ company: e.target.value })}
            placeholder="mis. Kopi Nusantara"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="label-mono">Lokasi kerja</span>
          <input
            className="input mt-1.5"
            value={job.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="mis. Al Khobar, Arab Saudi"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="label-mono">Deskripsi pekerjaan</span>
          <textarea
            className="input mt-1.5 min-h-40 font-mono text-[13px] leading-relaxed"
            value={job.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Tempel deskripsi lowongan lengkap di sini…"
          />
        </label>
      </div>
    </section>
  );
}
