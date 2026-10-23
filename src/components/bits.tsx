import type { AnalysisMode, CriterionStatus, EvaluationState } from "@/lib/types";

export function SectionHeader({
  step,
  title,
  hint,
  right,
}: {
  step: string;
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="label-mono">{step}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 max-w-2xl text-sm text-muted">{hint}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

const STATE_STYLE: Record<EvaluationState, { label: string; cls: string }> = {
  complete: { label: "Lengkap", cls: "chip-met" },
  incomplete: { label: "Belum lengkap", cls: "chip-unknown" },
  needs_review: { label: "Perlu tinjauan", cls: "chip-not-met" },
};

export function EvaluationStateChip({ state }: { state: EvaluationState }) {
  const s = STATE_STYLE[state];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

const CRITERION_STYLE: Record<CriterionStatus, { label: string; cls: string }> = {
  met: { label: "Terpenuhi", cls: "chip-met" },
  not_met: { label: "Tidak terpenuhi", cls: "chip-not-met" },
  unknown: { label: "Belum diketahui", cls: "chip-unknown" },
};

export function CriterionStatusChip({ status }: { status: CriterionStatus }) {
  const s = CRITERION_STYLE[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function ModeBanner({ mode }: { mode: AnalysisMode | null }) {
  if (mode === "ai") {
    return (
      <span className="chip chip-met" title="Analisis menggunakan model AI terkonfigurasi di server">
        Mode AI aktif
      </span>
    );
  }
  if (mode === "demo") {
    return (
      <span
        className="chip chip-bonus"
        title="Hasil berasal dari heuristik lokal, bukan model AI. Atur AI_API_KEY untuk analisis AI nyata."
      >
        Mode demo — bukan AI
      </span>
    );
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
