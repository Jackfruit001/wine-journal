"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!entries) return <p className="text-sm text-foreground/60">Loading…</p>;
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center dark:border-white/15">
        <p className="text-foreground/60">
          No entries yet.{" "}
          <Link href="/" className="font-medium text-wine underline underline-offset-2">
            Photograph a wine
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, producer, grape, region…"
        className="w-full rounded-full border border-black/10 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-wine dark:border-white/10 dark:bg-white/5"
      />

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground/50">No wines match “{query}”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Link
              key={entry.id}
              href={`/journal/${entry.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/60 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/5"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-b from-wine/5 to-wine/15">
                {entry.image_url ? (
                  <Image
                    src={entry.image_url}
                    alt={entry.wine_name ?? "Wine label"}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    unoptimized
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl opacity-40">🍷</div>
                )}
                {entry.confidence !== null && (
                  <div className="absolute right-2 top-2">
                    <ConfidenceBadge status={entry.recognition_status} confidence={entry.confidence} />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium leading-snug">
                    {entry.wine_name || "Unnamed wine"}
                    {entry.vintage ? ` · ${entry.vintage}` : ""}
                  </span>
                </div>
                <span className="text-sm text-foreground/60">
                  {[entry.producer, entry.region, entry.country].filter(Boolean).join(" · ") || "—"}
                </span>
                <div className="mt-auto flex items-center justify-between pt-1 text-xs text-foreground/40">
                  <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                  {entry.user_rating && <span className="text-amber-500">{"★".repeat(entry.user_rating)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
