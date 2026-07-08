import { describeConfidence, type ConfidenceTier } from "@/lib/confidence";
import type { RecognitionStatus } from "@/lib/schema";

const TIER_BAR: Record<ConfidenceTier, string> = {
  high: "bg-emerald-500",
  moderate: "bg-amber-500",
  low: "bg-zinc-400",
};

const TIER_TEXT: Record<ConfidenceTier, string> = {
  high: "text-emerald-700 dark:text-emerald-300",
  moderate: "text-amber-700 dark:text-amber-300",
  low: "text-zinc-600 dark:text-zinc-400",
};

/**
 * The overall recognition confidence, shown as a labelled meter.
 * The score is a deterministic formula (lib/confidence.ts), driven mainly by an
 * independent database match — not the model's opinion of itself.
 */
export function ConfidenceMeter({
  confidence,
  status,
  source,
}: {
  confidence: number;
  status: RecognitionStatus;
  source?: "database" | "label_only" | null;
}) {
  const { pct, label, tier } = describeConfidence(confidence);

  const basis =
    status === "needs_confirmation"
      ? "Two close matches — pick the right one below."
      : source === "database"
        ? "Verified against our 130k-wine database."
        : source === "label_only"
          ? "Read from the label — not in our database."
          : "Based on what we could read.";

  return (
    <div className="rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${TIER_TEXT[tier]}`}>{label}</span>
        <span className={`text-sm font-medium tabular-nums ${TIER_TEXT[tier]}`}>{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${TIER_BAR[tier]}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-foreground/50">{basis}</p>
    </div>
  );
}
