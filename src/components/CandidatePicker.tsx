"use client";

import { motion } from "motion/react";
import type { WineCandidate } from "@/lib/schema";

/** Trigram scores are small numbers; scale to a friendlier 0-100 for display. */
function matchPercent(score: number): number {
  return Math.min(100, Math.round(score * 130));
}

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
      <p className="text-sm font-medium text-foreground/80">
        We found a few possible matches — which one is it?
      </p>
      {candidates.map((c, i) => {
        const pct = matchPercent(c.score);
        return (
          <motion.button
            key={c.id}
            onClick={() => onPick(c)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/60 p-3 text-left transition-colors hover:border-wine hover:bg-wine-light dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium leading-snug">{c.title}</span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-foreground/50">
                {pct}% match
              </span>
            </div>
            <span className="text-sm text-foreground/60">
              {[c.winery, c.province || c.region_1, c.country].filter(Boolean).join(" · ")}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <motion.div
                className="h-full rounded-full bg-wine/70"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 6)}%` }}
                transition={{ delay: i * 0.08 + 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.button>
        );
      })}
      <motion.button
        onClick={onNoneOfThese}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: candidates.length * 0.08 + 0.1 }}
        className="mt-1 text-sm font-medium text-foreground/60 underline underline-offset-2 hover:text-wine"
      >
        None of these — let me enter it manually
      </motion.button>
    </div>
  );
}
