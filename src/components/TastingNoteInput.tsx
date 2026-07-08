"use client";

import { useEffect, useRef, useState } from "react";
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

  function addChip(chip: string) {
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
            <span
              key={i}
              className="h-7 w-20 animate-pulse rounded-full bg-black/5 dark:bg-white/10"
            />
          ))}
        </div>
      ) : (
        suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => addChip(chip)}
                  disabled={used.has(chip)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    used.has(chip)
                      ? "border-transparent bg-wine/10 text-wine/50 line-through"
                      : "border-wine/30 bg-wine/5 text-wine hover:bg-wine/10"
                  }`}
                >
                  + {chip}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-foreground/40">
              AI suggestions from real reviews of similar wines — tap to add, then edit freely.
            </span>
          </div>
        )
      )}

      <textarea
        value={notes}
        onChange={(e) => onChangeNotes(e.target.value)}
        rows={3}
        className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 outline-none focus:border-wine dark:border-white/10 dark:bg-white/5"
        placeholder="Tap a suggestion above, or write your own…"
      />
    </div>
  );
}
