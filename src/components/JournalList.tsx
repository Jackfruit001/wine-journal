"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { RecognitionStatus } from "@/lib/schema";

interface JournalEntry {
  id: string;
  created_at: string;
  image_url: string | null;
  wine_name: string | null;
  producer: string | null;
  vintage: number | null;
  country: string | null;
  region: string | null;
  grape_variety: string[] | null;
  wine_type: string | null;
  recognition_status: RecognitionStatus;
  confidence: number | null;
  user_rating: number | null;
  user_notes: string | null;
}

export function JournalList() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/entries")
      .then((res) => res.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setEntries(body.entries);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load journal"));
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.wine_name, e.producer, e.region, e.country, e.wine_type, ...(e.grape_variety ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [entries, query]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this journal entry?")) return;
    // remove locally first so the exit animation plays immediately
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    await fetch(`/api/entries/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!entries) return <p className="text-sm text-foreground/60">Loading…</p>;
  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-dashed border-black/15 p-10 text-center dark:border-white/15"
      >
        <p className="text-foreground/60">
          No entries yet.{" "}
          <Link href="/" className="font-medium text-wine underline underline-offset-2">
            Photograph a wine
          </Link>{" "}
          to get started.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, producer, grape, region…"
        className="w-full rounded-full border border-black/10 bg-white/70 px-4 py-2.5 text-sm outline-none transition-all focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-white/10 dark:bg-white/5"
      />

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground/50">No wines match “{query}”.</p>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((entry, i) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.04, 0.3) }}
                whileHover={{ y: -4 }}
                className="group relative"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(entry.id);
                  }}
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                  aria-label="Delete entry"
                >
                  ✕
                </button>
                <Link
                  href={`/journal/${entry.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/60 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/5"
                >
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-b from-wine/5 to-wine/15 p-2">
                    {entry.image_url ? (
                      <Image
                        src={entry.image_url}
                        alt={entry.wine_name ?? "Wine label"}
                        width={300}
                        height={300}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        unoptimized
                        className="max-h-full w-auto rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl opacity-40">🍷</div>
                    )}
                    {entry.confidence !== null && (
                      <div className="absolute left-2 top-2">
                        <ConfidenceBadge status={entry.recognition_status} confidence={entry.confidence} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="font-medium leading-snug">
                      {entry.wine_name || "Unnamed wine"}
                      {entry.vintage ? ` · ${entry.vintage}` : ""}
                    </span>
                    <span className="text-sm text-foreground/60">
                      {[entry.producer, entry.region, entry.country].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/70">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        {new Date(entry.created_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {entry.user_rating && <span className="text-sm text-amber-400">{"★".repeat(entry.user_rating)}</span>}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
