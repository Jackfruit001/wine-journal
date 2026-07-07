"use client";

import { useEffect, useState } from "react";
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
  recognition_status: RecognitionStatus;
  confidence: number | null;
  user_rating: number | null;
  user_notes: string | null;
}

export function JournalList() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((res) => res.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setEntries(body.entries);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load journal"));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!entries) return <p className="text-sm text-foreground/60">Loading…</p>;
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        No entries yet.{" "}
        <Link href="/" className="text-wine underline">
          Photograph a wine
        </Link>{" "}
        to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex gap-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:bg-white/5"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
            {entry.image_url && (
              <Image
                src={entry.image_url}
                alt={entry.wine_name ?? "Wine label"}
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">
                {entry.wine_name || "Unnamed wine"}
                {entry.vintage ? ` · ${entry.vintage}` : ""}
              </span>
              {entry.confidence !== null && (
                <ConfidenceBadge status={entry.recognition_status} confidence={entry.confidence} />
              )}
            </div>
            <span className="text-sm text-foreground/60">
              {[entry.producer, entry.region, entry.country].filter(Boolean).join(" · ")}
            </span>
            <div className="flex items-center justify-between text-xs text-foreground/40">
              <span>{new Date(entry.created_at).toLocaleDateString()}</span>
              {entry.user_rating && <span>{"⭐".repeat(entry.user_rating)}</span>}
            </div>
            {entry.user_notes && <p className="text-sm text-foreground/70">{entry.user_notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
