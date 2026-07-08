"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { WineFieldsEditor } from "./WineFieldsEditor";
import { TastingNoteInput } from "./TastingNoteInput";
import { StarRating } from "./StarRating";
import { ConfidenceMeter } from "./ConfidenceMeter";
import type { EntryFields, RecognitionStatus } from "@/lib/schema";
import type { FieldConfidenceMap } from "@/lib/confidence";

interface FullEntry extends EntryFields {
  id: string;
  created_at: string;
  image_url: string | null;
  raw_ocr_text: string | null;
  recognition_status: RecognitionStatus;
  confidence: number | null;
  confidence_fields: FieldConfidenceMap | null;
  matched_wine_id: number | null;
  source: "database" | "label_only" | null;
  user_rating: number | null;
  user_notes: string | null;
}

export function EntryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<FullEntry | null>(null);
  const [fields, setFields] = useState<EntryFields | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch(`/api/entries/${id}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        const e: FullEntry = body.entry;
        setEntry(e);
        setFields({
          wine_name: e.wine_name,
          producer: e.producer,
          vintage: e.vintage,
          country: e.country,
          region: e.region,
          grape_variety: e.grape_variety ?? [],
          wine_type: e.wine_type,
          abv: e.abv,
        });
        setRating(e.user_rating);
        setNotes(e.user_notes ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load entry"));
  }, [id]);

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, user_rating: rating, user_notes: notes || null, user_edited: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this journal entry?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    router.push("/journal");
  }

  if (error && !entry) return <p className="text-sm text-rose-600">{error}</p>;
  if (!entry || !fields) return <p className="text-sm text-foreground/60">Loading…</p>;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 md:sticky md:top-24 md:self-start">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-wine/5 to-wine/15 shadow-md">
          {entry.image_url ? (
            <Image
              src={entry.image_url}
              alt={fields.wine_name ?? "Wine label"}
              fill
              sizes="(min-width: 768px) 360px, 100vw"
              unoptimized
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl opacity-30">🍷</div>
          )}
        </div>
        <p className="text-center text-xs text-foreground/50">
          Journalled {new Date(entry.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </p>
        {entry.confidence !== null && (
          <ConfidenceMeter confidence={entry.confidence} status={entry.recognition_status} source={entry.source} />
        )}
      </div>

      <div className="flex flex-col gap-5">
        <WineFieldsEditor fields={fields} onChange={setFields} fieldConfidence={entry.confidence_fields} />

        <StarRating value={rating} onChange={setRating} />

        <TastingNoteInput
          fields={fields}
          matchedWineId={entry.matched_wine_id}
          notes={notes}
          onChangeNotes={setNotes}
        />

        {entry.raw_ocr_text && (
          <div className="rounded-lg border border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setShowRaw((s) => !s)}
              className="w-full px-3 py-2 text-left text-sm font-medium text-foreground/70"
            >
              {showRaw ? "▾" : "▸"} What we read off the label
            </button>
            {showRaw && (
              <pre className="whitespace-pre-wrap break-words border-t border-black/10 px-3 py-2 text-xs text-foreground/60 dark:border-white/10">
                {entry.raw_ocr_text}
              </pre>
            )}
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-wine px-5 py-2.5 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-emerald-600">✓ Saved</span>}
          <button
            onClick={handleDelete}
            className="ml-auto text-sm font-medium text-foreground/50 hover:text-rose-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
