"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { EntryFields } from "@/lib/schema";

/**
 * Notes input with AI-suggested, tappable tasting-note chips. Most people won't
 * write prose, so we offer grounded one-tap descriptors (from real reviews of the
 * matched wine) alongside a free-text box.
 */
export function TastingNoteInput({
  fields,
  matchedWineId,
  notes,
  onChangeNotes,
}: {
  fields: EntryFields;
  matchedWineId: number | null;
  notes: string;
  onChangeNotes: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    fetch("/api/tasting-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields, matched_wine_id: matchedWineId }),
    })
      .then((res) => res.json())
      .then((body) => setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleChip(chip: string) {
    if (used.has(chip)) return;
    const next = notes.trim() ? `${notes.replace(/\s+$/, "")}, ${chip}` : chip;
    onChangeNotes(next);
    setUsed((prev) => new Set(prev).add(chip));
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-foreground/70">Tasting notes</span>

      {loading ? (
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="h-7 w-20 rounded-full bg-black/5 dark:bg-white/10"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
            />
          ))}
        </div>
      ) : (
        suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((chip, i) => {
                const isUsed = used.has(chip);
                return (
                  <motion.button
                    key={chip}
                    type="button"
                    onClick={() => toggleChip(chip)}
                    disabled={isUsed}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 400, damping: 20 }}
                    whileHover={!isUsed ? { scale: 1.05 } : undefined}
                    whileTap={!isUsed ? { scale: 0.94 } : undefined}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isUsed
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "border-wine/30 bg-wine/5 text-wine hover:bg-wine/10"
                    }`}
                  >
                    <span>{isUsed ? "✓" : "+"}</span>
                    {chip}
                  </motion.button>
                );
              })}
            </div>
            <span className="text-[11px] text-foreground/40">
              AI suggestions from real reviews of similar wines — tap to add, then edit freely.
            </span>
          </div>
        )
      )}

      <div className="relative">
        <textarea
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-black/10 bg-white/70 p-3.5 leading-relaxed shadow-sm outline-none transition-all placeholder:text-foreground/35 focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-white/10 dark:bg-white/5"
          placeholder="Tap a suggestion above, or write your own…"
        />
        <AnimatePresence>
          {notes.length > 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums text-foreground/30"
            >
              {notes.length}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
