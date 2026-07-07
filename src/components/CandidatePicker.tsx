"use client";

import type { WineCandidate } from "@/lib/schema";

export function CandidatePicker({
  candidates,
  onPick,
  onNoneOfThese,
}: {
  candidates: WineCandidate[];
  onPick: (candidate: WineCandidate) => void;
  onNoneOfThese: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground/80">We think it&apos;s one of these:</p>
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c)}
          className="flex flex-col gap-0.5 rounded-xl border border-black/10 bg-white/60 p-3 text-left transition-colors hover:border-wine hover:bg-wine-light dark:bg-white/5"
        >
          <span className="font-medium">{c.title}</span>
          <span className="text-sm text-foreground/60">
            {[c.winery, c.province || c.region_1, c.country].filter(Boolean).join(" · ")}
          </span>
        </button>
      ))}
      <button
        onClick={onNoneOfThese}
        className="mt-1 text-sm font-medium text-foreground/60 underline underline-offset-2 hover:text-wine"
      >
        None of these — edit manually
      </button>
    </div>
  );
}
