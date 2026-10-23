import type { Criterion, CriterionKind } from "@/lib/types";
import { nextCriterionId } from "@/lib/suggest";
import { SectionHeader } from "./bits";

const KIND_LABEL: Record<CriterionKind, string> = {
  required: "Wajib",
  bonus: "Nilai tambah",
};

export function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: Criterion[];
  onChange: (criteria: Criterion[]) => void;
}) {
  const update = (id: string, patch: Partial<Criterion>) =>
    onChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const remove = (id: string) =>
    onChange(criteria.filter((c) => c.id !== id));

  const add = () =>
    onChange([
      ...criteria,
      {
        id: nextCriterionId(),
        text: "",
        weight: 3,
        kind: "required",
      },
    ]);

  const requiredCount = criteria.filter((c) => c.kind === "required").length;
  const bonusCount = criteria.length - requiredCount;

  return (
    <section id="kriteria" className="card p-6">
      <SectionHeader
        step="02 — Kriteria"
        title="Persyaratan wajib & nilai tambah"
        hint="Bobot 1–5 menentukan kontribusi kriteria terhadap skor 0–100. Kriteria wajib yang tidak terpenuhi selalu ditandai terpisah — skor tidak pernah menyembunyikannya."
        right={
          <span className="label-mono">
            {requiredCount} wajib · {bonusCount} nilai tambah
          </span>
        }
      />

      {criteria.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Belum ada kriteria. Tulis manual, gunakan tombol “Susun kriteria dari
          deskripsi”, atau muat contoh lowongan.
        </p>
      ) : (
        <ul className="space-y-3">
          {criteria.map((criterion, index) => (
            <li
              key={criterion.id}
              className="grid gap-2 rounded-xl border border-line bg-white/60 p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
            >
              <span className="label-mono hidden sm:block">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                className="input"
                value={criterion.text}
                placeholder="mis. Pengalaman minimal 2 tahun sebagai Barista"
                onChange={(e) => update(criterion.id, { text: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <select
                  className="input w-auto"
                  value={criterion.kind}
                  aria-label={`Jenis kriteria ${index + 1}`}
                  onChange={(e) =>
                    update(criterion.id, {
                      kind: e.target.value as CriterionKind,
                    })
                  }
                >
                  <option value="required">Wajib</option>
                  <option value="bonus">Nilai tambah</option>
                </select>
                <select
                  className="input w-auto"
                  value={criterion.weight}
                  aria-label={`Bobot kriteria ${index + 1}`}
                  onChange={(e) =>
                    update(criterion.id, { weight: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      Bobot {w}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-quiet px-2"
                aria-label={`Hapus kriteria ${index + 1}`}
                onClick={() => remove(criterion.id)}
              >
                Hapus
              </button>
              <span
                className={`chip sm:hidden ${
                  criterion.kind === "required" ? "chip-met" : "chip-bonus"
                }`}
              >
                {KIND_LABEL[criterion.kind]} · bobot {criterion.weight}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" className="btn btn-outline" onClick={add}>
          + Tambah kriteria
        </button>
        {criteria.length > 0 && (
          <span className="text-xs text-muted">
            Total bobot: {criteria.reduce((s, c) => s + c.weight, 0)}
          </span>
        )}
      </div>
    </section>
  );
}
