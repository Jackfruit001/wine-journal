import type { RecognitionStatus } from "@/lib/schema";

const STYLES: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function tier(status: RecognitionStatus, confidence: number): "high" | "medium" | "low" {
  if (status === "unrecognized") return "low";
  if (status === "needs_confirmation") return "medium";
  return confidence >= 0.8 ? "high" : "medium";
}

export function ConfidenceBadge({
  status,
  confidence,
}: {
  status: RecognitionStatus;
  confidence: number;
}) {
  const level = tier(status, confidence);
  const label =
    status === "unrecognized"
      ? "Not recognized"
      : status === "needs_confirmation"
        ? "Needs your confirmation"
        : `${Math.round(confidence * 100)}% confident`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[level]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          level === "high" ? "bg-emerald-500" : level === "medium" ? "bg-amber-500" : "bg-zinc-500"
        }`}
      />
      {label}
    </span>
  );
}
