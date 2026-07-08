"use client";

import { useState } from "react";
import { motion } from "motion/react";

export function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground/70">Your rating</span>
      <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= active;
          return (
            <motion.button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? null : n)}
              onMouseEnter={() => setHover(n)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.85 }}
              animate={{ scale: filled ? 1.05 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 12 }}
              className={`text-2xl leading-none transition-colors ${
                filled ? "text-amber-400 drop-shadow-[0_1px_3px_rgba(251,191,36,0.5)]" : "text-foreground/20"
              }`}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              ★
            </motion.button>
          );
        })}
        {value != null && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="ml-2 self-center text-xs text-foreground/50"
          >
            {value}/5
          </motion.span>
        )}
      </div>
    </div>
  );
}
