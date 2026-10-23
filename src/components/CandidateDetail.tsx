import { useEffect } from "react";
import type { CandidateResult, Criterion, JobInfo } from "@/lib/types";
import { CriterionStatusChip, EvaluationStateChip } from "./bits";

function EvidenceList({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {evidence.map((quote, i) => (
        <li
          key={i}
          className="border-l-2 border-accent bg-accent-soft/40 px-3 py-1.5 text-[13px] leading-relaxed text-ink/90"
        >
          <span aria-hidden className="mr-1 text-accent">“</span>
          {quote}
          <span aria-hidden className="ml-0.5 text-accent">”</span>
        </li>
      ))}
    </ul>
  );
}

function CriterionBlock({
  criterion,
  evaluation,
}: {
  criterion: Criterion | undefined;
  evaluation: CandidateResult["analysis"]["evaluations"][number];
}) {
  return (
    <li className="rounded-xl border border-line bg-white/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CriterionStatusChip status={evaluation.status} />
        {criterion?.kind === "bonus" && (
          <span className="chip chip-bonus">Nilai tambah</span>
        )}
        {criterion && (
          <span className="label-mono">bobot {criterion.weight}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium">
        {criterion?.text ?? evaluation.criterionId}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {evaluation.reason}
      </p>
      <EvidenceList evidence={evaluation.evidence} />
    </li>
  );
}

function StringList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0)
    return <p className="text-sm text-muted italic">{empty}</p>;
  return (
    <ul className="space-y-1 text-[13px] leading-relaxed">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-accent">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CandidateDetail({
  result,
  criteria,
  job,
  mode,
  onClose,
}: {
  result: CandidateResult;
  criteria: Criterion[];
  job: JobInfo;
  mode: "demo" | "ai" | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { analysis, score, state } = result;
  const required = criteria.filter((c) => c.kind === "required");
  const bonus = criteria.filter((c) => c.kind === "bonus");
  const evalById = new Map(
    analysis.evaluations.map((ev) => [ev.criterionId, ev]),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail kandidat ${analysis.candidateName ?? result.fileName}`}
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-b-none p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-mono">Detail kandidat</div>
            <h3 className="mt-1 text-xl font-semibold">
              {analysis.candidateName ?? "(nama tidak ditemukan di CV)"}
            </h3>
            <p className="mt-0.5 text-xs text-muted">{result.fileName}</p>
          </div>
          <button
            type="button"
            className="btn btn-quiet px-2 py-1"
            aria-label="Tutup detail"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-white/60 p-3">
            <div className="label-mono">Skor kecocokan</div>
            <div className="mt-1 font-mono text-3xl font-bold tabular-nums">
              {score.score}
              <span className="text-base font-medium text-muted">/100</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              {score.earnedWeight} dari total bobot {score.totalWeight}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-white/60 p-3">
            <div className="label-mono">Persyaratan wajib</div>
            <div className="mt-1 font-mono text-3xl font-bold tabular-nums">
              {score.requiredMet}
              <span className="text-base font-medium text-muted">
                /{score.requiredTotal}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted">
              {score.requiredUnmet.length > 0
                ? `${score.requiredUnmet.length} tidak terpenuhi`
                : "Semua terpenuhi"}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-white/60 p-3">
            <div className="label-mono">Status evaluasi</div>
            <div className="mt-2">
              <EvaluationStateChip state={state} />
            </div>
            <div className="mt-1.5 text-xs text-muted">
              {score.unknownCriteria.length > 0
                ? `${score.unknownCriteria.length} kriteria belum diketahui`
                : "Seluruh kriteria dinilai dari bukti"}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <h4 className="label-mono">Ringkasan profesional</h4>
          <p className="mt-1.5 text-sm leading-relaxed">{analysis.summary}</p>
        </div>

        {analysis.insufficientDocument && (
          <p className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            Dokumen ini tidak cukup informatif untuk dinilai. Hasil ditandai
            “perlu tinjauan” — jangan anggap sebagai penolakan otomatis.
          </p>
        )}

        <div className="mt-5">
          <h4 className="label-mono">
            Penjelasan skor ({mode === "ai" ? "analisis AI" : "mode demo — heuristik lokal"})
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {analysis.reasoning}
          </p>
          <p className="mt-2 font-mono text-xs text-muted">
            skor = 100 × (bobot kriteria terpenuhi {score.earnedWeight} ÷ total
            bobot {score.totalWeight}) = {score.score}
          </p>
        </div>

        <div className="mt-5">
          <h4 className="label-mono">Pengalaman kerja relevan</h4>
          <div className="mt-1.5">
            <StringList
              items={analysis.relevantExperience}
              empty="Tidak ada pengalaman relevan yang teridentifikasi di CV."
            />
          </div>
        </div>

        <div className="mt-5">
          <h4 className="label-mono">Pendidikan & sertifikasi</h4>
          <div className="mt-1.5">
            <StringList
              items={analysis.education}
              empty="Tidak ditemukan informasi pendidikan/sertifikasi di CV."
            />
          </div>
        </div>

        <div className="mt-5">
          <h4 className="label-mono">Keterampilan yang ditemukan</h4>
          {analysis.skills.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted italic">
              Tidak ada daftar keterampilan yang teridentifikasi.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {analysis.skills.map((skill, i) => (
                <span key={i} className="chip chip-neutral">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {analysis.unverified.length > 0 && (
          <div className="mt-5">
            <h4 className="label-mono">Informasi yang perlu diverifikasi</h4>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-unknown">
              {analysis.unverified.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>⚠</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <h4 className="label-mono">Persyaratan wajib</h4>
          <ul className="mt-2 space-y-2">
            {required.map((c) => (
              <CriterionBlock
                key={c.id}
                criterion={c}
                evaluation={
                  evalById.get(c.id) ?? {
                    criterionId: c.id,
                    status: "unknown",
                    evidence: [],
                    reason: "Evaluasi tidak tersedia.",
                  }
                }
              />
            ))}
          </ul>
        </div>

        {bonus.length > 0 && (
          <div className="mt-5">
            <h4 className="label-mono">Kriteria nilai tambah</h4>
            <ul className="mt-2 space-y-2">
              {bonus.map((c) => (
                <CriterionBlock
                  key={c.id}
                  criterion={c}
                  evaluation={
                    evalById.get(c.id) ?? {
                      criterionId: c.id,
                      status: "unknown",
                      evidence: [],
                      reason: "Evaluasi tidak tersedia.",
                    }
                  }
                />
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Evaluasi ini adalah rekomendasi berbasis bukti untuk membantu HR
          meninjau kandidat — bukan keputusan penolakan otomatis. Attribute
          pribadi (nama, usia, jenis kelamin, dll.) tidak digunakan sebagai dasar
          penilaian. Lowongan: {job.title}
          {job.company ? ` — ${job.company}` : ""}
          {job.location ? ` · ${job.location}` : ""}.
        </p>
      </div>
    </div>
  );
}
